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

import { api } from './api.js?v=279';

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
let _filters   = { q: '', level: null, klasse: null, school: null, ritual: false, concentratie: false, mijnKlasse: true };
let _classes   = [];
let _scholenOpen = false;    // staat de schoolrij uitgeklapt?
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
  const lees = async (u) => {
    try {
      const d = await fetch(u).then(r => r.json());
      return (d.results || d.spells || (Array.isArray(d) ? d : [])).filter(Boolean);
    } catch { return []; }
  };
  // De aanvullende lijst (Silvery Barbs, Tasha's Caustic Brew, …) hing alleen aan
  // de spreukenkiezer van de speler; in dit naslagwerk bestonden ze niet. Twee
  // plekken die iets anders "alle spreuken" noemen is er één te veel.
  const [basis, extra, eigenData] = await Promise.all([
    lees(url),
    _isHp() ? [] : lees('/api/bron/extra-spells'),
    // Wat deze campagne zelf verzon — plus de klassenlijst waar de editor uit kiest.
    fetch('/api/spreuken/eigen').then(r => r.json()).catch(() => ({})),
  ]);
  const eigen = eigenData?.results || [];
  if (Array.isArray(eigenData?.klassen) && eigenData.klassen.length) _EIG_KLASSEN = eigenData.klassen;
  const gezien = new Set(basis.map(s => s.index));
  // Alleen echte spreuken uit de bron: niet-spell-entries (magische voorwerpen)
  // hebben daar een lege school. Bij een eigen spreuk geldt die zeef níét — de
  // DM heeft hem zelf aangemaakt, en alleen de naam is verplicht; met de zeef
  // verdween een spreuk zonder school stilzwijgend uit de bibliotheek.
  _all = [
    ...basis.filter(s => _school(s)),
    ...extra.filter(s => !gezien.has(s.index) && _school(s)),
    ...eigen,
  ];
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

// ── Zoeken ──────────────────────────────────────────────────────────────────
// Deed een kale `name.includes(q)`: geen diakrieten, geen tweede woord, en niet
// in de school of de tekst. Bij 517 spreuken leverde "necromancy" of "fire
// damage" dus niets op. Dit zijn dezelfde drie bakken en dezelfde scores als op
// de kaartjes-tabbladen (`_searchScore` in render-campagne.js): hoe korter het
// woord, hoe strenger — één letter kijkt alleen naar het begin van de naam.
const _norm = s => window._normSearch?.(s) ?? String(s ?? '').toLowerCase();

function _hooibergen(s) {
  return {
    name: _norm(s.name),
    meta: _norm([_school(s), _levelLabel(s.level), ..._classNames(s),
                 _str(s.casting_time), _str(s.range), _str(s.duration), _components(s),
                 s.ritual ? 'ritual' : '', s.concentration ? 'concentration' : ''].join(' ')),
    rest: _norm(_desc(s) + ' ' + _higher(s)),
  };
}

function _score(s, tokens) {
  const h = _hooibergen(s);
  let totaal = 0;
  for (const t of tokens) {
    let best = 0;
    if (h.name === t) best = 1000;
    else if (h.name.startsWith(t)) best = 600;
    else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h.name)) best = 400;
    else if (t.length >= 2 && h.name.includes(t)) best = 250;
    else if (t.length >= 2 && h.meta.includes(t)) best = 120;
    else if (t.length >= 3 && h.rest.includes(t))  best = 60;
    if (best === 0) return -1;                 // dit woord komt nergens voor
    totaal += best;
  }
  return totaal;
}

function _filtered() {
  const tokens  = window._searchTokens?.(_filters.q) || [];
  const useMine = isPlayer() && _isCaster && _filters.mijnKlasse && _myClasses.length > 0;
  const scores  = new Map();
  const lijst = (_all || []).filter(s => {
    if (tokens.length) {
      const sc = _score(s, tokens);
      if (sc < 0) return false;
      scores.set(s.index, sc);
    }
    if (_filters.level !== null && Number(s.level) !== Number(_filters.level)) return false;
    if (_filters.school && _school(s) !== _filters.school) return false;
    if (_filters.ritual       && !s.ritual)        return false;
    if (_filters.concentratie && !s.concentration) return false;
    if (useMine) {
      if (!_myClasses.some(cEN => _matchClass(s, cEN))) return false;
    } else if (_filters.klasse && !_classNames(s).some(n => n === _filters.klasse)) {
      return false;
    }
    return true;
  });
  // Zoek je, dan bepaalt de relevantie de volgorde (anders staat een spreuk die
  // je naam alleen in zijn tekst noemt vóór de spreuk zelf); anders op niveau.
  return tokens.length
    ? lijst.sort((a, b) => (scores.get(b.index) - scores.get(a.index))
        || (a.level - b.level) || String(a.name).localeCompare(b.name))
    : lijst.sort((a, b) => (a.level - b.level) || String(a.name).localeCompare(b.name));
}

// ── Eén kaartje ──
// Een statcel is smal; "S, M (a melee weapon worth 1+ SP)" past er nooit in.
// Afkappen mag, maar dan hoort de hele tekst wel in de tooltip te staan.
function _statCell(label, val) {
  const v = String(val ?? '').trim();
  return v
    ? `<div class="spreuk-stat"><span class="spreuk-stat-lbl">${esc(label)}</span><span class="spreuk-stat-val" title="${esc(v)}">${esc(v)}</span></div>` : '';
}
function _card(s) {
  const school = _school(s);
  const col    = _schoolCol(school);
  const focus  = _focus(s);
  const markers = [
    s.source === 'eigen' ? `<span class="spreuk-tag spreuk-tag--eigen" title="Eigen spreuk van deze campagne">${icon('sparkles')} Eigen</span>` : '',
    s.ritual        ? `<span class="spreuk-tag" title="Ritual">${icon('scroll-text')} Ritual</span>` : '',
    s.concentration ? `<span class="spreuk-tag" title="Concentration">${icon('eye')} Concentration</span>` : '',
  ].filter(Boolean).join('');
  // "Concentration, up to 1 minute" én een aparte Concentration-tag eronder is
  // twee keer hetzelfde; op het kaartje volstaat de duur zonder het voorvoegsel.
  const duur = _str(s.duration).replace(/^concentration,\s*(up to\s*)?/i, '');
  const stats = [
    _statCell('Casting', s.casting_time), _statCell('Range', s.range),
    _statCell('Components', _components(s)), _statCell('Duration', duur),
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
  // De school stond wel groot op elk kaartje (met een eigen kleur) maar viel niet
  // te filteren, terwijl dat de indeling is waar een caster in denkt. Acht
  // scholen is wel een brede rij, dus die zit achter dezelfde trechterknop als
  // op de andere tabbladen — niveau, klasse en de twee eigenschappen staan er
  // altijd, want daar grijp je het vaakst naar.
  const scholen = [...new Set((_all || []).map(_school).filter(Boolean))].sort();
  const scholenUit = !_scholenOpen && !_filters.school;
  const schoolKnop = scholen.length ? `
    <button class="sf-toggle-btn${_filters.school ? ' sf-toggle-btn--active' : ''}" onclick="window.spreuken.toggleScholen()"
      title="Filter op school"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : '';
  const schoolRij = scholen.length ? `
    <div class="spreuk-scholen${scholenUit ? ' spreuk-scholen--dicht' : ''}">
      <button class="spreuk-school-btn${_filters.school ? '' : ' active'}" onclick="window.spreuken.setSchool(null)">Alle scholen</button>
      ${scholen.map(sc => {
        const c = _schoolCol(sc);
        return `<button class="spreuk-school-btn${_filters.school === sc ? ' active' : ''}"
          style="--school-c2:${c.c2}" onclick="window.spreuken.setSchool('${esc(sc)}')">${icon(c.icon)} ${esc(sc)}</button>`;
      }).join('')}
    </div>` : '';
  // Ritual en concentration stonden al als tag op het kaartje, maar je kon er
  // niet op filteren — terwijl "welke van mijn spreuken kosten concentratie?"
  // een vraag is die je aan tafel stelt.
  const eigenschappen = `
    <button class="spreuk-school-btn spreuk-eig-btn${_filters.ritual ? ' active' : ''}"
      onclick="window.spreuken.toggleEigenschap('ritual')" title="Alleen spreuken die als ritual gecast kunnen worden">${icon('scroll-text')} Ritual</button>
    <button class="spreuk-school-btn spreuk-eig-btn${_filters.concentratie ? ' active' : ''}"
      onclick="window.spreuken.toggleEigenschap('concentratie')" title="Alleen spreuken die concentration vragen">${icon('eye')} Concentration</button>`;
  return `
    <div class="spreuk-filters">
      <div class="spreuk-levels">${levels.join('')}</div>
      ${toggle}
      ${select}
      ${eigenschappen}
      ${schoolKnop}
      ${schoolRij}
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
        <!-- Zoekvak, boekje en + horen in dezelfde flexrij als op de andere
             tabbladen; het boekje hing hier in een eigen div met een losse
             marge, en de +-knop stond er daarna nóg eens naast. -->
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek spreuk…"
              value="${esc(_filters.q)}" oninput="window.spreuken.search(this.value)">
          </div>
          ${window._helpBtn?.('spreuken') ?? ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.spreuken.nieuw()" title="Eigen spreuk toevoegen">${icon('plus')}</button>` : ''}
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
      ${isDM() ? `<div class="spreuk-dm-knoppen">
        <button class="spreuk-detail-imgbtn dm-only" onclick="window.spreuken.setImage('${esc(s.index)}','${esc((s.name||'').replace(/'/g,''))}')">
          ${icon('image')} Afbeelding kiezen of uploaden</button>
        ${s.source === 'eigen' ? `
          <button class="spreuk-detail-imgbtn dm-only" onclick="window.spreuken.bewerk('${esc(s.index)}')">${icon('pencil')} Bewerken</button>
          <button class="spreuk-detail-imgbtn dm-only spreuk-btn-weg" onclick="window.spreuken.verwijder('${esc(s.index)}')">${icon('trash')} Verwijderen</button>` : ''}
      </div>
      <!-- Wie kent deze spreuk? Zelfde vraag als "wie heeft dit voorwerp" bij
           een kaartje; de administratie staat per speler, dus die halen we op. -->
      <div class="spreuk-wie" id="spreuk-wie-${esc(s.index)}"></div>` : ''}
      ${isPlayer() ? `<button class="spreuk-detail-addbtn${_myBook.has(s.index) ? ' is-added' : ''}" data-idx="${esc(s.index)}"
        onclick="window.spreuken.addToBook('${esc(s.index)}',this)">${icon(_myBook.has(s.index) ? 'check' : 'plus')} ${_myBook.has(s.index) ? 'In je spreukenboek' : 'Toevoegen aan mijn spreukenboek'}</button>` : ''}
      <div class="spreuk-detail-props">
        ${rows.map(([l, v]) => `<div class="spreuk-detail-prop"><span class="spreuk-detail-prop-lbl">${esc(l)}</span><span>${v}</span></div>`).join('')}
      </div>
      ${desc   ? `<div class="spreuk-detail-desc">${fmt(desc)}</div>` : ''}
      ${higher ? `<div class="spreuk-detail-higher"><span class="spreuk-detail-higher-lbl">At Higher Levels.</span> ${fmt(higher)}</div>` : ''}
      <!-- De overschrijf-tekst is er voor bróntekst; bij een eigen spreuk bewerk
           je gewoon de spreuk zelf, anders zijn er twee plekken met dezelfde tekst. -->
      ${isDM() && s.source !== 'eigen' ? `
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

// ── Eigen spreuk schrijven (DM) ─────────────────────────────────────────────
// Welke velden? Precies die van het bronformaat, niet meer en niet minder — dan
// hoeven kaartje, detailvenster, spreukenboek en het zoeken niets van een eigen
// spreuk te weten. Alleen de naam is verplicht; wat leeg blijft laat de server
// weg, zodat een korte spreuk geen rij lege regels krijgt.
const _EIG_SCHOLEN = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment',
                      'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
// De klassenlijst komt van de server: die telt de eigen klassen van de campagne
// mee (progression.json). De negen PHB-casters staan er altijd bij, en zolang de
// server nog niet geantwoord heeft is dat het vangnet.
let _EIG_KLASSEN = ['Artificer', 'Bard', 'Cleric', 'Druid', 'Paladin',
                    'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];

function _eigVeld(label, id, waarde, hint = '', breed = false) {
  return `
    <label class="spreuk-eig-veld${breed ? ' spreuk-eig-veld--breed' : ''}">
      <span class="spreuk-eig-lbl">${esc(label)}</span>
      <input id="${id}" value="${esc(waarde ?? '')}" placeholder="${esc(hint)}">
    </label>`;
}

function _eigFormHtml(s) {
  const comps = (s?.components || []).map(c => String(c).toUpperCase());
  const klassen = _classNames(s || {});
  // `desc` en `higher_level` zijn in de bron een lijst alinea's; in het
  // tekstvak worden dat lege regels ertussen. Bij een nieuwe spreuk is er
  // helemaal niets — vandaar één helper in plaats van een ternary op `s`.
  const alinea = v => Array.isArray(v) ? v.join('\n\n') : String(v ?? '');
  return `
    <div class="spreuk-detail-card spreuk-eig-form">
      <button class="spreuk-detail-close" onclick="window.spreuken.close()" title="Sluiten">${icon('x')}</button>
      <!-- Zelfde kop als de kaartjes-editor: handeling, dan de naam van wat je
           bewerkt. Uitleg hoort in het boekje, niet als grijze regel eronder. -->
      <div class="spreuk-detail-head">
        <div class="spreuk-detail-title">${s ? 'Spreuk bewerken' : 'Nieuwe spreuk'}${
          s ? ` <span class="spreuk-eig-naam">\u203a ${esc(s.name)}</span>` : ''}</div>
      </div>
      <div class="spreuk-eig-raster">
        ${_eigVeld('Naam', 'eig-name', s?.name, 'Vloek van de Vlasbaard', true)}
        <label class="spreuk-eig-veld">
          <span class="spreuk-eig-lbl">Level</span>
          <select id="eig-level">
            ${[0,1,2,3,4,5,6,7,8,9].map(i => `<option value="${i}"${Number(s?.level) === i ? ' selected' : ''}>${i === 0 ? 'Cantrip' : `Level ${i}`}</option>`).join('')}
          </select>
        </label>
        <label class="spreuk-eig-veld">
          <span class="spreuk-eig-lbl">School</span>
          <select id="eig-school">
            <option value="">— kies —</option>
            ${_EIG_SCHOLEN.map(sc => `<option${_school(s || {}) === sc ? ' selected' : ''}>${sc}</option>`).join('')}
          </select>
        </label>
        ${_eigVeld('Casting Time', 'eig-casting', s?.casting_time, 'Action')}
        ${_eigVeld('Range', 'eig-range', s?.range, '60 feet')}
        ${_eigVeld('Duration', 'eig-duration', s?.duration, 'Instantaneous')}
        ${_eigVeld('Damage', 'eig-damage', s?.damage, '2d6 fire')}
        <div class="spreuk-eig-veld spreuk-eig-veld--breed">
          <span class="spreuk-eig-lbl">Components</span>
          <div class="spreuk-eig-vinkjes">
            ${['V','S','M'].map(c => `<label><input type="checkbox" id="eig-comp-${c}"${comps.includes(c) ? ' checked' : ''}> ${c}</label>`).join('')}
            <input id="eig-material" class="spreuk-eig-mat" value="${esc(s?.material ?? '')}" placeholder="materiaal (bij M)">
          </div>
        </div>
        <div class="spreuk-eig-veld spreuk-eig-veld--breed">
          <span class="spreuk-eig-lbl">Eigenschappen</span>
          <div class="spreuk-eig-vinkjes">
            <label><input type="checkbox" id="eig-ritual"${s?.ritual ? ' checked' : ''}> Ritual</label>
            <label><input type="checkbox" id="eig-conc"${s?.concentration ? ' checked' : ''}> Concentration</label>
          </div>
        </div>
        <div class="spreuk-eig-veld spreuk-eig-veld--breed">
          <span class="spreuk-eig-lbl">Klassen</span>
          <div class="spreuk-eig-vinkjes">
            ${_EIG_KLASSEN.map(k => `<label><input type="checkbox" id="eig-kl-${k}"${klassen.includes(k) ? ' checked' : ''}> ${k}</label>`).join('')}
          </div>
        </div>
        <label class="spreuk-eig-veld spreuk-eig-veld--breed">
          <span class="spreuk-eig-lbl">Beschrijving</span>
          <textarea id="eig-desc" rows="7" placeholder="Wat doet de spreuk? Een lege regel begint een nieuwe alinea.">${esc(alinea(s?.desc))}</textarea>
        </label>
        <label class="spreuk-eig-veld spreuk-eig-veld--breed">
          <span class="spreuk-eig-lbl">At Higher Levels</span>
          <textarea id="eig-hoger" rows="3" placeholder="Wat verandert er met een hogere Spell Slot?">${esc(alinea(s?.higher_level))}</textarea>
        </label>
      </div>
      <div class="spreuk-eig-knoppen">
        <button class="spreuk-detail-imgbtn" onclick="window.spreuken.eigenOpslaan('${esc(s?.index || '')}')">${icon('save')} Opslaan</button>
        <button class="spreuk-detail-imgbtn" onclick="window.spreuken.close()">${icon('x')} Annuleren</button>
        <span class="spreuk-eigen-status" id="eig-status"></span>
      </div>
    </div>`;
}

function _eigLees() {
  const v = id => document.getElementById(id)?.value ?? '';
  const aan = id => !!document.getElementById(id)?.checked;
  return {
    name: v('eig-name').trim(),
    level: parseInt(v('eig-level'), 10) || 0,
    school: v('eig-school'),
    casting_time: v('eig-casting').trim(),
    range: v('eig-range').trim(),
    duration: v('eig-duration').trim(),
    damage: v('eig-damage').trim(),
    material: v('eig-material').trim(),
    components: ['V','S','M'].filter(c => aan(`eig-comp-${c}`)),
    ritual: aan('eig-ritual'),
    concentration: aan('eig-conc'),
    classes: _EIG_KLASSEN.filter(k => aan(`eig-kl-${k}`)),
    desc: v('eig-desc'),
    higher_level: v('eig-hoger'),
  };
}

// ── Wie kent deze spreuk? (DM) ──────────────────────────────────────────────
async function _wieLaden(index) {
  const host = document.getElementById(`spreuk-wie-${index}`);
  if (!host) return;
  let data = null;
  try { data = await api.spreukWie(index); } catch { host.innerHTML = ''; return; }
  const rijen = data?.spelers || [];
  if (!rijen.length) { host.innerHTML = `<div class="spreuk-wie-leeg">Niemand heeft deze spreuk in zijn boek.</div>`; return; }
  host.innerHTML = `
    <div class="spreuk-wie-kop">${icon('users')} Wie kent deze spreuk?</div>
    <div class="spreuk-wie-rijen">
      ${rijen.map(r => `
        <span class="spreuk-wie-rij">
          <span class="spreuk-wie-naam">${esc(r.naam)}</span>
          ${r.groep ? `<span class="spreuk-wie-groep">${esc(r.groep)}</span>` : ''}
          ${r.alwaysPrepared ? `<span class="spreuk-wie-merk" title="Altijd prepared">Always prepared</span>`
            : r.prepared ? `<span class="spreuk-wie-merk" title="Nu prepared">Prepared</span>` : ''}
          ${r.concentratie ? `<span class="spreuk-wie-merk spreuk-wie-merk--conc" title="Concentreert hier nu op">${icon('eye')} Actief</span>` : ''}
        </span>`).join('')}
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
  // De hele lijst, voor wie er zelf in wil zoeken (globaal zoeken).
  async alle() { if (!_all) await _load(); return _all || []; },
  // Kan ook aangeroepen worden vanuit een kaartje, en dan is de bibliotheek nog
  // niet geladen — dus eerst laden, dan tonen.
  async open(index) {
    if (!_all) await _load();
    const s = (_all || []).find(x => x.index === index);
    if (!s) return;
    const ov = _ensureOverlay();
    ov.innerHTML = _detailHtml(s);
    ov.classList.add('active');
    if (isDM()) _wieLaden(s.index);
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
  setSchool(sc) { _filters.school = sc || null; if (sc) _scholenOpen = true; _refreshFilterBar(); _paintGrid(); },
  toggleScholen() { _scholenOpen = !_scholenOpen; _refreshFilterBar(); },
  toggleEigenschap(welke) { _filters[welke] = !_filters[welke]; _refreshFilterBar(); _paintGrid(); },

  // ── Eigen spreuken (DM) ──
  nieuw() {
    const ov = _ensureOverlay();
    ov.innerHTML = _eigFormHtml(null);
    ov.classList.add('active');
  },
  bewerk(index) {
    const s = (_all || []).find(x => x.index === index);
    if (!s) return;
    const ov = _ensureOverlay();
    ov.innerHTML = _eigFormHtml(s);
    ov.classList.add('active');
  },
  async eigenOpslaan(index) {
    const body = _eigLees();
    const st = document.getElementById('eig-status');
    if (!body.name) { if (st) st.textContent = 'Geef de spreuk een naam.'; return; }
    if (st) st.textContent = 'Opslaan…';
    try {
      const bewaard = index ? await api.eigenSpreukOpslaan(index, body) : await api.eigenSpreukNieuw(body);
      _all = null;                       // lijst opnieuw ophalen: de spreuk is nieuw of veranderd
      await _load();
      _paintGrid();
      _refreshFilterBar();
      window.spreuken.open(bewaard.index);
    } catch (e) {
      if (st) st.textContent = 'Mislukt: ' + (e.message || 'onbekende fout');
    }
  },
  async verwijder(index) {
    const s = (_all || []).find(x => x.index === index);
    if (!confirm(`"${s?.name || 'Deze spreuk'}" verwijderen?\n\nHij verdwijnt uit de bibliotheek. Spelers die hem in hun boek hebben houden hun kopie.`)) return;
    await api.eigenSpreukWeg(index);
    _all = null;
    await _load();
    window.spreuken.close();
    _paintGrid();
    _refreshFilterBar();
  },
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
