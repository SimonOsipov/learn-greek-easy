# WEDGE-02 Culture-Topic Backfill — Post-Merge Ops Runbook

## Overview

WEDGE-02 tags every `culture_questions` row with a `topic` (one of the five
`CultureTopic` values: `history`, `geography`, `politics`, `culture`,
`practical`) via a two-pass engine
(`src.services.culture_topic_tagger.tag_culture_questions`). Applying that
tagging pass to the live production database is a **manual, human-authorized,
post-merge step (D-A9)** — `/ralph` never writes to prod, and this CLI is
never invoked against prod during automated execution.

The CLI (`src.scripts.tag_culture_topics`) defaults to a **dry run**: bare
invocation only computes and prints the report, it never writes. Committing
the live tagging pass requires the explicit `--no-dry-run` flag. This is a
deliberate deviation from the two S3 backfill-script precedents in this repo
(`backfill_s3_cache_control.py`, `backfill_image_derivatives.py`), which
default to live — see the CLI's module docstring for the full rationale:
this script writes live, user-facing exam content, not S3 object metadata,
so the safer default is opt-in-to-write.

Before any write, the CLI runs a **490-verify guard** (D-A10) against the
computed report and refuses to commit if it fails — a real prod-bank drift
must be fixed at the mapping/fixture level and re-run, never bypassed.

## Prerequisites

- The WEDGE-02 branch (topic column migration, tagging engine, the frozen
  19-row `RESIDUE_TOPIC_FIXTURE`, the `CULTURE_BANK_VERSION`/
  `CULTURE_BANK_QUESTION_COUNT` constants, and this CLI) is merged to `main`
  and deployed to production.
- Explicit user authorization to run a prod-write CLI (D-A9) — this is not
  something `/ralph` or any agent runs unattended.
- `DATABASE_URL` resolves to production. Use `railway run` (matches the
  Usage convention of the two existing `src/scripts/backfill_*` scripts) so
  the CLI inherits the production environment's `DATABASE_URL` without ever
  hardcoding or pasting a production connection string.

## Procedure

1. **Dry run** (dry-run is the default — no flag needed):
   ```bash
   railway run python -m src.scripts.tag_culture_topics
   ```
2. **Inspect** the printed report and the JSON artifact written beside the
   script (`src/scripts/tag_culture_topics_report.json`). Confirm:
   - `total_tagged == 490`
   - the four provenance classes partition as **286 by-deck + 94 by-twin +
     91 culture-default + 19 fixture** (sums to 490)
   - `untagged_remaining == 0`
   - `unmapped == []`
   - `ambiguous == []`
   - `fixture_unmatched == []`
   - verify-gate verdict: **PASS**
3. **Commit** — only if step 2's gate is PASS:
   ```bash
   railway run python -m src.scripts.tag_culture_topics --no-dry-run
   ```
4. **Confirm post-commit report**: `total_tagged == 490`,
   `per_topic_totals` sums to 490, `bank_version == CULTURE_BANK_VERSION`
   (the value frozen in `src/core/culture_bank_version.py`).
5. **Idempotency check** (recommended): re-run step 3. Counts must be
   byte-identical to step 4 — safe by construction, the engine recomputes
   every row's target topic unconditionally on every run (D-A5), never a
   `WHERE topic IS NULL` guard.
6. **If the gate FAILS at step 2**: STOP. Do not force — there is no
   override flag. Read the `unmapped` / `ambiguous` / `fixture_unmatched`
   rows printed in the report (they include the offending `el` text or
   question id) and escalate to the story owner. The likely cause is either
   a real edit to the prod bank since the 19-row fixture (D-A11) was frozen,
   or a taxonomy/mapping drift.

## Rollback / recovery

`topic` is a nullable, additive column — there is no destructive-delete
path to roll back here (unlike a schema rollback). A bad tag is corrected
by fixing the mapping/fixture code and re-running (idempotent overwrite,
D-A5). This runbook intentionally has no separate rollback section, matching
`scripts/backfill_sit_27_02_situation_domain.sql`'s posture (that backfill
has no rollback section either).

## Post-run verification (optional, read-only)

```sql
SELECT count(*) FROM culture_questions WHERE topic IS NULL;
-- expect 0
```

## See also

- `src/scripts/tag_culture_topics.py` — the CLI itself (module docstring
  has the full safe-default rationale).
- `src/services/culture_topic_tagger.py` — the two-pass tagging engine and
  `TaggingReport` shape.
- `src/core/culture_bank_version.py` — `CULTURE_BANK_VERSION` /
  `CULTURE_BANK_QUESTION_COUNT`, also read by WEDGE-05's "bank v&lt;date&gt;,
  &lt;count&gt; questions" honest-coverage chip.
- `src/core/culture_topic_reviewed_fixture.py` — the frozen 19-row judgment
  fixture (D-A11).
- WEDGE-02 story (Simon Vault/Projects/Greekly/User Stories/WEDGE/) —
  Decisions D-A9/D-A10/D-A11 for the full rationale.
