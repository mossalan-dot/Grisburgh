/**
 * lib/orakel.js — Het Orakel der Sterren
 *
 * Pure, testbare logica voor de waarzeggerij: het standaarddek van
 * omenkaarten, het aanvullen van defaults en het trekken van een kaart.
 * Alle visuele opmaak zit in de client (render-orakel.js).
 */

'use strict';

// ── Standaarddek ───────────────────────────────────────────────────
// Evocatieve, generieke voortekens — meteen bruikbaar, door de DM aan te
// passen. `kleur` stuurt het kleuraccent van de kaart.
const DEFAULT_DECK = [
  { id: 'komeet',     titel: 'De Komeet',          symbool: '☄️', kleur: '#d98a2b', omen: 'Een vreemdeling brengt verandering die niemand kan tegenhouden.', duiding: 'Verwacht het onverwachte; een nieuwe speler betreedt het toneel.' },
  { id: 'toren',      titel: 'De Gebroken Toren',  symbool: '🏚️', kleur: '#9a3a2a', omen: 'Wat hoog gebouwd is, staat op het punt te vallen.', duiding: 'Een zekerheid brokkelt af. Niet alles is te redden.' },
  { id: 'wolf',       titel: 'De Wolf bij Maanlicht', symbool: '🐺', kleur: '#5a6b8a', omen: 'Een vijand sluipt dichterbij dan je denkt.', duiding: 'Wantrouwen is op zijn plaats; let op wie meeluistert.' },
  { id: 'sleutel',    titel: 'De Gouden Sleutel',  symbool: '🗝️', kleur: '#c9a23a', omen: 'Een deur die gesloten leek, gaat open.', duiding: 'Een kans of geheim dient zich aan — grijp het moment.' },
  { id: 'maan',       titel: 'De Verdronken Maan', symbool: '🌑', kleur: '#3a4a6a', omen: 'Wat verloren ging, keert niet zomaar terug.', duiding: 'Rouw of verlies kleurt de weg; geef het zijn tijd.' },
  { id: 'wegen',      titel: 'De Twee Wegen',      symbool: '🛤️', kleur: '#6a8a4a', omen: 'Een keuze splitst het lot in tweeën.', duiding: 'Beide paden hebben een prijs. Kies met open ogen.' },
  { id: 'oog',        titel: 'Het Open Oog',       symbool: '👁️', kleur: '#9b59b6', omen: 'Je wordt gadegeslagen, ook nu.', duiding: 'Niets blijft verborgen; iemand kent jullie plannen.' },
  { id: 'brug',       titel: 'De Brandende Brug',  symbool: '🔥', kleur: '#bd5a2a', omen: 'Achter je sluit de weg zich voorgoed.', duiding: 'Er is geen terugkeer meer; vooruit is de enige richting.' },
  { id: 'klok',       titel: 'De Stille Klok',     symbool: '⏳', kleur: '#7a6a4a', omen: 'De tijd raakt op, al hoor je hem niet tikken.', duiding: 'Handel snel — uitstel kost meer dan je denkt.' },
  { id: 'kroon',      titel: 'De Gevallen Kroon',  symbool: '👑', kleur: '#b8862b', omen: 'Macht verschuift naar onverwachte handen.', duiding: 'Een heerser wankelt; let op wie ervan profiteert.' },
  { id: 'slang',      titel: 'De Slang in het Gras', symbool: '🐍', kleur: '#3f7a4a', omen: 'Een vriend draagt een dubbel gezicht.', duiding: 'Verraad ligt op de loer in vertrouwde kring.' },
  { id: 'draad',      titel: 'De Zilveren Draad',  symbool: '🧵', kleur: '#8aa0c0', omen: 'Twee levens blijken verbonden door het lot.', duiding: 'Een ontmoeting is geen toeval; volg de draad.' },
  { id: 'graf',       titel: 'Het Lege Graf',      symbool: '⚰️', kleur: '#5a5a5a', omen: 'Iemand die dood gewaand werd, ademt nog.', duiding: 'Het verleden is niet begraven; het keert terug.' },
  { id: 'nar',        titel: 'De Lachende Nar',    symbool: '🃏', kleur: '#c96aa0', omen: 'Niet alles is wat het lijkt; de schijn bedriegt.', duiding: 'Bedrog of dwaasheid speelt mee — kijk tweemaal.' },
  { id: 'raven',      titel: 'De Drie Raven',      symbool: '🐦‍⬛', kleur: '#3a3a4a', omen: 'Donker nieuws reist sneller dan jullie paarden.', duiding: 'Een bericht nadert; bereid je voor op slecht tij.' },
  { id: 'doorn',      titel: 'De Bloeiende Doorn', symbool: '🌹', kleur: '#a33a5a', omen: 'Het schoonste verbergt de scherpste angel.', duiding: 'Schoonheid en gevaar gaan hier hand in hand.' },
  { id: 'anker',      titel: 'Het Anker',          symbool: '⚓', kleur: '#3a6a8a', omen: 'Te midden van de storm houdt iets je vast.', duiding: 'Stabiliteit en trouw dragen je door zwaar weer.' },
  { id: 'vlam',       titel: 'De Vlam in de Storm', symbool: '🕯️', kleur: '#d9a13a', omen: 'Eén klein licht weigert te doven.', duiding: 'Hoop houdt stand, hoe donker het ook wordt.' },
];

const DEFAULT_ORAKEL = {
  enabled:  true,
  intro:    'Schud de kaarten en bevraag het lot…',
  deck:     DEFAULT_DECK,
  lastDraw: null,   // { cardId, at, by }
};

function _slug() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Vul ontbrekende velden aan en saneer het dek.
function ensureOrakel(raw) {
  const o = { ...DEFAULT_ORAKEL, ...(raw || {}) };
  o.enabled = !!o.enabled;
  o.intro = String(o.intro || DEFAULT_ORAKEL.intro);
  if (!Array.isArray(o.deck) || o.deck.length === 0) o.deck = DEFAULT_DECK;
  o.deck = o.deck.map(c => ({
    id:      String(c?.id || _slug()),
    titel:   String(c?.titel || 'Naamloze kaart'),
    symbool: String(c?.symbool || '✦'),
    kleur:   String(c?.kleur || '#b8862b'),
    omen:    String(c?.omen || ''),
    duiding: String(c?.duiding || ''),
  }));
  if (o.lastDraw && !o.deck.some(c => c.id === o.lastDraw.cardId)) o.lastDraw = null;
  return o;
}

// Trek een willekeurige kaart-id uit het dek. `rnd` injecteerbaar voor tests.
function drawCardId(deck, rnd = Math.random) {
  if (!Array.isArray(deck) || deck.length === 0) return null;
  const idx = Math.floor(rnd() * deck.length) % deck.length;
  return deck[idx].id;
}

module.exports = {
  DEFAULT_DECK,
  DEFAULT_ORAKEL,
  ensureOrakel,
  drawCardId,
};
