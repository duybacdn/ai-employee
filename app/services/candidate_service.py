from app.models.core import KnowledgeItem
from app.services.embedding_service import get_embedding
from app.services.qdrant_service import upsert_knowledge


def create_knowledge_from_candidate(db, candidate):
    try:
        if not candidate.final_text:
            print("⚠️ Candidate has no final_text")
            return None

        # 🔥 1. CREATE KNOWLEDGE (DB)
        knowledge = KnowledgeItem(
            company_id=candidate.company_id,
            content=candidate.final_text,
            source="candidate"
        )

        db.add(knowledge)
        db.commit()
        db.refresh(knowledge)

        print(f"📚 Knowledge created: {knowledge.id}")

        # 🔥 2. EMBEDDING
        vector = get_embedding(knowledge.content)

        if not vector:
            print("❌ Empty vector, skip Qdrant")
            return knowledge

        # 🔥 3. UPSERT QDRANT
        upsert_knowledge(knowledge, vector)

        print(f"🧠 Synced to Qdrant: {knowledge.id}")

        return knowledge

    except Exception as e:
        print("❌ create_knowledge_from_candidate error:", e)
        return None
    
def create_knowledge_from_text(db, company_id, text):
    if not text:
        print("❌ Empty text")
        return None

    knowledge = KnowledgeItem(
        company_id=company_id,
        content=text,
        source="candidate"
    )

    db.add(knowledge)
    db.commit()
    db.refresh(knowledge)

    vector = get_embedding(knowledge.content)

    if vector:
        upsert_knowledge(knowledge, vector)

    return knowledge