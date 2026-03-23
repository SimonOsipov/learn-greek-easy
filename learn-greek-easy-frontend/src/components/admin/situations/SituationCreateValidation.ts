import type { SituationCreatePayload } from '@/types/situation';

export const SITUATION_JSON_PLACEHOLDER = `{
  "scenario_el": "Παραγγελία καφέ σε καφενείο",
  "scenario_en": "Ordering coffee at a kafeneio",
  "scenario_ru": "Заказ кофе в кафенейо"
}`;

export const SITUATION_REQUIRED_FIELDS = ['scenario_el', 'scenario_en', 'scenario_ru'] as const;

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

  return {
    valid: true,
    data: {
      scenario_el: (parsed.scenario_el as string).trim(),
      scenario_en: (parsed.scenario_en as string).trim(),
      scenario_ru: (parsed.scenario_ru as string).trim(),
    },
  };
}
