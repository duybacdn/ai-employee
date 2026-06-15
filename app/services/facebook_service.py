# app/services/facebook_service.py

import requests
from sqlalchemy.orm import Session

from app.models.core import FacebookPage


def send_message(
    db: Session,
    channel_id: str,
    psid: str,
    text: str = None,
    attachments: list = None
):
    fb_page = (
        db.query(FacebookPage)
        .filter(FacebookPage.channel_id == channel_id)
        .first()
    )

    if not fb_page:
        raise Exception(f"No FacebookPage found for channel_id={channel_id}")

    if not fb_page.access_token:
        raise Exception(f"No access_token for page_id={fb_page.page_id}")

    url = "https://graph.facebook.com/v18.0/me/messages"

    params = {
        "access_token": fb_page.access_token
    }

    results = []

    # =========================
    # 1. SEND TEXT
    # =========================
    if text:
        payload = {
            "recipient": {"id": psid},
            "message": {"text": text}
        }

        res = requests.post(url, params=params, json=payload)

        print("📤 FB TEXT RESPONSE:", res.status_code, res.text)

        if res.status_code != 200:
            raise Exception(f"Facebook send text failed: {res.text}")

        results.append(res.json())

    # =========================
    # 2. SEND ATTACHMENTS
    # =========================
    if attachments:
        for att in attachments:
            try:
                att_type = att.get("type")
                att_url = att.get("url")

                if not att_type or not att_url:
                    continue

                payload = {
                    "recipient": {"id": psid},
                    "message": {
                        "attachment": {
                            "type": att_type,
                            "payload": {
                                "url": att_url
                            }
                        }
                    }
                }

                res = requests.post(url, params=params, json=payload)

                print("📤 FB ATTACH RESPONSE:", res.status_code, res.text)

                if res.status_code != 200:
                    raise Exception(f"Facebook send attachment failed: {res.text}")

                results.append(res.json())

            except Exception as e:
                print("❌ attachment send error:", e)

    return results

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