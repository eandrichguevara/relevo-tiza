"""Storage backend abstraction for file storage.

Provides a pluggable storage interface with two implementations:
- LocalStorage: filesystem-based, for development without MinIO
- MinIOStorage: S3-compatible via the minio SDK, for production

Usage:
    from services.storage import storage
    url = await storage.upload("my-bucket", "path/to/file.pdf", data)
    data = await storage.download("my-bucket", "path/to/file.pdf")
"""
from __future__ import annotations

import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from config import settings

# ─── Abstract Base ───────────────────────────────────────────────────


class StorageBackend(ABC):
    """Abstract storage backend. All operations are async."""

    @abstractmethod
    async def upload(
        self, bucket: str, key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        """Upload bytes to bucket/key. Returns the public URL or path."""
        ...

    @abstractmethod
    async def download(self, bucket: str, key: str) -> bytes:
        """Download bytes from bucket/key."""
        ...

    @abstractmethod
    async def delete(self, bucket: str, key: str) -> None:
        """Delete object at bucket/key."""
        ...

    @abstractmethod
    async def generate_presigned_url(
        self, bucket: str, key: str, expires_in: int = 3600
    ) -> str:
        """Generate a time-limited presigned URL for the object."""
        ...

    @abstractmethod
    async def ensure_bucket(self, bucket: str) -> None:
        """Create bucket if it does not exist."""
        ...


# ─── LocalStorage (development) ──────────────────────────────────────


class LocalStorage(StorageBackend):
    """Filesystem-based storage for local development.

    Stores everything under /tmp/tiza-storage/{bucket}/{key}.
    Presigned URLs are not truly presigned — they return a file:// path
    for local inspection.

    ponytail: Simple filesystem I/O. No async disk libraries needed for dev.
    """

    BASE_DIR = Path("/tmp/tiza-storage")
    # ponytail: Hardcoded base dir is fine for dev. If production needs
    # filesystem-based storage at scale, swap for MinIOStorage.

    async def _ensure_path(self, bucket: str, key: str) -> Path:
        """Return the full path to the object, creating parents if needed."""
        full_path = self.BASE_DIR / bucket / key
        full_path.parent.mkdir(parents=True, exist_ok=True)
        return full_path

    async def upload(
        self, bucket: str, key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        path = await self._ensure_path(bucket, key)
        path.write_bytes(data)
        return str(path)

    async def download(self, bucket: str, key: str) -> bytes:
        path = self.BASE_DIR / bucket / key
        return path.read_bytes()

    async def delete(self, bucket: str, key: str) -> None:
        path = self.BASE_DIR / bucket / key
        if path.exists():
            path.unlink()

    async def generate_presigned_url(
        self, bucket: str, key: str, expires_in: int = 3600
    ) -> str:
        path = self.BASE_DIR / bucket / key
        return path.as_uri()  # file:// URI for local inspection

    async def ensure_bucket(self, bucket: str) -> None:
        path = self.BASE_DIR / bucket
        path.mkdir(parents=True, exist_ok=True)


# ─── MinIOStorage (production / S3-compatible) ───────────────────────


class MinIOStorage(StorageBackend):
    """S3-compatible storage using the minio SDK.

    Connects to settings.S3_ENDPOINT using settings.S3_ACCESS_KEY and
    settings.S3_SECRET_KEY. SSL is controlled by S3_USE_SSL.
    """

    def __init__(self) -> None:
        # Lazy import so the module can be imported without minio installed
        from minio import Minio

        self._client: Minio = Minio(
            endpoint=settings.S3_ENDPOINT,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            secure=settings.S3_USE_SSL,
        )

    async def upload(
        self, bucket: str, key: str, data: bytes, content_type: Optional[str] = None
    ) -> str:
        from io import BytesIO

        self._client.put_object(
            bucket_name=bucket,
            object_name=key,
            data=BytesIO(data),
            length=len(data),
            content_type=content_type or "application/octet-stream",
        )
        return f"{self._client._endpoint_url}/{bucket}/{key}"

    async def download(self, bucket: str, key: str) -> bytes:
        response = self._client.get_object(bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    async def delete(self, bucket: str, key: str) -> None:
        self._client.remove_object(bucket, key)

    async def generate_presigned_url(
        self, bucket: str, key: str, expires_in: int = 3600
    ) -> str:
        return self._client.presigned_get_object(
            bucket_name=bucket,
            object_name=key,
            expires=expires_in,
        )

    async def ensure_bucket(self, bucket: str) -> None:
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)


# ─── Factory + Singleton ─────────────────────────────────────────────


def get_storage() -> StorageBackend:
    """Return the configured storage backend based on settings.STORAGE_BACKEND.

    Raises ValueError for unknown backends.
    """
    backend = settings.STORAGE_BACKEND.strip().lower()
    if backend == "minio":
        return MinIOStorage()
    if backend == "local":
        return LocalStorage()
    raise ValueError(
        f"Unknown STORAGE_BACKEND: {settings.STORAGE_BACKEND!r}. "
        "Expected 'minio' or 'local'."
    )


# Module-level singleton — import `storage` wherever needed.
# ponytail: Singleton is fine for a single-process FastAPI app.
# For multi-worker horizontal scaling, each worker gets its own instance
# which is safe because the backends are stateless (MinIO handles the
# connection pooling internally).
storage: StorageBackend = get_storage()
