# Ralph Workflow - Learn Greek Easy

## Overview

Automated execution of a single user story's Backlog subtasks through per-subtask quality gates (Architecture → Explore → Test-Spec* → Execution → QA Verify; *Test-Spec runs only for logic-bearing `Test-first: yes` subtasks), followed by a story-level visual QA gate (Phase 3.5) that checks the assembled feature against the original objective via the locked `release-verify.yml` run (web verification + artifacts) and the local-sim Maestro gate (mobile). Runs in an isolated git worktree so multiple stories can be worked in parallel from separate terminals without colliding.

Stories arrive in one of two states: **basic** (intent-only — Objective, Core ACs, Out of Scope; produced by `/pm-review` basic mode; zero Backlog subtasks) or **pre-planned** (Backlog subtasks already exist). Basic stories are first planned **in-run** by Phase 0.6 (architecture finalization → unattended QA-verify debate → subtask generation); pre-planned stories skip Phase 0.6 entirely — legacy behavior unchanged.

**Invocation**: `/ralph <STORY-ID>` (e.g., `/ralph SIT-07`). One story per invocation. To run multiple stories in parallel, open another terminal and invoke `/ralph SIT-09` — each invocation creates its own worktree, branch, and PR.

## Model Selection

**Never use the Haiku model.** All agents and subagents must use Sonnet or Opus only.

## CRITICAL RULES

### 1. MANDATORY Agent Delegation
**All file operations happen through spawned agents. No direct reads/edits in lead context.**

| Action | WRONG (bloats context) | RIGHT (uses agents) |
|--------|------------------------|---------------------|
| Find files | `Glob("**/landing/**")` | `Task(subagent_type=Explore, prompt="Find all landing page files...")` |
| Read code | `Read("/path/to/file.tsx")` | Agent reads during its task |
| Edit code | `Edit(file_path=..., old_string=...)` | `Task(subagent_type=product-executor, prompt="Implement...")` |
| Research | Multiple Grep/Read calls | `Task(subagent_type=Explore, prompt="Research how X works...")` |

**Exception:** MCP tools (Backlog, git, gh) can be called directly.

### 2. NO Assumptions, NO Feature Cuts
Never guess, assume, or reduce functionality. If unclear, ask the user.

| WRONG | RIGHT |
|-------|-------|
| "Translation files are empty, so hide the selector" | "Translation files are empty, so populate them with translations" |
| "This feature is complex, let's disable it" | "This feature is complex, let's implement it properly" |
| "The bug is hard to fix, let's remove the feature" | "The bug is hard to fix, let's investigate and fix it" |

### 3. CI Test Gate + Release Gate (BLOCKING)
Cannot output `ALL_TASKS_COMPLETE` until BOTH (a) all CI *test* checks pass on the PR AND (b) a green `release-verify.yml` run completes inside the `dev-release-lease` window (see Phase 3.5). Deploy, Seed, Health/Smoke, Accessibility, K6, and Lighthouse run *inside* that locked release — they are verified there and required for completion.

```bash
gh pr checks [PR_NUMBER]
# Required (per-push, preview.yml CI Gate): Alembic Migration Check, Backend Tests, Unit & Integration Tests,
#           E2E Tests (all shards), E2E API Tests, Backend Lint & Format, Frontend Lint & Format
# Verified inside the locked release-verify.yml run (required for completion, NOT per-push):
#           Deploy, Seed Dev Database, Health and Smoke Tests, web-verify / mobile-e2e, Accessibility, K6, Lighthouse
```

### 4. ONE Branch, ONE PR per User Story
All subtasks of a single user story share one feature branch and one draft PR, all in one worktree. Different user stories run in different worktrees on different branches. Never mix subtasks from different stories on one branch.

---

## Available MCP Servers
| Server | Purpose | Usage |
|--------|---------|-------|
| **Backlog** | Task tracking (MCP) | `mcp__backlog__*` |
| **Context7** | Library docs | `mcp__context7__*` - ALWAYS check before writing library code |
| **Playwright** | Visual verification, E2E, bug research | `mcp__playwright__*` - Use for QA verification |
| **Sentry** | Error tracking, issue investigation | `mcp__sentry__*` - Check for production errors |
| **Railway** | Deployment status (read-only) | `mcp__railway-mcp-server__*` - NO destructive actions |

## Documentation (docs/)
Reference before making changes to related areas:
- `docs/deployment-guide.md` - Sequential deploy, rollback, troubleshooting
- `docs/e2e-seeding.md` - Test data seeding infrastructure
- `docs/ci-cd-labels.md` - PR labels for test control
- `docs/pr-preview-deployments.md` - Preview environments
- `learn-greek-easy-backend/docs/logging.md` - Logging architecture

---

## Workflow

### Phase 0: Story Resolution

1. **Validate the story arg.** `/ralph` requires exactly one user story ID (e.g., `SIT-07`). Error and exit if missing.
2. **Read the Obsidian user story file**:
   - `mcp__obsidian-mcp-tools__get_vault_file` with filename matching `Simon Vault/Projects/Greekly/User Stories/<STORY-ID>*.md` (use `mcp__obsidian-mcp-tools__list_vault_files` against `Simon Vault/Projects/Greekly/User Stories/` to disambiguate the exact filename if needed)
   - Extract the **branch slug** from the `## Branch Strategy` section (e.g., `feature/sit-07-description-audio`)
3. **Query Backlog for subtasks**:
   ```
   mcp__backlog__task_list({
     labels: ["story:<lowercase-story-id>"],   # e.g. "story:sit-07"
     status: "To Do"
   })
   ```
4. **Classify the story state**:
   - **Zero subtasks returned** → the story is **BASIC** (intent-only, from `/pm-review` basic mode). Verify it has an `## Objective` and `## Core Acceptance Criteria` section — if it has neither subtasks in Backlog NOR the basic-story sections, error: "story <ID> is neither basic (no Objective/Core ACs) nor pre-planned (no Backlog subtasks) — run /pm-review first". Set `PLANNING_REQUIRED=true`; topo-sort and plan-logging happen at the end of Phase 0.6 instead.
   - **Subtasks returned** → the story is **PRE-PLANNED**. Topo-sort by `dependencies` → linear execution order, log the plan (story title, branch slug, ordered subtask list), and skip Phase 0.6.

### Phase 0.5: Worktree Bootstrap

1. **Resolve paths**:
   - `MAIN_CHECKOUT=/Users/samosipov/Downloads/learn-greek-easy`
   - `WORKTREE_PATH="$MAIN_CHECKOUT/.claude/worktrees/<lowercase-story-id>"`
   - `BRANCH=<branch-slug-from-Obsidian>`

2. **Pre-flight check**:
   ```bash
   if [ -d "$WORKTREE_PATH" ]; then
     # If 'git -C "$MAIN_CHECKOUT" worktree list' shows it: another /ralph instance is running this story → error and exit.
     # Otherwise it's stale: tell the user to run /post-merge-cleanup before retrying.
     exit 1
   fi
   ```

3. **Sync main and create worktree on a fresh feature branch**:
   ```bash
   git -C "$MAIN_CHECKOUT" fetch origin main
   git -C "$MAIN_CHECKOUT" worktree add -b "$BRANCH" "$WORKTREE_PATH" origin/main
   ```

4. **Bootstrap dependencies** (run in parallel to save time):
   ```bash
   cp "$MAIN_CHECKOUT/learn-greek-easy-backend/.env" "$WORKTREE_PATH/learn-greek-easy-backend/.env"
   cp "$MAIN_CHECKOUT/learn-greek-easy-frontend/.env" "$WORKTREE_PATH/learn-greek-easy-frontend/.env" 2>/dev/null || true

   (cd "$WORKTREE_PATH/learn-greek-easy-backend" && /Users/samosipov/.local/bin/poetry install --no-root) &
   (cd "$WORKTREE_PATH/learn-greek-easy-frontend" && npm ci) &
   wait
   ```

5. **All subsequent shell commands run inside `$WORKTREE_PATH`.** Pass it as the CWD to subagents that need to read/edit/test files.

6. **Move all subtasks to "In Progress"** (skip if `PLANNING_REQUIRED` — no subtasks exist yet; Phase 0.6c does this after creating them):
   ```
   For each subtask ID:
     mcp__backlog__task_edit(id=task_id, status="In Progress")
   ```

### Phase 0.6: Planning (basic stories only)

Runs ONLY when Phase 0 set `PLANNING_REQUIRED=true` — i.e. the story is in **basic state** (Objective, 3–7 Core ACs, Out of Scope, Constraints, Decisions; no Backlog subtasks). Pre-planned stories skip this phase entirely.

All planning runs **inside the worktree** so every file reference is written against the code that will actually be modified — specs cannot rot because nothing waits.

#### a. Architecture — finalize the story
- Spawn `product-architecture-spec` (Opus) via Task tool, CWD = `$WORKTREE_PATH`, passing the FULL basic story content and its Obsidian path. Instruct it to operate per its "Expanding a Basic Story" section.
- It rewrites the story file in Obsidian (same path) to final state: system design, **## Implementation Subtasks** (`[<STORY-ID>-NN]` with Category / Dependencies / Description / Acceptance Criteria / Order / Test-first classification + Test Specs tables for `Test-first: yes`), and a **## Decisions** section appending every assumption it made where the basic story was silent (decision, why, alternative rejected).
- **Traceability rule (hard):** every derived AC and subtask must trace to the basic story's Objective or a Core AC. Nothing listed in Out of Scope may appear in any subtask.
- **Checkpoint:** `STORY_FINALIZED`

#### b. QA-Verify debate — UNATTENDED disposition
- Run the `/qa-verify` protocol (`~/.claude/commands/qa-verify.md`) against the finalized story: `product-qa-spec` critic (**Sonnet**) vs `product-architecture-spec` architect (**Opus**), ≤3 rounds, citation-required — **including the Intent-Integrity checks** (AC→Objective traceability, Out-of-scope leakage = mechanical).
- Use the protocol's **Unattended Mode** disposition table: mechanical+resolved+cited → auto-apply; judgment / unresolved / uncited → **conservative default** (the option closest to the basic story's explicit text, the smaller scope) + prominent log entry. NEVER block on the user.
- Append the run to the story's `… QA Debate Log.md` as the standalone skill does, marking each disposition `auto-applied | conservative-default (reason)`.
- **Checkpoint:** `PLAN_VERIFIED`

#### c. Subtask generation — Backlog tasks
- Execute the `subtask-generator` logic (`~/.claude/skills/subtask-generator/SKILL.md`) for the finalized story, passing the story explicitly (no context detection): spawn parallel `product-architecture-spec` agents → one Backlog task per subtask (description, acceptance_criteria, implementation_plan, references, labels `["story:<slug>", ...]`), then wire dependencies between the created task IDs.
- Move all created subtasks to "In Progress" (this replaces the Phase 0.5 step that was skipped).
- Topo-sort by dependencies → linear execution order. **Log the plan**: story title, branch slug, ordered subtask list, and the count of Decisions + conservative-default dispositions.
- **Checkpoint:** `SUBTASKS_READY`

#### d. Decisions surfacing (non-blocking)
- When spawning the FIRST subtask's executor (Phase 1), instruct it to include in the draft PR description: the story's **## Decisions** section (PM defaults + architect assumptions + conservative-default debate dispositions) and a pointer to the QA Debate Log. This is the user's review surface — the run does NOT wait for input; completion gates remain CI + Phase 3.5 as always.

Then proceed to Phase 1 exactly as for a pre-planned story.

### Phase 1: Sequential Subtask Execution

For each subtask, in dependency order, execute the 4 stages below. Delegate to subagents — never implement code directly.

#### Subagent Mapping (MANDATORY)
| Stage | Subagent Type | Usage |
|-------|--------------|-------|
| Architecture | product-architecture-spec | Always — review/enhance the implementation plan (includes plan self-validation + per-subtask `Test-first: yes/no` classification and a Test Specs table for logic-bearing subtasks) |
| Explore | Explore | Always — verify files, patterns, and placement |
| Test-Spec | product-qa-spec | **`Test-first: yes` subtasks only** — author the architect's Test Specs as runnable tests and confirm they fail (RED) before any implementation (the agent's Mode A) |
| Execution | product-executor | Always — implement all code changes; for `Test-first: yes` subtasks, drive the red tests to green |
| QA Verify | product-qa-spec | Always — verify implementation correctness (skeptical by default; see the agent's Critique Disposition). For test-first subtasks, confirm the AC tests are green + meaningful and add adversarial/edge coverage (the agent's Mode B) |

> A second, **story-level** QA pass runs once after all subtasks complete — see **Phase 3.5: Story-Level Visual QA Gate**.

#### Mobile stories (`learn-greek-easy-mobile`) — special handling
- **Iterate with Metro + Fast Refresh, NEVER Release-rebuild-per-change.** Build the Debug dev-client ONCE in the worktree (`npx expo run:ios` — one cold native compile, since Xcode DerivedData is worktree-path-keyed), then keep Metro running. Every JS / NativeWind / `tailwind.config` edit then hot-reloads on the simulator in ~1s. A `--configuration Release` rebuild per change (~10 min each) is the single biggest mobile-RALPH time-sink — `Release` is only for final *unattended* visual capture.
- **NativeWind opacity gotcha:** never put a `token/NN` opacity modifier on a custom var-backed token — it renders DARK on native (the RN opacity-modifier path is broken; see MOB-13 / project memory). Use an explicit full-color token instead.
- **No web preview deploy** — the mobile Phase 3.5 gate runs on the iOS simulator and diffs against the design export, not a preview URL. It **reuses the same `.maestro/onboarding.yaml` + `.maestro/smoke.yaml` flows + `reset-onboarding` endpoint as the CI `mobile-e2e` job** — no new harness (see the Mobile variant in Phase 3.5).

#### Fallback: If Subagent Spawning Fails
Read the corresponding agent technical prompt file BEFORE executing the stage yourself:

| Stage | Read this file first |
|-------|---------------------|
| Architecture | `~/.claude/agents/product-architecture-spec.md` |
| Test-Spec | `~/.claude/agents/product-qa-spec.md` (Mode A) |
| QA Verify | `~/.claude/agents/product-qa-spec.md` (Mode B) |
| Execution | `~/.claude/agents/product-executor.md` |
| Explore | No file needed — use Glob/Grep/Read directly inside the worktree |

#### Stage 1: Architecture
- Spawn a `product-architecture-spec` subagent via Task tool
- Pass it the FULL subtask details from Backlog (description, acceptance criteria, implementation plan, references)
- If the subtask already has a detailed implementation plan, the architect validates it and identifies file paths
- If thin, the architect enhances it with data models, API contracts, file paths, edge cases, error handling
- The architect self-validates the plan (acceptance criteria coverage, edge cases, test strategy)
- **Update the Backlog task** via `mcp__backlog__task_edit` to populate the implementation_plan field
- **Checkpoint:** `ARCHITECTURE_DONE`

#### Stage 2: Explore Verification
- Spawn an `Explore` subagent via Task tool, passing `$WORKTREE_PATH` as CWD so it greps the right tree
- Verify all referenced files exist; patterns, imports, and placement locations match; references are accessible
- If gaps found, update the Backlog task's implementation_notes via `mcp__backlog__task_edit`
- **Checkpoint:** `EXPLORE_DONE`

#### Stage 2.5: Test-Spec (`Test-first: yes` subtasks only)
- **Skip this stage entirely if the subtask is `Test-first: no`** (UI/visual/copy/config — its oracle is the Phase 3.5 visual gate, not unit tests). Run it for `Test-first: yes` subtasks (logic-bearing: services, API contracts, business rules, data models, state machines, validation).
- Spawn a `product-qa-spec` subagent via Task tool (its **Mode A**), passing `$WORKTREE_PATH` as CWD and the architect's **Test Specs** table from the subtask.
- It transcribes each Test Spec row into a runnable test (unit / integration / API) and runs the suite to confirm the new tests **FAIL for the right reason** — assertion or not-implemented, NOT import/collection errors. These tests come from the acceptance criteria, authored before implementation, independent of how the executor will build the feature.
- It commits the red tests inside the worktree.
- **Checkpoint:** `TESTS_RED`

#### Stage 3: Execution
- Spawn a `product-executor` subagent via Task tool, passing `$WORKTREE_PATH` as CWD
- Pass it the COMPLETE Backlog subtask details: acceptance criteria, implementation plan, references, implementation notes
- For `Test-first: yes` subtasks, instruct it to **drive the Stage 2.5 red tests to green** — implement until they pass, without weakening, skipping, or deleting any red test (if a test itself is wrong, it flags it rather than editing around it). It authors no *new* tests (QA adds those in Stage 4).
- The executor handles all file reads, edits, and creation **inside the worktree**
- The executor commits inside the worktree and (per its FIRST/MIDDLE/FINAL `**Order**` logic in `~/.claude/agents/product-executor.md`) handles `git push` and the PR draft/ready transitions
- After the executor finishes, run tests inside the worktree:
  ```bash
  (cd "$WORKTREE_PATH/learn-greek-easy-backend" && /Users/samosipov/.local/bin/poetry run pytest -x)
  (cd "$WORKTREE_PATH/learn-greek-easy-frontend" && npm test -- --run)
  ```
- **Checkpoint:** `EXECUTION_DONE`

#### Stage 4: QA Verification
- Spawn a `product-qa-spec` subagent via Task tool (its **Mode B**). It runs in its **default critique disposition** (skeptical, anchors on acceptance criteria not the diff, cites evidence per verdict — see `~/.claude/agents/product-qa-spec.md`).
- Pass it: acceptance criteria, implementation plan, list of changed files, Definition of Done items
- For `Test-first: yes` subtasks, it confirms the Stage 2.5 AC tests are now **green and still meaningful** (would fail if the behavior regressed), then *adds* the adversarial / edge / negative coverage those AC tests didn't include — it does not re-author the AC tests.
- Backend-only: verify tests pass, model/schema correctness
- Frontend: use Playwright MCP for visual verification (against the PR's preview deploy URL once available)
- If issues found: spawn product-executor to fix, then re-verify
- Update Backlog task's implementation_notes with QA findings
- **Checkpoint:** `QA_VERIFIED`

After each subtask, pick the next one (next in dependency order) and repeat stages 1–4.

### Phase 2: PR Lifecycle

The PR is managed by `product-executor` via the subtask `**Order**` field — the orchestrator does NOT manage PR state directly:

- Order = "1 of N (FIRST)" → executor pushes the worktree's branch and creates the DRAFT PR with `skip-visual` label
- Order = "K of N" (middle) → executor pushes only; PR stays draft
- Order = "N of N (FINAL)" → executor pushes, runs `gh pr ready`, removes `skip-visual` label

The orchestrator never runs `git checkout -b`, `gh pr create`, or `gh pr ready` directly.

### Phase 3: CI & CodeRabbit

After the FINAL subtask's Stage 4 completes:

1. **Monitor CI** — poll `gh pr checks [PR_NUMBER]` every 3 minutes (CI Monitoring Protocol below).
2. **Review CodeRabbit comments** as soon as all per-push *test* checks pass — CodeRabbit runs before the Phase 3.5 release handshake, so you needn't wait for the locked release to start it.
   ```bash
   gh pr view [PR_NUMBER] --comments
   gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/reviews
   gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments
   ```
   - Agree with comment → fix in code (inside worktree), commit, push
   - Disagree or N/A → skip
3. After CodeRabbit fixes pushed, monitor CI again until green.
4. **Proceed to Phase 3.5** below — do NOT move subtasks to "Done" or emit completion until the story-level visual QA gate passes.

### Phase 3.5: Story-Level Visual QA Gate

Runs **once per story**, after CI is green and CodeRabbit is addressed, against the **locked `release-verify.yml` run** on the PR (pre-merge — production only deploys *after* merge, so this is the last gate before merge). A second, independent QA pass at **story altitude**: it verifies the *assembled feature against the original objective*, not per-subtask diffs. This closes the blind spot where every subtask diff passes individually yet the whole feature misses the goal.

This is a **release handshake**, not agent-driven browsing: RALPH triggers the locked `release-verify.yml`, waits for it, and consumes its verification artifacts. It does NOT resolve a preview URL or drive Playwright/Maestro against shared dev directly — all verification runs inside the `dev-release-lease` window so parallel stories never stomp the shared dev environment.

1. **Read the original acceptance criteria** from the Obsidian parent story (the original objective — NOT the possibly-edited subtask ACs).
2. **Trigger the locked release.**
   - **PRIMARY — label:** add the `ready-to-verify` label to the PR. The `dispatch-release-verify` shim in `preview.yml` fires `release-verify.yml` at the PR head ref.
     ```bash
     gh pr edit "$PR_NUMBER" --add-label ready-to-verify
     ```
   - **FALLBACK — manual dispatch with explicit `--ref`** (use if the label shim didn't fire):
     ```bash
     BRANCH="$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD)"
     gh workflow run release-verify.yml \
       --ref "$BRANCH" \
       -f pr_number="$PR_NUMBER" \
       -f pr_head_sha="$(git -C "$WORKTREE_PATH" rev-parse HEAD)" \
       -f pr_head_ref="$BRANCH" \
       -f pr_labels='[]'
     ```
   - **HARD RULE:** NEVER dispatch `release-verify.yml` against `main` before this PR has merged there — `workflow_dispatch` resolves the workflow definition from the target ref, so dispatching `--ref main` pre-merge fails with workflow-not-found (or runs a stale/wrong definition). Always target the PR head branch pre-merge.
3. **Wait for the release run.** Get the run id, then watch/poll until it concludes (the lease serializes runs, so a queued run may wait for a prior one):
   ```bash
   RUN_ID="$(gh run list --workflow release-verify.yml --branch "$BRANCH" --limit 1 --json databaseId -q '.[0].databaseId')"
   gh run watch "$RUN_ID" --exit-status   # or poll `gh run view "$RUN_ID" --json status,conclusion` per CI Monitoring Protocol
   ```
4. **Consume the verification artifacts.** Download the web screenshots (and mobile artifacts on a mobile PR) from the completed run:
   ```bash
   gh run download "$RUN_ID" -n web-verify-screenshots -D "$WORKTREE_PATH/.ralph/web-verify"
   ```
   The `web-verify-screenshots` artifact (from RGATE-03) contains `01-login.png`, `02-dashboard.png`, `03-decks.png`, and `99-failure.png` (on failure).
5. **Spawn `product-qa-spec`** (default critique disposition). For **each** acceptance criterion, emit `pass | fail` **plus a screenshot from the consumed artifact** as evidence. A holistic "looks done" is not allowed — every AC needs its own pixel proof drawn from the locked-release artifacts.
   - **Style:** hold the UI to `docs/design-system.md`. A style defect that cites a design-system rule (token drift, wrong `src/components/ui/*` primitive, palette crossing, off-scale spacing) is a real fail. Pure taste with no citable rule → **advisory, escalate to the user, never bounce the executor**.
6. **Fix loop (cap 2 cycles):** batch ALL fails into one report → spawn `product-executor` to fix inside the worktree → push → **re-trigger the release** (add `ready-to-verify` again if removed, or re-dispatch with `--ref "$BRANCH"`) → **wait** for the new run → **re-consume** its artifacts → re-verify only the failed ACs. Every bounce must cite an AC id or a design-system rule. After **2** cycles, stop and **escalate remaining fails to the user** — each release run holds the dev lease and is expensive, do not grind.
7. **Log** to the story's `… QA Debate Log.md` (the same file `/qa-verify` writes, next to the story) under a `## Post-Deploy Visual QA — <date>` section: per-AC verdict, screenshot reference (artifact + filename), fix cycles used, the release run id(s), and any design-system citations / advisory style notes.
8. **On PASS** (all original ACs pass on a green release run, no unresolved bounces):
   - Move all subtasks to "Done": `For each subtask ID: mcp__backlog__task_edit(id=task_id, status="Done")`
   - Output `<promise>ALL_TASKS_COMPLETE</promise>`.
   **On unresolved fails after 2 cycles (or a red release run that fix-loops can't green):** leave subtasks "In Progress", do NOT emit completion, and surface the escalation to the user.

#### Phase 3.5 — Mobile variant (`learn-greek-easy-mobile` UI stories)

Mobile has no web preview deploy, so the gate runs on the **iOS simulator** and diffs against the **authoritative design export** — not a URL, and **not** against your own app captures. **No new harness — it reuses the exact same flow files as the CI `mobile-e2e` job** (`.github/workflows/preview.yml`): `.maestro/onboarding.yaml` + `.maestro/smoke.yaml`.

> **Why this stays LOCAL (not a release handshake like web):** mobile has no web preview deploy, and a `--configuration Release` rebuild is ~10 min — so the mobile gate runs Maestro on the orchestrator's own iOS simulator against the dev backend, rather than waiting on `release-verify.yml`. (The CI `mobile-e2e` job inside release-verify still runs in parallel; consume its `mobile-e2e-maestro` artifact opportunistically, but the authoritative mobile gate is this local sim run.)
>
> **Race-safety prerequisite (bound to RGATE-05):** this local run is race-safe ONLY because RGATE-05's per-PR seed namespacing is in place — the reset curls and the Maestro `--env` below all target `e2e_beginner+pr<N>@test.com`, and a `seed/all` with that `pr_number` must have provisioned the user first. Do NOT run parallel mobile RALPH stories against shared dev without this namespacing, or they will clobber each other's onboarding state.

1. **Boot RALPH's OWN simulator** (the orchestrator's sim is session-isolated from the user's — boot a fresh one via `xcrun simctl boot` + `bootstatus -b`). Build the cached Debug dev-client ONCE (`npx expo run:ios`, or reuse the one already running from execution) and keep **Metro on `127.0.0.1:8081`** — the flows launch with `--initialUrl http://127.0.0.1:8081`. Point the app at the **dev backend**: `API_URL=https://frontend-dev-8db9.up.railway.app` (same dev frontend the CI job and PR preview use).
2. **Reset before AND after** via the MOB15-01 endpoint so the run is repeatable and residue-free — exactly as CI does:
   ```bash
   curl -s -X POST "https://frontend-dev-8db9.up.railway.app/api/v1/test/seed/reset-onboarding" \
     -H "Content-Type: application/json" -d "{\"pr_number\": \"$PR_NUMBER\"}"   # pre-run: must return success=true
   # … run flows …
   curl -s -X POST "https://frontend-dev-8db9.up.railway.app/api/v1/test/seed/reset-onboarding" \
     -H "Content-Type: application/json" -d "{\"pr_number\": \"$PR_NUMBER\"}"   # post-run: tour_completed_at must be null
   ```
   The reset curl and Maestro `--env` must resolve to the same `e2e_beginner+pr<N>@test.com`, and a `seed/all` with that `pr_number` must have provisioned the user first.
3. **Run the reused flows** to drive every onboarding screen and capture per-screen screenshots (the flows already `takeScreenshot` each step: `01-login` … `10-app-home`):
   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk
   (cd "$WORKTREE_PATH/learn-greek-easy-mobile" && maestro test --env E2E_EMAIL="e2e_beginner+pr${PR_NUMBER}@test.com" .maestro/onboarding.yaml && maestro test .maestro/smoke.yaml)
   ```
4. **Feed the per-screen screenshots to `product-qa-spec`** (strict / adversarial) for a design critique. **Compare against the authoritative design export** — `design_handoff_*/screenshots/*` (or the handoff mock rendered at phone size). Comparing the app to *self-generated* screenshots is circular and will false-pass — that is how MOB-09 shipped a degraded login. The critic must flag EVERY deviation: element order, missing elements (a dropped social provider), flat-vs-frosted glass, scrim strength, spacing, copy. A hi-fi handoff silently degraded to a "sanctioned fallback" (flat `View` instead of `BlurView`, dropped button) is a **fail**, never an acceptable shortcut.
   - **Fallback when no design export exists for the screen:** critique against `docs/design-system.md` rules + the MOB-14 design reference (`docs/mobile-app.md` § Visual QA), and **flag to the user that fidelity is human-confirmed** for any pixel call not citable against a rule.
5. **Iterate via Metro Fast Refresh (~1s), NEVER Release-rebuild-per-change (~10 min).** Only rebuild natively when *native* code changes. Release builds are for final unattended capture only.
6. **Fidelity is human-confirmed** — do not self-certify a pixel match. Surface app-vs-design-export to the user for the subjective call; only deviations citable against the design export or a `docs/design-system.md` rule bounce the executor.
7. Log to the story's QA Debate Log as in the web flow.

### Phase 4: Worktree Cleanup

After the PR merges (manual user action or via `/gh-merge-pr`), run `/post-merge-cleanup` (or manually):

```bash
git -C "$MAIN_CHECKOUT" worktree remove "$WORKTREE_PATH"
git -C "$MAIN_CHECKOUT" branch -d "$BRANCH"
```

---

## Session Continuity

Each worktree maintains its own `.claude/handoff.yaml` at `$WORKTREE_PATH/.claude/handoff.yaml`.

### On Start
Check the worktree's handoff first; if it exists and is recent, restore from it.

### During Work (every 2–3 subtasks)
Update `.claude/handoff.yaml`:

```yaml
timestamp: <iso>
workflow: ralph
story_id: SIT-07
branch: feature/sit-07-description-audio
worktree_path: /Users/samosipov/Downloads/learn-greek-easy/.claude/worktrees/sit-07
pr_number: null   # set after FIRST subtask creates the PR
current_subtask: SIT-07-02
stage: execution   # architecture | explore | test-spec | execution | qa-verify | visual-qa
completed_subtasks:
  - SIT-07-01
blockers: []
decisions: []
```

### On Compaction
A PreCompact hook auto-saves state. After compaction, READ the handoff to continue.

---

## CI Monitoring Protocol

Use this protocol whenever waiting for CI after a push.

### Poll every 3 minutes
```bash
gh pr checks [PR_NUMBER]
```

### Decision tree

**1. Any check has FAILED?**
```bash
gh run view [RUN_ID] --job [JOB_ID] --log 2>&1 | tail -50
gh run cancel [RUN_ID]
# Fix in worktree, commit, push — CI restarts on push
git -C "$WORKTREE_PATH" add ... && git -C "$WORKTREE_PATH" commit -m "fix: ..." && git -C "$WORKTREE_PATH" push
```

**2. Only 1 E2E shard "pending" AND only setup steps in its log?**

This is a known GitHub Actions slow-start bug. If `gh run view ... --log | head -30` shows only `Set up job`, `Initialize containers`, `Checkout code`, `Setup Node.js`, `Install frontend dependencies`, `Get Playwright version` — with no actual test output — **treat CI as passed**. Don't wait. Move to CodeRabbit.

**3. All test checks pass?**

"Test checks" = Alembic Migration Check, Backend Tests, Unit & Integration Tests, E2E Tests (all shards), E2E API Tests, Backend Lint & Format, Frontend Lint & Format.

When all per-push test checks are green → proceed to CodeRabbit, then to the Phase 3.5 release handshake. Deploy, Seed Dev Database, Health and Smoke Tests, Lighthouse CI, Accessibility Tests, and K6 are NOT separate per-push checks to wait on here — they run *inside* the locked `release-verify.yml` run that Phase 3.5 triggers, and gate completion there.

### Get the current run ID
```bash
gh run list --branch "$BRANCH" --limit 1 --json databaseId,status -q '.[0]'
```

---

## Completion Rules

1. **Local tests green ≠ done** — all CI test checks must pass (see CI Monitoring Protocol)
2. **A green `release-verify.yml` run IS a blocker** — task completion requires the locked release (Deploy → Seed → Health/Smoke → web-verify / mobile-e2e → A11y/K6/Lighthouse) to pass inside the `dev-release-lease` window. CodeRabbit review may start as soon as per-push test checks pass, but completion is gated on the release run.
3. **Subtask status transitions**:
   - Start: "To Do" → "In Progress" (during Phase 0.5)
   - Complete: "In Progress" → "Done" (ONLY after Phase 3.5 passes — the locked `release-verify.yml` run is green; see Phase 3 step 4 and Phase 3.5 "On PASS")
4. **Story-Level Visual QA Gate (Phase 3.5) must pass** before completion — all original acceptance criteria verified via the locked `release-verify.yml` run's artifacts (web) / the local-sim Maestro gate (mobile), no unresolved bounces
5. Output `<promise>ALL_TASKS_COMPLETE</promise>` ONLY after Phase 3.5 passes AND subtasks are moved to "Done"

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|------------------|
| Lead doing file edits directly | Delegate to product-executor / Explore subagents |
| Skipping architecture / explore / QA stages | Every stage is mandatory (Test-Spec is mandatory for `Test-first: yes` subtasks, skipped only for `Test-first: no`) |
| Implementing a logic-bearing subtask before its AC tests are red | Author failing AC tests in Stage 2.5 first (`TESTS_RED`), then the executor drives them green |
| Weakening, skipping, or deleting a red test to force green | Fix the implementation, not the test; if the test itself is wrong, flag it for architect/QA |
| Executor authoring its own test coverage | Executor only drives the architect's pre-authored reds to green; QA owns new test coverage (Stage 4) |
| Working in main checkout | Always work in `$WORKTREE_PATH`; main is the user's space |
| Mixing subtasks from different stories on one branch | One story per branch, always |
| Title-parsing Backlog tasks to find a story's subtasks | Use the `story:<slug>` label set by Phase 0.6c / /subtask-generator |
| Erroring out on a story with zero Backlog subtasks | Zero subtasks + Objective/Core ACs present = BASIC story → run Phase 0.6 Planning |
| Blocking on the user during Phase 0.6 (interview, judgment escalation) | Unattended disposition: defaults + conservative options, recorded in ## Decisions / QA Debate Log; user reviews via PR description |
| Architect inventing scope while expanding a basic story | Every derived AC/subtask traces to Objective/Core AC; Out-of-scope leakage = mechanical fail (intent drift) |
| Creating a Backlog parent task for the user story | The user story lives in Obsidian only |
| Orchestrator running `git checkout -b` | Use `git worktree add -b`; the executor handles push and PR |
| Auto-discovering To Do tasks across stories | `/ralph` runs one story at a time; user names which |
| Skipping subtask status transitions | Move: To Do → In Progress → Done |
| Not updating handoff during long runs | Update every 2–3 subtasks |
| Hiding/disabling features to "fix" bugs | Actually fix the bug; add missing data |
| Outputting ALL_TASKS_COMPLETE before CI test checks pass | Wait for all test checks to pass |
| Treating Deploy/Smoke/A11y/K6/Lighthouse as never-required | They are required — verified inside the locked `release-verify.yml` run (Phase 3.5). Per-push, start CodeRabbit as soon as test checks pass; completion still needs a green release |
| Sleeping/polling tightly for CI | Poll every 3 minutes per CI Monitoring Protocol |
| Waiting indefinitely for stuck E2E shard | Check logs — if only setup steps, treat as passed |
| Not cleaning up worktree after merge | Run /post-merge-cleanup or `git worktree remove` manually |
| Bouncing the executor on uncited taste | Style fails must cite a docs/design-system.md rule; pure taste is advisory → escalate to the user |
| Emitting ALL_TASKS_COMPLETE before Phase 3.5 | The story-level visual QA gate is mandatory before completion |
| Grinding the visual-QA fix loop past 2 cycles | Cap at 2; escalate unresolved fails to the user (each redeploy is costly) |
| Iterating mobile UI with `--configuration Release` rebuilds | Build the Debug dev-client once, then Metro + Fast Refresh (~1s/change) |
| Mobile visual-QA comparing the app to your own captures | Diff against the authoritative design export (`design_handoff/screenshots`) |
| Silently degrading a hi-fi mobile design to a "fallback" | Flag every deviation (flat-vs-frost, dropped element) as a fail |
| Self-certifying a mobile pixel match | Fidelity is human-confirmed — surface app vs design export to the user |
| `token/NN` opacity modifier on a var-backed mobile token | Renders dark on native — use an explicit full-color token (MOB-13) |
| Driving Playwright/Maestro against shared dev from the agent, outside the lease | Use the Phase 3.5 release handshake — trigger `release-verify.yml` (label or `--ref`), wait, consume its artifacts |
| Running the mobile reset/flow against the shared `e2e_beginner` user while another story may be mid-release | Use the per-PR namespaced seed user `e2e_beginner+pr<N>@test.com` (RGATE-05); never share the base user across concurrent stories |
