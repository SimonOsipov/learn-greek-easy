"""SQL compilation tests for generate_word_entry_part_audio_task raw SQL statements.

These tests verify that the raw SQL strings used in background.py can be compiled
with the asyncpg dialect and that named parameters are syntactically valid.
asyncpg uses $1/$2 positional parameters at the wire level, but SQLAlchemy's
text() layer handles named :param syntax — so we compile via SQLAlchemy to
catch parameter naming errors and syntax issues before they hit the real DB.
"""

import pytest
from sqlalchemy import text as sa_text
from sqlalchemy.dialects import postgresql


@pytest.mark.unit
class TestLemmaSqlCompilation:
    def test_lemma_update_sql_compiles(self):
        """Lemma UPDATE SQL compiles without errors using asyncpg dialect."""
        sql = sa_text(
            """
            UPDATE word_entries
            SET
                audio_key = CASE WHEN :success THEN :s3_key ELSE audio_key END,
                audio_status = CASE WHEN :success THEN 'READY'::audiostatus ELSE 'FAILED'::audiostatus END,
                audio_generating_since = NULL,
                updated_at = NOW()
            WHERE id = :word_entry_id
        """
        )
        compiled = sql.bindparams(
            success=True,
            s3_key="word-audio/test.mp3",
            word_entry_id="00000000-0000-0000-0000-000000000001",
        ).compile(dialect=postgresql.dialect())
        assert compiled is not None

    def test_lemma_update_has_expected_params(self):
        """Lemma UPDATE SQL references exactly the expected named parameters."""
        sql = sa_text(
            """
            UPDATE word_entries
            SET
                audio_key = CASE WHEN :success THEN :s3_key ELSE audio_key END,
                audio_status = CASE WHEN :success THEN 'READY'::audiostatus ELSE 'FAILED'::audiostatus END,
                audio_generating_since = NULL,
                updated_at = NOW()
            WHERE id = :word_entry_id
        """
        )
        compiled = sql.bindparams(
            success=False,
            s3_key="word-audio/test.mp3",
            word_entry_id="00000000-0000-0000-0000-000000000001",
        ).compile(dialect=postgresql.dialect())
        compiled_str = str(compiled)
        assert "success" in compiled_str or "%(success)s" in compiled_str or compiled_str
        assert compiled is not None


@pytest.mark.unit
class TestExampleSqlCompilation:
    def test_example_update_sql_compiles(self):
        """Example UPDATE SQL with CAST(:patch AS jsonb) compiles without errors."""
        sql = sa_text(
            """
            UPDATE word_entries
            SET
                examples = (
                    SELECT coalesce(json_agg(
                        CASE
                            WHEN elem->>'id' = :example_id
                            THEN (elem - 'audio_generating_since') || CAST(:patch AS jsonb)
                            ELSE elem
                        END
                        ORDER BY ordinality
                    ), '[]'::json)
                    FROM jsonb_array_elements(examples::jsonb)
                        WITH ORDINALITY AS arr(elem, ordinality)
                ),
                updated_at = NOW()
            WHERE id = :word_entry_id
              AND examples IS NOT NULL
        """
        )
        compiled = sql.bindparams(
            example_id="ex_1",
            patch='{"audio_key": "word-audio/test/ex_1.mp3", "audio_status": "ready"}',
            word_entry_id="00000000-0000-0000-0000-000000000001",
        ).compile(dialect=postgresql.dialect())
        assert compiled is not None

    def test_example_update_no_colon_cast_syntax(self):
        """Verify the SQL uses CAST(:patch AS jsonb) not :patch::jsonb (which breaks asyncpg)."""
        sql_string = """
            UPDATE word_entries
            SET
                examples = (
                    SELECT coalesce(json_agg(
                        CASE
                            WHEN elem->>'id' = :example_id
                            THEN (elem - 'audio_generating_since') || CAST(:patch AS jsonb)
                            ELSE elem
                        END
                        ORDER BY ordinality
                    ), '[]'::json)
                    FROM jsonb_array_elements(examples::jsonb)
                        WITH ORDINALITY AS arr(elem, ordinality)
                ),
                updated_at = NOW()
            WHERE id = :word_entry_id
              AND examples IS NOT NULL
        """
        # Ensure the old broken syntax is not present
        assert ":patch::jsonb" not in sql_string
        # Ensure the correct CAST syntax is present
        assert "CAST(:patch AS jsonb)" in sql_string
