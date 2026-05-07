import re


STOPWORDS = {
    "là",
    "và",
    "có",
    "không",
    "được",
    "cho",
    "với",
    "cần",
    "bị",
    "cái",
    "này",
    "kia",
    "đó",
    "ok",
    "ừ",
    "uh",
    "à",
    "ơi",
    "ạ",
    "em",
    "anh",
    "chị",
    "shop",
    "mình",
}


def extract_keywords(text: str):

    if not text:
        return set()

    text = text.lower()

    words = re.findall(r'\w+', text)

    words = [
        w.strip()
        for w in words
        if len(w.strip()) >= 2
        and w not in STOPWORDS
    ]

    keywords = set(words)

    # ====================================
    # ADD 2-WORD PHRASES
    # ====================================

    for i in range(len(words) - 1):

        phrase = f"{words[i]} {words[i+1]}"

        keywords.add(phrase)

    return keywords