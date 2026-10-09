#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  MARGINALIA UIT DE SPREUKENBOEKEN HALEN
// ════════════════════════════════════════════════════════════════════════════
// De marginalia waren losse icoontjes met een toelichting langs de kantlijn van
// een spreukpagina: een tweede soort aantekening naast de incantatie. Ze zijn
// uit de app gehaald (9 okt 2026) omdat niemand ze gebruikte en ze het
// bewerkpaneel vulden met iets dat de incantatie al deed.
//
// Dit haalt wat er nog ligt uit `dm-state.json`. De spreuk zelf blijft staan;
// alleen het veld `marginalia` verdwijnt. Er komt een .bak naast te liggen.
//
//   node scripts/marginalia-opruimen.js            # proefdraai, schrijft niets
//   node scripts/marginalia-opruimen.js --schrijf

const fs   = require('fs');
const path = require('path');

const schrijf = process.argv.includes('--schrijf');
const basis = path.join(__dirname, '..', 'data', 'campaigns');
if (!fs.existsSync(basis)) { console.error('Geen data/campaigns gevonden.'); process.exit(1); }

let totaal = 0;
for (const camp of fs.readdirSync(basis)) {
  const bestand = path.join(basis, camp, 'dm-state.json');
  if (!fs.existsSync(bestand)) continue;
  let d;
  try { d = JSON.parse(fs.readFileSync(bestand, 'utf8')); } catch { console.error(`${camp}: dm-state.json is onleesbaar — overgeslagen`); continue; }
  let n = 0;
  for (const spreuken of Object.values(d.playerSpells || {})) {
    for (const s of spreuken) if (s.marginalia !== undefined) { delete s.marginalia; n++; }
  }
  if (!n) { console.log(`${camp}: niets te doen`); continue; }
  totaal += n;
  console.log(`${camp}: ${n} spreuk${n === 1 ? '' : 'en'} met marginalia`);
  if (!schrijf) continue;
  const bak = bestand + '.voor-marginalia.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(bestand, bak);
  fs.writeFileSync(bestand, JSON.stringify(d, null, 2));
}

console.log(`\n${totaal} in totaal.`);
if (!schrijf && totaal) console.log('Proefdraai — niets geschreven. Voeg --schrijf toe om het echt te doen.');
