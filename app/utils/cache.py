from app.services.queue import redis_conn

import re

def make_cache_key(text: str):
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)  # remove duplicate spaces
    return f"ai_cache:{text[:100]}"

def get_cache(key: str):
    data = redis_conn.get(key)
    return data if data else None

def set_cache(key: str, value: str, ttl=3600):
    redis_conn.setex(key, ttl, value)