from .base import BaseSchema


class MessageOut(BaseSchema):
    id: str
    text: str
    direction: str
    content: str
    role: str
    created_at: str

    employee_id: str | None = None
    employee_name: str | None = None

    status: str | None = None

    # 🔥 ADD
    kind: str
    external_id: str | None = None
    parent_id: str | None = None

    post_id: str | None = None
    post_context: str | None = None


class CommentOut(BaseSchema):
    id: str
    text: str
    direction: str
    kind: str
    created_at: str