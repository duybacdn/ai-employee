from .base import BaseSchema


class FacebookPageCreate(BaseSchema):
    page_id: str
    page_name: str | None = None
    access_token: str | None = None
    channel_id: str


class FacebookPageOut(BaseSchema):
    id: str
    company_id: str
    channel_id: str
    page_id: str
    page_name: str | None = None