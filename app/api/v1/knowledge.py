from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
import uuid

from app.core.auth_guard import get_current_user
from app.core.database import get_db
from app.models.core import KnowledgeItem, Employee, Company, UserAssignment
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
from app.core.permission import require_company_access, require_employee_access

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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    is_superadmin = current_user.role == "superadmin"

    query = (
        db.query(KnowledgeItem)
        .join(Company, KnowledgeItem.company_id == Company.id)
        .filter(Company.status == "active")
    )

    # =========================
    # SUPERADMIN
    # =========================
    if is_superadmin:
        if company_id:
            query = query.filter(KnowledgeItem.company_id == company_id)

    # =========================
    # ADMIN / STAFF
    # =========================
    # ADMIN / STAFF
    else:
        query = query.filter(
            KnowledgeItem.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

        # 🔥 STAFF → chỉ employee được assign
        if current_user.role == "staff":
            allowed_employee_ids = (
                db.query(UserAssignment.employee_id)
                .filter(
                    UserAssignment.user_id == uuid.UUID(current_user.id),
                    UserAssignment.employee_id.isnot(None)
                )
                .all()
            )

            allowed_employee_ids = [e[0] for e in allowed_employee_ids]

            if not allowed_employee_ids:
                return []

            query = query.filter(
                KnowledgeItem.employee_id.in_(allowed_employee_ids)
            )

        if employee_id and current_user.role == "staff":
            require_employee_access(db, current_user, employee_id)

    # =========================
    # FILTER EMPLOYEE
    # =========================
    if employee_id:
        query = query.filter(KnowledgeItem.employee_id == employee_id)

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
    if not current_user.company_ids:
        raise HTTPException(status_code=400, detail="Missing company_id")

    company_id = uuid.UUID(current_user.company_ids[0])

    company = db.query(Company).filter(
        Company.id == company_id,
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    require_company_access(db, current_user, str(company_id))

    if payload.employee_id:
        require_employee_access(db, current_user, payload.employee_id)

    prefix = "Thông tin"

    knowledge_content = f"""
    {prefix}:
    {clean_text(payload.title)}

    Câu trả lời:
    {clean_text(payload.content)}
    """

    item = KnowledgeItem(
        title=clean_text(payload.title)[:200],
        content=knowledge_content.strip(),
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

    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_uuid).first()
    company = db.query(Company).filter(
        Company.id == item.company_id,
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not active")

    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    if not is_superadmin:
        require_company_access(db, current_user, str(item.company_id))

    item.title = clean_text(payload.title)

    if is_formatted(payload.content):
        item.content = clean_text(payload.content)
    else:
        item.content = f"""
Thông tin:
{clean_text(payload.title)}

Câu trả lời:
{clean_text(payload.content)}
""".strip()

    if payload.employee_id:
        try:
            emp_id = uuid.UUID(payload.employee_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid employee_id")

        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        if current_user.role == "staff":
            require_employee_access(db, current_user, payload.employee_id)

        item.employee_id = emp.id
    else:
        item.employee_id = None

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

    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_uuid).first()
    company = db.query(Company).filter(
        Company.id == item.company_id,
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not active")

    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    if not is_superadmin:
        require_company_access(db, current_user, str(item.company_id))

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
    company_id: str = Query(None),
    employee_id: str = Query(None),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    is_superadmin = current_user.role == "superadmin"

    query = (
        db.query(KnowledgeItem)
        .join(Company, KnowledgeItem.company_id == Company.id)
        .filter(Company.status == "active")
    )

    # =========================
    # PERMISSION
    # =========================
    if not is_superadmin:
        if not current_user.company_ids:
            raise HTTPException(status_code=403, detail="No company access")

        query = query.filter(
            KnowledgeItem.company_id.in_(
                [uuid.UUID(cid) for cid in current_user.company_ids]
            )
        )

    # =========================
    # FILTER (UI)
    # =========================
    if company_id:
        query = query.filter(KnowledgeItem.company_id == company_id)

    if employee_id:
        if current_user.role == "staff":
            require_employee_access(db, current_user, employee_id)

        query = query.filter(KnowledgeItem.employee_id == employee_id)

    items = query.all()

    # =========================
    # SYNC
    # =========================
    for item in items:
        background_tasks.add_task(safe_sync_update, item)

    return KnowledgeResyncResponse(
        message=f"Resync started for {len(items)} knowledge items",
        total=len(items)
    )


def clean_text(t: str):
    return (t or "").strip()


def is_formatted(content: str):
    if not content:
        return False

    return (
        "Câu trả lời:" in content
        and (
            "Khách hỏi:" in content
            or "Thông tin:" in content
        )
    )