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
from sqlalchemy.exc import IntegrityError
from app.services.facebook_service import fetch_facebook_post_content


logger = logging.getLogger(__name__)


def handle_incoming_comment(db: Session, comment: dict):
    try:
        sender_id = comment.get("sender_id")
        text = comment.get("text")
        comment_id = comment.get("comment_id")
        post_id = comment.get("post_id")
        page_id = comment.get("page_id")

        # ========================
        # FIX post_id từ parent
        # ========================
        if not post_id:
            parent_id = comment.get("parent_id")
            if parent_id and "_" in parent_id:
                post_id = parent_id.split("_")[0]

        if not sender_id or not text or not comment_id or not post_id:
            logger.warning("⚠️ invalid comment")
            return None

        company_id = uuid.UUID(comment["company_id"])
        channel_id = uuid.UUID(comment["channel_id"])

        # ========================
        # POST CONTENT (🔥 ADD NEW)
        # ========================
        post_content = None

        # =========================
        # 🔥 CHECK CONVERSATION CŨ
        # =========================
        existing_convo = db.query(Conversation).filter(
            Conversation.company_id == company_id,
            Conversation.channel_id == channel_id,
            Conversation.post_id == post_id
        ).first()

        if (
            existing_convo
            and existing_convo.post_context
            and existing_convo.post_context.strip()
            and existing_convo.post_context != "[Bài viết Facebook]"
        ):
            # ✅ đã có context thật → dùng luôn
            post_content = existing_convo.post_context

        else:
            # =========================
            # 🔥 FETCH TỪ FACEBOOK
            # =========================
            try:
                post_content = fetch_facebook_post_content(
                    db,
                    channel_id,
                    post_id
                )
            except Exception as e:
                logger.warning(f"⚠️ cannot fetch post content: {e}")
                post_content = None


        # =========================
        # 🔥 FALLBACK (RẤT QUAN TRỌNG)
        # =========================
        if not post_content:
            post_content = f"Khách đang bình luận: {text}"

        # ========================
        # DUPLICATE
        # ========================
        existing = db.query(Message).filter(
            Message.external_message_id == comment_id,
            Message.company_id == company_id,
        ).first()

        if existing:
            return existing

        # ========================
        # CONTACT UPSERT
        # ========================
        identity = db.query(ContactIdentity).filter_by(
            company_id=company_id,
            platform=Platform.FACEBOOK,
            external_user_id=sender_id,
        ).first()

        if not identity:
            contact = Contact(id=uuid.uuid4(), company_id=company_id)
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
            logger.error("❌ contact None")
            return None

        # ========================
        # CONVERSATION (1 POST = 1 CONVERSATION)
        # ========================
        conversation = None

        for _ in range(2):
            conversation = db.query(Conversation).filter(
                Conversation.company_id == company_id,
                Conversation.channel_id == channel_id,
                Conversation.post_id == post_id
            ).first()

            if conversation:
                break

            try:
                conversation = Conversation(
                    id=uuid.uuid4(),
                    company_id=company_id,
                    channel_id=channel_id,
                    contact_id=None,
                    post_id=post_id,
                    page_id=page_id,
                    post_content=post_content,   # 🔥 IMPORTANT ADD
                    status=ConversationStatus.OPEN,
                )
                db.add(conversation)
                db.commit()
                db.refresh(conversation)
                break

            except IntegrityError:
                db.rollback()

        # fallback
        if not conversation:
            conversation = db.query(Conversation).filter(
                Conversation.company_id == company_id,
                Conversation.channel_id == channel_id,
                Conversation.post_id == post_id
            ).first()

        # 🔥 update nếu thiếu post_context
        if conversation and (
            not conversation.post_context
            or conversation.post_context == "[Bài viết Facebook]"
        ):
            conversation.post_context = post_content
            db.add(conversation)
            db.commit()

        if not conversation:
            logger.error("❌ Conversation still None (comment)")
            return None

        # ========================
        # SAVE MESSAGE
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

        # ========================
        # AI QUEUE
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