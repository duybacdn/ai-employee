from fastapi import APIRouter, Request, Response
import logging

from app.services.parsers.facebook_parser import parse_facebook_event
from app.services.message_service import handle_incoming_message
from app.services.comment_service import handle_incoming_comment
from app.core.database import SessionLocal

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
    body = await request.json()
    logger.info(f"📩 RAW EVENT: {body}")

    events = parse_facebook_event(body) or []
    logger.info(f"📨 PARSED EVENTS: {events}")
    print("🔥 WEBHOOK HIT")
    print(await request.json())

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
                # 7. HANDLE EVENT
                # =========================
                if event_type == "message":
                    handle_incoming_message(db, ev)

                elif event_type == "comment":
                    handle_incoming_comment(db, ev)

                else:
                    logger.warning(f"⚠️ Unknown event type: {event_type}")

            except Exception as e:
                logger.error(f"❌ Error processing event {ev}: {e}")

    finally:
        db.close()

    return {"status": "ok"}