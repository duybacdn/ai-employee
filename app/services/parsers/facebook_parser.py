def parse_facebook_event(event):
    """
    Extract message and comment events from a Facebook webhook payload.

    Returns a list of dictionaries with:
    - type: "message" | "comment"
    - direction: "inbound" | "outbound"
    - sender_id / recipient_id / page_id
    - text, attachments, external ids, and Facebook timestamps
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

                if not message:
                    continue

                text = message.get("text")
                attachments = message.get("attachments")
                mid = message.get("mid")
                is_echo = bool(message.get("is_echo"))

                if not sender_id or not mid:
                    continue

                if not text and not attachments:
                    continue

                events.append({
                    "type": "message",
                    "direction": "outbound" if is_echo else "inbound",
                    "sender_id": sender_id,
                    "recipient_id": recipient_id,
                    "page_id": sender_id if is_echo else (recipient_id or page_id),
                    "text": text,
                    "attachments": attachments,
                    "mid": mid,
                    "is_echo": is_echo,
                    "timestamp": timestamp,
                    "platform": "facebook",
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
                parent_id = value.get("parent_id")
                attachments = value.get("attachments")

                if not comment_id or not sender_id or not post_id:
                    continue

                if not text and not attachments:
                    continue

                events.append({
                    "type": "comment",
                    "direction": "outbound" if sender_id == page_id else "inbound",
                    "sender_id": sender_id,
                    "page_id": page_id,
                    "post_id": post_id,
                    "text": text,
                    "attachments": attachments,
                    "comment_id": comment_id,
                    "parent_id": parent_id,
                    "timestamp": value.get("created_time"),
                    "platform": "facebook",
                })

    except Exception as e:
        print("Parse error:", e)

    return events
