"""Unit tests for the Greek lexicon data loading command."""

import sys
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.unit
class TestLoadLexicon:
    """Tests for load_lexicon module."""

    @patch("src.scripts.load_lexicon.get_connection")
    @patch("src.scripts.load_lexicon.DATA_FILE")
    @patch("src.scripts.load_lexicon.gzip")
    def test_load_data_empty_table_loads_successfully(
        self, mock_gzip, mock_data_file, mock_get_conn
    ):
        """Test that data loads successfully when table is empty."""
        from src.scripts.load_lexicon import load_data

        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.side_effect = [(0,), (902033,)]  # empty then loaded
        mock_data_file.exists.return_value = True
        mock_gzip.open.return_value.__enter__ = MagicMock()
        mock_gzip.open.return_value.__exit__ = MagicMock(return_value=False)

        load_data(force=False)

        mock_cursor.copy_expert.assert_called_once()
        mock_conn.commit.assert_called_once()

    @patch("src.scripts.load_lexicon.get_connection")
    def test_load_data_skip_if_populated(self, mock_get_conn):
        """Test that loading is skipped if table is already populated."""
        from src.scripts.load_lexicon import load_data

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (902033,)

        load_data(force=False)

        mock_cursor.copy_expert.assert_not_called()

    @patch("src.scripts.load_lexicon.get_connection")
    @patch("src.scripts.load_lexicon.DATA_FILE")
    @patch("src.scripts.load_lexicon.gzip")
    def test_load_data_force_truncates_and_reloads(self, mock_gzip, mock_data_file, mock_get_conn):
        """Test that --force truncates and reloads data."""
        from src.scripts.load_lexicon import load_data

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.side_effect = [(902033,), (902033,)]
        mock_data_file.exists.return_value = True
        mock_gzip.open.return_value.__enter__ = MagicMock()
        mock_gzip.open.return_value.__exit__ = MagicMock(return_value=False)

        load_data(force=True)

        # Should have called TRUNCATE
        truncate_calls = [
            call for call in mock_cursor.execute.call_args_list if "TRUNCATE" in str(call)
        ]
        assert len(truncate_calls) == 1
        mock_cursor.copy_expert.assert_called_once()
        mock_conn.commit.assert_called_once()

    @patch("src.scripts.load_lexicon.get_connection")
    @patch("src.scripts.load_lexicon.DATA_FILE")
    def test_load_data_file_not_found_exits(self, mock_data_file, mock_get_conn):
        """Test that missing data file causes sys.exit(1)."""
        from src.scripts.load_lexicon import load_data

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (0,)
        mock_data_file.exists.return_value = False

        with pytest.raises(SystemExit) as exc_info:
            load_data(force=False)
        assert exc_info.value.code == 1

    @patch("src.scripts.load_lexicon.get_connection")
    @patch("src.scripts.load_lexicon.DATA_FILE")
    @patch("src.scripts.load_lexicon.gzip")
    def test_load_data_db_error_rolls_back(self, mock_gzip, mock_data_file, mock_get_conn):
        """Test that database errors cause rollback and exit."""
        import psycopg2

        from src.scripts.load_lexicon import load_data

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (0,)
        mock_data_file.exists.return_value = True
        mock_gzip.open.return_value.__enter__ = MagicMock()
        mock_gzip.open.return_value.__exit__ = MagicMock(return_value=False)
        mock_cursor.copy_expert.side_effect = psycopg2.Error("connection failed")

        with pytest.raises(SystemExit) as exc_info:
            load_data(force=False)
        assert exc_info.value.code == 1
        mock_conn.rollback.assert_called_once()

    @patch("src.scripts.load_lexicon.psycopg2")
    @patch("src.scripts.load_lexicon.settings")
    def test_get_connection_uses_sync_url(self, mock_settings, mock_psycopg2):
        """Test that get_connection uses the sync database URL."""
        from src.scripts.load_lexicon import get_connection

        mock_settings.database_url_sync = "postgresql://user:pass@localhost/db"
        get_connection()
        mock_psycopg2.connect.assert_called_once_with("postgresql://user:pass@localhost/db")

    @patch("src.scripts.load_lexicon.load_data")
    def test_main_parses_force_flag(self, mock_load_data):
        """Test that --force flag is parsed correctly."""
        from src.scripts.load_lexicon import main

        with patch.object(sys, "argv", ["load_lexicon", "--force"]):
            main()
        mock_load_data.assert_called_once_with(force=True)

    @patch("src.scripts.load_lexicon.load_data")
    def test_main_default_no_force(self, mock_load_data):
        """Test that default invocation has force=False."""
        from src.scripts.load_lexicon import main

        with patch.object(sys, "argv", ["load_lexicon"]):
            main()
        mock_load_data.assert_called_once_with(force=False)
