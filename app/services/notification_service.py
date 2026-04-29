from app.models.core import Notification

# =========================
# MAP TYPE
# =========================
def map_tags_to_type(tags):
    if not tags:
        return "other"

    if "order" in tags or "ready_to_buy" in tags:
        return "order"

    if "ask_price" in tags:
        return "lead"

    if "complaint" in tags:
        return "complaint"

    if "support" in tags:
        return "support"

    return "other"


# =========================
# 🔥 NEW: MAP PRIORITY
# =========================
def map_priority(n_type):
    if n_type == "order":
        return "high"

    if n_type in ["lead", "support"]:
        return "medium"

    return "low"


# =========================
# CREATE
# =========================
def create_notification(db, message, tags, reply_text):
    n_type = map_tags_to_type(tags)
    print("🔥 NEW VERSION create_notification")
    # 🔥 ADD
    priority = map_priority(n_type)

    # chống duplicate
    exists = db.query(Notification).filter(
        Notification.message_id == message.id
    ).first()

    if exists:
        return

    title = f"{n_type.upper()} từ khách"

    content = f"""
Khách:
{message.text}

AI:
{reply_text}
"""

    noti = Notification(
        company_id=message.company_id,
        contact_id=message.contact_id,
        message_id=message.id,
        conversation_id=message.conversation_id,
        type=n_type,
        priority=priority,  # 🔥 QUAN TRỌNG
        title=title,
        content=content.strip()
    )

    db.add(noti)
    db.commit()

    print(f"🔔 Notification created: {n_type} | priority={priority}")