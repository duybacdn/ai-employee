import uuid
import logging
import requests
from sqlalchemy.orm import Session

from app.models.core import (
    Message, Conversation,
    Contact, ContactIdentity, FacebookPage
)
from app.models.enums import (
    Platform, ConversationStatus,
    MessageDirection, MessageKind
)
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message

logger = logging.getLogger(__name__)


# =========================
# SAVE MESSAGE (SAFE)
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
    # 🔥 idempotent theo tenant
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
            logger.warning(f"⚠️ Duplicate skipped: {external_message_id}")
            return existing

    msg = Message(
        id=uuid.uuid4(),
        company_id=company_id,
        channel_id=channel_id,
        contact_id=contact_id,
        conversation_id=conversation_id,
        direction=MessageDirection.INBOUND,
        kind=kind,
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
def ensure_contact_info(
    contact: Contact,
    sender_id: str,
    page_access_token=None,
    db: Session = None
):
    if contact.display_name and contact.avatar_url:
        return contact

    if page_access_token:
        try:
            url = f"https://graph.facebook.com/{sender_id}"
            params = {
                "fields": "name,picture",
                "access_token": page_access_token
            }
            res = requests.get(url, params=params, timeout=5)

            if res.status_code == 200:
                data = res.json()
                contact.display_name = data.get("name")
                contact.avatar_url = data.get("picture", {}).get("data", {}).get("url")

                db.commit()
                db.refresh(contact)

                logger.info(f"✅ Updated contact: {contact.display_name}")

        except Exception as e:
            logger.warning(f"⚠️ Fetch contact info failed: {e}")

    return contact


# =========================
# HANDLE INCOMING MESSAGE (FINAL SAFE)
# =========================
def handle_incoming_message(db: Session, message: dict):
    try:
        # =========================
        # 0. VALIDATE
        # =========================
        sender_id = message.get("sender_id")
        text = message.get("text")

        print("📩 Incoming message:", message)

        if not sender_id or not text:
            logger.warning(f"⚠️ Invalid message skipped: {message}")
            return

        if not message.get("company_id") or not message.get("channel_id"):
            logger.error(f"❌ Missing tenant context: {message}")
            return

        company_id = uuid.UUID(message["company_id"])
        channel_id = uuid.UUID(message["channel_id"])

        # =========================
        # 1. DETECT TYPE + ID
        # =========================
        is_comment = message.get("type") == "comment" or message.get("kind") == "comment"

        external_id = message.get("mid") or message.get("comment_id")
        if not external_id:
            logger.warning("⚠️ Missing external_id")
            return

        # =========================
        # 2. DUPLICATE CHECK (EARLY)
        # =========================
        existing = (
            db.query(Message)
            .filter(
                Message.external_message_id == external_id,
                Message.company_id == company_id,
            )
            .first()
        )
        if existing:
            logger.warning(f"⚠️ Duplicate skipped: {external_id}")
            return existing

        # =========================
        # 3. FIND / CREATE CONTACT
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
            contact = Contact(
                id=uuid.uuid4(),
                company_id=company_id
            )
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
        # 4. UPDATE CONTACT INFO
        # =========================
        fb_page = db.query(FacebookPage).filter(
            FacebookPage.page_id == message.get("page_id")
        ).first()

        page_token = fb_page.access_token if fb_page else None

        contact = ensure_contact_info(
            contact,
            sender_id,
            page_access_token=page_token,
            db=db
        )

        # =========================
        # 5. FIND / CREATE CONVERSATION
        # =========================
        if is_comment:
            post_id = message.get("post_id")

            conversation = (
                db.query(Conversation)
                .filter_by(
                    company_id=company_id,
                    channel_id=channel_id,
                    post_id=post_id,
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
                page_id=message.get("page_id"),
                post_id=message.get("post_id") if is_comment else None,
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # =========================
        # 6. SAVE MESSAGE
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
            kind=MessageKind.COMMENT if is_comment else MessageKind.INBOX,
        )

        logger.info(f"💾 Saved message: {saved.id}")

        # =========================
        # 7. PUSH QUEUE
        # =========================
        message_queue.enqueue(
            process_incoming_message,
            str(saved.id),
            job_timeout=None
        )

        logger.info(f"📤 Queued message {saved.id}")

        return saved

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error processing message {message}: {e}")