const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');

const DEFAULTS = {
  'entities.json': { personages: [], locaties: [], organisaties: [], voorwerpen: [] },
  'archief.json': { documents: [], logEntries: [], sessieLog: [], hiddenLinks: {}, tekstContent: {} },
  'dm-state.json': { visibility: {}, secretReveals: {}, dmNotes: {}, docStates: {}, deceased: {} },
  'map.json': { pins: [] },
  'tables.json': { tables: [] },
  'combat.json': { active: false, round: 1, currentTurn: 0, combatants: [] },
  'player-notes.json': {},
  'meta.json': {
    appTitle: 'Grisburgh',
    appSubtitle: 'Ontdekkingen uit het stadsarchief',
    hoofdstukken: {
      h1:  { num: 1, title: 'Dauwdag', dag: 'Dag van Matall, de Maker', short: 'H1 \u00b7 Dauwdag' },
      h2:  { num: 2, title: 'Een gestolen stem', dag: 'Dag van Seldari, Stormoog', short: 'H2 \u00b7 Gestolen stem' },
      h3:  { num: 3, title: 'De Heeren van de Nacht', dag: 'Dag van Ghon, de Loper', short: 'H3 \u00b7 Heeren v/d Nacht' },
      h4:  { num: 4, title: 'Op zee!', dag: 'Dag van Tirimet, Elvenluit', short: 'H4 \u00b7 Op zee!' },
      h5:  { num: 5, title: 'Het Amberwoud', dag: 'Dag van Velurut, de Jager', short: 'H5 \u00b7 Amberwoud' },
      h6:  { num: 6, title: 'De Gulthiasboom', dag: 'Dag van Velurut, de Jager', short: 'H6 \u00b7 Gulthiasboom' },
      h7:  { num: 7, title: 'Draken, stormen en vreemd bezoek', dag: 'Dag 6\u20137 van het Lichtfeest', short: 'H7 \u00b7 Draken & stormen' },
      h8:  { num: 8, title: 'Een onverwachte toren', dag: 'Dag van Oronoe\u0308, de Zephir', short: 'H8 \u00b7 De toren' },
      h9:  { num: 9, title: 'Roes bij het Nymfenblad', dag: 'Dag van Sehan, de Weegschaal', short: 'H9 \u00b7 Nymfenblad' },
      h10: { num: 10, title: 'Het varkentje in de toren', dag: 'Dag van Yrdus, de Ringdrager', short: 'H10 \u00b7 Varkentje' },
      os1: { num: 90, title: 'Terreur voor het Tribunaal', dag: 'One-shot', short: 'OS \u00b7 Tribunaal' },
      os2: { num: 91, title: 'Het profijt van extradimensionale ruimtes', dag: 'One-shot', short: 'OS \u00b7 Extradimensionaal' },
    }
  },
};

// Ensure data directory and default files exist
function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
  for (const [file, defaults] of Object.entries(DEFAULTS)) {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, JSON.stringify(defaults, null, 2));
    }
  }
}

function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function writeJSON(filename, data) {
  const fp = path.join(DATA_DIR, filename);
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
  // Delete old file first (might be different extension)
  deleteFile(id);
  const ext = MIME_TO_EXT[mimetype] || (mimetype.split('/')[1] || 'bin');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(FILES_DIR, filename), buffer);
  return filename;
}

function getFile(id) {
  const files = fs.readdirSync(FILES_DIR);
  const match = files.find(f => f.startsWith(id + '.'));
  if (!match) return null;
  const ext = match.split('.').pop();
  return {
    path: path.join(FILES_DIR, match),
    filename: match,
    mimetype: EXT_TO_MIME[ext] || 'application/octet-stream',
  };
}

function deleteFile(id) {
  const file = getFile(id);
  if (file) fs.unlinkSync(file.path);
}

module.exports = { init, readJSON, writeJSON, saveFile, getFile, deleteFile, DATA_DIR, FILES_DIR };
