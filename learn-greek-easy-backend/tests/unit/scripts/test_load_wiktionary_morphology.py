"""Unit tests for load_wiktionary_morphology ETL script."""

import io
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.unit
class TestIsInflectedFormOnly:
    """Tests for _is_inflected_form_only."""

    def test_all_senses_match_returns_true(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {
            "senses": [
                {"glosses": ["nominative singular of κόσμος"]},
                {"glosses": ["genitive plural of κόσμος"]},
            ]
        }
        assert _is_inflected_form_only(entry) is True

    def test_one_real_sense_returns_false(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {
            "senses": [
                {"glosses": ["nominative singular of κόσμος"]},
                {"glosses": ["world; universe"]},
            ]
        }
        assert _is_inflected_form_only(entry) is False

    def test_empty_senses_returns_false(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {"senses": []}
        assert _is_inflected_form_only(entry) is False

    def test_no_senses_key_returns_false(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {}
        assert _is_inflected_form_only(entry) is False

    def test_sense_with_empty_glosses_returns_false(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {"senses": [{"glosses": []}]}
        assert _is_inflected_form_only(entry) is False

    def test_case_insensitive_match(self):
        from src.scripts.load_wiktionary_morphology import _is_inflected_form_only

        entry = {"senses": [{"glosses": ["Nominative Singular of κόσμος"]}]}
        assert _is_inflected_form_only(entry) is True


@pytest.mark.unit
class TestGetGender:
    """Tests for _get_gender."""

    def test_m_returns_masculine(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {"head_templates": [{"args": {"g": "m"}}]}
        assert _get_gender(entry) == "masculine"

    def test_f_returns_feminine(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {"head_templates": [{"args": {"g": "f"}}]}
        assert _get_gender(entry) == "feminine"

    def test_n_returns_neuter(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {"head_templates": [{"args": {"g": "n"}}]}
        assert _get_gender(entry) == "neuter"

    def test_missing_g_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {"head_templates": [{"args": {"other": "x"}}]}
        assert _get_gender(entry) is None

    def test_no_head_templates_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {}
        assert _get_gender(entry) is None

    def test_unknown_gender_code_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _get_gender

        entry = {"head_templates": [{"args": {"g": "x"}}]}
        assert _get_gender(entry) is None


@pytest.mark.unit
class TestExtractForms:
    """Tests for _extract_forms."""

    def test_full_tag_set_produces_correct_key(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        entry = {
            "forms": [
                {"source": "declension", "tags": ["nominative", "singular"], "form": "κόσμος"},
            ]
        }
        result = _extract_forms(entry)
        assert result == {"nominative_singular": "κόσμος"}

    def test_excluded_tags_are_skipped(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        entry = {
            "forms": [
                {
                    "source": "declension",
                    "tags": ["table-tags", "nominative", "singular"],
                    "form": "κόσμος",
                },
                {"source": "declension", "tags": ["inflection-template"], "form": "ignored"},
                {
                    "source": "declension",
                    "tags": ["romanization", "nominative", "singular"],
                    "form": "kosmos",
                },
            ]
        }
        result = _extract_forms(entry)
        assert result == {}

    def test_non_declension_source_skipped(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        entry = {
            "forms": [
                {"source": "other", "tags": ["nominative", "singular"], "form": "κόσμος"},
            ]
        }
        result = _extract_forms(entry)
        assert result == {}

    def test_tag_order_independence_vocative_singular(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        entry = {
            "forms": [
                {"source": "declension", "tags": ["vocative", "singular"], "form": "κόσμε"},
                {"source": "declension", "tags": ["singular", "vocative"], "form": "κόσμε"},
            ]
        }
        result = _extract_forms(entry)
        # Both produce the same key; setdefault means first value wins
        assert "vocative_singular" in result
        assert result["vocative_singular"] == "κόσμε"

    def test_first_value_wins_for_duplicate_key(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        entry = {
            "forms": [
                {"source": "declension", "tags": ["nominative", "singular"], "form": "first"},
                {"source": "declension", "tags": ["nominative", "singular"], "form": "second"},
            ]
        }
        result = _extract_forms(entry)
        assert result["nominative_singular"] == "first"

    def test_all_valid_case_number_combinations(self):
        from src.scripts.load_wiktionary_morphology import _extract_forms

        forms_input = []
        expected = {}
        for case in ["nominative", "genitive", "accusative", "vocative"]:
            for number in ["singular", "plural"]:
                form_val = f"{case}_{number}_form"
                forms_input.append(
                    {"source": "declension", "tags": [case, number], "form": form_val}
                )
                expected[f"{case}_{number}"] = form_val

        entry = {"forms": forms_input}
        result = _extract_forms(entry)
        assert result == expected


@pytest.mark.unit
class TestExtractIpa:
    """Tests for _extract_ipa."""

    def test_returns_first_ipa_entry(self):
        from src.scripts.load_wiktionary_morphology import _extract_ipa

        entry = {
            "sounds": [
                {"ipa": "/ˈkoz.mos/"},
                {"ipa": "/alt.form/"},
            ]
        }
        assert _extract_ipa(entry) == "/ˈkoz.mos/"

    def test_no_ipa_key_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _extract_ipa

        entry = {"sounds": [{"audio": "something.ogg"}]}
        assert _extract_ipa(entry) is None

    def test_no_sounds_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _extract_ipa

        entry = {}
        assert _extract_ipa(entry) is None

    def test_skips_non_ipa_entries_to_find_ipa(self):
        from src.scripts.load_wiktionary_morphology import _extract_ipa

        entry = {
            "sounds": [
                {"audio": "something.ogg"},
                {"ipa": "/ˈkoz.mos/"},
            ]
        }
        assert _extract_ipa(entry) == "/ˈkoz.mos/"


@pytest.mark.unit
class TestExtractGlosses:
    """Tests for _extract_glosses."""

    def test_single_sense_single_gloss(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {"senses": [{"glosses": ["world"]}]}
        assert _extract_glosses(entry) == "world"

    def test_multiple_senses_joined_semicolon(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {
            "senses": [
                {"glosses": ["world", "ignored second gloss"]},
                {"glosses": ["universe"]},
            ]
        }
        assert _extract_glosses(entry) == "world; universe"

    def test_deduplicated_glosses(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {
            "senses": [
                {"glosses": ["world"]},
                {"glosses": ["world"]},
            ]
        }
        assert _extract_glosses(entry) == "world"

    def test_empty_senses_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {"senses": []}
        assert _extract_glosses(entry) is None

    def test_no_senses_key_returns_none(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {}
        assert _extract_glosses(entry) is None

    def test_sense_with_empty_glosses_skipped(self):
        from src.scripts.load_wiktionary_morphology import _extract_glosses

        entry = {"senses": [{"glosses": []}, {"glosses": ["world"]}]}
        assert _extract_glosses(entry) == "world"


@pytest.mark.unit
class TestParseEntries:
    """Tests for _parse_entries with mocked file I/O."""

    def _make_noun_entry(
        self,
        word: str,
        gender: str = "m",
        glosses: list[str] | None = None,
        ipa: str | None = None,
        forms: list[dict] | None = None,
        pos: str = "noun",
    ) -> str:
        entry: dict = {
            "word": word,
            "pos": pos,
            "head_templates": [{"args": {"g": gender}}],
            "senses": [{"glosses": glosses or [f"{word} meaning"]}],
            "sounds": ([{"ipa": ipa}] if ipa else []),
            "forms": forms or [],
        }
        return json.dumps(entry)

    def _parse_from_lines(self, lines: list[str]) -> tuple[list[dict], int, int]:
        from src.scripts.load_wiktionary_morphology import _parse_entries

        content = "\n".join(lines)
        fake_path = MagicMock(spec=Path)
        fake_path.open.return_value.__enter__ = lambda s: io.StringIO(content)
        fake_path.open.return_value.__exit__ = MagicMock(return_value=False)
        return _parse_entries(fake_path)

    def test_verb_entry_filtered(self):
        lines = [self._make_noun_entry("τρέχω", pos="verb")]
        rows, filtered, merged = self._parse_from_lines(lines)
        assert rows == []
        assert filtered == 0  # verbs excluded before total_raw count

    def test_inflected_form_filtered(self):
        entry = {
            "word": "κόσμου",
            "pos": "noun",
            "head_templates": [{"args": {"g": "m"}}],
            "senses": [{"glosses": ["genitive singular of κόσμος"]}],
            "sounds": [],
            "forms": [],
        }
        lines = [json.dumps(entry)]
        rows, filtered, merged = self._parse_from_lines(lines)
        assert rows == []
        assert filtered == 1

    def test_missing_gender_filtered(self):
        entry = {
            "word": "κόσμος",
            "pos": "noun",
            "head_templates": [],  # no gender
            "senses": [{"glosses": ["world"]}],
            "sounds": [],
            "forms": [],
        }
        lines = [json.dumps(entry)]
        rows, filtered, merged = self._parse_from_lines(lines)
        assert rows == []
        assert filtered == 1

    def test_duplicate_lemma_gender_merged(self):
        line1 = self._make_noun_entry("κόσμος", gender="m", glosses=["world"], ipa="/ˈkoz.mos/")
        line2 = self._make_noun_entry("κόσμος", gender="m", glosses=["universe"], ipa="/alt/")
        rows, filtered, merged = self._parse_from_lines([line1, line2])
        assert len(rows) == 1
        assert merged == 1
        # glosses combined and sorted
        assert "universe" in rows[0]["glosses_en"]
        assert "world" in rows[0]["glosses_en"]
        # first pronunciation wins
        assert rows[0]["pronunciation"] == "/ˈkoz.mos/"

    def test_different_gender_same_lemma_not_merged(self):
        line1 = self._make_noun_entry("κόσμος", gender="m", glosses=["world (m)"])
        line2 = self._make_noun_entry("κόσμος", gender="f", glosses=["world (f)"])
        rows, filtered, merged = self._parse_from_lines([line1, line2])
        assert len(rows) == 2
        assert merged == 0

    def test_full_noun_entry_produces_correct_row(self):
        forms_data = [
            {"source": "declension", "tags": ["nominative", "singular"], "form": "κόσμος"},
            {"source": "declension", "tags": ["genitive", "singular"], "form": "κόσμου"},
        ]
        entry = {
            "word": "κόσμος",
            "pos": "noun",
            "head_templates": [{"args": {"g": "m"}}],
            "senses": [{"glosses": ["world"]}],
            "sounds": [{"ipa": "/ˈkoz.mos/"}],
            "forms": forms_data,
        }
        rows, filtered, merged = self._parse_from_lines([json.dumps(entry)])
        assert len(rows) == 1
        row = rows[0]
        assert row["lemma"] == "κόσμος"
        assert row["gender"] == "masculine"
        assert row["glosses_en"] == "world"
        assert row["pronunciation"] == "/ˈkoz.mos/"
        assert row["forms"]["nominative_singular"] == "κόσμος"
        assert row["forms"]["genitive_singular"] == "κόσμου"
        assert filtered == 0
        assert merged == 0

    def test_invalid_json_lines_skipped(self):
        valid_line = self._make_noun_entry("κόσμος", gender="m")
        lines = ["not valid json", valid_line, "{bad}"]
        rows, filtered, merged = self._parse_from_lines(lines)
        assert len(rows) == 1


@pytest.mark.unit
class TestLoadDataHelpers:
    """Tests for load_data and main integration."""

    @patch("src.scripts.load_wiktionary_morphology._get_connection")
    @patch("src.scripts.load_wiktionary_morphology.DATA_FILE")
    def test_load_data_exits_if_file_not_found(self, mock_data_file, mock_get_conn):
        from src.scripts.load_wiktionary_morphology import load_data

        mock_data_file.exists.return_value = False

        with pytest.raises(SystemExit) as exc_info:
            load_data(force=False)
        assert exc_info.value.code == 1

    @patch("src.scripts.load_wiktionary_morphology.load_data")
    def test_main_parses_force_flag(self, mock_load_data):
        from src.scripts.load_wiktionary_morphology import main

        with patch.object(sys, "argv", ["load_wiktionary_morphology", "--force"]):
            main()
        mock_load_data.assert_called_once_with(force=True)

    @patch("src.scripts.load_wiktionary_morphology.load_data")
    def test_main_default_no_force(self, mock_load_data):
        from src.scripts.load_wiktionary_morphology import main

        with patch.object(sys, "argv", ["load_wiktionary_morphology"]):
            main()
        mock_load_data.assert_called_once_with(force=False)

    @patch("src.scripts.load_wiktionary_morphology.psycopg2")
    @patch("src.scripts.load_wiktionary_morphology.settings")
    def test_get_connection_uses_sync_url(self, mock_settings, mock_psycopg2):
        from src.scripts.load_wiktionary_morphology import _get_connection

        mock_settings.database_url_sync = "postgresql://user:pass@localhost/db"
        _get_connection()
        mock_psycopg2.connect.assert_called_once_with("postgresql://user:pass@localhost/db")
