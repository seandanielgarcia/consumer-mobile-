#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CONVEX_DEPLOY_KEY:?set CONVEX_DEPLOY_KEY}"
files=$(npx -y tsx -e 'import { STOCK } from "./src/lib/stock"; console.log(STOCK.filter((s) => s.use === "seed").map((s) => s.file).join("\n"))')
photos="{"
for file in $files; do
  key=$(basename "$file" .jpg)
  url=$(npx convex run items:generateUploadUrl | tr -d '"[:space:]')
  id=$(curl -sf -X POST -H "Content-Type: image/jpeg" --data-binary "@assets/stock/$file" "$url" | sed -E 's/.*"storageId":"([^"]+)".*/\1/')
  photos+="\"$key\":\"$id\","
done
photos="${photos%,}}"
npx convex run seed:run "{\"photos\":$photos}"
