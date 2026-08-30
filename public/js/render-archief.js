import { api } from './api.js?v=243';

// icon() helper is defined globally in app.js; grab a local alias for template use.
const icon = (...a) => window.icon(...a);

// Track shift key globally — more reliable than event.shiftKey in inline handlers
window._shiftHeld = false;
document.addEventListener('keydown', e => { if (e.key === 'Shift') window._shiftHeld = true; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') window._shiftHeld = false; });

const CATEGORIES = [
  { key: 'alle', label: 'Alle', icon: '' },
  { key: 'brieven', label: 'Brieven & Documenten', icon: '\ud83d\udcdc' },
  { key: 'pers', label: 'Gedrukte Pers', icon: '\ud83d\uddde' },
  { key: 'kaarten', label: 'Kaarten', icon: '\ud83d\uddfa' },
  { key: 'codex', label: 'Codex & Emblema', icon: '\ud83d\udd0f' },
  { key: 'audio', label: 'Geluid', icon: '\ud83c\udfb5' },
];

const DOC_TYPES = ['Brief','Krant','Kaart','Manuscript','Kasboek','Notities','Folder','Gebed','Blauwdruk','Embleem','Visitekaartje','Gedicht','Dreigbrief','Catalogus','Menu','Stadskaart','Wereldkaart','Dungeon map','Audiofragment','Overig'];
const DOC_CATS = ['brieven','pers','kaarten','codex','logboek','audio'];

let activeCat = 'alle';
let logboekSearch = '';
let _logboekInitialized = false;
let _collapsedChapters = new Set();
let _logboekCache = null;
let _logboekActiveTab = 'verslagen'; // 'verslagen' | 'quests'
let searchQuery = '';
let archiefData = { documents: [], logEntries: [], hiddenLinks: {}, tekstContent: {} };
let meta = null;

// ── Regie-script state per akte ──
let _scriptPickerState = {}; // { [ch]: { mode: null|'image'|'entity'|'encounter', entityType, entityQuery, entities, encounters } }
let _scriptOpenChapters = new Set(); // welke aktes hun script-panel open hebben
let _scriptSoundOpen   = new Set();  // script-item-ids met geopende geluidskiezer
let _scriptScenesCache = undefined;  // ambiance-scènes (lazy geladen)

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const isDM = () => window.app.isDM();
const esc = (...a) => window.app.esc(...a);
const escJS = (...a) => window.app.escJS(...a);
const mdToHtml = (...a) => window.app.mdToHtml(...a);
const openModal = (...a) => window.app.openModal(...a);
const closeModal = (...a) => window.app.closeModal(...a);
const openLightbox = (...a) => window.app.openLightbox(...a);

// Navigeer vanuit een naam-chip naar het bijbehorende kaartje of document
const FIELD_TO_SECTION = { npcs: 'personages', locs: 'locaties', orgs: 'organisaties', items: 'voorwerpen' };
const FIELD_TO_TYPE    = { npcs: 'personages', locs: 'locaties', orgs: 'organisaties', items: 'voorwerpen' };

window._archiefLinkClick = async (field, name) => {
  const type = FIELD_TO_TYPE[field];
  if (!type) return;
  let list = [];
  try { list = await api.listEntities(type); } catch { return; }
  const entity = list.find(e => e.name === name);
  if (!entity) return;

  // Huidige context opslaan als back-item zodat de terugknop werkt
  const currentDocId    = window._currentArchiefDocId;
  const currentSessieId = window._currentArchiefSessieId;
  if (currentDocId) {
    window._modalHistory?.push({ type: 'archief', id: currentDocId });
  } else if (currentSessieId) {
    window._modalHistory?.push({ type: 'sessie', id: currentSessieId });
  } else if (window._currentDetailId) {
    window._modalHistory?.push({ tab: window._currentDetailTab, id: window._currentDetailId });
  }

  // Terugknop zichtbaar maken (history is net gevuld)
  const backBtn = document.getElementById('m-back');
  if (backBtn) backBtn.classList.remove('hidden');
  window._openDetail?.(type, entity.id, true /* isBack=true zodat history niet nogmaals wordt opgebouwd */);
};

function _sortKey(name) {
  return (name || '').replace(/^(de|het|'t)\s+/i, '').trim();
}

const _FMT_KLEUREN = [
  { naam: 'rood',   hex: '#e05555' },
  { naam: 'groen',  hex: '#5aaa6a' },
  { naam: 'blauw',  hex: '#5b8fd4' },
  { naam: 'goud',   hex: '#c4a840' },
  { naam: 'paars',  hex: '#a070cc' },
  { naam: 'oranje', hex: '#e08840' },
  { naam: 'grijs',  hex: '#888888' },
];

function fmtToolbar(id) {
  const kleurOpties = _FMT_KLEUREN.map(k =>
    `<option value="${k.naam}" style="background:#1a1410;color:${k.hex}">${k.naam}</option>`
  ).join('');
  return `<div class="fmt-toolbar">
    <button type="button" title="Vet (Ctrl+B)" onclick="window._fmt('${id}','**')"
      class="fmt-btn fmt-btn-b">B</button>
    <button type="button" title="Cursief (Ctrl+I)" onclick="window._fmt('${id}','*')"
      class="fmt-btn fmt-btn-i">I</button>
    <button type="button" title="Onderstreept" onclick="window._fmt('${id}','__')"
      class="fmt-btn fmt-btn-u">U</button>
    <button type="button" title="Doorhalen" onclick="window._fmt('${id}','~~')"
      class="fmt-btn fmt-btn-s">S</button>
    <button type="button" title="Markering" onclick="window._fmt('${id}','==')"
      class="fmt-btn fmt-btn-mark">▌</button>
    <button type="button" title="Kleine kapitalen" onclick="window._fmt('${id}','^')"
      class="fmt-btn fmt-btn-sc">Sc</button>
    <div class="fmt-toolbar-sep"></div>
    <div class="fmt-kleur-wrap">
      <select class="fmt-kleur-select" id="fmt-kleur-${id}"
        onchange="window._fmtKleurSelect('${id}', this)">
        <option value="">🎨 kleur</option>
        ${kleurOpties}
      </select>
      <span class="fmt-kleur-dot" id="fmt-kleur-dot-${id}"></span>
    </div>
    <div class="fmt-toolbar-sep"></div>
    <button type="button" title="Horizontale lijn" onclick="window._fmtHr('${id}')"
      class="fmt-btn fmt-btn-hr">—</button>
  </div>`;
}

export function initArchief() {}

export async function renderDocumenten() {
  const container = $('#section-documenten');
  try {
    archiefData = await api.listArchief();
    meta = window.app.state.meta;
  } catch { /* empty */ }

  const docs = filterDocs();

  // Only build the toolbar on first render; subsequent calls just refresh the grid
  const existingGrid = container.querySelector('.doc-grid');
  if (existingGrid) {
    _refreshDocGrid(docs, container);
    return;
  }

  container.innerHTML = `
    <!-- Section banner -->
    <div class="section-banner section-banner--entity section-banner--documenten">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('scroll-text')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Documenten</div>
          <div class="section-banner-desc-line">Brieven, kranten, kaarten en manuscripten</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">\u2315</span>
            <input type="text" class="sbs-input search-input"
              placeholder="Zoek document\u2026" value="${esc(searchQuery)}" oninput="window._documentenSearch(this.value)">
          </div>
          <span class="results-count sbs-count" id="doc-results-count">${docs.length} resultaten</span>
          ${window._helpBtn?.('documenten') ?? ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.app.onFabClick()" title="Nieuw document">${icon('plus')}</button>` : ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">\u25c6</span></div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="doc-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"></div>
    </div>
  `;

  _refreshDocGrid(docs, container);

  window._documentenSearch = (q) => {
    searchQuery = q;
    const filtered = filterDocs();
    _refreshDocGrid(filtered, container);
    const cnt = container.querySelector('#doc-results-count');
    if (cnt) cnt.textContent = `${filtered.length} resultaten`;
  };
}

// Schaalt de kaartnaam terug tot hij op één regel past (gelijk aan render-campagne).
function _fitTextDoc(el) {
  el.style.fontSize = '';
  if (el.scrollWidth <= el.clientWidth) return;
  for (let size = 13; size >= 9; size--) {
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= el.clientWidth) break;
  }
}

function _refreshDocGrid(docs, container) {
  const grid = container.querySelector('.doc-grid');
  if (!grid) return;
  const totalDocs = (archiefData.documents || []).length;
  grid.innerHTML = docs.length === 0
    ? `<div class="col-span-full text-center py-20 text-ink-faint">
        <div class="text-5xl mb-4 opacity-40">${icon('scroll-text')}</div>
        <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">
          ${searchQuery || totalDocs > 0 ? 'Geen documenten gevonden' : 'Het archief is nog leeg...'}
        </div>
        ${!searchQuery && totalDocs === 0 && isDM()
          ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om een document toe te voegen</div>`
          : ''}
       </div>`
    : docs.map(d => renderDocCard(d)).join('');
  // Namen passend maken (zelfde gedrag als de andere entity-kaarten)
  requestAnimationFrame(() => grid.querySelectorAll('[data-fittext]').forEach(_fitTextDoc));
  const countEl = container.querySelector('.results-count');
  if (countEl) countEl.textContent = `${docs.length} resultaten`;
  requestAnimationFrame(() => window._attachCardTilt?.(grid));
}

export async function renderLogboek() {
  const container = $('#section-logboek');

  // Sync active tab from global (set by dropdown in app.js or socket-handler)
  if (window._logboekActiveTab) _logboekActiveTab = window._logboekActiveTab;

  try {
    archiefData = await api.listArchief();
    meta = window.app.state.meta;
  } catch { /* empty */ }

  const allEntries = archiefData.sessieLog || [];
  const visibleEntries = isDM() ? allEntries : allEntries.filter(e => e.visible);
  const hk = meta?.hoofdstukken || {};

  _logboekCache = { allEntries: visibleEntries, hk };

  if (!_logboekInitialized) {
    const chapterKeys = [...new Set(visibleEntries.map(e => e.hoofdstuk || '_'))];
    const sorted = chapterKeys.sort((a, b) => (hk[a]?.num || 99) - (hk[b]?.num || 99));
    sorted.slice(0, -1).forEach(k => _collapsedChapters.add(k));
    _logboekInitialized = true;
  }

  // Build static skeleton on first render (geen subtabbalk — navigatie via dropdown in header)
  if (!container.querySelector('#logboek-tab-content')) {
    container.innerHTML = `
      <div style="display:flex;justify-content:flex-end;padding:6px 12px 0">
        ${window._helpBtn?.('logboek') ?? ''}
      </div>
      <div id="logboek-tab-content" class="flex-1 overflow-y-auto"></div>`;
  }

  const tabContent = container.querySelector('#logboek-tab-content');
  if (!tabContent) return;

  if (_logboekActiveTab === 'quests') {
    tabContent.style.cssText = '';
    await _renderPrikbord(container);
    return;
  }

  if (_logboekActiveTab === 'prikbord') {
    tabContent.style.cssText = 'flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column;';
    tabContent.innerHTML = `<div id="pb-relatiemap-container" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;"></div>`;
    const { renderRelatiemap } = await import('./render-relatiemap.js?v=16');
    await renderRelatiemap(document.getElementById('pb-relatiemap-container'));
    return;
  }

  // Verslagen tab
  tabContent.style.cssText = '';
  tabContent.innerHTML = `
    <div class="logboek-search-wrap" style="padding: 0 24px 8px">
      ${icon('search', { cls: 'logboek-search-icon' })}
      <input type="text" class="logboek-search-input" id="logboek-search-input"
        placeholder="Zoek in het logboek…" value="${esc(logboekSearch)}"
        oninput="window._logboekSearch(this.value)"${isDM() ? ' style="padding-right:46px"' : ''}>
      ${isDM() ? `<button class="sbs-add-btn" onclick="window.app.onFabClick()" title="Nieuwe log-entry" style="position:absolute;right:30px;top:50%;transform:translateY(-50%)">${icon('plus')}</button>` : ''}
    </div>
    <div class="flex-1 overflow-y-auto px-6 pb-6" id="logboek-body">
      ${_buildLogboekBody(visibleEntries, hk)}
    </div>
  `;

  window._logboekSearch = (q) => {
    logboekSearch = q;
    const body = document.getElementById('logboek-body');
    if (body && _logboekCache) {
      const filtered = q.trim()
        ? _logboekCache.allEntries.filter(e => _logboekMatchesSearch(e, q.toLowerCase()))
        : _logboekCache.allEntries;
      body.innerHTML = _buildLogboekBody(filtered, _logboekCache.hk, !!q.trim());
    }
  };

  window._toggleChapter = (chKey) => {
    if (_collapsedChapters.has(chKey)) _collapsedChapters.delete(chKey);
    else _collapsedChapters.add(chKey);
    const body = document.getElementById('logboek-body');
    if (body && _logboekCache) {
      const q = logboekSearch;
      const entries = q.trim()
        ? _logboekCache.allEntries.filter(e => _logboekMatchesSearch(e, q.toLowerCase()))
        : _logboekCache.allEntries;
      body.innerHTML = _buildLogboekBody(entries, _logboekCache.hk, !!q.trim());
    }
  };

  window._toggleScriptPanel = (chKey) => {
    if (_scriptOpenChapters.has(chKey)) _scriptOpenChapters.delete(chKey);
    else _scriptOpenChapters.add(chKey);
    const body = document.getElementById('logboek-body');
    if (body && _logboekCache) {
      const q = logboekSearch;
      const entries = q.trim()
        ? _logboekCache.allEntries.filter(e => _logboekMatchesSearch(e, q.toLowerCase()))
        : _logboekCache.allEntries;
      body.innerHTML = _buildLogboekBody(entries, _logboekCache.hk, !!q.trim());
    }
    // Scroll het script-panel in beeld
    if (_scriptOpenChapters.has(chKey)) {
      setTimeout(() => {
        document.getElementById(`logboek-script-section-${chKey}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  };
}

// Deterministische rotatie op basis van quest-id (consistent over renders)
function _questRot(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return ((h % 9) - 4) * 0.55; // −2.2° … +2.2°
}

async function _renderPrikbord(container) {
  const isDm = isDM();

  let quests = [];
  try { quests = await api.listQuests(); } catch { quests = []; }

  let facties = [];
  try { const fd = await api.getFacties(); facties = (fd.facties || []).filter(f => (f.rang?.index ?? 0) > 0); } catch {}

  const hk = meta?.hoofdstukken || {};

  const visibleQuests = isDm ? quests : quests.filter(q => q.status !== 'verborgen');

  // Verborgen staat links — de →-knop werkt dan van links naar rechts
  const cols = [
    ...(isDm ? [{ key: 'verborgen',     label: `${icon('lock')} Verborgen` }] : []),
    { key: 'actief',        label: `${icon('pin')} Beschikbaar` },
    ...(isDm ? [{ key: 'aangevraagd',   label: `${icon('clock')} Aangevraagd` }] : []),
    { key: 'in-uitvoering', label: `${icon('swords')} In uitvoering` },
    { key: 'voltooid',      label: `${icon('check')} Voltooid` },
    { key: 'mislukt',       label: `${icon('x')} Mislukt` },
  ];

  // Volgorde voor de →-knop
  const STATUS_CYCLE = ['verborgen', 'actief', 'aangevraagd', 'in-uitvoering', 'voltooid', 'mislukt'];

  const questCard = (q, col) => {
    const chLabel    = q.chapter && hk[q.chapter] ? hk[q.chapter].short : '';
    const rot        = _questRot(q.id);
    const showDesc   = q.description && col.key === 'actief';
    const cycleIdx   = STATUS_CYCLE.indexOf(q.status);
    const hasNext    = cycleIdx >= 0 && cycleIdx < STATUS_CYCLE.length - 1;
    const clickHandler = isDm
      ? `window._questEdit('${q.id}')`
      : (q.description ? `window._questViewPlayer('${q.id}')` : '');
    return `
      <div class="quest-card quest-card--${q.status}${q.status === 'verborgen' ? ' quest-card--hidden' : ''}${!isDm && q.description ? ' quest-card--clickable' : ''}"
           style="transform:rotate(${rot}deg)"
           onclick="${clickHandler}">
        ${isDm ? `
          <div class="quest-card-actions">
            ${hasNext ? `<button class="quest-card-btn" onclick="event.stopPropagation();window._questStatusNext('${q.id}')" title="Volgende kolom">→</button>` : ''}
            <button class="quest-card-btn" onclick="event.stopPropagation();window._questDelete('${q.id}')" title="Verwijderen">${icon('x')}</button>
          </div>
        ` : ''}
        <div class="quest-card-title">${q.title.replace(/</g,'&lt;')}</div>
        ${showDesc ? `<div class="quest-card-desc">${q.description.replace(/</g,'&lt;')}</div>` : ''}
        ${chLabel ? `<div class="quest-card-chapter">${chLabel.replace(/</g,'&lt;')}</div>` : ''}
        ${q.factieId ? `<div class="quest-card-factie">${icon('landmark')} Factie-missie</div>` : ''}
      </div>`;
  };

  const bodyEl = container.querySelector('#logboek-tab-content');
  if (!bodyEl) return;

  const _factieBandOpen = (() => { try { return localStorage.getItem('factieBandOpen') === '1'; } catch { return false; } })();
  const factieBand = facties.length ? `
    <details class="factie-band-details" ${_factieBandOpen ? 'open' : ''} ontoggle="window._factieBandToggle && window._factieBandToggle(this.open)">
      <summary class="factie-band-summary">
        <span class="factie-band-summary-titel">${icon('landmark')} Facties &amp; aanzien</span>
        <span class="factie-band-chips">
          ${facties.map(f => `<span class="factie-band-chip factie-band-chip--${(f.stijl || '').replace(/[^a-z]/gi, '').toLowerCase()}">${esc(f.naam || '')}: <strong>${esc(f.rang?.naam || '—')}</strong></span>`).join('')}
        </span>
      </summary>
    <div class="factie-band">
      ${facties.map(f => {
        const stijl = (f.stijl || '').replace(/[^a-z]/gi, '').toLowerCase();
        const rungs = (f.ladder || []).slice().reverse();
        return `
        <div class="factie-ladder factie-ladder--${stijl}">
          <div class="factie-ladder-head">
            <span class="factie-ladder-embleem">${icon(/^[a-z0-9-]+$/.test(f.embleem || '') ? f.embleem : 'landmark')}</span>
            <span class="factie-ladder-naam">${esc(f.naam || '')}</span>
            <span class="factie-ladder-rang">${esc(f.rang?.naam || '')}</span>
          </div>
          <div class="factie-ladder-rungs">
            ${rungs.map(r => `
              <div class="factie-rung ${r.bereikt ? 'factie-rung--bereikt' : 'factie-rung--locked'} ${r.huidig ? 'factie-rung--huidig' : ''}">
                <span class="factie-rung-naam">${r.bereikt ? '' : icon('lock') + ' '}${esc(r.naam || '')}${r.titel ? ` <span class="factie-rung-titel">${icon('star')} ${esc(r.titel)}</span>` : ''}</span>
                ${(r.boons || []).map(b => `<span class="factie-rung-boon" title="${esc(b.tekst || '')}">${esc(b.icoon || '•')} ${esc(b.naam || '')}</span>`).join('')}
              </div>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    </details>` : '';

  bodyEl.innerHTML = `
    <div class="prikbord">
      ${cols.map(col => `
        <div class="prikbord-col prikbord-col--${col.key}">
          <div class="prikbord-col-header">
            <span>${col.label}</span>
            <span class="prikbord-col-count">${visibleQuests.filter(q => q.status === col.key).length}</span>
          </div>
          <div class="prikbord-col-cards">
            ${visibleQuests.filter(q => q.status === col.key).map(q => questCard(q, col)).join('')}
          </div>
          ${isDm ? `
            <button class="prikbord-add-btn" onclick="window._questNew('${col.key}')">+ Missie toevoegen</button>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ${factieBand}
  `;

  window._factieBandToggle = (open) => { try { localStorage.setItem('factieBandOpen', open ? '1' : '0'); } catch { /* ok */ } };
  window._questNew    = (status) => _openQuestModal(null, status);
  window._questEdit   = (id) => { const q = quests.find(x => x.id === id); if (q) _openQuestModal(q); };
  window._questDelete = async (id) => {
    if (!confirm('Missie verwijderen?')) return;
    try { await api.deleteQuest(id); await renderLogboek(); } catch {}
  };
  // Vooruit: verborgen → actief → voltooid → mislukt (stopt, geen cirkel terug)
  window._questStatusNext = async (id) => {
    const q = quests.find(x => x.id === id);
    if (!q) return;
    const idx = STATUS_CYCLE.indexOf(q.status);
    if (idx < 0 || idx >= STATUS_CYCLE.length - 1) return; // al op mislukt
    const next = STATUS_CYCLE[idx + 1];
    try { await api.updateQuest(id, { status: next }); await renderLogboek(); } catch {}
  };

  // Speler: read-only missiedetail openen
  window._questViewPlayer = (id) => {
    const q = quests.find(x => x.id === id);
    if (!q) return;
    document.getElementById('quest-view-overlay')?.remove();
    const chLabel = q.chapter && hk[q.chapter] ? hk[q.chapter].short : '';
    const statusLabel = q.status === 'voltooid' ? icon('check')+' Voltooid' : q.status === 'mislukt' ? icon('x')+' Mislukt' : icon('pin')+' Actief';
    const overlay = document.createElement('div');
    overlay.id = 'quest-view-overlay';
    overlay.className = 'quest-modal-overlay';
    overlay.innerHTML = `
      <div class="quest-modal quest-view-modal" onclick="event.stopPropagation()">
        <div class="quest-view-status quest-view-status--${q.status}">${statusLabel}</div>
        <div class="quest-modal-title">${q.title.replace(/</g,'&lt;')}</div>
        ${chLabel ? `<div class="quest-view-chapter">${icon('book-open')} ${chLabel.replace(/</g,'&lt;')}</div>` : ''}
        ${q.description ? `<div class="quest-view-desc">${q.description.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}
        <div class="quest-modal-actions">
          <button class="dm-btn dm-btn-ghost" onclick="document.getElementById('quest-view-overlay').remove()">Sluiten</button>
        </div>
      </div>`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };
}

async function _openQuestModal(existingQuest, defaultStatus = 'verborgen') {
  document.getElementById('quest-modal-overlay')?.remove();
  const hk = meta?.hoofdstukken || {};
  const chOptions = Object.entries(hk)
    .sort(([,a],[,b]) => (a.num || 0) - (b.num || 0))
    .map(([k,v]) => `<option value="${k}" ${existingQuest?.chapter === k ? 'selected' : ''}>${(v.short || k).replace(/</g,'&lt;')}</option>`)
    .join('');

  // Laad facties voor de koppeling
  let factieOpties = '<option value="">— geen factie —</option>';
  try {
    const fd = await api.getFacties();
    factieOpties += (fd.facties || []).map(f =>
      `<option value="${f.id}" ${existingQuest?.factieId === f.id ? 'selected' : ''}>${f.naam}</option>`
    ).join('');
  } catch {}

  const overlay = document.createElement('div');
  overlay.id = 'quest-modal-overlay';
  overlay.className = 'quest-modal-overlay';
  overlay.innerHTML = `
    <div class="quest-modal" onclick="event.stopPropagation()">
      <div class="quest-modal-title">${existingQuest ? 'Missie bewerken' : 'Nieuwe missie'}</div>
      <div class="quest-modal-row">
        <label class="quest-modal-label">Titel</label>
        <input id="qm-title" class="dm-input" value="${(existingQuest?.title || '').replace(/"/g,'&quot;')}" placeholder="Missietitel…">
      </div>
      <div class="quest-modal-row">
        <label class="quest-modal-label">Omschrijving</label>
        <textarea id="qm-desc" class="dm-textarea" rows="3" placeholder="Korte omschrijving…">${existingQuest?.description || ''}</textarea>
      </div>
      <div class="quest-modal-row">
        <label class="quest-modal-label">Status</label>
        <select id="qm-status" class="dm-select">
          <option value="verborgen"     ${(existingQuest?.status ?? defaultStatus) === 'verborgen'     ? 'selected':''}>Verborgen (alleen DM)</option>
          <option value="actief"        ${(existingQuest?.status ?? defaultStatus) === 'actief'        ? 'selected':''}>Beschikbaar voor spelers</option>
          <option value="aangevraagd"   ${(existingQuest?.status ?? defaultStatus) === 'aangevraagd'   ? 'selected':''}>Aangevraagd</option>
          <option value="in-uitvoering" ${(existingQuest?.status ?? defaultStatus) === 'in-uitvoering' ? 'selected':''}>In uitvoering</option>
          <option value="voltooid"      ${(existingQuest?.status ?? defaultStatus) === 'voltooid'      ? 'selected':''}>Voltooid</option>
          <option value="mislukt"       ${(existingQuest?.status ?? defaultStatus) === 'mislukt'       ? 'selected':''}>Mislukt</option>
        </select>
      </div>
      <div class="quest-modal-row">
        <label class="quest-modal-label">Akte</label>
        <select id="qm-chapter" class="dm-select">
          <option value="">— geen akte —</option>
          ${chOptions}
        </select>
      </div>
      <hr style="border:none;border-top:1px solid rgba(196,168,122,0.3);margin:8px 0">
      <div class="quest-modal-row">
        <label class="quest-modal-label">Factie</label>
        <select id="qm-factie" class="dm-select">${factieOpties}</select>
      </div>
      <div id="qm-factie-velden" style="${existingQuest?.factieId ? '' : 'display:none'}">
        <div class="quest-modal-row">
          <label class="quest-modal-label">Vereist renown</label>
          <input id="qm-vereist-renown" class="dm-input" type="number" min="0" style="width:80px"
            value="${existingQuest?.vereistRenown ?? 0}">
        </div>
        <div class="quest-modal-row">
          <label class="quest-modal-label">Renown-beloning</label>
          <input id="qm-renown-beloning" class="dm-input" type="number" min="0" style="width:80px"
            value="${existingQuest?.renownBeloning ?? 1}">
        </div>
        <div class="quest-modal-row" style="gap:6px">
          <label class="quest-modal-label">Valuta-beloning</label>
          <input id="qm-valuta-fl" class="dm-input" type="number" min="0" style="width:60px" placeholder="fl"
            value="${existingQuest?.valuta?.fl ?? ''}">
          <input id="qm-valuta-kn" class="dm-input" type="number" min="0" style="width:60px" placeholder="kn"
            value="${existingQuest?.valuta?.kn ?? ''}">
          <input id="qm-valuta-cl" class="dm-input" type="number" min="0" style="width:60px" placeholder="cl"
            value="${existingQuest?.valuta?.cl ?? ''}">
        </div>
      </div>
      <div class="quest-modal-actions">
        <button class="dm-btn dm-btn-ghost" onclick="document.getElementById('quest-modal-overlay').remove()">Annuleren</button>
        <button class="dm-btn dm-btn-primary" onclick="window._questSave('${existingQuest?.id || ''}')">Opslaan</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  document.getElementById('qm-title')?.focus();

  // Toon/verberg factie-velden bij wijziging factie-select
  document.getElementById('qm-factie')?.addEventListener('change', (e) => {
    document.getElementById('qm-factie-velden').style.display = e.target.value ? '' : 'none';
  });

  window._questSave = async (id) => {
    const title         = document.getElementById('qm-title')?.value.trim();
    const desc          = document.getElementById('qm-desc')?.value.trim();
    const status        = document.getElementById('qm-status')?.value || 'actief';
    const chapter       = document.getElementById('qm-chapter')?.value || '';
    const factieId      = document.getElementById('qm-factie')?.value || null;
    const vereistRenown = parseInt(document.getElementById('qm-vereist-renown')?.value) || 0;
    const renownBeloning = parseInt(document.getElementById('qm-renown-beloning')?.value) || 0;
    const fl = parseInt(document.getElementById('qm-valuta-fl')?.value) || 0;
    const kn = parseInt(document.getElementById('qm-valuta-kn')?.value) || 0;
    const cl = parseInt(document.getElementById('qm-valuta-cl')?.value) || 0;
    const valuta = (fl || kn || cl) ? { fl, kn, cl } : null;
    if (!title) { alert('Vul een titel in.'); return; }
    const payload = { title, description: desc, status, chapter,
      factieId: factieId || null, vereistRenown, renownBeloning, valuta };
    try {
      if (id) await api.updateQuest(id, payload);
      else    await api.createQuest(payload);
      document.getElementById('quest-modal-overlay')?.remove();
      await renderLogboek();
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
  };
}

function _logboekMatchesSearch(e, q) {
  return [
    e.korteSamenvatting, e.samenvatting, e.citaat,
    ...(e.nieuwPersonages || []), ...(e.terugkerendPersonages || []),
    ...(e.nieuwLocaties || []), ...(e.terugkerendLocaties || []),
    ...(e.organisaties || []), ...(e.voorwerpen || []),
  ].some(f => f?.toLowerCase().includes(q));
}

function _buildChapterImgStrip(chEntries, ch) {
  const imgs = [];
  for (const e of chEntries) {
    for (const img of (e.images || [])) {
      const isVisible = typeof img === 'string' || img.visible !== false;
      if (!isDM() && !isVisible) continue;
      const id = typeof img === 'string' ? img : img.id;
      const hidden = typeof img !== 'string' && img.visible === false;
      imgs.push({ id, sessieId: e.id, title: e.korteSamenvatting || '', hidden });
    }
  }
  if (imgs.length === 0) return '';
  const stripId = `img-strip-${esc(ch)}`;

  // Sla de afbeeldingsreeks op zodat de lightbox er doorheen kan bladeren
  const setKey = `_lbStrip_${ch}`;
  window[setKey] = imgs.map(img => ({ src: api.fileUrl(img.id), title: img.title }));

  return `
    <div class="logboek-img-strip-wrap">
      <button class="logboek-img-strip-arrow logboek-img-strip-arrow--left"
        onclick="event.stopPropagation();document.getElementById('${stripId}').scrollBy({left:-200,behavior:'smooth'})"
        aria-label="Naar links">&#8249;</button>
      <div class="logboek-img-strip" id="${stripId}">
        ${imgs.map((img, i) => `
          <button class="logboek-img-strip-thumb${img.hidden ? ' logboek-img-strip-thumb--hidden' : ''}"
            onclick="event.stopPropagation();window.app.openLightboxAt(window['${setKey}'],${i})"
            title="${esc(img.title)}">
            <img src="${api.thumbUrl(img.id)}" loading="lazy" class="logboek-img-strip-img"
              onerror="this.closest('.logboek-img-strip-thumb').style.display='none'">
            ${img.hidden ? '<span class="logboek-img-strip-hidden-badge">' + icon('lock') + '</span>' : ''}
          </button>`).join('')}
      </div>
      <button class="logboek-img-strip-arrow logboek-img-strip-arrow--right"
        onclick="event.stopPropagation();document.getElementById('${stripId}').scrollBy({left:200,behavior:'smooth'})"
        aria-label="Naar rechts">&#8250;</button>
    </div>`;
}

function _buildLogboekBody(entries, hk, isSearchMode = false) {
  if (entries.length === 0) {
    return `<div class="text-center py-20 text-ink-faint">
      <div class="logboek-empty-icon mb-4 opacity-40">${icon('book-open')}</div>
      <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">
        ${logboekSearch ? 'Geen resultaten gevonden.' : 'Het archief is nog leeg...'}
      </div>
      ${!logboekSearch && isDM() ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om een hoofdstuk toe te voegen</div>` : ''}
    </div>`;
  }

  if (isSearchMode) {
    return `<div class="logboek-search-results">
      ${entries.map(e => {
        const ch = hk[e.hoofdstuk];
        const chLabel = ch ? `A${ch.num}: ${ch.title}` : '';
        return renderSessieEntry(e, null, chLabel);
      }).join('')}
    </div>`;
  }

  const groups = {};
  for (const e of entries) {
    const ch = e.hoofdstuk || '_';
    if (!groups[ch]) groups[ch] = [];
    groups[ch].push(e);
  }
  const sortedChapters = Object.keys(groups).sort((a, b) => (hk[a]?.num || 99) - (hk[b]?.num || 99));

  const allDocs = archiefData.documents || [];
  const docsByChapter = {};
  for (const d of allDocs) {
    const _effectiveState = (isDM() && d._activeState !== undefined) ? d._activeState : (d.state || 'hidden');
    if (!isDM() && _effectiveState === 'hidden') continue;
    const ch = d.hoofdstuk || '_';
    if (!docsByChapter[ch]) docsByChapter[ch] = [];
    docsByChapter[ch].push(d);
  }
  for (const ch of Object.keys(docsByChapter)) {
    docsByChapter[ch].sort((a, b) => _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' }));
  }

  // DM: akte-zichtbaarheid per actieve groep
  const _cv            = archiefData.chapterVisibility || {};
  const _cvGrp         = window._activeGroupId;
  const _activeGrpName = isDM() && _cvGrp
    ? (window._groups?.find(g => g.id === _cvGrp)?.name || _cvGrp)
    : null;

  // Akte-beheer (zichtbaarheid, regie-script, bewerken) is verhuisd naar de
  // Meesterkamer → Aktes. Het Logboek is nu de schone journaal-weergave.
  let html = '';

  for (const ch of sortedChapters) {
    const info = hk[ch] || { title: ch, dag: '', num: '?' };
    const chEntries = groups[ch].slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
    const isCollapsed = _collapsedChapters.has(ch);

    const firstEntryWithImg = chEntries.find(e => (e.images || []).length > 0);
    const firstRawImg = firstEntryWithImg?.images?.[0];
    const _firstImgId = firstRawImg ? (typeof firstRawImg === 'string' ? firstRawImg : firstRawImg.id) : null;
    const bannerImgId = info.bannerImg || _firstImgId;
    const bannerImgSrc = bannerImgId ? api.fileUrl(bannerImgId) : null;

    const bannerFocusVal = info.bannerFocus || '50% 30%';
    html += `
      <div class="logboek-chapter" id="logboek-ch-${esc(ch)}">
        <div class="logboek-chapter-banner${bannerImgSrc ? ' logboek-chapter-banner--img' : ''}"
          ${bannerImgSrc ? `style="background-image:url('${bannerImgSrc}');background-position:${esc(bannerFocusVal)}"` : ''}
          onclick="window._toggleChapter('${esc(ch)}')">
          <div class="logboek-chapter-banner-overlay"></div>
          <div class="logboek-chapter-banner-content">
            <div class="logboek-chapter-num">Akte ${info.num}</div>
            <div class="logboek-chapter-title">${esc(info.title)}</div>
            ${info.dag ? `<div class="logboek-chapter-dag">${esc(info.dag)}</div>` : ''}
          </div>
          <div class="logboek-chapter-toggle-wrap">
            <div class="logboek-chapter-toggle">${isCollapsed ? '▸' : '▾'}</div>
          </div>
        </div>

        <div class="logboek-chapter-content${isCollapsed ? ' hidden' : ''}">
          ${_buildChapterImgStrip(chEntries, ch)}
          <div class="logboek-timeline">
            ${chEntries.map((e, idx) => renderSessieEntry(e, idx + 1)).join('')}
            ${(info.spelersSamenvatting || isDM()) ? _renderAkteSamenvattingCard(ch, info) : ''}
          </div>
          ${(docsByChapter[ch] || []).length ? `
          <div class="logboek-chapter-docs">
            <div class="logboek-docs-label">${icon('scroll-text')} Documenten</div>
            <div class="flex flex-wrap gap-2">
              ${(docsByChapter[ch] || []).map(d => renderDocCardCompact(d)).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
  }
  return html;
}

// ── Chip rows (used in detail modal) ──

function _logChipRow(icon, items, chipCls, clickFn) {
  if (!items.length) return '';
  return `<div class="flex flex-wrap items-center gap-1.5">
    <span class="text-[11px] font-mono text-ink-faint mr-0.5">${icon}</span>
    ${items.map(n => {
      const extra = clickFn ? clickFn(n) : {};
      return `<span class="px-2 py-0.5 text-xs rounded-full border font-crimson ${chipCls}${extra.cls || ''}" ${extra.attr || ''}>${esc(n)}</span>`;
    }).join('')}
  </div>`;
}

function _renderSessieChips(e) {
  const hasNewStructure = 'nieuwPersonages' in e || 'nieuwLocaties' in e || 'voorwerpen' in e;
  const nieuwP   = e.nieuwPersonages        || [];
  const terugP   = e.terugkerendPersonages  || [];
  const nieuwL   = e.nieuwLocaties          || [];
  const terugL   = e.terugkerendLocaties    || [];
  const items    = e.voorwerpen             || [];
  const docs     = e.docs                   || [];
  const legNieuw = !hasNewStructure ? (e.nieuw       || []) : [];
  const legTerug = !hasNewStructure ? (e.terugkerend || []) : [];

  const sections = [];

  const _pClick  = n => `data-lf="npcs"  data-ln="${esc(n)}" onclick="window._archiefLinkClick(this.dataset.lf,this.dataset.ln)"`;
  const _lClick  = n => `data-lf="locs"  data-ln="${esc(n)}" onclick="window._archiefLinkClick(this.dataset.lf,this.dataset.ln)"`;
  const _oClick  = n => `data-lf="orgs"  data-ln="${esc(n)}" onclick="window._archiefLinkClick(this.dataset.lf,this.dataset.ln)"`;
  const _iClick  = n => `data-lf="items" data-ln="${esc(n)}" onclick="window._archiefLinkClick(this.dataset.lf,this.dataset.ln)"`;

  const persChips = [
    ...nieuwP.map(n => `<span class="log-chip log-chip-gold cursor-pointer" ${_pClick(n)}>\u2728 ${esc(n)}</span>`),
    ...terugP.map(n => `<span class="log-chip log-chip-blue cursor-pointer" ${_pClick(n)}>\u21a9 ${esc(n)}</span>`),
    ...legNieuw.map(n => `<span class="log-chip log-chip-gold cursor-pointer" ${_pClick(n)}>\u2728 ${esc(n)}</span>`),
    ...legTerug.map(n => `<span class="log-chip log-chip-blue cursor-pointer" ${_pClick(n)}>\u21a9 ${esc(n)}</span>`),
  ];
  if (persChips.length) sections.push({ label: '\ud83d\udc64 Personages', chips: persChips });

  const locChips = [
    ...nieuwL.map(n => `<span class="log-chip log-chip-green-new cursor-pointer" ${_lClick(n)}>\u2728 ${esc(n)}</span>`),
    ...terugL.map(n => `<span class="log-chip log-chip-green cursor-pointer" ${_lClick(n)}>\u21a9 ${esc(n)}</span>`),
  ];
  if (locChips.length) sections.push({ label: '\ud83c\udff0 Locaties', chips: locChips });

  const orgs = e.organisaties || [];
  if (orgs.length) sections.push({
    label: '\ud83c\udfdb\ufe0f Organisaties',
    chips: orgs.map(n => `<span class="log-chip log-chip-seal cursor-pointer" ${_oClick(n)}>${esc(n)}</span>`),
  });

  if (items.length) sections.push({
    label: '\u2694\ufe0f Voorwerpen',
    chips: items.map(n => `<span class="log-chip log-chip-orange cursor-pointer" ${_iClick(n)}>${esc(n)}</span>`),
  });

  if (docs.length) sections.push({
    label: '\ud83d\udcdc Documenten',
    chips: docs.map(n => {
      const d = (archiefData.documents || []).find(x => x.name === n);
      const click = d ? `onclick="window._openDoc('${d.id}')"` : '';
      return `<span class="log-chip log-chip-purple${d ? ' cursor-pointer' : ''}" ${click}>${esc(n)}</span>`;
    }),
  });

  if (!sections.length) return '';
  return `<div class="log-chips-wrap">
    ${sections.map(s => `
      <div class="log-chip-section">
        <div class="log-chip-section-label">${s.label}</div>
        <div class="flex flex-wrap gap-1.5">${s.chips.join('')}</div>
      </div>`).join('')}
  </div>`;
}

// ── Carrousel ──

const _carouselPos   = {};
const _carouselCaptions = {};
const _carouselItems = {};  // stores full item array per key for DM controls

// Normalize images: supports legacy string[], {id,caption}[], and new {id,caption,visible}[]
function _normImages(images) {
  return images.map(img =>
    typeof img === 'string'
      ? { id: img, caption: '', visible: true }
      : { visible: true, ...img }   // default visible:true for entries without the field
  );
}

function _visBtn(cls) {
  return `text-[11px] px-2 py-0.5 rounded font-mono transition ${cls}`;
}

function _renderCarousel(key, images, opts = {}) {
  if (!images.length) return '';
  const items = _normImages(images);
  const dm = opts.dmControls || false;

  if (items.length === 1) {
    const url      = api.fileUrl(items[0].id);
    const thumbUrl = api.thumbUrl(items[0].id);
    const isVis = items[0].visible !== false;
    return `
      <div class="detail-hero mb-${dm ? 2 : 6}" onclick="window.app.openLightbox('${url}','')">
        <img src="${thumbUrl}" loading="lazy" class="detail-hero-img${!isVis && dm ? ' opacity-50' : ''}">
        <div class="detail-hero-overlay"></div>
      </div>
      ${items[0].caption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-1 mb-2 italic">${esc(items[0].caption)}</p>` : ''}
      ${dm ? `<div class="flex justify-center mb-4">
        <button id="carousel-vis-btn-${key}"
          onclick="window._toggleImageVisible('${key}','${items[0].id}',${!isVis})"
          class="${_visBtn(isVis ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright')}">
          ${isVis ? icon('eye')+' Zichtbaar voor spelers' : icon('lock')+' Verborgen voor spelers'}
        </button>
      </div>` : ''}`;
  }

  _carouselPos[key]   = 0;
  _carouselCaptions[key] = items.map(i => i.caption || '');
  _carouselItems[key] = items;

  return `
    <div class="mb-4">
      <div class="relative">
        <div class="overflow-hidden rounded">
          <div id="carousel-track-${key}" class="flex" style="transition:transform 0.3s ease">
            ${items.map(({id, visible}) => {
              const url      = api.fileUrl(id);
              const thumbUrl = api.thumbUrl(id);
              const isVis = visible !== false;
              return `<div class="flex-shrink-0 w-full flex justify-center bg-room-elevated/30 relative">
                <img src="${thumbUrl}" loading="lazy" class="max-h-[32rem] w-full object-contain cursor-pointer${!isVis && dm ? ' opacity-50' : ''}"
                  onclick="window.app.openLightbox('${url}','')">
                ${!isVis && dm ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="bg-black/60 text-ink-dim text-xs px-2 py-1 rounded font-mono">${icon('lock')} Verborgen</span>
                </div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
        <button class="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
          onclick="window._carouselStep('${key}',-1,${items.length})">\u2039</button>
        <button class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
          onclick="window._carouselStep('${key}',1,${items.length})">\u203a</button>
      </div>
      <div class="flex justify-center gap-1.5 mt-2">
        ${items.map((_, i) => `<span id="cd-${key}-${i}" onclick="window._carouselGo('${key}',${i},${items.length})"
          class="block w-2 h-2 rounded-full cursor-pointer transition ${i === 0 ? 'bg-gold' : 'bg-room-border'}"></span>`).join('')}
      </div>
      <div id="carousel-caption-${key}" class="text-center text-xs text-ink-dim font-crimson mt-1.5 italic min-h-[1.2em]">${esc(items[0].caption || '')}</div>
      ${dm ? `<div class="flex justify-center mt-2">
        <button id="carousel-vis-btn-${key}"
          onclick="window._toggleCarouselVis('${key}',${items.length})"
          class="${_visBtn(items[0].visible !== false ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright')}">
          ${items[0].visible !== false ? icon('eye')+' Zichtbaar voor spelers' : icon('lock')+' Verborgen voor spelers'}
        </button>
      </div>` : ''}
    </div>`;
}

window._carouselStep = (key, dir, total) => {
  window._carouselGo(key, ((_carouselPos[key] || 0) + dir + total) % total, total);
};
window._carouselGo = (key, idx, total) => {
  _carouselPos[key] = idx;
  const track = document.getElementById(`carousel-track-${key}`);
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`cd-${key}-${i}`);
    if (dot) dot.className = `block w-2 h-2 rounded-full cursor-pointer transition ${i === idx ? 'bg-gold' : 'bg-room-border'}`;
  }
  const capEl = document.getElementById(`carousel-caption-${key}`);
  if (capEl) capEl.textContent = (_carouselCaptions[key] || [])[idx] || '';
  // Update DM visibility button for current slide
  const items = _carouselItems[key];
  const btn = document.getElementById(`carousel-vis-btn-${key}`);
  if (btn && items) {
    const isVis = items[idx]?.visible !== false;
    btn.innerHTML = isVis ? icon('eye')+' Zichtbaar voor spelers' : icon('lock')+' Verborgen voor spelers';
    btn.className = _visBtn(isVis ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright');
    btn.onclick = () => window._toggleCarouselVis(key, total);
  }
};

// Toggle visibility of currently shown carousel slide
window._toggleCarouselVis = async (key, total) => {
  const idx   = _carouselPos[key] || 0;
  const items = _carouselItems[key];
  if (!items) return;
  const item     = items[idx];
  const newVis   = item.visible === false;
  item.visible   = newVis;
  window._carouselGo(key, idx, total); // update button
  await window._toggleImageVisible(key, item.id, newVis);
};

// Save image visibility to server and update local archiefData
window._toggleImageVisible = async (sessieId, imgId, newVisible) => {
  const entry = (archiefData.sessieLog || []).find(s => s.id === sessieId);
  if (!entry) return;
  entry.images = (entry.images || []).map(img => {
    const id = typeof img === 'string' ? img : img.id;
    return id === imgId
      ? { ...(typeof img === 'string' ? { id } : img), visible: newVisible }
      : img;
  });
  await api.updateSessieLog(sessieId, { images: entry.images });
  // Update single-image DM button (carousel case handled by _carouselGo above)
  const btn = document.getElementById(`carousel-vis-btn-${sessieId}`);
  if (btn && !_carouselItems[sessieId]) {
    btn.innerHTML = newVisible ? icon('eye')+' Zichtbaar voor spelers' : icon('lock')+' Verborgen voor spelers';
    btn.className   = _visBtn(newVisible ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright');
    btn.onclick = () => window._toggleImageVisible(sessieId, imgId, !newVisible);
  }
};

// ── Logboek card (compact) ──

function _renderAkteSamenvattingCard(ch, info) {
  const tekst = info.spelersSamenvatting || '';
  const preview = tekst ? _truncateWords(tekst.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' ').trim(), 300) : '';
  return `
    <div class="logboek-tl-entry logboek-tl-entry--h logboek-tl-entry--samenvatting"
      onclick="window._openAkteSamenvatting('${esc(ch)}')">
      <div class="logboek-tl-card logboek-tl-card--h logboek-tl-card--samenvatting">
        <div class="logboek-card-thumb logboek-card-thumb--samenvatting">
          <span class="logboek-samenvatting-icon">${icon('book-open')}</span>
        </div>
        <div class="logboek-card-hbody">
          <div class="logboek-card-hmeta">
            <span class="logboek-samenvatting-label">Spelerssamenvatting</span>
          </div>
          <h3 class="logboek-card-htitle">${esc(info.title)}</h3>
          ${tekst
            ? `<p class="logboek-card-hpreview">${preview}</p>`
            : `<p class="logboek-card-hpreview logboek-card-hpreview--leeg">Nog geen samenvatting toegevoegd.</p>`}
        </div>
      </div>
    </div>`;
}

window._openAkteSamenvatting = (ch) => {
  const hk = meta?.hoofdstukken || {};
  const info = hk[ch] || {};
  if (!info.spelersSamenvatting && !isDM()) return;
  const body = info.spelersSamenvatting
    ? `<div class="log-entry">${mdToHtml(info.spelersSamenvatting)}</div>`
    : `<div class="text-ink-faint italic text-sm">Nog geen samenvatting toegevoegd.</div>`;
  openModal(`Akte ${info.num} · ${esc(info.title)}`, 'Spelerssamenvatting', body);
};

function _truncateWords(text, maxLen) {
  // Strip [[wikilink]] markers — toon alleen de naam, geen haakjes
  const plain = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  if (plain.length <= maxLen) return esc(plain);
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return esc(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function renderSessieEntry(e, sessieNum = null, chLabel = null) {
  const images = e.images || [];
  const firstRaw = images.find(img => typeof img === 'string' || img.visible !== false);
  const firstImgId = firstRaw ? (typeof firstRaw === 'string' ? firstRaw : firstRaw.id) : null;
  const firstImg = firstImgId ? api.fileUrl(firstImgId) : null;

  const previewNames = [
    ...(e.nieuwPersonages || []).slice(0, 3),
    ...(e.nieuwLocaties || []).slice(0, 2),
  ].slice(0, 5);

  const summary = e.samenvatting
    ? _truncateWords(e.samenvatting.replace(/^#+\s*/gm, '').replace(/\n+/g, ' ').trim(), 380)
    : '';

  return `
    <div class="logboek-tl-entry logboek-tl-entry--h${isDM() && !e.visible ? ' logboek-entry--hidden' : ''}"
      onclick="window._openSessieDetail('${e.id}')">
      ${isDM() ? `
        <div class="dm-only absolute top-2 right-2 z-10 flex gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="${e.visible ? 'Verbergen' : 'Zichtbaar maken'}" onclick="event.stopPropagation();window._toggleSessieVis('${e.id}',${!!e.visible})">${e.visible ? icon('eye') : icon('lock')}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="Bewerken" onclick="event.stopPropagation();window._openSessieEditor('${e.id}')">${icon('pencil')}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="Verwijderen" onclick="event.stopPropagation();window._deleteSessie('${e.id}')">${icon('x')}</button>
        </div>
      ` : ''}
      <div class="logboek-tl-card logboek-tl-card--h">
        ${firstImg ? `
          <div class="logboek-card-thumb">
            <img src="${firstImg}" class="logboek-card-thumb-img" onerror="this.closest('.logboek-card-thumb').style.display='none'">
          </div>
        ` : `<div class="logboek-card-thumb logboek-card-thumb--empty">${icon('book-open')}</div>`}
        <div class="logboek-card-hbody">
          <div class="logboek-card-hmeta">
            ${chLabel ? `<span class="logboek-card-chapter-lbl-plain">${esc(chLabel)}</span>` : ''}
            ${e.datum ? `<span class="logboek-card-date-plain">${esc(e.datum)}</span>` : ''}
          </div>
          <h3 class="logboek-card-htitle">${esc(e.korteSamenvatting || 'Naamloos')}</h3>
          ${e.citaat ? `<p class="logboek-card-hcitaat">"${mdToHtml(e.citaat)}"</p>` : ''}
          ${summary ? `<p class="logboek-card-hpreview">${summary}</p>` : ''}
          ${previewNames.length ? `<div class="logboek-card-chips logboek-card-chips--h">
            ${previewNames.map(n => `<span class="logboek-card-chip">${esc(n)}</span>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Logboek detail modal ──

window._openSessieDetail = async (id) => {
  const e = (archiefData.sessieLog || []).find(s => s.id === id);
  if (!e) return;
  window._currentArchiefSessieId = id;
  window._currentArchiefDocId    = null;
  const hk = meta?.hoofdstukken || {};
  const chapter = hk[e.hoofdstuk] || {};
  const images = e.images || [];

  let playerNote = '';
  const playerName = window.app?.state?.playerName;
  if (!isDM() && playerName) {
    try {
      const nd = await api.getPlayerNotes(id);
      playerNote = nd?.notes?.[playerName] || '';
    } catch {}
  }

  const datelineParts = [
    chapter.short && chapter.short !== e.korteSamenvatting ? chapter.short : null,
    e.datum,
  ].filter(Boolean);

  const activeGrpName = window._groups?.find(g => g.id === window._activeGroupId)?.name;
  const body = `
    ${isDM() && e._chapterHidden && activeGrpName ? `
      <div class="dm-only logboek-modal-hidden-notice">
        ${icon('lock')} Verborgen voor <strong>${esc(activeGrpName)}</strong> — dit verslag en alle afbeeldingen hieronder zijn niet zichtbaar voor spelers van deze groep
      </div>` : ''}
    ${_renderCarousel(id, images, { dmControls: isDM() })}
    ${datelineParts.length ? `<div class="log-dateline">${datelineParts.map(p => esc(p)).join(' &mdash; ')}</div>` : ''}
    ${e.citaat ? `<blockquote class="log-detail-citaat">"${mdToHtml(e.citaat)}"</blockquote>` : ''}
    ${e.samenvatting ? `<div class="log-entry">${mdToHtml(e.samenvatting)}</div>` : ''}
    ${_renderSessieChips(e)}
    ${!isDM() && playerName ? `
      <div class="log-detail-player-note">
        <div class="log-detail-note-label">${icon('pencil')} Mijn aantekening</div>
        <textarea id="log-note-ta-${id}" class="log-detail-note-ta"
          placeholder="Jouw persoonlijke notities bij deze sessie…"
          onblur="window._saveLogNote('${esc(id)}', this.value)">${esc(playerNote)}</textarea>
      </div>
    ` : ''}
    ${isDM() ? `
      <div class="dm-only mt-4 pt-4 border-t border-room-border flex gap-2">
        <button class="px-3 py-1.5 text-sm rounded bg-gold-dim text-room-bg font-cinzel font-semibold hover:bg-gold transition"
          onclick="window.app.closeModal();window._openSessieEditor('${e.id}')" title="Bewerken">${icon('pencil')}</button>
        <button class="px-3 py-1.5 text-sm rounded bg-seal/20 text-seal hover:bg-seal/40 transition"
          onclick="window._deleteSessie('${e.id}')" title="Verwijderen">${icon('trash')}</button>
      </div>` : ''}
  `;
  const subtitle = [chapter.short, e.datum].filter(Boolean).join(' \u00b7 ');
  openModal(e.korteSamenvatting || 'Sessie', subtitle, body);

  const _accentEl = document.getElementById('m-accent');
  if (_accentEl) _accentEl.className = 'modal-accent bar-logboek';
};

window._saveLogNote = async (sessieId, text) => {
  try { await api.savePlayerNote(sessieId, text); } catch {}
};

export function openLogboekEditor(editId) {
  window._openSessieEditor(editId);
}

window._toggleSessieVis = async (id, currentVisible) => {
  await api.updateSessieLog(id, { visible: !currentVisible });
  // Werk alleen archiefData bij en herbouw de body — geen tabContent.innerHTML reset
  // (de scroll-positie blijft behouden; socket logboek:updated doet daarna een volledige refresh)
  const entry = (archiefData.sessieLog || []).find(e => e.id === id);
  if (entry) {
    entry.visible = !currentVisible;
    entry._chapterHidden = entry._chapterHidden; // ongewijzigd
  }
  const body = document.getElementById('logboek-body');
  if (body && _logboekCache) {
    // DM ziet altijd alles; update _logboekCache niet (socket doet straks een echte refresh)
    body.innerHTML = _buildLogboekBody(_logboekCache.allEntries, _logboekCache.hk);
  }
};

let logEditorTags = {
  nieuwPersonages: [], terugkerendPersonages: [],
  nieuwLocaties:   [], terugkerendLocaties:   [],
  organisaties: [], voorwerpen: [], docs: [],
};
let logAllPersonageNames  = [];
let logAllLocatieNames    = [];
let logAllOrganisatieNames = [];
let logAllVoorwerpNames   = [];
let logAllDocNames        = [];
// Image editor state: { id, url, isNew, file? }
let logEditorImages        = [];
let logEditorImagesToDelete = [];

window._addLogImages = (files) => {
  for (const file of files) {
    const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    logEditorImages.push({ id, url: URL.createObjectURL(file), isNew: true, file, caption: '', visible: false });
  }
  _refreshLogImages();
};
window._removeLogImage = (idx) => {
  const img = logEditorImages[idx];
  if (!img.isNew) logEditorImagesToDelete.push(img.id);
  else URL.revokeObjectURL(img.url);
  logEditorImages.splice(idx, 1);
  _refreshLogImages();
};
window._toggleLogImageVisible = (idx) => {
  if (logEditorImages[idx]) {
    logEditorImages[idx].visible = !logEditorImages[idx].visible;
    _refreshLogImages();
  }
};

function _refreshLogImages() {
  const c = document.getElementById('log-img-preview');
  if (!c) return;
  c.innerHTML = logEditorImages.length
    ? logEditorImages.map((img, i) => `
        <div class="flex flex-col gap-1 flex-shrink-0" style="width:5rem">
          <div class="relative w-20 h-20 rounded overflow-hidden border border-room-border bg-room-elevated">
            <img src="${img.url}" class="w-full h-full object-cover${img.visible ? '' : ' opacity-40'}">
            <button type="button" onclick="window._removeLogImage(${i})"
              class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full text-xs flex items-center justify-center transition">\u00d7</button>
            <button type="button" onclick="window._toggleLogImageVisible(${i})"
              title="${img.visible ? 'Zichtbaar — klik om te verbergen' : 'Verborgen — klik om te onthullen'}"
              class="absolute bottom-0.5 right-0.5 w-5 h-5 ${img.visible ? 'bg-gold-dim text-room-bg' : 'bg-black/70 text-ink-dim'} rounded-full text-xs flex items-center justify-center transition">
              ${img.visible ? icon('eye') : icon('lock')}</button>
          </div>
          <input type="text" placeholder="Onderschrift…" value="${esc(img.caption || '')}"
            oninput="window._updateLogImageCaption(${i}, this.value)"
            class="w-full px-1 py-0.5 text-[10px] bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>`).join('')
    : '<span class="text-xs text-ink-faint italic">Nog geen afbeeldingen</span>';
}
window._updateLogImageCaption = (idx, val) => {
  if (logEditorImages[idx]) logEditorImages[idx].caption = val;
};

window._saveNewHoofdstuk = async () => {
  const key   = document.getElementById('hk-key')?.value.trim();
  const num   = parseInt(document.getElementById('hk-num')?.value) || 99;
  const title = document.getElementById('hk-title')?.value.trim();
  const dag   = document.getElementById('hk-dag')?.value.trim() || '';
  if (!key || !title) { alert('Sleutel en titel zijn verplicht'); return; }
  const short = `A${num} \u00b7 ${title.length > 22 ? title.slice(0, 22) + '\u2026' : title}`;
  try {
    await api.saveHoofdstuk(key, { num, title, dag, short });
    // Refresh local meta
    const newMeta = await api.meta();
    meta = newMeta;
    if (window.app?.state) window.app.state.meta = newMeta;
    // Rebuild select
    const select = document.getElementById('hk-select');
    const hk = newMeta?.hoofdstukken || {};
    select.innerHTML = '<option value="">\u2014</option>' +
      Object.entries(hk).sort(([,a],[,b]) => a.num - b.num)
        .map(([k, v]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${esc(v.short)}</option>`)
        .join('');
    document.getElementById('new-hk-panel').classList.add('hidden');
  } catch (err) { alert('Fout: ' + err.message); }
};

// Toggle akte-zichtbaarheid voor de actieve groep (DM-only)
window._toggleChapterVisibility = async (ch, currentlyHidden) => {
  const groepId = window._activeGroupId;
  if (!groepId) return;
  const newVisible = currentlyHidden; // was hidden → zichtbaar, was zichtbaar → verborgen
  try {
    await api.setChapterVisibility(groepId, ch, newVisible);
    await renderLogboek();
    _akteBeheerChanged();
  } catch (err) { console.error('Chapter visibility toggle failed:', err); }
};

// Activeer regie-balk voor een akte vanuit het logboek (reveal strip niet meer nodig)
window._speelAkte = async (ch, num, title) => {
  if (!window.dmPanel) return;
  try { await api.resetChapterImages(ch); } catch (e) { console.warn('reset images failed', e); }
  window.dmPanel.closeRevealStrip?.();   // sluit de oude reveal strip als die open staat
  window.app?.setActiveAkte?.(ch, num, title);
  api.setActiveAkte(ch, num, title).catch(() => {});   // onthoud serverzijde (o.a. voor Ursula)
  const akteTitle = `Akte ${num} · ${title}`;
  window.dmPanel.regieBalkLoad(ch, akteTitle);
  _akteBeheerChanged();
};

// ── Regie-script helpers ──

function _renderAkteScript(ch, info, chEntries) {
  return `<div class="logboek-chapter-script dm-only" id="logboek-script-section-${esc(ch)}">
    ${_renderAkteScriptInner(ch, info, chEntries)}
  </div>`;
}

function _renderAkteScriptInner(ch, info, chEntries) {
  const script = info.script || [];
  const pickerState = _scriptPickerState[ch] || {};

  // Collect all images from this akte's sessions
  const seenFileIds = new Set();
  const allImages = [];
  for (const entry of chEntries) {
    for (const img of (entry.images || [])) {
      const fileId  = typeof img === 'string' ? img : img.id;
      const caption = typeof img === 'object' && img.caption ? img.caption : '';
      if (!seenFileIds.has(fileId)) {
        seenFileIds.add(fileId);
        allImages.push({ sessieId: entry.id, fileId, caption });
      }
    }
  }

  const addedFileIds    = new Set(script.filter(x => x.type === 'image').map(x => x.fileId));
  const addedEntityIds  = new Set(script.filter(x => x.type === 'entity').map(x => x.entityId));
  const addedEncIds     = new Set(script.filter(x => x.type === 'encounter').map(x => x.encounterId));
  const addedDungeonKeys= new Set(script.filter(x => x.type === 'dungeon').map(x => x.dungeonId + '|' + (x.roomId || '')));

  // Script item list
  const scriptHtml = script.length > 0
    ? script.map((item, idx) => {
        const isFirst = idx === 0, isLast = idx === script.length - 1;
        const itemIcon = item.type === 'image'
          ? icon('image')
          : item.type === 'entity'
            ? icon('eye')
            : item.type === 'dungeon'
              ? icon(item.roomId ? 'map-pin' : 'castle')
              : icon('crossed-swords', { cls: 'icon-gi' });
        // Image-stappen: inline bewerkbaar onderschrift (spelers zien dit bij een reveal).
        // Andere types tonen hun (niet-bewerkbare) entiteit-/encounter-naam.
        const nameHtml = item.type === 'image'
          ? `<input class="script-item-name script-item-name--input" value="${esc(item.caption || '')}" placeholder="Onderschrift…"
               onchange="window._scriptRename('${esc(ch)}','${esc(item.id)}',this.value)"
               onkeydown="if(event.key==='Enter'){this.blur();}">`
          : `<span class="script-item-name">${esc(item.name || '—')}</span>`;
        // Thumbnail-box met placeholder-icoon eronder: laadt de afbeelding niet (of
        // ontbreekt fileId, bv. bij een geluid-stap), dan blijft het nette icoon staan
        // i.p.v. het lelijke browser-"broken image"-vraagteken (onerror verwijdert de img).
        const thumb = item.type === 'image'
          ? `<span class="script-item-thumb">${icon('image', { cls: 'script-item-thumb-ph' })}${item.fileId ? `<img src="${api.fileUrl(item.fileId)}" alt="" onerror="this.remove()">` : ''}</span>`
          : '';
        const hasSnd  = !!item.soundFileId;
        const sndOpen = _scriptSoundOpen.has(item.id);
        return `<div class="script-item-wrap">
          <div class="script-item">
            ${thumb}
            <span class="script-item-icon">${itemIcon}</span>
            ${nameHtml}
            ${hasSnd ? `<span class="script-item-snd-chip" title="Geluid: ${esc(item.soundLabel || 'geluid')}${item.soundLoop ? ' (loop)' : ''}">${icon('volume-2')}${item.soundLoop ? ' ⟳' : ''}</span>` : ''}
            <div class="script-item-actions">
              <button class="script-icon-btn${hasSnd ? ' script-icon-btn--snd-on' : ''}${sndOpen ? ' is-active' : ''}"
                onclick="window._scriptToggleSoundEditor('${esc(ch)}','${esc(item.id)}')" title="Geluid bij reveal">${icon('volume-2')}</button>
              ${!isFirst ? `<button class="script-icon-btn"
                onclick="window._scriptMove('${esc(ch)}','${esc(item.id)}',-1)" title="Omhoog">↑</button>` : ''}
              ${!isLast  ? `<button class="script-icon-btn"
                onclick="window._scriptMove('${esc(ch)}','${esc(item.id)}',1)" title="Omlaag">↓</button>` : ''}
              <button class="script-icon-btn script-icon-btn--del"
                onclick="window._scriptRemove('${esc(ch)}','${esc(item.id)}')" title="Verwijderen">${icon('x')}</button>
            </div>
          </div>
          ${sndOpen ? `<div class="script-snd-editor">${_scriptSoundEditorHtml(ch, item)}</div>` : ''}
        </div>`;
      }).join('')
    : `<p class="dm-hint" style="margin:4px 0 0">Geen script-items. Voeg afbeeldingen, kaartjes of gevechten toe via de knoppen hieronder.</p>`;

  // Picker panel
  let pickerHtml = '';
  if (pickerState.mode === 'image') {
    if (allImages.length === 0) {
      pickerHtml = `<p class="dm-hint">Geen afbeeldingen in deze akte.</p>`;
    } else {
      pickerHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px">
        ${allImages.map(img => {
          const added = addedFileIds.has(img.fileId);
          return `<div style="position:relative;cursor:${added ? 'default' : 'pointer'};opacity:${added ? '.55' : '1'}"
            ${added ? '' : `onclick="window._scriptAddImage('${esc(ch)}','${esc(img.sessieId)}','${esc(img.fileId)}','${escJS(img.caption)}')"`}>
            <img src="${api.fileUrl(img.fileId)}" style="width:72px;height:54px;object-fit:cover;border-radius:4px;
              border:2px solid ${added ? 'var(--color-gold-dim)' : 'var(--color-room-border)'}">
            ${added ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
              font-size:18px;background:rgba(0,0,0,0.3);border-radius:4px;color:#fff">${icon('check')}</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
  } else if (pickerState.mode === 'entity') {
    const entityList = pickerState.entities;
    const dlOptions = entityList === undefined ? '' :
      entityList.filter(e => !addedEntityIds.has(e.id))
        .map(e => `<option value="${esc((e._icon || '') + ' ' + (e.name || ''))}"></option>`).join('');
    pickerHtml = `
      <input class="dm-input" type="text"
        list="script-entity-dl-${esc(ch)}"
        id="script-entity-search-${esc(ch)}"
        placeholder="${entityList === undefined ? 'Laden…' : 'Zoek en selecteer een kaartje…'}"
        ${entityList === undefined ? 'disabled' : ''}
        style="width:100%;font-size:12px"
        onchange="window._scriptEntityPick('${esc(ch)}', this.value); this.value=''">
      <datalist id="script-entity-dl-${esc(ch)}">${dlOptions}</datalist>`;
  } else if (pickerState.mode === 'encounter') {
    const encounters = pickerState.encounters;
    const dlEncOptions = encounters === undefined ? '' :
      encounters.filter(e => !addedEncIds.has(e.id))
        .map(e => `<option value="${esc(e.name || '')}"></option>`).join('');
    pickerHtml = `
      <input class="dm-input" type="text"
        list="script-enc-dl-${esc(ch)}"
        id="script-enc-search-${esc(ch)}"
        placeholder="${encounters === undefined ? 'Laden…' : encounters.length === 0 ? 'Geen gevechten — maak er eerst een aan.' : 'Zoek en selecteer een gevecht…'}"
        ${(encounters === undefined || encounters.length === 0) ? 'disabled' : ''}
        style="width:100%;font-size:12px"
        onchange="window._scriptEncounterPick('${esc(ch)}', this.value); this.value=''">
      <datalist id="script-enc-dl-${esc(ch)}">${dlEncOptions}</datalist>`;
  } else if (pickerState.mode === 'dungeon') {
    const dungeons = pickerState.dungeons;
    if (dungeons === undefined) {
      pickerHtml = `<p class="dm-hint">Laden…</p>`;
    } else if (dungeons.length === 0) {
      pickerHtml = `<p class="dm-hint">Geen dungeon-kaarten voor dit hoofdstuk. Maak er eerst een aan onder Kaarten.</p>`;
    } else {
      pickerHtml = dungeons.map(d => {
        const openAdded = addedDungeonKeys.has(d.id + '|');
        const rooms = d.rooms || [];
        return `<div class="script-dng-block">
          <button class="dm-btn dm-btn-sm${openAdded ? ' dm-btn-ghost' : ''}" ${openAdded ? 'disabled' : ''}
            style="text-align:left;${openAdded ? 'opacity:.5' : ''}"
            onclick="window._scriptAddDungeon('${esc(ch)}','${esc(d.id)}','')">
            ${icon('castle')} ${openAdded ? '✓ ' : ''}Open “${esc(d.name || 'Dungeon')}”</button>
          ${rooms.length
            ? `<div class="script-dng-rooms">${rooms.map(r => {
                const added = addedDungeonKeys.has(d.id + '|' + r.id);
                return `<button class="dm-btn dm-btn-sm${added ? ' dm-btn-ghost' : ''}" ${added ? 'disabled' : ''}
                  style="text-align:left;${added ? 'opacity:.5' : ''}"
                  onclick="window._scriptAddDungeon('${esc(ch)}','${esc(d.id)}','${esc(r.id)}')">
                  ${icon('map-pin')} ${added ? '✓ ' : ''}${esc(r.name || 'Kamer')}</button>`;
              }).join('')}</div>`
            : `<p class="dm-hint" style="margin:2px 0 0 6px">Geen kamers ingetekend.</p>`}
        </div>`;
      }).join('');
    }
  }

  return `
    <div class="logboek-script-header">
      <span class="logboek-script-title">${icon('clipboard-list')} Regie-script</span>
      <div class="logboek-script-add-btns">
        <button class="script-add-btn${pickerState.mode === 'image'    ? ' is-active' : ''}"
          title="Afbeelding toevoegen"
          onclick="window._scriptTogglePicker('${esc(ch)}','image')">${icon('image')}</button>
        <button class="script-add-btn${pickerState.mode === 'entity'   ? ' is-active' : ''}"
          title="Kaartje toevoegen"
          onclick="window._scriptTogglePicker('${esc(ch)}','entity')">${icon('eye')}</button>
        <button class="script-add-btn${pickerState.mode === 'encounter'? ' is-active' : ''}"
          title="Gevecht toevoegen"
          onclick="window._scriptTogglePicker('${esc(ch)}','encounter')">${icon('crossed-swords',{cls:'icon-gi'})}</button>
        <button class="script-add-btn${pickerState.mode === 'dungeon'? ' is-active' : ''}"
          title="Dungeon of kamer toevoegen"
          onclick="window._scriptTogglePicker('${esc(ch)}','dungeon')">${icon('castle')}</button>
      </div>
    </div>
    <div class="logboek-script-items">${scriptHtml}</div>
    ${pickerState.mode
      ? `<div class="logboek-script-picker">${pickerHtml}</div>`
      : ''}
  `;
}

function _refreshScriptSection(ch) {
  const container = document.getElementById(`logboek-script-section-${ch}`);
  if (!container) return;
  const info      = meta?.hoofdstukken?.[ch] || {};
  const chEntries = (archiefData.sessieLog || []).filter(e => e.hoofdstuk === ch);
  container.innerHTML = _renderAkteScriptInner(ch, info, chEntries);
}

// ── Geluid bij een reveal (per script-item: scène of upload + loop) ──
function _scriptSoundEditorHtml(ch, item) {
  const scenes = _scriptScenesCache;
  const sel = item.soundFileId
    ? (scenes || []).find(s => s.fileId === item.soundFileId)?.id || ''
    : '';
  return `
    <div class="script-snd-row">
      <select class="dm-input dm-input-sm script-snd-select"
        onchange="window._scriptSetSceneSound('${esc(ch)}','${esc(item.id)}', this.value)">
        <option value="">— kies een scène —</option>
        ${scenes === undefined
          ? '<option disabled>Laden…</option>'
          : scenes.map(s => `<option value="${esc(s.id)}"${sel === s.id ? ' selected' : ''}>${esc(s.label || 'Scène')}</option>`).join('')}
      </select>
      <label class="script-snd-upload-btn" title="Eigen geluid uploaden">${icon('upload')}
        <input type="file" accept="audio/*" style="display:none"
          onchange="window._scriptUploadSound('${esc(ch)}','${esc(item.id)}', this.files[0])"></label>
    </div>
    <div class="script-snd-row2">
      <label class="script-snd-loop">
        <input type="checkbox"${item.soundLoop ? ' checked' : ''}
          onchange="window._scriptToggleSoundLoop('${esc(ch)}','${esc(item.id)}')"> Loop
      </label>
      ${item.soundFileId ? `
        <button class="script-icon-btn" title="Voorbeeld afspelen"
          onclick="window._scriptPreviewSound('${esc(item.soundFileId)}')">${icon('play')}</button>
        <span class="script-snd-current" title="${esc(item.soundLabel || '')}">${esc(item.soundLabel || 'Geluid')}</span>
        <button class="script-icon-btn script-icon-btn--del" title="Geluid verwijderen"
          onclick="window._scriptClearSound('${esc(ch)}','${esc(item.id)}')">${icon('x')}</button>
      ` : '<span class="dm-hint" style="opacity:.6">Nog geen geluid gekozen.</span>'}
    </div>`;
}

function _scriptItemPatch(ch, itemId, patch) {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  const it = script.find(x => x.id === itemId);
  if (!it) return null;
  Object.assign(it, patch);
  return script;
}

async function _scriptLoadScenes(ch) {
  try { const sd = await api.getSounds(); _scriptScenesCache = sd?.ambiance?.scenes || []; }
  catch { _scriptScenesCache = []; }
  _refreshScriptSection(ch);
}

window._scriptToggleSoundEditor = (ch, itemId) => {
  if (_scriptSoundOpen.has(itemId)) _scriptSoundOpen.delete(itemId);
  else {
    _scriptSoundOpen.add(itemId);
    if (_scriptScenesCache === undefined) _scriptLoadScenes(ch);
  }
  _refreshScriptSection(ch);
};

window._scriptSetSceneSound = async (ch, itemId, sceneId) => {
  const scene = (_scriptScenesCache || []).find(s => s.id === sceneId);
  const patch = sceneId
    ? { soundFileId: scene?.fileId || null, soundLabel: scene?.label || 'Scène' }
    : { soundFileId: null, soundLabel: '' };
  const script = _scriptItemPatch(ch, itemId, patch);
  if (script) await _scriptSave(ch, script);
};

window._scriptUploadSound = async (ch, itemId, file) => {
  if (!file) return;
  const id = 'akte-snd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  try {
    await api.uploadFile(id, file);
    const script = _scriptItemPatch(ch, itemId, { soundFileId: id, soundLabel: file.name.replace(/\.[^.]+$/, '') });
    if (script) await _scriptSave(ch, script);
  } catch (e) { alert('Upload mislukt: ' + e.message); }
};

window._scriptToggleSoundLoop = async (ch, itemId) => {
  const cur = (meta?.hoofdstukken?.[ch]?.script || []).find(x => x.id === itemId);
  const script = _scriptItemPatch(ch, itemId, { soundLoop: !cur?.soundLoop });
  if (script) await _scriptSave(ch, script);
};

window._scriptClearSound = async (ch, itemId) => {
  const script = _scriptItemPatch(ch, itemId, { soundFileId: null, soundLabel: '', soundLoop: false });
  if (script) await _scriptSave(ch, script);
};

window._scriptPreviewSound = (fileId) => window.soundManager?.preview?.(fileId);

// ── Akte-beheer hergebruik vanuit de Meesterkamer (tab 'Aktes') ──
// De akte-voorbereiding (regie-script, bewerken, speel, zichtbaarheid) is
// verhuisd naar de Meesterkamer. Deze helpers laten dm-panel.js de bestaande
// (globale) akte-functies hergebruiken zonder het Logboek te hoeven openen.
window._akteScriptHtml = (ch) => {
  const info      = meta?.hoofdstukken?.[ch] || {};
  const chEntries = (archiefData.sessieLog || []).filter(e => e.hoofdstuk === ch);
  return _renderAkteScriptInner(ch, info, chEntries);
};
// Laad archief-data + meta zodat de akte-functies werken vóór het Logboek bezocht is.
window._loadAkteData = async () => {
  try { archiefData = await api.listArchief(); } catch {}
  meta = window.app?.state?.meta || meta;
  return { meta, archiefData };
};
// Hook die dm-panel zet; aangeroepen na elke akte-wijziging om de Aktes-tab te verversen.
window._onAkteBeheerChange = null;
function _akteBeheerChanged() { if (typeof window._onAkteBeheerChange === 'function') window._onAkteBeheerChange(); }

window._scriptTogglePicker = (ch, mode) => {
  const state = _scriptPickerState[ch] || {};
  state.mode  = state.mode === mode ? null : mode;
  _scriptPickerState[ch] = state;
  _refreshScriptSection(ch);
  // Lazy-load data when picker opens
  if (state.mode === 'entity' && state.entities === undefined) {
    _scriptLoadAllEntities(ch);
  } else if (state.mode === 'encounter' && state.encounters === undefined) {
    _scriptLoadEncounters(ch);
  } else if (state.mode === 'dungeon' && state.dungeons === undefined) {
    _scriptLoadDungeons(ch);
  }
  // Auto-focus search when opening entity picker
  if (state.mode === 'entity') {
    requestAnimationFrame(() => {
      document.getElementById(`script-entity-search-${ch}`)?.focus();
    });
  }
};

// Called when user picks an encounter from the datalist suggestions
window._scriptEncounterPick = (ch, value) => {
  if (!value) return;
  const encounters = (_scriptPickerState[ch] || {}).encounters || [];
  const enc = encounters.find(e => e.name === value);
  if (enc) window._scriptAddEncounter(ch, enc.id, enc.name);
};

// Called when user picks an entity from the datalist suggestions
window._scriptEntityPick = (ch, value) => {
  if (!value) return;
  const state = _scriptPickerState[ch] || {};
  const entities = state.entities || [];
  // Match against "icon name" composite or plain name
  const e = entities.find(x => ((x._icon || '') + ' ' + (x.name || '')) === value)
         || entities.find(x => x.name === value);
  if (e) window._scriptAddEntity(ch, e._type, e.id, e.name);
};

// ── Helpers for entity picker ──

function _renderEntityResults(ch, entities, addedEntityIds, query) {
  if (entities === undefined) return `<p class="dm-hint">Laden…</p>`;
  const q = (query || '').toLowerCase().trim();
  const filtered = q
    ? entities.filter(e => (e.name || '').toLowerCase().includes(q))
    : entities;
  if (filtered.length === 0) return `<p class="dm-hint">Geen resultaten.</p>`;
  return filtered.slice(0, 30).map(e => {
    const added = addedEntityIds.has(e.id);
    return `<button class="dm-btn dm-btn-sm${added ? ' dm-btn-ghost' : ''}"
      style="text-align:left;padding:3px 8px;${added ? 'opacity:.5' : ''}"
      ${added ? 'disabled' : `onclick="window._scriptAddEntity('${esc(ch)}','${esc(e._type)}','${esc(e.id)}','${escJS(e.name || '')}')"`}>
      ${e._icon || icon('eye')} ${added ? '✓ ' : ''}${esc(e.name)}</button>`;
  }).join('');
}

async function _scriptLoadAllEntities(ch) {
  const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const ICONS = { personages: icon('user'), locaties: icon('map-pin'), organisaties: icon('landmark'), voorwerpen: icon('package'), documenten: icon('scroll-text') };
  try {
    const [archiefResult, ...entityLists] = await Promise.all([
      api.listArchief().catch(() => ({ documents: [] })),
      ...ENTITY_TYPES.map(t => api.listEntities(t).catch(() => []))
    ]);
    const allEntities = [];
    ENTITY_TYPES.forEach((type, idx) => {
      for (const e of (entityLists[idx] || [])) {
        allEntities.push({ id: e.id, name: e.name, _type: type, _icon: ICONS[type] });
      }
    });
    for (const doc of (archiefResult.documents || [])) {
      allEntities.push({ id: doc.id, name: doc.name || doc.title || '(document)', _type: 'documenten', _icon: ICONS.documenten });
    }
    allEntities.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nl'));
    const state = _scriptPickerState[ch] || {};
    state.entities = allEntities;
    _scriptPickerState[ch] = state;
    // Update datalist + enable input if picker is already visible, else full refresh
    const dlEl    = document.getElementById(`script-entity-dl-${ch}`);
    const inputEl = document.getElementById(`script-entity-search-${ch}`);
    if (dlEl && inputEl) {
      const addedEntityIds = new Set(
        (meta?.hoofdstukken?.[ch]?.script || [])
          .filter(x => x.type === 'entity').map(x => x.entityId)
      );
      dlEl.innerHTML = allEntities.filter(e => !addedEntityIds.has(e.id))
        .map(e => `<option value="${esc((e._icon || '') + ' ' + (e.name || ''))}"></option>`).join('');
      inputEl.disabled = false;
      inputEl.placeholder = 'Zoek en selecteer een kaartje…';
      inputEl.focus();
    } else {
      _refreshScriptSection(ch);
    }
  } catch (err) { console.warn('entity load failed', err); }
}

async function _scriptLoadEncounters(ch) {
  try {
    const list = await api.listEncounters();
    const state = _scriptPickerState[ch] || {};
    state.encounters = list;
    _scriptPickerState[ch] = state;
    // Update datalist + input in-place als de picker al zichtbaar is
    const dlEl    = document.getElementById(`script-enc-dl-${ch}`);
    const inputEl = document.getElementById(`script-enc-search-${ch}`);
    if (dlEl && inputEl) {
      const addedEncIds = new Set(
        (meta?.hoofdstukken?.[ch]?.script || [])
          .filter(x => x.type === 'encounter').map(x => x.encounterId)
      );
      dlEl.innerHTML = list.filter(e => !addedEncIds.has(e.id))
        .map(e => `<option value="${esc(e.name || '')}"></option>`).join('');
      inputEl.disabled = list.length === 0;
      inputEl.placeholder = list.length === 0
        ? 'Geen gevechten — maak er eerst een aan.'
        : 'Zoek en selecteer een gevecht…';
      inputEl.focus();
    } else {
      _refreshScriptSection(ch);
    }
  } catch (err) { console.warn('encounter load failed', err); }
}

async function _scriptLoadDungeons(ch) {
  try {
    const all = await api.listDungeons();
    const state = _scriptPickerState[ch] || {};
    // Alleen dungeons van dit hoofdstuk (val terug op alle als hoofdstukId leeg is).
    state.dungeons = (all || []).filter(d => !d.hoofdstukId || d.hoofdstukId === ch);
    _scriptPickerState[ch] = state;
    _refreshScriptSection(ch);
  } catch (err) { console.warn('dungeon load failed', err); }
}

window._scriptAddDungeon = async (ch, dungeonId, roomId) => {
  const dungeons = (_scriptPickerState[ch] || {}).dungeons || [];
  const d = dungeons.find(x => x.id === dungeonId);
  if (!d) return;
  let name;
  if (roomId) {
    const r = (d.rooms || []).find(x => x.id === roomId);
    name = (d.name ? d.name + ' — ' : '') + (r?.name || 'Kamer');
  } else {
    name = 'Open: ' + (d.name || 'Dungeon');
  }
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  if (script.some(x => x.type === 'dungeon' && x.dungeonId === dungeonId && (x.roomId || '') === (roomId || ''))) return;
  script.push({ id: _scriptGenId(), type: 'dungeon', dungeonId, roomId: roomId || null, name });
  await _scriptSave(ch, script);
};

function _scriptGenId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function _scriptSave(ch, newScript) {
  if (!meta?.hoofdstukken?.[ch]) return;
  meta.hoofdstukken[ch].script = newScript;
  if (window.app?.state?.meta?.hoofdstukken?.[ch]) {
    window.app.state.meta.hoofdstukken[ch].script = newScript;
  }
  try {
    await api.saveAkteScript(ch, newScript);
  } catch (err) { console.warn('script save failed', err); }
  _refreshScriptSection(ch);
}

window._scriptAddImage = async (ch, sessieId, fileId, caption) => {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  if (script.some(x => x.type === 'image' && x.fileId === fileId)) return;
  script.push({ id: _scriptGenId(), type: 'image', sessieId, fileId, caption: caption || '' });
  await _scriptSave(ch, script);
};

window._scriptAddEntity = async (ch, entityType, entityId, name) => {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  if (script.some(x => x.type === 'entity' && x.entityId === entityId)) return;
  script.push({ id: _scriptGenId(), type: 'entity', entityType, entityId, name });
  await _scriptSave(ch, script);
};

window._scriptAddEncounter = async (ch, encounterId, name) => {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  if (script.some(x => x.type === 'encounter' && x.encounterId === encounterId)) return;
  script.push({ id: _scriptGenId(), type: 'encounter', encounterId, name });
  await _scriptSave(ch, script);
};

window._scriptRemove = async (ch, itemId) => {
  const script = (meta?.hoofdstukken?.[ch]?.script || []).filter(x => x.id !== itemId);
  await _scriptSave(ch, script);
};

// Onderschrift van een image-stap hernoemen (spelers zien dit bij een reveal).
// Raakt alleen deze script-stap, niet de mediabibliotheek-naam.
window._scriptRename = async (ch, itemId, caption) => {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  const item = script.find(x => x.id === itemId);
  if (!item || item.type !== 'image') return;
  const val = (caption || '').trim();
  if (val === (item.caption || '')) return; // niets veranderd → geen save/re-render
  item.caption = val;
  await _scriptSave(ch, script);
};

window._scriptMove = async (ch, itemId, dir) => {
  const script = [...(meta?.hoofdstukken?.[ch]?.script || [])];
  const idx = script.findIndex(x => x.id === itemId);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= script.length) return;
  [script[idx], script[newIdx]] = [script[newIdx], script[idx]];
  await _scriptSave(ch, script);
};

window._editAkte = (ch) => {
  const hk = meta?.hoofdstukken || {};
  const info = hk[ch] || {};

  // Collect all images from entries in this chapter
  const chEntries = (archiefData.sessieLog || []).filter(e => e.hoofdstuk === ch);
  const allChImgIds = [...new Set(
    chEntries.flatMap(e => (e.images || []).map(img => typeof img === 'string' ? img : img.id))
  )];
  const firstEntryWithImg = chEntries.find(e => (e.images || []).length > 0);
  const firstRawImg = firstEntryWithImg?.images?.[0];
  const _firstImgId = firstRawImg ? (typeof firstRawImg === 'string' ? firstRawImg : firstRawImg.id) : null;
  const bannerImgId = info.bannerImg || _firstImgId;
  const bannerImgSrc = bannerImgId ? api.fileUrl(bannerImgId) : null;

  const focusVal = info.bannerFocus || '50% 30%';
  const [fx, fy] = (focusVal.match(/(\d+)%\s*(\d+)%/) || [null, '50', '30']).slice(1).map(Number);

  const body = `
    <form id="akte-edit-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Nummer</label>
          <input type="number" id="akte-num" value="${esc(String(info.num || ''))}" min="1"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">In-game dag</label>
          <input id="akte-dag" value="${esc(info.dag || '')}" placeholder="Dag van …"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Titel</label>
        <input id="akte-title" value="${esc(info.title || '')}"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
      </div>
      ${allChImgIds.length > 1 ? `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Bannerafbeelding</label>
        <div class="flex flex-wrap gap-2 mt-2">
          ${allChImgIds.map(imgId => `
            <button type="button" class="banner-img-thumb${(info.bannerImg || _firstImgId) === imgId ? ' banner-img-thumb--sel' : ''}"
              data-img-id="${esc(imgId)}"
              onclick="window._pickBannerImg(this)"
              style="background-image:url('${api.fileUrl(imgId)}')">
            </button>`).join('')}
        </div>
        <input type="hidden" id="banner-img-input" value="${esc(info.bannerImg || '')}">
      </div>` : `<input type="hidden" id="banner-img-input" value="${esc(info.bannerImg || '')}">`}
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Bannerfocus</label>
        ${bannerImgSrc ? `
          <div id="fp-wrap" class="relative rounded overflow-hidden mt-1 mb-1 select-none"
            style="height:140px;cursor:crosshair"
            onmousedown="window._fpDown(event)"
            onmousemove="window._fpMove(event)">
            <img id="editor-img-preview" src="${bannerImgSrc}"
              class="w-full h-full object-cover pointer-events-none"
              style="object-position:${focusVal}"
              onerror="this.parentElement.style.display='none'">
            <div id="fp-crosshair" class="absolute pointer-events-none"
              style="left:${fx}%;top:${fy}%;transform:translate(-50%,-50%)">
              <div style="width:22px;height:22px;border-radius:50%;
                border:2px solid #fff;
                box-shadow:0 0 0 1.5px rgba(0,0,0,0.55),inset 0 0 0 1.5px rgba(0,0,0,0.3)"></div>
            </div>
          </div>
          <p class="text-[10px] text-ink-dim mb-1">Klik of sleep om het focuspunt van de bannerafbeelding in te stellen</p>
          <input type="hidden" id="fp-input" value="${focusVal}">
        ` : `
          <p class="text-xs text-ink-faint mt-1 font-fell italic">Geen bannerafbeelding — voeg een afbeelding toe aan het eerste hoofdstuk van deze akte.</p>
        `}
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Spelerssamenvatting</label>
        <div class="mt-1">
          ${fmtToolbar('akte-samenvatting-ta')}
          <textarea id="akte-samenvatting-ta" rows="10"
            onkeydown="window._fmtKey(event)"
            class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none">${esc(info.spelersSamenvatting || '')}</textarea>
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition">${icon('save')} Opslaan</button>
        <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition">${icon('x')}</button>
      </div>
    </form>`;
  openModal('Akte bewerken', info.title || ch, body);
  document.getElementById('akte-edit-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
    const num   = parseInt(document.getElementById('akte-num').value) || info.num || 99;
    const title = document.getElementById('akte-title').value.trim() || info.title || '';
    const dag   = document.getElementById('akte-dag').value.trim();
    const bannerFocus = document.getElementById('fp-input')?.value || focusVal;
    const bannerImg   = document.getElementById('banner-img-input')?.value || '';
    const spelersSamenvatting = document.getElementById('akte-samenvatting-ta').value.trim();
    const short = `A${num} \u00b7 ${title.length > 22 ? title.slice(0, 22) + '\u2026' : title}`;
    try {
      await api.saveHoofdstuk(ch, { num, title, dag, short, bannerFocus, bannerImg, spelersSamenvatting });
      const newMeta = await api.meta();
      meta = newMeta;
      if (window.app?.state) window.app.state.meta = newMeta;
      closeModal();
      renderLogboek();
      _akteBeheerChanged();
    } catch (err) { alert('Fout: ' + err.message); }
  });
};

window._pickBannerImg = (btn) => {
  document.querySelectorAll('.banner-img-thumb').forEach(b => b.classList.remove('banner-img-thumb--sel'));
  btn.classList.add('banner-img-thumb--sel');
  const imgId = btn.dataset.imgId;
  document.getElementById('banner-img-input').value = imgId;
  // Update de focuspicker-preview
  const preview = document.getElementById('editor-img-preview');
  if (preview) {
    preview.src = api.fileUrl(imgId);
    document.getElementById('fp-wrap')?.style.removeProperty('display');
  }
};

window._openSessieEditor = async (editId) => {
  const hk = meta?.hoofdstukken || {};
  let e = null;
  if (editId) {
    e = (archiefData.sessieLog || []).find(s => s.id === editId) || null;
  }

  // Fetch entity names per type for autocomplete
  logAllPersonageNames = [];
  logAllLocatieNames   = [];
  logAllVoorwerpNames  = [];
  try {
    const names = await api.allNames();
    logAllPersonageNames   = (names.personages   || []).slice().sort();
    logAllLocatieNames     = (names.locaties     || []).slice().sort();
    logAllOrganisatieNames = (names.organisaties || []).slice().sort();
    logAllVoorwerpNames    = (names.voorwerpen   || []).slice().sort();
  } catch { /* ignore */ }

  // Document names for autocomplete
  logAllDocNames = (archiefData.documents || []).map(d => d.name).sort();

  logEditorTags = {
    nieuwPersonages:       e?.nieuwPersonages?.slice()       || [],
    terugkerendPersonages: e?.terugkerendPersonages?.slice() || [],
    nieuwLocaties:         e?.nieuwLocaties?.slice()         || [],
    terugkerendLocaties:   e?.terugkerendLocaties?.slice()   || [],
    organisaties:          e?.organisaties?.slice()          || [],
    voorwerpen:            e?.voorwerpen?.slice()            || [],
    docs:                  e?.docs?.slice()                  || [],
  };

  // Image state — existing images from entry (supports both legacy string[] and {id,caption,visible}[])
  logEditorImagesToDelete = [];
  logEditorImages = (e?.images || []).map(item => {
    const id      = typeof item === 'string' ? item : item.id;
    const caption = typeof item === 'string' ? '' : (item.caption || '');
    const visible = typeof item === 'string' ? true : (item.visible !== false);
    return { id, url: api.fileUrl(id), isNew: false, caption, visible };
  });

  // Suggest next chapter key/number
  const existingNums = Object.values(hk).map(v => v.num).filter(n => n < 90);
  const nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;
  const nextKey = `h${nextNum}`;

  const body = `<form id="sessie-form" class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Akte</label>
        <div class="flex gap-1 mt-1">
          <select id="hk-select" name="hoofdstuk" class="flex-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <option value="">—</option>
            ${Object.entries(hk).sort(([,a],[,b]) => a.num - b.num).map(([k, v]) =>
              `<option value="${k}" ${e?.hoofdstuk === k ? 'selected' : ''}>${v.short}</option>`
            ).join('')}
          </select>
          <button type="button" title="Nieuwe akte toevoegen"
            onclick="document.getElementById('new-hk-panel').classList.toggle('hidden')"
            class="px-2.5 py-1 bg-room-elevated border border-room-border rounded text-ink-dim hover:text-gold hover:border-gold-dim transition text-base leading-none">+</button>
        </div>
        <div id="new-hk-panel" class="hidden mt-2 p-3 bg-room-elevated/60 border border-room-border rounded space-y-2">
          <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-1">Nieuwe akte</div>
          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
              <label class="text-[10px] text-ink-faint uppercase">Sleutel</label>
              <input id="hk-key" value="${nextKey}" placeholder="h11"
                class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div>
              <label class="text-[10px] text-ink-faint uppercase">Nr.</label>
              <input id="hk-num" type="number" value="${nextNum}" min="1"
                class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
          </div>
          <div>
            <label class="text-[10px] text-ink-faint uppercase">Titel</label>
            <input id="hk-title" placeholder="De nieuwe sessie…"
              class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
          </div>
          <div>
            <label class="text-[10px] text-ink-faint uppercase">In-game dag (optioneel)</label>
            <input id="hk-dag" placeholder="Dag van …"
              class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
          </div>
          <button type="button" onclick="window._saveNewHoofdstuk()"
            class="px-3 py-1.5 bg-gold-dim text-room-bg text-sm font-cinzel rounded hover:bg-gold transition" title="Toevoegen">${icon('plus')}</button>
        </div>
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Sessiedatum</label>
        <input type="date" name="datum" value="${esc(e?.datum || '')}"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
      </div>
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Korte samenvatting</label>
      <input name="korteSamenvatting" value="${esc(e?.korteSamenvatting || '')}"
        placeholder="Één zin die de sessie omschrijft..."
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Citaat (optioneel)</label>
      <input name="citaat" value="${esc(e?.citaat || '')}"
        placeholder="Een opvallend citaat of motto uit deze sessie…"
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none font-fell italic">
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Uitgebreide samenvatting</label>
      <div class="mt-1">
        ${fmtToolbar('ta_samenvatting')}
        <textarea id="ta_samenvatting" name="samenvatting" rows="12"
          onkeydown="window._fmtKey(event)"
          class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none">${esc(e?.samenvatting || '')}</textarea>
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-2 pb-1 border-b border-room-border">\ud83d\udc64 Personages</div>
      <div class="grid grid-cols-2 gap-3">
        ${renderLogTagEditor('nieuwPersonages',       '\u2728 Nieuw',       'bg-gold/10 border-gold/30 text-gold')}
        ${renderLogTagEditor('terugkerendPersonages', '\ud83d\udd04 Terugkerend', 'bg-blue-ink/10 border-blue-ink/30 text-[#7ab0d4]')}
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-2 pb-1 border-b border-room-border">\ud83c\udff0 Locaties</div>
      <div class="grid grid-cols-2 gap-3">
        ${renderLogTagEditor('nieuwLocaties',       '\u2728 Nieuw',       'bg-green-wax/10 border-green-wax/30 text-green-wax')}
        ${renderLogTagEditor('terugkerendLocaties', '\ud83d\udd04 Terugkerend', 'bg-green-wax/10 border-green-wax/20 text-green-wax')}
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-2 pb-1 border-b border-room-border">\ud83c\udfdb\ufe0f Organisaties</div>
      ${renderLogTagEditor('organisaties', 'Organisaties', 'bg-seal/10 border-seal/30 text-seal')}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${renderLogTagEditor('voorwerpen', '\u2694\ufe0f Voorwerpen', 'bg-orange/10 border-orange/30 text-orange')}
      ${renderLogTagEditor('docs',       '\ud83d\udcdc Documenten', 'bg-purple-codex/15 border-purple-codex/35 text-purple-codex')}
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-2">\ud83d\uddbc\ufe0f Afbeeldingen</div>
      <div id="log-img-preview" class="flex flex-wrap gap-2 mb-2 min-h-[2rem] items-center">
        <span class="text-xs text-ink-faint italic">Nog geen afbeeldingen</span>
      </div>
      <label class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright cursor-pointer transition">
        + Toevoegen
        <input type="file" accept="image/*" multiple class="hidden" onchange="window._addLogImages(this.files)">
      </label>
    </div>
    <div class="flex gap-2 pt-2">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition" title="Opslaan">${icon('save')}</button>
      ${editId ? `<button type="button" onclick="window._deleteSessie('${editId}')" class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition" title="Verwijderen">${icon('trash')}</button>` : ''}
      <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">${icon('x')}</button>
    </div>
  </form>`;

  openModal(editId ? 'Hoofdstuk bewerken' : 'Nieuw hoofdstuk', '', body);

  // Init image thumbnails after modal is in DOM
  setTimeout(() => _refreshLogImages(), 0);

  document.getElementById('sessie-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
    try {
      // Upload new images
      for (const img of logEditorImages) {
        if (img.isNew) await api.uploadFile(img.id, img.file);
      }
      // Delete removed images
      for (const id of logEditorImagesToDelete) {
        await api.deleteFile(id).catch(() => {});
      }
      const form = new FormData(ev.target);
      const payload = {
        hoofdstuk:             form.get('hoofdstuk'),
        datum:                 form.get('datum'),
        korteSamenvatting:     form.get('korteSamenvatting'),
        citaat:                form.get('citaat'),
        samenvatting:          form.get('samenvatting'),
        images:                logEditorImages.map(i => ({ id: i.id, caption: i.caption || '', visible: i.visible !== false })),
        nieuwPersonages:       logEditorTags.nieuwPersonages,
        terugkerendPersonages: logEditorTags.terugkerendPersonages,
        nieuwLocaties:         logEditorTags.nieuwLocaties,
        terugkerendLocaties:   logEditorTags.terugkerendLocaties,
        organisaties:          logEditorTags.organisaties,
        voorwerpen:            logEditorTags.voorwerpen,
        docs:                  logEditorTags.docs,
      };
      if (editId) await api.updateSessieLog(editId, payload);
      else await api.createSessieLog(payload);
      closeModal();
      renderLogboek();
    } catch (err) { alert('Fout: ' + err.message); }
  });
};

function renderLogTagEditor(field, label, chipCls) {
  return `
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-1">${label}</div>
      <div id="log-tags-${field}" class="flex flex-wrap gap-1 mb-1">
        ${logEditorTags[field].map(n => `
          <span class="px-2 py-0.5 text-xs rounded-full border font-crimson ${chipCls}">${esc(n)}
            <span class="cursor-pointer ml-1 opacity-70 hover:opacity-100" data-field="${field}" data-name="${esc(n)}" onclick="window._removeLogTag(this.dataset.field,this.dataset.name)">\u00d7</span>
          </span>
        `).join('')}
      </div>
      <div class="flex gap-1">
        <div class="flex-1 autocomplete-wrap">
          <input id="log-tag-input-${field}" placeholder="Naam..."
            class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none"
            oninput="window._showLogSuggestions('${field}')"
            onkeydown="window._handleLogTagKey(event,'${field}')">
          <div id="log-tag-suggestions-${field}" class="autocomplete-list"></div>
        </div>
        <button type="button" onclick="window._addLogTag('${field}')"
          class="px-2 py-1 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright">+</button>
      </div>
    </div>
  `;
}

const LOG_CHIP_CLS = {
  nieuwPersonages:       'bg-gold/10 border-gold/30 text-gold',
  terugkerendPersonages: 'bg-blue-ink/10 border-blue-ink/30 text-[#7ab0d4]',
  nieuwLocaties:         'bg-green-wax/10 border-green-wax/30 text-green-wax',
  terugkerendLocaties:   'bg-green-wax/10 border-green-wax/20 text-green-wax',
  organisaties:          'bg-seal/10 border-seal/30 text-seal',
  voorwerpen:            'bg-orange/10 border-orange/30 text-orange',
  docs:                  'bg-purple-codex/15 border-purple-codex/35 text-purple-codex',
};

window._addLogTag = (field, name) => {
  const input = document.getElementById(`log-tag-input-${field}`);
  const val = (name || input.value).trim();
  if (!val || logEditorTags[field].includes(val)) return;
  logEditorTags[field].push(val);
  input.value = '';
  window._hideLogSuggestions(field);
  refreshLogTags(field);
};

window._removeLogTag = (field, name) => {
  logEditorTags[field] = logEditorTags[field].filter(n => n !== name);
  refreshLogTags(field);
};

window._showLogSuggestions = (field) => {
  const input = document.getElementById(`log-tag-input-${field}`);
  const list = document.getElementById(`log-tag-suggestions-${field}`);
  const q = input.value.trim().toLowerCase();
  const POOL_MAP = {
    nieuwPersonages:       logAllPersonageNames,
    terugkerendPersonages: logAllPersonageNames,
    nieuwLocaties:         logAllLocatieNames,
    terugkerendLocaties:   logAllLocatieNames,
    organisaties:          logAllOrganisatieNames,
    voorwerpen:            logAllVoorwerpNames,
    docs:                  logAllDocNames,
  };
  const pool = POOL_MAP[field] || [];
  const names = pool.filter(n =>
    !logEditorTags[field].includes(n) && (!q || n.toLowerCase().includes(q))
  );
  if (names.length === 0) { list.classList.remove('open'); return; }
  list.innerHTML = names.slice(0, 12).map(n =>
    `<div class="autocomplete-item" onmousedown="window._addLogTag('${field}','${esc(n)}')">${esc(n)}</div>`
  ).join('');
  list.classList.add('open');
};

window._hideLogSuggestions = (field) => {
  const list = document.getElementById(`log-tag-suggestions-${field}`);
  if (list) list.classList.remove('open');
};

window._handleLogTagKey = (ev, field) => {
  if (ev.key === 'Enter') { ev.preventDefault(); window._addLogTag(field); }
  if (ev.key === 'Escape') { window._hideLogSuggestions(field); }
};

function refreshLogTags(field) {
  const cls = LOG_CHIP_CLS[field];
  const container = document.getElementById(`log-tags-${field}`);
  if (!container) return;
  container.innerHTML = logEditorTags[field].map(n =>
    `<span class="px-2 py-0.5 text-xs rounded-full border font-crimson ${cls}">${esc(n)}
      <span class="cursor-pointer ml-1 opacity-70 hover:opacity-100" data-field="${field}" data-name="${esc(n)}" onclick="window._removeLogTag(this.dataset.field,this.dataset.name)">\u00d7</span>
    </span>`
  ).join('');
}

window._deleteSessie = async (id) => {
  if (!confirm('Hoofdstuk-entry verwijderen?')) return;
  await api.deleteSessieLog(id);
  closeModal();
  renderLogboek();
};

function filterDocs() {
  let docs = archiefData.documents || [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    docs = docs.filter(d => {
      return [d.name, d.type, d.desc, ...(d.npcs||[]), ...(d.locs||[]), ...(d.orgs||[]), ...(d.items||[]), ...(d.docs||[])].join(' ').toLowerCase().includes(q);
    });
  }
  docs = [...docs].sort((a, b) =>
    _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' })
  );
  return docs;
}

function renderDocGrid(docs) {
  if (docs.length === 0) {
    return `<div class="text-center py-16 text-ink-faint">
      <div class="text-4xl mb-3">\ud83d\udcdc</div>
      <div class="font-fell italic">Geen documenten gevonden</div>
    </div>`;
  }
  return `<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
    ${docs.map(d => renderDocCard(d)).join('')}
  </div>`;
}

function renderDocCardCompact(d) {
  const state = (isDM() && d._activeState !== undefined) ? d._activeState : (d.state || 'hidden');
  const isBlurred = !isDM() && state === 'blurred';
  const dimmed = isDM() && state !== 'revealed';
  return `
    <div class="flex items-center gap-2 w-44 shrink-0 bg-room-elevated border border-room-border rounded-lg overflow-hidden cursor-pointer hover:border-room-border-light transition${dimmed ? ' opacity-60' : ''}"
      onclick="window._openDoc('${d.id}')">
      <img class="w-10 h-12 object-cover shrink-0${isBlurred ? ' blur-sm' : ''}"
        src="${api.fileForEntity(d)}" onerror="this.style.display='none'">
      <div class="min-w-0 flex-1 py-1.5 pr-2">
        <div class="text-[11px] font-cinzel font-semibold text-ink-bright leading-tight truncate${isBlurred ? ' blur-sm select-none' : ''}">${esc(d.name)}</div>
        ${d.type ? `<div class="text-[10px] text-ink-faint italic mt-0.5">${esc(d.type)}</div>` : ''}
      </div>
      ${dimmed ? `<div class="text-[11px] pr-1.5 shrink-0">${state === 'blurred' ? '\ud83d\udc41' : '\ud83d\udd12'}</div>` : ''}
    </div>
  `;
}

function renderDocCard(d) {
  const state = (isDM() && d._activeState !== undefined) ? d._activeState : (d.state || 'hidden');
  const hoofdstuk = meta?.hoofdstukken?.[d.hoofdstuk];
  const chapterLabel = hoofdstuk ? hoofdstuk.short : '';
  const isBlurred = !isDM() && state === 'blurred';

  return `
    <div class="entity-card${isDM() && state === 'hidden' ? ' card-hidden' : isDM() && state === 'blurred' ? ' opacity-60' : ''}"
      onclick="window._openDoc('${d.id}')">
      ${isDM() ? (() => {
        const _visIcon  = state === 'hidden' ? icon('lock') : state === 'blurred' ? icon('eye-off') : icon('eye');
        const _visTitle = state === 'revealed' ? 'Verbergen  \u00b7  Shift: vaag maken'
                        : state === 'blurred'  ? 'Onthullen  \u00b7  Shift: verbergen'
                        :                        'Onthullen  \u00b7  Shift: vaag maken';
        return `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded ${state === 'blurred' ? 'bg-gold-dim/80' : 'bg-black/75'} hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._toggleDocState('${d.id}','${state}',window._shiftHeld)"
            title="${_visTitle}">${_visIcon}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._openArchiefEditor('${d.id}')"
            title="Bewerken">${icon('pencil')}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._deleteDoc('${d.id}')"
            title="Verwijderen">${icon('trash')}</button>
        </div>`;
      })() : ''}
      <div class="card-accent bar-documenten"></div>
      <div class="card-img-wrap">
        <img class="card-img w-full object-cover${isBlurred ? ' blur-lg select-none pointer-events-none' : ''}"
          loading="lazy" src="${api.thumbForEntity(d)}" onerror="this.style.display='none'">
        <div class="card-img-fade"></div>
        ${d.type ? `<div class="card-subtype-badge badge-doc">${esc(d.type)}</div>` : ''}
      </div>
      <div class="card-body px-3 pt-2 pb-2">
        <div class="mb-1.5">
          <span class="card-name block" data-fittext>${esc(d.name)}</span>
          ${chapterLabel ? `<span class="card-name-sep"></span>
          <div class="card-meta"><span class="card-meta-sub">${esc(chapterLabel)}</span></div>` : ''}
        </div>
        ${isBlurred
          ? `<p class="text-xs text-ink-faint italic font-crimson">Nog niet volledig onthuld\u2026</p>`
          : `${d.desc ? `<p class="text-xs text-ink-medium line-clamp-4 mb-1 font-crimson leading-relaxed">${mdToHtml(d.desc)}</p>` : ''}`
        }
      </div>
    </div>
  `;
}


// ── Document detail ──
window._openDoc = async (id) => {
  let d;
  try { d = await api.getArchief(id); } catch { return; }
  // Wikilinks kunnen een document openen vóór de archief-tab ooit geladen is —
  // haal dan eerst de archiefdata op (nodig voor tekstContent).
  if (!archiefData.documents.length) {
    try { archiefData = await api.listArchief(); } catch {}
  }
  window._currentArchiefDocId    = id;
  window._currentArchiefSessieId = null;
  const state      = (isDM() && d._activeState !== undefined) ? d._activeState : (d.state || 'hidden');
  const isBlurred  = !isDM() && state === 'blurred';
  const hoofdstuk  = meta?.hoofdstukken?.[d.hoofdstuk];
  const tekst      = archiefData.tekstContent?.[id] || '';
  const thumbUrl   = api.thumbForEntity(d);
  const fileUrl    = api.fileForEntity(d);

  let body = '';

  // ── DM visibility vars (needed for bottom controls) ──
  const _visIcon  = state === 'hidden'   ? icon('lock')
                  : state === 'blurred'  ? icon('eye-off')
                  :                        icon('eye');
  const _visTitle = state === 'revealed' ? 'Verbergen · Shift: wazig'
                  : state === 'blurred'  ? 'Volledig onthullen · Shift: verbergen'
                  :                        'Onthullen · Shift: wazig';

  // ── Hero afbeelding ──
  body += `
    <div class="detail-hero mb-4" onclick="window.app.openLightbox('${fileUrl}','${escJS(d.name)}')">
      <img src="${thumbUrl}" class="detail-hero-img" onerror="this.closest('.detail-hero').style.display='none'">
      <div class="detail-hero-overlay"></div>
      
      ${d.type ? `<div class="detail-hero-badge badge-doc">${esc(d.type)}</div>` : ''}
    </div>
  `;

  // ── Beschrijving ──
  if (d.desc) {
    body += `<div class="detail-desc mb-4 ${isBlurred ? 'blur-sm select-none' : ''}">${mdToHtml(d.desc)}</div>`;
  }

  // ── Bestand (PDF / audio — geen plain afbeelding, hero toont die al) ──
  body += `<div class="mb-4" id="doc-file-container-${d.id}"></div>`;

  // ── Perkament tekst ──
  if (tekst) {
    body += `<div class="parchment-block mb-4 ${isBlurred ? 'blur-md select-none pointer-events-none' : ''}">${renderParchment(tekst)}</div>`;
  }

  // ── DM controls (onderaan) ──
  if (isDM()) {
    body += `
      <div class="dm-only mt-4 pt-4 border-t border-room-border flex gap-2">
        <button class="dm-btn dm-btn-icon${state !== 'hidden' ? ' dm-btn--active' : ''}"
          title="${_visTitle}"
          onclick="window._toggleDocState('${d.id}','${state}',event.shiftKey)">
          ${_visIcon}
        </button>
        <button class="dm-btn dm-btn-icon" title="Bewerken"
          onclick="window._openArchiefEditor('${d.id}')">${icon('pencil')}</button>
        <button class="dm-btn dm-btn-icon dm-btn-danger" title="Verwijderen"
          onclick="window._deleteDoc('${d.id}')">${icon('trash')}</button>
      </div>
    `;
  }

  const subtitle = [d.type, hoofdstuk?.short].filter(Boolean).join(' · ');
  openModal(d.name, subtitle, body);

  // Accent bar
  const _accentEl = document.getElementById('m-accent');
  if (_accentEl) _accentEl.className = 'modal-accent bar-documenten';

  // Laad bestand asynchroon in container
  const fileContainer = document.getElementById(`doc-file-container-${d.id}`);
  if (fileContainer) {
    try {
      const headRes = await fetch(fileUrl, { method: 'HEAD' });
      if (!headRes.ok) { fileContainer.style.display = 'none'; }
      else {
        const ct = headRes.headers.get('content-type') || '';
        if (isBlurred) {
          if (ct.includes('image')) {
            fileContainer.innerHTML = `<img src="${fileUrl}" class="w-full max-h-80 object-contain rounded blur-xl select-none pointer-events-none">`;
          } else {
            fileContainer.innerHTML = `<div class="rounded bg-room-elevated p-8 text-center select-none"><div class="text-4xl mb-2 opacity-30">${icon('lock')}</div><div class="text-ink-faint text-sm italic">Document nog niet volledig onthuld</div></div>`;
          }
        } else if (ct.includes('audio')) {
          fileContainer.innerHTML = `<div class="bg-room-elevated rounded-lg p-4">
            <div class="detail-label mb-2">${icon('volume-2')} Geluidsfragment</div>
            <audio controls class="w-full" src="${fileUrl}"></audio>
          </div>`;
        } else if (ct.includes('pdf')) {
          await renderPdfViewer(fileContainer, fileUrl);
        } else if (ct.includes('image')) {
          // Hero afbeelding toont de afbeelding al — geen duplicaat tonen
          fileContainer.style.display = 'none';
        } else {
          fileContainer.style.display = 'none';
        }
      }
    } catch { fileContainer.style.display = 'none'; }
  }
};

function renderParchment(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '---titel---' && i + 1 < lines.length) {
      html += `<div class="parch-title">${mdToHtml(lines[i + 1])}</div>`;
      i += 2; continue;
    }
    if (/^---\s*$/.test(line.trim())) {
      html += '<hr class="parch-rule">';
      i++; continue;
    }
    if (line.trim() === '--handtekening--' && i + 1 < lines.length) {
      html += `<div class="parch-sig">${mdToHtml(lines[i + 1])}</div>`;
      i += 2; continue;
    }
    html += `<span>${mdToHtml(line)}</span><br>`;
    i++;
  }
  return html;
}

// ── State change ──
window._setDocState = async (id, state) => {
  await api.setArchiefState(id, state);
  renderDocumenten();
};

window._toggleDocState = async (id, current, shiftKey) => {
  let next;
  if (shiftKey) {
    next = current === 'blurred' ? 'hidden' : 'blurred';
  } else {
    next = current === 'revealed' ? 'hidden' : 'revealed';
  }
  await api.setArchiefGroupVisibility(id, next);
  renderDocumenten();
};

// ── Hidden link toggle ──
window._toggleLinkVis = async (docId, field, name) => {
  const links = archiefData.hiddenLinks[docId] || { npcs: [], locs: [], docs: [] };
  if (!links[field]) links[field] = [];
  const idx = links[field].indexOf(name);
  if (idx >= 0) links[field].splice(idx, 1);
  else links[field].push(name);
  archiefData.hiddenLinks[docId] = links;
  await api.saveHiddenLinks(docId, links);
  window._openDoc(docId);
};

// ── Tekst content save ──
let tekstTimer;
window._saveTekst = (id) => {
  clearTimeout(tekstTimer);
  tekstTimer = setTimeout(async () => {
    const ta = document.getElementById(`tekst-editor-${id}`);
    if (!ta) return;
    await api.saveTekst(id, ta.value);
    archiefData.tekstContent[id] = ta.value;
    const ind = document.getElementById(`tekst-save-${id}`);
    if (ind) { ind.textContent = '\u2713 Tekst opgeslagen'; ind.style.opacity = '1'; setTimeout(() => ind.style.opacity = '0', 1200); }
  }, 500);
};

// ── File upload ──
window._uploadDocFile = async (id, file) => {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return alert('Max 50MB');
  await api.uploadFile(id, file);
  window._openDoc(id);
};

// Kies een bestaande afbeelding uit de mediabibliotheek voor dit document.
// Zet het verborgen imageId-veld (gaat mee bij opslaan) en werkt de preview bij.
window._docPickImage = () => {
  const naamHint = (document.querySelector('#archief-form [name="name"]')?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
  window.mediaPicker.open({
    type: 'afbeelding',
    suggestedName: naamHint || '',
    onSelect: (fileId) => {
      const hidden = document.getElementById('editor-doc-imageid');
      if (hidden) hidden.value = fileId;
      const preview = document.getElementById('editor-file-preview');
      if (preview) preview.innerHTML = `<img src="${api.fileUrl(fileId)}" class="w-full max-h-40 object-contain rounded">`;
      // Een eventuele upload-keuze vervalt — bibliotheekafbeelding wint
      const fileInput = document.getElementById('editor-file-input');
      if (fileInput) fileInput.value = '';
    },
  });
};

// If img fails to load, check if it's a PDF or audio and embed accordingly
window._tryPdfEmbed = async (id, imgEl) => {
  const container = document.getElementById(`doc-file-container-${id}`);
  if (!container) return;
  try {
    const res = await fetch(api.fileUrl(id), { method: 'HEAD' });
    if (!res.ok) { container.style.display = 'none'; return; }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('audio')) {
      const fileUrl = api.fileUrl(id);
      container.innerHTML = `<div class="bg-room-elevated rounded-lg p-4">
        <div class="text-xs font-cinzel text-ink-dim uppercase tracking-wide mb-2">\ud83c\udfb5 Geluidsfragment</div>
        <audio controls class="w-full" src="${fileUrl}"></audio>
      </div>`;
    } else if (ct.includes('pdf')) {
      renderPdfViewer(container, api.fileUrl(id));
    } else {
      container.style.display = 'none';
    }
  } catch {
    container.style.display = 'none';
  }
};

// Fallback for editor image preview when file is not an image (e.g. audio/pdf)
window._docPreviewFallback = async (imgEl, id) => {
  imgEl.style.display = 'none';
  try {
    const res = await fetch(api.fileUrl(id), { method: 'HEAD' });
    if (!res.ok) return;
    const ct = res.headers.get('content-type') || '';
    const preview = document.getElementById('editor-file-preview');
    if (!preview) return;
    if (ct.includes('audio')) {
      preview.innerHTML = `<audio controls class="w-full mt-1" src="${api.fileUrl(id)}"></audio>`;
    } else if (ct.includes('pdf')) {
      preview.innerHTML = `<div class="text-sm text-ink-medium p-2 bg-room-elevated rounded">\ud83d\udcc4 PDF-bestand</div>`;
    }
  } catch { /* ignore */ }
};

async function renderPdfViewer(container, url) {
  const pdf = await window.pdfjsLib.getDocument(url).promise;
  container.innerHTML = '<div class="flex flex-col gap-3"></div>';
  const stack = container.firstElementChild;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = container.clientWidth / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'w-full rounded border border-room-border cursor-pointer hover:border-gold-dim transition';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvas.addEventListener('click', () => {
      const dataUrl = canvas.toDataURL();
      window.app.openLightbox(dataUrl, `Pagina ${i}`);
    });
    stack.appendChild(canvas);
  }
}

// ── Editor ──
export function openArchiefEditor(editId) {
  window._openArchiefEditor(editId);
}

let editorTags = { npcs: [], locs: [], orgs: [], items: [], docs: [] };

let allNames = {};

window._openArchiefEditor = async (editId) => {
  let d = null;
  if (editId) {
    try { d = await api.getArchief(editId); } catch { return; }
  }
  editorTags = {
    npcs:  d?.npcs?.slice()  || [],
    locs:  d?.locs?.slice()  || [],
    orgs:  d?.orgs?.slice()  || [],
    items: d?.items?.slice() || [],
    docs:  d?.docs?.slice()  || [],
  };
  allNames = await api.allNames();

  let body = `<form id="archief-form" class="space-y-4">`;

  // ── Twee-kolom layout ──
  body += `<div class="editor-layout">`;

  // ── Linker kolom: bestand ──
  body += `<div class="editor-col-left">`;
  body += `
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Bestand</label>
      <div id="editor-file-preview" class="mt-1 mb-2 rounded overflow-hidden">
        ${(d?.imageId || editId) ? `<img src="${api.fileForEntity(d)}" class="w-full max-h-40 object-contain rounded" onerror="window._docPreviewFallback(this,'${d?.imageId || editId}')">` : ''}
      </div>
      <input type="hidden" id="editor-doc-imageid" value="${esc(d?.imageId || '')}">
      <div class="flex gap-2 mt-1">
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._docPickImage()" title="Kies een afbeelding uit de bibliotheek">${icon('image')} Uit bibliotheek</button>
        <button type="button" class="dm-btn dm-btn-ghost dm-btn-sm" onclick="document.getElementById('editor-file-input').click()" title="Afbeelding, PDF of audio uploaden">${icon('folder-open')} Upload bestand</button>
      </div>
      <input type="file" id="editor-file-input" accept="image/*,.pdf,application/pdf,audio/mpeg,.mp3,audio/ogg,.ogg,audio/wav,.wav" class="hidden">
      <div id="editor-file-status" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
    </div>
  `;
  body += `</div>`; // end editor-col-left

  // ── Rechter kolom: velden ──
  body += `<div class="editor-col-right">`;
  body += `
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Titel</label>
      <input name="name" value="${esc(d?.name || '')}" required
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Type</label>
      <select name="type" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        ${DOC_TYPES.map(t => `<option value="${t}" ${d?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Hoofdstuk</label>
      <select name="hoofdstuk" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        <option value="">—</option>
        ${Object.entries(meta?.hoofdstukken || {}).map(([k, v]) => `<option value="${k}" ${d?.hoofdstuk === k ? 'selected' : ''}>${v.short}</option>`).join('')}
      </select>
    </div>
  `;
  body += `</div>`; // end editor-col-right
  body += `</div>`; // end editor-layout

  // ── Beschrijving (volledige breedte) ──
  body += `
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold tracking-wide">Beschrijving</label>
      <div class="mt-1">
        ${fmtToolbar('ta_desc')}
        <textarea id="ta_desc" name="desc" rows="4"
          onkeydown="window._fmtKey(event)"
          class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(d?.desc || '')}</textarea>
      </div>
    </div>
  `;

  // ── Perkament tekst (uitklapbaar) ──
  if (editId) {
    const tekst = archiefData.tekstContent?.[editId] || '';
    body += `
      <details class="cs-accordion"${tekst ? ' open' : ''}>
        <summary class="cs-accordion-head">
          <span>Perkament tekst</span>
          <span class="cs-accordion-chevron">▾</span>
        </summary>
        <div class="cs-accordion-body">
          <textarea id="tekst-editor-${editId}" rows="7"
            oninput="window._saveTekst('${editId}')"
            class="w-full px-3 py-2 bg-parchment-letter text-[#2a2015] font-fell text-sm border border-[#d4c9a8] rounded focus:outline-none"
            placeholder="---titel---\nDocument Titel\n---\nTekst hier...\n--handtekening--\nNaam">${esc(tekst)}</textarea>
          <div id="tekst-save-${editId}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
        </div>
      </details>
    `;
  }

  // ── Verbindingen (uitklapbaar) ──
  const tagMeta = {
    npcs:  { icon: icon('user'),                        label: 'Personages',    chip: 'chip-npc',  nameKey: 'personages' },
    locs:  { icon: icon('castle', {cls:'icon-gi'}),     label: 'Locaties',      chip: 'chip-loc',  nameKey: 'locaties' },
    orgs:  { icon: icon('landmark'),                    label: 'Organisaties',  chip: 'chip-org',  nameKey: 'organisaties' },
    items: { icon: icon('package'),                     label: 'Voorwerpen',    chip: 'chip-item', nameKey: 'voorwerpen' },
    docs:  { icon: icon('scroll-text'),                 label: 'Documenten',    chip: 'chip-doc',  nameKey: 'archief' },
  };
  const _hasAnyTags = Object.values(editorTags).some(arr => arr.length > 0);
  body += `
    <details class="cs-accordion"${_hasAnyTags ? ' open' : ''}>
      <summary class="cs-accordion-head">
        <span>Verbindingen</span>
        <span class="cs-accordion-chevron">▾</span>
      </summary>
      <div class="cs-accordion-body space-y-3">
  `;
  for (const [field, fm] of Object.entries(tagMeta)) {
    body += `
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold tracking-wide mb-1">${fm.label}</div>
        <div id="atags-${field}" class="flex flex-wrap gap-1 mb-1">
          ${editorTags[field].map(n => `<span class="chip ${fm.chip}">${esc(n)} <span class="cursor-pointer ml-1" data-field="${field}" data-name="${esc(n)}" onclick="window._removeATag(this.dataset.field,this.dataset.name)">×</span></span>`).join('')}
        </div>
        <div class="flex gap-1">
          <div class="flex-1 autocomplete-wrap">
            <input id="atag-input-${field}" placeholder="${fm.label}..."
              class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none"
              oninput="window._showASuggestions('${field}','${fm.nameKey}')"
              onkeydown="window._handleATagKey(event,'${field}')">
            <div id="atag-suggestions-${field}" class="autocomplete-list"></div>
          </div>
          <button type="button" onclick="window._addATag('${field}')"
            class="px-2 py-1 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright">+</button>
        </div>
      </div>
    `;
  }
  body += `</div></details>`;

  // ── DM Notities (uitklapbaar) ──
  if (editId) {
    const dmNote = (await api.getNote(editId).catch(() => ({}))).note || '';
    body += `
      <details class="cs-accordion"${dmNote ? ' open' : ''}>
        <summary class="cs-accordion-head">
          <span>DM Notities</span>
          <span class="cs-accordion-chevron">▾</span>
        </summary>
        <div class="cs-accordion-body">
          <textarea id="dm-note-editor-${editId}" rows="3"
            class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
            placeholder="Notities...">${esc(dmNote)}</textarea>
        </div>
      </details>
    `;
  }

  body += `
    <div class="flex gap-2 pt-2">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition" title="Opslaan">${icon('save')}</button>
      ${editId ? `<button type="button" onclick="window._deleteDoc('${editId}')" class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition" title="Verwijderen">${icon('trash')}</button>` : ''}
      <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">${icon('x')}</button>
    </div>
  </form>`;

  openModal(editId ? 'Document bewerken' : 'Nieuw document', '', body);


  // File input preview
  document.getElementById('editor-file-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Max 50MB'); ev.target.value = ''; return; }
    // Een nieuwe upload vervangt een eventueel gekozen bibliotheekafbeelding
    const imgIdEl = document.getElementById('editor-doc-imageid');
    if (imgIdEl) imgIdEl.value = '';
    const preview = document.getElementById('editor-file-preview');
    const status = document.getElementById('editor-file-status');
    if (file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<audio controls class="w-full mt-1" src="${url}"></audio><div class="text-xs text-ink-dim mt-1">\ud83c\udfb5 ${esc(file.name)} (${(file.size / 1024 / 1024).toFixed(1)} MB)</div>`;
    } else if (file.type === 'application/pdf') {
      preview.innerHTML = `<div class="text-sm text-ink-medium p-2 bg-room-elevated rounded">\ud83d\udcc4 ${esc(file.name)} (${(file.size / 1024 / 1024).toFixed(1)} MB)</div>`;
    } else {
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" class="max-h-32 rounded">`;
    }
    status.textContent = 'Wordt geüpload bij opslaan';
    status.style.opacity = '1';
  });

  document.getElementById('archief-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.target);
    const payload = {
      name: form.get('name'),
      type: form.get('type'),
      hoofdstuk: form.get('hoofdstuk'),
      desc: form.get('desc'),
      imageId: document.getElementById('editor-doc-imageid')?.value || '',
      npcs:  editorTags.npcs,
      locs:  editorTags.locs,
      orgs:  editorTags.orgs,
      items: editorTags.items,
      docs:  editorTags.docs,
    };
    try {
      let docId = editId;
      if (editId) await api.updateArchief(editId, payload);
      else {
        const created = await api.createArchief(payload);
        docId = created.id;
      }
      // Upload file if one was selected
      const fileInput = document.getElementById('editor-file-input');
      if (fileInput?.files?.[0]) {
        await api.uploadFile(docId, fileInput.files[0]);
      }
      // Save parchment text
      const tekstEl = document.getElementById(`tekst-editor-${docId}`);
      if (tekstEl) {
        await api.saveTekst(docId, tekstEl.value);
        archiefData.tekstContent[docId] = tekstEl.value;
      }
      // Save DM note
      const noteEl = document.getElementById(`dm-note-editor-${docId}`);
      if (noteEl) {
        await api.saveNote(docId, noteEl.value);
      }
      closeModal();
      renderDocumenten();
    } catch (err) { alert('Fout: ' + err.message); }
  });
};

const ATAG_NAME_KEY = { npcs: 'personages', locs: 'locaties', orgs: 'organisaties', items: 'voorwerpen', docs: 'archief' };

window._addATag = (field, name) => {
  const input = document.getElementById(`atag-input-${field}`);
  const val = (name || input.value).trim();
  if (!val || editorTags[field].includes(val)) return;
  editorTags[field].push(val);
  input.value = '';
  window._hideASuggestions(field);
  refreshATags(field);
};

window._removeATag = (field, name) => {
  editorTags[field] = editorTags[field].filter(n => n !== name);
  refreshATags(field);
};

window._showASuggestions = (field, nameKey) => {
  const input = document.getElementById(`atag-input-${field}`);
  const list = document.getElementById(`atag-suggestions-${field}`);
  const q = input.value.trim().toLowerCase();
  const names = (allNames[nameKey] || []).filter(n =>
    !editorTags[field].includes(n) && (!q || n.toLowerCase().includes(q))
  );
  if (names.length === 0) { list.classList.remove('open'); return; }
  list.innerHTML = names.map(n =>
    `<div class="autocomplete-item" onmousedown="window._addATag('${field}','${esc(n)}')">${esc(n)}</div>`
  ).join('');
  list.classList.add('open');
};

window._hideASuggestions = (field) => {
  const list = document.getElementById(`atag-suggestions-${field}`);
  if (list) list.classList.remove('open');
};

window._handleATagKey = (ev, field) => {
  if (ev.key === 'Enter') { ev.preventDefault(); window._addATag(field); }
  if (ev.key === 'Escape') { window._hideASuggestions(field); }
};

document.addEventListener('focusout', (ev) => {
  if (ev.target.id?.startsWith('atag-input-')) {
    const field = ev.target.id.replace('atag-input-', '');
    setTimeout(() => window._hideASuggestions(field), 150);
  }
  if (ev.target.id?.startsWith('log-tag-input-')) {
    const field = ev.target.id.replace('log-tag-input-', '');
    setTimeout(() => window._hideLogSuggestions(field), 150);
  }
});

function refreshATags(field) {
  const fm = { npcs: 'chip-npc', locs: 'chip-loc', orgs: 'chip-org', items: 'chip-item', docs: 'chip-doc' };
  const container = document.getElementById(`atags-${field}`);
  if (!container) return;
  container.innerHTML = editorTags[field].map(n =>
    `<span class="chip ${fm[field]}">${esc(n)} <span class="cursor-pointer ml-1" data-field="${field}" data-name="${esc(n)}" onclick="window._removeATag(this.dataset.field,this.dataset.name)">\u00d7</span></span>`
  ).join('');
}

window._deleteDoc = async (id) => {
  if (!confirm('Document verwijderen?')) return;
  await api.deleteArchief(id);
  closeModal();
  renderDocumenten();
};
