import uuid
import logging
import requests
from sqlalchemy.orm import Session
from app.models.core import (
    Message, Conversation,
    Contact, ContactIdentity, FacebookPage
)
from app.models.enums import Platform, ConversationStatus, MessageDirection, MessageKind
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message

logger = logging.getLogger(__name__)

# =========================
# SAVE MESSAGE
# =========================
def save_message(
    db: Session,
    *,
    company_id,
    channel_id,
    contact_id,
    conversation_id,
    text,
    external_message_id=None,
    employee_id=None,
    kind=MessageKind.INBOX,
):
    # 🔥 Idempotency
    if external_message_id:
        existing = (
            db.query(Message)
            .filter(
                Message.external_message_id == external_message_id,
                Message.company_id == company_id,
            )
            .first()
        )
        if existing:
            print(f"⚠️ Duplicate skipped: {external_message_id}")
            return existing

    msg = Message(
        id=uuid.uuid4(),
        company_id=company_id,
        channel_id=channel_id,
        contact_id=contact_id,
        conversation_id=conversation_id,
        direction=MessageDirection.INBOUND,
        kind=kind,  # 🔥 dùng param
        text=text,
        external_message_id=external_message_id,
        employee_id=employee_id,
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# =========================
# ENSURE CONTACT INFO
# =========================
def ensure_contact_info(contact: Contact, sender_id: str, page_access_token=None, db: Session = None):
    """Fetch display_name + avatar_url từ Facebook nếu chưa có"""
    if contact.display_name and contact.avatar_url:
        return contact

    if page_access_token:
        url = f"https://graph.facebook.com/{sender_id}"
        params = {"fields": "name,picture", "access_token": page_access_token}
        try:
            res = requests.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                contact.display_name = data.get("name")
                contact.avatar_url = data.get("picture", {}).get("data", {}).get("url")
                db.commit()
                db.refresh(contact)
                print(f"✅ Updated contact info: {contact.display_name}")
        except Exception as e:
            print(f"⚠️ Could not fetch contact info: {e}")

    return contact


# =========================
# HANDLE INCOMING MESSAGE
# =========================
def handle_incoming_message(db: Session, message: dict):
    try:
        sender_id = message.get("sender_id")
        text = message.get("text")

        if not sender_id or not text:
            print(f"⚠️ Invalid message skipped: {message}")
            return

        print(f"📨 Processing message from {sender_id}")

        company_id = uuid.UUID(message["company_id"])
        channel_id = uuid.UUID(message["channel_id"])

        # 🔥 xác định loại
        is_comment = message.get("type") == "comment" or message.get("kind") == "comment"

        # 🔥 lấy external id
        external_id = message.get("mid") or message.get("comment_id")
        if not external_id:
            print("⚠️ Missing external_id (mid/comment_id)")
            return

        # =========================
        # 1️⃣ Find / Create Contact
        # =========================
        identity = (
            db.query(ContactIdentity)
            .filter_by(
                company_id=company_id,
                platform=Platform.FACEBOOK,
                external_user_id=sender_id,
            )
            .first()
        )

        if not identity:
            contact = Contact(id=uuid.uuid4(), company_id=company_id)
            db.add(contact)
            db.commit()
            db.refresh(contact)

            identity = ContactIdentity(
                id=uuid.uuid4(),
                company_id=company_id,
                contact_id=contact.id,
                platform=Platform.FACEBOOK,
                external_user_id=sender_id,
            )
            db.add(identity)
            db.commit()
            db.refresh(identity)

        contact = identity.contact

        # =========================
        # 2️⃣ Update contact info
        # =========================
        fb_page = db.query(FacebookPage).filter(
            FacebookPage.page_id == message.get("page_id")
        ).first()

        page_token = fb_page.access_token if fb_page else None
        contact = ensure_contact_info(contact, sender_id, page_access_token=page_token, db=db)

        # =========================
        # 3️⃣ Find / Create Conversation
        # =========================
        if is_comment:
            post_id = message.get("post_id")

            conversation = (
                db.query(Conversation)
                .filter_by(
                    company_id=company_id,
                    channel_id=channel_id,
                    post_id=post_id,   # ✅ dùng post_id riêng
                )
                .first()
            )
        else:
            conversation = (
                db.query(Conversation)
                .filter_by(
                    company_id=company_id,
                    channel_id=channel_id,
                    contact_id=contact.id,
                )
                .first()
            )

        if not conversation:
            conversation = Conversation(
                id=uuid.uuid4(),
                company_id=company_id,
                channel_id=channel_id,
                contact_id=contact.id,
                status=ConversationStatus.OPEN,

                # 🔥 fix đúng field
                page_id=message.get("page_id"),
                post_id=message.get("post_id") if is_comment else None,
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # =========================
        # 4️⃣ Save Message
        # =========================
        saved = save_message(
            db,
            company_id=company_id,
            channel_id=channel_id,
            contact_id=contact.id,
            conversation_id=conversation.id,
            text=text,
            external_message_id=external_id,
            employee_id=None,
            kind=MessageKind.COMMENT if is_comment else MessageKind.INBOX,  # 🔥 chuẩn luôn
        )

        print(f"💾 Saved message ID: {saved.id}")

        # =========================
        # 5️⃣ Push vào Redis queue
        # =========================
        message_queue.enqueue(
            process_incoming_message,
            str(saved.id),
            job_timeout=None
        )

        print(f"📤 Pushed message {saved.id} to Redis queue")

    except Exception as e:
        print(f"❌ Error processing message {message}: {e}")