"""QR code generation for evaluation sheets."""
import qrcode
from io import BytesIO


def generate_qr_code(data: str, size: int = 200) -> BytesIO:
    """Generate a QR code PNG image."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
