from sqlalchemy.orm import Session
from app.models.core import Message, Conversation
from app.models.enums import MessageDirection, MessageKind

def get_conversation_context(db: Session, conversation_id: str, limit: int = 10):
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    # đảo lại đúng timeline
    messages.reverse()

    context = []
    for msg in messages:
        role = "user" if msg.direction == "inbound" else "assistant"

        context.append({
            "role": role,
            "text": msg.text
        })

    print(f"[CONTEXT] loaded {len(context)} messages")

    return context


def get_comment_context(db: Session, conversation_id: str, limit: int = 10):
    # lấy conversation để đảm bảo đúng post scope
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        print(f"[COMMENT CONTEXT] conversation not found: {conversation_id}")
        return []

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.kind == MessageKind.COMMENT   # giữ comment scope
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )

    messages.reverse()

    context = []
    for msg in messages:
        role = (
            "assistant"
            if msg.direction == MessageDirection.OUTBOUND
            else "user"
        )

        context.append({
            "role": role,
            "text": msg.text
        })

    print(f"[COMMENT CONTEXT] loaded {len(context)} messages (post={conversation.post_id})")

    return context