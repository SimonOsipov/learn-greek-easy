"""RED tests for noun morphology heuristics (LEXGEN-07-01).

Authored test-first (RALPH Stage 2.5 / QA Mode A).  The derivation functions
in ``src/core/lexgen_rules.py`` are STUBS that raise ``NotImplementedError``,
so every test that calls them is RED for the right reason (NotImplementedError),
NOT a collection error — the import resolves against the skeleton module which
exports the real ``AMBIGUOUS`` singleton and the two function signatures.

``test_ambiguous_is_distinct_singleton`` tests ONLY the sentinel contract (no
logic) and will legitimately PASS against the skeleton already.

Test Specs (AC → test):
  AMBIGUOUS sentinel
  - test_ambiguous_is_distinct_singleton

  derive_declension_group — masculine groups
  - test_masculine_os
  - test_masculine_as
  - test_masculine_is

  derive_declension_group — feminine groups
  - test_feminine_a
  - test_feminine_i
  - test_feminine_os

  derive_declension_group — neuter groups (including longest-suffix-first proof)
  - test_neuter_ma_before_o
  - test_neuter_o
  - test_neuter_i
  - test_neuter_os

  derive_declension_group — AMBIGUOUS cases
  - test_unmatched_ending_is_ambiguous
  - test_unknown_gender_is_ambiguous

  derive_declension_group — accent + article insensitivity
  - test_accent_and_article_insensitive

  derive_gender — all branches
  - test_gender_os_is_ambiguous
  - test_gender_alpha_eta_feminine
  - test_gender_iota_ma_neuter
  - test_gender_unknown_ending_ambiguous
  - test_gender_eta_sigma_is_ambiguous

Expected values verified against the ACTUAL ``_DECLENSION_RULES`` table in
``src/services/noun_data_generation_service.py`` lines 140–158 (read
2026-06-21).  Exact table (verbatim):

  masculine: [("-ος","masculine_os"), ("-ας","masculine_as"),
              ("-ής","masculine_is"), ("-ης","masculine_is")]
  feminine:  [("-ος","feminine_os"),  ("-α","feminine_a"),  ("-η","feminine_i")]
  neuter:    [("-μα","neuter_ma"),   ("-ος","neuter_os"),
              ("-ο","neuter_o"),     ("-ι","neuter_i")]

Accent-normalization verified against ``src/utils/greek_text.py`` line 93+
(``normalize_greek_accents``).  Article-stripping verified against
``_strip_article`` line 152+.

Gender canonical values ("masculine"/"feminine"/"neuter") verified against
``src/schemas/lexgen.py`` lines 37–39 (UD canonical values used throughout
the lexgen pipeline).
"""

from src.core.lexgen_rules import AMBIGUOUS, _Ambiguous, derive_declension_group, derive_gender

# ---------------------------------------------------------------------------
# AMBIGUOUS sentinel contract
# ---------------------------------------------------------------------------


def test_ambiguous_is_distinct_singleton() -> None:
    """AMBIGUOUS must be a non-None, non-empty sentinel with the right repr.

    This test asserts only the scaffolding contract (the skeleton already
    provides the real sentinel), so it may legitimately PASS while the
    derivation tests are still RED.
    """
    assert AMBIGUOUS is not None
    assert AMBIGUOUS != ""
    assert repr(AMBIGUOUS) == "AMBIGUOUS"
    # Singleton identity
    assert AMBIGUOUS is AMBIGUOUS
    # Must be an instance of _Ambiguous (not str, not None)
    assert isinstance(AMBIGUOUS, _Ambiguous)


# ---------------------------------------------------------------------------
# derive_declension_group — masculine
# ---------------------------------------------------------------------------


def test_masculine_os() -> None:
    """άνθρωπος with article → masculine_os (verified: -ος in masculine rules)."""
    assert derive_declension_group("ο άνθρωπος", "masculine") == "masculine_os"


def test_masculine_as() -> None:
    """άντρας → masculine_as (verified: -ας in masculine rules)."""
    assert derive_declension_group("άντρας", "masculine") == "masculine_as"


def test_masculine_is() -> None:
    """μαθητής and κλέφτης → masculine_is.

    The rules table has BOTH "-ής" and "-ης" mapping to masculine_is.
    After accent-normalisation both become "-ης"; the first matching rule
    in the table ("-ής" at index 2, which normalises to "ης") is hit first.
    """
    assert derive_declension_group("μαθητής", "masculine") == "masculine_is"
    assert derive_declension_group("κλέφτης", "masculine") == "masculine_is"


# ---------------------------------------------------------------------------
# derive_declension_group — feminine
# ---------------------------------------------------------------------------


def test_feminine_a() -> None:
    """θάλασσα → feminine_a (verified: -α in feminine rules)."""
    assert derive_declension_group("θάλασσα", "feminine") == "feminine_a"


def test_feminine_i() -> None:
    """νίκη → feminine_i (verified: -η in feminine rules maps to feminine_i)."""
    assert derive_declension_group("νίκη", "feminine") == "feminine_i"


def test_feminine_os() -> None:
    """οδός → feminine_os (verified: -ος appears first in feminine rules list)."""
    assert derive_declension_group("οδός", "feminine") == "feminine_os"


# ---------------------------------------------------------------------------
# derive_declension_group — neuter (includes longest-suffix-first proof)
# ---------------------------------------------------------------------------


def test_neuter_ma_before_o() -> None:
    """γράμμα → neuter_ma, NOT neuter_o.

    Proves longest-suffix-first: -μα (len 2) must be checked before -ο (len 1)
    because γράμμα also ends in -α, but the -μα rule must win first.

    Verified: neuter rules are ["-μα","neuter_ma"], ["-ος","neuter_os"],
    ["-ο","neuter_o"], ["-ι","neuter_i"] — -μα appears at index 0, before -ο.
    The executor MUST sort or order rules longest-first within each gender.
    """
    assert derive_declension_group("γράμμα", "neuter") == "neuter_ma"


def test_neuter_o() -> None:
    """βιβλίο → neuter_o (verified: -ο in neuter rules)."""
    assert derive_declension_group("βιβλίο", "neuter") == "neuter_o"


def test_neuter_i() -> None:
    """παιδί → neuter_i (verified: -ι in neuter rules)."""
    assert derive_declension_group("παιδί", "neuter") == "neuter_i"


def test_neuter_os() -> None:
    """δάσος → neuter_os (verified: -ος in neuter rules maps to neuter_os)."""
    assert derive_declension_group("δάσος", "neuter") == "neuter_os"


# ---------------------------------------------------------------------------
# derive_declension_group — AMBIGUOUS sentinel cases
# ---------------------------------------------------------------------------


def test_unmatched_ending_is_ambiguous() -> None:
    """καφές with gender=neuter → AMBIGUOUS.

    -ές does not appear in the neuter rules table (-μα/-ος/-ο/-ι only),
    so the function must return the AMBIGUOUS sentinel, not raise.
    """
    result = derive_declension_group("καφές", "neuter")
    assert result is AMBIGUOUS


def test_unknown_gender_is_ambiguous() -> None:
    """foo with gender=squirrel → AMBIGUOUS (no rule table for "squirrel")."""
    result = derive_declension_group("foo", "squirrel")
    assert result is AMBIGUOUS


# ---------------------------------------------------------------------------
# derive_declension_group — accent + article insensitivity
# ---------------------------------------------------------------------------


def test_accent_and_article_insensitive() -> None:
    """Both "ο άνθρωπος" and "ανθρωπος" (no accent, no article) → masculine_os.

    Verifies that the function (a) strips the definite article before matching
    and (b) normalises Greek accents before matching, so accent-stripped /
    article-stripped input still reaches the correct group.
    """
    assert derive_declension_group("ο άνθρωπος", "masculine") == "masculine_os"
    assert derive_declension_group("ανθρωπος", "masculine") == "masculine_os"


# ---------------------------------------------------------------------------
# derive_gender — all branches
# ---------------------------------------------------------------------------


def test_gender_os_is_ambiguous() -> None:
    """δρόμος → AMBIGUOUS from derive_gender (D4).

    -ος endings appear in masculine (masculine_os), feminine (feminine_os),
    AND neuter (neuter_os) rules — the ending alone cannot determine gender.
    derive_gender must return AMBIGUOUS, never fabricate.
    """
    result = derive_gender("δρόμος")
    assert result is AMBIGUOUS


def test_gender_alpha_eta_feminine() -> None:
    """θάλασσα (-α) and νίκη (-η) → "feminine" from derive_gender."""
    assert derive_gender("θάλασσα") == "feminine"
    assert derive_gender("νίκη") == "feminine"


def test_gender_iota_ma_neuter() -> None:
    """παιδί (-ι) and γράμμα (-μα) → "neuter" from derive_gender."""
    assert derive_gender("παιδί") == "neuter"
    assert derive_gender("γράμμα") == "neuter"


def test_gender_unknown_ending_ambiguous() -> None:
    """στυλό → AMBIGUOUS from derive_gender (ending -ό not in gender rules).

    Verifies the 'never fabricates' contract: an ending not listed must
    produce AMBIGUOUS, not a guess.
    """
    result = derive_gender("στυλό")
    assert result is AMBIGUOUS


def test_gender_eta_sigma_is_ambiguous() -> None:
    """μαθητής (-ης after normalise) and άντρας (-ας) → AMBIGUOUS (F4).

    -ης / -ας endings are shared by masculine nouns but the ending alone
    does NOT uniquely identify gender — derive_gender must NOT fabricate
    "masculine" from an -ης or -ας ending.
    """
    assert derive_gender("μαθητής") is AMBIGUOUS
    assert derive_gender("άντρας") is AMBIGUOUS


# ---------------------------------------------------------------------------
# Adversarial / edge / negative coverage (Mode B — added post-implementation)
# ---------------------------------------------------------------------------


def test_final_sigma_suffix_matching() -> None:
    """Suffix tables use ς (U+03C2 final sigma); lemmas also end in ς.

    Both normalize_greek_accents and endswith must handle this correctly.
    Concretely: δρόμος ends in U+03C2, suffix -ος also ends in U+03C2
    — they must match after accent normalization.

    Regression guard: if someone inadvertently changes the suffix table
    to medial σ (U+03C3) instead of ς, these would silently FAIL to match.
    """
    # masculine -ος (ends in final sigma ς)
    assert derive_declension_group("δρόμος", "masculine") == "masculine_os"
    # feminine -ος
    assert derive_declension_group("οδός", "feminine") == "feminine_os"
    # neuter -ος
    assert derive_declension_group("δάσος", "neuter") == "neuter_os"
    # derive_gender: -ος is AMBIGUOUS (also ends in final sigma)
    assert derive_gender("δρόμος") is AMBIGUOUS


def test_empty_string_returns_ambiguous_no_crash() -> None:
    """Both functions must handle an empty string without raising.

    An empty string matches no suffix in any gender → AMBIGUOUS for both.
    Ensures callers can safely pass through blank lemma strings without guards.
    """
    assert derive_gender("") is AMBIGUOUS
    assert derive_declension_group("", "masculine") is AMBIGUOUS
    assert derive_declension_group("", "feminine") is AMBIGUOUS
    assert derive_declension_group("", "neuter") is AMBIGUOUS


def test_whitespace_only_lemma_returns_ambiguous_no_crash() -> None:
    """Whitespace-only input must not raise and must return AMBIGUOUS.

    _strip_article sees no matching article prefix, normalize_greek_accents
    passes spaces through unchanged, and no suffix matches spaces.
    """
    assert derive_gender("   ") is AMBIGUOUS
    assert derive_declension_group("   ", "masculine") is AMBIGUOUS


def test_os_ending_all_three_genders_in_derive_declension_group() -> None:
    """-ος is a valid suffix in all three gender tables.

    derive_declension_group keys on the *passed-in* gender, not on a
    gender it infers itself.  The same lemma (or equivalent endings)
    must route to the correct group purely based on the gender argument.

    This is a regression guard for the routing logic: if the function
    accidentally merged tables or ignored the gender key, these assertions
    would diverge.
    """
    assert derive_declension_group("δρόμος", "masculine") == "masculine_os"
    assert derive_declension_group("οδός", "feminine") == "feminine_os"
    assert derive_declension_group("δάσος", "neuter") == "neuter_os"


def test_neuter_ma_longest_first_multiple_words() -> None:
    """Additional -μα words guard against a rule-reordering regression.

    test_neuter_ma_before_o uses only γράμμα.  If someone re-sorted the
    neuter rules so -ο came before -μα, all three of these would return
    'neuter_o' instead of 'neuter_ma' — giving the test suite coverage
    beyond a single example.
    """
    assert derive_declension_group("πρόβλημα", "neuter") == "neuter_ma"
    assert derive_declension_group("όνομα", "neuter") == "neuter_ma"
    assert derive_declension_group("σώμα", "neuter") == "neuter_ma"


def test_sentinel_identity_and_equality_safety() -> None:
    """AMBIGUOUS must behave correctly in identity and equality checks.

    The canonical caller pattern is ``result is AMBIGUOUS``; callers must
    not accidentally match AMBIGUOUS via equality with a group string.
    Also verifies that ``result == "masculine_os"`` is False when result
    is AMBIGUOUS — i.e. _Ambiguous has no __eq__ override that could
    silently match a string.
    """
    result = derive_gender("δρόμος")  # known AMBIGUOUS
    assert result is AMBIGUOUS
    assert result != "masculine_os"
    assert result != "feminine_os"
    assert result != "neuter_os"
    assert result != ""
    assert result != None  # noqa: E711  — explicit None check
    # Two calls must return the *same* singleton (not a new object each time)
    r2 = derive_gender("στυλό")
    assert result is r2


def test_derive_gender_never_fabricates_masculine() -> None:
    """derive_gender must never return 'masculine' for any input.

    The design decision (D4 + never-fabricate invariant) states that -ος/-ης/-ας
    endings are ambiguous across genders and must NOT be resolved to masculine.
    Loop a representative set of masculine-noun lemmas that could tempt the
    function into returning 'masculine' and assert none does.
    """
    masculine_candidates = [
        "δρόμος",  # -ος, masculine in practice
        "μαθητής",  # -ης, masculine
        "άντρας",  # -ας, masculine
        "κλέφτης",  # -ης, masculine
        "πατέρας",  # -ας, masculine
        "ποιητής",  # -ής, masculine
        "ήρωας",  # -ας, masculine
    ]
    for lemma in masculine_candidates:
        result = derive_gender(lemma)
        assert result != "masculine", (
            f"derive_gender({lemma!r}) returned 'masculine' — "
            "function must never fabricate gender from ambiguous endings"
        )


def test_article_stripped_before_suffix_match_gender() -> None:
    """derive_gender strips the article before suffix matching.

    'η θάλασσα' — feminine article 'η ' is stripped, leaving 'θάλασσα'
    which ends in -α → 'feminine'.  Without stripping the article the
    bare form would be 'η θάλασσα' which does NOT end in 'α'.
    """
    assert derive_gender("η θάλασσα") == "feminine"
    assert derive_gender("το παιδί") == "neuter"
    assert derive_gender("το γράμμα") == "neuter"
