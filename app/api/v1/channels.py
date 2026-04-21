# app/api/v1/channels.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Channel, ChannelEmployee,FacebookPage
from app.models.core import Message, Conversation

router = APIRouter()

# DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# LIST CHANNELS BY COMPANY
@router.get("/", tags=["channels"])
def list_channels(
    company_id: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(Channel)

    if is_superadmin:
        # 🔥 superadmin filter theo combobox
        if company_id:
            query = query.filter(Channel.company_id == company_id)
    else:
        # user thường luôn bị scope company
        query = query.filter(Channel.company_id == current_user.company_id)

    return query.all()

# TOGGLE CHANNEL ACTIVE
@router.patch("/{channel_id}/toggle", tags=["channels"])
def toggle_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):

    is_superadmin = current_user.role == "superadmin"

    query = db.query(Channel).filter(Channel.id == channel_id)

    if not is_superadmin:
        query = query.filter(Channel.company_id == current_user.company_id)

    channel = query.first()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel.is_active = not channel.is_active
    db.commit()
    db.refresh(channel)

    return {"id": str(channel.id), "is_active": channel.is_active}

@router.delete("/{channel_id}", tags=["channels"])
def delete_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        is_superadmin = current_user.role == "superadmin"

        channel = db.query(Channel).filter(Channel.id == channel_id)

        if not is_superadmin:
            channel = channel.filter(Channel.company_id == current_user.company_id)

        channel = channel.first()

        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # 1. conversations
        conversations = db.query(Conversation).filter(
            Conversation.channel_id == channel.id
        ).all()

        conversation_ids = [c.id for c in conversations]

        if conversation_ids:
            db.query(Message).filter(
                Message.conversation_id.in_(conversation_ids)
            ).delete(synchronize_session=False)

        db.query(Conversation).filter(
            Conversation.channel_id == channel.id
        ).delete(synchronize_session=False)

        # 2. channel employees
        db.query(ChannelEmployee).filter(
            ChannelEmployee.channel_id == channel.id
        ).delete(synchronize_session=False)

        # 3. facebook page (SAFE FIX)
        page = db.query(FacebookPage).filter(
            FacebookPage.channel_id == channel.id
        ).first()

        # 4. delete channel
        db.delete(channel)
        db.commit()

        # 5. delete page sau commit (SAFE)
        if page:
            db.delete(page)
            db.commit()

        return {"success": True}

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# GET CHANNEL EMPLOYEES
@router.get("/{channel_id}/employees", tags=["channels"])
def get_channel_employees(
    channel_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    channel = db.query(Channel).filter(Channel.id == channel_id)

    if not is_superadmin:
        channel = channel.filter(Channel.company_id == current_user.company_id)

    if not channel.first():
        raise HTTPException(status_code=404, detail="Channel not found")

    assignments = db.query(ChannelEmployee).filter(
        ChannelEmployee.channel_id == channel_id
    ).order_by(ChannelEmployee.priority.asc()).all()

    return [
        {
            "employee_id": a.employee_id,
            "priority": a.priority,
            "autoreply_mode": a.autoreply_mode,
            "is_active": a.is_active,
        }
        for a in assignments
    ]

# ASSIGN SINGLE EMPLOYEE
@router.post("/{channel_id}/employees", tags=["channels"])
def assign_employee(
    channel_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    channel = db.query(Channel).filter(Channel.id == channel_id)

    if not is_superadmin:
        channel = channel.filter(Channel.company_id == current_user.company_id)

    if not channel.first():
        raise HTTPException(status_code=404, detail="Channel not found")

    employee_id = payload.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Missing employee_id")

    existing = db.query(ChannelEmployee).filter(
        ChannelEmployee.channel_id == channel_id,
        ChannelEmployee.employee_id == employee_id,
    ).first()

    if existing:
        existing.priority = payload.get("priority", existing.priority)
        existing.autoreply_mode = payload.get("autoreply_mode", existing.autoreply_mode)
        existing.is_active = payload.get("is_active", existing.is_active)
    else:
        new_item = ChannelEmployee(
            channel_id=channel_id,
            employee_id=employee_id,
            priority=payload.get("priority", 1),
            autoreply_mode=payload.get("autoreply_mode", "auto"),
            is_active=payload.get("is_active", True),
        )
        db.add(new_item)

    db.commit()
    return {"success": True}

# BULK ASSIGN EMPLOYEES
@router.post("/{channel_id}/assign", tags=["channels"])
def bulk_assign(
    channel_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    channel = db.query(Channel).filter(Channel.id == channel_id)

    if not is_superadmin:
        channel = channel.filter(Channel.company_id == current_user.company_id)

    if not channel.first():
        raise HTTPException(status_code=404, detail="Channel not found")

    employees = payload.get("employees", [])

    db.query(ChannelEmployee).filter(
        ChannelEmployee.channel_id == channel_id
    ).delete()

    for item in employees:
        new_item = ChannelEmployee(
            channel_id=channel_id,
            employee_id=item["employee_id"],
            priority=item.get("priority", 1),
            autoreply_mode=item.get("autoreply_mode", "auto"),
            is_active=item.get("is_active", True),
        )
        db.add(new_item)

    db.commit()
    return {"success": True}