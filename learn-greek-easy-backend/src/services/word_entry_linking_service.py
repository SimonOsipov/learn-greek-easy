"""Service for linking word entries to decks with card generation."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DeckWordEntry, WordEntry
from src.services.card_generator_service import CardGeneratorService


class WordEntryLinkingService:
    """Service for linking/unlinking word entries to decks."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def link_word_to_deck(self, word_entry: WordEntry, deck_id: UUID) -> None:
        """Link a word entry to a deck and generate card records.

        Inserts a junction row and generates all card types for the deck.
        Caller is responsible for committing the transaction.

        Args:
            word_entry: The WordEntry to link.
            deck_id: UUID of the target deck.
        """
        junction = DeckWordEntry(
            word_entry_id=word_entry.id,
            deck_id=deck_id,
        )
        self.db.add(junction)
        await self.db.flush()

        card_service = CardGeneratorService(self.db)
        await card_service.generate_meaning_cards([word_entry], deck_id)
        await card_service.generate_plural_form_cards([word_entry], deck_id)
        await card_service.generate_sentence_translation_cards([word_entry], deck_id)
        await card_service.generate_article_cards([word_entry], deck_id)
        await self.db.flush()
