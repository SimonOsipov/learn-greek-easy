"""CQMIG-02: Migrate culture questions to exercises tables.

Revision ID: cqmig_02
Revises: esm2_merge_heads
Create Date: 2026-03-30 14:00:00.000000
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op
from src.services.exercise_migration_helpers import build_select_correct_answer_payload

revision = "cqmig_02"
down_revision = "esm2_merge_heads"
branch_labels = None
depends_on = None

logger = logging.getLogger(__name__)


def upgrade() -> None:
    conn = op.get_bind()

    # Pre-check 1: exercises table exists (ESM2-01 ran)
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_name = 'exercises')"
        )
    )
    if not result.scalar():
        raise RuntimeError("exercises table does not exist — ESM2-01 migration has not run")

    # Pre-check 2: no existing select_correct_answer rows (no double-run)
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM description_exercises "
            "WHERE exercise_type = 'select_correct_answer'"
        )
    )
    if result.scalar() > 0:
        raise RuntimeError(
            "select_correct_answer rows already exist in description_exercises — "
            "CQMIG-02 has already run, aborting to prevent double migration"
        )

    # Fetch eligible culture questions
    rows = conn.execute(
        sa.text(
            "SELECT cq.id, cq.question_text, cq.option_a, cq.option_b, "
            "       cq.option_c, cq.option_d, cq.correct_option, "
            "       sd.id AS description_id "
            "FROM culture_questions cq "
            "JOIN news_items ni ON ni.id = cq.news_item_id "
            "JOIN situation_descriptions sd ON sd.situation_id = ni.situation_id "
            "WHERE cq.news_item_id IS NOT NULL AND ni.situation_id IS NOT NULL "
            "ORDER BY cq.id"
        )
    ).fetchall()

    # Pre-check 3: eligible questions found
    if not rows:
        raise RuntimeError("No eligible culture questions found — aborting CQMIG-02")

    # Group questions by description_id
    questions_by_desc: dict[str, list] = defaultdict(list)
    for row in rows:
        questions_by_desc[str(row.description_id)].append(row)

    total_questions_migrated = 0
    total_questions_skipped = 0
    now = datetime.now(timezone.utc)

    for description_id, questions in questions_by_desc.items():
        # Build payloads for all questions in this group (skip failures)
        payloads: list[dict] = []
        for row in questions:
            try:
                payload = build_select_correct_answer_payload(
                    question_text=row.question_text,
                    option_a=row.option_a,
                    option_b=row.option_b,
                    option_c=row.option_c,
                    option_d=row.option_d,
                    correct_option=row.correct_option,
                )
                payloads.append(payload)
            except Exception as exc:
                logger.warning("Skipping culture question id=%s: %s", row.id, exc)
                total_questions_skipped += 1

        if not payloads:
            logger.warning(
                "All questions for description_id=%s failed, skipping description",
                description_id,
            )
            continue

        # Create one container per level (B1 and A2)
        for level in ("B1", "A2"):
            container_id = str(uuid.uuid4())

            # Insert description_exercises container
            conn.execute(
                sa.text(
                    "INSERT INTO description_exercises "
                    "(id, description_id, exercise_type, audio_level, status, "
                    " created_at, updated_at) "
                    "VALUES (:id, :description_id, 'select_correct_answer', "
                    "        :audio_level, 'approved', :created_at, :updated_at)"
                ),
                {
                    "id": container_id,
                    "description_id": description_id,
                    "audio_level": level,
                    "created_at": now,
                    "updated_at": now,
                },
            )

            # Insert description_exercise_items
            for item_index, payload in enumerate(payloads):
                conn.execute(
                    sa.text(
                        "INSERT INTO description_exercise_items "
                        "(id, description_exercise_id, item_index, payload, created_at) "
                        "VALUES (:id, :description_exercise_id, :item_index, "
                        "        :payload::jsonb, :created_at)"
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "description_exercise_id": container_id,
                        "item_index": item_index,
                        "payload": json.dumps(payload),
                        "created_at": now,
                    },
                )

            # Insert exercises supertable row
            conn.execute(
                sa.text(
                    "INSERT INTO exercises "
                    "(id, source_type, description_exercise_id, created_at, updated_at) "
                    "VALUES (:id, 'description', :description_exercise_id, "
                    "        :created_at, :updated_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "description_exercise_id": container_id,
                    "created_at": now,
                    "updated_at": now,
                },
            )

            total_questions_migrated += len(payloads)

    # Post-migration checks
    unique_desc_count = len(questions_by_desc)
    total_questions_count = len(rows) - total_questions_skipped

    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM description_exercises "
            "WHERE exercise_type = 'select_correct_answer'"
        )
    )
    actual_containers = result.scalar()
    expected_containers = unique_desc_count * 2
    if actual_containers != expected_containers:
        raise RuntimeError(
            f"Post-check failed: expected {expected_containers} containers "
            f"(unique_descs={unique_desc_count} x 2), got {actual_containers}"
        )

    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM description_exercise_items dei "
            "JOIN description_exercises de ON de.id = dei.description_exercise_id "
            "WHERE de.exercise_type = 'select_correct_answer'"
        )
    )
    actual_items = result.scalar()
    expected_items = total_questions_migrated
    if actual_items != expected_items:
        raise RuntimeError(
            f"Post-check failed: expected {expected_items} items, got {actual_items}"
        )

    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM exercises e "
            "JOIN description_exercises de ON de.id = e.description_exercise_id "
            "WHERE de.exercise_type = 'select_correct_answer'"
        )
    )
    actual_exercises = result.scalar()
    expected_exercises = unique_desc_count * 2
    if actual_exercises != expected_exercises:
        raise RuntimeError(
            f"Post-check failed: expected {expected_exercises} exercises, "
            f"got {actual_exercises}"
        )

    result = conn.execute(
        sa.text(
            "SELECT "
            "  SUM(CASE WHEN audio_level = 'B1' THEN 1 ELSE 0 END) AS b1_count, "
            "  SUM(CASE WHEN audio_level = 'A2' THEN 1 ELSE 0 END) AS a2_count "
            "FROM description_exercises "
            "WHERE exercise_type = 'select_correct_answer'"
        )
    )
    row = result.fetchone()
    if row.b1_count != row.a2_count:
        raise RuntimeError(
            f"Post-check failed: B1/A2 parity mismatch " f"(B1={row.b1_count}, A2={row.a2_count})"
        )

    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM description_exercises "
            "WHERE exercise_type = 'select_correct_answer' AND status != 'approved'"
        )
    )
    if result.scalar() > 0:
        raise RuntimeError("Post-check failed: some containers do not have status='approved'")

    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM description_exercise_items dei "
            "JOIN description_exercises de ON de.id = dei.description_exercise_id "
            "WHERE de.exercise_type = 'select_correct_answer' "
            "AND (dei.payload IS NULL OR dei.payload->>'prompt' IS NULL)"
        )
    )
    if result.scalar() > 0:
        raise RuntimeError("Post-check failed: some items have null payload or null prompt")

    logger.info(
        "CQMIG-02 complete: migrated %d questions across %d descriptions "
        "(%d skipped), created %d containers, %d items, %d exercises",
        total_questions_count,
        unique_desc_count,
        total_questions_skipped,
        actual_containers,
        actual_items,
        actual_exercises,
    )


def downgrade() -> None:
    conn = op.get_bind()

    # Delete in reverse FK order, scoped to select_correct_answer
    conn.execute(
        sa.text(
            "DELETE FROM exercises "
            "WHERE source_type = 'description' "
            "AND description_exercise_id IN ("
            "  SELECT id FROM description_exercises "
            "  WHERE exercise_type = 'select_correct_answer'"
            ")"
        )
    )

    conn.execute(
        sa.text(
            "DELETE FROM description_exercise_items "
            "WHERE description_exercise_id IN ("
            "  SELECT id FROM description_exercises "
            "  WHERE exercise_type = 'select_correct_answer'"
            ")"
        )
    )

    conn.execute(
        sa.text(
            "DELETE FROM description_exercises " "WHERE exercise_type = 'select_correct_answer'"
        )
    )
