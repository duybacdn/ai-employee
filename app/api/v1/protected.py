from fastapi import APIRouter, Depends, HTTPException
from app.core.auth_guard import get_current_user
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/protected", tags=["protected"])


@router.get("/ping")
def ping(
    user: CurrentUser = Depends(get_current_user),
):
    return {
        "ok": True,
        "user_id": user.id,
        "is_superadmin": user.is_superadmin,
    }


@router.get("/admin-ping")
def admin_ping(
    user: CurrentUser = Depends(get_current_user),
):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin required")

    return {
        "ok": True,
        "admin_id": user.id,
    }