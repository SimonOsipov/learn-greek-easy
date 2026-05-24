# EXR-00 Audit: Exercises Tab Rebuild — Verified Paths, Primitives & Citation Map

**Date:** 2026-05-24 | **Scope:** Foundation audit for ADMIN2-23 (Exercises Tab Rebuild)

This document is the deliverable for **EXR-00** and the canonical reference for all downstream EXR-* subtasks. Every claim is grounded in actual files read in the worktree.

---

## A. Component Tree Map (Current Monolith)

### AdminExerciseList.tsx (Source of Truth)
- **Path:** `learn-greek-easy-frontend/src/components/admin/exercises/AdminExerciseList.tsx`
- **Line Count:** 334 lines
- **Structure:**
  - Toolbar: search input + clear-X (lines 115–134)
  - Filters: Exercise Type `<Select>` (lines 136–155), Status `<Select>` (lines 157–173)
  - 5-row skeleton (lines 177–190)
  - Error `<Alert variant="destructive">` + retry (lines 192–208)
  - Empty state icon + text (lines 210–223)
  - Accordion-based collapsible rows (shadcn `<Accordion>`, lines 227–301)
  - Pagination controls (lines 304–331)

### ExercisesView.tsx (Page Host)
- **Path:** `learn-greek-easy-frontend/src/pages/admin/ExercisesView.tsx`
- **Line Count:** 59 lines
- **Hosts:** 4 stat cards (stubbed `n="—"`, lines 17–45) · Listening/Reading SegControl (lines 47–54) · `<AdminExerciseList modality={modality}>` (line 56)
- **Missing:** page-head text (intentionally per stakeholder) · action-bar container

### Props Accepted by AdminExerciseList
- `modality: 'listening' | 'reading'` — only prop

---

## B. Post-Split Path Map (Canonical Citations for EXR-00b+)

All new files under `learn-greek-easy-frontend/src/components/admin/exercises/`:

| File | Purpose |
|------|---------|
| `AdminExercisesSection.tsx` | Top-level wrapper (replaces `AdminExerciseList`); orchestrates children |
| `AdminExercisesStats.tsx` | 4-card stat strip (total, approved, awaiting review, with audio) |
| `AdminExercisesToolbar.tsx` | Search input + 4 SegControl filters (source, type, level, status) |
| `AdminExerciseRow.tsx` | Single collapsible card header (title, badges, chevron) |
| `AdminExerciseBody.tsx` | Expanded body host for 5 type variants + footer |
| `AdminExerciseAudioBar.tsx` | Audio scrubber primitive |
| `AdminExercisesEmptyState.tsx` | Empty-filter messaging |
| `AdminExercisesPager.tsx` | Pagination controls |

---

## C. Primitive Inventory (Verified)

| Component | File | Highlights |
|-----------|------|-----------|
| **SegControl** | `src/components/ui/seg-control.tsx` | `options: SegOption<T>[]` · `value` · `onChange` · `label?` · `ariaLabel?` |
| **StatCard** | `src/components/ui/stat-card.tsx:37` | **Prop is `bars: number[]`** (not `sparkline`). Tones union: `'blue' \| 'violet' \| 'amber' \| 'cyan' \| 'green'`. Empty/undefined `bars` hides the `.stat-bars` row (line 86). Bar height formula: `value * 1.6 + 6` px (line 34). |
| **SidePanel** | `src/components/ui/side-panel.tsx` | `open` · `onOpenChange` · `size?: 'default' \| 'wide' \| 'half' \| 'full'` |
| **Skeleton** | `src/components/ui/skeleton.tsx` | `animate-pulse bg-muted` div |
| **Alert** | `src/components/ui/alert.tsx:11-20` | `variant: 'default' \| 'destructive'` ✓ |
| **AlertDialog** | `src/components/ui/alert-dialog.tsx` | Radix primitive ✓ |
| **Badge** | `src/components/ui/badge.tsx:26-34` | Dual API: `variant` OR `tone: 'blue' \| 'violet' \| 'amber' \| 'green' \| 'red' \| 'cyan' \| 'gray'` + `onPhoto?` |
| **Kicker** | `src/components/ui/kicker.tsx:6-9` | `dot?: 'primary' \| 'amber' \| 'violet' \| 'cyan' \| 'green' \| 'red' \| 'gray'` |
| **Accordion** | `src/components/ui/accordion.tsx` | Radix; being replaced in EXR-00b with manual `useState<Set<string>>` |

---

## D. Existing-Functionality Flags (VERIFY & PORT — DO NOT REBUILD)

Subtasks **EXR-10, EXR-19b, EXR-79** must verify/port these — already implemented:

| Feature | Location | Implementation | Owning Subtask |
|---------|----------|----------------|----------------|
| Search debounce (~300 ms) | `AdminExerciseList.tsx:64-69` | `useEffect` → `setDebouncedSearch`; cleanup on unmount | EXR-10 |
| Clear-X button in search | `AdminExerciseList.tsx:125-133` | Conditional `<X>` button; `onClick={() => setSearchQuery('')}` | EXR-10 |
| Page reset on filter change | `AdminExerciseList.tsx:72-74` | deps `[exerciseTypeFilter, statusFilter, debouncedSearch]` → `setPage(1)` | EXR-19b |
| 5-row skeleton | `AdminExerciseList.tsx:177-190` | Map 5 × 2 Skeleton bars + 2 badges | EXR-79 |
| Error Alert + retry | `AdminExerciseList.tsx:192-208` | `<Alert variant="destructive">` + retry button | EXR-79 |
| Pager | `AdminExerciseList.tsx:304-331` | Previous/Next + page indicator | EXR-18 (verify) |
| Accordion row body | `AdminExerciseList.tsx:227-301` | `<Accordion type="single" collapsible>` | EXR-00b (replace with Set) |

---

## E. Sibling Pattern Reference

The current admin component layout is flat under `src/components/admin/` (no `card-errors/` subdir). Existing sibling components include `AdminCardErrorCard.tsx`, `AdminCardErrorSection.tsx`, `CardErrorDrawer.tsx`, `CardErrorStatusBadge.tsx`, `AdminFeedbackCard.tsx`, `AdminFeedbackSection.tsx`.

**Naming convention adopted for EXR-00b:**
- Plural "Exercises" for list/wrapper components: `AdminExercisesSection`, `AdminExercisesStats`, `AdminExercisesToolbar`, `AdminExercisesEmptyState`, `AdminExercisesPager`
- Singular "Exercise" for per-row: `AdminExerciseRow`, `AdminExerciseBody`, `AdminExerciseAudioBar`

---

## F. Dependency Probe (@dnd-kit)

**`@dnd-kit/core` is NOT in `package.json`.** OQ #5 resolved: no drag-drop in v1. EXR-42 uses arrow-button reorder.

---

## G. i18n Namespace Audit

### Current State

**Namespace 1: `admin:adminExercises.*`** — used by `AdminExerciseList.tsx`
- `filters.{exerciseType, status, searchPlaceholder}`
- `exerciseTypes.{select_correct_answer, fill_gaps, select_heard, true_false, select_picture_from_description, select_description_from_picture}`
- `sourceTypes.{description, dialog, picture}`
- `statuses.{draft, approved}`
- `empty.{listening, reading}`
- `error`, `retry`, `clearSearch`, `itemCount`, `showing`, `pictureMatch`

**Namespace 2: `admin:exercises.v2.*`** — referenced by `ExercisesView.tsx` but **keys DO NOT EXIST in admin.json**. Currently a runtime missing-key risk:
- `exercises.v2.statCards.{total, approved, pending, bySource}.label` (lines 18, 25, 32, 39)
- `exercises.v2.modality.{listening, reading}` (lines 49, 50)

### EN/RU Sync
- `adminExercises.*` keys exist in both EN and RU ✓
- `exercises.v2.*` exists in **neither** locale ✗

---

## H. Backend Reality Check

### Enum Definitions (`learn-greek-easy-backend/src/db/models.py:287-318`)

**ExerciseType** (6 — EXR-53 adds `word_order` as 7th):
```python
FILL_GAPS, SELECT_HEARD, TRUE_FALSE, SELECT_CORRECT_ANSWER,
SELECT_PICTURE_FROM_DESCRIPTION, SELECT_DESCRIPTION_FROM_PICTURE
```

**ExerciseSourceType** (3): `DESCRIPTION, DIALOG, PICTURE`

**ExerciseStatus** (2 — EXR-57 adds `PENDING` as 3rd): `DRAFT, APPROVED`

**ExerciseModality** (2): `LISTENING, READING`

### Admin Exercises List Endpoint
- **Route:** `GET /api/admin/exercises` in `learn-greek-easy-backend/src/api/v1/admin.py`
- **Query params:** `modality`, `page`, `page_size`, `exercise_type?`, `status?`, `search?`
- **Response:** `AdminExerciseListResponse` (items + `total`)
- **EXR-50/51** must extend params with `source?`, `level?` and extend `status` accept `pending` (after EXR-57)

---

## I. EXR-00b Validation (Component Split)

✓ **All 8 files justified.** Verbatim logic chunks to copy:

| Destination | Source Lines |
|-------------|--------------|
| AdminExercisesSection.tsx | 49–105 (fetch + state) |
| AdminExercisesToolbar.tsx | 114–174 (search + filters) |
| AdminExercisesEmptyState.tsx | 210–223 |
| AdminExerciseRow.tsx | 228–273 (header content) |
| AdminExerciseBody.tsx | 274–295 (item loop) |
| AdminExercisesPager.tsx | 304–331 |

### Manual `useState<Set<string>>` swap
Trivial: replace `<Accordion type="single" collapsible>` with:
```tsx
const [openIds, setOpenIds] = useState<Set<string>>(new Set());
const toggle = (id: string) => setOpenIds(prev => {
  const next = new Set(prev);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
});
```
Conditional body render: `{openIds.has(exercise.id) && <AdminExerciseBody … />}`.

---

## J. EXR-00c Validation (Page-Head Action-Bar Container)

✓ **Minimal & correct.** Insert at `ExercisesView.tsx:15` (right after opening `<div>`, before `<section>`):

```tsx
<div className="va-page-actions-only flex justify-end gap-2 mb-4">
  {/* EXR-01: Generate batch button */}
  {/* EXR-02: New exercise button */}
</div>
```

---

## K. EXR-74 Validation (i18n Reconcile + Skeleton)

### Consolidation Map (verified complete)

| Old | New |
|-----|-----|
| `adminExercises.filters.exerciseType` | `exercises.filters.type.label` |
| `adminExercises.filters.status` | `exercises.filters.status.label` |
| `adminExercises.filters.searchPlaceholder` | `exercises.search.placeholder` |
| `adminExercises.exerciseTypes.*` | `exercises.types.*` |
| `adminExercises.sourceTypes.*` | `exercises.filters.source.*` |
| `adminExercises.statuses.*` | `exercises.statuses.*` (+ `pending` after EXR-57) |
| `adminExercises.error` | `exercises.errorBanner.title` |
| `adminExercises.retry` | `exercises.errorBanner.retry` |
| `adminExercises.clearSearch` | `exercises.search.clearAriaLabel` |
| `adminExercises.itemCount` | `exercises.row.itemCount` |
| `adminExercises.showing` | `exercises.pager.showing` |
| `adminExercises.pictureMatch` | `exercises.types.picture_match` (interim) |
| `adminExercises.empty.{listening,reading}` | `exercises.empty.{listening,reading}` (or fold into `exercises.empty.hint`) |
| `exercises.v2.statCards.*` | `exercises.stats.*` |
| `exercises.v2.modality.*` | `exercises.modality.*` |

### Full Skeleton (per AC #2)
`actions.{generateBatch, newExercise}` · `stats.{total, approved, awaitingReview, withAudio}.{label, subline}` · `filters.{source, type, level, status}.*` · `modality.{listening, reading}` · `search.placeholder` · `types.*` (7 incl. word_order) · `statuses.*` (3 incl. pending) · `row.{itemCount, editButton, regenerateButton, regenerateConfirmTitle, regenerateConfirmBody, correctAnswer}` · `wordOrder.{dragLabel, correctOrder, moveUp, moveDown, movedTo}` · `audio.{playLabel, pauseLabel, unavailable}` · `picture.{optionAlt, noDistractor}` · `payloadError.malformed` · `empty.{heading, hint, clearFiltersButton, firstRunHeading}` · `pager.{showing, previous, next, pageOf}` · `errorBanner.{title, retry}`.

### RU Strategy
EN values authored now; RU values **cloned from EN** in this story. EXR-75 owns native-speaker RU translation review later.

---

## Summary

| Item | Status |
|------|--------|
| Current monolith mapped | ✓ |
| 8-file split scheme | ✓ Feasible |
| All UI primitives present | ✓ |
| Existing functionality cataloged for verify-and-port | ✓ |
| Backend enums + endpoint located | ✓ |
| i18n gap identified (`exercises.v2.*` keys missing today) | ⚠️ EXR-74 must land skeleton first or in parallel |
| EXR-00b / EXR-00c / EXR-74 unblocked | ✓ |

**Recommended order:** EXR-74 → EXR-00b + EXR-00c in parallel (no shared files).
