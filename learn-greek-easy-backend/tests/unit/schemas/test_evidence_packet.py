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
