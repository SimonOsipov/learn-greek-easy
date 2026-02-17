# Ralph Workflow - Learn Greek Easy

## Overview

Automated execution of Backlog `To Do` tasks through 4 mandatory quality gates (Architecture → Explore → Execution → QA Verify). Analyzes task dependencies to determine execution mode: **parallel** (multiple independent chains via agent teams) or **sequential** (single chain, team lead executes directly).

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

### 3. Deploy + Smoke Gate (BLOCKING)
Cannot output `ALL_TASKS_COMPLETE` until deploy + smoke tests pass.

```bash
gh pr checks  # Required: deploy + smoke-tests pass
```

### 4. ONE Branch, ONE PR
All tasks share a single feature branch and PR. Git operations must be serialized.

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

### Phase 0: Context Loading & Planning

1. Check `.claude/handoff.yaml` for session continuity
2. Study @CLAUDE.md for project conventions
3. Query Backlog for all `To Do` tasks using `mcp__backlog__task_list` (use status="To Do")
4. Read each task's FULL details using `mcp__backlog__task_view` to understand:
   - Description (context)
   - Acceptance Criteria (what needs to be done)
   - Implementation Plan (how to do it)
   - References (file paths, docs)
   - Dependencies (blocking tasks)
   - Implementation Notes (any additional context)
5. **Build dependency graph** — identify which tasks depend on each other and which are independent
6. **Determine chain count** — each independent subgraph becomes its own chain
7. **Decide execution mode:**
   - **1 chain** → **Sequential mode** — team lead executes the chain directly (no TeamCreate, no teammates)
   - **2+ independent chains** → **Parallel mode** — spawn teammates via agent teams
8. **Log plan** — output the chain assignments and execution mode so the user can see the strategy
9. Create feature branch from main

```bash
git checkout -b feature/[name] main
```

10. **Move tasks to "In Progress"** — update all tasks that will be worked on:
```
For each task ID in the execution plan:
  mcp__backlog__task_edit(id=task_id, status="In Progress")
```

**Chain count rules:**
- Each independent subgraph in the dependency graph = one chain
- A single task with no dependencies to other tasks = its own chain
- Tasks that depend on each other = same chain, ordered by dependency
- No artificial cap — let the dependency graph dictate the structure

---

## Sequential Mode (1 chain)

When all tasks form a single dependency chain, execute directly without spawning teammates.

### Execution Flow

For EACH task in order, execute these 4 stages. Delegate to subagents — never implement code directly.

#### Subagent Mapping (MANDATORY)
| Stage | Subagent Type | Usage |
|-------|--------------|-------|
| Architecture | product-architecture-spec | Always — review/enhance the architecture spec (includes plan self-validation) |
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
| Explore | No file needed — use Glob/Grep/Read to verify files and patterns directly |

#### Stage 1: Architecture
- Spawn a `product-architecture-spec` subagent via Task tool
- Pass it the FULL task details from Backlog (description, acceptance criteria, implementation plan, references)
- If the task already has a detailed implementation plan, the architect validates it and identifies file paths
- If the implementation plan is thin, the architect enhances it with:
  - Data models and schemas
  - API contracts
  - File paths and locations
  - Edge cases and error handling
- The architect self-validates the plan (acceptance criteria coverage, edge cases, test strategy)
- **Update the task** in Backlog using `mcp__backlog__task_edit` to populate/enhance the implementation_plan field
- **DO NOT create subtasks** — all architecture details go in the task's implementation_plan field
- **Checkpoint:** `ARCHITECTURE_DONE`

#### Stage 2: Explore Verification
- Spawn an `Explore` subagent via Task tool
- Pass it the implementation plan from the task and verify:
  - All files mentioned exist
  - Patterns, imports, and placement locations are correct
  - Referenced files in the references field are accessible
- If gaps found, update the task's implementation_notes field with findings
- **Checkpoint:** `EXPLORE_DONE`

#### Stage 3: Execution
- Spawn a `product-executor` subagent via Task tool
- Pass it the COMPLETE task details:
  - Acceptance criteria (what to implement)
  - Implementation plan (how to implement)
  - References (file paths and docs)
  - Implementation notes (any explore findings)
- The executor handles ALL file reads, edits, and creation
- After executor finishes, run tests to verify:
  ```bash
  # Backend
  cd /home/dev/learn-greek-easy/learn-greek-easy-backend && poetry run pytest -x
  # Frontend
  cd /home/dev/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run
  ```
- Stage and commit changes with descriptive message
- **Checkpoint:** `EXECUTION_DONE`

#### Stage 4: QA Verification
- Spawn a `product-qa-spec` subagent via Task tool
- Pass it:
  - Acceptance criteria (what was supposed to be done)
  - Implementation plan (what the architecture specified)
  - List of files changed
  - Definition of Done items (if any in the task)
- For backend-only tasks: verify tests pass, check model/schema correctness
- For frontend tasks: use Playwright MCP to visually verify
- If issues found: spawn executor to fix, then re-verify
- Update task's implementation_notes with QA findings
- **Checkpoint:** `QA_VERIFIED`

After each task, pick the next one and repeat stages 1-4.

### PR & Deploy (Sequential)

After all tasks complete:

1. Push and create draft PR:
```bash
git push -u origin feature/[name]
gh pr create --draft --title "[FEATURE] Name" --body "..." --label "skip-visual"
```

2. Mark PR ready:
```bash
gh pr edit --remove-label "skip-visual" && gh pr ready
```

3. Wait for deploy + smoke:
```bash
gh pr checks  # Required: deploy + smoke-tests pass
```

4. **Move all tasks to "Done"** — after deploy + smoke tests pass:
```
For each task ID:
  mcp__backlog__task_edit(id=task_id, status="Done")
```

5. Cleanup and complete:
```bash
rm -f .claude/handoff.yaml
```

7. Output `<promise>ALL_TASKS_COMPLETE</promise>`

---

## Parallel Mode (2+ chains)

When tasks have independent subgraphs, spawn teammate agents for parallel execution.

### Team Structure

```
Team Lead (you)
├── Orchestrates workflow, manages git/PR, assigns tasks
├── Calls MCP tools directly (Backlog, git, gh)
│
├── chain-1 (general-purpose agent)
│   └── Executes tasks in Chain 1 sequentially through all 4 stages
│
├── chain-2 (general-purpose agent)
│   └── Executes tasks in Chain 2 sequentially through all 4 stages
│
└── chain-N (general-purpose agent)
    └── Executes tasks in Chain N sequentially through all 4 stages
```

### Phase 1: Team Setup

1. Create team with `TeamCreate`
2. Create internal task list with `TaskCreate` — one task per Backlog task
3. Set up `blockedBy` dependencies using `TaskUpdate`
4. **Spawn one teammate per chain** — iterate over chains and spawn each in parallel

**Teammate spawn template (repeat for each chain):**
```
Task(
  subagent_type="general-purpose",
  team_name="[team-name]",
  name="chain-[N]",
  mode="bypassPermissions",
  prompt="You are a chain executor in a Ralph workflow.

PROJECT DIRECTORY: /home/dev/learn-greek-easy
Your assigned task chain (execute IN ORDER):
[List of task IDs, titles, and Backlog task IDs]

For EACH task in your chain, execute these 4 stages in order.
CRITICAL: You MUST use the specified subagent for each stage. Do NOT implement code directly.

## Subagent Mapping (MANDATORY)
| Stage | Subagent Type | Usage |
|-------|--------------|-------|
| Architecture | product-architecture-spec | Always — review/enhance the architecture spec (includes plan self-validation) |
| Explore | Explore | Always — verify files, patterns, and placement |
| Execution | product-executor | Always — implement all code changes |
| QA Verify | product-qa-spec | Always — verify implementation correctness |

## Fallback: If Subagent Spawning Fails
If you cannot spawn a subagent (e.g., agent teams unavailable, tool errors), read the corresponding agent technical prompt file BEFORE executing the stage yourself. These files contain the full methodology and instructions for each role:

| Stage | Read this file first |
|-------|---------------------|
| Architecture | `~/.claude/agents/product-architecture-spec.md` |
| QA Verify | `~/.claude/agents/product-qa-spec.md` |
| Execution | `~/.claude/agents/product-executor.md` |
| Explore | No file needed — use Glob/Grep/Read to verify files and patterns directly |

Read the file, internalize the instructions, then execute the stage following that agent's methodology.

## Stage 1: Architecture
- Read the FULL task details from Backlog using `mcp__backlog__task_view`
- Spawn a `product-architecture-spec` subagent via Task tool
- Pass it all task fields: description, acceptance criteria, implementation plan, references
- If the task already has a detailed implementation plan, the architect validates it and identifies file paths
- If the implementation plan is thin, the architect enhances it with:
  - Data models and schemas
  - API contracts
  - File paths and locations
  - Edge cases and error handling
- Update the task using `mcp__backlog__task_edit` to populate/enhance the implementation_plan field
- The architect self-validates the plan (acceptance criteria coverage, edge cases, test strategy)
- Send team lead: 'ARCHITECTURE_DONE for [TASK-ID]'

## Stage 2: Explore Verification
- Spawn an `Explore` subagent via Task tool
- Pass it the implementation plan and references from the task
- Verify all files mentioned exist
- Verify patterns, imports, and placement locations
- If gaps found, update the task's implementation_notes field using `mcp__backlog__task_edit`
- Send team lead: 'EXPLORE_DONE for [TASK-ID]'

## Stage 3: Execution
- Spawn a `product-executor` subagent via Task tool
- Pass it the COMPLETE task details from Backlog:
  - Acceptance criteria (what to implement)
  - Implementation plan (how to implement)
  - References (file paths and docs)
  - Implementation notes (any explore findings)
- The executor agent handles ALL file reads, edits, and creation
- After the executor finishes, run tests yourself to verify:
  Backend: cd /home/dev/learn-greek-easy/learn-greek-easy-backend && poetry run pytest -x
  Frontend: cd /home/dev/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run
- Stage and commit changes with descriptive message
- Send team lead: 'EXECUTION_DONE for [TASK-ID]'

## Stage 4: QA Verification
- Spawn a `product-qa-spec` subagent via Task tool
- Pass it the complete task context:
  - Acceptance criteria (what was supposed to be done)
  - Implementation plan (what the architecture specified)
  - Definition of Done items (if any)
  - List of files changed
- For backend-only tasks: QA agent verifies tests pass, checks model/schema correctness
- For frontend tasks: QA agent uses Playwright MCP to visually verify
- If issues found: spawn a `product-executor` to fix, then re-spawn QA to re-verify
- Update task's implementation_notes with QA findings using `mcp__backlog__task_edit`
- Send team lead: 'QA_VERIFIED for [TASK-ID]'

After completing ALL tasks in your chain, send team lead: 'CHAIN_COMPLETE'

IMPORTANT RULES:
- ALWAYS delegate to subagents — never implement code directly in your context
- Work through tasks IN ORDER (respect dependencies)
- Commit after each task (atomic commits)
- If blocked by another chain's work, message team lead and wait
- Never skip stages
- Run tests before each commit
"
)
```

### Phase 2: Parallel Execution

Team lead monitors progress:

1. **Receive stage completion messages** from chain agents
2. **Track progress** — update internal task list and handoff.yaml
3. **Handle blockers** — if a chain agent reports being blocked, coordinate
4. **Resolve conflicts** — if two chains modify the same file, coordinate merge order

**Git coordination rule:** If chains touch different files (common case), they can commit independently. If they touch the same files, team lead tells one chain to wait.

### Phase 3: PR & Deploy (Parallel)

After all chains complete:

1. **Push branch and create draft PR:**
```bash
git push -u origin feature/[name]
gh pr create --draft --title "[FEATURE] Name" --body "..." --label "skip-visual"
```

2. **Run full test suite:**
```bash
# Backend
cd /home/dev/learn-greek-easy/learn-greek-easy-backend && poetry run pytest -x
# Frontend (if applicable)
cd /home/dev/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run
```

3. **Mark PR ready:**
```bash
gh pr edit --remove-label "skip-visual" && gh pr ready
```

4. **Wait for deploy + smoke:**
```bash
gh pr checks  # Required: deploy + smoke-tests pass
```

5. **Move all tasks to "Done"** — after deploy + smoke tests pass:
```
For each task ID:
  mcp__backlog__task_edit(id=task_id, status="Done")
```

6. **Shutdown teammates** via `SendMessage` with `type: "shutdown_request"`

7. **Cleanup:**
```bash
rm -f .claude/handoff.yaml
```

9. Output `<promise>ALL_TASKS_COMPLETE</promise>`

---

## Session Continuity

### On Start
```bash
cat .claude/handoff.yaml 2>/dev/null
```
If exists and recent, use it to restore progress.

### During Work (every 2-3 tasks)
Update `.claude/handoff.yaml`:

```yaml
timestamp: [current time]
workflow: "ralph"
mode: "sequential"  # or "parallel"
team_name: "[team-name]"  # parallel mode only
branch: "feature/[name]"
pr_number: null
current_task: "[TASK-ID]"
stage: "execution"  # architecture|explore|execution|qa-verify
completed_tasks:
  - "[TASK-01] First task"
# Parallel mode adds:
total_chains: 3
chains:
  chain-1:
    tasks: ["FEAT-01", "FEAT-02"]
    completed: ["FEAT-01"]
    current: "FEAT-02"
    stage: "execution"
blockers: []
decisions: []
```

### On Compaction
A PreCompact hook auto-saves state. After compaction, READ the handoff to continue.

---

## PR Rules (ONE branch, ONE PR for ALL tasks)

### First task in batch:
```bash
git checkout -b feature/[name] main
# After first task implemented:
git push -u origin feature/[name]
gh pr create --draft --title "[FEATURE] Name" --body "..." --label "skip-visual"
```

### Middle tasks:
- Stay on SAME branch, commit to SAME branch, push to SAME PR (stays draft)

### Final task:
```bash
gh pr edit --remove-label "skip-visual" && gh pr ready
```

### After merge:
```bash
git checkout main && git pull origin main && git branch -d feature/[name]
```

---

## Completion Rules

1. **Local tests green ≠ merge ready** — deploy + smoke tests must pass
2. **Task status transitions:**
   - Start: "To Do" → "In Progress" (when ralph starts working on them)
   - Complete: "In Progress" → "Done" (after deploy + smoke tests pass)
3. Output `<promise>ALL_TASKS_COMPLETE</promise>` ONLY after moving tasks to "Done"

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|------------------|
| Lead doing file edits directly | Delegate to agents (executor subagent or chain agents) |
| Implementing code directly instead of subagent | Spawn `product-executor` subagent for all implementation |
| Skipping architecture/explore/QA stages | Every stage is mandatory |
| Spawning teammates for a single dependency chain | Use sequential mode — execute directly |
| Hardcoding chain count regardless of task graph | Let dependency graph determine chain count and mode |
| Not coordinating git between chains | Team lead manages push/merge order |
| Skipping task status transitions | Move: To Do → In Progress → Done |
| Not updating handoff during long runs | Update every 2-3 tasks |
| Hiding/disabling features to "fix" bugs | Actually fix the bug, add missing data |
| Assuming root cause without verification | Investigate thoroughly, verify with Playwright |
| Outputting ALL_TASKS_COMPLETE before deploy+smoke | Wait for deploy + smoke-tests to pass |
