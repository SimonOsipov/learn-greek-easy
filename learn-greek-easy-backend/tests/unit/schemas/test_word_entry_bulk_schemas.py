"""Unit tests for Bulk WordEntry schemas validation.

Tests for bulk word entry schemas including:
- WordEntryBulkCreate: Individual entry for bulk upload
- WordEntryBulkRequest: Bulk upload request with deck_id and entries
- WordEntryBulkResponse: Response with counts and entries

Tests cover field validation, validators for lemma/translation_ru,
duplicate detection, and boundary conditions.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import PartOfSpeech
from src.schemas.word_entry import (
    ExampleSentence,
    WordEntryBulkCreate,
    WordEntryBulkRequest,
    WordEntryBulkResponse,
    WordEntryResponse,
)

# ============================================================================
# Test WordEntryBulkCreate Schema
# ============================================================================


class TestWordEntryBulkCreate:
    """Test WordEntryBulkCreate schema validation."""

    def test_valid_bulk_create_minimal(self):
        """Test valid entry with only required fields."""
        entry = WordEntryBulkCreate(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house, home",
        )
        assert entry.lemma == "σπίτι"
        assert entry.part_of_speech == PartOfSpeech.NOUN
        assert entry.translation_en == "house, home"
        assert entry.translation_ru is None
        assert entry.pronunciation is None
        assert entry.grammar_data is None
        assert entry.examples is None

    def test_valid_bulk_create_all_fields(self):
        """Test valid entry with all optional fields."""
        entry = WordEntryBulkCreate(
            lemma="γράφω",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="to write",
            translation_ru="писать",
            pronunciation="/ˈɣrafo/",
            grammar_data={"voice": "active", "present_1s": "γράφω"},
            examples=[
                ExampleSentence(
                    id="ex_grafo1",
                    greek="Γράφω ένα γράμμα.",
                    english="I write a letter.",
                )
            ],
        )
        assert entry.lemma == "γράφω"
        assert entry.translation_ru == "писать"
        assert entry.pronunciation == "/ˈɣrafo/"
        assert entry.grammar_data == {"voice": "active", "present_1s": "γράφω"}
        assert len(entry.examples) == 1

    def test_lemma_whitespace_stripping(self):
        """Test lemma field strips leading/trailing whitespace."""
        entry = WordEntryBulkCreate(
            lemma="  σπίτι  ",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
        )
        assert entry.lemma == "σπίτι"

    def test_lemma_empty_after_strip_rejected(self):
        """Test empty lemma after stripping is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="   ",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="house",
            )
        assert "lemma cannot be empty" in str(exc_info.value).lower()

    def test_lemma_required(self):
        """Test lemma field is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="house",
            )
        assert "lemma" in str(exc_info.value).lower()

    def test_lemma_max_length(self):
        """Test lemma max length of 100 characters."""
        # Valid at boundary
        entry = WordEntryBulkCreate(
            lemma="α" * 100,
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert len(entry.lemma) == 100

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="α" * 101,
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_part_of_speech_required(self):
        """Test part_of_speech field is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="σπίτι",
                translation_en="house",
            )
        assert "part_of_speech" in str(exc_info.value).lower()

    def test_all_part_of_speech_values(self):
        """Test all valid PartOfSpeech enum values are accepted."""
        all_pos = [
            PartOfSpeech.NOUN,
            PartOfSpeech.VERB,
            PartOfSpeech.ADJECTIVE,
            PartOfSpeech.ADVERB,
            PartOfSpeech.PHRASE,
        ]
        for pos in all_pos:
            entry = WordEntryBulkCreate(
                lemma=f"test_{pos.value}",
                part_of_speech=pos,
                translation_en="test",
            )
            assert entry.part_of_speech == pos

    def test_translation_en_required(self):
        """Test translation_en field is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="σπίτι",
                part_of_speech=PartOfSpeech.NOUN,
            )
        assert "translation_en" in str(exc_info.value).lower()

    def test_translation_en_max_length(self):
        """Test translation_en max length of 500 characters."""
        # Valid at boundary
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="a" * 500,
        )
        assert len(entry.translation_en) == 500

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="test",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="a" * 501,
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_translation_ru_whitespace_stripping(self):
        """Test translation_ru strips whitespace."""
        entry = WordEntryBulkCreate(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            translation_ru="  дом  ",
        )
        assert entry.translation_ru == "дом"

    def test_translation_ru_empty_becomes_none(self):
        """Test translation_ru empty string becomes None."""
        entry = WordEntryBulkCreate(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            translation_ru="   ",
        )
        assert entry.translation_ru is None

    def test_translation_ru_none_stays_none(self):
        """Test translation_ru None stays None."""
        entry = WordEntryBulkCreate(
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            translation_ru=None,
        )
        assert entry.translation_ru is None

    def test_translation_ru_max_length(self):
        """Test translation_ru max length of 500 characters."""
        # Valid at boundary
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            translation_ru="а" * 500,
        )
        assert len(entry.translation_ru) == 500

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="test",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
                translation_ru="а" * 501,
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_pronunciation_max_length(self):
        """Test pronunciation max length of 200 characters."""
        # Valid at boundary
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            pronunciation="a" * 200,
        )
        assert len(entry.pronunciation) == 200

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkCreate(
                lemma="test",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
                pronunciation="a" * 201,
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_grammar_data_as_dict(self):
        """Test grammar_data accepts arbitrary dict."""
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="test",
            grammar_data={
                "voice": "active",
                "present_1s": "γράφω",
                "custom_field": "value",
            },
        )
        assert entry.grammar_data["voice"] == "active"
        assert entry.grammar_data["custom_field"] == "value"

    def test_examples_accepts_list(self):
        """Test examples accepts list of ExampleSentence."""
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            examples=[
                ExampleSentence(id="ex_test1", greek="Γεια σου!", english="Hello!"),
                ExampleSentence(id="ex_test2", greek="Καλημέρα", english="Good morning"),
            ],
        )
        assert len(entry.examples) == 2

    def test_no_deck_id_field(self):
        """Test WordEntryBulkCreate does not have deck_id field."""
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert not hasattr(entry, "deck_id") or "deck_id" not in entry.model_fields

    def test_no_audio_key_field(self):
        """Test WordEntryBulkCreate does not have audio_key field."""
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert "audio_key" not in entry.model_fields

    def test_no_is_active_field(self):
        """Test WordEntryBulkCreate does not have is_active field."""
        entry = WordEntryBulkCreate(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert "is_active" not in entry.model_fields


# ============================================================================
# Test WordEntryBulkRequest Schema
# ============================================================================


class TestWordEntryBulkRequest:
    """Test WordEntryBulkRequest schema validation."""

    def test_valid_request_single_entry(self):
        """Test valid request with one entry."""
        deck_id = uuid4()
        request = WordEntryBulkRequest(
            deck_id=deck_id,
            word_entries=[
                WordEntryBulkCreate(
                    lemma="σπίτι",
                    part_of_speech=PartOfSpeech.NOUN,
                    translation_en="house",
                )
            ],
        )
        assert request.deck_id == deck_id
        assert len(request.word_entries) == 1

    def test_valid_request_multiple_entries(self):
        """Test valid request with multiple entries."""
        request = WordEntryBulkRequest(
            deck_id=uuid4(),
            word_entries=[
                WordEntryBulkCreate(
                    lemma="σπίτι",
                    part_of_speech=PartOfSpeech.NOUN,
                    translation_en="house",
                ),
                WordEntryBulkCreate(
                    lemma="γράφω",
                    part_of_speech=PartOfSpeech.VERB,
                    translation_en="to write",
                ),
                WordEntryBulkCreate(
                    lemma="καλός",
                    part_of_speech=PartOfSpeech.ADJECTIVE,
                    translation_en="good",
                ),
            ],
        )
        assert len(request.word_entries) == 3

    def test_deck_id_required(self):
        """Test deck_id is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                word_entries=[
                    WordEntryBulkCreate(
                        lemma="test",
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="test",
                    )
                ],
            )
        assert "deck_id" in str(exc_info.value).lower()

    def test_deck_id_must_be_uuid(self):
        """Test deck_id must be a valid UUID."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                deck_id="not-a-uuid",
                word_entries=[
                    WordEntryBulkCreate(
                        lemma="test",
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="test",
                    )
                ],
            )
        assert "uuid" in str(exc_info.value).lower()

    def test_word_entries_required(self):
        """Test word_entries is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(deck_id=uuid4())
        assert "word_entries" in str(exc_info.value).lower()

    def test_word_entries_min_length_one(self):
        """Test word_entries must have at least 1 entry."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                deck_id=uuid4(),
                word_entries=[],
            )
        assert "at least 1 item" in str(exc_info.value).lower()

    def test_word_entries_max_length_100(self):
        """Test word_entries must have at most 100 entries."""
        entries_101 = [
            WordEntryBulkCreate(
                lemma=f"word{i}",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en=f"word {i}",
            )
            for i in range(101)
        ]
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                deck_id=uuid4(),
                word_entries=entries_101,
            )
        assert "at most 100 item" in str(exc_info.value).lower()

    def test_word_entries_at_max_valid(self):
        """Test word_entries at exactly 100 entries is valid."""
        entries_100 = [
            WordEntryBulkCreate(
                lemma=f"word{i}",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en=f"word {i}",
            )
            for i in range(100)
        ]
        request = WordEntryBulkRequest(
            deck_id=uuid4(),
            word_entries=entries_100,
        )
        assert len(request.word_entries) == 100

    def test_duplicate_lemma_pos_same_case_rejected(self):
        """Test duplicate lemma + part_of_speech is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                deck_id=uuid4(),
                word_entries=[
                    WordEntryBulkCreate(
                        lemma="σπίτι",
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="house",
                    ),
                    WordEntryBulkCreate(
                        lemma="σπίτι",
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="home",
                    ),
                ],
            )
        assert "duplicate entry" in str(exc_info.value).lower()
        assert "σπίτι" in str(exc_info.value)
        assert "noun" in str(exc_info.value).lower()

    def test_duplicate_lemma_pos_case_insensitive(self):
        """Test duplicate detection is case-insensitive."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkRequest(
                deck_id=uuid4(),
                word_entries=[
                    WordEntryBulkCreate(
                        lemma="Σπίτι",  # Uppercase first letter
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="house",
                    ),
                    WordEntryBulkCreate(
                        lemma="σπίτι",  # Lowercase
                        part_of_speech=PartOfSpeech.NOUN,
                        translation_en="home",
                    ),
                ],
            )
        assert "duplicate entry" in str(exc_info.value).lower()

    def test_same_lemma_different_pos_allowed(self):
        """Test same lemma with different part_of_speech is allowed."""
        request = WordEntryBulkRequest(
            deck_id=uuid4(),
            word_entries=[
                WordEntryBulkCreate(
                    lemma="έργο",
                    part_of_speech=PartOfSpeech.NOUN,
                    translation_en="work (noun)",
                ),
                WordEntryBulkCreate(
                    lemma="έργο",
                    part_of_speech=PartOfSpeech.VERB,
                    translation_en="to work",
                ),
            ],
        )
        assert len(request.word_entries) == 2

    def test_different_lemma_same_pos_allowed(self):
        """Test different lemmas with same part_of_speech is allowed."""
        request = WordEntryBulkRequest(
            deck_id=uuid4(),
            word_entries=[
                WordEntryBulkCreate(
                    lemma="σπίτι",
                    part_of_speech=PartOfSpeech.NOUN,
                    translation_en="house",
                ),
                WordEntryBulkCreate(
                    lemma="δρόμος",
                    part_of_speech=PartOfSpeech.NOUN,
                    translation_en="road",
                ),
            ],
        )
        assert len(request.word_entries) == 2


# ============================================================================
# Test WordEntryBulkResponse Schema
# ============================================================================


class TestWordEntryBulkResponse:
    """Test WordEntryBulkResponse schema validation."""

    def test_valid_response_empty_entries(self):
        """Test valid response with empty entries."""
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=0,
            updated_count=0,
            word_entries=[],
        )
        assert response.created_count == 0
        assert response.updated_count == 0
        assert len(response.word_entries) == 0

    def test_valid_response_with_entries(self):
        """Test valid response with entries."""
        now = datetime.now()
        entry = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=1,
            updated_count=0,
            word_entries=[entry],
        )
        assert response.created_count == 1
        assert len(response.word_entries) == 1

    def test_deck_id_required(self):
        """Test deck_id is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                created_count=0,
                updated_count=0,
                word_entries=[],
            )
        assert "deck_id" in str(exc_info.value).lower()

    def test_created_count_required(self):
        """Test created_count is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                updated_count=0,
                word_entries=[],
            )
        assert "created_count" in str(exc_info.value).lower()

    def test_updated_count_required(self):
        """Test updated_count is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=0,
                word_entries=[],
            )
        assert "updated_count" in str(exc_info.value).lower()

    def test_word_entries_required(self):
        """Test word_entries is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=0,
                updated_count=0,
            )
        assert "word_entries" in str(exc_info.value).lower()

    def test_created_count_must_be_non_negative(self):
        """Test created_count must be >= 0."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=-1,
                updated_count=0,
                word_entries=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_updated_count_must_be_non_negative(self):
        """Test updated_count must be >= 0."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=0,
                updated_count=-1,
                word_entries=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_cards_created_defaults_to_zero(self):
        """Test cards_created defaults to 0 when not provided."""
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=0,
            updated_count=0,
            word_entries=[],
        )
        assert response.cards_created == 0

    def test_cards_updated_defaults_to_zero(self):
        """Test cards_updated defaults to 0 when not provided."""
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=0,
            updated_count=0,
            word_entries=[],
        )
        assert response.cards_updated == 0

    def test_cards_created_accepts_positive_value(self):
        """Test cards_created accepts positive integer."""
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=0,
            updated_count=0,
            cards_created=5,
            word_entries=[],
        )
        assert response.cards_created == 5

    def test_cards_updated_accepts_positive_value(self):
        """Test cards_updated accepts positive integer."""
        response = WordEntryBulkResponse(
            deck_id=uuid4(),
            created_count=0,
            updated_count=0,
            cards_updated=3,
            word_entries=[],
        )
        assert response.cards_updated == 3

    def test_cards_created_rejects_negative(self):
        """Test cards_created rejects negative value."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=0,
                updated_count=0,
                cards_created=-1,
                word_entries=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_cards_updated_rejects_negative(self):
        """Test cards_updated rejects negative value."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBulkResponse(
                deck_id=uuid4(),
                created_count=0,
                updated_count=0,
                cards_updated=-1,
                word_entries=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_response_serialization(self):
        """Test response serializes correctly to JSON."""
        now = datetime.now()
        deck_id = uuid4()
        entry_id = uuid4()
        entry = WordEntryResponse(
            id=entry_id,
            deck_id=deck_id,
            lemma="σπίτι",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="house",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        response = WordEntryBulkResponse(
            deck_id=deck_id,
            created_count=1,
            updated_count=2,
            word_entries=[entry],
        )
        json_data = response.model_dump(mode="json")
        assert json_data["created_count"] == 1
        assert json_data["updated_count"] == 2
        assert "cards_created" in json_data
        assert "cards_updated" in json_data
        assert len(json_data["word_entries"]) == 1
        assert json_data["word_entries"][0]["part_of_speech"] == "noun"


# ============================================================================
# Test Schema Exports
# ============================================================================


class TestBulkSchemaExports:
    """Test bulk schemas are properly exported."""

    def test_schemas_exported_from_word_entry_module(self):
        """Test schemas can be imported from word_entry module."""
        from src.schemas.word_entry import (
            WordEntryBulkCreate,
            WordEntryBulkRequest,
            WordEntryBulkResponse,
        )

        assert WordEntryBulkCreate is not None
        assert WordEntryBulkRequest is not None
        assert WordEntryBulkResponse is not None

    def test_schemas_exported_from_schemas_init(self):
        """Test schemas can be imported from schemas __init__."""
        from src.schemas import WordEntryBulkCreate, WordEntryBulkRequest, WordEntryBulkResponse

        assert WordEntryBulkCreate is not None
        assert WordEntryBulkRequest is not None
        assert WordEntryBulkResponse is not None

    def test_schemas_in_all_export(self):
        """Test schemas are in __all__ export list."""
        from src.schemas import __all__ as exported

        assert "WordEntryBulkCreate" in exported
        assert "WordEntryBulkRequest" in exported
        assert "WordEntryBulkResponse" in exported


# ============================================================================
# Test Field Descriptions
# ============================================================================


class TestBulkSchemaFieldDescriptions:
    """Test that all fields have proper descriptions."""

    def test_bulk_create_field_descriptions(self):
        """Test WordEntryBulkCreate fields have descriptions."""
        fields = WordEntryBulkCreate.model_fields
        assert fields["lemma"].description is not None
        assert fields["part_of_speech"].description is not None
        assert fields["translation_en"].description is not None
        assert fields["translation_ru"].description is not None
        assert fields["pronunciation"].description is not None
        assert fields["grammar_data"].description is not None
        assert fields["examples"].description is not None

    def test_bulk_request_field_descriptions(self):
        """Test WordEntryBulkRequest fields have descriptions."""
        fields = WordEntryBulkRequest.model_fields
        assert fields["deck_id"].description is not None
        assert fields["word_entries"].description is not None
        assert "1-100" in fields["word_entries"].description

    def test_bulk_response_field_descriptions(self):
        """Test WordEntryBulkResponse fields have descriptions."""
        fields = WordEntryBulkResponse.model_fields
        assert fields["deck_id"].description is not None
        assert fields["created_count"].description is not None
        assert fields["updated_count"].description is not None
        assert fields["cards_created"].description is not None
        assert fields["cards_updated"].description is not None
        assert fields["word_entries"].description is not None
