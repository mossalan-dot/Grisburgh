/**
 * lib/almanak.js — In-wereld kalender & maanfase-berekeningen
 *
 * Pure, side-effect-vrije functies zodat ze server-side gebruikt én
 * eenvoudig unit-getest kunnen worden (zie tests/almanak.test.js).
 *
 * Een "datum" is een object { jaar, maandIdx, dag } waarbij:
 *   - jaar     : geheel getal (mag negatief voor jaren vóór het ijkpunt)
 *   - maandIdx : 0-based index in config.maanden
 *   - dag      : 1-based dag binnen de maand
 *
 * De "absolute dag" is een doorlopende dagteller vanaf jaar 0, dag 1.
 */

'use strict';

// ── Standaardconfiguratie ──────────────────────────────────────────
// Archaïsche Nederlandse maandnamen — meteen sfeervol, door de DM te
// hernoemen. Een maancyclus van 28 dagen sluit netjes aan op de week.
const DEFAULT_ALMANAK = {
  enabled:       true,
  eraNaam:       'n.S.',          // achtervoegsel achter het jaartal
  maanNaam:      'de Manen',      // naam van de maan (sfeer)
  maanCyclus:    28,              // lengte van de maancyclus in dagen
  maanOffset:    0,               // verschuiving om de fase uit te lijnen
  weekdagOffset: 0,               // verschuiving om de weekdag uit te lijnen
  weekdagen:     ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'],
  maanden: [
    { naam: 'Louwmaand',    dagen: 31 },
    { naam: 'Sprokkelmaand', dagen: 28 },
    { naam: 'Lentemaand',   dagen: 31 },
    { naam: 'Grasmaand',    dagen: 30 },
    { naam: 'Bloeimaand',   dagen: 31 },
    { naam: 'Zomermaand',   dagen: 30 },
    { naam: 'Hooimaand',    dagen: 31 },
    { naam: 'Oogstmaand',   dagen: 31 },
    { naam: 'Herfstmaand',  dagen: 30 },
    { naam: 'Wijnmaand',    dagen: 31 },
    { naam: 'Slachtmaand',  dagen: 30 },
    { naam: 'Wintermaand',  dagen: 31 },
  ],
  seizoenen: [
    { id: 'winter', naam: 'Winter', kleur: '#6f93c4', maanden: [11, 0, 1]  },
    { id: 'lente',  naam: 'Lente',  kleur: '#6aa463', maanden: [2, 3, 4]   },
    { id: 'zomer',  naam: 'Zomer',  kleur: '#c9a23a', maanden: [5, 6, 7]   },
    { id: 'herfst', naam: 'Herfst', kleur: '#bd6b35', maanden: [8, 9, 10]  },
  ],
  // Huidige in-wereld datum ("vandaag")
  jaar:     1247,
  maandIdx: 0,
  dag:      1,
  gebeurtenissen: [],
};

// Dutch maanfase-labels, met de bijbehorende emoji.
const MAANFASEN = [
  { naam: 'Nieuwe maan',      emoji: '🌑' },
  { naam: 'Wassende sikkel',  emoji: '🌒' },
  { naam: 'Eerste kwartier',  emoji: '🌓' },
  { naam: 'Wassende maan',    emoji: '🌔' },
  { naam: 'Volle maan',       emoji: '🌕' },
  { naam: 'Afnemende maan',   emoji: '🌖' },
  { naam: 'Laatste kwartier', emoji: '🌗' },
  { naam: 'Afnemende sikkel', emoji: '🌘' },
];

// ── Helpers ────────────────────────────────────────────────────────

// Echte modulo die ook voor negatieve waarden netjes [0,m) teruggeeft.
function mod(n, m) {
  return ((n % m) + m) % m;
}

// Vul ontbrekende velden aan met defaults zodat oudere campagnes (zonder
// almanak in meta.json) automatisch een geldige, volledige config krijgen.
function ensureAlmanak(raw) {
  const a = { ...DEFAULT_ALMANAK, ...(raw || {}) };
  if (!Array.isArray(a.maanden) || a.maanden.length === 0) a.maanden = DEFAULT_ALMANAK.maanden;
  a.maanden = a.maanden.map(m => ({
    naam: String(m?.naam ?? 'Maand'),
    dagen: Math.max(1, Math.round(Number(m?.dagen) || 30)),
  }));
  if (!Array.isArray(a.weekdagen) || a.weekdagen.length === 0) a.weekdagen = DEFAULT_ALMANAK.weekdagen;
  a.weekdagen = a.weekdagen.map(w => String(w));
  if (!Array.isArray(a.seizoenen)) a.seizoenen = DEFAULT_ALMANAK.seizoenen;
  if (!Array.isArray(a.gebeurtenissen)) a.gebeurtenissen = [];
  a.maanCyclus = Math.max(2, Math.round(Number(a.maanCyclus) || 28));
  a.maanOffset = Math.round(Number(a.maanOffset) || 0);
  a.weekdagOffset = Math.round(Number(a.weekdagOffset) || 0);
  a.jaar = Math.round(Number(a.jaar) || 0);
  // Klem de huidige datum binnen de geldige grenzen.
  const clamped = clampDate(a, { jaar: a.jaar, maandIdx: a.maandIdx, dag: a.dag });
  a.jaar = clamped.jaar; a.maandIdx = clamped.maandIdx; a.dag = clamped.dag;
  return a;
}

// Totaal aantal dagen in een jaar.
function yearLength(a) {
  return a.maanden.reduce((sum, m) => sum + m.dagen, 0);
}

// 1-based dag van het jaar voor een (maandIdx, dag).
function dayOfYear(a, maandIdx, dag) {
  let total = 0;
  for (let i = 0; i < maandIdx; i++) total += a.maanden[i].dagen;
  return total + dag;
}

// Doorlopende absolute dagteller vanaf jaar 0.
function absoluteDay(a, date) {
  return date.jaar * yearLength(a) + (dayOfYear(a, date.maandIdx, date.dag) - 1);
}

// Zorg dat maandIdx/dag binnen geldige grenzen vallen.
function clampDate(a, date) {
  const maxM = a.maanden.length - 1;
  let mi = Math.min(Math.max(0, Math.round(Number(date.maandIdx) || 0)), maxM);
  const maxD = a.maanden[mi].dagen;
  let d = Math.min(Math.max(1, Math.round(Number(date.dag) || 1)), maxD);
  return { jaar: Math.round(Number(date.jaar) || 0), maandIdx: mi, dag: d };
}

// Tel een aantal dagen op (mag negatief) en rol netjes over maanden/jaren.
function addDays(a, date, delta) {
  const yl = yearLength(a);
  const total = date.jaar * yl + (dayOfYear(a, date.maandIdx, date.dag) - 1) + Math.round(delta);
  const jaar = Math.floor(total / yl);
  let rem = total - jaar * yl;          // 0-based dag-van-jaar
  let mi = 0;
  while (mi < a.maanden.length - 1 && rem >= a.maanden[mi].dagen) {
    rem -= a.maanden[mi].dagen;
    mi++;
  }
  return { jaar, maandIdx: mi, dag: rem + 1 };
}

// Weekdag-index (0-based in a.weekdagen) voor een datum.
function weekdayIndex(a, date) {
  return mod(absoluteDay(a, date) + a.weekdagOffset, a.weekdagen.length);
}

// Positie binnen de maancyclus (0-based geheel getal in [0, cyclus)).
function moonPos(a, absDay) {
  return mod(absDay + a.maanOffset, a.maanCyclus);
}

// Maanfase als fractie 0..1 (0 = nieuwe maan, 0.5 = volle maan).
function moonFraction(a, absDay) {
  return moonPos(a, absDay) / a.maanCyclus;
}

// Fractie van de maanschijf die verlicht is (0 = donker, 1 = vol).
function moonIllumination(fraction) {
  return (1 - Math.cos(2 * Math.PI * fraction)) / 2;
}

// Geef het maanfase-label (naam + emoji) voor een fractie.
function moonLabel(fraction) {
  const idx = mod(Math.round(fraction * 8), 8);
  return MAANFASEN[idx];
}

// Is dit een nieuwe / volle maan op deze exacte dag?
function isNewMoon(a, absDay)  { return moonPos(a, absDay) === 0; }
function isFullMoon(a, absDay) { return moonPos(a, absDay) === Math.round(a.maanCyclus / 2); }

// Zoek het seizoen dat een maand bevat (of null).
function seasonOf(a, maandIdx) {
  return a.seizoenen.find(s => Array.isArray(s.maanden) && s.maanden.includes(maandIdx)) || null;
}

// Volledige beschrijving van één datum (voor de "vandaag"-kaart).
function describeDate(a, date) {
  const abs = absoluteDay(a, date);
  const frac = moonFraction(a, abs);
  return {
    jaar:        date.jaar,
    maandIdx:    date.maandIdx,
    maandNaam:   a.maanden[date.maandIdx]?.naam || '',
    dag:         date.dag,
    absDag:      abs,
    weekdagIdx:  weekdayIndex(a, date),
    weekdag:     a.weekdagen[weekdayIndex(a, date)] || '',
    dagVanJaar:  dayOfYear(a, date.maandIdx, date.dag),
    jaarLengte:  yearLength(a),
    seizoen:     seasonOf(a, date.maandIdx),
    maanFractie: frac,
    maanVerlicht: moonIllumination(frac),
    maanFase:    moonLabel(frac),
    maanPos:     moonPos(a, abs),
    nieuweMaan:  isNewMoon(a, abs),
    volleMaan:   isFullMoon(a, abs),
  };
}

// Bouw een jaaroverzicht: per maand de naam, dagen, startweekdag, het
// absolute dagnummer van dag 1 en het seizoen. De client kan hiermee de
// volledige kalendergrid en de maanstanden per dag tekenen.
function buildYearView(a, jaar) {
  return {
    jaar,
    maanden: a.maanden.map((m, idx) => {
      const date = { jaar, maandIdx: idx, dag: 1 };
      const abs1 = absoluteDay(a, date);
      return {
        idx,
        naam:        m.naam,
        dagen:       m.dagen,
        startWeekdag: weekdayIndex(a, date),
        startAbsDag: abs1,
        seizoen:     seasonOf(a, idx),
      };
    }),
  };
}

module.exports = {
  DEFAULT_ALMANAK,
  MAANFASEN,
  mod,
  ensureAlmanak,
  yearLength,
  dayOfYear,
  absoluteDay,
  clampDate,
  addDays,
  weekdayIndex,
  moonPos,
  moonFraction,
  moonIllumination,
  moonLabel,
  isNewMoon,
  isFullMoon,
  seasonOf,
  describeDate,
  buildYearView,
};
