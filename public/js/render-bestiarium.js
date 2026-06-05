/**
 * render-bestiarium.js — spelers-Bestiarium (feature #3).
 * Toont monsters op het kennisniveau van de groep, via de gedeelde renderStatblock.
 * De DM ziet alles + kan per monster het kennisniveau van de actieve groep zetten.
 */

import { api } from './api.js?v=224';
import { renderStatblock } from './render-statblock.js?v=1';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();

let _container = null;
let _data = { role: 'player', monsters: [] };

const _NIV = [
  { v: '',         label: 'Onbekend' },
  { v: 'naam',     label: 'Naam' },
  { v: 'deels',    label: 'Deels' },
  { v: 'volledig', label: 'Volledig' },
];
const _NIV_BADGE = { naam: 'Naam', deels: 'Deels', volledig: 'Volledig' };

export async function renderBestiarium(container) {
  _container = container || document.getElementById('section-bestiarium');
  if (!_container) return;
  _container.innerHTML = `<div class="best-wrap"><p class="best-loading">Bestiarium laden…</p></div>`;
  try { _data = await api.bestiarium(); }
  catch { _container.innerHTML = `<div class="best-wrap"><p class="best-err">Kon het bestiarium niet laden.</p></div>`; return; }
  _renderGrid();
}

function _renderGrid() {
  const dm = _data.role === 'dm';
  const monsters = _data.monsters || [];
  const head = `<div class="best-head">${icon('skull')} <span class="best-title">Bestiarium</span>${
    monsters.length ? `<span class="best-count">${monsters.length}</span>` : ''}</div>`;

  if (!monsters.length) {
    _container.innerHTML = `<div class="best-wrap">${head}
      <p class="best-empty">${dm
        ? 'Nog geen monsters in de bibliotheek. Voeg ze toe in de Meesterkamer → Monsters.'
        : 'Nog niets ontdekt. Versla monsters in de strijd om hun geheimen te leren.'}</p>
    </div>`;
    return;
  }
  const cards = monsters.map((m, i) => _card(m, i, dm)).join('');
  _container.innerHTML = `<div class="best-wrap">${head}<div class="best-grid">${cards}</div></div>`;
}

function _card(m, i, dm) {
  const sb  = m.statblock || {};
  const niv = m._niveau || null;
  const sub = [sb.size, sb.type, sb.alignment].filter(Boolean).map(esc).join(' ');
  const portrait = m.imageId
    ? `<img class="best-card-portrait" src="${api.fileUrl(m.imageId)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="best-card-silhouet" style="display:none">${icon('skull')}</span>`
    : `<span class="best-card-silhouet">${icon('skull')}</span>`;

  // DM: onthul-selector. Speler: kennis-badge.
  const meta = dm
    ? `<select class="best-niv-select" onclick="event.stopPropagation()" onchange="event.stopPropagation();window.bestiarium.setNiveau('${esc(m.id)}', this.value)">
         ${_NIV.map(o => `<option value="${o.v}"${(niv || '') === o.v ? ' selected' : ''}>${o.label}</option>`).join('')}
       </select>`
    : `<span class="best-card-badge best-badge--${niv || 'naam'}">${_NIV_BADGE[niv] || 'Naam'}</span>`;

  return `<button type="button" class="best-card best-card--${niv || 'onbekend'}" onclick="window.bestiarium.open(${i})">
    <div class="best-card-portrait-wrap">${portrait}</div>
    <div class="best-card-body">
      <div class="best-card-name">${esc(m.name)}</div>
      ${sub ? `<div class="best-card-sub">${sub}</div>` : ''}
    </div>
    ${meta}
  </button>`;
}

window.bestiarium = {
  open(i) {
    const m = _data.monsters?.[i];
    if (!m) return;
    const dm = _data.role === 'dm';
    // DM ziet altijd volledig; speler op het server-bepaalde niveau (data is al gefilterd).
    const niveau = dm ? 'volledig' : (m._niveau || 'naam');
    const sb = m.statblock || {};
    const subtitle = [sb.size, sb.type, sb.alignment].filter(Boolean).join(' ');
    window.app.openModal(m.name, subtitle, renderStatblock(m, { niveau }));
  },
  async setNiveau(monsterId, niveau) {
    try { await api.setBestiarium(monsterId, niveau || null); }
    catch { /* socket-event ververst alsnog */ }
    // Lokale state direct bijwerken zodat de selector blijft staan (socket volgt).
    const m = _data.monsters?.find(x => x.id === monsterId);
    if (m) m._niveau = niveau || null;
  },
  refresh() { if (_container && window.app?.state?.activeSection === 'bestiarium') renderBestiarium(); },
};
