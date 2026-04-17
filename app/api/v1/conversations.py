from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Conversation, Message, Channel
from app.schemas.auth import CurrentUser
from app.schemas.conversation import ConversationOut

router = APIRouter()


@router.get("/conversations", response_model=list[ConversationOut])
def get_conversations(
    channel_id: str | None = Query(default=None, description="Filter by channel"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Lấy danh sách conversations theo company.
    Optional: filter theo channel_id
    Chỉ lấy channel đang active
    """

    # =========================
    # Company hiện tại
    # =========================
    company_uuid = uuid.UUID(current_user.company_id)

    # =========================
    # Lọc conversations theo company + active channel
    # =========================
    query = (
        db.query(Conversation)
        .join(Channel)
        .options(joinedload(Conversation.channel))
        .filter(
            Conversation.company_id == company_uuid,
            Channel.is_active == True
        )
    )

    if channel_id:
        try:
            channel_uuid = uuid.UUID(channel_id)
            query = query.filter(Conversation.channel_id == channel_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid channel_id")

    conversations = query.all()
    if not conversations:
        return []

    # =========================
    # Lấy last message cho mỗi conversation
    # =========================
    conversation_ids = [c.id for c in conversations]

    messages = (
        db.query(Message)
        .filter(Message.conversation_id.in_(conversation_ids))
        .order_by(Message.conversation_id, desc(Message.created_at))
        .all()
    )

    last_message_map = {}
    for m in messages:
        if m.conversation_id not in last_message_map:
            last_message_map[m.conversation_id] = m

    # =========================
    # Build response
    # =========================
    result = []
    for c in conversations:
        last_msg = last_message_map.get(c.id)

        result.append(
            ConversationOut(
                id=str(c.id),
                last_message=last_msg.text if last_msg else "",
                updated_at=(
                    last_msg.created_at.isoformat()
                    if last_msg
                    else c.created_at.isoformat()
                ),
                
            )
        )

    # Sort latest conversation trước
    result.sort(key=lambda x: x.updated_at, reverse=True)

    return result