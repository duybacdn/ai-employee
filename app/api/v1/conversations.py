from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Conversation, Message, Channel, Contact
from app.schemas.auth import CurrentUser

router = APIRouter()


@router.get("/conversations")
def get_conversations(
    channel_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):

    is_superadmin = current_user.role == "superadmin"

    query = (
        db.query(Conversation)
        .join(Channel)
        .options(joinedload(Conversation.channel))
        .filter(Channel.is_active == True)
    )

    if not is_superadmin:
        query = query.filter(
            Conversation.company_id == uuid.UUID(current_user.company_id)
        )

    if channel_id:
        query = query.filter(Conversation.channel_id == uuid.UUID(channel_id))

    conversations = query.all()

    if not conversations:
        return []

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

    result = []

    for c in conversations:
        last_msg = last_message_map.get(c.id)

        # 👤 lấy tên khách
        contact_map = {
            c.id: c.display_name
            for c in db.query(Contact)
            .filter(Contact.id.in_([c.contact_id for c in conversations if c.contact_id]))
            .all()
        }
        customer_name = contact_map.get(c.contact_id) or "Khách"

        is_comment = last_msg and last_msg.kind == "comment"

        result.append({
            "id": str(c.id),
            "last_message": last_msg.text if last_msg else "",
            "updated_at": (
                last_msg.created_at.isoformat()
                if last_msg else c.created_at.isoformat()
            ),

            # 🔥 QUAN TRỌNG
            "customer_name": customer_name,
            "kind": "comment" if is_comment else "inbox",
            "post_id": c.post_id,
        })

    result.sort(key=lambda x: x["updated_at"], reverse=True)

    return result

from pydantic import BaseModel

class ContactUpdateRequest(BaseModel):
    display_name: str


@router.patch("/contacts/{contact_id}")
def update_contact(
    contact_id: str,
    payload: ContactUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        contact = (
            db.query(Contact)
            .filter(Contact.id == uuid.UUID(contact_id))
            .first()
        )

        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")

        # 🔥 update name
        contact.display_name = payload.display_name

        db.commit()
        db.refresh(contact)

        return {
            "id": str(contact.id),
            "display_name": contact.display_name
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))