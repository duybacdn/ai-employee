from app.agents.base_agent import BaseAgent
from app.core.agent_state import AgentState
from app.services.openai_client import OpenAIClient
from app.tools.registry import build_default_registry


class OpsAgent(BaseAgent):
    def __init__(self):
        self.llm = OpenAIClient()
        self.registry = build_default_registry()

    def think(self, state: AgentState):
        state.thought = "Chọn tool phù hợp để xử lý yêu cầu ops."

    def decide(self, state: AgentState):
        # P0-08: mới có 1 tool, map thẳng
        state.decision = "create_report_file"

    def act(self, state: AgentState):
        tool = self.registry.get(state.decision)
        if not tool:
            state.response = "❌ Không tìm thấy tool phù hợp."
            return

        content = self.llm.text(
            f"""Viết báo cáo ngắn gọn (markdown) theo yêu cầu sau.
Có các mục: Tóm tắt, Số liệu (nếu thiếu thì để '—'), Việc cần làm tiếp theo.

Yêu cầu: {state.user_input}
"""
        ).strip()

        result = tool.run(title="Báo cáo tự động", content=content)

        state.response = (
            "✅ Đã tạo file báo cáo.\n"
            f"- Tên file: {result['filename']}\n"
            f"- Đường dẫn: {result['file_path']}"
        )

    def respond(self, state: AgentState):
        pass
