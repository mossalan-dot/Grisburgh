#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  TERUGDRAAIEN — naar een eerdere stand van de code
# ════════════════════════════════════════════════════════════════════════════
# `scripts/uitrollen.sh` zet vóór elke uitrol een momentopname weg in
# `releases/`. Dit zet er een terug. Zonder argument de nieuwste, dus bij
# "ik heb net iets kapotgemaakt" is dit het hele commando.
#
#   scripts/terugdraaien.sh                 naar de stand vóór de laatste uitrol
#   scripts/terugdraaien.sh --lijst         welke er zijn
#   scripts/terugdraaien.sh 2026-10-02T14-30-00
#
# **Dit raakt alleen code.** Data, bestanden en sessies blijven staan — die
# horen niet bij een uitrol, en terugdraaien mag nooit iemands spel terugzetten.
# Een gegevenswijziging draai je terug uit de nachtelijke backup; zie CLAUDE.md.

set -euo pipefail

SERVER="root@46.224.156.154"
DOEL="/var/www/grisburgh"
URL="https://grisburgh.nl/grisburgh"
PADEN=(public/js public/css public/index.html public/img/icons.svg
       routes lib bronnen server.js config.js package.json)

zeg() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fout(){ printf '  \033[31m✗\033[0m %s\n' "$*"; }

JA=0
if [ "${1:-}" = "--ja" ]; then JA=1; shift; fi

if [ "${1:-}" = "--lijst" ]; then
  zeg "Momentopnamen op de server"
  ssh -n "$SERVER" "cd $DOEL/releases 2>/dev/null && for d in */; do
    printf '  %-24s %6s  %s\n' \"\${d%/}\" \"\$(du -sh \$d | cut -f1)\" \"\$(head -1 \$d/MANIFEST 2>/dev/null)\"
  done" || echo "  (nog geen)"
  exit 0
fi

WELKE="${1:-}"
if [ -z "$WELKE" ]; then
  # **Nooit terug naar een `-voor-terugdraai`-opname.** Die bewaart de stand die
  # je wílde ontvluchten; hem als standaard kiezen zet precies de storing terug
  # die je aan het oplossen was. Gevonden door twee keer achter elkaar te
  # oefenen: de tweede terugdraai haalde de kapotte app.js van de eerste terug,
  # en de app gaf gewoon 200 — want de server serveert dat bestand prima, het is
  # de bróswer die erop stukloopt.
  WELKE=$(ssh -n "$SERVER" "ls -1d $DOEL/releases/*/ 2>/dev/null | grep -v -- '-voor-terugdraai/' | sort | tail -1 | xargs -r basename" || true)
fi
if [ -z "$WELKE" ]; then
  fout "er staan geen momentopnamen. Rol eerst een keer uit met scripts/uitrollen.sh."
  exit 1
fi

if ! ssh -n "$SERVER" "[ -d $DOEL/releases/$WELKE ]"; then
  fout "onbekende momentopname: $WELKE"
  echo "  Welke er zijn:  scripts/terugdraaien.sh --lijst"
  exit 1
fi

zeg "Terugdraaien naar $WELKE"
ssh -n "$SERVER" "cat $DOEL/releases/$WELKE/MANIFEST 2>/dev/null" | sed 's/^/  /'
# `ssh` leest standaard stdin leeg. Zonder `-n` hierboven slikt hij het antwoord
# op deze vraag op, krijgt `read` een EOF, en stopt het script onder `set -e`
# zónder iets te zeggen — je denkt dat je teruggedraaid hebt en dat is niet zo.
# Gevonden door het één keer echt te oefenen.
if [ "$JA" = 0 ]; then
  read -r -p "  Doorgaan? [j/N] " ja || ja=""
  [ "$ja" = "j" ] || { echo "  Afgebroken."; exit 0; }
fi

# Vóór het terugdraaien eerst de huidige stand wegzetten: anders kun je een
# terugdraai niet terugdraaien, en dat is precies het moment waarop je merkt
# dat het probleem ergens anders zat.
NU=$(date +%Y-%m-%dT%H-%M-%S)-voor-terugdraai
ssh -n "$SERVER" "
  set -e
  mkdir -p $DOEL/releases/$NU
  cd $DOEL
  for p in ${PADEN[*]}; do
    [ -e \"\$p\" ] || continue
    mkdir -p \"$DOEL/releases/$NU/\$(dirname \"\$p\")\"
    cp -a \"\$p\" \"$DOEL/releases/$NU/\$(dirname \"\$p\")/\"
  done
  echo 'stand vlak voor het terugdraaien naar $WELKE' > $DOEL/releases/$NU/MANIFEST
  date -Iseconds >> $DOEL/releases/$NU/MANIFEST
  # Deze soort apart opruimen: ze tellen niet mee als uitrolpunt, maar ze nemen
  # wel ruimte. De laatste drie zijn ruim genoeg om een misgelopen terugdraai
  # nog eens terug te draaien.
  ls -1d $DOEL/releases/*-voor-terugdraai/ 2>/dev/null | sort | head -n -3 | xargs -r rm -rf
"
ok "huidige stand bewaard als $NU"

ssh -n "$SERVER" "
  set -e
  cd $DOEL/releases/$WELKE
  for p in ${PADEN[*]}; do
    [ -e \"\$p\" ] || continue
    cp -a \"\$p\" \"$DOEL/\$(dirname \"\$p\")/\"
  done
  pm2 restart grisburgh >/dev/null 2>&1
"
sleep 3
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || echo 000)
if [ "$CODE" = "200" ] && "$(dirname "${BASH_SOURCE[0]}")/modules-nakijken.sh"; then
  ok "teruggedraaid, de app geeft 200 en alle modules laden"
  echo
  echo "  Let op: je lokale werkmap is híérmee niet veranderd. Wil je ook lokaal"
  echo "  terug, gebruik dan git. Rol je straks opnieuw uit, dan overschrijft dat"
  echo "  deze terugdraai gewoon weer."
else
  fout "de app geeft $CODE of een module laadt niet — ssh $SERVER 'pm2 logs grisburgh --lines 40'"
  exit 1
fi
