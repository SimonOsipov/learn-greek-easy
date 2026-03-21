import type { SituationCreatePayload } from '@/types/situation';

export const SITUATION_JSON_PLACEHOLDER = `{
  "scenario_el": "Παραγγελία καφέ σε καφενείο",
  "scenario_en": "Ordering coffee at a kafeneio",
  "scenario_ru": "Заказ кофе в кафенейо",
  "cefr_level": "A1"
}`;

export const SITUATION_REQUIRED_FIELDS = [
  'scenario_el',
  'scenario_en',
  'scenario_ru',
  'cefr_level',
] as const;

export const VALID_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

export interface SituationValidationSuccess {
  valid: true;
  data: SituationCreatePayload;
}

export interface SituationValidationFailure {
  valid: false;
  error: {
    messageKey: string;
  };
}

export type SituationValidationResult = SituationValidationSuccess | SituationValidationFailure;

export function validateSituationJson(raw: string): SituationValidationResult {
  let parsed: Record<string, unknown>;
  try {
    const rawParsed: unknown = JSON.parse(raw);
    if (typeof rawParsed !== 'object' || rawParsed === null || Array.isArray(rawParsed)) {
      return { valid: false, error: { messageKey: 'situations.validation.invalidJson' } };
    }
    parsed = rawParsed as Record<string, unknown>;
  } catch {
    return { valid: false, error: { messageKey: 'situations.validation.invalidJson' } };
  }

  const missingFields = SITUATION_REQUIRED_FIELDS.filter(
    (field) =>
      !parsed[field] || typeof parsed[field] !== 'string' || !(parsed[field] as string).trim()
  );
  if (missingFields.length > 0) {
    return { valid: false, error: { messageKey: 'situations.validation.missingFields' } };
  }

  if (!VALID_CEFR_LEVELS.includes(parsed.cefr_level as (typeof VALID_CEFR_LEVELS)[number])) {
    return { valid: false, error: { messageKey: 'situations.validation.invalidCefrLevel' } };
  }

  return {
    valid: true,
    data: {
      scenario_el: (parsed.scenario_el as string).trim(),
      scenario_en: (parsed.scenario_en as string).trim(),
      scenario_ru: (parsed.scenario_ru as string).trim(),
      cefr_level: parsed.cefr_level as SituationCreatePayload['cefr_level'],
    },
  };
}
