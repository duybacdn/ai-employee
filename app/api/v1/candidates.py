from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user

from app.models.core import (
    AnswerCandidate,
    Message,
    KnowledgeItem,
    ContactIdentity,
    ChannelEmployee,
    Contact,
    Company
)

from app.models.enums import (
    CandidateStatus,
    MessageDirection,
    Platform,
    AutoReplyMode,
    MessageKind
)

from app.services.knowledge_sync_service import sync_create_knowledge
from app.services.facebook_service import send_message, reply_comment

from app.schemas.auth import CurrentUser
from app.schemas.candidate import (
    CandidateApproveRequest,
    CandidateActionResponse
)
from sqlalchemy.orm import joinedload
from app.core.permission import require_channel_access

router = APIRouter(prefix="/candidates", tags=["Candidates"])


# =========================
# GET CANDIDATES (ENHANCED)
# =========================
@router.get("")
def get_candidates(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),

    company_id: str | None = None,
    channel_id: str | None = None,
    status: str | None = None,
):
    query = (
        db.query(AnswerCandidate)
        .join(AnswerCandidate.message)
        .join(Company, AnswerCandidate.company_id == Company.id)
        .options(
            joinedload(AnswerCandidate.message).joinedload(Message.conversation)
        )
        .filter(Company.status == "active")
    )

    # =========================
    # SUPERADMIN
    # =========================
    if current_user.role == "superadmin":
        if company_id:
            query = query.filter(
                AnswerCandidate.company_id == uuid.UUID(company_id)
            )

    # =========================
    # ADMIN
    # =========================
    elif current_user.role == "admin":
        if company_id:
            query = query.filter(
                AnswerCandidate.company_id == uuid.UUID(company_id)
            )
        else:
            query = query.filter(
                AnswerCandidate.company_id.in_(
                    [uuid.UUID(cid) for cid in current_user.company_ids]
                )
            )

    # =========================
    # STAFF (permission-based)
    # =========================
    else:
        if not current_user.company_ids:
            return []

        query = query.filter(
            AnswerCandidate.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

        from app.models.core import UserAssignment

        # 🔥 FIX: luôn filter theo channel được gán
        allowed_channels = db.query(UserAssignment.channel_id).filter(
            UserAssignment.user_id == uuid.UUID(current_user.id),
            UserAssignment.channel_id.isnot(None)
        ).all()

        allowed_channel_ids = [c[0] for c in allowed_channels]

        if not allowed_channel_ids:
            return []

        query = query.filter(
            Message.channel_id.in_(allowed_channel_ids)
        )

        if channel_id:
            require_channel_access(db, current_user, channel_id)

            query = query.filter(
                Message.channel_id == uuid.UUID(channel_id)
            )

    # =========================
    # CHANNEL FILTER (GLOBAL CHECK)
    # =========================
    if channel_id and current_user.role == "staff":
        require_channel_access(db, current_user, channel_id)

    if channel_id:
        query = query.filter(
            Message.channel_id == uuid.UUID(channel_id)
        )

    if status:
        query = query.filter(AnswerCandidate.status == status)

    candidates = query.order_by(
        AnswerCandidate.created_at.desc()
    ).all()

    if not candidates:
        return []

    conversation_ids = list({
        c.message.conversation_id for c in candidates
    })

    contact_ids = list({
        c.message.contact_id for c in candidates if c.message.contact_id
    })

    messages = (
        db.query(Message)
        .filter(Message.conversation_id.in_(conversation_ids))
        .order_by(Message.created_at.asc())
        .all()
    )

    msg_map = {}
    for m in messages:
        msg_map.setdefault(m.conversation_id, []).append({
            "id": str(m.id),
            "text": m.text,
            "direction": (
                m.direction.value if hasattr(m.direction, "value") else m.direction
            ),
            "kind": (
                "comment" if m.kind == MessageKind.COMMENT else "inbox"
            ),
            "created_at": m.created_at.isoformat(),
        })

    contact_map = {}
    if contact_ids:
        contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
        contact_map = {c.id: c.display_name for c in contacts}

    threads: dict[str, dict] = {}

    for c in candidates:
        msg = c.message
        conv = msg.conversation
        conversation_id = str(msg.conversation_id)

        if conversation_id not in threads:
            threads[conversation_id] = {
                "id": str(c.id),
                "draft_text": c.draft_text,
                "status": c.status.value,
                "created_at": c.created_at.isoformat(),

                "message_id": str(msg.id),
                "message_text": msg.text,
                "kind": "comment" if msg.kind == MessageKind.COMMENT else "inbox",

                "conversation_id": conversation_id,
                "customer_name": contact_map.get(msg.contact_id, "Khách"),
                "messages": msg_map.get(msg.conversation_id, []),

                "post_context": (
                    (conv.post_context or "").strip()
                    if conv else ""
                ),

                "is_sent": c.is_sent,
                "sent_at": c.sent_at.isoformat() if c.sent_at else None,

                "candidate_count": 0,
                "pending_count": 0,
                "approved_count": 0,
                "rejected_count": 0,
            }

        thread = threads[conversation_id]
        thread["candidate_count"] += 1

        if c.status == CandidateStatus.PENDING:
            thread["pending_count"] += 1
        elif c.status == CandidateStatus.APPROVED:
            thread["approved_count"] += 1
        elif c.status == CandidateStatus.REJECTED:
            thread["rejected_count"] += 1

    result = sorted(
        threads.values(),
        key=lambda x: x["created_at"],
        reverse=True
    )

    return result


# =========================
# APPROVE
# =========================
@router.post("/{candidate_id}/approve", response_model=CandidateActionResponse)
def approve_candidate(
    candidate_id: str,
    body: CandidateApproveRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    # =========================
    # LOAD CANDIDATE
    # =========================
    candidate = (
        db.query(AnswerCandidate)
        .join(Company, AnswerCandidate.company_id == Company.id)
        .filter(
            AnswerCandidate.id == uuid.UUID(candidate_id),
            Company.status == "active"
        )
        .first()
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if current_user.role == "staff":
        require_channel_access(db, current_user, str(candidate.message.channel_id))

    if candidate.status != CandidateStatus.PENDING:
        raise HTTPException(status_code=400, detail="Already processed")

    inbound = candidate.message

    # =========================
    # UPDATE CANDIDATE
    # =========================
    candidate.final_text = body.final_text
    candidate.status = CandidateStatus.APPROVED
    candidate.reviewed_by_user_id = uuid.UUID(current_user.id)
    candidate.reviewed_at = datetime.utcnow()

    # =========================
    # CREATE KNOWLEDGE
    # =========================
    prefix = "Comment khách" if inbound.kind == MessageKind.COMMENT else "Tin nhắn khách"

    knowledge_content = f"""
{prefix}:
{clean_text(inbound.text)}

Câu trả lời:
{clean_text(body.final_text)}
"""

    knowledge_item = KnowledgeItem(
        id=uuid.uuid4(),
        title=clean_text(inbound.text)[:200],
        content=knowledge_content.strip(),
        company_id=candidate.company_id,
        employee_id=candidate.employee_id,
        source="candidate",
    )

    db.add(knowledge_item)

    # =========================
    # DEFAULT STATUS
    # =========================
    candidate.is_sent = False
    candidate.sent_at = None

    outbound_id = None

    # =========================
    # CREATE OUTBOUND (IF SEND NOW)
    # =========================
    if body.send_now:
        outbound = Message(
            company_id=candidate.company_id,
            conversation_id=inbound.conversation_id,
            channel_id=inbound.channel_id,
            contact_id=inbound.contact_id,
            direction=MessageDirection.OUTBOUND,
            kind=inbound.kind,
            text=body.final_text,
            employee_id=candidate.employee_id,
            status="pending"
        )

        db.add(outbound)
        db.flush()  # lấy id

        outbound_id = outbound.id

    # =========================
    # COMMIT NGAY (QUAN TRỌNG)
    # =========================
    db.commit()

    # =========================
    # BACKGROUND TASKS
    # =========================
    from app.core.database import SessionLocal

    # 👉 gửi message async
    if body.send_now and outbound_id:
        background_tasks.add_task(
            process_send_message,
            SessionLocal,
            inbound.id,
            candidate.id,
            outbound_id,
            body.final_text
        )

    # 👉 sync knowledge async
    background_tasks.add_task(
        sync_create_knowledge,
        knowledge_item
    )

    # =========================
    # RESPONSE
    # =========================
    return CandidateActionResponse(
        success=True,
        knowledge_id=str(knowledge_item.id)
    )

def process_send_message(
    db_session_maker,
    inbound_id,
    candidate_id,
    outbound_id,
    final_text
):
    db = db_session_maker()

    try:
        inbound = db.query(Message).get(inbound_id)
        candidate = db.query(AnswerCandidate).get(candidate_id)
        outbound = db.query(Message).get(outbound_id)

        if not inbound or not candidate or not outbound:
            return

        mapping = (
            db.query(ChannelEmployee)
            .filter(ChannelEmployee.channel_id == inbound.channel_id)
            .order_by(ChannelEmployee.priority.asc())
            .first()
        )

        if mapping and mapping.autoreply_mode == AutoReplyMode.REVIEW:
            identity = (
                db.query(ContactIdentity)
                .filter_by(
                    contact_id=inbound.contact_id,
                    platform=Platform.FACEBOOK,
                    company_id=candidate.company_id
                )
                .first()
            )

            if identity:
                psid = identity.external_user_id

                if inbound.kind == MessageKind.COMMENT:
                    reply_comment(
                        db=db,
                        channel_id=inbound.channel_id,
                        comment_id=inbound.external_message_id,
                        text=final_text,
                    )
                else:
                    send_message(
                        db,
                        inbound.channel_id,
                        psid,
                        text=outbound.text,
                        attachments=outbound.attachments
                    )

                outbound.status = "sent"
                outbound.sent_at = datetime.utcnow()

                candidate.is_sent = True
                candidate.sent_at = datetime.utcnow()

        db.commit()

    except Exception as e:
        print("SEND FAILED:", e)
        db.rollback()

    finally:
        db.close()


# =========================
# REJECT
# =========================
@router.post("/{candidate_id}/reject", response_model=CandidateActionResponse)
def reject_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    candidate = db.query(AnswerCandidate)\
        .join(Company, AnswerCandidate.company_id == Company.id)\
        .filter(
            AnswerCandidate.id == uuid.UUID(candidate_id),
            Company.status == "active"
        ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if current_user.role == "staff":
        require_channel_access(db, current_user, str(candidate.message.channel_id))

    if candidate.status != CandidateStatus.PENDING:
        raise HTTPException(status_code=400, detail="Already processed")

    candidate.status = CandidateStatus.REJECTED
    db.commit()

    return CandidateActionResponse(success=True)


def clean_text(t):
    return (t or "").strip()