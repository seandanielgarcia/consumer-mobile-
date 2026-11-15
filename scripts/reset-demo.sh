#!/usr/bin/env bash
# Resets the shared dev deployment between demo runs: seed garages back to all-live with their orders removed,
# and throwaway sign-in users (+1555999…, +15550199…) deleted with their garages, items and orders.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CONVEX_DEPLOY_KEY:?set CONVEX_DEPLOY_KEY}"
npx convex run seed:resetDemo
