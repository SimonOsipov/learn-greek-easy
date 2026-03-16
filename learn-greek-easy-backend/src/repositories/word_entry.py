"""Repository for WordEntry model with bulk upsert support."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckWordEntry, PartOfSpeech, WordEntry
from src.repositories.base import BaseRepository


class WordEntryRepository(BaseRepository[WordEntry]):
    """Repository for WordEntry model with bulk operations.

    Provides standard CRUD operations via BaseRepository plus
    bulk upsert functionality for efficient imports.
    """

    def __init__(self, db: AsyncSession):
        """Initialize repository with database session.

        Args:
            db: Async database session from dependency injection
        """
        super().__init__(WordEntry, db)

    async def get_by_deck(
        self,
        deck_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True,
    ) -> list[WordEntry]:
        """Get word entries for a specific deck.

        Args:
            deck_id: Deck UUID
            skip: Pagination offset
            limit: Max results
            active_only: If True, only return is_active=True entries

        Returns:
            List of word entries ordered by lemma
        """
        query = (
            select(WordEntry)
            .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
            .where(DeckWordEntry.deck_id == deck_id)
        )
        if active_only:
            query = query.where(WordEntry.is_active.is_(True))
        query = query.order_by(WordEntry.lemma).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_deck(self, deck_id: UUID, *, active_only: bool = True) -> int:
        """Count word entries in a deck.

        Args:
            deck_id: Deck UUID
            active_only: If True, only count is_active=True entries

        Returns:
            Total number of word entries
        """
        query = (
            select(func.count())
            .select_from(WordEntry)
            .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
            .where(DeckWordEntry.deck_id == deck_id)
        )
        if active_only:
            query = query.where(WordEntry.is_active.is_(True))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def search_by_deck(
        self,
        deck_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        part_of_speech: PartOfSpeech | None = None,
        sort_by: str = "lemma",
        sort_order: str = "asc",
        active_only: bool = True,
    ) -> list[WordEntry]:
        """Search word entries for a specific deck with filtering.

        Args:
            deck_id: Deck UUID
            skip: Pagination offset
            limit: Max results
            search: Search term for lemma, translation_en, translation_ru, pronunciation
            part_of_speech: Filter by part of speech
            sort_by: Sort field ("lemma" or "created_at")
            sort_order: Sort direction ("asc" or "desc")
            active_only: If True, only return is_active=True entries

        Returns:
            List of word entries matching criteria
        """
        query = (
            select(WordEntry)
            .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
            .where(DeckWordEntry.deck_id == deck_id)
        )

        if active_only:
            query = query.where(WordEntry.is_active.is_(True))

        if part_of_speech is not None:
            query = query.where(WordEntry.part_of_speech == part_of_speech)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    WordEntry.lemma.ilike(search_pattern),
                    WordEntry.translation_en.ilike(search_pattern),
                    WordEntry.translation_ru.ilike(search_pattern),
                    WordEntry.pronunciation.ilike(search_pattern),
                )
            )

        # Sorting
        sort_column = WordEntry.lemma if sort_by == "lemma" else WordEntry.created_at
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_deck_filtered(
        self,
        deck_id: UUID,
        *,
        search: str | None = None,
        part_of_speech: PartOfSpeech | None = None,
        active_only: bool = True,
    ) -> int:
        """Count word entries in a deck with optional filters.

        Args:
            deck_id: Deck UUID
            search: Search term for lemma, translation_en, translation_ru, pronunciation
            part_of_speech: Filter by part of speech
            active_only: If True, only count is_active=True entries

        Returns:
            Total number of matching word entries
        """
        query = (
            select(func.count())
            .select_from(WordEntry)
            .join(DeckWordEntry, DeckWordEntry.word_entry_id == WordEntry.id)
            .where(DeckWordEntry.deck_id == deck_id)
        )

        if active_only:
            query = query.where(WordEntry.is_active.is_(True))

        if part_of_speech is not None:
            query = query.where(WordEntry.part_of_speech == part_of_speech)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    WordEntry.lemma.ilike(search_pattern),
                    WordEntry.translation_en.ilike(search_pattern),
                    WordEntry.translation_ru.ilike(search_pattern),
                    WordEntry.pronunciation.ilike(search_pattern),
                )
            )

        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_by_owner_lemma_pos_gender(
        self,
        owner_id: UUID | None,
        lemma: str,
        part_of_speech: str,
        gender: str | None = None,
    ) -> WordEntry | None:
        """Get a word entry by its unique constraint fields.

        Args:
            owner_id: Owner UUID (None for admin/system entries)
            lemma: Dictionary form of the word
            part_of_speech: Part of speech value
            gender: Grammatical gender (None for non-noun POS types)

        Returns:
            WordEntry if found, None otherwise
        """
        query = select(WordEntry).where(
            WordEntry.owner_id == owner_id,
            WordEntry.lemma == lemma,
            WordEntry.part_of_speech == part_of_speech,
            WordEntry.gender == gender,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    def _build_audio_key_lookup(
        existing_rows: Sequence,
    ) -> dict[tuple[str, str, str | None], dict[str, str]]:
        """Build a lookup of existing audio keys keyed by (lemma, pos, gender) -> {example_id: audio_key}."""
        lookup: dict[tuple[str, str, str | None], dict[str, str]] = {}
        for row in existing_rows:
            pos_val = (
                row.part_of_speech.value
                if hasattr(row.part_of_speech, "value")
                else row.part_of_speech
            )
            if not row.examples:
                continue
            audio_map = {
                ex["id"]: ex["audio_key"]
                for ex in row.examples
                if ex.get("id") and ex.get("audio_key")
            }
            if audio_map:
                lookup[(row.lemma, pos_val, row.gender)] = audio_map
        return lookup

    @staticmethod
    def _merge_audio_keys(
        entry_with_deck: dict,
        key: tuple[str, str, str | None],
        existing_audio_keys: dict[tuple[str, str, str | None], dict[str, str]],
    ) -> None:
        """Merge existing audio_key values into incoming examples (in-place)."""
        if key not in existing_audio_keys or not entry_with_deck.get("examples"):
            return
        audio_map = existing_audio_keys[key]
        for example in entry_with_deck["examples"]:
            ex_id = example.get("id")
            if ex_id and ex_id in audio_map and not example.get("audio_key"):
                example["audio_key"] = audio_map[ex_id]

    async def bulk_upsert(
        self,
        owner_id: UUID | None,
        entries_data: list[dict],
    ) -> tuple[list[WordEntry], int, int]:
        """Bulk create or update word entries.

        Uses PostgreSQL ON CONFLICT ... DO UPDATE to efficiently handle
        both new entries and updates to existing entries in a single operation.

        Args:
            owner_id: Owner UUID (None for admin/system entries)
            entries_data: List of dictionaries containing word entry fields.
                Each dict should have: lemma, part_of_speech, translation_en,
                and optionally: translation_ru, pronunciation,
                grammar_data, examples.

        Returns:
            Tuple of:
            - List of all WordEntry objects (created and updated)
            - Number of entries created
            - Number of entries updated

        Note:
            Does NOT commit the transaction. Caller must call db.commit() after.

        Example:
            entries, created, updated = await repo.bulk_upsert(
                owner_id=owner_id,
                entries_data=[
                    {"lemma": "σπίτι", "part_of_speech": "NOUN", "translation_en": "house"},
                    {"lemma": "τρέχω", "part_of_speech": "VERB", "translation_en": "to run"},
                ]
            )
            await db.commit()
        """
        if not entries_data:
            return [], 0, 0

        # Get existing entries to determine created vs updated count
        existing_query = select(
            WordEntry.lemma, WordEntry.part_of_speech, WordEntry.gender, WordEntry.examples
        ).where(
            WordEntry.owner_id == owner_id,
        )
        existing_result = await self.db.execute(existing_query)
        existing_rows = existing_result.all()
        existing_keys = {
            (
                row.lemma,
                (
                    row.part_of_speech.value
                    if hasattr(row.part_of_speech, "value")
                    else row.part_of_speech
                ),
                row.gender,
            )
            for row in existing_rows
        }

        # Build audio_key lookup: {(lemma, pos, gender): {example_id: audio_key}}
        existing_audio_keys = self._build_audio_key_lookup(existing_rows)

        # Prepare values with owner_id added to each entry
        values = []
        created_count = 0
        updated_count = 0

        for entry in entries_data:
            entry_with_owner = {"owner_id": owner_id, **entry}
            # Normalize part_of_speech to string for comparison
            pos_value = entry["part_of_speech"]
            if hasattr(pos_value, "value"):
                pos_value = pos_value.value

            key = (entry["lemma"], pos_value, entry.get("gender"))
            if key in existing_keys:
                updated_count += 1
            else:
                created_count += 1

            # Merge audio_keys from existing examples into incoming examples
            self._merge_audio_keys(entry_with_owner, key, existing_audio_keys)

            values.append(entry_with_owner)

        # Build PostgreSQL upsert statement
        # Columns to update on conflict (all except primary key and constraint columns)
        update_columns = [
            "translation_en",
            "translation_en_plural",
            "translation_ru",
            "translation_ru_plural",
            "pronunciation",
            "grammar_data",
            "examples",
        ]

        insert_stmt = insert(WordEntry).values(values)

        # ON CONFLICT (owner_id, lemma, part_of_speech, gender) DO UPDATE
        upsert_stmt = insert_stmt.on_conflict_do_update(
            constraint="uq_word_entry_owner_lemma_pos_gender",
            set_={col: getattr(insert_stmt.excluded, col) for col in update_columns}
            | {"updated_at": func.now()},
        )

        # Execute upsert and return the IDs
        returning_stmt = upsert_stmt.returning(WordEntry.id)
        result = await self.db.execute(returning_stmt)
        entry_ids = [row[0] for row in result.all()]

        await self.db.flush()

        # Expire any cached instances and re-fetch with fresh data
        for entry_id in entry_ids:
            existing = await self.db.get(WordEntry, entry_id)
            if existing:
                self.db.expire(existing)

        # Fetch fresh data for all upserted entries
        fetch_query = select(WordEntry).where(WordEntry.id.in_(entry_ids))
        fetch_result = await self.db.execute(fetch_query)
        entries = list(fetch_result.scalars().all())

        return entries, created_count, updated_count

    async def link_to_deck(self, word_entry_id: UUID, deck_id: UUID) -> None:
        """Link a word entry to a deck via the junction table. Idempotent."""
        stmt = (
            insert(DeckWordEntry)
            .values(word_entry_id=word_entry_id, deck_id=deck_id)
            .on_conflict_do_nothing()
        )
        await self.db.execute(stmt)

    async def unlink_from_deck(self, word_entry_id: UUID, deck_id: UUID) -> None:
        """Remove a word entry from a deck."""
        stmt = delete(DeckWordEntry).where(
            DeckWordEntry.word_entry_id == word_entry_id,
            DeckWordEntry.deck_id == deck_id,
        )
        await self.db.execute(stmt)

    async def get_decks_for_word_entry(self, word_entry_id: UUID) -> list[UUID]:
        """Get all deck IDs linked to a word entry."""
        query = select(DeckWordEntry.deck_id).where(DeckWordEntry.word_entry_id == word_entry_id)
        result = await self.db.execute(query)
        return [row[0] for row in result.all()]

    async def is_linked_to_deck(self, word_entry_id: UUID, deck_id: UUID) -> bool:
        """Check if a word entry is linked to a specific deck."""
        query = (
            select(func.count())
            .select_from(DeckWordEntry)
            .where(
                DeckWordEntry.word_entry_id == word_entry_id,
                DeckWordEntry.deck_id == deck_id,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one() > 0
