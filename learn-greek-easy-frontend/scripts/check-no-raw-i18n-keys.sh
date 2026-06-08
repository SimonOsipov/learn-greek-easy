#!/usr/bin/env bash
# scripts/check-no-raw-i18n-keys.sh
#
# I18NG-04: Ensure the news admin test files do not regress to asserting on raw
# i18n keys (the masking-test anti-pattern).
#
# Policy: Tests must assert on the resolved copy string, not on the raw
# dotted-key string returned by a mocked t() function.
#
# A raw i18n key in an assertion looks like:
#   expect(screen.getByText('news.drawer.publishedPill')).toBeInTheDocument();
#   expect(screen.queryByText('news.stats.total')).not.toBeInTheDocument();
#   expect(screen.getByText('situations.status.ready')).toBeInTheDocument();
#
# The resolved copy looks like:
#   expect(screen.getByText('Published')).toBeInTheDocument();
#
# Detection strategy: look for screen query functions whose first argument is a
# string literal containing at least two dots (typical i18n key depth).
# This is a heuristic — it won't catch all cases but will catch the most common
# masking patterns without generating false positives on normal resolved strings.
#
# Scope: Only the 8 news test files cleaned in I18NG-04 are checked.
# Wider coverage is deferred to a follow-up story.
#
# Usage:
#   bash scripts/check-no-raw-i18n-keys.sh        # from learn-greek-easy-frontend/
#   npm run lint:no-raw-i18n-keys

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────

# Pattern: screen query function called with a string that contains at least two
# dots — the signature of a raw i18n key path like 'news.drawer.publishedPill'.
#
# We require the string to start with a lowercase letter (to exclude URLs, UUIDs,
# class names, ISO dates, etc.) and have the form: word.word.word (2+ dots).
# Segments are digit-aware: [a-zA-Z0-9_]+ catches keys like b1Narration, scenarioB2.
#
# Three raw-key forms are detected (AC-4):
#
#   Form 1 — *ByText / toHaveTextContent with a raw string arg:
#     screen.getByText('news.drawer.publishedPill')
#
#   Form 2 — *ByLabelText family with a raw string arg:
#     screen.getByLabelText('news.drawer.title')
#
#   Form 3 — getByRole / *ByRole with a { name: '…' } or { name: /…/ } option:
#     screen.getByRole('button', { name: 'news.drawer.save' })
#     screen.getByRole('button', { name: /news\.drawer\.unlink/i })
#
# Regex breakdown (Form 1 & 2):
#   (getByText|...|getByLabelText|...) — assertion function
#   \(                                 — opening paren
#   ['"]                               — opening quote
#   [a-z][a-zA-Z0-9_]*               — first segment (must start lowercase)
#   (\.[a-zA-Z0-9_]+){2,}             — two or more additional dot-separated segments
#   ['"]                               — closing quote
#
# Regex breakdown (Form 3 — string name):
#   name:[[:space:]]*                  — name: option key (with optional whitespace)
#   ['"][a-z]…                         — same dotted-key shape as Forms 1/2
#
# Regex breakdown (Form 3 — regex /name/ literal):
#   name:[[:space:]]*/[^/]*            — name: followed by /…
#   [a-z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+){2,}
#                                      — dotted key with escaped dots (\.segment)
ASSERTION_PATTERN="(getByText|queryByText|getAllByText|queryAllByText|findByText|findAllByText|toHaveTextContent|getByLabelText|queryByLabelText|getAllByLabelText|queryAllByLabelText|findByLabelText|findAllByLabelText)\\(['\"][a-z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+){2,}['\"]|name:[[:space:]]*['\"][a-z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+){2,}['\"]|name:[[:space:]]*/[^/]*[a-z][a-zA-Z0-9_]*(\\\\.[a-zA-Z0-9_]+){2,}"

# I18NG-04 scope: the 8 news test files that were cleaned of the masking pattern.
# Extend this list as more test files are migrated (I18NG future stories).
SCOPED_FILES=(
  "src/components/admin/news/__tests__/NewsTab.test.tsx"
  "src/components/admin/news/__tests__/NewsGrid.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.body.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.translations.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.image.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.audio.test.tsx"
  "src/components/admin/news/__tests__/NewsEditDrawer.linkedSituation.test.tsx"
)

# ── Scan ───────────────────────────────────────────────────────────────────────

HITS=""
for file in "${SCOPED_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "WARNING: expected scoped file not found: $file" >&2
    continue
  fi
  FILE_HITS=$(grep -En "$ASSERTION_PATTERN" "$file" 2>/dev/null || true)
  if [[ -n "$FILE_HITS" ]]; then
    HITS+="$file:"$'\n'"$FILE_HITS"$'\n'
  fi
done

# ── Report ─────────────────────────────────────────────────────────────────────

if [[ -n "$HITS" ]]; then
  echo ""
  echo "ERROR: Raw i18n keys found in screen-query assertions (masking-test pattern)."
  echo "Replace raw dotted keys with the resolved English copy string."
  echo "See docs/testing-guide.md §I18N Testing Policy for the convention."
  echo ""
  echo "$HITS"
  exit 1
fi

echo "OK: No raw i18n keys found in the ${#SCOPED_FILES[@]} scoped news test files."
exit 0
