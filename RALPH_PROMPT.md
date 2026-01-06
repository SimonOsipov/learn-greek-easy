# Ralph Loop Prompt - Learn Greek Easy

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

## Workflow Stages (per task, in order)

### Stage 1: Architecture
- Use Task(subagent_type=product-architecture-spec) to write implementation plan
- Plan goes INTO the Vibe Kanban task description
- Output <promise>ARCHITECTURE_DONE</promise>

### Stage 2: Explore Verification
- Use Task(subagent_type=Explore) to verify plan mentions ALL files to edit
- If gaps found: append additions to the plan
- Output <promise>EXPLORE_DONE</promise>

### Stage 3: QA Plan Review
- Use Task(subagent_type=product-qa-spec) to double-check the plan
- If additions needed: append to plan
- Output <promise>PLAN_APPROVED</promise>

### Stage 4: Execution
- Use Task(subagent_type=product-executor) to implement
- Run local tests as back pressure
- Commit changes (all commits go to same branch)
- Output <promise>EXECUTION_DONE</promise>

### Stage 5: QA Verification
- Use Task(subagent_type=product-qa-spec) with Playwright MCP
- If issues found: loop back to executor
- Output <promise>QA_VERIFIED</promise>

### Stage 6: Move to Next Task
- Current task stays `inprogress` until PR merges
- Pick next `inprogress` task from the list
- Repeat stages 1-5
- Output <promise>TASK_DONE</promise>

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

## Completion Rules

1. **Local tests green ≠ merge ready** - CI/CD must pass (~20 mins)
2. **Never mark tasks as `done`** - only after CI/CD green + merge
3. **All tasks stay `inprogress`** until PR merges
4. **Update all tasks to `inreview`** when PR is marked ready

## Back Pressure (local validation)
```bash
# Backend
cd learn-greek-easy-backend && /Users/samosipov/.local/bin/poetry run pytest -x

# Frontend
cd learn-greek-easy-frontend && npm test -- --run && npm run build
```

## Loop Completion Signal
Output <promise>ALL_TASKS_COMPLETE</promise> when:
- All `inprogress` tasks have been implemented
- All local tests pass
- PR is created and marked ready
- Tasks moved to `inreview`

Human decides merge after CI/CD passes.
