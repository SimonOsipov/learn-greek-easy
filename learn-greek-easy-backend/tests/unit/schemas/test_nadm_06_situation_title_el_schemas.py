"""Unit tests for NADM-06 schema changes (no DB required).

Tests verify:
- SituationUpdate accepts title_el as an independent optional field
- SituationResponse exposes title_el
- NewsItemUpdate accepts title_el independently of scenario_el
- NewsItemResponse exposes situation_title_el
"""

import pytest
from pydantic import ValidationError

from src.schemas.news_item import NewsItemResponse, NewsItemUpdate
from src.schemas.situation import SituationResponse, SituationUpdate


class TestSituationUpdateTitleEl:
    """SituationUpdate schema accepts title_el independently."""

    def test_title_el_alone_is_valid(self):
        """SituationUpdate with only title_el set must be valid."""
        update = SituationUpdate(title_el="Ελληνικός τίτλος")
        assert update.title_el == "Ελληνικός τίτλος"

    def test_title_el_with_scenario_el(self):
        """SituationUpdate with both title_el and scenario_el is valid."""
        update = SituationUpdate(title_el="Τίτλος", scenario_el="Σενάριο")
        assert update.title_el == "Τίτλος"
        assert update.scenario_el == "Σενάριο"

    def test_title_el_min_length(self):
        """title_el must have min_length=1 — empty string raises."""
        with pytest.raises(ValidationError):
            SituationUpdate(title_el="")

    def test_title_el_max_length(self):
        """title_el must respect max_length=500."""
        with pytest.raises(ValidationError):
            SituationUpdate(title_el="α" * 501)

    def test_omitting_title_el_is_valid(self):
        """SituationUpdate without title_el is still valid."""
        update = SituationUpdate(scenario_el="Σενάριο")
        assert update.title_el is None

    def test_updating_scenario_el_does_not_require_title_el(self):
        """scenario_el can be updated alone — title_el is independent."""
        update = SituationUpdate(scenario_el="Σενάριο")
        assert update.scenario_el == "Σενάριο"
        assert update.title_el is None


class TestSituationResponseTitleEl:
    """SituationResponse exposes title_el."""

    def test_response_includes_title_el_none_by_default(self):
        """SituationResponse.title_el defaults to None when not provided."""
        from datetime import datetime
        from uuid import uuid4

        from src.db.models import SituationStatus

        response = SituationResponse(
            id=uuid4(),
            scenario_el="Σενάριο",
            scenario_en="Scenario",
            scenario_ru="Сценарий",
            status=SituationStatus.DRAFT,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert response.title_el is None

    def test_response_exposes_title_el_when_set(self):
        """SituationResponse.title_el is returned when provided."""
        from datetime import datetime
        from uuid import uuid4

        from src.db.models import SituationStatus

        response = SituationResponse(
            id=uuid4(),
            scenario_el="Σενάριο",
            title_el="Τίτλος",
            scenario_en="Scenario",
            scenario_ru="Сценарий",
            status=SituationStatus.DRAFT,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert response.title_el == "Τίτλος"


class TestNewsItemUpdateTitleEl:
    """NewsItemUpdate schema accepts title_el independently."""

    def test_title_el_alone_is_valid(self):
        """NewsItemUpdate with only title_el set must be valid."""
        update = NewsItemUpdate(title_el="Ελληνικός τίτλος")
        assert update.title_el == "Ελληνικός τίτλος"

    def test_title_el_with_scenario_el_are_independent(self):
        """Both title_el and scenario_el can be set independently."""
        update = NewsItemUpdate(title_el="Τίτλος", scenario_el="Σενάριο")
        assert update.title_el == "Τίτλος"
        assert update.scenario_el == "Σενάριο"

    def test_omitting_title_el_is_valid(self):
        """NewsItemUpdate without title_el is still valid."""
        update = NewsItemUpdate(scenario_el="Σενάριο")
        assert update.title_el is None

    def test_title_el_min_length(self):
        """title_el must have min_length=1."""
        with pytest.raises(ValidationError):
            NewsItemUpdate(title_el="")

    def test_title_el_max_length(self):
        """title_el must respect max_length=500."""
        with pytest.raises(ValidationError):
            NewsItemUpdate(title_el="α" * 501)

    def test_updating_scenario_el_does_not_require_title_el(self):
        """scenario_el can be updated alone — title_el is independent of it."""
        update = NewsItemUpdate(scenario_el="Σενάριο")
        assert update.scenario_el == "Σενάριο"
        assert update.title_el is None


class TestNewsItemResponseSituationTitleEl:
    """NewsItemResponse exposes situation_title_el."""

    def test_situation_title_el_defaults_to_none(self):
        """NewsItemResponse.situation_title_el is None when not provided."""
        from datetime import date, datetime
        from uuid import uuid4

        response = NewsItemResponse(
            id=uuid4(),
            situation_id=uuid4(),
            title_el="Τίτλος",
            title_en="Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            country="cyprus",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert response.situation_title_el is None

    def test_situation_title_el_is_exposed_when_set(self):
        """NewsItemResponse.situation_title_el is returned when provided."""
        from datetime import date, datetime
        from uuid import uuid4

        response = NewsItemResponse(
            id=uuid4(),
            situation_id=uuid4(),
            title_el="Τίτλος",
            situation_title_el="Ανεξάρτητος τίτλος",
            title_en="Title",
            title_ru="Заголовок",
            description_el="Περιγραφή",
            publication_date=date.today(),
            original_article_url="https://example.com/article",
            country="cyprus",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert response.situation_title_el == "Ανεξάρτητος τίτλος"
