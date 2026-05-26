from fastapi import APIRouter, Depends
from app.core.auth_guard import get_current_user, require_roles
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/protected", tags=["protected"])


@router.get("/ping")
def ping(
    db=Depends(lambda: None),
    user: CurrentUser = Depends(get_current_user),
):
    return {
        "ok": True,
        "user": user.email,
        "role": user.role,

        "company_ids": user.company_ids,
        "company_id": user.company_ids[0] if user.company_ids else None,
    }


@router.get("/admin-ping")
def admin_ping(
    db=Depends(lambda: None),
    user: CurrentUser = Depends(get_current_user),
):
    # 🔥 FUNCTION-CALL PERMISSION (KHÔNG Depends)
    require_roles(user, "admin", "superadmin")

    return {
        "ok": True,
        "admin": user.email,
        "role": user.role,
        "company_ids": user.company_ids,
    }