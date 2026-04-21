from app.services.queue import redis_conn

def is_duplicate(key: str, ttl=300):
    return False