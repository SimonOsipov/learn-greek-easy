"""Tests for startup auto-seeding.

Tests cover:
- SEED_ON_DEPLOY behavior in lifespan
- Auto-seeding runs when enabled
- Auto-seeding skipped when disabled
- Startup continues if seed fails
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestStartupSeeding:
    """Tests for SEED_ON_DEPLOY startup hook."""

    @pytest.mark.asyncio
    async def test_auto_seed_runs_when_enabled(self):
        """Should auto-seed when SEED_ON_DEPLOY=true and can_seed_database=true."""
        mock_service_instance = AsyncMock()
        mock_service_instance.seed_all.return_value = {
            "users": {"users": [{"email": "test@test.com"}]},
            "content": {"decks": [{"name": "Test"}]},
        }

        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        mock_factory = MagicMock()
        mock_factory.return_value = mock_session

        with patch("src.main.settings") as mock_settings:
            mock_settings.seed_on_deploy = True
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_version = "0.1.0"
            mock_settings.validate_cors_for_production.return_value = []

            with patch("src.main.init_db", new_callable=AsyncMock):
                with patch("src.main.init_redis", new_callable=AsyncMock):
                    with patch("src.main.close_db", new_callable=AsyncMock):
                        with patch("src.main.close_redis", new_callable=AsyncMock):
                            # Patch where the imports happen (inside lifespan)
                            with patch("src.db.get_session_factory", return_value=mock_factory):
                                with patch(
                                    "src.services.seed_service.SeedService"
                                ) as mock_service_class:
                                    mock_service_class.return_value = mock_service_instance

                                    # Import and run lifespan
                                    from src.main import lifespan

                                    # Need to create a mock app
                                    mock_app = MagicMock()

                                    async with lifespan(mock_app):
                                        # Verify seed_all was called
                                        mock_service_instance.seed_all.assert_called_once()

    @pytest.mark.asyncio
    async def test_auto_seed_skipped_when_seed_on_deploy_false(self):
        """Should skip auto-seed when SEED_ON_DEPLOY=false."""
        mock_service_instance = AsyncMock()

        with patch("src.main.settings") as mock_settings:
            mock_settings.seed_on_deploy = False
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_version = "0.1.0"
            mock_settings.validate_cors_for_production.return_value = []

            with patch("src.main.init_db", new_callable=AsyncMock):
                with patch("src.main.init_redis", new_callable=AsyncMock):
                    with patch("src.main.close_db", new_callable=AsyncMock):
                        with patch("src.main.close_redis", new_callable=AsyncMock):
                            with patch(
                                "src.services.seed_service.SeedService"
                            ) as mock_service_class:
                                mock_service_class.return_value = mock_service_instance

                                from src.main import lifespan

                                mock_app = MagicMock()

                                async with lifespan(mock_app):
                                    # Verify seed_all was NOT called
                                    mock_service_instance.seed_all.assert_not_called()

    @pytest.mark.asyncio
    async def test_auto_seed_skipped_when_cannot_seed_database(self):
        """Should skip auto-seed when can_seed_database returns false."""
        mock_service_instance = AsyncMock()

        with patch("src.main.settings") as mock_settings:
            mock_settings.seed_on_deploy = True
            mock_settings.can_seed_database.return_value = False
            mock_settings.app_version = "0.1.0"
            mock_settings.validate_cors_for_production.return_value = []

            with patch("src.main.init_db", new_callable=AsyncMock):
                with patch("src.main.init_redis", new_callable=AsyncMock):
                    with patch("src.main.close_db", new_callable=AsyncMock):
                        with patch("src.main.close_redis", new_callable=AsyncMock):
                            with patch(
                                "src.services.seed_service.SeedService"
                            ) as mock_service_class:
                                mock_service_class.return_value = mock_service_instance

                                from src.main import lifespan

                                mock_app = MagicMock()

                                async with lifespan(mock_app):
                                    # Verify seed_all was NOT called
                                    mock_service_instance.seed_all.assert_not_called()

    @pytest.mark.asyncio
    async def test_startup_continues_if_seed_fails(self):
        """Startup should continue even if auto-seed fails."""
        mock_service_instance = AsyncMock()
        mock_service_instance.seed_all.side_effect = Exception("Seed failed!")

        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        mock_factory = MagicMock()
        mock_factory.return_value = mock_session

        with patch("src.main.settings") as mock_settings:
            mock_settings.seed_on_deploy = True
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_version = "0.1.0"
            mock_settings.validate_cors_for_production.return_value = []

            with patch("src.main.init_db", new_callable=AsyncMock):
                with patch("src.main.init_redis", new_callable=AsyncMock):
                    with patch("src.main.close_db", new_callable=AsyncMock):
                        with patch("src.main.close_redis", new_callable=AsyncMock):
                            with patch("src.db.get_session_factory", return_value=mock_factory):
                                with patch(
                                    "src.services.seed_service.SeedService"
                                ) as mock_service_class:
                                    mock_service_class.return_value = mock_service_instance

                                    from src.main import lifespan

                                    mock_app = MagicMock()

                                    # Should NOT raise - startup should continue
                                    async with lifespan(mock_app):
                                        pass

                                    # Verify seed_all was attempted
                                    mock_service_instance.seed_all.assert_called_once()

    @pytest.mark.asyncio
    async def test_auto_seed_logs_completion(self):
        """Should log completion message after successful seed."""
        mock_service_instance = AsyncMock()
        mock_service_instance.seed_all.return_value = {
            "users": {"users": [{"email": "u1@test.com"}, {"email": "u2@test.com"}]},
            "content": {"decks": [{"name": "A1"}, {"name": "A2"}, {"name": "B1"}]},
        }

        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None

        mock_factory = MagicMock()
        mock_factory.return_value = mock_session

        with patch("src.main.settings") as mock_settings:
            mock_settings.seed_on_deploy = True
            mock_settings.can_seed_database.return_value = True
            mock_settings.app_version = "0.1.0"
            mock_settings.validate_cors_for_production.return_value = []

            with patch("src.main.init_db", new_callable=AsyncMock):
                with patch("src.main.init_redis", new_callable=AsyncMock):
                    with patch("src.main.close_db", new_callable=AsyncMock):
                        with patch("src.main.close_redis", new_callable=AsyncMock):
                            with patch("src.db.get_session_factory", return_value=mock_factory):
                                with patch(
                                    "src.services.seed_service.SeedService"
                                ) as mock_service_class:
                                    mock_service_class.return_value = mock_service_instance

                                    with patch("src.main.logger") as mock_logger:
                                        from src.main import lifespan

                                        mock_app = MagicMock()

                                        async with lifespan(mock_app):
                                            pass

                                        # Verify completion was logged (loguru uses kwargs, not extra={})
                                        mock_logger.info.assert_any_call(
                                            "Auto-seed completed",
                                            users_created=2,
                                            decks_created=3,
                                        )
