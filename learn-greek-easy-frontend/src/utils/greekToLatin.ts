/**
 * Shared Greek-to-Latin transliteration map.
 *
 * Used by:
 *   - toAsciiLemma (src/utils/nounPayloadBuilder.ts) — lemma IDs
 *   - judge (src/features/practice/pf/judge.ts) — Greeklish leniency leg
 *
 * Do NOT add a second copy of this map. Import from here.
 * Both sigmas (σ, ς) map to 's'.
 */
export const GREEK_TO_LATIN: Readonly<Record<string, string>> = {
  α: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'u',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
};
