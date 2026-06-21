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

import pytest

from src.core.lexgen_g2p import G2PResult, validate_ipa

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
    the function must not alter the string arguments).
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

    # G2PResult must be frozen (mutation must raise FrozenInstanceError)
    with pytest.raises(Exception):  # dataclasses.FrozenInstanceError (Python 3.11+)
        object.__setattr__(r1, "ok", not r1.ok)
