from datetime import datetime
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
from app.services.embedding_service import get_embedding
from app.services.qdrant_service import search_knowledge_by_vector
from app.services.employee_router import select_employee_for_channel
#from app.models.enums import AutoReplyMode
from app.utils.deduplicate import is_duplicate
from app.utils.cache import make_cache_key, get_cache, set_cache
from app.utils.text_normalizer import normalize_text
from app.services.context_service import get_conversation_context, get_comment_context
from app.services.context_service import get_post_content

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
        # NEW AI FLOW (CONTEXT + POST + NORMALIZE)
        # ================================

        # 1. NORMALIZE
        normalized_text = normalize_text(message.text)

        # 2. CONTEXT
        if message.kind == MessageKind.COMMENT:
            history = get_comment_context(db, message.conversation_id)
        else:
            history = get_conversation_context(db, message.conversation_id)

        # 3. POST (nếu là comment)
        post_text = None
        if message.kind == MessageKind.COMMENT:
            post_text = get_post_content(db, message.conversation.post_id)

        # 4. EMBEDDING
        query_vector = get_embedding(normalized_text)

        # 5. RAG
        # 5. RAG
        knowledge_list = search_knowledge_by_vector(
            vector=query_vector,
            company_id=str(message.company_id)
        )

        print(f"[RAG] total: {len(knowledge_list)}")

        # filter score nếu có
        filtered = []
        for k in knowledge_list:
            score = k.get("score", 0)
            if score >= 0.65:
                filtered.append(k.get("content"))

        knowledge_list = filtered[:5]

        print(f"[RAG] after: {len(knowledge_list)}")

        # limit lại cho gọn prompt
        knowledge_list = knowledge_list[:5]

        # 6. BUILD PROMPT (🔥 QUAN TRỌNG)
        prompt = build_prompt(
            user_message=normalized_text,
            knowledge_list=knowledge_list,
            employee=employee,
            history=history,
            post=post_text
        )

        print(f"[DEBUG] history: {len(history)}")
        print(f"[DEBUG] post: {'YES' if post_text else 'NO'}")
        print(f"[DEBUG] knowledge: {len(knowledge_list)}")

        # 7. CALL AI
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
            # 🔥 SET is_sent theo mode
            if mapping.autoreply_mode == AutoReplyMode.AUTO:
                candidate.is_sent = True
                candidate.sent_at = datetime.utcnow()
            else:
                candidate.is_sent = False
                candidate.sent_at = None
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