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

import { api } from './api.js?v=280';
import { renderStatblock } from './render-statblock.js?v=7';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);

let _container = null;
let _data = { role: 'player', monsters: [] };
// Zoeken en filteren, zoals op de andere archief-tabbladen. `type` is de
// hoofdgroep van het creature type ("Humanoid (goblinoid)" → Humanoid), want
// daar denk je in; het haakje is een verbijzondering.
let _zoek = '';
let _type = null;

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

const _hoofdType = (m) => String(m.statblock?.type || '').split(/[(,]/)[0].trim();

// Zelfde regels als bij de kaartjes: genormaliseerd, meerdere woorden, en hoe
// korter het woord hoe strenger. Naam eerst, dan de korte velden, dan de tekst.
function _score(m, tokens) {
  const norm = window._normSearch || (x => String(x || '').toLowerCase());
  const sb = m.statblock || {};
  const naam = norm(m.name);
  const meta = norm([sb.type, sb.size, sb.alignment, sb.cr != null ? `CR ${sb.cr}` : '',
                     _NIV_LABEL[m._niveau || '']].filter(Boolean).join(' '));
  const rest = norm([m.description, m.roddel || m._roddel, sb.traits, sb.actions,
                     sb.languages, sb.senses].filter(Boolean).join(' '));
  let totaal = 0;
  for (const t of tokens) {
    let best = 0;
    if (naam === t) best = 1000;
    else if (naam.startsWith(t)) best = 600;
    else if (t.length >= 2 && naam.includes(t)) best = 250;
    else if (t.length >= 2 && meta.includes(t)) best = 120;
    else if (t.length >= 3 && rest.includes(t)) best = 60;
    if (best === 0) return -1;
    totaal += best;
  }
  return totaal;
}

function _gefilterd(monsters) {
  const tokens = window._searchTokens?.(_zoek) || [];
  const scores = new Map();
  const uit = monsters.filter(m => {
    if (_type && _hoofdType(m) !== _type) return false;
    if (!tokens.length) return true;
    const sc = _score(m, tokens);
    if (sc < 0) return false;
    scores.set(m.id, sc);
    return true;
  });
  return tokens.length ? uit.sort((a, b) => scores.get(b.id) - scores.get(a.id)) : uit;
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
          <div class="sbs-input-wrap">
            <span class="sbs-icon">\u2315</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek wezen\u2026"
              value="${esc(_zoek)}" oninput="window.bestiarium.zoek(this.value)">
          </div>
          ${dm ? `<button class="best-lib-btn best-lib-btn--nieuw" onclick="window.bestiarium.nieuw()"
            title="Een nieuw wezen aanmaken, hier in het tabblad">${icon('plus')} Nieuw wezen</button>
          <button class="best-lib-btn" onclick="window.bestiarium.openLibrary()"
            title="Naar de monsterbibliotheek in de Meesterkamer">${icon('book-open')} Monsterbibliotheek</button>` : ''}
          ${window._helpBtn?.('bestiarium') ?? ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>`;

  if (!monsters.length) {
    _container.innerHTML = `${head}<div class="best-wrap">
      <p class="best-empty">${dm
        ? 'Nog geen wezens. Maak er een met <strong>Nieuw wezen</strong> hierboven.'
        : 'Nog niets ontdekt. Versla monsters in de strijd om hun geheimen te leren.'}</p>
      ${dm ? _voetnoot() : ''}
    </div>`;
    return;
  }
  // Chips op de hoofdgroep van het creature type — hetzelfde gebaar als de
  // typechips op de andere tabbladen. Pas tonen als er iets te kiezen valt.
  const typen = [...new Set(monsters.map(_hoofdType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
  const chips = typen.length >= 2 ? `
    <div class="best-typefilter">
      <button class="sf-chip${_type ? '' : ' sf-chip--active'}" onclick="window.bestiarium.filterType(null)">Alle</button>
      ${typen.map(t => `<button class="sf-chip${_type === t ? ' sf-chip--active' : ''}"
        onclick="window.bestiarium.filterType('${esc(t)}')">${esc(t)}</button>`).join('')}
    </div>` : '';

  const zichtbaar = _gefilterd(monsters);
  const cards = zichtbaar.length
    ? zichtbaar.map((m) => _card(m, monsters.indexOf(m), dm)).join('')
    : `<p class="best-empty">Geen wezens gevonden.</p>`;
  _container.innerHTML = `${head}<div class="best-wrap">
    ${chips}
    <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">${cards}</div>
    ${_voetnoot()}
  </div>`;
}

// Waarom staat de herbergier hier niet, en de kapitein die de party bevocht ook
// niet? Omdat het bestiarium over **wezens** gaat en zij personen zijn: hun
// statblok hoort bij hun kaartje. Dat is een terechte vraag om te krijgen, dus
// staat het antwoord eronder in plaats van in iemands hoofd. Alleen voor de DM:
// de speler heeft geen personagelijst met statblokken.
function _voetnoot() {
  if (_data.role !== 'dm') return '';
  return `<p class="best-voetnoot">${icon('user')}
    Personen — NPC's, antagonisten, bondgenoten — staan hier niet: hun statblok hoort bij hun
    <button type="button" class="best-voetnoot-link" onclick="window.bestiarium.naarPersonages()">kaartje bij Personages</button>.
    Ze doen wel gewoon mee in een gevecht, en een kaartje kan meerdere statblokken hebben.</p>`;
}

// Alleen de kaartjes opnieuw tekenen; het zoekveld houdt zo zijn cursor.
function _tekenKaarten() {
  const grid = _container?.querySelector('.cards-grid');
  if (!grid) return _renderGrid();
  const dm = _data.role === 'dm';
  const monsters = _data.monsters || [];
  const zichtbaar = _gefilterd(monsters);
  grid.innerHTML = zichtbaar.length
    ? zichtbaar.map((m) => _card(m, monsters.indexOf(m), dm)).join('')
    : `<p class="best-empty">Geen wezens gevonden.</p>`;
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
        ${typePill ? `<span class="best-type-pill" title="${typePill}">${typePill}</span>` : ''}
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
  // Wat deze kijker van het bestiarium mag zien (server filtert al), zodat het
  // globale zoeken erin kan zoeken zonder de sectie te openen.
  async alle() {
    if (!_data?.monsters?.length) { try { _data = await api.bestiarium(); } catch { return []; } }
    return _data.monsters || [];
  },
  // Openen op id in plaats van op positie — het globale zoeken kent geen index.
  openId(id) {
    const i = (_data?.monsters || []).findIndex(m => m.id === id);
    if (i >= 0) this.open(i);
  },
  open(i) {
    const m = _data.monsters?.[i];
    if (!m) return;
    const dm = _data.role === 'dm';
    // DM ziet altijd volledig; speler op het server-bepaalde niveau (data is al gefilterd).
    const niveau = dm ? 'volledig' : (m._niveau || 'naam');
    const sb = m.statblock || {};
    const subtitle = [sb.size, sb.type, sb.alignment].filter(Boolean).join(' ');
    // De modalkop toont naam en ondertitel al; het statblock hoeft dat niet
    // te herhalen.
    window.app.openModal(m.name, subtitle, renderStatblock(m, { niveau, kop: false }));
    // Spreuknamen in het statblok klikbaar maken; de bibliotheek laadt lui.
    window.spreuken?.linkInDom?.(document.getElementById('m-body'));
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
  // Bewerken gebeurt hier, in een venster met dezelfde editor als in de
  // Meesterkamer — je hoeft het tabblad niet meer te verlaten om een wezen bij
  // te schaven. De knop naar de bibliotheek blijft staan voor het overzicht
  // (aktes, paginering, SRD-import).
  edit(monsterId) { window.dmPanel?.monsterModal?.(monsterId); },
  nieuw()         { window.dmPanel?.monsterModal?.(); },
  naarPersonages() { try { window.app?.switchSection?.('personages'); } catch {} },
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
  zoek(v) { _zoek = v; _tekenKaarten(); },
  filterType(t) {
    _type = t || null;
    _container?.querySelectorAll('.best-typefilter .sf-chip').forEach(b => {
      b.classList.toggle('sf-chip--active', (b.textContent.trim() === (t || 'Alle')));
    });
    _tekenKaarten();
  },
  refresh() { if (_container && window.app?.state?.activeSection === 'bestiarium') renderBestiarium(); },
};
