from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.core import Notification
from app.schemas.notification import NotificationOut, NotificationWithAction

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
    # PHÂN QUYỀN
    # =========================
    if current_user.role != "superadmin":
        query = query.filter(
            Notification.company_id == current_user.company_id
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
            content=n.content,
            is_read=n.status != "new",
            created_at=n.created_at.isoformat(),
            conversation_id=str(n.conversation_id) if n.conversation_id else None
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
    query = db.query(Notification).filter(Notification.id == notification_id)

    if current_user.role != "superadmin":
        query = query.filter(
            Notification.company_id == current_user.company_id
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
        query = query.filter(
            Notification.company_id == current_user.company_id
        )

    query.update({"status": "seen"})
    db.commit()

    return {"success": True}