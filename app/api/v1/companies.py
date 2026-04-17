from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.auth_guard import get_current_user
from app.models.core import Company, CompanyUser

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def list_companies(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    companies = (
        db.query(Company)
        .join(CompanyUser, Company.id == CompanyUser.company_id)
        .filter(CompanyUser.user_id == current_user.id)
        .all()
    )

    return companies