#!/usr/bin/env node
// Een testomgeving met lege tabbladen test niets: je ziet niet of een ladder
// klopt als er geen rangen zijn, en niet of de post werkt als er geen brief ligt.
// Dit vult de dienstenkant van een demo-campagne met genoeg om overal iets te
// zien — en het is idempotent, dus je kunt het na elke wijziging opnieuw draaien.
//
// Wat het legt:
//   • factieladders met renown per rang en gunsten van elk soort
//   • renown en zichtbaarheid voor de party's, zodat de ladder ook loopt
//   • begroetingstafels voor de herberg, de tempel en de detective
//   • post: een paar brieven per speler, in verschillende handschriften
//   • missies op het prikbord, in elke kolom een
//   • roddels op kaartjes, zodat de herberg iets te vertellen heeft
//
//   node scripts/demo-diensten-vullen.js <campagne> [--basis <pad>] [--schrijf]
const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const VLAG = new Set(['--basis']);
const vrij = args.filter((a, i) => !a.startsWith('--') && !VLAG.has(args[i - 1]));
const campagne = vrij[0];
const schrijfMode = args.includes('--schrijf');
const basisArg = args.includes('--basis') ? args[args.indexOf('--basis') + 1] : null;
if (!campagne) {
  console.error('Gebruik: node scripts/demo-diensten-vullen.js <campagne> [--basis <pad>] [--schrijf]');
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
const schrijf = (f, o) => { teSchrijven[f] = o; };

const ent    = lees('entities.json', { personages: [], locaties: [], organisaties: [], voorwerpen: [] });
const meta   = lees('meta.json', {});
const dm     = lees('dm-state.json', { groups: {} });
const tafels = lees('tables.json', { tables: [] });
const post   = lees('berichten.json', {});
const quests = lees('quests.json', { quests: [] });

const spelers = (ent.personages || []).filter(p => p.subtype === 'speler');
const groepen = Object.keys(dm.groups || {});
if (!spelers.length) { console.error('Deze campagne heeft geen spelerspersonages; vul eerst de kaartjes.'); process.exit(1); }
const actief = dm.activeGroup || groepen[0];

const vw = (naam) => (ent.voorwerpen || []).find(v => (v.name || '').toLowerCase() === naam.toLowerCase());
const loc = (id) => (ent.locaties || []).find(l => l.id === id);
const org = (id) => (ent.organisaties || []).find(o => o.id === id);

// ── 1. Tafels: begroetingen en weetjes ──────────────────────────────────────
// Een tafel is een voorraad regels waar de app er één uit kiest. Zonder tafel
// zegt elke waard elke avond hetzelfde, en dan test je de variatie niet.
const tafelZet = (id, name, entries) => {
  tafels.tables = tafels.tables || [];
  const i = tafels.tables.findIndex(t => t.id === id);
  const t = { id, name, type: 'simple', entries };
  if (i >= 0) tafels.tables[i] = { ...tafels.tables[i], ...t }; else tafels.tables.push(t);
  return id;
};
const tHerberg = tafelZet('t_tab_herberg', 'Begroeting — De Gouden Gans', [
  'Bram veegt een kroes droog. "Ga zitten, {naam}. Het duurt nog even voor het donker is."',
  'De waard knikt naar de haard. "Er is nog soep, en er is nog plek."',
  '"Jij weer," zegt Bram. Het klinkt niet onvriendelijk.',
  'Iemand schuift op zonder op te kijken. Er is plaats aan de lange tafel.',
]);
const tTempel = tafelZet('t_tab_tempel', 'Begroeting — Zuster Alwine', [
  'Zuster Alwine buigt licht. "De dageraad kent geen haast, {naam}."',
  'Ze legt haar werk neer. "Je komt op een goed uur."',
  '"Steek een kaars aan als je iets te zeggen hebt dat je niet hardop wilt zeggen."',
]);
const tWeetjes = tafelZet('t_tab_weetjes', 'Weetjes — De detective', [
  '{naam} betaalt al maanden iemand anders om zijn post op te halen.',
  '{naam} is drie keer gezien bij een deur waar hij niets te zoeken had.',
  '{naam} heeft een schuld staan die hij met niemand besproken heeft.',
  'Over {naam} wordt gezegd dat hij ooit een andere naam droeg.',
  '{naam} slaapt slecht en loopt dan langs het water.',
]);

// ── 2. Factieladders ────────────────────────────────────────────────────────
// Elke rang draagt zijn eigen drempel, en de gunsten dekken alle vijf soorten
// zodat je in één campagne kunt zien wat ze doen.
const zwaard = vw('Kortzwaard') || vw('Dagger') || (ent.voorwerpen || [])[0];
const winkel = (ent.locaties || []).find(l => l.data?.locType === 'Winkel');
const bondgenoot = (ent.personages || []).find(p => p.subtype !== 'speler' && p.subtype !== 'dier');

const ladder = (namen, gunstenPerRang) => namen.map((naam, i) => ({
  naam,
  renown: [0, 1, 3, 10, 25, 50][i] ?? i,
  voordelen: '',
  ...(gunstenPerRang[i] ? { unlocks: gunstenPerRang[i] } : {}),
  ...(i === 3 ? { vereist: { level: 5, missies: 1 } } : {}),
}));

meta.facties = (meta.facties || []).map(f => {
  if (f.id === 'vlasgilde') {
    return { ...f, rangen: ladder(
      ['Buitenstaander', 'Aangenomene', 'Vlasser', 'Meesterknecht', 'Gildebroeder', 'Deken'],
      [null,
       [{ type: 'tekst', naam: 'Onderdak', tekst: 'Een strozak op de gildezolder, zolang je je gedraagt.' }],
       [{ type: 'verkoper', entityId: winkel?.id, naam: winkel?.name || 'De kramerij' }],
       [{ type: 'voorwerp', entityId: zwaard?.id, naam: zwaard?.name, aantal: 1 }],
       [{ type: 'titel', titel: 'Gildebroeder van het Vlas' }],
       [{ type: 'metgezel', entityId: bondgenoot?.id, naam: bondgenoot?.name, duur: 'langeRust', cooldown: 'akte' }]],
    ) };
  }
  if (f.id === 'schaduwhand') {
    return { ...f, rangen: ladder(
      ['Onbekend', 'Loopjongen', 'Vinger', 'Hand', 'Schaduw', 'Naamloze'],
      [null,
       [{ type: 'tekst', naam: 'Een deur', tekst: 'Er is altijd één deur die voor je open staat. Welke, hangt van de avond af.' }],
       [{ type: 'tekst', naam: 'Namen', tekst: 'Je mag één naam vragen per akte. Eén.' }],
       [{ type: 'voorwerp', entityId: zwaard?.id, naam: zwaard?.name, aantal: 1 }],
       [{ type: 'titel', titel: 'Schaduw van het Havenkwartier' }],
       [{ type: 'tekst', naam: 'Niemand', tekst: 'Je naam staat nergens meer. Dat is de gunst en de prijs.' }]],
    ) };
  }
  return f;
});

// De ladder moet ook lópen: de actieve party kent beide facties en heeft wat
// aanzien bij de eerste. Anders zie je alleen lege treden.
if (!dm.groups) dm.groups = {};
for (const gid of groepen) {
  const g = dm.groups[gid];
  g.factieZichtbaar = { ...(g.factieZichtbaar || {}), vlasgilde: true, schaduwhand: gid === actief };
  g.factieRenown    = { ...(g.factieRenown || {}), vlasgilde: gid === actief ? 6 : 1 };
}

// ── 3. Diensten koppelen aan hun tafels ─────────────────────────────────────
meta.herberg = { ...(meta.herberg || {}), groetTafelId: tHerberg, roddelsPerSpeler: 2 };
if (meta.tempel?.goden?.[0]) meta.tempel.goden[0].groetTafelId = tTempel;
meta.gock = { ...(meta.gock || {}), tidbitTafelId: tWeetjes, prijs: meta.gock?.prijs || { fl: 25 }, geruchtPrijs: { fl: 40 } };

// ── 4. Post ─────────────────────────────────────────────────────────────────
// Eén brief per speler plus één aan de hele party, in verschillende
// handschriften — zo zie je meteen of de opmaak per stijl klopt.
const brieven = [
  { titel: 'Een openstaande rekening', afzender: 'Doortje Wever', briefstijl: 'hand',
    tekst: 'Het gilde rekent nog op drie bundels vlas. Wij zijn geduldig, maar wij zijn niet vergeetachtig.\n\nKom langs voor de markt sluit.' },
  { titel: 'Zonder ondertekening', afzender: '', briefstijl: 'knipsel', thema: 'heeren',
    tekst: 'Je bent gezien bij de derde brug.\n\nDat is geen dreigement. Het is een mededeling.' },
  { titel: 'Van de wacht', afzender: 'De Stadswacht van Wolkenrode', briefstijl: 'drukwerk',
    tekst: 'Hierbij wordt u aangezegd dat het dragen van zichtbare wapens binnen de marktmuren is verboden tussen zonsopgang en sluitingsuur.\n\nDe wacht wenst u een voorspoedige dag.' },
];
let nBrief = 0;
spelers.forEach((sp, i) => {
  post[sp.id] = post[sp.id] || [];
  const b = brieven[i % brieven.length];
  if (post[sp.id].some(m => m.titel === b.titel)) return;
  post[sp.id].unshift({
    id: `post_demo_${sp.id}_${i}`,
    type: 'brief', titel: b.titel, tekst: b.tekst, afzender: b.afzender,
    briefstijl: b.briefstijl, thema: b.thema || '',
    datum: '4 Grasmaand MDCCLXXII',
    entityId: null, entityType: null,
    timestamp: Date.now() - (i + 1) * 3600000, deletedAt: null,
  });
  nBrief++;
});

// ── 5. Missies ──────────────────────────────────────────────────────────────
// In elke kolom één, zodat het prikbord niet leeg is en je kunt slepen.
const missies = [
  { id: 'q_demo_vlas',   title: 'De verdwenen vracht',  factieId: 'vlasgilde',   renownBeloning: 3, status: 'actief',
    description: 'Drie balen vlas zijn tussen de kade en het pakhuis verdwenen. Het gilde wil weten waar, niet wie.' },
  { id: 'q_demo_brug',   title: 'Wie loopt er bij de derde brug?', factieId: 'schaduwhand', renownBeloning: 2, status: 'verborgen',
    description: 'Iemand telt daar de nachten mee. De Schaduwhand wil weten voor wie.' },
  { id: 'q_demo_kaatje', title: 'Het bier van De Zeearend', factieId: null, renownBeloning: 0, status: 'in-uitvoering',
    description: 'Kaatje Zeegras mist een vat. Ze noemt het geen diefstal, maar ze noemt het ook geen vergissing.' },
  { id: 'q_demo_oud',    title: 'De rekening van vorig jaar', factieId: 'vlasgilde', renownBeloning: 1, status: 'voltooid',
    description: 'Afgehandeld. Het gilde heeft betaald, met tegenzin.' },
];
quests.quests = quests.quests || [];
let nMissie = 0;
for (const m of missies) {
  const i = quests.quests.findIndex(q => q.id === m.id);
  const q = {
    id: m.id, title: m.title, description: m.description, chapter: '', notes: '',
    geverId: null, geverType: 'personages',
    factieId: m.factieId, vereistRenown: 0, renownBeloning: m.renownBeloning, valuta: null,
    createdAt: new Date().toISOString(),
  };
  if (i >= 0) quests.quests[i] = { ...quests.quests[i], ...q }; else { quests.quests.push(q); nMissie++; }
}
// Hun kolom staat per party apart; alleen voor de actieve groep zetten.
const qsPad = path.join(base, 'quest-states');
const qsBestand = path.join(qsPad, `${actief}.json`);
let qs = {};
try { qs = JSON.parse(fs.readFileSync(qsBestand, 'utf8')); } catch {}
for (const m of missies) qs[m.id] = m.status;

// ── 6. Roddels ──────────────────────────────────────────────────────────────
// Met een id, zoals sinds 30 sep overal — anders verschuift de stand zodra er
// een regel bijkomt. Eén per kaartje is genoeg om de herberg te laten praten.
const roddels = {
  t_npc_kaatje:  'Kaatje Zeegras weigert na middernacht nog te tappen, en niemand vraagt waarom.',
  t_npc_doortje: 'Doortje Wever telt haar balen twee keer. Sinds kort drie keer.',
  t_npc_nachtvos:'Van de Nachtvos wordt gezegd dat hij ooit bij de wacht heeft gediend.',
  t_npc_alwine:  'Zuster Alwine bidt elke ochtend voor iemand die niemand kent.',
};
let nRoddel = 0;
for (const [id, tekst] of Object.entries(roddels)) {
  const p = (ent.personages || []).find(x => x.id === id);
  if (!p) continue;
  let lijst = [];
  try { lijst = JSON.parse(p.data?.flavours || '[]'); } catch {}
  if (!Array.isArray(lijst)) lijst = [];
  const bestaat = lijst.some(r => (typeof r === 'object' ? r.tekst : r) === tekst);
  if (bestaat) continue;
  lijst.push({ id: 'f_demo_' + id.slice(-6), tekst });
  p.data = { ...(p.data || {}), flavours: JSON.stringify(lijst) };
  nRoddel++;
}

console.log(`Tafels:   3 (herberg, tempel, weetjes)`);
console.log(`Facties:  ${(meta.facties || []).filter(f => (f.rangen || []).length).length} met een ladder van 6 rangen`);
console.log(`Party's:  ${groepen.length} — renown en zichtbaarheid gezet, actief: ${actief}`);
console.log(`Post:     ${nBrief} nieuwe brieven over ${spelers.length} spelers`);
console.log(`Missies:  ${nMissie} nieuw, ${missies.length} in de kolommen van ${actief}`);
console.log(`Roddels:  ${nRoddel} nieuw`);

if (!schrijfMode) { console.log('\n(proefdraai — voeg --schrijf toe om het door te voeren)'); process.exit(0); }

schrijf('entities.json', ent);
schrijf('meta.json', meta);
schrijf('dm-state.json', dm);
schrijf('tables.json', tafels);
schrijf('berichten.json', post);
schrijf('quests.json', quests);
for (const [f, o] of Object.entries(teSchrijven)) {
  const p = path.join(base, f);
  const bak = p + '.voor-demo.bak';
  if (fs.existsSync(p) && !fs.existsSync(bak)) fs.copyFileSync(p, bak);
  fs.writeFileSync(p, JSON.stringify(o, null, 2));
}
fs.mkdirSync(qsPad, { recursive: true });
fs.writeFileSync(qsBestand, JSON.stringify(qs, null, 2));
console.log('\nGeschreven, met backups ernaast (*.voor-demo.bak).');
