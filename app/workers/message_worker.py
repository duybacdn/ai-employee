import datetime
import json

from app.db.session import SessionLocal
#from app.models.core import Message, MessageDirection, MessageKind, ContactIdentity
#from app.models.enums import Platform
from app.models.core import (
    Message,
    MessageDirection,
    MessageKind,
    ContactIdentity,
    AnswerCandidate
)

from app.models.enums import (
    Platform,
    AutoReplyMode,
    CandidateStatus
)
from app.services.ai_service import call_ai, build_prompt
from app.services.facebook_service import send_message, reply_comment
from app.services.qdrant_service import search_knowledge
from app.services.embedding_service import get_embedding
from app.services.qdrant_service import search_knowledge_by_vector
from app.services.employee_router import select_employee_for_channel
#from app.models.enums import AutoReplyMode
from app.utils.deduplicate import is_duplicate
from app.utils.cache import make_cache_key, get_cache, set_cache

# 🔥 FIX parser
def parse_ai_response(ai_response: str):
    try:
        data = json.loads(ai_response)

        reply = (
            data.get("reply")
            or data.get("answer")
            or data.get("response")
        )

        if not reply:
            raise ValueError("No reply field")

        return {
            "reply": reply.strip(),
            "classification": data.get("classification", "inbox"),
            "tags": data.get("tags", [])
        }

    except Exception as e:
        print("❌ JSON parse failed:", e)
        print("RAW:", ai_response)

        return {
            "reply": ai_response.strip(),  # 🔥 fallback cực quan trọng
            "classification": "inbox",
            "tags": []
        }


def map_classification(value: str):
    value = value.lower()

    if value == "comment":
        return MessageKind.COMMENT
    elif value == "system":
        return MessageKind.SYSTEM
    else:
        return MessageKind.INBOX


# 🔥 DEFAULT EMPLOYEE
#DEFAULT_EMPLOYEE_ID = "8f0aa3ac-41c3-480d-bc16-e735179b58c6"

def process_incoming_message(message_id: str):
    print(f"🔧 Processing message {message_id}")

    db = SessionLocal()

    try:
        message = db.query(Message).filter(Message.id == message_id).first()

        if not message:
            print("❌ Message not found")
            return

        # 🔥 CHỐNG LOOP
        if message.direction != MessageDirection.INBOUND:
            print("⚠️ Skip self message")
            return

        print("=== USER MESSAGE ===", message.text)

        # ================================
        # ROUTE EMPLOYEE
        # ================================
        mapping = select_employee_for_channel(db, message.channel_id)

        if not mapping:
            print("⚠️ No employee")
            return

        mode = mapping.autoreply_mode
        employee = mapping.employee

        print(f"🤖 MODE: {mode}")

        # ================================
        # OFF MODE → STOP NGAY
        # ================================
        if mode == AutoReplyMode.OFF:
            print("⛔ OFF MODE")
            return

        # ================================
        # ANTI DUPLICATE
        # ================================
        dedup_key = f"msg:{message.external_message_id or message.id}"

        if is_duplicate(dedup_key):
            print("⚠️ Duplicate")
            return

        # ================================
        # RAG + AI (CHUNG AUTO + REVIEW)
        # ================================
        query_vector = get_embedding(message.text)

        knowledge_list = search_knowledge_by_vector(
            vector=query_vector,
            company_id=str(message.company_id)
        )[:3]

        prompt = build_prompt(
            message.text,
            knowledge_list,
            employee=employee
        )

        ai_response = call_ai(prompt)
        parsed = parse_ai_response(ai_response)

        reply_text = parsed["reply"]
        classification = parsed["classification"]
        tags = parsed["tags"]

        if not reply_text:
            print("❌ Empty reply")
            return

        # ================================
        # AUTO MODE
        # ================================
        if mode == AutoReplyMode.AUTO:

            print("🟢 AUTO MODE")

            # 1. gửi luôn
            identity = (
                db.query(ContactIdentity)
                .filter_by(
                    contact_id=message.contact_id,
                    platform=Platform.FACEBOOK,
                    company_id=message.company_id
                )
                .first()
            )

            if identity:
                psid = identity.external_user_id

                if message.kind == MessageKind.COMMENT:
                    reply_comment(
                        db=db,
                        channel_id=message.channel_id,
                        comment_id=message.external_message_id,
                        text=reply_text,
                    )
                else:
                    send_message(db, message.channel_id, psid, reply_text)

            # 2. outbound message
            outbound = Message(
                company_id=message.company_id,
                conversation_id=message.conversation_id,
                channel_id=message.channel_id,
                contact_id=message.contact_id,
                direction=MessageDirection.OUTBOUND,
                kind=message.kind,
                text=reply_text,
                employee_id=employee.id,
            )
            db.add(outbound)

            # 3. candidate vẫn lưu
            candidate = AnswerCandidate(
                company_id=message.company_id,
                message_id=message.id,
                employee_id=employee.id,
                draft_text=reply_text,
                status=CandidateStatus.PENDING,
            )
            db.add(candidate)

            db.commit()
            return

        # ================================
        # REVIEW MODE
        # ================================
        if mode == AutoReplyMode.REVIEW:

            print("🟡 REVIEW MODE")

            candidate = AnswerCandidate(
                company_id=message.company_id,
                message_id=message.id,
                employee_id=employee.id,
                draft_text=reply_text,
                status=CandidateStatus.PENDING,
            )

            db.add(candidate)
            db.commit()
            return

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")

    finally:
        db.close()