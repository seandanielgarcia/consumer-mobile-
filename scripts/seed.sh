#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CONVEX_DEPLOY_KEY:?set CONVEX_DEPLOY_KEY}"
photos="{"
for f in scripts/seed-photos/*.jpg; do
  key=$(basename "$f" .jpg)
  id=$(npx convex run seed:storePhoto "{\"base64\":\"$(base64 -w0 "$f")\"}" | tr -d '"[:space:]')
  photos+="\"$key\":\"$id\","
done
photos="${photos%,}}"
npx convex run seed:run "{\"photos\":$photos}"
