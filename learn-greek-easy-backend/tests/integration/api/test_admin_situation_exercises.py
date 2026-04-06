"""Integration tests for the GET /admin/situations/{id}/exercises endpoint."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    DialogExerciseFactory,
    DialogExerciseItemFactory,
    ListeningDialogFactory,
    PictureExerciseFactory,
    PictureExerciseItemFactory,
    SituationDescriptionFactory,
    SituationFactory,
    SituationPictureFactory,
)

BASE_URL = "/api/v1/admin/situations"


class TestSituationExercisesAuth:
    @pytest.mark.asyncio
    async def test_no_auth_401(self, client: AsyncClient):
        response = await client.get(f"{BASE_URL}/{uuid4()}/exercises")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_regular_user_403(self, client: AsyncClient, auth_headers: dict):
        response = await client.get(f"{BASE_URL}/{uuid4()}/exercises", headers=auth_headers)
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"


class TestSituationExercisesNotFound:
    @pytest.mark.asyncio
    async def test_nonexistent_situation_404(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        response = await client.get(
            f"{BASE_URL}/{uuid4()}/exercises",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404


class TestSituationExercisesHappyPath:
    @pytest.mark.asyncio
    async def test_all_three_source_types(self, client: AsyncClient, superuser_auth_headers: dict):
        situation = await SituationFactory.create()

        # Dialog path
        dialog = await ListeningDialogFactory.create(situation_id=situation.id)
        d_exercise = await DialogExerciseFactory.create(dialog_id=dialog.id)
        await DialogExerciseItemFactory.create(exercise_id=d_exercise.id)
        await DialogExerciseItemFactory.create(exercise_id=d_exercise.id)

        # Description path
        desc = await SituationDescriptionFactory.create(situation_id=situation.id)
        desc_ex = await DescriptionExerciseFactory.create(description_id=desc.id)
        await DescriptionExerciseItemFactory.create(description_exercise_id=desc_ex.id)

        # Picture path
        pic = await SituationPictureFactory.create(situation_id=situation.id)
        pic_ex = await PictureExerciseFactory.create(picture_id=pic.id)
        await PictureExerciseItemFactory.create(picture_exercise_id=pic_ex.id)

        response = await client.get(
            f"{BASE_URL}/{situation.id}/exercises",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 3
        assert len(data["groups"]) == 3

        groups_by_type = {g["source_type"]: g for g in data["groups"]}
        for source_type in ("dialog", "description", "picture"):
            assert source_type in groups_by_type
            group = groups_by_type[source_type]
            assert group["exercise_count"] == 1
            assert len(group["exercises"]) == 1

        # Dialog exercise has 2 items
        dialog_group = groups_by_type["dialog"]
        assert len(dialog_group["exercises"][0]["items"]) == 2

        # Description exercise has audio_level and modality
        desc_group = groups_by_type["description"]
        desc_exercise = desc_group["exercises"][0]
        assert "audio_level" in desc_exercise
        assert "modality" in desc_exercise

    @pytest.mark.asyncio
    async def test_empty_situation_no_exercises(
        self, client: AsyncClient, superuser_auth_headers: dict
    ):
        situation = await SituationFactory.create()
        response = await client.get(
            f"{BASE_URL}/{situation.id}/exercises",
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["groups"]) == 3
        for group in data["groups"]:
            assert group["exercise_count"] == 0
            assert group["exercises"] == []
