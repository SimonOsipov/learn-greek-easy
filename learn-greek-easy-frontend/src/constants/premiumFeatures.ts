export interface ComparisonFeature {
  labelKey: string; // i18n key in 'upgrade' namespace
  free: boolean | string; // true = checkmark, false = X, string = i18n key for text value
  premium: boolean | string; // same
}

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  { labelKey: 'features.baseDecks', free: true, premium: true },
  {
    labelKey: 'features.dailyPractice.label',
    free: 'features.dailyPractice.free',
    premium: 'features.dailyPractice.premium',
  },
  {
    labelKey: 'features.personalDecks.label',
    free: 'features.personalDecks.free',
    premium: 'features.personalDecks.premium',
  },
  { labelKey: 'features.historyCulturePractice', free: true, premium: true },
  { labelKey: 'features.themedDecks', free: false, premium: true },
  { labelKey: 'features.verbConjugationPractice', free: false, premium: true },
  { labelKey: 'features.nounCasePractice', free: false, premium: true },
  { labelKey: 'features.articlePractice', free: false, premium: true },
  { labelKey: 'features.singularPluralPractice', free: false, premium: true },
  { labelKey: 'features.currentNews', free: false, premium: true },
];

export const PREMIUM_ONLY_FEATURES: ComparisonFeature[] = COMPARISON_FEATURES.filter(
  (f) => !f.free
);
