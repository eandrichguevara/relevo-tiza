"""In-memory job queue for the evaluation pipeline.

Provides a simple async-friendly queue interface so the pipeline can
enqueue and process evaluation jobs without a heavyweight broker.

In production this will be replaced by Redis (via RQ or BullMQ).
For development, the in-memory backend is sufficient to exercise the
full pipeline flow.

Usage:
    from services.queue import queue
    job_id = await queue.enqueue("process_evaluation", {"id": "..."})
"""
from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, List, Optional

from config import settings


@dataclass
class Job:
    """A unit of work in the queue.

    Attributes:
        id: Unique job identifier.
        type: Job type string (e.g. ``"process_evaluation"``).
        payload: Arbitrary data consumed by the worker.
        status: One of ``pending``, ``running``, ``completed``, ``failed``.
        created_at: Unix timestamp when the job was enqueued.
        error: Error message if the job failed.
    """
    id: str
    type: str
    payload: Dict[str, Any]
    status: str = "pending"
    created_at: float = field(default_factory=time.time)
    error: Optional[str] = None


Handler = Callable[..., Coroutine[Any, Any, None]]


class InMemoryQueue:
    """Simple in-memory job queue for development.

    Jobs are stored in a list and processed sequentially via a background
    asyncio task. Handlers are registered per job type.

    ponytail: No persistence, no retries, no worker processes. Sufficient
    for local development and demo environments. Swap for RQ/Redis when
    deploying to production.
    """

    def __init__(self) -> None:
        self._jobs: Dict[str, Job] = {}
        self._handlers: Dict[str, Handler] = {}
        self._loop: Optional[asyncio.Task] = None

    def register_handler(self, job_type: str, handler: Handler) -> None:
        """Register a coroutine handler for a given job type."""
        self._handlers[job_type] = handler

    async def enqueue(
        self,
        job_type: str,
        payload: Dict[str, Any],
    ) -> str:
        """Add a job to the queue and return its ID.

        Starts the background processor if it is not already running.
        """
        job_id = secrets.token_hex(12)
        job = Job(id=job_id, type=job_type, payload=payload)
        self._jobs[job_id] = job

        # Start processor if not running
        if self._loop is None or self._loop.done():
            self._loop = asyncio.create_task(self._process_loop())

        return job_id

    async def get_job(self, job_id: str) -> Optional[Job]:
        """Return a job by ID, or None if not found."""
        return self._jobs.get(job_id)

    async def get_pending_jobs(self) -> List[Job]:
        """Return all pending jobs."""
        return [j for j in self._jobs.values() if j.status == "pending"]

    async def _process_loop(self) -> None:
        """Background loop: process jobs sequentially."""
        while True:
            pending = [j for j in self._jobs.values() if j.status == "pending"]
            if not pending:
                await asyncio.sleep(0.5)
                continue

            job = pending[0]
            handler = self._handlers.get(job.type)
            if handler is None:
                job.status = "failed"
                job.error = f"No handler registered for job type: {job.type}"
                continue

            job.status = "running"
            try:
                await handler(job.payload)
                job.status = "completed"
            except Exception as exc:
                job.status = "failed"
                job.error = str(exc)

            # Brief yield to allow other tasks
            await asyncio.sleep(0.1)

    @property
    def pending_count(self) -> int:
        """Number of jobs waiting to be processed."""
        return sum(1 for j in self._jobs.values() if j.status == "pending")


# ─── Module-level singleton ─────────────────────────────────────────
# Match the config settings.QUEUE_BACKEND convention.
# ponytail: Hardcoded to InMemoryQueue for now. When Redis is available,
# swap to a RedisQueue with the same interface.

_queue_instance: Optional[InMemoryQueue] = None


def get_queue() -> InMemoryQueue:
    """Return the configured queue singleton."""
    global _queue_instance
    if _queue_instance is None:
        backend = settings.QUEUE_BACKEND.strip().lower()
        if backend == "memory":
            _queue_instance = InMemoryQueue()
        else:
            raise ValueError(
                f"Unknown QUEUE_BACKEND: {settings.QUEUE_BACKEND!r}. "
                "Expected 'memory'."
            )
    return _queue_instance


# Convenience alias so the pipeline can do:
#   from services.queue import queue
queue: InMemoryQueue = get_queue()
