from app.agents.base_agent import BaseAgent
from app.core.agent_state import AgentState
from app.services.openai_client import OpenAIClient

class ContentAgent(BaseAgent):
    def __init__(self):
        self.llm = OpenAIClient()

    def think(self, state: AgentState):
        state.thought = "CONTENT: tạo nội dung marketing / kịch bản / caption theo yêu cầu."

    def decide(self, state: AgentState):
        state.decision = "generate_content"

    def act(self, state: AgentState):
        prompt = f"""
Bạn là nhân viên Content marketing (tiếng Việt), viết gọn, dễ quay TikTok/Facebook Reels.
Hãy tạo nội dung theo yêu cầu sau:

YÊU CẦU: {state.user_input}

Trả về:
1) Tiêu đề (1 câu)
2) Hook 3s (1-2 câu)
3) Dàn ý 5 gạch đầu dòng
4) CTA (1 câu)
"""
        state.response = self.llm.text(prompt).strip()

    def respond(self, state: AgentState):
        pass
