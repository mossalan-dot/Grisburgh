const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { spawn } = require('child_process');
const storage = require('../lib/storage');
const { requireDM, attachRole } = require('./auth');
const { buildSnapshot, buildCampagneboek } = require('../lib/snapshot');

let _sharp = null;
try { _sharp = require('sharp'); } catch {}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── Thumbnail-cache ──
// Genereert bij eerste aanvraag een 600px-brede WebP en slaat die op in
// data/campaigns/<id>/thumbs/. Daarna wordt de gecachte versie direct geserveerd.
router.get('/thumb/:id', async (req, res) => {
  const file = storage.getFile(req.params.id);
  if (!file) return res.status(404).end();

  const mime = file.mimetype || '';
  const isResizeable = mime.startsWith('image/') && mime !== 'image/svg+xml' && mime !== 'image/gif';

  // Niet-resizeable bestanden (SVG, GIF, audio, PDF) → stuur origineel door
  if (!isResizeable || !_sharp) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.type(mime).sendFile(file.path);
  }

  const thumbDir  = path.join(storage.DATA_DIR, 'thumbs');
  const thumbPath = path.join(thumbDir, `${req.params.id}.webp`);

  try {
    if (!fs.existsSync(thumbPath)) {
      fs.mkdirSync(thumbDir, { recursive: true });
      await _sharp(file.path)
        .resize(600, null, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(thumbPath);
    }
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
    res.type('image/webp').sendFile(thumbPath);
  } catch {
    // Fallback naar origineel als sharp faalt
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(mime).sendFile(file.path);
  }
});

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
      itemOwners:    state.itemOwners    || {},
      itemRequests:  state.itemRequests  || [],
      tradeAllowed:  state.tradeAllowed !== false,
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
  // Migreer top-niveau itemOwners/itemRequests/tradeAllowed naar actieve groep (eenmalig)
  if (state.itemOwners !== undefined || state.itemRequests !== undefined || state.tradeAllowed !== undefined) {
    const g = state.groups[state.activeGroup] || Object.values(state.groups)[0];
    if (g) {
      // Kopieer alleen als er daadwerkelijk data is (niet-lege object/array)
      if (state.itemOwners && Object.keys(state.itemOwners).length > 0)
        g.itemOwners = state.itemOwners;
      if (state.itemRequests && state.itemRequests.length > 0)
        g.itemRequests = state.itemRequests;
      if (state.tradeAllowed !== undefined)
        g.tradeAllowed = state.tradeAllowed;
    }
    delete state.itemOwners;
    delete state.itemRequests;
    delete state.tradeAllowed;
    storage.writeJSON('dm-state.json', state);
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

// Bepaal de groep van een speler op basis van het karakter-entity
function _playerGroupId(dmState, characterId) {
  if (!characterId) return null;
  const entities = storage.readJSON('entities.json');
  const char = (entities.personages || []).find(e => e.id === characterId);
  const groep = char?.data?.groep;
  if (groep && dmState.groups?.[groep]) return groep;
  return null;
}

function filterEntityForPlayer(entity, dmState, groupId) {
  const g   = getGroup(dmState, groupId);
  const vis = g.visibility[entity.id] || 'hidden';
  if (vis === 'hidden') return null;
  if (vis === 'vague') {
    return {
      id:          entity.id,
      name:        entity.name,
      subtype:     entity.subtype || '',
      data:        {},
      links:       {},
      _visibility:   'vague',
      _secretReveal: false,
    };
  }
  // Visible: full entity, strip DM-only fields
  const revealed = !!g.secretReveals[entity.id];
  const e = { ...entity, data: { ...entity.data } };
  if (!revealed) delete e.data.geheim;
  delete e.stats;
  e._visibility   = 'visible';
  e._secretReveal = revealed;
  e._deceased     = !!(g.deceased?.[entity.id]);
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
    if (!req.session.characterId) return res.json([]);
    const playerGid = _playerGroupId(dmState, req.session.characterId);
    list = list.map(e => filterEntityForPlayer(e, dmState, playerGid)).filter(Boolean);
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
    if (!req.session.characterId) return res.status(404).json({ error: 'Niet gevonden' });
    const playerGid = _playerGroupId(dmState, req.session.characterId);
    const filtered = filterEntityForPlayer(entity, dmState, playerGid);
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
  const dying = (entities[type] || []).find(e => e.id === id);
  if (!dying) return res.status(404).json({ error: 'Niet gevonden' });

  // ── Sla op in prullenbak voor undo (max 10 items) ──
  const trashItem = {
    type, entity: JSON.parse(JSON.stringify(dying)),
    groupsState: {}, dmNote: dmState.dmNotes?.[id] || null, deletedAt: Date.now(),
  };
  for (const [gid, g] of Object.entries(dmState.groups || {})) {
    trashItem.groupsState[gid] = {
      visibility:   g.visibility?.[id],
      secretReveal: g.secretReveals?.[id],
      deceased:     g.deceased?.[id],
    };
  }
  if (!dmState.trash) dmState.trash = [];
  dmState.trash.unshift(trashItem);
  dmState.trash = dmState.trash.slice(0, 10);

  // ── Bidirectionele links: verwijder terugverwijzingen bij gelinkte entiteiten ──
  for (const lt of ENTITY_TYPES) {
    for (const targetName of (dying.links?.[lt] || [])) {
      const target = (entities[lt] || []).find(e => e.name === targetName);
      if (target?.links?.[type]) {
        target.links[type] = target.links[type].filter(n => n !== dying.name);
      }
    }
  }

  // ── Verwijder verwijzingen in archiefDocumenten ──
  const ARCHIEF_FIELD = { personages: 'npcs', locaties: 'locs', organisaties: 'orgs', voorwerpen: 'items' };
  const archiefField = ARCHIEF_FIELD[type];
  if (archiefField) {
    const archief = storage.readJSON('archief.json');
    let archiefChanged = false;
    for (const doc of (archief.documents || [])) {
      if (Array.isArray(doc[archiefField]) && doc[archiefField].includes(dying.name)) {
        doc[archiefField] = doc[archiefField].filter(n => n !== dying.name);
        archiefChanged = true;
      }
    }
    for (const entry of (archief.sessieLog || [])) {
      for (const field of ['nieuw', 'terugkerend']) {
        if (Array.isArray(entry[field]) && entry[field].includes(dying.name)) {
          entry[field] = entry[field].filter(n => n !== dying.name);
          archiefChanged = true;
        }
      }
    }
    if (archiefChanged) storage.writeJSON('archief.json', archief);
  }

  entities[type] = (entities[type] || []).filter(e => e.id !== id);
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
  req.app.get('io').emit('entity:trashed', { type, id, name: dying.name });
  res.json({ ok: true });
});

// Herstel verwijderde entiteit uit prullenbak
router.post('/entities/restore/:id', requireDM, (req, res) => {
  const { id } = req.params;
  const dmState = readDmState();
  const trashItem = (dmState.trash || []).find(t => t.entity.id === id);
  if (!trashItem) return res.status(404).json({ error: 'Niet gevonden in prullenbak' });
  const entities = storage.readJSON('entities.json');
  const { type, entity, groupsState, dmNote } = trashItem;
  if (!entities[type]) entities[type] = [];
  if (!entities[type].find(e => e.id === entity.id)) entities[type].push(entity);
  for (const [gid, s] of Object.entries(groupsState || {})) {
    if (!dmState.groups[gid]) continue;
    if (s.visibility !== undefined) dmState.groups[gid].visibility[entity.id] = s.visibility;
    if (s.secretReveal !== undefined) dmState.groups[gid].secretReveals[entity.id] = s.secretReveal;
    if (s.deceased !== undefined) {
      if (!dmState.groups[gid].deceased) dmState.groups[gid].deceased = {};
      dmState.groups[gid].deceased[entity.id] = s.deceased;
    }
  }
  if (dmNote !== null && dmNote !== undefined) {
    if (!dmState.dmNotes) dmState.dmNotes = {};
    dmState.dmNotes[entity.id] = dmNote;
  }
  dmState.trash = (dmState.trash || []).filter(t => t.entity.id !== id);
  storage.writeJSON('entities.json', entities);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:updated', { type, id: entity.id, restored: true });
  res.json({ ok: true, type, id: entity.id });
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

// Onthul een voorwerpkaartje vanuit winkelcontext — alleen als het nog 'hidden' is.
// Toegankelijk voor spelers (attachRole) zodat klikken vanuit de winkel voldoende is.
router.post('/entities/:type/:id/shop-reveal', attachRole, (req, res) => {
  const { type, id } = req.params;
  if (!['voorwerpen'].includes(type)) return res.status(400).json({ error: 'Alleen voor voorwerpen' });
  const dmState = readDmState();
  const g       = getGroup(dmState);
  const current = g.visibility[id] || 'hidden';
  if (current !== 'hidden') return res.json({ visibility: current, changed: false });
  g.visibility[id] = 'visible';
  storage.writeJSON('dm-state.json', dmState);
  const entities = storage.readJSON('entities.json');
  const entity   = (entities[type] || []).find(e => e.id === id);
  req.app.get('io').emit('entity:visibility', { id, type, name: entity?.name || '', visibility: 'visible' });
  res.json({ visibility: 'visible', changed: true });
});

router.put('/entities/:type/:id/secret', requireDM, (req, res) => {
  const { type, id } = req.params;
  const entities = storage.readJSON('entities.json');
  const entity   = (entities[type] || []).find(e => e.id === id);
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  g.secretReveals[id] = !g.secretReveals[id];
  // Geheime antagonist: wissel subtype mee bij onthulling
  if (entity && entity.data?.geheimeAntagonist === 'true') {
    if (g.secretReveals[id]) {
      entity.subtype = 'antagonist';
    } else {
      entity.subtype = 'NPC';
    }
    storage.writeJSON('entities.json', entities);
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('entity:secret', {
    id, type,
    name:         entity?.name || '',
    secretReveal: g.secretReveals[id],
  });
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

// ── Spelersaantekeningen ──
// Opslag: player-notes.json  →  { "entityId::playerName": "tekst", ... }

router.get('/player-notes/:entityId', attachRole, (req, res) => {
  const { entityId } = req.params;
  const notes = storage.readJSON('player-notes.json');
  if (req.role === 'dm') {
    // DM ziet alle aantekeningen voor dit kaartje, gegroepeerd per speler
    const result = {};
    for (const [key, text] of Object.entries(notes)) {
      const [eid, playerName] = key.split('::');
      if (eid === entityId && text) result[playerName] = text;
    }
    return res.json({ notes: result });
  }
  // Speler ziet alleen eigen aantekening
  if (!req.playerName) return res.json({ note: '' });
  const key = `${entityId}::${req.playerName}`;
  res.json({ note: notes[key] || '' });
});

router.put('/player-notes/:entityId', attachRole, (req, res) => {
  if (!req.playerName) return res.status(403).json({ error: 'Niet ingelogd als speler' });
  const { entityId } = req.params;
  const note  = req.body.note || '';
  const notes = storage.readJSON('player-notes.json');
  const key   = `${entityId}::${req.playerName}`;
  notes[key]  = note;
  storage.writeJSON('player-notes.json', notes);
  // Zoek de entiteitsnaam op voor de toast-melding aan de DM
  if (note.trim()) {
    try {
      const entities  = storage.readJSON('entities.json');
      let entityName  = entityId;
      for (const type of ['personages', 'locaties', 'organisaties', 'voorwerpen']) {
        const found = (entities[type] || []).find(e => e.id === entityId);
        if (found) { entityName = found.name; break; }
      }
      req.app.get('io').emit('notes:created', {
        playerName: req.playerName,
        entityId,
        entityName,
      });
    } catch { /* niet kritiek */ }
  }
  res.json({ ok: true });
});

// ── Geheime berichten ──
// berichten.json: { [characterId]: [ { id, tekst, timestamp, gelezen } ] }

router.get('/berichten', attachRole, (req, res) => {
  const berichten = storage.readJSON('berichten.json') || {};
  if (req.session.role === 'dm') {
    // DM: geef alle berichten terug, gegroepeerd per character
    const entities = storage.readJSON('entities.json');
    const spelers = (entities.personages || []).filter(e => e.subtype === 'speler');
    const result = spelers.map(s => ({
      characterId: s.id,
      name: s.name,
      berichten: (berichten[s.id] || []).sort((a, b) => b.timestamp - a.timestamp),
    }));
    return res.json({ spelers: result });
  }
  // Speler: eigen berichten
  if (!req.characterId) return res.json({ berichten: [] });
  const eigen = (berichten[req.characterId] || []).sort((a, b) => b.timestamp - a.timestamp);
  res.json({ berichten: eigen });
});

router.post('/berichten', requireDM, (req, res) => {
  const { characterId, tekst } = req.body;
  if (!characterId || !tekst?.trim()) return res.status(400).json({ error: 'Ontbrekende velden' });
  const berichten = storage.readJSON('berichten.json') || {};
  if (!berichten[characterId]) berichten[characterId] = [];
  const msg = { id: `msg_${Date.now()}_${Math.random().toString(36).substr(2,4)}`, tekst: tekst.trim(), timestamp: Date.now(), gelezen: false };
  berichten[characterId].unshift(msg);
  storage.writeJSON('berichten.json', berichten);
  // Stuur direct naar de specifieke speler als die verbonden is
  const io = req.app.get('io');
  const playerSockets = req.app.get('playerSockets');
  const socketId = playerSockets?.get(characterId);
  if (socketId) {
    io.to(socketId).emit('bericht:nieuw', { msg });
  }
  res.json({ ok: true, msg });
});

router.put('/berichten/:characterId/:msgId/gelezen', attachRole, (req, res) => {
  const { characterId, msgId } = req.params;
  if (req.session.role !== 'dm' && req.characterId !== characterId) return res.status(403).json({ error: 'Geen toegang' });
  const berichten = storage.readJSON('berichten.json') || {};
  const msg = (berichten[characterId] || []).find(m => m.id === msgId);
  if (msg) { msg.gelezen = true; storage.writeJSON('berichten.json', berichten); }
  res.json({ ok: true });
});

router.delete('/berichten/:characterId/:msgId', attachRole, (req, res) => {
  const { characterId, msgId } = req.params;
  if (req.session.role !== 'dm' && req.characterId !== characterId) return res.status(403).json({ error: 'Geen toegang' });
  const berichten = storage.readJSON('berichten.json') || {};
  if (berichten[characterId]) {
    berichten[characterId] = berichten[characterId].filter(m => m.id !== msgId);
    storage.writeJSON('berichten.json', berichten);
  }
  res.json({ ok: true });
});

// Sla vooraf ingevulde berichtsjablonen op in dm-state
router.get('/berichten/sjablonen', requireDM, (req, res) => {
  const dmState = readDmState();
  res.json({ sjablonen: dmState.berichtSjablonen || [] });
});

router.put('/berichten/sjablonen', requireDM, (req, res) => {
  const { sjablonen } = req.body;
  if (!Array.isArray(sjablonen)) return res.status(400).json({ error: 'Array verwacht' });
  const dmState = readDmState();
  dmState.berichtSjablonen = sjablonen.slice(0, 20);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Winkel uitverkocht (per groep) ──
// dm-state.json: groups[id].shopUitverkocht = { shopEntityId: ["itemnaam", ...] }

// ── Prijs parser: "5 fl.", "10 kn", "2 fl, 3 kn" etc. ──
function parsePrijs(str) {
  if (!str) return null;
  const result = { fl: 0, kn: 0, cl: 0 };
  const re = /(\d+(?:[.,]\d+)?)\s*(fl|kn|cl)\.?/gi;
  let match, any = false;
  while ((match = re.exec(String(str))) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    result[match[2].toLowerCase()] += val;
    any = true;
  }
  return any ? result : null;
}

// Valuta-hulpfuncties: 1 fl = 10 kn = 100 cl
function toCl(cur) {
  return Math.round(((cur.fl || 0) * 100) + ((cur.kn || 0) * 10) + (cur.cl || 0));
}
function fromCl(total) {
  const fl = Math.floor(total / 100);
  const kn = Math.floor((total % 100) / 10);
  const cl = total % 10;
  return { fl, kn, cl };
}

router.get('/shops/:shopId/uitverkocht', attachRole, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  const uitverkocht = ((g.shopUitverkocht || {})[req.params.shopId]) || [];
  res.json({ uitverkocht });
});

router.put('/shops/:shopId/uitverkocht', requireDM, (req, res) => {
  const { shopId } = req.params;
  const { itemNaam } = req.body;
  if (!itemNaam) return res.status(400).json({ error: 'itemNaam vereist' });
  const key = itemNaam.toLowerCase().trim();
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.shopUitverkocht) g.shopUitverkocht = {};
  if (!g.shopUitverkocht[shopId]) g.shopUitverkocht[shopId] = [];
  const idx = g.shopUitverkocht[shopId].indexOf(key);
  let nu;
  if (idx === -1) {
    g.shopUitverkocht[shopId].push(key);
    nu = true;
  } else {
    g.shopUitverkocht[shopId].splice(idx, 1);
    nu = false;
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('shop:uitverkocht-updated', {
    shopId,
    uitverkocht: g.shopUitverkocht[shopId],
  });
  res.json({ uitverkocht: g.shopUitverkocht[shopId], itemNaam: key, nu });
});

// ── Winkel: beschikbare items (met rotatie-logica) ──
router.get('/shops/:shopId/beschikbaar', attachRole, (req, res) => {
  const { shopId } = req.params;
  const entities = storage.readJSON('entities.json');
  const allEntities = [...(entities.personages || []), ...(entities.locaties || [])];
  const shop = allEntities.find(e => e.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Winkel niet gevonden' });

  let voorraadItems = [];
  try { voorraadItems = shop.data?.voorraad ? JSON.parse(shop.data.voorraad) : []; } catch {}
  let winkelConfig = {};
  try { winkelConfig = shop.data?.winkelConfig ? JSON.parse(shop.data.winkelConfig) : {}; } catch {}

  const dmState = readDmState();
  const g = getGroup(dmState);
  const uitverkochtSet = new Set((g.shopUitverkocht?.[shopId] || []).map(k => (k || '').toLowerCase().trim()));

  // Beschrijving ophalen voor gelinkte kaartjes
  const _voorwerpen = entities.voorwerpen || [];
  const _withDesc = item => {
    const ent = item.entityId ? _voorwerpen.find(e => e.id === item.entityId) : null;
    return {
      ...item,
      desc: ent?.data?.desc || '',
      imageId: ent?.imageId || '',
      stapelbaar: ent?.data?.stapelbaar === 'true',
    };
  };

  if (!winkelConfig.roterend) {
    const _characterId = req.session?.characterId;
    const _tempDiscount = _characterId ? g.shopTempDiscount?.[shopId]?.[_characterId] : null;
    const _discountActief = _tempDiscount && new Date(_tempDiscount.geldigTot) > new Date() && (_tempDiscount.percent || 0) !== 0;
    const discountPct = _discountActief ? _tempDiscount.percent : 0;
    const sfeerTekst = winkelConfig.sfeerTekst || '';
    return res.json({
      items: voorraadItems.map(item => ({
        ..._withDesc(item),
        uitverkocht: uitverkochtSet.has((item.naam || '').toLowerCase().trim()),
        actief: true,
      })),
      roterend: false,
      sfeerTekst,
      discountPct,
    });
  }

  // Roterende winkel
  const deelGroep = winkelConfig.deelGroep?.trim() || shopId;
  const aantalItems = Math.max(1, parseInt(winkelConfig.aantalItems) || 3);
  const refreshMs = Math.max(1, parseFloat(winkelConfig.refreshUren) || 24) * 3600000;

  if (!g.shopRotatie) g.shopRotatie = {};
  let rotatie = g.shopRotatie[deelGroep];
  const now = Date.now();
  const geldig = rotatie && rotatie.geldigTot && new Date(rotatie.geldigTot).getTime() > now && rotatie.items?.length;

  if (!geldig) {
    const pool = [...voorraadItems].filter(item => !uitverkochtSet.has((item.naam || '').toLowerCase().trim()));
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, aantalItems).map(i => i.naam);
    rotatie = { items: selected, geldigTot: new Date(now + refreshMs).toISOString() };
    g.shopRotatie[deelGroep] = rotatie;
    storage.writeJSON('dm-state.json', dmState);
  }

  const actiefSet = new Set(rotatie.items.map(n => (n || '').toLowerCase().trim()));
  const isDMReq = req.role === 'dm';

  const filtered = isDMReq
    ? voorraadItems.map(item => ({
        ..._withDesc(item),
        uitverkocht: uitverkochtSet.has((item.naam || '').toLowerCase().trim()),
        actief: actiefSet.has((item.naam || '').toLowerCase().trim()),
      }))
    : voorraadItems
        .filter(item => actiefSet.has((item.naam || '').toLowerCase().trim()))
        .map(item => ({
          ..._withDesc(item),
          uitverkocht: uitverkochtSet.has((item.naam || '').toLowerCase().trim()),
          actief: true,
        }));

  const _characterId = req.session?.characterId;
  const _tempDiscount = _characterId ? g.shopTempDiscount?.[shopId]?.[_characterId] : null;
  const _discountActief = _tempDiscount && new Date(_tempDiscount.geldigTot) > new Date() && (_tempDiscount.percent || 0) !== 0;
  const discountPct = _discountActief ? _tempDiscount.percent : 0;
  const sfeerTekst = winkelConfig.sfeerTekst || '';
  res.json({ items: filtered, roterend: true, geldigTot: rotatie.geldigTot, sfeerTekst, discountPct });
});

// ── Winkel: voorwerp kopen ──
router.post('/shops/:shopId/koop', attachRole, (req, res) => {
  const characterId = req.session?.characterId;
  if (!characterId) return res.status(401).json({ error: 'Log in als speler om te kopen' });

  const { shopId } = req.params;
  const { itemNaam, entityId, aantal: aantalRaw } = req.body;
  const aantal = Math.max(1, parseInt(aantalRaw) || 1);
  if (!itemNaam) return res.status(400).json({ error: 'itemNaam vereist' });

  const entities = storage.readJSON('entities.json');
  const allShops = [...(entities.personages || []), ...(entities.locaties || [])];
  const shop = allShops.find(e => e.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Winkel niet gevonden' });

  let voorraadItems = [];
  try { voorraadItems = shop.data?.voorraad ? JSON.parse(shop.data.voorraad) : []; } catch {}

  const itemKey = (itemNaam || '').toLowerCase().trim();
  const item = voorraadItems.find(i => (i.naam || '').toLowerCase().trim() === itemKey);
  if (!item) return res.status(404).json({ error: 'Voorwerp niet gevonden in voorraad' });

  const dmState = readDmState();
  const g = getGroup(dmState);

  const uitverkochtLijst = (g.shopUitverkocht?.[shopId] || []).map(k => (k || '').toLowerCase().trim());
  if (uitverkochtLijst.includes(itemKey)) {
    return res.status(409).json({ error: 'Dit voorwerp is uitverkocht' });
  }

  const prijs = parsePrijs(item.prijs);

  if (prijs && (prijs.fl > 0 || prijs.kn > 0 || prijs.cl > 0)) {
    let prijsCl = toCl(prijs) * aantal;
    // Pas eventuele onderhandel-korting toe
    const tempDisc = g.shopTempDiscount?.[shopId]?.[characterId];
    const discActief = tempDisc && new Date(tempDisc.geldigTot) > new Date();
    if (discActief && tempDisc.percent !== 0) {
      prijsCl = Math.max(1, Math.round(prijsCl * (1 - tempDisc.percent / 100)));
    }
    if (!dmState.playerCurrency) dmState.playerCurrency = {};
    const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
    const heeftCl = toCl(pc);
    if (heeftCl < prijsCl) {
      return res.status(402).json({ error: 'Niet genoeg geld', prijs });
    }
    dmState.playerCurrency[characterId] = fromCl(heeftCl - prijsCl);
  }

  // Controleer of het entityId ook echt bestaat — zo niet, behandel als tekst-item
  const _rawEntityId = entityId || item.entityId || null;
  const _entityItem = _rawEntityId ? (entities.voorwerpen || []).find(e => e.id === _rawEntityId) : null;
  const effectiveEntityId = _entityItem ? _rawEntityId : null;
  const isStapelbaar = _entityItem?.data?.stapelbaar === 'true';

  const playerName = req.playerName || 'Speler';
  if (effectiveEntityId) {
    if (!g.itemOwners) g.itemOwners = {};
    if (isStapelbaar) {
      if (!Array.isArray(g.itemOwners[effectiveEntityId])) g.itemOwners[effectiveEntityId] = [];
      const existing = g.itemOwners[effectiveEntityId].find(o => o.characterId === characterId);
      if (existing) { existing.qty = (existing.qty || 1) + aantal; }
      else { g.itemOwners[effectiveEntityId].push({ characterId, playerName, qty: aantal }); }
    } else {
      g.itemOwners[effectiveEntityId] = { characterId, playerName };
    }
    // Auto-onthul het kaartje als het nog verborgen is
    if (!g.visibility) g.visibility = {};
    if ((g.visibility[effectiveEntityId] || 'hidden') === 'hidden') {
      g.visibility[effectiveEntityId] = 'visible';
    }
  } else {
    if (!dmState.playerItems) dmState.playerItems = {};
    if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];
    for (let i = 0; i < aantal; i++) {
      dmState.playerItems[characterId].push({
        id: 'pi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: item.naam,
        note: item.prijs ? `Gekocht voor ${item.prijs}` : '',
      });
    }
  }

  if (!isStapelbaar) {
    if (!g.shopUitverkocht) g.shopUitverkocht = {};
    if (!g.shopUitverkocht[shopId]) g.shopUitverkocht[shopId] = [];
    if (!g.shopUitverkocht[shopId].map(k => (k || '').toLowerCase()).includes(itemKey)) {
      g.shopUitverkocht[shopId].push(item.naam);
    }
  }

  storage.writeJSON('dm-state.json', dmState);

  // Shop log bijhouden
  try {
    const shopLog = storage.readJSON('shop-log.json');
    if (!shopLog[shopId]) shopLog[shopId] = [];
    shopLog[shopId].push({
      ts: new Date().toISOString(),
      characterId,
      playerName,
      itemNaam: item.naam,
      prijs: item.prijs || '',
      aantal,
    });
    // Max 200 entries per shop bewaren
    if (shopLog[shopId].length > 200) shopLog[shopId] = shopLog[shopId].slice(-200);
    storage.writeJSON('shop-log.json', shopLog);
  } catch { /* stil falen */ }

  const io = req.app.get('io');

  if (prijs && (prijs.fl > 0 || prijs.kn > 0 || prijs.cl > 0)) {
    io.emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  }

  if (effectiveEntityId) {
    io.emit('items:ownership-updated', {
      owners: g.itemOwners || {},
      requests: g.itemRequests || [],
      tradeAllowed: g.tradeAllowed !== false,
    });
    // Stuur onthullingsgebeurtenis zodat het kaartje zichtbaar wordt
    io.emit('entity:visibility', { id: effectiveEntityId, type: 'voorwerpen', name: _entityItem?.name || '', visibility: 'visible' });
  } else {
    io.emit('player:items-updated', { characterId, items: (dmState.playerItems || {})[characterId] || [] });
  }

  if (!isStapelbaar) {
    io.emit('shop:uitverkocht-updated', { shopId, uitverkocht: g.shopUitverkocht[shopId] });
  }

  res.json({ ok: true, itemNaam: item.naam, prijs });
});

// ── Winkel: onderhandelen ──
router.post('/shops/:shopId/onderhandel', attachRole, (req, res) => {
  const characterId = req.session?.characterId;
  if (!characterId) return res.status(401).json({ error: 'Log in als speler' });

  const { shopId } = req.params;
  const { modifier = 0 } = req.body;

  const entities = storage.readJSON('entities.json');
  const allShops = [...(entities.personages || []), ...(entities.locaties || [])];
  const shop = allShops.find(e => e.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Winkel niet gevonden' });

  let winkelConfig = {};
  try { winkelConfig = shop.data?.winkelConfig ? JSON.parse(shop.data.winkelConfig) : {}; } catch {}

  const dc = parseInt(winkelConfig.onderhandelDC) || 15;
  const kortingPct = parseInt(winkelConfig.onderhandelKorting) || 10;
  const boetePct = parseInt(winkelConfig.onderhandelBoete) || 0;

  const diceRoll = Math.floor(Math.random() * 20) + 1;
  const mod = parseInt(modifier) || 0;
  const totaal = diceRoll + mod;
  const geslaagd = totaal >= dc;

  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.shopTempDiscount) g.shopTempDiscount = {};
  if (!g.shopTempDiscount[shopId]) g.shopTempDiscount[shopId] = {};

  const geldigTot = new Date(Date.now() + 3600000).toISOString(); // 1 uur
  if (geslaagd) {
    g.shopTempDiscount[shopId][characterId] = { percent: kortingPct, geldigTot };
  } else if (boetePct > 0) {
    g.shopTempDiscount[shopId][characterId] = { percent: -boetePct, geldigTot };
  } else {
    delete g.shopTempDiscount[shopId]?.[characterId];
  }
  storage.writeJSON('dm-state.json', dmState);

  res.json({ diceRoll, modifier: mod, totaal, dc, geslaagd, kortingPct: geslaagd ? kortingPct : 0, boetePct: !geslaagd ? boetePct : 0 });
});

// ── Winkel: aankooplog ──
router.get('/shops/:shopId/log', requireDM, (req, res) => {
  const shopLog = storage.readJSON('shop-log.json');
  const entries = (shopLog[req.params.shopId] || []).slice(-100).reverse();
  res.json({ entries });
});

// ── Voorwerpen claimen & ruilen ──
// dm-state.json:
//   itemOwners:  { itemId: { characterId, playerName } }
//   itemRequests: [ { id, itemId, itemName, type:'claim'|'trade', requesterId, requesterName,
//                     targetId?, targetName?, status:'pending'|'approved'|'rejected' } ]
//   tradeAllowed: boolean

router.get('/items/ownership', attachRole, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  let stapelbaar = [];
  try {
    const entities = storage.readJSON('entities.json');
    stapelbaar = (entities.voorwerpen || [])
      .filter(e => e.data?.stapelbaar === 'true')
      .map(e => e.id);
  } catch { /* ok */ }
  res.json({
    owners:       g.itemOwners   || {},
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
    stapelbaar,
  });
});

router.put('/items/trade-allowed', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  g.tradeAllowed = !!req.body.allowed;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners: g.itemOwners || {}, requests: g.itemRequests || [],
    tradeAllowed: g.tradeAllowed,
  });
  res.json({ tradeAllowed: g.tradeAllowed });
});

router.post('/items/:itemId/request', attachRole, (req, res) => {
  if (!req.playerName) return res.status(403).json({ error: 'Niet ingelogd als speler' });
  const { itemId } = req.params;
  const { type = 'claim', targetId, targetName } = req.body;
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemOwners)   g.itemOwners   = {};
  if (!g.itemRequests) g.itemRequests = [];

  // Zoek itemnaam op
  let itemName = itemId;
  try {
    const entities = storage.readJSON('entities.json');
    const item = (entities.voorwerpen || []).find(e => e.id === itemId);
    if (item) itemName = item.name;
  } catch { /* ok */ }

  // Controleer of er al een openstaand verzoek is voor dit item door deze speler
  const existing = g.itemRequests.find(
    r => r.itemId === itemId && r.requesterId === req.session.characterId && r.status === 'pending'
  );
  if (existing) return res.status(409).json({ error: 'Al een openstaand verzoek' });

  const reqObj = {
    id:            'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    itemId,
    itemName,
    type,
    requesterId:   req.session.characterId,
    requesterName: req.playerName,
    targetId:      targetId   || null,
    targetName:    targetName || null,
    status:        'pending',
    createdAt:     new Date().toISOString(),
  };
  g.itemRequests.push(reqObj);
  storage.writeJSON('dm-state.json', dmState);

  req.app.get('io').emit('items:request', {
    ...reqObj,
    owners:       g.itemOwners,
    requests:     g.itemRequests,
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.status(201).json(reqObj);
});

router.post('/items/request/:reqId/approve', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemRequests) g.itemRequests = [];
  if (!g.itemOwners)   g.itemOwners   = {};
  const idx = g.itemRequests.findIndex(r => r.id === req.params.reqId);
  if (idx === -1) return res.status(404).json({ error: 'Verzoek niet gevonden' });
  const r = g.itemRequests[idx];
  g.itemRequests[idx].status = 'approved';

  if (r.type === 'claim') {
    g.itemOwners[r.itemId] = { characterId: r.requesterId, playerName: r.requesterName };
  } else if (r.type === 'trade' && r.targetId) {
    g.itemOwners[r.itemId] = { characterId: r.requesterId, playerName: r.requesterName };
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners: g.itemOwners, requests: g.itemRequests,
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true });
});

router.post('/items/request/:reqId/reject', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemRequests) g.itemRequests = [];
  const idx = g.itemRequests.findIndex(r => r.id === req.params.reqId);
  if (idx === -1) return res.status(404).json({ error: 'Verzoek niet gevonden' });
  g.itemRequests[idx].status = 'rejected';
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners: g.itemOwners || {}, requests: g.itemRequests,
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true });
});

// DM geeft voorwerp rechtstreeks aan een speler (specifieke groep via groupId)
router.put('/items/:itemId/owner', requireDM, (req, res) => {
  const { itemId } = req.params;
  const { characterId, playerName, groupId, qty } = req.body;
  if (!characterId || !playerName) return res.status(400).json({ error: 'characterId en playerName vereist' });
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  const item     = (entities.voorwerpen || []).find(e => e.id === itemId);
  const isStapelbaar = item?.data?.stapelbaar === 'true';
  const targetId = dmState.activeGroup;
  const g = dmState.groups[targetId];
  if (!g) return res.status(400).json({ error: 'Groep niet gevonden' });
  if (!g.itemOwners) g.itemOwners = {};

  if (isStapelbaar) {
    const amount = Math.max(1, parseInt(qty) || 1);
    if (!Array.isArray(g.itemOwners[itemId])) g.itemOwners[itemId] = [];
    const existing = g.itemOwners[itemId].find(o => o.characterId === characterId);
    if (existing) {
      existing.qty = (existing.qty || 1) + amount;
    } else {
      g.itemOwners[itemId].push({ characterId, playerName, qty: amount });
    }
  } else {
    g.itemOwners[itemId] = { characterId, playerName };
  }

  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners:       g.itemOwners,
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
    given:        { itemName: item?.name || '', playerName, groupId: targetId },
  });
  res.json({ ok: true });
});

router.delete('/items/:itemId/owner', requireDM, (req, res) => {
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  const entities = storage.readJSON('entities.json');
  const item     = (entities.voorwerpen || []).find(e => e.id === req.params.itemId);
  const { characterId } = req.query; // optioneel: voor stapelbaar eigendom per speler

  if (characterId && Array.isArray((g.itemOwners || {})[req.params.itemId])) {
    // Verwijder specifieke speler uit stapelbaar eigendom
    g.itemOwners[req.params.itemId] = g.itemOwners[req.params.itemId]
      .filter(o => o.characterId !== characterId);
    if (g.itemOwners[req.params.itemId].length === 0) delete g.itemOwners[req.params.itemId];
  } else {
    if (g.itemOwners) delete g.itemOwners[req.params.itemId];
  }

  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners:       g.itemOwners  || {},
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true });
});

// Speler of DM past hoeveelheid aan van een stapelbaar voorwerp
router.patch('/items/:itemId/owner/:characterId', attachRole, (req, res) => {
  const { itemId, characterId } = req.params;
  const { delta } = req.body;
  const sessionCharId = req.session?.characterId;
  const isPlayerRole  = !!req.playerName;
  if (isPlayerRole && sessionCharId !== characterId) {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemOwners) return res.status(404).json({ error: 'Niet gevonden' });
  const owners = g.itemOwners[itemId];
  if (!Array.isArray(owners)) return res.status(400).json({ error: 'Geen stapelbaar eigendom' });
  const entry = owners.find(o => o.characterId === characterId);
  if (!entry) return res.status(404).json({ error: 'Eigendom niet gevonden' });
  entry.qty = Math.max(0, (entry.qty || 1) + (parseInt(delta) || 0));
  if (entry.qty === 0) {
    g.itemOwners[itemId] = owners.filter(o => o.characterId !== characterId);
    if (g.itemOwners[itemId].length === 0) delete g.itemOwners[itemId];
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('items:ownership-updated', {
    owners: g.itemOwners || {}, requests: g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true, qty: entry.qty });
});

// ── Speler HP (buiten gevecht) ──

router.get('/player-hp/:characterId', attachRole, (req, res) => {
  const dmState = readDmState();
  const hp = (dmState.playerHp || {})[req.params.characterId] || { current: null, max: null };
  res.json(hp);
});

router.patch('/player-hp/:characterId', attachRole, (req, res) => {
  // DM mag alles; speler mag alleen eigen HP
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId) {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  const dmState = readDmState();
  if (!dmState.playerHp) dmState.playerHp = {};
  const existing = dmState.playerHp[characterId] || { current: null, max: null };
  const updated = {
    current: req.body.current !== undefined ? parseInt(req.body.current) : existing.current,
    max:     req.body.max     !== undefined ? parseInt(req.body.max)     : existing.max,
  };
  dmState.playerHp[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('player:hp-updated', { characterId, ...updated });
  res.json(updated);
});

// ── Speler losse voorwerpen ──

router.get('/player-items/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerItems || {})[characterId] || []);
});

router.post('/player-items/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const { name, note } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Naam vereist' });
  const dmState = readDmState();
  if (!dmState.playerItems) dmState.playerItems = {};
  if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];
  const item = {
    id:   'pi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name.trim(),
    note: (note || '').trim(),
  };
  dmState.playerItems[characterId].push(item);
  storage.writeJSON('dm-state.json', dmState);
  res.status(201).json(item);
});

router.delete('/player-items/:characterId/:itemId', attachRole, (req, res) => {
  const { characterId, itemId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (dmState.playerItems?.[characterId])
    dmState.playerItems[characterId] = dmState.playerItems[characterId].filter(i => i.id !== itemId);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Speler valuta (FL/KN/CL) ──

router.get('/player-currency/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerCurrency || {})[characterId] || { fl: 0, kn: 0, cl: 0 });
});

router.patch('/player-currency/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const existing = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  const updated = {
    fl: req.body.fl !== undefined ? Math.max(0, parseInt(req.body.fl) || 0) : existing.fl,
    kn: req.body.kn !== undefined ? Math.max(0, parseInt(req.body.kn) || 0) : existing.kn,
    cl: req.body.cl !== undefined ? Math.max(0, parseInt(req.body.cl) || 0) : existing.cl,
  };
  dmState.playerCurrency[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  res.json(updated);
});

// ── Gedeelde beurs ──

router.get('/party-currency', attachRole, (req, res) => {
  const dmState = readDmState();
  const groupId = req.role === 'dm' ? dmState.activeGroup : _playerGroupId(dmState, req.session.characterId);
  const g = getGroup(dmState, groupId);
  res.json(g.sharedPurse || { enabled: false, fl: 0, kn: 0, cl: 0 });
});

router.patch('/party-currency', attachRole, (req, res) => {
  const dmState = readDmState();
  const groupId = req.role === 'dm' ? dmState.activeGroup : _playerGroupId(dmState, req.session.characterId);
  const g = getGroup(dmState, groupId);
  if (!g.sharedPurse) g.sharedPurse = { enabled: false, fl: 0, kn: 0, cl: 0 };
  if (!g.sharedPurse.enabled && req.role !== 'dm') return res.status(403).json({ error: 'Gedeelde beurs niet actief' });
  g.sharedPurse.fl = req.body.fl !== undefined ? Math.max(0, parseInt(req.body.fl) || 0) : g.sharedPurse.fl;
  g.sharedPurse.kn = req.body.kn !== undefined ? Math.max(0, parseInt(req.body.kn) || 0) : g.sharedPurse.kn;
  g.sharedPurse.cl = req.body.cl !== undefined ? Math.max(0, parseInt(req.body.cl) || 0) : g.sharedPurse.cl;
  storage.writeJSON('dm-state.json', dmState);
  const actor = req.session.playerName || 'DM';
  req.app.get('io').emit('party-currency:updated', { groupId: groupId || dmState.activeGroup, currency: g.sharedPurse, actor });
  res.json(g.sharedPurse);
});

router.put('/party-currency/toggle', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.sharedPurse) g.sharedPurse = { enabled: false, fl: 0, kn: 0, cl: 0 };
  g.sharedPurse.enabled = !g.sharedPurse.enabled;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('party-currency:updated', { groupId: dmState.activeGroup, currency: g.sharedPurse, actor: 'DM' });
  res.json(g.sharedPurse);
});

// ── Speler spreukenslots ──

router.get('/player-spellslots/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerSpellSlots || {})[characterId] || {});
});

router.put('/player-spellslots/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerSpellSlots) dmState.playerSpellSlots = {};
  // Merge per level
  const existing = dmState.playerSpellSlots[characterId] || {};
  const updated = { ...existing };
  for (const [lvl, val] of Object.entries(req.body)) {
    if (typeof val === 'object' && val !== null) {
      updated[lvl] = {
        max:  Math.max(0, parseInt(val.max)  || 0),
        used: Math.max(0, parseInt(val.used) || 0),
      };
    }
  }
  dmState.playerSpellSlots[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  res.json(updated);
});

// ── Medestanders ──

// Geeft de medestanders terug die aan de groep van de ingelogde speler zijn gekoppeld
router.get('/companions', attachRole, (req, res) => {
  const myId    = req.session.characterId;
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  let g;
  if (req.role === 'dm') {
    g = getGroup(dmState);
  } else if (myId) {
    const me       = (entities.personages || []).find(e => e.id === myId);
    const myGroupId = me?.data?.groep;
    g = myGroupId ? (dmState.groups[myGroupId] || getGroup(dmState)) : getGroup(dmState);
  } else {
    return res.json([]);
  }
  const companionIds = g.companions || [];
  const npcs = (entities.personages || []).filter(e => companionIds.includes(e.id));
  res.json(npcs.map(e => ({
    id: e.id, name: e.name, subtype: e.subtype,
    data: { ras: e.data?.ras, klasse: e.data?.klasse },
  })));
});

// Geeft terug aan welke groepen een NPC gekoppeld is (DM only)
router.get('/companions/status/:npcId', requireDM, (req, res) => {
  const { npcId } = req.params;
  const dmState = readDmState();
  const linked = Object.entries(dmState.groups)
    .filter(([, g]) => (g.companions || []).includes(npcId))
    .map(([id]) => id);
  res.json({ linked });
});

// Koppel NPC aan een groep
router.post('/companions/:npcId/:groupId', requireDM, (req, res) => {
  const { npcId, groupId } = req.params;
  const entities = storage.readJSON('entities.json');
  const entity   = (entities.personages || []).find(e => e.id === npcId);
  const dmState  = readDmState();
  const g = dmState.groups[groupId];
  if (!g) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (!g.companions) g.companions = [];
  if (!g.companions.includes(npcId)) g.companions.push(npcId);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('companion:link', { npcId, name: entity?.name || '', groupId });
  res.json({ ok: true });
});

// Ontkoppel NPC van een groep
router.delete('/companions/:npcId/:groupId', requireDM, (req, res) => {
  const { npcId, groupId } = req.params;
  const entities = storage.readJSON('entities.json');
  const entity   = (entities.personages || []).find(e => e.id === npcId);
  const dmState  = readDmState();
  const g = dmState.groups[groupId];
  if (!g) return res.status(404).json({ error: 'Groep niet gevonden' });
  g.companions = (g.companions || []).filter(id => id !== npcId);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('companion:unlink', { npcId, name: entity?.name || '', groupId });
  res.json({ ok: true });
});

// ── Party-leden (op basis van entity-groepveld, onafhankelijk van DM-visibility) ──

router.get('/party', attachRole, (req, res) => {
  const myId = req.session.characterId;
  if (!myId && req.role !== 'dm')
    return res.status(403).json({ error: 'Geen karakter geselecteerd' });
  const entities = storage.readJSON('entities.json');
  const spelers  = (entities.personages || []).filter(e => e.subtype === 'speler');
  if (!myId) return res.json(spelers); // DM: geef alles terug
  const me      = spelers.find(e => e.id === myId);
  const myGroup = me?.data?.groep;
  const party   = spelers.filter(e => {
    if (e.id === myId) return false;
    if (myGroup && e.data?.groep && e.data.groep !== myGroup) return false;
    return true;
  });
  // Geef alleen veilige velden terug (geen geheimen), inclusief HP
  const dmState = readDmState();
  const hpMap   = dmState.playerHp || {};
  res.json(party.map(e => {
    const hp = hpMap[e.id] || { current: null, max: null };
    return {
      id:      e.id,
      name:    e.name,
      subtype: e.subtype,
      data:    { ras: e.data?.ras, klasse: e.data?.klasse },
      hp:      hp.current,
      maxHp:   hp.max,
    };
  }));
});

// ── Speler profiel (level, klasse, subclass, background, origin) ──

router.get('/player-profile/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerProfiles || {})[characterId] || {});
});

router.patch('/player-profile/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerProfiles) dmState.playerProfiles = {};
  const existing = dmState.playerProfiles[characterId] || {};
  const allowed = [
    'level', 'klasse', 'subclass', 'background', 'origin', 'bloodStatus', 'spellSaveDC', 'spellAttackBonus',
    'str', 'dex', 'con', 'int', 'wis', 'cha',
    'ac', 'speed', 'initiative', 'profBonus', 'hitDie',
    'deathSaveSuccesses', 'deathSaveFailures',
    'saveProfs', 'skillProfs', 'skillAdj', 'featuresTraits',
    'armorProfs', 'weaponProfs', 'toolProfs',
    'languages', 'senses',
    'multiclass', 'klasseLevel', 'multiKlasse', 'multiKlasseLevel',
    'bookmarks', 'weapons',
  ];
  const updated = { ...existing };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updated[key] = req.body[key];
  }
  dmState.playerProfiles[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  res.json(updated);
});

// ── Speler inspiratie ──

router.get('/player-inspiration', requireDM, (req, res) => {
  const dmState = readDmState();
  res.json(dmState.playerInspiration || {});
});

router.get('/player-inspiration/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json({ inspired: !!((dmState.playerInspiration || {})[characterId]) });
});

router.put('/player-inspiration/:characterId', requireDM, (req, res) => {
  const { characterId } = req.params;
  const dmState = readDmState();
  if (!dmState.playerInspiration) dmState.playerInspiration = {};
  dmState.playerInspiration[characterId] = true;
  storage.writeJSON('dm-state.json', dmState);
  const entity = (storage.readJSON('entities.json').personages || []).find(e => e.id === characterId);
  req.app.get('io').emit('player:inspiration', { characterId, inspired: true, name: entity?.name || '' });
  res.json({ inspired: true });
});

router.delete('/player-inspiration/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerInspiration) dmState.playerInspiration = {};
  dmState.playerInspiration[characterId] = false;
  storage.writeJSON('dm-state.json', dmState);
  const entity = (storage.readJSON('entities.json').personages || []).find(e => e.id === characterId);
  req.app.get('io').emit('player:inspiration', { characterId, inspired: false, name: entity?.name || '' });
  res.json({ inspired: false });
});

// ── Speler trackers (klasse-/rasvaardig­heden) ──

router.get('/player-trackers/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerTrackers || {})[characterId] || []);
});

router.post('/player-trackers/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const { name, max } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Naam vereist' });
  const maxVal = Math.max(1, Math.min(20, parseInt(max) || 3));
  const dmState = readDmState();
  if (!dmState.playerTrackers) dmState.playerTrackers = {};
  if (!dmState.playerTrackers[characterId]) dmState.playerTrackers[characterId] = [];
  const tracker = {
    id: 'tr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name, max: maxVal, current: 0,
  };
  dmState.playerTrackers[characterId].push(tracker);
  storage.writeJSON('dm-state.json', dmState);
  res.json(tracker);
});

router.patch('/player-trackers/:characterId/:trackerId', attachRole, (req, res) => {
  const { characterId, trackerId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const trackers = (dmState.playerTrackers || {})[characterId] || [];
  const tracker = trackers.find(t => t.id === trackerId);
  if (!tracker) return res.status(404).json({ error: 'Tracker niet gevonden' });
  if (req.body.current !== undefined)
    tracker.current = Math.max(0, Math.min(tracker.max, parseInt(req.body.current) || 0));
  if (req.body.max !== undefined) {
    tracker.max = Math.max(1, Math.min(20, parseInt(req.body.max) || 1));
    tracker.current = Math.min(tracker.current, tracker.max);
  }
  if (req.body.name !== undefined) tracker.name = req.body.name;
  storage.writeJSON('dm-state.json', dmState);
  res.json(tracker);
});

router.delete('/player-trackers/:characterId/:trackerId', attachRole, (req, res) => {
  const { characterId, trackerId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerTrackers) dmState.playerTrackers = {};
  dmState.playerTrackers[characterId] = (dmState.playerTrackers[characterId] || []).filter(t => t.id !== trackerId);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Speler vastgezette spreuken ──

router.get('/player-spells/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerSpells || {})[characterId] || []);
});

router.post('/player-spells/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const { index, name, level, school, source, desc } = req.body;
  if (!index || !name) return res.status(400).json({ error: 'index en name vereist' });
  const dmState = readDmState();
  if (!dmState.playerSpells) dmState.playerSpells = {};
  if (!dmState.playerSpells[characterId]) dmState.playerSpells[characterId] = [];
  if (!dmState.playerSpells[characterId].find(s => s.index === index)) {
    const entry = { index, name, level: level || 0, school: school || '' };
    if (source) entry.source = source;
    if (desc)   entry.desc   = desc;
    dmState.playerSpells[characterId].push(entry);
  }
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

router.delete('/player-spells/:characterId/:spellIndex', attachRole, (req, res) => {
  const { characterId, spellIndex } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerSpells) dmState.playerSpells = {};
  dmState.playerSpells[characterId] = (dmState.playerSpells[characterId] || []).filter(s => s.index !== spellIndex);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Speler vastgezette kenmerken ──

router.get('/player-traits/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  res.json((dmState.playerTraits || {})[characterId] || []);
});

router.post('/player-traits/:characterId', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const { index, name, source, meta, desc } = req.body;
  if (!name) return res.status(400).json({ error: 'name vereist' });
  const dmState = readDmState();
  if (!dmState.playerTraits) dmState.playerTraits = {};
  if (!dmState.playerTraits[characterId]) dmState.playerTraits[characterId] = [];
  // Voorkom dubbelen op index
  if (index && dmState.playerTraits[characterId].find(t => t.index === index))
    return res.json({ ok: true, duplicate: true });
  const id = `trait_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  dmState.playerTraits[characterId].push({
    id, index: index || null, name, source: source || 'custom', meta: meta || '', desc: desc || '',
  });
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, id });
});

router.patch('/player-traits/:characterId/:traitId', attachRole, (req, res) => {
  const { characterId, traitId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const list = (dmState.playerTraits || {})[characterId] || [];
  const trait = list.find(t => t.id === traitId);
  if (!trait) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.maxUses     !== undefined) trait.maxUses     = Math.max(0, parseInt(req.body.maxUses)     || 0);
  if (req.body.currentUses !== undefined) trait.currentUses = Math.max(0, parseInt(req.body.currentUses) || 0);
  if (req.body.note        !== undefined) trait.note        = String(req.body.note || '').slice(0, 2000);
  storage.writeJSON('dm-state.json', dmState);
  res.json(trait);
});

router.delete('/player-traits/:characterId/:traitId', attachRole, (req, res) => {
  const { characterId, traitId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  if (!dmState.playerTraits) dmState.playerTraits = {};
  dmState.playerTraits[characterId] = (dmState.playerTraits[characterId] || []).filter(t => t.id !== traitId);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// ── Obsidian import ──

// Simple YAML frontmatter parser — handles strings, booleans, lists
function _parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
  if (!m) return null;
  const [, yaml, body] = m;
  const data = {};
  let currentKey = null;
  let inList = false;

  for (const rawLine of yaml.split(/\r?\n/)) {
    const listMatch = rawLine.match(/^  - (.*)$/);
    if (listMatch && inList && currentKey) {
      const val = listMatch[1].trim().replace(/^["']|["']$/g, '');
      if (val) data[currentKey].push(val);
      continue;
    }
    inList = false;
    const kvMatch = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kvMatch) continue;
    const [, key, raw] = kvMatch;
    currentKey = key;
    const val = raw.trim().replace(/^["']|["']$/g, '');
    if (val === '[]' || val === '') {
      data[key] = val === '[]' ? [] : null; // null = list starts below
      inList = true;
      if (val === '[]') inList = false;
      else data[key] = [];
    } else if (val === 'true')  { data[key] = true;  }
    else if (val === 'false') { data[key] = false; }
    else { data[key] = val; }
  }
  return { fm: data, body: body.trim() };
}

function _makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function _cleanLinks(arr) {
  return (arr || []).filter(s => s && s.trim() !== '');
}

function _importMd(content, filename) {
  const parsed = _parseFrontmatter(content);
  if (!parsed) return { ok: false, error: 'Geen geldige frontmatter gevonden in ' + filename };
  const { fm, body } = parsed;

  const type = (fm.type || '').toLowerCase();
  const name = (fm.name || filename.replace(/\.md$/i, '')).trim();
  if (!name) return { ok: false, error: 'Naam ontbreekt in ' + filename };

  const links = {
    personages:    _cleanLinks(fm.links_personages),
    locaties:      _cleanLinks(fm.links_locaties),
    organisaties:  _cleanLinks(fm.links_organisaties),
    voorwerpen:    _cleanLinks(fm.links_voorwerpen),
    archief:       [],
  };

  if (type === 'document') {
    // ── Document ──
    const entities = storage.readJSON('entities.json');
    const archief  = storage.readJSON('archief.json');
    if (!archief.documents) archief.documents = [];
    if (!archief.tekstContent) archief.tekstContent = {};
    const id = _makeId('doc');
    archief.documents.push({
      id,
      name,
      type:      fm.docType || 'Notities',
      cat:       fm.cat     || 'brieven',
      desc:      fm.desc    || '',
      icon:      fm.icon    || '📜',
      hoofdstuk: fm.hoofdstuk || '',
      npcs:      _cleanLinks(fm.links_personages),
      locs:      _cleanLinks(fm.links_locaties),
      orgs:      _cleanLinks(fm.links_organisaties),
      items:     _cleanLinks(fm.links_voorwerpen),
      docs:      _cleanLinks(fm.links_documenten),
    });
    if (body) archief.tekstContent[id] = body;
    storage.writeJSON('archief.json', archief);
    return { ok: true, id, name, type: 'document' };
  }

  // ── Entiteiten ──
  const ENTITY_MAP = {
    personage:    'personages',
    personages:   'personages',
    locatie:      'locaties',
    locaties:     'locaties',
    organisatie:  'organisaties',
    organisaties: 'organisaties',
    voorwerp:     'voorwerpen',
    voorwerpen:   'voorwerpen',
  };
  const collection = ENTITY_MAP[type];
  if (!collection) return { ok: false, error: `Onbekend type "${type}" in ${filename}` };

  const entities = storage.readJSON('entities.json');
  if (!entities[collection]) entities[collection] = [];

  const id  = _makeId('e');
  const data = {
    desc:            fm.desc            || body || '',
    flavour:         fm.flavour         || '',
    geheim:          fm.geheim          || '',
    rol:             fm.rol             || '',
    imgFocus:        '50% 50%',
    imgCaption:      '',
    icon:            '',
    groep:           '',
  };

  if (collection === 'personages') {
    data.ras             = fm.ras             || '';
    data.klasse          = fm.klasse          || '';
    data.persoonlijkheid = fm.persoonlijkheid || '';
  }
  if (collection === 'locaties') {
    data.locType  = fm.locType  || '';
    data.wijk     = fm.wijk     || '';
    data.eigenaar = fm.eigenaar || '';
  }
  if (collection === 'voorwerpen') {
    data.attunement = fm.attunement ? 'true' : 'false';
    data.rarity     = fm.rarity || '';
  }

  const entity = { id, name, icon: '', subtype: fm.subtype || '', data, links };

  // Stats (personages only)
  if (collection === 'personages') {
    const statFields = ['ac','hp','speed','cr','profBonus','str','dex','con','int','wis','cha',
      'savingThrows','skills','vulnerabilities','resistances','immunities','conditionImmunities',
      'senses','languages','traits','actions','bonusActions','reactions','legendaryActions',
      'spellSaveDC','spellAttackMod','cantrips','spells','extra'];
    const stats = {};
    let hasStats = false;
    for (const f of statFields) {
      const v = fm[`stat_${f}`] || '';
      stats[f] = v;
      if (v) hasStats = true;
    }
    entity.stats = hasStats ? stats : null;
  }

  entities[collection].push(entity);
  storage.writeJSON('entities.json', entities);
  return { ok: true, id, name, type: collection };
}

router.post('/import/obsidian', requireDM, upload.array('files', 50), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Geen bestanden ontvangen' });
  const results = [];
  for (const file of req.files) {
    const content = file.buffer.toString('utf8');
    results.push(_importMd(content, file.originalname));
  }
  res.json({ results });
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
    itemOwners:    {},
    itemRequests:  [],
    tradeAllowed:  true,
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
  const deletingDoc = (archief.documents || []).find(d => d.id === req.params.id);
  archief.documents  = (archief.documents  || []).filter(d => d.id !== req.params.id);
  archief.logEntries = (archief.logEntries || []).filter(e => e.docId !== req.params.id);
  // Verwijder terugverwijzingen in andere documenten en logboekentries
  if (deletingDoc) {
    for (const doc of (archief.documents || [])) {
      if (Array.isArray(doc.docs)) doc.docs = doc.docs.filter(n => n !== deletingDoc.name);
    }
    for (const entry of (archief.sessieLog || [])) {
      if (Array.isArray(entry.docs)) entry.docs = entry.docs.filter(n => n !== deletingDoc.name);
    }
  }
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
          imageId:      img.id,
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

// ── Sounds ──

router.get('/sounds', (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  if (!data.playerTurn) data.playerTurn = {};
  res.json(data);
});

router.put('/sounds', requireDM, (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  if (!data.playerTurn) data.playerTurn = {};
  if (req.body.standard)    Object.assign(data.standard,    req.body.standard);
  if (req.body.emotes)      Object.assign(data.emotes,      req.body.emotes);
  if (req.body.playerTurn)  Object.assign(data.playerTurn,  req.body.playerTurn);
  storage.writeJSON('sounds.json', data);
  res.json(data);
});

// ── Meta ──

router.get('/meta', (req, res) => {
  res.json(storage.readJSON('meta.json'));
});

router.put('/meta/app', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (req.body.appTitle    !== undefined) meta.appTitle    = String(req.body.appTitle).trim()    || meta.appTitle;
  if (req.body.appSubtitle !== undefined) meta.appSubtitle = String(req.body.appSubtitle).trim() || meta.appSubtitle;
  storage.writeJSON('meta.json', meta);
  req.app.get('io').emit('meta:updated');
  res.json({ appTitle: meta.appTitle, appSubtitle: meta.appSubtitle });
});

router.put('/meta/hoofdstuk/:key', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken) meta.hoofdstukken = {};
  meta.hoofdstukken[req.params.key] = {
    num:                 req.body.num   ?? 99,
    title:               req.body.title || '',
    dag:                 req.body.dag   || '',
    short:               req.body.short || req.body.title || req.params.key,
    bannerFocus:         req.body.bannerFocus         || '',
    bannerImg:           req.body.bannerImg           || '',
    spelersSamenvatting: req.body.spelersSamenvatting || '',
  };
  storage.writeJSON('meta.json', meta);
  req.app.get('io').emit('meta:updated');
  res.json(meta.hoofdstukken[req.params.key]);
});

router.put('/meta/herberg', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.herberg) meta.herberg = {};
  const allowed = ['naam','waard','imageId','backdropId','maxVragen','cooldownMinutenMin','cooldownMinutenMax','groet'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) meta.herberg[f] = req.body[f];
  }
  storage.writeJSON('meta.json', meta);
  req.app.get('io').emit('meta:updated');
  res.json(meta.herberg);
});

// ── Kaart ──

const DEFAULT_MAPS = [
  { id: 'grisburgh', label: 'Grisburgh', src: '/assets/map-grisburgh.jpg' },
  { id: 'isfar',     label: 'Isfār',     src: '/assets/map-isfar.jpg' },
];

function getMaps() {
  const mapData = storage.readJSON('map.json');
  return mapData.maps?.length ? mapData.maps : DEFAULT_MAPS;
}

router.get('/map/maps', attachRole, (req, res) => {
  res.json(getMaps());
});

router.post('/map/maps', requireDM, (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'Label vereist' });
  const mapData = storage.readJSON('map.json');
  if (!mapData.maps) mapData.maps = [...DEFAULT_MAPS];
  const map = { id: 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), label };
  mapData.maps.push(map);
  storage.writeJSON('map.json', mapData);
  req.app.get('io').emit('map:updated');
  res.json(map);
});

router.put('/map/maps/:id', requireDM, (req, res) => {
  const { label } = req.body;
  const mapData = storage.readJSON('map.json');
  if (!mapData.maps) mapData.maps = [...DEFAULT_MAPS];
  const map = mapData.maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  if (label) map.label = label;
  storage.writeJSON('map.json', mapData);
  req.app.get('io').emit('map:updated');
  res.json(map);
});

router.delete('/map/maps/:id', requireDM, (req, res) => {
  const mapData = storage.readJSON('map.json');
  if (!mapData.maps) mapData.maps = [...DEFAULT_MAPS];
  const map = mapData.maps.find(m => m.id === req.params.id);
  if (map && !map.src) storage.deleteFile(map.id);  // clean up upload if not a static asset
  mapData.maps = mapData.maps.filter(m => m.id !== req.params.id);
  mapData.pins = (mapData.pins || []).filter(p => (p.mapId || 'grisburgh') !== req.params.id);
  storage.writeJSON('map.json', mapData);
  req.app.get('io').emit('map:updated');
  res.json({ ok: true });
});

// Hulpfunctie: zoek groep van een speler op via character-entiteit
function _playerGroup(entities, characterId) {
  const char = (entities.personages || []).find(e => e.id === characterId);
  return char?.data?.groep || null;
}

router.get('/map/pins/available-locations', attachRole, (req, res) => {
  if (req.role === 'dm') return res.json([]);
  const mapId    = req.query.mapId || 'grisburgh';
  const charId   = req.characterId;
  if (!charId) return res.status(401).json({ error: 'Niet ingelogd' });
  const entities = storage.readJSON('entities.json');
  const mapData  = storage.readJSON('map.json');
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  const groupId  = _playerGroup(entities, charId);

  // Locaties die al een pin hebben op deze kaart (goedgekeurd of pending voor dezelfde groep)
  const takenLocIds = new Set(
    (mapData.pins || [])
      .filter(p => (p.mapId || 'grisburgh') === mapId)
      .filter(p => !p.pending || p.placedByGroup === groupId)
      .map(p => p.locId)
  );

  const available = (entities.locaties || []).filter(loc => {
    const vis = g.visibility[loc.id] || 'hidden';
    return vis === 'visible' && !takenLocIds.has(loc.id);
  }).map(loc => ({ id: loc.id, name: loc.name }));

  res.json(available);
});

router.get('/map/pins', attachRole, (req, res) => {
  const mapId   = req.query.mapId || 'grisburgh';
  const mapData = storage.readJSON('map.json');
  const entities= storage.readJSON('entities.json');
  const dmState = readDmState();
  const g       = getGroup(dmState);
  const locaties = entities.locaties || [];
  const charId  = req.characterId;
  const groupId = charId ? _playerGroup(entities, charId) : null;

  const pins = (mapData.pins || [])
    .filter(pin => (pin.mapId || 'grisburgh') === mapId)
    .map(pin => {
      const loc = locaties.find(l => l.id === pin.locId);
      if (!loc) return null;
      const vis = g.visibility[loc.id] || 'hidden';

      if (req.role !== 'dm') {
        // Speler: goedgekeurde pins (niet hidden) + eigen pending pin
        if (pin.pending) {
          if (pin.placedBy !== charId) return null;
          return { ...pin, locName: loc.name, visibility: vis };
        }
        if (vis === 'hidden') return null;
        return { ...pin, locName: vis === 'vague' ? null : loc.name, visibility: vis };
      }

      // DM: alle pins
      return { ...pin, locName: loc.name, visibility: vis };
    }).filter(Boolean);

  res.json(pins);
});

router.post('/map/pins', attachRole, (req, res) => {
  const { locId, x, y, mapId } = req.body;
  if (!locId || x == null || y == null) return res.status(400).json({ error: 'Ontbrekende velden' });
  const mapData  = storage.readJSON('map.json');
  const targetMap = mapId || 'grisburgh';

  if (req.role === 'dm') {
    const pin = {
      id:    'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      mapId: targetMap, locId,
      x:     parseFloat(x), y: parseFloat(y),
    };
    mapData.pins.push(pin);
    storage.writeJSON('map.json', mapData);
    req.app.get('io').emit('map:updated');
    return res.json(pin);
  }

  // Speler: pending pin
  const charId  = req.characterId;
  if (!charId) return res.status(401).json({ error: 'Niet ingelogd' });
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  const g        = getGroup(dmState);
  const groupId  = _playerGroup(entities, charId);
  const char     = (entities.personages || []).find(e => e.id === charId);

  // Controleer of locatie visible is
  const loc = (entities.locaties || []).find(l => l.id === locId);
  if (!loc) return res.status(404).json({ error: 'Locatie niet gevonden' });
  if ((g.visibility[locId] || 'hidden') !== 'visible')
    return res.status(403).json({ error: 'Locatie niet zichtbaar' });

  // Controleer uniekheid: max één pin per locatie per groep op deze kaart
  const exists = (mapData.pins || []).some(p =>
    (p.mapId || 'grisburgh') === targetMap && p.locId === locId &&
    (!p.pending || p.placedByGroup === groupId)
  );
  if (exists) return res.status(409).json({ error: 'Er staat al een pin voor deze locatie' });

  const pin = {
    id:             'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    mapId:          targetMap, locId,
    x:              parseFloat(x), y: parseFloat(y),
    pending:        true,
    placedBy:       charId,
    placedByGroup:  groupId,
    placedByName:   char?.name || 'Speler',
  };
  mapData.pins.push(pin);
  storage.writeJSON('map.json', mapData);

  // Stuur notificatie naar DM
  const io = req.app.get('io');
  io.emit('pin:pending', { id: pin.id, locName: loc.name, placedByName: pin.placedByName });

  res.json(pin);
});

router.put('/map/pins/:id/approve', requireDM, (req, res) => {
  const mapData = storage.readJSON('map.json');
  const pin = mapData.pins.find(p => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Niet gevonden' });
  if (!pin.pending) return res.status(400).json({ error: 'Pin is al goedgekeurd' });
  const { placedBy } = pin;
  delete pin.pending;
  delete pin.placedBy;
  delete pin.placedByGroup;
  delete pin.placedByName;
  storage.writeJSON('map.json', mapData);
  const io = req.app.get('io');
  io.emit('map:updated');
  // Stuur bevestiging naar de speler die de pin heeft geplaatst
  const entities = storage.readJSON('entities.json');
  const loc = (entities.locaties || []).find(l => l.id === pin.locId);
  const playerSockets = req.app.get('playerSockets');
  const socketId = playerSockets?.get(placedBy);
  if (socketId) io.to(socketId).emit('pin:approved', { locName: loc?.name || '' });
  res.json(pin);
});

router.put('/map/pins/:id', attachRole, (req, res) => {
  const { x, y } = req.body;
  if (x == null || y == null) return res.status(400).json({ error: 'Ontbrekende velden' });
  const mapData = storage.readJSON('map.json');
  const pin = mapData.pins.find(p => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Niet gevonden' });
  // Speler mag alleen eigen pending pin verplaatsen
  if (req.role !== 'dm') {
    if (!pin.pending || pin.placedBy !== req.characterId)
      return res.status(403).json({ error: 'Geen toegang' });
  }
  pin.x = parseFloat(x);
  pin.y = parseFloat(y);
  storage.writeJSON('map.json', mapData);
  res.json(pin);
});

router.delete('/map/pins/:id', requireDM, (req, res) => {
  const mapData = storage.readJSON('map.json');
  const pin = mapData.pins.find(p => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Niet gevonden' });
  const { placedBy } = pin;
  mapData.pins = mapData.pins.filter(p => p.id !== req.params.id);
  storage.writeJSON('map.json', mapData);
  const io = req.app.get('io');
  io.emit('map:updated');
  // Als dit een pending pin was: stuur afwijzing naar de speler
  if (pin.pending && placedBy) {
    const entities = storage.readJSON('entities.json');
    const loc = (entities.locaties || []).find(l => l.id === pin.locId);
    const playerSockets = req.app.get('playerSockets');
    const socketId = playerSockets?.get(placedBy);
    if (socketId) io.to(socketId).emit('pin:rejected', { locName: loc?.name || '' });
  }
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
  const raw = storage.readJSON('monsters.json');
  const data = Array.isArray(raw) ? { monsters: [] } : (raw || { monsters: [] });
  const monster = {
    ...req.body,
    id:          req.body.id || ('m_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
    name:        req.body.name        || 'Unnamed',
    chapter:     req.body.chapter     || '',
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

function _combatLog(combat, text) {
  if (!Array.isArray(combat.log)) combat.log = [];
  combat.log.push({ round: combat.round || 1, text });
  if (combat.log.length > 100) combat.log = combat.log.slice(-100);
}

// Synchroniseer HP van speler-combatanten terug naar dm-state.playerHp
function _flushPlayerHpToDmState(combat, io) {
  const players = (combat.combatants || []).filter(c => c.entityId);
  if (players.length === 0) return;
  const dmState = readDmState();
  if (!dmState.playerHp) dmState.playerHp = {};
  for (const c of players) {
    dmState.playerHp[c.entityId] = {
      current: c.hp  ?? dmState.playerHp[c.entityId]?.current ?? null,
      max:     c.maxHp ?? dmState.playerHp[c.entityId]?.max ?? null,
    };
    if (io) io.emit('player:hp-updated', { characterId: c.entityId, ...dmState.playerHp[c.entityId] });
  }
  storage.writeJSON('dm-state.json', dmState);
}

router.post('/combat/start', requireDM, (req, res) => {
  const existing = storage.readJSON('combat.json');
  const combatants = [...(existing.combatants || [])].sort((a, b) => b.initiative - a.initiative);
  const combat = { active: true, round: 1, currentTurn: 0, combatants, log: [] };
  _combatLog(combat, '⚔️ Gevecht begonnen');
  if (combatants[0]) _combatLog(combat, `▶ Beurt van ${combatants[0].name}`);
  storage.writeJSON('combat.json', combat);
  req.app.get('io').emit('combat:updated', combat);
  res.json(combat);
});

router.delete('/combat', requireDM, (req, res) => {
  // Persisteer speler-HP naar dm-state vóór het wissen van het gevecht
  const prevCombat = storage.readJSON('combat.json');
  _flushPlayerHpToDmState(prevCombat, req.app.get('io'));
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
  if (!Array.isArray(updated.log)) updated.log = combat.log || [];
  // Log nieuwe ronde
  if (req.body.round !== undefined && req.body.round > (combat.round || 1)) {
    _combatLog(updated, `🔔 Ronde ${req.body.round} begint`);
  }
  // Log beurtwissel
  if (req.body.currentTurn !== undefined && req.body.currentTurn !== combat.currentTurn) {
    const next = updated.combatants[req.body.currentTurn];
    if (next) _combatLog(updated, `▶ Beurt van ${next.name}`);
  }
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
  const prev = combat.combatants[idx];
  combat.combatants[idx] = { ...prev, ...req.body, id: req.params.id };
  // Hersorteren op initiative als dat gewijzigd is
  if (req.body.initiative !== undefined) {
    combat.combatants.sort((a, b) => b.initiative - a.initiative);
  }
  // Log HP-wijzigingen
  if (req.body.hp !== undefined && req.body.hp !== prev.hp) {
    const diff = req.body.hp - prev.hp;
    if (diff < 0) _combatLog(combat, `💥 ${prev.name} ontvangt ${-diff} schade (${req.body.hp}/${prev.maxHp || '?'} HP)`);
    else          _combatLog(combat, `💚 ${prev.name} geneest ${diff} HP (${req.body.hp}/${prev.maxHp || '?'} HP)`);
  }
  // Auto-detect: all monsters at 0 HP → players win
  if (!combat.winner && req.body.hp !== undefined) {
    const monsters = combat.combatants.filter(c => c.type === 'monster');
    if (monsters.length > 0 && monsters.every(c => (c.hp || 0) <= 0)) {
      combat.winner = 'players';
      _combatLog(combat, '🏆 Spelers winnen het gevecht!');
    }
  }
  storage.writeJSON('combat.json', combat);
  // Sync speler-HP naar dm-state zodat speler-tab altijd actueel is
  if (req.body.hp !== undefined || req.body.maxHp !== undefined) {
    _flushPlayerHpToDmState(combat, req.app.get('io'));
  }
  req.app.get('io').emit('combat:updated', combat);
  res.json(combat.combatants.find(c => c.id === req.params.id));
});

// Speler mag alleen eigen HP updaten in actief gevecht
router.patch('/combat/player-hp/:combatantId', attachRole, (req, res) => {
  if (!req.playerName) return res.status(403).json({ error: 'Niet ingelogd als speler' });
  const combat = storage.readJSON('combat.json');
  if (!combat.active) return res.status(400).json({ error: 'Geen actief gevecht' });
  const idx = combat.combatants.findIndex(c => c.id === req.params.combatantId);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  const c = combat.combatants[idx];
  // Controleer dat dit de eigen combatant is (via naam of entityId)
  const isOwn = c.name === req.playerName ||
    (c.entityId && c.entityId === req.session.characterId);
  if (!isOwn) return res.status(403).json({ error: 'Niet je eigen combatant' });
  const newHp = Math.max(0, Math.min(c.maxHp || 999, parseInt(req.body.hp) || 0));
  const hpDiff = newHp - (c.hp || 0);
  combat.combatants[idx] = { ...c, hp: newHp };
  if (hpDiff !== 0) {
    if (hpDiff < 0) _combatLog(combat, `💥 ${c.name} ontvangt ${-hpDiff} schade (${newHp}/${c.maxHp || '?'} HP)`);
    else            _combatLog(combat, `💚 ${c.name} geneest ${hpDiff} HP (${newHp}/${c.maxHp || '?'} HP)`);
  }
  storage.writeJSON('combat.json', combat);
  // Persisteer ook in playerHp
  const dmState = readDmState();
  if (!dmState.playerHp) dmState.playerHp = {};
  dmState.playerHp[c.entityId || c.name] = { current: newHp, max: c.maxHp || newHp };
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').emit('combat:updated', combat);
  res.json({ hp: newHp });
});

router.put('/combat/winner', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  combat.winner = req.body.winner || null;
  storage.writeJSON('combat.json', combat);
  // Gevecht eindigt: persisteer finale HP naar dm-state
  _flushPlayerHpToDmState(combat, req.app.get('io'));
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

// ── Snapshot export ──

router.get('/export', requireDM, async (req, res) => {
  try {
    const dmState  = readDmState();
    const groupId  = req.query.groupId || dmState.activeGroup;
    const html     = await buildSnapshot(dmState, groupId);
    const appTitle = storage.readJSON('meta.json').appTitle || 'grisburgh';
    const slug     = appTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const date     = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-snapshot-${date}.html"`);
    res.send(html);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/campagneboek', requireDM, async (req, res) => {
  try {
    const dmState  = readDmState();
    const groupId  = req.query.groupId || dmState.activeGroup;
    const html     = await buildCampagneboek(dmState, groupId);
    const appTitle = storage.readJSON('meta.json').appTitle || 'grisburgh';
    const slug     = appTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const date     = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-campagneboek-${date}.html"`);
    res.send(html);
  } catch (err) {
    console.error('Campagneboek export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Campagnes ──

// Lijst alle campagnes
router.get('/campaigns', requireDM, (req, res) => {
  res.json({
    campaigns:      storage.listCampaigns(),
    activeCampaign: storage.getActiveCampaignId(),
  });
});

// Nieuwe campagne aanmaken
router.post('/campaigns', requireDM, (req, res) => {
  const { id, meta = {} } = req.body;
  if (!id || !/^[a-z0-9_-]+$/i.test(id))
    return res.status(400).json({ error: 'Ongeldige campagne-ID (gebruik alleen letters, cijfers, _ en -)' });
  try {
    storage.createCampaign(id, meta);
    res.status(201).json({ id, ...meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wissel actieve campagne (logt alle spelers uit via socket)
router.put('/campaigns/active', requireDM, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id vereist' });
  const campaigns = storage.listCampaigns();
  if (!campaigns.find(c => c.id === id))
    return res.status(404).json({ error: 'Campagne niet gevonden' });
  storage.setCampaign(id);
  storage.init(); // Herinitialiseer databestanden voor nieuwe campagne
  const meta = storage.readJSON('meta.json');
  req.app.get('io').emit('campaign:switched', { id, meta });
  res.json({ ok: true, activeCampaign: id, meta });
});

// Meta van actieve campagne ophalen
router.get('/campaigns/meta', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  res.json({ ...meta, activeCampaign: storage.getActiveCampaignId() });
});

// ── Herberg / Roddelwaard ──

router.get('/herberg', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.herberg;
  if (!config) return res.status(404).json({ error: 'Herberg niet geconfigureerd' });

  const characterId = req.session.characterId || req.playerName || 'dm';
  const herbergState = storage.readJSON('herberg-state.json');
  let playerState = herbergState[characterId] || { vragen: 0, cooldownTot: null };

  // Reset cooldown als die verlopen is
  if (playerState.cooldownTot && new Date(playerState.cooldownTot) < new Date()) {
    playerState = { vragen: 0, cooldownTot: null };
    herbergState[characterId] = playerState;
    storage.writeJSON('herberg-state.json', herbergState);
  }

  // Verzamel entiteiten met flavour die zichtbaar of vaag zijn
  const entities = storage.readJSON('entities.json');
  const dmState = readDmState();
  const g = getGroup(dmState);
  const visibility = g.visibility || {};

  const result = [];
  for (const type of ['personages', 'locaties']) {
    for (const e of (entities[type] || [])) {
      const vis = visibility[e.id] || 'hidden';
      if (vis === 'hidden') continue;          // volledig verborgen: overslaan
      if (!e.data?.flavour) continue;          // geen roddel: overslaan
      result.push({
        id: e.id,
        name: e.name,
        type,
        uitgesproken: e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true',
        visibility: vis,
      });
    }
  }

  // Spelersnaam ophalen voor begroeting
  const charEntity = (entities.personages || []).find(e => e.id === characterId);
  const playerFirstName = (charEntity?.name || '').split(/\s+/)[0] || '';

  res.json({
    config: {
      naam:      config.naam,
      waard:     config.waard,
      imageId:   config.imageId || '',
      maxVragen: config.maxVragen || 3,
      groet:     config.groet || '',
    },
    state:           playerState,
    entities:        result,
    playerFirstName,
  });
});

router.post('/herberg/vraag', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.herberg;
  if (!config) return res.status(404).json({ error: 'Herberg niet geconfigureerd' });

  const characterId = req.session.characterId || req.playerName || 'dm';
  const herbergState = storage.readJSON('herberg-state.json');
  let playerState = herbergState[characterId] || { vragen: 0, cooldownTot: null };

  // Reset verlopen cooldown
  if (playerState.cooldownTot && new Date(playerState.cooldownTot) < new Date()) {
    playerState = { vragen: 0, cooldownTot: null };
  }

  // Controleer cooldown actief
  if (playerState.cooldownTot && new Date(playerState.cooldownTot) > new Date()) {
    return res.status(429).json({ error: 'Cooldown actief', cooldownTot: playerState.cooldownTot });
  }

  const maxVragen = config.maxVragen || 3;
  if (playerState.vragen >= maxVragen) {
    return res.status(429).json({ error: 'Maximum vragen bereikt' });
  }

  const { entityId } = req.body;
  if (!entityId) return res.status(400).json({ error: 'entityId vereist' });

  // Zoek entiteit in personages en locaties
  const entities = storage.readJSON('entities.json');
  let foundEntity = null;
  let foundType = null;
  for (const type of ['personages', 'locaties']) {
    const e = (entities[type] || []).find(e => e.id === entityId);
    if (e) { foundEntity = e; foundType = type; break; }
  }

  if (!foundEntity) return res.status(404).json({ error: 'Entiteit niet gevonden' });
  if (!foundEntity.data?.flavour) return res.status(404).json({ error: 'Geen roddel beschikbaar' });

  // Markeer als uitgesproken
  foundEntity.data.flavourUitgesproken = 'true';
  storage.writeJSON('entities.json', entities);

  // Update spelerstoestand
  playerState.vragen += 1;
  if (playerState.vragen >= maxVragen) {
    const minMin = config.cooldownMinutenMin ?? 3;
    const maxMin = config.cooldownMinutenMax ?? 10;
    const cooldownMin = minMin + Math.floor(Math.random() * (maxMin - minMin + 1));
    playerState.cooldownTot = new Date(Date.now() + cooldownMin * 60 * 1000).toISOString();
  }
  herbergState[characterId] = playerState;
  storage.writeJSON('herberg-state.json', herbergState);

  // Stuur socket-event zodat kaarten refreshen
  req.app.get('io').emit('entity:updated', { type: foundType, id: entityId });

  res.json({
    flavour: foundEntity.data.flavour,
    audioId: foundEntity.data.audioId || null,
    entityName: foundEntity.name,
    entityId: foundEntity.id,
    entityType: foundType,
    uitgesproken: true,
    vragen: playerState.vragen,
    cooldownTot: playerState.cooldownTot || null,
  });
});

module.exports = router;
