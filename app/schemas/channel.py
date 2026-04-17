from .base import BaseSchema


class ChannelOut(BaseSchema):
    id: str
    company_id: str
    platform: str
    name: str | None = None
    is_active: bool
    created_at: str