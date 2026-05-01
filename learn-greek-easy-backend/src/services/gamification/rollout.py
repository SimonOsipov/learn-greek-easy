"""User-id-hash gate for staged reconcile-on-read rollout.

Deterministic: the same user_id always lands in/out of rollout for a given
percent. Monotonic expansion: anyone in at percent=N is also in at percent>N
(a property of the hash-mod approach — sha256 distribution is uniform).
"""

import hashlib
from uuid import UUID

from src.config import settings


def is_user_in_reconcile_rollout(user_id: UUID) -> bool:
    """Return True if the user is in the reconcile-on-read rollout cohort.

    Gates on:
    1. ``gamification_reconcile_on_read`` master switch must be True.
    2. ``gamification_reconcile_rollout_percent`` controls cohort size (0-100).

    Uses sha256(str(user_id)) % 100 for a stable, uniform bucket assignment.
    """
    if not settings.gamification_reconcile_on_read:
        return False
    percent = settings.gamification_reconcile_rollout_percent
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    bucket = int(hashlib.sha256(str(user_id).encode()).hexdigest(), 16) % 100
    return bucket < percent


__all__ = ["is_user_in_reconcile_rollout"]
