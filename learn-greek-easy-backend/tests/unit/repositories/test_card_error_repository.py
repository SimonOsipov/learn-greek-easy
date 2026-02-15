"""Unit tests for CardErrorReportRepository.

This module tests:
- get_pending_report_for_card: Get user's PENDING report for a card

Tests use real database fixtures to verify SQL queries work correctly.
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardErrorCardType, CardErrorReport, CardErrorStatus, User
from src.repositories.card_error import CardErrorReportRepository

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def card_error_user(db_session: AsyncSession) -> User:
    """Create a user for card error testing."""
    user = User(
        email="card_error_test@example.com",
        full_name="Card Error Tester",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def other_user(db_session: AsyncSession) -> User:
    """Create another user for testing isolation."""
    user = User(
        email="other_user@example.com",
        full_name="Other User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def pending_report(
    db_session: AsyncSession,
    card_error_user: User,
) -> CardErrorReport:
    """Create a pending card error report."""
    report = CardErrorReport(
        card_id=uuid4(),
        card_type=CardErrorCardType.WORD,
        user_id=card_error_user.id,
        description="Test error description with enough content.",
        status=CardErrorStatus.PENDING,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.refresh(report)
    return report


@pytest.fixture
async def fixed_report(
    db_session: AsyncSession,
    card_error_user: User,
) -> CardErrorReport:
    """Create a FIXED card error report."""
    report = CardErrorReport(
        card_id=uuid4(),
        card_type=CardErrorCardType.WORD,
        user_id=card_error_user.id,
        description="Test error description with enough content.",
        status=CardErrorStatus.FIXED,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.refresh(report)
    return report


@pytest.fixture
async def reviewed_report(
    db_session: AsyncSession,
    card_error_user: User,
) -> CardErrorReport:
    """Create a REVIEWED card error report."""
    report = CardErrorReport(
        card_id=uuid4(),
        card_type=CardErrorCardType.WORD,
        user_id=card_error_user.id,
        description="Test error description with enough content.",
        status=CardErrorStatus.REVIEWED,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.refresh(report)
    return report


@pytest.fixture
async def dismissed_report(
    db_session: AsyncSession,
    card_error_user: User,
) -> CardErrorReport:
    """Create a DISMISSED card error report."""
    report = CardErrorReport(
        card_id=uuid4(),
        card_type=CardErrorCardType.WORD,
        user_id=card_error_user.id,
        description="Test error description with enough content.",
        status=CardErrorStatus.DISMISSED,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.refresh(report)
    return report


@pytest.fixture
async def culture_pending_report(
    db_session: AsyncSession,
    card_error_user: User,
) -> CardErrorReport:
    """Create a pending CULTURE card error report."""
    report = CardErrorReport(
        card_id=uuid4(),
        card_type=CardErrorCardType.CULTURE,
        user_id=card_error_user.id,
        description="Test culture error description with enough content.",
        status=CardErrorStatus.PENDING,
    )
    db_session.add(report)
    await db_session.flush()
    await db_session.refresh(report)
    return report


# =============================================================================
# Test get_pending_report_for_card
# =============================================================================


class TestGetPendingReportForCard:
    """Tests for get_pending_report_for_card method."""

    @pytest.mark.asyncio
    async def test_returns_pending_report_when_exists(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        pending_report: CardErrorReport,
    ):
        """Should return the pending report when one exists."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=pending_report.card_id,
            card_type=pending_report.card_type,
            user_id=card_error_user.id,
        )

        assert result is not None
        assert result.id == pending_report.id
        assert result.status == CardErrorStatus.PENDING

    @pytest.mark.asyncio
    async def test_returns_none_when_no_report_exists(
        self,
        db_session: AsyncSession,
        card_error_user: User,
    ):
        """Should return None when user has no report for the card."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=uuid4(),
            card_type=CardErrorCardType.WORD,
            user_id=card_error_user.id,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_fixed_report(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        fixed_report: CardErrorReport,
    ):
        """Should return None when user's report exists but has FIXED status."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=fixed_report.card_id,
            card_type=fixed_report.card_type,
            user_id=card_error_user.id,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_reviewed_report(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        reviewed_report: CardErrorReport,
    ):
        """Should return None when user's report exists but has REVIEWED status."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=reviewed_report.card_id,
            card_type=reviewed_report.card_type,
            user_id=card_error_user.id,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_dismissed_report(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        dismissed_report: CardErrorReport,
    ):
        """Should return None when user's report exists but has DISMISSED status."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=dismissed_report.card_id,
            card_type=dismissed_report.card_type,
            user_id=card_error_user.id,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_different_user(
        self,
        db_session: AsyncSession,
        other_user: User,
        pending_report: CardErrorReport,
    ):
        """Should return None when checking for different user's card."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=pending_report.card_id,
            card_type=pending_report.card_type,
            user_id=other_user.id,  # Different user
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_different_card_type(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        pending_report: CardErrorReport,
    ):
        """Should return None when card_type doesn't match."""
        repo = CardErrorReportRepository(db_session)

        # pending_report is WORD, query for CULTURE
        result = await repo.get_pending_report_for_card(
            card_id=pending_report.card_id,
            card_type=CardErrorCardType.CULTURE,  # Different type
            user_id=card_error_user.id,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_works_with_culture_card_type(
        self,
        db_session: AsyncSession,
        card_error_user: User,
        culture_pending_report: CardErrorReport,
    ):
        """Should correctly handle CULTURE card type."""
        repo = CardErrorReportRepository(db_session)

        result = await repo.get_pending_report_for_card(
            card_id=culture_pending_report.card_id,
            card_type=CardErrorCardType.CULTURE,
            user_id=card_error_user.id,
        )

        assert result is not None
        assert result.id == culture_pending_report.id
        assert result.card_type == CardErrorCardType.CULTURE
        assert result.status == CardErrorStatus.PENDING
