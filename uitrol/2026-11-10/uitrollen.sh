#!/usr/bin/env bash
# Uitrol van 10 nov 2026 — drie aanpassingen bovenop wat er online draaide
# (app.js?v=1194). Alleen deze zes bestanden; servercode, data en de rest van
# public/ blijven onaangeroerd.
#
#   1. Inzoomen op een telefoon: de app krimpt niet meer mee (_zetAppHoogte),
#      en dubbeltikken op de kop zoomt niet meer in.
#   2. Tegels: de naam op de plaat, zoals in het Heldenboek.
#   3. Tegels: bladeren met ‹ › in plaats van omdraaien.
#
# Gebruik — op de server of op de laptop, met of zonder git:
#   bash uitrollen.sh            # controleren, momentopname, kopiëren, nakijken
#   bash uitrollen.sh --droog    # alleen controleren en zeggen wat er zou gebeuren
#   bash uitrollen.sh --terug    # de momentopname van de vorige keer terugzetten
#
# Het script weigert als online niet meer precies de versie draait waarop dit
# gebouwd is: dan zou het nieuwer werk overschrijven.
set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
SITE="${SITE:-https://grisburgh.nl}"
LIVE="${LIVE:-/var/www/grisburgh}"
SERVER="root@46.224.156.154"
BESTANDEN=(public/js/app.js public/js/render-campagne.js public/js/render-bestiarium.js
           public/js/render-spreuken.js public/css/theme.css public/index.html)
MOMENT="releases/2026-11-10-voor-uitrol"

MODUS="${1:-}"

# Lokaal (op de server) of over ssh (vanaf de laptop). `-n` zodat ssh geen
# stdin opeet — dat liet ooit een bevestigingsvraag stil mislukken.
if [ -d "$LIVE/public" ]; then
  doe()   { bash -c "$1"; }
  zet()   { cp "$1" "$LIVE/$2"; }
else
  doe()   { ssh -n "$SERVER" "$1"; }
  zet()   { scp -q "$1" "$SERVER:$LIVE/$2"; }
fi

hash() { if command -v sha256sum >/dev/null; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }
online() {   # wat de site nu serveert; index.html is de ingevulde shell van /grisburgh
  case "$1" in
    public/index.html) curl -fsS "$SITE/grisburgh" ;;
    *)                 curl -fsS "$SITE/${1#public/}?nocache=$RANDOM" ;;
  esac
}
verwacht() { grep " $1\$" "$HIER/$2" | cut -d' ' -f1; }

if [ "$MODUS" = "--terug" ]; then
  echo "Momentopname terugzetten uit $LIVE/$MOMENT …"
  doe "test -d '$LIVE/$MOMENT'" || { echo "Er is geen momentopname — er is niets uitgerold."; exit 1; }
  # Eerst de modules, index.html als laatste: andersom vraagt een browser even
  # om een versie die er nog niet (meer) is.
  for f in "${BESTANDEN[@]}"; do
    [ "$f" = public/index.html ] && continue
    doe "cp '$LIVE/$MOMENT/$f' '$LIVE/$f'"
  done
  doe "cp '$LIVE/$MOMENT/public/index.html' '$LIVE/public/index.html'"
  echo "Teruggezet. Ververs de app op je telefoon."
  exit 0
fi

echo "1. Draait online nog de versie waarop dit gebouwd is?"
afwijkend=0; al=0
for f in "${BESTANDEN[@]}"; do
  nu="$(online "$f" | hash)"
  if [ "$nu" = "$(verwacht "$f" basis.sha256)" ]; then
    echo "   ok      $f"
  elif [ "$nu" = "$(verwacht "$f" nieuw.sha256)" ] || { [ "$f" = public/index.html ] && online "$f" | grep -q 'app.js?v=1195'; }; then
    echo "   al uit  $f (deze uitrol staat er al)"; al=$((al + 1))
  else
    echo "   ANDERS  $f"; afwijkend=1
  fi
done
# Staat hij er al, dan niets doen: een tweede momentopname zou de eerste
# overschrijven met de nieuwe bestanden, en dan is er geen weg terug meer.
if [ "$afwijkend" = 0 ] && [ "$al" = "${#BESTANDEN[@]}" ]; then
  echo "Deze uitrol staat er al. Niets gedaan."; exit 0
fi
if [ "$afwijkend" = 0 ] && [ "$al" -gt 0 ]; then
  echo "Half uitgerold: een deel staat er al, een deel niet. Zet eerst terug (--terug) en probeer opnieuw."; exit 1
fi
if [ "$afwijkend" = 1 ]; then
  cat <<UIT

Gestopt: online staat iets anders dan waarop dit gebouwd is. Waarschijnlijk is
er intussen vanaf de laptop uitgerold. Neem de wijzigingen dan daar over:
  git cherry-pick ab8f8ca 28c707e      (inzoomen, naam op de plaat)
  git apply --3way docs/patches/tegel-pijltjes.patch
Er is niets gekopieerd.
UIT
  exit 1
fi

echo "2. Klopt wat er in deze map ligt?"
for f in "${BESTANDEN[@]}"; do
  [ "$(hash < "$HIER/$f")" = "$(verwacht "$f" nieuw.sha256)" ] || { echo "   $f is beschadigd of aangepast — gestopt."; exit 1; }
done
echo "   ok"

if [ "$MODUS" = "--droog" ]; then
  echo "Droog: zou ${#BESTANDEN[@]} bestanden kopiëren naar $LIVE (index.html als laatste). Niets gedaan."
  exit 0
fi

echo "3. Momentopname van wat er nu staat → $LIVE/$MOMENT"
doe "mkdir -p '$LIVE/$MOMENT/public/js' '$LIVE/$MOMENT/public/css'"
for f in "${BESTANDEN[@]}"; do doe "cp '$LIVE/$f' '$LIVE/$MOMENT/$f'"; done

echo "4. Kopiëren — modules en CSS eerst, index.html als laatste"
for f in "${BESTANDEN[@]}"; do [ "$f" = public/index.html ] || zet "$HIER/$f" "$f"; done
zet "$HIER/public/index.html" public/index.html

echo "5. Nakijken: serveert de site nu de nieuwe bestanden?"
fout=0
for f in "${BESTANDEN[@]}"; do
  [ "$f" = public/index.html ] && continue
  [ "$(online "$f" | hash)" = "$(verwacht "$f" nieuw.sha256)" ] && echo "   ok  $f" || { echo "   FOUT $f"; fout=1; }
done
online public/index.html | grep -q 'app.js?v=1195' && echo "   ok  index.html (app.js?v=1195)" || { echo "   FOUT index.html"; fout=1; }
if [ "$fout" = 1 ]; then
  echo "Nakijken mislukt — terugzetten …"
  bash "$0" --terug
  exit 1
fi
echo
echo "Klaar. Geen herstart nodig: alleen bestanden in public/ zijn veranderd."
echo "Op de telefoon: app één keer verversen (of sluiten en opnieuw openen)."
echo "Terug naar de vorige stand: bash $0 --terug"
