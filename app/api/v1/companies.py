from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Company, CompanyUser, User
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/admin/companies", tags=["Admin Companies"])


# 📌 1. LIST COMPANIES + USER COUNT
@router.get("/")
def list_companies(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):

    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403)

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
    else:
        query = (
            db.query(
                Company,
                func.count(CompanyUser.user_id).label("user_count")
            )
            .join(CompanyUser, Company.id == CompanyUser.company_id)
            .filter(CompanyUser.user_id == current_user.id)
            .group_by(Company.id)
            .all()
        )

    return [
        {
            "id": c.Company.id,
            "name": c.Company.name,
            "status": c.Company.status,
            "user_count": c.user_count
        }
        for c in query
    ]


# 📌 2. CREATE COMPANY
@router.post("/")
def create_company(
    data: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):

    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    company = Company(
        name=data["name"],
        status="active"
    )

    db.add(company)
    db.commit()
    db.refresh(company)

    return company


# 📌 3. UPDATE COMPANY
@router.put("/{company_id}")
def update_company(
    company_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):

    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404)

    company.name = data.get("name", company.name)
    company.status = data.get("status", company.status)

    db.commit()

    return company

#GET users trong company
@router.get("/{company_id}/users")
def get_company_users(
    company_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    users = (
        db.query(CompanyUser, User)
        .join(User, User.id == CompanyUser.user_id)
        .filter(CompanyUser.company_id == company_id)
        .all()
    )

    return [
        {
            "user_id": u.User.id,
            "email": u.User.email,
            "role": u.CompanyUser.role
        }
        for u in users
    ]

#GET users trong company
@router.post("/{company_id}/users")
def assign_user_to_company(
    company_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    payload:
    {
        "user_id": "uuid",
        "role": "admin | staff | viewer"
    }
    """

    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    user_id = payload.get("user_id")
    role = payload.get("role")

    if not user_id or not role:
        raise HTTPException(status_code=400, detail="Missing user_id or role")

    # check company
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # check user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # check existing mapping
    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    # update nếu đã tồn tại
    if mapping:
        mapping.role = role
        db.commit()

        return {
            "message": "Updated user role in company",
            "company_id": company_id,
            "user_id": user_id,
            "role": role
        }

    # insert mới
    new_mapping = CompanyUser(
        company_id=company_id,
        user_id=user_id,
        role=role
    )

    db.add(new_mapping)
    db.commit()

    return {
        "message": "User assigned to company",
        "company_id": company_id,
        "user_id": user_id,
        "role": role
    }

#REMOVE user khỏi company
@router.delete("/{company_id}/users/{user_id}")
def remove_user_from_company(
    company_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    db.delete(mapping)
    db.commit()

    return {
        "message": "User removed from company",
        "company_id": company_id,
        "user_id": user_id
    }

#UPDATE role user trong company
@router.put("/{company_id}/users/{user_id}/role")
def update_user_role_in_company(
    company_id: str,
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    role = payload.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Missing role")

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404, detail="User not in company")

    mapping.role = role
    db.commit()

    return {
        "message": "Role updated",
        "company_id": company_id,
        "user_id": user_id,
        "role": role
    }