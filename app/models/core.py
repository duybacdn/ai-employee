import uuid
from datetime import datetime, UTC

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    UniqueConstraint,
    Column
)
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import CompanyStatus, UserRole

def utcnow():
    return datetime.now()
# ========= COMPANY =========

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[CompanyStatus] = mapped_column(
        Enum(CompanyStatus), default=CompanyStatus.ACTIVE, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )


# ========= USER =========

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )

    # 🔐 ROLE
    role = Column(String, nullable=False, default="user")


# ========= COMPANY ↔ USER =========

class CompanyUser(Base):
    __tablename__ = "company_users"
    __table_args__ = (
        UniqueConstraint("company_id", "user_id", name="uq_company_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.STAFF, nullable=False
    )

    company: Mapped["Company"] = relationship()
    user: Mapped["User"] = relationship()

from sqlalchemy import Integer, Text

from app.models.enums import Platform, AutoReplyMode


# ========= EMPLOYEE (AI Agent Profile) =========

class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # Prompt cấu hình cho AI employee (employee-first)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()


# ========= CHANNEL =========

class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    platform: Mapped[Platform] = mapped_column(Enum(Platform), nullable=False)

    webhook_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()

    facebook_page: Mapped["FacebookPage"] = relationship(
        "FacebookPage",
        uselist=False,
        back_populates="channel",
        cascade="all, delete-orphan",
        primaryjoin="Channel.id==FacebookPage.channel_id",
    )


# ========= CHANNEL ↔ EMPLOYEE (mapping + auto mode) =========

class ChannelEmployee(Base):
    __tablename__ = "channel_employees"
    __table_args__ = (
        UniqueConstraint("channel_id", "employee_id", name="uq_channel_employee"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False, index=True
    )

    # OFF / REVIEW / AUTO
    autoreply_mode: Mapped[AutoReplyMode] = mapped_column(
        Enum(AutoReplyMode), default=AutoReplyMode.OFF, nullable=False
    )

    # nếu một kênh có nhiều employee, dùng priority để chọn (0 cao nhất)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    channel: Mapped["Channel"] = relationship()
    employee: Mapped["Employee"] = relationship()

from sqlalchemy import Index

from app.models.enums import (
    MessageDirection,
    MessageKind,
    ConversationStatus,
)


# ========= CONTACT =========

class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)  # 🔥 mới

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()
    identities: Mapped[list["ContactIdentity"]] = relationship(
        "ContactIdentity", back_populates="contact"
    )
    


# ========= CONTACT IDENTITY (platform user id) =========

class ContactIdentity(Base):
    __tablename__ = "contact_identities"
    __table_args__ = (
        UniqueConstraint("company_id", "platform", "external_user_id", name="uq_contact_identity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True
    )

    platform: Mapped[Platform] = mapped_column(Enum(Platform), nullable=False)

    # facebook: PSID, instagram id, ...
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False)

    company: Mapped["Company"] = relationship()
    contact: Mapped["Contact"] = relationship()


# ========= CONVERSATION =========

class Conversation(Base):
    __tablename__ = "conversations"

    __table_args__ = (
        # 🔥 inbox: unique theo contact
        UniqueConstraint(
            "company_id", "channel_id", "contact_id",
            name="uq_conversation_contact"
        ),

        # 🔥 comment: unique theo post
        UniqueConstraint(
            "company_id", "channel_id", "post_id",
            name="uq_conversation_post"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id"),
        nullable=False
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("channels.id"),
        nullable=False
    )

    # 🔥 dùng cho inbox
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id"),
        nullable=True
    )

    # 🔥 dùng cho comment
    post_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus),
        nullable=False
    )

    # 🔥 Facebook page id (string, KHÔNG phải UUID)
    page_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utcnow
    )

    # =========================
    # RELATIONSHIPS
    # =========================
    company: Mapped["Company"] = relationship()
    channel: Mapped["Channel"] = relationship()
    contact: Mapped["Contact"] = relationship()


# ========= MESSAGE =========

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_company_created_at", "company_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True
    )

    direction: Mapped[MessageDirection] = mapped_column(Enum(MessageDirection), nullable=False)
    kind: Mapped[MessageKind] = mapped_column(Enum(MessageKind), nullable=False)

    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Idempotency cho webhook (vd: message id của Facebook)
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # outbound hoặc message “được xử lý bởi employee nào”
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()
    conversation: Mapped["Conversation"] = relationship()
    channel: Mapped["Channel"] = relationship()
    contact: Mapped["Contact"] = relationship()
    employee: Mapped["Employee"] = relationship()


from app.models.enums import CandidateStatus, AIRunStatus


# ========= ANSWER CANDIDATE (pending/approved/rejected) =========

class AnswerCandidate(Base):
    __tablename__ = "answer_candidates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # message inbound gốc
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False, index=True
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False, index=True
    )

    from sqlalchemy import Enum as SAEnum

    status: Mapped[CandidateStatus] = mapped_column(
        SAEnum(
            CandidateStatus,
            values_callable=lambda obj: [e.value for e in obj]  # 👈 FIX QUAN TRỌNG
        ),
        default=CandidateStatus.PENDING,
        nullable=False
    )

    draft_text: Mapped[str] = mapped_column(Text, nullable=False)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    company: Mapped["Company"] = relationship()
    message: Mapped["Message"] = relationship()
    employee: Mapped["Employee"] = relationship()
    reviewer: Mapped["User"] = relationship(foreign_keys=[reviewed_by_user_id])


# ========= KNOWLEDGE ITEM (approved → index Qdrant) =========

class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # knowledge có thể thuộc 1 employee cụ thể (hoặc null nếu chung công ty)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True, index=True
    )

    source_candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("answer_candidates.id"),
        nullable=True,
        index=True
    )

    # manual / approved_candidate / import
    source: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)

    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # sau này upsert Qdrant sẽ lưu point id (hoặc external ref)
    qdrant_point_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()
    employee: Mapped["Employee"] = relationship()


# ========= AI RUN LOG (metrics/token/latency) =========

class AIRun(Base):
    __tablename__ = "ai_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False, index=True
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id"), nullable=False, index=True
    )

    provider: Mapped[str] = mapped_column(String(32), default="openai", nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)

    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[AIRunStatus] = mapped_column(
        Enum(AIRunStatus), default=AIRunStatus.SUCCESS, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    company: Mapped["Company"] = relationship()
    employee: Mapped["Employee"] = relationship()
    message: Mapped["Message"] = relationship()

class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)

    # 🔥 Thêm ForeignKey
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False)

    page_id = Column(String(255), nullable=False, unique=True)
    page_name = Column(String(255))
    access_token = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    channel: Mapped["Channel"] = relationship(
        "Channel",
        uselist=False,
        back_populates="facebook_page",
    )