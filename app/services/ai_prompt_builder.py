# app/services/ai_prompt_builder.py

from app.db.session import SessionLocal
from app.models.core import Message, MessageDirection


def build_ai_prompt(conversation_id, current_message, limit=20):
    """
    Build prompt từ lịch sử conversation + message hiện tại
    """

    db = SessionLocal()

    try:
        # 1. Lấy lịch sử message gần nhất
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
            .all()
        )

        # Đảo lại cho đúng thứ tự thời gian
        messages.reverse()

        # 2. Format conversation history
        history_lines = []
        for msg in messages:
            role = "User" if msg.direction == MessageDirection.INBOUND else "Employee"
            history_lines.append(f"{role}: {msg.text}")

        conversation_history = "\n".join(history_lines)

        # 3. Build prompt
        prompt = f"""
            Bạn là AI Employee.

            Nhiệm vụ:
            - Trả lời khách hàng chuyên nghiệp, ngắn gọn, rõ ràng
            - Hiểu ngữ cảnh hội thoại
            - Phân loại message
            - Gợi ý tags

            --- Conversation history ---
            {conversation_history}

            --- Current message ---
            User: {current_message}

            --- YÊU CẦU QUAN TRỌNG ---
            Chỉ trả về JSON hợp lệ, KHÔNG thêm bất kỳ text nào ngoài JSON.

            Format bắt buộc:
            {{
            "reply": "câu trả lời cho khách hàng",
            "classification": "inbox",
            "tags": ["tag1", "tag2"]
            }}

            Quy tắc:
            - "classification" chỉ được là: inbox | comment | system
            - "tags" là danh sách string, không dấu cách (ví dụ: "chao_hoi", "pricing")
            - Nếu không có tag thì trả về []
            - JSON phải hợp lệ 100%
            """

        return prompt.strip()

    finally:
        db.close()