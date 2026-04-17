from pathlib import Path
from datetime import datetime
from typing import Any, Dict

from app.tools.base_tool import BaseTool


class CreateReportFileTool(BaseTool):
    name = "create_report_file"
    description = "Tạo file báo cáo markdown trong thư mục reports/"

    def run(self, title: str, content: str) -> Dict[str, Any]:
        reports_dir = Path("reports")
        reports_dir.mkdir(exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title).strip()
        filename = f"{safe_title.replace(' ', '_')}_{ts}.md"
        path = reports_dir / filename

        path.write_text(f"# {title}\n\n{content}\n", encoding="utf-8")

        return {
            "status": "success",
            "file_path": str(path.resolve()),
            "filename": filename,
        }
