"""Unit tests for WordEntry model."""

from sqlalchemy import JSON, UniqueConstraint

from src.db.models import PartOfSpeech, WordEntry


class TestPartOfSpeechEnum:
    """Tests for PartOfSpeech enum."""

    def test_noun_value(self):
        """NOUN.value should equal 'noun'."""
        assert PartOfSpeech.NOUN.value == "noun"

    def test_verb_value(self):
        """VERB.value should equal 'verb'."""
        assert PartOfSpeech.VERB.value == "verb"

    def test_adjective_value(self):
        """ADJECTIVE.value should equal 'adjective'."""
        assert PartOfSpeech.ADJECTIVE.value == "adjective"

    def test_adverb_value(self):
        """ADVERB.value should equal 'adverb'."""
        assert PartOfSpeech.ADVERB.value == "adverb"

    def test_phrase_value(self):
        """PHRASE.value should equal 'phrase'."""
        assert PartOfSpeech.PHRASE.value == "phrase"

    def test_all_values(self):
        """All 5 PartOfSpeech values should be present."""
        values = [e.value for e in PartOfSpeech]
        assert len(values) == 5
        assert "noun" in values
        assert "verb" in values
        assert "adjective" in values
        assert "adverb" in values
        assert "phrase" in values


class TestWordEntryModel:
    """Tests for WordEntry model schema validation."""

    # =========================================================================
    # Table Structure Tests
    # =========================================================================

    def test_tablename(self):
        """Model should use correct table name."""
        assert WordEntry.__tablename__ == "word_entries"

    def test_has_all_columns(self):
        """Model should have all 13 expected columns."""
        columns = WordEntry.__table__.columns.keys()
        expected_columns = [
            "id",
            "deck_id",
            "lemma",
            "part_of_speech",
            "translation_en",
            "translation_ru",
            "pronunciation",
            "grammar_data",
            "examples",
            "audio_key",
            "is_active",
            "created_at",
            "updated_at",
        ]
        assert len(expected_columns) == 13
        for col in expected_columns:
            assert col in columns, f"Missing expected column: {col}"

    # =========================================================================
    # Primary Key Tests
    # =========================================================================

    def test_id_is_primary_key(self):
        """id column should be the primary key."""
        id_col = WordEntry.__table__.columns["id"]
        assert id_col.primary_key is True

    def test_id_has_server_default(self):
        """id column should have a server_default for UUID generation."""
        id_col = WordEntry.__table__.columns["id"]
        assert id_col.server_default is not None

    # =========================================================================
    # Required Fields (NOT NULL) Tests
    # =========================================================================

    def test_deck_id_not_nullable(self):
        """deck_id column should not be nullable."""
        deck_id_col = WordEntry.__table__.columns["deck_id"]
        assert deck_id_col.nullable is False

    def test_lemma_not_nullable(self):
        """lemma column should not be nullable."""
        lemma_col = WordEntry.__table__.columns["lemma"]
        assert lemma_col.nullable is False

    def test_part_of_speech_not_nullable(self):
        """part_of_speech column should not be nullable."""
        pos_col = WordEntry.__table__.columns["part_of_speech"]
        assert pos_col.nullable is False

    def test_translation_en_not_nullable(self):
        """translation_en column should not be nullable."""
        trans_col = WordEntry.__table__.columns["translation_en"]
        assert trans_col.nullable is False

    def test_is_active_not_nullable(self):
        """is_active column should not be nullable."""
        is_active_col = WordEntry.__table__.columns["is_active"]
        assert is_active_col.nullable is False

    # =========================================================================
    # Optional Fields (NULLABLE) Tests
    # =========================================================================

    def test_translation_ru_nullable(self):
        """translation_ru column should be nullable."""
        trans_col = WordEntry.__table__.columns["translation_ru"]
        assert trans_col.nullable is True

    def test_pronunciation_nullable(self):
        """pronunciation column should be nullable."""
        pron_col = WordEntry.__table__.columns["pronunciation"]
        assert pron_col.nullable is True

    def test_grammar_data_nullable(self):
        """grammar_data column should be nullable."""
        grammar_col = WordEntry.__table__.columns["grammar_data"]
        assert grammar_col.nullable is True

    def test_examples_nullable(self):
        """examples column should be nullable."""
        examples_col = WordEntry.__table__.columns["examples"]
        assert examples_col.nullable is True

    def test_audio_key_nullable(self):
        """audio_key column should be nullable."""
        audio_col = WordEntry.__table__.columns["audio_key"]
        assert audio_col.nullable is True

    # =========================================================================
    # String Length Tests
    # =========================================================================

    def test_lemma_max_length(self):
        """lemma column should have max length of 100."""
        lemma_col = WordEntry.__table__.columns["lemma"]
        assert lemma_col.type.length == 100

    def test_translation_en_max_length(self):
        """translation_en column should have max length of 500."""
        trans_col = WordEntry.__table__.columns["translation_en"]
        assert trans_col.type.length == 500

    def test_translation_ru_max_length(self):
        """translation_ru column should have max length of 500."""
        trans_col = WordEntry.__table__.columns["translation_ru"]
        assert trans_col.type.length == 500

    def test_pronunciation_max_length(self):
        """pronunciation column should have max length of 200."""
        pron_col = WordEntry.__table__.columns["pronunciation"]
        assert pron_col.type.length == 200

    def test_audio_key_max_length(self):
        """audio_key column should have max length of 500."""
        audio_col = WordEntry.__table__.columns["audio_key"]
        assert audio_col.type.length == 500

    # =========================================================================
    # Server Default Tests
    # =========================================================================

    def test_grammar_data_has_server_default(self):
        """grammar_data column should have server_default for empty dict."""
        grammar_col = WordEntry.__table__.columns["grammar_data"]
        assert grammar_col.server_default is not None

    def test_examples_has_server_default(self):
        """examples column should have server_default for empty list."""
        examples_col = WordEntry.__table__.columns["examples"]
        assert examples_col.server_default is not None

    def test_is_active_has_server_default(self):
        """is_active column should have server_default of true."""
        is_active_col = WordEntry.__table__.columns["is_active"]
        assert is_active_col.server_default is not None

    # =========================================================================
    # Foreign Key Tests
    # =========================================================================

    def test_deck_id_has_foreign_key(self):
        """deck_id should reference decks.id."""
        deck_id_col = WordEntry.__table__.columns["deck_id"]
        fk_list = list(deck_id_col.foreign_keys)
        assert len(fk_list) == 1
        fk = fk_list[0]
        assert str(fk.column) == "decks.id"

    def test_deck_id_cascade_on_delete(self):
        """deck_id foreign key should cascade on delete."""
        deck_id_col = WordEntry.__table__.columns["deck_id"]
        fk = list(deck_id_col.foreign_keys)[0]
        assert fk.ondelete == "CASCADE"

    # =========================================================================
    # Unique Constraint Tests
    # =========================================================================

    def test_unique_constraint_exists(self):
        """Should have unique constraint named uq_word_entry_deck_lemma_pos."""
        constraints = WordEntry.__table__.constraints
        unique_constraints = [c for c in constraints if isinstance(c, UniqueConstraint)]
        constraint_names = [uc.name for uc in unique_constraints]
        assert "uq_word_entry_deck_lemma_pos" in constraint_names

    def test_unique_constraint_columns(self):
        """Unique constraint should cover (deck_id, lemma, part_of_speech)."""
        constraints = WordEntry.__table__.constraints
        unique_constraints = [c for c in constraints if isinstance(c, UniqueConstraint)]

        found = False
        for uc in unique_constraints:
            if uc.name == "uq_word_entry_deck_lemma_pos":
                col_names = {c.name for c in uc.columns}
                assert col_names == {"deck_id", "lemma", "part_of_speech"}
                found = True
                break
        assert found, "Unique constraint uq_word_entry_deck_lemma_pos not found"

    # =========================================================================
    # Index Tests
    # =========================================================================

    def test_deck_id_index_exists(self):
        """deck_id should have an index."""
        indexes = WordEntry.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_word_entries_deck_id" in index_names

    def test_is_active_index_exists(self):
        """is_active should have an index."""
        indexes = WordEntry.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_word_entries_is_active" in index_names

    def test_lemma_index_exists(self):
        """lemma should have an index."""
        indexes = WordEntry.__table__.indexes
        index_names = [idx.name for idx in indexes]
        assert "ix_word_entries_lemma" in index_names

    # =========================================================================
    # JSON Column Type Tests
    # =========================================================================

    def test_grammar_data_column_type(self):
        """grammar_data should be JSON type."""
        grammar_col = WordEntry.__table__.columns["grammar_data"]
        assert isinstance(grammar_col.type, JSON)

    def test_examples_column_type(self):
        """examples should be JSON type."""
        examples_col = WordEntry.__table__.columns["examples"]
        assert isinstance(examples_col.type, JSON)

    # =========================================================================
    # Relationship Tests
    # =========================================================================

    def test_deck_relationship_exists(self):
        """WordEntry should have a deck relationship."""
        relationships = WordEntry.__mapper__.relationships
        assert "deck" in relationships.keys()

    # =========================================================================
    # TimestampMixin Tests
    # =========================================================================

    def test_created_at_exists(self):
        """Model should have created_at column from TimestampMixin."""
        columns = WordEntry.__table__.columns.keys()
        assert "created_at" in columns

    def test_updated_at_exists(self):
        """Model should have updated_at column from TimestampMixin."""
        columns = WordEntry.__table__.columns.keys()
        assert "updated_at" in columns

    def test_created_at_not_nullable(self):
        """created_at column should not be nullable."""
        created_col = WordEntry.__table__.columns["created_at"]
        assert created_col.nullable is False

    def test_updated_at_not_nullable(self):
        """updated_at column should not be nullable."""
        updated_col = WordEntry.__table__.columns["updated_at"]
        assert updated_col.nullable is False
