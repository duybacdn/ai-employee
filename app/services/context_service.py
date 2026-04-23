from sqlalchemy.orm import Session
from app.models.core import Message
from app.models.core import Post


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

def get_post_content(db: Session, post_id: str):
    if not post_id:
        return None

    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        print(f"[POST] not found: {post_id}")
        return None

    if not post.content:
        print(f"[POST] empty caption (video case): {post_id}")
        return None

    print(f"[POST] loaded: {post_id}")

    return post.content