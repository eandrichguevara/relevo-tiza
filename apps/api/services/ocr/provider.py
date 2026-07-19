"""Abstract OCR provider interface and data types.

Defines the contract that all OCR backends must implement.
The pipeline consumes this interface so real and simulated OCR
providers are interchangeable.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

from PIL import Image


@dataclass
class OCRResult:
    """Result of extracting text from a single image crop.

    Attributes:
        text: The raw text recognised by OCR.
        confidence: Model confidence score between 0.0 and 1.0.
    """
    text: str
    confidence: float


@dataclass
class PageLayout:
    """The structure detected in a scanned page before per-crop OCR.

    Attributes:
        crops: List of image regions (PIL Images) that contain student answers.
        qr_codes: Decoded QR / barcode strings found on the page.
        student_code: Optional student identifier extracted from a QR code.
    """
    crops: List[Image.Image] = field(default_factory=list)
    qr_codes: List[str] = field(default_factory=list)
    student_code: Optional[str] = None


class OCRProvider(ABC):
    """Abstract base for all OCR backends.

    Subclasses must implement preprocessing (page → layout) and
    per-crop text extraction.
    """

    @abstractmethod
    async def preprocess_page(self, image: Image.Image) -> PageLayout:
        """Analyse a scanned page and return its structural layout.

        Steps typically include:
        - Deskew / denoise / binarise the image.
        - Detect answer regions (crops).
        - Locate and decode QR codes for student identification.

        Args:
            image: The scanned page as a PIL Image (RGB or grayscale).

        Returns:
            A PageLayout with cropped answer regions and any detected QR codes.
        """
        ...

    @abstractmethod
    async def extract_text(self, crop: Image.Image) -> OCRResult:
        """Run OCR on a single answer region and return the transcribed text.

        Args:
            crop: A PIL Image representing one student answer region.

        Returns:
            An OCRResult with the recognised text and confidence.
        """
        ...
