from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
import uuid

from app.core.auth_guard import get_current_user
from app.core.database import get_db
from app.models.core import KnowledgeItem
from app.services.knowledge_sync_service import (
    sync_create_knowledge,
    sync_update_knowledge,
    sync_delete_knowledge,
)
from app.schemas.auth import CurrentUser
from app.schemas.knowledge import (
    KnowledgeCreate,
    KnowledgeUpdate,
    KnowledgeOut,
    KnowledgeDeleteResponse,
    KnowledgeResyncResponse
)

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


# =========================
# SAFE SYNC WRAPPERS
# =========================
def safe_sync_create(item):
    try:
        sync_create_knowledge(item)
    except Exception as e:
        print("❌ Sync CREATE error:", e)


def safe_sync_update(item):
    try:
        sync_update_knowledge(item)
    except Exception as e:
        print("❌ Sync UPDATE error:", e)


def safe_sync_delete(item_id):
    try:
        sync_delete_knowledge(item_id)
    except Exception as e:
        print("❌ Sync DELETE error:", e)


# =========================
# GET (MULTI-TENANT + FILTER)
# =========================
@router.get("/", response_model=list[KnowledgeOut])
def get_knowledge_items(
    company_id: str = Query(None),
    employee_id: str = Query(None),
    channel_id: str = Query(None),  # reserved (future via message join)
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(KnowledgeItem)

    # =========================
    # SCOPING (VERY IMPORTANT)
    # =========================
    if not is_superadmin:
        if not current_user.company_id:
            raise HTTPException(status_code=403, detail="No company access")

        query = query.filter(
            KnowledgeItem.company_id == uuid.UUID(current_user.company_id)
        )
    else:
        # superadmin can filter cross-company
        if company_id:
            query = query.filter(KnowledgeItem.company_id == company_id)

    # =========================
    # FILTER BY AI EMPLOYEE
    # =========================
    if employee_id:
        query = query.filter(KnowledgeItem.employee_id == employee_id)

    # =========================
    # CHANNEL FILTER (FUTURE SAFE)
    # =========================
    # NOTE: hiện KnowledgeItem chưa có channel_id
    # sẽ cần join message/conversation nếu muốn bật
    # giữ placeholder để UI không vỡ

    items = query.order_by(KnowledgeItem.created_at.desc()).all()

    return [
        KnowledgeOut(
            id=str(i.id),
            title=i.title,
            content=i.content,
            employee_id=str(i.employee_id) if i.employee_id else None,
            source=i.source,
            created_at=i.created_at.isoformat()
        )
        for i in items
    ]


# =========================
# CREATE (TENANT SAFE)
# =========================
@router.post("/", response_model=KnowledgeOut)
def create_knowledge(
    payload: KnowledgeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    # =========================
    # COMPANY SCOPING
    # =========================
    if is_superadmin:
        company_id = (
            uuid.UUID(payload.company_id)
            if getattr(payload, "company_id", None)
            else None
        )
    else:
        if not current_user.company_id:
            raise HTTPException(status_code=403, detail="No company access")

        company_id = uuid.UUID(current_user.company_id)

    item = KnowledgeItem(
        title=payload.title,
        content=payload.content,
        employee_id=uuid.UUID(payload.employee_id) if payload.employee_id else None,
        company_id=company_id,
        source="manual",
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    background_tasks.add_task(safe_sync_create, item)

    return KnowledgeOut(
        id=str(item.id),
        title=item.title,
        content=item.content,
        employee_id=str(item.employee_id) if item.employee_id else None,
        source=item.source,
        created_at=item.created_at.isoformat()
    )


# =========================
# UPDATE
# =========================
@router.put("/{id}", response_model=KnowledgeOut)
def update_knowledge(
    id: str,
    payload: KnowledgeUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    try:
        item_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")

    query = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_uuid)

    if not is_superadmin:
        query = query.filter(
            KnowledgeItem.company_id == uuid.UUID(current_user.company_id)
        )

    item = query.first()

    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    item.title = payload.title
    item.content = payload.content
    item.employee_id = uuid.UUID(payload.employee_id) if payload.employee_id else None

    db.commit()
    db.refresh(item)

    background_tasks.add_task(safe_sync_update, item)

    return KnowledgeOut(
        id=str(item.id),
        title=item.title,
        content=item.content,
        employee_id=str(item.employee_id) if item.employee_id else None,
        source=item.source,
        created_at=item.created_at.isoformat()
    )


# =========================
# DELETE
# =========================
@router.delete("/{id}", response_model=KnowledgeDeleteResponse)
def delete_knowledge(
    id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    try:
        item_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")

    query = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_uuid)

    if not is_superadmin:
        query = query.filter(
            KnowledgeItem.company_id == uuid.UUID(current_user.company_id)
        )

    item = query.first()

    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    item_id = str(item.id)

    db.delete(item)
    db.commit()

    background_tasks.add_task(safe_sync_delete, item_id)

    return KnowledgeDeleteResponse(
        success=True,
        deleted_id=item_id
    )


# =========================
# RESYNC (SAFE REBUILD VECTOR)
# =========================
@router.post("/resync", response_model=KnowledgeResyncResponse)
def resync_knowledge(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    is_superadmin = current_user.role == "superadmin"

    query = db.query(KnowledgeItem)

    if not is_superadmin:
        query = query.filter(
            KnowledgeItem.company_id == uuid.UUID(current_user.company_id)
        )

    items = query.all()

    for item in items:
        # ⚠️ dùng update thay vì create để tránh duplicate vector
        background_tasks.add_task(safe_sync_update, item)

    return KnowledgeResyncResponse(
        message=f"Resync started for {len(items)} knowledge items",
        total=len(items)
    )