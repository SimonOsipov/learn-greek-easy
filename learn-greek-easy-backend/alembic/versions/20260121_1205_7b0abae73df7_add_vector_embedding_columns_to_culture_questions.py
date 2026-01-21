"""add_vector_embedding_columns_to_culture_questions

Revision ID: 7b0abae73df7
Revises: 037928b86d1e
Create Date: 2026-01-21 12:05:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7b0abae73df7"
down_revision: Union[str, Sequence[str], None] = "037928b86d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Adds vector embedding columns to culture_questions for semantic similarity search:
    - embedding: 1024-dimension vector for Voyage AI voyage-3 embeddings
    - embedding_model: tracks which model generated the embedding
    - embedding_updated_at: timestamp of last embedding update

    Also creates an IVFFlat index for efficient cosine similarity queries.
    """
    # Enable pgvector extension (idempotent)
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector"')

    # Add embedding column (1024 dimensions for Voyage AI voyage-3)
    op.add_column(
        "culture_questions",
        sa.Column(
            "embedding",
            Vector(1024),
            nullable=True,
            comment="Voyage AI voyage-3 embedding (1024 dimensions) for semantic similarity",
        ),
    )

    # Add embedding model column to track which model generated the embedding
    op.add_column(
        "culture_questions",
        sa.Column(
            "embedding_model",
            sa.String(length=50),
            nullable=True,
            comment="Embedding model used (e.g., 'voyage-3')",
        ),
    )

    # Add embedding updated at timestamp
    op.add_column(
        "culture_questions",
        sa.Column(
            "embedding_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when embedding was last generated/updated",
        ),
    )

    # Create IVFFlat index for efficient cosine similarity queries
    # - ivfflat: Approximate nearest neighbor index
    # - vector_cosine_ops: Optimized for cosine similarity
    # - lists = 50: ~sqrt(2000) for expected row count
    # - Partial index on non-null embeddings only
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_culture_questions_embedding
        ON culture_questions
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 50)
        WHERE embedding IS NOT NULL
    """
    )


def downgrade() -> None:
    """Downgrade schema.

    Removes the IVFFlat index and embedding columns in reverse order.
    Note: Does NOT drop the pgvector extension as it may be used elsewhere.
    """
    # Drop index first (must be done before dropping the column)
    op.execute("DROP INDEX IF EXISTS idx_culture_questions_embedding")

    # Drop columns in reverse order of creation
    op.drop_column("culture_questions", "embedding_updated_at")
    op.drop_column("culture_questions", "embedding_model")
    op.drop_column("culture_questions", "embedding")
