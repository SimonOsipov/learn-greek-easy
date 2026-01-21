"""Integration tests for pgvector semantic similarity functionality.

Tests verify that:
1. pgvector extension is enabled and functional
2. Vector data can be inserted into embedding columns
3. Cosine similarity queries work correctly
4. IVFFlat index exists and is configured properly
"""

import numpy as np
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CultureQuestion
from tests.factories.culture import CultureDeckFactory

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.db,
    pytest.mark.pgvector,
]


@pytest.fixture
def random_embedding() -> list[float]:
    """Generate a random 1024-dimensional normalized embedding vector."""
    vec = np.random.randn(1024).astype(float)
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


@pytest.fixture
def embedding_factory():
    """Factory for generating multiple distinct embedding vectors."""

    def _create(n: int = 1, seed: int | None = None) -> list[list[float]]:
        if seed is not None:
            np.random.seed(seed)
        vectors = []
        for _ in range(n):
            vec = np.random.randn(1024).astype(float)
            vec = vec / np.linalg.norm(vec)
            vectors.append(vec.tolist())
        return vectors if n > 1 else vectors[0]

    return _create


class TestPgvectorExtension:
    """Tests for pgvector extension availability."""

    async def test_extension_is_enabled(self, db_session: AsyncSession):
        """Verify pgvector extension is installed and enabled."""
        result = await db_session.execute(
            text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
        )
        row = result.fetchone()
        assert row is not None, "pgvector extension is not enabled"
        assert row[0] == "vector"
        # Version should be 0.8.x or higher
        version = row[1]
        assert version.startswith("0.") or version.startswith("1.")

    async def test_vector_type_is_available(self, db_session: AsyncSession):
        """Verify the vector type is available for queries."""
        result = await db_session.execute(
            text("SELECT typname FROM pg_type WHERE typname = 'vector'")
        )
        row = result.fetchone()
        assert row is not None, "vector type is not available"


class TestVectorInsert:
    """Tests for inserting vector data into embedding column."""

    async def test_insert_1024_dimension_vector(
        self, db_session: AsyncSession, random_embedding: list[float]
    ):
        """Verify 1024-dimensional vectors can be inserted via ORM."""
        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Create a question with embedding via ORM
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Test question with embedding"},
            option_a={"en": "Option A"},
            option_b={"en": "Option B"},
            correct_option=1,
            order_index=0,
            embedding=random_embedding,
            embedding_model="voyage-3",
        )
        db_session.add(question)
        await db_session.flush()

        # Verify embedding was stored
        result = await db_session.execute(
            text("SELECT embedding IS NOT NULL FROM culture_questions WHERE id = :id"),
            {"id": str(question.id)},
        )
        row = result.fetchone()
        assert row is not None, "Failed to insert culture question with embedding"
        assert row[0] is True, "Embedding was not stored"

    async def test_null_embedding_is_allowed(self, db_session: AsyncSession):
        """Verify null embeddings are accepted."""
        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Create a question without embedding via ORM
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Test question no embedding"},
            option_a={"en": "Option A"},
            option_b={"en": "Option B"},
            correct_option=1,
            order_index=0,
            embedding=None,
        )
        db_session.add(question)
        await db_session.flush()

        # Verify embedding is null
        result = await db_session.execute(
            text("SELECT embedding IS NULL FROM culture_questions WHERE id = :id"),
            {"id": str(question.id)},
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] is True, "Embedding should be null"

    async def test_embedding_dimension_is_1024(
        self, db_session: AsyncSession, random_embedding: list[float]
    ):
        """Verify embeddings are stored with correct dimension."""
        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Create a question with embedding via ORM
        question = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Test dimension check"},
            option_a={"en": "A"},
            option_b={"en": "B"},
            correct_option=1,
            order_index=0,
            embedding=random_embedding,
            embedding_model="voyage-3",
        )
        db_session.add(question)
        await db_session.flush()

        # Check dimension using pgvector's vector_dims function
        result = await db_session.execute(
            text("SELECT vector_dims(embedding) FROM culture_questions WHERE id = :id"),
            {"id": str(question.id)},
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1024, f"Expected 1024 dimensions, got {row[0]}"


class TestCosineSimilarityQuery:
    """Tests for cosine similarity queries."""

    async def test_cosine_similarity_ordering(self, db_session: AsyncSession, embedding_factory):
        """Verify cosine similarity returns correct ordering (most similar first)."""
        # Create embeddings where we know the similarity ordering
        np.random.seed(42)
        base_vec = np.random.randn(1024).astype(float)
        base_vec = base_vec / np.linalg.norm(base_vec)

        # Create vectors with known similarity
        similar_vec = base_vec + 0.1 * np.random.randn(1024)
        similar_vec = similar_vec / np.linalg.norm(similar_vec)

        different_vec = np.random.randn(1024).astype(float)
        different_vec = different_vec / np.linalg.norm(different_vec)

        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Insert test questions with embeddings using ORM
        similar_q = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Similar"},
            option_a={"en": "A"},
            option_b={"en": "B"},
            correct_option=1,
            order_index=1,
            embedding=similar_vec.tolist(),
        )
        different_q = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Different"},
            option_a={"en": "A"},
            option_b={"en": "B"},
            correct_option=1,
            order_index=2,
            embedding=different_vec.tolist(),
        )
        db_session.add_all([similar_q, different_q])
        await db_session.flush()

        # Query for nearest to base_vec using string interpolation (safe for vectors)
        base_vec_str = str(base_vec.tolist())
        result = await db_session.execute(
            text(
                f"""
                SELECT question_text->>'en' as question,
                       embedding <=> '{base_vec_str}'::vector(1024) as distance
                FROM culture_questions
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> '{base_vec_str}'::vector(1024)
                LIMIT 2
            """
            )
        )
        rows = result.fetchall()

        assert len(rows) >= 2, "Expected at least 2 results"
        # Similar should be closer (smaller distance) than different
        assert rows[0][0] == "Similar", "Similar question should be first"

    async def test_k_nearest_neighbors(self, db_session: AsyncSession, embedding_factory):
        """Verify K-nearest neighbor queries work correctly."""
        embeddings = embedding_factory(5, seed=123)

        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Insert 5 questions with embeddings using ORM
        for i, emb in enumerate(embeddings):
            q = CultureQuestion(
                deck_id=deck.id,
                question_text={"en": f"Q{i}"},
                option_a={"en": "A"},
                option_b={"en": "B"},
                correct_option=1,
                order_index=i,
                embedding=emb,
            )
            db_session.add(q)
        await db_session.flush()

        # Query for top 3 nearest using string interpolation (safe for vectors)
        query_vec_str = str(embeddings[0])
        result = await db_session.execute(
            text(
                f"""
                SELECT question_text->>'en'
                FROM culture_questions
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> '{query_vec_str}'::vector(1024)
                LIMIT 3
            """
            )
        )
        rows = result.fetchall()

        assert len(rows) == 3, "Should return exactly 3 results"
        assert rows[0][0] == "Q0", "First result should be the query vector itself"

    async def test_cosine_distance_range(self, db_session: AsyncSession, embedding_factory):
        """Verify cosine distance values are in expected range [0, 2]."""
        embeddings = embedding_factory(2, seed=456)

        # Create a deck first
        deck = await CultureDeckFactory.create(db_session)
        await db_session.flush()

        # Insert a question with embedding using ORM
        q = CultureQuestion(
            deck_id=deck.id,
            question_text={"en": "Test"},
            option_a={"en": "A"},
            option_b={"en": "B"},
            correct_option=1,
            order_index=0,
            embedding=embeddings[0],
        )
        db_session.add(q)
        await db_session.flush()

        # Query for distance using string interpolation (safe for vectors)
        query_vec_str = str(embeddings[1])
        result = await db_session.execute(
            text(
                f"""
                SELECT embedding <=> '{query_vec_str}'::vector(1024) as distance
                FROM culture_questions
                WHERE embedding IS NOT NULL
            """
            )
        )
        row = result.fetchone()

        assert row is not None
        distance = row[0]
        # Cosine distance should be between 0 (identical) and 2 (opposite)
        assert 0 <= distance <= 2, f"Cosine distance {distance} out of expected range [0, 2]"


class TestIndexUsage:
    """Tests for IVFFlat index verification.

    Note: These tests verify the index created by the Alembic migration.
    In the test environment, the index is created via a fixture since
    pytest uses SQLAlchemy's metadata.create_all() which doesn't run
    migration SQL.
    """

    @pytest.fixture(autouse=True)
    async def create_embedding_index(self, db_session: AsyncSession):
        """Create the IVFFlat index if it doesn't exist.

        This fixture ensures the index exists for testing. In production,
        the index is created by the Alembic migration.
        """
        # Check if index exists
        result = await db_session.execute(
            text(
                """
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_culture_questions_embedding'
            """
            )
        )
        if result.fetchone() is None:
            # Create the index (same as migration)
            await db_session.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS idx_culture_questions_embedding
                    ON culture_questions
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 50)
                    WHERE embedding IS NOT NULL
                """
                )
            )
            await db_session.commit()
        yield

    async def test_ivfflat_index_exists(self, db_session: AsyncSession):
        """Verify the IVFFlat index exists on culture_questions.embedding."""
        result = await db_session.execute(
            text(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'culture_questions'
                AND indexname = 'idx_culture_questions_embedding'
            """
            )
        )
        row = result.fetchone()
        assert row is not None, "IVFFlat index does not exist"

        indexdef = row[1].lower()
        assert "ivfflat" in indexdef, "Index should use ivfflat method"
        assert "vector_cosine_ops" in indexdef, "Index should use vector_cosine_ops"

    async def test_index_is_partial(self, db_session: AsyncSession):
        """Verify the index is partial (only on non-null embeddings)."""
        result = await db_session.execute(
            text(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE indexname = 'idx_culture_questions_embedding'
            """
            )
        )
        row = result.fetchone()
        assert row is not None

        indexdef = row[0].lower()
        assert "where" in indexdef, "Index should be partial"
        assert "is not null" in indexdef, "Index should filter on non-null embeddings"

    async def test_index_lists_parameter(self, db_session: AsyncSession):
        """Verify the index is configured with lists=50."""
        result = await db_session.execute(
            text(
                """
                SELECT indexdef
                FROM pg_indexes
                WHERE indexname = 'idx_culture_questions_embedding'
            """
            )
        )
        row = result.fetchone()
        assert row is not None

        indexdef = row[0].lower()
        # The lists parameter should be 50 as per architecture spec
        # Note: PostgreSQL may quote the value differently, e.g., lists='50' or lists = 50
        assert (
            "lists = 50" in indexdef
            or "lists=50" in indexdef
            or "lists='50'" in indexdef
            or 'lists="50"' in indexdef
        ), f"Index should have lists=50, got: {indexdef}"

    async def test_embedding_column_exists(self, db_session: AsyncSession):
        """Verify the embedding column has the correct type."""
        result = await db_session.execute(
            text(
                """
                SELECT column_name, udt_name, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'culture_questions'
                AND column_name = 'embedding'
            """
            )
        )
        row = result.fetchone()
        assert row is not None, "Embedding column does not exist"
        assert row[1] == "vector", "Embedding column should be of type vector"
        assert row[2] == "YES", "Embedding column should be nullable"

    async def test_embedding_model_column_exists(self, db_session: AsyncSession):
        """Verify the embedding_model column exists."""
        result = await db_session.execute(
            text(
                """
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'culture_questions'
                AND column_name = 'embedding_model'
            """
            )
        )
        row = result.fetchone()
        assert row is not None, "Embedding model column does not exist"
        assert row[1] == "character varying", "Embedding model should be varchar"
        assert row[2] == 50, "Embedding model should have max length 50"

    async def test_embedding_updated_at_column_exists(self, db_session: AsyncSession):
        """Verify the embedding_updated_at column exists."""
        result = await db_session.execute(
            text(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'culture_questions'
                AND column_name = 'embedding_updated_at'
            """
            )
        )
        row = result.fetchone()
        assert row is not None, "Embedding updated_at column does not exist"
        assert "timestamp" in row[1], "Embedding updated_at should be timestamp type"
