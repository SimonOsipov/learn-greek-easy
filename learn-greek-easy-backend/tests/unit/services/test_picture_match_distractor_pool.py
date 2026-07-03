"""Unit tests for PERF-18-03: picture-match batch distractor pool (pool-based semantics).

These tests target the NEW `pool: list[_Candidate]` kwarg that PERF-18-03 adds
to `assemble_picture_match_payload` (picture_match_service.py:51-55) — the pool
is pre-fetched once per exercise-type by the caller and passed in, replacing
the per-item `_fetch_candidates` DB query with in-Python filtering +
`random.sample`.

RED status (pre-implementation, current code):

  NOT-IMPLEMENTED RED (today's `assemble_picture_match_payload` has no `pool`
  keyword parameter at all — see picture_match_service.py:51-55 — so calling
  with `pool=[...]` raises an uncaught `TypeError: ... unexpected keyword
  argument 'pool'` before any assertion in the test body runs; this is the
  "not-implemented" RED class from the Mode A discipline, not an assertion
  mismatch):
    - test_distractor_pool_excludes_anchor_situation (AC2)
    - test_insufficient_pool_raises_and_drops_item (AC2)
    - test_correct_index_randomised_across_positions (AC2)

  TRUE RED (clean assertion failure, mechanism already exists and is checked
  directly against source — no signature change needed to observe it):
    - test_todo_perf_comments_removed (AC4)

These tests do NOT modify or duplicate the 8 existing `TestAssemblePictureMatchPayload`
db-mock tests in `tests/unit/services/test_picture_match_service.py` (out of
scope for Mode A per the story's per-subtask test-realignment policy — the
EXECUTOR migrates those 6 db-mock tests to `pool=` in Stage 3, per the
"CORRECTION (2026-07-03)" addendum on task-1256). Overlap notes for the
executor's Stage-3 consolidation:
  - `test_distractor_pool_excludes_anchor_situation` conceptually supersedes
    the old file's `test_anchor_excluded_from_distractors`.
  - `test_insufficient_pool_raises_and_drops_item` conceptually supersedes
    the old file's `test_raises_when_fewer_than_3_distractors`.
  - `test_correct_index_randomised_across_positions` conceptually supersedes
    the old file's `test_correct_index_randomization_covers_all_positions`.
  - The old file's `test_raises_for_unsupported_exercise_type`,
    `test_raises_when_description_is_none`, `test_returns_4_options_when_pool_sufficient`,
    `test_select_description_from_picture_returns_text_options`, and
    `test_raises_when_presign_fails_for_anchor` have no equivalent here and
    should simply be migrated (add `pool=` to their existing DB-mock calls) by
    the executor, not deleted.
"""

from __future__ import annotations

import inspect
from collections import Counter
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

import src.services.picture_match_service as picture_match_service
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
# Helpers (local, deliberately duplicated from test_picture_match_service.py —
# that file is Stage-3 executor territory; keeping this file self-contained
# avoids collision during the executor's consolidation pass).
# ---------------------------------------------------------------------------


def _make_picture(
    situation_id=None,
    image_s3_key: str | None = None,
    status: PictureStatus = PictureStatus.GENERATED,
) -> MagicMock:
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
    desc = MagicMock(spec=SituationDescription)
    desc.id = uuid4()
    desc.situation_id = situation_id or uuid4()
    desc.text_el = text_el
    desc.status = status
    return desc


def _make_anchor_exercise(picture: MagicMock, situation: MagicMock, description: MagicMock):
    """Return a mock PictureExercise with eager-loaded relationships."""
    exercise = MagicMock()
    exercise.id = uuid4()
    exercise.picture = picture
    picture.situation = situation
    picture.situation_id = situation.id
    situation.description = description
    return exercise


def _make_three_distractor_rows() -> list[tuple]:
    """Create 3 (SituationPicture, SituationDescription) tuples — all different situations."""
    rows = []
    for i in range(3):
        sp = _make_picture(image_s3_key=f"situations/distractor_{i}.jpg")
        sd = _make_description(text_el=f"Περιγραφή αντιπερισπασμός {i}")
        rows.append((sp, sd))
    return rows


# ---------------------------------------------------------------------------
# AC2 — test_distractor_pool_excludes_anchor_situation
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAssembleWithPoolAnchorExclusion:
    """Pool-based assembly excludes the anchor's own situation from distractor slots."""

    @pytest.mark.asyncio
    async def test_distractor_pool_excludes_anchor_situation(self) -> None:
        """AC2 — pool-based assembly must exclude the anchor's own situation from
        distractor slots, even when the raw pool contains a row for it.

        RED reason (not-implemented): today's `assemble_picture_match_payload`
        signature (picture_match_service.py:51-55) has no `pool` keyword
        parameter — it always sources candidates itself via `_fetch_candidates`
        (:117-177), which applies `Situation.id != anchor_situation_id` in SQL
        (:144). Calling with `pool=[...]` today raises an uncaught
        `TypeError: ... unexpected keyword argument 'pool'` before any
        assertion below runs — a not-implemented RED, not an assertion
        mismatch.

        GREEN after: PERF-18-03 threads a pre-fetched `pool: list[_Candidate]`
        through `assemble_picture_match_payload`; the anchor-exclusion filter
        moves from a SQL WHERE clause to a Python list comprehension over
        `pool` (`sp.situation_id != anchor_situation_id`). The pool
        deliberately contains a row equal to the anchor's own situation
        (planted first) plus 3 distinct other rows — proving the anchor's own
        pool entry is filtered out by the RULE, not merely absent by
        fixture construction.
        """
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id, image_s3_key="situations/anchor.jpg")
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        # Pool = 1 row that shares the anchor's own situation_id (a raw pool
        # query has no per-anchor WHERE filter, so this can legitimately show
        # up) + 3 distinct distractor rows. Eligible-after-exclusion = 3.
        same_situation_row = (anchor_pic, anchor_desc)
        distractor_rows = _make_three_distractor_rows()
        pool = [same_situation_row, *distractor_rows]

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

        assert len(payload.options) == 4

        anchor_options = [opt for opt in payload.options if opt.image_url == anchor_url]
        assert len(anchor_options) == 1, (
            "Anchor image must appear exactly once — if the anchor's duplicate "
            "pool row leaked into a distractor slot too, it would appear twice."
        )
        assert payload.correct_index == anchor_options[0].option_index

        non_correct_urls = {
            opt.image_url for opt in payload.options if opt.option_index != payload.correct_index
        }
        assert len(non_correct_urls) == 3, "Expected 3 distinct non-correct distractor URLs"
        assert anchor_url not in non_correct_urls, (
            "The anchor's own (duplicate) pool row must never render as a "
            "non-correct distractor option."
        )


# ---------------------------------------------------------------------------
# AC2 — test_insufficient_pool_raises_and_drops_item
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAssembleWithPoolInsufficientDistractors:
    """Pool with < 3 eligible rows (after anchor exclusion) raises InsufficientDistractorPoolError."""

    @pytest.mark.asyncio
    async def test_insufficient_pool_raises_and_drops_item(self) -> None:
        """AC2 — eligible pool (pool minus the anchor's own row) below 3 raises
        InsufficientDistractorPoolError, preserving today's <3 semantics exactly.

        RED reason (not-implemented): same as
        `test_distractor_pool_excludes_anchor_situation` — the `pool=` kwarg
        does not exist on today's `assemble_picture_match_payload`
        (picture_match_service.py:51-55). `pytest.raises(InsufficientDistractorPoolError)`
        below does not match the actual raised exception (`TypeError` for the
        unexpected kwarg), so pytest re-raises the TypeError uncaught — a
        not-implemented RED, not a behavioral assertion mismatch.

        GREEN after: pool = anchor's own row + 1 other distinct row -> eligible
        (pool minus anchor) = 1 row < 3 -> InsufficientDistractorPoolError,
        preserving today's `_fetch_candidates` <3 check
        (picture_match_service.py:153-164) exactly, just sourced from the
        pre-fetched `pool` instead of a fresh per-item query.
        """
        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id)
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        same_situation_row = (anchor_pic, anchor_desc)
        one_other_row = (_make_picture(), _make_description())
        pool = [same_situation_row, one_other_row]  # eligible after exclusion = 1 < 3

        db = AsyncMock()
        with pytest.raises(InsufficientDistractorPoolError):
            await assemble_picture_match_payload(
                db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=pool
            )


# ---------------------------------------------------------------------------
# AC2 — test_correct_index_randomised_across_positions
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestAssembleWithPoolCorrectIndexRandomisation:
    """Correct-slot randomisation (0-3) is preserved when sourcing distractors from `pool`."""

    @pytest.mark.asyncio
    async def test_correct_index_randomised_across_positions(self) -> None:
        """AC2 — over N iterations with a fixed sufficient pool, correct_index
        covers all 4 positions (0-3): slotting randomness survives the move
        from a DB query to `random.sample` over a pre-fetched pool.

        RED reason (not-implemented): `pool=` kwarg absent today
        (picture_match_service.py:51-55); the first call inside the loop
        raises an uncaught `TypeError` before any position is recorded — a
        not-implemented RED.

        GREEN after: the pool-based `_fetch_candidates` replacement keeps
        `random.randint(0, 3)` slotting (picture_match_service.py:167)
        unchanged; only the *source* of the 3 distractor rows moves from a DB
        query to `random.sample(eligible_pool, 3)`. Statistical coverage
        assertion: with N=200 draws from a uniform distribution over
        {0,1,2,3}, P(any position missed) = 4 * (3/4)^200 < 1e-24 — a missed
        position means slotting is broken.
        """
        N = 200

        anchor_sit = MagicMock()
        anchor_sit.id = uuid4()
        anchor_pic = _make_picture(situation_id=anchor_sit.id, image_s3_key="situations/anchor.jpg")
        anchor_desc = _make_description(situation_id=anchor_sit.id, text_el="Anchor text")
        exercise = _make_anchor_exercise(anchor_pic, anchor_sit, anchor_desc)

        # Exactly 3 eligible rows -- sufficient, no anchor duplicate needed.
        pool = _make_three_distractor_rows()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://cdn.example.com/img.jpg"

        db = AsyncMock()
        position_counts: Counter[int] = Counter()

        with patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3):
            for _ in range(N):
                payload = await assemble_picture_match_payload(
                    db, exercise, ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION, pool=pool
                )
                position_counts[payload.correct_index] += 1

        assert set(position_counts.keys()) == {
            0,
            1,
            2,
            3,
        }, f"Not all positions covered: {dict(position_counts)}"


# ---------------------------------------------------------------------------
# AC4 — test_todo_perf_comments_removed
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_todo_perf_comments_removed() -> None:
    """AC4 — both `TODO(perf)` markers must be removed once the pool is batched.

    RED reason: TRUE RED, clean assertion failure (not a not-implemented
    class) — today's source still carries both `TODO(perf)` comments verbatim
    at picture_match_service.py:67 (on `assemble_picture_match_payload`'s
    docstring) and picture_match_service.py:132 (directly above the
    `ORDER BY random()` query in `_fetch_candidates`).

    GREEN after: PERF-18-03 removes both `TODO(perf)` comments as it replaces
    `_fetch_candidates`'s per-item `ORDER BY random()` query with pool-based
    `random.sample` selection — the O(N) full-scan concern the TODOs flagged
    no longer applies once the pool is fetched once per exercise-type.
    """
    source = inspect.getsource(picture_match_service)
    assert "TODO(perf)" not in source, (
        "picture_match_service.py still contains a 'TODO(perf)' comment — both "
        "occurrences (originally at :67 and :132) must be removed once the "
        "distractor pool is batched."
    )
