import { api } from './api.js?v=265';

const isDM  = () => window.app.isDM();
const icon  = (...a) => window.icon(...a);
const esc   = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ZOOM_STEP = 0.15;
const ZOOM_MIN  = 0.2;
const ZOOM_MAX  = 5.0;

let MAPS               = [];
let currentMapIdx      = 0;
let zoomLevel          = 1.0;
let panX               = 0;
let panY               = 0;
let mapPins            = [];
let allLocaties        = [];
let _availableForPin   = [];   // locaties die speler kan aanwijzen (niet-DM)
let _panAbort          = null;
let _pendingFlyLocId   = null; // queued "fly to pin" after next render

// ── Publieke fly-to helper (aanroepen vóór switchSection('kaart')) ──
export function queueFlyTo(locId) {
  _pendingFlyLocId = locId;
}

// Houdt window._pinnedLocIds bij — gebruikt door render-campagne.js om de kaartknop te tonen
function _syncPinnedSet() {
  window._pinnedLocIds = new Set(mapPins.filter(p => !p.pending).map(p => p.locId));
}

function _mapImgSrc(map) {
  // Ingebouwde kaart: statische src. Anders het losse imageId (mediabibliotheek)
  // of, voor oudere kaarten, het map-id zelf (/files/{map.id}).
  return map.src || api.fileUrl(map.imageId || map.id);
}

// ── Public entry point ──
export async function renderKaart(container, openId) {
  MAPS = await api.listMaps();
  // Geen kaarten is geen kaart. Vroeger sprong hier Grisburghs stadskaart in
  // als vangnet — met de naam van de andere campagne eronder.
  if (!MAPS.length) {
    const section = container || document.getElementById('section-kaart');
    section.innerHTML = _legeStaat();
    document.getElementById('map-leeg-add')?.addEventListener('click', _openMapAdder);
    return;
  }
  // Optioneel: open direct een specifieke kaart (vanuit de galerij).
  if (openId) {
    const i = MAPS.findIndex(m => m.id === openId);
    if (i >= 0) currentMapIdx = i;
  }
  if (currentMapIdx >= MAPS.length) currentMapIdx = 0;

  [mapPins, allLocaties] = await Promise.all([
    api.mapPins(MAPS[currentMapIdx].id),
    api.listEntities('locaties'),
  ]);
  _syncPinnedSet();
  if (!isDM()) {
    try { _availableForPin = await api.availableLocations(MAPS[currentMapIdx].id); }
    catch { _availableForPin = []; }
  }

  panX = 0; panY = 0;
  const section = container || document.getElementById('section-kaart');
  section.innerHTML = _buildShell();
  _renderMapContent();
  _attachNavEvents();

  // Fly to queued location (if any)
  if (_pendingFlyLocId) {
    const locId = _pendingFlyLocId;
    _pendingFlyLocId = null;
    _flyToPin(locId);
  }
}

// ── Shell ──
// Compacte weergave in de fullscreen-galerij-overlay: alleen centreren + zoomen.
// Navigeren/toevoegen/hernoemen gaat via de kaartgalerij.
function _legeStaat() {
  return `
    <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-8 text-center bg-room-bg">
      <div class="text-gold opacity-60">${icon('map', { cls: 'icon-lg' })}</div>
      <p class="text-ink-dim text-sm">${isDM()
        ? 'Deze campagne heeft nog geen kaart.'
        : 'De DM heeft nog geen kaart toegevoegd.'}</p>
      ${isDM() ? `<button id="map-leeg-add" class="text-xs bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded px-3 py-1.5 transition font-cinzel">${icon('plus')} Kaart toevoegen</button>` : ''}
    </div>`;
}

function _buildShell() {
  return `
    <div class="flex-1 min-h-0 overflow-auto bg-room-bg flex flex-col items-center pt-3 pb-6 px-4" id="map-scroll">
      <div class="map-toolbar-min" id="map-toolbar">
        <button id="map-zoom-out" class="map-mini-btn" title="Uitzoomen">${icon('minus')}</button>
        <span id="map-zoom-label" class="map-zoom-label">—</span>
        <button id="map-zoom-in"  class="map-mini-btn" title="Inzoomen">${icon('plus')}</button>
        <span class="map-toolbar-sep"></span>
        <button id="map-zoom-fit" class="map-mini-btn" title="Centreren / passend maken">${icon('maximize-2')}</button>
        <span class="map-toolbar-sep"></span>
        ${window._helpBtn?.('kaart') ?? ''}
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
      <img id="map-img" src="${_mapImgSrc(map)}"
        class="block select-none"
        draggable="false"
        onerror="this.style.opacity='0.2'">
      <div id="map-pins-layer" class="absolute inset-0 pointer-events-none"></div>
    </div>
    ${isDM() ? `
      <div class="mt-3 text-xs text-ink-dim font-mono flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-gold inline-block"></span>
        Dubbelklik op de kaart om een pin te plaatsen
      </div>` : _availableForPin.length ? `
      <div class="mt-3 text-xs text-ink-dim font-mono flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-gold/40 inline-block"></span>
        Dubbelklik op de kaart om een locatie voor te stellen
      </div>` : ''}`;

  _initZoom();
  _renderPins();
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

  document.getElementById('map-add-btn')?.addEventListener('click', _openMapAdder);
  document.getElementById('map-rename-btn')?.addEventListener('click', () => _openMapRenamer());
  document.getElementById('map-delete-btn')?.addEventListener('click', _deleteCurrentMap);
}

async function _switchMap(dir) {
  currentMapIdx = (currentMapIdx + dir + MAPS.length) % MAPS.length;
  zoomLevel = 1.0;
  panX = 0; panY = 0;
  document.getElementById('map-title').textContent = MAPS[currentMapIdx].label;
  mapPins = await api.mapPins(MAPS[currentMapIdx].id);
  _syncPinnedSet();
  if (!isDM()) {
    try { _availableForPin = await api.availableLocations(MAPS[currentMapIdx].id); }
    catch { _availableForPin = []; }
  }
  _renderMapContent();
  // Refresh delete/rename buttons visibility for new map
  const renameBtn = document.getElementById('map-rename-btn');
  const deleteBtn = document.getElementById('map-delete-btn');
  if (renameBtn) renameBtn.style.display = '';
  if (deleteBtn) {
    deleteBtn.style.display = MAPS[currentMapIdx].src ? 'none' : '';
  }
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
  }, { signal });

  // Dubbelklik → pin plaatsen (onderscheidt pan van intentionele plaatsing)
  wrapper.addEventListener('dblclick', (ev) => {
    if (ev.target.closest('.map-pin')) return;
    ev.preventDefault(); // voorkom tekstselectie
    const rect = wrapper.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    if (isDM()) {
      _openPinPlacer(x, y, ev.clientX, ev.clientY);
    } else if (_availableForPin.length) {
      _openPlayerPinPlacer(x, y, ev.clientX, ev.clientY);
    }
  }, { signal });

  // Touch: dubbelklik-detectie (twee tikken binnen 320 ms op ~dezelfde plek)
  let _lastTap = null;
  wrapper.addEventListener('touchend', (ev) => {
    if (ev.target.closest('.map-pin')) return;
    const t = ev.changedTouches[0];
    const now = Date.now();
    if (_lastTap && now - _lastTap.time < 320
        && Math.abs(t.clientX - _lastTap.x) < 24
        && Math.abs(t.clientY - _lastTap.y) < 24) {
      ev.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const x = ((t.clientX - rect.left) / rect.width) * 100;
      const y = ((t.clientY - rect.top) / rect.height) * 100;
      if (isDM()) {
        _openPinPlacer(x, y, t.clientX, t.clientY);
      } else if (_availableForPin.length) {
        _openPlayerPinPlacer(x, y, t.clientX, t.clientY);
      }
      _lastTap = null;
    } else {
      _lastTap = { time: now, x: t.clientX, y: t.clientY };
    }
  }, { signal });
}

// Opent het locatie-detail vanaf een pin. Als de kaart in de fullscreen-overlay
// staat (z-index 1200) moet die eerst dicht, anders opent het detail-modal
// (z-index 70) onzichtbaar eronder — dit brak sinds de fullscreen-galerij-update.
function _openLocDetailFromPin(locId) {
  if (document.getElementById('kaart-fs-overlay')?.classList.contains('open')) {
    window._closeKaartFullscreen?.();
  }
  window._openDetail('locaties', locId);
}

// ── Render pins ──
function _renderPins() {
  const layer = document.getElementById('map-pins-layer');
  if (!layer) return;
  const myCharId = window.app?.state?.characterId;

  layer.innerHTML = mapPins.map(pin => {
    const loc = allLocaties.find(l => l.id === pin.locId);
    if (!loc) return '';

    const vis       = pin.visibility || loc._visibility || 'visible';
    const isPending = !!pin.pending;
    const isOwnPending = isPending && pin.placedBy === myCharId;

    if (!isDM() && vis === 'hidden' && !isOwnPending) return '';

    const isVague  = vis === 'vague';
    const isHidden = vis === 'hidden';
    const label    = (isVague && !isPending) ? '?' : esc(pin.locName || loc.name || '');
    const _pinIcon  = (isVague && !isPending) ? '?' : (loc.data?.icon || icon('castle',{cls:'icon-gi'}));

    let extraClass = '';
    if (isVague)   extraClass += ' map-pin-vague';
    if (isHidden)  extraClass += ' map-pin-hidden';
    if (isPending) extraClass += ' map-pin-pending';

    const titleAttr = isPending
      ? (isDM()
          ? `title="Ingediend door ${esc(pin.placedByName || 'speler')} — keur goed of wijs af"`
          : `title="Wachten op goedkeuring van de DM"`)
      : '';

    const actions = isDM()
      ? (isPending
          ? `<button class="pin-approve" onclick="event.stopPropagation();window._approveMapPin('${pin.id}')" title="Goedkeuren">${icon('check')}</button>
             <button class="pin-delete"  onclick="event.stopPropagation();window._deleteMapPin('${pin.id}')"  title="Afwijzen">${icon('x')}</button>`
          : `<button class="pin-delete"  onclick="event.stopPropagation();window._deleteMapPin('${pin.id}')"  title="Pin verwijderen">${icon('x')}</button>`)
      : '';

    return `
      <div class="map-pin${extraClass}"
        style="left:${pin.x}%;top:${pin.y}%;pointer-events:auto"
        data-pin-id="${pin.id}" data-loc-id="${pin.locId}"
        data-pending="${isPending}" data-own-pending="${isOwnPending}"
        ${titleAttr}>
        <div class="pin-icon">${_pinIcon}</div>
        <div class="pin-needle"></div>
        <div class="pin-label">${label}</div>
        ${actions}
      </div>`;
  }).join('');

  layer.querySelectorAll('.map-pin').forEach(el => {
    if (isDM()) {
      _attachDrag(el);
    } else if (el.dataset.ownPending === 'true') {
      _attachPlayerPendingDrag(el);
    } else {
      el.addEventListener('click', () => {
        const pin = mapPins.find(p => p.id === el.dataset.pinId);
        if (pin?.visibility === 'vague') return;
        _openLocDetailFromPin(el.dataset.locId);
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
      _openLocDetailFromPin(el.dataset.locId);
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
    <div class="text-[11px] font-cinzel text-gold uppercase tracking-wide mb-2">${icon('map-pin')} Locatie koppelen</div>
    <input id="pin-loc-search" type="text" placeholder="Zoeken…"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-2 py-1 text-ink-bright mb-1 focus:border-gold-dim focus:outline-none">
    <select id="pin-loc-select" size="4"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-1 py-0.5 text-ink-bright mb-2 focus:border-gold-dim focus:outline-none">
      ${available.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
    </select>
    <div class="flex gap-2">
      <button id="pin-confirm"
        class="flex-1 text-xs bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded px-2 py-1 transition" title="Plaatsen">${icon('pin')}</button>
      <button id="pin-cancel"
        class="flex-1 text-xs text-ink-dim hover:bg-room-border rounded px-2 py-1 transition" title="Annuleren">${icon('x')}</button>
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

  const _closePopup = () => { document.activeElement?.blur(); popup.remove(); };
  popup.querySelector('#pin-cancel').addEventListener('click', _closePopup);
  popup.querySelector('#pin-confirm').addEventListener('click', async () => {
    const locId = popup.querySelector('#pin-loc-select').value;
    if (!locId) return;
    try {
      const pin = await api.createMapPin({ locId, x, y, mapId: MAPS[currentMapIdx].id });
      mapPins.push({ ...pin, locName: allLocaties.find(l => l.id === locId)?.name, visibility: 'hidden' });
      _syncPinnedSet();
      _closePopup();
      _renderPins();
    } catch (e) { alert('Fout: ' + e.message); }
  });

  setTimeout(() => {
    const handler = (ev) => {
      if (!popup.contains(ev.target)) { _closePopup(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 0);
}

window._deleteMapPin = async (pinId) => {
  const pin = mapPins.find(p => p.id === pinId);
  const confirmMsg = pin?.pending
    ? `Pin-voorstel van ${pin.placedByName || 'speler'} afwijzen?`
    : 'Pin verwijderen?';
  if (!confirm(confirmMsg)) return;
  await api.deleteMapPin(pinId);
  mapPins = mapPins.filter(p => p.id !== pinId);
  _syncPinnedSet();
  _renderPins();
};

window._approveMapPin = async (pinId) => {
  try {
    await api.approveMapPin(pinId);
    const pin = mapPins.find(p => p.id === pinId);
    if (pin) { delete pin.pending; delete pin.placedBy; delete pin.placedByGroup; delete pin.placedByName; }
    _syncPinnedSet();
    _renderPins();
  } catch (e) { alert('Fout: ' + e.message); }
};

// ── Speler: pending pin placer popup ──
function _openPlayerPinPlacer(x, y, clientX, clientY) {
  document.getElementById('pin-placer-popup')?.remove();

  if (!_availableForPin.length) {
    alert('Er zijn geen locaties beschikbaar om te markeren.');
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
    <div class="text-[11px] font-cinzel text-gold uppercase tracking-wide mb-2">${icon('map-pin')} Locatie voorstellen</div>
    <input id="pin-loc-search" type="text" placeholder="Zoeken…"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-2 py-1 text-ink-bright mb-1 focus:border-gold-dim focus:outline-none">
    <select id="pin-loc-select" size="4"
      class="w-full text-sm bg-room-bg border border-room-border rounded px-1 py-0.5 text-ink-bright mb-2 focus:border-gold-dim focus:outline-none">
      ${_availableForPin.map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}
    </select>
    <div class="flex gap-2">
      <button id="pin-confirm"
        class="flex-1 text-xs bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded px-2 py-1 transition" title="Voorstellen">${icon('pin')}</button>
      <button id="pin-cancel"
        class="flex-1 text-xs text-ink-dim hover:bg-room-border rounded px-2 py-1 transition" title="Annuleren">${icon('x')}</button>
    </div>`;
  document.body.appendChild(popup);

  const available = _availableForPin;
  popup.querySelector('#pin-loc-search').addEventListener('input', (ev) => {
    const q = ev.target.value.toLowerCase();
    popup.querySelector('#pin-loc-select').innerHTML = available
      .filter(l => l.name.toLowerCase().includes(q))
      .map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`)
      .join('');
  });
  popup.querySelector('#pin-loc-search').focus();

  const _closePlayerPopup = () => { document.activeElement?.blur(); popup.remove(); };
  popup.querySelector('#pin-cancel').addEventListener('click', _closePlayerPopup);
  popup.querySelector('#pin-confirm').addEventListener('click', async () => {
    const locId = popup.querySelector('#pin-loc-select').value;
    if (!locId) return;
    try {
      const pin = await api.createMapPin({ locId, x, y, mapId: MAPS[currentMapIdx].id });
      const loc = available.find(l => l.id === locId);
      mapPins.push({ ...pin, locName: loc?.name, visibility: 'visible' });
      _syncPinnedSet();
      _availableForPin = _availableForPin.filter(l => l.id !== locId);
      _closePlayerPopup();
      _renderPins();
    } catch (e) { alert(e.message || 'Fout bij indienen'); }
  });

  setTimeout(() => {
    const handler = (ev) => {
      if (!popup.contains(ev.target)) { _closePlayerPopup(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 0);
}

// ── Speler: drag voor eigen pending pin ──
function _attachPlayerPendingDrag(el) {
  let dragging = false;
  let moved    = false;
  let startX, startY, origLeft, origTop;

  el.addEventListener('mousedown', (ev) => {
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
    if (!moved) return;
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

// ── DM: kaart toevoegen ──
function _openMapAdder() {
  document.getElementById('map-adder-popup')?.remove();

  const popup = document.createElement('div');
  popup.id        = 'map-adder-popup';
  popup.className = 'pin-placer-popup';
  popup.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);width:280px';
  popup.innerHTML = `
    <div class="text-[11px] font-cinzel text-gold uppercase tracking-wide mb-2">${icon('map')} Nieuwe kaart</div>
    <div class="space-y-2">
      <div>
        <label class="text-[10px] text-ink-faint uppercase">Naam</label>
        <input id="map-add-label" type="text" placeholder="Naam van de kaart…"
          class="w-full text-sm bg-room-bg border border-room-border rounded px-2 py-1 text-ink-bright focus:border-gold-dim focus:outline-none">
      </div>
      <div>
        <label class="text-[10px] text-ink-faint uppercase">Afbeelding</label>
        <button type="button" id="map-add-pick"
          class="flex items-center gap-2 mt-1 px-2 py-1.5 bg-room-elevated border border-room-border rounded cursor-pointer hover:border-gold-dim transition text-sm text-ink-dim w-full">
          ${icon('image')} <span id="map-add-file-name">Kies of upload afbeelding…</span>
        </button>
      </div>
    </div>
    <div class="flex gap-2 mt-3">
      <button id="map-add-confirm"
        class="flex-1 text-xs bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 rounded px-2 py-1.5 transition font-cinzel">Toevoegen</button>
      <button id="map-add-cancel"
        class="flex-1 text-xs text-ink-dim hover:bg-room-border rounded px-2 py-1.5 transition">Annuleren</button>
    </div>`;
  document.body.appendChild(popup);

  let _pickedImageId = null;
  popup.querySelector('#map-add-pick').addEventListener('click', () => {
    const naamHint = (popup.querySelector('#map-add-label').value || '').trim().toLowerCase().replace(/\s+/g, '-');
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: naamHint ? `${naamHint}-kaart` : 'kaart',
      onSelect: (fileId) => {
        _pickedImageId = fileId;
        popup.querySelector('#map-add-file-name').textContent = 'Afbeelding gekozen ✓';
      },
    });
  });

  popup.querySelector('#map-add-cancel').addEventListener('click', () => popup.remove());
  popup.querySelector('#map-add-confirm').addEventListener('click', async () => {
    const label = popup.querySelector('#map-add-label').value.trim();
    if (!label) { alert('Vul een naam in.'); return; }
    if (!_pickedImageId) { alert('Kies een afbeelding.'); return; }
    try {
      const map = await api.createMap({ label, imageId: _pickedImageId });
      popup.remove();
      await renderKaart();
      // Switch to new map
      currentMapIdx = MAPS.findIndex(m => m.id === map.id);
      if (currentMapIdx < 0) currentMapIdx = MAPS.length - 1;
      await renderKaart();
    } catch (e) { alert('Fout: ' + e.message); }
  });
}

// ── DM: kaart hernoemen ──
function _openMapRenamer() {
  const map = MAPS[currentMapIdx];
  const titleEl = document.getElementById('map-title');
  if (!titleEl) return;

  const old = map.label;
  titleEl.innerHTML = `<input id="map-rename-input" class="font-cinzel font-bold text-gold text-lg tracking-widest bg-transparent border-b border-gold-dim outline-none w-36 text-center"
    value="${esc(old)}">`;
  const input = document.getElementById('map-rename-input');
  input.focus();
  input.select();

  const save = async () => {
    const label = input.value.trim() || old;
    map.label = label;
    titleEl.textContent = label;
    if (label !== old) {
      try { await api.updateMap(map.id, { label }); } catch { /* ignore */ }
    }
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = old; input.blur(); }
  });
}

// ── Fly to pin ──
function _flyToPin(locId) {
  const pin = mapPins.find(p => p.locId === locId);
  if (!pin) return;

  const img = document.getElementById('map-img');
  if (!img) return;

  const doFly = () => {
    // Use rAF so layout (zoom/resize from _initZoom) is fully settled
    requestAnimationFrame(() => {
      const scroll  = document.getElementById('map-scroll');
      const wrapper = document.getElementById('map-wrapper');
      if (!scroll || !wrapper) return;

      // Pin pixel coordinates within the map image
      const imgW   = img.clientWidth;
      const imgH   = img.clientHeight;
      const pinPxX = (pin.x / 100) * imgW;
      const pinPxY = (pin.y / 100) * imgH;

      // Natural (panX=0, panY=0) position of the wrapper's top-left corner
      // relative to the scroll viewport, accounting for the current transform.
      const wrapRect   = wrapper.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      // Remove the current pan offset to get the natural position
      const natLeft = wrapRect.left - scrollRect.left - panX;
      const natTop  = wrapRect.top  - scrollRect.top  - panY;

      // Set pan so the pin is centred in the scroll viewport
      panX = scroll.clientWidth  / 2 - natLeft - pinPxX;
      panY = scroll.clientHeight / 2 - natTop  - pinPxY;

      _applyPan();

      // Highlight the pin with a brief pulse
      const pinEl = document.querySelector(`.map-pin[data-loc-id="${CSS.escape(locId)}"]`);
      if (pinEl) {
        pinEl.classList.add('pin-fly-highlight');
        setTimeout(() => pinEl.classList.remove('pin-fly-highlight'), 2800);
      }
    });
  };

  if (img.complete && img.naturalWidth) {
    doFly();
  } else {
    img.addEventListener('load', doFly, { once: true });
  }
}

// ── DM: kaart verwijderen ──
async function _deleteCurrentMap() {
  const map = MAPS[currentMapIdx];
  if (map.src) { alert('Ingebouwde kaarten kunnen niet worden verwijderd.'); return; }
  const pins = mapPins.length;
  if (!confirm(`Kaart "${map.label}" verwijderen${pins ? ` (inclusief ${pins} pin${pins > 1 ? 's' : ''})` : ''}?`)) return;
  try {
    await api.deleteMap(map.id);
    currentMapIdx = Math.max(0, currentMapIdx - 1);
    await renderKaart();
  } catch (e) { alert('Fout: ' + e.message); }
}
