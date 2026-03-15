"""Combined verification tier routing logic.

Implements the 7-row decision matrix that combines local verification tier
with cross-AI agreement score to produce a final routing decision.
"""

from typing import Literal

VerificationTier = Literal["auto_approve", "quick_review", "manual_review"]


def compute_combined_tier(
    local_tier: VerificationTier | None,
    cross_ai_agreement: float | None,
) -> VerificationTier:
    """Compute combined verification tier from local tier and cross-AI agreement.

    Decision matrix (7 rows):
    | Local Tier     | Cross-AI Agreement | Combined Decision |
    |----------------|-------------------|-------------------|
    | auto_approve   | >= 0.90           | auto_approve      |
    | auto_approve   | 0.70 - 0.89       | quick_review      |
    | auto_approve   | < 0.70            | manual_review     |
    | quick_review   | >= 0.70           | quick_review      |
    | quick_review   | < 0.70            | manual_review     |
    | manual_review  | any               | manual_review     |
    | any            | error/unavailable | use local tier    |

    Args:
        local_tier: Result from LocalVerificationService. None if local verification failed.
        cross_ai_agreement: Overall agreement score (0.0-1.0) from CrossAIVerificationResult.
            None if cross-AI verification failed or was unavailable.

    Returns:
        Final combined tier decision.
    """
    # None local_tier -> safest fallback
    if local_tier is None:
        return "manual_review"

    # Row 6: manual_review + any -> manual_review (short-circuit)
    if local_tier == "manual_review":
        return "manual_review"

    # Row 7: cross-AI error/unavailable -> use local tier only
    if cross_ai_agreement is None:
        return local_tier

    # Defensive fallback for malformed upstream values
    if not 0.0 <= cross_ai_agreement <= 1.0:
        return "manual_review"

    # Rows 1-5: both available
    if local_tier == "auto_approve":
        if cross_ai_agreement >= 0.90:
            return "auto_approve"  # Row 1
        if cross_ai_agreement >= 0.70:
            return "quick_review"  # Row 2
        return "manual_review"  # Row 3

    # local_tier == "quick_review"
    if cross_ai_agreement >= 0.70:
        return "quick_review"  # Row 4
    return "manual_review"  # Row 5


def compute_combined_tier_v2(
    local1_tier: VerificationTier | None,
    local2_tier: VerificationTier | None,
    cross_ai_agreement: float | None,
) -> VerificationTier:
    """Compute combined verification tier from two local sources plus cross-AI.

    When L2 is None (no wiktionary data), falls back to the existing
    compute_combined_tier(L1, AI) for backward compatibility.
    """
    if local2_tier is None:
        return compute_combined_tier(local1_tier, cross_ai_agreement)
    if local1_tier is None:
        return "manual_review"
    if local1_tier == "manual_review" or local2_tier == "manual_review":
        return "manual_review"
    if local1_tier == "auto_approve" and local2_tier == "auto_approve":
        return "auto_approve"
    # One auto + one non-auto, or both quick_review
    if local1_tier == "auto_approve" or local2_tier == "auto_approve":
        return "quick_review"
    return "manual_review"
