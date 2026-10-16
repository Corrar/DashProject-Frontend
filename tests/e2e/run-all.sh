#!/usr/bin/env bash
# Roda a suíte inteira. Precisa do site servido em http://127.0.0.1:8099/:
#   (cd ../.. && python3 -m http.server 8099 --bind 127.0.0.1 &)
set -uo pipefail
cd "$(dirname "$0")"
./setup.sh >/dev/null
E2E="$(pwd)"
for t in flow round4 account pass2 tests resp auth change ai share csp export upload; do
  echo "===== $t"
  timeout 400 node "harness/$t.js" "$E2E" 2>&1 | grep -v "^    '    at\|^    at \|html-to-image.js" | tail -30
done
