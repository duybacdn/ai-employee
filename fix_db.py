from app.core.database import SessionLocal
from app.models.core import User
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()

email = "admin@gmail.com"
password = "admin123"

hashed_password = pwd_context.hash(password)

user = User(
    id=uuid.uuid4(),
    email=email,
    password_hash=hashed_password,
    is_superadmin=True,
    role="admin"
)

db.add(user)
db.commit()

print("✅ Admin created:", email)