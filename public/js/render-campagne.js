import { api } from './api.js';

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

// ── Eigendomsstatus voorwerpen (module-level, bijgewerkt via socket) ──
let _ownership = { owners: {}, requests: [], tradeAllowed: true, stapelbaar: new Set() };

// ── Subtype-filter per sectie ──
const subtypeFilters = {};

// ── Shop item tooltip ──
let _tooltipEl = null;
function _ensureTooltip() {
  if (_tooltipEl) return _tooltipEl;
  _tooltipEl = document.createElement('div');
  _tooltipEl.id = 'shop-item-tooltip';
  _tooltipEl.className = 'shop-item-tooltip hidden';
  document.body.appendChild(_tooltipEl);
  return _tooltipEl;
}
document.addEventListener('mouseover', (e) => {
  const span = e.target.closest('.shop-item-with-desc');
  if (!span) return;
  const desc = span.dataset.desc;
  if (!desc) return;
  const tip = _ensureTooltip();
  tip.innerHTML = mdToHtml(desc);
  tip.classList.remove('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (!_tooltipEl) return;
  // Verberg tooltip zodra cursor niet meer boven een shop-item hangt
  if (!e.target.closest('.shop-item-with-desc')) {
    _tooltipEl.classList.add('hidden');
    return;
  }
  if (_tooltipEl.classList.contains('hidden')) return;
  const x = Math.min(e.clientX + 12, window.innerWidth - _tooltipEl.offsetWidth - 16);
  const y = e.clientY + 20;
  _tooltipEl.style.left = x + 'px';
  _tooltipEl.style.top = y + 'px';
});

export async function refreshOwnership() {
  try {
    const data = await api.getItemOwnership();
    _ownership.owners      = data.owners      || {};
    _ownership.requests    = data.requests    || [];
    _ownership.tradeAllowed = data.tradeAllowed !== false;
    _ownership.stapelbaar  = new Set(data.stapelbaar || []);
  } catch { /* ok */ }
}

export function setOwnership(data) {
  if (data.owners      !== undefined) _ownership.owners      = data.owners;
  if (data.requests    !== undefined) _ownership.requests    = data.requests;
  if (data.tradeAllowed !== undefined) _ownership.tradeAllowed = data.tradeAllowed;
  if (data.stapelbaar  !== undefined) _ownership.stapelbaar  = new Set(data.stapelbaar || []);
}
// Expose op window zodat socket-client.js altijd de correcte module-instantie gebruikt
window._setOwnership = setOwnership;
const TYPE_META = {
  personages:    { icon: '\ud83d\udc64', label: 'Personages', color: 'green-wax', chip: 'chip-npc' },
  locaties:      { icon: '\ud83c\udff0', label: 'Locaties', color: 'blue-ink', chip: 'chip-loc' },
  organisaties:  { icon: '\ud83c\udfdb\ufe0f', label: 'Organisaties', color: 'seal', chip: 'chip-org' },
  voorwerpen:    { icon: '🎺', label: 'Voorwerpen', color: 'orange', chip: 'chip-item' },
};

const SCHEMA = {
  personages: {
    subtypes: ['NPC', 'speler', 'antagonist', 'god', 'dier', 'verkoper'],
    fields: [
      { key: 'rol', label: 'Rol', type: 'text' },
      { key: 'ras', label: 'Ras', type: 'text' },
      { key: 'klasse', label: 'Klasse', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'persoonlijkheid', label: 'Persoonlijkheid', type: 'textarea', dmOnly: true },
      { key: 'flavour', label: 'Roddel', type: 'textarea' },
      { key: 'geheim', label: 'Geheim', type: 'textarea' },
    ],
  },
  locaties: {
    fields: [
      { key: 'locType', label: 'Type', type: 'select', options: ['Stadswijk','Gebouw','Herberg','Taveerne','Tempel','Winkel','Fort','Schip','Dorp','Stad','Woud','Berg','Zee','Overig'] },
      { key: 'wijk', label: 'Wijk', type: 'text' },
      { key: 'eigenaar', label: 'Eigenaar', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
      { key: 'geheim', label: 'Geheim', type: 'textarea' },
    ],
  },
  organisaties: {
    fields: [
      { key: 'orgType', label: 'Type', type: 'select', options: ['Gilde','Factie','Religieus','Politiek','Crimineel','Militair','Overig'] },
      { key: 'motto', label: 'Motto', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
    ],
  },
  voorwerpen: {
    fields: [
      { key: 'itemType', label: 'Type', type: 'select', options: ['Weapon','Magic Item','Potion','Armor','Shield','Scroll','Ring','Amulet','Consumable','Wondrous item','Musical instrument','Feature','Other'] },
      { key: 'rariteit', label: 'Rarity', type: 'select', options: ['Common','Uncommon','Rare','Very Rare','Legendary'] },
      { key: 'prijs', label: 'Prijs', type: 'text' },
      { key: 'attunement', label: 'Requires attunement', type: 'checkbox' },
      { key: 'stapelbaar', label: 'Stapelbaar (meerdere exemplaren)', type: 'checkbox' },
      { key: '_chargesToggle', label: 'Heeft charges', type: 'reveal-toggle' },
      { key: 'maxCharges', label: 'Max. charges', type: 'text', inReveal: '_chargesToggle' },
      { key: 'rechargeOn', label: 'Herlaadt bij', type: 'select', inReveal: '_chargesToggle', options: [
        { value: 'longRest',     label: '🌙 Lange rust' },
        { value: 'shortRest',    label: '☀️ Korte rust' },
        { value: 'dawn',         label: '🌅 Dageraad' },
        { value: 'longRestRoll', label: '🎲 Lange rust (dobbelrol)' },
      ]},
      { key: 'rechargeRoll', label: 'Dobbelformule (bijv. 1d3)', type: 'text', inReveal: '_chargesToggle' },
      { key: 'playerMaxAdjustable', label: 'Max. door spelers in te stellen', type: 'checkbox', inReveal: '_chargesToggle' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
    ],
  },
};

const LINK_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'archief'];
const LINK_LABELS = { personages: 'Personages', locaties: 'Locaties', organisaties: 'Organisaties', voorwerpen: 'Voorwerpen', archief: 'Documenten' };

// ── Auto-icons per subtype / type-field ──
const AUTO_ICONS = {
  personages: {
    'NPC':        '\ud83d\udc65',
    'speler':     '\u2694\ufe0f',
    'antagonist': '\ud83d\udc80',
    'god':        '\u2728',
    'dier':       '\ud83d\udc3e',
    'verkoper':   '\ud83c\udfec',
  },
  locaties: {
    'Stadswijk':  '🗺️',
    'Gebouw':     '🏛️',
    'Herberg':    '🍺',
    'Taveerne':   '🍻',
    'Tempel':     '⛩️',
    'Winkel':     '⚖️',
    'Fort':       '🏰',
    'Schip':      '⚓',
    'Dorp':       '🏡',
    'Stad':       '🌆',
    'Woud':       '🌲',
    'Berg':       '⛰️',
    'Zee':        '🌊',
    'Overig':     '📍',
  },
  organisaties: {
    'Gilde':      '\u2692\ufe0f',
    'Factie':     '\u2694\ufe0f',
    'Religieus':  '\u269b\ufe0f',
    'Politiek':   '\ud83d\udc51',
    'Crimineel':  '\ud83d\udde1\ufe0f',
    'Militair':   '\ud83d\udee1\ufe0f',
    'Overig':     '\ud83d\udd39',
  },
  voorwerpen: {
    'Weapon':     '⚔️', 'Wapen':     '⚔️',
    'Magic Item': '🔮', 'Toveritem': '🔮',
    'Potion':     '🧪', 'Drank':     '🧪',
    'Armor':      '🛡️', 'Uitrusting':'🛡️',
    'Scroll':     '📜',
    'Ring':       '💍',
    'Amulet':     '🗡️',
    'Other':      '💎', 'Overig':    '💎',
  },
};

// ── Icon picker emoji sets ──
const ICON_SETS = {
  locaties: [
    '\ud83c\udfe0','\ud83c\udfe1','\ud83c\udfe3','\ud83c\udfe5','\ud83c\udfe6','\ud83c\udfe7','\ud83c\udfe8',
    '\ud83c\udfe9','\ud83c\udfea','\ud83c\udfeb','\ud83c\udfec','\ud83c\udfed','\ud83c\udfaf',
    '\ud83c\udfef','\ud83c\udff0','\ud83c\udfd7','\ud83c\udfdb','\ud83c\udfdf','\ud83c\udfd9',
    '\ud83d\uddfb','\u26ea','\u26e9','\ud83d\udef0','\ud83d\udded','\ud83d\udeab','\ud83d\udee2',
    '\ud83c\udf7a','\ud83c\udf7b','\ud83c\udf7d','\ud83d\udd6f','\ud83d\udccd','\ud83d\udea9',
    '\ud83d\uddfa','\u26f5','\ud83d\udea2','\ud83d\udea4',
    '\ud83c\udf0a','\ud83c\udfd4','\u26f0','\ud83c\udfd5','\ud83c\udfd6','\ud83c\udfdd','\ud83c\udfdc',
    '\ud83c\udf32','\ud83c\udf33','\ud83c\udf35','\ud83c\udf0b','\ud83c\udf03','\ud83c\udfd9','\ud83c\udf09',
    '\ud83d\udd11','\ud83d\udddd','\ud83d\udc8e','\ud83d\udd2e','\ud83c\udff9','\u2694\ufe0f','\ud83d\udee1',
    '\ud83d\udc51','\ud83d\udd31','\u2728','\u2b50','\ud83d\udd25','\u2744','\ud83d\udca7','\u26a1','\ud83c\udf19',
  ],
  personages: [
    '\ud83e\uddd9','\ud83e\udddd','\ud83e\uddb8','\ud83e\uddb9','\ud83e\udddb','\ud83e\udddf','\ud83e\udddc','\ud83e\uddda',
    '\ud83e\udda0','\ud83d\udc80','\ud83d\udc64','\ud83d\udc65','\ud83e\udd35','\ud83e\uddd1','\ud83d\udc78','\ud83e\uddd1\u200d\u2696\ufe0f',
    '\ud83d\udc51','\u2694\ufe0f','\ud83d\udde1','\ud83c\udff9','\ud83d\udee1','\ud83d\udd2e','\ud83d\udc8e','\u2728','\u2b50','\u2620\ufe0f','\ud83d\udc32',
  ],
  organisaties: [
    '\ud83c\udfd9','\u269b\ufe0f','\u2694\ufe0f','\ud83d\udee1','\ud83d\uddc1','\ud83d\udc51','\u2764','\u2620\ufe0f',
    '\u26ea','\ud83d\udef0','\u26e9','\ud83c\udfd7','\ud83d\udd31','\u2b50','\ud83d\udd2e','\ud83c\udff9',
    '\ud83d\udca3','\ud83e\uddea','\ud83d\udc8e','\u2696\ufe0f','\ud83d\udcdc','\ud83d\udcb0','\ud83e\udd1d',
  ],
  voorwerpen: [
    '\u2694\ufe0f','\ud83d\udee1','\ud83c\udff9','\ud83d\udde1','\ud83d\udd2e','\ud83d\udc8e','\ud83d\udc8d','\ud83d\udcdc',
    '\ud83e\uddea','\ud83d\udddd','\ud83d\udd11','\ud83d\udc8a','\ud83c\udf7f','\ud83e\uddea','\ud83e\uddeb',
    '\ud83d\udce6','\ud83d\udcb0','\ud83e\ude99','\u26b1','\ud83e\udea4','\ud83d\udd2e','\ud83e\ude84',
    '\ud83d\udc52','\ud83d\udc60','\ud83d\udcf0','\u2b50','\u2728','\ud83d\udd25','\u2744',
  ],
};

const _NL_ITEM_TYPE = {
  'Wapen': 'Weapon', 'Toveritem': 'Magic Item', 'Drank': 'Potion',
  'Uitrusting': 'Armor', 'Overig': 'Other',
};
function _normItemType(v) { return _NL_ITEM_TYPE[v] || v; }

function getAutoIcon(type, e) {
  if (e.data?.icon) return e.data.icon;
  const map = AUTO_ICONS[type] || {};
  const key =
    e.subtype ||
    e.data?.locType ||
    e.data?.orgType ||
    e.data?.itemType ||
    '';
  return map[key] || TYPE_META[type].icon;
}

function getSubtypeBadge(type, e) {
  if (type === 'personages') {
    const sub = e.subtype || '';
    if (!sub) return null;
    const labels = { NPC: 'NPC', speler: 'Speler', antagonist: 'Antagonist', god: 'God', godheid: 'God', dier: 'Dier', monster: 'Monster', verkoper: 'Verkoper' };
    const cls = sub === 'godheid' ? 'badge-god' : 'badge-' + sub.toLowerCase();
    return { label: labels[sub] || sub, cls };
  }
  if (type === 'locaties') {
    const w = e.data?.wijk;
    return w ? { label: w, cls: 'badge-loc' } : null;
  }
  if (type === 'organisaties') {
    const t = e.data?.orgType;
    return t ? { label: t, cls: 'badge-org' } : null;
  }
  if (type === 'voorwerpen') {
    const t = e.data?.itemType;
    if (!t) return null;
    const clsMap = {
      'Weapon':     'badge-item-weapon',
      'Armor':      'badge-item-armor',
      'Potion':     'badge-item-potion',
      'Magic Item': 'badge-item-magic',
      'Scroll':     'badge-item-scroll',
      'Ring':       'badge-item-ring',
      'Amulet':     'badge-item-amulet',
      'Other':      'badge-item-other',
    };
    return { label: t, cls: clsMap[t] || 'badge-item-other' };
  }
  return null;
}

const searchQueries = { personages: '', locaties: '', organisaties: '', voorwerpen: '' };
let entities = {};
let editorTags = {};
let pendingFile = null;
let pendingAudioFile = null;
let _editorOldAudioId = null;
let entityEditorImages = [];
let entityEditorImagesToDelete = [];

// ── Audio playback singleton ──
let _audioEl = null;
let _currentAudioId = null;

function _updateAudioBtns(activeId, playing) {
  document.querySelectorAll('[data-audio-btn]').forEach(btn => {
    const isActive = btn.dataset.audioBtnId === activeId;
    btn.textContent = isActive && playing ? '⏸' : '▶';
    btn.classList.toggle('audio-btn-playing', isActive && playing);
  });
}

window._audioToggle = (audioId) => {
  const url = api.fileUrl(audioId);
  if (_audioEl && _currentAudioId === audioId) {
    if (_audioEl.paused) { _audioEl.play(); _updateAudioBtns(audioId, true); }
    else                 { _audioEl.pause(); _updateAudioBtns(audioId, false); }
    return;
  }
  if (_audioEl) { _audioEl.pause(); _audioEl = null; }
  _currentAudioId = audioId;
  _audioEl = new Audio(url);
  _audioEl.play().catch(() => {});
  _audioEl.onended = () => { _currentAudioId = null; _updateAudioBtns(null, false); };
  _audioEl.onerror = () => { _currentAudioId = null; _updateAudioBtns(null, false); };
  _updateAudioBtns(audioId, true);
};

window._stopAudio = () => {
  if (_audioEl) { _audioEl.pause(); _audioEl = null; }
  _currentAudioId = null;
  _updateAudioBtns(null, false);
};

// ── Audio upload helpers ──
window._uploadAudio = async (tab, entityId, oldAudioId, file) => {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { alert('Max 30MB'); return; }
  const audioId = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  await api.uploadFile(audioId, file);
  if (oldAudioId) await api.deleteFile(oldAudioId).catch(() => {});
  const entity = await api.getEntity(tab, entityId);
  await api.updateEntity(tab, entityId, { ...entity, data: { ...entity.data, audioId } });
  window._openDetail(tab, entityId);
};

window._deleteAudio = async (tab, entityId, audioId) => {
  if (!confirm('Geluidsfragment verwijderen?')) return;
  window._stopAudio();
  await api.deleteFile(audioId).catch(() => {});
  const entity = await api.getEntity(tab, entityId);
  await api.updateEntity(tab, entityId, { ...entity, data: { ...entity.data, audioId: '' } });
  window._openDetail(tab, entityId);
};

window._editorAudioSelected = (file) => {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) { alert('Max 30MB'); return; }
  const idInput = document.getElementById('editor-audio-id');
  if (idInput && !idInput.value) {
    idInput.value = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  pendingAudioFile = file;
  const label = document.getElementById('editor-audio-name');
  if (label) { label.textContent = '🔊 ' + file.name; label.classList.remove('hidden'); }
};

window._editorClearAudio = () => {
  pendingAudioFile = null;
  const idInput = document.getElementById('editor-audio-id');
  if (idInput) idInput.value = '';
  const label = document.getElementById('editor-audio-name');
  if (label) { label.textContent = 'Audio wordt verwijderd bij opslaan'; label.classList.remove('hidden'); }
  document.getElementById('editor-audio-preview')?.classList.add('hidden');
};

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const $$ = (...a) => window.app.$$(...a);
const isDM = () => window.app.isDM();
const esc = (...a) => window.app.esc(...a);
const escJS = (...a) => window.app.escJS(...a);
const mdToHtml = (...a) => window.app.mdToHtml(...a);
const openModal = (...a) => window.app.openModal(...a);
const closeModal = (...a) => window.app.closeModal(...a);
const openLightbox = (...a) => window.app.openLightbox(...a);

// ── Modal navigatie-history ──
const _modalHistory = window._modalHistory = [];   // stack van { tab, id } — ook toegankelijk vanuit render-archief.js

function _pushHistory(tab, id) {
  _modalHistory.push({ tab, id });
  _updateBackButton();
}

function _clearHistory() {
  _modalHistory.length = 0;
  _updateBackButton();
}

function _updateBackButton() {
  const btn = document.getElementById('m-back');
  if (btn) btn.classList.toggle('hidden', _modalHistory.length === 0);
}

window._modalGoBack = async () => {
  const prev = _modalHistory.pop();
  if (!prev) return;
  _updateBackButton();
  if (prev.type === 'archief') {
    window._openDoc?.(prev.id);
  } else if (prev.type === 'sessie') {
    window._openSessieDetail?.(prev.id);
  } else {
    await window._openDetail(prev.tab, prev.id, true /* isBack */);
  }
};

window._clearHistory = _clearHistory;

// Kleine B/I toolbar boven een textarea
function fmtToolbar(id) {
  return `<div class="flex gap-1 mb-1">
    <button type="button" title="Vet (Ctrl+B)" onclick="window._fmt('${id}','**')"
      class="w-7 h-6 text-xs font-black border border-room-border rounded bg-room-bg hover:bg-room-elevated transition font-cinzel leading-none">B</button>
    <button type="button" title="Cursief (Ctrl+I)" onclick="window._fmt('${id}','*')"
      class="w-7 h-6 text-xs border border-room-border rounded bg-room-bg hover:bg-room-elevated transition font-fell italic leading-none">I</button>
  </div>`;
}

export function initCampagne() {}

// Expose for global search
window._entityTypeMeta = TYPE_META;
window._entityFilter = (type, list, q) => {
  if (!q) return list;
  const ql = q.toLowerCase();
  return list.filter(e => {
    const fields = [e.name, e.subtype, ...Object.values(e.data || {})].join(' ').toLowerCase();
    const links = Object.values(e.links || {}).flat().join(' ').toLowerCase();
    return fields.includes(ql) || links.includes(ql);
  });
};

async function renderEntitySection(type) {
  const container = $(`#section-${type}`);

  try {
    entities[type] = await api.listEntities(type);
  } catch (e) {
    entities[type] = [];
  }
  window._entityCache = entities;
  // Naamindex bijwerken voor wikilink-resolving
  window._buildEntityIndex?.(type, entities[type]);

  const list = filterEntities(type, entities[type] || []);

  // Only build the full toolbar+grid on first render; on subsequent calls just refresh the grid
  const existingGrid = container.querySelector('.cards-grid');
  if (existingGrid) {
    _refreshGrid(type, list, container);
    return;
  }

  const DESC = {
    personages: 'Helden, vrienden en vijanden',
    locaties: 'Plaatsen, wijken en gebouwen',
    organisaties: 'Gilden, facties en genootschappen',
    voorwerpen: 'Magische voorwerpen en uitrusting',
  };

  // Unieke subtype-waarden — case-insensitief dedupliceren
  const _sfSeen = new Map();
  (entities[type] || []).forEach(e => {
    const v = (_getEntitySubtypeVal(type, e) || '').trim();
    if (v && !_sfSeen.has(v.toLowerCase())) _sfSeen.set(v.toLowerCase(), v);
  });
  const sfVals = [..._sfSeen.values()].sort((a, b) => a.localeCompare(b, 'nl'));
  const sfActive = subtypeFilters[type] || '';

  container.innerHTML = `
    <!-- Section banner -->
    <div class="section-banner section-banner--entity section-banner--${type}">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${TYPE_META[type].icon}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">${TYPE_META[type].label}</div>
          <div class="section-banner-desc-line">${DESC[type] || ''}</div>
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">\u2315</span>
        <input type="text" class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Zoek ${TYPE_META[type].label.toLowerCase()}..." value="${esc(searchQueries[type])}" oninput="window._entitySearch('${type}',this.value)">
      </div>
      ${sfVals.length >= 2 ? `<button class="sf-toggle-btn${sfActive ? ' sf-toggle-btn--active' : ''}" onclick="window._toggleSubtypeBar('${type}')" title="Filter op subtype"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : ''}
      <span class="results-count text-ink-faint text-xs font-mono">${list.length} resultaten</span>
    </div>

    <!-- Subtype filter chips (standaard verborgen, toggle via knop) -->
    ${sfVals.length >= 2 ? `
    <div class="subtype-filter-bar${sfActive ? '' : ' subtype-filter-bar--hidden'}">
      <button class="sf-chip${sfActive === '' ? ' sf-chip--active' : ''}" data-sf-val="" onclick="window._entitySubtypeFilter('${type}', null)">Alle</button>
      ${sfVals.map(v => `<button class="sf-chip${sfActive === v ? ' sf-chip--active' : ''}" data-sf-val="${esc(v)}" onclick="window._entitySubtypeFilter('${type}', this.classList.contains('sf-chip--active') ? null : this.dataset.sfVal)">${esc(v)}</button>`).join('')}
    </div>` : ''}

    <!-- Card grid -->
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6 overflow-y-auto flex-1">
    </div>
  `;

  _refreshGrid(type, list, container);

  // DM: openstaande claim-verzoeken tonen boven de grid
  if (type === 'voorwerpen') _renderClaimRequests(container);

  window._entitySearch = (t, q) => {
    searchQueries[t] = q;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
    const countEl = c.querySelector('.results-count');
    if (countEl) countEl.textContent = `${filtered.length} resultaten`;
  };

  window._entitySubtypeFilter = (t, subtype) => {
    subtypeFilters[t] = subtype || null;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
    const countEl = c.querySelector('.results-count');
    if (countEl) countEl.textContent = `${filtered.length} resultaten`;
    c.querySelectorAll('.sf-chip').forEach(btn => {
      btn.classList.toggle('sf-chip--active', btn.dataset.sfVal === (subtype || ''));
    });
    // Toon de filterbalk als een filter actief is; update knop
    const bar = c.querySelector('.subtype-filter-bar');
    if (bar && subtype) bar.classList.remove('subtype-filter-bar--hidden');
    const toggleBtn = c.querySelector('.sf-toggle-btn');
    if (toggleBtn) toggleBtn.classList.toggle('sf-toggle-btn--active', !!subtype);
  };

  window._toggleSubtypeBar = (type) => {
    const c = $(`#section-${type}`);
    c.querySelector('.subtype-filter-bar')?.classList.toggle('subtype-filter-bar--hidden');
  };
}

function _sortKey(name) {
  return (name || '').replace(/^(de|het|'t)\s+/i, '').trim();
}

function _fitText(el) {
  el.style.fontSize = '';
  if (el.scrollWidth <= el.clientWidth) return;
  for (let size = 13; size >= 9; size--) {
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= el.clientWidth) break;
  }
}

function _renderClaimRequests(container) {
  // Verwijder eventuele bestaande balk
  container.querySelector('.claim-requests-bar')?.remove();
  if (!isDM()) return;
  const pending = (_ownership.requests || []).filter(r => r.status === 'pending');
  if (pending.length === 0) return;

  const bar = document.createElement('div');
  bar.className = 'claim-requests-bar';
  bar.innerHTML = `
    <div class="claim-requests-title">📬 Openstaande claimverzoeken (${pending.length})</div>
    ${pending.map(r => `
      <div class="claim-request-row">
        <span class="claim-request-info">
          <strong>${esc(r.requesterName)}</strong> wil
          <em>${esc(r.itemName)}</em> ${r.type === 'trade' ? `ruilen met ${esc(r.targetName || '?')}` : 'claimen'}
        </span>
        <div class="claim-request-actions">
          <button class="claim-btn-approve" onclick="window._itemApproveRequest('${esc(r.id)}')">✓ Goedkeuren</button>
          <button class="claim-btn-reject"  onclick="window._itemRejectRequest('${esc(r.id)}')">✕ Weigeren</button>
        </div>
      </div>
    `).join('')}
  `;
  // Voeg in vóór de cards-grid
  const grid = container.querySelector('.cards-grid');
  if (grid) container.insertBefore(bar, grid);
}

function _refreshGrid(type, list, container) {
  // Refresh ook de claim-balk bij grid-update
  if (type === 'voorwerpen') _renderClaimRequests(container);
  const grid = container.querySelector('.cards-grid');
  if (!grid) return;
  const savedScrollY = window.scrollY;
  const totalCount = (entities[type] || []).length;
  const isSearch = !!(searchQueries[type]);
  grid.innerHTML = list.length === 0 ? `
    <div class="col-span-full text-center py-20 text-ink-faint">
      <div class="text-5xl mb-4 opacity-40">${TYPE_META[type].icon}</div>
      <div class="font-cinzel text-sm font-semibold text-ink-dim mb-1">
        ${isSearch || totalCount > 0
          ? `Geen ${TYPE_META[type].label.toLowerCase()} gevonden`
          : 'Het archief is nog leeg...'}
      </div>
      ${!isSearch && totalCount === 0 && isDM()
        ? `<div class="text-xs font-fell italic mt-1">Gebruik de <span class="font-mono px-1 py-0.5 bg-room-elevated rounded">+</span> knop om iets toe te voegen</div>`
        : ''}
    </div>
  ` : list.map(e => renderCard(type, e)).join('');
  requestAnimationFrame(() => {
    window.scrollTo(0, savedScrollY);
    grid.querySelectorAll('[data-fittext]').forEach(_fitText);
    _attachCardTilt(grid);
  });
  const countEl = container.querySelector('.results-count');
  if (countEl) countEl.textContent = `${list.length} resultaten`;
}

// ── 3D kaart-tilt bij hover ──
function _onCardTiltMove(e) {
  const card = this;
  if (!card.classList.contains('card-tilting')) card.classList.add('card-tilting');
  const rect = card.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2); // -1..1
  const dy = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2); // -1..1
  const rx = (-dy * 7).toFixed(2);
  const ry = ( dx * 7).toFixed(2);
  card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-5px)`;
}
function _onCardTiltLeave() {
  this.classList.remove('card-tilting');
  this.style.transform = '';
}
function _attachCardTilt(container) {
  container.querySelectorAll('.entity-card:not(.card-vague)').forEach(card => {
    card.removeEventListener('mousemove',  _onCardTiltMove);
    card.removeEventListener('mouseleave', _onCardTiltLeave);
    card.addEventListener('mousemove',  _onCardTiltMove);
    card.addEventListener('mouseleave', _onCardTiltLeave);
  });
}
window._attachCardTilt = _attachCardTilt;

export async function renderPersonages() { return renderEntitySection('personages'); }
export async function renderLocaties() { return renderEntitySection('locaties'); }
export async function renderOrganisaties() { return renderEntitySection('organisaties'); }
export async function renderVoorwerpen() {
  await refreshOwnership();
  return renderEntitySection('voorwerpen');
}

// Geeft de subtype-waarde terug die gebruikt wordt voor filteren per type
function _getEntitySubtypeVal(type, e) {
  if (type === 'locaties')     return e.data?.wijk     || '';
  if (type === 'organisaties') return e.data?.orgType  || '';
  return e.subtype || '';
}

function filterEntities(type, list) {
  const q  = searchQueries[type];
  const sf = subtypeFilters[type] || null;
  let filtered = list;
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(e => {
      const fields = [e.name, e.subtype, ...Object.values(e.data || {})].join(' ').toLowerCase();
      const links  = Object.values(e.links || {}).flat().join(' ').toLowerCase();
      return fields.includes(ql) || links.includes(ql);
    });
  }
  if (sf) {
    filtered = filtered.filter(e => _getEntitySubtypeVal(type, e) === sf);
  }
  return filtered.slice().sort((a, b) => {
    if (type === 'locaties') {
      const wa = a.data?.wijk || '';
      const wb = b.data?.wijk || '';
      // Locaties zonder wijk komen achteraan
      if (wa !== wb) {
        if (!wa) return 1;
        if (!wb) return -1;
        return wa.localeCompare(wb, 'nl', { sensitivity: 'base' });
      }
    }
    return _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' });
  });
}

function renderCard(type, e) {
  const vis = e._visibility || 'visible';

  // ── Player vague card: name visible, content hidden behind overlay ──
  if (!isDM() && vis === 'vague') {
    return `
      <div class="entity-card card-vague">
        <div class="card-accent bar-${type}" style="opacity:0.5"></div>
        <div class="card-img-wrap">
          <img class="card-img w-full object-cover" loading="lazy" src="${api.thumbUrl(e.id)}"
            style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
            onerror="this.closest('.entity-card').classList.add('no-img')">
          <div class="card-vague-overlay">?</div>
        </div>
        <div class="card-body px-4 py-3">
          <span class="card-name">${esc(e.name)}</span>
          <span class="card-name-sep"></span>
          <div class="text-[10px] text-ink-faint font-fell italic">— onbekend —</div>
        </div>
      </div>
    `;
  }

  const rol     = e.data?.rol || '';
  const _itemMeta = type === 'voorwerpen'
    ? [e.data?.rariteit, (e.data?.attunement === 'true' || e.data?.attunement === true) ? 'Attunement' : null].filter(Boolean).join(' · ')
    : null;
  const metaText = [e.data?.locType, e.data?.orgType, _itemMeta, e.data?.ras, e.data?.klasse].filter(Boolean).join(' \u00b7 ');
  const badge   = getSubtypeBadge(type, e);
  const desc = e.data?.desc || '';
  const flavour = e.data?.flavour || '';
  const flavourUitgesproken = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';

  const chips = [];
  if (e.links) {
    const npc = (e.links.personages || []).slice(0, 1);
    const loc = (e.links.locaties   || []).slice(0, 1);
    // Max 2 chips: eerst 1 personage + 1 locatie; ontbreekt één soort, pak 2 van de andere
    const npcShow = npc.length ? npc : (e.links.personages || []).slice(0, 2 - loc.length);
    const locShow = loc.length ? loc : (e.links.locaties   || []).slice(0, 2 - npcShow.length);
    const combined = [
      ...npcShow.map(n => `<span class="chip chip-npc" data-name="${esc(n)}" onclick="event.stopPropagation();window._navigateTo('personages',this.dataset.name)">\ud83d\udc64 ${esc(n)}</span>`),
      ...locShow.map(n => `<span class="chip chip-loc" data-name="${esc(n)}" onclick="event.stopPropagation();window._navigateTo('locaties',this.dataset.name)">\ud83c\udff0 ${esc(n)}</span>`),
    ];
    chips.push(...combined.slice(0, 2));
  }

  // ── DM toggle icon / title — 3-state for personages + locaties ──
  const _threeState = ['personages', 'locaties'].includes(type);
  const _visIcon  = vis === 'visible' ? '\ud83d\udc41'
                  : vis === 'vague'   ? '\ud83d\udc64'
                  :                    '\ud83d\udd12';
  const _visTitle = vis === 'visible' ? 'Verbergen  ·  Shift: vaag tonen'
                  : vis === 'vague'   ? 'Volledig tonen  ·  Shift: vaag houden'
                  : _threeState       ? 'Zichtbaar maken  ·  Shift: vaag tonen'
                  :                    'Zichtbaar maken';

  return `
    <div class="entity-card${vis === 'hidden' && isDM() ? ' card-hidden' : ''}${vis === 'vague' && isDM() ? ' card-vague-dm' : ''}${e._deceased ? ' card-deceased' : ''}"
      onclick="window._openDetail('${type}','${e.id}')">
      ${isDM() ? `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._toggleVis('${type}','${e.id}',event)"
            title="${_visTitle}">
            ${_visIcon}
          </button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-black/95 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._openEditor('${type}','${e.id}')"
            title="Bewerken">&#9998;</button>
          <button class="w-7 h-7 flex items-center justify-center rounded bg-black/75 hover:bg-red-700/90 backdrop-blur-sm transition text-xs text-white shadow ring-1 ring-white/20"
            onclick="event.stopPropagation();window._deleteEntity('${type}','${e.id}')"
            title="Verwijderen">&#10005;</button>
        </div>
      ` : ''}
      <div class="card-accent bar-${type}"></div>
      <div class="card-img-wrap">
        <img class="card-img w-full object-cover" loading="lazy" src="${api.thumbUrl(e.id)}"
          style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
          onerror="this.style.display='none';this.closest('.entity-card').classList.add('no-img')">
        <div class="card-img-fade"></div>
        ${badge ? `<div class="card-subtype-badge ${badge.cls}">${esc(badge.label)}</div>` : ''}
        ${!isDM() && window.app?.state?.characterId ? (() => {
          const _bms = window.app?.state?.bookmarks || [];
          const _bmActive = _bms.some(b => b.id === e.id);
          return `<button class="card-bookmark-btn${_bmActive ? ' card-bookmark-btn--active' : ''}"
            onclick="event.stopPropagation();window._toggleBookmark(this.dataset.btype,this.dataset.bid,this.dataset.bname)"
            data-btype="${esc(type)}" data-bid="${esc(e.id)}" data-bname="${esc(e.name)}"
            title="${_bmActive ? 'Bladwijzer verwijderen' : 'Bladwijzer toevoegen'}">
            ${_bmActive ? '★' : '☆'}
          </button>`;
        })() : ''}
        ${type === 'locaties' && window._pinnedLocIds?.has(e.id) ? `<button class="card-map-btn"
          onclick="event.stopPropagation();window._toonOpKaart('${esc(e.id)}')"
          title="Toon op kaart">📍</button>` : ''}
      </div>
      <div class="card-body px-3 pt-2 pb-2">
        <div class="mb-1.5">
          <span class="card-name block" data-fittext>${esc(e.name)}${e._deceased ? '<span class="card-name-dagger">†</span>' : ''}</span>
          ${(rol || metaText) ? `<span class="card-name-sep"></span>
          <div class="card-meta">
            ${rol      ? `<span class="card-meta-rol">${esc(rol)}</span>` : ''}
            ${rol && metaText ? `<span class="card-meta-dot"> · </span>` : ''}
            ${metaText ? `<span class="card-meta-sub">${esc(metaText)}</span>` : ''}
          </div>` : ''}
        </div>
        ${desc ? `<p class="text-xs text-ink-medium line-clamp-4 mb-1 font-crimson leading-relaxed">${mdToHtml(desc)}</p>` : ''}
        <!-- relatie-chips verborgen (code bewaard); vervangen door wikilinks in beschrijving -->
        <!-- ${chips.length ? `<div class="flex flex-wrap gap-1">${chips.join('')}</div>` : ''} -->
      </div>
      ${flavour && (isDM() || flavourUitgesproken) ? `
        <div class="flavour-preview${isDM() && !flavourUitgesproken ? ' flavour-preview--ongespoken' : ''}">
          ${e.data?.audioId ? `<button type="button" class="flavour-audio-btn" data-audio-btn data-audio-btn-id="${esc(e.data.audioId)}" onclick="event.stopPropagation();window._audioToggle('${esc(e.data.audioId)}')" title="Sfeer afspelen">▶</button>` : ''}
          <span class="flavour-preview-text">\u201e${esc(flavour.length > 300 ? flavour.slice(0, 300) + '\u2026' : flavour)}\u201c</span>
        </div>
      ` : ''}
      ${type === 'voorwerpen' ? _itemOwnershipBadge(e.id) : ''}
      ${e.data?.geheim && isDM() ? `
        <button class="secret-badge${e._secretReveal ? ' secret-badge--revealed' : ''}"
          onclick="event.stopPropagation();window._toggleSecretCard('${type}','${e.id}')"
          title="${e._secretReveal ? 'Geheim zichtbaar voor spelers — klik om te verbergen' : 'Geheim verborgen voor spelers — klik om te onthullen'}">
          ${e._secretReveal ? '✨ Onthuld' : '🔒 Geheim'}
        </button>
      ` : e.data?.geheim && e._secretReveal ? `
        <div class="player-secret-reveal-bar" title="Geheim onthuld">✨ Onthuld</div>
      ` : ''}
    </div>
  `;
}

// ── Bladwijzers ──
window._toggleBookmark = async function(type, id, name) {
  const charId = window.app?.state?.characterId;
  if (!charId) return;
  const profile = await api.getPlayerProfile(charId).catch(() => ({}));
  let bms = Array.isArray(profile.bookmarks) ? [...profile.bookmarks] : [];
  const idx = bms.findIndex(b => b.id === id);
  if (idx >= 0) {
    bms.splice(idx, 1);
  } else {
    bms.push({ id, type, name });
  }
  await api.patchPlayerProfile(charId, { bookmarks: bms });
  // Update state cache
  if (window.app?.state) window.app.state.bookmarks = bms;
  // Direct DOM update: verwijder of voeg toe in bladwijzerlijst (mijn-karakter)
  const wasRemoved = !bms.some(b => b.id === id);
  if (wasRemoved) {
    document.querySelector(`.player-bookmark-item[data-bid="${CSS.escape(id)}"]`)?.remove();
    // Verberg de sectieheader als de lijst leeg is
    const list = document.querySelector('.player-bookmarks-list');
    if (list && !list.querySelector('.player-bookmark-item')) {
      list.closest('.player-dash-section')?.remove();
    }
  }
  // Update knop direct in-place
  const active = bms.some(b => b.id === id);
  const btn = document.querySelector(`.card-bookmark-btn[data-bid="${CSS.escape(id)}"]`);
  if (btn) {
    btn.classList.toggle('card-bookmark-btn--active', active);
    btn.title = active ? 'Bladwijzer verwijderen' : 'Bladwijzer toevoegen';
    btn.textContent = active ? '★' : '☆';
  }
  // Toast-melding
  const toast = document.createElement('div');
  toast.className = 'bookmark-toast';
  toast.textContent = active ? '⭐ Bladwijzer toegevoegd' : '☆ Bladwijzer verwijderd';
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('bookmark-toast--visible'), 10);
  setTimeout(() => { toast.classList.remove('bookmark-toast--visible'); setTimeout(() => toast.remove(), 300); }, 2000);

  // Als mijn-karakter actief is: herrender zodat de sectie direct zichtbaar is
  if (window.app?.state?.activeSection === 'mijn-karakter') {
    await window.app.refreshSection('mijn-karakter');
  }
};

// Vaste kleurpalet per speler (op basis van characterId hash)
const _PLAYER_COLORS = [
  '#7b9e6b', // groen
  '#6b8bbf', // blauw
  '#b07a4e', // oranje-bruin
  '#9b6bb5', // paars
  '#b5836b', // terracotta
  '#5e9e9e', // teal
  '#b5a040', // goud
  '#7e6e9e', // lavendel
];
function _playerColor(characterId) {
  if (!characterId) return _PLAYER_COLORS[0];
  let h = 0;
  for (let i = 0; i < characterId.length; i++) h = (h * 31 + characterId.charCodeAt(i)) >>> 0;
  return _PLAYER_COLORS[h % _PLAYER_COLORS.length];
}

function _itemOwnershipBadge(itemId) {
  const owner        = _ownership.owners[itemId];
  const isStapelbaar = _ownership.stapelbaar.has(itemId);
  const myId         = window.app?.state?.characterId;
  const myName       = window.app?.state?.playerName;
  const isDm         = window.app?.isDM?.();

  // ── Stapelbaar: array-eigendom ──
  if (isStapelbaar) {
    const eigenaren = Array.isArray(owner) ? owner : [];
    if (isDm) {
      const total = eigenaren.reduce((s, o) => s + (o.qty || 1), 0);
      const label = eigenaren.length > 0
        ? `🎁 ${eigenaren.length} speler${eigenaren.length !== 1 ? 's' : ''} · ${total}×`
        : '🎁 Geef aan speler';
      return `
        <div class="item-owner-badge item-owner-badge--stapelbaar" onclick="event.stopPropagation()">
          <span>${label}</span>
          <button class="item-give-btn" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')" title="Geef exemplaren aan speler">+</button>
        </div>`;
    }
    const myEntry = myId ? eigenaren.find(o => o.characterId === myId) : null;
    if (myEntry && (myEntry.qty || 1) > 0) {
      return `<div class="item-owner-badge item-owner-badge--mine" onclick="event.stopPropagation()">🎒 ×${myEntry.qty || 1}</div>`;
    }
    return '';
  }

  // ── Uniek eigendom (bestaande logica) ──
  if (owner && !Array.isArray(owner)) {
    const isMine = myId && owner.characterId === myId;
    const color  = isMine ? '' : `color:${_playerColor(owner.characterId)};border-color:${_playerColor(owner.characterId)}40`;
    return `
      <div class="item-owner-badge ${isMine ? 'item-owner-badge--mine' : 'item-owner-badge--other'}" style="${color}" onclick="event.stopPropagation()">
        ${isMine ? '🎒 Jouw eigendom' : `🎒 ${esc(owner.playerName)}`}
        ${isDm ? `<button class="item-owner-remove" onclick="event.stopPropagation();window._itemRemoveOwner('${esc(itemId)}')" title="Eigendom verwijderen">✕</button>` : ''}
        ${isDm ? `<button class="item-give-btn" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')" title="Geef aan andere speler">🎁</button>` : ''}
      </div>`;
  }

  // Pending verzoek van deze speler
  const pending = myId && _ownership.requests.find(
    r => r.itemId === itemId && r.requesterId === myId && r.status === 'pending'
  );
  if (pending) {
    return `<div class="item-claim-pending" onclick="event.stopPropagation()">⏳ Wacht op DM…</div>`;
  }

  // Geef-knop voor DM (geen eigenaar, niet stapelbaar)
  if (isDm) {
    return `
      <button class="item-give-btn item-give-btn--standalone" onclick="event.stopPropagation();window._itemGiveToPlayer('${esc(itemId)}')" title="Geef aan speler">
        🎁 Geef aan speler
      </button>`;
  }

  // Claim-knop voor ingelogde speler (niet stapelbaar)
  if (myName && !isDm) {
    return `
      <button class="item-claim-btn" onclick="event.stopPropagation();window._itemClaim('${esc(itemId)}')">
        Claim
      </button>`;
  }

  return '';
}

// ── DM: voorwerp geven aan speler ──
window._itemGiveToPlayer = async function(itemId) {
  try {
    const isStapelbaar = _ownership.stapelbaar.has(itemId);
    const [allPersonages, allGroups] = await Promise.all([
      api.listEntities('personages'),
      api.getGroups().catch(() => []),
    ]);
    const spelers = allPersonages.filter(e => e.subtype?.toLowerCase() === 'speler');
    if (!spelers.length) {
      alert('Geen spelerskarakters gevonden.');
      return;
    }
    const groupNames = Object.fromEntries((allGroups?.groups || allGroups || []).map(g => [g.id, g.name]));
    const byGroup = {};
    for (const s of spelers) {
      const gid = s.data?.groep || '_geen';
      if (!byGroup[gid]) byGroup[gid] = [];
      byGroup[gid].push(s);
    }
    const sections = Object.entries(byGroup).map(([gid, members]) => {
      const label = groupNames[gid] || (gid === '_geen' ? 'Zonder groep' : gid);
      return `
        <div class="item-give-group">
          <div class="item-give-group-label">${esc(label)}</div>
          ${members.map(s => isStapelbaar ? `
            <div class="item-give-player-row">
              <div class="item-give-player-info">
                <img src="${api.fileUrl(s.id)}" class="item-give-avatar" onerror="this.style.display='none'">
                <span>${esc(s.name)}</span>
              </div>
              <input type="number" min="1" value="1" id="igq-${esc(s.id)}"
                class="item-give-qty-input" onclick="event.stopPropagation()">
              <button class="item-give-confirm-btn"
                onclick="window._itemAssignToPlayer('${esc(itemId)}','${esc(s.id)}','${escJS(s.name)}','${escJS(s.data?.groep || '')}',+(document.getElementById('igq-${esc(s.id)}').value)||1)">
                🎁
              </button>
            </div>` : `
            <button class="item-give-player-btn"
              onclick="window._itemAssignToPlayer('${esc(itemId)}','${esc(s.id)}','${escJS(s.name)}','${escJS(s.data?.groep || '')}')">
              <img src="${api.fileUrl(s.id)}" class="item-give-avatar" onerror="this.style.display='none'">
              <span>${esc(s.name)}</span>
            </button>`).join('')}
        </div>`;
    }).join('');
    const subtitle = isStapelbaar ? 'Kies een ontvanger en aantal' : 'Kies een ontvanger';
    window.app.openModal('🎁 Geef voorwerp aan speler', subtitle, `<div class="item-give-picker">${sections}</div>`);
  } catch (e) {
    console.warn('_itemGiveToPlayer fout:', e);
  }
};

window._itemAssignToPlayer = async function(itemId, characterId, playerName, groupId, qty) {
  try {
    await api.assignItemOwner(itemId, { characterId, playerName, groupId: groupId || null, qty: qty || 1 });
    window.app.closeModal();
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (e) {
    console.warn('_itemAssignToPlayer fout:', e);
  }
};

// ── Entity carousel (multi-image with captions) ──
const _ecp = {};   // entity carousel position
const _ecc = {};   // entity carousel captions

function _parseExtraImages(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function _entityCarouselHtml(key, items) {
  if (!items.length) return '';
  if (items.length === 1) {
    const url = api.fileUrl(items[0].id);
    return `
      <div class="detail-hero mb-6" id="detail-img-wrap-${key}" onclick="window.app.openLightbox('${url}','')">
        <div class="detail-hero-bg" style="background-image:url('${url}')"></div>
        <img src="${url}" class="detail-hero-img"
          onerror="this.closest('#detail-img-wrap-${key}').style.display='none'">
        <div class="detail-hero-overlay"></div>
      </div>
      ${items[0].caption ? `<p class="text-center text-xs text-ink-dim font-crimson -mt-3 mb-3 italic">${esc(items[0].caption)}</p>` : ''}`;
  }
  _ecp[key] = 0;
  _ecc[key] = items.map(i => i.caption || '');
  return `
    <div class="mb-4">
      <div class="relative">
        <div class="overflow-hidden rounded">
          <div id="ec-track-${key}" class="flex" style="transition:transform 0.3s ease">
            ${items.map(({id}) => {
              const url = api.fileUrl(id);
              return `<div class="flex-shrink-0 w-full relative overflow-hidden">
                <div class="detail-hero-bg" style="background-image:url('${url}')"></div>
                <img src="${url}" class="detail-portrait w-full max-h-80 object-contain cursor-pointer" style="position:relative;z-index:1"
                  onclick="window.app.openLightbox('${url}','')">
              </div>`;
            }).join('')}
          </div>
        </div>
        <button class="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
          onclick="window._ecStep('${key}',-1,${items.length})">\u2039</button>
        <button class="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/65 text-white rounded-full text-lg leading-none flex items-center justify-center transition"
          onclick="window._ecStep('${key}',1,${items.length})">\u203a</button>
      </div>
      <div class="flex justify-center gap-1.5 mt-2">
        ${items.map((_, i) => `<span id="ec-dot-${key}-${i}" onclick="window._ecGo('${key}',${i},${items.length})"
          class="block w-2 h-2 rounded-full cursor-pointer transition ${i === 0 ? 'bg-gold' : 'bg-room-border'}"></span>`).join('')}
      </div>
      <div id="ec-cap-${key}" class="text-center text-xs text-ink-dim font-crimson mt-1.5 italic min-h-[1.2em]">${esc(items[0].caption || '')}</div>
    </div>`;
}

window._ecStep = (key, dir, total) => {
  window._ecGo(key, ((_ecp[key] || 0) + dir + total) % total, total);
};
window._ecGo = (key, idx, total) => {
  _ecp[key] = idx;
  const track = document.getElementById(`ec-track-${key}`);
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById(`ec-dot-${key}-${i}`);
    if (dot) dot.className = `block w-2 h-2 rounded-full cursor-pointer transition ${i === idx ? 'bg-gold' : 'bg-room-border'}`;
  }
  const capEl = document.getElementById(`ec-cap-${key}`);
  if (capEl) capEl.textContent = (_ecc[key] || [])[idx] || '';
};

// ── Entity extra-image editor ──
function _refreshEntityImages() {
  const c = document.getElementById('entity-img-preview');
  if (!c) return;
  c.innerHTML = entityEditorImages.length
    ? entityEditorImages.map((img, i) => `
        <div>
          <div class="relative rounded overflow-hidden border border-room-border bg-room-elevated" style="height:56px">
            <img src="${img.url}" class="w-full h-full object-cover">
            <button type="button" onclick="window._removeEntityImage(${i})"
              class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full text-xs flex items-center justify-center transition">\u00d7</button>
          </div>
          <input type="text" placeholder="Onderschrift\u2026" value="${esc(img.caption || '')}"
            oninput="window._updateEntityImageCaption(${i}, this.value)"
            class="w-full mt-0.5 px-1 py-0.5 text-[9px] bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>`).join('')
    : '<span class="text-xs text-ink-faint italic">Nog geen</span>';
}

// ── Detail view ──
let _detailToken = 0;   // Annuleer concurrent _openDetail aanroepen

window._openDetail = async (tab, id, isBack = false, openTabKey = null) => {
  const myToken = ++_detailToken;   // Uniek token voor deze aanroep

  const prevTab = window._currentDetailTab;
  const prevId  = window._currentDetailId;

  if (!isBack) {
    if (prevId && prevId !== id) {
      _pushHistory(prevTab, prevId);
    } else if (!prevId) {
      _clearHistory();
    }
  }
  window._currentDetailTab = tab;
  window._currentDetailId  = id;

  let e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData;
  let shopLogData = null;
  const _isShopTab = (tab === 'locaties' || tab === 'personages');
  try {
    [e, playerNotesData, uitverkochtData, beschikbaarData, shopCurrencyData] = await Promise.all([
      api.getEntity(tab, id),
      api.getPlayerNotes(id).catch(() => null),
      _isShopTab
        ? api.getShopUitverkocht(id).catch(() => ({ uitverkocht: [] }))
        : Promise.resolve({ uitverkocht: [] }),
      _isShopTab
        ? api.getShopBeschikbaar(id).catch(() => null)
        : Promise.resolve(null),
      (_isShopTab && !isDM())
        ? Promise.all([
            api.getPlayerCurrency(window.app?.state?.characterId).catch(() => ({ fl: 0, kn: 0, cl: 0 })),
            api.getPartyCurrency().catch(() => ({ enabled: false, fl: 0, kn: 0, cl: 0 })),
          ]).then(([player, party]) => ({ player, party }))
        : Promise.resolve(null),
    ]);
  } catch { return; }
  if (_isShopTab && isDM()) {
    shopLogData = await api.getShopLog(id).catch(() => null);
  }
  const uitverkochtSet = new Set((uitverkochtData?.uitverkocht || []).map(k => k.toLowerCase().trim()));
  if (myToken !== _detailToken) return;   // Nieuwere aanroep actief — stop
  const meta = TYPE_META[tab];
  const schema = SCHEMA[tab];
  const vis = e._visibility || 'visible';
  const isPersonage = tab === 'personages';
  const showSheet = isPersonage && isDM();
  const fileUrl = api.fileUrl(e.id);

  // ── Tab: Info ──
  let infoHtml = '';

  // Image(s) — carousel when extra images exist, else single portrait
  const _extraImgs = _parseExtraImages(e.data?.extraImages);
  const _primaryCaption = e.data?.imgCaption || '';
  const _heroBadge = getSubtypeBadge(tab, e);
  // Bouw meta-panel (rechterkolom naast afbeelding)
  const _d = e.data || {};
  const _heroBgColor = { personages:'#f5f7ee', locaties:'#f0f3f8', organisaties:'#f8f0f0', voorwerpen:'#faf3e0', documenten:'#f5f2f8' }[tab] || '#faf4e6';
  const _heroMetaItems = [];
  if (tab === 'personages') {
    if (_d.rol)    _heroMetaItems.push(`<span class="hero-meta-rol">${esc(_d.rol)}</span>`);
    if (_d.ras)    _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.ras)}</span>`);
    if (_d.klasse) _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.klasse)}</span>`);
  } else if (tab === 'locaties') {
    if (_d.locType) _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.locType)}</span>`);
    if (_d.wijk)    _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.wijk)}</span>`);
  } else if (tab === 'organisaties') {
    if (_d.orgType) _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.orgType)}</span>`);
  } else if (tab === 'voorwerpen') {
    if (_d.itemType) _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_normItemType(_d.itemType))}</span>`);
    if (_d.rariteit) _heroMetaItems.push(`<span class="hero-meta-tag">${esc(_d.rariteit)}</span>`);
  }

  if (_extraImgs.length > 0) {
    const _allImgs = [{ id: e.id, caption: _primaryCaption }, ..._extraImgs];
    infoHtml += _entityCarouselHtml(e.id, _allImgs);
  } else {
    infoHtml += `
      <div class="detail-hero mb-4" id="detail-img-wrap-${e.id}">
        <div class="detail-hero-img-col" onclick="window.app.openLightbox('${fileUrl}','${escJS(e.name)}')">
          <img src="${fileUrl}" class="detail-hero-img"
            style="${_d.imgFocus ? `object-position:${_d.imgFocus}` : ''}"
            onerror="this.closest('.detail-hero-img-col').style.display='none'">
          <div class="detail-hero-overlay"></div>
          ${_heroBadge ? `<div class="detail-hero-badge badge ${_heroBadge.cls}">${esc(_heroBadge.label)}</div>` : ''}
        </div>
        <div class="detail-hero-meta" style="background:${_heroBgColor}">
          <div class="hero-meta-icon">${getAutoIcon(tab, e)}</div>
          ${_heroMetaItems.join('')}
          ${_primaryCaption ? `<p class="hero-meta-caption">${esc(_primaryCaption)}</p>` : ''}
        </div>
      </div>
    `;
  }

  // Upload en audio-beheer staan in de bewerkmodus (openEditor), niet in de detailview

  // Rol badge
  const rolVal = e.data?.rol;
  if (rolVal) {
    infoHtml += `<div class="text-center mb-4"><span class="detail-role-badge">${esc(rolVal)}</span></div>`;
  }

  // Voorwerpen: rariteit + attunement als compacte subtitelrij direct onder hero
  if (tab === 'voorwerpen') {
    const _rar = e.data?.rariteit;
    const _att = e.data?.attunement === true || e.data?.attunement === 'true';
    if (_rar || _att) {
      infoHtml += `<div class="detail-item-subtitle">
        ${_rar ? `<span class="detail-item-rarity">${esc(_rar)}</span>` : ''}
        ${_att ? `<span class="detail-item-attunement">Requires Attunement</span>` : ''}
      </div>`;
    }
  }

  // Short metadata → labeled pills; description → block
  const _metaPills = [];
  let _descVal = '';
  for (const field of (schema.fields || [])) {
    if (['geheim', 'flavour', 'rol', 'stapelbaar', 'attunement'].includes(field.key)) continue;
    if (tab === 'voorwerpen' && ['itemType', 'rariteit'].includes(field.key)) continue;
    if (field.dmOnly) continue;
    const val = e.data?.[field.key];
    if (!val) continue;
    if (field.key === 'desc') {
      _descVal = val;
    } else {
      _metaPills.push(`<span class="detail-meta-pill"><span class="pill-lbl">${esc(field.label)}</span>${esc(val)}</span>`);
    }
  }
  if (_metaPills.length) {
    infoHtml += `<div class="detail-meta-pills">${_metaPills.join('')}</div>`;
  }
  if (tab === 'locaties' && window._pinnedLocIds?.has(e.id)) {
    infoHtml += `<div class="detail-map-link-wrap">
      <button class="detail-map-link-btn" onclick="window._toonOpKaart('${esc(e.id)}')">
        📍 Toon op kaart
      </button>
    </div>`;
  }
  if (_descVal) {
    infoHtml += `<div class="detail-desc mb-4">${mdToHtml(_descVal)}</div>`;
  }

  // Persoonlijkheid (DM only)
  const persVal = e.data?.persoonlijkheid;
  if (persVal && isDM()) {
    infoHtml += `
      <div class="dm-only mb-4">
        <div class="detail-field-label">\ud83c\udfad Persoonlijkheid</div>
        <div class="detail-dm-block">${mdToHtml(persVal)}</div>
      </div>
    `;
  }

  // Flavour scroll (parchment scroll — zichtbaar voor spelers als uitgesproken, altijd voor DM)
  const flavourVal = e.data?.flavour;
  const flavourUitgespr = e.data?.flavourUitgesproken === true || e.data?.flavourUitgesproken === 'true';
  const _audioId   = e.data?.audioId || '';
  const flavourZichtbaar = isDM() || flavourUitgespr;
  if ((flavourVal && flavourZichtbaar) || (isDM() && !flavourVal && _audioId)) {
    infoHtml += `<div class="detail-divider">— ✦ —</div>`;
    if (flavourVal && flavourZichtbaar) {
      infoHtml += `
        <div class="flavour-scroll${isDM() && !flavourUitgespr ? ' flavour-scroll--ongespoken' : ''}">
          <div class="flavour-scroll-rod"></div>
          <div class="flavour-scroll-content">
            <p class="flavour-text">\u201e${esc(flavourVal)}\u201c</p>
            ${_audioId ? `
              <div class="flavour-audio-wrap">
                <button type="button" class="flavour-audio-play" data-audio-btn data-audio-btn-id="${esc(_audioId)}"
                  onclick="window._audioToggle('${esc(_audioId)}')" title="Sfeer afspelen / pauzeren">▶</button>
              </div>` : ''}
          </div>
          <div class="flavour-scroll-rod"></div>
        </div>`;
    }
  }

  // Geheim field
  const geheimVal = e.data?.geheim;
  if (geheimVal && (isDM() || e._secretReveal)) {
    infoHtml += `
      <div class="mb-4">
        <div class="detail-field-label detail-field-label--secret">\ud83d\udd12 Geheim</div>
        <div class="detail-dm-block detail-dm-block--secret">${mdToHtml(geheimVal)}</div>
      </div>
    `;
  }

  // DM controls
  if (isDM()) {
    const _ts = ['personages', 'locaties'].includes(tab);
    const _mVisIcon  = vis === 'visible' ? '\ud83d\udc41'
                     : vis === 'vague'   ? '\ud83d\udc64'
                     :                    '\ud83d\udd12';
    const _mVisCls   = vis === 'visible' ? 'bg-green-wax text-white'
                     : vis === 'vague'   ? 'bg-gold-dim/60 text-room-bg'
                     :                    'bg-room-elevated text-ink-dim';
    const _mVisTitle = vis === 'visible' ? 'Verbergen  ·  Shift: vaag tonen'
                     : vis === 'vague'   ? 'Volledig tonen  ·  Shift: vaag houden'
                     : _ts              ? 'Zichtbaar maken  ·  Shift: vaag tonen'
                     :                    'Zichtbaar maken';
    infoHtml += `
      <div class="dm-only mt-4 pt-4 border-t border-room-border">
        <div class="flex flex-wrap gap-2 mb-3">
          <button class="dm-btn ${_mVisCls}"
            title="${_mVisTitle}"
            onclick="window._toggleVis('${tab}','${e.id}',event)">
            ${_mVisIcon}
          </button>
          ${(isPersonage || tab === 'locaties') ? `
            <button class="dm-btn ${e._secretReveal ? 'bg-seal text-white' : 'bg-room-elevated text-ink-dim'}"
              title="${e._secretReveal ? 'Geheim verbergen voor spelers' : 'Geheim onthullen aan spelers'}"
              onclick="window._toggleSecret('${tab}','${e.id}')">
              ${e._secretReveal ? '✨' : '🔒'}
            </button>
          ` : ''}
          <button class="dm-btn ${e._deceased ? 'bg-red-800 text-white' : 'bg-room-elevated text-ink-dim'}"
            title="${e._deceased ? 'Markering verwijderen' : 'Markeer als deceased'}"
            onclick="window._toggleDeceased('${tab}','${e.id}')">
            ☠
          </button>
          <button class="dm-btn bg-gold-dim/80 text-room-bg"
            title="Bewerk dit kaartje (afbeelding, tekst, geluid)"
            onclick="window._openEditor('${tab}','${e.id}')">
            ✏
          </button>
        </div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">DM Notities</div>
        <textarea id="dm-note-${e.id}" class="w-full min-h-[80px] px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities...">${esc(e._dmNote || '')}</textarea>
        <div id="note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
      </div>
    `;

    // DM ziet de aantekeningen van alle spelers (read-only, gelabeld)
    if (playerNotesData?.notes && Object.keys(playerNotesData.notes).length > 0) {
      infoHtml += `
        <div class="dm-only mt-3 pt-3 border-t border-room-border/50">
          <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2">Spelersaantekeningen</div>
          ${Object.entries(playerNotesData.notes).map(([name, text]) => `
            <div class="mb-2">
              <div class="text-xs text-gold font-cinzel font-semibold mb-0.5">${esc(name)}</div>
              <div class="text-sm text-ink-medium bg-room-bg border border-room-border/50 rounded px-3 py-2 font-crimson">${esc(text)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // Eigen spelersaantekening (zichtbaar voor ingelogde speler)
  const playerName = window.app?.state?.playerName;
  if (playerName && !isDM()) {
    const myNote = playerNotesData?.note || '';
    infoHtml += `
      <div class="mt-4 pt-4 border-t border-room-border">
        <div class="text-xs font-cinzel text-gold font-bold uppercase tracking-wider mb-1">✏ Mijn aantekeningen</div>
        <textarea id="player-note-${e.id}"
          class="w-full min-h-[70px] px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities voor jezelf...">${esc(myNote)}</textarea>
        <div id="player-note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
      </div>
    `;
  }

  // ── Tab: Character Sheet (DM + personages only) ──
  let sheetHtml = '';
  if (showSheet) {
    const s = e.stats || {};
    const hasStats = Object.values(s).some(v => v);
    if (hasStats) {
      const mod = (v) => {
        if (!v) return '\u2014';
        const m = Math.floor((parseInt(v) - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
      };
      // Combat header (AC, HP, Speed, CR, Prof Bonus)
      const _combatStats = ['ac','hp','speed'].filter(k => s[k]).map(k =>
        `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">${k.toUpperCase()}</div><div class="text-2xl font-bold text-ink-bright">${esc(s[k])}</div></div>`
      ).join('');
      const _crStat = s.cr ? `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">CR</div><div class="text-2xl font-bold text-ink-bright">${esc(s.cr)}</div></div>` : '';
      const _profStat = s.profBonus ? `<div class="text-center"><div class="text-xs text-ink-dim font-cinzel uppercase">Prof</div><div class="text-2xl font-bold text-ink-bright">${esc(s.profBonus)}</div></div>` : '';

      // Property rows
      const _propRows = [
        ['savingThrows','Saving Throws'],
        ['skills','Skills'],
        ['resistances','Damage Resistances'],
        ['immunities','Damage Immunities'],
        ['conditionImmunities','Condition Immunities'],
        ['senses','Senses'],
        ['languages','Languages'],
      ].filter(([k]) => s[k]).map(([k, label]) =>
        `<div class="flex gap-2"><span class="font-cinzel text-ink-dim text-[10px] uppercase flex-shrink-0 w-40">${label}</span><span class="text-ink-medium">${esc(s[k])}</span></div>`
      ).join('');
      const _propTable = _propRows ? `<div class="mt-3 border-t border-room-border pt-3 text-sm space-y-1">${_propRows}</div>` : '';

      // Narrative sections
      const _narrative = [
        ['traits','Traits'],
        ['actions','Actions'],
        ['bonusActions','Bonus Actions'],
        ['reactions','Reactions'],
        ['legendaryActions','Legendary Actions'],
      ].filter(([k]) => s[k]).map(([k, label]) =>
        `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">${label}</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s[k])}</div></div>`
      ).join('');

      // Spells
      const _spells = [
        s.cantrips ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">Cantrips</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s.cantrips)}</div></div>` : '',
        s.spells ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">Spells</div><div class="text-sm text-ink-medium sheet-narrative">${mdToHtml(s.spells)}</div></div>` : '',
      ].join('');

      sheetHtml += `
        <div class="mb-4 p-4 bg-room-elevated rounded border border-room-border">
          <div class="flex flex-wrap gap-4 mb-4 text-sm">
            ${_combatStats}${_crStat}${_profStat}
          </div>
          <div class="stat-grid">
            ${['str','dex','con','int','wis','cha'].map(a => `
              <div class="stat-box">
                <div class="stat-label">${a.toUpperCase()}</div>
                <div class="stat-val">${s[a] || '\u2014'}</div>
                <div class="stat-mod">${mod(s[a])}</div>
              </div>
            `).join('')}
          </div>
          ${_propTable}
          ${_narrative}
          ${_spells}
          ${s.extra ? `<div class="mt-3 border-t border-room-border pt-3 text-sm text-ink-medium sheet-narrative">${mdToHtml(s.extra)}</div>` : ''}
        </div>
      `;
    } else {
      sheetHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Nog geen statistieken ingevuld</div>`;
    }
  }

  // ── Tab: Verbindingen ──
  let verbHtml = '';
  for (const lt of LINK_TYPES) {
    const names = e.links?.[lt] || [];
    if (names.length === 0) continue;
    const lm = TYPE_META[lt] || { icon: '\ud83d\udcdc', chip: 'chip-doc' };
    verbHtml += `
      <div class="mb-4">
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-2">${LINK_LABELS[lt] || lt}</div>
        <div class="flex flex-wrap gap-1.5">
          ${names.map(n => `<span class="chip ${lm.chip} cursor-pointer" data-tab="${lt}" data-name="${esc(n)}" onclick="window._navigateTo(this.dataset.tab,this.dataset.name)">${lm.icon} ${esc(n)}</span>`).join('')}
        </div>
      </div>
    `;
  }
  if (!verbHtml) {
    verbHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Geen verbindingen</div>`;
  }

  // ── Tab: Eigenaren (stapelbare voorwerpen, DM only) ──
  const isStapelbaarVoorwerp = tab === 'voorwerpen' && (e.data?.stapelbaar === 'true' || e.data?.stapelbaar === true);
  let eigenarenHtml = '';
  if (isStapelbaarVoorwerp && isDM()) {
    const eigenaren = Array.isArray(_ownership.owners[e.id]) ? _ownership.owners[e.id] : [];
    if (eigenaren.length > 0) {
      eigenarenHtml = `
        <div class="rounded border border-room-border overflow-hidden mb-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2.5 text-left font-cinzel text-ink-dim text-[10px] uppercase tracking-wider">Speler</th>
                <th class="px-4 py-2.5 text-center font-cinzel text-ink-dim text-[10px] uppercase tracking-wider">Aantal</th>
                <th class="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              ${eigenaren.map((o, i) => `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0">
                  <td class="px-4 py-2.5 text-ink-bright font-crimson">${esc(o.playerName)}</td>
                  <td class="px-4 py-2.5 text-center">
                    <span class="inline-flex items-center gap-2">
                      <button onclick="window._eigenaarQtyAdj('${esc(e.id)}','${esc(o.characterId)}',-1)"
                        class="w-6 h-6 flex items-center justify-center rounded bg-room-bg border border-room-border text-ink-dim hover:text-ink-bright transition">−</button>
                      <span class="text-ink-bright font-cinzel w-6 text-center">${o.qty || 1}</span>
                      <button onclick="window._eigenaarQtyAdj('${esc(e.id)}','${esc(o.characterId)}',1)"
                        class="w-6 h-6 flex items-center justify-center rounded bg-room-bg border border-room-border text-ink-dim hover:text-ink-bright transition">+</button>
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <button onclick="window._eigenaarVerwijder('${esc(e.id)}','${esc(o.characterId)}')"
                      class="text-seal hover:bg-seal/20 px-1.5 py-0.5 rounded transition text-xs" title="Verwijder eigendom">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      eigenarenHtml = `<div class="text-center py-6 text-ink-faint font-fell italic">Geen eigenaren</div>`;
    }
    eigenarenHtml += `
      <button onclick="window._itemGiveToPlayer('${esc(e.id)}')"
        class="px-4 py-2 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
        🎁 Geef exemplaren aan speler
      </button>`;
  }

  // ── Tab: Voorraad (verkopers & winkels) ──
  const isVerkoper = e.subtype === 'verkoper';
  const isWinkel = tab === 'locaties' && e.data?.locType === 'Winkel';
  const heeftVoorraad = isVerkoper || isWinkel;
  let voorraadHtml = '';
  if (heeftVoorraad) {
    const _appMeta = window.app?.state?.meta || {};
    const _buitenEntiteiten = _appMeta.buitenGrisburgEntiteiten || [];
    if (!isDM() && _appMeta.buitenGrisburgh && !_buitenEntiteiten.includes(e.id)) {
      voorraadHtml = `<div style="text-align:center;padding:2rem 1rem">
        <div style="font-size:2rem;margin-bottom:.5rem">🔒</div>
        <p style="color:var(--color-ink-dim,.7rem)">${esc(e.name)} is momenteel niet bereikbaar.</p>
        <p style="font-size:.8rem;opacity:.5">De groep bevindt zich buiten Grisburgh.</p>
      </div>`;
    } else {
    // Gebruik beschikbaarData als die beschikbaar is, anders val terug op ruwe voorraad
    let voorraadItems;
    const roterend = beschikbaarData?.roterend || false;
    const geldigTot = beschikbaarData?.geldigTot || null;
    if (beschikbaarData?.items) {
      voorraadItems = beschikbaarData.items;
    } else {
      try { voorraadItems = e.data?.voorraad ? JSON.parse(e.data.voorraad) : []; } catch { voorraadItems = []; }
      voorraadItems = voorraadItems.map(item => ({
        ...item,
        uitverkocht: uitverkochtSet.has((item.naam || '').toLowerCase().trim()),
        actief: true,
      }));
    }

    // Beurs weergave (alleen voor spelers) — altijd persoonlijke beurs
    let beursHtml = '';
    if (!isDM() && shopCurrencyData) {
      const cur = shopCurrencyData.player;
      const _cN = window._currency || { fl: 'fl', kn: 'kn', cl: 'cl' };
      if (cur) {
        beursHtml = `<div class="shop-beurs">
          <span class="shop-beurs-label">💰 Jouw beurs</span>
          <span class="shop-beurs-amount">${cur.fl ?? 0} ${esc(_cN.fl)} · ${cur.kn ?? 0} ${esc(_cN.kn)} · ${cur.cl ?? 0} ${esc(_cN.cl)}</span>
        </div>`;
      }
    }

    // Rotatie-timer
    let roterendHtml = '';
    if (roterend && geldigTot) {
      const diff = new Date(geldigTot) - Date.now();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      roterendHtml = `<div class="shop-rotatie-info">🔄 Assortiment ververst over ${h > 0 ? h + 'u ' : ''}${m}m</div>`;
    }

    const _shopId = e.id;
    const discountPct = beschikbaarData?.discountPct || 0;

    // Sfeer bovenaan
    const _sfeerTekst = beschikbaarData?.sfeerTekst || '';
    const _sfeerImageId = e.imageId || '';
    const sfeerHtml = (_sfeerTekst || _sfeerImageId) ? `
      <div class="shop-sfeer">
        ${_sfeerImageId ? `<img src="${api.fileUrl(_sfeerImageId)}" class="shop-sfeer-img" alt="">` : ''}
        ${_sfeerTekst ? `<p class="shop-sfeer-tekst">${esc(_sfeerTekst)}</p>` : ''}
      </div>` : '';

    const kortingBannerHtml = discountPct > 0
      ? `<div class="shop-korting-banner shop-korting-banner--ok">🎲 ${discountPct}% korting actief!</div>`
      : discountPct < 0
        ? `<div class="shop-korting-banner shop-korting-banner--malus">🎲 Prijs ${Math.abs(discountPct)}% hoger</div>`
        : '';

    if (voorraadItems.length > 0) {
      // Onderhandelen button (alleen voor spelers)
      const onderhandelHtml = !isDM() ? `
        <div id="shop-onderhandel-wrap" class="shop-onderhandel-wrap">
          <button class="shop-onderhandel-btn" onclick="window._onderhandelOpen('${esc(_shopId)}')">
            🎲 Onderhandelen
          </button>
          <div id="shop-onderhandel-panel-${esc(_shopId)}" class="shop-onderhandel-panel hidden">
            <div class="flex items-center gap-2">
              <label class="text-xs text-ink-dim">CHA-modifier:</label>
              <input type="number" id="shop-cha-mod-${esc(_shopId)}" value="0" min="-5" max="10"
                class="shop-cha-input" style="width:56px">
              <button class="shop-onderhandel-roll-btn"
                onclick="window._onderhandelRoll('${esc(_shopId)}')">Gooien</button>
              <button class="shop-onderhandel-annuleer"
                onclick="document.getElementById('shop-onderhandel-panel-${esc(_shopId)}').classList.add('hidden')">✕</button>
            </div>
          </div>
          <div id="shop-onderhandel-result-${esc(_shopId)}" class="shop-onderhandel-result hidden"></div>
        </div>` : '';

      voorraadHtml = `
        ${sfeerHtml}
        ${kortingBannerHtml}
        ${beursHtml}
        ${roterendHtml}
        <div class="rounded border border-room-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2.5 text-left font-cinzel text-ink-dim text-[10px] uppercase tracking-wider">Voorwerp</th>
                <th class="px-4 py-2.5 text-right font-cinzel text-ink-dim text-[10px] uppercase tracking-wider">Prijs</th>
                ${isDM() && roterend ? `<th class="px-3 py-2.5 text-center font-cinzel text-ink-dim text-[10px] uppercase" title="Actief voor spelers">✦</th>` : ''}
                ${isDM() ? `<th class="px-3 py-2.5 text-center font-cinzel text-ink-dim text-[10px] uppercase tracking-wider" title="Uitverkocht">UV</th>` : ''}
                ${!isDM() ? `<th class="px-2 py-2.5"></th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${voorraadItems.map((item, i) => {
                const uitverkocht = item.uitverkocht;
                const actief = item.actief;
                const thumbHtml = item.imageId
                  ? `<img src="${api.fileUrl(item.imageId)}" class="shop-item-thumb" alt="">`
                  : '';
                const naamHtml = item.entityId
                  ? `<span class="cursor-pointer hover:text-gold transition underline decoration-dotted${uitverkocht ? ' winkel-uitverkocht-naam' : ''} shop-item-with-desc"
                       onclick="window._openDetailFromShop('${esc(item.entityId)}')"
                       data-desc="${esc(item.desc || '')}">${esc(item.naam || '\u2014')}</span>`
                  : `<span class="${uitverkocht ? 'winkel-uitverkocht-naam' : ''}">${esc(item.naam || '\u2014')}</span>`;
                return `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0${uitverkocht ? ' winkel-uitverkocht-rij' : ''}">
                  <td class="px-4 py-2.5 font-crimson">
                    <div class="flex items-center gap-2">
                      ${thumbHtml}${naamHtml}
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-right font-crimson ${uitverkocht ? 'text-ink-faint' : 'text-ink-medium'}">
                    ${esc(item.prijs || '\u2014')}
                    ${!uitverkocht && discountPct > 0 ? `<span class="shop-korting-badge">-${discountPct}%</span>` : ''}
                    ${!uitverkocht && discountPct < 0 ? `<span class="shop-korting-badge shop-korting-badge--malus">+${Math.abs(discountPct)}%</span>` : ''}
                  </td>
                  ${isDM() && roterend ? `<td class="px-3 py-2.5 text-center">${actief ? '<span class="shop-actief-badge" title="Actief voor spelers">✦</span>' : ''}</td>` : ''}
                  ${isDM() ? `
                  <td class="px-3 py-2.5 text-center">
                    <input type="checkbox" class="winkel-uitverkocht-cb" title="Uitverkocht voor deze party"
                      ${uitverkocht ? 'checked' : ''}
                      onchange="window._toggleShopUitverkocht('${esc(_shopId)}','${esc(item.naam || '')}',this)">
                  </td>` : ''}
                  ${!isDM() ? `
                  <td class="px-2 py-2.5 text-right">
                    ${uitverkocht ? `<span class="text-xs text-ink-faint italic">Uitverkocht</span>` : `
                      <div class="flex items-center gap-1 justify-end">
                        ${item.stapelbaar ? `
                          <input type="number" min="1" max="99" value="1"
                            class="shop-qty-input" id="shop-qty-${i}"
                            onclick="event.stopPropagation()" oninput="this.value=Math.max(1,parseInt(this.value)||1)">
                        ` : ''}
                        <button class="shop-koop-btn"
                          onclick="window._koopItem('${esc(_shopId)}','${esc(item.naam || '')}','${esc(item.entityId || '')}',this,${item.stapelbaar ? `parseInt(document.getElementById('shop-qty-${i}')?.value)||1` : '1'})">
                          Kopen
                        </button>
                      </div>
                    `}
                  </td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${onderhandelHtml}
        <div id="shop-koop-feedback" class="shop-koop-feedback hidden"></div>`;
    } else {
      voorraadHtml = `${sfeerHtml}${kortingBannerHtml}${beursHtml}${roterendHtml}<div class="text-center py-10 text-ink-faint font-fell italic">Geen voorraad beschikbaar</div>`;
    }
    } // end else (niet buitenGrisburgh)
  }

  // ── Build log HTML for DM ──
  let logHtml = '';
  if (heeftVoorraad && isDM()) {
    const entries = shopLogData?.entries || [];
    if (entries.length > 0) {
      logHtml = `
        <div class="rounded border border-room-border overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-room-elevated border-b border-room-border">
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Tijdstip</th>
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Speler</th>
                <th class="px-4 py-2 text-left font-cinzel text-ink-dim text-[10px] uppercase">Voorwerp</th>
                <th class="px-4 py-2 text-right font-cinzel text-ink-dim text-[10px] uppercase">Prijs</th>
                <th class="px-3 py-2 text-center font-cinzel text-ink-dim text-[10px] uppercase">#</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((entry, i) => `
                <tr class="${i % 2 === 1 ? 'bg-room-elevated/40' : ''} border-b border-room-border/40 last:border-0">
                  <td class="px-4 py-2 text-ink-dim text-xs">${esc(new Date(entry.ts).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }))}</td>
                  <td class="px-4 py-2 text-ink-bright font-crimson">${esc(entry.playerName || '?')}</td>
                  <td class="px-4 py-2 text-ink-medium font-crimson">${esc(entry.itemNaam || '?')}</td>
                  <td class="px-4 py-2 text-right text-ink-dim">${esc(entry.prijs || '\u2014')}</td>
                  <td class="px-3 py-2 text-center text-ink-dim">${entry.aantal > 1 ? entry.aantal : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      logHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Nog geen aankopen geregistreerd</div>`;
    }
  }

  // ── Build tabbed modal body ──
  const detailTabs = [
    { key: 'info', label: 'Info' },
    ...(showSheet ? [{ key: 'sheet', label: 'Character Sheet' }] : []),
    ...(isStapelbaarVoorwerp && isDM() ? [{ key: 'eigenaren', label: 'Eigenaren' }] : []),
    ...(heeftVoorraad ? [{ key: 'voorraad', label: 'Voorraad' }] : []),
    ...(heeftVoorraad && isDM() ? [{ key: 'log', label: '📋 Log' }] : []),
    { key: 'verbindingen', label: 'Verbindingen' },
  ];

  const tabNav = detailTabs.map((t, i) => `
    <button class="detail-tab px-4 py-2 text-xs font-cinzel font-semibold transition rounded-t
      ${i === 0 ? 'text-gold border-b-2 border-gold' : 'text-ink-dim hover:text-ink-medium'}"
      data-dtab="${t.key}">${t.label}</button>
  `).join('');

  const body = `
    <div class="flex gap-0.5 border-b border-room-border mb-4">${tabNav}</div>
    <div id="dtab-info">${infoHtml}</div>
    ${showSheet ? `<div id="dtab-sheet" class="hidden">${sheetHtml}</div>` : ''}
    ${isStapelbaarVoorwerp && isDM() ? `<div id="dtab-eigenaren" class="hidden">${eigenarenHtml}</div>` : ''}
    ${heeftVoorraad ? `<div id="dtab-voorraad" class="hidden">${voorraadHtml}</div>` : ''}
    ${heeftVoorraad && isDM() ? `<div id="dtab-log" class="hidden">${logHtml}</div>` : ''}
    <div id="dtab-verbindingen" class="hidden">${verbHtml}</div>
  `;

  const _subParts = [
    e.data?.rol,
    e.data?.ras,
    e.data?.klasse,
    e.data?.locType,
    e.data?.wijk,
    e.data?.orgType,
    e.data?.itemType ? _normItemType(e.data.itemType) : null,
    e.data?.rariteit ? (({'Gewoon':'Common','Ongewoon':'Uncommon','Zeldzaam':'Rare','Zeer zeldzaam':'Very Rare','Legendarisch':'Legendary'})[e.data.rariteit] || e.data.rariteit) : null,
  ].filter(Boolean);
  const _subtitle = _subParts.length
    ? `${getAutoIcon(tab, e)}  ${_subParts.join(' · ')}`
    : `${getAutoIcon(tab, e)}  ${meta.label}`;
  openModal(e.name, _subtitle, body);
  _updateBackButton();

  // Set type accent bar
  const _accentEl = document.getElementById('m-accent');
  if (_accentEl) _accentEl.className = `modal-accent bar-${tab}`;

  // Portrait in modal header
  const _mPortraitWrap = document.getElementById('m-portrait-wrap');
  const _mPortraitImg  = document.getElementById('m-portrait');
  if (_mPortraitWrap && _mPortraitImg) {
    _mPortraitWrap.classList.add('hidden');
    _mPortraitImg.src = '';
    _mPortraitImg.onerror = () => _mPortraitWrap.classList.add('hidden');
    _mPortraitImg.onload  = () => _mPortraitWrap.classList.remove('hidden');
    _mPortraitImg.src = fileUrl;
  }

  // Modal header type-color tint
  const _mHead = document.getElementById('modal-head');
  if (_mHead) _mHead.className = `modal-head modal-head--${tab}`;

  // Tab switching
  const allTabKeys = detailTabs.map(t => t.key);
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.dtab;
      document.querySelectorAll('.detail-tab').forEach(b => {
        b.classList.toggle('text-gold', b === btn);
        b.classList.toggle('border-b-2', b === btn);
        b.classList.toggle('border-gold', b === btn);
        b.classList.toggle('text-ink-dim', b !== btn);
      });
      allTabKeys.forEach(k => {
        const panel = document.getElementById(`dtab-${k}`);
        if (panel) panel.classList.toggle('hidden', k !== target);
      });
    });
  });

  // Activeer een specifieke tab als gevraagd (bijv. na aankoop terug naar voorraad)
  if (openTabKey) {
    const targetBtn = document.querySelector(`.detail-tab[data-dtab="${openTabKey}"]`);
    if (targetBtn) targetBtn.click();
  }

  // DM note auto-save
  if (isDM()) {
    let noteTimer;
    const ta = document.getElementById(`dm-note-${e.id}`);
    if (ta) {
      ta.addEventListener('input', () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(async () => {
          await api.saveNote(e.id, ta.value);
          const ind = document.getElementById(`note-save-${e.id}`);
          if (ind) {
            ind.textContent = '\u2713 Opgeslagen';
            ind.style.opacity = '1';
            setTimeout(() => { ind.style.opacity = '0'; }, 1200);
          }
        }, 400);
      });
    }
  }

  // Spelersnotitie auto-save
  if (window.app?.state?.playerName && !isDM()) {
    let playerNoteTimer;
    const pta = document.getElementById(`player-note-${e.id}`);
    if (pta) {
      pta.addEventListener('input', () => {
        clearTimeout(playerNoteTimer);
        playerNoteTimer = setTimeout(async () => {
          await api.savePlayerNote(e.id, pta.value);
          const ind = document.getElementById(`player-note-save-${e.id}`);
          if (ind) {
            ind.textContent = '\u2713 Opgeslagen';
            ind.style.opacity = '1';
            setTimeout(() => { ind.style.opacity = '0'; }, 1200);
          }
        }, 600);
      });
    }
  }
};

// ── Voorwerpen: claimen & eigendom ──

window._itemClaim = async (itemId) => {
  try {
    await api.requestItem(itemId, { type: 'claim' });
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) {
    if (err.message?.includes('Al een')) alert('Je hebt al een openstaand verzoek voor dit voorwerp.');
    else alert('Fout: ' + err.message);
  }
};

window._itemRemoveOwner = async (itemId) => {
  if (!confirm('Eigendom verwijderen van dit voorwerp?')) return;
  try {
    await api.removeItemOwner(itemId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

// ── Stapelbaar eigendom: qty aanpassen / verwijderen (DM vanuit Eigenaren-tab) ──
// ── Klik op gekoppeld voorwerp vanuit winkeldetail ──
// Onthult het kaartje stil als het nog hidden was, dan opent de detailview.
window._openDetailFromShop = async (entityId) => {
  try {
    await api.shopRevealItem('voorwerpen', entityId);
  } catch { /* stil falen — detail openen lukt altijd */ }
  window._openDetail('voorwerpen', entityId);
};

// ── Speler koopt voorwerp uit winkel ──
window._koopItem = async (shopId, itemNaam, entityId, btn, aantal = 1) => {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const feedback = document.getElementById('shop-koop-feedback');
  try {
    await api.koopShopItem(shopId, { itemNaam, entityId: entityId || undefined, aantal });
    // Herlaad de modal maar blijf op de voorraadtab
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
    // Succesbericht in de voorraadtab
    const fb = document.getElementById('shop-koop-feedback');
    if (fb) {
      fb.innerHTML = `✓ ${aantal > 1 ? `${aantal}× ` : ''}<strong>${itemNaam}</strong> gekocht!`;
      fb.className = 'shop-koop-feedback shop-koop-feedback--ok';
      fb.classList.remove('hidden');
      setTimeout(() => fb.classList.add('hidden'), 4000);
    }
    // Refresh knapzak zodat het nieuwe item meteen zichtbaar is
    window.app?.refreshSection?.('mijn-karakter');
  } catch (err) {
    const msg = err.message || 'Kon niet kopen';
    if (feedback) {
      feedback.textContent = '⚠ ' + msg;
      feedback.className = 'shop-koop-feedback shop-koop-feedback--fout';
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 5000);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Kopen'; }
  }
};

// ── Winkel: onderhandelen ──
window._onderhandelOpen = (shopId) => {
  const panel = document.getElementById(`shop-onderhandel-panel-${shopId}`);
  if (panel) panel.classList.toggle('hidden');
};

window._onderhandelRoll = async (shopId) => {
  const modEl = document.getElementById(`shop-cha-mod-${shopId}`);
  const resultEl = document.getElementById(`shop-onderhandel-result-${shopId}`);
  const modifier = parseInt(modEl?.value) || 0;
  if (resultEl) { resultEl.classList.remove('hidden'); resultEl.innerHTML = '<span class="shop-onderhandel-loading">🎲 …</span>'; }
  try {
    const r = await api.onderhandelShop(shopId, { modifier });
    const modStr = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
    const kleur = r.geslaagd ? 'shop-onderhandel-result--ok' : 'shop-onderhandel-result--fout';
    const tekst = r.geslaagd
      ? `✓ Geslaagd! (${r.diceRoll}${modStr !== '+0' ? ` ${modStr}` : ''} = ${r.totaal} ≥ ${r.dc}) — ${r.kortingPct}% korting actief voor 1 uur.`
      : r.boetePct > 0
        ? `✗ Mislukt. (${r.diceRoll}${modStr !== '+0' ? ` ${modStr}` : ''} = ${r.totaal} < ${r.dc}) — Prijs ${r.boetePct}% hoger voor 1 uur.`
        : `✗ Mislukt. (${r.diceRoll}${modStr !== '+0' ? ` ${modStr}` : ''} = ${r.totaal} < ${r.dc})`;
    if (resultEl) {
      resultEl.className = `shop-onderhandel-result ${kleur}`;
      resultEl.textContent = tekst;
    }
    // Panel sluiten
    document.getElementById(`shop-onderhandel-panel-${shopId}`)?.classList.add('hidden');
    // Herlaad modal voor updated prijzen
    if (window._currentDetailTab && window._currentDetailId) {
      await window._openDetail(window._currentDetailTab, window._currentDetailId, false, 'voorraad');
    }
  } catch (err) {
    if (resultEl) { resultEl.className = 'shop-onderhandel-result shop-onderhandel-result--fout'; resultEl.textContent = err.message || 'Fout'; }
  }
};

// ── Winkel uitverkocht toggle ──
window._toggleShopUitverkocht = async (shopId, itemNaam, cbEl) => {
  try {
    await api.toggleShopUitverkocht(shopId, itemNaam);
    // Her-open detail zodat de tabel opnieuw rendert met bijgewerkte state
    window._openDetail(window._currentDetailTab, shopId);
  } catch (err) {
    if (cbEl) cbEl.checked = !cbEl.checked; // terugdraaien bij fout
    alert('Fout: ' + err.message);
  }
};

window._eigenaarQtyAdj = async (itemId, characterId, delta) => {
  try {
    await api.patchItemOwnerQty(itemId, characterId, delta);
    await refreshOwnership();
    window._openDetail('voorwerpen', itemId);
  } catch (err) { alert('Fout: ' + err.message); }
};

window._eigenaarVerwijder = async (itemId, characterId) => {
  if (!confirm('Eigendom verwijderen voor deze speler?')) return;
  try {
    await api.removeStackOwner(itemId, characterId);
    await refreshOwnership();
    window._openDetail('voorwerpen', itemId);
  } catch (err) { alert('Fout: ' + err.message); }
};

window._itemApproveRequest = async (reqId) => {
  try {
    await api.approveItemRequest(reqId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

window._itemRejectRequest = async (reqId) => {
  try {
    await api.rejectItemRequest(reqId);
    await refreshOwnership();
    renderEntitySection('voorwerpen');
  } catch (err) { alert('Fout: ' + err.message); }
};

// ── Visibility / Secret / Deceased toggles ──
window._toggleVis = async (tab, id, event) => {
  const toVague = event?.shiftKey && ['personages', 'locaties'].includes(tab);
  await api.toggleVisibility(tab, id, toVague ? 'vague' : undefined);
  renderEntitySection(tab);
};

function _secretToast(revealed) {
  const toast = document.createElement('div');
  toast.className = 'bookmark-toast';
  toast.textContent = revealed ? '✨ Geheim onthuld voor spelers' : '🔒 Geheim verborgen voor spelers';
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('bookmark-toast--visible'), 10);
  setTimeout(() => { toast.classList.remove('bookmark-toast--visible'); setTimeout(() => toast.remove(), 300); }, 2500);
}

window._toggleSecret = async (tab, id) => {
  const res = await api.toggleSecret(tab, id);
  _secretToast(res.secretReveal);
  window._openDetail(tab, id);
};

// Toggle vanuit de kaart — detail hoeft niet heropend; socket-event herrendert de kaarten.
window._toggleSecretCard = async (type, id) => {
  const res = await api.toggleSecret(type, id);
  _secretToast(res.secretReveal);
};

window._toggleDeceased = async (tab, id) => {
  try {
    await api.toggleDeceased(tab, id);
    renderEntitySection(tab);
  } catch (err) {
    alert('Fout bij deceased toggle: ' + err.message);
  }
};

// ── Focal point picker ──
let _fpDragging = false;

window._fpDown = (ev) => {
  _fpDragging = true;
  _fpApply(ev);
};
window._fpMove = (ev) => {
  if (!_fpDragging) return;
  _fpApply(ev);
};
document.addEventListener('mouseup', () => { _fpDragging = false; });

function _fpApply(ev) {
  const wrap = document.getElementById('fp-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, Math.round((ev.clientX - rect.left) / rect.width  * 100)));
  const y = Math.max(0, Math.min(100, Math.round((ev.clientY - rect.top)  / rect.height * 100)));
  const val = `${x}% ${y}%`;
  const input = document.getElementById('fp-input');
  if (input) input.value = val;
  const img = document.getElementById('editor-img-preview');
  if (img) img.style.objectPosition = val;
  const card = document.getElementById('fp-card-preview');
  if (card) card.style.objectPosition = val;
  const ch = document.getElementById('fp-crosshair');
  if (ch) { ch.style.left = x + '%'; ch.style.top = y + '%'; }
}

// ── File upload ──
window._onRevealToggle = (groupId, checked) => {
  const group = document.getElementById('reveal-group-' + groupId);
  if (!group) return;
  if (checked) {
    group.style.display = 'contents';
  } else {
    group.style.display = 'none';
    group.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => { el.value = ''; });
  }
};

window._editorFileSelected = (file) => {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Max 10MB'); return; }
  pendingFile = file;
  const zone = document.getElementById('editor-upload-zone');
  if (zone) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      zone.style.padding = '4px';
      zone.innerHTML = `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:4px;display:block"><div class="text-[10px] text-ink-dim mt-1 truncate px-1">${esc(file.name)}</div>`;
    } else {
      zone.innerHTML = `<div style="font-size:1.5rem">📄</div><div class="text-xs text-ink-dim mt-1 truncate">${esc(file.name)}</div>`;
    }
  }
};

window._uploadFile = async (tab, id, file) => {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return alert('Max 10MB');
  await api.uploadFile(id, file);
  window._openDetail(tab, id);
};

// ── Navigate to linked entity ──
window._navigateTo = async (tab, name) => {
  if (!ENTITY_TYPES.includes(tab)) return;
  try {
    const entities = await api.listEntities(tab);
    const entity = entities.find(e => e.name === name);
    if (entity) {
      // Navigeer binnen de modal — history wordt bijgehouden door _openDetail
      window._openDetail(tab, entity.id);
    } else {
      // Niet gevonden: sluit modal en zoek in grid
      closeModal();
      window.app.switchSection(tab);
      searchQueries[tab] = name;
      renderEntitySection(tab);
    }
  } catch {
    closeModal();
    window.app.switchSection(tab);
    searchQueries[tab] = name;
    renderEntitySection(tab);
  }
};

// ── Editor ──
export function openEditor(type) {
  window._openEditor(type);
}

let allNames = {};

window._openEditor = async (tab, editId) => {
  const schema = SCHEMA[tab];
  let e = null;
  if (editId) {
    try { e = await api.getEntity(tab, editId); } catch { return; }
  }
  allNames = await api.allNames();
  let _editorGroups = [];
  try { const { groups } = await api.listGroups(); _editorGroups = groups; } catch { /* ok */ }

  editorTags = {};
  pendingFile = null;
  pendingAudioFile = null;
  _editorOldAudioId = e?.data?.audioId || null;
  for (const lt of LINK_TYPES) {
    editorTags[lt] = e?.links?.[lt]?.slice() || [];
  }

  let body = `<form id="entity-form" class="space-y-4">`;

  // ── Twee-kolom layout ──
  const _autoIc   = getAutoIcon(tab, e || { data: {} });
  const _customIc = e?.data?.icon || '';
  const _showIc   = _customIc || _autoIc;
  const _iconSet  = ICON_SETS[tab] || [];

  body += `<div class="editor-layout">`;

  // ── Linker kolom: afbeelding ──
  body += `<div class="editor-col-left">`;
  {
    const fileUrl = editId ? api.fileUrl(editId) : null;
    const focusVal = e?.data?.imgFocus || '50% 50%';
    const [fx, fy] = (focusVal.match(/(\d+)%\s*(\d+)%/) || [null,'50','50']).slice(1).map(Number);
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Afbeelding</label>
        <div class="mt-1">
          ${fileUrl ? `
            <div id="fp-wrap" class="relative rounded overflow-hidden mb-1 select-none"
              style="height:140px;cursor:crosshair"
              onmousedown="window._fpDown(event)"
              onmousemove="window._fpMove(event)">
              <img id="editor-img-preview" src="${fileUrl}"
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
            <p class="text-[10px] text-ink-dim mb-1">Klik om focuspunt in te stellen</p>
            <input type="hidden" name="data_imgFocus" id="fp-input" value="${focusVal}">
          ` : ''}
          <div class="upload-zone" id="editor-upload-zone"
            onclick="document.getElementById('editor-file-input').click()"
            ondragover="event.preventDefault();this.classList.add('upload-zone--drag')"
            ondragleave="this.classList.remove('upload-zone--drag')"
            ondrop="event.preventDefault();this.classList.remove('upload-zone--drag');window._editorFileSelected(event.dataTransfer.files[0])">
            <div id="upload-zone-content">\ud83d\udcf7 Sleep of klik (max 10MB)</div>
          </div>
          <input type="file" id="editor-file-input" accept="image/*,.pdf,application/pdf" class="hidden"
            onchange="window._editorFileSelected(this.files[0])">
        </div>
      </div>
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Onderschrift</label>
        <input name="data_imgCaption" value="${esc(e?.data?.imgCaption || '')}"
          placeholder="Bijschrift\u2026"
          class="w-full mt-1 px-2 py-1.5 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
      </div>
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">Extra afbeeldingen</div>
        <div id="entity-img-preview" class="editor-img-grid mb-2">
          <span class="text-xs text-ink-faint italic">Nog geen</span>
        </div>
        <label class="inline-flex items-center gap-1 px-2 py-1 bg-room-elevated border border-room-border rounded text-ink-dim text-xs hover:text-ink-bright cursor-pointer transition">
          + Toevoegen
          <input type="file" accept="image/*" multiple class="hidden" onchange="window._addEntityImages(this.files)">
        </label>
      </div>
    `;
  }
  body += `</div>`; // end editor-col-left

  // ── Rechter kolom: naam, icoon, type-velden ──
  body += `<div class="editor-col-right">`;
  body += `
    <div class="flex gap-2 items-end">
      <div class="flex-1 min-w-0">
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Naam</label>
        <input name="name" value="${esc(e?.name || '')}" required
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
      </div>
      <div class="flex-shrink-0">
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider block mb-1">Icoon</label>
        <button type="button" id="icon-picker-btn"
          onclick="window._toggleIconPicker()"
          class="w-10 h-10 text-xl flex items-center justify-center rounded border border-room-border bg-room-elevated hover:border-gold-dim transition select-none">
          <span id="icon-preview">${_showIc}</span>
        </button>
        <input type="hidden" name="data_icon" id="icon-input" value="${esc(_customIc)}">
      </div>
    </div>
    <div id="icon-picker" class="hidden p-2 bg-room-elevated border border-room-border rounded">
      <div class="flex flex-wrap gap-1 mb-1.5">
        <button type="button" onclick="window._selectIcon('')"
          class="px-2 py-0.5 text-[10px] font-cinzel text-ink-dim bg-room-bg border border-room-border rounded hover:border-gold-dim transition${!_customIc ? ' border-gold-dim text-gold' : ''}">
          Automatisch
        </button>
      </div>
      <div class="flex flex-wrap gap-0.5">
        ${_iconSet.map(ic => `<button type="button" onclick="window._selectIcon('${ic}')"
          class="w-8 h-8 text-lg flex items-center justify-center rounded hover:bg-room-bg transition${ic === _customIc ? ' bg-room-bg ring-1 ring-gold-dim' : ''}">${ic}</button>`).join('')}
      </div>
    </div>
  `;

  // Subtype
  if (schema.subtypes) {
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Subtype</label>
        <select name="subtype" id="subtype-select"
          onchange="window._onSubtypeChange(this.value)"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">—</option>
          ${schema.subtypes.map(s => `<option value="${s}" ${e?.subtype === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // Groep-selector (alleen voor personages met subtype speler)
  if (tab === 'personages' && _editorGroups.length > 1) {
    const isSpeler = e?.subtype === 'speler';
    const currentGroep = e?.data?.groep || '';
    body += `
      <div id="groep-section"${isSpeler ? '' : ' style="display:none"'}>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Spelersgroep</label>
        <select name="data_groep"
          class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">Alle groepen</option>
          ${_editorGroups.map(g => `<option value="${esc(g.id)}"${currentGroep === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // Korte velden (niet-textarea) in rechter kolom
  let _revealGroupOpen = null;
  for (const field of schema.fields) {
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    if (field.type === 'textarea') continue;
    // Close open reveal group when leaving it
    if (_revealGroupOpen && field.inReveal !== _revealGroupOpen) {
      body += `</div>`; // end reveal-group div
      _revealGroupOpen = null;
    }
    const val = e?.data?.[field.key] || '';
    if (field.type === 'reveal-toggle') {
      const hasData = schema.fields
        .filter(f => f.inReveal === field.key)
        .some(f => e?.data?.[f.key] && e?.data?.[f.key] !== '');
      body += `
        <div class="flex items-center gap-2">
          <input type="checkbox" id="toggle-${field.key}" class="rounded"
            ${hasData ? 'checked' : ''}
            onchange="window._onRevealToggle('${field.key}', this.checked)">
          <label for="toggle-${field.key}" class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider cursor-pointer">${esc(field.label)}</label>
        </div>
        <div id="reveal-group-${field.key}" style="${hasData ? 'display:contents' : 'display:none'}">
      `;
      _revealGroupOpen = field.key;
      continue;
    }
    if (field.type === 'checkbox') {
      const checked = val === 'true' || val === true;
      body += `
        <div class="flex items-center gap-2">
          <input type="hidden" name="data_${field.key}" value="${checked ? 'true' : ''}">
          <input type="checkbox" id="cb_${field.key}" class="rounded"
            ${checked ? 'checked' : ''}
            onchange="this.previousElementSibling.value=this.checked?'true':''">
          <label for="cb_${field.key}" class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider cursor-pointer">${esc(field.label)}</label>
        </div>
      `;
    } else if (field.type === 'select') {
      const _selOnchange = (tab === 'locaties' && field.key === 'locType')
        ? ' onchange="window._onLocTypeChange(this.value)"' : '';
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">${esc(field.label)}</label>
          <select name="data_${field.key}"${_selOnchange} class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <option value="">—</option>
            ${field.options.map(o => typeof o === 'object' ? `<option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>` : `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
      `;
    } else {
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">${esc(field.label)}</label>
          <input name="data_${field.key}" value="${esc(val)}"
            class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
        </div>
      `;
    }
  }
  if (_revealGroupOpen) { body += `</div>`; _revealGroupOpen = null; }

  body += `</div>`; // end editor-col-right
  body += `</div>`; // end editor-layout

  // ── Textarea velden (volledige breedte) ──
  for (const field of schema.fields) {
    const val = e?.data?.[field.key] || '';
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    if (field.type !== 'textarea') continue;
    const taId = `ta_${field.key}`;
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">${esc(field.label)}</label>
        <div class="mt-1">
          ${fmtToolbar(taId)}
          <textarea id="${taId}" name="data_${field.key}" rows="4"
            onkeydown="window._fmtKey(event)"
            class="w-full px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(val)}</textarea>
        </div>
      </div>
    `;
    if (field.key === 'geheim' && tab === 'personages' && isDM()) {
      const isNpc = e?.subtype === 'NPC';
      const isAntagonist = e?.data?.geheimeAntagonist === true || e?.data?.geheimeAntagonist === 'true';
      body += `
        <div id="geheime-antagonist-section"${isNpc ? '' : ' style="display:none"'} class="flex items-center gap-2 -mt-1">
          <input type="hidden" id="inp-geheimeAntagonist" name="data_geheimeAntagonist" value="${isAntagonist ? 'true' : ''}">
          <input type="checkbox" id="cb-geheimeAntagonist" class="rounded"
            ${isAntagonist ? 'checked' : ''}
            onchange="document.getElementById('inp-geheimeAntagonist').value=this.checked?'true':''">
          <label for="cb-geheimeAntagonist" class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider cursor-pointer">
            💀 Geheime antagonist — subtype wordt antagonist na onthulling
          </label>
        </div>
      `;
    }
    if (field.key === 'flavour') {
      const existingAudioId = e?.data?.audioId || '';
      const valUitgesproken = e?.data?.flavourUitgesproken === true || e?.data?.flavourUitgesproken === 'true';
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">🔊 Geluidsfragment</label>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            ${existingAudioId ? `
              <button type="button" id="editor-audio-preview" class="flavour-audio-btn editor-audio-preview"
                data-audio-btn data-audio-btn-id="${esc(existingAudioId)}"
                onclick="window._audioToggle('${esc(existingAudioId)}')" title="Afspelen / pauzeren">▶</button>
              <span class="text-xs text-ink-dim">Audio bijgevoegd</span>
              <button type="button" onclick="window._editorClearAudio()"
                class="text-xs text-ink-dim hover:text-seal transition ml-auto">✕ Verwijderen</button>
            ` : `
              <div id="editor-audio-preview" class="hidden"></div>
            `}
            <label class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright cursor-pointer transition">
              ${existingAudioId ? '🔁 Vervangen' : '+ Audio toevoegen'}
              <input type="file" accept="audio/*" class="hidden"
                onchange="window._editorAudioSelected(this.files[0])">
            </label>
          </div>
          <div id="editor-audio-name" class="text-xs text-ink-dim mt-1 hidden"></div>
          <input type="hidden" name="data_audioId" id="editor-audio-id" value="${esc(existingAudioId)}">
        </div>
        <div class="flex items-center gap-2 mt-2">
          <input type="hidden" name="data_flavourUitgesproken" id="inp-flavourUitgesproken" value="${valUitgesproken ? 'true' : ''}">
          <input type="checkbox" id="cb-flavourUitgesproken" class="rounded"
            ${valUitgesproken ? 'checked' : ''}
            onchange="document.getElementById('inp-flavourUitgesproken').value=this.checked?'true':''">
          <label for="cb-flavourUitgesproken" class="text-xs text-ink-dim cursor-pointer">
            🍺 Uitgesproken door de waard
          </label>
        </div>
      `;
    }
  }

  // Voorraad (verkopers & winkels)
  if (tab === 'personages' || tab === 'locaties') {
    const _showVoorraad = tab === 'personages' ? e?.subtype === 'verkoper' : e?.data?.locType === 'Winkel';
    let winkelConfigEditor = {};
    try { winkelConfigEditor = e?.data?.winkelConfig ? JSON.parse(e.data.winkelConfig) : {}; } catch {}
    body += `
      <div id="voorraad-section"${_showVoorraad ? '' : ' style="display:none"'}
        class="p-4 bg-room-elevated rounded border border-room-border">
        <div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-3">\ud83c\udfec Voorraad</div>
        <div class="voorraad-inladen-wrap mb-3">
          <button type="button" onclick="window._voorraadInladenToggle()"
            class="text-xs text-ink-dim hover:text-gold transition flex items-center gap-1">
            <span id="voorraad-inladen-chevron">▸</span> Inladen van bestaande winkel…
          </button>
          <div id="voorraad-inladen-panel" class="hidden mt-2 flex gap-2 items-center">
            <select id="voorraad-inladen-select"
              class="flex-1 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              <option value="">— laden… —</option>
            </select>
            <button type="button" onclick="window._voorraadInladen()"
              class="px-3 py-1 bg-room-bg border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
              Inladen
            </button>
          </div>
        </div>
        <div id="voorraad-rows" class="space-y-2 mb-3"></div>
        <button type="button" onclick="window._addVoorraadItem()"
          class="px-3 py-1 bg-room-bg border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright transition">
          + Voorwerp toevoegen
        </button>
        <!-- Winkelconfig: rotatie-instellingen -->
        <div class="mt-4 pt-3 border-t border-room-border/60">
          <div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-2">🔄 Rotatie-instellingen</div>
          <input type="hidden" name="data_winkelConfig" id="winkelconfig-hidden" value="${esc(e?.data?.winkelConfig || '')}">
          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-ink-medium cursor-pointer">
              <input type="checkbox" id="wc-roterend" ${winkelConfigEditor.roterend ? 'checked' : ''} onchange="window._wcUpdate()">
              Roterend assortiment
            </label>
            <div id="wc-extra" class="${winkelConfigEditor.roterend ? '' : 'hidden'} space-y-2 pl-4">
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32">Aantal tegelijk</label>
                <input type="number" id="wc-aantal" min="1" max="50" value="${winkelConfigEditor.aantalItems || 3}"
                  oninput="window._wcUpdate()"
                  class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32">Refresh na (uur)</label>
                <input type="number" id="wc-uren" min="1" value="${winkelConfigEditor.refreshUren || 24}"
                  oninput="window._wcUpdate()"
                  class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
              <div class="flex gap-2 items-center">
                <label class="text-xs text-ink-dim w-32" title="Winkels met hetzelfde label delen één rotatie">Gedeeld met</label>
                <input type="text" id="wc-deelgroep" value="${esc(winkelConfigEditor.deelGroep || '')}"
                  oninput="window._wcUpdate()" placeholder="bijv. mystiek-magazijn"
                  class="flex-1 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
              </div>
            </div>
          </div>
        </div>
        <!-- Sfeer & Onderhandelen instellingen -->
        <div class="mt-4 pt-3 border-t border-room-border/60">
          <div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-2">🎭 Sfeer & onderhandelen</div>
          <div class="space-y-2">
            <div>
              <label class="text-xs text-ink-dim block mb-1">Sfeertekst (bovenaan voorraad)</label>
              <textarea id="wc-sfeer" rows="2" oninput="window._wcUpdate()" placeholder="De schappen liggen vol met…"
                class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(winkelConfigEditor.sfeerTekst || '')}</textarea>
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Onderhandel DC</label>
              <input type="number" id="wc-onderhandel-dc" min="1" max="30" value="${winkelConfigEditor.onderhandelDC ?? 15}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Korting bij succes (%)</label>
              <input type="number" id="wc-onderhandel-korting" min="0" max="90" value="${winkelConfigEditor.onderhandelKorting ?? 10}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
            <div class="flex gap-2 items-center">
              <label class="text-xs text-ink-dim w-32">Boete bij falen (%)</label>
              <input type="number" id="wc-onderhandel-boete" min="0" max="50" value="${winkelConfigEditor.onderhandelBoete ?? 0}"
                oninput="window._wcUpdate()"
                class="w-20 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Stats (personages)
  if (tab === 'personages') {
    const s = e?.stats || {};
    const _si = (k, label, center = false) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <input name="stat_${k}" value="${esc(s[k] || '')}"
          class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none${center ? ' text-center' : ''}">
      </div>`;
    const _ta = (k, label, rows = 3) => {
      const taId = `stat_ta_${k}`;
      return `<div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <div class="mt-0.5">
          ${fmtToolbar(taId)}
          <textarea id="${taId}" name="stat_${k}" rows="${rows}"
            onkeydown="window._fmtKey(event)"
            class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(s[k] || '')}</textarea>
        </div>
      </div>`;
    };
    const _hasStats = Object.values(s).some(v => v);
    body += `
      <details class="cs-accordion"${_hasStats ? ' open' : ''}>
        <summary class="cs-accordion-head">
          <span>⚔ Character Sheet</span>
          <span class="cs-accordion-chevron">▾</span>
        </summary>
        <div class="cs-accordion-body">
          <div class="cs-tabs-bar">
            <button type="button" class="cs-tab-btn cs-tab-active" onclick="window._csTab('gevecht')">Gevecht</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('acties')">Acties</button>
            <button type="button" class="cs-tab-btn" onclick="window._csTab('spreuken')">Spreuken</button>
          </div>

          <div id="cs-panel-gevecht" class="cs-sub-body space-y-2">
            <div class="grid grid-cols-3 gap-2">
              ${_si('ac','AC',true)}${_si('hp','HP',true)}${_si('speed','Speed',true)}
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${_si('cr','Challenge Rating',true)}${_si('profBonus','Prof. Bonus',true)}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Eigenschappen</div>
            <div class="grid grid-cols-3 gap-2">
              ${['str','dex','con','int','wis','cha'].map(k => _si(k, k.toUpperCase(), true)).join('')}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Proficiencies &amp; Verdedigingen</div>
            <div class="space-y-2">
              ${_si('savingThrows','Saving Throws')}
              ${_si('skills','Skills')}
              ${_si('vulnerabilities','Damage Vulnerabilities')}
              ${_si('resistances','Damage Resistances')}
              ${_si('immunities','Damage Immunities')}
              ${_si('conditionImmunities','Condition Immunities')}
            </div>
            <div class="cs-divider"></div>
            <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Zintuigen &amp; Talen</div>
            <div class="space-y-2">
              ${_si('senses','Senses')}
              ${_si('languages','Languages')}
            </div>
          </div>

          <div id="cs-panel-acties" class="cs-sub-body space-y-2" style="display:none">
            ${_ta('traits','Traits', 3)}
            ${_ta('actions','Actions', 4)}
            ${_ta('bonusActions','Bonus Actions', 2)}
            ${_ta('reactions','Reactions', 2)}
            ${_ta('legendaryActions','Legendary Actions', 3)}
          </div>

          <div id="cs-panel-spreuken" class="cs-sub-body space-y-2" style="display:none">
            <div class="grid grid-cols-2 gap-2">
              ${_si('spellSaveDC','Spell Save DC',true)}${_si('spellAttackMod','Spell Attack Mod',true)}
            </div>
            ${_si('cantrips','Cantrips')}
            ${_ta('spells','Spells', 3)}
            ${s.extra ? _ta('extra','Legacy', 2) : ''}
          </div>
        </div>
      </details>
    `;
  }

  // Link editors
  for (const lt of LINK_TYPES) {
    const lm = TYPE_META[lt] || { icon: '\ud83d\udcdc', label: lt, chip: 'chip-doc' };
    body += `
      <div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">${LINK_LABELS[lt] || lm.label || lt}</div>
        <div id="tags-${lt}" class="flex flex-wrap gap-1 mb-1">
          ${editorTags[lt].map(n => `
            <span class="chip ${lm.chip}">${esc(n)} <span class="cursor-pointer ml-1" data-lt="${lt}" data-name="${esc(n)}" onclick="window._removeTag(this.dataset.lt,this.dataset.name)">\u00d7</span></span>
          `).join('')}
        </div>
        <div class="flex gap-1">
          <div class="flex-1 autocomplete-wrap">
            <input id="tag-input-${lt}" placeholder="${LINK_LABELS[lt] || lm.label || lt}..."
              class="w-full px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none"
              oninput="window._showSuggestions('${lt}')"
              onkeydown="window._handleTagKey(event,'${lt}')">
            <div id="tag-suggestions-${lt}" class="autocomplete-list"></div>
          </div>
          <button type="button" onclick="window._addTag('${lt}')"
            class="px-2 py-1 bg-room-elevated border border-room-border rounded text-ink-dim text-sm hover:text-ink-bright">+</button>
        </div>
      </div>
    `;
  }

  // Medestander-koppeling (alleen voor NPCs in DM-modus)
  if (tab === 'personages' && editId && e?.subtype?.toLowerCase() === 'npc' && isDM()) {
    body += `
      <div class="companion-link-section">
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">⚔ Medestander</label>
        <div id="companion-toggles" class="companion-toggles-row">
          <span class="text-ink-dim text-xs italic">Laden…</span>
        </div>
      </div>
    `;
  }

  // Buttons
  body += `
    <div class="flex gap-2 pt-2">
      <button type="submit" class="px-4 py-2 bg-gold-dim text-room-bg font-cinzel font-semibold rounded hover:bg-gold transition">
        \ud83d\udcbe
      </button>
      ${editId ? `
        <button type="button" onclick="window._deleteEntity('${tab}','${editId}')"
          class="px-4 py-2 bg-seal/20 text-seal rounded hover:bg-seal/40 transition">
          \ud83d\uddd1
        </button>
      ` : ''}
      <button type="button" onclick="window.app.closeModal()"
        class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition" title="Annuleren">✕</button>
    </div>
  </form>`;

  openModal(editId ? 'Bewerken' : 'Nieuw', TYPE_META[tab].label, body);

  // ── CS tab switcher ──
  window._csTab = (name) => {
    ['gevecht','acties','spreuken'].forEach(t => {
      const p = document.getElementById('cs-panel-' + t);
      if (p) p.style.display = t === name ? '' : 'none';
    });
    document.querySelectorAll('.cs-tab-btn').forEach(b => {
      b.classList.toggle('cs-tab-active', b.getAttribute('onclick').includes("'" + name + "'"));
    });
  };

  // ── Ctrl+S sneltoets ──
  if (window._lastEditorKeyFn) document.removeEventListener('keydown', window._lastEditorKeyFn);
  window._lastEditorKeyFn = (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's') {
      const form = document.getElementById('entity-form');
      if (!form) { document.removeEventListener('keydown', window._lastEditorKeyFn); return; }
      ev.preventDefault();
      form.requestSubmit();
    }
  };
  document.addEventListener('keydown', window._lastEditorKeyFn);

  // ── Medestander toggles ──
  if (tab === 'personages' && editId && e?.subtype?.toLowerCase() === 'npc' && isDM() && _editorGroups.length > 0) {
    const _renderCompanionToggles = (linked) => {
      const container = document.getElementById('companion-toggles');
      if (!container) return;
      container.innerHTML = _editorGroups.map(g => {
        const isLinked = linked.includes(g.id);
        return `<button type="button"
          class="companion-group-btn${isLinked ? ' companion-group-btn--linked' : ''}"
          onclick="window._toggleCompanion('${esc(editId)}','${esc(g.id)}',${isLinked})">
          ${isLinked ? '⚔' : '➕'} ${esc(g.name)}
        </button>`;
      }).join('');
    };
    api.getCompanionStatus(editId)
      .then(({ linked }) => _renderCompanionToggles(linked))
      .catch(() => {
        const c = document.getElementById('companion-toggles');
        if (c) c.innerHTML = '<span class="text-xs text-seal">Fout bij laden</span>';
      });
    window._toggleCompanion = async (npcId, groupId, currentlyLinked) => {
      if (currentlyLinked) await api.unlinkCompanion(npcId, groupId);
      else                  await api.linkCompanion(npcId, groupId);
      const { linked } = await api.getCompanionStatus(npcId);
      _renderCompanionToggles(linked);
    };
  }

  // ── Icon picker ──
  window._toggleIconPicker = () => {
    document.getElementById('icon-picker')?.classList.toggle('hidden');
  };
  window._selectIcon = (ic) => {
    const input = document.getElementById('icon-input');
    const preview = document.getElementById('icon-preview');
    if (input) input.value = ic;
    if (preview) preview.textContent = ic || getAutoIcon(tab, e || { data: {} });
    document.getElementById('icon-picker')?.classList.add('hidden');
  };

  // ── Extra images editor state ──
  entityEditorImagesToDelete = [];
  entityEditorImages = _parseExtraImages(e?.data?.extraImages).map(item => ({
    id: item.id,
    url: api.fileUrl(item.id),
    isNew: false,
    caption: item.caption || '',
  }));
  window._addEntityImages = (files) => {
    for (const file of files) {
      const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      entityEditorImages.push({ id, url: URL.createObjectURL(file), isNew: true, file, caption: '' });
    }
    _refreshEntityImages();
  };
  window._removeEntityImage = (idx) => {
    const img = entityEditorImages[idx];
    if (!img.isNew) entityEditorImagesToDelete.push(img.id);
    else URL.revokeObjectURL(img.url);
    entityEditorImages.splice(idx, 1);
    _refreshEntityImages();
  };
  window._updateEntityImageCaption = (idx, val) => {
    if (entityEditorImages[idx]) entityEditorImages[idx].caption = val;
  };
  setTimeout(() => _refreshEntityImages(), 0);

  // ── Voorraad editor state ──
  let _voorraadItems = [];
  if (tab === 'personages' || tab === 'locaties') {
    try { _voorraadItems = e?.data?.voorraad ? JSON.parse(e.data.voorraad) : []; } catch { _voorraadItems = []; }

    let _voorraadEntityOptions = []; // { id, name } — geladen uit voorwerpen
    // Async: laad voorwerpen voor koppeling + auto-link op naam
    if (isDM()) {
      api.listEntities('voorwerpen').then(items => {
        _voorraadEntityOptions = items.map(i => ({ id: i.id, name: i.name }));
        // Auto-link bestaande items op exacte naamovereenkomst
        let changed = false;
        _voorraadItems = _voorraadItems.map(item => {
          if (!item.entityId && item.naam) {
            const match = _voorraadEntityOptions.find(o => o.name.toLowerCase() === item.naam.toLowerCase());
            if (match) { changed = true; return { ...item, entityId: match.id }; }
          }
          return item;
        });
        const dl = document.getElementById('voorraad-entity-dl');
        if (dl) dl.innerHTML = _voorraadEntityOptions.map(o => `<option value="${esc(o.name)}">`).join('');
        if (changed) window._refreshVoorraad();
      }).catch(() => {});
    }

    window._refreshVoorraad = () => {
      const rows = document.getElementById('voorraad-rows');
      if (!rows) return;
      rows.innerHTML = _voorraadItems.length === 0
        ? `<p class="text-xs text-ink-faint italic">Nog geen items toegevoegd</p>`
        : _voorraadItems.map((item, idx) => {
          const linked = !!item.entityId;
          const entityDisplayName = item.entityId
            ? (_voorraadEntityOptions.find(o => o.id === item.entityId)?.name || item.naam || '')
            : '';
          return `
          <div class="flex gap-2 items-center flex-wrap">
            <input placeholder="Naam voorwerp" value="${esc(item.naam || '')}"
              oninput="window._updateVoorraadItem(${idx},'naam',this.value)"
              class="flex-1 min-w-24 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            <input placeholder="Prijs (bijv. 15 gp)" value="${esc(item.prijs || '')}"
              oninput="window._updateVoorraadItem(${idx},'prijs',this.value)"
              class="w-28 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">
            <div class="relative flex items-center gap-1">
              <input list="voorraad-entity-dl" placeholder="🔗 Koppel aan kaartje…"
                value="${esc(entityDisplayName)}"
                onchange="window._updateVoorraadEntityLink(${idx}, this.value)"
                title="Koppel aan een bestaand voorwerpkaartje"
                class="w-36 px-2 py-1 bg-room-bg border rounded text-sm focus:border-gold-dim focus:outline-none ${linked ? 'border-green-wax/60 text-green-wax' : 'border-room-border text-ink-dim'}">
              ${linked ? '<span class="text-green-wax text-xs" title="Gekoppeld">✓</span>' : ''}
            </div>
            <button type="button" onclick="window._removeVoorraadItem(${idx})"
              class="w-7 h-7 flex items-center justify-center rounded text-seal hover:bg-seal/20 text-lg leading-none transition">&times;</button>
          </div>`;
        }).join('') + `<datalist id="voorraad-entity-dl">${_voorraadEntityOptions.map(o => `<option value="${esc(o.name)}">`).join('')}</datalist>`;
    };
    window._addVoorraadItem = () => { _voorraadItems.push({ naam: '', prijs: '', entityId: '' }); window._refreshVoorraad(); };
    window._removeVoorraadItem = (idx) => { _voorraadItems.splice(idx, 1); window._refreshVoorraad(); };
    window._updateVoorraadItem = (idx, field, val) => { if (_voorraadItems[idx]) _voorraadItems[idx][field] = val; };
    window._updateVoorraadEntityLink = (idx, naam) => {
      if (!_voorraadItems[idx]) return;
      const match = _voorraadEntityOptions.find(o => o.name.toLowerCase() === naam.toLowerCase());
      _voorraadItems[idx].entityId = match?.id || '';
      // Re-render om het ✓ icoon en stijl bij te werken
      window._refreshVoorraad();
    };

    // Subtype-wissel (personages)
    window._onSubtypeChange = (val) => {
      const sec = document.getElementById('voorraad-section');
      if (sec) sec.style.display = val === 'verkoper' ? '' : 'none';
      const wcSec = document.getElementById('winkelconfig-section');
      if (wcSec) wcSec.style.display = val === 'verkoper' ? '' : 'none';
      const groepSec = document.getElementById('groep-section');
      if (groepSec) groepSec.style.display = val === 'speler' ? '' : 'none';
      const antagonistSec = document.getElementById('geheime-antagonist-section');
      if (antagonistSec) antagonistSec.style.display = val === 'NPC' ? '' : 'none';
    };

    // LocType-wissel (locaties)
    window._onLocTypeChange = (val) => {
      const sec = document.getElementById('voorraad-section');
      if (sec) sec.style.display = val === 'Winkel' ? '' : 'none';
      const wcSec = document.getElementById('winkelconfig-section');
      if (wcSec) wcSec.style.display = val === 'Winkel' ? '' : 'none';
    };

    // Inladen-paneel toggle
    window._voorraadInladenToggle = async () => {
      const panel = document.getElementById('voorraad-inladen-panel');
      const chevron = document.getElementById('voorraad-inladen-chevron');
      if (!panel) return;
      const open = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', open);
      if (chevron) chevron.textContent = open ? '▸' : '▾';
      if (!open) {
        // Vul de select met winkels/verkopers die voorraad hebben
        const sel = document.getElementById('voorraad-inladen-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— kies een winkel/verkoper —</option>';
        try {
          const [personages, locaties] = await Promise.all([
            api.listEntities('personages'),
            api.listEntities('locaties'),
          ]);
          const bronnen = [
            ...personages.filter(p => p.subtype === 'verkoper' && p.data?.voorraad && p.data.voorraad !== '[]'),
            ...locaties.filter(l => l.data?.locType === 'Winkel' && l.data?.voorraad && l.data.voorraad !== '[]'),
          ].filter(b => b.id !== (e?.id || null)); // eigen item niet aanbieden
          bronnen.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.dataset.type = b.subtype === 'verkoper' ? 'personages' : 'locaties';
            opt.textContent = b.name + (b.subtype === 'verkoper' ? ' (verkoper)' : ' (winkel)');
            sel.appendChild(opt);
          });
          if (bronnen.length === 0) sel.innerHTML = '<option value="">— geen winkels gevonden —</option>';
        } catch { sel.innerHTML = '<option value="">— fout bij laden —</option>'; }
      }
    };

    // Inladen: kopieer voorraad van geselecteerde bron
    window._voorraadInladen = async () => {
      const sel = document.getElementById('voorraad-inladen-select');
      if (!sel || !sel.value) return;
      const bronType = sel.options[sel.selectedIndex]?.dataset.type || 'personages';
      try {
        const bron = await api.getEntity(bronType, sel.value);
        const bronItems = bron?.data?.voorraad ? JSON.parse(bron.data.voorraad) : [];
        if (bronItems.length === 0) return;
        _voorraadItems = bronItems.map(i => ({ naam: i.naam || '', prijs: i.prijs || '' }));
        window._refreshVoorraad();
        // Sluit paneel
        document.getElementById('voorraad-inladen-panel')?.classList.add('hidden');
        const chevron = document.getElementById('voorraad-inladen-chevron');
        if (chevron) chevron.textContent = '▸';
      } catch { /* stil falen */ }
    };

    window._wcUpdate = () => {
      const roterend = document.getElementById('wc-roterend')?.checked || false;
      document.getElementById('wc-extra')?.classList.toggle('hidden', !roterend);
      const config = {
        roterend,
        aantalItems: parseInt(document.getElementById('wc-aantal')?.value) || 3,
        refreshUren: parseFloat(document.getElementById('wc-uren')?.value) || 24,
        deelGroep: (document.getElementById('wc-deelgroep')?.value || '').trim(),
        sfeerTekst: (document.getElementById('wc-sfeer')?.value || '').trim(),
        onderhandelDC: parseInt(document.getElementById('wc-onderhandel-dc')?.value) || 15,
        onderhandelKorting: parseInt(document.getElementById('wc-onderhandel-korting')?.value) || 10,
        onderhandelBoete: parseInt(document.getElementById('wc-onderhandel-boete')?.value) || 0,
      };
      const hidden = document.getElementById('winkelconfig-hidden');
      if (hidden) hidden.value = JSON.stringify(config);
    };

    window._refreshVoorraad();
  }

  // Form submit handler
  document.getElementById('entity-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.target);
    const data = {};
    const stats = {};
    for (const [key, val] of form.entries()) {
      if (key.startsWith('data_')) data[key.slice(5)] = val;
      else if (key.startsWith('stat_')) stats[key.slice(5)] = val;
    }
    // Voorraad serialiseren voor verkopers & winkels
    if (tab === 'personages' || tab === 'locaties') {
      const validItems = _voorraadItems.filter(i => i.naam || i.prijs);
      data.voorraad = validItems.length > 0 ? JSON.stringify(validItems) : '';
    }
    // Extra afbeeldingen serialiseren
    data.extraImages = entityEditorImages.length > 0
      ? JSON.stringify(entityEditorImages.map(i => ({ id: i.id, caption: i.caption || '' })))
      : '';
    const payload = {
      name: form.get('name'),
      subtype: form.get('subtype') || '',
      data,
      links: { ...editorTags },
      stats: tab === 'personages' ? stats : null,
    };
    // Duplicaatdetectie voor voorwerpen (unieke naam vereist)
    if (tab === 'voorwerpen') {
      try {
        const allVw = await api.listEntities('voorwerpen');
        const dup = allVw.find(i => i.id !== editId && i.name.toLowerCase() === (payload.name || '').toLowerCase());
        if (dup && !confirm(`Er bestaat al een voorwerp met de naam "${dup.name}". Toch opslaan?`)) return;
      } catch { /* ok — niet blokkeren bij API-fout */ }
    }
    try {
      if (editId) {
        await api.updateEntity(tab, editId, payload);
        if (pendingFile) await api.uploadFile(editId, pendingFile);
      } else {
        const created = await api.createEntity(tab, payload);
        if (pendingFile && created?.id) await api.uploadFile(created.id, pendingFile);
      }
      // Upload/verwijder audio
      if (pendingAudioFile && data.audioId) {
        await api.uploadFile(data.audioId, pendingAudioFile);
      }
      if (!data.audioId && _editorOldAudioId) {
        await api.deleteFile(_editorOldAudioId).catch(() => {});
      }
      // Upload nieuwe extra afbeeldingen
      for (const img of entityEditorImages) {
        if (img.isNew) await api.uploadFile(img.id, img.file);
      }
      // Verwijder verwijderde extra afbeeldingen
      for (const id of entityEditorImagesToDelete) {
        await api.deleteFile(id).catch(() => {});
      }
      document.removeEventListener('keydown', window._lastEditorKeyFn);
      closeModal();
      renderEntitySection(tab);
    } catch (err) {
      alert('Fout: ' + err.message);
    }
  });
};

window._addTag = (lt, name) => {
  const input = document.getElementById(`tag-input-${lt}`);
  const val = (name || input.value).trim();
  if (!val || editorTags[lt].includes(val)) return;
  editorTags[lt].push(val);
  input.value = '';
  window._hideSuggestions(lt);
  refreshTags(lt);
};

window._removeTag = (lt, name) => {
  editorTags[lt] = editorTags[lt].filter(n => n !== name);
  refreshTags(lt);
};

window._showSuggestions = (lt) => {
  const input = document.getElementById(`tag-input-${lt}`);
  const list = document.getElementById(`tag-suggestions-${lt}`);
  const q = input.value.trim().toLowerCase();
  const names = (allNames[lt] || []).filter(n =>
    !editorTags[lt].includes(n) && (!q || n.toLowerCase().includes(q))
  );
  if (names.length === 0) { list.classList.remove('open'); return; }
  list.innerHTML = names.map(n =>
    `<div class="autocomplete-item" data-name="${esc(n)}" onmousedown="window._addTag('${lt}',this.dataset.name)">${esc(n)}</div>`
  ).join('');
  list.classList.add('open');
};

window._hideSuggestions = (lt) => {
  const list = document.getElementById(`tag-suggestions-${lt}`);
  if (list) list.classList.remove('open');
};

window._handleTagKey = (ev, lt) => {
  if (ev.key === 'Enter') { ev.preventDefault(); window._addTag(lt); }
  if (ev.key === 'Escape') { window._hideSuggestions(lt); }
};

// Close suggestions on blur (slight delay so mousedown on item fires first)
document.addEventListener('focusout', (ev) => {
  if (ev.target.id?.startsWith('tag-input-')) {
    const lt = ev.target.id.replace('tag-input-', '');
    setTimeout(() => window._hideSuggestions(lt), 150);
  }
});

function refreshTags(lt) {
  const lm = TYPE_META[lt] || { icon: '\ud83d\udcdc', chip: 'chip-doc' };
  const container = document.getElementById(`tags-${lt}`);
  if (!container) return;
  container.innerHTML = editorTags[lt].map(n =>
    `<span class="chip ${lm.chip}">${esc(n)} <span class="cursor-pointer ml-1" data-name="${esc(n)}" onclick="window._removeTag('${lt}',this.dataset.name)">\u00d7</span></span>`
  ).join('');
}

// ── Delete ──
window._deleteEntity = async (tab, id) => {
  if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
  await api.deleteEntity(tab, id);
  document.removeEventListener('keydown', window._lastEditorKeyFn);
  window.app.closeModal();
  renderEntitySection(tab);
};
