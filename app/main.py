from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logger import get_logger

from app.api.v1.auth import router as auth_router
from app.api.v1.protected import router as protected_router
from app.api.v1.admin_users import router as admin_users_router
from app.api.webhooks.facebook import router as facebook_router

from app.db.session import Base
from app.core.database import engine
# from app.models.core import Message, Conversation
from app.api.routes.answer_candidate import router as candidate_router
from app.services.qdrant_service import ensure_collection
#from app.api.v1.messages import router as messages_router
from app.api.v1.facebook import router as fb_router
from app.api.v1 import candidates
from app.api.v1 import knowledge
from app.api.v1 import conversations
from app.api.v1 import messages
from app.api.v1 import employees
from app.api.v1 import channels
from app.api.v1 import companies
from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 App starting...")

    # DB init
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ DB ready")
    except Exception as e:
        print("⚠️ DB init failed:", e)

    try:
        ensure_collection()
        print("✅ Qdrant collection ready")
    except Exception as e:
        print("⚠️ Qdrant init failed (non-blocking):", e)

    yield

    print("🛑 App shutting down...")

app = FastAPI(title="AI Employee API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(protected_router, prefix="/api/v1")
app.include_router(admin_users_router, prefix="/api/v1")
#app.include_router(messages_router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1/employees")
app.include_router(channels.router, prefix="/api/v1/channels")
app.include_router(companies.router, prefix="/api/v1/companies")
app.include_router(candidate_router)
app.include_router(fb_router, prefix="/api/v1/facebook")

# ✅ CHỈ 1 WEBHOOK
app.include_router(facebook_router)

# debug (optional)
from app.api import debug
app.include_router(debug.router)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def root():
    return {"message": "API OK"}

# CLI mode (dev)
log = get_logger(__name__)

def main():
    from app.core.config import settings
    from app.agents.router_agent import RouterAgent
    from app.agents.customer_service_agent import CustomerServiceAgent
    from app.agents.content_agent import ContentAgent
    from app.agents.ops_agent import OpsAgent

    log.info("AI-Employee booting...")
    log.info(f"ENV={settings.ENV} | MODEL={settings.OPENAI_MODEL}")

    router = RouterAgent()
    cs_agent = CustomerServiceAgent()
    content_agent = ContentAgent()
    ops_agent = OpsAgent()

    while True:
        user_input = input("\n👤 Bạn: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ["exit", "quit"]:
            break

        route = router.route(user_input)
        log.info(f"ROUTE intent={route.intent} conf={route.confidence:.2f}")

        if route.intent == "customer_support":
            response = cs_agent.run(user_input)
        elif route.intent == "content":
            response = content_agent.run(user_input)
        elif route.intent == "ops":
            response = ops_agent.run(user_input)
        else:
            response = "Bạn muốn CSKH hay Content?"

        print(f"\n🤖 AI: {response}")

    log.info("Shutdown AI-Employee")


if __name__ == "__main__":
    main()