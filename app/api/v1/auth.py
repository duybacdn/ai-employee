from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, decode_access_token
from app.models.core import User
from app.schemas.auth import LoginRequest, TokenResponse, MeResponse, CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=True)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    token = create_access_token(
        subject=str(user.id),
        role=user.role
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
        "company_id": current_user.company_id if current_user.company_id else None,
        "role": current_user.role
    }
