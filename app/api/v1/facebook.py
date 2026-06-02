from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session
import requests
import uuid
import os
import json
from urllib.parse import quote
from app.core.database import SessionLocal
from app.models.core import Channel, FacebookPage, Company, CompanyStatus, User, CompanyUser
from app.core.auth_guard import get_current_user
from app.core.permission import require_company_admin
from app.schemas.auth import CurrentUser
from app.core.security import decode_access_token

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
        yield db
    finally:
        db.close()

def get_current_user_from_cookie_or_header(
    request: Request,
    db: Session = Depends(get_db),
) -> CurrentUser:

    token = None

    # 🔥 1. header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    # 🔥 2. cookie fallback
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(401, "Not authenticated")

    payload = decode_access_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid token")

    try:
        uid = uuid.UUID(user_id)
    except:
        raise HTTPException(401, "Invalid user id")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(401, "User not found")

    # 🔥 ROLE
    if user.is_superadmin:
        role = "superadmin"
    else:
        cu = db.query(CompanyUser).filter(
            CompanyUser.user_id == user.id
        ).first()
        role = cu.role.value.lower() if cu else "staff"

    # 🔥 COMPANY IDS
    company_ids = [
        str(c.company_id)
        for c in db.query(CompanyUser).filter(
            CompanyUser.user_id == user.id
        ).all()
    ]

    return CurrentUser(
        id=str(user.id),
        role=role,
        company_ids=company_ids,
        is_superadmin=user.is_superadmin,
    )

# =========================
# 1. CONNECT FACEBOOK
# =========================
@router.get("/login")
def facebook_login(
    company_id: str,
    token: str,
    db: Session = Depends(get_db),
):
    # =========================
    # 🔥 DECODE TOKEN
    # =========================
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # =========================
    # 🔥 BUILD CURRENT USER
    # =========================
    current_user = CurrentUser(
        id=user_id,
        role=payload.get("role", "staff"),
        company_ids=payload.get("company_ids", []),
        is_superadmin=payload.get("is_superadmin", False),
    )

    # =========================
    # 🔥 CHECK PERMISSION
    # =========================
    require_company_admin(db, current_user, company_id)

    # =========================
    # 🔥 CHECK COMPANY
    # =========================
    company = db.query(Company).filter(
        Company.id == uuid.UUID(company_id),
        Company.status == "active"
    ).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # =========================
    # 🔥 REDIRECT FACEBOOK
    # =========================
    fb_login_url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={APP_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=pages_show_list,pages_read_engagement,pages_manage_engagement,pages_messaging,pages_manage_metadata"
        f"&auth_type=reauthorize"
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
        return RedirectResponse(f"{FRONTEND_URL}/channels?fb_error=cancelled")

    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/channels?fb_error=missing_code")

    try:
        company_uuid = uuid.UUID(state)
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/channels?fb_error=invalid_company")

    # =========================
    # STEP 1: EXCHANGE TOKEN
    # =========================
    token_res = requests.get(
        "https://graph.facebook.com/v19.0/oauth/access_token",
        params={
            "client_id": APP_ID,
            "client_secret": APP_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code,
        },
        timeout=10
    )

    token_data = token_res.json()

    if "access_token" not in token_data:
        print("❌ TOKEN ERROR:", token_data)
        return RedirectResponse(f"{FRONTEND_URL}/channels?fb_error=token_failed")

    user_access_token = token_data["access_token"]
    print("🔥 USER TOKEN:", user_access_token)

    # =========================
    # STEP 2: GET ALL PAGES (FIX PAGINATION)
    # =========================
    all_pages = []
    url = "https://graph.facebook.com/v19.0/me/accounts"

    params = {
        "access_token": user_access_token,
        "fields": "id,name,access_token,category,tasks",
        "limit": 50
    }

    while url:
        try:
            res = requests.get(url, params=params, timeout=10)
            data = res.json()
        except Exception as e:
            print("❌ REQUEST ERROR:", str(e))
            break

        print("🔥 FB PAGE CHUNK:", json.dumps(data, indent=2))

        # 🔥 nếu lỗi từ FB
        if "error" in data:
            print("❌ FB ERROR:", data)
            break

        chunk = data.get("data", [])
        all_pages.extend(chunk)

        paging = data.get("paging", {})
        next_url = paging.get("next")

        # 🔥 quan trọng
        if next_url:
            url = next_url
            params = None   # next URL đã có sẵn param
        else:
            url = None

    print("🔥 TOTAL PAGES:", len(all_pages))

    # =========================
    # STEP 3: FILTER
    # =========================
    valid_pages = []

    for p in all_pages:
        tasks = p.get("tasks", [])

        # 🔥 CHỈ cần MESSAGING (đừng dùng MANAGE)
        if "MESSAGING" not in tasks:
            print("❌ SKIP:", p.get("name"), tasks)
            continue

        valid_pages.append(p)

    print("🔥 VALID PAGES:", len(valid_pages))

    # =========================
    # STEP 4: RETURN FRONTEND
    # =========================
    encoded_pages = quote(json.dumps(valid_pages))

    return RedirectResponse(
        f"{FRONTEND_URL}/channels/select-pages?pages={encoded_pages}&company_id={company_uuid}"
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
def connect_pages(
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        company_uuid = uuid.UUID(payload.get("company_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id")

    # 🔥 FIX: admin only
    require_company_admin(db, current_user, str(company_uuid))

    # 🔥 check company tồn tại
    company = db.query(Company).filter(Company.id == company_uuid, Company.status == "active").first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    pages = payload.get("pages", [])

    for p in pages:
        page_id = p.get("id")
        page_name = p.get("name")
        page_token = p.get("access_token")

        if not page_id:
            continue
        # 🔥 enforce active company on channel insert
        fb_page = (
            db.query(FacebookPage)
            .filter(
                FacebookPage.page_id == page_id,
                FacebookPage.company_id == company_uuid
            )
            .first()
        )

        if not fb_page:
            channel = Channel(
                id=uuid.uuid4(),
                company_id=company_uuid,
                platform="facebook",
                name=page_name,
                is_active=True,
            )
            db.add(channel)
            db.flush()

            fb_page = FacebookPage(
                company_id=company_uuid,
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