"""Unit tests for multi-country news feature.

Tests cover:
- NewsCountry enum values
- Schema validation
"""

import enum
from datetime import date

import pytest
from pydantic import ValidationError

from src.db.models import NewsCountry
from src.schemas.news_item import CountryCounts, NewsItemCreate, NewsItemUpdate

# =============================================================================
# TestNewsCountryEnum
# =============================================================================


class TestNewsCountryEnum:
    """Tests for the NewsCountry enum."""

    def test_has_exactly_three_values(self):
        """NewsCountry should have exactly 3 values."""
        assert len(NewsCountry) == 3

    def test_cyprus_value(self):
        """CYPRUS should have value 'cyprus'."""
        assert NewsCountry.CYPRUS.value == "cyprus"

    def test_greece_value(self):
        """GREECE should have value 'greece'."""
        assert NewsCountry.GREECE.value == "greece"

    def test_world_value(self):
        """WORLD should have value 'world'."""
        assert NewsCountry.WORLD.value == "world"

    def test_is_str_enum(self):
        """NewsCountry should be a str Enum subclass."""
        assert issubclass(NewsCountry, str)
        assert issubclass(NewsCountry, enum.Enum)

    def test_string_comparison(self):
        """NewsCountry values should compare equal to their string equivalents."""
        assert NewsCountry.CYPRUS == "cyprus"
        assert NewsCountry.GREECE == "greece"
        assert NewsCountry.WORLD == "world"


# =============================================================================
# TestSchemaValidation
# =============================================================================


class TestSchemaValidation:
    """Tests for schema validation with country field."""

    def test_create_accepts_cyprus(self):
        """NewsItemCreate should accept 'cyprus' as country."""
        data = NewsItemCreate(
            scenario_el="Τίτλος",
            scenario_en="Title",
            scenario_ru="Заголовок",
            text_el="Περιγραφή",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            source_image_url="https://example.com/image.jpg",
            country="cyprus",
        )
        assert data.country.value == "cyprus"

    def test_create_accepts_greece(self):
        """NewsItemCreate should accept 'greece' as country."""
        data = NewsItemCreate(
            scenario_el="Τίτλος",
            scenario_en="Title",
            scenario_ru="Заголовок",
            text_el="Περιγραφή",
            publication_date=date.today(),
            original_article_url="https://example.com/article2",
            source_image_url="https://example.com/image.jpg",
            country="greece",
        )
        assert data.country.value == "greece"

    def test_create_accepts_world(self):
        """NewsItemCreate should accept 'world' as country."""
        data = NewsItemCreate(
            scenario_el="Τίτλος",
            scenario_en="Title",
            scenario_ru="Заголовок",
            text_el="Περιγραφή",
            publication_date=date.today(),
            original_article_url="https://example.com/article3",
            source_image_url="https://example.com/image.jpg",
            country="world",
        )
        assert data.country.value == "world"

    def test_create_rejects_invalid_country(self):
        """NewsItemCreate should reject invalid country values."""
        with pytest.raises(ValidationError):
            NewsItemCreate(
                scenario_el="Τίτλος",
                scenario_en="Title",
                scenario_ru="Заголовок",
                text_el="Περιγραφή",
                publication_date=date.today(),
                original_article_url="https://example.com/article4",
                source_image_url="https://example.com/image.jpg",
                country="england",  # invalid
            )

    def test_update_country_optional(self):
        """NewsItemUpdate should allow None country (no update)."""
        data = NewsItemUpdate()
        assert data.country is None

    def test_update_country_accepts_valid_value(self):
        """NewsItemUpdate should accept valid country value."""
        data = NewsItemUpdate(country="greece")
        assert data.country.value == "greece"

    def test_update_rejects_invalid_country(self):
        """NewsItemUpdate should reject invalid country values."""
        with pytest.raises(ValidationError):
            NewsItemUpdate(country="invalid_country")

    def test_country_counts_defaults_to_zero(self):
        """CountryCounts default values should all be 0."""
        counts = CountryCounts()
        assert counts.cyprus == 0
        assert counts.greece == 0
        assert counts.world == 0

    def test_country_counts_can_be_set(self):
        """CountryCounts should accept explicit values."""
        counts = CountryCounts(cyprus=5, greece=3, world=2)
        assert counts.cyprus == 5
        assert counts.greece == 3
        assert counts.world == 2
