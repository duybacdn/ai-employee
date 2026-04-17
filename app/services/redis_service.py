import os
from redis import Redis
from redis.exceptions import RedisError

# =========================
# CONFIG
# =========================

REDIS_URL = os.getenv("REDIS_URL")

# =========================
# CLIENT (LAZY + SAFE)
# =========================

_redis_client = None


def get_redis():
    """
    Lazy init Redis client (safe cho Render)
    """
    global _redis_client

    if _redis_client is not None:
        return _redis_client

    if not REDIS_URL:
        print("⚠️ REDIS_URL not set")
        return None

    try:
        _redis_client = Redis.from_url(
            REDIS_URL,
            decode_responses=True,   # trả về string thay vì bytes
            socket_timeout=2,        # tránh treo
            socket_connect_timeout=2,
        )

        # test connection
        _redis_client.ping()
        print("✅ Redis connected")

    except Exception as e:
        print("❌ Redis connection failed:", e)
        _redis_client = None

    return _redis_client


# =========================
# SAFE WRAPPER FUNCTIONS
# =========================

def redis_set(key: str, value: str, ex: int = None):
    redis = get_redis()
    if not redis:
        return False

    try:
        redis.set(key, value, ex=ex)
        return True
    except RedisError as e:
        print("❌ Redis SET error:", e)
        return False


def redis_get(key: str):
    redis = get_redis()
    if not redis:
        return None

    try:
        return redis.get(key)
    except RedisError as e:
        print("❌ Redis GET error:", e)
        return None


def redis_exists(key: str):
    redis = get_redis()
    if not redis:
        return False

    try:
        return redis.exists(key)
    except RedisError as e:
        print("❌ Redis EXISTS error:", e)
        return False


def redis_delete(key: str):
    redis = get_redis()
    if not redis:
        return False

    try:
        redis.delete(key)
        return True
    except RedisError as e:
        print("❌ Redis DELETE error:", e)
        return False


def redis_incr(key: str, ex: int = None):
    redis = get_redis()
    if not redis:
        return 0

    try:
        value = redis.incr(key)
        if ex:
            redis.expire(key, ex)
        return value
    except RedisError as e:
        print("❌ Redis INCR error:", e)
        return 0