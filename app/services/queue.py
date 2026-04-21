from rq import Queue
from app.services.redis_service import get_redis

redis_conn = get_redis()

if redis_conn:
    message_queue = Queue(
        "message_queue",
        connection=redis_conn,
        default_timeout=60  # 🔥 tránh job treo
    )
    print("✅ Queue connected")
else:
    message_queue = None
    print("⚠️ Queue disabled (no Redis)")