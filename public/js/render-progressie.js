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

// Klassen waarvoor een illustratie bestaat in /img/classes/
const _CLASS_ART = new Set(['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
const _classArtKey = key => _CLASS_ART.has(key) ? key : null;

// Categorie-inschatting op basis van de feature-naam (voor icoon + tint).
const _CATS = [
  { id: 'subklasse', label: 'Subklasse',   emoji: '🌟', kw: [] },
  { id: 'versterking', label: 'Versterking', emoji: '➕', kw: ['ability score'] },
  { id: 'epic',     label: 'Epische gave',  emoji: '🏆', kw: ['epic boon'] },
  { id: 'magie',    label: 'Magie',         emoji: '✨', kw: ['spell','cantrip','ritual','magic','arcan','eldritch','metamagic','sorcer','wild magic','mystic','invocation','channel divinity','smite','font of magic','signature','words of creation','potent','sculpt','evocation','draconic spells','fiend spells','spellcasting'] },
  { id: 'genezing', label: 'Genezing',      emoji: '💚', kw: ['heal','lay on hands','cure','preserve life','wholeness','blessing','sanctuary','restoration'] },
  { id: 'aanval',   label: 'Aanval',        emoji: '⚔️', kw: ['rage','attack','strike','weapon mastery','brutal','reckless','frenzy','sneak','flurry','stunning','quivering','divine smite','breath weapon','action surge','fighting style','hunter','foe slayer','bombardment'] },
  { id: 'verdediging', label: 'Verdediging', emoji: '🛡️', kw: ['defense','resist','unarmored','armor','dodge','uncanny','evasion','endurance','relentless','indomitable','aura','shroud','deflect','superior defense','danger sense','survivor','elusive','ward','toughness','resilien','mindless rage'] },
  { id: 'beweging', label: 'Beweging',      emoji: '🪶', kw: ['speed','flight','fly','step','dash','movement','agility','wings','roving','talons','pounce','tireless','nimble','acrobatic','disengage'] },
  { id: 'sociaal',  label: 'Sociaal',       emoji: '🎭', kw: ['inspiration','bardic','panache','audacity','countercharm','intimidating','luck','charm','persuasion'] },
  { id: 'kennis',   label: 'Kennis',        emoji: '📜', kw: ['expertise','skill','proficien','cunning','lore','knowledge','scholar','cant','talents','versatility','jack of all','secrets','study','use magic device','reliable'] },
  { id: 'zintuig',  label: 'Zintuig',       emoji: '👁️', kw: ['darkvision','eyes of night','sense','keen','feral senses','vigilant','tremor'] },
];
function _featCat(name, kind) {
  if (kind === 'subclass') return _CATS[0];
  const n = String(name || '').toLowerCase();
  for (let i = 1; i < _CATS.length; i++) {
    if (_CATS[i].kw.some(k => n.includes(k))) return _CATS[i];
  }
  return { id: 'talent', label: 'Talent', emoji: '✦' };
}
function _kindLabel(kind) {
  return kind === 'sub' ? 'subklasse' : kind === 'species' ? 'soort' : kind === 'shared' ? 'algemeen' : kind === 'subclass' ? 'keuze' : 'klasse';
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

// ── Publieke render-entry voor het dashboard ───────────────────────
export async function renderProgressie(container, ctx) {
  if (!container) return;
  _lastCtx = ctx; _lastContainer = container;
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

  // Multiclass
  if (ctx.multiclass && ctx.multiKlasse) {
    const cls2 = _findClass(ctx.multiKlasse);
    if (cls2) body += kaarten ? _classCards(cls2, '', ctx.multiKlasseLevel || 1, true) : _classTimeline(cls2, '', ctx.multiKlasseLevel || 1, true);
    else body += `<div class="prog-missing">Geen data voor multiclass <strong>${esc(ctx.multiKlasse)}</strong>.</div>`;
  }

  return `<div class="prog-panel">${head}${body}</div>`;
}

// ── Kaartweergave ──────────────────────────────────────────────────
function _featCard(feat, level, artKey, kind, unlocked) {
  const cat = _featCat(feat.name, kind);
  const fi = _featIndex.push({ name: feat.name, desc: feat.desc || '', level, artKey, kind, cat }) - 1;
  const art = artKey
    ? `<div class="prog-card-art" style="background-image:url('/img/classes/${artKey}.png')"></div>`
    : '';
  return `
    <button class="prog-card${unlocked ? '' : ' prog-card--locked'} prog-card--${cat.id}" onclick="window.progressie.openFeature(${fi})">
      ${art}<div class="prog-card-veil"></div>
      <span class="prog-card-cat" title="${esc(cat.label)}">${cat.emoji}</span>
      <span class="prog-card-lvl">${level}</span>
      ${unlocked ? '' : '<span class="prog-card-lock">🔒</span>'}
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
      cards.push(_featCard(feat, lvl, artKey, f._kind, lvl <= charLevel));
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
  const charLvl = ctx.klasseLevel || ctx.level || 1;
  const levels = species.data.levels || {};
  const cards = [];
  for (const lvl of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
    for (const f of levels[lvl]) cards.push(_featCard(f, lvl, null, 'species', lvl <= charLvl));
  }
  return `
    <div class="prog-species">
      <div class="prog-sub-title">${icon('user')} ${esc(species.key)} <span class="prog-sub-meta">soort</span></div>
      <div class="prog-cardgrid">${cards.join('')}</div>
    </div>`;
}

function _speciesBlock(species, ctx) {
  const charLvl = ctx.klasseLevel || ctx.level || 1;
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
      return `<div class="prog-feat${cls2}">
        <span class="prog-feat-name">${label}${f._kind === 'sub' ? ' <span class="prog-feat-tag">subklasse</span>' : ''}</span>
        ${f.desc ? `<span class="prog-feat-desc">${esc(f.desc)}</span>` : ''}
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
    const art = f.artKey
      ? `<div class="prog-detail-art" style="background-image:url('/img/classes/${f.artKey}.png')"></div>`
      : `<div class="prog-detail-art prog-detail-art--glyph">${f.cat.emoji}</div>`;
    const body = `
      <div class="prog-detail">
        ${art}<div class="prog-detail-veil"></div>
        <div class="prog-detail-body">
          <div class="prog-detail-chips">
            <span class="prog-detail-chip">${f.cat.emoji} ${esc(f.cat.label)}</span>
            <span class="prog-detail-chip">Level ${f.level}</span>
            <span class="prog-detail-chip prog-chip--${f.kind || 'class'}">${_kindLabel(f.kind)}</span>
          </div>
          <p class="prog-detail-desc">${esc(f.desc || 'Geen beschrijving — vul aan in de editor.')}</p>
        </div>
      </div>`;
    window.app.openModal(f.name, '', body);
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

function _levelEditor(scope, sub, levels) {
  let html = '';
  for (let lvl = 1; lvl <= 20; lvl++) {
    const feats = levels?.[lvl] || [];
    if (!feats.length && scope !== 'species') {
      html += `<div class="prog-ed-lvl prog-ed-lvl--empty"><span class="prog-ed-lvlnum">${lvl}</span><button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub || ''}',${lvl})">${icon('plus')} feature</button></div>`;
      continue;
    }
    const rows = feats.map((f, i) => `
      <div class="prog-ed-feat">
        <input class="prog-ed-in prog-ed-name" value="${esc(f.name)}" placeholder="Naam"
          oninput="window.progressie.editFeature('${scope}','${sub || ''}',${lvl},${i},'name',this.value)">
        <input class="prog-ed-in prog-ed-desc" value="${esc(f.desc || '')}" placeholder="Beschrijving"
          oninput="window.progressie.editFeature('${scope}','${sub || ''}',${lvl},${i},'desc',this.value)">
        <button class="prog-ed-del" onclick="window.progressie.removeFeature('${scope}','${sub || ''}',${lvl},${i})">${icon('x')}</button>
      </div>`).join('');
    html += `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">${lvl}</span><div class="prog-ed-feats">${rows}<button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub || ''}',${lvl})">${icon('plus')} feature</button></div></div>`;
  }
  // species: ook hogere levels tonen alleen als ze bestaan — voor species beperken we tot bestaande + lvl 1
  if (scope === 'species') {
    html = '';
    const lvls = new Set([1, ...Object.keys(levels || {}).map(Number)]);
    for (const lvl of [...lvls].sort((a, b) => a - b)) {
      const feats = levels?.[lvl] || [];
      const rows = feats.map((f, i) => `
        <div class="prog-ed-feat">
          <input class="prog-ed-in prog-ed-name" value="${esc(f.name)}" placeholder="Naam"
            oninput="window.progressie.editFeature('species','',${lvl},${i},'name',this.value)">
          <input class="prog-ed-in prog-ed-desc" value="${esc(f.desc || '')}" placeholder="Beschrijving"
            oninput="window.progressie.editFeature('species','',${lvl},${i},'desc',this.value)">
          <button class="prog-ed-del" onclick="window.progressie.removeFeature('species','',${lvl},${i})">${icon('x')}</button>
        </div>`).join('');
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
    const rows = feats.map((f, i) => `
      <div class="prog-ed-feat">
        <input class="prog-ed-in prog-ed-name" value="${esc(f.name)}" placeholder="Naam"
          oninput="window.progressie.editFeature('class','${esc(subName)}',${lvl},${i},'name',this.value)">
        <input class="prog-ed-in prog-ed-desc" value="${esc(f.desc || '')}" placeholder="Beschrijving"
          oninput="window.progressie.editFeature('class','${esc(subName)}',${lvl},${i},'desc',this.value)">
        <button class="prog-ed-del" onclick="window.progressie.removeFeature('class','${esc(subName)}',${lvl},${i})">${icon('x')}</button>
      </div>`).join('');
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
