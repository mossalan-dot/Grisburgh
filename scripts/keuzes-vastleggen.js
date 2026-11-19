#!/usr/bin/env node
// **Wat de DM besloot dat een feature je laat kiezen.**
//
// `scripts/feature-keuzes.js` is de **vinder**: die leest de teksten en doet
// een voorstel. Dit is het **besluit**: de tabel hieronder is wat de DM er op
// 19 nov 2026 van gemaakt heeft, vraag voor vraag. Twee bestanden, want het
// zijn twee verschillende dingen — en als ze één bestand waren, zou over een
// jaar niet meer te zien zijn wat een regex gokte en wat iemand koos.
//
// Wat hier in de tabel staat wint dus altijd van het voorstel. Een feature die
// hier níét staat, blijft ongemoeid.
//
//   node scripts/keuzes-vastleggen.js <campagne>             (wat er zou gebeuren)
//   node scripts/keuzes-vastleggen.js <campagne> --schrijf
//
// De sleutel is precies de regel zoals `feature-keuzes.js` hem afdrukt
// ("Wizard / Bladesinger 3 · Training in War and Song"), zodat het rapport en
// deze tabel naast elkaar te leggen zijn.
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

// Korter opschrijven. `s` = skill, `t` = taal, `g` = gereedschap, `sp` = spreuk.
const s  = (aantal, uit, geeft = 'proficiency', label) =>
  ({ soort: 'skill', aantal, ...(uit ? { uit } : {}), geeft, ...(label ? { label } : {}) });
const t  = (aantal = 1, label) => ({ soort: 'language', aantal, ...(label ? { label } : {}) });
const g  = (uit, label) => ({ soort: 'tool', aantal: 1, uit, geeft: 'proficiency', ...(label ? { label } : {}) });
const sp = (uit, label) => ({ soort: 'spell', aantal: 1, ...(uit ? { uit } : {}), ...(label ? { label } : {}) });
const vrij = (uit, label) => ({ soort: 'vrij', aantal: 1, ...(uit ? { uit } : {}), ...(label ? { label } : {}) });
const vorm = (...varianten) => ({ soort: 'variant', aantal: 1, varianten });
const v = (naam, ...keuze) => ({ naam, ...(keuze.length ? { keuze } : {}) });
// Een keuze die maar één dag geldt: de lange rust maakt hem leeg.
const rust = (k) => ({ ...k, bijRust: true });

// De vijf skill-lijsten die meer dan eens voorkomen, één keer opgeschreven.
const SOCIAAL = ['Deception', 'Intimidation', 'Persuasion'];

const BESLUITEN = {
  // ── 1. Eén extra taal naar keuze ──
  // Ook de drie voorwaardelijke (Giant/Draconic "of een andere taal als je die
  // al kent"): in de praktijk vult de speler dan gewoon Giant of Draconic in,
  // en een veld dat er staat is beter dan een regel die niemand leest.
  "Rogue 1 · Thieves' Cant":                             [t()],
  'Half-Elf 1 · Languages':                              [t()],
  'Vedalken 1 · Languages':                              [t()],
  'Verdan 1 · Languages':                                [t()],
  // En hier meteen het geval waar twee keuzes op één kaartje staan: Giant's
  // Power geeft een taal **én** een cantrip. In één blok zou dat "kies maar
  // iets" worden, en dat is geen keuze meer.
  "Barbarian / Path of the Giant 3 · Giant's Power":     [t(1, 'Taal'), sp(['Druidcraft', 'Thaumaturgy'], 'Cantrip')],
  'Monk / Way of the Ascendant Dragon 3 · Draconic Disciple': [t()],
  'Ranger / Drakewarden 3 · Draconic Gift':              [t()],

  // ── 2. Eén skill ──
  'Human 1 · Skillful':                                  [s(1)],
  'Reborn 1 · Knowledge from a Past Life':               [s(1)],
  // "uit de lijst die deze class op level 1 aanbiedt" — die staat al in
  // bronnen/klasse-basis.json, dus niet overtypen.
  'Barbarian 3 · Primal Knowledge':                      [s(1, 'class')],

  // ── 3. Een skill die bij elke lange rust opnieuw gekozen wordt ──
  // `bijRust` zet ze op de Personage-tab in plaats van in de maker: de lange
  // rust maakt ze leeg en de speler kiest bij het ontwaken opnieuw. Dat is wat
  // het boek zegt — "until the end of your next long rest" — en een vast veld
  // zou een stand tonen die morgen niet meer waar is.
  'Githyanki 1 · Astral Knowledge':   [rust(s(1, null, 'proficiency', 'Skill van vandaag')), rust(vrij(null, 'Wapen of gereedschap van vandaag'))],
  'Astral Elf 1 · Astral Trance':     [rust(s(1, null, 'proficiency', 'Skill van vandaag')), rust(vrij(null, 'Wapen of gereedschap van vandaag'))],
  'Kalashtar 1 · Severed from Dreams': [rust(s(1, null, 'proficiency', 'Skill van vandaag'))],

  // ── 4. Twee skills ──
  'Kenku 1 · Kenku Recall':                              [s(2)],
  'Half-Elf 1 · Skill Versatility':                      [s(2)],

  // ── 5. Eerst de vorm, dan pas de keuzes ──
  // Dit is de reden dat `variant` bestaat. Skill Versatility is één van de
  // opties; wie Drow Magic of Fleet of Foot kiest hoort die twee skills níét
  // te krijgen, en zonder deze laag deelde de app ze onvoorwaardelijk uit.
  'Half-Elf / Aquatic Elf Descent 1 · Variant Feature (Choose 1)':
    [vorm(v('Skill Versatility', s(2)), v('Swim'))],
  'Half-Elf / Drow Descent 1 · Variant Feature (Choose 1)':
    [vorm(v('Skill Versatility', s(2)), v('Drow Magic'))],
  'Half-Elf / Moon Elf or Sun Elf Descent 1 · Variant Feature (Choose 1)':
    [vorm(v('Skill Versatility', s(2)), v('Elf Weapon Training'), v('Cantrip', sp()))],
  'Half-Elf / Wood Elf Descent 1 · Variant Feature (Choose 1)':
    [vorm(v('Skill Versatility', s(2)), v('Elf Weapon Training'), v('Fleet of Foot'), v('Mask of the Wild'))],
  'Kobold 1 · Kobold Legacy':
    [vorm(v('Craftiness', s(1, ['Arcana', 'Investigation', 'Medicine', 'Sleight of Hand', 'Survival'])),
          v('Defiance'),
          v('Draconic Sorcery', sp()))],

  // ── 6. Eén skill uit een genoemd lijstje, met wat er verder bij hoort ──
  'Bard / College of the Moon 3 · Primal Lore':
    [s(1, ['Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Survival']), sp(null, 'Druid-cantrip')],
  'Cleric / Nature Domain 3 · Acolyte of Nature':
    [s(1, ['Animal Handling', 'Nature', 'Survival']), sp(null, 'Druid-cantrip')],
  'Fighter / Banneret 3 · Knightly Envoy':
    [s(1, ['Insight', 'Intimidation', 'Performance', 'Persuasion']), t(1, 'Polyglot')],
  "Paladin / Oath of the Noble Genies 3 · Genie's Splendor":
    [s(1, ['Acrobatics', 'Intimidation', 'Performance', 'Persuasion'])],
  'Wizard / Bladesinger 3 · Training in War and Song':
    [s(1, ['Acrobatics', 'Athletics', 'Performance', 'Persuasion'])],
  'Wizard / Enchanter 3 · Enchanting Conversationalist':
    [s(1, SOCIAAL)],
  'Centaur 1 · Natural Affinity':
    [s(1, ['Animal Handling', 'Medicine', 'Nature', 'Survival'])],
  "Leonin 1 · Hunter's Instincts":
    [s(1, ['Athletics', 'Intimidation', 'Perception', 'Survival'])],
  'Shifter 1 · Bestial Instincts':
    [s(1, ['Acrobatics', 'Athletics', 'Intimidation', 'Survival'])],

  // ── 7. Twee skills uit een lijstje ──
  'Changeling 1 · Changeling Instincts':
    [s(2, ['Deception', 'Insight', 'Intimidation', 'Performance', 'Persuasion'])],

  // ── 8. Expertise ──
  'Ranger 2 · Deft Explorer':   [s(1, 'eigen', 'expertise'), t(2)],
  'Ranger 9 · Expertise':       [s(2, 'eigen', 'expertise')],
  'Wizard 2 · Scholar':         [s(1, ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion'], 'expertise')],

  // ── 9. Fighting Style ──
  // De opties staan in de tekst van de feature zelf en verschillen per class,
  // dus ze worden hier per class opgeschreven in plaats van geraden.
  'Bard / College of Swords 3 · Fighting Style':
    [vrij(['Dueling', 'Two-Weapon Fighting'], 'Fighting Style')],
  'Blood Hunter 2 · Fighting Style':
    [vrij(['Archery', 'Dueling', 'Great Weapon Fighting', 'Two-Weapon Fighting'], 'Fighting Style')],

  // ── 10. Artificer: een extra gereedschap ──
  // In het boek krijg je die keuze pas als je het vaste gereedschap al had.
  // Dat kan dit blok niet uitdrukken, dus het veld staat er altijd; wie er
  // niets te kiezen heeft, laat het leeg. Alchemist en Cartographer kunnen er
  // twee geven — de ondergrens is één, en de DM mag dat ophogen.
  'Artificer / Alchemist 3 · Tools of the Trade':        [g('ambacht', "Artisan's Tools")],
  'Artificer / Armorer 3 · Tools of the Trade':          [g('ambacht', "Artisan's Tools")],
  'Artificer / Artillerist 3 · Tools of the Trade':      [g('ambacht', "Artisan's Tools")],
  'Artificer / Battle Smith 3 · Tools of the Trade':     [g('ambacht', "Artisan's Tools")],
  'Artificer / Cartographer 3 · Tools of the Trade':     [g('ambacht', "Artisan's Tools")],
  "Artificer / Reanimator 3 · Reanimator's Skill Set":   [g('ambacht', "Artisan's Tools")],

  // ── 11. Twee keuzes in één feature ──
  'Rogue / Mastermind 3 · Master of Intrigue':           [g('spel', 'Gaming Set'), t(2)],

  // ── 12. Een skill óf een taal ──
  // "Alternatively, you learn one language": dat is een vorm met twee
  // mogelijkheden, geen skill met een voetnoot.
  'Fighter / Cavalier 3 · Bonus Proficiency':
    [vorm(v('Een skill', s(1, ['Animal Handling', 'History', 'Insight', 'Performance', 'Persuasion'])),
          v('Een taal', t()))],
  'Fighter / Samurai 3 · Bonus Proficiency':
    [vorm(v('Een skill', s(1, ['History', 'Insight', 'Performance', 'Persuasion'])),
          v('Een taal', t()))],

  // ── 13. Een gereedschap én een skill ──
  'Cleric / Knowledge Domain 3 · Blessings of Knowledge':
    [g('ambacht', "Artisan's Tools"), s(2, ['Arcana', 'History', 'Nature', 'Religion'], 'expertise')],
  'Fighter / Battle Master 3 · Student of War':
    [g('ambacht', "Artisan's Tools"), s(1, 'class')],

  // ── 14. Een instrument ──
  // Cleric / Forge Domain staat hier bewust níét: "heavy armor and smith's
  // tools" is geen keuze, daar valt niets te kiezen.
  'Satyr 1 · Reveler':                                   [g('instrument', 'Musical Instrument')],
};

// ── De regel bij een sleutel zoeken ─────────────────────────────────────────
// Precies dezelfde regel als `feature-keuzes.js` afdrukt, zodat het rapport en
// deze tabel naast elkaar te leggen zijn.
const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));
const gevonden = new Map();

function loop(bron, sub, levels) {
  for (const [lv, arr] of Object.entries(levels || {})) {
    for (const f of (arr || [])) {
      if (!f?.name) continue;
      gevonden.set(`${bron}${sub ? ` / ${sub}` : ''} ${lv} · ${f.name}`, f);
    }
  }
}
for (const [cn, c] of Object.entries(prog.classes || {})) {
  loop(cn, '', c.levels);
  for (const [sn, sc] of Object.entries(c.subclasses || {})) loop(cn, sn, sc.levels);
}
for (const [vn, vd] of Object.entries(prog.species || {})) {
  loop(vn, '', vd.levels);
  for (const [va, vdd] of Object.entries(vd.varianten || {})) loop(vn, va, vdd.levels);
}

const toon = (k) => k.soort === 'variant'
  ? `vorm uit ${k.varianten.map(x => x.naam + (x.keuze ? ` (${x.keuze.map(toon).join(' + ')})` : '')).join(' | ')}`
  : `${k.soort}${k.aantal > 1 ? ` ×${k.aantal}` : ''}`
    + (Array.isArray(k.uit) ? ` uit ${k.uit.length} namen` : k.uit ? ` uit ${k.uit}` : '')
    + (k.geeft ? ` → ${k.geeft}` : '')
    + (k.label ? `  [${k.label}]` : '')
    + (k.bijRust ? '  · opnieuw bij elke lange rust' : '');

let gezet = 0, gemist = 0, gelijk = 0;
for (const [waar, blokken] of Object.entries(BESLUITEN)) {
  const f = gevonden.get(waar);
  if (!f) { console.log(`  ?  ${waar}  — die feature staat niet in deze campagne`); gemist++; continue; }
  const nieuw = blokken.length === 1 ? blokken[0] : blokken;
  if (JSON.stringify(f.keuze) === JSON.stringify(nieuw)) { gelijk++; continue; }
  console.log(`  +  ${waar}`);
  for (const b of blokken) console.log(`       ${toon(b)}`);
  if (schrijf) f.keuze = nieuw;
  gezet++;
}

console.log(`\n${Object.keys(BESLUITEN).length} besluiten · ${gezet} te zetten · ${gelijk} stond er al zo · ${gemist} niet gevonden`);

if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); process.exit(0); }
if (!gezet)   { console.log('Niets te doen.'); process.exit(0); }

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-keuzes.${stempel}.json`));
fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven: ${gezet} features. Kopie ernaast gezet.`);
