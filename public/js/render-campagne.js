import { api } from './api.js';

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const TYPE_META = {
  personages:    { icon: '\ud83d\udc64', label: 'Personages', color: 'green-wax', chip: 'chip-npc' },
  locaties:      { icon: '\ud83c\udff0', label: 'Locaties', color: 'blue-ink', chip: 'chip-loc' },
  organisaties:  { icon: '\ud83c\udfdb\ufe0f', label: 'Organisaties', color: 'seal', chip: 'chip-org' },
  voorwerpen:    { icon: '\ud83c\udf92', label: 'Voorwerpen', color: 'orange', chip: 'chip-item' },
};

const SCHEMA = {
  personages: {
    subtypes: ['NPC', 'speler', 'antagonist', 'god', 'dier'],
    fields: [
      { key: 'rol', label: 'Rol', type: 'text' },
      { key: 'ras', label: 'Ras', type: 'text' },
      { key: 'klasse', label: 'Klasse', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'persoonlijkheid', label: 'Persoonlijkheid', type: 'textarea', dmOnly: true },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
      { key: 'geheim', label: 'Geheim (DM)', type: 'textarea' },
    ],
  },
  locaties: {
    fields: [
      { key: 'locType', label: 'Type', type: 'select', options: ['Stadswijk','Gebouw','Herberg','Taveerne','Tempel','Winkel','Fort','Schip','Dorp','Stad','Woud','Zee','Overig'] },
      { key: 'wijk', label: 'Wijk', type: 'text' },
      { key: 'eigenaar', label: 'Eigenaar', type: 'text' },
      { key: 'desc', label: 'Beschrijving', type: 'textarea' },
      { key: 'flavour', label: 'Flavour tekst', type: 'textarea' },
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
      { key: 'itemType', label: 'Type', type: 'select', options: ['Wapen','Toveritem','Drank','Uitrusting','Scroll','Ring','Amulet','Overig'] },
      { key: 'rariteit', label: 'Rariteit', type: 'select', options: ['Gewoon','Ongewoon','Zeldzaam','Zeer zeldzaam','Legendarisch'] },
      { key: 'prijs', label: 'Prijs', type: 'text' },
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
    'god':    '\u2728',
    'dier':   '\ud83d\udc3e',
  },
  locaties: {
    'Stadswijk':  '\ud83c\udfe0',
    'Gebouw':     '\ud83c\udfd7',
    'Herberg':    '\ud83c\udf7a',
    'Taveerne':   '\ud83c\udf7b',
    'Tempel':     '\u26ea',
    'Winkel':     '\ud83d\uded2',
    'Fort':       '\ud83c\udff0',
    'Schip':      '\u26f5',
    'Dorp':       '\ud83c\udfe1',
    'Stad':       '\ud83c\udfd9',
    'Woud':       '\ud83c\udf32',
    'Zee':        '\ud83c\udf0a',
    'Overig':     '\ud83d\udccd',
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
    'Wapen':      '\u2694\ufe0f',
    'Toveritem':  '\ud83d\udd2e',
    'Drank':      '\ud83e\uddea',
    'Uitrusting': '\ud83d\udee1\ufe0f',
    'Scroll':     '\ud83d\udcdc',
    'Ring':       '\ud83d\udc8d',
    'Amulet':     '\ud83d\udde1\ufe0f',
    'Overig':     '\ud83d\udc8e',
  },
};

function getAutoIcon(type, e) {
  const map = AUTO_ICONS[type] || {};
  const key =
    e.subtype ||
    e.data?.locType ||
    e.data?.orgType ||
    e.data?.itemType ||
    '';
  return map[key] || TYPE_META[type].icon;
}

const searchQueries = { personages: '', locaties: '', organisaties: '', voorwerpen: '' };
let entities = {};
let editorTags = {};
let pendingFile = null;

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const $$ = (...a) => window.app.$$(...a);
const isDM = () => window.app.isDM();
const esc = (...a) => window.app.esc(...a);
const mdToHtml = (...a) => window.app.mdToHtml(...a);
const openModal = (...a) => window.app.openModal(...a);
const closeModal = (...a) => window.app.closeModal(...a);
const openLightbox = (...a) => window.app.openLightbox(...a);

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

async function renderEntitySection(type) {
  const container = $(`#section-${type}`);

  try {
    entities[type] = await api.listEntities(type);
  } catch (e) {
    entities[type] = [];
  }

  const list = filterEntities(type, entities[type] || []);

  // Only build the full toolbar+grid on first render; on subsequent calls just refresh the grid
  const existingGrid = container.querySelector('.cards-grid');
  if (existingGrid) {
    _refreshGrid(type, list, container);
    return;
  }

  container.innerHTML = `
    <!-- Toolbar -->
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">\u2315</span>
        <input type="text" class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Zoek..." value="${esc(searchQueries[type])}" oninput="window._entitySearch('${type}',this.value)">
      </div>
      <span class="results-count text-ink-faint text-xs font-mono">${list.length} resultaten</span>
    </div>

    <!-- Card grid -->
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-6 overflow-y-auto flex-1">
    </div>
  `;

  _refreshGrid(type, list, container);

  window._entitySearch = (t, q) => {
    searchQueries[t] = q;
    const filtered = filterEntities(t, entities[t] || []);
    const c = $(`#section-${t}`);
    _refreshGrid(t, filtered, c);
    const countEl = c.querySelector('.results-count');
    if (countEl) countEl.textContent = `${filtered.length} resultaten`;
  };
}

function _refreshGrid(type, list, container) {
  const grid = container.querySelector('.cards-grid');
  if (!grid) return;
  grid.innerHTML = list.length === 0 ? `
    <div class="col-span-full text-center py-16 text-ink-faint">
      <div class="text-4xl mb-3">${TYPE_META[type].icon}</div>
      <div class="font-fell italic">Geen ${TYPE_META[type].label.toLowerCase()} gevonden</div>
    </div>
  ` : list.map(e => renderCard(type, e)).join('');
  const countEl = container.querySelector('.results-count');
  if (countEl) countEl.textContent = `${list.length} resultaten`;
}

export async function renderPersonages() { return renderEntitySection('personages'); }
export async function renderLocaties() { return renderEntitySection('locaties'); }
export async function renderOrganisaties() { return renderEntitySection('organisaties'); }
export async function renderVoorwerpen() { return renderEntitySection('voorwerpen'); }

function filterEntities(type, list) {
  const q = searchQueries[type];
  if (!q) return list;
  const ql = q.toLowerCase();
  return list.filter(e => {
    const fields = [e.name, e.subtype, ...Object.values(e.data || {})].join(' ').toLowerCase();
    const links = Object.values(e.links || {}).flat().join(' ').toLowerCase();
    return fields.includes(ql) || links.includes(ql);
  });
}

function renderCard(type, e) {
  const vis = e._visibility || 'visible';
  const rol     = e.data?.rol || '';
  const metaText = [e.data?.locType, e.data?.orgType, e.data?.itemType, e.data?.ras, e.data?.klasse].filter(Boolean).join(' \u00b7 ');
  const desc = e.data?.desc || '';
  const flavour = e.data?.flavour || '';

  const chips = [];
  if (e.links) {
    (e.links.personages || []).slice(0, 2).forEach(n => chips.push(`<span class="chip chip-npc" onclick="event.stopPropagation();window._navigateTo('personages','${esc(n)}')">\ud83d\udc64 ${esc(n)}</span>`));
    (e.links.locaties || []).slice(0, 2).forEach(n => chips.push(`<span class="chip chip-loc" onclick="event.stopPropagation();window._navigateTo('locaties','${esc(n)}')">\ud83c\udff0 ${esc(n)}</span>`));
    (e.links.organisaties || []).slice(0, 1).forEach(n => chips.push(`<span class="chip chip-org" onclick="event.stopPropagation();window._navigateTo('organisaties','${esc(n)}')">\u2694 ${esc(n)}</span>`));
  }

  return `
    <div class="entity-card${vis === 'hidden' && isDM() ? ' card-hidden' : ''}"
      onclick="window._openDetail('${type}','${e.id}')">
      ${isDM() ? `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="w-6 h-6 flex items-center justify-center rounded bg-black/40 hover:bg-black/65 backdrop-blur-sm transition text-xs"
            onclick="event.stopPropagation();window._toggleVis('${type}','${e.id}')"
            title="${vis === 'visible' ? 'Verbergen' : 'Zichtbaar maken'}">
            ${vis === 'visible' ? '\ud83d\udc41' : '\ud83d\udd12'}
          </button>
          <button class="w-6 h-6 flex items-center justify-center rounded ${e._deceased ? 'bg-red-800/80' : 'bg-black/40'} hover:bg-red-700/70 backdrop-blur-sm transition text-xs"
            onclick="event.stopPropagation();window._toggleDeceased('${type}','${e.id}')"
            title="${e._deceased ? 'Herstel (niet meer deceased)' : 'Markeer als deceased'}">&#9760;</button>
          <button class="w-6 h-6 flex items-center justify-center rounded bg-black/40 hover:bg-black/65 backdrop-blur-sm transition text-xs"
            onclick="event.stopPropagation();window._openEditor('${type}','${e.id}')"
            title="Bewerken">&#9998;</button>
          <button class="w-6 h-6 flex items-center justify-center rounded bg-black/40 hover:bg-seal/70 backdrop-blur-sm transition text-xs text-white"
            onclick="event.stopPropagation();window._deleteEntity('${type}','${e.id}')"
            title="Verwijderen">&#10005;</button>
        </div>
      ` : ''}
      ${e._deceased ? `
        <div class="absolute inset-0 z-20 pointer-events-none rounded overflow-hidden">
          <div class="absolute inset-0 bg-red-950/30"></div>
          <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="4" y1="4" x2="96" y2="96" stroke="#dc2626" stroke-width="5" stroke-linecap="round" stroke-opacity="0.88"/>
            <line x1="96" y1="4" x2="4" y2="96" stroke="#dc2626" stroke-width="5" stroke-linecap="round" stroke-opacity="0.88"/>
          </svg>
        </div>
      ` : ''}
      <div class="card-accent bar-${type}"></div>
      <img class="card-img w-full object-cover" src="${api.fileUrl(e.id)}"
        style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
        onerror="this.style.display='none'">
      <div class="card-body px-4 pt-3 pb-3">
        <div class="flex items-start gap-2.5 mb-2">
          <div class="card-icon">${getAutoIcon(type, e)}</div>
          <div class="min-w-0 flex-1">
            <div class="font-cinzel font-bold text-ink-bright text-sm leading-tight truncate">${esc(e.name)}</div>
            ${rol      ? `<div class="text-[11px] text-ink-medium italic mt-0.5 truncate">${esc(rol)}</div>` : ''}
            ${metaText ? `<div class="text-[11px] text-ink-dim mt-0.5 truncate">${esc(metaText)}</div>` : ''}
          </div>
        </div>
        ${desc ? `<p class="text-xs text-ink-medium line-clamp-2 mb-2 font-crimson leading-relaxed">${mdToHtml(desc)}</p>` : ''}
        ${chips.length ? `<div class="flex flex-wrap gap-1">${chips.join('')}</div>` : ''}
      </div>
      ${flavour ? `
        <div class="flavour-preview">
          <span class="flavour-preview-text">\u201e${esc(flavour.length > 90 ? flavour.slice(0, 90) + '\u2026' : flavour)}\u201c</span>
        </div>
      ` : ''}
    </div>
  `;
}

// ── Detail view ──
window._openDetail = async (tab, id) => {
  let e;
  try { e = await api.getEntity(tab, id); } catch { return; }
  const meta = TYPE_META[tab];
  const schema = SCHEMA[tab];
  const vis = e._visibility || 'visible';
  const isPersonage = tab === 'personages';
  const showSheet = isPersonage && isDM();
  const fileUrl = api.fileUrl(e.id);

  // ── Tab: Info ──
  let infoHtml = '';

  // Image — portrait frame (visible to all)
  infoHtml += `
    <div class="mb-4" id="detail-img-wrap-${e.id}">
      <img src="${fileUrl}" class="detail-portrait w-full max-h-80 object-cover cursor-pointer"
        style="${e.data?.imgFocus ? `object-position:${e.data.imgFocus}` : ''}"
        onclick="window.app.openLightbox('${fileUrl}','${esc(e.name)}')"
        onerror="this.closest('#detail-img-wrap-${e.id}').style.display='none'">
    </div>
  `;

  // Upload zone (DM only)
  if (isDM()) {
    infoHtml += `
      <div class="dm-only mb-4">
        <div class="upload-zone" onclick="document.getElementById('file-upload-${e.id}').click()">
          \ud83d\udcf7 Afbeelding of PDF uploaden (max 10MB)
        </div>
        <input type="file" id="file-upload-${e.id}" accept="image/*,.pdf,application/pdf" class="hidden"
          onchange="window._uploadFile('${tab}','${e.id}',this.files[0])">
      </div>
    `;
  }

  // Schema fields (excl. geheim + dmOnly + flavour — rendered separately)
  for (const field of (schema.fields || [])) {
    if (field.key === 'geheim') continue;
    if (field.key === 'flavour') continue;
    if (field.key === 'rol') continue;
    if (field.dmOnly) continue;
    const val = e.data?.[field.key];
    if (!val) continue;
    if (field.key === 'desc') {
      infoHtml += `<div class="detail-desc mb-4">${mdToHtml(val)}</div>`;
    } else {
      infoHtml += `
        <div class="detail-field mb-3">
          <div class="detail-field-label">${esc(field.label)}</div>
          <div class="detail-field-value">${field.type === 'textarea' ? mdToHtml(val) : esc(val)}</div>
        </div>
      `;
    }
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

  // Flavour scroll (parchment scroll — visible to all)
  const flavourVal = e.data?.flavour;
  if (flavourVal) {
    infoHtml += `
      <div class="flavour-scroll">
        <div class="flavour-scroll-rod"></div>
        <div class="flavour-scroll-content">
          <p class="flavour-text">\u201e${esc(flavourVal)}\u201c</p>
        </div>
        <div class="flavour-scroll-rod"></div>
      </div>
    `;
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
    infoHtml += `
      <div class="dm-only mt-4 pt-4 border-t border-room-border">
        <div class="flex flex-wrap gap-2 mb-3">
          <button class="px-3 py-1 text-sm rounded ${vis === 'visible' ? 'bg-green-wax text-white' : 'bg-room-elevated text-ink-dim'}"
            onclick="window._toggleVis('${tab}','${e.id}')">
            ${vis === 'visible' ? '\ud83d\udc41' : '\ud83d\udd12'}
          </button>
          ${isPersonage ? `
            <button class="px-3 py-1 text-sm rounded ${e._secretReveal ? 'bg-seal text-white' : 'bg-room-elevated text-ink-dim'}"
              onclick="window._toggleSecret('${tab}','${e.id}')">
              ${e._secretReveal ? '\u2728' : '\ud83d\udd12'}
            </button>
          ` : ''}
          <button class="px-3 py-1 text-sm rounded ${e._deceased ? 'bg-red-800 text-white' : 'bg-room-elevated text-ink-dim'}"
            onclick="window._toggleDeceased('${tab}','${e.id}')"
            title="${e._deceased ? 'Herstel' : 'Markeer als deceased'}">
            &#9760;
          </button>
          <button class="px-3 py-1 text-sm rounded bg-gold-dim text-room-bg font-semibold"
            onclick="window._openEditor('${tab}','${e.id}')">
            \u270f
          </button>
        </div>
        <div class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider mb-1">DM Notities</div>
        <textarea id="dm-note-${e.id}" class="w-full min-h-[80px] px-3 py-2 bg-room-bg border border-room-border rounded text-sm text-ink-bright font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Notities...">${esc(e._dmNote || '')}</textarea>
        <div id="note-save-${e.id}" class="text-xs text-green-wax opacity-0 transition-opacity mt-1"></div>
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
        `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">${label}</div><div class="text-sm text-ink-medium whitespace-pre-wrap">${esc(s[k])}</div></div>`
      ).join('');

      // Spells
      const _spells = [
        s.cantrips ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">Cantrips</div><div class="text-sm text-ink-medium whitespace-pre-wrap">${esc(s.cantrips)}</div></div>` : '',
        s.spells ? `<div class="mt-3 border-t border-room-border pt-3"><div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider mb-1">Spells</div><div class="text-sm text-ink-medium whitespace-pre-wrap">${esc(s.spells)}</div></div>` : '',
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
          ${s.extra ? `<div class="mt-3 border-t border-room-border pt-3 text-sm text-ink-medium whitespace-pre-wrap">${esc(s.extra)}</div>` : ''}
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
          ${names.map(n => `<span class="chip ${lm.chip} cursor-pointer" onclick="window._navigateTo('${lt}','${esc(n)}')">${lm.icon} ${esc(n)}</span>`).join('')}
        </div>
      </div>
    `;
  }
  if (!verbHtml) {
    verbHtml = `<div class="text-center py-10 text-ink-faint font-fell italic">Geen verbindingen</div>`;
  }

  // ── Build tabbed modal body ──
  const detailTabs = showSheet
    ? [{ key: 'info', label: 'Info' }, { key: 'sheet', label: 'Character Sheet' }, { key: 'verbindingen', label: 'Verbindingen' }]
    : [{ key: 'info', label: 'Info' }, { key: 'verbindingen', label: 'Verbindingen' }];

  const tabNav = detailTabs.map((t, i) => `
    <button class="detail-tab px-4 py-2 text-xs font-cinzel font-semibold transition rounded-t
      ${i === 0 ? 'text-gold border-b-2 border-gold' : 'text-ink-dim hover:text-ink-medium'}"
      data-dtab="${t.key}">${t.label}</button>
  `).join('');

  const body = `
    <div class="flex gap-0.5 border-b border-room-border mb-4">${tabNav}</div>
    <div id="dtab-info">${infoHtml}</div>
    ${showSheet ? `<div id="dtab-sheet" class="hidden">${sheetHtml}</div>` : ''}
    <div id="dtab-verbindingen" class="hidden">${verbHtml}</div>
  `;

  openModal(e.name, e.data?.rol || meta.label, body);

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
};

// ── Visibility / Secret / Deceased toggles ──
window._toggleVis = async (tab, id) => {
  await api.toggleVisibility(tab, id);
  renderEntitySection(tab);
};

window._toggleSecret = async (tab, id) => {
  await api.toggleSecret(tab, id);
  window._openDetail(tab, id);
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
  const ch = document.getElementById('fp-crosshair');
  if (ch) { ch.style.left = x + '%'; ch.style.top = y + '%'; }
}

// ── File upload ──
window._editorFileSelected = (file) => {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Max 10MB'); return; }
  pendingFile = file;
  const label = document.getElementById('editor-file-name');
  if (label) { label.textContent = file.name; label.classList.remove('hidden'); }
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
  closeModal();
  window.app.switchSection(tab);
  try {
    const entities = await api.listEntities(tab);
    const entity = entities.find(e => e.name === name);
    if (entity) {
      window._openDetail(tab, entity.id);
    } else {
      searchQueries[tab] = name;
      renderEntitySection(tab);
    }
  } catch {
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

  editorTags = {};
  pendingFile = null;
  for (const lt of LINK_TYPES) {
    editorTags[lt] = e?.links?.[lt]?.slice() || [];
  }

  let body = `<form id="entity-form" class="space-y-4">`;

  // Name
  body += `
    <div>
      <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Naam</label>
      <input name="name" value="${esc(e?.name || '')}" required
        class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
    </div>
  `;

  // Image upload + focal point picker
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
            <p class="text-[10px] text-ink-dim mb-2">Klik of sleep om het focuspunt in te stellen</p>
            <input type="hidden" name="data_imgFocus" id="fp-input" value="${focusVal}">
          ` : ''}
          <div class="upload-zone" onclick="document.getElementById('editor-file-input').click()">
            \ud83d\udcf7 Afbeelding of PDF uploaden (max 10MB)
          </div>
          <div id="editor-file-name" class="text-xs text-ink-dim mt-1 hidden"></div>
          <input type="file" id="editor-file-input" accept="image/*,.pdf,application/pdf" class="hidden"
            onchange="window._editorFileSelected(this.files[0])">
        </div>
      </div>
    `;
  }

  // Subtype
  if (schema.subtypes) {
    body += `
      <div>
        <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">Subtype</label>
        <select name="subtype" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
          <option value="">—</option>
          ${schema.subtypes.map(s => `<option value="${s}" ${e?.subtype === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }


  // Schema fields
  for (const field of schema.fields) {
    const val = e?.data?.[field.key] || '';
    if ((field.key === 'geheim' || field.dmOnly) && !isDM()) continue;
    if (field.type === 'textarea') {
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
    } else if (field.type === 'select') {
      body += `
        <div>
          <label class="text-xs font-cinzel text-ink-dim font-bold uppercase tracking-wider">${esc(field.label)}</label>
          <select name="data_${field.key}" class="w-full mt-1 px-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright focus:border-gold-dim focus:outline-none">
            <option value="">—</option>
            ${field.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
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

  // Stats (personages)
  if (tab === 'personages') {
    const s = e?.stats || {};
    const _si = (k, label, center = false) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <input name="stat_${k}" value="${esc(s[k] || '')}"
          class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none${center ? ' text-center' : ''}">
      </div>`;
    const _ta = (k, label, rows = 3) => `
      <div>
        <label class="text-[10px] font-cinzel text-ink-dim uppercase">${label}</label>
        <textarea name="stat_${k}" rows="${rows}"
          class="w-full mt-0.5 px-2 py-1 bg-room-bg border border-room-border rounded text-ink-bright text-sm focus:border-gold-dim focus:outline-none">${esc(s[k] || '')}</textarea>
      </div>`;
    body += `
      <div class="p-4 bg-room-elevated rounded border border-room-border space-y-3">
        <div class="text-xs font-cinzel text-gold-dim font-bold uppercase tracking-wider">Character Sheet</div>

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Gevecht</div>
        <div class="grid grid-cols-3 gap-2">
          ${_si('ac','AC',true)}${_si('hp','HP',true)}${_si('speed','Speed',true)}
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${_si('cr','Challenge Rating',true)}${_si('profBonus','Prof. Bonus',true)}
        </div>

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Eigenschappen</div>
        <div class="grid grid-cols-3 gap-2">
          ${['str','dex','con','int','wis','cha'].map(k => _si(k, k.toUpperCase(), true)).join('')}
        </div>

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Proficiencies & Verdedigingen</div>
        ${_si('savingThrows','Saving Throws')}
        ${_si('skills','Skills')}
        ${_si('resistances','Damage Resistances')}
        ${_si('immunities','Damage Immunities')}
        ${_si('conditionImmunities','Condition Immunities')}

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Zintuigen & Talen</div>
        ${_si('senses','Senses')}
        ${_si('languages','Languages')}

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Traits & Acties</div>
        ${_ta('traits','Traits', 3)}
        ${_ta('actions','Actions', 4)}
        ${_ta('bonusActions','Bonus Actions', 2)}
        ${_ta('reactions','Reactions', 2)}
        ${_ta('legendaryActions','Legendary Actions', 3)}

        <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider">Spreuken</div>
        ${_si('cantrips','Cantrips')}
        ${_ta('spells','Spells', 3)}

        ${s.extra ? `
          <div class="border-t border-room-border pt-3">
            <div class="text-[10px] font-cinzel text-ink-dim uppercase tracking-wider mb-1">Extra (legacy)</div>
            ${_ta('extra','', 2)}
          </div>
        ` : ''}
      </div>
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
            <span class="chip ${lm.chip}">${esc(n)} <span class="cursor-pointer ml-1" onclick="window._removeTag('${lt}','${esc(n)}')">\u00d7</span></span>
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
        class="px-4 py-2 bg-room-elevated text-ink-dim rounded hover:text-ink-bright transition">Annuleren</button>
    </div>
  </form>`;

  openModal(editId ? 'Bewerken' : 'Nieuw', TYPE_META[tab].label, body);

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
    const payload = {
      name: form.get('name'),
      subtype: form.get('subtype') || '',
      data,
      links: { ...editorTags },
      stats: tab === 'personages' ? stats : null,
    };
    try {
      if (editId) {
        await api.updateEntity(tab, editId, payload);
        if (pendingFile) await api.uploadFile(editId, pendingFile);
      } else {
        const created = await api.createEntity(tab, payload);
        if (pendingFile && created?.id) await api.uploadFile(created.id, pendingFile);
      }
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
    `<div class="autocomplete-item" onmousedown="window._addTag('${lt}','${esc(n)}')">${esc(n)}</div>`
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
    `<span class="chip ${lm.chip}">${esc(n)} <span class="cursor-pointer ml-1" onclick="window._removeTag('${lt}','${esc(n)}')">\u00d7</span></span>`
  ).join('');
}

// ── Delete ──
window._deleteEntity = async (tab, id) => {
  if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
  await api.deleteEntity(tab, id);
  window.app.closeModal();
  renderEntitySection(tab);
};
