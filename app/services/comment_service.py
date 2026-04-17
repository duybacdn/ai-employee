import uuid
from sqlalchemy.orm import Session
from app.models.core import (
    Message, Conversation, Contact, ContactIdentity, FacebookPage
)
from app.models.enums import Platform, ConversationStatus, MessageDirection, MessageKind
from app.services.queue import message_queue
from app.workers.message_worker import process_incoming_message
from sqlalchemy.exc import IntegrityError

def handle_incoming_comment(db: Session, comment: dict):
    """
    Xử lý comment từ Facebook
    """

    sender_id = comment.get("sender_id")
    text = comment.get("text")
    comment_id = comment.get("comment_id")
    post_id = comment.get("post_id")

    is_comment = comment.get("type") == "comment"

    if not sender_id or not text or not comment_id or not post_id:
        print(f"⚠️ Invalid comment skipped: {comment}")
        return

    try:
        company_id = uuid.UUID(comment["company_id"])
        channel_id = uuid.UUID(comment["channel_id"])

        # ========================
        # 1️⃣ Tìm / tạo Contact
        # ========================
        identity = (
            db.query(ContactIdentity)
            .filter_by(
                company_id=company_id,  # 🔥 thiếu cái này trước đó
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

        # ========================
        # 2️⃣ Conversation theo post_id
        # ========================

        conversation = None  # 🔥 FIX CỨNG

        # 🔥 vì đây là comment → luôn xử lý theo post
        conversation = (
            db.query(Conversation)
            .filter_by(
                company_id=company_id,
                channel_id=channel_id,
                post_id=post_id,
            )
            .first()
        )

        # 🔥 nếu chưa có thì tạo
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
        # 3️⃣ Lưu Message
        # ========================
        from app.models.core import Message

        existing = (
            db.query(Message)
            .filter(Message.external_message_id == comment_id)
            .first()
        )
        if existing:
            print(f"⚠️ Duplicate comment skipped: {comment_id}")
            return existing

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
        # 4️⃣ Push queue
        # ========================
        message_queue.enqueue(
            process_incoming_message,
            str(msg.id),
            job_timeout=None
        )

        print(f"📤 Pushed comment {msg.id} to Redis queue")

    except Exception as e:
        db.rollback()
        print(f"❌ Error processing comment {comment}: {e}")