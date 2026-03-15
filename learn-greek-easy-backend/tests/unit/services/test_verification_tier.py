"""Unit tests for compute_combined_tier() routing logic."""

import pytest

from src.services.verification_tier import compute_combined_tier, compute_combined_tier_v2


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


@pytest.mark.unit
class TestComputeCombinedTierV2:
    """Tests for compute_combined_tier_v2 (4-source decision matrix)."""

    @pytest.mark.parametrize(
        "local1_tier,local2_tier,cross_ai_agreement,expected",
        [
            # Both auto + high AI -> auto (AI doesn't override local agreement)
            ("auto_approve", "auto_approve", 0.95, "auto_approve"),
            # Both auto + low AI -> auto (local sources dominate)
            ("auto_approve", "auto_approve", 0.50, "auto_approve"),
            # L1 auto + L2 quick -> quick (L2 veto)
            ("auto_approve", "quick_review", 0.95, "quick_review"),
            # L1 quick + L2 auto -> quick (L1 veto)
            ("quick_review", "auto_approve", 0.95, "quick_review"),
            # Both non-auto -> manual
            ("quick_review", "quick_review", 0.95, "manual_review"),
            # Either manual -> manual
            ("manual_review", "auto_approve", 0.95, "manual_review"),
            # L2 None -> fall back to v1 logic (L1=auto + 0.95 -> auto)
            ("auto_approve", None, 0.95, "auto_approve"),
            # L2 None -> fall back to v1 logic (L1=auto + 0.50 -> manual_review, row 3 of v1)
            ("auto_approve", None, 0.50, "manual_review"),
            # L1 None -> manual regardless
            (None, "auto_approve", 0.95, "manual_review"),
        ],
    )
    def test_decision_matrix(
        self,
        local1_tier: str | None,
        local2_tier: str | None,
        cross_ai_agreement: float,
        expected: str,
    ) -> None:
        """Test all matrix cells for compute_combined_tier_v2."""
        result = compute_combined_tier_v2(local1_tier, local2_tier, cross_ai_agreement)
        assert result == expected

    def test_existing_compute_combined_tier_unchanged(self) -> None:
        """Ensure original function is not modified."""
        assert compute_combined_tier("auto_approve", 0.95) == "auto_approve"
        assert compute_combined_tier(None, 0.95) == "manual_review"
