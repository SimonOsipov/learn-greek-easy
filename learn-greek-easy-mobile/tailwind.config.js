/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        'bg-2': 'hsl(var(--bg-2))',
        card: 'hsl(var(--card))',
        fg: 'hsl(var(--fg))',
        fg2: 'hsl(var(--fg-2))',
        fg3: 'hsl(var(--fg-3))',
        line: 'hsl(var(--line))',
        'line-2': 'hsl(var(--line-2))',
        primary: 'hsl(var(--primary))',
        'primary-2': 'hsl(var(--primary-2))',
        accent: 'hsl(var(--accent))',
        'accent-2': 'hsl(var(--accent-2))',
        'accent-3': 'hsl(var(--accent-3))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        'danger-soft': 'hsl(var(--danger-soft))',
        'danger-softer': 'hsl(var(--danger-softer))',
        popover: 'hsl(var(--popover))',
        secondary: 'hsl(var(--secondary))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        'border-strong': 'hsl(var(--border-strong))',
        'on-photo': 'hsl(var(--on-photo-fg))',
        'on-photo-scrim': 'hsl(var(--on-photo-scrim))',
        'on-photo-active': 'hsl(var(--on-photo-active-fg))',
        // Over-photo "Recommended" badge — brand Cyprus gold (34 100% 52% = rgb(255,149,10)).
        // Theme-invariant, no .dark override (over-photo surface). MOB-13: no /NN modifier on
        // var-backed tokens on native — explicit full-color rgba tokens are mandatory.
        'badge-recommended': 'hsl(var(--badge-recommended))',
        // === MOB-13 explicit opacity tokens (NativeWind native workaround) — full-colour rgba,
        // used WITHOUT a /NN modifier (the /NN modifier renders dark on native for var-backed
        // tokens via unsupported color-mix(). See learn-greek-easy-mobile/docs/design-tokens.md
        // for the full decision record, root cause, and rejected alternatives). ===
        //
        // Decision (NWOPA-02): explicit full-colour <base>-<NN> rgba tokens (NN = integer alpha
        // percent, value rgba(R,G,B,0.NN)) are canonical for translucent native surfaces.
        // The /<NN> modifier on var-backed tokens is FORBIDDEN on native (routes through
        // color-mix() → renders dark). <alpha-value> was REJECTED (MOB-09 / PR #555: still
        // rendered dark on a clean cache-busted Release build). Element-level opacity-NN /
        // active:opacity-NN is SAFE/out-of-scope (RN style.opacity — cite login.tsx:387/441/455,
        // observability-debug.tsx:34/50). NativeWind upgrade DEFERRED pending on-device verify.
        'on-photo-10': 'rgba(255,255,255,0.10)',
        'on-photo-14': 'rgba(255,255,255,0.14)',
        'on-photo-18': 'rgba(255,255,255,0.18)',
        'on-photo-22': 'rgba(255,255,255,0.22)',
        'on-photo-25': 'rgba(255,255,255,0.25)',
        'on-photo-55': 'rgba(255,255,255,0.55)',
        'on-photo-60': 'rgba(255,255,255,0.60)',
        'on-photo-66': 'rgba(255,255,255,0.66)',
        'on-photo-72': 'rgba(255,255,255,0.72)',
        'on-photo-78': 'rgba(255,255,255,0.78)',
        'on-photo-85': 'rgba(255,255,255,0.85)',
        'on-photo-92': 'rgba(255,255,255,0.92)',
        'on-photo-96': 'rgba(255,255,255,0.96)',
        'on-photo-scrim-42': 'rgba(8,11,20,0.42)',     // --on-photo-scrim 225 43% 5% ≈ rgb(8,11,20)
        'danger-18': 'rgba(239,68,68,0.18)',            // --danger 0 78% 58% ≈ rgb(239,68,68)
        'danger-55': 'rgba(239,68,68,0.55)',
        'danger-70': 'rgba(239,68,68,0.70)',
        'badge-recommended-25': 'rgba(255,149,10,0.25)', // --badge-recommended 34 100% 52% = rgb(255,149,10)
        // Primary at 0.15 alpha for the selected-tile badge flip (221 83% 53% = rgb(36,99,235)).
        // Light-theme value; theme-invariant by design (selected-tile surface shows in light only).
        'primary-15': 'rgba(36,99,235,0.15)',
        // EntryCard violet tone tints (DASH-06): 280 70% 60% = rgb(177,82,224).
        'entry-violet': 'rgb(177,82,224)',          // iconFg — solid accent
        'entry-violet-16': 'rgba(177,82,224,0.16)', // iconBg — MOB-13 explicit alpha
        'entry-violet-32': 'rgba(177,82,224,0.32)', // ring/glow — MOB-13 explicit alpha
        // EntryCard amber tone tints (DASH-06): 38 92% 55% = rgb(246,168,35).
        'entry-amber': 'rgb(246,168,35)',            // iconFg — solid accent
        'entry-amber-16': 'rgba(246,168,35,0.16)',  // iconBg — MOB-13 explicit alpha
        'entry-amber-32': 'rgba(246,168,35,0.32)',  // ring/glow — MOB-13 explicit alpha
        // Scrim dark at 6% alpha — used as watermark tint on light card surfaces
        // (e.g. WordOfDayCard). Base: 225 40% 12% ≈ rgb(15,23,42) (near-black-blue).
        'on-dark-06': 'rgba(15,23,42,0.06)',
        // WhatsNew green dot: 150 60% 48% = rgb(49,196,122).
        'whats-new-green': 'rgb(49,196,122)',
        // StatGrid tints (DASH-07): icon-badge fill colours for the 2×2 stat tiles.
        // Each has a solid fg token + a 14%-alpha bg token (MOB-13 explicit rgba).
        // stat-amber reuses the entry-amber base; stat-green reuses the whats-new-green base.
        // stat-primary: 221 83% 53% = rgb(36,99,235) — same base as primary-15.
        // stat-violet:  280 70% 65% = rgb(187,103,228) — slightly lighter than entry-violet.
        'stat-amber-14':  'rgba(246,168,35,0.14)',  // 38 92% 55% — same base as entry-amber
        'stat-green': 'rgb(49,196,122)',             // 150 60% 48% — same base as whats-new-green
        'stat-green-14':  'rgba(49,196,122,0.14)',   // 150 60% 48%
        'stat-green-18':  'rgba(49,196,122,0.18)',   // 150 60% 48% — QuickDrill icon bg
        'stat-green-25':  'rgba(49,196,122,0.25)',   // 150 60% 48% — QuickDrill card border
        'stat-primary-14': 'rgba(36,99,235,0.14)',  // --primary 221 83% 53%
        'stat-violet': 'rgb(187,103,228)',           // 280 70% 65%
        'stat-violet-14': 'rgba(187,103,228,0.14)', // 280 70% 65%
        // === end MOB-13 explicit opacity tokens ===

        // === MOB-08 situation-flow semantic accents ===
        // Fixed in both themes — correct hsl(160 65% 42%) = rgb(37,177,130),
        // incorrect hsl(0 78% 58%) = rgb(239,68,68) (same as danger),
        // exercise modality violet hsl(280 70% 55%) = rgb(177,82,224) (same as entry-violet).
        // MOB-13 explicit alpha variants for transparent surfaces:
        'correct': 'rgb(37,177,130)',           // hsl(160 65% 42%) — correct answer solid
        'correct-14': 'rgba(37,177,130,0.14)',  // option background on correct — MOB-13
        'correct-10': 'rgba(37,177,130,0.10)',  // footer banner bg — MOB-13
        'correct-30': 'rgba(37,177,130,0.30)',  // footer banner border — MOB-13
        // incorrect = danger (already defined: danger, danger-18, danger-55, danger-70)
        // exercise-violet = entry-violet (already defined: entry-violet, entry-violet-16, entry-violet-32)
        // Scene gradient palette for situation tiles — 5 tones per handoff
        // (amber|blue|cyan|green|violet). Two stop pairs, 135deg.
        // Stored as solid start/end colours; gradient constructed in LinearGradient.
        // hsl sources in comments; full rgb values per MOB-13 convention.
        'scene-amber-from': 'rgb(246,168,35)',   // hsl(38 92% 55%)
        'scene-amber-to':   'rgb(153,82,22)',     // hsl(20 85% 34%)  ≈ hsl(20 85% 34%)
        'scene-blue-from':  'rgb(45,125,221)',    // hsl(212 80% 52%) ≈ rgb(45,125,221)
        'scene-blue-to':    'rgb(33,57,131)',     // hsl(225 60% 32%)
        'scene-cyan-from':  'rgb(26,178,199)',    // hsl(188 80% 44%)
        'scene-cyan-to':    'rgb(30,90,160)',     // hsl(212 70% 37%)
        'scene-green-from': 'rgb(37,177,130)',    // hsl(160 65% 42%)
        'scene-green-to':   'rgb(20,110,90)',     // hsl(180 55% 25%)
        'scene-violet-from':'rgb(164,82,224)',    // hsl(280 75% 60%)
        'scene-violet-to':  'rgb(43,33,128)',     // hsl(248 59% 32%)
        // === end MOB-08 semantic accents + scene palette ===

        // === MOB-12 word-detail tokens ===
        // Primary alpha tints for hero gradient wash + speaker/POS badge surfaces.
        // Base: 221 83% 53% = rgb(36,99,235). MOB-13: explicit rgba, no /NN modifier.
        'primary-04': 'rgba(36,99,235,0.04)',
        'primary-06': 'rgba(36,99,235,0.06)',
        'primary-10': 'rgba(36,99,235,0.10)',
        'primary-20': 'rgba(36,99,235,0.20)',
        // Gender badge background tints — masc/fem/neut.
        // masc: 212 85% 45% = rgb(31,104,190); fem: 340 65% 50% = rgb(181,38,101).
        // neut reuses correct-14 (37,177,130 at 0.14) — already defined.
        'gender-masc-12': 'rgba(31,104,190,0.12)',
        'gender-fem-12':  'rgba(181,38,101,0.12)',
        // === end MOB-12 word-detail tokens ===

        // === MOB-09 practice palette (card review) ===
        // HSL-var-backed tokens — DO NOT use /NN opacity modifier on native (MOB-13).
        // Use explicit rgba tokens below for any translucent surface.
        'practice-bg': 'hsl(var(--practice-bg))',
        'practice-card': 'hsl(var(--practice-card))',
        'practice-border': 'hsl(var(--practice-border))',
        'practice-text': 'hsl(var(--practice-text))',
        'practice-text-muted': 'hsl(var(--practice-text-muted))',
        'practice-text-dim': 'hsl(var(--practice-text-dim))',
        'practice-accent': 'hsl(var(--practice-accent))',
        'practice-correct': 'hsl(var(--practice-correct))',
        'practice-incorrect': 'hsl(var(--practice-incorrect))',
        'practice-hard': 'hsl(var(--practice-hard))',
        // MOB-13 explicit rgba opacity tokens for practice palette.
        // Light theme values used as fixed rgba (no dark switching needed — review
        // screen uses its own independent theme toggle, not the system theme).
        // correct: light 160 84% 39% = rgb(20,184,103); dark 158 64% 52% = rgb(47,192,119)
        // We use light-theme values as these are used for tinted surfaces (bg, border, etc.)
        // The correct token itself is var-backed and will flip with the dark class.
        'practice-correct-10': 'rgba(20,184,103,0.10)',  // light --practice-correct at 10%
        'practice-correct-15': 'rgba(20,184,103,0.15)',  // light --practice-correct at 15%
        'practice-incorrect-12': 'rgba(220,38,38,0.12)', // --practice-incorrect ≈ rgb(220,38,38) at 12%
        'practice-hard-12': 'rgba(234,119,23,0.12)',     // --practice-hard ≈ rgb(234,119,23) at 12%
        'practice-accent-12': 'rgba(79,70,229,0.12)',    // --practice-accent ≈ indigo at 12%
        // === end MOB-09 practice palette ===
      },
      borderRadius: {
        sm: '10px',
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '26px',
      },
      fontFamily: {
        // Spline Sans body stack — loaded via useFonts as SplineSans_400Regular etc.
        sans: 'SplineSans_400Regular',
        // Inter Tight display/heading — loaded via useFonts as InterTight_700Bold etc.
        heading: 'InterTight_700Bold',
        // Noto Serif italic display — loaded via useFonts as NotoSerif_400Regular_Italic.
        // Used on the Summary screen for the user's name. font-serif → Noto Serif italic.
        serif: 'NotoSerif_400Regular_Italic',
        mono: 'SpaceMono_400Regular',
        rounded: 'var(--font-rounded)',
      },
    },
  },
  plugins: [],
};
