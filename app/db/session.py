# app/db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()  # 🔥 THÊM DÒNG NÀY

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()  # 🔥 DUY NHẤT

# tiện lợi: get_db generator
from sqlalchemy.orm import Session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()