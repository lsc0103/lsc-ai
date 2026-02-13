"""Layout analysis endpoint."""

import logging

from fastapi import APIRouter, File, Request, UploadFile

from ..models import LayoutResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["layout"])


@router.post("/layout", response_model=LayoutResponse)
async def analyze_layout(
    request: Request,
    file: UploadFile = File(...),
) -> LayoutResponse:
    """Analyze document layout — classify regions as title, text, header, footer, etc.

    - **file**: PDF, PNG, JPG, BMP, or TIFF file (max 100MB)
    """
    try:
        engine = request.app.state.engine
        file_bytes = await file.read()
        filename = file.filename or "unknown"

        logger.info("Layout analysis request: %s (%d bytes)", filename, len(file_bytes))

        result = engine.analyze_layout(file_bytes, filename)
        return result

    except Exception as e:
        logger.exception("Layout analysis failed for %s", file.filename)
        return LayoutResponse(
            success=False,
            filename=file.filename or "unknown",
            pages=[],
            processing_time=0.0,
            error=str(e),
        )
