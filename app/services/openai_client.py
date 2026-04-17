from __future__ import annotations

from openai import OpenAI
from app.core.config import settings
import json
from typing import Any, Dict, List


class OpenAIClient:
    """
    Wrapper mỏng cho OpenAI SDK.
    Dùng Responses API (khuyến nghị cho dự án mới).
    """

    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is missing in .env")

        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def text(self, prompt: str, *, model: str | None = None) -> str:
        model = model or settings.OPENAI_MODEL

        # Responses API
        resp = self.client.responses.create(
            model=model,
            input=prompt,
        )

        # SDK có thuộc tính output_text tiện lấy text tổng
        return resp.output_text

    def structured(
        self,
        messages: List[Dict[str, str]],
        *,
        schema_name: str,
        schema: Dict[str, Any],
        model: str | None = None,
    ) -> Dict[str, Any]:
        model = model or settings.OPENAI_MODEL

        resp = self.client.responses.create(
            model=model,
            input=messages,
            text={
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        )

        return json.loads(resp.output_text)
