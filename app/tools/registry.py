from typing import Dict, List, Optional

from app.tools.base_tool import BaseTool
from app.tools.file_tools import CreateReportFileTool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[str]:
        return list(self._tools.keys())


def build_default_registry() -> ToolRegistry:
    r = ToolRegistry()
    r.register(CreateReportFileTool())
    return r
