/**
 * Review screen presentation palette — src/lib/review/presentation.ts (MOB-09).
 *
 * The review screen owns an in-screen isDark toggle that is INDEPENDENT of the
 * system color scheme (and NativeWind's darkMode:'class' mechanism, which is
 * unconnected on native — nothing calls colorScheme.set).  As a result,
 * `practice-*` className tokens always resolve to their :root (LIGHT) values
 * regardless of the toggle state (MOB-13 verified).
 *
 * Fix: drive every color in the review tree from the isDark boolean via this
 * named map, using explicit rgb/rgba constants with hsl-source comments.
 * Components that receive `isDark` should call `reviewPalette(isDark)` once
 * and destructure what they need.
 *
 * Source token values from global.css :root and .dark blocks:
 *   --practice-text       light: 222 47% 11%  = rgb(15,23,42)   dark: 210 40% 96%  = rgb(234,239,245)
 *   --practice-text-muted light: 215 16% 47%  = rgb(101,112,130) dark: 215 20% 65%  = rgb(140,151,170)
 *   --practice-text-dim   light: 215 20% 65%  = rgb(140,151,170) dark: 215 16% 47%  = rgb(101,112,130)
 *   --practice-accent     light: 239 84% 67%  = rgb(97,110,245)  dark: 234 89% 74%  = rgb(129,140,248)
 *   --practice-border     light: 214 32% 91%  = rgb(220,224,234) dark: 217 19% 27%  = rgb(56,64,84)
 *   --practice-card       light: 0 0% 100%    = rgb(255,255,255) dark: 215 28% 17%  = rgb(35,46,66)
 *   --practice-bg         light: 210 40% 96%  = rgb(234,239,245) dark: 222 47% 11%  = rgb(15,23,42)
 */

export interface ReviewPalette {
  // Text
  text: string;           // primary text (lemma, headings)
  textMuted: string;      // secondary text (card counter, labels)
  textDim: string;        // tertiary text (hints, prompts, kickers)

  // Surfaces
  cardBg: string;         // flashcard background
  screenBg: string;       // screen background
  borderColor: string;    // card / UI borders

  // Accent (indigo — used for progress bar, locale pill active, "Study more" button)
  accent: string;         // solid accent fg

  // Locale segment pill active bg
  localePillBg: string;   // active EN/RU pill background (same as accent solid)

  // Icon
  iconColor: string;      // close/sun/moon icon color
}

export function reviewPalette(isDark: boolean): ReviewPalette {
  if (isDark) {
    return {
      text:          'rgb(234,239,245)',      // --practice-text dark: 210 40% 96%
      textMuted:     'rgb(140,151,170)',      // --practice-text-muted dark: 215 20% 65%
      textDim:       'rgb(101,112,130)',      // --practice-text-dim dark: 215 16% 47%
      cardBg:        'rgba(30,41,59,1)',      // --practice-card dark approx (design token)
      screenBg:      'rgb(15,23,42)',         // --practice-bg dark: 222 47% 11%
      borderColor:   'rgba(71,85,105,0.5)',   // --practice-border dark approx
      accent:        'rgb(129,140,248)',      // --practice-accent dark: 234 89% 74%
      localePillBg:  'rgb(129,140,248)',
      iconColor:     'rgb(148,163,184)',      // --practice-text-muted dark
    };
  }
  return {
    text:            'rgb(15,23,42)',         // --practice-text light: 222 47% 11%
    textMuted:       'rgb(101,112,130)',      // --practice-text-muted light: 215 16% 47%
    textDim:         'rgb(140,151,170)',      // --practice-text-dim light: 215 20% 65%
    cardBg:          'rgb(255,255,255)',      // --practice-card light: 0 0% 100%
    screenBg:        'rgb(234,239,245)',      // --practice-bg light: 210 40% 96%
    borderColor:     'rgba(203,213,225,0.8)', // --practice-border light approx
    accent:          'rgb(97,110,245)',       // --practice-accent light: 239 84% 67%
    localePillBg:    'rgb(97,110,245)',
    iconColor:       'rgb(100,116,139)',      // --practice-text-muted light
  };
}
