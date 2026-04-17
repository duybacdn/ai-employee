import json
from app.services.openai_client import OpenAIClient
from app.core.intents import RouteResult, Intent


class RouterAgent:
    """
    Router phân loại intent: customer_support | content | ops | unknown
    Trả về RouteResult(intent, confidence, reason)
    """

    def __init__(self):
        self.llm = OpenAIClient()

    def route(self, user_input: str) -> RouteResult:
        schema = {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": ["customer_support", "content", "ops", "unknown"],
                },
                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                "reason": {"type": "string"},
            },
            "required": ["intent", "confidence", "reason"],
            "additionalProperties": False,
        }

        messages = [
            {"role": "system", "content": "Bạn là bộ phân loại intent cho hệ thống AI-Employee."},
            {
                "role": "user",
                "content": f"""
Phân loại câu lệnh vào 1 trong các intent:
- customer_support: tư vấn/CSKH/chốt đơn/hỏi giá/ship/khiếu nại
- content: viết bài/caption/kịch bản/outline/ý tưởng nội dung
- ops: thao tác hệ thống/công cụ (tạo file, đọc báo cáo, chạy script...)
- unknown: không rõ

Chỉ cần phân loại đúng intent. Câu lệnh: {user_input}
""".strip(),
            },
        ]

        data = self.llm.structured(messages, schema_name="route_intent", schema=schema)

        intent: Intent = data["intent"]
        conf = float(data["confidence"])
        reason = str(data["reason"]).strip() or "No reason"

        return RouteResult(intent=intent, confidence=conf, reason=reason)
