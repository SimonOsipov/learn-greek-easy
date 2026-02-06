# Ralph Teams Workflow - Learn Greek Easy

## Overview

Team-based parallel execution of Vibe Kanban `inprogress` tasks. Same quality gates as Ralph (Architecture → Explore → QA Plan → Execution → QA Verify), but independent task chains run in parallel via Claude agent teams.

## CRITICAL RULES (same as Ralph)

### 1. MANDATORY Agent Delegation
**All file operations happen through spawned agents. No direct reads/edits in team lead context.**

### 2. NO Assumptions, NO Feature Cuts
Never guess, assume, or reduce functionality. If unclear, ask the user.

### 3. Deploy + Smoke Gate (BLOCKING)
Cannot output `ALL_TASKS_COMPLETE` until deploy + smoke tests pass.

### 4. ONE Branch, ONE PR
All tasks share a single feature branch and PR. Git operations must be serialized.

---

## Team Structure

The number of chains is **dynamic** — determined by the dependency graph in Phase 0. Each independent group of tasks becomes its own chain.

```
Team Lead (you)
├── Orchestrates workflow, manages git/PR, assigns tasks
├── Calls MCP tools directly (Vibe Kanban, git, gh)
│
├── chain-1 (general-purpose agent)
│   └── Executes tasks in Chain 1 sequentially through all 5 stages
│
├── chain-2 (general-purpose agent)
│   └── Executes tasks in Chain 2 sequentially through all 5 stages
│
├── ...additional chains as needed...
│
└── chain-N (general-purpose agent)
    └── Executes tasks in Chain N sequentially through all 5 stages
```

**Chain count rules:**
- Analyze the dependency graph — each independent subgraph = one chain
- A single task with no dependencies to other tasks = its own chain
- Tasks that depend on each other = same chain, ordered by dependency
- If ALL tasks are interdependent, there is 1 chain (effectively sequential Ralph with team infrastructure)
- No artificial cap — let the dependency graph dictate the structure

---

## Workflow

### Phase 0: Context Loading & Planning

1. Check `.claude/handoff.yaml` for session continuity
2. Query Vibe Kanban for all `inprogress` tasks (project: `9cad311d-e4b4-4861-bf89-4fe6bad3ce8b`)
3. Read each task description to understand dependencies
4. **Build dependency graph** — identify which tasks depend on each other and which are independent
5. **Determine chain count** — each independent subgraph becomes its own chain (could be 1, 2, 3, or more)
6. **Log chain plan** — output the chain assignments so the user can see the parallelization strategy
7. Create feature branch from main

```bash
git checkout -b feature/[name] main
```

### Phase 1: Team Setup

1. Create team with `TeamCreate`
2. Create internal task list with `TaskCreate` — one task per Vibe Kanban ticket
3. Set up `blockedBy` dependencies using `TaskUpdate`
4. **Spawn one teammate per chain** — iterate over the chains from the dependency graph and spawn each in parallel

**Teammate spawn template (repeat for each chain):**
```
Task(
  subagent_type="general-purpose",
  team_name="[team-name]",
  name="chain-[N]",
  mode="bypassPermissions",
  prompt="You are a chain executor in a Ralph Teams workflow.

PROJECT DIRECTORY: /home/dev/learn-greek-easy
PROJECT ID (Vibe Kanban): 9cad311d-e4b4-4861-bf89-4fe6bad3ce8b

Your assigned task chain (execute IN ORDER):
[List of task IDs, titles, and Vibe Kanban task IDs]

For EACH task in your chain, execute these 5 stages in order.
CRITICAL: You MUST use the specified subagent for each stage. Do NOT implement code directly.

## Subagent Mapping (MANDATORY)
| Stage | Subagent Type | Usage |
|-------|--------------|-------|
| Architecture | product-architecture-spec | Always — review/enhance the architecture spec |
| Explore | Explore | Always — verify files, patterns, and placement |
| QA Plan | product-qa-spec | Always — review plan against acceptance criteria |
| Execution | product-executor | Always — implement all code changes |
| QA Verify | product-qa-spec | Always — verify implementation correctness |

## Stage 1: Architecture
- Spawn a `product-architecture-spec` subagent via Task tool
- Pass it the Vibe Kanban task description and ask it to review/enhance the architecture
- If the task already has a detailed spec, the architect validates it and identifies file paths
- If the spec is thin, the architect enhances it with implementation details and dependencies
- Send team lead: 'ARCHITECTURE_DONE for [TASK-ID]'

## Stage 2: Explore Verification
- Spawn an `Explore` subagent via Task tool
- Pass it the architecture plan and ask it to verify all files mentioned exist
- Verify patterns, imports, and placement locations
- If gaps found, note them for execution
- Send team lead: 'EXPLORE_DONE for [TASK-ID]'

## Stage 3: QA Plan Review
- Spawn a `product-qa-spec` subagent via Task tool
- Pass it the implementation plan and acceptance criteria
- The QA agent checks for missing edge cases, untested scenarios, and coverage gaps
- If additions needed, append to the plan
- Send team lead: 'PLAN_APPROVED for [TASK-ID]'

## Stage 4: Execution
- Spawn a `product-executor` subagent via Task tool
- Pass it the full implementation plan, file paths, and acceptance criteria
- The executor agent handles ALL file reads, edits, and creation
- After the executor finishes, run tests yourself to verify:
  Backend: cd /home/dev/learn-greek-easy/learn-greek-easy-backend && poetry run pytest -x
  Frontend: cd /home/dev/learn-greek-easy/learn-greek-easy-frontend && npm test -- --run
- Stage and commit changes with descriptive message
- Send team lead: 'EXECUTION_DONE for [TASK-ID]'

## Stage 5: QA Verification
- Spawn a `product-qa-spec` subagent via Task tool
- Pass it the acceptance criteria and list of files changed
- For backend-only tasks: QA agent verifies tests pass, checks model/schema correctness
- For frontend tasks: QA agent uses Playwright MCP to visually verify
- If issues found: spawn a `product-executor` to fix, then re-spawn QA to re-verify
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

### Phase 3: PR & Deploy

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

4. **Update Vibe Kanban** — move all tasks to `inreview`

5. **Wait for deploy + smoke:**
```bash
gh pr checks  # Required: deploy + smoke-tests pass
```

6. **Shutdown teammates** via `SendMessage` with `type: "shutdown_request"`

7. **Cleanup:**
```bash
rm -f .claude/handoff.yaml
```

8. Output `<promise>ALL_TASKS_COMPLETE</promise>`

---

## Handoff Updates

Team lead updates `.claude/handoff.yaml` every 2-3 completed tasks:

```yaml
timestamp: [current time]
workflow: "ralph-teams"
team_name: "[team-name]"
branch: "feature/[name]"
pr_number: null  # or PR number once created
total_chains: 3  # actual count from dependency graph
chains:
  chain-1:
    tasks: ["FEAT-01", "FEAT-02", "FEAT-05"]
    completed: ["FEAT-01"]
    current: "FEAT-02"
    stage: "execution"
  chain-2:
    tasks: ["FEAT-03", "FEAT-06"]
    completed: []
    current: "FEAT-03"
    stage: "explore"
  chain-3:
    tasks: ["FEAT-04"]
    completed: []
    current: "FEAT-04"
    stage: "architecture"
  # ...add chain-N entries as needed
blockers: []
decisions: []
```

---

## When to Use Teams vs Sequential Ralph

| Scenario | Use |
|----------|-----|
| 1-2 tasks, all dependent | `/ralph` (sequential) |
| 2+ tasks with at least 2 independent groups | `/ralph-teams` (parallel) |
| All tasks touch same files / form one dependency chain | `/ralph` (sequential) |
| Tasks split across frontend/backend | `/ralph-teams` (parallel) |
| Many independent tasks (e.g. 6 tasks, 4 independent groups) | `/ralph-teams` with 4 chains |

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|------------------|
| Team lead doing file edits directly | Delegate to chain agents |
| Chain agent implementing code directly | Spawn `product-executor` subagent for all implementation |
| Chain agent reviewing plan without QA agent | Spawn `product-qa-spec` subagent for plan review and verification |
| Chain agent skipping architecture subagent | Spawn `product-architecture-spec` subagent to review/enhance spec |
| Spawning one agent per task | One agent per CHAIN (sequential within chain) |
| Hardcoding 2 chains regardless of task graph | Let dependency graph determine chain count |
| Not coordinating git between chains | Team lead manages push/merge order |
| Skipping stages for speed | Every stage is mandatory |
| Marking tasks `done` | Only QA can mark `done` after merge |
| Not updating handoff during long runs | Update every 2-3 tasks |
