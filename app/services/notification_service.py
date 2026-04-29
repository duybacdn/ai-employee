from app.models.core import Notification, Contact

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
    print("🔥 NEW VERSION create_notification")

    n_type = map_tags_to_type(tags)
    priority = map_priority(n_type)

    # chống duplicate
    exists = db.query(Notification).filter(
        Notification.message_id == message.id
    ).first()

    if exists:
        return

    # 🔥 lấy tên khách
    contact = db.query(Contact).filter(
        Contact.id == message.contact_id
    ).first()

    customer_name = contact.display_name if contact else "Khách"

    noti = Notification(
        company_id=message.company_id,
        contact_id=message.contact_id,
        message_id=message.id,
        conversation_id=message.conversation_id,

        # 🔥 NEW DATA
        customer_text=message.text,
        ai_reply=reply_text,
        customer_name=customer_name,

        type=n_type,
        priority=priority,

        title=f"{n_type.upper()} từ {customer_name}",
        content=None,  # ❌ bỏ luôn content cũ
    )

    db.add(noti)
    db.commit()

    print(f"🔔 Notification created: {n_type} | priority={priority}")