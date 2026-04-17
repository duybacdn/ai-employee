import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.core import User, Company, CompanyUser
from app.models.enums import CompanyStatus, UserRole
from app.core.security import hash_password

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(bind=engine)

EMAIL = os.getenv("ADMIN_EMAIL", "admin@local.test")
PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin123456")


def main():
    db = SessionLocal()

    # 1 company demo
    company = db.query(Company).filter(Company.name == "Demo Company").first()
    if not company:
        company = Company(name="Demo Company", status=CompanyStatus.ACTIVE)
        db.add(company)
        db.commit()
        db.refresh(company)

    # 1 admin user
    user = db.query(User).filter(User.email == EMAIL).first()
    if not user:
        user = User(email=EMAIL, password_hash=hash_password(PASSWORD))
        db.add(user)
        db.commit()
        db.refresh(user)

    # map user -> company
    link = (
        db.query(CompanyUser)
        .filter(CompanyUser.company_id == company.id, CompanyUser.user_id == user.id)
        .first()
    )
    if not link:
        db.add(CompanyUser(company_id=company.id, user_id=user.id))
        db.commit()

    print("✅ Admin ready")
    print("email:", EMAIL)
    print("password:", PASSWORD)
    print("company_id:", company.id)
    print("user_id:", user.id)


if __name__ == "__main__":
    main()
