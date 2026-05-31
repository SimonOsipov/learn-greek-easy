"""Unit tests for src.tasks.picture_generation."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.config import settings
from src.services.situation_picture_service import PictureGenerationError
from src.tasks.picture_generation import generate_picture_task


def _make_mock_session_factory():
    """Return a minimal async_sessionmaker-like mock with .begin() support."""
    mock_factory = MagicMock()
    mock_factory.begin.return_value.__aenter__ = AsyncMock(return_value=AsyncMock())
    mock_factory.begin.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_factory


class TestGeneratePictureTask:
    """Unit tests for generate_picture_task."""

    async def test_gate_disabled_skips_orchestrator(self):
        """When feature_background_tasks is False, pipeline is never awaited."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch(
                "src.tasks.picture_generation.run_picture_generation_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch("src.tasks.picture_generation.get_session_factory") as mock_factory_fn:
                    with patch("src.tasks.picture_generation.logger") as mock_logger:
                        result = await generate_picture_task(situation_id=situation_id)

        assert result is None
        mock_pipeline.assert_not_awaited()
        mock_factory_fn.assert_not_called()
        mock_logger.debug.assert_called_once()

    async def test_happy_path_invokes_pipeline_with_global_factory(self):
        """Happy path: pipeline is awaited with the global session factory."""
        situation_id = uuid4()

        mock_factory = _make_mock_session_factory()
        openrouter_sentinel = MagicMock()
        s3_sentinel = MagicMock()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.picture_generation.run_picture_generation_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch(
                    "src.tasks.picture_generation.get_session_factory",
                    return_value=mock_factory,
                ):
                    with patch(
                        "src.tasks.picture_generation.get_openrouter_service",
                        return_value=openrouter_sentinel,
                    ):
                        with patch(
                            "src.tasks.picture_generation.get_s3_service",
                            return_value=s3_sentinel,
                        ):
                            await generate_picture_task(situation_id=situation_id)

        mock_pipeline.assert_awaited_once()
        call_args = mock_pipeline.call_args
        pos_args = call_args[0]
        assert pos_args[0] == situation_id
        assert pos_args[1] is mock_factory  # factory passed directly
        assert pos_args[2] is openrouter_sentinel
        assert pos_args[3] is s3_sentinel

    async def test_pipeline_raises_picture_generation_error_is_swallowed(self):
        """PictureGenerationError from pipeline is caught, logged, not re-raised."""
        situation_id = uuid4()

        mock_factory = _make_mock_session_factory()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.picture_generation.run_picture_generation_pipeline",
                new_callable=AsyncMock,
                side_effect=PictureGenerationError("boom"),
            ):
                with patch(
                    "src.tasks.picture_generation.get_session_factory",
                    return_value=mock_factory,
                ):
                    with patch(
                        "src.tasks.picture_generation.get_openrouter_service",
                        return_value=MagicMock(),
                    ):
                        with patch(
                            "src.tasks.picture_generation.get_s3_service",
                            return_value=MagicMock(),
                        ):
                            with patch("src.tasks.picture_generation.logger") as mock_logger:
                                result = await generate_picture_task(situation_id=situation_id)

        assert result is None
        mock_logger.error.assert_called_once()
        error_kwargs = mock_logger.error.call_args[1]
        assert error_kwargs.get("exc_info") is True
        assert error_kwargs.get("extra", {}).get("situation_id") == str(situation_id)

    async def test_pipeline_raises_generic_exception_is_swallowed(self):
        """Generic RuntimeError from pipeline is caught, logged, not re-raised."""
        situation_id = uuid4()

        mock_factory = _make_mock_session_factory()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.picture_generation.run_picture_generation_pipeline",
                new_callable=AsyncMock,
                side_effect=RuntimeError("boom"),
            ):
                with patch(
                    "src.tasks.picture_generation.get_session_factory",
                    return_value=mock_factory,
                ):
                    with patch(
                        "src.tasks.picture_generation.get_openrouter_service",
                        return_value=MagicMock(),
                    ):
                        with patch(
                            "src.tasks.picture_generation.get_s3_service",
                            return_value=MagicMock(),
                        ):
                            with patch("src.tasks.picture_generation.logger") as mock_logger:
                                result = await generate_picture_task(situation_id=situation_id)

        assert result is None
        mock_logger.error.assert_called_once()
        error_kwargs = mock_logger.error.call_args[1]
        assert error_kwargs.get("exc_info") is True
        assert error_kwargs.get("extra", {}).get("situation_id") == str(situation_id)

    async def test_factory_retrieval_failure_is_swallowed(self):
        """get_session_factory raising RuntimeError is caught, logged; pipeline not called."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.picture_generation.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                with patch(
                    "src.tasks.picture_generation.run_picture_generation_pipeline",
                    new_callable=AsyncMock,
                ) as mock_pipeline:
                    with patch("src.tasks.picture_generation.logger") as mock_logger:
                        result = await generate_picture_task(situation_id=situation_id)

        assert result is None
        mock_pipeline.assert_not_awaited()
        mock_logger.error.assert_called_once()
