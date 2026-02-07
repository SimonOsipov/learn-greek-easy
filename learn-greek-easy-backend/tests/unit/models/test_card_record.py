"""Unit tests for CardRecord model."""

from sqlalchemy import JSON, UniqueConstraint

from src.db.models import CardRecord, CardType


class TestCardTypeEnum:
    """Tests for CardType enum."""

    def test_meaning_el_to_en_value(self):
        """MEANING_EL_TO_EN.value should equal 'meaning_el_to_en'."""
        assert CardType.MEANING_EL_TO_EN.value == "meaning_el_to_en"

    def test_meaning_en_to_el_value(self):
        """MEANING_EN_TO_EL.value should equal 'meaning_en_to_el'."""
        assert CardType.MEANING_EN_TO_EL.value == "meaning_en_to_el"

    def test_conjugation_value(self):
        """CONJUGATION.value should equal 'conjugation'."""
        assert CardType.CONJUGATION.value == "conjugation"

    def test_declension_value(self):
        """DECLENSION.value should equal 'declension'."""
        assert CardType.DECLENSION.value == "declension"

    def test_cloze_value(self):
        """CLOZE.value should equal 'cloze'."""
        assert CardType.CLOZE.value == "cloze"

    def test_sentence_translation_value(self):
        """SENTENCE_TRANSLATION.value should equal 'sentence_translation'."""
        assert CardType.SENTENCE_TRANSLATION.value == "sentence_translation"

    def test_all_values(self):
        """All 6 CardType values should be present."""
        values = [e.value for e in CardType]
        assert len(values) == 6
        assert "meaning_el_to_en" in values
        assert "meaning_en_to_el" in values
        assert "conjugation" in values
        assert "declension" in values
        assert "cloze" in values
        assert "sentence_translation" in values


class TestCardRecordModel:
    """Tests for CardRecord model schema validation."""

    # =========================================================================
    # Table Structure Tests
    # =========================================================================

    def test_tablename(self):
        """Model should use correct table name."""
        assert CardRecord.__tablename__ == "card_records"

    def test_has_all_columns(self):
        """Model should have all 11 expected columns."""
        columns = CardRecord.__table__.columns.keys()
        expected_columns = [
            "id",
            "word_entry_id",
            "deck_id",
            "card_type",
            "tier",
            "variant_key",
            "front_content",
            "back_content",
            "is_active",
            "created_at",
            "updated_at",
        ]
        assert len(expected_columns) == 11
        for col in expected_columns:
            assert col in columns, f"Missing expected column: {col}"

    # =========================================================================
    # Primary Key Tests
    # =========================================================================

    def test_id_is_primary_key(self):
        """id column should be the primary key."""
        id_col = CardRecord.__table__.columns["id"]
        assert id_col.primary_key is True

    def test_id_has_server_default(self):
        """id column should have a server_default for UUID generation."""
        id_col = CardRecord.__table__.columns["id"]
        assert id_col.server_default is not None

    # =========================================================================
    # Required Fields (NOT NULL) Tests
    # =========================================================================

    def test_word_entry_id_not_nullable(self):
        """word_entry_id column should not be nullable."""
        col = CardRecord.__table__.columns["word_entry_id"]
        assert col.nullable is False

    def test_deck_id_not_nullable(self):
        """deck_id column should not be nullable."""
        col = CardRecord.__table__.columns["deck_id"]
        assert col.nullable is False

    def test_card_type_not_nullable(self):
        """card_type column should not be nullable."""
        col = CardRecord.__table__.columns["card_type"]
        assert col.nullable is False

    def test_front_content_not_nullable(self):
        """front_content column should not be nullable."""
        col = CardRecord.__table__.columns["front_content"]
        assert col.nullable is False

    def test_back_content_not_nullable(self):
        """back_content column should not be nullable."""
        col = CardRecord.__table__.columns["back_content"]
        assert col.nullable is False

    def test_is_active_not_nullable(self):
        """is_active column should not be nullable."""
        col = CardRecord.__table__.columns["is_active"]
        assert col.nullable is False

    # =========================================================================
    # Optional Fields (NULLABLE) Tests
    # =========================================================================

    def test_tier_nullable(self):
        """tier column should be nullable."""
        col = CardRecord.__table__.columns["tier"]
        assert col.nullable is True

    # =========================================================================
    # Server Default Tests
    # =========================================================================

    def test_is_active_has_server_default(self):
        """is_active column should have server_default of true."""
        col = CardRecord.__table__.columns["is_active"]
        assert col.server_default is not None

    # =========================================================================
    # Foreign Key Tests
    # =========================================================================

    def test_word_entry_id_has_foreign_key(self):
        """word_entry_id should reference word_entries.id."""
        col = CardRecord.__table__.columns["word_entry_id"]
        fk_list = list(col.foreign_keys)
        assert len(fk_list) == 1
        fk = fk_list[0]
        assert str(fk.column) == "word_entries.id"

    def test_word_entry_id_cascade_on_delete(self):
        """word_entry_id foreign key should cascade on delete."""
        col = CardRecord.__table__.columns["word_entry_id"]
        fk = list(col.foreign_keys)[0]
        assert fk.ondelete == "CASCADE"

    def test_deck_id_has_foreign_key(self):
        """deck_id should reference decks.id."""
        col = CardRecord.__table__.columns["deck_id"]
        fk_list = list(col.foreign_keys)
        assert len(fk_list) == 1
        fk = fk_list[0]
        assert str(fk.column) == "decks.id"

    def test_deck_id_cascade_on_delete(self):
        """deck_id foreign key should cascade on delete."""
        col = CardRecord.__table__.columns["deck_id"]
        fk = list(col.foreign_keys)[0]
        assert fk.ondelete == "CASCADE"

    # =========================================================================
    # Unique Constraint Tests
    # =========================================================================

    def test_unique_constraint_exists(self):
        """Should have unique constraint named uq_card_record_entry_type_variant."""
        constraints = CardRecord.__table__.constraints
        unique_constraints = [c for c in constraints if isinstance(c, UniqueConstraint)]
        constraint_names = [uc.name for uc in unique_constraints]
        assert "uq_card_record_entry_type_variant" in constraint_names

    def test_unique_constraint_columns(self):
        """Unique constraint should cover (word_entry_id, card_type, variant_key)."""
        constraints = CardRecord.__table__.constraints
        unique_constraints = [c for c in constraints if isinstance(c, UniqueConstraint)]

        found = False
        for uc in unique_constraints:
            if uc.name == "uq_card_record_entry_type_variant":
                col_names = {c.name for c in uc.columns}
                assert col_names == {"word_entry_id", "card_type", "variant_key"}
                found = True
                break
        assert found, "Unique constraint uq_card_record_entry_type_variant not found"

    # =========================================================================
    # Index Tests
    # =========================================================================

    def test_word_entry_id_index_exists(self):
        """word_entry_id should have an index."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_word_entry_id" in index_names

    def test_deck_id_index_exists(self):
        """deck_id should have an index."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_deck_id" in index_names

    def test_card_type_index_exists(self):
        """card_type should have an index."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_card_type" in index_names

    def test_is_active_index_exists(self):
        """is_active should have an index."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_is_active" in index_names

    def test_tier_index_exists(self):
        """tier should have an index."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_tier" in index_names

    def test_deck_type_composite_index_exists(self):
        """Composite index on (deck_id, card_type) should exist."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_deck_type" in index_names

    def test_deck_active_composite_index_exists(self):
        """Composite index on (deck_id, is_active) should exist."""
        indexes = CardRecord.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_card_records_deck_active" in index_names

    # =========================================================================
    # JSON Column Type Tests
    # =========================================================================

    def test_front_content_column_type(self):
        """front_content should be JSON type."""
        col = CardRecord.__table__.columns["front_content"]
        assert isinstance(col.type, JSON)

    def test_back_content_column_type(self):
        """back_content should be JSON type."""
        col = CardRecord.__table__.columns["back_content"]
        assert isinstance(col.type, JSON)

    # =========================================================================
    # Relationship Tests
    # =========================================================================

    def test_word_entry_relationship_exists(self):
        """CardRecord should have a word_entry relationship."""
        relationships = CardRecord.__mapper__.relationships
        assert "word_entry" in relationships.keys()

    def test_deck_relationship_exists(self):
        """CardRecord should have a deck relationship."""
        relationships = CardRecord.__mapper__.relationships
        assert "deck" in relationships.keys()

    # =========================================================================
    # TimestampMixin Tests
    # =========================================================================

    def test_created_at_exists(self):
        """Model should have created_at column from TimestampMixin."""
        columns = CardRecord.__table__.columns.keys()
        assert "created_at" in columns

    def test_updated_at_exists(self):
        """Model should have updated_at column from TimestampMixin."""
        columns = CardRecord.__table__.columns.keys()
        assert "updated_at" in columns

    def test_created_at_not_nullable(self):
        """created_at column should not be nullable."""
        col = CardRecord.__table__.columns["created_at"]
        assert col.nullable is False

    def test_updated_at_not_nullable(self):
        """updated_at column should not be nullable."""
        col = CardRecord.__table__.columns["updated_at"]
        assert col.nullable is False
