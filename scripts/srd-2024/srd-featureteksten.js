#!/usr/bin/env node
// Hetzelfde als srd-spelteksten.js, maar voor class features, species traits en
// feats: welke beschrijvingen mogen we weggeven aan een campagne die de
// PHB-teksten niet mag zien?
//
// De SRD 5.2 staat onder CC BY 4.0 en dekt het grootste deel van de basisklassen
// en de SRD-species. Wat er niet in staat (niet-SRD subklassen en soorten uit
// 5etools) blijft leeg; de app verwijst daarvoor naar buiten.
//
// Uitvoer: `bronnen/srd-features.json`, met dezelfde sleutels als
// feature-descriptions.json — "Klasse|Naam" én "Naam" — zodat `_srdDesc()` in
// render-progressie.js er zonder aanpassing mee overweg kan.
//
//   node scripts/srd-2024/srd-featureteksten.js [--schrijf]
const fs   = require('fs');
const path = require('path');

const BASIS = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en';
const DOEL  = path.join(__dirname, '..', '..', 'bronnen', 'srd-features.json');

const haal = (naam) => fetch(`${BASIS}/5e-SRD-${naam}.json`).then(r => r.json()).catch(() => []);

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const [features, traits, feats] = await Promise.all([haal('Features'), haal('Traits'), haal('Feats')]);

  const uit = {};
  // Klasse-specifiek eerst opslaan, dan de kale naam. Twee klassen kunnen een
  // gelijknamige feature hebben ("Spellcasting"); de kale sleutel is dan een
  // terugval en niet de waarheid — daarom overschrijven we hem niet.
  const zet = (sleutel, tekst) => { if (sleutel && tekst && !uit[sleutel]) uit[sleutel] = tekst; };

  for (const f of features) {
    const tekst = String(f.description || '').trim();
    if (!tekst) continue;
    if (f.class?.name) zet(`${f.class.name}|${f.name}`, tekst);
    if (f.subclass?.name) zet(`${f.subclass.name}|${f.name}`, tekst);
    zet(f.name, tekst);
  }
  for (const t of traits) {
    const tekst = String(t.description || '').trim();
    if (!tekst) continue;
    for (const sp of (t.species || [])) zet(`${sp.name || sp}|${t.name}`, tekst);
    zet(t.name, tekst);
  }
  // Feats staan in feature-descriptions.json onder "feat|Naam"; die sleutel
  // hoort er dus ook te zijn, anders vindt _srdDesc() ze niet.
  for (const f of feats) {
    const tekst = String(f.description || '').trim();
    zet(`feat|${f.name}`, tekst);
    zet(f.name, tekst);
  }

  const tekens = Object.values(uit).join('').length;
  console.log(`Features: ${features.length} · traits: ${traits.length} · feats: ${feats.length}`);
  console.log(`Sleutels: ${Object.keys(uit).length} · ${Math.round(tekens / 1024)} kB tekst`);

  // Hoeveel van onze seed wordt hiermee gedekt?
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json'), 'utf8'));
  let totaal = 0, raak = 0;
  for (const groep of ['classes', 'species']) {
    for (const [naam, def] of Object.entries(seed[groep] || {})) {
      for (const f of Object.values(def.levels || {}).flat()) {
        if (!f?.name) continue;
        totaal++;
        if (uit[`${naam}|${f.name}`] || uit[f.name]) raak++;
      }
    }
  }
  console.log(`Dekt ${raak} van ${totaal} regels in de seed (${Math.round(raak / totaal * 100)}%).`);

  if (schrijf) {
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
    console.log(`Geschreven: ${path.relative(process.cwd(), DOEL)}`);
  } else {
    console.log('Proefdraai — geef --schrijf om het bestand te maken.');
  }
})();
