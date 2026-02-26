"""Unit tests for Greek text utilities.

Tests cover:
- normalize_greek_accents() function with tonos and dialytika
- extract_searchable_forms() for nouns, verbs, adjectives, adverbs
- generate_normalized_forms() for accent-insensitive search

Target coverage: 95%+
"""

from src.utils.greek_text import (
    GENDER_TO_ARTICLE,
    extract_searchable_forms,
    generate_normalized_forms,
    normalize_greek_accents,
    resolve_tts_text,
)


class TestNormalizeGreekAccents:
    """Tests for accent normalization."""

    def test_removes_tonos_lowercase(self) -> None:
        """Test that lowercase tonos accents are removed."""
        assert normalize_greek_accents("καλημέρα") == "καλημερα"
        assert normalize_greek_accents("ευχαριστώ") == "ευχαριστω"

    def test_removes_all_tonos_vowels(self) -> None:
        """Test removal of tonos from all Greek vowels."""
        assert normalize_greek_accents("άέήίόύώ") == "αεηιουω"

    def test_removes_tonos_uppercase(self) -> None:
        """Test that uppercase tonos accents are removed."""
        assert normalize_greek_accents("ΆΈΉΊΌΎΏ") == "ΑΕΗΙΟΥΩ"

    def test_handles_dialytika(self) -> None:
        """Test that dialytika (diaeresis) is removed."""
        assert normalize_greek_accents("ϊ") == "ι"
        assert normalize_greek_accents("ϋ") == "υ"
        assert normalize_greek_accents("Ϊ") == "Ι"
        assert normalize_greek_accents("Ϋ") == "Υ"

    def test_handles_dialytika_with_tonos(self) -> None:
        """Test that combined dialytika+tonos characters are normalized."""
        assert normalize_greek_accents("ΐ") == "ι"
        assert normalize_greek_accents("ΰ") == "υ"

    def test_preserves_unaccented_greek(self) -> None:
        """Test that unaccented Greek characters pass through unchanged."""
        assert normalize_greek_accents("αβγδεζηθικλμνξοπρστυφχψω") == "αβγδεζηθικλμνξοπρστυφχψω"

    def test_preserves_non_greek(self) -> None:
        """Test that non-Greek characters pass through unchanged."""
        assert normalize_greek_accents("hello world 123") == "hello world 123"

    def test_handles_empty_string(self) -> None:
        """Test that empty string returns empty string."""
        assert normalize_greek_accents("") == ""

    def test_handles_mixed_content(self) -> None:
        """Test normalization of mixed Greek/English content."""
        assert normalize_greek_accents("Γειά σου, hello!") == "Γεια σου, hello!"

    def test_real_word_examples(self) -> None:
        """Test normalization with real Greek vocabulary words."""
        # Common Greek words
        assert normalize_greek_accents("νερό") == "νερο"
        assert normalize_greek_accents("θέλω") == "θελω"
        assert normalize_greek_accents("καλός") == "καλος"
        assert normalize_greek_accents("σήμερα") == "σημερα"
        assert normalize_greek_accents("αύριο") == "αυριο"


class TestExtractSearchableForms:
    """Tests for searchable form extraction."""

    def test_always_includes_front_text(self) -> None:
        """Test that front_text is always included in results."""
        forms = extract_searchable_forms({}, "γεια")
        assert forms == ["γεια"]

    def test_extracts_noun_forms_without_articles(self) -> None:
        """Test extraction of noun forms with article stripping."""
        noun_data = {
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "το νερό",
                "genitive_singular": "του νερού",
                "accusative_singular": "το νερό",
                "vocative_singular": "νερό",
                "nominative_plural": "τα νερά",
                "genitive_plural": "των νερών",
                "accusative_plural": "τα νερά",
                "vocative_plural": "νερά",
            }
        }
        forms = extract_searchable_forms(noun_data, "νερό")

        # Should include base forms
        assert "νερό" in forms
        assert "νερού" in forms
        assert "νερά" in forms
        assert "νερών" in forms

        # Should NOT include articles
        assert "το νερό" not in forms
        assert "του νερού" not in forms
        assert "τα νερά" not in forms

    def test_extracts_noun_forms_all_genders(self) -> None:
        """Test noun extraction for masculine and feminine nouns."""
        # Masculine noun
        masc_data = {
            "noun_data": {
                "gender": "masculine",
                "nominative_singular": "ο άνθρωπος",
                "genitive_singular": "του ανθρώπου",
            }
        }
        forms = extract_searchable_forms(masc_data, "άνθρωπος")
        assert "άνθρωπος" in forms
        assert "ανθρώπου" in forms
        assert "ο άνθρωπος" not in forms

        # Feminine noun
        fem_data = {
            "noun_data": {
                "gender": "feminine",
                "nominative_singular": "η γυναίκα",
                "genitive_singular": "της γυναίκας",
            }
        }
        forms = extract_searchable_forms(fem_data, "γυναίκα")
        assert "γυναίκα" in forms
        assert "γυναίκας" in forms
        assert "η γυναίκα" not in forms

    def test_extracts_verb_forms_without_prefixes(self) -> None:
        """Test extraction of verb forms with prefix stripping."""
        verb_data = {
            "verb_data": {
                "voice": "active",
                "present_1s": "θέλω",
                "present_2s": "θέλεις",
                "present_3s": "θέλει",
                "future_1s": "θα θελήσω",
                "future_2s": "θα θελήσεις",
                "future_3s": "θα θελήσει",
                "perfect_1s": "έχω θελήσει",
                "perfect_2s": "έχεις θελήσει",
                "perfect_3s": "έχει θελήσει",
                "imperative_2s": "",
            }
        }
        forms = extract_searchable_forms(verb_data, "θέλω")

        # Should include present forms
        assert "θέλω" in forms
        assert "θέλεις" in forms
        assert "θέλει" in forms

        # Should include future stems (stripped)
        assert "θελήσω" in forms
        assert "θελήσεις" in forms
        assert "θελήσει" in forms

        # Should NOT include prefixes
        assert "θα θελήσω" not in forms
        assert "έχω θελήσει" not in forms

    def test_extracts_verb_forms_all_perfect_persons(self) -> None:
        """Test extraction of all perfect tense person forms."""
        verb_data = {
            "verb_data": {
                "voice": "active",
                "perfect_1s": "έχω γράψει",
                "perfect_2s": "έχεις γράψει",
                "perfect_3s": "έχει γράψει",
                "perfect_1p": "έχουμε γράψει",
                "perfect_2p": "έχετε γράψει",
                "perfect_3p": "έχουν γράψει",
            }
        }
        forms = extract_searchable_forms(verb_data, "γράφω")

        # All should extract to same participle
        assert "γράψει" in forms

        # Prefixes should not appear
        for prefix in ["έχω", "έχεις", "έχει", "έχουμε", "έχετε", "έχουν"]:
            assert prefix not in " ".join(forms)

    def test_extracts_adjective_forms_with_comparatives(self) -> None:
        """Test extraction of adjective forms including comparatives."""
        adj_data = {
            "adjective_data": {
                "masculine_nominative_singular": "καλός",
                "feminine_nominative_singular": "καλή",
                "neuter_nominative_singular": "καλό",
                "comparative": "πιο καλός",
                "superlative": "ο πιο καλός",
            }
        }
        forms = extract_searchable_forms(adj_data, "καλός")

        # Should include base declension forms
        assert "καλός" in forms
        assert "καλή" in forms
        assert "καλό" in forms

        # Should strip comparison prefixes
        assert "πιο καλός" not in forms
        assert "ο πιο καλός" not in forms

    def test_extracts_adverb_forms(self) -> None:
        """Test extraction of adverb forms."""
        adv_data = {
            "adverb_data": {
                "comparative": "πιο γρήγορα",
                "superlative": "ο πιο γρήγορα",
            }
        }
        forms = extract_searchable_forms(adv_data, "γρήγορα")

        # Should include base form
        assert "γρήγορα" in forms

        # Should strip comparison prefixes
        assert "πιο γρήγορα" not in forms
        assert "ο πιο γρήγορα" not in forms

    def test_handles_empty_values(self) -> None:
        """Test that empty string values are handled gracefully."""
        data = {
            "verb_data": {
                "voice": "active",
                "present_1s": "θέλω",
                "imperative_2s": "",  # Empty imperative
                "imperative_2p": None,  # None value should not crash
            }
        }
        # Should not raise and should include valid forms
        forms = extract_searchable_forms(data, "θέλω")
        assert "θέλω" in forms
        assert "" not in forms

    def test_returns_unique_sorted_forms(self) -> None:
        """Test that results are unique and sorted."""
        noun_data = {
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "το νερό",
                "accusative_singular": "το νερό",  # Same as nominative
                "vocative_singular": "νερό",  # Same without article
            }
        }
        forms = extract_searchable_forms(noun_data, "νερό")

        # Should be unique
        assert len(forms) == len(set(forms))

        # Should be sorted
        assert forms == sorted(forms)

    def test_handles_multiple_grammar_types(self) -> None:
        """Test that only matching grammar type is processed."""
        # If data has noun_data, only noun forms should be extracted
        data = {
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "το νερό",
            }
        }
        forms = extract_searchable_forms(data, "νερό")
        assert "νερό" in forms

    def test_ignores_gender_field(self) -> None:
        """Test that gender field is not added to forms."""
        noun_data = {
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "το νερό",
            }
        }
        forms = extract_searchable_forms(noun_data, "νερό")
        assert "neuter" not in forms

    def test_ignores_voice_field(self) -> None:
        """Test that voice field is not added to forms."""
        verb_data = {
            "verb_data": {
                "voice": "active",
                "present_1s": "θέλω",
            }
        }
        forms = extract_searchable_forms(verb_data, "θέλω")
        assert "active" not in forms


class TestGenerateNormalizedForms:
    """Tests for normalized form generation."""

    def test_normalizes_all_forms(self) -> None:
        """Test that all forms are normalized."""
        forms = ["νερό", "νερού", "νερά"]
        normalized = generate_normalized_forms(forms)

        assert "νερο" in normalized
        assert "νερου" in normalized
        assert "νερα" in normalized

    def test_returns_unique_forms(self) -> None:
        """Test that duplicates after normalization are removed."""
        # νερό and νερο both normalize to νερο
        forms = ["νερό", "νερο"]
        normalized = generate_normalized_forms(forms)

        assert normalized == ["νερο"]
        assert len(normalized) == 1

    def test_returns_sorted_forms(self) -> None:
        """Test that results are sorted."""
        forms = ["ώρα", "αύριο", "μέρα"]
        normalized = generate_normalized_forms(forms)

        assert normalized == sorted(normalized)

    def test_handles_empty_list(self) -> None:
        """Test that empty input returns empty list."""
        assert generate_normalized_forms([]) == []

    def test_filters_empty_strings(self) -> None:
        """Test that empty strings after normalization are filtered."""
        forms = ["νερό", ""]
        normalized = generate_normalized_forms(forms)

        assert "" not in normalized
        assert "νερο" in normalized

    def test_handles_unaccented_forms(self) -> None:
        """Test that unaccented forms pass through unchanged."""
        forms = ["νερο", "νερα"]
        normalized = generate_normalized_forms(forms)

        assert "νερο" in normalized
        assert "νερα" in normalized

    def test_real_vocabulary_example(self) -> None:
        """Test with realistic vocabulary forms."""
        # Forms from a noun like "νερό"
        forms = ["νερό", "νερού", "νερά", "νερών"]
        normalized = generate_normalized_forms(forms)

        expected = ["νερα", "νερο", "νερου", "νερων"]
        assert normalized == expected


class TestIntegration:
    """Integration tests combining multiple functions."""

    def test_full_noun_workflow(self) -> None:
        """Test complete workflow for noun processing."""
        enriched = {
            "noun_data": {
                "gender": "neuter",
                "nominative_singular": "το νερό",
                "genitive_singular": "του νερού",
                "accusative_singular": "το νερό",
                "vocative_singular": "νερό",
                "nominative_plural": "τα νερά",
                "genitive_plural": "των νερών",
                "accusative_plural": "τα νερά",
                "vocative_plural": "νερά",
            }
        }

        # Extract searchable forms
        forms = extract_searchable_forms(enriched, "νερό")

        # Generate normalized forms
        normalized = generate_normalized_forms(forms)

        # Verify both sets are valid
        assert len(forms) > 0
        assert len(normalized) > 0

        # Verify normalized forms don't have accents
        for norm in normalized:
            for accented in "άέήίόύώ":
                assert accented not in norm

    def test_full_verb_workflow(self) -> None:
        """Test complete workflow for verb processing."""
        enriched = {
            "verb_data": {
                "voice": "active",
                "present_1s": "θέλω",
                "present_2s": "θέλεις",
                "present_3s": "θέλει",
                "present_1p": "θέλουμε",
                "present_2p": "θέλετε",
                "present_3p": "θέλουν",
                "future_1s": "θα θελήσω",
                "perfect_1s": "έχω θελήσει",
            }
        }

        forms = extract_searchable_forms(enriched, "θέλω")
        normalized = generate_normalized_forms(forms)

        # Verify extraction
        assert "θέλω" in forms
        assert "θελήσω" in forms
        assert "θελήσει" in forms

        # Verify normalization
        assert "θελω" in normalized
        assert "θελησω" in normalized
        assert "θελησει" in normalized


class TestResolveTtsText:
    """Tests for TTS text resolution."""

    def test_noun_with_nominative_case_form(self) -> None:
        """Noun with grammar_data.cases.singular.nominative returns that form directly."""
        grammar_data = {"gender": "neuter", "cases": {"singular": {"nominative": "το νερό"}}}
        assert resolve_tts_text("νερό", "noun", grammar_data) == "το νερό"

    def test_noun_with_gender_no_nominative(self) -> None:
        """Noun with gender but no nominative falls back to gender-inferred article."""
        grammar_data = {"gender": "feminine"}
        assert resolve_tts_text("τράπεζα", "noun", grammar_data) == "η τράπεζα"

    def test_noun_masculine_gender_fallback(self) -> None:
        """Masculine gender maps to ο  article prefix."""
        grammar_data = {"gender": "masculine"}
        assert resolve_tts_text("φίλος", "noun", grammar_data) == "ο φίλος"

    def test_noun_neuter_gender_fallback(self) -> None:
        """Neuter gender maps to το  article prefix."""
        grammar_data = {"gender": "neuter"}
        assert resolve_tts_text("βιβλίο", "noun", grammar_data) == "το βιβλίο"

    def test_noun_no_grammar_data(self) -> None:
        """Noun with None grammar_data returns bare lemma."""
        assert resolve_tts_text("τράπεζα", "noun", None) == "τράπεζα"

    def test_noun_empty_grammar_data(self) -> None:
        """Noun with empty dict returns bare lemma."""
        assert resolve_tts_text("τράπεζα", "noun", {}) == "τράπεζα"

    def test_noun_no_gender_key(self) -> None:
        """Noun with grammar_data but no gender key returns bare lemma."""
        grammar_data = {"declension_group": "feminine_a"}
        assert resolve_tts_text("τράπεζα", "noun", grammar_data) == "τράπεζα"

    def test_adjective_with_masculine_nominative(self) -> None:
        """Adjective with masculine singular nominative returns ο  + that form."""
        grammar_data = {"forms": {"masculine": {"singular": {"nominative": "καλός"}}}}
        assert resolve_tts_text("καλός", "adjective", grammar_data) == "ο καλός"

    def test_adjective_no_grammar_data(self) -> None:
        """Adjective with None grammar_data returns bare lemma."""
        assert resolve_tts_text("καλός", "adjective", None) == "καλός"

    def test_adjective_no_masculine_form(self) -> None:
        """Adjective with partial grammar_data no masculine key returns bare lemma."""
        grammar_data = {"forms": {}}
        assert resolve_tts_text("καλός", "adjective", grammar_data) == "καλός"

    def test_verb_returns_bare_lemma(self) -> None:
        """Verb always returns bare lemma regardless of grammar_data."""
        assert resolve_tts_text("τρέχω", "verb", {"some": "data"}) == "τρέχω"

    def test_adverb_returns_bare_lemma(self) -> None:
        """Adverb returns bare lemma."""
        assert resolve_tts_text("γρήγορα", "adverb", None) == "γρήγορα"

    def test_phrase_returns_bare_lemma(self) -> None:
        """Phrase returns bare lemma."""
        assert resolve_tts_text("καλημέρα σας", "phrase", None) == "καλημέρα σας"

    def test_noun_nominative_takes_priority_over_gender(self) -> None:
        """When both nominative and gender exist, nominative wins."""
        grammar_data = {"gender": "neuter", "cases": {"singular": {"nominative": "το νερό"}}}
        assert resolve_tts_text("νερό", "noun", grammar_data) == "το νερό"

    def test_gender_to_article_constant(self) -> None:
        """GENDER_TO_ARTICLE has exactly 3 entries with correct values."""
        assert set(GENDER_TO_ARTICLE.keys()) == {"masculine", "feminine", "neuter"}
        assert GENDER_TO_ARTICLE["masculine"] == "ο "
        assert GENDER_TO_ARTICLE["feminine"] == "η "
        assert GENDER_TO_ARTICLE["neuter"] == "το "
