"""Unit and schema tests for UpdateCourseRequest and update_course API endpoint."""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.schemas import UpdateCourseRequest, SubjectEnum


def test_update_course_request_valid():
    req = UpdateCourseRequest(
        name="2° Básico B",
        grade="2° Básico",
        subject="Matemáticas",
        teachers={"Matemáticas": "teacher-uuid-1"},
    )
    assert req.name == "2° Básico B"
    assert req.grade == "2° Básico"
    assert req.subject == "Matemáticas"
    assert req.teachers == {"Matemáticas": "teacher-uuid-1"}


def test_update_course_request_partial():
    req = UpdateCourseRequest(name="Solo nombre nuevo")
    assert req.name == "Solo nombre nuevo"
    assert req.grade is None
    assert req.subject is None
    assert req.teachers is None


def test_update_course_request_invalid_subject():
    with pytest.raises(ValueError) as excinfo:
        UpdateCourseRequest(subject="Materia Inexistente")
    assert "Materia Inexistente" in str(excinfo.value)


def test_update_course_request_invalid_teacher_subject():
    with pytest.raises(ValueError) as excinfo:
        UpdateCourseRequest(teachers={"Materia Inexistente": "uuid-123"})
    assert "no es válida" in str(excinfo.value).lower()
