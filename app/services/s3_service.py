import boto3
import uuid
import os
from fastapi import HTTPException

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
AWS_BUCKET = os.getenv("AWS_BUCKET_NAME")

if not all([AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_BUCKET]):
    raise Exception("❌ Missing AWS S3 environment variables")

s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION,
)

# ✅ whitelist file type
ALLOWED_TYPES = {
    "image": ["image/jpeg", "image/png", "image/webp"],
    "video": ["video/mp4"],
    "audio": ["audio/mpeg", "audio/wav"],
    "file": ["application/pdf"]
}


def get_file_type(content_type: str):
    for t, types in ALLOWED_TYPES.items():
        if content_type in types:
            return t
    return None


def upload_file(file, folder="uploads"):
    content_type = file.content_type

    file_type = get_file_type(content_type)
    if not file_type:
        raise HTTPException(400, "File type not allowed")

    ext = content_type.split("/")[-1]
    key = f"{folder}/{file_type}/{uuid.uuid4()}.{ext}"

    try:
        s3.upload_fileobj(
            file.file,
            AWS_BUCKET,
            key,
            ExtraArgs={
                "ContentType": content_type
            },
        )
    except Exception as e:
        raise HTTPException(500, f"S3 upload failed: {str(e)}")

    # ✅ URL chuẩn
    url = f"https://{AWS_BUCKET}.s3.amazonaws.com/{key}"

    return {
        "url": url,
        "type": file_type
    }