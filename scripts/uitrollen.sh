#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  UITROLLEN — met een weg terug die geoefend is
# ════════════════════════════════════════════════════════════════════════════
# Deployen ging met de hand: een paar `scp`-regels en `pm2 restart`. Dat werkt
# zolang jij de enige bent die speelt. Zodra er een tweede DM op zit, is "ik heb
# iets kapotgemaakt" geen incident meer maar iemands avond — en dan is de
# terugweg "opnieuw scp'en vanuit git en hopen dat je de juiste commit pakt".
# Midden in andermans sessie is dat het verkeerde moment om daarachter te komen.
#
# Wat dit script doet, in deze volgorde:
#
#   1. Tests draaien. Rood = niet uitrollen. Dat is de echte poortwachter:
#      `tests/frontend-imports.test.js` parseert elk bestand als ES-module en
#      vangt de backtick-in-commentaar die `node --check` niet ziet en die de
#      hele app stil omver kan trekken.
#   2. Versies controleren: één bestand mag maar onder één `?v=` geïmporteerd
#      worden. Anders laadt de browser dezelfde module twee keer, met eigen
#      state, en zie je er niets van.
#   3. Een momentopname van de huidige servercode wegzetten in `releases/`.
#   4. Kopiëren in de goede volgorde: **eerst JS en CSS, dan index.html**.
#      Andersom haalt een browser een halve versie op — het nieuwe `?v=`-nummer
#      wijst dan naar een bestand dat er nog niet is.
#   5. Herstarten en nakijken: md5 per bestand, en de app geeft 200.
#   6. Klopt er iets niet, dan draait hij zichzelf meteen terug.
#
# Gebruik:
#   scripts/uitrollen.sh              alles
#   scripts/uitrollen.sh --snel       sla de tests over (alleen voor een
#                                     herhaling van een uitrol die net slaagde)
#   scripts/uitrollen.sh --droog      zeg wat er zou gebeuren, doe niets
#
# Terugdraaien: scripts/terugdraaien.sh

set -euo pipefail

SERVER="root@46.224.156.154"
DOEL="/var/www/grisburgh"
URL="https://grisburgh.nl/grisburgh"
BEWAAR=10                      # hoeveel momentopnamen we bewaren
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Wat er meegaat. Data, bestanden en node_modules blijven waar ze zijn: die
# horen niet bij een uitrol en een momentopname ervan zou gigabytes kosten.
PADEN=(public/js public/css public/index.html public/img/icons.svg
       routes lib bronnen server.js config.js package.json)

SNEL=0; DROOG=0
for a in "$@"; do
  case "$a" in
    --snel)  SNEL=1 ;;
    --droog) DROOG=1 ;;
    *) echo "Onbekende optie: $a"; exit 2 ;;
  esac
done

zeg() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fout(){ printf '  \033[31m✗\033[0m %s\n' "$*"; }

cd "$HIER"

# ── 1. Tests ────────────────────────────────────────────────────────────────
if [ "$SNEL" = 0 ]; then
  zeg "1/6  Tests"
  if ! npm test >/tmp/uitrol-test.log 2>&1; then
    fout "tests rood — er wordt niets uitgerold"
    tail -25 /tmp/uitrol-test.log
    exit 1
  fi
  ok "$(grep -oE '^# pass [0-9]+|ℹ pass [0-9]+' /tmp/uitrol-test.log | tail -1 | grep -oE '[0-9]+') tests groen"
else
  zeg "1/6  Tests overgeslagen (--snel)"
fi

# ── 2. Versies ──────────────────────────────────────────────────────────────
zeg "2/6  Versies"
SCHEEF=$(grep -ohE "\./[a-z-]+\.js\?v=[0-9]+" public/js/*.js | sort -u \
         | awk -F'?' '{print $1}' | uniq -d || true)
if [ -n "$SCHEEF" ]; then
  fout "deze bestanden worden onder meer dan één versie geïmporteerd:"
  echo "$SCHEEF" | sed 's/^/      /'
  echo "      Bump ze allemaal naar hetzelfde nummer en probeer opnieuw."
  exit 1
fi
ok "elk bestand onder één ?v="

if [ "$DROOG" = 1 ]; then
  zeg "Droogdraai — hier zou de uitrol beginnen. Mee zouden gaan:"
  printf '      %s\n' "${PADEN[@]}"
  exit 0
fi

# ── 3. Momentopname ─────────────────────────────────────────────────────────
STEMPEL=$(date +%Y-%m-%dT%H-%M-%S)
zeg "3/6  Momentopname  $STEMPEL"
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo onbekend)
ssh -n "$SERVER" "
  set -e
  mkdir -p $DOEL/releases/$STEMPEL
  cd $DOEL
  for p in ${PADEN[*]}; do
    [ -e \"\$p\" ] || continue
    mkdir -p \"$DOEL/releases/$STEMPEL/\$(dirname \"\$p\")\"
    cp -a \"\$p\" \"$DOEL/releases/$STEMPEL/\$(dirname \"\$p\")/\"
  done
  echo 'commit-ervoor: '\$(cat $DOEL/releases/HUIDIG 2>/dev/null || echo onbekend) > $DOEL/releases/$STEMPEL/MANIFEST
  date -Iseconds >> $DOEL/releases/$STEMPEL/MANIFEST
  # Oude opnamen opruimen: de nieuwste $BEWAAR blijven.
  ls -1d $DOEL/releases/*/ 2>/dev/null | sort | head -n -$BEWAAR | xargs -r rm -rf
"
ok "weggezet in releases/$STEMPEL ($(ssh -n "$SERVER" "du -sh $DOEL/releases/$STEMPEL 2>/dev/null | cut -f1"))"

terug() {
  zeg "Terugdraaien naar $STEMPEL"
  ssh -n "$SERVER" "
    cd $DOEL/releases/$STEMPEL
    for p in ${PADEN[*]}; do
      [ -e \"\$p\" ] || continue
      cp -a \"\$p\" \"$DOEL/\$(dirname \"\$p\")/\"
    done
    pm2 restart grisburgh >/dev/null 2>&1
  " && ok "de vorige stand staat er weer" || fout "terugdraaien mislukte — doe het met de hand: scripts/terugdraaien.sh"
}

# ── 4. Kopiëren, in de goede volgorde ───────────────────────────────────────
zeg "4/6  Kopiëren"
# Eerst alles behalve index.html: dat bestand noemt de nieuwe versienummers en
# mag pas landen als de bestanden waar het naar wijst er al staan.
scp -q public/js/*.js            "$SERVER:$DOEL/public/js/"
scp -q public/css/*.css          "$SERVER:$DOEL/public/css/"
scp -q public/img/icons.svg      "$SERVER:$DOEL/public/img/"
scp -q routes/*.js               "$SERVER:$DOEL/routes/"
scp -q lib/*.js                  "$SERVER:$DOEL/lib/"
scp -qr bronnen                  "$SERVER:$DOEL/"
scp -q server.js config.js package.json "$SERVER:$DOEL/"
ok "code, stijl en bronnen staan er"
scp -q public/index.html         "$SERVER:$DOEL/public/"
ok "index.html als laatste"

# ── 5. Herstarten ───────────────────────────────────────────────────────────
zeg "5/6  Herstarten"
ssh -n "$SERVER" "pm2 restart grisburgh >/dev/null 2>&1"
sleep 3
ok "pm2 herstart"

# ── 6. Nakijken ─────────────────────────────────────────────────────────────
zeg "6/6  Nakijken"
MIS=0
# Per map alleen het soort bestand dat erin hoort. En meteen: wát er afwijkt,
# niet alleen dát er iets afwijkt — "1 regels verschil" laat je zoeken.
vergelijk() {   # map, extensie
  local p="$1" ext="$2"
  local LOK PRD VERSCHIL
  LOK=$(cd "$p" && md5 -r *."$ext" 2>/dev/null | awk '{print $2, $1}' | sort)
  PRD=$(ssh -n "$SERVER" "cd $DOEL/$p && md5sum *.$ext 2>/dev/null" | awk '{print $2, $1}' | sort)
  VERSCHIL=$(diff <(echo "$LOK") <(echo "$PRD") | grep '^[<>]' || true)
  if [ -n "$VERSCHIL" ]; then
    fout "$p wijkt af:"
    echo "$VERSCHIL" | sed 's/^/      /'
    MIS=1
  else
    ok "$p gelijk"
  fi
  # Alles wat er níét hoort te liggen. Geen reden om de uitrol af te blazen,
  # wél om het te zeggen: zo belandde er op 27 sep een hele `index.html` in
  # `public/js/`, publiek bereikbaar op /js/index.html, met verouderde
  # versienummers erin. Niemand die daar ooit naar kijkt.
  local VREEMD
  VREEMD=$(ssh -n "$SERVER" "cd $DOEL/$p && ls -1 2>/dev/null | grep -v '\\.$ext\$'" || true)
  [ -n "$VREEMD" ] && { printf '  \033[33m!\033[0m %s\n' "in $p staat iets dat er niet hoort:"; echo "$VREEMD" | sed 's/^/      /'; }
  return 0
}
vergelijk public/js js
vergelijk public/css css
for f in public/index.html server.js config.js; do
  A=$(md5 -q "$f"); B=$(ssh -n "$SERVER" "md5sum $DOEL/$f" | cut -d' ' -f1)
  if [ "$A" != "$B" ]; then fout "$f wijkt af"; MIS=1; else ok "$f gelijk"; fi
done
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || echo 000)
if [ "$CODE" != "200" ]; then fout "de app geeft $CODE"; MIS=1; else ok "de app geeft 200"; fi
# **200 is geen bewijs.** De server serveert een kapot bestand net zo braaf als
# een heel bestand; het is de browser die erop stukloopt, en dan valt de hele
# module-graaf stil zonder foutmelding. Dus halen we elk bestand terug op bij de
# server en parseren het als ES-module — dezelfde strengheid als de browser.
if "$HIER/scripts/modules-nakijken.sh"; then ok "alle modules laden"; else fout "een module laadt niet"; MIS=1; fi

if [ "$MIS" = 1 ]; then
  fout "er klopt iets niet"
  terug
  exit 1
fi

ssh -n "$SERVER" "echo '$COMMIT' > $DOEL/releases/HUIDIG"
zeg "Klaar. Uitgerold vanaf commit $COMMIT."
echo "  Terug naar de vorige stand:  scripts/terugdraaien.sh"
