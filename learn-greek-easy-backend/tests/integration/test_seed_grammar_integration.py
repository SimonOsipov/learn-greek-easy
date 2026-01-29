"""Integration tests for seed grammar data validation.

Tests cover:
- Schema validation for all grammar data types (NounData, VerbData, etc.)
- Integration tests verifying seed populates grammar fields on cards
- Searchable forms generation and normalization
- Seed script dry-run execution

Part of: [SEEDGRAM] Enrich Seed Data with Grammar
"""

import subprocess
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Card
from src.schemas.card import AdjectiveData, AdverbData, Example, NounData, VerbData
from src.services.seed_grammar_data import ENRICHED_VOCABULARY
from src.services.seed_service import SeedService

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def enable_seeding():
    """Enable seeding for tests."""
    with patch("src.services.seed_service.settings") as mock_settings:
        mock_settings.can_seed_database.return_value = True
        mock_settings.get_seed_validation_errors.return_value = []
        yield mock_settings


# ============================================================================
# Helper Functions
# ============================================================================


def _count_words_with_field(field_name: str) -> int:
    """Count words in ENRICHED_VOCABULARY that have a specific field."""
    return sum(1 for data in ENRICHED_VOCABULARY.values() if field_name in data)


def _get_words_with_field(field_name: str) -> list[tuple[str, dict[str, Any]]]:
    """Get all words with a specific field from ENRICHED_VOCABULARY."""
    return [(word, data) for word, data in ENRICHED_VOCABULARY.items() if field_name in data]


def _get_interjections() -> list[str]:
    """Get words that are interjections (no grammar data but have examples)."""
    return [
        word
        for word, data in ENRICHED_VOCABULARY.items()
        if (
            "examples" in data
            and "noun_data" not in data
            and "verb_data" not in data
            and "adjective_data" not in data
            and "adverb_data" not in data
        )
    ]


# ============================================================================
# Schema Validation Tests (No DB Required)
# ============================================================================


class TestSeedGrammarDataValidation:
    """Schema validation tests for all grammar data in ENRICHED_VOCABULARY.

    These tests validate that all grammar data conforms to the Pydantic schemas.
    No database connection is required.
    """

    def test_all_noun_data_validates_against_pydantic_schema(self) -> None:
        """Validate all noun data in ENRICHED_VOCABULARY against NounData schema."""
        nouns = _get_words_with_field("noun_data")
        assert len(nouns) > 0, "Expected at least one noun in vocabulary"

        errors = []
        for word, data in nouns:
            try:
                NounData(**data["noun_data"])
            except ValidationError as e:
                errors.append(f"{word}: {e}")

        assert not errors, "Noun validation errors:\n" + "\n".join(errors)

    def test_all_verb_data_validates_against_pydantic_schema(self) -> None:
        """Validate all verb data in ENRICHED_VOCABULARY against VerbData schema."""
        verbs = _get_words_with_field("verb_data")
        assert len(verbs) == 9, f"Expected 9 verbs, found {len(verbs)}"

        errors = []
        for word, data in verbs:
            try:
                VerbData(**data["verb_data"])
            except ValidationError as e:
                errors.append(f"{word}: {e}")

        assert not errors, "Verb validation errors:\n" + "\n".join(errors)

    def test_all_adjective_data_validates_against_pydantic_schema(self) -> None:
        """Validate all adjective data in ENRICHED_VOCABULARY against AdjectiveData schema."""
        adjectives = _get_words_with_field("adjective_data")
        assert len(adjectives) == 3, f"Expected 3 adjectives, found {len(adjectives)}"

        errors = []
        for word, data in adjectives:
            try:
                AdjectiveData(**data["adjective_data"])
            except ValidationError as e:
                errors.append(f"{word}: {e}")

        assert not errors, "Adjective validation errors:\n" + "\n".join(errors)

    def test_all_adverb_data_validates_against_pydantic_schema(self) -> None:
        """Validate all adverb data in ENRICHED_VOCABULARY against AdverbData schema."""
        adverbs = _get_words_with_field("adverb_data")
        assert len(adverbs) == 2, f"Expected 2 adverbs, found {len(adverbs)}"

        errors = []
        for word, data in adverbs:
            try:
                AdverbData(**data["adverb_data"])
            except ValidationError as e:
                errors.append(f"{word}: {e}")

        assert not errors, "Adverb validation errors:\n" + "\n".join(errors)

    def test_all_examples_validate_against_pydantic_schema(self) -> None:
        """Validate all examples in ENRICHED_VOCABULARY against Example schema."""
        words_with_examples = _get_words_with_field("examples")
        assert (
            len(words_with_examples) == 60
        ), f"Expected all 60 words to have examples, found {len(words_with_examples)}"

        errors = []
        for word, data in words_with_examples:
            for i, example in enumerate(data["examples"]):
                try:
                    Example(**example)
                except ValidationError as e:
                    errors.append(f"{word}[{i}]: {e}")

        assert not errors, "Example validation errors:\n" + "\n".join(errors)

    def test_enriched_vocabulary_has_60_words(self) -> None:
        """Verify total word count is 60 (matching CEFR levels A1-C2)."""
        assert (
            len(ENRICHED_VOCABULARY) == 60
        ), f"Expected 60 words in vocabulary, found {len(ENRICHED_VOCABULARY)}"

    def test_all_words_have_back_text_ru(self) -> None:
        """Verify all words have Russian translation."""
        words_with_ru = _get_words_with_field("back_text_ru")
        assert (
            len(words_with_ru) == 60
        ), f"Expected all 60 words to have back_text_ru, found {len(words_with_ru)}"

    def test_interjections_have_examples_but_no_grammar_data(self) -> None:
        """Verify interjections have examples but no grammar fields.

        Interjections like 'geia', 'nai', 'ochi', 'kalimera', 'kalinychta'
        should have examples but no noun_data, verb_data, etc.
        """
        interjections = _get_interjections()

        # Expected interjections (no grammar data)
        expected_interjections = {"γεια", "ναι", "όχι", "καλημέρα", "καληνύχτα"}
        actual_set = set(interjections)

        assert (
            expected_interjections == actual_set
        ), f"Expected interjections {expected_interjections}, found {actual_set}"

        # Verify each has examples
        for word in interjections:
            data = ENRICHED_VOCABULARY[word]
            assert "examples" in data, f"Interjection '{word}' missing examples"
            assert (
                len(data["examples"]) >= 1
            ), f"Interjection '{word}' should have at least 1 example"


# ============================================================================
# Integration Tests - Seed Creates Cards with Grammar Data
# ============================================================================


@pytest.mark.no_parallel
class TestSeedCreatesCardsWithGrammarData:
    """Integration tests verifying seed populates grammar fields on cards."""

    @pytest.mark.asyncio
    async def test_seeded_noun_cards_have_noun_data_populated(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify noun cards have noun_data field populated after seeding."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        # Get all cards with noun_data
        cards = (await db_session.execute(select(Card))).scalars().all()

        # Find cards that are nouns (have noun_data populated)
        noun_cards = [c for c in cards if c.noun_data is not None]

        # We should have nouns populated
        assert len(noun_cards) > 0, "Expected some cards with noun_data"

        # Verify noun_data structure
        for card in noun_cards:
            assert "gender" in card.noun_data, f"Card '{card.front_text}' noun_data missing gender"
            assert card.noun_data["gender"] in (
                "masculine",
                "feminine",
                "neuter",
            ), f"Card '{card.front_text}' has invalid gender: {card.noun_data['gender']}"

    @pytest.mark.asyncio
    async def test_seeded_verb_cards_have_verb_data_populated(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify verb cards have verb_data field populated after seeding."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()

        # Find cards that are verbs (have verb_data populated)
        verb_cards = [c for c in cards if c.verb_data is not None]

        # We should have at least 9 unique verb vocabulary words
        # (may have more cards if user-owned decks reuse the same vocabulary)
        unique_verb_words = {c.front_text for c in verb_cards}
        assert (
            len(unique_verb_words) == 9
        ), f"Expected 9 unique verb words, found {len(unique_verb_words)}: {unique_verb_words}"

        # Verify verb_data structure
        for card in verb_cards:
            assert "voice" in card.verb_data, f"Card '{card.front_text}' verb_data missing voice"
            assert card.verb_data["voice"] in (
                "active",
                "passive",
            ), f"Card '{card.front_text}' has invalid voice: {card.verb_data['voice']}"
            # Should have present tense conjugations
            assert (
                "present_1s" in card.verb_data
            ), f"Card '{card.front_text}' verb_data missing present_1s"

    @pytest.mark.asyncio
    async def test_seeded_cards_have_examples_populated(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify cards have examples field populated after seeding."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()
        # At least 60 cards should exist (60 vocab + user-owned deck cards)
        assert len(cards) >= 60, f"Expected at least 60 cards, found {len(cards)}"

        # All cards should have examples (since all vocabulary has examples)
        cards_with_examples = [c for c in cards if c.examples is not None]
        assert len(cards_with_examples) == len(cards), (
            f"Expected all {len(cards)} cards to have examples, "
            f"found {len(cards_with_examples)}"
        )

        # Verify example structure
        for card in cards_with_examples:
            assert (
                len(card.examples) >= 1
            ), f"Card '{card.front_text}' should have at least 1 example"
            for example in card.examples:
                assert "greek" in example, f"Card '{card.front_text}' example missing 'greek' field"
                assert (
                    len(example["greek"]) > 0
                ), f"Card '{card.front_text}' example has empty Greek text"

    @pytest.mark.asyncio
    async def test_seeded_cards_have_back_text_ru_populated(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify cards have Russian translation populated after seeding."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()

        # All cards should have Russian translation
        cards_with_ru = [c for c in cards if c.back_text_ru is not None]
        assert len(cards_with_ru) == len(cards), (
            f"Expected all {len(cards)} cards to have back_text_ru, " f"found {len(cards_with_ru)}"
        )

        # Verify Russian text contains Cyrillic characters
        for card in cards_with_ru:
            has_cyrillic = any("\u0400" <= char <= "\u04FF" for char in card.back_text_ru)
            assert has_cyrillic, (
                f"Card '{card.front_text}' back_text_ru should contain Cyrillic: "
                f"'{card.back_text_ru}'"
            )

    @pytest.mark.asyncio
    async def test_interjections_have_examples_but_no_grammar_data(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify interjection cards have examples but no grammar data fields."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        # Interjection words to check
        interjection_words = ["γεια", "ναι", "όχι", "καλημέρα", "καληνύχτα"]

        cards = (await db_session.execute(select(Card))).scalars().all()
        interjection_cards = [c for c in cards if c.front_text in interjection_words]

        # Should have at least 5 (may be more due to user-owned decks)
        assert (
            len(interjection_cards) >= 5
        ), f"Expected at least 5 interjection cards, found {len(interjection_cards)}"

        for card in interjection_cards:
            # Should have examples
            assert (
                card.examples is not None
            ), f"Interjection '{card.front_text}' should have examples"
            assert (
                len(card.examples) >= 1
            ), f"Interjection '{card.front_text}' should have at least 1 example"

            # Should NOT have grammar data
            assert (
                card.noun_data is None
            ), f"Interjection '{card.front_text}' should not have noun_data"
            assert (
                card.verb_data is None
            ), f"Interjection '{card.front_text}' should not have verb_data"
            assert (
                card.adjective_data is None
            ), f"Interjection '{card.front_text}' should not have adjective_data"
            assert (
                card.adverb_data is None
            ), f"Interjection '{card.front_text}' should not have adverb_data"


# ============================================================================
# Searchable Forms Tests
# ============================================================================


@pytest.mark.no_parallel
class TestSeededCardsSearchableForms:
    """Tests for searchable_forms and searchable_forms_normalized generation."""

    @pytest.mark.asyncio
    async def test_seeded_cards_have_searchable_forms_populated(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify all seeded cards have searchable_forms populated."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()

        # All cards should have searchable_forms
        cards_with_forms = [c for c in cards if c.searchable_forms is not None]
        assert len(cards_with_forms) == len(cards), (
            f"Expected all {len(cards)} cards to have searchable_forms, "
            f"found {len(cards_with_forms)}"
        )

        # Each should have at least the base word form
        for card in cards_with_forms:
            assert (
                len(card.searchable_forms) >= 1
            ), f"Card '{card.front_text}' should have at least 1 searchable form"

    @pytest.mark.asyncio
    async def test_noun_searchable_forms_include_multiple_cases(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify noun cards have multiple case forms in searchable_forms."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()
        noun_cards = [c for c in cards if c.noun_data is not None]

        for card in noun_cards:
            # Nouns should have multiple forms (singular + plural cases)
            assert (
                len(card.searchable_forms) > 1
            ), f"Noun '{card.front_text}' should have multiple searchable forms"

    @pytest.mark.asyncio
    async def test_verb_searchable_forms_include_conjugations(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify verb cards have conjugations in searchable_forms."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()
        verb_cards = [c for c in cards if c.verb_data is not None]

        # Impersonal verbs like 'πρέπει' (must) only have 3rd person forms
        impersonal_verbs = {"πρέπει"}

        for card in verb_cards:
            if card.front_text in impersonal_verbs:
                # Impersonal verbs have limited conjugation
                assert len(card.searchable_forms) >= 2, (
                    f"Impersonal verb '{card.front_text}' should have at least 2 "
                    f"searchable forms, found {len(card.searchable_forms)}"
                )
            else:
                # Regular verbs should have many forms (multiple tenses and persons)
                assert len(card.searchable_forms) > 5, (
                    f"Verb '{card.front_text}' should have many searchable forms, "
                    f"found {len(card.searchable_forms)}"
                )

    @pytest.mark.asyncio
    async def test_searchable_forms_normalized_have_no_accents(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify normalized forms have Greek accents removed."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        cards = (await db_session.execute(select(Card))).scalars().all()

        # Check a sample of cards
        for card in cards[:10]:
            if card.searchable_forms_normalized:
                for form in card.searchable_forms_normalized:
                    # Check that common Greek diacritics are removed
                    # Greek accent marks: tonos (0x0301), oxia (0x0341)
                    # Also covers vowels with built-in accents like ά, έ, ή, ί, ό, ύ, ώ
                    greek_accented = "άέήίόύώΆΈΉΊΌΎΏ"
                    has_accent = any(char in greek_accented for char in form)
                    assert not has_accent, f"Normalized form '{form}' should not have Greek accents"

    @pytest.mark.asyncio
    async def test_non_grammar_words_have_front_text_in_searchable_forms(
        self, db_session: AsyncSession, enable_seeding
    ) -> None:
        """Verify words without grammar data still have their front_text in searchable_forms."""
        seed_service = SeedService(db_session)
        await seed_service.seed_all()

        # Interjection words (no grammar data)
        interjection_words = ["γεια", "ναι", "όχι", "καλημέρα", "καληνύχτα"]

        cards = (await db_session.execute(select(Card))).scalars().all()
        interjection_cards = [c for c in cards if c.front_text in interjection_words]

        for card in interjection_cards:
            assert (
                card.searchable_forms is not None
            ), f"Card '{card.front_text}' should have searchable_forms"
            # The front_text itself should be in searchable_forms
            assert (
                card.front_text in card.searchable_forms
            ), f"Card '{card.front_text}' should have its front_text in searchable_forms"


# ============================================================================
# Seed Script Dry Run Test
# ============================================================================


class TestSeedScriptDryRun:
    """Tests for seed script execution."""

    def test_seed_script_dry_run_completes_without_errors(self) -> None:
        """Verify seed script dry-run mode completes successfully.

        This tests the CLI script without actually seeding the database.
        The --dry-run flag should show what would be done and exit with code 0.
        """
        # Compute script path relative to this test file:
        # tests/integration/test_seed_grammar_integration.py -> scripts/seed_e2e_data.py
        script_path = Path(__file__).parent.parent.parent / "scripts" / "seed_e2e_data.py"

        result = subprocess.run(
            [
                sys.executable,
                str(script_path),
                "--dry-run",
            ],
            capture_output=True,
            text=True,
            env={
                **{k: v for k, v in __import__("os").environ.items()},
                "TEST_SEED_ENABLED": "true",
                "APP_ENV": "development",
            },
            timeout=30,
        )

        # Should exit successfully
        assert result.returncode == 0, (
            f"Seed script dry-run failed with code {result.returncode}\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        # Should indicate dry run mode
        assert (
            "DRY RUN" in result.stdout or "DRY RUN" in result.stderr
        ), "Expected 'DRY RUN' in output"
