from .base import BaseSchema


class LoginRequest(BaseSchema):
    email: str
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class CurrentUser(BaseSchema):
    id: str
    email: str
    role: str
    company_id: str


class MeResponse(CurrentUser):
    pass