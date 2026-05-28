from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Company, CompanyUser, User, Channel, Employee
from app.schemas.auth import CurrentUser
from app.core.permission import require_company_access, require_company_admin

router = APIRouter(prefix="/companies", tags=["Companies"])


# =========================
# LIST COMPANIES
# =========================
@router.get("/")
def list_companies(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    # 🔥 SUPERADMIN → thấy tất cả (kể cả deleted)
    if current_user.role == "superadmin":
        query = (
            db.query(
                Company,
                func.count(CompanyUser.user_id).label("user_count")
            )
            .outerjoin(CompanyUser, Company.id == CompanyUser.company_id)
            .group_by(Company.id)
            .all()
        )

    # 🔥 ADMIN / STAFF → chỉ thấy ACTIVE company
    else:
        if not current_user.company_ids:
            raise HTTPException(status_code=403)

        query = (
            db.query(
                Company,
                func.count(CompanyUser.user_id).label("user_count")
            )
            .join(CompanyUser, Company.id == CompanyUser.company_id)
            .filter(
                CompanyUser.company_id.in_(
                    [uuid.UUID(cid) for cid in current_user.company_ids]
                ),
                Company.status == "active"   # 🔥 chỉ active
            )
            .group_by(Company.id)
            .all()
        )

    return [
        {
            "id": str(c.Company.id),
            "name": c.Company.name,
            "status": c.Company.status,
            "user_count": c.user_count
        }
        for c in query
    ]


# =========================
# GET COMPANY USERS
# =========================
@router.get("/{company_id}/users")
def get_company_users(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_company_access(db, current_user, company_id)

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id)
    ).first()

    if not company or company.status == "deleted":
        raise HTTPException(status_code=404)

    users = (
        db.query(CompanyUser, User)
        .join(User, User.id == CompanyUser.user_id)
        .filter(CompanyUser.company_id == uuid.UUID(company_id))
        .all()
    )

    return [
        {
            "user_id": str(u.User.id),
            "email": u.User.email,
            "role": u.CompanyUser.role
        }
        for u in users
    ]


# =========================
# CREATE COMPANY (SUPERADMIN)
# =========================
@router.post("/")
def create_company(
    data: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    name = data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    company = Company(
        name=name,
        status="active"
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    return {
        "id": str(company.id),
        "name": company.name,
        "status": company.status
    }


# =========================
# UPDATE COMPANY (SUPERADMIN)
# =========================
@router.put("/{company_id}")
def update_company(
    company_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id)
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    company.name = data.get("name", company.name)
    company.status = data.get("status", company.status)

    db.commit()

    return {
        "id": str(company.id),
        "name": company.name,
        "status": company.status
    }


# =========================
# DELETE COMPANY (SOFT + CASCADE)
# =========================
@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id)
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    if company.status == "deleted":
        return {"message": "Already deleted"}

    # 🔥 company
    company.status = "deleted"

    # 🔥 cascade channel
    db.query(Channel).filter(
        Channel.company_id == company.id
    ).update({"status": "deleted"}, synchronize_session=False)

    # 🔥 cascade employee
    db.query(Employee).filter(
        Employee.company_id == company.id
    ).update({"status": "deleted"}, synchronize_session=False)

    db.commit()

    return {"message": "Company deleted"}


# =========================
# RESTORE COMPANY (SUPERADMIN)
# =========================
@router.post("/{company_id}/restore")
def restore_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id)
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    if company.status != "deleted":
        return {"message": "Company is not deleted"}

    # 🔥 restore company
    company.status = "active"

    # 🔥 restore channel
    db.query(Channel).filter(
        Channel.company_id == company.id
    ).update({"status": "active"}, synchronize_session=False)

    # 🔥 restore employee
    db.query(Employee).filter(
        Employee.company_id == company.id
    ).update({"status": "active"}, synchronize_session=False)

    db.commit()

    return {"message": "Company restored"}


# =========================
# ASSIGN USER → ADMIN ONLY
# =========================
@router.post("/{company_id}/users")
def assign_user_to_company(
    company_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id),
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    user_id = payload.get("user_id")
    role = payload.get("role")

    if not user_id or not role:
        raise HTTPException(status_code=400)

    user = db.query(User).filter(
        User.id == uuid.UUID(user_id)
    ).first()

    if not user:
        raise HTTPException(status_code=404)

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == uuid.UUID(company_id),
            CompanyUser.user_id == uuid.UUID(user_id)
        )
        .first()
    )

    if mapping:
        mapping.role = role
        db.commit()
        return {"message": "Updated"}

    db.add(CompanyUser(
        company_id=uuid.UUID(company_id),
        user_id=uuid.UUID(user_id),
        role=role
    ))

    db.commit()

    return {"message": "Assigned"}


# =========================
# REMOVE USER
# =========================
@router.delete("/{company_id}/users/{user_id}")
def remove_user_from_company(
    company_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == uuid.UUID(company_id),
            CompanyUser.user_id == uuid.UUID(user_id)
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404)

    db.delete(mapping)
    db.commit()

    return {"message": "Removed"}


# =========================
# UPDATE ROLE
# =========================
@router.put("/{company_id}/users/{user_id}/role")
def update_user_role_in_company(
    company_id: str,
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    role = payload.get("role")
    if not role:
        raise HTTPException(status_code=400)

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == uuid.UUID(company_id),
            CompanyUser.user_id == uuid.UUID(user_id)
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404)

    mapping.role = role
    db.commit()

    return {"message": "Role updated"}