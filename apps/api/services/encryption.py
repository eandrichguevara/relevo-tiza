"""Encryption backend abstraction for symmetric encryption.

Provides a pluggable encryption interface with a Fernet implementation
using the `cryptography` library.

Usage:
    from services.encryption import encryption
    cipher = encryption.encrypt_str("sensitive-data")
    plain  = encryption.decrypt_str(cipher)
"""
from __future__ import annotations

import base64
import logging
import os
import warnings
from abc import ABC, abstractmethod

from config import settings

logger = logging.getLogger(__name__)

# ─── Abstract Base ───────────────────────────────────────────────────


class EncryptionBackend(ABC):
    """Abstract encryption backend. All operations are synchronous."""

    @abstractmethod
    def encrypt_str(self, plaintext: str) -> str:
        """Encrypt a plaintext string. Returns a base64-encoded ciphertext."""
        ...

    @abstractmethod
    def decrypt_str(self, ciphertext: str) -> str:
        """Decrypt a ciphertext string. Returns the original plaintext."""
        ...


# ─── FernetEncryption ────────────────────────────────────────────────


class FernetEncryption(EncryptionBackend):
    """Symmetric encryption using Fernet (AES-128-CBC + HMAC-SHA256).

    The key is loaded from settings.ENCRYPTION_KEY. If the setting is
    empty, a random key is generated and printed as a warning so the
    developer can copy it into the .env file.

    SECURITY: A random auto-generated key means data encrypted in one
    process start CANNOT be decrypted after restart. In development this
    is acceptable; in production you MUST set ENCRYPTION_KEY in .env.
    """

    def __init__(self) -> None:
        from cryptography.fernet import Fernet

        raw_key = settings.ENCRYPTION_KEY.strip()
        if not raw_key:
            raw_key = self._generate_and_warn()
        # Encode to bytes — Fernet key is URL-safe base64
        self._fernet = Fernet(raw_key.encode("utf-8"))

    @staticmethod
    def _generate_and_warn() -> str:
        """Generate a new Fernet key, print warning, return it."""
        from cryptography.fernet import Fernet

        key = Fernet.generate_key().decode("utf-8")
        warnings.warn(
            "ENCRYPTION_KEY is not set. Auto-generated a random key:\n"
            f"  {key}\n"
            "Add this to your .env file to persist encryption across restarts:\n"
            f"  ENCRYPTION_KEY={key}\n",
            UserWarning,
            stacklevel=2,
        )
        logger.warning("ENCRYPTION_KEY not configured — auto-generated temporary key.")
        return key

    def encrypt_str(self, plaintext: str) -> str:
        token = self._fernet.encrypt(plaintext.encode("utf-8"))
        return token.decode("utf-8")

    def decrypt_str(self, ciphertext: str) -> str:
        token = self._fernet.decrypt(ciphertext.encode("utf-8"))
        return token.decode("utf-8")


# ─── NullEncryption (safe fallback for tests) ────────────────────────


class NullEncryption(EncryptionBackend):
    """No-op encryption that stores/returns plaintext as base64.

    ponytail: Useful in tests where you don't want to manage keys.
    Not intended for production use.
    """

    def encrypt_str(self, plaintext: str) -> str:
        return base64.urlsafe_b64encode(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt_str(self, ciphertext: str) -> str:
        return base64.urlsafe_b64decode(ciphertext.encode("utf-8")).decode("utf-8")


# ─── Factory + Singleton ─────────────────────────────────────────────


def get_encryption() -> EncryptionBackend:
    """Return the configured encryption backend.

    Reads settings.ENCRYPTION_BACKEND:
      - "fernet" -> FernetEncryption
      - "null"   -> NullEncryption (plaintext — testing only)
    """
    backend = settings.ENCRYPTION_BACKEND.strip().lower()
    if backend == "fernet":
        return FernetEncryption()
    if backend == "null":
        return NullEncryption()
    raise ValueError(
        f"Unknown ENCRYPTION_BACKEND: {settings.ENCRYPTION_BACKEND!r}. "
        "Expected 'fernet' or 'null'."
    )


# Module-level singleton
encryption: EncryptionBackend = get_encryption()
