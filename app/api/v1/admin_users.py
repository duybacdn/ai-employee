from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.core import User, CompanyUser, Company
from app.core.security import hash_password
from app.core.auth_guard import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


# 📌 1. LIST USERS (GLOBAL + COMPANY INFO)
@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403)

    # 🔥 SUPERADMIN → thấy tất cả
    if current_user.role == "superadmin":
        users = db.query(User).all()

    # 🔥 USER THƯỜNG → chỉ thấy chính mình
    else:
        users = db.query(User).filter(User.id == current_user.id).all()

    result = []

    for u in users:
        companies = (
            db.query(Company.name)
            .join(CompanyUser, Company.id == CompanyUser.company_id)
            .filter(CompanyUser.user_id == u.id)
            .all()
        )

        result.append({
            "id": u.id,
            "email": u.email,
            "is_superadmin": u.is_superadmin,
            "role": u.role,
            "companies": [c.name for c in companies]
        })

    return result


# 📌 2. RESET PASSWORD
@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    # 🔥 CHO PHÉP:
    # - user đổi password chính mình
    # - admin/superadmin đổi cho người khác
    if current_user.id != user_id and current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403)

    new_password = payload.get("password")
    if not new_password:
        raise HTTPException(status_code=400)

    user.password_hash = hash_password(new_password)
    db.commit()

    return {"message": "Password updated"}


# 📌 3. DELETE USER
@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can delete")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    db.query(CompanyUser).filter(CompanyUser.user_id == user_id).delete()

    db.delete(user)
    db.commit()

    return {"message": "User deleted"}

@router.post("/create-with-company")
def create_user_with_company(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    payload:
    {
        "email": "...",
        "password": "...",
        "company_name": "...",
        "role": "admin"
    }
    """

    if current_user.role != "superadmin":
        raise HTTPException(status_code=403)

    # 1. create user
    user = User(
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        is_superadmin=False,
        role="user"
    )
    db.add(user)
    db.flush()  # lấy user.id

    # 2. create company
    company = Company(
        name=payload["company_name"],
        status="active"
    )
    db.add(company)
    db.flush()

    # 3. mapping
    mapping = CompanyUser(
        user_id=user.id,
        company_id=company.id,
        role=payload.get("role", "admin")
    )
    db.add(mapping)

    db.commit()

    return {
        "user_id": user.id,
        "company_id": company.id
    }