import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.core import (
    Message, Conversation, Contact, ContactIdentity
)
from app.models.enums import (
    Platform, ConversationStatus, MessageDirection, MessageKind
)
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message


def handle_incoming_comment(db: Session, comment: dict):
    """
    Xử lý comment từ Facebook (SAFE MULTI-TENANT)
    """

    try:
        # ========================
        # 0. VALIDATE INPUT
        # ========================
        sender_id = comment.get("sender_id")
        text = comment.get("text")
        comment_id = comment.get("comment_id")
        post_id = comment.get("post_id")

        if not sender_id or not text or not comment_id or not post_id:
            print(f"⚠️ Invalid comment skipped: {comment}")
            return

        if not comment.get("company_id") or not comment.get("channel_id"):
            print(f"❌ Missing tenant context: {comment}")
            return

        company_id = uuid.UUID(comment["company_id"])
        channel_id = uuid.UUID(comment["channel_id"])

        # ========================
        # 1. DUPLICATE CHECK (EARLY EXIT)
        # ========================
        existing = (
            db.query(Message)
            .filter(
                Message.external_message_id == comment_id,
                Message.company_id == company_id
            )
            .first()
        )
        if existing:
            print(f"⚠️ Duplicate comment skipped: {comment_id}")
            return existing

        # ========================
        # 2. FIND / CREATE CONTACT
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

        contact = identity.contact

        # ========================
        # 3. FIND / CREATE CONVERSATION (BY POST)
        # ========================
        conversation = (
            db.query(Conversation)
            .filter_by(
                company_id=company_id,
                channel_id=channel_id,
                post_id=post_id,
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
                post_id=post_id,
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # ========================
        # 4. CREATE MESSAGE
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

        print(f"💾 Saved comment ID: {msg.id}")

        # ========================
        # 5. PUSH TO QUEUE
        # ========================
        if message_queue:
            print("🚀 Enqueue job:", msg.id)
            message_queue.enqueue(
                process_incoming_message,
                str(msg.id),
                job_timeout=60
            )
        else:
            # 🔥 fallback chạy trực tiếp (DEV mode)
            process_incoming_message(str(msg.id))

        print(f"📤 Pushed comment {msg.id} to queue")

        return msg

    except Exception as e:
        db.rollback()
        print(f"❌ Error processing comment {comment}: {e}")