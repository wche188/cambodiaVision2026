#!/bin/bash
# scripts/upload.sh — Stage, commit, and push Cambodia Vision changes to GitHub.
#
# Usage:
#   ./scripts/upload.sh                          # auto-generated message
#   ./scripts/upload.sh "fix: patient form bug"  # custom message
#   ./scripts/upload.sh --dry-run                # show what would happen
#
# Excludes (must never be committed):
#   .env.local          — production secrets
#   .env.*.local        — environment overrides
#   node_modules/       — dependencies
#   .next/              — build output
#   *.log, .DS_Store    — machine noise
#   tmp/, .tmp/         — temp files

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

BRANCH=$(git branch --show-current)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MSG="${1:-chore: update ${TIMESTAMP}}"

echo "▶ upload.sh"
echo "  branch:   $BRANCH"
echo "  message:  $MSG"
echo "  dry-run:  $DRY_RUN"
echo ""

# Refuse to run if not in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "ERROR: not a git repository"
  exit 1
fi

# Refuse if .env.local is in the working tree (should be gitignored but guard anyway)
if [[ -f .env.local ]]; then
  echo "WARN: .env.local exists in working tree. Will NOT be committed (gitignored)."
  echo "      If you see it staged below, run:  git restore --staged .env.local"
fi

# Show current status
echo "── Files changed ──"
git status --short || true
echo ""

# Stage everything (.env.local is gitignored so won't be picked up)
git add -A

# Show staged diff summary
STAGED=$(git diff --cached --stat)
if [[ -z "$STAGED" ]]; then
  echo "✓ Nothing to commit. Working tree clean."
  exit 0
fi

echo "── Staged for commit ──"
echo "$STAGED"
echo ""

if $DRY_RUN; then
  echo "── Dry run: would commit and push to origin/$BRANCH ──"
  echo "Run without --dry-run to proceed."
  exit 0
fi

# Commit
git commit -m "$MSG" -m "Co-Authored-By: Claude <noreply@anthropic.com>"

# Push
echo ""
echo "── Pushing to origin/$BRANCH ──"
if ! git push -u origin "$BRANCH" 2>&1; then
  echo ""
  echo "ERROR: push failed. Common causes:"
  echo "  1. Direct push to 'main' is blocked — create a feature branch first:"
  echo "       git checkout -b my-changes && git push -u origin my-changes"
  echo "  2. Remote has new commits — pull first:"
  echo "       git pull --rebase origin $BRANCH"
  exit 1
fi

echo ""
echo "✓ Pushed to origin/$BRANCH"
echo "  View: https://github.com/wche188/cambodiaVision2026/commits/$BRANCH"
