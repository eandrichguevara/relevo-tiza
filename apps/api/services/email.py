"""Email backend abstraction for transactional email sending.

Provides a pluggable email interface with SMTP implementation.
In development, use Mailpit (SMTP_HOST=localhost, SMTP_PORT=1025)
which captures all messages in a web UI at http://localhost:8025.

Usage:
    from services.email import email
    ok = await email.send("user@example.com", "Hello", "<h1>Hi</h1>")
    await send_verification_email("user@example.com", "abc123", "TIZA")
"""
from __future__ import annotations

import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# ─── Abstract Base ───────────────────────────────────────────────────


class EmailBackend(ABC):
    """Abstract email backend. Single send method."""

    @abstractmethod
    async def send(self, to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
        """Send an email. Returns True on success, False on failure."""
        ...


# ─── SMTPEmailBackend ────────────────────────────────────────────────


class SMTPEmailBackend(EmailBackend):
    """SMTP-based email sender.

    Uses settings.SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
    SMTP_USE_TLS, and EMAIL_FROM.

    Constructs a MIME multipart/alternative message with both HTML and
    plaintext parts so the client's mail reader picks the best format.
    """

    # ponytail: smtplib from stdlib is sufficient. No need for a library
    # like `aiosmtplib` for the volume this app will handle. The send()
    # call is blocking but fast — we run it in the async event loop's
    # default thread pool executor for simplicity.
    # If throughput becomes a concern, swap to a background task queue.

    async def send(
        self, to: str, subject: str, html: str, text: Optional[str] = None
    ) -> bool:
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to
        msg["Subject"] = subject

        # Plaintext fallback
        text_part = MIMEText(text or _strip_html(html), "plain", "utf-8")
        msg.attach(text_part)

        # HTML part
        html_part = MIMEText(html, "html", "utf-8")
        msg.attach(html_part)

        try:
            import asyncio

            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(
                None, self._smtp_send, to, msg
            )
        except Exception:
            logger.exception("Failed to send email to %s", to)
            return False

    def _smtp_send(self, to: str, msg: MIMEMultipart) -> bool:
        """Synchronous SMTP send, called via executor."""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
        return True


# ─── NullEmailBackend (safe fallback) ────────────────────────────────


class NullEmailBackend(EmailBackend):
    """No-op email backend that logs instead of sending.

    Useful for testing or when SMTP is not configured.
    """

    async def send(
        self, to: str, subject: str, html: str, text: Optional[str] = None
    ) -> bool:
        logger.info(
            "[NullEmail] Would send to=%s subject=%s html_len=%d",
            to,
            subject,
            len(html),
        )
        return True


# ─── Helpers ─────────────────────────────────────────────────────────


def _strip_html(html: str) -> str:
    """Crude HTML-to-text conversion. Good enough for email fallback."""
    import re

    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _branded_html(body: str, brand: str) -> str:
    """Wrap body HTML in a branded email template."""
    brand_color = "#F4813D" if brand.upper() == "TIZA" else "#2563EB"
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:24px;background:{brand_color};text-align:center;">
<font color="#fff" size="5"><b>{brand}</b></font>
</td></tr>
<tr><td style="padding:24px;">
{body}
</td></tr>
<tr><td style="padding:16px 24px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:center;">
<p style="margin:0;">© {brand} — Todos los derechos reservados.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


async def send_verification_email(to: str, token: str, brand: str = "TIZA") -> bool:
    """Send an email verification link.

    Args:
        to: Recipient email.
        token: Verification token to include in the link.
        brand: Brand name for email styling.
    """
    from services.email import email  # avoid circular import at module level

    verify_url = f"https://{brand.lower()}.app/verify?token={token}"
    body = f"""\
<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hola,</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;">
Gracias por registrarte en <b>{brand}</b>. Para verificar tu correo,
haz clic en el siguiente enlace:
</p>
<p style="margin:0 0 16px;text-align:center;">
<a href="{verify_url}" style="display:inline-block;padding:12px 32px;background:#F4813D;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
Verificar correo
</a>
</p>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
O copia este enlace en tu navegador:<br>
<code style="word-break:break-all;">{verify_url}</code>
</p>
<p style="margin:0;font-size:13px;color:#6b7280;">Si no solicitaste este registro, ignora este mensaje.</p>"""

    html = _branded_html(body, brand)
    return await email.send(
        to=to,
        subject=f"Verifica tu correo — {brand}",
        html=html,
    )


async def send_approval_notification(
    to: str, user_name: str, tenant_name: str, brand: str = "TIZA"
) -> bool:
    """Notify a user that their registration has been approved.

    Args:
        to: Recipient email.
        user_name: User's full name.
        tenant_name: Name of the tenant/school.
        brand: Brand name for email styling.
    """
    from services.email import email

    login_url = f"https://{brand.lower()}.app/auth/login"
    body = f"""\
<p style="margin:0 0 16px;font-size:15px;color:#374151;">¡Hola, {user_name}!</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;">
Tu cuenta en <b>{tenant_name}</b> ha sido <b style="color:#16a34a;">aprobada</b>.
Ya puedes iniciar sesión y comenzar a usar {brand}.
</p>
<p style="margin:0 0 16px;text-align:center;">
<a href="{login_url}" style="display:inline-block;padding:12px 32px;background:{'#F4813D' if brand.upper() == 'TIZA' else '#2563EB'};color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
Iniciar sesión
</a>
</p>
<p style="margin:0;font-size:13px;color:#6b7280;">
Si tienes problemas para acceder, contacta a tu administrador.
</p>"""
    html = _branded_html(body, brand)
    return await email.send(
        to=to,
        subject=f"Tu cuenta ha sido aprobada — {brand}",
        html=html,
    )


async def send_rejection_notification(
    to: str, user_name: str, rejection_reason: str, brand: str = "TIZA"
) -> bool:
    """Notify a user that their registration has been rejected.

    Args:
        to: Recipient email.
        user_name: User's full name.
        rejection_reason: Reason for rejection.
        brand: Brand name for email styling.
    """
    from services.email import email

    body = f"""\
<p style="margin:0 0 16px;font-size:15px;color:#374151;">Hola, {user_name},</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;">
Lamentamos informarte que tu solicitud de registro en <b>{brand}</b> no ha sido aprobada.
</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;">
<strong>Motivo:</strong><br>
<span style="color:#dc2626;">{rejection_reason}</span>
</p>
<p style="margin:0;font-size:13px;color:#6b7280;">
Si crees que esto es un error, contacta al administrador de tu institución.
</p>"""
    html = _branded_html(body, brand)
    return await email.send(
        to=to,
        subject=f"Tu cuenta no ha sido aprobada — {brand}",
        html=html,
    )


async def send_result_ready_email(to: str, evaluation_title: str, brand: str = "TIZA") -> bool:
    """Notify a student that their evaluation results are ready.

    Args:
        to: Recipient email.
        evaluation_title: Title of the evaluated assessment.
        brand: Brand name for email styling.
    """
    from services.email import email

    body = f"""\
<p style="margin:0 0 16px;font-size:15px;color:#374151;">¡Hola!</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;">
Tus resultados para la evaluación <b>"{evaluation_title}"</b> ya están disponibles.
Revisa tu panel para ver tus notas y retroalimentación.
</p>
<p style="margin:0 0 16px;text-align:center;">
<a href="https://{brand.lower()}.app/results" style="display:inline-block;padding:12px 32px;background:#F4813D;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
Ver resultados
</a>
</p>
<p style="margin:0;font-size:13px;color:#6b7280;">¡Sigue así!</p>"""

    html = _branded_html(body, brand)
    return await email.send(
        to=to,
        subject=f"Resultados disponibles — {evaluation_title}",
        html=html,
    )


# ─── Factory + Singleton ─────────────────────────────────────────────


def get_email_backend() -> EmailBackend:
    """Return the configured email backend.

    Reads settings.EMAIL_BACKEND:
      - "smtp"  -> SMTPEmailBackend
      - "null"  -> NullEmailBackend (logs only)
    """
    backend = settings.EMAIL_BACKEND.strip().lower()
    if backend == "smtp":
        return SMTPEmailBackend()
    if backend == "null":
        return NullEmailBackend()
    raise ValueError(
        f"Unknown EMAIL_BACKEND: {settings.EMAIL_BACKEND!r}. "
        "Expected 'smtp' or 'null'."
    )


# Module-level singleton
email: EmailBackend = get_email_backend()
