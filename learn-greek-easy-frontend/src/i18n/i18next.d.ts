// Augments i18next key typing from the synchronously-bundled EN resources
// (source of truth: src/i18n/init.ts). verbatimModuleSyntax:true REQUIRES
// `import type` for every bundle (consumed only via typeof) — else TS1484.
// strictKeyChecks:true selects TFunctionStrict, which enforces literal key
// constraints even when defaultValue is provided.
import type achievements from './locales/en/achievements.json';
import type admin from './locales/en/admin.json';
import type auth from './locales/en/auth.json';
import type changelog from './locales/en/changelog.json';
import type common from './locales/en/common.json';
import type culture from './locales/en/culture.json';
import type deck from './locales/en/deck.json';
import type feedback from './locales/en/feedback.json';
import type landing from './locales/en/landing.json';
import type mockExam from './locales/en/mockExam.json';
import type profile from './locales/en/profile.json';
import type review from './locales/en/review.json';
import type settings from './locales/en/settings.json';
import type statistics from './locales/en/statistics.json';
import type subscription from './locales/en/subscription.json';
import type upgrade from './locales/en/upgrade.json';
import type waitlist from './locales/en/waitlist.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    strictKeyChecks: true;
    resources: {
      achievements: typeof achievements;
      admin: typeof admin;
      auth: typeof auth;
      changelog: typeof changelog;
      common: typeof common;
      culture: typeof culture;
      deck: typeof deck;
      feedback: typeof feedback;
      landing: typeof landing;
      mockExam: typeof mockExam;
      profile: typeof profile;
      review: typeof review;
      settings: typeof settings;
      statistics: typeof statistics;
      subscription: typeof subscription;
      upgrade: typeof upgrade;
      waitlist: typeof waitlist;
    };
  }
}
