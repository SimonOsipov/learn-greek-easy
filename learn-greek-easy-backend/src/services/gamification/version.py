GAMIFICATION_PROJECTION_VERSION: int = 1
"""Bump on any projection logic change (new metric, threshold, formula).
Reconciler invalidates and recomputes when reading stale-version snapshots."""
