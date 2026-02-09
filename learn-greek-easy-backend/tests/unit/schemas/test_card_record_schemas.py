"""Unit tests for CardRecord schemas validation.

Tests for CardRecord schemas including:
- Context sub-schemas (ExampleContext, ConjugationRow/Table, etc.)
- Front/Back content schemas with discriminated unions
- CardRecord CRUD schemas (Create, Update, Response, ListResponse)
- Cross-validation and edge cases

Tests cover field validation, discriminated union dispatch,
pattern matching, and Greek Unicode handling.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from src.db.models import CardType
from src.schemas.card_record import (
    BackContent,
    CardRecordCreate,
    CardRecordListResponse,
    CardRecordResponse,
    CardRecordUpdate,
    ClozeBack,
    ClozeFront,
    ConjugationBack,
    ConjugationFront,
    ConjugationRow,
    ConjugationTable,
    DeclensionBack,
    DeclensionFront,
    DeclensionRow,
    DeclensionTable,
    ExampleContext,
    FrontContent,
    FullSentence,
    MeaningElToEnBack,
    MeaningElToEnFront,
    MeaningEnToElBack,
    MeaningEnToElFront,
    PluralFormBack,
    PluralFormFront,
    SentenceTranslationBack,
    SentenceTranslationFront,
)

# ============================================================================
# Helpers
# ============================================================================

FRONT_ADAPTER = TypeAdapter(FrontContent)
BACK_ADAPTER = TypeAdapter(BackContent)


def _meaning_el_front(**overrides):
    """Build valid meaning_el_to_en front content dict."""
    data = {
        "card_type": "meaning_el_to_en",
        "prompt": "What does this word mean?",
        "main": "λόγος",
        "badge": "A1",
    }
    data.update(overrides)
    return data


def _meaning_el_back(**overrides):
    """Build valid meaning_el_to_en back content dict."""
    data = {
        "card_type": "meaning_el_to_en",
        "answer": "word, speech",
    }
    data.update(overrides)
    return data


def _conjugation_front(**overrides):
    """Build valid conjugation front content dict."""
    data = {
        "card_type": "conjugation",
        "prompt": "Conjugate",
        "main": "γράφω",
        "badge": "B1",
        "tense": "present",
        "person": "1s",
    }
    data.update(overrides)
    return data


def _conjugation_back(**overrides):
    """Build valid conjugation back content dict."""
    data = {
        "card_type": "conjugation",
        "answer": "γράφω",
        "conjugation_table": {
            "tense": "present",
            "rows": [
                {"person": "1s", "form": "γράφω", "highlight": True},
                {"person": "2s", "form": "γράφεις", "highlight": False},
            ],
        },
    }
    data.update(overrides)
    return data


def _declension_front(**overrides):
    """Build valid declension front content dict."""
    data = {
        "card_type": "declension",
        "prompt": "Decline",
        "main": "λόγος",
        "badge": "B1",
        "case": "genitive",
        "number": "singular",
    }
    data.update(overrides)
    return data


def _declension_back(**overrides):
    """Build valid declension back content dict."""
    data = {
        "card_type": "declension",
        "answer": "λόγου",
        "declension_table": {
            "gender": "masculine",
            "rows": [
                {
                    "case": "nominative",
                    "singular": "λόγος",
                    "plural": "λόγοι",
                    "highlight_singular": False,
                    "highlight_plural": False,
                },
                {
                    "case": "genitive",
                    "singular": "λόγου",
                    "plural": "λόγων",
                    "highlight_singular": True,
                    "highlight_plural": False,
                },
            ],
        },
    }
    data.update(overrides)
    return data


def _cloze_front(**overrides):
    """Build valid cloze front content dict."""
    data = {
        "card_type": "cloze",
        "prompt": "Fill in the blank",
        "main": "Εγώ ___ ελληνικά",
        "badge": "A2",
        "missing_word": "μιλάω",
        "example_index": 0,
    }
    data.update(overrides)
    return data


def _cloze_back(**overrides):
    """Build valid cloze back content dict."""
    data = {
        "card_type": "cloze",
        "answer": "μιλάω",
        "full_sentence": {
            "greek": "Εγώ μιλάω ελληνικά",
            "english": "I speak Greek",
        },
    }
    data.update(overrides)
    return data


def _sentence_front(**overrides):
    """Build valid sentence_translation front content dict."""
    data = {
        "card_type": "sentence_translation",
        "prompt": "Translate this sentence",
        "main": "Καλημέρα σας!",
        "badge": "A1",
        "example_id": "ex_kalimera1",
        "direction": "el_to_target",
    }
    data.update(overrides)
    return data


def _sentence_back(**overrides):
    """Build valid sentence_translation back content dict."""
    data = {
        "card_type": "sentence_translation",
        "answer": "Good morning!",
    }
    data.update(overrides)
    return data


def _meaning_en_front(**overrides):
    """Build valid meaning_en_to_el front content dict."""
    data = {
        "card_type": "meaning_en_to_el",
        "prompt": "How do you say this in Greek?",
        "main": "word",
        "badge": "A1",
    }
    data.update(overrides)
    return data


def _meaning_en_back(**overrides):
    """Build valid meaning_en_to_el back content dict."""
    data = {
        "card_type": "meaning_en_to_el",
        "answer": "λόγος",
    }
    data.update(overrides)
    return data


def _plural_form_front(**overrides):
    """Build valid plural_form front content dict."""
    data = {
        "card_type": "plural_form",
        "prompt": "What is the plural?",
        "main": "ο λόγος",
        "badge": "A2",
    }
    data.update(overrides)
    return data


def _plural_form_back(**overrides):
    """Build valid plural_form back content dict."""
    data = {
        "card_type": "plural_form",
        "answer": "οι λόγοι",
    }
    data.update(overrides)
    return data


# Card type to front/back builder mapping
CARD_TYPE_BUILDERS = {
    CardType.MEANING_EL_TO_EN: (_meaning_el_front, _meaning_el_back),
    CardType.MEANING_EN_TO_EL: (_meaning_en_front, _meaning_en_back),
    CardType.CONJUGATION: (_conjugation_front, _conjugation_back),
    CardType.DECLENSION: (_declension_front, _declension_back),
    CardType.CLOZE: (_cloze_front, _cloze_back),
    CardType.SENTENCE_TRANSLATION: (_sentence_front, _sentence_back),
    CardType.PLURAL_FORM: (_plural_form_front, _plural_form_back),
}


# ============================================================================
# Test CardRecordCreate Valid
# ============================================================================


class TestCardRecordCreateValid:
    """Test valid CardRecordCreate for each of the 7 card types."""

    @pytest.mark.parametrize("card_type", list(CARD_TYPE_BUILDERS.keys()))
    def test_valid_create_for_each_card_type(self, card_type):
        """Test valid creation with proper front/back content per card type."""
        front_builder, back_builder = CARD_TYPE_BUILDERS[card_type]
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=card_type,
            front_content=front_builder(),
            back_content=back_builder(),
        )
        assert record.card_type == card_type
        assert record.is_active is True
        assert record.tier is None

    def test_create_with_tier(self):
        """Test creation with optional tier field."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            tier=2,
            front_content=_meaning_el_front(),
            back_content=_meaning_el_back(),
        )
        assert record.tier == 2

    def test_create_with_is_active_false(self):
        """Test creation with is_active set to False."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.CLOZE,
            front_content=_cloze_front(),
            back_content=_cloze_back(),
            is_active=False,
        )
        assert record.is_active is False

    def test_create_with_string_card_type(self):
        """Test string value coerces to CardType enum."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type="conjugation",
            front_content=_conjugation_front(),
            back_content=_conjugation_back(),
        )
        assert record.card_type == CardType.CONJUGATION

    def test_create_with_optional_front_fields(self):
        """Test creation with optional front content fields (sub, hint)."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            front_content=_meaning_el_front(sub="noun, masculine", hint="Think of logos"),
            back_content=_meaning_el_back(),
        )
        assert record.front_content.sub == "noun, masculine"
        assert record.front_content.hint == "Think of logos"

    def test_create_with_back_context(self):
        """Test creation with optional back content context."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            front_content=_meaning_el_front(),
            back_content=_meaning_el_back(
                context={
                    "label": "Example",
                    "greek": "Ο λόγος είναι σημαντικός",
                    "english": "The word is important",
                }
            ),
        )
        assert record.back_content.context is not None
        assert record.back_content.context.label == "Example"


# ============================================================================
# Test CardRecordCreate Validation Errors
# ============================================================================


class TestCardRecordCreateValidationErrors:
    """Test validation errors for CardRecordCreate."""

    def test_missing_word_entry_id(self):
        """Test that word_entry_id is required."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                deck_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                front_content=_meaning_el_front(),
                back_content=_meaning_el_back(),
            )
        assert "word_entry_id" in str(exc_info.value).lower()

    def test_missing_deck_id(self):
        """Test that deck_id is required."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                front_content=_meaning_el_front(),
                back_content=_meaning_el_back(),
            )
        assert "deck_id" in str(exc_info.value).lower()

    def test_invalid_uuid(self):
        """Test that invalid UUID is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id="not-a-uuid",
                deck_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                front_content=_meaning_el_front(),
                back_content=_meaning_el_back(),
            )
        assert "uuid" in str(exc_info.value).lower()

    def test_invalid_card_type(self):
        """Test that invalid card_type is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id=uuid4(),
                deck_id=uuid4(),
                card_type="invalid_type",
                front_content=_meaning_el_front(),
                back_content=_meaning_el_back(),
            )
        assert "card_type" in str(exc_info.value).lower()

    def test_missing_front_content(self):
        """Test that front_content is required."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id=uuid4(),
                deck_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                back_content=_meaning_el_back(),
            )
        assert "front_content" in str(exc_info.value).lower()

    def test_missing_back_content(self):
        """Test that back_content is required."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id=uuid4(),
                deck_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                front_content=_meaning_el_front(),
            )
        assert "back_content" in str(exc_info.value).lower()

    def test_tier_must_be_ge_1(self):
        """Test that tier must be >= 1."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordCreate(
                word_entry_id=uuid4(),
                deck_id=uuid4(),
                card_type=CardType.MEANING_EL_TO_EN,
                tier=0,
                front_content=_meaning_el_front(),
                back_content=_meaning_el_back(),
            )
        assert "greater than or equal to 1" in str(exc_info.value).lower()


# ============================================================================
# Test CardRecordUpdate
# ============================================================================


class TestCardRecordUpdate:
    """Test CardRecordUpdate schema for partial updates."""

    def test_empty_update_rejected(self):
        """Test that completely empty update is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            CardRecordUpdate()
        assert "at least one field" in str(exc_info.value).lower()

    def test_update_is_active_only(self):
        """Test updating only is_active field."""
        update = CardRecordUpdate(is_active=False)
        assert update.is_active is False
        assert update.card_type is None
        assert update.front_content is None

    def test_update_card_type_only(self):
        """Test updating only card_type field."""
        update = CardRecordUpdate(card_type=CardType.CONJUGATION)
        assert update.card_type == CardType.CONJUGATION

    def test_update_tier_only(self):
        """Test updating only tier field."""
        update = CardRecordUpdate(tier=3)
        assert update.tier == 3

    def test_update_front_content_only(self):
        """Test updating only front_content field."""
        update = CardRecordUpdate(front_content=_meaning_el_front())
        assert update.front_content is not None
        assert update.back_content is None

    def test_update_back_content_only(self):
        """Test updating only back_content field."""
        update = CardRecordUpdate(back_content=_cloze_back())
        assert update.back_content is not None

    def test_update_multiple_fields(self):
        """Test updating multiple fields at once."""
        update = CardRecordUpdate(
            card_type=CardType.MEANING_EL_TO_EN,
            is_active=True,
            tier=2,
        )
        assert update.card_type == CardType.MEANING_EL_TO_EN
        assert update.is_active is True
        assert update.tier == 2

    def test_update_tier_invalid(self):
        """Test that tier=0 is rejected on update."""
        with pytest.raises(ValidationError):
            CardRecordUpdate(tier=0)


# ============================================================================
# Test CardRecordResponse
# ============================================================================


class TestCardRecordResponse:
    """Test CardRecordResponse serialization."""

    def test_valid_response(self):
        """Test valid response with all fields."""
        now = datetime.now()
        response = CardRecordResponse(
            id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            front_content={
                "card_type": "meaning_el_to_en",
                "prompt": "Translate",
                "main": "λόγος",
                "badge": "A1",
            },
            back_content={"card_type": "meaning_el_to_en", "answer": "word"},
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.card_type == CardType.MEANING_EL_TO_EN
        assert response.is_active is True
        assert response.front_content["main"] == "λόγος"

    def test_response_from_attributes(self):
        """Test ConfigDict(from_attributes=True) works with mock ORM object."""

        class MockCardRecord:
            """Mock ORM model for testing from_attributes."""

            id = uuid4()
            word_entry_id = uuid4()
            deck_id = uuid4()
            card_type = CardType.CONJUGATION
            tier = 1
            front_content = {
                "card_type": "conjugation",
                "prompt": "Conjugate",
                "main": "γράφω",
                "badge": "B1",
            }
            back_content = {"card_type": "conjugation", "answer": "γράφω"}
            is_active = True
            created_at = datetime.now()
            updated_at = datetime.now()

        response = CardRecordResponse.model_validate(MockCardRecord())
        assert response.card_type == CardType.CONJUGATION
        assert response.tier == 1
        assert response.front_content["main"] == "γράφω"

    def test_response_serializes_enum(self):
        """Test CardType enum serializes correctly to JSON."""
        now = datetime.now()
        response = CardRecordResponse(
            id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.DECLENSION,
            front_content={},
            back_content={},
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        json_data = response.model_dump(mode="json")
        assert json_data["card_type"] == "declension"

    def test_response_with_null_tier(self):
        """Test response with tier=None."""
        now = datetime.now()
        response = CardRecordResponse(
            id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.CLOZE,
            front_content={},
            back_content={},
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert response.tier is None

    def test_list_response_valid(self):
        """Test CardRecordListResponse with items."""
        now = datetime.now()
        item = CardRecordResponse(
            id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            front_content={},
            back_content={},
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        response = CardRecordListResponse(
            total=1,
            page=1,
            page_size=20,
            items=[item],
        )
        assert response.total == 1
        assert len(response.items) == 1

    def test_list_response_pagination_constraints(self):
        """Test pagination field constraints."""
        with pytest.raises(ValidationError):
            CardRecordListResponse(total=-1, page=1, page_size=20, items=[])
        with pytest.raises(ValidationError):
            CardRecordListResponse(total=0, page=0, page_size=20, items=[])
        with pytest.raises(ValidationError):
            CardRecordListResponse(total=0, page=1, page_size=101, items=[])


# ============================================================================
# Test Discriminated Union Dispatch
# ============================================================================


class TestDiscriminatedUnionDispatch:
    """Test that discriminated unions select the correct schema per card_type."""

    def test_front_meaning_el_to_en(self):
        """Test front union dispatches to MeaningElToEnFront."""
        parsed = FRONT_ADAPTER.validate_python(_meaning_el_front())
        assert isinstance(parsed, MeaningElToEnFront)

    def test_front_meaning_en_to_el(self):
        """Test front union dispatches to MeaningEnToElFront."""
        parsed = FRONT_ADAPTER.validate_python(_meaning_en_front())
        assert isinstance(parsed, MeaningEnToElFront)

    def test_front_conjugation(self):
        """Test front union dispatches to ConjugationFront."""
        parsed = FRONT_ADAPTER.validate_python(_conjugation_front())
        assert isinstance(parsed, ConjugationFront)

    def test_front_declension(self):
        """Test front union dispatches to DeclensionFront."""
        parsed = FRONT_ADAPTER.validate_python(_declension_front())
        assert isinstance(parsed, DeclensionFront)

    def test_front_cloze(self):
        """Test front union dispatches to ClozeFront."""
        parsed = FRONT_ADAPTER.validate_python(_cloze_front())
        assert isinstance(parsed, ClozeFront)

    def test_front_sentence_translation(self):
        """Test front union dispatches to SentenceTranslationFront."""
        parsed = FRONT_ADAPTER.validate_python(_sentence_front())
        assert isinstance(parsed, SentenceTranslationFront)

    def test_back_meaning_el_to_en(self):
        """Test back union dispatches to MeaningElToEnBack."""
        parsed = BACK_ADAPTER.validate_python(_meaning_el_back())
        assert isinstance(parsed, MeaningElToEnBack)

    def test_back_meaning_en_to_el(self):
        """Test back union dispatches to MeaningEnToElBack."""
        parsed = BACK_ADAPTER.validate_python(_meaning_en_back())
        assert isinstance(parsed, MeaningEnToElBack)

    def test_back_conjugation(self):
        """Test back union dispatches to ConjugationBack."""
        parsed = BACK_ADAPTER.validate_python(_conjugation_back())
        assert isinstance(parsed, ConjugationBack)

    def test_back_declension(self):
        """Test back union dispatches to DeclensionBack."""
        parsed = BACK_ADAPTER.validate_python(_declension_back())
        assert isinstance(parsed, DeclensionBack)

    def test_back_cloze(self):
        """Test back union dispatches to ClozeBack."""
        parsed = BACK_ADAPTER.validate_python(_cloze_back())
        assert isinstance(parsed, ClozeBack)

    def test_back_sentence_translation(self):
        """Test back union dispatches to SentenceTranslationBack."""
        parsed = BACK_ADAPTER.validate_python(_sentence_back())
        assert isinstance(parsed, SentenceTranslationBack)

    def test_front_plural_form(self):
        """Test front union dispatches to PluralFormFront."""
        parsed = FRONT_ADAPTER.validate_python(_plural_form_front())
        assert isinstance(parsed, PluralFormFront)

    def test_back_plural_form(self):
        """Test back union dispatches to PluralFormBack."""
        parsed = BACK_ADAPTER.validate_python(_plural_form_back())
        assert isinstance(parsed, PluralFormBack)

    def test_front_invalid_card_type_rejected(self):
        """Test front union rejects unknown card_type."""
        with pytest.raises(ValidationError):
            FRONT_ADAPTER.validate_python(
                {"card_type": "unknown", "prompt": "X", "main": "X", "badge": "X"}
            )

    def test_back_invalid_card_type_rejected(self):
        """Test back union rejects unknown card_type."""
        with pytest.raises(ValidationError):
            BACK_ADAPTER.validate_python({"card_type": "unknown", "answer": "X"})


# ============================================================================
# Test Front Content Validation
# ============================================================================


class TestFrontContentValidation:
    """Test per-type field validation for front content schemas."""

    def test_conjugation_person_valid_patterns(self):
        """Test valid person patterns for ConjugationFront."""
        valid_persons = ["1s", "2s", "3s", "1p", "2p", "3p"]
        for person in valid_persons:
            front = ConjugationFront(
                card_type="conjugation",
                prompt="Conjugate",
                main="γράφω",
                badge="B1",
                tense="present",
                person=person,
            )
            assert front.person == person

    def test_conjugation_person_invalid_patterns(self):
        """Test invalid person patterns are rejected."""
        invalid_persons = ["4s", "1x", "0p", "s1", "12", "abc", ""]
        for person in invalid_persons:
            with pytest.raises(ValidationError):
                ConjugationFront(
                    card_type="conjugation",
                    prompt="Conjugate",
                    main="γράφω",
                    badge="B1",
                    tense="present",
                    person=person,
                )

    def test_conjugation_missing_tense(self):
        """Test ConjugationFront requires tense."""
        with pytest.raises(ValidationError) as exc_info:
            ConjugationFront(
                card_type="conjugation",
                prompt="Conjugate",
                main="γράφω",
                badge="B1",
                person="1s",
            )
        assert "tense" in str(exc_info.value).lower()

    def test_declension_number_valid(self):
        """Test DeclensionFront accepts valid number values."""
        for number in ["singular", "plural"]:
            front = DeclensionFront(
                card_type="declension",
                prompt="Decline",
                main="λόγος",
                badge="B1",
                case="genitive",
                number=number,
            )
            assert front.number == number

    def test_declension_number_invalid(self):
        """Test DeclensionFront rejects invalid number values."""
        with pytest.raises(ValidationError):
            DeclensionFront(
                card_type="declension",
                prompt="Decline",
                main="λόγος",
                badge="B1",
                case="genitive",
                number="dual",
            )

    def test_cloze_example_index_ge_0(self):
        """Test ClozeFront requires example_index >= 0."""
        with pytest.raises(ValidationError) as exc_info:
            ClozeFront(
                card_type="cloze",
                prompt="Fill in",
                main="Test ___",
                badge="A2",
                missing_word="word",
                example_index=-1,
            )
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_sentence_translation_example_id_required(self):
        """Test SentenceTranslationFront requires example_id."""
        with pytest.raises(ValidationError) as exc_info:
            SentenceTranslationFront(
                card_type="sentence_translation",
                prompt="Translate",
                main="Test",
                badge="A1",
                direction="el_to_target",
            )
        assert "example_id" in str(exc_info.value).lower()

    def test_sentence_translation_example_id_pattern(self):
        """Test SentenceTranslationFront example_id rejects invalid patterns."""
        invalid_ids = ["has spaces", "has-dashes", "", "has@special"]
        for invalid_id in invalid_ids:
            with pytest.raises(ValidationError) as exc_info:
                SentenceTranslationFront(
                    card_type="sentence_translation",
                    prompt="Translate",
                    main="Test",
                    badge="A1",
                    example_id=invalid_id,
                    direction="el_to_target",
                )
            assert (
                "example_id" in str(exc_info.value).lower()
                or "string does not match pattern" in str(exc_info.value).lower()
            )

    def test_sentence_translation_direction_valid_values(self):
        """Test SentenceTranslationFront accepts both direction values."""
        for direction in ["el_to_target", "target_to_el"]:
            front = SentenceTranslationFront(
                card_type="sentence_translation",
                prompt="Translate",
                main="Test",
                badge="A1",
                example_id="ex_test1",
                direction=direction,
            )
            assert front.direction == direction

    def test_sentence_translation_direction_invalid(self):
        """Test SentenceTranslationFront rejects invalid direction."""
        with pytest.raises(ValidationError) as exc_info:
            SentenceTranslationFront(
                card_type="sentence_translation",
                prompt="Translate",
                main="Test",
                badge="A1",
                example_id="ex_test1",
                direction="invalid_dir",
            )
        assert (
            "direction" in str(exc_info.value).lower()
            or "input should be" in str(exc_info.value).lower()
        )

    def test_sentence_translation_back_answer_ru_optional(self):
        """Test SentenceTranslationBack works with and without answer_ru."""
        # Without answer_ru
        back1 = SentenceTranslationBack(
            card_type="sentence_translation",
            answer="Good morning!",
        )
        assert back1.answer_ru is None

        # With answer_ru
        back2 = SentenceTranslationBack(
            card_type="sentence_translation",
            answer="Good morning!",
            answer_ru="Доброе утро!",
        )
        assert back2.answer_ru == "Доброе утро!"

    def test_front_base_requires_prompt(self):
        """Test that prompt is required on front content."""
        with pytest.raises(ValidationError) as exc_info:
            MeaningElToEnFront(
                card_type="meaning_el_to_en",
                main="λόγος",
                badge="A1",
            )
        assert "prompt" in str(exc_info.value).lower()

    def test_front_base_requires_main(self):
        """Test that main is required on front content."""
        with pytest.raises(ValidationError) as exc_info:
            MeaningElToEnFront(
                card_type="meaning_el_to_en",
                prompt="Translate",
                badge="A1",
            )
        assert "main" in str(exc_info.value).lower()

    def test_front_base_requires_badge(self):
        """Test that badge is required on front content."""
        with pytest.raises(ValidationError) as exc_info:
            MeaningElToEnFront(
                card_type="meaning_el_to_en",
                prompt="Translate",
                main="λόγος",
            )
        assert "badge" in str(exc_info.value).lower()

    def test_plural_form_front_sub_defaults_none(self):
        """Test PluralFormFront has sub=None by default (no pronunciation)."""
        front = PluralFormFront(
            card_type="plural_form",
            prompt="What is the plural?",
            main="ο λόγος",
            badge="A2",
        )
        assert front.sub is None


# ============================================================================
# Test Back Content Validation
# ============================================================================


class TestBackContentValidation:
    """Test per-type field validation for back content schemas."""

    def test_back_base_requires_answer(self):
        """Test that answer is required on back content."""
        with pytest.raises(ValidationError) as exc_info:
            MeaningElToEnBack(card_type="meaning_el_to_en")
        assert "answer" in str(exc_info.value).lower()

    def test_back_answer_sub_optional(self):
        """Test that answer_sub is optional."""
        back = MeaningElToEnBack(
            card_type="meaning_el_to_en",
            answer="word",
            answer_sub="noun, masculine",
        )
        assert back.answer_sub == "noun, masculine"

    def test_conjugation_back_requires_table(self):
        """Test ConjugationBack requires conjugation_table."""
        with pytest.raises(ValidationError) as exc_info:
            ConjugationBack(card_type="conjugation", answer="γράφω")
        assert "conjugation_table" in str(exc_info.value).lower()

    def test_declension_back_requires_table(self):
        """Test DeclensionBack requires declension_table."""
        with pytest.raises(ValidationError) as exc_info:
            DeclensionBack(card_type="declension", answer="λόγου")
        assert "declension_table" in str(exc_info.value).lower()

    def test_cloze_back_requires_full_sentence(self):
        """Test ClozeBack requires full_sentence."""
        with pytest.raises(ValidationError) as exc_info:
            ClozeBack(card_type="cloze", answer="μιλάω")
        assert "full_sentence" in str(exc_info.value).lower()

    def test_meaning_back_context_optional(self):
        """Test context is optional on meaning back schemas."""
        back = MeaningElToEnBack(card_type="meaning_el_to_en", answer="word")
        assert back.context is None

    def test_meaning_back_context_with_tense(self):
        """Test ExampleContext with optional tense field."""
        back = MeaningElToEnBack(
            card_type="meaning_el_to_en",
            answer="I write",
            context=ExampleContext(
                label="Present tense",
                greek="Εγώ γράφω",
                english="I write",
                tense="present",
            ),
        )
        assert back.context.tense == "present"

    def test_conjugation_table_structure(self):
        """Test ConjugationTable validates row structure."""
        table = ConjugationTable(
            tense="present",
            rows=[
                ConjugationRow(person="1s", form="γράφω", highlight=True),
                ConjugationRow(person="2s", form="γράφεις", highlight=False),
            ],
        )
        assert len(table.rows) == 2
        assert table.rows[0].highlight is True

    def test_declension_table_structure(self):
        """Test DeclensionTable validates row structure."""
        table = DeclensionTable(
            gender="masculine",
            rows=[
                DeclensionRow(
                    case="nominative",
                    singular="λόγος",
                    plural="λόγοι",
                    highlight_singular=False,
                    highlight_plural=False,
                ),
            ],
        )
        assert len(table.rows) == 1
        assert table.gender == "masculine"

    def test_full_sentence_requires_both_fields(self):
        """Test FullSentence requires both greek and english."""
        with pytest.raises(ValidationError):
            FullSentence(greek="Γεια σου")
        with pytest.raises(ValidationError):
            FullSentence(english="Hello")

    def test_sentence_translation_back_context_optional(self):
        """Test SentenceTranslationBack context is optional."""
        back = SentenceTranslationBack(
            card_type="sentence_translation",
            answer="Good morning!",
        )
        assert back.context is None

    def test_plural_form_back_has_no_context(self):
        """Test PluralFormBack has no context field."""
        back = PluralFormBack(
            card_type="plural_form",
            answer="οι λόγοι",
        )
        assert not hasattr(back, "context") or "context" not in back.model_fields


# ============================================================================
# Test Cross-Validation
# ============================================================================


class TestCrossValidation:
    """Test mismatched card_type in outer vs content schemas."""

    def test_mismatched_front_card_type(self):
        """Test that front content card_type mismatch is caught by discriminator."""
        # The discriminated union will parse based on the inner card_type.
        # If outer says conjugation but front says meaning_el_to_en,
        # the front will parse as MeaningElToEnFront (no conjugation fields).
        # This is valid at the schema level - cross-type validation is business logic.
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.CONJUGATION,
            front_content=_meaning_el_front(),  # type says meaning_el_to_en
            back_content=_conjugation_back(),
        )
        # The front_content is parsed based on its own card_type discriminator
        assert isinstance(record.front_content, MeaningElToEnFront)
        # The outer card_type is different
        assert record.card_type == CardType.CONJUGATION

    def test_mismatched_back_card_type(self):
        """Test that back content card_type mismatch is parsed by discriminator."""
        record = CardRecordCreate(
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            card_type=CardType.MEANING_EL_TO_EN,
            front_content=_meaning_el_front(),
            back_content=_cloze_back(),  # type says cloze
        )
        assert isinstance(record.back_content, ClozeBack)
        assert record.card_type == CardType.MEANING_EL_TO_EN

    def test_front_missing_discriminator(self):
        """Test that front content without card_type is rejected."""
        with pytest.raises(ValidationError):
            FRONT_ADAPTER.validate_python({"prompt": "Translate", "main": "λόγος", "badge": "A1"})

    def test_back_missing_discriminator(self):
        """Test that back content without card_type is rejected."""
        with pytest.raises(ValidationError):
            BACK_ADAPTER.validate_python({"answer": "word"})


# ============================================================================
# Test Edge Cases
# ============================================================================


class TestEdgeCases:
    """Test edge cases including Greek Unicode, empty strings, and long content."""

    def test_greek_unicode_in_front(self):
        """Test Greek Unicode characters are preserved in front content."""
        front = MeaningElToEnFront(
            card_type="meaning_el_to_en",
            prompt="Τι σημαίνει αυτή η λέξη;",
            main="Ελληνικά",
            sub="ουσιαστικό",
            badge="Α1",
            hint="Σκεφτείτε τη γλώσσα",
        )
        assert front.prompt == "Τι σημαίνει αυτή η λέξη;"
        assert front.main == "Ελληνικά"

    def test_greek_unicode_in_back(self):
        """Test Greek Unicode characters are preserved in back content."""
        back = MeaningElToEnBack(
            card_type="meaning_el_to_en",
            answer="Ελληνικά",
            answer_sub="ουσιαστικό, ουδέτερο, πληθυντικός",
            context=ExampleContext(
                label="Παράδειγμα",
                greek="Μιλάω Ελληνικά",
                english="I speak Greek",
            ),
        )
        assert back.answer == "Ελληνικά"
        assert back.context.label == "Παράδειγμα"

    def test_greek_accented_characters(self):
        """Test Greek accented characters (polytonic) are preserved."""
        front = MeaningElToEnFront(
            card_type="meaning_el_to_en",
            prompt="Μετάφρασε",
            main="ἄνθρωπος",  # polytonic Greek
            badge="C1",
        )
        assert front.main == "ἄνθρωπος"

    def test_empty_string_fields(self):
        """Test that empty strings are accepted for required str fields."""
        # Pydantic BaseModel allows empty strings by default (no min_length constraint)
        front = MeaningElToEnFront(
            card_type="meaning_el_to_en",
            prompt="",
            main="",
            badge="",
        )
        assert front.prompt == ""

    def test_long_content_accepted(self):
        """Test that long content strings are accepted."""
        long_text = "α" * 10000
        front = MeaningElToEnFront(
            card_type="meaning_el_to_en",
            prompt=long_text,
            main=long_text,
            badge="A1",
        )
        assert len(front.prompt) == 10000

    def test_whitespace_only_strings(self):
        """Test that whitespace-only strings are accepted (no strip validators)."""
        front = MeaningElToEnFront(
            card_type="meaning_el_to_en",
            prompt="   ",
            main="   ",
            badge="   ",
        )
        assert front.prompt == "   "

    def test_example_context_tense_optional(self):
        """Test ExampleContext with and without tense."""
        with_tense = ExampleContext(
            label="Example",
            greek="Γράφω",
            english="I write",
            tense="present",
        )
        assert with_tense.tense == "present"

        without_tense = ExampleContext(
            label="Example",
            greek="Γράφω",
            english="I write",
        )
        assert without_tense.tense is None

    def test_conjugation_table_empty_rows(self):
        """Test ConjugationTable accepts empty rows list."""
        table = ConjugationTable(tense="present", rows=[])
        assert len(table.rows) == 0

    def test_declension_table_empty_rows(self):
        """Test DeclensionTable accepts empty rows list."""
        table = DeclensionTable(gender="masculine", rows=[])
        assert len(table.rows) == 0

    def test_create_response_roundtrip(self):
        """Test creating a record and representing it as a response."""
        word_entry_id = uuid4()
        deck_id = uuid4()
        create = CardRecordCreate(
            word_entry_id=word_entry_id,
            deck_id=deck_id,
            card_type=CardType.CLOZE,
            front_content=_cloze_front(),
            back_content=_cloze_back(),
        )
        # Simulate what the API would return
        now = datetime.now()
        response = CardRecordResponse(
            id=uuid4(),
            word_entry_id=create.word_entry_id,
            deck_id=create.deck_id,
            card_type=create.card_type,
            front_content=create.front_content.model_dump(),
            back_content=create.back_content.model_dump(),
            is_active=create.is_active,
            created_at=now,
            updated_at=now,
        )
        assert response.word_entry_id == word_entry_id
        assert response.front_content["missing_word"] == "μιλάω"
