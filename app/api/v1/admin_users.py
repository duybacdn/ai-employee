from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.core import User, CompanyUser, Company
from app.core.security import hash_password
from app.core.auth_guard import get_current_user
from app.schemas.auth import CurrentUser
from app.core.permission import get_user_scope  # 🔥 NEW

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


# 📌 1. LIST USERS
@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403)

    scope = get_user_scope(db, current_user)

    # 🔥 SUPERADMIN
    if scope["is_superadmin"]:
        users = db.query(User).all()

    # 🔥 ADMIN → chỉ user trong company mình
    else:
        users = (
            db.query(User)
            .join(CompanyUser, CompanyUser.user_id == User.id)
            .filter(CompanyUser.company_id.in_(scope["company_ids"]))
            .distinct()
            .all()
        )

    result = []

    for u in users:
        companies = (
            db.query(Company.name)
            .join(CompanyUser, Company.id == CompanyUser.company_id)
            .filter(CompanyUser.user_id == u.id)
            .all()
        )

        result.append({
            "id": str(u.id),
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

    scope = get_user_scope(db, current_user)

    # 🔥 user tự đổi password OK
    if current_user.id == user_id:
        pass

    # 🔥 SUPERADMIN → OK
    elif scope["is_superadmin"]:
        pass

    # 🔥 ADMIN → chỉ đổi user cùng company
    elif current_user.role == "admin":
        same_company = (
            db.query(CompanyUser)
            .filter(
                CompanyUser.user_id == user_id,
                CompanyUser.company_id.in_(scope["company_ids"])
            )
            .first()
        )

        if not same_company:
            raise HTTPException(status_code=403)

    else:
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
    scope = get_user_scope(db, current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    # 🔥 SUPERADMIN → delete tất cả
    if scope["is_superadmin"]:
        pass

    # 🔥 ADMIN → chỉ delete user trong company mình
    elif current_user.role == "admin":
        same_company = (
            db.query(CompanyUser)
            .filter(
                CompanyUser.user_id == user_id,
                CompanyUser.company_id.in_(scope["company_ids"])
            )
            .first()
        )

        if not same_company:
            raise HTTPException(status_code=403)

    else:
        raise HTTPException(status_code=403)

    db.query(CompanyUser).filter(CompanyUser.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    return {"message": "User deleted"}


# 📌 4. CREATE USER (SUPERADMIN ONLY)
@router.post("/create-with-company")
def create_user_with_company(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    scope = get_user_scope(db, current_user)

    if not scope["is_superadmin"]:
        raise HTTPException(status_code=403)

    company_id = payload.get("company_id")

    if not company_id:
        raise HTTPException(status_code=400, detail="company_id required")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    existed = db.query(User).filter(User.email == payload["email"]).first()
    if existed:
        raise HTTPException(status_code=400, detail="Email already exists")

    role = payload.get("role", "staff")

    user = User(
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        is_superadmin=False,
        role=role
    )

    db.add(user)
    db.flush()

    mapping = CompanyUser(
        user_id=user.id,
        company_id=company.id,
        role=role
    )

    db.add(mapping)

    db.commit()

    return {
        "message": "User created",
        "user_id": user.id,
    }