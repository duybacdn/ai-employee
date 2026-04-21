import os
import redis
from rq import Worker, Queue, Connection

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    raise RuntimeError("❌ REDIS_URL not set")

redis_conn = redis.from_url(REDIS_URL)

QUEUE_NAME = "message_queue"

if __name__ == "__main__":
    with Connection(redis_conn):
        worker = Worker([QUEUE_NAME])
        print("🚀 Worker started...")
        worker.work()