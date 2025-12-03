"""Greek vocabulary Faker provider for test data generation.

This provider extends Faker with Greek language content appropriate
for a Greek language learning application.
"""

import random
from typing import Any

from faker.providers import BaseProvider


class GreekProvider(BaseProvider):
    """Faker provider for Greek vocabulary content.

    Provides Greek words, phrases, and sentences organized by CEFR level.

    Usage:
        fake = Faker()
        fake.add_provider(GreekProvider)

        word = fake.greek_word()
        card = fake.greek_vocabulary_card()
    """

    # A1 Level - Basic Greetings and Essential Words
    A1_VOCABULARY: list[dict[str, Any]] = [
        {
            "front_text": "Yeia sou",
            "back_text": "Hello (informal)",
            "pronunciation": "YAH-soo",
            "example_sentence": "Yeia sou, ti kaneis?",
        },
        {
            "front_text": "Kalimera",
            "back_text": "Good morning",
            "pronunciation": "kah-lee-MEH-rah",
            "example_sentence": "Kalimera! Pos eiste?",
        },
        {
            "front_text": "Efcharisto",
            "back_text": "Thank you",
            "pronunciation": "ef-hah-ree-STO",
            "example_sentence": "Efcharisto poli!",
        },
        {
            "front_text": "Parakalo",
            "back_text": "Please / You're welcome",
            "pronunciation": "pah-rah-kah-LO",
            "example_sentence": "Parakalo, boroume na pame?",
        },
        {
            "front_text": "Nero",
            "back_text": "Water",
            "pronunciation": "neh-RO",
            "example_sentence": "Thelo ena nero, parakalo.",
        },
        {
            "front_text": "Psomi",
            "back_text": "Bread",
            "pronunciation": "pso-MEE",
            "example_sentence": "To psomi einai fresko.",
        },
        {
            "front_text": "Spiti",
            "back_text": "House / Home",
            "pronunciation": "SPEE-tee",
            "example_sentence": "To spiti mou einai mikro.",
        },
        {
            "front_text": "Ena",
            "back_text": "One",
            "pronunciation": "EH-nah",
            "example_sentence": "Ena kafe, parakalo.",
        },
        {
            "front_text": "Dio",
            "back_text": "Two",
            "pronunciation": "THEE-oh",
            "example_sentence": "Dio nero, parakalo.",
        },
        {
            "front_text": "Tria",
            "back_text": "Three",
            "pronunciation": "TREE-ah",
            "example_sentence": "Tria adelfia echo.",
        },
    ]

    # A2 Level - Daily Life and Common Verbs
    A2_VOCABULARY: list[dict[str, Any]] = [
        {
            "front_text": "Troo",
            "back_text": "I eat",
            "pronunciation": "TRO-oh",
            "example_sentence": "Troo proino stis okto.",
        },
        {
            "front_text": "Pino",
            "back_text": "I drink",
            "pronunciation": "PEE-no",
            "example_sentence": "Pino kafe kathe proi.",
        },
        {
            "front_text": "Douleo",
            "back_text": "I work",
            "pronunciation": "thoo-LEH-vo",
            "example_sentence": "Douleo se ena grafeio.",
        },
        {
            "front_text": "Oikogeneia",
            "back_text": "Family",
            "pronunciation": "ee-ko-YEH-nee-ah",
            "example_sentence": "I oikogeneia mou einai megali.",
        },
        {
            "front_text": "Filo",
            "back_text": "Friend",
            "pronunciation": "FEE-lo",
            "example_sentence": "O Yiannis einai o filo mou.",
        },
    ]

    # B1 Level - Abstract Concepts
    B1_VOCABULARY: list[dict[str, Any]] = [
        {
            "front_text": "Agapi",
            "back_text": "Love",
            "pronunciation": "ah-GAH-pee",
            "example_sentence": "I agapi einai to pio simantiko pragma.",
        },
        {
            "front_text": "Elpida",
            "back_text": "Hope",
            "pronunciation": "el-PEE-thah",
            "example_sentence": "Echo elpida gia to mellon.",
        },
        {
            "front_text": "Epistimi",
            "back_text": "Science",
            "pronunciation": "eh-pee-STEE-mee",
            "example_sentence": "I epistimi proodeui synechos.",
        },
        {
            "front_text": "Politismos",
            "back_text": "Culture / Civilization",
            "pronunciation": "po-lee-tee-SMOS",
            "example_sentence": "O ellinikos politismos einai archaios.",
        },
        {
            "front_text": "Dimokratia",
            "back_text": "Democracy",
            "pronunciation": "thee-mo-krah-TEE-ah",
            "example_sentence": "I dimokratia gennithike stin Athina.",
        },
    ]

    VOCABULARY_BY_LEVEL = {
        "A1": A1_VOCABULARY,
        "A2": A2_VOCABULARY,
        "B1": B1_VOCABULARY,
    }

    def greek_word(self, level: str = "A1") -> str:
        """Generate a random Greek word for the given CEFR level.

        Args:
            level: CEFR level (A1, A2, B1)

        Returns:
            str: Greek word (front_text)
        """
        vocab_list = self.VOCABULARY_BY_LEVEL.get(level, self.A1_VOCABULARY)
        return random.choice(vocab_list)["front_text"]

    def greek_translation(self, level: str = "A1") -> str:
        """Generate a random English translation for the given CEFR level.

        Args:
            level: CEFR level (A1, A2, B1)

        Returns:
            str: English translation (back_text)
        """
        vocab_list = self.VOCABULARY_BY_LEVEL.get(level, self.A1_VOCABULARY)
        return random.choice(vocab_list)["back_text"]

    def greek_pronunciation(self, level: str = "A1") -> str:
        """Generate a random pronunciation guide for the given CEFR level.

        Args:
            level: CEFR level (A1, A2, B1)

        Returns:
            str: Phonetic pronunciation
        """
        vocab_list = self.VOCABULARY_BY_LEVEL.get(level, self.A1_VOCABULARY)
        return random.choice(vocab_list)["pronunciation"]

    def greek_example_sentence(self, level: str = "A1") -> str:
        """Generate a random example sentence for the given CEFR level.

        Args:
            level: CEFR level (A1, A2, B1)

        Returns:
            str: Example sentence in Greek
        """
        vocab_list = self.VOCABULARY_BY_LEVEL.get(level, self.A1_VOCABULARY)
        return random.choice(vocab_list)["example_sentence"]

    def greek_vocabulary_card(self, level: str = "A1") -> dict[str, Any]:
        """Generate a complete vocabulary card dictionary.

        Args:
            level: CEFR level (A1, A2, B1)

        Returns:
            dict: Complete card data with front_text, back_text, etc.
        """
        vocab_list = self.VOCABULARY_BY_LEVEL.get(level, self.A1_VOCABULARY)
        return random.choice(vocab_list).copy()

    def deck_name(self, level: str = "A1") -> str:
        """Generate a deck name for the given CEFR level.

        Args:
            level: CEFR level (A1-C2)

        Returns:
            str: Deck name
        """
        prefixes = ["Greek", "Essential Greek", "Learn Greek", "Greek Vocabulary"]
        suffixes = ["Basics", "Vocabulary", "Words", "Phrases", "Essentials"]

        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)

        return f"{prefix} {level} - {suffix}"

    def deck_description(self, level: str = "A1") -> str:
        """Generate a deck description for the given CEFR level.

        Args:
            level: CEFR level (A1-C2)

        Returns:
            str: Deck description
        """
        descriptions = {
            "A1": "Essential Greek words and phrases for beginners. Start your Greek journey here!",
            "A2": "Elementary Greek vocabulary for daily life situations.",
            "B1": "Intermediate Greek vocabulary and expressions for confident communication.",
            "B2": "Upper-intermediate Greek for advanced learners.",
            "C1": "Advanced Greek vocabulary, idioms, and complex expressions.",
            "C2": "Near-native Greek proficiency vocabulary and nuanced expressions.",
        }
        return descriptions.get(level, descriptions["A1"])
