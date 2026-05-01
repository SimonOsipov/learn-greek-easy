"""Unit tests for POST /api/v1/admin/users/{user_id}/recompute-gamification.

Tests cover:
- 200 with non-empty diff (XP delta, level-up, newly unlocked achievements)
- 200 with empty diff (idempotent call on a converged user)
- 404 for unknown user_id
- 403 for authenticated non-superuser
- 401 for unauthenticated request
- 422 for malformed UUID path parameter

GamificationReconciler.reconcile is patched with AsyncMock so these tests
require no real DB or gamification state.

Note: ReconcileResult and GamificationSnapshot are imported lazily (inside
functions) to avoid triggering src/services/__init__.py at collection time,
which pulls in spaCy — incompatible with local Python 3.14 (CI runs 3.13).
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ENDPOINT_TEMPLATE = "/api/v1/admin/users/{user_id}/recompute-gamification"


def _endpoint(user_id: UUID) -> str:
    return ENDPOINT_TEMPLATE.format(user_id=user_id)


def _build_fake_result(
    *,
    new_unlocks: list[str] | None = None,
    xp_before: int = 10,
    xp_after: int = 110,
    leveled_up: bool = True,
    level: int = 2,
    version: int = 1,
):
    """Build a ReconcileResult with a GamificationSnapshot, imported lazily."""
    # Lazy imports to avoid triggering src/services/__init__.py (spaCy) at collection time
    from src.services.gamification.reconciler import ReconcileResult  # noqa: PLC0415
    from src.services.gamification.types import GamificationSnapshot, MetricValues  # noqa: PLC0415

    snapshot = GamificationSnapshot(
        user_id=uuid4(),
        metrics=MetricValues({}),
        unlocked=frozenset(),
        total_xp=xp_after,
        current_level=level,
        projection_version=version,
        computed_at=datetime.now(timezone.utc),
    )
    return ReconcileResult(
        new_unlocks=new_unlocks if new_unlocks is not None else [],
        total_xp_before=xp_before,
        total_xp_after=xp_after,
        leveled_up=leveled_up,
        snapshot=snapshot,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestRecomputeGamification:
    """Tests for POST /api/v1/admin/users/{user_id}/recompute-gamification."""

    @pytest.mark.asyncio
    async def test_returns_diff_with_unlocks(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        """200 response contains correct XP delta, level delta, and newly unlocked IDs."""
        fake = _build_fake_result(
            new_unlocks=["learning_first_word"],
            xp_before=10,
            xp_after=110,
            leveled_up=True,
            level=2,
        )

        with patch(
            "src.api.v1.admin.GamificationReconciler.reconcile",
            new=AsyncMock(return_value=fake),
        ):
            response = await client.post(
                _endpoint(test_user.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == str(test_user.id)
        assert body["xp_before"] == 10
        assert body["xp_after"] == 110
        assert body["xp_delta"] == 100
        assert body["leveled_up"] is True
        assert body["level_delta"] >= 1
        assert body["newly_unlocked_ids"] == ["learning_first_word"]
        assert body["newly_locked_ids"] == []
        assert body["projection_version"] == 1
        assert "computed_at" in body

    @pytest.mark.asyncio
    async def test_returns_empty_diff_on_converged_user(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        test_user: User,
        db_session: AsyncSession,
    ) -> None:
        """200 with all-zero deltas when the user's state is already up-to-date."""
        fake = _build_fake_result(
            new_unlocks=[],
            xp_before=50,
            xp_after=50,
            leveled_up=False,
            level=1,
        )

        with patch(
            "src.api.v1.admin.GamificationReconciler.reconcile",
            new=AsyncMock(return_value=fake),
        ):
            response = await client.post(
                _endpoint(test_user.id),
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["xp_delta"] == 0
        assert body["level_delta"] == 0
        assert body["leveled_up"] is False
        assert body["newly_unlocked_ids"] == []
        assert body["newly_locked_ids"] == []

    @pytest.mark.asyncio
    async def test_returns_404_for_unknown_user(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """404 when no User row exists for the given user_id."""
        unknown_id = uuid4()
        response = await client.post(
            _endpoint(unknown_id),
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_403_for_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user: User,
    ) -> None:
        """403 when authenticated as a regular (non-superuser) user."""
        response = await client.post(
            _endpoint(test_user.id),
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_401_for_unauthenticated(
        self,
        client: AsyncClient,
        test_user: User,
    ) -> None:
        """401 when no Authorization header is supplied."""
        response = await client.post(_endpoint(test_user.id))
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_422_for_malformed_uuid(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ) -> None:
        """422 when path parameter is not a valid UUID."""
        response = await client.post(
            "/api/v1/admin/users/not-a-valid-uuid/recompute-gamification",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422
