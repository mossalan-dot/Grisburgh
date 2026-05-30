/**
 * lib/downtime.js — Rustdagen (downtime tussen sessies)
 *
 * Pure, testbare logica voor de downtime-activiteiten (geïnspireerd op de
 * 2024 PHB) en de campagnefase die bepaalt hoeveel ruimte er is:
 *   • 'twaalfdaagse' — de Heilige Twaalfdaagse: alleen de avonden zijn vrij,
 *     dus enkel activiteiten die in een avond passen.
 *   • 'open'         — na Lichtmis: ruimte voor langere ondernemingen.
 */

'use strict';

// ── Standaardcatalogus ─────────────────────────────────────────────
// `avond: true`  → past in een avond (beschikbaar tijdens de Twaalfdaagse).
// `avond: false` → vergt aaneengesloten dagen (pas beschikbaar na Lichtmis).
const DEFAULT_ACTIVITEITEN = [
  { id: 'werken',       naam: 'Werken',                emoji: '⚒️', categorie: 'Verdienen', avond: true,
    omschrijving: 'Verricht betaald werk met een vaardigheid of gereedschap en verdien een loon.',
    duur: 'Een avond', kosten: '—', opbrengst: 'Inkomen naar gelang je worp' },
  { id: 'onderzoek',    naam: 'Onderzoek',             emoji: '🔍', categorie: 'Weten', avond: true,
    omschrijving: 'Doorzoek archieven, bibliotheken en geruchten naar kennis over een onderwerp.',
    duur: 'Avond(en)', kosten: 'Toegang of steekpenningen', opbrengst: 'Informatie van de Verteller' },
  { id: 'verbroederen', naam: 'Verbroederen',          emoji: '🍺', categorie: 'Sociaal', avond: true,
    omschrijving: 'Breng de avond door in de kroeg, leg contacten en vang geruchten op.',
    duur: 'Een avond', kosten: 'Een paar centelingen', opbrengst: 'Contacten & roddels' },
  { id: 'devotie',      naam: 'Gebed & Devotie',       emoji: '🕯️', categorie: 'Geest', avond: true,
    omschrijving: 'Wijd de avond aan bezinning en gebed — toepasselijk tijdens de Heilige Twaalfdaagse.',
    duur: 'Een avond', kosten: 'Een offer', opbrengst: 'Zegen of inzicht naar oordeel van de Verteller' },
  { id: 'herstel',      naam: 'Herstel',               emoji: '🛌', categorie: 'Lichaam', avond: true,
    omschrijving: 'Rust uit, verzorg wonden en kom op krachten.',
    duur: 'Avond(en)', kosten: '—', opbrengst: 'Herstel van kwalen en uitputting' },
  { id: 'spreukenboek', naam: 'Spreuken overschrijven', emoji: '📖', categorie: 'Magie', avond: true,
    omschrijving: 'Werk je spreukenboek bij door spreuken over te schrijven.',
    duur: 'Avond(en)', kosten: 'Inkt & materiaal per spreukniveau', opbrengst: 'Spreuken in je boek' },
  { id: 'ambacht',      naam: 'Ambacht',               emoji: '🔨', categorie: 'Maken', avond: false,
    omschrijving: 'Maak uitrusting, gezondheidsdrankjes, spreukrollen of magische voorwerpen met het juiste gereedschap.',
    duur: 'Dagen', kosten: 'Helft van de marktprijs aan materiaal', opbrengst: 'Het gemaakte voorwerp' },
  { id: 'training',     naam: 'Training',              emoji: '📚', categorie: 'Leren', avond: false,
    omschrijving: 'Leer een taal of word vaardig met een set gereedschap onder begeleiding van een leermeester.',
    duur: 'Weken', kosten: '± 1 knaker per dag', opbrengst: 'Nieuwe taal- of gereedschapsvaardigheid' },
];

const FASEN = {
  twaalfdaagse: {
    id: 'twaalfdaagse',
    label: 'De Heilige Twaalfdaagse',
    omschrijving: 'Alleen de avonden zijn vrij — korte bezigheden tussen de plechtigheden door.',
  },
  open: {
    id: 'open',
    label: 'Na Lichtmis',
    omschrijving: 'De dagen liggen open — ruimte voor langere ondernemingen.',
  },
};

const DEFAULT_DOWNTIME = {
  enabled:      true,
  fase:         'twaalfdaagse',
  activiteiten: DEFAULT_ACTIVITEITEN,
};

function _slug() {
  return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Vul ontbrekende velden aan en saneer de configuratie.
function ensureDowntime(raw) {
  const d = { ...DEFAULT_DOWNTIME, ...(raw || {}) };
  d.enabled = !!d.enabled;
  if (!FASEN[d.fase]) d.fase = 'twaalfdaagse';
  if (!Array.isArray(d.activiteiten) || d.activiteiten.length === 0) d.activiteiten = DEFAULT_ACTIVITEITEN;
  d.activiteiten = d.activiteiten.map(a => ({
    id:           String(a?.id || _slug()),
    naam:         String(a?.naam || 'Activiteit'),
    emoji:        String(a?.emoji || '•'),
    categorie:    String(a?.categorie || ''),
    avond:        !!a?.avond,
    omschrijving: String(a?.omschrijving || ''),
    duur:         String(a?.duur || ''),
    kosten:       String(a?.kosten || ''),
    opbrengst:    String(a?.opbrengst || ''),
  }));
  return d;
}

// Is een activiteit beschikbaar in de gegeven fase?
function beschikbaar(activiteit, fase) {
  return fase === 'open' ? true : !!activiteit.avond;
}

// Geef de fase-info (label + omschrijving) terug.
function faseInfo(fase) {
  return FASEN[fase] || FASEN.twaalfdaagse;
}

module.exports = {
  DEFAULT_ACTIVITEITEN,
  FASEN,
  DEFAULT_DOWNTIME,
  ensureDowntime,
  beschikbaar,
  faseInfo,
};
