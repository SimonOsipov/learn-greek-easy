"""ESQ-01: Add modality enum/column to description_exercises and duplicate as reading.

Revision ID: esq_01
Revises: ndel_01
Create Date: 2026-03-31 15:00:00.000000
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa

from alembic import op

revision = "esq_01"
down_revision = "ndel_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Create the exercisemodality enum type
    sa.Enum("listening", "reading", name="exercisemodality").create(conn, checkfirst=True)

    # Step 2: Add modality column with server_default to backfill existing rows
    op.add_column(
        "description_exercises",
        sa.Column(
            "modality",
            sa.Enum("listening", "reading", name="exercisemodality", create_type=False),
            nullable=False,
            server_default="listening",
        ),
    )

    # Step 3: Drop old unique constraint, create new one that includes modality
    op.drop_constraint("uq_desc_exercise_type_level", "description_exercises", type_="unique")
    op.create_unique_constraint(
        "uq_desc_exercise_type_level_modality",
        "description_exercises",
        ["description_id", "exercise_type", "audio_level", "modality"],
    )

    # Step 4: Remove server_default (column stays NOT NULL)
    op.alter_column("description_exercises", "modality", server_default=None)

    # Step 5: Check row count — skip duplication if empty DB (CI)
    original_count = conn.execute(sa.text("SELECT COUNT(*) FROM description_exercises")).scalar()

    if original_count == 0:
        print("[esq_01] No description_exercises rows — skipping data duplication")
        return

    # Step 6: Duplicate all listening rows as reading
    # Fetch all existing (listening) description_exercises
    rows = conn.execute(
        sa.text(
            "SELECT id, description_id, exercise_type, audio_level, status, created_at "
            "FROM description_exercises WHERE modality = 'listening'"
        )
    ).fetchall()

    now = datetime.now(timezone.utc)

    for row in rows:
        new_de_id = str(uuid.uuid4())

        # 6a: Insert reading copy of description_exercise
        conn.execute(
            sa.text(
                "INSERT INTO description_exercises "
                "(id, description_id, exercise_type, audio_level, status, modality, created_at, updated_at) "
                "VALUES (:id, :description_id, :exercise_type, :audio_level, :status, 'reading', :created_at, :updated_at)"
            ),
            {
                "id": new_de_id,
                "description_id": str(row.description_id),
                "exercise_type": row.exercise_type,
                "audio_level": row.audio_level,
                "status": row.status,
                "created_at": now,
                "updated_at": now,
            },
        )

        # 6b: Copy description_exercise_items for this exercise
        items = conn.execute(
            sa.text(
                "SELECT item_index, payload FROM description_exercise_items "
                "WHERE description_exercise_id = :de_id ORDER BY item_index"
            ),
            {"de_id": str(row.id)},
        ).fetchall()

        for item in items:
            conn.execute(
                sa.text(
                    "INSERT INTO description_exercise_items "
                    "(id, description_exercise_id, item_index, payload, created_at) "
                    "VALUES (:id, :de_id, :item_index, CAST(:payload AS jsonb), :created_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "de_id": new_de_id,
                    "item_index": item.item_index,
                    "payload": json.dumps(item.payload),
                    "created_at": now,
                },
            )

        # 6c: Insert exercises supertable row for the reading exercise
        conn.execute(
            sa.text(
                "INSERT INTO exercises "
                "(id, source_type, description_exercise_id, dialog_exercise_id, picture_exercise_id, created_at, updated_at) "
                "VALUES (:id, 'description', :de_id, NULL, NULL, :created_at, :updated_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "de_id": new_de_id,
                "created_at": now,
                "updated_at": now,
            },
        )

    # Step 7: Post-migration validation (relational, not hardcoded counts)
    total_de = conn.execute(sa.text("SELECT COUNT(*) FROM description_exercises")).scalar()
    listening_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM description_exercises WHERE modality = 'listening'")
    ).scalar()
    reading_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM description_exercises WHERE modality = 'reading'")
    ).scalar()
    total_exercises = conn.execute(
        sa.text("SELECT COUNT(*) FROM exercises WHERE source_type = 'description'")
    ).scalar()

    if total_de != original_count * 2:
        raise RuntimeError(
            f"[esq_01] Expected {original_count * 2} description_exercises, got {total_de}"
        )
    if listening_count != reading_count:
        raise RuntimeError(
            f"[esq_01] Listening count ({listening_count}) != reading count ({reading_count})"
        )
    if total_exercises != original_count * 2:
        raise RuntimeError(
            f"[esq_01] Expected {original_count * 2} exercises (description), got {total_exercises}"
        )

    print(
        f"[esq_01] Migration complete: {original_count} listening + {reading_count} reading = {total_de} total"
    )


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Delete exercises supertable rows for reading description_exercises
    conn.execute(
        sa.text(
            "DELETE FROM exercises WHERE description_exercise_id IN "
            "(SELECT id FROM description_exercises WHERE modality = 'reading')"
        )
    )

    # 2. Delete reading description_exercise_items
    conn.execute(
        sa.text(
            "DELETE FROM description_exercise_items WHERE description_exercise_id IN "
            "(SELECT id FROM description_exercises WHERE modality = 'reading')"
        )
    )

    # 3. Delete reading description_exercises
    conn.execute(sa.text("DELETE FROM description_exercises WHERE modality = 'reading'"))

    # 4. Drop new constraint, restore old
    op.drop_constraint(
        "uq_desc_exercise_type_level_modality", "description_exercises", type_="unique"
    )
    op.create_unique_constraint(
        "uq_desc_exercise_type_level",
        "description_exercises",
        ["description_id", "exercise_type", "audio_level"],
    )

    # 5. Drop the modality column
    op.drop_column("description_exercises", "modality")

    # 6. Drop the enum type
    sa.Enum(name="exercisemodality").drop(conn, checkfirst=True)
