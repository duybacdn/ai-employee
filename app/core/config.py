import os
from dataclasses import dataclass
from dotenv import load_dotenv

# 👇 FIX CHÍNH XÁC Ở ĐÂY
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET")
BASE_URL = os.getenv("BASE_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL")

load_dotenv(dotenv_path=ENV_PATH)

print("ENV PATH:", ENV_PATH)
print("DEBUG ENV:", os.getenv("FACEBOOK_VERIFY_TOKEN"))

@dataclass(frozen=True)
class Settings:
    ENV: str = os.getenv("ENV", "dev")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    FACEBOOK_VERIFY_TOKEN: str = os.getenv("FACEBOOK_VERIFY_TOKEN", "")

settings = Settings()