#!/usr/bin/env node
// ── Regie-script → tekst in de akteschrijver ────────────────────────────────
// De aktes van Grisburgh bestaan uit een **script**: een platte lijst van
// verwijzingen (kaartje, beeld, gevecht, dungeon, brief) die de importer ooit
// uit een .md haalde. Die .md werd daarna weggegooid — dat is pas later
// rechtgezet — dus er is geen proza meer, alleen de verwijzingen.
//
// Dit script zet die stappen om naar tekst voor het schrijfscherm: één regel
// per stap, in dezelfde volgorde, met een witregel ertussen zodat je het
// verhaal er zelf omheen kunt typen. Het is een **skelet**, geen reconstructie:
// wat er nooit meer is, verzinnen we niet.
//
// Het script blijft staan. Daar hangt onthulgeschiedenis aan, en de akte-tab
// toont hem dichtgeklapt zodra er tekst is ("79 stappen uit de oude import").
//
//   node scripts/akte-script-naar-tekst.js <campagne>            (proefronde)
//   node scripts/akte-script-naar-tekst.js <campagne> --schrijf
//   node scripts/akte-script-naar-tekst.js <campagne> --schrijf --akte=<sleutel>
const fs   = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
const alleenAkte = (process.argv.find(a => a.startsWith('--akte=')) || '').split('=')[1] || null;
if (!campagne) {
  console.error('Gebruik: node scripts/akte-script-naar-tekst.js <campagne> [--schrijf] [--akte=<sleutel>]');
  process.exit(1);
}

const dir = path.join(process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data'), 'campaigns', campagne);
const lees = (naam) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, naam), 'utf8')); } catch { return null; }
};

const meta       = lees('meta.json');
const entities   = lees('entities.json')   || {};
const encounters = lees('encounters.json') || {};
const dungeons   = lees('dungeon-maps.json') || {};
if (!meta) { console.error(`Geen meta.json in ${dir}`); process.exit(1); }

// ── Namen opzoeken, zodat het skelet leesbaar is ───────────────────────────
// Een stap draagt meestal al een `name`, maar niet altijd — en een wikilink
// werkt op naam, niet op id. Dus zoeken we het op waar het kan.
const naamVanEntity = (id) => {
  for (const lijst of Object.values(entities)) {
    if (!Array.isArray(lijst)) continue;
    const e = lijst.find(x => x.id === id);
    if (e) return e.name;
  }
  return null;
};
const naamVanEncounter = (id) => (encounters.encounters || encounters || [])
  .find?.(e => e.id === id)?.name || null;
const dungeonLijst = dungeons.maps || dungeons.dungeons || (Array.isArray(dungeons) ? dungeons : []);
const naamVanDungeon = (id) => (dungeonLijst || []).find(d => d.id === id)?.name || null;
const naamVanKamer = (dungeonId, roomId) => {
  const d = (dungeonLijst || []).find(x => x.id === dungeonId);
  return (d?.rooms || []).find(r => r.id === roomId)?.name || null;
};

const blok = (soort, kop, inhoud) => {
  const regels = [`> [!${soort}]${kop ? ' ' + kop : ''}`];
  for (const r of String(inhoud || '').split('\n')) if (r.trim()) regels.push('> ' + r);
  return regels.join('\n');
};

// ── Eén stap → één regel tekst ─────────────────────────────────────────────
function stapNaarTekst(st) {
  switch (st.type) {
    case 'entity': {
      const naam = st.name || naamVanEntity(st.entityId);
      // Zonder naam is een wikilink waardeloos: die zoekt op naam, niet op id.
      return naam ? `[[${naam}]]` : null;
    }
    case 'image': {
      if (!st.fileId) return null;
      // Het bijschrift is het enige stukje tekst dat de import bewaard heeft;
      // dat is vaak precies de scène-aanduiding, dus die zetten we erboven.
      // Het bijschrift hoort **in** de embed, niet als cursieve regel erboven:
      // `![[id|Bijschrift]]` is dezelfde pipe als in Obsidian, en dat schrift
      // reist mee naar het logboek en naar de speler bij het onthullen.
      const bij = String(st.caption || '').trim().replace(/[\]|]/g, '');
      return `![[${st.fileId}${bij ? '|' + bij : ''}]]`;
    }
    case 'encounter': {
      const naam = st.name || naamVanEncounter(st.encounterId);
      return naam ? blok('gevecht', naam) : null;
    }
    case 'dungeon': {
      const kaart = naamVanDungeon(st.dungeonId) || String(st.name || '').replace(/^open:\s*/i, '');
      if (!kaart) return null;
      if (st.roomId) {
        const kamer = naamVanKamer(st.dungeonId, st.roomId);
        // De schrijfwijze van een kamerblok is "Kaart · Kamer".
        if (kamer) return blok('kamer', `${kaart} · ${kamer}`);
      }
      return blok('kaart', kaart);
    }
    case 'brief': {
      const kop = [st.titel, st.spelerNaam].filter(Boolean).join(' — ');
      return blok('brief', kop || 'Brief', st.tekst || '');
    }
    case 'kop':
      return `## ${st.titel || 'Sectie'}`;
    default:
      return null;
  }
}

// ── Doorlopen ──────────────────────────────────────────────────────────────
const hoofdstukken = meta.hoofdstukken || {};
let totaalAktes = 0, totaalStappen = 0, overgeslagen = 0, zonderVertaling = 0;

for (const [key, h] of Object.entries(hoofdstukken)) {
  if (alleenAkte && key !== alleenAkte) continue;
  const script = Array.isArray(h.script) ? h.script : [];
  if (!script.length) continue;

  // Een akte die al tekst heeft laten we met rust: daar heeft iemand aan
  // geschreven, en dat overschrijven we niet met een skelet. Uitzondering: een
  // tekst die nog letterlijk ons eigen skelet is (herkenbaar aan de regel die
  // het script erin zet) mag opnieuw gemaakt worden — anders kun je een
  // verbetering aan dit script nooit meer toepassen.
  const _isOnsSkelet = String(h.tekst || '').includes('Dit skelet komt uit het oude regie-script');
  if (String(h.tekst || '').trim() && !_isOnsSkelet) {
    console.log(`  ${String(h.num || '?').padStart(2)} ${(h.title || key).slice(0, 34).padEnd(36)} overgeslagen — heeft al tekst`);
    overgeslagen++;
    continue;
  }

  const regels = [];
  let gemist = 0;
  for (const st of script) {
    const t = stapNaarTekst(st);
    if (t === null) { gemist++; continue; }
    regels.push(t);
  }
  if (!regels.length) continue;

  const kop = [
    `## ${h.title || 'Deze akte'}`,
    '',
    '*Dit skelet komt uit het oude regie-script: de verwijzingen staan er nog,',
    'het verhaal eromheen is bij de import verloren gegaan. Schrijf ertussen.*',
    '',
    '',
  ].join('\n');
  const tekst = kop + regels.join('\n\n') + '\n';

  totaalAktes++;
  totaalStappen += regels.length;
  zonderVertaling += gemist;
  console.log(`  ${String(h.num || '?').padStart(2)} ${(h.title || key).slice(0, 34).padEnd(36)} ${String(regels.length).padStart(3)} regels${gemist ? `  (${gemist} stap(pen) zonder naam overgeslagen)` : ''}`);

  if (schrijf) h.tekst = tekst;
}

console.log(`\n${totaalAktes} akte(s) · ${totaalStappen} regels` +
  (overgeslagen ? ` · ${overgeslagen} overgeslagen (hadden al tekst)` : '') +
  (zonderVertaling ? ` · ${zonderVertaling} stap(pen) zonder bruikbare naam` : ''));

if (!schrijf) { console.log('Proefronde — draai opnieuw met --schrijf om het echt te doen.'); process.exit(0); }
if (!totaalAktes) { console.log('Niets te schrijven.'); process.exit(0); }

const kopie = path.join(dir, `meta.voor-skelet.${new Date().toISOString().slice(0, 10)}.json`);
fs.copyFileSync(path.join(dir, 'meta.json'), kopie);
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`Geschreven. Kopie van de oude meta.json staat naast het origineel:\n  ${path.basename(kopie)}`);
