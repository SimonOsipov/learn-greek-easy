"""add situations table and situation_id to listening_dialogs

Revision ID: c1d2e3f4a5b6
Revises: b8c9d0e1f2a3
Create Date: 2026-03-16 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: str | None = "b8c9d0e1f2a3"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Create situations table and add situation_id FK to listening_dialogs."""

    # 1. Create situationstatus enum type
    situationstatus_enum = postgresql.ENUM(
        "draft",
        "partial_ready",
        "ready",
        name="situationstatus",
        create_type=True,
    )
    situationstatus_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create situations table
    op.create_table(
        "situations",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("uuid_generate_v4()"),
            nullable=False,
        ),
        sa.Column("scenario_el", sa.Text(), nullable=False),
        sa.Column("scenario_en", sa.Text(), nullable=False),
        sa.Column("scenario_ru", sa.Text(), nullable=False),
        sa.Column(
            "cefr_level",
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
                "partial_ready",
                "ready",
                name="situationstatus",
                create_type=False,
            ),
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
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_situations_created_by"), "situations", ["created_by"], unique=False)

    # 3. Add nullable situation_id to listening_dialogs
    op.add_column(
        "listening_dialogs",
        sa.Column("situation_id", sa.Uuid(), nullable=True),
    )

    # 4. Data migration: create one situation per dialog using PL/pgSQL loop
    #    Safe for duplicate scenarios — guaranteed 1:1 mapping
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE
                dialog_row RECORD;
                new_situation_id UUID;
            BEGIN
                FOR dialog_row IN
                    SELECT id, scenario_el, scenario_en, scenario_ru, cefr_level, created_by
                    FROM listening_dialogs
                LOOP
                    INSERT INTO situations (id, scenario_el, scenario_en, scenario_ru, cefr_level, created_by)
                    VALUES (
                        uuid_generate_v4(),
                        dialog_row.scenario_el,
                        dialog_row.scenario_en,
                        dialog_row.scenario_ru,
                        dialog_row.cefr_level,
                        dialog_row.created_by
                    )
                    RETURNING id INTO new_situation_id;

                    UPDATE listening_dialogs
                    SET situation_id = new_situation_id
                    WHERE id = dialog_row.id;
                END LOOP;
            END $$;
            """
        )
    )

    # 5. Alter situation_id to NOT NULL
    op.alter_column("listening_dialogs", "situation_id", nullable=False)

    # 6. Add FK constraint and index
    op.create_foreign_key(
        "fk_listening_dialogs_situation_id",
        "listening_dialogs",
        "situations",
        ["situation_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_listening_dialogs_situation_id"),
        "listening_dialogs",
        ["situation_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove situation_id from listening_dialogs and drop situations table."""
    op.drop_index(
        op.f("ix_listening_dialogs_situation_id"),
        table_name="listening_dialogs",
    )
    op.drop_constraint(
        "fk_listening_dialogs_situation_id",
        "listening_dialogs",
        type_="foreignkey",
    )
    op.drop_column("listening_dialogs", "situation_id")

    op.drop_index(op.f("ix_situations_created_by"), table_name="situations")
    op.drop_table("situations")

    postgresql.ENUM(name="situationstatus").drop(op.get_bind(), checkfirst=True)
