const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { spawn } = require('child_process');
const storage = require('../lib/storage');
const mediaUsage = require('../lib/media-usage');
const { requireDM, attachRole } = require('./auth');
const { buildSnapshot, buildCampagneboek } = require('../lib/snapshot');
const { sheetHtml } = require('../lib/character-sheet');

let _sharp = null;
try { _sharp = require('sharp'); } catch {}

const router = express.Router();

// #24: gescheiden upload-instances met whitelist-fileFilter i.p.v. één
// ongefilterde upload. Media (afbeeldingen/audio/video/pdf) en tekst (.md-import)
// hebben verschillende toegestane types en groottes.
const MEDIA_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf', 'video/mp4', 'video/webm',
  // Audio — inclusief Apple-formaten (.m4a/AAC) die Mac/iOS standaard exporteert.
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/x-flac', 'audio/webm',
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
  if (hex(0x66, 0x4c, 0x61, 0x43)) return true;                          // FLAC ('fLaC')
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true;              // MP3/AAC-ADTS (frame sync)
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
    afwezig:     g.afwezig || [],
  }));
}

// ── Aanwezigheid ──
// Wie zit er vanavond aan tafel? We bewaren de áfwezigen, niet de aanwezigen:
// dan is een nieuw personage automatisch van de partij en hoeft er nergens iets
// bijgewerkt te worden als de party groeit. De lijst geldt tot de DM 'm wijzigt.
function _afwezigen(dmState, groepId) {
  return new Set(dmState.groups?.[groepId]?.afwezig || []);
}

// De spelers van een groep die vanavond meedoen. Gebruik dit overal waar het om
// wát er aan tafel gebeurt gaat — gevecht, rust, loot. NIET voor administratie
// die de hele party betreft (character sheets, berichten, factieboons): een
// speler die er even niet is, blijft lid van de party.
function _aanwezigeSpelers(dmState, groepId, personages) {
  const weg = _afwezigen(dmState, groepId);
  return (personages || []).filter(e => e.subtype === 'speler' && e.data?.groep === groepId && !weg.has(e.id));
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
    // Zegen-mechaniek staat nu in de beschrijving; match exact (oud: effect-prefix). Fallback op effect voor de overgang.
    (goddelijkType !== 'zegen' || (e.data?.desc || '') === effectText || (e.data?.effect || '').startsWith(effectText.split(':')[0]))
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
    const pg = getGroup(dmState, playerGid);
    list = list.map(e => {
      const fe = filterEntityForPlayer(e, dmState, playerGid);
      if (fe) fe._gockOnderzocht = !!pg.gockOnderzocht?.[e.id];
      return fe;
    }).filter(Boolean);
  } else {
    list = list.map(e => ({
      ...e,
      _visibility:   g.visibility[e.id]    || 'hidden',
      _secretReveal: !!g.secretReveals[e.id],
      _deceased:     !!(g.deceased?.[e.id]),
      _dmNote:       dmState.dmNotes[e.id]  || '',
      _gockOnderzocht: !!g.gockOnderzocht?.[e.id],
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
  // Bestiarium: wezens die de groep al kent (≥ naam) van alle bestiarium-monsters.
  const bestMonsters = (storage.readJSON('monsters.json').monsters || []).filter(m => m.inBestiarium !== false);
  const bestKennis   = g?.bestiarium || {};
  out.bestiarium = { ontdekt: bestMonsters.filter(m => bestKennis[m.id]).length, totaal: bestMonsters.length };
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
  // Spelerskaarten: portret-bestand NIET wissen — het wordt hergebruikt in party-weergave,
  // berichten en de tempel, en moet bij herstel uit de prullenbak weer beschikbaar zijn.
  // Voor de rest: guarded delete (alleen wissen als het bestand nergens meer gebruikt wordt).
  const _isPlayerCard = type === 'personages' && dying.subtype === 'speler';
  if (!_isPlayerCard) {
    _deleteFileIfUnused(id);                                   // oud portret op /files/{id}
    if (dying.data?.imageId) _deleteFileIfUnused(dying.data.imageId);  // bibliotheek-portret
  }
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
function _bezorgBrief(req, cid, { titel = '', tekst = '', afzender = '', thema = '', entityId = null, entityType = null, datum = '', embleem = '', kleur = '', kop = '', cinematic = false }) {
  if (!cid || !tekst) return null;
  const berichten = storage.readJSON('berichten.json') || {};
  if (!berichten[cid]) berichten[cid] = [];
  const now = Date.now();
  const post = {
    id: `post_${now}_${Math.random().toString(36).substr(2, 4)}`,
    type: 'brief', titel, tekst, afzender, entityId, entityType, datum, thema,
    embleem: embleem || undefined, kleur: kleur || undefined, kop: kop || undefined, cinematic: cinematic || undefined,
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
      cinematic: !!req.body.cinematic,   // grote verzegelde-brief-reveal bij de speler
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

  // Grote reveal op het gedeelde tablet-scherm (dat geen speler-socket is): broadcast
  // de brief naar de campagne-room; alleen display-mode reageert erop (spelers kregen
  // 'm al via hun eigen socket hierboven).
  if (req.body.cinematic) {
    io.to(req.session?.campaignId || 'main').emit('brief:display', {
      titel: titel?.trim() || '', tekst: tekst.trim(), afzender: afzenderDef,
      datum: datum?.trim() || '', thema: veiligThema, cinematic: true,
    });
  }

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
    // Korting/humeur leven in de groep van de speler zelf, niet de actieve DM-groep
    const _pg = _characterId ? getGroup(dmState, _playerGroupId(dmState, _characterId)) : g;
    const _tempDiscount = _characterId ? _pg.shopTempDiscount?.[shopId]?.[_characterId] : null;
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
      onderhandel: _onderhandelStatus(_pg, shopId, _characterId, winkelConfig),
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
  // Korting/humeur leven in de groep van de speler zelf, niet de actieve DM-groep
  const _pg = _characterId ? getGroup(dmState, _playerGroupId(dmState, _characterId)) : g;
  const _tempDiscount = _characterId ? _pg.shopTempDiscount?.[shopId]?.[_characterId] : null;
  const _discountActief = _tempDiscount && new Date(_tempDiscount.geldigTot) > new Date() && (_tempDiscount.percent || 0) !== 0;
  const discountPct = _discountActief ? _tempDiscount.percent : 0;
  const sfeerTekst = winkelConfig.sfeerTekst || '';
  res.json({
    items: filtered, roterend: true, geldigTot: rotatie.geldigTot, sfeerTekst, discountPct,
    onderhandel: _onderhandelStatus(_pg, shopId, _characterId, winkelConfig),
  });
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
  let winkelConfig = {};
  try { winkelConfig = shop.data?.winkelConfig ? JSON.parse(shop.data.winkelConfig) : {}; } catch {}

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

    // Klant-loop: een betaalde aankoop stemt de winkelier milder (max 1x per rotatie)
    const moodEntry = g.shopMood?.[shopId]?.[characterId];
    const windowStart = _shopWindowStart(g, shopId, winkelConfig);
    if (!_inHuidigWindow(moodEntry?.laatsteKlantBonus, windowStart)) {
      _bumpShopMood(g, shopId, characterId, 1, req.playerName || 'Speler');
      g.shopMood[shopId][characterId].laatsteKlantBonus = new Date().toISOString();
    }
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

// ── Winkel-inkoop: hulpfuncties ──────────────────────────────────────────
// Een winkel koopt voorwerpen in als winkelConfig.koopt actief is. Per winkel
// kan een set categorieën (itemType) ingesteld zijn; leeg = alle categorieën.
function _winkelKoopConfig(winkelConfig) {
  const koopt = winkelConfig.koopt === true || winkelConfig.koopt === 'true';
  const ratio = Math.min(100, Math.max(1, parseInt(winkelConfig.koopRatio) || 50));
  let categorieen = [];
  if (Array.isArray(winkelConfig.koopCategorieen)) categorieen = winkelConfig.koopCategorieen.filter(Boolean);
  return { koopt, ratio, categorieen };
}

// Bepaalt of één voorwerp-entiteit verkoopbaar is + de reden als dat niet kan.
function _voorwerpVerkoopbaar(vw, koopCfg) {
  const d = vw?.data || {};
  if (!vw) return { ok: false, reden: 'Onbekend voorwerp' };
  // Gebonden categorieën: tempel-zegeningen (Blessing), factie-gunsten (Boon) en class-features.
  if (['Blessing', 'Boon', 'Feature'].includes(d.itemType)) return { ok: false, reden: 'Gebonden' };
  if (d.nietVerkoopbaar === 'true' || d.nietVerkoopbaar === true) return { ok: false, reden: 'Niet verkoopbaar' };
  const waarde = parsePrijs(d.prijs);
  if (!waarde || toCl(waarde) <= 0) return { ok: false, reden: 'Geen waarde' };
  if (koopCfg.categorieen.length && !koopCfg.categorieen.includes(d.itemType || '')) {
    return { ok: false, reden: `Koopt geen ${d.itemType || 'dit type'}` };
  }
  const aanbodCl = Math.max(1, Math.round(toCl(waarde) * koopCfg.ratio / 100));
  return { ok: true, aanbodCl };
}

// ── Winkelier-humeur ────────────────────────────────────────────────────────
// Persistent humeur per winkel per character (-3 t/m +3), opgeslagen in
// g.shopMood[shopId][characterId]. Verval: 1 stap richting neutraal per dag,
// lui berekend bij het lezen (geen cron). Beïnvloedt de onderhandel-DC en
// blokkeert onderhandelen bij 'vijandig'.
const MOOD_MIN = -3, MOOD_MAX = 3;
const MOOD_VERVAL_MS = 24 * 3600000;

function _moodTier(score) {
  if (score <= -2) return 'vijandig';
  if (score === -1) return 'stug';
  if (score === 0) return 'neutraal';
  if (score === 1) return 'vriendelijk';
  return 'hartelijk';
}

const MOOD_DC_MOD = { vijandig: 0, stug: 2, neutraal: 0, vriendelijk: -2, hartelijk: -4 };
const MOOD_TEKST = {
  vijandig:    'De winkelier doet alsof je lucht bent.',
  stug:        'De winkelier kijkt je stug aan.',
  neutraal:    '',
  vriendelijk: 'De winkelier knikt je vriendelijk toe.',
  hartelijk:   'De winkelier begroet je hartelijk.',
};

// Leest het humeur met verval toegepast; muteert niets.
function _getShopMood(g, shopId, characterId) {
  const entry = g.shopMood?.[shopId]?.[characterId];
  if (!entry) return { score: 0, entry: null };
  let score = entry.score || 0;
  const sinds = new Date(entry.laatsteUpdate || 0).getTime();
  const stappen = Math.floor((Date.now() - sinds) / MOOD_VERVAL_MS);
  if (stappen > 0 && score !== 0) {
    score = score > 0 ? Math.max(0, score - stappen) : Math.min(0, score + stappen);
  }
  return { score, entry };
}

// Past delta toe op het (vervallen) humeur en slaat het resultaat op.
function _bumpShopMood(g, shopId, characterId, delta, playerName) {
  if (!g.shopMood) g.shopMood = {};
  if (!g.shopMood[shopId]) g.shopMood[shopId] = {};
  const { score, entry } = _getShopMood(g, shopId, characterId);
  const nieuw = Math.min(MOOD_MAX, Math.max(MOOD_MIN, score + delta));
  g.shopMood[shopId][characterId] = {
    ...(entry || {}),
    score: nieuw,
    laatsteUpdate: new Date().toISOString(),
    ...(playerName ? { playerName } : {}),
  };
  return nieuw;
}

// Begin van het huidige onderhandel-window: de lopende rotatie, of anders
// een glijdend window van 24 uur. Eén onderhandelpoging en één klantbonus
// per window.
function _shopWindowStart(g, shopId, winkelConfig) {
  if (winkelConfig.roterend) {
    const deelGroep = winkelConfig.deelGroep?.trim() || shopId;
    const rotatie = g.shopRotatie?.[deelGroep];
    if (rotatie?.geldigTot) {
      const refreshMs = Math.max(1, parseFloat(winkelConfig.refreshUren) || 24) * 3600000;
      const eind = new Date(rotatie.geldigTot).getTime();
      if (eind > Date.now()) return eind - refreshMs;
    }
  }
  return Date.now() - 24 * 3600000;
}

function _inHuidigWindow(tijdstip, windowStart) {
  return !!tijdstip && new Date(tijdstip).getTime() >= windowStart;
}

// Onderhandel-status voor de winkel-UI: humeur-tier, sfeerregel en of de
// knop beschikbaar is (niet vijandig, niet op cooldown).
function _onderhandelStatus(g, shopId, characterId, winkelConfig) {
  if (!characterId) return null;
  const { score, entry } = _getShopMood(g, shopId, characterId);
  const tier = _moodTier(score);
  const opCooldown = _inHuidigWindow(entry?.laatstePoging, _shopWindowStart(g, shopId, winkelConfig));
  return {
    tier,
    tekst: MOOD_TEKST[tier],
    kan: tier !== 'vijandig' && !opCooldown,
    reden: tier === 'vijandig' ? 'De winkelier wil niet met je praten'
         : opCooldown ? 'Al onderhandeld — wacht op het volgende assortiment'
         : '',
  };
}

// Actieve positieve onderhandel-korting (negatieve/oude boetes tellen niet mee)
function _actieveKortingPct(g, shopId, characterId) {
  const d = g.shopTempDiscount?.[shopId]?.[characterId];
  if (d && new Date(d.geldigTot) > new Date() && (d.percent || 0) > 0) return d.percent;
  return 0;
}

// ── Winkel: verkoopbare voorwerpen van de ingelogde speler ─────────────────
router.get('/shops/:shopId/verkoopbaar', attachRole, (req, res) => {
  const characterId = req.session?.characterId;
  if (!characterId) return res.json({ koopt: false, items: [] });

  const { shopId } = req.params;
  const entities = storage.readJSON('entities.json');
  const allShops = [...(entities.personages || []), ...(entities.locaties || [])];
  const shop = allShops.find(e => e.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Winkel niet gevonden' });

  let winkelConfig = {};
  try { winkelConfig = shop.data?.winkelConfig ? JSON.parse(shop.data.winkelConfig) : {}; } catch {}
  const koopCfg = _winkelKoopConfig(winkelConfig);
  if (!koopCfg.koopt) return res.json({ koopt: false, items: [], ratio: koopCfg.ratio, categorieen: koopCfg.categorieen });

  const dmState = readDmState();
  const g = getGroup(dmState, _playerGroupId(dmState, characterId));
  const owners = g.itemOwners || {};
  const voorwerpen = entities.voorwerpen || [];

  // Onderhandel-korting werkt twee kanten op: ook een beter bod bij verkopen
  const bonusPct = _actieveKortingPct(g, shopId, characterId);

  const items = [];
  for (const [entityId, owner] of Object.entries(owners)) {
    let qty = 0;
    if (Array.isArray(owner)) {
      const mine = owner.find(o => o.characterId === characterId);
      qty = mine ? (mine.qty || 1) : 0;
    } else if (owner && owner.characterId === characterId) {
      qty = 1;
    }
    if (qty <= 0) continue;
    const vw = voorwerpen.find(e => e.id === entityId);
    if (!vw) continue;
    const check = _voorwerpVerkoopbaar(vw, koopCfg);
    items.push({
      entityId,
      naam: vw.name,
      itemType: vw.data?.itemType || '',
      prijs: vw.data?.prijs || '',
      stapelbaar: vw.data?.stapelbaar === 'true',
      qty,
      verkoopbaar: check.ok,
      reden: check.reden || '',
      aanbod: check.ok ? fromCl(Math.round(check.aanbodCl * (1 + bonusPct / 100))) : null,
    });
  }
  // Verkoopbare items eerst, daarna op naam
  items.sort((a, b) => (b.verkoopbaar - a.verkoopbaar) || a.naam.localeCompare(b.naam, 'nl'));
  res.json({ koopt: true, ratio: koopCfg.ratio, categorieen: koopCfg.categorieen, items, bonusPct });
});

// ── Winkel: voorwerp verkopen (inkoop door winkel) ─────────────────────────
router.post('/shops/:shopId/verkoop', attachRole, (req, res) => {
  const characterId = req.session?.characterId;
  if (!characterId) return res.status(401).json({ error: 'Log in als speler om te verkopen' });

  const { shopId } = req.params;
  const { entityId, aantal: aantalRaw } = req.body;
  if (!entityId) return res.status(400).json({ error: 'entityId vereist' });

  const entities = storage.readJSON('entities.json');
  const allShops = [...(entities.personages || []), ...(entities.locaties || [])];
  const shop = allShops.find(e => e.id === shopId);
  if (!shop) return res.status(404).json({ error: 'Winkel niet gevonden' });

  let winkelConfig = {};
  try { winkelConfig = shop.data?.winkelConfig ? JSON.parse(shop.data.winkelConfig) : {}; } catch {}
  const koopCfg = _winkelKoopConfig(winkelConfig);
  if (!koopCfg.koopt) return res.status(409).json({ error: 'Deze winkel koopt geen voorwerpen in' });

  const vw = (entities.voorwerpen || []).find(e => e.id === entityId);
  if (!vw) return res.status(404).json({ error: 'Voorwerp niet gevonden' });

  const check = _voorwerpVerkoopbaar(vw, koopCfg);
  if (!check.ok) return res.status(409).json({ error: check.reden });

  const dmState = readDmState();
  const buyerGroupId = _playerGroupId(dmState, characterId);
  const g = getGroup(dmState, buyerGroupId);
  if (!g.itemOwners) g.itemOwners = {};
  const owner = g.itemOwners[entityId];
  const isStapelbaar = vw.data?.stapelbaar === 'true';

  // Eigendom + aantal controleren
  let bezit = 0, ownerEntry = null;
  if (Array.isArray(owner)) {
    ownerEntry = owner.find(o => o.characterId === characterId);
    bezit = ownerEntry ? (ownerEntry.qty || 1) : 0;
  } else if (owner && owner.characterId === characterId) {
    bezit = 1;
  }
  if (bezit <= 0) return res.status(403).json({ error: 'Je bezit dit voorwerp niet' });

  const aantal = isStapelbaar ? Math.min(bezit, Math.max(1, parseInt(aantalRaw) || 1)) : 1;
  // Onderhandel-korting verhoogt ook het bod bij verkopen
  const verkoopBonusPct = _actieveKortingPct(g, shopId, characterId);
  const opbrengstCl = Math.round(check.aanbodCl * (1 + verkoopBonusPct / 100)) * aantal;

  // Eigendom bijwerken
  if (isStapelbaar && Array.isArray(owner)) {
    ownerEntry.qty = bezit - aantal;
    if (ownerEntry.qty <= 0) {
      g.itemOwners[entityId] = owner.filter(o => o.characterId !== characterId);
      if (g.itemOwners[entityId].length === 0) delete g.itemOwners[entityId];
    }
  } else {
    delete g.itemOwners[entityId];
  }

  // Munten bijschrijven
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const pc = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  dmState.playerCurrency[characterId] = fromCl(toCl(pc) + opbrengstCl);

  storage.writeJSON('dm-state.json', dmState);

  // Shop-log (verkoop)
  try {
    const shopLog = storage.readJSON('shop-log.json');
    if (!shopLog[shopId]) shopLog[shopId] = [];
    const aanbod = fromCl(opbrengstCl);
    shopLog[shopId].push({
      ts: new Date().toISOString(),
      characterId,
      playerName: req.playerName || 'Speler',
      itemNaam: vw.name,
      prijs: `${aanbod.fl} fl. ${aanbod.kn} kn. ${aanbod.cl} cl.`,
      aantal,
      type: 'verkoop',
    });
    if (shopLog[shopId].length > 200) shopLog[shopId] = shopLog[shopId].slice(-200);
    storage.writeJSON('shop-log.json', shopLog);
  } catch { /* stil falen */ }

  const io = req.app.get('io');
  io.to(req.session?.campaignId||'main').emit('player:currency-updated', { characterId, currency: dmState.playerCurrency[characterId] });
  io.to(req.session?.campaignId||'main').emit('items:ownership-updated', {
    owners: g.itemOwners || {},
    requests: g.itemRequests || [],
    tradeAllowed: g.tradeAllowed !== false,
  });

  res.json({ ok: true, itemNaam: vw.name, aantal, opbrengst: fromCl(opbrengstCl), currency: dmState.playerCurrency[characterId] });
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

  const dmState = readDmState();
  // Gebruik de groep van de speler zelf, niet de actieve DM-groep
  const g = getGroup(dmState, _playerGroupId(dmState, characterId));

  // Humeur bepaalt of en hoe moeilijk onderhandelen is
  const { score, entry } = _getShopMood(g, shopId, characterId);
  const tierVoor = _moodTier(score);
  if (tierVoor === 'vijandig') {
    return res.status(409).json({ error: 'De winkelier wil niet met je onderhandelen', tier: tierVoor });
  }

  // Eén poging per rotatie (of per 24 uur voor winkels zonder rotatie)
  const windowStart = _shopWindowStart(g, shopId, winkelConfig);
  if (_inHuidigWindow(entry?.laatstePoging, windowStart)) {
    return res.status(429).json({ error: 'Je hebt al onderhandeld — probeer het bij het volgende assortiment weer', tier: tierVoor });
  }

  const dcBasis = parseInt(winkelConfig.onderhandelDC) || 15;
  const dc = Math.max(1, dcBasis + MOOD_DC_MOD[tierVoor]);
  const kortingBasis = parseInt(winkelConfig.onderhandelKorting) || 10;

  const diceRoll = Math.floor(Math.random() * 20) + 1;
  const mod = parseInt(modifier) || 0;
  const totaal = diceRoll + mod;
  const nat20 = diceRoll === 20;
  const nat1 = diceRoll === 1;
  const geslaagd = nat20 || (!nat1 && totaal >= dc);

  // Uitkomst → korting en humeurverandering
  let kortingPct = 0, moodDelta = 0;
  if (geslaagd) {
    kortingPct = nat20 ? kortingBasis * 2 : kortingBasis;
    if (tierVoor === 'hartelijk') kortingPct += 5;
    if (nat20) moodDelta = 1;
  } else {
    moodDelta = nat1 ? -2 : -1;
  }

  const playerName = req.playerName || 'Speler';
  const scoreNa = moodDelta !== 0
    ? _bumpShopMood(g, shopId, characterId, moodDelta, playerName)
    : score;
  // Poging vastleggen voor de cooldown (entry bestaat na _bumpShopMood zeker)
  if (!g.shopMood) g.shopMood = {};
  if (!g.shopMood[shopId]) g.shopMood[shopId] = {};
  g.shopMood[shopId][characterId] = {
    ...(g.shopMood[shopId][characterId] || { score: scoreNa, laatsteUpdate: new Date().toISOString() }),
    laatstePoging: new Date().toISOString(),
    playerName,
  };

  if (!g.shopTempDiscount) g.shopTempDiscount = {};
  if (!g.shopTempDiscount[shopId]) g.shopTempDiscount[shopId] = {};
  const geldigTot = new Date(Date.now() + 3600000).toISOString(); // 1 uur
  if (kortingPct > 0) {
    g.shopTempDiscount[shopId][characterId] = { percent: kortingPct, geldigTot };
  } else {
    delete g.shopTempDiscount[shopId]?.[characterId];
  }
  storage.writeJSON('dm-state.json', dmState);

  const tierNa = _moodTier(scoreNa);
  res.json({
    diceRoll, modifier: mod, totaal, dc, geslaagd, nat20, nat1,
    kortingPct,
    tier: tierNa,
    tierTekst: MOOD_TEKST[tierNa],
    humeurGedaald: moodDelta < 0,
    humeurGestegen: moodDelta > 0,
  });
});

// ── Winkel: humeur inzien/bijstellen (DM) ──
router.get('/shops/:shopId/humeur', requireDM, (req, res) => {
  const { shopId } = req.params;
  const dmState = readDmState();
  const entries = [];
  for (const [groupId, grp] of Object.entries(dmState.groups || {})) {
    for (const [characterId, e] of Object.entries(grp.shopMood?.[shopId] || {})) {
      const { score } = _getShopMood(grp, shopId, characterId);
      entries.push({ characterId, playerName: e.playerName || '', score, tier: _moodTier(score), groupId });
    }
  }
  res.json({ entries });
});

router.post('/shops/:shopId/humeur', requireDM, (req, res) => {
  const { shopId } = req.params;
  const { characterId, delta } = req.body;
  if (!characterId) return res.status(400).json({ error: 'characterId vereist' });
  const d = parseInt(delta);
  if (!d || Math.abs(d) > 6) return res.status(400).json({ error: 'delta moet tussen -6 en 6 liggen' });

  const dmState = readDmState();
  const g = getGroup(dmState, _playerGroupId(dmState, characterId));
  const score = _bumpShopMood(g, shopId, characterId, d);
  storage.writeJSON('dm-state.json', dmState);
  res.json({ characterId, score, tier: _moodTier(score) });
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

// ── Hit Dice ───────────────────────────────────────────────────────────────
// Hit die per klasse (2024 PHB). Klassenamen Engels, case-insensitief.
const CLASS_HIT_DIE = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  sorcerer: 6, wizard: 6,
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
};
function _hitDieForClass(naam) {
  return CLASS_HIT_DIE[String(naam || '').trim().toLowerCase()] || null;
}
// Leidt de Hit Dice-pool af uit klasse + level (incl. multiklasse). Keyed op
// aantal zijden: { 10: 3, 6: 2 }. Fallback bij onbekende klasse: hitDie-veld of d8×level.
function _hitDicePool(profile) {
  const p = profile || {};
  const pool = {};
  const add = (klasse, lvl) => {
    const n = parseInt(lvl);
    const sides = _hitDieForClass(klasse);
    if (sides && n > 0) pool[sides] = (pool[sides] || 0) + n;
  };
  add(p.klasse, p.klasseLevel ?? p.level);
  if ((p.multiclass === true || p.multiclass === 'true') && p.multiKlasse) {
    add(p.multiKlasse, p.multiKlasseLevel);
  }
  if (Object.keys(pool).length === 0) {
    const m = String(p.hitDie || '').match(/d(\d+)/i);
    pool[m ? parseInt(m[1]) : 8] = parseInt(p.level ?? p.klasseLevel) || 1;
  }
  return pool;
}
function _hitDiceTotaal(pool) {
  return Object.values(pool).reduce((a, b) => a + b, 0);
}
function _conMod(profile) {
  const con = parseInt(profile?.con);
  return Number.isFinite(con) ? Math.floor((con - 10) / 2) : 0;
}
// Herstel n Hit Dice, grootste type eerst (muteert spent in-place).
function _herstelHitDice(pool, spent, n) {
  let teGaan = n, hersteld = 0;
  for (const sides of Object.keys(pool).map(Number).sort((a, b) => b - a)) {
    if (teGaan <= 0) break;
    const verbruikt = spent[sides] || 0;
    const terug = Math.min(verbruikt, teGaan);
    if (terug > 0) { spent[sides] = verbruikt - terug; teGaan -= terug; hersteld += terug; }
  }
  return hersteld;
}

// ── Rust: backdrop-keuze + d100-gebeurtenis ──────────────────────────────────
// Kies de juiste achtergrond per rust-type/locatie (herberg hergebruikt de
// herberg-backdrop; veld/korte rust hebben hun eigen instelbare backdrop).
function _rustBackdrop(type, locatie, meta) {
  const h = meta.herberg || {}, r = meta.rust || {};
  if (locatie === 'herberg') return h.backdropId || null;
  if (type === 'short') return r.korteRustBackdropId || null;
  return r.veldBackdropId || null;
}
// Sfeerloop-fileId voor de rust-overlay (uit sounds.json → serviceAmbiance).
function _rustLoopFileId(type, locatie) {
  const key = type === 'short' ? 'rust-kort' : (locatie === 'herberg' ? 'rust-herberg' : 'rust-veld');
  try { return (storage.readJSON('sounds.json').serviceAmbiance || {})[key] || null; }
  catch { return null; }
}

const _MUNT_CL = { fl: 100, kn: 10, cl: 1 };
// Rolt PER SPELER een eigen voorval uit de bij de locatie horende weighted-tabel (d100)
// en verrekent een eventueel valuta-token {+3kn} / {-1fl} op die speler zelf.
// Geeft een map terug: { [characterId]: { roll, tekst, currency } } (of null).
function _rolRustGebeurtenis(meta, locatie, dmState, spelers, io, campaignId) {
  const r = meta.rust || {};
  const tableId = (locatie === 'herberg' ? r.herbergEventTableId : r.veldEventTableId) || r.eventTableId;
  if (!tableId || !spelers.length) return null;
  let tablesData = {};
  try { tablesData = storage.readJSON('tables.json'); } catch { return null; }
  const table = (tablesData.tables || []).find(t => t.id === tableId);
  if (!table || table.type !== 'weighted' || !(table.entries || []).length) return null;

  const perSpeler = {};
  spelers.forEach(char => {
    const d100 = Math.floor(Math.random() * 100) + 1;
    let tekst = null;
    for (const entry of table.entries) {
      const m = String(entry).match(/^(\d+)[-–](\d+):\s*(.+)$/);
      if (m && d100 >= parseInt(m[1]) && d100 <= parseInt(m[2])) { tekst = m[3].trim(); break; }
    }
    if (!tekst) { perSpeler[char.id] = { roll: d100, tekst: '', currency: null }; return; }

    // Valuta-token parsen + uit de weergavetekst halen; effect treft de speler zelf.
    const tok = tekst.match(/\{\s*([+-]\d+)\s*(fl|kn|cl)\s*(?:@party)?\s*\}/i);
    let currency = null;
    if (tok) {
      tekst = tekst.replace(tok[0], '').replace(/\s{2,}/g, ' ').trim();
      const bedrag = parseInt(tok[1]);
      const unit = tok[2].toLowerCase();
      const deltaCl = bedrag * (_MUNT_CL[unit] || 1);
      // Negatief bedrag clampen zodat de beurs niet onder 0 komt
      const huidigCl = toCl(_effectiveCurrency(dmState, char.id) || { fl: 0, kn: 0, cl: 0 });
      const effDelta = deltaCl < 0 ? -Math.min(huidigCl, -deltaCl) : deltaCl;
      const { currency: nieuw } = _deductCurrency(dmState, char.id, -effDelta);
      if (io) io.to(campaignId).emit('player:currency-updated', { characterId: char.id, currency: nieuw });
      currency = { bedrag, unit };
    }
    perSpeler[char.id] = { roll: d100, tekst, currency };
  });
  return perSpeler;
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
  // Herberg-buffs ("Aan de tap") vervallen bij een lange rust
  if (dmState.playerBuffs?.[characterId]?.length) {
    dmState.playerBuffs[characterId] = [];
    const io = req.app.get('io');
    if (io) io.to(req.session?.campaignId||'main').emit('player:buffs-updated', { characterId, buffs: [] });
  }
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true });
});

// Tablet/display → terug naar het sfeerscherm (DM leegt het gepresenteerde beeld)
// Sfeer van het tafelscherm. Bewaard bij de akte, zodat je 'm volgende sessie
// terugkrijgt, en meteen uitgezonden naar de tablet.
router.put('/akte/:key/sfeer', requireDM, (req, res) => {
  const sfeer = String(req.body?.sfeer || '').trim().slice(0, 40);
  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken?.[req.params.key]) return res.status(404).json({ error: 'Akte niet gevonden' });
  meta.hoofdstukken[req.params.key].sfeer = sfeer || null;
  storage.writeJSON('meta.json', meta);
  const io = req.app.get('io');
  io?.to(req.session?.campaignId || 'main').emit('display:sfeer', { sfeer: sfeer || null });
  io?.to(req.session?.campaignId || 'main').emit('meta:updated');
  res.json({ ok: true, sfeer: sfeer || null });
});

// Eenmalig effect op het tafelscherm (bliksem, windvlaag, duister).
router.post('/display/effect', requireDM, (req, res) => {
  const effect = String(req.body?.effect || '').trim();
  if (!['bliksem', 'windvlaag', 'duister'].includes(effect)) {
    return res.status(400).json({ error: 'Onbekend effect' });
  }
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('display:effect', { effect });
  res.json({ ok: true, effect });
});

router.post('/display/idle', requireDM, (req, res) => {
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('display:idle');
  res.json({ ok: true });
});

// Party-brede lange rust (DM-actie)
router.post('/party/long-rest', requireDM, (req, res) => {
  const locatie = req.body?.locatie === 'herberg' ? 'herberg' : 'veld';
  let entities = {};
  try { entities = storage.readJSON('entities.json'); } catch { /* ok */ }
  const dmState = readDmState();
  const io = req.app.get('io');
  const g = getGroup(dmState);

  // Alle spelers in de actieve groep
  const activeGroepId = dmState.activeGroup || Object.keys(dmState.groups || {})[0];
  // Alleen wie vanavond meedoet rust mee: een afwezige speler hoort niet
  // stilletjes zijn HP en slots terug te krijgen.
  const spelers = _aanwezigeSpelers(dmState, activeGroepId, entities.personages);

  // Per-speler-samenvatting voor de cinematic
  const perPlayer = {};
  const _sum = id => (perPlayer[id] = perPlayer[id] || { hpVan: null, hpNaar: null, slotsHersteld: 0, hitDiceTerug: 0, chargesHersteld: 0 });

  // ── 1. HP → max ──
  if (!dmState.playerHp) dmState.playerHp = {};
  spelers.forEach(char => {
    const hp = dmState.playerHp[char.id];
    if (hp && hp.max !== null) {
      const s = _sum(char.id); s.hpVan = hp.current; s.hpNaar = hp.max;
      dmState.playerHp[char.id] = { current: hp.max, max: hp.max };
      if (io) io.to(req.session?.campaignId||'main').emit('player:hp-updated', { characterId: char.id, current: hp.max, max: hp.max });
    }
  });

  // ── Herberg-buffs ("Aan de tap") vervallen bij een lange rust ──
  if (dmState.playerBuffs) {
    spelers.forEach(char => {
      if (dmState.playerBuffs[char.id]?.length) {
        dmState.playerBuffs[char.id] = [];
        if (io) io.to(req.session?.campaignId||'main').emit('player:buffs-updated', { characterId: char.id, buffs: [] });
      }
    });
  }

  // ── 2. Spell slots → used=0 ──
  if (!dmState.playerSpellSlots) dmState.playerSpellSlots = {};
  spelers.forEach(char => {
    const slots = dmState.playerSpellSlots[char.id];
    if (!slots) return;
    for (const lvl of Object.keys(slots)) {
      _sum(char.id).slotsHersteld += (slots[lvl].used || 0);
      slots[lvl].used = 0;
    }
  });

  // ── 2c. Hit Dice → helft terug (grootste type eerst) ──
  if (!dmState.playerHitDice) dmState.playerHitDice = {};
  spelers.forEach(char => {
    const profile = (dmState.playerProfiles || {})[char.id] || {};
    const pool = _hitDicePool(profile);
    const totaal = _hitDiceTotaal(pool);
    if (totaal <= 0) return;
    const hd = (dmState.playerHitDice[char.id] = dmState.playerHitDice[char.id] || { spent: {} });
    if (!hd.spent) hd.spent = {};
    const terug = _herstelHitDice(pool, hd.spent, Math.max(1, Math.ceil(totaal / 2)));
    _sum(char.id).hitDiceTerug = terug;
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
        g.itemCharges[cid][itemId] = effectiveMax; resetCount++; _sum(cid).chargesHersteld++;
      } else if (effectiveMax > 0 && rechargeOn === 'longRestRoll') {
        const rolled = rollDice(item?.data?.rechargeRoll || '1d3');
        const current = g.itemCharges[cid][itemId] ?? effectiveMax;
        const newCharges = Math.min(effectiveMax, current + rolled);
        g.itemCharges[cid][itemId] = newCharges;
        rollLog.push({ charName: char.name, itemName: item.name, rolled, newCharges, max: effectiveMax });
        resetCount++; _sum(cid).chargesHersteld++;
      }
    });
  });

  // ── 5. Herberg: overnachtingskosten + roddel-onthulling ──
  const meta = storage.readJSON('meta.json');
  const herberg = meta.herberg || {};
  let kosten = null;
  const roddels = [];
  if (locatie === 'herberg') {
    // Per speler de overnachtingsprijs afschrijven
    const prijs = parsePrijs(herberg.overnachtingPrijs || '1 fl.');
    const prijsCl = prijs ? toCl(prijs) : 0;
    if (prijsCl > 0) {
      spelers.forEach(char => { _deductCurrency(dmState, char.id, prijsCl); });
      kosten = { perSpeler: prijs, totaal: fromCl(prijsCl * spelers.length) };
    }
    // 2 roddels per speler onthullen uit de gedeelde pool (personages + locaties)
    const aantal = 2 * spelers.length;
    const pool = [];
    for (const type of ['personages', 'locaties']) {
      (entities[type] || []).forEach(e => {
        const uitgesproken = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';
        if (e.data?.flavour && !uitgesproken) pool.push({ type, e });
      });
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    pool.slice(0, aantal).forEach(({ type, e }) => {
      e.data.flavourUitgesproken = 'true';
      roddels.push({ id: e.id, type, name: e.name, flavour: e.data.flavour });
      if (io) io.to(req.session?.campaignId||'main').emit('entity:updated', { type, id: e.id });
    });
    if (roddels.length) storage.writeJSON('entities.json', entities);
  }

  // ── 6. d100-rustgebeurtenis (binnen én buiten) ──
  const campaignId = req.session?.campaignId || 'main';
  const perSpelerEvents = _rolRustGebeurtenis(meta, locatie, dmState, spelers, io, campaignId);
  const gebeurtenissen = []; // platte lijst (voor het tafelscherm + DM-overzicht)
  if (perSpelerEvents) {
    spelers.forEach(char => {
      const ev = perSpelerEvents[char.id];
      if (!ev) return;
      (perPlayer[char.id] = perPlayer[char.id] || {}).gebeurtenis = ev;
      if (ev.tekst) gebeurtenissen.push({ naam: char.name, tekst: ev.tekst, currency: ev.currency });
    });
  }

  storage.writeJSON('dm-state.json', dmState);

  // Cinematic naar alle spelers in de campagne
  if (io) io.to(campaignId).emit('party:rest', {
    type: 'long', locatie,
    backdropId: _rustBackdrop('long', locatie, meta),
    loopFileId: _rustLoopFileId('long', locatie),
    waard: herberg.waard || '', herbergNaam: herberg.naam || '',
    roddels, perPlayer, gebeurtenissen,
  });

  res.json({ ok: true, spelers: spelers.length, resetCount, rollLog, kosten, roddelsOnthuld: roddels.length, gebeurtenissen });
});

// ── Party korte rust (DM-only) ──
// Sluit het rust-cinematic op alle schermen. De DM drukt op sluiten; zonder dit
// bleef de tablet met overlay én geluidsloop achter, want die klikt niemand weg.
router.post('/party/rest/close', requireDM, (req, res) => {
  req.app.get('io')?.to(req.session?.campaignId || 'main').emit('party:rest-close');
  res.json({ ok: true });
});

router.post('/party/short-rest', requireDM, (req, res) => {
  const locatie = req.body?.locatie === 'herberg' ? 'herberg' : 'veld';
  let entities = {};
  try { entities = storage.readJSON('entities.json'); } catch { /* ok */ }
  const dmState = readDmState();
  const io = req.app.get('io');
  const g = getGroup(dmState);

  const activeGroepId = dmState.activeGroup || Object.keys(dmState.groups || {})[0];
  // Alleen wie vanavond meedoet rust mee: een afwezige speler hoort niet
  // stilletjes zijn HP en slots terug te krijgen.
  const spelers = _aanwezigeSpelers(dmState, activeGroepId, entities.personages);

  if (!g.itemCharges) g.itemCharges = {};
  if (!dmState.playerSpellSlots) dmState.playerSpellSlots = {};
  if (!dmState.playerHitDice) dmState.playerHitDice = {};
  const ownedItemIds = Object.keys(g.itemOwners || {});
  const perPlayer = {};

  spelers.forEach(char => {
    const cid = char.id;
    const profile = (dmState.playerProfiles || {})[cid] || {};
    let chargesHersteld = 0;

    // Items met rechargeOn === 'shortRest' → max
    if (!g.itemCharges[cid]) g.itemCharges[cid] = {};
    ownedItemIds.forEach(itemId => {
      const owners = g.itemOwners[itemId];
      const isOwned = Array.isArray(owners) ? owners.some(o => o.characterId === cid) : owners?.characterId === cid;
      if (!isOwned) return;
      const item = (entities.voorwerpen || []).find(e => e.id === itemId);
      const baseMax = parseInt(item?.data?.maxCharges);
      const effectiveMax = (g.itemMaxCharges?.[cid]?.[itemId]) ?? baseMax;
      if (effectiveMax > 0 && item?.data?.rechargeOn === 'shortRest') {
        g.itemCharges[cid][itemId] = effectiveMax; chargesHersteld++;
      }
    });

    // Warlock pact-slots herstellen op korte rust
    const klassen = [profile.klasse, profile.multiKlasse].map(k => String(k || '').toLowerCase());
    let pactReset = false;
    if (klassen.includes('warlock')) {
      const slots = dmState.playerSpellSlots[cid];
      if (slots) { for (const lvl of Object.keys(slots)) { if (slots[lvl].used) { slots[lvl].used = 0; pactReset = true; } } }
    }

    // Hit Dice-info voor het interactieve paneel
    const pool = _hitDicePool(profile);
    const hd = (dmState.playerHitDice[cid] = dmState.playerHitDice[cid] || { spent: {} });
    if (!hd.spent) hd.spent = {};
    perPlayer[cid] = { chargesHersteld, pactReset, hitDice: { pool, spent: hd.spent, conMod: _conMod(profile) } };
  });

  storage.writeJSON('dm-state.json', dmState);

  const meta = storage.readJSON('meta.json');
  if (io) io.to(req.session?.campaignId||'main').emit('party:rest', {
    type: 'short', locatie,
    backdropId: _rustBackdrop('short', locatie, meta),
    loopFileId: _rustLoopFileId('short', locatie),
    perPlayer,
  });

  res.json({ ok: true, spelers: spelers.length });
});

// ── Hit Die besteden (speler of DM) ──
router.post('/characters/:characterId/spend-hit-die', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session?.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });

  const sides = parseInt(String(req.body?.die || '').replace(/^d/i, ''));
  if (!sides) return res.status(400).json({ error: 'Ongeldig dobbeltype' });

  const dmState = readDmState();
  const profile = (dmState.playerProfiles || {})[characterId] || {};
  const pool = _hitDicePool(profile);
  if (!dmState.playerHitDice) dmState.playerHitDice = {};
  const hd = (dmState.playerHitDice[characterId] = dmState.playerHitDice[characterId] || { spent: {} });
  if (!hd.spent) hd.spent = {};

  const beschikbaar = (pool[sides] || 0) - (hd.spent[sides] || 0);
  if (beschikbaar <= 0) return res.status(409).json({ error: 'Geen Hit Dice van dit type meer' });

  const conMod = _conMod(profile);
  const rolled = Math.floor(Math.random() * sides) + 1;
  const heal = Math.max(1, rolled + conMod);

  if (!dmState.playerHp) dmState.playerHp = {};
  const hp = dmState.playerHp[characterId] || { current: 0, max: null };
  const current = hp.max != null ? Math.min(hp.max, (hp.current || 0) + heal) : (hp.current || 0) + heal;
  dmState.playerHp[characterId] = { current, max: hp.max };
  hd.spent[sides] = (hd.spent[sides] || 0) + 1;

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  if (io) io.to(req.session?.campaignId||'main').emit('player:hp-updated', { characterId, current, max: hp.max });

  res.json({ rolled, conMod, heal, hp: { current, max: hp.max }, hitDice: { pool, spent: hd.spent } });
});

// ── Hit Dice-stand opvragen (voor de character sheet) ──
router.get('/characters/:characterId/hit-dice', attachRole, (req, res) => {
  const { characterId } = req.params;
  if (req.role !== 'dm' && req.session?.characterId !== characterId)
    return res.status(403).json({ error: 'Geen toegang' });
  const dmState = readDmState();
  const profile = (dmState.playerProfiles || {})[characterId] || {};
  const pool = _hitDicePool(profile);
  const spent = (dmState.playerHitDice?.[characterId]?.spent) || {};
  res.json({ pool, spent, conMod: _conMod(profile), totaal: _hitDiceTotaal(pool) });
});

// ── Speler HP (buiten gevecht) ──

router.get('/player-hp/:characterId', attachRole, (req, res) => {
  const characterId = req.params.characterId;
  if (req.role !== 'dm' && req.session?.characterId !== characterId) {
    return res.status(403).json({ error: 'Geen toegang' });
  }
  const dmState = readDmState();
  const hp = (dmState.playerHp || {})[characterId] || { current: null, max: null };
  const buffs = (dmState.playerBuffs || {})[characterId] || [];
  res.json({ ...hp, buffs });
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
    id: e.id, name: (g.companionNames || {})[e.id] || e.name, subtype: e.subtype,
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

// ── Huisdieren / metgezellen: tier-schaling ──
// Een dier-entity (subtype 'dier') kan een reeks benoemde statblock-tiers hebben
// (`statblockTiers: [{ minLevel, label, statblock, maxHp }]`). De actieve tier is de
// hoogste tier met minLevel <= het level van het baasje. Zonder tiers val terug op
// een vaste `statblock`/`maxHp` op de entity zelf.
function _activeTier(entity, ownerLevel) {
  const tiers = Array.isArray(entity?.statblockTiers) ? entity.statblockTiers.slice() : [];
  if (!tiers.length) {
    return { statblock: entity?.statblock || {}, maxHp: entity?.maxHp, label: entity?.name, index: 0, count: 0, next: null };
  }
  tiers.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0));
  const lvl = parseInt(ownerLevel) || 1;
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if ((tiers[i].minLevel || 0) <= lvl) idx = i;
  const t = tiers[idx];
  const next = tiers[idx + 1] || null;
  return { statblock: t.statblock || {}, maxHp: t.maxHp, label: t.label || entity?.name, index: idx, count: tiers.length, next: next ? (next.minLevel || null) : null };
}

// Zoek het baasje (characterId) van een huisdier over alle groepen heen.
function _findPetOwner(dmState, petId) {
  for (const g of Object.values(dmState.groups || {})) {
    if (g.companionOwners && g.companionOwners[petId]) return g.companionOwners[petId];
  }
  return null;
}

// Bereken de geschaalde statblock-info van een huisdier. Schaalt op het level van het
// baasje; zonder baasje op het hoogste level binnen de (opgegeven) groep.
function _petStatblockInfo(entity, dmState, gid) {
  const profiles = dmState.playerProfiles || {};
  const ownerId  = _findPetOwner(dmState, entity.id);
  let level = 1, ownerName = null;
  if (ownerId) {
    const p = profiles[ownerId] || {};
    level = parseInt(p.level ?? p.klasseLevel) || 1;
    ownerName = (storage.readJSON('entities.json').personages || []).find(e => e.id === ownerId)?.name || null;
  } else {
    const groepId = gid || dmState.activeGroup;
    const spelers = (storage.readJSON('entities.json').personages || [])
      .filter(e => e.subtype === 'speler' && e.data?.groep === groepId);
    for (const s of spelers) {
      const p = profiles[s.id] || {};
      const l = parseInt(p.level ?? p.klasseLevel) || 1;
      if (l > level) level = l;
    }
  }
  const t = _activeTier(entity, level);
  return { ...t, ownerLevel: level, ownerName, ownerId };
}

// Adoptieprijs van een dier-entity (ondersteunt zowel object {fl} als los getal adoptiePrijsFl).
function _adoptiePrijs(e) {
  if (e?.data?.adoptiePrijs && typeof e.data.adoptiePrijs === 'object') return e.data.adoptiePrijs;
  const fl = parseInt(e?.data?.adoptiePrijsFl);
  return { fl: isNaN(fl) ? 0 : fl };
}

// Heeft de groep al een huisdier (dier-companion)? Max één per party.
function _groupHasPet(g, entities) {
  return (g?.companions || []).some(id => (entities.personages || []).some(e => e.id === id && e.subtype === 'dier'));
}

// Het huidige huisdier van een groep (entity + display-naam), of null.
function _groupPet(g, entities) {
  for (const id of (g?.companions || [])) {
    const e = (entities.personages || []).find(x => x.id === id && x.subtype === 'dier');
    if (e) return { id: e.id, name: (g.companionNames || {})[e.id] || e.name };
  }
  return null;
}

// Huisdier overlijdt (na 3 gefaalde death saves): ontkoppel als companion in alle groepen,
// wis baasje + naam, markeer als overleden. Geeft de groepen terug waarin het stierf.
function _petDie(dmState, petId) {
  const groups = [];
  for (const [gid, g] of Object.entries(dmState.groups || {})) {
    if ((g.companions || []).includes(petId)) {
      g.companions = g.companions.filter(id => id !== petId);
      if (g.companionOwners) delete g.companionOwners[petId];
      if (g.companionNames)  delete g.companionNames[petId];
      if (!g.deceased) g.deceased = {};
      g.deceased[petId] = true;
      groups.push(gid);
    }
  }
  return groups;
}

// Lijst dier-entities die ter adoptie staan bij De Magizoöloog. Eén huisdier per party:
// als de groep er al één heeft, is er niets te adopteren.
function _magizooAdoptabel(dmState, gid) {
  const entities = storage.readJSON('entities.json');
  const g = getGroup(dmState, gid);
  if (_groupHasPet(g, entities)) return [];
  const owned = new Set(g?.companions || []);
  return (entities.personages || [])
    .filter(e => e.subtype === 'dier'
      && (e.data?.adopteerbaar === true || e.data?.adopteerbaar === 'true')
      && !owned.has(e.id))
    .map(e => {
      const tiers = Array.isArray(e.statblockTiers) ? [...e.statblockTiers].sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0)) : [];
      const sb = (tiers[0]?.statblock) || e.statblock || {};
      const samenvatting = (sb.traits || sb.actions || '').split('\n')[0].replace(/\*/g, '').trim().slice(0, 140);
      return {
        id: e.id, name: e.name, imageId: e.id,
        soortLabel: e.data?.soortLabel || e.data?.ras || '',
        prijs: _adoptiePrijs(e),
        naamSuggestie: e.data?.naamSuggestie || 'Jip',
        samenvatting,
      };
    });
}

// Geschaalde statblock van een huisdier (voor het detailvenster).
router.get('/companions/pet/:petId/statblock', attachRole, (req, res) => {
  const { petId } = req.params;
  const pet = (storage.readJSON('entities.json').personages || []).find(e => e.id === petId && e.subtype === 'dier');
  if (!pet) return res.status(404).json({ error: 'Geen dier-entity' });
  const dmState = readDmState();
  const gid = req.session.characterId ? _playerGroupId(dmState, req.session.characterId) : undefined;
  const g   = getGroup(dmState, gid);
  const info = _petStatblockInfo(pet, dmState, gid);
  res.json({
    name: pet.name,
    petName: (g.companionNames || {})[petId] || pet.name,
    description: pet.description || '',
    label: info.label,
    statblock: info.statblock,
    maxHp: info.maxHp,
    tierIndex: info.index, tierCount: info.count,
    nextMinLevel: info.next,
    ownerLevel: info.ownerLevel, ownerName: info.ownerName,
  });
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
    "preparedMax", "signatureState",
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
  const { school, desc, damage, casting_time, range, components, duration, incantation, concentrationActive, prepared, alwaysPrepared } = req.body;
  if (prepared       !== undefined) spell.prepared       = !!prepared;
  if (alwaysPrepared !== undefined) spell.alwaysPrepared = !!alwaysPrepared;
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

// ─────────────────────────────────────────────────────────────────────────────
// Akte-importer: zet een narratief Obsidian-hoofdstuk (.md vol [[wikilinks]],
// ![[embeds]] en monster-compendiumlinks) om naar een geordend regie-script.
// Twee stappen: /preview (tekst-analyse, geen schrijfacties) en /apply (commit).
// ─────────────────────────────────────────────────────────────────────────────

function _impNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function _impBasename(p) {
  return String(p || '').split(/[\\/]/).pop().trim();
}
function _impCaptionFromFile(file) {
  return _impBasename(file).replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim();
}
function _impMonsterFromUrl(url, label) {
  try {
    const u = String(url);
    const hashIdx = u.indexOf('#');
    // 5e.tools: naam staat in de hash (#mimic_mm). items.html e.d. zijn geen monsters.
    if (/5e\.tools/i.test(u)) {
      if (!/bestiary/i.test(u) || hashIdx < 0) return '';
      let h = u.slice(hashIdx + 1).split('_')[0];
      h = decodeURIComponent(h).replace(/[+]/g, ' ').replace(/[-_]+/g, ' ').trim();
      return h;
    }
    // roll20/dndbeyond: laatste pad-segment.
    let slug = u.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
    slug = decodeURIComponent(slug).replace(/^\d+-/, '').replace(/[-_]+/g, ' ').trim();
    return slug || (label || '').trim();
  } catch { return (label || '').trim(); }
}

// Parseert markdown → geordende tokens (image | entity | monster) met sectie-context.
function _parseAkteMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  const tokens = [];
  let section = '';
  const reImg  = /!\[\[([^\]|#\\]+?)(?:\\?[#|][^\]]*)?\]\]/g;
  const reWiki = /(^|[^!])\[\[([^\]|#\\]+?)(?:\\?[#|][^\]]*)?\]\]/g;
  const reMon  = /\[([^\]]+)\]\((https?:\/\/[^)\s]*(?:roll20\.net\/compendium|dndbeyond\.com\/monsters|5e\.tools)[^)\s]*)\)/gi;
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) { section = h[1].replace(/\[\[|\]\]/g, '').replace(/[#*]/g, '').trim(); continue; }
    const found = [];
    let m;
    reImg.lastIndex = 0;
    while ((m = reImg.exec(line))) found.push({ idx: m.index, kind: 'image', file: _impBasename(m[1].trim()) });
    reWiki.lastIndex = 0;
    while ((m = reWiki.exec(line))) {
      const name = m[2].trim();
      if (name) found.push({ idx: m.index + (m[1] ? m[1].length : 0), kind: 'entity', name });
    }
    reMon.lastIndex = 0;
    while ((m = reMon.exec(line))) { const mn = _impMonsterFromUrl(m[2], m[1]); if (mn) found.push({ idx: m.index, kind: 'monster', name: mn }); }
    found.sort((a, b) => a.idx - b.idx);
    for (const f of found) { f.section = section; tokens.push(f); }
  }
  return tokens;
}

// Bouwt een review-plan uit de tokens. `imageNames` = bestandsnamen die de DM meelevert.
function _buildAktePlan(md, imageNames) {
  const tokens   = _parseAkteMarkdown(md);
  const entities = storage.readJSON('entities.json');
  const monData  = storage.readJSON('monsters.json');
  const monsters = (monData && monData.monsters) || [];

  const entIdx = {};
  for (const t of ENTITY_TYPES) for (const e of (entities[t] || [])) {
    const k = _impNorm(e.name); (entIdx[k] = entIdx[k] || []).push({ type: t, id: e.id, name: e.name });
  }
  const monIdx = {};
  for (const mo of monsters) monIdx[_impNorm(mo.name)] = { id: mo.id, name: mo.name, hp: mo.maxHp || 10 };

  const provided = new Set((imageNames || []).map(n => _impNorm(_impBasename(n))));
  const plan = [];
  const seenEntity = new Set();
  const encBySection = {};
  const reports = { unmatchedEntities: [], missingImages: [], unmatchedMonsters: [] };
  let sid = 0;
  const nid = () => 'pi_' + (sid++).toString(36) + '_' + Math.random().toString(36).slice(2, 6);

  for (const tk of tokens) {
    if (tk.kind === 'image') {
      const ok = provided.has(_impNorm(tk.file));
      plan.push({ id: nid(), type: 'image', file: tk.file, caption: _impCaptionFromFile(tk.file),
        include: true, _status: ok ? 'ok' : 'missing' });
      if (!ok && !reports.missingImages.includes(tk.file)) reports.missingImages.push(tk.file);
    } else if (tk.kind === 'entity') {
      const k = _impNorm(tk.name);
      if (seenEntity.has(k)) continue;
      seenEntity.add(k);
      const cands = entIdx[k] || [];
      if (cands.length) {
        const c = cands[0];
        plan.push({ id: nid(), type: 'entity', name: c.name, entityType: c.type, entityId: c.id,
          include: true, _status: 'ok', _candidates: cands });
      } else {
        plan.push({ id: nid(), type: 'entity', name: tk.name, entityType: null, entityId: null,
          include: false, _status: 'unmatched' });
        if (!reports.unmatchedEntities.includes(tk.name)) reports.unmatchedEntities.push(tk.name);
      }
    } else if (tk.kind === 'monster') {
      const sec = tk.section || 'Encounter';
      if (!encBySection[sec]) {
        encBySection[sec] = { id: nid(), type: 'encounter', name: sec, monsters: [], include: true, _status: 'ok' };
        plan.push(encBySection[sec]);
      }
      const enc = encBySection[sec];
      const k = _impNorm(tk.name);
      if (enc.monsters.some(r => _impNorm(r.name) === k)) continue;
      const mm = monIdx[k];
      enc.monsters.push({ name: mm ? mm.name : tk.name, count: 1, matched: !!mm,
        monsterId: mm ? mm.id : null, hp: mm ? mm.hp : 10 });
      if (!mm && !reports.unmatchedMonsters.includes(tk.name)) reports.unmatchedMonsters.push(tk.name);
    }
  }
  return { plan, reports };
}

// Analyse: lever een review-plan terug, schrijft niets weg.
router.post('/import/akte/preview', requireDM, (req, res) => {
  const md = req.body?.md;
  if (!md || typeof md !== 'string') return res.status(400).json({ error: 'Geen markdown ontvangen' });
  const { plan, reports } = _buildAktePlan(md, req.body.imageNames || []);
  // Volledige kaartenlijst zodat de DM een (niet-)match handmatig kan koppelen.
  const entities = storage.readJSON('entities.json');
  const entityOptions = [];
  for (const t of ENTITY_TYPES) for (const e of (entities[t] || [])) entityOptions.push({ type: t, id: e.id, name: e.name });
  entityOptions.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  res.json({ plan, reports, entityOptions, chapterKey: req.body.chapterKey || '' });
});

// Commit: bouw sessieLog-afbeeldingen, encounters en het regie-script.
router.post('/import/akte/apply', requireDM, uploadMedia.array('images', 100), (req, res) => {
  let plan;
  try { plan = JSON.parse(req.body.plan || '[]'); } catch { return res.status(400).json({ error: 'Ongeldig plan' }); }
  if (!Array.isArray(plan)) return res.status(400).json({ error: 'Ongeldig plan' });
  const chapterKey = (req.body.chapterKey || '').trim();
  if (!chapterKey) return res.status(400).json({ error: 'Geen akte gekozen' });
  const mode = req.body.mode === 'append' ? 'append' : 'replace';

  const fileByName = {};
  for (const f of (req.files || [])) fileByName[_impNorm(f.originalname)] = f;

  const script = [];
  const sessieImages = [];
  const imageScriptRefs = [];   // script-items die nog een sessieId nodig hebben
  const encounters = storage.readJSON('encounters.json');
  if (!Array.isArray(encounters.encounters)) encounters.encounters = [];
  let imagesUploaded = 0, encountersCreated = 0;
  const newId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  for (const step of plan) {
    if (step.include === false) continue;
    if (step.type === 'image') {
      const f = fileByName[_impNorm(step.file)];
      if (!f || !_sniffMedia(f.buffer)) continue;
      const fid = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      storage.saveFile(fid, f.buffer, f.mimetype);
      sessieImages.push({ id: fid, caption: step.caption || '', visible: false });
      const item = { id: newId('s'), type: 'image', fileId: fid, sessieId: null, caption: step.caption || '' };
      script.push(item); imageScriptRefs.push(item);
      imagesUploaded++;
    } else if (step.type === 'entity' && step.entityId && step.entityType) {
      script.push({ id: newId('s'), type: 'entity', entityType: step.entityType, entityId: step.entityId, name: step.name || '' });
    } else if (step.type === 'encounter') {
      const mons = (step.monsters || []).map(r => ({
        name: r.name, count: Math.max(1, parseInt(r.count) || 1), initiative: 10, hp: parseInt(r.hp) || 10,
      }));
      const eid = newId('enc');
      encounters.encounters.push({
        id: eid, name: step.name || 'Encounter', akteId: chapterKey,
        backdropId: 'enc-backdrop-' + eid, canvasPreset: 'plain', canvasColors: null, monsters: mons,
      });
      encountersCreated++;
      script.push({ id: newId('s'), type: 'encounter', encounterId: eid, name: step.name || 'Encounter' });
    }
  }

  // Sessie-entry voor de afbeeldingen (zodat onthullen → speler-lightbox werkt).
  let sessieId = null;
  if (sessieImages.length) {
    const archief = storage.readJSON('archief.json');
    if (!archief.sessieLog) archief.sessieLog = [];
    sessieId = 'sl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
    archief.sessieLog.push({
      id: sessieId, hoofdstuk: chapterKey, datum: '', korteSamenvatting: 'Geïmporteerde scène-afbeeldingen',
      samenvatting: '', images: sessieImages,
      nieuwPersonages: [], terugkerendPersonages: [], nieuwLocaties: [], terugkerendLocaties: [],
      organisaties: [], voorwerpen: [], docs: [], nieuw: [], terugkerend: [],
    });
    storage.writeJSON('archief.json', archief);
    for (const ref of imageScriptRefs) ref.sessieId = sessieId;
  }

  if (encountersCreated) storage.writeJSON('encounters.json', encounters);

  const meta = storage.readJSON('meta.json');
  if (!meta.hoofdstukken) meta.hoofdstukken = {};
  if (!meta.hoofdstukken[chapterKey]) meta.hoofdstukken[chapterKey] = {};
  const existing = Array.isArray(meta.hoofdstukken[chapterKey].script) ? meta.hoofdstukken[chapterKey].script : [];
  meta.hoofdstukken[chapterKey].script = mode === 'append' ? existing.concat(script) : script;
  storage.writeJSON('meta.json', meta);

  const io = req.app.get('io'); const room = req.session?.campaignId || 'main';
  io.to(room).emit('meta:updated');
  if (sessieId) io.to(room).emit('logboek:updated', { id: sessieId });

  res.json({ ok: true, chapterKey, mode, scriptLength: meta.hoofdstukken[chapterKey].script.length,
    stepsAdded: script.length, imagesUploaded, encountersCreated, sessieId });
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

// Aanwezigheid voor deze sessie. Body: { afwezig: [characterId, ...] }.
router.put('/groups/:id/aanwezigheid', requireDM, (req, res) => {
  const { id }  = req.params;
  const dmState = readDmState();
  if (!dmState.groups[id]) return res.status(404).json({ error: 'Groep niet gevonden' });
  const leden = new Set((storage.readJSON('entities.json').personages || [])
    .filter(e => e.subtype === 'speler' && e.data?.groep === id).map(e => e.id));
  // Alleen leden van déze groep; onbekende ids stilzwijgend negeren zou een
  // typefout onzichtbaar maken, dus die filteren we er hier hard uit.
  dmState.groups[id].afwezig = [...new Set((req.body.afwezig || []).filter(cid => leden.has(cid)))];
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('groups:updated', { groups: groupInfoList(dmState), activeGroup: dmState.activeGroup });
  res.json({ id, afwezig: dmState.groups[id].afwezig });
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

// Zichtbaarheid van sessieLog-afbeeldingen is per groep, net als bij entiteiten
// en documenten. Zonder eigen waarde valt hij terug op de oude globale `visible`
// vlag, zodat alles wat al onthuld was onthuld blijft.
function _imgZichtbaar(dmState, groepId, img) {
  const id = typeof img === 'string' ? img : img?.id;
  if (!id) return false;
  const perGroep = groepId ? dmState.groups?.[groepId]?.imageVis : null;
  if (perGroep && id in perGroep) return !!perGroep[id];
  return typeof img === 'string' || img.visible !== false;   // terugval: oude data
}

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
            images: (e.images || []).filter(img => _imgZichtbaar(dmState, playerGroepId, img)),
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
    imageId:   req.body.imageId   || '',
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
  _deleteFileIfUnused(req.params.id);                                                  // bestand op /files/{docId}
  if (deletingDoc?.imageId) _deleteFileIfUnused(deletingDoc.imageId);                  // bibliotheek-afbeelding
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

// Onthul één afbeelding voor één groep. Voorheen liep dit via de globale
// `visible`-vlag op de sessieLog-entry, waardoor een reveal voor groep 3 ook bij
// groep 2 op tafel lag zodra je tussen groepen afwisselde.
router.post('/sessieLog/:id/onthul', requireDM, (req, res) => {
  const { fileId, caption } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'Geen fileId' });
  const dmState = readDmState();
  const gid = req.body?.groupId || dmState.activeGroup;
  if (!gid || !dmState.groups?.[gid]) return res.status(400).json({ error: 'Geen actieve groep' });

  const archief = storage.readJSON('archief.json');
  const entry = (archief.sessieLog || []).find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Sessie niet gevonden' });

  // Onderschrift meenemen: de client stuurt dat van de regie-stap mee, zodat de
  // twee niet uit elkaar lopen. Leeg overschrijft bewust niets.
  const cap = String(caption || '').trim();
  if (Array.isArray(entry.images)) {
    entry.images = entry.images.map(img => {
      const id = typeof img === 'string' ? img : img.id;
      if (id !== fileId) return img;
      const basis = typeof img === 'string' ? { id, visible: false } : img;
      return { ...basis, ...(cap ? { caption: cap } : {}) };
    });
    storage.writeJSON('archief.json', archief);
  }

  const g = dmState.groups[gid];
  if (!g.imageVis) g.imageVis = {};
  const wasZichtbaar = _imgZichtbaar(dmState, gid, (entry.images || []).find(
    i => (typeof i === 'string' ? i : i.id) === fileId) || { id: fileId, visible: false });
  g.imageVis[fileId] = true;
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  io?.to(req.session?.campaignId || 'main').emit('logboek:updated', { id: req.params.id });
  if (!wasZichtbaar) {
    const img = (entry.images || []).find(i => (typeof i === 'string' ? i : i.id) === fileId);
    io?.to(req.session?.campaignId || 'main').emit('logboek:imageRevealed', {
      sessieId:     req.params.id,
      imageId:      fileId,
      caption:      (img && typeof img === 'object' ? img.caption : '') || cap || '',
      samenvatting: entry.korteSamenvatting || '',
      groupId:      gid,          // clients filteren hierop
    });
  }
  res.json({ ok: true, groupId: gid, alZichtbaar: wasZichtbaar });
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

// Speler accepteert een factie-missie. Controleert of de groep al een actieve
// missie heeft voor dezelfde factie (max. 1 actief per factie per groep).
router.post('/quests/:id/accepteer', attachRole, (req, res) => {
  const charId = req.session.characterId;
  if (!charId) return res.status(403).json({ error: 'Niet ingelogd als speler' });

  const data = storage.readJSON('quests.json');
  const quest = (data.quests || []).find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Missie niet gevonden' });
  if (!quest.factieId) return res.status(400).json({ error: 'Dit is geen factie-missie' });

  const dmState = readDmState();
  const groepId = _playerGroupId(dmState, charId);
  if (!groepId) return res.status(400).json({ error: 'Geen groep gevonden' });

  const states = _readQuestStates(groepId);

  // Controleer huidige status van déze quest
  const huidig = states[quest.id] || 'verborgen';
  if (huidig !== 'actief') return res.status(400).json({ error: 'Missie is niet beschikbaar' });

  // Controleer of de groep al een actieve missie heeft voor dezelfde factie
  const actieveStatussen = new Set(['aangevraagd', 'in-uitvoering']);
  const heeftActief = (data.quests || []).some(q =>
    q.id !== quest.id &&
    q.factieId === quest.factieId &&
    actieveStatussen.has(states[q.id])
  );
  if (heeftActief) return res.status(400).json({ error: 'De party heeft al een actieve missie voor deze factie' });

  // Sla aanvraag op
  states[quest.id] = 'aangevraagd';
  _writeQuestStates(groepId, states);

  const char = (storage.readJSON('entities.json').personages || []).find(e => e.id === charId);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('quests:updated');
  io.to(room).emit('missie:aanvraag', { missieId: quest.id, titel: quest.title, door: char?.name || 'Onbekende speler', factieId: quest.factieId });
  res.json({ ok: true });
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

router.post('/files/:id', requireDM, uploadMedia.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand of niet-toegestaan type' });
  if (!_sniffMedia(req.file.buffer))
    return res.status(415).json({ error: 'Bestandsinhoud komt niet overeen met een toegestaan mediatype' });
  const filename = storage.saveFile(req.params.id, req.file.buffer, req.file.mimetype);
  // Registreer in de mediabibliotheek (naam, MIME, datum, afmetingen).
  await _registerMedia(req.params.id, {
    mime:          req.file.mimetype,
    grootte:       req.file.size,
    origineleNaam: req.file.originalname || '',
    naam:          (req.body?.naam || '').trim() || null,
    buffer:        req.file.buffer,
  });
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
  _unregisterMedia(req.params.id);
  res.json({ ok: true });
});

// Kopieer een bestaand bestand (uit de bibliotheek of net geüpload) naar een vaste
// fileId zoals spell-img-<index>. Zo kan de DM een spreukafbeelding uit de bibliotheek
// kiezen zonder de vaste-id-conventie van het render-pad te wijzigen.
router.post('/files/:id/copy-from/:src', requireDM, async (req, res) => {
  const src = storage.getFile(req.params.src);
  if (!src) return res.status(404).json({ error: 'Bronbestand niet gevonden' });
  let buffer;
  try { buffer = fs.readFileSync(src.path); } catch { return res.status(500).json({ error: 'Lezen mislukt' }); }
  storage.saveFile(req.params.id, buffer, src.mimetype);
  // spell-img-<index> is een afgeleide weergavekopie, geen bibliotheek-asset:
  // niet registreren (anders staat 'ie dubbel naast het bronbestand).
  if (/^spell-img-/.test(req.params.id)) _unregisterMedia(req.params.id);
  else await _registerMedia(req.params.id, { mime: src.mimetype, grootte: buffer.length, buffer });
  res.json({ ok: true });
});

// ── Mediabibliotheek ──
// media.json registreert per fileId een bewerkbare weergavenaam + auto-info.
// ID ≠ naam: verwijzingen in de data gebruiken het fileId, de naam leeft alleen
// hier — hernoemen is dus altijd veilig.

const _MIME_TYPE_GROEP = (mime) =>
  (mime || '').startsWith('audio/') ? 'audio'
  : (mime || '').startsWith('video/') ? 'video'
  : (mime || '') === 'application/pdf' ? 'pdf'
  : 'afbeelding';

// Registreer of werk een bestand bij in media.json. `buffer` optioneel — als het
// een afbeelding is bepalen we breedte/hoogte via sharp.
async function _registerMedia(id, { mime, grootte, origineleNaam, naam, buffer } = {}) {
  const media = storage.readJSON('media.json');
  if (!media.files) media.files = {};
  const bestaand = media.files[id] || {};
  const type = _MIME_TYPE_GROEP(mime);
  let breedte = bestaand.breedte ?? null, hoogte = bestaand.hoogte ?? null;
  if (type === 'afbeelding' && _sharp && buffer && mime !== 'image/svg+xml') {
    try { const m = await _sharp(buffer).metadata(); breedte = m.width || null; hoogte = m.height || null; } catch {}
  }
  media.files[id] = {
    naam:          naam || bestaand.naam || id,
    type,
    mime:          mime || bestaand.mime || '',
    grootte:       grootte ?? bestaand.grootte ?? null,
    breedte, hoogte,
    geupload:      bestaand.geupload || new Date().toISOString(),
    origineleNaam: origineleNaam || bestaand.origineleNaam || '',
  };
  storage.writeJSON('media.json', media);
}

function _unregisterMedia(id) {
  const media = storage.readJSON('media.json');
  if (media.files && media.files[id]) {
    delete media.files[id];
    storage.writeJSON('media.json', media);
  }
}

// Guarded cascade-delete: wis een bestand alleen als er na het verwijderen van
// het bron-record géén verwijzing meer naar over is (anders blijft het bestand
// staan voor de overige gebruikers). ROEP AAN nadat het record is weggeschreven.
function _deleteFileIfUnused(id) {
  if (mediaUsage.isUsed(id)) return false;
  storage.deleteFile(id);
  _unregisterMedia(id);
  return true;
}

// Backfill: voeg bestanden uit files/ toe die nog niet in media.json staan
// (naam = fileId, mtime als upload-datum, afmetingen lazy via sharp).
async function _backfillMedia() {
  const media = storage.readJSON('media.json');
  if (!media.files) media.files = {};
  let dir;
  try { dir = fs.readdirSync(storage.FILES_DIR); } catch { return media; }
  let dirty = false;
  for (const fname of dir) {
    const id = fname.replace(/\.[^.]+$/, '');
    if (media.files[id]) continue;
    if (/^spell-img-/.test(id)) continue;   // afgeleide spreukweergave-kopieën horen niet in de bibliotheek
    const file = storage.getFile(id);
    if (!file) continue;
    let grootte = null, geupload = new Date().toISOString();
    try { const st = fs.statSync(file.path); grootte = st.size; geupload = st.mtime.toISOString(); } catch {}
    const type = _MIME_TYPE_GROEP(file.mimetype);
    let breedte = null, hoogte = null;
    if (type === 'afbeelding' && _sharp && file.mimetype !== 'image/svg+xml') {
      try { const m = await _sharp(file.path).metadata(); breedte = m.width || null; hoogte = m.height || null; } catch {}
    }
    media.files[id] = { naam: id, type, mime: file.mimetype || '', grootte, breedte, hoogte, geupload, origineleNaam: '' };
    dirty = true;
  }
  if (dirty) storage.writeJSON('media.json', media);
  return media;
}

// Lijst: metadata + live berekend gebruik per bestand.
router.get('/media', requireDM, async (req, res) => {
  try {
    const media = await _backfillMedia();
    const ids = Object.keys(media.files || {});
    const usage = mediaUsage.scanUsage(ids);
    const files = ids.map(id => ({
      id,
      ...media.files[id],
      gebruik: usage[id] || [],
    })).sort((a, b) => (b.geupload || '').localeCompare(a.geupload || ''));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weergavenaam wijzigen.
router.patch('/media/:id', requireDM, (req, res) => {
  const media = storage.readJSON('media.json');
  if (!media.files || !media.files[req.params.id]) return res.status(404).json({ error: 'Niet gevonden' });
  const naam = (req.body?.naam || '').trim();
  if (!naam) return res.status(400).json({ error: 'Naam vereist' });
  media.files[req.params.id].naam = naam.slice(0, 200);
  storage.writeJSON('media.json', media);
  res.json({ id: req.params.id, naam: media.files[req.params.id].naam });
});

// Verwijderen. Weigert (409 + gebruikslijst) zolang het bestand in gebruik is,
// tenzij ?force=1. Geen stille verwijdering — campagneregel.
router.delete('/media/:id', requireDM, (req, res) => {
  const id = req.params.id;
  const force = req.query.force === '1';
  const gebruik = mediaUsage.scanUsage([id])[id] || [];
  if (gebruik.length && !force) {
    return res.status(409).json({ error: 'Bestand is nog in gebruik', gebruik });
  }
  storage.deleteFile(id);
  _unregisterMedia(id);
  res.json({ ok: true, verwijderd: id, wasGebruikt: gebruik });
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
// Geldige serviceAmbiance-keys: huidige diensten, per-factie (factie:<id> tegen
// meta.facties) en de rust-loops. Vervangt de oude vaste _DIENST_KEYS-lijst.
const _DIENST_SVC_KEYS = ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'magizoo'];
const _REST_SVC_KEYS = ['rust-veld', 'rust-herberg', 'rust-kort'];
function _validSvcKey(key) {
  if (_DIENST_SVC_KEYS.includes(key) || _REST_SVC_KEYS.includes(key)) return true;
  const m = String(key).match(/^factie:(.+)$/);
  if (m) {
    try {
      const meta = storage.readJSON('meta.json');
      return (meta.facties || []).some(f => f.id === m[1]);
    } catch { return false; }
  }
  return false;
}

router.get('/sounds', (req, res) => {
  let data = storage.readJSON('sounds.json');
  if (!data) data = { standard: {}, emotes: {}, playerTurn: {} };
  if (!data.playerTurn) data.playerTurn = {};
  _ensureAmbiance(data);
  res.json(data);
});

// Conditie-geluiden: whitelist zodat er geen willekeurige sleutels in sounds.json
// belanden. Zelfde gedachte als _validSvcKey voor de dienst-loops. Lijst spiegelt
// _COND_IDS in public/js/combat-canvas.js.
const _CONDITION_SOUND_KEYS = new Set([
  'blinded', 'charmed', 'concentration', 'deafened', 'exhaustion', 'frightened',
  'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious', 'bleeding', 'burning', 'flying',
  'raging', 'dodging', 'hidden', 'readied', 'cover-half', 'cover-three-quarters',
  'grappling', 'mounted', 'underwater', 'haste',
]);

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
      if (!_validSvcKey(k)) continue;                   // diensten + factie:<id> + rust-*
      if (v === null) delete data.serviceAmbiance[k];
      else data.serviceAmbiance[k] = String(v).slice(0, 100);
    }
  }
  if (req.body.conditions && typeof req.body.conditions === 'object') {
    if (!data.conditions) data.conditions = {};
    for (const [k, v] of Object.entries(req.body.conditions)) {
      if (!_CONDITION_SOUND_KEYS.has(k)) continue;
      if (v === null) delete data.conditions[k];
      else data.conditions[k] = String(v).slice(0, 100);
    }
  }
  storage.writeJSON('sounds.json', data);
  // Clients hun sound-config laten herladen (fixt staleness van nieuw ingestelde loops).
  req.app.get('io').to(req.session?.campaignId || 'main').emit('sounds:updated');
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

// Speel een geluid bij een reveal (regie-balk). loop=true → loopende ambiance
// (broadcast wint, vervangt de achtergrond); loop=false → eenmalige sting.
// Transient: niets opgeslagen, alleen broadcast naar de (tablet-)clients.
router.post('/sounds/reveal', requireDM, (req, res) => {
  const { fileId, label, loop } = req.body;
  if (!fileId) return res.status(400).json({ error: 'fileId vereist' });
  req.app.get('io').to(req.session?.campaignId || 'main').emit('sound:reveal', {
    fileId: String(fileId),
    label:  label ? String(label).slice(0, 100) : '',
    loop:   !!loop,
  });
  res.json({ ok: true });
});

// ── Klasse-progressie (skill trees) ──────────────────────────────
// GET geeft de campagne-eigen progressie terug, of anders de meegeleverde
// 2024-seed (public/data/class-progression.json). De DM kan een eigen versie
// opslaan; resetten verwijdert de override.

const _PROGRESSION_SEED = path.join(__dirname, '..', 'public', 'data', 'class-progression.json');
const _BACKGROUNDS_SEED = path.join(__dirname, '..', 'public', 'data', 'backgrounds-2024.json');

function _readProgressionSeed() {
  try { return JSON.parse(fs.readFileSync(_PROGRESSION_SEED, 'utf8')); }
  catch { return { classes: {}, species: {} }; }
}
function _readBackgroundsSeed() {
  try { return JSON.parse(fs.readFileSync(_BACKGROUNDS_SEED, 'utf8')); }
  catch { return {}; }
}

router.get('/progression', attachRole, (req, res) => {
  const saved = storage.readJSON('progression.json');
  const base = (saved && saved.classes && Object.keys(saved.classes).length)
    ? { ...saved, _custom: true }
    : { ..._readProgressionSeed(), _custom: false };
  // Backgrounds-fallback: vul de meegeleverde 2024-bibliotheek aan als er nog
  // geen campagne-eigen backgrounds zijn opgeslagen.
  if (!base.backgrounds || !Object.keys(base.backgrounds).length) {
    base.backgrounds = _readBackgroundsSeed();
  }
  res.json(base);
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
    feats:   body.feats && typeof body.feats === 'object' ? body.feats : undefined,
    backgrounds: body.backgrounds && typeof body.backgrounds === 'object' ? body.backgrounds : undefined,
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

// ── Printbare character sheets (DM) ──────────────────────────────────────────
// Bouwt een print-pagina met een blad per personage. De DM opent 'm, drukt op
// print en de hele party gaat met vers papier naar huis. We bakken bewust geen
// fillable WotC-pdf: dat formulier heeft geen vakjes voor boedel, de eigen munt
// (Florinde/Knaker/Centeling) of factie-titels. Opmaak: lib/character-sheet.js.

const _sheetNorm = (s) => String(s || '').trim().toLowerCase();

// Zelfde zoekregels als render-progressie.js: exacte naam, dan aliassen, dan
// prefix (klasse) / losse includes-match in beide richtingen (subklasse).
function _sheetVindKlasse(prog, naam) {
  if (!prog?.classes || !naam) return null;
  const n = _sheetNorm(naam);
  for (const [key, data] of Object.entries(prog.classes)) {
    if (_sheetNorm(key) === n || (data.aliassen || []).some(a => _sheetNorm(a) === n)) return { key, data };
  }
  for (const [key, data] of Object.entries(prog.classes)) {
    if (n.startsWith(_sheetNorm(key))) return { key, data };
  }
  return null;
}
function _sheetVindSoort(prog, naam) {
  if (!prog?.species || !naam) return null;
  const n = _sheetNorm(naam);
  for (const [key, data] of Object.entries(prog.species)) {
    if (_sheetNorm(key) === n || (data.aliassen || []).some(a => _sheetNorm(a) === n)) return { key, data };
  }
  return null;
}
function _sheetVindSub(klasseData, naam) {
  if (!klasseData?.subclasses || !naam) return null;
  const n = _sheetNorm(naam);
  for (const [key, data] of Object.entries(klasseData.subclasses)) {
    if (_sheetNorm(key) === n || n.includes(_sheetNorm(key)) || _sheetNorm(key).includes(n)) return { key, data };
  }
  return null;
}
function _sheetVindBackground(prog, naam) {
  if (!prog?.backgrounds || !naam) return null;
  const n = _sheetNorm(naam);
  for (const [key, data] of Object.entries(prog.backgrounds)) {
    if (_sheetNorm(key) === n || n.includes(_sheetNorm(key))) return { key, data };
  }
  return null;
}

// Verzamel alles wat het personage tot en met zijn huidige level ontgrendeld heeft.
function _sheetFeatures(prog, profiel) {
  const totaal  = parseInt(profiel.level ?? profiel.klasseLevel) || 1;
  const groepen = [];
  const tot = (data, max) => {
    const uit = [];
    for (const lvl of Object.keys(data?.levels || {}).map(Number).sort((a, b) => a - b)) {
      if (lvl > max) continue;
      for (const f of (data.levels[lvl] || [])) uit.push({ ...f, level: lvl });
    }
    return uit;
  };

  const klassen = [[profiel.klasse, profiel.klasseLevel ?? profiel.level, profiel.subclass]];
  if ((profiel.multiclass === true || profiel.multiclass === 'true') && profiel.multiKlasse) {
    klassen.push([profiel.multiKlasse, profiel.multiKlasseLevel, null]);
  }
  for (const [naam, lvl, subNaam] of klassen) {
    const kl = _sheetVindKlasse(prog, naam);
    if (!kl) continue;
    const max = parseInt(lvl) || totaal;
    groepen.push({ titel: kl.key, items: tot(kl.data, max) });
    const sub = _sheetVindSub(kl.data, subNaam);
    if (sub) groepen.push({ titel: `${sub.key} (subclass)`, items: tot(sub.data, max) });
  }

  const soort = _sheetVindSoort(prog, profiel.origin || profiel.ras);
  if (soort) groepen.push({ titel: soort.key, items: tot(soort.data, totaal) });
  const bg = _sheetVindBackground(prog, profiel.background);
  if (bg) groepen.push({ titel: `${bg.key} (background)`, items: tot(bg.data, 1).map(f => ({ ...f, level: null })) });

  return groepen;
}

// De boedel van een speler heeft twéé bronnen — dezelfde twee die het
// Boedel-tabblad toont. `playerItems` zijn losse regels die de DM toevoegt;
// de voorwerp-kaartjes zijn echte entities waarvan het eigendom in
// `groups[gid].itemOwners` staat (entityId → owner, of een lijst bij stapelbare
// items met een aantal). Alleen `playerItems` pakken liet de helft weg.
function _sheetVoorwerpen(dmState, characterId) {
  const gid = _playerGroupId(dmState, characterId);
  const g   = gid ? getGroup(dmState, gid) : null;
  if (!g?.itemOwners) return [];
  const alle = storage.readJSON('entities.json').voorwerpen || [];
  const uit  = [];
  for (const [entityId, eigenaar] of Object.entries(g.itemOwners)) {
    const mijn = Array.isArray(eigenaar)
      ? eigenaar.find(o => o.characterId === characterId)
      : (eigenaar?.characterId === characterId ? eigenaar : null);
    if (!mijn || (mijn.qty != null && mijn.qty <= 0)) continue;
    const v = alle.find(x => x.id === entityId);
    if (!v) continue;
    const maxCharges = (g.itemMaxCharges || {})[entityId] ?? (parseInt(v.data?.maxCharges) || 0);
    uit.push({
      name:       v.name,
      itemType:   v.data?.itemType || '',
      rariteit:   v.data?.rariteit || '',
      attunement: v.data?.attunement === true || v.data?.attunement === 'true',
      qty:        Array.isArray(eigenaar) ? (mijn.qty || 1) : null,
      charges:    maxCharges > 0 ? { nu: (g.itemCharges || {})[entityId] ?? maxCharges, max: maxCharges } : null,
      desc:       v.data?.desc || '',
    });
  }
  return uit.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// De party in de kop van blad 1: elk medespeler-personage uit dezelfde groep,
// met de fileId van zijn portret (dezelfde afleiding als api.thumbForEntity:
// data.imageId, anders het entity-id zelf) en het focuspunt uit imgFocus, zodat
// een portret dat hoog in het kader staat niet op de kin wordt afgesneden.
function _sheetParty(dmState, entity, personages) {
  const gid = _playerGroupId(dmState, entity.id);
  if (!gid) return [];
  return (personages || [])
    .filter(e => e.subtype === 'speler' && e.data?.groep === gid)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(e => ({
      naam:  e.name,
      thumb: e.data?.imageId || e.id,
      focus: e.data?.imgFocus || '',
      zelf:  e.id === entity.id,
    }));
}

// Bouw de sheet-data voor één personage uit alles wat de campagne bijhoudt.
function _sheetPersonage(entity, dmState, prog, meta, personages) {
  const id      = entity.id;
  const profiel = (dmState.playerProfiles || {})[id] || {};
  const gid     = _playerGroupId(dmState, id);
  const groep   = gid ? getGroup(dmState, gid) : null;
  return {
    naam:      entity.name,
    campagne:  meta.appTitle || '',
    groepNaam: groep?.name || '',
    party:     _sheetParty(dmState, entity, personages),
    profiel,
    hp:        (dmState.playerHp || {})[id] || {},
    hitDice:   { pool: _hitDicePool(profiel), spent: (dmState.playerHitDice || {})[id]?.spent || {} },
    slots:     (dmState.playerSpellSlots || {})[id] || {},
    // Zelfde regel als _effectiveCurrency(): staat de gedeelde beurs aan, dán is
    // dát de beurs van de party en telt playerCurrency niet meer mee. Anders
    // andersom niet allebei tonen — dan zou een speler denken dat hij 99 fl
    // eigen geld heeft terwijl de app dat nergens meer gebruikt.
    beurs: groep?.sharedPurse?.enabled
      ? { gedeeld: { fl: groep.sharedPurse.fl || 0, kn: groep.sharedPurse.kn || 0, cl: groep.sharedPurse.cl || 0 } }
      : { persoonlijk: (dmState.playerCurrency || {})[id] || { fl: 0, kn: 0, cl: 0 } },
    muntNamen:  meta.currency || { fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' },
    items:      (dmState.playerItems || {})[id] || [],
    voorwerpen: _sheetVoorwerpen(dmState, id),
    // Vastgezette kenmerken (Bardic Inspiration, Rage…) en eigen tellers. Beide
    // gebruiken dezelfde semantiek als in de app: `current`/`currentUses` is het
    // aantal VERBRUIKTE bolletjes, niet het aantal dat nog over is.
    traits:     (dmState.playerTraits || {})[id] || [],
    trackers:   (dmState.playerTrackers || {})[id] || [],
    spreuken:   (dmState.playerSpells || {})[id] || [],
    features:   _sheetFeatures(prog, profiel),
  };
}

function _sheetProgressie() {
  const saved = storage.readJSON('progression.json');
  const base = (saved && saved.classes && Object.keys(saved.classes).length)
    ? saved : _readProgressionSeed();
  if (!base.backgrounds || !Object.keys(base.backgrounds).length) base.backgrounds = _readBackgroundsSeed();
  return base;
}

// GET /characters/:id/sheet — één blad
router.get('/characters/:id/sheet', requireDM, (req, res) => {
  const personages = storage.readJSON('entities.json').personages || [];
  const entity = personages.find(e => e.id === req.params.id);
  if (!entity) return res.status(404).send('Personage niet gevonden');
  const dmState = readDmState();
  const meta    = storage.readJSON('meta.json') || {};
  const p = _sheetPersonage(entity, dmState, _sheetProgressie(), meta, personages);
  res.type('html').send(sheetHtml([p], { titel: entity.name }));
});

// GET /party/sheets?groep=<id> — de hele groep in één print-opdracht
router.get('/party/sheets', requireDM, (req, res) => {
  const dmState = readDmState();
  const meta    = storage.readJSON('meta.json') || {};
  const groepId = req.query.groep || dmState.activeGroup;
  const personages = storage.readJSON('entities.json').personages || [];
  const spelers = personages
    .filter(e => e.subtype === 'speler' && (!groepId || e.data?.groep === groepId))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!spelers.length) return res.status(404).send('Geen personages in deze groep');
  const prog = _sheetProgressie();
  const naam = dmState.groups?.[groepId]?.name || meta.appTitle || 'Character sheets';
  res.type('html').send(sheetHtml(
    spelers.map(e => _sheetPersonage(e, dmState, prog, meta, personages)),
    { titel: naam }
  ));
});

// ── Help-teksten (DM-aanpasbare inhoud van helpknoppen) ──

router.get('/help-content', attachRole, (req, res) => {
  const dm = readDmState();
  res.json(dm.helpContent || {});
});

router.put('/help-content/:key', requireDM, (req, res) => {
  const dm = readDmState();
  if (!dm.helpContent) dm.helpContent = {};
  const key = decodeURIComponent(req.params.key);
  const { titel, stappen } = req.body || {};
  if (!Array.isArray(stappen)) return res.status(400).json({ error: 'stappen vereist' });
  dm.helpContent[key] = { titel: titel || null, stappen };
  storage.writeJSON('dm-state.json', dm);
  res.json({ ok: true });
});

router.delete('/help-content/:key', requireDM, (req, res) => {
  const dm = readDmState();
  if (dm.helpContent) delete dm.helpContent[decodeURIComponent(req.params.key)];
  storage.writeJSON('dm-state.json', dm);
  res.json({ ok: true });
});

// ── Meta ──

router.get('/meta', (req, res) => {
  res.json(storage.readJSON('meta.json'));
});

// Focuspunt (object-position) van een spreukafbeelding, per spell-index.
router.put('/meta/spell-image-focus/:index', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.spellImageFocus) meta.spellImageFocus = {};
  const focus = String(req.body.focus || '').trim();
  if (focus) meta.spellImageFocus[req.params.index] = focus;
  else delete meta.spellImageFocus[req.params.index];
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json({ ok: true, focus });
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

// De actieve akte is per groep, zodat twee groepen tegelijk middenin een akte
// kunnen staan. dmState.activeAkte blijft als terugval bestaan voor oudere data
// (en voor lezers zonder groepscontext).
function _activeAkteVoor(dmState, groupId) {
  const gid = groupId || dmState.activeGroup;
  return (gid && dmState.groups?.[gid]?.activeAkte) || dmState.activeAkte || null;
}

// Actieve akte onthouden (gezet wanneer de DM een akte 'speelt'). Bepaalt o.a. Ursula's doel-akte.
router.post('/akte/actief', requireDM, (req, res) => {
  const { key, num, title, groupId } = req.body || {};
  const dmState = readDmState();
  const akte = { key: key || null, num: num ?? null, title: title || '' };
  const gid = groupId || dmState.activeGroup;
  if (gid && dmState.groups?.[gid]) dmState.groups[gid].activeAkte = akte;
  dmState.activeAkte = akte;   // spiegel: laatst gespeelde akte, terugval voor oude lezers
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId||'main').emit('ursula:updated');
  res.json(akte);
});

// ── Regie-voortgang: welke script-stappen zijn al gedaan? ────────────────────
// De effecten van een onthulling waren al persistent (zichtbaarheid per groep,
// documentstatus, afbeeldingen), maar de administratie ervan leefde alleen in
// het browsergeheugen van de DM. Sloot je het venster halverwege een akte, dan
// begon de regie-balk weer op 0/x terwijl de spelers hun onthullingen hielden.
// Per groep opgeslagen, want twee groepen spelen dezelfde akte los van elkaar.
router.get('/akte/:key/voortgang', requireDM, (req, res) => {
  const dmState = readDmState();
  const gid = req.query.groupId || dmState.activeGroup;
  const v = (gid && dmState.groups?.[gid]?.akteVoortgang?.[req.params.key]) || null;
  // Bij een pauze ook de huidige stand meesturen, zodat de client het verschil
  // kan tonen zonder tweede ronde requests.
  let pauze = null;
  if (v?.pauze) {
    pauze = { op: v.pauze.op, personages: {} };
    for (const [cid, snap] of Object.entries(v.pauze.personages || {})) {
      const nu = (dmState.playerHp || {})[cid] || {};
      const prof = (dmState.playerProfiles || {})[cid] || {};
      pauze.personages[cid] = {
        ...snap,
        nuCur:   nu.current ?? null,
        nuMax:   Number(nu.max) || null,
        nuLevel: prof.level ?? null,
      };
    }
  }
  res.json({ stappen: v?.stappen || [], bijgewerkt: v?.bijgewerkt || null, pauze, groupId: gid || null });
});

// ── Akte pauzeren en hervatten ──────────────────────────────────────────────
// Een sessie eindigt zelden precies op het einde van een akte. Pauzeren legt
// het moment vast; hervatten toont wat er sindsdien veranderd is en laat de DM
// per personage beslissen.
//
// HP wordt bewaard als WÓND (max - current), niet als HP-getal. Groeit een
// personage tussendoor door naar een hogere max, dan levert de wond bij
// hervatten het juiste nieuwe getal op — een opgeslagen "12" zou dat niet doen.
// Toepassen gebeurt nooit automatisch: alleen de DM weet of het tussenliggende
// spel in de fictie vóór of ná dit moment plaatsvond.
function _spelersVanGroep(groepId) {
  const entities = storage.readJSON('entities.json');
  return (entities.personages || []).filter(
    e => e.subtype === 'speler' && e.data?.groep === groepId
  );
}

router.post('/akte/:key/pauze', requireDM, (req, res) => {
  const dmState = readDmState();
  const gid = req.body?.groupId || dmState.activeGroup;
  if (!gid || !dmState.groups?.[gid]) return res.status(400).json({ error: 'Geen actieve groep' });
  const g = dmState.groups[gid];
  if (!g.akteVoortgang) g.akteVoortgang = {};
  const huidig = g.akteVoortgang[req.params.key] || { stappen: [] };

  const personages = {};
  for (const sp of _spelersVanGroep(gid)) {
    const hp   = (dmState.playerHp || {})[sp.id] || {};
    const prof = (dmState.playerProfiles || {})[sp.id] || {};
    const max  = Number(hp.max) || null;
    const cur  = hp.current == null ? null : Number(hp.current);
    personages[sp.id] = {
      naam:  sp.name || '',
      hpCur: cur,
      hpMax: max,
      wond:  (max != null && cur != null) ? Math.max(0, max - cur) : null,
      level: prof.level ?? null,
      tempHp: hp.temp ?? null,     // temp-HP leeft als playerHp[id].temp
    };
  }

  huidig.pauze = { op: new Date().toISOString(), personages };
  g.akteVoortgang[req.params.key] = huidig;
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, personages: Object.keys(personages).length, op: huidig.pauze.op });
});

// Hervatten: pas alleen de personages toe die de DM aanvinkt. hpNieuw =
// huidige max - de bewaarde wond, geklemd binnen [0, max].
router.post('/akte/:key/hervat', requireDM, (req, res) => {
  const dmState = readDmState();
  const gid = req.body?.groupId || dmState.activeGroup;
  const g = gid && dmState.groups?.[gid];
  const pauze = g?.akteVoortgang?.[req.params.key]?.pauze;
  if (!pauze) return res.status(404).json({ error: 'Geen pauze-moment voor deze akte' });

  const kiezen = Array.isArray(req.body?.toepassen) ? req.body.toepassen : [];
  if (!dmState.playerHp) dmState.playerHp = {};
  const toegepast = [];
  for (const charId of kiezen) {
    const snap = pauze.personages?.[charId];
    if (!snap || snap.wond == null) continue;
    const hp = dmState.playerHp[charId];
    const max = Number(hp?.max) || snap.hpMax;
    if (!max) continue;
    const nieuw = Math.max(0, Math.min(max, max - snap.wond));
    // Spreid het bestaande object uit: playerHp bevat naast current/max ook
    // temp (temporary HP). Dat mag een hervatting niet wissen.
    dmState.playerHp[charId] = { ...(hp || {}), current: nieuw, max };
    toegepast.push({ charId, naam: snap.naam, hp: nieuw, max });
  }
  // Pauze is verbruikt; de voortgang (stappen) blijft staan.
  delete g.akteVoortgang[req.params.key].pauze;
  storage.writeJSON('dm-state.json', dmState);
  if (toegepast.length) {
    req.app.get('io').to(req.session?.campaignId || 'main').emit('player:hp-updated');
  }
  res.json({ ok: true, toegepast });
});

router.put('/akte/:key/voortgang', requireDM, (req, res) => {
  const dmState = readDmState();
  const gid = req.body?.groupId || dmState.activeGroup;
  if (!gid || !dmState.groups?.[gid]) return res.status(400).json({ error: 'Geen actieve groep' });
  const stappen = Array.isArray(req.body?.stappen)
    ? req.body.stappen.filter(x => typeof x === 'string').slice(0, 500)
    : [];
  const g = dmState.groups[gid];
  if (!g.akteVoortgang) g.akteVoortgang = {};
  g.akteVoortgang[req.params.key] = { stappen, bijgewerkt: new Date().toISOString() };
  storage.writeJSON('dm-state.json', dmState);
  res.json({ ok: true, aantal: stappen.length });
});

router.put('/meta/herberg', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.herberg) meta.herberg = {};
  const allowed = ['naam','waard','imageId','backdropId','maxVragen','cooldownMinutenMin','cooldownMinutenMax','groet','overnachtingPrijs','menu'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) meta.herberg[f] = req.body[f];
  }
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.herberg);
});

// ── Rust-instellingen (backdrops + gebeurtenissen-tabel) ──
router.put('/meta/rust', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.rust) meta.rust = {};
  const allowed = ['veldBackdropId', 'korteRustBackdropId', 'eventTableId', 'veldEventTableId', 'herbergEventTableId'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) meta.rust[f] = req.body[f];
  }
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.rust);
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
  if (req.body.imageId) map.imageId = req.body.imageId;  // mediabibliotheek-afbeelding
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
  if (req.body.description !== undefined) map.description = String(req.body.description || '').slice(0, 600);
  storage.writeJSON('map.json', mapData);
  req.app.get('io').to(req.session?.campaignId||'main').emit('map:updated');
  res.json(map);
});

router.delete('/map/maps/:id', requireDM, (req, res) => {
  const mapData = storage.readJSON('map.json');
  if (!mapData.maps) mapData.maps = [...DEFAULT_MAPS];
  const map = mapData.maps.find(m => m.id === req.params.id);
  mapData.maps = mapData.maps.filter(m => m.id !== req.params.id);
  mapData.pins = (mapData.pins || []).filter(p => (p.mapId || 'grisburgh') !== req.params.id);
  storage.writeJSON('map.json', mapData);
  if (map && !map.src) {                              // ingebouwde kaarten (src) overslaan
    _deleteFileIfUnused(map.imageId || map.id);       // bibliotheek-afbeelding of oude upload op map-id
  }
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
  const dying = (data.monsters || []).find(m => m.id === req.params.id);
  data.monsters = (data.monsters || []).filter(m => m.id !== req.params.id);
  storage.writeJSON('monsters.json', data);
  // Geüploade afbeeldingen opruimen als ze nergens anders meer gebruikt worden
  for (const fid of [dying?.imageId, dying?.backdropId]) if (fid) _deleteFileIfUnused(fid);
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
    description: m.description || '',
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
    const g = getGroup(dmState);
    const kennis  = g?.bestiarium || {};
    const roddels = g?.bestiariumRoddels || {};
    const bron    = g?.bestiariumBron || {};
    // DM ziet alles volledig + het kennisniveau/roddel-status van de actieve groep.
    return res.json({ role: 'dm', monsters: monsters.map(m => ({
      ...m, _niveau: kennis[m.id] || null,
      _roddelGehoord: !!roddels[m.id], _bron: bron[m.id] || null,
    })) });
  }
  if (!req.session.characterId) return res.json({ role: 'player', monsters: [] });
  const g = getGroup(dmState, _playerGroupId(dmState, req.session.characterId));
  const kennis  = g?.bestiarium || {};
  const roddels = g?.bestiariumRoddels || {};
  const bron    = g?.bestiariumBron || {};
  const out = monsters.filter(m => kennis[m.id]).map(m => {
    const o = _bestiariumForTier(m, kennis[m.id]);
    o._roddel = roddels[m.id] ? (m.roddel || '') : '';   // alleen tonen als gehoord
    o._bron   = bron[m.id] || null;
    return o;
  });
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
  const combat = storage.readJSON('combat.json');
  if (req.role === 'dm') return res.json(combat);

  // Speler: voeg kennisniveau + gefilterd statblock toe aan monster-combatants
  // zodat de spelersinterface het bekende stat block kan tonen.
  const dmState  = readDmState();
  const gid      = req.session.characterId ? _playerGroupId(dmState, req.session.characterId) : null;
  const kennis   = gid ? (getGroup(dmState, gid)?.bestiarium || {}) : {};
  const monsters = (storage.readJSON('monsters.json').monsters || []);

  const enriched = {
    ...combat,
    combatants: (combat.combatants || []).map(c => {
      if (c.type !== 'monster' || !c.presetId) return c;
      const niveau = kennis[c.presetId] || null;
      if (!niveau) return { ...c, _niveau: null };
      const m = monsters.find(m => m.id === c.presetId);
      if (!m) return { ...c, _niveau: niveau };
      return { ...c, _niveau: niveau, _statblock: _bestiariumForTier(m, niveau) };
    }),
  };
  res.json(enriched);
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
  const combat = { active: true, round: 1, currentTurn: 0, combatants, encounterId: existing.encounterId || null, backdropId: existing.backdropId || null, canvasPreset: existing.canvasPreset || null, canvasColors: existing.canvasColors || null, log: [] };
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

// Schrijf het gevechtslog stilzwijgend weg naar de actieve akte. Tijdens het
// spelen stond het alleen maar in de weg, maar achteraf wil je het wél kunnen
// nalezen. Geen knop en geen melding: het gebeurt gewoon bij het afsluiten.
// De entry krijgt bewust géén `visible`, dus hij is DM-only — spelers zien in
// GET /archief alleen sessieLog-regels mét die vlag.
function _dumpCombatLog(combat, req) {
  const regels = (combat?.log || []).filter(r => r && r.text);
  if (!regels.length) return;
  const dmState = readDmState();
  const akte = _activeAkteVoor(dmState)?.key;
  if (!akte) return;                       // geen actieve akte → nergens aan te hangen
  const archief = storage.readJSON('archief.json');
  if (!Array.isArray(archief.sessieLog)) archief.sessieLog = [];
  // Monsternamen ontdubbeld (het genummerde achtervoegsel eraf) voor de titel.
  const namen = [...new Set((combat.combatants || [])
    .filter(c => c.type === 'monster')
    .map(c => String(c.name || '').replace(/\s+\d+$/, '')))].filter(Boolean);
  archief.sessieLog.push({
    id:                    'sl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    hoofdstuk:             akte,
    datum:                 new Date().toISOString().slice(0, 10),
    korteSamenvatting:     'Gevechtslog' + (namen.length ? ` — ${namen.slice(0, 3).join(', ')}` : ''),
    samenvatting:          regels.map(r => `R${r.round}  ${r.text}`).join('\n'),
    images: [], nieuwPersonages: [], terugkerendPersonages: [], nieuwLocaties: [],
    terugkerendLocaties: [], organisaties: [], voorwerpen: [], docs: [], nieuw: [], terugkerend: [],
  });
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('logboek:updated', {});
}

router.delete('/combat', requireDM, (req, res) => {
  // Persisteer speler-HP naar dm-state vóór het wissen van het gevecht
  const prevCombat = storage.readJSON('combat.json');
  _flushPlayerHpToDmState(prevCombat, req.app.get('io'), req.session?.campaignId||'main');
  _dumpCombatLog(prevCombat, req);
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
    ownerId:    req.body.ownerId    || null,
    statblock:  req.body.statblock  || null,
  };
  if (!Array.isArray(combat.combatants)) combat.combatants = [];
  combat.combatants.push(c);
  combat.combatants.sort((a, b) => b.initiative - a.initiative);
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  res.status(201).json(c);
});

// Voeg alle huisdieren (dier-companions) van de actieve groep toe als summons,
// met geschaalde (bevroren) statblock o.b.v. het level van het baasje + ownerId.
router.post('/combat/voeg-metgezellen', requireDM, (req, res) => {
  const combat   = storage.readJSON('combat.json');
  const dmState  = readDmState();
  const entities = storage.readJSON('entities.json');
  const g        = getGroup(dmState);
  if (!Array.isArray(combat.combatants)) combat.combatants = [];

  const added = [];
  for (const petId of (g.companions || [])) {
    const pet = (entities.personages || []).find(e => e.id === petId && e.subtype === 'dier');
    if (!pet) continue;
    if (combat.combatants.some(c => c.entityId === petId)) continue;  // niet dubbel
    const info = _petStatblockInfo(pet, dmState, dmState.activeGroup);
    const petName = (g.companionNames || {})[petId] || pet.name;
    const dexMod = Math.floor(((parseInt(info.statblock?.dex) || 10) - 10) / 2);
    const ownerCombatant = info.ownerId ? combat.combatants.find(c => c.entityId === info.ownerId) : null;
    const initiative = ownerCombatant ? ownerCombatant.initiative : (Math.floor(Math.random() * 20) + 1 + dexMod);
    combat.combatants.push({
      id:         'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name:       `${petName} (${info.label})`,
      entityId:   petId, presetId: null,
      imageId:    petId, backdropId: null,
      type:       'summon',
      ownerId:    info.ownerId || null,
      initiative,
      hp:         info.maxHp ?? 10,
      maxHp:      info.maxHp ?? 10,
      ac:         info.statblock?.ac || '',
      conditions: [],
      statblock:  info.statblock || null,
    });
    added.push(`${pet.name} (${info.label})`);
  }
  combat.combatants.sort((a, b) => b.initiative - a.initiative);
  storage.writeJSON('combat.json', combat);
  req.app.get('io').to(req.session?.campaignId||'main').emit('combat:updated', combat);
  res.json({ ok: true, added });
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
  const io   = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  // Huisdier overlijdt na 3 gefaalde death saves → ontkoppel als companion + markeer overleden.
  const cur = combat.combatants[idx];
  if (req.body.deathSaves && (req.body.deathSaves.failures || 0) >= 3 && cur.entityId) {
    const dmState = readDmState();
    const isPet = (storage.readJSON('entities.json').personages || []).some(e => e.id === cur.entityId && e.subtype === 'dier');
    if (isPet) {
      const groups = _petDie(dmState, cur.entityId);
      if (groups.length) {
        storage.writeJSON('dm-state.json', dmState);
        for (const gid of groups) io.to(room).emit('companion:unlink', { npcId: cur.entityId, name: cur.name, groupId: gid });
      }
    }
  }
  io.to(room).emit('combat:updated', combat);
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

// ── Lootverdeler ─────────────────────────────────────────────────────────────
// Eén actieve lootfase tegelijk (dmState.lootPhase). Loot komt uit de encounter
// (combat.encounterId) of wordt handmatig opgebouwd. Spelers claimen items; bij
// afsluiting wint de hoogste worp en splitst het goud over de deelnemers.

// Deelnemers = speler-combatants van het lopende gevecht; is er geen gevecht,
// dan de spelers die vanavond aan tafel zitten.
function _lootDeelnemers(combat, dmState) {
  const fromCombat = (combat.combatants || []).filter(c => c.type === 'player' && c.entityId).map(c => c.entityId);
  if (fromCombat.length) return [...new Set(fromCombat)];
  const gid = dmState.activeGroup;
  const entities = storage.readJSON('entities.json');
  return _aanwezigeSpelers(dmState, gid, entities.personages).map(e => e.id);
}

// Lootfase voor de client; voor spelers worden claim-namen verborgen (alleen aantal + of jij claimde).
function _lootForClient(lp, role, characterId) {
  if (!lp) return null;
  const isDM = role === 'dm';
  return {
    actief: lp.actief, encounterId: lp.encounterId, goud: lp.goud, goudVerdeeld: lp.goudVerdeeld,
    deelnemers: lp.deelnemers,
    items: (lp.items || []).map(it => ({
      id: it.id, naam: it.naam, beschrijving: it.beschrijving, rariteit: it.rariteit, entityId: it.entityId || null,
      bron: it.bron || '',
      status: it.status, winnaar: isDM ? it.winnaar : undefined,
      claimCount: (it.claims || []).length,
      claims: isDM ? it.claims : undefined,
      ikClaim: characterId ? (it.claims || []).includes(characterId) : false,
      dobbelrol: isDM ? it.dobbelrol : undefined,
    })),
  };
}

// Loot-item → speler-boedelitem (met optionele entity-koppeling + rariteit).
function _lootItemToPlayerItem(it) {
  const pi = { id: 'pi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), name: it.naam, note: it.beschrijving || '' };
  if (it.entityId) { pi.entityId = it.entityId; pi.entityType = 'voorwerpen'; }
  if (it.rariteit) pi.rariteit = it.rariteit;
  return pi;
}

// Voeg valuta toe aan een speler (individueel).
function _addCurrency(dmState, characterId, addCl) {
  if (!dmState.playerCurrency) dmState.playerCurrency = {};
  const cur = dmState.playerCurrency[characterId] || { fl: 0, kn: 0, cl: 0 };
  dmState.playerCurrency[characterId] = fromCl(toCl(cur) + addCl);
  return dmState.playerCurrency[characterId];
}

// ── Loot-events ──────────────────────────────────────────────────────────────
// Een loot-event is één vondst: de geldzak in de haard, het zwaard onder de
// plavuizen. Eén kamer kan er meerdere hebben. De DC is een **aantekening**,
// geen mechaniek: de spelers gooien aan tafel en de DM beslist of de vondst
// onthuld wordt. Daarom hoeft er nergens een worp ingevoerd of per speler
// bijgehouden te worden.
//
// De verdeling zelf (claimen, afrollen, uitdelen) is de bestaande lootPhase —
// een event vult die alleen. Zo hoeft er aan die machinerie niets te veranderen.

const _lootId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function _leesLoot() {
  const data = storage.readJSON('loot.json');
  if (!Array.isArray(data.events)) data.events = [];
  return data;
}

// Een item mag "willekeurig" zijn: dan kiest de server bij het onthullen een
// voorwerp-kaartje van de gevraagde zeldzaamheid. Zo kun je een sjabloon maken
// ("een common item") dat elke keer iets anders oplevert.
function _kiesWillekeurigVoorwerp(rariteit) {
  const alle = (storage.readJSON('entities.json').voorwerpen || [])
    .filter(v => !rariteit || String(v.data?.rariteit || '').trim().toLowerCase() === String(rariteit).trim().toLowerCase());
  if (!alle.length) return null;
  return alle[Math.floor(Math.random() * alle.length)];
}

const _tussen = (van, tot) => {
  const a = Math.min(getalOf(van), getalOf(tot));
  const b = Math.max(getalOf(van), getalOf(tot));
  return a + Math.floor(Math.random() * (b - a + 1));
};
const getalOf = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };

// Zet een event om in losse lootPhase-items. Toeval wordt hier gerold — dus op
// het moment van onthullen, zodat de DM ziet wat het geworden is en nog kan
// ingrijpen voordat het scherm opengaat.
function _eventNaarItems(ev) {
  const uit = [];
  for (const it of (ev.items || [])) {
    let naam = it.naam, beschrijving = it.beschrijving || '', rariteit = it.rariteit || '', entityId = it.entityId || null;
    if (it.willekeurig) {
      const v = _kiesWillekeurigVoorwerp(it.rariteit);
      if (!v) continue;                       // niets van die zeldzaamheid: sla over
      naam = v.name; beschrijving = v.data?.desc || ''; rariteit = v.data?.rariteit || ''; entityId = v.id;
    }
    if (!naam) continue;
    uit.push({
      id: _lootId('li'), naam, beschrijving, rariteit, entityId,
      bron: ev.naam || '',                    // "uit de haard" — houdt de flavour heel
      claims: [], winnaar: null, dobbelrol: {}, status: 'open',
    });
  }
  return uit;
}

// Alles in centelingen optellen en pas op het eind terugrekenen: anders krijg
// je 12 knakers in plaats van 1 florinde en 2 knakers.
function _eventGoudCl(ev) {
  let cl = toCl({ fl: getalOf(ev.goud?.fl), kn: getalOf(ev.goud?.kn), cl: getalOf(ev.goud?.cl) });
  const r = ev.goudRandom;
  if (r && (getalOf(r.vanCl) || getalOf(r.totCl))) cl += _tussen(r.vanCl, r.totCl);
  return cl;
}

router.get('/loot/events', requireDM, (req, res) => {
  res.json(_leesLoot());
});

router.post('/loot/events', requireDM, (req, res) => {
  const data = _leesLoot();
  const ev = {
    id: _lootId('le'),
    naam:        String(req.body.naam || 'Nieuwe vondst').slice(0, 120),
    dc:          getalOf(req.body.dc),
    vaardigheid: String(req.body.vaardigheid || '').slice(0, 40),
    goud:        { fl: getalOf(req.body.goud?.fl), kn: getalOf(req.body.goud?.kn), cl: getalOf(req.body.goud?.cl) },
    goudRandom:  req.body.goudRandom || null,
    geluidFileId: req.body.geluidFileId || null,
    geluidLabel:  req.body.geluidLabel  || '',
    items:       Array.isArray(req.body.items) ? req.body.items : [],
    sjabloon:    !!req.body.sjabloon,
    dungeonId:   req.body.dungeonId || null,
    roomId:      req.body.roomId    || null,
    encounterId: req.body.encounterId || null,
    mimicEncounterId: req.body.mimicEncounterId || null,
    onthuld:     false,
  };
  data.events.push(ev);
  storage.writeJSON('loot.json', data);
  res.status(201).json(ev);
});

router.put('/loot/events/:id', requireDM, (req, res) => {
  const data = _leesLoot();
  const ev = data.events.find(e => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: 'Vondst niet gevonden' });
  const velden = ['naam', 'vaardigheid', 'dungeonId', 'roomId', 'encounterId', 'mimicEncounterId', 'geluidFileId', 'geluidLabel'];
  for (const v of velden) if (req.body[v] !== undefined) ev[v] = req.body[v];
  if (req.body.dc       !== undefined) ev.dc       = getalOf(req.body.dc);
  if (req.body.goud     !== undefined) ev.goud     = { fl: getalOf(req.body.goud.fl), kn: getalOf(req.body.goud.kn), cl: getalOf(req.body.goud.cl) };
  if (req.body.goudRandom !== undefined) ev.goudRandom = req.body.goudRandom;
  if (Array.isArray(req.body.items))   ev.items    = req.body.items;
  if (req.body.sjabloon !== undefined) ev.sjabloon = !!req.body.sjabloon;
  if (req.body.onthuld  !== undefined) ev.onthuld  = !!req.body.onthuld;
  storage.writeJSON('loot.json', data);
  res.json(ev);
});

router.delete('/loot/events/:id', requireDM, (req, res) => {
  const data = _leesLoot();
  const voor = data.events.length;
  data.events = data.events.filter(e => e.id !== req.params.id);
  if (data.events.length === voor) return res.status(404).json({ error: 'Vondst niet gevonden' });
  storage.writeJSON('loot.json', data);
  res.json({ ok: true });
});

// Een sjabloon wordt gekopieerd bij gebruik: pas je het sjabloon later aan, dan
// verandert er niets aan de vondst die al ergens ligt.
router.post('/loot/events/:id/kopie', requireDM, (req, res) => {
  const data = _leesLoot();
  const bron = data.events.find(e => e.id === req.params.id);
  if (!bron) return res.status(404).json({ error: 'Vondst niet gevonden' });
  const kopie = { ...bron, id: _lootId('le'), sjabloon: false, onthuld: false,
    naam: req.body.naam || bron.naam,
    dungeonId: req.body.dungeonId ?? null, roomId: req.body.roomId ?? null,
    items: (bron.items || []).map(i => ({ ...i })) };
  data.events.push(kopie);
  storage.writeJSON('loot.json', data);
  res.status(201).json(kopie);
});

// Zet één of meer vondsten om in een lootfase. Bundelen mag: de DM vinkt aan
// wat er gevonden is en onthult het in één keer; elk item houdt zijn eigen
// herkomst, zodat "uit de haard" en "onder de plavuizen" gescheiden blijven.
// De fase komt NIET meteen actief te staan — de DM kan eerst nog bijstellen en
// drukt daarna op onthullen (bestaande knop).
router.post('/loot/verdeling', requireDM, (req, res) => {
  const ids = Array.isArray(req.body.eventIds) ? req.body.eventIds : [];
  if (!ids.length) return res.status(400).json({ error: 'Geen vondsten gekozen' });
  const data    = _leesLoot();
  const gekozen = data.events.filter(e => ids.includes(e.id));
  if (!gekozen.length) return res.status(404).json({ error: 'Vondsten niet gevonden' });

  const combat  = storage.readJSON('combat.json');
  const dmState = readDmState();
  let totaalCl = 0;
  let items = [];
  for (const ev of gekozen) {
    totaalCl += _eventGoudCl(ev);
    items = items.concat(_eventNaarItems(ev));
    ev.onthuld = true;
  }
  const goud = fromCl(totaalCl);
  dmState.lootPhase = {
    actief: false, encounterId: null, lootEventIds: gekozen.map(e => e.id),
    deelnemers: _lootDeelnemers(combat, dmState),
    goud, goudVerdeeld: false, items,
  };
  storage.writeJSON('dm-state.json', dmState);
  storage.writeJSON('loot.json', data);
  res.json(_lootForClient(dmState.lootPhase, 'dm', null));
});

router.post('/combat/loot/start', requireDM, (req, res) => {
  const combat  = storage.readJSON('combat.json');
  const dmState = readDmState();
  let goud = { fl: 0, kn: 0, cl: 0 }, items = [];
  const encId = req.body.encounterId || combat.encounterId || null;
  if (encId) {
    const enc = (storage.readJSON('encounters.json').encounters || []).find(e => e.id === encId);
    if (enc?.loot) {
      goud = { fl: enc.loot.goud?.fl || 0, kn: enc.loot.goud?.kn || 0, cl: enc.loot.goud?.cl || 0 };
      items = (enc.loot.items || []).map(it => ({
        id: 'li_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        naam: it.naam || 'Voorwerp', beschrijving: it.beschrijving || '', rariteit: it.rariteit || '',
        entityId: it.entityId || null, claims: [], winnaar: null, dobbelrol: {}, status: 'open',
      }));
    }
  }
  dmState.lootPhase = { actief: false, encounterId: encId, deelnemers: _lootDeelnemers(combat, dmState), goud, goudVerdeeld: false, items };
  storage.writeJSON('dm-state.json', dmState);
  res.json(_lootForClient(dmState.lootPhase, 'dm', null));
});

router.get('/combat/loot', attachRole, (req, res) => {
  const dmState = readDmState();
  res.json(_lootForClient(dmState.lootPhase, req.role, req.session.characterId));
});

router.put('/combat/loot', requireDM, (req, res) => {
  const dmState = readDmState();
  const lp = dmState.lootPhase;
  if (!lp) return res.status(404).json({ error: 'Geen lootfase' });
  if (req.body.goud) lp.goud = { fl: parseInt(req.body.goud.fl) || 0, kn: parseInt(req.body.goud.kn) || 0, cl: parseInt(req.body.goud.cl) || 0 };
  if (Array.isArray(req.body.items)) {
    const oud = new Map((lp.items || []).map(i => [i.id, i]));
    lp.items = req.body.items.map(it => {
      const bestaand = it.id && oud.get(it.id);
      return bestaand
        ? { ...bestaand, naam: it.naam ?? bestaand.naam, beschrijving: it.beschrijving ?? bestaand.beschrijving, rariteit: it.rariteit ?? bestaand.rariteit, entityId: it.entityId ?? bestaand.entityId }
        : { id: 'li_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), naam: it.naam || 'Voorwerp', beschrijving: it.beschrijving || '', rariteit: it.rariteit || '', entityId: it.entityId || null, claims: [], winnaar: null, dobbelrol: {}, status: 'open' };
    });
  }
  if (req.body.toewijzen) {
    const { itemId, characterId } = req.body.toewijzen;
    const it = (lp.items || []).find(i => i.id === itemId);
    if (it && characterId) {
      it.winnaar = characterId; it.status = 'toegewezen';
      if (!dmState.playerItems) dmState.playerItems = {};
      if (!dmState.playerItems[characterId]) dmState.playerItems[characterId] = [];
      dmState.playerItems[characterId].push(_lootItemToPlayerItem(it));
      req.app.get('io').to(req.session?.campaignId || 'main').emit('player:items-updated', { characterId, items: dmState.playerItems[characterId] });
    }
  }
  storage.writeJSON('dm-state.json', dmState);
  res.json(_lootForClient(lp, 'dm', null));
});

router.post('/combat/loot/reveal', requireDM, (req, res) => {
  const dmState = readDmState();
  const lp = dmState.lootPhase;
  if (!lp) return res.status(404).json({ error: 'Geen lootfase' });
  lp.actief = true;
  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io'); const room = req.session?.campaignId || 'main';
  io.to(room).emit('loot:aangeboden', { deelnemers: lp.deelnemers });
  // Kwam deze verdeling uit een vondst met een geluid, speel dat dan nu — op
  // het moment dat de spelers de buit te zien krijgen, niet eerder.
  const vondsten = _leesLoot().events.filter(e => (lp.lootEventIds || []).includes(e.id));
  const metGeluid = vondsten.find(e => e.geluidFileId);
  if (metGeluid) {
    io.to(room).emit('sound:reveal', { fileId: String(metGeluid.geluidFileId), label: metGeluid.geluidLabel || metGeluid.naam || 'Loot', loop: false });
  }
  res.json(_lootForClient(lp, 'dm', null));
});

router.post('/combat/loot/claim', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const dmState = readDmState();
  const lp = dmState.lootPhase;
  if (!lp || !lp.actief) return res.status(400).json({ error: 'Geen actieve lootfase' });
  if (!lp.deelnemers.includes(characterId)) return res.status(403).json({ error: 'Je deed niet mee aan dit gevecht' });
  const it = (lp.items || []).find(i => i.id === req.body.itemId);
  if (!it || it.status !== 'open') return res.status(404).json({ error: 'Item niet beschikbaar' });
  it.claims = it.claims || [];
  const idx = it.claims.indexOf(characterId);
  if (idx >= 0) it.claims.splice(idx, 1); else it.claims.push(characterId);
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('loot:claim-update', { itemId: it.id, claimCount: it.claims.length });
  res.json({ ok: true, ikClaim: it.claims.includes(characterId), claimCount: it.claims.length });
});

router.post('/combat/loot/verdeeld', requireDM, (req, res) => {
  const dmState = readDmState();
  const lp = dmState.lootPhase;
  if (!lp) return res.status(404).json({ error: 'Geen lootfase' });
  if (!dmState.playerItems) dmState.playerItems = {};
  const io = req.app.get('io'); const room = req.session?.campaignId || 'main';
  const geraakt = new Set();
  const uitslag = { items: [], goud: {} };

  for (const it of (lp.items || [])) {
    if (it.status !== 'open') continue;
    const claims = it.claims || [];
    if (claims.length === 0) { it.status = 'overgeslagen'; continue; }
    let winnaar;
    if (claims.length === 1) { winnaar = claims[0]; }
    else {
      let kandidaten = [...claims], ronde = 0; const rolMap = {};
      while (kandidaten.length > 1 && ronde < 5) {
        let best = -1; const rolls = {};
        for (const c of kandidaten) { const r = 1 + Math.floor(Math.random() * 20); rolls[c] = r; if (r > best) best = r; }
        Object.assign(rolMap, rolls);
        kandidaten = kandidaten.filter(c => rolls[c] === best);
        ronde++;
      }
      winnaar = kandidaten[0];
      it.dobbelrol = rolMap;
    }
    it.winnaar = winnaar; it.status = 'toegewezen';
    if (!dmState.playerItems[winnaar]) dmState.playerItems[winnaar] = [];
    dmState.playerItems[winnaar].push(_lootItemToPlayerItem(it));
    geraakt.add(winnaar);
    uitslag.items.push({ naam: it.naam, winnaar, dobbelrol: it.dobbelrol });
  }

  if (!lp.goudVerdeeld && toCl(lp.goud) > 0 && lp.deelnemers.length) {
    const g = getGroup(dmState, dmState.activeGroup);
    if (g?.sharedPurse?.enabled) {
      g.sharedPurse = fromCl(toCl(g.sharedPurse) + toCl(lp.goud)); g.sharedPurse.enabled = true;
      io.to(room).emit('party-currency:updated', { groupId: dmState.activeGroup, currency: g.sharedPurse, actor: 'Loot' });
      uitslag.goud = { gedeeld: true, totaal: lp.goud };
    } else {
      const totaal = toCl(lp.goud); const n = lp.deelnemers.length;
      const per = Math.floor(totaal / n); let rest = totaal - per * n;
      const gesorteerd = [...lp.deelnemers].sort();
      for (const cid of gesorteerd) {
        let aandeel = per;
        if (rest > 0 && cid === gesorteerd[0]) { aandeel += rest; rest = 0; }
        const nieuw = _addCurrency(dmState, cid, aandeel);
        geraakt.add(cid);
        io.to(room).emit('player:currency-updated', { characterId: cid, currency: nieuw });
        uitslag.goud[cid] = fromCl(aandeel);
      }
    }
    lp.goudVerdeeld = true;
  }

  lp.actief = false;
  storage.writeJSON('dm-state.json', dmState);
  for (const cid of geraakt) io.to(room).emit('player:items-updated', { characterId: cid, items: dmState.playerItems[cid] });
  io.to(room).emit('loot:verdeeld', { uitslag });
  res.json({ ok: true, uitslag, loot: _lootForClient(lp, 'dm', null) });
});

router.delete('/combat/loot', requireDM, (req, res) => {
  const dmState = readDmState();
  delete dmState.lootPhase;
  storage.writeJSON('dm-state.json', dmState);
  req.app.get('io').to(req.session?.campaignId || 'main').emit('loot:verdeeld', { uitslag: null, geannuleerd: true });
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
  const actief = _activeAkteVoor(dmState);
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
const _DIENSTEN_NAMEN = ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'heeren', 'facties', 'magizoo'];

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

  // Bij onthullen (staat ≠ 'verborgen'): onthul automatisch het gekoppelde
  // personage (portret = config.imageId) en de locatie (backdrop = config.backdropId)
  // van de dienst voor deze groep — mits het echte entiteiten zijn (geen geüploade
  // bestanden). Nooit auto-verbergen.
  const onthuld = [];
  if (staat !== 'verborgen') {
    const meta = storage.readJSON('meta.json');
    const cfg  = meta[dienst] || {};
    const entities = storage.readJSON('entities.json');
    if (!g.visibility) g.visibility = {};
    for (const eid of [cfg.imageId, cfg.backdropId]) {
      if (!eid || g.visibility[eid] === 'visible') continue;
      let found = null, foundType = null;
      for (const t of ENTITY_TYPES) {
        const e = (entities[t] || []).find(x => x.id === eid);
        if (e) { found = e; foundType = t; break; }
      }
      if (found) {
        g.visibility[eid] = 'visible';
        onthuld.push({ id: eid, type: foundType, name: found.name });
      }
    }
  }

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('diensten:toegang:updated');
  for (const o of onthuld) io.to(room).emit('entity:visibility', { id: o.id, type: o.type, name: o.name, visibility: 'visible' });
  res.json({ ok: true, onthuld: onthuld.map(o => o.name) });
});

// Brief-styling per dienst (embleem + kleur) voor de verzegelde uitnodiging.
const _DIENST_BRIEF = {
  herberg:   { icon: 'beer',      kleur: 'hout',   naam: 'De Herberg' },
  tweespalt: { icon: 'dice',      kleur: 'staal',  naam: 'De Tweespalt' },
  gock:      { icon: 'search',    kleur: 'metaal', naam: 'De Gock' },
  ursula:    { icon: 'sparkles',  kleur: '',       naam: 'Madame Ursula' },
  tempel:    { icon: 'church',    kleur: 'hout',   naam: 'De Tempel' },
  heeren:    { icon: 'moon',      kleur: 'staal',  naam: 'De Heeren van de Nacht' },
  facties:   { icon: 'landmark',  kleur: 'metaal', naam: 'De Facties' },
  magizoo:   { icon: 'paw-print', kleur: 'hout',   naam: 'De Magizoöloog' },
};

// Onthul een dienst (beschikbaar) voor de actieve groep én bezorg een verzegelde uitnodiging.
router.post('/diensten/:dienst/uitnodiging', requireDM, (req, res) => {
  const dienst = req.params.dienst;
  if (!_DIENSTEN_NAMEN.includes(dienst)) return res.status(400).json({ error: 'Onbekende dienst' });
  const dmState = readDmState();
  const groepId = dmState.activeGroup;
  const g = getGroup(dmState);

  // 1) Dienst beschikbaar maken voor de actieve groep + gekoppelde entiteiten onthullen
  if (!g.dienstenToegang) g.dienstenToegang = {};
  g.dienstenToegang[dienst] = 'beschikbaar';
  const meta = storage.readJSON('meta.json');
  const cfg  = meta[dienst] || {};
  const entities = storage.readJSON('entities.json');
  if (!g.visibility) g.visibility = {};
  for (const eid of [cfg.imageId, cfg.backdropId]) {
    if (!eid || g.visibility[eid] === 'visible') continue;
    for (const t of ENTITY_TYPES) {
      if ((entities[t] || []).some(x => x.id === eid)) { g.visibility[eid] = 'visible'; break; }
    }
  }
  storage.writeJSON('dm-state.json', dmState);

  // 2) Ontvangers
  const leden = (entities.personages || []).filter(e => e.subtype === 'speler' && e.data?.groep === groepId);
  if (!leden.length) return res.status(400).json({ error: 'Geen spelers in de actieve groep' });

  // 3) Brief opbouwen (verzegelde-uitnodiging-stijl, thema 'factie')
  const bief = _DIENST_BRIEF[dienst] || { icon: 'landmark', kleur: '', naam: dienst };
  const naam = (cfg.naam && String(cfg.naam).trim()) || bief.naam;
  const tekst = (cfg.uitnodiging && String(cfg.uitnodiging).trim())
    || `Geachte avonturier,\n\n**${naam}** opent haar deuren voor u. Wij verwelkomen u graag — kom langs wanneer het u uitkomt.\n\nMet achting,\n${naam}`;
  const titel = (cfg.uitnodigingTitel && String(cfg.uitnodigingTitel).trim()) || 'Een uitnodiging';

  let bezorgd = 0;
  for (const lid of leden) {
    const post = _bezorgBrief(req, lid.id, {
      titel, tekst, afzender: naam, thema: 'factie',
      embleem: bief.icon, kleur: bief.kleur, kop: naam, cinematic: true,
    });
    if (post) bezorgd++;
  }

  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('diensten:toegang:updated');
  io.to(room).emit('visibility:updated');
  res.json({ ok: true, bezorgd });
});

// GET huidige uitnodigingstekst van een dienst (voor de DM-editor)
router.get('/diensten/:dienst/uitnodiging-tekst', requireDM, (req, res) => {
  const dienst = req.params.dienst;
  if (!_DIENSTEN_NAMEN.includes(dienst)) return res.status(400).json({ error: 'Onbekende dienst' });
  const cfg  = (storage.readJSON('meta.json'))[dienst] || {};
  const bief = _DIENST_BRIEF[dienst] || { naam: dienst };
  res.json({
    uitnodiging: cfg.uitnodiging || '',
    uitnodigingTitel: cfg.uitnodigingTitel || '',
    naam: (cfg.naam && String(cfg.naam).trim()) || bief.naam,
  });
});

// PUT uitnodigingstekst van een dienst opslaan
router.put('/diensten/:dienst/uitnodiging-tekst', requireDM, (req, res) => {
  const dienst = req.params.dienst;
  if (!_DIENSTEN_NAMEN.includes(dienst)) return res.status(400).json({ error: 'Onbekende dienst' });
  const meta = storage.readJSON('meta.json');
  if (!meta[dienst]) meta[dienst] = {};
  meta[dienst].uitnodiging      = String(req.body.uitnodiging || '').trim();
  meta[dienst].uitnodigingTitel = String(req.body.uitnodigingTitel || '').trim();
  storage.writeJSON('meta.json', meta);
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
    geenSessie: !_activeAkteVoor(dmState) || _activeAkteVoor(dmState).num == null,
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
  res.json({ aktes, activeAkte: _activeAkteVoor(dmState) });
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
  // Markeer de entiteit als 'onderzocht door De Gock' voor de groep (kaart-badge).
  if (geval.entityId) {
    const gid = _playerGroupId(dmState, characterId);
    const grp = getGroup(dmState, gid);
    if (!grp.gockOnderzocht) grp.gockOnderzocht = {};
    grp.gockOnderzocht[geval.entityId] = true;
  }
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
  ['naam', 'imageId', 'backdropId', 'arena'].forEach(f => { if (req.body[f] !== undefined) meta.tweespalt[f] = req.body[f]; });
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

// ── De Magizoöloog ──────────────────────────────────────────────────────────
// Beestenkenner die monsters die de party al kent (≥ naam) dieper onderzoekt.
// Per onderzoek één trede omhoog: naam→deels (+ roddel) → volledig. Premium-optie:
// direct naar volledig tegen hogere prijs. Resultaat instant; korte cooldown.
const _MAGIZOO_TIER_NEXT = { naam: 'deels', deels: 'volledig' };
const _MAGIZOO_TIER_RANK = { naam: 1, deels: 2, volledig: 3 };

// Bouwt de lijst onderzoekbare monsters voor een groep (bekend ≥ naam).
function _magizooMonsterList(dmState, gid) {
  const g = getGroup(dmState, gid);
  const kennis  = g?.bestiarium || {};
  const roddels = g?.bestiariumRoddels || {};
  const bron    = g?.bestiariumBron || {};
  const monsters = (storage.readJSON('monsters.json').monsters || [])
    .filter(m => m.inBestiarium !== false && kennis[m.id]); // alleen al ontdekt
  return monsters.map(m => {
    const sb = m.statblock || {};
    return {
      id: m.id, name: m.name, imageId: m.imageId || null,
      type: sb.type || '', size: sb.size || '',
      niveau: kennis[m.id], volgende: _MAGIZOO_TIER_NEXT[kennis[m.id]] || null,
      roddelGehoord: !!roddels[m.id], heeftRoddel: !!m.roddel,
      bron: bron[m.id] || null,
    };
  });
}

router.get('/magizoo', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.magizoo || {};
  const dmState = readDmState();
  const characterId = req.session.characterId;
  const gid = characterId ? _playerGroupId(dmState, characterId) : undefined;
  const cooldown = characterId ? ((dmState.magizooState || {})[characterId]?.cooldownTot || null) : null;
  res.json({
    config: {
      naam:    config.naam || 'De Magizoöloog',
      groet:   config.groet || '',
      imageId: config.imageId || null,
      backdropId: config.backdropId || null,
      prijs:         config.prijs         || { fl: 25 },
      prijsVolledig: config.prijsVolledig || { fl: 60 },
      cooldownMinuten: config.cooldownMinuten ?? 5,
    },
    monsters: _magizooMonsterList(dmState, gid),
    adoptabel: _magizooAdoptabel(dmState, gid),
    metgezel: _groupPet(getGroup(dmState, gid), storage.readJSON('entities.json')),
    currency: _effectiveCurrency(dmState, characterId),
    cooldownTot: (cooldown && new Date(cooldown) > new Date()) ? cooldown : null,
  });
});

// Adopteer een metgezel bij De Magizoöloog (speler betaalt → companion + baasje + naam vastgelegd).
router.post('/magizoo/adopteer', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const { petId } = req.body;
  if (!petId) return res.status(400).json({ error: 'petId vereist' });

  const entities = storage.readJSON('entities.json');
  const pet = (entities.personages || []).find(e => e.id === petId && e.subtype === 'dier');
  if (!pet) return res.status(404).json({ error: 'Dit dier bestaat niet.' });
  if (!(pet.data?.adopteerbaar === true || pet.data?.adopteerbaar === 'true'))
    return res.status(400).json({ error: 'Dit dier is niet ter adoptie.' });

  const dmState = readDmState();
  const gid = _playerGroupId(dmState, characterId);
  const g = getGroup(dmState, gid);
  if (!g.companions) g.companions = [];
  if (_groupHasPet(g, entities)) return res.status(400).json({ error: 'De party heeft al een metgezel — één huisdier per party.' });

  // Betaling (zelfde valuta-afhandeling als magizoo/onderzoek)
  const prijsCl = toCl(_adoptiePrijs(pet));
  if (toCl(_effectiveCurrency(dmState, characterId)) < prijsCl)
    return res.status(400).json({ error: 'Onvoldoende saldo' });
  const { currency: nieuweSaldo } = _deductCurrency(dmState, characterId, prijsCl);

  // Door de speler gekozen naam (met de suggestie als fallback)
  const naam = (typeof req.body.naam === 'string' && req.body.naam.trim())
    ? req.body.naam.trim().slice(0, 40)
    : (pet.data?.naamSuggestie || pet.name);

  // Koppelen + baasje + naam vastleggen + zichtbaar maken voor de groep
  g.companions.push(petId);
  if (!g.companionOwners) g.companionOwners = {};
  g.companionOwners[petId] = characterId;
  if (!g.companionNames) g.companionNames = {};
  g.companionNames[petId] = naam;
  if (!g.visibility) g.visibility = {};
  g.visibility[petId] = 'visible';
  if (g.deceased) delete g.deceased[petId];   // herstel bij her-adoptie van hetzelfde dier
  storage.writeJSON('dm-state.json', dmState);

  // Adoptiebewijs als brief
  _bezorgBrief(req, characterId, {
    titel: `Adoptiebewijs — ${naam}`,
    tekst: `Hierbij bevestigt De Magizoöloog dat ${naam} onder jouw hoede is gekomen. Zorg goed voor je metgezel; naarmate jij in ervaring groeit, groeit ${naam} met je mee.`,
    afzender: 'De Magizoöloog',
    entityId: petId, entityType: 'personages',
  });

  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('companion:link', { npcId: petId, name: naam, groupId: gid });
  io.to(room).emit('player:currency-updated', { characterId, currency: nieuweSaldo });

  res.json({ ok: true, petId, naam, currency: nieuweSaldo });
});

router.post('/magizoo/onderzoek', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Geen speler ingelogd' });
  const { monsterId, modus } = req.body;          // modus: 'stap' | 'volledig'
  if (!monsterId) return res.status(400).json({ error: 'monsterId vereist' });

  const dmState = readDmState();
  const gid = _playerGroupId(dmState, characterId);
  const g = getGroup(dmState, gid);
  if (!g.bestiarium)        g.bestiarium = {};
  if (!g.bestiariumRoddels) g.bestiariumRoddels = {};
  if (!g.bestiariumBron)    g.bestiariumBron = {};

  const huidig = g.bestiarium[monsterId];
  if (!huidig) return res.status(404).json({ error: 'Dit wezen is nog niet ontdekt — de Magizoöloog onderzoekt alleen bekende monsters.' });
  if (huidig === 'volledig') return res.status(400).json({ error: 'Dit wezen is al volledig onderzocht.' });

  // Cooldown
  if (!dmState.magizooState) dmState.magizooState = {};
  const st = dmState.magizooState[characterId] || {};
  if (st.cooldownTot && new Date(st.cooldownTot) > new Date()) {
    return res.status(429).json({ error: 'De Magizoöloog heeft nog tijd nodig.', cooldownTot: st.cooldownTot });
  }

  const monster = (storage.readJSON('monsters.json').monsters || []).find(m => m.id === monsterId);
  if (!monster) return res.status(404).json({ error: 'Monster niet gevonden' });

  const meta = storage.readJSON('meta.json');
  const config = meta.magizoo || {};
  const naarVolledig = modus === 'volledig';
  const prijs = naarVolledig ? (config.prijsVolledig || { fl: 60 }) : (config.prijs || { fl: 25 });

  const prijsCl = toCl(prijs);
  const huidigeSaldo = _effectiveCurrency(dmState, characterId);
  if (toCl(huidigeSaldo) < prijsCl) return res.status(400).json({ error: 'Onvoldoende saldo' });

  // Nieuw kennisniveau bepalen
  const nieuw = naarVolledig ? 'volledig' : (_MAGIZOO_TIER_NEXT[huidig] || huidig);
  g.bestiarium[monsterId] = nieuw;
  // Roddel onthullen zodra het wezen ≥ deels bereikt (naam→deels + roddel).
  let roddelOnthuld = null;
  if (_MAGIZOO_TIER_RANK[nieuw] >= _MAGIZOO_TIER_RANK.deels && monster.roddel && !g.bestiariumRoddels[monsterId]) {
    g.bestiariumRoddels[monsterId] = true;
    roddelOnthuld = monster.roddel;
  }
  g.bestiariumBron[monsterId] = 'magizoo';

  // Betaling + cooldown
  const { currency: nieuweSaldo } = _deductCurrency(dmState, characterId, prijsCl);
  const cooldownMin = config.cooldownMinuten ?? 5;
  dmState.magizooState[characterId] = { cooldownTot: new Date(Date.now() + cooldownMin * 60 * 1000).toISOString() };

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('bestiarium:updated');
  io.to(room).emit('player:currency-updated', { characterId, currency: nieuweSaldo });

  res.json({
    ok: true, monsterId, naam: monster.name,
    niveau: nieuw, roddel: roddelOnthuld,
    currency: nieuweSaldo,
    cooldownTot: dmState.magizooState[characterId].cooldownTot,
  });
});

router.put('/meta/magizoo', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  if (!meta.magizoo) meta.magizoo = {};
  ['naam', 'groet', 'imageId', 'backdropId', 'prijs', 'prijsVolledig', 'cooldownMinuten']
    .forEach(f => { if (req.body[f] !== undefined) meta.magizoo[f] = req.body[f]; });
  storage.writeJSON('meta.json', meta);
  req.app.get('io').to(req.session?.campaignId||'main').emit('meta:updated');
  res.json(meta.magizoo);
});

// ── De Tempel / Zegeningen ──

// Goden worden afgeleid uit de Blessing-kaartjes (de bron). Per god (gegroepeerd
// op godNaam): eenmalige zegens = de zegen-kaarten, eed = de eed-kaart (titel =
// effect, tekst = eedTekst, permanente zegen = data.permanenteZegen), vloek = de
// vloek-kaart. Metadata (domein, symbool, prijs, naam-volgorde) komt uit de
// Meesterkamer-config (meta.tempel.goden), gekoppeld op naam.
function _tempelGoden(config) {
  const entities  = storage.readJSON('entities.json');
  const blessings = (entities.voorwerpen || []).filter(e => (e.data?.itemType) === 'Blessing' && (e.data?.godNaam || '').trim());
  if (!blessings.length) {
    // Geen kaarten → terugvallen op de (oude) config/seed.
    return config.goden?.length ? config.goden : TEMPEL_GODEN_DEFAULT;
  }
  const cfgList   = config.goden?.length ? config.goden : TEMPEL_GODEN_DEFAULT;
  const cfgByNaam = {};
  cfgList.forEach(g => { if (g.naam) cfgByNaam[g.naam.trim().toLowerCase()] = g; });

  const byGod = new Map();
  for (const e of blessings) {
    const naam = (e.data.godNaam || '').trim();
    if (!byGod.has(naam)) byGod.set(naam, []);
    byGod.get(naam).push(e);
  }

  const goden = [];
  for (const [naam, cards] of byGod) {
    const cfg = cfgByNaam[naam.toLowerCase()] || {};
    const eedCard   = cards.find(c => c.data.goddelijkType === 'eed');
    const vloekCard = cards.find(c => c.data.goddelijkType === 'vloek');
    const zegenCards = cards.filter(c => c.data.goddelijkType === 'zegen');
    goden.push({
      id:       cfg.id || ('god_' + naam.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')),
      naam,
      domein:   cfg.domein  || '',
      symbool:  cfg.symbool || '',
      prijs:    cfg.prijs   || null,
      // Permanente zegen: leidend van de eed-kaart, anders de oude config-waarde.
      zegen:    (eedCard?.data?.permanenteZegen) || cfg.zegen || '',
      eedTitel: eedCard?.data?.effect   || cfg.eedTitel || '',
      eedTekst: eedCard?.data?.eedTekst || cfg.eedTekst || '',
      vloek:    vloekCard?.data?.effect || cfg.vloek    || '',
      // Eenmalige zegens = de mechaniek van de zegen-kaarten (nu in de beschrijving; oud: effect), in archief-volgorde.
      eenmaligeZegens: zegenCards.map(z => z.data.desc || z.data.effect).filter(Boolean),
      eedEntityId:   eedCard?.id   || null,
      vloekEntityId: vloekCard?.id || null,
      // Visuele koppeling — overgenomen uit DM-config
      imageId:          cfg.imageId          || null,
      priestImageId:    cfg.priestImageId    || null,
      backdropId:       cfg.backdropId       || null,
      locatieEntityId:  cfg.locatieEntityId  || null,
      priesterEntityId: cfg.priesterEntityId || null,
      priesterGreet:    cfg.priesterGreet    || '',
    });
  }
  // Sorteer in de config-/seed-volgorde waar mogelijk; onbekende achteraan.
  const order = cfgList.map(g => (g.naam || '').toLowerCase());
  goden.sort((a, b) => {
    const ia = order.indexOf(a.naam.toLowerCase()); const ib = order.indexOf(b.naam.toLowerCase());
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return goden;
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
    id: 'cooperatie', naam: 'De Coöperatie', embleem: 'tree-pine', stijl: 'hout',
    beschrijving: 'Het verbond van druïden dat over de wouden en wateren rond Grisburgh waakt.',
    renownDrempels: [0, 1, 3, 10, 25, 50], entityId: null,
    rangen: [
      { naam: 'Buitenstaander', voordelen: 'Geen aanzien; de Kring houdt je op afstand.' },
      { naam: 'Zaailing',       voordelen: 'Je wordt geduld in de buitenste hagen; ruil van kruiden toegestaan.',
        boons: [{ naam: 'Kruidruil', tekst: 'Koop genezende kruiden en eenvoudige remedies tegen kostprijs.' }] },
      { naam: 'Wortelganger',   voordelen: 'Toegang tot de gemeenschappelijke kruidtuin en de raad.',
        boons: [{ naam: 'Kruidtuin', tekst: 'Eens per lange rust een gratis dosis genezende thee.' }] },
      { naam: 'Hagenhoeder',    voordelen: 'Druïden delen voortekenen en veilige paden met je.', titel: 'Hagenhoeder van de Coöperatie',
        boons: [{ naam: 'Veilige paden', tekst: 'Voordeel op overlevingsworpen in de wildernis rond Grisburgh.' }] },
      { naam: 'Boomspreker',    voordelen: 'Je stem telt in de Kring; de Coöperatie staat je bij in nood.', titel: 'Boomspreker der Coöperatie',
        boons: [{ naam: 'Dierbode', tekst: 'Stuur eens per dag een dierbode met een kort bericht.' }] },
      { naam: 'Eikhart',        voordelen: 'De wouden zelf lijken je gunstig gezind.', titel: 'Eikhart van de Kring',
        boons: [{ naam: 'Gunst van het woud', tekst: 'Eens per lange rust een druïdische zegen van de Kring.' }] },
    ],
  },
  {
    id: 'eendragt', naam: 'De Eendragt', embleem: 'hexagon', stijl: 'metaal',
    beschrijving: 'Het artifexgilde dat het vakmanschap en de uitvindingen van de stad bewaakt.',
    renownDrempels: [0, 1, 3, 10, 25, 50], entityId: null,
    rangen: [
      { naam: 'Vreemdeling',     voordelen: 'Geen aanzien; het gilde sluit zijn werkplaatsen voor je.' },
      { naam: 'Leerjongen',      voordelen: 'Toegang tot de gildewerkplaats en eenvoudig gereedschap.',
        boons: [{ naam: 'Werkplaats', tekst: 'Gebruik van het gildegereedschap; reparaties tegen kostprijs.' }] },
      { naam: 'Gezel',           voordelen: 'Korting op vakwerk en materialen van het gilde.',
        boons: [{ naam: 'Gildekorting', tekst: '10% korting op vakwerk, gereedschap en materialen.' }] },
      { naam: 'Vakmeester',      voordelen: 'Het gilde neemt opdrachten van je aan met voorrang.', titel: 'Vakmeester van De Eendragt',
        boons: [{ naam: 'Voorrang', tekst: 'Je opdrachten worden met voorrang vervaardigd.' }] },
      { naam: 'Meester-artifex', voordelen: 'Toegang tot zeldzame ontwerpen en materialen.', titel: 'Meester-artifex',
        boons: [{ naam: 'Zeldzame ontwerpen', tekst: 'Toegang tot zeldzame blauwdrukken; magische voorwerpen identificeren.' }] },
      { naam: 'Gildemeester',    voordelen: 'Je woord weegt zwaar in de raad van De Eendragt.', titel: 'Gildemeester van De Eendragt',
        boons: [{ naam: 'Maatwerk', tekst: 'Laat eens per boog een uniek voorwerp op maat vervaardigen.' }] },
    ],
  },
  {
    id: 'roodzwaarden', naam: 'De Roodzwaarden', embleem: 'crossed-swords', stijl: 'staal',
    beschrijving: 'De stadswacht van Grisburgh — gehard, en niet zonder eigenbelang.',
    renownDrempels: [0, 1, 3, 10, 25, 50], entityId: null,
    rangen: [
      { naam: 'Verdachte',     voordelen: 'Geen aanzien; de wacht houdt je in de gaten.' },
      { naam: 'Gedoogde',      voordelen: 'De wacht laat je met rust en beantwoordt je vragen.',
        boons: [{ naam: 'Goodwill', tekst: 'De wacht beantwoordt vragen en geeft tips.' }] },
      { naam: 'Vertrouweling', voordelen: 'Toegang tot het wachthuis; je mag kleine zaken melden.',
        boons: [{ naam: 'Wachthuis', tekst: 'Toegang tot het wachthuis en het premiebord.' }] },
      { naam: 'Bondgenoot',    voordelen: 'Je mag premies innen en krijgt eerste keus uit het premiebord.', titel: 'Bondgenoot van de Roodzwaarden',
        boons: [{ naam: 'Premiejager', tekst: 'Eerste keus uit premies en een hogere uitbetaling.' }] },
      { naam: 'Schildgenoot',  voordelen: 'De wacht verleent je doortocht en bijstand bij gevaar.', titel: 'Schildgenoot der Roodzwaarden',
        boons: [{ naam: 'Bijstand', tekst: 'Roep eens per dag een wachtpatrouille op als rugdekking.' }] },
      { naam: 'Erezwaard',     voordelen: 'Je geniet het volle vertrouwen van de Roodzwaarden.', titel: 'Erezwaard van Grisburgh',
        boons: [{ naam: 'Vrijgeleide', tekst: 'De wacht knijpt eenmalig een oogje toe bij een klein vergrijp.' }] },
    ],
  },
];

function _factiesConfig(meta) {
  const c = meta.facties;
  return (Array.isArray(c) && c.length) ? c : FACTIES_DEFAULT;
}

function _rangIdxVanRenown(renown, drempels, maxRangen) {
  const d = (drempels && drempels.length) ? drempels : [0, 1, 3, 10, 25, 50];
  let idx = 0;
  for (let i = 0; i < d.length && i < maxRangen; i++) {
    if (renown >= d[i]) idx = i;
  }
  return Math.min(idx, maxRangen - 1);
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
  const entities = storage.readJSON('entities.json');
  const voorwerpen = entities.voorwerpen || [];
  const g = getGroup(dmState);
  const factieZichtbaar = g.factieZichtbaar || {};
  const factieRenown    = g.factieRenown    || {};
  const isDM = req.role === 'dm';
  const titels = [];
  const personages = entities.personages || [];
  const visibility = g.visibility || {};

  // Leden van een factie resolven (portret = entityId, naam + rol uit het personage).
  // Spelers zien alleen leden waarvan het personage zichtbaar is (volgt entity-visibility).
  function _resolveLeden(f) {
    return (f.leden || []).map(l => {
      const e = personages.find(p => p.id === l.entityId);
      if (!e) return null;
      const vis = visibility[e.id] || 'hidden';
      if (!isDM && (vis === 'hidden' || vis === 'vague')) return null;
      return { entityId: e.id, naam: e.name, rol: e.data?.rol || '', rang: l.rang || '' };
    }).filter(Boolean);
  }

  // Helper: los boon op via voorwerp-entityId
  function _resolveBoon(b) {
    if (b.entityId) {
      const e = voorwerpen.find(v => v.id === b.entityId);
      if (e) return {
        naam: b.naam || e.name,
        tekst: e.data?.beschrijving || e.data?.description || e.data?.note || '',
        entityId: b.entityId,
        entityType: 'voorwerpen',
      };
    }
    return { naam: b.naam || '', tekst: b.tekst || '', entityId: null, entityType: null };
  }

  const facties = config.map(f => {
    const zichtbaar = factieZichtbaar[f.id] === true;
    if (!isDM && !zichtbaar) return null;

    const rangen = (f.rangen && f.rangen.length) ? f.rangen : [{ naam: '—', voordelen: '' }];
    const renown = factieRenown[f.id] || 0;
    const drempels = f.renownDrempels || [0, 1, 3, 10, 25, 50];
    const idx = _rangIdxVanRenown(renown, drempels, rangen.length);
    const isMax = idx >= rangen.length - 1;
    const drempelVolgende = isMax ? null : drempels[idx + 1] ?? null;

    const ladder = rangen.map((r, i) => ({
      index: i, naam: r.naam, voordelen: r.voordelen || '', titel: r.titel || null,
      boons: (r.boons || []).map(b => _resolveBoon(b)),
      bereikt: i <= idx, huidig: i === idx,
    }));
    rangen.forEach((r, i) => { if (i > 0 && i <= idx && r.titel) titels.push({ titel: r.titel, factie: f.id, factieNaam: f.naam, embleem: f.embleem || 'landmark' }); });

    const view = {
      id: f.id, naam: f.naam, embleem: f.embleem || 'landmark', beschrijving: f.beschrijving || '',
      stijl: f.stijl || '', rang: _factieRangView(f, idx), ladder,
      renown, zichtbaar, drempelVolgende, entityId: f.entityId || null,
      // Visuele koppeling (interieur-view)
      locatieEntityId:  f.locatieEntityId  || null,
      npcEntityId:      f.npcEntityId      || null,
      npcEntityIdDag:   f.npcEntityIdDag   || null,
      npcGreet:         f.npcGreet         || '',
      leden:            _resolveLeden(f),
    };
    if (isDM) view.rangen = f.rangen || [];
    return view;
  }).filter(Boolean);

  res.json({ facties, titels });
});

// Behoud oud rang-endpoint voor backwards-compatibiliteit (non-breaking)
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

router.post('/facties/:id/reveal', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = _factiesConfig(meta);
  const factie = config.find(f => f.id === req.params.id);
  if (!factie) return res.status(404).json({ error: 'Factie niet gevonden' });
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.factieZichtbaar) g.factieZichtbaar = {};
  const wasZichtbaar = g.factieZichtbaar[factie.id] === true;
  g.factieZichtbaar[factie.id] = !wasZichtbaar;
  // Koppel entity-zichtbaarheid
  if (factie.entityId) {
    if (!g.visibility) g.visibility = {};
    g.visibility[factie.entityId] = wasZichtbaar ? 'hidden' : 'zichtbaar';
  }
  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('facties:updated');
  if (factie.entityId) io.to(room).emit('visibility:updated');
  res.json({ ok: true, id: factie.id, zichtbaar: g.factieZichtbaar[factie.id] });
});

// Standaard-uitnodigingstekst als de factie er nog geen heeft opgeslagen.
function _standaardUitnodiging(factie, afzender, locatie) {
  const waar = locatie ? ` Kom langs in **${locatie}**.` : '';
  const greet = factie.npcGreet ? `\n\n_"${factie.npcGreet}"_` : '';
  return `Geachte avonturier,\n\nUw daden in Grisburgh zijn ons niet ontgaan. **${factie.naam}** nodigt u uit om kennis te maken.${waar} Wij menen dat een verbond ons beiden tot voordeel kan strekken.${greet}\n\nMet achting,\n${afzender}`;
}

// Onthul de factie voor de actieve groep én bezorg elke speler een verzegelde uitnodigingsbrief.
router.post('/facties/:id/uitnodiging', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const factie = _factiesConfig(meta).find(f => f.id === req.params.id);
  if (!factie) return res.status(404).json({ error: 'Factie niet gevonden' });

  const dmState = readDmState();
  const groepId = dmState.activeGroup;
  const g = getGroup(dmState);

  // 1) Onthul de factie voor de actieve groep
  if (!g.factieZichtbaar) g.factieZichtbaar = {};
  g.factieZichtbaar[factie.id] = true;
  if (factie.entityId) {
    if (!g.visibility) g.visibility = {};
    g.visibility[factie.entityId] = 'zichtbaar';
  }
  storage.writeJSON('dm-state.json', dmState);

  // 2) Ontvangers = spelers in de actieve groep
  const entities = storage.readJSON('entities.json');
  const leden = (entities.personages || []).filter(e => e.subtype === 'speler' && e.data?.groep === groepId);
  if (!leden.length) return res.status(400).json({ error: 'Geen spelers in de actieve groep' });

  // 3) Afzender = NPC-hoofd, anders de factienaam; locatie voor het sjabloon
  const npc = factie.npcEntityId ? (entities.personages || []).find(e => e.id === factie.npcEntityId) : null;
  const afzender = npc?.name || factie.naam;
  const locatie  = factie.locatieEntityId ? ((entities.locaties || []).find(e => e.id === factie.locatieEntityId)?.name || '') : '';

  const tekst = (factie.uitnodiging && factie.uitnodiging.trim()) || _standaardUitnodiging(factie, afzender, locatie);
  const titel = (factie.uitnodigingTitel && factie.uitnodigingTitel.trim()) || 'Een uitnodiging';

  // 4) Bezorg de verzegelde brief bij elk lid
  let bezorgd = 0;
  for (const lid of leden) {
    const post = _bezorgBrief(req, lid.id, {
      titel, tekst, afzender, thema: 'factie',
      entityId: factie.entityId || null, entityType: factie.entityId ? 'organisaties' : null,
      embleem: factie.embleem || 'landmark', kleur: factie.stijl || '', kop: factie.naam, cinematic: true,
    });
    if (post) bezorgd++;
  }

  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('facties:updated');
  if (factie.entityId) io.to(room).emit('visibility:updated');
  res.json({ ok: true, bezorgd, zichtbaar: true });
});

router.post('/facties/:id/renown', requireDM, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = _factiesConfig(meta);
  const factie = config.find(f => f.id === req.params.id);
  if (!factie) return res.status(404).json({ error: 'Factie niet gevonden' });
  const delta = parseInt(req.body.delta) || 0;
  const dmState = readDmState();
  const g = getGroup(dmState);
  if (!g.factieRenown) g.factieRenown = {};
  if (!g.factieBoonsGegeven) g.factieBoonsGegeven = {};
  const oudRenown = g.factieRenown[factie.id] || 0;
  const nieuwRenown = Math.max(0, oudRenown + delta);
  g.factieRenown[factie.id] = nieuwRenown;
  const rangen = (factie.rangen && factie.rangen.length) ? factie.rangen : [{ naam: '—', voordelen: '' }];
  const drempels = factie.renownDrempels || [0, 1, 3, 10, 25, 50];
  const oudeRangIdx = _rangIdxVanRenown(oudRenown, drempels, rangen.length);
  const nieuweRangIdx = _rangIdxVanRenown(nieuwRenown, drempels, rangen.length);
  const boonGegeven = g.factieBoonsGegeven[factie.id] || [];
  const nieuweItems = [];

  if (nieuweRangIdx > oudeRangIdx) {
    for (let ri = oudeRangIdx + 1; ri <= nieuweRangIdx; ri++) {
      const rang = rangen[ri];
      if (!rang) continue;
      (rang.boons || []).forEach((boon, bi) => {
        const boonKey = `${ri}_${bi}`;
        if (boonGegeven.includes(boonKey)) return;
        boonGegeven.push(boonKey);
        // Los naam/tekst op via voorwerp-entity als entityId aanwezig
        let boonNaam = boon.naam || '';
        let boonNote = boon.tekst || '';
        if (boon.entityId) {
          const ent = (storage.readJSON('entities.json').voorwerpen || []).find(v => v.id === boon.entityId);
          if (ent) {
            boonNaam = boon.naam || ent.name;
            boonNote = ent.data?.beschrijving || ent.data?.description || ent.data?.note || '';
          }
        }
        const item = {
          id: `factie_boon_${factie.id}_${ri}_${bi}_${Date.now()}`,
          name: `${boonNaam || '?'} — ${factie.naam}`,
          note: boonNote,
          entityId: boon.entityId || null,
          entityType: boon.entityId ? 'voorwerpen' : null,
          factieId: factie.id,
          factieRang: ri,
          factieBoonIdx: bi,
        };
        nieuweItems.push(item);
      });
    }
  }
  g.factieBoonsGegeven[factie.id] = boonGegeven;

  // Deel boons uit aan alle spelers van de actieve groep
  if (nieuweItems.length) {
    if (!dmState.playerItems) dmState.playerItems = {};
    const entityData = storage.readJSON('entities.json');
    const spelers = (entityData.personages || []).filter(p => p.subtype === 'speler');
    const groepSpelers = spelers.filter(p => {
      return Object.values(dmState.groups || {}).some(grp => {
        return grp === g && (grp.characters || []).includes(p.id);
      }) || true; // fallback: alle spelers krijgen de boon
    });
    const targetIds = groepSpelers.length ? groepSpelers.map(p => p.id) : spelers.map(p => p.id);
    targetIds.forEach(charId => {
      if (!dmState.playerItems[charId]) dmState.playerItems[charId] = [];
      nieuweItems.forEach(item => dmState.playerItems[charId].push({ ...item, id: item.id + '_' + charId }));
    });
  }

  storage.writeJSON('dm-state.json', dmState);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('facties:updated');
  if (nieuweItems.length) io.to(room).emit('player:items-updated', {});
  res.json({ ok: true, id: factie.id, renown: nieuwRenown, rangIdx: nieuweRangIdx, boons: nieuweItems.length });
});

router.put('/meta/facties', requireDM, (req, res) => {
  if (!Array.isArray(req.body.facties)) return res.status(400).json({ error: 'facties-array vereist' });
  const meta = storage.readJSON('meta.json');
  meta.facties = req.body.facties.map(f => ({
    id: String(f.id || ('factie_' + Math.random().toString(36).slice(2, 7))).trim(),
    naam: String(f.naam || 'Naamloze factie').trim(),
    embleem: String(f.embleem || 'landmark').trim(),
    stijl: String(f.stijl || '').trim(),
    beschrijving: String(f.beschrijving || '').trim(),
    entityId:        f.entityId        ? String(f.entityId).trim()        : null,
    locatieEntityId: f.locatieEntityId ? String(f.locatieEntityId).trim() : null,
    npcEntityId:     f.npcEntityId     ? String(f.npcEntityId).trim()     : null,
    npcEntityIdDag:  f.npcEntityIdDag  ? String(f.npcEntityIdDag).trim()  : null,
    npcGreet:        f.npcGreet        ? String(f.npcGreet).trim()        : '',
    leden: (Array.isArray(f.leden) ? f.leden : [])
      .filter(l => l && l.entityId)
      .map(l => ({ entityId: String(l.entityId).trim(), rang: String(l.rang || '').trim() })),
    uitnodiging:      f.uitnodiging      ? String(f.uitnodiging).trim()      : '',
    uitnodigingTitel: f.uitnodigingTitel ? String(f.uitnodigingTitel).trim() : '',
    renownDrempels: (Array.isArray(f.renownDrempels) && f.renownDrempels.length)
      ? f.renownDrempels.map(n => parseInt(n) || 0)
      : [0, 1, 3, 10, 25, 50],
    rangen: (Array.isArray(f.rangen) && f.rangen.length)
      ? f.rangen.map(r => {
          const rang = { naam: String(r.naam || '—').trim(), voordelen: String(r.voordelen || '').trim() };
          if (r.titel && String(r.titel).trim()) rang.titel = String(r.titel).trim();
          const boons = (Array.isArray(r.boons) ? r.boons : [])
            .map(b => {
              const out = {};
              if (b.entityId && String(b.entityId).trim()) out.entityId = String(b.entityId).trim();
              if (b.naam && String(b.naam).trim()) out.naam = String(b.naam).trim();
              // Bewaar tekst voor backward compat (boons zonder entityId)
              if (!out.entityId && b.tekst && String(b.tekst).trim()) out.tekst = String(b.tekst).trim();
              return out;
            })
            .filter(b => b.entityId || b.naam || b.tekst);
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

// ── Facties: Missies ─────────────────────────────────────────────────────────
// Missies leven in archief.json als logEntries met type='missie'.

function _readMissies() {
  const archief = storage.readJSON('archief.json');
  return (archief.logEntries || []).filter(e => e.type === 'missie');
}

function _writeMissie(missie) {
  const archief = storage.readJSON('archief.json');
  if (!Array.isArray(archief.logEntries)) archief.logEntries = [];
  const idx = archief.logEntries.findIndex(e => e.id === missie.id);
  if (idx >= 0) archief.logEntries[idx] = missie;
  else archief.logEntries.push(missie);
  storage.writeJSON('archief.json', archief);
}

// GET /missies — speler ziet beschikbare+actieve missies van zijn groep;
//                DM ziet alles
router.get('/missies', attachRole, (req, res) => {
  if (!req.role) return res.status(401).json({ error: 'Niet ingelogd' });
  const missies = _readMissies();
  const dmState = readDmState();
  const meta = storage.readJSON('meta.json');

  if (req.role === 'dm') {
    return res.json({ missies });
  }
  const charId = req.session.characterId;
  const gid    = charId ? _playerGroupId(dmState, charId) : null;
  const renowns = gid ? (getGroup(dmState, gid).factieRenown || {}) : {};
  const zichtbaar = new Set(Object.keys(getGroup(dmState, gid)?.factieZichtbaar || {})
    .filter(id => getGroup(dmState, gid)?.factieZichtbaar[id]));

  const zichtbareMissies = missies.filter(m => {
    if (!zichtbaar.has(m.factieId)) return false;
    if (m.status === 'voltooid' || m.status === 'gefaald') return false;
    if (m.status === 'beschikbaar') {
      return (renowns[m.factieId] || 0) >= (m.vereistRenown || 0);
    }
    // actief/aangevraagd: toon als de groep bij betrokken is
    return m.groepId === gid;
  });
  res.json({ missies: zichtbareMissies });
});

// POST /missies — DM maakt een nieuwe missie aan
router.post('/missies', requireDM, (req, res) => {
  const { factieId, titel, tekst, vereistRenown, renownBeloning, valuta, stijl } = req.body;
  if (!factieId || !titel) return res.status(400).json({ error: 'factieId en titel vereist' });
  const missie = {
    id:             'missie_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    type:           'missie',
    factieId:       String(factieId),
    titel:          String(titel).trim(),
    tekst:          String(tekst || '').trim(),
    vereistRenown:  parseInt(vereistRenown) || 0,
    renownBeloning: parseInt(renownBeloning) || 0,
    valuta:         valuta || null,   // { fl, kn, cl }
    stijl:          stijl || '',
    status:         'beschikbaar',
    groepId:        null,
    aangevraagdDoor: null,
    ts:             Date.now(),
  };
  _writeMissie(missie);
  req.app.get('io').to(req.session?.campaignId||'main').emit('missies:updated');
  res.status(201).json(missie);
});

// PUT /missies/:id — DM bewerkt missie
router.put('/missies/:id', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.logEntries || []).findIndex(e => e.id === req.params.id && e.type === 'missie');
  if (idx < 0) return res.status(404).json({ error: 'Missie niet gevonden' });
  const allowed = ['titel','tekst','vereistRenown','renownBeloning','valuta','stijl','status','factieId'];
  allowed.forEach(f => { if (req.body[f] !== undefined) archief.logEntries[idx][f] = req.body[f]; });
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId||'main').emit('missies:updated');
  res.json(archief.logEntries[idx]);
});

// POST /missies/:id/accepteer — speler vraagt missie aan
router.post('/missies/:id/accepteer', attachRole, (req, res) => {
  const charId = req.session.characterId;
  if (!charId) return res.status(403).json({ error: 'Niet ingelogd als speler' });
  const archief = storage.readJSON('archief.json');
  const idx = (archief.logEntries || []).findIndex(e => e.id === req.params.id && e.type === 'missie');
  if (idx < 0) return res.status(404).json({ error: 'Missie niet gevonden' });
  const missie = archief.logEntries[idx];
  if (missie.status !== 'beschikbaar') return res.status(400).json({ error: 'Missie niet beschikbaar' });
  const dmState = readDmState();
  const gid = _playerGroupId(dmState, charId);
  const char = (storage.readJSON('entities.json').personages || []).find(e => e.id === charId);
  missie.status = 'aangevraagd';
  missie.groepId = gid;
  missie.aangevraagdDoor = charId;
  missie.aangevraagdNaam = char?.name || 'Onbekende speler';
  storage.writeJSON('archief.json', archief);
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  io.to(room).emit('missies:updated');
  io.to(room).emit('missie:aanvraag', { missieId: missie.id, titel: missie.titel, door: missie.aangevraagdNaam, factieId: missie.factieId });
  res.json({ ok: true });
});

// POST /missies/:id/goedkeuren — DM keurt aanvraag goed
router.post('/missies/:id/goedkeuren', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.logEntries || []).findIndex(e => e.id === req.params.id && e.type === 'missie');
  if (idx < 0) return res.status(404).json({ error: 'Missie niet gevonden' });
  const missie = archief.logEntries[idx];
  if (missie.status !== 'aangevraagd') return res.status(400).json({ error: 'Geen openstaande aanvraag' });
  missie.status = 'actief';
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId||'main').emit('missies:updated');
  req.app.get('io').to(req.session?.campaignId||'main').emit('missie:geactiveerd', { missieId: missie.id, titel: missie.titel });
  res.json({ ok: true });
});

// POST /missies/:id/voltooien — DM markeert als voltooid → renown + valuta
router.post('/missies/:id/voltooien', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.logEntries || []).findIndex(e => e.id === req.params.id && e.type === 'missie');
  if (idx < 0) return res.status(404).json({ error: 'Missie niet gevonden' });
  const missie = archief.logEntries[idx];
  if (!['actief','aangevraagd'].includes(missie.status)) return res.status(400).json({ error: 'Missie is niet actief' });
  missie.status = 'voltooid';
  storage.writeJSON('archief.json', archief);

  const dmState = readDmState();
  const gid = missie.groepId;
  const g = gid ? getGroup(dmState, gid) : null;
  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  let nieuweRang = null;

  if (g && missie.renownBeloning > 0 && missie.factieId) {
    if (!g.factieRenown) g.factieRenown = {};
    const meta = storage.readJSON('meta.json');
    const factie = _factiesConfig(meta).find(f => f.id === missie.factieId);
    const oud = g.factieRenown[missie.factieId] || 0;
    const nieuw = oud + missie.renownBeloning;
    g.factieRenown[missie.factieId] = nieuw;

    // Controleer rang-up + automatische boons
    if (factie) {
      const drempels = factie.renownDrempels || [0,1,3,10,25,50];
      const rangen   = factie.rangen || [];
      const oudIdx   = _rangIdxVanRenown(oud,   drempels, rangen.length);
      const nieuwIdx = _rangIdxVanRenown(nieuw,  drempels, rangen.length);
      if (nieuwIdx > oudIdx) {
        nieuweRang = rangen[nieuwIdx]?.naam || null;
        // Uitdelen boons voor alle nieuwe rangen
        const voorwerpen = storage.readJSON('entities.json').voorwerpen || [];
        const groepPersonages = Object.entries(dmState.playerProfiles || {})
          .filter(([_, p]) => _playerGroupId(dmState, _) === gid)
          .map(([charId]) => charId);
        for (let ri = oudIdx + 1; ri <= nieuwIdx; ri++) {
          for (const boon of (rangen[ri]?.boons || [])) {
            if (!boon.entityId) continue;
            const voorwerp = voorwerpen.find(v => v.id === boon.entityId);
            if (!voorwerp) continue;
            for (const charId of groepPersonages) {
              if (!dmState.playerItems) dmState.playerItems = {};
              if (!dmState.playerItems[charId]) dmState.playerItems[charId] = [];
              dmState.playerItems[charId].push({
                id:         voorwerp.id,
                name:       boon.naam || voorwerp.name,
                entityId:   voorwerp.id,
                entityType: 'voorwerpen',
                kind:       'boon',
                factieId:   missie.factieId,
              });
            }
          }
        }
      }
    }
    storage.writeJSON('dm-state.json', dmState);
    io.to(room).emit('facties:updated');
  }

  // Valuta-uitkering
  if (g && missie.valuta && toCl(missie.valuta) > 0) {
    const spelers = Object.entries(dmState.playerProfiles || {})
      .filter(([_, p]) => _playerGroupId(dmState, _) === gid)
      .map(([charId]) => charId);
    if (g.sharedPurse?.enabled) {
      g.sharedPurse = fromCl(toCl(g.sharedPurse) + toCl(missie.valuta));
      g.sharedPurse.enabled = true;
    } else if (spelers.length > 0) {
      const perSpeler = Math.floor(toCl(missie.valuta) / spelers.length);
      if (!dmState.playerCurrency) dmState.playerCurrency = {};
      for (const charId of spelers) {
        const cur = dmState.playerCurrency[charId] || { fl: 0, kn: 0, cl: 0 };
        dmState.playerCurrency[charId] = fromCl(toCl(cur) + perSpeler);
        io.to(room).emit('player:currency-updated', { characterId: charId, currency: dmState.playerCurrency[charId] });
      }
    }
    storage.writeJSON('dm-state.json', dmState);
  }

  io.to(room).emit('missies:updated');
  io.to(room).emit('missie:voltooid', { missieId: missie.id, titel: missie.titel, renownBeloning: missie.renownBeloning, nieuweRang });
  res.json({ ok: true, nieuweRang });
});

// POST /missies/:id/falen — DM markeert als gefaald
router.post('/missies/:id/falen', requireDM, (req, res) => {
  const archief = storage.readJSON('archief.json');
  const idx = (archief.logEntries || []).findIndex(e => e.id === req.params.id && e.type === 'missie');
  if (idx < 0) return res.status(404).json({ error: 'Missie niet gevonden' });
  archief.logEntries[idx].status = 'gefaald';
  storage.writeJSON('archief.json', archief);
  req.app.get('io').to(req.session?.campaignId||'main').emit('missies:updated');
  req.app.get('io').to(req.session?.campaignId||'main').emit('missie:gefaald', { missieId: archief.logEntries[idx].id, titel: archief.logEntries[idx].titel });
  res.json({ ok: true });
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
      menu:      Array.isArray(config.menu) ? config.menu : [],
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

// Aan de tap: bestel een drankje/maaltijd → beurs afschrijven, temp HP + status-buff.
router.post('/herberg/bestel', attachRole, (req, res) => {
  const meta = storage.readJSON('meta.json');
  const config = meta.herberg;
  if (!config) return res.status(404).json({ error: 'Herberg niet geconfigureerd' });

  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Alleen spelers kunnen bestellen' });

  const item = (Array.isArray(config.menu) ? config.menu : []).find(m => m.id === req.body.itemId);
  if (!item) return res.status(404).json({ error: 'Item niet gevonden' });

  const dmState = readDmState();

  // Prijs afschrijven (gedeelde of eigen beurs, net als overnachten)
  const prijs = parsePrijs(item.prijs || '0');
  const prijsCl = prijs ? toCl(prijs) : 0;
  if (prijsCl > 0) {
    const cur = _effectiveCurrency(dmState, characterId);
    if (toCl(cur) < prijsCl) return res.status(400).json({ error: 'Niet genoeg geld op zak.' });
    _deductCurrency(dmState, characterId, prijsCl);
  }

  // Temp HP — vast getal óf een worp (bv. "1d6"); telt niet op (D&D: hoogste waarde wint)
  let tempHp = null;
  let tempRoll = null;
  const tempSpec = String(item.tempHp ?? '').trim();
  let itemTemp = 0;
  if (/^\d+$/.test(tempSpec)) {
    itemTemp = parseInt(tempSpec, 10) || 0;
  } else if (/^\d+d\d+$/i.test(tempSpec)) {
    itemTemp = rollDice(tempSpec);
    tempRoll = { formule: tempSpec, resultaat: itemTemp };
  }
  if (itemTemp > 0) {
    if (!dmState.playerHp) dmState.playerHp = {};
    const hp = dmState.playerHp[characterId] || { current: null, max: null, temp: 0 };
    hp.temp = Math.max(hp.temp || 0, itemTemp);
    dmState.playerHp[characterId] = hp;
    tempHp = hp.temp;
  }

  // Status-buff (zichtbaar op de sheet tot de volgende lange rust)
  let buff = null;
  if (item.buffLabel) {
    if (!dmState.playerBuffs) dmState.playerBuffs = {};
    const list = (dmState.playerBuffs[characterId] || []).filter(b => b.label !== item.buffLabel);
    buff = {
      id: 'buff_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: item.buffLabel,
      desc: item.buffDesc || '',
      bron: config.naam || 'De herberg',
    };
    list.push(buff);
    dmState.playerBuffs[characterId] = list;
  }

  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io');
  const room = req.session?.campaignId || 'main';
  const currency = _effectiveCurrency(dmState, characterId);
  io.to(room).emit('player:currency-updated', { characterId, currency });
  if (tempHp !== null) io.to(room).emit('player:hp-updated', { characterId, ...dmState.playerHp[characterId] });
  io.to(room).emit('player:buffs-updated', { characterId, buffs: dmState.playerBuffs?.[characterId] || [] });

  res.json({
    item: { naam: item.naam, beschrijving: item.beschrijving || '' },
    currency, tempHp, tempRoll, buff,
  });
});

// ── Tweespalt / Gokkantoor ──

function _tsState(dmState) {
  if (!dmState.tweespalt) dmState.tweespalt = {};
  if (!dmState.tweespalt.events) dmState.tweespalt.events = [];
  if (!dmState.tweespalt.leningen) dmState.tweespalt.leningen = {};
  if (!dmState.tweespalt.arenaSignups) dmState.tweespalt.arenaSignups = [];
  if (!dmState.tweespalt.arenaVerslagen) dmState.tweespalt.arenaVerslagen = [];
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

  // Arena — partijen (DM-config) + inschrijvingen (eigen voor speler, alle voor DM)
  const arenaAll = Array.isArray(tsMeta.arena) ? tsMeta.arena : [];
  const gewoneBouts = arenaAll.filter(b => !b.verborgen);
  const arenaCompleet = gewoneBouts.length > 0 && gewoneBouts.every(b => ts.arenaVerslagen.includes(b.id));
  // Verborgen eindbaas verschijnt pas als alle gewone partijen verslagen zijn (de DM ziet 'm altijd)
  const arena = isDM ? arenaAll : arenaAll.filter(b => !b.verborgen || arenaCompleet);
  const arenaSignups = isDM
    ? ts.arenaSignups
    : (characterId ? ts.arenaSignups.filter(s => s.doorId === characterId) : []);

  res.json({ events, currency, lening, nameFirst, nameLast, config, arena, arenaSignups, arenaVerslagen: ts.arenaVerslagen, arenaCompleet });
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

// ── Arena: speler meldt zich aan voor een partij; de DM beslecht het als echt gevecht ──
router.post('/tweespalt/arena/:boutId/aanmeld', attachRole, (req, res) => {
  const characterId = req.session.characterId;
  if (!characterId) return res.status(403).json({ error: 'Alleen spelers kunnen het strijdperk betreden' });

  const tsMeta = storage.readJSON('meta.json').tweespalt || {};
  const bout = (Array.isArray(tsMeta.arena) ? tsMeta.arena : []).find(b => b.id === req.params.boutId);
  if (!bout) return res.status(404).json({ error: 'Partij niet gevonden' });

  const dmState = readDmState();
  const ts = _tsState(dmState);
  if (ts.arenaVerslagen.includes(bout.id)) {
    return res.status(400).json({ error: 'Deze tegenstander is al verslagen — de partij is gesloten.' });
  }
  if (bout.verborgen) {
    const gewoon = (Array.isArray(tsMeta.arena) ? tsMeta.arena : []).filter(b => !b.verborgen);
    const compleet = gewoon.length > 0 && gewoon.every(b => ts.arenaVerslagen.includes(b.id));
    if (!compleet) return res.status(400).json({ error: 'Dit strijdperk is nog verzegeld.' });
  }
  if (ts.arenaSignups.some(s => s.doorId === characterId && s.boutId === bout.id && s.status === 'aangemeld')) {
    return res.status(400).json({ error: 'Je staat al ingeschreven voor deze partij.' });
  }

  // Inleg (optioneel) afschrijven
  const inzet = parsePrijs(bout.inzet || '0');
  const inzetCl = inzet ? toCl(inzet) : 0;
  if (inzetCl > 0) {
    const cur = _effectiveCurrency(dmState, characterId);
    if (toCl(cur) < inzetCl) return res.status(400).json({ error: 'Niet genoeg geld voor de inleg.' });
    _deductCurrency(dmState, characterId, inzetCl);
  }

  const signup = {
    id: 'arena_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    boutId: bout.id, boutNaam: bout.naam || 'Arenapartij',
    tegenstander: bout.tegenstander || '', prijs: bout.prijs || '', inzet: bout.inzet || '',
    doorId: characterId, doorNaam: req.session.playerName || '',
    status: 'aangemeld', op: new Date().toISOString(),
  };
  ts.arenaSignups.push(signup);
  storage.writeJSON('dm-state.json', dmState);

  const io = req.app.get('io'); const room = req.session?.campaignId || 'main';
  io.to(room).emit('tweespalt:updated');
  if (inzetCl > 0) io.to(room).emit('player:currency-updated', { characterId, currency: _effectiveCurrency(dmState, characterId) });
  res.json({ ok: true, signup });
});

// DM beslecht een arenapartij: overwinning (prijzengeld) of nederlaag.
router.post('/tweespalt/arena/signup/:id/uitslag', requireDM, (req, res) => {
  const uitkomst = req.body?.uitkomst === 'overwinning' ? 'overwinning' : 'nederlaag';
  const dmState = readDmState();
  const ts = _tsState(dmState);
  const signup = ts.arenaSignups.find(s => s.id === req.params.id);
  if (!signup) return res.status(404).json({ error: 'Inschrijving niet gevonden' });

  const io = req.app.get('io'); const room = req.session?.campaignId || 'main';
  const prijs = parsePrijs(signup.prijs || '0');
  const prijsCl = prijs ? toCl(prijs) : 0;

  if (uitkomst === 'overwinning' && signup.doorId && prijsCl > 0) {
    _deductCurrency(dmState, signup.doorId, -prijsCl);   // negatief bedrag = uitbetalen
    io.to(room).emit('player:currency-updated', { characterId: signup.doorId, currency: _effectiveCurrency(dmState, signup.doorId) });
  }

  // Cinematisch briefje van de kamprechter
  if (signup.doorId) {
    const tekst = uitkomst === 'overwinning'
      ? `Het volk brult je naam! Je versloeg ${signup.tegenstander || 'je tegenstander'} in "${signup.boutNaam}". De kamprechter telt ${signup.prijs || 'je prijzengeld'} in je hand — welverdiend, kampioen.`
      : `Je vocht met eer in "${signup.boutNaam}", maar ${signup.tegenstander || 'je tegenstander'} was je de baas. Het zand kent geen genade. Sta op en kom sterker terug.`;
    _bezorgBrief(req, signup.doorId, { titel: signup.boutNaam, tekst, afzender: 'De Tweespalt — het strijdperk', thema: 'tweespalt' });
  }

  // Overwinning: de tegenstander is verslagen → partij eenmalig sluiten
  if (uitkomst === 'overwinning' && signup.boutId && !ts.arenaVerslagen.includes(signup.boutId)) {
    ts.arenaVerslagen.push(signup.boutId);
  }

  ts.arenaSignups = ts.arenaSignups.filter(s => s.id !== signup.id);
  storage.writeJSON('dm-state.json', dmState);
  io.to(room).emit('tweespalt:updated');
  res.json({ ok: true, uitkomst });
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
  if (req.body.description !== undefined) map.description = String(req.body.description || '').slice(0, 600);
  if (req.body.thumbId     !== undefined) map.thumbId     = req.body.thumbId || '';
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

// POST /api/dungeons/:id/grant-access — geef één groep toegang (additief; voor regie-balk)
router.post('/dungeons/:id/grant-access', requireDM, (req, res) => {
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId vereist' });
  const maps = _readDungeons();
  const map  = maps.find(m => m.id === req.params.id);
  if (!map) return res.status(404).json({ error: 'Niet gevonden' });
  if (!Array.isArray(map.partyAccess)) map.partyAccess = [];
  if (!map.partyAccess.includes(groupId)) map.partyAccess.push(groupId);
  _writeDungeons(maps);
  req.app.get('io').to(req.session?.campaignId||'main').emit('dungeon:updated');
  res.json({ ok: true, partyAccess: map.partyAccess });
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
    loot:         req.body.loot         || { goud: { fl: 0, kn: 0, cl: 0 }, items: [] },
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
  const dying = (data.encounters || []).find(e => e.id === req.params.id);
  data.encounters = (data.encounters || []).filter(e => e.id !== req.params.id);
  storage.writeJSON('encounters.json', data);
  if (dying?.backdropId) _deleteFileIfUnused(dying.backdropId);
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
    // Statblocks schrijven AC als "15 (studded leather)". In het gevecht wil je
    // alleen het getal: de omschrijving staat al in het statblock zelf.
    const mAc = (String(preset?.statblock?.ac ?? '').match(/-?\d+/) || [''])[0];
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
    encounterId:  enc.id,
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
