const fs   = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// BASE_DIR is overschrijfbaar via GRISBURGH_DATA_DIR zodat tests in een
// geïsoleerde tmpdir kunnen draaien i.p.v. de echte ./data te raken (#47).
const BASE_DIR       = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const CAMPAIGNS_DIR  = path.join(BASE_DIR, 'campaigns');
const ACTIVE_FILE    = path.join(BASE_DIR, 'active-campaign.json');

// ── Per-request campaign scoping via AsyncLocalStorage ──
// Middleware can call runInCampaign(id, next) to make all storage calls in
// that request use a different campaign directory automatically.
const _als = new AsyncLocalStorage();

// ── Actieve campagne ──
let _activeCampaignId = 'grisburgh';
let _DATA_DIR  = path.join(CAMPAIGNS_DIR, _activeCampaignId);
let _FILES_DIR = path.join(_DATA_DIR, 'files');

function getActiveCampaignId() { return _activeCampaignId; }

function setCampaign(id) {
  _activeCampaignId = id;
  _DATA_DIR  = path.join(CAMPAIGNS_DIR, id);
  _FILES_DIR = path.join(_DATA_DIR, 'files');
  fs.mkdirSync(_DATA_DIR,  { recursive: true });
  fs.mkdirSync(_FILES_DIR, { recursive: true });
  // Persist active campaign
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify({ id }, null, 2));
}

function loadActiveCampaign() {
  try {
    const { id } = JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
    setCampaign(id);
  } catch {
    setCampaign('grisburgh');
  }
}

// ── Beschikbare campagnes ──
function listCampaigns() {
  fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  return fs.readdirSync(CAMPAIGNS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      let meta = { appTitle: d.name, theme: 'default' };
      try { meta = { ...meta, ...JSON.parse(fs.readFileSync(path.join(CAMPAIGNS_DIR, d.name, 'meta.json'), 'utf8')) }; } catch {}
      return { id: d.name, ...meta };
    });
}

function createCampaign(id, meta = {}) {
  const dir = path.join(CAMPAIGNS_DIR, id);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const defaults = {
    'entities.json':    { personages: [], locaties: [], organisaties: [], voorwerpen: [] },
    'archief.json':     { documents: [], logEntries: [], sessieLog: [], hiddenLinks: {}, tekstContent: {} },
    'dm-state.json':    { activeGroup: 'groep1', groups: { groep1: { name: 'Groep 1', visibility: {}, secretReveals: {}, deceased: {}, itemOwners: {}, itemRequests: [], tradeAllowed: true } }, dmNotes: {}, docStates: {}, playerCurrency: {}, playerSpellSlots: {}, playerItems: {}, playerProfiles: {}, playerTrackers: {}, playerSpells: {}, playerInspiration: {}, trash: [] },
    'combat.json':      { active: false, round: 1, currentTurn: 0, combatants: [] },
    'map.json':         { pins: [] },
    'monsters.json':    [],
    'encounters.json':  { encounters: [] },
    'player-notes.json':{},
    'sounds.json':      { library: [], emotes: {} },
    'tables.json':      { tables: [] },
    'meta.json':        { appTitle: id, appSubtitle: '', theme: 'default', currency: { fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' }, spellSource: 'dnd5e', hoofdstukken: {}, ...meta },
  };
  for (const [file, content] of Object.entries(defaults)) {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(content, null, 2));
  }
}

const DEFAULTS = {
  'entities.json':    { personages: [], locaties: [], organisaties: [], voorwerpen: [] },
  'archief.json':     { documents: [], logEntries: [], sessieLog: [], hiddenLinks: {}, tekstContent: {} },
  'dm-state.json':    { visibility: {}, secretReveals: {}, dmNotes: {}, docStates: {}, deceased: {} },
  'map.json':         { pins: [] },
  'tables.json':      { tables: [] },
  'combat.json':      { active: false, round: 1, currentTurn: 0, combatants: [] },
  'player-notes.json':{},
  'meta.json':        { appTitle: 'Grisburgh', appSubtitle: '', theme: 'default', currency: { fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' }, spellSource: 'dnd5e', hoofdstukken: {} },
  'relations.json':   { edges: [], positions: {} },
  'dungeon-maps.json': { maps: [] },
  'encounters.json':   { encounters: [] },
};

function init() {
  fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  loadActiveCampaign();
  fs.mkdirSync(_DATA_DIR,  { recursive: true });
  fs.mkdirSync(_FILES_DIR, { recursive: true });
  for (const [file, defaults] of Object.entries(DEFAULTS)) {
    const fp = path.join(_DATA_DIR, file);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(defaults, null, 2));
  }
}

// Returns the data-dir for the current async context (request), or the global one
function _curDataDir()  { return _als.getStore() ?? _DATA_DIR; }
function _curFilesDir() { return path.join(_curDataDir(), 'files'); }

// Runs fn() (e.g. express next()) inside a context that uses campaignId's directory.
// All readJSON / writeJSON / file operations inside fn automatically use that campaign.
function runInCampaign(campaignId, fn) {
  const dir = path.join(CAMPAIGNS_DIR, campaignId);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  return _als.run(dir, fn);
}

// Ensures the sandbox campaign files exist (called on server start)
function initSandbox() {
  createCampaign('sandbox', {
    appTitle:    'Sandbox',
    appSubtitle: 'Demo omgeving',
    theme:       'default',
  });
}

// Kritieke bestanden waarvan we vóór elke overschrijving een roterende backup
// bewaren (laatste _BACKUP_KEEP versies). Beschermt spelers-/campagnedata tegen
// per-ongeluk wissen. combat/map e.d. churnen te vaak en staan er bewust niet bij.
const _BACKUP_FILES = new Set(['archief.json', 'meta.json', 'dm-state.json', 'entities.json']);
const _BACKUP_KEEP  = 10;
function _ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }

function readJSON(filename) {
  const fp = path.join(_curDataDir(), filename);
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf8');
  } catch (err) {
    // Bestand bestaat niet → legitieme first-run: geef de default terug.
    if (err.code === 'ENOENT') return DEFAULTS[filename] || {};
    throw err;
  }
  // Een leeg bestand bevat geen data om te verliezen → veilig defaulten.
  if (!raw.trim()) return DEFAULTS[filename] || {};
  try {
    return JSON.parse(raw);
  } catch {
    // Bestand bestaat WÉL maar is corrupt. Stil de default teruggeven zou de
    // eerstvolgende write de echte data laten overschrijven (= dataverlies).
    // Bewaar het corrupte bestand en gooi door, zodat het endpoint faalt
    // i.p.v. stilletjes te wissen.
    try {
      const bak = `${fp}.corrupt.${_ts()}`;
      fs.copyFileSync(fp, bak);
      console.error(`[storage] Corrupt JSON in ${filename} — bewaard als ${path.basename(bak)}; lees-actie afgebroken (geen overschrijving).`);
    } catch (e2) { console.error('[storage] Kon corrupt bestand niet bewaren:', e2.message); }
    throw new Error(`Corrupt JSON-bestand: ${filename}`);
  }
}

function writeJSON(filename, data) {
  const fp = path.join(_curDataDir(), filename);
  // Roterende backup vóór overschrijven (alleen kritieke, reeds bestaande bestanden).
  if (_BACKUP_FILES.has(filename) && fs.existsSync(fp)) {
    try {
      const bdir = path.join(_curDataDir(), 'backups');
      fs.mkdirSync(bdir, { recursive: true });
      fs.copyFileSync(fp, path.join(bdir, `${filename}.${_ts()}.json`));
      const prefix = `${filename}.`;
      const olds = fs.readdirSync(bdir).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort();
      for (const f of olds.slice(0, Math.max(0, olds.length - _BACKUP_KEEP))) {
        try { fs.unlinkSync(path.join(bdir, f)); } catch { /* ok */ }
      }
    } catch (e) { console.error('[storage] backup mislukt voor', filename, e.message); }
  }
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fp);
}

// File handling (images, PDFs, audio)
const EXT_TO_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  mp4: 'video/mp4', webm: 'video/webm',
};
const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/ogg': 'ogg', 'audio/wav': 'wav',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};

function saveFile(id, buffer, mimetype) {
  deleteFile(id);
  const ext = MIME_TO_EXT[mimetype] || (mimetype.split('/')[1] || 'bin');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(_curFilesDir(), filename), buffer);
  return filename;
}

function getFile(id) {
  try {
    const files = fs.readdirSync(_curFilesDir());
    const match = files.find(f => f.startsWith(id + '.'));
    if (!match) return null;
    const ext = match.split('.').pop();
    return { path: path.join(_curFilesDir(), match), filename: match, mimetype: EXT_TO_MIME[ext] || 'application/octet-stream' };
  } catch { return null; }
}

function deleteFile(id) {
  const file = getFile(id);
  if (file) try { fs.unlinkSync(file.path); } catch {}
}

// DATA_DIR / FILES_DIR getters: respect async-local-storage context so code that
// reads `storage.DATA_DIR` (e.g. thumbnail paths) automatically uses the right dir.
module.exports = {
  init, readJSON, writeJSON, saveFile, getFile, deleteFile,
  getActiveCampaignId, setCampaign, loadActiveCampaign, listCampaigns, createCampaign,
  runInCampaign, initSandbox, CAMPAIGNS_DIR,
  get DATA_DIR()  { return _curDataDir(); },
  get FILES_DIR() { return _curFilesDir(); },
};
