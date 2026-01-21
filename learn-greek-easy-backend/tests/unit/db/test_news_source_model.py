"""Unit tests for NewsSource model.

Tests the NewsSource model:
- Required fields exist
- Table name is correct
- UUID primary key with server-side generation
- URL unique constraint
- is_active defaults to True
- TimestampMixin provides created_at and updated_at
"""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import NewsSource


class TestNewsSourceModel:
    """Pure unit tests for NewsSource model (no database)."""

    def test_news_source_model_has_required_fields(self):
        """Test NewsSource model has all required fields."""
        assert hasattr(NewsSource, "id")
        assert hasattr(NewsSource, "name")
        assert hasattr(NewsSource, "url")
        assert hasattr(NewsSource, "is_active")
        assert hasattr(NewsSource, "created_at")
        assert hasattr(NewsSource, "updated_at")

    def test_news_source_tablename(self):
        """Test NewsSource has correct table name."""
        assert NewsSource.__tablename__ == "news_sources"

    def test_news_source_repr(self):
        """Test NewsSource __repr__ method."""
        source = NewsSource(
            name="Test Source",
            url="https://example.com/very-long-url-that-gets-truncated",
            is_active=True,
        )
        repr_str = repr(source)
        assert "NewsSource" in repr_str
        assert "Test Source" in repr_str

    def test_news_source_repr_truncates_url(self):
        """Test NewsSource __repr__ truncates long URLs."""
        long_url = "https://example.com/this-is-a-very-long-url-path"
        source = NewsSource(
            name="Long URL Source",
            url=long_url,
            is_active=True,
        )
        repr_str = repr(source)
        # URL should be truncated to 30 characters
        assert "..." in repr_str
        assert len(long_url) > 30  # Verify URL is actually long

    def test_news_source_with_is_active_true(self):
        """Test NewsSource with is_active=True."""
        source = NewsSource(
            name="Active Source",
            url="https://active.example.com",
            is_active=True,
        )
        assert source.is_active is True

    def test_news_source_with_is_active_false(self):
        """Test NewsSource with is_active=False."""
        source = NewsSource(
            name="Inactive Source",
            url="https://inactive.example.com",
            is_active=False,
        )
        assert source.is_active is False


class TestNewsSourceModelDatabase:
    """Integration tests for NewsSource model with database."""

    @pytest.mark.asyncio
    async def test_news_source_persistence(self, db_session: AsyncSession):
        """Test NewsSource can be persisted to database."""
        source = NewsSource(
            name="Test News Source",
            url="https://test-source.example.com",
            is_active=True,
        )
        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)

        assert source.id is not None
        assert source.name == "Test News Source"
        assert source.url == "https://test-source.example.com"
        assert source.is_active is True

    @pytest.mark.asyncio
    async def test_news_source_url_unique_constraint(self, db_session: AsyncSession):
        """Test url field has unique constraint at database level."""
        source1 = NewsSource(
            name="Source 1",
            url="https://unique-test.example.com",
            is_active=True,
        )
        db_session.add(source1)
        await db_session.commit()

        source2 = NewsSource(
            name="Source 2",
            url="https://unique-test.example.com",  # Same URL
            is_active=True,
        )
        db_session.add(source2)

        with pytest.raises(IntegrityError):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_news_source_is_active_default(self, db_session: AsyncSession):
        """Test is_active defaults to True when not specified."""
        source = NewsSource(
            name="Default Active Source",
            url="https://default-active.example.com",
        )
        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)

        assert source.is_active is True

    @pytest.mark.asyncio
    async def test_news_source_timestamps(self, db_session: AsyncSession):
        """Test created_at and updated_at are set on insert."""
        source = NewsSource(
            name="Timestamp Test",
            url="https://timestamp-test.example.com",
            is_active=True,
        )
        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)

        assert source.created_at is not None
        assert source.updated_at is not None

    @pytest.mark.asyncio
    async def test_news_source_uuid_generation(self, db_session: AsyncSession):
        """Test UUID is generated server-side on insert."""
        source = NewsSource(
            name="UUID Test Source",
            url="https://uuid-test.example.com",
            is_active=True,
        )
        # Before commit, id should be None (generated server-side)
        assert source.id is None

        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)

        # After commit, id should be a valid UUID
        assert source.id is not None
        assert len(str(source.id)) == 36  # UUID string format

    @pytest.mark.asyncio
    async def test_news_source_multiple_sources(self, db_session: AsyncSession):
        """Test multiple NewsSource instances can be created."""
        sources = [
            NewsSource(
                name=f"Source {i}",
                url=f"https://source{i}.example.com",
                is_active=i % 2 == 0,  # Alternating active/inactive
            )
            for i in range(5)
        ]

        for source in sources:
            db_session.add(source)

        await db_session.commit()

        for i, source in enumerate(sources):
            await db_session.refresh(source)
            assert source.id is not None
            assert source.name == f"Source {i}"
            assert source.url == f"https://source{i}.example.com"
            assert source.is_active == (i % 2 == 0)

    @pytest.mark.asyncio
    async def test_news_source_update(self, db_session: AsyncSession):
        """Test NewsSource can be updated."""
        source = NewsSource(
            name="Original Name",
            url="https://original-url.example.com",
            is_active=True,
        )
        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)

        # Update fields
        source.name = "Updated Name"
        source.is_active = False
        await db_session.commit()
        await db_session.refresh(source)

        assert source.name == "Updated Name"
        assert source.is_active is False
        # URL remains unchanged
        assert source.url == "https://original-url.example.com"

    @pytest.mark.asyncio
    async def test_news_source_delete(self, db_session: AsyncSession):
        """Test NewsSource can be deleted."""
        from sqlalchemy import select

        source = NewsSource(
            name="Delete Test",
            url="https://delete-test.example.com",
            is_active=True,
        )
        db_session.add(source)
        await db_session.commit()
        await db_session.refresh(source)
        source_id = source.id

        # Delete the source
        await db_session.delete(source)
        await db_session.commit()

        # Verify it's deleted
        result = await db_session.execute(select(NewsSource).where(NewsSource.id == source_id))
        deleted_source = result.scalar_one_or_none()
        assert deleted_source is None
