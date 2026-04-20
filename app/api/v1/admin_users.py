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
        raise HTTPException(status_code=403, detail="Not authorized")

    users = (
        db.query(
            User.id,
            User.email,
            User.is_superadmin,
            User.role,
            func.array_agg(Company.name).label("companies")
        )
        .outerjoin(CompanyUser, CompanyUser.user_id == User.id)
        .outerjoin(Company, Company.id == CompanyUser.company_id)
        .group_by(User.id)
        .all()
    )

    return [
        {
            "id": u.id,
            "email": u.email,
            "is_superadmin": u.is_superadmin,
            "role": u.role,
            "companies": u.companies or []
        }
        for u in users
    ]


# 📌 2. RESET PASSWORD
@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    user.password_hash = hash_password("123456")
    db.commit()

    return {"message": "Password reset to 123456"}


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