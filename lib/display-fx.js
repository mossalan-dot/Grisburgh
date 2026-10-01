// ════════════════════════════════════════════════════════════════════════════
//  TAFELSCHERM-EFFECTEN — één catalogus
// ════════════════════════════════════════════════════════════════════════════
// Een effect is een moment op het gedeelde scherm: een rode flits als iemand
// een klap krijgt, een groene waas zolang de party in de gifwolk staat. Alles
// wat zo'n effect is staat hier, en daaruit volgt de rest:
//
//   • de knoppen in het sfeermenu van de DM        (GET /display/fx)
//   • de controle op de server                     (POST /display/effect)
//   • de CSS-klasse op het tafelscherm             (`display-fx--<id>`)
//   • de rij in de Geluiden-tab waar je er een eigen klank aan hangt
//
// Eén lijst, want anders lopen ze uit elkaar: er stonden drie effecten in een
// `includes([...])` op de server, drie knoppen in het DM-paneel en twee
// CSS-klassen, en de windvlaag had helemaal geen klasse maar een eigen tak in
// de client. Zet je er een bij op één plek, dan werkt hij nergens anders.
//
// ── Soort ──
//   flits     — eenmalig, ruimt zichzelf op na `duur` ms.
//   toestand  — blijft staan tot de DM hem uitzet (effect `uit`), of tot er een
//               andere toestand overheen komt. Een flits mag er wél overheen.
//
// Dat onderscheid is er omdat een toestand een uitknop nodig heeft en een flits
// niet; zonder dat verschil krijg je een scherm dat groen blijft omdat iemand
// tweemaal drukte.
//
// ── Klank ──
// `klank` is een recept voor de WebAudio-synthese in `public/js/sound-manager.js`
// — geen bestand. Dat scheelt licentiegedoe, laadtijd en een map met samples die
// in elke deploy meegaat, en het werkt bij een nieuwe DM meteen. Wil je iets
// echts (donder, regen), dan hangt de DM er in de Geluiden-tab een eigen
// bestand aan: `sounds.json → momenten.fx.<id>` wint van de synthese.
// `null` = dit effect maakt uit zichzelf geen geluid.

const DISPLAY_FX = [
  // ── De klap en de nasleep ──
  { id: 'wond',      label: 'Wond',               icoon: 'droplet',       soort: 'flits',    duur: 900,  kleur: '#8c1a12', klank: 'dreun' },
  { id: 'kritiek',   label: 'Kritiek',            icoon: 'swords',        soort: 'flits',    duur: 700,  kleur: '#c21807', klank: 'klap' },
  { id: 'stervend',  label: 'Op sterven na dood', icoon: 'heart-crack',   soort: 'toestand', duur: null, kleur: '#5e0d0d', klank: 'hartslag' },
  { id: 'genezing',  label: 'Genezing',           icoon: 'sparkles',      soort: 'flits',    duur: 1400, kleur: '#e8c457', klank: 'gloed' },

  // ── De omgeving ──
  { id: 'vuur',      label: 'Vuur',               icoon: 'flame',         soort: 'toestand', duur: null, kleur: '#d2561b', klank: null },
  { id: 'vrieskou',  label: 'Vrieskou',           icoon: 'snowflake',     soort: 'toestand', duur: null, kleur: '#bcdcf0', klank: null },
  { id: 'gif',       label: 'Gif',                icoon: 'flask-conical', soort: 'toestand', duur: null, kleur: '#4f8c2a', klank: null },
  { id: 'regen',     label: 'Regen',              icoon: 'cloud-rain',    soort: 'toestand', duur: null, kleur: '#9fc0d8', klank: 'ruis' },
  { id: 'mist',      label: 'Mist',               icoon: 'cloud',         soort: 'toestand', duur: null, kleur: '#9aa0a6', klank: null },
  { id: 'duister',   label: 'Duister',            icoon: 'moon',          soort: 'toestand', duur: null, kleur: '#000000', klank: null },

  // ── Het onverwachte ──
  { id: 'bliksem',   label: 'Bliksem',            icoon: 'zap',           soort: 'flits',    duur: 1300, kleur: '#eaf2ff', klank: 'donder' },
  { id: 'windvlaag', label: 'Windvlaag',          icoon: 'wind',          soort: 'flits',    duur: 2300, kleur: null,      klank: 'vlaag' },
  { id: 'magie',     label: 'Magie',              icoon: 'sparkles',      soort: 'flits',    duur: 1100, kleur: '#8f6fe0', klank: 'zwiep' },
  { id: 'aardbeving',label: 'Aardbeving',         icoon: 'mountain',      soort: 'flits',    duur: 1600, kleur: '#6b5a44', klank: 'rommel' },
  { id: 'fluistering', label: 'Fluistering',      icoon: 'ear',           soort: 'toestand', duur: null, kleur: '#2a1f3a', klank: null },
  { id: 'glinstering', label: 'Glinstering',      icoon: 'star',          soort: 'flits',    duur: 1200, kleur: '#f0dca0', klank: 'tinkel' },
];

const FX_PER_ID = new Map(DISPLAY_FX.map(f => [f.id, f]));

/** Het effect met dit id, of null. */
function fxVoor(id) {
  return FX_PER_ID.get(String(id || '')) || null;
}

/**
 * Wat er over de lijn gaat naar het tafelscherm. De client hoeft de catalogus
 * dan niet te kennen: hij krijgt te horen wat hij moet tonen en hoe lang. Zo
 * blijft een oudere tablet die nog niet herladen is toch bruikbaar.
 */
function fxBericht(id) {
  if (id === 'uit') return { effect: 'uit', soort: 'uit' };
  const f = fxVoor(id);
  if (!f) return null;
  return { effect: f.id, soort: f.soort, duur: f.duur, kleur: f.kleur, klank: f.klank };
}

module.exports = { DISPLAY_FX, fxVoor, fxBericht };
