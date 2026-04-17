from app.services.queue import redis_conn

def is_duplicate(key: str, ttl=300):
    """
    Check nếu event đã xử lý rồi
    """
    if redis_conn.get(key):
        return True

    redis_conn.setex(key, ttl, 1)
    return False