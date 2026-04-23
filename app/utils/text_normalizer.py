# utils/text_normalizer.py

import re

NORMALIZE_MAP = {
    "ko": "không",
    "k": "không",
    "ntn": "như thế nào",
    "bn": "bao nhiêu",
    "dc": "được",
    "vs": "với",
    "ib": "inbox",
}

def normalize_text(text: str) -> str:
    if not text:
        return ""

    original = text

    text = text.lower().strip()

    # replace slang
    words = text.split()
    normalized_words = [NORMALIZE_MAP.get(w, w) for w in words]
    text = " ".join(normalized_words)

    # remove duplicate spaces
    text = re.sub(r"\s+", " ", text)

    print(f"[NORMALIZE] before: {original}")
    print(f"[NORMALIZE] after:  {text}")

    return text