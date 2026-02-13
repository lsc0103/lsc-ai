"""Table extraction endpoint."""

import logging

from fastapi import APIRouter, File, Request, UploadFile

from ..models import TableResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["table"])


@router.post("/table", response_model=TableResponse)
async def extract_tables(
    request: Request,
    file: UploadFile = File(...),
) -> TableResponse:
    """Extract tables from a document (PDF or image).

    Uses heuristic spatial analysis on OCR results to detect
    row/column structure and build structured table data.

    - **file**: PDF, PNG, JPG, BMP, or TIFF file (max 100MB)
    """
    try:
        engine = request.app.state.engine
        file_bytes = await file.read()
        filename = file.filename or "unknown"

        logger.info("Table extraction request: %s (%d bytes)", filename, len(file_bytes))

        result = engine.extract_tables(file_bytes, filename)
        return result

    except Exception as e:
        logger.exception("Table extraction failed for %s", file.filename)
        return TableResponse(
            success=False,
            filename=file.filename or "unknown",
            tables=[],
            total_tables=0,
            processing_time=0.0,
            error=str(e),
        )
