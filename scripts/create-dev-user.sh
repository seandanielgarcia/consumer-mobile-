#!/usr/bin/env bash
# Creates a fixture user and prints its Convex ID for dev tooling.
# Set CONVEX_DEPLOY_KEY to the dev deployment key before running.
set -euo pipefail

PHONE="${1:-+15550000001}"
NAME="${2:-Hailey}"
ARGS="$(node -e 'process.stdout.write(JSON.stringify({ phone: process.argv[1], name: process.argv[2] }))' "$PHONE" "$NAME")"
npx convex run users:getOrCreateByPhone "$ARGS"
