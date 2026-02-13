"""Pydantic v2 response models for the IDP OCR service."""

from pydantic import BaseModel


class TextBlock(BaseModel):
    text: str
    confidence: float
    bbox: list[list[int]]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]


class OcrPageResult(BaseModel):
    page: int
    blocks: list[TextBlock]
    full_text: str


class OcrResponse(BaseModel):
    success: bool
    filename: str
    pages: list[OcrPageResult]
    total_pages: int
    processing_time: float
    error: str | None = None


class TableCell(BaseModel):
    row: int
    col: int
    text: str
    confidence: float


class TableResult(BaseModel):
    page: int
    table_index: int
    headers: list[str]
    rows: list[list[str]]
    raw_cells: list[TableCell]


class TableResponse(BaseModel):
    success: bool
    filename: str
    tables: list[TableResult]
    total_tables: int
    processing_time: float
    error: str | None = None


class LayoutBlock(BaseModel):
    type: str  # text, title, table, figure, list, header, footer
    bbox: list[int]  # [x1, y1, x2, y2]
    text: str | None = None
    confidence: float


class LayoutPageResult(BaseModel):
    page: int
    blocks: list[LayoutBlock]


class LayoutResponse(BaseModel):
    success: bool
    filename: str
    pages: list[LayoutPageResult]
    processing_time: float
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    version: str
