"""Core OCR engine wrapping PaddleOCR."""

import logging
import time

import numpy as np
from paddleocr import PaddleOCR

from .models import (
    LayoutBlock,
    LayoutPageResult,
    LayoutResponse,
    OcrPageResult,
    OcrResponse,
    TableCell,
    TableResponse,
    TableResult,
    TextBlock,
)
from .pdf_converter import image_bytes_to_numpy, is_pdf, pdf_to_images_streaming
from .preprocessing import preprocess_image

logger = logging.getLogger(__name__)

# File size limit: 100 MB
MAX_FILE_SIZE = 100 * 1024 * 1024


class OcrEngine:
    """PaddleOCR engine for text extraction, table detection, and layout analysis."""

    def __init__(self):
        logger.info("Initializing PaddleOCR engine (CPU mode, ch+en)...")
        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang="ch",
            use_gpu=False,
            show_log=False,
        )
        self.models_loaded = True
        logger.info("PaddleOCR engine initialized successfully.")

    def ocr_image(self, img: np.ndarray, do_preprocess: bool = True) -> list[TextBlock]:
        """Run OCR on a single image and return text blocks.

        Args:
            img: BGR numpy array.
            do_preprocess: Whether to apply preprocessing.

        Returns:
            List of TextBlock with text, confidence, and bounding box.
        """
        if do_preprocess:
            img = preprocess_image(img)

        result = self.ocr.ocr(img, cls=True)

        blocks: list[TextBlock] = []
        if not result or not result[0]:
            return blocks

        for line in result[0]:
            bbox_raw = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text = line[1][0]
            confidence = float(line[1][1])

            bbox = [[int(p[0]), int(p[1])] for p in bbox_raw]
            blocks.append(TextBlock(text=text, confidence=confidence, bbox=bbox))

        return blocks

    def ocr_document(
        self, file_bytes: bytes, filename: str, options: dict | None = None
    ) -> OcrResponse:
        """OCR an entire document (PDF or image).

        Args:
            file_bytes: Raw file content.
            filename: Original filename (used to detect PDF).
            options: Optional preprocessing options.

        Returns:
            OcrResponse with per-page results.
        """
        if options is None:
            options = {}

        if len(file_bytes) > MAX_FILE_SIZE:
            return OcrResponse(
                success=False,
                filename=filename,
                pages=[],
                total_pages=0,
                processing_time=0.0,
                error=f"File too large: {len(file_bytes)} bytes (max {MAX_FILE_SIZE})",
            )

        start_time = time.time()
        do_preprocess = options.get("preprocess", True)
        pages: list[OcrPageResult] = []

        if is_pdf(filename):
            # Stream pages one at a time to limit memory
            for page_idx, img in enumerate(pdf_to_images_streaming(file_bytes)):
                blocks = self.ocr_image(img, do_preprocess=do_preprocess)
                full_text = "\n".join(b.text for b in blocks)
                pages.append(
                    OcrPageResult(page=page_idx + 1, blocks=blocks, full_text=full_text)
                )
                logger.info("OCR page %d: %d blocks", page_idx + 1, len(blocks))
        else:
            img = image_bytes_to_numpy(file_bytes)
            blocks = self.ocr_image(img, do_preprocess=do_preprocess)
            full_text = "\n".join(b.text for b in blocks)
            pages.append(OcrPageResult(page=1, blocks=blocks, full_text=full_text))

        elapsed = time.time() - start_time
        return OcrResponse(
            success=True,
            filename=filename,
            pages=pages,
            total_pages=len(pages),
            processing_time=round(elapsed, 3),
        )

    def extract_tables(
        self, file_bytes: bytes, filename: str, options: dict | None = None
    ) -> TableResponse:
        """Extract tables from a document using heuristic spatial analysis on OCR results.

        Strategy:
        1. OCR the document to get all text blocks with bounding boxes.
        2. Group blocks into rows by y-coordinate proximity.
        3. Detect columnar alignment to identify table regions.
        4. Build structured table from spatial grouping.
        """
        if options is None:
            options = {}

        if len(file_bytes) > MAX_FILE_SIZE:
            return TableResponse(
                success=False,
                filename=filename,
                tables=[],
                total_tables=0,
                processing_time=0.0,
                error=f"File too large: {len(file_bytes)} bytes (max {MAX_FILE_SIZE})",
            )

        start_time = time.time()
        all_tables: list[TableResult] = []

        if is_pdf(filename):
            images = list(pdf_to_images_streaming(file_bytes))
        else:
            images = [image_bytes_to_numpy(file_bytes)]

        for page_idx, img in enumerate(images):
            blocks = self.ocr_image(img, do_preprocess=True)
            if not blocks:
                continue

            tables = self._detect_tables_from_blocks(blocks, page_idx + 1)
            all_tables.extend(tables)

        elapsed = time.time() - start_time
        return TableResponse(
            success=True,
            filename=filename,
            tables=all_tables,
            total_tables=len(all_tables),
            processing_time=round(elapsed, 3),
        )

    def analyze_layout(self, file_bytes: bytes, filename: str) -> LayoutResponse:
        """Analyze document layout by classifying text block regions.

        Uses spatial heuristics on OCR results to classify blocks as
        title, text, header, footer, etc.
        """
        if len(file_bytes) > MAX_FILE_SIZE:
            return LayoutResponse(
                success=False,
                filename=filename,
                pages=[],
                processing_time=0.0,
                error=f"File too large: {len(file_bytes)} bytes (max {MAX_FILE_SIZE})",
            )

        start_time = time.time()
        pages: list[LayoutPageResult] = []

        if is_pdf(filename):
            images = list(pdf_to_images_streaming(file_bytes))
        else:
            images = [image_bytes_to_numpy(file_bytes)]

        for page_idx, img in enumerate(images):
            blocks = self.ocr_image(img, do_preprocess=True)
            layout_blocks = self._classify_layout_blocks(blocks, img.shape)
            pages.append(LayoutPageResult(page=page_idx + 1, blocks=layout_blocks))

        elapsed = time.time() - start_time
        return LayoutResponse(
            success=True,
            filename=filename,
            pages=pages,
            processing_time=round(elapsed, 3),
        )

    # --- Private helpers ---

    def _detect_tables_from_blocks(
        self, blocks: list[TextBlock], page: int
    ) -> list[TableResult]:
        """Heuristic table detection from OCR text blocks.

        Groups blocks by y-coordinate into rows, then checks for
        consistent column alignment to identify table regions.
        """
        if not blocks:
            return []

        # Sort blocks by top-left y, then x
        sorted_blocks = sorted(blocks, key=lambda b: (b.bbox[0][1], b.bbox[0][0]))

        # Group into rows by y-coordinate proximity
        rows: list[list[TextBlock]] = []
        current_row: list[TextBlock] = [sorted_blocks[0]]
        row_y = sorted_blocks[0].bbox[0][1]

        for block in sorted_blocks[1:]:
            block_y = block.bbox[0][1]
            # Blocks within 15px vertically are considered same row
            if abs(block_y - row_y) < 15:
                current_row.append(block)
            else:
                current_row.sort(key=lambda b: b.bbox[0][0])
                rows.append(current_row)
                current_row = [block]
                row_y = block_y

        if current_row:
            current_row.sort(key=lambda b: b.bbox[0][0])
            rows.append(current_row)

        # Find table regions: consecutive rows with similar column counts (>= 2 cols)
        tables: list[TableResult] = []
        table_rows: list[list[TextBlock]] = []
        prev_col_count = 0

        for row in rows:
            col_count = len(row)
            if col_count >= 2:
                if not table_rows or abs(col_count - prev_col_count) <= 1:
                    table_rows.append(row)
                    prev_col_count = col_count
                else:
                    # End current table if column count changes significantly
                    if len(table_rows) >= 2:
                        tables.append(
                            self._build_table_result(table_rows, page, len(tables))
                        )
                    table_rows = [row]
                    prev_col_count = col_count
            else:
                if len(table_rows) >= 2:
                    tables.append(
                        self._build_table_result(table_rows, page, len(tables))
                    )
                table_rows = []
                prev_col_count = 0

        # Don't forget the last table region
        if len(table_rows) >= 2:
            tables.append(self._build_table_result(table_rows, page, len(tables)))

        return tables

    def _build_table_result(
        self, table_rows: list[list[TextBlock]], page: int, table_index: int
    ) -> TableResult:
        """Build a TableResult from grouped rows of TextBlocks."""
        headers = [b.text for b in table_rows[0]]
        rows = [[b.text for b in row] for row in table_rows[1:]]

        raw_cells: list[TableCell] = []
        for r_idx, row in enumerate(table_rows):
            for c_idx, block in enumerate(row):
                raw_cells.append(
                    TableCell(
                        row=r_idx,
                        col=c_idx,
                        text=block.text,
                        confidence=block.confidence,
                    )
                )

        return TableResult(
            page=page,
            table_index=table_index,
            headers=headers,
            rows=rows,
            raw_cells=raw_cells,
        )

    def _classify_layout_blocks(
        self, blocks: list[TextBlock], img_shape: tuple
    ) -> list[LayoutBlock]:
        """Classify OCR blocks into layout types using spatial heuristics.

        Heuristics:
        - Top 10% of page height → header
        - Bottom 10% of page height → footer
        - Large font (tall bbox) and short text → title
        - Everything else → text
        """
        if not blocks:
            return []

        img_h = img_shape[0]
        img_w = img_shape[1]
        header_threshold = img_h * 0.10
        footer_threshold = img_h * 0.90

        layout_blocks: list[LayoutBlock] = []

        for block in blocks:
            # Get bounding box as [x1, y1, x2, y2]
            xs = [p[0] for p in block.bbox]
            ys = [p[1] for p in block.bbox]
            x1, y1 = min(xs), min(ys)
            x2, y2 = max(xs), max(ys)

            block_height = y2 - y1
            block_center_y = (y1 + y2) / 2
            text_len = len(block.text)

            # Classify
            if block_center_y < header_threshold:
                block_type = "header"
            elif block_center_y > footer_threshold:
                block_type = "footer"
            elif block_height > 40 and text_len < 50:
                block_type = "title"
            else:
                block_type = "text"

            layout_blocks.append(
                LayoutBlock(
                    type=block_type,
                    bbox=[int(x1), int(y1), int(x2), int(y2)],
                    text=block.text,
                    confidence=block.confidence,
                )
            )

        return layout_blocks
