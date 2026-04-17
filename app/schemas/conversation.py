from .base import BaseSchema


class ConversationOut(BaseSchema):
    id: str
    last_message: str
    updated_at: str