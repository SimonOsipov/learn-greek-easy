"""sit_02_add_description_tables

Revision ID: ea11c3b477d2
Revises: 2a21cd907b19
Create Date: 2026-03-17 05:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "ea11c3b477d2"
down_revision: str | None = "2a21cd907b19"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Add situation_descriptions, description_exercises, description_exercise_items tables."""
    # Step 1: Create new enum types
    descriptionsourcetype_enum = postgresql.ENUM(
        "original",
        "news",
        name="descriptionsourcetype",
        create_type=True,
    )
    descriptionsourcetype_enum.create(op.get_bind(), checkfirst=True)

    descriptionstatus_enum = postgresql.ENUM(
        "draft",
        "audio_ready",
        name="descriptionstatus",
        create_type=True,
    )
    descriptionstatus_enum.create(op.get_bind(), checkfirst=True)

    # Step 2: situation_descriptions table
    op.create_table(
        "situation_descriptions",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("situation_id", sa.Uuid(), nullable=False),
        sa.Column("text_el", sa.Text(), nullable=False),
        sa.Column(
            "source_type",
            postgresql.ENUM("original", "news", name="descriptionsourcetype", create_type=False),
            server_default=sa.text("'original'"),
            nullable=False,
        ),
        sa.Column("full_article_text", sa.Text(), nullable=True),
        sa.Column("audio_s3_key", sa.Text(), nullable=True),
        sa.Column("audio_a2_s3_key", sa.Text(), nullable=True),
        sa.Column("audio_duration_seconds", sa.Float(), nullable=True),
        sa.Column("audio_a2_duration_seconds", sa.Float(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column(
            "country",
            postgresql.ENUM(
                "cyprus",
                "greece",
                "world",
                name="newscountry",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("news_date", sa.Date(), nullable=True),
        sa.Column("original_language", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "audio_ready", name="descriptionstatus", create_type=False),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["situation_id"],
            ["situations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("situation_id", name="uq_situation_descriptions_situation_id"),
    )
    op.create_index(
        op.f("ix_situation_descriptions_situation_id"),
        "situation_descriptions",
        ["situation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_situation_descriptions_created_by"),
        "situation_descriptions",
        ["created_by"],
        unique=False,
    )

    # Step 3: description_exercises table
    op.create_table(
        "description_exercises",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("description_id", sa.Uuid(), nullable=False),
        sa.Column(
            "exercise_type",
            postgresql.ENUM(
                "fill_gaps",
                "select_heard",
                "true_false",
                name="exercisetype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "audio_level",
            postgresql.ENUM(
                "A1",
                "A2",
                "B1",
                "B2",
                "C1",
                "C2",
                name="decklevel",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft",
                "approved",
                name="exercisestatus",
                create_type=False,
            ),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["description_id"],
            ["situation_descriptions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "description_id",
            "exercise_type",
            "audio_level",
            name="uq_description_exercise_type_level",
        ),
    )
    op.create_index(
        op.f("ix_description_exercises_description_id"),
        "description_exercises",
        ["description_id"],
        unique=False,
    )

    # Step 4: description_exercise_items table — NO updated_at
    op.create_table(
        "description_exercise_items",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("description_exercise_id", sa.Uuid(), nullable=False),
        sa.Column("item_index", sa.SmallInteger(), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["description_exercise_id"],
            ["description_exercises.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "description_exercise_id",
            "item_index",
            name="uq_description_exercise_item_index",
        ),
        sa.CheckConstraint(
            "item_index >= 0",
            name="ck_description_exercise_items_item_index",
        ),
    )
    op.create_index(
        op.f("ix_description_exercise_items_description_exercise_id"),
        "description_exercise_items",
        ["description_exercise_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop situation_descriptions, description_exercises, description_exercise_items tables."""
    # Drop in reverse dependency order
    op.drop_index(
        op.f("ix_description_exercise_items_description_exercise_id"),
        table_name="description_exercise_items",
    )
    op.drop_table("description_exercise_items")

    op.drop_index(
        op.f("ix_description_exercises_description_id"),
        table_name="description_exercises",
    )
    op.drop_table("description_exercises")

    op.drop_index(
        op.f("ix_situation_descriptions_created_by"),
        table_name="situation_descriptions",
    )
    op.drop_index(
        op.f("ix_situation_descriptions_situation_id"),
        table_name="situation_descriptions",
    )
    op.drop_table("situation_descriptions")

    # Drop ONLY the new enums (do NOT drop reused enums: newscountry, exercisetype, exercisestatus, decklevel)
    postgresql.ENUM(name="descriptionstatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="descriptionsourcetype").drop(op.get_bind(), checkfirst=True)
