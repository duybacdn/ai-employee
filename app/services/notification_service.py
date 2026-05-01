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

    try:
        n_type = map_tags_to_type(tags)
        priority = map_priority(n_type)

        # =========================
        # DUPLICATE CHECK
        # =========================
        exists = db.query(Notification).filter(
            Notification.message_id == message.id
        ).first()

        if exists:
            print("⚠️ Notification exists, skip")
            return

        # =========================
        # 🔥 ENSURE DATA SYNC
        # =========================
        db.flush()  # đảm bảo message đã sync DB

        # =========================
        # 🔥 GET CUSTOMER NAME (ƯU TIÊN RELATIONSHIP)
        # =========================
        customer_name = "Khách"

        if hasattr(message, "contact") and message.contact:
            customer_name = message.contact.display_name or "Khách"

        # fallback nếu relationship chưa load
        elif message.contact_id:
            contact = db.query(Contact).filter(
                Contact.id == message.contact_id
            ).first()

            if contact and contact.display_name:
                customer_name = contact.display_name

        # =========================
        # DEBUG LOG (QUAN TRỌNG)
        # =========================
        print("👉 message_id:", message.id)
        print("👉 conversation_id:", message.conversation_id)
        print("👉 customer_name:", customer_name)

        # =========================
        # CREATE NOTIFICATION
        # =========================
        noti = Notification(
            company_id=message.company_id,
            contact_id=message.contact_id,
            message_id=message.id,
            conversation_id=message.conversation_id,
            channel_id=message.channel_id,
            channel_name=message.channel.name if message.channel else "Unknown",

            # 🔥 DATA MỚI (CHO UI)
            customer_text=message.text,
            ai_reply=reply_text,
            customer_name=customer_name,

            type=n_type,
            priority=priority,

            title=f"{n_type.upper()} từ {customer_name}",
        )

        db.add(noti)
        db.commit()

        print(f"🔔 Notification created: {n_type} | priority={priority}")

    except Exception as e:
        db.rollback()
        print("❌ create_notification error:", e)