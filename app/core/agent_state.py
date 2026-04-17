from dataclasses import dataclass
from typing import Optional


@dataclass
class AgentState:
    user_input: str
    thought: Optional[str] = None
    decision: Optional[str] = None
    response: Optional[str] = None
