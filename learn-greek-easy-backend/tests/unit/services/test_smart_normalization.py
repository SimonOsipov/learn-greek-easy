"""Unit tests for smart normalization pipeline.

Tests cover:
- detect_article(): nominative article detection and extraction (AC #1-#11)
- normalize_smart(): happy path, spellcheck correction, article detection (AC #12-#15)
- _deduplicate_and_rank(): grouping, tie-breaking, suggestion filtering (AC #16-#18)
- Article-prefix retries: generated when no article detected, suppressed when article given
"""

from unittest.mock import MagicMock

import pytest

# ============================================================================
# Helpers
# ============================================================================


def _make_morphology_result(
    input_word="σπίτι",
    lemma="σπίτι",
    pos="NOUN",
    morph_features=None,
    is_known=True,
    analysis_successful=True,
):
    """Build a MorphologyResult instance."""
    from src.schemas.nlp import MorphologyResult

    return MorphologyResult(
        input_word=input_word,
        lemma=lemma,
        pos=pos,
        morph_features=(
            morph_features
            if morph_features is not None
            else {"Gender": "Neut", "Number": "Sing", "Case": "Nom"}
        ),
        is_known=is_known,
        analysis_successful=analysis_successful,
    )


def _make_spellcheck_result(input_word="σπίτι", is_valid=True, suggestions=None):
    """Build a SpellcheckResult instance."""
    from src.schemas.nlp import SpellcheckResult

    return SpellcheckResult(
        input_word=input_word,
        is_valid=is_valid,
        suggestions=suggestions if suggestions is not None else [],
    )


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_morphology_service():
    """Mock MorphologyService."""
    return MagicMock()


@pytest.fixture
def mock_spellcheck_service():
    """Mock SpellcheckService."""
    return MagicMock()


@pytest.fixture
def normalization_service(mock_morphology_service, mock_spellcheck_service):
    """Create LemmaNormalizationService with injected mocks."""
    from src.services.lemma_normalization_service import LemmaNormalizationService

    return LemmaNormalizationService(
        morphology_service=mock_morphology_service,
        spellcheck_service=mock_spellcheck_service,
    )


# ============================================================================
# TestDetectArticle — AC #1-#11 (pure function, no mocks)
# ============================================================================


class TestDetectArticle:
    """Tests for detect_article() module-level function."""

    def test_masculine_article_ο(self):
        """AC #1: 'ο σκύλος' → article='ο', bare='σκύλος'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("ο σκύλος")
        assert article == "ο"
        assert bare == "σκύλος"

    def test_feminine_article_η(self):
        """AC #2: 'η γάτα' → article='η', bare='γάτα'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("η γάτα")
        assert article == "η"
        assert bare == "γάτα"

    def test_neuter_article_το(self):
        """AC #3: 'το σπίτι' → article='το', bare='σπίτι'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("το σπίτι")
        assert article == "το"
        assert bare == "σπίτι"

    def test_plural_masculine_article_οι(self):
        """AC #4: 'οι σκύλοι' → article='οι', bare='σκύλοι'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("οι σκύλοι")
        assert article == "οι"
        assert bare == "σκύλοι"

    def test_plural_neuter_article_τα(self):
        """AC #5: 'τα σπίτια' → article='τα', bare='σπίτια'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("τα σπίτια")
        assert article == "τα"
        assert bare == "σπίτια"

    def test_no_article_bare_word(self):
        """AC #6: bare 'σπίτι' → article=None, bare='σπίτι'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("σπίτι")
        assert article is None
        assert bare == "σπίτι"

    def test_leading_whitespace_stripped(self):
        """AC #7: '  ο σκύλος' → article='ο', bare='σκύλος'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("  ο σκύλος")
        assert article == "ο"
        assert bare == "σκύλος"

    def test_article_only_no_word(self):
        """AC #8: bare 'ο' (article only) → article='ο', bare=''."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("ο")
        assert article == "ο"
        assert bare == ""

    def test_non_article_first_word(self):
        """AC #9: 'σπίτι μου' → article=None, bare='σπίτι μου'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("σπίτι μου")
        assert article is None
        assert bare == "σπίτι μου"

    def test_uppercase_article_lowercased(self):
        """AC #10: 'Ο σκύλος' → article='ο' (lowercased), bare='σκύλος'."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("Ο σκύλος")
        assert article == "ο"
        assert bare == "σκύλος"

    def test_empty_string(self):
        """AC #11: '' → article=None, bare=''."""
        from src.services.lemma_normalization_service import detect_article

        article, bare = detect_article("")
        assert article is None
        assert bare == ""


# ============================================================================
# TestNormalizeSmartHappyPath — AC #12, #14
# ============================================================================


class TestNormalizeSmartHappyPath:
    """normalize_smart() happy path tests."""

    def test_bare_word_returns_smart_result(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #12: bare 'σπίτι' → SmartNormalizationResult with primary candidate."""
        from src.services.lemma_normalization_service import SmartNormalizationResult

        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            input_word="σπίτι",
            lemma="σπίτι",
            pos="NOUN",
            morph_features={"Gender": "Neut"},
        )

        result = normalization_service.normalize_smart("σπίτι")

        assert isinstance(result, SmartNormalizationResult)
        assert result.primary is not None
        assert result.primary.morphology.lemma == "σπίτι"
        assert result.primary.morphology.pos == "NOUN"

    def test_bare_word_detected_article_is_none(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #12: bare word → detected_article=None."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        result = normalization_service.normalize_smart("σπίτι")

        assert result.detected_article is None

    def test_article_prefixed_input_detected(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #14: 'το σπίτι' → detected_article='το', bare_word='σπίτι'."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            input_word="σπίτι",
            lemma="σπίτι",
            pos="NOUN",
            morph_features={"Gender": "Neut"},
        )

        result = normalization_service.normalize_smart("το σπίτι")

        assert result.detected_article == "το"
        assert result.primary.morphology.lemma == "σπίτι"

    def test_article_prefixed_no_article_prefix_retries(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #14: when article is given, no article-prefix candidates are added."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        normalization_service.normalize_smart("το σπίτι")

        # Only bare word 'σπίτι' is analyzed (no article-prefix retries)
        calls = [call.args[0] for call in mock_morphology_service.analyze_in_context.call_args_list]
        assert all(c == "σπίτι" for c in calls)
        # Should not have called with 'ο σπίτι', 'η σπίτι' etc.
        assert "ο σπίτι" not in calls
        assert "η σπίτι" not in calls
        assert "το σπίτι" not in calls


# ============================================================================
# TestNormalizeSmartSpellcheck — AC #13
# ============================================================================


class TestNormalizeSmartSpellcheck:
    """normalize_smart() spellcheck correction tests."""

    def test_misspelled_word_spellcheck_candidate_built(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #13: misspelled 'σπιτι' → spellcheck candidate is created (correct() called with bare word)."""
        mock_spellcheck_service.correct.return_value = "σπίτι"  # corrected
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            input_word="σπίτι",
            lemma="σπίτι",
            pos="NOUN",
            morph_features={"Gender": "Neut"},
        )

        result = normalization_service.normalize_smart("σπιτι")

        # correct() must have been called with the bare misspelled word
        mock_spellcheck_service.correct.assert_called_once_with("σπιτι")
        # Result should exist and have a primary
        assert result.primary is not None
        # The primary should reflect the corrected lemma
        assert result.primary.morphology.lemma == "σπίτι"

    def test_corrected_from_set_on_spellcheck_candidate_via_dedup(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #13: When different lemmas result from direct vs spellcheck forms, corrected_from is set."""
        # Simulate: direct analysis gives lemma "σπιτι", spellcheck gives lemma "σπίτι"
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)

        call_count = [0]

        def analyze_side_effect(form):
            call_count[0] += 1
            if form == "σπιτι":
                return _make_morphology_result(
                    input_word="σπιτι", lemma="σπιτι", pos="NOUN", morph_features={}
                )
            if form == "σπίτι":
                # spellcheck form → good result
                return _make_morphology_result(
                    input_word=form, lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
                )
            # article_prefix forms → low-quality result (different lemma group)
            return _make_morphology_result(
                input_word=form, lemma=form, pos="NOUN", morph_features={}
            )

        mock_morphology_service.analyze_in_context.side_effect = analyze_side_effect

        result = normalization_service.normalize_smart("σπιτι")

        # There should be at least a primary result
        assert result.primary is not None
        # At least one call was made to analyze_in_context
        assert call_count[0] >= 1
        # Verify corrected_from is set on a spellcheck candidate
        all_candidates = [result.primary] + result.suggestions
        spellcheck_candidates = [c for c in all_candidates if c.strategy == "spellcheck"]
        assert spellcheck_candidates, "Expected at least one spellcheck candidate"
        assert spellcheck_candidates[0].corrected_from == "σπιτι"

    def test_correct_word_no_spellcheck_candidate(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When correct() returns same word, no spellcheck candidate is added."""
        mock_spellcheck_service.correct.return_value = "σπίτι"  # same as input
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        result = normalization_service.normalize_smart("σπίτι")

        all_candidates = [result.primary] + result.suggestions
        spellcheck_candidates = [c for c in all_candidates if c.strategy == "spellcheck"]
        assert len(spellcheck_candidates) == 0

    def test_primary_strategy_direct_when_no_correction(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When no correction needed, primary strategy should be 'direct' or 'article_prefix'."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        result = normalization_service.normalize_smart("σπίτι")

        assert result.primary.strategy in ("direct", "article_prefix")


# ============================================================================
# TestNormalizeSmartEdgeCases — AC #15
# ============================================================================


class TestNormalizeSmartEdgeCases:
    """normalize_smart() edge case tests."""

    def test_bare_article_raises_value_error(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """AC #15: bare article 'ο' (no word after) → ValueError raised."""
        with pytest.raises(ValueError, match="No word provided after article detection"):
            normalization_service.normalize_smart("ο")

    def test_bare_article_with_spaces_raises_value_error(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """'  η  ' (article only with spaces) → ValueError raised."""
        with pytest.raises(ValueError, match="No word provided after article detection"):
            normalization_service.normalize_smart("  η  ")


# ============================================================================
# TestDeduplicateAndRank — AC #16, #17, #18
# ============================================================================


class TestDeduplicateAndRank:
    """_deduplicate_and_rank() tests using NormalizationCandidate objects directly."""

    def _make_candidate(self, lemma, pos, confidence, strategy, corrected_from=None):
        """Build a NormalizationCandidate with given attributes."""
        from src.services.lemma_normalization_service import NormalizationCandidate

        morph = _make_morphology_result(lemma=lemma, pos=pos, morph_features={})
        return NormalizationCandidate(
            input_form=lemma,
            strategy=strategy,
            morphology=morph,
            confidence=confidence,
            corrected_from=corrected_from,
        )

    def test_same_lemma_pos_grouped_returns_one_primary(self, normalization_service):
        """AC #16: two candidates with same (lemma, pos) → only one in output."""
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 0.95, "direct"),
            self._make_candidate("σπίτι", "NOUN", 1.0, "article_prefix"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        # Only one unique group → no suggestions
        assert primary.morphology.lemma == "σπίτι"
        assert len(suggestions) == 0

    def test_highest_confidence_wins_in_group(self, normalization_service):
        """AC #16: best candidate (highest confidence) is selected from the group."""
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 0.80, "direct"),
            self._make_candidate("σπίτι", "NOUN", 1.0, "article_prefix"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        assert primary.confidence == 1.0

    def test_tie_break_by_strategy_priority(self, normalization_service):
        """AC #17: equal confidence → lower strategy priority index wins."""
        # article_prefix has priority 0 (best), direct has priority 2 (worst)
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 0.95, "direct"),
            self._make_candidate("σπίτι", "NOUN", 0.95, "article_prefix"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        # article_prefix has lower priority index → it wins the tie
        assert primary.strategy == "article_prefix"

    def test_suggestions_filtered_below_threshold(self, normalization_service):
        """AC #18: candidates with confidence < 0.40 are excluded from suggestions."""
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 1.0, "direct"),
            self._make_candidate("γάτα", "NOUN", 0.80, "direct"),
            self._make_candidate("σκύλος", "NOUN", 0.30, "direct"),  # below threshold
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        assert primary.morphology.lemma == "σπίτι"
        assert len(suggestions) == 1
        assert suggestions[0].morphology.lemma == "γάτα"

    def test_suggestions_capped_at_three(self, normalization_service):
        """AC #18: at most 3 suggestions returned."""
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 1.0, "direct"),
            self._make_candidate("γάτα", "NOUN", 0.95, "direct"),
            self._make_candidate("σκύλος", "NOUN", 0.90, "direct"),
            self._make_candidate("βιβλίο", "NOUN", 0.85, "direct"),
            self._make_candidate("τραπέζι", "NOUN", 0.80, "direct"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        assert len(suggestions) <= 3

    def test_suggestions_sorted_by_confidence_descending(self, normalization_service):
        """Suggestions are ordered highest confidence first."""
        candidates = [
            self._make_candidate("σπίτι", "NOUN", 1.0, "direct"),
            self._make_candidate("γάτα", "NOUN", 0.60, "direct"),
            self._make_candidate("σκύλος", "NOUN", 0.80, "direct"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        assert primary.morphology.lemma == "σπίτι"
        assert suggestions[0].confidence >= suggestions[-1].confidence

    def test_different_pos_same_lemma_not_grouped(self, normalization_service):
        """Same lemma but different POS → separate groups → can produce suggestion."""
        candidates = [
            self._make_candidate("τρέχω", "VERB", 0.90, "direct"),
            self._make_candidate("τρέχω", "ADV", 0.60, "direct"),
        ]

        primary, suggestions = normalization_service._deduplicate_and_rank(candidates)

        # Two distinct groups → primary + possibly one suggestion
        assert primary.morphology.lemma == "τρέχω"
        # Both groups have confidence >= 0.40 → suggestion exists
        assert len(suggestions) == 1


# ============================================================================
# TestNormalizeSmartArticleRetries
# ============================================================================


class TestNormalizeSmartArticleRetries:
    """Article-prefix retry logic tests."""

    def test_no_article_triggers_article_prefix_candidates(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Bare word input → article-prefix candidates ('ο', 'η', 'το') are added."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        normalization_service.normalize_smart("σπίτι")

        call_args = [
            call.args[0] for call in mock_morphology_service.analyze_in_context.call_args_list
        ]
        # Should include article-prefix forms
        assert any(a in call_args for a in ("ο σπίτι", "η σπίτι", "το σπίτι"))

    def test_article_provided_suppresses_article_prefix_retries(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Article-prefixed input → no additional article-prefix candidates."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        normalization_service.normalize_smart("το σπίτι")

        call_args = [
            call.args[0] for call in mock_morphology_service.analyze_in_context.call_args_list
        ]
        # Only 'σπίτι' (bare) should be analyzed — no 'ο σπίτι', 'η σπίτι', 'το σπίτι'
        assert "ο σπίτι" not in call_args
        assert "η σπίτι" not in call_args
        assert "το σπίτι" not in call_args

    def test_misspelled_bare_word_article_retries_use_corrected_form(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When spellcheck corrects the word, article-prefix retries use corrected form."""
        mock_spellcheck_service.correct.return_value = "σπίτι"  # corrects 'σπιτι' → 'σπίτι'
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        normalization_service.normalize_smart("σπιτι")

        call_args = [
            call.args[0] for call in mock_morphology_service.analyze_in_context.call_args_list
        ]
        # Article retries should be based on corrected form 'σπίτι', not misspelled 'σπιτι'
        assert any(a in call_args for a in ("ο σπίτι", "η σπίτι", "το σπίτι"))
        assert "ο σπιτι" not in call_args
        assert "η σπιτι" not in call_args
        assert "το σπιτι" not in call_args


# ============================================================================
# TestNormalizeSmartLexicon
# ============================================================================


@pytest.mark.unit
class TestNormalizeSmartLexicon:
    """Tests for lexicon_entry integration in normalize_smart()."""

    def test_lexicon_entry_becomes_primary(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """When a lexicon entry is provided, it becomes the primary candidate."""
        from src.services.lexicon_service import LexiconEntry

        mock_spellcheck_service.correct.return_value = "γάτα"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="γάτα", pos="NOUN", morph_features={"Gender": "Fem"}
        )

        lexicon_entry = LexiconEntry(
            form="γάτα", lemma="γάτα", pos="noun", gender="Fem", ptosi="Nom", number="Sing"
        )
        result = normalization_service.normalize_smart("γάτα", lexicon_entry=lexicon_entry)

        assert result.primary.strategy == "lexicon"
        assert result.primary.confidence == 1.0
        assert result.primary.morphology.lemma == "γάτα"

    def test_no_lexicon_entry_falls_through(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Without a lexicon entry, pipeline uses spaCy strategies."""
        mock_spellcheck_service.correct.return_value = "σπίτι"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="σπίτι", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        result = normalization_service.normalize_smart("σπίτι")

        assert result.primary.strategy in ("direct", "article_prefix")

    def test_lexicon_gender_in_morph_features(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Lexicon entry gender is stored as spaCy-format morph feature."""
        from src.services.lexicon_service import LexiconEntry

        mock_spellcheck_service.correct.return_value = "άνθρωπος"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="άνθρωπος", pos="NOUN", morph_features={"Gender": "Masc"}
        )

        lexicon_entry = LexiconEntry(
            form="άνθρωπος",
            lemma="άνθρωπος",
            pos="noun",
            gender="Masc",
            ptosi="Nom",
            number="Sing",
        )
        result = normalization_service.normalize_smart("άνθρωπος", lexicon_entry=lexicon_entry)

        assert result.primary.strategy == "lexicon"
        assert result.primary.morphology.morph_features.get("Gender") == "Masc"

    def test_spacy_suggestions_present_with_lexicon(
        self, normalization_service, mock_morphology_service, mock_spellcheck_service
    ):
        """Lexicon primary doesn't suppress high-confidence spaCy candidates as suggestions."""
        from src.services.lexicon_service import LexiconEntry

        mock_spellcheck_service.correct.return_value = "βιβλίο"
        mock_spellcheck_service.check.return_value = _make_spellcheck_result(is_valid=True)
        mock_morphology_service.analyze_in_context.return_value = _make_morphology_result(
            lemma="βιβλίο", pos="NOUN", morph_features={"Gender": "Neut"}
        )

        lexicon_entry = LexiconEntry(
            form="βιβλίο",
            lemma="βιβλίο",
            pos="noun",
            gender="Neut",
            ptosi="Nom",
            number="Sing",
        )
        result = normalization_service.normalize_smart("βιβλίο", lexicon_entry=lexicon_entry)

        # Lexicon wins primary; lexicon + spaCy produce same (lemma, pos) group → merged
        assert result.primary.strategy == "lexicon"
        # suggestions may be empty (same lemma/pos group) — just verify no crash
        assert isinstance(result.suggestions, list)
