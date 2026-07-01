from fastapi import APIRouter, Request, Response
import logging
import requests

from app.services.parsers.facebook_parser import parse_facebook_event
from app.services.message_service import handle_incoming_message
from app.services.comment_service import handle_incoming_comment
from app.services.facebook_outbound_service import (
    handle_outbound_message_echo,
    handle_outbound_comment_reply,
)
from app.core.database import SessionLocal
from app.ws import manager


router = APIRouter()
logger = logging.getLogger(__name__)

VERIFY_TOKEN = "your_verify_token"


def normalize_attachments(raw_attachments):
    if not raw_attachments:
        return None

    results = []

    for att in raw_attachments:
        try:
            att_type = att.get("type")
            payload = att.get("payload", {})
            url = payload.get("url")

            if not url:
                continue

            results.append({
                "type": att_type,
                "url": url,
            })

        except Exception as e:
            print("normalize attachment error:", e)

    return results if results else None


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
    logger.info("WEBHOOK HIT")
    body = await request.json()
    logger.info("FULL BODY: %s", body)

    events = parse_facebook_event(body) or []
    logger.info("PARSED EVENTS: %s", events)

    db = SessionLocal()

    try:
        for ev in events:
            try:
                sender_id = ev.get("sender_id")
                page_id = ev.get("page_id")
                event_type = ev.get("type")
                direction = ev.get("direction") or "inbound"

                if not sender_id or not page_id:
                    logger.warning("Invalid event skipped: %s", ev)
                    continue

                external_id = (
                    ev.get("mid") if event_type == "message"
                    else ev.get("comment_id")
                )

                if not external_id:
                    logger.warning("Missing external_id: %s", ev)
                    continue

                from app.models.core import Message, FacebookPage, Channel

                exists = (
                    db.query(Message)
                    .filter(Message.external_message_id == external_id)
                    .first()
                )

                if exists:
                    logger.warning("Duplicate skipped: %s", external_id)
                    continue

                fb_page = (
                    db.query(FacebookPage)
                    .filter(FacebookPage.page_id == page_id)
                    .first()
                )

                if not fb_page:
                    logger.warning("Unknown page_id: %s", page_id)
                    continue

                ev["sender_name"] = get_fb_user_name(sender_id, fb_page.access_token)

                channel = (
                    db.query(Channel)
                    .filter(Channel.id == fb_page.channel_id)
                    .first()
                )

                if not channel:
                    logger.error("Channel not found for page_id: %s", page_id)
                    continue

                if not channel.is_active:
                    logger.warning("Channel inactive: %s", channel.id)
                    continue

                ev["company_id"] = str(channel.company_id)
                ev["channel_id"] = str(channel.id)

                if direction == "inbound" and sender_id == page_id:
                    logger.warning("Skip self inbound event: %s", ev)
                    continue

                raw_attachments = ev.get("attachments")
                ev["attachments"] = (
                    normalize_attachments(raw_attachments)
                    if raw_attachments
                    else None
                )

                is_comment = event_type == "comment" or ev.get("comment_id")
                is_message = event_type == "message" or ev.get("mid")

                logger.warning({
                    "direction": direction,
                    "detect_comment": bool(is_comment),
                    "detect_message": bool(is_message),
                    "comment_id": ev.get("comment_id"),
                    "mid": ev.get("mid"),
                    "post_id": ev.get("post_id"),
                })

                msg = None

                if is_message and not is_comment:
                    msg = (
                        handle_outbound_message_echo(db, ev)
                        if direction == "outbound"
                        else handle_incoming_message(db, ev)
                    )

                elif is_comment:
                    msg = (
                        handle_outbound_comment_reply(db, ev)
                        if direction == "outbound"
                        else handle_incoming_comment(db, ev)
                    )

                else:
                    logger.warning("Unknown event format: %s", ev)
                    continue

                if msg:
                    await manager.broadcast(
                        str(msg.conversation_id),
                        {
                            "type": "new_message",
                            "message": {
                                "id": str(msg.id),
                                "text": msg.text,
                                "attachments": msg.attachments,
                                "direction": (
                                    msg.direction.value
                                    if hasattr(msg.direction, "value")
                                    else msg.direction
                                ),
                                "created_at": msg.created_at.isoformat(),
                                "status": msg.status or "delivered",
                            },
                        },
                    )

            except Exception as e:
                logger.error("Error processing event %s: %s", ev, e)

    finally:
        db.close()

    return {"status": "ok"}


def get_fb_user_name(psid: str, page_access_token: str):
    try:
        url = f"https://graph.facebook.com/{psid}"
        params = {
            "fields": "name",
            "access_token": page_access_token,
        }

        res = requests.get(url, params=params).json()

        return res.get("name")

    except Exception as e:
        print("get_fb_user_name error:", e)
        return None
