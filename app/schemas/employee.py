from typing import Optional
from .base import BaseSchema


class EmployeeCreate(BaseSchema):
    name: str
    system_prompt: Optional[str] = None
    style_prompt: Optional[str] = None


class EmployeeOut(BaseSchema):
    id: str
    name: str
    system_prompt: Optional[str] = None
    style_prompt: Optional[str] = None
    is_active: bool

class EmployeeUpdate(BaseSchema):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    style_prompt: Optional[str] = None
    is_active: Optional[bool] = None