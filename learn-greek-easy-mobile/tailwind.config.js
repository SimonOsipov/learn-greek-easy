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
        'on-photo-96': 'rgba(255,255,255,0.96)',
        'on-photo-scrim-42': 'rgba(8,11,20,0.42)',     // --on-photo-scrim 225 43% 5% ≈ rgb(8,11,20)
        'danger-18': 'rgba(239,68,68,0.18)',            // --danger 0 78% 58% ≈ rgb(239,68,68)
        'danger-55': 'rgba(239,68,68,0.55)',
        'danger-70': 'rgba(239,68,68,0.70)',
        'badge-recommended-25': 'rgba(255,149,10,0.25)', // --badge-recommended 34 100% 52% = rgb(255,149,10)
        // Primary at 0.15 alpha for the selected-tile badge flip (221 83% 53% = rgb(36,99,235)).
        // Light-theme value; theme-invariant by design (selected-tile surface shows in light only).
        'primary-15': 'rgba(36,99,235,0.15)',
        // === end MOB-13 explicit opacity tokens ===
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
