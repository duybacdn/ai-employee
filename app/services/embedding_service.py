from openai import OpenAI
import os
from dotenv import load_dotenv

# load .env
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("❌ OPENAI_API_KEY not found in environment")

client = OpenAI(api_key=api_key)

EMBEDDING_MODEL = "text-embedding-3-small"


def get_embedding(text: str) -> list[float]:
    if not text:
        return []

    try:
        print("📡 Calling OpenAI embedding...")

        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text.strip()
        )

        embedding = response.data[0].embedding

        print("✅ Embedding received")

        return embedding

    except Exception as e:
        print("❌ Embedding error:", e)
        raise e