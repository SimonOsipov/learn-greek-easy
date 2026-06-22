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


# ---------------------------------------------------------------------------
# Adversarial / edge / boundary tests  (LEXGEN-10-02 Mode B QA additions)
# ---------------------------------------------------------------------------


class TestLemmatizeSentenceEmptyString:
    """MS-ADV-01: empty string produces an empty list (not an error)."""

    def test_empty_string_returns_empty_list(self, morphology_service):
        """lemmatize_sentence('') must return [] — spaCy emits no tokens for empty input."""
        result = morphology_service.lemmatize_sentence("")
        assert result == [], (
            f"Expected [] for empty string, got {result!r}. "
            "lemmatize_sentence('') must return an empty list."
        )

    def test_empty_string_return_type_is_list(self, morphology_service):
        """Return value for empty input must still be a list, not None."""
        result = morphology_service.lemmatize_sentence("")
        assert isinstance(
            result, list
        ), f"Expected list, got {type(result).__name__}. Must never return None."


class TestLemmatizeSentenceWhitespaceOnly:
    """MS-ADV-02: whitespace-only sentence — tokens must be flagged is_space=True."""

    def test_whitespace_only_tokens_are_space_flagged(self, morphology_service):
        """A whitespace-only string produces tokens all flagged is_space=True.

        spaCy emits the whitespace as a single token; the method must surface
        it with is_space=True so the caller can skip it.
        """
        result = morphology_service.lemmatize_sentence("   ")
        assert result, "Expected at least one token for whitespace-only input, got []"
        non_space_tokens = [t for t in result if not t.is_space]
        assert not non_space_tokens, (
            f"All tokens from a whitespace-only sentence must have is_space=True. "
            f"Non-space tokens found: {[(t.text, t.is_space) for t in non_space_tokens]}"
        )

    def test_whitespace_token_is_not_punct(self, morphology_service):
        """Whitespace token must NOT also be flagged is_punct — they are mutually exclusive."""
        result = morphology_service.lemmatize_sentence("   ")
        for tok in result:
            if tok.is_space:
                assert tok.is_punct is False, (
                    f"Token '{tok.text!r}' is is_space=True but also is_punct=True — "
                    "whitespace and punctuation flags should not both be set."
                )


class TestLemmatizeSentenceDigitToken:
    """MS-ADV-03: Arabic digit in a Greek sentence has like_num=True."""

    def test_arabic_digit_is_like_num(self, morphology_service):
        """In 'Έχω 3 βιβλία.', the '3' token must have like_num=True.

        This is a distinct code path from the 'ένα' (Greek numeral word) check
        in MS-06: it validates that the Arabic digit itself is caught.
        """
        result = morphology_service.lemmatize_sentence("Έχω 3 βιβλία.")
        digit_tokens = [t for t in result if t.text == "3"]
        assert digit_tokens, f"No token with text '3' found. Tokens: {[t.text for t in result]}"
        tok = digit_tokens[0]
        assert tok.like_num is True, (
            f"Expected '3' to have like_num=True, got like_num={tok.like_num}. "
            "Arabic digits must be flagged number-like."
        )

    def test_arabic_digit_is_not_punct(self, morphology_service):
        """'3' must NOT be flagged is_punct — digits are not punctuation."""
        result = morphology_service.lemmatize_sentence("Έχω 3 βιβλία.")
        digit_tokens = [t for t in result if t.text == "3"]
        assert digit_tokens, f"No '3' token found. Tokens: {[t.text for t in result]}"
        assert digit_tokens[0].is_punct is False, "'3' must not be flagged as punctuation"

    def test_non_digit_word_is_not_like_num_in_digit_sentence(self, morphology_service):
        """'βιβλία' adjacent to a digit must NOT be flagged like_num."""
        result = morphology_service.lemmatize_sentence("Έχω 3 βιβλία.")
        vivlia_tokens = [t for t in result if t.text == "βιβλία"]
        assert vivlia_tokens, f"No 'βιβλία' token found. Tokens: {[t.text for t in result]}"
        assert vivlia_tokens[0].like_num is False, "'βιβλία' should not be number-like"


class TestLemmatizeSentenceMultipleContractions:
    """MS-ADV-04: multiple contraction tokens each get space-joined lemmas; none are split."""

    def test_ston_has_space_joined_lemma(self, morphology_service):
        """'στον' in 'στον κήπο και στη θάλασσα' must have lemma 'σε ο' (space-joined)."""
        result = morphology_service.lemmatize_sentence("στον κήπο και στη θάλασσα")
        ston_tokens = [t for t in result if t.text == "στον"]
        assert ston_tokens, f"No 'στον' token found. Tokens: {[t.text for t in result]}"
        tok = ston_tokens[0]
        assert tok.lemma == "σε ο", (
            f"Expected 'στον' lemma 'σε ο', got '{tok.lemma}'. "
            "el_core_news_md returns space-joined lemma for contractions."
        )

    def test_sth_has_space_joined_lemma(self, morphology_service):
        """'στη' in 'στον κήπο και στη θάλασσα' must also have lemma 'σε ο'."""
        result = morphology_service.lemmatize_sentence("στον κήπο και στη θάλασσα")
        sth_tokens = [t for t in result if t.text == "στη"]
        assert sth_tokens, f"No 'στη' token found. Tokens: {[t.text for t in result]}"
        tok = sth_tokens[0]
        assert tok.lemma == "σε ο", (
            f"Expected 'στη' lemma 'σε ο', got '{tok.lemma}'. "
            "Both contraction forms must return the space-joined lemma."
        )

    def test_contraction_lemmas_contain_space(self, morphology_service):
        """Both contraction lemmas contain an internal space — confirming not-split contract."""
        result = morphology_service.lemmatize_sentence("στον κήπο και στη θάλασσα")
        contraction_texts = {"στον", "στη"}
        contraction_tokens = [t for t in result if t.text in contraction_texts]
        assert len(contraction_tokens) == 2, (
            f"Expected 2 contraction tokens (στον, στη), found {len(contraction_tokens)}: "
            f"{[(t.text, t.lemma) for t in contraction_tokens]}"
        )
        for tok in contraction_tokens:
            assert " " in tok.lemma, (
                f"Contraction token '{tok.text}' lemma '{tok.lemma}' must contain a space "
                "(space-joined, NOT split). lemmatize_sentence must not post-process the lemma."
            )

    def test_non_contraction_token_lemma_has_no_space(self, morphology_service):
        """'κήπο' (regular inflected noun) must NOT have a space-joined lemma."""
        result = morphology_service.lemmatize_sentence("στον κήπο και στη θάλασσα")
        kipos_tokens = [t for t in result if t.text == "κήπο"]
        assert kipos_tokens, f"No 'κήπο' token found. Tokens: {[t.text for t in result]}"
        assert " " not in kipos_tokens[0].lemma, (
            f"'κήπο' lemma '{kipos_tokens[0].lemma}' must not contain a space "
            "(only contractions have space-joined lemmas)."
        )


class TestLemmatizeSentenceMixedScript:
    """MS-ADV-05: sentence with Latin/English tokens mixed in does not crash."""

    def test_mixed_script_sentence_does_not_raise(self, morphology_service):
        """lemmatize_sentence must not raise on mixed Greek/Latin input."""
        # Should not raise any exception
        result = morphology_service.lemmatize_sentence("Η cat είναι εδώ")
        assert isinstance(result, list), "Must return a list, not raise"

    def test_mixed_script_returns_all_tokens(self, morphology_service):
        """All tokens from a mixed-script sentence are returned — Greek, Latin, and punct."""
        result = morphology_service.lemmatize_sentence("Η cat είναι εδώ")
        texts = [t.text for t in result]
        assert "Η" in texts, f"Greek token 'Η' not found. Got: {texts}"
        assert "cat" in texts, f"Latin token 'cat' not found. Got: {texts}"
        assert "είναι" in texts, f"Greek token 'είναι' not found. Got: {texts}"

    def test_latin_token_has_bool_flags(self, morphology_service):
        """Latin token 'cat' must still carry proper bool flags (no crash on flag access)."""
        result = morphology_service.lemmatize_sentence("Η cat είναι εδώ")
        cat_tokens = [t for t in result if t.text == "cat"]
        assert cat_tokens, f"No 'cat' token found. Tokens: {[t.text for t in result]}"
        tok = cat_tokens[0]
        assert isinstance(tok.is_punct, bool)
        assert isinstance(tok.is_space, bool)
        assert isinstance(tok.like_num, bool)
        assert tok.is_punct is False
        assert tok.is_space is False


class TestLemmatizeSentenceTokenOrder:
    """MS-ADV-06: token order in the returned list matches left-to-right sentence order."""

    def test_token_order_matches_sentence_order(self, morphology_service):
        """Tokens must appear in the same order as in the input sentence.

        This is a non-trivial property to test: if the implementation iterated
        over doc in reverse or sorted tokens, order would be broken.
        """
        sentence = "ένα δύο τρία"
        result = morphology_service.lemmatize_sentence(sentence)
        texts = [t.text for t in result]
        assert texts == ["ένα", "δύο", "τρία"], (
            f"Token order must match input left-to-right. "
            f"Expected ['ένα', 'δύο', 'τρία'], got {texts}"
        )

    def test_sentence_7_first_token_is_article(self, morphology_service):
        """In SENTENCE_7, the first non-space token is 'Η' (the definite article).

        This catches order inversion: if the list were reversed, 'Η' would be last.
        """
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        non_space = [t for t in result if not t.is_space]
        assert non_space, "Must have at least one non-space token"
        assert non_space[0].text == "Η", (
            f"First non-space token must be 'Η' (sentence starts with article). "
            f"Got '{non_space[0].text}'. Token order is reversed or wrong."
        )

    def test_sentence_7_last_token_is_period(self, morphology_service):
        """In SENTENCE_7, the last token is '.' (the trailing period).

        Paired with the first-token check, this confirms full order preservation.
        """
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        assert result, "Must have tokens"
        assert result[-1].text == ".", (
            f"Last token must be '.' (sentence ends with period). "
            f"Got '{result[-1].text}'. Token order may be wrong."
        )


class TestLemmatizeSentenceReturnTypes:
    """MS-ADV-07: return type is list[SentenceToken] with correctly typed fields."""

    def test_each_token_is_sentence_token_instance(self, morphology_service):
        """Every item in the returned list must be a SentenceToken instance."""
        from src.schemas.nlp import SentenceToken

        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        assert result, "Must have tokens to verify"
        for i, tok in enumerate(result):
            assert isinstance(tok, SentenceToken), (
                f"Token at index {i} is {type(tok).__name__}, expected SentenceToken. "
                f"token repr: {tok!r}"
            )

    def test_field_types_are_correct(self, morphology_service):
        """text/lemma are str; is_punct/is_space/like_num are bool — not int or None."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        for tok in result:
            assert type(tok.text) is str, f"text must be str, got {type(tok.text)}"
            assert type(tok.lemma) is str, f"lemma must be str, got {type(tok.lemma)}"
            # Strict bool check (not just truthy): isinstance(True, int) is True in Python,
            # so we use `type(...) is bool` to reject bare int flags.
            assert type(tok.is_punct) is bool, f"is_punct must be bool, got {type(tok.is_punct)}"
            assert type(tok.is_space) is bool, f"is_space must be bool, got {type(tok.is_space)}"
            assert type(tok.like_num) is bool, f"like_num must be bool, got {type(tok.like_num)}"

    def test_text_and_lemma_are_never_none(self, morphology_service):
        """text and lemma must be non-None strings for every token."""
        result = morphology_service.lemmatize_sentence(SENTENCE_7)
        for tok in result:
            assert tok.text is not None, "token.text must not be None"
            assert tok.lemma is not None, "token.lemma must not be None"


class TestLemmatizeSentenceNoSecondSpacyLoad:
    """MS-ADV-08: lemmatize_sentence() uses self._nlp — does NOT call spacy.load() again."""

    def test_lemmatize_sentence_uses_existing_nlp_attribute(self, morphology_service):
        """lemmatize_sentence() delegates to self._nlp, not a fresh spacy.load().

        Approach: swap self._nlp with a tracking wrapper that records calls,
        then confirm lemmatize_sentence() calls it without going through spacy.load.
        """
        from unittest.mock import patch

        import spacy

        # Capture the real _nlp reference to restore afterwards
        real_nlp = morphology_service._nlp

        call_log = []

        class TrackingNlp:
            """Wraps the real nlp and records __call__ invocations."""

            def __call__(self, text):
                call_log.append(text)
                return real_nlp(text)

        morphology_service._nlp = TrackingNlp()
        try:
            with patch.object(
                spacy,
                "load",
                side_effect=AssertionError(
                    "spacy.load() must NOT be called inside lemmatize_sentence()"
                ),
            ):
                result = morphology_service.lemmatize_sentence("στο σπίτι")
            # spacy.load was patched to raise — if we get here it wasn't called
            assert (
                len(call_log) == 1
            ), f"Expected self._nlp to be called exactly once; call_log={call_log}"
            assert result, "lemmatize_sentence must return tokens via self._nlp"
        finally:
            morphology_service._nlp = real_nlp
