/**
 * render-bestiarium.js — spelers-Bestiarium (feature #3).
 * Toont monsters op het kennisniveau van de groep, via de gedeelde renderStatblock.
 * De DM ziet alles + kan per monster het kennisniveau van de actieve groep cyclen,
 * het wezen bewerken (→ Meesterkamer) of verwijderen.
 *
 * De kaartjes gebruiken dezelfde `.entity-card`-opmaak als de archief-tabbladen:
 * accent-bar, portret met type-pill, hoek-knoppen (bewerken / verwijderen / niveau),
 * en een beschrijving-preview in de body.
 */

import { api } from './api.js?v=238';
import { renderStatblock } from './render-statblock.js?v=3';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);

let _container = null;
let _data = { role: 'player', monsters: [] };

// Kennisniveaus, cyclend: Onbekend → Naam → Deels → Volledig → Onbekend.
const _NIV_ORDER  = ['', 'naam', 'deels', 'volledig'];
const _NIV_LETTER = { '': 'O', naam: 'N', deels: 'D', volledig: 'V' };
const _NIV_LABEL  = { '': 'Onbekend', naam: 'Naam', deels: 'Deels', volledig: 'Volledig' };

export async function renderBestiarium(container) {
  _container = container || document.getElementById('section-bestiarium');
  if (!_container) return;
  _container.innerHTML = `<div class="best-wrap">
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">${window._skelCards?.(6) || '<p class="best-loading">Bestiarium laden…</p>'}</div>
  </div>`;
  try { _data = await api.bestiarium(); }
  catch { _container.innerHTML = `<div class="best-wrap"><p class="best-err">Kon het bestiarium niet laden.</p></div>`; return; }
  _renderGrid();
}

function _renderGrid() {
  const dm = _data.role === 'dm';
  const monsters = _data.monsters || [];
  // Sectiekop in dezelfde stijl als de archief-tabbladen (section-banner).
  const head = `
    <div class="section-banner section-banner--entity section-banner--bestiarium">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('skull')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Bestiarium</div>
          <div class="section-banner-desc-line">Wezens en hun geheimen</div>
        </div>
        <div class="section-banner-search">
          ${dm ? `<button class="best-lib-btn" onclick="window.bestiarium.openLibrary()"
            title="Naar de monsterbibliotheek in de Meesterkamer">${icon('book-open')} Monsterbibliotheek</button>` : ''}
          <span class="results-count sbs-count">${monsters.length} ${monsters.length === 1 ? 'wezen' : 'wezens'}</span>
          ${window._helpBtn?.('bestiarium') ?? ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>`;

  if (!monsters.length) {
    _container.innerHTML = `${head}<div class="best-wrap">
      <p class="best-empty">${dm
        ? 'Nog geen monsters in de bibliotheek. Voeg ze toe in de Meesterkamer → Monsters.'
        : 'Nog niets ontdekt. Versla monsters in de strijd om hun geheimen te leren.'}</p>
    </div>`;
    return;
  }
  const cards = monsters.map((m, i) => _card(m, i, dm)).join('');
  _container.innerHTML = `${head}<div class="best-wrap">
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">${cards}</div>
  </div>`;
  // Zelfde 3D-tilt bij hover als de archief-tabbladen.
  const grid = _container.querySelector('.cards-grid');
  if (grid && typeof window._attachCardTilt === 'function') window._attachCardTilt(grid);
}

function _card(m, i, dm) {
  const sb  = m.statblock || {};
  const niv = m._niveau || null;
  const typePill = [sb.size, sb.type].filter(Boolean).map(esc).join(' ');
  const metaBits = [sb.alignment, (sb.cr != null && sb.cr !== '') ? `CR ${sb.cr}` : '']
    .filter(Boolean).map(esc).join(' · ');
  const hasImg = !!m.imageId;
  const nivKey = niv || 'onbekend';
  const viaMagizoo = m._bron === 'magizoo';
  // Roddel: speler ziet _roddel (alleen als gehoord); DM ziet de eigen roddel + status.
  const roddelTekst = dm ? (m.roddel || '') : (m._roddel || '');
  const roddelGehoord = dm ? !!m._roddelGehoord : !!m._roddel;

  return `
    <div class="entity-card best-entity-card${dm && !niv ? ' card-hidden' : ''}" onclick="window.bestiarium.open(${i})">
      ${dm ? `
        <div class="dm-only absolute top-7 right-2 z-30 flex flex-col gap-1">
          <button class="best-card-ctrl" title="Bewerken"
            onclick="event.stopPropagation();window.bestiarium.edit('${esc(m.id)}')">${icon('pencil')}</button>
          <button class="best-card-ctrl best-card-ctrl--danger" title="Verwijderen"
            onclick="event.stopPropagation();window.bestiarium.del('${esc(m.id)}','${esc(m.name).replace(/'/g, "\\'")}')">${icon('x')}</button>
          <button class="best-card-ctrl best-card-niv best-card-niv--${nivKey}"
            title="Kennisniveau: ${_NIV_LABEL[niv || '']} — klik om te wisselen"
            onclick="event.stopPropagation();window.bestiarium.cycleNiveau('${esc(m.id)}', this)">${_NIV_LETTER[niv || '']}</button>
        </div>` : ''}
      <div class="card-accent bar-bestiarium"></div>
      <div class="card-img-wrap best-card-img-wrap">
        <div class="best-silhouet-fill">${icon('skull')}</div>
        ${hasImg ? `<img class="card-img best-card-img" loading="lazy" src="${api.fileUrl(m.imageId)}"
          onerror="this.style.display='none'">` : ''}
        <div class="card-img-fade"></div>
        ${typePill ? `<span class="best-type-pill">${typePill}</span>` : ''}
        ${viaMagizoo ? `<span class="best-bron-badge" title="Onderzocht door de Magizoöloog">${icon('paw-print')}</span>` : ''}
      </div>
      <div class="card-body px-3 pt-2 pb-2">
        <div class="mb-1.5">
          <span class="card-name block" data-fittext>${esc(m.name)}</span>
          ${metaBits ? `<span class="card-name-sep"></span>
          <div class="card-meta"><span class="card-meta-sub">${metaBits}</span></div>` : ''}
        </div>
        ${m.description ? `<p class="best-card-desc">${esc(m.description)}</p>` : ''}
        ${roddelGehoord && roddelTekst
          ? `<div class="best-roddel">${icon('message-circle')} <em>${esc(roddelTekst)}</em></div>`
          : (dm && m.roddel && !roddelGehoord
              ? `<div class="best-roddel best-roddel--ongehoord">${icon('message-circle')} <em>${esc(m.roddel)}</em> <span class="best-roddel-hint">(nog niet gehoord)</span></div>`
              : '')}
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
  // Cycle het kennisniveau: Onbekend → Naam → Deels → Volledig → Onbekend.
  async cycleNiveau(monsterId, btnEl) {
    const m = _data.monsters?.find(x => x.id === monsterId);
    const cur = m?._niveau || '';
    const next = _NIV_ORDER[(_NIV_ORDER.indexOf(cur) + 1) % _NIV_ORDER.length];
    try { await api.setBestiarium(monsterId, next || null); }
    catch { /* socket-event ververst alsnog */ }
    if (m) m._niveau = next || null;
    if (btnEl) {
      btnEl.textContent = _NIV_LETTER[next];
      btnEl.className = 'best-card-ctrl best-card-niv best-card-niv--' + (next || 'onbekend');
      btnEl.title = `Kennisniveau: ${_NIV_LABEL[next]} — klik om te wisselen`;
      btnEl.closest('.entity-card')?.classList.toggle('card-hidden', !next);
    }
  },
  // Bewerken: spring naar de Meesterkamer → Monsters en open de editor.
  edit(monsterId) {
    this.openLibrary();
    setTimeout(() => {
      let tries = 0;
      const tryEdit = () => {
        tries++;
        try { window.dmPanel?.monsterEdit?.(monsterId); } catch {}
        if (!document.getElementById('dm-mon-name') && tries < 12) setTimeout(tryEdit, 120);
      };
      tryEdit();
    }, 200);
  },
  // Naar de monsterbibliotheek (Meesterkamer → Monsters).
  openLibrary() {
    try { window.app?.switchSection?.('meesterkamer'); } catch {}
    setTimeout(() => { try { window.dmPanel?.switchTab?.('monsters'); } catch {} }, 140);
  },
  async del(monsterId, name) {
    if (!confirm(`"${name}" volledig uit de monsterbibliotheek verwijderen?`)) return;
    try { await api.deleteMonster(monsterId); } catch {}
    renderBestiarium();
  },
  refresh() { if (_container && window.app?.state?.activeSection === 'bestiarium') renderBestiarium(); },
};
