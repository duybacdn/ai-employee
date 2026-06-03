from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.models.core import User, CompanyUser, Company, UserAssignment, Channel, Employee
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

        perms = db.query(UserAssignment).filter(
            UserAssignment.user_id == u.id
        ).all()

        channels = [str(p.channel_id) for p in perms if p.channel_id]
        employees = [str(p.employee_id) for p in perms if p.employee_id]

        result.append({
            "id": str(u.id),
            "email": u.email,
            "is_superadmin": u.is_superadmin,
            "role": "superadmin" if u.is_superadmin else role,
            "companies": [c.name for c in companies],

            # 🔥 ADD THIS
            "permissions": {
                "channels": channels,
                "employees": employees
            }
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

    db.query(UserAssignment).filter(
        UserAssignment.user_id == user_id,
        UserAssignment.company_id.in_(admin_company_ids)
    ).delete()

    db.query(CompanyUser).filter(
        CompanyUser.user_id == user_id
    ).delete()

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
    company_id = uuid.UUID(payload.get("company_id"))

    if not is_superadmin(current_user):
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        if company_id not in admin_company_ids:
            raise HTTPException(status_code=403)

    company_id = payload.get("company_id")
    role_str = payload.get("role", "staff")

    if role_str not in ["admin", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    role = UserRole.ADMIN if role_str == "admin" else UserRole.STAFF

    company = db.query(Company).filter(
        Company.id == company_id
    ).first()
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
    permissions = payload.get("permissions", {})

    mapping = CompanyUser(
        user_id=user.id,
        company_id=company.id,
        role=role
    )

    db.add(mapping)
    # =========================
    # 🔥 HANDLE PERMISSION
    # =========================

    if role == UserRole.STAFF:
        channel_ids = permissions.get("channels", [])
        employee_ids = permissions.get("employees", [])

        for cid in channel_ids:
            db.add(UserAssignment(
                user_id=user.id,
                company_id=company.id,
                channel_id=cid,
            ))

        for eid in employee_ids:
            db.add(UserAssignment(
                user_id=user.id,
                company_id=company.id,
                employee_id=eid,
            ))
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
    # =========================
    # 1. VALIDATE INPUT
    # =========================
    role_str = payload.get("role")
    company_id = payload.get("company_id")
    permissions = payload.get("permissions", {})

    if role_str not in ["admin", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    if not company_id:
        raise HTTPException(status_code=400, detail="Missing company_id")

    try:
        user_uuid = uuid.UUID(user_id)
        company_uuid = uuid.UUID(company_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    # =========================
    # 2. CHECK USER
    # =========================
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot modify superadmin")

    # =========================
    # 3. CHECK COMPANY
    # =========================
    company = db.query(Company).filter(
        Company.id == company_uuid,
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # =========================
    # 4. CHECK PERMISSION (ADMIN SCOPE)
    # =========================
    if current_user.role != "superadmin":
        admin_company_ids = get_admin_company_ids(db, current_user.id)

        if str(company_uuid) not in admin_company_ids:
            raise HTTPException(status_code=403, detail="No permission")

    # =========================
    # 5. CHECK USER BELONG TO COMPANY
    # =========================
    cu = db.query(CompanyUser).filter(
        CompanyUser.user_id == user_uuid,
        CompanyUser.company_id == company_uuid
    ).first()

    if not cu:
        raise HTTPException(status_code=400, detail="User not in this company")

    # =========================
    # 6. UPDATE ROLE
    # =========================
    new_role = UserRole.ADMIN if role_str == "admin" else UserRole.STAFF

    cu.role = new_role

    # =========================
    # 7. RESET PERMISSION (THEO COMPANY)
    # =========================
    db.query(UserAssignment).filter(
        UserAssignment.user_id == user_uuid,
        UserAssignment.company_id == company_uuid   # 🔥 FIX QUAN TRỌNG
    ).delete()

    # =========================
    # 8. INSERT PERMISSION (STAFF ONLY)
    # =========================
    if new_role == UserRole.STAFF:
        channel_ids = permissions.get("channels", [])
        employee_ids = permissions.get("employees", [])

        # 🔥 validate channel thuộc company
        valid_channels = db.query(Channel.id).filter(
            Channel.id.in_(channel_ids),
            Channel.company_id == company_uuid
        ).all()
        valid_channel_ids = [c[0] for c in valid_channels]

        # 🔥 validate employee thuộc company
        valid_employees = db.query(Employee.id).filter(
            Employee.id.in_(employee_ids),
            Employee.company_id == company_uuid
        ).all()
        valid_employee_ids = [e[0] for e in valid_employees]

        # INSERT CHANNEL PERMISSION
        for cid in valid_channel_ids:
            db.add(UserAssignment(
                user_id=user_uuid,
                company_id=company_uuid,
                channel_id=cid,
            ))

        # INSERT EMPLOYEE PERMISSION
        for eid in valid_employee_ids:
            db.add(UserAssignment(
                user_id=user_uuid,
                company_id=company_uuid,
                employee_id=eid,
            ))

    db.commit()

    return {
        "message": "Role & permission updated",
        "user_id": str(user_uuid),
        "company_id": str(company_uuid),
        "role": role_str,
        "channels": permissions.get("channels", []),
        "employees": permissions.get("employees", []),
    }


@router.get("/company/{company_id}/permissions")
def get_company_users_with_permissions(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    if not is_superadmin(current_user):
        admin_company_ids = get_admin_company_ids(
            db,
            current_user.id
        )

        if company.id not in admin_company_ids:
            raise HTTPException(status_code=403)

    users = (
        db.query(User)
        .join(
            CompanyUser,
            CompanyUser.user_id == User.id
        )
        .filter(
            CompanyUser.company_id == company.id
        )
        .order_by(User.email.asc())
        .all()
    )

    result = []

    for user in users:

        company_user = (
            db.query(CompanyUser)
            .filter(
                CompanyUser.company_id == company.id,
                CompanyUser.user_id == user.id
            )
            .first()
        )

        assignments = (
            db.query(UserAssignment)
            .filter(
                UserAssignment.user_id == user.id,
                UserAssignment.company_id == company.id
            )
            .all()
        )

        result.append({
            "user_id": str(user.id),
            "email": user.email,
            "role": (
                "superadmin"
                if user.is_superadmin
                else company_user.role.name.lower()
            ),
            "permissions": {
                "channels": [
                    str(a.channel_id)
                    for a in assignments
                    if a.channel_id
                ],
                "employees": [
                    str(a.employee_id)
                    for a in assignments
                    if a.employee_id
                ]
            }
        })

    return result

@router.get("/company/{company_id}/permission-options")
def get_permission_options(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    company = db.query(Company).filter(
        Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(status_code=404)

    if not is_superadmin(current_user):
        admin_company_ids = get_admin_company_ids(
            db,
            current_user.id
        )

        if company.id not in admin_company_ids:
            raise HTTPException(status_code=403)

    channels = db.query(Channel).filter(
        Channel.company_id == company.id
    ).all()

    employees = db.query(Employee).filter(
        Employee.company_id == company.id
    ).all()

    return {
        "channels": [
            {
                "id": str(c.id),
                "name": c.name
            }
            for c in channels
        ],
        "employees": [
            {
                "id": str(e.id),
                "name": e.name
            }
            for e in employees
        ]
    }