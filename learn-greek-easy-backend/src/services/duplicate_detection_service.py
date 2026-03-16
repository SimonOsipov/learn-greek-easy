"""Cross-deck duplicate detection service for word entries."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import Deck, DeckWordEntry, PartOfSpeech, WordEntry
from src.schemas.nlp import DeckSummary, DuplicateCheckResult, WordEntrySnapshot

logger = get_logger(__name__)


class DuplicateDetectionService:
    """Detects duplicate word entries across all decks.

    Uses accent-insensitive lemma + part_of_speech matching via the
    ``immutable_unaccent()`` function (an IMMUTABLE wrapper around the
    PostgreSQL ``unaccent()`` extension). Instantiated per-request
    with an AsyncSession (same pattern as repositories).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def check(
        self,
        lemma: str,
        part_of_speech: PartOfSpeech,
        *,
        gender: str | None = None,
        exclude_deck_id: UUID | None = None,
    ) -> DuplicateCheckResult:
        """Check if a lemma+POS combination exists in any deck.

        Args:
            lemma: Normalized lemma to search for.
            part_of_speech: Part of speech (same lemma with different POS is NOT a duplicate).
            gender: Optional grammatical gender (e.g., "masculine", "feminine", "neuter").
                When provided, only matches entries with the same gender. When None,
                matches any entry regardless of gender (backward compatible).
            exclude_deck_id: Optional deck ID to exclude from search (e.g., the target deck).

        Returns:
            DuplicateCheckResult with is_duplicate=True and match details if found,
            or is_duplicate=False with no match details.
        """
        # Step A: Find the word entry by lemma+pos (no deck filter)
        entry_query = (
            select(WordEntry)
            .where(
                func.immutable_unaccent(WordEntry.lemma) == func.immutable_unaccent(lemma),
                WordEntry.part_of_speech == part_of_speech,
                WordEntry.is_active.is_(True),
            )
            .order_by(WordEntry.created_at.asc())
            .limit(1)
        )
        # When gender is specified, restrict to same-gender entries.
        # This allows common-gender nouns (e.g., σύζυγος) to exist as
        # separate masculine and feminine word entries.
        if gender is not None:
            entry_query = entry_query.where(WordEntry.gender == gender)
        entry_result = await self.db.execute(entry_query)
        entry = entry_result.scalar_one_or_none()

        if entry is None:
            return DuplicateCheckResult(is_duplicate=False)

        # Step B: Find all decks this word entry belongs to
        decks_query = (
            select(Deck.id, Deck.name_en)
            .join(DeckWordEntry, DeckWordEntry.deck_id == Deck.id)
            .where(DeckWordEntry.word_entry_id == entry.id)
        )
        if exclude_deck_id is not None:
            decks_query = decks_query.where(Deck.id != exclude_deck_id)

        decks_result = await self.db.execute(decks_query)
        matched_decks = [
            DeckSummary(deck_id=row[0], deck_name=row[1]) for row in decks_result.all()
        ]

        if not matched_decks:
            return DuplicateCheckResult(is_duplicate=False)

        return DuplicateCheckResult(
            is_duplicate=True,
            existing_entry=WordEntrySnapshot(
                id=entry.id,
                lemma=entry.lemma,
                part_of_speech=entry.part_of_speech.value,
                translation_en=entry.translation_en,
                translation_ru=entry.translation_ru,
                pronunciation=entry.pronunciation,
                grammar_data=entry.grammar_data,
                examples=entry.examples,
            ),
            matched_decks=matched_decks,
        )
