from datetime import datetime
import json
import re

from app.db.session import SessionLocal
#from app.models.core import Message, MessageDirection, MessageKind, ContactIdentity
#from app.models.enums import Platform
from app.models.core import (
    Message,
    MessageDirection,
    MessageKind,
    ContactIdentity,
    AnswerCandidate,
    Conversation
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
from app.services.notification_service import create_notification

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
    
def extract_keywords(text):

    if not text:
        return set()

    text = text.lower()

    # bỏ ký tự đặc biệt
    text = re.sub(r"[^\w\s]", " ", text)

    words = text.split()

    # stopwords
    STOPWORDS = {
        "và",
        "là",
        "có",
        "không",
        "cho",
        "với",
        "cần",
        "mình",
        "shop",
        "bên",
        "em",
        "anh",
        "chị",
        "ạ",
        "ơi",
        "nha",
        "nhé",
    }

    words = [
        w.strip()
        for w in words
        if len(w.strip()) >= 2
        and w not in STOPWORDS
    ]

    keywords = set(words)

    # ====================================
    # 🔥 ADD 2-WORD PHRASES
    # ====================================

    for i in range(len(words) - 1):

        phrase = f"{words[i]} {words[i+1]}"

        keywords.add(phrase)

    return keywords


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

        if message.direction != MessageDirection.INBOUND:
            print("⚠️ Skip self message")
            return

        print("=== USER MESSAGE ===", message.text)

        mapping = select_employee_for_channel(db, message.channel_id)

        if not mapping:
            print("⚠️ No employee")
            return

        mode = mapping.autoreply_mode
        employee = mapping.employee

        if mode == AutoReplyMode.OFF:
            print("⛔ OFF MODE")
            return

        if is_duplicate(str(message.id)):
            print("⚠️ Duplicate")
            return

        # ================================
        # NORMALIZE
        # ================================
        normalized_text = normalize_text(message.text)

        # ================================
        # CONTEXT
        # ================================
        if message.kind == MessageKind.COMMENT:
            history = get_comment_context(db, message.conversation_id)
        else:
            history = get_conversation_context(db, message.conversation_id)

        post_text = None
        if message.kind == MessageKind.COMMENT and message.conversation:
            post_text = message.conversation.post_context

        # ================================
        # EMBEDDING TEXT
        # ================================
        embedding_text = normalized_text

        if message.kind == MessageKind.COMMENT and post_text:
            embedding_text = f"""
Post:
{normalize_text(post_text)}

Comment:
{normalized_text}
"""

        query_vector = get_embedding(embedding_text)

        # ================================
        # RAG
        # ================================
        knowledge_raw = search_knowledge_by_vector(
            vector=query_vector,
            company_id=str(message.company_id)
        )

        print(f"[RAG] total: {len(knowledge_raw)}")

        # ================================
        # CONTEXT KEYWORDS
        # ================================
        context_keywords = set()
        context_keywords |= extract_keywords(normalized_text)

        if post_text:
            context_keywords |= extract_keywords(post_text)

        print("[RERANK] context keywords:", context_keywords)

        # ================================
        # RERANK
        # ================================
        def score_item(item):
            base = item.get("score", 0)
            content = (item.get("content") or "").lower()

            content_keywords = extract_keywords(content)
            overlap = len(context_keywords & content_keywords)

            bonus = overlap * 0.12
            final = base + bonus

            if overlap == 0 and base < 0.5:
                return -999

            return final

        knowledge_raw.sort(key=score_item, reverse=True)

        # ================================
        # BUILD FINAL KNOWLEDGE LIST (STRING ONLY)
        # ================================
        knowledge_list = []
        used = set()

        for item in knowledge_raw:
            content = (item.get("content") or "").strip()

            if not content:
                continue

            key = content.lower()

            if key in used:
                continue

            used.add(key)
            knowledge_list.append(content)

            print("[RAG] selected:", content[:80])

            if len(knowledge_list) >= 3:
                break

        # ================================
        # BUILD PROMPT (UPDATED)
        # ================================
        prompt = build_prompt(
            user_message=normalized_text,
            knowledge_list=knowledge_list,
            employee=employee,
            history=history,
            post=post_text,
        )

        print(f"[DEBUG] history: {len(history)}")
        print(f"[DEBUG] post: {'YES' if post_text else 'NO'}")
        print(f"[DEBUG] knowledge: {len(knowledge_list)}")

        # ================================
        # CALL AI
        # ================================
        ai_response = call_ai(prompt, employee=employee)
        parsed = parse_ai_response(ai_response)

        reply_text = parsed["reply"]
        classification = parsed["classification"]
        tags = parsed["tags"]

        print("👉 message.conversation_id:", message.conversation_id)
        create_notification(db, message, tags, reply_text)

        if not reply_text:
            print("❌ Empty reply")
            return

        # ================================
        # AUTO MODE
        # ================================
        if mode == AutoReplyMode.AUTO:

            print("🟢 AUTO MODE")

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

            outbound = Message(
                company_id=message.company_id,
                conversation_id=message.conversation_id,
                channel_id=message.channel_id,
                contact_id=message.contact_id,
                direction=MessageDirection.OUTBOUND,
                kind=message.kind,
                text=reply_text,
                employee_id=employee.id,
                parent_comment_id=(
                    message.external_message_id
                    if message.kind == MessageKind.COMMENT
                    else None
                ),
            )
            db.add(outbound)

            candidate = AnswerCandidate(
                company_id=message.company_id,
                message_id=message.id,
                employee_id=employee.id,
                draft_text=reply_text,
                status=CandidateStatus.PENDING,
                is_sent=(mode == AutoReplyMode.AUTO),
                sent_at=datetime.utcnow() if mode == AutoReplyMode.AUTO else None
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