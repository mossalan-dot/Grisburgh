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

// #24: gescheiden upload-instances met whitelist-fileFilter i.p.v. één
// ongefilterde upload. Media (afbeeldingen/audio/video/pdf) en tekst (.md-import)
// hebben verschillende toegestane types en groottes.
const MEDIA_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'video/mp4', 'video/webm',
]);
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, MEDIA_MIME.has(file.mimetype)),
});
const uploadText = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    const ok = /\.md$/i.test(file.originalname) ||
      file.mimetype.startsWith('text/') || file.mimetype === 'application/octet-stream';
    cb(null, ok);
  },
});

// Magic-byte sniff: verifieert dat de inhoud écht een toegestaan mediatype is,
// zodat een verkeerd-getypeerd/hernoemd bestand (bv. .exe als .png) wordt geweigerd.
// SVG is tekst en wordt apart herkend (begint met '<' na optionele BOM/whitespace).
function _sniffMedia(buf) {
  if (!buf || buf.length < 4) return false;
  const b = buf;
  const hex = (...n) => n.every((v, i) => b[i] === v);
  if (hex(0x89, 0x50, 0x4e, 0x47)) return true;                         // PNG
  if (hex(0xff, 0xd8, 0xff)) return true;                                // JPEG
  if (hex(0x47, 0x49, 0x46, 0x38)) return true;                          // GIF
  if (hex(0x25, 0x50, 0x44, 0x46)) return true;                          // PDF (%PDF)
  if (hex(0x4f, 0x67, 0x67, 0x53)) return true;                          // OGG
  if (hex(0x1a, 0x45, 0xdf, 0xa3)) return true;                          // WEBM/Matroska (EBML)
  if (hex(0x49, 0x44, 0x33)) return true;                                // MP3 (ID3)
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true;              // MP3 (frame sync)
  // RIFF-containers: WEBP / WAV (controleer subtype op offset 8)
  if (hex(0x52, 0x49, 0x46, 0x46) && b.length >= 12) {
    const sub = b.toString('ascii', 8, 12);
    if (sub === 'WEBP' || sub === 'WAVE') return true;
  }
  // MP4/MOV: 'ftyp' op offset 4
  if (b.length >= 8 && b.toString('ascii', 4, 8) === 'ftyp') return true;
  // SVG (tekst): eerste niet-witruimte teken is '<'
  const head = b.toString('utf8', 0, Math.min(b.length, 256)).replace(/^﻿/, '').trimStart();
  if (head.startsWith('<')) return true;
  return false;
}

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── Thumbnail-cache ──
// Genereert bij eerste aanvraag een 600px-brede WebP en slaat die op in
// data/campaigns/<id>/thumbs/. Daarna wordt de gecachte versie direct geserveerd.
router.get('/thumb/:id', attachRole, async (req, res) => {
  if (!req.role) return res.status(401).json({ error: 'Niet ingelogd' });
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
    name:        g.name,
    active:      id === dmState.activeGroup,
    hasPassword: !!g.password,
  }));
}

// ── Entity player filter ──

// Geeft de effectieve beurs terug: gedeeld als actief voor de groep, anders individueel
function _effectiveCurrency(dmState, characterId) {
  if (!characterId) return null;
  const playerGroupId = _playerGroupId(dmState, characterId);
  const pg = playerGroupId ? getGroup(dmState, playerGroupId) : null;
  if (pg?.sharedPurse?.enabled) {
    const s = pg.sharedPurse;
    return { fl: s.fl || 0, kn: s.kn || 0, cl: s.cl || 0 };
  }
  return (dmState.playerCurrency || {})[characterId] || { fl: 0, kn: 0, cl: 0 };
}

// Zoek een goddelijk voorwerp-entity op godNaam + type (zegen/eed/vloek) en onthul het aan de groep
function _koppelGoddelijkEntity(dmState, characterId, godNaam, goddelijkType, playerItem) {
  const entities = storage.readJSON('entities.json');
  const effectText = playerItem.zegenEffect || '';
  const match = (entities.voorwerpen || []).find(e =>
    e.data?.itemType === 'Blessing' &&
    (e.data?.godNaam || '').trim().toLowerCase() === (godNaam || '').trim().toLowerCase() &&
    (e.data?.goddelijkType || '') === goddelijkType &&
    (goddelijkType !== 'zegen' || (e.data?.effect || '').startsWith(effectText.split(':')[0]))
  );
  if (!match) return;
  playerItem.entityId   = match.id;
  playerItem.entityType = 'voorwerpen';
  // Onthul entiteit aan de groep van de speler
  const groupId = _playerGroupId(dmState, characterId);
  if (groupId) {
    const g = getGroup(dmState, groupId);
    if (!g.visibility) g.visibility = {};
    if (g.visibility[match.id] === 'hidden' || !g.visibility[match.id]) {
      g.visibility[match.id] = 'visible';
    }
  }
}

// Schrijf valuta af van de juiste bron (gedeeld of individueel) en geef de nieuwe waarde terug
function _deductCurrency(dmState, characterId, prijsCl) {
  const playerGroupId = _playerGroupId(dmState, characterId);
  const pg = playerGroupId ? getGroup(dmState, playerGroupId) : null;
  if (pg?.sharedPurse?.enabled) {
    pg.sharedPurse = fromCl(toCl(pg.sharedPurse) - prijsCl);
    pg.sharedPurse.enabled = true;
    return { shared: true, currency: { fl: pg.sharedPurse.fl, kn: pg.sharedPurse.kn, cl: pg.sharedPurse.cl } };
  }
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const cur = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  dmState.playerCurrency[characterId] = fromCl(toCl(cur) - prijsCl);
  return { shared: false, currency: dmState.playerCurrency[characterId] };
}

// Bepaal de groep van een speler op basis van het karakter-entity
// #31: characterId → groep wordt op elke polltick opgevraagd. I.p.v. heel
// entities.json per call te lezen/parsen, cachen we een lichte id→groep-map
// per campagne en herbouwen die alleen als entities.json wijzigt (mtime). De
// map is read-only, dus veilig te cachen (anders dan de gemuteerde dm-state).
const _groepCacheByDir = new Map(); // dataDir → { mtimeMs, map }
function _playerGroupId(dmState, characterId) {
  if (!characterId) return null;
  const dir = storage.DATA_DIR;
  const fp  = path.join(dir, 'entities.json');
  let mtimeMs = -1;
  try { mtimeMs = fs.statSync(fp).mtimeMs; } catch {}
  let cached = _groepCacheByDir.get(dir);
  if (!cached || cached.mtimeMs !== mtimeMs) {
    const entities = storage.readJSON('entities.json');
    const map = new Map();
    for (const e of (entities.personages || [])) if (e?.data?.groep) map.set(e.id, e.data.groep);
    cached = { mtimeMs, map };
    _groepCacheByDir.set(dir, cached);
  }
  const groep = cached.map.get(characterId);
  return (groep && dmState.groups?.[groep]) ? groep : null;
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

function filterDocForPlayer(doc, dmState, groupId) {
  const groupDocVis = groupId ? dmState.groups?.[groupId]?.docVisibility : null;
  const state = (groupDocVis != null && doc.id in groupDocVis)
    ? groupDocVis[doc.id]
    : (dmState.docStates[doc.id] || 'hidden');
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

// ── Ontdekkings-teller (feature #5) ──
// Per entiteitstype: hoeveel de groep van de speler heeft ontdekt (visibility
// vague|visible) t.o.v. het totaal aantal (niet-getrashte) entiteiten.
router.get('/ontdekkingen', attachRole, (req, res) => {
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  let gid;
  if (req.role === 'dm') {
    gid = dmState.activeGroup;
  } else {
    if (!req.session.characterId) return res.json({});
    gid = _playerGroupId(dmState, req.session.characterId) || dmState.activeGroup;
  }
  const g   = getGroup(dmState, gid);
  const vis = g?.visibility || {};
  const out = {};
  for (const type of ENTITY_TYPES) {
    let list = entities[type] || [];
    // Eigen party telt niet mee — de teller meet wereld-ontdekking, geen spelers.
    if (type === 'personages') list = list.filter(e => e.subtype !== 'speler');
    const ontdekt = list.filter(e => {
      const v = vis[e.id];
      return v === 'vague' || v === 'visible';
    }).length;
    out[type] = { ontdekt, totaal: list.length };
  }
  // Documenten hebben een eigen zichtbaarheidsmodel (hidden|blurred|revealed),
  // per groep via docVisibility met fallback op globale docStates.
  const archief    = storage.readJSON('archief.json');
  const docs       = archief.documents || [];
  const groupDocVis = g?.docVisibility || null;
  const docOntdekt = docs.filter(d => {
    const state = (groupDocVis && d.id in groupDocVis)
      ? groupDocVis[d.id]
      : (dmState.docStates?.[d.id] || 'hidden');
    return state !== 'hidden';
  }).length;
  out.documenten = { ontdekt: docOntdekt, totaal: docs.length };
  res.json(out);
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
    req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type, id: entity.id });
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
        if (changed) req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type: et, id: entity.id });
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
      req.app.get('io').to(req.session?.campaignId||'main').emit('logboek:updated', {});
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
          req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type: lt, id: target.id });
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
            req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type: lt, id: target.id });
          }
        }
      }
    }
  }

  storage.writeJSON('entities.json', entities);
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type, id });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type, id, deleted: true });
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:trashed', { type, id, name: dying.name });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type, id: entity.id, restored: true });
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
  if (req.body?.target === 'visible') {
    next = 'visible';
  } else if (req.body?.target === 'vague' && threeState) {
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:visibility', { id, type, name: entity?.name || '', visibility: next });

  if (type === 'locaties' && next !== 'hidden') {
    const mapData = storage.readJSON('map.json');
    const hasPin  = (mapData.pins || []).some(p => p.locId === id);
    if (hasPin) {
      req.app.get('io').to(req.session?.campaignId||'main').emit('map:pinRevealed', { id, name: entity?.name || '', visibility: next });
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
  // Verify the item is actually in an open shop for this group
  const shopIds = Object.keys(g.shops || {});
  const inShop = shopIds.some(sid => {
    const shop = g.shops[sid];
    return shop && Array.isArray(shop.items) && shop.items.some(si => (si.id || si) === id);
  });
  if (!inShop) return res.status(403).json({ error: 'Item niet in een actieve shop' });
  const current = g.visibility[id] || 'hidden';
  if (current !== 'hidden') return res.json({ visibility: current, changed: false });
  g.visibility[id] = 'visible';
  storage.writeJSON('dm-state.json', dmState);
  const entities = storage.readJSON('entities.json');
  const entity   = (entities[type] || []).find(e => e.id === id);
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:visibility', { id, type, name: entity?.name || '', visibility: 'visible' });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:secret', {
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { id, deceased: g.deceased[id] });
  if (g.deceased[id] && entity) {
    req.app.get('io').to(req.session?.campaignId||'main').emit('entity:deceased', { id, type, name: entity.name });
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
      req.app.get('io').to(req.session?.campaignId||'main').emit('notes:created', {
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
    // DM: geef alle berichten terug, gegroepeerd per character (incl. zachte-verwijderde brieven)
    const entities = storage.readJSON('entities.json');
    const spelers = (entities.personages || []).filter(e => e.subtype === 'speler');
    const result = spelers.map(s => ({
      characterId: s.id,
      name: s.name,
      berichten: (berichten[s.id] || []).sort((a, b) => b.timestamp - a.timestamp),
    }));
    return res.json({ spelers: result });
  }
  // Speler: eigen berichten (filter zachte-verwijderde brieven)
  if (!req.characterId) return res.json({ berichten: [] });
  const eigen = (berichten[req.characterId] || [])
    .filter(m => !m.deletedAt)
    .sort((a, b) => b.timestamp - a.timestamp);
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

// ── Brieven (DM → speler/party) ──
// Opgeslagen in berichten.json als { type:'brief', titel, tekst, afzender, entityId, entityType, deletedAt }

// Bezorg programmatisch een (gethematiseerde) brief in de berichtenbox van een speler
function _bezorgBrief(req, cid, { titel = '', tekst = '', afzender = '', thema = '', entityId = null, entityType = null, datum = '' }) {
  if (!cid || !tekst) return null;
  const berichten = storage.readJSON('berichten.json') || {};
  if (!berichten[cid]) berichten[cid] = [];
  const now = Date.now();
  const post = {
    id: `post_${now}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'brief', titel, tekst, afzender, entityId, entityType, datum, thema,
    timestamp: now, deletedAt: null,
  };
  berichten[cid].unshift(post);
  storage.writeJSON('berichten.json', berichten);
  const io = req.app.get('io');
  const socketId = req.app.get('playerSockets')?.get(cid);
  if (socketId) io.to(socketId).emit('bericht:nieuw', { msg: post });
  return post;
}

router.post('/post', requireDM, (req, res) => {
  const { titel, tekst, afzender, entityId, entityType, characterId, groepId, datum, thema } = req.body;
  if (!tekst?.trim()) return res.status(400).json({ error: 'Tekst is verplicht' });
  const THEMAS = ['ursula', 'gock', 'tweespalt', 'heeren'];
  const veiligThema = THEMAS.includes(thema) ? thema : '';
  const THEMA_AFZENDER = { ursula: 'Madame Ursula', gock: 'De Gock', tweespalt: 'De Tweespalt', heeren: 'De Heeren van de Nacht' };
  const afzenderDef = (afzender?.trim()) || (veiligThema ? THEMA_AFZENDER[veiligThema] : '');

  const berichten = storage.readJSON('berichten.json') || {};
  const io          = req.app.get('io');
  const playerSockets = req.app.get('playerSockets');

  // Bepaal ontvangers
  let recipients = [];
  if (groepId) {
    const entities = storage.readJSON('entities.json');
    const groepsleden = (entities.personages || []).filter(
      e => e.subtype === 'speler' && e.data?.groep === groepId
    );
    recipients = groepsleden.map(e => e.id);
  } else if (characterId) {
    recipients = [characterId];
  }

  if (recipients.length === 0) return res.status(400).json({ error: 'Geen ontvangers gevonden' });

  let created = 0;
  const now = Date.now();

  for (const cid of recipients) {
    if (!berichten[cid]) berichten[cid] = [];
    const post = {
      id: `post_${now}_${Math.random().toString(36).substr(2,4)}`,
      type: 'brief',
      titel: titel?.trim() || '',
      tekst: tekst.trim(),
      afzender: afzenderDef,
      entityId: entityId || null,
      entityType: entityType || null,
      datum: datum?.trim() || '',
      thema: veiligThema,
      timestamp: now,
      deletedAt: null,
    };
    berichten[cid].unshift(post);
    created++;
    // Notificeer speler als verbonden
    const socketId = playerSockets?.get(cid);
    if (socketId) io.to(socketId).emit('bericht:nieuw', { msg: post });
  }

  storage.writeJSON('berichten.json', berichten);
  res.json({ ok: true, created });
});

// Zachte verwijdering van een brief door speler (DM ziet 'weggegooid' indicator)
router.delete('/post/:characterId/:postId', attachRole, (req, res) => {
  const { characterId, postId } = req.params;
  if (req.session.role !== 'dm' && req.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const berichten = storage.readJSON('berichten.json') || {};
  const post = (berichten[characterId] || []).find(m => m.id === postId);
  if (post) {
    post.deletedAt = Date.now();
    storage.writeJSON('berichten.json', berichten);
  }
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('shop:uitverkocht-updated', {
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
  // Gebruik altijd de groep van de kopende speler, niet de actieve DM-groep.
  const buyerGroupId = _playerGroupId(dmState, characterId);
  const g = getGroup(dmState, buyerGroupId);

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
    io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  }

  if (effectiveEntityId) {
    io.to(req.session?.campaignId||'main').emit('items:ownership-updated', {
      owners: g.itemOwners || {},
      requests: g.itemRequests || [],
      tradeAllowed: g.tradeAllowed !== false,
    });
    // Stuur onthullingsgebeurtenis zodat het kaartje zichtbaar wordt
    io.to(req.session?.campaignId||'main').emit('entity:visibility', { id: effectiveEntityId, type: 'voorwerpen', name: _entityItem?.name || '', visibility: 'visible' });
  } else {
    io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: (dmState.playerItems || {})[characterId] || [] });
  }

  if (!isStapelbaar) {
    io.to(req.session?.campaignId||'main').emit('shop:uitverkocht-updated', { shopId, uitverkocht: g.shopUitverkocht[shopId] });
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
  // Spelers zien altijd hun eigen groep — niet de actief geselecteerde DM-groep.
  // (De DM kan naar groep 3 wisselen terwijl spelers in groep 1 zitten.)
  const charId = req.session?.characterId;
  const playerGroupId = charId ? _playerGroupId(dmState, charId) : null;
  // Speler zonder groep krijgt lege response (niet de DM-groep lekken)
  if (req.role !== 'dm' && charId && !playerGroupId) return res.json([]);
  const g = playerGroupId ? getGroup(dmState, playerGroupId) : getGroup(dmState);
  let stapelbaar = [], gedeeld = [];
  try {
    const entities = storage.readJSON('entities.json');
    const _gebruik = d => d?.gebruik || (d?.stapelbaar === 'true' ? 'stapelbaar' : d?.gedeeld === 'true' ? 'gedeeld' : 'uniek');
    stapelbaar = (entities.voorwerpen || []).filter(e => _gebruik(e.data) === 'stapelbaar').map(e => e.id);
    gedeeld    = (entities.voorwerpen || []).filter(e => _gebruik(e.data) === 'gedeeld').map(e => e.id);
  } catch { /* ok */ }
  res.json({
    owners:       g.itemOwners   || {},
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
    stapelbaar,
    gedeeld,
    itemCharges:     charId ? ((g.itemCharges    || {})[charId] || {}) : (g.itemCharges    || {}),
    itemMaxCharges:  charId ? ((g.itemMaxCharges || {})[charId] || {}) : (g.itemMaxCharges || {}),
  });
});

router.put('/items/trade-allowed', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  g.tradeAllowed = !!req.body.allowed;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
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
  // Gebruik altijd de groep van de aanvragende speler
  const requesterGroupId = _playerGroupId(dmState, req.session.characterId);
  const g = getGroup(dmState, requesterGroupId);
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

  req.app.get('io').to(req.session?.campaignId||'main').emit('items:request', {
    ...reqObj,
    owners:       g.itemOwners,
    requests:     g.itemRequests,
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.status(201).json(reqObj);
});

router.post('/items/request/:reqId/approve', requireDM, (req, res) => {
  const dmState = readDmState();
  // Zoek het verzoek in ALLE groepen (speler kan in een andere groep zitten dan de DM's actieve groep)
  let g = null, idx = -1;
  for (const grp of Object.values(dmState.groups || {})) {
    const i = (grp.itemRequests || []).findIndex(r => r.id === req.params.reqId);
    if (i !== -1) { g = grp; idx = i; break; }
  }
  if (!g || idx === -1) return res.status(404).json({ error: 'Verzoek niet gevonden' });
  if (!g.itemOwners) g.itemOwners = {};
  const r = g.itemRequests[idx];
  g.itemRequests[idx].status = 'approved';

  if (r.type === 'claim') {
    g.itemOwners[r.itemId] = { characterId: r.requesterId, playerName: r.requesterName };
  } else if (r.type === 'trade' && r.targetId) {
    g.itemOwners[r.itemId] = { characterId: r.requesterId, playerName: r.requesterName };
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
    owners: g.itemOwners, requests: g.itemRequests,
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true });
});

router.post('/items/request/:reqId/reject', requireDM, (req, res) => {
  const dmState = readDmState();
  // Zoek het verzoek in ALLE groepen
  let g = null, idx = -1;
  for (const grp of Object.values(dmState.groups || {})) {
    const i = (grp.itemRequests || []).findIndex(r => r.id === req.params.reqId);
    if (i !== -1) { g = grp; idx = i; break; }
  }
  if (!g || idx === -1) return res.status(404).json({ error: 'Verzoek niet gevonden' });
  g.itemRequests[idx].status = 'rejected';
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
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
  const _geb = d => d?.gebruik || (d?.stapelbaar === 'true' ? 'stapelbaar' : d?.gedeeld === 'true' ? 'gedeeld' : 'uniek');
  const isStapelbaar = _geb(item?.data) === 'stapelbaar';
  const isGedeeld    = _geb(item?.data) === 'gedeeld';
  // groupId uit body heeft voorrang; daarna de eigen groep van het karakter; dan de actieve DM-groep.
  const targetId = groupId || _playerGroupId(dmState, characterId) || dmState.activeGroup;
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
  } else if (isGedeeld) {
    // Array-eigendom, maar qty altijd 1 en niet stapelen per speler
    if (!Array.isArray(g.itemOwners[itemId])) g.itemOwners[itemId] = [];
    if (!g.itemOwners[itemId].find(o => o.characterId === characterId)) {
      g.itemOwners[itemId].push({ characterId, playerName, qty: 1 });
    }
  } else {
    g.itemOwners[itemId] = { characterId, playerName };
  }

  // Auto-onthul het voorwerp als het nog verborgen is
  if (!g.visibility) g.visibility = {};
  const wasHidden = !g.visibility[itemId] || g.visibility[itemId] === 'hidden';
  if (wasHidden) g.visibility[itemId] = 'visible';

  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
    owners:       g.itemOwners,
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
    given:        { itemName: item?.name || '', playerName, groupId: targetId },
  });
  if (wasHidden) {
    req.app.get('io').to(req.session?.campaignId||'main').emit('entity:visibility', {
      id:         itemId,
      type:       'voorwerpen',
      name:       item?.name || '',
      visibility: 'visible',
    });
  }
  res.json({ ok: true });
});

router.delete('/items/:itemId/owner', requireDM, (req, res) => {
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  const item     = (entities.voorwerpen || []).find(e => e.id === req.params.itemId);
  const { characterId, groupId } = req.query; // optioneel: characterId voor stapelbaar; groupId voor expliciete groep

  // Zoek de groep die het item bezit: groupId query-param, dan eerste groep met eigendom, dan actieve groep
  let g = groupId ? dmState.groups[groupId] : null;
  if (!g) {
    for (const grp of Object.values(dmState.groups || {})) {
      if (grp.itemOwners && req.params.itemId in grp.itemOwners) { g = grp; break; }
    }
  }
  if (!g) g = getGroup(dmState);

  if (characterId && Array.isArray((g.itemOwners || {})[req.params.itemId])) {
    // Verwijder specifieke speler uit stapelbaar eigendom
    g.itemOwners[req.params.itemId] = g.itemOwners[req.params.itemId]
      .filter(o => o.characterId !== characterId);
    if (g.itemOwners[req.params.itemId].length === 0) delete g.itemOwners[req.params.itemId];
  } else {
    if (g.itemOwners) delete g.itemOwners[req.params.itemId];
  }

  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
    owners:       g.itemOwners  || {},
    requests:     g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
    takenBack:    item ? { itemName: item.name, characterId: characterId || null } : undefined,
  });
  res.json({ ok: true });
});

// Speler of DM past hoeveelheid aan van een stapelbaar voorwerp
router.patch('/items/:itemId/owner/:characterId', attachRole, (req, res) => {
  const { itemId, characterId } = req.params;
  const { delta } = req.body;
  // #25: zelfde guard als /charges en /maxCharges — DM mag alles, een speler
  // alleen zijn eigen eigendom; een anonieme request wordt geweigerd.
  if (req.role !== 'dm' && req.session?.characterId !== characterId) {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  const patchItem = (entities.voorwerpen || []).find(e => e.id === itemId);
  const _pgeb = d => d?.gebruik || (d?.stapelbaar === 'true' ? 'stapelbaar' : d?.gedeeld === 'true' ? 'gedeeld' : 'uniek');
  if (_pgeb(patchItem?.data) === 'gedeeld') {
    return res.status(403).json({ error: 'Gedeeld eigendom kan niet worden aangepast' });
  }
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('items:ownership-updated', {
    owners: g.itemOwners || {}, requests: g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
  });
  res.json({ ok: true, qty: entry.qty });
});

// ── Dice roller helper ──
function rollDice(formula) {
  const m = (formula || '').trim().match(/^(\d+)d(\d+)$/i);
  if (!m) return 0;
  const count = parseInt(m[1]), sides = parseInt(m[2]);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

// ── Item charges ──

router.patch('/items/:itemId/owner/:characterId/charges', attachRole, (req, res) => {
  const { itemId, characterId } = req.params;
  const { charges } = req.body;
  if (req.role !== 'dm' && req.session?.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemCharges) g.itemCharges = {};
  if (!g.itemCharges[characterId]) g.itemCharges[characterId] = {};
  g.itemCharges[characterId][itemId] = Math.max(0, parseInt(charges) || 0);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, charges: g.itemCharges[characterId][itemId] });
});

router.patch('/items/:itemId/owner/:characterId/maxCharges', attachRole, (req, res) => {
  const { itemId, characterId } = req.params;
  const { maxCharges } = req.body;
  if (req.role !== 'dm' && req.session?.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemMaxCharges) g.itemMaxCharges = {};
  if (!g.itemMaxCharges[characterId]) g.itemMaxCharges[characterId] = {};
  const newMax = Math.max(0, parseInt(maxCharges) || 0);
  g.itemMaxCharges[characterId][itemId] = newMax;
  // Clamp current charges to new max
  if (!g.itemCharges) g.itemCharges = {};
  if (!g.itemCharges[characterId]) g.itemCharges[characterId] = {};
  if ((g.itemCharges[characterId][itemId] || 0) > newMax)
    g.itemCharges[characterId][itemId] = newMax;
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, maxCharges: newMax });
});

router.post('/characters/:characterId/long-rest', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session?.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  let entities = {};
  try { entities = storage.readJSON('entities.json'); } catch { /* ok */ }
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.itemCharges) g.itemCharges = {};
  if (!g.itemCharges[characterId]) g.itemCharges[characterId] = {};
  const ownedItemIds = Object.keys(g.itemOwners || {}).filter(itemId => {
    const owners = g.itemOwners[itemId];
    if (Array.isArray(owners)) return owners.some(o => o.characterId === characterId);
    return owners?.characterId === characterId;
  });
  ownedItemIds.forEach(itemId => {
    const item = (entities.voorwerpen || []).find(e => e.id === itemId);
    const baseMax = parseInt(item?.data?.maxCharges);
    const effectiveMax = (g.itemMaxCharges?.[characterId]?.[itemId]) ?? baseMax;
    const rechargeOn = item?.data?.rechargeOn || 'longRest';
    if (effectiveMax > 0 && (rechargeOn === 'longRest' || rechargeOn === 'dawn')) {
      g.itemCharges[characterId][itemId] = effectiveMax;
    } else if (effectiveMax > 0 && rechargeOn === 'longRestRoll') {
      const rolled = rollDice(item?.data?.rechargeRoll || '1d3');
      const current = g.itemCharges[characterId][itemId] ?? effectiveMax;
      g.itemCharges[characterId][itemId] = Math.min(effectiveMax, current + rolled);
    }
  });
  // Tempel-zegens vervallen bij een lange rust
  if (dmState.playerItems?.[characterId]?.some(i => i.zegen)) {
    dmState.playerItems[characterId] = dmState.playerItems[characterId].filter(i => !i.zegen);
    const io = req.app.get('io');
    if (io) io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });
  }
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// Party-brede lange rust (DM-actie)
router.post('/party/long-rest', requireDM, (req, res) => {
  let entities = {};
  try { entities = storage.readJSON('entities.json'); } catch { /* ok */ }
  const dmState = readDmState();
  const io = req.app.get('io');
  const g = getGroup(dmState);

  // Alle spelers in de actieve groep
  const activeGroepId = dmState.activeGroup || Object.keys(dmState.groups || {})[0];
  const spelers = (entities.personages || []).filter(
    e => e.subtype === 'speler' && e.data?.groep === activeGroepId
  );

  // ── 1. HP → max ──
  if (!dmState.playerHp) dmState.playerHp = {};
  spelers.forEach(char => {
    const hp = dmState.playerHp[char.id];
    if (hp && hp.max !== null) {
      dmState.playerHp[char.id] = { current: hp.max, max: hp.max };
      if (io) io.to(req.session?.campaignId||'main').emit('player:hp-updated', { characterId: char.id, current: hp.max, max: hp.max });
    }
  });

  // ── 2. Spell slots → used=0 ──
  if (!dmState.playerSpellSlots) dmState.playerSpellSlots = {};
  spelers.forEach(char => {
    const slots = dmState.playerSpellSlots[char.id];
    if (!slots) return;
    for (const lvl of Object.keys(slots)) {
      slots[lvl].used = 0;
    }
  });

  // ── 2b. Tempel-zegens vervallen ──
  if (dmState.playerItems) {
    spelers.forEach(char => {
      const items = dmState.playerItems[char.id];
      if (items?.some(i => i.zegen)) {
        dmState.playerItems[char.id] = items.filter(i => !i.zegen);
        if (io) io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId: char.id, items: dmState.playerItems[char.id] });
      }
    });
  }

  // ── 3. Conditions + tempHp wissen in actief gevecht ──
  try {
    const combat = storage.readJSON('combat.json');
    if (combat?.combatants?.length) {
      const playerIds = new Set(spelers.map(s => s.id));
      let changed = false;
      combat.combatants.forEach(c => {
        if (c.type === 'player' && playerIds.has(c.entityId)) {
          if (c.conditions?.length) { c.conditions = []; changed = true; }
          if (c.tempHp)             { c.tempHp = 0;      changed = true; }
          // Sync HP in combat ook naar max
          const hp = dmState.playerHp[c.entityId];
          if (hp?.max !== null && hp?.max !== undefined) {
            c.hp = hp.max; changed = true;
          }
        }
      });
      if (changed) {
        storage.writeJSON('combat.json', combat);
        if (io) io.to(req.session?.campaignId||'main').emit('combat:updated', combat);
      }
    }
  } catch { /* ok als er geen actief gevecht is */ }

  // ── 4. Item charges → max ──
  if (!g.itemCharges) g.itemCharges = {};
  const ownedItemIds = Object.keys(g.itemOwners || {});
  let resetCount = 0;
  const rollLog = []; // { charName, itemName, rolled, newCharges, max }
  spelers.forEach(char => {
    const cid = char.id;
    if (!g.itemCharges[cid]) g.itemCharges[cid] = {};
    ownedItemIds.forEach(itemId => {
      const owners = g.itemOwners[itemId];
      const isOwned = Array.isArray(owners)
        ? owners.some(o => o.characterId === cid)
        : owners?.characterId === cid;
      if (!isOwned) return;
      const item = (entities.voorwerpen || []).find(e => e.id === itemId);
      const baseMax = parseInt(item?.data?.maxCharges);
      const effectiveMax = (g.itemMaxCharges?.[cid]?.[itemId]) ?? baseMax;
      const rechargeOn = item?.data?.rechargeOn || 'longRest';
      if (effectiveMax > 0 && (rechargeOn === 'longRest' || rechargeOn === 'dawn')) {
        g.itemCharges[cid][itemId] = effectiveMax; resetCount++;
      } else if (effectiveMax > 0 && rechargeOn === 'longRestRoll') {
        const rolled = rollDice(item?.data?.rechargeRoll || '1d3');
        const current = g.itemCharges[cid][itemId] ?? effectiveMax;
        const newCharges = Math.min(effectiveMax, current + rolled);
        g.itemCharges[cid][itemId] = newCharges;
        rollLog.push({ charName: char.name, itemName: item.name, rolled, newCharges, max: effectiveMax });
        resetCount++;
      }
    });
  });

  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, spelers: spelers.length, resetCount, rollLog });
});

// ── Speler HP (buiten gevecht) ──

router.get('/player-hp/:characterId', attachRole, (req, res) => {
  const characterId = req.params.characterId;
  if (req.role !== 'dm' && req.session?.characterId !== characterId) {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  const dmState = readDmState();
  const hp = (dmState.playerHp || {})[characterId] || { current: null, max: null };
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
    temp:    req.body.temp    !== undefined ? Math.max(0, parseInt(req.body.temp) || 0) : (existing.temp ?? 0),
  };
  dmState.playerHp[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('player:hp-updated', { characterId, ...updated });
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
    name: name.trim().slice(0, 200),
    note: (note || '').trim().slice(0, 2000),
  };
  dmState.playerItems[characterId].push(item);
  storage.writeJSON('dm-state.json', dmState);
  res.status(201).json(item);
});

router.delete('/player-items/:characterId/:itemId', attachRole, (req, res) => {
  const { characterId, itemId } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });

  // Spelers mogen geen IOU's (schuldbewijs) of boetes zelf verwijderen — alleen de DM
  const isIOU = itemId.startsWith('ts_leen_');
  const isBoete = itemId.startsWith('heeren_boete_');
  if (isIOU && req.role !== 'dm')
    return res.status(403).json({ error: 'Schuldbrieven kunnen alleen door de DM worden verwijderd' });
  if (isBoete && req.role !== 'dm')
    return res.status(403).json({ error: 'Een boete los je af bij de Luimpoort, niet door het kaartje weg te gooien' });

  const dmState = readDmState();

  // Een eed of vloek kun je niet zomaar weggooien — boete doen of via de DM
  const target = (dmState.playerItems?.[characterId] || []).find(i => i.id === itemId);
  if (target?.eed && req.role !== 'dm')
    return res.status(403).json({ error: 'Een eed of vloek leg je niet zomaar af — doe boete in de tempel of vraag de DM.' });

  // Item verwijderen
  if (dmState.playerItems?.[characterId])
    dmState.playerItems[characterId] = dmState.playerItems[characterId].filter(i => i.id !== itemId);

  // Als het een IOU is: ook de openstaande lening wissen
  if (isIOU && dmState.tweespalt?.leningen?.[characterId]) {
    delete dmState.tweespalt.leningen[characterId];
  }

  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: (dmState.playerItems || {})[characterId] || [] });
  if (isIOU) io.to(req.session?.campaignId||'main').emit('tweespalt:updated');  // banner verdwijnt bij speler

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
  if (req.role !== 'dm') return res.status(403).json({ error: 'Forbidden' });
  const { characterId } = req.params;
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('party-currency:updated', { groupId: groupId || dmState.activeGroup, currency: g.sharedPurse, actor });
  res.json(g.sharedPurse);
});

router.put('/party-currency/toggle', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.sharedPurse) g.sharedPurse = { enabled: false, fl: 0, kn: 0, cl: 0 };
  g.sharedPurse.enabled = !g.sharedPurse.enabled;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('party-currency:updated', { groupId: dmState.activeGroup, currency: g.sharedPurse, actor: 'DM' });
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
  // Vervang volledig zodat verwijderde levels ook echt verdwijnen
  const MAX_SLOTS = 4; // sane D&D upper bound per level
  const updated = {};
  for (const [lvl, val] of Object.entries(req.body)) {
    if (typeof val === 'object' && val !== null) {
      updated[lvl] = {
        max:  Math.min(MAX_SLOTS, Math.max(0, parseInt(val.max)  || 0)),
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('companion:link', { npcId, name: entity?.name || '', groupId });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('companion:unlink', { npcId, name: entity?.name || '', groupId });
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
    if (myGroup) {
      // Speler zit in een groep — toon alleen groepsgenoten
      if (e.data?.groep !== myGroup) return false;
    } else {
      // Speler heeft geen groep — toon alleen andere groepsloos spelers
      if (e.data?.groep) return false;
    }
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
    "swimSpeed", "flySpeed", "extraSpeeds", "spellFavorites", "factieTitel", "featFavorites", "featChoices",
  ];
  const updated = { ...existing };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updated[key] = req.body[key];
  }
  dmState.playerProfiles[characterId] = updated;
  storage.writeJSON('dm-state.json', dmState);
  // Laat alle clients weten dat het profiel gewijzigd is (level, klasse, etc.)
  req.app.get('io')?.to(req.session?.campaignId || 'main')
    .emit('player:profile-updated', { characterId, profile: updated });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('player:inspiration', { characterId, inspired: true, name: entity?.name || '' });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('player:inspiration', { characterId, inspired: false, name: entity?.name || '' });
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
    name: String(name).slice(0, 200), max: maxVal, current: 0,
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
  if (req.body.name !== undefined) tracker.name = String(req.body.name || '').slice(0, 200);
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
  const { index, name, level, school, source, desc, damage, concentration, ritual,
          casting_time, range, components, duration } = req.body;
  if (!index || !name) return res.status(400).json({ error: 'index en name vereist' });
  const dmState = readDmState();
  if (!dmState.playerSpells) dmState.playerSpells = {};
  if (!dmState.playerSpells[characterId]) dmState.playerSpells[characterId] = [];
  if (!dmState.playerSpells[characterId].find(s => s.index === index)) {
    const entry = { index, name, level: level || 0, school: school || '' };
    if (source)       entry.source        = source;
    if (desc)         entry.desc          = desc;
    if (damage)       entry.damage        = damage;
    if (concentration !== undefined) entry.concentration = concentration;
    if (ritual !== undefined)        entry.ritual        = ritual;
    if (casting_time) entry.casting_time = casting_time;
    if (range)        entry.range        = range;
    if (components)   entry.components   = components;
    if (duration)     entry.duration     = duration;
    dmState.playerSpells[characterId].push(entry);
  }
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// PATCH /player-spells/:characterId/:spellIndex — werk school/desc/damage bij
router.patch('/player-spells/:characterId/:spellIndex', attachRole, (req, res) => {
  const { characterId, spellIndex } = req.params;
  if (req.role !== 'dm' && req.session.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const spells  = (dmState.playerSpells || {})[characterId] || [];
  const spell   = spells.find(s => s.index === spellIndex);
  if (!spell) return res.status(404).json({ error: 'Spreuk niet gevonden' });
  const { school, desc, damage, casting_time, range, components, duration, incantation, concentrationActive } = req.body;
  if (school       !== undefined) spell.school       = school;
  if (desc         !== undefined) spell.desc         = desc;
  if (damage       !== undefined) spell.damage       = damage;
  if (casting_time !== undefined) spell.casting_time = casting_time;
  if (range        !== undefined) spell.range        = range;
  if (components   !== undefined) spell.components   = components;
  if (duration     !== undefined) spell.duration     = duration;
  if (incantation  !== undefined) spell.incantation  = incantation;
  // #1: concentratie-vlag (gebruikt door de Concentration-save-waarschuwing in combat).
  // Exclusief: maar één spreuk tegelijk actief.
  if (concentrationActive !== undefined) {
    spell.concentrationActive = !!concentrationActive;
    if (spell.concentrationActive) for (const s of spells) if (s !== spell) s.concentrationActive = false;
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
    id,
    index:  index  || null,
    name:   String(name   || '').slice(0, 200),
    source: String(source || 'custom').slice(0, 100),
    meta:   String(meta   || '').slice(0, 200),
    desc:   String(desc   || '').slice(0, 5000),
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

router.post('/import/obsidian', requireDM, uploadText.array('files', 50), (req, res) => {
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.status(201).json({ id, name: dmState.groups[id].name });
});

router.put('/groups/active', requireDM, (req, res) => {
  const { groupId } = req.body;
  const dmState = readDmState();
  if (!dmState.groups[groupId]) return res.status(404).json({ error: 'Groep niet gevonden' });
  dmState.activeGroup = groupId;
  storage.writeJSON('dm-state.json', dmState);

  // groups:updated triggert client-side herlaad van de sectie (zonder toast-spam)
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: groupId });
  res.json({ activeGroup: groupId });
});

router.put('/groups/:id', requireDM, (req, res) => {
  const { id }  = req.params;
  const dmState = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (req.body.name) dmState.groups[id].name = req.body.name;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ id, name: dmState.groups[id].name });
});

router.put('/groups/:id/password', requireDM, (req, res) => {
  const { id }      = req.params;
  const { password } = req.body;
  const dmState     = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  dmState.groups[id].password = password?.trim() || null;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ ok: true });
});

router.delete('/groups/:id', requireDM, (req, res) => {
  const { id }  = req.params;
  const dmState = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (Object.keys(dmState.groups).length <= 1) return res.status(400).json({ error: 'Minimaal één groep vereist' });
  if (dmState.activeGroup === id) return res.status(400).json({ error: 'Wissel eerst van groep voor je deze verwijdert' });
  delete dmState.groups[id];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ ok: true });
});

// ── Archief ──

router.get('/archief', attachRole, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = readDmState();
  // Bepaal groepsId van de ingelogde speler vroeg, zodat het beschikbaar is voor alle filters
  const playerGroepId = req.role !== 'dm'
    ? _playerGroupId(dmState, req.session?.characterId)
    : null;
  let docs = archief.documents || [];
  if (req.role !== 'dm') {
    docs = docs.map(d => filterDocForPlayer(d, dmState, playerGroepId)).filter(Boolean);
  } else {
    const activeGid    = dmState.activeGroup;
    const activeGDocVis = dmState.groups?.[activeGid]?.docVisibility || {};
    docs = docs.map(d => ({
      ...d,
      state:        dmState.docStates[d.id] || 'hidden',
      _activeState: activeGDocVis[d.id] ?? (dmState.docStates[d.id] || 'hidden'),
      _dmNote:      dmState.dmNotes[d.id]   || '',
    }));
  }
  // Chapter-visibility: DM ziet alles; spelers alleen zichtbare aktes voor hun groep
  const cv = _readChapterVisibility();

  res.json({
    documents: docs,
    logEntries: archief.logEntries,
    sessieLog: req.role === 'dm'
      ? (archief.sessieLog || []).map(e => ({
          ...e,
          // Stuur per sessie mee of de akte verborgen is voor de activeGroup (voor DM-toggle)
          _chapterHidden: !_chapterVisible(cv, dmState.activeGroup, e.hoofdstuk || '_'),
        }))
      : !playerGroepId
        ? []  // niet ingelogd als speler → geen verslagen
        : (archief.sessieLog || []).filter(e =>
            e.visible &&
            _chapterVisible(cv, playerGroepId, e.hoofdstuk || '_')
          ).map(e => ({
            ...e,
            images: (e.images || []).filter(img => typeof img === 'string' || img.visible !== false),
          })),
    chapterVisibility: req.role === 'dm' ? cv : undefined,
    hiddenLinks:  req.role === 'dm' ? archief.hiddenLinks : {},
    tekstContent: req.role === 'dm'
      ? archief.tekstContent
      : Object.fromEntries(
          Object.entries(archief.tekstContent || {}).filter(([id]) => {
            const groupDocVis = playerGroepId ? dmState.groups?.[playerGroepId]?.docVisibility : null;
            const state = (groupDocVis != null && id in groupDocVis)
              ? groupDocVis[id]
              : (dmState.docStates[id] || 'hidden');
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('archief:updated', { id: doc.id });
  res.status(201).json(doc);
});

router.get('/archief/:id', attachRole, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const dmState = readDmState();
  const doc = (archief.documents || []).find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.role !== 'dm') {
    const playerGroupId = _playerGroupId(dmState, req.session?.characterId);
    const filtered = filterDocForPlayer(doc, dmState, playerGroupId);
    if (!filtered) return res.status(404).json({ error: 'Niet gevonden' });
    return res.json(filtered);
  }
  const activeGid    = dmState.activeGroup;
  const activeG      = dmState.groups?.[activeGid];
  const _activeState = (activeG?.docVisibility && doc.id in activeG.docVisibility)
    ? activeG.docVisibility[doc.id]
    : (dmState.docStates[doc.id] || 'hidden');
  res.json({ ...doc, state: dmState.docStates[doc.id] || 'hidden', _activeState, _dmNote: dmState.dmNotes[doc.id] || '' });
});

router.put('/archief/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.documents || []).findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  archief.documents[idx] = { ...archief.documents[idx], ...req.body, id: req.params.id };
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId||'main').emit('archief:updated', { id: req.params.id });
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
  for (const g of Object.values(dmState.groups)) {
    if (g.docVisibility) delete g.docVisibility[req.params.id];
  }
  storage.writeJSON('archief.json', archief);
  storage.writeJSON('dm-state.json', dmState);
  storage.deleteFile(req.params.id);
  req.app.get('io').to(req.session?.campaignId||'main').emit('archief:updated', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

// PUT /api/archief/:id/group-visibility — stel zichtbaarheid in per actieve groep
router.put('/archief/:id/group-visibility', requireDM, (req, res) => {
  const { state } = req.body;
  if (!['hidden', 'blurred', 'revealed'].includes(state)) {
    return res.status(400).json({ error: 'Ongeldige state' });
  }
  const docId   = req.params.id;
  const archief = storage.readJSON('archief.json');
  const dmState = readDmState();
  const doc     = (archief.documents || []).find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: 'Niet gevonden' });

  const gid = dmState.activeGroup;
  const g   = getGroup(dmState);
  if (!g) return res.status(400).json({ error: 'Geen actieve groep' });
  if (!g.docVisibility) g.docVisibility = {};

  // Was dit document al eerder onthuld voor enige groep (of globaal)?
  const wasRevealedAnywhere = dmState.docStates[docId] === 'revealed' ||
    Object.values(dmState.groups).some(grp => grp.docVisibility?.[docId] === 'revealed');

  g.docVisibility[docId] = state;
  storage.writeJSON('dm-state.json', dmState);

  // Log een reveal-entry de eerste keer dat het document wordt onthuld
  if (state === 'revealed' && !wasRevealedAnywhere) {
    if (!archief.logEntries) archief.logEntries = [];
    archief.logEntries.push({
      hoofdstuk: doc.hoofdstuk,
      event:     doc.name,
      icon:      doc.icon,
      docId:     doc.id,
      timestamp: Date.now(),
    });
    storage.writeJSON('archief.json', archief);
  }

  req.app.get('io').to(req.session?.campaignId||'main').emit('archief:stateChanged', { id: docId, name: doc.name, state, groupId: gid });

  // Dramatische onthulling (alleen voor spelers van de actieve groep)
  if (state === 'revealed') {
    req.app.get('io').to(req.session?.campaignId||'main').emit('archief:dramaticReveal', {
      id:      doc.id,
      name:    doc.name,
      imageId: doc.imageId || null,
      type:    doc.type    || '',
      flavour: doc.flavour || '',
      groupId: gid,
    });
  }
  res.json({ state, groupId: gid });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('archief:stateChanged', { id: doc.id, name: doc.name, state });
  // Dramatic reveal for players
  if (state === 'revealed') {
    const freshArchief = storage.readJSON('archief.json');
    const revealDoc = (freshArchief.documents || []).find(d => d.id === req.params.id);
    if (revealDoc) {
      req.app.get('io').to(req.session?.campaignId||'main').emit('archief:dramaticReveal', {
        id:      revealDoc.id,
        name:    revealDoc.name,
        imageId: revealDoc.imageId || null,
        type:    revealDoc.type || '',
        flavour: revealDoc.flavour || '',
      });
    }
  }
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

// ── Relatiemap ──

router.get('/relations', attachRole, (req, res) => {
  const data = storage.readJSON('relations.json');
  if (!data.edges) data.edges = [];
  if (!data.positions) data.positions = {};

  // Non-DM: filter edges where either endpoint is hidden
  if (req.role !== 'dm') {
    const dmState = readDmState();
    const activeGroup = dmState.groups?.[dmState.activeGroup] || {};
    const vis = activeGroup.visibility || {};
    data.edges = data.edges.filter(ed => {
      const vA = vis[ed.from];
      const vB = vis[ed.to];
      return vA !== 'hidden' && vB !== 'hidden';
    });
  }
  res.json(data);
});

router.post('/relations/edges', requireDM, (req, res) => {
  const data = storage.readJSON('relations.json');
  if (!data.edges) data.edges = [];
  const edge = {
    id:            `rel_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    from:          req.body.from,
    fromType:      req.body.fromType,
    to:            req.body.to,
    toType:        req.body.toType,
    label:         req.body.label         || '',
    hiddenLabel:   req.body.hiddenLabel   || '',
    labelRevealed: req.body.labelRevealed || false,
  };
  data.edges.push(edge);
  storage.writeJSON('relations.json', data);
  req.app.get('io').to(req.session?.campaignId||'main').emit('relations:updated');
  res.json(edge);
});

router.put('/relations/edges', requireDM, (req, res) => {
  const data = storage.readJSON('relations.json');
  data.edges = req.body.edges || [];
  storage.writeJSON('relations.json', data);
  req.app.get('io').to(req.session?.campaignId||'main').emit('relations:updated');
  res.json({ ok: true });
});

router.put('/relations/edges/:id', requireDM, (req, res) => {
  const data = storage.readJSON('relations.json');
  if (!data.edges) data.edges = [];
  const idx = data.edges.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  const wasRevealed = data.edges[idx].labelRevealed;
  data.edges[idx] = { ...data.edges[idx], ...req.body, id: req.params.id };
  storage.writeJSON('relations.json', data);
  const ev = (!wasRevealed && data.edges[idx].labelRevealed) ? 'relations:revealed' : 'relations:updated';
  req.app.get('io').to(req.session?.campaignId||'main').emit(ev, { id: req.params.id });
  res.json(data.edges[idx]);
});

router.delete('/relations/edges/:id', requireDM, (req, res) => {
  const data = storage.readJSON('relations.json');
  if (!data.edges) return res.json({});
  data.edges = data.edges.filter(e => e.id !== req.params.id);
  storage.writeJSON('relations.json', data);
  req.app.get('io').to(req.session?.campaignId||'main').emit('relations:updated');
  res.json({});
});

router.put('/relations/positions', requireDM, (req, res) => {
  const data = storage.readJSON('relations.json');
  data.positions = { ...(data.positions || {}), ...(req.body.positions || {}) };
  storage.writeJSON('relations.json', data);
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('logboek:updated', { id: entry.id });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('logboek:updated', { id: req.params.id });

  if (Array.isArray(req.body.images)) {
    const oldImages = oldEntry.images || [];
    for (const img of req.body.images) {
      if (!img.id || img.visible === false) continue;
      const prev      = oldImages.find(o => (typeof o === 'string' ? o : o.id) === img.id);
      const wasHidden = prev && typeof prev !== 'string' && prev.visible === false;
      if (wasHidden) {
        req.app.get('io').to(req.session?.campaignId||'main').emit('logboek:imageRevealed', {
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

// Zet alle afbeeldingen in een akte terug op verborgen (visible: false)
// zodat de DM ze tijdens spel één voor één kan onthullen via de reveal-strip.
router.put('/sessieLog/chapter/:key/reset-images', requireDM, (req, res) => {
  const { key } = req.params;
  const archief = storage.readJSON('archief.json');
  let count = 0;
  for (const entry of (archief.sessieLog || [])) {
    if (entry.hoofdstuk !== key) continue;
    if (!entry.images?.length) continue;
    entry.images = entry.images.map(img => {
      const obj = typeof img === 'string' ? { id: img } : { ...img };
      if (obj.visible !== false) count++;
      return { ...obj, visible: false };
    });
  }
  if (count > 0) storage.writeJSON('archief.json', archief);
  res.json({ ok: true, reset: count });
});

router.delete('/sessieLog/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  if (!archief.sessieLog) archief.sessieLog = [];
  archief.sessieLog = archief.sessieLog.filter(e => e.id !== req.params.id);
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId||'main').emit('logboek:updated', { id: req.params.id, deleted: true });
  res.json({ ok: true });
});

// ── Quests ──
// Status is per-party (quest-states/{groepId}.json); global quest only stores
// title/description/chapter. Default status for any quest in any party = 'verborgen'.

router.get('/quests', attachRole, (req, res) => {
  const data    = storage.readJSON('quests.json');
  const quests  = data.quests || [];
  // DM kan een specifieke groep opvragen via ?groepId=xxx
  let groepId = _getQuestGroepId(req);
  if (req.role === 'dm' && req.query.groepId) {
    const dmState = readDmState();
    if (dmState.groups[req.query.groepId]) groepId = req.query.groepId;
  }
  const states  = groepId ? _readQuestStates(groepId) : {};
  const result  = quests.map(q => ({
    ...q,
    status: states[q.id] ?? 'verborgen',
  }));
  res.json(result);
});

router.post('/quests', requireDM, (req, res) => {
  const data = storage.readJSON('quests.json');
  if (!data.quests) data.quests = [];
  const quest = {
    id:          `q_${Date.now()}`,
    title:       req.body.title || 'Naamloze missie',
    description: req.body.description || '',
    chapter:     req.body.chapter || '',
    notes:       req.body.notes || '',
    createdAt:   new Date().toISOString(),
  };
  data.quests.push(quest);
  storage.writeJSON('quests.json', data);

  // Sla de gekozen beginstatus op voor de opgegeven of actieve party
  let groepId = _getQuestGroepId(req);
  if (req.body.groepId) {
    const dmState = readDmState();
    if (dmState.groups[req.body.groepId]) groepId = req.body.groepId;
  }
  if (groepId) {
    const states   = _readQuestStates(groepId);
    states[quest.id] = req.body.status || 'verborgen';
    _writeQuestStates(groepId, states);
  }

  req.app.get('io').to(req.session?.campaignId||'main').emit('quests:updated');
  res.json(quest);
});

router.put('/quests/:id', requireDM, (req, res) => {
  const data = storage.readJSON('quests.json');
  if (!data.quests) data.quests = [];
  const idx = data.quests.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });

  // Globale velden bijwerken (nooit 'status' of 'groepId' — die zijn per party)
  const { status, groepId: bodyGroepId, ...globalFields } = req.body;
  data.quests[idx] = { ...data.quests[idx], ...globalFields, id: req.params.id };
  storage.writeJSON('quests.json', data);

  // Per-party status bijwerken
  if (status !== undefined) {
    let groepId = _getQuestGroepId(req);
    if (bodyGroepId) {
      const dmState = readDmState();
      if (dmState.groups[bodyGroepId]) groepId = bodyGroepId;
    }
    if (groepId) {
      const states   = _readQuestStates(groepId);
      states[req.params.id] = status;
      _writeQuestStates(groepId, states);
    }
  }

  req.app.get('io').to(req.session?.campaignId||'main').emit('quests:updated');
  res.json({ ...data.quests[idx], status: status ?? undefined });
});

router.delete('/quests/:id', requireDM, (req, res) => {
  const data = storage.readJSON('quests.json');
  if (!data.quests) return res.json({});
  data.quests = data.quests.filter(q => q.id !== req.params.id);
  storage.writeJSON('quests.json', data);
  req.app.get('io').to(req.session?.campaignId||'main').emit('quests:updated');
  res.json({});
});

// ── Files ──

router.post('/files/:id', requireDM, uploadMedia.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand of niet-toegestaan type' });
  if (!_sniffMedia(req.file.buffer))
    return res.status(415).json({ error: 'Bestandsinhoud komt niet overeen met een toegestaan mediatype' });
  const filename = storage.saveFile(req.params.id, req.file.buffer, req.file.mimetype);
  res.json({ filename });
});

router.get('/files/:id', attachRole, (req, res) => {
  if (!req.role) return res.status(401).json({ error: 'Niet ingelogd' });
  const file = storage.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'Niet gevonden' });
  res.type(file.mimetype).sendFile(file.path);
});

router.delete('/files/:id', requireDM, (req, res) => {
  storage.deleteFile(req.params.id);
  res.json({ ok: true });
});

// ── Sounds ──

// Zorg dat het ambiance-blok (feature #2) altijd bestaat met sane defaults.
function _ensureAmbiance(data) {
  if (!data.ambiance) data.ambiance = { scenes: [], actief: null, volume: 0.5 };
  if (!Array.isArray(data.ambiance.scenes)) data.ambiance.scenes = [];
  if (typeof data.ambiance.volume !== 'number') data.ambiance.volume = 0.5;
  if (!('actief' in data.ambiance)) data.ambiance.actief = null;
  // Per-dienst sfeerloop (speelt lokaal bij het openen van een dienst).
  if (!data.serviceAmbiance || typeof data.serviceAmbiance !== 'object') data.serviceAmbiance = {};
  return data;
}
const _DIENST_KEYS = ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'heeren'];

router.get('/sounds', (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  if (!data.playerTurn) data.playerTurn = {};
  _ensureAmbiance(data);
  res.json(data);
});

router.put('/sounds', requireDM, (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  if (!data.playerTurn) data.playerTurn = {};
  _ensureAmbiance(data);
  if (req.body.standard)    Object.assign(data.standard,    req.body.standard);
  if (req.body.emotes)      Object.assign(data.emotes,      req.body.emotes);
  if (req.body.playerTurn)  Object.assign(data.playerTurn,  req.body.playerTurn);
  if (req.body.ambiance) {
    // Scènebeheer + mastervolume; 'actief' blijft via POST /sounds/ambiance gaan.
    if (Array.isArray(req.body.ambiance.scenes)) data.ambiance.scenes = req.body.ambiance.scenes.slice(0, 60);
    if (typeof req.body.ambiance.volume === 'number')
      data.ambiance.volume = Math.min(1, Math.max(0, req.body.ambiance.volume));
  }
  if (req.body.serviceAmbiance && typeof req.body.serviceAmbiance === 'object') {
    for (const [k, v] of Object.entries(req.body.serviceAmbiance)) {
      if (!_DIENST_KEYS.includes(k)) continue;          // alleen bekende diensten
      if (v === null) delete data.serviceAmbiance[k];
      else data.serviceAmbiance[k] = String(v).slice(0, 100);
    }
  }
  storage.writeJSON('sounds.json', data);
  res.json(data);
});

// Speel een ambiance-scène af bij iedereen (of stop met actief:null).
router.post('/sounds/ambiance', requireDM, (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  _ensureAmbiance(data);
  const actief = req.body.actief || null;
  const scene  = actief ? data.ambiance.scenes.find(s => s.id === actief) : null;
  if (actief && !scene) return res.status(404).json({ error: 'Scène niet gevonden' });
  data.ambiance.actief = scene ? scene.id : null;
  storage.writeJSON('sounds.json', data);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('sound:ambiance', {
    actief: data.ambiance.actief,
    fileId: scene?.fileId || null,
    label:  scene?.label  || null,
    volume: data.ambiance.volume,
  });
  res.json({ ok: true, actief: data.ambiance.actief });
});

// ── Klasse-progressie (skill trees) ──────────────────────────────
// GET geeft de campagne-eigen progressie terug, of anders de meegeleverde
// 2024-seed (public/data/class-progression.json). De DM kan een eigen versie
// opslaan; resetten verwijdert de override.

const _PROGRESSION_SEED = path.join(__dirname, '..', 'public', 'data', 'class-progression.json');

function _readProgressionSeed() {
  try { return JSON.parse(fs.readFileSync(_PROGRESSION_SEED, 'utf8')); }
  catch { return { classes: {}, species: {} }; }
}

router.get('/progression', attachRole, (req, res) => {
  const saved = storage.readJSON('progression.json');
  if (saved && saved.classes && Object.keys(saved.classes).length) {
    return res.json({ ...saved, _custom: true });
  }
  res.json({ ..._readProgressionSeed(), _custom: false });
});

router.put('/progression', requireDM, (req, res) => {
  const body = req.body || {};
  if (!body.classes || typeof body.classes !== 'object') {
    return res.status(400).json({ error: 'Ongeldige progressie-data' });
  }
  const clean = {
    bron:    String(body.bron || 'Aangepast door de DM'),
    classes: body.classes,
    species: body.species && typeof body.species === 'object' ? body.species : {},
    gedeeld: body.gedeeld || undefined,
  };
  storage.writeJSON('progression.json', clean);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('progression:updated', {});
  res.json({ ok: true });
});

// Reset naar de meegeleverde seed (verwijder de campagne-override).
router.delete('/progression', requireDM, (req, res) => {
  storage.writeJSON('progression.json', {});
  req.app.get('io').to(req.session?.campaignId || 'main').emit('progression:updated', {});
  res.json({ ok: true });
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json({ appTitle: meta.appTitle, appSubtitle: meta.appSubtitle });
});

router.put('/meta/hoofdstuk/:key', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken) meta.hoofdstukken = {};
  const existing = meta.hoofdstukken[req.params.key] || {};
  meta.hoofdstukken[req.params.key] = {
    ...existing,
    num:                 req.body.num   ?? 99,
    title:               req.body.title || '',
    dag:                 req.body.dag   || '',
    short:               req.body.short || req.body.title || req.params.key,
    bannerFocus:         req.body.bannerFocus         || '',
    bannerImg:           req.body.bannerImg           || '',
    spelersSamenvatting: req.body.spelersSamenvatting || '',
  };
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.hoofdstukken[req.params.key]);
});

// ── Akte script (regie-balk voorbereiding) ──
router.put('/meta/akte/:key/script', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken) meta.hoofdstukken = {};
  if (!meta.hoofdstukken[req.params.key]) meta.hoofdstukken[req.params.key] = {};
  meta.hoofdstukken[req.params.key].script = Array.isArray(req.body.script) ? req.body.script : [];
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json({ script: meta.hoofdstukken[req.params.key].script });
});

// Actieve akte onthouden (gezet wanneer de DM een akte 'speelt'). Bepaalt o.a. Ursula's doel-akte.
router.post('/akte/actief', requireDM, (req, res) => {
  const { key, num, title } = req.body || {};
  const dmState = readDmState();
  dmState.activeAkte = { key: key || null, num: num ?? null, title: title || '' };
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('ursula:updated');
  res.json(dmState.activeAkte);
});

router.put('/meta/herberg', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.herberg) meta.herberg = {};
  const allowed = ['naam','waard','imageId','backdropId','maxVragen','cooldownMinutenMin','cooldownMinutenMax','groet'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) meta.herberg[f] = req.body[f];
  }
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('map:updated');
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('map:updated');
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('map:updated');
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
    req.app.get('io').to(req.session?.campaignId||'main').emit('map:updated');
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
  io.to(req.session?.campaignId||'main').emit('pin:pending', { id: pin.id, locName: loc.name, placedByName: pin.placedByName });

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
  io.to(req.session?.campaignId||'main').emit('map:updated');
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
  io.to(req.session?.campaignId||'main').emit('map:updated');
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
let _tunnelRoom = 'main';
let _tunnelProcess = null;
let _tunnelUrl = null;

router.post('/tunnel/start', requireDM, (req, res) => {
  _io = req.app.get('io');
  _tunnelRoom = req.session?.campaignId || 'main';
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
      if (_io) _io.to(_tunnelRoom).emit('tunnel:url', { url: _tunnelUrl });
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
      if (_io) _io.to(_tunnelRoom).emit('tunnel:stopped', {});
    }
  });
  _tunnelProcess.on('close', (code) => {
    console.log('[cloudflared] process closed, code:', code);
    _tunnelProcess = null;
    _tunnelUrl = null;
    if (_io) _io.to(_tunnelRoom).emit('tunnel:stopped', {});
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
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('bestiarium:updated');
  res.status(201).json(monster);
});

router.put('/monsters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('monsters.json');
  const idx = (data.monsters || []).findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.monsters[idx] = { ...data.monsters[idx], ...req.body, id: req.params.id };
  storage.writeJSON('monsters.json', data);
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('bestiarium:updated');
  res.json(data.monsters[idx]);
});

router.delete('/monsters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('monsters.json');
  data.monsters = (data.monsters || []).filter(m => m.id !== req.params.id);
  storage.writeJSON('monsters.json', data);
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('bestiarium:updated');
  res.json({ ok: true });
});

// ── Bestiarium (feature #3) ──
// Spelers ontgrendelen geleidelijk monster-statblocks. Kennis per groep:
// dmState.groups[gid].bestiarium = { <monsterId>: 'naam' | 'deels' | 'volledig' }.
// Velden BOVEN het kennisniveau worden server-side weggefilterd (anti-cheat);
// chapter/initiative gaan nooit naar spelers.
const _BEST_NIVEAUS = ['naam', 'deels', 'volledig'];
function _bestiariumForTier(m, niveau) {
  const sb = m.statblock || {};
  const out = {
    id: m.id, name: m.name, imageId: m.imageId || null, _niveau: niveau,
    statblock: { size: sb.size, type: sb.type, alignment: sb.alignment },
  };
  if (niveau === 'naam') return out;
  out.maxHp = m.maxHp;
  Object.assign(out.statblock, {
    ac: sb.ac, hp: sb.hp, speed: sb.speed,
    str: sb.str, dex: sb.dex, con: sb.con, int: sb.int, wis: sb.wis, cha: sb.cha,
    savingThrows: sb.savingThrows, skills: sb.skills,
    damageVulnerabilities: sb.damageVulnerabilities, damageResistances: sb.damageResistances,
    damageImmunities: sb.damageImmunities, conditionImmunities: sb.conditionImmunities,
    senses: sb.senses, languages: sb.languages,
  });
  if (niveau === 'deels') return out;
  out.backdropId = m.backdropId || null;
  Object.assign(out.statblock, {
    traits: sb.traits, actions: sb.actions, reactions: sb.reactions,
    legendaryActions: sb.legendaryActions, cr: sb.cr, xp: sb.xp,
  });
  return out;
}

router.get('/bestiarium', attachRole, (req, res) => {
  const dmState  = readDmState();
  // Alleen monsters die in het bestiarium thuishoren (inBestiarium !== false).
  // Zo blijven handmatig toegevoegde personages (bv. Barthen) uit het bestiarium.
  const monsters = (storage.readJSON('monsters.json').monsters || [])
    .filter(m => m.inBestiarium !== false);
  if (req.role === 'dm') {
    const kennis = getGroup(dmState)?.bestiarium || {};
    // DM ziet alles volledig + het kennisniveau van de actieve groep.
    return res.json({ role: 'dm', monsters: monsters.map(m => ({ ...m, _niveau: kennis[m.id] || null })) });
  }
  if (!req.session.characterId) return res.json({ role: 'player', monsters: [] });
  const kennis = getGroup(dmState, _playerGroupId(dmState, req.session.characterId))?.bestiarium || {};
  const out = monsters.filter(m => kennis[m.id]).map(m => _bestiariumForTier(m, kennis[m.id]));
  res.json({ role: 'player', monsters: out });
});

router.put('/bestiarium/:monsterId', requireDM, (req, res) => {
  const { monsterId } = req.params;
  const niveau  = req.body.niveau || null;
  const dmState = readDmState();
  const g = getGroup(dmState, req.body.groep || dmState.activeGroup);
  if (!g.bestiarium) g.bestiarium = {};
  if (!niveau || niveau === 'onbekend') delete g.bestiarium[monsterId];
  else if (_BEST_NIVEAUS.includes(niveau)) g.bestiarium[monsterId] = niveau;
  else return res.status(400).json({ error: 'Ongeldig niveau' });
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('bestiarium:updated');
  res.json({ ok: true });
});

// ── SRD Monster Import (proxy naar dnd5eapi) ──
router.get('/srd/monsters', attachRole, requireDM, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const url = `https://www.dnd5eapi.co/api/monsters?name=${encodeURIComponent(q)}`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).json({ error: 'SRD niet bereikbaar' });
    const data = await resp.json();
    const results = (data.results || []).slice(0, 20).map(m => ({
      index: m.index,
      name:  m.name,
      url:   m.url,
    }));
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/srd/monsters/:index', attachRole, requireDM, async (req, res) => {
  try {
    const url = `https://www.dnd5eapi.co/api/monsters/${encodeURIComponent(req.params.index)}`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(404).json({ error: 'Niet gevonden' });
    const m = await resp.json();
    const mod = score => Math.floor(((score || 10) - 10) / 2);
    const mapCond = (arr) => (arr || []).map(x => x.name || x.index || x).join(', ');
    const sbStr = arr => (arr || []).map(x => {
      const bonus = x.value != null ? ` +${x.value}` : '';
      return `${x.name || x.ability_score?.name || ''}${bonus}`;
    }).join(', ');

    const avgHp = m.hit_points || 10;

    const sb = {
      size:                  m.size || '',
      type:                  m.type || '',
      alignment:             m.alignment || '',
      ac:                    (m.armor_class || []).map(a => `${a.value}${a.type ? ' ('+a.type+')' : ''}`).join(', '),
      hp:                    m.hit_points_roll || '',
      speed:                 Object.entries(m.speed || {}).map(([k,v]) => `${k} ${v}`).join(', '),
      str:                   m.strength || 10,
      dex:                   m.dexterity || 10,
      con:                   m.constitution || 10,
      int:                   m.intelligence || 10,
      wis:                   m.wisdom || 10,
      cha:                   m.charisma || 10,
      savingThrows:          sbStr(m.proficiencies?.filter(p => p.proficiency?.name?.startsWith('Saving'))),
      skills:                sbStr(m.proficiencies?.filter(p => p.proficiency?.name?.startsWith('Skill'))),
      damageVulnerabilities: mapCond(m.damage_vulnerabilities),
      damageResistances:     mapCond(m.damage_resistances),
      damageImmunities:      mapCond(m.damage_immunities),
      conditionImmunities:   mapCond(m.condition_immunities),
      senses:                Object.entries(m.senses || {}).map(([k,v]) => `${k.replace(/_/g,' ')} ${v}`).join(', '),
      languages:             m.languages || '',
      cr:                    String(m.challenge_rating || ''),
      xp:                    m.xp || 0,
      traits:                (m.special_abilities || []).map(a => `***${a.name}.*** ${a.desc}`).join('\n\n'),
      actions:               (m.actions || []).map(a => `***${a.name}.*** ${a.desc}`).join('\n\n'),
      reactions:             (m.reactions || []).map(a => `***${a.name}.*** ${a.desc}`).join('\n\n'),
      legendaryActions:      (m.legendary_actions || []).map(a => `***${a.name}.*** ${a.desc}`).join('\n\n'),
    };
    res.json({ name: m.name, maxHp: avgHp, initiative: 10 + mod(m.dexterity), statblock: sb });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Gevecht (Combat) ──

function _emitCombat(req) {
  const combat = storage.readJSON('combat.json');
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  return combat;
}

router.get('/combat', attachRole, (req, res) => {
  if (!req.role) return res.status(401).json({ error: 'Niet ingelogd' });
  res.json(storage.readJSON('combat.json'));
});

function _combatLog(combat, text) {
  if (!Array.isArray(combat.log)) combat.log = [];
  combat.log.push({ round: combat.round || 1, text });
  if (combat.log.length > 100) combat.log = combat.log.slice(-100);
}

// #1: zet een Concentration-save-prompt als een geconcentreerde combatant schade krijgt.
// Bron: voor spelers hun spreukenboek (concentrationActive), voor monsters de DM-vlag
// combatant.concentratie. Geen automatische save — de speler rolt zelf, DM/speler beslist.
function _maybeConcentrationPrompt(combat, combatant, damage, dmState) {
  if (!combatant || !(damage > 0)) return;
  let spreuk = null;
  if (combatant.entityId && dmState) {
    const conc = ((dmState.playerSpells || {})[combatant.entityId] || []).find(s => s.concentrationActive);
    if (conc) spreuk = conc.name || conc.index || 'een spreuk';
  }
  if (!spreuk && combatant.concentratie?.actief) spreuk = combatant.concentratie.spreuk || 'een spreuk';
  if (!spreuk) return;
  const dc = Math.max(10, Math.floor(damage / 2));
  combat.concentratiePrompt = { combatantId: combatant.id, dc, ts: Date.now(), spreuk, naam: combatant.name };
  _combatLog(combat, `Concentration Saving Throw — DC ${dc} (${combatant.name}: ${spreuk})`);
}

// Synchroniseer HP van speler-combatanten terug naar dm-state.playerHp
function _flushPlayerHpToDmState(combat, io, room) {
  const players = (combat.combatants || []).filter(c => c.entityId);
  if (players.length === 0) return;
  const dmState = readDmState();
  if (!dmState.playerHp) dmState.playerHp = {};
  for (const c of players) {
    dmState.playerHp[c.entityId] = {
      current: c.hp  ?? dmState.playerHp[c.entityId]?.current ?? null,
      max:     c.maxHp ?? dmState.playerHp[c.entityId]?.max ?? null,
    };
    if (io) io.to(room || 'main').emit('player:hp-updated', { characterId: c.entityId, ...dmState.playerHp[c.entityId] });
  }
  storage.writeJSON('dm-state.json', dmState);
}

router.post('/combat/start', requireDM, (req, res) => {
  const existing = storage.readJSON('combat.json');
  const combatants = [...(existing.combatants || [])].sort((a, b) => b.initiative - a.initiative);
  const combat = { active: true, round: 1, currentTurn: 0, combatants, backdropId: existing.backdropId || null, canvasPreset: existing.canvasPreset || null, canvasColors: existing.canvasColors || null, log: [] };
  _combatLog(combat, '⚔️ Gevecht begonnen');
  if (combatants[0]) _combatLog(combat, `▶ Beurt van ${combatants[0].name}`);
  storage.writeJSON('combat.json', combat);

  // #3: Bestiarium-auto-onthulling op 'naam' voor de groepen van de speler-
  // combatants. Alleen bibliotheek-monsters (presetId); antagonisten (entityId
  // zonder presetId) en allies blijven buiten het Bestiarium. Alleen ophogen
  // vanuit onbekend, nooit een hoger niveau verlagen.
  const dmState = readDmState();
  const groepen = new Set();
  for (const c of combatants) {
    if (c.type !== 'player' || !c.entityId) continue;
    const gid = _playerGroupId(dmState, c.entityId);
    if (gid) groepen.add(gid);
  }
  const presets = [...new Set(combatants.filter(c => c.presetId).map(c => c.presetId))];
  if (groepen.size && presets.length) {
    let changed = false;
    for (const gid of groepen) {
      const g = dmState.groups[gid];
      if (!g) continue;
      if (!g.bestiarium) g.bestiarium = {};
      for (const mid of presets) if (!g.bestiarium[mid]) { g.bestiarium[mid] = 'naam'; changed = true; }
    }
    if (changed) {
      storage.writeJSON('dm-state.json', dmState);
      req.app.get('io').to(req.session?.campaignId||'main').emit('bestiarium:updated');
    }
  }

  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  res.json(combat);
});

router.delete('/combat', requireDM, (req, res) => {
  // Persisteer speler-HP naar dm-state vóór het wissen van het gevecht
  const prevCombat = storage.readJSON('combat.json');
  _flushPlayerHpToDmState(prevCombat, req.app.get('io'), req.session?.campaignId||'main');
  const combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', updated);
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
    ac:         req.body.ac         || '',
    conditions: req.body.conditions || [],
  };
  combat.combatants.push(c);
  // Sorteer op initiative (hoog → laag)
  combat.combatants.sort((a, b) => b.initiative - a.initiative);
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
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
    if (diff < 0) _maybeConcentrationPrompt(combat, combat.combatants[idx], -diff, readDmState()); // #1
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
    _flushPlayerHpToDmState(combat, req.app.get('io'), req.session?.campaignId||'main');
  }
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
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
  const dmState = readDmState();
  if (hpDiff < 0) _maybeConcentrationPrompt(combat, combat.combatants[idx], -hpDiff, dmState); // #1
  storage.writeJSON('combat.json', combat);
  // Persisteer ook in playerHp
  if (!dmState.playerHp) dmState.playerHp = {};
  dmState.playerHp[c.entityId || c.name] = { current: newHp, max: c.maxHp || newHp };
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  res.json({ hp: newHp });
});

router.put('/combat/winner', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  combat.winner = req.body.winner || null;
  storage.writeJSON('combat.json', combat);
  // Gevecht eindigt: persisteer finale HP naar dm-state
  _flushPlayerHpToDmState(combat, req.app.get('io'), req.session?.campaignId||'main');
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  res.json({ ok: true });
});

router.delete('/combat/combatant/:id', requireDM, (req, res) => {
  const combat = storage.readJSON('combat.json');
  combat.combatants = combat.combatants.filter(c => c.id !== req.params.id);
  if (combat.currentTurn >= combat.combatants.length && combat.combatants.length > 0) {
    combat.currentTurn = 0;
  }
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('campaign:switched', { id, meta });
  res.json({ ok: true, activeCampaign: id, meta });
});

// Meta van actieve campagne ophalen
router.get('/campaigns/meta', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  res.json({ ...meta, activeCampaign: storage.getActiveCampaignId() });
});

// ── Madame Ursula / Waarzegger ──
// Voorspelling over de eerstvolgende akte, gekoppeld aan de vijf zintuigen.

const URSULA_ZINTUIGEN = [
  { key: 'zien',    label: 'Zien',    icon: '👁' },
  { key: 'horen',   label: 'Horen',   icon: '👂' },
  { key: 'ruiken',  label: 'Ruiken',  icon: '👃' },
  { key: 'proeven', label: 'Proeven', icon: '👅' },
  { key: 'voelen',  label: 'Voelen',  icon: '✋' },
];

function _ursulaHeeftInhoud(def) {
  if (!def) return false;
  return URSULA_ZINTUIGEN.some(z => (def[z.key] || '').trim()) || !!(def.concreet || '').trim();
}

// De eerstvolgende akte na de actieve (laagste num strikt groter dan de actieve).
function _ursulaVolgendeAkte(meta, dmState) {
  const actief = dmState.activeAkte;
  if (!actief || actief.num == null) return null;
  const hs = meta.hoofdstukken || {};
  let best = null;
  for (const [key, h] of Object.entries(hs)) {
    const num = h.num ?? 99;
    if (num > actief.num && (!best || num < best.num)) best = { key, num, title: h.title || h.short || key };
  }
  return best;
}

// Bouwt de voor de party onthulde fragmenten op basis van de worp.
function _ursulaOnthulling(def, party) {
  const idxs = party?.zintuigen || [];
  const zintuigen = idxs
    .map(i => URSULA_ZINTUIGEN[i])
    .filter(Boolean)
    .map(z => ({ label: z.label, icon: z.icon, tekst: (def[z.key] || '').trim() }))
    .filter(z => z.tekst);
  const concreet = party?.concreet ? ((def.concreet || '').trim() || null) : null;
  return { zintuigen, concreet };
}

const GOCK_TIDBITS_DEFAULT = [
  '{naam} bezocht vorige week in het geheim een wedstrijd voor het vervaardigen van schunnige limericks',
  '{naam} heeft een geheime minnaar in de havenbuurt die ze bezoeken elke eerste dag van de maand',
  '{naam} staat bij drie verschillende kroegen bekend onder een valse naam',
  '{naam} stuurt anonieme klachten naar het stadsbestuur over geluidsoverlast van een nabijgelegen bakker',
  '{naam} koopt elke week vers gebak maar beweert het zelf te bakken',
  '{naam} is al maanden lid van een geheime dichterskring die uitsluitend sonnetten schrijft over kazen',
  '{naam} heeft een huurachterstand van vier maanden maar houdt dit geheim voor de eigenaar',
  '{naam} verloor vorig jaar een aanzienlijk bedrag bij het gokken en heeft dit nog niemand verteld',
  '{naam} verzamelt in het geheim miniatuurbeeldjes van beroemde avonturiers',
  '{naam} betaalt iemand anders om hun post op te halen — ze willen niet gezien worden bij het postkantoor',
  '{naam} heeft een geheime angst voor duiven en mijdt systematisch het centrale plein',
  '{naam} is al drie jaar in het bezit van een boek dat toebehoort aan de stadsbibliotheek',
  '{naam} koopt wekelijks twee flessen wijn maar beweert er nooit een te drinken',
  '{naam} heeft een tweede woning buiten de stad die ze nooit aan iemand hebben laten zien',
  '{naam} spreekt vloeiend een taal die ze officieel niet kennen',
  '{naam} betaalt maandelijks een anonieme toelage aan een onbekende begunstigde',
  '{naam} verloor een weddenschap en moet nu elke dinsdag een specifieke route door de stad vermijden',
  '{naam} heeft een geheime correspondentie met een rivaliserende handelaar gaande al twee jaar',
  '{naam} draagt altijd een bepaald amulet verborgen onder hun kleding — de herkomst ervan is onbekend',
  '{naam} huurde vorig kwartaal een detective in. De Gock was die detective.',
];

// Hoofdgoden met een zegening. Mindere goden en De Verborgene (geen zegen) zijn weggelaten.
// Elke god heeft een eed-zegen (+1, blijvend), een vloek (bij verzaking) en een d4-tabel van eenmalige zegens.
const TEMPEL_GODEN_DEFAULT = [
  { id: 'matall',   naam: 'Matall, de Maker',     domein: 'Oppergod — de zon en de maan',     eedTitel: 'Zolang de hamer heft en het hemelvuur brandt.',     eedTekst: 'Bij de vlam van de dageraad en het zilver van de nacht, zweer ik de orde van de kosmos te bewaren. Ik zal mijn rug krommen onder de last van de schepping en mijn hand niet wenden van het aambeeld des levens. Laat mijn geest zo standvastig zijn als de berekende koers van zon en maan, en moge mijn vlees verharden tot graniet wanneer het onrecht mij tracht te buigen.',           symbool: 'Een witte hamer voor een rode zon',                                  zegen: 'Con +1', vloek: 'Con -1; Matall onthoudt je zijn licht — je herwint geen Hit Dice tijdens een korte rust.',   locatieEntityId: 'e_1773523435069_ymn996', priesterEntityId: 'e_1773523435099_otvhpp', eenmaligeZegens: [
    'Licht des Makers: roep naar believen helder licht op (als de Light-cantrip).',
    'Levensadem: herrol een mislukte death save.',
    'Dageraad: herwin 1d4 HP bij het eerste daglicht dat je ziet.',
    'Maanblik: voordeel op één redding tegen betovering.',
  ] },
  { id: 'seldari',  naam: 'Seldari, Stormoog',    domein: 'Gerechtigheid en bescherming',     eedTitel: 'Ik ben het schild dat niet wijkt, de hand die niet aarzelt.',     eedTekst: 'Onder het wakend oog des hemels hef ik mijn schild tegen de schaduw. Ik beloof de zwakken te beschutten met mijn eigen bloed, en het zwaard der gerechtigheid te trekken zonder vrees of vooringenomenheid. Laat mijn arm niet verslappen en mijn blik niet vertroebelen; waar chaos dreigt, zal mijn standvastigheid een baken zijn.',           symbool: 'Een blauw, driehoekig schild met een oog en gesperde hand',          zegen: 'Str +1', vloek: 'Str -1; Stormoog onttrekt haar schild — nadeel op redding tegen omvergeworpen of vastgegrepen worden.', locatieEntityId: 'e_1773523435072_v8a1kq', priesterEntityId: 'e_1773523435090_v44q5f', eenmaligeZegens: [
    'Wachters reactie: trek één aanval op een bondgenoot binnen 1,5 m naar jezelf.',
    'Schildmuur: +2 AC tegen één aanval (reactie).',
    'Rechtvaardige slag: voordeel op één aanval tegen wie net een bondgenoot raakte.',
    'Onwankelbaar: voordeel op één redding tegen omvergeworpen of geduwd worden.',
  ] },
  { id: 'ghon',     naam: 'Ghon, de Loper',       domein: 'Kennis, uitvinding en wijsheid',   eedTitel: 'Het rad wentelt, de geest ontwaakt.',     eedTekst: 'Ik zweer het pad der onwetenheid te verlaten en de eeuwige stroom van het intellect te volgen. Zoals het waterrad nimmer rust, zo zal mijn geest nimmer ophouden met zoeken, bouwen en doorgronden. Ik beloof de vonk van uitvinding te beschermen tegen de duisternis van de vergetelheid, en mijn wijsheid te delen met hen die dwalen.',         symbool: 'Een purperen waterrad',                                              zegen: 'Int +1', vloek: 'Int -1; de Loper sluit zijn kennis — nadeel op Arcana-, History- en Investigation-checks.',   locatieEntityId: 'e_1773523435074_6u2qaz', priesterEntityId: 'e_1773523435100_h7c4br', eenmaligeZegens: [
    'Inzicht van Ghon: voordeel op één Arcana-, History- of Investigation-check.',
    'Vraag aan de Loper: krijg één waar feit van de DM.',
    'Uitvindersgeest: voordeel op één check om een mechanisme, slot of puzzel te ontcijferen.',
    'Herinnering: herrol één mislukte kennis-check.',
  ] },
  { id: 'tirimet',  naam: 'Tirimet, Elvenluit',   domein: 'Beschaving en de vrije kunsten',   eedTitel: 'Laat de snaren zingen en de muren van de rede herrijzen.',     eedTekst: 'Bij de gouden snaren van de beschaving zweer ik de stem van de rede en de schoonheid van de kunst te verdedigen. Ik beloof de wildernis in de harten der mensen te temmen met harmonie, en de vrije kunsten te koesteren als het hoogste goed. Moge mijn tong nimmer valse noten spreken, en mijn daden een lofzang zijn op de vrede.',         symbool: 'Een gele luit',                                                      zegen: 'Cha +1', vloek: 'Cha -1; de muze verstomt — nadeel op Performance- en Persuasion-checks.',                  locatieEntityId: 'e_1773523435074_33l7q0', eenmaligeZegens: [
    'Muze: geef een bondgenoot een d6-inspiratie (als Bardic Inspiration).',
    'Hoffelijkheid: voordeel op één sociale check in beschaafd gezelschap.',
    'Meesterwerk: voordeel op één check met gereedschap of een kunstvorm.',
    'Betoverend optreden: voordeel op één Performance-check.',
  ] },
  { id: 'oronoe',   naam: 'Oronoë, de Zephir',    domein: 'Zeeën, wind, scheepvaart en verkenning', eedTitel: 'De horizon roept, de storm getemd.',     eedTekst: 'Ik bind mijn ziel aan de rusteloze winden en de peilloze diepten der zee. Ik beloof nimmer te verstarren, maar de horizon na te jagen over onbekende wateren. Laat mijn moed standhouden wanneer de bliksem de hemel splijt, en moge ik de gids zijn voor hen die over de baren dwalen op zoek naar nieuwe kusten.', symbool: 'Drie blauwe kronkellijnen, gekruist door een zwarte bliksemschicht', zegen: 'Dex +1', vloek: 'Dex -1; de wind keert zich tegen je — nadeel op redding tegen vallen en op zwemmen.',       locatieEntityId: 'e_1773523435080_vuriy3', priesterEntityId: 'e_1773523435089_x425rx', eenmaligeZegens: [
    'Rugwind: +3 m snelheid deze beurt.',
    'Zeebenen: adem 10 minuten onder water of voordeel tegen verdrinken.',
    'Stuurmanskunst: voordeel op één check om te navigeren of een vaartuig te besturen.',
    'Wendbaar: herrol één Acrobatics-check of Dex-redding.',
  ] },
  { id: 'velurut',  naam: 'Velurut, de Jager',    domein: 'De natuur en de jacht',            eedTitel: 'Het spoor is getrokken, de wet van het woud is heilig.',     eedTekst: 'Bij het ijzer en het woud zweer ik de balans van de wildernis te eerbiedigen. Ik zal slechts jagen om te voeden, en de natuur beschermen tegen de gulzigheid der steden. Laat mijn voetstappen geruisloos zijn en mijn pijlen zuiver; ik ben het roofdier dat de orde bewaakt, verbonden met het ritme van de aarde.',                  symbool: 'Een hoefijzer',                                                      zegen: 'Wis +1', vloek: 'Wis -1; de jacht verstoot je — dieren zijn wantrouwig en je hebt nadeel op Survival-checks.', locatieEntityId: 'e_1773523435065_ux8z44', priesterEntityId: 'e_1773523435091_do32ym', eenmaligeZegens: [
    'Jagersoog: voordeel op één aanval tegen een door jou gemerkte prooi.',
    'Stille jacht: voordeel op Stealth in de wildernis (één scène).',
    'Spoorzoeker: voordeel op één Survival-check om te sporen of de weg te vinden.',
    'Roep van het wild: voordeel op één Animal Handling-check.',
  ] },
  { id: 'qirell',   naam: 'Qirell, Vuurhand',     domein: 'Landbouw en oogst',                eedTitel: 'Uit de as ontspruit het koren, door het zweet bloeit het land.',     eedTekst: 'Ik zweer trouw aan de cyclus van zaaien en oogsten, aan de zwarte aarde en het groene blad. Met deze handen zal ik het land hoeden, de beesten beschermen en de hongerigen voeden. Moge de hitte van de zon mijn gewassen zegenen en mijn arbeid vruchtbaar zijn, opdat de schuren nimmer leegraken en het leven overwint.',                      symbool: 'Een zwarte en groene boom, achter elkaar',                           zegen: 'Nature/Animal Handling +1', vloek: 'Nature/Animal Handling -1; je voorraden bederven snel — nadeel op redding tegen uitputting.', locatieEntityId: 'e_1773523435081_9t0m87', priesterEntityId: 'e_1773523435090_jv7fl0', eenmaligeZegens: [
    'Overvloed: jouw rantsoenen bederven niet en je hebt voordeel tegen uitputting.',
    'Zegen van de oogst: herwin 1d4 extra HP bij een korte rust.',
    'Vruchtbare hand: laat genoeg voedsel en water voor één maaltijd ontstaan.',
    'Aardse band: voordeel op één Nature-check.',
  ] },
  { id: 'cylline',  naam: 'Cylline, Nymfenblad',  domein: 'Nacht, passie, dronkenschap en extase', eedTitel: 'In de nacht bloeit de waarheid, in de roes de vrijheid.',     eedTekst: 'Bij de purperen vrucht en de diepe schaduwen van de nacht, zweer ik de ketenen van de sleur af te werpen. Ik beloof de passie te vieren, de extase te omarmen en de harten van stervelingen te vullen met de zoete dronkenschap van het bestaan. Laat de angst wijken voor het verlangen, en moge mijn stem de nacht doen beven.',  symbool: 'Drie paarse druiven',                                                zegen: 'Performance/Intimidation +1', vloek: 'Performance/Intimidation -1; de roes wordt een kater — nadeel op redding tegen angst en betovering.', locatieEntityId: 'e_1773523435079_qmyktf', priesterEntityId: 'e_1773523435097_wr01o4', eenmaligeZegens: [
    'Roes: immuun voor de nadelen van dronkenschap en voordeel tegen angst.',
    'Nachtwandelaar: schemerzicht of voordeel op Stealth in het donker (één scène).',
    'Betovering: voordeel op één check om te verleiden of te intimideren.',
    'Extatische roep: herrol één mislukte redding tegen angst of betovering.',
  ] },
  { id: 'sehan',    naam: 'Sehan, de Weegschaal', domein: 'Handel en welvaart',               eedTitel: 'De balans slaat door, de munt spreekt recht.',     eedTekst: 'Ik zweer bij het zuivere metaal van de weegschaal dat mijn handel eerlijk zal zijn en mijn blik onbevooroordeeld. Ik beloof de welvaart te zoeken, niet door bedrog, maar door inzicht en scherpzinnigheid. Laat mijn geest de verborgen intenties der mensen doorzien, opdat rechtvaardige rijkdom de wereld mag voeden.',                     symbool: 'Een metalen weegschaal',                                             zegen: 'Insight/Perception +1', vloek: 'Insight/Perception -1; de weegschaal slaat door — handelaren rekenen je het dubbele.',    locatieEntityId: 'e_1773523435071_17hfyn', eenmaligeZegens: [
    'Koopmansoog: ken de eerlijke waarde van een voorwerp en voordeel bij afdingen.',
    'Gewogen oordeel: voordeel op één Insight-check om een leugen te doorzien.',
    'Scherpe blik: voordeel op één Perception-check.',
    'Eerlijke deal: herrol één mislukte Persuasion-check over geld.',
  ] },
  { id: 'yrdus',    naam: 'Yrdus, de Ringdrager', domein: 'Liefde, huwelijk en familie',      eedTitel: 'Verbonden in bloed, gesmeed in liefde.',     eedTekst: 'Bij de rode ring die geen einde kent, zweer ik mijn naasten lief te hebben en de haard van de familie te beschermen tegen de kou. Ik beloof trouw te blijven in voor- en tegenspoed, en de banden van het bloed en het huwelijk te eren als het fundament van de wereld. Mijn hart is het anker, mijn eed is onbreekbaar.',            symbool: 'Een rode ring',                                                      zegen: 'Persuasion/History +1', vloek: 'Persuasion/History -1; de band breekt — je kunt geen tijdelijke HP van bondgenoten ontvangen.',  locatieEntityId: 'e_1773523435073_817487', priesterEntityId: 'e_1773523435093_4yk7bk', eenmaligeZegens: [
    'Band van Yrdus: als je een bondgenoot helpt, krijgt die 1d4 tijdelijke HP.',
    'Verzoening: voordeel op één check om iemand te kalmeren of vrede te sluiten.',
    'Trouwe eed: voordeel op één redding tegen betovering terwijl je een dierbare beschermt.',
    'Familieverhaal: voordeel op één History-check.',
  ] },
  { id: 'corellin', naam: 'Corellin, Vlasbaard',  domein: 'Dieven, zieken en buitenbeentjes', eedTitel: 'Het gesloten oog ziet de verschoppeling, de vlugge hand deelt uit.',     eedTekst: 'Ik zweer de schaduwen te delen met hen die door het licht zijn uitgespuugd. Ik beloof de zieken te troosten, de buitenbeentjes te herbergen en de spot te drijven met de hoogmoedigen. Moge mijn hand vlug genoeg zijn om de rijken te verlichten en mijn tong listig genoeg om de onrechtvaardigen te misleiden, dwalend in de marge der wereld.',       symbool: 'Een gesloten oog',                                                   zegen: 'Sleight of Hand/Deception +1', vloek: 'Sleight of Hand/Deception -1; het oog opent zich — nadeel op Stealth-checks.',      locatieEntityId: 'e_1773523435078_6wlml1', priesterEntityId: 'e_1773523435099_rwd7x5', eenmaligeZegens: [
    'Schaduwhand: voordeel op één check om ongezien te stelen of een slot te kraken.',
    'Geluk van de verschoppeling: herrol één d20 naar keuze.',
    'Vermomming: voordeel op één Deception-check om je voor een ander uit te geven.',
    'Glipper: voordeel op één check om door een menigte of nauwe ruimte te ontkomen.',
  ] },
  { id: 'denava',   naam: 'Denava',               domein: 'Verandering',                      eedTitel: 'Het zand stroomt, de wereld kantelt.',     eedTekst: 'Bij de vier zandlopers die de eeuwigheid meten, zweer ik het getij van verandering te omarmen. Ik zal mij niet vastklampen aan het verleden, noch vrezen wat komen gaat. Ik beloof te overleven in de storm van de tijd, mij aan te passen aan elke nieuwe dageraad en te transformeren zoals de seizoenen dat doen.',                            symbool: 'Vier zandlopers',                                                    zegen: 'Survival/Nature +1', vloek: 'Survival/Nature -1; het lot keert zich — eenmaal per sessie laat de DM je een geslaagde worp opnieuw gooien.',  locatieEntityId: 'e_1773523435081_yduaof', eenmaligeZegens: [
    'Wending van het lot: zet één nadeel-worp om naar een normale worp.',
    'Aanpassing: voordeel op één redding tegen een effect dat je verplaatst of vervormt.',
    'Reizigerszegen: voordeel op één check om je aan te passen aan vreemd terrein of klimaat.',
    'Keerpunt: herrol je initiatief één keer.',
  ] },
];


// ── Diensten toegang per groep ──
const _DIENSTEN_NAMEN = ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'heeren', 'facties'];

function _getDienstToegang(dmState, dienstNaam, groupId) {
  const g = getGroup(dmState, groupId);
  return (g?.dienstenToegang?.[dienstNaam]) || 'beschikbaar';
}

// GET /diensten/toegang — speler: eigen groep; DM: alle groepen
router.get('/diensten/toegang', attachRole, (req, res) => {
  const dmState = readDmState();
  if (req.session?.role === 'dm') {
    const alle = {};
    for (const [gid] of Object.entries(dmState.groups || {})) {
      alle[gid] = {};
      for (const d of _DIENSTEN_NAMEN) alle[gid][d] = _getDienstToegang(dmState, d, gid);
    }
    return res.json({ alle, groups: groupInfoList(dmState) });
  }
  const playerGid = _playerGroupId(dmState, req.session.characterId);
  const toegang = {};
  for (const d of _DIENSTEN_NAMEN) toegang[d] = _getDienstToegang(dmState, d, playerGid || undefined);
  res.json(toegang);
});

// PUT /diensten/toegang — DM: stel staat in voor één dienst van één groep
router.put('/diensten/toegang', requireDM, (req, res) => {
  const { groepId, dienst, staat } = req.body;
  if (!groepId || !dienst || !staat) return res.status(400).json({ error: 'groepId, dienst en staat zijn verplicht' });
  if (!_DIENSTEN_NAMEN.includes(dienst)) return res.status(400).json({ error: 'Onbekende dienst: ' + dienst });
  if (!['verborgen', 'zichtbaar', 'beschikbaar'].includes(staat)) return res.status(400).json({ error: 'Ongeldig staat: ' + staat });
  const dmState = readDmState();
  const g = dmState.groups?.[groepId];
  if (!g) return res.status(404).json({ error: 'Groep niet gevonden' });
  if (!g.dienstenToegang) g.dienstenToegang = {};
  g.dienstenToegang[dienst] = staat;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('diensten:toegang:updated');
  res.json({ ok: true });
});

function _dienstenBeschikbaar(dmState) {
  const entities = storage.readJSON('entities.json');
  const g = getGroup(dmState);
  const vis = g.visibility || {};
  const lijst = [];
  for (const e of (entities.personages || [])) {
    if ((vis[e.id] || 'hidden') === 'hidden') continue;
    lijst.push({ id: e.id, name: e.name, type: 'personages' });
  }
  return lijst;
}

router.get('/ursula', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.ursula || {};
  const characterId = req.session.characterId;
  const dmState = readDmState();
  const currency = _effectiveCurrency(dmState, characterId);

  const doel = _ursulaVolgendeAkte(meta, dmState);
  const def = doel ? (meta.ursula?.voorspellingen?.[doel.key] || null) : null;
  const beschikbaar = !!(doel && _ursulaHeeftInhoud(def));

  const g = getGroup(dmState);
  const party = (beschikbaar && g.voorspellingen) ? (g.voorspellingen[doel.key] || null) : null;
  const onthuld = party ? _ursulaOnthulling(def, party) : null;

  res.json({
    config: { naam: config.naam || 'Madame Ursula', prijs: config.prijs || { fl: 20 }, imageId: config.imageId || null, backdropId: config.backdropId || null },
    beschikbaar,
    geenSessie: !dmState.activeAkte || dmState.activeAkte.num == null,
    geenAkte: !doel,
    alGeworpen: !!party,
    roll: party?.roll || null,
    doorNaam: party?.doorNaam || null,
    onthuld,
    currency,
  });
});

router.post('/ursula/voorspel', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const meta = storage.readJSON('meta.json');
  const config = meta.ursula || {};
  const dmState = readDmState();

  const doel = _ursulaVolgendeAkte(meta, dmState);
  if (!doel) return res.status(400).json({ error: 'Er is nu geen komende akte om te voorzien' });
  const def = meta.ursula?.voorspellingen?.[doel.key];
  if (!_ursulaHeeftInhoud(def)) return res.status(400).json({ error: 'De nevelen tonen niets — er valt nu niets te voorzien' });

  const g = getGroup(dmState);
  if (!g.voorspellingen) g.voorspellingen = {};
  if (g.voorspellingen[doel.key]) return res.status(400).json({ error: 'De party heeft deze voorspelling al ontvangen' });

  const prijs = config.prijs || { fl: 20 };
  const prijsCl = toCl(prijs);
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  if (toCl(pc) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo' });

  const pool = [0, 1, 2, 3, 4].filter(i => (def[URSULA_ZINTUIGEN[i].key] || '').trim());
  const roll = Math.floor(Math.random() * 6) + 1;
  let gekozen, concreet = false;
  if (roll === 6) {
    gekozen = pool.slice();
    concreet = !!(def.concreet || '').trim();
  } else {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    gekozen = shuffled.slice(0, Math.min(roll, shuffled.length));
  }
  g.voorspellingen[doel.key] = {
    roll, zintuigen: gekozen, concreet,
    doorNaam: req.session.playerName || '', op: new Date().toISOString(),
  };

  dmState.playerCurrency[characterId] = fromCl(toCl(pc) - prijsCl);
  storage.writeJSON('dm-state.json', dmState);

  // Bezorg de voorspelling ook als brief in het berichtentabblad
  const onthuld = _ursulaOnthulling(def, g.voorspellingen[doel.key]);
  const briefRegels = [];
  for (const z of onthuld.zintuigen) {
    briefRegels.push(z.label + ': ' + z.tekst);
  }
  if (onthuld.concreet) briefRegels.push('\u2736 ' + onthuld.concreet);
  if (briefRegels.length) {
    const naam = config.naam || 'Madame Ursula';
    _bezorgBrief(req, characterId, {
      titel: 'Voorspelling — ' + (doel.title || 'komende akte'),
      tekst: briefRegels.join('\n'),
      afzender: naam,
      thema: 'ursula',
    });
  }

  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  io.to(req.session?.campaignId||'main').emit('ursula:updated');

  res.json({ ok: true, roll, onthuld, currency: dmState.playerCurrency[characterId] });
});

// DM: lijst van aktes met hun (eventuele) voorspelling-inhoud
router.get('/ursula/aktes', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const hs = meta.hoofdstukken || {};
  const vs = meta.ursula?.voorspellingen || {};
  const dmState = readDmState();
  const aktes = Object.entries(hs)
    .map(([key, h]) => ({ key, num: h.num ?? 99, title: h.title || h.short || key, voorspelling: vs[key] || null }))
    .sort((a, b) => a.num - b.num);
  res.json({ aktes, activeAkte: dmState.activeAkte || null });
});

// DM: voorspelling-inhoud voor een akte opslaan
router.put('/ursula/voorspelling/:akteKey', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.ursula) meta.ursula = {};
  if (!meta.ursula.voorspellingen) meta.ursula.voorspellingen = {};
  const b = req.body || {};
  meta.ursula.voorspellingen[req.params.akteKey] = {
    zien:    (b.zien    || '').trim(),
    horen:   (b.horen   || '').trim(),
    ruiken:  (b.ruiken  || '').trim(),
    proeven: (b.proeven || '').trim(),
    voelen:  (b.voelen  || '').trim(),
    concreet:(b.concreet|| '').trim(),
  };
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.ursula.voorspellingen[req.params.akteKey]);
});

// DM: wis de party-voorspelling (zodat opnieuw geworpen kan worden)
router.post('/ursula/reset', requireDM, (req, res) => {
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (g.voorspellingen) {
    if (req.body?.akteKey) delete g.voorspellingen[req.body.akteKey];
    else g.voorspellingen = {};
  }
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('ursula:updated');
  res.json({ ok: true });
});

// ── De Gock / Privédetective ──

function _gockCheckReady(dmState, io, campaignId) {
  if (!dmState.gockState) return false;
  const room = campaignId || 'main';
  const now = new Date();
  let changed = false;
  const entities = storage.readJSON('entities.json');
  for (const [charId, geval] of Object.entries(dmState.gockState)) {
    if (!geval.gereed && geval.klaarOp && new Date(geval.klaarOp) <= now) {
      geval.gereed = true;
      changed = true;
      if (geval.isGeheim) {
        const entity = (entities[geval.entityType] || []).find(e => e.id === geval.entityId);
        if (entity) {
          const g = getGroup(dmState);
          if (!g.secretReveals) g.secretReveals = {};
          g.secretReveals[geval.entityId] = true;
          if (io) {
            io.to(room).emit('entity:secret', { id: geval.entityId, type: geval.entityType, name: entity.name, secretReveal: true });
            io.to(room).emit('entity:updated', { type: geval.entityType, id: geval.entityId });
          }
        }
      }
      if (io) {
        io.to(room).emit('gock:rapport-klaar', {
          characterId: charId,
          entityName: geval.entityName,
          entityId: geval.entityId,
          entityType: geval.entityType,
        });
      }
    }
  }
  return changed;
}

router.get('/gock', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.gock || {};
  const characterId = req.session.characterId;
  const dmState = readDmState();
  const io = req.app.get('io');

  if (_gockCheckReady(dmState, io, req.session?.campaignId)) storage.writeJSON('dm-state.json', dmState);

  const playerCase = characterId ? ((dmState.gockState || {})[characterId] || null) : null;
  const currency = _effectiveCurrency(dmState, characterId);

  // Sluit de detective zelf uit als onderzoeksonderwerp
  const beschikbaar = _dienstenBeschikbaar(dmState)
    .filter(e => !config.imageId || e.id !== config.imageId);

  res.json({
    config: { prijs: config.prijs || { fl: 50 }, naam: config.naam || 'De Gock', imageId: config.imageId || null, backdropId: config.backdropId || null },
    geval: playerCase,
    beschikbaar,
    currency,
  });
});

router.post('/gock/opdracht', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const { entityId, entityType } = req.body;
  if (!entityId || !entityType) return res.status(400).json({ error: 'entityId en entityType vereist' });

  const dmState = readDmState();
  if (!dmState.gockState) dmState.gockState = {};
  const existing = dmState.gockState[characterId];
  if (existing && !existing.gereed) return res.status(400).json({ error: 'Je hebt al een lopende opdracht' });

  const meta = storage.readJSON('meta.json');
  const config = meta.gock || {};
  if (config.imageId && entityId === config.imageId) {
    return res.status(400).json({ error: 'De detective kan geen onderzoek naar zichzelf uitvoeren' });
  }
  const prijs = config.prijs || { fl: 50 };
  const tidbits = config.tidbits?.length ? config.tidbits : GOCK_TIDBITS_DEFAULT;

  const prijsCl = toCl(prijs);
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  if (toCl(pc) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo' });

  const entities = storage.readJSON('entities.json');
  const entity = (entities[entityType] || []).find(e => e.id === entityId);
  if (!entity) return res.status(404).json({ error: 'Entiteit niet gevonden' });

  let tekst, isGeheim = false;
  if (entity.data?.geheim) {
    tekst = entity.data.geheim;
    isGeheim = true;
  } else {
    tekst = tidbits[Math.floor(Math.random() * tidbits.length)].replace(/\{naam\}/g, entity.name);
  }

  dmState.playerCurrency[characterId] = fromCl(toCl(pc) - prijsCl);
  const klaarOp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  dmState.gockState[characterId] = {
    entityId, entityType, entityName: entity.name,
    betaaldOp: new Date().toISOString(),
    klaarOp, tekst, isGeheim,
    gereed: false, opgehaald: false,
  };

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  res.json({ ok: true, klaarOp, currency: dmState.playerCurrency[characterId] });
});

router.put('/gock/opgehaald', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const dmState = readDmState();
  const geval = (dmState.gockState || {})[characterId];
  if (!geval) return res.status(404).json({ error: 'Geen dossier gevonden' });
  geval.opgehaald = true;
  // Rapport toevoegen aan knapzak
  if (!dmState.playerItems) dmState.playerItems = {};
  if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];
  const rapport = {
    id: 'gock_' + Date.now(),
    name: '📁 Rapport — ' + geval.entityName,
    note: geval.tekst,
    entityId: geval.entityId,
    entityType: geval.entityType,
  };
  dmState.playerItems[characterId].push(rapport);
  storage.writeJSON('dm-state.json', dmState);
  // Bezorg het dossier ook als gethematiseerde brief (logo + typemachine) in de berichtenbox
  _bezorgBrief(req, characterId, {
    titel: 'Onderzoeksrapport — ' + geval.entityName,
    tekst: geval.tekst,
    afzender: 'De Gock',
    thema: 'gock',
    entityId: geval.entityId,
    entityType: geval.entityType,
  });
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });
  res.json({ ok: true });
});

router.put('/meta/tweespalt', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.tweespalt) meta.tweespalt = {};
  ['naam', 'imageId', 'backdropId'].forEach(f => { if (req.body[f] !== undefined) meta.tweespalt[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.tweespalt);
});

router.put('/meta/ursula', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.ursula) meta.ursula = {};
  ['naam', 'prijs', 'imageId', 'backdropId'].forEach(f => { if (req.body[f] !== undefined) meta.ursula[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.ursula);
});

router.put('/meta/gock', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.gock) meta.gock = {};
  ['naam', 'prijs', 'tidbits', 'imageId', 'backdropId'].forEach(f => { if (req.body[f] !== undefined) meta.gock[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.gock);
});

// ── De Tempel / Zegeningen ──

function _tempelGoden(config) {
  return config.goden?.length ? config.goden : TEMPEL_GODEN_DEFAULT;
}

router.get('/tempel', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.tempel || {};
  const characterId = req.session.characterId;
  const dmState = readDmState();

  const items = characterId ? ((dmState.playerItems || {})[characterId] || []) : [];
  const huidigeZegen = items.find(i => i.zegen) || null;
  const huidigeEed   = items.find(i => i.eed) || null;
  const currency = _effectiveCurrency(dmState, characterId);

  res.json({
    config: {
      naam: config.naam || 'De Tempel',
      prijs: config.prijs || { fl: 25 },
      eedPrijs: config.eedPrijs || config.prijs || { fl: 50 },
      boetePrijs: config.boetePrijs || { fl: 100 },
      imageId: config.imageId || null,
      backdropId: config.backdropId || null,
      voorwerpNaam: config.voorwerpNaam || 'Votiefmunt van {god}',
      goden: _tempelGoden(config),
    },
    huidigeZegen,
    huidigeEed,
    currency,
  });
});

// Eenmalige zegen: d{n} kiest welke, d4 bepaalt het aantal keer. Vervalt bij lange rust.
router.post('/tempel/zegen', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const { godId } = req.body;
  if (!godId) return res.status(400).json({ error: 'godId vereist' });

  const meta = storage.readJSON('meta.json');
  const config = meta.tempel || {};
  const god = _tempelGoden(config).find(g => g.id === godId);
  if (!god) return res.status(404).json({ error: 'Onbekende god' });

  const eenmalige = Array.isArray(god.eenmaligeZegens) ? god.eenmaligeZegens.filter(Boolean) : [];
  if (eenmalige.length === 0) return res.status(400).json({ error: 'Deze god biedt geen eenmalige zegen' });

  const dmState = readDmState();
  if (!dmState.playerItems) dmState.playerItems = {};
  if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];

  const prijs = (god.prijs && toCl(god.prijs) > 0) ? god.prijs : (config.prijs || { fl: 25 });
  const prijsCl = toCl(prijs);
  const pc = _effectiveCurrency(dmState, characterId);
  if (toCl(pc) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo' });

  // Eén eenmalige zegen per speler tegelijk (los van de eed): vervang de vorige
  dmState.playerItems[characterId] = dmState.playerItems[characterId].filter(i => !i.zegen);

  const voorwerpNaam = (config.voorwerpNaam || 'Votiefmunt van {god}').replace(/\{god\}/g, god.naam);
  const zegenRoll = Math.floor(Math.random() * eenmalige.length) + 1; // d{n}: wélke zegen
  const usesRoll  = Math.floor(Math.random() * 4) + 1;                // d4: aantal keer
  const effect = eenmalige[zegenRoll - 1];
  const rolls = { zegenRoll, zegenAantal: eenmalige.length, usesRoll };
  const item = {
    id: 'zegen_' + godId + '_' + Date.now(),
    name: voorwerpNaam,
    note: `Eenmalige zegen van ${god.naam}: ${effect} Vink af na elk gebruik; vervalt bij je volgende lange rust.`,
    zegen: true,
    kind: 'eenmalig',
    subtype: 'zegen',
    godId,
    godNaam: god.naam,
    zegenEffect: effect,
    uses: usesRoll,
    usesMax: usesRoll,
    qty: usesRoll,
  };
  _koppelGoddelijkEntity(dmState, characterId, god.naam, 'zegen', item);
  dmState.playerItems[characterId].push(item);

  const { shared: _zs, currency: _zc } = _deductCurrency(dmState, characterId, prijsCl);
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  if (_zs) io.to(req.session?.campaignId||'main').emit('party-currency:updated', { currency: _zc });
  else io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: _zc });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });

  res.json({ ok: true, item, rolls, currency: _zc });
});

router.post('/tempel/verbruik', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const dmState = readDmState();
  const lijst = (dmState.playerItems || {})[characterId] || [];
  const item = lijst.find(i => i.zegen && i.kind === 'eenmalig');
  if (!item) return res.status(404).json({ error: 'Geen eenmalige zegen om af te vinken' });

  item.uses = (item.uses || 0) - 1;
  item.qty = item.uses;
  let removed = false;
  if (item.uses <= 0) {
    dmState.playerItems[characterId] = lijst.filter(i => i.id !== item.id);
    removed = true;
  }
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });

  res.json({ ok: true, removed, uses: removed ? 0 : item.uses });
});

// Eed: blijvende +1 (overleeft lange rust). Eén eed per speler. Verzaking → vloek.
router.post('/tempel/eed', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const { godId } = req.body;
  if (!godId) return res.status(400).json({ error: 'godId vereist' });

  const meta = storage.readJSON('meta.json');
  const config = meta.tempel || {};
  const god = _tempelGoden(config).find(g => g.id === godId);
  if (!god) return res.status(404).json({ error: 'Onbekende god' });

  const dmState = readDmState();
  if (!dmState.playerItems) dmState.playerItems = {};
  if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];

  if (dmState.playerItems[characterId].some(i => i.eed)) {
    return res.status(400).json({ error: 'Je bent al door een eed gebonden — bevrijd je eerst.' });
  }

  const prijs = config.eedPrijs || config.prijs || { fl: 50 };
  const prijsCl = toCl(prijs);
  const pc = _effectiveCurrency(dmState, characterId);
  if (toCl(pc) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo' });

  const item = {
    id: 'eed_' + godId + '_' + Date.now(),
    name: 'Eed aan ' + god.naam,
    note: `Eed aan ${god.naam}${god.domein ? ' — ' + god.domein : ''}. Zegen: ${god.zegen || '—'}. Een blijvende eed; verzaking roept een vloek op.`,
    eed: true,
    kind: 'eed',
    subtype: 'eed',
    status: 'nagekomen',
    godId,
    godNaam: god.naam,
    zegenEffect: god.zegen || '',
    vloekEffect: god.vloek || '',
  };
  _koppelGoddelijkEntity(dmState, characterId, god.naam, 'eed', item);
  dmState.playerItems[characterId].push(item);

  const { shared: _es, currency: _ec } = _deductCurrency(dmState, characterId, prijsCl);
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  if (_es) io.to(req.session?.campaignId||'main').emit('party-currency:updated', { currency: _ec });
  else io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: _ec });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });

  res.json({ ok: true, item, currency: _ec });
});

// Boete: speler koopt zich vrij van een vloek.
router.post('/tempel/boete', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const meta = storage.readJSON('meta.json');
  const config = meta.tempel || {};

  const dmState = readDmState();
  const lijst = (dmState.playerItems || {})[characterId] || [];
  const vloek = lijst.find(i => i.eed && i.status === 'vloek');
  if (!vloek) return res.status(400).json({ error: 'Je draagt geen vloek om af te kopen' });

  const prijs = config.boetePrijs || { fl: 100 };
  const prijsCl = toCl(prijs);
  const pc = _effectiveCurrency(dmState, characterId);
  if (toCl(pc) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo voor de boete' });

  dmState.playerItems[characterId] = lijst.filter(i => i.id !== vloek.id);
  const { shared: _bs, currency: _bc } = _deductCurrency(dmState, characterId, prijsCl);
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  if (_bs) io.to(req.session?.campaignId||'main').emit('party-currency:updated', { currency: _bc });
  else io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: _bc });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });

  res.json({ ok: true, currency: _bc });
});

// DM-beheer: overzicht van actieve eden/vloeken
router.get('/tempel/eden', requireDM, (req, res) => {
  const dmState = readDmState();
  const entities = storage.readJSON('entities.json');
  const naamVan = (id) => (entities.personages || []).find(e => e.id === id)?.name || id;
  const lijst = [];
  for (const [charId, items] of Object.entries(dmState.playerItems || {})) {
    const eed = (items || []).find(i => i.eed);
    if (eed) lijst.push({
      characterId: charId,
      characterName: naamVan(charId),
      status: eed.status || 'nagekomen',
      godNaam: eed.godNaam || '',
      effect: eed.status === 'vloek' ? (eed.vloekEffect || '') : (eed.zegenEffect || ''),
    });
  }
  res.json(lijst);
});

// DM verbreekt een eed → vloek
router.post('/tempel/eed/verbreek', requireDM, (req, res) => {
  const { characterId } = req.body;
  if (!characterId) return res.status(400).json({ error: 'characterId vereist' });
  const dmState = readDmState();
  const eed = ((dmState.playerItems || {})[characterId] || []).find(i => i.eed);
  if (!eed) return res.status(404).json({ error: 'Deze speler draagt geen eed' });
  if (eed.status === 'vloek') return res.status(400).json({ error: 'De eed is al verzaakt' });

  eed.status = 'vloek';
  eed.subtype = 'vloek';
  eed.name = 'Vloek van ' + (eed.godNaam || 'een god');
  eed.note = `Vloek van ${eed.godNaam || 'een god'} wegens een verzaakte eed: ${eed.vloekEffect || ''} Doe boete in de tempel om je te bevrijden.`;
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });
  io.to(req.session?.campaignId||'main').emit('player:vloek', { characterId, godNaam: eed.godNaam || 'een god', vloekEffect: eed.vloekEffect || '' });
  res.json({ ok: true });
});

// DM heft een eed of vloek op (correctie)
router.post('/tempel/eed/hef', requireDM, (req, res) => {
  const { characterId } = req.body;
  if (!characterId) return res.status(400).json({ error: 'characterId vereist' });
  const dmState = readDmState();
  const lijst = (dmState.playerItems || {})[characterId] || [];
  if (!lijst.some(i => i.eed)) return res.status(404).json({ error: 'Deze speler draagt geen eed of vloek' });
  dmState.playerItems[characterId] = lijst.filter(i => !i.eed);
  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });
  res.json({ ok: true });
});

router.put('/meta/tempel', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.tempel) meta.tempel = {};
  ['naam', 'prijs', 'eedPrijs', 'boetePrijs', 'imageId', 'backdropId', 'voorwerpNaam', 'goden'].forEach(f => { if (req.body[f] !== undefined) meta.tempel[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.tempel);
});

// ── De Heeren van de Nacht / Dievengilde ──

const HEEREN_KLUSTYPES = {
  zakkenrollen: { naam: 'Zakkenrollen', doelType: 'personages', sjablonen: [
    'Licht {doel} de beurs in een drukke straat.',
    'Ontfutsel {doel} een waardevol kleinood.',
    'Rol {doel} op de markt zonder dat iemand het merkt.',
  ] },
  inbraak: { naam: 'Inbraak', doelType: 'locaties', sjablonen: [
    "Breek 's nachts in bij {doel} en ontvreemd iets van waarde.",
    'Kraak het slot van {doel} en doorzoek de boel.',
    'Glip ongezien {doel} binnen en grijp de buit.',
  ] },
  oplichting: { naam: 'Oplichting', doelType: 'personages', sjablonen: [
    'Licht {doel} op met een vervalste schuldbrief.',
    'Praat {doel} een waardeloze "schat" aan.',
    'Bedrieg {doel} met een vals contract.',
  ] },
};

const HEEREN_RANGEN_DEFAULT = [
  { naam: 'Schoffie',       min: 10,  max: 30,  voordelen: 'Toegang tot het klussenbord.' },
  { naam: 'Beurzensnijder', min: 25,  max: 70,  voordelen: 'Betere klussen; de heler knijpt een oogje toe.' },
  { naam: 'Inbreker',       min: 60,  max: 150, voordelen: 'Hogere buit en eerste keus uit de klussen.' },
  { naam: 'Schaduw',        min: 140, max: 300, voordelen: 'Een goed woordje bij Zilvertong en Zemelaar.' },
  { naam: 'Meesterdief',    min: 280, max: 600, voordelen: 'De Heeren staan voor je in bij de Luimpoort.' },
];

function _heerenConfig(meta) {
  const c = meta.heeren || {};
  return {
    naam: c.naam || 'De Heeren van de Nacht',
    imageId: c.imageId || null,
    backdropId: c.backdropId || null,
    luimpoortId: c.luimpoortId || null,
    advocaatId: c.advocaatId || null,
    honorarium: c.honorarium || { fl: 50 },
    boeteFactor: c.boeteFactor ?? 2,
    bordGrootte: c.bordGrootte ?? 4,
    rangen: (c.rangen && c.rangen.length) ? c.rangen : HEEREN_RANGEN_DEFAULT,
  };
}

function _fmtFl(cl) {
  const c = fromCl(cl);
  return [c.fl && `${c.fl} fl`, c.kn && `${c.kn} kn`, c.cl && `${c.cl} cl`].filter(Boolean).join(' ') || '0 cl';
}

// Persuasion-bonus uit een spelerprofiel (CHA-vaardigheid)
function _persuasionBonus(profile) {
  if (!profile) return 0;
  const cha = parseInt(profile.cha) || 10;
  const mod = Math.floor((cha - 10) / 2);
  const pb = parseInt(profile.profBonus) || 0;
  let profs = {}, adj = {};
  try { profs = JSON.parse(profile.skillProfs || '{}'); } catch {}
  try { adj   = JSON.parse(profile.skillAdj   || '{}'); } catch {}
  const p = profs['persuasion'];
  return mod + (p === 'expert' ? pb * 2 : p === 'prof' ? pb : 0) + (adj['persuasion'] || 0);
}

function _heerenEntiteitInfo(entities, dmState, type, id) {
  const e = (entities[type] || []).find(x => x.id === id);
  if (!e) return null;
  const vis = (getGroup(dmState).visibility || {})[id] || 'hidden';
  return { id, naam: e.name, type, zichtbaar: vis !== 'hidden' };
}

function _heerenGenereerKlus(entities, dmState, rang) {
  const typeKeys = Object.keys(HEEREN_KLUSTYPES);
  const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
  const t = HEEREN_KLUSTYPES[typeKey];
  const pool = entities[t.doelType] || [];          // bewust álle entiteiten (ook onontdekte)
  if (!pool.length) return null;
  const doel = pool[Math.floor(Math.random() * pool.length)];
  const sjabloon = t.sjablonen[Math.floor(Math.random() * t.sjablonen.length)];
  const payout = rang.min + Math.floor(Math.random() * Math.max(1, (rang.max - rang.min + 1)));
  return {
    id: 'klus_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type: typeKey, typeNaam: t.naam,
    doelId: doel.id, doelType: t.doelType, doelNaam: doel.name,
    omschrijving: sjabloon.replace(/\{doel\}/g, doel.name),
    payout, status: 'open', doorId: null, doorNaam: null,
  };
}

function _heerenWisBoete(dmState, characterId, boeteId) {
  if (dmState.heerenBoetes?.[characterId])
    dmState.heerenBoetes[characterId] = dmState.heerenBoetes[characterId].filter(b => b.id !== boeteId);
  if (dmState.playerItems?.[characterId])
    dmState.playerItems[characterId] = dmState.playerItems[characterId].filter(i => i.heerenBoeteId !== boeteId);
}

function _heerenSyncBoeteItem(dmState, characterId, boete) {
  const it = (dmState.playerItems?.[characterId] || []).find(i => i.heerenBoeteId === boete.id);
  if (it) it.note = `Openstaande boete van ${_fmtFl(boete.bedragCl)} wegens "${boete.reden}". Te voldoen bij de Luimpoort.`;
}

router.get('/heeren', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = _heerenConfig(meta);
  const dmState = readDmState();
  const entities = storage.readJSON('entities.json');
  const characterId = req.session.characterId;
  const isDM = req.role === 'dm';

  const g = getGroup(dmState);
  const state = g.heeren || { rang: 0, jobs: [] };
  const rangIdx = Math.min(state.rang || 0, config.rangen.length - 1);
  const rang = config.rangen[rangIdx] || config.rangen[0];

  const jobs = (state.jobs || []).map(j => {
    const vis = (g.visibility || {})[j.doelId] || 'hidden';
    return { ...j, doelZichtbaar: vis !== 'hidden' };
  });

  const luimpoort = config.luimpoortId ? _heerenEntiteitInfo(entities, dmState, 'locaties', config.luimpoortId) : null;
  const advocaat  = config.advocaatId
    ? (_heerenEntiteitInfo(entities, dmState, 'personages', config.advocaatId) || _heerenEntiteitInfo(entities, dmState, 'organisaties', config.advocaatId))
    : null;

  const boetes = dmState.heerenBoetes || {};
  const eigenBoetes = characterId ? (boetes[characterId] || []) : [];
  let alleBoetes = null;
  if (isDM) {
    alleBoetes = [];
    for (const [cid, lijst] of Object.entries(boetes)) {
      const ch = (entities.personages || []).find(e => e.id === cid);
      for (const b of (lijst || [])) alleBoetes.push({ ...b, characterId: cid, characterNaam: ch?.name || cid });
    }
  }

  const volgende = config.rangen[rangIdx + 1] || null;
  res.json({
    config: { naam: config.naam, imageId: config.imageId, backdropId: config.backdropId, honorarium: config.honorarium },
    rang: {
      naam: rang.naam, index: rangIdx, aantal: config.rangen.length,
      voordelen: rang.voordelen || '', min: rang.min, max: rang.max,
      volgende: volgende ? { naam: volgende.naam, voordelen: volgende.voordelen || '' } : null,
    },
    luimpoort, advocaat, jobs,
    boetes: eigenBoetes, alleBoetes,
    currency: _effectiveCurrency(dmState, characterId),
  });
});

router.post('/heeren/genereer', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = _heerenConfig(meta);
  const dmState = readDmState();
  const entities = storage.readJSON('entities.json');
  const g = getGroup(dmState);
  if (!g.heeren) g.heeren = { rang: 0, jobs: [] };
  const rangIdx = Math.min(g.heeren.rang || 0, config.rangen.length - 1);
  const rang = config.rangen[rangIdx] || config.rangen[0];

  const behouden = (g.heeren.jobs || []).filter(j => j.status === 'aangenomen');
  const nieuw = [];
  let guard = 0;
  while (behouden.length + nieuw.length < config.bordGrootte && guard++ < 50) {
    const k = _heerenGenereerKlus(entities, dmState, rang);
    if (!k) break;
    nieuw.push(k);
  }
  g.heeren.jobs = [...behouden, ...nieuw];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true, jobs: g.heeren.jobs });
});

router.post('/heeren/job/:id/aanneem', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const dmState = readDmState();
  const g = getGroup(dmState);
  const job = (g.heeren?.jobs || []).find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Klus niet gevonden' });
  if (job.status !== 'open') return res.status(400).json({ error: 'Deze klus is al aangenomen' });
  job.status = 'aangenomen';
  job.doorId = characterId;
  job.doorNaam = req.session.playerName || '';
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true });
});

// DM markeert de uitslag: geslaagd | mislukt | ontsnapt | gearresteerd
router.post('/heeren/job/:id/uitslag', requireDM, (req, res) => {
  const { uitkomst } = req.body;
  const meta = storage.readJSON('meta.json');
  const config = _heerenConfig(meta);
  const dmState = readDmState();
  const g = getGroup(dmState);
  const jobs = g.heeren?.jobs || [];
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Klus niet gevonden' });

  const io = req.app.get('io');
  if (uitkomst === 'geslaagd' && job.doorId) {
    if (!dmState.playerCurrency) dmState.playerCurrency = {};
    const pc = dmState.playerCurrency[job.doorId] || { fl: 0, kn: 0, cl: 0 };
    dmState.playerCurrency[job.doorId] = fromCl(toCl(pc) + job.payout * 100);
    io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId: job.doorId, currency: dmState.playerCurrency[job.doorId] });
  } else if (uitkomst === 'gearresteerd' && job.doorId) {
    if (!dmState.heerenBoetes) dmState.heerenBoetes = {};
    if (!dmState.heerenBoetes[job.doorId]) dmState.heerenBoetes[job.doorId] = [];
    const bedragCl = job.payout * 100 * (config.boeteFactor || 2);
    const boete = { id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), bedragCl, reden: `${job.typeNaam} — ${job.doelNaam}`, op: new Date().toISOString() };
    dmState.heerenBoetes[job.doorId].push(boete);
    if (!dmState.playerItems) dmState.playerItems = {};
    if (!dmState.playerItems[job.doorId]) dmState.playerItems[job.doorId] = [];
    dmState.playerItems[job.doorId].push({
      id: 'heeren_boete_' + boete.id,
      name: '⚖️ Boete — de Luimpoort',
      note: `Openstaande boete van ${_fmtFl(bedragCl)} wegens "${boete.reden}". Te voldoen bij de Luimpoort.`,
      heerenBoeteId: boete.id,
    });
    io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId: job.doorId, items: dmState.playerItems[job.doorId] });
  }
  g.heeren.jobs = jobs.filter(j => j.id !== job.id);
  storage.writeJSON('dm-state.json', dmState);
  io.to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true });
});

router.post('/heeren/rang', requireDM, (req, res) => {
  const rang = parseInt(req.body.rang);
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.heeren) g.heeren = { rang: 0, jobs: [] };
  g.heeren.rang = isNaN(rang) ? 0 : Math.max(0, rang);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true, rang: g.heeren.rang });
});

// Boete betalen (speler)
router.post('/heeren/boete/:boeteId/betaal', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const dmState = readDmState();
  const lijst = (dmState.heerenBoetes || {})[characterId] || [];
  const boete = lijst.find(b => b.id === req.params.boeteId);
  if (!boete) return res.status(404).json({ error: 'Boete niet gevonden' });
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  if (toCl(pc) < boete.bedragCl) return res.status(400).json({ error: 'Onvoldoende saldo' });
  dmState.playerCurrency[characterId] = fromCl(toCl(pc) - boete.bedragCl);
  _heerenWisBoete(dmState, characterId, boete.id);
  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] || [] });
  io.to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true, currency: dmState.playerCurrency[characterId] });
});

// Advocaat (Zilvertong en Zemelaar) inhuren: honorarium + pleidooi-worp (d20 + Persuasion)
router.post('/heeren/boete/:boeteId/advocaat', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const meta = storage.readJSON('meta.json');
  const config = _heerenConfig(meta);
  const dmState = readDmState();
  const lijst = (dmState.heerenBoetes || {})[characterId] || [];
  const boete = lijst.find(b => b.id === req.params.boeteId);
  if (!boete) return res.status(404).json({ error: 'Boete niet gevonden' });

  const honorariumCl = toCl(config.honorarium);
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  if (toCl(pc) < honorariumCl) return res.status(400).json({ error: 'Onvoldoende saldo voor het honorarium' });
  dmState.playerCurrency[characterId] = fromCl(toCl(pc) - honorariumCl);

  const profile = (dmState.playerProfiles || {})[characterId] || {};
  const bonus = _persuasionBonus(profile);
  const worp = Math.floor(Math.random() * 20) + 1;
  const totaal = worp + bonus;
  let uitkomst, kwijt = false;
  if (totaal >= 20)      { uitkomst = 'kwijtgescholden'; _heerenWisBoete(dmState, characterId, boete.id); kwijt = true; }
  else if (totaal >= 12) { uitkomst = 'gehalveerd'; boete.bedragCl = Math.ceil(boete.bedragCl / 2); _heerenSyncBoeteItem(dmState, characterId, boete); }
  else                   { uitkomst = 'niets'; }

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] || [] });
  io.to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true, worp, bonus, totaal, uitkomst, kwijt, currency: dmState.playerCurrency[characterId] });
});

// DM scheldt een boete kwijt (correctie / rechtszaak-uitkomst aan tafel)
router.post('/heeren/kwijt', requireDM, (req, res) => {
  const { characterId, boeteId } = req.body || {};
  if (!characterId || !boeteId) return res.status(400).json({ error: 'characterId en boeteId vereist' });
  const dmState = readDmState();
  _heerenWisBoete(dmState, characterId, boeteId);
  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId, items: (dmState.playerItems || {})[characterId] || [] });
  io.to(req.session?.campaignId||'main').emit('heeren:updated');
  res.json({ ok: true });
});

router.put('/meta/heeren', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.heeren) meta.heeren = {};
  ['naam','imageId','backdropId','luimpoortId','advocaatId','honorarium','boeteFactor','bordGrootte','rangen'].forEach(f => { if (req.body[f] !== undefined) meta.heeren[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.heeren);});

// ── Facties & Aanzien (organisaties met een rangspoor) ──

const FACTIES_DEFAULT = [
  {
    id: 'cooperatie', naam: 'De Coöperatie', embleem: '🌿', stijl: 'hout',
    beschrijving: 'Het verbond van druïden dat over de wouden en wateren rond Grisburgh waakt.',
    rangen: [
      { naam: 'Buitenstaander', voordelen: 'Geen aanzien; de Kring houdt je op afstand.' },
      { naam: 'Zaailing',       voordelen: 'Je wordt geduld in de buitenste hagen; ruil van kruiden toegestaan.',
        boons: [{ icoon: '🌱', naam: 'Kruidruil', tekst: 'Koop genezende kruiden en eenvoudige remedies tegen kostprijs.' }] },
      { naam: 'Wortelganger',   voordelen: 'Toegang tot de gemeenschappelijke kruidtuin en de raad.',
        boons: [{ icoon: '🍵', naam: 'Kruidtuin', tekst: 'Eens per lange rust een gratis dosis genezende thee.' }] },
      { naam: 'Hagenhoeder',    voordelen: 'Druïden delen voortekenen en veilige paden met je.', titel: 'Hagenhoeder van de Coöperatie',
        boons: [{ icoon: '🧭', naam: 'Veilige paden', tekst: 'Voordeel op overlevingsworpen in de wildernis rond Grisburgh.' }] },
      { naam: 'Boomspreker',    voordelen: 'Je stem telt in de Kring; de Coöperatie staat je bij in nood.', titel: 'Boomspreker der Coöperatie',
        boons: [{ icoon: '🦉', naam: 'Dierbode', tekst: 'Stuur eens per dag een dierbode met een kort bericht.' }] },
      { naam: 'Eikhart',        voordelen: 'De wouden zelf lijken je gunstig gezind.', titel: 'Eikhart van de Kring',
        boons: [{ icoon: '🌳', naam: 'Gunst van het woud', tekst: 'Eens per lange rust een druïdische zegen van de Kring.' }] },
    ],
  },
  {
    id: 'eendragt', naam: 'De Eendragt', embleem: '⚙️', stijl: 'metaal',
    beschrijving: 'Het artifexgilde dat het vakmanschap en de uitvindingen van de stad bewaakt.',
    rangen: [
      { naam: 'Vreemdeling',     voordelen: 'Geen aanzien; het gilde sluit zijn werkplaatsen voor je.' },
      { naam: 'Leerjongen',      voordelen: 'Toegang tot de gildewerkplaats en eenvoudig gereedschap.',
        boons: [{ icoon: '🔧', naam: 'Werkplaats', tekst: 'Gebruik van het gildegereedschap; reparaties tegen kostprijs.' }] },
      { naam: 'Gezel',           voordelen: 'Korting op vakwerk en materialen van het gilde.',
        boons: [{ icoon: '💰', naam: 'Gildekorting', tekst: '10% korting op vakwerk, gereedschap en materialen.' }] },
      { naam: 'Vakmeester',      voordelen: 'Het gilde neemt opdrachten van je aan met voorrang.', titel: 'Vakmeester van De Eendragt',
        boons: [{ icoon: '📜', naam: 'Voorrang', tekst: 'Je opdrachten worden met voorrang vervaardigd.' }] },
      { naam: 'Meester-artifex', voordelen: 'Toegang tot zeldzame ontwerpen en materialen.', titel: 'Meester-artifex',
        boons: [{ icoon: '⚗️', naam: 'Zeldzame ontwerpen', tekst: 'Toegang tot zeldzame blauwdrukken; magische voorwerpen identificeren.' }] },
      { naam: 'Gildemeester',    voordelen: 'Je woord weegt zwaar in de raad van De Eendragt.', titel: 'Gildemeester van De Eendragt',
        boons: [{ icoon: '🛠️', naam: 'Maatwerk', tekst: 'Laat eens per boog een uniek voorwerp op maat vervaardigen.' }] },
    ],
  },
  {
    id: 'roodzwaarden', naam: 'De Roodzwaarden', embleem: '🗡️', stijl: 'staal',
    beschrijving: 'De stadswacht van Grisburgh — gehard, en niet zonder eigenbelang.',
    rangen: [
      { naam: 'Verdachte',     voordelen: 'Geen aanzien; de wacht houdt je in de gaten.' },
      { naam: 'Gedoogde',      voordelen: 'De wacht laat je met rust en beantwoordt je vragen.',
        boons: [{ icoon: '🗣️', naam: 'Goodwill', tekst: 'De wacht beantwoordt vragen en geeft tips.' }] },
      { naam: 'Vertrouweling', voordelen: 'Toegang tot het wachthuis; je mag kleine zaken melden.',
        boons: [{ icoon: '🏛️', naam: 'Wachthuis', tekst: 'Toegang tot het wachthuis en het premiebord.' }] },
      { naam: 'Bondgenoot',    voordelen: 'Je mag premies innen en krijgt eerste keus uit het premiebord.', titel: 'Bondgenoot van de Roodzwaarden',
        boons: [{ icoon: '📋', naam: 'Premiejager', tekst: 'Eerste keus uit premies en een hogere uitbetaling.' }] },
      { naam: 'Schildgenoot',  voordelen: 'De wacht verleent je doortocht en bijstand bij gevaar.', titel: 'Schildgenoot der Roodzwaarden',
        boons: [{ icoon: '🛡️', naam: 'Bijstand', tekst: 'Roep eens per dag een wachtpatrouille op als rugdekking.' }] },
      { naam: 'Erezwaard',     voordelen: 'Je geniet het volle vertrouwen van de Roodzwaarden.', titel: 'Erezwaard van Grisburgh',
        boons: [{ icoon: '⚖️', naam: 'Vrijgeleide', tekst: 'De wacht knijpt eenmalig een oogje toe bij een klein vergrijp.' }] },
    ],
  },
];

function _factiesConfig(meta) {
  const c = meta.facties;
  return (Array.isArray(c) && c.length) ? c : FACTIES_DEFAULT;
}

function _factieRangView(factie, rangIdx) {
  const rangen = (factie.rangen && factie.rangen.length) ? factie.rangen : [{ naam: '—', voordelen: '' }];
  const idx = Math.max(0, Math.min(rangIdx || 0, rangen.length - 1));
  const rang = rangen[idx];
  const volgende = rangen[idx + 1] || null;
  return {
    naam: rang.naam, index: idx, aantal: rangen.length, voordelen: rang.voordelen || '',
    volgende: volgende ? { naam: volgende.naam, voordelen: volgende.voordelen || '' } : null,
  };
}

router.get('/facties', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = _factiesConfig(meta);
  const dmState = readDmState();
  const state = getGroup(dmState).facties || {};
  const isDM = req.role === 'dm';
  const titels = [];
  const facties = config.map(f => {
    const rangen = (f.rangen && f.rangen.length) ? f.rangen : [{ naam: '—', voordelen: '' }];
    const idx = Math.max(0, Math.min(state[f.id]?.rang || 0, rangen.length - 1));
    const ladder = rangen.map((r, i) => ({
      index: i, naam: r.naam, voordelen: r.voordelen || '', titel: r.titel || null,
      boons: (r.boons || []).map(b => ({ icoon: b.icoon || '•', naam: b.naam || '', tekst: b.tekst || '' })),
      bereikt: i <= idx, huidig: i === idx,
    }));
    rangen.forEach((r, i) => { if (i > 0 && i <= idx && r.titel) titels.push({ titel: r.titel, factie: f.id, factieNaam: f.naam, embleem: f.embleem || '🏛️' }); });
    const view = {
      id: f.id, naam: f.naam, embleem: f.embleem || '🏛️', beschrijving: f.beschrijving || '',
      stijl: f.stijl || '', rang: _factieRangView(f, idx), ladder,
    };
    if (isDM) view.rangen = f.rangen || [];
    return view;
  });
  res.json({ facties, titels });
});

router.post('/facties/:id/rang', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const factie = _factiesConfig(meta).find(f => f.id === req.params.id);
  if (!factie) return res.status(404).json({ error: 'Factie niet gevonden' });
  const maxIdx = (factie.rangen?.length || 1) - 1;
  const rang = parseInt(req.body.rang);
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.facties) g.facties = {};
  if (!g.facties[factie.id]) g.facties[factie.id] = { rang: 0 };
  g.facties[factie.id].rang = isNaN(rang) ? 0 : Math.max(0, Math.min(rang, maxIdx));
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('facties:updated');
  res.json({ ok: true, id: factie.id, rang: g.facties[factie.id].rang });
});

router.put('/meta/facties', requireDM, (req, res) => {
  if (!Array.isArray(req.body.facties)) return res.status(400).json({ error: 'facties-array vereist' });
  const meta = storage.readJSON('meta.json');
  meta.facties = req.body.facties.map(f => ({
    id: String(f.id || ('factie_' + Math.random().toString(36).slice(2, 7))).trim(),
    naam: String(f.naam || 'Naamloze factie').trim(),
    embleem: (f.embleem || '🏛️').toString().slice(0, 4),
    stijl: String(f.stijl || '').trim(),
    beschrijving: String(f.beschrijving || '').trim(),
    rangen: (Array.isArray(f.rangen) && f.rangen.length)
      ? f.rangen.map(r => {
          const rang = { naam: String(r.naam || '—').trim(), voordelen: String(r.voordelen || '').trim() };
          if (r.titel && String(r.titel).trim()) rang.titel = String(r.titel).trim();
          const boons = (Array.isArray(r.boons) ? r.boons : [])
            .map(b => ({ icoon: (b.icoon || '•').toString().slice(0, 4), naam: String(b.naam || '').trim(), tekst: String(b.tekst || '').trim() }))
            .filter(b => b.naam || b.tekst);
          if (boons.length) rang.boons = boons;
          return rang;
        })
      : [{ naam: '—', voordelen: '' }],
  }));
  storage.writeJSON('meta.json', meta);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('meta:updated');
  io.to(req.session?.campaignId||'main').emit('facties:updated');
  res.json({ facties: meta.facties });
});

// ── Locatie (Grisburgh verlaten) ──

router.put('/locatie', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (req.body.buitenGrisburgh !== undefined) meta.buitenGrisburgh = Boolean(req.body.buitenGrisburgh);
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json({ buitenGrisburgh: meta.buitenGrisburgh });
});

router.put('/locatie/entiteit', requireDM, (req, res) => {
  const { entityId } = req.body;
  if (!entityId) return res.status(400).json({ error: 'entityId vereist' });
  const meta = storage.readJSON('meta.json');
  if (!meta.buitenGrisburgEntiteiten) meta.buitenGrisburgEntiteiten = [];
  const idx = meta.buitenGrisburgEntiteiten.indexOf(entityId);
  if (idx === -1) meta.buitenGrisburgEntiteiten.push(entityId);
  else            meta.buitenGrisburgEntiteiten.splice(idx, 1);
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json({ buitenGrisburgEntiteiten: meta.buitenGrisburgEntiteiten });
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
      if (vis === 'hidden' || vis === 'vague') continue;  // verborgen/vaag: overslaan
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

  // Valuta (gedeelde beurs indien van toepassing)
  const currency = _effectiveCurrency(dmState, characterId);

  res.json({
    config: {
      naam:      config.naam,
      waard:     config.waard,
      imageId:   config.imageId || '',
      maxVragen: config.maxVragen || 3,
      groet:     config.groet || '',
      prijs:     config.prijs || null,
    },
    state:           playerState,
    entities:        result,
    playerFirstName,
    currency,
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
  req.app.get('io').to(req.session?.campaignId||'main').emit('entity:updated', { type: foundType, id: entityId });

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

// ── Tweespalt / Gokkantoor ──

function _tsState(dmState) {
  if (!dmState.tweespalt) dmState.tweespalt = {};
  if (!dmState.tweespalt.events) dmState.tweespalt.events = [];
  if (!dmState.tweespalt.leningen) dmState.tweespalt.leningen = {};
  return dmState.tweespalt;
}

function _tsCl(bedrag) {
  return toCl({ fl: bedrag?.fl || 0, kn: bedrag?.kn || 0, cl: bedrag?.cl || 0 });
}

function _tsFormatCl(cl) {
  const { fl, kn, cl: ce } = fromCl(cl);
  const parts = [];
  if (fl) parts.push(`${fl} fl`);
  if (kn) parts.push(`${kn} kn`);
  if (ce) parts.push(`${ce} cl`);
  return parts.length ? parts.join(', ') : '0 cl';
}

function _tsResolveEvent(dmState, event, io, campaignId = 'main') {
  let winnaarId = event.uitkomstModus === 'dm' ? event.uitkomst : null;

  if (!winnaarId) {
    const r = Math.random() * 100;
    let cum = 0;
    for (const opt of event.opties) {
      cum += opt.kans;
      if (r < cum) { winnaarId = opt.id; break; }
    }
    if (!winnaarId && event.opties.length) winnaarId = event.opties[event.opties.length - 1].id;
  }

  event.uitkomst = winnaarId;
  event.status = 'afgerond';

  const winnaarOptie = event.opties.find(o => o.id === winnaarId);
  if (!dmState.playerCurrency) dmState.playerCurrency = {};

  const uitbetalingen = {};
  for (const [charId, inzet] of Object.entries(event.inzetten || {})) {
    const gewonnen = inzet.optieId === winnaarId;
    uitbetalingen[charId] = { gewonnen, inzetCl: inzet.bedragCl };
    if (gewonnen && winnaarOptie) {
      const terug = inzet.bedragCl + inzet.bedragCl * winnaarOptie.payout;
      const pc = dmState.playerCurrency[charId] || { fl: 0, kn: 0, cl: 0 };
      dmState.playerCurrency[charId] = fromCl(toCl(pc) + terug);
      uitbetalingen[charId].uitbetaaldCl = terug;
    }
  }

  let gokLog = storage.readJSON('gok-log.json');
  if (!Array.isArray(gokLog)) gokLog = [];
  for (const [charId, ut] of Object.entries(uitbetalingen)) {
    const inzet = event.inzetten[charId];
    gokLog.push({
      timestamp:  new Date().toISOString(),
      characterId: charId,
      eventId:    event.id,
      eventNaam:  event.naam,
      optieNaam:  event.opties.find(o => o.id === inzet.optieId)?.naam || '',
      inzetCl:    inzet.bedragCl,
      gewonnen:   ut.gewonnen,
      uitbetaaldCl: ut.uitbetaaldCl || 0,
    });
  }
  storage.writeJSON('gok-log.json', gokLog);

  if (io) {
    io.to(campaignId).emit('tweespalt:uitslag', {
      eventId:     event.id,
      eventNaam:   event.naam,
      winnaarId,
      winnaarNaam: winnaarOptie?.naam || '',
      uitbetalingen,
    });
    for (const [charId, ut] of Object.entries(uitbetalingen)) {
      if (ut.gewonnen) {
        io.to(campaignId).emit('player:currency-updated', { characterId: charId, currency: dmState.playerCurrency[charId] });
      }
    }
  }

  return { winnaarOptie, uitbetalingen };
}

router.get('/tweespalt', attachRole, (req, res) => {
  const dmState = readDmState();
  const ts = _tsState(dmState);
  const io = req.app.get('io');
  const now = new Date();
  let needsSave = false;

  for (const event of ts.events) {
    if (event.status === 'open' && event.uitkomstModus === 'auto' && event.sluitTijd) {
      if (new Date(event.sluitTijd) <= now) {
        _tsResolveEvent(dmState, event, io, req.session?.campaignId || 'main');
        needsSave = true;
      }
    }
  }
  if (needsSave) storage.writeJSON('dm-state.json', dmState);

  const isDM = req.role === 'dm';
  const characterId = req.session.characterId;
  const currency = _effectiveCurrency(dmState, characterId);

  let lening = characterId ? (ts.leningen[characterId] || null) : null;
  if (lening) {
    const dagenVerlopen = (Date.now() - new Date(lening.aangegaan).getTime()) / (1000 * 60 * 60 * 24);
    const factor = Math.pow(1 + lening.rentePerDag / 100, dagenVerlopen);
    lening = { ...lening, huidigVerschuldigdCl: Math.ceil(lening.bedragCl * factor) };
  }

  // Namenlijst: gebruik de tafel met gevulde first/last arrays (bij voorkeur combined-type)
  const tablesData = storage.readJSON('tables.json');
  const nameTable = (tablesData.tables || []).find(t => t.type === 'combined' && (t.first?.length || t.last?.length))
                 || (tablesData.tables || []).find(t => t.first?.length || t.last?.length);
  const nameFirst = nameTable?.first || [];
  const nameLast  = nameTable?.last  || [];

  const events = ts.events.map(e => {
    const evt = {
      id: e.id, type: e.type, naam: e.naam, status: e.status,
      uitkomstModus: e.uitkomstModus, aangemaakt: e.aangemaakt,
      sluitTijd: e.sluitTijd, eenmalig: e.eenmalig || false,
      opties: e.opties,
      aantalInzetten: Object.keys(e.inzetten || {}).length,
    };
    if (e.status === 'afgerond' || isDM) evt.uitkomst = e.uitkomst;
    if (characterId) evt.mijnInzet = (e.inzetten || {})[characterId] || null;
    if (isDM) evt.inzetten = e.inzetten;
    return evt;
  });

  const tsMeta = storage.readJSON('meta.json').tweespalt || {};
  const config = { naam: tsMeta.naam || 'De Tweespalt', imageId: tsMeta.imageId || null, backdropId: tsMeta.backdropId || null };
  res.json({ events, currency, lening, nameFirst, nameLast, config });
});

router.post('/tweespalt/events', requireDM, (req, res) => {
  const { type, naam, uitkomstModus, uitkomst, opties, duurMinuten } = req.body;
  if (!naam?.trim() || !type || !Array.isArray(opties) || !opties.length)
    return res.status(400).json({ error: 'naam, type en opties vereist' });

  const dmState = readDmState();
  const ts = _tsState(dmState);

  const sluitTijd = uitkomstModus === 'auto'
    ? new Date(Date.now() + (Number(duurMinuten) || 60) * 60 * 1000).toISOString()
    : null;

  const event = {
    id:           'ts_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type,
    naam:         naam.trim(),
    uitkomstModus: uitkomstModus || 'auto',
    uitkomst:     uitkomstModus === 'dm' ? (uitkomst || null) : null,
    status:       'open',
    sluitTijd,
    aangemaakt:   new Date().toISOString(),
    eenmalig:     type === 'godenwedden',
    opties:       opties.map((o, i) => ({
      id:     'opt_' + i + '_' + Math.random().toString(36).slice(2, 5),
      naam:   String(o.naam || '').trim(),
      kans:   Number(o.kans) || 0,
      payout: Number(o.payout) || 1,
    })),
    inzetten: {},
  };

  ts.events.push(event);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('tweespalt:updated');
  res.status(201).json(event);
});

router.put('/tweespalt/events/:id', requireDM, (req, res) => {
  const dmState = readDmState();
  const ts = _tsState(dmState);
  const event = ts.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event niet gevonden' });

  const { naam, uitkomst, uitkomstModus, opties, duurMinuten } = req.body;
  if (naam !== undefined) event.naam = naam.trim();
  if (uitkomst !== undefined) event.uitkomst = uitkomst;
  if (uitkomstModus !== undefined) {
    event.uitkomstModus = uitkomstModus;
    if (uitkomstModus === 'auto' && duurMinuten) {
      event.sluitTijd = new Date(Date.now() + Number(duurMinuten) * 60 * 1000).toISOString();
    }
  }
  if (Array.isArray(opties)) {
    event.opties = opties.map((o, i) => ({
      id:     o.id || ('opt_' + i + '_' + Math.random().toString(36).slice(2, 5)),
      naam:   String(o.naam || '').trim(),
      kans:   Number(o.kans) || 0,
      payout: Number(o.payout) || 1,
    }));
  }

  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('tweespalt:updated');
  res.json(event);
});

router.delete('/tweespalt/events/:id', requireDM, (req, res) => {
  const dmState = readDmState();
  const ts = _tsState(dmState);
  const idx = ts.events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Event niet gevonden' });

  const event = ts.events[idx];
  if (event.status === 'open') {
    if (!dmState.playerCurrency) dmState.playerCurrency = {};
    for (const [charId, inzet] of Object.entries(event.inzetten || {})) {
      const pc = dmState.playerCurrency[charId] || { fl: 0, kn: 0, cl: 0 };
      dmState.playerCurrency[charId] = fromCl(toCl(pc) + inzet.bedragCl);
    }
  }

  ts.events.splice(idx, 1);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('tweespalt:updated');
  res.json({ ok: true });
});

router.post('/tweespalt/events/:id/wedden', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const { optieId, bedrag } = req.body;
  if (!optieId || !bedrag) return res.status(400).json({ error: 'optieId en bedrag vereist' });

  const dmState = readDmState();
  const ts = _tsState(dmState);
  const event = ts.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event niet gevonden' });
  if (event.status !== 'open') return res.status(400).json({ error: 'Event is gesloten' });

  const optie = event.opties.find(o => o.id === optieId);
  if (!optie) return res.status(404).json({ error: 'Optie niet gevonden' });
  if (event.inzetten?.[characterId]) return res.status(400).json({ error: 'Je hebt al ingezet' });

  const bedragCl = _tsCl(bedrag);
  if (bedragCl <= 0) return res.status(400).json({ error: 'Inzet moet groter zijn dan 0' });

  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  if (toCl(pc) < bedragCl) return res.status(400).json({ error: 'Onvoldoende saldo', code: 'te_weinig' });

  dmState.playerCurrency[characterId] = fromCl(toCl(pc) - bedragCl);
  if (!event.inzetten) event.inzetten = {};
  event.inzetten[characterId] = { optieId, bedragCl, geplaatst: new Date().toISOString() };

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('tweespalt:updated');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  res.json({ ok: true, currency: dmState.playerCurrency[characterId] });
});

router.post('/tweespalt/events/:id/uitslag', requireDM, (req, res) => {
  const dmState = readDmState();
  const ts = _tsState(dmState);
  const event = ts.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event niet gevonden' });
  if (event.status !== 'open') return res.status(400).json({ error: 'Event al afgerond' });

  if (event.uitkomstModus === 'dm' && req.body.uitkomst) event.uitkomst = req.body.uitkomst;

  const io = req.app.get('io');
  const result = _tsResolveEvent(dmState, event, io, req.session?.campaignId || 'main');
  storage.writeJSON('dm-state.json', dmState);

  // Haastig gekrabbeld briefje aan elke wedder met de uitslag
  const winNaam = result.winnaarOptie?.naam || '';
  for (const [charId, ut] of Object.entries(result.uitbetalingen || {})) {
    const inzet = event.inzetten?.[charId];
    const mijnOptie = event.opties.find(o => o.id === inzet?.optieId)?.naam || '';
    const tekst = ut.gewonnen
      ? `Gewonnen! "${event.naam}" — uitkomst: ${winNaam}. Je zette ${_tsFormatCl(ut.inzetCl)} op ${mijnOptie} en haalt ${_tsFormatCl(ut.uitbetaaldCl || 0)} op. Kom je winst halen, vriend.`
      : `Pech gehad. "${event.naam}" — uitkomst: ${winNaam}. Je inzet van ${_tsFormatCl(ut.inzetCl)} op ${mijnOptie} ben je kwijt. Volgende keer beter.`;
    _bezorgBrief(req, charId, { titel: event.naam, tekst, afzender: 'De Tweespalt', thema: 'tweespalt' });
  }

  res.json({ ok: true, winnaarId: event.uitkomst, ...result });
});

router.post('/tweespalt/leen', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });

  const { bedrag } = req.body;
  if (!bedrag) return res.status(400).json({ error: 'bedrag vereist' });

  const bedragCl = _tsCl(bedrag);
  if (bedragCl <= 0) return res.status(400).json({ error: 'Bedrag moet groter zijn dan 0' });

  const dmState = readDmState();
  const ts = _tsState(dmState);
  if (ts.leningen[characterId]) return res.status(400).json({ error: 'Je hebt al een openstaande lening bij Taevin' });

  const lening = { bedragCl, aangegaan: new Date().toISOString(), rentePerDag: 30 };
  ts.leningen[characterId] = lening;

  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  dmState.playerCurrency[characterId] = fromCl(toCl(pc) + bedragCl);

  const bedragFormatted = _tsFormatCl(bedragCl);
  const iouNaam = '📜 Schuldbewijs — Taevin Woekeling';
  const iouNote = `Bedrag: ${bedragFormatted}. Woekerrente: 30% per dag. "Ik weet je te vinden, vriend."`;

  if (!dmState.playerItems) dmState.playerItems = {};
  if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];
  dmState.playerItems[characterId].push({
    id:   'ts_leen_' + Date.now(),
    name: iouNaam,
    note: iouNote,
  });

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  io.to(req.session?.campaignId||'main').emit('player:items-updated', { characterId });
  res.json({ ok: true, currency: dmState.playerCurrency[characterId], lening });
});

router.get('/tweespalt/log', requireDM, (req, res) => {
  let log = storage.readJSON('gok-log.json');
  if (!Array.isArray(log)) log = [];
  res.json(log);
});

// ── Quest States (per party) ─────────────────────────────────────────────────

function _readQuestStates(groepId) {
  const fp = path.join(storage.DATA_DIR, 'quest-states', `${groepId}.json`);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return {}; }
}

function _writeQuestStates(groepId, data) {
  const dir = path.join(storage.DATA_DIR, 'quest-states');
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `${groepId}.json`);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fp);
}

function _getQuestGroepId(req) {
  const dmState = readDmState();
  // req.role is alleen gezet door attachRole; requireDM zet het niet — gebruik session als fallback
  const role   = req.role ?? req.session?.role;
  const charId = req.characterId ?? req.session?.characterId;
  if (role === 'dm') return dmState.activeGroup;
  return _playerGroupId(dmState, charId) || null;
}

// ── Chapter Visibility (per party) ──────────────────────────────────────────
// Opgeslagen als data/campaigns/<id>/chapter-visibility.json:
//   { groepId: { h3: false, h4: false } }
// Ontbrekende groep of ontbrekend chapter-id = zichtbaar (true is de default).

function _cvPath() {
  return path.join(storage.DATA_DIR, 'chapter-visibility.json');
}

function _readChapterVisibility() {
  try { return JSON.parse(fs.readFileSync(_cvPath(), 'utf8')); } catch { return {}; }
}

function _writeChapterVisibility(data) {
  const tmp = _cvPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, _cvPath());
}

// Is een hoofdstuk zichtbaar voor een groep? Default: ja.
function _chapterVisible(cv, groepId, chapterId) {
  return cv[groepId]?.[chapterId] !== false;
}

// GET /chapter-visibility — DM: retourneert volledig object voor alle groepen
router.get('/chapter-visibility', requireDM, (req, res) => {
  res.json(_readChapterVisibility());
});

// PUT /chapter-visibility/:groepId/:chapterId  { visible: true|false }
router.put('/chapter-visibility/:groepId/:chapterId', requireDM, (req, res) => {
  const { groepId, chapterId } = req.params;
  const visible = req.body.visible !== false; // default true
  const dmState = readDmState();
  if (!dmState.groups[groepId]) return res.status(404).json({ error: 'Groep niet gevonden' });
  const cv = _readChapterVisibility();
  if (!cv[groepId]) cv[groepId] = {};
  if (visible) {
    delete cv[groepId][chapterId]; // default = visible, dus verwijder de expliciete false
    if (Object.keys(cv[groepId]).length === 0) delete cv[groepId]; // groep opruimen als leeg
  } else {
    cv[groepId][chapterId] = false;
  }
  _writeChapterVisibility(cv);
  req.app.get('io').to(req.session?.campaignId||'main').emit('chapter-visibility:updated');
  res.json({ ok: true, groepId, chapterId, visible });
});

// ── Party Board ──────────────────────────────────────────────────────────────

function _readPartyBoard(groepId) {
  const fp = path.join(storage.DATA_DIR, 'party-boards', `${groepId}.json`);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return { nodes: [], edges: [] }; }
}

function _writePartyBoard(groepId, data) {
  const dir = path.join(storage.DATA_DIR, 'party-boards');
  fs.mkdirSync(dir, { recursive: true });
  const fp  = path.join(dir, `${groepId}.json`);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fp);
}

function _getBoardGroepId(req) {
  const dmState = readDmState();
  if (req.role === 'dm') return dmState.activeGroup;
  return _playerGroupId(dmState, req.characterId) || null;
}

// GET /api/party-board
router.get('/party-board', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const board    = _readPartyBoard(groepId);
  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  const g        = getGroup(dmState, groepId);

  const enriched = (board.nodes || []).map(node => {
    if (!node.entityId || !node.entityType) return node;
    const ent      = (entities[node.entityType] || []).find(e => e.id === node.entityId);
    const vis      = g.visibility?.[node.entityId]  || 'hidden';
    const deceased = node.entityType === 'personages' && !!(g.deceased?.[node.entityId]);
    return {
      ...node,
      entityName:       ent?.name || node.entityName || node.entityId,
      hasImage:         !!(ent?.data?.imgFocus),
      entityVisibility: vis,      // 'visible' | 'vague' | 'hidden'
      entityDeceased:   deceased,
    };
  });

  res.json({ groepId, nodes: enriched, edges: board.edges || [] });
});

// GET /api/party-board/entities — zoekbare entiteiten (zichtbaar voor deze groep)
router.get('/party-board/entities', attachRole, (req, res) => {
  const dmState = readDmState();
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const entities = storage.readJSON('entities.json');
  const g        = getGroup(dmState, groepId);
  const result   = [];

  for (const type of ['personages', 'locaties', 'organisaties']) {
    for (const e of (entities[type] || [])) {
      const vis = g.visibility[e.id] || 'hidden';
      if (vis === 'hidden') continue;
      result.push({ id: e.id, name: e.name, type, hasImage: !!(e.data?.imgFocus) });
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  res.json(result);
});

// POST /api/party-board/node
router.post('/party-board/node', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const { entityId, entityType, text } = req.body;
  if (!entityId && !text) return res.status(400).json({ error: 'entityId of text vereist' });

  const board = _readPartyBoard(groepId);
  if (entityId && (board.nodes || []).some(n => n.entityId === entityId))
    return res.status(409).json({ error: 'Al op het bord' });

  const node = {
    id:         `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    entityId:   entityId   || null,
    entityType: entityType || null,
    text:       text       || null,
    notes:      '',
    x:          req.body.x ?? 100 + Math.random() * 600,
    y:          req.body.y ?? 100 + Math.random() * 400,
  };
  board.nodes = board.nodes || [];
  board.nodes.push(node);
  _writePartyBoard(groepId, board);

  if (entityId && entityType) {
    const entities = storage.readJSON('entities.json');
    const ent = (entities[entityType] || []).find(e => e.id === entityId);
    node.entityName = ent?.name || entityId;
    node.hasImage   = !!(ent?.data?.imgFocus);
  }

  req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json(node);
});

// DELETE /api/party-board/node/:id
router.delete('/party-board/node/:id', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const board  = _readPartyBoard(groepId);
  const nodeId = req.params.id;
  board.nodes  = (board.nodes || []).filter(n => n.id !== nodeId);
  board.edges  = (board.edges || []).filter(e => e.from !== nodeId && e.to !== nodeId);
  _writePartyBoard(groepId, board);

  req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json({ ok: true });
});

// PUT /api/party-board/node/:id
router.put('/party-board/node/:id', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const board = _readPartyBoard(groepId);
  const node  = (board.nodes || []).find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Node niet gevonden' });

  const changed = [];
  if (req.body.notes !== undefined) { node.notes = req.body.notes; changed.push('notes'); }
  if (req.body.text  !== undefined) { node.text  = req.body.text;  changed.push('text'); }
  if (req.body.x     !== undefined)   node.x     = req.body.x;
  if (req.body.y     !== undefined)   node.y     = req.body.y;

  _writePartyBoard(groepId, board);
  if (changed.length) req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json({ ok: true });
});

// POST /api/party-board/edge
router.post('/party-board/edge', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const { from, to, label, color } = req.body;
  if (!from || !to || from === to) return res.status(400).json({ error: 'Ongeldige van/naar' });

  const board = _readPartyBoard(groepId);
  const edge  = {
    id:    `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from, to,
    label: label || '',
    color: color || '#cc2222',
  };
  board.edges = board.edges || [];
  board.edges.push(edge);
  _writePartyBoard(groepId, board);

  req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json(edge);
});

// DELETE /api/party-board/edge/:id
router.delete('/party-board/edge/:id', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const board = _readPartyBoard(groepId);
  board.edges = (board.edges || []).filter(e => e.id !== req.params.id);
  _writePartyBoard(groepId, board);

  req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json({ ok: true });
});

// PUT /api/party-board/edge/:id
router.put('/party-board/edge/:id', attachRole, (req, res) => {
  const groepId = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const board = _readPartyBoard(groepId);
  const edge  = (board.edges || []).find(e => e.id === req.params.id);
  if (!edge) return res.status(404).json({ error: 'Verbinding niet gevonden' });

  if (req.body.label !== undefined) edge.label = req.body.label;
  if (req.body.color !== undefined) edge.color = req.body.color;

  _writePartyBoard(groepId, board);
  req.app.get('io').to(req.session?.campaignId||'main').emit('party-board:updated', { groepId });
  res.json({ ok: true });
});

// PUT /api/party-board/positions
router.put('/party-board/positions', attachRole, (req, res) => {
  const groepId   = _getBoardGroepId(req);
  if (!groepId) return res.status(403).json({ error: 'Geen groep gevonden' });

  const { positions } = req.body;
  if (!positions) return res.status(400).json({ error: 'positions vereist' });

  const board = _readPartyBoard(groepId);
  (board.nodes || []).forEach(n => {
    if (positions[n.id]) { n.x = positions[n.id].x; n.y = positions[n.id].y; }
  });
  _writePartyBoard(groepId, board);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════
// ── Dungeon Maps ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function _readDungeons() {
  const d = storage.readJSON('dungeon-maps.json');
  return Array.isArray(d) ? d : (d.maps || []);
}
function _writeDungeons(maps) {
  storage.writeJSON('dungeon-maps.json', { maps });
}

// GET /api/dungeons — voor DM: alles; voor speler: alleen maps waartoe groep toegang heeft
router.get('/dungeons', attachRole, (req, res) => {
  const maps    = _readDungeons();
  const isDM    = req.role === 'dm';
  if (isDM) return res.json(maps);

  const entities = storage.readJSON('entities.json');
  const dmState  = readDmState();
  const charId   = req.characterId;
  const char     = (entities.personages || []).find(e => e.id === charId);
  const groupId  = char?.data?.groep || null;
  if (!groupId) return res.json([]);

  // Speler ziet alleen maps waartoe zijn groep toegang heeft
  const visible = maps
    .filter(m => (m.partyAccess || []).includes(groupId))
    .map(m => {
      const groupReveals = new Set(m.reveals?.[groupId] || []);
      return {
        id: m.id, name: m.name, hoofdstukId: m.hoofdstukId, fileId: m.fileId,
        partyCompleted: m.partyCompleted || [],
        rooms: (m.rooms || []).map(r => ({
          id: r.id, name: r.name, shape: r.shape, points: r.points,
          // Alleen zichtbare conditie-iconen voor spelers
          conditions: (r.conditions || []).filter(c => c.visible),
        })),
        // Verbindingen: toon als minstens één verbonden kamer onthuld is
        connections: (m.connections || []).filter(c =>
          groupReveals.has(c.fromId) || groupReveals.has(c.toId)
        ),
        reveals: { [groupId]: (m.reveals?.[groupId] || []) },
      };
    });
  res.json(visible);
});

// POST /api/dungeons — nieuwe dungeon map aanmaken
router.post('/dungeons', requireDM, (req, res) => {
  const { name, hoofdstukId, fileId } = req.body;
  if (!name) return res.status(400).json({ error: 'Naam vereist' });
  const maps = _readDungeons();
  const map = {
    id: 'dng_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name, hoofdstukId: hoofdstukId || '', fileId: fileId || '',
    rooms: [], partyAccess: [], reveals: {},
  };
  maps.push(map);
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:updated');
  res.json(map);
});

// PUT /api/dungeons/:id — naam / hoofdstuk / fileId bijwerken
router.put('/dungeons/:id', requireDM, (req, res) => {
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.name        !== undefined) map.name        = req.body.name;
  if (req.body.hoofdstukId !== undefined) map.hoofdstukId = req.body.hoofdstukId;
  if (req.body.fileId      !== undefined) map.fileId      = req.body.fileId;
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:updated');
  res.json(map);
});

// DELETE /api/dungeons/:id
router.delete('/dungeons/:id', requireDM, (req, res) => {
  let maps = _readDungeons();
  maps = maps.filter(m => m.id !== req.params.id);
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:updated');
  res.json({ ok: true });
});

// PUT /api/dungeons/:id/rooms — volledige kamerlijst opslaan (na tekensessie)
// Geen socket-emit: kamertekeningen zijn DM-only. Spelers zien alleen onthulde kamers
// via het reveal-endpoint. De DM's lokale _renderSvg() herlaadt de SVG al direct.
router.put('/dungeons/:id/rooms', requireDM, (req, res) => {
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  map.rooms       = req.body.rooms       || [];
  map.connections = req.body.connections || [];
  _writeDungeons(maps);
  res.json({ ok: true });
});

// POST /api/dungeons/:id/reveal — onthul een kamer voor de actieve groep
router.post('/dungeons/:id/reveal', requireDM, (req, res) => {
  const { roomId, groupId } = req.body;
  if (!roomId || !groupId) return res.status(400).json({ error: 'roomId en groupId vereist' });
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  if (!map.reveals)            map.reveals = {};
  if (!map.reveals[groupId])   map.reveals[groupId] = [];
  if (!map.reveals[groupId].includes(roomId)) {
    map.reveals[groupId].push(roomId);
  }
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:revealed', { dungeonId: map.id, groupId, roomId });
  res.json({ ok: true });
});

// DELETE /api/dungeons/:id/reveal — verberg een kamer weer voor de actieve groep
router.delete('/dungeons/:id/reveal', requireDM, (req, res) => {
  const { roomId, groupId } = req.body;
  if (!roomId || !groupId) return res.status(400).json({ error: 'roomId en groupId vereist' });
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  if (map.reveals?.[groupId]) {
    map.reveals[groupId] = map.reveals[groupId].filter(id => id !== roomId);
  }
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:hidden', { dungeonId: map.id, groupId, roomId });
  res.json({ ok: true });
});

// PUT /api/dungeons/:id/party-access — stel partyAccess + partyCompleted in
router.put('/dungeons/:id/party-access', requireDM, (req, res) => {
  const { partyAccess, partyCompleted = [] } = req.body;
  if (!Array.isArray(partyAccess)) return res.status(400).json({ error: 'partyAccess array vereist' });
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  map.partyAccess   = partyAccess;
  map.partyCompleted = partyCompleted;
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:updated');
  res.json({ ok: true });
});

// ── Encounters (voorbereide gevechten) ──

router.get('/encounters', requireDM, (req, res) => {
  const data = storage.readJSON('encounters.json');
  res.json(data.encounters || []);
});

router.post('/encounters', requireDM, (req, res) => {
  const data = storage.readJSON('encounters.json');
  if (!data.encounters) data.encounters = [];
  const enc = {
    id:           'enc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name:         req.body.name         || 'Nieuw gevecht',
    akteId:       req.body.akteId       || null,
    backdropId:   req.body.backdropId   || null,
    canvasPreset: req.body.canvasPreset || null,
    canvasColors: req.body.canvasColors || null,
    monsters:     req.body.monsters     || [],
  };
  data.encounters.push(enc);
  storage.writeJSON('encounters.json', data);
  res.status(201).json(enc);
});

router.put('/encounters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('encounters.json');
  const idx = (data.encounters || []).findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
  data.encounters[idx] = { ...data.encounters[idx], ...req.body, id: req.params.id };
  storage.writeJSON('encounters.json', data);
  res.json(data.encounters[idx]);
});

router.delete('/encounters/:id', requireDM, (req, res) => {
  const data = storage.readJSON('encounters.json');
  data.encounters = (data.encounters || []).filter(e => e.id !== req.params.id);
  storage.writeJSON('encounters.json', data);
  res.json({ ok: true });
});

router.post('/encounters/:id/start', requireDM, (req, res) => {
  const data      = storage.readJSON('encounters.json');
  const enc       = (data.encounters || []).find(e => e.id === req.params.id);
  if (!enc) return res.status(404).json({ error: 'Niet gevonden' });

  const dmState       = storage.readJSON('dm-state.json');
  const entities      = storage.readJSON('entities.json');
  const monstersData  = storage.readJSON('monsters.json');
  const monstersList  = Array.isArray(monstersData) ? monstersData : (monstersData?.monsters || []);
  const activeGroupId = dmState.activeGroup || null;

  const combatants = [];
  const ts = () => Date.now() + Math.random();

  // Spelers van de actieve party
  const players = (entities.personages || []).filter(p => {
    if ((p.subtype || '').toLowerCase() !== 'speler') return false;
    if (activeGroupId && p.data?.groep !== activeGroupId) return false;
    return true;
  });
  for (const p of players) {
    const pHpData = (dmState.playerHp || {})[p.id] || {};
    const pBaseHp = parseInt(p.stats?.hp) || 10;
    const pCurHp  = pHpData.current != null ? pHpData.current : pBaseHp;
    // Als current > max (corrupt door oude bug): gebruik current als max
    const pMaxHp  = pHpData.max != null ? Math.max(pHpData.max, pCurHp) : pBaseHp;
    const pAc = (dmState.playerProfiles || {})[p.id]?.ac || '';
    combatants.push({
      id:         'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name:       p.name,
      entityId:   p.id,
      type:       'player',
      initiative: 10,
      hp:         pCurHp,
      maxHp:      pMaxHp,
      ac:         pAc,
      conditions: [],
    });
  }

  // Actieve medestanders (personages met stats en type ally in dm-state)
  const activeAllies = dmState.activeAllies || [];
  for (const allyId of activeAllies) {
    const ally = (entities.personages || []).find(p => p.id === allyId);
    if (!ally) continue;
    const aStats = ally.stats || {};
    combatants.push({
      id:         'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name:       ally.name,
      entityId:   ally.id,
      type:       'ally',
      initiative: parseInt(aStats.initiative) || 10,
      hp:         parseInt(aStats.hp)         || 10,
      maxHp:      parseInt(aStats.hp)         || 10,
      conditions: [],
    });
  }

  // Monsters uit de encounter (count > 1 → genummerd)
  for (const row of (enc.monsters || [])) {
    const count = Math.max(1, parseInt(row.count) || 1);
    const preset = row.monsterId ? monstersList.find(m => m.id === row.monsterId) : null;
    const mAc = preset?.statblock?.ac || '';
    for (let i = 1; i <= count; i++) {
      const suffix = count > 1 ? ` ${i}` : '';
      combatants.push({
        id:         'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name:       (row.name || 'Monster') + suffix,
        presetId:   row.monsterId || null,
        type:       'monster',
        initiative: parseInt(row.initiative) || 0,
        hp:         parseInt(row.hp)         || 10,
        maxHp:      parseInt(row.hp)         || 10,
        ac:         mAc,
        conditions: [],
      });
    }
  }

  // Sorteren op initiative
  combatants.sort((a, b) => b.initiative - a.initiative);

  const prevCombat = storage.readJSON('combat.json');
  _flushPlayerHpToDmState(prevCombat, req.app.get('io'), req.session?.campaignId || 'main');

  const combat = {
    active:       false,
    round:        1,
    currentTurn:  0,
    combatants,
    backdropId:   enc.backdropId   || null,
    canvasPreset: enc.canvasPreset || null,
    canvasColors: enc.canvasColors || null,
    log:          [`⚔️ Encounter geladen: ${enc.name}`],
  };
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('combat:updated', combat);
  res.json(combat);
});

module.exports = router;
