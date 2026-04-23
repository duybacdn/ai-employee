import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams,
    Distance,
    Filter,
    FieldCondition,
    MatchValue
)

from app.services.embedding_service import get_embedding

# =========================
# CONFIG (LOCAL + CLOUD)
# =========================

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

COLLECTION_NAME = "knowledge"

# =========================
# CLIENT (ONLY ONE)
# =========================

def get_client():
    if not QDRANT_URL:
        raise ValueError("❌ QDRANT_URL is missing in environment")
    return QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY if QDRANT_API_KEY else None
    )

# =========================
# COLLECTION
# =========================

def ensure_collection():
    try:
        client = get_client()

        collections = client.get_collections().collections
        names = [c.name for c in collections]

        # =========================
        # CREATE COLLECTION (IF NOT EXISTS)
        # =========================
        if COLLECTION_NAME not in names:
            print("⚠️ Creating collection:", COLLECTION_NAME)

            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=1536,
                    distance=Distance.COSINE
                )
            )
        else:
            print("✅ Collection exists:", COLLECTION_NAME)

        # =========================
        # 🔥 ENSURE INDEX (QUAN TRỌNG NHẤT)
        # =========================
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="company_id",
                field_schema="keyword"  # 🔥 vì bạn lưu string
            )
            print("✅ Index ensured: company_id")

        except Exception as e:
            # index đã tồn tại vẫn sẽ vào đây → KHÔNG sao
            print("ℹ️ Index may already exist:", e)

    except Exception as e:
        print("❌ ensure_collection error:", e)

# =========================
# UPSERT
# =========================

def upsert_knowledge(knowledge, vector):
    client = get_client()

    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                {
                    "id": str(knowledge.id),
                    "vector": vector,
                    "payload": {
                        "company_id": str(knowledge.company_id),
                        "content": knowledge.content,
                    },
                }
            ],
        )

        print("✅ Inserted:", knowledge.id)

    except Exception as e:
        print("❌ upsert error:", e)

# =========================
# SEARCH (TEXT)
# =========================

def search_knowledge(query: str, company_id: str, top_k: int = 5):
    client = get_client()

    try:
        query_vector = get_embedding(query)

        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=top_k,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="company_id",
                        match=MatchValue(value=company_id)
                    )
                ]
            )
        )

        return [
            p.payload["content"]
            for p in results.points
            if p.payload and "content" in p.payload
        ]

    except Exception as e:
        print("❌ search_knowledge error:", e)
        return []

# =========================
# SEARCH (VECTOR + SCORE)
# =========================

def search_knowledge_by_vector(vector, company_id, top_k=5, score_threshold=0.65):
    client = get_client()

    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=top_k * 4,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="company_id",
                        match=MatchValue(value=company_id)
                    )
                ]
            )
        )
        print("\n====== SEARCH DEBUG ======")
        print("Total points:", len(results.points))

        knowledge_list = []

        for point in results.points:
            payload = point.payload or {}
            score = point.score or 0
            print("👉 SCORE:", round(score, 3), "|", payload.get("content", "")[:80])
            if score < score_threshold:
                continue

            content = payload.get("content", "").strip()
            if not content:
                continue

            knowledge_list.append({
                "content": content,
                "score": score
            })

        # =========================
        # 🔥 FALLBACK (THÊM MỚI - KHÔNG PHÁ LOGIC CŨ)
        # =========================
        if not knowledge_list:
            fallback_threshold = 0.45
            fallback_list = []

            for point in results.points:
                payload = point.payload or {}
                score = point.score or 0

                if score < fallback_threshold:
                    continue

                content = payload.get("content", "").strip()
                if not content:
                    continue

                fallback_list.append({
                    "content": content,
                    "score": score
                })

            fallback_list.sort(key=lambda x: x["score"], reverse=True)

            return fallback_list[:2]  # 🔥 giảm nhiễu khi fallback

        # =========================
        # GIỮ NGUYÊN LOGIC CŨ
        # =========================
        knowledge_list.sort(key=lambda x: x["score"], reverse=True)
        print("✅ FINAL SELECT:", len(knowledge_list))
        return knowledge_list[:top_k]
        
    except Exception as e:
        print("❌ vector search error:", e)
        return []