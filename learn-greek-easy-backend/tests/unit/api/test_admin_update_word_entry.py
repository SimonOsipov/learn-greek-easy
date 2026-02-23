"""Unit tests for admin word entry inline update endpoint.

Tests cover:
- PATCH /api/v1/admin/word-entries/{word_entry_id} (inline update)
- Schema validation for WordEntryInlineUpdate
- Authentication/authorization (401/403)
- Success cases (200)
- Not found (404)
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, PartOfSpeech, WordEntry
from src.schemas.admin import WordEntryInlineUpdate

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
async def test_deck(db_session: AsyncSession) -> Deck:
    """Create a test deck for word entry tests."""
    deck = Deck(
        id=uuid4(),
        name_en="Test Deck for Inline Edit",
        name_el="Τεστ Κολόδα",
        name_ru="Тестовая колода",
        description_en="Test deck",
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
async def test_word_entry(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Create a test word entry."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="σπίτι",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="house",
        translation_ru="дом",
        pronunciation="/spí·ti/",
        grammar_data={"gender": "neuter"},
        examples=[
            {
                "id": "ex_spiti1",
                "greek": "Το σπίτι είναι μεγάλο.",
                "english": "The house is big.",
                "russian": "Дом большой.",
                "context": None,
            }
        ],
        is_active=True,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def noun_word_entry(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Create a noun word entry with gender."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="βιβλίο",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="book",
        translation_ru="книга",
        grammar_data={"gender": "neuter"},
        is_active=True,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def entry_with_translation_ru_plural(db_session: AsyncSession, test_deck: Deck) -> WordEntry:
    """Create a word entry with translation_ru_plural."""
    entry = WordEntry(
        id=uuid4(),
        deck_id=test_deck.id,
        lemma="λέξη",
        part_of_speech=PartOfSpeech.NOUN,
        translation_en="word",
        translation_ru="слово",
        translation_ru_plural="слова",
        is_active=True,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# =============================================================================
# Schema Tests
# =============================================================================


@pytest.mark.unit
class TestWordEntryInlineUpdateSchema:
    """Tests for WordEntryInlineUpdate Pydantic schema."""

    def test_valid_translation_en_only(self):
        """Schema accepts update with only translation_en."""
        schema = WordEntryInlineUpdate(translation_en="new translation")
        assert schema.translation_en == "new translation"

    def test_valid_full_update(self):
        """Schema accepts full set of editable fields."""
        schema = WordEntryInlineUpdate(
            translation_en="house",
            translation_en_plural="houses",
            translation_ru="дом",
            translation_ru_plural="дома",
            pronunciation="/spí·ti/",
            grammar_data={"gender": "neuter"},
        )
        assert schema.translation_en == "house"
        assert schema.grammar_data == {"gender": "neuter"}

    def test_empty_payload_rejected(self):
        """Schema rejects empty payload (no fields provided)."""
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            WordEntryInlineUpdate()

    def test_whitespace_stripped_from_translation(self):
        """Whitespace is not stripped by this schema (handled by base schema)."""
        # WordEntryInlineUpdate doesn't have strip validators - just check it accepts
        schema = WordEntryInlineUpdate(translation_en="  house  ")
        assert schema.translation_en == "  house  "

    def test_valid_grammar_data_values(self):
        """Schema accepts various grammar_data dict shapes."""
        # Single field
        schema = WordEntryInlineUpdate(grammar_data={"gender": "masculine"})
        assert schema.grammar_data == {"gender": "masculine"}
        # Multiple fields
        schema = WordEntryInlineUpdate(grammar_data={"gender": "feminine", "case": "nominative"})
        assert schema.grammar_data == {"gender": "feminine", "case": "nominative"}
        # Empty dict
        schema = WordEntryInlineUpdate(grammar_data={})
        assert schema.grammar_data == {}

    def test_examples_with_valid_data(self):
        """Schema accepts valid examples list."""
        schema = WordEntryInlineUpdate(
            examples=[
                {
                    "id": "ex_test1",
                    "greek": "Το σπίτι είναι μεγάλο.",
                    "english": "The house is big.",
                    "russian": None,
                    "context": None,
                }
            ]
        )
        assert len(schema.examples) == 1
        assert schema.examples[0].greek == "Το σπίτι είναι μεγάλο."

    def test_example_missing_greek_rejected(self):
        """Schema rejects example missing required greek field."""
        import pydantic

        with pytest.raises(pydantic.ValidationError):
            WordEntryInlineUpdate(
                examples=[
                    {
                        "id": "ex_test1",
                        "greek": "",  # empty greek
                        "english": "test",
                    }
                ]
            )


# =============================================================================
# Endpoint Tests
# =============================================================================


@pytest.mark.unit
class TestUpdateWordEntryEndpoint:
    """Tests for PATCH /api/v1/admin/word-entries/{word_entry_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_translation_en(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: updates translation_en successfully."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en": "home, residence"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["translation_en"] == "home, residence"

    @pytest.mark.asyncio
    async def test_update_translation_ru(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: updates translation_ru successfully."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_ru": "жильё"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["translation_ru"] == "жильё"

    @pytest.mark.asyncio
    async def test_update_pronunciation(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: updates pronunciation successfully."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"pronunciation": "/spi·ti/"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["pronunciation"] == "/spi·ti/"

    @pytest.mark.asyncio
    async def test_returns_full_word_entry_response(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: returns complete WordEntryResponse with all required fields."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en": "house"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "lemma" in data
        assert "part_of_speech" in data
        assert "translation_en" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_returns_404_for_unknown_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
    ):
        """404: returns not found for non-existent word entry ID."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{uuid4()}",
            json={"translation_en": "test"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient, test_word_entry: WordEntry):
        """401: returns unauthorized without auth headers."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en": "test"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_requires_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """403: returns forbidden for non-superuser."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en": "test"},
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_grammar_data_full_replacement(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        noun_word_entry: WordEntry,
    ):
        """200: grammar_data is fully replaced, not merged."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{noun_word_entry.id}",
            json={"grammar_data": {"gender": "masculine", "declension": "second"}},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["grammar_data"] == {"gender": "masculine", "declension": "second"}

    @pytest.mark.asyncio
    async def test_examples_preserved_on_unrelated_update(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: existing examples are preserved when not in payload."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en": "home"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # examples should be unchanged
        assert data["examples"] is not None
        assert len(data["examples"]) == 1
        assert data["examples"][0]["greek"] == "Το σπίτι είναι μεγάλο."

    @pytest.mark.asyncio
    async def test_examples_updated_when_provided(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: examples are updated when provided in payload."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={
                "examples": [
                    {
                        "id": "ex_spiti1",
                        "greek": "Το σπίτι μας είναι μεγάλο.",
                        "english": "Our house is big.",
                        "russian": None,
                        "context": None,
                    }
                ]
            },
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["examples"][0]["greek"] == "Το σπίτι μας είναι μεγάλο."

    @pytest.mark.asyncio
    async def test_update_translation_en_plural(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """200: updates translation_en_plural successfully."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={"translation_en_plural": "homes"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["translation_en_plural"] == "homes"

    @pytest.mark.asyncio
    async def test_update_translation_ru_plural(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        entry_with_translation_ru_plural: WordEntry,
    ):
        """200: updates translation_ru_plural successfully."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{entry_with_translation_ru_plural.id}",
            json={"translation_ru_plural": "слов"},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["translation_ru_plural"] == "слов"

    @pytest.mark.asyncio
    async def test_empty_payload_returns_422(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        test_word_entry: WordEntry,
    ):
        """422: empty payload is rejected."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{test_word_entry.id}",
            json={},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_grammar_data_only_payload_accepted(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        noun_word_entry: WordEntry,
    ):
        """200: grammar_data-only payload is accepted."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{noun_word_entry.id}",
            json={"grammar_data": {"gender": "neuter"}},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["grammar_data"] == {"gender": "neuter"}

    @pytest.mark.asyncio
    async def test_grammar_data_empty_dict_clears_grammar(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict[str, str],
        noun_word_entry: WordEntry,
    ):
        """200: empty grammar_data dict clears all grammar fields."""
        response = await client.patch(
            f"/api/v1/admin/word-entries/{noun_word_entry.id}",
            json={"grammar_data": {}},
            headers=superuser_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["grammar_data"] == {}


# =============================================================================
# Schema Field Tests
# =============================================================================


@pytest.mark.unit
class TestTranslationRuPluralSchemaFix:
    """Tests verifying translation_ru_plural field is correctly defined in schema."""

    def test_schema_has_translation_ru_plural_field(self):
        """WordEntryInlineUpdate schema has translation_ru_plural field."""
        schema = WordEntryInlineUpdate(translation_ru_plural="слова")
        assert schema.translation_ru_plural == "слова"

    def test_schema_translation_ru_plural_can_be_none(self):
        """WordEntryInlineUpdate allows translation_ru_plural to be None."""
        schema = WordEntryInlineUpdate(
            translation_en="word",
            translation_ru_plural=None,
        )
        assert schema.translation_ru_plural is None
