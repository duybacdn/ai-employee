from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Employee, CompanyUser, ChannelEmployee, Channel
from app.schemas.auth import CurrentUser

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
    is_superadmin = current_user.role == "superadmin"

    if not is_superadmin and not current_user.company_id:
        raise HTTPException(status_code=403, detail="No company access")

    company_id = (
        uuid.UUID(payload["company_id"])
        if is_superadmin and payload.get("company_id")
        else uuid.UUID(current_user.company_id)
    )

    employee = Employee(
        id=uuid.uuid4(),
        company_id=company_id,
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
    is_superadmin = current_user.role == "superadmin"

    query = db.query(Employee)

    if not is_superadmin:
        user_companies = [
            cu.company_id
            for cu in db.query(CompanyUser)
            .filter_by(user_id=current_user.id)
            .all()
        ]
        query = query.filter(Employee.company_id.in_(user_companies))

    employees = query.all()

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
# UPDATE EMPLOYEE
# =========================
@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    try:
        employee_uuid = uuid.UUID(employee_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee_id")

    query = db.query(Employee).filter(Employee.id == employee_uuid)

    if not is_superadmin:
        query = query.filter(Employee.company_id == current_user.company_id)

    employee = query.first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if is_superadmin and payload.get("company_id"):
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
    is_superadmin = current_user.role == "superadmin"

    try:
        employee_uuid = uuid.UUID(employee_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee_id")

    query = db.query(Employee).filter(Employee.id == employee_uuid)

    if not is_superadmin:
        query = query.filter(Employee.company_id == current_user.company_id)

    employee = query.first()

    if not employee:
        raise HTTPException(status_code=404)

    db.query(ChannelEmployee).filter_by(employee_id=employee.id).delete()

    db.delete(employee)
    db.commit()

    return {"success": True}