"""Unit tests for changelog schema validation.

Tests for ChangelogItemResponse, ChangelogEntryCreate, ChangelogEntryUpdate,
ChangelogEntryAdminResponse, and list response schemas including field validation,
pagination constraints, and ORM compatibility.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import ChangelogTag
from src.schemas.changelog import (
    ChangelogAdminListResponse,
    ChangelogEntryAdminResponse,
    ChangelogEntryCreate,
    ChangelogEntryUpdate,
    ChangelogItemResponse,
    ChangelogListResponse,
)


class TestChangelogTag:
    """Test that ChangelogTag is imported from db.models, not duplicated."""

    def test_changelog_tag_is_from_db_models(self):
        """Verify ChangelogTag is the same enum as in db.models."""
        from src.schemas.changelog import ChangelogTag as SchemaTag

        assert SchemaTag is ChangelogTag

    def test_tag_values(self):
        """Test ChangelogTag enum values."""
        assert ChangelogTag.NEW_FEATURE.value == "new_feature"
        assert ChangelogTag.BUG_FIX.value == "bug_fix"
        assert ChangelogTag.ANNOUNCEMENT.value == "announcement"


class TestChangelogItemResponse:
    """Test ChangelogItemResponse schema (public, localized)."""

    def test_valid_response_all_fields(self):
        """Test valid response with all fields."""
        now = datetime.now()
        item_id = uuid4()
        response = ChangelogItemResponse(
            id=item_id,
            title="New Feature Released",
            content="We've added a new vocabulary practice mode.",
            tag=ChangelogTag.NEW_FEATURE,
            created_at=now,
            updated_at=now,
        )
        assert response.id == item_id
        assert response.title == "New Feature Released"
        assert response.content == "We've added a new vocabulary practice mode."
        assert response.tag == ChangelogTag.NEW_FEATURE
        assert response.created_at == now
        assert response.updated_at == now

    def test_has_localized_fields_not_language_specific(self):
        """Test public response has title/content, not title_en/title_ru/etc."""
        fields = ChangelogItemResponse.model_fields.keys()
        assert "title" in fields
        assert "content" in fields
        assert "title_en" not in fields
        assert "title_ru" not in fields
        assert "content_en" not in fields
        assert "content_ru" not in fields

    def test_from_attributes_enabled(self):
        """Test from_attributes is enabled for ORM compatibility."""
        assert ChangelogItemResponse.model_config.get("from_attributes") is True

    def test_all_tag_types_valid(self):
        """Test all tag types can be used."""
        now = datetime.now()
        for tag in ChangelogTag:
            response = ChangelogItemResponse(
                id=uuid4(),
                title="Test",
                content="Test content",
                tag=tag,
                created_at=now,
                updated_at=now,
            )
            assert response.tag == tag


class TestChangelogListResponse:
    """Test ChangelogListResponse schema (public, paginated)."""

    def test_valid_list_response(self):
        """Test valid paginated list response."""
        now = datetime.now()
        item = ChangelogItemResponse(
            id=uuid4(),
            title="Test Entry",
            content="Test content",
            tag=ChangelogTag.BUG_FIX,
            created_at=now,
            updated_at=now,
        )
        response = ChangelogListResponse(
            total=1,
            page=1,
            page_size=20,
            items=[item],
        )
        assert response.total == 1
        assert response.page == 1
        assert response.page_size == 20
        assert len(response.items) == 1

    def test_empty_list_response(self):
        """Test empty list response."""
        response = ChangelogListResponse(
            total=0,
            page=1,
            page_size=20,
            items=[],
        )
        assert response.total == 0
        assert len(response.items) == 0

    def test_total_must_be_non_negative(self):
        """Test total must be >= 0."""
        with pytest.raises(ValidationError):
            ChangelogListResponse(
                total=-1,
                page=1,
                page_size=20,
                items=[],
            )

    def test_page_must_be_positive(self):
        """Test page must be >= 1."""
        with pytest.raises(ValidationError):
            ChangelogListResponse(
                total=0,
                page=0,
                page_size=20,
                items=[],
            )

    def test_page_size_minimum(self):
        """Test page_size must be >= 1."""
        with pytest.raises(ValidationError):
            ChangelogListResponse(
                total=0,
                page=1,
                page_size=0,
                items=[],
            )

    def test_page_size_maximum(self):
        """Test page_size must be <= 50."""
        with pytest.raises(ValidationError):
            ChangelogListResponse(
                total=0,
                page=1,
                page_size=51,
                items=[],
            )

    def test_page_size_at_maximum(self):
        """Test page_size at 50 is valid."""
        response = ChangelogListResponse(
            total=0,
            page=1,
            page_size=50,
            items=[],
        )
        assert response.page_size == 50

    def test_page_size_at_minimum(self):
        """Test page_size at 1 is valid."""
        response = ChangelogListResponse(
            total=0,
            page=1,
            page_size=1,
            items=[],
        )
        assert response.page_size == 1


class TestChangelogEntryCreate:
    """Test ChangelogEntryCreate schema (admin create)."""

    def test_valid_create_all_fields(self):
        """Test valid create with all required fields."""
        entry = ChangelogEntryCreate(
            title_en="New Feature",
            title_ru="Новая функция",
            content_en="Description in English",
            content_ru="Описание на русском",
            tag=ChangelogTag.NEW_FEATURE,
        )
        assert entry.title_en == "New Feature"
        assert entry.title_ru == "Новая функция"
        assert entry.content_en == "Description in English"
        assert entry.content_ru == "Описание на русском"
        assert entry.tag == ChangelogTag.NEW_FEATURE

    def test_all_four_language_fields_required(self):
        """Test all 4 language fields are required."""
        # Missing title_en
        with pytest.raises(ValidationError) as exc_info:
            ChangelogEntryCreate(
                title_ru="Test",
                content_en="Test",
                content_ru="Test",
                tag=ChangelogTag.BUG_FIX,
            )
        assert "title_en" in str(exc_info.value)

        # Missing content_ru
        with pytest.raises(ValidationError) as exc_info:
            ChangelogEntryCreate(
                title_en="Test",
                title_ru="Test",
                content_en="Test",
                tag=ChangelogTag.BUG_FIX,
            )
        assert "content_ru" in str(exc_info.value)

    def test_tag_required(self):
        """Test tag is required."""
        with pytest.raises(ValidationError) as exc_info:
            ChangelogEntryCreate(
                title_en="Test",
                title_ru="Test",
                content_en="Test",
                content_ru="Test",
            )
        assert "tag" in str(exc_info.value)

    def test_title_min_length(self):
        """Test title fields require min_length=1."""
        with pytest.raises(ValidationError):
            ChangelogEntryCreate(
                title_en="",
                title_ru="Test",
                content_en="Test",
                content_ru="Test",
                tag=ChangelogTag.BUG_FIX,
            )

    def test_content_min_length(self):
        """Test content fields require min_length=1."""
        with pytest.raises(ValidationError):
            ChangelogEntryCreate(
                title_en="Test",
                title_ru="Test",
                content_en="",
                content_ru="Test",
                tag=ChangelogTag.BUG_FIX,
            )

    def test_title_max_length(self):
        """Test title fields have max_length=500."""
        # At max length - should work
        entry = ChangelogEntryCreate(
            title_en="A" * 500,
            title_ru="Test",
            content_en="Test",
            content_ru="Test",
            tag=ChangelogTag.BUG_FIX,
        )
        assert len(entry.title_en) == 500

        # Over max length - should fail
        with pytest.raises(ValidationError):
            ChangelogEntryCreate(
                title_en="A" * 501,
                title_ru="Test",
                content_en="Test",
                content_ru="Test",
                tag=ChangelogTag.BUG_FIX,
            )

    def test_all_tag_types(self):
        """Test all tag types can be used in create."""
        for tag in ChangelogTag:
            entry = ChangelogEntryCreate(
                title_en="Test",
                title_ru="Test",
                content_en="Test content",
                content_ru="Test content",
                tag=tag,
            )
            assert entry.tag == tag


class TestChangelogEntryUpdate:
    """Test ChangelogEntryUpdate schema (admin update)."""

    def test_all_fields_optional(self):
        """Test all fields are optional (empty update allowed)."""
        update = ChangelogEntryUpdate()
        assert update.title_en is None
        assert update.title_ru is None
        assert update.content_en is None
        assert update.content_ru is None
        assert update.tag is None

    def test_partial_update_title_only(self):
        """Test partial update with only title_en."""
        update = ChangelogEntryUpdate(title_en="Updated Title")
        assert update.title_en == "Updated Title"
        assert update.title_ru is None
        assert update.content_en is None
        assert update.tag is None

    def test_partial_update_tag_only(self):
        """Test partial update with only tag."""
        update = ChangelogEntryUpdate(tag=ChangelogTag.ANNOUNCEMENT)
        assert update.tag == ChangelogTag.ANNOUNCEMENT
        assert update.title_en is None

    def test_full_update(self):
        """Test update with all fields."""
        update = ChangelogEntryUpdate(
            title_en="New Title EN",
            title_ru="New Title RU",
            content_en="New Content EN",
            content_ru="New Content RU",
            tag=ChangelogTag.BUG_FIX,
        )
        assert update.title_en == "New Title EN"
        assert update.content_ru == "New Content RU"
        assert update.tag == ChangelogTag.BUG_FIX

    def test_min_length_still_applies_when_provided(self):
        """Test min_length=1 applies when value is provided."""
        with pytest.raises(ValidationError):
            ChangelogEntryUpdate(title_en="")

        with pytest.raises(ValidationError):
            ChangelogEntryUpdate(content_ru="")

    def test_max_length_still_applies_when_provided(self):
        """Test max_length=500 applies when value is provided."""
        with pytest.raises(ValidationError):
            ChangelogEntryUpdate(title_en="A" * 501)


class TestChangelogEntryAdminResponse:
    """Test ChangelogEntryAdminResponse schema (admin full response)."""

    def test_valid_admin_response(self):
        """Test valid admin response with all fields."""
        now = datetime.now()
        entry_id = uuid4()
        response = ChangelogEntryAdminResponse(
            id=entry_id,
            title_en="New Feature",
            title_ru="Новая функция",
            content_en="Description in English",
            content_ru="Описание на русском",
            tag=ChangelogTag.NEW_FEATURE,
            created_at=now,
            updated_at=now,
        )
        assert response.id == entry_id
        assert response.title_en == "New Feature"
        assert response.title_ru == "Новая функция"
        assert response.content_en == "Description in English"
        assert response.content_ru == "Описание на русском"
        assert response.tag == ChangelogTag.NEW_FEATURE

    def test_has_all_four_language_fields(self):
        """Test admin response has all 4 language fields."""
        fields = ChangelogEntryAdminResponse.model_fields.keys()
        assert "title_en" in fields
        assert "title_ru" in fields
        assert "content_en" in fields
        assert "content_ru" in fields
        # Should NOT have localized-only fields
        assert "title" not in fields
        assert "content" not in fields

    def test_from_attributes_enabled(self):
        """Test from_attributes is enabled for ORM compatibility."""
        assert ChangelogEntryAdminResponse.model_config.get("from_attributes") is True

    def test_has_timestamps(self):
        """Test admin response has created_at and updated_at."""
        fields = ChangelogEntryAdminResponse.model_fields.keys()
        assert "created_at" in fields
        assert "updated_at" in fields


class TestChangelogAdminListResponse:
    """Test ChangelogAdminListResponse schema (admin, paginated)."""

    def test_valid_admin_list_response(self):
        """Test valid paginated admin list response."""
        now = datetime.now()
        item = ChangelogEntryAdminResponse(
            id=uuid4(),
            title_en="Test",
            title_ru="Test",
            content_en="Test content",
            content_ru="Test content",
            tag=ChangelogTag.BUG_FIX,
            created_at=now,
            updated_at=now,
        )
        response = ChangelogAdminListResponse(
            total=1,
            page=1,
            page_size=20,
            items=[item],
        )
        assert response.total == 1
        assert response.page == 1
        assert response.page_size == 20
        assert len(response.items) == 1

    def test_empty_admin_list_response(self):
        """Test empty admin list response."""
        response = ChangelogAdminListResponse(
            total=0,
            page=1,
            page_size=20,
            items=[],
        )
        assert response.total == 0
        assert len(response.items) == 0

    def test_page_size_validation_same_as_public(self):
        """Test page_size has same constraints as public list (ge=1, le=50)."""
        # Invalid: 0
        with pytest.raises(ValidationError):
            ChangelogAdminListResponse(
                total=0,
                page=1,
                page_size=0,
                items=[],
            )

        # Invalid: 51
        with pytest.raises(ValidationError):
            ChangelogAdminListResponse(
                total=0,
                page=1,
                page_size=51,
                items=[],
            )

        # Valid: 50
        response = ChangelogAdminListResponse(
            total=0,
            page=1,
            page_size=50,
            items=[],
        )
        assert response.page_size == 50

    def test_page_validation(self):
        """Test page must be >= 1."""
        with pytest.raises(ValidationError):
            ChangelogAdminListResponse(
                total=0,
                page=0,
                page_size=20,
                items=[],
            )

    def test_total_validation(self):
        """Test total must be >= 0."""
        with pytest.raises(ValidationError):
            ChangelogAdminListResponse(
                total=-1,
                page=1,
                page_size=20,
                items=[],
            )


class TestSchemaExports:
    """Test that schemas are properly exported from __init__.py."""

    def test_all_schemas_exported(self):
        """Test all 6 schemas are exported from src.schemas."""
        from src.schemas import (
            ChangelogAdminListResponse,
            ChangelogEntryAdminResponse,
            ChangelogEntryCreate,
            ChangelogEntryUpdate,
            ChangelogItemResponse,
            ChangelogListResponse,
        )

        # Just verify imports work - if they don't, test fails
        assert ChangelogItemResponse is not None
        assert ChangelogListResponse is not None
        assert ChangelogEntryCreate is not None
        assert ChangelogEntryUpdate is not None
        assert ChangelogEntryAdminResponse is not None
        assert ChangelogAdminListResponse is not None

    def test_changelog_tag_not_duplicated_in_exports(self):
        """Test ChangelogTag is NOT re-exported from schemas (use db.models)."""
        import src.schemas

        # ChangelogTag should not be in schemas __all__ since it's from db.models
        assert "ChangelogTag" not in src.schemas.__all__
