"""Heatmap intensity bucketing shared across activity heatmaps."""


def bucket_heatmap_intensity(count: int) -> int:
    """Map a raw daily review count to a GitHub-style intensity level (0-5).

    Used by both the per-word and deck-level practice heatmaps so they share
    one visual scale.
    """
    if count <= 0:
        return 0
    if count <= 2:
        return 1
    if count <= 4:
        return 2
    if count <= 7:
        return 3
    if count <= 12:
        return 4
    return 5
