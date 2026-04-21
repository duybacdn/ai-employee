from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import AnswerCandidate, Message, User
from app.models.enums import CandidateStatus, MessageDirection
from app.services.knowledge_sync_service import sync_create_knowledge
from app.models.core import KnowledgeItem
from app.schemas.auth import CurrentUser
from app.schemas.candidate import (
    CandidateOut,
    CandidateApproveRequest,
    CandidateActionResponse
)
import uuid

router = APIRouter(prefix="/candidates", tags=["Candidates"])

# =========================
# GET CANDIDATES (SAFE)
# =========================
@router.get("", response_model=list[CandidateOut])
def get_candidates(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),

    company_id: str | None = None,
    channel_id: str | None = None,
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(AnswerCandidate)

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
    # CHANNEL FILTER (NEW)
    # =========================
    if channel_id:
        query = query.join(AnswerCandidate.message).filter(
            Message.channel_id == uuid.UUID(channel_id)
        )

    candidates = query.order_by(AnswerCandidate.created_at.desc()).all()

    return [
        CandidateOut(
            id=str(c.id),
            draft_text=c.draft_text,
            status=c.status.value,
            created_at=c.created_at.isoformat(),
            message_id=str(c.message.id),
            message_text=c.message.text,
        )
        for c in candidates
    ]


# =========================
# APPROVE (SAFE)
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

    # knowledge (company-safe)
    knowledge_item = KnowledgeItem(
        id=uuid.uuid4(),
        title="candidate approval",
        content=body.final_text,
        company_id=candidate.company_id,  # giữ theo record
        employee_id=candidate.employee_id,
        source="candidate",
    )

    outbound = Message(
        company_id=candidate.company_id,
        conversation_id=inbound.conversation_id,
        channel_id=inbound.channel_id,
        contact_id=inbound.contact_id,
        direction=MessageDirection.OUTBOUND,
        kind=inbound.kind,
        text=body.final_text,
        employee_id=candidate.employee_id
    )

    db.add(knowledge_item)
    db.add(outbound)
    db.commit()
    db.refresh(knowledge_item)

    try:
        sync_create_knowledge(knowledge_item)
    except Exception as e:
        print("❌ Qdrant sync failed:", e)

    return CandidateActionResponse(
        success=True,
        knowledge_id=str(knowledge_item.id)
    )


# =========================
# REJECT (SAFE)
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