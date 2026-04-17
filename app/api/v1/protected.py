from fastapi import APIRouter, Depends
from app.core.auth_guard import get_current_user, require_roles
from app.models.core import User

router = APIRouter(prefix="/protected", tags=["protected"])

@router.get("/ping")
def ping(user: User = Depends(get_current_user)):
    return {"ok": True, "user": user.email}

@router.get("/admin-ping")
def admin_ping(user: User = Depends(require_roles("admin"))):
    return {"ok": True, "admin": user.email}
