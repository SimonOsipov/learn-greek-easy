"""Unit tests for the CefrLemma and CefrLemmaReview models (LEXGEN-04-01).

Mode A — RED specs.  These tests lock the schema contract that the executor
must deliver:

  AC-6  CefrLemma table: id (PK, Integer, autoincrement), lemma/level/source
        (Text, NOT NULL), closed_class (Boolean, NOT NULL, server_default false),
        created_at (TIMESTAMPTZ, server_default now()); schema == "reference".
  AC-7  Unique index covers exactly (lemma) — single column, NOT (lemma, level).
  AC-8  A separate NON-unique index covers level.
  AC-10 CefrLemmaReview table: raw_lemma (Text, NOT NULL), normalized_lemma
        (Text, nullable), level/source (Text), reason (Text, NOT NULL),
        created_at; schema == "reference".

All tests FAIL today because CefrLemma / CefrLemmaReview do not exist yet
(ImportError on the import below).  That ImportError is the expected RED
signal for Mode A — the import-at-module-level causes the whole file to
fail at collection, which is the correct test-first signal.

These tests need NO database — they introspect the SQLAlchemy model in-process.
"""

import importlib.util
from pathlib import Path

from sqlalchemy import Boolean, DateTime, Integer, Text

from src.db.models import CefrLemma, CefrLemmaReview


class TestCefrLemmaColumnsContract:
    """AC-6 — column presence and type contract for reference.cefr_lemma."""

    def test_cefr_lemma_columns_contract(self):
        """AC-6: CefrLemma must have columns with the correct types and nullability.

        Specifically:
          - lemma   : Text, NOT NULL
          - level   : Text, NOT NULL
          - source  : Text, NOT NULL
          - closed_class : Boolean, NOT NULL, server_default renders false
          - created_at   : DateTime (with timezone), server_default present
          - id      : Integer, primary key, autoincrement

        RED today: CefrLemma does not exist → ImportError at collection.
        GREEN after: executor adds CefrLemma with these columns to models.py.
        """
        table = CefrLemma.__table__

        # --- lemma ---
        lemma_col = table.columns["lemma"]
        assert isinstance(
            lemma_col.type, Text
        ), f"lemma must be Text, got {type(lemma_col.type).__name__}"
        assert lemma_col.nullable is False, "lemma must be NOT NULL"

        # --- level ---
        level_col = table.columns["level"]
        assert isinstance(
            level_col.type, Text
        ), f"level must be Text, got {type(level_col.type).__name__}"
        assert level_col.nullable is False, "level must be NOT NULL"

        # --- source ---
        source_col = table.columns["source"]
        assert isinstance(
            source_col.type, Text
        ), f"source must be Text, got {type(source_col.type).__name__}"
        assert source_col.nullable is False, "source must be NOT NULL"

        # --- closed_class ---
        cc_col = table.columns["closed_class"]
        assert isinstance(
            cc_col.type, Boolean
        ), f"closed_class must be Boolean, got {type(cc_col.type).__name__}"
        assert cc_col.nullable is False, "closed_class must be NOT NULL"
        assert (
            cc_col.server_default is not None
        ), "closed_class must have a server_default (expected false)"
        default_text = str(cc_col.server_default.arg).lower()
        assert (
            "false" in default_text
        ), f"closed_class server_default must render false, got {default_text!r}"

        # --- created_at ---
        created_col = table.columns["created_at"]
        assert isinstance(
            created_col.type, DateTime
        ), f"created_at must be DateTime, got {type(created_col.type).__name__}"
        assert (
            created_col.type.timezone is True
        ), "created_at DateTime must have timezone=True (TIMESTAMPTZ)"
        assert (
            created_col.server_default is not None
        ), "created_at must have a server_default (now())"

        # --- id ---
        id_col = table.columns["id"]
        assert isinstance(
            id_col.type, Integer
        ), f"id must be Integer, got {type(id_col.type).__name__}"
        assert id_col.primary_key is True, "id must be the primary key"
        assert id_col.autoincrement is True, "id must be autoincrement"

    def test_cefr_lemma_in_reference_schema(self):
        """AC-6: CefrLemma.__table__.schema must equal 'reference'.

        RED today: CefrLemma does not exist → ImportError at collection.
        GREEN after: executor sets schema="reference" in __table_args__.
        """
        assert CefrLemma.__table__.schema == "reference", (
            f"CefrLemma must be in the 'reference' schema, " f"got {CefrLemma.__table__.schema!r}"
        )


class TestCefrLemmaIndexes:
    """AC-7, AC-8 — index contracts for reference.cefr_lemma."""

    def test_unique_index_is_lemma_only(self):
        """AC-7: Exactly one unique index must exist and cover only (lemma).

        The DB backstop that enforces the one-row-per-lemma invariant must be
        UNIQUE(lemma) — NOT UNIQUE(lemma, level).  A (lemma, level) unique
        index would wrongly permit (σπίτι, A1) and (σπίτι, B1) to coexist,
        giving the gate two contradictory introduction levels.

        RED today: CefrLemma does not exist → ImportError at collection.
        GREEN after: executor declares Index(..., unique=True) on (lemma) only.
        """
        indexes = CefrLemma.__table__.indexes
        unique_indexes = [idx for idx in indexes if idx.unique]

        assert len(unique_indexes) == 1, (
            f"Expected exactly 1 unique index on CefrLemma, "
            f"found {len(unique_indexes)}: {[idx.name for idx in unique_indexes]}"
        )

        the_unique = unique_indexes[0]
        unique_cols = [col.name for col in the_unique.columns]
        assert unique_cols == [
            "lemma"
        ], f"Unique index must cover exactly (lemma), got columns {unique_cols!r}"

        # Paranoia: no unique index must cover (lemma, level)
        for idx in unique_indexes:
            idx_cols = [col.name for col in idx.columns]
            assert idx_cols != ["lemma", "level"], (
                "Found a forbidden UNIQUE(lemma, level) index — this would allow "
                "two contradictory CEFR levels for the same lemma"
            )

    def test_level_index_present_and_non_unique(self):
        """AC-8: A non-unique index covering 'level' must exist.

        The gate loads 'all lemmas <= target level', so a level index is
        required for query performance.  It must be non-unique (many lemmas
        share the same level).

        RED today: CefrLemma does not exist → ImportError at collection.
        GREEN after: executor declares a non-unique Index on (level).
        """
        indexes = CefrLemma.__table__.indexes
        non_unique_indexes = [idx for idx in indexes if not idx.unique]

        level_indexes = [
            idx for idx in non_unique_indexes if [col.name for col in idx.columns] == ["level"]
        ]
        assert len(level_indexes) >= 1, (
            f"Expected a non-unique index covering (level) on CefrLemma, "
            f"but none found. Non-unique indexes: "
            f"{[([c.name for c in i.columns], i.name) for i in non_unique_indexes]}"
        )


class TestCefrLemmaReviewColumnsContract:
    """AC-10 — column contract for reference.cefr_lemma_review."""

    def test_review_table_columns_contract(self):
        """AC-10: CefrLemmaReview must have the correct columns.

        Specifically:
          - raw_lemma        : Text, NOT NULL
          - normalized_lemma : Text, nullable (None when normalization failed)
          - level            : Text (nullable)
          - source           : Text (nullable)
          - reason           : Text, NOT NULL (e.g. 'normalization_failed' | 'not_attested')
          - created_at       : DateTime (tz-aware)
          - schema           : "reference"

        RED today: CefrLemmaReview does not exist → ImportError at collection.
        GREEN after: executor adds CefrLemmaReview to models.py.
        """
        table = CefrLemmaReview.__table__

        # --- schema ---
        assert (
            table.schema == "reference"
        ), f"CefrLemmaReview must be in the 'reference' schema, got {table.schema!r}"

        # --- raw_lemma ---
        raw_col = table.columns["raw_lemma"]
        assert isinstance(
            raw_col.type, Text
        ), f"raw_lemma must be Text, got {type(raw_col.type).__name__}"
        assert raw_col.nullable is False, "raw_lemma must be NOT NULL"

        # --- normalized_lemma ---
        norm_col = table.columns["normalized_lemma"]
        assert isinstance(
            norm_col.type, Text
        ), f"normalized_lemma must be Text, got {type(norm_col.type).__name__}"
        assert (
            norm_col.nullable is True
        ), "normalized_lemma must be nullable (absent when normalization failed)"

        # --- level ---
        assert "level" in table.columns, "CefrLemmaReview must have a 'level' column"

        # --- source ---
        assert "source" in table.columns, "CefrLemmaReview must have a 'source' column"

        # --- reason ---
        reason_col = table.columns["reason"]
        assert isinstance(
            reason_col.type, Text
        ), f"reason must be Text, got {type(reason_col.type).__name__}"
        assert reason_col.nullable is False, "reason must be NOT NULL"

        # --- created_at ---
        assert "created_at" in table.columns, "CefrLemmaReview must have a 'created_at' column"


class TestCefrLemmaAdversarial:
    """Adversarial guards that would catch future regressions not covered by the AC tests."""

    def test_migration_down_revision_is_lexgen03(self):
        """Guard: migration down_revision must be '5e8cc90e5bca' (LEXGEN-03 head).

        Loading the migration file directly and asserting down_revision == the
        LEXGEN-03 revision catches any future accidental head shift that would
        silently break the migration chain without an error at upgrade time.
        """
        migration_path = (
            Path(__file__).parent.parent.parent.parent
            / "alembic"
            / "versions"
            / "20260620_0800_844af57c6ca2_lexgen_04_cefr_lemma.py"
        )
        assert migration_path.exists(), f"Migration file not found at {migration_path}"
        spec = importlib.util.spec_from_file_location("lexgen_04_migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        assert migration.down_revision == "5e8cc90e5bca", (
            f"Migration down_revision must be '5e8cc90e5bca' (LEXGEN-03), "
            f"got {migration.down_revision!r}"
        )

    def test_closed_class_server_default_is_false_not_true(self):
        """Guard: closed_class server_default must be exactly 'false', never NULL or 'true'.

        A server_default of 'true' would silently mark every new lemma as a
        closed-class function word, corrupting the gate's set-membership logic.
        """
        cc_col = CefrLemma.__table__.columns["closed_class"]
        assert cc_col.server_default is not None, "closed_class must have a server_default"
        default_text = str(cc_col.server_default.arg).lower()
        assert default_text == "false", (
            f"closed_class server_default must be exactly 'false', got {default_text!r}. "
            "A 'true' default would mark every lemma as a closed-class function word."
        )
