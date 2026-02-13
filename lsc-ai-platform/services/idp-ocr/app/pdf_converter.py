"""PDF to image conversion using pdf2image (Apache 2.0 compatible)."""

import io

import numpy as np
from pdf2image import convert_from_bytes
from PIL import Image


def pdf_to_images(pdf_bytes: bytes, dpi: int = 300) -> list[np.ndarray]:
    """Convert PDF bytes to a list of numpy arrays (one per page).

    Uses pdf2image (poppler-based) to avoid AGPL-licensed PyMuPDF.

    Args:
        pdf_bytes: Raw PDF file bytes.
        dpi: Resolution for rendering. 300 is good for OCR.

    Returns:
        List of numpy arrays in BGR format (OpenCV convention).
    """
    images = convert_from_bytes(pdf_bytes, dpi=dpi, fmt="png")

    result: list[np.ndarray] = []
    for pil_img in images:
        # Convert PIL RGB to numpy BGR (OpenCV format)
        rgb_array = np.array(pil_img)
        bgr_array = rgb_array[:, :, ::-1].copy()
        result.append(bgr_array)

    return result


def pdf_to_images_streaming(pdf_bytes: bytes, dpi: int = 300):
    """Generator version — yields one page at a time for large PDFs.

    Avoids loading all pages into memory simultaneously.
    """
    images = convert_from_bytes(pdf_bytes, dpi=dpi, fmt="png")

    for pil_img in images:
        rgb_array = np.array(pil_img)
        bgr_array = rgb_array[:, :, ::-1].copy()
        yield bgr_array
        # Allow GC to reclaim the PIL image
        del pil_img


def is_pdf(filename: str) -> bool:
    """Check if filename has a PDF extension."""
    return filename.lower().endswith(".pdf")


def image_bytes_to_numpy(file_bytes: bytes) -> np.ndarray:
    """Convert image file bytes to numpy array (BGR).

    Supports PNG, JPG, BMP, TIFF, etc.
    """
    pil_img = Image.open(io.BytesIO(file_bytes))
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    rgb_array = np.array(pil_img)
    bgr_array = rgb_array[:, :, ::-1].copy()
    return bgr_array
