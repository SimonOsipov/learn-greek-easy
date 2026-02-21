export interface ComparisonFeature {
  labelKey: string; // i18n key in 'upgrade' namespace
  free: boolean;
  premium: boolean;
}

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  { labelKey: 'features.basicVocabulary', free: true, premium: true },
  { labelKey: 'features.limitedDailyPractice', free: true, premium: true },
  { labelKey: 'features.limitedPersonalDecks', free: true, premium: true },
  { labelKey: 'features.progressTracking', free: true, premium: true },
  { labelKey: 'features.communityAccess', free: true, premium: true },
  { labelKey: 'features.allVocabularyThemes', free: false, premium: true },
  { labelKey: 'features.unlimitedPractice', free: false, premium: true },
  { labelKey: 'features.verbConjugations', free: false, premium: true },
  { labelKey: 'features.realNewsAudio', free: false, premium: true },
  { labelKey: 'features.historyCulture', free: false, premium: true },
  { labelKey: 'features.prioritySupport', free: false, premium: true },
];

export const PREMIUM_ONLY_FEATURES: ComparisonFeature[] = COMPARISON_FEATURES.filter(
  (f) => !f.free
);
