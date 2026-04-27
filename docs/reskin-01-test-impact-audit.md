# RESKIN-01 — Test Impact Audit

**Date:** 2026-04-27
**Subtask:** RESKIN-01-04
**Branch:** feature/reskin-01-brand-reskin

> **Chromatic note:** Chromatic visual regression is opted out for this project.
> Visual baselines are user-verified on the dev-preview deployment before the PR is merged.
> The `takeSnapshot` calls in `tests/visual/` use `@chromatic-com/playwright` but snapshots
> are never auto-compared in CI. This audit therefore focuses entirely on:
> 1. Vitest assertions that pin color class strings — these will hard-fail if the class changes.
> 2. Playwright flow tests that select elements by color-class CSS selectors.
> 3. Files containing direct `var(--practice-*)` references that must be wrapped in `hsl()` once surface subtasks run.

---

## Summary

| Metric | Count |
|---|---|
| Visual spec files (Chromatic / takeSnapshot) | 18 |
| Total `takeSnapshot` calls across visual specs | 191 |
| Vitest test files with color/class assertions | 13 |
| Vitest assertion rows affected | ~75 |
| Playwright e2e files with color-class selectors | 0 |
| Production source files with raw hex (drift) | 10 |
| Production source files with direct `var(--practice-*)` | 8 |
| Vitest test files with direct `var(--practice-*)` assertions | 2 |
| Vitest rows asserting `var(--practice-*)` class strings | ~25 |

**REBASELINE (expected churn, update assertion to match new class/token):** 37 assertion rows
**REGRESSION-WATCH (behavior assertion — verify behavior still holds, do not rubber-stamp):** 38 assertion rows

---

## Visual Baselines per Surface

All 18 visual spec files use `@chromatic-com/playwright`'s `takeSnapshot`. Since Chromatic is
opted out, these are not auto-compared in CI. The **surface-owning subtask** should open the dev
preview, navigate to the affected surface, and visually confirm rendering after its reskin commit
lands. Token-shift surfaces are classified `rebaseline expected`; flow-mechanics surfaces are
classified `regression-watch` (flow must still work visually even if exact palette shifts).

| Spec file | Surface | Classification | Token changes that affect it | Owning subtask |
|---|---|---|---|---|
| `tests/visual/pages.spec.ts` | Onboarding / Auth | rebaseline expected | `--ring` → primary focus, `--input` border | RESKIN-01-14 |
| `tests/visual/authenticated.spec.ts` | Dashboard / Decks / Profile | rebaseline expected | `--accent` → electric violet; `--ring` focus | RESKIN-01-05, RESKIN-01-07, RESKIN-01-13 |
| `tests/visual/landing-page.visual.spec.ts` | Landing | rebaseline expected | Landing palette unchanged; `--accent` shift visible in nav | RESKIN-01-15 |
| `tests/visual/my-decks.visual.spec.ts` | Decks | rebaseline expected | `--accent` consumers in deck cards | RESKIN-01-07 |
| `tests/visual/v2-practice.visual.spec.ts` | Practice | rebaseline expected | `--accent` → electric violet; `--ring` focus on cards | RESKIN-01-06 |
| `tests/visual/grammar-ui.visual.spec.ts` | Practice (grammar badges) | regression-watch | badge colors (`bg-blue-500`, `bg-green-500`, `bg-purple-500`, `bg-emerald-100`) will shift only if per-surface subtask changes them | RESKIN-01-06 |
| `tests/visual/practice-card.visual.spec.ts` | Practice | rebaseline expected | `--practice-accent` consumers | RESKIN-01-06 |
| `tests/visual/mock-exam.visual.spec.ts` | Mock Exam | rebaseline expected | `--practice-accent`, `--practice-correct`, `--practice-incorrect` consumers | RESKIN-01-11 |
| `tests/visual/card-error-reporting.visual.spec.ts` | Shared (error reporting) | regression-watch | `--destructive` / `--ring` focus; behavior must still render modal | RESKIN-01-16 |
| `tests/visual/subscription.visual.spec.ts` | Profile / Settings | rebaseline expected | `--accent` badge; `--ring` focus | RESKIN-01-13 |
| `tests/visual/admin-culture-cards.visual.spec.ts` | Admin | regression-watch | Admin badge colors (status indicators) | RESKIN-01-16 |
| `tests/visual/admin-announcements.visual.spec.ts` | Admin | regression-watch | flow mechanics; badge colors incidental | RESKIN-01-16 |
| `tests/visual/admin-situation-exercises.visual.spec.ts` | Admin | regression-watch | flow mechanics | RESKIN-01-16 |
| `tests/visual/admin-sources.visual.spec.ts` | Admin | regression-watch | flow mechanics | RESKIN-01-16 |
| `tests/visual/admin-vocabulary-card-modals.visual.spec.ts` | Admin | regression-watch | flow mechanics; `bg-green-100`, `bg-amber-100`, `bg-red-100` badges | RESKIN-01-16 |
| `tests/visual/news-country.visual.spec.ts` | News | rebaseline expected | `--accent` consumers in news cards | RESKIN-01-10 |
| `tests/visual/i18n.visual.spec.ts` | Shared (i18n) | regression-watch | locale switching — flow must hold | RESKIN-01-16 |
| `tests/visual/user-card-creation.visual.spec.ts` | Decks / Practice | regression-watch | card creation flow must complete | RESKIN-01-07 |

---

## Vitest Assertions on Color / Class

### A. Practice palette — `var(--practice-*)` class string assertions

These tests assert that specific Tailwind arbitrary-value classes containing `var(--practice-*)` are
present on DOM elements. When surface subtasks RESKIN-01-06/RESKIN-01-11 wrap the raw CSS-var
references in `hsl()`, the class strings in the JSX will change from
`border-[var(--practice-accent)]` to `border-[hsl(var(--practice-accent))]`, etc.

**Action per surface subtask:** after updating the source component, update the matching assertion
rows below so they assert the new class string. These are **REBASELINE** rows.

| File | Line(s) | Current assertion | Required update | Classification | Surface |
|---|---|---|---|---|---|
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 93–94 | `border-[var(--practice-border)]`, `bg-[var(--practice-card)]` | → `border-[hsl(var(--practice-border))]`, `bg-[hsl(var(--practice-card))]` | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 101–102 | `hover:border-slate-300`, `hover:bg-slate-50/60` | unchanged unless surface subtask changes hover state | REBASELINE if changed | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 135–137 | `border-[var(--practice-accent)]`, `bg-[var(--practice-accent-soft)]`, `shadow-[0_0_0_3px_var(--practice-accent-glow)]` | → `hsl()` wrapped variants | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 144–145 | same practice-accent classes | → `hsl()` wrapped variants | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 177–179 | `border-[var(--practice-correct)]`, `bg-[var(--practice-correct-soft)]`, `shadow-[0_0_0_3px_var(--practice-correct-glow)]` | → `hsl()` wrapped | **REGRESSION** — correct feedback must still visually apply | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 226–228 | `border-[var(--practice-incorrect)]`, `bg-[var(--practice-incorrect-soft)]`, `shadow-[0_0_0_3px_var(--practice-incorrect-glow)]` | → `hsl()` wrapped | **REGRESSION** — incorrect feedback must still visually apply | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 332, 339 | `border-[var(--practice-correct)]` | → `hsl()` wrapped | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 347 | `border-[var(--practice-incorrect)]` | → `hsl()` wrapped | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 362 | `border-[var(--practice-accent)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 370–371 | `border-[var(--practice-border)]`, `bg-[var(--practice-card)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/MCQComponent.test.tsx` | 1278, 1280 | `bg-[var(--practice-card)]`, `border-[var(--practice-border)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/MCQComponent.test.tsx` | 1329 | `text-[var(--practice-text)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/MCQComponent.test.tsx` | 1371–1372 | `bg-[var(--practice-accent)]`, `shadow-[0_0_0_3px_var(--practice-accent-glow)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/MCQComponent.test.tsx` | 1382–1383 | `bg-[var(--practice-border)]`, `text-[var(--practice-text-dim)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |
| `src/components/culture/__tests__/MCQComponent.test.tsx` | 604–605 | `text-[var(--practice-text-dim)]` | → `hsl()` wrapped | REBASELINE | Culture / Practice |

### B. Hex attribute assertions

| File | Line(s) | Current assertion | Required update | Classification | Surface |
|---|---|---|---|---|---|
| `src/components/culture/__tests__/ScoreCard.test.tsx` | 134 | `toHaveAttribute('stroke', '#10b981')` | If `ScoreCard` is updated to use token, update to `hsl(var(--practice-correct))`; if not updated this cycle, leave as-is | **REGRESSION** — passing score ring must show green | Culture / Practice |
| `src/components/culture/__tests__/ScoreCard.test.tsx` | 141 | `toHaveAttribute('stroke', '#f59e0b')` | If updated to token, update assertion accordingly | **REGRESSION** — partial score ring must show amber | Culture / Practice |

### C. Solid palette badge assertions (behavior-critical)

These assert that correct/incorrect/status feedback renders with specific Tailwind color classes.
The behavior (correct = green badge, incorrect = red badge) must be preserved even if the exact
shade shifts during a surface reskin. Treat as **REGRESSION** — do not blindly update if the
behavior changes.

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 201 | `toHaveClass('bg-emerald-500')` — correct letter badge | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 250 | `toHaveClass('bg-red-500')` — incorrect letter badge | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 511 | `toHaveClass('bg-emerald-500')` — correct state badge | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 520 | `toHaveClass('bg-red-500')` — incorrect state badge | **REGRESSION** | Culture / Practice |
| `src/components/culture/__tests__/AnswerOption.test.tsx` | 502 | `toHaveClass('bg-indigo-500')` — accent/selected badge | REBASELINE (palette may shift) | Culture / Practice |

### D. Grammar badge assertions (Practice surface — RESKIN-01-06)

These assert exact Tailwind palette classes on `GenderBadge`, `PartOfSpeechBadge`, `MediaBadge`,
and `TenseBadge`. The badge colors are semantic (noun=blue, verb=green, adjective=purple, grammar=emerald)
and must stay consistent — update assertion only if the surface subtask intentionally changes the color.

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/review/grammar/__tests__/GenderBadge.test.tsx` | 38, 90 | `toHaveClass('bg-blue-500')` — masculine | **REGRESSION** (semantic: masculine = blue) | Practice |
| `src/components/review/grammar/__tests__/PartOfSpeechBadge.test.tsx` | 55, 108 | `toHaveClass('bg-green-500')` — verb | **REGRESSION** (semantic: verb = green) | Practice |
| `src/components/review/grammar/__tests__/PartOfSpeechBadge.test.tsx` | 72, 109 | `toHaveClass('bg-purple-500')` — adjective | **REGRESSION** (semantic: adjective = purple) | Practice |
| `src/components/review/grammar/__tests__/MediaBadge.test.tsx` | 39, 47, 149–150 | `toHaveClass('bg-blue-500')` — translation type | **REGRESSION** | Practice |
| `src/components/review/grammar/__tests__/MediaBadge.test.tsx` | 81, 152 | `toHaveClass('bg-purple-500')` — plural form | **REGRESSION** | Practice |
| `src/components/review/grammar/__tests__/MediaBadge.test.tsx` | 115, 123, 131, 154–156 | `toHaveClass('bg-emerald-500')` — grammar type | **REGRESSION** | Practice |
| `src/components/review/grammar/__tests__/TenseBadge.test.tsx` | 63–64, 181–182 | `toHaveClass('bg-emerald-100')`, `toHaveClass('text-emerald-700')` | REBASELINE if surface subtask changes tense badge palette | Practice |

### E. Culture badge assertions

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/culture/__tests__/CultureBadge.test.tsx` | 107–108, 178, 180 | `bg-indigo-500`, `bg-indigo-600` | REBASELINE (category color, cosmetic) | Culture |
| `src/components/culture/__tests__/CultureBadge.test.tsx` | 121–122, 196, 198 | `bg-purple-500`, `bg-purple-600` | REBASELINE (category color, cosmetic) | Culture |
| `src/components/culture/__tests__/CultureBadge.test.tsx` | 135–136, 214, 216 | `bg-emerald-500`, `bg-emerald-600` | REBASELINE (category color, cosmetic) | Culture |

### F. Status dot assertions (Shared / Decks)

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/culture/__tests__/QuestionCard.test.tsx` | 85, 91 | `bg-blue-500` — learning/review status dot | **REGRESSION** (status meaning must be preserved) | Culture |
| `src/components/culture/__tests__/QuestionCard.test.tsx` | 97 | `bg-green-500` — mastered status dot | **REGRESSION** | Culture |

### G. Statistics / Dashboard assertions

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 84 | `querySelector('.bg-emerald-500')` — ≥85% bar | **REGRESSION** (mastery tier must stay visually distinct) | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 85 | `querySelector('.bg-green-500')` — ≥60% bar | **REGRESSION** | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 86 | `querySelector('.bg-orange-500')` — ≥40% bar | **REGRESSION** | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 87 | `querySelector('.bg-red-500')` — <40% bar | **REGRESSION** | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 171 | `querySelector('.text-green-600')` — accuracy text | REBASELINE (shade shift acceptable) | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 178 | `querySelector('.text-orange-500')` | REBASELINE | Dashboard |
| `src/components/statistics/__tests__/CategoryBreakdown.test.tsx` | 185 | `querySelector('.text-red-500')` | REBASELINE | Dashboard |

### H. Auth assertions

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/auth/__tests__/PasswordStrengthIndicator.test.tsx` | 84, 97, 145 | `toHaveClass('text-green-500')` — requirement met | **REGRESSION** (met/unmet state must be green/muted) | Onboarding / Auth |
| `src/components/auth/__tests__/PasswordStrengthIndicator.test.tsx` | 127 | `toHaveClass('text-red-500')` — weak indicator | **REGRESSION** | Onboarding / Auth |

### I. Admin assertions

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/admin/__tests__/UnifiedVerificationTable.test.tsx` | 186, 483 | `querySelector('.bg-red-500')` — red audio status indicator | **REGRESSION** (status semantics must hold) | Admin |
| `src/components/admin/__tests__/UnifiedVerificationTable.test.tsx` | 193 | `querySelector('.bg-yellow-500')` — warning indicator | **REGRESSION** | Admin |
| `src/components/admin/__tests__/GenerateNounDialog.test.tsx` | 456 | `toContain('bg-green-100')` — high confidence badge | REBASELINE (cosmetic tone badge) | Admin |
| `src/components/admin/__tests__/GenerateNounDialog.test.tsx` | 470 | `toContain('bg-amber-100')` — medium confidence | REBASELINE | Admin |
| `src/components/admin/__tests__/GenerateNounDialog.test.tsx` | 484 | `toContain('bg-red-100')` — low confidence | **REGRESSION** (low confidence must remain visually distinct) | Admin |
| `src/components/admin/news/__tests__/NewsItemsTable.test.tsx` | 474, 502 | `toContain('bg-purple-500')` — scheduled/published indicator | REBASELINE (badge cosmetic) | Admin |
| `src/components/admin/news/__tests__/NewsItemsTable.test.tsx` | 485, 513 | `not.toContain('bg-purple-500')` | REBASELINE (same badge, negated) | Admin |

### J. Decks assertions

| File | Line(s) | Current assertion | Classification | Surface |
|---|---|---|---|---|
| `src/components/decks/__tests__/DeckCard.test.tsx` | 118 | `toContain('text-purple-700')` — premium label | REBASELINE | Decks |
| `src/components/decks/__tests__/DeckCard.test.tsx` | 122 | `toContain('bg-purple-500/20')` — premium badge wrapper | REBASELINE | Decks |
| `src/components/decks/__tests__/DeckCard.test.tsx` | 128 | `toContain('bg-purple-500')` — premium dot | REBASELINE | Decks |
| `src/components/decks/__tests__/DeckCard.test.tsx` | 378 | `toContain('bg-green-500')` — mastery progress stripe | **REGRESSION** (mastered state must still be green) | Decks |

---

## Selectors on Renamed Classes (Playwright)

No Playwright e2e or integration tests were found using `.badge.blue`, `.badge.green`, `.badge.gray`,
`.badge.amber`, `.badge.red`, `.badge.violet`, `.bg-gradient-accent`, or arbitrary `bg-[#...]`
selectors. Grep 3 returned zero results. No action required.

---

## Tokens Shifting in RESKIN-01-01 — Surface Checklist

### `--accent` → electric violet (`280 92% 62%`)

This is the highest-impact token shift. The old accent was a neutral gray-ish value; the new accent
is a vivid electric violet. Every consumer of `bg-accent`, `text-accent`, `hover:bg-accent`, and
`data-[state=open]:bg-accent` in shadcn components will render violet on hover/open states.

**Surfaces affected:**

- `src/components/ui/button.tsx` — `border` variant uses `hover:bg-accent hover:text-accent-foreground`. All `border` buttons get violet hover. (RESKIN-01-16 / Shared)
- `src/components/ui/dialog.tsx` — close button uses `data-[state=open]:bg-accent`. (Shared)
- `src/pages/AdminPage.tsx:1031` — tab inactive uses `hover:bg-accent hover:text-accent-foreground`. (Admin — RESKIN-01-16)
- `src/components/shared/PracticeCard.tsx:183, 247` — uses `bg-[#6366f1]/10 text-[#6366f1]` (arbitrary hex indigo, not the accent token — but visually adjacent; surface subtask should migrate to `bg-accent/10 text-accent`). (Decks / Shared — RESKIN-01-07/RESKIN-01-16)
- No Vitest tests assert on `data-[state=open]:bg-accent` or `hover:bg-accent` class strings directly — no test updates required here.

### `--ring` → aliases `--primary`

Every shadcn component using `focus-visible:ring-ring` or `focus:ring-ring` will now show a primary-branded focus ring instead of the previous generic ring. This is a purely cosmetic change.

**Consumers found (production source):** `button.tsx`, `tabs.tsx`, `slider.tsx`, `sheet.tsx`, `switch.tsx`, `dialog.tsx`, `badge.tsx`, `checkbox.tsx`, `toast.tsx`, `textarea.tsx`, `input.tsx`, `select.tsx`, `AudioSpeedToggle.tsx`, `AnswerOption.tsx`, `MCQComponent.tsx`, `LanguageSelector.tsx`, `ScoreCard.tsx`, `WaveformPlayer.tsx`, `MasteryDots.tsx`, `MasteryDotsLegend.tsx`, `AdminPage.tsx`.

**Test impact:** No tests assert on `--ring` token value directly. The `AnswerOption.test.tsx:450–451` tests assert `focus-visible:outline-none` and `focus-visible:ring-2` class presence (not the ring color) — these remain valid after the token shift. No test updates required for `--ring` shift.

**Note:** `src/components/forms/PasswordField.tsx:122` and `src/components/forms/FormField.tsx:93` use `focus-visible:ring-red-500` / `border-red-500` for error states — these do NOT use `ring-ring` and are unaffected.

**Note:** `src/components/profile/PreferencesSection.tsx:215` uses `focus:ring-purple-500` (hardcoded, not the token). `src/components/xp/XPCard.tsx:221` uses `focus:ring-blue-500`. These are legacy drift — out of scope for this reskin cycle (see design-system.md §Legacy drift).

### `--input` → stronger form border

The `--input` token is used as `border-input` on all shadcn form inputs (`input.tsx`, `textarea.tsx`, `select.tsx`, `switch.tsx`). A stronger border color will be visible on:

- **Profile/Settings** (form fields in `PreferencesSection`, `PersonalInfoSection`, `SecuritySection`) — RESKIN-01-13
- **Onboarding / Auth** (login, register, password reset forms) — RESKIN-01-14
- **Admin** (card create/edit modals, all form dialogs) — RESKIN-01-16

No Vitest tests assert on `border-input` class presence. No test updates required.

### `--info` / `--danger` → HSL channel form

Consumers of `text-info` and `bg-info` / `text-danger` and `bg-danger` will remain byte-equal after
the shift to HSL channel notation — the rendered colors are identical. Grep 9 found zero Vitest
assertions on `--info` or `--danger` token values directly. No test updates required.

### `bg-gradient-accent` → removed utility

The class `bg-gradient-accent` exists only in `src/index.css:160` (the definition). Grep 4 confirmed
zero call sites in `src/` (outside `index.css`). The definition will be removed in RESKIN-01-02.
No test updates required.

---

## Raw Hex Drift in Production Source (Baseline for Surface Subtasks)

These files contain raw hex literals and represent drift from the design system. Surface subtasks
should migrate these to tokens when touching the file. Tests are not currently asserting on these
hex strings except for the `ScoreCard.test.tsx` rows documented in section B above.

| File | Lines | Hex values | Recommended token | Surface |
|---|---|---|---|---|
| `src/features/analytics/lib/transform.ts` | 64 | `#3B82F6`, `#10B981`, `#F59E0B`, `#EF4444`, `#8B5CF6`, `#EC4899` | chart tokens from `chartConfig.ts` | Dashboard |
| `src/components/ui/chart.tsx` | 52 | `#ccc`, `#fff` | CSS selector targeting Recharts internals — leave as-is (third-party DOM) | Dashboard |
| `src/components/auth/LoginForm.tsx` | 386–398 | `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335` | Google brand colors — intentionally hardcoded, do not change | Onboarding / Auth |
| `src/components/auth/RegisterForm.tsx` | 613–625 | same Google colors | same — leave as-is | Onboarding / Auth |
| `src/components/shared/PracticeCard.tsx` | 183, 247 | `#6366f1` (indigo-500) | `hsl(var(--accent))` after RESKIN-01-01 accent shift | Shared / Decks |
| `src/components/culture/ScoreCard.tsx` | 90, 107 | `#10b981` (emerald-500), `#f59e0b` (amber-500) | `hsl(var(--practice-correct))`, `hsl(var(--practice-accent))` | Culture |
| `src/lib/chartConfig.ts` | 18–37 | Multiple hex chart colors | This is the chart color palette source of truth — tokens defined here are intentional | Shared |

---

## Direct `var(--practice-*)` Consumers (Need `hsl()` Wrap)

When surface subtask RESKIN-01-06 / RESKIN-01-11 run, all direct `var(--practice-*)` references in
Tailwind arbitrary values must be wrapped in `hsl()` to correctly resolve the HSL channel variables.

**Until surface subtasks fix these files, the practice palette renders incorrect colors.**

| File | Lines | Tokens used |
|---|---|---|
| `src/components/culture/AnswerOption.tsx` | 122–135 | `--practice-accent`, `--practice-accent-soft`, `--practice-accent-glow`, `--practice-correct`, `--practice-correct-soft`, `--practice-correct-glow`, `--practice-incorrect`, `--practice-incorrect-soft`, `--practice-incorrect-glow` |
| `src/components/culture/MCQComponent.tsx` | 378, 393 | `--practice-accent`, `--practice-accent-glow`, `--practice-border`, `--practice-card`, `--practice-text`, `--practice-text-dim` |
| `src/components/culture/ExplanationCard.tsx` | 86, 88 | `--practice-correct-soft`, `--practice-incorrect-soft` |
| `src/components/culture/ScoreCard.tsx` | 159, 165, 171, 183–184 | `--practice-correct`, `--practice-incorrect`, `--practice-accent`, `--practice-accent-glow` |
| `src/components/culture/WaveformPlayer.tsx` | 391–494 | `--practice-accent`, `--practice-accent-soft`, `--practice-text-muted` |
| `src/components/exercises/SelectCorrectAnswerRenderer.tsx` | 57, 63 | `--practice-correct`, `--practice-correct-soft`, `--practice-incorrect`, `--practice-incorrect-soft` |
| `src/components/culture/MCQComponent.tsx` | 232 | `--practice-border`, `--practice-card` (also `rgba()` shadow) |
| `src/pages/MockExamResultsPage.tsx` | 221, 234, 343–344 | `--practice-correct`, `--practice-accent`, `--practice-incorrect-glow`, `--practice-incorrect-soft` |

**Matching Vitest test files that assert on these class strings (REBASELINE after source fix):**
- `src/components/culture/__tests__/AnswerOption.test.tsx` — 15+ assertion rows (section A above)
- `src/components/culture/__tests__/MCQComponent.test.tsx` — 6 assertion rows (section A above)

---

## `rgba()` Inline Styles

The following files use `rgba()` inline color literals. The `SourceImage.test.tsx` asserts on the
exact gradient string.

| File | Lines | Value | Test impact |
|---|---|---|---|
| `src/components/culture/SourceImage.tsx` | 54 | `rgba(0,0,0,0.7)`, `rgba(0,0,0,0.1)` — image overlay gradient | `SourceImage.test.tsx:143` asserts exact string — REGRESSION-WATCH (overlay must remain for text readability) |
| `src/components/culture/SourceImage.tsx` | 62 | `rgba(0,0,0,0.8)` — text shadow | no test assertion |
| `src/components/culture/ScoreCard.tsx` | 80 | `rgba(0,0,0,0.04)` — SVG track stroke | no test assertion |
| `src/components/culture/WaveformPlayer.tsx` | 391, 418–444 | `rgba(255,255,255,*)` — waveform bar colors | no test assertions on these inline styles |
| `src/components/culture/MCQComponent.tsx` | 232 | `rgba(0,0,0,0.04)` in shadow | `MCQComponent.test.tsx:1278, 1280` assert on the wrapper's class list, not shadow value |

---

## Gating Rule

Per RESKIN-01 story (Section D): **commits RESKIN-01-05 through RESKIN-01-16 may not land on the
branch until this audit file (`docs/reskin-01-test-impact-audit.md`) is committed.**

Final commit **RESKIN-01-17** must cross-check every test that changes against this list:

- A test assertion that changed and is listed here as **REBASELINE** → allowed.
- A test assertion that changed and is listed here as **REGRESSION** → must include a note in the
  commit body confirming the behavior was verified on dev preview (or in Vitest output) before
  merging.
- Any test failure that is **not listed in this audit** → must be treated as a real regression and
  investigated, not silently rebaselined.
