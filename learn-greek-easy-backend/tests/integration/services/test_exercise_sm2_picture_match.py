"""Integration tests for PERF-18-03: picture-match batch distractor pool.

RED status (pre-implementation, current code):

  TRUE RED (mechanism does not exist today, fails on the target assertion):
    - test_picture_match_no_order_by_random_per_item (AC1)
        Today's `_fetch_candidates` (picture_match_service.py:117-177) issues a
        fresh `SELECT ... ORDER BY random() LIMIT 3` per queue item inside the
        per-item loop in `load_picture_match_enrichment`
        (exercise_sm2_service.py:355-385). With 5 picture-match queue items
        sharing one eligible pool (single exercise_type), today's code emits 5
        such queries — one per item — instead of 1 shared pool query for the
        single distinct exercise_type present. GREEN after: PERF-18-03 adds
        `load_distractor_pool` (one query per distinct exercise_type, hoisted
        before the per-item loop in `load_picture_match_enrichment`) and passes
        the pre-fetched pool into `assemble_picture_match_payload` via a `pool=`
        kwarg, eliminating both the per-item DB round-trip and `ORDER BY
        random()` entirely.

All assertions are SQL-shape-based (table/keyword substring matching), not
implementation-specific — they match both today's per-item `_fetch_candidates`
query and PERF-18-03's future pool query, since both join the same 3 tables
(`situation_pictures`, `situation_descriptions`, `picture_exercises`); only the
`ORDER BY random() LIMIT 3` and the per-item anchor-exclusion predicate differ.

Uses `ExerciseSM2Service.load_picture_match_enrichment` directly (not the full
`get_study_queue` wrapper) to isolate the picture-match enrichment SQL from
unrelated queue-assembly queries (due/new/early-practice exercise loads),
mirroring the direct-loader-call pattern established in
`test_progress_deck_list_batching.py`.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from src.db.models import (
    Exercise,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    PictureExercise,
    PictureExerciseItem,
    SituationPicture,
)
from src.schemas.exercise_queue import ExerciseQueueItem
from src.services.exercise_sm2_service import ExerciseSM2Service
from tests.factories import SituationDescriptionFactory, SituationFactory, SituationPictureFactory

# ---------------------------------------------------------------------------
# SQL statement counter (verbatim copy of the helper in
# tests/integration/services/test_progress_deck_list_batching.py:92-123, itself
# a copy of test_progress_dashboard_batching.py:147-178 — not importable,
# duplicated across the suite by convention).
# ---------------------------------------------------------------------------


@contextmanager
def capture_sql(engine: AsyncEngine) -> Generator[list[str], None, None]:
    """Capture real SQL statements emitted on *engine* during the block."""
    stmts: list[str] = []

    def _hook(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        stmts.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _hook)
    try:
        yield stmts
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _hook)


def _is_candidate_pool_query(stmt: str) -> bool:
    """True if *stmt* has the join shape of `_fetch_candidates`/`load_distractor_pool`.

    Both today's per-item query (picture_match_service.py:134-148) and
    PERF-18-03's future pool query join `situation_pictures`,
    `situation_descriptions` (via `situations`), and `picture_exercises` in a
    single statement — no other query in the codebase joins exactly this
    triple. Matching on table-name presence (not FROM-clause position or exact
    join order) keeps this assertion valid regardless of which table
    SQLAlchemy picks as the join anchor.
    """
    s = stmt.lower()
    return "situation_pictures" in s and "situation_descriptions" in s and "picture_exercises" in s


def _is_order_by_random(stmt: str) -> bool:
    return "order by random(" in stmt.lower()


# ---------------------------------------------------------------------------
# Seeding helpers (mirrors tests/integration/api/test_study_v2_picture_match.py:46-102)
# ---------------------------------------------------------------------------


async def _create_ready_situation(db_session: AsyncSession) -> tuple:
    """Create a Situation with GENERATED picture and AUDIO_READY description."""
    situation = await SituationFactory.create(session=db_session, ready=True)
    picture = await SituationPictureFactory.create(
        session=db_session,
        situation_id=situation.id,
        generated=True,
    )
    description = await SituationDescriptionFactory.create(
        session=db_session,
        situation_id=situation.id,
        audio_ready=True,
    )
    return situation, picture, description


async def _create_picture_exercise(
    db_session: AsyncSession,
    picture: SituationPicture,
    description: Any,
    exercise_type: ExerciseType = ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
    status: ExerciseStatus = ExerciseStatus.APPROVED,
) -> tuple[PictureExercise, Exercise]:
    """Create a PictureExercise + PictureExerciseItem + supertable Exercise row."""
    pic_ex = PictureExercise(picture_id=picture.id, exercise_type=exercise_type, status=status)
    db_session.add(pic_ex)
    await db_session.flush()

    item = PictureExerciseItem(
        picture_exercise_id=pic_ex.id,
        item_index=0,
        payload={
            "type": "matching",
            "anchor_picture_id": str(picture.id),
            "anchor_description_id": str(description.id),
        },
    )
    db_session.add(item)

    exercise = Exercise(source_type=ExerciseSourceType.PICTURE, picture_exercise_id=pic_ex.id)
    db_session.add(exercise)
    await db_session.flush()

    return pic_ex, exercise


async def _create_n_ready_picture_exercises(
    db_session: AsyncSession,
    n: int,
    exercise_type: ExerciseType = ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
) -> list[tuple[PictureExercise, Exercise]]:
    """Create `n` independent ready situations, each with an APPROVED PictureExercise
    of `exercise_type` — together they form one shared eligible distractor pool
    (each item's eligible pool = the other n-1 situations)."""
    pairs = []
    for _ in range(n):
        _sit, pic, desc = await _create_ready_situation(db_session)
        pair = await _create_picture_exercise(db_session, pic, desc, exercise_type=exercise_type)
        pairs.append(pair)
    return pairs


def _mock_s3_presign(url: str = "https://cdn.example.com/test.jpg"):
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = url
    return patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3)


# ---------------------------------------------------------------------------
# AC1 — test_picture_match_no_order_by_random_per_item
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_picture_match_no_order_by_random_per_item(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC1 — zero `ORDER BY random()` statements; at most 1 pool query per
    distinct exercise-type per queue build (not per item).

    5 picture-match queue items share one exercise_type
    (SELECT_PICTURE_FROM_DESCRIPTION) and therefore one eligible distractor
    pool (each item's eligible pool = the other 4 approved situations of the
    same type). Today's per-item `_fetch_candidates` loop
    (exercise_sm2_service.py:355-385 -> picture_match_service.py:117-177)
    issues one `ORDER BY random() LIMIT 3` statement PER item — 5 total. After
    PERF-18-03, the pool for the single distinct exercise_type is fetched once
    (hoisted before the per-item loop) and reused via `random.sample` in
    Python, so exactly 1 pool-shaped query should be captured, and zero
    `ORDER BY random()` statements should appear at all.
    """
    pairs = await _create_n_ready_picture_exercises(db_session, n=5)
    await db_session.commit()

    queue_items = [
        ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=ExerciseSourceType.PICTURE,
            exercise_type=ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
            is_new=True,
        )
        for _pic_ex, exercise in pairs
    ]

    service = ExerciseSM2Service(db_session)

    with _mock_s3_presign():
        with capture_sql(db_engine) as stmts:
            to_drop = await service.load_picture_match_enrichment(queue_items)

    assert to_drop == set(), (
        f"Expected no items dropped (each of the 5 items has 4 eligible other "
        f"situations as its distractor pool), got {to_drop}"
    )

    order_by_random_stmts = [s for s in stmts if _is_order_by_random(s)]
    assert order_by_random_stmts == [], (
        f"Found {len(order_by_random_stmts)} 'ORDER BY random()' statement(s) — "
        f"the per-item distractor scan is still present:\n" + "\n---\n".join(order_by_random_stmts)
    )

    pool_stmts = [s for s in stmts if _is_candidate_pool_query(s)]
    assert len(pool_stmts) == 1, (
        f"Expected exactly 1 candidate-pool query for the 1 distinct "
        f"exercise_type present (SELECT_PICTURE_FROM_DESCRIPTION) across 5 "
        f"queue items, got {len(pool_stmts)} (fan-out is still per-item, not "
        f"per-exercise-type):\n" + "\n---\n".join(pool_stmts)
    )


# ---------------------------------------------------------------------------
# AC1/AC2 (QA edge) — pool keyed per exercise_type; no cross-type fan-out
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_pool_keyed_per_exercise_type_no_cross_type_fanout(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC1/AC2 (QA edge) — a queue mixing TWO exercise-types builds exactly one
    pool per type (2 total), never one shared pool and never per-item fan-out.

    Seeds 4 approved SELECT_PICTURE_FROM_DESCRIPTION situations and 4 approved
    SELECT_DESCRIPTION_FROM_PICTURE situations (disjoint situations per type).
    Each item's eligible pool = the other 3 same-type situations (>= 3), so
    nothing is dropped. Guards `pool_by_type` keying:
      - exactly 2 pool-shaped queries (1 per distinct type) — a single shared
        pool ignoring exercise_type would emit 1; per-item fan-out would emit 8;
      - zero `ORDER BY random()` statements;
      - no items dropped (each type has a self-sufficient pool).
    """
    type_a = ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION
    type_b = ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE

    pairs_a = await _create_n_ready_picture_exercises(db_session, n=4, exercise_type=type_a)
    pairs_b = await _create_n_ready_picture_exercises(db_session, n=4, exercise_type=type_b)
    await db_session.commit()

    queue_items = [
        ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=ExerciseSourceType.PICTURE,
            exercise_type=et,
            is_new=True,
        )
        for et, pairs in ((type_a, pairs_a), (type_b, pairs_b))
        for _pic_ex, exercise in pairs
    ]

    service = ExerciseSM2Service(db_session)

    with _mock_s3_presign():
        with capture_sql(db_engine) as stmts:
            to_drop = await service.load_picture_match_enrichment(queue_items)

    assert to_drop == set(), (
        f"Expected no items dropped (each type has 3 other same-type eligible "
        f"situations), got {to_drop}"
    )

    order_by_random_stmts = [s for s in stmts if _is_order_by_random(s)]
    assert (
        order_by_random_stmts == []
    ), f"Found {len(order_by_random_stmts)} 'ORDER BY random()' statement(s):\n" + "\n---\n".join(
        order_by_random_stmts
    )

    pool_stmts = [s for s in stmts if _is_candidate_pool_query(s)]
    assert len(pool_stmts) == 2, (
        f"Expected exactly 2 candidate-pool queries (one per distinct "
        f"exercise_type) across a mixed 8-item queue, got {len(pool_stmts)} — "
        f"a single shared pool (ignoring exercise_type) emits 1; per-item "
        f"fan-out emits 8:\n" + "\n---\n".join(pool_stmts)
    )


# ---------------------------------------------------------------------------
# AC2 (QA edge) — insufficient per-type pool drops its items cleanly
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
async def test_insufficient_pool_type_drops_items_cleanly(
    db_session: AsyncSession,
    db_engine: AsyncEngine,
) -> None:
    """AC2 (QA edge) — items whose exercise_type has an insufficient eligible
    pool (< 3 after anchor exclusion) are dropped cleanly at the enrichment
    layer, while the pool is still queried exactly once for that type.

    Seeds only 2 approved SELECT_PICTURE_FROM_DESCRIPTION situations: each item's
    eligible pool = the single other situation = 1 < 3, so BOTH items must land
    in the drop set (InsufficientDistractorPoolError → to_drop, per
    exercise_sm2_service.py:387-393). The pool query still runs once (the drop
    happens in-Python over the fetched pool, not via a per-item query), and no
    `ORDER BY random()` statement appears.
    """
    pairs = await _create_n_ready_picture_exercises(db_session, n=2)
    await db_session.commit()

    queue_items = [
        ExerciseQueueItem(
            exercise_id=exercise.id,
            source_type=ExerciseSourceType.PICTURE,
            exercise_type=ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
            is_new=True,
        )
        for _pic_ex, exercise in pairs
    ]
    expected_dropped = {exercise.id for _pic_ex, exercise in pairs}

    service = ExerciseSM2Service(db_session)

    with _mock_s3_presign():
        with capture_sql(db_engine) as stmts:
            to_drop = await service.load_picture_match_enrichment(queue_items)

    assert to_drop == expected_dropped, (
        f"Expected both items dropped for insufficient pool (1 eligible < 3), "
        f"got {to_drop} vs expected {expected_dropped}"
    )

    order_by_random_stmts = [s for s in stmts if _is_order_by_random(s)]
    assert (
        order_by_random_stmts == []
    ), f"Found {len(order_by_random_stmts)} 'ORDER BY random()' statement(s):\n" + "\n---\n".join(
        order_by_random_stmts
    )

    pool_stmts = [s for s in stmts if _is_candidate_pool_query(s)]
    assert len(pool_stmts) == 1, (
        f"Expected exactly 1 candidate-pool query for the single distinct "
        f"exercise_type even when all items drop, got {len(pool_stmts)}:\n"
        + "\n---\n".join(pool_stmts)
    )
