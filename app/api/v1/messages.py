from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
from sqlalchemy.orm import Session, joinedload
import uuid
from datetime import datetime
import json

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import (
    Message,
    Conversation,
    Channel,
    ContactIdentity,
    Company
)
from app.models.enums import MessageDirection, Platform, MessageKind
from app.schemas.auth import CurrentUser
from app.schemas.message import MessageOut
from app.models.core import ChannelEmployee
from app.core.permission import require_channel_access

from app.services.facebook_service import send_message, reply_comment
from app.services.s3_service import upload_file

# 🔥 realtime
from app.ws import manager

router = APIRouter()


# ======================================================
# GET MESSAGES
# ======================================================
@router.get("/messages", response_model=list[MessageOut])
def get_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    try:
        conversation_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(400, "Invalid conversation_id")

    # ================= CHECK conversation =================
    query = (
        db.query(Conversation)
        .join(Channel, Conversation.channel_id == Channel.id)
        .join(Company, Conversation.company_id == Company.id)
        .filter(
            Conversation.id == conversation_uuid,
            Channel.is_active == True,
            Company.status == "active"
        )
    )

    if not is_superadmin:
        if not current_user.company_ids:
            raise HTTPException(403, "No company access")

        query = query.filter(
            Conversation.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    conversation = query.first()

    if not conversation:
        raise HTTPException(404, "Conversation not found")

    # 🔥 FIX CHANNEL ACCESS
    if not is_superadmin:
        require_channel_access(db, current_user, str(conversation.channel_id))
    # 🔥 HARD FILTER STAFF (anti bypass)
    if current_user.role == "staff":
        from app.models.core import UserAssignment

        allowed_channels = db.query(UserAssignment.channel_id).filter(
            UserAssignment.user_id == uuid.UUID(current_user.id),
            UserAssignment.channel_id.isnot(None)
        ).all()

        allowed_channel_ids = [c[0] for c in allowed_channels]

        if conversation.channel_id not in allowed_channel_ids:
            raise HTTPException(403, "Forbidden")

    # ================= GET messages =================
    messages = (
        db.query(Message)
        .options(joinedload(Message.employee))
        .filter(Message.conversation_id == conversation_uuid)
        .order_by(Message.created_at)
        .all()
    )
    result = []

    for m in messages:
        direction = m.direction.value if hasattr(m.direction, "value") else m.direction

        # NAME
        if direction == "inbound":
            name = (
                conversation.contact.display_name
                if conversation.contact and conversation.contact.display_name
                else "Facebook User"
            )
        else:
            name = m.employee.name if m.employee else "AI"

        parent_id = None

        if m.kind == MessageKind.COMMENT:
            parent_id = m.parent_comment_id

        attachments = None

        if m.attachments:
            try:
                if isinstance(m.attachments, str):
                    attachments = json.loads(m.attachments)
                else:
                    attachments = m.attachments
            except:
                attachments = None

        result.append(
            MessageOut(
                id=str(m.id),
                text=m.text or "",
                direction=direction,
                attachments=attachments,
                employee_id=str(m.employee_id) if m.employee_id else None,
                employee_name=name,

                status=m.status,
                content=m.text or "",

                role="user" if direction == "inbound" else "assistant",
                created_at=m.created_at.isoformat(),
                kind=m.kind.value if hasattr(m.kind, "value") else str(m.kind),

                external_id=(
                    m.external_message_id
                    if m.external_message_id
                    else str(m.id)
                ),

                parent_id=parent_id,

                post_id=str(conversation.post_id) if conversation.post_id else None,
                post_context=(conversation.post_context or "").strip(),
            )
        )

    return result


# ======================================================
# SEND MESSAGE (REALTIME + FACEBOOK)
# ======================================================
@router.post("/messages/send")
async def send_message_api(
    body: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        conversation_id = uuid.UUID(body.get("conversation_id"))
        text = body.get("text") or body.get("content")
    except Exception:
        raise HTTPException(400, "Invalid input")

    attachments = body.get("attachments") or []

    if not text and not attachments:
        raise HTTPException(400, "Empty message")

    query = (
        db.query(Conversation)
        .join(Company, Conversation.company_id == Company.id)
        .filter(
            Conversation.id == conversation_id,
            Company.status == "active"
        )
    )

    if current_user.role != "superadmin":
        if not current_user.company_ids:
            raise HTTPException(403, "No company access")

        query = query.filter(
            Conversation.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    conversation = query.first()

    if not conversation:
        raise HTTPException(404, "Conversation not found")

    # 🔥 FIX CHANNEL ACCESS
    if current_user.role != "superadmin":
        require_channel_access(db, current_user, str(conversation.channel_id))
    # 🔥 HARD FILTER STAFF (anti bypass)
    if current_user.role == "staff":
        from app.models.core import UserAssignment

        allowed_channels = db.query(UserAssignment.channel_id).filter(
            UserAssignment.user_id == uuid.UUID(current_user.id),
            UserAssignment.channel_id.isnot(None)
        ).all()

        allowed_channel_ids = [c[0] for c in allowed_channels]

        if conversation.channel_id not in allowed_channel_ids:
            raise HTTPException(403, "Forbidden")

    inbound = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.direction == MessageDirection.INBOUND
        )
        .order_by(Message.created_at.desc())
        .first()
    )

    kind = body.get("kind", "inbox")
    parent_id = body.get("parent_id")

    if not inbound:
        raise HTTPException(400, "No inbound message")

    channel_employee = (
        db.query(ChannelEmployee)
        .filter(
            ChannelEmployee.channel_id == inbound.channel_id,
            ChannelEmployee.is_active == True
        )
        .order_by(ChannelEmployee.priority.asc())
        .first()
    )

    employee_id = channel_employee.employee_id if channel_employee else None

    outbound = Message(
        id=uuid.uuid4(),
        company_id=conversation.company_id,
        conversation_id=conversation.id,
        channel_id=inbound.channel_id,
        contact_id=inbound.contact_id,
        direction=MessageDirection.OUTBOUND,
        kind=MessageKind.COMMENT if kind == "comment" else MessageKind.INBOX,
        text=text,
        attachments=attachments,   # ✅ THÊM DÒNG NÀY
        employee_id=employee_id,
        parent_comment_id=(
            parent_id or inbound.external_message_id
            if kind == "comment"
            else None
        ),
        status="pending"
    )

    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    await manager.broadcast(str(conversation.id), {
        "type": "new_message",
        "message": {
            "id": str(outbound.id),
            "conversation_id": str(conversation.id),
            "text": outbound.text,
            "attachments": outbound.attachments,
            "direction": "outbound",
            "kind": kind,
            "parent_id": outbound.parent_comment_id,
            "created_at": outbound.created_at.isoformat(),
            "status": outbound.status,
            "employee_id": str(outbound.employee_id),
            "employee_name": current_user.email,
        }
    })

    try:
        identity = (
            db.query(ContactIdentity)
            .filter_by(
                contact_id=inbound.contact_id,
                platform=Platform.FACEBOOK,
                company_id=conversation.company_id
            )
            .first()
        )

        if not identity:
            raise Exception("No identity")

        psid = identity.external_user_id

        if kind == "comment":
            reply_comment(
                db=db,
                channel_id=inbound.channel_id,
                comment_id=parent_id or inbound.external_message_id,
                text=text,
            )
        else:
            send_message(
                db,
                inbound.channel_id,
                psid,
                text,
                attachments=outbound.attachments
            )

        outbound.status = "sent"
        outbound.sent_at = datetime.utcnow()

    except Exception as e:
        print("❌ SEND FAIL:", e)
        outbound.status = "failed"

    db.commit()

    await manager.broadcast(str(conversation.id), {
        "type": "update_status",
        "message_id": str(outbound.id),
        "status": outbound.status,
    })

    return {
        "id": str(outbound.id),
        "text": outbound.text,
        "attachments": outbound.attachments,
        "status": outbound.status,
        "created_at": outbound.created_at.isoformat()
    }