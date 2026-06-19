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
- Raw CSS color keywords (`text-white`, `bg-black`, `border-white`, `style={{ color: 'white' }}`) — use a token (e.g. `text-landing-header-fg`, `text-primary-foreground`). `transparent` and `currentColor` remain allowed because they carry semantic, not chromatic, meaning.
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
| `--fg-3` | `222 14% 45%` | `220 10% 50%` | Tertiary text / kbd / timestamps (light darkened 56%→45% → 4.95:1 on `--bg`, WCAG-AA — ADMIN2-31; fixes Dashboard `.kicker` 3.33:1) |
| `--line` | `222 20% 90%` | `224 18% 18%` | Default border / divider |
| `--line-2` | `222 25% 84%` | `224 18% 24%` | Stronger border |

### Brand & status

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `221 83% 53%` | `221 90% 65%` | Primary action, links, focus ring |
| `--primary-2` | `221 83% 65%` | `221 90% 75%` | Gradient highlight on primary |
| `--accent` | `262 83% 58%` | (same) | Violet accent |
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
| `--practice-hard` | `25 95% 53%` (orange-500) | `25 95% 63%` (orange-400) | "Hard" SRS rating (between incorrect and correct) |
| `--practice-hard-glow` / `--practice-hard-soft` | 15% / 8% alpha | (same) | |
| `--practice-gold` | `38 92% 50%` (amber-500) | `43 96% 56%` (amber-400) | Streak, achievement |
| `--practice-purple` | `258 90% 66%` (violet-500) | `250 95% 76%` (violet-400) | Culture / lore |
| `--practice-bg` | `210 40% 96%` (slate-100) | `222 47% 11%` (slate-900) | Practice page background |
| `--practice-card` | `0 0% 100%` (white) | `215 28% 17%` (slate-800) | Flashcard surface |
| `--practice-border` | `214 32% 91%` (slate-200) | `217 19% 27%` (slate-700) | Card divider |
| `--practice-text` | `222 47% 11%` | `210 40% 96%` | Card primary text |
| `--practice-text-muted` | `215 16% 47%` (slate-500) | `215 20% 65%` (slate-400) | Helper / hint |
| `--practice-text-dim` | `215 20% 65%` (slate-400) | `215 16% 47%` (slate-500) | Tap-to-reveal placeholder |

### Founders palette (pricing tier)

Amber-family tokens for the Founders / semi-annual pricing tier. Auto-flips in dark mode — no manual `dark:` overrides needed in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--founders-surface` | `48 100% 96%` (amber-50) | `20 91% 14%` (amber-950 hue, dark surface) | Card background tint |
| `--founders-soft` | `48 96% 89%` (amber-100) | `26 80% 22%` (lifted amber-900) | Icon bg, soft fill |
| `--founders-border` | `43 96% 56%` (amber-400) | `43 96% 56%` (same — accent ring stays bright) | Card border, ring |
| `--founders-accent` | `38 92% 50%` (amber-500) | `38 92% 50%` (same) | Badge bg, check icon |
| `--founders-brand` | `26 90% 37%` (amber-700) | `26 90% 50%` (amber-600 lightness) | Button bg, text |
| `--founders-brand-hover` | `23 83% 31%` (amber-800) | `23 83% 44%` (lighter for dark) | Button hover |

Tailwind namespace: `founders-{surface,soft,border,accent,brand,brand-hover}`.

### Tense palette (decorative categorical)

Six categorical tokens used in `TenseBadge` and `MediaBadge`. Light values are saturated for text-on-soft-surface; dark values are lifted for readability. Soft surfaces use `/15` alpha: `bg-tense-N/15 text-tense-N`.

| Token | Light | Dark | Mapping |
|---|---|---|---|
| `--tense-1` | `160 64% 30%` (emerald) | `158 64% 75%` | present, grammar (emerald/teal family) |
| `--tense-2` | `26 80% 40%` (amber) | `45 90% 70%` | imperfect, article (amber/orange family) |
| `--tense-3` | `215 25% 35%` (slate) | `220 12% 75%` | past (slate/neutral) |
| `--tense-4` | `200 80% 35%` (sky) | `200 90% 70%` | future, vocabulary (sky/blue family) |
| `--tense-5` | `262 60% 45%` (violet) | `262 80% 75%` | perfect, plural (violet/purple) |
| `--tense-6` | `350 70% 45%` (rose) | `350 90% 75%` | imperative (rose/red) |

Tailwind namespace: `tense-{1..6}`. For `MediaBadge` solid badges: `bg-tense-N text-white`. For `TenseBadge` soft surfaces: `bg-tense-N/15 text-tense-N`.

### Situations thumbnail palette

Six decorative tones for Situations card thumbnails. Each tone = two HSL stops; canonical usage is `linear-gradient(135deg, hsl(var(--sit-thumb-<tone>-from)), hsl(var(--sit-thumb-<tone>-to)))` with white foreground glyph/text overlay.

| Tone | Light `from → to` | Dark `from → to` | Family |
|------|-------------------|------------------|--------|
| `blue` | `221 85% 62%` → `205 88% 52%` | `221 75% 50%` → `205 80% 42%` | primary / brand blue |
| `amber` | `38 92% 60%` → `24 90% 54%` | `38 80% 50%` → `24 78% 44%` | warning / amber-orange |
| `violet` | `280 82% 64%` → `262 70% 56%` | `280 70% 52%` → `262 62% 46%` | accent / violet-purple |
| `cyan` | `188 85% 56%` → `200 88% 48%` | `188 75% 46%` → `200 78% 40%` | accent-2 / sky-cyan |
| `green` | `160 70% 48%` → `145 72% 40%` | `160 62% 40%` → `145 64% 34%` | success / emerald |
| `red` | `0 78% 62%` → `350 75% 54%` | `0 68% 52%` → `350 66% 46%` | danger / rose |

> No Tailwind utility namespace; consume via inline `style={{ background: ... }}` or a dedicated `.sit-thumb-*` class added when SIT-02 lands. Tokens have no `/alpha` consumers — only used as opaque gradient stops.

### Landing palette (greeklish.eu marketing only)

Warmer / editorial. Don't mix with the glassy app palette.

The landing page **follows the app theme** (light theme = light page, dark theme = dark page). The page wrapper uses `bg-background`, and the `--landing-navy` / `--landing-greek-blue-light` tokens are mapped so that `landing-navy` is dark text on light bg / light text on dark bg, and `landing-greek-blue-light` is dark heading text on light bg / near-white heading text on dark bg.

Two surfaces are **theme-invariant** because they sit over the dark hero / final-CTA photography in both themes — the photo overlay must always stay dark and text on top must always stay near-white:
- **Photo overlays** (Hero gradient, FinalCTA overlay, Hero badge bg): use `--landing-header-bg` (always `240 27% 14%`).
- **Text & icons over the photo** (Hero title/subtitle/badge, Hero waitlist input, FinalCTA copy): use `--landing-header-fg` (always `212 85% 95%`).

Forms and CTAs over the photo use the glass-input recipe (`bg-landing-header-bg/40` with `placeholder:text-landing-header-fg/80` and `border-landing-header-fg/30`; primary CTA: the `landing-primary` button variant). The glass pill uses the dark `header-bg` tint (not `header-fg`) so the near-white placeholder always sits on a darker fill — light-on-light blends out when the underlying photo or gradient stop is bright. Do not use the app `--background` / `--primary` defaults inside the photo overlays — those flip with theme and produce a stark white panel in light mode over the dark photo.

| Token | Light | Dark |
|---|---|---|
| `--landing-navy` | `240 27% 14%` | `240 27% 85%` |
| `--landing-greek-blue` | `212 85% 37%` | `212 85% 60%` |
| `--landing-greek-blue-light` | `212 50% 20%` | `212 85% 95%` |
| `--landing-gold` | `34 100% 42%` | `34 100% 52%` (Cyprus-flag copper, Pantone 1385 / `#D57800` in light mode; +10% lightness in dark mode) |
| `--landing-header-bg` | `240 27% 14%` | `240 27% 14%` (same — header is always dark-navy chrome) |
| `--landing-header-fg` | `212 85% 95%` | `212 85% 95%` (same — near-white, theme-invariant) |
| `--landing-shadow-card` | resting | (same form, dark RGB) |
| `--landing-shadow-card-hover` | hover (greek-blue tinted) | (same form, dark RGB) |

### Gradients

Decorative — no dark variants needed.

| Token pair | Hex | Use |
|---|---|---|
| `--gradient-primary-from / -to` | `#3b82f6 → #1d4ed8` | Active Tabs state. Saturated blue CTAs. |
| `--gradient-success-from / -to` | `#10b981 → #16a34a` | Success button (`button` variant `success` → `bg-gradient-success`). |
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
| `'JetBrains Mono', ui-monospace, SF Mono, Menlo` | Tokens, kbd, kickers, code. **App/admin canonical = JetBrains Mono** — Tailwind `font-mono` resolves to it (`tailwind.config.js`), and admin chrome (`.drawer-breadcrumb`, badges, ID/token CSS) is JetBrains Mono-first. |

> Mono is palette-scoped: the App/admin stack is JetBrains Mono-first (above), while the Practice palette uses `--practice-font-mono` (bare `ui-monospace`) and the shared `<Kicker>` primitive (`.kicker`) intentionally stays on the `ui-monospace` stack. Font-family audits must respect this split.

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
| `.kicker` | Small uppercase mono label with primary dot prefix. `<Kicker dot="…">` accepts tones: `primary` (default), `blue` (`--primary`), `cyan` (`--accent-2`), `violet` (`--accent`), `amber` (`--warning`), `green`/`success` (`--success`), `red` (`--danger`), `gray`. |
| `.pill-nav` | Top-level segmented nav (also tabs variant) |
| `.btn` / `.btn-primary` / `.btn-glass` / `.btn-ghost` / `.btn-sm` / `.btn-lg` | Button system |
| `.chip` / `.chip-tinted` | Inline pills (filters, meta) |
| `.badge` + `.b-blue / -green / -amber / -red / -violet / -gray` | Translucent status badges (auto-flip in dark) |
| `.badge.on-photo` | Modifier for badges placed over photographs (e.g. deck cards). Replaces the translucent `b-*` bg with an opaque card-tinted frosted-glass surface (`hsl(--card)/0.85` + 8px backdrop-blur + `--line` border) so the badge stays readable regardless of the photo. Compose: `badge b-blue on-photo`. |
| `.track > span` | Progress bar (primary→accent gradient by default) |
| `.practice-card` | Flashcard / culture card with radial gradient backdrop |
| `.metric-card` / `.metric-label` / `.metric-value` / `.metric-sublabel` | Dashboard metric tile anatomy |
| `.hairline` | `border-color: hsl(var(--line))` |
| `.text-fg2` / `.text-fg3` | Foreground variants |
| `.admin-card` | **Canonical admin list-item surface.** White `hsl(var(--card))` card on the page canvas with a hairline `hsl(var(--fg) / 0.08)` border, `--radius-lg`, and a hover lift (`translateY(-2px)` + `--shadow-2`). The single source of truth for every admin list/row/card skin — compose it with a component-specific layout class (grid/padding). Used by `.cl-entry` (changelog) and applied via className; mirrored by `.sit-card`, `.news-card`, `.fb-card`, `.an-row`. |
| `.fb-*` family | Admin feedback re-skin chrome (card, vote rail, status grid, canned chips, thread bubbles, meta table). The `.fb-card` surface follows the canonical white-card skin (`--card` bg, `--fg/0.08` border, hover lift). See `src/index.css` under `@layer components`. Token-only — no raw hex. |
| `.cl-*` family | Admin changelog card list + editor chrome (each entry is a white `.admin-card`; month head, tag-button tones, translation pills, preview card). The legacy timeline rail/dot has been removed — category colour is conveyed by the in-card `Badge`. Tag-button tones via `data-tone` on `.cl-tag-btn`: green=`--success`, amber=`--warning`, blue=`--primary`, cyan=`--accent-2`, violet=`--accent`, red=`--danger`. Token-only; no new tokens introduced. |

### Admin row-action reveal convention (Mechanism A, ADMIN2-36)

All admin list rows and cards reveal their action buttons on hover/focus using hand-written CSS in `src/index.css` — **not** Tailwind `group` / `group-hover` utilities. This keeps reveal logic out of the component markup and centralised in the stylesheet.

**Pattern:** add a stable row class to the container element and a `<row>-actions` class to the actions wrapper. The reveal rule lives in `src/index.css`:

```css
/* actions wrapper: hidden by default */
.<row>-actions { opacity: 0; transition: opacity 0.15s; }
/* reveal on pointer hover or keyboard focus anywhere in the row */
.<row>:hover .<row>-actions,
.<row>:focus-within .<row>-actions { opacity: 1; }
```

Current consumers (all in `src/index.css`):

| Row class | Actions class | Feature |
|-----------|---------------|---------|
| `.news-card` | `.news-actions` | News tab |
| `.sit-card` | `.sit-actions` | Situations tab |
| `.cl-entry` | `.cl-entry-actions` | Changelog tab |
| `.an-row` | `.an-row-actions` | Announcements tab |
| `.fb-card` | `.fb-card-actions` | Feedback tab |
| `.cer-card` | `.cer-actions` | Card Errors tab |
| `.deck-row` | `.deck-row-actions` | Decks tab |

**Delete-button color:** `.icon-btn.danger` sets `color: hsl(var(--danger))` at rest so trash/delete icons are red without needing hover. The hover rule (`.icon-btn.danger:hover`) adds the `hsl(var(--danger) / 0.1)` tinted background. Edit/pencil icons keep the default `--fg-2` resting color — only delete uses `.danger`.

### Drawer header chrome

`.drawer-head` is a flex row that lays out one stacked content column alongside a close button. The content column (`drawer-head-content`) composes the breadcrumb kicker, the title-row wrapper, and an optional meta-row badge strip as top-to-bottom siblings.

| Class | Role |
|---|---|
| `.drawer-head` | Flex row, `justify-content: space-between` — lays out `[content column \| close-X]`. |
| `.drawer-head-content` | Flex column wrapper inside `.drawer-head` — stacks breadcrumb, title-row, optional meta-row. |
| `.drawer-breadcrumb` | Monospace kicker (JetBrains Mono 11.5px, `--fg-3`) above the title. |
| `.drawer-head-row` | JSX grouping hook around `.drawer-title` (currently `display: block`; reserved for future title-row siblings like inline badges). |
| `.drawer-title` | H2 typography (Inter Tight 22/700, `-0.015em`, line-height 1.25, max-width 640px). |
| `.drawer-meta` | Optional badge row, sibling of `.drawer-head-row` inside `.drawer-head-content`. |

**PR delta (ADMIN2-16 / ANDD-03):** The `.drawer-head-content` JSX wrapper is applied in `AnnouncementDetailsDrawer.tsx`, `ChangelogEditorDrawer.tsx`, `DeckDrawer.tsx`, and `NewsEditDrawer.tsx`. The remaining consumers (`AnnouncementComposeDrawer`, `SituationDrawer`) reference these classes but lack the wrapper; a sweep is queued as a follow-up.

### Full-screen drawer variant (`size="full"`)

**PR delta (NADM-09 / ADMIN2-27):** `SidePanel size="full"` renders the drawer at `100vw / 100vh` (class `h-screen w-screen !max-w-none`). Two CSS rules in `@layer components` scope the visual polish to this variant only:

| Class / selector | Role |
|---|---|
| `.drawer-wrap[data-size='full']` | Overrides slide animation to `250ms cubic-bezier(0.4,0,0.2,1)` for open and close. |
| `.drawer-shadow-handoff` | Left-edge drop shadow: `box-shadow: -30px 0 60px rgba(0,0,0,0.3)`. Applied by `side-panel.tsx` via `contentClass` when `size === 'full'`. |

The `bg-black/50` overlay (no `backdrop-blur`) is already wired in `side-panel.tsx` for `size === 'full'` (distinct from the `bg-background/80 backdrop-blur-sm` used by default/wide/half sizes).

---

## Component primitives (`src/components/ui/*`)

All shadcn-based, all token-aware. Don't re-implement these inline.

**Buttons & inputs:** `button`, `input`, `textarea`, `label`, `checkbox`, `switch`, `slider`, `select`, `form` (RHF wrapper)

`button` variants: `default` · `destructive` · `outline` · `secondary` · `ghost` (content-area icon/text button — `hover:bg-accent` lights up in electric violet, use where a chromatic pop is intentional) · `chrome-ghost` (system-chrome icon button — theme/language toggles, nav-rail icons; `hover:bg-muted` stays neutral so utility chrome doesn't introduce a third hue on otherwise mono-palette surfaces like the auth card or app shell) · `link` · `success` (`bg-gradient-success text-success-foreground`, emerald→green gradient) · `hero` · `hero-outline` · `landing-chrome` (icon button on the landing dark-navy chrome bar — uses `text-landing-header-fg` resting + `hover:bg-landing-header-fg/10`; do not use `ghost` on the landing header, the app `--accent` hover collides with the dark-navy surface) · `landing-primary` (primary CTA on the landing chrome bar and over the hero/final-CTA dark photography — `bg-landing-greek-blue text-landing-header-fg`, theme-invariant; matches the G-logo brand color so chrome and CTAs stay visually unified).
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

**Practice session animations (pf-layer, all in `src/features/practice/pf/pf.css`, NOT in `tailwind.config.js`):**

All eight `pf-*` keyframes are scoped to `pf.css`. They are neutralised under `prefers-reduced-motion: reduce` via both the global `index.css` guard and a dedicated belt-and-suspenders block at the end of `pf.css`.

| Keyframe | Duration / Timing | Carrier selector | What it does |
|---|---|---|---|
| `pf-card-in` | 280ms ease-smooth | `.pf-card` | Card entrance: slides up 12 px + fades in. Gated behind `prefers-reduced-motion: no-preference`. |
| `pf-seg-pulse` | 1.4s ease-in-out ∞ | `.pf-seg.is-current` | Progress-bar tick opacity pulse (1→0.55→1) while a card is active. |
| `pf-cell-fill` | 400ms ease-out | `.pf-cell-target.is-revealed` | Declension-table cell reveal: scales + fades the filled-in answer. |
| `pf-wave` | 600ms ease-in-out ∞ | `.pf-wave-bar--playing` | Audio waveform bars bounce while audio is playing. Gated behind `prefers-reduced-motion: no-preference`. |
| `pf-audio-spin` | 0.9s linear ∞ | `.pf-audio-surface__play-icon--loading` | Loading spinner on the audio play button while TTS is fetching. |
| `pf-leave-left` | 320ms ease-smooth | `.pf-card-slide-wrapper[data-leave='left'] .pf-card` | Card exit to the left (forgot/skip). Gated behind `prefers-reduced-motion: no-preference`. |
| `pf-leave-right` | 320ms ease-smooth | `.pf-card-slide-wrapper[data-leave='right'] .pf-card` | Card exit to the right (rated). Gated behind `prefers-reduced-motion: no-preference`. |
| `pf-toast-in` | 220ms ease-smooth | `.pf-toast` | Toast notification entrance: slides up + fades in. Gated behind `prefers-reduced-motion: no-preference`. |

### Practice top bar utility classes (pf-layer, PRACT2-1-02)

New classes in `src/features/practice/pf/pf.css` (pf-layer scoping, not `src/index.css`):

| Class | Role |
|---|---|
| `.pf-top` | 3-column grid shell (`1fr 2fr 1fr`, collapses to stacked at ≤720px). Stacks left/centre/right columns for the practice top bar. |
| `.pf-deck-label` | Flex column wrapper for deck label; clips overflow with ellipsis. |
| `.pf-deck-label__title` | First line: `{deck_name} · Practice`. 13px/600 `hsl(var(--fg))`. |
| `.pf-deck-label__meta` | Second line: `{N} cards · {review} review · {new} new`. 11px `hsl(var(--fg-2))`. |
| `.pf-progress` | Flex column wrapping the tick track + count. |
| `.pf-seg-track` | Flex row of ticks; `role="progressbar"`. |
| `.pf-seg` | One tick per card; 4px height, rounded, muted grey resting. |
| `.pf-seg.is-current` | Current tick: `var(--pf-c)` bg + `pf-seg-pulse` animation. |
| `.pf-seg[data-rate]` | Rated tick: `forgot`→`--danger`, `tough`→`--practice-hard`, `ok`→`--success`, `easy`→`--accent`. |
| `.pf-progress-count` | `{idx+1} / {total}` text below ticks. 11px `hsl(var(--fg-3))`; `<b>` uses `hsl(var(--fg-2))`. |
| `.pf-right` | Right column flex row (streak + utility chrome). |
| `.pf-streak` | Streak pill: flame + count, `--practice-hard` tint bg, 12px/600. |
| `.pf-streak__icon` | 14×14 lucide Flame icon inside streak pill. |

### Practice fidelity classes (PRACT2-3)

New classes in `src/features/practice/pf/pf.css` (pf-layer scoping). Token-only — no raw hex.

**Design system delta (PRACT2-3):** adds `.pf-reveal-cta`, `.pf-kbd`, `.pf-prompt`, `.pf-foot-hint`, `.pf-rating-btn__hint`, `.pf-answer__example-el`, `.pf-answer__example-en`; no new CSS custom properties introduced (uses existing `--line-2`, `--fg`, `--fg-2`, `--fg-3`, `--success`).

| Class | Role |
|---|---|
| `.pf-kbd` | Shared keycap primitive. JetBrains Mono 11px/600, 2–6px padding, `hsl(var(--fg)/0.07)` bg, `hsl(var(--fg)/0.12)` border, 4px radius. Reused by `.pf-reveal-cta` (Space key) and `.pf-foot-hint` (1–4 keys). |
| `.pf-reveal-cta` | Pre-flip reveal hint overlay. Absolutely positioned at the top of `.pf-foot` (which is `position:relative`). Dashed top border using `hsl(var(--line-2))`; `pointer-events:none` so clicks fall through to the card-root flip handler. Contains `.pf-kbd` for the Space keycap. Hidden post-flip (React conditional render). |
| `.pf-prompt` | Direction subtitle above the display word on translation cards (`"Greek → English · {prompt}"` / `"English → Greek · {prompt}"`). Mirrors `.pf-sentence-prompt`: Inter Tight 13px, font-weight 500, `hsl(var(--fg-3))`, centered. |
| `.pf-foot-hint` | "Press 1–4 to rate" hint below the `RatingRow` in both pf feet. Inter Tight 12px/500, `hsl(var(--fg-3))`. Contains `.pf-kbd` keycaps. |
| `.pf-rating-btn__hint` | Projected next-review interval under each rating-button label (PRACT2-3-06). Inter Tight 10px/500, `line-height:1`, `hsl(var(--fg-3))`; compact so the hint + `.pf-foot-hint` coexist within the 320px `.pf-foot` min-height floor. Text is word-form via `formatReviewInterval` (e.g. "1 day", "1 week"). Rendered only when `rating_previews` is present on the card (graceful absence: label-only). |
| `.pf-answer__example-el` | Greek example sentence inside `.pf-answer__example` (PRACT2-3-07). Noto Serif 14px/400, `font-style: normal` (never italic), `lang="el"`, `hsl(var(--fg-2))`. Mirrors Greek study-text convention. Suppressed on sentence-family cards (`sentence_translation`, `cloze`) where the example duplicates the prompt/answer — see PRACT2-5-05. |
| `.pf-answer__example-en` | English gloss of the example sentence (PRACT2-3-07). Inter Tight 13px/400, `hsl(var(--fg-3))` — slightly muted vs `.pf-answer__example-el` to visually separate the gloss from the Greek above. Suppressed on sentence-family cards (`sentence_translation`, `cloze`) where the example duplicates the prompt/answer — see PRACT2-5-05. |
| `.pf-answer__sub` | Muted translation gloss beneath the Greek answer on `plural_form` cards (PRACT2-6-02). Inter Tight 14px/400, `hsl(var(--fg-2))`, centered, `line-height: 1.4`. Shown as `answer_sub_ru` in RU locale, `answer_sub` in EN; absent when that field is empty. Mirrors `.pf-answer__example-ru`. |

**Design system delta (PRACT2-6):** adds `.pf-answer__sub` (muted translation gloss under the Greek `plural_form` answer); no new CSS custom properties (reuses `--fg-2`).

---

### Culture hub hero + what's-new strip (cx-, CULT2-2)

New classes in `src/index.css` for the Culture hub (`CulturePage` / `CultureHero`). Token-only — no raw hex.

| Class | Role |
|---|---|
| `.cx-cta-primary` | **Compact, auto-width** hero primary CTA (Continue), paired with `.cx-cta-ghost` so the two hero buttons sit side by side. `--primary` fill, `--primary-foreground` text, 12px/22px padding, 12px radius, 14px/700 Inter Tight, primary inset+drop shadow. Deliberately distinct from the shared **full-width** `.dx-action-cta` (used by the action panels and readiness/detail pages) — do not substitute one for the other. |
| `.cx-whatsnew-l` | "In Culture" eyebrow label, first child of the what's-new strip. JetBrains Mono 10.5px/700, `letter-spacing: 0.1em`, uppercase, `hsl(var(--fg-3))`, with a small green `::before` dot (`hsl(var(--success))` + soft `0.18` alpha ring). |

**Design system delta (CULT2-2):** adds `.cx-cta-primary` and `.cx-whatsnew-l`; no tokens introduced.

---

### Mobile over-photo surface

Mobile-only tokens added in MOB-09. These 5 tokens are **theme-invariant** — identical in light and dark, with no `.dark` overrides — because they are used exclusively over full-bleed photography on the login screen where the ambient theme does not apply.

| Token | HSL | Purpose |
|---|---|---|
| `--on-photo-fg` | `0 0% 100%` | Pure white — over-photo text and glass fill/border tints via `/opacity` |
| `--on-photo-scrim` | `225 43% 5%` | Near-black (`rgba(8,11,20)`) — scrim overlay and segmented control track via `/opacity` |
| `--on-photo-active-fg` | `222 31% 9%` | Dark navy (`#0b1220`) — segmented active label on the white thumb |
| `--danger-soft` | `0 96% 90%` | `#fecaca` — error banner text |
| `--danger-softer` | `0 93% 82%` | `#fca5a5` — inline field-error message |
| `--badge-recommended` | `34 100% 52%` | Brand Cyprus gold — over-photo "Recommended" badge accent (Step 3) |

Tailwind utilities: `text-on-photo`, `bg-on-photo/10`, `border-on-photo/22`, `bg-on-photo-scrim/42`, `text-on-photo-active`, `text-danger-soft`, `text-danger-softer`, `bg-badge-recommended`, `text-badge-recommended`, `bg-badge-recommended-25`.

> **Mobile/native note:** The `/NN` opacity modifier (`bg-on-photo/10`, `border-on-photo/22`, `bg-on-photo-scrim/42`) is valid on **web only**. On **mobile/native** (NativeWind v4), `/NN` on a var-backed token routes through unsupported `color-mix()` and renders dark on iOS. Use the explicit `<base>-<NN>` rgba tokens instead (`bg-on-photo-10`, `border-on-photo-22`, `bg-on-photo-scrim-42`). See [`learn-greek-easy-mobile/docs/design-tokens.md`](../learn-greek-easy-mobile/docs/design-tokens.md) for the full convention (MOB-13).

> **Over-photo single-accent exception:** over-photo surfaces (login/onboarding, i.e. screens fully covered by `cyprus-hero.webp`) may use the brand Cyprus gold (`--badge-recommended`) as a **single accent colour** — this is the sanctioned exception to the three-palette rule (conventions.md:82). All other colour usage on these surfaces must use `--on-photo-*` tokens.

The error-banner fill and border reuse the existing `danger` token (`bg-danger/18 border-danger/55`). On **web** these `/NN` modifiers are fine; on **mobile/native** use `bg-danger-18 border-danger-55` (explicit rgba tokens — see [`learn-greek-easy-mobile/docs/design-tokens.md`](../learn-greek-easy-mobile/docs/design-tokens.md), MOB-13). The sanctioned raw-literal color values on the login screen are:

1. The 3 `expo-linear-gradient` scrim stops (`rgba(8,11,20,…)`) — `expo-linear-gradient`'s `colors[]` prop cannot accept a NativeWind class (LOGIN-04).
2. The Google brand "G" colors in `GoogleIcon.tsx` (`#4285F4`/`#34A853`/`#FBBC05`/`#EA4335`) — brand asset, must not be recolored.
3. RN-API color props that cannot accept a NativeWind class: `placeholderTextColor` (white at 50% opacity, = `--on-photo-fg`/50), `shadowColor` (a brighter-than-`--primary` glow, `hsl(222 95% 63%)`), and `ActivityIndicator color` (opaque white, = `--on-photo-fg`). Documented in `login.tsx` as `ON_PHOTO_PLACEHOLDER`, `ON_PHOTO_FG`, and `PRIMARY_GLOW`.

---

## Mobile (NativeWind)

Mobile token infrastructure added in MOB-02. NativeWind v4 on React Native / Expo.

### Copy-first model

Mobile mirrors the web **App palette only** with web token-name parity. The same utility classes (`bg-primary`, `text-fg`, `text-fg2`, `text-fg3`, `border-line`, `bg-card`, `bg-bg`, `bg-bg-2`, etc.) work identically on mobile and web.

**Important:** Web token changes must be **manually mirrored** to `learn-greek-easy-mobile/src/global.css` until a shared config lands. This is intentional — a shared monorepo config is out of scope for MOB-02.

### Where mobile tokens live

| File | Role |
|---|---|
| `learn-greek-easy-mobile/src/global.css` | CSS custom properties under `:root` (light) and `.dark` (dark), plus `@tailwind` directives. Source of truth for mobile HSL channel values. |
| `learn-greek-easy-mobile/tailwind.config.js` | Named Tailwind utilities mapping to `hsl(var(--token))`, `darkMode: 'class'`, `presets: [nativewind/preset]`. |

**Naming quirk:** `fg2` / `fg3` are dashless in mobile `tailwind.config.js` (map to `--fg-2` / `--fg-3`), while `bg-2`, `line-2`, `primary-2` keep their dashes. This mirrors what the web Tailwind config exposes and lets NativeWind resolve the CSS vars at runtime.

**Border radius:** `borderRadius` values in `learn-greek-easy-mobile/tailwind.config.js` are hardcoded `px` (e.g. `lg: 14px`). NativeWind does not evaluate CSS `calc()` for border-radius on native; all radius tokens are concrete pixel values.

### Excluded palettes

The following palettes are **not ported** to mobile and must not be added to `learn-greek-easy-mobile/src/global.css` or `tailwind.config.js`:

- Landing (`--landing-*`)
- Practice (`--practice-*`)
- Founders (`--founders-*`)
- Tense (`--tense-*`)
- Situations thumbnail (`--sit-thumb-*`)
- Charts (`--chart-*`)

### Dark mode

`app.config.ts` sets `userInterfaceStyle: 'automatic'` so the OS system preference drives the theme. NativeWind's `dark:` variant follows that system theme automatically — no manual toggle is wired or needed. The `.dark` class is applied by NativeWind's color-scheme runtime.

### Known follow-ups

**(a) Template screens + `constants/theme.ts` Colors:** The SDK-56 Expo template ships `ThemedText`, `ThemedView`, and a `constants/theme.ts` `Colors` object using raw hex. These are still active and pending migration in MOB-03+. Do not remove them in MOB-02.

**(b) Font parity deferred:** `global.css` maps `--font-display`, `--font-serif`, `--font-mono`, and `--font-rounded`, but the corresponding font files are not yet bundled via `expo-font`. Type renders with system fallbacks until a later story loads them explicitly.
