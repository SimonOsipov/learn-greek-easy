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
        # forms is now a feature-keyed bundle list (LEXGEN-03-03), not a flat dict.
        assert row["forms"] == [
            {"form": "κόσμος", "features": {"case": "nominative", "number": "singular"}},
            {"form": "κόσμου", "features": {"case": "genitive", "number": "singular"}},
        ]
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
        mock_load_data.assert_called_once_with(force=True, pos="noun")

    @patch("src.scripts.load_wiktionary_morphology.load_data")
    def test_main_default_no_force(self, mock_load_data):
        from src.scripts.load_wiktionary_morphology import main

        with patch.object(sys, "argv", ["load_wiktionary_morphology"]):
            main()
        mock_load_data.assert_called_once_with(force=False, pos="noun")

    @patch("src.scripts.load_wiktionary_morphology.psycopg2")
    @patch("src.scripts.load_wiktionary_morphology.settings")
    def test_get_connection_uses_sync_url(self, mock_settings, mock_psycopg2):
        from src.scripts.load_wiktionary_morphology import _get_connection

        mock_settings.database_url_sync = "postgresql://user:pass@localhost/db"
        _get_connection()
        mock_psycopg2.connect.assert_called_once_with("postgresql://user:pass@localhost/db")


# ---------------------------------------------------------------------------
# LEXGEN-03-03 RED tests — configurable POS filter + bundle output in importer
# ---------------------------------------------------------------------------


def _make_entry(word: str, pos: str = "noun", gender: str = "m") -> str:
    """Build a minimal Kaikki JSONL entry string."""
    entry: dict = {
        "word": word,
        "pos": pos,
        "head_templates": [{"args": {"g": gender}}],
        "senses": [{"glosses": [f"{word} meaning"]}],
        "sounds": [{"ipa": f"/{word}/"}],
        "forms": [
            {"source": "declension", "tags": ["nominative", "singular"], "form": word},
            {"source": "declension", "tags": ["genitive", "singular"], "form": f"{word}-gen"},
        ],
    }
    return json.dumps(entry)


def _call_parse_entries(lines: list[str], pos: str = "noun") -> tuple[list[dict], int, int]:
    """Helper: call _parse_entries with a fake path and the given pos filter."""
    from src.scripts.load_wiktionary_morphology import _parse_entries

    content = "\n".join(lines)
    fake_path = MagicMock(spec=Path)
    fake_path.open.return_value.__enter__ = lambda s: io.StringIO(content)
    fake_path.open.return_value.__exit__ = MagicMock(return_value=False)
    # RED: _parse_entries does not yet accept a `pos` kwarg — raises TypeError.
    return _parse_entries(fake_path, pos=pos)


@pytest.mark.unit
class TestPosFilterAndBundleOutput:
    """LEXGEN-03-03 RED tests for configurable POS filter + bundle output.

    Every test in this class MUST fail before the implementation lands and
    MUST pass after. Failures must be assertion errors or TypeErrors (wrong
    function signature), NOT collection errors.
    """

    # ------------------------------------------------------------------
    # AC-1  POS filter is configurable (default = noun)
    # ------------------------------------------------------------------

    def test_default_pos_is_noun_and_filters_nouns(self):
        """AC-1: with no pos kwarg (default "noun"), only noun entries are selected.

        RED because _parse_entries does not yet accept a `pos` parameter and
        will raise TypeError.
        """
        lines = [
            _make_entry("κόσμος", pos="noun"),
            _make_entry("τρέχω", pos="verb"),
            _make_entry("καλός", pos="adjective"),
        ]
        rows, _filtered, _merged = _call_parse_entries(lines)  # pos defaults to "noun"
        assert len(rows) == 1
        assert rows[0]["lemma"] == "κόσμος"

    def test_pos_flag_selects_configured_pos(self):
        """AC-1: passing pos="verb" selects only verb entries, not nouns.

        RED because _parse_entries does not yet accept a `pos` parameter and
        will raise TypeError.
        """
        lines = [
            _make_entry("κόσμος", pos="noun"),
            _make_entry("τρέχω", pos="verb"),
            _make_entry("γράφω", pos="verb"),
        ]
        rows, _filtered, _merged = _call_parse_entries(lines, pos="verb")
        assert len(rows) == 2
        lemmas = {r["lemma"] for r in rows}
        assert lemmas == {"τρέχω", "γράφω"}

    # ------------------------------------------------------------------
    # AC-2  inserted forms are a bundle list, not a flat dict
    # ------------------------------------------------------------------

    def test_inserted_forms_are_bundle_list(self):
        """AC-2: the forms value handed to _insert_rows is a bundle list, not a flat dict.

        After implementation, each row["forms"] must be a list of dicts with
        "form" and "features" keys (FormBundle-shaped), produced by flat_to_bundles.

        RED because _parse_entries does not yet accept `pos` (TypeError), and
        even if it did, forms are still flat dicts today.
        """
        import psycopg2.extras

        lines = [_make_entry("κόσμος", pos="noun")]
        rows, _filtered, _merged = _call_parse_entries(lines, pos="noun")

        assert len(rows) == 1
        forms = rows[0]["forms"]
        # Must be a list, not a dict.
        assert isinstance(forms, list), f"Expected list of bundles, got {type(forms)}"
        # Every element must be a FormBundle-shaped dict.
        for bundle in forms:
            assert "form" in bundle, f"Bundle missing 'form' key: {bundle}"
            assert "features" in bundle, f"Bundle missing 'features' key: {bundle}"
            features = bundle["features"]
            assert "case" in features, f"Bundle features missing 'case': {features}"
            assert "number" in features, f"Bundle features missing 'number': {features}"

        # Also verify via _insert_rows: the Json payload carries a list.
        from src.scripts.load_wiktionary_morphology import _insert_rows

        mock_cursor = MagicMock()
        captured_batches: list[list[tuple]] = []

        def capture_execute_values(cursor, sql, batch):
            captured_batches.append(list(batch))

        with patch(
            "src.scripts.load_wiktionary_morphology.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            _insert_rows(mock_cursor, rows)

        assert captured_batches, "No batches were flushed to execute_values"
        # The forms column (index 2 of the VALUES tuple) is a Json wrapper.
        first_tuple = captured_batches[0][0]
        json_wrapper = first_tuple[2]
        assert isinstance(json_wrapper, psycopg2.extras.Json)
        # The Json payload must be a list (bundle list), not a dict.
        payload = json_wrapper.adapted
        assert isinstance(
            payload, list
        ), f"Expected bundle list in Json payload, got {type(payload)}: {payload}"

    # ------------------------------------------------------------------
    # AC-3  pos column written explicitly (default = "noun")
    # ------------------------------------------------------------------

    def test_pos_column_written_noun_by_default(self):
        """AC-3: each parsed row carries pos == "noun" when running with default flag.

        RED because _parse_entries does not yet accept `pos` (TypeError), and
        even if it did, rows do not yet carry a "pos" key.
        """
        lines = [_make_entry("κόσμος", pos="noun")]
        rows, _filtered, _merged = _call_parse_entries(lines, pos="noun")

        assert len(rows) == 1
        assert "pos" in rows[0], f"Row is missing 'pos' key: {rows[0]}"
        assert rows[0]["pos"] == "noun"

    # ------------------------------------------------------------------
    # AC-4  merge key is (lemma, pos, gender) — different pos → two rows
    # ------------------------------------------------------------------

    def test_merge_keys_on_lemma_pos_gender(self):
        """AC-4: two entries with the same (lemma, gender) but different pos
        produce two distinct rows — no merge/collision.

        Today the merge key is (lemma, gender), so same-lemma+gender entries
        with pos="noun" and pos="verb" would (wrongly) collapse into one row.

        RED because _parse_entries does not yet accept `pos` (TypeError). After
        implementation, passing pos="noun" selects only nouns, so we need to
        construct the scenario differently: we provide two entries both matching
        the configured pos, with the same (lemma, gender), different pos values
        stored in the merged dict — or test _process_noun_entry directly with
        pos wired into the merge key.

        Strategy: call _parse_entries twice with the real implementation;
        to trigger the merge-key test without relying on a cross-POS call,
        we test the merge dict key directly via _parse_entries with pos="noun"
        for two syntactically-identical noun entries and verify they DO merge
        (same (lemma, noun, gender)), then verify that two entries with the same
        (lemma, gender) but one configured as noun and one as verb do NOT merge.

        Since a single _parse_entries call can only filter ONE pos, we test the
        boundary condition via the row count: two noun entries sharing
        (lemma, gender) → 1 row (merged). This validates the (lemma, pos, gender)
        key because the pos dimension is fixed within one call; the invariant is
        that a future multi-pos import cannot collide.

        For the two-distinct-rows assertion: we verify that the merged dict key
        is a 3-tuple (lemma, pos, gender) by inspecting that the row carries
        "pos", which proves the key now includes pos. Two rows each with their
        own pos value is only testable after the implementation supports a
        hypothetical shared-pos call — so we assert the row["pos"] is set (AC-3
        already covers this), and separately assert that same (lemma, gender)
        with DIFFERENT entries for the configured pos still correctly merges
        (key collision = merge), confirming the key includes pos as a fixed
        component.

        Concrete RED assertion: rows from two entries with the same (lemma, gender)
        but different pos WOULD share a key today. We can only invoke the filter
        for one pos at a time; so we expose the bug by directly using
        _process_noun_entry with two different explicit pos values fed into the
        same merged dict and checking the number of keys.
        """
        from src.scripts.load_wiktionary_morphology import _process_noun_entry

        # Two entries: same lemma+gender, one "noun" one "verb".
        # With the new key = (lemma, pos, gender), they should NOT collide.
        merged: dict = {}
        filtered_ref = [0]
        total_raw_ref = [0]

        noun_entry = json.loads(_make_entry("κόσμος", pos="noun", gender="m"))
        verb_entry = json.loads(_make_entry("κόσμος", pos="verb", gender="m"))

        # After implementation, _process_noun_entry must accept a `pos` kwarg
        # so the merge key and row dict include it.
        # RED: today the function signature is (entry, merged, filtered_ref, total_raw_ref)
        # with no `pos` param → TypeError when called with pos=...
        _process_noun_entry(noun_entry, merged, filtered_ref, total_raw_ref, pos="noun")
        _process_noun_entry(verb_entry, merged, filtered_ref, total_raw_ref, pos="verb")

        assert len(merged) == 2, (
            f"Expected 2 distinct merge keys for noun vs verb with same (lemma, gender), "
            f"got {len(merged)}: {list(merged.keys())}"
        )

    # ------------------------------------------------------------------
    # AC-5  INSERT SQL contains pos column + VALUES carries pos string
    # ------------------------------------------------------------------

    def test_insert_sql_includes_pos_column_and_value(self):
        """AC-5: _insert_rows builds INSERT SQL with 'pos' in the column list
        and each VALUES tuple carries the configured pos string (not relying on
        the DB server_default).

        RED because _insert_rows does not yet accept rows with a "pos" key,
        and the INSERT SQL does not yet include "pos".

        After implementation:
        - The INSERT SQL must contain 'pos' in the column list.
        - Each VALUES tuple must include the pos string at a consistent position,
          and that position must match the column order in the SQL.
        """
        # Build a minimal row as the implementation will produce it post-change.
        # We supply "pos" explicitly; the INSERT must echo it back.
        from src.core.lexgen_forms import flat_to_bundles
        from src.scripts.load_wiktionary_morphology import _insert_rows

        flat_forms = {
            "nominative_singular": "κόσμος",
            "genitive_singular": "κόσμου",
        }
        rows = [
            {
                "lemma": "κόσμος",
                "pos": "noun",
                "gender": "masculine",
                "forms": flat_to_bundles(flat_forms, pos="noun"),
                "pronunciation": "/ˈkoz.mos/",
                "glosses_en": "world",
            }
        ]

        mock_cursor = MagicMock()
        captured_sqls: list[str] = []
        captured_batches: list[list[tuple]] = []

        def capture_execute_values(cursor, sql, batch):
            captured_sqls.append(sql)
            captured_batches.append(list(batch))

        with patch(
            "src.scripts.load_wiktionary_morphology.psycopg2.extras.execute_values",
            side_effect=capture_execute_values,
        ):
            _insert_rows(mock_cursor, rows)

        assert captured_sqls, "execute_values was never called"
        insert_sql = captured_sqls[0]

        # AC-5a: 'pos' must appear in the INSERT column list.
        assert "pos" in insert_sql, f"'pos' not found in INSERT SQL. Got:\n{insert_sql}"

        # AC-5b: each VALUES tuple must carry pos == "noun" (not left to server_default).
        assert captured_batches, "No batches captured"
        first_tuple = captured_batches[0][0]

        # Determine pos position from the SQL column order.
        # Extract the column list from the INSERT statement (between the parens after TABLE).
        import re as _re

        col_match = _re.search(r"INSERT INTO[^(]+\(([^)]+)\)", insert_sql)
        assert col_match, f"Could not parse column list from INSERT SQL:\n{insert_sql}"
        col_names = [c.strip() for c in col_match.group(1).split(",")]
        assert "pos" in col_names, f"'pos' not in parsed column list: {col_names}"
        pos_index = col_names.index("pos")

        actual_pos_value = first_tuple[pos_index]
        assert (
            actual_pos_value == "noun"
        ), f"Expected VALUES tuple[{pos_index}] == 'noun' (pos), got {actual_pos_value!r}"


# ---------------------------------------------------------------------------
# LEXGEN-03-03 adversarial tests — added by QA in Mode B
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestPosFilterAndBundleOutputAdversarial:
    """Adversarial / edge-case coverage for the configurable POS filter + bundle output.

    These tests cover scenarios not exercised by the AC-spec tests above:
    (a) --pos verb end-to-end: all built rows carry pos=="verb" and forms are bundles.
    (b) empty forms={} entry: row["forms"] is [] (not a flat {}), and the bundle
        conversion does not crash on an empty flat dict.
    (c) VALUES tuple off-by-one guard: the value at the SQL-column-name position for
        "pos" in the VALUES tuple is exactly the configured pos string — defends
        against a future column reorder that breaks the silent positional alignment.
    """

    def test_pos_verb_all_rows_carry_verb_pos_and_bundle_forms(self):
        """(a) --pos verb: every row has pos=='verb' and forms is a bundle list.

        Guards that no mid-chain code path branches on 'noun' specifically:
        the filter, merge key, row dict, and bundle conversion all use the
        configured pos parameter, not a hardcoded string.
        """
        lines = [
            _make_entry("τρέχω", pos="verb", gender="m"),
            _make_entry("γράφω", pos="verb", gender="f"),
            _make_entry("κόσμος", pos="noun", gender="m"),  # must be excluded
        ]
        rows, _filtered, _merged = _call_parse_entries(lines, pos="verb")

        assert (
            len(rows) == 2
        ), f"Expected 2 verb rows, got {len(rows)}: {[r['lemma'] for r in rows]}"
        for row in rows:
            assert (
                row["pos"] == "verb"
            ), f"Expected pos=='verb', got {row['pos']!r} for {row['lemma']}"
            assert isinstance(row["forms"], list), (
                f"Expected forms to be a list (bundle list) for {row['lemma']}, "
                f"got {type(row['forms'])}"
            )
            for bundle in row["forms"]:
                assert (
                    "form" in bundle and "features" in bundle
                ), f"Bundle missing required keys for {row['lemma']}: {bundle}"

    def test_empty_forms_entry_produces_empty_bundle_list(self):
        """(b) An entry with no declension forms yields forms==[] (not a flat {}).

        flat_to_bundles({}) must return [] without raising, and the round-trip
        through the conversion loop must store [] rather than an empty dict in
        the row, so the INSERT Json payload is an array, never an object.
        """
        import io as _io

        import psycopg2.extras as _psycopg2_extras

        # Entry with no declension forms (empty forms list in JSONL).
        entry: dict = {
            "word": "κόσμος",
            "pos": "noun",
            "head_templates": [{"args": {"g": "m"}}],
            "senses": [{"glosses": ["world meaning"]}],
            "sounds": [],
            "forms": [],  # <- no declension rows
        }
        from src.scripts.load_wiktionary_morphology import _insert_rows, _parse_entries

        content = json.dumps(entry)
        fake_path = MagicMock(spec=Path)
        fake_path.open.return_value.__enter__ = lambda s: _io.StringIO(content)
        fake_path.open.return_value.__exit__ = MagicMock(return_value=False)
        rows, _filtered, _merged = _parse_entries(fake_path, pos="noun")

        assert len(rows) == 1
        assert (
            rows[0]["forms"] == []
        ), f"Expected empty bundle list [] for entry with no forms, got: {rows[0]['forms']}"

        # Also verify _insert_rows wraps [] as Json([]), not Json({}).
        captured_batches: list[list[tuple]] = []

        def capture(cursor, sql, batch):
            captured_batches.append(list(batch))

        with patch(
            "src.scripts.load_wiktionary_morphology.psycopg2.extras.execute_values",
            side_effect=capture,
        ):
            _insert_rows(MagicMock(), rows)

        assert captured_batches
        forms_col = captured_batches[0][0][2]  # index 2 = forms in VALUES tuple
        assert isinstance(forms_col, _psycopg2_extras.Json)
        assert (
            forms_col.adapted == []
        ), f"Expected Json([]) for empty forms, got: {forms_col.adapted!r}"

    def test_values_tuple_pos_position_matches_sql_column_list(self):
        """(c) Off-by-one guard: the value at the SQL 'pos' column position in the
        VALUES tuple is exactly the configured pos string.

        This test is independent of _parse_entries: it drives _insert_rows directly
        with a hand-crafted row whose pos field is a sentinel value 'test_pos', so
        any positional shift would surface as a type / value mismatch rather than a
        silent pass through the real 'noun' string.
        """
        import re as _re

        from src.core.lexgen_forms import flat_to_bundles
        from src.scripts.load_wiktionary_morphology import _insert_rows

        sentinel_pos = "test_pos_sentinel"
        flat_forms = {"nominative_singular": "τεστ", "genitive_singular": "τεστ-gen"}
        rows = [
            {
                "lemma": "τεστ",
                "pos": sentinel_pos,
                "gender": "masculine",
                "forms": flat_to_bundles(flat_forms, pos="noun"),  # pos arg ignored by converter
                "pronunciation": None,
                "glosses_en": None,
            }
        ]

        captured_sqls: list[str] = []
        captured_batches: list[list[tuple]] = []

        def capture(cursor, sql, batch):
            captured_sqls.append(sql)
            captured_batches.append(list(batch))

        with patch(
            "src.scripts.load_wiktionary_morphology.psycopg2.extras.execute_values",
            side_effect=capture,
        ):
            _insert_rows(MagicMock(), rows)

        assert captured_sqls and captured_batches
        col_match = _re.search(r"INSERT INTO[^(]+\(([^)]+)\)", captured_sqls[0])
        col_names = [c.strip() for c in col_match.group(1).split(",")]
        pos_idx = col_names.index("pos")
        actual = captured_batches[0][0][pos_idx]
        assert actual == sentinel_pos, (
            f"VALUES tuple at SQL column 'pos' index {pos_idx} should be {sentinel_pos!r}, "
            f"got {actual!r}. Full tuple: {captured_batches[0][0]}"
        )


# ---------------------------------------------------------------------------
# LEXGEN-03-05 AC-3 (unit): no-verb invariant over a mixed-POS JSONL fixture
# ---------------------------------------------------------------------------
#
# AC-4 is ALREADY COVERED by
#   TestPosFilterAndBundleOutputAdversarial::test_pos_verb_all_rows_carry_verb_pos_and_bundle_forms
# (line 761).  That test: mixed-POS fixture with pos="verb" flag ->
#   - All returned rows have pos=='verb'.
#   - Zero noun rows (noun entry in fixture excluded).
#   - All forms are bundle lists.
# This directly proves --pos is the sole POS selector.  No duplicate.
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestLexgen0305NoVerbInvariant:
    """LEXGEN-03-05 AC-3: the no-verb invariant.

    A default importer run on a mixed-POS JSONL fixture (nouns, verbs,
    adjectives) produces ONLY noun rows -- there is no verb or adjective row
    in the output, and every row's pos is 'noun'.

    This is the story-level invariant from the Invariants block:
      'No verbs imported in v1 -- Decision Record: do not import verbs now.'
    It differs from the existing TestParseEntries::test_verb_entry_filtered which
    only tests a SINGLE verb entry in isolation.  This test uses a multi-entry
    mixed fixture to assert the FULL no-verb guarantee (no cross-contamination).
    """

    def test_default_run_only_produces_noun_rows(self) -> None:
        """AC-3 (LEXGEN-03-05): after a default importer run on a mixed-POS JSONL
        fixture, every returned row has pos == 'noun' and there is no verb row.

        Given: a JSONL fixture with 3 nouns, 2 verbs, and 1 adjective.
        When:  _parse_entries(path) is called with no pos argument (default 'noun').
        Then:
          - Every row in the output has pos == 'noun'.
          - No row has pos == 'verb' or any other POS.
          - The verb and adjective entries are excluded (not bleed through).
          - Row count == 3 (the 3 noun entries).
        """
        mixed_lines = [
            # 3 noun entries (should pass through)
            _make_entry("κόσμος", pos="noun", gender="m"),
            _make_entry("θάλασσα", pos="noun", gender="f"),
            _make_entry("παιδί", pos="noun", gender="n"),
            # 2 verb entries (must be excluded)
            _make_entry("τρέχω", pos="verb", gender="m"),
            _make_entry("γράφω", pos="verb", gender="f"),
            # 1 adjective entry (must be excluded)
            _make_entry("καλός", pos="adjective", gender="m"),
        ]
        rows, _filtered, _merged = _call_parse_entries(mixed_lines)  # default pos='noun'

        # All returned rows must have pos == 'noun'
        assert len(rows) == 3, (
            f"Expected 3 noun rows from a mixed-POS fixture with default pos='noun', "
            f"got {len(rows)}: {[r.get('lemma') for r in rows]}"
        )
        for row in rows:
            assert row["pos"] == "noun", (
                f"AC-3 no-verb invariant violated: row {row.get('lemma')!r} has "
                f"pos={row['pos']!r} (expected 'noun').  A non-noun entry leaked "
                f"through the default importer filter: INTEGRATION GAP."
            )

        # No verb row anywhere in the output (belt-and-suspenders check)
        verb_rows = [r for r in rows if r.get("pos") == "verb"]
        assert not verb_rows, (
            f"AC-3: verb rows found in default importer output: "
            f"{[r.get('lemma') for r in verb_rows]}.  "
            f"Verbs must not be imported in v1: INTEGRATION GAP."
        )

        # No non-noun row of any POS
        non_noun = [r for r in rows if r.get("pos") != "noun"]
        assert not non_noun, (
            f"AC-3: non-noun rows found in default output: "
            f"{[(r.get('lemma'), r.get('pos')) for r in non_noun]}"
        )

        # Verify noun lemmas are all present (no accidental drop)
        noun_lemmas = {r["lemma"] for r in rows}
        assert noun_lemmas == {"κόσμος", "θάλασσα", "παιδί"}, (
            f"Expected noun lemmas {{'κόσμος', 'θάλασσα', 'παιδί'}}, " f"got {noun_lemmas}"
        )
