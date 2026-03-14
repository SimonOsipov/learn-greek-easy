"""Unit tests for GET /api/v1/admin/reverse-lookup endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from src.services.reverse_lookup_service import ReverseLookupResult


@pytest.mark.asyncio
class TestReverseLookupEndpoint:
    async def test_success_200(self, client: AsyncClient, superuser_auth_headers: dict) -> None:
        mock_results = [
            ReverseLookupResult(
                lemma="σπίτι",
                pos="NOUN",
                gender="neuter",
                article="το",
                translations=["house", "home"],
                actionable=True,
            )
        ]
        with patch(
            "src.api.v1.admin.ReverseLookupService.search",
            new_callable=AsyncMock,
            return_value=mock_results,
        ):
            response = await client.get(
                "/api/v1/admin/reverse-lookup",
                params={"q": "house", "lang": "en"},
                headers=superuser_auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "house"
        assert data["language"] == "en"
        assert len(data["results"]) == 1
        result = data["results"][0]
        assert result["lemma"] == "σπίτι"
        assert result["pos"] == "NOUN"
        assert result["gender"] == "neuter"
        assert result["article"] == "το"
        assert result["translations"] == ["house", "home"]
        assert result["actionable"] is True

    async def test_russian_200(self, client: AsyncClient, superuser_auth_headers: dict) -> None:
        mock_results = [
            ReverseLookupResult(
                lemma="σπίτι",
                pos="NOUN",
                gender="neuter",
                article="το",
                translations=["дом"],
                actionable=True,
            )
        ]
        with patch(
            "src.api.v1.admin.ReverseLookupService.search",
            new_callable=AsyncMock,
            return_value=mock_results,
        ):
            response = await client.get(
                "/api/v1/admin/reverse-lookup",
                params={"q": "дом", "lang": "ru"},
                headers=superuser_auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "ru"
        assert len(data["results"]) == 1

    async def test_empty_results_200(
        self, client: AsyncClient, superuser_auth_headers: dict
    ) -> None:
        with patch(
            "src.api.v1.admin.ReverseLookupService.search",
            new_callable=AsyncMock,
            return_value=[],
        ):
            response = await client.get(
                "/api/v1/admin/reverse-lookup",
                params={"q": "xyz123", "lang": "en"},
                headers=superuser_auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []

    async def test_missing_q_422(self, client: AsyncClient, superuser_auth_headers: dict) -> None:
        response = await client.get(
            "/api/v1/admin/reverse-lookup",
            params={"lang": "en"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    async def test_missing_lang_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ) -> None:
        response = await client.get(
            "/api/v1/admin/reverse-lookup",
            params={"q": "house"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    async def test_invalid_lang_422(
        self, client: AsyncClient, superuser_auth_headers: dict
    ) -> None:
        response = await client.get(
            "/api/v1/admin/reverse-lookup",
            params={"q": "house", "lang": "de"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    async def test_no_auth_401(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/admin/reverse-lookup",
            params={"q": "house", "lang": "en"},
        )
        assert response.status_code == 401

    async def test_non_superuser_403(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get(
            "/api/v1/admin/reverse-lookup",
            params={"q": "house", "lang": "en"},
            headers=auth_headers,
        )
        assert response.status_code == 403
