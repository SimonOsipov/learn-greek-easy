"""RED — LEXGEN-06-01 EvidencePacket schema acceptance-criteria tests (Mode A).

These tests are authored BEFORE the schema is implemented. Every test must
FAIL because ``EvidencePacket`` (and its per-source sub-models) do not yet
exist. The intended failure reason is ``ImportError`` at the point each test
attempts the import — NOT a typo or collection error in the test itself.

Imports are deferred INTO each test function (not at module level) so that
pytest can COLLECT all 6 tests, and each test individually fails with the
schema-not-implemented ``ImportError``.  Once the executor adds the symbols,
the imports resolve and assertions take over.

Primary import target: ``src.schemas.lexgen``  (the existing LEXGEN schema
module). The executor may instead create ``src.schemas.evidence`` as a
thin module that re-exports from there — if so, update the import helper
``_import_symbols`` below. The current path is intentionally
``src.schemas.lexgen`` because that is the canonical home named in the
LEXGEN-06 story.

Design contract pinned by these tests
--------------------------------------
Top-level ``EvidencePacket`` fields:
    - ``lemma_input``      : str  — the raw input lemma string
    - ``normalized_lemma`` : str  — the normalised form
    - ``pos``              : str  — part-of-speech (free text, POS-neutral)
    - ``sources``          : EvidencePacketSources  — per-source sub-model

``EvidencePacketSources`` fields:
    - ``wiktionary``    : WiktionarySource        — Wiktionary evidence
    - ``greek_lexicon`` : GreekLexiconSource      — GreekLexicon evidence
    - ``frequency``     : FrequencySource         — frequency rank/band
    - ``rules``         : RulesSource             — rule-based resolver stub

Per-source ``present: bool`` discriminator is REQUIRED (intentional deviation
from nullable-None convention — the evidence packet is an auditable provenance
snapshot). "Consulted but absent" must be explicit.

Absent-source shapes (from D-RULESSTUB + AC-6):
    frequency absent  → {"present": false, "rank": null, "band": null}
    rules absent      → {"present": false}   — no resolver fields

``FormBundle`` reuse: ``wiktionary`` and ``greek_lexicon`` sources carry
``forms: list[FormBundle]`` (LEXGEN-02). ``FormBundle.features`` keys must be
∈ ``FEATURE_KEYS`` (10-key controlled vocabulary).
"""

import json

import pytest


def _import_symbols():
    """Lazy import of the not-yet-implemented schema symbols.

    Called at the top of each test function so that pytest can collect all
    6 tests individually, and each fails with ImportError (schema-not-implemented)
    rather than all 6 collapsing into a single collection error.

    If the executor places the schema in src.schemas.evidence instead, update
    this import path.
    """
    from src.schemas.lexgen import (  # noqa: PLC0415
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    )

    return (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    )


# ---------------------------------------------------------------------------
# AC-1: schema keys
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_evidence_packet_has_four_declared_sources():
    """AC-1: a fully-populated packet's dump has the required top-level and source keys.

    Given   an EvidencePacket with all four sources supplied
    When    model_dump() is called
    Then    the dict has top-level keys lemma_input/normalized_lemma/pos/sources
            AND sources has exactly the four sub-keys wiktionary/greek_lexicon/frequency/rules.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    wiktionary = WiktionarySource(
        present=True,
        forms=[
            FormBundle(
                form="γυναίκα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            )
        ],
    )
    lexicon = GreekLexiconSource(
        present=True,
        forms=[
            FormBundle(
                form="γυναίκα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            )
        ],
    )
    frequency = FrequencySource(present=True, rank=42, band="high")
    rules = RulesSource(present=True)

    packet = EvidencePacket(
        lemma_input="Γυναίκα",
        normalized_lemma="γυναίκα",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=wiktionary,
            greek_lexicon=lexicon,
            frequency=frequency,
            rules=rules,
        ),
    )
    dumped = packet.model_dump()

    # Top-level required keys
    assert "lemma_input" in dumped, "missing top-level key: lemma_input"
    assert "normalized_lemma" in dumped, "missing top-level key: normalized_lemma"
    assert "pos" in dumped, "missing top-level key: pos"
    assert "sources" in dumped, "missing top-level key: sources"

    sources_dump = dumped["sources"]
    # Four per-source keys
    assert "wiktionary" in sources_dump, "sources missing: wiktionary"
    assert "greek_lexicon" in sources_dump, "sources missing: greek_lexicon"
    assert "frequency" in sources_dump, "sources missing: frequency"
    assert "rules" in sources_dump, "sources missing: rules"

    # Values of top-level scalar fields survived
    assert dumped["lemma_input"] == "Γυναίκα"
    assert dumped["normalized_lemma"] == "γυναίκα"
    assert dumped["pos"] == "noun"


# ---------------------------------------------------------------------------
# AC-2: FormBundle reuse
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_evidence_packet_forms_are_formbundles():
    """AC-2: forms inside wiktionary and greek_lexicon sources are FormBundle instances.

    Given   a packet with wiktionary and lexicon sources that carry form lists
    When    the packet is validated
    Then    each entry in .sources.wiktionary.forms / .greek_lexicon.forms is a
            FormBundle instance, and every features key is in FEATURE_KEYS.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    wiktionary = WiktionarySource(
        present=True,
        forms=[
            FormBundle(
                form="γυναίκα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            ),
            FormBundle(
                form="γυναικών",
                features={"case": "genitive", "number": "plural", "gender": "feminine"},
            ),
        ],
    )
    lexicon = GreekLexiconSource(
        present=True,
        forms=[
            FormBundle(
                form="γυναίκα",
                features={"case": "nominative", "number": "singular", "gender": "feminine"},
            ),
        ],
    )
    packet = EvidencePacket(
        lemma_input="γυναίκα",
        normalized_lemma="γυναίκα",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=wiktionary,
            greek_lexicon=lexicon,
            frequency=FrequencySource(present=True, rank=10, band="high"),
            rules=RulesSource(present=True),
        ),
    )

    # Wiktionary forms
    wikt_forms = packet.sources.wiktionary.forms
    assert len(wikt_forms) >= 1, "wiktionary.forms must be non-empty"
    for fb in wikt_forms:
        assert isinstance(fb, FormBundle), f"expected FormBundle, got {type(fb)}"
        unknown_keys = set(fb.features.keys()) - FEATURE_KEYS
        assert (
            not unknown_keys
        ), f"FormBundle.features has keys outside FEATURE_KEYS: {unknown_keys}"

    # GreekLexicon forms
    lexicon_forms = packet.sources.greek_lexicon.forms
    assert len(lexicon_forms) >= 1, "greek_lexicon.forms must be non-empty"
    for fb in lexicon_forms:
        assert isinstance(fb, FormBundle), f"expected FormBundle, got {type(fb)}"
        unknown_keys = set(fb.features.keys()) - FEATURE_KEYS
        assert (
            not unknown_keys
        ), f"FormBundle.features has keys outside FEATURE_KEYS: {unknown_keys}"


# ---------------------------------------------------------------------------
# AC-3: rules stub defaults to absent
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_rules_source_defaults_to_absent_stub():
    """AC-3: constructing EvidencePacket with an absent rules source gives present=false, no resolver fields.

    Given   a RulesSource with present=False
    When    sources.rules is serialised via model_dump(mode="json")
    Then    the result equals {"present": false} — no resolver fields leak in.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    wiktionary = WiktionarySource(
        present=True,
        forms=[FormBundle(form="σπίτι", features={"case": "nominative", "number": "singular"})],
    )
    lexicon = GreekLexiconSource(
        present=True,
        forms=[FormBundle(form="σπίτι", features={"case": "nominative", "number": "singular"})],
    )
    packet = EvidencePacket(
        lemma_input="σπίτι",
        normalized_lemma="σπίτι",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=wiktionary,
            greek_lexicon=lexicon,
            frequency=FrequencySource(present=True, rank=5, band="high"),
            rules=RulesSource(present=False),
        ),
    )
    rules_dump = packet.sources.rules.model_dump(mode="json")

    # Must be exactly {"present": false} — the D-RULESSTUB contract.
    assert rules_dump == {
        "present": False
    }, f"rules absent shape must be exactly {{'present': False}}, got: {rules_dump}"


# ---------------------------------------------------------------------------
# AC-4: JSON-serializable
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_evidence_packet_dump_is_json_serializable():
    """AC-4: a fully-populated packet serialises to JSON without TypeError.

    Given   a fully-populated EvidencePacket (all sources present)
    When    json.dumps(packet.model_dump(mode="json")) is called
    Then    it succeeds — no TypeError, no unserializable types.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    packet = EvidencePacket(
        lemma_input="Γυναίκα",
        normalized_lemma="γυναίκα",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    )
                ],
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    )
                ],
            ),
            frequency=FrequencySource(present=True, rank=42, band="high"),
            rules=RulesSource(present=True),
        ),
    )

    try:
        serialised = json.dumps(packet.model_dump(mode="json"))
    except TypeError as exc:
        pytest.fail(f"model_dump(mode='json') produced a non-serializable value: {exc}")

    # Sanity: the round-trip produces a non-empty string
    assert isinstance(serialised, str)
    assert len(serialised) > 0


# ---------------------------------------------------------------------------
# AC-5: POS-neutral — no top-level gender or flat keys
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_evidence_packet_has_no_structural_gender_or_flat_keys():
    """AC-5: the top-level dump has no 'gender' and no flat underscore-joined form keys.

    Given   a packet whose wiktionary source carries a feminine noun with 'gender' in features
    When    the packet is serialised with model_dump(mode="json")
    Then    the TOP-LEVEL dict has no 'gender' key
            AND has no flat keys of the form '<case>_<number>' (e.g. 'genitive_plural')
            AND gender appears ONLY inside a FormBundle.features dict.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    packet = EvidencePacket(
        lemma_input="Γυναίκα",
        normalized_lemma="γυναίκα",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    ),
                    FormBundle(
                        form="γυναικών",
                        features={"case": "genitive", "number": "plural", "gender": "feminine"},
                    ),
                ],
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    )
                ],
            ),
            frequency=FrequencySource(present=True, rank=42, band="high"),
            rules=RulesSource(present=True),
        ),
    )
    dumped = packet.model_dump(mode="json")

    # No top-level 'gender'
    assert (
        "gender" not in dumped
    ), "top-level dump must not have a 'gender' key (POS-neutral seam #5)"

    # No flat underscore-joined keys at the top level.
    # (lemma_input and normalized_lemma legitimately contain underscores — exclude them.)
    legitimate_underscore_keys = {"lemma_input", "normalized_lemma"}
    for key in dumped:
        if key not in legitimate_underscore_keys:
            assert (
                "_" not in key
            ), f"top-level key '{key}' looks like a flat form key — violates POS-neutral seam #1"

    # gender IS present inside wiktionary forms' features
    wikt_forms = dumped["sources"]["wiktionary"]["forms"]
    any_gender = any("gender" in fb.get("features", {}) for fb in wikt_forms)
    assert any_gender, (
        "gender should appear inside FormBundle.features for the feminine-noun fixture, "
        "but was not found — check the wiktionary source fixture"
    )


# ---------------------------------------------------------------------------
# AC-6: absent source serialises with present=false
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_absent_source_serializes_present_false():
    """AC-6: an absent FrequencySource serialises to the exact absent shape.

    Given   an EvidencePacket where frequency is the absent stub (present=False)
    When    sources.frequency is serialised via model_dump(mode="json")
    Then    the result is exactly {"present": false, "rank": null, "band": null}
            — a bare None is NOT acceptable; the discriminator must be explicit.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    wiktionary = WiktionarySource(
        present=True,
        forms=[FormBundle(form="σπίτι", features={"case": "nominative", "number": "singular"})],
    )
    lexicon = GreekLexiconSource(
        present=True,
        forms=[FormBundle(form="σπίτι", features={"case": "nominative", "number": "singular"})],
    )
    packet = EvidencePacket(
        lemma_input="σπίτι",
        normalized_lemma="σπίτι",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=wiktionary,
            greek_lexicon=lexicon,
            frequency=FrequencySource(present=False, rank=None, band=None),
            rules=RulesSource(present=True),
        ),
    )
    freq_dump = packet.sources.frequency.model_dump(mode="json")

    assert freq_dump == {"present": False, "rank": None, "band": None}, (
        f"frequency absent shape must be exactly "
        f"{{'present': False, 'rank': None, 'band': None}}, got: {freq_dump}"
    )


# ---------------------------------------------------------------------------
# ADVERSARIAL / EDGE COVERAGE (Mode B — QA LEXGEN-06-01)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_evidence_packet_round_trip_through_json():
    """Round-trip: model_validate(json.loads(json.dumps(packet.model_dump(mode='json')))) == packet.

    Verifies that the packet survives a JSONB write+read cycle (serialize →
    JSON string → deserialize → EvidencePacket).  A structural regression
    (e.g. a nested FormBundle that loses its 'features' after round-trip, or a
    field that serializes to a non-deserializable type) would break this.
    """
    import json as _json

    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    packet = EvidencePacket(
        lemma_input="Γυναίκα",
        normalized_lemma="γυναίκα",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    ),
                    FormBundle(
                        form="γυναικών",
                        features={"case": "genitive", "number": "plural", "gender": "feminine"},
                    ),
                ],
            ),
            greek_lexicon=GreekLexiconSource(
                present=True,
                forms=[
                    FormBundle(
                        form="γυναίκα",
                        features={"case": "nominative", "number": "singular", "gender": "feminine"},
                    )
                ],
            ),
            frequency=FrequencySource(present=True, rank=42, band="high"),
            rules=RulesSource(present=False),
        ),
    )

    json_str = _json.dumps(packet.model_dump(mode="json"))
    reconstructed = EvidencePacket.model_validate(_json.loads(json_str))

    assert reconstructed == packet, (
        "Round-trip failed: model_validate(json.loads(json.dumps(packet.model_dump(mode='json')))) "
        "did not equal the original packet"
    )


@pytest.mark.unit
def test_invalid_feature_key_inside_source_is_rejected():
    """FormBundle validator fires through nested packet validation.

    A flat UI-edge key (e.g. 'genitive_plural') passed as a FormBundle.features
    key inside a WiktionarySource must raise a ValidationError — even when the
    bundle is nested inside a full EvidencePacket.  This pins the seam-#1
    invariant documented in lexgen.py: flat keys are NEVER allowed inside
    FormBundle.features, regardless of nesting depth.
    """
    from pydantic import ValidationError

    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    with pytest.raises(ValidationError) as exc_info:
        WiktionarySource(
            present=True,
            forms=[
                FormBundle(
                    form="γυναικών",
                    features={"genitive_plural": "γυναικών"},  # flat UI-edge key — must be rejected
                )
            ],
        )

    # Confirm the rejection names the bad key (not a generic pydantic error)
    error_str = str(exc_info.value)
    assert (
        "genitive_plural" in error_str or "Unknown feature key" in error_str
    ), f"ValidationError should mention the unknown flat key, got: {error_str[:300]}"


@pytest.mark.unit
def test_present_true_with_empty_forms_is_allowed():
    """present=True with forms=[] is a valid state — presence is independent of having forms.

    A source can be 'present' (the entry was found in the data source) but carry
    zero inflected forms (e.g. the Wiktionary page existed but had no declension
    table). This test PINS that the schema permits it.

    Note: If the never-invent gate in LEXGEN-06-03 later interprets
    present=True + forms=[] differently from present=True + forms=[...], that
    gate must enforce the distinction itself — the schema must not prevent the
    state from being created.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    ws = WiktionarySource(present=True, forms=[])
    dumped = ws.model_dump(mode="json")

    assert dumped["present"] is True
    assert (
        dumped["forms"] == []
    ), "present=True with empty forms should serialize to forms=[], got: " + repr(dumped["forms"])

    # Also verify inside a full packet (no validation error raised)
    EvidencePacket(
        lemma_input="σπίτι",
        normalized_lemma="σπίτι",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(present=True, forms=[]),
            greek_lexicon=GreekLexiconSource(present=True, forms=[]),
            frequency=FrequencySource(present=False),
            rules=RulesSource(present=False),
        ),
    )


@pytest.mark.unit
def test_frequency_source_present_path_dumps_real_values():
    """AC-6 counterpart: FrequencySource(present=True, rank=5, band='common') dumps real values.

    AC-6 tests the absent-path shape; this test verifies the present-path
    counterpart so that both branches of the present discriminator are pinned.
    A regression (e.g. rank serializing to a string or band becoming null)
    would break the LEXGEN-06-02 assembler and LEXGEN-06-03 gate.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    freq = FrequencySource(present=True, rank=5, band="common")
    dumped = freq.model_dump(mode="json")

    assert dumped == {"present": True, "rank": 5, "band": "common"}, (
        f"FrequencySource present-path shape must be "
        f"{{'present': True, 'rank': 5, 'band': 'common'}}, got: {dumped}"
    )


@pytest.mark.unit
def test_rules_source_extra_kwarg_silently_dropped_not_serialized():
    """Pin current extra='ignore' behavior: stray kwargs to RulesSource are silently dropped.

    Pydantic's default is extra='ignore', meaning RulesSource(present=False,
    stray_resolver='hello') constructs without error but the stray field does
    NOT appear in model_dump().  AC-3's exact-equality check catches stray
    fields IN THE DUMP, but not the silent construction.

    This test documents and pins that behavior.

    Design observation carried to LEXGEN-06-02/03: the schema has no
    extra='forbid' guard.  For an auditable provenance stub this is a
    provenance-integrity gap — a caller could pass undocumented kwargs and
    believe they were stored.  If LEXGEN-06-02 adds resolver fields to
    RulesSource, consider adding extra='forbid' to prevent silent data loss
    at that point.
    """
    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    # Construction succeeds silently (no ValidationError)
    rules = RulesSource(present=False, stray_resolver="hello")

    # Stray field does NOT appear in the dump
    dumped = rules.model_dump(mode="json")
    assert "stray_resolver" not in dumped, (
        "Stray kwarg 'stray_resolver' must NOT appear in model_dump — "
        "it should be silently dropped per extra='ignore' default"
    )
    assert dumped == {
        "present": False
    }, f"dump with stray kwarg must still equal {{'present': False}}, got: {dumped}"


@pytest.mark.unit
def test_evidence_packet_all_absent_sources_serializes():
    """All-absent packet (every source present=False) is a valid and serializable state.

    This represents the degenerate case where Stage 1 finds no evidence in any
    source (all consultations returned absent).  The never-invent gate in
    LEXGEN-06-03 must be able to handle this shape — it cannot assume any
    source is present.
    """
    import json as _json

    (
        FEATURE_KEYS,
        EvidencePacket,
        EvidencePacketSources,
        FormBundle,
        FrequencySource,
        GreekLexiconSource,
        RulesSource,
        WiktionarySource,
    ) = _import_symbols()

    packet = EvidencePacket(
        lemma_input="ξ",
        normalized_lemma="ξ",
        pos="noun",
        sources=EvidencePacketSources(
            wiktionary=WiktionarySource(present=False),
            greek_lexicon=GreekLexiconSource(present=False),
            frequency=FrequencySource(present=False),
            rules=RulesSource(present=False),
        ),
    )

    # Must serialize without error
    try:
        _json.dumps(packet.model_dump(mode="json"))
    except TypeError as exc:
        pytest.fail(f"All-absent packet serialization raised TypeError: {exc}")

    dumped = packet.model_dump(mode="json")
    assert dumped["sources"]["wiktionary"] == {"present": False, "forms": []}
    assert dumped["sources"]["greek_lexicon"] == {"present": False, "forms": []}
    assert dumped["sources"]["frequency"] == {"present": False, "rank": None, "band": None}
    assert dumped["sources"]["rules"] == {"present": False}
