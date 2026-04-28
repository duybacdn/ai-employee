from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_guard import get_current_user
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
def get_notifications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    query = db.query(Notification)

    if current_user.role != "superadmin":
        query = query.filter(
            Notification.company_id == current_user.company_id
        )

    items = query.order_by(Notification.created_at.desc()).all()

    return [
    NotificationOut(
        id=str(n.id),
        type=n.type,
        title=n.title,
        content=n.content,
        is_read=n.is_read,
        created_at=n.created_at.isoformat()
    )
    for n in items
]