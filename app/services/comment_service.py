import uuid
from sqlalchemy.orm import Session

from app.models.core import (
    Message, Conversation, Contact, ContactIdentity
)
from app.models.enums import (
    Platform, ConversationStatus, MessageDirection, MessageKind
)
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message
from app.models.core import FacebookPage
from app.services.message_service import ensure_contact_info


def handle_incoming_comment(db: Session, comment: dict):
    try:
        sender_id = comment.get("sender_id")
        text = comment.get("text")
        comment_id = comment.get("comment_id")
        post_id = comment.get("post_id")

        if not sender_id or not text or not comment_id or not post_id:
            print(f"⚠️ Invalid comment skipped")
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

        if not contact.display_name:
            contact.display_name = f"User {sender_id[-6:]}"
        page = db.query(FacebookPage).filter_by(channel_id=channel_id).first()

        access_token = page.access_token if page else None

        contact = ensure_contact_info(
            contact=contact,
            sender_id=sender_id,
            page_access_token=access_token,
            db=db
        )
        # ========================
        # CONVERSATION (🔥 fix chuẩn)
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

        # ========================
        # MESSAGE
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
        )

        db.add(msg)
        db.commit()
        db.refresh(msg)

        print(f"💾 Saved message: {msg.id}")

        # ========================
        # QUEUE
        # ========================
        message_queue.enqueue(
            process_incoming_message,
            str(msg.id),
            job_timeout=60
        )

        print(f"📤 queued: {msg.id}")

        return msg  # 🔥 BẮT BUỘC

    except Exception as e:
        db.rollback()
        print(f"❌ error: {e}")
        return None