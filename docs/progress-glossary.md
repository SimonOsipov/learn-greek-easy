# Progress Glossary

Canonical definitions for every progress term used across web surfaces.
**One label = one definition, everywhere.** No surface recomputes a metric independently — it imports from `src/lib/progressGlossary.ts`.

---

## Tier definitions

Source of truth: `learn-greek-easy-backend/src/core/sm2.py` — `determine_status()` (lines ~237–299), persisted to `CardRecordStatistics.status` (`CardStatus` enum, `src/db/models.py:74–80`). Thresholds at `sm2.py:62–81`.

| Tier (RU / EN) | `CardStatus` mapping | Exact testable criterion (from code) |
|----------------|----------------------|--------------------------------------|
| **новое / new** | status == `new` | Never reviewed — `repetitions = 0`, no `CardRecordStatistics` row. |
| **начато / started** | status ∈ {`learning`, `review`} | Reviewed at least once but not mastered: `repetitions < 3` (→ `learning`), or graduated but not `EF ≥ 2.3 AND interval ≥ 21` (→ `review`). |
| **выучено / learned** | status ∈ {`review`, `mastered`} | `repetitions ≥ LEARNING_REPETITIONS_THRESHOLD` (= **3**) — card has graduated out of the initial learning phase. |
| **освоено / mastered** | status == `mastered` | `easiness_factor ≥ MASTERY_EF_THRESHOLD` (= **2.3**) **AND** `interval ≥ MASTERY_INTERVAL_THRESHOLD` (= **21** days). |

### Nesting

The three named tiers are **nested, not disjoint**:

```
mastered  ⊂  learned  ⊂  started
```

A mastered card is also counted as learned and (by extension) started.

The **stage distribution pie** uses the four *disjoint* `CardStatus` buckets (`new` / `learning` / `review` / `mastered`), which partition the population — a card belongs to exactly one bucket.

---

## SRS threshold constants

All exported from `src/lib/progressGlossary.ts` as `SRS_THRESHOLDS`:

| Constant | Value | Source |
|----------|-------|--------|
| `MASTERY_EF_THRESHOLD` | `2.3` | `sm2.py:62` |
| `MASTERY_INTERVAL_THRESHOLD` | `21` days | `sm2.py:69` |
| `LEARNING_REPETITIONS_THRESHOLD` | `3` | `sm2.py:76` |

---

## Canonical selectors

Each metric has **exactly one** computation in `src/lib/progressGlossary.ts`. All surfaces import from it; none recomputes independently.

| Metric | Selector | Formula |
|--------|----------|---------|
| Mastered-word count | `masteredCount(counts)` | `counts.mastered ?? 0` |
| Learned-word count | `learnedCount(counts)` | `counts.review + counts.mastered` |
| Stage distribution (4 buckets + percents summing to 100) | `stageDistribution(counts)` | Denominator = `new+learning+review+mastered`; `due` excluded |
| Deck completion % | `deckCompletionPct(progress)` | `cards_studied / total_cards` (card-record coverage) |

### The `due` field

The backend merges a `due` key into `cards_by_status` (`progress_service.py:217–221`). This is an *overlapping scheduling dimension* — cards due today are already counted under `learning`, `review`, or `mastered`. **`due` is never included in any stage-percentage denominator.** It is typed `due?: number` in `CardsByStatus` (static type matches runtime) and ignored by every selector.

---

## Accuracy

### All-time window

Accuracy is computed **all-time** (no rolling window). Both the overall accuracy figure and the per-category breakdown in the Statistics page reflect the full `CultureAnswerHistory`.

**Deliberate trade-off**: a long pause no longer surfaces a "stale / no recent attempts" prompt for categories the user has previously answered. This is the accepted lesser harm compared to silently dropping a user's entire accuracy history after 30 days of inactivity.

### "Нет попыток" (no attempts) semantics

A category with zero attempts contributes **nothing** to the overall accuracy denominator — it is excluded, not counted as 0%. Overall accuracy is non-null if and only if at least one category has attempts.

---

## Dead enum note

`CardStage.RELEARNING` (`learn-greek-easy-backend/src/constants.py:29`) is an **intentionally-left dead enum value**. The database `CardStatus` has exactly four members: `new` / `learning` / `review` / `mastered`. `RELEARNING` is never persisted and does not appear in any `cards_by_status` response. Removing it is **out of scope** for this story (it would require an SRS-algorithm change).
