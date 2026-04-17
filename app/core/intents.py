from dataclasses import dataclass
from typing import Literal

Intent = Literal["customer_support", "content", "ops", "unknown"]

@dataclass(frozen=True)
class RouteResult:
    intent: Intent
    confidence: float  # 0.0 - 1.0
    reason: str
