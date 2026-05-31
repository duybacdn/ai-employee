from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Employee, ChannelEmployee, Channel, Company, UserAssignment
from app.schemas.auth import CurrentUser
from app.core.permission import (
    require_company_admin,
    require_employee_access
)

router = APIRouter()

# =========================
# DB
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# CREATE EMPLOYEE
# =========================
@router.post("/")
def create_employee(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    company_id = payload.get("company_id")

    if not company_id:
        raise HTTPException(status_code=400, detail="company_id required")

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id),
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # 🔥 check quyền admin trên company này
    require_company_admin(db, current_user, company_id)

    employee = Employee(
        id=uuid.uuid4(),
        company_id=uuid.UUID(company_id),
        name=payload.get("name"),
        system_prompt=payload.get("system_prompt"),
        style_prompt=payload.get("style_prompt"),
        is_active=True,
    )

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return {
        "id": str(employee.id),
        "name": employee.name,
        "company_id": str(employee.company_id),
        "system_prompt": employee.system_prompt,
        "style_prompt": employee.style_prompt,
        "is_active": employee.is_active,
    }


# =========================
# LIST EMPLOYEES
# =========================
@router.get("/")
def list_employees(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    query = (
        db.query(Employee)
        .join(Company, Employee.company_id == Company.id)
        .filter(Company.status == "active")
    )

    # 🔥 SUPERADMIN → all
    if current_user.role == "superadmin":
        pass

    # 🔥 ADMIN → full company
    elif current_user.role == "admin":
        query = query.filter(
            Employee.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    # STAFF → chỉ employee được assign
    else:
        allowed_employee_ids = db.query(UserAssignment.employee_id).filter(
            UserAssignment.user_id == uuid.UUID(current_user.id),
            UserAssignment.employee_id.isnot(None)
        ).all()

        allowed_employee_ids = [e[0] for e in allowed_employee_ids]

        if not allowed_employee_ids:
            return []

        query = query.filter(Employee.id.in_(allowed_employee_ids))

    employees = query.all()

    result = []

    for emp in employees:
        channels = (
            db.query(Channel)
            .join(Company, Channel.company_id == Company.id)
            .join(ChannelEmployee, Channel.id == ChannelEmployee.channel_id)
            .filter(
                Company.status == "active",
                ChannelEmployee.employee_id == emp.id
            )
            .all()
        )

        result.append({
            "id": str(emp.id),
            "name": emp.name,
            "company_id": str(emp.company_id),
            "company_name": emp.company.name if emp.company else "",
            "system_prompt": emp.system_prompt,
            "style_prompt": emp.style_prompt,
            "is_active": emp.is_active,
            "channels": [
                {"id": str(c.id), "name": c.name} for c in channels
            ],
        })

    return result


# =========================
# UPDATE EMPLOYEE
# =========================
@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        employee_uuid = uuid.UUID(employee_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee_id")

    employee = (
        db.query(Employee)
        .join(Company, Employee.company_id == Company.id)
        .filter(
            Employee.id == employee_uuid,
            Company.status == "active"
        )
        .first()
    )

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # 🔥 FIX QUYỀN
    require_employee_access(db, current_user, str(employee.id))

    # 🔥 SUPERADMIN mới được đổi company
    if current_user.role == "superadmin" and payload.get("company_id"):
        employee.company_id = uuid.UUID(payload["company_id"])

    if payload.get("name") is not None:
        employee.name = payload["name"]

    if payload.get("system_prompt") is not None:
        employee.system_prompt = payload["system_prompt"]

    if payload.get("style_prompt") is not None:
        employee.style_prompt = payload["style_prompt"]

    if payload.get("is_active") is not None:
        employee.is_active = payload["is_active"]

    db.commit()
    db.refresh(employee)

    return {
        "id": str(employee.id),
        "name": employee.name,
        "company_id": str(employee.company_id),
        "system_prompt": employee.system_prompt,
        "style_prompt": employee.style_prompt,
        "is_active": employee.is_active,
    }


# =========================
# DELETE EMPLOYEE
# =========================
@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        employee_uuid = uuid.UUID(employee_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee_id")

    employee = (
        db.query(Employee)
        .join(Company, Employee.company_id == Company.id)
        .filter(
            Employee.id == employee_uuid,
            Company.status == "active"
        )
        .first()
    )

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # 🔥 FIX QUYỀN
    require_employee_access(db, current_user, str(employee.id))

    if employee.company.status != "active":
        raise HTTPException(status_code=403, detail="Company inactive")

    # xoá mapping trước
    db.query(ChannelEmployee).filter_by(employee_id=employee.id).delete()

    db.delete(employee)
    db.commit()

    return {"success": True}