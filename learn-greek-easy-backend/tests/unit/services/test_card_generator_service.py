"""Unit tests for CardGeneratorService.

Tests cover:
- Single word entry with examples (context populated)
- Single word entry without examples (context is None)
- Multiple word entries (correct count passed to bulk_upsert)
- Empty list (bulk_upsert receives empty list)
- Badge field formatting (part_of_speech capitalized)
- Correct CardType enum values used
- variant_key="default" and tier=1 for all cards
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.db.models import CardType, PartOfSpeech, WordEntry
from src.services.card_generator_service import CardGeneratorService

# =============================================================================
# Helpers
# =============================================================================


def _make_word_entry(
    *,
    lemma="σπίτι",
    part_of_speech=PartOfSpeech.NOUN,
    translation_en="house",
    pronunciation="/spí.ti/",
    examples=None,
    deck_id=None,
    entry_id=None,
):
    """Create a mock WordEntry with the specified attributes."""
    we = MagicMock(spec=WordEntry)
    we.id = entry_id or uuid4()
    we.deck_id = deck_id or uuid4()
    we.lemma = lemma
    we.part_of_speech = part_of_speech
    we.translation_en = translation_en
    we.pronunciation = pronunciation
    we.examples = examples
    return we


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_db():
    """Create a mock async database session."""
    return AsyncMock()


@pytest.fixture
def mock_card_record_repo():
    """Create a mock CardRecordRepository with bulk_upsert returning defaults."""
    repo = AsyncMock()
    repo.bulk_upsert = AsyncMock(return_value=([], 0, 0))
    return repo


@pytest.fixture
def service(mock_db, mock_card_record_repo):
    """Create CardGeneratorService with mocked dependencies."""
    svc = CardGeneratorService(mock_db)
    svc.card_record_repo = mock_card_record_repo
    return svc


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
class TestCardGeneratorService:
    """Unit tests for CardGeneratorService.generate_meaning_cards()."""

    @pytest.mark.asyncio
    async def test_single_entry_with_examples_produces_two_cards(
        self, service, mock_card_record_repo
    ):
        """Single word entry with examples produces 2 cards with context from first example."""
        deck_id = uuid4()
        examples = [
            {"greek": "Το σπίτι μου είναι μικρό.", "english": "My house is small."},
            {"greek": "Αυτό είναι ωραίο σπίτι.", "english": "This is a nice house."},
        ]
        entry = _make_word_entry(deck_id=deck_id, examples=examples)

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_meaning_cards([entry], deck_id)

        mock_card_record_repo.bulk_upsert.assert_called_once()
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2

        # EL->EN card
        el_to_en = card_dicts[0]
        assert el_to_en["word_entry_id"] == entry.id
        assert el_to_en["deck_id"] == deck_id
        assert el_to_en["is_active"] is True
        assert el_to_en["front_content"]["main"] == "σπίτι"
        assert el_to_en["front_content"]["sub"] == "/spí.ti/"
        assert el_to_en["front_content"]["badge"] == "Noun"
        assert el_to_en["back_content"]["answer"] == "house"
        assert el_to_en["back_content"]["answer_sub"] is None
        assert el_to_en["back_content"]["context"]["greek"] == "Το σπίτι μου είναι μικρό."
        assert el_to_en["back_content"]["context"]["english"] == "My house is small."
        assert el_to_en["back_content"]["context"]["label"] == "Example"
        assert el_to_en["back_content"]["context"]["tense"] is None

        # EN->EL card
        en_to_el = card_dicts[1]
        assert en_to_el["word_entry_id"] == entry.id
        assert en_to_el["deck_id"] == deck_id
        assert en_to_el["is_active"] is True
        assert en_to_el["front_content"]["main"] == "house"
        assert en_to_el["front_content"]["sub"] is None
        assert en_to_el["front_content"]["badge"] == "Noun"
        assert en_to_el["back_content"]["answer"] == "σπίτι"
        assert en_to_el["back_content"]["answer_sub"] == "/spí.ti/"
        assert en_to_el["back_content"]["context"] is not None

    @pytest.mark.asyncio
    async def test_single_entry_without_examples_context_is_none(
        self, service, mock_card_record_repo
    ):
        """Single word entry without examples produces cards with context=None."""
        deck_id = uuid4()

        # Test with examples=None
        entry_none = _make_word_entry(deck_id=deck_id, examples=None)
        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_meaning_cards([entry_none], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2
        assert card_dicts[0]["back_content"]["context"] is None
        assert card_dicts[1]["back_content"]["context"] is None

        # Test with examples=[] (empty list)
        mock_card_record_repo.bulk_upsert.reset_mock()
        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)
        entry_empty = _make_word_entry(deck_id=deck_id, examples=[])

        await service.generate_meaning_cards([entry_empty], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2
        assert card_dicts[0]["back_content"]["context"] is None
        assert card_dicts[1]["back_content"]["context"] is None

    @pytest.mark.asyncio
    async def test_multiple_entries_produce_correct_count(self, service, mock_card_record_repo):
        """N word entries produce 2*N card dicts passed to bulk_upsert."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(lemma="σπίτι", translation_en="house", deck_id=deck_id),
            _make_word_entry(
                lemma="γάτα",
                translation_en="cat",
                deck_id=deck_id,
                part_of_speech=PartOfSpeech.NOUN,
            ),
            _make_word_entry(
                lemma="τρέχω",
                translation_en="to run",
                deck_id=deck_id,
                part_of_speech=PartOfSpeech.VERB,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 6, 0)

        await service.generate_meaning_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2 * len(entries)

    @pytest.mark.asyncio
    async def test_empty_list_calls_bulk_upsert_with_empty(self, service, mock_card_record_repo):
        """Empty word entries list passes empty list to bulk_upsert, returning (0, 0)."""
        deck_id = uuid4()
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_meaning_cards([], deck_id)

        mock_card_record_repo.bulk_upsert.assert_called_once_with([])
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_badge_uses_capitalized_part_of_speech(self, service, mock_card_record_repo):
        """Badge field is part_of_speech.value.capitalize() for all PartOfSpeech values."""
        deck_id = uuid4()

        test_cases = [
            (PartOfSpeech.NOUN, "Noun"),
            (PartOfSpeech.VERB, "Verb"),
            (PartOfSpeech.ADJECTIVE, "Adjective"),
            (PartOfSpeech.ADVERB, "Adverb"),
            (PartOfSpeech.PHRASE, "Phrase"),
        ]

        for pos, expected_badge in test_cases:
            mock_card_record_repo.bulk_upsert.reset_mock()
            mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

            entry = _make_word_entry(deck_id=deck_id, part_of_speech=pos)
            await service.generate_meaning_cards([entry], deck_id)

            card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
            assert card_dicts[0]["front_content"]["badge"] == expected_badge, (
                f"Expected badge '{expected_badge}' for {pos}, "
                f"got '{card_dicts[0]['front_content']['badge']}'"
            )
            assert card_dicts[1]["front_content"]["badge"] == expected_badge

    @pytest.mark.asyncio
    async def test_correct_card_type_enum_values(self, service, mock_card_record_repo):
        """Card dicts use correct CardType enum string values."""
        deck_id = uuid4()
        entry = _make_word_entry(deck_id=deck_id)

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_meaning_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]

        # First card: EL->EN
        assert card_dicts[0]["card_type"] == CardType.MEANING_EL_TO_EN.value
        assert card_dicts[0]["card_type"] == "meaning_el_to_en"

        # Second card: EN->EL
        assert card_dicts[1]["card_type"] == CardType.MEANING_EN_TO_EL.value
        assert card_dicts[1]["card_type"] == "meaning_en_to_el"

    @pytest.mark.asyncio
    async def test_variant_key_default_and_tier_1(self, service, mock_card_record_repo):
        """All meaning cards have variant_key='default' and tier=1."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(lemma="σπίτι", translation_en="house", deck_id=deck_id),
            _make_word_entry(lemma="γάτα", translation_en="cat", deck_id=deck_id),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 4, 0)

        await service.generate_meaning_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for i, card_dict in enumerate(card_dicts):
            assert card_dict["variant_key"] == "default", f"Card {i} variant_key != 'default'"
            assert card_dict["tier"] == 1, f"Card {i} tier != 1"
