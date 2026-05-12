from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user

from app.models.core import (
    AnswerCandidate,
    Message,
    User,
    KnowledgeItem,
    ContactIdentity,
    ChannelEmployee,
    Conversation,
    Contact
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
    is_superadmin = current_user.role == "superadmin"

    query = db.query(AnswerCandidate).join(AnswerCandidate.message)

    # =========================
    # COMPANY FILTER
    # =========================
    if is_superadmin:
        if company_id:
            query = query.filter(
                AnswerCandidate.company_id == uuid.UUID(company_id)
            )
    else:
        query = query.filter(
            AnswerCandidate.company_id == uuid.UUID(current_user.company_id)
        )

    # =========================
    # CHANNEL FILTER
    # =========================
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

    # =========================
    # LOAD RELATED DATA
    # =========================

    conversation_ids = list({
        c.message.conversation_id for c in candidates
    })

    contact_ids = list({
        c.message.contact_id for c in candidates if c.message.contact_id
    })

    # ===== LOAD MESSAGES =====
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

    # ===== LOAD CONTACT =====
    contact_map = {}
    if contact_ids:
        contacts = (
            db.query(Contact)
            .filter(Contact.id.in_(contact_ids))
            .all()
        )
        contact_map = {c.id: c.display_name for c in contacts}

    # =========================
    # BUILD RESPONSE
    # =========================
    result = []

    for c in candidates:
        conv = c.message.conversation

        result.append({
            "id": str(c.id),

            "draft_text": c.draft_text,
            "status": c.status.value,
            "created_at": c.created_at.isoformat(),

            "message_id": str(c.message.id),
            "message_text": c.message.text,
            "kind": (
                "comment"
                if c.message.kind == MessageKind.COMMENT
                else "inbox"
            ),

            # =========================
            # 🔥 NEW DATA FOR UI
            # =========================
            "conversation_id": str(c.message.conversation_id),
            "customer_name": contact_map.get(
                c.message.contact_id, "Khách"
            ),

            "messages": msg_map.get(
                c.message.conversation_id, []
            ),

            "post_context": (
                (conv.post_context or "").strip()
                if conv else ""
            ),

            # =========================
            # OLD DATA (KEEP)
            # =========================
            "is_sent": c.is_sent,
            "sent_at": (
                c.sent_at.isoformat() if c.sent_at else None
            ),
        })

    return result


# =========================
# APPROVE (KEEP LOGIC)
# =========================
@router.post("/{candidate_id}/approve", response_model=CandidateActionResponse)
def approve_candidate(
    candidate_id: str,
    body: CandidateApproveRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(AnswerCandidate).filter(
        AnswerCandidate.id == uuid.UUID(candidate_id),
    )

    if not is_superadmin:
        query = query.filter(
            AnswerCandidate.company_id == uuid.UUID(current_user.company_id)
        )

    candidate = query.first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != CandidateStatus.PENDING:
        raise HTTPException(status_code=400, detail="Already processed")

    inbound = candidate.message

    candidate.final_text = body.final_text
    candidate.status = CandidateStatus.APPROVED
    candidate.reviewed_by_user_id = uuid.UUID(current_user.id)
    candidate.reviewed_at = datetime.utcnow()

    # =========================
    # KNOWLEDGE
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
    # OUTBOUND MESSAGE
    # =========================
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
    db.flush()

    # =========================
    # SEND
    # =========================
    try:
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
                        text=body.final_text,
                    )
                else:
                    send_message(
                        db,
                        inbound.channel_id,
                        psid,
                        body.final_text
                    )

                outbound.status = "sent"
                outbound.sent_at = datetime.utcnow()

                candidate.is_sent = True
                candidate.sent_at = datetime.utcnow()

            else:
                raise Exception("No identity found")

    except Exception as e:
        print("❌ SEND FAILED:", e)

        outbound.status = "failed"
        candidate.is_sent = False

    db.commit()

    try:
        sync_create_knowledge(knowledge_item)
    except Exception as e:
        print("❌ Qdrant sync failed:", e)

    return CandidateActionResponse(
        success=True,
        knowledge_id=str(knowledge_item.id)
    )


# =========================
# REJECT (KEEP)
# =========================
@router.post("/{candidate_id}/reject", response_model=CandidateActionResponse)
def reject_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(AnswerCandidate).filter(
        AnswerCandidate.id == uuid.UUID(candidate_id),
    )

    if not is_superadmin:
        query = query.filter(
            AnswerCandidate.company_id == uuid.UUID(current_user.company_id)
        )

    candidate = query.first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != CandidateStatus.PENDING:
        raise HTTPException(status_code=400, detail="Already processed")

    candidate.status = CandidateStatus.REJECTED
    db.commit()

    return CandidateActionResponse(success=True)


def clean_text(t):
    return (t or "").strip()