from .base import BaseSchema


class LoginRequest(BaseSchema):
    email: str
    password: str


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"


class CurrentUser(BaseSchema):
    id: str
    email: str | None = None
    role: str
    company_ids: list[str] = []


class MeResponse(BaseSchema):
    id: str
    email: str | None = None
    role: str
    company_ids: list[str]
    company_id: str | None = None   # 👈 thêm để hỗ trợ FE