import uuid
import logging
import requests
from sqlalchemy.orm import Session
import asyncio
from app.ws import manager

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

def ensure_contact_info(contact, sender_id, page_access_token, db):
    from datetime import datetime, timedelta
    import requests

    if not page_access_token:
        return contact

    # 🔥 chỉ update khi thiếu data hoặc quá hạn
    need_refresh = (
        not contact.display_name
        or not contact.last_fetched_at
        or (datetime.utcnow() - contact.last_fetched_at).days >= 7
    )

    if not need_refresh:
        return contact

    try:
        url = f"https://graph.facebook.com/{sender_id}"
        params = {
            "fields": "name,picture",
            "access_token": page_access_token
        }

        res = requests.get(url, params=params, timeout=5)

        # ❌ QUAN TRỌNG: KHÔNG THROW EXCEPTION
        if res.status_code != 200:
            return contact

        data = res.json()

        contact.display_name = data.get("name") or contact.display_name
        contact.avatar_url = (
            data.get("picture", {})
            .get("data", {})
            .get("url")
        )

        contact.last_fetched_at = datetime.utcnow()

        db.commit()
        db.refresh(contact)

    except Exception:
        # ❌ KHÔNG crash webhook
        pass

    return contact

# =========================
# HANDLE INCOMING MESSAGE (FINAL SAFE)
# =========================
def handle_incoming_message(db: Session, message: dict):
    try:
        sender_id = message.get("sender_id")
        text = message.get("text")

        if not sender_id or not text:
            return None

        company_id = uuid.UUID(message["company_id"])
        channel_id = uuid.UUID(message["channel_id"])

        external_id = message.get("mid") or message.get("comment_id")
        if not external_id:
            return None

        # =========================
        # COMMENT DETECTION (🔥 FIX QUAN TRỌNG)
        # =========================
        is_comment = message.get("type") == "comment" or message.get("comment_id") is not None
        post_id = message.get("post_id")

        # =========================
        # CONTACT UPSERT (giữ nguyên logic bạn)
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
            db.flush()

            identity = ContactIdentity(
                id=uuid.uuid4(),
                company_id=company_id,
                contact_id=contact.id,
                platform=Platform.FACEBOOK,
                external_user_id=sender_id,
            )
            db.add(identity)
            db.flush()
        else:
            contact = identity.contact

        if not contact:
            return None

        # =========================
        # CONVERSATION (🔥 FIX POST_ID HERE)
        # =========================
        query = db.query(Conversation).filter_by(
            company_id=company_id,
            channel_id=channel_id,
        )

        if is_comment:
            if not post_id:
                logger.warning("⚠️ comment missing post_id")
                return None

            conversation = db.query(Conversation).filter_by(
                company_id=company_id,
                channel_id=channel_id,
                post_id=post_id
            ).first()

            if not conversation:
                conversation = Conversation(
                    id=uuid.uuid4(),
                    company_id=company_id,
                    channel_id=channel_id,
                    contact_id=None,
                    post_id=post_id,
                    status=ConversationStatus.OPEN,
                )
                db.add(conversation)
                db.flush()

        else:
            conversation = db.query(Conversation).filter_by(
                company_id=company_id,
                channel_id=channel_id,
                contact_id=contact.id
            ).first()

            if not conversation:
                conversation = Conversation(
                    id=uuid.uuid4(),
                    company_id=company_id,
                    channel_id=channel_id,
                    contact_id=contact.id,
                    post_id=None,
                    status=ConversationStatus.OPEN,
                )
                db.add(conversation)
                db.flush()

        # =========================
        # MESSAGE SAVE (🔥 FIX KIND)
        # =========================
        saved = Message(
            id=uuid.uuid4(),
            company_id=company_id,
            channel_id=channel_id,
            contact_id=contact.id,
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            kind=MessageKind.COMMENT if is_comment else MessageKind.INBOX,
            text=text,
            external_message_id=external_id,
        )

        db.add(saved)
        db.commit()
        db.refresh(saved)

        return saved

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error: {e}")
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