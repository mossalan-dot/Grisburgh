/**
 * render-dungeon.js — Dungeon map fog-of-war systeem
 *
 * Features:
 *   • Fog-of-war per kamer (onthullen per party)
 *   • Verbindingslijnen tussen kamers (vervangt ingangspijlen)
 *   • Conditie-iconen per kamer (☠️ 💰 🔒 ✓) — DM beheert zichtbaarheid
 *   • Zijbalk: alfabetische kamerlijst, snel onthullen, klik → inzoomen
 *   • Onthul-teller in topbar
 *   • Party-toegang (3-state: Geen / Actief / Uitgespeeld)
 */

import { api } from './api.js?v=234';

const icon = (...a) => window.icon(...a);

const isDM  = () => window.app?.isDM?.();
const esc   = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid   = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

const COND_TYPES = [
  { id: 'enemies',  icon: '☠️', svgName: 'skull',    label: 'Vijanden'    },
  { id: 'loot',     icon: '💰', svgName: 'coins',    label: 'Buit'        },
  { id: 'locked',   icon: '🔒', svgName: 'lock',     label: 'Vergrendeld' },
  { id: 'cleared',  icon: '✓',  svgName: 'check',    label: 'Uitgewist'   },
];

// ── State ──
let _maps        = [];      // alle dungeon maps (gefilterd voor speler)
let _mapIdx      = 0;       // huidig gekozen map
let _tool        = 'select';// 'select' | 'rect' | 'poly' | 'conn'
let _drawing     = null;    // lopende tekenoperatie
let _selectedRoom= null;    // geselecteerde kamer-id (DM)
let _connStart   = null;    // roomId: eerste kamer van verbindingstool
let _zoom        = 1.0;
let _panX        = 0;
let _panY        = 0;
let _panAbort    = null;

// ──────────────────────────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────────────────────────
export async function renderDungeon(container, openId) {
  _maps = await api.listDungeons();
  if (openId) {
    const i = _maps.findIndex(m => m.id === openId);
    if (i >= 0) _mapIdx = i;
  }
  if (_mapIdx >= _maps.length) _mapIdx = 0;

  container.innerHTML = _buildShell();
  _attachShellEvents();
  if (_maps.length) _renderMapView();
  else              _renderEmpty();
}

// ──────────────────────────────────────────────────────────────────
// Shell HTML
// ──────────────────────────────────────────────────────────────────
function _buildShell() {
  const mapOpts = _maps.map((m, i) =>
    `<option value="${i}" ${i===_mapIdx?'selected':''}>${esc(m.name)}</option>`
  ).join('');

  return `
    <div class="dng-shell">
      <div class="dng-topbar">
        <div class="dng-topbar-left">
          ${_maps.length ? `
            <select class="dng-map-select" id="dng-map-select">${mapOpts}</select>
          ` : '<span class="dng-map-select-empty">Geen dungeon maps</span>'}
          ${isDM() ? `
            <button class="dng-btn dng-btn-sm" id="dng-new-btn">+ Nieuw</button>
            ${_maps.length ? `<button class="dng-btn dng-btn-sm dng-btn-danger" id="dng-delete-btn">${icon('x')}</button>` : ''}
          ` : ''}
          ${isDM() && _maps.length ? `
            <span class="dng-reveal-chip" id="dng-reveal-count"></span>
          ` : ''}
        </div>
        ${isDM() && _maps.length ? `
        <div class="dng-tools" id="dng-tools">
          <button class="dng-tool-btn active" data-tool="select" title="Selecteren">${icon('mouse-pointer-2')}</button>
          <button class="dng-tool-btn" data-tool="rect"   title="Rechthoek tekenen">${icon('square')}</button>
          <button class="dng-tool-btn" data-tool="poly"   title="Polygoon tekenen">${icon('hexagon')}</button>
          <button class="dng-tool-btn" data-tool="conn"   title="Verbinding tekenen">${icon('link')}</button>
          <span class="dng-tool-hint" id="dng-tool-hint"></span>
          <div class="dng-tool-sep"></div>
          <button class="dng-btn dng-btn-sm" id="dng-party-btn">Party-toegang</button>
        </div>
        ` : ''}
      </div>
      <div class="dng-workspace" id="dng-workspace">
        <div class="dng-map-area" id="dng-map-area"></div>
        ${isDM() && _maps.length ? `
        <div class="dng-sidebar" id="dng-sidebar">
          <div class="dng-sidebar-detail" id="dng-sidebar-detail"></div>
          <div class="dng-sb-list-section">
            <div class="dng-sb-list-hdr">
              <span class="dng-sb-list-title">Kamers</span>
              <span class="dng-sb-list-count" id="dng-sb-count"></span>
            </div>
            <div class="dng-sb-list" id="dng-sb-list"></div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
}

// ──────────────────────────────────────────────────────────────────
// Shell events (topbar)
// ──────────────────────────────────────────────────────────────────
function _attachShellEvents() {
  document.getElementById('dng-map-select')?.addEventListener('change', e => {
    _mapIdx = +e.target.value;
    _zoom = 1; _panX = 0; _panY = 0;
    _renderMapView();
  });

  document.getElementById('dng-new-btn')?.addEventListener('click', _openNewDungeonDialog);
  document.getElementById('dng-delete-btn')?.addEventListener('click', _deleteCurrentMap);
  document.getElementById('dng-party-btn')?.addEventListener('click', _openPartyAccessDialog);

  document.getElementById('dng-tools')?.querySelectorAll('.dng-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _tool = btn.dataset.tool;
      document.querySelectorAll('.dng-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _cancelDrawing();
      _connStart = null; // reset verbindingstool bij toolwissel
      _updateCursor();
      _updateConnHint();
      _renderSvg();
    });
  });
}

// ──────────────────────────────────────────────────────────────────
// Map view
// ──────────────────────────────────────────────────────────────────
function _renderMapView() {
  const area = document.getElementById('dng-map-area');
  if (!area) return;
  if (!_maps.length) { area.innerHTML = ''; _renderEmpty(); return; }

  const map = _maps[_mapIdx];
  area.innerHTML = `
    <div class="dng-img-wrap" id="dng-img-wrap">
      <img id="dng-img" src="${esc(api.fileUrl(map.fileId))}"
        draggable="false" class="dng-img" onerror="this.style.opacity='0.2'">
      <svg id="dng-svg" class="dng-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>`;

  const img = document.getElementById('dng-img');
  const onLoad = () => { _fitZoom(); _renderSvg(); _attachMapEvents(); _renderRoomList(); };
  if (img.complete && img.naturalWidth) onLoad();
  else img.addEventListener('load', onLoad, { once: true });
}

function _fitZoom() {
  const img  = document.getElementById('dng-img');
  const area = document.getElementById('dng-map-area');
  if (!img?.naturalWidth || !area) return;
  _zoom = Math.min(1, (area.clientWidth - 24) / img.naturalWidth,
                      (area.clientHeight - 24) / img.naturalHeight);
  _applyTransform();
}

function _applyTransform() {
  const wrap = document.getElementById('dng-img-wrap');
  if (wrap) wrap.style.transform =
    `translate(calc(-50% + ${_panX}px), calc(-50% + ${_panY}px)) scale(${_zoom})`;
}

// ──────────────────────────────────────────────────────────────────
// SVG overlay — kamers, mist, verbindingen, conditie-iconen
// ──────────────────────────────────────────────────────────────────
function _renderSvg() {
  const svg = document.getElementById('dng-svg');
  const img = document.getElementById('dng-img');
  if (!svg || !img?.naturalWidth) return;

  const W = img.naturalWidth;
  const H = img.naturalHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);

  const map         = _maps[_mapIdx];
  const rooms       = map.rooms       || [];
  const connections = map.connections || [];
  const groupId     = _activeGroupId();
  const revealed    = new Set(map.reveals?.[groupId] || []);

  // ── Fog-of-war mask ──
  // Alles buiten kamers is altijd zichtbaar (tuin, paden, etc.).
  // Kamers beginnen bedekt; onthullen maakt ze zichtbaar.
  // Masker: zwart = fog weg (kaart zichtbaar), wit = fog aanwezig (bedekt).
  //   • Base rect zwart  → kaart overal zichtbaar
  //   • Alle kamers wit  → fog op kamergebieden
  //   • Onthulde kamers zwart → fog weg in onthuld gebied
  const isCompleted = !isDM() && (map.partyCompleted || []).includes(groupId);
  const hasFog      = !isCompleted && (isDM() || rooms.length > 0);
  const fogAlpha    = isDM() ? 0.40 : 1.0;

  const allRoomsMaskSvg = rooms
    .map(r => _roomToSvgShape(r, W, H, '', '', false, 'white'))
    .join('');
  const revealedMaskSvg = rooms
    .filter(r => revealed.has(r.id))
    .map(r => _roomToSvgShape(r, W, H, '', '', false, 'black'))
    .join('');

  // ── DM: klik-omtreklijn op ALLE kamers ──
  const allRoomsSvg = isDM() ? rooms.map(r => {
    const isRevealed = revealed.has(r.id);
    const isSel      = r.id === _selectedRoom;
    const isConnSt   = r.id === _connStart;
    const cls = [
      'dng-room',
      isRevealed ? 'dng-room-revealed' : '',
      isSel      ? 'dng-room-selected' : '',
      isConnSt   ? 'dng-conn-start'    : '',
    ].filter(Boolean).join(' ');
    return _roomToSvgShape(r, W, H, cls, `onclick="window._dngClickRoom('${r.id}')"`, true);
  }).join('') : '';

  // ── Speler: kameromtrek zichtbaar zodra onthuld (klikbaar voor naam-tooltip) ──
  const playerRoomsSvg = !isDM() ? rooms
    .filter(r => revealed.has(r.id))
    .map(r => _roomToSvgShape(r, W, H, 'dng-room dng-room-revealed', `onclick="window._dngPlayerClickRoom('${r.id}')"`, true))
    .join('') : '';

  // ── Verbindingslijnen: DM ziet alles; speler ziet als ≥1 kamer onthuld ──
  const connSvg = connections.filter(c => {
    if (isDM()) return true;
    return revealed.has(c.fromId) || revealed.has(c.toId);
  }).map(c => {
    const from = rooms.find(r => r.id === c.fromId);
    const to   = rooms.find(r => r.id === c.toId);
    if (!from || !to) return '';
    const [x1, y1] = _roomCentroid(from, W, H);
    const [x2, y2] = _roomCentroid(to, W, H);
    const sw = Math.max(W, H) * 0.004;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      class="dng-conn-line" stroke-width="${sw}"/>`;
  }).join('');

  // ── Kamernamen (alleen DM; spelers zien naam via klik-tooltip) ──
  const namesSvg = isDM() ? rooms.filter(r => revealed.has(r.id)).map(r => {
    const [cx, cy] = _roomCentroid(r, W, H);
    const hasConds  = (r.conditions || []).some(c => isDM() || c.visible);
    const labelY    = hasConds ? cy - Math.max(W, H) * 0.014 : cy;
    return `<text class="dng-room-label" x="${cx}" y="${labelY}"
      text-anchor="middle" dominant-baseline="middle">${esc(r.name)}</text>`;
  }).join('') : '';

  // ── Conditie-iconen: DM ziet alles (verborgen = half-transparant);
  //    spelers zien alleen zichtbare iconen van onthulde kamers ──
  const condSvg = rooms.filter(r => isDM() || revealed.has(r.id)).map(r => {
    const conds = (r.conditions || []).filter(c => isDM() || c.visible);
    if (!conds.length) return '';
    const [cx, cy] = _roomCentroid(r, W, H);
    const size     = Math.max(W, H) * 0.030;
    const step     = size * 1.3;
    const startX   = cx - (conds.length - 1) * step / 2;
    const iconY    = cy + Math.max(W, H) * 0.020;
    return conds.map((c, i) => {
      const ct  = COND_TYPES.find(t => t.id === c.type);
      const cls = `dng-cond-icon${(!c.visible && isDM()) ? ' dng-cond-icon--hidden' : ''}`;
      return `<text x="${startX + i * step}" y="${iconY}"
        class="${cls}" font-size="${size}"
        text-anchor="middle" dominant-baseline="middle">${ct?.icon || '?'}</text>`;
    }).join('');
  }).join('');

  // ── Transparante kameroverlays in tekenmodus (DM) ──
  const drawOverlaySvg = (isDM() && _tool !== 'select') ? rooms.map(r =>
    _roomToSvgShape(r, W, H, 'dng-room-draw-overlay', '', false, null)
  ).join('') : '';

  svg.innerHTML = `
    <defs>
      <mask id="dng-fog-mask">
        <!-- Zwart = fog weg (zichtbaar); Wit = fog aanwezig (bedekt) -->
        <rect width="${W}" height="${H}" fill="black"/>
        ${allRoomsMaskSvg}
        ${revealedMaskSvg}
      </mask>
    </defs>

    <!-- Fog overlay -->
    ${hasFog ? `<rect width="${W}" height="${H}" fill="black" opacity="${fogAlpha}"
      mask="url(#dng-fog-mask)" pointer-events="none"/>` : ''}

    <!-- Verbindingslijnen (onder kamers) -->
    ${connSvg}

    <!-- Transparante overlays in tekenmodus -->
    ${drawOverlaySvg}

    <!-- Kameromtrekken -->
    ${allRoomsSvg}${playerRoomsSvg}

    <!-- Kamernamen -->
    ${namesSvg}

    <!-- Conditie-iconen -->
    ${condSvg}

    <!-- Tekenlaag (bovenop) -->
    <g id="dng-draw-layer"></g>`;

  _updateRevealCount();
}

function _updateRevealCount() {
  const el = document.getElementById('dng-reveal-count');
  if (!el || !isDM() || !_maps.length) return;
  const map     = _maps[_mapIdx];
  const rooms   = map.rooms || [];
  const groupId = _activeGroupId();
  const revIds  = map.reveals?.[groupId] || [];
  const revCnt  = revIds.filter(id => rooms.some(r => r.id === id)).length;
  el.textContent = rooms.length ? `${revCnt} / ${rooms.length} onthuld` : '';
  el.style.display = rooms.length ? '' : 'none';
}

function _updateConnHint() {
  const hint = document.getElementById('dng-tool-hint');
  if (!hint) return;
  if (_tool === 'conn') {
    hint.textContent = _connStart
      ? 'Klik op een tweede kamer om te verbinden (of opnieuw om te annuleren)'
      : 'Klik op een kamer om te starten';
    hint.style.display = 'inline';
  } else {
    hint.textContent = '';
    hint.style.display = 'none';
  }
}

function _roomToSvgShape(room, W, H, cls, extra='', strokeOnly=false, fillColor=null) {
  const fill  = strokeOnly ? 'transparent' : (fillColor ?? 'black');
  const attrs = `class="${cls}" fill="${fill}" ${extra}`;
  if (room.shape === 'rect' && room.points?.length === 2) {
    const [[x1p,y1p],[x2p,y2p]] = room.points;
    const x = Math.min(x1p,x2p)/100*W, y = Math.min(y1p,y2p)/100*H;
    const w = Math.abs(x2p-x1p)/100*W, h = Math.abs(y2p-y1p)/100*H;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
  }
  if (room.points?.length >= 3) {
    const pts = room.points.map(([px,py]) => `${px/100*W},${py/100*H}`).join(' ');
    return `<polygon points="${pts}" ${attrs}/>`;
  }
  return '';
}

function _roomCentroid(room, W, H) {
  if (!room.points?.length) return [W/2, H/2];
  const xs = room.points.map(p => p[0]/100*W);
  const ys = room.points.map(p => p[1]/100*H);
  return [xs.reduce((a,b)=>a+b,0)/xs.length, ys.reduce((a,b)=>a+b,0)/ys.length];
}

function _activeGroupId() {
  if (isDM()) return window.app?.state?.dmState?.activeGroup || 'groep1';
  const char     = window.app?.state?.characterId;
  const entities = window.app?.state?.entities;
  const p        = (entities?.personages || []).find(e => e.id === char);
  return p?.data?.groep || 'groep1';
}

// ──────────────────────────────────────────────────────────────────
// Map events: pan, zoom, tekenen
// ──────────────────────────────────────────────────────────────────
function _attachMapEvents() {
  if (_panAbort) _panAbort.abort();
  _panAbort = new AbortController();
  const sig  = _panAbort.signal;
  const wrap = document.getElementById('dng-img-wrap');
  if (!wrap) return;

  wrap.addEventListener('wheel', ev => {
    ev.preventDefault();
    const delta = ev.deltaY < 0 ? 0.1 : -0.1;
    _zoom = Math.max(0.15, Math.min(5, _zoom + delta));
    _applyTransform();
  }, { passive: false, signal: sig });

  let panning=false, panMoved=false, startX=0, startY=0, startPanX=0, startPanY=0;

  wrap.addEventListener('mousedown', ev => {
    if (ev.button !== 0) return;
    if (_tool !== 'select') { _handleDrawStart(ev, wrap); return; }
    panning=true; panMoved=false;
    startX=ev.clientX; startY=ev.clientY;
    startPanX=_panX; startPanY=_panY;
    wrap.style.cursor='grabbing';
    ev.preventDefault();
  }, { signal: sig });

  document.addEventListener('mousemove', ev => {
    if (!panning) return;
    const dx=ev.clientX-startX, dy=ev.clientY-startY;
    if (Math.abs(dx)>3||Math.abs(dy)>3) panMoved=true;
    _panX=startPanX+dx; _panY=startPanY+dy;
    _applyTransform();
  }, { signal: sig });

  document.addEventListener('mouseup', () => {
    if (!panning) return;
    panning=false;
    wrap.style.cursor = _toolCursor();
  }, { signal: sig });

  _updateCursor();
}

function _toolCursor() {
  if (_tool === 'conn') return _connStart ? 'pointer' : 'crosshair';
  return { select:'default', rect:'crosshair', poly:'crosshair' }[_tool] || 'default';
}
function _updateCursor() {
  const wrap = document.getElementById('dng-img-wrap');
  if (wrap) wrap.style.cursor = _toolCursor();
}

// ──────────────────────────────────────────────────────────────────
// Teken-logica
// ──────────────────────────────────────────────────────────────────
function _svgPoint(ev, img) {
  const rect = img.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width  * img.naturalWidth);
  const y = ((ev.clientY - rect.top)  / rect.height * img.naturalHeight);
  return [x, y];
}

function _svgToPercent(x, y, img) {
  return [x / img.naturalWidth * 100, y / img.naturalHeight * 100];
}

function _handleDrawStart(ev, wrap) {
  ev.preventDefault();
  const img = document.getElementById('dng-img');
  if (!img) return;
  const [svgX, svgY] = _svgPoint(ev, img);
  const [pctX, pctY] = _svgToPercent(svgX, svgY, img);

  if (_tool === 'conn') {
    // Als je buiten een kamer klikt, reset connStart
    const room = _findRoomAtPoint(_maps[_mapIdx], pctX, pctY);
    if (!room && _connStart) {
      _connStart = null;
      _renderSvg();
      _updateCursor();
      _updateConnHint();
    }
    return; // SVG onclick op de kamer-shapes regelt _dngClickRoom
  }

  if (_tool === 'rect') {
    _drawing = { type:'rect', startPct:[pctX,pctY], endPct:[pctX,pctY] };
    _startRectDrag(img);
    return;
  }

  if (_tool === 'poly') {
    if (!_drawing) {
      _drawing = { type:'poly', points:[[pctX,pctY]] };
      _renderDrawPreview();
    } else {
      _drawing.points.push([pctX,pctY]);
      _renderDrawPreview();
    }
    return;
  }
}

function _startRectDrag(img) {
  const sig = _panAbort?.signal;
  const onMove = ev => {
    if (!_drawing) return;
    const [svgX,svgY] = _svgPoint(ev, img);
    _drawing.endPct = _svgToPercent(svgX, svgY, img);
    _renderDrawPreview();
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (_drawing?.type === 'rect') _finishRect();
  };
  document.addEventListener('mousemove', onMove, { signal: sig });
  document.addEventListener('mouseup', onUp);
}

function _renderDrawPreview() {
  const svg   = document.getElementById('dng-svg');
  const layer = document.getElementById('dng-draw-layer');
  const img   = document.getElementById('dng-img');
  if (!layer || !img) return;
  const W=img.naturalWidth, H=img.naturalHeight;

  if (_drawing?.type==='rect') {
    const [[x1p,y1p],[x2p,y2p]] = [_drawing.startPct, _drawing.endPct];
    const x=Math.min(x1p,x2p)/100*W, y=Math.min(y1p,y2p)/100*H;
    const w=Math.abs(x2p-x1p)/100*W, h=Math.abs(y2p-y1p)/100*H;
    layer.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}"
      class="dng-draw-preview"/>`;
  } else if (_drawing?.type==='poly') {
    const pts = _drawing.points.map(([px,py])=>`${px/100*W},${py/100*H}`).join(' ');
    layer.innerHTML = `
      <polyline points="${pts}" class="dng-draw-preview" fill="none"/>
      ${_drawing.points.map(([px,py])=>`<circle cx="${px/100*W}" cy="${py/100*H}"
        r="${Math.max(W,H)*0.003}" class="dng-draw-vertex"/>`).join('')}
      <text x="${_drawing.points[0][0]/100*W}" y="${_drawing.points[0][1]/100*H - Math.max(W,H)*0.01}"
        class="dng-draw-hint">Dubbelklik om te sluiten</text>`;

    if (!svg._polyDblBound) {
      svg._polyDblBound = true;
      svg.addEventListener('dblclick', _finishPoly, { once:true });
    }
  }
}

function _finishRect() {
  if (!_drawing?.startPct || !_drawing?.endPct) { _cancelDrawing(); return; }
  const pts = [_drawing.startPct, _drawing.endPct];
  _cancelDrawing();
  _openRoomNameDialog({ shape:'rect', points: pts });
}

function _finishPoly() {
  if (!_drawing?.points || _drawing.points.length < 3) { _cancelDrawing(); return; }
  const pts = [..._drawing.points];
  _cancelDrawing();
  _openRoomNameDialog({ shape:'poly', points: pts });
}

function _switchToSelect() {
  _tool = 'select';
  _connStart = null;
  document.querySelectorAll('.dng-tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === 'select'));
  _updateCursor();
  _updateConnHint();
  _renderSvg();
}

function _cancelDrawing() {
  _drawing = null;
  const layer = document.getElementById('dng-draw-layer');
  if (layer) layer.innerHTML = '';
  const svg = document.getElementById('dng-svg');
  if (svg) { svg._polyDblBound = false; }
}

// ──────────────────────────────────────────────────────────────────
// Verbindingstool
// ──────────────────────────────────────────────────────────────────
async function _createConnection(fromId, toId) {
  const map = _maps[_mapIdx];
  if (!map.connections) map.connections = [];

  // Controleer of verbinding al bestaat (bidirectioneel)
  const exists = map.connections.some(c =>
    (c.fromId === fromId && c.toId === toId) ||
    (c.fromId === toId   && c.toId === fromId)
  );
  if (!exists) {
    map.connections.push({ id: uid(), fromId, toId });
    await _saveRooms();
  } else {
    _renderSvg(); // herrender voor highlight-reset
  }
}

// ──────────────────────────────────────────────────────────────────
// Kamer naam/notities dialog
// ──────────────────────────────────────────────────────────────────
function _openRoomNameDialog(shapeData, existingRoom=null) {
  const overlay = _makeOverlay();
  const isEdit  = !!existingRoom;
  overlay.innerHTML = `
    <div class="dng-dialog">
      <h3 class="dng-dialog-title">${isEdit ? 'Kamer bewerken' : 'Nieuwe kamer'}</h3>
      <label class="dng-label">Naam
        <input id="dng-room-name" class="dng-input" placeholder="Bijv. De Crypte"
          value="${esc(existingRoom?.name||'')}">
      </label>
      <label class="dng-label">DM-notities
        <textarea id="dng-room-notes" class="dng-textarea" rows="4"
          placeholder="Alleen zichtbaar voor de DM...">${esc(existingRoom?.dmNotes||'')}</textarea>
      </label>
      <div class="dng-dialog-btns">
        <button class="dng-btn" id="dng-room-ok">${isEdit ? 'Opslaan' : 'Kamer toevoegen'}</button>
        ${isEdit ? `<button class="dng-btn dng-btn-danger" id="dng-room-del">Verwijderen</button>` : ''}
        <button class="dng-btn dng-btn-ghost" id="dng-room-cancel">Annuleren</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  setTimeout(() => document.getElementById('dng-room-name')?.focus(), 50);

  document.getElementById('dng-room-ok').addEventListener('click', async () => {
    const name  = document.getElementById('dng-room-name').value.trim();
    if (!name) { document.getElementById('dng-room-name').focus(); return; }
    const notes = document.getElementById('dng-room-notes').value;
    const map   = _maps[_mapIdx];
    if (isEdit) {
      existingRoom.name    = name;
      existingRoom.dmNotes = notes;
    } else {
      map.rooms = map.rooms || [];
      map.rooms.push({
        id: uid(), name, dmNotes: notes,
        shape: shapeData.shape, points: shapeData.points,
        conditions: [],
      });
    }
    await _saveRooms();
    overlay.remove();
    if (!isEdit) _switchToSelect();
  });

  document.getElementById('dng-room-del')?.addEventListener('click', async () => {
    if (!confirm(`Kamer "${existingRoom.name}" verwijderen?`)) return;
    const map = _maps[_mapIdx];
    map.rooms = map.rooms.filter(r => r.id !== existingRoom.id);
    // Verwijder ook verbindingen met deze kamer
    map.connections = (map.connections || []).filter(c =>
      c.fromId !== existingRoom.id && c.toId !== existingRoom.id
    );
    await _saveRooms();
    _selectedRoom = null;
    overlay.remove();
  });

  document.getElementById('dng-room-cancel').addEventListener('click', () => overlay.remove());
}

// ──────────────────────────────────────────────────────────────────
// Kamer sidebar (DM)
// ──────────────────────────────────────────────────────────────────
window._dngClickRoom = (roomId) => {
  if (!isDM()) return;
  const map  = _maps[_mapIdx];
  const room = (map.rooms || []).find(r => r.id === roomId);
  if (!room) return;

  if (_tool === 'select') {
    _selectedRoom = roomId;
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
    _scrollToSelected();
  } else if (_tool === 'conn') {
    if (!_connStart) {
      _connStart = roomId;
      _renderSvg();
      _updateCursor();
      _updateConnHint();
    } else if (_connStart === roomId) {
      // Klik op dezelfde kamer → annuleer
      _connStart = null;
      _renderSvg();
      _updateCursor();
      _updateConnHint();
    } else {
      _createConnection(_connStart, roomId);
      _connStart = null;
      _updateCursor();
      _updateConnHint();
    }
  }
};

window._dngPlayerClickRoom = (roomId) => {
  if (isDM()) return;
  const map  = _maps[_mapIdx];
  const room = (map?.rooms || []).find(r => r.id === roomId);
  if (!room?.name) return;

  // Verwijder eventuele bestaande tooltip
  document.querySelector('.dng-room-tooltip')?.remove();

  const tooltip = document.createElement('div');
  tooltip.className = 'dng-room-tooltip';
  tooltip.textContent = room.name;
  document.body.appendChild(tooltip);

  // Fade-out na 3 seconden
  setTimeout(() => {
    tooltip.classList.add('dng-room-tooltip--out');
    tooltip.addEventListener('transitionend', () => tooltip.remove(), { once: true });
  }, 3000);
};

function _renderSidebar(room) {
  const map       = _maps[_mapIdx];
  const groupId   = _activeGroupId();
  const revealed  = new Set(map.reveals?.[groupId] || []);
  const isRev     = revealed.has(room.id);
  const conns     = (map.connections || []).filter(c =>
    c.fromId === room.id || c.toId === room.id
  );
  const conditions = room.conditions || [];

  const sb = document.getElementById('dng-sidebar-detail');
  if (!sb) return;

  // ── Conditie-toggle knoppen ──
  const condToggleHtml = COND_TYPES.map(ct => {
    const has = conditions.some(c => c.type === ct.id);
    return `<button class="dng-cond-btn${has?' dng-cond-btn--on':''}"
      data-ctype="${ct.id}" title="${ct.label}">${icon(ct.svgName)}</button>`;
  }).join('');

  // ── Actieve conditie-rijen ──
  const condRowsHtml = conditions.length ? `
    <div class="dng-cond-rows">
      ${conditions.map(c => {
        const ct = COND_TYPES.find(t => t.id === c.type);
        return `<div class="dng-cond-row">
          <span class="dng-cond-row-icon">${ct ? icon(ct.svgName) : '?'}</span>
          <button class="dng-cond-vis-btn${c.visible?' dng-cond-vis-btn--on':''}" data-cid="${esc(c.id)}">
            ${c.visible ? icon('eye')+' Zichtbaar' : icon('eye-off')+' Verborgen'}
          </button>
          <button class="dng-cond-del-btn" data-cid="${esc(c.id)}" title="Verwijderen">${icon('x')}</button>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Verbindingen ──
  const connsHtml = conns.length ? `
    <div class="dng-sb-section">
      <div class="dng-sb-section-hdr">Verbindingen</div>
      ${conns.map(c => {
        const otherId = c.fromId === room.id ? c.toId : c.fromId;
        const other   = (map.rooms || []).find(r => r.id === otherId);
        return `<div class="dng-conn-row">
          <span class="dng-conn-row-name">${icon('link')} ${esc(other?.name || '?')}</span>
          <button class="dng-btn dng-btn-sm dng-btn-danger dng-del-conn-btn"
            data-connid="${esc(c.id)}" title="Verbinding verwijderen">${icon('x')}</button>
        </div>`;
      }).join('')}
    </div>` : '';

  sb.innerHTML = `
    <div class="dng-sb-detail-card">
      <div class="dng-sb-name">${esc(room.name)}</div>
      <div class="dng-sb-shape">${room.shape === 'rect' ? icon('square')+' Rechthoek' : icon('hexagon')+' Polygoon'}</div>
      ${room.dmNotes ? `<div class="dng-sb-notes">${esc(room.dmNotes).replace(/\n/g,'<br>')}</div>` : ''}
      <div class="dng-sb-actions">
        ${!isRev ? `
          <button class="dng-btn dng-btn-reveal" id="dng-reveal-btn">
            ${icon('eye')} Onthul voor ${esc(groupId)}
          </button>` : `
          <button class="dng-btn dng-btn-hide" id="dng-hide-btn">
            ${icon('moon')} Verberg voor ${esc(groupId)}
          </button>`}
        <button class="dng-btn dng-btn-sm" id="dng-edit-room-btn">${icon('pencil')} Bewerken</button>
        <button class="dng-btn dng-btn-sm dng-btn-danger" id="dng-delete-room-btn">${icon('trash')} Verwijderen</button>
      </div>
      <div class="dng-sb-section">
        <div class="dng-sb-section-hdr">Symbolen</div>
        <div class="dng-cond-toggle-row">${condToggleHtml}</div>
        ${condRowsHtml}
      </div>
      ${connsHtml}
    </div>`;

  // ── Events ──
  document.getElementById('dng-reveal-btn')?.addEventListener('click', async () => {
    await api.revealDungeonRoom(map.id, { roomId: room.id, groupId });
    if (!map.reveals) map.reveals = {};
    if (!map.reveals[groupId]) map.reveals[groupId] = [];
    map.reveals[groupId].push(room.id);
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
  });

  document.getElementById('dng-hide-btn')?.addEventListener('click', async () => {
    await api.hideDungeonRoom(map.id, { roomId: room.id, groupId });
    if (map.reveals?.[groupId]) {
      map.reveals[groupId] = map.reveals[groupId].filter(id => id !== room.id);
    }
    _renderSvg();
    _renderSidebar(room);
    _renderRoomList();
  });

  document.getElementById('dng-edit-room-btn')?.addEventListener('click', () => {
    _openRoomNameDialog(null, room);
  });

  document.getElementById('dng-delete-room-btn')?.addEventListener('click', async () => {
    if (!confirm(`Kamer "${room.name}" verwijderen?`)) return;
    map.rooms = map.rooms.filter(r => r.id !== room.id);
    map.connections = (map.connections || []).filter(c =>
      c.fromId !== room.id && c.toId !== room.id
    );
    _selectedRoom = null;
    await _saveRooms();
    sb.innerHTML = '';
  });

  // Conditie-toggle: klik om toe te voegen (als niet aanwezig) of te verwijderen
  sb.querySelectorAll('.dng-cond-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ctype = btn.dataset.ctype;
      const idx   = conditions.findIndex(c => c.type === ctype);
      if (idx === -1) {
        // Toevoegen
        conditions.push({ id: uid(), type: ctype, visible: false });
      } else {
        // Verwijderen
        conditions.splice(idx, 1);
      }
      room.conditions = conditions;
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Zichtbaarheid-toggle
  sb.querySelectorAll('.dng-cond-vis-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cond = conditions.find(c => c.id === btn.dataset.cid);
      if (!cond) return;
      cond.visible = !cond.visible;
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Conditie verwijderen (✕ knop)
  sb.querySelectorAll('.dng-cond-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      room.conditions = conditions.filter(c => c.id !== btn.dataset.cid);
      await _saveRooms();
      _renderSidebar(room);
    });
  });

  // Verbinding verwijderen
  sb.querySelectorAll('.dng-del-conn-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      map.connections = (map.connections || []).filter(c => c.id !== btn.dataset.connid);
      await _saveRooms();
      _renderSidebar(room);
    });
  });
}

// ──────────────────────────────────────────────────────────────────
// Alfabetische kamerlijst in de sidebar
// ──────────────────────────────────────────────────────────────────
function _renderRoomList() {
  const listEl  = document.getElementById('dng-sb-list');
  const countEl = document.getElementById('dng-sb-count');
  if (!listEl) return;

  const map     = _maps[_mapIdx];
  const rooms   = [...(map.rooms || [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
  const groupId = _activeGroupId();
  const revealed= new Set(map.reveals?.[groupId] || []);
  const revCnt  = rooms.filter(r => revealed.has(r.id)).length;

  // Teller: "3/8" (onthuld/totaal)
  if (countEl) {
    countEl.textContent = rooms.length ? `${revCnt}/${rooms.length}` : '';
  }

  if (!rooms.length) {
    listEl.innerHTML = '<p class="dng-sidebar-hint">Nog geen kamers</p>';
    _updateRevealCount();
    return;
  }

  listEl.innerHTML = rooms.map(r => {
    const isRev = revealed.has(r.id);
    const isSel = r.id === _selectedRoom;
    const hasConds = (r.conditions || []).length > 0;
    const condIcons = hasConds
      ? (r.conditions || []).map(c => {
          const ct = COND_TYPES.find(t => t.id === c.type);
          return `<span class="dng-sb-cond-icon${!c.visible ? ' dng-sb-cond-icon--hidden' : ''}"
            title="${ct?.label || ''}">${ct ? icon(ct.svgName) : '?'}</span>`;
        }).join('')
      : '';
    return `<div class="dng-sb-li${isSel ? ' dng-sb-li--sel' : ''}" data-rid="${esc(r.id)}">
      <span class="dng-sb-li-dot${isRev ? ' dng-sb-li-dot--rev' : ''}">
        ${isRev ? icon('check-circle') : '<span class="dng-sb-dot-empty">○</span>'}
      </span>
      <span class="dng-sb-li-name">${esc(r.name)}</span>
      ${condIcons ? `<span class="dng-sb-li-conds">${condIcons}</span>` : ''}
      ${!isRev
        ? `<button class="dng-sb-quick-reveal" data-rid="${esc(r.id)}" title="Onthul kamer">${icon('eye')}</button>`
        : `<button class="dng-sb-quick-hide"   data-rid="${esc(r.id)}" title="Verberg kamer">${icon('moon')}</button>`}
    </div>`;
  }).join('');

  // Klik op rij → selecteer kamer + inzoomen (Feature 1 + 4)
  listEl.querySelectorAll('.dng-sb-li').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.dng-sb-quick-reveal') || e.target.closest('.dng-sb-quick-hide')) return;
      const room = map.rooms.find(r => r.id === row.dataset.rid);
      if (!room) return;
      _selectedRoom = room.id;
      _switchToSelect();
      _renderSidebar(room);
      _renderRoomList();
      _zoomToRoom(room); // Feature 1: inzoomen op kamer
    });
  });

  // Snelonthulknoppen
  listEl.querySelectorAll('.dng-sb-quick-reveal').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const roomId = btn.dataset.rid;
      const room   = map.rooms.find(r => r.id === roomId);
      if (!room) return;
      await api.revealDungeonRoom(map.id, { roomId, groupId });
      if (!map.reveals) map.reveals = {};
      if (!map.reveals[groupId]) map.reveals[groupId] = [];
      map.reveals[groupId].push(roomId);
      _renderSvg();
      _renderRoomList();
      if (_selectedRoom === roomId) _renderSidebar(room);
    });
  });

  // Snelverbergknoppen
  listEl.querySelectorAll('.dng-sb-quick-hide').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const roomId = btn.dataset.rid;
      const room   = map.rooms.find(r => r.id === roomId);
      if (!room) return;
      await api.hideDungeonRoom(map.id, { roomId, groupId });
      if (map.reveals?.[groupId]) {
        map.reveals[groupId] = map.reveals[groupId].filter(id => id !== roomId);
      }
      _renderSvg();
      _renderRoomList();
      if (_selectedRoom === roomId) _renderSidebar(room);
    });
  });

  // Feature 4: scroll geselecteerde kamer in beeld
  _scrollToSelected();
  _updateRevealCount();
}

// ──────────────────────────────────────────────────────────────────
// Feature 1: Inzoomen op geselecteerde kamer
// ──────────────────────────────────────────────────────────────────
function _zoomToRoom(room) {
  const img = document.getElementById('dng-img');
  if (!img?.naturalWidth) return;
  const W = img.naturalWidth, H = img.naturalHeight;
  const [cx, cy] = _roomCentroid(room, W, H);
  // Centreer het beeld zodat (cx, cy) in het midden van de viewport ligt
  // panX = -(cx - W/2) * zoom, panY = -(cy - H/2) * zoom
  _panX = -(cx - W / 2) * _zoom;
  _panY = -(cy - H / 2) * _zoom;
  _applyTransform();
}

// ──────────────────────────────────────────────────────────────────
// Feature 4: Scroll sidebar naar geselecteerde kamer
// ──────────────────────────────────────────────────────────────────
function _scrollToSelected() {
  requestAnimationFrame(() => {
    document.querySelector('.dng-sb-li--sel')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

// ──────────────────────────────────────────────────────────────────
// Hulpfuncties: punten en kamers
// ──────────────────────────────────────────────────────────────────
function _findRoomAtPoint(map, pctX, pctY) {
  return (map.rooms || []).find(r => _pointInRoom(r, pctX, pctY));
}

function _pointInRoom(room, pctX, pctY) {
  if (room.shape === 'rect' && room.points?.length === 2) {
    const [[x1,y1],[x2,y2]] = room.points;
    return pctX>=Math.min(x1,x2) && pctX<=Math.max(x1,x2)
        && pctY>=Math.min(y1,y2) && pctY<=Math.max(y1,y2);
  }
  if (room.points?.length >= 3) {
    return _pointInPolygon(pctX, pctY, room.points);
  }
  return false;
}

function _pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const [xi,yi]=[pts[i][0],pts[i][1]], [xj,yj]=[pts[j][0],pts[j][1]];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

// ──────────────────────────────────────────────────────────────────
// Nieuwe dungeon dialog
// ──────────────────────────────────────────────────────────────────
function _openNewDungeonDialog() {
  const meta = window.app?.state?.meta || {};
  const hfst = Object.entries(meta.hoofdstukken || {}).map(([k,v]) =>
    `<option value="${esc(k)}">${esc(v?.title || k)}</option>`).join('');

  const overlay = _makeOverlay();
  overlay.innerHTML = `
    <div class="dng-dialog">
      <h3 class="dng-dialog-title">Nieuwe dungeon map</h3>
      <label class="dng-label">Naam
        <input id="dng-new-name" class="dng-input" placeholder="Bijv. De Crypte van Morthul">
      </label>
      <label class="dng-label">Akte
        <select id="dng-new-hfst" class="dng-input">
          <option value="">— geen —</option>
          ${hfst}
        </select>
      </label>
      <label class="dng-label">Kaartafbeelding (PNG/JPG)
        <input id="dng-new-file" type="file" accept="image/*" class="dng-input">
      </label>
      <div class="dng-dialog-btns">
        <button class="dng-btn" id="dng-new-ok">Aanmaken</button>
        <button class="dng-btn dng-btn-ghost" id="dng-new-cancel">Annuleren</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('dng-new-name')?.focus(), 50);

  document.getElementById('dng-new-ok').addEventListener('click', async () => {
    const name   = document.getElementById('dng-new-name').value.trim();
    const hfstId = document.getElementById('dng-new-hfst').value;
    const file   = document.getElementById('dng-new-file').files[0];
    if (!name) return;

    let fileId = '';
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      const newFileId = 'dng_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      try {
        await fetch('/api/files/' + newFileId, { method: 'POST', body: fd });
        fileId = newFileId;
      } catch {}
    }

    const created = await api.createDungeon({ name, hoofdstukId: hfstId, fileId });
    _mapIdx = _maps.length;
    overlay.remove();
    const content = document.getElementById('kaart-mode-content');
    if (content) await renderDungeon(content);
  });

  document.getElementById('dng-new-cancel').addEventListener('click', () => overlay.remove());
}

// ──────────────────────────────────────────────────────────────────
// Party-toegang dialog
// ──────────────────────────────────────────────────────────────────
async function _openPartyAccessDialog() {
  const map       = _maps[_mapIdx];
  const { groups: groupList = [] } = await api.listGroups();
  const groups    = groupList.map(g => [g.id, g]);
  const access    = new Set(map.partyAccess    || []);
  const completed = new Set(map.partyCompleted || []);

  const stateOf = id => completed.has(id) ? 'completed' : access.has(id) ? 'active' : 'none';

  const overlay = _makeOverlay();
  overlay.innerHTML = `
    <div class="dng-dialog">
      <h3 class="dng-dialog-title">Party-toegang: ${esc(map.name)}</h3>
      <p class="dng-dialog-sub">Stel per party de zichtbaarheid van deze dungeon in.</p>
      <div class="dng-party-list">
        ${groups.map(([id,g]) => {
          const s = stateOf(id);
          return `
          <div class="dng-party-row">
            <span class="dng-party-name">${esc(g.name||id)}</span>
            <div class="dng-party-states" data-gid="${esc(id)}">
              <button class="dng-state-btn${s==='none'?' dng-state-btn--on':''}" data-state="none"
                title="Geen toegang">Geen</button>
              <button class="dng-state-btn${s==='active'?' dng-state-btn--on':''}" data-state="active"
                title="Fog-of-war actief">${icon('eye')} Actief</button>
              <button class="dng-state-btn${s==='completed'?' dng-state-btn--on':''}" data-state="completed"
                title="Dungeon uitgespeeld — volledige kaart zichtbaar">${icon('check')} Uitgespeeld</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="dng-dialog-btns">
        <button class="dng-btn" id="dng-party-ok">Opslaan</button>
        <button class="dng-btn dng-btn-ghost" id="dng-party-cancel">Annuleren</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.dng-party-states').forEach(row => {
    row.querySelectorAll('.dng-state-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.dng-state-btn').forEach(b => b.classList.remove('dng-state-btn--on'));
        btn.classList.add('dng-state-btn--on');
      });
    });
  });

  document.getElementById('dng-party-ok').addEventListener('click', async () => {
    const newAccess = [], newCompleted = [];
    overlay.querySelectorAll('.dng-party-states').forEach(row => {
      const gid   = row.dataset.gid;
      const state = row.querySelector('.dng-state-btn--on')?.dataset.state || 'none';
      if (state === 'active')    newAccess.push(gid);
      if (state === 'completed') { newAccess.push(gid); newCompleted.push(gid); }
    });
    await api.setDungeonPartyAccess(map.id, newAccess, newCompleted);
    map.partyAccess    = newAccess;
    map.partyCompleted = newCompleted;
    overlay.remove();
  });
  document.getElementById('dng-party-cancel').addEventListener('click', () => overlay.remove());
}

// ──────────────────────────────────────────────────────────────────
// Verwijderen
// ──────────────────────────────────────────────────────────────────
async function _deleteCurrentMap() {
  const map = _maps[_mapIdx];
  if (!map || !confirm(`Dungeon "${map.name}" verwijderen?`)) return;
  await api.deleteDungeon(map.id);
  _mapIdx = Math.max(0, _mapIdx - 1);
  const content = document.getElementById('kaart-mode-content');
  if (content) await renderDungeon(content);
}

// ──────────────────────────────────────────────────────────────────
// Opslaan
// ──────────────────────────────────────────────────────────────────
async function _saveRooms() {
  const map = _maps[_mapIdx];
  await api.saveDungeonRooms(map.id, map.rooms, map.connections || []);
  _renderSvg();
  _renderRoomList();
}

// ──────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────
function _renderEmpty() {
  const area = document.getElementById('dng-map-area');
  if (area) area.innerHTML = `
    <div class="dng-empty">
      <div class="dng-empty-icon">⛓️</div>
      <div class="dng-empty-title">Geen dungeon maps</div>
      ${isDM() ? '<div class="dng-empty-sub">Klik op "+ Nieuw" om een dungeon map te uploaden.</div>' : ''}
    </div>`;
}

// ──────────────────────────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────────────────────────
function _makeOverlay() {
  const el = document.createElement('div');
  el.className = 'dng-overlay';
  el.addEventListener('click', e => { if (e.target===el) el.remove(); });
  return el;
}
