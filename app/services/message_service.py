import uuid
import logging
import requests
from sqlalchemy.orm import Session
import asyncio

from datetime import datetime, timedelta

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
logger = logging.getLogger(__name__)

REFRESH_AFTER_DAYS = 7

def ensure_contact_info(contact, sender_id, page_access_token, db):
    """
    Update display_name + avatar từ Facebook
    có kiểm soát tần suất
    """

    now = datetime.utcnow()

    # =========================
    # CHECK IF NEED REFRESH
    # =========================
    need_refresh = (
        not contact.display_name
        or not contact.last_fetched_at
        or (now - contact.last_fetched_at).days >= REFRESH_AFTER_DAYS
    )

    if not need_refresh:
        return contact

    if not page_access_token:
        return contact

    try:
        url = f"https://graph.facebook.com/{sender_id}"
        params = {
            "fields": "name,picture",
            "access_token": page_access_token
        }

        res = requests.get(url, params=params, timeout=5)

        if res.status_code != 200:
            logger.warning(f"FB API failed: {res.text}")
            return contact

        data = res.json()

        contact.display_name = data.get("name")
        contact.avatar_url = (
            data.get("picture", {})
            .get("data", {})
            .get("url")
        )
        contact.last_fetched_at = now

        db.commit()
        db.refresh(contact)

        logger.info(f"✅ Contact updated: {contact.display_name}")

    except Exception as e:
        logger.warning(f"⚠️ FB fetch error: {e}")

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

        if not sender_id or not text:
            logger.warning(f"⚠️ Invalid message skipped: {message}")
            return None

        if not message.get("company_id") or not message.get("channel_id"):
            logger.error(f"❌ Missing tenant context: {message}")
            return None

        company_id = uuid.UUID(message["company_id"])
        channel_id = uuid.UUID(message["channel_id"])

        # =========================
        # 1. EXTERNAL ID
        # =========================
        external_id = message.get("mid") or message.get("comment_id")
        if not external_id:
            logger.warning("⚠️ Missing external_id")
            return None

        # =========================
        # 2. DUPLICATE CHECK
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
        # 3. CONTACT UPSERT
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
        page = db.query(FacebookPage).filter_by(channel_id=channel_id).first()

        access_token = page.access_token if page else None

        contact = ensure_contact_info(
            contact=contact,
            sender_id=sender_id,
            page_access_token=access_token,
            db=db
        )

        # =========================
        # 4. CONVERSATION
        # =========================
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
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # =========================
        # 5. SAVE MESSAGE
        # =========================
        saved = Message(
            id=uuid.uuid4(),
            company_id=company_id,
            channel_id=channel_id,
            contact_id=contact.id,
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            kind=MessageKind.INBOX,
            text=text,
            external_message_id=external_id,
        )

        db.add(saved)
        db.commit()
        db.refresh(saved)

        logger.info(f"💾 Saved message: {saved.id}")

        # =========================
        # 🔥 6. REALTIME (QUAN TRỌNG NHẤT)
        # =========================
        asyncio.create_task(
            manager.broadcast(str(conversation.id), {
                "type": "new_message",
                "message": {
                    "id": str(saved.id),
                    "text": saved.text,
                    "direction": "inbound",
                    "created_at": saved.created_at.isoformat(),
                }
            })
        )

        # =========================
        # 7. QUEUE AI
        # =========================
        message_queue.enqueue(
            process_incoming_message,
            str(saved.id),
            job_timeout=None
        )

        return saved

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error processing message {message}: {e}")
        return None

def get_conversation_context(db: Session, conversation_id: str, limit: int = 10):
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    # đảo lại để đúng timeline
    messages.reverse()

    context = []
    for msg in messages:
        role = "user" if msg.direction == "inbound" else "assistant"

        context.append({
            "role": role,
            "text": msg.content
        })

    print(f"[CONTEXT] loaded {len(context)} messages")

    return context