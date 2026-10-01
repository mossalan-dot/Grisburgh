#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  STRESSTEST — een campagne op volle grootte
// ════════════════════════════════════════════════════════════════════════════
// De testomgeving had 28 personages en 16 locaties. Dat is genoeg om te zien
// dát een scherm werkt, maar niet of het nog wérkt bij de omvang van een
// uitgegeven stadscampagne: een zoekveld over veertig kaartjes is iets anders
// dan over vierhonderd, en een relatiemap met zes lijnen zegt niets over een
// met tweehonderd.
//
// Dit legt een complete stadscampagne neer met dezelfde vorm als een
// gepubliceerd stadsavontuur: één stad, wijken eronder, vijf partijen die
// achter dezelfde verborgen schat aan zitten, vier aktes die elk een seizoen
// beslaan, dungeons, gevechten op een CR-ladder, voorwerpen, missies en post.
//
// De inhoud is eigen werk. Dat is geen omweg maar een voordeel: de schaal is
// een knop (`--schaal 3` maakt alles drie keer zo groot), en daarmee test je
// waar het breekt in plaats van waar het toevallig ophoudt.
//
//   node scripts/stresstest-vullen.js <campagne> [--basis <pad>] [--schaal n] [--schrijf]
//
// Zonder `--schrijf` vertelt hij alleen wat hij zou doen. Idempotent: alle
// id's beginnen met `st_`, dus opnieuw draaien werkt bij en dupliceert niet,
// en `--weg` haalt precies die kaartjes er weer uit.

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const MET_WAARDE = new Set(['--basis', '--schaal']);
const vrij = args.filter((a, i) => !a.startsWith('--') && !MET_WAARDE.has(args[i - 1]));
const campagne  = vrij[0];
const schrijfMode = args.includes('--schrijf');
const wegMode     = args.includes('--weg');
const basisArg = args.includes('--basis') ? args[args.indexOf('--basis') + 1] : null;
const SCHAAL   = Math.max(1, Math.min(20, parseInt(
  args.includes('--schaal') ? args[args.indexOf('--schaal') + 1] : '1', 10) || 1));

if (!campagne) {
  console.error('Gebruik: node scripts/stresstest-vullen.js <campagne> [--basis <pad>] [--schaal n] [--schrijf|--weg]');
  process.exit(1);
}
const base = basisArg || path.join(__dirname, '..', 'data', 'campaigns', campagne);
if (!fs.existsSync(base)) { console.error('Campagne niet gevonden: ' + base); process.exit(1); }

const lees = (f, val) => {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) return val;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return val; }
};
const teSchrijven = {};
const bewaar = (f, o) => { teSchrijven[f] = o; };

const ent     = lees('entities.json', {});
const meta    = lees('meta.json', {});
const enc     = lees('encounters.json', { encounters: [] });
const quests  = lees('quests.json', { quests: [] });
const dungeons= lees('dungeon-maps.json', { maps: [] });
const tafels  = lees('tables.json', { tables: [] });

// ── Gereedschap ─────────────────────────────────────────────────────────────
// Alles wat dit script maakt krijgt het voorvoegsel `st_`, zodat je het er in
// één beweging weer uit kunt halen zonder handwerk van iemand anders te raken.
const PRE = 'st_';
const zet = (soort, kaart) => {
  ent[soort] = ent[soort] || [];
  const i = ent[soort].findIndex(x => x.id === kaart.id);
  const oud = i >= 0 ? ent[soort][i] : null;
  const nieuw = { ...(oud || {}), ...kaart, data: { ...(oud?.data || {}), ...(kaart.data || {}) } };
  if (i >= 0) ent[soort][i] = nieuw; else ent[soort].push(nieuw);
  return nieuw.id;
};
const betr = rijen => JSON.stringify(rijen);
// Vaste "willekeur": dezelfde campagne levert twee keer hetzelfde op, anders
// kun je een fout niet nog eens oproepen.
let _zaad = 20261001;
const rnd = () => (_zaad = (_zaad * 1103515245 + 12345) % 2147483648) / 2147483648;
const kies = (lijst) => lijst[Math.floor(rnd() * lijst.length)];
const kiesN = (lijst, n) => {
  const kopie = [...lijst]; const uit = [];
  while (uit.length < n && kopie.length) uit.push(...kopie.splice(Math.floor(rnd() * kopie.length), 1));
  return uit;
};

if (wegMode) {
  let weg = 0;
  for (const soort of Object.keys(ent)) {
    const voor = (ent[soort] || []).length;
    ent[soort] = (ent[soort] || []).filter(x => !String(x.id).startsWith(PRE));
    weg += voor - ent[soort].length;
  }
  enc.encounters   = (enc.encounters || []).filter(e => !String(e.id).startsWith(PRE));
  quests.quests    = (quests.quests || []).filter(q => !String(q.id).startsWith(PRE));
  dungeons.maps    = (dungeons.maps || []).filter(m => !String(m.id).startsWith(PRE));
  tafels.tables    = (tafels.tables || []).filter(t => !String(t.id).startsWith(PRE));
  const ruw0 = lees('monsters.json', { monsters: [] });
  const mon0 = Array.isArray(ruw0) ? { monsters: ruw0 } : (ruw0 || { monsters: [] });
  mon0.monsters = (mon0.monsters || []).filter(m => !String(m.id).startsWith(PRE));
  bewaar('monsters.json', mon0);
  meta.facties     = (meta.facties || []).filter(f => !String(f.id || '').startsWith(PRE));
  for (const k of Object.keys(meta.hoofdstukken || {})) if (k.startsWith(PRE)) delete meta.hoofdstukken[k];
  bewaar('entities.json', ent); bewaar('encounters.json', enc); bewaar('quests.json', quests);
  bewaar('dungeon-maps.json', dungeons); bewaar('tables.json', tafels); bewaar('meta.json', meta);
  console.log(`${weg} kaartjes verwijderd, plus gevechten, missies, dungeons, tafels, facties en aktes.`);
  wegschrijven();
  process.exit(0);
}

// ════════════════════════════════════════════════════════════════════════════
//  DE STAD
// ════════════════════════════════════════════════════════════════════════════
// Een stadscampagne hangt aan zijn geografie: elk kaartje weet in welke wijk
// het staat, en die keten (plek → wijk → stad → streek) is precies wat de
// Markt, de relatiemap en het zoekveld zwaar belast.

const L = (id, name, locType, extra = {}) =>
  zet('locaties', { id: PRE + id, name, subtype: '', icon: '', data: { locType, ...extra } });

L('streek', 'De Zoutmonding', 'Streek', {
  desc: 'Waar de rivier de Aalt de zee in loopt en het water brak wordt. Zout in de grond, zout in het hout, zout in de mensen.' });
L('stad', 'Veerspoort', 'Stad', {
  wijk: 'De Zoutmonding', wijkId: PRE + 'streek',
  desc: 'Een havenstad van veertigduizend zielen, gebouwd op palen en afspraken. Niemand bezit Veerspoort; iedereen huurt er een stukje van.' });

const WIJKEN = [
  ['kade',     'De Natte Kade',    'Pakhuizen, kranen en een getij dat twee keer per dag de straten likt.'],
  ['hoogstad', 'Hoogstad',         'Op de enige heuvel. Wie hier woont kijkt naar beneden, en weet dat.'],
  ['weversbuurt','De Weversbuurt', 'Smalle stegen, volle werkplaatsen, en wasgoed dat nooit helemaal droogt.'],
  ['schans',   'De Oude Schans',   'Een vestingwerk dat nergens meer tegen beschermt en waar nu zeshonderd mensen wonen.'],
  ['zoutpoort','De Zoutpoort',     'De landzijde: herbergen, stallen, en iedereen die de stad in of uit wil.'],
  ['drijfhout','Drijfhout',        'Een wijk van vlotten en loopplanken op het water. Verplaatst zichzelf elk jaar een beetje.'],
];
for (const [id, naam, desc] of WIJKEN) {
  L(id, naam, 'Stadswijk', { wijk: 'Veerspoort', wijkId: PRE + 'stad', desc });
}

// ── Plekken ──
// Per wijk een handvol, en met `--schaal` worden het er evenredig meer: de
// namen komen uit twee woordenlijsten, zodat opschalen geen tweehonderd regels
// kost maar één vermenigvuldiging.
const VOORVOEGSEL = ['De Gouden', 'Het Blauwe', 'De Oude', 'Het Stille', 'De Scheve', 'Het Natte',
  'De Laatste', 'Het IJzeren', 'De Blinde', 'Het Zilveren', 'De Dove', 'Het Zwarte'];
const ZELFSTANDIG = ['Anker', 'Aalscholver', 'Kraan', 'Spant', 'Lantaarn', 'Netboet', 'Kaper',
  'Vinnik', 'Baken', 'Sleutel', 'Rib', 'Want', 'Kiel', 'Zeis', 'Pothuis'];
const PLEKSOORT = [
  ['Taveerne',  'Laag, warm en vol. De waard kent elke stamgast bij naam en elke schuld bij bedrag.'],
  ['Winkel',    'Drie planken diep, van vloer tot zoldering gestapeld met wat niemand dagelijks nodig heeft.'],
  ['Werkplaats','Het ruikt er naar vuur en vet. Hier wordt iets gemaakt dat elders alleen wordt verkocht.'],
  ['Herberg',   'Bedden boven, bier beneden, en een hond die niemand voert maar iedereen aait.'],
  ['Tempel',    'Niet groot, wel oud. De tegels liggen hol van het lopen.'],
  ['Pakhuis',   'Hoog, koud en leeg genoeg om een stem te laten terugkomen.'],
  ['Woonhuis',  'Smal en diep, zoals alles hier. De trap is steiler dan hij mag zijn.'],
  ['Plein',     'Vier straten komen hier samen en kunnen het niet eens worden over wie voorrang heeft.'],
];
const plekIds = [];
let plekNr = 0;
for (const [wid, wnaam] of WIJKEN.map(w => [w[0], w[1]])) {
  for (let i = 0; i < 5 * SCHAAL; i++) {
    const [soort, desc] = PLEKSOORT[plekNr % PLEKSOORT.length];
    const naam = `${VOORVOEGSEL[(plekNr * 7) % VOORVOEGSEL.length]} ${ZELFSTANDIG[(plekNr * 5 + 3) % ZELFSTANDIG.length]}`;
    const id = `plek${plekNr}`;
    L(id, naam, soort, { wijk: wnaam, wijkId: PRE + wid, desc });
    plekIds.push(PRE + id);
    plekNr++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MENSEN
// ════════════════════════════════════════════════════════════════════════════
const VOORNAAM = ['Mette', 'Joris', 'Aafke', 'Berent', 'Sieger', 'Willemijn', 'Taco', 'Reinoud',
  'Griet', 'Hidde', 'Loes', 'Evert', 'Saar', 'Wobbe', 'Trijn', 'Menno', 'Doortje', 'Jelle',
  'Marijke', 'Sibbele', 'Nelleke', 'Harmen', 'Bauk', 'Rutger'];
const ACHTERNAAM = ['Scheepmaker', 'Vloed', 'Aalders', 'Zoutman', 'Krabbe', 'Veerman', 'Spant',
  'Droogendijk', 'Kwelder', 'Brak', 'Nettelaar', 'Oosterwind', 'Slikkerveer', 'Haan', 'Mosselman'];
const BEROEP = ['havenmeester', 'schrijver op het stadhuis', 'netboeter', 'zeilmaker', 'geldwisselaar',
  'kaarsenmaker', 'rechter in de lage kamer', 'loods', 'vroedvrouw', 'opzichter van de kraan',
  'hoedenmaker', 'bierbrouwer', 'klokkenluider', 'lijkbezorger', 'kuiper', 'zoutzieder'];
const TREK = ['praat met de handen', 'kijkt nooit twee keer dezelfde kant op', 'ruikt naar pek',
  'heeft een lach die te laat komt', 'telt alles hardop', 'draagt altijd handschoenen',
  'noemt iedereen bij de achternaam', 'neuriet zonder het te merken'];

const npcIds = [];
for (let i = 0; i < 30 * SCHAAL; i++) {
  const naam = `${VOORNAAM[i % VOORNAAM.length]} ${ACHTERNAAM[(i * 3 + 1) % ACHTERNAAM.length]}`;
  const id = PRE + 'npc' + i;
  const plek = plekIds[(i * 2) % plekIds.length];
  zet('personages', {
    id, name: naam, subtype: '', icon: '',
    data: {
      rol: BEROEP[i % BEROEP.length],
      desc: `${naam} is ${BEROEP[i % BEROEP.length]} in Veerspoort en ${TREK[i % TREK.length]}. ` +
            `Wie iets van ${naam.split(' ')[0]} wil, komt niet met de deur in huis.`,
      locatieId: plek,
    },
  });
  npcIds.push(id);
}

// ════════════════════════════════════════════════════════════════════════════
//  DE PARTIJEN
// ════════════════════════════════════════════════════════════════════════════
// Vijf groepen die achter dezelfde verborgen schat aan zitten — het patroon van
// een stadscampagne. Elk met een organisatiekaartje, een ladder met rangen en
// gunsten, en een handvol leden uit de lijst hierboven.
const PARTIJEN = [
  ['gilde',   'Het Zoutgilde',         'scale',    'Wie in Veerspoort zout verhandelt, verhandelt met het gilde. Dat is geen wet, maar het werkt wel zo.'],
  ['wacht',   'De Kadewacht',          'shield',   'Geen stadswacht maar een vereniging van pakhuishouders met knuppels en een rooster.'],
  ['orde',    'De Orde van het Baken', 'flame',    'Monniken die het licht onderhouden. Ze weten wie er binnenkomt en wie er nooit meer uitvoer.'],
  ['bank',    'Huis Droogendijk',      'coins',    'Drie generaties geldwisselaars. Ze lenen aan iedereen en vergeten niemand.'],
  ['onderwal','De Onderwal',           'key',      'Bestaat officieel niet. Kent elke kelder, elke sleutel en elke prijs.'],
];
meta.facties = (meta.facties || []).filter(f => !String(f.id || '').startsWith(PRE));
const RANGNAMEN = ['Buitenstaander', 'Bekende', 'Aangenomene', 'Vertrouweling', 'Eerste', 'Sleutelhouder'];
const RENOWN    = [0, 1, 3, 10, 25, 50];
PARTIJEN.forEach(([id, naam, embleem, beschrijving], fi) => {
  const orgId = PRE + 'org_' + id;
  const leden = kiesN(npcIds, 5).map((nid, i) => ({
    naam: (ent.personages.find(p => p.id === nid) || {}).name || '?',
    rol: RANGNAMEN[Math.min(RANGNAMEN.length - 1, 5 - i)], id: nid,
  }));
  zet('organisaties', {
    id: orgId, name: naam, subtype: '', icon: embleem,
    data: { desc: beschrijving, icoon: embleem, betrokkenen: betr(leden), zetel: kies(plekIds) },
  });
  meta.facties.push({
    id: PRE + 'fac_' + id, naam, organisatieId: orgId, embleem,
    beschrijving, renownDrempels: RENOWN, leden: [],
    uitnodiging: `Men heeft uw naam genoemd. Dat gebeurt niet vaak, en zelden twee keer.\n\n— ${naam}`,
    uitnodigingTitel: `Een uitnodiging van ${naam}`,
    rangen: RANGNAMEN.map((rn, i) => ({
      naam: rn, renown: RENOWN[i],
      voordelen: i === 0 ? '' : `Toegang tot wat een ${rn.toLowerCase()} toekomt.`,
      ...(i >= 2 ? { unlocks: [{ type: 'tekst', naam: `Woord van ${naam}`, tekst: 'Een naam om te noemen bij de juiste deur.' }] } : {}),
      ...(i >= 3 ? { vereist: { level: i + 1 } } : {}),
    })),
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AKTES
// ════════════════════════════════════════════════════════════════════════════
// Vier aktes, één per seizoen — dezelfde opbouw als een stadsavontuur dat over
// een jaar loopt. Elke akte krijgt genoeg tekst om de leesweergave en de
// regie-balk te belasten.
const SEIZOENEN = [
  ['lente', 'Hoogwater',      'De rivier staat hoog en de kelders lopen onder. Wat er boven komt drijven had moeten blijven liggen.'],
  ['zomer', 'Het Droge Dok',  'Zes weken geen regen. De kade ligt bloot, en daarmee ook wat eronder lag.'],
  ['herfst','De Stormvloed',  'Het water komt terug, harder dan iemand zich herinnert. Drie wijken staan blank en één partij profiteert.'],
  ['winter','Onder het IJs',  'De monding bevriest. Niemand vaart uit, niemand vaart binnen, en alle rekeningen komen tegelijk.'],
];
meta.hoofdstukken = meta.hoofdstukken || {};
SEIZOENEN.forEach(([sl, titel, kop], i) => {
  const key = PRE + 'akte' + (i + 1);
  meta.hoofdstukken[key] = {
    num: i + 1, title: titel, dag: '', short: `A${i + 1} · ${titel}`,
    bannerFocus: '', bannerImg: '', spelersSamenvatting: kop,
    tekst: `${kop}\n\n` +
      `> Je staat op de ${kies(WIJKEN)[1]} en het ruikt naar wier en teer.\n\n` +
      `De vijf partijen in Veerspoort weten allemaal hetzelfde: er ligt iets onder de stad dat ` +
      `niemand toebehoort. Wat ze niet weten is wie het als eerste bereikt.\n\n` +
      `## Wat er speelt\n\n` +
      WIJKEN.map(w => `- **${w[1]}** — ${w[2]}`).join('\n') + '\n\n' +
      `## Wie er beweegt\n\n` +
      PARTIJEN.map(p => `- **${p[1]}** ${p[3]}`).join('\n') + '\n',
  };
});

// ════════════════════════════════════════════════════════════════════════════
//  DUNGEONS
// ════════════════════════════════════════════════════════════════════════════
// Drie kaarten, waarvan één getekend op een raster — dat is meteen de proef op
// de som voor de teken-editor: een kaart zonder plattegrond met kamers die op
// hele vakjes liggen.
dungeons.maps = (dungeons.maps || []).filter(m => !String(m.id).startsWith(PRE));
const vak = (kx, ky, kol, rij) => [kx / kol * 100, ky / rij * 100];
const KELDER_KAMERS = [
  ['Trapgat',       2,  2,  5,  5], ['De Lange Gang',  5,  3,  18, 4],
  ['Zoutkamer',     18, 1,  24, 7], ['Pompruimte',     7,  7,  12, 12],
  ['Verzonken Zaal',14, 8,  23, 15], ['De Put',         3,  9,  6,  13],
  ['Nis',           12, 4,  14, 6], ['Achterkelder',   19, 15, 25, 19],
];
const KOL = 30, RIJ = 20;
dungeons.maps.push({
  id: PRE + 'dng_kelders', name: 'De Kelders onder de Natte Kade',
  description: 'Wat de stad aan haar voeten heeft en liever vergeet. Verbonden kelders, deels onder water.',
  hoofdstukId: PRE + 'akte1', fileId: '', thumbId: '',
  grid: { kolommen: KOL, rijen: RIJ, voetPerVak: 5 }, stijl: 'riool',
  rooms: KELDER_KAMERS.map(([naam, x1, y1, x2, y2], i) => ({
    id: PRE + 'k' + i, name: naam, shape: i === 5 ? 'ovaal' : 'rect',
    points: [vak(x1, y1, KOL, RIJ), vak(x2, y2, KOL, RIJ)],
    conditions: i % 3 === 0 ? ['enemies'] : i % 3 === 1 ? ['loot'] : [],
    dmNotes: `Aantekening bij ${naam}. Drie regels tekst om de zijbalk te vullen.`,
  })),
  connections: KELDER_KAMERS.slice(0, -1).map((_, i) => ({ from: PRE + 'k' + i, to: PRE + 'k' + (i + 1) })),
  partyAccess: [], reveals: {},
});
for (const [n, naam, stijl] of [[1, 'Het Baken — onderbouw', 'steen'], [2, 'De Grot achter de Schans', 'grot']]) {
  dungeons.maps.push({
    id: PRE + 'dng' + n, name: naam, description: 'Tweede kaart voor de stresstest.',
    hoofdstukId: PRE + 'akte' + (n + 1), fileId: '', thumbId: '',
    grid: { kolommen: 24, rijen: 16, voetPerVak: 5 }, stijl,
    rooms: Array.from({ length: 6 }, (_, i) => ({
      id: PRE + `d${n}k${i}`, name: `Ruimte ${i + 1}`, shape: 'rect',
      points: [vak(2 + i * 3, 2 + (i % 3) * 4, 24, 16), vak(5 + i * 3, 6 + (i % 3) * 4, 24, 16)],
      conditions: [],
    })),
    connections: [], partyAccess: [], reveals: {},
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  BESTIARIUM EN GEVECHTEN
// ════════════════════════════════════════════════════════════════════════════
// Hier ging het de eerste keer mis: de gevechten verwezen naar monsters op
// náám, maar de app koppelt uitsluitend op `monsterId` — `monsters.find(x =>
// x.id === r.monsterId)`. Zestig gevechten zonder statblock, dus 0 XP en
// deelnemers zonder HP. En `monsters.json` staat per campagne: er is geen
// gedeelde SRD-voorraad waar een nieuwe campagne uit put. Een stresstest die
// gevechten maakt, moet dus zijn eigen beesten meebrengen.
const BEESTEN = [
  ['kwelderrat',   'Kwelderrat',           '1/8',  7,  12, 25,   'Beast',      'Tiny'],
  ['kadeschuimer', 'Kadeschuimer',         '1/8',  9,  12, 25,   'Humanoid',   'Medium'],
  ['netduivel',    'Netduivel',            '1/4',  13, 13, 50,   'Beast',      'Small'],
  ['zoutwachter',  'Zoutwachter',          '1/4',  16, 14, 50,   'Humanoid',   'Medium'],
  ['slikkruiper',  'Slikkruiper',          '1/2',  22, 13, 100,  'Monstrosity','Medium'],
  ['havenbonk',    'Havenbonk',            '1/2',  26, 12, 100,  'Humanoid',   'Medium'],
  ['wierwurger',   'Wierwurger',           '1',    32, 13, 200,  'Plant',      'Large'],
  ['drenkeling',   'Drenkeling',           '1',    30, 11, 200,  'Undead',     'Medium'],
  ['pakhuisspook', 'Pakhuisspook',         '2',    45, 14, 450,  'Undead',     'Medium'],
  ['kraanmeester', 'Kraanmeester',         '2',    52, 15, 450,  'Humanoid',   'Medium'],
  ['zeekobold',    'Zeekobold-voorman',    '2',    48, 14, 450,  'Humanoid',   'Small'],
  ['glibbergeest', 'Glibbergeest',         '3',    60, 13, 700,  'Ooze',       'Large'],
  ['vloedhond',    'Vloedhond',            '3',    66, 15, 700,  'Monstrosity','Large'],
  ['sleutelloze',  'De Sleutelloze',       '4',    82, 16, 1100, 'Undead',     'Medium'],
  ['bakenwachter', 'Bakenwachter',         '5',    95, 17, 1800, 'Construct',  'Large'],
  ['stormgeest',   'Stormgeest',           '5',    88, 15, 1800, 'Elemental',  'Large'],
  ['zoutzieder',   'De Zoutzieder',        '6',    110,16, 2300, 'Humanoid',   'Medium'],
  ['kwelderkoning','De Kwelderkoning',     '7',    130,17, 2900, 'Monstrosity','Huge'],
  ['onderwalbaas', 'De Baas van de Onderwal','8',  142,18, 3900, 'Humanoid',   'Medium'],
  ['aaltvorst',    'De Aaltvorst',         '10',   180,19, 5900, 'Dragon',     'Huge'],
];
const CR_GETAL = (cr) => cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr);

// Oudere campagnes hebben `monsters.json` nog als platte array staan (de
// zaadwaarde in storage.js was dat tot 1 okt 2026). Een eigenschap op een array
// zetten gooit JSON.stringify stilzwijgend weg, dus eerst omvormen.
const monsterRuw = lees('monsters.json', { monsters: [] });
const monsters = Array.isArray(monsterRuw) ? { monsters: monsterRuw } : (monsterRuw || { monsters: [] });
if (!Array.isArray(monsters.monsters)) monsters.monsters = [];
monsters.monsters = (monsters.monsters || []).filter(m => !String(m.id).startsWith(PRE));
BEESTEN.forEach(([sl, naam, cr, hp, ac, xp, type, maat]) => {
  monsters.monsters.push({
    id: PRE + 'mon_' + sl, name: naam, maxHp: hp, initiative: 10 + (hp % 7),
    imageId: null, backdropId: null, chapter: '', inBestiarium: true,
    description: `Komt voor in en om Veerspoort. Wie hem tegenkomt, komt hem zelden één keer tegen.`,
    statblock: {
      size: maat, type, alignment: '', ac: String(ac), hp: `${hp}`,
      speed: '9 m', str: 10 + (hp % 9), dex: 10 + (ac % 7), con: 10 + (hp % 5),
      int: 6 + (xp % 9), wis: 8 + (ac % 6), cha: 6 + (hp % 8),
      savingThrows: '', skills: '', damageVulnerabilities: '', damageResistances: '',
      damageImmunities: '', conditionImmunities: '',
      senses: 'passieve Perception 10', languages: '—',
      cr, xp,
      traits: `Thuis in het zout. Geen nadeel op aanvallen in ondiep water.`,
      actions: `Aanval. Melee +${3 + Math.floor(CR_GETAL(cr))}, 1,5 m. Hit: ${3 + Math.ceil(CR_GETAL(cr) * 2)} schade.`,
      reactions: '', legendaryActions: '',
    },
  });
});

// Een ladder die meeloopt met de aktes: lage CR in de lente, zware in de winter.
enc.encounters = (enc.encounters || []).filter(e => !String(e.id).startsWith(PRE));
for (let i = 0; i < 20 * SCHAAL; i++) {
  const akte = Math.min(4, 1 + Math.floor(i / (5 * SCHAAL)));
  const [sl, naam, cr, hp] = BEESTEN[i % BEESTEN.length];
  const crN = CR_GETAL(cr);
  const aantal = crN <= 0.5 ? 4 + (i % 4) : crN <= 2 ? 2 + (i % 2) : 1;
  enc.encounters.push({
    id: PRE + 'enc' + i,
    name: `${kies(['Hinderlaag', 'Treffen', 'Overval', 'Wachtpost', 'Achtervolging'])} — ${naam}`,
    akteId: PRE + 'akte' + akte,
    backdropId: null, canvasPreset: null, canvasColors: null,
    // `monsterId` is wat telt: op naam koppelen doet de app nergens.
    monsters: [{ monsterId: PRE + 'mon_' + sl, name: naam, count: aantal, hp, initiative: 10 + (i % 9) }],
    loot: { goud: { fl: Math.round(crN * 10), kn: 5 + (i % 9), cl: i % 20 }, items: [] },
    dungeonId: i % 5 === 0 ? PRE + 'dng_kelders' : null,
    roomId:    i % 5 === 0 ? PRE + 'k' + (i % 8) : null,
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  VOORWERPEN, MISSIES, DOCUMENTEN
// ════════════════════════════════════════════════════════════════════════════
const VW = [
  ['Zoutzegel van het gilde', 'Wonderous Item', 'uncommon', 'Een loden zegel aan een koord. Deuren die dicht waren, zijn dat niet meer.'],
  ['Peilstok van de loods',   'Wonderous Item', 'common',   'Hij wijst de diepte aan, ook waar geen water staat.'],
  ['Netboetersnaald',         'Weapon',         'common',   'Scherp genoeg om een zeil te hechten of een mouw vast te spelden.'],
  ['Bakenlantaarn',           'Wonderous Item', 'rare',     'Zolang hij brandt, verdwaalt niemand die hem kan zien.'],
  ['Kwelderlaars',            'Armor',          'uncommon', 'Je zakt niet weg, hoe drassig de grond ook is.'],
  ['Wisselbrief op naam',     'Wonderous Item', 'common',   'Honderd florijn, inbaar bij Huis Droogendijk. Eén keer.'],
  ['Sleutel van de Onderwal', 'Wonderous Item', 'rare',     'Past op geen enkel slot dat je kent, en op elk slot dat zij kennen.'],
  ['Stormglas',               'Wonderous Item', 'uncommon', 'De kristallen erin veranderen een etmaal voor het weer dat doet.'],
];
for (let i = 0; i < 8 * SCHAAL; i++) {
  const [naam, itemType, rarity, desc] = VW[i % VW.length];
  zet('voorwerpen', {
    id: PRE + 'vw' + i, name: i < VW.length ? naam : `${naam} (${Math.floor(i / VW.length) + 1})`,
    subtype: '', icon: '',
    data: { itemType, rarity, desc, prijs: JSON.stringify({ fl: 5 + i * 3, kn: 0, cl: 0 }) },
  });
}

quests.quests = (quests.quests || []).filter(q => !String(q.id).startsWith(PRE));
const MISSIES = [
  ['Wie de kraan bedient', 'De opzichter van de kraan is drie dagen niet gezien. Zijn sleutels evenmin.'],
  ['Het zout dat niet aankwam', 'Een lading van veertig vat is onderweg verdampt. Letterlijk, zegt de schipper.'],
  ['Onder de Verzonken Zaal', 'Er klinkt iets onder de vloer dat het ritme van de getijden volgt. Maar het is eb.'],
  ['De vierde generatie', 'Huis Droogendijk zoekt een erfgenaam. Er melden zich er zes.'],
  ['Wat het baken zag', 'De monniken houden een logboek bij van elk schip. Eén nacht ontbreekt.'],
  ['De rekening van de Onderwal', 'Iemand in de party staat bij hen in het krijt. Niemand weet wie.'],
];
for (let i = 0; i < 6 * SCHAAL; i++) {
  const [titel, omschrijving] = MISSIES[i % MISSIES.length];
  quests.quests.push({
    id: PRE + 'q' + i,
    title: i < MISSIES.length ? titel : `${titel} — deel ${Math.floor(i / MISSIES.length) + 1}`,
    description: omschrijving,
    chapter: PRE + 'akte' + Math.min(4, 1 + Math.floor(i / (2 * SCHAAL))),
    notes: 'Aantekening van de DM bij deze missie.',
    geverId: npcIds[(i * 3) % npcIds.length], geverType: 'personages',
    factieId: PRE + 'fac_' + PARTIJEN[i % PARTIJEN.length][0],
    renownBeloning: 1 + (i % 3),
    createdAt: new Date().toISOString(),
  });
}

for (let i = 0; i < 6 * SCHAAL; i++) {
  zet('documenten', {
    id: PRE + 'doc' + i, name: `Stuk ${i + 1} uit het stadsarchief van Veerspoort`,
    subtype: '', icon: '',
    data: {
      docType: kies(['Brief', 'Verslag', 'Register', 'Aanplakbiljet']),
      desc: `Een afschrift uit de lage kamer, gedateerd op de ${1 + (i % 28)}e. ` +
            `Het handschrift is dat van een klerk die haast had.`,
      tekst: `Aan wie het aangaat,\n\nDe ondergetekende verklaart dat het gestelde omtrent de ` +
             `${kies(['kade', 'kraan', 'sluis', 'bakenkamer'])} niet overeenkomt met hetgeen ` +
             `hij met eigen ogen heeft waargenomen.\n\n— ${kies(VOORNAAM)} ${kies(ACHTERNAAM)}`,
    },
  });
}

// ── Opslaan ─────────────────────────────────────────────────────────────────
bewaar('entities.json', ent);
bewaar('meta.json', meta);
bewaar('encounters.json', enc);
bewaar('quests.json', quests);
bewaar('dungeon-maps.json', dungeons);
bewaar('monsters.json', monsters);

const tel = (soort) => (ent[soort] || []).filter(x => String(x.id).startsWith(PRE)).length;
console.log(`\nStresstest voor "${campagne}" op schaal ${SCHAAL}:`);
console.log(`  locaties      ${tel('locaties')}`);
console.log(`  personages    ${tel('personages')}`);
console.log(`  organisaties  ${tel('organisaties')}`);
console.log(`  voorwerpen    ${tel('voorwerpen')}`);
console.log(`  documenten    ${tel('documenten')}`);
console.log(`  facties       ${(meta.facties || []).filter(f => String(f.id || '').startsWith(PRE)).length}`);
console.log(`  aktes         ${Object.keys(meta.hoofdstukken || {}).filter(k => k.startsWith(PRE)).length}`);
console.log(`  dungeons      ${(dungeons.maps || []).filter(m => String(m.id).startsWith(PRE)).length}`);
console.log(`  monsters      ${(monsters.monsters || []).filter(m => String(m.id).startsWith(PRE)).length}`);
console.log(`  gevechten     ${(enc.encounters || []).filter(e => String(e.id).startsWith(PRE)).length}`);
console.log(`  missies       ${(quests.quests || []).filter(q => String(q.id).startsWith(PRE)).length}`);

wegschrijven();

function wegschrijven() {
  if (!schrijfMode && !wegMode) {
    console.log('\nProefdraai — niets geschreven. Voeg --schrijf toe om het echt te doen.');
    return;
  }
  for (const [f, o] of Object.entries(teSchrijven)) {
    const p = path.join(base, f);
    const bak = p + '.voor-stresstest.bak';
    if (fs.existsSync(p) && !fs.existsSync(bak)) fs.copyFileSync(p, bak);
    fs.writeFileSync(p, JSON.stringify(o, null, 2));
  }
  console.log('\nGeschreven, met backups ernaast (*.voor-stresstest.bak).');
}
