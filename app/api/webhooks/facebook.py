from fastapi import APIRouter, Request, Response
import logging

from app.services.parsers.facebook_parser import parse_facebook_event
from app.services.message_service import handle_incoming_message
from app.core.database import SessionLocal
from app.services.comment_service import handle_incoming_comment

router = APIRouter()
logger = logging.getLogger(__name__)

VERIFY_TOKEN = "your_verify_token"


# ✅ VERIFY (GET)
@router.get("/webhook/facebook")
async def verify_webhook(request: Request):
    params = request.query_params

    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == VERIFY_TOKEN
    ):
        return Response(content=params.get("hub.challenge"), media_type="text/plain")

    return Response(content="Verification failed", status_code=403)


@router.post("/webhook/facebook")
async def receive_webhook(request: Request):
    body = await request.json()
    logger.info(f"📩 RAW EVENT: {body}")

    events = parse_facebook_event(body) or []
    logger.info(f"📨 PARSED EVENTS: {events}")

    db = SessionLocal()

    try:
        for ev in events:
            try:
                # =========================
                # 1. VALIDATE
                # =========================
                if not ev.get("sender_id"):
                    logger.warning(f"⚠️ Invalid event skipped: {ev}")
                    continue

                page_id = ev.get("page_id")
                event_type = ev.get("type")

                # 🔥 lấy đúng ID để kiểm tra duplicate
                external_id = ev.get("mid") if event_type == "message" else ev.get("comment_id")
                if not page_id or not external_id:
                    logger.warning(f"⚠️ Missing page_id or id: {ev}")
                    continue

                # =========================
                # 2. DUPLICATE CHECK
                # =========================
                from app.models.core import Message
                existing = db.query(Message).filter(
                    Message.external_message_id == external_id
                ).first()
                if existing:
                    logger.warning(f"⚠️ Duplicate skipped: {external_id}")
                    continue

                # =========================
                # 3. MAP PAGE → COMPANY
                # =========================
                from app.models.core import FacebookPage, Channel
                fb_page = db.query(FacebookPage).filter(
                    FacebookPage.page_id == page_id
                ).first()
                if not fb_page:
                    logger.warning(f"⚠️ Unknown page_id: {page_id}")
                    continue

                channel = db.query(Channel).filter(Channel.id == fb_page.channel_id).first()
                if not channel:
                    logger.error(f"❌ Channel not found for page_id: {page_id}")
                    continue

                logger.info(f"🧠 ROUTING: page={page_id} → company={channel.company_id}")

                # =========================
                # 4. INJECT CONTEXT
                # =========================
                ev["company_id"] = str(channel.company_id)
                ev["channel_id"] = str(channel.id)

                # =========================
                # 5. HANDLE MESSAGE / COMMENT
                # =========================
                if event_type == "message":
                    handle_incoming_message(db, ev)
                elif event_type == "comment":
                    # ❌ BỎ QUA comment do chính page tạo (tránh loop)
                    if ev.get("sender_id") == page_id:
                        logger.warning(f"⚠️ Skip self-comment (loop prevention): {ev}")
                        continue
                    handle_incoming_comment(db, ev)
                else:
                    logger.warning(f"⚠️ Unknown event type: {event_type}")

            except Exception as e:
                logger.error(f"❌ Error processing event {ev}: {e}")

    finally:
        db.close()

    return {"status": "ok"}