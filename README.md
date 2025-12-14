# CSAI Employee – AI Nhân viên CSKH

## 1. Mục tiêu hệ thống
CSAI Employee là hệ thống xây dựng **nhân viên CSKH AI** cho doanh nghiệp, 
không chỉ trả lời câu hỏi mà còn:
- Hiểu tri thức nội bộ công ty
- Làm việc theo quy trình (workflow)
- Ghi nhớ lịch sử hội thoại & kinh nghiệm
- Có thể mở rộng sang các nhiệm vụ khác trong tương lai

Triết lý thiết kế:
> AI không phải tool → AI là một **nhân viên số**.

---

## 2. Kiến trúc tổng thể
- Backend: FastAPI
- AI Engine: OpenAI API
- Memory: Vector Database
- Workflow: Agent + Tool + Quy trình
- Deploy: Render

---

## 3. Cấu trúc thư mục

app/
├── agents/ # Nhân viên AI (Agent)
├── workflows/ # Quy trình nghiệp vụ
├── tools/ # Công cụ agent được phép dùng
├── memory/ # Bộ nhớ & tri thức công ty
├── services/ # Xử lý nghiệp vụ
├── api/ # API (FastAPI)
├── models/ # Database models
└── main.py # Entry point


---

## 4. Nguyên tắc phát triển
- Agent-first
- Modular
- Dễ mở rộng
- Có thể kế thừa & học hỏi tri thức công ty

---

## 5. Trạng thái dự án
- [x] Khởi tạo repository
- [ ] Setup môi trường
- [ ] Tạo agent CSKH đầu tiên
- [ ] Tích hợp memory
- [ ] Workflow thực tế
