import { api } from './api.js';

const isDM = () => window.app.isDM();
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MAPS = [
  { id: 'grisburgh', label: 'Grisburgh', src: '/assets/map-grisburgh.jpg', hasPins: true },
  { id: 'isfar',     label: 'Isfār',     src: '/assets/map-isfar.jpg',     hasPins: true },
];

const ZOOM_STEP = 0.15;
const ZOOM_MIN  = 0.2;
const ZOOM_MAX  = 5.0;

let currentMapIdx = 0;
let zoomLevel     = 1.0;
let panX          = 0;
let panY          = 0;
let mapPins       = [];
let allLocaties   = [];
let _panAbort     = null;

// ── Public entry point ──
export async function renderKaart() {
  [mapPins, allLocaties] = await Promise.all([
    api.mapPins(MAPS[currentMapIdx].id),
    api.listEntities('locaties'),
  ]);

  panX = 0; panY = 0;
  const section = document.getElementById('section-kaart');
  section.innerHTML = _buildShell();
  _renderMapContent();
  _attachNavEvents();
}

// ── Shell ──
function _buildShell() {
  return `
    <div class="flex-1 min-h-0 overflow-auto bg-room-bg flex flex-col items-center py-6 px-4" id="map-scroll">
      <div class="flex items-center gap-3 mb-4 flex-wrap justify-center">
        <button id="map-prev" class="map-nav-btn" title="Vorige kaart"
          ${MAPS.length <= 1 ? 'disabled' : ''}>&#9664;</button>
        <div class="font-cinzel font-bold text-gold text-lg tracking-widest min-w-[120px] text-center"
          id="map-title">${esc(MAPS[currentMapIdx].label)}</div>
        <button id="map-next" class="map-nav-btn" title="Volgende kaart"
          ${MAPS.length <= 1 ? 'disabled' : ''}>&#9654;</button>
        <div class="w-px h-5 bg-room-border mx-1"></div>
        <button id="map-zoom-out" class="map-nav-btn" title="Uitzoomen">−</button>
        <span id="map-zoom-label" class="text-xs font-mono text-ink-dim w-10 text-center">—</span>
        <button id="map-zoom-in"  class="map-nav-btn" title="Inzoomen">+</button>
        <button id="map-zoom-fit" class="map-nav-btn text-[11px] px-2 w-auto rounded-md" title="Passend maken">⊡</button>
      </div>
      <div id="map-area" class="flex flex-col items-center w-full shrink-0 overflow-hidden"></div>
    </div>`;
}

// ── Map content ──
function _renderMapContent() {
  const map = MAPS[currentMapIdx];
  const area = document.getElementById('map-area');
  if (!area) return;

  area.innerHTML = `
    <div class="relative inline-block map-frame" id="map-wrapper">
      <img id="map-img" src="${map.src}"
        class="block select-none"
        draggable="false"
        onerror="this.style.opacity='0.2'">
      <div id="map-pins-layer" class="absolute inset-0 pointer-events-none"></div>
    </div>
    ${isDM() && map.hasPins ? `
      <div class="mt-3 text-xs text-ink-dim font-mono flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-gold inline-block"></span>
        Klik op de kaart om een pin te plaatsen
      </div>` : ''}`;

  _initZoom();
  if (map.hasPins) _renderPins();
  _attachPanAndClick();
  _applyPan();
}

// ── Zoom ──
function _initZoom() {
  const img = document.getElementById('map-img');
  if (!img) return;

  const fit = () => {
    const scroll = document.getElementById('map-scroll');
    const avail  = scroll ? scroll.clientWidth - 48 : window.innerWidth;
    zoomLevel = Math.min(1, avail / img.naturalWidth);
    _applyZoom();
  };

  if (img.complete && img.naturalWidth) { fit(); }
  else { img.addEventListener('load', fit, { once: true }); }

  // Scroll wheel zooms (only when hovering over the map)
  const wrapper = document.getElementById('map-wrapper');
  wrapper?.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const delta = ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel + delta));
    _applyZoom();
  }, { passive: false });
}

function _applyZoom() {
  const img     = document.getElementById('map-img');
  const wrapper = document.getElementById('map-wrapper');
  const label   = document.getElementById('map-zoom-label');
  if (!img?.naturalWidth) return;

  const w = Math.round(img.naturalWidth * zoomLevel);
  img.style.width    = w + 'px';
  img.style.height   = 'auto';
  wrapper.style.width = w + 'px';
  if (label) label.textContent = Math.round(zoomLevel * 100) + '%';
}

// ── Navigation ──
function _attachNavEvents() {
  document.getElementById('map-prev')?.addEventListener('click', () => _switchMap(-1));
  document.getElementById('map-next')?.addEventListener('click', () => _switchMap(+1));

  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
    _applyZoom();
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
    _applyZoom();
  });
  document.getElementById('map-zoom-fit')?.addEventListener('click', () => {
    const img    = document.getElementById('map-img');
    const scroll = document.getElementById('map-scroll');
    if (!img?.naturalWidth) return;
    zoomLevel = Math.min(1, (scroll.clientWidth - 48) / img.naturalWidth);
    panX = 0; panY = 0;
    _applyZoom();
    _applyPan();
  });
}

async function _switchMap(dir) {
  currentMapIdx = (currentMapIdx + dir + MAPS.length) % MAPS.length;
  zoomLevel = 1.0;
  panX = 0; panY = 0;
  document.getElementById('map-title').textContent = MAPS[currentMapIdx].label;
  mapPins = await api.mapPins(MAPS[currentMapIdx].id);
  _renderMapContent();
}

// ── Pan + optional pin placement ──
function _applyPan() {
  const wrapper = document.getElementById('map-wrapper');
  if (wrapper) wrapper.style.transform = `translate(${panX}px, ${panY}px)`;
}

function _attachPanAndClick() {
  if (_panAbort) _panAbort.abort();
  _panAbort = new AbortController();
  const signal = _panAbort.signal;

  const wrapper = document.getElementById('map-wrapper');
  if (!wrapper) return;

  const map = MAPS[currentMapIdx];
  wrapper.style.cursor = 'grab';

  let panning   = false;
  let panMoved  = false;
  let startX, startY, startPanX, startPanY;

  wrapper.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('.map-pin')) return;
    if (ev.button !== 0) return;
    ev.preventDefault();

    panning   = true;
    panMoved  = false;
    startX    = ev.clientX;
    startY    = ev.clientY;
    startPanX = panX;
    startPanY = panY;

    wrapper.style.cursor = 'grabbing';
  }, { signal });

  document.addEventListener('mousemove', (ev) => {
    if (!panning) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panMoved = true;
    panX = startPanX + dx;
    panY = startPanY + dy;
    wrapper.style.transform = `translate(${panX}px, ${panY}px)`;
  }, { signal });

  document.addEventListener('mouseup', (ev) => {
    if (!panning) return;
    panning = false;
    wrapper.style.cursor = 'grab';

    if (!panMoved && isDM() && map.hasPins) {
      const rect = wrapper.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      _openPinPlacer(x, y, ev.clientX, ev.clientY);
    }
  }, { signal });
}

// ── Render pins ──
function _renderPins() {
  const layer = document.getElementById('map-pins-layer');
  if (!layer) return;

  layer.innerHTML = mapPins.map(pin => {
    const loc = allLocaties.find(l => l.id === pin.locId);
    if (!loc) return '';

    const vis = pin.visibility || loc._visibility || 'visible';
    if (!isDM() && vis === 'hidden') return '';

    const isVague  = vis === 'vague';
    const isHidden = vis === 'hidden';
    const label    = isVague ? '?' : esc(pin.locName || loc.name || '');

    return `
      <div class="map-pin${isVague ? ' map-pin-vague' : ''}${isHidden ? ' map-pin-hidden' : ''}"
        style="left:${pin.x}%;top:${pin.y}%;pointer-events:auto"
        data-pin-id="${pin.id}" data-loc-id="${pin.locId}">
        <div class="pin-needle"></div>
        <div class="pin-head"></div>
        <div class="pin-label">${label}</div>
        ${isDM() ? `<button class="pin-delete" onclick="event.stopPropagation();window._deleteMapPin('${pin.id}')" title="Pin verwijderen">✕</button>` : ''}
      </div>`;
  }).join('');

  layer.querySelectorAll('.map-pin').forEach(el => {
    if (isDM()) {
      _attachDrag(el);
    } else {
      el.addEventListener('click', () => {
        const pin = mapPins.find(p => p.id === el.dataset.pinId);
        if (pin?.visibility === 'vague') return;
        window._openDetail('locaties', el.dataset.locId);
      });
    }
  });
}

// ── Pin drag (DM only) ──
function _attachDrag(el) {
  let dragging = false;
  let moved    = false;
  let startX, startY, origLeft, origTop;

  el.addEventListener('mousedown', (ev) => {
    if (ev.target.classList.contains('pin-delete')) return;
    ev.preventDefault();
    dragging = true;
    moved    = false;
    startX   = ev.clientX;
    startY   = ev.clientY;
    origLeft = parseFloat(el.style.left);
    origTop  = parseFloat(el.style.top);
    el.style.zIndex = '50';
    el.classList.add('pin-dragging');
  });

  document.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const wrapper = document.getElementById('map-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dx = ((ev.clientX - startX) / rect.width) * 100;
    const dy = ((ev.clientY - startY) / rect.height) * 100;
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) moved = true;
    el.style.left = `${Math.max(0, Math.min(100, origLeft + dx))}%`;
    el.style.top  = `${Math.max(0, Math.min(100, origTop  + dy))}%`;
  });

  document.addEventListener('mouseup', async () => {
    if (!dragging) return;
    dragging = false;
    el.style.zIndex = '';
    el.classList.remove('pin-dragging');

    if (!moved) {
      window._openDetail('locaties', el.dataset.locId);
      return;
    }

    const x     = parseFloat(el.style.left);
    const y     = parseFloat(el.style.top);
    const pinId = el.dataset.pinId;
    const pin   = mapPins.find(p => p.id === pinId);
    if (pin) { pin.x = x; pin.y = y; }
    try {
      await api.updateMapPin(pinId, { x, y });
    } catch {
      if (pin) { el.style.left = `${pin.x}%`; el.style.top = `${pin.y}%`; }
    }
  });
}

// ── Pin placer popup ──
function _openPinPlacer(x, y, clientX, clientY) {
  document.getElementById('pin-placer-popup')?.remove();

  const pinnedIds = new Set(mapPins.map(p => p.locId));
  const available = allLocaties.filter(l => !pinnedIds.has(l.id));

  if (!available.length) {
    alert('Alle locaties hebben al een pin op de kaart.');
    return;
  }

  const pw = 220, ph = 155;
  const left = Math.min(clientX + 8, window.innerWidth  - pw - 8);
  const top  = Math.min(clientY + 8, window.innerHeight - ph - 8);

  const popup = document.createElement('div');
  popup.id        = 'pin-placer-popup';
  popup.className = 'pin-placer-popup';
  popup.style.cssText = `left:${left}px;top:${top}px`;
  popup.innerHTML = `
    <div class="text-[11px] font-cinzel text-gold uppercase tracking-wide mb-2">📍 Locatie koppelen</div>
    <input id="pin-loc-search" type="text" placeholder="Zoeken…"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-2 py-1 text-ink-bright mb-1 focus:border-gold-dim focus:outline-none">
    <select id="pin-loc-select" size="4"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-1 py-0.5 text-ink-bright mb-2 focus:border-gold-dim focus:outline-none">
      ${available.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
    </select>
    <div class="flex gap-2">
      <button id="pin-confirm"
        class="flex-1 text-xs bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded px-2 py-1 transition" title="Plaatsen">📌</button>
      <button id="pin-cancel"
        class="flex-1 text-xs text-ink-dim hover:bg-room-border rounded px-2 py-1 transition" title="Annuleren">✕</button>
    </div>`;
  document.body.appendChild(popup);

  popup.querySelector('#pin-loc-search').addEventListener('input', (ev) => {
    const q = ev.target.value.toLowerCase();
    popup.querySelector('#pin-loc-select').innerHTML = available
      .filter(l => l.name.toLowerCase().includes(q))
      .map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`)
      .join('');
  });
  popup.querySelector('#pin-loc-search').focus();

  popup.querySelector('#pin-cancel').addEventListener('click', () => popup.remove());
  popup.querySelector('#pin-confirm').addEventListener('click', async () => {
    const locId = popup.querySelector('#pin-loc-select').value;
    if (!locId) return;
    try {
      const pin = await api.createMapPin({ locId, x, y, mapId: MAPS[currentMapIdx].id });
      mapPins.push({ ...pin, locName: allLocaties.find(l => l.id === locId)?.name, visibility: 'hidden' });
      popup.remove();
      _renderPins();
    } catch (e) { alert('Fout: ' + e.message); }
  });

  setTimeout(() => {
    const handler = (ev) => {
      if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 0);
}

window._deleteMapPin = async (pinId) => {
  if (!confirm('Pin verwijderen?')) return;
  await api.deleteMapPin(pinId);
  mapPins = mapPins.filter(p => p.id !== pinId);
  _renderPins();
};
