# Ralph Workflow - Learn Greek Easy

## Overview

Automated execution of a single user story's Backlog subtasks through 4 mandatory quality gates (Architecture → Explore → Execution → QA Verify). Runs in an isolated git worktree so multiple stories can be worked in parallel from separate terminals without colliding.

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

### 3. CI Test Gate (BLOCKING)
Cannot output `ALL_TASKS_COMPLETE` until all CI *test* checks pass. Deploy/Smoke are NOT required.

```bash
gh pr checks [PR_NUMBER]
# Required: Alembic Migration Check, Backend Tests, Unit & Integration Tests,
#           E2E Tests (all shards), E2E API Tests, Backend Lint & Format, Frontend Lint & Format
# NOT required: Deploy, Seed Dev Database, Health and Smoke Tests, Lighthouse, K6, Accessibility
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
4. **Topo-sort the subtasks** by their `dependencies` field → linear execution order.
5. **Validate**: if zero subtasks returned, error with: "no To Do subtasks found for story <ID>; verify subtask-generator was run and the `story:<slug>` label is set on each subtask".
6. **Log the plan**: print the story title, branch slug, and ordered subtask list so the user can see what will run.

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

6. **Move all subtasks to "In Progress"**:
   ```
   For each subtask ID:
     mcp__backlog__task_edit(id=task_id, status="In Progress")
   ```

### Phase 1: Sequential Subtask Execution

For each subtask, in dependency order, execute the 4 stages below. Delegate to subagents — never implement code directly.

#### Subagent Mapping (MANDATORY)
| Stage | Subagent Type | Usage |
|-------|--------------|-------|
| Architecture | product-architecture-spec | Always — review/enhance the implementation plan (includes plan self-validation) |
| Explore | Explore | Always — verify files, patterns, and placement |
| Execution | product-executor | Always — implement all code changes |
| QA Verify | product-qa-spec | Always — verify implementation correctness |

#### Fallback: If Subagent Spawning Fails
Read the corresponding agent technical prompt file BEFORE executing the stage yourself:

| Stage | Read this file first |
|-------|---------------------|
| Architecture | `~/.claude/agents/product-architecture-spec.md` |
| QA Verify | `~/.claude/agents/product-qa-spec.md` |
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

#### Stage 3: Execution
- Spawn a `product-executor` subagent via Task tool, passing `$WORKTREE_PATH` as CWD
- Pass it the COMPLETE Backlog subtask details: acceptance criteria, implementation plan, references, implementation notes
- The executor handles all file reads, edits, and creation **inside the worktree**
- The executor commits inside the worktree and (per its FIRST/MIDDLE/FINAL `**Order**` logic in `~/.claude/agents/product-executor.md`) handles `git push` and the PR draft/ready transitions
- After the executor finishes, run tests inside the worktree:
  ```bash
  (cd "$WORKTREE_PATH/learn-greek-easy-backend" && /Users/samosipov/.local/bin/poetry run pytest -x)
  (cd "$WORKTREE_PATH/learn-greek-easy-frontend" && npm test -- --run)
  ```
- **Checkpoint:** `EXECUTION_DONE`

#### Stage 4: QA Verification
- Spawn a `product-qa-spec` subagent via Task tool
- Pass it: acceptance criteria, implementation plan, list of changed files, Definition of Done items
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
2. **Review CodeRabbit comments** as soon as all *test* checks pass. Don't wait for Deploy/Smoke.
   ```bash
   gh pr view [PR_NUMBER] --comments
   gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/reviews
   gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments
   ```
   - Agree with comment → fix in code (inside worktree), commit, push
   - Disagree or N/A → skip
3. After CodeRabbit fixes pushed, monitor CI again until green.
4. **Move all subtasks to "Done"**:
   ```
   For each subtask ID: mcp__backlog__task_edit(id=task_id, status="Done")
   ```
5. Output `<promise>ALL_TASKS_COMPLETE</promise>`.

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
stage: execution   # architecture | explore | execution | qa-verify
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

When all green → move on immediately. Do NOT wait for Deploy, Seed Dev Database, Health and Smoke Tests, Lighthouse CI, Accessibility Tests, K6.

### Get the current run ID
```bash
gh run list --branch "$BRANCH" --limit 1 --json databaseId,status -q '.[0]'
```

---

## Completion Rules

1. **Local tests green ≠ done** — all CI test checks must pass (see CI Monitoring Protocol)
2. **Deploy/Smoke are NOT blockers** — CodeRabbit review and task completion don't require them
3. **Subtask status transitions**:
   - Start: "To Do" → "In Progress" (during Phase 0.5)
   - Complete: "In Progress" → "Done" (after CI test checks pass AND CodeRabbit fixes committed)
4. Output `<promise>ALL_TASKS_COMPLETE</promise>` ONLY after moving subtasks to "Done"

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|------------------|
| Lead doing file edits directly | Delegate to product-executor / Explore subagents |
| Skipping architecture / explore / QA stages | Every stage is mandatory |
| Working in main checkout | Always work in `$WORKTREE_PATH`; main is the user's space |
| Mixing subtasks from different stories on one branch | One story per branch, always |
| Title-parsing Backlog tasks to find a story's subtasks | Use the `story:<slug>` label set by /subtask-generator |
| Creating a Backlog parent task for the user story | The user story lives in Obsidian only |
| Orchestrator running `git checkout -b` | Use `git worktree add -b`; the executor handles push and PR |
| Auto-discovering To Do tasks across stories | `/ralph` runs one story at a time; user names which |
| Skipping subtask status transitions | Move: To Do → In Progress → Done |
| Not updating handoff during long runs | Update every 2–3 subtasks |
| Hiding/disabling features to "fix" bugs | Actually fix the bug; add missing data |
| Outputting ALL_TASKS_COMPLETE before CI test checks pass | Wait for all test checks to pass |
| Waiting for Deploy/Smoke before CodeRabbit review | Start CodeRabbit review as soon as test checks pass |
| Sleeping/polling tightly for CI | Poll every 3 minutes per CI Monitoring Protocol |
| Waiting indefinitely for stuck E2E shard | Check logs — if only setup steps, treat as passed |
| Not cleaning up worktree after merge | Run /post-merge-cleanup or `git worktree remove` manually |
