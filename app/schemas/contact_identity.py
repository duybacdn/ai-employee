from .base import BaseSchema


class ContactIdentityOut(BaseSchema):
    id: str
    contact_id: str
    platform: str
    external_user_id: str