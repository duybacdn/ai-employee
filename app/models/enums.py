import enum


class CompanyStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class UserRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"


class Platform(str, enum.Enum):
    FACEBOOK = "facebook"
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageKind(str, enum.Enum):
    COMMENT = "comment"
    INBOX = "inbox"
    SYSTEM = "system"


class ConversationStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class CandidateStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AIRunStatus(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"


class AutoReplyMode(str, enum.Enum):
    OFF = "off"
    REVIEW = "review"
    AUTO = "auto"
