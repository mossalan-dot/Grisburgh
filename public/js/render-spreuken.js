/**
 * render-spreuken.js — Archief-tab "Spreuken": een doorzoekbare spreukenrepository.
 *
 * Read-only browser over de lokale spreukenbron (`spells-2024.json`, of
 * `hp-spells.json` voor wands-wizards). Compacte kaartjes (naam, niveau, school,
 * ritueel/concentratie) met de door de DM ingestelde spreukafbeelding indien aanwezig.
 * Klik → volledig detail (casting time, range, componenten, duur, beschrijving,
 * "op hoger niveau"). De DM kan vanuit het detail een afbeelding instellen via de
 * mediabibliotheek (kopieert naar de vaste id `spell-img-<index>`).
 *
 * Kaartjes hergebruiken de `.entity-card`-opmaak van de andere archief-tabs.
 */

import { api } from './api.js?v=243';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();

let _all       = null;      // null = nog niet geladen
let _container = null;
let _filters   = { q: '', level: null, klasse: null };
let _classes   = [];

function _isHp() { return window.app?.state?.meta?.spellSource === 'wands-wizards'; }

async function _load() {
  if (_all) return _all;
  const url = _isHp() ? '/data/hp-spells.json' : '/data/spells-2024.json';
  try {
    const d = await fetch(url).then(r => r.json());
    _all = (d.results || d.spells || (Array.isArray(d) ? d : [])).filter(Boolean);
  } catch { _all = []; }
  // Unieke klassenlijst voor het klassefilter
  const set = new Set();
  for (const s of _all) for (const c of (s.classes || [])) { const n = (c.name || c); if (n) set.add(n); }
  _classes = [...set].sort();
  return _all;
}

// ── Helpers ──
const _levelLabel = lv => (lv === 0 || lv === '0') ? 'Cantrip' : `Niveau ${lv}`;
const _levelShort = lv => (lv === 0 || lv === '0') ? 'C' : String(lv);
function _school(s)     { return s?.school?.name || s?.school || ''; }
function _classNames(s) { return (s.classes || []).map(c => c.name || c).filter(Boolean); }
function _desc(s)       { return Array.isArray(s.desc) ? s.desc.join('\n\n') : (s.desc || ''); }
function _higher(s)     { return Array.isArray(s.higher_level) ? s.higher_level.join('\n\n') : (s.higher_level || ''); }
function _components(s) {
  const c = (s.components || []).join(', ');
  return c + (s.material ? ` (${s.material})` : '');
}
function _imgUrl(s)     { return `/api/files/spell-img-${s.index}`; }

function _filtered() {
  const q = _filters.q.trim().toLowerCase();
  return (_all || []).filter(s => {
    if (q && !(s.name || '').toLowerCase().includes(q)) return false;
    if (_filters.level !== null && Number(s.level) !== Number(_filters.level)) return false;
    if (_filters.klasse && !_classNames(s).some(n => n === _filters.klasse)) return false;
    return true;
  }).sort((a, b) => (a.level - b.level) || String(a.name).localeCompare(b.name));
}

// ── Eén kaartje ──
function _card(s) {
  const school  = _school(s);
  const markers = [
    s.ritual        ? `<span class="spreuk-tag" title="Ritueel">${icon('scroll-text')} Ritueel</span>` : '',
    s.concentration ? `<span class="spreuk-tag" title="Concentratie">${icon('eye')} Concentratie</span>` : '',
  ].filter(Boolean).join('');
  const nivKey = (s.level === 0) ? 'cantrip' : 'lvl';
  return `
    <div class="entity-card spreuk-card" onclick="window.spreuken.open('${esc(s.index)}')" title="${esc(s.name)}">
      <div class="card-accent bar-spreuken"></div>
      <span class="spreuk-card-niv spreuk-card-niv--${nivKey}">${_levelShort(s.level)}</span>
      <div class="card-img-wrap spreuk-card-img-wrap">
        <div class="spreuk-card-silhouet">${icon('sparkles')}</div>
        <img class="spreuk-card-img" src="${_imgUrl(s)}" alt="" loading="lazy"
          onload="this.classList.add('is-on')" onerror="this.remove()">
      </div>
      <div class="entity-card-body spreuk-card-body">
        <div class="spreuk-card-name">${esc(s.name)}</div>
        <div class="spreuk-card-meta">${esc(_levelLabel(s.level))}${school ? ` · ${esc(school)}` : ''}</div>
        ${markers ? `<div class="spreuk-card-tags">${markers}</div>` : ''}
      </div>
    </div>`;
}

// ── Filterbalk ──
function _filterBar() {
  const levels = ['<button class="spreuk-lvl-btn' + (_filters.level === null ? ' active' : '') +
    '" onclick="window.spreuken.setLevel(null)">Alle</button>'];
  for (let i = 0; i <= 9; i++) {
    levels.push(`<button class="spreuk-lvl-btn${_filters.level === i ? ' active' : ''}" onclick="window.spreuken.setLevel(${i})">${i === 0 ? 'C' : i}</button>`);
  }
  const klasOpts = ['<option value="">Alle klassen</option>']
    .concat(_classes.map(c => `<option value="${esc(c)}"${_filters.klasse === c ? ' selected' : ''}>${esc(c)}</option>`));
  return `
    <div class="spreuk-filters">
      <div class="spreuk-search">
        ${icon('search')}
        <input type="text" class="spreuk-search-input" placeholder="Zoek op naam…" value="${esc(_filters.q)}"
          oninput="window.spreuken.search(this.value)">
      </div>
      <select class="spreuk-class-select" onchange="window.spreuken.setKlasse(this.value)">${klasOpts.join('')}</select>
      <div class="spreuk-levels">${levels.join('')}</div>
    </div>`;
}

function _paintGrid() {
  const grid = document.getElementById('spreuk-grid');
  const count = document.getElementById('spreuk-count');
  if (!grid) return;
  const list = _filtered();
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'spreuk' : 'spreuken'}`;
  grid.innerHTML = list.length
    ? list.map(_card).join('')
    : `<p class="spreuk-empty">Geen spreuken gevonden.</p>`;
}

export async function renderSpreuken(container) {
  _container = container || document.getElementById('section-spreuken');
  if (!_container) return;
  _container.innerHTML = `<div class="spreuk-wrap"><p class="spreuk-loading">Spreuken laden…</p></div>`;
  await _load();
  if (window.app?.state?.activeSection !== 'spreuken') return; // tijdens laden gewisseld

  _container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--spreuken">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('sparkles')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Spreuken</div>
          <div class="section-banner-desc-line">De magische repository</div>
        </div>
        <div class="section-banner-search">
          <span class="results-count" id="spreuk-count"></span>
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="spreuk-wrap">
      ${_filterBar()}
      <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" id="spreuk-grid"></div>
    </div>`;
  _paintGrid();
}

// ── Detail-modal ──
function _detailHtml(s) {
  const school = _school(s);
  const rows = [
    ['Casting Time', s.casting_time],
    ['Range', s.range],
    ['Components', _components(s)],
    ['Duration', (s.duration || '') + (s.concentration ? ' (concentration)' : '')],
  ].filter(([, v]) => v && String(v).trim());
  const classes = _classNames(s);
  const desc   = _desc(s);
  const higher = _higher(s);
  const annot  = html => window.glossary?.annotate?.(html) ?? html;
  const mdToHtml = window.app?.mdToHtml || (t => esc(t).replace(/\n/g, '<br>'));
  return `
    <div class="spreuk-detail-card">
      <button class="spreuk-detail-close" onclick="window.spreuken.close()" title="Sluiten">${icon('x')}</button>
      <div class="spreuk-detail-head">
        <div class="spreuk-detail-title">${esc(s.name)}</div>
        <div class="spreuk-detail-sub">${esc(_levelLabel(s.level))}${school ? ` · ${esc(school)}` : ''}${s.ritual ? ' · Ritueel' : ''}</div>
      </div>
      <img class="spreuk-detail-img" src="${_imgUrl(s)}" alt=""
        onload="this.classList.add('is-on')" onerror="this.style.display='none'">
      ${isDM() ? `<button class="spreuk-detail-imgbtn dm-only" onclick="window.spreuken.setImage('${esc(s.index)}','${esc((s.name||'').replace(/'/g,''))}')">
        ${icon('image')} Afbeelding instellen</button>` : ''}
      <div class="spreuk-detail-props">
        ${rows.map(([l, v]) => `<div class="spreuk-detail-prop"><span class="spreuk-detail-prop-lbl">${esc(l)}</span><span>${esc(v)}</span></div>`).join('')}
      </div>
      ${desc   ? `<div class="spreuk-detail-desc">${annot(mdToHtml(desc))}</div>` : ''}
      ${higher ? `<div class="spreuk-detail-higher"><span class="spreuk-detail-higher-lbl">Op hoger niveau.</span> ${annot(mdToHtml(higher))}</div>` : ''}
      ${classes.length ? `<div class="spreuk-detail-classes">${classes.map(c => `<span class="spreuk-class-pill">${esc(c)}</span>`).join('')}</div>` : ''}
    </div>`;
}

function _ensureOverlay() {
  let ov = document.getElementById('spreuk-detail-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'spreuk-detail-overlay';
    ov.className = 'spreuk-detail-overlay';
    ov.addEventListener('click', e => { if (e.target === ov) window.spreuken.close(); });
    document.body.appendChild(ov);
  }
  return ov;
}

window.spreuken = {
  open(index) {
    const s = (_all || []).find(x => x.index === index);
    if (!s) return;
    const ov = _ensureOverlay();
    ov.innerHTML = _detailHtml(s);
    ov.classList.add('active');
  },
  close() {
    const ov = document.getElementById('spreuk-detail-overlay');
    if (ov) { ov.classList.remove('active'); ov.innerHTML = ''; }
  },
  search(v)    { _filters.q = v; _paintGrid(); },
  setLevel(lv) { _filters.level = lv; const b = document.getElementById('spreuk-grid'); if (b) { renderSpreuken(_container); } },
  setKlasse(k) { _filters.klasse = k || null; _paintGrid(); },
  // DM: kies/upload een afbeelding voor deze spreuk via de mediabibliotheek.
  setImage(index, naam) {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: (naam || 'spreuk').toLowerCase().replace(/\s+/g, '-'),
      onSelect: async (srcId) => {
        try {
          await fetch(`/api/files/spell-img-${index}/copy-from/${srcId}`, { method: 'POST', credentials: 'include' });
          // Detail + kaartje verversen
          const bust = '?t=' + Date.now();
          document.querySelectorAll(`.spreuk-detail-img, .spreuk-card-img[src^="/api/files/spell-img-${index}"]`)
            .forEach(img => { img.style.display = ''; img.src = `/api/files/spell-img-${index}${bust}`; });
          const ov = document.getElementById('spreuk-detail-overlay');
          const dimg = ov?.querySelector('.spreuk-detail-img');
          if (dimg) { dimg.style.display = ''; dimg.src = `/api/files/spell-img-${index}${bust}`; }
          _paintGrid();
        } catch (e) { console.error('Spreukafbeelding instellen mislukt:', e); }
      },
    });
  },
};
