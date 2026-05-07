from app.services.retrieval.keyword_service import extract_keywords


def rerank_knowledge(
    user_message,
    post_context,
    knowledge_raw,
):

    # ====================================
    # CONTEXT KEYWORDS
    # ====================================

    context_text = f"{user_message} {post_context or ''}"

    context_keywords = extract_keywords(context_text)

    print("[RERANK] context keywords:", context_keywords)

    scored = []

    for item in knowledge_raw:

        content = item.get("content", "")

        score = float(item.get("score", 0))

        content_keywords = extract_keywords(content)

        overlap = context_keywords.intersection(content_keywords)

        bonus = len(overlap) * 0.12

        final_score = score + bonus

        # ====================================
        # HARD FILTER
        # ====================================

        if score < 0.35 and bonus <= 0:
            continue

        scored.append({
            "content": content,
            "score": final_score,
            "base_score": score,
            "bonus": bonus,
            "overlap": overlap,
        })

    # ====================================
    # SORT
    # ====================================

    scored.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    # ====================================
    # DEBUG
    # ====================================

    for s in scored[:5]:
        print(
            f"[RERANK] final={s['score']:.3f} "
            f"base={s['base_score']:.3f} "
            f"bonus={s['bonus']:.3f} "
            f"overlap={list(s['overlap'])[:5]}"
        )

    return [
        s["content"]
        for s in scored[:5]
    ]