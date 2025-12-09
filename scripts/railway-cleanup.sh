#!/bin/bash
# Railway PR Preview Environment Cleanup Script
#
# Usage:
#   ./scripts/railway-cleanup.sh list           - List all preview environments
#   ./scripts/railway-cleanup.sh <PR_NUMBER>    - Delete specific PR environment
#   ./scripts/railway-cleanup.sh orphans        - Delete all orphaned environments
#   ./scripts/railway-cleanup.sh help           - Show this help message
#
# Prerequisites:
#   - Railway CLI installed and authenticated
#   - GitHub CLI installed (for 'orphans' command)
#   - Project linked via 'railway link'

set -e

ACTION=${1:-help}

case $ACTION in
  list)
    echo "=== Listing all preview environments ==="
    # Get all environments and filter to pr-* ones
    ALL_ENVS=$(railway environment list 2>&1 || echo "Error listing environments")
    echo "$ALL_ENVS" | grep -E "pr-[0-9]+" || echo "No preview environments found"
    ;;

  orphans)
    echo "=== Scanning for orphaned preview environments ==="

    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
      echo "Error: GitHub CLI (gh) is required for this command"
      echo "Install it from: https://cli.github.com/"
      exit 1
    fi

    # Get repository from git remote
    REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' || echo "")
    if [ -z "$REPO" ]; then
      echo "Error: Could not determine repository from git remote"
      exit 1
    fi
    echo "Repository: $REPO"
    echo ""

    # Get all preview environments
    ALL_ENVS=$(railway environment list 2>&1 || echo "")
    ENVS=$(echo "$ALL_ENVS" | grep -oE "pr-[0-9]+" || true)

    if [ -z "$ENVS" ]; then
      echo "No preview environments found"
      exit 0
    fi

    echo "Found preview environments:"
    echo "$ENVS"
    echo ""

    # Track results
    CLEANED=0
    KEPT=0
    FAILED=0

    for ENV in $ENVS; do
      PR_NUMBER=${ENV#pr-}
      echo "Checking PR #$PR_NUMBER..."

      # Check PR state using GitHub CLI
      PR_STATE=$(gh pr view $PR_NUMBER --repo "$REPO" --json state --jq '.state' 2>/dev/null || echo "NOT_FOUND")

      if [ "$PR_STATE" != "OPEN" ]; then
        echo "  -> PR is $PR_STATE, deleting: $ENV"
        if railway environment delete "$ENV" --yes 2>&1; then
          echo "  -> Successfully deleted"
          CLEANED=$((CLEANED + 1))
        else
          echo "  -> Failed to delete"
          FAILED=$((FAILED + 1))
        fi
      else
        echo "  -> PR is OPEN, keeping: $ENV"
        KEPT=$((KEPT + 1))
      fi
    done

    echo ""
    echo "=== Summary ==="
    echo "Cleaned: $CLEANED"
    echo "Kept: $KEPT"
    echo "Failed: $FAILED"
    ;;

  help|--help|-h)
    echo "Railway PR Preview Environment Cleanup Script"
    echo ""
    echo "Usage:"
    echo "  $0 list              List all preview environments"
    echo "  $0 <PR_NUMBER>       Delete environment for specific PR"
    echo "  $0 orphans           Delete all environments for closed PRs"
    echo "  $0 help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list              # Show all pr-* environments"
    echo "  $0 42                # Delete pr-42 environment"
    echo "  $0 orphans           # Clean up all closed PR environments"
    echo ""
    echo "Prerequisites:"
    echo "  - Railway CLI installed and authenticated"
    echo "  - GitHub CLI installed (for 'orphans' command)"
    echo "  - Project linked via 'railway link'"
    ;;

  *)
    # Assume it's a PR number
    if [[ "$ACTION" =~ ^[0-9]+$ ]]; then
      PR_NUMBER=$ACTION
      ENV_NAME="pr-${PR_NUMBER}"

      echo "Deleting environment: $ENV_NAME"

      if railway environment delete "$ENV_NAME" --yes 2>&1; then
        echo "Environment $ENV_NAME destroyed successfully!"
      else
        echo "Failed to delete environment $ENV_NAME"
        echo "It may not exist or you may not have permission"
        exit 1
      fi
    else
      echo "Unknown action: $ACTION"
      echo "Run '$0 help' for usage information"
      exit 1
    fi
    ;;
esac
