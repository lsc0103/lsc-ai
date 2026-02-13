"""Inspection report scenario endpoint."""

import logging

from fastapi import APIRouter, File, Request, UploadFile

from ..scenarios.inspection_report import InspectionReportProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


@router.post("/inspection-report")
async def process_inspection_report(
    request: Request,
    file: UploadFile = File(...),
) -> dict:
    """Process an NDT inspection report.

    Automatically classifies the report type (RT/UT/MT/PT) and extracts
    key fields like report number, date, inspector, weld number, result, etc.

    Includes quality validation with warnings for missing or suspect fields.

    - **file**: PDF or image file containing the inspection report (max 100MB)
    """
    try:
        engine = request.app.state.engine
        processor = InspectionReportProcessor(engine)

        file_bytes = await file.read()
        filename = file.filename or "unknown"

        logger.info("Inspection report request: %s (%d bytes)", filename, len(file_bytes))

        result = processor.process(file_bytes, filename)
        return result

    except Exception as e:
        logger.exception("Inspection report processing failed for %s", file.filename)
        return {
            "success": False,
            "filename": file.filename or "unknown",
            "error": str(e),
        }
