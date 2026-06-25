/**
 * render-spreuken.js — Archief-tab "Spreuken": een doorzoekbare spreukenbibliotheek.
 *
 * Read-only browser over de lokale spreukenbron (`spells-2024.json`, of
 * `hp-spells.json` voor wands-wizards). Kaartjes tonen naam, niveau, school +
 * kernstats (casting time, range, components, duration) en de door de DM ingestelde
 * spreukafbeelding (met focuspunt) indien aanwezig. Klik → volledig detail.
 * De DM kan een afbeelding kiezen (mediabibliotheek) en het focuspunt instellen.
 *
 * Kaartjes hergebruiken de `.entity-card`-opmaak; de schoolkleuren komen overeen
 * met die van het spreukenboek (_SB_SCHOOLS in app.js).
 */

import { api } from './api.js?v=243';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();
const annot = html => (window.glossary?.annotate?.(html) ?? html);

// Schoolkleuren + -icoon — gelijk aan _SB_SCHOOLS in het spreukenboek (app.js).
const _SCHOOLS = {
  abjuration:    { c1: '#0c2248', c2: '#1e4a8a', icon: 'shield'     },
  conjuration:   { c1: '#0a3020', c2: '#1a6a50', icon: 'sparkles'   },
  divination:    { c1: '#200c4e', c2: '#5a2e8a', icon: 'eye'        },
  enchantment:   { c1: '#4a082e', c2: '#962058', icon: 'heart'      },
  evocation:     { c1: '#4a1000', c2: '#a03810', icon: 'zap'        },
  illusion:      { c1: '#150848', c2: '#441892', icon: 'moon'       },
  necromancy:    { c1: '#040c06', c2: '#142e14', icon: 'skull'      },
  transmutation: { c1: '#301800', c2: '#7a4a08', icon: 'refresh-cw' },
};
const _SCHOOL_DEFAULT = { c1: '#3a2a55', c2: '#5a3a8c', icon: 'sparkles' };
function _schoolCol(school) { return _SCHOOLS[(school || '').toLowerCase()] || _SCHOOL_DEFAULT; }

// Klassekleuren voor de pills.
const _CLASS_COL = {
  Artificer: '#9a6a2a', Bard: '#a8327a', Cleric: '#b8860b', Druid: '#3a7a30',
  Paladin: '#c0a020', Ranger: '#4a7a3a', Sorcerer: '#b03020', Warlock: '#6a3a9a',
  Wizard: '#2a5a8a', Fighter: '#7a3020', Barbarian: '#8a3a10', Monk: '#2a7a6a', Rogue: '#444',
};

let _all       = null;      // null = nog niet geladen
let _container = null;
let _filters   = { q: '', level: null, klasse: null };
let _classes   = [];

function _isHp() { return window.app?.state?.meta?.spellSource === 'wands-wizards'; }
function _focusMap() { return window.app?.state?.meta?.spellImageFocus || {}; }

async function _load() {
  if (_all) return _all;
  const url = _isHp() ? '/data/hp-spells.json' : '/data/spells-2024.json';
  try {
    const d = await fetch(url).then(r => r.json());
    const raw = (d.results || d.spells || (Array.isArray(d) ? d : [])).filter(Boolean);
    // Alleen echte spreuken: niet-spell-entries (magische voorwerpen) hebben een lege school.
    _all = raw.filter(s => _school(s));
  } catch { _all = []; }
  const set = new Set();
  for (const s of _all) for (const c of _classNames(s)) set.add(c);
  _classes = [...set].sort();
  return _all;
}

// ── Helpers (defensief: alles → string) ──
const _str = v => Array.isArray(v) ? v.filter(x => typeof x !== 'object').join('\n\n')
  : (v && typeof v === 'object' ? '' : (v ?? ''));
const _levelLabel = lv => (Number(lv) === 0) ? 'Cantrip' : `Niveau ${lv}`;
const _levelShort = lv => (Number(lv) === 0) ? 'C' : String(lv);
function _school(s)     { return (s?.school?.name || (typeof s?.school === 'string' ? s.school : '') || '').trim(); }
function _classNames(s) { return (s.classes || []).map(c => c.name || c).filter(Boolean); }
function _desc(s)       { return _str(s.desc); }
function _higher(s)     { return _str(s.higher_level); }
function _components(s) {
  const c = (s.components || []).filter(x => typeof x === 'string').join(', ');
  return c + (s.material ? ` (${_str(s.material)})` : '');
}
// Componenten met lexicon-tooltips op V/S/M (alleen voor de detailweergave → HTML).
const _COMP_TIP = {
  V: 'Verbal (V): you must be able to speak to cast the spell.',
  S: 'Somatic (S): you must have a free hand to perform the spell’s gestures.',
  M: 'Material (M): you need the listed materials (or a component pouch / spellcasting focus) to cast the spell.',
};
function _componentsHtml(s) {
  const parts = (s.components || []).filter(x => typeof x === 'string').map(c => {
    const tip = _COMP_TIP[c.toUpperCase().trim()];
    return tip ? `<span class="sb-gloss" data-tip="${esc(tip)}">${esc(c)}</span>` : esc(c);
  });
  let html = parts.join(', ');
  if (s.material) html += ` (${esc(_str(s.material))})`;
  return html;
}
function _imgUrl(s)     { return `/api/files/spell-img-${s.index}`; }
function _focus(s)      { return _focusMap()[s.index] || ''; }

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
function _statCell(label, val) {
  return val && String(val).trim()
    ? `<div class="spreuk-stat"><span class="spreuk-stat-lbl">${esc(label)}</span><span class="spreuk-stat-val">${esc(val)}</span></div>` : '';
}
function _card(s) {
  const school = _school(s);
  const col    = _schoolCol(school);
  const focus  = _focus(s);
  const markers = [
    s.ritual        ? `<span class="spreuk-tag" title="Ritueel">${icon('scroll-text')} Ritueel</span>` : '',
    s.concentration ? `<span class="spreuk-tag" title="Concentratie">${icon('eye')} Concentratie</span>` : '',
  ].filter(Boolean).join('');
  const stats = [
    _statCell('Casting', s.casting_time), _statCell('Range', s.range),
    _statCell('Components', _components(s)), _statCell('Duration', s.duration),
  ].join('');
  return `
    <div class="entity-card spreuk-card" onclick="window.spreuken.open('${esc(s.index)}')" title="${esc(s.name)}"
      style="--school-c1:${col.c1};--school-c2:${col.c2}">
      <div class="card-accent bar-spreuken"></div>
      <span class="spreuk-card-niv">${_levelShort(s.level)}</span>
      <div class="card-img-wrap spreuk-card-img-wrap">
        <div class="spreuk-card-silhouet">${icon(col.icon)}</div>
        <img class="spreuk-card-img" src="${_imgUrl(s)}" alt="" loading="lazy"
          style="${focus ? `object-position:${esc(focus)}` : ''}"
          onload="this.classList.add('is-on')" onerror="this.remove()">
      </div>
      <div class="entity-card-body spreuk-card-body">
        <div class="spreuk-card-name">${esc(s.name)}</div>
        <div class="spreuk-card-meta">${esc(_levelLabel(s.level))}${school ? ` · ${esc(school)}` : ''}</div>
        ${stats ? `<div class="spreuk-stats">${stats}</div>` : ''}
        ${markers ? `<div class="spreuk-card-tags">${markers}</div>` : ''}
      </div>
    </div>`;
}

// ── Filterrij (niveau + klasse) ──
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
      <div class="spreuk-levels">${levels.join('')}</div>
      <select class="spreuk-class-select" onchange="window.spreuken.setKlasse(this.value)">${klasOpts.join('')}</select>
    </div>`;
}

function _paintGrid() {
  const grid = document.getElementById('spreuk-grid');
  if (!grid) return;
  const list = _filtered();
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
          <div class="section-banner-desc-line">De magische bibliotheek</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek spreuk…"
              value="${esc(_filters.q)}" oninput="window.spreuken.search(this.value)">
          </div>
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="spreuk-wrap">
      ${_filterBar()}
      <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4" id="spreuk-grid"></div>
    </div>`;
  _paintGrid();
}

// ── Detail-modal ──
function _detailHtml(s) {
  const school = _school(s);
  const col    = _schoolCol(school);
  const focus  = _focus(s);
  // Waarden zijn al HTML (geannoteerd / componenten met V/S/M-tooltips).
  const rows = [
    ['Casting Time', annot(esc(_str(s.casting_time)))],
    ['Range', annot(esc(_str(s.range)))],
    ['Components', _componentsHtml(s)],
    ['Duration', annot(esc(_str(s.duration) + (s.concentration ? ' (concentration)' : '')))],
  ].filter(([, v]) => v && v.replace(/<[^>]*>/g, '').trim());
  const classes = _classNames(s);
  const desc    = _desc(s);
  const higher  = _higher(s);
  const mdToHtml = window.app?.mdToHtml || (t => esc(t).replace(/\n/g, '<br>'));
  return `
    <div class="spreuk-detail-card" style="--school-c1:${col.c1};--school-c2:${col.c2}">
      <button class="spreuk-detail-close" onclick="window.spreuken.close()" title="Sluiten">${icon('x')}</button>
      <div class="spreuk-detail-head">
        <div class="spreuk-detail-title">${esc(s.name)}</div>
        <div class="spreuk-detail-sub">${esc(_levelLabel(s.level))}${school ? ` · ${esc(school)}` : ''}${s.ritual ? ' · Ritueel' : ''}</div>
      </div>
      <div class="spreuk-detail-imgwrap">
        <img class="spreuk-detail-img" id="spreuk-detail-img" src="${_imgUrl(s)}" alt=""
          data-index="${esc(s.index)}" style="${focus ? `object-position:${esc(focus)}` : ''}"
          onload="this.classList.add('is-on'); window.spreuken._imgReady(true)" onerror="this.classList.remove('is-on'); window.spreuken._imgReady(false)"
          ${isDM() ? `onclick="window.spreuken.setFocus(event)"` : ''}>
        ${isDM() ? `<span class="spreuk-focus-hint" id="spreuk-focus-hint">Klik op de afbeelding om het focuspunt te kiezen</span>` : ''}
      </div>
      ${isDM() ? `<button class="spreuk-detail-imgbtn dm-only" onclick="window.spreuken.setImage('${esc(s.index)}','${esc((s.name||'').replace(/'/g,''))}')">
        ${icon('image')} Afbeelding kiezen of uploaden</button>` : ''}
      <div class="spreuk-detail-props">
        ${rows.map(([l, v]) => `<div class="spreuk-detail-prop"><span class="spreuk-detail-prop-lbl">${esc(l)}</span><span>${v}</span></div>`).join('')}
      </div>
      ${desc   ? `<div class="spreuk-detail-desc">${annot(mdToHtml(desc))}</div>` : ''}
      ${higher ? `<div class="spreuk-detail-higher"><span class="spreuk-detail-higher-lbl">Op hoger niveau.</span> ${annot(mdToHtml(higher))}</div>` : ''}
      ${classes.length ? `<div class="spreuk-detail-classes">${classes.map(c => {
        const cc = _CLASS_COL[c] || '#5a3a8c';
        return `<span class="spreuk-class-pill" style="--class-c:${cc}">${esc(c)}</span>`;
      }).join('')}</div>` : ''}
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
  setLevel(lv) { _filters.level = lv; renderSpreuken(_container); },
  setKlasse(k) { _filters.klasse = k || null; _paintGrid(); },
  // Toont/verbergt de focus-hint afhankelijk van of er een afbeelding is.
  _imgReady(ok) {
    const hint = document.getElementById('spreuk-focus-hint');
    if (hint) hint.style.display = ok ? '' : 'none';
  },
  // DM: kies/upload een afbeelding voor deze spreuk via de mediabibliotheek.
  setImage(index, naam) {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: (naam || 'spreuk').toLowerCase().replace(/\s+/g, '-'),
      onSelect: async (srcId) => {
        try {
          await fetch(`/api/files/spell-img-${index}/copy-from/${srcId}`, { method: 'POST', credentials: 'include' });
          const bust = '?t=' + Date.now();
          const dimg = document.getElementById('spreuk-detail-img');
          if (dimg) { dimg.classList.remove('is-on'); dimg.src = `/api/files/spell-img-${index}${bust}`; }
          _paintGrid();
        } catch (e) { console.error('Spreukafbeelding instellen mislukt:', e); }
      },
    });
  },
  // DM: klik op de afbeelding zet het focuspunt (object-position) en bewaart het.
  async setFocus(ev) {
    const img = ev.currentTarget;
    const index = img.dataset.index;
    const r = img.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100)));
    const focus = `${x}% ${y}%`;
    img.style.objectPosition = focus;
    try {
      await fetch(`/api/meta/spell-image-focus/${index}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ focus }),
      });
      // Client-side meta bijwerken zodat kaartjes het focuspunt overnemen
      const meta = window.app?.state?.meta;
      if (meta) { meta.spellImageFocus = meta.spellImageFocus || {}; meta.spellImageFocus[index] = focus; }
      const cardImg = document.querySelector(`.spreuk-card-img[src^="/api/files/spell-img-${index}"]`);
      if (cardImg) cardImg.style.objectPosition = focus;
    } catch (e) { console.error('Focuspunt opslaan mislukt:', e); }
  },
};
