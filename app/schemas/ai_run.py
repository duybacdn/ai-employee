from .base import BaseSchema


class AIRunOut(BaseSchema):
    id: str
    message_id: str
    provider: str
    model: str
    status: str
    latency_ms: int | None = None
    created_at: str