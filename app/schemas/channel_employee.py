from .base import BaseSchema


class ChannelEmployeeOut(BaseSchema):
    id: str
    channel_id: str
    employee_id: str
    autoreply_mode: str
    priority: int
    is_active: bool