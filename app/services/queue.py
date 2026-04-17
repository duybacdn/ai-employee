import redis
from rq import Queue

from app.services.redis_service import get_redis

redis_conn = get_redis()

# Tạo queue
message_queue = Queue(
    "message_queue",
    connection=redis_conn
)
