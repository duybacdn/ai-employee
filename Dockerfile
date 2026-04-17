FROM python:3.11-slim

# tránh log bị delay
ENV PYTHONUNBUFFERED=1

# thư mục làm việc
WORKDIR /app

# copy toàn bộ code vào container
COPY . .

# cài thư viện
RUN pip install --no-cache-dir -r requirements.txt

# chạy worker
CMD ["python", "worker.py"]