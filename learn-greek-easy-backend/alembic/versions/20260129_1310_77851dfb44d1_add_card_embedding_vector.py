"""add_card_embedding_vector

Revision ID: 77851dfb44d1
Revises: 014f35839083
Create Date: 2026-01-29 13:10:41.135378+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "77851dfb44d1"
down_revision: Union[str, Sequence[str], None] = "014f35839083"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add embedding vector field to cards table."""
    # Ensure pgvector extension exists (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add embedding column
    op.add_column(
        "cards",
        sa.Column(
            "embedding",
            Vector(1024),
            nullable=True,
            comment="VoyageAI embedding for semantic similarity search",
        ),
    )


def downgrade() -> None:
    """Remove embedding vector field from cards table."""
    op.drop_column("cards", "embedding")
