from .base import BaseSchema


class KnowledgeCreate(BaseSchema):
    title: str | None = None
    content: str
    employee_id: str | None = None


class KnowledgeUpdate(BaseSchema):
    title: str | None = None
    content: str
    employee_id: str | None = None


class KnowledgeOut(BaseSchema):
    id: str
    title: str | None = None
    content: str
    employee_id: str | None = None
    source: str
    created_at: str


class KnowledgeDeleteResponse(BaseSchema):
    success: bool
    deleted_id: str


class KnowledgeResyncResponse(BaseSchema):
    message: str
    total: int