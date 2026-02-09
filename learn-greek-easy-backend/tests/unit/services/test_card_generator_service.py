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
    grammar_data=None,
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
    we.grammar_data = grammar_data
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


# =============================================================================
# Test Data
# =============================================================================

# Sample grammar data for nouns (γάτα - cat)
NOUN_GRAMMAR_DATA = {
    "gender": "feminine",
    "cases": {
        "singular": {
            "nominative": "η γάτα",
            "genitive": "της γάτας",
            "accusative": "τη γάτα",
        },
        "plural": {
            "nominative": "οι γάτες",
            "genitive": "των γατών",
            "accusative": "τις γάτες",
        },
    },
}

# Sample grammar data for adjectives (καλός - good)
ADJ_GRAMMAR_DATA = {
    "declension_group": "os_i_o",
    "forms": {
        "masculine": {
            "singular": {"nominative": "καλός"},
            "plural": {"nominative": "καλοί"},
        },
        "feminine": {
            "singular": {"nominative": "καλή"},
            "plural": {"nominative": "καλές"},
        },
        "neuter": {
            "singular": {"nominative": "καλό"},
            "plural": {"nominative": "καλά"},
        },
    },
}

# Grammar data for adjective with partial genders (only masculine)
ADJ_GRAMMAR_DATA_PARTIAL = {
    "declension_group": "os_i_o",
    "forms": {
        "masculine": {
            "singular": {"nominative": "μικρός"},
            "plural": {"nominative": "μικροί"},
        },
    },
}


@pytest.mark.unit
class TestGeneratePluralFormCards:
    """Unit tests for CardGeneratorService.generate_plural_form_cards()."""

    @pytest.mark.asyncio
    async def test_noun_with_plural_data_produces_two_cards(self, service, mock_card_record_repo):
        """Noun with plural data produces 2 cards (sg->pl, pl->sg)."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        created, updated = await service.generate_plural_form_cards([entry], deck_id)

        assert created == 2
        assert updated == 0

        mock_card_record_repo.bulk_upsert.assert_called_once()
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2

        # sg -> pl card
        sg_to_pl = card_dicts[0]
        assert sg_to_pl["word_entry_id"] == entry.id
        assert sg_to_pl["deck_id"] == deck_id
        assert sg_to_pl["card_type"] == CardType.PLURAL_FORM.value
        assert sg_to_pl["variant_key"] == "sg_to_pl"
        assert sg_to_pl["tier"] == 1
        assert sg_to_pl["is_active"] is True
        assert sg_to_pl["front_content"]["prompt"] == "What is the plural form?"
        assert sg_to_pl["front_content"]["main"] == "η γάτα"
        assert sg_to_pl["front_content"]["sub"] is None
        assert sg_to_pl["front_content"]["badge"] == "Noun"
        assert sg_to_pl["front_content"]["hint"] == "cat"
        assert sg_to_pl["back_content"]["answer"] == "οι γάτες"
        assert sg_to_pl["back_content"]["answer_sub"] is None

        # pl -> sg card
        pl_to_sg = card_dicts[1]
        assert pl_to_sg["variant_key"] == "pl_to_sg"
        assert pl_to_sg["front_content"]["prompt"] == "What is the singular form?"
        assert pl_to_sg["front_content"]["main"] == "οι γάτες"
        assert pl_to_sg["front_content"]["sub"] is None
        assert pl_to_sg["front_content"]["badge"] == "Noun"
        assert pl_to_sg["back_content"]["answer"] == "η γάτα"

    @pytest.mark.asyncio
    async def test_adjective_with_all_genders_produces_six_cards(
        self, service, mock_card_record_repo
    ):
        """Adjective with all 3 genders produces 6 cards (2 per gender)."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="good",
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 6, 0)

        created, updated = await service.generate_plural_form_cards([entry], deck_id)

        assert created == 6
        assert updated == 0

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 6

        # Check masculine sg->pl
        masc_sg_to_pl = card_dicts[0]
        assert masc_sg_to_pl["variant_key"] == "sg_to_pl_masculine"
        assert masc_sg_to_pl["front_content"]["main"] == "καλός"
        assert masc_sg_to_pl["front_content"]["sub"] == "masculine"
        assert masc_sg_to_pl["front_content"]["badge"] == "Adj. Masc."
        assert masc_sg_to_pl["back_content"]["answer"] == "καλοί"

        # Check masculine pl->sg
        masc_pl_to_sg = card_dicts[1]
        assert masc_pl_to_sg["variant_key"] == "pl_to_sg_masculine"
        assert masc_pl_to_sg["front_content"]["main"] == "καλοί"
        assert masc_pl_to_sg["front_content"]["sub"] == "masculine"
        assert masc_pl_to_sg["back_content"]["answer"] == "καλός"

        # Check feminine sg->pl
        fem_sg_to_pl = card_dicts[2]
        assert fem_sg_to_pl["variant_key"] == "sg_to_pl_feminine"
        assert fem_sg_to_pl["front_content"]["main"] == "καλή"
        assert fem_sg_to_pl["front_content"]["sub"] == "feminine"
        assert fem_sg_to_pl["front_content"]["badge"] == "Adj. Fem."
        assert fem_sg_to_pl["back_content"]["answer"] == "καλές"

        # Check feminine pl->sg
        fem_pl_to_sg = card_dicts[3]
        assert fem_pl_to_sg["variant_key"] == "pl_to_sg_feminine"
        assert fem_pl_to_sg["front_content"]["main"] == "καλές"

        # Check neuter sg->pl
        neut_sg_to_pl = card_dicts[4]
        assert neut_sg_to_pl["variant_key"] == "sg_to_pl_neuter"
        assert neut_sg_to_pl["front_content"]["main"] == "καλό"
        assert neut_sg_to_pl["front_content"]["sub"] == "neuter"
        assert neut_sg_to_pl["front_content"]["badge"] == "Adj. Neut."
        assert neut_sg_to_pl["back_content"]["answer"] == "καλά"

        # Check neuter pl->sg
        neut_pl_to_sg = card_dicts[5]
        assert neut_pl_to_sg["variant_key"] == "pl_to_sg_neuter"

    @pytest.mark.asyncio
    async def test_adjective_with_partial_genders_produces_only_available(
        self, service, mock_card_record_repo
    ):
        """Adjective with partial genders (e.g., only masculine) produces only available gender cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="μικρός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="small",
            grammar_data=ADJ_GRAMMAR_DATA_PARTIAL,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        created, updated = await service.generate_plural_form_cards([entry], deck_id)

        assert created == 2

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2

        # Only masculine cards should be created
        variant_keys = [card["variant_key"] for card in card_dicts]
        assert "sg_to_pl_masculine" in variant_keys
        assert "pl_to_sg_masculine" in variant_keys
        # Feminine and neuter should not be present
        assert "sg_to_pl_feminine" not in variant_keys
        assert "sg_to_pl_neuter" not in variant_keys

    @pytest.mark.asyncio
    async def test_word_without_grammar_data_is_skipped(self, service, mock_card_record_repo):
        """Word entry without grammar_data (None) is skipped, 0 cards generated."""
        deck_id = uuid4()
        entry = _make_word_entry(
            grammar_data=None,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_plural_form_cards([entry], deck_id)

        assert created == 0
        assert updated == 0

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_without_cases_key_is_skipped(self, service, mock_card_record_repo):
        """Noun without 'cases' key in grammar_data is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={"gender": "feminine"},  # Missing 'cases'
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_without_plural_nominative_is_skipped(self, service, mock_card_record_repo):
        """Noun with singular but no plural nominative is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "cases": {
                    "singular": {"nominative": "η γάτα"},
                    "plural": {"nominative": ""},  # Empty plural
                }
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_adjective_without_forms_key_is_skipped(self, service, mock_card_record_repo):
        """Adjective without 'forms' key in grammar_data is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data={"declension_group": "os_i_o"},  # Missing 'forms'
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_verb_word_entry_is_skipped(self, service, mock_card_record_repo):
        """Verb word entries (not noun or adjective) are silently skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="τρέχω",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="to run",
            grammar_data={"some": "data"},
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_adverb_and_phrase_skipped(self, service, mock_card_record_repo):
        """Adverb and phrase entries are silently skipped."""
        deck_id = uuid4()
        adverb = _make_word_entry(
            part_of_speech=PartOfSpeech.ADVERB,
            grammar_data={"some": "data"},
            deck_id=deck_id,
        )
        phrase = _make_word_entry(
            part_of_speech=PartOfSpeech.PHRASE,
            grammar_data={"some": "data"},
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_plural_form_cards([adverb, phrase], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_empty_word_entries_list(self, service, mock_card_record_repo):
        """Empty word entries list passes empty list to bulk_upsert, returning (0, 0)."""
        deck_id = uuid4()
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_plural_form_cards([], deck_id)

        mock_card_record_repo.bulk_upsert.assert_called_once_with([])
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_mixed_entries_correct_total_count(self, service, mock_card_record_repo):
        """Mixed entries (noun + adjective + verb) produces correct total card count."""
        deck_id = uuid4()
        noun = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )
        adj = _make_word_entry(
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )
        verb = _make_word_entry(
            lemma="τρέχω",
            part_of_speech=PartOfSpeech.VERB,
            grammar_data={"some": "data"},
            deck_id=deck_id,
        )

        # 2 for noun + 6 for adjective + 0 for verb = 8 total
        mock_card_record_repo.bulk_upsert.return_value = ([], 8, 0)

        created, updated = await service.generate_plural_form_cards([noun, adj, verb], deck_id)

        assert created == 8

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 8

    @pytest.mark.asyncio
    async def test_all_cards_have_tier_1_and_is_active_true(self, service, mock_card_record_repo):
        """All plural form cards have tier=1 and is_active=True."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="καλός",
                part_of_speech=PartOfSpeech.ADJECTIVE,
                grammar_data=ADJ_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 8, 0)

        await service.generate_plural_form_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for i, card_dict in enumerate(card_dicts):
            assert card_dict["tier"] == 1, f"Card {i} tier != 1, got {card_dict['tier']}"
            assert (
                card_dict["is_active"] is True
            ), f"Card {i} is_active != True, got {card_dict['is_active']}"

    @pytest.mark.asyncio
    async def test_all_cards_use_plural_form_card_type(self, service, mock_card_record_repo):
        """All plural form cards use CardType.PLURAL_FORM.value."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 6, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["card_type"] == CardType.PLURAL_FORM.value
            assert card_dict["card_type"] == "plural_form"

    @pytest.mark.asyncio
    async def test_front_content_prompts_correct(self, service, mock_card_record_repo):
        """Front content prompts are correct: 'What is the plural form?' and 'What is the singular form?'"""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["front_content"]["prompt"] == "What is the plural form?"
        assert card_dicts[1]["front_content"]["prompt"] == "What is the singular form?"

    @pytest.mark.asyncio
    async def test_front_content_sub_none_for_nouns(self, service, mock_card_record_repo):
        """Front content sub is None for noun cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["front_content"]["sub"] is None

    @pytest.mark.asyncio
    async def test_front_content_sub_gender_for_adjectives(self, service, mock_card_record_repo):
        """Front content sub is gender label for adjective cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 6, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]

        # Check that each gender appears
        subs = [card["front_content"]["sub"] for card in card_dicts]
        assert "masculine" in subs
        assert "feminine" in subs
        assert "neuter" in subs

    @pytest.mark.asyncio
    async def test_back_content_answer_sub_always_none(self, service, mock_card_record_repo):
        """Back content answer_sub is always None."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                part_of_speech=PartOfSpeech.ADJECTIVE,
                grammar_data=ADJ_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 8, 0)

        await service.generate_plural_form_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["back_content"]["answer_sub"] is None

    @pytest.mark.asyncio
    async def test_hint_is_translation_en(self, service, mock_card_record_repo):
        """Front content hint is set to word_entry.translation_en."""
        deck_id = uuid4()
        entry = _make_word_entry(
            translation_en="wonderful_translation",
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_plural_form_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["front_content"]["hint"] == "wonderful_translation"

    @pytest.mark.asyncio
    async def test_variant_keys_match_specification(self, service, mock_card_record_repo):
        """Variant keys match specification exactly."""
        deck_id = uuid4()
        noun = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )
        adj = _make_word_entry(
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 8, 0)

        await service.generate_plural_form_cards([noun, adj], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]

        variant_keys = [card["variant_key"] for card in card_dicts]

        # Noun variant keys
        assert "sg_to_pl" in variant_keys
        assert "pl_to_sg" in variant_keys

        # Adjective variant keys (one per gender, 2 directions)
        assert "sg_to_pl_masculine" in variant_keys
        assert "pl_to_sg_masculine" in variant_keys
        assert "sg_to_pl_feminine" in variant_keys
        assert "pl_to_sg_feminine" in variant_keys
        assert "sg_to_pl_neuter" in variant_keys
        assert "pl_to_sg_neuter" in variant_keys

    @pytest.mark.asyncio
    async def test_badge_values_correct(self, service, mock_card_record_repo):
        """Badge values match specification."""
        deck_id = uuid4()
        noun = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )
        adj = _make_word_entry(
            part_of_speech=PartOfSpeech.ADJECTIVE,
            grammar_data=ADJ_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 8, 0)

        await service.generate_plural_form_cards([noun, adj], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]

        badges = [card["front_content"]["badge"] for card in card_dicts]

        # Noun badge
        assert badges.count("Noun") == 2

        # Adjective badges
        assert badges.count("Adj. Masc.") == 2
        assert badges.count("Adj. Fem.") == 2
        assert badges.count("Adj. Neut.") == 2


# =============================================================================
# Sentence Translation Card Test Data
# =============================================================================

# Examples with IDs (valid for card generation)
EXAMPLE_WITH_ID_AND_RUSSIAN = {
    "id": "ex_spiti1",
    "greek": "Το σπίτι μου είναι μικρό.",
    "english": "My house is small.",
    "russian": "Мой дом маленький.",
}

EXAMPLE_WITH_ID_NO_RUSSIAN = {
    "id": "ex_nero1",
    "greek": "Πίνω νερό.",
    "english": "I drink water.",
}

# Example WITHOUT id (should be skipped)
EXAMPLE_WITHOUT_ID = {
    "greek": "Πού είναι το σπίτι;",
    "english": "Where is the house?",
}


@pytest.mark.unit
class TestGenerateSentenceTranslationCards:
    """Unit tests for CardGeneratorService.generate_sentence_translation_cards()."""

    @pytest.mark.asyncio
    async def test_single_entry_one_example_produces_two_cards(
        self, service, mock_card_record_repo
    ):
        """Single word entry with one example produces 2 cards (el_to_target, target_to_el)."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        created, updated = await service.generate_sentence_translation_cards([entry], deck_id)

        assert created == 2
        assert updated == 0

        mock_card_record_repo.bulk_upsert.assert_called_once()
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2

        # Card 1: el_to_target (Greek -> English)
        el_to_target = card_dicts[0]
        assert el_to_target["word_entry_id"] == entry.id
        assert el_to_target["deck_id"] == deck_id
        assert el_to_target["is_active"] is True
        assert el_to_target["card_type"] == CardType.SENTENCE_TRANSLATION.value
        assert el_to_target["front_content"]["main"] == "Το σπίτι μου είναι μικρό."
        assert el_to_target["front_content"]["prompt"] == "Translate this sentence"
        assert el_to_target["front_content"]["badge"] == "Sentence"
        assert el_to_target["front_content"]["example_id"] == "ex_spiti1"
        assert el_to_target["front_content"]["direction"] == "el_to_target"
        assert el_to_target["back_content"]["answer"] == "My house is small."
        assert el_to_target["back_content"]["answer_ru"] == "Мой дом маленький."

        # Card 2: target_to_el (English -> Greek)
        target_to_el = card_dicts[1]
        assert target_to_el["word_entry_id"] == entry.id
        assert target_to_el["deck_id"] == deck_id
        assert target_to_el["is_active"] is True
        assert target_to_el["card_type"] == CardType.SENTENCE_TRANSLATION.value
        assert target_to_el["front_content"]["main"] == "My house is small."
        assert target_to_el["front_content"]["prompt"] == "Translate to Greek"
        assert target_to_el["front_content"]["example_id"] == "ex_spiti1"
        assert target_to_el["front_content"]["direction"] == "target_to_el"
        assert target_to_el["back_content"]["answer"] == "Το σπίτι μου είναι μικρό."
        assert target_to_el["back_content"]["answer_ru"] is None

    @pytest.mark.asyncio
    async def test_entry_with_multiple_examples_produces_cards_per_example(
        self, service, mock_card_record_repo
    ):
        """Entry with multiple examples produces 2 cards per example."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN, EXAMPLE_WITH_ID_NO_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 4, 0)

        created, updated = await service.generate_sentence_translation_cards([entry], deck_id)

        assert created == 4
        assert updated == 0

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 4

        # Check example_id fields
        example_ids = [card["front_content"]["example_id"] for card in card_dicts]
        assert example_ids.count("ex_spiti1") == 2
        assert example_ids.count("ex_nero1") == 2

    @pytest.mark.asyncio
    async def test_entry_with_no_examples_produces_zero_cards(self, service, mock_card_record_repo):
        """Entry with examples=None or examples=[] produces 0 cards."""
        deck_id = uuid4()

        # Test with examples=None
        entry_none = _make_word_entry(deck_id=deck_id, examples=None)
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_sentence_translation_cards([entry_none], deck_id)

        assert created == 0
        assert updated == 0
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

        # Test with examples=[] (empty list)
        mock_card_record_repo.bulk_upsert.reset_mock()
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)
        entry_empty = _make_word_entry(deck_id=deck_id, examples=[])

        created, updated = await service.generate_sentence_translation_cards([entry_empty], deck_id)

        assert created == 0
        assert updated == 0
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_examples_without_id_are_skipped(self, service, mock_card_record_repo):
        """Examples without id field are silently skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN, EXAMPLE_WITHOUT_ID],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        created, updated = await service.generate_sentence_translation_cards([entry], deck_id)

        # Only 2 cards from the example with id
        assert created == 2
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 2
        assert all(card["front_content"]["example_id"] == "ex_spiti1" for card in card_dicts)

    @pytest.mark.asyncio
    async def test_variant_keys_use_example_id(self, service, mock_card_record_repo):
        """Variant keys use example_id: <example_id>_el_to_target and <example_id>_target_to_el."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["variant_key"] == "el_to_target_ex_spiti1"
        assert card_dicts[1]["variant_key"] == "target_to_el_ex_spiti1"

    @pytest.mark.asyncio
    async def test_correct_prompts(self, service, mock_card_record_repo):
        """Cards have correct prompts: 'Translate this sentence' and 'Translate to Greek'."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_NO_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["front_content"]["prompt"] == "Translate this sentence"
        assert card_dicts[1]["front_content"]["prompt"] == "Translate to Greek"

    @pytest.mark.asyncio
    async def test_all_cards_have_tier_1_and_is_active_true(self, service, mock_card_record_repo):
        """All sentence translation cards have tier=1 and is_active=True."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                deck_id=deck_id,
                examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
            ),
            _make_word_entry(
                deck_id=deck_id,
                examples=[EXAMPLE_WITH_ID_NO_RUSSIAN],
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 4, 0)

        await service.generate_sentence_translation_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for i, card_dict in enumerate(card_dicts):
            assert card_dict["tier"] == 1, f"Card {i} tier != 1"
            assert card_dict["is_active"] is True, f"Card {i} is_active != True"

    @pytest.mark.asyncio
    async def test_empty_entries_list(self, service, mock_card_record_repo):
        """Empty word entries list passes empty list to bulk_upsert, returning (0, 0)."""
        deck_id = uuid4()
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_sentence_translation_cards([], deck_id)

        mock_card_record_repo.bulk_upsert.assert_called_once_with([])
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_card_type_is_sentence_translation(self, service, mock_card_record_repo):
        """All cards have card_type == 'sentence_translation'."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["card_type"] == CardType.SENTENCE_TRANSLATION.value
        assert card_dicts[0]["card_type"] == "sentence_translation"
        assert card_dicts[1]["card_type"] == CardType.SENTENCE_TRANSLATION.value
        assert card_dicts[1]["card_type"] == "sentence_translation"

    @pytest.mark.asyncio
    async def test_badge_is_sentence(self, service, mock_card_record_repo):
        """All sentence translation cards have badge == 'Sentence'."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_NO_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["front_content"]["badge"] == "Sentence"
        assert card_dicts[1]["front_content"]["badge"] == "Sentence"

    @pytest.mark.asyncio
    async def test_example_id_field_present_and_correct(self, service, mock_card_record_repo):
        """Front content example_id field is present and matches the example id."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN, EXAMPLE_WITH_ID_NO_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 4, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["front_content"]["example_id"] == "ex_spiti1"
        assert card_dicts[1]["front_content"]["example_id"] == "ex_spiti1"
        assert card_dicts[2]["front_content"]["example_id"] == "ex_nero1"
        assert card_dicts[3]["front_content"]["example_id"] == "ex_nero1"

    @pytest.mark.asyncio
    async def test_direction_field_correct(self, service, mock_card_record_repo):
        """Front content direction field is 'el_to_target' or 'target_to_el'."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["front_content"]["direction"] == "el_to_target"
        assert card_dicts[1]["front_content"]["direction"] == "target_to_el"

    @pytest.mark.asyncio
    async def test_answer_ru_on_el_to_target_only(self, service, mock_card_record_repo):
        """answer_ru is present on el_to_target cards, None on target_to_el cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        # el_to_target card has answer_ru
        assert card_dicts[0]["back_content"]["answer_ru"] == "Мой дом маленький."
        # target_to_el card has answer_ru=None
        assert card_dicts[1]["back_content"]["answer_ru"] is None

    @pytest.mark.asyncio
    async def test_answer_ru_none_when_russian_field_absent(self, service, mock_card_record_repo):
        """answer_ru is None when example doesn't have russian field."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_NO_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        # Both cards should have answer_ru=None (el_to_target gets None if russian not present)
        assert card_dicts[0]["back_content"]["answer_ru"] is None
        assert card_dicts[1]["back_content"]["answer_ru"] is None

    @pytest.mark.asyncio
    async def test_front_content_sub_is_none(self, service, mock_card_record_repo):
        """Front content sub is None for all sentence translation cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["front_content"]["sub"] is None

    @pytest.mark.asyncio
    async def test_back_content_answer_sub_is_none(self, service, mock_card_record_repo):
        """Back content answer_sub is None for all sentence translation cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["back_content"]["answer_sub"] is None

    @pytest.mark.asyncio
    async def test_front_content_hint_is_none(self, service, mock_card_record_repo):
        """Front content hint is None for all sentence translation cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["front_content"]["hint"] is None

    @pytest.mark.asyncio
    async def test_back_content_context_is_none(self, service, mock_card_record_repo):
        """Back content context is None for all sentence translation cards."""
        deck_id = uuid4()
        entry = _make_word_entry(
            deck_id=deck_id,
            examples=[EXAMPLE_WITH_ID_AND_RUSSIAN],
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_sentence_translation_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["back_content"]["context"] is None


# =============================================================================
# Article Card Test Data
# =============================================================================

MASCULINE_NOUN_GRAMMAR_DATA = {
    "gender": "masculine",
    "cases": {
        "singular": {
            "nominative": "ο σκύλος",
            "genitive": "του σκύλου",
            "accusative": "τον σκύλο",
        },
        "plural": {
            "nominative": "οι σκύλοι",
            "genitive": "των σκύλων",
            "accusative": "τους σκύλους",
        },
    },
}

NEUTER_NOUN_GRAMMAR_DATA = {
    "gender": "neuter",
    "cases": {
        "singular": {
            "nominative": "το σπίτι",
            "genitive": "του σπιτιού",
            "accusative": "το σπίτι",
        },
        "plural": {
            "nominative": "τα σπίτια",
            "genitive": "των σπιτιών",
            "accusative": "τα σπίτια",
        },
    },
}


@pytest.mark.unit
class TestGenerateArticleCards:
    """Unit tests for CardGeneratorService.generate_article_cards()."""

    @pytest.mark.asyncio
    async def test_feminine_noun_produces_one_card(self, service, mock_card_record_repo):
        """Feminine noun with gender and nominative produces 1 article card."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        created, updated = await service.generate_article_cards([entry], deck_id)

        assert created == 1
        assert updated == 0

        mock_card_record_repo.bulk_upsert.assert_called_once()
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 1

        card = card_dicts[0]
        assert card["word_entry_id"] == entry.id
        assert card["deck_id"] == deck_id
        assert card["card_type"] == CardType.ARTICLE.value
        assert card["variant_key"] == "default"
        assert card["tier"] == 1
        assert card["is_active"] is True

    @pytest.mark.asyncio
    async def test_masculine_noun_produces_one_card(self, service, mock_card_record_repo):
        """Masculine noun with gender and nominative produces 1 article card."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="σκύλος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="dog",
            grammar_data=MASCULINE_NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 1

        card = card_dicts[0]
        assert card["back_content"]["answer"] == "ο σκύλος"
        assert card["back_content"]["gender"] == "Masculine"
        assert card["back_content"]["gender_ru"] == "Мужской род"

    @pytest.mark.asyncio
    async def test_neuter_noun_produces_one_card(self, service, mock_card_record_repo):
        """Neuter noun with gender and nominative produces 1 article card."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            grammar_data=NEUTER_NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 1

        card = card_dicts[0]
        assert card["back_content"]["answer"] == "το σπίτι"
        assert card["back_content"]["gender"] == "Neuter"
        assert card["back_content"]["gender_ru"] == "Средний род"

    @pytest.mark.asyncio
    async def test_front_content_fields(self, service, mock_card_record_repo):
        """Front content has correct prompt, main=___ lemma, sub=translation_en, badge=Noun, hint=None."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        front = card_dicts[0]["front_content"]

        assert front["card_type"] == "article"
        assert front["prompt"] == "What is the article?"
        assert front["main"] == "___ γάτα"
        assert front["sub"] == "cat"
        assert front["badge"] == "Noun"
        assert front["hint"] is None

    @pytest.mark.asyncio
    async def test_back_content_fields_feminine(self, service, mock_card_record_repo):
        """Back content has answer=nominative_singular, answer_sub=None, gender=English, gender_ru=Russian."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        back = card_dicts[0]["back_content"]

        assert back["card_type"] == "article"
        assert back["answer"] == "η γάτα"
        assert back["answer_sub"] is None
        assert back["gender"] == "Feminine"
        assert back["gender_ru"] == "Женский род"

    @pytest.mark.asyncio
    async def test_non_noun_entries_are_skipped(self, service, mock_card_record_repo):
        """Non-noun entries (verb, adjective, adverb, phrase) are silently skipped."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                part_of_speech=PartOfSpeech.VERB,
                grammar_data={
                    "gender": "masculine",
                    "cases": {"singular": {"nominative": "ο τρέχω"}},
                },
                deck_id=deck_id,
            ),
            _make_word_entry(
                part_of_speech=PartOfSpeech.ADJECTIVE,
                grammar_data={
                    "gender": "masculine",
                    "cases": {"singular": {"nominative": "ο καλός"}},
                },
                deck_id=deck_id,
            ),
            _make_word_entry(
                part_of_speech=PartOfSpeech.ADVERB,
                grammar_data={
                    "gender": "masculine",
                    "cases": {"singular": {"nominative": "ο γρήγορα"}},
                },
                deck_id=deck_id,
            ),
            _make_word_entry(
                part_of_speech=PartOfSpeech.PHRASE,
                grammar_data={"gender": "masculine", "cases": {"singular": {"nominative": "ο κ."}}},
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_article_cards(entries, deck_id)

        assert created == 0
        assert updated == 0
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_without_grammar_data_is_skipped(self, service, mock_card_record_repo):
        """Noun with grammar_data=None is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=None,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_article_cards([entry], deck_id)

        assert created == 0
        assert updated == 0
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_without_gender_is_skipped(self, service, mock_card_record_repo):
        """Noun with grammar_data missing gender key is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "cases": {
                    "singular": {"nominative": "η γάτα"},
                    "plural": {"nominative": "οι γάτες"},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_with_empty_gender_is_skipped(self, service, mock_card_record_repo):
        """Noun with empty gender string is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "gender": "",
                "cases": {
                    "singular": {"nominative": "η γάτα"},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_without_nominative_singular_is_skipped(
        self, service, mock_card_record_repo
    ):
        """Noun with gender but no cases.singular.nominative is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "gender": "feminine",
                "cases": {
                    "plural": {"nominative": "οι γάτες"},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_with_unknown_gender_is_skipped(self, service, mock_card_record_repo):
        """Noun with unknown gender value (not in GENDER_LABELS) is skipped."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "gender": "unknown_gender",
                "cases": {
                    "singular": {"nominative": "η γάτα"},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_empty_word_entries_list(self, service, mock_card_record_repo):
        """Empty word entries list passes empty list to bulk_upsert, returning (0, 0)."""
        deck_id = uuid4()
        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        created, updated = await service.generate_article_cards([], deck_id)

        mock_card_record_repo.bulk_upsert.assert_called_once_with([])
        assert created == 0
        assert updated == 0

    @pytest.mark.asyncio
    async def test_multiple_nouns_produce_correct_count(self, service, mock_card_record_repo):
        """Multiple nouns with valid grammar_data produce correct number of cards."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="cat",
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σκύλος",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="dog",
                grammar_data=MASCULINE_NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σπίτι",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="house",
                grammar_data=NEUTER_NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 3, 0)

        created, updated = await service.generate_article_cards(entries, deck_id)

        assert created == 3
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 3

    @pytest.mark.asyncio
    async def test_mixed_entries_only_eligible_nouns_produce_cards(
        self, service, mock_card_record_repo
    ):
        """Mixed entries: only eligible nouns (with gender + nominative) produce cards."""
        deck_id = uuid4()
        entries = [
            # Eligible noun
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="cat",
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            # Verb - skipped
            _make_word_entry(
                lemma="τρέχω",
                part_of_speech=PartOfSpeech.VERB,
                grammar_data={"some": "data"},
                deck_id=deck_id,
            ),
            # Noun without gender - skipped
            _make_word_entry(
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data={"cases": {"singular": {"nominative": "η γάτα"}}},
                deck_id=deck_id,
            ),
            # Adjective - skipped
            _make_word_entry(
                part_of_speech=PartOfSpeech.ADJECTIVE,
                grammar_data=ADJ_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        created, updated = await service.generate_article_cards(entries, deck_id)

        assert created == 1
        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 1

    @pytest.mark.asyncio
    async def test_all_cards_have_tier_1_and_is_active_true(self, service, mock_card_record_repo):
        """All article cards have tier=1 and is_active=True."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σκύλος",
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=MASCULINE_NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_article_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for i, card_dict in enumerate(card_dicts):
            assert card_dict["tier"] == 1, f"Card {i} tier != 1"
            assert card_dict["is_active"] is True, f"Card {i} is_active != True"

    @pytest.mark.asyncio
    async def test_card_type_is_article(self, service, mock_card_record_repo):
        """All article cards have card_type == CardType.ARTICLE.value == 'article'."""
        deck_id = uuid4()
        entry = _make_word_entry(
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data=NOUN_GRAMMAR_DATA,
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 1, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert card_dicts[0]["card_type"] == CardType.ARTICLE.value
        assert card_dicts[0]["card_type"] == "article"

    @pytest.mark.asyncio
    async def test_variant_key_is_default(self, service, mock_card_record_repo):
        """All article cards have variant_key='default'."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σκύλος",
                part_of_speech=PartOfSpeech.NOUN,
                grammar_data=MASCULINE_NOUN_GRAMMAR_DATA,
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 2, 0)

        await service.generate_article_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        for card_dict in card_dicts:
            assert card_dict["variant_key"] == "default"

    @pytest.mark.asyncio
    async def test_gender_labels_all_three_genders(self, service, mock_card_record_repo):
        """Gender labels map correctly for all three genders."""
        deck_id = uuid4()
        entries = [
            _make_word_entry(
                lemma="γάτα",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="cat",
                grammar_data=NOUN_GRAMMAR_DATA,  # feminine
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σκύλος",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="dog",
                grammar_data=MASCULINE_NOUN_GRAMMAR_DATA,  # masculine
                deck_id=deck_id,
            ),
            _make_word_entry(
                lemma="σπίτι",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="house",
                grammar_data=NEUTER_NOUN_GRAMMAR_DATA,  # neuter
                deck_id=deck_id,
            ),
        ]

        mock_card_record_repo.bulk_upsert.return_value = ([], 3, 0)

        await service.generate_article_cards(entries, deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]

        # feminine
        assert card_dicts[0]["back_content"]["gender"] == "Feminine"
        assert card_dicts[0]["back_content"]["gender_ru"] == "Женский род"
        # masculine
        assert card_dicts[1]["back_content"]["gender"] == "Masculine"
        assert card_dicts[1]["back_content"]["gender_ru"] == "Мужской род"
        # neuter
        assert card_dicts[2]["back_content"]["gender"] == "Neuter"
        assert card_dicts[2]["back_content"]["gender_ru"] == "Средний род"

    @pytest.mark.asyncio
    async def test_noun_with_empty_nominative_is_skipped(self, service, mock_card_record_repo):
        """Noun with empty nominative string is skipped (safe_get returns None for empty strings)."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "gender": "feminine",
                "cases": {
                    "singular": {"nominative": ""},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0

    @pytest.mark.asyncio
    async def test_noun_with_whitespace_only_nominative_is_skipped(
        self, service, mock_card_record_repo
    ):
        """Noun with whitespace-only nominative is skipped (safe_get strips whitespace)."""
        deck_id = uuid4()
        entry = _make_word_entry(
            part_of_speech=PartOfSpeech.NOUN,
            grammar_data={
                "gender": "feminine",
                "cases": {
                    "singular": {"nominative": "   "},
                },
            },
            deck_id=deck_id,
        )

        mock_card_record_repo.bulk_upsert.return_value = ([], 0, 0)

        await service.generate_article_cards([entry], deck_id)

        card_dicts = mock_card_record_repo.bulk_upsert.call_args[0][0]
        assert len(card_dicts) == 0
