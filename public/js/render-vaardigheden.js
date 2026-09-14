/**
 * render-vaardigheden.js — Archief-tab "Vaardigheden": alles wat een personage kán.
 *
 * Class features, subclass features, species traits, feats, epic boons en
 * backgrounds, doorzoekbaar als bibliotheek. De progressie-tab toont dezelfde
 * dingen, maar alleen langs de tijdlijn van één personage: je ziet er pas iets
 * als jouw level het ontsluit. Juist bij het kíézen (welke feat neem ik op 4?)
 * wil je ze alle zestig naast elkaar — vandaar deze tab.
 *
 * Zelfde machinerie als de spreukenbibliotheek: dezelfde drie zoekbakken
 * (naam / korte velden / tekst), een permanent open filterbalk en `.entity-card`
 * als kaartje. De teksten komen uit `naslagBron()` in render-progressie.js, dus
 * er is één plek die weet waar een beschrijving vandaan komt: eerst wat de DM
 * zelf schreef, dan de SRD, en anders een verwijzing naar buiten.
 */

import { naslagBron } from './render-progressie.js?v=46';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);

// De zes soorten, elk met een eigen kleur en icoon — dezelfde rol als de
// scholen bij de spreuken: de indeling waarin je zoekt.
const SOORTEN = {
  class:      { label: 'Class',     icon: 'sword',          c1: '#4a1000', c2: '#a03810' },
  subclass:   { label: 'Subclass',  icon: 'star',           c1: '#200c4e', c2: '#5a2e8a' },
  species:    { label: 'Species',   icon: 'user',           c1: '#0a3020', c2: '#1a6a50' },
  feat:       { label: 'Feat',      icon: 'zap',            c1: '#0c2248', c2: '#1e4a8a' },
  boon:       { label: 'Epic Boon', icon: 'sparkles',       c1: '#301800', c2: '#7a4a08' },
  background: { label: 'Background',icon: 'scroll-text',    c1: '#4a082e', c2: '#962058' },
};
// Een icoon per class en per species. De soort bepaalt de kleur van het
// kaartje (dat is waar het filter op staat), het icoon zegt wáárvan het is —
// een Barbarian-feature hoort er anders uit te zien dan een Wizard-feature.
// Alles komt uit de bestaande sprite; er is niets bij getekend.
const KLASSE_ICOON = {
  Barbarian: 'crossed-swords', Bard: 'music',    Cleric: 'church',
  Druid: 'tree-pine',      Fighter: 'swords',    Monk: 'hand',
  Paladin: 'shield-plus',  Ranger: 'target',     Rogue: 'stiletto',
  Sorcerer: 'flame',       Warlock: 'eye',       Wizard: 'book-open',
  Artificer: 'hammer',
};
const SPECIES_ICOON = {
  Human: 'user',        Elf: 'sparkle',       Dwarf: 'pickaxe',
  Halfling: 'house',    Dragonborn: 'flame',  Gnome: 'flask-conical',
  Orc: 'shield-half',   Tiefling: 'ghost',    Goliath: 'mountain',
  Aasimar: 'sparkles',  Aarakocra: 'wind',    Tabaxi: 'paw-print',
  'Half-Elf': 'users',
};
// Het icoon van één regel: klasse of species als we die kennen, anders het
// icoon van de soort.
function _itemIcoon(it) {
  if (it.soort === 'class' || it.soort === 'subclass') return KLASSE_ICOON[it.bron] || SOORTEN[it.soort].icon;
  if (it.soort === 'species') return SPECIES_ICOON[it.bron] || SOORTEN.species.icon;
  return SOORTEN[it.soort]?.icon || 'hexagon';
}

const SOORT_VOLGORDE = ['class', 'subclass', 'species', 'feat', 'boon', 'background'];

let _all        = null;   // null = nog niet geladen
let _bron       = null;   // wat naslagBron() teruggaf (srdDesc, md, …)
let _container  = null;
let _filters    = { q: '', soort: null, bron: null, level: null };
let _bronnen    = [];     // klassen, soorten en backgrounds die er zijn
let _levelsOpen = false;  // staat de levelrij uitgeklapt?

// ── Laden ─────────────────────────────────────────────────────────
// Eén platte lijst: elk item weet zijn soort, waar het bij hoort en op welk
// level het komt. Dat is alles wat het kaartje, het filter en het zoeken nodig
// hebben; de detailweergave haalt de tekst pas op als je erop klikt.
async function _load() {
  if (_all) return _all;
  _bron = await naslagBron();
  const prog = _bron.prog || {};
  const uit  = [];
  const zet = (o) => { uit.push({ ...o, key: `${o.soort}|${o.bron}|${o.level}|${o.naam}` }); };

  for (const [klasse, data] of Object.entries(prog.classes || {})) {
    for (const [lvl, fs] of Object.entries(data.levels || {})) {
      for (const f of (fs || [])) zet({ soort: 'class', bron: klasse, level: Number(lvl), naam: f.name, desc: f.desc || '' });
    }
    for (const [sub, sdata] of Object.entries(data.subclasses || {})) {
      for (const [lvl, fs] of Object.entries(sdata.levels || {})) {
        for (const f of (fs || [])) zet({ soort: 'subclass', bron: klasse, sub, level: Number(lvl), naam: f.name, desc: f.desc || '' });
      }
    }
  }
  for (const [soort, data] of Object.entries(prog.species || {})) {
    for (const [lvl, fs] of Object.entries(data.levels || {})) {
      for (const f of (fs || [])) zet({ soort: 'species', bron: soort, level: Number(lvl), naam: f.name, desc: f.desc || '' });
    }
  }
  for (const f of (_bron.feats?.general || [])) zet({ soort: 'feat', bron: 'Feats',      level: 0, naam: f.name, desc: f.desc || '' });
  for (const f of (_bron.feats?.epic    || [])) zet({ soort: 'boon', bron: 'Epic Boons', level: 0, naam: f.name, desc: f.desc || '' });
  // Een background is één ding met vijf onderdelen (Ability Scores, Feat,
  // Skill Proficiencies, Tool Proficiency, Equipment). Als losse kaartjes krijg
  // je zestien keer "Ability Scores" in de lijst; als één kaartje per background
  // zoek je waar je op zoekt — de naam van de achtergrond.
  for (const [bg, data] of Object.entries(_bron.backgrounds || {})) {
    const delen = Object.values(data.levels || {}).flat().filter(Boolean);
    if (!delen.length) continue;
    zet({
      soort: 'background', bron: 'Backgrounds', level: 0, naam: bg,
      desc: delen.map(f => `**${f.name}.** ${f.desc || ''}`.trim()).join('\n\n'),
    });
  }

  // Dezelfde feature staat bij een multiklasse-campagne soms twee keer; de
  // eerste wint, maar een gelijknamige feature van een ándere klasse blijft
  // staan (Wizards Spellcasting is niet die van de Cleric).
  const gezien = new Set();
  _all = uit.filter(x => { if (gezien.has(x.key)) return false; gezien.add(x.key); return true; });
  _bronnen = [...new Set(_all.map(x => x.bron))].sort();
  return _all;
}

// De tekst zoals hij getoond wordt: eerst wat de campagne zelf schreef, dan de
// SRD. Blijft het leeg, dan mág de tekst hier niet staan — dan verwijzen we.
const _schoonTekst = t => String(t ?? '').replace(/([a-z])-\s+([a-z])/g, '$1$2');
function _tekst(it) {
  return _schoonTekst(it.desc || _bron?.srdDesc?.(it.naam, it.soort === 'subclass' ? it.sub : it.bron) || _bron?.srdDesc?.(it.naam) || '');
}

// ── Zoeken ────────────────────────────────────────────────────────
// Zelfde drie bakken en dezelfde scores als bij de spreuken en de kaartjes:
// een treffer in de naam telt zwaarder dan een in de beschrijving.
function _hooibergen(it) {
  if (!it._h) {
    it._h = {
      name: (it.naam || '').toLowerCase(),
      meta: [it.bron, it.sub, SOORTEN[it.soort]?.label, it.level ? `level ${it.level}` : ''].filter(Boolean).join(' ').toLowerCase(),
      rest: _tekst(it).toLowerCase(),
    };
  }
  return it._h;
}

function _score(it, tokens) {
  const h = _hooibergen(it);
  let totaal = 0;
  for (const t of tokens) {
    let best = 0;
    if (h.name === t) best = 1000;
    else if (h.name.startsWith(t)) best = 600;
    else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h.name)) best = 400;
    else if (t.length >= 2 && h.name.includes(t)) best = 250;
    else if (t.length >= 2 && h.meta.includes(t)) best = 120;
    else if (t.length >= 3 && h.rest.includes(t)) best = 60;
    if (best === 0) return -1;
    totaal += best;
  }
  return totaal;
}

function _filtered() {
  const tokens = window._searchTokens?.(_filters.q) || [];
  const scores = new Map();
  const lijst = (_all || []).filter(it => {
    if (tokens.length) {
      const sc = _score(it, tokens);
      if (sc < 0) return false;
      scores.set(it.key, sc);
    }
    if (_filters.soort && it.soort !== _filters.soort) return false;
    if (_filters.bron  && it.bron  !== _filters.bron)  return false;
    if (_filters.level !== null && Number(it.level) !== Number(_filters.level)) return false;
    return true;
  });
  // Zolang je zoekt is relevantie de volgorde; daarna soort → bron → level → naam.
  if (tokens.length) return lijst.sort((a, b) => (scores.get(b.key) || 0) - (scores.get(a.key) || 0));
  return lijst.sort((a, b) =>
    SOORT_VOLGORDE.indexOf(a.soort) - SOORT_VOLGORDE.indexOf(b.soort) ||
    a.bron.localeCompare(b.bron) || a.level - b.level || a.naam.localeCompare(b.naam));
}

// Waar iets bij hoort. Bij een feat, een Epic Boon of een background zegt de
// bron hetzelfde als de soort ("Feat · Feats") — dan laten we hem weg.
const _EIGEN_BRON = new Set(['Feats', 'Epic Boons', 'Backgrounds']);
function _bronRegel(it) {
  if (it.soort === 'subclass') return `${it.sub} · ${it.bron}`;
  return _EIGEN_BRON.has(it.bron) ? '' : it.bron;
}

// ── Kaartje ───────────────────────────────────────────────────────
function _card(it) {
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const tekst = _tekst(it);
  const bronRegel = _bronRegel(it);
  // Staat de tekst er niet, dan hoeft de kijker het kaartje daar niet eerst
  // voor te openen — zelfde regel als bij de spreuken.
  const link = tekst ? '' : (window.app?.bronLink?.(it.naam, 'features') || '');
  return `
    <div class="entity-card vaardig-card" onclick="window.vaardigheden.open('${esc(it.key)}')" title="${esc(it.naam)}"
      style="--soort-c1:${s.c1};--soort-c2:${s.c2}">
      <div class="card-accent vaardig-accent"></div>
      ${it.level ? `<span class="vaardig-card-niv">${it.level}</span>` : ''}
      <div class="card-img-wrap vaardig-card-img-wrap">
        <div class="vaardig-card-silhouet">${icon(_itemIcoon(it))}</div>
      </div>
      <div class="entity-card-body vaardig-card-body">
        <div class="vaardig-card-name">${esc(it.naam)}</div>
        ${(() => {
          // De soort staat al als chip op het kaartje; deze regel zegt waar het
          // bij hoort. Is er niets te zeggen (een feat hoort nergens bij), dan
          // ook geen lege regel.
          const meta = [esc(bronRegel), it.level ? `level ${it.level}` : ''].filter(Boolean).join(' · ');
          return meta ? `<div class="vaardig-card-meta">${meta}</div>` : '';
        })()}
        <div class="vaardig-card-tags">
          <span class="spreuk-tag vaardig-tag--soort">${icon(s.icon)} ${esc(s.label)}</span>
          ${link ? `<a class="spreuk-tag spreuk-tag--naslag" href="${esc(link)}" target="_blank" rel="noopener"
            onclick="event.stopPropagation()" title="De beschrijving staat hier niet — zoek hem elders op">${icon('book-open')} Naslag</a>` : ''}
        </div>
        ${tekst
          ? `<div class="vaardig-card-desc">${esc(tekst.replace(/[*_#]/g, '').slice(0, 130))}…</div>`
          : `<div class="vaardig-card-desc vaardig-card-desc--leeg">De beschrijving staat hier niet — hij valt buiten de vrij te gebruiken SRD.</div>`}
      </div>
    </div>`;
}

// ── Filterbalk ────────────────────────────────────────────────────
// Permanent open, net als bij de spreuken: in een lijst van honderden regels is
// filteren de normale handeling, niet de uitzondering.
function _filterBar() {
  const soorten = SOORT_VOLGORDE.filter(k => (_all || []).some(x => x.soort === k));
  const soortRij = [`<button class="spreuk-school-btn${_filters.soort ? '' : ' active'}"
      onclick="window.vaardigheden.setSoort(null)">Alles</button>`]
    .concat(soorten.map(k => {
      const s = SOORTEN[k];
      const n = (_all || []).filter(x => x.soort === k).length;
      return `<button class="spreuk-school-btn${_filters.soort === k ? ' active' : ''}"
        style="--school-c2:${s.c2}" onclick="window.vaardigheden.setSoort('${k}')">${icon(s.icon)} ${esc(s.label)} <span class="vaardig-telling">${n}</span></button>`;
    })).join('');

  // De bronnenlijst volgt de gekozen soort: bij Feats heeft een klassenkeuze
  // geen betekenis, en andersom.
  const zichtbaar = (_all || []).filter(x => !_filters.soort || x.soort === _filters.soort);
  const bronnen = [...new Set(zichtbaar.map(x => x.bron).filter(b => !_EIGEN_BRON.has(b)))].sort();
  const bronOpts = ['<option value="">Alle bronnen</option>']
    .concat(bronnen.map(b => `<option value="${esc(b)}"${_filters.bron === b ? ' selected' : ''}>${esc(b)}</option>`));
  const bronSelect = bronnen.length
    ? `<select class="spreuk-class-select" onchange="window.vaardigheden.setBron(this.value)">${bronOpts.join('')}</select>`
    : '';

  // Zelfde regel als bij de spreuken: wat je het vaakst gebruikt staat altijd in
  // beeld (soort en bron), de brede rij zit achter de trechter. Hier zijn dat de
  // twintig levels — je zoekt meestal op naam of op soort, niet op "wat krijg ik
  // op 14?". De rij klapt vanzelf open zodra er een level gekozen is, zodat een
  // actief filter nooit onzichtbaar is.
  const levels = ['<button class="spreuk-lvl-btn' + (_filters.level === null ? ' active' : '') +
    '" onclick="window.vaardigheden.setLevel(null)">Alle levels</button>'];
  for (let i = 1; i <= 20; i++) {
    if (!zichtbaar.some(x => x.level === i)) continue;
    levels.push(`<button class="spreuk-lvl-btn${_filters.level === i ? ' active' : ''}" onclick="window.vaardigheden.setLevel(${i})">${i}</button>`);
  }
  const heeftLevels = levels.length > 1;
  const dicht = !_levelsOpen && _filters.level === null;
  const trechter = heeftLevels ? `
    <button class="sf-toggle-btn${_filters.level !== null ? ' sf-toggle-btn--active' : ''}"
      onclick="window.vaardigheden.toggleLevels()" title="Filter op het level waarop iets komt"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : '';

  return `
    <div class="spreuk-filters vaardig-filters">
      <div class="spreuk-scholen">${soortRij}</div>
      ${bronSelect}
      ${trechter}
      ${heeftLevels ? `<div class="spreuk-levels vaardig-levels${dicht ? ' vaardig-levels--dicht' : ''}">${levels.join('')}</div>` : ''}
    </div>`;
}

function _paint() {
  const grid = document.getElementById('vaardig-grid');
  if (!grid) return;
  const lijst = _filtered();
  grid.innerHTML = lijst.length
    ? lijst.map(_card).join('')
    : `<p class="spreuk-empty">Niets gevonden.</p>`;
  const tel = document.getElementById('vaardig-telling');
  if (tel) tel.textContent = `${lijst.length} van ${(_all || []).length}`;
}

function _refreshFilterBar() {
  const fb = _container?.querySelector('.vaardig-filters');
  if (fb) fb.outerHTML = _filterBar();
}

// ── Detailvenster ─────────────────────────────────────────────────
// Zelfde opmaak als het progressie-detailvenster (`prog-detail*`), inclusief de
// verwijzing naar buiten wanneer de tekst hier niet mag staan.
function _open(key) {
  const it = (_all || []).find(x => x.key === key);
  if (!it) return;
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const tekst = _tekst(it);
  const body = tekst
    ? `<div class="prog-detail-desc">${_bron?.md?.(tekst) ?? esc(tekst)}</div>`
    : (_bron?.geenTekstBlok?.(it.naam) ?? '');
  window.app.openModal(it.naam, '', `
    <div class="prog-detail">
      <div class="prog-detail-body">
        <div class="prog-detail-chips">
          <span class="prog-detail-chip">${icon(_itemIcoon(it))} ${esc(s.label)}</span>
          ${_bronRegel(it) ? `<span class="prog-detail-chip">${esc(_bronRegel(it))}</span>` : ''}
          ${it.level ? `<span class="prog-detail-chip">Level ${it.level}</span>` : ''}
        </div>
        ${body}
      </div>
    </div>`);
  // Het lexicon leest mee, net als in het spreukdetail en het statblok.
  const el = document.querySelector('#modal-overlay .prog-detail');
  if (el) window.glossary?.applyDom?.(el);
}

// ── Publieke API ──────────────────────────────────────────────────
window.vaardigheden = {
  open: _open,
  search(q) { _filters.q = q || ''; _paint(); },
  setSoort(k) { _filters.soort = k || null; _filters.bron = null; _filters.level = null; _refreshFilterBar(); _paint(); },
  setBron(b)  { _filters.bron = b || null; _paint(); },
  setLevel(l) { _filters.level = (l === null ? null : Number(l)); _refreshFilterBar(); _paint(); },
  toggleLevels() { _levelsOpen = !_levelsOpen; _refreshFilterBar(); },
};

export async function renderVaardigheden(container) {
  _container = container || document.getElementById('section-vaardigheden');
  if (!_container) return;
  _container.innerHTML = `<div class="spreuk-wrap"><p class="spreuk-loading">Naslag laden…</p></div>`;
  await _load();
  if (window.app?.state?.activeSection !== 'vaardigheden') return;   // tijdens het laden gewisseld

  _container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--vaardigheden">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('graduation-cap')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Vaardigheden</div>
          <div class="section-banner-desc-line">Alles wat een personage kan leren.</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek feature, feat…"
              value="${esc(_filters.q)}" oninput="window.vaardigheden.search(this.value)">
          </div>
          ${window._helpBtn?.('vaardigheden') ?? ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="spreuk-wrap">
      ${_filterBar()}
      <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4" id="vaardig-grid"></div>
    </div>`;
  _paint();
}
