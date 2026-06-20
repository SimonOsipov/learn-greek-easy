"""Unit tests for FrequencyService (LEXGEN-05-03) — RED specs.

Tests cover:
- get_frequency_rank(): present lemma returns int rank, absent returns None
- band_for_rank(): boundary conditions and None input
- get_frequency_band(): combines rank lookup + band classification
- get_frequency_rank(): verifies the DB query targets the correct table/column

These tests use a mocked AsyncSession — no real database required.
The service module does not exist yet; all tests are expected to FAIL with
ImportError until the executor implements frequency_service.py.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.frequency_service import FrequencyService, band_for_rank

# ============================================================================
# Helpers
# ============================================================================


def _make_mock_session(scalar_value):
    """Return a mocked AsyncSession whose execute returns scalar_one_or_none."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = scalar_value

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    return mock_session


# ============================================================================
# get_frequency_rank() Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestGetFrequencyRank:
    """Tests for FrequencyService.get_frequency_rank()."""

    async def test_get_frequency_rank_present(self):
        """When the lemma exists, returns its integer rank."""
        mock_session = _make_mock_session(scalar_value=7)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_rank("σπίτι")

        assert result == 7

    async def test_get_frequency_rank_absent_returns_none(self):
        """When the lemma is not in the table, returns None."""
        mock_session = _make_mock_session(scalar_value=None)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_rank("ξυζω")

        assert result is None

    async def test_get_frequency_rank_queries_reference_table_by_lemma(self):
        """The SELECT statement filters on FrequencyRank.lemma in the reference schema."""
        mock_session = _make_mock_session(scalar_value=42)
        service = FrequencyService(mock_session)

        await service.get_frequency_rank("σπίτι")

        mock_session.execute.assert_awaited_once()
        stmt = mock_session.execute.call_args[0][0]
        stmt_lower = str(stmt).lower()
        # The compiled WHERE clause must reference the reference.frequency_rank.lemma column
        assert (
            "frequency_rank.lemma" in stmt_lower
        ), f"Expected 'frequency_rank.lemma' in compiled SQL but got: {stmt_lower!r}"
        # The bound parameter value must be the exact lemma passed by the caller
        compiled = stmt.compile()
        bound_params = compiled.params
        assert (
            "σπίτι" in bound_params.values()
        ), f"Expected 'σπίτι' as a bound parameter but params were: {bound_params!r}"


# ============================================================================
# band_for_rank() Tests — pure function, no session
# ============================================================================


@pytest.mark.unit
class TestBandForRank:
    """Tests for the pure band_for_rank() function."""

    def test_band_for_rank_boundaries(self):
        """Verify boundary values for all three bands."""
        cases = [
            (1, "common"),  # minimum possible rank -> common
            (2000, "common"),  # COMMON_MAX_RANK boundary -> still common
            (2001, "mid"),  # first mid rank
            (8000, "mid"),  # MID_MAX_RANK boundary -> still mid
            (8001, "rare"),  # first rare rank
        ]
        for rank, expected_band in cases:
            result = band_for_rank(rank)
            assert (
                result == expected_band
            ), f"band_for_rank({rank}) should be {expected_band!r} but got {result!r}"

    def test_band_for_rank_none_input(self):
        """When rank is None (lemma not in frequency table), returns None."""
        result = band_for_rank(None)
        assert result is None


# ============================================================================
# get_frequency_band() Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
class TestGetFrequencyBand:
    """Tests for FrequencyService.get_frequency_band()."""

    async def test_get_frequency_band_present(self):
        """When the lemma has a rank of 1500, band is 'common'."""
        mock_session = _make_mock_session(scalar_value=1500)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_band("σπίτι")

        assert result == "common"

    async def test_get_frequency_band_absent_returns_none(self):
        """When the lemma is not in the table (rank=None), band is None."""
        mock_session = _make_mock_session(scalar_value=None)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_band("ξυζω")

        assert result is None
