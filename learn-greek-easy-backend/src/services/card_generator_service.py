"""Card generation service for creating flashcard records from word entries."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import CardType, WordEntry
from src.repositories.card_record import CardRecordRepository
from src.schemas.card_record import (
    ExampleContext,
    MeaningElToEnBack,
    MeaningElToEnFront,
    MeaningEnToElBack,
    MeaningEnToElFront,
)

logger = get_logger(__name__)


class CardGeneratorService:
    """Service for generating card records from word entries.

    Builds structured front/back content for each card type and delegates
    persistence to CardRecordRepository.bulk_upsert(). Does NOT commit --
    caller is responsible for transaction management.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.card_record_repo = CardRecordRepository(db)

    async def generate_meaning_cards(
        self, word_entries: list[WordEntry], deck_id: UUID
    ) -> tuple[int, int]:
        """Generate meaning cards (el-to-en and en-to-el) for word entries.

        For each WordEntry, creates two card dicts:
        1. meaning_el_to_en -- Greek prompt, English answer
        2. meaning_en_to_el -- English prompt, Greek answer

        Both cards use variant_key="default", tier=1, is_active=True.

        Args:
            word_entries: List of WordEntry ORM objects to generate cards for.
            deck_id: UUID of the deck these cards belong to.

        Returns:
            Tuple of (created_count, updated_count) from bulk_upsert.

        Note:
            Does NOT commit. Caller must call db.commit() after.
        """
        card_dicts: list[dict] = []
        for we in word_entries:
            badge = we.part_of_speech.value.capitalize()

            context = None
            if we.examples and len(we.examples) > 0:
                first = we.examples[0]
                context = ExampleContext(
                    label="Example",
                    greek=first["greek"],
                    english=first["english"],
                    tense=None,
                )

            el_to_en_front = MeaningElToEnFront(
                card_type="meaning_el_to_en",
                prompt="What does this mean?",
                main=we.lemma,
                sub=we.pronunciation,
                badge=badge,
                hint=None,
            )
            el_to_en_back = MeaningElToEnBack(
                card_type="meaning_el_to_en",
                answer=we.translation_en,
                answer_sub=None,
                context=context,
            )
            card_dicts.append(
                {
                    "word_entry_id": we.id,
                    "deck_id": deck_id,
                    "card_type": CardType.MEANING_EL_TO_EN.value,
                    "variant_key": "default",
                    "tier": 1,
                    "front_content": el_to_en_front.model_dump(),
                    "back_content": el_to_en_back.model_dump(),
                    "is_active": True,
                }
            )

            en_to_el_front = MeaningEnToElFront(
                card_type="meaning_en_to_el",
                prompt="How do you say this in Greek?",
                main=we.translation_en,
                sub=None,
                badge=badge,
                hint=None,
            )
            en_to_el_back = MeaningEnToElBack(
                card_type="meaning_en_to_el",
                answer=we.lemma,
                answer_sub=we.pronunciation,
                context=context,
            )
            card_dicts.append(
                {
                    "word_entry_id": we.id,
                    "deck_id": deck_id,
                    "card_type": CardType.MEANING_EN_TO_EL.value,
                    "variant_key": "default",
                    "tier": 1,
                    "front_content": en_to_el_front.model_dump(),
                    "back_content": en_to_el_back.model_dump(),
                    "is_active": True,
                }
            )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated
