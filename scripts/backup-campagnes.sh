#!/bin/bash
# Dagelijkse backup van alle campagnedata op de server.
#
# Wat er wél in gaat: alle JSON (de campagne zelf) en de thumbnails. Wat er
# niet in gaat: files/ (2,2 GB originelen — die blijven bewust alleen hier) en
# de per-schrijfactie-backups in campaigns/*/backups/, die zichzelf al
# vernieuwen en de snapshot alleen maar zouden opblazen.
#
# Elke dag is een volledige map, maar ongewijzigde bestanden worden met
# --link-dest aan gisteren gehárdlinkt: dertig snapshots kosten daardoor
# ongeveer één keer 56 MB plus de dagelijkse verschillen, niet dertig keer.
# Een oude dag weggooien blijft veilig — pas als de laatste link weg is,
# verdwijnt het bestand echt.
set -euo pipefail

BRON="/var/www/grisburgh/data/campaigns"
DOEL="/var/backups/grisburgh"
BEWAAR_DAGEN=30
VANDAAG="$(date +%F)"
LOG="/var/log/grisburgh-backup.log"

zeg() { echo "$(date '+%F %T')  $*" >> "$LOG"; }

mkdir -p "$DOEL"
VORIGE="$(ls -1d "$DOEL"/20*/ 2>/dev/null | grep -v "/$VANDAAG/$" | tail -1 || true)"

LINK=()
[ -n "$VORIGE" ] && LINK=(--link-dest="${VORIGE%/}")

# De volgorde van de filterregels telt: rsync neemt de eerste die past. De
# uitsluitingen staan dus vóór --include='*/', anders zou die eerst álle mappen
# binnenhalen en zouden de JSON-bestanden ín backups/ alsnog meekomen.
rsync -a --delete "${LINK[@]}" \
  --exclude='files/' \
  --exclude='backups/' \
  --exclude='*.bak.*.json' \
  --exclude='*.bak-*.json' \
  --exclude='*.backup.*.json' \
  --include='*/' \
  --include='*.json' \
  --include='thumbs/**' \
  --exclude='*' \
  "$BRON/" "$DOEL/$VANDAAG/"

# Character sheets als leesbare kopie ernaast. De JSON is de echte backup; dit
# is het blad dat je kunt printen zonder dat er een app draait.
if ! (cd /var/www/grisburgh && node scripts/sheets-bewaren.js "$DOEL/$VANDAAG" >> "$LOG" 2>&1); then
  zeg "let op: sheets bewaren mislukt — de datakopie staat er wel"
fi

ln -sfn "$DOEL/$VANDAAG" "$DOEL/laatste"

# Opruimen: alles ouder dan BEWAAR_DAGEN dagen.
WEG=0
for map in "$DOEL"/20*/; do
  dag="$(basename "$map")"
  if [ "$(date -d "$dag" +%s 2>/dev/null || echo 0)" -lt "$(date -d "$BEWAAR_DAGEN days ago" +%s)" ]; then
    rm -rf "$map"; WEG=$((WEG+1))
  fi
done

# Let op bij het lezen van de log: de maat van één dag zegt weinig, want du
# telt een gehardlinkt bestand vol mee. Het totaal is wat er écht op schijf staat.
DAGEN="$(ls -1d "$DOEL"/20*/ | wc -l)"
TOTAAL="$(du -sh "$DOEL" | cut -f1)"
zeg "backup $VANDAAG klaar — $DAGEN dagen bewaard, $TOTAAL op schijf, $WEG opgeruimd"
