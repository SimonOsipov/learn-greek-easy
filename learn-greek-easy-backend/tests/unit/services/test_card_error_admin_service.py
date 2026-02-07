"""Unit tests for CardErrorAdminService.

Tests cover:
- get_list_for_admin: Paginated list with filters and PENDING-first sorting
- get_report_for_admin: Single report retrieval
- update_report_for_admin: Update with resolution tracking

All tests use mocked dependencies for isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.core.exceptions import NotFoundException
from src.db.models import CardErrorCardType, CardErrorReport, CardErrorStatus, User
from src.schemas.card_error import AdminCardErrorReportUpdate
from src.services.card_error_admin_service import CardErrorAdminService

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
    repo.list_for_admin = AsyncMock(return_value=[])
    repo.count_with_filters = AsyncMock(return_value=0)
    repo.get_with_relations = AsyncMock(return_value=None)
    repo.update = AsyncMock()
    return repo


@pytest.fixture
def mock_user():
    """Create a mock user (reporter)."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.full_name = "Test Reporter"
    return user


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user (resolver)."""
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.full_name = "Admin User"
    return user


@pytest.fixture
def mock_report(mock_user):
    """Create a mock card error report with PENDING status."""
    report = MagicMock(spec=CardErrorReport)
    report.id = uuid4()
    report.user_id = mock_user.id
    report.card_id = uuid4()
    report.card_type = CardErrorCardType.WORD
    report.description = "This card has a typo in the translation."
    report.status = CardErrorStatus.PENDING
    report.admin_notes = None
    report.resolved_by = None
    report.resolved_at = None
    report.user = mock_user
    report.resolver = None
    report.created_at = datetime.now(timezone.utc)
    report.updated_at = datetime.now(timezone.utc)
    return report


@pytest.fixture
def service(mock_db_session, mock_repo):
    """Create service instance with mocked repo."""
    svc = CardErrorAdminService(mock_db_session)
    svc.repo = mock_repo
    return svc


# =============================================================================
# Test get_list_for_admin - No Filters
# =============================================================================


@pytest.mark.unit
class TestGetListForAdminNoFilters:
    """Tests for get_list_for_admin without filters."""

    @pytest.mark.asyncio
    async def test_get_list_for_admin_no_filters(self, service, mock_repo, mock_report):
        """Returns all reports with count when no filters provided."""
        # Arrange
        mock_repo.list_for_admin.return_value = [mock_report]
        mock_repo.count_with_filters.return_value = 1

        # Act
        items, total = await service.get_list_for_admin(page=1, page_size=20)

        # Assert
        assert len(items) == 1
        assert total == 1
        mock_repo.list_for_admin.assert_awaited_once_with(
            card_type=None,
            status=None,
            skip=0,
            limit=20,
        )
        mock_repo.count_with_filters.assert_awaited_once_with(
            card_type=None,
            status=None,
        )


# =============================================================================
# Test get_list_for_admin - With Filters
# =============================================================================


@pytest.mark.unit
class TestGetListForAdminWithFilters:
    """Tests for get_list_for_admin with various filters."""

    @pytest.mark.asyncio
    async def test_get_list_for_admin_with_status_filter(self, service, mock_repo, mock_report):
        """Filters by status correctly."""
        # Arrange
        mock_report.status = CardErrorStatus.PENDING
        mock_repo.list_for_admin.return_value = [mock_report]
        mock_repo.count_with_filters.return_value = 1

        # Act
        items, total = await service.get_list_for_admin(
            status=CardErrorStatus.PENDING,
            page=1,
            page_size=20,
        )

        # Assert
        assert len(items) == 1
        assert total == 1
        mock_repo.list_for_admin.assert_awaited_once_with(
            card_type=None,
            status=CardErrorStatus.PENDING,
            skip=0,
            limit=20,
        )

    @pytest.mark.asyncio
    async def test_get_list_for_admin_with_card_type_filter(self, service, mock_repo, mock_report):
        """Filters by card type correctly."""
        # Arrange
        mock_repo.list_for_admin.return_value = [mock_report]
        mock_repo.count_with_filters.return_value = 1

        # Act
        items, total = await service.get_list_for_admin(
            card_type=CardErrorCardType.WORD,
            page=1,
            page_size=20,
        )

        # Assert
        assert len(items) == 1
        mock_repo.list_for_admin.assert_awaited_once_with(
            card_type=CardErrorCardType.WORD,
            status=None,
            skip=0,
            limit=20,
        )

    @pytest.mark.asyncio
    async def test_get_list_for_admin_with_multiple_filters(self, service, mock_repo, mock_report):
        """Multiple filters work simultaneously."""
        # Arrange
        mock_repo.list_for_admin.return_value = [mock_report]
        mock_repo.count_with_filters.return_value = 1

        # Act
        items, total = await service.get_list_for_admin(
            card_type=CardErrorCardType.CULTURE,
            status=CardErrorStatus.FIXED,
            page=1,
            page_size=10,
        )

        # Assert
        assert len(items) == 1
        mock_repo.list_for_admin.assert_awaited_once_with(
            card_type=CardErrorCardType.CULTURE,
            status=CardErrorStatus.FIXED,
            skip=0,
            limit=10,
        )
        mock_repo.count_with_filters.assert_awaited_once_with(
            card_type=CardErrorCardType.CULTURE,
            status=CardErrorStatus.FIXED,
        )


# =============================================================================
# Test get_list_for_admin - Empty Results
# =============================================================================


@pytest.mark.unit
class TestGetListForAdminEmptyResults:
    """Tests for get_list_for_admin when no results match."""

    @pytest.mark.asyncio
    async def test_get_list_for_admin_empty_results(self, service, mock_repo):
        """Returns empty list and zero count when no reports match filters."""
        # Arrange
        mock_repo.list_for_admin.return_value = []
        mock_repo.count_with_filters.return_value = 0

        # Act
        items, total = await service.get_list_for_admin(
            status=CardErrorStatus.DISMISSED,
            page=1,
            page_size=20,
        )

        # Assert
        assert items == []
        assert total == 0


# =============================================================================
# Test get_list_for_admin - Pagination
# =============================================================================


@pytest.mark.unit
class TestGetListForAdminPagination:
    """Tests for get_list_for_admin pagination calculations."""

    @pytest.mark.asyncio
    async def test_get_list_for_admin_pagination(self, service, mock_repo):
        """Calculates correct skip value from page number."""
        # Arrange
        mock_repo.list_for_admin.return_value = []
        mock_repo.count_with_filters.return_value = 50

        # Act - page 3 with page_size 20 = skip 40
        await service.get_list_for_admin(page=3, page_size=20)

        # Assert
        mock_repo.list_for_admin.assert_awaited_once_with(
            card_type=None,
            status=None,
            skip=40,  # (3-1) * 20 = 40
            limit=20,
        )


# =============================================================================
# Test get_report_for_admin - Success
# =============================================================================


@pytest.mark.unit
class TestGetReportForAdminSuccess:
    """Tests for get_report_for_admin when report exists."""

    @pytest.mark.asyncio
    async def test_get_report_for_admin_success(self, service, mock_repo, mock_report):
        """Returns report with relations when found."""
        # Arrange
        mock_repo.get_with_relations.return_value = mock_report

        # Act
        result = await service.get_report_for_admin(mock_report.id)

        # Assert
        assert result == mock_report
        mock_repo.get_with_relations.assert_awaited_once_with(mock_report.id)


# =============================================================================
# Test get_report_for_admin - Not Found
# =============================================================================


@pytest.mark.unit
class TestGetReportForAdminNotFound:
    """Tests for get_report_for_admin when report doesn't exist."""

    @pytest.mark.asyncio
    async def test_get_report_for_admin_not_found(self, service, mock_repo):
        """Raises NotFoundException when report doesn't exist."""
        # Arrange
        mock_repo.get_with_relations.return_value = None
        fake_id = uuid4()

        # Act & Assert
        with pytest.raises(NotFoundException) as exc_info:
            await service.get_report_for_admin(fake_id)

        assert "CardErrorReport" in str(exc_info.value.detail)


# =============================================================================
# Test update_report_for_admin - Status Only
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminStatusOnly:
    """Tests for update_report_for_admin with status change only."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_status_only(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Updates status and sets resolution info when resolving."""
        # Arrange
        mock_report.status = CardErrorStatus.PENDING
        mock_report.resolved_at = None
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(status=CardErrorStatus.FIXED),
            )

        # Assert
        mock_repo.update.assert_awaited_once()
        call_args = mock_repo.update.call_args
        update_dict = call_args[0][1]

        assert update_dict["status"] == CardErrorStatus.FIXED
        assert update_dict["resolved_by"] == admin_id
        assert "resolved_at" in update_dict
        assert isinstance(update_dict["resolved_at"], datetime)


# =============================================================================
# Test update_report_for_admin - Notes Only
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminNotesOnly:
    """Tests for update_report_for_admin with notes only."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_notes_only(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Updates notes without changing resolution status."""
        # Arrange
        mock_report.status = CardErrorStatus.PENDING
        mock_report.resolved_at = None
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(admin_notes="Need more info from user."),
            )

        # Assert
        mock_repo.update.assert_awaited_once()
        call_args = mock_repo.update.call_args
        update_dict = call_args[0][1]

        assert update_dict["admin_notes"] == "Need more info from user."
        assert "status" not in update_dict
        assert "resolved_by" not in update_dict
        assert "resolved_at" not in update_dict


# =============================================================================
# Test update_report_for_admin - Both Fields
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminBothFields:
    """Tests for update_report_for_admin with both status and notes."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_both_fields(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Updates both status and notes simultaneously."""
        # Arrange
        mock_report.status = CardErrorStatus.PENDING
        mock_report.resolved_at = None
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(
                    status=CardErrorStatus.REVIEWED,
                    admin_notes="Reviewed and confirmed the issue.",
                ),
            )

        # Assert
        mock_repo.update.assert_awaited_once()
        call_args = mock_repo.update.call_args
        update_dict = call_args[0][1]

        assert update_dict["status"] == CardErrorStatus.REVIEWED
        assert update_dict["admin_notes"] == "Reviewed and confirmed the issue."
        assert update_dict["resolved_by"] == admin_id
        assert "resolved_at" in update_dict


# =============================================================================
# Test update_report_for_admin - No Changes (Empty Update)
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminNoChanges:
    """Tests for update_report_for_admin with no actual changes."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_no_changes(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Empty update returns unchanged report without DB update."""
        # Arrange
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(),  # No fields set
            )

        # Assert - repo.update should NOT be called
        mock_repo.update.assert_not_awaited()


# =============================================================================
# Test update_report_for_admin - Not Found
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminNotFound:
    """Tests for update_report_for_admin when report doesn't exist."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_not_found(self, service, mock_repo, mock_admin_user):
        """Raises NotFoundException when report doesn't exist."""
        # Arrange
        mock_repo.get_with_relations.return_value = None
        fake_id = uuid4()
        admin_id = mock_admin_user.id

        # Act & Assert
        with pytest.raises(NotFoundException) as exc_info:
            await service.update_report_for_admin(
                report_id=fake_id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(status=CardErrorStatus.FIXED),
            )

        assert "CardErrorReport" in str(exc_info.value.detail)


# =============================================================================
# Test update_report_for_admin - Reopen (PENDING from resolved)
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminReopen:
    """Tests for update_report_for_admin when re-opening a resolved report."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_reopen(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Clears resolution info when changing to PENDING."""
        # Arrange - report is already resolved
        mock_report.status = CardErrorStatus.FIXED
        mock_report.resolved_by = uuid4()
        mock_report.resolved_at = datetime.now(timezone.utc)
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(status=CardErrorStatus.PENDING),
            )

        # Assert
        mock_repo.update.assert_awaited_once()
        call_args = mock_repo.update.call_args
        update_dict = call_args[0][1]

        assert update_dict["status"] == CardErrorStatus.PENDING
        assert update_dict["resolved_by"] is None
        assert update_dict["resolved_at"] is None


# =============================================================================
# Test update_report_for_admin - Already Resolved (Keep Original Resolver)
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminAlreadyResolved:
    """Tests for update_report_for_admin when already resolved."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_already_resolved(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Keeps original resolver when changing between resolved statuses."""
        # Arrange - report already resolved
        original_resolver_id = uuid4()
        original_resolved_at = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        mock_report.status = CardErrorStatus.REVIEWED
        mock_report.resolved_by = original_resolver_id
        mock_report.resolved_at = original_resolved_at
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act - change to different resolved status
        with patch("src.services.card_error_admin_service.logger"):
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(status=CardErrorStatus.FIXED),
            )

        # Assert - resolution info should NOT be overwritten
        mock_repo.update.assert_awaited_once()
        call_args = mock_repo.update.call_args
        update_dict = call_args[0][1]

        assert update_dict["status"] == CardErrorStatus.FIXED
        # resolved_by and resolved_at should NOT be in update_dict
        # because report.resolved_at is not None
        assert "resolved_by" not in update_dict
        assert "resolved_at" not in update_dict


# =============================================================================
# Test update_report_for_admin - Logging
# =============================================================================


@pytest.mark.unit
class TestUpdateReportForAdminLogging:
    """Tests for update_report_for_admin logging behavior."""

    @pytest.mark.asyncio
    async def test_update_report_for_admin_logs_action(
        self, service, mock_repo, mock_report, mock_admin_user
    ):
        """Verify logger.info called with expected extra fields."""
        # Arrange
        mock_report.status = CardErrorStatus.PENDING
        mock_report.resolved_at = None
        mock_repo.get_with_relations.return_value = mock_report
        admin_id = mock_admin_user.id

        # Act
        with patch("src.services.card_error_admin_service.logger") as mock_logger:
            await service.update_report_for_admin(
                report_id=mock_report.id,
                admin_user_id=admin_id,
                data=AdminCardErrorReportUpdate(
                    status=CardErrorStatus.DISMISSED,
                    admin_notes="Invalid report.",
                ),
            )

            # Assert
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args
            log_message = call_args[0][0]
            extra = call_args[1]["extra"]

            assert log_message == "Card error report updated by admin"
            assert extra["report_id"] == str(mock_report.id)
            assert extra["admin_user_id"] == str(admin_id)
            assert extra["new_status"] == "DISMISSED"
            assert extra["has_admin_notes"] is True
