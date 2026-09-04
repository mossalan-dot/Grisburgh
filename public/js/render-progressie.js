/**
 * render-progressie.js — Skill trees / klasse-progressie op het personagetabblad
 */

import { api } from './api.js?v=263';

// ── Hulpfuncties ───────────────────────────────────────────────────
const esc  = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();

// Minimale markdown → HTML converter voor SRD-tekst
function _md(text) {
  if (!text) return '';
  let s = esc(text);
  // Bold (**text**)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic (_text_) — alleen als het geen witruimte direct grenst
  s = s.replace(/(?<![a-z])_([^_\n]+)_(?![a-z])/gi, '<em>$1</em>');
  // Paragrafen (dubbele newline)
  const paras = s.split(/\n\n+/);
  return paras.map(p => {
    const lines = p.split('\n');
    // Bulletlijst
    if (lines.every(l => l.match(/^[-•]\s/))) {
      return '<ul>' + lines.map(l => `<li>${l.replace(/^[-•]\s+/, '')}</li>`).join('') + '</ul>';
    }
    // Gemengd: sommige regels bullet, rest tekst
    const items = lines.map(l => l.match(/^[-•]\s/) ? `<li>${l.replace(/^[-•]\s+/, '')}</li>` : l);
    const hasBullets = items.some(i => i.startsWith('<li>'));
    if (hasBullets) {
      // Groepeer bullets samen
      let out = '', inList = false;
      for (const item of items) {
        if (item.startsWith('<li>')) {
          if (!inList) { out += '<ul>'; inList = true; }
          out += item;
        } else {
          if (inList) { out += '</ul>'; inList = false; }
          if (item) out += item + ' ';
        }
      }
      if (inList) out += '</ul>';
      return out;
    }
    return `<p>${lines.join(' ')}</p>`;
  }).join('');
}

// ── SRD-beschrijvingen (Engels, 2024 PHB) ─────────────────────────
// Geladen via /api/bron/feature-descriptions (buiten public/, dus achter een sessie).
// DM-beschrijvingen in class-progression.json hebben altijd prioriteit.
let _srd = null;
let _srdPromise = null;
async function _loadSrd() {
  if (_srd && Object.keys(_srd).length > 0) return _srd;
  if (!_srdPromise) {
    _srdPromise = fetch('/api/bron/feature-descriptions')
      .then(r => r.json())
      .then(d => { _srd = d; return d; })
      .catch(() => { _srd = {}; _srdPromise = null; return {}; });
  }
  return _srdPromise;
}
function _srdDesc(name, className) {
  if (!_srd || !name) return '';
  // Klasse-specifiek eerst, dan generiek, dan case-insensitief
  if (className) {
    const specific = _srd[`${className}|${name}`]
      || _srd[Object.keys(_srd).find(k => k.toLowerCase() === `${className.toLowerCase()}|${name.toLowerCase()}`)];
    if (specific) return specific;
  }
  return _srd[name] || _srd[Object.keys(_srd).find(k => k.toLowerCase() === name.toLowerCase())] || '';
}

// ── Backgrounds (2024) ────────────────────────────────────────────
// Ingebouwde bibliotheek (16 PHB-backgrounds) als fallback/seed. De DM kan
// een eigen versie opslaan in prog.backgrounds; die heeft dan voorrang.
let _bgLib = null;
let _bgPromise = null;
async function _loadBackgrounds() {
  if (_bgLib) return _bgLib;
  if (!_bgPromise) {
    _bgPromise = fetch('/api/bron/backgrounds-2024')
      .then(r => r.json())
      .then(d => { _bgLib = d; return d; })
      .catch(() => { _bgLib = {}; _bgPromise = null; return {}; });
  }
  return _bgPromise;
}
let _curBackgrounds = null; // gezet bij render: prog.backgrounds || _bgLib
function _findBackground(libObj, name) {
  if (!libObj || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(libObj)) {
    if (_norm(key) === n) return { key, data };
  }
  for (const [key, data] of Object.entries(libObj)) {
    if (n.startsWith(_norm(key)) || _norm(key).startsWith(n)) return { key, data };
  }
  return null;
}

const _norm = s => String(s || '').trim().toLowerCase();

// Klassen waarvoor een illustratie bestaat in /img/classes/
const _CLASS_ART = new Set(['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
const _classArtKey = key => _CLASS_ART.has(key) ? key : null;

// Categorie-inschatting op basis van de feature-naam.
const _CATS = [
  { id: 'subklasse',   label: 'Subclass',     icon: 'sparkles',       kw: [] },
  { id: 'versterking', label: 'ASI',          icon: 'plus',           kw: ['ability score'] },
  { id: 'epic',        label: 'Epic Boon',    icon: 'star',           kw: ['epic boon'] },
  { id: 'magie',       label: 'Magic',        icon: 'zap',            kw: ['spell','cantrip','ritual','magic','arcan','eldritch','metamagic','sorcer','wild magic','mystic','invocation','channel divinity','smite','font of magic','signature','words of creation','potent','sculpt','evocation','draconic spells','fiend spells','spellcasting'] },
  { id: 'genezing',    label: 'Healing',      icon: 'heart',          kw: ['heal','lay on hands','cure','preserve life','wholeness','blessing','sanctuary','restoration'] },
  { id: 'aanval',      label: 'Combat',       icon: 'crossed-swords', kw: ['rage','attack','strike','weapon mastery','brutal','reckless','frenzy','sneak','flurry','stunning','quivering','divine smite','breath weapon','action surge','fighting style','hunter','foe slayer','bombardment'] },
  { id: 'verdediging', label: 'Defense',      icon: 'shield',         kw: ['defense','resist','unarmored','armor','dodge','uncanny','evasion','endurance','relentless','indomitable','aura','shroud','deflect','superior defense','danger sense','survivor','elusive','ward','toughness','resilien','mindless rage'] },
  { id: 'beweging',    label: 'Movement',     icon: 'target',         kw: ['speed','flight','fly','step','dash','movement','agility','wings','roving','talons','pounce','tireless','nimble','acrobatic','disengage'] },
  { id: 'sociaal',     label: 'Social',       icon: 'users',          kw: ['inspiration','bardic','panache','audacity','countercharm','intimidating','luck','charm','persuasion'] },
  { id: 'kennis',      label: 'Knowledge',    icon: 'scroll-text',    kw: ['expertise','skill','proficien','cunning','lore','knowledge','scholar','cant','talents','versatility','jack of all','secrets','study','use magic device','reliable'] },
  { id: 'zintuig',     label: 'Senses',       icon: 'eye',            kw: ['darkvision','eyes of night','sense','keen','feral senses','vigilant','tremor'] },
];
const _TALENT = { id: 'talent', label: 'Talent', icon: 'hexagon' };
const _CAT_ALL = [..._CATS, _TALENT];
const _catById  = id => _CAT_ALL.find(c => c.id === id) || _TALENT;
const _CAT_CHOICES = ['magie','aanval','verdediging','genezing','beweging','sociaal','kennis','zintuig','talent'];

function _featCat(name, kind) {
  if (kind === 'subclass') return _CATS[0];
  const n = _norm(name);
  for (let i = 1; i < _CATS.length; i++) {
    if (_CATS[i].kw.some(k => n.includes(k))) return _CATS[i];
  }
  return _TALENT;
}
function _resolveCat(feat, kind) {
  if (feat?.cat) return _catById(feat.cat);
  return _featCat(feat?.name, kind);
}
// Glossary-hover toepassen op de beschrijving(en) in de open modal.
// Synchroon (geen requestAnimationFrame): openModal zet de inhoud al synchroon,
// en rAF wordt op achtergrond-tabs gepauzeerd waardoor de uitleg niet verscheen.
function _applyGlossaryToModal() {
  const mbody = document.getElementById('m-body');
  if (!mbody || !window.glossary?.applyDom) return;
  mbody.querySelectorAll('.prog-detail-desc').forEach(el => window.glossary.applyDom(el));
}

function _kindLabel(kind) {
  return kind === 'sub' ? 'Subclass' : kind === 'species' ? 'Origin' : kind === 'background' ? 'Background' : kind === 'shared' ? 'General' : kind === 'subclass' ? 'Feature' : 'Class';
}
function _featKey(scope, level, name) { return `${scope}|${level}|${name}`; }
function _isChoiceFeat(feat) { return feat.choice === true || feat._kind === 'shared'; }
function _totalLevel(ctx) {
  return ctx.level || ((ctx.klasseLevel || 0) + (ctx.multiKlasseLevel || 0)) || ctx.klasseLevel || 1;
}

// ── Data zoeken ────────────────────────────────────────────────────
function _findClass(prog, name) {
  if (!prog?.classes || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(prog.classes)) {
    if (_norm(key) === n) return { key, data };
    if ((data.aliassen || []).some(a => _norm(a) === n)) return { key, data };
  }
  for (const [key, data] of Object.entries(prog.classes)) {
    if (n.startsWith(_norm(key))) return { key, data };
  }
  return null;
}
function _findSpecies(prog, name) {
  if (!prog?.species || !name) return null;
  const n = _norm(name);
  for (const [key, data] of Object.entries(prog.species)) {
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
function _featuresForLevel(prog, classData, subclass, level) {
  const out = [];
  const g = prog?.gedeeld || {};
  if ((g.subclassLevel || 3) === level) {
    out.push({ name: classData.subclassLabel || 'Subclass', desc: subclass ? '' : 'Choose your subclass.', _kind: 'subclass' });
  }
  for (const f of (classData.levels?.[level] || [])) out.push(f);
  if (subclass) for (const f of (subclass.data.levels?.[level] || [])) out.push({ ...f, _kind: 'sub' });
  if ((g.asiLevels || [4, 8, 12, 16]).includes(level)) {
    out.push({ name: 'Ability Score Improvement', desc: '', _kind: 'shared' });
  }
  if ((g.epicBoonLevel || 19) === level) {
    out.push({ name: 'Epic Boon', desc: '', _kind: 'shared' });
  }
  return out;
}

// ── Module-state (minimaal) ────────────────────────────────────────
let _view      = (typeof localStorage !== 'undefined' && localStorage.getItem('progView')) || 'tijdlijn';
let _favFilter = false;
let _featIndex = [];   // voor kaart-detail modal

// ── Hoofdfunctie ───────────────────────────────────────────────────
export async function renderProgressie(container, ctx) {
  if (!container) return;

  // Stabiel doel-element: gebruik altijd het element met dit ID uit de live DOM
  const getEl = () => (container.id ? document.getElementById(container.id) : null) || container;

  getEl().innerHTML = `<p style="color:#5a3010;text-align:center;padding:24px;
    font-family:'Cinzel',serif;font-size:13px;background:#f5edda;
    border-radius:10px;border:1px solid #c4a87a">Progressie laden…</p>`;

  // Data ophalen (progression + SRD + backgrounds parallel)
  let prog;
  try {
    [prog] = await Promise.all([api.progression(), _loadSrd(), _loadBackgrounds()]);
  } catch(e) {
    getEl().innerHTML = `<p style="color:#8a3020;padding:16px;
      font-family:'IM Fell English',serif;font-style:italic">
      Kon progressiedata niet laden. Ververs de pagina of probeer opnieuw.<br>
      <small style="opacity:.7">${esc(e.message)}</small></p>`;
    return;
  }
  if (!prog?.classes) {
    getEl().innerHTML = `<p style="color:#8a3020;padding:16px;font-family:'IM Fell English',serif">
      Geen progressiedata beschikbaar.</p>`;
    return;
  }

  const charId   = ctx.charId || null;
  const favs     = new Set(Array.isArray(ctx.favorites) ? ctx.favorites : []);
  const choices  = (ctx.choices && typeof ctx.choices === 'object') ? ctx.choices : {};
  _curFeats = (prog.feats && typeof prog.feats === 'object') ? prog.feats : null;
  _curBackgrounds = (prog.backgrounds && Object.keys(prog.backgrounds || {}).length) ? prog.backgrounds : _bgLib;
  _featIndex = [];

  // HTML bouwen
  const html = _buildPanel(prog, ctx, charId, favs, choices);
  getEl().innerHTML = html;

  // Glossary hover toepassen op beschrijvingen
  if (window.glossary?.applyDom) {
    getEl().querySelectorAll('.prog-feat-desc, .prog-feat-confirmed-desc').forEach(el => {
      window.glossary.applyDom(el);
    });
  }

  // Sla state op voor re-renders
  _lastRenderArgs = { container, ctx, prog };

  // Sync nieuw ontgrendelde features naar Kenmerken & Eigenschappen
  if (charId) _syncNewFeaturesToTraits(prog, ctx, charId);
}

// Bewaar laatste args zodat refresh() werkt
let _lastRenderArgs = null;
function _refresh() {
  if (!_lastRenderArgs) return;
  const scrollY = window.scrollY;
  renderProgressie(_lastRenderArgs.container, _lastRenderArgs.ctx)
    .then(() => window.scrollTo({ top: scrollY, behavior: 'instant' }))
    .catch(() => {});
}

// ── Sync nieuw ontgrendelde features naar Kenmerken & Eigenschappen ──
// Houdt per speler bij welk level al gesynchroniseerd is (in localStorage).
// Bij level-up worden de nieuwe features automatisch als pinned trait toegevoegd.
async function _syncNewFeaturesToTraits(prog, ctx, charId) {
  if (!charId || !ctx.klasse) return;
  const storageKey = `prog-synced-${charId}`;
  let synced;
  try { synced = JSON.parse(localStorage.getItem(storageKey) || '{}'); }
  catch { synced = {}; }

  const currentLevel = parseInt(ctx.klasseLevel) || parseInt(ctx.level) || 1;
  const lastSynced   = parseInt(synced[ctx.klasse]) || 0;
  if (currentLevel <= lastSynced) return; // niets nieuws

  const cls = _findClass(prog, ctx.klasse);
  if (!cls) return;
  const subclass = _findSubclass(cls.data, ctx.subclass);

  // Verzamel features voor de nieuwe levels (lastSynced+1 t/m currentLevel)
  const newFeatures = [];
  for (let lvl = lastSynced + 1; lvl <= currentLevel; lvl++) {
    for (const f of _featuresForLevel(prog, cls.data, subclass, lvl)) {
      // Sla ASI/EpicBoon en subklasse-marker over (speler kiest zelf)
      if (f._kind === 'shared' || f._kind === 'subclass') continue;
      const featName = (f._kind === 'sub' && subclass)
        ? `${f.name} (${subclass.key})`
        : f.name;
      const featDesc = f.desc || _srdDesc(f.name, cls.key) || '';
      newFeatures.push({
        name:   featName,
        meta:   `${cls.key} · Lv. ${lvl}`,   // geen esc — plain text opgeslagen
        desc:   featDesc,
        source: 'progression',
        index:  `progression-${cls.key}-${lvl}-${f.name}`.replace(/[^a-z0-9-]/gi, '_'),
      });
    }
  }

  // Altijd de synced-level bijwerken, ook als er geen features zijn (bv. alleen ASI-levels)
  synced[ctx.klasse] = currentLevel;
  localStorage.setItem(storageKey, JSON.stringify(synced));

  if (!newFeatures.length) return;

  // Voeg toe via API — server dedupliceert op index zodat dit veilig herhaald kan worden
  let added = 0;
  for (const feat of newFeatures) {
    try {
      const r = await api.addPlayerTrait(charId, feat);
      if (!r?.duplicate) added++;
    } catch { /* stille fout per feature — ga door met de rest */ }
  }
  if (added > 0) {
    _toast(`${added} nieuwe feature${added === 1 ? '' : 's'} toegevoegd aan Kenmerken & Eigenschappen.`);
  }
}

// ── Panel opbouwen ─────────────────────────────────────────────────
function _buildPanel(prog, ctx, charId, favs, choices) {
  const cls     = _findClass(prog, ctx.klasse);
  const species = _findSpecies(prog, ctx.species);
  const background = _findBackground(_curBackgrounds, ctx.background);
  const kaarten = false; // kaartweergave verwijderd

  const head = `
    <div class="prog-head">
      <h3 class="prog-title">${icon('sparkles')} Progressie</h3>
      <div class="prog-head-right">
        <div class="prog-view-toggle"></div>
        ${charId ? `<button class="prog-fav-toggle${_favFilter ? ' active' : ''}"
          onclick="window.progressie.toggleFavFilter()" title="Toon alleen favorieten"
          >${_favFilter ? '★' : '☆'}</button>` : ''}
        ${prog.samenvatting ? `<span class="prog-bron"
          title="Samengevat startpunt — controleer/pas aan in de editor">samengevat</span>` : ''}
        ${isDM() ? `<button class="prog-edit-btn" onclick="window.progressie.openEditor()"
          title="Klassen, subklassen en soorten bewerken — inclusief afbeeldingen per ability"
          >${icon('pencil')} Bewerk</button>` : ''}
        ${window._helpBtn?.('progressie') ?? ''}
      </div>
    </div>`;

  let body = '';

  // Soort
  if (species) {
    body += kaarten ? _speciesCards(prog, species, ctx, charId, favs) : _speciesBlock(species, ctx, charId, favs);
  } else if (ctx.species) {
    body += `<div class="prog-missing">Geen data voor origin <strong>${esc(ctx.species)}</strong>.${
      isDM() ? ' Voeg toe in de editor.' : ''}</div>`;
  }

  // Background
  if (background) {
    body += _backgroundBlock(background, charId, favs);
  } else if (ctx.background) {
    body += `<div class="prog-missing">Geen data voor background <strong>${esc(ctx.background)}</strong>.${
      isDM() ? ' Voeg toe in de editor.' : ''}</div>`;
  }

  // Hoofdklasse
  if (cls) {
    body += kaarten
      ? _classCards(prog, cls, ctx.subclass, ctx.klasseLevel || ctx.level || 1, false, charId, favs, choices)
      : _classTimeline(prog, cls, ctx.subclass, ctx.klasseLevel || ctx.level || 1, false, charId, favs, choices);
  } else if (ctx.klasse) {
    body += `<div class="prog-missing">Geen progressie-data voor klasse <strong>${esc(ctx.klasse)}</strong>.${
      isDM() ? ' Voeg toe in de editor of pas de naam aan.' : ' Vraag de DM om deze klasse toe te voegen.'}</div>`;
  } else {
    body += `<div class="prog-missing">Vul je klasse in bij je profiel om je progressie te zien.</div>`;
  }

  // Multiclass
  if (ctx.multiclass && ctx.multiKlasse) {
    const cls2 = _findClass(prog, ctx.multiKlasse);
    if (cls2) {
      body += kaarten
        ? _classCards(prog, cls2, ctx.subclass, ctx.multiKlasseLevel || 1, true, charId, favs, choices)
        : _classTimeline(prog, cls2, ctx.subclass, ctx.multiKlasseLevel || 1, true, charId, favs, choices);
    } else {
      body += `<div class="prog-missing">Geen data voor multiclass <strong>${esc(ctx.multiKlasse)}</strong>.</div>`;
    }
  }

  // Lege favorieten-melding
  if (_favFilter && !_featIndex.some(f => f._fav)) {
    body += `<div class="prog-missing">Nog geen favorieten — tik op het sterretje van een kaart.</div>`;
  }

  return `<div class="prog-panel">${head}${body}</div>`;
}

// ── Feat-lijst voor de datalist ───────────────────────────────────
// Origin Feats (niveau 1 / ASI-vervanging), General Feats, Epic Boons.
const _ORIGIN_FEATS = ['Alert','Crafter','Healer','Lucky','Magic Initiate','Savage Attacker','Skilled','Tavern Brawler','Tough'];
const _GENERAL_FEATS = [
  'Ability Score Improvement','Actor','Alert','Athlete','Charger','Crossbow Expert','Crusher',
  'Defensive Duelist','Dual Wielder','Dungeon Delver','Durable','Elemental Adept','Fey Touched',
  'Grappler','Great Weapon Master','Healer','Heavily Armored','Heavy Armor Master',
  'Inspiring Leader','Keen Mind','Lightly Armored','Lucky','Mage Slayer','Magic Initiate',
  'Martial Weapon Training','Medium Armor Master','Mobile','Moderately Armored',
  'Mounted Combatant','Observant','Piercer','Poisoner','Polearm Master','Resilient',
  'Ritual Caster','Savage Attacker','Sentinel','Shadow-Touched','Sharpshooter',
  'Shield Master','Skilled','Skulker','Slasher','Speedy','Spell Sniper',
  'Tavern Brawler','Telekinetic','Telepathic','Tough','War Caster','Weapon Master',
];
const _EPIC_FEATS = [
  'Boon of Combat Prowess','Boon of Dimensional Travel','Boon of Energy Resistance',
  'Boon of Fate','Boon of Fortitude','Boon of Irresistible Offense','Boon of Recovery',
  'Boon of Skill','Boon of Speed','Boon of Spell Recall','Boon of the Night Spirit','Boon of Truesight',
];

// Feat-bibliotheek uit de campagnedata (door DM bewerkbaar). Valt terug op de
// ingebouwde lijsten + SRD-beschrijvingen wanneer er nog niets is aangepast.
let _curFeats = null; // { general:[{name,desc}], epic:[{name,desc}] } — gezet bij render
function _featNames(isEpic) {
  const lib = isEpic ? _curFeats?.epic : _curFeats?.general;
  if (Array.isArray(lib) && lib.length) return lib.map(f => f.name).filter(Boolean);
  return isEpic ? _EPIC_FEATS : _GENERAL_FEATS;
}
function _featDesc(name) {
  for (const grp of [_curFeats?.general, _curFeats?.epic]) {
    const hit = Array.isArray(grp) && grp.find(f => f.name === name);
    if (hit && hit.desc) return hit.desc;
  }
  return _srdDesc(name, 'feat') || _srdDesc(name) || '';
}
// Bouw een verse feat-bibliotheek uit de ingebouwde lijsten + SRD-tekst (voor de editor-seed).
function _seedFeatLibrary() {
  const mk = names => names.map(n => ({ name: n, desc: _srdDesc(n, 'feat') || _srdDesc(n) || '' }));
  return { general: mk(_GENERAL_FEATS), epic: mk(_EPIC_FEATS) };
}

// ── Tijdlijn-weergave ──────────────────────────────────────────────
// key     = featKey
// unlocked = lvl <= charLevel
// choices  = { key → waarde }
// charId   = speler-ID
// featName = 'Ability Score Improvement' | 'Epic Boon' | andere feature
// lvl      = level waarop deze feature zit
// clsName  = klassenaam (voor context)
// otherFeats = andere feature-namen op hetzelfde level (voor #4 context)
function _choiceField(key, unlocked, choices, charId, featName, lvl, clsName, otherFeats) {
  if (!charId) return '';
  const saved = choices[key] || '';

  const isASI  = featName === 'Ability Score Improvement';
  const isEpic = featName === 'Epic Boon';

  if (!isASI && !isEpic) {
    // Gewoon tekstveld voor andere keuzes
    return `<div class="prog-choice-row">
      <input class="prog-choice-input" type="text"
        placeholder="Noteer jouw keuze…"
        value="${esc(saved)}"
        ${!unlocked ? 'disabled' : ''}
        onchange="event.stopPropagation();window.progressie.saveChoice('${esc(key)}',this.value)"
        onclick="event.stopPropagation()">
    </div>`;
  }

  // ASI / Epic Boon: feat-picker
  const featOptions = _featNames(isEpic);
  const safeKey = key.replace(/[^a-z0-9]/gi, '_');

  // Al bevestigd → toon feat prominent, kleine Wijzigen-knop
  if (saved && unlocked) {
    const featDesc = _featDesc(saved);
    return `<div class="prog-feat-confirmed" onclick="event.stopPropagation()">
      <span class="prog-feat-confirmed-label">${icon('check')} Gekozen feat:</span>
      <button type="button" class="prog-feat-confirmed-name"
        onclick="event.stopPropagation();window.progressie.openFeatDetail('${esc(saved)}')"
        title="Klik voor beschrijving">${esc(saved)} ${icon('eye', {cls:'prog-feat-eye'})}</button>
      ${featDesc ? `<div class="prog-feat-confirmed-desc">${_md(featDesc)}</div>` : ''}
      <button type="button" class="prog-feat-wijzigen"
        onclick="event.stopPropagation();window.progressie.clearFeat('${esc(key)}')"
        title="Change choice">${icon('pencil')} Change</button>
    </div>`;
  }

  // Picker: dropdown + preview-zone
  const contextHtml = (otherFeats && otherFeats.length)
    ? `<div class="prog-feat-context">Ook op level ${lvl}: ${otherFeats.map(n => `<em>${esc(n)}</em>`).join(', ')}</div>`
    : '';

  return `<div class="prog-choice-row prog-choice-row--feat" onclick="event.stopPropagation()">
    ${contextHtml}
    <select class="prog-feat-select" id="prog-feat-sel-${safeKey}"
      ${!unlocked ? 'disabled' : ''}
      onchange="event.stopPropagation();window.progressie.previewFeat('${esc(key)}','${safeKey}',this.value,'${esc(clsName||'')}',${lvl||0})">
      <option value="">— Choose a feat —</option>
      <optgroup label="${isEpic ? 'Epic Boons' : 'General feats'}">
        ${featOptions.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
      </optgroup>
      <option value="__custom__">Anders (typ zelf)…</option>
    </select>
    <div class="prog-feat-preview" id="prog-feat-prev-${safeKey}"></div>
  </div>`;
}

function _classTimeline(prog, cls, subclassName, charLevel, isMulti, charId, favs, choices) {
  const subclass = _findSubclass(cls.data, subclassName);
  const artKey   = _classArtKey(cls.key);
  const rows = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    const feats = _featuresForLevel(prog, cls.data, subclass, lvl);
    if (!feats.length) continue;
    const unlocked  = lvl <= charLevel;
    const isCurrent = lvl === charLevel;
    const otherNames = feats.filter(x => !_isChoiceFeat(x)).map(x => x.name);
    const featHtml  = feats.map(f => {
      // Voeg toe aan featIndex zodat openFeature() en toggleFav() werken
      const cat  = _resolveCat(f, f._kind);
      const fKey = _featKey(cls.key, lvl, f.name);
      const fav  = favs.has(fKey);
      if (_favFilter && !fav) return '';
      const fi   = _featIndex.push({
        name: f._kind === 'subclass' && subclass ? `${f.name}: ${subclass.key}` : f.name,
        desc: f.desc || _srdDesc(f.name, cls.key) || '', level: lvl, artKey, kind: f._kind,
        cat, img: f.img, imgKind: f.imgKind, key: fKey, _fav: fav, clsName: cls.key,
      }) - 1;

      let label = esc(f.name);
      if (f._kind === 'subclass' && subclass) label = `${esc(f.name)}: ${esc(subclass.key)}`;
      const cls2 = f._kind === 'shared' ? ' prog-feat--shared' : f._kind === 'sub' ? ' prog-feat--sub' : '';
      const choiceHtml = _isChoiceFeat(f) ? _choiceField(fKey, unlocked, choices, charId, f.name, lvl, cls.key, otherNames) : '';

      // Favoriet-knop (alleen voor ingelogde spelers)
      const favBtn = charId ? `<button type="button" class="prog-tl-fav${fav ? ' on' : ''}"
        onclick="event.stopPropagation();window.progressie.toggleFav(${fi})"
        title="${fav ? 'Favoriet verwijderen' : 'Favoriet'}">${fav ? '★' : '☆'}</button>` : '';

      return `<div class="prog-feat${cls2}">
        <div class="prog-feat-header">
          <button type="button" class="prog-feat-name-btn"
            onclick="window.progressie.openFeature(${fi})">
            ${label}${f._kind === 'sub' ? ' <span class="prog-feat-tag">Subclass</span>' : ''}
          </button>
          ${favBtn}
        </div>
        ${choiceHtml}
      </div>`;
    }).join('');
    if (!featHtml.trim()) continue;
    rows.push(`
      <div class="prog-row${unlocked ? ' prog-unlocked' : ' prog-preview'}${isCurrent ? ' prog-current' : ''}">
        <div class="prog-lvl"><span class="prog-lvl-num">${lvl}</span></div>
        <div class="prog-feats">${featHtml}</div>
      </div>`);
  }
  const subLabel = subclassName ? (subclass ? esc(subclass.key) : `${esc(subclassName)} (geen data)`) : 'nog geen subclass';
  return `
    <div class="prog-class${isMulti ? ' prog-class--multi' : ''}">
      <div class="prog-sub-title">
        ${icon('crossed-swords', { cls: 'icon-gi' })} ${esc(cls.key)}
        <span class="prog-sub-meta">level ${charLevel} · ${subLabel}</span>
      </div>
      <div class="prog-timeline">${rows.join('')}</div>
    </div>`;
}

function _speciesBlock(species, ctx, charId, favs) {
  const charLvl = _totalLevel(ctx);
  const levels  = species.data.levels || {};
  const rows    = Object.keys(levels).map(Number).sort((a, b) => a - b).flatMap(lvl =>
    levels[lvl].map(f => {
      const locked = lvl > charLvl;
      const fKey   = _featKey(species.key, lvl, f.name);
      const fav    = !!favs?.has(fKey);
      const fi = _featIndex.push({
        name: f.name,
        desc: f.desc || _srdDesc(f.name, species.key) || '',
        level: lvl, kind: 'species', cat: _resolveCat(f, 'species'),
        key: fKey, _fav: fav, clsName: species.key,
      }) - 1;
      const favBtn = charId ? `<button type="button" class="prog-tl-fav${fav ? ' on' : ''}"
        onclick="event.stopPropagation();window.progressie.toggleFav(${fi})"
        title="${fav ? 'Favoriet verwijderen' : 'Favoriet'}">${fav ? '★' : '☆'}</button>` : '';
      return `<div class="prog-trait${locked ? ' prog-locked' : ''}">
        <div class="prog-feat-header">
          <button type="button" class="prog-feat-name-btn"
            onclick="window.progressie.openFeature(${fi})">
            ${esc(f.name)}${lvl > 1 ? ` <span class="prog-feat-tag">lvl ${lvl}</span>` : ''}
          </button>
          ${favBtn}
        </div>
      </div>`;
    })
  ).join('');
  return `
    <div class="prog-species">
      <div class="prog-sub-title">${icon('user')} ${esc(species.key)} <span class="prog-sub-meta">Origin</span></div>
      <div class="prog-traits">${rows}</div>
    </div>`;
}

function _backgroundBlock(background, charId, favs) {
  const feats = background.data.levels?.[1] || background.data.levels?.['1'] || [];
  const rows  = feats.map(f => {
    const fKey = _featKey('bg:' + background.key, 1, f.name);
    const fav  = !!favs?.has(fKey);
    const fi = _featIndex.push({
      name: f.name, desc: f.desc || '',
      level: 1, kind: 'background', cat: _resolveCat(f, 'background'),
      key: fKey, _fav: fav, clsName: background.key,
    }) - 1;
    const favBtn = charId ? `<button type="button" class="prog-tl-fav${fav ? ' on' : ''}"
      onclick="event.stopPropagation();window.progressie.toggleFav(${fi})"
      title="${fav ? 'Favoriet verwijderen' : 'Favoriet'}">${fav ? '★' : '☆'}</button>` : '';
    return `<div class="prog-trait">
      <div class="prog-feat-header">
        <button type="button" class="prog-feat-name-btn"
          onclick="window.progressie.openFeature(${fi})">${esc(f.name)}</button>
        ${favBtn}
      </div>
    </div>`;
  }).join('');
  return `
    <div class="prog-species prog-background">
      <div class="prog-sub-title">${icon('scroll-text')} ${esc(background.key)} <span class="prog-sub-meta">Background</span></div>
      <div class="prog-traits">${rows}</div>
    </div>`;
}

// ── Kaartweergave ──────────────────────────────────────────────────
function _mediaArt(feat, artKey, big) {
  if (feat?.img) {
    const url = api.fileUrl(feat.img);
    if (feat.imgKind === 'video')
      return `<video class="prog-card-art${big ? ' prog-detail-art' : ''}" src="${url}" autoplay muted loop playsinline></video>`;
    return `<div class="prog-card-art${big ? ' prog-detail-art' : ''}" style="background-image:url('${url}')"></div>`;
  }
  if (artKey)
    return `<div class="prog-card-art${big ? ' prog-detail-art' : ''}" style="background-image:url('/img/classes/${artKey}.png')"></div>`;
  return '';
}

function _featCard(feat, level, artKey, kind, unlocked, scope, charId, favs, choices) {
  const cat = _resolveCat(feat, kind);
  const key = _featKey(scope, level, feat.name);
  const fav = favs.has(key);
  if (_favFilter && !fav) return '';
  const clsName = scope?.includes(':') ? null : scope; // 'soort:Human' is geen klassenaam
  const fi   = _featIndex.push({ name: feat.name, desc: feat.desc || _srdDesc(feat.name, clsName) || '', level, artKey, kind, cat,
                                  img: feat.img, imgKind: feat.imgKind, key, _fav: fav, clsName }) - 1;
  const art  = _mediaArt(feat, artKey, false);
  const star = charId
    ? `<span class="prog-card-fav${fav ? ' on' : ''}" onclick="event.stopPropagation();window.progressie.toggleFav(${fi})"
        title="Favoriet">${fav ? '★' : '☆'}</span>` : '';
  return `
    <button class="prog-card${unlocked ? '' : ' prog-card--locked'} prog-card--${cat.id}${fav ? ' prog-card--fav' : ''}"
      onclick="window.progressie.openFeature(${fi})">
      ${art}<div class="prog-card-veil"></div>
      <span class="prog-card-cat" title="${esc(cat.label)}">${icon(cat.icon)}</span>
      <span class="prog-card-lvl">${level}</span>
      ${star}
      ${unlocked ? '' : `<span class="prog-card-lock">${icon('lock')}</span>`}
      ${(_isChoiceFeat(feat) && choices[key]) ? `<span class="prog-card-choice">${esc(choices[key])}</span>` : ''}
      <div class="prog-card-foot">
        <span class="prog-card-name">${esc(feat.name)}</span>
        <span class="prog-card-chip prog-chip--${kind || 'class'}">${_kindLabel(kind)}</span>
      </div>
    </button>`;
}

function _classCards(prog, cls, subclassName, charLevel, isMulti, charId, favs, choices) {
  const subclass = _findSubclass(cls.data, subclassName);
  const artKey   = _classArtKey(cls.key);
  const cards    = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    for (const f of _featuresForLevel(prog, cls.data, subclass, lvl)) {
      if (f._kind === 'subclass' && !subclass) continue;
      const feat = (f._kind === 'subclass' && subclass)
        ? { name: `${f.name}: ${subclass.key}`, desc: f.desc } : f;
      cards.push(_featCard(feat, lvl, artKey, f._kind, lvl <= charLevel, cls.key, charId, favs, choices));
    }
  }
  const subLabel = subclassName ? (subclass ? esc(subclass.key) : `${esc(subclassName)} (geen data)`) : 'nog geen subclass';
  return `
    <div class="prog-class${isMulti ? ' prog-class--multi' : ''}">
      <div class="prog-sub-title">${icon('crossed-swords', { cls: 'icon-gi' })} ${esc(cls.key)}
        <span class="prog-sub-meta">level ${charLevel} · ${subLabel}</span></div>
      <div class="prog-cardgrid">${cards.join('')}</div>
    </div>`;
}

function _speciesCards(prog, species, ctx, charId, favs) {
  const charLvl = _totalLevel(ctx);
  const levels  = species.data.levels || {};
  const cards   = [];
  for (const lvl of Object.keys(levels).map(Number).sort((a, b) => a - b)) {
    for (const f of levels[lvl]) {
      cards.push(_featCard(f, lvl, null, 'species', lvl <= charLvl, 'soort:' + species.key, charId, favs, {}));
    }
  }
  return `
    <div class="prog-species">
      <div class="prog-sub-title">${icon('user')} ${esc(species.key)} <span class="prog-sub-meta">Origin</span></div>
      <div class="prog-cardgrid">${cards.join('')}</div>
    </div>`;
}


// ── Publieke API (window.progressie) ──────────────────────────────
window.progressie = {
  // Aangeroepen vanuit app.js na level-/klasse-wijziging, zonder dat het Progressie-tabblad open hoeft te zijn.
  async triggerSync(charId, ctx) {
    if (!charId || !ctx?.klasse) return;
    try {
      const prog = await api.progression();
      if (prog?.classes) await _syncNewFeaturesToTraits(prog, ctx, charId);
    } catch { /* stille fout — sync is best-effort */ }
  },

  setView(v) {
    _view = (v === 'kaarten') ? 'kaarten' : 'tijdlijn';
    try { localStorage.setItem('progView', _view); } catch {}
    _refresh();
  },

  toggleFavFilter() {
    _favFilter = !_favFilter;
    _refresh();
  },

  // Feat geselecteerd in dropdown → toon beschrijving + bevestig-knop
  async previewFeat(key, safeKey, featName, clsName, lvl) {
    const prevEl = document.getElementById(`prog-feat-prev-${safeKey}`);
    if (!prevEl) return;
    if (!featName) { prevEl.innerHTML = ''; return; }

    const actionsHtml = (name) => `
      <div class="prog-feat-actions">
        <button type="button" class="prog-feat-confirm"
          onclick="event.stopPropagation();window.progressie.confirmFeat('${esc(key)}','${safeKey}','${esc(name)}','${esc(clsName)}',${lvl})">
          ${icon('check')} Bevestigen
        </button>
        <button type="button" class="prog-feat-cancel"
          onclick="event.stopPropagation();document.getElementById('prog-feat-sel-${safeKey}').value='';document.getElementById('prog-feat-prev-${safeKey}').innerHTML=''">
          Annuleren
        </button>
      </div>`;

    if (featName === '__custom__') {
      prevEl.innerHTML = `<div class="prog-feat-preview-body">
        <input class="prog-choice-input" type="text" placeholder="Naam van de feat…"
          style="margin-top:6px"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window.progressie.confirmFeat('${esc(key)}','${safeKey}',this.value,'${esc(clsName)}',${lvl})}">
        ${actionsHtml('__custom_input__')}
      </div>`;
      // Overschrijf confirm-knop met versie die input leest
      const btn = prevEl.querySelector('.prog-feat-confirm');
      if (btn) btn.onclick = (e) => {
        e.stopPropagation();
        const val = prevEl.querySelector('input')?.value?.trim();
        if (val) window.progressie.confirmFeat(key, safeKey, val, clsName, lvl);
      };
      prevEl.querySelector('input')?.focus();
      return;
    }

    // Toon laad-indicator terwijl we de beschrijving ophalen
    prevEl.innerHTML = `<div class="prog-feat-preview-body">
      <strong class="prog-feat-preview-name">${esc(featName)}</strong>
      <p style="font-style:italic;color:#9a8060;font-size:12px">Beschrijving laden…</p>
    </div>`;

    // SRD laden en beschrijving zoeken
    await _loadSrd();
    const desc = _featDesc(featName);

    prevEl.innerHTML = `<div class="prog-feat-preview-body">
      <strong class="prog-feat-preview-name">${esc(featName)}</strong>
      ${desc
        ? `<div class="prog-feat-preview-desc">${_md(desc)}</div>`
        : `<p style="font-style:italic;color:#8a7050;font-size:12px">Geen beschrijving beschikbaar — zie de Player's Handbook.</p>`}
      ${actionsHtml(featName)}
    </div>`;
  },

  // Feat bevestigd → opslaan + toevoegen aan personage-kenmerken (karakter-tab)
  async confirmFeat(key, safeKey, featName, clsName, lvl) {
    if (!featName || featName === '__custom__') return;
    const ctx = _lastRenderArgs?.ctx;
    if (!ctx?.charId) return;

    // 1. Sla op in featChoices
    await window.progressie.saveChoice(key, featName);

    // 2. Voeg toe aan Kenmerken & Eigenschappen (personage-tab, punt #3)
    try {
      const featDesc = _featDesc(featName);
      await api.addPlayerTrait(ctx.charId, {
        name:   featName,
        meta:   `Feat · Lv. ${lvl}`,
        desc:   featDesc,
        source: 'progression',
        index:  `progression-${key}`,
      });
    } catch(e) { /* stille fout — feat keuze is al opgeslagen */ }

    _refresh();
  },

  // Keuze wissen → terug naar picker
  async clearFeat(key) {
    await window.progressie.saveChoice(key, '');
    _refresh();
  },

  // Beschrijving van een feat tonen in een modal
  // Zorgt eerst dat SRD geladen is, dan direct uit cache — geen externe API-calls meer
  async openFeatDetail(featName) {
    // Altijd eerst laden, ook als er eerder een timing-probleem was
    await _loadSrd();

    const _setBody = (html) => {
      const mbody = document.getElementById('m-body');
      if (!mbody) return;
      mbody.innerHTML = html;
      _applyGlossaryToModal();
    };

    const desc = _featDesc(featName);

    window.app.openModal(featName, 'Feat',
      desc
        ? `<div class="prog-detail-desc">${_md(desc)}</div>`
        : `<p class="prog-detail-desc" style="font-style:italic;color:#8a7050">
             Deze feat maakt geen deel uit van de vrije SRD.<br>
             Zie de <em>Player's Handbook</em> voor de volledige beschrijving.
           </p>`
    );

    if (desc) _applyGlossaryToModal();
  },

  openFeature(fi) {
    const f = _featIndex[fi];
    if (!f) return;
    const favBtn = _lastRenderArgs?.ctx?.charId
      ? `<button class="prog-detail-fav${f._fav ? ' on' : ''}" onclick="window.progressie.toggleFav(${fi})">${f._fav ? '★ Favoriet' : '☆ Favoriet'}</button>` : '';
    const isChoice = _isChoiceFeat(f);
    const choices  = _lastRenderArgs?.ctx?.choices || {};
    const charId   = _lastRenderArgs?.ctx?.charId || null;
    const detailChoice = isChoice ? `
      <div class="prog-detail-choice">
        <label class="prog-detail-choice-label">${icon('pencil')} Jouw keuze</label>
        ${_choiceField(f.key, true, choices, charId, f.name)}
      </div>` : '';
    window.app.openModal(f.name, '', `
      <div class="prog-detail">
        <div class="prog-detail-body">
          <div class="prog-detail-chips">
            <span class="prog-detail-chip">${icon(f.cat.icon)} ${esc(f.cat.label)}</span>
            <span class="prog-detail-chip">Level ${f.level}</span>
            <span class="prog-detail-chip prog-chip--${f.kind || 'class'}">${_kindLabel(f.kind)}</span>
            ${favBtn}
          </div>
          <div class="prog-detail-desc">${_md(f.desc || _srdDesc(f.name, f.clsName) || 'Geen beschrijving.')}</div>
          ${detailChoice}
        </div>
      </div>`);
    _applyGlossaryToModal();
  },

  async toggleFav(fi) {
    const ctx = _lastRenderArgs?.ctx;
    if (!ctx?.charId) return;
    const f = _featIndex[fi];
    if (!f) return;
    const favs = new Set(Array.isArray(ctx.favorites) ? ctx.favorites : []);
    if (favs.has(f.key)) favs.delete(f.key); else favs.add(f.key);
    ctx.favorites = [...favs];
    if (_lastRenderArgs) _lastRenderArgs.ctx = ctx;
    try { await api.patchPlayerProfile(ctx.charId, { featFavorites: JSON.stringify(ctx.favorites) }); } catch {}
    if (document.querySelector('#modal-overlay.active .prog-detail')) window.app.closeModal();
    _refresh();
  },

  async saveChoice(key, value) {
    const ctx = _lastRenderArgs?.ctx;
    if (!ctx?.charId) return;
    if (!ctx.choices) ctx.choices = {};
    if (value?.trim()) ctx.choices[key] = value.trim();
    else delete ctx.choices[key];
    if (_lastRenderArgs) _lastRenderArgs.ctx = ctx;
    try { await api.patchPlayerProfile(ctx.charId, { featChoices: JSON.stringify(ctx.choices) }); } catch {}
    _refresh();
  },

  // ── DM-editor ─────────────────────────────────────────────────
  async openEditor() {
    const [raw] = await Promise.all([api.progression().catch(() => null), _loadSrd(), _loadBackgrounds()]);
    if (!raw) { alert('Kon progressiedata niet laden.'); return; }
    _edit = JSON.parse(JSON.stringify(raw));
    if (!_edit.classes) _edit.classes = {};
    if (!_edit.species) _edit.species = {};
    if (!_edit.gedeeld) _edit.gedeeld = { asiLevels: [4,8,12,16], subclassLevel: 3, epicBoonLevel: 19 };
    if (!_edit.feats || typeof _edit.feats !== 'object') _edit.feats = _seedFeatLibrary();
    if (!Array.isArray(_edit.feats.general)) _edit.feats.general = [];
    if (!Array.isArray(_edit.feats.epic))    _edit.feats.epic = [];
    if (!_edit.backgrounds || typeof _edit.backgrounds !== 'object' || !Object.keys(_edit.backgrounds).length)
      _edit.backgrounds = JSON.parse(JSON.stringify(_bgLib || {}));
    _editDirty = false;
    const firstClass = Object.keys(_edit.classes)[0];
    _editSel = firstClass ? { type: 'class', key: firstClass } : null;
    window.app.openModal('Progressie bewerken', 'Klassen, subklassen, soorten en feats — startpunt, vrij aan te passen', _editorHtml());
    document.querySelector('#modal-overlay .modal')?.classList.add('modal--wide');
  },
  selectEntry(type, key) { _editSel = { type, key }; _refreshEditor(); },
  addClass() {
    const naam = prompt('Naam van de nieuwe klasse:'); if (!naam) return;
    if (_edit.classes[naam]) { alert('Bestaat al.'); return; }
    _edit.classes[naam] = { subclassLabel: 'Subklasse', subclassLevel: 3, levels: {}, subclasses: {} };
    _editSel = { type: 'class', key: naam }; _editDirty = true; _refreshEditor();
  },
  addSpecies() {
    const naam = prompt('Naam van de nieuwe soort/ras:'); if (!naam) return;
    if (_edit.species[naam]) { alert('Bestaat al.'); return; }
    _edit.species[naam] = { levels: { '1': [] } };
    _editSel = { type: 'species', key: naam }; _editDirty = true; _refreshEditor();
  },
  addBackground() {
    const naam = prompt('Naam van de nieuwe background:'); if (!naam) return;
    if (!_edit.backgrounds) _edit.backgrounds = {};
    if (_edit.backgrounds[naam]) { alert('Bestaat al.'); return; }
    _edit.backgrounds[naam] = { levels: { '1': [] } };
    _editSel = { type: 'background', key: naam }; _editDirty = true; _refreshEditor();
  },
  removeEntry() {
    if (!_editSel) return;
    if (!confirm(`"${_editSel.key}" verwijderen uit de progressie?`)) return;
    if (_editSel.type === 'class') delete _edit.classes[_editSel.key];
    else if (_editSel.type === 'background') delete _edit.backgrounds[_editSel.key];
    else delete _edit.species[_editSel.key];
    _editSel = null; _editDirty = true; _refreshEditor();
  },
  addSubclass() {
    if (_editSel?.type !== 'class') return;
    const naam = prompt('Naam van de subklasse:'); if (!naam) return;
    const c = _edit.classes[_editSel.key];
    if (!c.subclasses) c.subclasses = {};
    if (c.subclasses[naam]) { alert('Bestaat al.'); return; }
    c.subclasses[naam] = { levels: {} }; _editDirty = true; _refreshEditor();
  },
  removeSubclass(name) {
    if (_editSel?.type !== 'class') return;
    if (!confirm(`Subklasse "${name}" verwijderen?`)) return;
    delete _edit.classes[_editSel.key].subclasses[name]; _editDirty = true; _refreshEditor();
  },
  addFeature(scope, sub, level) {
    const node = _scopeNode(scope, sub); if (!node) return;
    if (!node.levels) node.levels = {};
    if (!node.levels[level]) node.levels[level] = [];
    node.levels[level].push({ name: 'Nieuwe feature', desc: '' }); _editDirty = true; _refreshEditor();
  },
  removeFeature(scope, sub, level, idx) {
    const node = _scopeNode(scope, sub); if (!node?.levels?.[level]) return;
    node.levels[level].splice(idx, 1);
    if (!node.levels[level].length) delete node.levels[level]; _editDirty = true; _refreshEditor();
  },
  editFeature(scope, sub, level, idx, field, value) {
    const node = _scopeNode(scope, sub);
    if (node?.levels?.[level]?.[idx]) { node.levels[level][idx][field] = value; _editDirty = true; }
  },
  // ── Feat-bibliotheek ──
  selectFeats() { _editSel = { type: 'feats' }; _refreshEditor(); },
  addFeatLib(group) {
    if (!_edit.feats[group]) _edit.feats[group] = [];
    _edit.feats[group].push({ name: 'Nieuwe feat', desc: '' });
    _editDirty = true; _refreshEditor();
  },
  editFeatLib(group, idx, field, value) {
    const f = _edit.feats?.[group]?.[idx];
    if (f) { f[field] = value; _editDirty = true; }
  },
  removeFeatLib(group, idx) {
    if (!_edit.feats?.[group]?.[idx]) return;
    if (!confirm(`Feat "${_edit.feats[group][idx].name}" verwijderen?`)) return;
    _edit.feats[group].splice(idx, 1); _editDirty = true; _refreshEditor();
  },
  async uploadMedia(scope, sub, level, idx, input) {
    const file = input.files?.[0]; if (!file) return;
    const id = 'feat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      await api.uploadFile(id, file);
      const node = _scopeNode(scope, sub);
      const feat = node?.levels?.[level]?.[idx];
      if (feat) { feat.img = id; feat.imgKind = file.type.startsWith('video') ? 'video' : 'image'; }
      _refreshEditor(); _toast('Media toegevoegd — vergeet niet op te slaan.');
    } catch(e) { alert('Upload mislukt: ' + e.message); }
  },
  pickMedia(scope, sub, level, idx) {
    window.mediaPicker.open({
      type: 'afbeelding',
      onSelect: (fileId) => {
        const node = _scopeNode(scope, sub);
        const feat = node?.levels?.[level]?.[idx];
        if (feat) { feat.img = fileId; feat.imgKind = 'image'; _editDirty = true; }
        _refreshEditor(); _toast('Afbeelding gekoppeld — vergeet niet op te slaan.');
      },
    });
  },
  removeMedia(scope, sub, level, idx) {
    const node = _scopeNode(scope, sub);
    const feat = node?.levels?.[level]?.[idx];
    if (feat) { delete feat.img; delete feat.imgKind; } _refreshEditor();
  },
  async save() {
    try {
      await api.saveProgression({ bron: 'Aangepast door de DM', classes: _edit.classes, species: _edit.species, gedeeld: _edit.gedeeld, feats: _edit.feats, backgrounds: _edit.backgrounds });
      _editDirty = false;
      window.app.closeModal();
      _toast('Progressie opgeslagen.');
      _refresh();
    } catch(e) { alert('Opslaan mislukt: ' + e.message); }
  },
  closeEditor() {
    if (_editDirty && !confirm('Niet-opgeslagen wijzigingen worden verworpen. Toch sluiten?')) return;
    _editDirty = false;
    window.app.closeModal();
  },
  // Dubbele bevestiging: typ exact RESET om de hele progressie terug te zetten.
  async resetSeed() {
    const answer = prompt(
      '⚠️ LET OP — dit zet ALLE klassen, subklassen, soorten én feats terug naar de ' +
      'meegeleverde 2024-startdata. Al je eigen aanpassingen gaan onherroepelijk verloren.\n\n' +
      'Typ RESET (in hoofdletters) om door te gaan:');
    if (answer !== 'RESET') { if (answer !== null) _toast('Reset geannuleerd.'); return; }
    try {
      await api.resetProgression();
      _edit = JSON.parse(JSON.stringify(await api.progression()));
      if (!_edit.feats) _edit.feats = _seedFeatLibrary();
      _editDirty = false;
      _editSel = { type: 'class', key: Object.keys(_edit.classes)[0] };
      _refreshEditor(); _toast('Teruggezet naar de startdata.');
    } catch(e) { alert(e.message); }
  },
};

// ── DM-editor helpers ──────────────────────────────────────────────
let _edit      = null;
let _editSel   = null;
let _editDirty = false;

function _scopeNode(scope, sub) {
  if (scope === 'species') return _edit.species[_editSel.key];
  if (scope === 'background') return _edit.backgrounds[_editSel.key];
  const c = _edit.classes[_editSel.key];
  return sub ? c.subclasses?.[sub] : c;
}

function _editorHtml() {
  const classList  = Object.keys(_edit.classes).sort().map(k =>
    `<button class="prog-ed-item${_editSel?.type==='class'&&_editSel.key===k?' active':''}"
      onclick="window.progressie.selectEntry('class','${esc(k)}')">${esc(k)}</button>`).join('');
  const specList = Object.keys(_edit.species).sort().map(k =>
    `<button class="prog-ed-item${_editSel?.type==='species'&&_editSel.key===k?' active':''}"
      onclick="window.progressie.selectEntry('species','${esc(k)}')">${esc(k)}</button>`).join('');
  const bgList = Object.keys(_edit.backgrounds || {}).sort().map(k =>
    `<button class="prog-ed-item${_editSel?.type==='background'&&_editSel.key===k?' active':''}"
      onclick="window.progressie.selectEntry('background','${esc(k)}')">${esc(k)}</button>`).join('');
  return `
    <div class="prog-ed">
      <div class="prog-ed-side">
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Klassen</span>
            <button class="prog-ed-add" onclick="window.progressie.addClass()" title="Klasse toevoegen">${icon('plus')}</button></div>
          ${classList || '<p class="prog-ed-empty">—</p>'}
        </div>
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Soorten</span>
            <button class="prog-ed-add" onclick="window.progressie.addSpecies()" title="Soort toevoegen">${icon('plus')}</button></div>
          ${specList || '<p class="prog-ed-empty">—</p>'}
        </div>
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Backgrounds</span>
            <button class="prog-ed-add" onclick="window.progressie.addBackground()" title="Background toevoegen">${icon('plus')}</button></div>
          ${bgList || '<p class="prog-ed-empty">—</p>'}
        </div>
        <div class="prog-ed-group">
          <div class="prog-ed-group-head"><span>Overig</span></div>
          <button class="prog-ed-item${_editSel?.type==='feats'?' active':''}"
            onclick="window.progressie.selectFeats()">${icon('hexagon')} Feats</button>
        </div>
      </div>
      <div class="prog-ed-main" id="prog-ed-main">${_editorMain()}</div>
    </div>
    <div class="prog-ed-foot">
      <button class="prog-ed-reset" onclick="window.progressie.resetSeed()"
        title="Naar 2024-startdata terugzetten (vraagt bevestiging)">${icon('refresh-cw')}</button>
      <span class="prog-ed-foot-spacer"></span>
      <button class="prog-ed-cancel" onclick="window.progressie.closeEditor()" title="Sluiten zonder opslaan">${icon('x')} Annuleren</button>
      <button class="prog-ed-save" onclick="window.progressie.save()" title="Opslaan">${icon('save')} Opslaan</button>
    </div>`;
}

function _featRow(scope, sub, lvl, i, f) {
  const s = scope, su = sub || '';
  const cur  = f.cat || '';
  const opts = ['<option value="">— auto —</option>',
    ..._CAT_CHOICES.map(c => `<option value="${c}"${cur===c?' selected':''}>${_catById(c).label}</option>`)].join('');
  const hasMedia = !!f.img;
  return `
    <div class="prog-ed-feat">
      <div class="prog-ed-feat-fields">
        <input class="prog-ed-in prog-ed-name" value="${esc(f.name)}" placeholder="Naam"
          oninput="window.progressie.editFeature('${s}','${su}',${lvl},${i},'name',this.value)">
        <textarea class="prog-ed-in prog-ed-desc" rows="2" placeholder="Beschrijving (uitleg)"
          oninput="window.progressie.editFeature('${s}','${su}',${lvl},${i},'desc',this.value)">${esc(f.desc||'')}</textarea>
      </div>
      <div class="prog-ed-feat-tools">
        <select class="prog-ed-cat" title="Categorie" onchange="window.progressie.editFeature('${s}','${su}',${lvl},${i},'cat',this.value)">${opts}</select>
        <div class="prog-ed-feat-icons">
          <button class="prog-ed-media" title="Afbeelding uit bibliotheek kiezen"
            onclick="window.progressie.pickMedia('${s}','${su}',${lvl},${i})">${icon('folder-open')}</button>
          <label class="prog-ed-media${hasMedia?' has':''}" title="${hasMedia?'Media vervangen':'Afbeelding of filmpje uploaden'}"
            >${hasMedia?(f.imgKind==='video'?icon('play'):icon('image')):icon('image')}
            <input type="file" accept="image/*,video/mp4,video/webm" style="display:none"
              onchange="window.progressie.uploadMedia('${s}','${su}',${lvl},${i},this)"></label>
          ${hasMedia?`<button class="prog-ed-del" title="Media verwijderen"
            onclick="window.progressie.removeMedia('${s}','${su}',${lvl},${i})">${icon('x')}</button>`:''}
          <button class="prog-ed-del" title="Feature verwijderen"
            onclick="window.progressie.removeFeature('${s}','${su}',${lvl},${i})">${icon('trash')}</button>
        </div>
      </div>
    </div>`;
}

// Automatisch toegekende, gedeelde markers (niet per klasse opgeslagen maar
// op renderniveau ingevoegd). Read-only ter info zodat de DM ze ziet staan.
function _sharedMarkers(lvl) {
  const g = _edit.gedeeld || {};
  const out = [];
  if ((g.subclassLevel || 3) === lvl)
    out.push(`<span class="prog-ed-marker prog-ed-marker--sub" title="Op dit level kiest de speler een subklasse (automatisch)">${icon('crossed-swords',{cls:'icon-gi'})} Subklasse-keuze</span>`);
  if ((g.asiLevels || [4,8,12,16]).includes(lvl))
    out.push(`<span class="prog-ed-marker prog-ed-marker--asi" title="Ability Score Improvement / feat-keuze (automatisch op dit level)">${icon('hexagon')} ASI / feat</span>`);
  if ((g.epicBoonLevel || 19) === lvl)
    out.push(`<span class="prog-ed-marker prog-ed-marker--boon" title="Epic Boon-keuze (automatisch op dit level)">${icon('sparkles')} Epic Boon</span>`);
  return out.length ? `<div class="prog-ed-markers">${out.join('')}</div>` : '';
}

function _levelEditor(scope, sub, levels) {
  if (scope === 'background') {
    // Backgrounds hebben geen levels — platte lijst van onderdelen (op niveau 1).
    const feats = levels?.[1] || levels?.['1'] || [];
    const rows  = feats.map((f, i) => _featRow('background', '', 1, i, f)).join('');
    return `<div class="prog-ed-feats" style="margin-top:4px">${rows}
      <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('background','',1)" title="Onderdeel toevoegen">${icon('plus')} onderdeel</button>
    </div>`;
  }
  if (scope === 'species') {
    const lvls = new Set([1, ...Object.keys(levels||{}).map(Number)]);
    return [...lvls].sort((a,b)=>a-b).map(lvl => {
      const feats = levels?.[lvl] || [];
      const rows  = feats.map((f,i) => _featRow('species','',lvl,i,f)).join('');
      return `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">lvl ${lvl}</span>
        <div class="prog-ed-feats">${rows}
          <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('species','',${lvl})" title="Feature toevoegen">${icon('plus')} feature</button>
        </div></div>`;
    }).join('');
  }
  return Array.from({length:20},(_,i)=>i+1).map(lvl => {
    const feats   = levels?.[lvl] || [];
    const markers = _sharedMarkers(lvl);
    if (!feats.length && !markers)
      return `<div class="prog-ed-lvl prog-ed-lvl--empty"><span class="prog-ed-lvlnum">${lvl}</span>
        <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub||''}',${lvl})" title="Feature toevoegen">${icon('plus')} feature</button></div>`;
    const rows = feats.map((f,i) => _featRow(scope, sub||'', lvl, i, f)).join('');
    return `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">${lvl}</span>
      <div class="prog-ed-feats">${markers}${rows}
        <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('${scope}','${sub||''}',${lvl})" title="Feature toevoegen">${icon('plus')} feature</button>
      </div></div>`;
  }).join('');
}

function _levelEditorSub(subName, levels) {
  const start = _edit.gedeeld?.subclassLevel || 3;
  return Array.from({length: 20 - start + 1}, (_, i) => start + i).map(lvl => {
    const feats = levels?.[lvl] || [];
    if (!feats.length)
      return `<div class="prog-ed-lvl prog-ed-lvl--empty"><span class="prog-ed-lvlnum">${lvl}</span>
        <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('class','${esc(subName)}',${lvl})" title="Feature toevoegen">${icon('plus')}</button></div>`;
    const rows = feats.map((f,i) => _featRow('class', subName, lvl, i, f)).join('');
    return `<div class="prog-ed-lvl"><span class="prog-ed-lvlnum">${lvl}</span>
      <div class="prog-ed-feats">${rows}
        <button class="prog-ed-addfeat" onclick="window.progressie.addFeature('class','${esc(subName)}',${lvl})" title="Feature toevoegen">${icon('plus')}</button>
      </div></div>`;
  }).join('');
}

function _featLibSection(group, label) {
  const list = _edit.feats?.[group] || [];
  const rows = list.map((f, i) => `
    <div class="prog-ed-feat">
      <div class="prog-ed-feat-fields">
        <input class="prog-ed-in prog-ed-name" value="${esc(f.name||'')}" placeholder="Naam van de feat"
          oninput="window.progressie.editFeatLib('${group}',${i},'name',this.value)">
        <textarea class="prog-ed-in prog-ed-desc" rows="2" placeholder="Beschrijving (uitleg)"
          oninput="window.progressie.editFeatLib('${group}',${i},'desc',this.value)">${esc(f.desc||'')}</textarea>
      </div>
      <div class="prog-ed-feat-tools">
        <button class="prog-ed-del" title="Feat verwijderen"
          onclick="window.progressie.removeFeatLib('${group}',${i})">${icon('trash')}</button>
      </div>
    </div>`).join('');
  return `
    <div class="prog-ed-featlib-group">
      <div class="prog-ed-subs-head"><span>${esc(label)} <em class="prog-ed-count">(${list.length})</em></span>
        <button class="prog-ed-add" onclick="window.progressie.addFeatLib('${group}')" title="Feat toevoegen">${icon('plus')} feat</button></div>
      <div class="prog-ed-feats">${rows || '<p class="prog-ed-empty">Nog geen feats.</p>'}</div>
    </div>`;
}

function _editorMain() {
  if (!_editSel) return '<p class="prog-ed-empty">Kies links een klasse, soort of de feats — of voeg er een toe.</p>';
  if (_editSel.type === 'feats') {
    return `<div class="prog-ed-main-head"><h4>Feats <span>bibliotheek</span></h4></div>
      <p class="prog-ed-hint">${icon('hexagon')} Deze feats verschijnen in de keuzelijst die spelers zien op ASI- en Epic Boon-levels. Laat de beschrijving leeg om op de SRD-standaard terug te vallen.</p>
      ${_featLibSection('general', 'General feats')}
      ${_featLibSection('epic', 'Epic Boons')}`;
  }
  if (_editSel.type === 'species') {
    const sp = _edit.species[_editSel.key];
    return `<div class="prog-ed-main-head"><h4>${esc(_editSel.key)} <span>soort</span></h4>
      <button class="prog-ed-removeentry" onclick="window.progressie.removeEntry()" title="Soort verwijderen">${icon('trash')} Verwijderen</button></div>
      ${_levelEditor('species', '', sp.levels)}`;
  }
  if (_editSel.type === 'background') {
    const bg = _edit.backgrounds[_editSel.key];
    return `<div class="prog-ed-main-head"><h4>${esc(_editSel.key)} <span>background</span></h4>
      <button class="prog-ed-removeentry" onclick="window.progressie.removeEntry()" title="Background verwijderen">${icon('trash')} Verwijderen</button></div>
      <p class="prog-ed-hint">${icon('scroll-text')} Onderdelen van deze background (Ability Scores, Origin-feat, Skill Proficiencies, Tool, Equipment). Spelers zien ze in hun progressie wanneer ze deze background kiezen.</p>
      ${_levelEditor('background', '', bg.levels)}`;
  }
  const c    = _edit.classes[_editSel.key];
  const subs = Object.keys(c.subclasses || {}).map(sn => `
    <div class="prog-ed-subblock">
      <div class="prog-ed-subhead">${esc(sn)}
        <button class="prog-ed-del" onclick="window.progressie.removeSubclass('${esc(sn)}')" title="Subklasse verwijderen">${icon('trash')}</button></div>
      ${_levelEditorSub(sn, c.subclasses[sn].levels)}
    </div>`).join('');
  return `
    <div class="prog-ed-main-head"><h4>${esc(_editSel.key)} <span>klasse</span></h4>
      <button class="prog-ed-removeentry" onclick="window.progressie.removeEntry()" title="Klasse verwijderen">${icon('trash')} Verwijderen</button></div>
    <div class="prog-ed-cls-levels">${_levelEditor('class', '', c.levels)}</div>
    <div class="prog-ed-subs">
      <div class="prog-ed-subs-head"><span>Subklassen</span>
        <button class="prog-ed-add" onclick="window.progressie.addSubclass()" title="Subklasse toevoegen">${icon('plus')} subklasse</button></div>
      ${subs || '<p class="prog-ed-empty">Nog geen subklassen.</p>'}
    </div>`;
}

function _refreshEditor() {
  const body = document.getElementById('m-body');
  if (body) body.innerHTML = _editorHtml();
  document.querySelector('#modal-overlay .modal')?.classList.add('modal--wide');
}

function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast'; t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => { t.classList.remove('map-toast--show'); t.addEventListener('transitionend', () => t.remove(), { once: true }); }, 3000);
}

// Herlaad wanneer DM de data wijzigt
window.addEventListener('progression:reload', () => { _refresh(); });
