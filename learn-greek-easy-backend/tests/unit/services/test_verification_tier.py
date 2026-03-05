"""Unit tests for compute_combined_tier() routing logic."""

import pytest

from src.services.verification_tier import compute_combined_tier


@pytest.mark.unit
class TestComputeCombinedTier:
    """Tests for the 7-row combined tier routing matrix."""

    @pytest.mark.parametrize(
        "local_tier,agreement,expected",
        [
            # Row 1: auto_approve + high agreement
            ("auto_approve", 0.95, "auto_approve"),
            ("auto_approve", 1.0, "auto_approve"),
            # Row 2: auto_approve + medium agreement
            ("auto_approve", 0.80, "quick_review"),
            ("auto_approve", 0.89, "quick_review"),
            # Row 3: auto_approve + low agreement
            ("auto_approve", 0.50, "manual_review"),
            ("auto_approve", 0.0, "manual_review"),
            # Row 4: quick_review + high/medium agreement
            ("quick_review", 0.85, "quick_review"),
            ("quick_review", 1.0, "quick_review"),
            # Row 5: quick_review + low agreement
            ("quick_review", 0.50, "manual_review"),
            ("quick_review", 0.0, "manual_review"),
            # Row 6: manual_review + any
            ("manual_review", 0.0, "manual_review"),
            ("manual_review", 1.0, "manual_review"),
            ("manual_review", None, "manual_review"),
            # Row 7: cross-AI unavailable -> use local tier
            ("auto_approve", None, "auto_approve"),
            ("quick_review", None, "quick_review"),
            # Edge: None local_tier -> manual_review
            (None, 0.95, "manual_review"),
            (None, None, "manual_review"),
        ],
    )
    def test_routing_matrix(
        self, local_tier: str | None, agreement: float | None, expected: str
    ) -> None:
        assert compute_combined_tier(local_tier, agreement) == expected

    def test_boundary_090_is_auto_approve(self) -> None:
        """Exactly 0.90 should be auto_approve (inclusive lower bound of row 1)."""
        assert compute_combined_tier("auto_approve", 0.90) == "auto_approve"

    def test_boundary_089_is_quick_review(self) -> None:
        """0.89 should be quick_review (just below row 1 threshold)."""
        assert compute_combined_tier("auto_approve", 0.89) == "quick_review"

    def test_boundary_070_auto_approve_is_quick_review(self) -> None:
        """Exactly 0.70 with auto_approve local should be quick_review (inclusive lower bound of row 2)."""
        assert compute_combined_tier("auto_approve", 0.70) == "quick_review"

    def test_boundary_069_auto_approve_is_manual_review(self) -> None:
        """0.69 with auto_approve should be manual_review."""
        assert compute_combined_tier("auto_approve", 0.69) == "manual_review"

    def test_boundary_070_quick_review_stays(self) -> None:
        """Exactly 0.70 with quick_review local should stay quick_review."""
        assert compute_combined_tier("quick_review", 0.70) == "quick_review"

    def test_boundary_069_quick_review_is_manual(self) -> None:
        """0.69 with quick_review should become manual_review."""
        assert compute_combined_tier("quick_review", 0.69) == "manual_review"
