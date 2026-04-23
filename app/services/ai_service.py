import json
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def build_prompt(
    user_message,
    knowledge_list=None,
    employee=None,
    history=None,
    post=None,
):
    """
    🔥 BACKWARD COMPATIBLE:
    - Code cũ vẫn chạy
    - Code mới có thêm context + post
    """

    # =========================
    # KNOWLEDGE
    # =========================
    if knowledge_list:
        # hỗ trợ cả dạng dict cũ và string mới
        def extract(k):
            if isinstance(k, dict):
                return k.get("content", "")
            return str(k)

        knowledge_text = "\n".join([f"- {extract(k)}" for k in knowledge_list])
    else:
        knowledge_text = "Không có dữ liệu nội bộ"

    # =========================
    # STYLE
    # =========================
    style_prompt = employee.style_prompt if employee else ""

    # =========================
    # POST
    # =========================
    if post:
        post_block = f"[POST]\n{post}"
    else:
        post_block = "[POST]\nKhông có thông tin bài viết."

    # =========================
    # CONVERSATION
    # =========================
    if history:
        convo_text = ""
        for h in history:
            role = "Khách" if h["role"] == "user" else "CSKH"
            convo_text += f"{role}: {h['text']}\n"

        conversation_block = f"[CONVERSATION]\n{convo_text}"
    else:
        conversation_block = "[CONVERSATION]\nKhông có lịch sử."

    # =========================
    # FINAL PROMPT
    # =========================
    prompt = f"""
Bạn đang tư vấn cho khách hàng.

Phong cách:
{style_prompt}

========================

{post_block}

========================

{conversation_block}

========================

[USER MESSAGE]
{user_message}

========================

Dữ liệu nội bộ:
{knowledge_text}

========================

Hướng dẫn:
- Ưu tiên dùng dữ liệu nội bộ
- Nếu dữ liệu chưa đủ:
  + Không bịa thông tin
  + Hỏi lại khách nếu thiếu dữ liệu

- Khách có thể gửi nhiều tin nhắn ngắn liên tiếp → hiểu là 1 ý

- Trả lời tự nhiên như người thật
- Không máy móc

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