"""Unit tests for the FrequencyRank model (LEXGEN-05-01).

Mode A — RED specs.  These tests lock the schema contract that the executor
must deliver:

  AC-1  FrequencyRank table: id (PK, Integer, autoincrement), lemma/source
        (Text, NOT NULL), rank (Integer, NOT NULL), created_at (TIMESTAMPTZ,
        server_default now()); schema == "reference".
  AC-2  Unique index covers exactly (lemma) — single column, NOT (lemma, rank).
  AC-3  A separate NON-unique index covers rank.
  AC-4  Migration down_revision == '844af57c6ca2' (LEXGEN-04 head).

All tests FAIL today because FrequencyRank does not exist yet
(ImportError on the import below).  That ImportError is the expected RED
signal for Mode A — the import-at-module-level causes the whole file to
fail at collection, which is the correct test-first signal.

These tests need NO database — they introspect the SQLAlchemy model in-process.
"""

import importlib.util
from pathlib import Path

from sqlalchemy import DateTime, Integer, Text

from src.db.models import FrequencyRank


class TestFrequencyRankColumnsContract:
    """AC-1 — column presence and type contract for reference.frequency_rank."""

    def test_frequency_rank_columns_contract(self):
        """AC-1: FrequencyRank must have columns with the correct types and nullability.

        Specifically:
          - lemma      : Text, NOT NULL
          - source     : Text, NOT NULL
          - rank       : Integer, NOT NULL
          - id         : Integer, primary key, autoincrement
          - created_at : DateTime (with timezone), server_default present

        RED today: FrequencyRank does not exist → ImportError at collection.
        GREEN after: executor adds FrequencyRank with these columns to models.py.
        """
        table = FrequencyRank.__table__

        # --- lemma ---
        lemma_col = table.columns["lemma"]
        assert isinstance(
            lemma_col.type, Text
        ), f"lemma must be Text, got {type(lemma_col.type).__name__}"
        assert lemma_col.nullable is False, "lemma must be NOT NULL"

        # --- source ---
        source_col = table.columns["source"]
        assert isinstance(
            source_col.type, Text
        ), f"source must be Text, got {type(source_col.type).__name__}"
        assert source_col.nullable is False, "source must be NOT NULL"

        # --- rank ---
        rank_col = table.columns["rank"]
        assert isinstance(
            rank_col.type, Integer
        ), f"rank must be Integer, got {type(rank_col.type).__name__}"
        assert rank_col.nullable is False, "rank must be NOT NULL"

        # --- id ---
        id_col = table.columns["id"]
        assert isinstance(
            id_col.type, Integer
        ), f"id must be Integer, got {type(id_col.type).__name__}"
        assert id_col.primary_key is True, "id must be the primary key"
        assert id_col.autoincrement is True, "id must be autoincrement"

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

    def test_frequency_rank_in_reference_schema(self):
        """AC-1: FrequencyRank.__table__.schema must equal 'reference'.

        RED today: FrequencyRank does not exist → ImportError at collection.
        GREEN after: executor sets schema="reference" in __table_args__.
        """
        assert FrequencyRank.__table__.schema == "reference", (
            f"FrequencyRank must be in the 'reference' schema, "
            f"got {FrequencyRank.__table__.schema!r}"
        )


class TestFrequencyRankIndexes:
    """AC-2, AC-3 — index contracts for reference.frequency_rank."""

    def test_frequency_rank_unique_index_on_lemma_alone(self):
        """AC-2: Exactly one unique index must exist and cover only (lemma).

        The DB backstop that enforces one-row-per-lemma must be UNIQUE(lemma) —
        NOT UNIQUE(lemma, rank).  A (lemma, rank) unique index would wrongly
        permit two different rank entries for the same lemma (e.g. from
        conflicting sources), corrupting the single-source-of-truth invariant.

        RED today: FrequencyRank does not exist → ImportError at collection.
        GREEN after: executor declares Index(..., unique=True) on (lemma) only.
        """
        indexes = FrequencyRank.__table__.indexes
        unique_indexes = [idx for idx in indexes if idx.unique]

        assert len(unique_indexes) == 1, (
            f"Expected exactly 1 unique index on FrequencyRank, "
            f"found {len(unique_indexes)}: {[idx.name for idx in unique_indexes]}"
        )

        the_unique = unique_indexes[0]
        unique_cols = [col.name for col in the_unique.columns]
        assert unique_cols == [
            "lemma"
        ], f"Unique index must cover exactly (lemma), got columns {unique_cols!r}"

        # Paranoia: no unique index must cover (lemma, rank)
        for idx in unique_indexes:
            idx_cols = [col.name for col in idx.columns]
            assert idx_cols != ["lemma", "rank"], (
                "Found a forbidden UNIQUE(lemma, rank) index — this would allow "
                "two contradictory frequency ranks for the same lemma"
            )

    def test_frequency_rank_nonunique_index_on_rank(self):
        """AC-3: A non-unique index covering 'rank' must exist.

        Rank-ordered lookups (e.g. 'all lemmas with rank <= N') require an index
        on rank for query performance.  It must be non-unique (many lemmas could
        share the same rank value if the source uses bands).

        RED today: FrequencyRank does not exist → ImportError at collection.
        GREEN after: executor declares a non-unique Index on (rank).
        """
        indexes = FrequencyRank.__table__.indexes
        non_unique_indexes = [idx for idx in indexes if not idx.unique]

        rank_indexes = [
            idx for idx in non_unique_indexes if [col.name for col in idx.columns] == ["rank"]
        ]
        assert len(rank_indexes) >= 1, (
            f"Expected a non-unique index covering (rank) on FrequencyRank, "
            f"but none found. Non-unique indexes: "
            f"{[([c.name for c in i.columns], i.name) for i in non_unique_indexes]}"
        )


class TestFrequencyRankMigrationChain:
    """AC-4 — migration down_revision contract."""

    def test_migration_down_revision_is_lexgen_04(self):
        """AC-4: LEXGEN-05 migration down_revision must be '844af57c6ca2' (LEXGEN-04 head).

        Resolved by globbing alembic/versions/*lexgen_05_frequency_rank.py so
        the test does not hardcode a timestamp the executor hasn't chosen yet.
        Until the executor creates the migration, the glob finds nothing →
        the assertion that exactly one match exists fails → valid RED.

        RED today: migration file does not exist → glob finds zero matches →
                   AssertionError (not ImportError or syntax error).
        GREEN after: executor creates the migration with the correct down_revision.
        """
        versions_dir = Path(__file__).parent.parent.parent.parent / "alembic" / "versions"
        matches = list(versions_dir.glob("*lexgen_05_frequency_rank.py"))
        assert len(matches) == 1, (
            f"Expected exactly one LEXGEN-05 migration file matching "
            f"'*lexgen_05_frequency_rank.py' in {versions_dir}, "
            f"found {len(matches)}: {[m.name for m in matches]}"
        )

        migration_path = matches[0]
        spec = importlib.util.spec_from_file_location("lexgen_05_migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        assert migration.down_revision == "844af57c6ca2", (
            f"Migration down_revision must be '844af57c6ca2' (LEXGEN-04), "
            f"got {migration.down_revision!r}"
        )
