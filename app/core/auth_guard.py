import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.core import User, CompanyUser
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

    try:
        uid = uuid.UUID(user_id)
    except:
        raise HTTPException(status_code=401, detail="Invalid user id")

    user = db.query(User).filter(User.id == uid).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # =========================
    # 🔥 FIX ROLE
    # =========================
    if user.is_superadmin:
        role = "superadmin"
    else:
        cu = db.query(CompanyUser).filter(
            CompanyUser.user_id == user.id
        ).first()

        role = cu.role.value.lower() if cu else "staff"

    # =========================
    # 🔥 COMPANY IDS
    # =========================
    company_ids = [
        str(c.company_id)
        for c in db.query(CompanyUser).filter(
            CompanyUser.user_id == user.id
        ).all()
    ]

    return CurrentUser(
        id=str(user.id),
        role=role,              
        company_ids=company_ids,
        is_superadmin=user.is_superadmin 
    )