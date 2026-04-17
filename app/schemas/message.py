from .base import BaseSchema


class MessageOut(BaseSchema):
    id: str
    text: str
    direction: str
    content: str
    role: str
    created_at: str

class CommentOut(BaseSchema):
    id: str
    text: str
    direction: str
    kind: str
    created_at: str