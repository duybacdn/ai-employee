from .base import BaseSchema
from uuid import UUID
from datetime import datetime
from typing import Optional


class ContactOut(BaseSchema):
    id: str
    display_name: str | None = None
    created_at: str

class ContactBaseSchema(BaseSchema):
    company_id: UUID
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None  # 🔥 mới

class ContactCreateSchema(ContactBaseSchema):
    pass

class ContactUpdateSchema(ContactBaseSchema):
    pass

class ContactReadSchema(ContactBaseSchema):
    id: UUID
    created_at: datetime

    class Config:
        orm_mode = True