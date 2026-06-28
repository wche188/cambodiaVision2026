#!/bin/bash
# scripts/deploy.sh — Pull latest code, install deps, rebuild, restart PM2.
# Run this on the production server after a successful upload.sh push.
#
# Usage:
#   ./scripts/deploy.sh                              # pull + rebuild + restart from main
#   ./scripts/deploy.sh --branch security-hardening-deploy
#   ./scripts/deploy.sh --skip-build                 # pull + restart only (use when code didn't change)
#   ./scripts/deploy.sh --skip-pull                  # restart only (e.g. after env change)
#   ./scripts/deploy.sh --dry-run                    # show what would happen

set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="main"
SKIP_BUILD=false
SKIP_PULL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      grep "^# " "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "▶ deploy.sh"
echo "  branch:      $BRANCH"
echo "  skip-build:  $SKIP_BUILD"
echo "  skip-pull:   $SKIP_PULL"
echo "  dry-run:     $DRY_RUN"
echo ""

# Pre-flight checks
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not installed"; exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 not installed. Run: npm install -g pm2"; exit 1
fi
if [[ ! -f .env.production ]]; then
  echo "ERROR: .env.production missing. Create it with MYSQL_* and SESSION_SECRET before deploying."
  exit 1
fi
if [[ ! -d .git ]]; then
  echo "ERROR: not a git repository. Run 'git clone' first or initialize."
  exit 1
fi

if ! $SKIP_PULL; then
  echo "── Pulling origin/$BRANCH ──"
  if $DRY_RUN; then
    echo "  (dry run: would run: git fetch origin && git checkout $BRANCH && git pull)"
  else
    git fetch origin
    git checkout "$BRANCH"
    git pull --rebase --autostash origin "$BRANCH"
  fi
fi

if ! $SKIP_BUILD; then
  echo ""
  echo "── npm install ──"
  if $DRY_RUN; then
    echo "  (dry run: would run: npm install)"
  else
    npm install
  fi

  echo ""
  echo "── npm run build ──"
  if $DRY_RUN; then
    echo "  (dry run: would run: npm run build)"
  else
    npm run build
  fi
fi

echo ""
echo "── Restarting PM2 ──"
if $DRY_RUN; then
  echo "  (dry run: would run: pm2 reload cambodia-vision || pm2 start ecosystem.config.cjs)"
else
  if pm2 describe cambodia-vision >/dev/null 2>&1; then
    pm2 reload cambodia-vision
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
fi

echo ""
echo "── Health check ──"
sleep 2
if $DRY_RUN; then
  echo "  (dry run: would curl https://localhost:3000/)"
else
  HTTP=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:3000/login || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    echo "  ✓ /login returned HTTP 200"
  else
    echo "  ✗ /login returned HTTP $HTTP — check: pm2 logs cambodia-vision"
    exit 1
  fi
fi

echo ""
echo "✓ Deploy complete on branch '$BRANCH'."
echo "  Logs: pm2 logs cambodia-vision --lines 50"
