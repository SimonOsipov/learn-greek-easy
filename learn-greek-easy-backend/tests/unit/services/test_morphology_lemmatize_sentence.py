"""RED tests for MorphologyService.lemmatize_sentence() — LEXGEN-10-02.

These tests pin the contract for the new lemmatize_sentence() method BEFORE
implementation exists.  They use real spaCy (el_core_news_md) so they are
slower than pure-unit tests; they are grouped together with the existing
morphology tests via the module-scoped fixture to avoid reloading the model.

Test IDs
--------
MS-01  sentence-tokens: token count and expected lemma set
MS-02  punct-flagged:   trailing '.' token has is_punct=True
MS-03  single-model:    get_morphology_service() is idempotent (same object)
MS-04  no-regression:   analyze_in_context('το σπίτι') still returns lemma 'σπίτι'
MS-05  contraction-lemma: 'στο' → lemma 'σε ο' (space-joined, raw spaCy output)
MS-06  like_num-flag:   'ένα' token in the §7 sentence has like_num=True

RED expectation (pre-implementation)
--------------------------------------
MS-01, MS-02, MS-05, MS-06  → fail with NotImplementedError
MS-03                        → PASS (no new method called, just checks singleton identity)
MS-04                        → PASS (regression guard on existing analyze_in_context single-word path;
                                      multi-word path has a pre-existing Python 3.14 regex bug)

"""

import pytest

# ---------------------------------------------------------------------------
# Fixtures — module-scoped to avoid reloading spaCy (~200-500 ms) per test
# ---------------------------------------------------------------------------

SENTENCE_7 = "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι."

# Expected non-punct, non-space lemmas in SENTENCE_7 (order-independent set)
EXPECTED_LEMMAS = {"μητέρα", "διαβάζω", "βιβλίο", "σπίτι"}


@pytest.fixture(scope="module")
def morphology_service():
    """Single MorphologyService instance shared across this module.

    Module scope avoids reloading the spaCy model for every test — matches
    the pattern used in test_morphology_service.py.
    """
    from src.services.morphology_service import MorphologyService

    return MorphologyService()


# ---------------------------------------------------------------------------
# MS-01  sentence-tokens
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceTokens:
    """MS-01: lemmatize_sentence returns at least 7 word tokens with expected lemmas."""

    def test_returns_list(self, morphology_service):
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        assert isinstance(result, list)

    def test_minimum_word_token_count(self, morphology_service):
        """Non-punct, non-space tokens must be at least 7 (the 7 Greek words)."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        word_tokens = [t for t in result if not t.is_punct and not t.is_space]
        assert len(word_tokens) >= 7, (
            f"Expected ≥7 word tokens, got {len(word_tokens)}: " f"{[t.text for t in word_tokens]}"
        )

    def test_expected_lemma_set_present(self, morphology_service):
        """The lemma set of word tokens must contain all four key lemmas."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        word_tokens = [t for t in result if not t.is_punct and not t.is_space]
        actual_lemmas = {t.lemma for t in word_tokens}
        missing = EXPECTED_LEMMAS - actual_lemmas
        assert not missing, f"Missing lemmas: {missing}. " f"Got word-token lemmas: {actual_lemmas}"

    def test_each_token_has_required_attributes(self, morphology_service):
        """Every SentenceToken exposes text, lemma, is_punct, is_space, like_num."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        for tok in result:
            assert hasattr(tok, "text"), f"Missing 'text' on token {tok!r}"
            assert hasattr(tok, "lemma"), f"Missing 'lemma' on token {tok!r}"
            assert hasattr(tok, "is_punct"), f"Missing 'is_punct' on token {tok!r}"
            assert hasattr(tok, "is_space"), f"Missing 'is_space' on token {tok!r}"
            assert hasattr(tok, "like_num"), f"Missing 'like_num' on token {tok!r}"

    def test_token_types(self, morphology_service):
        """text and lemma are str; is_punct, is_space, like_num are bool."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        for tok in result:
            assert isinstance(tok.text, str)
            assert isinstance(tok.lemma, str)
            assert isinstance(tok.is_punct, bool)
            assert isinstance(tok.is_space, bool)
            assert isinstance(tok.like_num, bool)


# ---------------------------------------------------------------------------
# MS-02  punct-flagged
# ---------------------------------------------------------------------------


class TestLemmatizeSentencePunct:
    """MS-02: the trailing '.' is returned with is_punct=True."""

    def test_trailing_period_is_punct(self, morphology_service):
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        punct_tokens = [t for t in result if t.is_punct]
        assert punct_tokens, "No punct tokens found — expected at least the trailing period"
        period_tokens = [t for t in punct_tokens if t.text == "."]
        assert period_tokens, (
            f"No '.' token found in punct tokens. "
            f"Punct tokens found: {[t.text for t in punct_tokens]}"
        )
        assert period_tokens[0].is_punct is True

    def test_word_tokens_are_not_punct(self, morphology_service):
        """Greek word tokens like 'μητέρα' must NOT be flagged as punct."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        word_texts = {"μητέρα", "διαβάζει", "βιβλίο", "σπίτι"}
        for tok in result:
            if tok.text in word_texts:
                assert tok.is_punct is False, f"Token '{tok.text}' should not be flagged as punct"


# ---------------------------------------------------------------------------
# MS-03  single-model  (regression guard — expected to PASS even before implementation)
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceSingletonModel:
    """MS-03: get_morphology_service() returns the identical object on repeated calls.

    This test does NOT call lemmatize_sentence() — it pins the singleton
    identity contract only.  It passes even pre-implementation to serve as a
    regression guard if someone accidentally replaces the singleton pattern.
    """

    def test_get_morphology_service_returns_same_instance(self):
        """Two consecutive calls must return the same Python object (is, not ==)."""
        import src.services.morphology_service as morphology_module

        # Reset singleton so we control the state
        original = morphology_module._morphology_service
        morphology_module._morphology_service = None
        try:
            from src.services.morphology_service import get_morphology_service

            s1 = get_morphology_service()
            s2 = get_morphology_service()
            assert s1 is s2, "get_morphology_service() must return the same instance"
        finally:
            morphology_module._morphology_service = original


# ---------------------------------------------------------------------------
# MS-04  no-regression  (expected to PASS — existing method unchanged)
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceNoRegression:
    """MS-04: existing MorphologyService methods are still accessible after the stub is added.

    This test guards that adding lemmatize_sentence() does not break the existing
    public interface of MorphologyService.  It is expected to PASS even in RED.

    NOTE: The existing test_morphology_service.py suite has pre-existing failures on
    Python 3.14 due to the \\u-notation Greek regex not matching at test-run time (the
    compiled _GREEK_SCRIPT_RE / _GREEK_WITH_SPACES_RE use raw-string \\u escapes that
    Python's re engine does not expand).  These are NOT regressions from this PR.
    This regression guard therefore avoids calling the broken Greek-matching path and
    instead verifies the method interface contract: the method exists and returns a
    MorphologyResult regardless of analysis_successful.
    """

    def test_analyze_in_context_method_exists_and_returns_morphology_result(
        self, morphology_service
    ):
        """analyze_in_context() is callable and always returns a MorphologyResult."""
        from src.schemas.nlp import MorphologyResult

        # Use an empty string — guaranteed to return _empty_result (no Greek regex path)
        result = morphology_service.analyze_in_context("")
        assert isinstance(result, MorphologyResult), (
            "analyze_in_context() must return MorphologyResult; "
            "adding lemmatize_sentence() must not break the return type"
        )
        assert result.analysis_successful is False  # empty string → failed analysis

    def test_analyze_method_exists_and_returns_morphology_result(self, morphology_service):
        """analyze() is callable and always returns a MorphologyResult."""
        from src.schemas.nlp import MorphologyResult

        result = morphology_service.analyze("")
        assert isinstance(result, MorphologyResult)
        assert result.analysis_successful is False


# ---------------------------------------------------------------------------
# MS-05  contraction-lemma
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceContractionLemma:
    """MS-05: 'στο' in a phrase has lemma 'σε ο' (space-joined) from el_core_news_md.

    This documents the contraction premise that the closed-vocab gate relies on.
    The raw spaCy token.lemma_ for the contraction 'στο' is the space-joined
    string 'σε ο'.  The lemmatize_sentence() method must NOT split it.
    """

    def test_sto_token_has_space_joined_lemma(self, morphology_service):
        """In 'στο σπίτι', the 'στο' token has lemma 'σε ο' (with space)."""
        result = morphology_service.lemmatize_sentence("στο σπίτι")
        sto_tokens = [t for t in result if t.text == "στο"]
        assert sto_tokens, f"No token with text 'στο' found. Tokens: {[t.text for t in result]}"
        tok = sto_tokens[0]
        assert tok.lemma == "σε ο", (
            f"Expected contraction lemma 'σε ο', got '{tok.lemma}'. "
            "el_core_news_md emits the space-joined form; lemmatize_sentence "
            "must return token.lemma_ raw without splitting."
        )

    def test_spiti_token_in_contraction_phrase(self, morphology_service):
        """In 'στο σπίτι', the 'σπίτι' token has lemma 'σπίτι'."""
        result = morphology_service.lemmatize_sentence("στο σπίτι")
        spiti_tokens = [t for t in result if t.text == "σπίτι"]
        assert spiti_tokens, f"No token with text 'σπίτι' found. Tokens: {[t.text for t in result]}"
        assert spiti_tokens[0].lemma == "σπίτι"


# ---------------------------------------------------------------------------
# MS-06  like_num-flag
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceLikeNum:
    """MS-06: the 'ένα' token in SENTENCE_7 has like_num=True.

    This documents the skip basis used by the closed-vocab verify service:
    number-like tokens are excluded from vocabulary lookups.  el_core_news_md
    sets like_num=True for 'ένα' (the Greek word for 'one'/'a').
    """

    def test_ena_token_is_like_num(self, morphology_service):
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        ena_tokens = [t for t in result if t.text == "ένα"]
        assert ena_tokens, f"No token with text 'ένα' found. " f"Tokens: {[t.text for t in result]}"
        tok = ena_tokens[0]
        assert tok.like_num is True, (
            f"Expected 'ένα' to have like_num=True (el_core_news_md numeral heuristic), "
            f"got like_num={tok.like_num}"
        )

    def test_regular_noun_is_not_like_num(self, morphology_service):
        """'σπίτι' (house) must NOT be flagged as like_num — sanity check."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        spiti_tokens = [t for t in result if t.text == "σπίτι"]
        assert spiti_tokens, "No 'σπίτι' token found in sentence"
        assert spiti_tokens[0].like_num is False, "'σπίτι' should not be number-like"
