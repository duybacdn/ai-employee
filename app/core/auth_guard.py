import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.core import User
from app.models.core import CompanyUser
from app.schemas.auth import CurrentUser

bearer = HTTPBearer(auto_error=True)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:

    token = creds.credentials
    payload = decode_access_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user id")

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # =========================
    # SUPER ADMIN GLOBAL ACCESS
    # =========================
    if user.is_superadmin or user.role == "superadmin":
        return CurrentUser(
            id=str(user.id),
            email=user.email,
            role="superadmin",
            company_id=None
        )

    # =========================
    # NORMAL / COMPANY USER
    # =========================
    company_user = (
        db.query(CompanyUser)
        .filter(CompanyUser.user_id == user.id)
        .first()
    )

    if not company_user:
        raise HTTPException(
            status_code=403,
            detail="User does not belong to any company",
        )

    return CurrentUser(
        id=str(user.id),
        email=user.email,
        role=user.role,
        company_id=str(company_user.company_id),
    )

def require_roles(*roles: str):
    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:

        # superadmin luôn pass
        if user.role == "superadmin":
            return user

        if roles and user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )

        return user

    return _dep