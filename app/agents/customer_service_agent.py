from app.agents.base_agent import BaseAgent
from app.core.agent_state import AgentState
from app.services.openai_client import OpenAIClient

class CustomerServiceAgent(BaseAgent):
    def __init__(self):
        self.llm = OpenAIClient()

    def think(self, state: AgentState):
        state.thought = "CSKH: soạn phản hồi cho khách, rõ ràng, thân thiện, chốt đơn nếu phù hợp."

    def decide(self, state: AgentState):
        state.decision = "respond_directly"

    def act(self, state: AgentState):
        prompt = f"""
Bạn là nhân viên CSKH chuyên nghiệp (tiếng Việt), lịch sự, ngắn gọn, có CTA nhẹ.
Nhiệm vụ: trả lời khách dựa trên yêu cầu sau.

YÊU CẦU KHÁCH: {state.user_input}

Yêu cầu:
- Tối đa 6-10 dòng
- Nếu khách hỏi giá/ship: hỏi thêm 1-2 thông tin cần thiết (địa chỉ, số lượng…)
- Không bịa đặt số liệu nếu không có (giá, tồn kho…); nếu thiếu thì hỏi lại.
"""
        state.response = self.llm.text(prompt).strip()

    def respond(self, state: AgentState):
        pass
