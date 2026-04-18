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
    try:
        company_uuid = uuid.UUID(payload.get("company_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id")

    employee = Employee(
        id=uuid.uuid4(),
        company_id=company_uuid,
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
    # ✅ convert employee_id
    try:
        employee_uuid = uuid.UUID(employee_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee_id")

    employee = db.query(Employee).filter_by(id=employee_uuid).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # ✅ SAFE UPDATE (fix crash root cause)
    if payload.get("company_id"):
        try:
            employee.company_id = uuid.UUID(payload.get("company_id"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid company_id")

    if payload.get("name") is not None:
        employee.name = payload.get("name")

    if payload.get("system_prompt") is not None:
        employee.system_prompt = payload.get("system_prompt")

    if payload.get("style_prompt") is not None:
        employee.style_prompt = payload.get("style_prompt")

    if payload.get("is_active") is not None:
        employee.is_active = payload.get("is_active")

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