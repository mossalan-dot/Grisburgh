// ── Meegeleverde bronbestanden ───────────────────────────────────────────────
// Spreuken, class features en backgrounds. Deze stonden in `public/data/` en
// waren daarmee zonder inloggen op te halen: 760 kB volledige PHB-tekst voor wie
// het pad raadt. Ze staan nu buiten `public/` en gaan via `GET /api/bron/:naam`,
// dus achter een sessie.
//
// Naar buiten toe geven we **structuur, geen teksten**: een tweede DM krijgt de
// namen, niveaus, scholen en tijden — de feitelijke velden die je nodig hebt om
// een spreuk te herkennen — met een leeg beschrijvingsveld dat hij zelf vult.
// Alleen een campagne met `meta.bronTeksten` (standaard alleen de beheer-
// campagne) krijgt de volledige teksten.

const fs   = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'bronnen');

// Whitelist: het pad komt uit de URL, dus geen vrije bestandsnaam.
const BRONNEN = ['spells-2024', 'hp-spells', 'extra-spells', 'feature-descriptions', 'backgrounds-2024', 'volken-klassen'];

const _cache = new Map();
function lees(naam) {
  if (!BRONNEN.includes(naam)) return null;
  const bestand = path.join(DIR, `${naam}.json`);
  let mtime = 0;
  try { mtime = fs.statSync(bestand).mtimeMs; } catch { return null; }
  const gecacht = _cache.get(naam);
  if (gecacht?.mtime === mtime) return gecacht.data;
  try {
    const data = JSON.parse(fs.readFileSync(bestand, 'utf8'));
    _cache.set(naam, { mtime, data });
    return data;
  } catch { return null; }
}

// Eén spreuk zonder tekst: alles wat hem herkenbaar maakt blijft staan.
function kaleSpreuk(s) {
  const { desc, higher_level, material, ...rest } = s;
  return { ...rest, desc: [], higher_level: [], material: material ? '…' : '' };
}

// Levert de bron zoals die campagne hem mag zien. `eigen` zijn de teksten die de
// DM zelf heeft geschreven; die winnen altijd, ook in een kale campagne — het is
// zijn eigen werk.
function bronVoor(naam, { volledig, eigen = {} } = {}) {
  const data = lees(naam);
  if (!data) return null;
  // Namenlijsten: geen teksten, dus niets om weg te laten.
  if (naam === 'volken-klassen') return data;
  if (naam === 'feature-descriptions') return volledig ? data : {};
  if (naam === 'backgrounds-2024') {
    if (volledig) return data;
    return Object.fromEntries(Object.entries(data).map(([bg, def]) => [bg, {
      ...def,
      levels: Object.fromEntries(Object.entries(def.levels || {}).map(([lv, items]) => [
        lv, (items || []).map(i => ({ ...i, desc: '' })),
      ])),
    }]));
  }
  // Spreukenlijsten
  const lijst = data.results || data.spells || (Array.isArray(data) ? data : []);
  const uit = lijst.map(s => {
    const mijn = eigen[s.index];
    if (mijn?.desc?.length) return { ...s, desc: mijn.desc, higher_level: mijn.higher_level || [], _eigen: true };
    return volledig ? s : kaleSpreuk(s);
  });
  return Array.isArray(data) ? uit : { ...data, results: uit };
}

// Beschrijvingen uit een progressie-seed halen: namen en levels blijven, de
// tekst niet. De DM vult ze in de progressie-editor zelf aan.
function kaleProgressie(prog) {
  const kaalNiveaus = (levels) => Object.fromEntries(Object.entries(levels || {}).map(([lv, feats]) => [
    lv, (feats || []).map(f => ({ ...f, desc: '' })),
  ]));
  const kaalGroep = (groep) => Object.fromEntries(Object.entries(groep || {}).map(([naam, def]) => [
    naam,
    {
      ...def,
      levels: kaalNiveaus(def.levels),
      subclasses: def.subclasses
        ? Object.fromEntries(Object.entries(def.subclasses).map(([sn, sd]) => [sn, { ...sd, levels: kaalNiveaus(sd.levels) }]))
        : undefined,
    },
  ]));
  return {
    ...prog,
    classes:     kaalGroep(prog.classes),
    species:     kaalGroep(prog.species),
    backgrounds: kaalGroep(prog.backgrounds),
    feats:       prog.feats ? Object.fromEntries(Object.entries(prog.feats).map(([n, f]) => [n, { ...f, desc: '' }])) : undefined,
    gedeeld:     prog.gedeeld,
  };
}

module.exports = { BRONNEN, DIR, lees, bronVoor, kaleProgressie };
