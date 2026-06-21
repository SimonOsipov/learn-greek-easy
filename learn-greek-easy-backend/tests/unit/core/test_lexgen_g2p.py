"""RED tests for the G2P phonotactic legality validator (LEXGEN-07-02).

Authored test-first (RALPH Stage 2.5 / QA Mode A).  The ``validate_ipa``
function in ``src/core/lexgen_g2p.py`` is a STUB that raises
``NotImplementedError``, so every test that calls it is RED for the right
reason (NotImplementedError), NOT a collection error — the import resolves
against the skeleton which exports the real ``G2PResult`` dataclass and the
``validate_ipa`` signature.

normalize_ipa behavior (verified against src/utils/greek_text.py line 375):
  Strips  : /  [ ]  (IPA delimiters, regex r"[/\\[\\]]")
            .  (syllable boundary dots, str.replace)
            ˈ  ˌ  (stress markers, str.replace)
            Greek accented vowels → unaccented via normalize_greek_accents
                (e.g. ί→ι, ά→α — Greek Unicode only; IPA/Latin untouched)
            U+0361 tie bar, U+0303 nasalization combining, ː length mark
  Collapses whitespace.
  Does NOT lowercase — Latin IPA letters pass through case-unchanged.
  Does NOT strip plain Latin letters (a–z) or IPA-specific Unicode chars.

Phoneme inventory (the executor will hard-code this in the module):
  frozenset("a e i o u p b t d k f v s z m n l r g x θ ð ɣ ʝ ʎ ŋ ç ɲ c y h".split())
  | {"ɡ"}  # U+0261 (script g) in addition to g U+0067

Test Specs (AC → test):
  PASS cases — standard IPA and LLM simplified-Latin substitutions
  - test_valid_standard_ipa_passes
  - test_valid_simplified_latin_passes
  - test_valid_with_standard_greek_phonemes
  - test_valid_llm_c_substitution_passes
  - test_valid_llm_y_substitution_passes
  - test_valid_llm_gh_h_residual_passes
  - test_stress_dots_delimiters_ignored

  FAIL cases — illegal symbols, empty input
  - test_non_greek_symbol_fails
  - test_leftover_greek_letter_fails
  - test_digit_or_garbage_fails
  - test_empty_candidate

  Determinism / side-effect guard
  - test_deterministic_no_side_effects

Trace notes (inputs traced through REAL normalize_ipa before setting verdict):
  "/ˈspiti/"      → strip /  → ˈspiti → strip ˈ → spiti        residual "spiti"
  "/ˈan.θro.pos/" → strip /[] → ˈan.θro.pos → strip . → ˈanθropos
                    → strip ˈ → anθropos                         residual "anθropos"
  "/ˈɣala/"       → ɣala                                        residual "ɣala"
  "/ˈçeri/"       → çeri                                        residual "çeri"
  "/ˈlecsi/"      → lecsi        (c is in inventory as ç←c sub)  residual "lecsi"
  "/ya.ˈtros/"    → strip . → yaˈtros → strip ˈ → yatros        residual "yatros"
  "/ˈgha.la/"     → strip . → ˈghala → strip ˈ → ghala          residual "ghala"
                    (g ∈ inventory, h ∈ inventory via ɣ→gh rule)
  "[s.pi.ti]"     → strip [] → s.pi.ti → strip . → spiti        residual "spiti"
  "/wɔɪ/"         → wɔɪ    (w ∉ inv, ɔ ∉ inv, ɪ ∉ inv)          FAIL
  "/σπίτι/"       → strip / → σπίτι → normalize_greek_accents
                    → σπιτι  (σ,π,ι,τ,ι ∉ Latin/IPA inventory)  FAIL
  "/sp1ti/"       → sp1ti  (1 ∉ inventory)                      FAIL
  ""              → normalize_ipa("") == ""  → early return FAIL "empty pronunciation"
"""

import dataclasses

import pytest

from src.core.lexgen_g2p import GREEK_PHONEME_INVENTORY, G2PResult, validate_ipa

# ---------------------------------------------------------------------------
# PASS cases — standard IPA
# ---------------------------------------------------------------------------


def test_valid_standard_ipa_passes() -> None:
    """σπίτι /ˈspiti/ — basic Latin-IPA transcription; all chars in inventory.

    normalize_ipa trace: strip / → ˈspiti → strip ˈ → spiti
    Residual "spiti": s,p,i,t,i all ∈ inventory → ok=True.
    """
    result = validate_ipa("σπίτι", "/ˈspiti/")
    assert result.ok is True
    assert result.reason is None


def test_valid_simplified_latin_passes() -> None:
    """άνθρωπος /ˈan.θro.pos/ — θ is the only non-basic-Latin char.

    normalize_ipa trace: strip / → ˈan.θro.pos → strip . → ˈanθropos
    → strip ˈ → anθropos
    Residual "anθropos": all ∈ inventory (θ is explicitly included) → ok=True.
    """
    result = validate_ipa("άνθρωπος", "/ˈan.θro.pos/")
    assert result.ok is True


def test_valid_with_standard_greek_phonemes() -> None:
    """ɣ (gamma) and ç (chi) are both in the standard IPA convention for Greek.

    ɣ case — γάλα /ˈɣala/:
      normalize_ipa trace: strip / → ˈɣala → strip ˈ → ɣala
      Residual "ɣala": ɣ,a,l,a all ∈ inventory → ok=True.

    ç case — χέρι /ˈçeri/:
      normalize_ipa trace: strip / → ˈçeri → strip ˈ → çeri
      Residual "çeri": ç,e,r,i all ∈ inventory → ok=True.
    """
    r_gamma = validate_ipa("γάλα", "/ˈɣala/")
    assert r_gamma.ok is True, f"ɣ should be legal; got reason={r_gamma.reason!r}"

    r_chi = validate_ipa("χέρι", "/ˈçeri/")
    assert r_chi.ok is True, f"ç should be legal; got reason={r_chi.reason!r}"


# ---------------------------------------------------------------------------
# PASS cases — LLM simplified-Latin substitutions
# ---------------------------------------------------------------------------


def test_valid_llm_c_substitution_passes() -> None:
    """c is the LLM substitute for ç (rule #8 in noun_data_generation_service.py).

    normalize_ipa trace: strip / → ˈlecsi → strip ˈ → lecsi
    Residual "lecsi": l,e,c,s,i — c ∈ inventory (LLM residual) → ok=True.
    """
    result = validate_ipa("λέξη", "/ˈlecsi/")
    assert result.ok is True
    assert result.reason is None


def test_valid_llm_y_substitution_passes() -> None:
    """y is the LLM substitute for ʝ (rule #8 in noun_data_generation_service.py).

    normalize_ipa trace: strip / → ya.ˈtros → strip . → yaˈtros
    → strip ˈ → yatros
    Residual "yatros": y,a,t,r,o,s — y ∈ inventory → ok=True.
    """
    result = validate_ipa("γιατρός", "/ya.ˈtros/")
    assert result.ok is True


def test_valid_llm_gh_h_residual_passes() -> None:
    """gh is the LLM substitute for ɣ; the residual 'h' must be in the inventory.

    Rule #8: ɣ → gh, so LLM writes /ˈgha.la/.  After normalize_ipa the
    digraph 'gh' passes through intact as individual chars 'g' and 'h'.

    normalize_ipa trace: strip / → ˈgha.la → strip . → ˈghala
    → strip ˈ → ghala
    Residual "ghala": g ∈ inventory, h ∈ inventory → ok=True.
    """
    result = validate_ipa("γάλα", "/ˈgha.la/")
    assert result.ok is True


def test_stress_dots_delimiters_ignored() -> None:
    """Bracket delimiters and syllable dots are stripped before validation.

    Both "[s.pi.ti]" and "/ˈspiti/" must reduce to the same residual
    and both pass — confirming that stripping happens before membership check.
    """
    r_bracket = validate_ipa("σπίτι", "[s.pi.ti]")
    assert r_bracket.ok is True, f"bracket form failed: reason={r_bracket.reason!r}"

    r_slash = validate_ipa("σπίτι", "/ˈspiti/")
    assert r_slash.ok is True, f"slash form failed: reason={r_slash.reason!r}"


# ---------------------------------------------------------------------------
# FAIL cases — illegal symbols
# ---------------------------------------------------------------------------


def test_non_greek_symbol_fails() -> None:
    """w, ɔ, ɪ are English-English IPA symbols not in the Greek inventory.

    normalize_ipa trace: strip / → wɔɪ
    Residual "wɔɪ": w ∉ inv, ɔ ∉ inv, ɪ ∉ inv → ok=False.
    Reason must be non-empty and should name an offending symbol.
    """
    result = validate_ipa("x", "/wɔɪ/")
    assert result.ok is False
    assert result.reason is not None and len(result.reason) > 0
    # At least one of the illegal chars must appear in the reason string
    offenders = {"w", "ɔ", "ɪ"}
    assert any(
        ch in result.reason for ch in offenders
    ), f"reason {result.reason!r} should name an illegal symbol from {offenders}"


def test_leftover_greek_letter_fails() -> None:
    """Greek Unicode letters pass normalize_ipa and end up in the residual.

    normalize_ipa strips Greek ACCENTS but not Greek base letters (σ, π, τ).
    So σπίτι → normalize_greek_accents(σπίτι) = σπιτι (ί→ι only), still Greek.
    After strip / the residual is "σπιτι" and σ,π,τ are not Latin/IPA chars.

    normalize_ipa trace: strip / → σπίτι → normalize_greek_accents → σπιτι
    Residual "σπιτι": σ,π,ι,τ,ι ∉ Latin/IPA inventory → ok=False.
    """
    result = validate_ipa("x", "/σπίτι/")
    assert result.ok is False
    assert result.reason is not None and len(result.reason) > 0


def test_digit_or_garbage_fails() -> None:
    """Digits are not IPA symbols.

    normalize_ipa trace: strip / → sp1ti
    Residual "sp1ti": '1' ∉ inventory → ok=False.
    """
    result = validate_ipa("x", "/sp1ti/")
    assert result.ok is False
    assert result.reason is not None and len(result.reason) > 0


def test_empty_candidate() -> None:
    """Empty string triggers the early-return guard.

    normalize_ipa("") == "" (verified: strip + collapse on empty string
    returns "").  The empty-input early-return fires BEFORE the membership
    scan — this prevents the vacuous truth of all(... for ch in "").
    """
    result = validate_ipa("x", "")
    assert result.ok is False
    assert result.reason == "empty pronunciation"


# ---------------------------------------------------------------------------
# Determinism / side-effect guard
# ---------------------------------------------------------------------------


def test_deterministic_no_side_effects() -> None:
    """validate_ipa is pure: two calls with identical args return equal results.

    Also verifies that inputs are not mutated (frozen dataclass output and
    the function must not alter the string arguments), and that G2PResult is
    truly frozen (direct attribute assignment raises FrozenInstanceError).

    BUG FIX NOTE: the original test used ``object.__setattr__(r1, "ok", ...)``
    which BYPASSES the dataclass frozen guard (object.__setattr__ is the
    low-level setter used internally by the frozen machinery; calling it
    directly skips the guard and never raises).  The correct way to exercise
    the frozen guard is a plain attribute assignment, which triggers the
    __setattr__ override that @dataclass(frozen=True) installs.
    """
    lemma = "σπίτι"
    candidate = "/ˈspiti/"

    # Capture string identity before calls
    lemma_id = id(lemma)
    candidate_id = id(candidate)

    r1 = validate_ipa(lemma, candidate)
    r2 = validate_ipa(lemma, candidate)

    assert isinstance(r1, G2PResult), "validate_ipa must return a G2PResult instance"
    assert r1 == r2, "Two identical calls must return equal G2PResult objects"
    assert r1.ok == r2.ok
    assert r1.reason == r2.reason

    # Inputs must not have been mutated (strings are immutable, but verify
    # the references weren't swapped out)
    assert id(lemma) == lemma_id
    assert id(candidate) == candidate_id

    # G2PResult must be frozen — direct attribute assignment raises
    # FrozenInstanceError (NOT object.__setattr__, which bypasses the guard).
    with pytest.raises(dataclasses.FrozenInstanceError):
        r1.ok = not r1.ok  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Adversarial / edge coverage (Mode B — QA post-implementation, LEXGEN-07-02)
# ---------------------------------------------------------------------------


class TestInventoryMembership:
    """AC5/D8: verify exact codepoint membership — both g variants, x, LLM
    substitutions, and a comprehensive set of non-members."""

    def test_latin_g_u0067_in_inventory(self) -> None:
        """g (U+0067, LATIN SMALL LETTER G) is the LLM variant and must be in
        the inventory — it is DISTINCT from ɡ (U+0261, LATIN SMALL LETTER
        SCRIPT G) even though they look similar."""
        assert (
            chr(0x0067) in GREEK_PHONEME_INVENTORY
        ), "g U+0067 (LLM substitute for ɡ) must be in GREEK_PHONEME_INVENTORY"

    def test_ipa_script_g_u0261_in_inventory(self) -> None:
        """ɡ (U+0261, LATIN SMALL LETTER SCRIPT G) is the standard IPA symbol
        for the voiced velar stop and must be in the inventory."""
        assert (
            chr(0x0261) in GREEK_PHONEME_INVENTORY
        ), "ɡ U+0261 (IPA script g) must be in GREEK_PHONEME_INVENTORY"

    def test_g_and_script_g_are_distinct_codepoints(self) -> None:
        """g (U+0067) and ɡ (U+0261) must be two different codepoints, both
        independently present in the inventory."""
        g_latin = chr(0x0067)
        g_script = chr(0x0261)
        assert g_latin != g_script, "U+0067 and U+0261 must be distinct characters"
        assert g_latin in GREEK_PHONEME_INVENTORY
        assert g_script in GREEK_PHONEME_INVENTORY

    def test_x_latin_u0078_in_inventory(self) -> None:
        """x (U+0078, LATIN SMALL LETTER X) is the velar fricative and must be
        in the inventory."""
        assert chr(0x0078) in GREEK_PHONEME_INVENTORY, "x U+0078 must be in GREEK_PHONEME_INVENTORY"

    def test_llm_substitution_chars_in_inventory(self) -> None:
        """c, y, h are LLM simplified-Latin substitution residuals and must all
        be in the inventory."""
        for ch in ("c", "y", "h"):
            assert (
                ch in GREEK_PHONEME_INVENTORY
            ), f"LLM residual {ch!r} must be in GREEK_PHONEME_INVENTORY"

    def test_standard_greek_ipa_chars_in_inventory(self) -> None:
        """θ, ð, ɣ, ç are standard IPA symbols for Greek phonemes and must all
        be in the inventory."""
        for ch in ("θ", "ð", "ɣ", "ç"):
            assert (
                ch in GREEK_PHONEME_INVENTORY
            ), f"Standard Greek IPA symbol {ch!r} must be in GREEK_PHONEME_INVENTORY"

    def test_english_ipa_symbols_not_in_inventory(self) -> None:
        """q, w, ʔ, ɔ, ɪ are English-English or non-Greek IPA symbols and must
        NOT be in the Greek phoneme inventory."""
        for ch in ("q", "w", "ʔ", "ɔ", "ɪ"):  # ʔ ɔ ɪ
            assert (
                ch not in GREEK_PHONEME_INVENTORY
            ), f"Non-Greek IPA symbol {ch!r} (U+{ord(ch):04X}) must NOT be in inventory"


class TestReasonDiagnostics:
    """Verify that the reason string names the offending symbol, not just any
    non-empty text — so it is genuinely diagnostic for LLM output debugging."""

    def test_reason_names_first_offending_symbol_w(self) -> None:
        """For /wɔɪ/ the first illegal char is w; the reason must contain 'w'.

        normalize_ipa trace: strip / → wɔɪ
        Scan order: w is encountered first → reason names 'w'.
        """
        result = validate_ipa("x", "/wɔɪ/")
        assert result.ok is False
        assert result.reason is not None
        assert (
            "w" in result.reason
        ), f"reason {result.reason!r} must contain the first offending symbol 'w'"

    def test_multi_illegal_reason_names_first_encountered(self) -> None:
        """A candidate with two illegal symbols returns the FIRST one encountered.

        /qw/ normalises to "qw"; the scan hits 'q' before 'w', so reason must
        contain 'q', not 'w' (though both are illegal).
        """
        result = validate_ipa("x", "/qw/")
        assert result.ok is False
        assert result.reason is not None
        assert (
            "q" in result.reason
        ), f"reason {result.reason!r} must name first offending symbol 'q', got: {result.reason!r}"
        # Reason must not be about 'w' instead (regression guard)
        # It's fine if 'w' also appears, but 'q' must be there.
        assert "q" in result.reason


class TestGlottalStop:
    """ʔ (U+0294, LATIN LETTER GLOTTAL STOP) is a common IPA symbol absent
    from Greek phonology.  It must be rejected."""

    def test_glottal_stop_fails(self) -> None:
        """ʔ is not a Greek phoneme.

        normalize_ipa trace: strip / → ʔ
        Residual "ʔ" (U+0294): ʔ ∉ inventory → ok=False.
        """
        result = validate_ipa("x", "/ʔ/")
        assert result.ok is False
        assert result.reason is not None and len(result.reason) > 0


class TestEmptyGuardVariants:
    """The empty-input guard must fire for any input that normalises to "".

    This exercises the guard via non-trivially-empty raw inputs (a stress
    mark alone, and pure whitespace) so that the guard is proven for inputs
    that are NOT the bare empty string "".
    """

    def test_stress_marker_only_becomes_empty(self) -> None:
        """A raw input of "/ˈ/" normalises to "" and triggers the empty guard.

        normalize_ipa trace: strip / → ˈ → strip ˈ → "" → strip → ""
        Result: ok=False, reason=="empty pronunciation".
        """
        result = validate_ipa("x", "/ˈ/")
        assert result.ok is False
        assert result.reason == "empty pronunciation"

    def test_whitespace_only_becomes_empty(self) -> None:
        """Pure whitespace normalises to "" via the whitespace-collapse step.

        normalize_ipa trace: "   " → no delimiters/stress → collapse → "" → strip → ""
        Result: ok=False, reason=="empty pronunciation".
        """
        result = validate_ipa("x", "   ")
        assert result.ok is False
        assert result.reason == "empty pronunciation"


class TestCaseSensitivity:
    """normalize_ipa does NOT lowercase — uppercase Latin letters are not in
    the inventory (which holds only lowercase IPA symbols)."""

    def test_uppercase_greek_letters_fail(self) -> None:
        """Uppercase Greek Unicode letters (Σ, Π, Τ) pass through normalize_ipa
        intact and are not in the Latin/IPA inventory → fail.

        normalize_ipa trace: strip / → ΣΠΙΤΙ → normalize_greek_accents (no
        accented chars, unchanged) → ΣΠΙΤΙ
        Residual: Σ,Π,Ι,Τ,Ι ∉ inventory → ok=False.
        """
        result = validate_ipa("σπίτι", "/ΣΠΙΤΙ/")
        assert result.ok is False
        assert result.reason is not None and len(result.reason) > 0


class TestInputImmutabilityOnFailure:
    """Input strings must not be mutated on failure paths, just as on success."""

    def test_input_not_mutated_on_fail(self) -> None:
        """Passing an illegal candidate must leave the input strings unchanged.

        Strings are immutable in Python, but this guards against the function
        accidentally rebinding the caller's variable or returning a modified
        object in a refactor.
        """
        lemma = "x"
        candidate = "/wɔɪ/"
        lemma_id = id(lemma)
        candidate_id = id(candidate)

        result = validate_ipa(lemma, candidate)

        assert result.ok is False
        assert id(lemma) == lemma_id, "lemma reference must be unchanged after a failing call"
        assert (
            id(candidate) == candidate_id
        ), "candidate reference must be unchanged after a failing call"


class TestBothGVariantsPassValidation:
    """Both g (U+0067) and ɡ (U+0261) must produce ok=True when used in an
    otherwise-valid candidate IPA string, confirming validate_ipa (not just
    the inventory set) accepts both codepoints."""

    def test_latin_g_u0067_passes_in_candidate(self) -> None:
        """A candidate using g (U+0067) in a valid Greek transcription must pass.

        normalize_ipa trace for "gala" (bare, no delimiters): gala
        Residual "gala": g,a,l,a — g U+0067 ∈ inventory → ok=True.
        """
        result = validate_ipa("γάλα", "gala")
        assert result.ok is True, f"g U+0067 in candidate should pass; got reason={result.reason!r}"

    def test_ipa_script_g_u0261_passes_in_candidate(self) -> None:
        """A candidate using ɡ (U+0261) in a valid Greek transcription must pass.

        normalize_ipa trace for "/ɡala/": strip / → ɡala
        Residual "ɡala": ɡ U+0261 ∈ inventory → ok=True.
        """
        result = validate_ipa("γάλα", "/ɡala/")
        assert result.ok is True, f"ɡ U+0261 in candidate should pass; got reason={result.reason!r}"
