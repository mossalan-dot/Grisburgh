#!/usr/bin/env node
// Een roddel per SRD-wezen, afgeleid uit zijn eigen statblok.
//
// De Magizoöloog onthult bij *deels* een gerucht (`roddel`). Die schrijft de DM
// zelf, maar voor de 331 meegeleverde wezens kan de app een eerste regel
// aanreiken — precies zoals we het statblok, de spreuktekst en de class
// features al meeleveren. De DM overschrijft hem met één klik.
//
//   node scripts/srd-2024/srd-roddels.js            # tonen + dekking
//   node scripts/srd-2024/srd-roddels.js --schrijf  # in bronnen/srd-monsters.json
//   node scripts/srd-2024/srd-roddels.js --toon 40  # 40 voorbeelden
//
// **Afgeleid, niet verzonnen.** Elke regel hieronder hangt aan iets dat
// letterlijk in het statblok staat: een trait met een vaste naam, een immunity,
// een zintuig. Vuurt er geen enkele regel, dan komt er géén roddel — liever
// niets dan een verzonnen gerucht in andermans campagne.
//
// **En alleen wat je niet ziet.** Dat is het kwaliteitsfilter. "Hij vliegt" is
// geen roddel: dat merk je zodra hij opstijgt. Een roddel hoort iets te zeggen
// dat je niet kunt aflezen — een zwakte, een gewoonte, iets waar de spelers
// naar kunnen handelen. Vandaar de volgorde: hoe hoger in de lijst, hoe meer
// een regel het waard is om de twee beschikbare plekken te vullen.

const fs   = require('fs');
const path = require('path');

const DOEL = path.join(__dirname, '..', '..', 'bronnen', 'srd-monsters.json');
const schrijf = process.argv.includes('--schrijf');
const toonIdx = process.argv.indexOf('--toon');
const toonN   = toonIdx > -1 ? parseInt(process.argv[toonIdx + 1]) || 25 : 0;

const heeft = (sb, veld, re) => re.test(String(sb?.[veld] || ''));
const trait = (sb, naam) => new RegExp('\\*\\*\\*' + naam, 'i').test(String(sb?.traits || ''));
const actie = (sb, naam) => new RegExp('\\*\\*\\*' + naam, 'i').test(String(sb?.actions || ''));

// Schadesoort → hoe je dat aan tafel zegt.
// Let op: **gif staat er bewust niet in.** Vrijwel elke undead en elke
// construct is er immuun voor, dus "verspil je gif niet aan hem" zou op 120 van
// de 331 wezens komen te staan. Wat overal geldt is geen gerucht.
const SCHADE = {
  fire: 'vuur', cold: 'kou', lightning: 'bliksem', thunder: 'donderslag',
  acid: 'zuur', necrotic: 'grafkou', radiant: 'heilig licht',
  // psychic en force staan er niet in: die zijn niet in één woord te zeggen.
};

// Hoe hoger, hoe liever. Per wezen gaan de twee best scorende regels mee.
const REGELS = [
  // ── Zwakten: het waardevolst wat een magizoöloog kan vertellen ──
  // Sommige wezens dragen hun zwaktes als een lijstje in het statblok
  // (***Vampire Weakness***: Forbiddance, Running Water, Stake to the Heart).
  // Dat is het beste roddelmateriaal dat er is — precies het soort ding waarvoor
  // je naar een geleerde gaat — dus die gaat voor alles.
  { id: 'lijstzwakte', test: sb => /\*\*\*[^*]*Weakness\.?\*\*\*[\s\S]{0,60}(has these weaknesses|these weaknesses)/i.test(String(sb.traits || '')),
    tekst: (sb) => {
      const t = String(sb.traits);
      const blok = t.slice(t.search(/\*\*\*[^*]*Weakness/i), t.search(/\*\*\*[^*]*Weakness/i) + 700);
      const stukken = [];
      if (/forbiddance/i.test(blok))     stukken.push('hij komt een huis niet binnen zonder dat iemand hem vraagt');
      if (/running water/i.test(blok))   stukken.push('stromend water verteert hem');
      if (/stake to the heart/i.test(blok)) stukken.push('een staak door het hart is het einde');
      if (/sunlight/i.test(blok))        stukken.push('de zon verbrandt hem');
      if (!stukken.length) return 'Hij heeft zijn zwaktes, en wie ze kent heeft het makkelijker dan wie ze zoekt.';
      // Niet zelf een aantal noemen: hoeveel zwaktes er in het lijstje staan
      // verschilt per wezen, en "drie dingen" gevolgd door vier leest als een
      // fout — wat het ook is.
      const laatste = stukken.pop();
      return 'Wat je van hem moet weten: ' + (stukken.length ? stukken.join(', ') + ', en ' + laatste : laatste) + '.';
    } },

  { id: 'zonlicht', test: sb => trait(sb, 'Sunlight (Sensitivity|Hypersensitivity|Weakness)'),
    tekst: () => 'Breng hem in de volle zon en hij knijpt zijn ogen dicht; wat hij daar doet, doet hij half.' },

  { id: 'regeneratie', test: sb => trait(sb, 'Regeneration'),
    tekst: (sb) => {
      const t = String(sb.traits);
      const m = t.match(/\*\*\*Regeneration[\s\S]{0,300}?/i) && t.slice(t.search(/\*\*\*Regeneration/i), t.search(/\*\*\*Regeneration/i) + 320);
      const stop = /fire|vuur/i.test(m) && /acid/i.test(m) ? 'vuur of zuur'
        : /fire/i.test(m) ? 'vuur' : /acid/i.test(m) ? 'zuur' : /radiant/i.test(m) ? 'heilig licht' : null;
      return stop
        ? `Neerslaan is niet genoeg — hij trekt zichzelf weer dicht. Alleen ${stop} houdt de wond open.`
        : 'Neerslaan is niet genoeg: wat je opent, groeit weer dicht.';
    } },

  { id: 'doodsknal', test: sb => trait(sb, '(Death Burst|Death Throes)'),
    tekst: () => 'Sta niet naast hem als hij valt. Dat is het moment waarop de meeste mensen gewond raken.' },

  { id: 'schijngestalte', test: sb => trait(sb, 'False Appearance'),
    tekst: () => 'Zolang hij niet beweegt is hij niet van het echte werk te onderscheiden. Wie te lang naar hetzelfde meubel kijkt, heeft gelijk.' },

  // ── Tactiek: hoe hij vecht, niet wat hij is ──
  { id: 'roedel', test: sb => trait(sb, 'Pack Tactics'),
    tekst: () => 'Hij valt nooit alleen aan. Het is de tweede die je pakt, terwijl je naar de eerste kijkt.' },

  { id: 'vastgrijpen', test: sb => trait(sb, '(Adhesive|Grappler)') || actie(sb, '(Engulf|Swallow)'),
    tekst: () => 'Wat hij te pakken krijgt, laat hij niet meer los — en dan helpt alleen iemand anders.' },

  { id: 'spinklim', test: sb => trait(sb, 'Spider Climb'),
    tekst: () => 'Kijk omhoog. Muren en plafonds zijn voor hem gewoon vloeren.' },

  { id: 'webloper', test: sb => trait(sb, 'Web Walker'),
    tekst: () => 'Zijn eigen web houdt jou wel tegen en hem niet.' },

  { id: 'doorMuren', test: sb => trait(sb, 'Incorporeal Movement'),
    tekst: () => 'Een deur sluiten heeft geen zin. Hij komt dwars door de muur, al doet steen hem pijn.' },

  { id: 'graaft', test: sb => trait(sb, 'Tunneler') || heeft(sb, 'speed', /burrow/i),
    tekst: () => 'Hij komt van onderen. Op losse grond hoor je hem pas als het te laat is.' },

  // ── Wat niet werkt tegen hem ──
  { id: 'geenAngst', test: sb => /charmed|frightened/i.test(String(sb.conditionImmunities || '')),
    tekst: (sb) => {
      const s = String(sb.conditionImmunities).toLowerCase();
      const beide = /charmed/.test(s) && /frightened/.test(s);
      return beide
        ? 'Praten helpt niet en dreigen ook niet — hij is voor geen van beide gevoelig.'
        : (/charmed/.test(s)
            ? 'Hij is met geen woord of blik te bespelen; dat is bij hem al geprobeerd.'
            : 'Bang maken werkt niet. Hij kent het woord niet.');
    } },

  // ── Hoe hij jou vindt ──
  { id: 'trilling', test: sb => /tremorsense/i.test(String(sb.senses || '')),
    tekst: () => 'Hij voelt je lopen. Wie stil blijft staan, bestaat voor hem even niet.' },

  { id: 'waarZicht', test: sb => /truesight/i.test(String(sb.senses || '')),
    tekst: () => 'Vermommingen en illusies werken niet: hij ziet dwars door alles heen wat je optrekt.' },

  { id: 'neus', test: sb => trait(sb, 'Keen (Smell|Hearing and Smell|Senses|Sight and Smell)'),
    tekst: () => 'Hij ruikt je voordat hij je ziet. Tegen de wind in nader je hem niet ongezien.' },

  // ── Waar hij is ──
  { id: 'water', test: sb => trait(sb, 'Amphibious'),
    tekst: () => 'Boven of onder water maakt hem niets uit; hij ademt allebei. In het water heb jij de haast, hij niet.' },

  { id: 'telepathie', test: sb => /telepathy/i.test(String(sb.languages || '')),
    tekst: () => 'Hij praat zonder zijn mond te bewegen, rechtstreeks in je hoofd. Wat je terugdenkt, hoort hij ook.' },

  { id: 'zwerm', test: sb => trait(sb, 'Swarm'),
    tekst: () => 'Eén klap raakt er tien en dat verandert niets. Hoe minder ervan over is, hoe minder ze kunnen.' },

  // ── Algemeen: vult alleen een plek op als er niets beters is ──
  { id: 'geenSlaap', test: sb => trait(sb, '(Construct|Undead|Elemental|Plant) Nature'),
    tekst: () => 'Hij eet niet, slaapt niet en wacht zonder moe te worden. Uitzitten is geen plan.' },

  { id: 'magieAf', test: sb => trait(sb, 'Magic Resistance'),
    tekst: () => 'Spreuken glijden van hem af alsof ze voor iemand anders bedoeld waren. Neem staal mee.' },


  // Alleen soorten die als zelfstandig naamwoord in de zin passen. 'Force' en
  // 'psychic' laten zich niet in één woord zeggen ("verspil je pure kracht
  // niet aan hem" loopt niet), dus die vallen weg in plaats van krom te worden.
  { id: 'immuun', test: sb => {
      const s = String(sb.damageImmunities || '').toLowerCase();
      return Object.keys(SCHADE).some(k => s.includes(k));
    },
    tekst: (sb) => {
      const s = String(sb.damageImmunities).toLowerCase();
      const soorten = Object.entries(SCHADE).filter(([k]) => s.includes(k)).map(([, v]) => v).slice(0, 2);
      if (!soorten.length) return null;
      return soorten.length > 1
        ? `${soorten[0][0].toUpperCase()}${soorten[0].slice(1)} en ${soorten[1]} doen hem niets; zoek iets anders.`
        : `${soorten[0][0].toUpperCase()}${soorten[0].slice(1)} doet hem niets; zoek iets anders.`;
    } },


  { id: 'blindZicht', test: sb => /blind beyond|blindsight/i.test(String(sb.senses || '')),
    tekst: (sb) => /blind beyond/i.test(String(sb.senses))
      ? 'Hij is blind, dus verstoppen heeft geen zin: hij merkt je op een andere manier op. Stilstaan evenmin.'
      : 'Donker maakt voor hem niets uit; een lamp doven verbergt je niet.' },

];

const j = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
const lijst = Array.isArray(j) ? j : Object.values(j);

let gevuld = 0, alGevuld = 0;
const zonder = [];
const perRegel = new Map();
const voorbeelden = [];

for (const x of lijst) {
  if ((x.roddel || '').trim()) { alGevuld++; continue; }
  const sb = x.statblock || {};
  const raak = [];
  for (const r of REGELS) {
    let hit = false;
    try { hit = r.test(sb); } catch { hit = false; }
    if (hit) raak.push(r);
    if (raak.length === 2) break;
  }
  if (!raak.length) { zonder.push(x.name); continue; }
  const delen = raak.map(r => r.tekst(sb)).filter(Boolean);
  if (!delen.length) { zonder.push(x.name); continue; }
  const tekst = delen.join(' ');
  x.roddel = tekst;
  raak.forEach(r => perRegel.set(r.id, (perRegel.get(r.id) || 0) + 1));
  gevuld++;
  voorbeelden.push([x.name, tekst]);
}

console.log(`wezens: ${lijst.length} · een roddel gekregen: ${gevuld} · had er al een: ${alGevuld} · geen enkele regel raakte: ${zonder.length}`);
console.log(`dekking: ${Math.round(gevuld / lijst.length * 100)}%\n`);
console.log('per regel:');
[...perRegel].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log(`  ${String(n).padStart(3)}  ${id}`));

if (toonN) {
  console.log('\nvoorbeelden:');
  const stap = Math.max(1, Math.floor(voorbeelden.length / toonN));
  for (let i = 0; i < voorbeelden.length && i / stap < toonN; i += stap) {
    console.log(`  ${voorbeelden[i][0]}\n    ${voorbeelden[i][1]}`);
  }
}
if (zonder.length) console.log(`\nzonder roddel (${zonder.length}): ${zonder.slice(0, 25).join(', ')}${zonder.length > 25 ? ' …' : ''}`);

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe)'); process.exit(0); }
fs.writeFileSync(DOEL, JSON.stringify(j, null, 1));
console.log(`\nGeschreven: bronnen/srd-monsters.json (${Math.round(fs.statSync(DOEL).size / 1024)} kB)`);
