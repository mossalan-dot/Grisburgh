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

import { api } from './api.js?v=320';
import { renderStatblock } from './render-statblock.js?v=9';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// In een inline handler (`onclick="f('…')"`) decodeert de browser eerst het
// attribuut en voert dan de JavaScript uit: `esc()` alleen laat een apostrof
// de string sluiten. Eerst JS-escapen, dan HTML. Zie scripts/onclick-escapen.js.
const escArg = s => esc(typeof s === 'string' ? s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') : s);
const icon = (...a) => window.icon(...a);

let _container = null;
let _data = { role: 'player', monsters: [] };
// Zoeken en filteren, zoals op de andere archief-tabbladen. `type` is de
// hoofdgroep van het creature type ("Humanoid (goblinoid)" → Humanoid), want
// daar denk je in; het haakje is een verbijzondering.
let _zoek = '';
let _type = null;
let _filterOpen = false;   // staat de trechter open? een gekozen type houdt hem open

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
  // De typechips zitten achter de trechter, zoals de subtype-chips op de andere
  // tabbladen. De lijst is dus al nodig bij het bouwen van de kop.
  const _typen = [...new Set(monsters.map(_hoofdType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
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
          <!-- Dezelfde knoppenrij als de andere archieftabbladen: zoeken,
               trechter, uitleg, plus. De monsterbibliotheek staat ertussen als
               icoonknop — met een **lijstje**, niet met een boek: dat is het
               icoon van de hulpknop en die twee stonden naast elkaar. -->
          ${_typen.length >= 2 ? `<button class="sf-toggle-btn${_type ? ' sf-toggle-btn--active' : ''}"
            onclick="window.bestiarium.toonFilter()" title="Filter op creature type"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : ''}
          ${dm ? `<button class="sbs-add-btn" onclick="window.bestiarium.openLibrary()"
            title="Naar de monsterbibliotheek in de Meesterkamer">${icon('clipboard-list')}</button>` : ''}
          ${window._helpBtn?.('bestiarium') ?? ''}
          ${dm ? `<button class="sbs-add-btn" onclick="window.bestiarium.nieuw()"
            title="Nieuw wezen">${icon('plus')}</button>` : ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>`;

  if (!monsters.length) {
    _container.innerHTML = `${head}<div class="best-wrap">
      <p class="best-empty">${dm
        ? 'Nog geen wezens. Maak er een met <strong>Nieuw wezen</strong> hierboven.'
        : 'Nog niets ontdekt. Versla monsters in de strijd om hun geheimen te leren.'}</p>
    </div>`;
    return;
  }
  // Chips op de hoofdgroep van het creature type — hetzelfde gebaar als de
  // typechips op de andere tabbladen. Pas tonen als er iets te kiezen valt.
  const chips = _typen.length >= 2 ? `
    <div class="subtype-filter-bar${(_filterOpen || _type) ? '' : ' subtype-filter-bar--hidden'}">
      <button class="sf-chip${_type ? '' : ' sf-chip--active'}" onclick="window.bestiarium.filterType(null)">Alle</button>
      ${_typen.map(t => `<button class="sf-chip${_type === t ? ' sf-chip--active' : ''}"
        onclick="window.bestiarium.filterType('${escArg(t)}')">${esc(t)}</button>`).join('')}
    </div>` : '';

  const zichtbaar = _gefilterd(monsters);
  const cards = zichtbaar.length
    ? zichtbaar.map((m) => _card(m, monsters.indexOf(m), dm)).join('')
    : `<p class="best-empty">Geen wezens gevonden.</p>`;
  _container.innerHTML = `${head}<div class="best-wrap">
    ${chips}
    <div class="cards-grid tegel-raster grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">${cards}</div>
  </div>`;
}

// Alleen de kaartjes opnieuw tekenen; het zoekveld houdt zo zijn cursor.
// (Deze functie sneuvelde bij het weghalen van de voetnoot onder het raster —
// waarmee zoeken én filteren stilletjes stuk waren.)
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

// ── Tegels ────────────────────────────────────────────────────────────────
// Dezelfde drie standen als de andere archief-tabbladen (zie de toelichting bij
// TEGEL_TYPES in render-campagne.js): dicht (beeld + naam), open (2×2 met
// bladen) en het venster — hier het statblok, op het kennisniveau van de party.
// De beweging leent de hulpjes van daar: `_tegelFlip`, `_tegelBlader` en
// `_tegelVensterUit`.
let _openId = null;
const _blad = {};
const _BLAD_ICOON = { portret: 'image', gegevens: 'clipboard-list', beschrijving: 'book-open', roddel: 'beer' };

function _bladen(m, dm) {
  const sb = m.statblock || {};
  const niv = m._niveau || null;
  const bladen = [{ soort: 'portret', label: 'Portret' }];
  const rijen = [];
  if (sb.type) rijen.push(['Creature Type', sb.type]);
  if (sb.size) rijen.push(['Size', sb.size]);
  if (sb.alignment) rijen.push(['Alignment', sb.alignment]);
  if (sb.cr != null && sb.cr !== '') rijen.push(['Challenge', `CR ${sb.cr}`]);
  if (dm) rijen.push(['Kennis', _NIV_LABEL[niv || '']]);
  if (rijen.length) bladen.push({ soort: 'gegevens', label: 'Gegevens', html: `
    ${m._bron === 'magizoo' ? `<div class="tegel-badges"><span class="card-subtype-badge">${icon('paw-print')} Magizoöloog</span></div>` : ''}
    <dl class="tegel-gegevens">${rijen.map(([k, v]) => `<div class="tegel-gegeven"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` });
  if (m.description) bladen.push({ soort: 'beschrijving', label: 'Beschrijving', tekst: m.description,
    html: `<div class="tegel-tekst"><p>${esc(m.description).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>` });
  // De roddel: de speler alleen als de party hem gehoord heeft, de DM altijd
  // (gedimd zolang hij nog niet gehoord is).
  const gehoord = dm ? !!m._roddelGehoord : !!m._roddel;
  const tekst = dm ? (m.roddel || '') : (m._roddel || '');
  if (tekst) bladen.push({ soort: 'roddel', label: 'Roddel', tekst,
    html: `<ul class="tegel-regels"><li class="tegel-regel${gehoord ? '' : ' tegel-regel--dicht'}"${gehoord ? '' : ' title="Nog niet gehoord door de party"'}>\u201e${esc(tekst)}\u201c</li></ul>` });
  return bladen;
}

function _bladInhoud(m, b) {
  const sb = m.statblock || {};
  if (b.soort === 'portret') {
    const sub = [sb.size, sb.type].filter(Boolean).join(' ');
    return `<div class="tegel-naamband tegel-naamband--groot">
      <span class="card-name">${esc(m.name)}</span>
      ${sub ? `<span class="tegel-ondertitel">${esc(sub)}</span>` : ''}</div>`;
  }
  return `<div class="tegel-vel">
    <div class="tegel-vel-kop">${icon(_BLAD_ICOON[b.soort] || 'square')} ${esc(b.label)}<span class="tegel-vel-naam">${esc(m.name)}</span>
      ${m.imageId ? `<img class="tegel-vel-portret" src="${api.thumbUrl(m.imageId)}" alt="" onerror="this.remove()">` : ''}</div>
    <div class="tegel-vel-tekst">${b.html}</div>
  </div>`;
}

// Wat de groep van dit wezen weet. **Vier treden, vier regels** — het was een
// letterknop die rondging, en dan moet je drie keer klikken om terug te komen
// en raad je wat de volgende stand wordt. Zelfde uitklapvenstertje als bij de
// zichtbaarheid van een kaartje; alleen zijn het hier vier standen met een
// letter in plaats van drie met een oogje.
const _NIV_UITLEG = {
  '':        'Ze zijn het nog nooit tegengekomen.',
  naam:      'Ze kennen de naam, meer niet.',
  deels:     'Ze kennen het halve statblok.',
  volledig:  'Ze kennen alles.',
};

function _dmKnoppen(m, { voet = false } = {}) {
  const niv = m._niveau || null;
  const nivKey = niv || 'onbekend';
  // Alleen in de voetbalk: een dichte tegel knipt zijn inhoud af, en dan valt
  // het paneel half weg. Daar blijft de letterknop dus rondgaan.
  if (!voet) {
    return `<div class="tegel-dm" onclick="event.stopPropagation()">
      <button class="best-card-niv best-card-niv--${nivKey}" title="Kennisniveau: ${_NIV_LABEL[niv || '']} — klik om te wisselen"
        onclick="window.bestiarium.cycleNiveau('${escArg(m.id)}', this)">${_NIV_LETTER[niv || '']}</button>
      <button title="Bewerken" onclick="window.bestiarium.edit('${escArg(m.id)}')">${icon('pencil')}</button>
      <button class="tegel-dm-weg" title="Verwijderen"
        onclick="window.bestiarium.del('${escArg(m.id)}','${escArg(m.name)}')">${icon('x')}</button>
    </div>`;
  }
  return `<div class="tegel-dm" onclick="event.stopPropagation()">
    <div class="tegel-zicht">
      <button class="best-card-niv best-card-niv--${nivKey} tegel-zicht-knop tegel-zicht-knop--letter"
        title="Wat de groep weet: ${_NIV_LABEL[niv || '']}"
        onclick="event.stopPropagation();this.parentElement.classList.toggle('is-open')">${_NIV_LETTER[niv || '']}</button>
      <div class="tegel-zicht-paneel" onclick="event.stopPropagation()">
        <div class="tegel-houding-kop">Wat de groep weet</div>
        ${_NIV_ORDER.map(k => `<button type="button" class="tegel-zicht-rij${(niv || '') === k ? ' is-aan' : ''}"
          onclick="event.stopPropagation();window.bestiarium.zetNiveau('${escArg(m.id)}','${k}')">
          <span class="tegel-zicht-ico best-card-niv best-card-niv--${k || 'onbekend'}">${_NIV_LETTER[k]}</span>
          <span><span class="tegel-zicht-naam">${esc(_NIV_LABEL[k])}</span><span class="tegel-zicht-uitleg">${esc(_NIV_UITLEG[k])}</span></span>
        </button>`).join('')}
      </div>
    </div>
    <button title="Bewerken" onclick="window.bestiarium.edit('${escArg(m.id)}')">${icon('pencil')}</button>
    ${voet ? '' : `<button class="tegel-dm-weg" title="Verwijderen"
      onclick="window.bestiarium.del('${escArg(m.id)}','${escArg(m.name)}')">${icon('x')}</button>`}
  </div>`;
}

function _card(m, i, dm) {
  const niv = m._niveau || null;
  const id = esc(m.id);
  const klassen = `entity-card tegel best-tegel${dm && !niv ? ' card-hidden' : ''}`;
  const beeld = `<span class="tegel-icoon" aria-hidden="true">${icon('skull')}</span>
    ${m.imageId ? `<img class="tegel-img" loading="lazy" src="${api.thumbUrl(m.imageId)}" alt=""
      onerror="this.closest('.tegel')?.classList.add('no-img');this.remove()">` : ''}`;
  const klik = `onclick="window.bestiarium.tegel('${id}')"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.bestiarium.tegel('${id}')}"`;
  if (_openId !== m.id) {
    return `<div class="${klassen}${m.imageId ? '' : ' no-img'}" data-sleutel="${id}" role="button" tabindex="0" title="${esc(m.name)}" ${klik}>
      <div class="card-accent bar-bestiarium"></div>
      ${beeld}
      ${m._bron === 'magizoo' ? `<span class="best-bron-badge" title="Onderzocht door de Magizoöloog">${icon('paw-print')}</span>` : ''}
      <div class="tegel-naamband"><span class="card-name">${esc(m.name)}</span></div>
      ${dm ? _dmKnoppen(m) : ''}
    </div>`;
  }
  const bladen = _bladen(m, dm);
  const j = Math.min(_blad[m.id] || 0, bladen.length - 1);
  return `<div class="${klassen} tegel--open${m.imageId ? '' : ' no-img'}" data-sleutel="${id}" role="button" tabindex="0" ${klik}
    aria-label="${esc(m.name)}, blad ${j + 1} van ${bladen.length}">
    <div class="card-accent bar-bestiarium"></div>
    ${beeld}
    <div class="tegel-blad" data-soort="${bladen[j].soort}">${_bladInhoud(m, bladen[j])}</div>
    <div class="tegel-voet" onclick="event.stopPropagation()">
      <div class="tegel-punten">${window._tegelPijlHtml(-1, bladen.length)}${bladen.map((b, k) => `<button class="tegel-punt${k === j ? ' is-aan' : ''}"
        title="${esc(b.label)}" onclick="window.bestiarium.naar('${id}',${k})">${icon(_BLAD_ICOON[b.soort] || 'square')}</button>`).join('')}${window._tegelPijlHtml(1, bladen.length)}</div>
      ${dm ? _dmKnoppen(m, { voet: true }) : ''}
      <button class="tegel-knop" title="Het statblok" onclick="window.bestiarium.vergroot('${id}')">${icon('maximize-2')}</button>
      <button class="tegel-knop" title="Kleiner" onclick="window.bestiarium.dicht()">${icon('minimize-2')}</button>
    </div>
  </div>`;
}

// Het raster opnieuw tekenen, met beweging.
function _herteken(opts) {
  const grid = _container?.querySelector('.cards-grid');
  if (!grid || !window._tegelFlip) return _tekenKaarten();
  window._tegelFlip(grid, () => _tekenKaarten(), opts);
}

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || !_openId) return;
  if (document.getElementById('modal-overlay')?.classList.contains('active')) return;
  window.bestiarium.dicht();
});

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
  // Tik op een tegel: dicht → open (op het blad waar je zoekterm staat),
  // open → het volgende blad.
  tegel(id) {
    const m = (_data.monsters || []).find(x => x.id === id);
    if (!m) return;
    const dm = _data.role === 'dm';
    if (_openId !== id) {
      _openId = id;
      const q = (window._normSearch || (x => String(x || '').toLowerCase()))(_zoek || '');
      const bladen = _bladen(m, dm);
      const k = q ? bladen.findIndex(b => b.tekst && window._normSearch(b.tekst).includes(q)) : -1;
      _blad[id] = k > 0 ? k : 0;
      _herteken();
      setTimeout(() => _container?.querySelector(`.tegel[data-sleutel="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 360);
      return;
    }
    this.naar(id, ((_blad[id] || 0) + 1) % _bladen(m, dm).length);
  },
  async naar(id, k) {
    const el = _container?.querySelector(`.tegel--open[data-sleutel="${CSS.escape(id)}"]`);
    const m = (_data.monsters || []).find(x => x.id === id);
    if (!el || !m) return;
    const bladen = _bladen(m, _data.role === 'dm');
    const vorige = _blad[id] || 0;
    _blad[id] = Math.max(0, Math.min(bladen.length - 1, k));
    if (_blad[id] === vorige) return;
    const wissel = () => {
      const blad = el.querySelector('.tegel-blad');
      blad.dataset.soort = bladen[_blad[id]].soort;
      blad.innerHTML = _bladInhoud(m, bladen[_blad[id]]);
      el.querySelectorAll('.tegel-punt').forEach((p, j) => p.classList.toggle('is-aan', j === _blad[id]));
    };
    if (window._tegelBlader) await window._tegelBlader(el, _blad[id] > vorige ? 1 : -1, wissel);
    else wissel();
  },
  dicht() { if (_openId) { _openId = null; _herteken(); } },
  vergroot(id) {
    const i = (_data.monsters || []).findIndex(x => x.id === id);
    if (i < 0) return;
    const tegel = () => _container?.querySelector(`.tegel[data-sleutel="${CSS.escape(id)}"]`);
    if (window._tegelVensterUit) window._tegelVensterUit(tegel, () => this.open(i));
    else this.open(i);
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
    // Vegen en ← / → bladeren door de **gefilterde** lijst, net als bij de
    // kaartjes. `open(i)` telt in de volledige lijst; de buren zoeken we in wat
    // het raster op dit moment toont.
    window._bladerBron = (richting) => {
      const zichtbaar = _gefilterd(_data.monsters || []);
      const pos = zichtbaar.findIndex(x => x.id === m.id);
      const doel = zichtbaar[pos + richting];
      if (pos >= 0 && doel) this.openId(doel.id);
    };
  },
  // Cycle het kennisniveau: Onbekend → Naam → Deels → Volledig → Onbekend.
  // Rechtstreeks zetten, uit het uitklapvenstertje.
  async zetNiveau(monsterId, niveau) {
    const m = _data.monsters?.find(x => x.id === monsterId);
    if ((m?._niveau || '') === niveau) { document.querySelector('.tegel-zicht.is-open')?.classList.remove('is-open'); return; }
    try { await api.setBestiarium(monsterId, niveau || null); }
    catch { /* socket-event ververst alsnog */ }
    if (m) m._niveau = niveau || null;
    _tekenKaarten();
    window._showToast?.(`${m?.name || 'Dit wezen'}: de groep weet ${(_NIV_LABEL[niveau] || '').toLowerCase()}.`);
  },
  // De oude ronddraaiknop. Blijft bestaan voor wie hem nog aanroept.
  async cycleNiveau(monsterId, btnEl) {
    const m = _data.monsters?.find(x => x.id === monsterId);
    const cur = m?._niveau || '';
    const next = _NIV_ORDER[(_NIV_ORDER.indexOf(cur) + 1) % _NIV_ORDER.length];
    try { await api.setBestiarium(monsterId, next || null); }
    catch { /* socket-event ververst alsnog */ }
    if (m) m._niveau = next || null;
    // Het raster opnieuw: de letter, de gedimde stand en het gegevensblad
    // (daar staat het kennisniveau) lopen dan allemaal mee.
    _tekenKaarten();
  },
  // Bewerken gebeurt hier, in een venster met dezelfde editor als in de
  // Meesterkamer — je hoeft het tabblad niet meer te verlaten om een wezen bij
  // te schaven. De knop naar de bibliotheek blijft staan voor het overzicht
  // (aktes, paginering, SRD-import).
  edit(monsterId) { window.dmPanel?.monsterModal?.(monsterId); },
  nieuw()         { window.dmPanel?.monsterModal?.(); },
  toonFilter()    { _filterOpen = !_filterOpen; _renderGrid(); },
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
    _container?.querySelectorAll('.subtype-filter-bar .sf-chip').forEach(b => {
      b.classList.toggle('sf-chip--active', (b.textContent.trim() === (t || 'Alle')));
    });
    // De trechter kleurt mee: een actief filter mag niet onzichtbaar zijn als
    // je de chips weer dichtklapt.
    _container?.querySelector('.sf-toggle-btn')?.classList.toggle('sf-toggle-btn--active', !!_type);
    _tekenKaarten();
  },
  refresh() { if (_container && window.app?.state?.activeSection === 'bestiarium') renderBestiarium(); },
};
