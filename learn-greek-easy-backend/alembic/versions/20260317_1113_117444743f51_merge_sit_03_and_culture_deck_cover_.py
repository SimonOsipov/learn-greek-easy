"""merge sit_03 and culture_deck_cover_image

Revision ID: 117444743f51
Revises: f1a2b3c4d5e6, cdkimg_add_culture_cover
Create Date: 2026-03-17 11:13:29.927882+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "117444743f51"
down_revision: Union[str, Sequence[str], None] = ("f1a2b3c4d5e6", "cdkimg_add_culture_cover")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
