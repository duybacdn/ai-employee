from app.agents.base_agent import BaseAgent
from app.core.agent_state import AgentState
from app.services.openai_client import OpenAIClient


class EmployeeAgent(BaseAgent):
    """
    Nhân viên AI tổng quát – giao tiếp & suy luận
    """

    def __init__(self):
        self.llm = OpenAIClient()

    def think(self, state: AgentState):
        prompt = f"""
Bạn là một nhân viên AI chuyên nghiệp.
Hãy phân tích yêu cầu sau một cách ngắn gọn:

YÊU CẦU: {state.user_input}

Chỉ trả lời phần PHÂN TÍCH (1-2 câu).
"""
        state.thought = self.llm.text(prompt).strip()

    def decide(self, state: AgentState):
        state.decision = "respond_directly"

    def act(self, state: AgentState):
        prompt = f"""
Bạn là nhân viên AI thân thiện, rõ ràng.
Dựa trên phân tích sau:
{state.thought}

Hãy trả lời yêu cầu của người dùng một cách súc tích.
"""
        state.response = self.llm.text(prompt).strip()

    def respond(self, state: AgentState):
        # Giai đoạn này chỉ pass-through
        pass
