"""Unit tests for card error schemas (CER-43).

Tests cover CardErrorCardSnapshot and CardErrorDeckSnapshot serialization
for WORD and CULTURE variants, including the all-None case.
"""

from uuid import uuid4

import pytest

from src.schemas.card_error import CardErrorCardSnapshot, CardErrorDeckSnapshot


@pytest.mark.unit
class TestCardErrorCardSnapshotWord:
    """Tests for CardErrorCardSnapshot with WORD variant data."""

    def test_word_variant_all_fields(self):
        """WORD snapshot serializes all word-specific fields correctly."""
        snap = CardErrorCardSnapshot(
            word="γεια",
            gender="neuter",
            translation_en="hello",
            translation_ru="привет",
            ipa="ˈʝa",
            article="το",
            plural="γειες",
        )
        assert snap.word == "γεια"
        assert snap.gender == "neuter"
        assert snap.translation_en == "hello"
        assert snap.translation_ru == "привет"
        assert snap.ipa == "ˈʝa"
        assert snap.article == "το"
        assert snap.plural == "γειες"
        # CULTURE fields should default to None
        assert snap.question_en is None
        assert snap.question_el is None
        assert snap.options is None
        assert snap.correct_index is None
        assert snap.level is None

    def test_word_variant_minimal(self):
        """WORD snapshot with only required word field."""
        snap = CardErrorCardSnapshot(word="καλημέρα")
        assert snap.word == "καλημέρα"
        assert snap.translation_en is None
        assert snap.question_el is None

    def test_word_variant_round_trip(self):
        """WORD snapshot round-trips through model_dump."""
        snap = CardErrorCardSnapshot(word="νερό", translation_en="water")
        data = snap.model_dump()
        restored = CardErrorCardSnapshot(**data)
        assert restored.word == "νερό"
        assert restored.translation_en == "water"
        assert restored.question_en is None


@pytest.mark.unit
class TestCardErrorCardSnapshotCulture:
    """Tests for CardErrorCardSnapshot with CULTURE variant data."""

    def test_culture_variant_all_fields(self):
        """CULTURE snapshot serializes all culture-specific fields correctly."""
        snap = CardErrorCardSnapshot(
            question_en="What is the capital of Greece?",
            question_el="Ποια είναι η πρωτεύουσα της Ελλάδας;",
            options=["Athens", "Thessaloniki", "Heraklion"],
            correct_index=0,
            level="A1",
        )
        assert snap.question_en == "What is the capital of Greece?"
        assert snap.question_el == "Ποια είναι η πρωτεύουσα της Ελλάδας;"
        assert snap.options == ["Athens", "Thessaloniki", "Heraklion"]
        assert snap.correct_index == 0
        assert snap.level == "A1"
        # WORD fields should default to None
        assert snap.word is None
        assert snap.translation_en is None
        assert snap.gender is None

    def test_culture_variant_two_options(self):
        """CULTURE snapshot with minimum 2 options."""
        snap = CardErrorCardSnapshot(
            question_en="True or false?",
            options=["True", "False"],
            correct_index=1,
        )
        assert len(snap.options) == 2
        assert snap.correct_index == 1


@pytest.mark.unit
class TestCardErrorCardSnapshotAllNone:
    """Tests for CardErrorCardSnapshot with all fields None (orphan card)."""

    def test_all_none_round_trip(self):
        """All-None snapshot (orphan report) round-trips cleanly."""
        snap = CardErrorCardSnapshot()
        assert snap.word is None
        assert snap.question_en is None
        assert snap.options is None
        data = snap.model_dump()
        restored = CardErrorCardSnapshot(**data)
        assert restored.word is None
        assert restored.question_en is None


@pytest.mark.unit
class TestCardErrorDeckSnapshot:
    """Tests for CardErrorDeckSnapshot serialization."""

    def test_deck_snapshot_with_level(self):
        """Deck snapshot serializes id, name, and level."""
        deck_id = uuid4()
        snap = CardErrorDeckSnapshot(id=deck_id, name="Greek A1 Vocabulary", level="A1")
        assert snap.id == deck_id
        assert snap.name == "Greek A1 Vocabulary"
        assert snap.level == "A1"

    def test_deck_snapshot_no_level(self):
        """Deck snapshot without level defaults to None."""
        snap = CardErrorDeckSnapshot(id=uuid4(), name="Culture Deck")
        assert snap.name == "Culture Deck"
        assert snap.level is None

    def test_deck_snapshot_round_trip(self):
        """Deck snapshot round-trips through model_dump."""
        deck_id = uuid4()
        snap = CardErrorDeckSnapshot(id=deck_id, name="History", level="B1")
        data = snap.model_dump()
        restored = CardErrorDeckSnapshot(**data)
        assert restored.id == deck_id
        assert restored.name == "History"
        assert restored.level == "B1"
