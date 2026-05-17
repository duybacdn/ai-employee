from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
import uuid
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Conversation, Message, Channel, Contact
from app.schemas.auth import CurrentUser
from app.models.enums import MessageKind

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

    # =========================
    # LOAD CONTACTS
    # =========================
    contact_ids = [c.contact_id for c in conversations if c.contact_id]

    contact_map = {}
    if contact_ids:
        contacts = (
            db.query(Contact)
            .filter(Contact.id.in_(contact_ids))
            .all()
        )
        contact_map = {ct.id: ct.display_name for ct in contacts}

    # =========================
    # LOAD MESSAGES
    # =========================
    subquery = (
        db.query(
            Message.conversation_id,
            func.max(Message.created_at).label("max_time")
        )
        .filter(Message.conversation_id.in_(conversation_ids))
        .group_by(Message.conversation_id)
        .subquery()
    )

    messages = (
        db.query(Message)
        .join(
            subquery,
            (Message.conversation_id == subquery.c.conversation_id) &
            (Message.created_at == subquery.c.max_time)
        )
        .all()
    )

    # =========================
    # SPLIT INBOX / COMMENT
    # =========================
    inbox_map = {}
    comment_map = {}

    for m in messages:
        if m.kind == MessageKind.COMMENT:
            if m.conversation_id not in comment_map:
                comment_map[m.conversation_id] = m
        else:
            if m.conversation_id not in inbox_map:
                inbox_map[m.conversation_id] = m

    # =========================
    # BUILD RESULT
    # =========================
    result = []

    for conv in conversations:
        inbox_msg = inbox_map.get(conv.id)
        comment_msg = comment_map.get(conv.id)

        # chọn message mới nhất
        if inbox_msg and comment_msg:
            last_msg = (
                inbox_msg if inbox_msg.created_at > comment_msg.created_at
                else comment_msg
            )
        else:
            last_msg = inbox_msg or comment_msg

        customer_name = contact_map.get(conv.contact_id) or "Khách"

        # 🔥 FIX: luôn xác định theo bản chất conversation
        if inbox_msg and comment_msg:
            kind = "inbox" if inbox_msg.created_at > comment_msg.created_at else "comment"
        elif inbox_msg:
            kind = "inbox"
        elif comment_msg:
            kind = "comment"
        else:
            kind = "inbox"

        

        # 🔥 FIX: tránh None
        post_context = (conv.post_context or "").strip()

        # =========================
        # BUILD MESSAGE LIST
        # =========================
        conv_messages = [
            {
                "id": str(m.id),
                "text": m.text,
                "direction": m.direction.value if hasattr(m.direction, "value") else m.direction,
                "kind": "comment" if m.kind == MessageKind.COMMENT else "inbox",
                "created_at": m.created_at.isoformat(),
                "external_id": m.external_message_id,
                "parent_id": getattr(m, "parent_comment_id", None),
                "employee_name": "AI" if m.direction != "inbound" else "Khách"
            }
            for m in messages if m.conversation_id == conv.id
        ]

        result.append({
            "id": str(conv.id),
            "contact_id": str(conv.contact_id) if conv.contact_id else None,
            "channel_id": str(conv.channel_id),

            "last_message": last_msg.text if last_msg else "",
            "last_inbox_message": inbox_msg.text if inbox_msg else "",
            "last_comment_message": comment_msg.text if comment_msg else "",

            "updated_at": (
                last_msg.created_at.isoformat()
                if last_msg else conv.created_at.isoformat()
            ),

            "customer_name": customer_name,
            "kind": kind,
            "post_id": conv.post_id,

            # 🔥 QUAN TRỌNG
            "post_context": post_context,

            # 🔥 ADD THIS
            "messages": conv_messages,
        })

    result.sort(key=lambda x: x["updated_at"], reverse=True)

    return result


# =========================
# UPDATE CONTACT
# =========================
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

    contact = (
        db.query(Contact)
        .filter(Contact.id == uuid.UUID(contact_id))
        .first()
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.display_name = payload.display_name

    db.commit()
    db.refresh(contact)

    return {
        "id": str(contact.id),
        "display_name": contact.display_name
    }
