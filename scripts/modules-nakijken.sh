#!/usr/bin/env bash
# Haalt elk frontend-bestand op bij de server en parseert het als ES-module.
#
# Waarom dit los staat: een HTTP 200 zegt niets. De server serveert een kapot
# `app.js` net zo braaf als een heel bestand — het is de **browser** die erop
# stukloopt, en dan valt de hele module-graaf stil zónder foutmelding.
# `node --check` helpt ook niet: dat parseert als CommonJS-script en ziet een
# backtick in een HTML-commentaar binnen een template literal niet.
#
#   scripts/modules-nakijken.sh [basis-url]
set -uo pipefail
BASIS="${1:-https://grisburgh.nl}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
LIJST=$(cd "$(dirname "${BASH_SOURCE[0]}")/../public/js" && ls *.js)
STUK=0
for f in $LIJST; do
  if ! curl -fsS "$BASIS/js/$f" -o "$TMP/$f"; then
    printf '  \033[31m✗\033[0m %s is niet op te halen\n' "$f"; STUK=1; continue
  fi
  # Als .mjs wegschrijven en door node laten parseren: dat is dezelfde
  # strengheid als de browser hanteert.
  mv "$TMP/$f" "$TMP/${f%.js}.mjs"
  FOUT=$(node --input-type=module -e "import('file://$TMP/${f%.js}.mjs').catch(e=>{console.log(e.message);process.exit(0)})" 2>&1 \
         | grep -iE 'unexpected|missing|invalid|cannot use|unterminated' | head -1 || true)
  if [ -n "$FOUT" ]; then printf '  \033[31m✗\033[0m %s: %s\n' "$f" "$FOUT"; STUK=1; fi
done
[ "$STUK" = 0 ] || exit 1
exit 0
