# Ralph Loop Prompt - Learn Greek Easy

## CRITICAL RULES (READ FIRST)

### 1. MANDATORY Agent Delegation
**You MUST delegate work to agents. Direct file operations in main context = VIOLATION.**

| Action | WRONG (bloats context) | RIGHT (uses agents) |
|--------|------------------------|---------------------|
| Find files | `Glob("**/landing/**")` | `Task(subagent_type=Explore, prompt="Find all landing page files...")` |
| Read code | `Read("/path/to/file.tsx")` | Agent reads during its task |
| Edit code | `Edit(file_path=..., old_string=...)` | `Task(subagent_type=product-executor, prompt="Implement...")` |
| Research | Multiple Grep/Read calls | `Task(subagent_type=Explore, prompt="Research how X works...")` |

**Exception:** MCP tools (Vibe Kanban, git commands, gh commands) can be called directly.

### 2. Testing Environment
**NEVER install dependencies in worktrees. Use existing environment.**

```bash
# WRONG - wastes time, wrong pattern
cd worktree/frontend && npm install  # NO!

# RIGHT - use main repo's node_modules (symlink or run from main)
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run

# RIGHT - use Docker if running
docker exec learn-greek-frontend npm test -- --run
```

### 3. CI/CD Gate (BLOCKING)
**You CANNOT output ALL_TASKS_COMPLETE until CI/CD passes.**

After marking PR ready:
```bash
# Wait for CI/CD (takes 15-20 mins typically)
# Check every 3 minutes (180 seconds) - no need to poll more frequently
gh pr checks --watch --interval 180

# Only if ALL checks pass, then output the completion promise
# If checks fail → fix issues, push, wait again
```

---

## Context Loading
- Study @CLAUDE.md for project conventions
- Query Vibe Kanban (project: cb892c2b-4a17-4402-83f2-8f6cb086468b) for current tasks
- Check Context7 before using any library APIs

## Documentation (docs/)
Reference these before making changes to related areas:
- `docs/deployment-guide.md` - Sequential deploy, rollback, troubleshooting
- `docs/e2e-seeding.md` - Test data seeding infrastructure
- `docs/ci-cd-labels.md` - PR labels for test control
- `docs/docker-reference.md` - Container names, ports, commands
- `docs/railway-backend-privacy.md` - Production setup
- `docs/pr-preview-deployments.md` - Preview environments
- `learn-greek-easy-backend/docs/logging.md` - Logging architecture

## Available MCP Servers
| Server | Purpose | Usage |
|--------|---------|-------|
| **Vibe Kanban** | Task tracking | `mcp__vibe_kanban__*` - Project ID: `cb892c2b-4a17-4402-83f2-8f6cb086468b` |
| **Context7** | Library docs | `mcp__context7__*` - ALWAYS check before writing library code |
| **Playwright** | Visual verification, E2E, bug research | `mcp__playwright__*` - Use for QA verification |
| **Sentry** | Error tracking, issue investigation | `mcp__sentry__*` - Check for production errors related to changes |
| **Railway** | Deployment status (read-only) | `mcp__railway-mcp-server__*` - NO destructive actions |

## Task Selection
Get ALL tasks marked `inprogress` from Vibe Kanban. These are the scope for this PR.
Work through them ONE at a time, but all go into the SAME branch/PR.

---

## Workflow Stages (per task, in order)

### Stage 1: Architecture (MANDATORY)
```
Task(
  subagent_type="product-architecture-spec",
  prompt="Architect implementation for task: [TASK TITLE]\n\nTask description: [DESCRIPTION]\n\nWrite a detailed implementation plan covering:\n- Files to modify\n- Changes needed in each file\n- Dependencies/imports required\n- Testing approach"
)
```
- Plan goes INTO the Vibe Kanban task description (update via MCP)
- **Checkpoint:** Output `<promise>ARCHITECTURE_DONE</promise>`
- **If skipped:** Loop will NOT progress correctly

### Stage 2: Explore Verification (MANDATORY)
```
Task(
  subagent_type="Explore",
  prompt="Verify the implementation plan for [TASK]. Check that ALL files mentioned exist and the plan covers all necessary changes. Search for: [key patterns from plan]. Report any gaps or missing files."
)
```
- If gaps found: append additions to the plan in Vibe Kanban
- **Checkpoint:** Output `<promise>EXPLORE_DONE</promise>`

### Stage 3: QA Plan Review (MANDATORY)
```
Task(
  subagent_type="product-qa-spec",
  prompt="Review the implementation plan for [TASK]. Verify:\n- All acceptance criteria are covered\n- No missing edge cases\n- Testing strategy is adequate\n\nPlan: [PLAN FROM KANBAN]"
)
```
- If additions needed: append to plan
- **Checkpoint:** Output `<promise>PLAN_APPROVED</promise>`

### Stage 4: Execution (MANDATORY)
```
Task(
  subagent_type="product-executor",
  prompt="Implement [TASK] following this plan:\n\n[PLAN]\n\nWorking directory: [WORKTREE_PATH]\nBranch: [BRANCH_NAME]\n\nAfter implementation, run tests from MAIN repo (not worktree):\ncd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run"
)
```
- Agent handles all file edits
- Agent commits changes
- **Checkpoint:** Output `<promise>EXECUTION_DONE</promise>`

### Stage 5: QA Verification (MANDATORY)
```
Task(
  subagent_type="product-qa-spec",
  prompt="Verify implementation of [TASK] using Playwright MCP.\n\nAcceptance criteria:\n[CRITERIA]\n\nUse browser_navigate, browser_snapshot, browser_click to verify the UI changes work correctly."
)
```
- If issues found: spawn executor agent to fix, then re-verify
- **Checkpoint:** Output `<promise>QA_VERIFIED</promise>`

### Stage 6: Move to Next Task
- Current task stays `inprogress` until PR merges
- Pick next `inprogress` task from the list
- Repeat stages 1-5
- **Checkpoint:** Output `<promise>TASK_DONE</promise>`

---

## PR Rules (ONE branch, ONE PR for ALL tasks)

### First task in batch:
```bash
# Create worktree + branch (named after feature, not individual task)
MAIN_REPO=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$MAIN_REPO")
git worktree add "../${REPO_NAME}-[feature]" -b feature/[name] main
cd "../${REPO_NAME}-[feature]"

# After first task implemented:
git push -u origin feature/[name]
gh pr create --draft --title "[FEATURE] Name" --body "..." --label "skip-visual"
```

### Middle tasks:
- Work in SAME worktree
- Commit to SAME branch
- Push to SAME PR (stays draft)

### Final task:
```bash
# Remove label while draft (no CI trigger), then mark ready (triggers CI once)
gh pr edit --remove-label "skip-visual" && gh pr ready
```

---

## Completion Rules

1. **Local tests green ≠ merge ready** - CI/CD must pass (~20 mins)
2. **Never mark tasks as `done`** - only QA can do that after CI/CD green + merge
3. **All tasks stay `inprogress`** until PR merges
4. **Update all tasks to `inreview`** when PR is marked ready

## Back Pressure (local validation)

**Run from MAIN repo, not worktree:**
```bash
# Backend (from main repo)
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest -x

# Frontend (from main repo - has node_modules)
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run && npm run build
```

**For worktree changes to be tested:**
```bash
# Option 1: Copy changed files to main repo temporarily for testing
# Option 2: Run lint/typecheck in worktree (no npm install needed if using npx)
cd /path/to/worktree/frontend && npx tsc --noEmit
```

---

## Loop Completion Signal

Output `<promise>ALL_TASKS_COMPLETE</promise>` ONLY when ALL conditions are TRUE:

1. All `inprogress` tasks have been implemented
2. All stage checkpoints were output (ARCHITECTURE_DONE, EXPLORE_DONE, etc.)
3. All local tests pass
4. PR is created and marked ready
5. Tasks moved to `inreview`
6. **CI/CD checks have passed** (verify with `gh pr checks`)

```bash
# MUST run this before outputting ALL_TASKS_COMPLETE
# CI/CD takes 15-20 mins - check every 3 minutes
gh pr checks --watch --interval 180
# Wait for all checks to pass
# If any fail, fix and re-run - do NOT output the promise
```

Human decides merge after reviewing the PR.

---

## Anti-Patterns (DO NOT DO)

| Anti-Pattern | Why It's Wrong | Correct Approach |
|--------------|----------------|------------------|
| Reading files directly in main context | Bloats context, wastes tokens | Use Explore agent |
| Editing files directly in main context | Bloats context, error-prone | Use Executor agent |
| `npm install` in worktree | Slow, unnecessary, wrong pattern | Use main repo's node_modules |
| Outputting ALL_TASKS_COMPLETE before CI | CI might fail, false completion | Wait for `gh pr checks` |
| Skipping stage checkpoints | Loop can't track progress | Output every checkpoint |
| Multiple Grep/Glob calls for research | Bloats context | Single Explore agent call |
