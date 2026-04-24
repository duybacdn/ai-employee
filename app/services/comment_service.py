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


def handle_incoming_comment(db: Session, comment: dict):

    try:
        # ========================
        # 0. VALIDATE
        # ========================
        sender_id = comment.get("sender_id")
        text = comment.get("text")
        comment_id = comment.get("comment_id")
        post_id = comment.get("post_id")

        if not sender_id or not text or not comment_id or not post_id:
            print(f"⚠️ Invalid comment skipped")
            return

        company_id = uuid.UUID(comment["company_id"])
        channel_id = uuid.UUID(comment["channel_id"])

        # ========================
        # THREAD ROOT
        # ========================
        parent_id = comment.get("parent_id")
        root_comment_id = parent_id or comment_id

        print(f"[THREAD] root_comment_id: {root_comment_id}")

        # ========================
        # 1. CONTACT UPSERT
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
        # 2. CONVERSATION FIX (IMPORTANT)
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
                post_id=post_id,
                root_comment_id=root_comment_id
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        else:
            # update root_comment_id nếu chưa có
            if not getattr(conversation, "root_comment_id", None):
                conversation.root_comment_id = root_comment_id
                db.commit()

        # ========================
        # 3. MESSAGE CREATE
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
        # 4. QUEUE
        # ========================
        message_queue.enqueue(
            process_incoming_message,
            str(msg.id),
            job_timeout=60
        )

        print(f"📤 queued: {msg.id}")

        return msg

    except Exception as e:
        db.rollback()
        print(f"❌ error: {e}")