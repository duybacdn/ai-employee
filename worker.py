import os
import sys
import time
import redis
from rq import Queue, Worker, Connection
from app.workers.message_worker import process_incoming_message  # đúng đường dẫn

REDIS_URL = os.getenv("REDIS_URL")
redis_conn = redis.from_url(REDIS_URL)
QUEUE_NAME = "message_queue"

from rq.job import Job

def start_worker_windows():
    queue = Queue(QUEUE_NAME, connection=redis_conn)
    print("[Worker] Windows manual loop started. Listening for jobs...")

    while True:
        try:
            job_ids = queue.job_ids  # 🔥 NHẸ hơn nhiều so với queue.jobs

            if job_ids:
                job = Job.fetch(job_ids[0], connection=redis_conn)

                message_id = job.args[0]
                print(f"🔥 Processing message {message_id}")

                process_incoming_message(message_id)

                job.delete()
                print(f"✅ Finished message {message_id}")
            else:
                time.sleep(2)  # 🔥 QUAN TRỌNG

        except Exception as e:
            print("❌ Worker error:", e)
            time.sleep(1)

def start_worker_linux():
    with Connection(redis_conn):
        worker = Worker([QUEUE_NAME])
        print("[Worker] Linux RQ Worker started. Listening for jobs...")
        worker.work(with_scheduler=True)

if __name__ == "__main__":
    if sys.platform.startswith("win"):
        start_worker_windows()
    else:
        start_worker_linux()