#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  SPREUKEN IN SPELERSBOEKEN AANVULLEN
// ════════════════════════════════════════════════════════════════════════════
// Een spreuk in het boek van een speler draagt zijn eigen gegevens: school,
// casting time, range, components, duration en de beschrijving. Dat doet hij
// pas sinds de toevoegroute ze meeschrijft; wat daarvóór in een boek belandde
// heeft alleen een index, een naam en een level.
//
// Op die bladzijdes stond dus een lege statblok — en sinds de incantatieknop
// aan de **V**-component hangt, viel er ook niet meer uit af te lezen of je
// iets uitspreekt. De app zoekt het inmiddels bij het tekenen op in de
// bronlijst, maar dat lost het alleen op het scherm op: in de data blijft het
// leeg, en een eigen spreuk die later verandert laat het verschil zien.
//
// Dit vult aan wat er ontbreekt. **Nooit overschrijven**: staat er iets, dan
// blijft het staan — ook als de bron iets anders zegt, want dan heeft iemand
// het met opzet aangepast.
//
//   node scripts/spreuken-aanvullen.js            # proefdraai, schrijft niets
//   node scripts/spreuken-aanvullen.js --schrijf

const fs   = require('fs');
const path = require('path');

const schrijf = process.argv.includes('--schrijf');
const wortel  = path.join(__dirname, '..');
const basis   = path.join(wortel, 'data', 'campaigns');
if (!fs.existsSync(basis)) { console.error('Geen data/campaigns gevonden.'); process.exit(1); }

const lees = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

// De meegeleverde bronnen. **Per campagne de juiste**, net als de app zelf
// doet: een campagne met `spellSource: 'wands-wizards'` heeft een eigen lijst,
// en die namen lijken op niets uit de SRD. Alles door elkaar husselen zou een
// spreuk de gegevens van een naamgenoot uit de andere wereld geven.
const lijst = (naam) => ((lees(path.join(wortel, 'bronnen', naam)) || {}).results || []);
const BRON_PER_WERELD = {
  'wands-wizards': lijst('hp-spells.json'),
  standaard:       [...lijst('spells-2024.json'), ...lijst('extra-spells.json')],
};

const VELDEN = ['school', 'casting_time', 'range', 'components', 'duration', 'desc'];

// De vorm waarin een boek ze bewaart (zoals de toevoegroute ze wegschrijft).
function uitBron(b, veld) {
  if (veld === 'school')     return b.school?.name || (typeof b.school === 'string' ? b.school : '');
  if (veld === 'desc')       return Array.isArray(b.desc) ? b.desc.join('\n\n') : String(b.desc || '');
  if (veld === 'components') {
    const c = Array.isArray(b.components) ? b.components.join(', ') : String(b.components || '');
    return c ? c + (b.material ? ` (${b.material})` : '') : '';
  }
  return String(b[veld] || '');
}

let totaalVelden = 0, totaalSpreuken = 0;
const onbekend = new Set();

for (const camp of fs.readdirSync(basis)) {
  const bestand = path.join(basis, camp, 'dm-state.json');
  if (!fs.existsSync(bestand)) continue;
  const d = lees(bestand);
  if (!d) { console.error(`${camp}: dm-state.json is onleesbaar — overgeslagen`); continue; }

  const eigenRuw = lees(path.join(basis, camp, 'spells.json'));
  const eigen = Array.isArray(eigenRuw) ? eigenRuw : (eigenRuw?.results || []);
  const meta = lees(path.join(basis, camp, 'meta.json')) || {};
  // Wat de DM zelf schreef krijgt voorrang: het is nieuwer en van hem.
  const bron = [...eigen, ...(BRON_PER_WERELD[meta.spellSource] || BRON_PER_WERELD.standaard)];
  const perIndex = new Map(bron.map(b => [String(b.index || ''), b]));
  const perNaam  = new Map(bron.map(b => [String(b.name || '').toLowerCase().trim(), b]));

  let velden = 0, spreuken = 0;
  for (const lijst of Object.values(d.playerSpells || {})) {
    for (const s of lijst) {
      const b = perIndex.get(String(s.index || '')) || perNaam.get(String(s.name || '').toLowerCase().trim());
      if (!b) { if (VELDEN.some(v => !s[v])) onbekend.add(s.name || s.index); continue; }
      let raak = 0;
      for (const v of VELDEN) {
        if (s[v]) continue;                       // wat er staat blijft staan
        const w = uitBron(b, v);
        if (!w) continue;
        s[v] = w; raak++;
      }
      if (raak) { velden += raak; spreuken++; }
    }
  }
  if (!spreuken) { console.log(`${camp}: niets aan te vullen`); continue; }
  totaalVelden += velden; totaalSpreuken += spreuken;
  console.log(`${camp}: ${spreuken} spreuk${spreuken === 1 ? '' : 'en'}, ${velden} vel${velden === 1 ? 'd' : 'den'}`);
  if (!schrijf) continue;
  const bak = bestand + '.voor-spreuken.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(bestand, bak);
  fs.writeFileSync(bestand, JSON.stringify(d, null, 2));
}

console.log(`\n${totaalSpreuken} spreuken aangevuld, ${totaalVelden} velden in totaal.`);
if (onbekend.size) {
  console.log(`\nNiet gevonden in een bron (${onbekend.size}) — die blijven zoals ze zijn:`);
  console.log('  ' + [...onbekend].slice(0, 20).join(', ') + (onbekend.size > 20 ? ' …' : ''));
}
if (!schrijf && totaalSpreuken) console.log('\nProefdraai — niets geschreven. Voeg --schrijf toe om het echt te doen.');
