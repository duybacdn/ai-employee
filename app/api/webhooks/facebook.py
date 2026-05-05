from fastapi import APIRouter, Request, Response
import logging

from app.services.parsers.facebook_parser import parse_facebook_event
from app.services.message_service import handle_incoming_message
from app.services.comment_service import handle_incoming_comment
from app.core.database import SessionLocal
from app.workers.message_worker import process_incoming_message
from app.workers.message_worker import process_incoming_message as process_comment_worker
from app.ws import manager

router = APIRouter()
logger = logging.getLogger(__name__)

VERIFY_TOKEN = "your_verify_token"


# =========================
# VERIFY (GET)
# =========================
@router.get("/webhook/facebook")
async def verify_webhook(request: Request):
    params = request.query_params

    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == VERIFY_TOKEN
    ):
        return Response(content=params.get("hub.challenge"), media_type="text/plain")

    return Response(content="Verification failed", status_code=403)


# =========================
# RECEIVE WEBHOOK (POST)
# =========================
@router.post("/webhook/facebook")
async def receive_webhook(request: Request):
    logger.info("🔥 WEBHOOK HIT")
    body = await request.json()
    logger.info(f"🔥 FULL BODY: {body}")
    logger.info(f"📩 RAW EVENT: {body}")

    events = parse_facebook_event(body) or []
    logger.info(f"📨 PARSED EVENTS: {events}")

    db = SessionLocal()

    try:
        for ev in events:
            try:
                # =========================
                # 1. VALIDATE BASIC
                # =========================
                sender_id = ev.get("sender_id")
                page_id = ev.get("page_id")
                event_type = ev.get("type")

                if not sender_id or not page_id:
                    logger.warning(f"⚠️ Invalid event skipped: {ev}")
                    continue

                # =========================
                # 2. DETECT EVENT ID
                # =========================
                external_id = (
                    ev.get("mid") if event_type == "message"
                    else ev.get("comment_id")
                )

                if not external_id:
                    logger.warning(f"⚠️ Missing external_id: {ev}")
                    continue

                # =========================
                # 3. DUPLICATE CHECK
                # =========================
                from app.models.core import Message

                exists = db.query(Message).filter(
                    Message.external_message_id == external_id
                ).first()

                if exists:
                    logger.warning(f"⚠️ Duplicate skipped: {external_id}")
                    continue

                # =========================
                # 4. MAP PAGE → CHANNEL → COMPANY
                # =========================
                from app.models.core import FacebookPage, Channel

                fb_page = db.query(FacebookPage).filter(
                    FacebookPage.page_id == page_id
                ).first()

                if not fb_page:
                    logger.warning(f"⚠️ Unknown page_id: {page_id}")
                    continue

                channel = db.query(Channel).filter(
                    Channel.id == fb_page.channel_id
                ).first()

                if not channel:
                    logger.error(f"❌ Channel not found for page_id: {page_id}")
                    continue

                # ❗ CRITICAL: chỉ xử lý channel active
                if not channel.is_active:
                    logger.warning(f"⚠️ Channel inactive: {channel.id}")
                    continue

                logger.info(
                    f"🧠 ROUTING: page={page_id} → company={channel.company_id}"
                )

                # =========================
                # 5. INJECT TENANT CONTEXT (CRITICAL)
                # =========================
                ev["company_id"] = str(channel.company_id)
                ev["channel_id"] = str(channel.id)

                # =========================
                # 6. PREVENT SELF LOOP
                # =========================
                if sender_id == page_id:
                    logger.warning(f"⚠️ Skip self event (loop prevention): {ev}")
                    continue

                # =========================
                # 7. HANDLE EVENT (FINAL)
                # =========================

                # 🔥 detect thật (không tin parser hoàn toàn)
                event_type = ev.get("type")

                is_comment = event_type == "comment" or ev.get("comment_id")
                is_message = event_type == "message" or ev.get("mid")

                logger.warning({
                    "detect_comment": bool(is_comment),
                    "detect_message": bool(is_message),
                    "comment_id": ev.get("comment_id"),
                    "mid": ev.get("mid"),
                    "post_id": ev.get("post_id"),
                })

                msg = None

                # =========================
                # HANDLE MESSAGE
                # =========================
                if is_message and not is_comment:
                    msg = handle_incoming_message(db, ev)

                # =========================
                # HANDLE COMMENT
                # =========================
                elif is_comment:
                    msg = handle_incoming_comment(db, ev)

                else:
                    logger.warning(f"⚠️ Unknown event format: {ev}")
                    continue

                # =========================
                # 🔥 REALTIME PUSH (GIỮ NGUYÊN)
                # =========================
                if msg:
                    manager.broadcast(
                        str(msg.conversation_id),
                        {
                            "type": "new_message",
                            "message": {
                                "id": str(msg.id),
                                "text": msg.text,
                                "direction": "inbound",
                                "created_at": msg.created_at.isoformat(),
                                "status": "delivered",
                            },
                        },
                    )

            except Exception as e:
                logger.error(f"❌ Error processing event {ev}: {e}")

    finally:
        db.close()

    return {"status": "ok"}