-- DGREEK-07 (DECKS2-1): one-off data backfill — set real Greek name_el/description_el
-- on the 3 A1 system decks whose Greek columns previously held English placeholders.
--
-- DML only — NO DDL. The name_el (NOT NULL) and description_el (nullable) columns
-- already exist on `decks`, so there is no Alembic migration for this change.
--
-- Idempotent / re-runnable: each row is set to an explicit literal value and the
-- statement is scoped to exactly the 3 target deck ids, so re-running yields the
-- same final state and touches no other rows.
--
-- Executed against production on 2026-05-30 (Greek names approved by product owner;
-- Greek descriptions drafted to match each deck's topic).

UPDATE decks SET
  name_el = CASE id
    WHEN '5e46509d-9570-4194-b63a-d6bde2887b0a' THEN 'Το ελληνικό σπίτι'
    WHEN '2a421cc0-a74c-4742-ab90-ff2e903f2552' THEN 'Η ελληνική οικογένεια'
    WHEN '8812bc52-3dec-4955-a654-cf82e1a045ad' THEN 'Το ελληνικό σούπερ μάρκετ'
  END,
  description_el = CASE id
    WHEN '5e46509d-9570-4194-b63a-d6bde2887b0a' THEN 'Πράγματα που έχουμε στο σπίτι.'
    WHEN '2a421cc0-a74c-4742-ab90-ff2e903f2552' THEN 'Λέξεις που περιγράφουν την οικογένεια.'
    WHEN '8812bc52-3dec-4955-a654-cf82e1a045ad' THEN 'Λέξεις που χρησιμοποιούμε στο σούπερ μάρκετ.'
  END
WHERE id IN (
  '5e46509d-9570-4194-b63a-d6bde2887b0a',  -- Greek House
  '2a421cc0-a74c-4742-ab90-ff2e903f2552',  -- Greek Family
  '8812bc52-3dec-4955-a654-cf82e1a045ad'   -- Greek Supermarket
);
