#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CONVEX_DEPLOY_KEY:?set CONVEX_DEPLOY_KEY}"
files=$(npx -y tsx -e 'import { STOCK } from "./src/lib/stock"; console.log(STOCK.filter((s) => s.use === "seed").map((s) => s.file).join("\n"))')
photos="{"
for file in $files; do
  key=$(basename "$file" .jpg)
  id=$(npx convex run seed:storePhoto "{\"base64\":\"$(base64 -w0 "assets/stock/$file")\"}" | tr -d '"[:space:]')
  photos+="\"$key\":\"$id\","
done
photos="${photos%,}}"
npx convex run seed:run "{\"photos\":$photos}"
