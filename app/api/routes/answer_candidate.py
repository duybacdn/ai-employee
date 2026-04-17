from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, UTC
from uuid import UUID

from app.db.session import get_db
from app.models.core import AnswerCandidate
from app.models.enums import CandidateStatus
from app.services.candidate_service import create_knowledge_from_candidate

router = APIRouter(prefix="/answer-candidate", tags=["Answer Candidate"])


# ==============================
# GET LIST CANDIDATES
# ==============================
@router.get("")
def list_candidates(
    status: CandidateStatus | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(AnswerCandidate)

    if status:
        query = query.filter(AnswerCandidate.status == status)

    candidates = query.order_by(AnswerCandidate.created_at.desc()).all()

    return candidates


# ==============================
# APPROVE CANDIDATE
# ==============================
from fastapi import Body

@router.post("/{candidate_id}/approve")
def approve_candidate(
    candidate_id: UUID,
    final_text: str | None = Body(default=None),
    db: Session = Depends(get_db),
):
    candidate = db.query(AnswerCandidate).filter(
        AnswerCandidate.id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 🔒 FIX 3: chống approve lại
    if candidate.status == CandidateStatus.APPROVED:
        return {"message": "Already approved"}

    # ✅ xử lý nội dung
    if final_text:
        candidate.final_text = final_text
    else:
        candidate.final_text = candidate.draft_text

    # (optional - sẽ làm ở FIX 4 nhưng có thể thêm luôn)
    if not candidate.final_text:
        raise HTTPException(status_code=400, detail="Candidate has no final_text")

    # ✅ cập nhật trạng thái
    candidate.status = CandidateStatus.APPROVED
    candidate.reviewed_at = datetime.now()

    db.commit()
    db.refresh(candidate)

    # 🚀 P4-05
    create_knowledge_from_candidate(db, candidate)

    return {
        "message": "Candidate approved",
        "candidate_id": str(candidate.id),
    }