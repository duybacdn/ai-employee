from fastapi import HTTPException
from sqlalchemy.orm import Session
import uuid

from app.schemas.auth import CurrentUser


# =========================
# 🔹 HELPER
# =========================
def parse_uuid(value: str, field_name: str = "id"):
    try:
        return uuid.UUID(value)
    except:
        raise HTTPException(400, f"Invalid {field_name}")


# =========================
# 🔹 COMPANY ACCESS
# =========================
def require_company_access(db: Session, current_user: CurrentUser, company_id: str):
    from app.models.core import CompanyUser

    if current_user.is_superadmin:
        return True

    cid = parse_uuid(company_id, "company_id")

    exists = db.query(CompanyUser).filter(
        CompanyUser.user_id == current_user.id,
        CompanyUser.company_id == cid
    ).first()

    if not exists:
        raise HTTPException(403, "No access to this company")

    return True


# =========================
# 🔹 COMPANY ADMIN
# =========================
def require_company_admin(db: Session, current_user: CurrentUser, company_id: str):
    from app.models.core import CompanyUser

    if current_user.is_superadmin:
        return True

    cid = parse_uuid(company_id, "company_id")

    cu = db.query(CompanyUser).filter(
        CompanyUser.user_id == current_user.id,
        CompanyUser.company_id == cid
    ).first()

    if not cu or str(cu.role).upper() != "ADMIN":
        raise HTTPException(403, "Admin required")

    return True


# =========================
# 🔹 CHANNEL ACCESS
# =========================
def require_channel_access(db: Session, current_user: CurrentUser, channel_id: str):
    from app.models.core import Channel, CompanyUser, UserAssignment

    if current_user.is_superadmin:
        return True

    cid = parse_uuid(channel_id, "channel_id")

    channel = db.query(Channel).filter(Channel.id == cid).first()
    if not channel:
        raise HTTPException(404, "Channel not found")

    # ADMIN → full access trong company
    cu = db.query(CompanyUser).filter(
        CompanyUser.user_id == current_user.id,
        CompanyUser.company_id == channel.company_id
    ).first()

    if cu and str(cu.role).upper() == "ADMIN":
        return True

    # STAFF → check mapping
    allowed = db.query(UserAssignment).filter(
        UserAssignment.user_id == current_user.id,
        UserAssignment.channel_id == channel.id
    ).first()

    if not allowed:
        raise HTTPException(403, "No channel access")

    return True


# =========================
# 🔹 EMPLOYEE ACCESS
# =========================
def require_employee_access(db: Session, current_user: CurrentUser, employee_id: str):
    from app.models.core import Employee, CompanyUser, UserAssignment

    if current_user.is_superadmin:
        return True

    eid = parse_uuid(employee_id, "employee_id")

    emp = db.query(Employee).filter(Employee.id == eid).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    # ADMIN → full access
    cu = db.query(CompanyUser).filter(
        CompanyUser.user_id == current_user.id,
        CompanyUser.company_id == emp.company_id
    ).first()

    if cu and str(cu.role).upper() == "ADMIN":
        return True

    # STAFF → check mapping
    allowed = db.query(UserAssignment).filter(
        UserAssignment.user_id == current_user.id,
        UserAssignment.employee_id == emp.id
    ).first()

    if not allowed:
        raise HTTPException(403, "No employee access")

    return True


# =========================
# 🔹 MESSAGE ACCESS (OPTIONAL)
# =========================
def require_message_access(db: Session, current_user: CurrentUser, message_id: str):
    from app.models.core import Message

    mid = parse_uuid(message_id, "message_id")

    msg = db.query(Message).filter(Message.id == mid).first()
    if not msg:
        raise HTTPException(404, "Message not found")

    return require_channel_access(db, current_user, str(msg.channel_id))