from app.db.session import SessionLocal
from app.models.core import Employee, Message, AnswerCandidate

db = SessionLocal()

print("=== EMPLOYEES ===")
for e in db.query(Employee).all():
    print(e.id)

print("\n=== MESSAGES ===")
for m in db.query(Message).limit(5):
    print(m.id, m.text)

print("\n=== CANDIDATES ===")
for c in db.query(AnswerCandidate).all():
    print(c.id, c.draft_text)

db.close()