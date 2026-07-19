"""OCR service package — factory for provider instantiation.

Usage:
    from services.ocr import create_ocr_provider
    ocr = create_ocr_provider()
    layout = await ocr.preprocess_page(image)
    result = await ocr.extract_text(crop)
"""
from __future__ import annotations

from config import settings
from services.ocr.provider import OCRProvider


def create_ocr_provider() -> OCRProvider:
    """Factory: return the configured OCR backend.

    Reads ``settings.OCR_MODE`` to decide which implementation to
    instantiate. Currently only ``"simulation"`` is supported.
    """
    mode = settings.OCR_MODE.strip().lower()

    if mode == "simulation":
        from services.ocr.simulation import SimulationOCRProvider
        return SimulationOCRProvider()

    # Future: real OCR providers
    # if mode == "fusion":
    #     from services.ocr.fusion import FusionOCRProvider
    #     return FusionOCRProvider()
    # if mode == "tesseract":
    #     from services.ocr.tesseract import TesseractOCRProvider
    #     return TesseractOCRProvider()

    raise ValueError(
        f"Unknown OCR_MODE: {settings.OCR_MODE!r}. "
        "Expected 'simulation'."
    )
