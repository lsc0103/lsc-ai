"""Painting list scenario endpoint."""

import logging

from fastapi import APIRouter, File, Request, UploadFile

from ..scenarios.painting_list import PaintingListProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("/painting-list")
async def process_painting_list(
    request: Request,
    file: UploadFile = File(...),
) -> dict:
    """Process a painting list PDF with automatic cross-page table merging.

    Specialized for shipbuilding painting/coating lists that often span
    multiple pages. Automatically detects and merges continuation tables.

    - **file**: PDF file containing the painting list (max 100MB)
    """
    try:
        engine = request.app.state.engine
        processor = PaintingListProcessor(engine)

        file_bytes = await file.read()
        filename = file.filename or "unknown"

        logger.info("Painting list request: %s (%d bytes)", filename, len(file_bytes))

        result = processor.process(file_bytes, filename)
        return result

    except Exception as e:
        logger.exception("Painting list processing failed for %s", file.filename)
        return {
            "success": False,
            "filename": file.filename or "unknown",
            "error": str(e),
        }
