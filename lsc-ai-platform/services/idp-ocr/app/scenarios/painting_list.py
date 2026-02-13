"""Painting list (涂装清单) scenario processor.

Handles multi-page PDF painting lists from shipbuilding projects.
Key capability: automatic cross-page table merging.
"""

import logging
import time

from ..engine import OcrEngine
from ..models import TableResult

logger = logging.getLogger(__name__)


class PaintingListProcessor:
    """Process painting list PDFs with cross-page table merging."""

    def __init__(self, engine: OcrEngine):
        self.engine = engine

    def process(self, file_bytes: bytes, filename: str) -> dict:
        """Process a painting list PDF.

        Steps:
        1. OCR all pages
        2. Extract tables from each page
        3. Detect and merge cross-page tables
        4. Return merged table data

        Returns:
            dict with success, filename, tables, processing_time, etc.
        """
        start_time = time.time()

        try:
            # Step 1+2: Extract tables from document
            table_response = self.engine.extract_tables(file_bytes, filename)
            if not table_response.success:
                return {
                    "success": False,
                    "filename": filename,
                    "error": table_response.error,
                    "tables": [],
                    "processing_time": 0.0,
                }

            raw_tables = table_response.tables
            if not raw_tables:
                return {
                    "success": True,
                    "filename": filename,
                    "tables": [],
                    "total_tables": 0,
                    "processing_time": round(time.time() - start_time, 3),
                    "merge_info": "No tables detected",
                }

            # Step 3: Merge cross-page tables
            merged = self._merge_cross_page_tables(raw_tables)

            elapsed = round(time.time() - start_time, 3)

            return {
                "success": True,
                "filename": filename,
                "tables": [self._table_to_dict(t) for t in merged],
                "total_tables": len(merged),
                "raw_tables_count": len(raw_tables),
                "merged_count": len(raw_tables) - len(merged),
                "processing_time": elapsed,
            }

        except Exception as e:
            logger.exception("Painting list processing failed for %s", filename)
            return {
                "success": False,
                "filename": filename,
                "error": str(e),
                "tables": [],
                "processing_time": round(time.time() - start_time, 3),
            }

    def _merge_cross_page_tables(self, tables: list[TableResult]) -> list[TableResult]:
        """Merge tables that span across pages.

        Merge conditions:
        - Tables on consecutive pages
        - Similar column count (within +/- 1)
        - Subsequent table has no header row (detected by duplicate header check)
        """
        if len(tables) <= 1:
            return tables

        merged: list[TableResult] = []
        current = tables[0]

        for i in range(1, len(tables)):
            next_table = tables[i]

            if self._should_merge(current, next_table):
                current = self._merge_two_tables(current, next_table)
                logger.info(
                    "Merged table from page %d into table starting at page %d",
                    next_table.page,
                    current.page,
                )
            else:
                merged.append(current)
                current = next_table

        merged.append(current)
        return merged

    def _should_merge(self, prev: TableResult, curr: TableResult) -> bool:
        """Determine if two tables should be merged.

        Conditions:
        1. Consecutive pages (curr.page == prev.page + 1)
        2. Similar column count (within +/- 1)
        3. Current table's first row looks like a continuation (not a new header)
        """
        # Must be on consecutive pages
        if curr.page != prev.page + 1:
            return False

        # Column count should be similar
        prev_cols = len(prev.headers)
        curr_cols = len(curr.headers)
        if abs(prev_cols - curr_cols) > 1:
            return False

        # Check if current table has a duplicate header (same as prev)
        if self._detect_duplicate_header(prev, curr):
            return True

        # If column count matches exactly and first row doesn't look like a header
        if prev_cols == curr_cols and not self._looks_like_header(curr.headers):
            return True

        return False

    def _detect_duplicate_header(self, prev: TableResult, curr: TableResult) -> bool:
        """Check if current table's header is the same as the previous table's header.

        This indicates a cross-page table where the header is repeated.
        """
        if len(prev.headers) != len(curr.headers):
            return False

        # Fuzzy match: at least 70% of headers match
        matches = sum(
            1 for a, b in zip(prev.headers, curr.headers)
            if a.strip() == b.strip()
        )
        threshold = max(1, int(len(prev.headers) * 0.7))
        return matches >= threshold

    def _looks_like_header(self, row: list[str]) -> bool:
        """Heuristic: does this row look like a table header?

        Headers typically contain short text, no numbers, and common
        header keywords (Chinese or English).
        """
        header_keywords = [
            "序号", "名称", "规格", "型号", "数量", "单位", "单价", "金额",
            "备注", "编号", "材料", "面积", "涂层", "颜色", "区域", "部位",
            "no", "name", "spec", "qty", "unit", "price", "amount", "remark",
        ]

        keyword_count = 0
        for cell in row:
            cell_lower = cell.strip().lower()
            if any(kw in cell_lower for kw in header_keywords):
                keyword_count += 1

        # If more than 30% of cells contain header keywords, it's likely a header
        return keyword_count >= max(1, len(row) * 0.3)

    def _merge_two_tables(self, prev: TableResult, curr: TableResult) -> TableResult:
        """Merge two tables into one.

        If current table has duplicate headers, skip its first row (header).
        Otherwise, append all rows.
        """
        has_duplicate_header = self._detect_duplicate_header(prev, curr)

        if has_duplicate_header:
            # Skip the duplicate header row in current table
            new_rows = prev.rows + curr.rows
        else:
            # Current table's "headers" are actually data rows
            new_rows = prev.rows + [curr.headers] + curr.rows

        # Rebuild raw_cells with corrected row indices
        from ..models import TableCell

        raw_cells: list[TableCell] = []
        # Header row
        for c_idx, text in enumerate(prev.headers):
            matching = [c for c in prev.raw_cells if c.row == 0 and c.col == c_idx]
            conf = matching[0].confidence if matching else 0.9
            raw_cells.append(TableCell(row=0, col=c_idx, text=text, confidence=conf))

        # Data rows
        for r_idx, row in enumerate(new_rows):
            for c_idx, text in enumerate(row):
                raw_cells.append(
                    TableCell(row=r_idx + 1, col=c_idx, text=text, confidence=0.9)
                )

        return TableResult(
            page=prev.page,
            table_index=prev.table_index,
            headers=prev.headers,
            rows=new_rows,
            raw_cells=raw_cells,
        )

    def _table_to_dict(self, table: TableResult) -> dict:
        """Convert TableResult to plain dict for JSON response."""
        return {
            "page": table.page,
            "table_index": table.table_index,
            "headers": table.headers,
            "rows": table.rows,
            "row_count": len(table.rows),
            "col_count": len(table.headers),
        }
