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

    # =========================
    # 🔥 ADD QUAN TRỌNG
    # =========================
    kind: str | None = None          # inbox | comment
    post_id: str | None = None
    post_context: str | None = None

    status: str | None = None       # pending | sent | failed


class CommentOut(BaseSchema):
    id: str
    text: str
    direction: str
    kind: str
    created_at: str