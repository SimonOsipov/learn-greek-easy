"""Unit tests for the WordProposal model (LEXGEN-01-01).

Descriptive introspection tests that lock the schema contract: column set,
types/nullability, the two lowercase Postgres enums, the three indexes, and the
two SET NULL foreign keys. POS-neutrality is asserted negatively (no gender
column, pos is free-text Text). These are NOT RED-driving — the oracle is
`alembic upgrade head` + `alembic check` + CI; these pin the model surface so a
later subtask cannot silently drift it.
"""

from sqlalchemy import Float, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB

from src.db.models import WordProposal, WordProposalOrigin, WordProposalState


class TestWordProposalStateEnum:
    """The lifecycle state enum has exactly the 7 lowercase values."""

    def test_all_values_lowercase(self):
        values = [e.value for e in WordProposalState]
        assert values == [
            "pending",
            "generating",
            "scored",
            "auto_approved",
            "needs_review",
            "rejected",
            "shipped",
        ]

    def test_values_are_lowercase(self):
        """Guards against the legacy uppercase partofspeech pattern."""
        for e in WordProposalState:
            assert e.value == e.value.lower()


class TestWordProposalOriginEnum:
    """The origin enum has exactly the 3 lowercase values."""

    def test_all_values_lowercase(self):
        values = [e.value for e in WordProposalOrigin]
        assert values == ["admin", "user_request", "batch"]

    def test_values_are_lowercase(self):
        for e in WordProposalOrigin:
            assert e.value == e.value.lower()


class TestWordProposalModel:
    """Schema-contract tests for the WordProposal model."""

    # =========================================================================
    # Table Structure
    # =========================================================================

    def test_tablename(self):
        assert WordProposal.__tablename__ == "word_proposal"

    def test_public_schema(self):
        """Table lives in the public schema (NOT reference)."""
        assert WordProposal.__table__.schema is None

    def test_has_all_columns(self):
        # 18 columns total = 16 own + created_at/updated_at from TimestampMixin.
        # LEXGEN-09-01 adds generated_content (nullable JSONB) bringing own from 15→16.
        # RED before LEXGEN-09-01 executor run: generated_content column is absent
        # → columns == 17-item set → assertion fails (set mismatch + len != 18).
        columns = set(WordProposal.__table__.columns.keys())
        expected = {
            "id",
            "lemma_input",
            "pos",
            "origin",
            "requested_by",
            "status",
            "evidence_packet",
            "generated_fields",
            "reconciliation_log",
            "judge_scores",
            "flagged_fields",
            "trust_score",
            "shipped_word_entry_id",
            "rejection_reason",
            "retry_attempts",
            "created_at",
            "updated_at",
            "generated_content",  # LEXGEN-09-01: nullable JSONB for lexical content
        }
        assert columns == expected
        assert len(columns) == 18  # 16 own columns + created_at/updated_at mixin

    # =========================================================================
    # POS-neutrality (schema half)
    # =========================================================================

    def test_no_gender_column(self):
        """gender must NOT be a column — it lives inside generated_fields JSONB."""
        assert "gender" not in WordProposal.__table__.columns.keys()

    def test_pos_is_free_text(self):
        """pos is plain Text (no enum, no hardcoded 'noun')."""
        pos_col = WordProposal.__table__.columns["pos"]
        assert isinstance(pos_col.type, Text)
        assert pos_col.nullable is False

    # =========================================================================
    # Primary key (D1)
    # =========================================================================

    def test_id_is_primary_key(self):
        id_col = WordProposal.__table__.columns["id"]
        assert id_col.primary_key is True

    def test_id_has_server_default(self):
        """UUID PK generated server-side (uuid_generate_v4)."""
        id_col = WordProposal.__table__.columns["id"]
        assert id_col.server_default is not None

    # =========================================================================
    # NOT NULL columns
    # =========================================================================

    def test_lemma_input_not_nullable(self):
        assert WordProposal.__table__.columns["lemma_input"].nullable is False

    def test_origin_not_nullable(self):
        assert WordProposal.__table__.columns["origin"].nullable is False

    def test_status_not_nullable(self):
        assert WordProposal.__table__.columns["status"].nullable is False

    def test_retry_attempts_not_nullable(self):
        assert WordProposal.__table__.columns["retry_attempts"].nullable is False

    # =========================================================================
    # NULLABLE columns
    # =========================================================================

    def test_requested_by_nullable(self):
        assert WordProposal.__table__.columns["requested_by"].nullable is True

    def test_trust_score_nullable(self):
        assert WordProposal.__table__.columns["trust_score"].nullable is True

    def test_shipped_word_entry_id_nullable(self):
        assert WordProposal.__table__.columns["shipped_word_entry_id"].nullable is True

    def test_rejection_reason_nullable(self):
        assert WordProposal.__table__.columns["rejection_reason"].nullable is True

    def test_jsonb_columns_nullable(self):
        for name in (
            "evidence_packet",
            "generated_fields",
            "reconciliation_log",
            "judge_scores",
            "flagged_fields",
        ):
            assert WordProposal.__table__.columns[name].nullable is True, name

    # =========================================================================
    # Column types
    # =========================================================================

    def test_lemma_input_is_text(self):
        assert isinstance(WordProposal.__table__.columns["lemma_input"].type, Text)

    def test_rejection_reason_is_text(self):
        assert isinstance(WordProposal.__table__.columns["rejection_reason"].type, Text)

    def test_jsonb_columns_use_jsonb_dialect_type(self):
        """D4: JSONB dialect type, not generic JSON, for the new columns."""
        for name in (
            "evidence_packet",
            "generated_fields",
            "reconciliation_log",
            "judge_scores",
            "flagged_fields",
        ):
            assert isinstance(WordProposal.__table__.columns[name].type, JSONB), name

    def test_trust_score_is_float(self):
        """D3/§3: trust_score is a nullable Float (inert in v1)."""
        assert isinstance(WordProposal.__table__.columns["trust_score"].type, Float)

    def test_retry_attempts_is_integer(self):
        assert isinstance(WordProposal.__table__.columns["retry_attempts"].type, Integer)

    # =========================================================================
    # Enum columns (DB-level, lowercase) — D3
    # =========================================================================

    def test_status_enum_name_and_values(self):
        status_col = WordProposal.__table__.columns["status"]
        assert status_col.type.name == "word_proposal_status"
        assert status_col.type.enums == [
            "pending",
            "generating",
            "scored",
            "auto_approved",
            "needs_review",
            "rejected",
            "shipped",
        ]

    def test_origin_enum_name_and_values(self):
        origin_col = WordProposal.__table__.columns["origin"]
        assert origin_col.type.name == "word_proposal_origin"
        assert origin_col.type.enums == ["admin", "user_request", "batch"]

    # =========================================================================
    # Server defaults
    # =========================================================================

    def test_status_server_default_pending(self):
        status_col = WordProposal.__table__.columns["status"]
        assert status_col.server_default is not None
        assert "pending" in str(status_col.server_default.arg)

    def test_retry_attempts_server_default_zero(self):
        col = WordProposal.__table__.columns["retry_attempts"]
        assert col.server_default is not None
        assert "0" in str(col.server_default.arg)

    # =========================================================================
    # Foreign keys (D6) — both SET NULL
    # =========================================================================

    def test_requested_by_fk_set_null(self):
        col = WordProposal.__table__.columns["requested_by"]
        fks = list(col.foreign_keys)
        assert len(fks) == 1
        assert str(fks[0].column) == "users.id"
        assert fks[0].ondelete == "SET NULL"

    def test_shipped_word_entry_id_fk_set_null(self):
        col = WordProposal.__table__.columns["shipped_word_entry_id"]
        fks = list(col.foreign_keys)
        assert len(fks) == 1
        assert str(fks[0].column) == "word_entries.id"
        assert fks[0].ondelete == "SET NULL"

    # =========================================================================
    # Indexes
    # =========================================================================

    def test_status_index_exists(self):
        names = {idx.name for idx in WordProposal.__table__.indexes}
        assert "ix_word_proposal_status" in names

    def test_lemma_input_index_exists(self):
        names = {idx.name for idx in WordProposal.__table__.indexes}
        assert "ix_word_proposal_lemma_input" in names

    def test_composite_origin_status_index_exists(self):
        for idx in WordProposal.__table__.indexes:
            if idx.name == "ix_word_proposal_origin_status":
                cols = [c.name for c in idx.columns]
                assert cols == ["origin", "status"]
                return
        raise AssertionError("ix_word_proposal_origin_status index not found")

    # =========================================================================
    # TimestampMixin
    # =========================================================================

    def test_created_at_not_nullable(self):
        assert WordProposal.__table__.columns["created_at"].nullable is False

    def test_updated_at_not_nullable(self):
        assert WordProposal.__table__.columns["updated_at"].nullable is False
