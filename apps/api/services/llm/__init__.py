"""LLM service package — factory for provider instantiation.

Usage:
    from services.llm import create_llm_provider
    llm = create_llm_provider()
    result = await llm.grade_answer(input, rubric_context)
"""
from __future__ import annotations

from config import settings
from services.llm.provider import LLMProvider


def create_llm_provider() -> LLMProvider:
    """Factory: return the configured LLM backend.

    Reads ``settings.LLM_MODE`` to decide which implementation to
    instantiate.
    """
    mode = settings.LLM_MODE.strip().lower()

    if mode == "gemini_flash":
        from services.llm.gemini_llm import GeminiLLMProvider
        return GeminiLLMProvider()

    # Future: other LLM providers
    # if mode == "claude":
    #     from services.llm.claude_llm import ClaudeLLMProvider
    #     return ClaudeLLMProvider()

    if mode == "simulation":
        # Fallback to Gemini even in simulation mode — GeminiLLMProvider
        # already has a built-in simulated fallback when the API fails.
        from services.llm.gemini_llm import GeminiLLMProvider
        return GeminiLLMProvider()

    raise ValueError(
        f"Unknown LLM_MODE: {settings.LLM_MODE!r}. "
        "Expected 'gemini_flash' or 'simulation'."
    )
