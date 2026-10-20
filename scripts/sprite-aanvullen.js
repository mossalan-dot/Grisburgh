#!/usr/bin/env node
// Iconen uit Lucide bijzetten in `public/img/icons.svg`.
//
// De sprite is met de hand gegroeid: per keer dat er een icoon nodig was werd
// het pad erin geplakt. Dat gaat goed voor drie iconen en niet voor veertig —
// de species-lijst vroeg er in één keer 43 bij. Dit script haalt ze bij
// lucide-static (dezelfde bron, ISC) en zet ze in dezelfde vorm als de rest:
// een `<symbol>` met het viewBox en de streekinstellingen van Lucide.
//
// Het slaat over wat er al in staat, dus twee keer draaien kan geen kwaad, en
// het raakt niets anders aan het bestand aan.
//
// Lucide heeft geen dieren met hoeven of klauwen: geen paard, geen beer, geen
// hert. Die staan wél bij game-icons.net, waar de fantasy-iconen onderin de
// sprite vandaan komen. Schrijf je een naam met een maker ervoor
// (`delapouite/horse-head`), dan haalt hij hem daar — die symbolen hebben een
// 512-viewBox en een gevuld pad in plaats van een streek, net als de andere
// game-icons die er al in staan.
//
//   node scripts/sprite-aanvullen.js bird cat dog            (proefronde)
//   node scripts/sprite-aanvullen.js bird cat dog --schrijf
//   node scripts/sprite-aanvullen.js delapouite/horse-head --schrijf
const fs   = require('fs');
const path = require('path');

const SPRITE = path.join(__dirname, '..', 'public', 'img', 'icons.svg');
const BRON   = (naam) => `https://unpkg.com/lucide-static@latest/icons/${naam}.svg`;
const BRON_GI = (pad) => `https://raw.githubusercontent.com/game-icons/icons/master/${pad}.svg`;

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const namen = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!namen.length) { console.error('Geef de iconen op die erbij moeten.'); process.exit(1); }

  let sprite = fs.readFileSync(SPRITE, 'utf8');
  const erin = new Set([...sprite.matchAll(/id="icon-([a-z0-9-]+)"/g)].map(m => m[1]));

  const nieuw = [];
  for (const pad of namen) {
    const gi = pad.includes('/');
    const naam = gi ? pad.split('/').pop() : pad;
    if (erin.has(naam)) { console.log(`  = ${naam} staat er al`); continue; }
    const r = await fetch(gi ? BRON_GI(pad) : BRON(naam));
    if (!r.ok) { console.log(`  ! ${pad} — ${r.status}`); continue; }
    const svg = await r.text();
    if (gi) {
      // game-icons levert een zwarte achtergrondrechthoek mee; die hoort niet
      // in een icoon dat de kleur van zijn tekst aanneemt.
      const paden = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].map(m => m[1])
        .filter(d => !/^M0 0h512v512H0z$/i.test(d.replace(/\s+/g, '')));
      if (!paden.length) { console.log(`  ! ${naam} — geen pad`); continue; }
      nieuw.push(`  <symbol id="icon-${naam}" viewBox="0 0 512 512">\n`
        + paden.map(d => `    <path fill="currentColor" d="${d}"/>`).join('\n') + `\n  </symbol>`);
      console.log(`  + ${naam} (game-icons)`);
      await new Promise(r_ => setTimeout(r_, 60));
      continue;
    }
    // Alleen de inhoud tussen de buitenste <svg>-tags; de instellingen zetten
    // we zelf, precies zoals de symbolen die er al staan.
    const binnen = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();
    if (!binnen) { console.log(`  ! ${naam} — leeg`); continue; }
    const regels = binnen.split('\n').map(r_ => '    ' + r_.trim()).filter(r_ => r_.trim()).join('\n');
    nieuw.push(`  <symbol id="icon-${naam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${regels}\n  </symbol>`);
    console.log(`  + ${naam}`);
    await new Promise(r_ => setTimeout(r_, 60));
  }

  console.log(`\n${nieuw.length} erbij, ${erin.size} stonden er al.`);
  if (!schrijf || !nieuw.length) { if (!schrijf) console.log('Proefronde — draai opnieuw met --schrijf.'); return; }

  sprite = sprite.replace(/<\/svg>\s*$/, nieuw.join('\n') + '\n</svg>\n');
  fs.writeFileSync(SPRITE + '.tmp', sprite);
  fs.renameSync(SPRITE + '.tmp', SPRITE);
  console.log(`Geschreven: ${path.relative(process.cwd(), SPRITE)} — vergeet de versie niet (icons.svg?v=N in app.js).`);
})().catch(e => { console.error(e.message); process.exit(1); });
