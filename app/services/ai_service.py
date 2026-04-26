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
    🔥 IMPROVED VERSION:
    - Ép AI dùng knowledge
    - Nhận diện dữ liệu giá
    - Không phá backward compatibility
    """

    # =========================
    # KNOWLEDGE
    # =========================
    has_knowledge = bool(knowledge_list)

    if knowledge_list:
        def extract(k):
            if isinstance(k, dict):
                return k.get("content", "")
            return str(k)

        clean_knowledge = [extract(k) for k in knowledge_list if extract(k)]

        knowledge_text = "\n".join([f"- {k}" for k in clean_knowledge])
    else:
        clean_knowledge = []
        knowledge_text = "Không có dữ liệu nội bộ"

    # 🔥 detect giá
    has_price = any(
        ("k" in k.lower() or "giá" in k.lower() or "vnd" in k.lower())
        for k in clean_knowledge
    )

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
    # 🔥 RULES (QUAN TRỌNG NHẤT)
    # =========================
    rule_block = f"""
QUY TẮC BẮT BUỘC:

1. Nếu có dữ liệu nội bộ:
   → PHẢI sử dụng để trả lời
   → KHÔNG được bỏ qua

2. Nếu dữ liệu có chứa giá:
   → PHẢI trả lời giá rõ ràng
   → Có thể ước tính nếu khách hỏi nhiều số lượng

3. KHÔNG được nói:
   - "chưa có thông tin"
   - "cần kiểm tra"
   - "liên hệ để báo giá"
   nếu dữ liệu nội bộ đã có thông tin liên quan

4. Nếu có nhiều dữ liệu:
   → Ưu tiên dữ liệu có số (giá, số lượng)

5. Nếu khách hỏi dạng tính toán:
   → Tự suy luận (ví dụ: 3 lỗ × 50k = 150k)

6. Nếu KHÔNG có dữ liệu nội bộ:
   → Mới được hỏi lại khách

7. Trả lời tự nhiên như người thật
"""

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

{rule_block}

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