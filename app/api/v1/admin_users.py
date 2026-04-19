from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.core import User
from app.core.security import hash_password
from app.core.auth_guard import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


# 📌 1. Xem danh sách user
@router.get("/")
def list_users(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    users = db.query(User).all()
    return [{"id": u.id, "email": u.email} for u in users]


# 📌 2. Reset password
@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password("123456")
    db.commit()

    return {"message": "Password reset to 123456"}


# 📌 3. Xoá user
@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": "User deleted"}