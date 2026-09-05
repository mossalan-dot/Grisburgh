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

import { api } from './api.js?v=266';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();
const isPlayer = () => window.app?.state?.role === 'player' && !!window.app?.state?.characterId;
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
let _filters   = { q: '', level: null, klasse: null, mijnKlasse: true };
let _classes   = [];
let _myBook    = new Set(); // index-set van de spreuken in het eigen spreukenboek (speler)
let _myClasses = [];        // genormaliseerde EN-klassenamen van de speler
let _isCaster  = false;     // heeft de speler een klasse met spreuken?

// Matcht een spreuk op een (genormaliseerde) klassenaam; valt terug op eigen check.
function _matchClass(s, cEN) {
  return window.app?.spellMatchesClass?.(s, cEN)
    ?? _classNames(s).some(n => n.toLowerCase() === String(cEN).toLowerCase());
}

function _isHp() { return window.app?.state?.meta?.spellSource === 'wands-wizards'; }
function _focusMap() { return window.app?.state?.meta?.spellImageFocus || {}; }

async function _load() {
  if (_all) return _all;
  const url = _isHp() ? '/api/bron/hp-spells' : '/api/bron/spells-2024';
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
const _levelLabel = lv => (Number(lv) === 0) ? 'Cantrip' : `Level ${lv}`;
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
  const useMine = isPlayer() && _isCaster && _filters.mijnKlasse && _myClasses.length > 0;
  return (_all || []).filter(s => {
    if (q && !(s.name || '').toLowerCase().includes(q)) return false;
    if (_filters.level !== null && Number(s.level) !== Number(_filters.level)) return false;
    if (useMine) {
      if (!_myClasses.some(cEN => _matchClass(s, cEN))) return false;
    } else if (_filters.klasse && !_classNames(s).some(n => n === _filters.klasse)) {
      return false;
    }
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
    s.ritual        ? `<span class="spreuk-tag" title="Ritual">${icon('scroll-text')} Ritual</span>` : '',
    s.concentration ? `<span class="spreuk-tag" title="Concentration">${icon('eye')} Concentration</span>` : '',
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
      ${isPlayer() ? `<button class="spreuk-card-add${_myBook.has(s.index) ? ' is-added' : ''}" data-idx="${esc(s.index)}"
        onclick="event.stopPropagation();window.spreuken.addToBook('${esc(s.index)}',this)"
        title="${_myBook.has(s.index) ? 'Staat in je spreukenboek' : 'Toevoegen aan je spreukenboek'}">${icon(_myBook.has(s.index) ? 'check' : 'plus')}</button>` : ''}
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
  // Speler met spreuk-klasse(n): toggle "Alleen mijn klasse" (standaard aan).
  const toggle = _isCaster
    ? `<button class="spreuk-klasfilter${_filters.mijnKlasse ? ' active' : ''}" onclick="window.spreuken.toggleMijnKlasse()"
         title="Toon alleen spreuken van jouw klasse${_myClasses.length ? ` (${_myClasses.join(', ')})` : ''}">${icon('user')} Alleen mijn klasse</button>`
    : '';
  // De handmatige klasse-select is overbodig zolang "alleen mijn klasse" aan staat.
  const select = (_isCaster && _filters.mijnKlasse)
    ? ''
    : `<select class="spreuk-class-select" onchange="window.spreuken.setKlasse(this.value)">${klasOpts.join('')}</select>`;
  return `
    <div class="spreuk-filters">
      <div class="spreuk-levels">${levels.join('')}</div>
      ${toggle}
      ${select}
    </div>`;
}

// Herrender alleen de filterrij in-place (zonder profiel/boek opnieuw op te halen).
function _refreshFilterBar() {
  const fb = _container?.querySelector('.spreuk-filters');
  if (fb) fb.outerHTML = _filterBar();
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

  // Speler: huidig spreukenboek (markeren) + eigen klasse(n) (filter "alleen mijn klasse")
  _myBook = new Set(); _myClasses = []; _isCaster = false;
  if (isPlayer()) {
    const charId = window.app.state.characterId;
    try {
      const mine = await api.getPlayerSpells(charId);
      _myBook = new Set((mine || []).map(s => s.index));
    } catch { /* leeg = niets gemarkeerd */ }
    try {
      const prof = await api.getPlayerProfile(charId);
      const multiOn = prof?.multiclass === true || prof?.multiclass === 'true';
      _myClasses = [prof?.klasse, multiOn ? prof?.multiKlasse : null]
        .filter(Boolean)
        .map(c => window.app?.spellClassEN?.(c) || String(c).trim())
        .filter(Boolean);
      _isCaster = _myClasses.length > 0 && (_all || []).some(s => _myClasses.some(cEN => _matchClass(s, cEN)));
    } catch { /* geen klasse-info → toon alles */ }
    if (window.app?.state?.activeSection !== 'spreuken') return;
  }

  _container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--spreuken">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('sparkles')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Spreuken</div>
          <div class="section-banner-desc-line">Naslagwerk — alle spreuken die er bestaan, niet die van jou</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek spreuk…"
              value="${esc(_filters.q)}" oninput="window.spreuken.search(this.value)">
          </div>
        </div>
        <div style="margin-left:8px">${window._helpBtn?.('spreuken') ?? ''}</div>
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
  const diceColor = window.app?.sbDiceColor?.(s.damage);
  // Rijke spreuk-opmaak hergebruiken uit het spreukenboek: damage-getinte dice,
  // DC/saves/range-highlights, bullet-lijsten (- item) en tabellen. Valt terug op mdToHtml.
  // renderSpellDesc annoteert zelf al (glossary), dus geen extra annot() eromheen.
  // De SRD-teksten verwijzen naar andere spreuken met [[Wall of Force]]. Dat is
  // geen kaartje in het archief, dus de gewone wikilink-resolver kent hem niet
  // en liet de haken staan. Hier zoeken we in de spreukenlijst zelf: gevonden =
  // klikbaar, niet gevonden = gewoon de naam.
  const spreukLinks = (html) => String(html).replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_, naam, alias) => {
      const doel = (_all || []).find(x => (x.name || '').toLowerCase() === naam.trim().toLowerCase());
      const tekst = esc((alias || naam).trim());
      return doel
        ? `<a class="spreuk-verwijzing" onclick="window.spreuken.open('${esc(doel.index)}')" title="Open ${tekst}">${tekst}</a>`
        : tekst;
    });
  const fmt = (t) => spreukLinks(window.app?.renderSpellDesc
    ? window.app.renderSpellDesc(t, { diceColor })
    : annot((window.app?.mdToHtml || (x => esc(x).replace(/\n/g, '<br>')))(t)));
  return `
    <div class="spreuk-detail-card" style="--school-c1:${col.c1};--school-c2:${col.c2}">
      <button class="spreuk-detail-close" onclick="window.spreuken.close()" title="Sluiten">${icon('x')}</button>
      <div class="spreuk-detail-head">
        <div class="spreuk-detail-title">${esc(s.name)}</div>
        <div class="spreuk-detail-sub">${esc(_levelLabel(s.level))}${school ? ` · ${esc(school)}` : ''}${s.ritual ? ' · Ritual' : ''}</div>
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
      ${isPlayer() ? `<button class="spreuk-detail-addbtn${_myBook.has(s.index) ? ' is-added' : ''}" data-idx="${esc(s.index)}"
        onclick="window.spreuken.addToBook('${esc(s.index)}',this)">${icon(_myBook.has(s.index) ? 'check' : 'plus')} ${_myBook.has(s.index) ? 'In je spreukenboek' : 'Toevoegen aan mijn spreukenboek'}</button>` : ''}
      <div class="spreuk-detail-props">
        ${rows.map(([l, v]) => `<div class="spreuk-detail-prop"><span class="spreuk-detail-prop-lbl">${esc(l)}</span><span>${v}</span></div>`).join('')}
      </div>
      ${desc   ? `<div class="spreuk-detail-desc">${fmt(desc)}</div>` : ''}
      ${higher ? `<div class="spreuk-detail-higher"><span class="spreuk-detail-higher-lbl">At Higher Levels.</span> ${fmt(higher)}</div>` : ''}
      ${isDM() ? `
        <details class="spreuk-eigen" ${desc ? '' : 'open'}>
          <summary>${icon('pencil')} ${s._eigen ? 'Jouw beschrijving' : desc ? 'Eigen beschrijving schrijven' : 'Beschrijving invullen'}</summary>
          <p class="spreuk-eigen-hint">Vervangt de tekst hierboven — jouw spelers zien alleen wat jij hier schrijft. Maak je het veld leeg, dan komt de oorspronkelijke tekst terug.</p>
          <textarea class="spreuk-eigen-tekst" id="spreuk-eigen-${esc(s.index)}" rows="6"
            placeholder="Wat doet deze spreuk aan jouw tafel?">${esc(s._eigen ? desc : '')}</textarea>
          <button class="spreuk-detail-imgbtn" onclick="window.spreuken.saveTekst('${esc(s.index)}')">
            ${icon('save')} Beschrijving opslaan</button>
          <span class="spreuk-eigen-status" id="spreuk-eigen-status-${esc(s.index)}"></span>
        </details>` : ''}
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
    // Inline dice-notatie (damage-getint) → klik om te gooien, net als in het spreukenboek.
    ov.addEventListener('click', e => {
      const dice = e.target.closest('.sb-hl-dice');
      if (dice) { e.stopPropagation(); window._sbFlashRoll?.(dice.textContent.trim(), ''); }
    });
    document.body.appendChild(ov);
  }
  return ov;
}

// Werk de add-knoppen (kaart + detail) van één spreuk bij naar de "toegevoegd"-staat.
function _markAdded(index) {
  const sel = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(index) : index;
  document.querySelectorAll(`.spreuk-card-add[data-idx="${sel}"]`).forEach(b => {
    b.classList.add('is-added'); b.innerHTML = icon('check'); b.title = 'Staat in je spreukenboek';
  });
  document.querySelectorAll(`.spreuk-detail-addbtn[data-idx="${sel}"]`).forEach(b => {
    b.classList.add('is-added'); b.innerHTML = `${icon('check')} In je spreukenboek`;
  });
}

window.spreuken = {
  // Kan ook aangeroepen worden vanuit een kaartje, en dan is de bibliotheek nog
  // niet geladen — dus eerst laden, dan tonen.
  async open(index) {
    if (!_all) await _load();
    const s = (_all || []).find(x => x.index === index);
    if (!s) return;
    const ov = _ensureOverlay();
    ov.innerHTML = _detailHtml(s);
    ov.classList.add('active');
  },
  // Naam + school van een spreuk, voor chips op een kaartje.
  async info(indexen) {
    if (!_all) await _load();
    const set = new Set(indexen || []);
    return (_all || []).filter(s => set.has(s.index))
      .map(s => ({ index: s.index, name: s.name, level: s.level, school: _school(s) }));
  },
  // DM: eigen beschrijving bij een spreuk. Buiten Grisburgh komen de spreuken
  // kaal binnen (naam, niveau, school, tijden) en vult de DM de tekst zelf —
  // zie lib/bronnen.js.
  async saveTekst(index) {
    const ta = document.getElementById(`spreuk-eigen-${index}`);
    if (!ta) return;
    try {
      const r = await api.setSpreukTekst(index, ta.value);
      const s = (_all || []).find(x => x.index === index);
      if (s) { s.desc = r.desc; s._eigen = !!r.desc.length; }
      const st = document.getElementById(`spreuk-eigen-status-${index}`);
      if (st) st.textContent = r.desc.length ? '✓ Opgeslagen' : '✓ Gewist';
      setTimeout(() => window.spreuken.open(index), 700);
    } catch (e) {
      const st = document.getElementById(`spreuk-eigen-status-${index}`);
      if (st) st.textContent = 'Fout: ' + e.message;
    }
  },
  // Speler: voeg deze spreuk toe aan het eigen spreukenboek (server dedupliceert op index).
  async addToBook(index, btn) {
    const charId = window.app?.state?.characterId;
    if (!charId || _myBook.has(index)) return;
    const s = (_all || []).find(x => x.index === index);
    if (!s) return;
    const payload = {
      index: s.index, name: s.name,
      level:  s.level || 0,
      school: _school(s),
      source: s.source || (_isHp() ? 'hp' : 'phb2024'),
      desc:   _desc(s),
      casting_time: s.casting_time || '',
      range:        s.range || '',
      duration:     s.duration || '',
      components:   _components(s),
      concentration: !!s.concentration || /concentration/i.test(String(s.duration || '')),
      ritual:        !!s.ritual,
      damage:        s.damage || '',
    };
    if (btn) btn.disabled = true;
    try {
      await api.addPlayerSpell(charId, payload);
      _myBook.add(index);
      _markAdded(index);
    } catch (e) {
      console.error('Spell toevoegen aan spreukenboek mislukt:', e);
      if (btn) btn.disabled = false;
    }
  },
  close() {
    const ov = document.getElementById('spreuk-detail-overlay');
    if (ov) { ov.classList.remove('active'); ov.innerHTML = ''; }
  },
  search(v)    { _filters.q = v; _paintGrid(); },
  setLevel(lv) { _filters.level = lv; _refreshFilterBar(); _paintGrid(); },
  setKlasse(k) { _filters.klasse = k || null; _paintGrid(); },
  // Toggle "Alleen mijn klasse" (speler) — herrendert filterrij + grid, geen herfetch.
  toggleMijnKlasse() {
    _filters.mijnKlasse = !_filters.mijnKlasse;
    if (_filters.mijnKlasse) _filters.klasse = null; // handmatige klasse-keuze resetten
    _refreshFilterBar();
    _paintGrid();
  },
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
