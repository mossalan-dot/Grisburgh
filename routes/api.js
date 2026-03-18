const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const storage = require('../lib/storage');
const { requireDM, attachRole } = require('./auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── dm-state helpers ──

function readDmState() {
  const state = storage.readJSON('dm-state.json');
  if (!state.groups) {
    // Migreer oud plat formaat naar groepsstructuur
    const g = {
      name:          'Groep 1',
      visibility:    state.visibility    || {},
      secretReveals: state.secretReveals || {},
      deceased:      state.deceased      || {},
    };
    const migrated = {
      activeGroup: 'groep1',
      groups:      { groep1: g },
      dmNotes:     state.dmNotes   || {},
      docStates:   state.docStates || {},
    };
    storage.writeJSON('dm-state.json', migrated);
    return migrated;
  }
  return state;
}

function getGroup(dmState, groupId) {
  const id = groupId || dmState.activeGroup;
  return dmState.groups[id] || Object.values(dmState.groups)[0];
}

function groupInfoList(dmState) {
  return Object.entries(dmState.groups).map(([id, g]) => ({
    id,
    name:   g.name,
    active: id === dmState.activeGroup,
  }));
}

// ── Entity player filter ──

function filterEntityForPlayer(entity, dmState) {
  const g   = getGroup(dmState);
  const vis = g.visibility[entity.id] || 'hidden';
  if (vis === 'hidden') return null;
  if (vis === 'vague') {
    return {
      id:          entity.id,
      name:        entity.name,
      subtype:     entity.subtype || '',
      data:        {},
      links:       {},
      _visibility: 'vague',
    };
  }
  // Visible: full entity, strip DM-only fields
  const e = { ...entity, data: { ...entity.data } };
  if (!g.secretReveals[entity.id]) delete e.data.geheim;
  delete e.stats;
  e._deceased = !!(g.deceased?.[entity.id]);
  return e;
}

function filterDocForPlayer(doc, dmState) {
  const state = dmState.docStates[doc.id] || 'hidden';
  if (state === 'hidden') return null;
  const d = { ...doc, state };
  if (state === 'blurred') {
    d.npcs = [];
    d.locs = [];
    d.orgs = [];
    d.items = [];
    d.docs = [];
  }
  return d;
}

// ── Entity CRUD ──

router.get('/entities/:type', attachRole, (req, res) => {
  const { type } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  let list = entities[type] || [];
  if (req.role !== 'dm') {
    list = list.map(e => filterEntityForPlayer(e, dmState)).filter(Boolean);
  } else {
    list = list.map(e => ({
      ...e,
      _visibility:   g.visibility[e.id]    || 'hidden',
      _secretReveal: !!g.secretReveals[e.id],
      _deceased:     !!(g.deceased?.[e.id]),
      _dmNote:       dmState.dmNotes[e.id]  || '',
    }));
  }
  res.json(list);
});

router.get('/entities/:type/:id', attachRole, (req, res) => {
  const { type, id } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  const entity   = (entities[type] || []).find(e => e.id === id);
  if (!entity) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.role !== 'dm') {
    const filtered = filterEntityForPlayer(entity, dmState);
    if (!filtered) return res.status(404).json({ error: 'Niet gevonden' });
    return res.json(filtered);
  }
  res.json({
    ...entity,
    _visibility:   g.visibility[entity.id]    || 'hidden',
    _secretReveal: !!g.secretReveals[entity.id],
    _deceased:     !!(g.deceased?.[entity.id]),
    _dmNote:       dmState.dmNotes[entity.id]  || '',
  });
});

router.post('/entities/:type', requireDM, (req, res) => {
  try {
    const { type } = req.params;
    if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
    const entities = storage.readJSON('entities.json');
    const dmState  = readDmState();
    if (!entities[type]) entities[type] = [];
    const entity = {
      id:      'e_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name:    req.body.name    || 'Naamloos',
      icon:    req.body.icon    || '',
      subtype: req.body.subtype || '',
      data:    req.body.data    || {},
      links:   req.body.links   || { personages: [], locaties: [], organisaties: [], voorwerpen: [], archief: [] },
      stats:   req.body.stats   || null,
    };
    entities[type].push(entity);
    // Nieuw entiteit begint verborgen in ALLE groepen
    for (const gid of Object.keys(dmState.groups)) {
      dmState.groups[gid].visibility[entity.id] = 'hidden';
    }
    // ── Bidirectionele links: voeg terugverwijzing toe bij gelinkte entiteiten ──
    for (const lt of ENTITY_TYPES) {
      for (const targetName of (entity.links[lt] || [])) {
        const target = (entities[lt] || []).find(e => e.name === targetName);
        if (!target) continue;
        if (!target.links) target.links = {};
        if (!Array.isArray(target.links[type])) target.links[type] = [];
        if (!target.links[type].includes(entity.name)) {
          target.links[type].push(entity.name);
        }
      }
    }
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

  const oldName  = entities[type][idx].name;
  const oldLinks = entities[type][idx].links || {};
  const newName  = req.body.name;
  const updated  = { ...entities[type][idx], ...req.body, id };
  entities[type][idx] = updated;

  // ── Cascade rename: update alle link-verwijzingen bij naamswijziging ──
  if (newName && newName !== oldName) {
    for (const et of ENTITY_TYPES) {
      for (const entity of (entities[et] || [])) {
        if (!entity.links) continue;
        let changed = false;
        for (const lt of Object.keys(entity.links)) {
          if (Array.isArray(entity.links[lt]) && entity.links[lt].includes(oldName)) {
            entity.links[lt] = entity.links[lt].map(n => n === oldName ? newName : n);
            changed = true;
          }
        }
        if (changed) req.app.get('io').emit('entity:updated', { type: et, id: entity.id });
      }
    }

    // Update namen in sessieLog
    const archief = storage.readJSON('archief.json');
    const LOG_FIELDS = ['nieuwPersonages','terugkerendPersonages','nieuwLocaties','terugkerendLocaties','organisaties','voorwerpen','nieuw','terugkerend'];
    let logChanged = false;
    for (const entry of (archief.sessieLog || [])) {
      for (const field of LOG_FIELDS) {
        if (Array.isArray(entry[field]) && entry[field].includes(oldName)) {
          entry[field] = entry[field].map(n => n === oldName ? newName : n);
          logChanged = true;
        }
      }
    }
    if (logChanged) {
      storage.writeJSON('archief.json', archief);
      req.app.get('io').emit('logboek:updated', {});
    }
  }

  // ── Bidirectionele links: sync terugverwijzingen ──
  const newLinks = updated.links || {};
  for (const lt of ENTITY_TYPES) {
    const oldSet = new Set(oldLinks[lt] || []);
    const newSet = new Set(newLinks[lt] || []);
    // Verwijderde links: haal terugverwijzing weg
    for (const targetName of oldSet) {
      if (!newSet.has(targetName)) {
        const target = (entities[lt] || []).find(e => e.name === targetName);
        if (target?.links?.[type]) {
          target.links[type] = target.links[type].filter(n => n !== oldName && n !== updated.name);
          req.app.get('io').emit('entity:updated', { type: lt, id: target.id });
        }
      }
    }
    // Toegevoegde links: voeg terugverwijzing toe
    for (const targetName of newSet) {
      if (!oldSet.has(targetName)) {
        const target = (entities[lt] || []).find(e => e.name === targetName);
        if (target) {
          if (!target.links) target.links = {};
          if (!Array.isArray(target.links[type])) target.links[type] = [];
          if (!target.links[type].includes(updated.name)) {
            target.links[type].push(updated.name);
            req.app.get('io').emit('entity:updated', { type: lt, id: target.id });
          }
        }
      }
    }
  }

  storage.writeJSON('entities.json', entities);
  req.app.get('io').emit('entity:updated', { type, id });
  res.json(updated);
});

router.delete('/entities/:type/:id', requireDM, (req, res) => {
  const { type, id } = req.params;
  if (!ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Ongeldig type' });
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  // ── Bidirectionele links: verwijder terugverwijzingen bij gelinkte entiteiten ──
  const dying = (entities[type] || []).find(e => e.id === id);
  if (dying) {
    for (const lt of ENTITY_TYPES) {
      for (const targetName of (dying.links?.[lt] || [])) {
        const target = (entities[lt] || []).find(e => e.name === targetName);
        if (target?.links?.[type]) {
          target.links[type] = target.links[type].filter(n => n !== dying.name);
        }
      }
    }
  }
  entities[type] = (entities[type] || []).filter(e => e.id !== id);
  // Verwijder uit ALLE groepen
  for (const gid of Object.keys(dmState.groups)) {
    delete dmState.groups[gid].visibility[id];
    delete dmState.groups[gid].secretReveals[id];
    if (dmState.groups[gid].deceased) delete dmState.groups[gid].deceased[id];
  }
  delete dmState.dmNotes[id];
  storage.writeJSON('entities.json', entities);
  storage.writeJSON('dm-state.json', dmState);
  storage.deleteFile(id);
  req.app.get('io').emit('entity:updated', { type, id, deleted: true });
  res.json({ ok: true });
});

// ── Visibility & Secret toggles ──

router.put('/entities/:type/:id/visibility', requireDM, (req, res) => {
  const { type, id } = req.params;
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  const current  = g.visibility[id] || 'hidden';
  const threeState = ['personages', 'locaties'].includes(type);
  let next;
  if (req.body?.target === 'vague' && threeState) {
    next = 'vague';
  } else if (threeState) {
    next = current === 'visible' ? 'hidden' : 'visible';
  } else {
    next = current === 'visible' ? 'hidden' : 'visible';
  }
  g.visibility[id] = next;
  storage.writeJSON('dm-state.json', dmState);

  const entities = storage.readJSON('entities.json');
  const entity   = (entities[type] || []).find(e => e.id === id);
  req.app.get('io').emit('entity:visibility', { id, type, name: entity?.name || '', visibility: next });

  if (type === 'locaties' && next !== 'hidden') {
    const mapData = storage.readJSON('map.json');
    const hasPin  = (mapData.pins || []).some(p => p.locId === id);
    if (hasPin) {
      req.app.get('io').emit('map:pinRevealed', { id, name: entity?.name || '', visibility: next });
    }
  }
  res.json({ visibility: next });
});

router.put('/entities/:type/:id/secret', requireDM, (req, res) => {
  const { id } = req.params;
  const dmState = readDmState();
  const g       = getGroup(dmState);
  g.secretReveals[id] = !g.secretReveals[id];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:secret', { id, secretReveal: g.secretReveals[id] });
  res.json({ secretReveal: g.secretReveals[id] });
});

router.put('/entities/:type/:id/deceased', requireDM, (req, res) => {
  const { type, id } = req.params;
  const entities = storage.readJSON('entities.json');
  const entity   = (entities[type] || []).find(e => e.id === id);
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  if (!g.deceased) g.deceased = {};
  g.deceased[id] = !g.deceased[id];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:updated', { id, deceased: g.deceased[id] });
  if (g.deceased[id] && entity) {
    req.app.get('io').emit('entity:deceased', { id, type, name: entity.name });
  }
  res.json({ deceased: g.deceased[id] });
});

// ── DM Notes ──

router.get('/dm/notes/:id', requireDM, (req, res) => {
  const dmState = readDmState();
  res.json({ note: dmState.dmNotes[req.params.id] || '' });
});

router.put('/dm/notes/:id', requireDM, (req, res) => {
  const dmState = readDmState();
  dmState.dmNotes[req.params.id] = req.body.note || '';
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Groepen ──

router.get('/groups', requireDM, (req, res) => {
  const dmState = readDmState();
  res.json({ groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
});

router.post('/groups', requireDM, (req, res) => {
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  const id       = 'groep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  // Alle bestaande entiteiten beginnen verborgen in de nieuwe groep
  const visibility = {};
  for (const type of ENTITY_TYPES) {
    for (const e of (entities[type] || [])) visibility[e.id] = 'hidden';
  }
  dmState.groups[id] = {
    name:          req.body.name || 'Nieuwe groep',
    visibility,
    secretReveals: {},
    deceased:      {},
  };
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.status(201).json({ id, name: dmState.groups[id].name });
});

router.put('/groups/active', requireDM, (req, res) => {
  const { groupId } = req.body;
  const dmState = readDmState();
  if (!dmState.groups[groupId]) return res.status(404).json({ error: 'Groep niet gevonden' });
  dmState.activeGroup = groupId;
  storage.writeJSON('dm-state.json', dmState);

  // groups:updated triggert client-side herlaad van de sectie (zonder toast-spam)
  req.app.get('io').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: groupId });
  res.json({ activeGroup: groupId });
});

router.put('/groups/:id', requireDM, (req, res) => {
  const { id }  = req.params;
  const dmState = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (req.body.name) dmState.groups[id].name = req.body.name;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ id, name: dmState.groups[id].name });
});

router.delete('/groups/:id', requireDM, (req, res) => {
  const { id }  = req.params;
  const dmState = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (Object.keys(dmState.groups).length <= 1) return res.status(400).json({ error: 'Minimaal één groep vereist' });
  if (dmState.activeGroup === id) return res.status(400).json({ error: 'Wissel eerst van groep voor je deze verwijdert' });
  delete dmState.groups[id];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ ok: true });
});

// ── Archief ──

router.get('/archief', attachRole, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = readDmState();
  let docs = archief.documents || [];
  if (req.role !== 'dm') {
    docs = docs.map(d => filterDocForPlayer(d, dmState)).filter(Boolean);
  } else {
    docs = docs.map(d => ({
      ...d,
      state:   dmState.docStates[d.id] || 'hidden',
      _dmNote: dmState.dmNotes[d.id]   || '',
    }));
  }
  res.json({
    documents: docs,
    logEntries: archief.logEntries,
    sessieLog: req.role === 'dm'
      ? archief.sessieLog || []
      : (archief.sessieLog || []).filter(e => e.visible).map(e => ({
          ...e,
          images: (e.images || []).filter(img => typeof img === 'string' || img.visible !== false),
        })),
    hiddenLinks:  req.role === 'dm' ? archief.hiddenLinks : {},
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
  const dmState = readDmState();
  const doc = {
    id:        'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name:      req.body.name      || 'Naamloos document',
    type:      req.body.type      || 'Brief',
    cat:       req.body.cat       || 'brieven',
    desc:      req.body.desc      || '',
    icon:      req.body.icon      || '\u2709\ufe0f',
    hoofdstuk: req.body.hoofdstuk || '',
    npcs:      req.body.npcs      || [],
    locs:      req.body.locs      || [],
    orgs:      req.body.orgs      || [],
    items:     req.body.items     || [],
    docs:      req.body.docs      || [],
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
  const dmState = readDmState();
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
  const dmState = readDmState();
  archief.documents  = (archief.documents  || []).filter(d => d.id !== req.params.id);
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
  const dmState = readDmState();
  const doc     = (archief.documents || []).find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Niet gevonden' });
  const oldState = dmState.docStates[doc.id];
  dmState.docStates[doc.id] = state;
  if (state === 'revealed' && oldState !== 'revealed') {
    archief.logEntries.push({
      hoofdstuk: doc.hoofdstuk,
      event:     doc.name,
      icon:      doc.icon,
      docId:     doc.id,
      timestamp: Date.now(),
    });
    storage.writeJSON('archief.json', archief);
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('archief:stateChanged', { id: doc.id, name: doc.name, state });
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
    id:                   'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hoofdstuk:            req.body.hoofdstuk            || '',
    datum:                req.body.datum                || '',
    korteSamenvatting:    req.body.korteSamenvatting    || '',
    samenvatting:         req.body.samenvatting         || '',
    images:               req.body.images               || [],
    nieuwPersonages:      req.body.nieuwPersonages      || [],
    terugkerendPersonages:req.body.terugkerendPersonages|| [],
    nieuwLocaties:        req.body.nieuwLocaties        || [],
    terugkerendLocaties:  req.body.terugkerendLocaties  || [],
    organisaties:         req.body.organisaties         || [],
    voorwerpen:           req.body.voorwerpen           || [],
    docs:                 req.body.docs                 || [],
    nieuw:                req.body.nieuw                || [],
    terugkerend:          req.body.terugkerend          || [],
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
  const oldEntry = archief.sessieLog[idx];
  archief.sessieLog[idx] = { ...oldEntry, ...req.body, id: req.params.id };
  storage.writeJSON('archief.json', archief);
  req.app.get('io').emit('logboek:updated', { id: req.params.id });

  if (Array.isArray(req.body.images)) {
    const oldImages = oldEntry.images || [];
    for (const img of req.body.images) {
      if (!img.id || img.visible === false) continue;
      const prev      = oldImages.find(o => (typeof o === 'string' ? o : o.id) === img.id);
      const wasHidden = prev && typeof prev !== 'string' && prev.visible === false;
      if (wasHidden) {
        req.app.get('io').emit('logboek:imageRevealed', {
          sessieId:     req.params.id,
          caption:      img.caption || '',
          samenvatting: oldEntry.korteSamenvatting || '',
        });
      }
    }
  }
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

router.put('/meta/hoofdstuk/:key', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken) meta.hoofdstukken = {};
  meta.hoofdstukken[req.params.key] = {
    num:   req.body.num   ?? 99,
    title: req.body.title || '',
    dag:   req.body.dag   || '',
    short: req.body.short || req.body.title || req.params.key,
  };
  storage.writeJSON('meta.json', meta);
  req.app.get('io').emit('meta:updated');
  res.json(meta.hoofdstukken[req.params.key]);
});

// ── Kaart ──

router.get('/map/pins', attachRole, (req, res) => {
  const mapId   = req.query.mapId || 'grisburgh';
  const mapData = storage.readJSON('map.json');
  const entities= storage.readJSON('entities.json');
  const dmState = readDmState();
  const g       = getGroup(dmState);
  const locaties = entities.locaties || [];

  const pins = (mapData.pins || [])
    .filter(pin => (pin.mapId || 'grisburgh') === mapId)
    .map(pin => {
      const loc = locaties.find(l => l.id === pin.locId);
      if (!loc) return null;
      const vis = g.visibility[loc.id] || 'hidden';
      if (req.role !== 'dm' && vis === 'hidden') return null;
      return { ...pin, locName: vis === 'vague' ? null : loc.name, visibility: vis };
    }).filter(Boolean);

  res.json(pins);
});

router.post('/map/pins', requireDM, (req, res) => {
  const { locId, x, y, mapId } = req.body;
  if (!locId || x == null || y == null) return res.status(400).json({ error: 'Ontbrekende velden' });
  const mapData = storage.readJSON('map.json');
  const pin = {
    id:    'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    mapId: mapId || 'grisburgh',
    locId,
    x:     parseFloat(x),
    y:     parseFloat(y),
  };
  mapData.pins.push(pin);
  storage.writeJSON('map.json', mapData);
  req.app.get('io').emit('map:updated');
  res.json(pin);
});

router.put('/map/pins/:id', requireDM, (req, res) => {
  const { x, y } = req.body;
  if (x == null || y == null) return res.status(400).json({ error: 'Ontbrekende velden' });
  const mapData = storage.readJSON('map.json');
  const pin = mapData.pins.find(p => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Niet gevonden' });
  pin.x = parseFloat(x);
  pin.y = parseFloat(y);
  storage.writeJSON('map.json', mapData);
  res.json(pin);
});

router.delete('/map/pins/:id', requireDM, (req, res) => {
  const mapData = storage.readJSON('map.json');
  mapData.pins = mapData.pins.filter(p => p.id !== req.params.id);
  storage.writeJSON('map.json', mapData);
  req.app.get('io').emit('map:updated');
  res.json({ ok: true });
});

// ── Tunnel ──

let _io = null;
let _tunnelProcess = null;
let _tunnelUrl = null;

router.post('/tunnel/start', requireDM, (req, res) => {
  _io = req.app.get('io');
  if (_tunnelProcess) return res.json({ status: 'running', url: _tunnelUrl });
  _tunnelUrl = null;

  // Try common install paths in case cloudflared isn't in PATH
  const candidates = [
    'cloudflared',
    '/usr/local/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared',
    `${process.env.HOME}/.cloudflared/cloudflared`,
  ];
  let proc = null;
  for (const cmd of candidates) {
    try {
      proc = spawn(cmd, ['tunnel', '--url', 'http://localhost:3000']);
      break;
    } catch { /* try next */ }
  }
  if (!proc) return res.status(500).json({ error: 'cloudflared niet gevonden' });

  _tunnelProcess = proc;
  let respondedError = false;

  const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
  const handleData = (data) => {
    const text = data.toString();
    console.log('[cloudflared]', text.trim());
    const match = text.match(urlPattern);
    if (match && !_tunnelUrl) {
      _tunnelUrl = match[0];
      if (_io) _io.emit('tunnel:url', { url: _tunnelUrl });
    }
  };
  _tunnelProcess.stderr.on('data', handleData);
  _tunnelProcess.stdout.on('data', handleData);
  _tunnelProcess.on('error', (err) => {
    console.error('[cloudflared] spawn error:', err.message);
    _tunnelProcess = null;
    _tunnelUrl = null;
    if (!respondedError) {
      respondedError = true;
      if (_io) _io.emit('tunnel:stopped', {});
    }
  });
  _tunnelProcess.on('close', (code) => {
    console.log('[cloudflared] process closed, code:', code);
    _tunnelProcess = null;
    _tunnelUrl = null;
    if (_io) _io.emit('tunnel:stopped', {});
  });
  res.json({ status: 'starting' });
});

router.get('/tunnel/status', requireDM, (req, res) => {
  res.json({ active: !!_tunnelProcess, url: _tunnelUrl });
});

router.delete('/tunnel/stop', requireDM, (req, res) => {
  if (_tunnelProcess) { _tunnelProcess.kill(); _tunnelProcess = null; _tunnelUrl = null; }
  res.json({ ok: true });
});

// ── Tafels (Random Tables) ──

router.get('/tables', requireDM, (req, res) => {
  const data = storage.readJSON('tables.json');
  res.json(data.tables || []);
});

router.post('/tables', requireDM, (req, res) => {
  const data = storage.readJSON('tables.json');
  if (!data.tables) data.tables = [];
  const table = {
    id:      'tbl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name:    req.body.name    || 'Nieuwe tafel',
    type:    req.body.type    || 'simple',
    entries: req.body.entries || [],
    first:   req.body.first   || [],
    last:    req.body.last    || [],
  };
  data.tables.push(table);
  storage.writeJSON('tables.json', data);
  res.status(201).json(table);
});

router.put('/tables/:id', requireDM, (req, res) => {
  const data = storage.readJSON('tables.json');
  const idx = (data.tables || []).findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  data.tables[idx] = { ...data.tables[idx], ...req.body, id: req.params.id };
  storage.writeJSON('tables.json', data);
  res.json(data.tables[idx]);
});

router.delete('/tables/:id', requireDM, (req, res) => {
  const data = storage.readJSON('tables.json');
  data.tables = (data.tables || []).filter(t => t.id !== req.params.id);
  storage.writeJSON('tables.json', data);
  res.json({ ok: true });
});

// ── Monsters (Library) ──

router.get('/monsters', requireDM, (req, res) => {
  res.json(storage.readJSON('monsters.json'));
});

router.post('/monsters', requireDM, (req, res) => {
  const data = storage.readJSON('monsters.json');
  const monster = {
    id:          req.body.id || ('m_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
    name:        req.body.name        || 'Unnamed',
    maxHp:       req.body.maxHp       ?? 10,
    initiative:  req.body.initiative  ?? 10,
    imageId:     req.body.imageId     || null,
    backdropId:  req.body.backdropId  || null,
  };
  data.monsters = [...(data.monsters || []), monster];
  storage.writeJSON('monsters.json', data);
  res.status(201).json(monster);
});

router.put('/monsters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('monsters.json');
  const idx = (data.monsters || []).findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.monsters[idx] = { ...data.monsters[idx], ...req.body, id: req.params.id };
  storage.writeJSON('monsters.json', data);
  res.json(data.monsters[idx]);
});

router.delete('/monsters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('monsters.json');
  data.monsters = (data.monsters || []).filter(m => m.id !== req.params.id);
  storage.writeJSON('monsters.json', data);
  res.json({ ok: true });
});

// ── Gevecht (Combat) ──

function _emitCombat(req) {
  const combat = storage.readJSON('combat.json');
  req.app.get('io').emit('combat:updated', combat);
  return combat;
}

router.get('/combat', (req, res) => {
  res.json(storage.readJSON('combat.json'));
});

router.post('/combat/start', requireDM, (req, res) => {
  const existing = storage.readJSON('combat.json');
  const combatants = [...(existing.combatants || [])].sort((a, b) => b.initiative - a.initiative);
  const combat = { active: true, round: 1, currentTurn: 0, combatants };
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json(combat);
});

router.delete('/combat', requireDM, (req, res) => {
  const combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json({ ok: true });
});

router.put('/combat', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  const updated = { ...combat, ...req.body };
  // Zorg dat bestaande combatants behouden worden tenzij expliciet meegegeven
  if (!req.body.combatants) updated.combatants = combat.combatants;
  storage.writeJSON('combat.json', updated);
  req.app.get('io').emit('combat:updated', updated);
  res.json(updated);
});

router.post('/combat/combatant', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  const c = {
    id:         'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name:       req.body.name       || 'Naamloos',
    entityId:   req.body.entityId   || null,
    presetId:   req.body.presetId   || null,
    imageId:    req.body.imageId    || null,
    backdropId: req.body.backdropId || null,
    type:       req.body.type       || 'monster',
    initiative: req.body.initiative ?? 0,
    hp:         req.body.hp         ?? 10,
    maxHp:      req.body.maxHp      ?? 10,
    conditions: req.body.conditions || [],
  };
  combat.combatants.push(c);
  // Sorteer op initiative (hoog → laag)
  combat.combatants.sort((a, b) => b.initiative - a.initiative);
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.status(201).json(c);
});

router.put('/combat/combatant/:id', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  const idx = combat.combatants.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  combat.combatants[idx] = { ...combat.combatants[idx], ...req.body, id: req.params.id };
  // Hersorteren op initiative als dat gewijzigd is
  if (req.body.initiative !== undefined) {
    combat.combatants.sort((a, b) => b.initiative - a.initiative);
  }
  // Auto-detect: all monsters at 0 HP → players win
  if (!combat.winner && req.body.hp !== undefined) {
    const monsters = combat.combatants.filter(c => c.type === 'monster');
    if (monsters.length > 0 && monsters.every(c => (c.hp || 0) <= 0)) {
      combat.winner = 'players';
    }
  }
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json(combat.combatants.find(c => c.id === req.params.id));
});

router.put('/combat/winner', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  combat.winner = req.body.winner || null;
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json({ ok: true });
});

router.delete('/combat/combatant/:id', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  combat.combatants = combat.combatants.filter(c => c.id !== req.params.id);
  if (combat.currentTurn >= combat.combatants.length && combat.combatants.length > 0) {
    combat.currentTurn = 0;
  }
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json({ ok: true });
});

module.exports = router;
