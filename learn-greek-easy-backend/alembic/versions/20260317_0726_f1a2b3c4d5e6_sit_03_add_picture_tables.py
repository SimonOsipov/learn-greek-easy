"""sit_03_add_picture_tables

Revision ID: f1a2b3c4d5e6
Revises: ea11c3b477d2
Create Date: 2026-03-17 07:26:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "ea11c3b477d2"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Add situation_pictures, picture_exercises, picture_exercise_items tables."""
    # Step 1: Create new enum type
    picturestatus_enum = postgresql.ENUM(
        "draft",
        "generated",
        name="picturestatus",
        create_type=True,
    )
    picturestatus_enum.create(op.get_bind(), checkfirst=True)

    # Step 2: situation_pictures table
    op.create_table(
        "situation_pictures",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("situation_id", sa.Uuid(), nullable=False),
        sa.Column("image_prompt", sa.Text(), nullable=False),
        sa.Column("image_s3_key", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "generated", name="picturestatus", create_type=False),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
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
        sa.UniqueConstraint("situation_id", name="uq_situation_pictures_situation_id"),
    )
    op.create_index(
        op.f("ix_situation_pictures_created_by"),
        "situation_pictures",
        ["created_by"],
        unique=False,
    )

    # Step 3: picture_exercises table
    op.create_table(
        "picture_exercises",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("picture_id", sa.Uuid(), nullable=False),
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
            comment="Timestamp when record was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when record was last updated",
        ),
        sa.ForeignKeyConstraint(
            ["picture_id"],
            ["situation_pictures.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "picture_id",
            "exercise_type",
            name="uq_pic_exercise_type",
        ),
    )
    op.create_index(
        op.f("ix_picture_exercises_picture_id"),
        "picture_exercises",
        ["picture_id"],
        unique=False,
    )

    # Step 4: picture_exercise_items table — NO updated_at
    op.create_table(
        "picture_exercise_items",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("picture_exercise_id", sa.Uuid(), nullable=False),
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
            ["picture_exercise_id"],
            ["picture_exercises.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "picture_exercise_id",
            "item_index",
            name="uq_pic_exercise_item_index",
        ),
        sa.CheckConstraint(
            "item_index >= 0",
            name="ck_pic_exercise_item_index_non_negative",
        ),
    )
    op.create_index(
        op.f("ix_picture_exercise_items_picture_exercise_id"),
        "picture_exercise_items",
        ["picture_exercise_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop situation_pictures, picture_exercises, picture_exercise_items tables."""
    op.drop_index(
        op.f("ix_picture_exercise_items_picture_exercise_id"),
        table_name="picture_exercise_items",
    )
    op.drop_table("picture_exercise_items")

    op.drop_index(
        op.f("ix_picture_exercises_picture_id"),
        table_name="picture_exercises",
    )
    op.drop_table("picture_exercises")

    op.drop_index(
        op.f("ix_situation_pictures_created_by"),
        table_name="situation_pictures",
    )
    op.drop_table("situation_pictures")

    # Drop ONLY the new enum (do NOT drop reused enums: exercisetype, exercisestatus)
    postgresql.ENUM(name="picturestatus").drop(op.get_bind(), checkfirst=True)
