"""Unit tests for src.tasks.description_audio.

Mirrors test_picture_generation.py in structure and mocking style.
asyncio_mode = "auto" in pyproject.toml — no @pytest.mark.asyncio needed.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.config import settings
from src.tasks.description_audio import generate_description_audio_task


class TestGenerateDescriptionAudioTask:
    """Unit tests for generate_description_audio_task."""

    async def test_gate_disabled_skips_pipeline(self):
        """When feature_background_tasks is False, pipeline is never awaited."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch("src.tasks.description_audio.get_session_factory") as mock_factory_fn:
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service"
                    ) as mock_service_fn:
                        with patch("src.tasks.description_audio.logger") as mock_logger:
                            result = await generate_description_audio_task(
                                situation_id=situation_id, level="b1"
                            )

        assert result is None
        mock_pipeline.assert_not_awaited()
        mock_factory_fn.assert_not_called()
        mock_service_fn.assert_not_called()
        mock_logger.debug.assert_called_once()

    async def test_gate_disabled_skips_pipeline_a2_level(self):
        """Gate check applies regardless of level parameter."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch("src.tasks.description_audio.get_session_factory"):
                    result = await generate_description_audio_task(
                        situation_id=situation_id, level="a2"
                    )

        assert result is None
        mock_pipeline.assert_not_awaited()

    async def test_happy_path_invokes_pipeline_with_correct_args(self):
        """Happy path: pipeline is awaited with situation_id, level, factory, audio_service."""
        situation_id = uuid4()
        mock_factory = MagicMock()
        mock_audio_service = MagicMock()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch(
                    "src.tasks.description_audio.get_session_factory",
                    return_value=mock_factory,
                ):
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service",
                        return_value=mock_audio_service,
                    ):
                        await generate_description_audio_task(situation_id=situation_id, level="b1")

        mock_pipeline.assert_awaited_once()
        call_args = mock_pipeline.call_args[0]
        assert call_args[0] == situation_id
        assert call_args[1] == "b1"
        assert call_args[2] is mock_factory
        assert call_args[3] is mock_audio_service

    async def test_happy_path_a2_level_passed_to_pipeline(self):
        """Pipeline receives the 'a2' level argument when called with level='a2'."""
        situation_id = uuid4()
        mock_factory = MagicMock()
        mock_audio_service = MagicMock()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ) as mock_pipeline:
                with patch(
                    "src.tasks.description_audio.get_session_factory",
                    return_value=mock_factory,
                ):
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service",
                        return_value=mock_audio_service,
                    ):
                        await generate_description_audio_task(situation_id=situation_id, level="a2")

        call_args = mock_pipeline.call_args[0]
        assert call_args[1] == "a2"

    async def test_pipeline_exception_is_swallowed(self):
        """Exception from pipeline is caught, logged with exc_info=True, not re-raised."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
                side_effect=RuntimeError("pipeline boom"),
            ):
                with patch(
                    "src.tasks.description_audio.get_session_factory",
                    return_value=MagicMock(),
                ):
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service",
                        return_value=MagicMock(),
                    ):
                        with patch("src.tasks.description_audio.logger") as mock_logger:
                            result = await generate_description_audio_task(
                                situation_id=situation_id, level="b1"
                            )

        assert result is None
        mock_logger.error.assert_called_once()
        error_kwargs = mock_logger.error.call_args[1]
        assert error_kwargs.get("exc_info") is True
        assert error_kwargs.get("extra", {}).get("situation_id") == str(situation_id)

    async def test_pipeline_exception_extra_includes_level(self):
        """Error log extra dict must include the level for observability."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
                side_effect=ValueError("bad level handling"),
            ):
                with patch(
                    "src.tasks.description_audio.get_session_factory",
                    return_value=MagicMock(),
                ):
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service",
                        return_value=MagicMock(),
                    ):
                        with patch("src.tasks.description_audio.logger") as mock_logger:
                            await generate_description_audio_task(
                                situation_id=situation_id, level="a2"
                            )

        error_kwargs = mock_logger.error.call_args[1]
        assert error_kwargs.get("extra", {}).get("level") == "a2"

    async def test_get_session_factory_failure_is_swallowed(self):
        """RuntimeError from get_session_factory is caught; pipeline is never awaited."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.get_session_factory",
                side_effect=RuntimeError("DB not initialized"),
            ):
                with patch(
                    "src.tasks.description_audio.run_description_audio_pipeline",
                    new_callable=AsyncMock,
                ) as mock_pipeline:
                    with patch("src.tasks.description_audio.logger") as mock_logger:
                        result = await generate_description_audio_task(
                            situation_id=situation_id, level="b1"
                        )

        assert result is None
        mock_pipeline.assert_not_awaited()
        mock_logger.error.assert_called_once()

    async def test_get_audio_service_failure_is_swallowed(self):
        """RuntimeError from get_audio_generation_service is caught; pipeline not called."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.get_session_factory",
                return_value=MagicMock(),
            ):
                with patch(
                    "src.tasks.description_audio.get_audio_generation_service",
                    side_effect=RuntimeError("service init failed"),
                ):
                    with patch(
                        "src.tasks.description_audio.run_description_audio_pipeline",
                        new_callable=AsyncMock,
                    ) as mock_pipeline:
                        with patch("src.tasks.description_audio.logger") as mock_logger:
                            result = await generate_description_audio_task(
                                situation_id=situation_id, level="b1"
                            )

        assert result is None
        mock_pipeline.assert_not_awaited()
        mock_logger.error.assert_called_once()

    async def test_returns_none_on_success(self):
        """Task always returns None on the happy path (fire-and-forget)."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", True):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ):
                with patch(
                    "src.tasks.description_audio.get_session_factory",
                    return_value=MagicMock(),
                ):
                    with patch(
                        "src.tasks.description_audio.get_audio_generation_service",
                        return_value=MagicMock(),
                    ):
                        result = await generate_description_audio_task(
                            situation_id=situation_id, level="b1"
                        )

        assert result is None

    async def test_debug_log_includes_situation_id_and_level_when_disabled(self):
        """Debug log on feature-gate bypass must include situation_id and level extras."""
        situation_id = uuid4()

        with patch.object(settings, "feature_background_tasks", False):
            with patch(
                "src.tasks.description_audio.run_description_audio_pipeline",
                new_callable=AsyncMock,
            ):
                with patch("src.tasks.description_audio.get_session_factory"):
                    with patch("src.tasks.description_audio.logger") as mock_logger:
                        await generate_description_audio_task(situation_id=situation_id, level="b1")

        mock_logger.debug.assert_called_once()
        debug_kwargs = mock_logger.debug.call_args[1]
        assert debug_kwargs.get("extra", {}).get("situation_id") == str(situation_id)
        assert debug_kwargs.get("extra", {}).get("level") == "b1"
