import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.core import User
from app.schemas.auth import CurrentUser

bearer = HTTPBearer(auto_error=True)


# =========================
# GET CURRENT USER
# =========================
def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:

    token = creds.credentials
    payload = decode_access_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # validate UUID
    try:
        uid = uuid.UUID(user_id)
    except:
        raise HTTPException(status_code=401, detail="Invalid user id")

    # 🔥 LUÔN query DB (không trust token hoàn toàn)
    user = db.query(User).filter(User.id == uid).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return CurrentUser(
        id=str(user.id),
        role=user.role,
    )


# =========================
# SIMPLE ROLE CHECK (OPTIONAL)
# =========================
def require_roles(current_user: CurrentUser, *roles: str) -> CurrentUser:

    if current_user.role == "superadmin":
        return current_user

    if roles and current_user.role not in roles:
        raise HTTPException(
            status_code=403,
            detail="Forbidden"
        )

    return current_user