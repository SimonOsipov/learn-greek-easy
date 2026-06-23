-- =============================================================================
-- SIT-27-02 — Backfill Situation.domain for the 4 production situations.
--
-- MANUAL POST-DEPLOY STEP. NOT run automatically by any migration or CI job.
-- Run this once against PRODUCTION (Supabase SQL editor or psql) AFTER the
-- sit_27_02_situation_domain Alembic migration has been applied and the new
-- `situations.domain` column exists.
--
-- WHY NOT IN THE MIGRATION:
--   The 4 prod rows are content, not schema. Keying the backfill on
--   scenario_en (production IDs are unknown from the repo) keeps the Alembic
--   migration round-trip narrow + reversible (matches the LEXGEN CEFR /
--   frequency-rank railway-backfill precedent — Decision 11).
--
-- IDEMPOTENT:
--   Each UPDATE is keyed on a stable scenario_en substring and only writes
--   when domain IS NULL, so re-running is a no-op once applied. An operator
--   that wants to overwrite an already-set domain should drop the
--   `AND domain IS NULL` guard on the relevant statement.
--
-- VERIFY (before): confirm exactly one row matches each ILIKE pattern.
--   SELECT id, scenario_en, domain FROM situations
--   WHERE scenario_en ILIKE '%supreme court%'
--      OR scenario_en ILIKE '%armenia%summit%'
--      OR scenario_en ILIKE '%civil%shelter%'
--      OR scenario_en ILIKE '%energy%';
-- If a pattern matches 0 or >1 rows, fix the pattern before running the UPDATE.
-- =============================================================================

BEGIN;

-- Supreme Court → Law
UPDATE situations
SET domain = 'Law'
WHERE scenario_en ILIKE '%supreme court%'
  AND domain IS NULL;

-- Armenia summit → Politics
UPDATE situations
SET domain = 'Politics'
WHERE scenario_en ILIKE '%armenia%summit%'
  AND domain IS NULL;

-- Civil shelters → Government
UPDATE situations
SET domain = 'Government'
WHERE scenario_en ILIKE '%civil%shelter%'
  AND domain IS NULL;

-- Energy → Energy
UPDATE situations
SET domain = 'Energy'
WHERE scenario_en ILIKE '%energy%'
  AND domain IS NULL;

-- VERIFY (after): all 4 rows should now carry a domain.
--   SELECT id, scenario_en, domain FROM situations WHERE domain IS NOT NULL;

COMMIT;
