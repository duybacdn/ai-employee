import json
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def build_prompt(
    user_message,
    knowledge_list=None,
    employee=None,
    history=None,
    post=None,
):
    """
    CLEAN VERSION:
    - chỉ xử lý DATA
    - KHÔNG rule
    - KHÔNG logic business
    """

    # =========================
    # KNOWLEDGE (SAFE FORMAT)
    # =========================

    clean_knowledge = []

    def extract(k):
        if isinstance(k, dict):
            return (
                k.get("content")
                or k.get("text")
                or ""
            )
        return str(k)

    if knowledge_list:

        for k in knowledge_list:

            val = extract(k)

            if not val:
                continue

            val = val.strip()

            if len(val) < 5:
                continue

            clean_knowledge.append(val)

    knowledge_text = (
        "\n".join(f"- {k}" for k in clean_knowledge)
        if clean_knowledge
        else "NO_RELEVANT_KNOWLEDGE"
    )

    # =========================
    # POST
    # =========================

    post_block = (
        f"[POST]\n{post}"
        if post
        else "[POST]\nNONE"
    )

    # =========================
    # HISTORY (LIMITED)
    # =========================

    if history:

        convo = []

        for h in history[-10:]:

            role = "USER" if h["role"] == "user" else "AGENT"

            text = (h.get("text") or "").strip()

            if text:
                convo.append(f"{role}: {text}")

        conversation_block = (
            "[HISTORY]\n" + "\n".join(convo)
        )

    else:
        conversation_block = "[HISTORY]\nNONE"

    # =========================
    # USER
    # =========================

    user_block = f"[USER]\n{user_message}"

    # =========================
    # FINAL PROMPT
    # =========================

    prompt = f"""
{post_block}

{conversation_block}

{user_block}

[KNOWLEDGE]
{knowledge_text}

RETURN JSON:
{{
  "reply": "",
  "classification": "inbox",
  "tags": []
}}
"""

    return prompt.strip()


def call_ai(prompt: str, employee=None):

    try:

        system_base = """
You are a professional AI employee for multi-domain customer support, sales, and community management.

CORE RULES:

1. Understand user intent first.

2. Use provided knowledge ONLY if relevant.

3. If knowledge is not relevant:
   → DO NOT use it
   → ask clarifying question instead

4. Never hallucinate specific facts.

5. Never assume product/service if unclear.

6. If missing info:
   → ask short natural question

7. Always stay on topic.

8. Be natural, human-like, concise.

9. Never output invalid JSON.

10. Prioritize:
   intent → context → knowledge → response
"""

        messages = [
            {
                "role": "system",
                "content": system_base
            }
        ]

        if employee and employee.system_prompt:

            messages.append({
                "role": "system",
                "content": employee.system_prompt
            })

        if employee and employee.style_prompt:

            messages.append({
                "role": "system",
                "content": f"STYLE:\n{employee.style_prompt}"
            })

        messages.append({
            "role": "user",
            "content": prompt
        })

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.3,
        )

        content = response.choices[0].message.content.strip()

        if content.startswith("```"):

            content = (
                content
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )

        return content

    except Exception as e:

        print("AI ERROR:", e)

        return json.dumps({
            "reply": "Xin lỗi, hệ thống đang bận.",
            "classification": "inbox",
            "tags": []
        })