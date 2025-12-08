---
id: task-156
title: 'BUG: Failing E2E Tests'
status: To Do
assignee: []
created_date: '2025-12-08 07:12'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is, occasionally, flaky or failed E2E tests - https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20019030002/job/57402361028
  1 failed
    [chromium] › tests/e2e/accessibility.spec.ts:46:3 › Accessibility (Axe-core) › Decks page should have no accessibility violations
  2 flaky
    [firefox] › tests/e2e/accessibility.spec.ts:46:3 › Accessibility (Axe-core) › Decks page should have no accessibility violations
    [webkit] › tests/e2e/keyboard-navigation.spec.ts:33:3 › Keyboard Navigation › All interactive elements should be keyboard accessible

But next run is fine
https://github.com/SimonOsipov/learn-greek-easy/actions/runs/20019230792

We need to make sure that we don't have flaky tests, since it fails the pipeline
<!-- SECTION:DESCRIPTION:END -->
