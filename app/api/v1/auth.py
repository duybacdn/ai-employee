from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.core import User, CompanyUser
from app.schemas.auth import LoginRequest, TokenResponse, MeResponse, CurrentUser

from app.core.auth_guard import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# =========================
# LOGIN
# =========================
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # 🔥 lấy company_ids (OPTIMIZATION ONLY)
    company_rows = (
        db.query(CompanyUser.company_id)
        .filter(CompanyUser.user_id == user.id)
        .all()
    )
    company_ids = [str(c[0]) for c in company_rows]

    # =========================
    # 🔥 FIX ROLE (KHÔNG DÙNG user.role NỮA)
    # =========================
    if user.is_superadmin:
        role = "superadmin"
    else:
        # lấy role theo company đầu tiên (fallback staff)
        cu = (
            db.query(CompanyUser)
            .filter(CompanyUser.user_id == user.id)
            .first()
        )

        role = cu.role.value.lower() if cu else "staff"

    token = create_access_token(
        subject=str(user.id),
        role=role,   # ✅ FIX
        extra={
            "company_ids": company_ids
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# =========================
# ME
# =========================
@router.get("/me", response_model=MeResponse)
def me(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == current_user.id).first()

    return {
        "id": str(current_user.id),
        "email": user.email if user else None,
        "role": current_user.role,
        "company_ids": current_user.company_ids,

        # ⚠️ backward compatibility cho FE cũ
        "company_id": current_user.company_ids[0] if current_user.company_ids else None
    }