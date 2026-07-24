"""Schema validation tests for evaluation creation.

Covers three validation areas flagged by Inquisitor:
- B-M11: AlternativeItem validation (multiple_choice alternatives: min 2, exactly 1 correct)
- F-06: CriterionItem validation (criteria: sum(scores) <= max_score, no negative scores)
- B-M10: course_id required in CreateEvaluationRequest
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient

from tests.test_integration import _setup_holder, _setup_teacher


# ─────────────────────────────────────────────
#  1. AlternativeItem validation (B-M11)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
class TestAlternativeValidation:
    """Tests for B-M11: AlternativeItem validation in evaluation creation.

    RubricItem.alternatives must have:
    - At least 2 alternatives for multiple_choice questions
    - Exactly 1 alternative marked as is_correct=True
    """

    @pytest.fixture
    async def eval_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create holder + teacher + course for evaluation tests."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        course_resp = await client.post(
            "/api/courses",
            json={
                "name": "Schema Alt Course",
                "grade": "1° Básico",
                "subject": "Matemáticas",
                "teachers": {"Matemáticas": teacher["teacher_id"]},
            },
            headers={"Authorization": f"Bearer {holder['token']}"},
        )
        assert course_resp.status_code == 201, f"Course creation failed: {course_resp.text}"
        course_id = course_resp.json()["id"]

        return {
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
        }

    async def test_alternatives_minimum_two(self, client: AsyncClient, eval_context: dict):
        """MC question with only 1 alternative → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Alt Min 2 Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "multiple_choice",
                        "max_score": 1.0,
                        "alternatives": [
                            {"label": "A", "text": "Única opción", "is_correct": True},
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for 1 alternative, got {resp.status_code}: {resp.text}"
        )

    async def test_alternatives_exactly_one_correct(self, client: AsyncClient, eval_context: dict):
        """MC question with 0 correct alternatives → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Alt Zero Correct Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "multiple_choice",
                        "max_score": 1.0,
                        "alternatives": [
                            {"label": "A", "text": "Opción A", "is_correct": False},
                            {"label": "B", "text": "Opción B", "is_correct": False},
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for 0 correct, got {resp.status_code}: {resp.text}"
        )

    async def test_alternatives_multiple_correct(self, client: AsyncClient, eval_context: dict):
        """MC question with 2 correct alternatives → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Alt Multi Correct Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "multiple_choice",
                        "max_score": 1.0,
                        "alternatives": [
                            {"label": "A", "text": "Opción A", "is_correct": True},
                            {"label": "B", "text": "Opción B", "is_correct": True},
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for 2 correct, got {resp.status_code}: {resp.text}"
        )

    async def test_alternatives_valid(self, client: AsyncClient, eval_context: dict):
        """MC question with 3 alternatives, exactly 1 correct → expect 201."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Alt Valid Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "multiple_choice",
                        "max_score": 1.0,
                        "alternatives": [
                            {"label": "A", "text": "Opción A", "is_correct": False},
                            {"label": "B", "text": "Opción B", "is_correct": True},
                            {"label": "C", "text": "Opción C", "is_correct": False},
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 201, (
            f"Expected 201 for valid alternatives, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data["title"] == "Alt Valid Test"
        assert data["status"] == "pending"
        assert len(data["rubric"]) == 1
        assert data["rubric"][0]["type"] == "multiple_choice"


# ─────────────────────────────────────────────
#  2. CriterionItem validation (F-06)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
class TestCriteriaValidation:
    """Tests for F-06: CriterionItem validation in evaluation creation.

    RubricItem.criteria must have:
    - sum(criteria[].score) <= max_score
    - Individual scores must be >= 0 (no negative scores)
    - criteria is optional (empty list is valid)
    """

    @pytest.fixture
    async def eval_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create holder + teacher + course for evaluation tests."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        course_resp = await client.post(
            "/api/courses",
            json={
                "name": "Schema Criteria Course",
                "grade": "1° Básico",
                "subject": "Matemáticas",
                "teachers": {"Matemáticas": teacher["teacher_id"]},
            },
            headers={"Authorization": f"Bearer {holder['token']}"},
        )
        assert course_resp.status_code == 201, f"Course creation failed: {course_resp.text}"
        course_id = course_resp.json()["id"]

        return {
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
        }

    async def test_criteria_sum_exceeds_max_score(self, client: AsyncClient, eval_context: dict):
        """Criterion sum > max_score → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Criteria Over Max Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                        "criteria": [
                            {"description": "Criterio 1", "score": 3.0},
                            {"description": "Criterio 2", "score": 2.0},  # sum = 5 > 4
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for criteria sum > max_score, got {resp.status_code}: {resp.text}"
        )

    async def test_criteria_sum_equals_max_score(self, client: AsyncClient, eval_context: dict):
        """Criterion sum == max_score → expect 201."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Criteria Equals Max Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                        "criteria": [
                            {"description": "Criterio 1", "score": 2.5},
                            {"description": "Criterio 2", "score": 1.5},  # sum = 4 == 4
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 201, (
            f"Expected 201 for criteria sum == max_score, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data["title"] == "Criteria Equals Max Test"

    async def test_criteria_sum_less_than_max_score(self, client: AsyncClient, eval_context: dict):
        """Criterion sum < max_score → expect 201."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Criteria Under Max Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                        "criteria": [
                            {"description": "Criterio 1", "score": 1.0},  # sum = 1 < 4
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 201, (
            f"Expected 201 for criteria sum < max_score, got {resp.status_code}: {resp.text}"
        )

    async def test_empty_criteria_list(self, client: AsyncClient, eval_context: dict):
        """Empty criteria list → expect 201 (criteria is optional)."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Empty Criteria Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                        "criteria": [],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 201, (
            f"Expected 201 for empty criteria, got {resp.status_code}: {resp.text}"
        )

    async def test_criteria_negative_score(self, client: AsyncClient, eval_context: dict):
        """Criterion with negative score → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Negative Score Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                        "criteria": [
                            {"description": "Criterio negativo", "score": -1.0},
                        ],
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for negative score, got {resp.status_code}: {resp.text}"
        )


# ─────────────────────────────────────────────
#  3. course_id required (B-M10)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
class TestCourseIdRequired:
    """Tests for B-M10: course_id required in CreateEvaluationRequest."""

    @pytest.fixture
    async def eval_context(self, client: AsyncClient, fastapi_app) -> dict:
        """Create holder + teacher + course for evaluation tests."""
        holder = await _setup_holder(fastapi_app)
        teacher = await _setup_teacher(fastapi_app, holder["tenant_id"])

        course_resp = await client.post(
            "/api/courses",
            json={
                "name": "Schema CourseId Course",
                "grade": "1° Básico",
                "subject": "Matemáticas",
                "teachers": {"Matemáticas": teacher["teacher_id"]},
            },
            headers={"Authorization": f"Bearer {holder['token']}"},
        )
        assert course_resp.status_code == 201, f"Course creation failed: {course_resp.text}"
        course_id = course_resp.json()["id"]

        return {
            "teacher_token": teacher["token"],
            "tenant_id": holder["tenant_id"],
            "course_id": course_id,
        }

    async def test_missing_course_id(self, client: AsyncClient, eval_context: dict):
        """Evaluation without course_id → expect 422."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "Missing CourseId Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                    }
                ],
                # course_id intentionally omitted
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for missing course_id, got {resp.status_code}: {resp.text}"
        )

    async def test_course_id_present(self, client: AsyncClient, eval_context: dict):
        """Evaluation with course_id → expect 201."""
        resp = await client.post(
            "/api/evaluations",
            json={
                "title": "CourseId Present Test",
                "subject": "Matemáticas",
                "grade": "1° Básico",
                "rubric": [
                    {
                        "question_number": 1,
                        "type": "written",
                        "max_score": 4.0,
                        "correct_answer": "42",
                    }
                ],
                "course_id": eval_context["course_id"],
            },
            headers={"Authorization": f"Bearer {eval_context['teacher_token']}"},
        )
        assert resp.status_code == 201, (
            f"Expected 201 with course_id, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data["title"] == "CourseId Present Test"
        assert data["status"] == "pending"
