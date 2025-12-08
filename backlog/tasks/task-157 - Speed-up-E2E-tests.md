---
id: task-157
title: Speed up E2E tests
status: In Progress
assignee: []
created_date: '2025-12-08 07:12'
updated_date: '2025-12-08 07:18'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, E2E tests runs for 12 minutes, we need to find way to speed them up in the CI/CD and locally
https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20019230792

## Analysis Findings

### Root Causes Identified

| Issue | Impact | Location |
|-------|--------|----------|
| **Single worker in CI** | 🔴 MAJOR | `playwright.config.ts:32` - `workers: process.env.CI ? 1 : undefined` |
| **3 browsers (expected)** | 🟡 Medium | Tests run on Chromium + Firefox + WebKit (3x multiplier) |
| **No browser caching** | 🟡 Medium | `test.yml:215` - Downloads ~400MB fresh each run |
| **Sequential job dependency** | 🟡 Medium | E2E waits for both `unit-tests` AND `backend-tests` |
| **Retries = 2** | 🟡 Medium | Failed tests run up to 3 times |

### Current Runtime Breakdown

```
11 spec files × 3 browsers × 1 worker = 33 sequential test runs
+ 2 min browser download (no cache)
+ 2 min dev server startup
+ ~1 min dependency install
≈ 10-12 minutes total
```

### Files to Modify

1. `playwright.config.ts` - Increase workers from 1 to 4
2. `.github/workflows/test.yml` - Add Playwright browser caching

### Expected Outcome

With 4 workers + browser caching:
- Parallel execution: 33 tests ÷ 4 workers = ~8 parallel batches
- Browser cache saves: 1-2 minutes
- **Expected runtime: 4-6 minutes** (down from 12)
<!-- SECTION:DESCRIPTION:END -->
