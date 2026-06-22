"""Tests for the pure deterministic gate functions (LEXGEN-10-01).

Authored test-first (RALPH Stage 2.5 / QA Mode A); all tests are now GREEN.
The functions in ``src/core/lexgen_verify.py`` are fully implemented.
Tests cover the ``GateResult`` frozen dataclass and all gate function contracts.

Module contract (``src/core/lexgen_verify.py``):
  ``GateResult``          — frozen dataclass:
                            passed: bool
                            severity: Literal["pass","warn","fail"]
                            gate: str
                            offending: list[str]
                            reason: str | None
  ``normalize_lemma``     — ``lemma.lower()`` then ``unicodedata.normalize("NFC", …)``
                            Accents PRESERVED (no accent strip; monotonic).
  ``check_e``             — every non-target sub-lemma ∈ ``allowed ∪ {target}``;
                            failure → ``passed=False, severity="fail", offending=[…]``.
                            Target lemma never counts as offending even if absent from allowed.
  ``check_target_attested`` — target lemma absent from token_lemmas → ``passed=False``.
  ``check_gloss_subset``  — gloss (stripped) ∈ semicolons-split wiktionary_glosses
                            → severity="pass"; non-empty gloss not present → "warn";
                            empty/whitespace-only gloss → "fail".

Architecture §7 worked example (CE-01/CE-05):
  Sentence: "Η μητέρα διαβάζει ένα βιβλίο στο σπίτι."
  Post-skip / post-split / post-normalize token sub-lemma list:
    ["ο", "μητέρα", "διαβάζω", "βιβλίο", "σε", "ο", "σπίτι"]
    (ένα dropped: like_num=True; trailing . dropped: is_punct=True;
     στο → single spaCy token whose lemma_ == 'σε ο' → split → 'σε','ο')
  Target: "βιβλίο"
  Allowed: A2 set that includes {μητέρα, διαβάζω, σπίτι} ∪ closed-class {ο, σε, το, και}
           (does NOT contain βιβλίο — βιβλίο passes via target ∪ allowed)
"""

import dataclasses

import pytest

from src.core.lexgen_verify import (
    GateResult,
    check_e,
    check_gloss_subset,
    check_target_attested,
    normalize_lemma,
)

# ---------------------------------------------------------------------------
# Shared fixtures / constants
# ---------------------------------------------------------------------------

# The canonical §7 post-skip/post-split/post-normalize sub-lemma list.
# ένα is dropped (like_num=True), . is dropped (is_punct=True),
# στο → split to 'σε','ο' (spaCy: lemma_ == 'σε ο').
WORKED_EXAMPLE_LEMMAS: list[str] = [
    "ο",
    "μητέρα",
    "διαβάζω",
    "βιβλίο",
    "σε",
    "ο",
    "σπίτι",
]

WORKED_EXAMPLE_TARGET = "βιβλίο"

# An A2-compatible allowed set for the §7 worked example.
# Includes the open-class lemmas from the sentence EXCLUDING the target
# (target passes via the {target_lemma} union, not via allowed).
# Includes the closed-class whitelist required by §7.
WORKED_EXAMPLE_ALLOWED: set[str] = {
    "μητέρα",
    "διαβάζω",
    "σπίτι",
    # closed-class whitelist required by §7 (Acceptance Criteria)
    "ο",
    "σε",
    "το",
    "και",
}

# ---------------------------------------------------------------------------
# CE tests — check_e (closed-vocabulary gate)
# ---------------------------------------------------------------------------


class TestCheckE:
    """Test specs CE-01 through CE-05 from LEXGEN-10-01 Test Specs table."""

    def test_ce_01_worked_example(self) -> None:
        """CE-01: §7 canonical example passes Check E end-to-end.

        Token sub-lemmas = WORKED_EXAMPLE_LEMMAS (post-skip, post-split,
        post-normalize); allowed contains open-class + closed-class lemmas
        (NOT including βιβλίο); target = βιβλίο.
        βιβλίο passes via the {target_lemma} arm of the allowed ∪ {target} union.
        Expected: passed=True, severity="pass", offending=[].
        """
        result = check_e(
            WORKED_EXAMPLE_LEMMAS,
            WORKED_EXAMPLE_ALLOWED,
            WORKED_EXAMPLE_TARGET,
        )
        assert isinstance(result, GateResult)
        assert result.passed is True
        assert result.severity == "pass"
        assert result.gate == "check_e"
        assert result.offending == []

    def test_ce_02_out_of_vocab(self) -> None:
        """CE-02: a token lemma not in allowed (and not target) → fail.

        κβάντο is not in the allowed set and not the target.
        Expected: passed=False, severity="fail", offending=["κβάντο"].
        """
        lemmas = WORKED_EXAMPLE_LEMMAS + ["κβάντο"]
        result = check_e(lemmas, WORKED_EXAMPLE_ALLOWED, WORKED_EXAMPLE_TARGET)
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "check_e"
        assert "κβάντο" in result.offending

    def test_ce_03_target_not_counted(self) -> None:
        """CE-03: the target lemma does NOT cause a failure even when absent from allowed.

        βιβλίο is the target AND is NOT in the allowed set.  The target lemma
        must pass via {target_lemma}, never appear in offending.
        All other lemmas here are in the allowed set → overall pass.
        """
        # Build an allowed set that does NOT contain βιβλίο.
        allowed_without_target = WORKED_EXAMPLE_ALLOWED.copy()
        assert (
            WORKED_EXAMPLE_TARGET not in allowed_without_target
        ), "test pre-condition: allowed must not contain the target"
        result = check_e(
            WORKED_EXAMPLE_LEMMAS,
            allowed_without_target,
            WORKED_EXAMPLE_TARGET,
        )
        assert (
            result.passed is True
        ), "target lemma must not count as offending; check_e should pass"
        assert WORKED_EXAMPLE_TARGET not in result.offending

    def test_ce_04_closed_class_only(self) -> None:
        """CE-04: sentence whose non-target tokens are all closed-class → pass.

        Token lemmas: all closed-class (ο, σε, και) + target βιβλίο.
        All closed-class terms are in the allowed set.
        Expected: passed=True.
        """
        lemmas = ["ο", "σε", "και", "βιβλίο"]
        allowed = {"ο", "σε", "και", "το"}  # closed-class whitelist
        result = check_e(lemmas, allowed, "βιβλίο")
        assert result.passed is True
        assert result.severity == "pass"
        assert result.offending == []

    def test_ce_05_contraction_split_passes(self) -> None:
        """CE-05: sub-lemmas from a split contraction (στο→σε,ο) both closed-class → pass.

        The service splits 'σε ο' → ['σε','ο'] before calling check_e.
        This test supplies those sub-lemmas directly (as check_e sees them).
        Both σε and ο are in the allowed closed-class set → passed=True.
        """
        # Only the split sub-lemmas; the target is also in the lemma list.
        lemmas = ["σε", "ο", "βιβλίο"]
        allowed = {"σε", "ο", "το"}
        result = check_e(lemmas, allowed, "βιβλίο")
        assert result.passed is True
        assert result.offending == []


# ---------------------------------------------------------------------------
# TA tests — check_target_attested
# ---------------------------------------------------------------------------


class TestCheckTargetAttested:
    """Test specs TA-01 and TA-02 from LEXGEN-10-01 Test Specs table."""

    def test_ta_01_attested(self) -> None:
        """TA-01: token lemmas contain the target → passed=True, severity="pass"."""
        lemmas = ["ο", "μητέρα", "βιβλίο"]
        result = check_target_attested(lemmas, "βιβλίο")
        assert isinstance(result, GateResult)
        assert result.passed is True
        assert result.severity == "pass"
        assert result.gate == "target_attested"

    def test_ta_02_missing_target(self) -> None:
        """TA-02: target absent from token lemmas → passed=False, severity="fail"."""
        lemmas = ["ο", "μητέρα", "σπίτι"]
        result = check_target_attested(lemmas, "βιβλίο")
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "target_attested"


# ---------------------------------------------------------------------------
# GS tests — check_gloss_subset
# ---------------------------------------------------------------------------


class TestCheckGlossSubset:
    """Test specs GS-01 through GS-04 from LEXGEN-10-01 Test Specs table."""

    def test_gs_01_in_wiktionary(self) -> None:
        """GS-01: gloss present in the semicolon-delimited Wiktionary glosses → pass.

        Glosses string: "book; volume" → {"book", "volume"} after split+strip.
        Gloss "book" is among them → passed=True, severity="pass".
        """
        result = check_gloss_subset("book", "book; volume")
        assert isinstance(result, GateResult)
        assert result.passed is True
        assert result.severity == "pass"
        assert result.gate == "gloss_subset"

    def test_gs_02_not_in_wiktionary(self) -> None:
        """GS-02: non-empty gloss not present in glosses → warn (not fail).

        gloss "tome" is not in "book; volume" → passed=False, severity="warn".
        A warn is NOT a hard gate failure; it records the flag without triggering regen.
        """
        result = check_gloss_subset("tome", "book; volume")
        assert result.passed is False
        assert result.severity == "warn"
        assert result.gate == "gloss_subset"


# ---------------------------------------------------------------------------
# Adversarial / edge-case tests (Mode B — QA post-implementation)
# ---------------------------------------------------------------------------


class TestNormalizeLemmaAdversarial:
    """Adversarial and edge coverage for normalize_lemma beyond the AC specs."""

    def test_empty_string(self) -> None:
        """Empty string input must not raise; returns empty string."""
        result = normalize_lemma("")
        assert result == ""

    def test_nfd_input_composes_to_nfc(self) -> None:
        """NFD input (decomposed diacritics) is recomposed to NFC.

        "βιβλίο" in NFD form has the accent as a separate combining character.
        normalize_lemma must return the precomposed NFC form, so the output
        must equal the precomposed "βιβλίο" AND the length must match
        (NFD form has more code points).
        """
        import unicodedata

        # Build the NFD form explicitly.
        nfd_form = unicodedata.normalize("NFD", "βιβλίο")
        precomposed = "βιβλίο"  # NFC
        # Sanity-check: NFD and NFC are distinct byte sequences.
        assert nfd_form != precomposed, "test pre-condition: NFD and NFC must differ"
        assert len(nfd_form) > len(precomposed), "NFD must have more code points"

        result = normalize_lemma(nfd_form)
        assert result == precomposed, (
            f"NFD input must compose to NFC; got {result!r} (len={len(result)}) "
            f"expected {precomposed!r} (len={len(precomposed)})"
        )

    def test_final_sigma_lowercasing(self) -> None:
        """Python str.lower() applies context-sensitive sigma: word-final Σ → ς.

        normalize_lemma makes no explicit sigma-normalization claim beyond lower()+NFC,
        but it inherits Python's context-sensitive sigma lowercasing behavior.
        "ΟΔΟΣ" → "οδος" where the last char is ς (U+03C2, FINAL SIGMA), not
        σ (U+03C3, MEDIAL SIGMA).  This test documents that behavior so callers
        who build allowed sets from all-caps input know what form to expect.
        """
        result = normalize_lemma("ΟΔΟΣ")
        # Must be lowercased (no uppercase code points).
        assert result == result.lower(), "output must be fully lowercased"
        # Must be NFC.
        import unicodedata

        assert unicodedata.normalize("NFC", result) == result, "output must be NFC"
        # Σ lowercases to σ in Python (not ς), so the result contains σ.
        # Python's str.lower() applies context-sensitive sigma lowercasing:
        # word-final Σ → ς (U+03C2 FINAL SIGMA); medial Σ → σ (U+03C3).
        # In "ΟΔΟΣ" the last Σ is word-final, so the result is "οδος" with ς.
        assert (
            "ς" in result
        ), "word-final Σ must lowercase to ς (final sigma) per Python str.lower()"

    def test_leading_trailing_whitespace_preserved(self) -> None:
        """normalize_lemma does NOT strip whitespace — lower()+NFC only.

        The caller (verify service) is responsible for stripping before
        calling normalize_lemma.  This test documents the actual behavior
        so callers are not surprised.
        """
        result = normalize_lemma("  βιβλίο  ")
        # lower()+NFC does not strip, so the whitespace must remain.
        assert result == "  βιβλίο  ", (
            "normalize_lemma must not strip leading/trailing whitespace; " f"got {result!r}"
        )

    def test_uppercase_latin_passthrough(self) -> None:
        """Latin uppercase is lowercased correctly (no special Greek treatment)."""
        assert normalize_lemma("BOOK") == "book"


class TestCheckEAdversarial:
    """Adversarial and edge coverage for check_e beyond the AC specs."""

    def test_empty_token_lemmas_passes_vacuously(self) -> None:
        """Empty token_lemmas list → vacuous pass (no out-of-vocab lemmas).

        check_e finds no lemmas to check, so offending=[] → passed=True.
        This is a specification-level edge case: the verify service should
        never call check_e with an empty list in production, but the function
        must handle it gracefully.
        """
        result = check_e([], {"ο", "σε"}, "βιβλίο")
        assert result.passed is True
        assert result.severity == "pass"
        assert result.offending == []

    def test_duplicate_offending_lemmas_listed_both(self) -> None:
        """Duplicate out-of-vocab lemma appearing twice → listed in offending twice.

        The implementation uses a list comprehension without deduplication, so
        each occurrence of an offending lemma is listed separately.  This test
        documents the ACTUAL behavior (not deduplicated) so callers can rely on
        the count to reflect the number of token positions, not unique offenders.
        """
        lemmas = ["κβάντο", "ο", "κβάντο"]  # κβάντο appears twice
        result = check_e(lemmas, {"ο"}, "βιβλίο")
        assert result.passed is False
        assert result.severity == "fail"
        # Both occurrences must appear in offending (count=2).
        assert result.offending.count("κβάντο") == 2, (
            "each occurrence of an out-of-vocab lemma should be listed separately; "
            f"got offending={result.offending!r}"
        )

    def test_target_appearing_multiple_times_never_offending(self) -> None:
        """Target lemma appearing multiple times in token list → none are offending.

        Each occurrence of the target must be excluded from offending,
        even if the target is NOT in the allowed set.
        """
        lemmas = ["βιβλίο", "βιβλίο", "ο"]
        allowed = {"ο"}  # βιβλίο deliberately absent from allowed
        result = check_e(lemmas, allowed, "βιβλίο")
        assert result.passed is True
        assert result.offending == []

    def test_allowed_set_empty_target_only_sentence_passes(self) -> None:
        """allowed=empty, token_lemmas=[target] → pass (target is in {target_lemma})."""
        result = check_e(["βιβλίο"], set(), "βιβλίο")
        assert result.passed is True

    def test_allowed_set_empty_non_target_lemma_fails(self) -> None:
        """allowed=empty, non-target lemma → must fail and appear in offending."""
        result = check_e(["ο", "βιβλίο"], set(), "βιβλίο")
        assert result.passed is False
        assert "ο" in result.offending

    def test_offending_list_preserves_order(self) -> None:
        """offending list order must reflect token_lemmas order, not sorted."""
        lemmas = ["ζ", "α", "βιβλίο", "μ"]  # βιβλίο is target; ζ,α,μ are out-of-vocab
        allowed: set[str] = set()
        result = check_e(lemmas, allowed, "βιβλίο")
        assert result.offending == [
            "ζ",
            "α",
            "μ",
        ], f"offending list must preserve input order; got {result.offending!r}"


class TestCheckTargetAttestedAdversarial:
    """Adversarial and edge coverage for check_target_attested."""

    def test_empty_token_lemmas_fails(self) -> None:
        """Empty token_lemmas → target absent → passed=False, severity='fail'."""
        result = check_target_attested([], "βιβλίο")
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "target_attested"
        assert result.offending == []

    def test_reason_mentions_target_on_fail(self) -> None:
        """Failure reason must include the target lemma string for diagnostics."""
        result = check_target_attested(["ο", "μητέρα"], "βιβλίο")
        assert result.passed is False
        assert result.reason is not None
        assert (
            "βιβλίο" in result.reason
        ), f"reason must mention the missing target lemma; got {result.reason!r}"

    def test_pass_reason_is_none(self) -> None:
        """On pass, reason must be None (no noise in the result)."""
        result = check_target_attested(["βιβλίο"], "βιβλίο")
        assert result.passed is True
        assert result.reason is None


class TestCheckGlossSubsetAdversarial:
    """Adversarial and edge coverage for check_gloss_subset."""

    def test_case_sensitivity(self) -> None:
        """Gloss matching is case-sensitive: 'Book' does not match 'book'.

        The implementation does not normalise case before lookup.  'Book' is
        NOT in {'book', 'volume'} → severity='warn' (non-empty, not found).
        If this behaviour ever changes, the test will catch the regression.
        """
        result = check_gloss_subset("Book", "book; volume")
        # 'Book' != 'book' → not found → warn (not pass).
        assert result.passed is False
        assert result.severity == "warn", (
            "case mismatch must not pass; got severity="
            f"{result.severity!r}.  Gloss matching is case-sensitive."
        )

    def test_gloss_with_surrounding_whitespace_matches(self) -> None:
        """gloss_en with surrounding whitespace is stripped before comparison.

        ' book ' stripped → 'book', which is in {'book', 'volume'} → pass.
        """
        result = check_gloss_subset(" book ", "book; volume")
        assert result.passed is True
        assert result.severity == "pass"

    def test_wiktionary_glosses_none(self) -> None:
        """wiktionary_glosses=None → treat as empty → non-empty gloss gets 'warn'.

        None means no Wiktionary evidence was retrieved.  An empty gloss set
        can never contain any gloss, so any non-empty gloss → severity='warn'.
        """
        result = check_gloss_subset("book", None)
        assert result.passed is False
        assert (
            result.severity == "warn"
        ), f"no Wiktionary evidence → warn, not fail; got severity={result.severity!r}"

    def test_wiktionary_glosses_empty_string(self) -> None:
        """wiktionary_glosses='' (empty) → same as None → non-empty gloss → warn."""
        result = check_gloss_subset("book", "")
        assert result.passed is False
        assert result.severity == "warn"

    def test_gloss_is_substring_of_allowed_does_not_pass(self) -> None:
        """'boo' is a substring of 'book' but NOT a member of {'book'} → warn.

        Membership is exact-match after strip, NOT substring matching.
        """
        result = check_gloss_subset("boo", "book; volume")
        assert result.passed is False
        assert (
            result.severity == "warn"
        ), "'boo' is not 'book'; substring must not pass membership check"

    def test_gloss_containing_semicolon_not_found(self) -> None:
        """A gloss containing a semicolon is treated as a single token.

        'book; volume' as a gloss_en argument is itself one string after strip;
        it will NOT match either individual entry 'book' or 'volume' in the
        wiktionary set {'book', 'volume'} → warn.
        """
        result = check_gloss_subset("book; volume", "book; volume")
        # The split produces {'book', 'volume'}.
        # The stripped gloss is 'book; volume' which is NOT in {'book', 'volume'}.
        assert result.passed is False
        assert result.severity == "warn"

    def test_wiktionary_glosses_extra_spaces_around_semicolon(self) -> None:
        """Wiktionary gloss entries with extra surrounding spaces are stripped.

        "book ;  volume" → entries after split+strip = {'book', 'volume'}.
        'book' should still match.
        """
        result = check_gloss_subset("book", "book ;  volume")
        assert result.passed is True
        assert result.severity == "pass"

    def test_wiktionary_glosses_empty_entries_between_semicolons_ignored(self) -> None:
        """Double semicolons (empty entries) in wiktionary_glosses are ignored.

        'book;;volume' → split → ['book', '', 'volume'] → stripped → filter removes ''.
        'book' still matches.
        """
        result = check_gloss_subset("book", "book;;volume")
        assert result.passed is True
        assert result.severity == "pass"

    def test_empty_gloss_with_none_wiktionary_is_still_fail(self) -> None:
        """Empty gloss with wiktionary_glosses=None → fail (empty gloss wins over warn)."""
        result = check_gloss_subset("", None)
        assert result.passed is False
        assert result.severity == "fail"

    def test_whitespace_only_gloss_with_none_wiktionary_is_still_fail(self) -> None:
        """Whitespace-only gloss with wiktionary_glosses=None → fail (empty wins)."""
        result = check_gloss_subset("   ", None)
        assert result.passed is False
        assert result.severity == "fail"

    def test_gs_03_whitespace_gloss(self) -> None:
        """GS-03: whitespace-only gloss is rejected as a hard failure (severity="fail").

        Memory note: "strip/reject whitespace-only glosses."
        gloss "   " → stripped → "" → empty → severity="fail".
        """
        result = check_gloss_subset("   ", "book")
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "gloss_subset"

    def test_gs_04_empty_gloss(self) -> None:
        """GS-04: empty string gloss → severity="fail" (hard gate failure).

        An empty gloss is never a valid gloss; must not pass via any path.
        """
        result = check_gloss_subset("", "book")
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "gloss_subset"


# ---------------------------------------------------------------------------
# NORM tests — normalize_lemma
# ---------------------------------------------------------------------------


class TestNormalizeLemma:
    """Test spec NORM-01 and idempotency edge from LEXGEN-10-01 Test Specs."""

    def test_norm_01_accent_preserved(self) -> None:
        """NORM-01: normalize_lemma lowercases and NFC-normalizes, PRESERVING accents.

        "Βιβλίο" → lower → "βιβλίο" → NFC → "βιβλίο" (accent retained).
        This matches the CEFR loader normalization (load_cefr_lemma.py).
        """
        result = normalize_lemma("Βιβλίο")
        assert result == "βιβλίο", f"normalize_lemma must lower+NFC, keeping accent; got {result!r}"
        # Confirm accent is still present in the output.
        assert "ί" in result, "monotonic accent must be preserved (no accent strip)"

    def test_norm_edge_idempotent(self) -> None:
        """Edge: normalize_lemma on an already-lowercase NFC string is idempotent.

        Calling normalize_lemma twice must return the same string as calling it once.
        """
        already_normalized = "βιβλίο"
        once = normalize_lemma(already_normalized)
        twice = normalize_lemma(once)
        assert once == twice == already_normalized

    def test_norm_mixed_case(self) -> None:
        """Sentence-case lemma is lowercased correctly."""
        assert normalize_lemma("Μητέρα") == "μητέρα"

    def test_norm_all_caps(self) -> None:
        """All-caps Greek lemma is fully lowercased."""
        assert normalize_lemma("ΣΠΙΤΙ") == "σπίτι" or normalize_lemma("ΣΠΙΤΙ") == "σπιτι"
        # The key invariant: output must be lowercase (no uppercase Greek).
        result = normalize_lemma("ΣΠΙΤΙ")
        assert result == result.lower(), "output must be fully lowercased"


# ---------------------------------------------------------------------------
# GateResult dataclass contract
# ---------------------------------------------------------------------------


class TestGateResultContract:
    """Verify GateResult is a frozen dataclass with the specified fields.

    These tests resolve on the stub (GateResult is trivially defined) and
    stay green through implementation — they guard the public surface contract.
    """

    def test_gate_result_is_frozen(self) -> None:
        """GateResult must be frozen — attribute assignment raises FrozenInstanceError."""
        result = GateResult(
            passed=True,
            severity="pass",
            gate="check_e",
            offending=[],
            reason=None,
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            result.passed = False  # type: ignore[misc]

    def test_gate_result_fields(self) -> None:
        """GateResult must expose all five contract fields with correct types."""
        result = GateResult(
            passed=False,
            severity="fail",
            gate="check_e",
            offending=["κβάντο"],
            reason="out of vocab",
        )
        assert result.passed is False
        assert result.severity == "fail"
        assert result.gate == "check_e"
        assert result.offending == ["κβάντο"]
        assert result.reason == "out of vocab"

    def test_gate_result_pass_variant(self) -> None:
        """A passing GateResult has severity='pass' and empty offending."""
        result = GateResult(
            passed=True,
            severity="pass",
            gate="target_attested",
            offending=[],
            reason=None,
        )
        assert result.passed is True
        assert result.severity == "pass"
        assert result.offending == []
        assert result.reason is None

    def test_gate_result_warn_variant(self) -> None:
        """A warn GateResult has passed=False but severity='warn' (not 'fail')."""
        result = GateResult(
            passed=False,
            severity="warn",
            gate="gloss_subset",
            offending=[],
            reason="gloss not in Wiktionary",
        )
        assert result.passed is False
        assert result.severity == "warn"
