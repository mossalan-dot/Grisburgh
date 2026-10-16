#!/usr/bin/env node
// Op welk level krijg je een feature van een subclass die de app alleen bij
// naam kent? Dat stond nergens: `features-elders.json` is een namenlijst, en
// raden uit de volgorde gaat mis zodra twee features op hetzelfde level liggen
// — wat bij vrijwel elke subclass zo is.
//
// Bron: dnd5e.wikidot.com, één pagina per subclass. Daar staat het level in de
// tekst zelf ("At 3rd level, …"), dus dat is wat we eruit halen: de kop is de
// naam, de eerste levelvermelding eronder is het level.
//
// **Alleen waar de naam exact klopt.** Komt een kop niet voor in onze lijst,
// dan gaat hij niet mee — dan kijken we naar een andere druk van dezelfde
// subclass en is het level een gok. Wat niet matcht wordt gemeld, zodat je het
// met de hand kunt nakijken in plaats van dat het stilletjes verdwijnt.
//
//   node scripts/srd-2024/elders-niveaus.js            (proefronde)
//   node scripts/srd-2024/elders-niveaus.js --schrijf
//   node scripts/srd-2024/elders-niveaus.js --klasse Cleric
const fs   = require('fs');
const path = require('path');

const BRON = 'https://dnd5e.wikidot.com';
const FEATURES = path.join(__dirname, '..', '..', 'bronnen', 'features-elders.json');
const ELDERS   = path.join(__dirname, '..', '..', 'bronnen', 'subclasses-elders.json');
const SEED     = path.join(__dirname, '..', '..', 'bronnen', 'class-progression.json');

const slug = (s) => String(s).toLowerCase()
  .replace(/[''`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// De adressen van wikidot gebruiken de korte naam: "Path of the Totem Warrior"
// staat op `barbarian:totem-warrior`. Welk deel weg mag verschilt per class,
// dus we proberen een paar vormen en nemen de eerste die bestaat.
const VOORVOEGSELS = [
  /^path of the /i, /^path of /i, /^college of the /i, /^college of /i,
  /^circle of the /i, /^circle of /i, /^oath of the /i, /^oath of /i,
  /^way of the /i, /^way of /i, /^school of /i, /^order of the /i, /^order of /i,
  /^the /i, /^warrior of the /i, /^warrior of /i,
];
// Een paar adressen volgen de regel niet.
const APART = {
  'Purple Dragon Knight (Banneret)': 'banneret',
};
function kandidaten(naam) {
  if (APART[naam]) return [APART[naam]];
  const uit = new Set();
  const kaal = naam.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  for (const bron of [kaal, naam]) {
    uit.add(slug(bron));
    for (const v of VOORVOEGSELS) if (v.test(bron)) uit.add(slug(bron.replace(v, '')));
    uit.add(slug(bron.replace(/\s+(domain|patron|sorcery|magic)$/i, '')));
  }
  return [...uit].filter(Boolean);
}

// Namen vergelijken: wikidot zet er soms "Channel Divinity:" voor en wij niet,
// of andersom. Dat is dezelfde feature met een ander kopje.
const sleutel = (n) => String(n || '').toLowerCase()
  .replace(/^channel divinity:\s*/, '').replace(/[^a-z0-9]+/g, '');

// "At 3rd level", "Beginning at 6th level", "When you reach 14th level", en de
// vorm die 2024 gebruikt: "3rd-level".
const LEVEL = /(?:\b(?:at|beginning at|starting at|when you reach)\s+)?\b(\d{1,2})(?:st|nd|rd|th)[- ]level\b/i;

async function paginaTekst(pad) {
  const r = await fetch(`${BRON}/${pad}`);
  if (!r.ok) return null;
  const h = await r.text();
  const i = h.indexOf('id="page-content"');
  if (i < 0) return null;
  const j = h.indexOf('page-tags', i);
  return h.slice(i, j > 0 ? j : i + 60000)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<h([1-6])[^>]*>/g, '\n@@KOP@@')
    .replace(/<\/h[1-6]>/g, '@@EINDE@@\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (m, c) => String.fromCharCode(+c))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&#8217;/g, "'")
    .replace(/[ \t]+/g, ' ');
}

// Per kop: het eerste level dat in zijn tekst genoemd wordt.
function kopNiveaus(tekst) {
  const uit = [];
  const stukken = String(tekst || '').split('@@KOP@@');
  for (const stuk of stukken.slice(1)) {
    const [kop, ...rest] = stuk.split('@@EINDE@@');
    const body = rest.join(' ');
    const m = body.match(LEVEL);
    uit.push({ naam: kop.trim(), level: m ? parseInt(m[1]) : 0 });
  }
  return uit;
}

// Op welke levels geeft deze class zijn subclasses features? Af te lezen aan de
// subclasses die de app zélf meebrengt; bij elke class is dat één vaste reeks.
function klasseLevels(seed, klasse) {
  for (const d of Object.values(seed.classes?.[klasse]?.subclasses || {})) {
    const lv = Object.entries(d.levels || {})
      .filter(([, r]) => (r || []).length).map(([n]) => parseInt(n)).filter(Boolean);
    if (lv.length) return lv.sort((a, b) => a - b);
  }
  return [];
}

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const only = (() => {
    const i = process.argv.indexOf('--klasse');
    return i > 0 ? process.argv[i + 1] : null;
  })();

  const features = JSON.parse(fs.readFileSync(FEATURES, 'utf8'));
  const elders   = JSON.parse(fs.readFileSync(ELDERS, 'utf8'));
  const seed     = JSON.parse(fs.readFileSync(SEED, 'utf8'));

  // Bij welke class hoort een subclass, en uit welk boek komt hij?
  const bij = {};
  for (const [klasse, lijst] of Object.entries(elders.klassen || {})) {
    for (const s of lijst) bij[s.naam] = { klasse, boek: s.boek };
  }
  for (const [klasse, d] of Object.entries(seed.classes || {})) {
    for (const s of Object.keys(d.subclasses || {})) if (!bij[s]) bij[s] = { klasse, boek: 'phb24' };
  }

  let gevuld = 0, overgeslagen = [], zonderPagina = [], klaar = 0;

  // Eerst de classes zelf: die staan op hun eigen pagina (`/artificer`). Zelfde
  // regel als hieronder — alleen namen die wij ook hebben.
  for (const [klasse, lijst] of Object.entries(features.classes)) {
    if (lijst.some(x => x && typeof x === 'object')) { klaar++; continue; }
    if (only && klasse !== only) continue;
    const tekst = await paginaTekst(slug(klasse));
    if (!tekst || !tekst.includes('@@KOP@@')) { zonderPagina.push(`${klasse} (class)`); continue; }
    const opNaam = new Map(kopNiveaus(tekst).map(g => [sleutel(g.naam), g.level]));
    const nieuw = lijst.map(n => (opNaam.get(sleutel(n)) ? { naam: n, level: opNaam.get(sleutel(n)) } : n));
    const raak = nieuw.filter(x => typeof x === 'object').length;
    if (!raak) { overgeslagen.push(`${klasse} (class) — geen enkele naam kwam overeen`); continue; }
    if (raak < lijst.length) {
      overgeslagen.push(`${klasse} (class) — ${raak}/${lijst.length}: `
        + lijst.filter((n, i) => typeof nieuw[i] !== 'object').join(', '));
    }
    features.classes[klasse] = nieuw;
    gevuld += raak;
    console.log(`  ${klasse.padEnd(34)} ${raak}/${lijst.length}  (${slug(klasse)})`);
  }

  for (const [naam, lijst] of Object.entries(features.subclasses)) {
    if (lijst.some(x => x && typeof x === 'object')) { klaar++; continue; }  // al gedaan
    const hoort = bij[naam];
    if (!hoort) { zonderPagina.push(`${naam} (geen class bekend)`); continue; }
    if (only && hoort.klasse !== only) continue;

    let gevonden = null, gebruiktPad = '';
    for (const kandidaat of kandidaten(naam)) {
      const pad = `${slug(hoort.klasse)}:${kandidaat}`;
      const tekst = await paginaTekst(pad);
      if (tekst && tekst.includes('@@KOP@@')) { gevonden = kopNiveaus(tekst); gebruiktPad = pad; break; }
      await new Promise(r => setTimeout(r, 120));
    }
    if (!gevonden) { zonderPagina.push(`${naam} — geprobeerd: ${kandidaten(naam).join(', ')}`); continue; }

    // Alleen namen die wij óók hebben. Een kop die wij niet kennen hoort bij een
    // andere druk; zijn level zegt dan niets over onze naam.
    const opNaam = new Map(gevonden.map(g => [sleutel(g.naam), g.level]));

    // **De editievalstrik.** Wikidot beschrijft de druk van 2014. Bij een
    // subclass die de app zelf als 2024-materiaal meebrengt liggen de levels
    // soms anders — een Cleric-domein geeft in 2014 iets op level 1 en 2, in
    // 2024 pas vanaf 3. Daarom: voor 2024-subclasses nemen we alleen een level
    // over dat deze class zijn subclasses ook echt géeft. Valt er een buiten,
    // dan kijken we naar de verkeerde druk en laten we hem liever leeg.
    const toegestaan = hoort.boek === 'phb24' ? klasseLevels(seed, hoort.klasse) : null;
    const nieuw = lijst.map(n => {
      const lv = opNaam.get(sleutel(n));
      if (!lv) return n;
      if (toegestaan && toegestaan.length && !toegestaan.includes(lv)) return n;
      return { naam: n, level: lv };
    });
    const raak = nieuw.filter(x => typeof x === 'object').length;
    if (!raak) { overgeslagen.push(`${naam} (${gebruiktPad}) — geen enkele naam kwam overeen`); continue; }
    if (raak < lijst.length) {
      overgeslagen.push(`${naam} (${gebruiktPad}) — ${raak}/${lijst.length}: `
        + lijst.filter((n, i) => typeof nieuw[i] !== 'object').join(', '));
    }
    features.subclasses[naam] = nieuw;
    gevuld += raak;
    console.log(`  ${naam.padEnd(34)} ${raak}/${lijst.length}  (${gebruiktPad})`);
  }

  console.log(`\n${gevuld} namen kregen een level. ${klaar} lijsten hadden er al een.`);
  if (overgeslagen.length) {
    console.log(`\nNiet compleet (${overgeslagen.length}) — kijk deze na:`);
    for (const r of overgeslagen) console.log('  ·', r);
  }
  if (zonderPagina.length) {
    console.log(`\nGeen pagina gevonden (${zonderPagina.length}):`);
    for (const r of zonderPagina) console.log('  ·', r);
  }
  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  fs.writeFileSync(FEATURES, JSON.stringify(features, null, 2) + '\n');
  console.log(`\nGeschreven: ${path.relative(process.cwd(), FEATURES)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
