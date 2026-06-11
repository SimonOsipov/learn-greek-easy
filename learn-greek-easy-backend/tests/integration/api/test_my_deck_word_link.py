"""Integration tests for user-facing deck word linking endpoints.

This module covers the "add word to my deck" feature:
- POST /api/v1/decks/{deck_id}/word-entries/{word_entry_id} (link + card generation)
- DELETE /api/v1/decks/{deck_id}/word-entries/{word_entry_id} (unlink + card deletion)
- GET /api/v1/word-entries/{word_entry_id}/my-decks (own decks containing a word)
- Study queue ownership check for user-created decks
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    CardRecord,
    Deck,
    DeckLevel,
    DeckWordEntry,
    PartOfSpeech,
    User,
    Visibility,
    WordEntry,
)


async def _count_cards(db_session: AsyncSession, deck_id, word_entry_id) -> int:
    result = await db_session.execute(
        select(func.count())
        .select_from(CardRecord)
        .where(
            CardRecord.deck_id == deck_id,
            CardRecord.word_entry_id == word_entry_id,
        )
    )
    return result.scalar_one()


async def _is_linked(db_session: AsyncSession, deck_id, word_entry_id) -> bool:
    result = await db_session.execute(
        select(func.count())
        .select_from(DeckWordEntry)
        .where(
            DeckWordEntry.deck_id == deck_id,
            DeckWordEntry.word_entry_id == word_entry_id,
        )
    )
    return result.scalar_one() > 0


@pytest.fixture
async def shared_word(db_session: AsyncSession) -> WordEntry:
    """Shared (admin-created) active word entry."""
    entry = WordEntry(
        id=uuid4(),
        owner_id=None,
        lemma="θάλασσα",
        part_of_speech=PartOfSpeech.NOUN,
        gender="feminine",
        translation_en="sea",
        translation_ru="море",
        pronunciation="/THA-la-sa/",
        grammar_data={"gender": "feminine", "nominative_singular": "θάλασσα"},
        is_active=True,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def inactive_word(db_session: AsyncSession) -> WordEntry:
    """Inactive (soft-deleted) word entry."""
    entry = WordEntry(
        id=uuid4(),
        owner_id=None,
        lemma="παλιό",
        part_of_speech=PartOfSpeech.ADJECTIVE,
        translation_en="old",
        is_active=False,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


@pytest.fixture
async def private_word_of_other_user(db_session: AsyncSession) -> WordEntry:
    """Private word entry owned by a different user."""
    owner = User(
        email="private_word_owner@example.com",
        full_name="Private Word Owner",
        is_active=True,
        is_superuser=False,
        supabase_id="supabase_private_word_owner_test",
    )
    db_session.add(owner)
    await db_session.flush()

    entry = WordEntry(
        id=uuid4(),
        owner_id=owner.id,
        lemma="μυστικό",
        part_of_speech=PartOfSpeech.NOUN,
        gender="neuter",
        translation_en="secret",
        visibility=Visibility.PRIVATE,
        is_active=True,
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


class TestAddWordEntryToMyDeck:
    """Tests for POST /api/v1/decks/{deck_id}/word-entries/{word_entry_id}."""

    @pytest.mark.asyncio
    async def test_requires_authentication(
        self, client: AsyncClient, user_owned_deck: Deck, shared_word: WordEntry
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_owner_can_add_word_and_cards_are_generated(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        shared_word: WordEntry,
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] == str(shared_word.id)
        assert data["lemma"] == shared_word.lemma
        assert data["deck_id"] == str(user_owned_deck.id)

        assert await _is_linked(db_session, user_owned_deck.id, shared_word.id)
        # Meaning cards (el->en, en->el) are generated for every word; article
        # cards additionally for nouns with gender data
        assert await _count_cards(db_session, user_owned_deck.id, shared_word.id) >= 2

    @pytest.mark.asyncio
    async def test_cannot_add_word_to_other_users_deck(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        other_user_deck: Deck,
        shared_word: WordEntry,
    ):
        response = await client.post(
            f"/api/v1/decks/{other_user_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_add_word_to_system_deck(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        test_deck: Deck,
        shared_word: WordEntry,
    ):
        response = await client.post(
            f"/api/v1/decks/{test_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_deck_returns_404(
        self, client: AsyncClient, auth_headers: dict[str, str], shared_word: WordEntry
    ):
        response = await client.post(
            f"/api/v1/decks/{uuid4()}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_inactive_deck_returns_404(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        test_user: User,
        shared_word: WordEntry,
    ):
        deck = Deck(
            id=uuid4(),
            name_en="Inactive Own Deck",
            name_el="Ανενεργή",
            name_ru="Неактивная",
            level=DeckLevel.A1,
            is_active=False,
            owner_id=test_user.id,
        )
        db_session.add(deck)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/decks/{deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_missing_word_returns_404(
        self, client: AsyncClient, auth_headers: dict[str, str], user_owned_deck: Deck
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_inactive_word_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        inactive_word: WordEntry,
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{inactive_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_private_word_of_other_user_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        private_word_of_other_user: WordEntry,
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{private_word_of_other_user.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_own_private_word_can_be_added(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        test_user: User,
        user_owned_deck: Deck,
    ):
        entry = WordEntry(
            id=uuid4(),
            owner_id=test_user.id,
            lemma="δικό μου",
            part_of_speech=PartOfSpeech.PHRASE,
            translation_en="my own",
            visibility=Visibility.PRIVATE,
            is_active=True,
        )
        db_session.add(entry)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{entry.id}",
            headers=auth_headers,
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_already_linked_returns_409(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        shared_word: WordEntry,
    ):
        db_session.add(DeckWordEntry(deck_id=user_owned_deck.id, word_entry_id=shared_word.id))
        await db_session.commit()

        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_duplicate_lemma_pos_gender_returns_409(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        test_user: User,
        user_owned_deck: Deck,
        shared_word: WordEntry,
    ):
        # Deck already contains a different word entry with the same
        # lemma + part of speech + gender. The twin is user-owned so it
        # doesn't collide with the global (owner, lemma, pos, gender)
        # unique constraint that shared_word occupies.
        twin = WordEntry(
            id=uuid4(),
            owner_id=test_user.id,
            lemma=shared_word.lemma,
            part_of_speech=shared_word.part_of_speech,
            gender=shared_word.gender,
            translation_en="sea (duplicate)",
            is_active=True,
        )
        db_session.add(twin)
        await db_session.flush()
        db_session.add(DeckWordEntry(deck_id=user_owned_deck.id, word_entry_id=twin.id))
        await db_session.commit()

        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 409


class TestRemoveWordEntryFromMyDeck:
    """Tests for DELETE /api/v1/decks/{deck_id}/word-entries/{word_entry_id}."""

    @pytest.mark.asyncio
    async def test_requires_authentication(
        self, client: AsyncClient, user_owned_deck: Deck, shared_word: WordEntry
    ):
        response = await client.delete(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_owner_can_remove_word_and_cards_are_deleted(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        shared_word: WordEntry,
    ):
        # Link via the API so card records exist
        link_response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert link_response.status_code == 201
        assert await _count_cards(db_session, user_owned_deck.id, shared_word.id) > 0

        response = await client.delete(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )

        assert response.status_code == 204
        assert not await _is_linked(db_session, user_owned_deck.id, shared_word.id)
        assert await _count_cards(db_session, user_owned_deck.id, shared_word.id) == 0

        # The word entry itself is preserved
        entry = await db_session.get(WordEntry, shared_word.id)
        assert entry is not None
        assert entry.is_active

    @pytest.mark.asyncio
    async def test_cannot_remove_word_from_other_users_deck(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        other_user_deck: Deck,
        shared_word: WordEntry,
    ):
        db_session.add(DeckWordEntry(deck_id=other_user_deck.id, word_entry_id=shared_word.id))
        await db_session.commit()

        response = await client.delete(
            f"/api/v1/decks/{other_user_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403
        assert await _is_linked(db_session, other_user_deck.id, shared_word.id)

    @pytest.mark.asyncio
    async def test_not_linked_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        shared_word: WordEntry,
    ):
        response = await client.delete(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestMyDecksForWordEntry:
    """Tests for GET /api/v1/word-entries/{word_entry_id}/my-decks."""

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient, shared_word: WordEntry):
        response = await client.get(f"/api/v1/word-entries/{shared_word.id}/my-decks")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_returns_only_own_decks_containing_word(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        other_user_deck: Deck,
        test_deck: Deck,
        shared_word: WordEntry,
    ):
        # Word linked to: my deck, another user's deck, and a system deck
        for deck in (user_owned_deck, other_user_deck, test_deck):
            db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=shared_word.id))
        await db_session.commit()

        response = await client.get(
            f"/api/v1/word-entries/{shared_word.id}/my-decks", headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["deck_ids"] == [str(user_owned_deck.id)]

    @pytest.mark.asyncio
    async def test_word_not_in_any_deck_returns_empty_list(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        shared_word: WordEntry,
    ):
        response = await client.get(
            f"/api/v1/word-entries/{shared_word.id}/my-decks", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["deck_ids"] == []

    @pytest.mark.asyncio
    async def test_missing_word_returns_404(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ):
        response = await client.get(
            f"/api/v1/word-entries/{uuid4()}/my-decks", headers=auth_headers
        )
        assert response.status_code == 404


class TestStudyQueueDeckOwnership:
    """Tests for the deck ownership check on GET /api/v1/study/queue/v2."""

    @pytest.mark.asyncio
    async def test_cannot_study_other_users_deck(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        other_user_deck: Deck,
    ):
        response = await client.get(
            f"/api/v1/study/queue/v2?deck_id={other_user_deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_can_study_own_deck(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
    ):
        response = await client.get(
            f"/api/v1/study/queue/v2?deck_id={user_owned_deck.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200


class TestPremiumWordGate:
    """Free users cannot link words that exist exclusively in premium system decks."""

    @pytest.fixture
    async def premium_deck_with_word(self, db_session: AsyncSession, shared_word: WordEntry):
        """An active premium system deck containing shared_word."""
        deck = Deck(
            id=uuid4(),
            name_en="Premium System Deck",
            name_el="Πρίμιουμ",
            name_ru="Премиум",
            level=DeckLevel.B1,
            is_active=True,
            is_premium=True,
        )
        db_session.add(deck)
        await db_session.flush()
        db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=shared_word.id))
        await db_session.commit()
        return deck

    @pytest.mark.asyncio
    async def test_free_user_blocked_for_premium_only_word(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        shared_word: WordEntry,
        premium_deck_with_word: Deck,
    ):
        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 403
        assert response.json()["error_code"] == "PREMIUM_REQUIRED"

    @pytest.mark.asyncio
    async def test_free_user_allowed_when_word_also_in_free_system_deck(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        user_owned_deck: Deck,
        test_deck: Deck,
        shared_word: WordEntry,
        premium_deck_with_word: Deck,
    ):
        # The same word also lives in a free system deck -> not premium-exclusive
        db_session.add(DeckWordEntry(deck_id=test_deck.id, word_entry_id=shared_word.id))
        await db_session.commit()

        response = await client.post(
            f"/api/v1/decks/{user_owned_deck.id}/word-entries/{shared_word.id}",
            headers=auth_headers,
        )
        assert response.status_code == 201


class TestMyDecksPrivateWordGuard:
    """my-decks endpoint must not act as an existence oracle for private words."""

    @pytest.mark.asyncio
    async def test_private_word_of_other_user_returns_404(
        self,
        client: AsyncClient,
        auth_headers: dict[str, str],
        private_word_of_other_user: WordEntry,
    ):
        response = await client.get(
            f"/api/v1/word-entries/{private_word_of_other_user.id}/my-decks",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeckDetailIsOwned:
    """GET /decks/{id} reports whether the deck is owned by the caller."""

    @pytest.mark.asyncio
    async def test_own_deck_is_owned_true(
        self, client: AsyncClient, auth_headers: dict[str, str], user_owned_deck: Deck
    ):
        response = await client.get(f"/api/v1/decks/{user_owned_deck.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_owned"] is True

    @pytest.mark.asyncio
    async def test_system_deck_is_owned_false(
        self, client: AsyncClient, auth_headers: dict[str, str], test_deck: Deck
    ):
        response = await client.get(f"/api/v1/decks/{test_deck.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_owned"] is False


class TestCrossDeckQueueIsolation:
    """Cards in other users' personal decks never enter the cross-deck study queue."""

    @pytest.mark.asyncio
    async def test_other_users_personal_deck_cards_excluded_from_unscoped_queue(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        auth_headers: dict[str, str],
        other_user_deck: Deck,
        shared_word: WordEntry,
    ):
        from src.db.models import CardRecord, CardType

        # Another user's personal deck has a linked word with a generated card
        db_session.add(DeckWordEntry(deck_id=other_user_deck.id, word_entry_id=shared_word.id))
        card = CardRecord(
            id=uuid4(),
            word_entry_id=shared_word.id,
            deck_id=other_user_deck.id,
            card_type=CardType.MEANING_EL_TO_EN,
            variant_key="default",
            front_content={"text": "θάλασσα"},
            back_content={"text": "sea"},
            is_active=True,
        )
        db_session.add(card)
        await db_session.commit()

        # Unscoped (cross-deck) queue for the current user must not surface it
        response = await client.get("/api/v1/study/queue/v2", headers=auth_headers)
        assert response.status_code == 200
        card_ids = [c["card_record_id"] for c in response.json()["cards"]]
        assert str(card.id) not in card_ids
