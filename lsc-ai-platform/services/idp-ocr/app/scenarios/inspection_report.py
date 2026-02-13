"""Inspection report (检验报告) scenario processor.

Classifies NDT (Non-Destructive Testing) reports and extracts key fields.
Supports RT, UT, MT, PT report types common in shipbuilding QA.
"""

import logging
import re
import time

from ..engine import OcrEngine

logger = logging.getLogger(__name__)


class InspectionReportProcessor:
    """Process inspection/NDT reports: classify type, extract fields, validate."""

    # NDT classification keywords
    NDT_KEYWORDS: dict[str, list[str]] = {
        "RT": ["射线", "radiographic", "X射线", "γ射线", "RT检测", "射线检测", "射线探伤"],
        "UT": ["超声", "ultrasonic", "超声波", "UT检测", "超声检测", "超声探伤"],
        "MT": ["磁粉", "magnetic", "磁粉探伤", "MT检测", "磁粉检测"],
        "PT": ["渗透", "penetrant", "渗透探伤", "PT检测", "渗透检测"],
    }

    # Fields to extract from reports
    EXTRACT_FIELDS = [
        "report_no",    # 报告编号
        "date",         # 日期
        "inspector",    # 检验员
        "equipment_no", # 设备编号
        "weld_no",      # 焊缝编号
        "material",     # 材料
        "thickness",    # 厚度
        "standard",     # 检测标准
        "result",       # 检测结果
        "defect_desc",  # 缺陷描述
    ]

    # Regex patterns for field extraction (Chinese + English)
    FIELD_PATTERNS: dict[str, list[str]] = {
        "report_no": [
            r"报告[编号号码]*[：:\s]*([A-Za-z0-9\-/]+)",
            r"Report\s*No[.：:\s]*([A-Za-z0-9\-/]+)",
            r"编号[：:\s]*([A-Za-z0-9\-/]+)",
        ],
        "date": [
            r"日期[：:\s]*([\d]{4}[-/.年][\d]{1,2}[-/.月][\d]{1,2}[日]?)",
            r"Date[：:\s]*([\d]{4}[-/.][\d]{1,2}[-/.][\d]{1,2})",
            r"(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}[日]?)",
        ],
        "inspector": [
            r"检验[员人][：:\s]*([^\s,，。]{2,10})",
            r"Inspector[：:\s]*([^\s,，。]{2,20})",
            r"检测[人员][：:\s]*([^\s,，。]{2,10})",
        ],
        "equipment_no": [
            r"设备[编号]*[：:\s]*([A-Za-z0-9\-/]+)",
            r"Equipment\s*No[.：:\s]*([A-Za-z0-9\-/]+)",
        ],
        "weld_no": [
            r"焊[缝口][编号]*[：:\s]*([A-Za-z0-9\-/]+)",
            r"Weld\s*No[.：:\s]*([A-Za-z0-9\-/]+)",
            r"焊缝标识[：:\s]*([A-Za-z0-9\-/]+)",
        ],
        "material": [
            r"材[料质][：:\s]*([^\s,，。]{2,30})",
            r"Material[：:\s]*([^\s,，。]{2,30})",
        ],
        "thickness": [
            r"[壁板]?厚[度]*[：:\s]*([\d.]+\s*mm)",
            r"Thickness[：:\s]*([\d.]+\s*mm)",
            r"厚[：:\s]*([\d.]+)",
        ],
        "standard": [
            r"标准[：:\s]*([^\s,，。]{3,50})",
            r"Standard[：:\s]*([^\s,，。]{3,50})",
            r"(GB[/T]*\s*[\d\-.]+)",
            r"(NB[/T]*\s*[\d\-.]+)",
            r"(JB[/T]*\s*[\d\-.]+)",
        ],
        "result": [
            r"[检测结论果]*[：:\s]*(合格|不合格|Acceptable|Unacceptable|通过|不通过)",
            r"Result[：:\s]*(Pass|Fail|Acceptable|Unacceptable)",
            r"评定[级别等]*[：:\s]*([IⅠⅡⅢⅣiiiiv]+级?)",
        ],
        "defect_desc": [
            r"缺陷[描述说明]*[：:\s]*([^\n]{5,100})",
            r"Defect[：:\s]*([^\n]{5,100})",
            r"不合格[描述说明原因]*[：:\s]*([^\n]{5,100})",
        ],
    }

    def __init__(self, engine: OcrEngine):
        self.engine = engine

    def process(self, file_bytes: bytes, filename: str) -> dict:
        """Complete processing pipeline for an inspection report.

        Steps:
        1. OCR the document
        2. Classify NDT report type
        3. Extract key fields
        4. Validate quality
        5. Return structured result
        """
        start_time = time.time()

        try:
            # Step 1: OCR
            ocr_result = self.engine.ocr_document(file_bytes, filename)
            if not ocr_result.success:
                return {
                    "success": False,
                    "filename": filename,
                    "error": ocr_result.error,
                    "processing_time": 0.0,
                }

            # Combine all page text
            full_text = "\n".join(page.full_text for page in ocr_result.pages)

            if not full_text.strip():
                return {
                    "success": False,
                    "filename": filename,
                    "error": "No text extracted from document",
                    "processing_time": round(time.time() - start_time, 3),
                }

            # Step 2: Classify
            report_type = self.classify(full_text)

            # Step 3: Extract fields
            fields = self.extract_fields(full_text, report_type)

            # Step 4: Validate
            warnings = self.validate_quality(fields)

            elapsed = round(time.time() - start_time, 3)

            return {
                "success": True,
                "filename": filename,
                "report_type": report_type,
                "fields": fields,
                "warnings": warnings,
                "full_text": full_text,
                "total_pages": ocr_result.total_pages,
                "processing_time": elapsed,
            }

        except Exception as e:
            logger.exception("Inspection report processing failed for %s", filename)
            return {
                "success": False,
                "filename": filename,
                "error": str(e),
                "processing_time": round(time.time() - start_time, 3),
            }

    def classify(self, ocr_text: str) -> str:
        """Classify the NDT report type based on keyword matching.

        Returns one of: RT, UT, MT, PT, or UNKNOWN.
        """
        text_lower = ocr_text.lower()
        scores: dict[str, int] = {}

        for ndt_type, keywords in self.NDT_KEYWORDS.items():
            score = 0
            for keyword in keywords:
                # Count occurrences (case-insensitive for English keywords)
                count = text_lower.count(keyword.lower())
                score += count
            scores[ndt_type] = score

        if not any(scores.values()):
            return "UNKNOWN"

        # Return the type with highest score
        best_type = max(scores, key=scores.get)
        if scores[best_type] == 0:
            return "UNKNOWN"

        logger.info("Classified report as %s (scores: %s)", best_type, scores)
        return best_type

    def extract_fields(self, ocr_text: str, report_type: str) -> dict:
        """Extract key fields from OCR text using regex patterns.

        Args:
            ocr_text: Full OCR text content.
            report_type: Classified NDT type (for context-specific patterns).

        Returns:
            Dict mapping field names to extracted values (or None if not found).
        """
        fields: dict[str, str | None] = {}

        for field_name in self.EXTRACT_FIELDS:
            patterns = self.FIELD_PATTERNS.get(field_name, [])
            value = None

            for pattern in patterns:
                match = re.search(pattern, ocr_text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    break

            fields[field_name] = value

        return fields

    def validate_quality(self, fields: dict) -> list[str]:
        """Validate extracted fields and return a list of warnings.

        Checks:
        - Required fields present (report_no, date, result)
        - Date format is valid
        - Result is a recognized value
        """
        warnings: list[str] = []

        # Required fields
        required = ["report_no", "date", "result"]
        for field in required:
            if not fields.get(field):
                warnings.append(f"Required field '{field}' not found in document")

        # Date format check
        date_val = fields.get("date")
        if date_val:
            # Should contain 4-digit year
            if not re.search(r"20\d{2}", date_val):
                warnings.append(f"Date '{date_val}' may have invalid year format")

        # Result value check
        result_val = fields.get("result")
        if result_val:
            valid_results = [
                "合格", "不合格", "acceptable", "unacceptable",
                "pass", "fail", "通过", "不通过",
            ]
            if result_val.lower() not in valid_results:
                # Could be a grade (I级, II级, etc.) which is also valid
                if not re.match(r"[IⅠⅡⅢⅣiiiiv]+级?", result_val):
                    warnings.append(
                        f"Result '{result_val}' is not a standard pass/fail value"
                    )

        # Thickness format check
        thickness = fields.get("thickness")
        if thickness:
            # Should contain a number
            if not re.search(r"\d", thickness):
                warnings.append(f"Thickness '{thickness}' does not contain a number")

        return warnings
