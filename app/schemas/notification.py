from .base import BaseSchema

class NotificationOut(BaseSchema):
    id: str
    type: str
    title: str
    is_read: bool
    created_at: str


class NotificationCreate(BaseSchema):
    type: str
    title: str
    company_id: str
    contact_id: str | None = None
    message_id: str | None = None


class NotificationMarkRead(BaseSchema):
    is_read: bool = True


class NotificationWithAction(BaseSchema):
    id: str
    type: str
    title: str
    is_read: bool
    created_at: str

    conversation_id: str | None = None
    customer_text: str | None = None
    ai_reply: str | None = None
    customer_name: str | None = None

    channel_name: str | None = None
    company_id: str
    company_name: str | None = None