from .base import BaseSchema


class UserOut(BaseSchema):
    id: str
    email: str
    role: str