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


# ============================================================================
# Edge coverage (LEXGEN-05-03 QA Mode B additions)
# ============================================================================


@pytest.mark.unit
class TestBandForRankDefensiveInputs:
    """Pin the behaviour of band_for_rank() for out-of-range ranks.

    The function is a pure mapping and deliberately does NOT validate that
    rank >= 1; ranks 0 and negative are silently mapped as <= COMMON_MAX_RANK
    and therefore return "common".  This test pins that contract so that any
    future "add rank >= 1 guard" is a conscious, reviewed change.
    """

    def test_band_for_rank_zero_returns_common(self):
        """rank=0 is <= COMMON_MAX_RANK, so the function returns 'common'.

        The guard `rank <= COMMON_MAX_RANK` fires first; the function does
        not validate positivity.  Pinned deliberately (D6 caller normalises).
        """
        assert band_for_rank(0) == "common"

    def test_band_for_rank_negative_returns_common(self):
        """rank=-1 (or any negative) also satisfies <= COMMON_MAX_RANK.

        Same reasoning as rank=0; the function is a pure range mapping.
        """
        assert band_for_rank(-1) == "common"


@pytest.mark.unit
@pytest.mark.asyncio
class TestGetFrequencyBandSingleQuery:
    """get_frequency_band() must issue exactly one DB query.

    Guards against a future refactor where get_frequency_band() queries the DB
    directly instead of delegating to get_frequency_rank().
    """

    async def test_get_frequency_band_issues_exactly_one_db_query(self):
        """Regardless of the result, the session.execute is awaited exactly once."""
        mock_session = _make_mock_session(scalar_value=1500)
        service = FrequencyService(mock_session)

        await service.get_frequency_band("σπίτι")

        # One query in get_frequency_rank(); zero additional queries in
        # get_frequency_band() itself — it only calls band_for_rank().
        assert mock_session.execute.await_count == 1


@pytest.mark.unit
@pytest.mark.asyncio
class TestGetFrequencyBandMidAndRarePaths:
    """Cover the mid and rare band returns through the full service path.

    The AC tests only exercised the 'common' present case and the None case.
    These cover the two remaining band values via the mocked service path
    (i.e., not just the pure band_for_rank() function).
    """

    async def test_get_frequency_band_mid_rank(self):
        """A lemma stored with rank=5000 (in 2001–8000 range) returns 'mid'."""
        mock_session = _make_mock_session(scalar_value=5000)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_band("κάνω")

        assert result == "mid"

    async def test_get_frequency_band_rare_rank(self):
        """A lemma stored with rank=9000 (above MID_MAX_RANK=8000) returns 'rare'."""
        mock_session = _make_mock_session(scalar_value=9000)
        service = FrequencyService(mock_session)

        result = await service.get_frequency_band("σκυλάκι")

        assert result == "rare"

    async def test_get_frequency_band_exactly_at_mid_boundary(self):
        """rank=8001 is the first 'rare' rank; rank=8000 stays 'mid'.

        Cross-check via the service path (not just the pure function) to ensure
        the delegation chain does not introduce an off-by-one.
        """
        mock_mid = _make_mock_session(scalar_value=8000)
        assert await FrequencyService(mock_mid).get_frequency_band("α") == "mid"

        mock_rare = _make_mock_session(scalar_value=8001)
        assert await FrequencyService(mock_rare).get_frequency_band("β") == "rare"


@pytest.mark.unit
@pytest.mark.asyncio
class TestGetFrequencyRankNoNormalization:
    """Pin D6: the service passes the lemma verbatim to the WHERE clause.

    Normalization (NFC + lowercase) is the caller's responsibility.  The
    service must NOT silently lowercase or transform the lemma it receives.
    """

    async def test_get_frequency_rank_passes_lemma_verbatim_no_lowercase(self):
        """An uppercase Greek lemma is forwarded unchanged to the bound parameter.

        If the service were to call .lower() internally, the bound param would
        be 'σπίτι'; this test would catch that regression.
        """
        mock_session = _make_mock_session(scalar_value=None)
        service = FrequencyService(mock_session)
        uppercase_lemma = "ΣΠΊΤΙ"

        await service.get_frequency_rank(uppercase_lemma)

        stmt = mock_session.execute.call_args[0][0]
        compiled = stmt.compile()
        bound_params = compiled.params
        assert uppercase_lemma in bound_params.values(), (
            f"Expected the verbatim lemma {uppercase_lemma!r} in bound params "
            f"but got: {bound_params!r}. "
            "The service must not re-normalise the lemma (D6)."
        )
