"""OpenCV image preprocessing for OCR optimization."""

import math

import cv2
import numpy as np


def preprocess_image(img: np.ndarray, options: dict | None = None) -> np.ndarray:
    """Apply preprocessing pipeline to improve OCR accuracy.

    Options:
        denoise (bool): Apply denoising. Default True.
        binarize (bool): Apply adaptive thresholding. Default False.
        deskew (bool): Auto-correct skew. Default True.
        enhance (bool): Apply CLAHE contrast enhancement. Default True.
    """
    if options is None:
        options = {}

    result = img.copy()

    # Convert to grayscale if needed
    if len(result.shape) == 3:
        gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    else:
        gray = result

    # Step 1: Denoise
    if options.get("denoise", True):
        gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # Step 2: Deskew
    if options.get("deskew", True):
        angle = detect_skew_angle(gray)
        if abs(angle) > 0.5:
            gray = deskew_image(gray, angle)

    # Step 3: CLAHE contrast enhancement
    if options.get("enhance", True):
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

    # Step 4: Binarize (optional, off by default — PaddleOCR handles this internally)
    if options.get("binarize", False):
        gray = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )

    # Convert back to BGR for PaddleOCR (expects 3-channel)
    result = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    return result


def detect_skew_angle(img: np.ndarray) -> float:
    """Detect document skew angle using minAreaRect on contours.

    Returns angle in degrees. Positive = clockwise skew.
    """
    # Threshold
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find contours and get all points
    coords = np.column_stack(np.where(binary > 0))
    if len(coords) < 50:
        return 0.0

    # Use minAreaRect on all foreground points
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]

    # Normalize angle to [-45, 45] range
    if angle < -45:
        angle = 90 + angle
    elif angle > 45:
        angle = angle - 90

    return angle


def deskew_image(img: np.ndarray, angle: float) -> np.ndarray:
    """Rotate image to correct skew.

    Args:
        img: Input image (grayscale or BGR).
        angle: Skew angle in degrees (from detect_skew_angle).
    """
    h, w = img.shape[:2]
    center = (w // 2, h // 2)

    # Compute rotation matrix
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

    # Compute new bounding box to avoid cropping
    cos_val = abs(math.cos(math.radians(angle)))
    sin_val = abs(math.sin(math.radians(angle)))
    new_w = int(h * sin_val + w * cos_val)
    new_h = int(h * cos_val + w * sin_val)

    # Adjust the rotation matrix for the new size
    rotation_matrix[0, 2] += (new_w - w) / 2
    rotation_matrix[1, 2] += (new_h - h) / 2

    # Use white background for documents
    border_value = 255 if len(img.shape) == 2 else (255, 255, 255)

    rotated = cv2.warpAffine(
        img, rotation_matrix, (new_w, new_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_value,
    )
    return rotated
