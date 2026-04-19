from fastapi import APIRouter, Depends
from app.core.auth_guard import get_current_user, require_roles
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/protected", tags=["protected"])


@router.get("/ping")
def ping(user: CurrentUser = Depends(get_current_user)):
    return {
        "ok": True,
        "user": user.email,
        "role": user.role,
        "company_id": user.company_id,
    }


@router.get("/admin-ping")
def admin_ping(user: CurrentUser = Depends(require_roles("admin", "superadmin"))):
    return {
        "ok": True,
        "admin": user.email,
        "role": user.role,
    }