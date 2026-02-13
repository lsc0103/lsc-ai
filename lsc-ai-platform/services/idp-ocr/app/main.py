"""LSC-AI IDP OCR Service — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .engine import OcrEngine
from .routers import health, layout, ocr, table
from .routers import scenario_inspection, scenario_painting

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize OcrEngine on startup."""
    logger.info("Starting IDP OCR Service...")
    engine = OcrEngine()
    app.state.engine = engine
    logger.info("OcrEngine ready. Models loaded: %s", engine.models_loaded)
    yield
    logger.info("Shutting down IDP OCR Service.")


app = FastAPI(
    title="LSC-AI IDP OCR Service",
    description="PaddleOCR-based document processing microservice for shipbuilding industry.",
    version="1.0.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(health.router)
app.include_router(ocr.router)
app.include_router(table.router)
app.include_router(layout.router)
app.include_router(scenario_painting.router)
app.include_router(scenario_inspection.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler to ensure JSON error responses."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": f"Internal server error: {type(exc).__name__}",
        },
    )
