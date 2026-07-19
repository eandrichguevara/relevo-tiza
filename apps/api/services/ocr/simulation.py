"""Simulated OCR provider for development and testing.

Uses real OpenCV preprocessing (deskew, denoise, binarisation) but
simulates text extraction with deterministic hash-based mock responses.

ponytail: The simulated OCR returns plausible student answers without
a real ML model. This is sufficient for pipeline development, frontend
integration, and demo environments. Swap for a real OCR provider when
the production model is ready.
"""
from __future__ import annotations

import hashlib
import io
import math
import random
from typing import List, Optional

import cv2
import numpy as np
from PIL import Image

from config import settings
from services.ocr.provider import OCRProvider, OCRResult, PageLayout


# ─── Mock educational responses ──────────────────────────────────────
# Pool of realistic student answers in Spanish, grouped by subject.
# Each entry is a tuple of (text, base_confidence).
# ponytail: A handful of varied answers is enough to simulate the
# pipeline. Real OCR will replace this entirely.

_MOCK_ANSWERS: dict[str, List[tuple[str, float]]] = {
    "biology": [
        ("La célula es la unidad básica de la vida. Todos los seres vivos están formados por células. Las células pueden ser procariotas o eucariotas.", 0.92),
        ("La fotosíntesis es el proceso donde las plantas convierten luz solar en energía. Ocurre en los cloroplastos y produce glucosa y oxígeno.", 0.88),
        ("El sistema circulatorio transporta sangre, nutrientes y oxígeno por todo el cuerpo. El corazón bombea la sangre a través de las arterias y venas.", 0.85),
        ("Los ecosistemas están formados por factores bióticos y abióticos que interactúan entre sí formando cadenas alimentarias.", 0.78),
        ("La mitosis es la división celular que produce dos células hijas idénticas. La meiosis produce cuatro células con la mitad de material genético.", 0.82),
        ("Los animales invertebrados no tienen columna vertebral. Ejemplos: insectos, arácnidos, moluscos y crustáceos.", 0.75),
        ("El ADN contiene la información genética de los organismos y está formado por una doble hélice de nucleótidos.", 0.90),
        ("no me acuerdo bien de la fotosíntesis pero se que las plantas ocupan luz", 0.35),
        ("la celula es chica y tiene nucleo", 0.40),
    ],
    "history": [
        ("La Independencia de Chile se proclamó el 12 de febrero de 1818. Bernardo O'Higgins y José de San Martín fueron líderes clave.", 0.91),
        ("La Constitución de 1980 estableció las bases del actual orden institucional en Chile, con múltiples reformas desde entonces.", 0.84),
        ("El descubrimiento de América en 1492 por Cristóbal Colón cambió la historia del mundo, conectando Europa con el continente americano.", 0.87),
        ("La Guerra Fría fue un conflicto ideológico entre Estados Unidos y la Unión Soviética que duró desde 1947 hasta 1991.", 0.80),
        ("Los pueblos originarios de Chile incluyen a los mapuches, aimaras, rapa nui y selknam, cada uno con su propia cultura.", 0.86),
        ("La Revolución Francesa comenzó en 1789 y estableció los principios de libertad, igualdad y fraternidad.", 0.83),
        ("Chile fue gobernado por Augusto Pinochet entre 1973 y 1990 tras el golpe militar.", 0.76),
        ("no se mucho de historia pero se que colon descubrio america", 0.30),
        ("ohiggins fue importante para chile", 0.38),
    ],
    "mathematics": [
        ("La derivada de x^2 es 2x. La derivada representa la tasa de cambio instantánea de una función.", 0.93),
        ("El teorema de Pitágoras dice que en un triángulo rectángulo, a² + b² = c², donde c es la hipotenusa.", 0.95),
        ("Para resolver una ecuación de segundo grado ax² + bx + c = 0, usamos la fórmula x = (-b ± √(b² - 4ac)) / (2a).", 0.89),
        ("Una función lineal tiene la forma f(x) = mx + n, donde m es la pendiente y n la intersección con el eje y.", 0.87),
        ("El área de un círculo es πr² y su perímetro es 2πr, donde r es el radio del círculo.", 0.91),
        ("La probabilidad de un evento se calcula como casos favorables dividido por casos totales posibles.", 0.84),
        ("En la regla de tres simple, si A es a B como C es a X, entonces X = (B * C) / A.", 0.79),
        ("no entendi la pregunta de la derivada", 0.25),
        ("pitagoras era un matematico griego", 0.32),
        ("2+2=4 y 3+3=6 eso es facil", 0.45),
    ],
    "language": [
        ("El texto narrativo cuenta una historia con personajes, tiempo y espacio. Puede ser real o ficticio.", 0.86),
        ("Los verbos pueden estar en pasado, presente o futuro. La conjugación depende del sujeto y el tiempo verbal.", 0.88),
        ("El cuento es una narración breve con pocos personajes. La novela es más extensa y tiene tramas más complejas.", 0.84),
        ("La comunicación tiene seis elementos: emisor, receptor, mensaje, código, canal y contexto.", 0.82),
        ("Un poema utiliza versos y estrofas. La rima puede ser consonante o asonante dependiendo de los sonidos.", 0.79),
        ("La noticia es un texto periodístico que informa sobre hechos actuales de manera objetiva y veraz.", 0.87),
        ("Los sustantivos pueden ser propios o comunes, concretos o abstractos, individuales o colectivos.", 0.83),
        ("me gusta leer cuentos de misterio", 0.42),
        ("no se que son los verbos", 0.28),
    ],
    "general": [
        ("La respuesta correcta según lo estudiado en clases es que el proceso se compone de varias etapas interconectadas que deben realizarse en orden.", 0.72),
        ("Este tema lo vimos en la clase pasada. El profesor explicó que hay que seguir los pasos cuidadosamente para obtener el resultado esperado.", 0.68),
        ("No estoy seguro de la respuesta, pero creo que está relacionado con lo que vimos en el laboratorio.", 0.35),
        ("", 1.0),  # blank answer
        ("No entendí la pregunta", 0.30),
        ("La respuesta es A", 0.50),
        ("Si, la respuesta correcta es la opción B porque así lo dice el texto de estudio", 0.65),
    ],
}

# Deterministic subject selection based on question number
_SUBJECTS = ["mathematics", "biology", "history", "language", "general"]


def _pick_mock_answer(question_number: int, seed: str) -> tuple[str, float, str]:
    """Return a deterministic but varied mock answer based on question index and seed.

    The seed (typically an image hash) ensures the same image always
    produces the same answer, while different questions yield different
    subjects and answers.
    """
    subject = _SUBJECTS[question_number % len(_SUBJECTS)]
    pool = _MOCK_ANSWERS[subject]
    idx = (hashlib.md5(f"{seed}:q{question_number}".encode()).digest()[0]) % len(pool)
    text, confidence = pool[idx]
    return text, confidence, subject


def _deskew(image: np.ndarray) -> np.ndarray:
    """Correct small rotation skew in a grayscale image.

    Uses OpenCV's Hough Line Transform to detect the dominant angle
    and rotates the image to compensate.
    """
    coords = np.column_stack(np.where(image > 0))
    if len(coords) < 5:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:
        return image  # already straight enough
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image, matrix, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def _denoise(image: np.ndarray) -> np.ndarray:
    """Apply non-local means denoising to reduce scanner noise."""
    return cv2.fastNlMeansDenoising(image, None, 10, 7, 21)


def _binarize(image: np.ndarray) -> np.ndarray:
    """Convert grayscale to pure black-and-white using Otsu thresholding."""
    _, binary = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def _simulate_crops(image: Image.Image, num_crops: int = 5) -> List[Image.Image]:
    """Simulate crop detection by dividing the image into N horizontal strips.

    ponytail: Real crop detection would use contour finding or a layout
    model. For the simulated pipeline, simple strips are sufficient to
    exercise the end-to-end flow.
    """
    width, height = image.size
    crop_height = height // num_crops
    crops: List[Image.Image] = []
    for i in range(num_crops):
        top = i * crop_height
        bottom = top + crop_height if i < num_crops - 1 else height
        crop = image.crop((0, top, width, bottom))
        crops.append(crop)
    return crops


def _detect_qr_codes(image: Image.Image) -> List[str]:
    """Attempt to decode QR codes / barcodes from the image.

    ponytail: QR detection is simulated. In production, use pyzbar
    or a real QR scanner. For now we return an empty list so the
    pipeline relies on student_code passed via other means.
    """
    _ = image  # placeholder for future real QR detection
    return []


class SimulationOCRProvider(OCRProvider):
    """OCR provider that simulates text extraction for development.

    Preprocessing steps (deskew, denoise, binarize) use **real OpenCV**
    operations. Text extraction returns deterministic mock answers
    based on a hash of the image content.
    """

    def __init__(self, crops_per_page: int = 5):
        self.crops_per_page = crops_per_page
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD
        self._crop_call_counter = 0  # ensures variety across crops from the same page

    async def preprocess_page(self, image: Image.Image) -> PageLayout:
        """Real preprocessing + simulated layout detection.

        Applies deskew, denoise, and binarisation via OpenCV, then
        simulates crop detection by dividing the page into horizontal
        strips.
        """
        # Convert PIL → OpenCV (grayscale)
        img_array = np.array(image.convert("L"))

        # Real OpenCV preprocessing
        deskewed = _deskew(img_array)
        denoised = _denoise(deskewed)
        binarized = _binarize(denoised)

        # Convert back to PIL for storage / further processing
        processed_pil = Image.fromarray(binarized)

        # Simulated crop detection
        crops = _simulate_crops(processed_pil, self.crops_per_page)

        # QR detection (simulated — always empty for now)
        qr_codes = _detect_qr_codes(image)

        return PageLayout(
            crops=crops,
            qr_codes=qr_codes,
            student_code=None,
        )

    async def extract_text(self, crop: Image.Image) -> OCRResult:
        """Return deterministic mock OCR text based on crop content hash.

        The image hash ensures the same crop always produces the same
        answer (deterministic). Different crops yield varied answers
        from different subject pools.
        """
        # Compute image hash for deterministic seed
        img_bytes = io.BytesIO()
        crop.save(img_bytes, format="PNG")
        raw_hash = hashlib.sha256(img_bytes.getvalue()).hexdigest()

        # Mix in the sequential crop index to guarantee variety across
        # crops even when they come from a uniform image.
        self._crop_call_counter += 1
        mixed_seed = f"{raw_hash}:crop{self._crop_call_counter}"
        seed = hashlib.sha256(mixed_seed.encode()).hexdigest()

        # Derive question number from seed (simulated)
        # ponytail: In the real pipeline, crop sequence position maps to
        # question_number. Here we use a hash-based index.
        q_number = int(seed[:8], 16) % 10 + 1

        text, confidence, subject = _pick_mock_answer(q_number, seed)

        # Jitter confidence slightly for variety
        confidence = round(max(0.0, min(1.0, confidence + random.uniform(-0.05, 0.05))), 2)

        return OCRResult(
            text=text,
            confidence=confidence,
        )

    @property
    def requires_review(self) -> bool:
        """Placeholder — real evaluation uses per-answer confidence."""
        return False
