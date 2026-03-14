const express = require('express');
const multer = require('multer');
const storage = require('../lib/storage');
const { requireDM, attachRole } = require('./auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── Helpers ──

function filterEntityForPlayer(entity, dmState) {
  if (dmState.visibility[entity.id] === 'hidden') return null;
  const e = { ...entity, data: { ...entity.data } };
  // Strip geheim unless secretReveal is on
  if (!dmState.secretReveals[entity.id]) {
    delete e.data.geheim;
  }
  // Strip stats — DM only
  delete e.stats;
  return e;
}

function filterDocForPlayer(doc, dmState) {
  const state = dmState.docStates[doc.id] || 'hidden';
  if (state === 'hidden') return null;
  const d = { ...doc, state };
  if (state === 'blurred') {
    d.npcs = [];
    d.locs = [];
    d.docs = [];
  }
  return d;
}

// ── Entity CRUD ──

router.get('/entities/:type', attachRole, (req, res) => {
  const { type } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState = storage.readJSON('dm-state.json');
  let list = entities[type] || [];
  if (req.role !== 'dm') {
    list = list.map(e => filterEntityForPlayer(e, dmState)).filter(Boolean);
  } else {
    // Attach visibility/secret info for DM
    list = list.map(e => ({
      ...e,
      _visibility: dmState.visibility[e.id] || 'hidden',
      _secretReveal: !!dmState.secretReveals[e.id],
      _dmNote: dmState.dmNotes[e.id] || '',
    }));
  }
  res.json(list);
});

router.get('/entities/:type/:id', attachRole, (req, res) => {
  const { type, id } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState = storage.readJSON('dm-state.json');
  const entity = (entities[type] || []).find(e => e.id === id);
  if (!entity) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.role !== 'dm') {
    const filtered = filterEntityForPlayer(entity, dmState);
    if (!filtered) return res.status(404).json({ error: 'Niet gevonden' });
    return res.json(filtered);
  }
  res.json({
    ...entity,
    _visibility: dmState.visibility[entity.id] || 'hidden',
    _secretReveal: !!dmState.secretReveals[entity.id],
    _dmNote: dmState.dmNotes[entity.id] || '',
  });
});

router.post('/entities/:type', requireDM, (req, res) => {
  try {
    const { type } = req.params;
    if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
    const entities = storage.readJSON('entities.json');
    const dmState = storage.readJSON('dm-state.json');
    if (!entities[type]) entities[type] = [];
    const entity = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: req.body.name || 'Naamloos',
      icon: req.body.icon || '',
      subtype: req.body.subtype || '',
      data: req.body.data || {},
      links: req.body.links || { personages: [], locaties: [], organisaties: [], voorwerpen: [], archief: [] },
      stats: req.body.stats || null,
    };
    entities[type].push(entity);
    dmState.visibility[entity.id] = 'hidden';
    storage.writeJSON('entities.json', entities);
    storage.writeJSON('dm-state.json', dmState);
    req.app.get('io').emit('entity:updated', { type, id: entity.id });
    res.status(201).json(entity);
  } catch (err) {
    console.error('POST /entities/:type error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/entities/:type/:id', requireDM, (req, res) => {
  const { type, id } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const idx = (entities[type] || []).findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  const updated = { ...entities[type][idx], ...req.body, id };
  entities[type][idx] = updated;
  storage.writeJSON('entities.json', entities);
  req.app.get('io').emit('entity:updated', { type, id });
  res.json(updated);
});

router.delete('/entities/:type/:id', requireDM, (req, res) => {
  const { type, id } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState = storage.readJSON('dm-state.json');
  entities[type] = (entities[type] || []).filter(e => e.id !== id);
  delete dmState.visibility[id];
  delete dmState.secretReveals[id];
  delete dmState.dmNotes[id];
  storage.writeJSON('entities.json', entities);
  storage.writeJSON('dm-state.json', dmState);
  storage.deleteFile(id);
  req.app.get('io').emit('entity:updated', { type, id, deleted: true });
  res.json({ ok: true });
});

// ── Visibility & Secret toggles ──

router.put('/entities/:type/:id/visibility', requireDM, (req, res) => {
  const { id } = req.params;
  const dmState = storage.readJSON('dm-state.json');
  const current = dmState.visibility[id] || 'hidden';
  dmState.visibility[id] = current === 'visible' ? 'hidden' : 'visible';
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:visibility', { id, visibility: dmState.visibility[id] });
  res.json({ visibility: dmState.visibility[id] });
});

router.put('/entities/:type/:id/secret', requireDM, (req, res) => {
  const { id } = req.params;
  const dmState = storage.readJSON('dm-state.json');
  dmState.secretReveals[id] = !dmState.secretReveals[id];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:secret', { id, secretReveal: dmState.secretReveals[id] });
  res.json({ secretReveal: dmState.secretReveals[id] });
});

// ── DM Notes ──

router.get('/dm/notes/:id', requireDM, (req, res) => {
  const dmState = storage.readJSON('dm-state.json');
  res.json({ note: dmState.dmNotes[req.params.id] || '' });
});

router.put('/dm/notes/:id', requireDM, (req, res) => {
  const dmState = storage.readJSON('dm-state.json');
  dmState.dmNotes[req.params.id] = req.body.note || '';
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Archief ──

router.get('/archief', attachRole, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = storage.readJSON('dm-state.json');
  let docs = archief.documents || [];
  if (req.role !== 'dm') {
    docs = docs.map(d => filterDocForPlayer(d, dmState)).filter(Boolean);
  } else {
    docs = docs.map(d => ({
      ...d,
      state: dmState.docStates[d.id] || 'hidden',
      _dmNote: dmState.dmNotes[d.id] || '',
    }));
  }
  res.json({
    documents: docs,
    logEntries: archief.logEntries,
    sessieLog: req.role === 'dm'
      ? archief.sessieLog || []
      : (archief.sessieLog || []).filter(e => e.visible),
    hiddenLinks: req.role === 'dm' ? archief.hiddenLinks : {},
    tekstContent: req.role === 'dm'
      ? archief.tekstContent
      : Object.fromEntries(
          Object.entries(archief.tekstContent || {}).filter(([id]) => {
            const state = dmState.docStates[id] || 'hidden';
            return state === 'revealed';
          })
        ),
  });
});

router.post('/archief', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = storage.readJSON('dm-state.json');
  const doc = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: req.body.name || 'Naamloos document',
    type: req.body.type || 'Brief',
    cat: req.body.cat || 'brieven',
    desc: req.body.desc || '',
    icon: req.body.icon || '\u2709\ufe0f',
    hoofdstuk: req.body.hoofdstuk || '',
    npcs: req.body.npcs || [],
    locs: req.body.locs || [],
    docs: req.body.docs || [],
  };
  archief.documents.push(doc);
  dmState.docStates[doc.id] = 'hidden';
  storage.writeJSON('archief.json', archief);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('archief:updated', { id: doc.id });
  res.status(201).json(doc);
});

router.get('/archief/:id', attachRole, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = storage.readJSON('dm-state.json');
  const doc = (archief.documents || []).find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.role !== 'dm') {
    const filtered = filterDocForPlayer(doc, dmState);
    if (!filtered) return res.status(404).json({ error: 'Niet gevonden' });
    return res.json(filtered);
  }
  res.json({ ...doc, state: dmState.docStates[doc.id] || 'hidden', _dmNote: dmState.dmNotes[doc.id] || '' });
});

router.put('/archief/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.documents || []).findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  archief.documents[idx] = { ...archief.documents[idx], ...req.body, id: req.params.id };
  storage.writeJSON('archief.json', archief);
  req.app.get('io').emit('archief:updated', { id: req.params.id });
  res.json(archief.documents[idx]);
});

router.delete('/archief/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = storage.readJSON('dm-state.json');
  archief.documents = (archief.documents || []).filter(d => d.id !== req.params.id);
  archief.logEntries = (archief.logEntries || []).filter(e => e.docId !== req.params.id);
  delete archief.hiddenLinks[req.params.id];
  delete archief.tekstContent[req.params.id];
  delete dmState.docStates[req.params.id];
  delete dmState.dmNotes[req.params.id];
  storage.writeJSON('archief.json', archief);
  storage.writeJSON('dm-state.json', dmState);
  storage.deleteFile(req.params.id);
  req.app.get('io').emit('archief:updated', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

router.put('/archief/:id/state', requireDM, (req, res) => {
  const { state } = req.body;
  if (!['hidden', 'blurred', 'revealed'].includes(state)) {
    return res.status(400).json({ error: 'Ongeldige state' });
  }
  const archief = storage.readJSON('archief.json');
  const dmState = storage.readJSON('dm-state.json');
  const doc = (archief.documents || []).find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Niet gevonden' });
  const oldState = dmState.docStates[doc.id];
  dmState.docStates[doc.id] = state;
  // Add log entry on reveal
  if (state === 'revealed' && oldState !== 'revealed') {
    archief.logEntries.push({
      hoofdstuk: doc.hoofdstuk,
      event: doc.name,
      icon: doc.icon,
      docId: doc.id,
      timestamp: Date.now(),
    });
    storage.writeJSON('archief.json', archief);
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('archief:stateChanged', { id: doc.id, state });
  res.json({ state });
});

// ── Archief hidden links ──

router.put('/archief/:id/hidden-links', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  archief.hiddenLinks[req.params.id] = req.body;
  storage.writeJSON('archief.json', archief);
  res.json({ ok: true });
});

// ── Archief tekst content ──

router.put('/archief/:id/tekst', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  archief.tekstContent[req.params.id] = req.body.tekst || '';
  storage.writeJSON('archief.json', archief);
  res.json({ ok: true });
});

// ── Sessie Log ──

router.post('/sessieLog', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  if (!archief.sessieLog) archief.sessieLog = [];
  const entry = {
    id: 'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hoofdstuk: req.body.hoofdstuk || '',
    datum: req.body.datum || '',
    korteSamenvatting: req.body.korteSamenvatting || '',
    samenvatting: req.body.samenvatting || '',
    nieuw: req.body.nieuw || [],
    terugkerend: req.body.terugkerend || [],
  };
  archief.sessieLog.push(entry);
  storage.writeJSON('archief.json', archief);
  req.app.get('io').emit('logboek:updated', { id: entry.id });
  res.status(201).json(entry);
});

router.put('/sessieLog/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  if (!archief.sessieLog) archief.sessieLog = [];
  const idx = archief.sessieLog.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  archief.sessieLog[idx] = { ...archief.sessieLog[idx], ...req.body, id: req.params.id };
  storage.writeJSON('archief.json', archief);
  req.app.get('io').emit('logboek:updated', { id: req.params.id });
  res.json(archief.sessieLog[idx]);
});

router.delete('/sessieLog/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  if (!archief.sessieLog) archief.sessieLog = [];
  archief.sessieLog = archief.sessieLog.filter(e => e.id !== req.params.id);
  storage.writeJSON('archief.json', archief);
  req.app.get('io').emit('logboek:updated', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

// ── Files ──

router.post('/files/:id', requireDM, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand' });
  const filename = storage.saveFile(req.params.id, req.file.buffer, req.file.mimetype);
  res.json({ filename });
});

router.get('/files/:id', (req, res) => {
  const file = storage.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Niet gevonden' });
  res.type(file.mimetype).sendFile(file.path);
});

router.delete('/files/:id', requireDM, (req, res) => {
  storage.deleteFile(req.params.id);
  res.json({ ok: true });
});

// ── Meta ──

router.get('/meta', (req, res) => {
  res.json(storage.readJSON('meta.json'));
});

module.exports = router;
