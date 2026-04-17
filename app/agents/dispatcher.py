class Dispatcher:
    """
    Điều phối: nhận "intent" -> gọi đúng workflow/agent/tool.
    Hiện tại chỉ ping để test skeleton.
    """

    def ping(self) -> str:
        return "pong"
