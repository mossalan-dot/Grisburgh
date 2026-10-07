// ════════════════════════════════════════════════════════════════════════════
//  HOUDING — hoe een personage tegenover de avonturiers staat
// ════════════════════════════════════════════════════════════════════════════
// Eén waarde van 1 tot 5 per personage. Op het kaartje is er in rust niets van
// te zien; de houding verschijnt als een baan licht of schaduw die overtrekt
// zodra je erover gaat. Zo blijft het kaartje rustig en ontdek je het door
// even stil te staan bij iemand.
//
// Alles wat een trede ís staat hier, en daaruit volgt de rest:
//
//   • de glansvariabelen op het kaartje       (`--glans-*`, zie theme.css)
//   • de tekst van de toast bij een insight-check
//   • het schuifje in de bewerkmodus van de DM
//   • de standaard per rol, en de vertaling vanuit renown
//
// Dat is met opzet één lijst. Vijf treden is een keuze, geen wet: de spec
// beschrijft ook een indeling in zeven. Zolang alles hier staat is dat een
// wijziging op één plek — plus het omrekenen van wat er al opgeslagen is
// (5 → 7: 1→1, 2→3, 3→4, 4→6, 5→7, zodat elke naam dezelfde blijft).
//
// ── De schaal ──
// De DMG kent er drie: vijandig, onverschillig, vriendelijk. Daar zitten twee
// tussenstappen bij, omdat "onverschillig" aan tafel twee heel verschillende
// dingen betekent — iemand die je niet vertrouwt en iemand die je niet kent.

const HOUDINGEN = [
  {
    waarde: 1,
    naam: 'Vijandig',
    dmg: 'Vijandig',
    uitleg: 'Werkt je tegen, en neemt daar risico voor.',
    // Schaduw, niet licht: `multiply` maakt het kaartje donkerder in plaats van
    // lichter. Trager dan de rest, want het moet zwaar aanvoelen.
    glans: { kleur: '#9a3328', sterkte: 0.55, duur: '3.2s', blend: 'multiply' },
    toast: 'Je voelt dat {naam} je vijandig gezind is.',
  },
  {
    waarde: 2,
    naam: 'Wantrouwig',
    dmg: 'Vijandig, maar aanspreekbaar',
    uitleg: 'Houdt je op afstand. Praten kan, rekenen op hem niet.',
    glans: { kleur: '#b5652e', sterkte: 0.3, duur: '2.8s', blend: 'multiply' },
    toast: 'Je merkt dat {naam} je niet vertrouwt.',
  },
  {
    waarde: 3,
    naam: 'Onverschillig',
    dmg: 'Onverschillig',
    uitleg: 'Heeft geen mening over je. De meeste mensen staan hier.',
    // Geen glans. Dat is het stille midden, en meteen de dekmantel: een
    // kaartje zonder effect kan álles betekenen (zie `magZien` hieronder).
    glans: null,
    toast: '{Naam} lijkt niet veel om je te geven.',
  },
  {
    waarde: 4,
    naam: 'Welgezind',
    dmg: 'Vriendelijk',
    uitleg: 'Mag je. Helpt als het hem niet te veel kost.',
    glans: { kleur: '#e8c56a', sterkte: 0.35, duur: '2.6s', blend: 'screen' },
    toast: 'Je voelt dat {naam} je wel mag.',
  },
  {
    waarde: 5,
    naam: 'Bondgenoot',
    dmg: 'Vriendelijk, neemt risico voor de groep',
    uitleg: 'Staat aan jouw kant, ook als dat hem iets kost.',
    glans: { kleur: '#f2d27a', sterkte: 0.6, duur: '2.2s', blend: 'screen' },
    toast: 'Je weet zeker dat {naam} aan jouw kant staat.',
  },
];

const MIN = 1;
const MAX = HOUDINGEN.length;
const NEUTRAAL = 3;

const houding = (w) => HOUDINGEN.find(h => h.waarde === Number(w)) || null;

// Een waarde die van buiten komt (een formulier, een import, een oud bestand).
// `null` betekent *niet ingesteld* en blijft `null`: dan rekent de app hem uit,
// en dat moet na een export-import nog steeds zo zijn.
function schoon(w) {
  if (w === null || w === undefined || w === '') return null;
  const n = parseInt(w, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX, Math.max(MIN, n));
}

// ── Welke houding geldt ─────────────────────────────────────────────────────
// Drie stappen, de eerste die iets oplevert wint. Deze functie draait aan
// beide kanten: de server beslist wat hij meestuurt, de frontend tekent het
// kaartje. Twee keer dezelfde regel op twee plekken loopt uit elkaar.
//
//   1. Wat de DM zelf zette.
//   2. De stand van de factie waar hij bij hoort (renown).
//   3. De standaard die bij zijn rol hoort.
function gelden({ eigen, renownHouding, rollen = [], subtype = '' }) {
  const zelf = schoon(eigen);
  if (zelf !== null) return { waarde: zelf, waarom: 'eigen' };
  const vanFactie = schoon(renownHouding);
  if (vanFactie !== null) return { waarde: vanFactie, waarom: 'factie' };
  return { waarde: standaardVoor(rollen, subtype), waarom: 'standaard' };
}

// ── De standaard per rol ────────────────────────────────────────────────────
// De spec noemt vier "types". Die bestaan in deze app niet: antagonist en
// verkoper zijn **rollen** (`data.tags`), huisdier is `subtype: 'dier'`, en
// daarnaast is er nog een subtype dat de spec niet kent — `god`.
//
// Een god krijgt met opzet geen houding op deze schaal. "De Verborgene is
// welgezind" is geen stand tussen twee partijen maar een heel ander soort
// uitspraak, en daar hoort het pantheon voor (zegeningen, eden, vloeken).
// Hij valt dus op neutraal terug en krijgt nooit een glans.
//
// Een speler evenmin: de houding gaat over hoe de wereld tegenover de party
// staat, en een protagonist ís de party.
const ZONDER_HOUDING = ['god', 'speler'];

function standaardVoor(rollen = [], subtype = '') {
  const st = String(subtype || '').toLowerCase();
  if (ZONDER_HOUDING.includes(st)) return NEUTRAAL;
  const heeft = (r) => rollen.map(x => String(x).toLowerCase()).includes(r);
  // Antagonist eerst: een antagonist die ook koopman is, is eerst antagonist.
  if (heeft('antagonist')) return 1;
  if (st === 'dier') return 4;            // een huisdier hoort bij je
  if (heeft('verkoper')) return NEUTRAAL; // een winkelier verkoopt aan iedereen
  return NEUTRAAL;
}

function heeftHouding(subtype = '') {
  return !ZONDER_HOUDING.includes(String(subtype || '').toLowerCase());
}

// ── Van renown naar een houding ─────────────────────────────────────────────
// Renown en houding beantwoorden dezelfde vraag voor twee schalen: hoe staat
// de wereld tegenover de groep? Een lid van een factie zonder eigen houding
// neemt de stand van die factie over.
//
// **Let op de grens.** Renown kan in deze app niet onder nul
// (`Math.max(0, …)` bij elke mutatie), en de ladder heeft zes treden: index 0
// is "buitenstaander", daarna 1 / 3 / 10 / 25 / 50. Een factie kan via renown
// dus wel welgezind worden, maar nooit vijandig. Dat is geen gat in de tabel:
// renown meet aanzien, geen vijandschap. Wie een factie tegen zich in het
// harnas joeg, zet dat zelf op 1 of 2 — en die eigen waarde wint altijd.
const RENOWN_NAAR_HOUDING = [3, 3, 4, 4, 5, 5];

function vanRenown(rangIdx) {
  const i = Math.max(0, Math.min(RENOWN_NAAR_HOUDING.length - 1, parseInt(rangIdx, 10) || 0));
  return RENOWN_NAAR_HOUDING[i];
}

// ── Wie ziet het effect ─────────────────────────────────────────────────────
// De DM altijd. Spelers zien niets zolang niemand in de groep de insight-DC
// van dat personage haalde: het kaartje gedraagt zich dan als onverschillig.
// Dat is de hele truc — een stil kaartje kan alles betekenen, dus er lekt niets
// uit. Zodra één speler de DC haalt, ziet de hele groep het: die speler heeft
// het de anderen verteld.
//
// Dit hoort op de **server** te gebeuren. Stuurt de API de houding gewoon mee
// en laat hij de frontend beslissen, dan staat hij in de netwerktab — dezelfde
// les als bij de verzegelde brief op het tafelscherm.
function magZien({ isDM, groepHaaldeDC }) {
  return !!isDM || !!groepHaaldeDC;
}

// De toastregel, met de naam erin. `{Naam}` met een hoofdletter voor een zin
// die ermee begint.
function toastVoor(waarde, naam) {
  const h = houding(waarde);
  if (!h) return '';
  return h.toast
    .replace('{Naam}', String(naam || ''))
    .replace('{naam}', String(naam || ''));
}

// De standaard-DC voor een insight-check. Eén getal op één plek, per campagne
// te verzetten; per personage mag het afwijken (een open boek laag, een sluwe
// intrigant 18 of meer).
const INSIGHT_DC_STANDAARD = 12;

function insightDC(eigen, standaard) {
  const n = parseInt(eigen, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(40, n);
  const s = parseInt(standaard, 10);
  return Number.isFinite(s) && s > 0 ? Math.min(40, s) : INSIGHT_DC_STANDAARD;
}

module.exports = {
  HOUDINGEN, MIN, MAX, NEUTRAAL, ZONDER_HOUDING,
  RENOWN_NAAR_HOUDING, INSIGHT_DC_STANDAARD,
  houding, schoon, gelden, standaardVoor, heeftHouding,
  vanRenown, magZien, toastVoor, insightDC,
};
