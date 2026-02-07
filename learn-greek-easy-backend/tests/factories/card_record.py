"""CardRecord model factory.

Usage:
    # Create a default meaning card
    record = await CardRecordFactory.create(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
    )

    # Create a conjugation card with specific variant
    record = await CardRecordFactory.create(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        conjugation=True,
        variant_key="present_1s",
    )

    # Create an inactive card
    record = await CardRecordFactory.create(
        word_entry_id=word_entry.id,
        deck_id=deck.id,
        inactive=True,
    )
"""

import factory

from src.db.models import CardRecord, CardType
from tests.factories.base import BaseFactory


class CardRecordFactory(BaseFactory):
    """Factory for CardRecord model.

    Creates flashcard records with configurable card types and content.

    Required (must be set explicitly):
        word_entry_id: UUID of parent word entry
        deck_id: UUID of parent deck

    Traits:
        inactive: Sets is_active=False
        conjugation: Sets card_type to CONJUGATION with conjugation content
        declension: Sets card_type to DECLENSION with declension content
        cloze: Sets card_type to CLOZE with cloze content
        sentence_translation: Sets card_type to SENTENCE_TRANSLATION
        meaning_en_to_el: Sets card_type to MEANING_EN_TO_EL
    """

    class Meta:
        model = CardRecord

    # Required: Must be provided
    word_entry_id = None  # Must be set explicitly
    deck_id = None  # Must be set explicitly

    # Defaults
    card_type = CardType.MEANING_EL_TO_EN
    variant_key = factory.Sequence(lambda n: f"default_{n}")
    tier = None
    is_active = True

    # Default front/back content for MEANING_EL_TO_EN
    front_content = factory.LazyFunction(
        lambda: {
            "card_type": "meaning_el_to_en",
            "prompt": "What does this word mean?",
            "main": "λόγος",
            "badge": "A1",
        }
    )
    back_content = factory.LazyFunction(
        lambda: {
            "card_type": "meaning_el_to_en",
            "answer": "word, speech",
        }
    )

    class Params:
        """Factory traits for common variations."""

        inactive = factory.Trait(is_active=False)

        conjugation = factory.Trait(
            card_type=CardType.CONJUGATION,
            variant_key="present_1s",
            front_content={
                "card_type": "conjugation",
                "prompt": "Conjugate",
                "main": "γράφω",
                "badge": "B1",
                "tense": "present",
                "person": "1s",
            },
            back_content={
                "card_type": "conjugation",
                "answer": "γράφω",
                "conjugation_table": {
                    "tense": "present",
                    "rows": [
                        {"person": "1s", "form": "γράφω", "highlight": True},
                        {"person": "2s", "form": "γράφεις", "highlight": False},
                    ],
                },
            },
        )

        declension = factory.Trait(
            card_type=CardType.DECLENSION,
            variant_key="genitive_singular",
            front_content={
                "card_type": "declension",
                "prompt": "Decline",
                "main": "λόγος",
                "badge": "B1",
                "case": "genitive",
                "number": "singular",
            },
            back_content={
                "card_type": "declension",
                "answer": "λόγου",
                "declension_table": {
                    "gender": "masculine",
                    "rows": [
                        {
                            "case": "genitive",
                            "singular": "λόγου",
                            "plural": "λόγων",
                            "highlight_singular": True,
                            "highlight_plural": False,
                        },
                    ],
                },
            },
        )

        cloze = factory.Trait(
            card_type=CardType.CLOZE,
            variant_key="ex_abc123",
            front_content={
                "card_type": "cloze",
                "prompt": "Fill in the blank",
                "main": "Εγώ ___ ελληνικά",
                "badge": "A2",
                "missing_word": "μιλάω",
                "example_index": 0,
            },
            back_content={
                "card_type": "cloze",
                "answer": "μιλάω",
                "full_sentence": {
                    "greek": "Εγώ μιλάω ελληνικά",
                    "english": "I speak Greek",
                },
            },
        )

        sentence_translation = factory.Trait(
            card_type=CardType.SENTENCE_TRANSLATION,
            variant_key="default",
            front_content={
                "card_type": "sentence_translation",
                "prompt": "Translate this sentence",
                "main": "Καλημέρα σας!",
                "badge": "A1",
                "example_index": 0,
            },
            back_content={
                "card_type": "sentence_translation",
                "answer": "Good morning!",
            },
        )

        meaning_en_to_el = factory.Trait(
            card_type=CardType.MEANING_EN_TO_EL,
            variant_key="default",
            front_content={
                "card_type": "meaning_en_to_el",
                "prompt": "How do you say this in Greek?",
                "main": "word",
                "badge": "A1",
            },
            back_content={
                "card_type": "meaning_en_to_el",
                "answer": "λόγος",
            },
        )
