import { api } from './api.js';

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
let searchQuery = '';
let archiefData = { documents: [], logEntries: [], hiddenLinks: {}, tekstContent: {} };
let meta = null;

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const isDM = () => window.app.isDM();
const esc = (...a) => window.app.esc(...a);
const mdToHtml = (...a) => window.app.mdToHtml(...a);
const openModal = (...a) => window.app.openModal(...a);
const closeModal = (...a) => window.app.closeModal(...a);
const openLightbox = (...a) => window.app.openLightbox(...a);

function _sortKey(name) {
  return (name || '').replace(/^(de|het|'t)\s+/i, '').trim();
}

function fmtToolbar(id) {
  return `<div class="flex gap-1 mb-1">
    <button type="button" title="Vet (Ctrl+B)" onclick="window._fmt('${id}','**')"
      class="w-7 h-6 text-xs font-black border border-room-border rounded bg-room-bg hover:bg-room-elevated transition font-cinzel leading-none">B</button>
    <button type="button" title="Cursief (Ctrl+I)" onclick="window._fmt('${id}','*')"
      class="w-7 h-6 text-xs border border-room-border rounded bg-room-bg hover:bg-room-elevated transition font-fell italic leading-none">I</button>
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
    <div class="section-banner">
      <div class="section-banner-title">
        <span>📜</span>
        <span>Documenten</span>
        <span class="font-fell font-normal normal-case tracking-normal text-ink-faint text-xs italic ml-1">Brieven, kranten, kaarten en manuscripten</span>
      </div>
      <div class="section-banner-line"></div>
    </div>

    <!-- Search -->
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">\u2315</span>
        <input type="text" class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Zoek document..." value="${esc(searchQuery)}" oninput="window._documentenSearch(this.value)">
      </div>
      <span class="results-count text-ink-faint text-xs font-mono">${docs.length} resultaten</span>
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
  };
}

function _refreshDocGrid(docs, container) {
  const grid = container.querySelector('.doc-grid');
  if (!grid) return;
  const totalDocs = (archiefData.documents || []).length;
  grid.innerHTML = docs.length === 0
    ? `<div class="col-span-full text-center py-20 text-ink-faint">
        <div class="text-5xl mb-4 opacity-40">📜</div>
        <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">
          ${searchQuery || totalDocs > 0 ? 'Geen documenten gevonden' : 'Het archief is nog leeg...'}
        </div>
        ${!searchQuery && totalDocs === 0 && isDM()
          ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om een document toe te voegen</div>`
          : ''}
       </div>`
    : docs.map(d => renderDocCard(d)).join('');
  const countEl = container.querySelector('.results-count');
  if (countEl) countEl.textContent = `${docs.length} resultaten`;
}

export async function renderLogboek() {
  const container = $('#section-logboek');
  try {
    archiefData = await api.listArchief();
    meta = window.app.state.meta;
  } catch { /* empty */ }

  const allEntries = archiefData.sessieLog || [];
  const entries = isDM() ? allEntries : allEntries.filter(e => e.visible);
  const hk = meta?.hoofdstukken || {};

  // Group documents by chapter (hidden docs only visible for DM)
  const allDocs = archiefData.documents || [];
  const docsByChapter = {};
  for (const d of allDocs) {
    if (!isDM() && (d.state || 'hidden') === 'hidden') continue;
    const ch = d.hoofdstuk || '_';
    if (!docsByChapter[ch]) docsByChapter[ch] = [];
    docsByChapter[ch].push(d);
  }
  for (const ch of Object.keys(docsByChapter)) {
    docsByChapter[ch].sort((a, b) => _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' }));
  }

  // Group by chapter
  const groups = {};
  for (const e of entries) {
    const ch = e.hoofdstuk || '_';
    if (!groups[ch]) groups[ch] = [];
    groups[ch].push(e);
  }
  const sortedChapters = Object.keys(groups).sort((a, b) => {
    return (hk[a]?.num || 99) - (hk[b]?.num || 99);
  });

  let html = '';
  if (entries.length === 0) {
    html = `<div class="text-center py-20 text-ink-faint">
      <div class="text-5xl mb-4 opacity-40">📖</div>
      <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">Het archief is nog leeg...</div>
      ${isDM() ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om een sessie toe te voegen</div>` : ''}
    </div>`;
  } else {
    for (const ch of sortedChapters) {
      const info = hk[ch] || { title: ch, dag: '', num: '?' };
      const chEntries = groups[ch].slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
      html += `
        <div class="mb-12">
          <div class="flex items-baseline gap-3 mb-5 pb-2.5 border-b-2 border-room-border">
            <div class="font-cinzel font-bold text-gold text-xl">Hoofdstuk ${info.num}:</div>
            <div class="font-cinzel font-semibold text-ink-bright text-lg">${esc(info.title)}</div>
            ${info.dag ? `<div class="text-ink-faint text-xs font-mono ml-auto">${esc(info.dag)}</div>` : ''}
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            ${chEntries.map(e => renderSessieEntry(e)).join('')}
          </div>
          ${(docsByChapter[ch] || []).length ? `
          <div class="mt-5 ml-6 pl-5 border-l-2 border-room-border">
            <div class="text-[10px] font-cinzel font-semibold text-ink-faint uppercase tracking-widest mb-2">\ud83d\udcdc Documenten</div>
            <div class="flex flex-wrap gap-2">
              ${(docsByChapter[ch] || []).map(d => renderDocCardCompact(d)).join('')}
            </div>
          </div>` : ''}
        </div>
      `;
    }
  }

  container.innerHTML = `
    <div class="section-banner">
      <div class="section-banner-title">
        <span>📖</span>
        <span>Logboek</span>
        <span class="font-fell font-normal normal-case tracking-normal text-ink-faint text-xs italic ml-1">Verslagen van sessies en avonturen</span>
      </div>
      <div class="section-banner-line"></div>
    </div>
    <div class="flex-1 overflow-y-auto p-6">${html}</div>
  `;
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

  const persChips = [
    ...nieuwP.map(n => `<span class="log-chip log-chip-gold">\u2728 ${esc(n)}</span>`),
    ...terugP.map(n => `<span class="log-chip log-chip-blue">\u21a9 ${esc(n)}</span>`),
    ...legNieuw.map(n => `<span class="log-chip log-chip-gold">\u2728 ${esc(n)}</span>`),
    ...legTerug.map(n => `<span class="log-chip log-chip-blue">\u21a9 ${esc(n)}</span>`),
  ];
  if (persChips.length) sections.push({ label: '\ud83d\udc64 Personages', chips: persChips });

  const locChips = [
    ...nieuwL.map(n => `<span class="log-chip log-chip-green-new">\u2728 ${esc(n)}</span>`),
    ...terugL.map(n => `<span class="log-chip log-chip-green">\u21a9 ${esc(n)}</span>`),
  ];
  if (locChips.length) sections.push({ label: '\ud83c\udff0 Locaties', chips: locChips });

  const orgs = e.organisaties || [];
  if (orgs.length) sections.push({
    label: '\ud83c\udfdb\ufe0f Organisaties',
    chips: orgs.map(n => `<span class="log-chip log-chip-seal">${esc(n)}</span>`),
  });

  if (items.length) sections.push({
    label: '\u2694\ufe0f Voorwerpen',
    chips: items.map(n => `<span class="log-chip log-chip-orange">${esc(n)}</span>`),
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
    const url = api.fileUrl(items[0].id);
    const isVis = items[0].visible !== false;
    return `
      <div class="detail-hero mb-${dm ? 2 : 6}" onclick="window.app.openLightbox('${url}','')">
        <img src="${url}" class="detail-hero-img${!isVis && dm ? ' opacity-50' : ''}">
        <div class="detail-hero-overlay"></div>
      </div>
      ${items[0].caption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-1 mb-2 italic">${esc(items[0].caption)}</p>` : ''}
      ${dm ? `<div class="flex justify-center mb-4">
        <button id="carousel-vis-btn-${key}"
          onclick="window._toggleImageVisible('${key}','${items[0].id}',${!isVis})"
          class="${_visBtn(isVis ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright')}">
          ${isVis ? '👁 Zichtbaar voor spelers' : '🔒 Verborgen voor spelers'}
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
              const url = api.fileUrl(id);
              const isVis = visible !== false;
              return `<div class="flex-shrink-0 w-full flex justify-center bg-room-elevated/30 relative">
                <img src="${url}" class="max-h-[32rem] w-full object-contain cursor-pointer${!isVis && dm ? ' opacity-50' : ''}"
                  onclick="window.app.openLightbox('${url}','')">
                ${!isVis && dm ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span class="bg-black/60 text-ink-dim text-xs px-2 py-1 rounded font-mono">🔒 Verborgen</span>
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
          ${items[0].visible !== false ? '👁 Zichtbaar voor spelers' : '🔒 Verborgen voor spelers'}
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
    btn.textContent = isVis ? '👁 Zichtbaar voor spelers' : '🔒 Verborgen voor spelers';
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
    btn.textContent = newVisible ? '👁 Zichtbaar voor spelers' : '🔒 Verborgen voor spelers';
    btn.className   = _visBtn(newVisible ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-room-border text-ink-dim hover:text-ink-bright');
    btn.onclick = () => window._toggleImageVisible(sessieId, imgId, !newVisible);
  }
};

// ── Logboek card (compact) ──

function renderSessieEntry(e) {
  const firstRaw = e.images?.[0];
  const firstImg = firstRaw ? api.fileUrl(typeof firstRaw === 'string' ? firstRaw : firstRaw.id) : null;
  const hk = meta?.hoofdstukken || {};
  const chapter = hk[e.hoofdstuk];
  const chapterLabel = chapter ? `Hoofdstuk ${chapter.num}: ${chapter.title}` : '';
  return `
    <div class="entity-card${isDM() && !e.visible ? ' card-hidden' : ''}"
      onclick="window._openSessieDetail('${e.id}')">
      ${isDM() ? `
        <div class="dm-only absolute top-7 right-2 z-10 flex flex-col gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="${e.visible ? 'Verbergen' : 'Zichtbaar maken'}" onclick="event.stopPropagation();window._toggleSessieVis('${e.id}',${!!e.visible})">${e.visible ? '\ud83d\udc41' : '\ud83d\udd12'}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="Bewerken" onclick="event.stopPropagation();window._openSessieEditor('${e.id}')">&#9998;</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            title="Verwijderen" onclick="event.stopPropagation();window._deleteSessie('${e.id}')">&#10005;</button>
        </div>
      ` : ''}
      <div class="card-accent bar-logboek"></div>
      ${firstImg ? `<img class="card-img w-full object-cover" src="${firstImg}" onerror="this.style.display='none'">` : ''}
      <div class="px-4 pt-3 pb-4">
        ${chapterLabel ? `<div class="text-[10px] font-cinzel text-gold-dim uppercase tracking-wide mb-0.5">${esc(chapterLabel)}</div>` : ''}
        ${e.datum ? `<div class="text-[11px] font-mono text-ink-faint mb-1">${esc(e.datum)}</div>` : ''}
        ${e.korteSamenvatting
          ? `<div class="font-cinzel font-semibold text-ink-bright text-sm leading-snug mb-1">${esc(e.korteSamenvatting)}</div>`
          : `<div class="text-ink-dim text-xs italic">Geen titel</div>`}
        ${e.samenvatting ? `<p class="text-[11px] text-ink-dim font-fell italic line-clamp-2 leading-snug">${esc(e.samenvatting.replace(/^#+\s*/gm,'').replace(/\*\*/g,'').replace(/\*/g,'').replace(/\n/g,' ').slice(0,110))}</p>` : ''}
      </div>
    </div>`;
}

// ── Logboek detail modal ──

window._openSessieDetail = (id) => {
  const e = (archiefData.sessieLog || []).find(s => s.id === id);
  if (!e) return;
  const hk = meta?.hoofdstukken || {};
  const chapter = hk[e.hoofdstuk] || {};
  const images = e.images || [];

  const datelineParts = [
    chapter.short && chapter.short !== e.korteSamenvatting ? chapter.short : null,
    e.datum,
  ].filter(Boolean);

  const body = `
    ${_renderCarousel(id, images, { dmControls: isDM() })}
    ${datelineParts.length ? `<div class="log-dateline">${datelineParts.map(p => esc(p)).join(' &mdash; ')}</div>` : ''}
    ${e.samenvatting ? `<div class="log-entry">${mdToHtml(e.samenvatting)}</div>` : ''}
    ${_renderSessieChips(e)}
    ${isDM() ? `
      <div class="dm-only mt-4 pt-4 border-t border-room-border flex gap-2">
        <button class="px-3 py-1.5 text-sm rounded bg-gold-dim text-room-bg font-cinzel font-semibold hover:bg-gold transition"
          onclick="window.app.closeModal();window._openSessieEditor('${e.id}')" title="Bewerken">&#9998;</button>
        <button class="px-3 py-1.5 text-sm rounded bg-seal/20 text-seal hover:bg-seal/40 transition"
          onclick="window._deleteSessie('${e.id}')" title="Verwijderen">&#x1F5D1;</button>
      </div>` : ''}
  `;
  const subtitle = [chapter.short, e.datum].filter(Boolean).join(' \u00b7 ');
  openModal(e.korteSamenvatting || 'Sessie', subtitle, body);

  const _accentEl = document.getElementById('m-accent');
  if (_accentEl) _accentEl.className = 'modal-accent bar-logboek';
};

export function openLogboekEditor(editId) {
  window._openSessieEditor(editId);
}

window._toggleSessieVis = async (id, currentVisible) => {
  await api.updateSessieLog(id, { visible: !currentVisible });
  renderLogboek();
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
              ${img.visible ? '👁' : '🔒'}</button>
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
  const short = `H${num} \u00b7 ${title.length > 22 ? title.slice(0, 22) + '\u2026' : title}`;
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
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Hoofdstuk</label>
        <div class="flex gap-1 mt-1">
          <select id="hk-select" name="hoofdstuk" class="flex-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <option value="">—</option>
            ${Object.entries(hk).sort(([,a],[,b]) => a.num - b.num).map(([k, v]) =>
              `<option value="${k}" ${e?.hoofdstuk === k ? 'selected' : ''}>${v.short}</option>`
            ).join('')}
          </select>
          <button type="button" title="Nieuw hoofdstuk toevoegen"
            onclick="document.getElementById('new-hk-panel').classList.toggle('hidden')"
            class="px-2.5 py-1 bg-room-elevated border border-room-border rounded text-ink-dim hover:text-gold hover:border-gold-dim transition text-base leading-none">+</button>
        </div>
        <div id="new-hk-panel" class="hidden mt-2 p-3 bg-room-elevated/60 border border-room-border rounded space-y-2">
          <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">Nieuw hoofdstuk</div>
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
            class="px-3 py-1.5 bg-gold-dim text-room-bg text-sm font-cinzel rounded hover:bg-gold transition" title="Toevoegen">✚</button>
        </div>
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Sessiedatum</label>
        <input type="date" name="datum" value="${esc(e?.datum || '')}"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
      </div>
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Korte samenvatting</label>
      <input name="korteSamenvatting" value="${esc(e?.korteSamenvatting || '')}"
        placeholder="Één zin die de sessie omschrijft..."
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Uitgebreide samenvatting</label>
      <div class="mt-1">
        ${fmtToolbar('ta_samenvatting')}
        <textarea id="ta_samenvatting" name="samenvatting" rows="12"
          onkeydown="window._fmtKey(event)"
          class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none">${esc(e?.samenvatting || '')}</textarea>
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2 pb-1 border-b border-room-border">\ud83d\udc64 Personages</div>
      <div class="grid grid-cols-2 gap-3">
        ${renderLogTagEditor('nieuwPersonages',       '\u2728 Nieuw',       'bg-gold/10 border-gold/30 text-gold')}
        ${renderLogTagEditor('terugkerendPersonages', '\ud83d\udd04 Terugkerend', 'bg-blue-ink/10 border-blue-ink/30 text-[#7ab0d4]')}
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2 pb-1 border-b border-room-border">\ud83c\udff0 Locaties</div>
      <div class="grid grid-cols-2 gap-3">
        ${renderLogTagEditor('nieuwLocaties',       '\u2728 Nieuw',       'bg-green-wax/10 border-green-wax/30 text-green-wax')}
        ${renderLogTagEditor('terugkerendLocaties', '\ud83d\udd04 Terugkerend', 'bg-green-wax/10 border-green-wax/20 text-green-wax')}
      </div>
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2 pb-1 border-b border-room-border">\ud83c\udfdb\ufe0f Organisaties</div>
      ${renderLogTagEditor('organisaties', 'Organisaties', 'bg-seal/10 border-seal/30 text-seal')}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${renderLogTagEditor('voorwerpen', '\u2694\ufe0f Voorwerpen', 'bg-orange/10 border-orange/30 text-orange')}
      ${renderLogTagEditor('docs',       '\ud83d\udcdc Documenten', 'bg-purple-codex/15 border-purple-codex/35 text-purple-codex')}
    </div>
    <div>
      <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2">\ud83d\uddbc\ufe0f Afbeeldingen</div>
      <div id="log-img-preview" class="flex flex-wrap gap-2 mb-2 min-h-[2rem] items-center">
        <span class="text-xs text-ink-faint italic">Nog geen afbeeldingen</span>
      </div>
      <label class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright cursor-pointer transition">
        + Toevoegen
        <input type="file" accept="image/*" multiple class="hidden" onchange="window._addLogImages(this.files)">
      </label>
    </div>
    <div class="flex gap-2 pt-2">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition" title="Opslaan">&#x1F4BE;</button>
      ${editId ? `<button type="button" onclick="window._deleteSessie('${editId}')" class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition" title="Verwijderen">&#x1F5D1;</button>` : ''}
      <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">✕</button>
    </div>
  </form>`;

  openModal(editId ? 'Sessie bewerken' : 'Nieuwe sessie', '', body);

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
      <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">${label}</div>
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
  if (!confirm('Sessie-entry verwijderen?')) return;
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
  const state = d.state || 'hidden';
  const isBlurred = !isDM() && state === 'blurred';
  const dimmed = isDM() && state !== 'revealed';
  return `
    <div class="flex items-center gap-2 w-44 shrink-0 bg-room-elevated border border-room-border rounded-lg overflow-hidden cursor-pointer hover:border-room-border-light transition${dimmed ? ' opacity-60' : ''}"
      onclick="window._openDoc('${d.id}')">
      <img class="w-10 h-12 object-cover shrink-0${isBlurred ? ' blur-sm' : ''}"
        src="${api.fileUrl(d.id)}" onerror="this.style.display='none'">
      <div class="min-w-0 flex-1 py-1.5 pr-2">
        <div class="text-[11px] font-cinzel font-semibold text-ink-bright leading-tight truncate${isBlurred ? ' blur-sm select-none' : ''}">${esc(d.name)}</div>
        ${d.type ? `<div class="text-[10px] text-ink-faint italic mt-0.5">${esc(d.type)}</div>` : ''}
      </div>
      ${dimmed ? `<div class="text-[11px] pr-1.5 shrink-0">${state === 'blurred' ? '\ud83d\udc41' : '\ud83d\udd12'}</div>` : ''}
    </div>
  `;
}

function renderDocCard(d) {
  const state = d.state || 'hidden';
  const hoofdstuk = meta?.hoofdstukken?.[d.hoofdstuk];
  const chapterLabel = hoofdstuk ? hoofdstuk.short : '';
  const hiddenLinks = archiefData.hiddenLinks?.[d.id] || {};
  const npcs = (d.npcs || []).filter(n => !(hiddenLinks.npcs || []).includes(n));
  const locs = (d.locs || []).filter(n => !(hiddenLinks.locs || []).includes(n));
  const isBlurred = !isDM() && state === 'blurred';
  const metaText = [d.type, chapterLabel].filter(Boolean).join(' \u00b7 ');
  const chips = [
    ...npcs.slice(0, 2).map(n => `<span class="chip chip-npc">\ud83d\udc64 ${esc(n)}</span>`),
    ...locs.slice(0, 2).map(n => `<span class="chip chip-loc">\ud83c\udff0 ${esc(n)}</span>`),
  ];

  return `
    <div class="entity-card${isDM() && state === 'hidden' ? ' card-hidden' : isDM() && state === 'blurred' ? ' opacity-60' : ''}"
      onclick="window._openDoc('${d.id}')">
      ${isDM() ? (() => {
        const _visIcon  = state === 'hidden' ? '\ud83d\udd12' : state === 'blurred' ? '\ud83d\udc64' : '\ud83d\udc41';
        const _visTitle = state === 'revealed' ? 'Verbergen  \u00b7  Shift: vaag maken'
                        : state === 'blurred'  ? 'Onthullen  \u00b7  Shift: verbergen'
                        :                        'Onthullen  \u00b7  Shift: vaag maken';
        return `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded ${state === 'blurred' ? 'bg-gold-dim/80' : 'bg-black/75'} hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._toggleDocState('${d.id}','${state}',window._shiftHeld)"
            title="${_visTitle}">${_visIcon}</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._openArchiefEditor('${d.id}')"
            title="Bewerken">&#9998;</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._deleteDoc('${d.id}')"
            title="Verwijderen">&#10005;</button>
        </div>`;
      })() : ''}
      <div class="card-accent bar-documenten"></div>
      <img class="card-img w-full object-cover${isBlurred ? ' blur-lg select-none pointer-events-none' : ''}"
        src="${api.fileUrl(d.id)}" onerror="this.style.display='none'">
      <div class="card-body px-4 pt-3 pb-3">
        <div class="flex items-start gap-2.5 mb-2">
          <div class="card-icon">${d.icon || '\ud83d\udcdc'}</div>
          <div class="min-w-0 flex-1">
            <div class="font-cinzel font-bold text-ink-bright text-sm leading-tight truncate">${esc(d.name)}</div>
            ${metaText ? `<div class="text-[11px] text-ink-dim italic mt-0.5">${esc(metaText)}</div>` : ''}
          </div>
        </div>
        ${isBlurred
          ? `<p class="text-xs text-ink-faint italic font-crimson">Nog niet volledig onthuld\u2026</p>`
          : `${d.desc ? `<p class="text-xs text-ink-medium line-clamp-2 mb-2 font-crimson leading-relaxed">${esc(d.desc)}</p>` : ''}
             ${chips.length ? `<div class="flex flex-wrap gap-1">${chips.join('')}</div>` : ''}`
        }
      </div>
    </div>
  `;
}


// ── Document detail ──
window._openDoc = async (id) => {
  let d;
  try { d = await api.getArchief(id); } catch { return; }
  const state = d.state || 'hidden';
  const isBlurred = !isDM() && state === 'blurred';
  const hoofdstuk = meta?.hoofdstukken?.[d.hoofdstuk];
  const hiddenLinks = archiefData.hiddenLinks?.[id] || {};
  const tekst = archiefData.tekstContent?.[id] || '';

  let body = '';

  // Description
  if (d.desc) {
    body += `<p class="text-sm mb-4 font-crimson ${isBlurred ? 'blur-sm select-none' : ''}">${mdToHtml(d.desc)}</p>`;
  }

  // File (image or PDF) — detect type first, render after modal is open
  const fileUrl = api.fileUrl(d.id);
  body += `<div class="mb-4" id="doc-file-container-${d.id}"></div>`;

  // Parchment text
  if (tekst) {
    body += `<div class="parchment-block mb-4 ${isBlurred ? 'blur-md select-none pointer-events-none' : ''}">${renderParchment(tekst)}</div>`;
  }

  // Connections
  const showNpcs  = isDM() ? (d.npcs  || []) : (d.npcs  || []).filter(n => !(hiddenLinks.npcs  || []).includes(n));
  const showLocs  = isDM() ? (d.locs  || []) : (d.locs  || []).filter(n => !(hiddenLinks.locs  || []).includes(n));
  const showOrgs  = isDM() ? (d.orgs  || []) : (d.orgs  || []).filter(n => !(hiddenLinks.orgs  || []).includes(n));
  const showItems = isDM() ? (d.items || []) : (d.items || []).filter(n => !(hiddenLinks.items || []).includes(n));
  const showDocs  = isDM() ? (d.docs  || []) : (d.docs  || []).filter(n => !(hiddenLinks.docs  || []).includes(n));

  const _connBlock = (list, field, chipCls, icon, label) => {
    if (!list.length) return '';
    return `
      <div class="mb-3">
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">${label}</div>
        <div class="flex flex-wrap gap-1">
          ${list.map(n => {
            const hidden = (hiddenLinks[field] || []).includes(n);
            return `<span class="chip ${chipCls}">${icon} ${esc(n)}
              ${isDM() ? `<span class="ml-1 cursor-pointer opacity-60 hover:opacity-100" onclick="event.stopPropagation();window._toggleLinkVis('${d.id}','${field}','${esc(n)}')">${hidden ? '👁' : '👁‍🗨'}</span>` : ''}
            </span>`;
          }).join('')}
        </div>
      </div>
    `;
  };

  body += _connBlock(showNpcs,  'npcs',  'chip-npc',  '👤', 'Personages');
  body += _connBlock(showLocs,  'locs',  'chip-loc',  '🏰', 'Locaties');
  body += _connBlock(showOrgs,  'orgs',  'chip-org',  '🏛️', 'Organisaties');
  body += _connBlock(showItems, 'items', 'chip-item', '🎒', 'Voorwerpen');

  if (showDocs.length) {
    body += `
      <div class="mb-3">
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">Gerelateerde documenten</div>
        <div class="flex flex-wrap gap-1">
          ${showDocs.map(n => `<span class="chip chip-doc">📜 ${esc(n)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // DM controls
  if (isDM()) {
    body += `
      <div class="dm-only mt-4 pt-4 border-t border-room-border">
        <div class="flex gap-2">
          ${['hidden','blurred','revealed'].map(s => `
            <button class="px-3 py-1 text-sm rounded transition ${state === s ? 'bg-gold-dim text-room-bg font-semibold' : 'bg-room-elevated text-ink-dim hover:text-ink-bright'}"
              onclick="window._setDocState('${d.id}','${s}')">
              ${s === 'hidden' ? '\ud83d\udd12 Verborgen' : s === 'blurred' ? '\ud83d\udc41\u200d\ud83d\udde8 Wazig' : '\u2728 Onthuld'}
            </button>
          `).join('')}
          <button class="px-3 py-1 text-sm rounded bg-gold-dim text-room-bg font-semibold ml-auto"
            onclick="window._openArchiefEditor('${d.id}')">
            \u270f Bewerken
          </button>
          <button class="w-8 h-8 flex items-center justify-center rounded bg-seal/20 text-seal hover:bg-seal/40 transition"
            title="Verwijderen"
            onclick="window._deleteDoc('${d.id}')">
            \ud83d\uddd1
          </button>
        </div>
      </div>
    `;
  }

  const subtitle = [d.type, meta?.hoofdstukken?.[d.hoofdstuk]?.short].filter(Boolean).join(' \u00b7 ');
  openModal(d.name, subtitle, body);

  // Load file into container after modal is in DOM
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
            fileContainer.innerHTML = `<div class="rounded bg-room-elevated p-8 text-center select-none"><div class="text-4xl mb-2 opacity-30">\ud83d\udd12</div><div class="text-ink-faint text-sm italic">Document nog niet volledig onthuld</div></div>`;
          }
        } else if (ct.includes('audio')) {
          fileContainer.innerHTML = `<div class="bg-room-elevated rounded-lg p-4">
            <div class="text-xs font-cinzel text-ink-dim uppercase tracking-wide mb-2">\ud83c\udfb5 Geluidsfragment</div>
            <audio controls class="w-full" src="${fileUrl}"></audio>
          </div>`;
        } else if (ct.includes('pdf')) {
          await renderPdfViewer(fileContainer, fileUrl);
        } else if (ct.includes('image')) {
          fileContainer.innerHTML = `<img src="${fileUrl}" class="w-full max-h-80 object-contain rounded cursor-pointer" onclick="window.app.openLightbox('${fileUrl}','${esc(d.name)}')">`;
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
      html += `<div class="parch-title">${esc(lines[i + 1])}</div>`;
      i += 2; continue;
    }
    if (/^---\s*$/.test(line.trim())) {
      html += '<hr class="parch-rule">';
      i++; continue;
    }
    if (line.trim() === '--handtekening--' && i + 1 < lines.length) {
      html += `<div class="parch-sig">${esc(lines[i + 1])}</div>`;
      i += 2; continue;
    }
    html += `<span>${esc(line)}</span><br>`;
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
  await api.setArchiefState(id, next);
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

  let body = `<form id="archief-form" class="space-y-4">
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Titel</label>
      <input name="name" value="${esc(d?.name || '')}" required
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Type</label>
        <select name="type" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          ${DOC_TYPES.map(t => `<option value="${t}" ${d?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Categorie</label>
        <select name="cat" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          ${DOC_CATS.map(c => `<option value="${c}" ${d?.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3">
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Hoofdstuk</label>
        <select name="hoofdstuk" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">—</option>
          ${Object.entries(meta?.hoofdstukken || {}).map(([k, v]) => `<option value="${k}" ${d?.hoofdstuk === k ? 'selected' : ''}>${v.short}</option>`).join('')}
        </select>
      </div>
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Beschrijving</label>
      <div class="mt-1">
        ${fmtToolbar('ta_desc')}
        <textarea id="ta_desc" name="desc" rows="4"
          onkeydown="window._fmtKey(event)"
          class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(d?.desc || '')}</textarea>
      </div>
    </div>
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Bestand</label>
      <div id="editor-file-preview" class="mt-1 mb-2">${editId ? `<img src="${api.fileUrl(editId)}" class="max-h-32 rounded" onerror="window._docPreviewFallback(this,'${editId}')">` : ''}</div>
      <div class="upload-zone mt-1" onclick="document.getElementById('editor-file-input').click()">
        \ud83d\udcc2 Afbeelding, PDF of MP3 uploaden (max 50MB)
      </div>
      <input type="file" id="editor-file-input" accept="image/*,.pdf,application/pdf,audio/mpeg,.mp3,audio/ogg,.ogg,audio/wav,.wav" class="hidden">
      <div id="editor-file-status" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
    </div>
  `;

  // Tag editors
  const tagMeta = {
    npcs:  { icon: '👤', label: 'Personages',    chip: 'chip-npc', nameKey: 'personages' },
    locs:  { icon: '🏰', label: 'Locaties',      chip: 'chip-loc', nameKey: 'locaties' },
    orgs:  { icon: '🏛️', label: 'Organisaties', chip: 'chip-org', nameKey: 'organisaties' },
    items: { icon: '🎒', label: 'Voorwerpen',    chip: 'chip-item', nameKey: 'voorwerpen' },
    docs:  { icon: '📜', label: 'Documenten',    chip: 'chip-doc', nameKey: 'archief' },
  };
  for (const [field, fm] of Object.entries(tagMeta)) {
    body += `
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">${fm.label}</div>
        <div id="atags-${field}" class="flex flex-wrap gap-1 mb-1">
          ${editorTags[field].map(n => `<span class="chip ${fm.chip}">${esc(n)} <span class="cursor-pointer ml-1" data-field="${field}" data-name="${esc(n)}" onclick="window._removeATag(this.dataset.field,this.dataset.name)">\u00d7</span></span>`).join('')}
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

  // Parchment text editor
  if (editId) {
    const tekst = archiefData.tekstContent?.[editId] || '';
    body += `
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">Perkament tekst</div>
        <textarea id="tekst-editor-${editId}" rows="6"
          class="w-full px-3 py-2 bg-parchment-letter text-[#2a2015] font-fell text-sm border border-[#d4c9a8] rounded focus:outline-none"
          placeholder="---titel---\nDocument Titel\n---\nTekst hier...\n--handtekening--\nNaam">${esc(tekst)}</textarea>
      </div>
    `;
  }

  // DM notes
  if (editId) {
    const dmNote = (await api.getNote(editId).catch(() => ({}))).note || '';
    body += `
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">DM Notities</div>
        <textarea id="dm-note-editor-${editId}" rows="3"
          class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities...">${esc(dmNote)}</textarea>
      </div>
    `;
  }

  body += `
    <div class="flex gap-2 pt-2">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition" title="Opslaan">&#x1F4BE;</button>
      ${editId ? `<button type="button" onclick="window._deleteDoc('${editId}')" class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition" title="Verwijderen">&#x1F5D1;</button>` : ''}
      <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">✕</button>
    </div>
  </form>`;

  openModal(editId ? 'Document bewerken' : 'Nieuw document', '', body);

  // File input preview
  document.getElementById('editor-file-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Max 50MB'); ev.target.value = ''; return; }
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
      cat: form.get('cat'),
      hoofdstuk: form.get('hoofdstuk'),
      desc: form.get('desc'),
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
