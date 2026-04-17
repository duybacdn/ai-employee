import logging
from rich.logging import RichHandler

def get_logger(name: str = "ai-employee") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    handler = RichHandler(rich_tracebacks=True, markup=True)
    formatter = logging.Formatter("%(message)s")
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False
    return logger
