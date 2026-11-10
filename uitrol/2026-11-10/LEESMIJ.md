# Uitrol 10 november 2026

Drie aanpassingen bovenop de versie die op 10 nov online draaide
(`app.js?v=1194`), als **zes kant-en-klare bestanden**:

1. **Inzoomen op een telefoon.** De app kromp mee bij inzoomen (de hoogte
   volgde `visualViewport.height`), waarna de kop op een iPhone niet meer goed
   reageerde. Nu `height × scale`. Dubbeltikken op de kop zoomt niet meer in.
2. **De naam op de plaat.** Een tegel met portret zet de naam licht op een
   donkere voet, zoals in het Heldenboek, in plaats van in een crème vervaging.
3. **Bladeren met pijltjes.** Een open tegel (archief, bestiarium, spreuken)
   bladert met ‹ › en schuift opzij in plaats van om te draaien.

Waarom zo en niet de hele branch: de tegels, Bastion, de terugblik en hun
servercode staan nog niet op GitHub. De hele branch uitrollen zou die
terugzetten. Deze map raakt alleen deze zes bestanden in `public/`; servercode,
data en de rest blijven staan. Er is geen herstart nodig.

## Uitrollen

Op de server (vanaf een telefoon met een SSH-app), zonder je werkkopie aan te
raken:

```bash
ssh root@46.224.156.154
cd ~/grisburgh-dev
git fetch origin claude/serene-archimedes-sm42hn
git worktree add /tmp/uitrol-10nov origin/claude/serene-archimedes-sm42hn
bash /tmp/uitrol-10nov/uitrol/2026-11-10/uitrollen.sh --droog   # eerst kijken
bash /tmp/uitrol-10nov/uitrol/2026-11-10/uitrollen.sh
git worktree remove /tmp/uitrol-10nov
```

Of vanaf de laptop zonder git: download deze map (GitHub → branch
`claude/serene-archimedes-sm42hn` → *Code* → *Download ZIP*) en draai
`bash uitrol/2026-11-10/uitrollen.sh`. Het script merkt zelf dat het niet op de
server staat en kopieert dan over `ssh`/`scp`.

## Wat het script doet

1. Kijkt per bestand of online nog precies de versie draait waarop dit gebouwd
   is (`basis.sha256`). Wijkt er één af, dan stopt het zonder iets te kopiëren.
2. Controleert dat de bestanden in deze map onbeschadigd zijn (`nieuw.sha256`).
3. Zet de huidige zes bestanden weg in
   `/var/www/grisburgh/releases/2026-11-10-voor-uitrol/`.
4. Kopieert JS en CSS, en `index.html` als laatste.
5. Haalt alles terug op bij de site en vergelijkt; mislukt dat, dan zet het
   zichzelf terug.

Terug naar de vorige stand: `bash uitrollen.sh --terug`.
Twee keer draaien kan geen kwaad: staat de uitrol er al, dan doet het niets.

## Daarna, als de laptop weer bij is

Neem dezelfde wijzigingen over in de laptopversie, anders verdwijnen ze bij de
volgende gewone uitrol:

```bash
git cherry-pick ab8f8ca 28c707e                      # inzoomen, naam op de plaat
git apply --3way docs/patches/tegel-pijltjes.patch   # pijltjes
node scripts/versies-ophogen.js public/js/app.js public/js/render-campagne.js \
  public/js/render-bestiarium.js public/js/render-spreuken.js public/css/theme.css --schrijf
```

`index.html` in deze map is het sjabloon zoals het op schijf hoort (titel
"Campagne"); de server vult de titel en de iconen per campagne in.
