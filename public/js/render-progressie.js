/**
 * render-progressie.js — Skill trees / klasse-progressie op het personagetabblad
 *
 * Toont op basis van de ingevulde klasse, subklasse, soort en level een
 * verticale tijdlijn (1–20) met wat het personage op elk level ontgrendelt
 * (class + subclass features), plus de soort-traits. Tolerant in naam-matching
 * (hoofdletter-ongevoelig, met aliassen). De DM kan de progressie-data
 * bewerken via een editor.
 */

import { api } from './api.js?v=221';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => window.app?.isDM?.();

let _prog = null;          // gecachte progressie-data
let _progPromise = null;
let _view = (typeof localStorage !== 'undefined' && localStorage.getItem('progView')) || 'tijdlijn';
let _featIndex = [];       // platte lijst van features voor de kaart-detailweergave
let _lastCtx = null;
let _lastContainer = null;
let _favs = new Set();     // favoriet-sleutels van de huidige speler
let _favFilter = false;    // toon alleen favorieten?
let _charId = null;        // huidige speler (voor opslaan favorieten)
let _choices = {};         // { featKey → keuze-tekst } van de huidige speler

// Klassen waarvoor een illustratie bestaat in /img/classes/
const _CLASS_ART = new Set(['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
const _classArtKey = key => _CLASS_ART.has(key) ? key : null;

// Categorie-inschatting op basis van de feature-naam (voor icoon + tint).
const _CATS = [
  { id: 'subklasse',   label: 'Subklasse',    icon: 'sparkles',      kw: [] },
  { id: 'versterking', label: 'Versterking',  icon: 'plus',          kw: ['ability score'] },
  { id: 'epic',        label: 'Epische gave', icon: 'star',          kw: ['epic boon'] },
  { id: 'magie',       label: 'Magie',        icon: 'zap',           kw: ['spell','cantrip','ritual','magic','arcan','eldritch','metamagic','sorcer','wild magic','mystic','invocation','channel divinity','smite','font of magic','signature','words of creation','potent','sculpt','evocation','draconic spells','fiend spells','spellcasting'] },
  { id: 'genezing',    label: 'Genezing',     icon: 'heart',         kw: ['heal','lay on hands','cure','preserve life','wholeness','blessing','sanctuary','restoration'] },
  { id: 'aanval',      label: 'Aanval',       icon: 'crossed-swords',kw: ['rage','attack','strike','weapon mastery','brutal','reckless','frenzy','sneak','flurry','stunning','quivering','divine smite','breath weapon','action surge','fighting style','hunter','foe slayer','bombardment'] },
  { id: 'verdediging', label: 'Verdediging',  icon: 'shield',        kw: ['defense','resist','unarmored','armor','dodge','uncanny','evasion','endurance','relentless','indomitable','aura','shroud','deflect','superior defense','danger sense','survivor','elusive','ward','toughness','resilien','mindless rage'] },
  { id: 'beweging',    label: 'Beweging',     icon: 'target',        kw: ['speed','flight','fly','step','dash','movement','agility','wings','roving','talons','pounce','tireless','nimble','acrobatic','disengage'] },
  { id: 'sociaal',     label: 'Sociaal',      icon: 'users',         kw: ['inspiration','bardic','panache','audacity','countercharm','intimidating','luck','charm','persuasion'] },
  { id: 'kennis',      label: 'Kennis',       icon: 'scroll-text',   kw: ['expertise','skill','proficien','cunning','lore','knowledge','scholar','cant','talents','versatility','jack of all','secrets','study','use magic device','reliable'] },
  { id: 'zintuig',     label: 'Zintuig',      icon: 'eye',           kw: ['darkvision','eyes of night','sense','keen','feral senses','vigilant','tremor'] },
];
const _TALENT = { id: 'talent', label: 'Talent', icon: 'hexagon' };
const _CAT_ALL = [..._CATS, _TALENT];
const _catById = id => _CAT_ALL.find(c => c.id === id) || _TALENT;
// Keuzes voor de DM-editor (auto-markers weggelaten — die volgen uit naam/kind)
const _CAT_CHOICES = ['magie','aanval','verdediging','genezing','beweging','sociaal','kennis','zintuig','talent'];

function _featCat(name, kind) {
  if (kind === 'subclass') return _CATS[0];
  const n = String(name || '').toLowerCase();
  for (let i = 1; i < _CATS.length; i++) {
    if (_CATS[i].kw.some(k => n.includes(k))) return _CATS[i];
  }
  return _TALENT;
}
// Categorie van een feature: DM-veld 'cat' wint, anders heuristiek op de naam.
function _resolveCat(feat, kind) {
  if (feat && feat.cat) return _catById(feat.cat);
  return _featCat(feat?.name, kind);
}
function _kindLabel(kind) {
  return kind === 'sub' ? 'subklasse' : kind === 'species' ? 'soort' : kind === 'shared' ? 'algemeen' : kind === 'subclass' ? 'keuze' : 'klasse';
}

// Stabiele sleutel per feature (voor favorieten).
function _featKey(scope, level, name) { return `${scope}|${level}|${name}`; }

// Totaal character-level (voor soort-unlocks, ook bij multiclass).
function _totalLevel(ctx) {
  return ctx.level || ((ctx.klasseLevel || 0) + (ctx.multiKlasseLevel || 0)) || ctx.klasseLevel || 1;
}

// Media-element (afbeelding of filmpje) voor kaart-achtergrond of detail.
function _mediaArt(feat, artKey, big) {
  if (feat && feat.img) {
    const url = api.fileUrl(feat.img);
    if (feat.imgKind === 'video') {
      return `<video class="prog-card-art${big ? ' prog-detail-art' : ''}" src="${url}" autoplay muted loop playsinline></video>`;
    }
    return `<div class="prog-card-art${big ? ' prog-detail-art' : ''}" style="background-image:url('${url}')"></div>`;
  }
  if (artKey) return `<div class="prog-card-art${big ? ' prog-detail-art' : ''}" style="background-image:url('/img/classes/${artKey}.png')"></div>`;
  return '';
}

async function _loadProg(force) {
  if (_prog && !force) return _prog;
  if (!_progPromise || force) _progPromise = api.progression().then(d => { _prog = d; return d; });
  return _progPromise;
}
// Herlaad wanneer de DM de data wijzigt (socket).
window.addEventListener('progression:reload', () => { _prog = null; _progPromise = null; });

const _norm = s => String(s || '').trim().toLowerCase();

function _findClass(name) {
  if (!_prog?.classes || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(_prog.classes)) {
    if (_norm(key) === n) return { key, data };
    if ((data.aliassen || []).some(a => _norm(a) === n)) return { key, data };
  }
  // losse match: begint-met (bv. "Wizard (Evocation)")
  for (const [key, data] of Object.entries(_prog.classes)) {
    if (n.startsWith(_norm(key))) return { key, data };
  }
  return null;
}

function _findSpecies(name) {
  if (!_prog?.species || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(_prog.species)) {
    if (_norm(key) === n) return { key, data };
    if ((data.aliassen || []).some(a => _norm(a) === n)) return { key, data };
  }
  return null;
}

function _findSubclass(classData, name) {
  if (!classData?.subclasses || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(classData.subclasses)) {
    if (_norm(key) === n || n.includes(_norm(key)) || _norm(key).includes(n)) return { key, data };
  }
  return null;
}

// Bouw de features per level voor een (sub)klasse, inclusief gedeelde markers.
function _featuresForLevel(classData, subclass, level) {
  const out = [];
  const g = _prog?.gedeeld || {};
  if ((g.subclassLevel || 3) === level) {
    out.push({ name: classData.subclassLabel || 'Subklasse', desc: subclass ? '' : 'Kies je subklasse.', _kind: 'subclass' });
  }
  for (const f of (classData.levels?.[level] || [])) out.push(f);
  if (subclass) for (const f of (subclass.data.levels?.[level] || [])) out.push({ ...f, _kind: 'sub' });
  if ((g.asiLevels || [4, 8, 12, 16]).includes(level)) {
    out.push({ name: 'Ability Score Improvement', desc: 'Verhoog je ability scores of neem een feat.', _kind: 'shared' });
  }
  if ((g.epicBoonLevel || 19) === level) {
    out.push({ name: 'Epic Boon', desc: 'Neem een Epic Boon-feat.', _kind: 'shared' });
  }
  return out;
}

// ── Ontgrendelde features voor de Kenmerken-sectie ─────────────────
// Verzamelt alle klasse-, subklasse- en soort-features die op het huidige
// niveau zijn ontgrendeld (level ≤ charLevel). De generieke keuze-markers
// (ASI, Epic Boon, "Kies je subklasse") worden overgeslagen — dat zijn geen
// benoemde kenmerken. Dedupt op naam (eerste wint). Gooit nooit.
export async function getUnlockedFeatures(ctx) {
  try { await _loadProg(); } catch { return []; }
  if (!_prog?.classes || !ctx) return [];
  const out = [];
  const seen = new Set();
  const push = (name, desc, meta, kind, level) => {
    if (!name) return;
    const k = _norm(name);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name, desc: desc || '', meta: meta || '', kind, level: level || 0 });
  };

  // Soort-traits (op basis van totaal character-level, ook bij multiclass)
  const species = _findSpecies(ctx.species);
  if (species) {
    const charLvl = _totalLevel(ctx);
    const levels = species.data.levels || {};
    for (const lvl of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
      if (lvl > charLvl) continue;
      for (const f of levels[lvl]) push(f.name, f.desc, `${species.key}${lvl > 1 ? ` · Niv. ${lvl}` : ''}`, 'species', lvl);
    }
  }

  // Hoofdklasse
  const cls = _findClass(ctx.klasse);
  if (cls) _collectClassFeatures(push, cls, ctx.subclass, ctx.klasseLevel || ctx.level || 1);

  // Multiclass — subklasse-naam matcht automatisch de juiste klasse
  if (ctx.multiclass && ctx.multiKlasse) {
    const cls2 = _findClass(ctx.multiKlasse);
    if (cls2) _collectClassFeatures(push, cls2, ctx.subclass, ctx.multiKlasseLevel || 1);
  }

  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function _collectClassFeatures(push, cls, subclassName, charLevel) {
  const subclass = _findSubclass(cls.data, subclassName);
  const max = Math.max(0, Math.min(20, charLevel || 1));
  for (let lvl = 1; lvl <= max; lvl++) {
    for (const f of (cls.data.levels?.[lvl] || [])) push(f.name, f.desc, `${cls.key} · Niv. ${lvl}`, 'class', lvl);
    if (subclass) for (const f of (subclass.data.levels?.[lvl] || [])) push(f.name, f.desc, `${subclass.key} · Niv. ${lvl}`, 'sub', lvl);
  }
}

// ── Publieke render-entry voor het dashboard ───────────────────────
export async function renderProgressie(container, ctx) {
  if (!container) return;
  _lastCtx = ctx; _lastContainer = container;
  _charId = ctx.charId || null;
  if (Array.isArray(ctx.favorites)) _favs = new Set(ctx.favorites);
  _choices = (ctx.choices && typeof ctx.choices === 'object') ? ctx.choices : {};
  try { await _loadProg(); } catch { container.innerHTML = ''; return; }
  if (!_prog?.classes) { container.innerHTML = ''; return; }
  _featIndex = [];
  container.innerHTML = _buildPanel(ctx);
}

function _buildPanel(ctx) {
  const cls = _findClass(ctx.klasse);
  const species = _findSpecies(ctx.species);
  const kaarten = _view === 'kaarten';
  const head = `
    <div class="prog-head">
      <h3 class="prog-title">${icon('sparkles')} Progressie</h3>
      <div class="prog-head-right">
        <div class="prog-view-toggle">
          <button class="prog-view-btn${!kaarten ? ' active' : ''}" onclick="window.progressie.setView('tijdlijn')" title="Tijdlijn">${icon('clipboard-list')}</button>
          <button class="prog-view-btn${kaarten ? ' active' : ''}" onclick="window.progressie.setView('kaarten')" title="Kaarten">${icon('image')}</button>
        </div>
        ${_charId ? `<button class="prog-fav-toggle${_favFilter ? ' active' : ''}" onclick="window.progressie.toggleFavFilter()" title="Toon alleen favorieten">${_favFilter ? '★' : '☆'}</button>` : ''}
        ${_prog.samenvatting ? `<span class="prog-bron" title="Samengevat startpunt — controleer/pas aan in de editor">samengevat</span>` : ''}
        ${isDM() ? `<button class="prog-edit-btn" onclick="window.progressie.openEditor()">${icon('pencil')} Bewerk</button>` : ''}
      </div>
    </div>`;

  let body = '';
  // Soort / ras
  if (species) {
    body += kaarten ? _speciesCards(species, ctx) : _speciesBlock(species, ctx);
  } else if (ctx.species) {
    body += `<div class="prog-missing">Geen data voor soort <strong>${esc(ctx.species)}</strong>.${isDM() ? ' Voeg toe in de editor.' : ''}</div>`;
  }

  // Hoofdklasse
  if (cls) {
    body += kaarten
      ? _classCards(cls, ctx.subclass, ctx.klasseLevel || ctx.level || 1, false)
      : _classTimeline(cls, ctx.subclass, ctx.klasseLevel || ctx.level || 1, false);
  } else if (ctx.klasse) {
    body += `<div class="prog-missing">Geen progressie-data voor klasse <strong>${esc(ctx.klasse)}</strong>.${isDM() ? ' Voeg toe in de editor of pas de naam aan.' : ' Vraag de DM om deze klasse toe te voegen.'}</div>`;
  } else {
    body += `<div class="prog-missing">Vul je klasse in bij je profiel om je progressie te zien.</div>`;
  }

  // Multiclass — geef de subklasse aan beide klassen; de naam-match koppelt 'm
  // automatisch aan de juiste klasse (een subklasse-naam is uniek per klasse).
  if (ctx.multiclass && ctx.multiKlasse) {
    const cls2 = _findClass(ctx.multiKlasse);
    if (cls2) body += kaarten ? _classCards(cls2, ctx.subclass, ctx.multiKlasseLevel || 1, true) : _classTimeline(cls2, ctx.subclass, ctx.multiKlasseLevel || 1, true);
    else body += `<div class="prog-missing">Geen data voor multiclass <strong>${esc(ctx.multiKlasse)}</strong>.</div>`;
  }

  // Lege favorieten-melding
  if (_favFilter && !_featIndex.some(f => f._fav)) {
    body += `<div class="prog-missing">Nog geen favorieten — tik op het sterretje van een kaart.</div>`;
  }

  return `<div class="prog-panel">${head}${body}</div>`;
}

// ── Keuze-helper ──────────────────────────────────────────────────
// Een feature is een "keuze-feature" als de DM `choice: true` heeft gezet,
// of als het een automatisch gegenereerd gedeeld marker is (ASI, Epic Boon).
function _isChoiceFeat(feat) {
  return feat.choice === true || feat._kind === 'shared';
}

// Rendert het keuze-invoerveld voor tijdlijn en detail-modal.
// Alleen zichtbaar als speler ingelogd is (charId aanwezig).
function _choiceField(key, unlocked) {
  if (!_charId) return '';
  const saved = esc(_choices[key] || '');
  const ph = 'Noteer jouw keuze…';
  return `<div class="prog-choice-row">
    <input class="prog-choice-input" type="text"
      placeholder="${ph}"
      value="${saved}"
      ${!unlocked ? 'disabled' : ''}
      onchange="event.stopPropagation();window.progressie.saveChoice('${esc(key)}',this.value)"
      onclick="event.stopPropagation()">
  </div>`;
}

// ── Kaartweergave ──────────────────────────────────────────────────
function _featCard(feat, level, artKey, kind, unlocked, scope) {
  const cat = _resolveCat(feat, kind);
  const key = _featKey(scope, level, feat.name);
  const fav = _favs.has(key);
  if (_favFilter && !fav) return '';   // favorieten-filter
  const fi = _featIndex.push({ name: feat.name, desc: feat.desc || '', level, artKey, kind, cat, img: feat.img, imgKind: feat.imgKind, key, _fav: fav }) - 1;
  const art = _mediaArt(feat, artKey, false);
  const star = _charId ? `<span class="prog-card-fav${fav ? ' on' : ''}" onclick="event.stopPropagation();window.progressie.toggleFav(${fi})" title="Favoriet">${fav ? '★' : '☆'}</span>` : '';
  return `
    <button class="prog-card${unlocked ? '' : ' prog-card--locked'} prog-card--${cat.id}${fav ? ' prog-card--fav' : ''}" onclick="window.progressie.openFeature(${fi})">
      ${art}<div class="prog-card-veil"></div>
      <span class="prog-card-cat" title="${esc(cat.label)}">${icon(cat.icon)}</span>
      <span class="prog-card-lvl">${level}</span>
      ${star}
      ${unlocked ? '' : '<span class="prog-card-lock">🔒</span>'}
      ${(_isChoiceFeat(feat) && _choices[key]) ? `<span class="prog-card-choice">${esc(_choices[key])}</span>` : ''}
      <div class="prog-card-foot">
        <span class="prog-card-name">${esc(feat.name)}</span>
        <span class="prog-card-chip prog-chip--${kind || 'class'}">${_kindLabel(kind)}</span>
      </div>
    </button>`;
}

function _classCards(cls, subclassName, charLevel, isMulti) {
  const subclass = _findSubclass(cls.data, subclassName);
  const artKey = _classArtKey(cls.key);
  const cards = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    for (const f of _featuresForLevel(cls.data, subclass, lvl)) {
      // De subklasse-keuzemarker zonder gekozen subklasse slaan we over in kaartmodus
      if (f._kind === 'subclass' && !subclass) continue;
      const feat = (f._kind === 'subclass' && subclass) ? { name: `${f.name}: ${subclass.key}`, desc: f.desc } : f;
      cards.push(_featCard(feat, lvl, artKey, f._kind, lvl <= charLevel, cls.key));
    }
  }
  const subLabel = subclassName ? (subclass ? esc(subclass.key) : `${esc(subclassName)} (geen data)`) : 'nog geen subklasse';
  return `
    <div class="prog-class${isMulti ? ' prog-class--multi' : ''}">
      <div class="prog-sub-title">${icon('crossed-swords', { cls: 'icon-gi' })} ${esc(cls.key)} <span class="prog-sub-meta">level ${charLevel} · ${subLabel}</span></div>
      <div class="prog-cardgrid">${cards.join('')}</div>
    </div>`;
}

function _speciesCards(species, ctx) {
  const charLvl = _totalLevel(ctx);
  const levels = species.data.levels || {};
  const cards = [];
  for (const lvl of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
    for (const f of levels[lvl]) cards.push(_featCard(f, lvl, null, 'species', lvl <= charLvl, 'soort:' + species.key));
  }
  return `
    <div class="prog-species">
      <div class="prog-sub-title">${icon('user')} ${esc(species.key)} <span class="prog-sub-meta">soort</span></div>
      <div class="prog-cardgrid">${cards.join('')}</div>
    </div>`;
}

function _speciesBlock(species, ctx) {
  const charLvl = _totalLevel(ctx);
  const levels = species.data.levels || {};
  const items = [];
  for (const lvl of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
    for (const f of levels[lvl]) items.push({ ...f, lvl });
  }
  const rows = items.map(f => {
    const locked = f.lvl > charLvl;
    return `<div class="prog-trait${locked ? ' prog-locked' : ''}">
      <span class="prog-trait-name">${esc(f.name)}</span>${f.lvl > 1 ? `<span class="prog-lvl-chip">lvl ${f.lvl}</span>` : ''}
      ${f.desc ? `<span class="prog-trait-desc">${esc(f.desc)}</span>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="prog-species">
      <div class="prog-sub-title">${icon('user')} ${esc(species.key)} <span class="prog-sub-meta">soort</span></div>
      <div class="prog-traits">${rows}</div>
    </div>`;
}

function _classTimeline(cls, subclassName, charLevel, isMulti) {
  const subclass = _findSubclass(cls.data, subclassName);
  const maxLvl = 20;
  const rows = [];
  for (let lvl = 1; lvl <= maxLvl; lvl++) {
    const feats = _featuresForLevel(cls.data, subclass, lvl);
    if (!feats.length) continue;
    const unlocked = lvl <= charLevel;
    const isCurrent = lvl === charLevel;
    const featHtml = feats.map(f => {
      let label = esc(f.name);
      if (f._kind === 'subclass' && subclass) label = `${esc(f.name)}: ${esc(subclass.key)}`;
      const cls2 = f._kind === 'shared' ? ' prog-feat--shared' : (f._kind === 'sub' ? ' prog-feat--sub' : '');
      const fKey = _featKey(cls.key, lvl, f.name);
      const choiceHtml = _isChoiceFeat(f) ? _choiceField(fKey, unlocked) : '';
      return `<div class="prog-feat${cls2}">
        <span class="prog-feat-name">${label}${f._kind === 'sub' ? ' <span class="prog-feat-tag">subklasse</span>' : ''}</span>
        ${f.desc ? `<span class="prog-feat-desc">${esc(f.desc)}</span>` : ''}
        ${choiceHtml}
      </div>`;
    }).join('');
    rows.push(`
      <div class="prog-row${unlocked ? ' prog-unlocked' : ' prog-preview'}${isCurrent ? ' prog-current' : ''}">
        <div class="prog-lvl"><span class="prog-lvl-num">${lvl}</span></div>
        <div class="prog-feats">${featHtml}</div>
      </div>`);
  }
  const subLabel = subclassName ? (subclass ? esc(subclass.key) : `${esc(subclassName)} (geen data)`) : 'nog geen subklasse';
  return `
    <div class="prog-class${isMulti ? ' prog-class--multi' : ''}">
      <div class="prog-sub-title">
        ${icon('crossed-swords', { cls: 'icon-gi' })} ${esc(cls.key)}
        <span class="prog-sub-meta">level ${charLevel} · ${subLabel}</span>
      </div>
      <div class="prog-timeline">${rows.join('')}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  DM-editor
// ══════════════════════════════════════════════════════════════════
let _edit = null;       // werkkopie tijdens bewerken
let _editSel = null;    // { type:'class'|'species', key }

const _api = {
  setView(v) {
    _view = (v === 'kaarten') ? 'kaarten' : 'tijdlijn';
    try { localStorage.setItem('progView', _view); } catch {}
    if (_lastContainer && _lastCtx) renderProgressie(_lastContainer, _lastCtx);
  },

  openFeature(fi) {
    const f = _featIndex[fi];
    if (!f) return;
    let art;
    if (f.img) {
      const url = api.fileUrl(f.img);
      art = f.imgKind === 'video'
        ? `<video class="prog-detail-art" src="${url}" autoplay muted loop playsinline></video>`
        : `<div class="prog-detail-art" style="background-image:url('${url}')"></div>`;
    } else if (f.artKey) {
      art = `<div class="prog-detail-art" style="background-image:url('/img/classes/${f.artKey}.png')"></div>`;
    } else {
      art = `<div class="prog-detail-art prog-detail-art--glyph">${icon(f.cat.icon)}</div>`;
    }
    const favBtn = _charId ? `<button class="prog-detail-fav${f._fav ? ' on' : ''}" onclick="window.progressie.toggleFav(${fi})">${f._fav ? '★ Favoriet' : '☆ Favoriet'}</button>` : '';
    const isChoice = _isChoiceFeat(f);
    const detailChoiceHtml = isChoice ? `
      <div class="prog-detail-choice">
        <label class="prog-detail-choice-label">${icon('pencil')} Jouw keuze</label>
        ${_choiceField(f.key, true)}
      </div>` : '';
    const body = `
      <div class="prog-detail">
        ${art}<div class="prog-detail-veil"></div>
        <div class="prog-detail-body">
          <div class="prog-detail-chips">
            <span class="prog-detail-chip">${icon(f.cat.icon)} ${esc(f.cat.label)}</span>
            <span class="prog-detail-chip">Level ${f.level}</span>
            <span class="prog-detail-chip prog-chip--${f.kind || 'class'}">${_kindLabel(f.kind)}</span>
            ${favBtn}
          </div>
          <p class="prog-detail-desc">${esc(f.desc || 'Geen beschrijving — vul aan in de editor.')}</p>
          ${detailChoiceHtml}
        </div>
      </div>`;
    window.app.openModal(f.name, '', body);
  },

  toggleFavFilter() {
    _favFilter = !_favFilter;
    if (_lastContainer && _lastCtx) renderProgressie(_lastContainer, _lastCtx);
  },

  async saveChoice(key, value) {
    if (!_charId) return;
    if (value && value.trim()) {
      _choices[key] = value.trim();
    } else {
      delete _choices[key];
    }
    if (_lastCtx) _lastCtx.choices = { ..._choices };
    try {
      await api.patchPlayerProfile(_charId, { featChoices: JSON.stringify(_choices) });
    } catch {}
    // Kaart-chip bijwerken zonder volledige re-render
    const card = document.querySelector(`.prog-card-choice`);
    if (_lastContainer) {
      // Alleen de choice-chips in kaartweergave herrenderen (subtiel)
      _lastContainer.querySelectorAll('.prog-card').forEach(btn => {
        const chip = btn.querySelector('.prog-card-choice');
        // we kunnen de key niet teruglezen uit de DOM — doe een stille re-render
      });
      // Full re-render om kaart-chips en tijdlijn synchroon te houden
      if (_lastCtx) renderProgressie(_lastContainer, _lastCtx);
    }
  },

  async toggleFav(fi) {
    const f = _featIndex[fi];
    if (!f || !_charId) return;
    if (_favs.has(f.key)) _favs.delete(f.key); else _favs.add(f.key);
    const arr = [..._favs];
    if (_lastCtx) _lastCtx.favorites = arr;   // houd de werkkopie in sync
    try { await api.patchPlayerProfile(_charId, { featFavorites: JSON.stringify(arr) }); } catch {}
    // Detailmodal kan openstaan; sluiten zodat de bijgewerkte staat klopt
    if (document.querySelector('#modal-overlay.active') && document.querySelector('.prog-detail')) window.app.closeModal();
    if (_lastContainer && _lastCtx) renderProgressie(_lastContainer, _lastCtx);
  },

  async openEditor() {
    try { await _loadProg(true); } catch {}
    _edit = JSON.parse(JSON.stringify(_prog || { classes: {}, species: {} }));
    if (!_edit.classes) _edit.classes = {};
    if (!_edit.species) _edit.species = {};
    if (!_edit.gedeeld) _edit.gedeeld = { asiLevels: [4, 8, 12, 16], subclassLevel: 3, epicBoonLevel: 19 };
    const firstClass = Object.keys(_edit.classes)[0];
    _editSel = firstClass ? { type: 'class', key: firstClass } : null;
    window.app.openModal('Progressie bewerken', 'Klassen, subklassen en soorten — startpunt, vrij aan te passen', _editorHtml());
    _bindEditorWidth();
  },

  selectEntry(type, key) { _editSel = { type, key }; _refreshEditor(); },

  addClass() {
    const naam = prompt('Naam van de nieuwe klasse:');
    if (!naam) return;
    if (_edit.classes[naam]) { alert('Bestaat al.'); return; }
    _edit.classes[naam] = { subclassLabel: 'Subklasse', subclassLevel: 3, levels: {}, subclasses: {} };
    _editSel = { type: 'class', key: naam };
    _refreshEditor();
  },
  addSpecies() {
    const naam = prompt('Naam van de nieuwe soort/ras:');
    if (!naam) return;
    if (_edit.species[naam]) { alert('Bestaat al.'); return; }
    _edit.species[naam] = { levels: { '1': [] } };
    _editSel = { type: 'species', key: naam };
    _refreshEditor();
  },
  removeEntry() {
    if (!_editSel) return;
    if (!confirm(`"${_editSel.key}" verwijderen uit de progressie?`)) return;
    if (_editSel.type === 'class') delete _edit.classes[_editSel.key];
    else delete _edit.species[_editSel.key];
    _editSel = null;
    _refreshEditor();
  },

  addSubclass() {
    if (_editSel?.type !== 'class') return;
    const naam = prompt('Naam van de subklasse:');
    if (!naam) return;
    const c = _edit.classes[_editSel.key];
    if (!c.subclasses) c.subclasses = {};
    if (c.subclasses[naam]) { alert('Bestaat al.'); return; }
    c.subclasses[naam] = { levels: {} };
    _refreshEditor();
  },
  removeSubclass(name) {
    if (_editSel?.type !== 'class') return;
    if (!confirm(`Subklasse "${name}" verwijderen?`)) return;
    delete _edit.classes[_editSel.key].subclasses[name];
    _refreshEditor();
  },

  addFeature(scope, sub, level) {
    const node = _scopeNode(scope, sub);
    if (!node) return;
    if (!node.levels) node.levels = {};
    if (!node.levels[level]) node.levels[level] = [];
    node.levels[level].push({ name: 'Nieuwe feature', desc: '' });
    _refreshEditor();
  },
  removeFeature(scope, sub, level, idx) {
    const node = _scopeNode(scope, sub);
    if (!node?.levels?.[level]) return;
    node.levels[level].splice(idx, 1);
    if (!node.levels[level].length) delete node.levels[level];
    _refreshEditor();
  },
  editFeature(scope, sub, level, idx, field, value) {
    const node = _scopeNode(scope, sub);
    if (node?.levels?.[level]?.[idx]) node.levels[level][idx][field] = value;
  },

  async uploadMedia(scope, sub, level, idx, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const id = 'feat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      await api.uploadFile(id, file);
      const node = _scopeNode(scope, sub);
      const feat = node?.levels?.[level]?.[idx];
      if (feat) { feat.img = id; feat.imgKind = (file.type || '').startsWith('video') ? 'video' : 'image'; }
      _refreshEditor();
      _toast('Media toegevoegd — vergeet niet op te slaan.');
    } catch (e) { alert('Upload mislukt: ' + e.message); }
  },
  removeMedia(scope, sub, level, idx) {
    const node = _scopeNode(scope, sub);
    const feat = node?.levels?.[level]?.[idx];
    if (feat) { delete feat.img; delete feat.imgKind; }
    _refreshEditor();
  },

  async save() {
    try {
      await api.saveProgression({ bron: 'Aangepast door de DM', classes: _edit.classes, species: _edit.species, gedeeld: _edit.gedeeld });
      _prog = null; _progPromise = null;
      window.app.closeModal();
      _toast('Progressie opgeslagen.');
      if (window.app?.state?.activeSection === 'mijn-karakter') window.app.refreshSection('mijn-karakter');
    } catch (e) { alert('Opslaan mislukt: ' + e.message); }
  },
  async resetSeed() {
    if (!confirm('Terug naar de meegeleverde 2024-startdata? Je eigen aanpassingen gaan verloren.')) return;
    try {
      await api.resetProgression();
      _prog = null; _progPromise = null;
      await _loadProg(true);
      _edit = JSON.parse(JSON.stringify(_prog));
      _editSel = { type: 'class', key: Object.keys(_edit.classes)[0] };
      _refreshEditor();
      _toast('Teruggezet naar de startdata.');
    } catch (e) { alert(e.message); }
  },
};

function _scopeNode(scope, sub) {
  if (scope === 'species') return _edit.species[_editSel.key];
  const c = _edit.classes[_editSel.key];
  if (sub) return c.subclasses?.[sub];
  return c;
}

function _editorHtml() {
  const classList = Object.keys(_edit.classes).sort().map(k =>
    `<button class="prog-ed-item${_editSel?.type === 'class' && _editSel.key === k ? ' active' : ''}" onclick="window.progressie.selectEntry('class','${esc(k)}')">${esc(k)}</button>`).join('');
  const specList = Object.keys(_edit.species).sort().map(k =>
    `<button class="prog-ed-item${_editSel?.type === 'species' && _editSel.key === k ? ' active' : ''}" onclick="window.progressie.selectEntry('species','${esc(k)}')">${esc(k)}</button>`).join('');
  return `
    <div class="prog-ed">
      <div class="prog-ed-side">
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Klassen</span><button class="prog-ed-add" onclick="window.progressie.addClass()">${icon('plus')}</button></div>
          ${classList || '<p class="prog-ed-empty">—</p>'}
        </div>
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Soorten</span><button class="prog-ed-add" onclick="window.progressie.addSpecies()">${icon('plus')}</button></div>
          ${specList || '<p class="prog-ed-empty">—</p>'}
        </div>
      </div>
      <div class="prog-ed-main" id="prog-ed-main">${_editorMain()}</div>
    </div>
    <div class="prog-ed-foot">
      <button class="prog-ed-reset" onclick="window.progressie.resetSeed()">${icon('refresh-cw')} Naar startdata</button>
      <button class="prog-ed-save" onclick="window.progressie.save()">${icon('save')} Opslaan</button>
    </div>`;
}

// Eén bewerkbare feature-rij: naam, beschrijving, categorie-select en media.
function _featRow(scope, sub, lvl, i, f) {
  const s = scope, su = sub || '';
  const cur = f.cat || '';
  const opts = ['<option value="">— auto —</option>',
    ..._CAT_CHOICES.map(c => `<option value="${c}"${cur === c ? ' selected' : ''}>${_catById(c).label}</option>`)].join('');
  const hasMedia = !!f.img;
  return `
      <div class="prog-ed-feat">
        <input class="prog-ed-in prog-ed-name" value="${esc(f.name)}" placeholder="Naam"
          oninput="window.progressie.editFeature('${s}','${su}',${lvl},${i},'name',this.value)">
        <input class="prog-ed-in prog-ed-desc" value="${esc(f.desc || '')}" placeholder="Beschrijving"
          oninput="window.progressie.editFeature('${s}','${su}',${lvl},${i},'desc',this.value)">
        <select class="prog-ed-cat" title="Categorie" onchange="window.progressie.editFeature('${s}','${su}',${lvl},${i},'cat',this.value)">${opts}</select>
        <label class="prog-ed-media${hasMedia ? ' has' : ''}" title="${hasMedia ? 'Media vervangen' : 'Afbeelding of filmpje toevoegen'}">${hasMedia ? (f.imgKind === 'video' ? icon('play') : icon('image')) : icon('image')}<input type="file" accept="image/*,video/mp4,video/webm" style="display:none" onchange="window.progressie.uploadMedia('${s}','${su}',${lvl},${i},this)"></label>
        ${hasMedia ? `<button class="prog-ed-del" title="Media verwijderen" onclick="window.progressie.removeMedia('${s}','${su}',${lvl},${i})">${icon('x')}</button>` : ''}
        <button class="prog-ed-del" title="Feature verwijderen" onclick="window.progressie.removeFeature('${s}','${su}',${lvl},${i})">${icon('x')}</button>
      </div>`;
}

function _levelEditor(scope, sub, levels) {
  let html = '';
  for (let lvl = 1; lvl <= 20; lvl++) {
    const feats = levels?.[lvl] || [];
    if (!feats.length && scope !== 'species') {
      html += `<div class="prog-ed-lvl prog-ed-lvl--empty"><span class="prog-ed-lvlnum">${lvl}</span><button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub || ''}',${lvl})">${icon('plus')} feature</button></div>`;
      continue;
    }
    const rows = feats.map((f, i) => _featRow(scope, sub, lvl, i, f)).join('');
    html += `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">${lvl}</span><div class="prog-ed-feats">${rows}<button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub || ''}',${lvl})">${icon('plus')} feature</button></div></div>`;
  }
  // species: ook hogere levels tonen alleen als ze bestaan — voor species beperken we tot bestaande + lvl 1
  if (scope === 'species') {
    html = '';
    const lvls = new Set([1, ...Object.keys(levels || {}).map(Number)]);
    for (const lvl of [...lvls].sort((a, b) => a - b)) {
      const feats = levels?.[lvl] || [];
      const rows = feats.map((f, i) => _featRow('species', '', lvl, i, f)).join('');
      html += `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">lvl ${lvl}</span><div class="prog-ed-feats">${rows}<button class="prog-ed-addfeat" onclick="window.progressie.addFeature('species','',${lvl})">${icon('plus')} feature</button></div></div>`;
    }
  }
  return html;
}

function _editorMain() {
  if (!_editSel) return '<p class="prog-ed-empty">Kies links een klasse of soort, of voeg er een toe.</p>';
  if (_editSel.type === 'species') {
    const sp = _edit.species[_editSel.key];
    return `
      <div class="prog-ed-main-head"><h4>${esc(_editSel.key)} <span>soort</span></h4>
        <button class="prog-ed-removeentry" onclick="window.progressie.removeEntry()">${icon('trash')} Verwijderen</button></div>
      ${_levelEditor('species', '', sp.levels)}`;
  }
  const c = _edit.classes[_editSel.key];
  const subs = Object.keys(c.subclasses || {}).map(sn => `
    <div class="prog-ed-subblock">
      <div class="prog-ed-subhead">${esc(sn)} <button class="prog-ed-del" onclick="window.progressie.removeSubclass('${esc(sn)}')">${icon('x')}</button></div>
      ${_levelEditorSub(sn, c.subclasses[sn].levels)}
    </div>`).join('');
  return `
    <div class="prog-ed-main-head"><h4>${esc(_editSel.key)} <span>klasse</span></h4>
      <button class="prog-ed-removeentry" onclick="window.progressie.removeEntry()">${icon('trash')} Verwijderen</button></div>
    <div class="prog-ed-cls-levels">${_levelEditor('class', '', c.levels)}</div>
    <div class="prog-ed-subs">
      <div class="prog-ed-subs-head"><span>Subklassen</span><button class="prog-ed-add" onclick="window.progressie.addSubclass()">${icon('plus')} subklasse</button></div>
      ${subs || '<p class="prog-ed-empty">Nog geen subklassen.</p>'}
    </div>`;
}

// subklasse-niveaus: alleen levels ≥ subclassLevel tonen relevante velden, maar
// sta alle 3..20 toe via dezelfde editor (compact: toon bestaande + knop)
function _levelEditorSub(subName, levels) {
  let html = '';
  const start = _edit.gedeeld?.subclassLevel || 3;
  for (let lvl = start; lvl <= 20; lvl++) {
    const feats = levels?.[lvl] || [];
    if (!feats.length) {
      html += `<div class="prog-ed-lvl prog-ed-lvl--empty"><span class="prog-ed-lvlnum">${lvl}</span><button class="prog-ed-addfeat" onclick="window.progressie.addFeature('class','${esc(subName)}',${lvl})">${icon('plus')}</button></div>`;
      continue;
    }
    const rows = feats.map((f, i) => _featRow('class', subName, lvl, i, f)).join('');
    html += `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">${lvl}</span><div class="prog-ed-feats">${rows}<button class="prog-ed-addfeat" onclick="window.progressie.addFeature('class','${esc(subName)}',${lvl})">${icon('plus')}</button></div></div>`;
  }
  return html;
}

function _refreshEditor() {
  const body = document.getElementById('m-body');
  if (body) body.innerHTML = _editorHtml();
  _bindEditorWidth();
}
function _bindEditorWidth() {
  const modal = document.querySelector('#modal-overlay .modal');
  if (modal) modal.classList.add('modal--wide');
}

function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => { t.classList.remove('map-toast--show'); t.addEventListener('transitionend', () => t.remove(), { once: true }); }, 3000);
}

window.progressie = _api;
