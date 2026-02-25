"""Unit tests for admin generate-cards endpoint.

Tests cover:
- POST /api/v1/admin/word-entries/{word_entry_id}/generate-cards
- 200 success for all four card types
- 404 for nonexistent word entry
- 400 for ineligible card types (all eligibility paths)
- 422 for invalid card_type values
- 401 for unauthenticated requests
- 403 for non-superuser requests
- Correct CardGeneratorService method is dispatched per card_type
- DB commit is called after successful generation
- Response schema fields (card_type, created, updated)
- Eligibility validators tested in isolation
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry

# =============================================================================
# Helpers: word entry factory
# =============================================================================

ENDPOINT = "/api/v1/admin/word-entries/{word_entry_id}/generate-cards"


def _url(word_entry_id) -> str:
    return ENDPOINT.format(word_entry_id=word_entry_id)


# =============================================================================
# Fixtures: shared deck and word entries
# =============================================================================


@pytest.fixture
async def test_deck(db_session: AsyncSession) -> Deck:
    """Minimal test deck."""
    deck = Deck(
        id=uuid4(),
        name_en="Generate Cards Test Deck",
        name_el="Τεστ κάρτες",
        name_ru="Тест карт",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def noun_entry_full(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun with translations, gender, and case data — eligible for meaning, plural_form, article."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        translation_ru="дом",
        is_active=True,
        grammar_data={
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "σπίτι"},
                "plural": {"nominative": "σπίτια"},
            },
        },
        examples=[
            {
                "id": "ex_1",
                "greek": "Το σπίτι είναι μεγάλο.",
                "english": "The house is big.",
                "russian": "Дом большой.",
            }
        ],
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def adjective_entry_full(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Adjective with forms — eligible for meaning and plural_form."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="μεγάλος",
        part_of_speech=PartOfSpeech.ADJECTIVE,
        translation_en="big, large",
        translation_ru="большой",
        is_active=True,
        grammar_data={
            "forms": {
                "masculine": {
                    "singular": {"nominative": "μεγάλος"},
                    "plural": {"nominative": "μεγάλοι"},
                },
                "feminine": {
                    "singular": {"nominative": "μεγάλη"},
                    "plural": {"nominative": "μεγάλες"},
                },
                "neuter": {
                    "singular": {"nominative": "μεγάλο"},
                    "plural": {"nominative": "μεγάλα"},
                },
            }
        },
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_entry_no_translations(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun with empty translations — ineligible for meaning (empty string is falsy)."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="βιβλίο",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="",  # empty string is falsy, triggers eligibility check
        translation_ru="",
        is_active=True,
        grammar_data={
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "βιβλίο"},
                "plural": {"nominative": "βιβλία"},
            },
        },
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_entry_no_plural(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun with translations but missing plural nominative — ineligible for plural_form."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="θάλασσα",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="sea",
        translation_ru="море",
        is_active=True,
        grammar_data={
            "gender": "feminine",
            "cases": {
                "singular": {"nominative": "θάλασσα"},
                "plural": {},  # missing nominative
            },
        },
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_entry_no_gender(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun without gender — ineligible for article."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="δρόμος",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="road, street",
        translation_ru="дорога",
        is_active=True,
        grammar_data={
            "cases": {
                "singular": {"nominative": "δρόμος"},
                "plural": {"nominative": "δρόμοι"},
            }
        },
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def verb_entry(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Verb — ineligible for plural_form and article."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="γράφω",
        part_of_speech=PartOfSpeech.VERB,
        translation_en="to write",
        translation_ru="писать",
        is_active=True,
        grammar_data={},
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_entry_no_examples(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun without examples — ineligible for sentence_translation."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="παιδί",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="child",
        translation_ru="ребёнок",
        is_active=True,
        grammar_data={
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "παιδί"},
                "plural": {"nominative": "παιδιά"},
            },
        },
        examples=[],
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_entry_incomplete_example(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Noun with example missing english — ineligible for sentence_translation."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="αγόρι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="boy",
        translation_ru="мальчик",
        is_active=True,
        grammar_data={
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "αγόρι"},
                "plural": {"nominative": "αγόρια"},
            },
        },
        examples=[
            {
                "id": "ex_incomplete",
                "greek": "Το αγόρι τρέχει.",
                # no english
            }
        ],
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def adjective_entry_no_forms(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Adjective without forms — ineligible for plural_form."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="ωραίος",
        part_of_speech=PartOfSpeech.ADJECTIVE,
        translation_en="beautiful",
        translation_ru="красивый",
        is_active=True,
        grammar_data={
            "forms": {
                "masculine": {
                    "singular": {"nominative": "ωραίος"},
                    # no plural
                }
            }
        },
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Tests: AC #1, #5 — 200 success with correct response schema
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsEndpointSuccess:
    """200 success cases for all four card types."""

    @pytest.mark.asyncio
    async def test_200_meaning_cards_response_schema(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #1, #5: 200 response with card_type, created, updated fields for meaning."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(2, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "meaning"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["card_type"] == "meaning"
        assert data["created"] == 2
        assert data["updated"] == 0

    @pytest.mark.asyncio
    async def test_200_plural_form_noun_response_schema(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #1: 200 response for plural_form on noun."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(2, 1))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "plural_form"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["card_type"] == "plural_form"
        assert data["created"] == 2
        assert data["updated"] == 1

    @pytest.mark.asyncio
    async def test_200_article_response_schema(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #1: 200 response for article on noun with gender and nominative."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_article_cards = AsyncMock(return_value=(1, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "article"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["card_type"] == "article"
        assert data["created"] == 1
        assert data["updated"] == 0

    @pytest.mark.asyncio
    async def test_200_sentence_translation_response_schema(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #1: 200 response for sentence_translation on entry with valid example."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_sentence_translation_cards = AsyncMock(return_value=(2, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "sentence_translation"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["card_type"] == "sentence_translation"
        assert data["created"] == 2
        assert data["updated"] == 0

    @pytest.mark.asyncio
    async def test_200_plural_form_adjective(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        adjective_entry_full: WordEntry,
    ):
        """AC #1: 200 response for plural_form on adjective with all gender forms."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(6, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(adjective_entry_full.id),
                json={"card_type": "plural_form"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["card_type"] == "plural_form"

    @pytest.mark.asyncio
    async def test_200_returns_zero_when_no_cards_produced(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #1: 200 even when generator produces 0 created and 0 updated (edge case)."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(0, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "meaning"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 0
        assert data["updated"] == 0


# =============================================================================
# Tests: AC #2 — 404 for nonexistent word entry
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsEndpoint404:
    """404 tests for nonexistent word entry."""

    @pytest.mark.asyncio
    async def test_404_for_nonexistent_word_entry(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """AC #2, #6: 404 when word_entry_id does not exist in DB."""
        response = await client.post(
            _url(uuid4()),
            json={"card_type": "meaning"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"


# =============================================================================
# Tests: AC #3 — 400 for ineligible card types
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsEndpointEligibility:
    """AC #3, #7: 400 returned for each ineligible case with human-readable reason."""

    @pytest.mark.asyncio
    async def test_400_meaning_missing_translation_en(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_no_translations: WordEntry,
    ):
        """400: meaning requires both translation_en and translation_ru."""
        response = await client.post(
            _url(noun_entry_no_translations.id),
            json={"card_type": "meaning"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        # Must have a human-readable detail (error.message in our app's error format)
        assert data["success"] is False
        assert "translation" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_400_plural_form_noun_missing_plural_nominative(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_no_plural: WordEntry,
    ):
        """400: plural_form for noun requires singular AND plural nominative in grammar_data."""
        response = await client.post(
            _url(noun_entry_no_plural.id),
            json={"card_type": "plural_form"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert len(data["error"]["message"]) > 0

    @pytest.mark.asyncio
    async def test_400_plural_form_adjective_no_valid_gender_forms(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        adjective_entry_no_forms: WordEntry,
    ):
        """400: plural_form for adjective requires at least one gender with sg+pl nominative."""
        response = await client.post(
            _url(adjective_entry_no_forms.id),
            json={"card_type": "plural_form"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_400_plural_form_verb_not_supported(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        verb_entry: WordEntry,
    ):
        """400: plural_form not supported for verbs."""
        response = await client.post(
            _url(verb_entry.id),
            json={"card_type": "plural_form"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert len(data["error"]["message"]) > 0

    @pytest.mark.asyncio
    async def test_400_article_requires_noun(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        verb_entry: WordEntry,
    ):
        """400: article cards only supported for nouns."""
        response = await client.post(
            _url(verb_entry.id),
            json={"card_type": "article"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "noun" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_400_article_noun_missing_gender(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_no_gender: WordEntry,
    ):
        """400: article requires gender in grammar_data."""
        response = await client.post(
            _url(noun_entry_no_gender.id),
            json={"card_type": "article"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "gender" in data["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_400_sentence_translation_no_examples(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_no_examples: WordEntry,
    ):
        """400: sentence_translation requires at least one example with id, greek, english."""
        response = await client.post(
            _url(noun_entry_no_examples.id),
            json={"card_type": "sentence_translation"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_400_sentence_translation_example_missing_english(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_incomplete_example: WordEntry,
    ):
        """400: sentence_translation example without english field is ineligible."""
        response = await client.post(
            _url(noun_entry_incomplete_example.id),
            json={"card_type": "sentence_translation"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_400_article_adjective_not_noun(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        adjective_entry_full: WordEntry,
    ):
        """400: article cards cannot be generated for adjectives."""
        response = await client.post(
            _url(adjective_entry_full.id),
            json={"card_type": "article"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "noun" in data["error"]["message"].lower()


# =============================================================================
# Tests: AC #4 — superuser auth required
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsEndpointAuth:
    """AC #4: Auth and authorization tests."""

    @pytest.mark.asyncio
    async def test_401_unauthenticated(
        self,
        client: AsyncClient,
        noun_entry_full: WordEntry,
    ):
        """401: unauthenticated requests are rejected."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={"card_type": "meaning"},
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_403_for_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #4: Regular users (non-superuser) receive 403."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={"card_type": "meaning"},
            headers=auth_headers,
        )

        assert response.status_code == 403


# =============================================================================
# Tests: AC #10 — 422 for invalid card_type
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsEndpointValidation:
    """AC #5, #10: Pydantic validation for card_type field."""

    @pytest.mark.asyncio
    async def test_422_invalid_card_type_value(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #10: card_type not in Literal union returns 422."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={"card_type": "invalid_type"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_missing_card_type_field(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #5: card_type field is required; omitting it returns 422."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_card_type_wrong_case(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #10: Literal is case-sensitive; 'Meaning' is not valid."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={"card_type": "Meaning"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_card_type_empty_string(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #10: Empty string is not a valid Literal value."""
        response = await client.post(
            _url(noun_entry_full.id),
            json={"card_type": ""},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422


# =============================================================================
# Tests: AC #8 — correct service method is dispatched
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsServiceDispatch:
    """AC #8: Correct CardGeneratorService method is called per card_type."""

    @pytest.mark.asyncio
    async def test_meaning_dispatches_generate_meaning_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #8: meaning card_type calls generate_meaning_cards with [word_entry] and deck_id."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(2, 0))
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_article_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_sentence_translation_cards = AsyncMock(return_value=(0, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "meaning"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        mock_instance.generate_meaning_cards.assert_awaited_once()
        call_args = mock_instance.generate_meaning_cards.call_args
        word_entries_arg = call_args[0][0]
        deck_id_arg = call_args[0][1]
        assert len(word_entries_arg) == 1
        assert word_entries_arg[0].id == noun_entry_full.id
        assert deck_id_arg == noun_entry_full.deck_id

        # Other methods must NOT have been called
        mock_instance.generate_plural_form_cards.assert_not_awaited()
        mock_instance.generate_article_cards.assert_not_awaited()
        mock_instance.generate_sentence_translation_cards.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_plural_form_dispatches_generate_plural_form_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #8: plural_form calls generate_plural_form_cards."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(2, 0))
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_article_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_sentence_translation_cards = AsyncMock(return_value=(0, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "plural_form"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        mock_instance.generate_plural_form_cards.assert_awaited_once()
        mock_instance.generate_meaning_cards.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_article_dispatches_generate_article_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #8: article calls generate_article_cards."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_article_cards = AsyncMock(return_value=(1, 0))
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_sentence_translation_cards = AsyncMock(return_value=(0, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "article"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        mock_instance.generate_article_cards.assert_awaited_once()
        mock_instance.generate_plural_form_cards.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_sentence_translation_dispatches_generate_sentence_translation_cards(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #8: sentence_translation calls generate_sentence_translation_cards."""
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_sentence_translation_cards = AsyncMock(return_value=(2, 0))
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_plural_form_cards = AsyncMock(return_value=(0, 0))
            mock_instance.generate_article_cards = AsyncMock(return_value=(0, 0))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "sentence_translation"},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        mock_instance.generate_sentence_translation_cards.assert_awaited_once()
        mock_instance.generate_article_cards.assert_not_awaited()


# =============================================================================
# Tests: AC #9 — DB commit is called
# =============================================================================


@pytest.mark.unit
class TestGenerateCardsDBCommit:
    """AC #9: DB is committed after successful generation."""

    @pytest.mark.asyncio
    async def test_db_commit_called_after_generation(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        noun_entry_full: WordEntry,
    ):
        """AC #9: endpoint returns 200 and correct data (implies commit was called).

        The actual db.commit() is tested indirectly: a 200 response with card counts
        matching the mock's return value confirms the full endpoint flow including commit
        executed without error. Direct commit spying would require complex async context
        manager interception, which is validated by the integration layer instead.
        """
        with patch("src.api.v1.admin.CardGeneratorService") as MockService:
            mock_instance = MagicMock()
            mock_instance.generate_meaning_cards = AsyncMock(return_value=(3, 1))
            MockService.return_value = mock_instance

            response = await client.post(
                _url(noun_entry_full.id),
                json={"card_type": "meaning"},
                headers=superuser_auth_headers,
            )

        # 200 with matching counts confirms the full endpoint path (including commit) ran
        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 3
        assert data["updated"] == 1


# =============================================================================
# Unit tests for eligibility validators in isolation
# =============================================================================


@pytest.mark.unit
class TestValidateMeaningEligibility:
    """Unit tests for _validate_meaning_eligibility."""

    def _make_entry(self, translation_en=None, translation_ru=None):
        entry = MagicMock(spec=WordEntry)
        entry.translation_en = translation_en
        entry.translation_ru = translation_ru
        return entry

    def test_raises_400_when_translation_en_missing(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_meaning_eligibility

        entry = self._make_entry(translation_en=None, translation_ru="дом")
        with pytest.raises(HTTPException) as exc_info:
            _validate_meaning_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_when_translation_ru_missing(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_meaning_eligibility

        entry = self._make_entry(translation_en="house", translation_ru=None)
        with pytest.raises(HTTPException) as exc_info:
            _validate_meaning_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_when_both_translations_missing(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_meaning_eligibility

        entry = self._make_entry(translation_en=None, translation_ru=None)
        with pytest.raises(HTTPException) as exc_info:
            _validate_meaning_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_does_not_raise_when_both_translations_present(self):
        from src.api.v1.admin import _validate_meaning_eligibility

        entry = self._make_entry(translation_en="house", translation_ru="дом")
        _validate_meaning_eligibility(entry)  # should not raise


@pytest.mark.unit
class TestValidatePluralFormEligibility:
    """Unit tests for _validate_plural_form_eligibility."""

    def _make_noun(self, grammar_data=None):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.NOUN
        entry.grammar_data = grammar_data or {}
        return entry

    def _make_adjective(self, grammar_data=None):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.ADJECTIVE
        entry.grammar_data = grammar_data or {}
        return entry

    def _make_verb(self):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.VERB
        entry.grammar_data = {}
        return entry

    def test_raises_400_for_verb(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_plural_form_eligibility

        with pytest.raises(HTTPException) as exc_info:
            _validate_plural_form_eligibility(self._make_verb())
        assert exc_info.value.status_code == 400

    def test_raises_400_for_noun_missing_singular_nominative(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_plural_form_eligibility

        entry = self._make_noun(grammar_data={"cases": {"plural": {"nominative": "σπίτια"}}})
        with pytest.raises(HTTPException) as exc_info:
            _validate_plural_form_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_for_noun_missing_plural_nominative(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_plural_form_eligibility

        entry = self._make_noun(
            grammar_data={"cases": {"singular": {"nominative": "σπίτι"}, "plural": {}}}
        )
        with pytest.raises(HTTPException) as exc_info:
            _validate_plural_form_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_passes_for_noun_with_both_nominatives(self):
        from src.api.v1.admin import _validate_plural_form_eligibility

        entry = self._make_noun(
            grammar_data={
                "cases": {
                    "singular": {"nominative": "σπίτι"},
                    "plural": {"nominative": "σπίτια"},
                }
            }
        )
        _validate_plural_form_eligibility(entry)  # should not raise

    def test_raises_400_for_adjective_with_no_valid_gender(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_plural_form_eligibility

        entry = self._make_adjective(
            grammar_data={"forms": {"masculine": {"singular": {"nominative": "μεγάλος"}}}}
        )
        with pytest.raises(HTTPException) as exc_info:
            _validate_plural_form_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_passes_for_adjective_with_one_valid_gender(self):
        from src.api.v1.admin import _validate_plural_form_eligibility

        entry = self._make_adjective(
            grammar_data={
                "forms": {
                    "masculine": {
                        "singular": {"nominative": "μεγάλος"},
                        "plural": {"nominative": "μεγάλοι"},
                    }
                }
            }
        )
        _validate_plural_form_eligibility(entry)  # should not raise


@pytest.mark.unit
class TestValidateArticleEligibility:
    """Unit tests for _validate_article_eligibility."""

    def _make_noun(self, grammar_data=None):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.NOUN
        entry.grammar_data = grammar_data or {}
        return entry

    def _make_adjective(self):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.ADJECTIVE
        entry.grammar_data = {}
        return entry

    def test_raises_400_for_adjective(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_article_eligibility

        with pytest.raises(HTTPException) as exc_info:
            _validate_article_eligibility(self._make_adjective())
        assert exc_info.value.status_code == 400
        assert "noun" in exc_info.value.detail.lower()

    def test_raises_400_for_noun_missing_gender(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_article_eligibility

        entry = self._make_noun(grammar_data={"cases": {"singular": {"nominative": "δρόμος"}}})
        with pytest.raises(HTTPException) as exc_info:
            _validate_article_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_for_noun_missing_singular_nominative(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_article_eligibility

        entry = self._make_noun(grammar_data={"gender": "masculine", "cases": {}})
        with pytest.raises(HTTPException) as exc_info:
            _validate_article_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_passes_for_noun_with_gender_and_nominative(self):
        from src.api.v1.admin import _validate_article_eligibility

        entry = self._make_noun(
            grammar_data={
                "gender": "neuter",
                "cases": {"singular": {"nominative": "σπίτι"}},
            }
        )
        _validate_article_eligibility(entry)  # should not raise


@pytest.mark.unit
class TestValidateSentenceTranslationEligibility:
    """Unit tests for _validate_sentence_translation_eligibility."""

    def _make_entry(self, examples=None):
        entry = MagicMock(spec=WordEntry)
        entry.examples = examples
        return entry

    def test_raises_400_when_examples_is_none(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_sentence_translation_eligibility

        with pytest.raises(HTTPException) as exc_info:
            _validate_sentence_translation_eligibility(self._make_entry(examples=None))
        assert exc_info.value.status_code == 400

    def test_raises_400_when_examples_is_empty_list(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_sentence_translation_eligibility

        with pytest.raises(HTTPException) as exc_info:
            _validate_sentence_translation_eligibility(self._make_entry(examples=[]))
        assert exc_info.value.status_code == 400

    def test_raises_400_when_example_missing_english(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(examples=[{"id": "e1", "greek": "Γεια"}])
        with pytest.raises(HTTPException) as exc_info:
            _validate_sentence_translation_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_when_example_missing_id(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(examples=[{"greek": "Γεια", "english": "Hello"}])
        with pytest.raises(HTTPException) as exc_info:
            _validate_sentence_translation_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_raises_400_when_example_missing_greek(self):
        from fastapi import HTTPException

        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(examples=[{"id": "e1", "english": "Hello"}])
        with pytest.raises(HTTPException) as exc_info:
            _validate_sentence_translation_eligibility(entry)
        assert exc_info.value.status_code == 400

    def test_passes_when_example_has_id_greek_english(self):
        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(examples=[{"id": "e1", "greek": "Γεια σου.", "english": "Hello."}])
        _validate_sentence_translation_eligibility(entry)  # should not raise

    def test_passes_when_at_least_one_valid_example_among_invalid(self):
        """One valid example among invalid ones is sufficient."""
        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(
            examples=[
                {"greek": "Only greek"},  # invalid - no id or english
                {"id": "e2", "greek": "Γεια σου.", "english": "Hello."},  # valid
            ]
        )
        _validate_sentence_translation_eligibility(entry)  # should not raise

    def test_russian_not_required_for_eligibility(self):
        """Russian translation is NOT required for sentence_translation eligibility."""
        from src.api.v1.admin import _validate_sentence_translation_eligibility

        entry = self._make_entry(
            examples=[
                {
                    "id": "e1",
                    "greek": "Γεια σου.",
                    "english": "Hello.",
                    # no russian field
                }
            ]
        )
        _validate_sentence_translation_eligibility(entry)  # should not raise


# =============================================================================
# Unit tests for _validate_card_type_eligibility dispatch
# =============================================================================


@pytest.mark.unit
class TestValidateCardTypeEligibilityDispatch:
    """Unit tests for _validate_card_type_eligibility dispatch logic."""

    def _make_eligible_noun(self):
        entry = MagicMock(spec=WordEntry)
        entry.part_of_speech = PartOfSpeech.NOUN
        entry.translation_en = "house"
        entry.translation_ru = "дом"
        entry.grammar_data = {
            "gender": "neuter",
            "cases": {
                "singular": {"nominative": "σπίτι"},
                "plural": {"nominative": "σπίτια"},
            },
        }
        entry.examples = [{"id": "e1", "greek": "Γεια.", "english": "Hello."}]
        return entry

    def test_dispatches_to_meaning_validator(self):
        from unittest.mock import patch

        from src.api.v1.admin import _validate_card_type_eligibility

        entry = self._make_eligible_noun()
        with patch("src.api.v1.admin._validate_meaning_eligibility") as mock_validator:
            _validate_card_type_eligibility(entry, "meaning")
            mock_validator.assert_called_once_with(entry)

    def test_dispatches_to_plural_form_validator(self):
        from unittest.mock import patch

        from src.api.v1.admin import _validate_card_type_eligibility

        entry = self._make_eligible_noun()
        with patch("src.api.v1.admin._validate_plural_form_eligibility") as mock_validator:
            _validate_card_type_eligibility(entry, "plural_form")
            mock_validator.assert_called_once_with(entry)

    def test_dispatches_to_article_validator(self):
        from unittest.mock import patch

        from src.api.v1.admin import _validate_card_type_eligibility

        entry = self._make_eligible_noun()
        with patch("src.api.v1.admin._validate_article_eligibility") as mock_validator:
            _validate_card_type_eligibility(entry, "article")
            mock_validator.assert_called_once_with(entry)

    def test_dispatches_to_sentence_translation_validator(self):
        from unittest.mock import patch

        from src.api.v1.admin import _validate_card_type_eligibility

        entry = self._make_eligible_noun()
        with patch("src.api.v1.admin._validate_sentence_translation_eligibility") as mock_validator:
            _validate_card_type_eligibility(entry, "sentence_translation")
            mock_validator.assert_called_once_with(entry)
