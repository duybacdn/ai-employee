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
    has_price=False,
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

        1. Ưu tiên trả lời đúng trọng tâm câu hỏi hiện tại của khách.

        2. Nếu khách đang bình luận vào bài viết:
        → Phải ưu tiên hiểu theo nội dung bài viết.

        3. Với các câu ngắn như:
        - "đặt 1 bộ"
        - "còn không"
        - "ib em"
        - "lấy 2 cái"
        → cần suy luận theo bài viết và lịch sử hội thoại.

        4. Nếu có dữ liệu nội bộ liên quan:
        → ưu tiên sử dụng để trả lời.

        5. Không sử dụng dữ liệu không liên quan trực tiếp chỉ để cố thêm nội dung.

        6. Có thể gợi ý thêm sản phẩm/dịch vụ:
        - nếu liên quan tự nhiên
        - nếu giúp khách hàng hơn
        - nếu phù hợp ngữ cảnh sales/CSKH

        7. Không mở rộng sang chủ đề khác quá xa với câu hỏi hiện tại.

        8. Nếu dữ liệu có chứa giá:
        → cần trả lời giá rõ ràng khi phù hợp.

        9. Nếu khách hỏi dạng tính toán:
        → tự suy luận.

        10. Nếu chưa đủ thông tin:
        → hỏi lại ngắn gọn và tự nhiên.

        11. Trả lời tự nhiên như nhân viên CSKH/sales thật:
        - thân thiện
        - linh hoạt
        - không máy móc
        - không liệt kê dài dòng

        12. Ưu tiên:
        1) hiểu đúng nhu cầu khách
        2) trả lời đúng trọng tâm
        3) sau đó mới mở rộng hoặc gợi ý thêm nếu phù hợp
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