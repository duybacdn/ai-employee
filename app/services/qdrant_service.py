from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from app.services.embedding_service import get_embedding
from qdrant_client.models import Filter, FieldCondition, MatchValue

# 🔥 config local docker
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333

# 🔌 connect
qdrant = QdrantClient(
    host=QDRANT_HOST,
    port=QDRANT_PORT,
)

client = QdrantClient(host="localhost", port=6333)
COLLECTION_NAME = "knowledge"


def test_connection():
    try:
        collections = qdrant.get_collections()
        print("✅ Qdrant connected")
        print("📦 Collections:", collections)
    except Exception as e:
        print("❌ Qdrant connection failed:", e)

def ensure_collection():
    collections = qdrant.get_collections().collections
    names = [c.name for c in collections]

    if COLLECTION_NAME not in names:
        print("⚠️ Creating collection:", COLLECTION_NAME)

        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=1536,  # 🔥 phải match embedding
                distance=Distance.COSINE
            )
        )
    else:
        print("✅ Collection exists:", COLLECTION_NAME)

def upsert_knowledge(knowledge, vector):
    try:
        qdrant.upsert(
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

        print("✅ Inserted into Qdrant:", knowledge.id)

    except Exception as e:
        print("❌ Qdrant upsert error:", e)

def search_knowledge(query: str, company_id: str, top_k: int = 5):
    try:
        # 1. embedding query
        query_vector = get_embedding(query)

        # 2. search Qdrant
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=top_k,
            query_filter={
                "must": [
                    {
                        "key": "company_id",
                        "match": {"value": company_id}
                    }
                ]
            }
        )

        # 3. extract payload
        knowledge_list = []
        for item in results.points:
            payload = item.payload
            if payload and "content" in payload:
                knowledge_list.append(payload["content"])

        return knowledge_list

    except Exception as e:
        print("❌ search_knowledge error:", e)
        return []
    
def search_knowledge_by_vector(vector, company_id, top_k=5, score_threshold=0.3):
    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            limit=top_k * 2,  # 🔥 lấy dư
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="company_id",
                        match=MatchValue(value=company_id)
                    )
                ]
            )
        )

        knowledge_list = []

        for point in results.points:
            payload = point.payload or {}
            score = point.score

            if score < score_threshold:
                continue

            content = payload.get("content", "").strip()
            if not content:
                continue

            knowledge_list.append({
                "content": content,
                "score": score
            })

        # 🔥 sort lại
        knowledge_list.sort(key=lambda x: x["score"], reverse=True)

        return knowledge_list[:top_k]

    except Exception as e:
        print("❌ Qdrant search error:", e)
        return []