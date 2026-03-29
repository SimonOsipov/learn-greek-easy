"""Add word_timestamps columns to situation_descriptions

Revision ID: sit_07_02_add_desc_word_timestamps
Revises: drop_c1_c2_from_decklevel
Create Date: 2026-03-29 07:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "sit_07_02_add_desc_word_timestamps"
down_revision: Union[str, None] = "drop_c1_c2_from_decklevel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("situation_descriptions", sa.Column("word_timestamps", JSONB, nullable=True))
    op.add_column("situation_descriptions", sa.Column("word_timestamps_a2", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("situation_descriptions", "word_timestamps_a2")
    op.drop_column("situation_descriptions", "word_timestamps")
