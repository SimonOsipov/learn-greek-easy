"""Integration tests for ADMIN2-26 situation admin endpoints.

Covers:
- SAR2-26-17a: link-news / unlink-news / re-derive
- SAR2-26-20: PATCH /situations/{id}/description (text_en + partial update)
- SAR2-26-19: PATCH /situations/{id}/status (transitions, guards, idempotency)
- SAR2-26-18: new SituationListItem fields (levels, dialog_lines_count, roles, etc.)
"""

from datetime import date
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DialogLine, DialogSpeaker, NewsCountry, NewsItem, SituationStatus
from tests.factories.listening_dialog import ListeningDialogFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import SituationDescriptionFactory
from tests.factories.situation_picture import SituationPictureFactory

BASE_URL = "/api/v1/admin/situations"


@pytest.fixture
def mock_s3_service():
    with patch("src.api.v1.admin.get_s3_service") as mock_get:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: f"https://s3.example.com/{key}"
        mock_s3.delete_object.return_value = True
        mock_get.return_value = mock_s3
        yield mock_s3


# ============================================================================
# SAR2-26-17a: link-news / unlink-news / re-derive
# ============================================================================


class TestLinkNews:
    """POST /api/v1/admin/situations/{id}/link-news

    The endpoint re-assigns a NewsItem to this situation.
    409 if the situation already has a DIFFERENT news item linked.
    Idempotent if the news item is already pointing here.
    """

    @pytest.mark.asyncio
    async def test_link_success_moves_news_item(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Move a NewsItem from its current situation to a new situation with no linked news."""
        # Target situation starts with no linked news.
        target = await SituationFactory.create()
        # NewsItem currently points to a different situation.
        other_situation = await SituationFactory.create()
        news_item = NewsItem(
            publication_date=date(2026, 1, 15),
            original_article_url=f"https://example.com/link-success-{uuid4().hex}",
            situation_id=other_situation.id,
        )
        db_session.add(news_item)
        await db_session.flush()

        response = await client.post(
            f"{BASE_URL}/{target.id}/link-news",
            json={"news_item_id": str(news_item.id)},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(target.id)
        assert data["linked_news"]["id"] == str(news_item.id)
        assert data["linked_news"]["published_at"] == "2026-01-15"

    @pytest.mark.asyncio
    async def test_link_idempotent_already_linked(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Linking a news item that already points to the same situation returns 200 no-op."""
        situation = await SituationFactory.create()
        news_item = NewsItem(
            publication_date=date.today(),
            original_article_url=f"https://example.com/idempotent-{uuid4().hex}",
            situation_id=situation.id,
        )
        db_session.add(news_item)
        await db_session.flush()

        # Link again to the same situation.
        response = await client.post(
            f"{BASE_URL}/{situation.id}/link-news",
            json={"news_item_id": str(news_item.id)},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["linked_news"]["id"] == str(news_item.id)

    @pytest.mark.asyncio
    async def test_link_409_situation_already_has_different_news(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """409 when the situation already has a DIFFERENT linked news item."""
        target = await SituationFactory.create()
        other_situation = await SituationFactory.create()

        # Existing news item for target.
        existing_news = NewsItem(
            publication_date=date.today(),
            original_article_url=f"https://example.com/existing-{uuid4().hex}",
            situation_id=target.id,
        )
        # Another news item we want to link (from other_situation).
        candidate_news = NewsItem(
            publication_date=date.today(),
            original_article_url=f"https://example.com/candidate-{uuid4().hex}",
            situation_id=other_situation.id,
        )
        db_session.add_all([existing_news, candidate_news])
        await db_session.flush()

        response = await client.post(
            f"{BASE_URL}/{target.id}/link-news",
            json={"news_item_id": str(candidate_news.id)},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409
        assert "already has" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_link_404_situation_not_found(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        response = await client.post(
            f"{BASE_URL}/{uuid4()}/link-news",
            json={"news_item_id": str(uuid4())},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_link_404_news_item_not_found(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        response = await client.post(
            f"{BASE_URL}/{situation.id}/link-news",
            json={"news_item_id": str(uuid4())},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


class TestUnlinkNews:
    """DELETE /api/v1/admin/situations/{id}/link-news"""

    @pytest.mark.asyncio
    async def test_unlink_success(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Unlink returns 200 and linked_news is null afterwards."""
        situation = await SituationFactory.create()
        news_item = NewsItem(
            publication_date=date.today(),
            original_article_url=f"https://example.com/unlink-{uuid4().hex}",
            situation_id=situation.id,
        )
        db_session.add(news_item)
        await db_session.flush()

        response = await client.delete(
            f"{BASE_URL}/{situation.id}/link-news",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["linked_news"] is None

    @pytest.mark.asyncio
    async def test_unlink_404_no_linked_news(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """404 when the situation has no linked news item."""
        situation = await SituationFactory.create()
        response = await client.delete(
            f"{BASE_URL}/{situation.id}/link-news",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_unlink_404_situation_not_found(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        response = await client.delete(
            f"{BASE_URL}/{uuid4()}/link-news",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


class TestReDerive:
    """POST /api/v1/admin/situations/{id}/re-derive"""

    @pytest.mark.asyncio
    async def test_re_derive_501(self, client: AsyncClient, superuser_auth_headers: dict):
        """re-derive returns 501 stub."""
        situation = await SituationFactory.create()
        response = await client.post(
            f"{BASE_URL}/{situation.id}/re-derive",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 501
        assert "not yet implemented" in response.json()["detail"].lower()


# ============================================================================
# SAR2-26-20: PATCH /situations/{id}/description
# ============================================================================


class TestPatchSituationDescription:
    """PATCH /api/v1/admin/situations/{id}/description"""

    @pytest.mark.asyncio
    async def test_patch_text_en_only(self, client: AsyncClient, superuser_auth_headers: dict):
        """Patching text_en leaves text_el unchanged."""
        situation = await SituationFactory.create()
        description = await SituationDescriptionFactory.create(
            situation_id=situation.id, text_el="Ελληνικό κείμενο"
        )

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/description",
            json={"text_en": "English translation"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"]["text_en"] == "English translation"
        assert data["description"]["text_el"] == description.text_el

    @pytest.mark.asyncio
    async def test_patch_text_el_only(self, client: AsyncClient, superuser_auth_headers: dict):
        """Patching text_el leaves text_en unchanged."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id)

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/description",
            json={"text_el": "Νέο ελληνικό κείμενο"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"]["text_el"] == "Νέο ελληνικό κείμενο"

    @pytest.mark.asyncio
    async def test_patch_multiple_fields(self, client: AsyncClient, superuser_auth_headers: dict):
        """Patching multiple fields in one request works."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id)

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/description",
            json={
                "text_el": "Νέο κείμενο",
                "text_en": "New English text",
                "text_el_a2": "Απλό κείμενο A2",
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        desc = response.json()["description"]
        assert desc["text_el"] == "Νέο κείμενο"
        assert desc["text_en"] == "New English text"
        assert desc["text_el_a2"] == "Απλό κείμενο A2"

    @pytest.mark.asyncio
    async def test_patch_404_no_description(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """404 when situation has no description yet."""
        situation = await SituationFactory.create()
        response = await client.patch(
            f"{BASE_URL}/{situation.id}/description",
            json={"text_en": "Some text"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_patch_404_situation_not_found(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        response = await client.patch(
            f"{BASE_URL}/{uuid4()}/description",
            json={"text_en": "x"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


# ============================================================================
# SAR2-26-19: PATCH /situations/{id}/status
# ============================================================================


class TestSituationStatusTransition:
    """PATCH /api/v1/admin/situations/{id}/status"""

    @pytest.mark.asyncio
    async def test_happy_path_draft_to_ready(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """draft → ready succeeds when description + dialog lines are present."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(
            situation_id=situation.id, text_el="Ελληνικό κείμενο"
        )
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)
        speaker = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Γιάννης", voice_id="v1"
        )
        db_session.add(speaker)
        await db_session.flush()
        line = DialogLine(dialog_id=dialog.id, speaker_id=speaker.id, line_index=0, text="Γεια!")
        db_session.add(line)
        await db_session.flush()

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "ready"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ready"

    @pytest.mark.asyncio
    async def test_guard_no_description(self, client: AsyncClient, superuser_auth_headers: dict):
        """draft → ready blocked when there is no description."""
        situation = await SituationFactory.create()
        await ListeningDialogFactory.create(situation_id=situation.id)

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "ready"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409
        err = response.json()["detail"]["error"]
        assert err["code"] == "STATUS_GUARD_FAILED"
        assert "description" in err["detail"]["missing"]

    @pytest.mark.asyncio
    async def test_guard_empty_text_el(self, client: AsyncClient, superuser_auth_headers: dict):
        """draft → ready blocked when description.text_el is empty/whitespace."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id, text_el="   ")

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "ready"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409
        err = response.json()["detail"]["error"]
        assert "description.text_el" in err["detail"]["missing"]

    @pytest.mark.asyncio
    async def test_guard_no_dialog(self, client: AsyncClient, superuser_auth_headers: dict):
        """draft → ready blocked when there is no dialog."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id, text_el="Κείμενο")

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "ready"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409
        err = response.json()["detail"]["error"]
        assert "dialog" in err["detail"]["missing"]

    @pytest.mark.asyncio
    async def test_guard_no_dialog_lines(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """draft → ready blocked when dialog exists but has no lines."""
        situation = await SituationFactory.create()
        await SituationDescriptionFactory.create(situation_id=situation.id, text_el="Κείμενο")
        await ListeningDialogFactory.create(situation_id=situation.id)

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "ready"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 409
        err = response.json()["detail"]["error"]
        assert "dialog.lines" in err["detail"]["missing"]

    @pytest.mark.asyncio
    async def test_ready_to_draft_always_allowed(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """ready → draft requires no guards."""
        situation = await SituationFactory.create(status=SituationStatus.READY)

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "draft"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "draft"

    @pytest.mark.asyncio
    async def test_idempotent_same_status(self, client: AsyncClient, superuser_auth_headers: dict):
        """Requesting the current status returns 200 without side effects."""
        situation = await SituationFactory.create()  # draft by default

        response = await client.patch(
            f"{BASE_URL}/{situation.id}/status",
            json={"status": "draft"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "draft"

    @pytest.mark.asyncio
    async def test_404_nonexistent(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.patch(
            f"{BASE_URL}/{uuid4()}/status",
            json={"status": "draft"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


# ============================================================================
# SAR2-26-18: SituationListItem new fields
# ============================================================================


class TestSituationListNewFields:
    """New SituationListItem fields: levels, dialog_lines_count, roles,
    picture_image_url, audio_duration_seconds, source_title_en, source_country."""

    @pytest.mark.asyncio
    async def test_levels_default_empty_list(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """A brand-new situation (no migration data-fill) returns levels as an empty list."""
        situation = await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert isinstance(item["levels"], list)

    @pytest.mark.asyncio
    async def test_dialog_lines_count_and_roles(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """dialog_lines_count and roles reflect actual dialog content."""
        situation = await SituationFactory.create()
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)

        speaker1 = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=0, character_name="Άννα", voice_id="v1"
        )
        speaker2 = DialogSpeaker(
            dialog_id=dialog.id, speaker_index=1, character_name="Νίκος", voice_id="v2"
        )
        db_session.add_all([speaker1, speaker2])
        await db_session.flush()

        line1 = DialogLine(dialog_id=dialog.id, speaker_id=speaker1.id, line_index=0, text="Γεια!")
        line2 = DialogLine(
            dialog_id=dialog.id, speaker_id=speaker2.id, line_index=1, text="Καλημέρα!"
        )
        line3 = DialogLine(
            dialog_id=dialog.id, speaker_id=speaker1.id, line_index=2, text="Πώς είσαι;"
        )
        db_session.add_all([line1, line2, line3])
        await db_session.flush()

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["dialog_lines_count"] == 3
        # Roles: first two speakers by earliest line; Άννα appears at line 0, Νίκος at line 1.
        assert "Άννα" in item["roles"]
        assert "Νίκος" in item["roles"]
        assert len(item["roles"]) == 2

    @pytest.mark.asyncio
    async def test_roles_empty_when_no_dialog(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """roles is empty when there is no dialog."""
        situation = await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["roles"] == []
        assert item["dialog_lines_count"] == 0

    @pytest.mark.asyncio
    async def test_picture_image_url_present_with_s3_key(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        mock_s3_service: MagicMock,
    ):
        """picture_image_url is a presigned URL when image_s3_key is set."""
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(
            situation_id=situation.id, image_s3_key="pics/test.png"
        )

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["picture_image_url"] == "https://s3.example.com/pics/test.png"

    @pytest.mark.asyncio
    async def test_picture_image_url_null_when_no_key(
        self, client: AsyncClient, superuser_auth_headers: dict, mock_s3_service: MagicMock
    ):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)  # no image_s3_key

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["picture_image_url"] is None

    @pytest.mark.asyncio
    async def test_audio_duration_seconds(self, client: AsyncClient, superuser_auth_headers: dict):
        """audio_duration_seconds is lifted from dialog when present."""
        situation = await SituationFactory.create()
        await ListeningDialogFactory.create(situation_id=situation.id, audio_duration_seconds=123.5)

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["audio_duration_seconds"] == 123.5

    @pytest.mark.asyncio
    async def test_source_title_en_and_country(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        """source_title_en comes from Situation; source_country from description.country."""
        situation = await SituationFactory.create()
        situation.source_title_en = "Test Article Title"
        await SituationDescriptionFactory.create(
            situation_id=situation.id,
            country=NewsCountry.CYPRUS,
        )

        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        assert item["source_title_en"] == "Test Article Title"
        assert item["source_country"] == "cyprus"

    @pytest.mark.asyncio
    async def test_new_fields_all_present_in_response(
        self, client: AsyncClient, superuser_auth_headers: dict, mock_s3_service: MagicMock
    ):
        """All new list item fields are present in the response schema."""
        situation = await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}?search={situation.scenario_en[:10]}",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        item = next(i for i in response.json()["items"] if i["id"] == str(situation.id))
        for field in [
            "levels",
            "dialog_lines_count",
            "roles",
            "picture_image_url",
            "audio_duration_seconds",
            "source_title_en",
            "source_country",
        ]:
            assert field in item, f"Missing field: {field}"
