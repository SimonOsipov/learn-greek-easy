"""Unit tests for picture_match_service.

Covers:
- assemble_picture_match_payload (pool-based API): 4 options when pool sufficient,
  unsupported exercise_type, missing description, anchor presign failure,
  description-from-picture text options
- InsufficientDistractorPoolError: exception type

Anchor-exclusion, insufficient-pool, and correct-index randomisation coverage
lives in tests/unit/services/test_picture_match_distractor_pool.py (PERF-18-03).

All S3 calls are mocked and distractors are passed in via `pool=` — no real
database required.

SIT-26 PMATCH-13
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import (
    DescriptionStatus,
    ExerciseType,
    PictureStatus,
    SituationDescription,
    SituationPicture,
)
from src.services.picture_match_service import (
    InsufficientDistractorPoolError,
    assemble_picture_match_payload,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_picture(
    situation_id=None,
    image_s3_key: str | None = None,
    status: PictureStatus = PictureStatus.GENERATED,
) -> MagicMock:
    """Create a mock SituationPicture."""
    pic = MagicMock(spec=SituationPicture)
    pic.id = uuid4()
    pic.situation_id = situation_id or uuid4()
    pic.image_s3_key = image_s3_key or f"situations/{uuid4()}.jpg"
    pic.status = status
    return pic


def _make_description(
    situation_id=None,
    text_el: str = "Ελληνικό κείμενο",
    status: DescriptionStatus = DescriptionStatus.AUDIO_READY,
) -> MagicMock:
    """Create a mock SituationDescription."""
    desc = MagicMock(spec=SituationDescription)
    desc.id = uuid4()
    desc.situation_id = situation_id or uuid4()
    desc.text_el = text_el
    desc.status = status
    return desc


def _make_anchor_exercise(picture, situation, description):
    """Return a mock PictureExercise with eager-loaded relationships."""
    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.picture = picture
    picture.situation = situation
    picture.situation_id = situation.id
    situation.description = description
    return exercise


# ---------------------------------------------------------------------------
# Helpers for 3 distractor rows
# ---------------------------------------------------------------------------


def _make_three_distractor_rows():
    """Create 3 (SituationPicture, SituationDescription) tuples — all different situations."""
    rows = []
    for i in range(3):
        sp = _make_picture(image_s3_key=f"situations/distractor_{i}.jpg")
        sd = _make_description(text_el=f"Περιγραφή αντιπερισπασμός {i}")
        rows.append((sp, sd))
    return rows


# ---------------------------------------------------------------------------
# InsufficientDistractorPoolError
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestInsufficientDistractorPoolError:
    """InsufficientDistractorPoolError is a plain Exception subclass."""

    def test_is_exception_subclass(self):
        err = InsufficientDistractorPoolError("not enough")
        assert isinstance(err, Exception)

    def test_message_preserved(self):
        err = InsufficientDistractorPoolError("only 2 found")
        assert "2" in str(err)


# ---------------------------------------------------------------------------
# assemble_picture_match_payload — SELECT_PICTURE_FROM_DESCRIPTION
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAssemblePictureMatchPayload:
    """Tests for assemble_picture_match_payload."""

    @pytest.mark.asyncio
    async def test_raises_for_unsupported_exercise_type(self) -> None:
        """ValueError raised for an unsupported ExerciseType (non-picture-match)."""
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id)
        anchor_desc = _make_description(situation_id=anchor_sit.id)
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        db = AsyncMock()
        with pytest.raises(ValueError, match="unsupported exercise_type"):
            await assemble_picture_match_payload(db, exercise, ExerciseType.FILL_GAPS, pool=[])

    @pytest.mark.asyncio
    async def test_raises_when_description_is_none(self) -> None:
        """InsufficientDistractorPoolError raised when anchor has no description."""
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id)
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, None)

        db = AsyncMock()
        with pytest.raises(InsufficientDistractorPoolError):
            await assemble_picture_match_payload(
                db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=[]
            )

    @pytest.mark.asyncio
    async def test_returns_4_options_when_pool_sufficient(self) -> None:
        """Payload has exactly 4 options when 3+ distractors are available."""
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id)
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor description")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        pool = _make_three_distractor_rows()
        db = AsyncMock()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/image.jpg"

        with patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3):
            payload = await assemble_picture_match_payload(
                db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=pool
            )

        assert len(payload.options) == 4

    @pytest.mark.asyncio
    async def test_select_description_from_picture_returns_text_options(self) -> None:
        """SELECT_DESCRIPTION_FROM_PICTURE: prompt is anchor image, options are text."""
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id, image_s3_key="situations/anchor.jpg")
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        pool = _make_three_distractor_rows()
        db = AsyncMock()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/anchor.jpg"

        with patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3):
            payload = await assemble_picture_match_payload(
                db, exercise, ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE, pool=pool
            )

        # Anchor image URL is the prompt
        assert payload.anchor_image_url == "https://cdn.example.com/anchor.jpg"
        # 4 text options
        assert len(payload.options) == 4
        # Correct option contains the anchor description text
        correct_opt = payload.options[payload.correct_index]
        assert correct_opt.description_text == "Anchor text"

    @pytest.mark.asyncio
    async def test_raises_when_presign_fails_for_anchor(self) -> None:
        """InsufficientDistractorPoolError if presigned URL cannot be generated for anchor."""
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id, image_s3_key="situations/anchor.jpg")
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        pool = _make_three_distractor_rows()
        db = AsyncMock()

        mock_s3 = MagicMock()
        # Return None (falsy) for ALL keys → presign fails
        mock_s3.generate_presigned_url.return_value = None

        with patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3):
            with pytest.raises(InsufficientDistractorPoolError):
                await assemble_picture_match_payload(
                    db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=pool
                )
