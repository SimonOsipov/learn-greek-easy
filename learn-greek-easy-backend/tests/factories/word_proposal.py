"""WordProposal model factory (LEXGEN-12).

Provides ``WordProposalFactory`` for building LEXGEN word-proposal lifecycle
rows in tests. POS-neutral by design (Decision Record §1): ``pos`` is free-text
and there is no ``gender`` column — gender (when applicable) lives in
``generated_fields``.

Mirrors the factory_boy / async-SQLAlchemy pattern in
``tests/factories/card_error.py``.

Usage:
    # A proposal in the review queue
    p = await WordProposalFactory.create(
        status=WordProposalState.NEEDS_REVIEW,
    )

    # A needs_review proposal with realistic reconciliation_log + content +
    # flagged fields and judge scores set (so score-exclusion is meaningful)
    p = await WordProposalFactory.create(
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=["gender"],
        reconciliation_log={
            "schema_version": "lexgen.reconciliation.v1",
            "pos": "noun",
            "lemma": "σπίτι",
            "fields": {
                "gender": {
                    "value": "neuter",
                    "source": "greek_lexicon",
                    "confidence": None,
                    "flags": [],
                    "cross_checks": [],
                },
            },
            "gaps": [],
        },
        generated_fields={"gender": "neuter"},
        generated_content={
            "gloss_en": "house",
            "gloss_ru": "дом",
            "example_greek": "Το σπίτι είναι μεγάλο.",
            "example_translation": "The house is big.",
        },
        judge_scores={
            "schema_version": "lexgen.judge.v1",
            "judges": [{"rubric": {"naturalness": 5}}],
            "disagreement": None,
        },
    )
"""

import factory

from src.db.models import WordProposal, WordProposalOrigin, WordProposalState
from tests.factories.base import BaseFactory, fake


class WordProposalFactory(BaseFactory):
    """Factory for the ``WordProposal`` model.

    Defaults satisfy the three NOT NULL columns (``lemma_input``, ``pos``,
    ``origin``). ``status`` defaults to ``pending`` (the model server-default);
    pass ``status=WordProposalState.NEEDS_REVIEW`` for inbox rows.

    JSONB columns (``flagged_fields``, ``reconciliation_log``,
    ``generated_fields``, ``generated_content``, ``judge_scores``) default to
    ``None`` and are set explicitly per test case.

    Note:
        ``flagged_fields`` is a JSONB **list** (not a dict). ``created_at`` is a
        regular mapped column, so an explicit value passed as a kwarg overrides
        the server default — use that to control FIFO ordering deterministically.
    """

    class Meta:
        model = WordProposal

    # Required NOT NULL columns
    lemma_input = factory.LazyFunction(lambda: fake.greek_word())
    pos = "noun"
    origin = WordProposalOrigin.ADMIN

    # Lifecycle state — default matches the model server-default ("pending").
    status = WordProposalState.PENDING

    # JSONB payloads — None until a test populates them.
    evidence_packet = None
    generated_fields = None
    reconciliation_log = None
    judge_scores = None
    flagged_fields = None
    generated_content = None

    # INERT in v1 (Decision Record §3) — stays None unless a test sets it.
    trust_score = None

    class Params:
        """Factory traits for common variations."""

        # A proposal sitting in the review queue.
        needs_review = factory.Trait(
            status=WordProposalState.NEEDS_REVIEW,
        )

        # A terminal shipped proposal (out of the inbox queue scope).
        # shipped_word_entry_id is left NULL — it is a nullable FK to
        # word_entries, and seeding a dangling UUID would violate the FK.
        # These read-only inbox tests only need status=shipped (the detail
        # endpoint 404s on any status != needs_review regardless of the FK).
        shipped = factory.Trait(
            status=WordProposalState.SHIPPED,
        )
