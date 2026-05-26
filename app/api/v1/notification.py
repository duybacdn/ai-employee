from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Notification
from app.schemas.notification import NotificationWithAction
from app.core.permission import require_company_access

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# =========================
# GET LIST
# =========================
@router.get("/", response_model=list[NotificationWithAction])
def get_notifications(
    priority: str | None = None,
    unread_only: bool = False,   # 🔥 NEW
    limit: int = 20,             # 🔥 NEW

    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Notification)

    # =========================
    # PHÂN QUYỀN (FIXED)
    # =========================
    if current_user.role != "superadmin":
        if not current_user.company_ids:
            raise HTTPException(403, "No company access")

        # 🔥 FIX: enforce company access (function-call permission)
        for cid in current_user.company_ids:
            require_company_access(db, current_user, cid)

        query = query.filter(
            Notification.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    # =========================
    # FILTER PRIORITY
    # =========================
    if priority:
        query = query.filter(Notification.priority == priority)

    # =========================
    # 🔥 FILTER UNREAD
    # =========================
    if unread_only:
        query = query.filter(Notification.status == "new")

    # =========================
    # QUERY
    # =========================
    items = (
        query
        .order_by(Notification.created_at.desc())
        .limit(limit)   # 🔥 dùng dynamic limit
        .all()
    )

    result = []

    for n in items:
        result.append(NotificationWithAction(
            id=str(n.id),
            type=n.type,
            title=n.title,
            is_read=n.status != "new",
            created_at=n.created_at.isoformat(),

            conversation_id=str(n.conversation_id) if n.conversation_id else None,

            # 🔥 ADD 2 FIELD NÀY
            message_id=str(n.message_id) if hasattr(n, "message_id") and n.message_id else None,
            channel_id=str(n.channel_id) if hasattr(n, "channel_id") and n.channel_id else None,

            customer_name=n.contact.display_name if n.contact else None,
            customer_text=n.customer_text,
            ai_reply=n.ai_reply,

            company_id=str(n.company_id),
            company_name=n.company.name if hasattr(n, "company") and n.company else None,
            channel_name=n.channel_name or "Không rõ kênh"
        ))

    return result


# =========================
# MARK AS READ
# =========================
@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(400, "Invalid notification_id")

    query = db.query(Notification).filter(Notification.id == nid)

    if current_user.role != "superadmin":
        if not current_user.company_ids:
            raise HTTPException(403, "No company access")

        # 🔥 FIX: enforce company access
        for cid in current_user.company_ids:
            require_company_access(db, current_user, cid)

        query = query.filter(
            Notification.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    n = query.first()

    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    n.status = "seen"
    db.commit()

    return {"success": True}


# =========================
# MARK ALL AS READ
# =========================
@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Notification)

    if current_user.role != "superadmin":
        if not current_user.company_ids:
            raise HTTPException(403, "No company access")

        # 🔥 FIX: enforce company access
        for cid in current_user.company_ids:
            require_company_access(db, current_user, cid)

        query = query.filter(
            Notification.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

        query.update({"status": "seen"})
        db.commit()

    return {"success": True}