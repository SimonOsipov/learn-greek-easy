"""Unit tests for WordEntry schemas validation.

Tests for WordEntry schemas including:
- ExampleSentence: Structured example with multilingual support
- GrammarData: Flexible grammar container with extra="allow"
- WordEntryBase/Create/Update: CRUD operation schemas
- WordEntryResponse: API response serialization
- WordEntryListResponse/SearchResponse: Paginated responses

Tests cover field validation, enum coercion, whitespace stripping,
and error messages.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import DeckLevel, PartOfSpeech
from src.schemas.word_entry import (
    ExampleSentence,
    GrammarData,
    WordEntryBase,
    WordEntryCreate,
    WordEntryListResponse,
    WordEntryResponse,
    WordEntrySearchResponse,
    WordEntryUpdate,
)

# ============================================================================
# Test ExampleSentence Schema
# ============================================================================


class TestExampleSentence:
    """Test ExampleSentence schema validation."""

    def test_valid_example_with_all_fields(self):
        """Test valid example sentence with all fields provided."""
        example = ExampleSentence(
            greek="Καλημέρα σας!",
            english="Good morning!",
            russian="Доброе утро!",
            context="formal greeting",
        )
        assert example.greek == "Καλημέρα σας!"
        assert example.english == "Good morning!"
        assert example.russian == "Доброе утро!"
        assert example.context == "formal greeting"

    def test_valid_example_greek_only(self):
        """Test example with only required greek field."""
        example = ExampleSentence(greek="Γεια σου!")
        assert example.greek == "Γεια σου!"
        assert example.english == ""
        assert example.russian == ""
        assert example.context is None

    def test_english_and_russian_default_to_empty_string(self):
        """Test that english and russian default to empty string."""
        example = ExampleSentence(greek="Τι κάνεις;")
        assert example.english == ""
        assert example.russian == ""

    def test_context_optional(self):
        """Test context field is optional and defaults to None."""
        example = ExampleSentence(greek="Ευχαριστώ")
        assert example.context is None

    def test_context_max_length(self):
        """Test context max length of 200 characters."""
        # Valid at boundary
        example = ExampleSentence(greek="Test", context="a" * 200)
        assert len(example.context) == 200

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            ExampleSentence(greek="Test", context="a" * 201)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_greek_required(self):
        """Test that greek field is required."""
        with pytest.raises(ValidationError) as exc_info:
            ExampleSentence(english="Hello")
        assert "greek" in str(exc_info.value).lower()

    def test_empty_greek_rejected(self):
        """Test that empty greek string is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ExampleSentence(greek="")
        assert "string_too_short" in str(exc_info.value).lower()

    def test_greek_max_length(self):
        """Test greek max length of 1000 characters."""
        # Valid at boundary
        example = ExampleSentence(greek="α" * 1000)
        assert len(example.greek) == 1000

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            ExampleSentence(greek="α" * 1001)
        assert "string_too_long" in str(exc_info.value).lower()


# ============================================================================
# Test GrammarData Schema
# ============================================================================


class TestGrammarData:
    """Test GrammarData schema validation with extra=allow."""

    def test_empty_grammar_data_valid(self):
        """Test empty GrammarData is valid."""
        grammar = GrammarData()
        assert grammar.gender is None
        assert grammar.voice is None

    def test_extra_fields_allowed(self):
        """Test arbitrary fields are accepted (extra=allow)."""
        grammar = GrammarData(
            nominative_singular="ο λόγος",
            genitive_singular="του λόγου",
            custom_field="some value",
        )
        assert grammar.model_extra["nominative_singular"] == "ο λόγος"
        assert grammar.model_extra["genitive_singular"] == "του λόγου"
        assert grammar.model_extra["custom_field"] == "some value"

    def test_gender_valid_values(self):
        """Test gender accepts valid values."""
        for gender in ["masculine", "feminine", "neuter"]:
            grammar = GrammarData(gender=gender)
            assert grammar.gender == gender

    def test_gender_invalid_rejected(self):
        """Test invalid gender value is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            GrammarData(gender="unknown")
        assert "gender" in str(exc_info.value).lower()

    def test_voice_valid_values(self):
        """Test voice accepts valid values."""
        for voice in ["active", "passive"]:
            grammar = GrammarData(voice=voice)
            assert grammar.voice == voice

    def test_voice_invalid_rejected(self):
        """Test invalid voice value is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            GrammarData(voice="reflexive")
        assert "voice" in str(exc_info.value).lower()

    def test_comparative_max_length(self):
        """Test comparative max length of 255 characters."""
        # Valid at boundary
        grammar = GrammarData(comparative="α" * 255)
        assert len(grammar.comparative) == 255

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            GrammarData(comparative="α" * 256)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_superlative_max_length(self):
        """Test superlative max length of 255 characters."""
        # Valid at boundary
        grammar = GrammarData(superlative="α" * 255)
        assert len(grammar.superlative) == 255

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            GrammarData(superlative="α" * 256)
        assert "string_too_long" in str(exc_info.value).lower()


# ============================================================================
# Test WordEntryBase Schema
# ============================================================================


class TestWordEntryBase:
    """Test WordEntryBase schema validation."""

    def test_valid_word_entry_base(self):
        """Test valid base with all required fields."""
        entry = WordEntryBase(
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word, speech",
        )
        assert entry.lemma == "λόγος"
        assert entry.part_of_speech == PartOfSpeech.NOUN
        assert entry.translation_en == "word, speech"

    def test_lemma_whitespace_stripping(self):
        """Test lemma field strips leading/trailing whitespace."""
        entry = WordEntryBase(
            lemma="  λόγος  ",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
        )
        assert entry.lemma == "λόγος"

    def test_lemma_empty_after_strip_rejected(self):
        """Test empty lemma after stripping is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBase(
                lemma="   ",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="word",
            )
        assert "lemma cannot be empty" in str(exc_info.value).lower()

    def test_lemma_max_length(self):
        """Test lemma max length of 100 characters."""
        # Valid at boundary
        entry = WordEntryBase(
            lemma="α" * 100,
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert len(entry.lemma) == 100

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBase(
                lemma="α" * 101,
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_part_of_speech_required(self):
        """Test that part_of_speech is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBase(lemma="λόγος", translation_en="word")
        assert "part_of_speech" in str(exc_info.value).lower()

    def test_translation_en_required(self):
        """Test that translation_en is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBase(lemma="λόγος", part_of_speech=PartOfSpeech.NOUN)
        assert "translation_en" in str(exc_info.value).lower()

    def test_translation_en_max_length(self):
        """Test translation_en max length of 500 characters."""
        # Valid at boundary
        entry = WordEntryBase(
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="a" * 500,
        )
        assert len(entry.translation_en) == 500

        # Over boundary rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryBase(
                lemma="test",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="a" * 501,
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_translation_ru_whitespace_stripping(self):
        """Test translation_ru strips whitespace."""
        entry = WordEntryBase(
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            translation_ru="  слово  ",
        )
        assert entry.translation_ru == "слово"

    def test_translation_ru_empty_becomes_none(self):
        """Test translation_ru empty string becomes None."""
        entry = WordEntryBase(
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            translation_ru="   ",
        )
        assert entry.translation_ru is None

    def test_cefr_level_optional(self):
        """Test cefr_level is optional and defaults to None."""
        entry = WordEntryBase(
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
        )
        assert entry.cefr_level is None

    def test_is_active_defaults_to_true(self):
        """Test is_active defaults to True."""
        entry = WordEntryBase(
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
        )
        assert entry.is_active is True


# ============================================================================
# Test WordEntryCreate Schema
# ============================================================================


class TestWordEntryCreate:
    """Test WordEntryCreate schema validation."""

    def test_valid_create_minimal(self):
        """Test create with only required fields."""
        deck_id = uuid4()
        entry = WordEntryCreate(
            deck_id=deck_id,
            lemma="γράφω",
            part_of_speech=PartOfSpeech.VERB,
            translation_en="to write",
        )
        assert entry.deck_id == deck_id
        assert entry.lemma == "γράφω"
        assert entry.part_of_speech == PartOfSpeech.VERB

    def test_valid_create_full(self):
        """Test create with all optional fields."""
        deck_id = uuid4()
        entry = WordEntryCreate(
            deck_id=deck_id,
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="good, beautiful",
            translation_ru="хороший, красивый",
            cefr_level=DeckLevel.A2,
            pronunciation="/ka'los/",
            grammar_data=GrammarData(
                masculine_nom_sg="καλός",
                feminine_nom_sg="καλή",
            ),
            examples=[
                ExampleSentence(
                    greek="Είναι καλός άνθρωπος.",
                    english="He is a good person.",
                )
            ],
            audio_key="audio/kalos.mp3",
            is_active=True,
        )
        assert entry.cefr_level == DeckLevel.A2
        assert entry.pronunciation == "/ka'los/"
        assert entry.grammar_data is not None
        assert len(entry.examples) == 1

    def test_deck_id_required(self):
        """Test that deck_id is required for create."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                lemma="λόγος",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="word",
            )
        assert "deck_id" in str(exc_info.value).lower()

    def test_deck_id_must_be_uuid(self):
        """Test that deck_id must be a valid UUID."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                deck_id="not-a-uuid",
                lemma="λόγος",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="word",
            )
        assert "uuid" in str(exc_info.value).lower()

    def test_inherits_base_validators(self):
        """Test that create inherits base validators (lemma stripping)."""
        entry = WordEntryCreate(
            deck_id=uuid4(),
            lemma="  λόγος  ",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
        )
        assert entry.lemma == "λόγος"

    def test_missing_lemma_rejected(self):
        """Test that missing lemma field is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                deck_id=uuid4(),
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="word",
            )
        assert "lemma" in str(exc_info.value).lower()

    def test_all_part_of_speech_values(self):
        """Test all valid PartOfSpeech enum values are accepted."""
        all_pos = [
            PartOfSpeech.NOUN,
            PartOfSpeech.VERB,
            PartOfSpeech.ADJECTIVE,
            PartOfSpeech.ADVERB,
            PartOfSpeech.PHRASE,
        ]
        deck_id = uuid4()
        for pos in all_pos:
            entry = WordEntryCreate(
                deck_id=deck_id,
                lemma=f"test_{pos.value}",
                part_of_speech=pos,
                translation_en="test",
            )
            assert entry.part_of_speech == pos

    def test_part_of_speech_string_coercion(self):
        """Test string value coerces to PartOfSpeech enum."""
        entry = WordEntryCreate(
            deck_id=uuid4(),
            lemma="λόγος",
            part_of_speech="noun",
            translation_en="word",
        )
        assert entry.part_of_speech == PartOfSpeech.NOUN


# ============================================================================
# Test WordEntryUpdate Schema
# ============================================================================


class TestWordEntryUpdate:
    """Test WordEntryUpdate schema validation for partial updates."""

    def test_all_fields_optional(self):
        """Test that all fields are optional for partial update."""
        # But empty update should be rejected
        with pytest.raises(ValidationError) as exc_info:
            WordEntryUpdate()
        assert "at least one field" in str(exc_info.value).lower()

    def test_update_lemma_only(self):
        """Test updating only lemma field."""
        update = WordEntryUpdate(lemma="νέος λόγος")
        assert update.lemma == "νέος λόγος"
        assert update.part_of_speech is None
        assert update.translation_en is None

    def test_update_part_of_speech_only(self):
        """Test updating only part_of_speech field."""
        update = WordEntryUpdate(part_of_speech=PartOfSpeech.VERB)
        assert update.part_of_speech == PartOfSpeech.VERB
        assert update.lemma is None

    def test_update_single_field_is_active(self):
        """Test updating only is_active field."""
        update = WordEntryUpdate(is_active=False)
        assert update.is_active is False
        assert update.lemma is None

    def test_update_empty_lemma_rejected(self):
        """Test that empty lemma (after strip) is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryUpdate(lemma="   ")
        assert "lemma cannot be empty" in str(exc_info.value).lower()

    def test_update_lemma_whitespace_stripping(self):
        """Test lemma stripping works on update."""
        update = WordEntryUpdate(lemma="  ενημερωμένος  ")
        assert update.lemma == "ενημερωμένος"

    def test_update_all_fields(self):
        """Test updating all fields at once."""
        update = WordEntryUpdate(
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            cefr_level=DeckLevel.B1,
            translation_en="good",
            translation_ru="хороший",
            pronunciation="/ka'los/",
            grammar_data=GrammarData(gender="masculine"),
            examples=[ExampleSentence(greek="Καλή μέρα")],
            audio_key="audio/kalos.mp3",
            is_active=True,
        )
        assert update.lemma == "καλός"
        assert update.part_of_speech == PartOfSpeech.ADJECTIVE
        assert update.cefr_level == DeckLevel.B1
        assert update.is_active is True

    def test_empty_update_rejected(self):
        """Test that completely empty update is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryUpdate()
        assert "at least one field" in str(exc_info.value).lower()

    def test_update_cefr_level(self):
        """Test updating cefr_level field."""
        update = WordEntryUpdate(cefr_level=DeckLevel.C1)
        assert update.cefr_level == DeckLevel.C1

    def test_all_deck_levels_valid(self):
        """Test all DeckLevel values are valid for update."""
        all_levels = [
            DeckLevel.A1,
            DeckLevel.A2,
            DeckLevel.B1,
            DeckLevel.B2,
            DeckLevel.C1,
            DeckLevel.C2,
        ]
        for level in all_levels:
            update = WordEntryUpdate(cefr_level=level)
            assert update.cefr_level == level


# ============================================================================
# Test WordEntryResponse Schema
# ============================================================================


class TestWordEntryResponse:
    """Test WordEntryResponse schema validation."""

    def test_valid_response(self):
        """Test valid response with all fields."""
        now = datetime.now()
        response = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.lemma == "λόγος"
        assert response.is_active is True

    def test_response_from_model_attributes(self):
        """Test ConfigDict(from_attributes=True) works with mock ORM object."""

        class MockWordEntry:
            """Mock ORM model for testing from_attributes."""

            id = uuid4()
            deck_id = uuid4()
            lemma = "γράφω"
            part_of_speech = PartOfSpeech.VERB
            cefr_level = DeckLevel.B1
            translation_en = "to write"
            translation_ru = "писать"
            pronunciation = None
            grammar_data = None
            examples = None
            audio_key = None
            is_active = True
            created_at = datetime.now()
            updated_at = datetime.now()

        response = WordEntryResponse.model_validate(MockWordEntry())
        assert response.lemma == "γράφω"
        assert response.part_of_speech == PartOfSpeech.VERB
        assert response.cefr_level == DeckLevel.B1

    def test_response_serializes_datetime(self):
        """Test created_at/updated_at serialize correctly."""
        now = datetime(2024, 1, 15, 10, 30, 0)
        response = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.created_at == now
        assert response.updated_at == now

    def test_response_serializes_uuid(self):
        """Test UUID fields serialize correctly."""
        entry_id = uuid4()
        deck_id = uuid4()
        response = WordEntryResponse(
            id=entry_id,
            deck_id=deck_id,
            lemma="test",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert response.id == entry_id
        assert response.deck_id == deck_id

    def test_response_serializes_enum(self):
        """Test PartOfSpeech enum serializes correctly."""
        response = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="test",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            translation_en="test",
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        # Pydantic model keeps enum as enum in model
        assert response.part_of_speech == PartOfSpeech.ADJECTIVE
        # JSON serialization converts to string value
        json_data = response.model_dump(mode="json")
        assert json_data["part_of_speech"] == "adjective"

    def test_response_includes_all_required_fields(self):
        """Test response includes id, deck_id, created_at, updated_at."""
        now = datetime.now()
        entry_id = uuid4()
        deck_id = uuid4()
        response = WordEntryResponse(
            id=entry_id,
            deck_id=deck_id,
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.id == entry_id
        assert response.deck_id == deck_id
        assert response.created_at == now
        assert response.updated_at == now

    def test_response_with_optional_fields(self):
        """Test response with all optional fields populated."""
        now = datetime.now()
        response = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="καλός",
            part_of_speech=PartOfSpeech.ADJECTIVE,
            cefr_level=DeckLevel.A2,
            translation_en="good",
            translation_ru="хороший",
            pronunciation="/ka'los/",
            grammar_data={"gender": "masculine"},
            examples=[ExampleSentence(greek="Καλή μέρα")],
            audio_key="audio/kalos.mp3",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.cefr_level == DeckLevel.A2
        assert response.translation_ru == "хороший"
        assert response.pronunciation == "/ka'los/"
        assert response.grammar_data == {"gender": "masculine"}
        assert len(response.examples) == 1
        assert response.audio_key == "audio/kalos.mp3"


# ============================================================================
# Test WordEntryListResponse Schema
# ============================================================================


class TestWordEntryListResponse:
    """Test WordEntryListResponse schema validation."""

    def test_valid_list_response(self):
        """Test valid list response."""
        now = datetime.now()
        entry = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        response = WordEntryListResponse(
            total=1,
            page=1,
            page_size=20,
            items=[entry],
        )
        assert response.total == 1
        assert response.page == 1
        assert len(response.items) == 1

    def test_total_ge_zero(self):
        """Test total must be >= 0."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryListResponse(
                total=-1,
                page=1,
                page_size=20,
                items=[],
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_page_ge_one(self):
        """Test page must be >= 1."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryListResponse(
                total=0,
                page=0,
                page_size=20,
                items=[],
            )
        assert "greater than or equal to 1" in str(exc_info.value).lower()

    def test_page_size_ge_one(self):
        """Test page_size must be >= 1."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryListResponse(
                total=0,
                page=1,
                page_size=0,
                items=[],
            )
        assert "greater than or equal to 1" in str(exc_info.value).lower()

    def test_page_size_le_100(self):
        """Test page_size must be <= 100."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryListResponse(
                total=0,
                page=1,
                page_size=101,
                items=[],
            )
        assert "less than or equal to 100" in str(exc_info.value).lower()

    def test_empty_items_valid(self):
        """Test empty items array is valid."""
        response = WordEntryListResponse(
            total=0,
            page=1,
            page_size=20,
            items=[],
        )
        assert len(response.items) == 0


# ============================================================================
# Test WordEntrySearchResponse Schema
# ============================================================================


class TestWordEntrySearchResponse:
    """Test WordEntrySearchResponse schema validation."""

    def test_valid_search_response(self):
        """Test valid search response with query."""
        now = datetime.now()
        entry = WordEntryResponse(
            id=uuid4(),
            deck_id=uuid4(),
            lemma="λόγος",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="word",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        response = WordEntrySearchResponse(
            total=1,
            page=1,
            page_size=20,
            query="λόγος",
            items=[entry],
        )
        assert response.query == "λόγος"
        assert response.part_of_speech_filter is None

    def test_query_required(self):
        """Test query field is required."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntrySearchResponse(
                total=0,
                page=1,
                page_size=20,
                items=[],
            )
        assert "query" in str(exc_info.value).lower()

    def test_part_of_speech_filter_optional(self):
        """Test part_of_speech_filter is optional."""
        response = WordEntrySearchResponse(
            total=0,
            page=1,
            page_size=20,
            query="search",
            items=[],
        )
        assert response.part_of_speech_filter is None

    def test_part_of_speech_filter_accepted(self):
        """Test part_of_speech_filter with valid enum."""
        response = WordEntrySearchResponse(
            total=0,
            page=1,
            page_size=20,
            query="search",
            part_of_speech_filter=PartOfSpeech.VERB,
            items=[],
        )
        assert response.part_of_speech_filter == PartOfSpeech.VERB

    def test_pagination_constraints(self):
        """Test search response inherits pagination constraints."""
        with pytest.raises(ValidationError):
            WordEntrySearchResponse(
                total=-1,  # Invalid
                page=1,
                page_size=20,
                query="test",
                items=[],
            )


# ============================================================================
# Test Field Validators
# ============================================================================


class TestFieldValidators:
    """Test custom field validators and boundary conditions."""

    def test_lemma_exactly_at_max_length(self):
        """Test lemma at exactly 100 chars is accepted."""
        entry = WordEntryCreate(
            deck_id=uuid4(),
            lemma="α" * 100,
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
        )
        assert len(entry.lemma) == 100

    def test_lemma_one_over_max_rejected(self):
        """Test lemma at 101 chars is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                deck_id=uuid4(),
                lemma="α" * 101,
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
            )
        assert "string_too_long" in str(exc_info.value).lower()

    def test_greek_unicode_preserved(self):
        """Test Greek Unicode characters are preserved correctly."""
        entry = WordEntryCreate(
            deck_id=uuid4(),
            lemma="Ελληνικά",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="Greek",
        )
        assert entry.lemma == "Ελληνικά"

    def test_cyrillic_unicode_preserved(self):
        """Test Cyrillic Unicode characters are preserved correctly."""
        entry = WordEntryCreate(
            deck_id=uuid4(),
            lemma="тест",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="test",
            translation_ru="тест",
        )
        assert entry.translation_ru == "тест"

    def test_error_messages_are_clear(self):
        """Test validation errors have user-friendly messages."""
        # Missing required field
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                deck_id=uuid4(),
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
            )
        error_str = str(exc_info.value)
        assert "lemma" in error_str.lower()
        assert "required" in error_str.lower() or "missing" in error_str.lower()

        # Empty lemma
        with pytest.raises(ValidationError) as exc_info:
            WordEntryCreate(
                deck_id=uuid4(),
                lemma="  ",
                part_of_speech=PartOfSpeech.NOUN,
                translation_en="test",
            )
        assert "lemma cannot be empty" in str(exc_info.value).lower()
