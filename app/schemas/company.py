from .base import BaseSchema


class CompanyOut(BaseSchema):
    id: str
    name: str
    status: str
    created_at: str