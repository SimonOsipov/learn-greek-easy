"""Unit tests for CardErrorService (user-facing methods).

Tests cover:
- create_card_error_report: Creating new error reports

All tests use mocked dependencies for isolation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import ConflictException
from src.db.models import CardErrorCardType, CardErrorReport
from src.schemas.card_error import CardErrorReportCreate
from src.services.card_error_service import CardErrorService

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    session = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_repo():
    """Create a mock CardErrorReportRepository."""
    repo = MagicMock()
    repo.get_user_report_for_card = AsyncMock(return_value=None)
    repo.create = AsyncMock()
    return repo


@pytest.fixture
def service(mock_db_session, mock_repo):
    """Create service instance with mocked repo."""
    svc = CardErrorService(mock_db_session)
    svc.repo = mock_repo
    return svc


# =============================================================================
# Test create_card_error_report - Success
# =============================================================================


@pytest.mark.unit
class TestCreateCardErrorReportSuccess:
    """Tests for successful card error report creation."""

    @pytest.mark.asyncio
    async def test_create_card_error_report_success(self, service, mock_repo):
        """Creates a new error report when no existing report exists."""
        # Arrange
        user_id = uuid4()
        card_id = uuid4()
        mock_report = MagicMock(spec=CardErrorReport)
        mock_report.id = uuid4()
        mock_report.user_id = user_id
        mock_report.card_id = card_id
        mock_report.card_type = CardErrorCardType.VOCABULARY
        mock_report.description = "The translation is incorrect."

        mock_repo.get_user_report_for_card.return_value = None
        mock_repo.create.return_value = mock_report

        create_data = CardErrorReportCreate(
            card_id=card_id,
            card_type=CardErrorCardType.VOCABULARY,
            description="The translation is incorrect.",
        )

        # Act
        with patch("src.services.card_error_service.logger"):
            result = await service.create_card_error_report(
                user_id=user_id,
                data=create_data,
            )

        # Assert
        assert result == mock_report
        mock_repo.get_user_report_for_card.assert_awaited_once_with(
            card_id=card_id,
            card_type=CardErrorCardType.VOCABULARY,
            user_id=user_id,
        )
        mock_repo.create.assert_awaited_once()


# =============================================================================
# Test create_card_error_report - Duplicate Report
# =============================================================================


@pytest.mark.unit
class TestCreateCardErrorReportDuplicate:
    """Tests for duplicate card error report handling."""

    @pytest.mark.asyncio
    async def test_create_card_error_report_raises_conflict_when_exists(self, service, mock_repo):
        """Raises ConflictException when user already reported this card."""
        # Arrange
        user_id = uuid4()
        card_id = uuid4()
        existing_report = MagicMock(spec=CardErrorReport)
        existing_report.id = uuid4()

        mock_repo.get_user_report_for_card.return_value = existing_report

        create_data = CardErrorReportCreate(
            card_id=card_id,
            card_type=CardErrorCardType.VOCABULARY,
            description="This has an error.",
        )

        # Act & Assert
        with pytest.raises(ConflictException) as exc_info:
            await service.create_card_error_report(
                user_id=user_id,
                data=create_data,
            )

        assert "already reported" in str(exc_info.value.detail)
        mock_repo.create.assert_not_awaited()


# =============================================================================
# Test create_card_error_report - Culture Card Type
# =============================================================================


@pytest.mark.unit
class TestCreateCardErrorReportCultureType:
    """Tests for creating error reports for culture questions."""

    @pytest.mark.asyncio
    async def test_create_card_error_report_culture_type(self, service, mock_repo):
        """Creates error report for culture question type."""
        # Arrange
        user_id = uuid4()
        card_id = uuid4()
        mock_report = MagicMock(spec=CardErrorReport)
        mock_report.id = uuid4()
        mock_report.card_type = CardErrorCardType.CULTURE

        mock_repo.get_user_report_for_card.return_value = None
        mock_repo.create.return_value = mock_report

        create_data = CardErrorReportCreate(
            card_id=card_id,
            card_type=CardErrorCardType.CULTURE,
            description="The correct answer is wrong.",
        )

        # Act
        with patch("src.services.card_error_service.logger"):
            result = await service.create_card_error_report(
                user_id=user_id,
                data=create_data,
            )

        # Assert
        assert result == mock_report
        mock_repo.get_user_report_for_card.assert_awaited_once_with(
            card_id=card_id,
            card_type=CardErrorCardType.CULTURE,
            user_id=user_id,
        )


# =============================================================================
# Test create_card_error_report - Logging
# =============================================================================


@pytest.mark.unit
class TestCreateCardErrorReportLogging:
    """Tests for create_card_error_report logging behavior."""

    @pytest.mark.asyncio
    async def test_create_card_error_report_logs_creation(self, service, mock_repo):
        """Verify logger.info called with expected extra fields."""
        # Arrange
        user_id = uuid4()
        card_id = uuid4()
        report_id = uuid4()
        mock_report = MagicMock(spec=CardErrorReport)
        mock_report.id = report_id
        mock_report.user_id = user_id
        mock_report.card_id = card_id
        mock_report.card_type = CardErrorCardType.VOCABULARY

        mock_repo.get_user_report_for_card.return_value = None
        mock_repo.create.return_value = mock_report

        create_data = CardErrorReportCreate(
            card_id=card_id,
            card_type=CardErrorCardType.VOCABULARY,
            description="Test description",
        )

        # Act
        with patch("src.services.card_error_service.logger") as mock_logger:
            await service.create_card_error_report(
                user_id=user_id,
                data=create_data,
            )

            # Assert
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            log_message = call_args[0][0]
            extra = call_args[1]["extra"]

            assert log_message == "Card error report created"
            assert extra["report_id"] == str(report_id)
            assert extra["user_id"] == str(user_id)
            assert extra["card_id"] == str(card_id)
            assert extra["card_type"] == "VOCABULARY"
