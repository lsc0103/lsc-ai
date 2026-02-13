"""OCR document endpoint."""

import logging

from fastapi import APIRouter, File, Form, Request, UploadFile

from ..models import OcrResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ocr"])


@router.post("/ocr", response_model=OcrResponse)
async def ocr_document(
    request: Request,
    file: UploadFile = File(...),
    preprocess: bool = Form(True),
    language: str = Form("ch"),
) -> OcrResponse:
    """Extract text from a document (PDF or image).

    - **file**: PDF, PNG, JPG, BMP, or TIFF file (max 100MB)
    - **preprocess**: Apply image preprocessing (denoise, deskew, enhance)
    - **language**: OCR language (ch = Chinese+English, en = English only)
    """
    try:
        engine = request.app.state.engine
        file_bytes = await file.read()
        filename = file.filename or "unknown"

        logger.info("OCR request: %s (%d bytes, preprocess=%s, lang=%s)",
                     filename, len(file_bytes), preprocess, language)

        options = {"preprocess": preprocess, "language": language}
        result = engine.ocr_document(file_bytes, filename, options)
        return result

    except Exception as e:
        logger.exception("OCR failed for %s", file.filename)
        return OcrResponse(
            success=False,
            filename=file.filename or "unknown",
            pages=[],
            total_pages=0,
            processing_time=0.0,
            error=str(e),
        )
