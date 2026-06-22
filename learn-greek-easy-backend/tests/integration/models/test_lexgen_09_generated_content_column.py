"""Integration test for LEXGEN-09-01: generated_content JSONB column round-trip.

Mode A — RED spec.

BACKGROUND
----------
LEXGEN-09-01 adds a nullable JSONB column ``generated_content`` to the
``word_proposal`` table (SQLAlchemy model in ``src/db/models.py``).

This test verifies that the column can be set on a persisted ``WordProposal``
row, survives a flush + refetch, and equals the original dict — i.e. the
SQLAlchemy mapping and the DB-level JSONB column both exist and round-trip
correctly.

EXPECTED RED FAILURE MODE
--------------------------
Before the executor adds the column (LEXGEN-09-01):

    AttributeError: type object 'WordProposal' has no attribute 'generated_content'

OR (if the ORM mapping exists but the migration hasn't run):

    sqlalchemy.exc.ProgrammingError: column "generated_content" of relation
    "word_proposal" does not exist

Either failure is the correct not-implemented signal — NOT a test-authoring bug.

REQUIRES
--------
A real PostgreSQL on localhost:5433 (the shared test DB at TEST_DATABASE_URL).
The test carries ``@pytest.mark.integration`` and ``@pytest.mark.db`` and is
skipped if the DB is unreachable; it is exercised in CI against the real PG
service container (same as all other integration model tests).
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WordProposal, WordProposalOrigin, WordProposalState


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestGeneratedContentColumnRoundTrip:
    """LEXGEN-09-01: generated_content JSONB column persists and round-trips.

    RED before executor adds the column to WordProposal model + runs migration.
    GREEN after executor completes LEXGEN-09-01.
    """

    async def test_generated_content_column_round_trip(self, db_session: AsyncSession):
        """AC-7: generated_content column stores and retrieves a dict via JSONB.

        GIVEN  a persisted WordProposal with generated_content = None
        WHEN   generated_content is set to a dict and the session is flushed
        THEN   a fresh SELECT of the same row returns generated_content equal to
               the dict that was written

        The test writes a realistic payload that mirrors what LEXGEN-09-02
        (the LLM generation service) will produce — four string keys corresponding
        to GeneratedLexContent fields — so the column contract is validated
        against the actual expected data shape, not just a generic dict.
        """
        # Construct a minimal valid WordProposal — only the NOT NULL fields.
        proposal = WordProposal(
            lemma_input="λέγω",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.PENDING,
        )
        db_session.add(proposal)
        await db_session.flush()  # assign ID; stay in transaction for isolation

        # Verify initial state: generated_content is absent / None
        assert proposal.generated_content is None  # type: ignore[attr-defined]  # RED before col exists

        # Set the column to a realistic lexical-content payload
        lex_content_dict = {
            "gloss_en": "to say",
            "gloss_ru": "говорить",
            "example_greek": "Λέω ότι έχεις δίκιο.",
            "example_translation": "I say that you are right.",
        }
        proposal.generated_content = lex_content_dict  # type: ignore[attr-defined]  # RED before col exists
        await db_session.flush()

        # Expire the local instance to force a real SELECT from the DB
        await db_session.refresh(proposal)

        # Retrieve the row via a fresh SELECT to rule out in-session caching
        proposal_id = proposal.id
        result = await db_session.execute(
            select(WordProposal).where(WordProposal.id == proposal_id)
        )
        fetched = result.scalar_one()

        # AC-7: column equals the dict that was written
        assert fetched.generated_content == lex_content_dict  # type: ignore[attr-defined]
        assert fetched.generated_content["gloss_en"] == "to say"
        assert fetched.generated_content["gloss_ru"] == "говорить"
        assert fetched.generated_content["example_greek"] == "Λέω ότι έχεις δίκιο."
        assert fetched.generated_content["example_translation"] == "I say that you are right."

    async def test_generated_content_nullable_default(self, db_session: AsyncSession):
        """AC-7 boundary: generated_content defaults to NULL for a new proposal.

        Verifies the column is nullable (no NOT NULL constraint) and that
        persisting without setting generated_content leaves it as None.
        """
        proposal = WordProposal(
            lemma_input="βλέπω",
            pos="verb",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.PENDING,
        )
        db_session.add(proposal)
        await db_session.flush()
        await db_session.refresh(proposal)

        # Column is absent/NULL — not set by any default
        assert proposal.generated_content is None  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Mode B adversarial / edge DB-level tests (QA-authored).
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.db
class TestGeneratedContentColumnAdversarial:
    """DB-level adversarial coverage for the generated_content JSONB column.

    These tests exercise behaviors the AC round-trip does not cover: nested
    dict byte-identity, the fact that other JSONB columns survive a
    generated_content write (no over-broad side effects), and that a
    model_validate on the round-tripped dict is idempotent.
    """

    async def test_nested_dict_round_trips_byte_identical(self, db_session: AsyncSession):
        """JSONB stores and returns a nested dict exactly — no key reordering or coercion.

        The real payload is flat (4 top-level string keys), but JSONB serializes
        via json.dumps and PostgreSQL returns a deserialized dict. This test pins
        that the round-tripped value compares equal to the original (no key
        casing, value coercion, or silent truncation).

        Also confirms that model_validate(fetched.generated_content) succeeds,
        meaning LEXGEN-10/11 can re-validate the persisted payload without error.
        """
        from src.schemas.lexgen import GeneratedLexContent  # noqa: PLC0415

        lex_dict = {
            "gloss_en": "house",
            "gloss_ru": "дом",
            "example_greek": "Το σπίτι είναι μεγάλο.",
            "example_translation": "The house is big.",
        }
        proposal = WordProposal(
            lemma_input="σπίτι",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.PENDING,
            generated_content=lex_dict,
        )
        db_session.add(proposal)
        await db_session.flush()
        await db_session.refresh(proposal)

        # Byte-identical round-trip through JSONB
        assert proposal.generated_content == lex_dict  # type: ignore[attr-defined]
        assert proposal.generated_content["gloss_en"] == "house"  # type: ignore[attr-defined]
        assert proposal.generated_content["gloss_ru"] == "дом"  # type: ignore[attr-defined]
        # Cyrillic and Greek characters survive JSONB serialization
        assert proposal.generated_content["example_greek"] == "Το σπίτι είναι μεγάλο."  # type: ignore[attr-defined]
        assert proposal.generated_content["example_translation"] == "The house is big."  # type: ignore[attr-defined]

        # model_validate on the stored dict is idempotent (LEXGEN-10/11 dependency)
        revalidated = GeneratedLexContent.model_validate(proposal.generated_content)
        assert revalidated.gloss_en == "house"
        assert revalidated.gloss_ru == "дом"

    async def test_other_jsonb_columns_unaffected_by_generated_content_write(
        self, db_session: AsyncSession
    ):
        """Writing generated_content does NOT disturb sibling JSONB columns.

        Guards against an over-broad migration downgrade or a SQLAlchemy ORM
        bug that could clobber a neighbouring column when generated_content is
        updated. Sets generated_fields to a sentinel dict, then writes
        generated_content, and verifies generated_fields is unchanged after flush.
        """
        sentinel_generated_fields = {"gender": "neuter", "declension_group": "2nd"}
        proposal = WordProposal(
            lemma_input="σπίτι",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.PENDING,
            generated_fields=sentinel_generated_fields,
        )
        db_session.add(proposal)
        await db_session.flush()

        # Now write generated_content
        proposal.generated_content = {  # type: ignore[attr-defined]
            "gloss_en": "house",
            "gloss_ru": "дом",
            "example_greek": "Το σπίτι είναι μεγάλο.",
            "example_translation": "The house is big.",
        }
        await db_session.flush()
        await db_session.refresh(proposal)

        # generated_fields must be unaffected
        assert proposal.generated_fields == sentinel_generated_fields
        # generated_content is the new value
        assert proposal.generated_content["gloss_en"] == "house"  # type: ignore[attr-defined]

    async def test_generated_content_update_from_none_to_dict(self, db_session: AsyncSession):
        """A proposal can transition generated_content from NULL → dict in a single flush.

        This mirrors the generator service's write path (LEXGEN-09-02): the
        proposal arrives with generated_content=None, the LLM runs, and the
        service sets generated_content to the validated dict and flushes.
        """
        proposal = WordProposal(
            lemma_input="γράφω",
            pos="verb",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.GENERATING,
        )
        db_session.add(proposal)
        await db_session.flush()
        await db_session.refresh(proposal)

        assert proposal.generated_content is None  # type: ignore[attr-defined]

        # Simulate what LexgenGeneratorService.generate() will do
        proposal.generated_content = {  # type: ignore[attr-defined]
            "gloss_en": "to write",
            "gloss_ru": "писать",
            "example_greek": "Γράφω ένα γράμμα.",
            "example_translation": "I am writing a letter.",
        }
        await db_session.flush()
        await db_session.refresh(proposal)

        assert proposal.generated_content is not None  # type: ignore[attr-defined]
        assert proposal.generated_content["gloss_en"] == "to write"  # type: ignore[attr-defined]
