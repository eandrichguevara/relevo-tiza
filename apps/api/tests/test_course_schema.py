"""Unit tests for CreateCourseRequest schema validation.

Tests the @field_validator("subject") on CreateCourseRequest which:
- Splits the subject string by comma
- Validates each trimmed part against SubjectEnum
- Returns the cleaned comma-joined string

These are pure Pydantic model tests — no database, no async needed.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.schemas import CreateCourseRequest, SubjectEnum


# ─── Valid cases ─────────────────────────────

def test_single_subject():
    """A single valid subject passes validation."""
    req = CreateCourseRequest(
        name="1° Básico A",
        grade="1° Básico",
        subject="Lenguaje",
        teacher_id="some-teacher-uuid",
    )
    assert req.subject == "Lenguaje"


def test_two_subjects_comma_separated():
    """Two valid comma-separated subjects pass validation."""
    req = CreateCourseRequest(
        name="1° Básico A",
        grade="1° Básico",
        subject="Lenguaje, Matemáticas",
        teacher_id="some-teacher-uuid",
    )
    assert req.subject == "Lenguaje, Matemáticas"


def test_subject_with_accent_and_enum_value():
    """'Música' from SubjectEnum passes validation."""
    req = CreateCourseRequest(
        name="3° Medio",
        grade="3° Medio",
        subject="Música",
        teacher_id="t-id",
    )
    assert req.subject == "Música"


def test_multiple_subjects_including_music():
    """'Lenguaje, Música' passes validation (mixed valid subjects)."""
    req = CreateCourseRequest(
        name="5° Básico",
        grade="5° Básico",
        subject="Lenguaje, Música",
        teacher_id="t-id",
    )
    assert req.subject == "Lenguaje, Música"


def test_subject_with_extra_spaces():
    """Extra whitespace around subjects is trimmed and normalized.

    '  Lenguaje ,  Matemáticas  ' → 'Lenguaje, Matemáticas'
    """
    req = CreateCourseRequest(
        name="1° A",
        grade="1°",
        subject="  Lenguaje ,  Matemáticas  ",
        teacher_id="t-id",
    )
    # Validator cleans up whitespace but preserves valid subjects
    assert req.subject == "Lenguaje, Matemáticas"


def test_subject_ciencias_naturales():
    """Multi-word subject 'Ciencias Naturales' passes validation."""
    req = CreateCourseRequest(
        name="6° Básico",
        grade="6° Básico",
        subject="Ciencias Naturales",
        teacher_id="t-id",
    )
    assert req.subject == "Ciencias Naturales"


def test_subject_educacion_fisica():
    """Multi-word subject 'Educación Física' passes validation."""
    req = CreateCourseRequest(
        name="8° Básico",
        grade="8° Básico",
        subject="Educación Física",
        teacher_id="t-id",
    )
    assert req.subject == "Educación Física"


def test_all_subject_enum_values():
    """Every value in SubjectEnum should pass validation when used alone."""
    for subject in SubjectEnum:
        req = CreateCourseRequest(
            name="Test Course",
            grade="1°",
            subject=subject.value,
            teacher_id="t-id",
        )
        assert req.subject == subject.value, f"Failed for subject: {subject.value}"


def test_all_subject_enum_values_combined():
    """All 10 subjects combined should pass validation."""
    all_subjects = ", ".join(s.value for s in SubjectEnum)
    req = CreateCourseRequest(
        name="Full Course",
        grade="1°",
        subject=all_subjects,
        teacher_id="t-id",
    )
    assert req.subject == all_subjects


# ─── Invalid cases ───────────────────────────

def test_invalid_single_subject():
    """A subject not in SubjectEnum ('Astronomía') is rejected."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° Básico A",
            grade="1° Básico",
            subject="Astronomía",
            teacher_id="some-teacher-uuid",
        )
    assert "Astronomía" in str(excinfo.value)


def test_partially_invalid_subjects():
    """When one subject is invalid, validation fails entirely."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° Básico A",
            grade="1° Básico",
            subject="Lenguaje, Astronomía",
            teacher_id="some-teacher-uuid",
        )
    error_msg = str(excinfo.value)
    assert "Astronomía" in error_msg


def test_empty_subject():
    """Empty string is rejected — at least one subject required."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° Básico A",
            grade="1° Básico",
            subject="",
            teacher_id="some-teacher-uuid",
        )
    assert "al menos una asignatura" in str(excinfo.value).lower()


def test_subject_with_only_commas():
    """String with only commas and whitespace is treated as empty → rejected."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° Básico A",
            grade="1° Básico",
            subject=", , , ",
            teacher_id="some-teacher-uuid",
        )
    assert "al menos una asignatura" in str(excinfo.value).lower()


def test_subject_numeric_value():
    """Numeric-looking string (not in SubjectEnum) is rejected."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° A",
            grade="1°",
            subject="12345",
            teacher_id="t-id",
        )
    assert "12345" in str(excinfo.value)


def test_subject_unknown_value():
    """Garbage string is rejected."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° A",
            grade="1°",
            subject="NotASubjectAtAll",
            teacher_id="t-id",
        )
    assert "NotASubjectAtAll" in str(excinfo.value)


def test_subject_case_sensitivity():
    """Lowercase 'lenguaje' vs 'Lenguaje' — SubjectEnum is case-sensitive."""
    with pytest.raises(ValueError) as excinfo:
        CreateCourseRequest(
            name="1° A",
            grade="1°",
            subject="lenguaje",
            teacher_id="t-id",
        )
    assert "lenguaje" in str(excinfo.value)


# ─── Ensure existing integration constant still works ──────────────────

def test_existing_integration_constant():
    """The subject used in test_integration.py ('Matemáticas') still works."""
    req = CreateCourseRequest(
        name="1° Básico A",
        grade="1° Básico",
        subject="Matemáticas",
        teacher_id="t-id",
    )
    assert req.subject == "Matemáticas"
