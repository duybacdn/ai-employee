from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, decode_access_token
from app.models.core import User
from app.schemas.auth import LoginRequest, TokenResponse, MeResponse, CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=True)


from app.models.core import CompanyUser

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # 🔥 LẤY DANH SÁCH COMPANY
    company_ids = (
        db.query(CompanyUser.company_id)
        .filter(CompanyUser.user_id == user.id)
        .all()
    )

    company_ids = [str(c[0]) for c in company_ids]

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        extra={
            "company_ids": company_ids   # 🔥 FIX QUAN TRỌNG
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }

from app.core.auth_guard import get_current_user

@router.get("/me", response_model=MeResponse)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "company_ids": current_user.company_ids,   # 🔥 chuẩn mới
        "company_id": current_user.company_ids[0] if current_user.company_ids else None  # 👈 optional cho FE cũ
    }
