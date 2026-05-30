// src/features/practice/pf/questions/Declension.tsx
//
// Question + answer renderer for the `declension` card type.
//
// Architecture (body/foot split, PRACT2-1-05):
//   body  -> <Declension card={card} revealed={false} />  (target cell = tinted "?")
//   foot  -> <Declension card={card} revealed={true} />   (target cell filled, pf-cell-fill flash)
//            followed by PracticeCard for rating controls
//
// The declension family is FULLY BACKED -- the filled cell IS the answer.
// No generic answer block, no red UnwiredDot.
//
// Data shape (verified against card_record.py:47-61, :206-210):
//   back_content.declension_table = DeclensionTable {
//     gender: string          -- English label e.g. "Masculine" (NOT a Greek article)
//     rows:   DeclensionRow[] -- always 4 rows: Nominative, Genitive, Accusative, Vocative
//   }
//   DeclensionRow {
//     case:               string  -- capitalised label (no re-translation needed)
//     singular:           string  -- form or "—"
//     plural:             string  -- form or "—"
//     highlight_singular: boolean -- true on the ONE target cell
//     highlight_plural:   boolean -- true on the ONE target cell
//   }
//
// Nominative is NEVER the target (card_generator_service.py:43), so rows[0].singular
// is always a real Greek form -> safe lemma source.
//
// Lemma line: "el -- en" where el = rows[0].singular, en = front_content.hint if present.
// Design tokens: --accent-3 (orange, 32 100% 60%) for the declension family.

// -- Local payload types -------------------------------------------------------

/** Narrowed from back_content (Record<string, unknown>) -- mirrors card_record.py:47-54 */
export interface DeclensionRow {
  case: string;
  singular: string;
  plural: string;
  highlight_singular: boolean;
  highlight_plural: boolean;
}

/** Narrowed from back_content.declension_table -- mirrors card_record.py:57-61 */
export interface DeclensionTable {
  gender: string;
  rows: DeclensionRow[];
}

// -- Type guard ----------------------------------------------------------------

function isDeclensionTable(v: unknown): v is DeclensionTable {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o['gender'] === 'string' && Array.isArray(o['rows']);
}

// -- Props --------------------------------------------------------------------

export interface DeclensionProps {
  /**
   * The full card record. back_content.declension_table is narrowed locally.
   * front_content.hint is used for the optional English gloss in the lemma row.
   */
  card: {
    back_content: Record<string, unknown>;
    front_content: Record<string, unknown>;
  };
  /**
   * false -> question phase: target cell shows tinted "?".
   * true  -> answer phase: target cell fills with real form + pf-cell-fill flash.
   */
  revealed: boolean;
}

// -- Declension renderer ------------------------------------------------------

/**
 * Declension -- paradigm table for `declension` card type.
 *
 * Renders:
 *   - Optional lemma row: "GreekNomSg -- EnglishGloss" (non-italic Noto Serif, lang="el")
 *   - 4-case x sg/pl table with one target cell blanked/filled based on `revealed`.
 *
 * Used in BOTH body (revealed=false) and foot (revealed=true) of PfCard.
 * When used in the foot, the rating controls are provided by the sibling
 * PracticeCard rendered below this component (see V2FlashcardPracticePage.tsx).
 */
export function Declension({ card, revealed }: DeclensionProps) {
  const rawTable = card.back_content['declension_table'];
  const table = isDeclensionTable(rawTable) ? rawTable : null;

  // English gloss from front_content.hint (may be absent)
  const gloss =
    typeof card.front_content['hint'] === 'string' ? (card.front_content['hint'] as string) : null;

  if (!table || table.rows.length === 0) {
    // Graceful degradation -- no paradigm data
    return (
      <div className="flex flex-col items-center gap-3 py-4" data-testid="pf-declension">
        <p style={{ color: 'hsl(var(--fg-2))' }} className="text-center text-sm">
          Paradigm not available
        </p>
      </div>
    );
  }

  // Lemma: nom-sg from rows[0] (always safe per backend guarantee)
  const lemmaNomSg = table.rows[0]?.singular ?? '';

  return (
    <div className="flex flex-col items-center gap-3 px-2 py-4" data-testid="pf-declension">
      {/* Lemma row: "GreekNomSg -- EnglishGloss" */}
      {lemmaNomSg && (
        <p className="pf-decl-lemma" data-testid="pf-decl-lemma">
          <span className="pf-decl-lemma__el" lang="el">
            {lemmaNomSg}
          </span>
          {gloss && (
            <span className="pf-decl-lemma__gloss" data-testid="pf-decl-gloss">
              {' — '}
              {gloss}
            </span>
          )}
        </p>
      )}

      {/* Paradigm table */}
      <table className="pf-decl-table" data-testid="pf-decl-grid">
        <thead>
          <tr>
            <th className="pf-decl-table__th pf-decl-table__th--case" aria-label="Case" />
            <th className="pf-decl-table__th" scope="col">
              sg
            </th>
            <th className="pf-decl-table__th" scope="col">
              pl
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.case} data-testid={`pf-decl-row-${row.case.toLowerCase()}`}>
              {/* Case label */}
              <td className="pf-decl-table__case" scope="row">
                {row.case}
              </td>

              {/* Singular cell */}
              {row.highlight_singular ? (
                <td
                  className={`pf-cell-target ${revealed ? 'is-revealed' : 'is-blank'}`}
                  data-testid="pf-decl-target"
                  lang={revealed ? 'el' : undefined}
                >
                  {revealed ? row.singular : '?'}
                </td>
              ) : (
                <td className="pf-decl-table__cell" lang="el">
                  {row.singular}
                </td>
              )}

              {/* Plural cell */}
              {row.highlight_plural ? (
                <td
                  className={`pf-cell-target ${revealed ? 'is-revealed' : 'is-blank'}`}
                  data-testid="pf-decl-target"
                  lang={revealed ? 'el' : undefined}
                >
                  {revealed ? row.plural : '?'}
                </td>
              ) : (
                <td className="pf-decl-table__cell" lang="el">
                  {row.plural}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
