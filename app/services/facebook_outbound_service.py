import uuid
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.core import Message, Conversation, ContactIdentity, AnswerCandidate
from app.models.enums import MessageDirection, MessageKind, Platform, CandidateStatus


logger = logging.getLogger(__name__)


def _duplicate_message(db: Session, company_id, external_id: str | None):
    if not external_id:
        return None

    return (
        db.query(Message)
        .filter(
            Message.company_id == company_id,
            Message.external_message_id == external_id,
        )
        .first()
    )


def _latest_unanswered_inbound(db: Session, conversation_id, kind: MessageKind):
    inbound_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.kind == kind,
            Message.direction == MessageDirection.INBOUND,
        )
        .order_by(Message.created_at.desc())
        .limit(20)
        .all()
    )

    for inbound in inbound_messages:
        has_reply = (
            db.query(Message.id)
            .filter(
                Message.reply_to_message_id == inbound.id,
                Message.direction == MessageDirection.OUTBOUND,
            )
            .first()
        )
        if not has_reply:
            return inbound

    return inbound_messages[0] if inbound_messages else None


def _reject_pending_candidates(db: Session, inbound: Message | None):
    if not inbound:
        return

    (
        db.query(AnswerCandidate)
        .filter(
            AnswerCandidate.message_id == inbound.id,
            AnswerCandidate.status == CandidateStatus.PENDING,
        )
        .update({AnswerCandidate.status: CandidateStatus.REJECTED})
    )


def handle_outbound_message_echo(db: Session, event: dict):
    try:
        company_id = uuid.UUID(event["company_id"])
        channel_id = uuid.UUID(event["channel_id"])
        external_id = event.get("mid")
        recipient_id = event.get("recipient_id")

        existing = _duplicate_message(db, company_id, external_id)
        if existing:
            return existing

        if not recipient_id:
            logger.warning("Missing echo recipient_id")
            return None

        identity = (
            db.query(ContactIdentity)
            .filter_by(
                company_id=company_id,
                platform=Platform.FACEBOOK,
                external_user_id=recipient_id,
            )
            .first()
        )

        if not identity:
            logger.warning("No contact identity for echo recipient_id=%s", recipient_id)
            return None

        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.company_id == company_id,
                Conversation.channel_id == channel_id,
                Conversation.contact_id == identity.contact_id,
                Conversation.post_id.is_(None),
            )
            .first()
        )

        if not conversation:
            logger.warning("No inbox conversation for echo recipient_id=%s", recipient_id)
            return None

        inbound = _latest_unanswered_inbound(db, conversation.id, MessageKind.INBOX)

        msg = Message(
            id=uuid.uuid4(),
            company_id=company_id,
            conversation_id=conversation.id,
            channel_id=channel_id,
            contact_id=identity.contact_id,
            direction=MessageDirection.OUTBOUND,
            kind=MessageKind.INBOX,
            text=event.get("text"),
            attachments=event.get("attachments"),
            external_message_id=external_id,
            reply_to_message_id=inbound.id if inbound else None,
            source="manual_facebook",
            external_sender_id=event.get("sender_id"),
            external_recipient_id=recipient_id,
            status="sent",
            sent_at=datetime.utcnow(),
        )

        db.add(msg)
        _reject_pending_candidates(db, inbound)
        conversation.last_message_at = msg.created_at
        db.commit()
        db.refresh(msg)
        return msg

    except Exception as e:
        db.rollback()
        logger.error("Outbound message echo error: %s", e)
        return None


def handle_outbound_comment_reply(db: Session, event: dict):
    try:
        company_id = uuid.UUID(event["company_id"])
        channel_id = uuid.UUID(event["channel_id"])
        external_id = event.get("comment_id")
        post_id = event.get("post_id")
        parent_id = event.get("parent_id")

        existing = _duplicate_message(db, company_id, external_id)
        if existing:
            return existing

        if not post_id:
            logger.warning("Missing outbound comment post_id")
            return None

        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.company_id == company_id,
                Conversation.channel_id == channel_id,
                Conversation.post_id == post_id,
            )
            .first()
        )

        if not conversation:
            logger.warning("No post conversation for outbound comment post_id=%s", post_id)
            return None

        inbound = None
        if parent_id:
            inbound = (
                db.query(Message)
                .filter(
                    Message.company_id == company_id,
                    Message.channel_id == channel_id,
                    Message.kind == MessageKind.COMMENT,
                    Message.direction == MessageDirection.INBOUND,
                    Message.external_message_id == parent_id,
                )
                .first()
            )

        if not inbound:
            inbound = _latest_unanswered_inbound(db, conversation.id, MessageKind.COMMENT)

        if not inbound:
            logger.warning("No inbound comment to link outbound comment_id=%s", external_id)
            return None

        msg = Message(
            id=uuid.uuid4(),
            company_id=company_id,
            conversation_id=conversation.id,
            channel_id=channel_id,
            contact_id=inbound.contact_id,
            direction=MessageDirection.OUTBOUND,
            kind=MessageKind.COMMENT,
            text=event.get("text"),
            attachments=event.get("attachments"),
            external_message_id=external_id,
            parent_comment_id=parent_id,
            reply_to_message_id=inbound.id,
            source="manual_facebook",
            external_sender_id=event.get("sender_id"),
            external_recipient_id=event.get("recipient_id"),
            status="sent",
            sent_at=datetime.utcnow(),
        )

        db.add(msg)
        _reject_pending_candidates(db, inbound)
        conversation.last_message_at = msg.created_at
        db.commit()
        db.refresh(msg)
        return msg

    except Exception as e:
        db.rollback()
        logger.error("Outbound comment reply error: %s", e)
        return None
