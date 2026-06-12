// ── Media-usage-scan ────────────────────────────────────────────────────────
// Berekent live (niet opgeslagen) welke fileId's waar in gebruik zijn. Een
// generieke deep-scan: doorzoek alle campagne-JSON-bestanden recursief op
// string-waarden die exact gelijk zijn aan een fileId. fileId's zijn opaque en
// lang, dus de kans op false positives is verwaarloosbaar — en nieuwe
// imageId-achtige velden worden automatisch meegenomen (geen veldenregister dat
// veroudert).
//
// Eén pass levert de gebruiksmap voor ÁLLE fileId's tegelijk.

const storage = require('./storage');

// JSON-bestanden die fileId-verwijzingen kunnen bevatten.
const SCAN_FILES = [
  'entities.json', 'dm-state.json', 'monsters.json', 'encounters.json',
  'combat.json', 'map.json', 'archief.json', 'sounds.json',
  'dungeon-maps.json', 'meta.json', 'progression.json',
];

// ── Label-mappers per bronbestand ───────────────────────────────────────────
// Geven een leesbaar label voor een match. Krijgen het hele datablok mee plus
// het fileId dat gezocht wordt; geven een lijst labels terug (een fileId kan
// binnen één bestand meerdere keren voorkomen). Onbekende paden vallen elders
// terug op de bestandsnaam.

function _entitiesLabels(data, id) {
  const out = [];
  const TYPE_LABEL = { personages: 'Personage', locaties: 'Locatie', organisaties: 'Organisatie', voorwerpen: 'Voorwerp' };
  for (const [type, lijst] of Object.entries(data)) {
    if (!Array.isArray(lijst)) continue;
    for (const e of lijst) {
      if (_deepHasValue(e, id)) out.push(`${TYPE_LABEL[type] || type}: ${e.name || e.id}`);
    }
  }
  return out;
}

function _monstersLabels(data, id) {
  const lijst = Array.isArray(data) ? data : (data.monsters || []);
  return lijst.filter(m => _deepHasValue(m, id)).map(m => `Monster: ${m.name || m.id}`);
}

function _encountersLabels(data, id) {
  return (data.encounters || []).filter(e => _deepHasValue(e, id)).map(e => `Encounter: ${e.name || e.id}`);
}

function _mapLabels(data, id) {
  const out = [];
  for (const m of (data.maps || [])) if (_deepHasValue(m, id)) out.push(`Kaart: ${m.label || m.name || m.id}`);
  for (const p of (data.pins || [])) if (_deepHasValue(p, id)) out.push(`Kaartpin: ${p.name || p.label || p.id}`);
  return out;
}

function _dungeonsLabels(data, id) {
  return (data.maps || []).filter(d => _deepHasValue(d, id)).map(d => `Dungeon: ${d.name || d.id}`);
}

function _archiefLabels(data, id) {
  const out = [];
  for (const d of (data.documents || [])) if (_deepHasValue(d, id) || d.id === id) out.push(`Document: ${d.name || d.id}`);
  for (const s of (data.sessieLog || [])) if (_deepHasValue(s, id)) out.push(`Sessielog: ${s.titel || s.datum || s.id}`);
  return out;
}

function _soundsLabels(data, id) {
  const out = [];
  for (const s of (data.library || [])) if (_deepHasValue(s, id)) out.push(`Geluid: ${s.naam || s.label || s.id}`);
  if (_deepHasValue(data.ambiance || {}, id)) out.push('Ambiance');
  if (_deepHasValue(data.emotes || {}, id)) out.push('Emote');
  return out;
}

const LABELERS = {
  'entities.json':     _entitiesLabels,
  'monsters.json':     _monstersLabels,
  'encounters.json':   _encountersLabels,
  'map.json':          _mapLabels,
  'dungeon-maps.json': _dungeonsLabels,
  'archief.json':      _archiefLabels,
  'sounds.json':       _soundsLabels,
};

const FALLBACK_LABEL = {
  'dm-state.json':    'DM-instellingen',
  'combat.json':      'Actief gevecht',
  'meta.json':        'Campagne-instellingen',
  'progression.json': 'Progressie (feature-media)',
};

// Recursief: bevat `node` ergens exact de string `id`?
function _deepHasValue(node, id) {
  if (node == null) return false;
  if (typeof node === 'string') return node === id;
  if (Array.isArray(node)) return node.some(v => _deepHasValue(v, id));
  if (typeof node === 'object') {
    for (const v of Object.values(node)) if (_deepHasValue(v, id)) return true;
  }
  return false;
}

// Verzamel alle string-waarden in een datablok (voor de globale scan: welke
// fileId's komen überhaupt voor).
function _collectStrings(node, set) {
  if (node == null) return;
  if (typeof node === 'string') { set.add(node); return; }
  if (Array.isArray(node)) { for (const v of node) _collectStrings(v, set); return; }
  if (typeof node === 'object') { for (const v of Object.values(node)) _collectStrings(v, set); }
}

// ── Publieke API ────────────────────────────────────────────────────────────

// Bouwt { fileId → [labels] } voor de meegegeven set fileId's (of voor alle
// voorkomende strings als geen set is gegeven). Eén pass over alle JSON.
function scanUsage(fileIds = null) {
  const idSet = fileIds ? new Set(fileIds) : null;
  const usage = {};
  if (idSet) for (const id of idSet) usage[id] = [];

  for (const fname of SCAN_FILES) {
    let data;
    try { data = storage.readJSON(fname); } catch { continue; }
    if (!data || typeof data !== 'object') continue;

    const labeler = LABELERS[fname];
    // Welke kandidaat-id's checken we in dit bestand?
    const present = new Set();
    _collectStrings(data, present);

    for (const id of present) {
      if (idSet && !idSet.has(id)) continue;        // alleen gevraagde id's
      if (!idSet && !usage[id]) usage[id] = [];     // open scan: registreer id
      else if (!usage[id]) usage[id] = [];

      const labels = labeler ? labeler(data, id) : [];
      if (labels.length) usage[id].push(...labels);
      else usage[id].push(FALLBACK_LABEL[fname] || fname.replace('.json', ''));
    }
  }
  return usage;
}

// Is dit fileId nog ergens in gebruik? (na verwijderen van het record aanroepen)
function isUsed(fileId) {
  const u = scanUsage([fileId]);
  return (u[fileId] || []).length > 0;
}

module.exports = { scanUsage, isUsed, SCAN_FILES };
