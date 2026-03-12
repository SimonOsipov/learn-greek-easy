"""Unit tests for Admin Listening Dialog endpoints.

Covers:
- GET /api/v1/admin/listening-dialogs (list with pagination and filters)
- DELETE /api/v1/admin/listening-dialogs/{dialog_id} (delete)
- Authentication (401 without token)
- Authorization (403 for non-superusers)
- Pagination and ordering
- Status and CEFR-level filters
- 404 on delete of missing dialog
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckLevel, DialogStatus
from tests.factories.listening_dialog import ListeningDialogFactory


class TestListListeningDialogs:
    """Tests for GET /api/v1/admin/listening-dialogs."""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/admin/listening-dialogs")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_requires_superuser(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.get("/api/v1/admin/listening-dialogs", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_empty_list(self, client: AsyncClient, superuser_auth_headers: dict) -> None:
        response = await client.get(
            "/api/v1/admin/listening-dialogs", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 20

    @pytest.mark.asyncio
    async def test_returns_dialog_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        dialog = await ListeningDialogFactory.create(session=db_session)

        response = await client.get(
            "/api/v1/admin/listening-dialogs", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["id"] == str(dialog.id)
        assert item["scenario_el"] == dialog.scenario_el
        assert item["scenario_en"] == dialog.scenario_en
        assert item["scenario_ru"] == dialog.scenario_ru
        assert item["cefr_level"] == dialog.cefr_level.value
        assert item["num_speakers"] == dialog.num_speakers
        assert item["status"] == dialog.status.value
        assert "created_at" in item

    @pytest.mark.asyncio
    async def test_orders_by_created_at_desc(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await ListeningDialogFactory.create_batch(3, session=db_session)

        response = await client.get(
            "/api/v1/admin/listening-dialogs", headers=superuser_auth_headers
        )
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 3
        # Verify created_at values are in descending (or equal) order
        created_ats = [item["created_at"] for item in items]
        assert created_ats == sorted(created_ats, reverse=True)

    @pytest.mark.asyncio
    async def test_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await ListeningDialogFactory.create_batch(5, session=db_session)

        # Page 1 with page_size=2
        response = await client.get(
            "/api/v1/admin/listening-dialogs?page=1&page_size=2",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["items"]) == 2

        # Page 2
        response2 = await client.get(
            "/api/v1/admin/listening-dialogs?page=2&page_size=2",
            headers=superuser_auth_headers,
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page"] == 2
        assert len(data2["items"]) == 2
        # Items on page 2 should differ from page 1
        page1_ids = {i["id"] for i in data["items"]}
        page2_ids = {i["id"] for i in data2["items"]}
        assert page1_ids.isdisjoint(page2_ids)

    @pytest.mark.asyncio
    async def test_filter_by_status(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await ListeningDialogFactory.create(session=db_session, status=DialogStatus.DRAFT)
        await ListeningDialogFactory.create(session=db_session, status=DialogStatus.PUBLISHED)

        response = await client.get(
            "/api/v1/admin/listening-dialogs?status=published",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "published"

    @pytest.mark.asyncio
    async def test_filter_by_cefr_level(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        await ListeningDialogFactory.create(session=db_session, cefr_level=DeckLevel.A1)
        await ListeningDialogFactory.create(session=db_session, cefr_level=DeckLevel.B2)

        response = await client.get(
            "/api/v1/admin/listening-dialogs?cefr_level=A1",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["cefr_level"] == "A1"

    @pytest.mark.asyncio
    async def test_page_size_validation(
        self, client: AsyncClient, superuser_auth_headers: dict
    ) -> None:
        # page_size > 100 should be rejected
        response = await client.get(
            "/api/v1/admin/listening-dialogs?page_size=101",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_page_validation(self, client: AsyncClient, superuser_auth_headers: dict) -> None:
        # page < 1 should be rejected
        response = await client.get(
            "/api/v1/admin/listening-dialogs?page=0",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422


class TestDeleteListeningDialog:
    """Tests for DELETE /api/v1/admin/listening-dialogs/{dialog_id}."""

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient) -> None:
        response = await client.delete(f"/api/v1/admin/listening-dialogs/{uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_requires_superuser(self, client: AsyncClient, auth_headers: dict) -> None:
        response = await client.delete(
            f"/api/v1/admin/listening-dialogs/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self, client: AsyncClient, superuser_auth_headers: dict
    ) -> None:
        response = await client.delete(
            f"/api/v1/admin/listening-dialogs/{uuid4()}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        dialog = await ListeningDialogFactory.create(session=db_session)

        response = await client.delete(
            f"/api/v1/admin/listening-dialogs/{dialog.id}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 204
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_delete_removes_from_list(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        dialog = await ListeningDialogFactory.create(session=db_session)

        # Confirm it's in the list
        list_before = await client.get(
            "/api/v1/admin/listening-dialogs", headers=superuser_auth_headers
        )
        assert list_before.json()["total"] == 1

        # Delete
        await client.delete(
            f"/api/v1/admin/listening-dialogs/{dialog.id}",
            headers=superuser_auth_headers,
        )

        # Confirm it's gone
        list_after = await client.get(
            "/api/v1/admin/listening-dialogs", headers=superuser_auth_headers
        )
        assert list_after.json()["total"] == 0
