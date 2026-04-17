from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Message, Conversation, Channel
from app.models.enums import MessageDirection
from app.schemas.auth import CurrentUser
from app.schemas.message import MessageOut

router = APIRouter()


@router.get("/messages", response_model=list[MessageOut])
def get_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Lấy tất cả message theo conversation
    - Chỉ conversation thuộc company của user
    - Chỉ lấy message nếu channel liên kết đang active
    """
    company_uuid = uuid.UUID(current_user.company_id)
    try:
        conversation_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation_id")

    # =========================
    # CHECK conversation + channel active
    # =========================
    conversation = (
        db.query(Conversation)
        .join(Channel)
        .filter(
            Conversation.id == conversation_uuid,
            Conversation.company_id == company_uuid,
            Channel.is_active == True
        )
        .first()
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found or channel disabled")

    # =========================
    # GET messages
    # =========================
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_uuid)
        .order_by(Message.created_at)
        .all()
    )

    # =========================
    # BUILD response
    # =========================
    result = []
    for m in messages:
        direction = m.direction.value if hasattr(m.direction, "value") else m.direction

        result.append(
            MessageOut(
                id=str(m.id),
                text=m.text,
                direction=direction,

                # legacy UI
                content=m.text,
                role="user" if m.direction == MessageDirection.INBOUND else "assistant",
                created_at=m.created_at.isoformat(),
            )
        )

    return result