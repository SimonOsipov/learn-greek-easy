"""Card generation service for creating flashcard records from word entries."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import CardType, PartOfSpeech, WordEntry
from src.repositories.card_record import CardRecordRepository
from src.schemas.card_record import (
    ExampleContext,
    MeaningElToEnBack,
    MeaningElToEnFront,
    MeaningEnToElBack,
    MeaningEnToElFront,
    PluralFormBack,
    PluralFormFront,
)

logger = get_logger(__name__)


def _safe_get(d: dict, *keys: str) -> str | None:
    """Safely traverse nested dict keys, returning None if any key is missing or value is empty."""
    current: object = d
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None
    if isinstance(current, str) and current.strip():
        return current
    return None


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

    def _build_plural_card_dict(
        self,
        we: WordEntry,
        deck_id: UUID,
        variant_key: str,
        *,
        prompt: str,
        main: str,
        sub: str | None,
        badge: str,
        hint: str,
        answer: str,
        answer_sub: str | None,
    ) -> dict:
        """Build a card dict for a plural form card."""
        front = PluralFormFront(
            card_type="plural_form",
            prompt=prompt,
            main=main,
            sub=sub,
            badge=badge,
            hint=hint,
        )
        back = PluralFormBack(
            card_type="plural_form",
            answer=answer,
            answer_sub=answer_sub,
        )
        return {
            "word_entry_id": we.id,
            "deck_id": deck_id,
            "card_type": CardType.PLURAL_FORM.value,
            "variant_key": variant_key,
            "tier": 1,
            "front_content": front.model_dump(),
            "back_content": back.model_dump(),
            "is_active": True,
        }

    async def generate_plural_form_cards(
        self, word_entries: list[WordEntry], deck_id: UUID
    ) -> tuple[int, int]:
        """Generate plural form flashcards for nouns and adjectives.

        For nouns: generates sg->pl and pl->sg cards using nominative forms.
        For adjectives: generates sg->pl and pl->sg cards per gender (masc, fem, neut).

        Args:
            word_entries: List of WordEntry objects to generate cards from
            deck_id: UUID of the deck to associate cards with

        Returns:
            Tuple of (created_count, updated_count) from bulk upsert
        """
        card_dicts: list[dict] = []

        for we in word_entries:
            gd = we.grammar_data
            if not gd:
                continue

            if we.part_of_speech == PartOfSpeech.NOUN:
                sg = _safe_get(gd, "cases", "singular", "nominative")
                pl = _safe_get(gd, "cases", "plural", "nominative")
                if not sg or not pl:
                    continue

                # sg -> pl card
                card_dicts.append(
                    self._build_plural_card_dict(
                        we,
                        deck_id,
                        "sg_to_pl",
                        prompt="What is the plural form?",
                        main=sg,
                        sub=None,
                        badge="Noun",
                        hint=we.translation_en,
                        answer=pl,
                        answer_sub=None,
                    )
                )
                # pl -> sg card
                card_dicts.append(
                    self._build_plural_card_dict(
                        we,
                        deck_id,
                        "pl_to_sg",
                        prompt="What is the singular form?",
                        main=pl,
                        sub=None,
                        badge="Noun",
                        hint=we.translation_en,
                        answer=sg,
                        answer_sub=None,
                    )
                )

            elif we.part_of_speech == PartOfSpeech.ADJECTIVE:
                GENDERS = [
                    ("masculine", "Masc."),
                    ("feminine", "Fem."),
                    ("neuter", "Neut."),
                ]
                for gender_key, gender_abbrev in GENDERS:
                    sg = _safe_get(gd, "forms", gender_key, "singular", "nominative")
                    pl = _safe_get(gd, "forms", gender_key, "plural", "nominative")
                    if not sg or not pl:
                        continue

                    badge = f"Adj. {gender_abbrev}"

                    # sg -> pl card
                    card_dicts.append(
                        self._build_plural_card_dict(
                            we,
                            deck_id,
                            f"sg_to_pl_{gender_key}",
                            prompt="What is the plural form?",
                            main=sg,
                            sub=gender_key,
                            badge=badge,
                            hint=we.translation_en,
                            answer=pl,
                            answer_sub=None,
                        )
                    )
                    # pl -> sg card
                    card_dicts.append(
                        self._build_plural_card_dict(
                            we,
                            deck_id,
                            f"pl_to_sg_{gender_key}",
                            prompt="What is the singular form?",
                            main=pl,
                            sub=gender_key,
                            badge=badge,
                            hint=we.translation_en,
                            answer=sg,
                            answer_sub=None,
                        )
                    )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated
