#!/usr/bin/env node
// Spreuknamen in vaardigheidsteksten koppelen als `[[Naam]]`.
//
// De app linkt in lopende tekst al elke spreuknaam van **twee woorden of
// meer** (zie `linkInProza`): die zijn eenduidig. Eenwoordsnamen doet hij
// bewust niet, want "you have Resistance to", "sheds Bright Light" en "you
// teleport up to 30 feet" zijn gewoon Engels. Gemeten in Grisburgh: 299 van
// die treffers zijn géén spreuk.
//
// Maar een deel is het wél — "you learn the druidcraft cantrip", "you can cast
// thaumaturgy". Die zet dit script tussen dubbele haken, zodat ze alsnog
// klikbaar worden. Drie regels houden het eerlijk:
//
//  1. **De langste naam wint.** "Commune" staat in *Commune with Nature* en
//     "Heal" in *Power Word Heal*; wie van links naar rechts het kortste pakt
//     koppelt de verkeerde spreuk.
//  2. **Er moet een spreukwoord in de buurt staan** (spell, cantrip, cast,
//     prepared) — binnen 45 tekens. Zonder dat is het gewoon Engels.
//  3. **Tabellen en bestaande koppelingen blijven met rust.** In een
//     spreukenkolom linkt de weergave zelf al, en wat al tussen haken staat is
//     een keuze van de DM.
//
//   node scripts/spreuken-koppelen.js <campagne>            (rapport)
//   node scripts/spreuken-koppelen.js <campagne> --schrijf
const fs   = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
// **Niet "een spreukwoord in de buurt" maar een patroon.** Dat eerste is te
// los: "You have Resistance to that damage type, and when you cast a spell…"
// haalt het, en daar is Resistance gewoon Engels. Dit zijn de vormen waarin
// een tekst een spreuk bij naam noemt:
//
//   1. de naam, direct gevolgd door "spell" of "cantrip"
//        "the Polymorph spell", "the Mending cantrip"
//   2. een werkwoord dat casten betekent, vlak ervoor
//        "you can cast thaumaturgy", "you learn druidcraft"
//
// Een opsomming van aanbevolen cantrips leek een derde vorm, maar die regel
// haalde "Sending Stones" en "Boon of Energy Resistance" binnen omdat de zin
// toevallig "are recommended" bevatte. Weg ermee: wat daar staat is meestal
// toch meerwoordig en linkt zichzelf al.
//
// Twee harde uitsluitingen: een naam gevolgd door "to" is een eigenschap
// ("Resistance to", "immunity to"), en een naam met een **hoofdletterwoord**
// ernaast is deel van een langere eigennaam — *Sending Stones*, *Rite of the
// Dawn*, *Boon of Energy Resistance*.
const NA_NAAM   = /^\s*(spell|cantrip)s?\b/i;
// "gain the" stond hier ook, maar dat haalde "allies gain the current
// Resistance of your Nature's Ward" en "gain the ability to heal yourself"
// binnen. Wat het moest vangen ("you gain the Mending cantrip") doet NA_NAAM
// al.
const VOOR_NAAM = /\b(cast|casting|casts|know|knows|learn|learns|prepares?|prepared)\b[^.]{0,24}$/i;
const GEEN      = /^\s*to\b/i;
const HOOFD_NA  = /^\s+[A-Z][a-z]/;              // "Sending Stones"
const HOOFD_VOOR = /(?:[A-Z][a-z]+|of|the)\s+$/;  // "Rite of the Dawn", "Energy Resistance"
// "Rite of the Dawn": de naam staat achter "… of the", en dan is hij deel van
// die naam en niet de spreuk Dawn.
const VAN_DE     = /[A-Z][a-z]+\s+of\s+the\s+$/;
// Een naam met een koppelteken ertegenaan is een samenstelling, geen spreuk:
// "innocent-seeming words".
const KOPPEL     = { voor: /-$/, na: /^-/ };
// Een **kleine letter** vraagt om meer bewijs dan een hoofdletter. "The
// healing spells you cast on others heal you as well" — daar is heal het
// werkwoord. Dus: bij kleine letters moet het woord "spell" of "cantrip" kort
// erna staan, zoals in "the augury or clairvoyance spell".
const NABIJ      = /\b(spell|cantrip)s?\b/i;
const RUIMTE = 45;

const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");

(async () => {
  const schrijf = process.argv.includes('--schrijf');
  const campagne = process.argv[2];
  if (!campagne || campagne.startsWith('--')) { console.error('Geef een campagne op.'); process.exit(1); }
  const pad = path.join(WORTEL, 'data', 'campaigns', campagne, 'progression.json');
  if (!fs.existsSync(pad)) { console.error(`Geen progression.json voor ${campagne}.`); process.exit(1); }

  const prog = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const spreuken = JSON.parse(fs.readFileSync(path.join(WORTEL, 'bronnen', 'spells-2024.json'), 'utf8'));
  const namen = (spreuken.results || spreuken || []).map(s => String(s.name || '')).filter(Boolean)
    .sort((a, b) => b.length - a.length);          // langste eerst
  const eenWoord = new Set(namen.filter(n => n.split(/\s+/).length === 1).map(n => n.toLowerCase()));
  const alle = new RegExp(`\\b(${namen.map(esc).join('|')})\\b`, 'gi');

  const gedaan = [], overgeslagen = [];

  const regelOm = (tekst) => {
    // Regel voor regel, zodat een tabelregel ongemoeid blijft.
    return tekst.split('\n').map(regel => {
      if (regel.includes('|') || regel.includes('\t')) return regel;
      let uit = '', rest = regel;
      alle.lastIndex = 0;
      let m, pos = 0;
      const stukken = [];
      while ((m = alle.exec(regel))) {
        stukken.push({ start: m.index, eind: m.index + m[0].length, tekst: m[0] });
        alle.lastIndex = m.index + m[0].length;
      }
      for (const s of stukken) {
        const woorden = s.tekst.split(/\s+/).length;
        const voor = regel.slice(0, s.start);
        // Al tussen haken? Dan is het een keuze van de DM.
        if (/\[\[[^\]]*$/.test(voor)) continue;
        if (woorden > 1) continue;                  // die linkt de weergave zelf
        if (!eenWoord.has(s.tekst.toLowerCase())) continue;
        const na = regel.slice(s.eind);
        if (GEEN.test(na)) { overgeslagen.push({ naam: s.tekst, om: s.tekst + na.slice(0, 20) }); continue; }
        // Deel van een langere eigennaam? Dan is het die naam, niet de spreuk.
        if (HOOFD_NA.test(na) || VAN_DE.test(voor)
            || (HOOFD_VOOR.test(voor) && !/\b(the|a|an)\s+$/i.test(voor))) {
          overgeslagen.push({ naam: s.tekst, om: regel.slice(Math.max(0, s.start - RUIMTE), s.eind + RUIMTE) });
          continue;
        }
        if (KOPPEL.voor.test(voor) || KOPPEL.na.test(na)) {
          overgeslagen.push({ naam: s.tekst, om: regel.slice(Math.max(0, s.start - RUIMTE), s.eind + RUIMTE) });
          continue;
        }
        const metHoofdletter = /^[A-Z]/.test(s.tekst);
        const past = NA_NAAM.test(na)
          || (VOOR_NAAM.test(voor) && (metHoofdletter || NABIJ.test(na.slice(0, 30))));
        if (!past) {
          overgeslagen.push({ naam: s.tekst, om: regel.slice(Math.max(0, s.start - RUIMTE), s.eind + RUIMTE) });
          continue;
        }
        s.pak = true;
      }
      for (const s of stukken.filter(x => x.pak).reverse()) {
        rest = rest.slice(0, s.start) + `[[${s.tekst}]]` + rest.slice(s.eind);
        gedaan.push({ naam: s.tekst, regel: regel.slice(Math.max(0, s.start - RUIMTE), s.eind + RUIMTE) });
      }
      return rest;
    }).join('\n');
  };

  let geraakt = 0;
  const loop = (waar, f) => {
    if (!f?.desc) return;
    const voor = gedaan.length;
    const nieuw = regelOm(String(f.desc));
    if (nieuw !== f.desc) { f.desc = nieuw; geraakt++; }
    for (let i = voor; i < gedaan.length; i++) gedaan[i].waar = `${waar} › ${f.name}`;
  };
  for (const [k, d] of Object.entries(prog.classes || {})) {
    for (const fs_ of Object.values(d.levels || {})) for (const f of fs_) loop(k, f);
    for (const [s, sd] of Object.entries(d.subclasses || {})) {
      for (const fs_ of Object.values(sd.levels || {})) for (const f of fs_) loop(`${k}/${s}`, f);
    }
  }
  for (const [n, d] of Object.entries(prog.species || {})) {
    for (const fs_ of Object.values(d.levels || {})) for (const f of fs_) loop(n, f);
  }

  for (const g of gedaan) console.log(`  ${g.naam.padEnd(16)} ${g.waar}\n      …${g.regel.replace(/\s+/g, ' ')}…`);
  console.log(`\n${gedaan.length} koppelingen in ${geraakt} features.`);
  const tel = {};
  for (const o of overgeslagen) tel[o.naam] = (tel[o.naam] || 0) + 1;
  console.log(`Overgeslagen (geen spreukwoord in de buurt): ${overgeslagen.length} — `
    + Object.entries(tel).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => `${n}×${c}`).join(', '));

  if (!schrijf) { console.log('\nProefronde — draai opnieuw met --schrijf.'); return; }
  const kopie = pad.replace(/\.json$/, `.voor-spreuklinks.${new Date().toISOString().slice(0, 10)}.json`);
  fs.copyFileSync(pad, kopie);
  fs.writeFileSync(pad + '.tmp', JSON.stringify(prog, null, 2));
  fs.renameSync(pad + '.tmp', pad);
  console.log(`\nGeschreven. Kopie ernaast: ${path.basename(kopie)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
