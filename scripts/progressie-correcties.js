#!/usr/bin/env node
// **Wat er mis bleek in de progressie van een campagne.**
//
// Twee soorten fouten komen er bij het nalopen uit en geen van beide is met
// code op te lossen, want het zijn gegevens: een feature die ontbreekt, of een
// tekst die iets anders zegt dan het boek. Ze stonden als regel in
// `docs/todo.md` en dat is de verkeerde plek — daar vergeet je ze, en bij de
// volgende campagne begin je opnieuw.
//
// De tabel hieronder is dus de correctie zelf, met erbij waaróm. Het script
// doet niets wat er al goed staat, en elke correctie zegt eerst wat hij
// verwacht aan te treffen: klopt dat niet, dan is er intussen iets veranderd
// en blijft de regel met rust.
//
//   node scripts/progressie-correcties.js <campagne>
//   node scripts/progressie-correcties.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Geef een campagne op.'); process.exit(1); }

const WORTEL = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const PAD    = path.join(WORTEL, 'campaigns', campagne, 'progression.json');
if (!fs.existsSync(PAD)) { console.error(`Niet gevonden: ${PAD}`); process.exit(1); }

const prog = JSON.parse(fs.readFileSync(PAD, 'utf8'));

const CORRECTIES = [
  {
    wat: 'Fighter krijgt zijn Ability Score Improvement op level 6 terug',
    waarom: 'De Fighter is de enige class die er twee extra krijgt — op 6 en op 14. '
          + 'In deze campagne staat 14 er wel en 6 niet, dus wie boven level 6 begint '
          + 'mist een keuze: de maker en de Progressie-tijdlijn volgen de campagne, '
          + 'niet het boek.',
    doe(p) {
      const lv = p.classes?.Fighter?.levels;
      if (!lv) return 'Fighter staat niet in deze campagne';
      const heeft = (n) => (lv[n] || []).some(f => /^ability score improvement$/i.test(f?.name || ''));
      if (heeft(6)) return null;                       // staat al goed
      if (!heeft(14)) return 'level 14 heeft er ook geen — dan is deze class anders ingericht';
      // Letterlijk dezelfde regel als op 14; die staat er al en is nagelopen.
      const voorbeeld = (lv[14] || []).find(f => /^ability score improvement$/i.test(f?.name || ''));
      lv[6] = [...(lv[6] || []), JSON.parse(JSON.stringify(voorbeeld))];
      return { gedaan: 'Ability Score Improvement toegevoegd op Fighter level 6' };
    },
  },
  {
    wat: 'Urban Bounty Hunter laat twee skills kiezen, geen één',
    waarom: 'Het boek zegt "choose two from among Deception, Insight, Persuasion, and '
          + 'Stealth". De maker leest die zin letterlijk, dus vroeg hij er één — en '
          + 'kwam elke Urban Bounty Hunter een skill tekort.',
    doe(p) {
      const rijen = Object.values(p.backgrounds?.['Urban Bounty Hunter']?.levels || {}).flat();
      const rij = rijen.find(f => /^skill proficiencies$/i.test(f?.name || ''));
      if (!rij) return 'die background of die regel staat er niet';
      if (/choose two/i.test(rij.desc || '')) return null;      // staat al goed
      if (!/choose one/i.test(rij.desc || '')) return `de tekst is intussen "${rij.desc}"`;
      rij.desc = rij.desc.replace(/choose one/i, 'choose two');
      return { gedaan: `Skill Proficiencies → "${rij.desc}"` };
    },
  },
];

let gedaan = 0, goed = 0, over = 0;
for (const c of CORRECTIES) {
  const r = c.doe(prog);
  if (r === null) { console.log(`  ·  ${c.wat}\n       staat al goed`); goed++; continue; }
  if (typeof r === 'string') { console.log(`  ?  ${c.wat}\n       overgeslagen: ${r}`); over++; continue; }
  console.log(`  +  ${c.wat}\n       ${r.gedaan}\n       ${c.waarom.replace(/\s+/g, ' ')}`);
  gedaan++;
}

console.log(`\n${CORRECTIES.length} correcties · ${gedaan} te doen · ${goed} stond al goed · ${over} overgeslagen`);

if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); process.exit(0); }
if (!gedaan)  { console.log('Niets te doen.'); process.exit(0); }

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
fs.copyFileSync(PAD, PAD.replace(/\.json$/, `.voor-correcties.${stempel}.json`));
fs.writeFileSync(PAD, JSON.stringify(prog, null, 2));
console.log(`\nGeschreven: ${gedaan} correcties. Kopie ernaast gezet.`);
