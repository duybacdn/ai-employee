from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Employee, CompanyUser, ChannelEmployee, Channel

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
# CREATE EMPLOYEE (CLEAN)
# =========================
@router.post("/")
def create_employee(
    payload: dict,
    db: Session = Depends(get_db),
):
    employee = Employee(
        id=uuid.uuid4(),
        company_id=payload.get("company_id"),
        name=payload.get("name"),
        system_prompt=payload.get("system_prompt"),
        style_prompt=payload.get("style_prompt"),
        is_active=True,
    )

    db.add(employee)
    db.commit()
    db.refresh(employee)

    return employee


# =========================
# LIST EMPLOYEE (GIỮ NGUYÊN)
# =========================
@router.get("/")
def list_employees(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_companies = [
        cu.company_id
        for cu in db.query(CompanyUser)
        .filter_by(user_id=current_user.id)
        .all()
    ]

    employees = (
        db.query(Employee)
        .filter(Employee.company_id.in_(user_companies))
        .all()
    )

    result = []

    for emp in employees:
        channels = (
            db.query(Channel)
            .join(ChannelEmployee, Channel.id == ChannelEmployee.channel_id)
            .filter(ChannelEmployee.employee_id == emp.id)
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
# UPDATE EMPLOYEE (FIXED)
# =========================
@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter_by(id=employee_id).first()

    if not employee:
        raise HTTPException(status_code=404)

    # ✅ FIX QUAN TRỌNG
    employee.company_id = payload.get("company_id")

    employee.name = payload.get("name")
    employee.system_prompt = payload.get("system_prompt")
    employee.style_prompt = payload.get("style_prompt")
    employee.is_active = payload.get("is_active", employee.is_active)

    db.commit()
    db.refresh(employee)

    return employee

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter_by(id=employee_id).first()

    if not employee:
        raise HTTPException(status_code=404)

    # ❗ xóa luôn mapping
    db.query(ChannelEmployee).filter_by(employee_id=employee_id).delete()

    db.delete(employee)
    db.commit()

    return {"success": True}