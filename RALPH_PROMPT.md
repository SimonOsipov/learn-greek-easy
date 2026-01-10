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
**Run tests from the project directory.**

```bash
# Backend tests
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest -x

# Frontend tests
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run

# Or use Docker if running
docker exec learn-greek-frontend npm test -- --run
```

### 3. NO Assumptions, NO Feature Cuts (CRITICAL)
**NEVER guess, assume, or take shortcuts that reduce functionality.**

| WRONG | RIGHT |
|-------|-------|
| "Translation files are empty, so hide the selector" | "Translation files are empty, so populate them with translations" |
| "This feature is complex, let's disable it" | "This feature is complex, let's implement it properly" |
| "The bug is hard to fix, let's remove the feature" | "The bug is hard to fix, let's investigate and fix it" |

**Rules:**
- If a ticket says "fix X", fix X - don't remove/hide X
- If data is missing, add the data - don't hide the UI that needs it
- If something is broken, repair it - don't cut the feature
- NEVER reduce user-facing functionality as a "solution"
- When in doubt, ASK the user - don't assume

### 4. CI/CD Gate (BLOCKING)
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
- Query Vibe Kanban (project: 9cad311d-e4b4-4861-bf89-4fe6bad3ce8b) for current tasks
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
| **Vibe Kanban** | Task tracking | `mcp__vibe_kanban__*` - Project ID: `9cad311d-e4b4-4861-bf89-4fe6bad3ce8b` |
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
  prompt="Architect implementation for task: [TASK TITLE]\n\nTask description: [DESCRIPTION]\n\nWrite a detailed implementation plan covering:\n- Files to modify\n- Changes needed in each file
- Dependencies/imports required\n- Testing approach\n\nIMPORTANT: Do NOT create subtasks or new tickets. Return the plan as text output only."
)
```
- **DO NOT create subtasks** - architecture agent returns plan as text only
- After receiving plan, UPDATE the existing task description in Vibe Kanban (append plan)
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
  prompt="Implement [TASK] following this plan:\n\n[PLAN]\n\nBranch: [BRANCH_NAME]\n\nAfter implementation, run tests:\ncd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run"
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
# Create feature branch (named after feature, not individual task)
git checkout -b feature/[name] main

# After first task implemented:
git push -u origin feature/[name]
gh pr create --draft --title "[FEATURE] Name" --body "..." --label "skip-visual"
```

### Middle tasks:
- Stay on SAME branch
- Commit to SAME branch
- Push to SAME PR (stays draft)

### Final task:
```bash
# Remove label while draft (no CI trigger), then mark ready (triggers CI once)
gh pr edit --remove-label "skip-visual" && gh pr ready
```

### After merge - cleanup:
```bash
git checkout main
git pull origin main
git branch -d feature/[name]
```

---

## Completion Rules

1. **Local tests green ≠ merge ready** - CI/CD must pass (~20 mins)
2. **Never mark tasks as `done`** - only QA can do that after CI/CD green + merge
3. **All tasks stay `inprogress`** until PR merges
4. **Update all tasks to `inreview`** when PR is marked ready

## Back Pressure (local validation)

**Run tests before pushing:**
```bash
# Backend
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest -x

# Frontend
cd /Users/samosipov/Downloads/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run && npm run build
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
| Outputting ALL_TASKS_COMPLETE before CI | CI might fail, false completion | Wait for `gh pr checks` |
| Skipping stage checkpoints | Loop can't track progress | Output every checkpoint |
| Multiple Grep/Glob calls for research | Bloats context | Single Explore agent call |
| Architecture agent creating subtasks | Creates clutter in Kanban | Return plan as text, update existing task |
| Hiding/disabling features to "fix" bugs | Reduces functionality, lazy solution | Actually fix the bug, add missing data |
| Assuming root cause without verification | May implement wrong solution | Investigate thoroughly, verify with Playwright |
| Guessing what user wants | Wastes time on wrong implementation | Ask clarifying questions when unclear |
