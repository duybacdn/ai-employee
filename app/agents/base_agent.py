from abc import ABC, abstractmethod
from app.core.agent_state import AgentState


class BaseAgent(ABC):
    """
    Mọi agent trong hệ thống đều phải theo vòng:
    Think → Decide → Act → Respond
    """

    def run(self, user_input: str) -> str:
        state = AgentState(user_input=user_input)

        self.think(state)
        self.decide(state)
        self.act(state)
        self.respond(state)

        return state.response or ""

    @abstractmethod
    def think(self, state: AgentState):
        pass

    @abstractmethod
    def decide(self, state: AgentState):
        pass

    @abstractmethod
    def act(self, state: AgentState):
        pass

    @abstractmethod
    def respond(self, state: AgentState):
        pass
