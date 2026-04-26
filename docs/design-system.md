# Greeklish Design System

**Source of truth.** All colors, spacing, radii, shadows, fonts, animations, and shared component patterns must come from here. If a value isn't listed, it doesn't ship.

- **Visual snapshot:** [`docs/design-system/Design-System-v2.4.html`](./design-system/Design-System-v2.4.html) — open in a browser to see swatches, components, motion demos.
- **Live tokens:** `frontend/src/index.css` (`:root` + `.dark`), `frontend/tailwind.config.js`.
- **Live components:** `frontend/src/components/ui/*` (shadcn).

---

## Drift rules

Forbidden in `src/**/*.{ts,tsx,css}` (allowed only in `src/index.css` and `tailwind.config.js`):

- Raw hex colors — use HSL tokens (`hsl(var(--primary))`).
- `style={{ color: '#...' }}`, hardcoded `rgba(...)` — use tokens or utility classes.
- Arbitrary Tailwind values like `bg-[#3b82f6]`, `text-[hsl(...)]` — use named utilities.
- New `@keyframes` — add to `src/index.css` and `tailwind.config.js` `animation` map.

If you need a value that isn't here, add it to `src/index.css` + `tailwind.config.js` AND update this doc in the same PR.

---

## Tokens

All colors stored as HSL channels (`221 83% 53%`) so `hsl(var(--x) / 0.12)` works. Both light + dark defined.

### Surfaces & foreground

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `220 30% 98%` | `224 35% 6%` | Page background |
| `--bg-2` | `220 25% 96%` | `224 30% 9%` | Section / muted background |
| `--card` | `0 0% 100%` | `224 30% 11%` | Card surface |
| `--glass` | `0 0% 100% / .55` | `224 30% 14% / .55` | Translucent glass surface |
| `--fg` | `222 32% 12%` | `210 30% 96%` | Primary text |
| `--fg-2` | `222 18% 38%` | `220 12% 70%` | Secondary text / captions |
| `--fg-3` | `222 14% 56%` | `220 10% 50%` | Tertiary text / kbd / timestamps |
| `--line` | `222 20% 90%` | `224 18% 18%` | Default border / divider |
| `--line-2` | `222 25% 84%` | `224 18% 24%` | Stronger border |

### Brand & status

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `221 83% 53%` | `221 90% 65%` | Primary action, links, focus ring |
| `--primary-2` | `221 83% 65%` | `221 90% 75%` | Gradient highlight on primary |
| `--accent` | `280 92% 62%` | (same) | Electric violet accent |
| `--accent-2` | `188 95% 50%` | (same) | Cyan accent |
| `--accent-3` | `32 100% 60%` | (same) | Burnt orange accent |
| `--success` | `160 84% 39%` | (same) | Confirm, completion, "Got it" |
| `--warning` | `38 92% 50%` | (same) | Caution, partial state |
| `--danger` | `0 78% 58%` | (same) | Destructive action, error |

### Charts

`--chart-1` … `--chart-8`. Use in this canonical order; never disagree across files.

| Token | Light HSL | Dark HSL |
|---|---|---|
| `--chart-1` | `221 83% 53%` | `217 91% 60%` |
| `--chart-2` | `160 84% 39%` | `160 84% 45%` |
| `--chart-3` | `38 92% 50%` | `43 96% 56%` |
| `--chart-4` | `270 70% 60%` | `270 70% 72%` |
| `--chart-5` | `340 75% 55%` | `340 75% 65%` |
| `--chart-6` | `190 90% 50%` | `190 90% 60%` |
| `--chart-7` | `25 95% 53%` | `27 96% 61%` |
| `--chart-8` | `142 72% 29%` | `142 72% 40%` |

### Shadcn semantic aliases

Map onto surface/brand tokens — don't redefine, alias.

| Token | Aliases | Use |
|---|---|---|
| `--popover` / `--popover-foreground` | `--card` / `--fg` | Popover / Tooltip surface |
| `--secondary` / `--secondary-foreground` | `--bg-2` / `--fg` | Neutral pill background |
| `--muted` / `--muted-foreground` | `--bg-2` / `--fg-2` | Muted backgrounds + captions |
| `--input` | `222 18% 80%` light · `224 18% 30%` dark | Form border (stronger than `--line`) |
| `--ring` | `var(--primary)` | Focus outline color |
| `--destructive-foreground` | `0 0% 100%` | White-on-danger |
| `--border-strong` | `var(--line-2)` | Emphasis dividers |

### Practice palette (study / quiz / culture surfaces)

For flashcards, mock exam, culture cards, quiz feedback. Light → dark shifts a step lighter to maintain contrast.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--practice-accent` | `239 84% 67%` (indigo-500) | `234 89% 74%` (indigo-400) | Card accent ring, focus |
| `--practice-accent-glow` / `--practice-accent-soft` | 15% / 8% alpha | (same) | Glow ring / soft fill |
| `--practice-correct` | `160 84% 39%` (emerald-500) | `158 64% 52%` (emerald-400) | "Got it" / +XP feedback |
| `--practice-correct-glow` / `--practice-correct-soft` | 15% / 8% alpha | (same) | |
| `--practice-incorrect` | `0 84% 60%` (red-500) | `0 91% 71%` (red-400) | "Again" / wrong feedback |
| `--practice-incorrect-glow` / `--practice-incorrect-soft` | 15% / 8% alpha | (same) | |
| `--practice-gold` | `38 92% 50%` (amber-500) | `43 96% 56%` (amber-400) | Streak, achievement |
| `--practice-purple` | `258 90% 66%` (violet-500) | `250 95% 76%` (violet-400) | Culture / lore |
| `--practice-bg` | `210 40% 96%` (slate-100) | `222 47% 11%` (slate-900) | Practice page background |
| `--practice-card` | `0 0% 100%` (white) | `215 28% 17%` (slate-800) | Flashcard surface |
| `--practice-border` | `214 32% 91%` (slate-200) | `217 19% 27%` (slate-700) | Card divider |
| `--practice-text` | `222 47% 11%` | `210 40% 96%` | Card primary text |
| `--practice-text-muted` | `215 16% 47%` (slate-500) | `215 20% 65%` (slate-400) | Helper / hint |
| `--practice-text-dim` | `215 20% 65%` (slate-400) | `215 16% 47%` (slate-500) | Tap-to-reveal placeholder |

### Landing palette (greeklish.eu marketing only)

Warmer / editorial. Don't mix with the glassy app palette.

| Token | Light | Dark |
|---|---|---|
| `--landing-navy` | `240 27% 14%` | `240 27% 85%` |
| `--landing-greek-blue` | `212 85% 37%` | `212 85% 60%` |
| `--landing-greek-blue-light` | `212 85% 95%` | `212 50% 20%` |
| `--landing-gold` | `45 93% 58%` | `45 93% 68%` |
| `--landing-shadow-card` | resting | (same form, dark RGB) |
| `--landing-shadow-card-hover` | hover (greek-blue tinted) | (same form, dark RGB) |

### Gradients

Decorative — no dark variants needed.

| Token pair | Hex | Use |
|---|---|---|
| `--gradient-brand-from / -to` | `#667eea → #764ba2` | Hero, primary CTA, achievement card. Brand identity. |
| `--gradient-primary-from / -to` | `#3b82f6 → #1d4ed8` | Active Tabs state. Saturated blue CTAs. |
| `--gradient-accent-from / -to` | `#fef3c7 → #fde68a` | **No consumer in `src/` today — candidate for removal, not canonization.** |

### Radii

| Token | Value | Use |
|---|---|---|
| `--radius` | `14px` | Default — buttons, inputs, cards |
| `--radius-lg` | `22px` | Glass surfaces, sheets |
| `--radius-xl` | `28px` | Practice card hero |
| (Tailwind `full`) | `9999px` | Pills, chips, switches, avatars |

Tailwind aliases: `sm = radius-4`, `md = radius-2`, `lg = radius`, `xl = radius+4`, `2xl = radius+8`, `3xl = radius+12`.

### Shadows

| Token | Use |
|---|---|
| `--shadow-1` | Resting card |
| `--shadow-2` | Floating / hover lift |
| `--shadow-3` | Modal, sheet, popover |
| `--shadow-glow` | Primary CTA glow (uses `--primary` alpha) |
| `--shadow-nav` | Top nav, subtle -2px y-offset |
| `--shadow-card-hover` | Card lift on hover |
| `--shadow-button-primary` | Brand-gradient CTA glow (`#667eea` based) |

### Fonts

| Stack | Use |
|---|---|
| `Inter` (default sans) | Body, UI |
| `Inter Tight` | Display sizes (headings, hero, metric numbers). -3% to -5% tracking. |
| `Noto Serif` | Greek study text — flashcard front, transliteration, culture body |
| `ui-monospace, SF Mono, Menlo` | Tokens, kbd, kickers, code |

Type scale: D 96/700, XL 56/700, L 28/600, M 17/500, B 15/400, S 13/500, XS 11/500. Letter-spacing: -0.05em on D, -0.04em on XL, -0.03em on L, -0.005em on body buttons.

### Spacing

4-pt rhythm. Tailwind exposes 0–96 (`24rem`). Don't reach for arbitrary values; if you need `[31px]`, round to 32 (`8`).

Common: `1=4 · 2=8 · 4=16 · 6=24 · 8=32 · 12=48 · 20=80 · 32=128 · 64=256 · 96=384`.

### Breakpoints

| Token | Width | Notes |
|---|---|---|
| `sm` | 640 | |
| `md` | 768 | |
| `lg` | 1024 | |
| `xl` | 1280 | Container caps here on most pages |
| `2xl` | 1440 | Container caps here on max-width pages |

Container is centered with `1rem` padding, fluid below `xl`.

---

## Utility classes (`src/index.css`)

Reach for these *before* composing new ones.

| Class | Purpose |
|---|---|
| `.glass` | Translucent + blur, default ambient surface |
| `.glass-strong` | Card-on-card, default for dashboard widgets |
| `.glass-fine` | Subtle vertical gradient, content blocks |
| `.kicker` | Small uppercase mono label with primary dot prefix |
| `.pill-nav` | Top-level segmented nav (also tabs variant) |
| `.btn` / `.btn-primary` / `.btn-glass` / `.btn-ghost` / `.btn-sm` / `.btn-lg` | Button system |
| `.chip` / `.chip-tinted` | Inline pills (filters, meta) |
| `.badge` + `.b-blue / -green / -amber / -red / -violet / -gray` | Translucent status badges (auto-flip in dark) |
| `.track > span` | Progress bar (primary→accent gradient by default) |
| `.practice-card` | Flashcard / culture card with radial gradient backdrop |
| `.metric-card` / `.metric-label` / `.metric-value` / `.metric-sublabel` | Dashboard metric tile anatomy |
| `.hairline` | `border-color: hsl(var(--line))` |
| `.text-fg2` / `.text-fg3` | Foreground variants |

---

## Component primitives (`src/components/ui/*`)

All shadcn-based, all token-aware. Don't re-implement these inline.

**Buttons & inputs:** `button`, `input`, `textarea`, `label`, `checkbox`, `switch`, `slider`, `select`, `form` (RHF wrapper)
**Overlays:** `popover`, `tooltip`, `dialog`, `alert-dialog`, `alert`, `sheet`, `toast` + `toaster`, `dropdown-menu`
**Disclosure:** `accordion`, `collapsible`, `tabs`, `navigation-menu`
**Layout / data:** `card`, `avatar`, `skeleton`, `separator`, `scroll-area`, `table`, `scrollable-table` (sticky-header for wide tables — used in Conjugation / Declension), `chart` (Recharts wrapper, pulls from `--chart-1..8`), `progress`, `badge`
**Audio:** `SpeakerButton`, `AudioSpeedToggle` (paired with SpeakerButton: 0.75× / 1× / 1.25× pill)

---

## Animations (`tailwind.config.js`)

Use the named animation; don't write inline `@keyframes` in components.

**Component motion** (drives shadcn primitives — don't override):
- `shimmer` (2s linear ∞) → Skeleton
- `accordion-down` / `accordion-up` (200ms) → Accordion
- `collapsible-down` / `collapsible-up` (200ms) → Collapsible
- `highlight-pulse` (0.5s × 3) → notification deep-link arrival on a feedback card

**Surface motion** (page-level):
- `fade-in` / `slide-up` / `scale-in` / `pop-in` (300ms) — generic dashboard reveals
- `pulse-subtle` (2s ∞) — live indicators
- `float` (6s ∞) — hero ornaments
- `counter` (350ms scale 1.2→1 + fade 0.5→1) — metric tick (streak, mastered)
- `fade-up` (600ms, 20px translate) — **landing page only**, distinct from `slide-up`
- `landing-fade-in` (400ms opacity-only) — marketing surfaces
- `theme-transition` (200ms) — bg + border + color cross-fade on light/dark toggle

**Practice motion** (quiz feedback — distinct timings, faster than dashboard):
- `practice-fade-in` (300ms)
- `practice-slide-up` (350ms)
- `practice-pop-in` (300ms with spring)

**Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (smooth) — universal. No spring physics outside `practice-pop-in`.

**Reduced motion:** all of the above collapse to `0.01ms` under `prefers-reduced-motion: reduce`. Already handled in `index.css` — never override.

---

## Accessibility

- **Focus:** `*:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px }`. Mouse users don't see it; keyboard users always do. Never `outline: none` without a replacement.
- **Touch targets:** every interactive element clears 44×44, even when the visual is smaller. Use invisible padding.
- **Contrast targets:** body text ≥ 7:1 (AAA). UI chrome ≥ 4.5:1 (AA). Brand gradient never carries text.
- **Greek text:** `lang="el"` on Greek, `lang="el-Latn"` on transliterations. Greek TTS won't pronounce English words and vice versa.
- **Icon-only buttons:** always carry `aria-label`. SVG inside is `aria-hidden="true"`.
- **Live regions:** `role="status" aria-live="polite"` for streak / metric updates.
- **Skip link:** `<a href="#main">` is the first focusable element on every page.
- **Landmarks:** explicit `<header> <nav aria-label="Primary"> <main id="main"> <aside> <footer>`.
- **Keyboard:** practice loop is one-handed (`Space` flip, `1` again, `2` got-it). `⌘K` opens command bar globally. `/` jumps to search. `Esc` closes overlays.

---

## Voice & tone (microcopy)

Greeklish is **a friend who happens to know Greek** — patient, warm, honest. Never a textbook, never a cheerleader.

- **Voice is:** warm not saccharine · specific not generic · honest about difficulty · curious about culture · brief then quiet.
- **Voice isn't:** rah-rah motivational · streak-shaming · translingual punning · emoji-heavy · stiff / academic.

Glossary (use *left*, not *right*):

| Use | Not |
|---|---|
| Practice | Train · Drill |
| Card | Item · Question |
| Deck | Set · Module |
| Mastered | Completed · Done |
| Review | Retest · Quiz |
| Streak | Combo · Run |
| Got it / Again | Right / Wrong |

See the v2.4 HTML "Voice & tone" tab for full do/don't rewrite examples.

---

## Updating this doc

When you add a token / class / animation / component:

1. Define it in `src/index.css` or `tailwind.config.js`.
2. Add a row to the relevant table above.
3. If it's a non-trivial visual addition, also update `Design-System-v2.4.html` (or bump to `-v2.5.html` if the change is large enough to warrant a snapshot).
4. PR description should call it out under "Design system delta".
