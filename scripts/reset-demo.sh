#!/usr/bin/env bash
# Resets the shared dev deployment between demo runs: seed yards back to all-live with their orders removed,
# throwaway sign-in users (+1555999…, +15550199…) and the demo accounts (Sam, Maya B) deleted with their yards,
# items and orders. Anything created in the last 15 minutes and smoke-test users (+1555977…) are left alone.
#   scripts/reset-demo.sh          # safe reset
#   scripts/reset-demo.sh --force  # also wipe recent rows and smoke-test users (never during a demo or CX run)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CONVEX_DEPLOY_KEY:?set CONVEX_DEPLOY_KEY}"
if [ "${1:-}" = "--force" ]; then
  npx convex run seed:resetDemo '{"force":true}'
else
  npx convex run seed:resetDemo
fi
