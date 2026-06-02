"""Unit tests for heatmap intensity bucketing."""

import pytest

from src.utils.heatmap import bucket_heatmap_intensity


@pytest.mark.parametrize(
    "count,expected",
    [
        (0, 0),
        (-3, 0),
        (1, 1),
        (2, 1),
        (3, 2),
        (4, 2),
        (5, 3),
        (7, 3),
        (8, 4),
        (12, 4),
        (13, 5),
        (100, 5),
    ],
)
def test_bucket_boundaries(count: int, expected: int) -> None:
    assert bucket_heatmap_intensity(count) == expected
