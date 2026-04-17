from sqlalchemy.orm import Session
from app.models.core import Message, Conversation

def get_or_create_conversation(db: Session, user_id: str):

    conversation = db.query(Conversation)\
        .filter(Conversation.user_id == user_id)\
        .first()

    if not conversation:
        conversation = Conversation(user_id=user_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    return conversation