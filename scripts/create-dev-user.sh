#!/usr/bin/env bash
# TODO(SEA-3 F): dev-only stand-in for sign-in. Prints the user id to put in .env.local as EXPO_PUBLIC_DEV_USER_ID.
# Needs CONVEX_DEPLOY_KEY (the dev deploy key) in the environment.
set -euo pipefail
PHONE="${1:-+15550000001}"
NAME="${2:-Hailey}"
npx convex run users:getOrCreateByPhone "{\"phone\":\"$PHONE\",\"name\":\"$NAME\"}"
