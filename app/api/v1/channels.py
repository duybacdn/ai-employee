# app/api/v1/channels.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Channel, ChannelEmployee,FacebookPage

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
    company_id: str = Query(..., description="ID của company"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    channels = db.query(Channel).filter(Channel.company_id == company_id).all()
    return channels

# TOGGLE CHANNEL ACTIVE
@router.patch("/{channel_id}/toggle", tags=["channels"])
def toggle_channel(channel_id: str, db: Session = Depends(get_db)):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel.is_active = not channel.is_active
    db.commit()
    db.refresh(channel)
    return {"id": str(channel.id), "is_active": channel.is_active}

@router.delete("/{channel_id}", tags=["channels"])
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    try:
        # 1️⃣ Lấy channel
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # 2️⃣ Lấy facebook page liên quan (nếu có)
        page = channel.facebook_page  # relationship

        # 3️⃣ Xoá mapping nhân viên trước
        db.query(ChannelEmployee).filter(ChannelEmployee.channel_id == channel_id).delete(synchronize_session=False)

        # 4️⃣ Xoá channel
        db.delete(channel)
        db.commit()

        # 5️⃣ Kiểm tra nếu page còn channel khác không, nếu không thì xoá page
        if page:
            other_channel = (
                db.query(Channel)
                .join(FacebookPage)
                .filter(FacebookPage.id == page.id)
                .first()
            )
            if not other_channel:
                db.delete(page)
                db.commit()

        return {"success": True}

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

# GET CHANNEL EMPLOYEES
@router.get("/{channel_id}/employees", tags=["channels"])
def get_channel_employees(channel_id: str, db: Session = Depends(get_db)):
    assignments = db.query(ChannelEmployee).filter(ChannelEmployee.channel_id == channel_id).order_by(ChannelEmployee.priority.asc()).all()
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
def assign_employee(channel_id: str, payload: dict, db: Session = Depends(get_db)):
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
def bulk_assign(channel_id: str, payload: dict, db: Session = Depends(get_db)):
    employees = payload.get("employees", [])
    db.query(ChannelEmployee).filter(ChannelEmployee.channel_id == channel_id).delete()
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