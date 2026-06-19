from fastapi import APIRouter, UploadFile, File
from app.services.s3_service import upload_file

router = APIRouter()

@router.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    results = []

    for f in files:
        result = upload_file(f)
        results.append(result)

    return results