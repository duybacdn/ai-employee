from .base import BaseSchema


class CandidateOut(BaseSchema):
    id: str
    draft_text: str
    status: str
    created_at: str
    message_id: str
    message_text: str
    is_sent: bool | None = None
    sent_at: str | None = None
    kind: str


class CandidateApproveRequest(BaseSchema):
    final_text: str


class CandidateActionResponse(BaseSchema):
    success: bool
    knowledge_id: str | None = None