#!/usr/bin/env node
// De helpteksten als markdown — en weer terug.
//
// Uitleg leeft op twee plekken: `HELP_CONFIG` in `public/js/app.js` is de
// standaardtekst die elke campagne meekrijgt, en `dmState.helpContent[sleutel]`
// is wat déze campagne er zelf van gemaakt heeft. Om ze te kunnen bijschaven
// moet je ze eerst naast elkaar kunnen lezen, en daarvoor is een `.md` nu
// eenmaal prettiger dan achtenveertig arrow-functies in een bestand van
// veertienduizend regels.
//
//   node scripts/helpteksten.js <campagne>                  # naar docs/helpteksten.md
//   node scripts/helpteksten.js <campagne> --uit <pad.md>   # ergens anders heen
//   node scripts/helpteksten.js <campagne> --lees <pad.md>  # tonen wat er zou veranderen
//   node scripts/helpteksten.js <campagne> --lees <pad.md> --schrijf
//
// Bij `--schrijf` gaat alleen wat je **veranderd** hebt naar
// `dmState.helpContent`; een tekst die nog gelijk is aan de standaard uit de
// code wordt niet vastgelegd (en een override die je weer gelijk máákt aan de
// standaard verdwijnt juist). Zo blijft `dm-state.json` alleen de afwijkingen
// bevatten en profiteert de campagne van latere verbeteringen in de code.
//
// Kopie ernaast bij --schrijf: dm-state.voor-help.<datum>.json

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const args     = process.argv.slice(2);
const campagne = args.find(a => !a.startsWith('--'));
const schrijf  = args.includes('--schrijf');
// `indexOf` geeft -1 als de vlag er niet staat, en `args[0]` is dan de
// campagnenaam: zonder deze controle schreef het script naar een bestand dat
// letterlijk "grisburgh" heette in plaats van naar docs/helpteksten.md.
const uitPad   = args.includes('--uit') ? args[args.indexOf('--uit') + 1] : null;
const leesPad  = args.includes('--lees') ? args[args.indexOf('--lees') + 1] : null;

if (!campagne) {
  console.error('Gebruik: node scripts/helpteksten.js <campagne> [--uit <pad.md>] [--lees <pad.md> [--schrijf]]');
  process.exit(1);
}

const wortel  = path.join(__dirname, '..');
const dataDir = process.env.GRISBURGH_DATA_DIR || path.join(wortel, 'data');
const padState = path.join(dataDir, 'campaigns', campagne, 'dm-state.json');
if (!fs.existsSync(padState)) { console.error('Niet gevonden: ' + padState); process.exit(1); }

// ── De standaardteksten uit app.js halen ────────────────────────────────────
//
// HELP_CONFIG is een object van arrow-functies die een object teruggeven. We
// knippen het blok eruit en voeren het uit in een sandbox: de teksten gebruiken
// `window._campagneNaam()` en dat soort helpers, dus die stubben we. Bewust
// uitvoeren en niet met een regex uitlezen — het zijn template literals, en een
// regex die JavaScript probeert te lezen gaat een keer stuk op een accolade in
// een tekst.
// Waar sluit de accolade die op `van` opengaat? Accolades tellen kan alleen als
// je weet wanneer een `{` géén accolade is: in een string, in een template
// literal, of in commentaar. Dat laatste is hier geen luxe — het blok begint met
// een uitleg van zes regels waarin backticks en apostrofs staan, en één
// apostrof die als quote gelezen wordt zet de hele telling scheef.
// Een template literal is geen platte string: in `${…}` staat weer code, en
// daarin kan opnieuw een template literal zitten. Daarom roepen `blokEinde` en
// `leesTemplate` elkaar aan — één functie met een vlaggetje leest de sluitende
// backtick na een `${…}` als een nieuwe openende.
function blokEinde(bron, van) {
  let diep = 0;
  for (let i = van; i < bron.length; i++) {
    const c = bron[i], twee = c + bron[i + 1];
    if (twee === '//') { i = bron.indexOf('\n', i); if (i < 0) break; continue; }
    if (twee === '/*') { const e = bron.indexOf('*/', i + 2); if (e < 0) break; i = e + 1; continue; }
    if (c === '`') { const e = leesTemplate(bron, i); if (e < 0) break; i = e; continue; }
    if (c === "'" || c === '"') {
      for (i++; i < bron.length && bron[i] !== c; i++) if (bron[i] === '\\') i++;
      continue;
    }
    if (c === '{') diep++;
    else if (c === '}') { diep--; if (diep === 0) return i + 1; }
  }
  return -1;
}

// `i` staat op de openende backtick; geeft de index van de sluitende terug.
function leesTemplate(bron, i) {
  for (i++; i < bron.length; i++) {
    if (bron[i] === '\\') { i++; continue; }
    if (bron[i] === '`') return i;
    if (bron[i] + bron[i + 1] === '${') {
      const e = blokEinde(bron, i + 1);   // de accolade van ${
      if (e < 0) return -1;
      i = e - 1;
    }
  }
  return -1;
}

function standaardTeksten() {
  const bron = fs.readFileSync(path.join(wortel, 'public', 'js', 'app.js'), 'utf8');
  const start = bron.indexOf('const HELP_CONFIG = {');
  if (start < 0) throw new Error('HELP_CONFIG niet gevonden in app.js');
  const blokStart = bron.indexOf('{', start);
  const eind = blokEinde(bron, blokStart);
  if (eind < 0) throw new Error('Einde van HELP_CONFIG niet gevonden');

  const nep = new Proxy({}, { get: () => (() => 'de campagne') });
  const sandbox = {
    window: new Proxy({
      _campagneNaam: () => 'de campagne',
      _factiesLabel: () => 'Facties & Aanzien',
      _muntNamen:    () => ({ fl: 'Gold', kn: 'Silver', cl: 'Copper' }),
    }, { get: (t, k) => (k in t ? t[k] : (() => '…')) }),
    icon: () => '', esc: (s) => s, _campagneNaam: () => 'de campagne',
  };
  vm.createContext(sandbox);
  const cfg = vm.runInContext('(' + bron.slice(blokStart, eind) + ')', sandbox, { timeout: 5000 });

  const uit = {};
  for (const [sleutel, fn] of Object.entries(cfg)) {
    try { uit[sleutel] = typeof fn === 'function' ? fn() : fn; }
    catch (e) { uit[sleutel] = { titel: null, stappen: [], _fout: e.message }; }
  }
  return uit;
}

// ── Waar staat de knop? ─────────────────────────────────────────────────────
//
// De aanroepen zijn `_helpBtn('sleutel')` of `helpBtn('sleutel')`. Voor de
// tabblad-sleutels wordt de naam samengesteld (`hulp_${modus}_${type}_${tab}`);
// die herkennen we aan hun vorm en beschrijven we zelf.
//
// Niet elke sleutel staat letterlijk in zijn aanroep: de kaartjes-tabs doen
// `window._helpBtn?.(type)` met het entiteitstype als sleutel. Die staan
// hieronder met de hand, want "geen aanroep gevonden" moet iets waard blijven —
// een tekst die wél in beeld komt maar hier als ongebruikt te boek staat, is
// een tekst die je op een dag weggooit. De ternary bij de kaart-editor komt er
// vanzelf uit: de regex pakt elke quote binnen de aanroep, niet alleen de
// eerste.
const JS_DIR = path.join(wortel, 'public', 'js');
const DYNAMISCH = {
  'render-campagne.js': {
    regel: /window\._helpBtn\?\.\(type\)/,
    sleutels: ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten'],
    hoe: 'de kaartjes-tab geeft het entiteitstype als sleutel door',
  },
  // Eén bestand kan meer dan één dynamisch patroon hebben, dus een lijst.
  'dm-panel.js': [
    {
      // De subtab-balken stellen hun sleutel samen uit het actieve tabje.
      regel: /hulp: `(inst|dm_geluiden)_\$\{/,
      sleutels: ['inst_campagne', 'inst_partys', 'inst_beheer',
                 'dm_geluiden_decors', 'dm_geluiden_standaard', 'dm_geluiden_spelers'],
      hoe: 'de subtab-balk stelt de sleutel samen uit het actieve tabje',
    },
    {
      // De dienstenbalk doet hetzelfde met de naam van de dienst.
      regel: /hulp: `dm_\$\{_dienstenSubTab\}`/,
      sleutels: ['dm_herberg', 'dm_gokhuis', 'dm_detective', 'dm_waarzegger',
                 'dm_tempel', 'dm_facties', 'dm_magizoo', 'dm_markt', 'dm_toegang'],
      hoe: 'de dienstenbalk stelt de sleutel samen uit de actieve dienst',
    },
  ],
};
function vindplaatsen() {
  const per = {};
  for (const bestand of fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'))) {
    const regels = fs.readFileSync(path.join(JS_DIR, bestand), 'utf8').split('\n');
    const dyn = DYNAMISCH[bestand];
    regels.forEach((r, n) => {
      for (const m of r.matchAll(/_?helpBtn\??\.?\(([^)]*)\)/gi)) {
        for (const q of m[1].matchAll(/'([a-z_0-9]+)'/gi)) (per[q[1]] ||= []).push(`${bestand}:${n + 1}`);
      }
      // Niet elke knop komt uit een letterlijke `helpBtn('x')`. Een sectiekop
      // en een subtabbalk krijgen hun sleutel als argument mee; zonder deze
      // twee patronen meldde het script zeventien knoppen als ontbrekend die er
      // wel degelijk zijn — en dan verdrinkt de enige die het écht is.
      for (const m of r.matchAll(/_dienstSectieKop\([^,]*,[^,]*,\s*'([a-z_0-9]+)'/gi)) {
        (per[m[1]] ||= []).push(`${bestand}:${n + 1} (sectiekop)`);
      }
      // Een `hulp:`-regel kan meer dan één sleutel dragen (een ternair: de ene
      // subtab dit boekje, de andere dat).
      if (/\bhulp:/.test(r)) {
        for (const q of r.matchAll(/'([a-z_][a-z_0-9]*)'/gi)) {
          if (/^(dm_|hulp_)/.test(q[1])) (per[q[1]] ||= []).push(`${bestand}:${n + 1} (subtabbalk)`);
        }
      }
      for (const d of (Array.isArray(dyn) ? dyn : (dyn ? [dyn] : []))) {
        if (!d.regel.test(r)) continue;
        for (const s of d.sleutels) (per[s] ||= []).push(`${bestand}:${n + 1} (${d.hoe})`);
      }
    });
  }
  return per;
}

const OMSCHRIJVING = {
  hulp_kijk:   'Detailvenster van een kaartje (wat een speler leest)',
  hulp_bewerk: 'Kaartjes-editor (alleen de DM)',
};
function omschrijf(sleutel, plaatsen) {
  const m = /^hulp_(kijk|bewerk)_(?:([a-z]+)_)?([a-z]+)$/.exec(sleutel);
  if (m) {
    const modus = OMSCHRIJVING['hulp_' + m[1]];
    const soort = m[2] ? `kaartjes van het type **${m[2]}**` : 'elk soort kaartje (terugval)';
    return `${modus} — ${soort}, tabblad **${m[3]}**. Wordt opgebouwd uit de naam, niet ergens aangeroepen.`;
  }
  if (plaatsen?.length) return `Helpknop in: ${plaatsen.join(', ')}`;
  return 'Geen aanroep gevonden — mogelijk ongebruikt.';
}

// ── Markdown eruit ──────────────────────────────────────────────────────────
function naarMarkdown(standaard, overrides, plaatsen) {
  const sleutels = [...new Set([...Object.keys(standaard), ...Object.keys(overrides)])].sort();
  const r = [];
  r.push('# Helpteksten');
  r.push('');
  r.push('Gegenereerd met `node scripts/helpteksten.js ' + campagne + '`.');
  r.push('');
  r.push('Pas de tekst hieronder aan en voer hem terug met:');
  r.push('');
  r.push('```bash');
  r.push(`node scripts/helpteksten.js ${campagne} --lees docs/helpteksten.md            # tonen wat er verandert`);
  r.push(`node scripts/helpteksten.js ${campagne} --lees docs/helpteksten.md --schrijf  # doorvoeren`);
  r.push('```');
  r.push('');
  r.push('**Wat je mag wijzigen:** de regel achter `Titel:` en de tekst onder elke `###`-kop.');
  r.push('Laat de `##`-regel met de sleutel staan — daar wordt op gematcht. De `>`-regels zijn');
  r.push('aantekeningen en worden genegeerd. Markdown in de tekst mag: `**vet**`, `*cursief*`,');
  r.push('en `[[Naam]]` wordt een link naar een kaartje.');
  r.push('');
  r.push('Elke `###`-kop is één **stap**: de uitleg bladert erdoorheen met pijltjes. Een stap');
  r.push('erbij zetten of weghalen mag, zolang er minstens één overblijft.');
  r.push('');
  r.push(`Teksten die gelijk blijven aan de standaard worden **niet** vastgelegd in deze campagne,`);
  r.push('zodat latere verbeteringen in de code vanzelf doorkomen.');
  r.push('');
  r.push('---');
  r.push('');

  let nAangepast = 0;
  for (const sleutel of sleutels) {
    const std = standaard[sleutel];
    const ov  = overrides[sleutel];
    const nu  = (ov?.stappen?.length ? ov : std) || { titel: null, stappen: [] };
    if (ov?.stappen?.length) nAangepast++;

    r.push('## `' + sleutel + '`');
    r.push('');
    r.push('> ' + omschrijf(sleutel, plaatsen[sleutel]));
    r.push('> Nu: ' + (ov?.stappen?.length
      ? '**aangepast in deze campagne**'
      : (std ? 'de standaard uit de code' : '_alleen in deze campagne, geen standaard_')));
    if (std && ov?.stappen?.length) r.push('> De standaard telt ' + std.stappen.length + ' stap(pen).');
    r.push('');
    r.push('Titel: ' + (nu.titel || ''));
    r.push('');
    for (const stap of (nu.stappen || [])) {
      r.push('### ' + (stap.titel || ''));
      r.push('');
      r.push(String(stap.tekst || '').trim());
      r.push('');
    }
    r.push('---');
    r.push('');
  }
  r.unshift('');
  r.unshift(`_${sleutels.length} sleutels · ${nAangepast} aangepast in **${campagne}** · rest is de standaard uit de code._`);
  return r.join('\n');
}

// ── Markdown terug lezen ────────────────────────────────────────────────────
function uitMarkdown(tekst) {
  const uit = {};
  let sleutel = null, titel = null, stappen = null, stap = null;
  const sluitStap = () => {
    if (!stap) return;
    // De `---` die twee sleutels scheidt staat ná de laatste `###`-stap, dus hij
    // komt als tekstregel binnen. Alleen de *laatste* streep gaat eraf (en de
    // witregels erboven): een streep midden in een tekst is gewone markdown en
    // blijft staan. Zonder dit eindigt elke laatste stap op `---` en ziet het
    // vergelijken met de standaard elke tekst als gewijzigd.
    const r = stap.regels;
    while (r.length && !r[r.length - 1].trim()) r.pop();
    if (r.length && /^---\s*$/.test(r[r.length - 1])) r.pop();
    stap.tekst = r.join('\n').trim();
    delete stap.regels; stappen.push(stap); stap = null;
  };
  const sluitSleutel = () => {
    sluitStap();
    if (sleutel) uit[sleutel] = { titel: titel || null, stappen };
    sleutel = null; titel = null; stappen = null;
  };
  for (const regel of tekst.split('\n')) {
    const kop = /^##\s+`([a-z_0-9]+)`\s*$/i.exec(regel);
    if (kop) { sluitSleutel(); sleutel = kop[1]; titel = null; stappen = []; continue; }
    if (!sleutel) continue;
    if (regel.startsWith('>')) continue;                 // aantekening
    if (/^---\s*$/.test(regel) && !stap) continue;        // scheiding tussen sleutels
    const t = /^Titel:\s*(.*)$/.exec(regel);
    if (t && !stap) { titel = t[1].trim(); continue; }
    const s = /^###\s+(.*)$/.exec(regel);
    if (s) { sluitStap(); stap = { titel: s[1].trim(), afbeelding: null, regels: [] }; continue; }
    if (stap) stap.regels.push(regel);
  }
  sluitSleutel();
  return uit;
}

const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const kaal = (h) => ({ titel: h?.titel || null, stappen: (h?.stappen || []).map(s => ({ titel: s.titel || '', tekst: String(s.tekst || '').trim(), afbeelding: s.afbeelding ?? null })) });

// ── Doen ────────────────────────────────────────────────────────────────────
const state     = JSON.parse(fs.readFileSync(padState, 'utf8'));
const overrides = state.helpContent || {};
const standaard = standaardTeksten();

if (!leesPad) {
  const doel = uitPad || path.join(wortel, 'docs', 'helpteksten.md');
  const md = naarMarkdown(standaard, overrides, vindplaatsen());
  fs.writeFileSync(doel, md);
  const n = Object.keys(standaard).length;
  console.log(`${n} standaardteksten + ${Object.keys(overrides).length} aangepast → ${path.relative(wortel, doel)} (${Math.round(md.length / 1024)} kB)`);
  const zonder = Object.keys(standaard).filter(k => !vindplaatsen()[k] && !/^hulp_(kijk|bewerk)_/.test(k));
  if (zonder.length) console.log(`Let op — geen aanroep gevonden voor: ${zonder.join(', ')}`);
  process.exit(0);
}

// Terug lezen
const gelezen = uitMarkdown(fs.readFileSync(leesPad, 'utf8'));
const nieuw = {}, verwijder = [];
let ongewijzigd = 0;
for (const [sleutel, h] of Object.entries(gelezen)) {
  if (!h.stappen.length) { console.log(`  ! ${sleutel}: geen stappen — overgeslagen`); continue; }
  const std = standaard[sleutel] ? kaal(standaard[sleutel]) : null;
  const mij = kaal(h);
  if (std && gelijk(std, mij)) {
    // Gelijk aan de standaard: niet vastleggen. Stond er al een override, dan
    // mag die juist weg — dan volgt de campagne de code weer.
    if (overrides[sleutel]) verwijder.push(sleutel); else ongewijzigd++;
    continue;
  }
  if (overrides[sleutel] && gelijk(kaal(overrides[sleutel]), mij)) { ongewijzigd++; continue; }
  nieuw[sleutel] = mij;
}

console.log(`Gelezen: ${Object.keys(gelezen).length} sleutels`);
console.log(`  ongewijzigd : ${ongewijzigd}`);
console.log(`  aan te passen: ${Object.keys(nieuw).length}${Object.keys(nieuw).length ? ' → ' + Object.keys(nieuw).join(', ') : ''}`);
console.log(`  terug naar de standaard: ${verwijder.length}${verwijder.length ? ' → ' + verwijder.join(', ') : ''}`);

if (!Object.keys(nieuw).length && !verwijder.length) { console.log('\nNiets te doen.'); process.exit(0); }
if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het door te voeren)'); process.exit(0); }

if (!state.helpContent) state.helpContent = {};
for (const [k, v] of Object.entries(nieuw)) state.helpContent[k] = v;
for (const k of verwijder) delete state.helpContent[k];

const datum = new Date().toISOString().slice(0, 10);
const kopie = padState.replace(/\.json$/, `.voor-help.${datum}.json`);
fs.copyFileSync(padState, kopie);
fs.writeFileSync(padState, JSON.stringify(state, null, 2));
console.log(`\nGeschreven. Kopie: ${path.basename(kopie)}`);
