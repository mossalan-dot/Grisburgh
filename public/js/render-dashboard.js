import { api } from './api.js';

const ENTITY_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const TYPE_META = {
  personages:    { icon: '\ud83d\udc64', label: 'Personages', chip: 'chip-npc', linkCls: 'text-[#6abd83] bg-green-wax/15' },
  locaties:      { icon: '\ud83c\udff0', label: 'Locaties', chip: 'chip-loc', linkCls: 'text-[#7ab0d4] bg-blue-ink/15' },
  organisaties:  { icon: '\u2694', label: 'Organisaties', chip: 'chip-org', linkCls: 'text-[#d46a6a] bg-seal/15' },
  voorwerpen:    { icon: '\ud83c\udf92', label: 'Voorwerpen', chip: 'chip-item', linkCls: 'text-[#d4a06a] bg-orange/15' },
};

let activePanel = 'personages';
let allData = {};
let searchQuery = '';
let filterTag = '';

// Lazy proxies — window.app isn't set yet when ES modules evaluate
const $ = (...a) => window.app.$(...a);
const esc = (...a) => window.app.esc(...a);
const openModal = (...a) => window.app.openModal(...a);

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

export function initDashboard() {}

export async function renderDashboard() {
  const container = $('#section-dashboard');

  // Fetch all entity types
  for (const type of ENTITY_TYPES) {
    try { allData[type] = await api.listEntities(type); } catch { allData[type] = []; }
  }

  const list = filterList(allData[activePanel] || []);

  // Collect filter tags
  const tags = collectTags(allData[activePanel] || []);

  container.innerHTML = `
    <!-- Panel tabs -->
    <div class="flex gap-1 px-6 py-2 border-b border-room-border bg-room-surface/50 flex-wrap">
      ${ENTITY_TYPES.map(t => `
        <button class="panel-tab px-3 py-1.5 text-xs font-cinzel font-semibold rounded-t transition
          ${t === activePanel ? 'text-gold border-b-2 border-gold bg-room-elevated' : 'text-ink-dim hover:text-ink-medium'}"
          data-panel="${t}">
          ${TYPE_META[t].icon} ${TYPE_META[t].label}
          <span class="ml-1 text-[10px] font-mono opacity-60">${(allData[t] || []).length}</span>
        </button>
      `).join('')}
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-3 px-6 py-3 bg-room-surface/30 flex-wrap">
      <div class="relative flex-1 max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">\u2315</span>
        <input type="text" class="search-input w-full pl-9 pr-3 py-2 bg-room-bg border border-room-border rounded text-ink-bright text-sm font-crimson focus:border-gold-dim focus:outline-none"
          placeholder="Zoek..." value="${esc(searchQuery)}" oninput="window._dashSearch(this.value)">
      </div>
      <span class="text-ink-faint text-xs font-mono">${list.length} resultaten</span>
      ${tags.length ? `
        <div class="flex gap-1 flex-wrap">
          ${tags.map(t => `
            <button class="px-2 py-0.5 text-[11px] rounded-full font-mono transition
              ${filterTag === t ? 'bg-gold-dim text-room-bg' : 'bg-room-elevated text-ink-dim hover:text-ink-medium border border-room-border'}"
              onclick="window._dashFilter('${esc(t)}')">${esc(t)}</button>
          `).join('')}
          ${filterTag ? `<button class="px-2 py-0.5 text-[11px] text-ink-faint hover:text-ink-medium" onclick="window._dashFilter('')">\u00d7</button>` : ''}
        </div>
      ` : ''}
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-6 overflow-y-auto flex-1">
      ${list.length === 0 ? `
        <div class="col-span-full text-center py-16 text-ink-faint">
          <div class="text-4xl mb-3">${TYPE_META[activePanel].icon}</div>
          <div class="font-fell italic">Niets gevonden</div>
        </div>
      ` : list.map(e => renderDashCard(e)).join('')}
    </div>
  `;

  requestAnimationFrame(() => container.querySelectorAll('[data-fittext]').forEach(_fitText));

  container.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activePanel = btn.dataset.panel;
      searchQuery = '';
      filterTag = '';
      renderDashboard();
    });
  });

  window._dashSearch = (q) => { searchQuery = q; renderDashboard(); };
  window._dashFilter = (t) => { filterTag = filterTag === t ? '' : t; renderDashboard(); };
}

function collectTags(list) {
  const tags = new Set();
  for (const e of list) {
    if (e.subtype) tags.add(e.subtype);
    const d = e.data || {};
    if (d.locType) tags.add(d.locType);
    if (d.orgType) tags.add(d.orgType);
    if (d.itemType) tags.add(d.itemType);
    if (d.ras) tags.add(d.ras);
  }
  return [...tags].sort();
}

function filterList(list) {
  let result = list;
  if (filterTag) {
    result = result.filter(e => {
      return e.subtype === filterTag ||
        e.data?.locType === filterTag ||
        e.data?.orgType === filterTag ||
        e.data?.itemType === filterTag ||
        e.data?.ras === filterTag;
    });
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(e => {
      const fields = [e.name, e.subtype, ...Object.values(e.data || {})].join(' ').toLowerCase();
      return fields.includes(q);
    });
  }
  return result.slice().sort((a, b) => _sortKey(a.name).localeCompare(_sortKey(b.name), 'nl', { sensitivity: 'base' }));
}

function renderDashCard(e) {
  const meta = TYPE_META[activePanel];
  const d = e.data || {};
  const metaText = [e.subtype, d.rol, d.locType, d.orgType, d.itemType].filter(Boolean).join(' \u00b7 ');
  const desc = d.desc || '';

  // Links
  const links = [];
  for (const [lt, names] of Object.entries(e.links || {})) {
    const lm = TYPE_META[lt];
    if (!lm) continue;
    for (const n of names.slice(0, 3)) {
      links.push(`<span class="chip ${lm.chip}">${lm.icon} ${esc(n)}</span>`);
    }
  }

  return `
    <div class="bg-room-surface border border-room-border rounded-lg cursor-pointer hover:-translate-y-0.5 hover:shadow-deep hover:border-room-border-light transition"
      onclick="window._openDashDetail('${activePanel}','${e.id}')">
      <img class="w-full h-28 object-cover rounded-t-lg" src="${api.fileUrl(e.id)}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="h-1 bar-${activePanel} rounded-t-lg" style="display:none"></div>
      <div class="p-4">
        <div class="flex items-start gap-3 mb-2">
          <div class="text-2xl">${e.icon || meta.icon}</div>
          <div class="min-w-0">
            <div class="font-cinzel font-bold text-ink-bright" data-fittext>${esc(e.name)}</div>
            ${metaText ? `<div class="text-xs text-ink-dim italic">${esc(metaText)}</div>` : ''}
          </div>
        </div>
        ${desc ? `<p class="text-sm text-ink-medium line-clamp-3 mb-2">${esc(desc)}</p>` : ''}
        ${links.length ? `<div class="flex flex-wrap gap-1">${links.join('')}</div>` : ''}
      </div>
    </div>
  `;
}

// ── Dashboard detail (read-only) ──
window._openDashDetail = async (panel, id) => {
  let e;
  try { e = await api.getEntity(panel, id); } catch { return; }

  let body = '';

  // Image
  body += `<div class="mb-4"><img src="${api.fileUrl(e.id)}" class="w-full max-h-64 object-contain rounded" onerror="this.parentElement.style.display='none'"></div>`;


  // Description and fields
  const d = e.data || {};
  if (d.desc) body += `<p class="text-sm whitespace-pre-wrap mb-3">${esc(d.desc)}</p>`;
  for (const [key, val] of Object.entries(d)) {
    if (key === 'desc' || key === 'geheim' || !val) continue;
    body += `<div class="mb-2"><span class="text-xs font-cinzel text-ink-dim uppercase">${key}:</span> <span class="text-sm">${esc(val)}</span></div>`;
  }

  // Links
  for (const [lt, names] of Object.entries(e.links || {})) {
    if (!names.length) continue;
    const lm = TYPE_META[lt] || { icon: '\ud83d\udcdc', chip: 'chip-doc' };
    body += `
      <div class="mb-3">
        <div class="text-xs font-cinzel text-ink-dim uppercase mb-1">${lm.label || lt}</div>
        <div class="flex flex-wrap gap-1">${names.map(n => `<span class="chip ${lm.chip}">${lm.icon} ${esc(n)}</span>`).join('')}</div>
      </div>
    `;
  }

  openModal(e.name, [e.subtype, TYPE_META[panel]?.label].filter(Boolean).join(' \u2014 '), body);
};
