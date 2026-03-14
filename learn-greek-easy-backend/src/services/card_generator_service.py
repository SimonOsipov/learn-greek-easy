"""Card generation service for creating flashcard records from word entries."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import CardType, PartOfSpeech, WordEntry
from src.repositories.card_record import CardRecordRepository
from src.schemas.card_record import (
    ArticleBack,
    ArticleFront,
    DeclensionBack,
    DeclensionFront,
    DeclensionRow,
    DeclensionTable,
    ExampleContext,
    MeaningElToEnBack,
    MeaningElToEnFront,
    MeaningEnToElBack,
    MeaningEnToElFront,
    PluralFormBack,
    PluralFormFront,
    SentenceTranslationBack,
    SentenceTranslationFront,
)

logger = get_logger(__name__)

GENDER_LABELS = {
    "masculine": ("Masculine", "Мужской род"),
    "feminine": ("Feminine", "Женский род"),
    "neuter": ("Neuter", "Средний род"),
}

CASE_LABELS = {
    "nominative": "Nominative",
    "genitive": "Genitive",
    "accusative": "Accusative",
    "vocative": "Vocative",
}

DECLENSION_CASES = ["genitive", "accusative", "vocative"]
DECLENSION_NUMBERS = ["singular", "plural"]


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

            # Get word with article (for nouns) or plain lemma (for other parts of speech)
            word_with_article = we.lemma
            if we.grammar_data and isinstance(we.grammar_data, dict):
                # Try to get nominative form with article (for nouns)
                nominative = we.grammar_data.get("nominative_singular")
                if nominative:
                    word_with_article = nominative

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
                main=word_with_article,
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
                answer=word_with_article,
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
        hint_ru: str | None,
        answer: str,
        answer_sub: str | None,
        answer_sub_ru: str | None,
    ) -> dict:
        """Build a card dict for a plural form card."""
        front = PluralFormFront(
            card_type="plural_form",
            prompt=prompt,
            main=main,
            sub=sub,
            badge=badge,
            hint=hint,
            hint_ru=hint_ru,
        )
        back = PluralFormBack(
            card_type="plural_form",
            answer=answer,
            answer_sub=answer_sub,
            answer_sub_ru=answer_sub_ru,
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

    def _build_article_card_dict(
        self,
        we: WordEntry,
        deck_id: UUID,
        variant_key: str,
        *,
        prompt: str,
        main: str,
        sub: str | None,
        badge: str,
        hint: str | None,
        answer: str,
        answer_sub: str | None,
        gender: str,
        gender_ru: str | None,
    ) -> dict:
        """Build a card dict for an article card."""
        front = ArticleFront(
            card_type="article",
            prompt=prompt,
            main=main,
            sub=sub,
            badge=badge,
            hint=hint,
        )
        back = ArticleBack(
            card_type="article",
            answer=answer,
            answer_sub=answer_sub,
            gender=gender,
            gender_ru=gender_ru,
        )
        return {
            "word_entry_id": we.id,
            "deck_id": deck_id,
            "card_type": CardType.ARTICLE.value,
            "variant_key": variant_key,
            "tier": 1,
            "front_content": front.model_dump(),
            "back_content": back.model_dump(),
            "is_active": True,
        }

    def _build_sentence_translation_card_dict(
        self,
        we: WordEntry,
        deck_id: UUID,
        variant_key: str,
        example_id: str,
        *,
        prompt: str,
        main: str,
        sub: str | None,
        badge: str,
        hint: str | None,
        answer: str,
        answer_sub: str | None,
        answer_ru: str | None,
        direction: str,
    ) -> dict:
        """Build a card dict for a sentence translation card."""
        front = SentenceTranslationFront(
            card_type="sentence_translation",
            prompt=prompt,
            main=main,
            sub=sub,
            badge=badge,
            hint=hint,
            example_id=example_id,
            direction=direction,
        )
        back = SentenceTranslationBack(
            card_type="sentence_translation",
            answer=answer,
            answer_sub=answer_sub,
            answer_ru=answer_ru,
            context=None,
        )
        return {
            "word_entry_id": we.id,
            "deck_id": deck_id,
            "card_type": CardType.SENTENCE_TRANSLATION.value,
            "variant_key": variant_key,
            "tier": 1,
            "front_content": front.model_dump(),
            "back_content": back.model_dump(),
            "is_active": True,
        }

    def _build_declension_card_dict(
        self,
        we: WordEntry,
        deck_id: UUID,
        variant_key: str,
        *,
        prompt: str,
        main: str,
        sub: str | None,
        badge: str,
        hint: str | None,
        hint_ru: str | None,
        case: str,
        number: str,
        answer: str,
        declension_table: DeclensionTable,
    ) -> dict:
        """Build a card dict for a declension card."""
        front = DeclensionFront(
            card_type="declension",
            prompt=prompt,
            main=main,
            sub=sub,
            badge=badge,
            hint=hint,
            hint_ru=hint_ru,
            case=case,
            number=number,
        )
        back = DeclensionBack(
            card_type="declension",
            answer=answer,
            declension_table=declension_table,
        )
        return {
            "word_entry_id": we.id,
            "deck_id": deck_id,
            "card_type": CardType.DECLENSION.value,
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
                sg = gd.get("nominative_singular")
                pl = gd.get("nominative_plural")
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
                        hint_ru=we.translation_ru,
                        answer=pl,
                        answer_sub=we.translation_en_plural,
                        answer_sub_ru=we.translation_ru_plural,
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
                        hint=we.translation_en_plural or we.translation_en,
                        hint_ru=we.translation_ru_plural or we.translation_ru,
                        answer=sg,
                        answer_sub=we.translation_en,
                        answer_sub_ru=we.translation_ru,
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
                            hint_ru=we.translation_ru,
                            answer=pl,
                            answer_sub=we.translation_en_plural,
                            answer_sub_ru=we.translation_ru_plural,
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
                            hint=we.translation_en_plural or we.translation_en,
                            hint_ru=we.translation_ru_plural or we.translation_ru,
                            answer=sg,
                            answer_sub=we.translation_en,
                            answer_sub_ru=we.translation_ru,
                        )
                    )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated

    async def generate_article_cards(
        self, word_entries: list[WordEntry], deck_id: UUID
    ) -> tuple[int, int]:
        """Generate article flashcards for nouns with gender data.

        For each noun WordEntry that has grammar_data with a non-empty
        "gender" field and nominative singular case form, generates one
        article card testing knowledge of the correct Greek article.

        Args:
            word_entries: List of WordEntry objects to generate cards from
            deck_id: UUID of the deck to associate cards with

        Returns:
            Tuple of (created_count, updated_count) from bulk upsert

        Note:
            Does NOT commit. Caller must call db.commit() after.
        """
        card_dicts: list[dict] = []

        for we in word_entries:
            gd = we.grammar_data
            if not gd:
                continue

            if we.part_of_speech != PartOfSpeech.NOUN:
                continue

            gender = _safe_get(gd, "gender")
            if not gender:
                continue

            nom_sg = gd.get("nominative_singular")
            if not nom_sg:
                continue

            labels = GENDER_LABELS.get(gender)
            if not labels:
                continue

            gender_en, gender_ru = labels

            card_dicts.append(
                self._build_article_card_dict(
                    we,
                    deck_id,
                    "default",
                    prompt="What is the article?",
                    main=f"___ {we.lemma}",
                    sub=we.translation_en,
                    badge="Noun",
                    hint=None,
                    answer=nom_sg,
                    answer_sub=None,
                    gender=gender_en,
                    gender_ru=gender_ru,
                )
            )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated

    async def generate_sentence_translation_cards(
        self, word_entries: list[WordEntry], deck_id: UUID
    ) -> tuple[int, int]:
        """Generate sentence translation flashcards from word entry examples.

        For each WordEntry, iterates over its examples list and creates two cards
        per example that has a non-null, non-empty id field:
        1. el_to_target -- Greek sentence prompt, English answer (+ Russian)
        2. target_to_el -- English sentence prompt, Greek answer

        Examples without an id field are silently skipped.

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
            if not we.examples:
                continue

            for example in we.examples:
                example_id = example.get("id")
                if not example_id:
                    continue

                greek = example.get("greek", "")
                english = example.get("english", "")
                russian = example.get("russian")

                if not greek or not english:
                    continue

                # Card 1: el_to_target (Greek -> English)
                card_dicts.append(
                    self._build_sentence_translation_card_dict(
                        we,
                        deck_id,
                        f"el_to_target_{example_id}",
                        example_id,
                        prompt="Translate this sentence",
                        main=greek,
                        sub=None,
                        badge="Sentence",
                        hint=None,
                        answer=english,
                        answer_sub=None,
                        answer_ru=russian,
                        direction="el_to_target",
                    )
                )

                # Card 2: target_to_el (English -> Greek)
                card_dicts.append(
                    self._build_sentence_translation_card_dict(
                        we,
                        deck_id,
                        f"target_to_el_{example_id}",
                        example_id,
                        prompt="Translate to Greek",
                        main=english,
                        sub=None,
                        badge="Sentence",
                        hint=None,
                        answer=greek,
                        answer_sub=None,
                        answer_ru=None,
                        direction="target_to_el",
                    )
                )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated

    @staticmethod
    def _build_declension_base_rows(gd: dict) -> list[DeclensionRow]:
        """Build 4 unhighlighted DeclensionRow objects from flat grammar_data."""
        all_cases = ["nominative", "genitive", "accusative", "vocative"]
        rows = []
        for case_name in all_cases:
            sg_form = gd.get(f"{case_name}_singular") or "—"
            pl_form = gd.get(f"{case_name}_plural") or "—"
            rows.append(
                DeclensionRow(
                    case=CASE_LABELS[case_name],
                    singular=sg_form,
                    plural=pl_form,
                    highlight_singular=False,
                    highlight_plural=False,
                )
            )
        return rows

    @staticmethod
    def _highlight_declension_rows(
        base_rows: list[DeclensionRow], row_idx: int, number: str
    ) -> list[DeclensionRow]:
        """Return a copy of base_rows with one cell highlighted."""
        highlighted = []
        for i, row in enumerate(base_rows):
            if i == row_idx:
                highlighted.append(
                    DeclensionRow(
                        case=row.case,
                        singular=row.singular,
                        plural=row.plural,
                        highlight_singular=(number == "singular"),
                        highlight_plural=(number == "plural"),
                    )
                )
            else:
                highlighted.append(row)
        return highlighted

    def _build_declension_cards_for_entry(
        self,
        we: WordEntry,
        deck_id: UUID,
        gd: dict,
        gender_en: str,
        nom_sg: str,
        base_rows: list[DeclensionRow],
    ) -> list[dict]:
        """Build all declension card dicts for a single noun entry."""
        case_row_index = {"nominative": 0, "genitive": 1, "accusative": 2, "vocative": 3}
        cards: list[dict] = []
        for case_name in DECLENSION_CASES:
            for number in DECLENSION_NUMBERS:
                form = gd.get(f"{case_name}_{number}")
                if not form:
                    continue
                row_idx = case_row_index[case_name]
                highlighted_rows = self._highlight_declension_rows(base_rows, row_idx, number)
                declension_table = DeclensionTable(gender=gender_en, rows=highlighted_rows)
                cards.append(
                    self._build_declension_card_dict(
                        we,
                        deck_id,
                        f"nominative_to_{case_name}_{number}",
                        prompt=f"What is the {case_name} {number}?",
                        main=nom_sg,
                        sub=we.pronunciation,
                        badge="Noun",
                        hint=we.translation_en,
                        hint_ru=we.translation_ru,
                        case=case_name,
                        number=number,
                        answer=form,
                        declension_table=declension_table,
                    )
                )
        return cards

    async def generate_declension_cards(
        self, word_entries: list[WordEntry], deck_id: UUID
    ) -> tuple[int, int]:
        """Generate declension flashcards for nouns with case data.

        For each noun WordEntry that has grammar_data with a non-empty
        "gender" field and nominative singular form, generates up to 6
        cards testing knowledge of non-nominative case+number combinations
        (genitive, accusative, vocative x singular, plural).

        Args:
            word_entries: List of WordEntry objects to generate cards from
            deck_id: UUID of the deck to associate cards with

        Returns:
            Tuple of (created_count, updated_count) from bulk upsert

        Note:
            Does NOT commit. Caller must call db.commit() after.
        """
        card_dicts: list[dict] = []

        for we in word_entries:
            gd = we.grammar_data
            if not gd:
                continue
            if we.part_of_speech != PartOfSpeech.NOUN:
                continue
            gender = gd.get("gender")
            if not gender:
                continue
            nom_sg = gd.get("nominative_singular")
            if not nom_sg:
                continue
            labels = GENDER_LABELS.get(gender)
            if not labels:
                continue
            gender_en, _gender_ru = labels
            base_rows = self._build_declension_base_rows(gd)
            card_dicts.extend(
                self._build_declension_cards_for_entry(
                    we, deck_id, gd, gender_en, nom_sg, base_rows
                )
            )

        _records, created, updated = await self.card_record_repo.bulk_upsert(card_dicts)
        return created, updated
