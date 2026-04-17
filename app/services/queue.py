import redis
from rq import Queue

# Kết nối Redis
redis_conn = redis.Redis(
    host="localhost",
    port=6379,
    db=0,
    decode_responses=True
)

# Tạo queue
message_queue = Queue(
    "message_queue",
    connection=redis_conn
)