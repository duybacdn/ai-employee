from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.core import Conversation, Message

router = APIRouter(prefix="/debug", tags=["debug"])


# 🔹 1. Lấy tất cả conversations
@router.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    data = db.query(Conversation).all()
    return data


# 🔹 2. Lấy conversations theo user_id
@router.get("/conversations/{user_id}")
def get_conversation_by_user(user_id: str, db: Session = Depends(get_db)):
    data = db.query(Conversation).filter(Conversation.user_id == user_id).all()
    return data


# 🔹 3. Lấy tất cả messages
@router.get("/messages")
def get_messages(db: Session = Depends(get_db)):
    data = db.query(Message).all()
    return data


# 🔹 4. Lấy messages theo conversation_id
@router.get("/messages/{conversation_id}")
def get_messages_by_conversation(conversation_id: str, db: Session = Depends(get_db)):
    data = db.query(Message).filter(Message.conversation_id == conversation_id).all()
    return data