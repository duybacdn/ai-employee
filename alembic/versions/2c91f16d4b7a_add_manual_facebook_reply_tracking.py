"""add manual facebook reply tracking

Revision ID: 2c91f16d4b7a
Revises: 7e02aa099c02
Create Date: 2026-06-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c91f16d4b7a"
down_revision: Union[str, Sequence[str], None] = "7e02aa099c02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("reply_to_message_id", sa.UUID(), nullable=True))
    op.add_column("messages", sa.Column("source", sa.String(length=32), nullable=True))
    op.add_column("messages", sa.Column("external_sender_id", sa.String(length=255), nullable=True))
    op.add_column("messages", sa.Column("external_recipient_id", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_messages_reply_to_message_id"), "messages", ["reply_to_message_id"], unique=False)
    op.create_index(op.f("ix_messages_source"), "messages", ["source"], unique=False)
    op.create_index(op.f("ix_messages_external_sender_id"), "messages", ["external_sender_id"], unique=False)
    op.create_index(op.f("ix_messages_external_recipient_id"), "messages", ["external_recipient_id"], unique=False)
    op.create_foreign_key(
        "fk_messages_reply_to_message_id_messages",
        "messages",
        "messages",
        ["reply_to_message_id"],
        ["id"],
    )

    op.add_column("knowledge_items", sa.Column("source_message_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_knowledge_items_source_message_id"), "knowledge_items", ["source_message_id"], unique=False)
    op.create_foreign_key(
        "fk_knowledge_items_source_message_id_messages",
        "knowledge_items",
        "messages",
        ["source_message_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_knowledge_items_source_message_id_messages", "knowledge_items", type_="foreignkey")
    op.drop_index(op.f("ix_knowledge_items_source_message_id"), table_name="knowledge_items")
    op.drop_column("knowledge_items", "source_message_id")

    op.drop_constraint("fk_messages_reply_to_message_id_messages", "messages", type_="foreignkey")
    op.drop_index(op.f("ix_messages_external_recipient_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_external_sender_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_source"), table_name="messages")
    op.drop_index(op.f("ix_messages_reply_to_message_id"), table_name="messages")
    op.drop_column("messages", "external_recipient_id")
    op.drop_column("messages", "external_sender_id")
    op.drop_column("messages", "source")
    op.drop_column("messages", "reply_to_message_id")
