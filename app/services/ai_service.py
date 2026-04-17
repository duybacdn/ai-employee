import json
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def build_prompt(user_message, knowledge_list, employee=None):

    knowledge_text = "\n".join(
        [f"- {k['content']}" for k in knowledge_list]
    ) if knowledge_list else "Không có dữ liệu nội bộ"

    style_prompt = employee.style_prompt if employee else ""

    prompt = f"""
Bạn đang tư vấn cho khách hàng.

Phong cách:
{style_prompt}

========================

Dữ liệu nội bộ:
{knowledge_text}

========================

Câu hỏi:
{user_message}

========================

Hướng dẫn:
- Ưu tiên dùng dữ liệu nội bộ
- Nếu dữ liệu chưa đủ:
  + Trả lời theo hướng hỗ trợ
  + Không bịa thông tin cụ thể
  + Có thể hỏi lại khách
  + Gợi ý sản phẩm/dịch vụ liên quan

- Trả lời tự nhiên như người thật
- Tránh câu máy móc

========================

Trả JSON:
{{
  "reply": "...",
  "classification": "inbox",
  "tags": []
}}
"""
    return prompt.strip()

def call_ai(prompt: str, employee=None) -> str:
    try:
        system_base = (
            "Bạn là AI assistant.\n"
            "- Luôn trả JSON hợp lệ.\n"
            "- Không bịa dữ liệu cụ thể.\n"
        )

        employee_system = employee.system_prompt if employee else ""

        messages = [
            {
                "role": "system",
                "content": system_base
            }
        ]

        if employee_system:
            messages.append({
                "role": "system",
                "content": employee_system
            })

        messages.append({
            "role": "user",
            "content": prompt
        })

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.4,  # tăng nhẹ để tự nhiên hơn
        )

        content = response.choices[0].message.content.strip()

        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()

        return content

    except Exception as e:
        print(f"❌ AI Error: {e}")
        return json.dumps({
            "reply": "Xin lỗi, hệ thống đang bận.",
            "classification": "inbox",
            "tags": []
        })