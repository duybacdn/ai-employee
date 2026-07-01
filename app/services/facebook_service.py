import requests
from sqlalchemy.orm import Session

from app.models.core import FacebookPage


def send_message(
    db: Session,
    channel_id: str,
    psid: str,
    text: str = None,
    attachments: list = None,
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
    params = {"access_token": fb_page.access_token}
    results = []

    if text:
        payload = {
            "recipient": {"id": psid},
            "message": {"text": text},
        }

        res = requests.post(url, params=params, json=payload)
        print("FB TEXT RESPONSE:", res.status_code, res.text)

        if res.status_code != 200:
            raise Exception(f"Facebook send text failed: {res.text}")

        results.append(res.json())

    if attachments:
        for att in attachments:
            try:
                att_type = att.get("type")
                att_url = att.get("url") or att.get("file_url")

                if not att_type or not att_url:
                    continue

                if not att_url.startswith("http"):
                    raise Exception(f"Invalid attachment URL: {att_url}")

                payload = {
                    "recipient": {"id": psid},
                    "message": {
                        "attachment": {
                            "type": att_type,
                            "payload": {"url": att_url},
                        }
                    },
                }

                res = requests.post(url, params=params, json=payload)
                print("FB ATTACH RESPONSE:", res.status_code, res.text)

                if res.status_code != 200:
                    raise Exception(f"Facebook send attachment failed: {res.text}")

                results.append(res.json())

            except Exception as e:
                print("attachment send error:", e)

    return results


def reply_comment(db, channel_id, comment_id, text):
    try:
        fb_page = (
            db.query(FacebookPage)
            .filter(FacebookPage.channel_id == channel_id)
            .first()
        )

        if not fb_page:
            print("No Facebook page found for channel")
            return None

        access_token = fb_page.access_token
        url = f"https://graph.facebook.com/v18.0/{comment_id}/comments"

        payload = {
            "message": text,
            "access_token": access_token,
        }

        res = requests.post(url, data=payload)

        print("COMMENT REPLY STATUS:", res.status_code)
        print("COMMENT REPLY RESPONSE:", res.text)

        if res.status_code != 200:
            print("Failed to reply comment")
            return None

        return res.json()

    except Exception as e:
        print(f"Error replying comment: {e}")
        return None


def fetch_facebook_post_context(db: Session, channel_id: str, post_id: str):
    try:
        fb_page = (
            db.query(FacebookPage)
            .filter(FacebookPage.channel_id == channel_id)
            .first()
        )

        if not fb_page:
            print(f"No FacebookPage for channel_id={channel_id}")
            return None

        if not fb_page.access_token:
            print(f"No access_token for page_id={fb_page.page_id}")
            return None

        access_token = fb_page.access_token
        url = f"https://graph.facebook.com/v18.0/{post_id}"

        params = {
            "fields": "message,story",
            "access_token": access_token,
        }

        res = requests.get(url, params=params, timeout=5)

        if res.status_code != 200:
            print("Fetch post error:", res.text)
            return None

        data = res.json()
        content = data.get("message") or data.get("story")

        if not content:
            print(f"Post {post_id} has no text content")

        return content

    except Exception as e:
        print(f"fetch_facebook_post_context error: {e}")
        return None
