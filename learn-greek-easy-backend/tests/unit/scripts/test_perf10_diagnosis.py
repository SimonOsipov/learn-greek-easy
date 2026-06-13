"""Unit tests for PERF-10-01: per-query baseline harness + config probe.

All tests are pure unit tests — no database, no real Redis.
External dependencies are replaced with MagicMock / patch.

Covers (RED before executor fills in real logic):
- AC1: measure_query_baseline returns a dict with the three expected numeric keys.
- AC2a: probe_config_engagement reports cache_live=False when get_redis() returns None.
- AC2b: probe_config_engagement reports cache_live=True when get_redis() returns a client.
- AC2c: probe_config_engagement echoes feature_background_tasks and database_pool_warm_min
        from settings.
"""

from unittest.mock import MagicMock, patch

import pytest

from src.scripts.perf10_diagnosis import measure_query_baseline, probe_config_engagement


@pytest.mark.unit
class TestBaselineHarness:
    """AC1 — measure_query_baseline must return the three timing keys."""

    def test_baseline_harness_reports_three_modes(self) -> None:
        """measure_query_baseline result has direct_ms, pooled_preping_ms,
        pooled_no_preping_ms — all non-negative numbers."""
        # Provide a mock engine; real DB connection is not needed for the
        # unit contract (the executor is responsible for making the real call).
        mock_engine = MagicMock()

        result = measure_query_baseline(mock_engine)

        assert isinstance(result, dict), "Result must be a dict"
        for key in ("direct_ms", "pooled_preping_ms", "pooled_no_preping_ms"):
            assert key in result, f"Missing key: {key}"
            assert isinstance(
                result[key], (int, float)
            ), f"{key} must be numeric, got {type(result[key])}"
            assert result[key] >= 0, f"{key} must be non-negative, got {result[key]}"


@pytest.mark.unit
class TestConfigProbe:
    """AC2 — probe_config_engagement must reflect Redis liveness and settings values."""

    def test_config_probe_reports_cache_live_flag_false_when_redis_none(self) -> None:
        """When get_redis() returns None (degraded mode), cache_live must be False."""
        with patch("src.scripts.perf10_diagnosis.get_redis", return_value=None):
            result = probe_config_engagement()

        assert "cache_live" in result, "Result must contain 'cache_live'"
        assert (
            result["cache_live"] is False
        ), f"Expected cache_live=False when Redis is unavailable, got {result['cache_live']}"

    def test_config_probe_reports_cache_live_flag_true_when_redis_available(self) -> None:
        """When get_redis() returns a mock client, cache_live must be True."""
        mock_redis = MagicMock()
        with patch("src.scripts.perf10_diagnosis.get_redis", return_value=mock_redis):
            result = probe_config_engagement()

        assert "cache_live" in result, "Result must contain 'cache_live'"
        assert (
            result["cache_live"] is True
        ), f"Expected cache_live=True when Redis client is present, got {result['cache_live']}"

    def test_config_probe_reports_bg_and_warm(self) -> None:
        """probe_config_engagement echoes feature_background_tasks and
        database_pool_warm_min from settings."""
        mock_redis = MagicMock()

        # Patch settings to known values so the assertion is deterministic.
        with (
            patch("src.scripts.perf10_diagnosis.get_redis", return_value=mock_redis),
            patch("src.scripts.perf10_diagnosis.settings") as mock_settings,
        ):
            mock_settings.feature_background_tasks = True
            mock_settings.database_pool_warm_min = 7

            result = probe_config_engagement()

        assert (
            "feature_background_tasks" in result
        ), "Result must contain 'feature_background_tasks'"
        assert "database_pool_warm_min" in result, "Result must contain 'database_pool_warm_min'"
        assert (
            result["feature_background_tasks"] is True
        ), f"Expected feature_background_tasks=True, got {result['feature_background_tasks']}"
        assert (
            result["database_pool_warm_min"] == 7
        ), f"Expected database_pool_warm_min=7, got {result['database_pool_warm_min']}"
