const fs = require('fs');
const path = require('path');

const BASE_DIR       = path.join(__dirname, '..', 'data');
const CAMPAIGNS_DIR  = path.join(BASE_DIR, 'campaigns');
const ACTIVE_FILE    = path.join(BASE_DIR, 'active-campaign.json');

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

function readJSON(filename) {
  const fp = path.join(_DATA_DIR, filename);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return DEFAULTS[filename] || {}; }
}

function writeJSON(filename, data) {
  const fp = path.join(_DATA_DIR, filename);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fp);
}

// File handling (images, PDFs, audio)
const EXT_TO_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
};
const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/ogg': 'ogg', 'audio/wav': 'wav',
};

function saveFile(id, buffer, mimetype) {
  deleteFile(id);
  const ext = MIME_TO_EXT[mimetype] || (mimetype.split('/')[1] || 'bin');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(_FILES_DIR, filename), buffer);
  return filename;
}

function getFile(id) {
  try {
    const files = fs.readdirSync(_FILES_DIR);
    const match = files.find(f => f.startsWith(id + '.'));
    if (!match) return null;
    const ext = match.split('.').pop();
    return { path: path.join(_FILES_DIR, match), filename: match, mimetype: EXT_TO_MIME[ext] || 'application/octet-stream' };
  } catch { return null; }
}

function deleteFile(id) {
  const file = getFile(id);
  if (file) try { fs.unlinkSync(file.path); } catch {}
}

// Legacy exports (DATA_DIR, FILES_DIR) als getters voor achterwaartse compatibiliteit
module.exports = {
  init, readJSON, writeJSON, saveFile, getFile, deleteFile,
  getActiveCampaignId, setCampaign, loadActiveCampaign, listCampaigns, createCampaign,
  get DATA_DIR()  { return _DATA_DIR; },
  get FILES_DIR() { return _FILES_DIR; },
};
