from fastapi import APIRouter, Depends
from app.core.auth_guard import get_current_user, require_roles
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/protected", tags=["protected"])


@router.get("/ping")
def ping(
    db=Depends(lambda: None),  # giữ signature tương thích (không dùng permission Depends)
    user: CurrentUser = Depends(get_current_user),
):
    return {
        "ok": True,
        "user": user.email,
        "role": user.role,

        # 🔥 NEW (multi-company chuẩn)
        "company_ids": user.company_ids,

        # 🔥 BACKWARD COMPAT (tránh vỡ frontend cũ)
        "company_id": user.company_ids[0] if user.company_ids else None,
    }


@router.get("/admin-ping")
def admin_ping(user: CurrentUser = Depends(require_roles("admin", "superadmin"))):
    return {
        "ok": True,
        "admin": user.email,
        "role": user.role,

        # 🔥 thêm cho debug / UI
        "company_ids": user.company_ids,
    }