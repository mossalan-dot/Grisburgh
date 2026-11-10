# Patches voor code die niet op GitHub staat

De tegels (archief, bestiarium, spreuken als raster) zijn op de laptop gebouwd
en stonden op 10 nov 2026 nog niet op GitHub. Wijzigingen daaraan staan hier
als patch, gemaakt tegen de bestanden zoals ze toen online draaiden
(`app.js?v=1194`, `render-campagne.js?v=365`).

## tegel-pijltjes.patch

Bladeren in een open tegel met ‹ › in plaats van omdraaien, zoals de
bladerkaart in het Heldenboek. `_draai` schuift het blad opzij (gedeeld door
archief, bestiarium en spreuken); op het portretblad loopt de voet doorzichtig
over de foto.

Toepassen, in de werkkopie op de laptop:

```bash
git fetch origin claude/serene-archimedes-sm42hn
git show origin/claude/serene-archimedes-sm42hn:docs/patches/tegel-pijltjes.patch | git apply --3way
node scripts/versies-ophogen.js public/js/render-campagne.js public/js/render-bestiarium.js \
  public/js/render-spreuken.js public/css/theme.css --schrijf
npm test
```

`--3way` laat git zelf samenvoegen als de bestanden sindsdien veranderd zijn;
een conflict staat dan gewoon in het bestand.
