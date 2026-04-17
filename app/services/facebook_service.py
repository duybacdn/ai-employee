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