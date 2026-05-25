from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Company, CompanyUser, User
from app.schemas.auth import CurrentUser
from app.core.permission import require_company_access, require_company_admin

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.get("/")
def list_companies(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
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
            "id": str(c.Company.id),
            "name": c.Company.name,
            "status": c.Company.status,
            "user_count": c.user_count
        }
        for c in query
    ]

# 📌 1. LIST COMPANIES + USER COUNT
@router.get("/{company_id}/users")
def get_company_users(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    require_company_access(db, current_user, company_id)

    users = (
        db.query(CompanyUser, User)
        .join(User, User.id == CompanyUser.user_id)
        .filter(CompanyUser.company_id == company_id)
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


# 📌 2. CREATE COMPANY (GIỮ NGUYÊN)
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


# 📌 3. UPDATE COMPANY (GIỮ NGUYÊN)
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


# 📌 5. ASSIGN USER (GIỮ NGUYÊN CHECK ROLE)
@router.post("/{company_id}/users")
def assign_user_to_company(
    company_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    user_id = payload.get("user_id")
    role = payload.get("role")

    if not user_id or not role:
        raise HTTPException(status_code=400, detail="Missing user_id or role")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    if mapping:
        mapping.role = role
        db.commit()

        return {
            "message": "Updated user role in company",
            "company_id": company_id,
            "user_id": user_id,
            "role": role
        }

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


# 📌 6. REMOVE USER (GIỮ NGUYÊN)
@router.delete("/{company_id}/users/{user_id}")
def remove_user_from_company(
    company_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404)

    db.delete(mapping)
    db.commit()

    return {"message": "Removed"}


#UPDATE ROLE → CHỈ ADMIN
@router.put("/{company_id}/users/{user_id}/role")
def update_user_role_in_company(
    company_id: str,
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    require_company_admin(db, current_user, company_id)

    role = payload.get("role")
    if not role:
        raise HTTPException(status_code=400)

    mapping = (
        db.query(CompanyUser)
        .filter(
            CompanyUser.company_id == company_id,
            CompanyUser.user_id == user_id
        )
        .first()
    )

    if not mapping:
        raise HTTPException(status_code=404)

    mapping.role = role
    db.commit()

    return {"message": "Role updated"}