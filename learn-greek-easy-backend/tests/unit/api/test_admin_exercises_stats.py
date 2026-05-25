"""Unit + integration tests for GET /api/v1/admin/exercises/stats (EXR2-24-01).

Covers:
- AC #4: auth required (401 unauthenticated, 403 non-admin).
- AC #5: empty catalog returns zeros, not 404.
- AC #6: with_audio + missing_audio == total invariant.
- AC #7: unit tests — default modality, source/level/type/status/search filters.
- AC #8: parity invariant — stats.total matches list.total for same filters across modalities
         and filter combinations that exercise the asymmetric source/level short-circuits.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.admin_exercises_seed import seed_admin_exercises

STATS_ENDPOINT = "/api/v1/admin/exercises/stats"
LIST_ENDPOINT = "/api/v1/admin/exercises"


# =============================================================================
# TestExerciseStatsAuth — AC #4
# =============================================================================


class TestExerciseStatsAuth:
    """Authentication and authorization requirements for the stats endpoint."""

    @pytest.mark.asyncio
    async def test_stats_requires_auth(self, client: AsyncClient) -> None:
        """401 when no Authorization header is sent."""
        response = await client.get(STATS_ENDPOINT, params={"modality": "listening"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_stats_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ) -> None:
        """403 for authenticated non-superuser."""
        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening"},
            headers=auth_headers,
        )
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"


# =============================================================================
# TestExerciseStatsEmptyDB — AC #5
# =============================================================================


class TestExerciseStatsEmptyDB:
    """Empty catalog must return zero-valued response, not 404."""

    @pytest.mark.asyncio
    async def test_stats_empty_db_returns_zeros_listening(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """Empty DB: listening modality returns all zeros, status 200."""
        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["approved"] == 0
        assert data["pending"] == 0
        assert data["draft"] == 0
        assert data["with_audio"] == 0
        assert data["missing_audio"] == 0
        assert data["distinct_types"] == 0

    @pytest.mark.asyncio
    async def test_stats_empty_db_returns_zeros_reading(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """Empty DB: reading modality returns all zeros, status 200."""
        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "reading"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["with_audio"] + data["missing_audio"] == data["total"]


# =============================================================================
# TestExerciseStatsWithSeed — AC #6, #7
# =============================================================================


class TestExerciseStatsWithSeed:
    """Tests using the seed factory (13+ rows) to verify counts and invariants."""

    @pytest.mark.asyncio
    async def test_stats_listening_default_modality(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Default listening: total > 0, status breakdowns sum to total, with_audio invariant."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        # Status breakdown must sum to total
        assert data["approved"] + data["pending"] + data["draft"] == data["total"]
        # AC #6: with_audio + missing_audio == total
        assert data["with_audio"] + data["missing_audio"] == data["total"]
        # distinct_types must be positive
        assert data["distinct_types"] > 0

    @pytest.mark.asyncio
    async def test_stats_audio_invariant_holds(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """AC #6: with_audio + missing_audio == total for both modalities."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        for modality in ("listening", "reading"):
            response = await client.get(
                STATS_ENDPOINT,
                params={"modality": modality},
                headers=superuser_auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert (
                data["with_audio"] + data["missing_audio"] == data["total"]
            ), f"with_audio invariant failed for modality={modality}"

    @pytest.mark.asyncio
    async def test_stats_filter_by_source_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """source=description narrows to description exercises only."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "source": "description"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        assert data["with_audio"] + data["missing_audio"] == data["total"]

    @pytest.mark.asyncio
    async def test_stats_filter_by_source_dialog(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """source=dialog narrows to dialog exercises only (description returns 0)."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "source": "dialog"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Seed creates dialog rows
        assert data["total"] > 0
        # with_audio invariant
        assert data["with_audio"] + data["missing_audio"] == data["total"]

    @pytest.mark.asyncio
    async def test_stats_filter_by_level(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """level=A2 narrows to A2 description exercises (dialog/picture/word_order skipped)."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "level": "A2"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Seed has A2 description exercises
        assert data["total"] > 0
        assert data["with_audio"] + data["missing_audio"] == data["total"]

    @pytest.mark.asyncio
    async def test_stats_filter_by_status_approved(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """status=approved: total matches approved count, pending+draft == 0."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "status": "approved"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # All returned rows are approved
        assert data["pending"] == 0
        assert data["draft"] == 0
        assert data["approved"] == data["total"]
        assert data["with_audio"] + data["missing_audio"] == data["total"]

    @pytest.mark.asyncio
    async def test_stats_filter_by_type(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """exercise_type filter narrows results."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "exercise_type": "select_correct_answer"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Seed has select_correct_answer rows; distinct_types <= 1
        assert data["distinct_types"] <= 1
        assert data["with_audio"] + data["missing_audio"] == data["total"]

    @pytest.mark.asyncio
    async def test_stats_filter_by_search(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """search filter narrows results by situation title."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        # Seed uses "Admin seed: description row" in scenario_en
        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "search": "Admin seed: description"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should find some description exercise rows
        assert data["total"] > 0

    @pytest.mark.asyncio
    async def test_stats_search_no_match_returns_zeros(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """search that matches nothing returns zeros, not 404."""
        await seed_admin_exercises(db_session)
        await db_session.commit()

        response = await client.get(
            STATS_ENDPOINT,
            params={"modality": "listening", "search": "XXXXXXXXXNONEXISTENT"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["with_audio"] + data["missing_audio"] == data["total"]


# =============================================================================
# TestExerciseStatsParityInvariant — AC #8
# =============================================================================


class TestExerciseStatsParityInvariant:
    """AC #8: stats.total must match list.total for the same filter combination.

    Exercises the asymmetric source/level short-circuits across:
    - modality: listening + reading
    - source: None, description, dialog
    - level: None, A2
    """

    async def _assert_parity(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        params: dict,
    ) -> None:
        """Helper: fetch stats and list for the same params, assert total parity."""
        stats_response = await client.get(
            STATS_ENDPOINT, params=params, headers=superuser_auth_headers
        )
        assert stats_response.status_code == 200, f"stats failed: {stats_response.text}"

        # List uses page_size=5 to force multiple pages
        list_params = {**params, "page": 1, "page_size": 5}
        list_response = await client.get(
            LIST_ENDPOINT, params=list_params, headers=superuser_auth_headers
        )
        assert list_response.status_code == 200, f"list failed: {list_response.text}"

        stats_total = stats_response.json()["total"]
        list_total = list_response.json()["total"]
        assert stats_total == list_total, (
            f"Parity mismatch for params={params}: "
            f"stats.total={stats_total}, list.total={list_total}"
        )

    @pytest.mark.asyncio
    async def test_parity_listening_no_filters(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(client, superuser_auth_headers, {"modality": "listening"})

    @pytest.mark.asyncio
    async def test_parity_reading_no_filters(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(client, superuser_auth_headers, {"modality": "reading"})

    @pytest.mark.asyncio
    async def test_parity_listening_source_description(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """source=description: description short-circuit keeps only description rows."""
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(
            client,
            superuser_auth_headers,
            {"modality": "listening", "source": "description"},
        )

    @pytest.mark.asyncio
    async def test_parity_listening_source_dialog(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """source=dialog: description short-circuit returns 0 description rows."""
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(
            client,
            superuser_auth_headers,
            {"modality": "listening", "source": "dialog"},
        )

    @pytest.mark.asyncio
    async def test_parity_listening_level_a2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """level=A2: dialog/picture/word_order skipped (level short-circuit)."""
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(
            client,
            superuser_auth_headers,
            {"modality": "listening", "level": "A2"},
        )

    @pytest.mark.asyncio
    async def test_parity_listening_source_description_level_a2(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Combined source+level filter exercises both short-circuits simultaneously."""
        await seed_admin_exercises(db_session)
        await db_session.commit()
        await self._assert_parity(
            client,
            superuser_auth_headers,
            {"modality": "listening", "source": "description", "level": "A2"},
        )
