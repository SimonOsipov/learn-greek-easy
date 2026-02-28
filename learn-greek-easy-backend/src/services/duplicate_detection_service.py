"""Cross-deck duplicate detection service for word entries."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import Deck, PartOfSpeech, WordEntry
from src.schemas.nlp import DuplicateCheckResult, WordEntrySnapshot

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
        exclude_deck_id: UUID | None = None,
    ) -> DuplicateCheckResult:
        """Check if a lemma+POS combination exists in any deck.

        Args:
            lemma: Normalized lemma to search for.
            part_of_speech: Part of speech (same lemma with different POS is NOT a duplicate).
            exclude_deck_id: Optional deck ID to exclude from search (e.g., the target deck).

        Returns:
            DuplicateCheckResult with is_duplicate=True and match details if found,
            or is_duplicate=False with no match details.
        """
        query = (
            select(WordEntry, Deck.name_en)
            .join(Deck, WordEntry.deck_id == Deck.id)
            .where(
                func.immutable_unaccent(WordEntry.lemma) == func.immutable_unaccent(lemma),
                WordEntry.part_of_speech == part_of_speech,
                WordEntry.is_active.is_(True),
            )
            .order_by(WordEntry.created_at.asc())
            .limit(1)
        )

        if exclude_deck_id is not None:
            query = query.where(WordEntry.deck_id != exclude_deck_id)

        result = await self.db.execute(query)
        row = result.first()

        if row is None:
            return DuplicateCheckResult(is_duplicate=False)

        entry, deck_name = row
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
            matched_deck_id=entry.deck_id,
            matched_deck_name=deck_name,
        )
