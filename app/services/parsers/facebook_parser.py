def parse_facebook_event(event):
    """
    Trích xuất cả message và comment từ webhook Facebook.
    Trả về list dict:
    {
        type: "message" | "comment",
        sender_id: "...",
        text: "...",
        mid/comment_id: "...",
        page_id: "...",
        post_id: "..." (chỉ comment)
    }
    """
    events = []

    try:
        for entry in event.get("entry", []):
            page_id = entry.get("id")

            # ======================
            # MESSAGES (messaging)
            # ======================
            for messaging_event in entry.get("messaging", []):
                sender_id = messaging_event.get("sender", {}).get("id")
                recipient_id = messaging_event.get("recipient", {}).get("id")
                timestamp = messaging_event.get("timestamp")
                message = messaging_event.get("message")
                if not message or message.get("is_echo"):
                    continue

                text = message.get("text")
                mid = message.get("mid")
                if not sender_id or not text or not mid:
                    continue

                events.append({
                    "type": "message",
                    "sender_id": sender_id,
                    "page_id": recipient_id or page_id,
                    "text": text,
                    "mid": mid,
                    "timestamp": timestamp,
                    "platform": "facebook"
                })

            # ======================
            # COMMENTS (feed/changes)
            # ======================
            for change in entry.get("changes", []):
                value = change.get("value", {})
                comment_id = value.get("comment_id")
                post_id = value.get("post_id")
                sender_id = value.get("from", {}).get("id")
                text = value.get("message")
                if not comment_id or not sender_id or not text or not post_id:
                    continue

                events.append({
                    "type": "comment",
                    "sender_id": sender_id,
                    "page_id": page_id,
                    "post_id": post_id,
                    "text": text,
                    "comment_id": comment_id,
                    "timestamp": value.get("created_time"),
                    "platform": "facebook"
                })

    except Exception as e:
        print("Parse error:", e)

    return events