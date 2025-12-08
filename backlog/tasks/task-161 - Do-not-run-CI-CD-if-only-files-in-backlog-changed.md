---
id: task-161
title: Do not run CI/CD if only files in backlog changed
status: To Do
assignee: []
created_date: '2025-12-08 16:24'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When we have PR, no matter the commit, CI/CD will run on push. If commit is only with changes to the `backlog` folder, lets not trigger the CI/CD, since it is only documentation change
<!-- SECTION:DESCRIPTION:END -->
