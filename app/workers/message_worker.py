import datetime
import json

from app.db.session import SessionLocal
from app.models.core import Message, MessageDirection, MessageKind, ContactIdentity
from app.models.enums import Platform
from app.services.ai_service import call_ai, build_prompt
from app.services.facebook_service import send_message, reply_comment
from app.services.qdrant_service import search_knowledge
from app.services.embedding_service import get_embedding
from app.services.qdrant_service import search_knowledge_by_vector
from app.services.employee_router import select_employee_for_channel
from app.models.enums import AutoReplyMode
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

        # 🔥 CHỐNG LOOP TRƯỚC
        if message.direction != MessageDirection.INBOUND:
            print("⚠️ Skip self message (loop prevention)")
            return

        print("=== USER MESSAGE ===", message.text)

        # ================================
        # 🔥 SELECT EMPLOYEE (SAFE)
        # ================================
        mapping = select_employee_for_channel(db, message.channel_id)

        if not mapping:
            print("⚠️ No employee available for this channel")
            return

        # 🔥 CHỐNG DUPLICATE (SAFE NULL)
        dedup_key = f"msg:{message.external_message_id or message.id}"

        if is_duplicate(dedup_key):
            print("⚠️ Duplicate message skipped")
            return

        employee = mapping.employee

        print(f"🤖 ROUTED TO: {employee.name} | mode={mapping.autoreply_mode}")

        if mapping.autoreply_mode == AutoReplyMode.OFF:
            print("⛔ Auto reply OFF")
            return

        # ================================
        # 🔥 RAG
        # ================================
        query_vector = get_embedding(message.text)

        knowledge_list = search_knowledge_by_vector(
            vector=query_vector,
            company_id=str(message.company_id)  # 🔥 đảm bảo tenant
        )[:3]

        print(f"🔍 Found {len(knowledge_list)} knowledge")

        # ================================
        # 🔥 CACHE
        # ================================
        cache_key = make_cache_key(message.text)
        cached_reply = get_cache(cache_key)

        if cached_reply:
            print("⚡ CACHE HIT")

            reply_text = cached_reply
            classification = "inbox"
            tags = []

        else:
            print("🤖 CACHE MISS")

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

            if reply_text:
                set_cache(cache_key, reply_text)

        # ================================
        # VALIDATE
        # ================================
        if not reply_text or not reply_text.strip():
            print("❌ Empty reply, skip")
            return

        message_kind = map_classification(classification)

        # ================================
        # SAVE OUTBOUND MESSAGE
        # ================================
        reply_message = Message(
            company_id=message.company_id,
            conversation_id=message.conversation_id,
            channel_id=message.channel_id,
            contact_id=message.contact_id,
            direction=MessageDirection.OUTBOUND,
            kind=message_kind,
            text=reply_text,
            employee_id=employee.id,
        )

        db.add(reply_message)
        db.flush()

        # ================================
        # SAVE CANDIDATE
        # ================================
        from app.models.core import AnswerCandidate, CandidateStatus

        candidate = AnswerCandidate(
            company_id=message.company_id,
            message_id=message.id,
            employee_id=employee.id,
            draft_text=reply_text,
            status=CandidateStatus.PENDING,
        )

        db.add(candidate)
        db.commit()

        print(f"✅ Candidate saved: {candidate.id}")

        # ================================
        # SEND FACEBOOK (FIX TENANT SAFE)
        # ================================
        identity = (
            db.query(ContactIdentity)
            .filter_by(
                contact_id=message.contact_id,
                platform=Platform.FACEBOOK,
                company_id=message.company_id  # 🔥 FIX QUAN TRỌNG
            )
            .first()
        )

        if not identity:
            print("❌ No Facebook identity found")
            return

        psid = identity.external_user_id

        is_comment = message.kind == MessageKind.COMMENT

        if mapping.autoreply_mode == AutoReplyMode.AUTO:

            if is_comment:
                print("💬 Replying to comment...")

                reply_comment(
                    db=db,
                    channel_id=message.channel_id,
                    comment_id=message.external_message_id,
                    text=reply_text,
                )

                print(f"💬 Replied to comment: {message.external_message_id}")

            else:
                print("📩 Sending inbox message...")

                send_message(
                    db,
                    message.channel_id,
                    psid,
                    reply_text
                )

                print(f"📤 Sent reply to PSID: {psid}")

        else:
            print("📝 REVIEW MODE → not sending")

        print(f"💬 Saved reply: {reply_text}")
        print(f"🏷 Tags: {tags}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")

    finally:
        db.close()