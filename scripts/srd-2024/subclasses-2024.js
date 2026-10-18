#!/usr/bin/env node
// **De regel: wat in de Player's Handbook van 2024 staat, is leidend.**
//
// De voorraadlijst is laagje voor laagje opgebouwd: namen met de hand, levels
// van dnd5e.wikidot.com (dat is een 2014-wiki) en een paar gaten uit de
// campagne van Grisburgh. Voor een subclass die in 2024 opnieuw is uitgegeven
// is dat de verkeerde druk — College of Lore heeft in 2024 vier features op 3,
// 3, 6 en 14, en niet die van 2014.
//
// dnd2024.wikidot.com heeft per subclass een pagina waar naam én level in
// dezelfde kop staan ("Level 3: Cutting Words"). Dat is de beste bron die er
// is, en dit script zet hem erin.
//
// **De nieuwste versie wint**, niet alleen de Player's Handbook: een Artificer
// is in 2024 opnieuw uitgegeven in Eberron, het Knowledge Domain in Heroes of
// Faerûn. Welk boek het was staat in de melding, zodat je ziet waar een
// subclass vandaan komt. Wat geen 2024-pagina heeft blijft zoals het is.
//
//   node scripts/srd-2024/subclasses-2024.js            (proefronde)
//   node scripts/srd-2024/subclasses-2024.js --schrijf
const fs   = require('fs');
const path = require('path');

const BRON     = 'https://dnd2024.wikidot.com';
const FEATURES = path.join(__dirname, '..', '..', 'bronnen', 'features-elders.json');
const ELDERS   = path.join(__dirname, '..', '..', 'bronnen', 'subclasses-elders.json');
const SEED     = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');

const slug = (s) => String(s).toLowerCase()
  .replace(/[''`’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// De wiki schrijft een krul-apostrof en zet er soms een punt achter; onze
// namen doen dat geen van beide.
const schoon = (n) => String(n || '').replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/\.$/, '').trim();

async function pagina(pad) {
  const r = await fetch(`${BRON}/${pad}`);
  if (!r.ok) return null;
  const h = await r.text();
  const i = h.indexOf('id="page-content"');
  if (i < 0) return null;
  const j = h.indexOf('page-tags', i);
  const stuk = h.slice(i, j > 0 ? j : i + 40000);
  const kaal = stuk.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (m, c) => String.fromCharCode(+c)).replace(/[ \t]+/g, ' ');
  const boek = (kaal.match(/Source: ([^\n]{3,70})/) || [])[1]?.trim() || '';
  const features = [...stuk.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .map(k => k.match(/^Level (\d{1,2}):\s*(.+)$/))
    .filter(Boolean)
    .map(m => ({ naam: schoon(m[2]), level: parseInt(m[1]) }));
  return { boek, features };
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const features = JSON.parse(fs.readFileSync(FEATURES, 'utf8'));
  const elders   = JSON.parse(fs.readFileSync(ELDERS, 'utf8'));
  const seed     = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  const bij = {};
  for (const [klasse, lijst] of Object.entries(elders.klassen || {})) {
    for (const s of lijst) bij[s.naam] = klasse;
  }
  for (const [klasse, d] of Object.entries(seed.classes || {})) {
    for (const s of Object.keys(d.subclasses || {})) if (!bij[s]) bij[s] = klasse;
  }

  const vervangen = [], anderBoek = [], geenPagina = [];
  for (const [naam, oud] of Object.entries(features.subclasses)) {
    const klasse = bij[naam];
    if (!klasse) { geenPagina.push(`${naam} (geen class bekend)`); continue; }
    const p = await pagina(`${slug(klasse)}:${slug(naam)}`);
    await new Promise(r => setTimeout(r, 120));
    if (!p || !p.features.length) { geenPagina.push(naam); continue; }
    // Een UA-pagina is een proefdruk, geen boek: die laten we liggen.
    if (/\bua\b|unearthed arcana|playtest/i.test(p.boek)) {
      anderBoek.push(`${naam} — alleen als proefdruk: "${p.boek}"`);
      continue;
    }
    if (!/^player'?s handbook/i.test(p.boek)) anderBoek.push(`${naam} — uit "${p.boek}"`);
    const oudeNamen = oud.map(x => (x && typeof x === 'object') ? x.naam : x);
    // De wiki tikt wel eens een hoofdletter mis ("Arcane ward"). Kende onze
    // lijst hem al, dan houden we onze schrijfwijze: het level komt van daar,
    // de spelling van ons.
    for (const f of p.features) {
      const bekend = oudeNamen.find(n => n.toLowerCase() === f.naam.toLowerCase());
      if (bekend) f.naam = bekend;
    }
    const nieuweNamen = p.features.map(f => f.naam);
    const zelfde = oudeNamen.length === nieuweNamen.length
      && oudeNamen.every(n => nieuweNamen.includes(n));
    features.subclasses[naam] = p.features;
    vervangen.push({ naam, klasse, n: p.features.length, zelfde,
                     weg: oudeNamen.filter(n => !nieuweNamen.includes(n)),
                     bij: nieuweNamen.filter(n => !oudeNamen.includes(n)) });
  }

  for (const v of vervangen) {
    console.log(`  ${v.naam.padEnd(30)} ${String(v.n).padStart(2)} features${v.zelfde ? '' : '  ·  '
      + [v.weg.length ? `weg: ${v.weg.join(', ')}` : '', v.bij.length ? `erbij: ${v.bij.join(', ')}` : '']
        .filter(Boolean).join(' · ')}`);
  }
  console.log(`\n${vervangen.length} subclasses uit de PHB 2024 overgenomen.`);
  if (anderBoek.length) {
    console.log(`\nUit een ander boek dan de PHB (${anderBoek.length}):`);
    for (const r of anderBoek) console.log('  ·', r);
  }
  if (geenPagina.length) {
    console.log(`\nGeen 2024-pagina (${geenPagina.length}) — blijven zoals ze zijn:`);
    console.log('  ' + geenPagina.join(', '));
  }
  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(FEATURES, JSON.stringify(features, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), FEATURES)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
