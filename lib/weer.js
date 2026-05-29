/**
 * lib/weer.js — De Hemel boven Grisburgh
 *
 * Pure, testbare logica voor het weersysteem: de catalogus van condities en
 * dagdelen, het aanvullen van defaults en een gewogen "weerworp".
 * Alle visuele opmaak (kleuren, animaties) zit in de client (render-weer.js).
 */

'use strict';

// ── Catalogus ──────────────────────────────────────────────────────
// Weersomstandigheden. `gewicht` bepaalt de kans bij een willekeurige worp.
const CONDITIES = [
  { id: 'helder',  label: 'Helder',   emoji: '☀️', gewicht: 5 },
  { id: 'bewolkt', label: 'Bewolkt',  emoji: '☁️', gewicht: 5 },
  { id: 'regen',   label: 'Regen',    emoji: '🌧️', gewicht: 4 },
  { id: 'storm',   label: 'Storm',    emoji: '⛈️', gewicht: 2 },
  { id: 'mist',    label: 'Mist',     emoji: '🌫️', gewicht: 2 },
  { id: 'sneeuw',  label: 'Sneeuw',   emoji: '❄️', gewicht: 2 },
];

// Dagdelen bepalen de basiskleur van de lucht.
const DAGDELEN = [
  { id: 'ochtend', label: 'Ochtend' },
  { id: 'middag',  label: 'Middag'  },
  { id: 'avond',   label: 'Avond'   },
  { id: 'nacht',   label: 'Nacht'   },
];

// Windkracht (0–3) en temperatuur als sfeerlabels.
const WIND_LABELS = ['Stil', 'Briesje', 'Stevige wind', 'Stormwind'];
const TEMP_LABELS = ['IJzig', 'Koud', 'Fris', 'Mild', 'Warm', 'Heet'];

const DEFAULT_WEER = {
  enabled:  true,
  dagdeel:  'middag',
  conditie: 'helder',
  wind:     1,         // index in WIND_LABELS
  temp:     3,         // index in TEMP_LABELS (Mild)
  notitie:  '',
};

function _clampIdx(v, arr, fallback) {
  const n = Math.round(Number(v));
  return Number.isInteger(n) && n >= 0 && n < arr.length ? n : fallback;
}

// Vul ontbrekende velden aan en saneer waarden.
function ensureWeer(raw) {
  const w = { ...DEFAULT_WEER, ...(raw || {}) };
  if (!CONDITIES.some(c => c.id === w.conditie)) w.conditie = DEFAULT_WEER.conditie;
  if (!DAGDELEN.some(d => d.id === w.dagdeel))   w.dagdeel  = DEFAULT_WEER.dagdeel;
  w.wind    = _clampIdx(w.wind, WIND_LABELS, DEFAULT_WEER.wind);
  w.temp    = _clampIdx(w.temp, TEMP_LABELS, DEFAULT_WEER.temp);
  w.notitie = String(w.notitie || '');
  w.enabled = !!w.enabled;
  return w;
}

// Gewogen willekeurige conditie. `rnd` is een functie die [0,1) geeft
// (injecteerbaar voor deterministische tests).
function rollConditie(rnd = Math.random) {
  const totaal = CONDITIES.reduce((s, c) => s + c.gewicht, 0);
  let r = rnd() * totaal;
  for (const c of CONDITIES) {
    r -= c.gewicht;
    if (r < 0) return c.id;
  }
  return CONDITIES[CONDITIES.length - 1].id;
}

module.exports = {
  CONDITIES,
  DAGDELEN,
  WIND_LABELS,
  TEMP_LABELS,
  DEFAULT_WEER,
  ensureWeer,
  rollConditie,
};
