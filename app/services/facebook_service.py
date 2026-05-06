# app/services/facebook_service.py

import requests
from sqlalchemy.orm import Session

from app.models.core import FacebookPage


def send_message(db: Session, channel_id: str, psid: str, text: str):
    """
    Gửi message qua Facebook (multi-page support)
    - Lấy access_token từ DB theo channel_id
    """

    # =========================
    # 🔥 GET PAGE TOKEN
    # =========================
    fb_page = (
        db.query(FacebookPage)
        .filter(FacebookPage.channel_id == channel_id)
        .first()
    )

    if not fb_page:
        print(f"❌ No FacebookPage found for channel_id={channel_id}")
        return

    if not fb_page.access_token:
        print(f"❌ No access_token for page_id={fb_page.page_id}")
        return

    access_token = fb_page.access_token

    # =========================
    # SEND MESSAGE
    # =========================
    url = "https://graph.facebook.com/v18.0/me/messages"

    payload = {
        "recipient": {"id": psid},
        "message": {"text": text}
    }

    params = {
        "access_token": access_token
    }

    try:
        response = requests.post(url, json=payload, params=params)

        if response.status_code != 200:
            print("❌ Facebook API Error:", response.text)
        else:
            print(f"📤 Sent message via page {fb_page.page_id}")

    except Exception as e:
        print("❌ Send message failed:", e)

def reply_comment(db, channel_id, comment_id, text):
    """
    Reply vào comment Facebook

    - comment_id: dạng "postId_commentId"
    - text: nội dung reply
    """

    try:
        from app.models.core import FacebookPage

        # =========================
        # 1. Lấy page access token
        # =========================
        fb_page = (
            db.query(FacebookPage)
            .filter(FacebookPage.channel_id == channel_id)
            .first()
        )

        if not fb_page:
            print("❌ No Facebook page found for channel")
            return

        access_token = fb_page.access_token

        # =========================
        # 2. Gọi API reply comment
        # =========================
        url = f"https://graph.facebook.com/v18.0/{comment_id}/comments"

        payload = {
            "message": text,
            "access_token": access_token
        }

        res = requests.post(url, data=payload)

        # =========================
        # 3. Log kết quả
        # =========================
        print("💬 COMMENT REPLY STATUS:", res.status_code)
        print("💬 COMMENT REPLY RESPONSE:", res.text)

        if res.status_code != 200:
            print("❌ Failed to reply comment")

    except Exception as e:
        print(f"❌ Error replying comment: {e}")

def fetch_facebook_post_context(db: Session, channel_id: str, post_id: str):
    """
    Lấy nội dung bài post Facebook theo post_id

    - Tự lấy access_token từ DB (multi-page)
    - Trả về: message hoặc story
    """

    try:
        # =========================
        # 1. LẤY PAGE TOKEN
        # =========================
        fb_page = (
            db.query(FacebookPage)
            .filter(FacebookPage.channel_id == channel_id)
            .first()
        )

        if not fb_page:
            print(f"❌ No FacebookPage for channel_id={channel_id}")
            return None

        if not fb_page.access_token:
            print(f"❌ No access_token for page_id={fb_page.page_id}")
            return None

        access_token = fb_page.access_token

        # =========================
        # 2. CALL GRAPH API
        # =========================
        url = f"https://graph.facebook.com/v18.0/{post_id}"

        params = {
            "fields": "message,story",
            "access_token": access_token
        }

        res = requests.get(url, params=params, timeout=5)

        if res.status_code != 200:
            print("❌ Fetch post error:", res.text)
            return None

        data = res.json()

        # =========================
        # 3. RETURN CONTENT
        # =========================
        content = data.get("message") or data.get("story")

        if not content:
            print(f"⚠️ Post {post_id} has no text content")

        return content

    except Exception as e:
        print(f"❌ fetch_facebook_post_context error: {e}")
        return None