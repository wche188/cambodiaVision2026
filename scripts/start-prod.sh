#!/bin/bash
# Cambodia Vision 2026 — production startup wrapper.
#
# Sources .env.production into the current shell, exports NODE_ENV=production,
# then exec's the Next.js custom HTTPS server. PM2 invokes this script via the
# ecosystem config's `script` field, so secrets never appear on the command
# line of `ps` output.

set -euo pipefail

cd "$(dirname "$0")/.."

# Load production env vars without echoing them.
set -a
# shellcheck disable=SC1091
source .env.production
set +a

export NODE_ENV=production
export PORT="${PORT:-3000}"

exec node server.mjs
