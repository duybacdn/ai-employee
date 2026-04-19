from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session
import requests
import uuid
import os
import json
from urllib.parse import quote
from app.core.database import SessionLocal
from app.models.core import Channel, FacebookPage

router = APIRouter(tags=["Facebook"])


# =========================
# CONFIG
# =========================
from app.core.config import (
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    BASE_URL,
    FRONTEND_URL,
)

APP_ID = FACEBOOK_APP_ID
APP_SECRET = FACEBOOK_APP_SECRET

REDIRECT_URI = f"{BASE_URL}/api/v1/facebook/callback"

VERIFY_TOKEN = "abc123"

if not BASE_URL:
    raise Exception("Missing BASE_URL in environment")

if not FRONTEND_URL:
    raise Exception("Missing FRONTEND_URL in environment")


# =========================
# DB SESSION
# =========================
def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()


# =========================
# 1. CONNECT FACEBOOK
# =========================
@router.get("/login")
def facebook_login(company_id: str):

    fb_login_url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={APP_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=pages_show_list,pages_read_engagement,pages_manage_engagement,pages_messaging,pages_manage_metadata"
        f"&auth_type=rerequest"
        f"&state={company_id}"
    )

    return RedirectResponse(fb_login_url)


# =========================
# 2. CALLBACK
# =========================
@router.get("/callback")
def facebook_callback(
    code: str = None,
    state: str = None,
    error: str = None,
):

    if error:
        raise HTTPException(status_code=400, detail=f"Facebook error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # 🔥 FIX: đảm bảo UUID
    try:
        company_uuid = uuid.UUID(state)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id")

    db: Session = SessionLocal()

    try:
        # =========================
        # STEP 1: Exchange code -> user token
        # =========================
        token_res = requests.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            },
        )

        token_data = token_res.json()

        if "access_token" not in token_data:
            raise HTTPException(status_code=400, detail=token_data)

        user_access_token = token_data["access_token"]

        # =========================
        # STEP 2: Get pages
        # =========================
        pages_res = requests.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": user_access_token},
        )

        pages_data = pages_res.json()

        if "data" not in pages_data:
            raise HTTPException(status_code=400, detail=pages_data)

        # =========================
        # STEP 3: Save + SUBSCRIBE
        # =========================
        for p in pages_data.get("data", []):
            page_id = p.get("id")
            page_name = p.get("name")
            page_token = p.get("access_token")

            if not page_id:
                continue

            # =========================
            # SUBSCRIBE WEBHOOK
            # =========================
            try:
                sub_url = f"https://graph.facebook.com/v19.0/{page_id}/subscribed_apps"

                requests.post(
                    sub_url,
                    params={
                        "subscribed_fields": "feed,messages,messaging_postbacks",
                        "access_token": page_token
                    }
                )

            except Exception as e:
                print("❌ SUBSCRIBE ERROR:", str(e))

            # =========================
            # CHECK EXIST CHANNEL
            # =========================
            channel = (
                db.query(Channel)
                .join(FacebookPage, FacebookPage.channel_id == Channel.id)
                .filter(FacebookPage.page_id == page_id)
                .first()
            )

            if not channel:
                channel = Channel(
                    id=uuid.uuid4(),
                    company_id=company_uuid,  # 🔥 FIX UUID
                    platform="facebook",
                    name=page_name,
                    is_active=True,
                )
                db.add(channel)
                db.flush()
            else:
                channel.name = page_name

            # =========================
            # UPSERT FACEBOOK PAGE
            # =========================
            fb_page = (
                db.query(FacebookPage)
                .filter(FacebookPage.page_id == page_id)
                .first()
            )

            if not fb_page:
                fb_page = FacebookPage(
                    company_id=company_uuid,  # 🔥 FIX UUID
                    channel_id=channel.id,
                    page_id=page_id,
                    page_name=page_name,
                    access_token=page_token,
                )
                db.add(fb_page)
            else:
                fb_page.access_token = page_token
                fb_page.page_name = page_name

        db.commit()

    finally:
        db.close()

    encoded_pages = quote(json.dumps(pages_data.get("data", [])))

    return RedirectResponse(
        url=f"{FRONTEND_URL}/channels/select-pages?pages={encoded_pages}&company_id={company_uuid}"
    )


# =========================
# VERIFY WEBHOOK
# =========================
@router.get("/webhook/facebook")
def verify_webhook(mode: str = None, verify_token: str = None, challenge: str = None):
    if verify_token == VERIFY_TOKEN:
        return int(challenge)
    return "verify failed"


# =========================
# RECEIVE WEBHOOK
# =========================
@router.post("/webhook/facebook")
async def receive_webhook(req: Request):
    data = await req.json()

    print("🔥 WEBHOOK RECEIVED:", json.dumps(data, indent=2))

    return {"status": "ok"}


# =========================
# CONNECT PAGES
# =========================
@router.post("/connect-pages")
def connect_pages(payload: dict):
    db: Session = SessionLocal()

    try:
        company_uuid = uuid.UUID(payload.get("company_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id")

    pages = payload.get("pages", [])

    try:
        for p in pages:
            page_id = p.get("id")
            page_name = p.get("name")
            page_token = p.get("access_token")

            if not page_id:
                continue

            fb_page = (
                db.query(FacebookPage)
                .filter(FacebookPage.page_id == page_id)
                .first()
            )

            if not fb_page:
                channel = Channel(
                    id=uuid.uuid4(),
                    company_id=company_uuid,  # 🔥 FIX
                    platform="facebook",
                    name=page_name,
                    is_active=True,
                )
                db.add(channel)
                db.flush()

                fb_page = FacebookPage(
                    company_id=company_uuid,  # 🔥 FIX
                    channel_id=channel.id,
                    page_id=page_id,
                    page_name=page_name,
                    access_token=page_token,
                )
                db.add(fb_page)
            else:
                fb_page.access_token = page_token
                fb_page.page_name = page_name

        db.commit()

    finally:
        db.close()

    return {"success": True}


@router.get("/privacy", response_class=HTMLResponse)
def privacy():
    return "<h1>Privacy Policy</h1>"


@router.api_route("/data-deletion", methods=["GET", "POST"])
def data_deletion():
    return {"status": "ok"}


@router.get("/test-internet")
def test_internet():
    import requests
    try:
        r = requests.get("https://graph.facebook.com")
        return {"status": r.status_code}
    except Exception as e:
        return {"error": str(e)}