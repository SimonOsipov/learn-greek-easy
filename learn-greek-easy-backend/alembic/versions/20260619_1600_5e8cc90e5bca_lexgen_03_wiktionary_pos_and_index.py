"""lexgen-03 wiktionary_morphology pos column + (lemma, pos, gender) index + forms backfill

Revision ID: 5e8cc90e5bca
Revises: 1536eb298412
Create Date: 2026-06-19 16:00:00.000000+00:00

Two phases in one revision (LEXGEN-03-01 DDL + LEXGEN-03-02 data):

1. DDL (LEXGEN-03-01): add a ``pos`` column to
   ``reference.wiktionary_morphology`` and replace the ``(lemma, gender)``
   unique index with ``(lemma, pos, gender)``.
2. Data (LEXGEN-03-02): transform every row's ``forms`` JSONB *value* from the
   flat ``"{case}_{number}"`` key shape into a feature-keyed ``FormBundle``
   list, reusing LEXGEN-02's pure ``flat_to_bundles`` converter (not
   reimplemented here). The data phase runs AFTER the DDL so ``pos`` already
   exists, is idempotent via a positive ``isinstance(forms_value, list)``
   skip-guard, reversible via ``bundles_to_flat`` in ``downgrade``, and
   logs-and-skips (never drops, never fails the whole migration) any row whose
   flat keys raise ``UnknownFlatFormKey``.
"""

import json
import logging
from typing import Any, Sequence, Union

import sqlalchemy as sa

from alembic import op
from src.core.exceptions import UnknownFlatFormKey
from src.core.lexgen_forms import bundles_to_flat, flat_to_bundles
from src.schemas.lexgen import FormBundle

# revision identifiers, used by Alembic.
revision: str = "5e8cc90e5bca"
down_revision: Union[str, Sequence[str], None] = "1536eb298412"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Stdlib logger (NOT loguru) so pytest ``caplog`` captures the WARNING/INFO
# records the LEXGEN-03-02 tests assert on (cqmig_02 precedent).
logger = logging.getLogger(__name__)


def backfill_forms_to_bundles(connection: Any) -> dict:
    """Convert every flat-key ``forms`` JSONB value to a feature-bundle list.

    For each row in ``reference.wiktionary_morphology``:

    - ``isinstance(forms_value, list)`` → already converted → SKIP (leave the
      row untouched, count as ``skipped``). This positive shape guard — NOT a
      ``try/except`` around the converter — is what makes the migration
      idempotent: ``flat_to_bundles`` raises on a list, so it must never be
      called on an already-converted row, and "already done" must stay distinct
      from "bad data" (D-IDEMPOTENT).
    - ``isinstance(forms_value, dict)`` → still flat → call
      ``flat_to_bundles(forms_value, pos="noun")``:
        - success → serialise the ``list[FormBundle]`` to JSONB and UPDATE the
          row's ``forms`` (count as ``converted``). Empty ``{}`` → ``[]`` →
          still counts as converted.
        - ``UnknownFlatFormKey`` → log a WARNING naming id + lemma + offending
          key, leave the original flat ``forms`` intact, count as ``skipped``
          (never dropped, never failing the whole migration — D-VALIDATE).
    - Anything else (defensively: NULL or an unexpected scalar) → SKIP.

    Returns ``{"converted": int, "skipped": int, "total": int}`` with
    ``converted + skipped == total`` and logs that summary at INFO level.
    """
    # Materialise all rows first (psycopg2 buffers client-side on fetchall), so
    # interleaved per-row UPDATEs on the same connection are safe.
    rows = connection.execute(
        sa.text("SELECT id, lemma, forms FROM reference.wiktionary_morphology ORDER BY id")
    ).fetchall()

    converted = 0
    skipped = 0
    total = len(rows)

    for row in rows:
        forms_value = row.forms  # psycopg2 deserialises JSONB → dict | list

        # Idempotency: an already-converted (bundle list) row is skipped before
        # the converter ever sees it.
        if isinstance(forms_value, list):
            skipped += 1
            continue

        # Defensive: only flat dicts are convertible. NULL or any unexpected
        # shape is left untouched (counts as skipped, not converted).
        if not isinstance(forms_value, dict):
            skipped += 1
            continue

        try:
            bundles = flat_to_bundles(forms_value, pos="noun")
        except UnknownFlatFormKey as exc:
            logger.warning(
                "LEXGEN-03-02 backfill: skipping row id=%s lemma=%r — "
                "unconvertible flat forms %r: %s",
                row.id,
                row.lemma,
                forms_value,
                exc,
            )
            skipped += 1
            continue

        serialised = json.dumps([bundle.model_dump(mode="json") for bundle in bundles])
        connection.execute(
            sa.text(
                "UPDATE reference.wiktionary_morphology "
                "SET forms = CAST(:forms AS jsonb) WHERE id = :id"
            ),
            {"forms": serialised, "id": row.id},
        )
        converted += 1

    summary = {"converted": converted, "skipped": skipped, "total": total}
    logger.info(
        "LEXGEN-03-02 backfill complete: converted=%d skipped=%d total=%d",
        converted,
        skipped,
        total,
    )
    return summary


def downgrade_forms_to_flat(connection: Any) -> dict:
    """Reverse the backfill: restore each bundle-list ``forms`` to a flat dict.

    For each row where ``isinstance(forms_value, list)`` (a converted bundle
    list), reconstruct ``FormBundle`` objects from the stored dicts and call
    ``bundles_to_flat`` to rebuild the flat ``"{case}_{number}"`` dict, then
    UPDATE the row. ``bundles_to_flat`` drops the ``gender`` feature, but these
    bundles carry only case+number, so the round-trip is lossless for this
    dataset (D-DOWNGRADE). Rows whose ``forms`` are already a dict (never
    converted) are left untouched.

    Returns ``{"converted": int, "total": int}`` (``converted`` = rows
    restored to flat) and logs the summary at INFO level.
    """
    rows = connection.execute(
        sa.text("SELECT id, lemma, forms FROM reference.wiktionary_morphology ORDER BY id")
    ).fetchall()

    converted = 0
    total = len(rows)

    for row in rows:
        forms_value = row.forms
        if not isinstance(forms_value, list):
            continue

        # Reconstruct FormBundle objects from the stored plain dicts so the
        # strict converter receives the type it expects. A malformed stored
        # bundle surfaces loudly rather than being silently swallowed.
        bundles = [FormBundle(**item) for item in forms_value]
        flat = bundles_to_flat(bundles)
        connection.execute(
            sa.text(
                "UPDATE reference.wiktionary_morphology "
                "SET forms = CAST(:forms AS jsonb) WHERE id = :id"
            ),
            {"forms": json.dumps(flat), "id": row.id},
        )
        converted += 1

    logger.info(
        "LEXGEN-03-02 downgrade complete: restored %d/%d rows to flat forms",
        converted,
        total,
    )
    return {"converted": converted, "total": total}


def upgrade() -> None:
    """Add the ``pos`` column, then swap the unique index to (lemma, pos, gender).

    Order matters: ADD COLUMN first so the ``server_default 'noun'`` backfills
    every existing (noun-only) row before the new unique index is built over a
    fully-populated ``pos``.
    """
    op.add_column(
        "wiktionary_morphology",
        sa.Column(
            "pos",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'noun'"),
            comment="Part of speech as free-text (POS-neutral — no enum; existing rows backfill to 'noun')",
        ),
        schema="reference",
    )
    op.drop_index(
        "uq_wiktionary_morphology_lemma_gender",
        table_name="wiktionary_morphology",
        schema="reference",
    )
    op.create_index(
        "uq_wiktionary_morphology_lemma_pos_gender",
        "wiktionary_morphology",
        ["lemma", "pos", "gender"],
        unique=True,
        schema="reference",
    )

    # ``forms`` is a JSONB *list* (Mapped[list]); align its server_default with
    # the empty-list shape (was the empty-dict '{}'::jsonb from the table's
    # original migration) so the model and DB defaults match (`alembic check`).
    op.alter_column(
        "wiktionary_morphology",
        "forms",
        server_default=sa.text("'[]'::jsonb"),
        schema="reference",
    )

    # Data phase (LEXGEN-03-02): runs AFTER the DDL so ``pos`` already exists.
    backfill_forms_to_bundles(op.get_bind())


def downgrade() -> None:
    """Reverse exactly: restore flat ``forms``, then drop the 3-col unique
    index, drop ``pos``, restore the original ``(lemma, gender)`` unique index.

    The data reversal runs FIRST, while the ``pos`` column and 3-col index
    still exist, so it operates against the same schema the upgrade left behind.
    """
    # Data phase reversal (LEXGEN-03-02): restore flat forms before the DDL is undone.
    downgrade_forms_to_flat(op.get_bind())

    # Restore the original empty-dict server_default that predated this migration
    # (reverses the '[]'::jsonb default set in upgrade()).
    op.alter_column(
        "wiktionary_morphology",
        "forms",
        server_default=sa.text("'{}'::jsonb"),
        schema="reference",
    )

    op.drop_index(
        "uq_wiktionary_morphology_lemma_pos_gender",
        table_name="wiktionary_morphology",
        schema="reference",
    )
    op.drop_column("wiktionary_morphology", "pos", schema="reference")
    op.create_index(
        "uq_wiktionary_morphology_lemma_gender",
        "wiktionary_morphology",
        ["lemma", "gender"],
        unique=True,
        schema="reference",
    )
