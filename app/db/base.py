from app.db.session import Base

# 🔥 CHỈ import từ core
from app.models.core import (
    Company,
    User,
    CompanyUser,
    Employee,
    Channel,
    ChannelEmployee,
    Contact,
    ContactIdentity,
    Conversation,
    Message,
    AnswerCandidate,
    KnowledgeItem,
    AIRun,
)