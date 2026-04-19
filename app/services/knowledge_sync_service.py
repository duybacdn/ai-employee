from app.services.embedding_service import get_embedding
from app.services.qdrant_service import get_client, COLLECTION_NAME
from qdrant_client.models import PointIdsList


def sync_create_knowledge(item):
    try:
        vector = get_embedding(item.content)

        client = get_client()  # 🔥 FIX HERE

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                {
                    "id": str(item.id),
                    "vector": vector,
                    "payload": {
                        "content": item.content,
                        "company_id": str(item.company_id)
                    }
                }
            ]
        )

        print(f"✅ Synced CREATE to Qdrant: {item.id}")

    except Exception as e:
        print("❌ Sync create error:", e)


def sync_update_knowledge(item):
    try:
        vector = get_embedding(item.content)

        client = get_client()  # 🔥 FIX

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                {
                    "id": str(item.id),
                    "vector": vector,
                    "payload": {
                        "content": item.content,
                        "company_id": str(item.company_id)
                    }
                }
            ]
        )

        print(f"🔄 Synced UPDATE to Qdrant: {item.id}")

    except Exception as e:
        print("❌ Sync update error:", e)


def sync_delete_knowledge(item_id):
    try:
        client = get_client()  # 🔥 FIX

        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=PointIdsList(
                points=[str(item_id)]
            )
        )

        print(f"🗑 Synced DELETE to Qdrant: {item_id}")

    except Exception as e:
        print("❌ Sync delete error:", e)