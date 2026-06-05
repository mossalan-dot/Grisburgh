/**
 * render-bestiarium.js — spelers-Bestiarium (feature #3).
 * Toont monsters op het kennisniveau van de groep, via de gedeelde renderStatblock.
 * De DM ziet alles + kan per monster het kennisniveau van de actieve groep zetten,
 * het wezen bewerken (→ Meesterkamer) of verwijderen.
 *
 * De kaartjes gebruiken dezelfde `.entity-card`-opmaak als de archief-tabbladen
 * (accent-bar, portret, hoek-knoppen voor zichtbaarheid/bewerken/verwijderen).
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
  _container.innerHTML = `<div class="best-wrap">${head}
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">${cards}</div>
  </div>`;
  // Zelfde 3D-tilt bij hover als de archief-tabbladen.
  const grid = _container.querySelector('.cards-grid');
  if (grid && typeof window._attachCardTilt === 'function') window._attachCardTilt(grid);
}

function _card(m, i, dm) {
  const sb  = m.statblock || {};
  const niv = m._niveau || null;
  const sub = [sb.size, sb.type, sb.alignment].filter(Boolean).map(esc).join(' ');
  const cr  = (sb.cr != null && sb.cr !== '') ? `CR ${esc(sb.cr)}` : '';
  const hasImg = !!m.imageId;

  // Overlay onderaan het portret: DM → niveau-keuze, speler → kennis-badge.
  const overlay = dm
    ? `<select class="best-niv-select best-niv-overlay" onclick="event.stopPropagation()"
         onchange="event.stopPropagation();window.bestiarium.setNiveau('${esc(m.id)}', this.value, this)">
         ${_NIV.map(o => `<option value="${o.v}"${(niv || '') === o.v ? ' selected' : ''}>${o.label}</option>`).join('')}
       </select>`
    : `<span class="best-card-badge best-badge--${niv || 'naam'} best-badge-overlay">${_NIV_BADGE[niv] || 'Naam'}</span>`;

  return `
    <div class="entity-card best-entity-card${dm && !niv ? ' card-hidden' : ''}" onclick="window.bestiarium.open(${i})">
      ${dm ? `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="best-card-ctrl" title="Bewerken"
            onclick="event.stopPropagation();window.bestiarium.edit('${esc(m.id)}')">${icon('pencil')}</button>
          <button class="best-card-ctrl best-card-ctrl--danger" title="Verwijderen"
            onclick="event.stopPropagation();window.bestiarium.del('${esc(m.id)}','${esc(m.name).replace(/'/g, "\\'")}')">${icon('x')}</button>
        </div>` : ''}
      <div class="card-accent bar-bestiarium"></div>
      <div class="card-img-wrap best-card-img-wrap">
        <div class="best-silhouet-fill">${icon('skull')}</div>
        ${hasImg ? `<img class="card-img best-card-img" loading="lazy" src="${api.fileUrl(m.imageId)}"
          onerror="this.style.display='none'">` : ''}
        <div class="card-img-fade"></div>
        ${overlay}
      </div>
      <div class="card-body px-3 pt-2 pb-2">
        <div class="mb-1.5">
          <span class="card-name block" data-fittext>${esc(m.name)}</span>
          ${(sub || cr) ? `<span class="card-name-sep"></span>
          <div class="card-meta">
            ${sub ? `<span class="card-meta-sub">${sub}</span>` : ''}
            ${sub && cr ? `<span class="card-meta-dot"> · </span>` : ''}
            ${cr ? `<span class="card-meta-rol">${cr}</span>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>`;
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
  async setNiveau(monsterId, niveau, selectEl) {
    try { await api.setBestiarium(monsterId, niveau || null); }
    catch { /* socket-event ververst alsnog */ }
    // Lokale state direct bijwerken zodat de selector blijft staan (socket volgt).
    const m = _data.monsters?.find(x => x.id === monsterId);
    if (m) m._niveau = niveau || null;
    // Card-hidden-styling direct bijwerken zonder volledige her-render.
    const card = selectEl?.closest?.('.entity-card');
    if (card) card.classList.toggle('card-hidden', !niveau);
  },
  // Bewerken: spring naar de Meesterkamer → Monsters en open de editor.
  edit(monsterId) {
    try { window.app?.switchSection?.('meesterkamer'); } catch {}
    setTimeout(() => {
      try { window.dmPanel?.switchTab?.('monsters'); } catch {}
      // Wacht tot de monsterlijst geladen is en open dan de editor (met korte retry).
      let tries = 0;
      const tryEdit = () => {
        tries++;
        try { window.dmPanel?.monsterEdit?.(monsterId); } catch {}
        const open = document.getElementById('dm-mon-name');
        if (!open && tries < 12) setTimeout(tryEdit, 120);
      };
      setTimeout(tryEdit, 160);
    }, 160);
  },
  async del(monsterId, name) {
    if (!confirm(`"${name}" volledig uit de monsterbibliotheek verwijderen?`)) return;
    try { await api.deleteMonster(monsterId); } catch {}
    renderBestiarium();
  },
  refresh() { if (_container && window.app?.state?.activeSection === 'bestiarium') renderBestiarium(); },
};
