from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.core import User, CompanyUser, Company
from app.models.enums import UserRole
from app.core.security import hash_password
from app.core.auth_guard import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


# =========================
# HELPER
# =========================

def is_superadmin(user: CurrentUser):
    return user.is_superadmin


def get_admin_company_ids(db: Session, user_id):
    rows = db.query(CompanyUser.company_id).filter(
        CompanyUser.user_id == user_id,
        CompanyUser.role == UserRole.ADMIN
    ).all()

    return [r[0] for r in rows]


# =========================
# 1. LIST USERS
# =========================

@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    if is_superadmin(current_user):
        users = db.query(User).all()
    else:
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        if not admin_company_ids:
            raise HTTPException(status_code=403)

        users = (
            db.query(User)
            .join(CompanyUser, CompanyUser.user_id == User.id)
            .filter(CompanyUser.company_id.in_(admin_company_ids))
            .distinct()
            .all()
        )

    result = []

    for u in users:
        # 🔥 lấy role theo company (lấy cái đầu tiên)
        cu = db.query(CompanyUser).filter(
            CompanyUser.user_id == u.id
        ).first()

        role = cu.role.name.lower() if cu else None

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
            "role": "superadmin" if u.is_superadmin else role,
            "companies": [c.name for c in companies]
        })

    return result


# =========================
# 2. RESET PASSWORD
# =========================

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

    if current_user.id == user_id:
        pass
    elif is_superadmin(current_user):
        pass
    else:
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        same_company = db.query(CompanyUser).filter(
            CompanyUser.user_id == user_id,
            CompanyUser.company_id.in_(admin_company_ids)
        ).first()

        if not same_company:
            raise HTTPException(status_code=403)

    new_password = payload.get("password")
    if not new_password:
        raise HTTPException(status_code=400)

    user.password_hash = hash_password(new_password)
    db.commit()

    return {"message": "Password updated"}


# =========================
# 3. DELETE USER
# =========================

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    # ❌ Không cho xoá superadmin
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot delete superadmin")

    if not is_superadmin(current_user):
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        same_company = db.query(CompanyUser).filter(
            CompanyUser.user_id == user_id,
            CompanyUser.company_id.in_(admin_company_ids)
        ).first()

        if not same_company:
            raise HTTPException(status_code=403)

    db.query(CompanyUser).filter(CompanyUser.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    return {"message": "User deleted"}


# =========================
# 4. CREATE USER
# =========================

@router.post("/create-with-company")
def create_user_with_company(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if not is_superadmin(current_user):
        raise HTTPException(status_code=403)

    company_id = payload.get("company_id")
    role_str = payload.get("role", "staff")

    if role_str not in ["admin", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    role = UserRole.ADMIN if role_str == "admin" else UserRole.STAFF

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404)

    existed = db.query(User).filter(User.email == payload["email"]).first()
    if existed:
        raise HTTPException(status_code=400)

    user = User(
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        is_superadmin=False
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


# =========================
# 5. UPDATE ROLE
# =========================

@router.put("/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404)

    # ❌ Không cho sửa superadmin
    if user.is_superadmin:
        raise HTTPException(status_code=403)

    role_str = payload.get("role")
    if role_str not in ["admin", "staff"]:
        raise HTTPException(status_code=400)

    new_role = UserRole.ADMIN if role_str == "admin" else UserRole.STAFF

    if not is_superadmin(current_user):
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        same_company = db.query(CompanyUser).filter(
            CompanyUser.user_id == user_id,
            CompanyUser.company_id.in_(admin_company_ids)
        ).first()

        if not same_company:
            raise HTTPException(status_code=403)

    db.query(CompanyUser).filter(
        CompanyUser.user_id == user_id
    ).update({
        CompanyUser.role: new_role
    })

    db.commit()

    return {
        "message": "Role updated",
        "user_id": user.id,
        "new_role": role_str
    }