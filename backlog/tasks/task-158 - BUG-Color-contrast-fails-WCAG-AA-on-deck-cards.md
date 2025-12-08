---
id: task-158
title: 'BUG: Color contrast fails WCAG AA on deck cards'
status: To Do
assignee: []
created_date: '2025-12-08 10:32'
labels:
  - bug
  - accessibility
  - frontend
  - wcag
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem

The Decks page fails accessibility tests due to insufficient color contrast on deck card labels.

## Error Details

**Test:** `accessibility.spec.ts:46` - "Decks page should have no accessibility violations"

**Failing Element:**
```html
<p class="text-xs text-gray-500">Mastery</p>
```

**Color Contrast Analysis:**
| Metric | Current Value | Required |
|--------|---------------|----------|
| Foreground color | `#959ba5` (text-gray-500) | - |
| Background color | `#f8f9fa` (bg-bg-page) | - |
| Contrast ratio | **2.65:1** | **4.5:1** (WCAG AA) |
| Font size | 12px (small text) | - |

**WCAG Violation:** Color contrast of 2.65 does not meet the minimum ratio of 4.5:1 for small text (< 18px normal / < 14px bold).

## Affected Components

The `text-gray-500` class is used in deck card stat labels:
- "Cards" label
- "Due" label
- "Mastery" label

Location: Deck card component in the decks listing page.

## Suggested Fix

Change `text-gray-500` to `text-gray-600` for these labels:
- `text-gray-600` = `#4b5563` which gives contrast ratio of ~5.9:1 (passes WCAG AA)

Alternatively, use the semantic color `text-muted-foreground` if it has sufficient contrast.

## Related

- GitHub Actions failure: https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20024489549
- Related to task-156 (E2E test failures)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Deck card labels have contrast ratio >= 4.5:1
- [ ] #2 Accessibility test `Decks page should have no accessibility violations` passes
- [ ] #3 No visual regression - labels remain readable and aesthetically appropriate
<!-- AC:END -->
