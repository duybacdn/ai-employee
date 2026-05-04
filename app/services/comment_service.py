import uuid
import logging
from sqlalchemy.orm import Session

from app.models.core import (
    Message, Conversation, Contact, ContactIdentity, FacebookPage
)
from app.models.enums import (
    Platform, ConversationStatus, MessageDirection, MessageKind
)
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message
from app.services.message_service import ensure_contact_info

logger = logging.getLogger(__name__)


def handle_incoming_comment(db: Session, comment: dict):
    try:
        sender_id = comment.get("sender_id")
        text = comment.get("text")
        comment_id = comment.get("comment_id")
        post_id = comment.get("post_id")

        if not sender_id or not text or not comment_id:
            logger.warning("⚠️ Invalid comment skipped")
            return None

        company_id = uuid.UUID(comment["company_id"])
        channel_id = uuid.UUID(comment["channel_id"])

        # ========================
        # DUPLICATE CHECK
        # ========================
        existing = (
            db.query(Message)
            .filter(
                Message.external_message_id == comment_id,
                Message.company_id == company_id,
            )
            .first()
        )
        if existing:
            return existing

        # ========================
        # CONTACT
        # ========================
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
        else:
            contact = identity.contact

        if not contact:
            logger.error("Contact not found after identity resolution")
            return None

        # fallback name
        if not contact.display_name:
            contact.display_name = f"User {sender_id[-6:]}"

        # refresh FB info
        page = db.query(FacebookPage).filter_by(channel_id=channel_id).first()
        access_token = page.access_token if page else None

        contact = ensure_contact_info(
            contact=contact,
            sender_id=sender_id,
            page_access_token=access_token,
            db=db
        )

        # ========================
        # CONVERSATION
        # ========================
        conversation = (
            db.query(Conversation)
            .filter_by(
                company_id=company_id,
                channel_id=channel_id,
                contact_id=contact.id
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
                page_id=comment.get("page_id"),
                post_id=post_id
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # 🔥 FIX QUAN TRỌNG: update post_id nếu chưa có
        if post_id and not conversation.post_id:
            conversation.post_id = post_id
            db.commit()

        # ========================
        # MESSAGE (COMMENT)
        # ========================
        msg = Message(
            id=uuid.uuid4(),
            company_id=company_id,
            channel_id=channel_id,
            contact_id=contact.id,
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            kind=MessageKind.COMMENT,
            text=text,
            external_message_id=comment_id,

            # 🔥 FIX: lưu post_id vào message luôn
            post_id=post_id
        )

        db.add(msg)
        db.commit()
        db.refresh(msg)

        logger.info(f"💾 Saved comment: {msg.id}")

        # ========================
        # QUEUE AI
        # ========================
        message_queue.enqueue(
            process_incoming_message,
            str(msg.id),
            job_timeout=60
        )

        return msg

    except Exception as e:
        db.rollback()
        logger.error(f"❌ error: {e}")
        return None