from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
import uuid
from datetime import datetime
import asyncio

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import (
    Message,
    Conversation,
    Channel,
    ContactIdentity,
)
from app.models.enums import MessageDirection, Platform, MessageKind
from app.schemas.auth import CurrentUser
from app.schemas.message import MessageOut
from app.models.core import ChannelEmployee

from app.services.facebook_service import send_message, reply_comment

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
        .join(Channel)
        .filter(
            Conversation.id == conversation_uuid,
            Channel.is_active == True
        )
    )

    if not is_superadmin:
        if not current_user.company_id:
            raise HTTPException(403, "No company access")

        query = query.filter(
            Conversation.company_id == uuid.UUID(current_user.company_id)
        )

    conversation = query.first()

    if not conversation:
        raise HTTPException(404, "Conversation not found")

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

        employee_name = None

        if m.employee:
            employee_name = m.employee.name
        elif direction == "outbound":
            employee_name = "Facebook User"

        result.append(
            MessageOut(
                id=str(m.id),
                text=m.text,
                direction=direction,

                employee_id=str(m.employee_id) if m.employee_id else None,
                employee_name=employee_name,

                status=m.status,

                content=m.text,
                role="user" if direction == "inbound" else "assistant",

                created_at=m.created_at.isoformat(),
            )
        )

    return result


# ======================================================
# SEND MESSAGE (REALTIME + FACEBOOK)
# ======================================================
@router.post("/messages/send")
async def send_message_api(   # 🔥 đổi sang async luôn
    body: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        conversation_id = uuid.UUID(body.get("conversation_id"))
        text = body.get("text") or body.get("content")
    except Exception:
        raise HTTPException(400, "Invalid input")

    if not text:
        raise HTTPException(400, "Empty message")

    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        raise HTTPException(404, "Conversation not found")

    # 🔥 inbound gần nhất
    inbound = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.direction == MessageDirection.INBOUND
        )
        .order_by(Message.created_at.desc())
        .first()
    )

    if not inbound:
        raise HTTPException(400, "No inbound message")

    # ======================================================
    # 1. INSERT MESSAGE (PENDING)
    # ======================================================
    # 🔥 chọn employee theo channel (ưu tiên cao nhất)
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
        kind=inbound.kind,
        text=text,

        # 🔥 FIX ĐÚNG THEO SYSTEM
        employee_id=employee_id,

        status="pending"
    )

    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    # ======================================================
    # 2. REALTIME PUSH (NEW MESSAGE)
    # ======================================================
    await manager.broadcast(str(conversation.id), {
        "type": "new_message",
        "message": {
            "id": str(outbound.id),
            "text": outbound.text,
            "direction": "outbound",
            "created_at": outbound.created_at.isoformat(),
            "status": "pending",
            "employee_id": str(outbound.employee_id),
            "employee_name": current_user.name,  # 🔥 FIX QUAN TRỌNG
        }
    })

    # ======================================================
    # 3. SEND FACEBOOK
    # ======================================================
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

        if inbound.kind == MessageKind.COMMENT:
            reply_comment(
                db=db,
                channel_id=inbound.channel_id,
                comment_id=inbound.external_message_id,
                text=text,
            )
        else:
            send_message(
                db,
                inbound.channel_id,
                psid,
                text
            )

        outbound.status = "sent"
        outbound.sent_at = datetime.utcnow()

    except Exception as e:
        print("❌ SEND FAIL:", e)
        outbound.status = "failed"

    db.commit()

    # ======================================================
    # 4. REALTIME UPDATE STATUS
    # ======================================================
    await manager.broadcast(str(conversation.id), {
        "type": "update_status",
        "message_id": str(outbound.id),
        "status": outbound.status,
    })

    return {
        "id": str(outbound.id),
        "text": outbound.text,
        "status": outbound.status,
        "created_at": outbound.created_at.isoformat()
    }