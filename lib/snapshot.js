'use strict';
const fs      = require('fs');
const path    = require('path');
const storage = require('./storage');

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional */ }

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

// Max width/height for embedded images in the snapshot
const IMG_MAX_PX  = 1200;
// Max width for static map assets (higher res is nice for the map)
const MAP_MAX_PX  = 2400;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToDataUri(filePath, maxPx) {
  if (!fs.existsSync(filePath)) return null;
  const ext  = path.extname(filePath).slice(1).toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                 gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
                 pdf: 'application/pdf' }[ext] || 'application/octet-stream';
  let buf = fs.readFileSync(filePath);
  if (sharp && mime.startsWith('image/') && mime !== 'image/svg+xml') {
    try {
      buf = await sharp(buf)
        .resize(maxPx || IMG_MAX_PX, maxPx || IMG_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch { /* fall through to raw embed */ }
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Collect base64 for a storage file ID (image / PDF)
async function embedFile(id, collected) {
  if (!id || collected[id]) return;
  const info = storage.getFile(id);
  if (!info) return;
  // Skip audio files in snapshot (too large, not needed)
  if (info.mimetype.startsWith('audio/')) return;

  let buf = fs.readFileSync(info.path);

  if (sharp && info.mimetype.startsWith('image/') && info.mimetype !== 'image/svg+xml') {
    try {
      buf = await sharp(buf)
        .resize(IMG_MAX_PX, IMG_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      collected[id] = `data:image/jpeg;base64,${buf.toString('base64')}`;
      return;
    } catch { /* fall through */ }
  }
  collected[id] = `data:${info.mimetype};base64,${buf.toString('base64')}`;
}

// ── Main export function ──────────────────────────────────────────────────────

async function buildSnapshot(dmState, groupId) {
  const gid = groupId || dmState.activeGroup;
  const g   = dmState.groups[gid] || Object.values(dmState.groups)[0];

  const entities  = storage.readJSON('entities.json');
  const archief   = storage.readJSON('archief.json');
  const meta      = storage.readJSON('meta.json');
  const mapData   = storage.readJSON('map.json');

  const DEFAULT_MAPS = [
    { id: 'grisburgh', label: 'Grisburgh', src: '/assets/map-grisburgh.jpg' },
    { id: 'isfar',     label: 'Isfār',     src: '/assets/map-isfar.jpg'     },
  ];
  const maps = mapData.maps || DEFAULT_MAPS;

  // ── Filter entities for player visibility ──
  const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const filteredEntities = {};
  for (const type of ENTITY_TYPES) {
    filteredEntities[type] = (entities[type] || [])
      .map(e => {
        const vis = g.visibility[e.id] || 'hidden';
        if (vis === 'hidden') return null;
        if (vis === 'vague') {
          return { id: e.id, name: e.name, subtype: e.subtype || '', data: {}, links: {}, _visibility: 'vague' };
        }
        const out = { ...e, data: { ...e.data } };
        if (!g.secretReveals[e.id]) delete out.data.geheim;
        delete out.stats;
        out._visibility  = 'visible';
        out._deceased    = !!(g.deceased?.[e.id]);
        return out;
      })
      .filter(Boolean);
  }

  // ── Filter documents ──
  const filteredDocs = (archief.documents || [])
    .map(d => {
      const state = dmState.docStates[d.id] || 'hidden';
      if (state === 'hidden') return null;
      const out = { ...d, state };
      if (state === 'blurred') { out.npcs = []; out.locs = []; out.orgs = []; out.items = []; out.docs = []; }
      return out;
    })
    .filter(Boolean);

  // ── Filter sessieLog ──
  const sessieLog = (archief.sessieLog || [])
    .filter(e => e.visible)
    .map(e => ({
      ...e,
      images: (e.images || []).filter(img => typeof img === 'string' || img.visible !== false),
    }));

  // ── Filter tekstContent ──
  const tekstContent = {};
  for (const [id, txt] of Object.entries(archief.tekstContent || {})) {
    const state = dmState.docStates[id] || 'hidden';
    if (state === 'revealed') tekstContent[id] = txt;
  }

  // ── Filter map pins ──
  const mapPins = {};
  for (const map of maps) {
    const pins = (mapData.pins || [])
      .filter(p => (p.mapId || 'grisburgh') === map.id)
      .map(pin => {
        const loc = (entities.locaties || []).find(l => l.id === pin.locId);
        if (!loc) return null;
        const vis = g.visibility[loc.id] || 'hidden';
        if (vis === 'hidden') return null;
        return { ...pin, locName: vis === 'vague' ? null : loc.name, visibility: vis };
      })
      .filter(Boolean);
    if (pins.length) mapPins[map.id] = pins;
  }

  // ── Ownership info ──
  const ownership = {
    owners:       g.itemOwners   || {},
    requests:     [],
    tradeAllowed: g.tradeAllowed !== false,
  };

  // ── Collect file IDs to embed — only map images ──
  // Entity/document/log images are skipped to keep the snapshot small.
  // Cards and detail panels degrade gracefully to icon-only display.
  const files = {};

  // Map images only (static assets + uploaded maps)
  for (const map of maps) {
    if (map.src && map.src.startsWith('/assets/')) {
      const assetPath = path.join(ASSETS_DIR, path.basename(map.src));
      const uri = await fileToDataUri(assetPath, MAP_MAX_PX);
      if (uri) files[map.id] = uri;
    } else if (!map.src) {
      await embedFile(map.id, files);
    }
  }

  // ── Inline CSS from theme.css ──
  let themeCss = '';
  try {
    themeCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'theme.css'), 'utf8');
  } catch { /* ok */ }

  // ── Assemble SNAPSHOT object ──
  const snapshot = {
    exportedAt:   new Date().toISOString(),
    meta,
    entities:     filteredEntities,
    ownership,
    documents:    filteredDocs,
    sessieLog,
    tekstContent,
    maps,
    mapPins,
    files,
  };

  return generateHtml(snapshot, themeCss);
}

// ── HTML generator ────────────────────────────────────────────────────────────

function generateHtml(S, themeCss) {
  const title    = S.meta?.appTitle    || 'Grisburgh';
  const subtitle = S.meta?.appSubtitle || 'Ontdekkingen uit het stadsarchief';
  const exportDate = new Date(S.exportedAt).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Snapshot</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        room:    { bg:'#f5edd8',surface:'#efe3c5',elevated:'#e6d5ad',border:'#c4a87a','border-light':'#d4bc92' },
        ink:     { bright:'#2a1a08',medium:'#5a4030',dim:'#8a7050',faint:'#b09870' },
        gold:    { DEFAULT:'#b8860b',dim:'#9a7008',glow:'rgba(184,134,11,0.12)' },
        seal:    { DEFAULT:'#8b2a2a',glow:'rgba(139,42,42,0.15)' },
        'blue-ink':   { DEFAULT:'#2a5a8a',glow:'rgba(42,90,138,0.12)' },
        'green-wax':  { DEFAULT:'#2a6a3a',glow:'rgba(42,106,58,0.12)' },
        'purple-codex':{ DEFAULT:'#5a3a7a',glow:'rgba(90,58,122,0.12)' },
        orange:  { DEFAULT:'#9a6a2a',glow:'rgba(154,106,42,0.12)' },
        parchment:{ letter:'#f2e6c8',press:'#e8e2d8',map:'#e0d8c4',codex:'#1a1520',log:'#f5f0e5' },
      },
      fontFamily: {
        cinzel:  ['Cinzel','serif'],
        crimson: ['Crimson Text','Georgia','serif'],
        fell:    ['IM Fell English','serif'],
        mono:    ['JetBrains Mono','monospace'],
      },
      boxShadow: { card:'0 2px 12px rgba(0,0,0,0.4)', deep:'0 8px 32px rgba(0,0,0,0.6)' },
    },
  },
};
</script>
<style>
${themeCss}
/* Snapshot-specific overrides */
.snap-readonly-badge {
  position: fixed; bottom: 12px; right: 12px; z-index: 9999;
  padding: 5px 10px; border-radius: 20px;
  background: rgba(42,26,8,0.82); color: #c4930a;
  font-family: 'Cinzel', serif; font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em; border: 1px solid rgba(196,147,10,0.35);
  pointer-events: none;
}
.snap-lightbox {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.92);
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
}
.snap-lightbox img { max-width: 95vw; max-height: 92vh; object-fit: contain; border-radius: 4px; }
.snap-lightbox-close {
  position: absolute; top: 16px; right: 20px;
  color: #fff; font-size: 32px; cursor: pointer;
  background: none; border: none; line-height: 1;
  opacity: 0.7; transition: opacity 0.15s;
}
.snap-lightbox-close:hover { opacity: 1; }
.doc-viewer-wrap {
  display: flex; flex-direction: column; gap: 12px; padding: 4px 0;
}
.doc-viewer-img { width: 100%; border-radius: 6px; cursor: zoom-in; }
.doc-viewer-text {
  font-family: 'Crimson Text', serif; font-size: 15px; line-height: 1.7;
  color: #2a1a08; white-space: pre-wrap;
}
.doc-viewer-text h1, .doc-viewer-text h2, .doc-viewer-text h3 {
  font-family: 'Cinzel', serif; font-weight: 700; margin: 0.75em 0 0.3em;
}
.doc-viewer-text h1 { font-size: 1.25em; }
.doc-viewer-text h2 { font-size: 1.1em; }
.doc-viewer-text strong { font-weight: 700; }
.doc-viewer-text em { font-style: italic; }
.doc-viewer-text p { margin: 0.4em 0; }
</style>
</head>
<body class="bg-room-bg text-ink-bright font-crimson min-h-screen">

<div class="player-mode" id="app" style="display:flex;flex-direction:column;height:100vh;overflow:hidden">

  <!-- Header -->
  <header class="px-6 pt-5 pb-4 bg-room-elevated border-b-2 border-room-border flex-shrink-0">
    <div class="flex items-center gap-4">
      <div class="flex-shrink-0">
        <div>
          <h1 id="snap-title" class="font-cinzel font-black text-2xl text-ink-bright tracking-widest uppercase">${esc(title)}</h1>
          <div class="flex items-center gap-2 mt-0.5">
            <div class="h-px flex-1 bg-gradient-to-r from-gold/60 to-transparent"></div>
            <p id="snap-subtitle" class="font-fell italic text-ink-dim text-sm tracking-wide">${esc(subtitle)}</p>
            <div class="h-px flex-1 bg-gradient-to-l from-gold/60 to-transparent"></div>
          </div>
          <div class="text-[10px] font-mono text-ink-faint mt-1 opacity-60">📷 Snapshot — ${esc(exportDate)}</div>
        </div>
      </div>
    </div>
  </header>

  <!-- Nav tabs -->
  <nav class="flex gap-1 px-4 pt-2 border-b border-room-border flex-shrink-0" id="snap-nav" style="overflow:visible">
    <div class="relative flex-shrink-0" id="archief-nav-group">
      <button class="section-tab archief-tab active" id="archief-nav-btn" onclick="snapToggleArchief()">
        ☰ <span id="archief-nav-label">Archief</span> <span class="archief-arrow">▾</span>
      </button>
      <div class="archief-menu hidden" id="archief-menu">
        <button class="archief-menu-item active" data-section="personages" onclick="snapSwitch('personages')">👤 Personages</button>
        <button class="archief-menu-item" data-section="locaties"     onclick="snapSwitch('locaties')">🏰 Locaties</button>
        <button class="archief-menu-item" data-section="organisaties" onclick="snapSwitch('organisaties')">🏛️ Organisaties</button>
        <button class="archief-menu-item" data-section="voorwerpen"   onclick="snapSwitch('voorwerpen')">⚔️ Voorwerpen</button>
        <button class="archief-menu-item" data-section="documenten"   onclick="snapSwitch('documenten')">📜 Documenten</button>
        <button class="archief-menu-item" data-section="kaart"        onclick="snapSwitch('kaart')">🗺️ Kaarten</button>
      </div>
    </div>
    <button class="section-tab" data-section="logboek" onclick="snapSwitch('logboek')">📖 Logboek</button>
  </nav>

  <!-- Sections -->
  <div id="snap-body" style="flex:1;overflow:hidden;position:relative">
    <div id="sec-personages"   class="section active"></div>
    <div id="sec-locaties"     class="section"></div>
    <div id="sec-organisaties" class="section"></div>
    <div id="sec-voorwerpen"   class="section"></div>
    <div id="sec-documenten"   class="section"></div>
    <div id="sec-kaart"        class="section"></div>
    <div id="sec-logboek"      class="section"></div>
  </div>

</div>

<!-- Modal overlay -->
<div class="modal-overlay" id="snap-modal-overlay" onclick="if(event.target===this)snapCloseModal()">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-head">
      <div style="flex:1;min-width:0">
        <div id="m-accent" class="modal-accent bar-personages" style="height:3px;border-radius:2px;margin-bottom:8px"></div>
        <div id="m-title" class="font-cinzel font-bold text-lg text-ink-bright"></div>
        <div id="m-sub"   class="text-xs text-ink-dim font-mono mt-0.5"></div>
      </div>
      <button class="modal-close" onclick="snapCloseModal()">×</button>
    </div>
    <div class="modal-body overflow-y-auto p-5 flex-1" id="m-body"></div>
  </div>
</div>

<!-- Lightbox -->
<div id="snap-lightbox" class="snap-lightbox hidden" onclick="snapCloseLightbox()">
  <button class="snap-lightbox-close" onclick="snapCloseLightbox()">×</button>
  <img id="snap-lb-img" src="" alt="">
</div>

<!-- Read-only badge -->
<div class="snap-readonly-badge">📷 Read-only snapshot</div>

<script>
// ════════════════════════════════════════════════════════════════════════════
//  SNAPSHOT DATA
// ════════════════════════════════════════════════════════════════════════════
const S = ${JSON.stringify(S)};

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mdToHtml(text) {
  if (!text) return '';
  return esc(text)
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\\s+(.+)$/gm, (_, t) => '<strong>' + t + '</strong>')
    .replace(/\\n/g, '<br>');
}

function imgUrl(id) {
  return S.files[id] || '';
}

function sortKey(name) {
  return (name || '').replace(/^(de|het|'t)\\s+/i, '').trim();
}

// ════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════════════════════════

const ARCHIEF_SECTIONS = ['personages','locaties','organisaties','voorwerpen','documenten','kaart'];
const ARCHIEF_LABELS = {
  personages:'👤 Personages', locaties:'🏰 Locaties', organisaties:'🏛️ Organisaties',
  voorwerpen:'⚔️ Voorwerpen', documenten:'📜 Documenten', kaart:'🗺️ Kaarten',
};

let _activeSection = 'personages';
let _rendered = {};

function snapSwitch(section) {
  _activeSection = section;
  document.getElementById('archief-menu')?.classList.add('hidden');

  // Tabs active state
  document.querySelectorAll('.section-tab[data-section]').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));
  document.querySelectorAll('.archief-menu-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  const isArchief = ARCHIEF_SECTIONS.includes(section);
  const btn   = document.getElementById('archief-nav-btn');
  const label = document.getElementById('archief-nav-label');
  if (btn) btn.classList.toggle('active', isArchief);
  if (label) label.textContent = isArchief ? ARCHIEF_LABELS[section] : 'Archief';

  // Show/hide sections
  document.querySelectorAll('#snap-body .section').forEach(s =>
    s.classList.toggle('active', s.id === 'sec-' + section));

  // Render on first visit
  if (!_rendered[section]) {
    _rendered[section] = true;
    RENDERERS[section]?.();
  }
}

function snapToggleArchief() {
  document.getElementById('archief-menu')?.classList.toggle('hidden');
}

// Close archief menu on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#archief-nav-group'))
    document.getElementById('archief-menu')?.classList.add('hidden');
});

// ════════════════════════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════════════════════════

function snapOpenModal(title, subtitle, body, accentClass) {
  document.getElementById('m-title').textContent = title;
  document.getElementById('m-sub').textContent   = subtitle || '';
  document.getElementById('m-body').innerHTML    = body;
  const accent = document.getElementById('m-accent');
  if (accent) accent.className = 'modal-accent ' + (accentClass || 'bar-personages');
  document.getElementById('snap-modal-overlay').classList.add('active');
}

function snapCloseModal() {
  document.getElementById('snap-modal-overlay').classList.remove('active');
  document.getElementById('m-body').innerHTML = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { snapCloseModal(); snapCloseLightbox(); }
});

// ════════════════════════════════════════════════════════════════════════════
//  LIGHTBOX
// ════════════════════════════════════════════════════════════════════════════

function snapOpenLightbox(src) {
  if (!src) return;
  document.getElementById('snap-lb-img').src = src;
  document.getElementById('snap-lightbox').classList.remove('hidden');
}

function snapCloseLightbox() {
  document.getElementById('snap-lightbox').classList.add('hidden');
}

// ════════════════════════════════════════════════════════════════════════════
//  ENTITY SECTIONS
// ════════════════════════════════════════════════════════════════════════════

const TYPE_META = {
  personages:   { icon:'👤', label:'Personages',    color:'green-wax', accent:'bar-personages' },
  locaties:     { icon:'🏰', label:'Locaties',       color:'blue-ink',  accent:'bar-locaties'   },
  organisaties: { icon:'🏛️', label:'Organisaties',   color:'seal',      accent:'bar-organisaties'},
  voorwerpen:   { icon:'⚔️', label:'Voorwerpen',     color:'orange',    accent:'bar-voorwerpen' },
};

const SCHEMA = {
  personages:   { fields:[{key:'rol',label:'Rol'},{key:'ras',label:'Ras'},{key:'klasse',label:'Klasse'},{key:'desc',label:'Beschrijving'},{key:'flavour',label:'Flavour tekst'}]},
  locaties:     { fields:[{key:'locType',label:'Type'},{key:'wijk',label:'Wijk'},{key:'eigenaar',label:'Eigenaar'},{key:'desc',label:'Beschrijving'},{key:'flavour',label:'Flavour tekst'}]},
  organisaties: { fields:[{key:'orgType',label:'Type'},{key:'motto',label:'Motto'},{key:'desc',label:'Beschrijving'},{key:'flavour',label:'Flavour tekst'}]},
  voorwerpen:   { fields:[{key:'itemType',label:'Type'},{key:'rariteit',label:'Rariteit'},{key:'prijs',label:'Prijs'},{key:'desc',label:'Beschrijving'},{key:'flavour',label:'Flavour tekst'}]},
};

const AUTO_ICONS = {
  personages:   { NPC:'👥',speler:'⚔️',antagonist:'💀',god:'✨',dier:'🐾',verkoper:'🏪' },
  locaties:     { Stadswijk:'🏠',Gebouw:'🏗',Herberg:'🍺',Taveerne:'🍻',Tempel:'⛪',Winkel:'🛒',Fort:'🏰',Schip:'⛵',Dorp:'🏡',Stad:'🏙',Woud:'🌲',Zee:'🌊',Overig:'📍' },
  organisaties: { Gilde:'⚒️',Factie:'⚔️',Religieus:'⚛️',Politiek:'👑',Crimineel:'🗡️',Militair:'🛡️',Overig:'🔹' },
  voorwerpen:   { Wapen:'⚔️',Toveritem:'🔮',Drank:'🧪',Uitrusting:'🛡️',Scroll:'📜',Ring:'💍',Amulet:'🗡️',Overig:'💎' },
};

function getAutoIcon(type, e) {
  if (e.data?.icon) return e.data.icon;
  const map = AUTO_ICONS[type] || {};
  const key = e.subtype || e.data?.locType || e.data?.orgType || e.data?.itemType || '';
  return map[key] || TYPE_META[type].icon;
}

let _searchQ = { personages:'', locaties:'', organisaties:'', voorwerpen:'' };

const PAGE_SIZE = 12;
const _page = { personages: 0, locaties: 0, organisaties: 0, voorwerpen: 0 };

function renderEntitySection(type) {
  const container = document.getElementById('sec-' + type);
  const meta = TYPE_META[type];
  const DESC = { personages:'Helden, vrienden en vijanden', locaties:'Plaatsen, wijken en gebouwen',
                 organisaties:'Gilden, facties en genootschappen', voorwerpen:'Magische voorwerpen en uitrusting' };

  container.innerHTML = \`
    <div class="section-banner">
      <div class="section-banner-title">
        <span>\${meta.icon}</span><span>\${meta.label}</span>
        <span class="font-fell font-normal normal-case tracking-normal text-ink-faint text-xs italic ml-1">\${DESC[type]}</span>
      </div>
      <div class="section-banner-line"></div>
    </div>
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30 flex-shrink-0">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">⌕</span>
        <input id="search-\${type}" type="text" placeholder="Zoek \${meta.label.toLowerCase()}…"
          class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          oninput="snapSearch('\${type}', this.value)">
      </div>
      <span id="count-\${type}" class="text-ink-faint text-xs font-mono"></span>
    </div>
    <div id="grid-\${type}" class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-5 overflow-y-auto flex-1"></div>
    <div id="pages-\${type}" class="flex items-center justify-center gap-4 px-6 py-3 border-t border-room-border flex-shrink-0 bg-room-surface/20"></div>
  \`;

  refreshGrid(type);
}

function filterEntities(type) {
  const q = _searchQ[type]?.toLowerCase() || '';
  return (S.entities[type] || [])
    .filter(e => {
      if (!q) return true;
      const hay = [e.name, e.subtype, ...Object.values(e.data || {})].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'nl', { sensitivity: 'base' }));
}

function refreshGrid(type) {
  const list   = filterEntities(type);
  const total  = list.length;
  const pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (_page[type] >= pages) _page[type] = 0;
  const page   = _page[type];
  const slice  = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const count = document.getElementById('count-' + type);
  if (count) count.textContent = total + ' resultaten';

  const grid = document.getElementById('grid-' + type);
  if (grid) {
    grid.innerHTML = slice.length === 0
      ? \`<div class="col-span-full text-center py-20 text-ink-faint">
          <div class="text-5xl mb-4 opacity-40">\${TYPE_META[type].icon}</div>
          <div class="font-cinzel text-sm font-semibold text-ink-dim">Geen \${TYPE_META[type].label.toLowerCase()} gevonden</div>
         </div>\`
      : slice.map(e => renderCard(type, e)).join('');
  }

  const nav = document.getElementById('pages-' + type);
  if (nav) {
    if (pages <= 1) {
      nav.style.display = 'none';
    } else {
      nav.style.display = 'flex';
      nav.innerHTML = \`
        <button onclick="snapPage('\${type}',-1)"
          class="map-nav-btn" \${page === 0 ? 'disabled' : ''}>◀</button>
        <span class="font-cinzel text-xs text-ink-dim">
          \${page + 1} / \${pages}
        </span>
        <button onclick="snapPage('\${type}',1)"
          class="map-nav-btn" \${page >= pages - 1 ? 'disabled' : ''}>▶</button>
      \`;
    }
  }
}

function snapSearch(type, q) {
  _searchQ[type] = q;
  _page[type] = 0;
  refreshGrid(type);
}

function snapPage(type, dir) {
  const list  = filterEntities(type);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  _page[type] = Math.max(0, Math.min(pages - 1, _page[type] + dir));
  refreshGrid(type);
  document.getElementById('sec-' + type)?.scrollTo(0, 0);
}

function renderCard(type, e) {
  if (e._visibility === 'vague') {
    return \`<div class="entity-card card-vague no-img">
      <div class="card-accent bar-\${type}" style="opacity:0.45"></div>
      <div class="card-body px-4 py-4">
        <div class="flex items-center gap-2.5">
          <div class="card-icon" style="opacity:0.35;filter:grayscale(1)">\${TYPE_META[type].icon}</div>
          <div class="min-w-0"><span class="card-name">\${esc(e.name)}</span>
            <div class="text-[10px] text-ink-faint font-fell italic">— onbekend —</div></div>
        </div>
      </div>
    </div>\`;
  }

  const rol     = e.data?.rol || '';
  const metaText = [e.data?.locType, e.data?.orgType, e.data?.itemType, e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
  const desc    = e.data?.desc || '';
  const flavour = e.data?.flavour || '';

  // ownership badge for voorwerpen
  let ownerBadge = '';
  if (type === 'voorwerpen') {
    const owner = S.ownership.owners[e.id];
    if (owner) ownerBadge = \`<div class="item-owner-badge">\uD83C\uDF92 \${esc(owner.playerName)}</div>\`;
  }

  // Cards have no embedded images — icon-only layout
  return \`<div class="entity-card no-img\${e._deceased ? ' card-deceased' : ''}" onclick="snapOpenEntity('\${type}','\${esc(e.id)}')">
    <div class="card-accent bar-\${type}"></div>
    <div class="card-body px-4 pt-3 pb-3">
      <div class="flex items-start gap-2.5 mb-2">
        <div class="card-icon">\${getAutoIcon(type, e)}</div>
        <div class="min-w-0 flex-1">
          <span class="card-name block">\${esc(e.name)}\${e._deceased ? '<span class="card-name-dagger">†</span>' : ''}</span>
          \${rol ? \`<div class="text-[11px] text-ink-medium italic truncate">\${esc(rol)}</div>\` : ''}
          \${metaText ? \`<div class="text-[11px] text-ink-dim truncate">\${esc(metaText)}</div>\` : ''}
        </div>
      </div>
      \${desc ? \`<p class="text-xs text-ink-medium line-clamp-3 mb-2 font-crimson leading-relaxed">\${mdToHtml(desc)}</p>\` : ''}
    </div>
    \${flavour ? \`<div class="flavour-preview"><span class="flavour-preview-text">„\${esc(flavour.length > 200 ? flavour.slice(0,200)+'…' : flavour)}"</span></div>\` : ''}
    \${ownerBadge}
  </div>\`;
}

function snapOpenEntity(type, id) {
  const e = (S.entities[type] || []).find(x => x.id === id);
  if (!e) return;

  const schema = SCHEMA[type] || { fields: [] };
  const imgSrc = imgUrl(e.id);

  // Extra images carousel
  let extraImgs = [];
  try { extraImgs = JSON.parse(e.data?.extraImages || '[]'); } catch { }
  const allImgs = extraImgs.length > 0 ? [{ id: e.id, caption: e.data?.imgCaption || '' }, ...extraImgs] : null;

  let body = '';

  // Hero image or carousel
  if (allImgs && allImgs.length > 1) {
    body += buildCarousel('entity-' + id, allImgs);
  } else if (imgSrc) {
    body += \`<div class="detail-hero mb-6" onclick="snapOpenLightbox('\${imgSrc}')">
      <img src="\${imgSrc}" class="detail-hero-img" onerror="this.closest('.detail-hero').style.display='none'">
      <div class="detail-hero-overlay"></div>
      <div class="detail-hero-icon">\${getAutoIcon(type, e)}</div>
    </div>\`;
    if (e.data?.imgCaption) body += \`<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">\${esc(e.data.imgCaption)}</p>\`;
  }

  // Role badge
  if (e.data?.rol) {
    body += \`<div class="text-center mb-4"><span class="detail-role-badge">\${esc(e.data.rol)}</span></div>\`;
  }

  // Meta pills + description
  const pills = [];
  let descVal = '';
  for (const f of schema.fields) {
    if (['flavour','rol'].includes(f.key)) continue;
    const val = e.data?.[f.key];
    if (!val) continue;
    if (f.key === 'desc') { descVal = val; continue; }
    pills.push(\`<span class="detail-meta-pill">\${esc(val)}</span>\`);
  }
  if (pills.length) body += \`<div class="detail-meta-pills">\${pills.join('')}</div>\`;
  if (descVal) body += \`<div class="detail-desc mb-4">\${mdToHtml(descVal)}</div>\`;

  // Flavour scroll
  const flavour = e.data?.flavour;
  if (flavour) {
    body += \`<div class="detail-divider">— ✦ —</div>
    <div class="flavour-scroll">
      <div class="flavour-scroll-rod"></div>
      <div class="flavour-scroll-content"><p class="flavour-text">„\${esc(flavour)}"</p></div>
      <div class="flavour-scroll-rod"></div>
    </div>\`;
  }

  // Secret (if revealed)
  if (e.data?.geheim && e._secretReveal) {
    body += \`<div class="mb-4">
      <div class="detail-field-label detail-field-label--secret">🔑 Geheim</div>
      <div class="detail-dm-block detail-dm-block--secret">\${mdToHtml(e.data.geheim)}</div>
    </div>\`;
  }

  // Links
  const LINK_LABELS = { personages:'Personages', locaties:'Locaties', organisaties:'Organisaties', voorwerpen:'Voorwerpen' };
  const LINK_ICONS  = { personages:'👤', locaties:'🏰', organisaties:'🏛️', voorwerpen:'⚔️' };
  let linksHtml = '';
  for (const [lt, names] of Object.entries(e.links || {})) {
    if (!Array.isArray(names) || !names.length) continue;
    if (lt === 'archief') continue;
    const chips = names.map(n => {
      const target = (S.entities[lt] || []).find(x => x.name === n);
      const clickable = target && target._visibility !== 'vague';
      return clickable
        ? \`<span class="chip chip-\${lt.slice(0,-2)}" onclick="snapOpenEntity('\${lt}','\${esc(target.id)}')">\${LINK_ICONS[lt] || ''} \${esc(n)}</span>\`
        : \`<span class="chip">\${LINK_ICONS[lt] || ''} \${esc(n)}</span>\`;
    }).join('');
    linksHtml += \`<div class="mb-2">
      <div class="detail-field-label">\${LINK_LABELS[lt] || lt}</div>
      <div class="flex flex-wrap gap-1">\${chips}</div>
    </div>\`;
  }
  if (linksHtml) body += \`<div class="detail-divider"></div><div class="mb-4">\${linksHtml}</div>\`;

  // Ownership (voorwerpen)
  if (type === 'voorwerpen') {
    const owner = S.ownership.owners[e.id];
    if (owner) {
      body += \`<div class="mt-3 px-4 py-2 bg-gold/10 border border-gold/30 rounded text-sm text-gold font-crimson">
        🎒 In bezit van <strong>\${esc(owner.playerName)}</strong>
      </div>\`;
    }
  }

  const accentClass = TYPE_META[type]?.accent || 'bar-personages';
  const subtitle    = [e.data?.rol, e.data?.locType, e.data?.orgType, e.data?.itemType].filter(Boolean).join(' · ');
  snapOpenModal(e.name, subtitle, body, accentClass);
}

// ════════════════════════════════════════════════════════════════════════════
//  CAROUSEL (images)
// ════════════════════════════════════════════════════════════════════════════

const _carPos = {};
const _carLen = {};

function buildCarousel(key, items) {
  if (!items || !items.length) return '';
  _carPos[key] = 0;
  _carLen[key] = items.length;
  if (items.length === 1) {
    const src = imgUrl(items[0].id);
    return \`<div class="detail-hero mb-6" onclick="snapOpenLightbox('\${src}')">
      <img src="\${src}" class="detail-hero-img" onerror="this.closest('.detail-hero').style.display='none'">
      <div class="detail-hero-overlay"></div>
    </div>
    \${items[0].caption ? \`<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">\${esc(items[0].caption)}</p>\` : ''}\`;
  }
  return \`<div class="mb-4">
    <div class="relative">
      <div class="overflow-hidden rounded">
        <div id="ct-\${key}" class="flex" style="transition:transform 0.3s ease">
          \${items.map(img => {
            const src = imgUrl(img.id);
            return \`<div class="flex-shrink-0 w-full flex justify-center bg-room-elevated/30">
              <img src="\${src}" class="max-h-[32rem] w-full object-contain cursor-pointer"
                onclick="snapOpenLightbox('\${src}')">
            </div>\`;
          }).join('')}
        </div>
      </div>
      <button onclick="carStep('\${key}',-1)" class="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition">‹</button>
      <button onclick="carStep('\${key}',1)"  class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition">›</button>
    </div>
    <div class="flex justify-center gap-1.5 mt-2">
      \${items.map((_,i) => \`<span id="cd-\${key}-\${i}" onclick="carGo('\${key}',\${i})"
        class="block w-2 h-2 rounded-full cursor-pointer transition \${i===0?'bg-gold':'bg-room-border'}"></span>\`).join('')}
    </div>
    <div id="cc-\${key}" class="text-center text-xs text-ink-dim font-crimson mt-1.5 italic min-h-[1.2em]">\${esc(items[0].caption||'')}</div>
  </div>\`;
}

function carStep(key, dir) {
  const total = _carLen[key] || 1;
  carGo(key, ((_carPos[key] || 0) + dir + total) % total);
}
function carGo(key, idx) {
  _carPos[key] = idx;
  const track = document.getElementById('ct-' + key);
  if (track) track.style.transform = \`translateX(-\${idx * 100}%)\`;
  const total = _carLen[key] || 1;
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(\`cd-\${key}-\${i}\`);
    if (dot) dot.className = \`block w-2 h-2 rounded-full cursor-pointer transition \${i===idx?'bg-gold':'bg-room-border'}\`;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  DOCUMENTEN
// ════════════════════════════════════════════════════════════════════════════

let _docSearch = '';

function renderDocumenten() {
  const container = document.getElementById('sec-documenten');
  container.innerHTML = \`
    <div class="section-banner">
      <div class="section-banner-title"><span>📜</span><span>Documenten</span>
        <span class="font-fell font-normal normal-case tracking-normal text-ink-faint text-xs italic ml-1">Brieven, kranten, kaarten en manuscripten</span>
      </div>
      <div class="section-banner-line"></div>
    </div>
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">⌕</span>
        <input id="doc-search" type="text" placeholder="Zoek document…"
          class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          oninput="snapDocSearch(this.value)">
      </div>
      <span id="doc-count" class="text-ink-faint text-xs font-mono"></span>
    </div>
    <div id="doc-grid" class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"></div>
    </div>
  \`;
  refreshDocGrid();
}

function filterDocs() {
  const q = _docSearch.toLowerCase();
  return (S.documents || [])
    .filter(d => !q || [d.name, d.type, d.desc].join(' ').toLowerCase().includes(q))
    .sort((a,b) => sortKey(a.name).localeCompare(sortKey(b.name), 'nl', {sensitivity:'base'}));
}

function refreshDocGrid() {
  const docs = filterDocs();
  const wrap = document.querySelector('#doc-grid > div');
  const count = document.getElementById('doc-count');
  if (count) count.textContent = docs.length + ' resultaten';
  if (!wrap) return;
  wrap.innerHTML = docs.length === 0
    ? \`<div class="col-span-full text-center py-20 text-ink-faint">
        <div class="text-5xl mb-4 opacity-40">📜</div>
        <div class="font-cinzel text-sm font-semibold text-ink-dim">Geen documenten gevonden</div>
       </div>\`
    : docs.map(d => renderDocCard(d)).join('');
}

function snapDocSearch(q) { _docSearch = q; refreshDocGrid(); }

function renderDocCard(d) {
  const imgSrc = imgUrl(d.id);
  const isBlurred = d.state === 'blurred';
  return \`<div class="entity-card" onclick="snapOpenDoc('\${esc(d.id)}')">
    <div class="card-accent bar-documenten"></div>
    \${imgSrc ? \`<img class="card-img w-full object-cover\${isBlurred?' blur-sm':''}" src="\${imgSrc}"
      onerror="this.style.display='none';this.closest('.entity-card').classList.add('no-img')">\` : ''}
    <div class="card-body px-4 pt-3 pb-3">
      <div class="flex items-start gap-2.5 mb-2">
        <div class="card-icon">\${esc(d.icon || '📜')}</div>
        <div class="min-w-0 flex-1">
          <span class="card-name block">\${esc(d.name)}</span>
          <div class="text-[11px] text-ink-dim truncate">\${esc(d.type || '')}</div>
        </div>
      </div>
      \${d.desc && !isBlurred ? \`<p class="text-xs text-ink-medium line-clamp-3 font-crimson leading-relaxed">\${esc(d.desc)}</p>\` : ''}
      \${isBlurred ? \`<p class="text-xs text-ink-faint italic font-fell">— inhoud verborgen —</p>\` : ''}
    </div>
  </div>\`;
}

function snapOpenDoc(id) {
  const d = (S.documents || []).find(x => x.id === id);
  if (!d) return;
  const isBlurred = d.state === 'blurred';
  const imgSrc = imgUrl(d.id);
  const tekst  = S.tekstContent?.[id] || '';

  let body = '<div class="doc-viewer-wrap">';

  if (isBlurred) {
    body += \`<div class="text-center py-8 text-ink-faint font-fell italic text-sm">— De inhoud van dit document is nog verborgen —</div>\`;
  } else {
    // Image
    if (imgSrc) {
      const isPdf = imgSrc.startsWith('data:application/pdf');
      if (isPdf) {
        body += \`<iframe src="\${imgSrc}" style="width:100%;height:60vh;border:none;border-radius:4px"></iframe>\`;
      } else {
        body += \`<img src="\${imgSrc}" class="doc-viewer-img" onclick="snapOpenLightbox('\${imgSrc}')" onerror="this.style.display='none'">\`;
      }
    }
    // Text content
    if (tekst) {
      body += \`<div class="doc-viewer-text">\${mdToHtml(tekst)}</div>\`;
    } else if (d.desc) {
      body += \`<div class="doc-viewer-text">\${mdToHtml(d.desc)}</div>\`;
    }
  }

  // Linked entities
  const links = [
    ...(d.npcs || []).map(n => ({lt:'personages', name:n})),
    ...(d.locs || []).map(n => ({lt:'locaties',   name:n})),
    ...(d.orgs || []).map(n => ({lt:'organisaties',name:n})),
    ...(d.items|| []).map(n => ({lt:'voorwerpen',  name:n})),
  ];
  if (links.length && !isBlurred) {
    const chips = links.map(({lt, name}) => {
      const target = (S.entities[lt] || []).find(x => x.name === name);
      return target && target._visibility !== 'vague'
        ? \`<span class="chip" onclick="snapCloseModal();setTimeout(()=>snapOpenEntity('\${lt}','\${esc(target.id)}'),50)">\${name}</span>\`
        : \`<span class="chip">\${esc(name)}</span>\`;
    }).join('');
    body += \`<div class="mt-4"><div class="detail-field-label">Betrokkenen</div><div class="flex flex-wrap gap-1">\${chips}</div></div>\`;
  }

  body += '</div>';
  snapOpenModal(d.name, d.type || '', body, 'bar-documenten');
}

// ════════════════════════════════════════════════════════════════════════════
//  KAART
// ════════════════════════════════════════════════════════════════════════════

let _mapIdx  = 0;
let _zoom    = 1.0;
let _panX    = 0;
let _panY    = 0;

function renderKaart() {
  const container = document.getElementById('sec-kaart');
  const maps = S.maps || [];
  if (!maps.length) {
    container.innerHTML = '<div class="text-center py-20 text-ink-faint font-fell italic">Geen kaarten beschikbaar</div>';
    return;
  }

  container.innerHTML = \`
    <div class="section-banner">
      <div class="section-banner-title"><span>🗺️</span><span>Kaarten</span></div>
      <div class="section-banner-line"></div>
    </div>
    <div class="flex-1 min-h-0 overflow-auto bg-room-bg flex flex-col items-center py-6 px-4" id="map-scroll">
      <div class="flex items-center gap-3 mb-4 flex-wrap justify-center">
        <button id="map-prev" class="map-nav-btn" \${maps.length <= 1 ? 'disabled' : ''} onclick="mapNav(-1)">◀</button>
        <span id="map-title" class="font-cinzel font-bold text-gold text-lg tracking-widest min-w-[120px] text-center"></span>
        <button id="map-next" class="map-nav-btn" \${maps.length <= 1 ? 'disabled' : ''} onclick="mapNav(1)">▶</button>
        <div class="w-px h-5 bg-room-border mx-1"></div>
        <button class="map-nav-btn" onclick="mapZoom(-1)">−</button>
        <span id="map-zoom-label" class="text-xs font-mono text-ink-dim w-10 text-center">100%</span>
        <button class="map-nav-btn" onclick="mapZoom(1)">+</button>
        <button class="map-nav-btn text-[11px] px-2 w-auto rounded-md" onclick="mapFit()">⊡</button>
      </div>
      <div id="map-area" class="flex flex-col items-center w-full shrink-0 overflow-hidden"></div>
    </div>
  \`;

  renderMapContent();
}

function renderMapContent() {
  const maps = S.maps || [];
  if (!_mapIdx && _mapIdx !== 0) _mapIdx = 0;
  const map  = maps[_mapIdx];
  if (!map) return;

  const titleEl = document.getElementById('map-title');
  if (titleEl) titleEl.textContent = map.label;

  const area = document.getElementById('map-area');
  if (!area) return;

  const src = S.files[map.id] || map.src || '';
  area.innerHTML = \`<div class="relative inline-block map-frame" id="map-wrapper" style="cursor:grab">
    <img id="map-img" src="\${src}" class="block select-none" draggable="false" onerror="this.style.opacity='0.2'">
    <div id="map-pins-layer" class="absolute inset-0 pointer-events-none"></div>
  </div>\`;

  const img = document.getElementById('map-img');
  const fit = () => {
    const scroll = document.getElementById('map-scroll');
    const avail  = scroll ? scroll.clientWidth - 48 : window.innerWidth;
    _zoom = Math.min(1, avail / (img.naturalWidth || 800));
    applyZoom();
  };
  if (img.complete && img.naturalWidth) fit();
  else img.addEventListener('load', fit, { once: true });

  // Wheel zoom
  const wrapper = document.getElementById('map-wrapper');
  wrapper?.addEventListener('wheel', ev => {
    ev.preventDefault();
    _zoom = Math.max(0.2, Math.min(5, _zoom + (ev.deltaY < 0 ? 0.15 : -0.15)));
    applyZoom();
  }, { passive: false });

  // Pan
  let panning = false, moved = false, sx, sy, spx, spy;
  wrapper?.addEventListener('mousedown', ev => {
    if (ev.target.closest('.map-pin')) return;
    panning = true; moved = false;
    sx = ev.clientX; sy = ev.clientY; spx = _panX; spy = _panY;
    wrapper.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', ev => {
    if (!panning) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    _panX = spx + dx; _panY = spy + dy;
    wrapper.style.transform = \`translate(\${_panX}px,\${_panY}px)\`;
  });
  document.addEventListener('mouseup', () => { panning = false; if (wrapper) wrapper.style.cursor = 'grab'; });

  // Touch pan
  let tx, ty, tpx, tpy;
  wrapper?.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1) return;
    tx = ev.touches[0].clientX; ty = ev.touches[0].clientY; tpx = _panX; tpy = _panY;
  }, { passive: true });
  wrapper?.addEventListener('touchmove', ev => {
    if (ev.touches.length !== 1) return;
    ev.preventDefault();
    _panX = tpx + ev.touches[0].clientX - tx;
    _panY = tpy + ev.touches[0].clientY - ty;
    wrapper.style.transform = \`translate(\${_panX}px,\${_panY}px)\`;
  }, { passive: false });

  renderPins();
}

function applyZoom() {
  const img = document.getElementById('map-img');
  const wrapper = document.getElementById('map-wrapper');
  const label   = document.getElementById('map-zoom-label');
  if (!img?.naturalWidth) return;
  const w = Math.round(img.naturalWidth * _zoom);
  img.style.width = w + 'px'; img.style.height = 'auto';
  if (wrapper) wrapper.style.width = w + 'px';
  if (label) label.textContent = Math.round(_zoom * 100) + '%';
}

function mapZoom(dir) {
  _zoom = Math.max(0.2, Math.min(5, _zoom + dir * 0.15));
  applyZoom();
}

function mapFit() {
  const img = document.getElementById('map-img');
  const scroll = document.getElementById('map-scroll');
  if (!img?.naturalWidth) return;
  _zoom = Math.min(1, (scroll.clientWidth - 48) / img.naturalWidth);
  _panX = 0; _panY = 0;
  applyZoom();
  const wrapper = document.getElementById('map-wrapper');
  if (wrapper) wrapper.style.transform = 'translate(0,0)';
}

function mapNav(dir) {
  const maps = S.maps || [];
  _mapIdx = (_mapIdx + dir + maps.length) % maps.length;
  _panX = 0; _panY = 0; _zoom = 1;
  renderMapContent();
}

function renderPins() {
  const layer = document.getElementById('map-pins-layer');
  if (!layer) return;
  const map   = (S.maps || [])[_mapIdx];
  const pins  = map ? (S.mapPins?.[map.id] || []) : [];

  layer.innerHTML = pins.map(pin => {
    const isVague = pin.visibility === 'vague';
    const label   = isVague ? '?' : esc(pin.locName || '');
    const icon    = isVague ? '?' : (() => {
      const loc = (S.entities.locaties || []).find(l => l.id === pin.locId);
      return loc?.data?.icon || '🏰';
    })();
    return \`<div class="map-pin\${isVague?' map-pin-vague':''}"
      style="left:\${pin.x}%;top:\${pin.y}%;pointer-events:auto"
      data-loc-id="\${pin.locId}" onclick="mapPinClick('\${pin.locId}','\${isVague}')">
      <div class="pin-icon">\${icon}</div>
      <div class="pin-needle"></div>
      <div class="pin-label">\${label}</div>
    </div>\`;
  }).join('');
}

function mapPinClick(locId, isVague) {
  if (isVague === 'true') return;
  snapOpenEntity('locaties', locId);
}

// ════════════════════════════════════════════════════════════════════════════
//  LOGBOEK
// ════════════════════════════════════════════════════════════════════════════

function renderLogboek() {
  const container = document.getElementById('sec-logboek');
  const hk = S.meta?.hoofdstukken || {};
  const entries = S.sessieLog || [];

  const groups = {};
  for (const e of entries) {
    const ch = e.hoofdstuk || '_';
    if (!groups[ch]) groups[ch] = [];
    groups[ch].push(e);
  }
  const sortedChapters = Object.keys(groups).sort((a, b) =>
    (hk[a]?.num || 99) - (hk[b]?.num || 99));

  let html = '';
  if (!entries.length) {
    html = \`<div class="text-center py-20 text-ink-faint">
      <div class="text-5xl mb-4 opacity-40">📖</div>
      <div class="font-cinzel text-sm font-semibold text-ink-dim">Het logboek is nog leeg</div>
    </div>\`;
  } else {
    for (const ch of sortedChapters) {
      const info = hk[ch] || { title: ch, dag: '', num: '?' };
      const chEntries = groups[ch].slice().sort((a,b) => (a.datum||'').localeCompare(b.datum||''));
      html += \`<div class="mb-12">
        <div class="flex items-baseline gap-3 mb-5 pb-2.5 border-b-2 border-room-border">
          <div class="font-cinzel font-bold text-gold text-xl">Hoofdstuk \${info.num}:</div>
          <div class="font-cinzel font-semibold text-ink-bright text-lg">\${esc(info.title)}</div>
          \${info.dag ? \`<div class="text-ink-faint text-xs font-mono ml-auto">\${esc(info.dag)}</div>\` : ''}
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          \${chEntries.map(e => renderSessieCard(e)).join('')}
        </div>
      </div>\`;
    }
  }

  container.innerHTML = \`
    <div class="section-banner">
      <div class="section-banner-title"><span>📖</span><span>Logboek</span>
        <span class="font-fell font-normal normal-case tracking-normal text-ink-faint text-xs italic ml-1">Verslagen van sessies en avonturen</span>
      </div>
      <div class="section-banner-line"></div>
    </div>
    <div class="flex-1 overflow-y-auto p-6">\${html}</div>
  \`;
}

function renderSessieCard(e) {
  const firstImg = e.images?.[0];
  const firstSrc = firstImg ? imgUrl(typeof firstImg === 'string' ? firstImg : firstImg.id) : null;
  return \`<div class="entity-card" onclick="snapOpenSessie('\${esc(e.id)}')">
    <div class="card-accent bar-logboek"></div>
    \${firstSrc ? \`<img class="card-img w-full object-cover" src="\${firstSrc}" onerror="this.style.display='none'">\` : ''}
    <div class="px-4 pt-3 pb-4">
      \${e.datum ? \`<div class="text-[11px] font-mono text-ink-faint mb-1">\${esc(e.datum)}</div>\` : ''}
      \${e.korteSamenvatting
        ? \`<div class="font-cinzel font-semibold text-ink-bright text-sm leading-snug mb-1">\${esc(e.korteSamenvatting)}</div>\`
        : \`<div class="text-ink-dim text-xs italic">Geen titel</div>\`}
      \${e.samenvatting ? \`<p class="text-[11px] text-ink-dim font-fell italic line-clamp-2 leading-snug">
        \${esc(e.samenvatting.replace(/^#+\\s*/gm,'').replace(/\\*\\*/g,'').replace(/\\*/g,'').replace(/\\n/g,' ').slice(0,110))}</p>\` : ''}
    </div>
  </div>\`;
}

function snapOpenSessie(id) {
  const e = (S.sessieLog || []).find(s => s.id === id);
  if (!e) return;
  const hk = S.meta?.hoofdstukken || {};
  const chapter = hk[e.hoofdstuk] || {};

  const images = (e.images || []).map(i => ({
    id: typeof i === 'string' ? i : i.id,
    caption: typeof i === 'string' ? '' : (i.caption || ''),
  }));

  let body = '';
  body += buildCarousel('log-' + id, images);

  if (e.datum || chapter.short) {
    const parts = [chapter.short, e.datum].filter(Boolean);
    body += \`<div class="log-dateline">\${parts.map(p => esc(p)).join(' — ')}</div>\`;
  }
  if (e.samenvatting) body += \`<div class="log-entry">\${mdToHtml(e.samenvatting)}</div>\`;

  // Chips
  const chipSections = [
    { label:'👤 Personages', items:[...(e.nieuwPersonages||[]).map(n=>\`<span class="log-chip log-chip-gold">✨ \${esc(n)}</span>\`), ...(e.terugkerendPersonages||[]).map(n=>\`<span class="log-chip log-chip-blue">↩ \${esc(n)}</span>\`)] },
    { label:'🏰 Locaties',   items:[...(e.nieuwLocaties||[]).map(n=>\`<span class="log-chip log-chip-green-new">✨ \${esc(n)}</span>\`), ...(e.terugkerendLocaties||[]).map(n=>\`<span class="log-chip log-chip-green">↩ \${esc(n)}</span>\`)] },
    { label:'🏛️ Organisaties',items:(e.organisaties||[]).map(n=>\`<span class="log-chip log-chip-seal">\${esc(n)}</span>\`) },
    { label:'⚔️ Voorwerpen', items:(e.voorwerpen||[]).map(n=>\`<span class="log-chip log-chip-orange">\${esc(n)}</span>\`) },
  ].filter(s => s.items.length);

  if (chipSections.length) {
    body += '<div class="log-chips-wrap">' + chipSections.map(s =>
      \`<div class="log-chip-section"><div class="log-chip-section-label">\${s.label}</div>
       <div class="flex flex-wrap gap-1.5">\${s.items.join('')}</div></div>\`
    ).join('') + '</div>';
  }

  const subtitle = [chapter.short, e.datum].filter(Boolean).join(' · ');
  snapOpenModal(e.korteSamenvatting || 'Sessie', subtitle, body, 'bar-logboek');
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDERERS MAP + INIT
// ════════════════════════════════════════════════════════════════════════════

const RENDERERS = {
  personages:   () => renderEntitySection('personages'),
  locaties:     () => renderEntitySection('locaties'),
  organisaties: () => renderEntitySection('organisaties'),
  voorwerpen:   () => renderEntitySection('voorwerpen'),
  documenten:   () => renderDocumenten(),
  kaart:        () => renderKaart(),
  logboek:      () => renderLogboek(),
};

// Init — render the default section
snapSwitch('personages');
</script>
</body>
</html>`;
}

// Small server-side esc helper for HTML generation
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { buildSnapshot };
