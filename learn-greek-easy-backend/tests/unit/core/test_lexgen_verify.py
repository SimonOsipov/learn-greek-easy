"""RED tests for the pure deterministic gate functions (LEXGEN-10-01).

Authored test-first (RALPH Stage 2.5 / QA Mode A).  The functions in
``src/core/lexgen_verify.py`` are STUBS that raise ``NotImplementedError``,
so every test that calls a gate function is RED for the right reason
(NotImplementedError), NOT a collection error — the import resolves against
the skeleton which exports the real ``GateResult`` frozen dataclass and the
function signatures.

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
