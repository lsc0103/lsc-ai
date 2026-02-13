"""Health check endpoint."""

from fastapi import APIRouter, Request

from ..models import HealthResponse

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    engine = request.app.state.engine
    return HealthResponse(
        status="ok",
        models_loaded=engine.models_loaded if engine else False,
        version="1.0.0",
    )
