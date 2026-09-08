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

// ── Wat mag er wél de deur uit? ──────────────────────────────────────────────
// De teksten in spells-2024.json komen deels uit de PHB 2024 en zijn beschermd.
// Maar de **System Reference Document 5.2** staat onder CC BY 4.0, en die dekt
// 331 van onze 517 spreuken. Die mogen we dus gewoon tonen, mits we de bron
// vermelden — dat scheelt een tweede DM honderden lege hulzen.
// Gegenereerd met scripts/srd-2024/srd-spelteksten.js.
const SRD_ATTRIBUTIE = 'Deze tekst komt uit de System Reference Document 5.2 ("SRD 5.2") '
  + 'van Wizards of the Coast LLC, beschikbaar op https://www.dndbeyond.com/srd, '
  + 'onder de Creative Commons Attribution 4.0 International License '
  + '(https://creativecommons.org/licenses/by/4.0/legalcode).';

const _srdCache = new Map();
function srdBestand(naam) {
  if (_srdCache.has(naam)) return _srdCache.get(naam);
  let data = {};
  try { data = JSON.parse(fs.readFileSync(path.join(DIR, `${naam}.json`), 'utf8')); } catch { data = {}; }
  _srdCache.set(naam, data);
  return data;
}
const srdTeksten  = () => srdBestand('srd-spells');
// Class features, species traits en feats, met dezelfde sleutels als
// feature-descriptions.json ("Klasse|Naam" en "Naam").
const srdFeatures = () => srdBestand('srd-features');

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

// Eén spreuk zonder de beschermde tekst. Staat hij in de SRD, dan zetten we
// díé tekst erin (`_srd`, zodat de app de bronvermelding kan tonen); anders
// blijft alleen de structuur over en zegt `_geenTekst` dat er elders gekeken
// moet worden.
function kaleSpreuk(s) {
  const { desc, higher_level, material, ...rest } = s;
  const srd = srdTeksten()[s.index];
  if (srd?.desc?.length) {
    return { ...rest, desc: srd.desc, higher_level: srd.higher_level || [], material: material || '', _srd: true };
  }
  return { ...rest, desc: [], higher_level: [], material: material ? '…' : '', _geenTekst: true };
}

// Levert de bron zoals die campagne hem mag zien. `eigen` zijn de teksten die de
// DM zelf heeft geschreven; die winnen altijd, ook in een kale campagne — het is
// zijn eigen werk.
function bronVoor(naam, { volledig, eigen = {} } = {}) {
  const data = lees(naam);
  if (!data) return null;
  // Namenlijsten: geen teksten, dus niets om weg te laten.
  if (naam === 'volken-klassen') return data;
  // De beschrijvingenlijst gaat kaal de deur uit — behalve wat in de SRD staat.
  if (naam === 'feature-descriptions') return volledig ? data : srdFeatures();
  if (naam === 'backgrounds-2024') {
    if (volledig) return data;
    return Object.fromEntries(Object.entries(data).map(([bg, def]) => [bg, {
      ...def,
      levels: Object.fromEntries(Object.entries(def.levels || {}).map(([lv, items]) => [
        // `_geenTekst` zegt de app dat er iets wegvalt; anders staat er een leeg
        // vak zonder uitleg waar de tekst gebleven is.
        lv, (items || []).map(i => ({ ...i, desc: '', _geenTekst: true })),
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
  // Wat in de SRD staat houdt zijn tekst; de rest wordt leeg en krijgt
  // `_geenTekst`, zodat de app ernaar kan verwijzen in plaats van een leeg vak
  // te tonen.
  const srd = srdFeatures();
  const kaalNiveaus = (levels, groepNaam) => Object.fromEntries(Object.entries(levels || {}).map(([lv, feats]) => [
    lv, (feats || []).map(f => {
      const tekst = srd[`${groepNaam}|${f.name}`] || srd[f.name];
      return tekst ? { ...f, desc: tekst, _srd: true } : { ...f, desc: '', _geenTekst: true };
    }),
  ]));
  const kaalGroep = (groep) => Object.fromEntries(Object.entries(groep || {}).map(([naam, def]) => [
    naam,
    {
      ...def,
      levels: kaalNiveaus(def.levels, naam),
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
    feats:       prog.feats ? Object.fromEntries(Object.entries(prog.feats).map(([n, f]) => (
      srd[n] ? [n, { ...f, desc: srd[n], _srd: true }] : [n, { ...f, desc: '', _geenTekst: true }]
    ))) : undefined,
    gedeeld:     prog.gedeeld,
  };
}

module.exports = { SRD_ATTRIBUTIE, BRONNEN, DIR, lees, bronVoor, kaleProgressie };
