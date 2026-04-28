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
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Notification)

    # 🔥 phân quyền
    if current_user.role != "superadmin":
        query = query.filter(
            Notification.company_id == current_user.company_id
        )

    items = (
        query
        .order_by(Notification.created_at.desc())
        .limit(50)  # 🔥 tránh load quá nặng
        .all()
    )

    result = []

    for n in items:
        is_read = n.status != "new"

        result.append(NotificationWithAction(
            id=str(n.id),
            type=n.type,
            title=n.title,
            content=n.content,
            is_read=is_read,
            created_at=n.created_at.isoformat(),
            conversation_id=str(n.message_id) if n.message_id else None
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