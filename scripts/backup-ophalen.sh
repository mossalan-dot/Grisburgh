#!/bin/bash
# Haalt de serverbackup naar de laptop. Draait via launchd (zie
# nl.grisburgh.backup.plist); staat de laptop uit, dan haalt launchd de gemiste
# beurt in zodra hij weer aan gaat.
#
# Twee dingen komen mee:
#   laatste/  — de huidige stand inclusief thumbnails (~58 MB), zodat de app na
#               een ramp meteen weer mét beeld staat, alleen op 600px.
#   json/     — per dag alleen de JSON (~2 MB), dertig dagen terug. De server
#               bewaart die historie met hardlinks; de rsync van macOS kent die
#               niet, dus de laptop houdt de geschiedenis JSON-only. De
#               originelen in files/ (2,2 GB) blijven bewust alleen op de server.
set -euo pipefail

SERVER="root@46.224.156.154"
DOEL="$HOME/Grisburgh-backups"
LOG="$DOEL/backup.log"
VANDAAG="$(date +%F)"
BEWAAR_DAGEN=30

mkdir -p "$DOEL/json"
zeg() { echo "$(date '+%F %T')  $*" >> "$LOG"; }

if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" true 2>/dev/null; then
  zeg "server niet bereikbaar — volgende keer opnieuw"
  exit 0
fi

# --copy-links: 'laatste' is op de server een symlink naar de dag van vandaag.
rsync -a --delete --copy-links "$SERVER:/var/backups/grisburgh/laatste/" "$DOEL/laatste/"
rsync -a --delete --copy-links --exclude='thumbs/' \
  "$SERVER:/var/backups/grisburgh/laatste/" "$DOEL/json/$VANDAAG/"

# Dertig dagen JSON-historie; ouder mag weg.
GRENS="$(date -v-${BEWAAR_DAGEN}d +%F)"
WEG=0
for map in "$DOEL"/json/20*/; do
  dag="$(basename "$map")"
  if [[ "$dag" < "$GRENS" ]]; then rm -rf "$map"; WEG=$((WEG+1)); fi
done

zeg "opgehaald — $(du -sh "$DOEL" | cut -f1) totaal, $(ls -1d "$DOEL"/json/20*/ | wc -l | tr -d ' ') dagen json, $WEG opgeruimd"
