"""Integration tests for PATCH /api/v1/admin/situations/{id}/picture endpoint.

Covers auth, 404s, validation (trio shape + length), all happy-path edit
combinations, and the invariants that status / image_s3_key must not change.

Recomposition rule (PEDIT-03):
  When scene_en or style_en is in the body, server recomputes:
      image_prompt = f"{post_patch_scene_en}\n\n{post_patch_style_en or DEFAULT}"
  When scene_en is None/empty after patch (e.g. all-three-clear), _recompose
  returns None and image_prompt is LEFT UNCHANGED (NOT NULL is enforced at DB
  level so the endpoint short-circuits; see admin.py::_recompose_image_prompt).
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import PictureStatus
from src.services.picture_prompt import get_default_picture_style_en
from tests.factories.situation import SituationFactory
from tests.factories.situation_picture import SituationPictureFactory

BASE_URL_TMPL = "/api/v1/admin/situations/{situation_id}/picture"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _url(situation_id) -> str:
    return BASE_URL_TMPL.format(situation_id=situation_id)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class TestPictureUpdateAuth:
    """401 for unauthenticated, 403 for regular (non-superuser) user."""

    @pytest.mark.asyncio
    async def test_patch_no_auth_401(self, client: AsyncClient):
        response = await client.patch(_url(uuid4()), json={"style_en": "test"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_patch_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.patch(
            _url(uuid4()), json={"style_en": "test"}, headers=auth_headers
        )
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"


# ---------------------------------------------------------------------------
# 404 paths
# ---------------------------------------------------------------------------


class TestPictureUpdate404s:
    """404 when situation is missing, and when situation exists but has no picture."""

    @pytest.mark.asyncio
    async def test_404_situation_not_found(self, client: AsyncClient, superuser_auth_headers: dict):
        response = await client.patch(
            _url(uuid4()), json={"style_en": "x"}, headers=superuser_auth_headers
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_404_situation_exists_but_picture_is_none(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        # No SituationPicture row created — picture is None.
        response = await client.patch(
            _url(situation.id), json={"style_en": "x"}, headers=superuser_auth_headers
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Validation — trio shape and field lengths
# ---------------------------------------------------------------------------


class TestPictureUpdateValidation:
    """422 for partial trio and for any field exceeding 1 000 chars."""

    @pytest.mark.asyncio
    async def test_422_partial_trio_scene_en_only(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={"scene_en": "Hello"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422
        body = response.text
        assert "scene_en, scene_el and scene_ru must all be provided or all omitted" in body

    @pytest.mark.asyncio
    async def test_422_partial_trio_scene_el_and_ru_only(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={"scene_el": "Γεια", "scene_ru": "Привет"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422
        body = response.text
        assert "scene_en, scene_el and scene_ru must all be provided or all omitted" in body

    @pytest.mark.asyncio
    async def test_422_scene_en_too_long(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={
                "scene_en": "a" * 1001,
                "scene_el": "valid",
                "scene_ru": "valid",
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_scene_el_too_long(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={
                "scene_en": "valid",
                "scene_el": "a" * 1001,
                "scene_ru": "valid",
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_scene_ru_too_long(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={
                "scene_en": "valid",
                "scene_el": "valid",
                "scene_ru": "a" * 1001,
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_style_en_too_long(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()
        await SituationPictureFactory.create(situation_id=situation.id)
        response = await client.patch(
            _url(situation.id),
            json={"style_en": "a" * 1001},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


class TestPictureUpdateHappyPath:
    """All successful edit combinations, asserting both response and DB state."""

    @pytest.mark.asyncio
    async def test_happy_full_trio_plus_style_recomposes_image_prompt(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            image_prompt="old prompt",
        )
        payload = {
            "scene_en": "A sunny beach",
            "scene_el": "Μια ηλιόλουστη παραλία",
            "scene_ru": "Солнечный пляж",
            "style_en": "watercolor style",
        }
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scene_en"] == "A sunny beach"
        assert data["scene_el"] == "Μια ηλιόλουστη παραλία"
        assert data["scene_ru"] == "Солнечный пляж"
        assert data["style_en"] == "watercolor style"
        expected_prompt = "A sunny beach\n\nwatercolor style"
        assert data["image_prompt"] == expected_prompt

        await db_session.refresh(picture)
        assert picture.image_prompt == expected_prompt
        assert picture.scene_en == "A sunny beach"
        assert picture.style_en == "watercolor style"

    @pytest.mark.asyncio
    async def test_all_three_clear_trio_columns_become_null(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """All-three-clear: trio sent as empty strings, style_en omitted.

        After the call, scene_en/scene_el/scene_ru become NULL.
        Because post-patch scene_en is NULL/empty, _recompose_image_prompt
        returns None and the endpoint LEAVES image_prompt unchanged (it cannot
        store NULL in a NOT NULL column). This is the behaviour shipped in
        PEDIT-03 and is intentional — the test asserts the unchanged value, not
        NULL.
        """
        original_prompt = "original image prompt"
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="A sunny beach",
            scene_el="Μια ηλιόλουστη παραλία",
            scene_ru="Солнечный пляж",
            image_prompt=original_prompt,
        )
        payload = {"scene_en": "", "scene_el": "", "scene_ru": ""}
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scene_en"] is None
        assert data["scene_el"] is None
        assert data["scene_ru"] is None
        # image_prompt must be UNCHANGED because scene_en is now NULL.
        assert data["image_prompt"] == original_prompt

        await db_session.refresh(picture)
        assert picture.scene_en is None
        assert picture.scene_el is None
        assert picture.scene_ru is None
        assert picture.image_prompt == original_prompt

    @pytest.mark.asyncio
    async def test_omitted_style_edit_preserves_existing_style_en(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Only trio in body — style_en absent → style_en column unchanged,
        image_prompt recomposed using existing style_en."""
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="Old scene",
            scene_el="Παλιά σκηνή",
            scene_ru="Старая сцена",
            style_en="existing watercolor",
            image_prompt="Old scene\n\nexisting watercolor",
        )
        payload = {
            "scene_en": "New scene",
            "scene_el": "Νέα σκηνή",
            "scene_ru": "Новая сцена",
        }
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scene_en"] == "New scene"
        assert data["style_en"] == "existing watercolor"  # unchanged
        expected_prompt = "New scene\n\nexisting watercolor"
        assert data["image_prompt"] == expected_prompt

        await db_session.refresh(picture)
        assert picture.style_en == "existing watercolor"
        assert picture.image_prompt == expected_prompt

    @pytest.mark.asyncio
    async def test_omitted_style_edit_with_null_existing_style_falls_back_to_default(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Trio in body, style_en absent, existing style_en is NULL →
        image_prompt recomposed using DEFAULT_PICTURE_STYLE_EN."""
        default_style = get_default_picture_style_en()
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="Old scene",
            scene_el="Παλιά σκηνή",
            scene_ru="Старая сцена",
            style_en=None,
            image_prompt=f"Old scene\n\n{default_style}",
        )
        payload = {
            "scene_en": "New scene",
            "scene_el": "Νέα σκηνή",
            "scene_ru": "Новая сцена",
        }
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scene_en"] == "New scene"
        assert data["style_en"] is None  # still NULL
        expected_prompt = f"New scene\n\n{default_style}"
        assert data["image_prompt"] == expected_prompt

        await db_session.refresh(picture)
        assert picture.style_en is None
        assert picture.image_prompt == expected_prompt

    @pytest.mark.asyncio
    async def test_style_only_edit_preserves_trio_columns(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Only style_en in body → trio columns unchanged, image_prompt
        recomposed using new style and existing scene_en."""
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="A sunny beach",
            scene_el="Μια ηλιόλουστη παραλία",
            scene_ru="Солнечный пляж",
            style_en="old style",
            image_prompt="A sunny beach\n\nold style",
        )
        payload = {"style_en": "new oil style"}
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["style_en"] == "new oil style"
        assert data["scene_en"] == "A sunny beach"  # unchanged
        assert data["scene_el"] == "Μια ηλιόλουστη παραλία"  # unchanged
        assert data["scene_ru"] == "Солнечный пляж"  # unchanged
        expected_prompt = "A sunny beach\n\nnew oil style"
        assert data["image_prompt"] == expected_prompt

        await db_session.refresh(picture)
        assert picture.scene_en == "A sunny beach"
        assert picture.image_prompt == expected_prompt

    @pytest.mark.asyncio
    async def test_scene_plus_style_edit_recomposes_from_both_new_values(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Full trio + new style → image_prompt = f'{scene_en}\n\n{style_en}'."""
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="Old scene",
            scene_el="Παλιά σκηνή",
            scene_ru="Старая сцена",
            style_en="old style",
            image_prompt="Old scene\n\nold style",
        )
        payload = {
            "scene_en": "New landscape",
            "scene_el": "Νέο τοπίο",
            "scene_ru": "Новый пейзаж",
            "style_en": "impressionist",
        }
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        expected_prompt = "New landscape\n\nimpressionist"
        assert data["image_prompt"] == expected_prompt
        assert data["scene_en"] == "New landscape"
        assert data["style_en"] == "impressionist"

        await db_session.refresh(picture)
        assert picture.image_prompt == expected_prompt

    @pytest.mark.asyncio
    async def test_style_cleared_falls_back_to_default_in_image_prompt(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        """style_en: '' in body, trio absent → style_en becomes NULL,
        image_prompt recomposed using DEFAULT_PICTURE_STYLE_EN and existing scene_en."""
        default_style = get_default_picture_style_en()
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="A cozy café",
            scene_el="Ένα άνετο καφέ",
            scene_ru="Уютное кафе",
            style_en="old style",
            image_prompt="A cozy café\n\nold style",
        )
        payload = {"style_en": ""}  # explicit clear — trio absent
        response = await client.patch(
            _url(situation.id), json=payload, headers=superuser_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["style_en"] is None  # cleared to NULL
        assert data["scene_en"] == "A cozy café"  # unchanged
        expected_prompt = f"A cozy café\n\n{default_style}"
        assert data["image_prompt"] == expected_prompt

        await db_session.refresh(picture)
        assert picture.style_en is None
        assert picture.image_prompt == expected_prompt


# ---------------------------------------------------------------------------
# Invariants — status and image_s3_key must never be touched
# ---------------------------------------------------------------------------


class TestPictureUpdateInvariants:
    """After every successful save, status and image_s3_key must be unchanged.

    Both columns are seeded with non-default values (GENERATED / a real S3 key)
    so the test is meaningful — if the endpoint accidentally wrote these fields
    the assertion would catch it.
    """

    @pytest.mark.asyncio
    async def test_status_unchanged_after_save(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="Scene text",
            scene_el="Κείμενο σκηνής",
            scene_ru="Текст сцены",
            style_en="pencil sketch",
            image_prompt="Scene text\n\npencil sketch",
            status=PictureStatus.GENERATED,
            image_s3_key="situations/foo.jpg",
        )
        pre_status = picture.status

        response = await client.patch(
            _url(situation.id),
            json={"style_en": "new style"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200

        await db_session.refresh(picture)
        assert picture.status == pre_status
        assert picture.status == PictureStatus.GENERATED

    @pytest.mark.asyncio
    async def test_image_s3_key_unchanged_after_save(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        situation = await SituationFactory.create()
        picture = await SituationPictureFactory.create(
            situation_id=situation.id,
            scene_en="Scene text",
            scene_el="Κείμενο σκηνής",
            scene_ru="Текст сцены",
            style_en="pencil sketch",
            image_prompt="Scene text\n\npencil sketch",
            status=PictureStatus.GENERATED,
            image_s3_key="situations/foo.jpg",
        )
        pre_key = picture.image_s3_key

        response = await client.patch(
            _url(situation.id),
            json={"style_en": "new style"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200

        await db_session.refresh(picture)
        assert picture.image_s3_key == pre_key
        assert picture.image_s3_key == "situations/foo.jpg"
