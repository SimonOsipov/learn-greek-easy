"""QA adversarial/edge unit coverage for PERF-18-03 (picture-match batch pool).

Complements the executor's RED specs in test_picture_match_distractor_pool.py.
Adds:
  1. Exactly-3-eligible-after-anchor-exclusion boundary — the pool contains the
     anchor's own row plus exactly 3 other rows, so eligible == 3 (the minimum).
     This must NOT raise (the `< 3` guard is strict) and must yield 4 options.
  2. Restores the `prompt_description` assertion for
     SELECT_PICTURE_FROM_DESCRIPTION that the Stage-3 consolidation dropped when
     the old file's `test_anchor_excluded_from_distractors` (which asserted
     `payload.prompt_description == "Anchor text"`) was superseded by the
     situation-exclusion spec — no surviving test asserts the SELECT_PICTURE
     prompt carries the anchor description text.
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
from src.services.picture_match_service import assemble_picture_match_payload


def _make_picture(situation_id=None, image_s3_key: str | None = None) -> MagicMock:
    pic = MagicMock(spec=SituationPicture)
    pic.id = uuid4()
    pic.situation_id = situation_id or uuid4()
    pic.image_s3_key = image_s3_key or f"situations/{uuid4()}.jpg"
    pic.status = PictureStatus.GENERATED
    return pic


def _make_description(situation_id=None, text_el: str = "Ελληνικό κείμενο") -> MagicMock:
    desc = MagicMock(spec=SituationDescription)
    desc.id = uuid4()
    desc.situation_id = situation_id or uuid4()
    desc.text_el = text_el
    desc.status = DescriptionStatus.AUDIO_READY
    return desc


def _make_anchor_exercise(picture, situation, description):
    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.picture = picture
    picture.situation = situation
    picture.situation_id = situation.id
    situation.description = description
    return exercise


@pytest.mark.unit
class TestPoolBoundaryAndPrompt:
    """Boundary (exactly 3 eligible) + restored prompt-text assertion."""

    @pytest.mark.asyncio
    async def test_exactly_three_eligible_after_anchor_exclusion_boundary(self) -> None:
        """Pool = anchor's own row + exactly 3 other rows → eligible == 3.

        This is the boundary of the `< 3` insufficient-pool guard: 3 eligible
        must succeed (NOT raise) and produce 4 options. Also asserts the
        SELECT_PICTURE_FROM_DESCRIPTION prompt carries the anchor's description
        text — coverage the Stage-3 consolidation dropped.
        """
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id, image_s3_key="situations/anchor.jpg")
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        # Anchor's own row (must be excluded) + exactly 3 distinct other rows.
        anchor_row = (anchor_pic, anchor_desc)
        other_rows = [
            (_make_picture(image_s3_key=f"situations/d{i}.jpg"), _make_description())
            for i in range(3)
        ]
        pool = [anchor_row, *other_rows]  # eligible after exclusion == 3 (the minimum)

        anchor_url = "https://cdn.example.com/anchor.jpg"

        def presign(key: str, **kwargs: object) -> str:
            if key == "situations/anchor.jpg":
                return anchor_url
            return f"https://cdn.example.com/{key.rsplit('/', 1)[-1]}"

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = presign

        db = AsyncMock()
        with patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3):
            payload = await assemble_picture_match_payload(
                db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=pool
            )

        # Boundary: 3 eligible is sufficient — no raise, exactly 4 options.
        assert len(payload.options) == 4
        # Restored coverage: prompt carries the anchor's description text.
        assert payload.prompt_description == "Anchor text"
        # Anchor image appears exactly once, at correct_index (own row not leaked).
        anchor_options = [opt for opt in payload.options if opt.image_url == anchor_url]
        assert len(anchor_options) == 1
        assert payload.correct_index == anchor_options[0].option_index
