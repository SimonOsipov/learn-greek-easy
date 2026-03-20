# Filtering & Data Fetching Conventions

Rules for implementing filters and managing API calls on list pages. Applies to any page that fetches data and lets users filter/search it.

## Core Principle

**Classify every filter as server-side or client-side. Only server-side filter changes may trigger API calls.**

| Filter type | Definition | Example |
|-------------|-----------|---------|
| **Server-side** | The backend accepts this parameter and returns different data | `search`, single `level` on `/api/v1/decks` |
| **Client-side** | Filtering is applied in JS after the data is already loaded | Status (not-started/in-progress/completed), deck type (vocabulary/culture), multi-level |

## Rules

### 1. Client-side filter changes must NOT trigger API refetches

If the data needed to filter is already in memory, don't re-fetch it. Apply the filter locally.

**Bad:** Every filter click calls `fetchDecks()` which hits 3 APIs.
**Good:** `setFilters()` checks if API params changed. If only client-side filters changed, call `applyFilters()` (no network).

### 2. Cache stable data within a page session

Data that doesn't change based on user-controlled filters should be fetched once and reused.

| Data | Why it's stable | Cache strategy |
|------|----------------|---------------|
| Culture decks | No filter params accepted by API | Module-level cache, refreshed on page mount |
| Deck progress | No filter params accepted by API | Module-level cache, refreshed on page mount |
| News by country | Same data for same country+page | `useRef` cache, cleared on unmount |

### 3. Only refetch when server-side API params actually change

Compare the effective API params before and after a filter change. If identical, skip the fetch.

```ts
const prevParams = getEffectiveApiParams(prevFilters);
const newParams = getEffectiveApiParams(updatedFilters);
if (prevParams.search !== newParams.search || prevParams.level !== newParams.level) {
  // Server-side params changed — refetch
} else {
  // Client-side only — re-filter locally
}
```

### 4. No loading spinner for cached/local results

If data comes from cache or local filtering, set state synchronously. Don't flash a loading skeleton for instant operations.

## Reference Implementations

| Page | Store/Component | Pattern |
|------|----------------|---------|
| Decks (`/decks`) | `src/stores/deckStore.ts` | Zustand store with `rawDecks` + `applyFilters()`. Module-level caches for culture decks and progress. `setFilters()` compares effective API params. |
| News (`/news`) | `src/pages/NewsPage.tsx` | `useRef` cache keyed by `country:page`. Cache hit returns data instantly, miss fetches and caches. |
