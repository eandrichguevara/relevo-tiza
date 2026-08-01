"""Tests for AI evaluation suggestions endpoints and service."""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_suggest_next_question_endpoint(client: AsyncClient, registered_user: dict):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    payload = {
        "subject": "Matemáticas",
        "grade": "8° Básico",
        "topic": "Ecuaciones de primer grado",
        "question_type": "written",
        "existing_questions": ["¿Qué es una incógnita?"],
    }

    mock_suggest = {
        "statement": "¿Cómo se despeja x en 2x + 4 = 10?",
        "type": "written",
        "criteria": [
            {
                "name": "Procedimiento",
                "levels": [{"points": 3.0, "description": "Paso a paso correcto"}],
            }
        ],
    }

    with patch(
        "routers.evaluations.gemini_service.suggest_next_question",
        new_callable=AsyncMock,
        return_value=mock_suggest,
    ):
        response = await client.post(
            "/api/evaluations/ai-suggestions/next-question",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["statement"] == "¿Cómo se despeja x en 2x + 4 = 10?"
        assert data["type"] == "written"


@pytest.mark.asyncio
async def test_suggest_distractors_endpoint(client: AsyncClient, registered_user: dict):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    payload = {
        "statement": "¿Cuál es el resultado de 5 + 3?",
        "correct_answer": "8",
        "count": 3,
    }

    mock_distractors = ["7", "9", "15"]

    with patch(
        "routers.evaluations.gemini_service.suggest_distractors",
        new_callable=AsyncMock,
        return_value=mock_distractors,
    ):
        response = await client.post(
            "/api/evaluations/ai-suggestions/distractors",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["distractors"] == ["7", "9", "15"]


@pytest.mark.asyncio
async def test_refine_question_endpoint(client: AsyncClient, registered_user: dict):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    payload = {
        "statement": "que es la fotosintesis",
        "action": "improve",
    }

    with patch(
        "routers.evaluations.gemini_service.refine_question",
        new_callable=AsyncMock,
        return_value={"refined_statement": "Explique en qué consiste el proceso de fotosíntesis.", "criteria": []},
    ):
        response = await client.post(
            "/api/evaluations/ai-suggestions/refine",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["refined_statement"] == "Explique en qué consiste el proceso de fotosíntesis."


@pytest.mark.asyncio
async def test_suggest_rubric_endpoint(client: AsyncClient, registered_user: dict):
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    payload = {
        "statement": "Explique las causas de la Primera Guerra Mundial.",
        "max_score": 3.0,
    }

    mock_criteria = [
        {
            "name": "Causas Principales",
            "levels": [
                {"points": 3.0, "description": "Menciona 3 o más causas principales"},
                {"points": 1.5, "description": "Menciona 1 o 2 causas"},
                {"points": 0.0, "description": "No menciona causas validas"},
            ],
        }
    ]

    with patch(
        "routers.evaluations.gemini_service.suggest_rubric_criteria",
        new_callable=AsyncMock,
        return_value=mock_criteria,
    ):
        response = await client.post(
            "/api/evaluations/ai-suggestions/rubric",
            json=payload,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["criteria"]) == 1
        assert data["criteria"][0]["name"] == "Causas Principales"


@pytest.mark.asyncio
async def test_refine_question_autocomplete_spacing():
    from services.gemini import GeminiService
    service = GeminiService()
    
    # Mockear generate_content
    from unittest.mock import MagicMock
    mock_client = MagicMock()
    service._client = mock_client
    
    cases = [
        # (statement, mock_gemini_response, expected_output)
        ("la cebolla ", "y el tomate", "la cebolla y el tomate"),
        ("la cebolla", " y el tomate", "la cebolla y el tomate"),
        ("la explíc", "ita de al menos", "la explícita de al menos"),
        ("Escriba", ", por favor", "Escriba, por favor"),
        ("la cebolla", "cebolla y tomate", "la cebolla y tomate"),
        ("salud", " y bienestar", "salud y bienestar"),
        ("mesa", " y silla", "mesa y silla"),
        ("hola  ", " mundo", "hola mundo"),
    ]
    
    for stmt, gemini_resp, expected in cases:
        mock_response = MagicMock()
        mock_response.text = gemini_resp
        mock_client.models.generate_content.return_value = mock_response
        
        res = await service.refine_question(statement=stmt, action="autocomplete")
        assert res["refined_statement"] == expected, f"Failed for stmt='{stmt}', resp='{gemini_resp}'. Got '{res['refined_statement']}', expected '{expected}'"

