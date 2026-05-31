"""Unit tests for DeckRepository.

This module tests:
- list_active: excludes user-owned decks and deactivated decks; optional level filter
- search: case-insensitive ILIKE; excludes user-owned decks; excludes deactivated decks
- get_batch_card_counts: maps deck_id -> word-entry count; empty-list fast-path
- Consistency: get_batch_card_counts vs count_cards for the same deck

Tests use real database fixtures and PostgreSQL (no mocks).
"""

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Deck, DeckLevel, DeckWordEntry, PartOfSpeech, User, WordEntry
from src.repositories.deck import DeckRepository

# =============================================================================
# Local Fixtures
# =============================================================================


@pytest.fixture
async def system_deck(db_session: AsyncSession) -> Deck:
    """Active system deck (owner_id=None)."""
    deck = Deck(
        name_en="Greek A1 Basics",
        name_el="Βασικά A1",
        name_ru="Основы A1",
        description_en="Basic Greek vocabulary",
        description_el="Βασικό λεξιλόγιο",
        description_ru="Базовая лексика",
        level=DeckLevel.A1,
        is_active=True,
        owner_id=None,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_system_deck(db_session: AsyncSession) -> Deck:
    """Inactive system deck (owner_id=None, is_active=False)."""
    deck = Deck(
        name_en="Archived Deck",
        name_el="Archived Deck",
        name_ru="Archived Deck",
        description_en="Inactive system deck",
        description_el="Inactive system deck",
        description_ru="Inactive system deck",
        level=DeckLevel.A2,
        is_active=False,
        owner_id=None,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def owner_user(db_session: AsyncSession) -> User:
    """A test user to own decks."""
    user = User(
        email="deck_repo_test@example.com",
        full_name="Deck Repo Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def user_owned_deck(db_session: AsyncSession, owner_user: User) -> Deck:
    """Active deck owned by a user (should be excluded from system queries)."""
    deck = Deck(
        name_en="My Personal Deck",
        name_el="Προσωπικό Deck",
        name_ru="Мой Deck",
        description_en="User-owned deck",
        description_el="User-owned deck",
        description_ru="User-owned deck",
        level=DeckLevel.A1,
        is_active=True,
        owner_id=owner_user.id,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def system_deck_a2(db_session: AsyncSession) -> Deck:
    """Active A2-level system deck."""
    deck = Deck(
        name_en="Greek A2 Daily Life",
        name_el="Καθημερινή A2",
        name_ru="Ежедневная жизнь A2",
        description_en="Intermediate Greek vocabulary",
        description_el="Ενδιάμεσο λεξιλόγιο",
        description_ru="Промежуточная лексика",
        level=DeckLevel.A2,
        is_active=True,
        owner_id=None,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


async def _add_word_entries(db_session: AsyncSession, deck: Deck, count: int) -> list[WordEntry]:
    """Helper: create `count` active WordEntry rows linked to `deck`."""
    entries = []
    for i in range(count):
        entry = WordEntry(
            owner_id=None,
            lemma=f"word_{uuid4().hex[:8]}_{i}",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en=f"word {i}",
            is_active=True,
        )
        db_session.add(entry)
        entries.append(entry)

    await db_session.flush()

    for entry in entries:
        db_session.add(DeckWordEntry(deck_id=deck.id, word_entry_id=entry.id))

    await db_session.flush()
    for entry in entries:
        await db_session.refresh(entry)

    return entries


# =============================================================================
# Tests: list_active
# =============================================================================


class TestListActive:
    """Tests for DeckRepository.list_active()."""

    @pytest.mark.asyncio
    async def test_returns_active_system_decks(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Active system deck must appear in list_active results."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        deck_ids = [d.id for d in results]
        assert system_deck.id in deck_ids

    @pytest.mark.asyncio
    async def test_excludes_inactive_system_decks(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        inactive_system_deck: Deck,
    ):
        """Inactive decks must not appear even if owner_id is NULL."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        deck_ids = [d.id for d in results]
        assert inactive_system_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_excludes_user_owned_decks(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        user_owned_deck: Deck,
    ):
        """Active user-owned decks must not appear in list_active."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        deck_ids = [d.id for d in results]
        assert user_owned_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_excludes_inactive_and_user_owned_simultaneously(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        inactive_system_deck: Deck,
        user_owned_deck: Deck,
    ):
        """Both inactive and user-owned decks must be excluded; active system deck included."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        deck_ids = [d.id for d in results]
        assert system_deck.id in deck_ids
        assert inactive_system_deck.id not in deck_ids
        assert user_owned_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_returned_decks_have_null_owner_id(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        user_owned_deck: Deck,
    ):
        """All returned decks must have owner_id = NULL."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        assert all(d.owner_id is None for d in results)

    @pytest.mark.asyncio
    async def test_returned_decks_are_all_active(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        inactive_system_deck: Deck,
    ):
        """All returned decks must have is_active = True."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        assert all(d.is_active is True for d in results)

    @pytest.mark.asyncio
    async def test_filters_by_level(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        system_deck_a2: Deck,
    ):
        """When level is provided, only decks of that level are returned."""
        repo = DeckRepository(db_session)

        a1_results = await repo.list_active(level=DeckLevel.A1)
        a2_results = await repo.list_active(level=DeckLevel.A2)

        a1_ids = [d.id for d in a1_results]
        a2_ids = [d.id for d in a2_results]

        assert system_deck.id in a1_ids
        assert system_deck_a2.id not in a1_ids

        assert system_deck_a2.id in a2_ids
        assert system_deck.id not in a2_ids

    @pytest.mark.asyncio
    async def test_respects_pagination_limit(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        system_deck_a2: Deck,
    ):
        """limit=1 should return at most one result."""
        repo = DeckRepository(db_session)
        results = await repo.list_active(skip=0, limit=1)

        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_empty_when_no_active_system_decks(
        self,
        db_session: AsyncSession,
        inactive_system_deck: Deck,
        user_owned_deck: Deck,
    ):
        """Should return empty list when no active system decks exist."""
        repo = DeckRepository(db_session)
        results = await repo.list_active()

        # Neither of the two created decks qualifies as an active system deck
        deck_ids = [d.id for d in results]
        assert inactive_system_deck.id not in deck_ids
        assert user_owned_deck.id not in deck_ids


# =============================================================================
# Tests: search
# =============================================================================


class TestSearch:
    """Tests for DeckRepository.search()."""

    @pytest.mark.asyncio
    async def test_finds_by_english_name_substring(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Searching an English name substring returns the deck."""
        repo = DeckRepository(db_session)
        results = await repo.search("A1 Basics")

        deck_ids = [d.id for d in results]
        assert system_deck.id in deck_ids

    @pytest.mark.asyncio
    async def test_case_insensitive_match(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Search must be case-insensitive (ILIKE)."""
        repo = DeckRepository(db_session)

        lower_results = await repo.search("greek a1 basics")
        upper_results = await repo.search("GREEK A1 BASICS")
        mixed_results = await repo.search("Greek A1 Basics")

        lower_ids = {d.id for d in lower_results}
        upper_ids = {d.id for d in upper_results}
        mixed_ids = {d.id for d in mixed_results}

        assert system_deck.id in lower_ids
        assert system_deck.id in upper_ids
        assert system_deck.id in mixed_ids

    @pytest.mark.asyncio
    async def test_excludes_inactive_system_decks(
        self,
        db_session: AsyncSession,
        inactive_system_deck: Deck,
    ):
        """Inactive decks must not appear in search results."""
        repo = DeckRepository(db_session)
        # "Archived Deck" is the name_en of inactive_system_deck
        results = await repo.search("Archived Deck")

        deck_ids = [d.id for d in results]
        assert inactive_system_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_excludes_user_owned_decks(
        self,
        db_session: AsyncSession,
        user_owned_deck: Deck,
    ):
        """User-owned decks must not appear in search results."""
        repo = DeckRepository(db_session)
        # "Personal Deck" appears in user_owned_deck.name_en
        results = await repo.search("Personal Deck")

        deck_ids = [d.id for d in results]
        assert user_owned_deck.id not in deck_ids

    @pytest.mark.asyncio
    async def test_no_results_for_nonexistent_query(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Query that matches nothing returns empty list."""
        repo = DeckRepository(db_session)
        results = await repo.search("zzz_no_match_xyz_99999")

        assert results == []

    @pytest.mark.asyncio
    async def test_matches_description_field(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Search must also match the English description field."""
        repo = DeckRepository(db_session)
        # system_deck.description_en = "Basic Greek vocabulary"
        results = await repo.search("Basic Greek vocabulary")

        deck_ids = [d.id for d in results]
        assert system_deck.id in deck_ids

    @pytest.mark.asyncio
    async def test_returned_decks_are_system_and_active(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        user_owned_deck: Deck,
    ):
        """All returned decks must have owner_id = NULL and is_active = True."""
        repo = DeckRepository(db_session)
        # Broad query to try to surface both decks
        results = await repo.search("Deck")

        assert all(d.owner_id is None for d in results)
        assert all(d.is_active is True for d in results)

    @pytest.mark.asyncio
    async def test_respects_limit(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        system_deck_a2: Deck,
    ):
        """limit parameter caps the number of results."""
        repo = DeckRepository(db_session)
        results = await repo.search("Greek", limit=1)

        assert len(results) <= 1


# =============================================================================
# Tests: get_batch_card_counts
# =============================================================================


class TestGetBatchCardCounts:
    """Tests for DeckRepository.get_batch_card_counts()."""

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty_dict(self, db_session: AsyncSession):
        """Empty input must return an empty dict (fast path, no DB query)."""
        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([])

        assert result == {}

    @pytest.mark.asyncio
    async def test_single_deck_with_words(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Deck with word entries should report the correct count."""
        await _add_word_entries(db_session, system_deck, 3)

        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([system_deck.id])

        assert result[system_deck.id] == 3

    @pytest.mark.asyncio
    async def test_multiple_decks_mapped_correctly(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        system_deck_a2: Deck,
    ):
        """Each deck ID maps to its own word count independently."""
        await _add_word_entries(db_session, system_deck, 2)
        await _add_word_entries(db_session, system_deck_a2, 5)

        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([system_deck.id, system_deck_a2.id])

        assert result[system_deck.id] == 2
        assert result[system_deck_a2.id] == 5

    @pytest.mark.asyncio
    async def test_deck_with_no_words_absent_from_result(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """A deck with no word entries is absent from the result dict.

        The GROUP BY aggregation naturally omits groups with no rows.
        Callers should use .get(deck_id, 0) to treat missing keys as zero.
        """
        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([system_deck.id])

        assert system_deck.id not in result

    @pytest.mark.asyncio
    async def test_inactive_word_entries_excluded(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Inactive WordEntry rows must not be counted."""
        await _add_word_entries(db_session, system_deck, 2)

        inactive_entry = WordEntry(
            owner_id=None,
            lemma=f"inactive_{uuid4().hex[:8]}",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="inactive",
            is_active=False,
        )
        db_session.add(inactive_entry)
        await db_session.flush()
        db_session.add(DeckWordEntry(deck_id=system_deck.id, word_entry_id=inactive_entry.id))
        await db_session.flush()

        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([system_deck.id])

        # Only the 2 active entries should be counted
        assert result[system_deck.id] == 2

    @pytest.mark.asyncio
    async def test_unknown_deck_id_not_in_result(
        self,
        db_session: AsyncSession,
    ):
        """A UUID that does not exist in the DB produces no entry in the dict."""
        repo = DeckRepository(db_session)
        nonexistent_id = uuid4()
        result = await repo.get_batch_card_counts([nonexistent_id])

        assert nonexistent_id not in result

    @pytest.mark.asyncio
    async def test_result_keys_are_uuid_type(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Result dict keys must be the same UUID type as deck.id."""
        await _add_word_entries(db_session, system_deck, 1)

        repo = DeckRepository(db_session)
        result = await repo.get_batch_card_counts([system_deck.id])

        for key in result:
            assert type(key) is type(
                system_deck.id
            ), f"Expected key type {type(system_deck.id)}, got {type(key)}"


# =============================================================================
# Tests: consistency between get_batch_card_counts and count_cards
# =============================================================================


class TestBatchCountConsistencyWithCountCards:
    """Verify get_batch_card_counts and count_cards agree for the same deck."""

    @pytest.mark.asyncio
    async def test_batch_matches_count_cards_single_deck(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """get_batch_card_counts[deck.id] must equal count_cards(deck.id)."""
        await _add_word_entries(db_session, system_deck, 4)

        repo = DeckRepository(db_session)

        batch_result = await repo.get_batch_card_counts([system_deck.id])
        count_result = await repo.count_cards(system_deck.id)

        assert batch_result[system_deck.id] == count_result

    @pytest.mark.asyncio
    async def test_batch_matches_count_cards_multiple_decks(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
        system_deck_a2: Deck,
    ):
        """Both decks must have matching counts from batch vs single-deck methods."""
        await _add_word_entries(db_session, system_deck, 3)
        await _add_word_entries(db_session, system_deck_a2, 7)

        repo = DeckRepository(db_session)

        batch_result = await repo.get_batch_card_counts([system_deck.id, system_deck_a2.id])
        count_deck1 = await repo.count_cards(system_deck.id)
        count_deck2 = await repo.count_cards(system_deck_a2.id)

        assert batch_result[system_deck.id] == count_deck1
        assert batch_result[system_deck_a2.id] == count_deck2

    @pytest.mark.asyncio
    async def test_both_return_zero_for_empty_deck(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Empty deck: count_cards returns 0; batch omits the deck_id (equivalent to 0)."""
        repo = DeckRepository(db_session)

        count_result = await repo.count_cards(system_deck.id)
        batch_result = await repo.get_batch_card_counts([system_deck.id])

        assert count_result == 0
        # batch omits decks with zero entries — .get(..., 0) gives the same answer
        assert batch_result.get(system_deck.id, 0) == count_result

    @pytest.mark.asyncio
    async def test_consistency_with_inactive_entries(
        self,
        db_session: AsyncSession,
        system_deck: Deck,
    ):
        """Both methods must agree on active-only count when inactive entries also exist."""
        await _add_word_entries(db_session, system_deck, 2)

        inactive_entry = WordEntry(
            owner_id=None,
            lemma=f"inact_{uuid4().hex[:8]}",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="inactive word",
            is_active=False,
        )
        db_session.add(inactive_entry)
        await db_session.flush()
        db_session.add(DeckWordEntry(deck_id=system_deck.id, word_entry_id=inactive_entry.id))
        await db_session.flush()

        repo = DeckRepository(db_session)

        batch_result = await repo.get_batch_card_counts([system_deck.id])
        count_result = await repo.count_cards(system_deck.id)

        assert batch_result[system_deck.id] == count_result == 2
