import { api } from './api.js?v=226';
import { init as canvasInit, update as canvasUpdate, stop as canvasStop } from './combat-canvas.js?v=6';
import { renderStatblock } from './render-statblock.js?v=3';

// ── DM Panel ──
// icon() helper is defined globally in app.js; grab a local alias for template use.
const icon = (...a) => window.icon(...a);

const CONDITIONS = [
  { id: 'blinded',       label: 'Blinded',        desc: 'Cannot see. Attack rolls against it have advantage; its attack rolls have disadvantage.' },
  { id: 'charmed',       label: 'Charmed',        desc: 'Cannot attack the charmer. The charmer has advantage on social ability checks against it.' },
  { id: 'deafened',      label: 'Deafened',       desc: 'Cannot hear. Automatically fails ability checks that require hearing.' },
  { id: 'exhaustion',    label: 'Exhaustion',     desc: 'Level 1: disadvantage on checks. 2: speed halved. 3: disadvantage on saves. 4: speed 0. 5: disadvantage on attacks. 6: death.' },
  { id: 'frightened',    label: 'Frightened',     desc: 'Disadvantage on checks and attacks while the source is in sight. Cannot willingly move closer to the source.' },
  { id: 'grappled',      label: 'Grappled',       desc: 'Speed becomes 0. Ends if the grappler is incapacitated or the creature is moved out of reach.' },
  { id: 'incapacitated', label: 'Incapacitated',  desc: 'Cannot take actions or reactions.' },
  { id: 'invisible',     label: 'Invisible',      desc: 'Cannot be seen. Attack rolls against it have disadvantage; its attack rolls have advantage.' },
  { id: 'paralyzed',     label: 'Paralyzed',      desc: 'Incapacitated, cannot move or speak. Fails STR/DEX saves. Attacks have advantage. Hits within 5 ft. are critical hits.' },
  { id: 'petrified',     label: 'Petrified',      desc: 'Transformed to stone. Incapacitated. Resistant to all damage. Immune to poison and disease.' },
  { id: 'poisoned',      label: 'Poisoned',       desc: 'Disadvantage on attack rolls and ability checks.' },
  { id: 'prone',         label: 'Prone',          desc: 'Disadvantage on attack rolls. Attacks within 5 ft. have advantage; from farther away have disadvantage. Standing up costs half speed.' },
  { id: 'restrained',    label: 'Restrained',     desc: 'Speed becomes 0. Disadvantage on attack rolls and DEX saves. Attack rolls against it have advantage.' },
  { id: 'stunned',       label: 'Stunned',        desc: 'Incapacitated, cannot move, can speak only falteringly. Fails STR/DEX saves. Attack rolls against it have advantage.' },
  { id: 'unconscious',   label: 'Unconscious',    desc: 'Incapacitated, prone, unaware. Fails STR/DEX saves. Attacks have advantage. Hits within 5 ft. are critical hits.' },
  { id: 'concentration', label: 'Concentration',  desc: 'Concentrating on a spell. Ends if damaged (CON save, DC 10 or half damage taken) or incapacitated.' },
  { id: 'bleeding',      label: 'Bleeding',       desc: 'Losing blood. Takes 1d4 damage at the start of each turn. Ends when healed or a DC 10 Medicine check is made.' },
  { id: 'burning',       label: 'Burning',        desc: 'On fire. Takes 1d6 fire damage at the start of each turn. Can use an action to extinguish.' },
  // ── Klassespecifiek ──
  { id: 'bardic-inspiration', label: 'Bardic Inspiration', desc: '(Bard) Has a Bardic Inspiration die. Can add it to one attack roll, ability check, or saving throw. Expended on use.' },
  { id: 'tides-of-chaos',     label: 'Tides of Chaos',     desc: '(Sorcerer) Has advantage on the next attack roll, ability check, or saving throw. Expended on use — may trigger a Wild Magic Surge.' },
  { id: 'twilight-sanctuary', label: 'Twilight Sanctuary',  desc: '(Cleric) Within the Twilight Sanctuary aura. At end of each turn: gain temp HP (1d6 + cleric level) or end one charmed or frightened condition.' },
  { id: 'patient-defense',    label: 'Patient Defense',    desc: '(Monk) Taking the Dodge action via ki. Attack rolls against this creature have disadvantage; DEX saving throws have advantage. Until start of next turn.' },
  { id: 'steady-aim',         label: 'Steady Aim',         desc: '(Rogue) Used Steady Aim bonus action. Has advantage on the next attack roll this turn. Speed is 0 until end of turn.' },
  { id: 'vigilant-blessing',  label: 'Vigilant Blessing',  desc: '(Cleric) Has advantage on the next initiative roll. Expended when rolled.' },
  { id: 'blessed',            label: 'Blessed',            desc: '(Bless spell) Adds 1d4 to attack rolls and saving throws. Concentration, up to 1 minute.' },
];

const HP_LABELS = [
  { min: 1.00, label: 'Volledig in leven', cls: 'hp-full' },
  { min: 0.75, label: 'Licht verwond',     cls: 'hp-light' },
  { min: 0.50, label: 'Verwond',           cls: 'hp-wounded' },
  { min: 0.25, label: 'Zwaar verwond',     cls: 'hp-heavy' },
  { min: 0.01, label: 'Bijna dood',        cls: 'hp-critical' },
  { min: -Infinity, label: 'Dood',         cls: 'hp-dead' },
];

function hpStatus(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  return HP_LABELS.find(l => pct >= l.min) || HP_LABELS[HP_LABELS.length - 1];
};

let _activeTab = 'gevecht';
let _tables = [];
let _editingTableId = null;
let _editingTableType = 'simple';
let _combat = null;
let _combatLoaded = false;
let _selectedCombatantId = null;
let _monsters = [];

// ── Combat overlay tabs (speler) ──
let _combatOverlayTab = 'gevecht';
let _lastCombat = null;

const _CO_AB_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const _CO_SKILLS = [
  { key: 'acrobatics',    label: 'Acrobatics',      ab: 'dex' },
  { key: 'animalHandling',label: 'Animal Handling',  ab: 'wis' },
  { key: 'arcana',        label: 'Arcana',            ab: 'int' },
  { key: 'athletics',     label: 'Athletics',         ab: 'str' },
  { key: 'deception',     label: 'Deception',         ab: 'cha' },
  { key: 'history',       label: 'History',           ab: 'int' },
  { key: 'insight',       label: 'Insight',           ab: 'wis' },
  { key: 'intimidation',  label: 'Intimidation',      ab: 'cha' },
  { key: 'investigation', label: 'Investigation',     ab: 'int' },
  { key: 'medicine',      label: 'Medicine',          ab: 'wis' },
  { key: 'nature',        label: 'Nature',            ab: 'int' },
  { key: 'perception',    label: 'Perception',        ab: 'wis' },
  { key: 'performance',   label: 'Performance',       ab: 'cha' },
  { key: 'persuasion',    label: 'Persuasion',        ab: 'cha' },
  { key: 'religion',      label: 'Religion',          ab: 'int' },
  { key: 'sleightOfHand', label: 'Sleight of Hand',   ab: 'dex' },
  { key: 'stealth',       label: 'Stealth',           ab: 'dex' },
  { key: 'survival',      label: 'Survival',          ab: 'wis' },
];
let _monsterChapterFilter    = '';
let _monsterPage             = 0;
let _editingMonsterId        = null;
let _editingMonsterIsNew     = false;
let _editingMonsterImageId   = null;

// ── Reveal strip state ──
let _revealChapter = null;
let _revealQueue   = []; // [{sessieId, imgId, caption, url}]
let _revealLoading = false;

// ── Aktes-tab state ──
let _akteOpen = new Set();      // welke aktes hun regie-script uitgeklapt hebben

// ── Regie-balk state ──
let _rbScript     = [];        // script items voor huidige akte
let _rbChapter    = null;      // huidige akte key
let _rbTitle      = '';        // weergavetitel
let _rbFilter     = 'all';     // 'all' | 'image' | 'entity' | 'encounter'
let _rbRevealed   = new Set(); // item-IDs die al onthuld zijn (session-local)
let _rbMinimized  = false;

// ── Spreuken state ──
let _spellList   = null;   // null = not yet loaded, [] = loaded (possibly empty)
let _spellQuery  = '';
let _spellDetail = null;   // currently viewed spell data object
let _setupSelectedType      = 'monster';
let _setupSelectedPresetId  = null;
let _setupSelectedEntityId  = null;
let _setupPersonages        = [];

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

export function initDmPanel() {
  window.dmPanel = {
    switchTab(tab) { _switchTab(tab); },
    renderMeesterkamer() {
      _buildTabs();
      _switchTab(_activeTab);
    },

    // Spreuken
    spellSearch: _spellSearch,
    spellOpen:   _spellOpen,
    spellBack:   _spellBack,
    uploadSpellImage: async function(index, file) {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        await fetch(`/api/files/spell-img-${index}`, { method: 'POST', body: fd, credentials: 'include' });
        const thumb = document.getElementById('dm-spell-img-thumb');
        if (thumb) { thumb.src = `/api/files/spell-img-${index}?t=${Date.now()}`; thumb.style.display = 'block'; }
      } catch(e) { console.warn('Afbeelding uploaden mislukt:', e); }
    },

    // Tunnel
    tunnelToggle:  _tunnelToggle,
    tunnelCopy:    _tunnelCopy,
    exportSnapshot:  _exportSnapshot,
    exportFile:      _exportFile,
    importObsidian:  _importObsidian,

    // Tafels
    tabelRoll:     _tabelRoll,
    tabelEdit:     _tabelEdit,
    tabelDelete:   _tabelDelete,
    tabelSave:     _tabelSave,
    tabelNew:      _tabelNew,
    naamGenereer:  _naamGenereer,
    weerSeason:    _weerSeason,
    weerGenereer:  _weerGenereer,
    tabelCancel:   () => { _editingTableId = null; _renderTafels(); },
    tabelTypeChange(val) { _editingTableType = val; _renderTafels(); },
    tabelSelect:   (id) => {
      document.getElementById('dm-tabel-select').value = id;
      _renderTafelResult(null);
    },

    // Monster library
    monsterNew:          _monsterNew,
    monsterEdit:         _monsterEdit,
    monsterCancel:       _monsterCancel,
    monsterSave:         _monsterSave,
    monsterDelete:       _monsterDelete,
    srdSearch:           _srdSearch,
    srdImport:           _srdImport,
    monsterFilterChapter: _monsterFilterChapter,
    monsterPage:          _monsterPage_set,
    monsterUpload:      _monsterUpload,
    monsterRemoveImage: _monsterRemoveImage,
    monsterAddToCombat: _monsterAddToCombat,
    monsterStatblock:   _showStatblock,
    combatStatblock:    _showStatblockForCombatant,

    // Encounters
    encNew:             _encNew,
    encEdit:            _encEdit,
    encCancel:          _encCancel,
    encSave:            _encSave,
    encDelete:          _encDelete,
    encStart:           _encStart,
    encAddRow:          _encAddRow,
    encRemoveRow:       _encRemoveRow,
    encRowMonsterChange: _encRowMonsterChange,
    encRowChange:       _encRowChange,
    encBackdropUpload:  _encBackdropUpload,
    encBackdropClear:   _encBackdropClear,
    encSetPreset: (id) => {
      _encCanvasPreset = (_encCanvasPreset === id) ? null : id; // toggle
      _renderEncounters();
    },

    // Gevecht — setup (voor start)
    setupTypeChange:   _setupTypeChange,
    setupPresetChange: _setupPresetChange,
    setupEntityChange: _setupEntityChange,
    setupAddSubmit:    _setupAddSubmit,
    setupReset:        _setupReset,
    setupInitChange:   _setupInitChange,

    // Gevecht — tijdens combat (overlay)
    combatStart:      _combatStart,
    combatEnd:        _combatEnd,
    combatNextTurn:   _combatNextTurn,
    combatPrevTurn:   _combatPrevTurn,
    combatMinimize:   () => {
      const el = document.getElementById('combat-overlay');
      if (el) {
        el.classList.add('minimized');
        el.querySelector('.co-backdrop-el')?.classList.add('hidden');
      }
      canvasStop();
    },
    combatExpand:     () => {
      const el = document.getElementById('combat-overlay');
      if (el) {
        el.classList.remove('minimized');
        el.querySelector('.co-backdrop-el')?.classList.remove('hidden');
        // Entrance-animatie bij uitklappen
        const combatModal = el.querySelector('.combat-modal');
        if (combatModal) {
          combatModal.classList.remove('co-entering');
          void combatModal.offsetHeight;
          combatModal.classList.add('co-entering');
        }
      }
      const canvasEl = document.getElementById('combat-canvas');
      if (canvasEl && _combat) canvasInit(canvasEl, _combat);
    },
    combatAddForm:        () => { document.getElementById('co-add-form')?.classList.remove('hidden'); },
    combatAddSubmit:      _combatAddSubmit,
    combatAddCancel:      () => { document.getElementById('co-add-form')?.classList.add('hidden'); },
    combatAddTypeChange:  _combatAddTypeChange,
    combatAddPresetChange: _combatAddPresetChange,
    combatHpChange:   _combatHpChange,
    combatHpInput:    _combatHpInput,
    combatApplyDamage: _combatApplyDamage,
    combatApplyHeal:   _combatApplyHeal,
    playerHpChange:   _playerHpChange,
    playerHpInput:    _playerHpInput,
    combatThpChange:  _combatThpChange,
    combatThpInput:   _combatThpInput,
    combatInitChange: _combatInitChange,
    combatCondToggle:  _combatCondToggle,
    combatRemove:      _combatRemove,
    combatSetWinner:   _combatSetWinner,
    combatDeathSave:        _combatDeathSave,
    combatSelectCombatant:  _combatSelectCombatant,

    // Reveal strip
    setRevealChapter(key) { _revealChapter = key || null; _loadRevealQueue(_revealChapter); },
    revealImage:      _revealImage,
    renderRevealStrip: _renderRevealStrip,
    closeRevealStrip() {
      _revealChapter = null;
      _revealQueue   = [];
      const el = document.getElementById('dm-reveal-strip');
      if (el) { el.classList.remove('dm-reveal-strip--visible', 'dm-reveal-strip--minimized'); el.innerHTML = ''; }
    },
    toggleRevealStrip() {
      const el = document.getElementById('dm-reveal-strip');
      if (!el) return;
      const isMinimized = el.classList.contains('dm-reveal-strip--minimized');
      if (isMinimized) {
        el.classList.remove('dm-reveal-strip--minimized');
        _renderRevealStrip();
      } else {
        el.classList.add('dm-reveal-strip--minimized');
        el.innerHTML = `<button onclick="window.dmPanel.toggleRevealStrip()" title="Uitklappen"
          style="writing-mode:vertical-rl;transform:rotate(180deg);background:none;border:none;cursor:pointer;
                 color:var(--color-ink-medium);font-size:10px;font-weight:600;letter-spacing:.05em;padding:8px 0;width:100%;text-align:center;">
          🖼 Afbeeldingen
        </button>`;
      }
    },

    // Aktes (voorbereiding & regie — verhuisd vanuit het Logboek)
    akteNieuw:    () => _akteNieuw(),
    akteImport:   () => _akteImportWizard(),
    akteImpAnalyse: () => _akteImpAnalyse(),
    akteImpToggle:  (id) => _akteImpToggle(id),
    akteImpField:   (id, f, val) => _akteImpField(id, f, val),
    akteImpMonField:(id, mi, f, val) => _akteImpMonField(id, mi, f, val),
    akteImpApply:   () => _akteImpApply(),
    akteToggle:   (ch) => { if (_akteOpen.has(ch)) _akteOpen.delete(ch); else _akteOpen.add(ch); _renderAktes(); },
    akteSpeel:    (ch) => { const i = (window.app?.state?.meta?.hoofdstukken || {})[ch] || {}; window._speelAkte?.(ch, i.num, i.title || ch); },
    akteBewerk:   (ch) => window._editAkte?.(ch),
    akteVisToggle:(ch, hidden) => window._toggleChapterVisibility?.(ch, hidden),

    // Regie-balk
    regieBalkLoad:           (key, title) => _loadRegieBalk(key, title),
    regieBalkReveal:         (id) => _revealRegieBalkItem(id),
    regieBalkFilter:         (f) => { _rbFilter = f; _renderRegieBalk(); },
    regieBalkClose() {
      _rbScript = []; _rbChapter = null; _rbMinimized = false;
      document.body.classList.remove('dm-rb-active');
      _renderRegieBalk();
    },
    regieBalkToggleMinimize() { _rbMinimized = !_rbMinimized; _renderRegieBalk(); },
    // #2: ververs de ambiance-snelknop in de regie-balk (bij socket-wijziging)
    syncAmbiance() { _refreshAmbCache().then(() => _renderRegieBalk()); },

    // Campagnes
    campagneSwitchTo:  _campagneSwitchTo,
    campagneCreate:    _campagneCreate,
    campagneSubmit:    _campagneSubmit,

    // Berichten & Brieven
    berichtenRefresh:   _renderBerichten,
    berichtSend:        _berichtSend,
    postSend:           _postSend,
    sjabloonDelete:     _sjabloonDelete,

    // Socket callbacks
    onTunnelUrl(url) {
      window._dmPanelTunnelUrl = url;
      if (_activeTab === 'tunnel') _renderTunnel();
    },
    onTunnelStopped() {
      window._dmPanelTunnelUrl = null;
      window._dmPanelTunnelActive = false;
      if (_activeTab === 'tunnel') _renderTunnel();
    },
    onCombatUpdated(combat) {
      _combat = combat;
      _combatLoaded = true;
      if (_activeTab === 'gevecht') _renderGevecht();
      _renderCombatOverlay(combat);
      // Sync ⚔️-knop in aktebar
      const rbBtn = document.getElementById('dm-rb-combat-btn');
      if (rbBtn) rbBtn.classList.toggle('hidden', !combat?.active);
    },
    refreshCombatOverlay() {
      if (_combat) _renderCombatOverlay(_combat);
    },
  };

  // Load initial tunnel status
  api.tunnelStatus().then(({ active, url }) => {
    window._dmPanelTunnelActive = active;
    window._dmPanelTunnelUrl = url || null;
  }).catch(() => {});

  // Load initial combat state
  api.getCombat().then(c => {
    _combat = c;
    _combatLoaded = true;
    // Display-modus: nooit geminimaliseerd starten
    const minimize = !window.app?.isDM?.() && !window._isDisplayMode;
    _renderCombatOverlay(c, minimize);
  }).catch(() => {});
};

// ── Tab knoppen bouwen ──

// Welke tabs zijn "gevecht & monsters"?
const _GEVECHT_TABS = new Set(['gevecht', 'monsters', 'encounters']);
// Welke tabs zijn "diensten"?
const _DIENSTEN_TABS = new Set(['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'heeren', 'facties', 'magizoo', 'toegang']);
// Welke tabs zijn "instellingen" (niet als tab getoond)?
const _INSTELLINGEN_TABS = new Set(['campagnes', 'wereld', 'beurs', 'dobbelstenen']);

// Zet legacy tab-namen om naar nieuwe parent-tab
function _tabToParent(tab) {
  if (_GEVECHT_TABS.has(tab))     return 'gevecht';
  if (_DIENSTEN_TABS.has(tab))    return 'diensten';
  return tab;
};

function _buildTabs() {
  const container = document.getElementById('dm-section-tabs');
  if (!container) return;
  const activeParent = _tabToParent(_activeTab);
  container.innerHTML = `
    <button class="dm-tab-btn${activeParent==='gevecht'  ?' active':''}" data-tab="gevecht"   onclick="window.dmPanel.switchTab('gevecht')"   title="Gevecht & Monsters">${icon('crossed-swords',{cls:'icon-gi'})}</button>
    <button class="dm-tab-btn${activeParent==='aktes'    ?' active':''}" data-tab="aktes"     onclick="window.dmPanel.switchTab('aktes')"     title="Aktes — voorbereiding & regie">${icon('clipboard-list')}</button>
    <button class="dm-tab-btn${activeParent==='geluiden' ?' active':''}" data-tab="geluiden"  onclick="window.dmPanel.switchTab('geluiden')"  title="Geluiden">${icon('volume-2')}</button>
    <button class="dm-tab-btn${activeParent==='spreuken' ?' active':''}" data-tab="spreuken"  onclick="window.dmPanel.switchTab('spreuken')"  title="Spreuken">${icon('open-book',{cls:'icon-gi'})}</button>
    <button class="dm-tab-btn${activeParent==='tafels'   ?' active':''}" data-tab="tafels"    onclick="window.dmPanel.switchTab('tafels')"    title="Willekeur — tafels & namen">${icon('dice',{cls:'icon-gi'})}</button>
    <button class="dm-tab-btn${activeParent==='diensten' ?' active':''}" data-tab="diensten"  onclick="window.dmPanel.switchTab('diensten')"  title="Grisburgh-diensten">${icon('building')}</button>
    <button class="dm-tab-btn${activeParent==='berichten'?' active':''}" data-tab="berichten" onclick="window.dmPanel.switchTab('berichten')" title="Berichten">${icon('message-circle')}</button>
    <button class="dm-tab-btn dm-tab-btn--settings" onclick="window._dmInstellingenOpen()" title="Instellingen">${icon('settings')}</button>
  `;
};

// ── Tab switching ──

function _switchTab(tab) {
  _activeTab = tab;
  // Bepaal de parent-tab voor actieve styling
  const parentTab = _tabToParent(tab);
  document.querySelectorAll('.dm-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === parentTab);
  });
  document.querySelectorAll('.dm-tab-content').forEach(c => {
    // Toon: gevecht-tab voor alles in _GEVECHT_TABS, diensten voor _DIENSTEN_TABS, etc.
    const matchTab = _tabToParent(c.dataset.tab || '') === parentTab
      ? parentTab : c.dataset.tab;
    c.classList.toggle('active', c.dataset.tab === parentTab || c.dataset.tab === tab);
    if (c.dataset.tab !== parentTab && c.dataset.tab !== tab) c.classList.remove('active');
  });
  // Zorg dat alleen de juiste parent-tab-content zichtbaar is
  document.querySelectorAll('.dm-tab-content').forEach(c => {
    c.classList.toggle('active', c.dataset.tab === parentTab);
  });

  if (tab === 'aktes')     _renderAktes();
  if (tab === 'spreuken')  _renderSpreuken();
  if (tab === 'tafels')    _loadAndRenderTafels();
  if (tab === 'geluiden')  _renderGeluiden();
  if (tab === 'berichten') _renderBerichten();
  if (tab === 'gevecht' || tab === 'monsters' || tab === 'encounters') _renderGevechtEnMonsters(tab);
  if (tab === 'diensten' || _DIENSTEN_TABS.has(tab)) _renderDiensten(tab);
};

// ── Spreuken ──

function _isHpCampaign() {
  return window.app?.state?.meta?.spellSource === 'wands-wizards';
};

// ── Gevecht & Monsters (gecombineerde tab) ──

let _gevechtSubTab = 'gevecht'; // 'gevecht' | 'monsters' | 'encounters'

function _renderGevechtEnMonsters(subTab) {
  if (subTab && (subTab === 'gevecht' || subTab === 'monsters' || subTab === 'encounters')) _gevechtSubTab = subTab;
  const el = document.querySelector('.dm-tab-content[data-tab="gevecht"]');
  if (!el) return;

  // Verplaats #dm-monsters-content naar de gecombineerde gevecht-tab als dat nog niet zo is
  const monstersEl = document.getElementById('dm-monsters-content');
  if (monstersEl && !el.contains(monstersEl)) el.appendChild(monstersEl);
  const gevechtEl = document.getElementById('dm-gevecht-content');

  // Sub-tab-nav injecteren/bijwerken
  if (!el.querySelector('.dm-subtab-nav')) {
    const nav = document.createElement('div');
    nav.className = 'dm-subtab-nav';
    el.prepend(nav);
  }
  // Zorg dat encounters-div bestaat
  if (!el.querySelector('#dm-encounters-content')) {
    const encDiv = document.createElement('div');
    encDiv.id = 'dm-encounters-content';
    el.appendChild(encDiv);
  }
  const encountersEl = el.querySelector('#dm-encounters-content');

  el.querySelector('.dm-subtab-nav').innerHTML = `
    <button class="dm-subtab-btn${_gevechtSubTab==='gevecht'  ?' active':''}" onclick="window.dmPanel.switchTab('gevecht')" title="Gevecht">${icon('crossed-swords',{cls:'icon-gi'})}</button>
    <button class="dm-subtab-btn${_gevechtSubTab==='monsters' ?' active':''}" onclick="window.dmPanel.switchTab('monsters')" title="Monsters">${icon('skull')}</button>
    <button class="dm-subtab-btn${_gevechtSubTab==='encounters'?' active':''}" onclick="window.dmPanel.switchTab('encounters')" title="Encounters">${icon('clipboard-list')}</button>
  `;

  // Toon/verberg de juiste sub-content
  if (gevechtEl)   gevechtEl.classList.toggle('hidden',   _gevechtSubTab !== 'gevecht');
  if (monstersEl)  monstersEl.classList.toggle('hidden',  _gevechtSubTab !== 'monsters');
  if (encountersEl)encountersEl.classList.toggle('hidden', _gevechtSubTab !== 'encounters');

  if (_gevechtSubTab === 'encounters') {
    _renderEncounters();
  } else if (_gevechtSubTab === 'gevecht') {
    Promise.all([
      api.listMonsters().then(d => { _monsters = (d.monsters || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nl')); }).catch(() => {}),
      api.listEntities('personages').then(list => { _setupPersonages = list || []; }).catch(() => {}),
    ]).then(() => {
      if (_tabToParent(_activeTab) !== 'gevecht') return;
      const isEmpty = !_combat?.active && (_combat?.combatants?.length || 0) === 0;
      if (isEmpty) _autoAddSpelers().then(() => _renderGevecht());
      else _syncSpelerHp().then(() => _renderGevecht());
    });
    _renderGevecht();
  } else {
    _loadAndRenderMonsters();
  }
};

// Helper: zoek de juiste container voor een "logische" tab-naam,
// ook als die tab is samengevoegd in een parent-tab of de instellingen-modal.
function _tabEl(name) {
  return document.getElementById(`dm-inst-${name}`)
      || document.getElementById(`dm-diensten-${name}`)
      || document.getElementById(`dm-delen-${name}`)
      || document.querySelector(`.dm-tab-content[data-tab="${name}"]`);
};

// ── Diensten (Herberg + Tweespalt + Gock gecombineerd) ──

let _dienstenSubTab = 'herberg'; // 'herberg' | 'tweespalt' | 'gock'

function _renderDiensten(subTab) {
  if (subTab && _DIENSTEN_TABS.has(subTab)) _dienstenSubTab = subTab;
  const el = document.querySelector('.dm-tab-content[data-tab="diensten"]');
  if (!el) return;

  // Sub-tab-nav
  if (!el.querySelector('.dm-subtab-nav')) {
    const nav = document.createElement('div');
    nav.className = 'dm-subtab-nav';
    el.prepend(nav);
  }
  el.querySelector('.dm-subtab-nav').innerHTML = `
    <button class="dm-subtab-btn${_dienstenSubTab==='herberg'   ?' active':''}" onclick="window.dmPanel.switchTab('herberg')" title="Herberg">${icon('beer')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='tweespalt' ?' active':''}" onclick="window.dmPanel.switchTab('tweespalt')" title="Tweespalt">${icon('dice',{cls:'icon-gi'})}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='gock'      ?' active':''}" onclick="window.dmPanel.switchTab('gock')" title="De Gock">${icon('search')}</button>
 <button class="dm-subtab-btn${_dienstenSubTab==='ursula'    ?' active':''}" onclick="window.dmPanel.switchTab('ursula')" title="Madame Ursula">${icon('sparkles')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='tempel'    ?' active':''}" onclick="window.dmPanel.switchTab('tempel')" title="De Tempel">${icon('church')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='heeren'    ?' active':''}" onclick="window.dmPanel.switchTab('heeren')" title="Heeren van de Nacht">${icon('eye')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='facties'   ?' active':''}" onclick="window.dmPanel.switchTab('facties')" title="Facties & Aanzien">${icon('landmark')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='magizoo'   ?' active':''}" onclick="window.dmPanel.switchTab('magizoo')" title="De Magizoöloog">${icon('paw-print')}</button>
    <button class="dm-subtab-btn${_dienstenSubTab==='toegang'   ?' active':''}" onclick="window.dmPanel.switchTab('toegang')" title="Toegang per groep">${icon('lock')}</button>
  `;

  // Gooi de legacy tab-content divs om naar sub-divs binnen #diensten
  ['herberg','tweespalt','gock','ursula','tempel','heeren','facties','magizoo','toegang'].forEach(name => {
    let legacy = document.querySelector(`.dm-tab-content[data-tab="${name}"]`);
    if (legacy && legacy.closest('.dm-tab-content[data-tab="diensten"]') == null) {
      el.appendChild(legacy);
    }
  });

  // Toon alleen de actieve subtab
  ['herberg','tweespalt','gock','ursula','tempel','heeren','facties','magizoo','toegang'].forEach(name => {
    const div = el.querySelector('.dm-tab-content[data-tab="' + name + '"]');
    if (div) div.classList.toggle('active', name === _dienstenSubTab);
  });

  if (_dienstenSubTab === 'herberg')   _renderHerbergSettings();
  if (_dienstenSubTab === 'tweespalt') _renderTweespaltDM();
  if (_dienstenSubTab === 'gock')      _renderGockSettings();
  if (_dienstenSubTab === 'ursula')    _renderUrsulaSettings();
  if (_dienstenSubTab === 'tempel')    _renderTempelSettings();
  if (_dienstenSubTab === 'heeren')    _renderHeerenSettings();
  if (_dienstenSubTab === 'facties')   _renderFactiesSettings();
  if (_dienstenSubTab === 'magizoo')   _renderMagizooSettings();
  if (_dienstenSubTab === 'toegang')   _renderDienstenToegang();
};

// ── Aktes — voorbereiding & regie (verhuisd vanuit het Logboek) ──
async function _renderAktes() {
  const el = _tabEl('aktes');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  // Archief-data + meta laden zodat de regie-script-secties werken (ook zonder
  // dat het Logboek bezocht is). Helpers staan in render-archief.js.
  let archief = {};
  try { const r = await window._loadAkteData?.(); archief = r?.archiefData || {}; } catch {}
  const meta = window.app?.state?.meta || {};
  const hk   = meta.hoofdstukken || {};
  const cv   = archief.chapterVisibility || {};
  const grp  = window._activeGroupId || null;
  const grpName = window._groups?.find(g => g.id === grp)?.name || null;

  // Re-render-hook zodat de bestaande akte-functies deze tab verversen.
  window._onAkteBeheerChange = () => { if (_activeTab === 'aktes') _renderAktes(); };

  const aktes = Object.entries(hk)
    .filter(([, v]) => (v.num ?? 99) < 90)
    .sort((a, b) => (a[1].num || 99) - (b[1].num || 99));

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-akte-head">
        <div class="dm-section-label" style="margin:0">Aktes — voorbereiding &amp; regie</div>
        <div class="dm-feature-row" style="gap:6px;margin:0">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.dmPanel.akteImport()" title="Importeer een Obsidian-hoofdstuk (.md) als regie-script">${icon('upload')} Importeer</button>
          <button class="dm-btn dm-btn-primary dm-btn-sm" onclick="window.dmPanel.akteNieuw()" title="Nieuwe akte">${icon('plus')} Nieuwe akte</button>
        </div>
      </div>
      ${grpName ? `<p class="dm-akte-grp-hint">Zichtbaarheid geldt voor de actieve groep: <strong>${esc(grpName)}</strong></p>` : ''}
      ${aktes.length === 0
        ? '<p class="dm-hint" style="opacity:.7">Nog geen aktes. Maak er een aan met „Nieuwe akte".</p>'
        : aktes.map(([ch, info]) => {
            const hidden = grp && cv[grp]?.[ch] === false;
            const open   = _akteOpen.has(ch);
            return `
            <div class="dm-akte-card${hidden ? ' dm-akte-card--hidden' : ''}">
              <div class="dm-akte-card-head" onclick="window.dmPanel.akteToggle('${esc(ch)}')">
                <span class="dm-akte-num">Akte ${esc(String(info.num ?? '?'))}</span>
                <span class="dm-akte-title">${esc(info.title || ch)}</span>
                ${info.dag ? `<span class="dm-akte-dag">${esc(info.dag)}</span>` : ''}
                <span class="dm-akte-toggle">${open ? '▾' : '▸'}</span>
              </div>
              <div class="dm-akte-actions">
                <button class="dm-btn dm-btn-sm dm-btn-icon" onclick="window.dmPanel.akteSpeel('${esc(ch)}')" title="Speel akte — laad de regie-balk">${icon('play')}</button>
                <button class="dm-btn dm-btn-sm dm-btn-icon" onclick="window.dmPanel.akteBewerk('${esc(ch)}')" title="Akte bewerken (titel, banner, samenvatting)">${icon('pencil')}</button>
                ${grp ? `<button class="dm-btn dm-btn-sm dm-btn-icon${hidden ? ' dm-btn-danger-sm' : ''}"
                  onclick="window.dmPanel.akteVisToggle('${esc(ch)}',${hidden})"
                  title="${hidden ? 'Akte verborgen voor ' + esc(grpName) + ' — klik om te tonen' : 'Akte zichtbaar voor ' + esc(grpName) + ' — klik om te verbergen'}">
                  ${hidden ? icon('lock') : icon('eye')}</button>` : ''}
              </div>
              ${open ? `<div class="dm-akte-script logboek-chapter-script" id="logboek-script-section-${esc(ch)}">${(window._akteScriptHtml ? window._akteScriptHtml(ch) : '')}</div>` : ''}
            </div>`;
          }).join('')}
    </div>`;
};

function _akteNieuw() {
  const meta = window.app?.state?.meta || {};
  const hk = meta.hoofdstukken || {};
  const nums = Object.values(hk).map(v => v.num).filter(n => n < 90);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  const nextKey = 'h' + nextNum;

  const body = `
    <form id="dm-akte-nieuw-form" class="dm-feature-section" style="margin:0">
      <div class="dm-feature-row" style="gap:8px">
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Nummer</label>
          <input id="dm-akte-n-num" class="dm-input dm-input-sm" type="number" min="1" value="${nextNum}">
        </div>
        <div class="dm-form-row" style="flex:2">
          <label class="dm-form-label" title="Unieke interne sleutel, bv. h${nextNum}">Sleutel</label>
          <input id="dm-akte-n-key" class="dm-input dm-input-sm" value="${esc(nextKey)}" placeholder="h${nextNum}">
        </div>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Titel</label>
        <input id="dm-akte-n-title" class="dm-input" placeholder="De nieuwe akte…" autofocus>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">In-game dag (optioneel)</label>
        <input id="dm-akte-n-dag" class="dm-input" placeholder="Dag van …">
      </div>
      <div class="dm-feature-row" style="margin-top:6px">
        <button type="submit" class="dm-btn dm-btn-primary">${icon('save')} Aanmaken</button>
        <button type="button" class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">${icon('x')} Annuleren</button>
      </div>
    </form>`;
  window.app.openModal('Nieuwe akte', 'Voeg een akte toe aan de campagne', body);

  document.getElementById('dm-akte-nieuw-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const num = parseInt(document.getElementById('dm-akte-n-num')?.value) || nextNum;
    const key = (document.getElementById('dm-akte-n-key')?.value || '').trim() || ('h' + num);
    const title = (document.getElementById('dm-akte-n-title')?.value || '').trim() || ('Akte ' + num);
    const dag = (document.getElementById('dm-akte-n-dag')?.value || '').trim();
    if ((window.app?.state?.meta?.hoofdstukken || {})[key]) {
      alert(`Sleutel "${key}" bestaat al — kies een andere.`);
      return;
    }
    const short = `A${num} · ${title.length > 22 ? title.slice(0, 22) + '…' : title}`;
    try {
      await api.saveHoofdstuk(key, { num, title, dag, short });
      const newMeta = await api.meta();
      if (window.app?.state) window.app.state.meta = newMeta;
      _akteOpen.add(key);
      window.app.closeModal();
      _renderAktes();
    } catch (e) { alert('Aanmaken mislukt: ' + e.message); }
  });
};

// ── Akte-importer (Obsidian-hoofdstuk → regie-script) ──
let _akteImp = { plan: [], files: new Map(), chapterKey: '', reports: null };

function _impNormJs(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function _impBaseJs(p) { return String(p || '').split(/[\\/]/).pop().trim(); }

function _akteImportWizard() {
  const hk = window.app?.state?.meta?.hoofdstukken || {};
  const aktes = Object.entries(hk).filter(([, v]) => (v.num ?? 99) < 90)
    .sort((a, b) => (a[1].num || 99) - (b[1].num || 99));
  if (!aktes.length) { alert('Maak eerst een akte aan met „Nieuwe akte".'); return; }
  _akteImp = { plan: [], files: new Map(), chapterKey: aktes[0][0], reports: null };

  const body = `
    <div class="dm-feature-section" style="margin:0">
      <p class="dm-hint" style="margin-top:0">Upload een hoofdstuk-<code>.md</code> uit Obsidian plus de bijbehorende afbeeldingen.
      De importer matcht <code>[[wikilinks]]</code> op bestaande kaarten, leest <code>![[afbeeldingen]]</code> en
      herkent monster-encounters. Je controleert alles vóór het wegschrijven.</p>
      <div class="dm-form-row">
        <label class="dm-form-label">Doel-akte</label>
        <select id="akte-imp-key" class="dm-input dm-input-sm" onchange="window.dmPanel.akteImpField('__key','key',this.value)">
          ${aktes.map(([k, v]) => `<option value="${esc(k)}">Akte ${esc(String(v.num ?? '?'))} — ${esc(v.title || k)}</option>`).join('')}
        </select>
      </div>
      <div class="dm-feature-row" style="gap:10px">
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Hoofdstuk (.md)</label>
          <input id="akte-imp-md" class="dm-input dm-input-sm" type="file" accept=".md,text/markdown,text/plain">
        </div>
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Afbeeldingen (meerdere)</label>
          <input id="akte-imp-imgs" class="dm-input dm-input-sm" type="file" accept="image/*" multiple>
        </div>
      </div>
      <div class="dm-feature-row" style="margin-top:4px">
        <button class="dm-btn dm-btn-primary dm-btn-sm" onclick="window.dmPanel.akteImpAnalyse()">${icon('search')} Analyseer</button>
      </div>
      <div id="akte-imp-results" style="margin-top:10px"></div>
    </div>`;
  window.app.openModal('Importeer uit Obsidian', 'Hoofdstuk → regie-script', body);
}

async function _akteImpAnalyse() {
  const keyEl = document.getElementById('akte-imp-key');
  _akteImp.chapterKey = keyEl ? keyEl.value : _akteImp.chapterKey;
  const mdEl = document.getElementById('akte-imp-md');
  const imgEl = document.getElementById('akte-imp-imgs');
  const out = document.getElementById('akte-imp-results');
  const mdFile = mdEl?.files?.[0];
  if (!mdFile) { if (out) out.innerHTML = '<p class="dm-hint" style="color:var(--gb-danger,#b44)">Kies eerst een .md-bestand.</p>'; return; }
  if (out) out.innerHTML = '<p class="dm-hint">Analyseren…</p>';

  _akteImp.files = new Map();
  const imageNames = [];
  for (const f of (imgEl?.files || [])) { _akteImp.files.set(_impNormJs(_impBaseJs(f.name)), f); imageNames.push(f.name); }

  let md = '';
  try { md = await mdFile.text(); } catch { if (out) out.innerHTML = '<p class="dm-hint">Kon het bestand niet lezen.</p>'; return; }

  try {
    const r = await api.importAktePreview({ md, imageNames, chapterKey: _akteImp.chapterKey });
    _akteImp.plan = r.plan || [];
    _akteImp.reports = r.reports || {};
    _renderAkteImpPlan();
  } catch (e) {
    if (out) out.innerHTML = `<p class="dm-hint" style="color:var(--gb-danger,#b44)">Analyse mislukt: ${esc(e.message)}</p>`;
  }
}

function _renderAkteImpPlan() {
  const out = document.getElementById('akte-imp-results');
  if (!out) return;
  const plan = _akteImp.plan;
  const ENT_ICON = { personages: 'user', locaties: 'map-pin', organisaties: 'landmark', voorwerpen: 'package' };
  const nImg = plan.filter(s => s.type === 'image' && s.include).length;
  const nEnt = plan.filter(s => s.type === 'entity' && s.include).length;
  const nEnc = plan.filter(s => s.type === 'encounter' && s.include).length;
  const existing = (window.app?.state?.meta?.hoofdstukken?.[_akteImp.chapterKey]?.script || []).length;

  const rows = plan.map(s => {
    const off = s.include ? '' : ' style="opacity:.4"';
    const chk = `<input type="checkbox" ${s.include ? 'checked' : ''} onchange="window.dmPanel.akteImpToggle('${s.id}')">`;
    if (s.type === 'image') {
      const miss = s._status === 'missing';
      return `<div class="dm-imp-row"${off}>
        ${chk} ${icon('image')}
        <input class="dm-input dm-input-sm" style="flex:1" value="${esc(s.caption || '')}"
          oninput="window.dmPanel.akteImpField('${s.id}','caption',this.value)" placeholder="Onderschrift">
        ${miss ? `<span class="dm-imp-tag dm-imp-tag--warn" title="Bestand niet meegeüpload">${esc(s.file)} — ontbreekt</span>`
               : `<span class="dm-imp-tag dm-imp-tag--ok">${esc(s.file)}</span>`}</div>`;
    }
    if (s.type === 'entity') {
      const um = s._status === 'unmatched';
      return `<div class="dm-imp-row"${off}>
        ${chk} ${icon(ENT_ICON[s.entityType] || 'help-circle')}
        <span style="flex:1">${esc(s.name)}</span>
        ${um ? '<span class="dm-imp-tag dm-imp-tag--warn">geen kaart-match</span>'
             : `<span class="dm-imp-tag dm-imp-tag--ok">${esc(s.entityType)}</span>`}</div>`;
    }
    // encounter
    const mons = (s.monsters || []).map((m, mi) => `
      <div class="dm-imp-mon">
        <input class="dm-input dm-input-sm" style="width:42px" type="number" min="1" value="${m.count}"
          onchange="window.dmPanel.akteImpMonField('${s.id}',${mi},'count',this.value)">×
        <input class="dm-input dm-input-sm" style="flex:1" value="${esc(m.name)}"
          oninput="window.dmPanel.akteImpMonField('${s.id}',${mi},'name',this.value)">
        ${m.matched ? `<span class="dm-imp-tag dm-imp-tag--ok">statblock</span>`
                    : `<span class="dm-imp-tag dm-imp-tag--warn">geen statblock</span>`}
      </div>`).join('');
    return `<div class="dm-imp-row dm-imp-row--enc"${off}>
      <div style="display:flex;align-items:center;gap:6px">${chk} ${icon('crossed-swords')}
        <input class="dm-input dm-input-sm" style="flex:1" value="${esc(s.name)}"
          oninput="window.dmPanel.akteImpField('${s.id}','name',this.value)" placeholder="Encounter-naam"></div>
      <div class="dm-imp-mons">${mons || '<span class="dm-hint">geen monsters herkend</span>'}</div></div>`;
  }).join('');

  out.innerHTML = `
    <div class="dm-imp-summary">${nImg} afbeelding(en) · ${nEnt} kaart(en) · ${nEnc} encounter(s)</div>
    <div class="dm-imp-list">${rows || '<p class="dm-hint">Niets herkend in dit bestand.</p>'}</div>
    <div class="dm-feature-row" style="margin-top:8px;gap:14px;align-items:center">
      <label class="dm-imp-mode"><input type="radio" name="akte-imp-mode" value="replace" checked> Vervang script${existing ? ` (${existing} stappen worden vervangen)` : ''}</label>
      <label class="dm-imp-mode"><input type="radio" name="akte-imp-mode" value="append"> Voeg toe aan bestaand</label>
    </div>
    <div class="dm-feature-row" style="margin-top:8px">
      <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.akteImpApply()">${icon('save')} Importeer in akte</button>
      <button class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">${icon('x')} Annuleren</button>
    </div>`;
}

function _akteImpToggle(id) {
  const s = _akteImp.plan.find(x => x.id === id);
  if (s) { s.include = !s.include; _renderAkteImpPlan(); }
}
function _akteImpField(id, f, val) {
  if (id === '__key' && f === 'key') { _akteImp.chapterKey = val; return; }
  const s = _akteImp.plan.find(x => x.id === id);
  if (s) s[f] = val;
}
function _akteImpMonField(id, mi, f, val) {
  const s = _akteImp.plan.find(x => x.id === id);
  if (s && s.monsters && s.monsters[mi]) s.monsters[mi][f] = f === 'count' ? (parseInt(val) || 1) : val;
}

async function _akteImpApply() {
  const modeEl = document.querySelector('input[name="akte-imp-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'replace';
  const out = document.getElementById('akte-imp-results');
  const fd = new FormData();
  fd.append('plan', JSON.stringify(_akteImp.plan));
  fd.append('chapterKey', _akteImp.chapterKey);
  fd.append('mode', mode);
  // Alleen bestanden voor opgenomen, aanwezige image-stappen meesturen.
  const sent = new Set();
  for (const s of _akteImp.plan) {
    if (s.type !== 'image' || !s.include) continue;
    const key = _impNormJs(_impBaseJs(s.file));
    if (sent.has(key)) continue;
    const f = _akteImp.files.get(key);
    if (f) { fd.append('images', f, f.name); sent.add(key); }
  }
  try {
    const r = await api.importAkteApply(fd);
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    if (out) out.innerHTML = `<div class="dm-imp-summary" style="color:var(--gb-ok,#3a7)">
      ✓ Geïmporteerd in ${esc(r.chapterKey)} — ${r.stepsAdded} stappen toegevoegd
      (${r.imagesUploaded} afbeeldingen, ${r.encountersCreated} encounters). Script telt nu ${r.scriptLength} stappen.</div>
      <div class="dm-feature-row" style="margin-top:8px"><button class="dm-btn dm-btn-primary" onclick="window.app.closeModal()">${icon('check')} Klaar</button></div>`;
    _renderAktes();
  } catch (e) {
    if (out) out.innerHTML = `<p class="dm-hint" style="color:var(--gb-danger,#b44)">Import mislukt: ${esc(e.message)}</p>`;
  }
}


// ── Diensten toegang per groep ──
const _DIENSTEN_TOEGANG_INFO = [
  { key: 'herberg',   label: 'Herberg',            icon: 'beer'      },
  { key: 'tweespalt', label: 'De Tweespalt',        icon: 'dice'      },
  { key: 'gock',      label: 'De Gock',             icon: 'search'    },
  { key: 'ursula',    label: 'Madame Ursula',        icon: 'sparkles'  },
  { key: 'tempel',    label: 'De Tempel',            icon: 'church'    },
  { key: 'heeren',    label: 'Heeren v.d. Nacht',    icon: 'eye'       },
  { key: 'facties',   label: 'Facties & Aanzien',    icon: 'landmark'  },
  { key: 'magizoo',   label: 'De Magizoöloog',       icon: 'paw-print' },
];

const _STAAT_LABELS = {
  verborgen:    { label: 'Verborgen',    icoon: () => icon('eye-off'),   cls: 'staat-verborgen'    },
  zichtbaar:    { label: 'Zichtbaar',    icoon: () => icon('eye'),       cls: 'staat-zichtbaar'    },
  beschikbaar:  { label: 'Beschikbaar',  icoon: () => icon('lock-open'), cls: 'staat-beschikbaar'  },
};
const _STAAT_CYCLE = ['verborgen', 'zichtbaar', 'beschikbaar'];

async function _renderDienstenToegang() {
  const el = _tabEl('toegang');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  let data;
  try { data = await api.getDienstenToegang(); }
  catch { el.innerHTML = '<div class="dm-feature-section"><p class="dm-form-label" style="opacity:.6">Kon toegangsdata niet laden.</p></div>'; return; }

  const { alle = {}, groups = [] } = data;

  // Bouw de tabel op
  const colHeaders = groups.map(g =>
    `<th style="min-width:90px;text-align:center;font-size:.8rem;padding:4px 6px;word-break:break-word">${esc(g.name)}${g.active ? ' <span style="opacity:.5">(actief)</span>' : ''}</th>`
  ).join('');

  const rows = _DIENSTEN_TOEGANG_INFO.map(d => {
    const cols = groups.map(g => {
      const staat = (alle[g.id] || {})[d.key] || 'beschikbaar';
      const s = _STAAT_LABELS[staat];
      return `<td style="text-align:center;padding:3px">
        <button class="dm-btn dm-btn-ghost toegang-toggle ${s.cls}"
          style="min-width:100px;font-size:.78rem;padding:3px 7px"
          onclick="window._toggleDienstToegang('${esc(g.id)}','${esc(d.key)}','${staat}')"
          title="Klik om te wisselen">
          ${s.icoon()} ${s.label}
        </button></td>`;
    }).join('');
    return `<tr>
      <td style="padding:4px 8px 4px 0;white-space:nowrap;font-size:.85rem">
        ${icon(d.icon, d.key === 'tweespalt' ? {cls:'icon-gi'} : {})} ${esc(d.label)}
      </td>
      ${cols}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Toegang per groep</div>
      <p class="dm-form-label" style="opacity:.7;margin:0 0 10px">Bepaal per dienst en per groep of die zichtbaar en/of beschikbaar is.</p>
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px 4px 0;font-size:.8rem">Dienst</th>
            ${colHeaders}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
};

window._toggleDienstToegang = async (groepId, dienst, huidig) => {
  const idx = _STAAT_CYCLE.indexOf(huidig);
  const nieuw = _STAAT_CYCLE[(idx + 1) % _STAAT_CYCLE.length];
  try {
    await api.setDienstToegang(groepId, dienst, nieuw);
    _renderDienstenToegang();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

// ── Delen (Tunnel + Export gecombineerd) ──

let _delenSubTab = 'tunnel'; // 'tunnel' | 'export'

function _renderDelen(subTab) {
  if (subTab && _DELEN_TABS.has(subTab)) _delenSubTab = subTab;
  const el = document.querySelector('.dm-tab-content[data-tab="delen"]');
  if (!el) return;

  // Sub-tab-nav
  if (!el.querySelector('.dm-subtab-nav')) {
    const nav = document.createElement('div');
    nav.className = 'dm-subtab-nav';
    el.prepend(nav);
  }
  el.querySelector('.dm-subtab-nav').innerHTML = `
    <button class="dm-subtab-btn${_delenSubTab==='tunnel' ?' active':''}" onclick="window.dmPanel.switchTab('tunnel')">${icon('globe')} Tunnel</button>
    <button class="dm-subtab-btn${_delenSubTab==='export' ?' active':''}" onclick="window.dmPanel.switchTab('export')">${icon('download')} Export</button>
  `;

  ['tunnel','export'].forEach(name => {
    let legacy = document.querySelector(`.dm-tab-content[data-tab="${name}"]`);
    if (!legacy) return;
    let sub = el.querySelector(`#dm-delen-${name}`);
    if (!sub) {
      sub = document.createElement('div');
      sub.id = `dm-delen-${name}`;
      while (legacy.firstChild) sub.appendChild(legacy.firstChild);
      el.appendChild(sub);
    }
    sub.classList.toggle('hidden', _delenSubTab !== name);
    legacy.classList.remove('active');
  });

  if (_delenSubTab === 'tunnel') _renderTunnel();
  if (_delenSubTab === 'export') _renderExportTab();
};

async function _loadSpells() {
  const url = _isHpCampaign()
    ? '/data/hp-spells.json'
    : 'https://www.dnd5eapi.co/api/spells';
  try {
    const r = await fetch(url);
    const d = await r.json();
    _spellList = d.results || [];
  } catch {
    _spellList = [];
  }
  if (_activeTab === 'spreuken') _renderSpreuken();
};

function _renderSpreuken() {
  const el = document.querySelector('.dm-tab-content[data-tab="spreuken"]');
  if (!el) return;
  if (_spellDetail) { el.innerHTML = _spellDetailHtml(_spellDetail); return; }
  if (_spellList === null) _loadSpells();

  // Only rebuild the DOM when the search input doesn't exist yet
  if (!document.getElementById('dm-spell-search')) {
    el.innerHTML = `
      <div class="dm-feature-section" style="padding-bottom:8px">
        <div class="dm-feature-row">
          <input class="dm-input" id="dm-spell-search" placeholder="Zoek spreuk…"
            oninput="window.dmPanel.spellSearch(this.value)">
        </div>
        <p id="dm-spell-loading" class="dm-hint"></p>
      </div>
      <p id="dm-spell-noresults" class="dm-hint" style="padding:0 12px;display:none">Geen resultaten gevonden.</p>
      <div id="dm-spell-results"></div>`;
    setTimeout(() => {
      const inp = document.getElementById('dm-spell-search');
      if (inp) { inp.value = _spellQuery; inp.focus(); }
    }, 0);
  }
  _updateSpellResults();
};

function _updateSpellResults() {
  const loading   = document.getElementById('dm-spell-loading');
  const noresults = document.getElementById('dm-spell-noresults');
  const results   = document.getElementById('dm-spell-results');
  if (!results) return;

  if (loading) loading.textContent = _spellList === null ? 'Spreukenlijst laden…' : '';

  const q = _spellQuery.toLowerCase().trim();
  const filtered = q && _spellList
    ? _spellList.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
    : [];

  if (noresults) noresults.style.display = (q && filtered.length === 0 && _spellList !== null) ? 'block' : 'none';
  results.innerHTML = filtered.map(s =>
    `<div class="dm-spell-row" onclick="window.dmPanel.spellOpen('${esc(s.index)}')">${esc(s.name)}</div>`
  ).join('');
};

function _spellDetailHtml(s) {
  const schoolMap = {
    // D&D scholen
    Abjuration: 'Afwering', Conjuration: 'Bezwering', Divination: 'Waarzeggerij',
    Enchantment: 'Betovering', Evocation: 'Oproeping', Illusion: 'Illusie',
    Necromancy: 'Necromantie', Transmutation: 'Transmutatie',
    // HP scholen
    Charm: 'Bezwering', Curse: 'Vloek', Transfiguration: 'Gedaanteverandering',
    Healing: 'Genezing',
  };
  const levelStr = s.level === 0 ? 'Tovervorm' : `Niveau ${s.level}`;
  const school   = schoolMap[s.school?.name] || s.school?.name || '';
  const comps    = [
    s.components?.includes('V') ? 'V' : '',
    s.components?.includes('S') ? 'G' : '',
    s.components?.includes('M') ? `M (${s.material || '…'})` : '',
  ].filter(Boolean).join(', ');
  const _md = t => t
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const desc   = (s.desc || []).map(p => `<p class="dm-spell-p">${_md(esc(p))}</p>`).join('');
  const higher = s.higher_level?.length
    ? `<p class="dm-spell-p dm-spell-higher"><strong>Op hogere niveaus:</strong> ${esc(s.higher_level.join(' '))}</p>`
    : '';

  let link = '';
  if (_isHpCampaign()) {
    const wikiSlug = s.name.replace(/\s*\/.*$/, '').trim().replace(/\s+/g, '_');
    link = `<a class="dm-spell-link" href="https://harrypotter.fandom.com/wiki/${encodeURIComponent(wikiSlug)}" target="_blank" rel="noopener">HP-wiki →</a>`;
  } else {
    const wikidotSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link = `<a class="dm-spell-link" href="https://dnd5e.wikidot.com/spell:${wikidotSlug}" target="_blank" rel="noopener">Wikidot →</a>`;
  }

  return `
    <div class="dm-feature-section dm-spell-detail">
      <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.dmPanel.spellBack()" title="Terug naar overzicht" style="margin-bottom:10px">←</button>
      <div class="dm-spell-name">${esc(s.name)}</div>
      <div class="dm-spell-meta">${levelStr} · ${school}${s.ritual ? ' · Ritueel' : ''}</div>
      <div class="dm-spell-props">
        <div><span>Casting Time</span><span>${esc(s.casting_time)}</span></div>
        <div><span>Range</span><span>${esc(s.range)}</span></div>
        ${comps ? `<div><span>Components</span><span>${esc(comps)}</span></div>` : ''}
        <div><span>Duration</span><span>${esc(s.duration)}${s.concentration ? ' (concentration)' : ''}</span></div>
      </div>
      <div class="dm-spell-desc">${desc}${higher}</div>
      ${link}
      <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.10);padding-top:12px">
        <div style="font-size:10px;color:rgba(255,255,255,0.40);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">Afbeelding voor spelers</div>
        <img id="dm-spell-img-thumb" src="/api/files/spell-img-${esc(s.index)}?t=${Date.now()}"
          style="max-width:100%;max-height:110px;border-radius:6px;display:block;margin-bottom:8px"
          onerror="this.style.display='none'" alt="">
        <label class="dm-btn dm-btn-ghost dm-btn-sm" style="gap:5px">
          📷 Afbeelding instellen
          <input type="file" accept="image/*" style="display:none"
            onchange="window.dmPanel.uploadSpellImage('${esc(s.index)}', this.files[0])">
        </label>
      </div>
    </div>`;
};

async function _spellOpen(index) {
  const el = document.querySelector('.dm-tab-content[data-tab="spreuken"]');
  if (el) el.innerHTML = '<p class="dm-hint" style="padding:12px">Laden…</p>';
  try {
    if (_isHpCampaign()) {
      // HP spreuken zijn volledig in de lijst opgeslagen — geen tweede fetch nodig
      if (!_spellList) await _loadSpells();
      _spellDetail = (_spellList || []).find(s => s.index === index) || null;
      if (!_spellDetail) throw new Error('not found');
    } else {
      const r  = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
      _spellDetail = await r.json();
    }
    _renderSpreuken();
  } catch {
    if (el) el.innerHTML = '<p class="dm-hint" style="padding:12px">Laden mislukt.</p>';
  }
};

function _spellBack() {
  _spellDetail = null;
  _renderSpreuken();
};

function _spellSearch(q) {
  _spellQuery = q;
  _updateSpellResults();
};

// ── Tunnel ──

window._dmPanelTunnelUrl = null;
window._dmPanelTunnelActive = false;

async function _tunnelToggle() {
  const btn = document.getElementById('dm-tunnel-btn');
  if (btn) btn.disabled = true;
  try {
    if (window._dmPanelTunnelActive) {
      await api.tunnelStop();
      window._dmPanelTunnelActive = false;
      window._dmPanelTunnelUrl = null;
    } else {
      const result = await api.tunnelStart();
      if (result && result.error) {
        _showTunnelError(result.error);
      } else {
        window._dmPanelTunnelActive = true;
        window._dmPanelTunnelUrl = null; // URL comes via socket
      }
    }
  } catch (e) {
    console.error('Tunnel error:', e);
    _showTunnelError('Verbinding mislukt — zie server-console.');
  }
  if (btn) btn.disabled = false;
  _renderTunnel();
};

function _showTunnelError(msg) {
  const el = document.getElementById('dm-tunnel-content');
  if (!el) return;
  const err = document.createElement('p');
  err.className = 'dm-hint dm-hint-error';
  err.textContent = '⚠️ ' + msg;
  el.appendChild(err);
  setTimeout(() => err.remove(), 6000);
};

function _tunnelCopy() {
  const url = window._dmPanelTunnelUrl;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('dm-tunnel-copy');
    if (btn) { const orig = btn.textContent; btn.textContent = '✓'; setTimeout(() => { btn.textContent = orig; }, 1500); }
  });
};

function _renderExportTab() {
  const el = document.getElementById('dm-export-content');
  if (!el) return;
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-label">Exporteren</div>

      <div class="export-option-card" id="export-card-snapshot">
        <div class="export-option-icon">📷</div>
        <div class="export-option-body">
          <div class="export-option-title">Snapshot</div>
          <div class="export-option-desc">Interactieve HTML-versie van de campagnedata voor spelers — met kaarten, modals en alle onthuld materiaal.</div>
          <button class="dm-btn dm-btn-primary export-option-btn" id="export-btn-snapshot"
            onclick="window.dmPanel.exportFile('snapshot')">
            📥 Snapshot downloaden
          </button>
        </div>
      </div>

      <div class="export-option-card" id="export-card-boek">
        <div class="export-option-icon">📖</div>
        <div class="export-option-body">
          <div class="export-option-title">Campagneboek</div>
          <div class="export-option-desc">Lineair, printklaar boek met inhoudsopgave, alle sessies per hoofdstuk, afbeeldingen en een register van personages, locaties en meer. Gebruik Afdrukken → Opslaan als PDF.</div>
          <button class="dm-btn dm-btn-primary export-option-btn" id="export-btn-boek"
            onclick="window.dmPanel.exportFile('campagneboek')">
            📖 Campagneboek downloaden
          </button>
        </div>
      </div>
    </div>

    <div class="dm-feature-section" style="margin-top:18px">
      <div class="dm-feature-label">Importeren vanuit Obsidian</div>

      <div class="export-option-card">
        <div class="export-option-icon">🗒️</div>
        <div class="export-option-body">
          <div class="export-option-title">Sjablonen downloaden</div>
          <div class="export-option-desc">Gebruik deze Obsidian-sjablonen om personages, locaties, organisaties, voorwerpen en documenten voor te bereiden. Vul het YAML-blok bovenaan in en importeer de bestanden hieronder.</div>
          <div class="export-template-links">
            ${['Personage','Locatie','Organisatie','Voorwerp','Document'].map(t =>
              `<a class="export-template-link" href="/obsidian-templates/${t}.md" download="${t}.md">⬇ ${t}</a>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="export-option-card" id="export-card-import">
        <div class="export-option-icon">📂</div>
        <div class="export-option-body">
          <div class="export-option-title">Markdown-bestanden importeren</div>
          <div class="export-option-desc">Selecteer één of meerdere ingevulde <code>.md</code>-bestanden. Elk bestand wordt als nieuwe entiteit of document aangemaakt op basis van het <code>type</code>-veld in de frontmatter.</div>
          <label class="export-import-label">
            <input type="file" id="import-md-input" accept=".md" multiple style="display:none"
              onchange="window.dmPanel.importObsidian(this.files)">
            <span class="dm-btn dm-btn-primary export-option-btn" onclick="document.getElementById('import-md-input').click()">
              📂 Bestanden kiezen…
            </span>
          </label>
          <div id="import-md-results" class="import-md-results hidden"></div>
        </div>
      </div>
    </div>
  `;
};

async function _importObsidian(files) {
  const resultsEl = document.getElementById('import-md-results');
  if (!files?.length || !resultsEl) return;
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = '<div class="import-md-row import-md-loading">⏳ Bezig met importeren…</div>';

  const formData = new FormData();
  for (const f of files) formData.append('files', f);

  try {
    const res = await fetch('/api/import/obsidian', {
      method: 'POST', credentials: 'include', body: formData,
    });
    const { results } = await res.json();
    const TYPE_LABELS = {
      personages: 'Personage', locaties: 'Locatie', organisaties: 'Organisatie',
      voorwerpen: 'Voorwerp', document: 'Document',
    };
    resultsEl.innerHTML = results.map(r => r.ok
      ? `<div class="import-md-row import-md-ok">✓ <strong>${r.name}</strong> <span class="import-md-type">${TYPE_LABELS[r.type] || r.type}</span></div>`
      : `<div class="import-md-row import-md-err">✕ ${r.error}</div>`
    ).join('');
    // Reset file input
    const inp = document.getElementById('import-md-input');
    if (inp) inp.value = '';
    // Reload entities in background so new items show up
    if (results.some(r => r.ok)) {
      setTimeout(() => window.app?.refreshSection?.('archief'), 400);
    }
  } catch (err) {
    resultsEl.innerHTML = `<div class="import-md-row import-md-err">✕ Fout: ${err.message}</div>`;
  }
};

async function _exportFile(type) {
  const btnId = type === 'campagneboek' ? 'export-btn-boek' : 'export-btn-snapshot';
  const btn = document.getElementById(btnId);
  const origText = btn?.textContent;
  if (btn) { btn.textContent = '⏳ Bezig…'; btn.disabled = true; }
  try {
    const url = type === 'campagneboek' ? '/api/export/campagneboek' : '/api/export';
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `${type}.html`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    if (btn) { btn.textContent = '✓ Klaar!'; setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 2500); }
  } catch (err) {
    if (btn) { btn.textContent = '✕ Fout'; setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 3000); }
  }
};

async function _exportSnapshot() {
  await _exportFile('snapshot');
};

function _renderTunnel() {
  const el = document.getElementById('dm-tunnel-content');
  if (!el) return;
  const active = window._dmPanelTunnelActive;
  const url = window._dmPanelTunnelUrl;
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row">
        <div class="dm-status-dot ${active ? 'dm-status-on' : 'dm-status-off'}" title="${active ? (url ? 'Active' : 'Connecting…') : 'Inactive'}"></div>
        ${!active ? `
          <button id="dm-tunnel-btn" class="dm-btn dm-btn-primary" onclick="window.dmPanel.tunnelToggle()" title="Start tunnel">▶</button>
        ` : `
          <span class="dm-tunnel-status-label">${url ? 'Active' : '⏳ Connecting…'}</span>
          <button id="dm-tunnel-copy" class="dm-btn dm-btn-sm" onclick="window.dmPanel.tunnelCopy()" title="Kopieer link" ${!url ? 'disabled' : ''}>⎘</button>
          <button id="dm-tunnel-btn" class="dm-btn dm-btn-danger-sm" onclick="window.dmPanel.tunnelToggle()" title="Stop tunnel">■</button>
        `}
      </div>
    </div>

  `;
};

// ── Reveal strip ──

function _positionRevealStrip() {
  const el = document.getElementById('dm-reveal-strip');
  if (!el) return;
  const main = document.querySelector('main') || document.querySelector('#app > .flex-1');
  if (main) {
    const top = Math.round(main.getBoundingClientRect().top);
    el.style.top = top + 'px';
  }
};

function _renderRevealStrip() {
  const el = document.getElementById('dm-reveal-strip');
  if (!el) return;
  // Niet opnieuw renderen als de strip al geminimaliseerd is
  if (el.classList.contains('dm-reveal-strip--minimized')) return;
  _positionRevealStrip();
  el.classList.toggle('dm-reveal-strip--visible', true);
  const thumbs = _revealQueue.slice(0, 5);
  const more   = Math.max(0, _revealQueue.length - 5);
  el.innerHTML = `
    <div style="padding-bottom:6px;border-bottom:1px solid rgba(196,168,122,0.3);margin-bottom:2px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div class="dm-form-label" style="margin:0">Afbeeldingen</div>
        <div style="display:flex;gap:4px">
          <button onclick="window.dmPanel.toggleRevealStrip()" title="Minimaliseren"
            style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--color-ink-dim);padding:0 2px;line-height:1;">−</button>
          <button onclick="window.dmPanel.closeRevealStrip()" title="Sluiten"
            style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--color-ink-dim);padding:0 2px;line-height:1;">${icon('x')}</button>
        </div>
      </div>
      <select class="dm-select" style="width:100%;font-size:10px;"
        onchange="window.dmPanel.setRevealChapter(this.value)">
        <option value="">— Akte —</option>
        ${_hkOptions(_revealChapter)}
      </select>
    </div>
    ${_revealLoading
      ? `<div class="dm-reveal-empty">⏳</div>`
      : !_revealChapter
        ? `<div class="dm-reveal-empty">Selecteer een akte om afbeeldingen te onthullen.</div>`
        : thumbs.length === 0
          ? `<div class="dm-reveal-empty">Geen verborgen afbeeldingen.<br><span style="opacity:.6">Verberg ze eerst in het logboek.</span></div>`
          : thumbs.map(item => `
              <div class="dm-reveal-thumb" id="dm-thumb-${esc(item.imgId)}">
                <img class="dm-reveal-thumb-img" src="${esc(item.url)}" loading="lazy"
                  onclick="window.dmPanel.revealImage('${esc(item.sessieId)}','${esc(item.imgId)}')"
                  title="${esc(item.caption) || 'Klik om te onthullen'}">
                <div class="dm-reveal-thumb-foot">
                  <span class="dm-reveal-thumb-caption">${esc(item.caption) || '—'}</span>
                  <button class="dm-btn dm-btn-sm" style="font-size:9px;padding:1px 6px;"
                    onclick="window.dmPanel.revealImage('${esc(item.sessieId)}','${esc(item.imgId)}')">▶</button>
                </div>
              </div>`).join('')
          + (more > 0 ? `<div style="font-size:9px;color:var(--color-ink-dim);text-align:center;padding:4px 0">+${more} meer verborgen</div>` : '')
    }`;
};

async function _loadRevealQueue(chapterKey) {
  _revealQueue = [];
  if (!chapterKey) { _renderRevealStrip(); return; }
  _revealLoading = true;
  _renderRevealStrip();
  try {
    const archief = await api.listArchief();
    for (const entry of (archief.sessieLog || [])) {
      if (entry.hoofdstuk !== chapterKey) continue;
      for (const img of (entry.images || [])) {
        const obj = typeof img === 'string' ? { id: img, visible: true } : img;
        if (obj.visible === false) {
          _revealQueue.push({
            sessieId: entry.id,
            imgId:    obj.id,
            caption:  obj.caption || '',
            url:      api.fileUrl(obj.id),
          });
        }
      }
    }
  } finally {
    _revealLoading = false;
    _renderRevealStrip();
  }
};

async function _revealImage(sessieId, imgId) {
  // Animate the thumbnail out
  const thumb = document.getElementById(`dm-thumb-${imgId}`);
  if (thumb) {
    thumb.classList.add('revealing');
    await new Promise(r => setTimeout(r, 250));
  }
  // Remove from queue (strip is no longer shown)
  _revealQueue = _revealQueue.filter(i => i.imgId !== imgId);
  // Persist via the existing API (same logic as _toggleImageVisible in render-archief.js)
  try {
    const archief = await api.listArchief();
    const entry = (archief.sessieLog || []).find(e => e.id === sessieId);
    if (!entry) return;
    const images = (entry.images || []).map(img => {
      const id = typeof img === 'string' ? img : img.id;
      return id === imgId
        ? { ...(typeof img === 'string' ? { id } : img), visible: true }
        : img;
    });
    await api.updateSessieLog(sessieId, { images });
    // → backend emits logboek:imageRevealed → players get lightbox
  } catch (err) {
    console.error('Reveal failed', err);
  }
};

// ── Regie-balk ──

async function _loadRegieBalk(chapterKey, chapterTitle) {
  _rbChapter   = chapterKey;
  _rbTitle     = chapterTitle || chapterKey;
  _rbRevealed  = new Set();
  _rbFilter    = 'all';
  _rbMinimized = false;
  _rbScript    = [];  // leeg tot data geladen is
  _renderRegieBalk();
  // Ambiance-scènes voor de snelknop in de balk laden, dan opnieuw renderen.
  _refreshAmbCache().then(() => _renderRegieBalk());

  try {
    // Haal verse meta én archief parallel op
    const [freshMeta, archief] = await Promise.all([
      api.meta(),
      api.listArchief().catch(() => ({ sessieLog: [] })),
    ]);
    if (window.app?.state) window.app.state.meta = freshMeta;
    _rbScript = freshMeta?.hoofdstukken?.[chapterKey]?.script || [];

    // Voeg alle sessie-afbeeldingen van deze akte toe die nog niet in het script staan
    const addedFileIds = new Set(_rbScript.filter(x => x.type === 'image').map(x => x.fileId));
    for (const entry of (archief.sessieLog || [])) {
      if (entry.hoofdstuk !== chapterKey) continue;
      for (const img of (entry.images || [])) {
        const id = typeof img === 'string' ? img : img.id;
        if (!addedFileIds.has(id)) {
          _rbScript.push({
            id:       'auto-' + id,
            type:     'image',
            fileId:   id,
            sessieId: entry.id,
            caption:  typeof img === 'object' ? (img.caption || '') : '',
          });
          addedFileIds.add(id);
        }
      }
    }
  } catch {
    // Fallback naar gecachte meta
    _rbScript = window.app?.state?.meta?.hoofdstukken?.[chapterKey]?.script || [];
  }
  _renderRegieBalk();
};

function _renderRegieBalkItem(item) {
  const revealed = _rbRevealed.has(item.id);
  const typeIcon  = item.type === 'image'
    ? icon('image')
    : item.type === 'entity'
      ? icon('eye')
      : icon('crossed-swords', { cls: 'icon-gi' });
  const name      = item.type === 'image' ? (item.caption || 'Afbeelding') : (item.name || '—');

  const ENTITY_ICONS = {
    personages:    icon('user'),
    locaties:      icon('map-pin'),
    organisaties:  icon('landmark'),
    voorwerpen:    icon('package'),
  };

  let thumbHtml;
  if (item.type === 'image') {
    thumbHtml = `<img class="dm-rb-item-img" src="${esc(api.fileUrl(item.fileId))}" loading="lazy" draggable="false">`;
  } else {
    const entityIcon = item.type === 'entity'
      ? (ENTITY_ICONS[item.entityType] || icon('eye'))
      : icon('crossed-swords', { cls: 'icon-gi' });
    const cls  = item.type === 'entity' ? `dm-rb-entity-${esc(item.entityType)}` : 'dm-rb-entity-encounter';
    thumbHtml = `<div class="dm-rb-item-entity-thumb ${cls}">${entityIcon}</div>`;
  }

  return `<div class="dm-rb-item${revealed ? ' dm-rb-item--revealed' : ''}">
    <div class="dm-rb-item-thumb-wrap">
      ${thumbHtml}
      ${revealed ? `<div class="dm-rb-item-revealed-overlay">${icon('check')}</div>` : ''}
    </div>
    <div class="dm-rb-item-foot">
      <span class="dm-rb-item-icon">${typeIcon}</span>
      <span class="dm-rb-item-name" title="${esc(name)}">${esc(name)}</span>
      ${!revealed
        ? `<button class="dm-rb-reveal-btn" onclick="window.dmPanel.regieBalkReveal('${esc(item.id)}')" title="Onthul">${icon('play')}</button>`
        : ''}
    </div>
  </div>`;
};

function _renderRegieBalk() {
  const el = document.getElementById('dm-regie-balk');
  if (!el) return;

  if (!_rbChapter) {
    el.classList.remove('dm-regie-balk--visible');
    return;
  }

  el.classList.add('dm-regie-balk--visible');

  if (_rbMinimized) {
    el.innerHTML = `<div class="dm-regie-balk-minimized-bar">
      <button class="dm-regie-balk-expand-btn" onclick="window.dmPanel.regieBalkToggleMinimize()">
        ${icon('clipboard-list')} ${esc(_rbTitle)} <span style="opacity:.5">▲</span>
      </button>
    </div>`;
    return;
  }

  const FILTER_TABS = [
    { key: 'all',       label: 'Alle' },
    { key: 'image',     label: icon('image') },
    { key: 'entity',    label: icon('eye') },
    { key: 'encounter', label: icon('swords') },
  ];

  const items = _rbFilter === 'all'
    ? _rbScript
    : _rbScript.filter(x => x.type === _rbFilter);

  const revealedCount = _rbRevealed.size;
  const totalCount    = _rbScript.length;

  el.innerHTML = `
    <div class="dm-regie-balk-inner">
      <div class="dm-regie-balk-header">
        <div class="dm-regie-balk-header-left">
          <span class="dm-regie-balk-akte-label">${icon('clipboard-list')} ${esc(_rbTitle)}</span>
          ${totalCount > 0 ? `<span class="dm-rb-progress">${revealedCount}/${totalCount}</span>` : ''}
          <div class="dm-regie-balk-filters">
            ${FILTER_TABS.map(t => `
              <button class="dm-regie-balk-filter${_rbFilter === t.key ? ' active' : ''}"
                onclick="window.dmPanel.regieBalkFilter('${t.key}')">${t.label}</button>`).join('')}
          </div>
        </div>
        <div class="dm-regie-balk-header-right">
          <div class="dm-rb-amb">${
            _ambCache.actief
              ? `<button class="dm-regie-balk-btn dm-rb-amb-btn--on" onclick="window._ambStop()"
                   title="Stop ambiance: ${esc(_ambCache.scenes.find(s => s.id === _ambCache.actief)?.label || '')}">${icon('volume-2')}</button>`
              : (_ambCache.scenes.length
                ? `<select class="dm-rb-amb-select" title="Ambiance afspelen bij iedereen"
                     onchange="if(this.value)window._ambPlay(this.value)">
                     <option value="">${icon ? '' : ''}♪ Ambiance…</option>
                     ${_ambCache.scenes.map(s => `<option value="${esc(s.id)}">${esc(s.label || 'Scène')}</option>`).join('')}
                   </select>`
                : '')
          }</div>
          <button class="dm-regie-balk-btn dm-rb-combat-btn${_combat?.active ? '' : ' hidden'}" id="dm-rb-combat-btn"
            onclick="window.dmPanel.combatExpand()" title="Gevecht uitklappen">${icon('stiletto',{cls:'icon-gi'})}</button>
          <button class="dm-regie-balk-btn" onclick="window.dmPanel.regieBalkToggleMinimize()" title="Minimaliseren">−</button>
          <button class="dm-regie-balk-btn" onclick="window.dmPanel.regieBalkClose()" title="Sluiten">${icon('x')}</button>
        </div>
      </div>
      <div class="dm-regie-balk-scroll-wrap">
        <button class="dm-rb-scroll-btn dm-rb-scroll-btn--left" onclick="window._rbScroll(-1)" title="Naar links">&#8249;</button>
        <div class="dm-regie-balk-scroll" id="dm-rb-scroll">
          ${items.length === 0
            ? `<div class="dm-regie-balk-empty">${_rbScript.length === 0
                ? 'Geen script-items voor deze akte. Voeg items toe via het logboek.'
                : 'Geen items in dit filter.'}</div>`
            : items.map(item => _renderRegieBalkItem(item)).join('')}
        </div>
        <button class="dm-rb-scroll-btn dm-rb-scroll-btn--right" onclick="window._rbScroll(1)" title="Naar rechts">&#8250;</button>
      </div>
    </div>`;
  // Verberg geminimaliseerde combat-balk als aktebar open is
  document.body.classList.add('dm-rb-active');
  requestAnimationFrame(_rbInitDrag);
};

// Scroll de regie-balk met de pijlknoppen
window._rbScroll = (dir) => {
  const el = document.getElementById('dm-rb-scroll');
  if (el) el.scrollBy({ left: dir * 320, behavior: 'smooth' });
};

// Initialiseer drag-to-scroll op de regie-balk scrollrij
function _rbInitDrag() {
  const el = document.getElementById('dm-rb-scroll');
  if (!el || el._dragInit) return;
  el._dragInit = true;
  let isDown = false, startX = 0, scrollLeft = 0;
  el.addEventListener('dragstart', e => e.preventDefault());
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDown = true;
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    el.classList.add('dm-rb-scroll--dragging');
  });
  el.addEventListener('mouseleave', () => { isDown = false; el.classList.remove('dm-rb-scroll--dragging'); });
  el.addEventListener('mouseup',    () => { isDown = false; el.classList.remove('dm-rb-scroll--dragging'); });
  el.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  });
};

async function _revealRegieBalkItem(itemId) {
  const item = _rbScript.find(x => x.id === itemId);
  if (!item) return;
  // Optimistic UI update
  _rbRevealed.add(itemId);
  _renderRegieBalk();
  // Perform actual reveal
  try {
    if (item.type === 'image') {
      await _revealImage(item.sessieId, item.fileId);
    } else if (item.type === 'entity') {
      if (item.entityType === 'documenten') {
        await api.setArchiefState(item.entityId, 'visible');
      } else {
        await api.toggleVisibility(item.entityType, item.entityId, 'visible');
      }
    } else if (item.type === 'encounter') {
      await api.startEncounter(item.encounterId);
      const combat = await api.startCombat();
      _combat = combat;
      _combatLoaded = true;
      _renderCombatOverlay(combat);
    }
    // Optioneel geluid bij deze reveal (speelt via de tablet; loop → ambiance).
    if (item.soundFileId) {
      api.revealSound({ fileId: item.soundFileId, label: item.soundLabel || '', loop: !!item.soundLoop }).catch(() => {});
    }
  } catch (err) {
    console.error('Regie-balk reveal failed', err);
  }
};

// ── Namen ──

const NAMEN_MAN = [
  'Anwar','Adonai','Aleksandre','Alerik','Andrias','Azad','Bovin','Boaz','Bjarte','Bruno',
  'Bernt','Borys','Caj','Caspar','Corin','Corné','Crispijn','Caleb','Darick','Dax',
  'Daïn','Déclan','Dorian','Duc','Edvin','Everhard','Egidius','Ewoud','Emre','Ezra',
  'Floris','Feliks','Florian','Friedrich','Fernando','Foppe','Gilles','Gerloff','Gydeon','Gérian',
  'Garbann','Geordi','Hindrik','Haico','Halewyn','Hessel','Heyn','Hamed','Illko','Ilaij',
  'Iggy','Ide','Ieper','Igo','Jaron','Joric','Jilles','Jeftha','Jent','Julyan',
  'Koa','Kéano','Krein','Kjalt','Koobe','Karelt','Lennaert','Lodewijck','Levv','Lucka',
  'Lénox','Liam','Mikäel','Miro','Magnuss','Maksymilian','Matz','Morits','Nathaniël','Nouwt',
  'Nikolas','Nadyr','Nils','Nox','Okke','Olievir','Oskar','Olav','Obel','Offelix',
  'Pepyn','Phillip','Pier','Pym','Paster','Pont','Quinten','Qais','Quillan','Qusai',
  'Querijn','Qean','Reinaut','Ralph','Reda','Romeo','Rohan','Raphael','Samuel','Stein',
  'Sébastian','Silas','Saul','Silvan','Timon','Tij','Tomas','Tobian','Tygo','Teo',
  'Ubaida','Uriel','Ulysse','Uzaan','Udo','Ulrich','Viktor','Valentein','Vincent','Vihan',
  'Vigo','Vivix','Wilhelm','Wolf','Wessel','Ward','Walter','Wiebe','Xander','Xavier',
  'Xeno','Xylian','Xristos','Xyan','Yves','Yosua','Youp','Yoran','Yoeri','Yvo',
  'Zacharias','Zeger','Zebb','Zeth','Zenno','Zeijn','Adam','Artur','Beer','Bastian',
  'Cristoffel','Cornelis','Dariusz','Denis','Edvard','Erik','Frederic','Frank','Gerardus','Gabriël',
  'Harman','Hubertus','Immanuël','Ivan','Jonas','Julius','Lars','Lukas','Manuel','Max',
  'Nicodemus','Natan','Otis','Oost','Petrus','Pjotr','Rinse','Rutcher','Sven','Sam',
  'Thalbin','Teunn','Valdemar','Vlas','Wynant','Wilvis','Anne','Ato','Bela','Broer',
];

const NAMEN_VROUW = [
  'Alyssa','Adriana','Alissia','Alma','Amira','Ava','Batelihem','Bianka','Bregt','Bauca',
  'Brenn','Bethile','Catoo','Chiara','Corinde','Calina','Celeste','Ciarian','Dalisha','Dilruz',
  'Danaë','Dilfuze','Dyjonna','Deza','Ester','Evie','Erna','Emmey','Euphemia','Elina',
  'Fyn','Fenne','Femmigje','Freyda','Flora','Fieke','Geke','Godelyve','Gabri','Gerdien',
  'Giraleth','Geah','Hyncke','Hanrah','Hermijn','Heidie','Hugorien','Houke','Izanne','Isamijn',
  'Ineau','Imme','Imelda','Isadore','Janna','Jolijn','Jyldou','Josja','Jhade','Juliët',
  'Kyana','Kazja','Kae','Kieki','Klarra','Kess','Lavynia','Livy','Linn','Loren',
  'Lux','Lisalot','Manon','Marte','Miralle','Marica','Mathilde','Madelinde','Noralie','Nell',
  'Néla','Nhaomi','Nilsa','Noctis','Olívia','Odette','Oxandra','Ozymandea','Orda','Ophelia',
  'Penélopé','Pukk','Philau','Pomme','Philinda','Pien','Quinn','Quirine','Qiqi','Qwen',
  'Quilla','Qea','Rita','Rebekka','Rhune','Romy','Ruth','Rana','Sofia','Sarah',
  'Stelle','Salomé','Sera','Selinda','Tara','Tirze','Tessel','Talina','Toska','Tea',
  'Ulrike','Ula','Udou','Uma','Uriëlle','Ulissa','Viktoria','Valérie','Vivienne','Vyolett',
  'Veere','Vesper','Wycke','Willeminke','Wilo','Wende','Welmoeth','Wiktoria','Xanthe','Ximena',
  'Xeni','Xziva','Xrista','Xyana','Yasmijn','Yfke','Ylvana','Ylse','Yvette','Yrsa',
  'Zora','Zonne','Zafira','Zhara','Zoë','Zarah','Amelia','Aurora','Belle','Benthilde',
  'Crista','Cornelia','Deborah','Do','Elif','Evelinde','Fleure','Filippa','Griet','Gabriëlle',
  'Hanne','Hoop','Ira','Ida','Joa','Juna','Luna','Larah','Marlijn','Martina',
  'Nohr','Nadine','Otisse','Ooste','Petra','Puk','Roos','Renske','Sandra','Saïre',
  'Thalia','Tooske','Veste','Vlasse','Winanda','Wilke','Anne','Arya','Beaune','Bolleke',
];

const NAMEN_ACHTERNAAM = [
  'Smidshamer','Molenaar','Timmerveen','Touwslager','Bakkerwijck','Brouwerslot','Zilveraar','Gildemaer',
  'Kaarsdraaier','Wijnschroef','Bontmakers','Vuurslager','Lichtvanger','Tiggelhouer','Kuiperbosch','Hoefsmit',
  'Zwaarddrager','Schaarwever','Vismanger','Leerlooier','van Amberwoud','Medewegheyk','Donderheijer',
  'Evermijnse','van Lhute','Maenfortuijn','van \'t Ravenbosch','Schemerzeeuw','Stormhavik','Wervelander',
  'Wraklandsmeer','Maensloot','Kalkwind','van Wrakstrand','van Everrust','Amberwijk','van Medewege',
  'Moorhave','Elzenrede','van Zonsdal','Vossenhoef','Wintergout','Drifthout','Hazeling','Stormvlag',
  'Maenvliet','Merenthout','IJsklauw','van Stormboei','Wolkenvang','Zilvervlinder','Goudvalk','Korenwint',
  'van Eikelgaart','Wolfwacht','van Zonneroos','Sterrenbosch','Spreeuwbeek','Lakerheide','Kanthorst',
  'Regenruiter','Smaragt','Zonnespeer','Sterrenwijck','Demsterwout','Wraklicht','Wervelvelder','Cruysvaer',
  'Valkernis','Nachtveen','IJzermist','Zilverburcht','Duisterhave','Sterretoor','Donderhelm','Stormheeste',
  'Kraakzwaard','Vlammeling','Schimvlug','Sneeuwhart','Bronsruiter','van Lichtval','Zoutgroeve',
  'Kwartelhout','Zonnewachter','Hamerhout','Waltvlug','Duiventil','Achtermaans','Rotsvast',
  'van Donkelburcht','van Straelweide','Klifwacht','Sluimerhoff','Stokzwaan','van Edelsee',
  'Goutschilt','Stroomvaert','van Hofflander','Gloedt',
];

// ── Weersgenerator ────────────────────────────────────────────────────────────

let _weerSeizoen = 'Lente';

function _weerSeason(btn) {
  _weerSeizoen = btn.dataset.season;
  document.querySelectorAll('.dm-weer-season-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

const _WEER = {
  Lente: {
    temp:   [[25,'Vriezend (-5°C)'], [50,'Koud (3°C)'], [80,'Fris (10°C)'], [100,'Mild (16°C)']],
    neersl: [[40,'Geen'], [60,'Motregen'], [80,'Regen'], [95,'Stortregen'], [100,'Hagel']],
    wind:   [[50,'Windstil'], [80,'Bries'], [95,'Matige wind'], [100,'Stormachtig']],
  },
  Zomer: {
    temp:   [[10,'Fris (14°C)'], [30,'Mild (19°C)'], [65,'Warm (25°C)'], [90,'Heet (30°C)'], [100,'Snikheet (36°C)']],
    neersl: [[60,'Geen'], [75,'Lichte bui'], [90,'Onweersbui'], [100,'Stortregen']],
    wind:   [[60,'Windstil'], [85,'Bries'], [97,'Matige wind'], [100,'Stormachtig']],
  },
  Herfst: {
    temp:   [[20,'Vriezend (-2°C)'], [50,'Koud (5°C)'], [80,'Fris (11°C)'], [100,'Mild (16°C)']],
    neersl: [[30,'Geen'], [55,'Motregen'], [75,'Regen'], [90,'Stortregen'], [100,'Hagel']],
    wind:   [[35,'Windstil'], [65,'Bries'], [88,'Matige wind'], [100,'Stormachtig']],
  },
  Winter: {
    temp:   [[40,'Vriezend (-8°C)'], [70,'IJskoud (-2°C)'], [90,'Koud (2°C)'], [100,'Fris (7°C)']],
    neersl: [[35,'Geen'], [55,'Sneeuw'], [75,'Zware sneeuwval'], [90,'IJzel'], [100,'Blizzard']],
    wind:   [[25,'Windstil'], [55,'Bries'], [80,'Matige wind'], [100,'Stormachtig']],
  },
};

const _WEER_BIJZONDER = ['Dichte mist', 'Regenboog', 'Hevige onweersbui ⚡', 'IJzel', 'Hittegolf 🌡', 'Hagelbui', 'Zandstorm', 'Vlokkensneeuw ❄️'];

function _weerRoll(tabel) {
  const d = Math.floor(Math.random() * 100) + 1;
  for (const [grens, label] of tabel) {
    if (d <= grens) return label;
  }
  return tabel[tabel.length - 1][1];
};

function _weerGenereer() {
  const s = _WEER[_weerSeizoen];
  const temp   = _weerRoll(s.temp);
  const neersl = _weerRoll(s.neersl);
  const wind   = _weerRoll(s.wind);
  const bijz   = Math.random() < 0.1
    ? ' — ✨ ' + _WEER_BIJZONDER[Math.floor(Math.random() * _WEER_BIJZONDER.length)]
    : '';
  const result = `🌡 ${temp} &nbsp;·&nbsp; 💧 ${neersl} &nbsp;·&nbsp; 🌬 ${wind}${bijz}`;
  const el = document.getElementById('dm-weer-result');
  if (el) { el.innerHTML = result; el.classList.remove('hidden'); }
};

// ── Naamgenerator ─────────────────────────────────────────────────────────────

function _naamGenereer(geslacht) {
  const lijst = geslacht === 'm' ? NAMEN_MAN : NAMEN_VROUW;
  const voornaam = lijst[Math.floor(Math.random() * lijst.length)];
  const achternaam = NAMEN_ACHTERNAAM[Math.floor(Math.random() * NAMEN_ACHTERNAAM.length)];
  const el = document.getElementById('dm-naam-result');
  if (el) {
    el.className = 'dm-naam-result';
    void el.offsetWidth;
    el.className = 'dm-naam-result dm-naam-reveal';
    el.innerHTML = `${voornaam}<span class="dm-naam-achter"> ${achternaam}</span>`;
  }
};

// ── Tafels ──

async function _loadAndRenderTafels() {
  try {
    _tables = await api.listTables();
  } catch { _tables = []; }
  _renderTafels();
};

function _renderTafels() {
  const el = document.getElementById('dm-tafels-content');
  if (!el) return;
  if (_editingTableId !== null) { _renderTafelEditor(el); return; }

  const sortedTables = [..._tables].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
  const hasTables = sortedTables.length > 0;
  el.innerHTML = `
    <div class="dm-feature-section dm-namen-section">
      <div class="dm-section-label">Namen</div>
      <div class="dm-feature-row">
        <button class="dm-btn dm-btn-ghost dm-naam-btn" onclick="window.dmPanel.naamGenereer('m')" title="Mannennaam">♂</button>
        <button class="dm-btn dm-btn-ghost dm-naam-btn" onclick="window.dmPanel.naamGenereer('v')" title="Vrouwennaam">♀</button>
      </div>
      <div id="dm-naam-result" class="dm-naam-result"></div>
    </div>
    <div class="dm-feature-section">
      <div class="dm-section-label">Weer</div>
      <div class="dm-feature-row">
        <div class="dm-weer-seasons" id="dm-weer-seasons">
          ${['Lente','Zomer','Herfst','Winter'].map((s,i) =>
            `<button class="dm-btn dm-btn-sm dm-weer-season-btn${i===0?' active':''}" data-season="${s}"
               title="${s}" onclick="window.dmPanel.weerSeason(this)">${['🌸','☀️','🍂','❄️'][i]}</button>`).join('')}
        </div>
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.weerGenereer()" title="Genereer weer">${icon('dice',{cls:'icon-gi'})}</button>
      </div>
      <div id="dm-weer-result" class="dm-tabel-result hidden"></div>
    </div>
    <div class="dm-feature-section">
      <div class="dm-section-label">Tabellen</div>
      ${hasTables ? `
        <div class="dm-feature-row">
          <select id="dm-tabel-select" class="dm-select" onchange="window.dmPanel.tabelSelect(this.value)">
            ${sortedTables.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}
          </select>
          <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelRoll()" title="Gooien">${icon('dice',{cls:'icon-gi'})}</button>
        </div>
        <div id="dm-tabel-result" class="dm-tabel-result hidden"></div>
        <div class="dm-feature-row dm-feature-row-sm">
          <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.tabelEdit(document.getElementById('dm-tabel-select').value)" title="Bewerken">${icon('pencil')}</button>
          <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.tabelDelete(document.getElementById('dm-tabel-select').value)" title="Verwijderen">${icon('x')}</button>
          <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.tabelNew()" style="margin-left:auto" title="Nieuwe tafel">+</button>
        </div>
      ` : `
        <p class="dm-hint">Nog geen tabellen aangemaakt.</p>
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelNew()" title="Nieuwe tafel">+</button>
      `}
    </div>
  `;

};

function _renderTafelEditor(el) {
  const isNew = _editingTableId === '__new__';
  const table = isNew ? { name: '', type: _editingTableType, entries: [], first: [], last: [] }
                      : _tables.find(t => t.id === _editingTableId) || { name: '', type: 'simple', entries: [] };
  // When first opening editor, set _editingTableType from existing table
  if (!isNew && _editingTableType !== table.type) { /* preserve current user selection */ }
  const isCombined = _editingTableType === 'combined';
  // _editingTableType is leading (set via tabelTypeChange or tabelEdit)
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-form-row">
        <label class="dm-form-label">Name</label>
        <input id="dm-tbl-name" class="dm-input" value="${esc(table.name)}" placeholder="Table name…">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Type</label>
        <select id="dm-tbl-type" class="dm-select" onchange="window.dmPanel.tabelTypeChange(this.value)">
          <option value="simple"   ${_editingTableType === 'simple'   ? 'selected' : ''}>Simple table</option>
          <option value="weighted" ${_editingTableType === 'weighted' ? 'selected' : ''}>d100 bereiken</option>
          <option value="combined" ${_editingTableType === 'combined' ? 'selected' : ''}>Name generator (2×d100)</option>
        </select>
      </div>
      ${isCombined ? `
        <div class="dm-form-row">
          <label class="dm-form-label">First names (one per line)</label>
          <textarea id="dm-tbl-first" class="dm-textarea" rows="5">${(table.first || []).join('\n')}</textarea>
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Last names (one per line)</label>
          <textarea id="dm-tbl-last" class="dm-textarea" rows="5">${(table.last || []).join('\n')}</textarea>
        </div>
      ` : _editingTableType === 'weighted' ? `
        <div class="dm-form-row">
          <label class="dm-form-label">Bereiken (formaat: 1-35: tekst, één per regel)</label>
          <textarea id="dm-tbl-entries" class="dm-textarea" rows="10">${(table.entries || []).join('\n')}</textarea>
        </div>
      ` : `
        <div class="dm-form-row">
          <label class="dm-form-label">Options (one per line)</label>
          <textarea id="dm-tbl-entries" class="dm-textarea" rows="8">${(table.entries || []).join('\n')}</textarea>
        </div>
      `}
      <div class="dm-feature-row" style="margin-top:8px">
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelSave('${isNew ? '__new__' : esc(_editingTableId)}')" title="Opslaan">✓</button>
        <button class="dm-btn dm-btn-ghost" onclick="window.dmPanel.tabelCancel()" title="Annuleren">${icon('x')}</button>
      </div>
    </div>
  `;
};

function _renderTafelResult(results) {
  const el = document.getElementById('dm-tabel-result');
  if (!el) return;
  if (results === null) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  const items = Array.isArray(results) ? results : [results];
  el.innerHTML = items.map((r, i) =>
    `<span class="dm-tabel-result-text">${items.length > 1 ? `<span class="dm-tabel-num">${i + 1}.</span> ` : ''}${esc(r)}</span>`
  ).join('');
};

function _tabelRoll() {
  const sel = document.getElementById('dm-tabel-select');
  if (!sel) return;
  const table = _tables.find(t => t.id === sel.value);
  if (!table) return;
  const rolls = table.rolls || 1;

  if (table.type === 'combined') {
    const results = [];
    for (let i = 0; i < rolls; i++) {
      const first = (table.first || []).length > 0
        ? table.first[Math.floor(Math.random() * table.first.length)] : '?';
      const last = (table.last || []).length > 0
        ? table.last[Math.floor(Math.random() * table.last.length)] : '?';
      results.push(`${first} ${last}`);
    }
    _renderTafelResult(results);
  } else if (table.type === 'weighted') {
    // Elke entry heeft formaat "van-tot: tekst", gooi d100 en zoek overeenkomst
    const entries = table.entries || [];
    if (entries.length === 0) { _renderTafelResult('Tafel is leeg'); return; }
    const d100 = Math.floor(Math.random() * 100) + 1;
    let match = null;
    for (const entry of entries) {
      const m = entry.match(/^(\d+)[-–](\d+):\s*(.+)$/);
      if (m) {
        const from = parseInt(m[1]), to = parseInt(m[2]);
        if (d100 >= from && d100 <= to) { match = m[3].trim(); break; }
      }
    }
    _renderTafelResult(match ? `d100: ${d100} → ${match}` : `d100: ${d100} → (geen treffer)`);
  } else {
    const entries = table.entries || [];
    if (entries.length === 0) { _renderTafelResult('Tafel is leeg'); return; }
    // Pick unique results (shuffle-style)
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    _renderTafelResult(shuffled.slice(0, Math.min(rolls, entries.length)));
  }
};

function _tabelEdit(id) {
  _editingTableId = id;
  const table = _tables.find(t => t.id === id);
  _editingTableType = table?.type || 'simple';
  _renderTafels();
};

async function _tabelDelete(id) {
  const table = _tables.find(t => t.id === id);
  if (!table) return;
  if (!confirm(`Tafel "${table.name}" verwijderen?`)) return;
  try {
    await api.deleteTable(id);
    _tables = _tables.filter(t => t.id !== id);
    _renderTafels();
  } catch (e) { alert('Fout: ' + e.message); }
};

async function _tabelSave(idOrNew) {
  const name    = document.getElementById('dm-tbl-name')?.value.trim();
  const type    = document.getElementById('dm-tbl-type')?.value || 'simple';
  const isComb  = type === 'combined';
  const entries = isComb ? [] : (document.getElementById('dm-tbl-entries')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const first   = isComb ? (document.getElementById('dm-tbl-first')?.value  || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
  const last    = isComb ? (document.getElementById('dm-tbl-last')?.value   || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
  if (!name) { alert('Voer een naam in.'); return; }
  const data = { name, type, entries, first, last };
  try {
    if (idOrNew === '__new__') {
      const t = await api.createTable(data);
      _tables.push(t);
    } else {
      const t = await api.updateTable(idOrNew, data);
      const idx = _tables.findIndex(x => x.id === idOrNew);
      if (idx !== -1) _tables[idx] = t;
    }
    _editingTableId = null;
    _renderTafels();
  } catch (e) { alert('Fout: ' + e.message); }
};

function _tabelNew() {
  _editingTableId = '__new__';
  _editingTableType = 'simple';
  _renderTafels();
};

// ── Monsters ──

// Statblock helpers
function _sbMod(score) {
  const m = Math.floor(((score || 10) - 10) / 2);
  return (m >= 0 ? '+' : '') + m;
};

function _sbMdLine(text) {
  return (text || '').replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
};

function _sbMdBlock(text) {
  return (text || '').split('\n').filter(l => l.trim())
    .map(l => `<p class="sb-p">${_sbMdLine(esc(l))}</p>`).join('');
};

function _hasStatblock(m) {
  if (!m?.statblock) return false;
  const sb = m.statblock;
  return !!(sb.type || sb.ac || sb.hp || sb.traits || sb.actions ||
    sb.str || sb.dex || sb.con || sb.int || sb.wis || sb.cha);
};

// Delegeert naar de gedeelde getierde render (feature #3). DM ziet altijd alles.
function _statblockHtml(m) {
  return renderStatblock(m, { niveau: 'volledig' });
};

function _showStatblock(mId) {
  const m = _monsters.find(x => x.id === mId);
  if (!m) return;
  const sb = m.statblock || {};
  const subtitle = [sb.size, sb.type, sb.alignment].filter(Boolean).join(' ');
  window.app.openModal(m.name, subtitle, _statblockHtml(m));
};

function _showStatblockForCombatant(cId) {
  const c = _combat?.combatants?.find(x => x.id === cId);
  if (!c) return;
  const preset = c.presetId ? _monsters.find(x => x.id === c.presetId) : null;
  const m = preset || { name: c.name, maxHp: c.maxHp, statblock: c.statblock };
  const sb = m.statblock || {};
  const subtitle = [sb.size, sb.type, sb.alignment].filter(Boolean).join(' ');
  window.app.openModal(m.name, subtitle, _statblockHtml(m));
};

function _statblockEditorHtml(sb) {
  sb = sb || {};
  const opt = (val, label) => `<option value="${esc(val)}"${sb.size === val ? ' selected' : ''}>${label}</option>`;
  const v = (k, placeholder, type='text') => `<input id="dm-mon-sb-${k}" class="dm-input dm-input-sm" type="${type}" value="${esc(sb[k] ?? '')}" placeholder="${placeholder}">`;
  const ta = (k, placeholder) => `<textarea id="dm-mon-sb-${k}" class="dm-input dm-sb-textarea" placeholder="${placeholder}">${esc(sb[k] || '')}</textarea>`;
  return `
    <details class="dm-sb-editor" open>
      <summary class="dm-sb-summary">${icon('clipboard-list')} Statblock</summary>
      <div class="dm-sb-fields">
        <div class="dm-feature-row" style="gap:6px;flex-wrap:wrap">
          <div style="flex:1;min-width:80px">
            <label class="dm-form-label">Size</label>
            <select id="dm-mon-sb-size" class="dm-select dm-select-sm" style="width:100%">
              <option value="">—</option>
              ${['Tiny','Small','Medium','Large','Huge','Gargantuan'].map(s => opt(s,s)).join('')}
            </select>
          </div>
          <div style="flex:2;min-width:100px">
            <label class="dm-form-label">Type</label>
            ${v('type','beast, undead…')}
          </div>
          <div style="flex:2;min-width:100px">
            <label class="dm-form-label">Alignment</label>
            ${v('alignment','unaligned')}
          </div>
        </div>
        <div class="dm-feature-row" style="gap:6px">
          <div style="flex:1">
            <label class="dm-form-label">AC</label>
            ${v('ac','13')}
          </div>
          <div style="flex:2">
            <label class="dm-form-label">HP formula</label>
            ${v('hp','2d8+2')}
          </div>
          <div style="flex:2">
            <label class="dm-form-label">Speed</label>
            ${v('speed','40 ft.')}
          </div>
        </div>
        <div class="dm-sb-scores-grid">
          ${['str','dex','con','int','wis','cha'].map(attr => `
            <div class="dm-sb-score-col">
              <label class="dm-form-label" style="text-align:center">${attr.toUpperCase()}</label>
              <input id="dm-mon-sb-${attr}" class="dm-input dm-input-sm" type="number" min="1" max="30" value="${sb[attr] ?? 10}" style="text-align:center">
              <div class="dm-sb-mod">${_sbMod(sb[attr] ?? 10)}</div>
            </div>`).join('')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Saving Throws</label>
          ${v('savingThrows','Wis +3, Cha +1')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Skills</label>
          ${v('skills','Perception +3, Stealth +4')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Damage Vulnerabilities</label>
          ${v('damageVulnerabilities','fire')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Damage Resistances</label>
          ${v('damageResistances','bludgeoning')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Damage Immunities</label>
          ${v('damageImmunities','poison, fire')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Condition Immunities</label>
          ${v('conditionImmunities','charmed, frightened')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Senses</label>
          ${v('senses','darkvision 60 ft., passive Perception 13')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Languages</label>
          ${v('languages','Common, Elvish')}
        </div>
        <div class="dm-feature-row" style="gap:6px">
          <div style="flex:1">
            <label class="dm-form-label">CR</label>
            ${v('cr','1/4')}
          </div>
          <div style="flex:1">
            <label class="dm-form-label">XP</label>
            <input id="dm-mon-sb-xp" class="dm-input dm-input-sm" type="number" value="${sb.xp || ''}" placeholder="50">
          </div>
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Traits</label>
          ${ta('traits','***Pack Tactics.*** …')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Actions</label>
          ${ta('actions','***Bite.*** *Melee Weapon Attack:* …')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Reactions</label>
          ${ta('reactions','')}
        </div>
        <div class="dm-form-row">
          <label class="dm-form-label">Legendary Actions</label>
          ${ta('legendaryActions','')}
        </div>
      </div>
    </details>`;
};

function _readStatblockFromForm() {
  const v = k => document.getElementById('dm-mon-sb-' + k)?.value?.trim() || '';
  const n = k => parseInt(document.getElementById('dm-mon-sb-' + k)?.value) || 10;
  return {
    size:                  v('size'),
    type:                  v('type'),
    alignment:             v('alignment'),
    ac:                    v('ac'),
    hp:                    v('hp'),
    speed:                 v('speed'),
    str:                   n('str'),
    dex:                   n('dex'),
    con:                   n('con'),
    int:                   n('int'),
    wis:                   n('wis'),
    cha:                   n('cha'),
    savingThrows:          v('savingThrows'),
    skills:                v('skills'),
    damageVulnerabilities: v('damageVulnerabilities'),
    damageResistances:     v('damageResistances'),
    damageImmunities:      v('damageImmunities'),
    conditionImmunities:   v('conditionImmunities'),
    senses:                v('senses'),
    languages:             v('languages'),
    cr:                    v('cr'),
    xp:                    parseInt(document.getElementById('dm-mon-sb-xp')?.value) || 0,
    traits:                v('traits'),
    actions:               v('actions'),
    reactions:             v('reactions'),
    legendaryActions:      v('legendaryActions'),
  };
};

async function _loadAndRenderMonsters() {
  try {
    const data = await api.listMonsters();
    _monsters = (data.monsters || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nl'));
  } catch (e) {
    _monsters = [];
  }
  _renderMonsters();
};

function _monsterRow(m) {
  return `
    <div class="dm-monster-row">
      ${m.imageId
        ? `<img class="dm-monster-thumb" src="${api.fileUrl(m.imageId)}" alt="">`
        : `<div class="dm-monster-thumb dm-monster-thumb-empty">👾</div>`}
      <div class="dm-monster-info">
        <span class="dm-monster-name">${esc(m.name)}</span>
        <span class="dm-monster-meta">HP ${m.maxHp} · Init ${m.initiative}</span>
      </div>
      <div class="dm-monster-actions">
        <button class="dm-btn dm-btn-sm dm-btn-primary" onclick="window.dmPanel.monsterAddToCombat('${esc(m.id)}')" title="Toevoegen aan gevecht">${icon('swords')}</button>
        ${_hasStatblock(m) ? `<button class="dm-btn dm-btn-sm" onclick="window.dmPanel.monsterStatblock('${esc(m.id)}')" title="Statblock bekijken">${icon('clipboard-list')}</button>` : ''}
        <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.monsterEdit('${esc(m.id)}')" title="Bewerken">${icon('pencil')}</button>
        <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterDelete('${esc(m.id)}')" title="Verwijderen">${icon('x')}</button>
      </div>
    </div>`;
};

function _metaHk() {
  return window.app?.state?.meta?.hoofdstukken || {};
};

function _hkLabel(key) {
  const hk = _metaHk();
  return hk[key] ? hk[key].short : key;
};

function _hkOptions(selectedKey) {
  const hk = _metaHk();
  return Object.entries(hk)
    .sort(([, a], [, b]) => a.num - b.num)
    .map(([k, v]) => `<option value="${esc(k)}"${selectedKey === k ? ' selected' : ''}>${esc(v.short)}</option>`)
    .join('');
};

const MONSTER_PAGE_SIZE = 5;

function _renderMonsters() {
  const el = document.getElementById('dm-monsters-content');
  if (!el) return;
  if (_editingMonsterId !== null) { _renderMonsterEditor(el); return; }

  const hk = _metaHk();
  const usedKeys = [...new Set(_monsters.map(m => m.chapter || '').filter(Boolean))]
    .sort((a, b) => (hk[a]?.num ?? 99) - (hk[b]?.num ?? 99));

  // Filter + sort alphabetically
  const filtered = (_monsterChapterFilter
    ? _monsters.filter(m => (m.chapter || '') === _monsterChapterFilter)
    : _monsters.slice()
  ).sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const totalPages = Math.max(1, Math.ceil(filtered.length / MONSTER_PAGE_SIZE));
  if (_monsterPage >= totalPages) _monsterPage = totalPages - 1;
  if (_monsterPage < 0) _monsterPage = 0;

  const pageItems = filtered.slice(_monsterPage * MONSTER_PAGE_SIZE, (_monsterPage + 1) * MONSTER_PAGE_SIZE);

  let listHtml;
  if (_monsters.length === 0) {
    listHtml = `<p class="dm-hint">Nog geen monsters. Voeg er een toe met +.</p>`;
  } else if (filtered.length === 0) {
    listHtml = `<p class="dm-hint">Geen monsters in dit hoofdstuk.</p>`;
  } else {
    listHtml = `<div class="dm-monster-list">${pageItems.map(_monsterRow).join('')}</div>`;
  }

  const paginationHtml = totalPages > 1 ? `
    <div class="dm-monster-pagination">
      <button class="dm-btn dm-btn-sm dm-btn-ghost" ${_monsterPage === 0 ? 'disabled' : ''}
        onclick="window.dmPanel.monsterPage(${_monsterPage - 1})">←</button>
      <span class="dm-monster-page-info">${_monsterPage + 1} / ${totalPages}</span>
      <button class="dm-btn dm-btn-sm dm-btn-ghost" ${_monsterPage >= totalPages - 1 ? 'disabled' : ''}
        onclick="window.dmPanel.monsterPage(${_monsterPage + 1})">→</button>
    </div>` : '';

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row">
        <select class="dm-select dm-select-sm" style="flex:1" onchange="window.dmPanel.monsterFilterChapter(this.value)">
          <option value="">Alle hoofdstukken</option>
          ${usedKeys.map(k => `<option value="${esc(k)}"${_monsterChapterFilter === k ? ' selected' : ''}>${esc(_hkLabel(k))}</option>`).join('')}
        </select>
        <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.monsterNew()" title="Nieuw monster">+</button>
      </div>
      ${listHtml}
      ${paginationHtml}
    </div>
  `;
};

function _renderMonsterEditor(el) {
  const isNew  = _editingMonsterIsNew;
  const stored = _monsters.find(m => m.id === _editingMonsterId) || {};
  const m = {
    id:         _editingMonsterId,
    name:       stored.name        || '',
    chapter:    stored.chapter     || _monsterChapterFilter || '',
    maxHp:      stored.maxHp       ?? 10,
    initiative: stored.initiative  ?? 10,
    imageId:    _editingMonsterImageId,
    statblock:  stored.statblock   || null,
    inBestiarium: stored.inBestiarium !== false,
    description: stored.description || '',
    roddel: stored.roddel || '',
  };

  el.innerHTML = `
    <div class="dm-feature-section">
      <details class="dm-srd-import-panel" id="dm-srd-panel">
        <summary class="dm-srd-summary">🔍 SRD importeren</summary>
        <div class="dm-srd-search-row">
          <input id="dm-srd-q" class="dm-input dm-input-sm" placeholder="Zoek monster…"
            onkeydown="if(event.key==='Enter')window.dmPanel.srdSearch()">
          <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.srdSearch()" title="Zoeken">🔍</button>
        </div>
        <div id="dm-srd-results" class="dm-srd-results"></div>
      </details>
      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="dm-mon-name" class="dm-input" value="${esc(m.name)}" placeholder="Monsternaam…">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Akte</label>
        <select id="dm-mon-chapter" class="dm-select dm-select-sm">
          <option value="">— geen akte —</option>
          ${_hkOptions(m.chapter)}
        </select>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-checkbox" title="Verschijnt dit wezen als kaart in het Bestiarium? Zet uit voor personages/NPC's die je alleen voor de strijd toevoegt.">
          <input type="checkbox" id="dm-mon-inbest"${m.inBestiarium ? ' checked' : ''}>
          <span>Toon in Bestiarium</span>
        </label>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Beschrijving</label>
        <textarea id="dm-mon-desc" class="dm-input dm-sb-textarea" rows="3"
          placeholder="Korte beschrijving / lore — zichtbaar op de bestiariumkaart en bovenaan het statblock.">${esc(m.description || '')}</textarea>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Roddel</label>
        <textarea id="dm-mon-roddel" class="dm-input dm-sb-textarea" rows="2"
          placeholder="Een gerucht/observatie die de Magizoöloog onthult bij onderzoek (op Deels-niveau).">${esc(m.roddel || '')}</textarea>
      </div>
      <div class="dm-feature-row">
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Max HP</label>
          <input id="dm-mon-hp" class="dm-input dm-input-sm" type="number" value="${m.maxHp}" min="1">
        </div>
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Initiative</label>
          <input id="dm-mon-init" class="dm-input dm-input-sm" type="number" value="${m.initiative}">
        </div>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Portret</label>
        <div class="dm-upload-row">
          ${m.imageId
            ? `<img class="dm-mon-preview" src="${api.fileUrl(m.imageId)}" alt="">`
            : `<div class="dm-mon-preview dm-mon-preview-empty">👾</div>`}
          <label class="dm-btn dm-btn-sm dm-upload-label" title="Afbeelding uploaden">
            ⬆
            <input type="file" accept="image/*" style="display:none"
              onchange="window.dmPanel.monsterUpload('${m.id}', 'image', this)">
          </label>
          ${m.imageId ? `<button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterRemoveImage('image')" title="Verwijderen">${icon('x')}</button>` : ''}
        </div>
      </div>
      ${_statblockEditorHtml(m.statblock)}
      <div class="dm-feature-row" style="margin-top:4px">
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.monsterSave()" title="Opslaan">${icon('save')}</button>
        <button class="dm-btn dm-btn-ghost"   onclick="window.dmPanel.monsterCancel()" title="Annuleren">${icon('x')}</button>
      </div>
    </div>
  `;
};

function _monsterNew() {
  _editingMonsterId        = 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  _editingMonsterIsNew     = true;
  _editingMonsterImageId   = null;
  _renderMonsters();
};

function _monsterEdit(id) {
  const m = _monsters.find(x => x.id === id);
  if (!m) return;
  _editingMonsterId        = id;
  _editingMonsterIsNew     = false;
  _editingMonsterImageId   = m.imageId   || null;
  _renderMonsters();
};

function _monsterFilterChapter(chapter) {
  _monsterChapterFilter = chapter;
  _monsterPage = 0;
  _renderMonsters();
};

function _monsterPage_set(page) {
  _monsterPage = page;
  _renderMonsters();
};

function _monsterCancel() {
  _editingMonsterId = null;
  _editingMonsterIsNew = false;
  _renderMonsters();
};

async function _srdSearch() {
  const q = document.getElementById('dm-srd-q')?.value.trim();
  if (!q) return;
  const resultsEl = document.getElementById('dm-srd-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="dm-hint">Zoeken…</div>';
  try {
    const { results } = await api.srdSearchMonsters(q);
    if (!resultsEl) return;
    if (!results.length) { resultsEl.innerHTML = '<div class="dm-hint">Geen resultaten.</div>'; return; }
    resultsEl.innerHTML = results.map(m =>
      `<button class="dm-srd-result-btn" onclick="window.dmPanel.srdImport('${esc(m.index)}')">${esc(m.name)}</button>`
    ).join('');
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<div class="dm-hint" style="color:#c44">Fout: ${esc(err.message)}</div>`;
  }
};

async function _srdImport(index) {
  const resultsEl = document.getElementById('dm-srd-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="dm-hint">Importeren…</div>';
  try {
    const m = await api.srdGetMonster(index);
    const nameEl = document.getElementById('dm-mon-name');
    const hpEl   = document.getElementById('dm-mon-hp');
    const initEl = document.getElementById('dm-mon-init');
    if (nameEl) nameEl.value = m.name;
    if (hpEl)   hpEl.value   = m.maxHp;
    if (initEl) initEl.value = m.initiative;
    const sbPanel = document.querySelector('.dm-sb-editor');
    if (sbPanel) sbPanel.open = true;
    const sb = m.statblock || {};
    const v = (k, val) => { const el = document.getElementById('dm-mon-sb-' + k); if (el) el.value = val ?? ''; };
    v('size',                  sb.size);
    v('type',                  sb.type);
    v('alignment',             sb.alignment);
    v('ac',                    sb.ac);
    v('hp',                    sb.hp);
    v('speed',                 sb.speed);
    v('str',                   sb.str);
    v('dex',                   sb.dex);
    v('con',                   sb.con);
    v('int',                   sb.int);
    v('wis',                   sb.wis);
    v('cha',                   sb.cha);
    v('savingThrows',          sb.savingThrows);
    v('skills',                sb.skills);
    v('damageVulnerabilities', sb.damageVulnerabilities);
    v('damageResistances',     sb.damageResistances);
    v('damageImmunities',      sb.damageImmunities);
    v('conditionImmunities',   sb.conditionImmunities);
    v('senses',                sb.senses);
    v('languages',             sb.languages);
    v('cr',                    sb.cr);
    const xpEl = document.getElementById('dm-mon-sb-xp');
    if (xpEl) xpEl.value = sb.xp || '';
    v('traits',           sb.traits);
    v('actions',          sb.actions);
    v('reactions',        sb.reactions);
    v('legendaryActions', sb.legendaryActions);
    document.querySelectorAll('.dm-sb-score-col').forEach(col => {
      const input = col.querySelector('input');
      const modEl = col.querySelector('.dm-sb-mod');
      if (input && modEl) {
        const score = parseInt(input.value) || 10;
        const mod = Math.floor((score - 10) / 2);
        modEl.textContent = (mod >= 0 ? '+' : '') + mod;
      }
    });
    if (resultsEl) resultsEl.innerHTML = `<div class="dm-hint" style="color:#4a7">✓ ${esc(m.name)} geïmporteerd</div>`;
    const panel = document.getElementById('dm-srd-panel');
    if (panel) panel.open = false;
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = `<div class="dm-hint" style="color:#c44">Fout: ${esc(err.message)}</div>`;
  }
};

async function _monsterSave() {
  const name    = document.getElementById('dm-mon-name')?.value.trim();
  const chapter = document.getElementById('dm-mon-chapter')?.value.trim() || '';
  const maxHp   = parseInt(document.getElementById('dm-mon-hp')?.value)   || 10;
  const init    = parseInt(document.getElementById('dm-mon-init')?.value) || 10;
  if (!name) { alert('Voer een naam in.'); return; }
  const statblock = _readStatblockFromForm();
  const inBestiarium = document.getElementById('dm-mon-inbest')?.checked !== false;
  const description = document.getElementById('dm-mon-desc')?.value?.trim() || '';
  const roddel = document.getElementById('dm-mon-roddel')?.value?.trim() || '';
  const payload = { name, chapter, maxHp, initiative: init, imageId: _editingMonsterImageId, statblock, inBestiarium, description, roddel };
  try {
    if (_editingMonsterIsNew) {
      const created = await api.createMonster({ id: _editingMonsterId, ...payload });
      _monsters.push(created);
    } else {
      const updated = await api.updateMonster(_editingMonsterId, payload);
      const idx = _monsters.findIndex(m => m.id === _editingMonsterId);
      if (idx !== -1) _monsters[idx] = updated;
    }
    _editingMonsterId = null;
    _editingMonsterIsNew = false;
    _renderMonsters();
  } catch (e) { alert('Opslaan mislukt: ' + e.message); }
};

async function _monsterDelete(id) {
  const m = _monsters.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Delete "${m.name}"?`)) return;
  try {
    await api.deleteMonster(id);
    if (m.imageId)    api.deleteFile(m.imageId).catch(() => {});
    if (m.backdropId) api.deleteFile(m.backdropId).catch(() => {});
    _monsters = _monsters.filter(x => x.id !== id);
    _renderMonsters();
  } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
};

async function _monsterUpload(monsterId, type, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const fileId = `${monsterId}_img`;
  try {
    await api.uploadFile(fileId, file);
    _editingMonsterImageId = fileId;
    // For existing monsters, persist immediately
    if (!_editingMonsterIsNew) {
      const updated = await api.updateMonster(monsterId, { imageId: fileId });
      const idx = _monsters.findIndex(m => m.id === monsterId);
      if (idx !== -1) _monsters[idx] = updated;
    }
    _redrawMonsterImageRow(fileId);
  } catch (e) { alert('Upload mislukt: ' + e.message); }
};

async function _monsterRemoveImage() {
  const fileId = _editingMonsterImageId;
  if (fileId) api.deleteFile(fileId).catch(() => {});
  _editingMonsterImageId = null;
  if (!_editingMonsterIsNew) {
    try {
      const updated = await api.updateMonster(_editingMonsterId, { imageId: null });
      const idx = _monsters.findIndex(m => m.id === _editingMonsterId);
      if (idx !== -1) _monsters[idx] = updated;
    } catch (_) {}
  }
  _redrawMonsterImageRow(null);
};

function _redrawMonsterImageRow(fileId) {
  const row = document.querySelector('.dm-upload-row');
  if (!row) return;
  const id = _editingMonsterId;
  row.innerHTML = `
    ${fileId
      ? `<img class="dm-mon-preview" src="${api.fileUrl(fileId)}" alt="">`
      : `<div class="dm-mon-preview dm-mon-preview-empty">👾</div>`}
    <label class="dm-btn dm-btn-sm dm-upload-label" title="Afbeelding uploaden">
      ⬆
      <input type="file" accept="image/*" style="display:none"
        onchange="window.dmPanel.monsterUpload('${id}', 'image', this)">
    </label>
    ${fileId ? `<button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterRemoveImage('image')" title="Verwijderen">${icon('x')}</button>` : ''}
  `;
};

async function _monsterAddToCombat(id) {
  const m = _monsters.find(x => x.id === id);
  if (!m) return;
  try {
    await api.addCombatant({
      name:       m.name,
      type:       'monster',
      initiative: m.initiative,
      hp:         m.maxHp,
      maxHp:      m.maxHp,
      imageId:    m.imageId    || null,
      presetId:   m.id,
    });
    _switchTab('gevecht');
  } catch (e) { alert('Toevoegen aan gevecht mislukt: ' + e.message); }
};

// ── Encounters ──────────────────────────────────────────────────────────────

let _encounters         = [];
let _encLoaded          = false;
let _editingEncId       = null;   // null = list, 'new' = new, string = edit existing
let _encIsNew           = false;
let _encMonsterRows     = [];     // [{monsterId,name,count,initiative,hp}]
let _encBackdropId      = null;
let _encCanvasPreset    = null;   // id van het gekozen canvas-kleurpreset
let _encName            = '';     // formulier-state: bewaart naam tussen re-renders
let _encAkteId          = '';     // formulier-state: bewaart akte-keuze tussen re-renders

// Canvas-kleurpresets: [r,g,b] voor spelerskant en monsterkant
// Opacities zijn hardcoded in combat-canvas.js (max 0.16) — hetzelfde voor alle presets,
// zodat tekst en HP-bars altijd leesbaar blijven.
const CANVAS_PRESETS = [
  { id: 'default', iconName: 'swords',    label: 'Standaard', player: [ 50,  90, 180], monster: [160,  40,  30] },
  { id: 'forest',  iconName: 'tree-pine', label: 'Bos',        player: [ 30, 110,  50], monster: [ 90,  55,  20] },
  { id: 'city',    iconName: 'building',  label: 'Stad',       player: [ 70,  80, 110], monster: [ 90,  70,  60] },
  { id: 'sea',     iconName: 'globe',     label: 'Zee',        player: [ 20,  70, 170], monster: [ 30, 100, 110] },
  { id: 'cave',    iconName: 'mountain',  label: 'Grot',       player: [ 80,  50, 120], monster: [ 90,  50,  30] },
  { id: 'desert',  iconName: 'map',       label: 'Woestijn',   player: [170, 130,  40], monster: [150,  70,  20] },
  { id: 'snow',    iconName: 'sparkles',  label: 'Sneeuw',     player: [ 90, 150, 200], monster: [ 60,  70, 110] },
  { id: 'fire',    iconName: 'zap',       label: 'Vuur',       player: [200,  90,  20], monster: [160,  15,  15] },
  { id: 'crypt',   iconName: 'skull',     label: 'Crypte',     player: [ 70,  50,  90], monster: [100,  80,  50] },
];

async function _loadEncounters() {
  try {
    _encounters = await api.listEncounters();
    _encLoaded = true;
  } catch (e) {
    _encounters = [];
  }
};

async function _renderEncounters() {
  const el = document.getElementById('dm-encounters-content');
  if (!el) return;
  if (!_encLoaded) {
    el.innerHTML = '<div class="dm-hint">Laden…</div>';
    await _loadEncounters();
  }
  // Also ensure monsters are loaded for the picker
  if (_monsters.length === 0) {
    try { const d = await api.listMonsters(); _monsters = (d.monsters || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'nl')); } catch (_) {}
  }
  if (_editingEncId !== null) {
    _renderEncounterEditor(el);
  } else {
    _renderEncounterList(el);
  }
};

function _renderEncounterList(el) {
  const html = _encounters.length === 0
    ? `<p class="dm-hint">Nog geen encounters. Maak er een aan met +.</p>`
    : _encounters.map(enc => {
        const akte = enc.akteId ? `<span class="dm-enc-akte">${esc(_hkLabel(enc.akteId))}</span>` : '';
        const monCount = (enc.monsters || []).reduce((s, r) => s + (r.count || 1), 0);
        const bdThumb = enc.backdropId
          ? `<img class="dm-enc-backdrop-thumb" src="${api.fileUrl(enc.backdropId)}" alt="">`
          : `<div class="dm-enc-backdrop-thumb dm-enc-backdrop-empty">${icon('image')}</div>`;
        return `
          <div class="dm-enc-card">
            ${bdThumb}
            <div class="dm-enc-card-info">
              <span class="dm-enc-card-name">${esc(enc.name)}</span>
              ${akte}
              <span class="dm-enc-meta">${monCount} monster${monCount !== 1 ? 's' : ''}</span>
            </div>
            <div class="dm-enc-card-actions">
              <button class="script-add-btn" onclick="window.dmPanel.encEdit('${esc(enc.id)}')" title="Bewerken">${icon('pencil')}</button>
              <button class="script-add-btn" onclick="window.dmPanel.encStart('${esc(enc.id)}')" title="Gevecht starten" style="background:rgba(80,140,80,0.35);border-color:rgba(100,180,100,0.6)">${icon('play')}</button>
            </div>
          </div>`;
      }).join('');

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row">
        <span class="dm-feature-title">Encounters</span>
        <button class="script-icon-btn" onclick="window.dmPanel.encNew()" title="Nieuw encounter">+</button>
      </div>
      <div class="dm-enc-list">${html}</div>
    </div>`;
};

function _renderEncounterEditor(el) {
  const isNew  = _encIsNew;
  const name   = _encName;
  const akteId = _encAkteId;

  // Backdrop row
  const bdHtml = `
    <div class="dm-upload-row dm-enc-bd-row">
      ${_encBackdropId
        ? `<img class="dm-mon-preview dm-mon-preview-wide" src="${api.fileUrl(_encBackdropId)}" alt="">`
        : `<div class="dm-mon-preview dm-mon-preview-wide dm-mon-preview-empty">${icon('image')}</div>`}
      <label class="script-add-btn" title="Backdrop uploaden" style="cursor:pointer">
        ${icon('image')}
        <input type="file" accept="image/*" style="display:none"
          onchange="window.dmPanel.encBackdropUpload(this)">
      </label>
      ${_encBackdropId ? `<button class="script-icon-btn script-icon-btn--del" onclick="window.dmPanel.encBackdropClear()" title="Verwijderen">${icon('x')}</button>` : ''}
    </div>`;

  // Monster rows — shared datalist for searchable input
  const datalistHtml = `<datalist id="dm-enc-monsters-dl">${_monsters.map(m => `<option value="${esc(m.name)}"></option>`).join('')}</datalist>`;

  const rowsHtml = _encMonsterRows.length === 0
    ? `<p class="dm-hint" style="margin:4px 0 8px">Nog geen monsters. Klik + om er een toe te voegen.</p>`
    : _encMonsterRows.map((r, i) => `
        <div class="dm-enc-monster-row" data-idx="${i}">
          <input class="dm-input dm-input-sm" type="text"
            list="dm-enc-monsters-dl"
            value="${esc(r.name || '')}"
            placeholder="Zoek monster…"
            style="flex:2;min-width:0"
            onchange="window._encRowNameChange(${i}, this.value)">
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Aantal</span>
            <input class="dm-input dm-input-sm" type="number" min="1" max="20" value="${r.count || 1}" style="width:46px"
              onchange="window.dmPanel.encRowChange(${i}, 'count', this.value)">
          </label>
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Init</span>
            <input class="dm-input dm-input-sm" type="number" value="${r.initiative ?? 10}" style="width:46px"
              onchange="window.dmPanel.encRowChange(${i}, 'initiative', this.value)">
          </label>
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Max HP</span>
            <input class="dm-input dm-input-sm" type="number" value="${r.hp ?? 10}" style="width:52px"
              onchange="window.dmPanel.encRowChange(${i}, 'hp', this.value)">
          </label>
          <button class="script-icon-btn script-icon-btn--del" onclick="window.dmPanel.encRemoveRow(${i})" title="Verwijderen">${icon('x')}</button>
        </div>`).join('');

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row">
        <span class="dm-feature-title">${isNew ? 'Nieuwe encounter' : 'Encounter bewerken'}</span>
        ${!isNew ? `<button class="script-add-btn" onclick="window.dmPanel.encDelete('${esc(_editingEncId)}')" title="Verwijderen">${icon('trash')}</button>` : ''}
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="dm-enc-name" class="dm-input" value="${esc(name)}" placeholder="Naam van dit encounter…"
          oninput="window._encFieldChange('name', this.value)">
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Akte</label>
        <select id="dm-enc-akte" class="dm-select"
          onchange="window._encFieldChange('akteId', this.value)">
          <option value="">— geen —</option>
          ${_hkOptions(akteId)}
        </select>
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Backdrop</label>
        ${bdHtml}
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Canvas-thema</label>
        <div class="enc-preset-row">
          ${CANVAS_PRESETS.map(p => {
            const [pr,pg,pb] = p.player;
            const [mr,mg,mb] = p.monster;
            const bg = `linear-gradient(135deg, rgba(${pr},${pg},${pb},0.38) 0%, rgba(${mr},${mg},${mb},0.38) 100%)`;
            const active = _encCanvasPreset === p.id;
            return `<button class="enc-preset-btn${active ? ' active' : ''}"
                      style="background:${bg}"
                      title="${esc(p.label)}"
                      onclick="window.dmPanel.encSetPreset('${p.id}')">${icon(p.iconName)}</button>`;
          }).join('')}
        </div>
      </div>

      ${datalistHtml}
      <div class="dm-form-label" style="margin-bottom:4px">Monsters</div>
      <div id="dm-enc-rows">${rowsHtml}</div>
      <button class="script-icon-btn" onclick="window.dmPanel.encAddRow()" title="Monster toevoegen" style="margin-bottom:10px">+</button>

      <div class="dm-form-actions">
        <button class="script-add-btn" onclick="window.dmPanel.encCancel()" title="Annuleren">${icon('x')}</button>
        <button class="script-add-btn" onclick="window.dmPanel.encSave()" title="Opslaan" style="background:rgba(80,140,80,0.35);border-color:rgba(100,180,100,0.6)">${icon('check')}</button>
      </div>
    </div>`;
};

function _encNew() {
  _editingEncId    = 'new';
  _encIsNew        = true;
  _encMonsterRows  = [];
  _encBackdropId   = null;
  _encCanvasPreset = null;
  _encName         = '';
  _encAkteId       = '';
  _renderEncounters();
};

function _encEdit(id) {
  const enc = _encounters.find(e => e.id === id);
  if (!enc) return;
  _editingEncId    = id;
  _encIsNew        = false;
  _encMonsterRows  = (enc.monsters || []).map(r => ({ ...r }));
  _encBackdropId   = enc.backdropId || null;
  _encCanvasPreset = enc.canvasPreset || null;
  _encName         = enc.name    || '';
  _encAkteId       = enc.akteId  || '';
  _renderEncounters();
};

function _encCancel() {
  _editingEncId = null;
  _encIsNew     = false;
  _renderEncounterList(document.getElementById('dm-encounters-content'));
};

async function _encSave() {
  const name   = document.getElementById('dm-enc-name')?.value.trim();
  const akteId = document.getElementById('dm-enc-akte')?.value || '';
  if (!name) { alert('Geef het encounter een naam.'); return; }
  const preset       = CANVAS_PRESETS.find(p => p.id === _encCanvasPreset);
  const canvasColors = preset ? { player: preset.player, monster: preset.monster } : null;
  const payload = {
    name,
    akteId:       akteId || null,
    backdropId:   _encBackdropId   || null,
    canvasPreset: _encCanvasPreset || null,
    canvasColors,
    monsters:     _encMonsterRows,
  };
  try {
    if (_encIsNew) {
      const created = await api.createEncounter(payload);
      _encounters.push(created);
    } else {
      const updated = await api.updateEncounter(_editingEncId, payload);
      const idx = _encounters.findIndex(e => e.id === _editingEncId);
      if (idx !== -1) _encounters[idx] = updated;
    }
    _editingEncId = null;
    _encIsNew     = false;
    _renderEncounterList(document.getElementById('dm-encounters-content'));
  } catch (e) { alert('Opslaan mislukt: ' + e.message); }
};

async function _encDelete(id) {
  const enc = _encounters.find(e => e.id === id);
  if (!enc) return;
  if (!confirm(`Encounter "${enc.name}" verwijderen?`)) return;
  try {
    if (enc.backdropId) api.deleteFile(enc.backdropId).catch(() => {});
    await api.deleteEncounter(id);
    _encounters = _encounters.filter(e => e.id !== id);
    _editingEncId = null;
    _encIsNew     = false;
    _renderEncounterList(document.getElementById('dm-encounters-content'));
  } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
};

async function _encStart(id) {
  if (_combat?.active) {
    if (!confirm('Er is al een actief gevecht. Dit gevecht beëindigen en de encounter starten?')) return;
  }
  try {
    // Stap 1: laad de encounter als combat-deelnemers (active: false)
    const loaded = await api.startEncounter(id);
    _combat = loaded;
    _combatLoaded = true;
    // Stap 2: activeer het gevecht meteen zodat de overlay zichtbaar wordt
    const combat = await api.startCombat();
    _combat = combat;
    _switchTab('gevecht');
    _renderGevecht();
    _renderCombatOverlay(combat);
  } catch (e) { alert('Starten mislukt: ' + e.message); }
};

function _encAddRow() {
  const first = _monsters[0];
  _encMonsterRows.push({
    monsterId:  first?.id   || '',
    name:       first?.name || '',
    count:      1,
    initiative: first?.initiative ?? 10,
    hp:         first?.maxHp      ?? 10,
  });
  _renderEncounterEditor(document.getElementById('dm-encounters-content'));
};

function _encRemoveRow(idx) {
  _encMonsterRows.splice(idx, 1);
  _renderEncounterEditor(document.getElementById('dm-encounters-content'));
};

function _encRowMonsterChange(idx, monsterId) {
  const m = _monsters.find(x => x.id === monsterId);
  if (m) {
    _encMonsterRows[idx].monsterId  = m.id;
    _encMonsterRows[idx].name       = m.name;
    _encMonsterRows[idx].initiative = m.initiative ?? 10;
    _encMonsterRows[idx].hp         = m.maxHp      ?? 10;
  }
  // Re-render so Init/HP fields update to monster defaults
  _renderEncounterEditor(document.getElementById('dm-encounters-content'));
};

// Houdt naam/akte in sync met de state-vars zodat re-renders de waarden bewaren
window._encFieldChange = function(field, value) {
  if (field === 'name')   _encName   = value;
  if (field === 'akteId') _encAkteId = value;
};

// Called when user picks/types a monster name in the datalist input
window._encRowNameChange = function(idx, name) {
  const m = _monsters.find(x => x.name === name);
  if (m) _encRowMonsterChange(idx, m.id);
};

function _encRowChange(idx, field, value) {
  const num = parseInt(value);
  _encMonsterRows[idx][field] = isNaN(num) ? value : num;
};

async function _encBackdropUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  // For new encounters we need a temp id; for existing we use the real id
  const encId = _encIsNew ? ('new-' + Date.now()) : _editingEncId;
  try {
    const fileId = await api.uploadEncounterBackdrop(encId, file);
    if (_encBackdropId && _encBackdropId !== fileId) api.deleteFile(_encBackdropId).catch(() => {});
    _encBackdropId = fileId;
    _renderEncounterEditor(document.getElementById('dm-encounters-content'));
  } catch (e) { alert('Upload mislukt: ' + e.message); }
};

function _encBackdropClear() {
  if (_encBackdropId) api.deleteFile(_encBackdropId).catch(() => {});
  _encBackdropId = null;
  _renderEncounterEditor(document.getElementById('dm-encounters-content'));
};

// ── Gevecht ──

function _setupTypeChange(type) {
  _setupSelectedType     = type;
  _setupSelectedPresetId  = null;
  _setupSelectedEntityId  = null;
  _renderGevecht();
};

function _setupPresetChange(presetId) {
  _setupSelectedPresetId = presetId || null;
  const m = _monsters.find(x => x.id === presetId);
  const nameEl  = document.getElementById('dm-setup-name');
  const initEl  = document.getElementById('dm-setup-init');
  const maxhpEl = document.getElementById('dm-setup-maxhp');
  if (m) {
    if (nameEl)  nameEl.value  = m.name;
    if (initEl)  initEl.value  = m.initiative;
    if (maxhpEl) maxhpEl.value = m.maxHp;
  } else {
    if (nameEl) nameEl.value = '';
  }
};

async function _setupEntityChange(entityId) {
  _setupSelectedEntityId = entityId || null;
  const e = _setupPersonages.find(x => x.id === entityId);
  const nameEl  = document.getElementById('dm-setup-name');
  const maxhpEl = document.getElementById('dm-setup-maxhp');
  if (!e) {
    if (nameEl) nameEl.value = '';
    return;
  }
  if (nameEl) nameEl.value = e.name;
  // Vul het HP-veld met het actuele HP uit dm-state (niet het statblock-maximum)
  let maxHp   = parseInt(e.stats?.hp) || 10;
  let current = maxHp;
  try {
    const hpData = await api.getPlayerHp(e.id);
    if (hpData.max     != null) maxHp   = hpData.max;
    if (hpData.current != null) current = hpData.current;
    else current = maxHp;
  } catch (_) {}
  if (maxhpEl) {
    maxhpEl.value       = current;
    maxhpEl.title       = `Huidig: ${current} / Max: ${maxHp}`;
    maxhpEl.placeholder = `HP (max ${maxHp})`;
    // Sla max op als data-attribuut zodat _setupAddSubmit het kan gebruiken
    maxhpEl.dataset.maxHp = maxHp;
  }
};

// Synchroniseert hp én maxHp van bestaande speler-combatants met dm-state
async function _syncSpelerHp() {
  if (!_combat?.combatants) return;
  const playerCombatants = _combat.combatants.filter(c => c.type === 'player' && c.entityId);
  for (const c of playerCombatants) {
    try {
      const hpData = await api.getPlayerHp(c.entityId);
      const patch = {};
      if (hpData.max     != null && hpData.max     !== c.maxHp) patch.maxHp = hpData.max;
      if (hpData.current != null && hpData.current !== c.hp)    patch.hp    = hpData.current;
      if (Object.keys(patch).length) await api.updateCombatant(c.id, patch);
    } catch (_) {}
  }
  _combat = await api.getCombat().catch(() => _combat);
};

async function _autoAddSpelers() {
  const spelers = _setupPersonages.filter(e =>
    e.subtype === 'speler' &&
    (!window._activeGroupId || e.data?.groep === window._activeGroupId)
  );
  for (const e of spelers) {
    let maxHp   = parseInt(e.stats?.hp) || 10;
    let current = maxHp;
    try {
      const hpData = await api.getPlayerHp(e.id);
      if (hpData.max     != null) maxHp   = hpData.max;
      if (hpData.current != null) current = hpData.current;
      else current = maxHp; // geen opgeslagen current → gebruik max
    } catch (_) {}
    await api.addCombatant({
      name:       e.name,
      type:       'player',
      initiative: 10,
      hp:         current,
      maxHp:      maxHp,
      entityId:   e.id,
    }).catch(() => {});
  }
  _combat = await api.getCombat().catch(() => _combat);
};

async function _setupAddSubmit() {
  const name       = document.getElementById('dm-setup-name')?.value.trim();
  const init       = parseInt(document.getElementById('dm-setup-init')?.value) || 0;
  const maxhpEl    = document.getElementById('dm-setup-maxhp');
  // Voor spelers: het veld bevat het actuele HP; maxHp staat in data-maxHp
  const isPlayer   = _setupSelectedType === 'player' && _setupSelectedEntityId;
  const currentHp  = parseInt(maxhpEl?.value) || 10;
  const maxHp      = isPlayer && maxhpEl?.dataset?.maxHp
    ? parseInt(maxhpEl.dataset.maxHp) || currentHp
    : currentHp;
  if (!name) return;

  const payload = { name, type: _setupSelectedType, initiative: init, hp: currentHp, maxHp };

  if (_setupSelectedType === 'monster' && _setupSelectedPresetId) {
    const m = _monsters.find(x => x.id === _setupSelectedPresetId);
    if (m) {
      payload.presetId   = m.id;
      payload.imageId    = m.imageId    || null;
      payload.backdropId = m.backdropId || null;
    }
  }

  if ((_setupSelectedType === 'player' || _setupSelectedType === 'ally') && _setupSelectedEntityId) {
    payload.entityId = _setupSelectedEntityId;
  }

  try {
    await api.addCombatant(payload);
    _setupSelectedPresetId = null;
    _setupSelectedEntityId = null;
    _renderGevecht();
  } catch (e) { alert('Fout: ' + e.message); }
};

async function _setupInitChange(combatantId, value) {
  const init = parseInt(value);
  if (isNaN(init)) return;
  try {
    await api.updateCombatant(combatantId, { initiative: init });
    const c = _combat?.combatants?.find(x => x.id === combatantId);
    if (c) c.initiative = init;
  } catch (e) { /* stil falen */ }
};

async function _setupReset() {
  if (!confirm('Remove all combatants?')) return;
  try {
    await api.endCombat();
    _combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
    _renderCombatOverlay(_combat);
    await _autoAddSpelers();
    _renderGevecht();
  } catch (e) { alert('Fout: ' + e.message); }
};

async function _combatStart() {
  if ((_combat?.combatants?.length || 0) === 0) {
    alert('Add combatants first.'); return;
  }
  try {
    _combat = await api.startCombat();
    _renderGevecht();
    _renderCombatOverlay(_combat);
  } catch (e) { alert('Fout: ' + e.message); }
};

async function _combatEnd() {
  if (!confirm('End combat?')) return;
  try {
    await api.endCombat();
    _combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
    _renderGevecht();
    _renderCombatOverlay(_combat);
  } catch (e) { alert('Fout: ' + e.message); }
};

// Geeft de indices terug van alle deelnemers die dezelfde beurt delen.
// Monsters met dezelfde initiative delen een beurt; spelers + summons op gelijk initiative ook.
function _getTurnGroup(combatants, currentTurn) {
  const current = combatants[currentTurn];
  if (!current) return [currentTurn];
  const init = current.initiative;
  if (current.type === 'monster') {
    return combatants
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'monster' && c.initiative === init)
      .map(({ i }) => i);
  }
  if (current.type === 'player' || current.type === 'summon') {
    // Speler + alle summons met hetzelfde initiative handelen samen
    return combatants
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => (c.type === 'player' || c.type === 'summon') && c.initiative === init)
      .map(({ i }) => i);
  }
  return [currentTurn];
};

async function _combatNextTurn() {
  if (!_combat?.active) return;
  const cs = _combat.combatants;
  const n = cs.length;
  if (n === 0) return;
  const group = _getTurnGroup(cs, _combat.currentTurn);
  const last  = Math.max(...group);
  const next  = (last + 1) % n;
  let round   = _combat.round;
  if (next === 0) round++;
  try { await api.updateCombat({ currentTurn: next, round }); }
  catch (e) { alert('Fout: ' + e.message); }
};

async function _combatPrevTurn() {
  if (!_combat?.active) return;
  const cs = _combat.combatants;
  const n = cs.length;
  if (n === 0) return;
  const group      = _getTurnGroup(cs, _combat.currentTurn);
  const first      = Math.min(...group);
  const prevIndex  = (first - 1 + n) % n;
  const prevGroup  = _getTurnGroup(cs, prevIndex);
  const prevStart  = Math.min(...prevGroup);
  let round        = _combat.round;
  if (first === 0 && round > 1) round--;
  try { await api.updateCombat({ currentTurn: prevStart, round }); }
  catch (e) { alert('Fout: ' + e.message); }
};

function _combatAddTypeChange(type) {
  const presetRow = document.getElementById('co-add-preset-row');
  if (presetRow) presetRow.classList.toggle('hidden', type !== 'monster');
  // Reset preset when switching type
  const preset = document.getElementById('co-add-preset');
  if (preset && type !== 'monster') preset.value = '';
};

function _combatAddPresetChange(presetId) {
  if (!presetId) return;
  const m = _monsters.find(x => x.id === presetId);
  if (!m) return;
  const nameEl = document.getElementById('co-add-name');
  const initEl = document.getElementById('co-add-init');
  const hpEl   = document.getElementById('co-add-maxhp');
  if (nameEl) nameEl.value = m.name;
  if (initEl) initEl.value = m.initiative ?? 10;
  if (hpEl)   hpEl.value   = m.maxHp ?? 10;
};

async function _combatAddSubmit() {
  const name    = document.getElementById('co-add-name')?.value.trim();
  const type    = document.getElementById('co-add-type')?.value || 'monster';
  const init    = parseInt(document.getElementById('co-add-init')?.value) || 0;
  const maxHp   = parseInt(document.getElementById('co-add-maxhp')?.value) || 10;
  const presetId = document.getElementById('co-add-preset')?.value || null;
  if (!name) return;
  const preset  = presetId ? _monsters.find(x => x.id === presetId) : null;
  try {
    await api.addCombatant({
      name, type, initiative: init, hp: maxHp, maxHp,
      ...(preset ? { imageId: preset.imageId || null, backdropId: preset.backdropId || null, presetId: preset.id } : {}),
    });
    document.getElementById('co-add-form')?.classList.add('hidden');
  } catch (e) { alert('Fout: ' + e.message); }
};

async function _combatApplyDamage(id) {
  const inp = document.getElementById('co-dmg-input-' + id);
  const amount = parseInt(inp?.value);
  if (!amount || amount <= 0) return;
  await _combatHpChange(id, -amount);
  if (inp) inp.value = '';
};

async function _combatApplyHeal(id) {
  const inp = document.getElementById('co-dmg-input-' + id);
  const amount = parseInt(inp?.value);
  if (!amount || amount <= 0) return;
  await _combatHpChange(id, amount);
  if (inp) inp.value = '';
};

async function _combatHpChange(id, delta) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  try {
    if (delta < 0) {
      // Schade: drain eerst THP, dan reguliere HP
      const tempHp    = c.tempHp || 0;
      const tempDrain = Math.min(tempHp, -delta);
      const hpDamage  = (-delta) - tempDrain;
      const newHp     = Math.max(0, c.hp - hpDamage);

      // Concentratie-save herinnering
      if (hpDamage > 0 && (c.conditions || []).includes('concentration')) {
        const dc = Math.max(10, Math.ceil(hpDamage / 2));
        _showToast(`⚡ ${c.name}: concentratie-save DC ${dc}!`);
      }

      const updates = { tempHp: tempHp - tempDrain, hp: newHp };
      // Speler valt op 0 HP → initialiseer death saves
      if (newHp === 0 && c.type === 'player' && (c.hp || 0) > 0) {
        updates.deathSaves = { successes: 0, failures: 0 };
      }
      await api.updateCombatant(id, updates);
    } else {
      // Healing: alleen reguliere HP, nooit boven maxHp
      const newHp  = Math.min(c.maxHp, c.hp + delta);
      const updates = { hp: newHp };
      // Genezen → wis death saves
      if (newHp > 0 && c.deathSaves) updates.deathSaves = { successes: 0, failures: 0 };
      await api.updateCombatant(id, updates);
    }
  } catch (e) { console.error(e); }
};

async function _combatHpInput(id, val) {
  const newHp = parseInt(val);
  if (isNaN(newHp)) return;
  const c = _combat?.combatants?.find(x => x.id === id);
  const maxHp    = c?.maxHp ?? 999;
  const clamped  = Math.min(maxHp, Math.max(0, newHp));
  const updates  = { hp: clamped };
  if (c) {
    const damage = (c.hp || 0) - clamped;
    if (damage > 0 && (c.conditions || []).includes('concentration')) {
      const dc = Math.max(10, Math.ceil(damage / 2));
      _showToast(`⚡ ${c.name}: concentratie-save DC ${dc}!`);
    }
    if (clamped === 0 && c.type === 'player' && (c.hp || 0) > 0)
      updates.deathSaves = { successes: 0, failures: 0 };
    if (clamped > 0 && c.deathSaves)
      updates.deathSaves = { successes: 0, failures: 0 };
  }
  try { await api.updateCombatant(id, updates); }
  catch (e) { console.error(e); }
};

// ── Speler past eigen HP aan in gevecht ──

async function _playerHpChange(id, delta) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  const newHp = Math.max(0, Math.min(c.maxHp || 999, (c.hp || 0) + delta));
  try { await api.combatPlayerHp(id, newHp); }
  catch (e) { console.error(e); }
};

async function _playerHpInput(id, val) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  const newHp = Math.max(0, Math.min(c.maxHp || 999, parseInt(val) || 0));
  try { await api.combatPlayerHp(id, newHp); }
  catch (e) { console.error(e); }
};

async function _combatThpChange(id, delta) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  try { await api.updateCombatant(id, { tempHp: Math.max(0, (c.tempHp || 0) + delta) }); }
  catch (e) { console.error(e); }
};

async function _combatThpInput(id, val) {
  const newThp = parseInt(val);
  if (isNaN(newThp)) return;
  try { await api.updateCombatant(id, { tempHp: Math.max(0, newThp) }); }
  catch (e) { console.error(e); }
};

async function _combatInitChange(id, val) {
  const init = parseInt(val);
  if (isNaN(init)) return;
  try { await api.updateCombatant(id, { initiative: init }); }
  catch (e) { console.error(e); }
};

async function _combatCondToggle(id, condId) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  let conditions = [...(c.conditions || [])];
  conditions = conditions.includes(condId)
    ? conditions.filter(x => x !== condId)
    : [...conditions, condId];
  try { await api.updateCombatant(id, { conditions }); }
  catch (e) { console.error(e); }
};

async function _combatRemove(id) {
  try { await api.removeCombatant(id); }
  catch (e) { alert('Fout: ' + e.message); }
};

async function _combatSetWinner(winner) {
  try { await api.setCombatWinner(winner); }
  catch (e) { alert('Fout: ' + e.message); }
};

async function _combatDeathSave(id, type) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;

  if (type === 'reset') {
    try { await api.updateCombatant(id, { deathSaves: { successes: 0, failures: 0 } }); }
    catch (e) { console.error(e); }
    return;
  }

  const ds = { successes: c.deathSaves?.successes || 0, failures: c.deathSaves?.failures || 0 };
  if (type === 'success') ds.successes = Math.min(3, ds.successes + 1);
  else                    ds.failures  = Math.min(3, ds.failures  + 1);

  const updates = { deathSaves: ds };

  if (ds.successes >= 3) {
    // Stabiel: voeg bewusteloos toe, wis death saves
    updates.deathSaves = { successes: 0, failures: 0 };
    updates.conditions = [...new Set([...(c.conditions || []), 'unconscious'])];
    try { await api.updateCombatant(id, updates); }
    catch (e) { console.error(e); }
    _showToast(`${c.name} is stabiel — bewusteloos maar levend.`);
  } else if (ds.failures >= 3) {
    try { await api.updateCombatant(id, updates); }
    catch (e) { console.error(e); }
    _showToast(`${c.name} is gestorven ☠️`);
  } else {
    try { await api.updateCombatant(id, updates); }
    catch (e) { console.error(e); }
  }
};

function _showToast(msg, duration = 4500) {
  const existing = document.getElementById('combat-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id        = 'combat-toast';
  el.className = 'combat-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('combat-toast-in'));
  });
  setTimeout(() => {
    el.classList.remove('combat-toast-in');
    setTimeout(() => el.remove(), 350);
  }, duration);
};

// ── Campagnes ─────────────────────────────────────────────────────────────────

async function _loadAndRenderCampagnes() {
  const el = document.getElementById('dm-campagnes-content');
  if (!el) return;
  el.innerHTML = '<p class="dm-empty" style="padding:16px">Campagnes laden…</p>';
  try {
    const { campaigns, activeCampaign } = await api.getCampaigns();
    _renderCampagnes(el, campaigns, activeCampaign);
  } catch (err) {
    el.innerHTML = `<p class="dm-empty" style="padding:16px;color:#c44">Fout: ${esc(err.message)}</p>`;
  }
};

function _renderCampagnes(el, campaigns, activeCampaign) {
  const THEMES = { default: 'Fantasy (standaard)', hp: 'Harry Potter' };
  const listHTML = campaigns.map(c => {
    const isActive = c.id === activeCampaign;
    return `
      <div class="campagne-card${isActive ? ' campagne-card--active' : ''}">
        <div class="campagne-card-info">
          <strong class="campagne-card-title">${esc(c.appTitle || c.id)}</strong>
          ${c.appSubtitle ? `<span class="campagne-card-sub">${esc(c.appSubtitle)}</span>` : ''}
          <span class="campagne-card-meta">${esc(THEMES[c.theme] || c.theme || 'standaard')} · ID: ${esc(c.id)}</span>
        </div>
        <div class="campagne-card-actions">
          ${isActive
            ? '<span class="campagne-active-badge">● Actief</span>'
            : `<button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneSwitchTo('${esc(c.id)}')" title="Activeer campagne">▶</button>`
          }
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="dm-form-label" style="font-size:1em;font-weight:700">Campagnes</span>
        <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneCreate()" title="Nieuwe campagne aanmaken">+</button>
      </div>
      <div class="campagne-list">${listHTML || '<p class="dm-empty">Geen campagnes gevonden.</p>'}</div>
    </div>
    <div class="dm-feature-section" id="campagne-create-form" style="display:none">
      <div class="dm-form-label" style="font-weight:700;margin-bottom:8px">Nieuwe campagne aanmaken</div>
      <div class="dm-feature-row" style="gap:8px;flex-wrap:wrap">
        <input id="campagne-new-id"       class="dm-input" placeholder="ID (bijv. prewett)" style="flex:1;min-width:120px">
        <input id="campagne-new-title"    class="dm-input" placeholder="Naam" style="flex:2;min-width:140px">
        <input id="campagne-new-subtitle" class="dm-input" placeholder="Ondertitel (optioneel)" style="flex:2;min-width:140px">
      </div>
      <div class="dm-feature-row" style="gap:8px;margin-top:6px;flex-wrap:wrap">
        <select id="campagne-new-theme" class="dm-input" style="flex:1;min-width:160px">
          <option value="default">Fantasy (standaard)</option>
          <option value="hp">Harry Potter</option>
        </select>
        <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneSubmit()" title="Aanmaken">${icon('check')}</button>
        <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="document.getElementById('campagne-create-form').style.display='none'" title="Annuleren">${icon('x')}</button>
      </div>
      <div id="campagne-create-error" style="color:#c44;font-size:.85em;margin-top:6px"></div>
    </div>`;
};

async function _campagneSwitchTo(id) {
  if (!confirm(`Wil je wisselen naar campagne "${id}"? Alle spelers worden automatisch uitgelogd.`)) return;
  try {
    await api.switchCampaign(id);
    // Socket event 'campaign:switched' zorgt voor de rest
  } catch (err) {
    alert('Wisselen mislukt: ' + err.message);
  }
};

function _campagneCreate() {
  const form = document.getElementById('campagne-create-form');
  if (form) { form.style.display = 'block'; document.getElementById('campagne-new-id')?.focus(); }
};

async function _campagneSubmit() {
  const id       = document.getElementById('campagne-new-id')?.value.trim();
  const title    = document.getElementById('campagne-new-title')?.value.trim();
  const subtitle = document.getElementById('campagne-new-subtitle')?.value.trim();
  const theme    = document.getElementById('campagne-new-theme')?.value || 'default';
  const errEl    = document.getElementById('campagne-create-error');
  if (!id) { if (errEl) errEl.textContent = 'Vul een ID in.'; return; }
  if (errEl) errEl.textContent = '';
  try {
    await api.createCampaign(id, { appTitle: title || id, appSubtitle: subtitle, theme });
    await _renderInstellingen();
  } catch (err) {
    if (errEl) errEl.textContent = 'Aanmaken mislukt: ' + err.message;
  }
};

// ── Herberg instellingen ───────────────────────────────────────────────────────

// ── Wereld (Grisburgh verlaten) ───────────────────────────────────────────────

async function _renderWereldTab() {
  const el = _tabEl('wereld');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const meta = window.app?.state?.meta || {};
  const buitenGrisburgh = !!meta.buitenGrisburgh;
  const buitenEntiteiten = meta.buitenGrisburgEntiteiten || [];

  // Load all verkopers + winkels
  let verkopers = [];
  try {
    const [p, l] = await Promise.all([
      api.listEntities('personages').catch(() => []),
      api.listEntities('locaties').catch(() => []),
    ]);
    verkopers = [
      ...p.filter(e => e.subtype === 'verkoper'),
      ...l.filter(e => e.data?.locType === 'Winkel'),
    ];
  } catch {}

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Locatie van de groep</div>

      <div class="dm-form-row" style="flex-direction:column;gap:10px">
        <button id="wereld-toggle-btn" class="dm-btn${buitenGrisburgh ? ' dm-btn-danger' : ' dm-btn-primary'}"
          onclick="window._wereldToggle()" style="font-size:1rem;padding:10px 18px">
          ${buitenGrisburgh ? '🔒 Grisburgh verlaten — klik om terug te keren' : '🏙️ In Grisburgh — klik om te verlaten'}
        </button>
        <p style="font-size:11px;opacity:.6">
          Als de groep Grisburgh verlaat, worden alle Grisburgh-diensten
          (herberg, Tweespalt, Gock) en winkels geblokkeerd voor spelers.
          Winkels die je hieronder markeert als "buiten Grisburgh" blijven altijd bereikbaar.
        </p>
      </div>
    </div>

    ${verkopers.length > 0 ? `
    <div class="dm-feature-section" style="margin-top:14px">
      <div class="dm-section-label">Bereikbaar buiten Grisburgh</div>
      <p style="font-size:11px;opacity:.6;margin-bottom:10px">
        Gemarkeerde winkels/verkopers blijven toegankelijk wanneer de groep buiten Grisburgh is.
      </p>
      ${verkopers.map(v => `
        <div class="dm-form-row" style="align-items:center;gap:10px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
            <input type="checkbox" ${buitenEntiteiten.includes(v.id) ? 'checked' : ''}
              onchange="window._wereldToggleEntiteit('${esc(v.id)}')"
              style="width:16px;height:16px;accent-color:var(--color-gold,#c4a87a)">
            <span class="dm-form-label" style="margin:0">${esc(v.name)}</span>
          </label>
        </div>`).join('')}
    </div>` : ''}`;
};

window._wereldToggle = async () => {
  const meta = window.app?.state?.meta || {};
  try {
    const res = await api.setLocatie({ buitenGrisburgh: !meta.buitenGrisburgh });
    if (window.app?.state) window.app.state.meta = { ...meta, buitenGrisburgh: res.buitenGrisburgh };
    await _renderWereldTab();
  } catch (err) { alert('Fout: ' + err.message); }
};

window._wereldToggleEntiteit = async (entityId) => {
  const meta = window.app?.state?.meta || {};
  try {
    const res = await api.toggleLocatieEntiteit(entityId);
    if (window.app?.state) window.app.state.meta = { ...meta, buitenGrisburgEntiteiten: res.buitenGrisburgEntiteiten };
  } catch (err) { alert('Fout: ' + err.message); }
};

let _hbPersonages = [];
let _hbPendingBackdropId = null;

async function _renderHerbergSettings() {
  const el = _tabEl('herberg');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const config = window.app?.state?.meta?.herberg || {};
  try { _hbPersonages = await api.listEntities('personages'); } catch { _hbPersonages = []; }
  _hbPendingBackdropId = null;

  const selectedP = _hbPersonages.find(p => p.id === config.imageId);

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Herberginstellingen</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam van de herberg</label>
        <input id="hb-naam" class="dm-input" value="${esc(config.naam || '')}" placeholder="De Swarte Cat…">
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Waard (NPC)</label>
        <select id="hb-waard-select" class="dm-select" onchange="window._hbSelectWaard(this.value)">
          <option value="">— Kies een personage —</option>
          ${_hbPersonages.map(p => `<option value="${esc(p.id)}" ${config.imageId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>

      <div id="hb-portrait-row" class="dm-form-row" style="${selectedP ? '' : 'display:none'}">
        <img id="hb-portrait-preview" src="${selectedP ? api.fileUrl(selectedP.id) : ''}"
          style="width:64px;height:80px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.4)">
      </div>

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${config.backdropId ? `<img id="hb-backdrop-preview" src="${api.fileUrl(config.backdropId)}"
          style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : ''}
        <label class="dm-btn dm-btn-ghost" title="Achtergrondafbeelding kiezen" style="cursor:pointer;align-self:flex-start">
          📷
          <input type="file" accept="image/*" class="hidden" onchange="window._hbUploadBackdrop(this.files[0])">
        </label>
      </div>

      <div class="dm-form-row" style="flex-direction:column;gap:4px">
        <label class="dm-form-label">Begroeting (spelersnaam = <code>{naam}</code>)</label>
        <textarea id="hb-groet" class="dm-input" rows="3"
          placeholder="Welkom, {naam}! Wat kan ik voor je betekenen?"
          style="resize:vertical;min-height:60px">${esc(config.groet || '')}</textarea>
        <span class="dm-hint" style="font-size:10px;color:var(--color-ink-dim,#888)">Gebruik <code>{naam}</code> voor de voornaam van de speler.</span>
      </div>

      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._hbSave()" title="Opslaan">💾</button>
      </div>
    </div>`;
};

async function _renderBeursTab() {
  const el = _tabEl('beurs');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  let _partyCurrency = { enabled: false, fl: 0, kn: 0, cl: 0 };
  try { _partyCurrency = await api.getPartyCurrency(); } catch { /* ok */ }

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Gedeelde beurs</div>

      <div class="dm-form-row" style="align-items:center;gap:12px">
        <button class="dm-btn${_partyCurrency.enabled ? ' dm-btn-primary' : ''}"
          id="hb-purse-toggle-btn"
          onclick="window._hbTogglePurse()">
          ${_partyCurrency.enabled ? icon('users') : icon('coins')}
        </button>
      </div>

      ${_partyCurrency.enabled ? `
      <div class="dm-form-row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <label class="dm-form-label" style="width:100%">Bedragen bijwerken</label>
        <input id="hb-purse-fl" class="dm-input" type="number" min="0" style="width:80px"
          placeholder="FL" value="${_partyCurrency.fl}">
        <input id="hb-purse-kn" class="dm-input" type="number" min="0" style="width:80px"
          placeholder="KN" value="${_partyCurrency.kn}">
        <input id="hb-purse-cl" class="dm-input" type="number" min="0" style="width:80px"
          placeholder="CL" value="${_partyCurrency.cl}">
        <button class="dm-btn dm-btn-ghost" onclick="window._hbSavePurse()" title="Bijwerken">💾</button>
      </div>` : `
      <p style="font-size:12px;color:var(--color-ink-dim,#888);margin-top:8px">
        Activeer de gedeelde beurs zodat alle spelers hetzelfde saldo zien.
      </p>`}
    </div>`;
};

window._hbSelectWaard = (entityId) => {
  const p = _hbPersonages.find(p => p.id === entityId);
  const row = document.getElementById('hb-portrait-row');
  const img = document.getElementById('hb-portrait-preview');
  if (p && img) {
    img.src = api.fileUrl(p.id);
    if (row) row.style.display = '';
  } else if (row) {
    row.style.display = 'none';
  }
};

window._hbUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'herberg-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    _hbPendingBackdropId = id;
    // Show/update preview
    const existing = document.getElementById('hb-backdrop-preview');
    if (existing) {
      existing.src = api.fileUrl(id);
    } else {
      const label = document.querySelector('[onchange*="_hbUploadBackdrop"]')?.closest('.dm-form-row');
      if (label) {
        const img = document.createElement('img');
        img.id = 'hb-backdrop-preview';
        img.src = api.fileUrl(id);
        img.style.cssText = 'width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)';
        label.prepend(img);
      }
    }
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._hbSave = async () => {
  const config = window.app?.state?.meta?.herberg || {};
  const naam = document.getElementById('hb-naam')?.value.trim() || '';
  const select = document.getElementById('hb-waard-select');
  const entityId = select?.value || '';
  const p = _hbPersonages.find(p => p.id === entityId);
  const groet = document.getElementById('hb-groet')?.value.trim() || '';
  const payload = {
    naam,
    waard:      p?.name || config.waard || '',
    imageId:    entityId || config.imageId || '',
    backdropId: _hbPendingBackdropId || config.backdropId || '',
    groet,
  };
  try {
    await api.saveHerberg(payload);
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    // Update tab label + backdrop CSS var
    window.app?.applyAppMeta?.();
    // Re-render to reflect saved state
    await _renderHerbergSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

// ── Tweespalt / Gokkantoor ────────────────────────────────────────────────────

async function _renderTweespaltDM() {
  const el = _tabEl('tweespalt');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  let data;
  try { data = await api.getTweespalt(); } catch (err) {
    el.innerHTML = `<div class="dm-feature-section"><p style="color:var(--color-seal)">${esc(err.message)}</p></div>`;
    return;
  }

  const { events = [], config: tsConfig = {} } = data;

  function formatCl(cl) {
    const fl = Math.floor(cl / 100), kn = Math.floor((cl % 100) / 10), ce = cl % 10;
    return [fl && `${fl} fl`, kn && `${kn} kn`, ce && `${ce} cl`].filter(Boolean).join(' · ') || '0 cl';
  }

  function renderDMEvent(evt) {
    const isAfgerond = evt.status === 'afgerond';
    const winnaarOptie = isAfgerond ? evt.opties.find(o => o.id === evt.uitkomst) : null;
    const aantalInzetten = Object.keys(evt.inzetten || {}).length;
    const sluitLabel = evt.sluitTijd
      ? new Date(evt.sluitTijd).toLocaleString('nl-NL')
      : '—';

    return `
      <div class="dm-feature-section" style="border:1px solid rgba(196,168,122,0.3);margin-bottom:10px;padding:10px">
        <div class="dm-feature-row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <strong>${esc(evt.naam)}</strong>
            <span style="margin-left:8px;font-size:11px;opacity:.6">${evt.type === 'godenwedden' ? '⚡ Godenwedden' : icon('swords')+' Gevecht'}</span>
            ${isAfgerond ? '<span style="margin-left:6px;font-size:11px;color:var(--color-gold)">✓ Afgerond</span>' : ''}
          </div>
          <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window._tsDmVerwijder('${esc(evt.id)}')">${icon('x')}</button>
        </div>
        <div style="font-size:11px;opacity:.65;margin:4px 0">
          Modus: ${evt.uitkomstModus === 'dm' ? 'DM bepaalt' : `Automatisch — sluit ${sluitLabel}`} ·
          Inzetten: ${aantalInzetten}
        </div>
        <div style="margin:6px 0">
          ${evt.opties.map(o => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
              <span style="flex:1">${esc(o.naam)}</span>
              <span style="font-size:11px;opacity:.7">${o.kans}% · ×${o.payout + 1}</span>
              ${isAfgerond
                ? (o.id === evt.uitkomst ? '<span style="color:var(--color-gold)">★ Winnaar</span>' : '')
                : evt.uitkomstModus === 'dm'
                  ? `<button class="dm-btn dm-btn-sm" onclick="window._tsDmUitslag('${esc(evt.id)}','${esc(o.id)}')" style="font-size:10px" title="Laat winnen">★</button>`
                  : ''}
            </div>`).join('')}
        </div>
        ${!isAfgerond && evt.uitkomstModus === 'auto'
          ? `<button class="dm-btn dm-btn-sm" onclick="window._tsDmUitslag('${esc(evt.id)}')" title="Nu afronden">⚡</button>`
          : ''}
        ${!isAfgerond && evt.inzetten && Object.keys(evt.inzetten).length
          ? `<div style="margin-top:6px;font-size:11px;opacity:.7">
              ${Object.entries(evt.inzetten).map(([cid, inz]) => {
                const optNaam = evt.opties.find(o => o.id === inz.optieId)?.naam || '?';
                return `<div>${esc(cid.slice(0,8))}… → ${esc(optNaam)} (${formatCl(inz.bedragCl)})</div>`;
              }).join('')}
             </div>` : ''}
      </div>`;
  }

  let tsPersonages = [], tsLocaties = [];
  try { tsPersonages = await api.listEntities('personages'); } catch {}
  try { tsLocaties   = await api.listEntities('locaties');   } catch {}
  const tsAlleEntiteiten = [...tsPersonages, ...tsLocaties];

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">De Tweespalt — Instellingen</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="ts-naam-config" class="dm-input" value="${esc(tsConfig.naam || 'De Tweespalt')}">
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Portret (NPC)</label>
        <select id="ts-portret-select" class="dm-select">
          <option value="">— Kies een personage of locatie —</option>
          ${tsAlleEntiteiten.map(e => `<option value="${esc(e.id)}" ${tsConfig.imageId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select>
      </div>
      ${tsConfig.imageId ? `<div class="dm-form-row"><img src="${api.fileUrl(tsConfig.imageId)}" style="width:56px;height:70px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.4)"></div>` : ''}

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${tsConfig.backdropId ? `<img id="ts-backdrop-preview" src="${api.fileUrl(tsConfig.backdropId)}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : '<span id="ts-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" title="Achtergrondafbeelding kiezen" style="cursor:pointer;align-self:flex-start">
          📷
          <input type="file" accept="image/*" class="hidden" onchange="window._tsUploadBackdrop(this.files[0])">
        </label>
        <div class="dm-form-row">
          <label class="dm-form-label">Of kies uit entiteiten</label>
          <select id="ts-backdrop-select" class="dm-select">
            <option value="">— Entiteit als backdrop —</option>
            ${tsAlleEntiteiten.map(e => `<option value="${esc(e.id)}" ${tsConfig.backdropId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._tsSettingsSave()" title="Instellingen opslaan">💾</button>
      </div>
    </div>

    <div class="dm-feature-section" style="margin-top:14px">
      <div class="dm-section-label">De Tweespalt — Beheer</div>
      ${events.length
        ? events.map(renderDMEvent).join('')
        : `<p style="opacity:.5;font-size:13px">Geen actieve events.</p>`}

      <div class="dm-section-label" style="margin-top:14px">Nieuw event aanmaken</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Type</label>
        <select id="ts-type" class="dm-select" onchange="window._tsToggleGodenwedden()">
          <option value="gevecht">⚔️ Gevecht</option>
          <option value="godenwedden">⚡ Godenwedden</option>
        </select>
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="ts-naam" class="dm-input" placeholder="bv. Standhall vs. De Vuurvuist">
      </div>

      <div class="dm-form-row" id="ts-modus-row">
        <label class="dm-form-label">Uitkomst</label>
        <select id="ts-modus" class="dm-select" onchange="window._tsToonModusVelden()">
          <option value="auto">Automatisch (op basis van kansen)</option>
          <option value="dm">DM bepaalt vooraf</option>
        </select>
      </div>

      <div id="ts-duur-row" class="dm-form-row">
        <label class="dm-form-label">Duur (minuten)</label>
        <input id="ts-duur" class="dm-input" type="number" min="1" value="60" style="width:80px">
      </div>

      <div class="dm-section-label" style="margin-top:10px;font-size:11px">Opties (min. 2)</div>
      <div id="ts-opties-lijst"></div>
      <button class="dm-btn dm-btn-ghost" onclick="window._tsAddOptie()" title="Optie toevoegen" style="margin-top:4px">+</button>

      <div id="ts-dm-winnaar-row" class="dm-form-row hidden">
        <label class="dm-form-label">Winnende optie</label>
        <select id="ts-dm-winnaar" class="dm-select"></select>
      </div>

      <div class="dm-form-row" style="margin-top:12px">
        <button class="dm-btn dm-btn-primary" onclick="window._tsDmOpslaan()" title="Event aanmaken">💾</button>
      </div>
    </div>
    </div>`;

  window._tsAddOptie();
  window._tsAddOptie();
  window._tsToonModusVelden();
};

let _tsOptieCount = 0;

window._tsAddOptie = () => {
  _tsOptieCount++;
  const lijst = document.getElementById('ts-opties-lijst');
  if (!lijst) return;
  const id = _tsOptieCount;
  const row = document.createElement('div');
  row.className = 'dm-feature-row';
  row.id = `ts-optie-row-${id}`;
  row.style.cssText = 'gap:6px;align-items:center;margin-bottom:4px';
  row.innerHTML = `
    <input class="dm-input ts-opt-naam" placeholder="Naam" style="flex:2">
    <input class="dm-input ts-opt-kans" type="number" min="0" max="100" placeholder="%" style="width:52px" title="Kans in %">
    <input class="dm-input ts-opt-payout" type="number" min="1" placeholder="×" style="width:48px" title="Uitbetaling (bijv. 4 = 4:1)">
    <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="document.getElementById('ts-optie-row-${id}').remove();window._tsUpdateWinnaarSelect()">${icon('x')}</button>`;
  lijst.appendChild(row);
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', window._tsUpdateWinnaarSelect));
  window._tsUpdateWinnaarSelect();
};

window._tsUpdateWinnaarSelect = () => {
  const sel = document.getElementById('ts-dm-winnaar');
  if (!sel) return;
  const prev = sel.value;
  const namen = [...document.querySelectorAll('.ts-opt-naam')].map(i => i.value.trim()).filter(Boolean);
  sel.innerHTML = namen.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('');
  if (prev) sel.value = prev;
};

window._tsToonModusVelden = () => {
  const modus = document.getElementById('ts-modus')?.value;
  const duurRow = document.getElementById('ts-duur-row');
  const winnaarRow = document.getElementById('ts-dm-winnaar-row');
  if (duurRow) duurRow.classList.toggle('hidden', modus === 'dm');
  if (winnaarRow) winnaarRow.classList.toggle('hidden', modus !== 'dm');
};

window._tsToggleGodenwedden = () => {
  const type = document.getElementById('ts-type')?.value;
  const modusSelect = document.getElementById('ts-modus');
  const modusRow = document.getElementById('ts-modus-row');
  if (type === 'godenwedden') {
    if (modusSelect) modusSelect.value = 'dm';
    if (modusRow) modusRow.classList.add('hidden');
  } else {
    if (modusRow) modusRow.classList.remove('hidden');
  }
  window._tsToonModusVelden();
};

window._tsDmOpslaan = async () => {
  const naam = document.getElementById('ts-naam')?.value.trim();
  const type = document.getElementById('ts-type')?.value;
  const modus = document.getElementById('ts-modus')?.value || 'auto';
  const duur = parseInt(document.getElementById('ts-duur')?.value) || 60;

  const optieRijen = document.querySelectorAll('#ts-opties-lijst > .dm-feature-row');
  const opties = [...optieRijen].map(row => ({
    naam:   row.querySelector('.ts-opt-naam')?.value.trim() || '',
    kans:   parseFloat(row.querySelector('.ts-opt-kans')?.value) || 0,
    payout: parseFloat(row.querySelector('.ts-opt-payout')?.value) || 1,
  })).filter(o => o.naam);

  if (!naam) { alert('Geef een naam op.'); return; }
  if (opties.length < 2) { alert('Voeg minimaal 2 opties toe.'); return; }

  let uitkomst = null;
  if (modus === 'dm') {
    const sel = document.getElementById('ts-dm-winnaar');
    const idx = parseInt(sel?.value);
    uitkomst = isNaN(idx) ? null : String(idx);
  }

  try {
    await api.createTweespaltEvent({ naam, type, uitkomstModus: modus, uitkomst, opties, duurMinuten: duur });
    _tsOptieCount = 0;
    await _renderTweespaltDM();
  } catch (err) { alert('Fout: ' + err.message); }
};

window._tsDmUitslag = async (eventId, optieId) => {
  try {
    await api.uitslagTweespalt(eventId, optieId ? { uitkomst: optieId } : {});
    await _renderTweespaltDM();
  } catch (err) { alert('Fout: ' + err.message); }
};

window._tsDmVerwijder = async (eventId) => {
  if (!confirm('Event verwijderen? Inzetten worden teruggestort.')) return;
  try {
    await api.deleteTweespaltEvent(eventId);
    await _renderTweespaltDM();
  } catch (err) { alert('Fout: ' + err.message); }
};

window._tsUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'ts-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    window._tsBackdropPending = id;
    const prev = document.getElementById('ts-backdrop-preview');
    if (prev) { prev.src = api.fileUrl(id); prev.style.display = ''; }
    const sel = document.getElementById('ts-backdrop-select');
    if (sel) sel.value = '';
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._tsSettingsSave = async () => {
  const naam      = document.getElementById('ts-naam-config')?.value.trim() || 'De Tweespalt';
  const imageId   = document.getElementById('ts-portret-select')?.value || null;
  const backdropFromSelect = document.getElementById('ts-backdrop-select')?.value || null;
  const backdropId = window._tsBackdropPending || backdropFromSelect || (window.app?.state?.meta?.tweespalt?.backdropId) || null;
  try {
    await api.saveTweespaltConfig({ naam, imageId, backdropId });
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    window._tsBackdropPending = null;
    await _renderTweespaltDM();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

// ── De Gock ───────────────────────────────────────────────────────────────────

async function _renderGockSettings() {
  const el = _tabEl('gock');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const meta = window.app?.state?.meta || {};
  const config = meta.gock || {};
  const prijs = config.prijs || { fl: 50 };

  let personages = [], gockLocaties = [];
  try { personages  = await api.listEntities('personages'); } catch {}
  try { gockLocaties = await api.listEntities('locaties');  } catch {}
  const gockAlleEntiteiten = [...personages, ...gockLocaties];

  const tidbitsWaarde = (config.tidbits || []).join('\n');

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">De Gock — Instellingen</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="gock-naam" class="dm-input" value="${esc(config.naam || 'De Gock')}">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Prijs (fl)</label>
        <input id="gock-prijs-fl" class="dm-input" type="number" min="0" value="${prijs.fl || 50}" style="width:70px">
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Portret (NPC of locatie)</label>
        <select id="gock-portret-select" class="dm-select">
          <option value="">— Kies een entiteit —</option>
          ${gockAlleEntiteiten.map(e => `<option value="${esc(e.id)}" ${config.imageId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select>
      </div>
      ${config.imageId ? `<div class="dm-form-row"><img src="${api.fileUrl(config.imageId)}" style="width:56px;height:70px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.4)"></div>` : ''}

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${config.backdropId ? `<img id="gock-backdrop-preview" src="${api.fileUrl(config.backdropId)}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : '<span id="gock-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" title="Achtergrondafbeelding uploaden" style="cursor:pointer;align-self:flex-start">
          📷
          <input type="file" accept="image/*" class="hidden" onchange="window._gockUploadBackdrop(this.files[0])">
        </label>
        <div class="dm-form-row">
          <label class="dm-form-label">Of kies uit entiteiten</label>
          <select id="gock-backdrop-select" class="dm-select">
            <option value="">— Entiteit als backdrop —</option>
            ${gockAlleEntiteiten.map(e => `<option value="${esc(e.id)}" ${config.backdropId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="dm-form-row" style="flex-direction:column;gap:4px">
        <label class="dm-form-label">Aangepaste tidbits (één per regel, gebruik {naam})</label>
        <textarea id="gock-tidbits" class="dm-input" rows="8" style="resize:vertical;font-size:11px"
          placeholder="Laat leeg voor standaard tidbits…">${esc(tidbitsWaarde)}</textarea>
      </div>
      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._gockSettingsSave()" title="Opslaan">💾</button>
      </div>
    </div>

    `;
};

window._gockUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'gock-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    window._gockBackdropPending = id;
    const prev = document.getElementById('gock-backdrop-preview');
    if (prev) { prev.src = api.fileUrl(id); prev.style.display = ''; }
    const sel = document.getElementById('gock-backdrop-select');
    if (sel) sel.value = '';
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._gockSettingsSave = async () => {
  const config = window.app?.state?.meta?.gock || {};
  const naam = document.getElementById('gock-naam')?.value.trim() || 'De Gock';
  const fl = parseInt(document.getElementById('gock-prijs-fl')?.value) || 50;
  const tidbitsRaw = document.getElementById('gock-tidbits')?.value.trim() || '';
  const tidbits = tidbitsRaw ? tidbitsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const imageId = document.getElementById('gock-portret-select')?.value || config.imageId || '';
  const backdropFromSelect = document.getElementById('gock-backdrop-select')?.value || null;
  const backdropId = window._gockBackdropPending || backdropFromSelect || config.backdropId || '';
  try {
    await api.saveGockConfig({ naam, prijs: { fl }, tidbits: tidbits.length ? tidbits : undefined, imageId, backdropId });
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    window._gockBackdropPending = null;
    await _renderGockSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

// ── De Magizoöloog — DM-instellingen ──
async function _renderMagizooSettings() {
  const el = _tabEl('magizoo');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const meta = window.app?.state?.meta || {};
  const config = meta.magizoo || {};
  const prijs = config.prijs || { fl: 25 };
  const prijsVol = config.prijsVolledig || { fl: 60 };

  let personages = [], locaties = [];
  try { personages = await api.listEntities('personages'); } catch {}
  try { locaties   = await api.listEntities('locaties');   } catch {}
  const alle = [...personages, ...locaties];

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">De Magizoöloog — Instellingen</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="magizoo-naam" class="dm-input" value="${esc(config.naam || 'De Magizoöloog')}">
      </div>
      <div class="dm-form-row" style="flex-direction:column;gap:4px">
        <label class="dm-form-label">Groet (in-character, cursief)</label>
        <textarea id="magizoo-groet" class="dm-input" rows="2" style="resize:vertical"
          placeholder="Bijv: De Beestenkenner kijkt op van een kooi en veegt een inktvlek weg.">${esc(config.groet || '')}</textarea>
      </div>
      <div class="dm-feature-row" style="gap:6px">
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Prijs per trede (fl)</label>
          <input id="magizoo-prijs-fl" class="dm-input dm-input-sm" type="number" min="0" value="${prijs.fl || 25}">
        </div>
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Volledig ineens (fl)</label>
          <input id="magizoo-prijsvol-fl" class="dm-input dm-input-sm" type="number" min="0" value="${prijsVol.fl || 60}">
        </div>
        <div class="dm-form-row" style="flex:1">
          <label class="dm-form-label">Cooldown (min)</label>
          <input id="magizoo-cooldown" class="dm-input dm-input-sm" type="number" min="0" value="${config.cooldownMinuten ?? 5}">
        </div>
      </div>

      <div class="dm-form-row">
        <label class="dm-form-label">Portret (NPC of locatie)</label>
        <select id="magizoo-portret-select" class="dm-select">
          <option value="">— Kies een entiteit —</option>
          ${alle.map(e => `<option value="${esc(e.id)}" ${config.imageId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select>
      </div>
      ${config.imageId ? `<div class="dm-form-row"><img src="${api.fileUrl(config.imageId)}" style="width:56px;height:70px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.4)"></div>` : ''}

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${config.backdropId ? `<img id="magizoo-backdrop-preview" src="${api.fileUrl(config.backdropId)}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : '<span id="magizoo-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" title="Achtergrondafbeelding uploaden" style="cursor:pointer;align-self:flex-start">
          ${icon('image')}
          <input type="file" accept="image/*" class="hidden" onchange="window._magizooUploadBackdrop(this.files[0])">
        </label>
        <div class="dm-form-row">
          <label class="dm-form-label">Of kies uit entiteiten</label>
          <select id="magizoo-backdrop-select" class="dm-select">
            <option value="">— Entiteit als backdrop —</option>
            ${alle.map(e => `<option value="${esc(e.id)}" ${config.backdropId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <p class="dm-hint" style="font-size:11px;opacity:0.75;margin:4px 0">De roddel per monster stel je in bij de Monsterbibliotheek (veld "Roddel").</p>
      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._magizooSettingsSave()" title="Opslaan">${icon('save')}</button>
      </div>
    </div>`;
};

window._magizooUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'magizoo-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    window._magizooBackdropPending = id;
    const prev = document.getElementById('magizoo-backdrop-preview');
    if (prev) { prev.src = api.fileUrl(id); prev.style.display = ''; }
    const sel = document.getElementById('magizoo-backdrop-select');
    if (sel) sel.value = '';
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._magizooSettingsSave = async () => {
  const config = window.app?.state?.meta?.magizoo || {};
  const naam = document.getElementById('magizoo-naam')?.value.trim() || 'De Magizoöloog';
  const groet = document.getElementById('magizoo-groet')?.value.trim() || '';
  const fl = parseInt(document.getElementById('magizoo-prijs-fl')?.value) || 0;
  const flVol = parseInt(document.getElementById('magizoo-prijsvol-fl')?.value) || 0;
  const cooldownMinuten = parseInt(document.getElementById('magizoo-cooldown')?.value) || 0;
  const imageId = document.getElementById('magizoo-portret-select')?.value || config.imageId || '';
  const backdropFromSelect = document.getElementById('magizoo-backdrop-select')?.value || null;
  const backdropId = window._magizooBackdropPending || backdropFromSelect || config.backdropId || '';
  try {
    await api.saveMagizooConfig({ naam, groet, prijs: { fl }, prijsVolledig: { fl: flVol }, cooldownMinuten, imageId, backdropId });
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    window._magizooBackdropPending = null;
    await _renderMagizooSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

// ── Madame Ursula — DM-instellingen ──

let _ursulaBackdropPending = null;
let _ursulaAktes = [];
let _ursulaActiveAkte = null;
let _ursulaSelectedAkte = null;

async function _renderUrsulaSettings() {
  const el = _tabEl('ursula');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const meta = window.app?.state?.meta || {};
  const config = meta.ursula || {};
  let personages = [], locaties = [];
  try { personages = await api.listEntities('personages'); } catch {}
  try { locaties  = await api.listEntities('locaties');  } catch {}
  const alle = [...personages, ...locaties];

  try { const r = await api.ursulaAktes(); _ursulaAktes = r.aktes || []; _ursulaActiveAkte = r.activeAkte || null; }
  catch { _ursulaAktes = []; _ursulaActiveAkte = null; }
  // Normaliseer: { num: null } betekent geen actieve akte
  if (_ursulaActiveAkte?.num == null) _ursulaActiveAkte = null;
  if ((!_ursulaSelectedAkte || !_ursulaAktes.some(a => a.key === _ursulaSelectedAkte)) && _ursulaAktes.length) {
    const next = _ursulaActiveAkte ? _ursulaAktes.find(a => a.num > (_ursulaActiveAkte.num ?? -1)) : null;
    _ursulaSelectedAkte = (next || _ursulaAktes[0]).key;
  }

  const prijs = config.prijs || { fl: 20 };
  const sel = _ursulaAktes.find(a => a.key === _ursulaSelectedAkte) || null;
  const v = sel?.voorspelling || {};
  const actiefLabel = _ursulaActiveAkte ? `Akte ${_ursulaActiveAkte.num} — ${esc(_ursulaActiveAkte.title || '')}` : 'geen';
  const doel = _ursulaActiveAkte ? _ursulaAktes.find(a => a.num > (_ursulaActiveAkte.num ?? -1)) : null;
  const actiefInfo = _ursulaActiveAkte
    ? `<p class="dm-form-label" style="opacity:.7;margin:0 0 6px">Actieve akte: <strong>${actiefLabel}</strong>${doel ? ' \u00b7 spelers voorzien nu <strong>Akte ' + doel.num + ' \u2014 ' + esc(doel.title || '') + '</strong>' : ' \u00b7 (geen volgende akte)'}</p>`
    : '<p class="dm-form-label" style="color:#c0392b;font-weight:600;margin:0 0 8px">' + icon('lock') + ' Geen actieve akte \u2014 Ursula is momenteel niet beschikbaar voor spelers.</p>';

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Madame Ursula — Instellingen</div>

      <div class="dm-form-row"><label class="dm-form-label">Naam</label>
        <input id="ursula-naam" class="dm-input" value="${esc(config.naam || 'Madame Ursula')}"></div>
      <div class="dm-form-row"><label class="dm-form-label">Prijs (fl)</label>
        <input id="ursula-prijs-fl" class="dm-input" type="number" min="0" value="${prijs.fl || 20}" style="width:70px"></div>

      <div class="dm-form-row"><label class="dm-form-label">Portret (NPC of locatie)</label>
        <select id="ursula-portret-select" class="dm-select">
          <option value="">— Kies een entiteit —</option>
          ${alle.map(e => `<option value="${esc(e.id)}" ${config.imageId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select></div>
      ${config.imageId ? `<div class="dm-form-row"><img src="${api.fileUrl(config.imageId)}" style="width:56px;height:70px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.4)"></div>` : ''}

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${config.backdropId ? `<img id="ursula-backdrop-preview" src="${api.fileUrl(config.backdropId)}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : '<span id="ursula-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" style="cursor:pointer;align-self:flex-start">📷
          <input type="file" accept="image/*" class="hidden" onchange="window._ursulaUploadBackdrop(this.files[0])"></label>
        <div class="dm-form-row"><label class="dm-form-label">Of kies uit entiteiten</label>
          <select id="ursula-backdrop-select" class="dm-select">
            <option value="">— Entiteit als backdrop —</option>
            ${alle.map(e => `<option value="${esc(e.id)}" ${config.backdropId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select></div>
      </div>
      <div class="dm-form-row"><button class="dm-btn dm-btn-primary" onclick="window._ursulaSettingsSave()" title="Opslaan">💾</button></div>

      <div class="dm-section-label" style="margin-top:14px">Voorspellingen per akte</div>
      ${actiefInfo}

      ${_ursulaAktes.length === 0 ? '<p class="dm-form-label" style="opacity:.6">Nog geen aktes/hoofdstukken gedefinieerd.</p>' : `
      <div class="dm-form-row"><label class="dm-form-label">Akte</label>
        <select id="ursula-akte-select" class="dm-select" onchange="window._ursulaSelectAkte(this.value)">
          ${_ursulaAktes.map(a => `<option value="${esc(a.key)}" ${a.key === _ursulaSelectedAkte ? 'selected' : ''}>Akte ${a.num} — ${esc(a.title)}${a.voorspelling ? ' ✓' : ''}</option>`).join('')}
        </select></div>
      <div class="dm-form-row" style="flex-direction:column;gap:4px">
        <label class="dm-form-label">👁 Zien</label><textarea id="ursula-zien" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.zien || '')}</textarea>
        <label class="dm-form-label">👂 Horen</label><textarea id="ursula-horen" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.horen || '')}</textarea>
        <label class="dm-form-label">👃 Ruiken</label><textarea id="ursula-ruiken" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.ruiken || '')}</textarea>
        <label class="dm-form-label">👅 Proeven</label><textarea id="ursula-proeven" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.proeven || '')}</textarea>
        <label class="dm-form-label">✋ Voelen</label><textarea id="ursula-voelen" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.voelen || '')}</textarea>
        <label class="dm-form-label">✦ Concrete kern (naam/locatie — onthuld bij een 6)</label><textarea id="ursula-concreet" class="dm-input" rows="2" style="font-size:11px;resize:vertical">${esc(v.concreet || '')}</textarea>
      </div>
      <div class="dm-form-row" style="gap:6px">
        <button class="dm-btn dm-btn-primary" onclick="window._ursulaVoorspellingSave()" title="Voorspelling opslaan">💾 Voorspelling</button>
        <button class="dm-btn dm-btn-ghost" onclick="window._ursulaResetParty()" title="Wis de party-worp voor deze akte zodat opnieuw geworpen kan worden">↺ Reset party-worp</button>
      </div>`}
    </div>`;
};

window._ursulaSelectAkte = (key) => { _ursulaSelectedAkte = key; _renderUrsulaSettings(); };

window._ursulaUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'ursula-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    _ursulaBackdropPending = id;
    const prev = document.getElementById('ursula-backdrop-preview');
    if (prev) { prev.src = api.fileUrl(id); prev.style.display = ''; }
    const sel2 = document.getElementById('ursula-backdrop-select'); if (sel2) sel2.value = '';
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._ursulaSettingsSave = async () => {
  const config = window.app?.state?.meta?.ursula || {};
  const naam = document.getElementById('ursula-naam')?.value.trim() || 'Madame Ursula';
  const fl = parseInt(document.getElementById('ursula-prijs-fl')?.value) || 20;
  const imageId = document.getElementById('ursula-portret-select')?.value || config.imageId || '';
  const backdropFromSelect = document.getElementById('ursula-backdrop-select')?.value || null;
  const backdropId = _ursulaBackdropPending || backdropFromSelect || config.backdropId || '';
  try {
    await api.saveUrsulaConfig({ naam, prijs: { fl }, imageId, backdropId });
    const newMeta = await api.meta(); if (window.app?.state) window.app.state.meta = newMeta;
    _ursulaBackdropPending = null;
    await _renderUrsulaSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

window._ursulaVoorspellingSave = async () => {
  if (!_ursulaSelectedAkte) return;
  const g = (id) => document.getElementById(id)?.value || '';
  try {
    await api.saveUrsulaVoorspelling(_ursulaSelectedAkte, {
      zien: g('ursula-zien'), horen: g('ursula-horen'), ruiken: g('ursula-ruiken'),
      proeven: g('ursula-proeven'), voelen: g('ursula-voelen'), concreet: g('ursula-concreet'),
    });
    await _renderUrsulaSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};

window._ursulaResetParty = async () => {
  if (!confirm('De party-voorspelling voor deze akte wissen zodat de groep opnieuw kan werpen?')) return;
  try { await api.ursulaReset(_ursulaSelectedAkte || undefined); }
  catch (err) { alert('Reset mislukt: ' + err.message); }
};


// ── De Heeren van de Nacht — DM-instellingen ──

let _heerenBackdropPending = null;
let _heerenRangenDraft = [];

function _heerenClTekst(cl) {
  const f = Math.floor(cl / 100), k = Math.floor((cl % 100) / 10), c = cl % 10;
  return [f && `${f} fl`, k && `${k} kn`, c && `${c} cl`].filter(Boolean).join(' ') || '0 cl';
};

async function _renderHeerenSettings() {
  const el = _tabEl('heeren');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  const meta = window.app?.state?.meta || {};
  const config = meta.heeren || {};
  let personages = [], locaties = [], organisaties = [];
  try { personages   = await api.listEntities('personages'); } catch {}
  try { locaties     = await api.listEntities('locaties'); } catch {}
  try { organisaties = await api.listEntities('organisaties'); } catch {}
  const advOpties = [...personages, ...organisaties];

  let data = null;
  try { data = await api.getHeeren(); } catch {}
  const rang = data?.rang || { naam: '', index: 0, aantal: 0 };
  const jobs = data?.jobs || [];
  const alleBoetes = data?.alleBoetes || [];

  const rangen = (config.rangen && config.rangen.length) ? config.rangen : [
    { naam: 'Schoffie', min: 10, max: 30, voordelen: 'Toegang tot het klussenbord.' },
    { naam: 'Beurzensnijder', min: 25, max: 70, voordelen: 'Betere klussen; de heler knijpt een oogje toe.' },
    { naam: 'Inbreker', min: 60, max: 150, voordelen: 'Hogere buit en eerste keus uit de klussen.' },
    { naam: 'Schaduw', min: 140, max: 300, voordelen: 'Een goed woordje bij Zilvertong en Zemelaar.' },
    { naam: 'Meesterdief', min: 280, max: 600, voordelen: 'De Heeren staan voor je in bij de Luimpoort.' },
  ];
  _heerenRangenDraft = rangen.map(r => ({ ...r }));
  const honFl = (config.honorarium && config.honorarium.fl) || 50;
  const typeIcon = { zakkenrollen: '🤚', inbraak: '🗝️', oplichting: '🎭' };

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">De Heeren van de Nacht — Instellingen</div>

      <div class="dm-form-row"><label class="dm-form-label">Naam</label>
        <input id="heeren-naam" class="dm-input" value="${esc(config.naam || 'De Heeren van de Nacht')}"></div>
      <div class="dm-form-row"><label class="dm-form-label">Contact-portret</label>
        <select id="heeren-portret" class="dm-select"><option value="">— entiteit —</option>
          ${[...personages, ...locaties, ...organisaties].map(e => `<option value="${esc(e.id)}" ${config.imageId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select></div>
      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrond</label>
        ${config.backdropId ? `<img id="heeren-backdrop-preview" src="${api.fileUrl(config.backdropId)}" style="width:100%;max-height:90px;object-fit:cover;border-radius:6px">` : '<span id="heeren-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" style="cursor:pointer;align-self:flex-start">📷<input type="file" accept="image/*" class="hidden" onchange="window._heerenUploadBackdrop(this.files[0])"></label>
      </div>
      <div class="dm-form-row"><label class="dm-form-label">Gerechtshof (de Luimpoort)</label>
        <select id="heeren-luimpoort" class="dm-select"><option value="">— locatie —</option>
          ${locaties.map(e => `<option value="${esc(e.id)}" ${config.luimpoortId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select></div>
      <div class="dm-form-row"><label class="dm-form-label">Advocaat (Zilvertong en Zemelaar)</label>
        <select id="heeren-advocaat" class="dm-select"><option value="">— personage/organisatie —</option>
          ${advOpties.map(e => `<option value="${esc(e.id)}" ${config.advocaatId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select></div>
      <div class="dm-form-row"><label class="dm-form-label">Honorarium advocaat (fl)</label>
        <input id="heeren-honorarium" class="dm-input" type="number" min="0" value="${honFl}" style="width:70px"></div>
      <div class="dm-form-row"><label class="dm-form-label">Boete = buit ×</label>
        <input id="heeren-boetefactor" class="dm-input" type="number" min="1" step="0.5" value="${config.boeteFactor ?? 2}" style="width:70px"></div>
      <div class="dm-form-row"><label class="dm-form-label">Bordgrootte</label>
        <input id="heeren-bordgrootte" class="dm-input" type="number" min="1" max="12" value="${config.bordGrootte ?? 4}" style="width:70px"></div>

      <div class="dm-section-label" style="margin-top:12px">Rangen (aanzien)</div>
      <div id="heeren-rangen"></div>
      <div class="dm-form-row"><button class="dm-btn dm-btn-ghost" onclick="window._heerenRangToevoegen()">＋ Rang</button></div>
      <div class="dm-form-row"><button class="dm-btn dm-btn-primary" onclick="window._heerenSettingsSave()">💾 Instellingen</button></div>

      <div class="dm-section-label" style="margin-top:14px">Huidige rang van de party</div>
      <div class="dm-form-row"><label class="dm-form-label">Rang</label>
        <select id="heeren-huidige-rang" class="dm-select" onchange="window._heerenSetRang(this.value)">
          ${rangen.map((r, i) => `<option value="${i}" ${i === rang.index ? 'selected' : ''}>${esc(r.naam)} (${r.min}–${r.max} fl)</option>`).join('')}
        </select></div>

      <div class="dm-section-label" style="margin-top:14px">Klussenbord</div>
      <div class="dm-form-row"><button class="dm-btn dm-btn-primary" onclick="window._heerenGenereer()">🎲 Genereer / ververs bord</button></div>
      <div id="heeren-jobs">
        ${jobs.length ? jobs.map(j => `
          <div style="border:1px solid rgba(196,168,122,0.25);border-radius:8px;padding:8px;margin-bottom:8px">
            <div><strong>${typeIcon[j.type] || ''} ${esc(j.typeNaam)}</strong> — buit ${j.payout} fl ${j.doelZichtbaar ? '' : '<span style="opacity:.6">(doelwit nog onontdekt)</span>'}</div>
            <div style="opacity:.8;font-size:12px">${esc(j.omschrijving)}</div>
            ${j.status === 'aangenomen'
              ? `<div style="margin-top:4px"><span style="opacity:.8;font-size:12px">Aangenomen door ${esc(j.doorNaam || '?')}</span>
                 <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
                   <button class="dm-btn dm-btn-sm" onclick="window._heerenUitslag('${esc(j.id)}','geslaagd')">✓ Geslaagd</button>
                   <button class="dm-btn dm-btn-sm" onclick="window._heerenUitslag('${esc(j.id)}','mislukt')">✗ Mislukt</button>
                   <button class="dm-btn dm-btn-sm" onclick="window._heerenUitslag('${esc(j.id)}','ontsnapt')">🏃 Betrapt → ontsnapt</button>
                   <button class="dm-btn dm-btn-sm" onclick="window._heerenUitslag('${esc(j.id)}','gearresteerd')">⛓️ Betrapt → gearresteerd</button>
                 </div></div>`
              : `<div style="opacity:.6;font-size:12px;margin-top:4px">Open — wacht op een speler</div>`}
          </div>`).join('') : '<p class="dm-form-label" style="opacity:.6">Bord is leeg. Genereer klussen.</p>'}
      </div>

      <div class="dm-section-label" style="margin-top:14px">Openstaande boetes</div>
      <div id="heeren-boetes">
        ${alleBoetes.length ? alleBoetes.map(b => `
          <div class="dm-form-row" style="gap:6px;align-items:center;border:1px solid rgba(196,168,122,0.2);border-radius:6px;padding:6px;margin-bottom:6px">
            <span style="flex:1">⚖️ <strong>${esc(b.characterNaam)}</strong> — ${esc(b.reden)} (${_heerenClTekst(b.bedragCl)})</span>
            <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._heerenKwijt('${esc(b.characterId)}','${esc(b.id)}')">Kwijtschelden</button>
          </div>`).join('') : '<p class="dm-form-label" style="opacity:.6">Geen openstaande boetes.</p>'}
      </div>
    </div>`;
  _renderHeerenRangen();
};

function _renderHeerenRangen() {
  const wrap = document.getElementById('heeren-rangen');
  if (!wrap) return;
  wrap.innerHTML = _heerenRangenDraft.map((r, i) => `
    <div style="border:1px solid rgba(196,168,122,0.2);border-radius:6px;padding:6px;margin-bottom:6px">
      <div class="dm-form-row" style="gap:6px;align-items:center;margin-bottom:4px">
        <input class="dm-input" style="flex:1" placeholder="Rangnaam" value="${esc(r.naam || '')}" oninput="window._heerenRangEdit(${i},'naam',this.value)">
        <input class="dm-input" type="number" style="width:60px" placeholder="min" value="${r.min ?? ''}" oninput="window._heerenRangEdit(${i},'min',this.value)">
        <input class="dm-input" type="number" style="width:60px" placeholder="max" value="${r.max ?? ''}" oninput="window._heerenRangEdit(${i},'max',this.value)">
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._heerenRangVerwijder(${i})">🗑️</button>
      </div>
      <input class="dm-input" style="width:100%" placeholder="Voordelen (bijv. korting, safehouse, contacten…)" value="${esc(r.voordelen || '')}" oninput="window._heerenRangEdit(${i},'voordelen',this.value)">
    </div>`).join('') || '<p class="dm-form-label" style="opacity:.6">Geen rangen.</p>';
};

window._heerenRangEdit = (i, f, v) => { const r = _heerenRangenDraft[i]; if (!r) return; r[f] = (f === 'naam' || f === 'voordelen') ? v : (parseInt(v) || 0); };
window._heerenRangToevoegen = () => { _heerenRangenDraft.push({ naam: '', min: 0, max: 0 }); _renderHeerenRangen(); };
window._heerenRangVerwijder = (i) => { _heerenRangenDraft.splice(i, 1); _renderHeerenRangen(); };

window._heerenUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'heeren-backdrop-' + Date.now();
  try { await api.uploadFile(id, file); _heerenBackdropPending = id; const p = document.getElementById('heeren-backdrop-preview'); if (p) { p.src = api.fileUrl(id); p.style.display = ''; } }
  catch (e) { alert('Upload mislukt: ' + e.message); }
};

window._heerenSettingsSave = async () => {
  const config = window.app?.state?.meta?.heeren || {};
  const naam = document.getElementById('heeren-naam')?.value.trim() || 'De Heeren van de Nacht';
  const imageId = document.getElementById('heeren-portret')?.value || '';
  const backdropId = _heerenBackdropPending || config.backdropId || '';
  const luimpoortId = document.getElementById('heeren-luimpoort')?.value || '';
  const advocaatId = document.getElementById('heeren-advocaat')?.value || '';
  const honorarium = { fl: parseInt(document.getElementById('heeren-honorarium')?.value) || 50 };
  const boeteFactor = parseFloat(document.getElementById('heeren-boetefactor')?.value) || 2;
  const bordGrootte = parseInt(document.getElementById('heeren-bordgrootte')?.value) || 4;
  const rangen = _heerenRangenDraft.filter(r => (r.naam || '').trim()).map(r => ({ naam: r.naam.trim(), min: r.min || 0, max: Math.max(r.min || 0, r.max || 0), voordelen: (r.voordelen || '').trim() }));
  try {
    await api.saveHeerenConfig({ naam, imageId, backdropId, luimpoortId, advocaatId, honorarium, boeteFactor, bordGrootte, rangen });
    const newMeta = await api.meta(); if (window.app?.state) window.app.state.meta = newMeta;
    _heerenBackdropPending = null;
    await _renderHeerenSettings();
  } catch (e) { alert('Opslaan mislukt: ' + e.message); }
};

window._heerenSetRang  = async (rang) => { try { await api.heerenSetRang(parseInt(rang)); await _renderHeerenSettings(); } catch (e) { alert(e.message); } };
window._heerenGenereer = async () => { try { await api.heerenGenereer(); await _renderHeerenSettings(); } catch (e) { alert(e.message); } };
window._heerenUitslag  = async (id, uitkomst) => { try { await api.heerenUitslag(id, uitkomst); await _renderHeerenSettings(); } catch (e) { alert(e.message); } };
window._heerenKwijt    = async (cid, bid) => { if (!confirm('Deze boete kwijtschelden?')) return; try { await api.heerenKwijt(cid, bid); await _renderHeerenSettings(); } catch (e) { alert(e.message); } };


// ── De Tempel — DM-instellingen ──

let _tempelGodenDraft = [];
let _tempelBackdropPending = null;
let _tempelEntityPortretOpties = [];
let _tempelBackdropOpties = [];

async function _renderTempelSettings() {
  const el = _tabEl('tempel');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  let data;
  try { data = await api.getTempel(); }
  catch (e) { el.innerHTML = `<div class="dm-feature-section"><div class="dm-section-label">Fout: ${esc(String(e?.message || e))}</div></div>`; return; }
  const config = data.config || {};
  _tempelGodenDraft = (config.goden || []).map(g => ({ ...g }));

  let personages = [], locaties = [];
  try { personages = await api.listEntities('personages'); } catch {}
  try { locaties  = await api.listEntities('locaties');  } catch {}
  const alle = [...personages, ...locaties];

  // Build entity option lists for per-god image pickers
  _tempelEntityPortretOpties = [...personages, ...locaties]
    .filter(e => e.imageId)
    .map(e => ({ value: e.imageId, label: e.naam || e.name || e.id }));
  _tempelBackdropOpties = locaties
    .filter(e => e.imageId)
    .map(e => ({ value: e.imageId, label: e.naam || e.name || e.id }));

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">De Tempel — Instellingen</div>

      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="tempel-naam" class="dm-input" value="${esc(config.naam || 'De Tempel')}">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Prijs eenmalige zegen (fl)</label>
        <input id="tempel-prijs-fl" class="dm-input" type="number" min="0" value="${(config.prijs && config.prijs.fl) || 25}" style="width:70px">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Prijs eed (fl)</label>
        <input id="tempel-eedprijs-fl" class="dm-input" type="number" min="0" value="${(config.eedPrijs && config.eedPrijs.fl) || 50}" style="width:70px">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Boeteprijs vloek (fl)</label>
        <input id="tempel-boeteprijs-fl" class="dm-input" type="number" min="0" value="${(config.boetePrijs && config.boetePrijs.fl) || 100}" style="width:70px">
      </div>
      <input id="tempel-voorwerp" type="hidden" value="${esc(config.voorwerpNaam || 'Votiefmunt van {god}')}">
      <input id="tempel-portret-select" type="hidden" value="${esc(config.imageId || '')}">

      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Achtergrondafbeelding</label>
        ${config.backdropId ? `<img id="tempel-backdrop-preview" src="${api.fileUrl(config.backdropId)}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;border:1px solid rgba(196,168,122,0.3)">` : '<span id="tempel-backdrop-preview" style="display:none"></span>'}
        <label class="dm-btn dm-btn-ghost" style="cursor:pointer;align-self:flex-start">
          ${icon('image')}
          <input type="file" accept="image/*" class="hidden" onchange="window._tempelUploadBackdrop(this.files[0])">
        </label>
        <div class="dm-form-row">
          <label class="dm-form-label">Of kies uit entiteiten</label>
          <select id="tempel-backdrop-select" class="dm-select">
            <option value="">— Entiteit als backdrop —</option>
            ${alle.map(e => `<option value="${esc(e.id)}" ${config.backdropId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="dm-section-label" style="margin-top:14px">Actieve eden &amp; vloeken</div>
      <div id="tempel-eden"></div>

      <div class="dm-section-label" style="margin-top:14px">Goden — metadata</div>
      <p class="dm-form-label" style="opacity:.7;margin:0 0 6px">Naam, domein, symbool, afbeeldingen en (optioneel) een eigen prijs. De zegen/vloek/eed-inhoud staat op de Blessing-kaartjes.</p>
      <div id="tempel-goden"></div>
      <div class="dm-form-row">
        <button class="dm-btn dm-btn-ghost" onclick="window._tempelGodToevoegen()" title="God toevoegen">＋ God</button>
      </div>

      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._tempelSettingsSave()" title="Opslaan">${icon('save')}</button>
      </div>
    </div>
  `;
  _renderTempelGodenRows();
  _renderTempelEden();
};

async function _renderTempelEden() {
  const wrap = document.getElementById('tempel-eden');
  if (!wrap) return;
  let eden = [];
  try { eden = await api.tempelEden(); } catch {}
  if (!eden.length) {
    wrap.innerHTML = '<p class="dm-form-label" style="opacity:.6">Geen actieve eden of vloeken.</p>';
    return;
  }
  wrap.innerHTML = eden.map(e => `
    <div class="dm-form-row" style="gap:6px;align-items:center;border:1px solid rgba(196,168,122,0.2);border-radius:6px;padding:6px;margin-bottom:6px">
      <span style="flex:1">
        ${e.status === 'vloek' ? icon('skull') : icon('scroll-text')} <strong>${esc(e.characterName)}</strong> — ${esc(e.godNaam)}
        <span style="display:block;opacity:.7;font-size:11px">${esc(e.effect || '')}</span>
      </span>
      ${e.status === 'vloek'
        ? `<button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._tempelEedHef('${esc(e.characterId)}')" title="Hef de vloek op">Hef op</button>`
        : `<button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._tempelEedVerbreek('${esc(e.characterId)}')" title="Verbreek de eed → vloek">Verbreek</button>
           <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._tempelEedHef('${esc(e.characterId)}')" title="Eed opheffen (correctie)">✕</button>`}
    </div>`).join('');
};

window._tempelEedVerbreek = async (characterId) => {
  if (!confirm('Deze eed verbreken? De speler wordt vervloekt tot er boete is gedaan.')) return;
  try { await api.tempelEedVerbreek(characterId); await _renderTempelEden(); }
  catch (err) { alert(err.message || 'Mislukt'); }
};

window._tempelEedHef = async (characterId) => {
  if (!confirm('Deze eed of vloek opheffen?')) return;
  try { await api.tempelEedHef(characterId); await _renderTempelEden(); }
  catch (err) { alert(err.message || 'Mislukt'); }
};

function _renderTempelGodenRows() {
  const wrap = document.getElementById('tempel-goden');
  if (!wrap) return;
  wrap.innerHTML = _tempelGodenDraft.map((g, i) => `
    <div class="dm-tempel-god" style="border:1px solid rgba(196,168,122,0.25);border-radius:8px;padding:8px;margin-bottom:8px">
      <div class="dm-form-row" style="gap:6px;align-items:center">
        <input class="dm-input" style="flex:1" placeholder="Naam (bijv. Matall, de Maker)" value="${esc(g.naam || '')}" oninput="window._tempelGodEdit(${i},'naam',this.value)">
        <input class="dm-input" type="number" min="0" style="width:64px" placeholder="fl" value="${(g.prijs && g.prijs.fl) || ''}" oninput="window._tempelGodEdit(${i},'prijsFl',this.value)" title="Eigen prijs (leeg = standaard)">
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._tempelGodVerwijderen(${i})" title="Verwijderen">${icon('trash')}</button>
      </div>
      <div class="dm-form-row" style="gap:6px">
        <input class="dm-input" style="flex:1" placeholder="Domein" value="${esc(g.domein || '')}" oninput="window._tempelGodEdit(${i},'domein',this.value)">
        <input class="dm-input" style="flex:1" placeholder="Symbool" value="${esc(g.symbool || '')}" oninput="window._tempelGodEdit(${i},'symbool',this.value)">
      </div>
      <p class="dm-form-label" style="opacity:.6;margin:2px 0 0;font-size:10px">Zegen, vloek, eed-tekst, permanente zegen en de eenmalige zegens beheer je op de Blessing-kaartjes in het archief (die zijn leidend).</p>
      <div class="dm-form-row" style="gap:6px;flex-wrap:wrap;margin-top:4px">
        <div style="flex:1;min-width:140px">
          <label class="dm-form-label" style="opacity:.65;display:block;margin-bottom:2px;font-size:10px">God-portret</label>
          <select class="dm-select" style="font-size:11px" onchange="window._tempelGodEdit(${i},'imageId',this.value)">
            <option value="">— geen —</option>
            ${_tempelEntityPortretOpties.map(e => `<option value="${esc(e.value)}"${g.imageId===e.value?' selected':''}>${esc(e.label)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <label class="dm-form-label" style="opacity:.65;display:block;margin-bottom:2px;font-size:10px">Priester/NPC</label>
          <select class="dm-select" style="font-size:11px" onchange="window._tempelGodEdit(${i},'priestImageId',this.value)">
            <option value="">— geen —</option>
            ${_tempelEntityPortretOpties.map(e => `<option value="${esc(e.value)}"${g.priestImageId===e.value?' selected':''}>${esc(e.label)}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <label class="dm-form-label" style="opacity:.65;display:block;margin-bottom:2px;font-size:10px">Tempel-backdrop</label>
          <select class="dm-select" style="font-size:11px" onchange="window._tempelGodEdit(${i},'backdropId',this.value)">
            <option value="">— geen —</option>
            ${_tempelBackdropOpties.map(e => `<option value="${esc(e.value)}"${g.backdropId===e.value?' selected':''}>${esc(e.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="dm-form-row" style="margin-top:4px">
        <input class="dm-input" style="flex:1;font-size:11px" placeholder="Priester-begroeting (optioneel)" value="${esc(g.priesterGreet || '')}" oninput="window._tempelGodEdit(${i},'priesterGreet',this.value)">
      </div>
    </div>
  `).join('') || '<p class="dm-form-label" style="opacity:.6">Nog geen goden toegevoegd.</p>';
};

window._tempelGodEdit = (i, field, value) => {
  const g = _tempelGodenDraft[i];
  if (!g) return;
  if (field === 'prijsFl') {
    const fl = parseInt(value);
    if (fl > 0) g.prijs = { fl }; else delete g.prijs;
  } else {
    g[field] = value;
  }
};

window._tempelGodEditLines = (i, value) => {
  const g = _tempelGodenDraft[i];
  if (!g) return;
  g.eenmaligeZegens = value.split('\n').map(l => l.trim()).filter(Boolean);
};

window._tempelGodToevoegen = () => {
  _tempelGodenDraft.push({ id: 'god_' + Date.now(), naam: '', domein: '', symbool: '', zegen: '', vloek: '', eenmaligeZegens: [] });
  _renderTempelGodenRows();
};

window._tempelGodVerwijderen = (i) => {
  _tempelGodenDraft.splice(i, 1);
  _renderTempelGodenRows();
};

window._tempelUploadBackdrop = async (file) => {
  if (!file) return;
  const id = 'tempel-backdrop-' + Date.now();
  try {
    await api.uploadFile(id, file);
    _tempelBackdropPending = id;
    const prev = document.getElementById('tempel-backdrop-preview');
    if (prev) { prev.src = api.fileUrl(id); prev.style.display = ''; }
    const sel = document.getElementById('tempel-backdrop-select');
    if (sel) sel.value = '';
  } catch (err) { alert('Upload mislukt: ' + err.message); }
};

window._tempelSettingsSave = async () => {
  const config = window.app?.state?.meta?.tempel || {};
  const naam = document.getElementById('tempel-naam')?.value.trim() || 'De Tempel';
  const fl = parseInt(document.getElementById('tempel-prijs-fl')?.value) || 25;
  const eedFl = parseInt(document.getElementById('tempel-eedprijs-fl')?.value) || 50;
  const boeteFl = parseInt(document.getElementById('tempel-boeteprijs-fl')?.value) || 100;
  const voorwerpNaam = document.getElementById('tempel-voorwerp')?.value.trim() || 'Votiefmunt van {god}';
  const imageId = document.getElementById('tempel-portret-select')?.value || config.imageId || '';
  const backdropFromSelect = document.getElementById('tempel-backdrop-select')?.value || null;
  const backdropId = _tempelBackdropPending || backdropFromSelect || config.backdropId || '';
  const goden = _tempelGodenDraft
    .filter(g => (g.naam || '').trim())
    .map(g => ({
      id: g.id || ('god_' + Math.random().toString(36).slice(2, 8)),
      naam: g.naam.trim(),
      domein: (g.domein || '').trim(),
      symbool: (g.symbool || '').trim(),
      zegen: (g.zegen || '').trim(),
      vloek: (g.vloek || '').trim(),
      eenmaligeZegens: (g.eenmaligeZegens || []).filter(Boolean),
      ...(g.prijs        ? { prijs:        g.prijs }        : {}),
      ...(g.imageId      ? { imageId:      g.imageId }      : {}),
      ...(g.priestImageId? { priestImageId:g.priestImageId } : {}),
      ...(g.backdropId   ? { backdropId:   g.backdropId }   : {}),
      ...(g.priesterGreet? { priesterGreet:g.priesterGreet } : {}),
    }));
  try {
    await api.saveTempelConfig({ naam, prijs: { fl }, eedPrijs: { fl: eedFl }, boetePrijs: { fl: boeteFl }, voorwerpNaam, imageId, backdropId, goden });
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    _tempelBackdropPending = null;
    await _renderTempelSettings();
  } catch (err) { alert('Opslaan mislukt: ' + err.message); }
};


// ── Facties & Aanzien ──

let _factiesDraft = [];

async function _renderFactiesSettings() {
  const el = _tabEl('facties');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';
  let data = null;
  try { data = await api.getFacties(); } catch {}
  _factiesDraft = (data?.facties || []).map(f => ({
    id: f.id, naam: f.naam, embleem: f.embleem, stijl: f.stijl || '', beschrijving: f.beschrijving,
    rangen: (f.rangen || []).map(r => ({
      naam: r.naam, voordelen: r.voordelen || '', titel: r.titel || '',
      boons: (r.boons || []).map(b => ({ icoon: b.icoon || '', naam: b.naam || '', tekst: b.tekst || '' })),
    })),
    huidigeRang: f.rang?.index ?? 0,
  }));
  _renderFactiesDM();
};

function _renderFactiesDM() {
  const el = _tabEl('facties');
  if (!el) return;
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Facties &amp; Aanzien</div>
      <p class="dm-form-label" style="opacity:.7;margin-bottom:10px">Stel per organisatie de huidige rang van de party in. Bij rang 0 verschijnt er niets op het spelersdashboard.</p>
      ${_factiesDraft.map((f, fi) => `
        <div style="border:1px solid rgba(196,168,122,0.25);border-radius:8px;padding:10px;margin-bottom:10px">
          <div class="dm-form-row" style="gap:6px;align-items:center">
            <input class="dm-input" style="width:48px;text-align:center" value="${esc(f.embleem || '')}" oninput="window._factieEdit(${fi},'embleem',this.value)">
            <input class="dm-input" style="flex:1" placeholder="Naam" value="${esc(f.naam || '')}" oninput="window._factieEdit(${fi},'naam',this.value)">
          </div>
          <input class="dm-input" style="width:100%;margin-top:4px" placeholder="Beschrijving" value="${esc(f.beschrijving || '')}" oninput="window._factieEdit(${fi},'beschrijving',this.value)">
          <div class="dm-form-row" style="margin-top:4px"><label class="dm-form-label">Stijl</label>
            <select class="dm-select" onchange="window._factieEdit(${fi},'stijl',this.value)">
              ${['', 'hout', 'metaal', 'staal'].map(s => `<option value="${s}" ${(f.stijl || '') === s ? 'selected' : ''}>${s ? s : '— standaard —'}</option>`).join('')}
            </select></div>
          <div class="dm-form-row" style="margin-top:8px"><label class="dm-form-label">Huidige rang</label>
            <select class="dm-select" onchange="window._factieSetRang('${esc(f.id)}',this.value)">
              ${f.rangen.map((r, i) => `<option value="${i}" ${i === f.huidigeRang ? 'selected' : ''}>${i}. ${esc(r.naam)}</option>`).join('')}
            </select></div>
          <div class="dm-section-label" style="margin-top:8px">Rangen (aanzien)</div>
          <div id="factie-rangen-${fi}"></div>
          <div class="dm-form-row"><button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._factieRangToevoegen(${fi})">＋ Rang</button></div>
        </div>`).join('')}
      <div class="dm-form-row"><button class="dm-btn dm-btn-primary" onclick="window._factiesSave()">💾 Facties opslaan</button></div>
    </div>`;
  _factiesDraft.forEach((_, fi) => _renderFactieRangen(fi));
};

function _renderFactieRangen(fi) {
  const wrap = document.getElementById(`factie-rangen-${fi}`);
  if (!wrap) return;
  const f = _factiesDraft[fi];
  wrap.innerHTML = (f.rangen || []).map((r, i) => `
    <div style="border:1px solid rgba(196,168,122,0.18);border-radius:6px;padding:6px;margin-bottom:6px">
      <div class="dm-form-row" style="gap:6px;align-items:center;margin-bottom:4px">
        <span style="opacity:.5;width:16px;text-align:right">${i}</span>
        <input class="dm-input" style="width:120px" placeholder="Rangnaam" value="${esc(r.naam || '')}" oninput="window._factieRangEdit(${fi},${i},'naam',this.value)">
        <input class="dm-input" style="flex:1" placeholder="Voordelen (korte regel)" value="${esc(r.voordelen || '')}" oninput="window._factieRangEdit(${fi},${i},'voordelen',this.value)">
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._factieRangVerwijder(${fi},${i})">🗑️</button>
      </div>
      <input class="dm-input" style="width:100%;margin-bottom:4px" placeholder="Titel bij deze rang (optioneel)" value="${esc(r.titel || '')}" oninput="window._factieRangEdit(${fi},${i},'titel',this.value)">
      <div style="padding-left:22px">
        ${(r.boons || []).map((b, bi) => `
          <div class="dm-form-row" style="gap:4px;align-items:center;margin-bottom:3px">
            <input class="dm-input" style="width:42px;text-align:center" placeholder="🎁" value="${esc(b.icoon || '')}" oninput="window._factieBoonEdit(${fi},${i},${bi},'icoon',this.value)">
            <input class="dm-input" style="width:110px" placeholder="Boon" value="${esc(b.naam || '')}" oninput="window._factieBoonEdit(${fi},${i},${bi},'naam',this.value)">
            <input class="dm-input" style="flex:1" placeholder="Wat het doet" value="${esc(b.tekst || '')}" oninput="window._factieBoonEdit(${fi},${i},${bi},'tekst',this.value)">
            <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._factieBoonVerwijder(${fi},${i},${bi})">✕</button>
          </div>`).join('')}
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._factieBoonToevoegen(${fi},${i})">＋ Boon</button>
      </div>
    </div>`).join('') || '<p class="dm-form-label" style="opacity:.6">Geen rangen.</p>';
};

window._factieEdit = (fi, field, v) => { const f = _factiesDraft[fi]; if (f) f[field] = v; };
window._factieRangEdit = (fi, i, field, v) => { const r = _factiesDraft[fi]?.rangen?.[i]; if (r) r[field] = v; };
window._factieRangToevoegen = (fi) => { _factiesDraft[fi]?.rangen.push({ naam: '', voordelen: '', titel: '', boons: [] }); _renderFactieRangen(fi); };
window._factieRangVerwijder = (fi, i) => { _factiesDraft[fi]?.rangen.splice(i, 1); _renderFactieRangen(fi); };
window._factieBoonEdit = (fi, i, bi, field, v) => { const b = _factiesDraft[fi]?.rangen?.[i]?.boons?.[bi]; if (b) b[field] = v; };
window._factieBoonToevoegen = (fi, i) => { const r = _factiesDraft[fi]?.rangen?.[i]; if (r) { (r.boons = r.boons || []).push({ icoon: '', naam: '', tekst: '' }); _renderFactieRangen(fi); } };
window._factieBoonVerwijder = (fi, i, bi) => { _factiesDraft[fi]?.rangen?.[i]?.boons?.splice(bi, 1); _renderFactieRangen(fi); };
window._factieSetRang = async (id, rang) => {
  try { await api.factieSetRang(id, parseInt(rang)); const f = _factiesDraft.find(x => x.id === id); if (f) f.huidigeRang = parseInt(rang); }
  catch (e) { alert(e.message); }
};
window._factiesSave = async () => {
  const payload = _factiesDraft.map(f => ({
    id: f.id, naam: (f.naam || '').trim(), embleem: (f.embleem || '').trim(), stijl: (f.stijl || '').trim(), beschrijving: (f.beschrijving || '').trim(),
    rangen: (f.rangen || []).filter(r => (r.naam || '').trim()).map(r => ({
      naam: r.naam.trim(), voordelen: (r.voordelen || '').trim(), titel: (r.titel || '').trim(),
      boons: (r.boons || []).filter(b => (b.naam || '').trim() || (b.tekst || '').trim())
        .map(b => ({ icoon: (b.icoon || '').trim(), naam: (b.naam || '').trim(), tekst: (b.tekst || '').trim() })),
    })),
  }));
  try { await api.saveFactiesConfig(payload); await _renderFactiesSettings(); }
  catch (e) { alert('Opslaan mislukt: ' + e.message); }
};

window._hbTogglePurse = async () => {
  try {
    await api.togglePartyCurrency();
    await _renderBeursTab();
  } catch (err) { alert('Fout: ' + err.message); }
};

window._hbSavePurse = async () => {
  const fl = Math.max(0, parseInt(document.getElementById('hb-purse-fl')?.value) || 0);
  const kn = Math.max(0, parseInt(document.getElementById('hb-purse-kn')?.value) || 0);
  const cl = Math.max(0, parseInt(document.getElementById('hb-purse-cl')?.value) || 0);
  try {
    await api.patchPartyCurrency({ fl, kn, cl });
    await _renderBeursTab();
  } catch (err) { alert('Fout: ' + err.message); }
};

// ── Geluiden ──────────────────────────────────────────────────────────────────

let _sndOpenPid = null;   // welk speler-panel is momenteel open

// Helpers shared across all Geluiden actions
async function _sndPatch(body) {
  await fetch('/api/sounds', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  window.soundManager?.reloadSounds();
};

async function _sndUploadFile(file) {
  const id = `snd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fd = new FormData();
  fd.append('file', file);
  await fetch(`/api/files/${id}`, { method: 'POST', body: fd });
  return id;
};

async function _sndGetData() {
  const r = await fetch('/api/sounds');
  return r.ok ? r.json() : { standard: { damage: null, healing: null, win: null, loss: null }, emotes: {} };
};

function _sndPlayerData(sounds, pid) {
  const raw = sounds.emotes?.[pid];
  // Support both old flat-array format and new {library, selected} format
  if (!raw || Array.isArray(raw)) return { library: [], selected: [] };
  return { library: raw.library || [], selected: raw.selected || [] };
};

// ── Ambiance broadcast (feature #2) — module-scope zodat ook de regie-balk
// de scènes kan tonen/bedienen, niet alleen de Geluiden-tab. ──
let _ambCache = { scenes: [], actief: null };
async function _refreshAmbCache() {
  try {
    const sd = await _sndGetData();
    _ambCache = { scenes: sd.ambiance?.scenes || [], actief: sd.ambiance?.actief || null };
  } catch { /* houd oude cache */ }
}
async function _ambBroadcast(actief) {
  await fetch('/api/sounds/ambiance', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actief }),
  });
  await _refreshAmbCache();
}
window._ambPlay = async (id) => { await _ambBroadcast(id);   _renderGeluiden(); _renderRegieBalk(); };
window._ambStop = async ()   => { await _ambBroadcast(null); _renderGeluiden(); _renderRegieBalk(); };

async function _renderGeluiden() {
  const el = document.getElementById('dm-geluiden-content');
  if (!el) return;

  let sounds     = { standard: { damage: null, healing: null, win: null, loss: null, nextRound: null, nextTurn: null }, emotes: {}, playerTurn: {} };
  let personages = [];
  try {
    [sounds, personages] = await Promise.all([
      _sndGetData(),
      api.listEntities('personages'),
    ]);
  } catch { /* ok */ }

  // Only player characters
  const spelers = personages.filter(p => p.subtype === 'speler');

  const STANDARD_SLOTS = [
    { key: 'damage',    label: '💥 Schade'         },
    { key: 'healing',   label: '💚 Healing'         },
    { key: 'win',       label: '🏆 Winst'           },
    { key: 'loss',      label: '💀 Verlies'         },
    { key: 'nextRound', label: '🔔 Volgende ronde'  },
    { key: 'nextTurn',  label: '▶ Volgende beurt (standaard)' },
  ];

  const standardRows = STANDARD_SLOTS.map(({ key, label }) => {
    const fileId = sounds.standard?.[key];
    return `
      <div class="dm-sound-row">
        <span class="dm-sound-slot-label">${label}</span>
        <div class="dm-sound-controls">
          ${fileId
            ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" title="Testplay" onclick="window._sndPlay('${fileId}')">▶</button>
               <span class="dm-sound-set">✓ Ingesteld</span>
               <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndRemoveStd('${key}')">${icon('x')}</button>`
            : `<span class="dm-sound-empty">Geen geluid</span>`}
          <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Uploaden">
            ↑ Upload
            <input type="file" accept="audio/*" style="display:none"
              onchange="window._sndUploadStd('${key}', this)">
          </label>
        </div>
      </div>`;
  }).join('');

  const playerBlocks = spelers.map(p => {
    const { library, selected } = _sndPlayerData(sounds, p.id);
    const selCount = selected.filter(Boolean).length;
    const turnFileId = sounds.playerTurn?.[p.id] || null;

    const turnRow = `
      <div class="dm-sound-row" style="margin-bottom:8px">
        <span class="dm-sound-slot-label">▶ Beurtgeluid</span>
        <div class="dm-sound-controls">
          ${turnFileId
            ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" title="Testplay" onclick="window._sndPlay('${turnFileId}')">▶</button>
               <span class="dm-sound-set">✓ Ingesteld</span>
               <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndRemovePlayerTurn('${esc(p.id)}')">${icon('x')}</button>`
            : `<span class="dm-sound-empty">Geen geluid</span>`}
          <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Uploaden">
            ↑ Upload
            <input type="file" accept="audio/*" style="display:none"
              onchange="window._sndUploadPlayerTurn('${esc(p.id)}', this)">
          </label>
        </div>
      </div>`;

    const libraryRows = library.map(item => {
      const isSelected = selected.includes(item.id);
      const canSelect  = isSelected || selCount < 5;
      return `
        <div class="dm-sound-emote-item">
          <label class="dm-sound-emote-check" title="${isSelected ? 'Actief in gevecht' : selCount >= 5 ? 'Max 5 geselecteerd' : 'Selecteren voor gevecht'}">
            <input type="checkbox" ${isSelected ? 'checked' : ''} ${!canSelect ? 'disabled' : ''}
              onchange="window._sndToggleSelect('${esc(p.id)}','${esc(item.id)}',this.checked)">
          </label>
          <input class="dm-input dm-sound-emote-icon" type="text"
            placeholder="🎭" value="${esc(item.icon || '')}"
            title="Icoon (emoji)" maxlength="4"
            onchange="window._sndUpdateIcon('${esc(p.id)}','${esc(item.id)}',this.value)">
          <input class="dm-input dm-sound-emote-label" type="text"
            placeholder="Label…" value="${esc(item.label || '')}"
            onchange="window._sndUpdateLabel('${esc(p.id)}','${esc(item.id)}',this.value)">
          <div class="dm-sound-controls">
            ${item.fileId
              ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" title="Testplay" onclick="window._sndPlay('${esc(item.fileId)}')">▶</button>
                 <span class="dm-sound-set">✓</span>
                 <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndClearFile('${esc(p.id)}','${esc(item.id)}')">${icon('x')}</button>`
              : `<span class="dm-sound-empty">Geen audio</span>`}
            <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Uploaden">
              ↑
              <input type="file" accept="audio/*" style="display:none"
                onchange="window._sndUploadEmote('${esc(p.id)}','${esc(item.id)}',this)">
            </label>
            <button class="dm-btn dm-btn-sm dm-btn-danger" onclick="window._sndDeleteEmote('${esc(p.id)}','${esc(item.id)}')" title="Emote verwijderen">${icon('trash')}</button>
          </div>
        </div>`;
    }).join('');

    const selBadge = selected.filter(Boolean).length;
    const isOpen   = _sndOpenPid === p.id;

    return `
      <div class="dm-sound-player-dropdown" data-pid="${esc(p.id)}">
        <button class="dm-sound-player-summary" onclick="window._sndTogglePlayer('${esc(p.id)}')">
          <span class="dm-sound-arrow">${isOpen ? '▼' : '▶'}</span>
          <span class="dm-sound-player-name">${esc(p.name)}</span>
          <span class="dm-sound-sel-badge">${selBadge}/5 actief</span>
        </button>
        <div class="dm-sound-player-body" ${isOpen ? '' : 'hidden'}>
          ${turnRow}
          ${library.length === 0
            ? `<p class="dm-hint" style="margin:0 0 8px">Nog geen emotes. Voeg er hieronder een toe.</p>`
            : libraryRows}
          <button class="dm-btn dm-btn-sm dm-btn-ghost" style="margin-top:6px"
            onclick="window._sndAddEmote('${esc(p.id)}')" title="Emote toevoegen">+</button>
        </div>
      </div>`;
  }).join('');

  const stdOpen = _sndOpenPid === '__std__';
  // ── Geluidsdecors (ambiance, feature #2) ──
  const amb = sounds.ambiance || { scenes: [], actief: null, volume: 0.5 };
  const ambScenes = (amb.scenes || []).map(s => `
    <div class="dm-amb-scene${amb.actief === s.id ? ' dm-amb-scene--actief' : ''}">
      <input class="dm-amb-label" value="${esc(s.label || '')}" placeholder="Scènenaam"
        onchange="window._ambSetLabel('${esc(s.id)}', this.value)">
      <div class="dm-amb-scene-actions">
        <button class="dm-btn dm-btn-sm dm-btn-ghost" title="Testplay (alleen jij)" onclick="window._sndPlay('${esc(s.fileId)}')">▶</button>
        ${amb.actief === s.id
          ? `<button class="dm-btn dm-btn-sm dm-btn-primary" onclick="window._ambStop()">${icon('square')} Stop</button>`
          : `<button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._ambPlay('${esc(s.id)}')">${icon('play')} Speel</button>`}
        <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._ambDelete('${esc(s.id)}')" title="Verwijderen">${icon('trash')}</button>
      </div>
    </div>`).join('');
  const ambSection = `
    <div class="dm-sound-section">
      <div class="dm-sound-section-title">${icon('volume-2')} Geluidsdecors</div>
      <p class="dm-hint">Speel een sfeerloop bij iedereen. Klinkt vooral op de <strong>tabletmodus</strong> (tafelspeaker); spelers kunnen 'm op hun eigen toestel aanzetten via de dempknop in de header.</p>
      <div class="dm-amb-volume">
        <span class="dm-form-label">Volume</span>
        <input type="range" min="0" max="1" step="0.05" value="${amb.volume ?? 0.5}"
          onchange="window._ambSetVolume(this.value)">
      </div>
      <div class="dm-amb-scenes">${ambScenes || '<p class="dm-hint" style="opacity:.6">Nog geen scènes — voeg er één toe.</p>'}</div>
      <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Audio uploaden">
        ${icon('plus')} Scène toevoegen
        <input type="file" accept="audio/*" style="display:none" onchange="window._ambAddScene(this)">
      </label>
    </div>`;

  // ── Diensten-sfeerloops (feature #2, lokaal per dienst) ──
  const _DIENSTEN = [
    { key: 'herberg',   label: 'De Herberg' },        { key: 'tweespalt', label: 'De Tweespalt' },
    { key: 'gock',      label: 'De Gock' },            { key: 'ursula',    label: 'Madame Ursula' },
    { key: 'tempel',    label: 'De Tempel' },          { key: 'heeren',    label: 'Heeren van de Nacht' },
  ];
  const svcAmb = sounds.serviceAmbiance || {};
  const svcRows = _DIENSTEN.map(d => {
    const fid = svcAmb[d.key];
    return `
      <div class="dm-sound-row">
        <span class="dm-sound-slot-label">${d.label}</span>
        <div class="dm-sound-controls">
          ${fid
            ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" title="Testplay" onclick="window._sndPlay('${esc(fid)}')">▶</button>
               <span class="dm-sound-set">✓ Ingesteld</span>
               <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._svcAmbRemove('${d.key}')">${icon('x')}</button>`
            : `<span class="dm-sound-empty">Geen loop</span>`}
          <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Uploaden">
            ↑ Upload
            <input type="file" accept="audio/*" style="display:none" onchange="window._svcAmbUpload('${d.key}', this)">
          </label>
        </div>
      </div>`;
  }).join('');
  const svcSection = `
    <div class="dm-sound-section">
      <div class="dm-sound-section-title">${icon('volume-2')} Diensten-sfeerloops</div>
      <p class="dm-hint">Een sfeerloop per dienst die <strong>lokaal</strong> speelt zodra iemand die dienst opent — los van een sessie, geen tablet nodig. Een lopende broadcast-scène heeft voorrang.</p>
      <div class="dm-sound-list">${svcRows}</div>
    </div>`;

  el.innerHTML = `
    ${ambSection}
    ${svcSection}
    <div class="dm-sound-section">
      <div class="dm-sound-section-title">🎭 Spelersemotes</div>
      <p class="dm-hint">Stel per speler een beurtgeluid in en maak een emotebibliotheek. Selecteer max. 5 emotes voor gevecht (✓ = actief).</p>
      ${spelers.length === 0
        ? `<p class="dm-hint" style="opacity:.6">Geen spelers-personages gevonden (subtype = speler).</p>`
        : playerBlocks}
    </div>
    <div class="dm-sound-section">
      <div class="dm-sound-player-dropdown" data-pid="__std__">
        <button class="dm-sound-player-summary" onclick="window._sndTogglePlayer('__std__')">
          <span class="dm-sound-arrow">${stdOpen ? '▼' : '▶'}</span>
          <span class="dm-sound-player-name">🔊 Standaardgeluiden</span>
        </button>
        <div class="dm-sound-player-body" ${stdOpen ? '' : 'hidden'}>
          <p class="dm-hint" style="margin:0 0 8px">Automatisch afgespeeld bij HP-wijzigingen, beurtwisseling en gevecht-einde.</p>
          <div class="dm-sound-list">${standardRows}</div>
        </div>
      </div>
    </div>`;

  // ── Window-handlers ─────────────────────────────────────────────────────────

  window._sndTogglePlayer = (pid) => {
    _sndOpenPid = (_sndOpenPid === pid) ? null : pid;
    // Toggle zonder re-render: wissel zichtbaarheid direct
    document.querySelectorAll('.dm-sound-player-dropdown').forEach(el => {
      const p    = el.dataset.pid;
      const open = p === _sndOpenPid;
      el.querySelector('.dm-sound-player-body').hidden = !open;
      el.querySelector('.dm-sound-arrow').textContent  = open ? '▼' : '▶';
    });
  };

  window._sndPlay = (fileId) => {
    new Audio(`/api/files/${fileId}`).play().catch(() => {});
  };

  // ── Geluidsdecors (ambiance, feature #2) — scènebeheer ──
  // (_ambBroadcast / _ambPlay / _ambStop staan op module-scope, zie boven.)
  window._ambAddScene = async (input) => {
    const file = input.files[0]; if (!file) return;
    const fileId = await _sndUploadFile(file);
    const sd  = await _sndGetData();
    const amb = sd.ambiance || { scenes: [], volume: 0.5 };
    const scene = { id: `amb_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      label: file.name.replace(/\.[^.]+$/, ''), fileId };
    await _sndPatch({ ambiance: { scenes: [...(amb.scenes || []), scene], volume: amb.volume ?? 0.5 } });
    _renderGeluiden();
  };
  window._ambSetLabel = async (id, value) => {
    const sd = await _sndGetData();
    const scenes = (sd.ambiance?.scenes || []).map(s => s.id === id ? { ...s, label: value } : s);
    await _sndPatch({ ambiance: { scenes, volume: sd.ambiance?.volume ?? 0.5 } });
  };
  window._ambDelete = async (id) => {
    if (!confirm('Deze scène verwijderen?')) return;
    const sd = await _sndGetData();
    if (sd.ambiance?.actief === id) await _ambBroadcast(null);
    const scenes = (sd.ambiance?.scenes || []).filter(s => s.id !== id);
    await _sndPatch({ ambiance: { scenes, volume: sd.ambiance?.volume ?? 0.5 } });
    _renderGeluiden();
  };
  window._ambSetVolume = async (v) => {
    const sd = await _sndGetData();
    await _sndPatch({ ambiance: { scenes: sd.ambiance?.scenes || [], volume: parseFloat(v) } });
    if (sd.ambiance?.actief) await _ambBroadcast(sd.ambiance.actief); // live volume toepassen
  };

  // ── Diensten-sfeerloops (feature #2) ──
  window._svcAmbUpload = async (key, input) => {
    const file = input.files[0]; if (!file) return;
    const fileId = await _sndUploadFile(file);
    await _sndPatch({ serviceAmbiance: { [key]: fileId } });
    _renderGeluiden();
  };
  window._svcAmbRemove = async (key) => {
    await _sndPatch({ serviceAmbiance: { [key]: null } });
    _renderGeluiden();
  };

  window._sndUploadStd = async (key, input) => {
    const file = input.files[0]; if (!file) return;
    const fileId = await _sndUploadFile(file);
    await _sndPatch({ standard: { [key]: fileId } });
    _renderGeluiden();
  };

  window._sndRemoveStd = async (key) => {
    await _sndPatch({ standard: { [key]: null } });
    _renderGeluiden();
  };

  window._sndUploadPlayerTurn = async (pid, input) => {
    _sndOpenPid = pid;
    const file = input.files[0]; if (!file) return;
    const fileId = await _sndUploadFile(file);
    await _sndPatch({ playerTurn: { [pid]: fileId } });
    _renderGeluiden();
  };

  window._sndRemovePlayerTurn = async (pid) => {
    _sndOpenPid = pid;
    await _sndPatch({ playerTurn: { [pid]: null } });
    _renderGeluiden();
  };

  window._sndAddEmote = async (pid) => {
    _sndOpenPid = pid;   // blijf open na re-render
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    const newItem = { id: `em_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, label: '', fileId: null };
    await _sndPatch({ emotes: { [pid]: { library: [...library, newItem], selected } } });
    _renderGeluiden();
  };

  window._sndDeleteEmote = async (pid, eid) => {
    _sndOpenPid = pid;
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    await _sndPatch({ emotes: { [pid]: {
      library:  library.filter(e => e.id !== eid),
      selected: selected.filter(id => id !== eid),
    }}});
    _renderGeluiden();
  };

  window._sndToggleSelect = async (pid, eid, checked) => {
    _sndOpenPid = pid;
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    let newSel = selected.filter(id => id !== eid);
    if (checked) {
      if (newSel.length >= 5) { _renderGeluiden(); return; }
      newSel.push(eid);
    }
    await _sndPatch({ emotes: { [pid]: { library, selected: newSel } } });
    _renderGeluiden();
  };

  window._sndUpdateLabel = async (pid, eid, label) => {
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    await _sndPatch({ emotes: { [pid]: {
      library:  library.map(e => e.id === eid ? { ...e, label } : e),
      selected,
    }}});
  };

  window._sndUpdateIcon = async (pid, eid, icon) => {
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    await _sndPatch({ emotes: { [pid]: {
      library:  library.map(e => e.id === eid ? { ...e, icon } : e),
      selected,
    }}});
  };

  window._sndUploadEmote = async (pid, eid, input) => {
    _sndOpenPid = pid;
    const file = input.files[0]; if (!file) return;
    const fileId = await _sndUploadFile(file);
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    await _sndPatch({ emotes: { [pid]: {
      library:  library.map(e => e.id === eid ? { ...e, fileId } : e),
      selected,
    }}});
    _renderGeluiden();
  };

  window._sndClearFile = async (pid, eid) => {
    _sndOpenPid = pid;
    const sd = await _sndGetData();
    const { library, selected } = _sndPlayerData(sd, pid);
    await _sndPatch({ emotes: { [pid]: {
      library:  library.map(e => e.id === eid ? { ...e, fileId: null } : e),
      selected,
    }}});
    _renderGeluiden();
  };
};

// DM panel Gevecht tab — setup fase
function _renderGevecht() {
  const el = document.getElementById('dm-gevecht-content');
  if (!el) return;

  if (!_combatLoaded) {
    el.innerHTML = `<div class="dm-feature-section"><p class="dm-hint">Laden…</p></div>`;
    return;
  }

  if (_combat?.active) {
    el.innerHTML = `
      <div class="dm-feature-section">
        <p class="dm-hint">${icon('swords')} Combat active — Round ${_combat.round}. The combat screen is visible to everyone.</p>
        <button class="dm-btn dm-btn-danger" onclick="window.dmPanel.combatEnd()" title="End combat">${icon('x')}</button>
      </div>
    `;
    return;
  }

  const cs = _combat?.combatants || [];
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-section-label">Deelnemers</div>
      ${cs.length === 0 ? `<p class="dm-hint">Nog geen deelnemers toegevoegd.</p>` : `
        <div class="dm-setup-list">
          ${cs.map(c => `
            <div class="dm-setup-row">
              <span class="dm-combatant-type-dot ${c.type === 'player' ? 'dm-type-player' : c.type === 'ally' ? 'dm-type-ally' : c.type === 'summon' ? 'dm-type-summon' : 'dm-type-monster'}"></span>
              <span class="dm-setup-name">${esc(c.name)}</span>
              <span class="dm-setup-meta">
                Init <input class="dm-setup-init-input" type="number" value="${c.initiative}"
                  onchange="window.dmPanel.setupInitChange('${esc(c.id)}', this.value)"
                  style="width:44px">
                · ${c.hp}/${c.maxHp} HP
              </span>
              <button class="dm-combatant-remove" onclick="window.dmPanel.combatRemove('${esc(c.id)}')">${icon('x')}</button>
            </div>
          `).join('')}
        </div>
      `}
      <div class="dm-setup-form">
        <div class="dm-feature-row">
          <select id="dm-setup-type" class="dm-select dm-select-sm"
              onchange="window.dmPanel.setupTypeChange(this.value)">
            <option value="monster"   ${_setupSelectedType === 'monster'   ? 'selected' : ''}>Monster</option>
            <option value="summon"    ${_setupSelectedType === 'summon'    ? 'selected' : ''}>Summon</option>
            <option value="ally"      ${_setupSelectedType === 'ally'      ? 'selected' : ''}>Medestander</option>
            <option value="player"    ${_setupSelectedType === 'player'    ? 'selected' : ''}>Speler</option>
          </select>
        </div>
        ${_setupSelectedType === 'monster' && _monsters.length > 0 ? `
          <select id="dm-setup-preset" class="dm-select"
              onchange="window.dmPanel.setupPresetChange(this.value)">
            <option value="">— Handmatig invoeren —</option>
            ${_monsters.map(m => `<option value="${esc(m.id)}" ${_setupSelectedPresetId === m.id ? 'selected' : ''}>${esc(m.name)} (HP ${m.maxHp})</option>`).join('')}
          </select>
        ` : ''}
        ${_setupSelectedType === 'player' && _setupPersonages.some(e => e.subtype === 'speler' && (!window._activeGroupId || e.data?.groep === window._activeGroupId)) ? `
          <select id="dm-setup-entity" class="dm-select"
              onchange="window.dmPanel.setupEntityChange(this.value)">
            <option value="">— Handmatig invoeren —</option>
            ${_setupPersonages.filter(e => e.subtype === 'speler' && (!window._activeGroupId || e.data?.groep === window._activeGroupId)).map(e => `<option value="${esc(e.id)}" ${_setupSelectedEntityId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        ` : ''}
        ${_setupSelectedType === 'ally' && _setupPersonages.some(e => e.stats && Object.values(e.stats).some(v => v !== null && v !== undefined && String(v).trim() !== '')) ? `
          <select id="dm-setup-entity" class="dm-select"
              onchange="window.dmPanel.setupEntityChange(this.value)">
            <option value="">— Handmatig invoeren —</option>
            ${_setupPersonages
              .filter(e => e.stats && Object.values(e.stats).some(v => v !== null && v !== undefined && String(v).trim() !== ''))
              .map(e => `<option value="${esc(e.id)}" ${_setupSelectedEntityId === e.id ? 'selected' : ''}>${esc(e.name)}${e.stats?.hp ? ' (HP ' + e.stats.hp + ')' : ''}</option>`)
              .join('')}
          </select>
        ` : ''}
        <div class="dm-feature-row">
          <input id="dm-setup-name" class="dm-input" placeholder="Naam…"
            onkeydown="if(event.key==='Enter')window.dmPanel.setupAddSubmit()">
        </div>
        <div class="dm-feature-row">
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Init</span>
            <input id="dm-setup-init" class="dm-input dm-input-sm" type="number" value="10" style="width:52px">
          </label>
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Max HP</span>
            <input id="dm-setup-maxhp" class="dm-input dm-input-sm" type="number" value="10" style="width:52px">
          </label>
          <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.dmPanel.setupAddSubmit()" title="Toevoegen">+</button>
        </div>
      </div>
      <div class="dm-feature-row" style="margin-top:8px">
        ${cs.length > 0 ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.setupReset()" title="Reset">↺</button>` : ''}
        <button class="dm-btn dm-btn-primary" style="margin-left:auto"
          onclick="window.dmPanel.combatStart()" ${cs.length === 0 ? 'disabled' : ''} title="Start gevecht">${icon('swords')}</button>
      </div>
    </div>

    <div class="dm-feature-section" style="margin-top:4px;border-top:1px solid rgba(196,168,122,0.25);padding-top:12px">
      <div class="dm-section-label">${icon('moon')} Rust</div>
      <div class="dm-feature-row" style="gap:8px;align-items:center;flex-wrap:wrap">
        <button class="dm-btn dm-btn-ghost" onclick="window._dmLangeRust()" title="Lange rust — herlaadt alle item-charges">${icon('moon')}</button>
        <span id="dm-rust-status" style="font-size:11px;color:#6a9050"></span>
      </div>
    </div>
  `;

  window._dmLangeRust = async function() {
    const statusEl = document.getElementById('dm-rust-status');
    try {
      const r = await api.partyLongRest();
      if (statusEl) {
        let msg = `✓ Lange rust uitgevoerd (${r.resetCount} charges herladen)`;
        if (r.rollLog && r.rollLog.length) {
          msg += ' — Dobbelrollen: ' + r.rollLog.map(e =>
            `${e.charName} / ${e.itemName}: +${e.rolled} → ${e.newCharges}/${e.max}`
          ).join(', ');
        }
        statusEl.textContent = msg;
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 8000);
      }
    } catch(err) {
      if (statusEl) statusEl.textContent = 'Fout: ' + (err.message || '?');
    }
  };
};

// ── Detail-panel: klik op portret ────────────────────────────────────────────

function _combatSelectCombatant(id) {
  _selectedCombatantId = id || null;
  const panel = document.getElementById('co-detail-panel');
  if (!panel) return;
  if (!id) { panel.classList.add('hidden'); return; }

  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) { panel.classList.add('hidden'); return; }

  const isDM = window.app?.isDM?.();
  const hp    = hpStatus(c.hp, c.maxHp);
  const hpPct = c.maxHp > 0 ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;

  const CLASS_CONDS = new Set(['bardic-inspiration','tides-of-chaos','twilight-sanctuary','patient-defense','steady-aim','vigilant-blessing','blessed']);
  const stdConds   = CONDITIONS.filter(x => !CLASS_CONDS.has(x.id));
  const classConds = CONDITIONS.filter(x =>  CLASS_CONDS.has(x.id));
  const _pickBtn = (cond) => {
    const active   = (c.conditions || []).includes(cond.id);
    const isClass  = CLASS_CONDS.has(cond.id);
    return `<button class="co-cond-pick${active ? ' active' : ''}${isClass ? ' co-cond-class' : ''}"
      onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cond.id}')"
      title="${esc(cond.desc)}">${esc(cond.label)}</button>`;
  };
  const condPicker = [
    ...stdConds.map(_pickBtn),
    `<div class="co-cond-divider"></div>`,
    ...classConds.map(_pickBtn),
  ].join('');

  const isDying = (c.hp || 0) <= 0 && c.type === 'player';
  const ds = c.deathSaves || { successes: 0, failures: 0 };
  const deathSaves = isDying ? `
    <div class="co-death-saves" style="margin-top:4px">
      <span class="co-ds-label">Death saves</span>
      <div class="co-ds-track">
        ${[0,1,2].map(i => `<span class="co-ds-dot${i < ds.successes ? ' co-ds-s' : ''}">●</span>`).join('')}
        <span class="co-ds-sep">·</span>
        ${[0,1,2].map(i => `<span class="co-ds-dot${i < ds.failures  ? ' co-ds-f' : ''}">●</span>`).join('')}
      </div>
      <button class="co-ds-btn co-ds-yes" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','success')">${icon('check')}</button>
      <button class="co-ds-btn co-ds-no"  onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','failure')">${icon('x')}</button>
      <button class="co-ds-btn co-ds-rst" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','reset')">↺</button>
    </div>` : '';

  const presetMonster = c.presetId ? _monsters.find(x => x.id === c.presetId) : null;
  const hasStatblock = _hasStatblock(presetMonster) || _hasStatblock({ statblock: c.statblock });

  panel.innerHTML = `
    <div class="co-detail-name">
      <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}" style="width:10px;height:10px;flex-shrink:0"></span>
      ${esc(c.name)}
      ${isDM ? `
        <label class="co-init-wrap" style="margin-left:8px;font-size:11px">Init
          <input class="co-init-input" type="number" value="${c.initiative}"
            onchange="window.dmPanel.combatInitChange('${esc(c.id)}',this.value)" style="width:44px">
        </label>
        ${hasStatblock ? `<button class="co-statblock-btn" onclick="window.dmPanel.combatStatblock('${esc(c.id)}')" title="Statblock">${icon('clipboard-list')}</button>` : ''}
        <button class="co-remove-btn" onclick="window.dmPanel.combatRemove('${esc(c.id)}');window.dmPanel.combatSelectCombatant(null)" title="Verwijder">${icon('x')}</button>
      ` : ''}
      <button class="co-detail-close" onclick="window.dmPanel.combatSelectCombatant(null)">${icon('x')}</button>
    </div>
    <div class="co-hp-row">
      <button class="co-hp-btn" onclick="window.dmPanel.${isDM ? 'combatHpChange' : 'playerHpChange'}('${esc(c.id)}',-1)">−</button>
      <div class="co-hp-bar-wrap"><div class="co-hp-bar ${hp.cls}" style="width:${hpPct}%"></div></div>
      <input class="co-hp-input" type="number" value="${c.hp}"
        onchange="window.dmPanel.${isDM ? 'combatHpInput' : 'playerHpInput'}('${esc(c.id)}',this.value)">
      <span class="co-hp-max">/${c.maxHp}</span>
      <button class="co-hp-btn" onclick="window.dmPanel.${isDM ? 'combatHpChange' : 'playerHpChange'}('${esc(c.id)}',1)">+</button>
    </div>
    ${isDM ? `
    <div class="co-dmg-row">
      <input id="co-dmg-input-${esc(c.id)}" class="co-dmg-input" type="number" min="0"
        onkeydown="if(event.key==='Enter')window.dmPanel.combatApplyDamage('${esc(c.id)}')">
      <button class="co-ctrl-btn co-ctrl-danger" onclick="window.dmPanel.combatApplyDamage('${esc(c.id)}')" title="Schade toepassen">${icon('sword')} Schade</button>
      <button class="co-ctrl-btn co-ctrl-heal" onclick="window.dmPanel.combatApplyHeal('${esc(c.id)}')" title="Genezen">+ Genezen</button>
    </div>
    <div class="co-thp-row">
      <span class="co-thp-label" title="Temporary HP">${icon('shield')}</span>
      <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',-1)">−</button>
      <input class="co-thp-input" type="number" min="0" value="${c.tempHp || 0}"
        onchange="window.dmPanel.combatThpInput('${esc(c.id)}',this.value)">
      <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',1)">+</button>
    </div>
    <div class="co-cond-picker">${condPicker}</div>
    ` : `
    ${(c.conditions || []).length ? `<div class="co-active-conds">${(c.conditions || []).map(cid => {
      const cond = CONDITIONS.find(x => x.id === cid);
      const isClass = CLASS_CONDS.has(cid);
      return cond ? `<span class="co-cond-chip${isClass ? ' co-cond-chip--class' : ''}" title="${esc(cond.desc)}">${esc(cond.label)}</span>` : '';
    }).join('')}</div>` : ''}
    `}
    ${deathSaves}
  `;
  panel.classList.remove('hidden');
};

// Combat overlay — zichtbaar voor iedereen tijdens gevecht
function _renderCombatOverlay(combat, startMinimized = false) {
  const overlay = document.getElementById('combat-overlay');
  if (!overlay) return;

  if (!combat?.active) {
    overlay.classList.add('hidden');
    overlay.classList.remove('minimized');
    overlay.querySelector('.co-backdrop-el')?.remove();
    overlay.classList.remove('co-has-backdrop');
    return;
  }
  const wasHidden = overlay.classList.contains('hidden');
  overlay.classList.remove('hidden');

  const isDM   = window.app?.isDM?.();

  // DM ziet altijd het volledige scherm; spelers starten geminimaliseerd
  if (isDM) {
    overlay.classList.remove('minimized');
  } else if (startMinimized && !overlay.classList.contains('minimized')) {
    overlay.classList.add('minimized');
  }

  // Stop canvas loop before rebuilding DOM
  canvasStop();

  const inner = document.getElementById('combat-modal-inner');
  if (!inner) return;
  const cs        = combat.combatants;
  const turn      = combat.currentTurn;
  const current   = cs[turn];
  const turnGroup = _getTurnGroup(cs, turn);
  const groupNames = turnGroup.map(i => cs[i]?.name).filter(Boolean);
  const currentLabel = groupNames.length > 1 ? groupNames.join(' + ') : (current?.name || '—');

  // Compute initiative groups for visual grouping
  const initGroups = new Map();
  cs.forEach((c, i) => {
    const key = c.initiative;
    if (!initGroups.has(key)) initGroups.set(key, []);
    initGroups.get(key).push(i);
  });

  const rows = cs.map((c, i) => {
    const isActive = turnGroup.includes(i);
    const hp    = hpStatus(c.hp, c.maxHp);
    const hpPct = c.maxHp > 0 ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
    const _CC = new Set(['bardic-inspiration','tides-of-chaos','twilight-sanctuary','patient-defense','steady-aim','vigilant-blessing','blessed']);

    // Concentration and initiative grouping
    const hasConc = (c.conditions || []).includes('concentration');
    const groupIndices = initGroups.get(c.initiative) || [i];
    const isGroupFirst = groupIndices.length > 1 && groupIndices[0] === i;
    const isGroupLast  = groupIndices.length > 1 && groupIndices[groupIndices.length - 1] === i;
    const isGroupMid   = groupIndices.length > 1 && !isGroupFirst && !isGroupLast;
    const groupClass   = isGroupFirst ? ' co-row--group-first' : isGroupLast ? ' co-row--group-last' : isGroupMid ? ' co-row--group-mid' : '';
    const concClass    = hasConc ? ' co-row--concentrating' : '';
    const conds = (c.conditions || []).map(cid => {
      const cond = CONDITIONS.find(x => x.id === cid);
      const isClass = _CC.has(cid);
      return cond
        ? `<span class="co-cond-chip${isClass ? ' co-cond-chip--class' : ''}${isDM ? ' co-cond-dm' : ''}" title="${esc(cond.desc)}"
            ${isDM ? `onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cid}')"` : ''}
           >${esc(cond.label)}${isDM ? ' '+icon('x') : ''}</span>`
        : '';
    }).join('');

    if (isDM) {
      const condPicker = [
        ...CONDITIONS.filter(x => !_CC.has(x.id)).map(cond => {
          const active = (c.conditions || []).includes(cond.id);
          return `<button class="co-cond-pick${active ? ' active' : ''}"
            onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cond.id}')"
            title="${esc(cond.desc)}">${esc(cond.label)}</button>`;
        }),
        `<div class="co-cond-divider"></div>`,
        ...CONDITIONS.filter(x => _CC.has(x.id)).map(cond => {
          const active = (c.conditions || []).includes(cond.id);
          return `<button class="co-cond-pick co-cond-class${active ? ' active' : ''}"
            onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cond.id}')"
            title="${esc(cond.desc)}">${esc(cond.label)}</button>`;
        }),
      ].join('');

      return `
        <div class="co-row${isActive ? ' co-row-active' : ''}${concClass}${groupClass}">
          <div class="co-row-head">
            <span class="co-turn-num">${i + 1}</span>
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}"></span>
            <span class="co-name">${isActive ? '▶ ' : ''}${esc(c.name)}</span>${hasConc ? '<span class="co-conc-badge" title="Concentratie actief">🔮</span>' : ''}
            <label class="co-init-wrap">Init
              <input class="co-init-input" type="number" value="${c.initiative}"
                onchange="window.dmPanel.combatInitChange('${esc(c.id)}',this.value)"
                onclick="event.stopPropagation()">
            </label>
            <button class="co-remove-btn" onclick="window.dmPanel.combatRemove('${esc(c.id)}')">${icon('x')}</button>
          </div>
          <div class="co-hp-row">
            <button class="co-hp-btn" onclick="window.dmPanel.combatHpChange('${esc(c.id)}',-1)">−</button>
            <div class="co-hp-bar-wrap"><div class="co-hp-bar ${hp.cls}" style="width:${hpPct}%"></div></div>
            <input class="co-hp-input" type="number" value="${c.hp}"
              onchange="window.dmPanel.combatHpInput('${esc(c.id)}',this.value)"
              onclick="event.stopPropagation()">
            <span class="co-hp-max">/${c.maxHp}</span>
            <button class="co-hp-btn" onclick="window.dmPanel.combatHpChange('${esc(c.id)}',1)">+</button>
          </div>
          <div class="co-thp-row">
            <span class="co-thp-label" title="Temporary Hit Points">${icon('shield')}</span>
            <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',-1)">−</button>
            <input class="co-thp-input" type="number" min="0" value="${c.tempHp || 0}"
              onchange="window.dmPanel.combatThpInput('${esc(c.id)}',this.value)"
              onclick="event.stopPropagation()">
            <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',1)">+</button>
          </div>
          ${c.type === 'player' && (c.hp || 0) <= 0 ? (() => {
            const ds = c.deathSaves || { successes: 0, failures: 0 };
            const succDots = [0,1,2].map(i =>
              `<span class="co-ds-dot${i < ds.successes ? ' co-ds-s' : ''}">●</span>`).join('');
            const failDots = [0,1,2].map(i =>
              `<span class="co-ds-dot${i < ds.failures  ? ' co-ds-f' : ''}">●</span>`).join('');
            return `
              <div class="co-death-saves">
                <span class="co-ds-label">Death saves</span>
                <div class="co-ds-track">${succDots}<span class="co-ds-sep">·</span>${failDots}</div>
                <button class="co-ds-btn co-ds-yes" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','success')" title="Success">${icon('check')}</button>
                <button class="co-ds-btn co-ds-no"  onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','failure')" title="Failure">${icon('x')}</button>
                <button class="co-ds-btn co-ds-rst" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','reset')"   title="Reset">↺</button>
              </div>`;
          })() : ''}
          ${conds ? `<div class="co-active-conds">${conds}</div>` : ''}
          <details class="co-cond-picker-wrap">
            <summary class="co-cond-toggle">Conditions</summary>
            <div class="co-cond-picker">${condPicker}</div>
          </details>
        </div>
      `;
    } else {
      // Bepaal of dit de eigen combatant van de ingelogde speler is
      const myCharId  = window.app?.state?.characterId;
      const myName    = window.app?.state?.playerName;
      const isOwnChar = myCharId
        ? (c.entityId === myCharId)
        : (myName && c.name === myName);

      if (isOwnChar) {
        // Eigen combatant: toon bewerkbare HP-controls
        return `
          <div class="co-row${isActive ? ' co-row-active' : ''}${concClass}${groupClass} co-row-own">
            <div class="co-row-head">
              <span class="co-turn-num">${i + 1}</span>
              <span class="co-type-dot co-type-player"></span>
              <span class="co-name">${isActive ? '▶ ' : ''}${esc(c.name)} <span class="co-own-badge">jij</span></span>
              <span class="co-init-display">Init ${c.initiative}</span>
            </div>
            <div class="co-hp-row">
              <button class="co-hp-btn" onclick="window.dmPanel.playerHpChange('${esc(c.id)}',-1)">−</button>
              <div class="co-hp-bar-wrap"><div class="co-hp-bar ${hp.cls}" style="width:${hpPct}%"></div></div>
              <input class="co-hp-input" type="number" value="${c.hp}"
                onchange="window.dmPanel.playerHpInput('${esc(c.id)}',this.value)"
                onclick="event.stopPropagation()">
              <span class="co-hp-max">/${c.maxHp}</span>
              <button class="co-hp-btn" onclick="window.dmPanel.playerHpChange('${esc(c.id)}',1)">+</button>
            </div>
            ${(c.tempHp || 0) > 0 ? `<div class="co-hp-player-row"><span class="co-thp-badge" title="Temporary Hit Points">${icon('shield')} +${c.tempHp}</span></div>` : ''}
            ${conds ? `<div class="co-active-conds">${conds}</div>` : ''}
          </div>
        `;
      }

      // Andere combatants: alleen balk + status + conditions
      return `
        <div class="co-row${isActive ? ' co-row-active' : ''}${concClass}${groupClass}">
          <div class="co-row-head">
            <span class="co-turn-num">${i + 1}</span>
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}"></span>
            <span class="co-name">${isActive ? '▶ ' : ''}${esc(c.name)}</span>
            <span class="co-init-display">Init ${c.initiative}</span>
          </div>
          <div class="co-hp-player-row">
            <span class="co-hp-status-dot co-hp-dot-${hp.cls}"></span>
            <span class="co-hp-label ${hp.cls}">${hp.label}</span>
            ${(c.tempHp || 0) > 0 ? `<span class="co-thp-badge" title="Temporary Hit Points">${icon('shield')} +${c.tempHp}</span>` : ''}
            ${conds ? `<span class="co-conds">${conds}</span>` : ''}
          </div>
        </div>
      `;
    }
  }).join('');

  // Sla gevecht op voor tab-switching na re-renders
  _lastCombat = combat;

  const _coLog = (combat.log?.length > 0) ? `
    <details class="co-log">
      <summary class="co-log-summary">📜 Gevechtslog (${combat.log.length})</summary>
      <div class="co-log-entries" id="co-log-entries">
        ${[...combat.log].slice(-30).map(e =>
          `<div class="co-log-entry"><span class="co-log-round">R${e.round}</span> ${esc(e.text)}</div>`
        ).join('')}
      </div>
    </details>` : '';

  // Backdrop voor de gevechtsoverlay (encounter backdrop)
  // Zet de afbeelding als achtergrond van de overlay zelf (meerdere CSS-lagen),
  // zodat hij achter de modal zichtbaar is en niet erdoorheen zweeft.
  // Backdrop via een apart DOM-element (z-index: -1) zodat het CSS-stacking correct is
  // en Ken Burns via CSS transform kan draaien zonder de modal te raken.
  overlay.querySelector('.co-backdrop-el')?.remove();
  overlay.style.background = ''; // verwijder eventuele inline stijl uit oude aanpak
  const coBackdropId = combat.backdropId || null;
  if (coBackdropId) {
    const bd = document.createElement('div');
    bd.className = 'co-backdrop-el';
    bd.style.backgroundImage = `url('${api.fileUrl(coBackdropId)}')`;
    overlay.insertBefore(bd, overlay.firstChild);
    overlay.classList.add('co-has-backdrop');
  } else {
    overlay.classList.remove('co-has-backdrop');
  }

  inner.innerHTML = `
    <div class="co-header">
      <span class="co-title">${icon('swords')} Gevecht</span>
      <span class="co-round">Ronde ${combat.round}</span>
      <span class="co-current-name">▶ ${esc(currentLabel)}</span>
      <button class="co-minimize-btn" onclick="document.getElementById('combat-overlay').classList.contains('minimized')?window.dmPanel.combatExpand():window.dmPanel.combatMinimize()" title="Minimaliseren/maximaliseren">▼</button>
      ${isDM ? `<button class="co-end-btn" onclick="event.stopPropagation();window.dmPanel.combatEnd()" title="Gevecht beëindigen">${icon('x')}</button>` : ''}
    </div>
    ${isDM ? `
      <canvas id="combat-canvas" class="co-canvas"></canvas>
      <div class="co-turn-controls">
        ${!combat.winner ? `
          <button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatPrevTurn()" title="Vorige beurt">${icon('chevron-left')}</button>
          <button class="co-ctrl-btn co-ctrl-primary" onclick="window.dmPanel.combatNextTurn()" title="Volgende beurt">${icon('chevron-right')}</button>
        ` : ''}
        <button class="co-ctrl-btn co-win-btn"  onclick="window.dmPanel.combatSetWinner('players')"  title="Spelers winnen" style="${combat.winner === 'players'  ? 'opacity:1' : 'opacity:0.55'}">🏆</button>
        <button class="co-ctrl-btn co-lose-btn" onclick="window.dmPanel.combatSetWinner('monsters')" title="Monsters winnen" style="${combat.winner === 'monsters' ? 'opacity:1' : 'opacity:0.55'}">${icon('skull')}</button>
        ${combat.winner ? `<button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatSetWinner(null)" title="Reset winnaar" style="margin-left:4px">${icon('refresh-cw')}</button>` : ''}
        <button class="co-ctrl-btn co-ctrl-ghost co-add-btn" onclick="window.dmPanel.combatAddForm()" style="margin-left:auto" title="Deelnemer toevoegen">${icon('plus')}</button>
      </div>
      <div id="co-add-form" class="co-add-form hidden">
        <div class="co-add-row">
          <select id="co-add-type" class="co-select" onchange="window.dmPanel.combatAddTypeChange(this.value)">
            <option value="monster">Monster</option>
            <option value="summon">Summon</option>
            <option value="ally">Medestander</option>
            <option value="player">Speler</option>
          </select>
          <button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatAddCancel()">${icon('x')}</button>
        </div>
        ${_monsters.length > 0 ? `
        <div id="co-add-preset-row" class="co-add-row">
          <select id="co-add-preset" class="co-select" style="flex:1" onchange="window.dmPanel.combatAddPresetChange(this.value)">
            <option value="">— Handmatig invoeren —</option>
            ${_monsters.map(m => `<option value="${esc(m.id)}">${esc(m.name)} (HP ${m.maxHp})</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="co-add-row">
          <input id="co-add-name" class="co-input" placeholder="Naam…"
            onkeydown="if(event.key==='Enter')window.dmPanel.combatAddSubmit()">
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Init</span>
            <input id="co-add-init" class="co-input co-input-sm" type="number" value="10">
          </label>
          <label class="dm-labeled-input">
            <span class="dm-input-lbl">Max HP</span>
            <input id="co-add-maxhp" class="co-input co-input-sm" type="number" value="10">
          </label>
          <button class="co-ctrl-btn co-ctrl-primary" onclick="window.dmPanel.combatAddSubmit()" title="Toevoegen">${icon('plus')}</button>
        </div>
      </div>
      <div id="co-detail-panel" class="co-detail-panel hidden"></div>
      <div id="co-dm-emote-bar" class="co-emote-bar"></div>
      ${_coLog}
    ` : `
      <!-- Speler: tabbladen in de gevechtsoverlay -->
      <div class="co-tabs" id="co-tabs">
        <button class="co-tab${_combatOverlayTab==='gevecht'?' active':''}" data-tab="gevecht" onclick="window._setCombatOverlayTab('gevecht')">${icon('swords')} Gevecht</button>
        <button class="co-tab${_combatOverlayTab==='personage'?' active':''}" data-tab="personage" onclick="window._setCombatOverlayTab('personage')">📖 Stats</button>
        <button class="co-tab${_combatOverlayTab==='spreuken'?' active':''}" data-tab="spreuken" onclick="window._setCombatOverlayTab('spreuken')">✨ Spreuken</button>
        <button class="co-tab${_combatOverlayTab==='knapzak'?' active':''}" data-tab="knapzak" onclick="window._setCombatOverlayTab('knapzak')">🎒 Items</button>
      </div>

      <!-- Gevecht tab -->
      <div class="co-tab-panel${_combatOverlayTab!=='gevecht'?' hidden':''}" id="co-tab-gevecht">
        <canvas id="combat-canvas" class="co-canvas"></canvas>
        <div id="co-detail-panel" class="co-detail-panel hidden"></div>
        <div id="co-emote-bar" class="co-emote-bar"></div>
        ${_coLog}
      </div>

      <!-- Stats tab -->
      <div class="co-tab-panel co-char-tab${_combatOverlayTab!=='personage'?' hidden':''}" id="co-tab-personage">
        <div class="co-char-loading">Laden…</div>
      </div>

      <!-- Spreuken tab -->
      <div class="co-tab-panel co-char-tab${_combatOverlayTab!=='spreuken'?' hidden':''}" id="co-tab-spreuken">
        <div class="co-char-loading">Laden…</div>
      </div>

      <!-- Items tab -->
      <div class="co-tab-panel co-char-tab${_combatOverlayTab!=='knapzak'?' hidden':''}" id="co-tab-knapzak">
        <div class="co-char-loading">Laden…</div>
      </div>
    `}
  `;

  // Start canvas animation loop (alleen als het canvas zichtbaar is)
  if (_combatOverlayTab === 'gevecht' || isDM) {
    const canvasEl = document.getElementById('combat-canvas');
    if (canvasEl) canvasInit(canvasEl, combat);
  }

  // Herstel detail-panel als een combatant geselecteerd was
  if (_selectedCombatantId) _combatSelectCombatant(_selectedCombatantId);

  // Emote-balken asynchroon vullen
  if (isDM) {
    _populateDmEmoteBar(combat).catch(() => {});
  } else if (_combatOverlayTab === 'gevecht') {
    _populateEmoteBar(combat).catch(() => {});
  }

  // Laad karakter-tab als die actief is
  if (!isDM && _combatOverlayTab !== 'gevecht') {
    _loadCombatCharTab(_combatOverlayTab).catch(() => {});
  }

  // Entrance-animatie alleen bij het openen (niet bij elke HP-update)
  if (wasHidden) {
    const combatModal = overlay.querySelector('.combat-modal');
    if (combatModal) {
      combatModal.classList.remove('co-entering');
      void combatModal.offsetHeight; // force reflow om animatie te herstarten
      combatModal.classList.add('co-entering');
    }
  }
};

// ── Combat overlay tab-switching ──────────────────────────────────────────────

window._setCombatOverlayTab = async (tab) => {
  _combatOverlayTab = tab;
  // Knoppen bijwerken
  document.querySelectorAll('#co-tabs .co-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // Panelen tonen/verbergen
  document.querySelectorAll('.co-tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== `co-tab-${tab}`);
  });
  // Canvas & emotes beheren
  if (tab === 'gevecht') {
    const canvasEl = document.getElementById('combat-canvas');
    if (canvasEl && _lastCombat) {
      canvasStop();
      canvasInit(canvasEl, _lastCombat);
    }
    _populateEmoteBar(_lastCombat).catch(() => {});
  } else {
    canvasStop();
    await _loadCombatCharTab(tab);
  }
};

async function _loadCombatCharTab(tab) {
  const charId = window.app?.state?.characterId;
  const panel  = document.getElementById(`co-tab-${tab}`);
  if (!panel) return;
  if (!charId) {
    panel.innerHTML = '<p class="co-char-err">Geen karakter geselecteerd.</p>';
    return;
  }
  panel.innerHTML = '<div class="co-char-loading">Laden…</div>';
  try {
    if (tab === 'personage') {
      const [profile, hpData, traits] = await Promise.all([
        api.getPlayerProfile(charId).catch(() => ({})),
        api.getPlayerHp(charId).catch(() => ({ current: null, max: null })),
        api.getPlayerTraits(charId).catch(() => []),
      ]);
      panel.innerHTML = _buildCombatPersonagePanel(profile, hpData, _lastCombat, charId, traits);
      _attachCombatTraitAccordionListeners(panel);
    } else if (tab === 'spreuken') {
      const [slots, spells, profile] = await Promise.all([
        api.getPlayerSpellSlots(charId).catch(() => ({})),
        api.getPlayerSpells(charId).catch(() => []),
        api.getPlayerProfile(charId).catch(() => ({})),
      ]);
      panel.innerHTML = _buildCombatSpreukenPanel(slots, spells, charId, profile);
      _attachCombatSpellAccordionListeners(panel);
    } else if (tab === 'knapzak') {
      const [simpleItems, currency, ownership, voorwerpen] = await Promise.all([
        api.getPlayerItems(charId).catch(() => []),
        api.getPlayerCurrency(charId).catch(() => ({ fl: 0, kn: 0, cl: 0 })),
        api.getItemOwnership().catch(() => ({ owners: {} })),
        api.listEntities('voorwerpen').catch(() => []),
      ]);
      panel.innerHTML = _buildCombatKnapzakPanel(simpleItems, currency, ownership, voorwerpen, charId);
    }
  } catch (e) {
    panel.innerHTML = `<p class="co-char-err">Fout bij laden: ${esc(String(e?.message || e))}</p>`;
  }
};

function _buildCombatPersonagePanel(profile, hpData, combat, charId, traits) {
  const _ab      = (ab) => parseInt(profile[ab]) || 10;
  const _mod     = (ab) => Math.floor((_ab(ab) - 10) / 2);
  const _modStr  = (ab) => { const m = _mod(ab); return (m >= 0 ? '+' : '') + m; };
  let _skillProfs = {};
  try { _skillProfs = JSON.parse(profile.skillProfs || '{}'); } catch {}
  let _skillAdj = {};
  try { _skillAdj = JSON.parse(profile.skillAdj || '{}'); } catch {}
  const _saveProfs    = new Set((profile.saveProfs || '').split(',').filter(Boolean));
  const _profBonusNum = parseInt(profile.profBonus) || 0;
  const _percProf     = _skillProfs['perception'] || null;
  const _passivePerc  = 10 + _mod('wis') + (_percProf === 'expert' ? _profBonusNum * 2 : _percProf === 'prof' ? _profBonusNum : 0);

  const hp    = typeof hpData.current === 'number' ? hpData.current : null;
  const maxHp = typeof hpData.max     === 'number' ? hpData.max     : null;
  const hpPct = hp !== null && maxHp ? Math.max(0, Math.min(100, hp / maxHp * 100)) : 0;
  const hpCls = hpPct > 75 ? 'hp-healthy' : hpPct > 50 ? 'hp-lightly' : hpPct > 25 ? 'hp-wounded' : hpPct > 0 ? 'hp-critical' : 'hp-down';

  const myCombatant = combat?.combatants?.find(c => c.entityId === charId);
  const conditions  = myCombatant?.conditions || [];

  const _skillBonus = (skill) => {
    const prof = _skillProfs[skill.key] || null;
    const adj  = _skillAdj[skill.key]  || 0;
    return _mod(skill.ab) + (prof === 'expert' ? _profBonusNum * 2 : prof === 'prof' ? _profBonusNum : 0) + adj;
  };

  const absHtml = ['str','dex','con','int','wis','cha'].map(ab => {
    const isProf       = _saveProfs.has(ab);
    const saveBonus    = _mod(ab) + (isProf ? _profBonusNum : 0);
    const saveBonusStr = (saveBonus >= 0 ? '+' : '') + saveBonus;
    return `
      <div class="co-ability-card">
        <div class="co-ability-label">${_CO_AB_LABELS[ab]}</div>
        <div class="co-ability-score">${_ab(ab)}</div>
        <div class="co-ability-mod">${_modStr(ab)}</div>
        <div class="co-ability-save${isProf ? ' prof' : ''}" title="Saving throw: ${saveBonusStr}">${saveBonusStr}</div>
      </div>`;
  }).join('');

  const skillsHtml = _CO_SKILLS.map(skill => {
    const prof     = _skillProfs[skill.key] || null;
    const bonus    = _skillBonus(skill);
    const bonusStr = (bonus >= 0 ? '+' : '') + bonus;
    const adjVal   = _skillAdj[skill.key] || 0;
    const adjCls   = adjVal > 0 ? ' skill-bonus--buff' : adjVal < 0 ? ' skill-bonus--nerf' : '';
    return `<div class="co-skill-row">
      <span class="co-skill-prof-dot${prof ? ' ' + prof : ''}"></span>
      <span class="co-skill-bonus${adjCls}">${bonusStr}</span>
      <span class="co-skill-name">${skill.label}</span>
      <span class="co-skill-ab">${skill.ab.toUpperCase()}</span>
    </div>`;
  }).join('');

  const condHtml = conditions.length ? `
    <div class="co-char-section">
      <div class="co-char-section-title">⚡ Actieve condities</div>
      <div class="co-active-conds">${conditions.map(cid => {
        const cond = CONDITIONS.find(x => x.id === cid);
        return cond ? `<span class="co-cond-chip" title="${esc(cond.desc)}">${esc(cond.label)}</span>` : '';
      }).join('')}</div>
    </div>` : '';

  // ── Weapons & Damage Cantrips ──
  let weapons = [];
  try { weapons = JSON.parse(profile.weapons || '[]'); } catch {}
  const weaponsHtml = weapons.length ? `
    <div class="co-weapons-table">
      <div class="co-weapons-header">
        <span class="co-wh-name">Naam</span>
        <span class="co-wh-atk">Aanval / DC</span>
        <span class="co-wh-dmg">Schade &amp; Type</span>
        <span class="co-wh-notes">Notities</span>
      </div>
      ${weapons.map(w => `
      <div class="co-weapon-row">
        <span class="co-w-name">${esc(w.name || '—')}</span>
        <span class="co-w-atk">${esc(w.atk  || '—')}</span>
        <span class="co-w-dmg">${esc(w.dmg  || '—')}</span>
        <span class="co-w-notes">${esc(w.notes || '')}</span>
      </div>`).join('')}
    </div>` : '<p class="co-char-empty">Geen wapens of cantrips geconfigureerd.</p>';

  // ── Kenmerken & Eigenschappen ──
  const pinnedTraits = Array.isArray(traits) ? traits : [];
  const _traitLevel = t => {
    const m = (t.meta || '').match(/Niv\.\s*(\d+)/i);
    return m ? parseInt(m[1]) : (t.source === 'phb-feats' ? 99 : 0);
  };
  const sortedTraits = [...pinnedTraits].sort((a, b) =>
    _traitLevel(a) - _traitLevel(b) || (a.name || '').localeCompare(b.name || ''));

  const traitsHtml = sortedTraits.length ? sortedTraits.map(t => {
    const maxUses = t.maxUses || 0;
    const curUses = t.currentUses || 0;
    const dotsHtml = maxUses > 0 ? `
      <span class="trait-uses-dots">
        ${Array.from({length: maxUses}, (_, i) =>
          `<span class="spell-slot-dot ${i < curUses ? 'used' : 'free'}" title="${i < curUses ? 'Verbruikt' : 'Vrij'}"></span>`
        ).join('')}
        <span class="trait-uses-count">${curUses}/${maxUses}</span>
      </span>` : '';
    return `
    <details class="player-trait-accordion co-trait-accordion">
      <summary class="player-pinned-spell-summary">
        <span class="player-pinned-spell-chevron">▾</span>
        <span class="player-pinned-spell-name">${esc(t.name)}</span>
        ${t.meta ? `<span class="player-pinned-spell-meta">${esc(t.meta)}</span>` : ''}
        ${dotsHtml}
      </summary>
      <div class="player-spell-accordion-body"
        data-trait-index="${esc(t.index || '')}"
        data-trait-source="${esc(t.source || 'custom')}"
        data-trait-desc="${esc(t.desc || '')}"
        data-trait-id="${esc(t.id)}"
        data-loaded="false">
        <p class="player-spell-loading-text">Laden…</p>
      </div>
    </details>`;
  }).join('') : '<p class="co-char-empty">Geen kenmerken vastgezet.</p>';

  return `
    <div class="co-char-strip">
      <div class="co-cs-item"><span class="co-cs-label">AC</span><span class="co-cs-val">${esc(profile.ac ?? '—')}</span></div>
      <div class="co-cs-item"><span class="co-cs-label">Speed</span><span class="co-cs-val">${esc(profile.speed ?? '—')}</span></div>
      <div class="co-cs-item"><span class="co-cs-label">Init</span><span class="co-cs-val">${esc(profile.initiative ?? '—')}</span></div>
      <div class="co-cs-item"><span class="co-cs-label">Prof</span><span class="co-cs-val">${_profBonusNum > 0 ? '+' + _profBonusNum : '—'}</span></div>
      <div class="co-cs-item"><span class="co-cs-label">PP</span><span class="co-cs-val">${_passivePerc}</span></div>
      <div class="co-cs-item"><span class="co-cs-label">HP</span><span class="co-cs-val ${hpCls}">${hp ?? '—'}/${maxHp ?? '—'}</span></div>
    </div>
    ${condHtml}
    <div class="co-char-section">
      <div class="co-char-section-title">${icon('dice',{cls:'icon-gi'})} Ability Scores & Saving Throws</div>
      <div class="co-ability-grid">${absHtml}</div>
    </div>
    <div class="co-char-section">
      <div class="co-char-section-title">🎯 Skills</div>
      <div class="co-skills-list">${skillsHtml}</div>
    </div>
    <div class="co-char-section">
      <div class="co-char-section-title">${icon('swords')} Weapons &amp; Damage Cantrips</div>
      ${weaponsHtml}
    </div>
    <div class="co-char-section">
      <div class="co-char-section-title">✨ Kenmerken &amp; Eigenschappen</div>
      <div class="co-traits-list">${traitsHtml}</div>
    </div>
  `;
};

function _buildCombatSpreukenPanel(slots, spells, charId, profile = {}) {
  const lvls = [1,2,3,4,5,6,7,8,9];
  const slotsHtml = lvls.map(lvl => {
    const slot = slots[lvl];
    if (!slot || slot.max === 0) return '';
    const dots = Array.from({ length: slot.max }, (_, i) => {
      const used = i < slot.used;
      return `<button class="spell-slot-dot ${used ? 'used' : 'free'}"
        onclick="window._coCombatToggleSlot(${lvl},${i},'${esc(charId)}')"
        title="${used ? 'Verbruikt — klik om vrij' : 'Vrij — klik om te verbruiken'}"></button>`;
    }).join('');
    return `<div class="player-dash-slot-row">
      <span class="player-dash-slot-level">Niv. ${lvl}</span>
      <div class="player-dash-slot-dots">${dots}</div>
      <span class="player-dash-slot-count">${slot.used}/${slot.max}</span>
    </div>`;
  }).filter(Boolean).join('');

  const hasSlots    = !!slotsHtml;
  // De spells-lijst IS de gepinde lijst — geen extra .pinned filter nodig
  const pinnedSpells = Array.isArray(spells) ? [...spells].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.name || '').localeCompare(b.name || '')) : [];

  const spellAccordionsHtml = pinnedSpells.map(s => `
    <details class="player-spell-accordion co-spell-accordion">
      <summary class="player-pinned-spell-summary">
        <span class="player-pinned-spell-chevron">▾</span>
        <span class="player-pinned-spell-level-badge">${s.level === 0 ? 'C' : s.level || '?'}</span>
        <span class="player-pinned-spell-name">${esc(s.name)}</span>
        ${s.school ? `<span class="player-pinned-spell-meta">${esc(s.school)}</span>` : ''}
        ${s.concentration ? '<span class="spell-badge spell-badge--conc">C</span>' : ''}
        ${s.ritual        ? '<span class="spell-badge spell-badge--ritual">R</span>' : ''}
      </summary>
      <div class="player-spell-accordion-body"
        data-spell-index="${esc(s.index || '')}"
        data-spell-source="${esc(s.source || '')}"
        data-spell-desc="${esc(s.desc || '')}"
        data-loaded="false">
        <p class="player-spell-loading-text">Laden…</p>
      </div>
    </details>`).join('');

  const saveDC    = profile.spellSaveDC     != null ? profile.spellSaveDC     : null;
  const atk       = profile.spellAttackBonus != null ? profile.spellAttackBonus : null;
  const spellStatsHtml = (saveDC != null || atk != null) ? `
    <div class="co-char-section">
      <div class="co-char-section-title">🎯 Spreukwaarden</div>
      <div class="co-spell-stats-row">
        ${saveDC != null ? `<div class="co-spell-stat"><span class="co-spell-stat-label">Spreuk Redding DC</span><span class="co-spell-stat-val">${saveDC}</span></div>` : ''}
        ${atk    != null ? `<div class="co-spell-stat"><span class="co-spell-stat-label">Spreuk Aanvalsbonus</span><span class="co-spell-stat-val">${atk >= 0 ? '+' : ''}${atk}</span></div>` : ''}
      </div>
    </div>` : '';

  return `
    ${spellStatsHtml}
    ${hasSlots ? `
    <div class="co-char-section">
      <div class="co-char-section-title">🔮 Spreukslots</div>
      <div class="player-dash-spell-slots">${slotsHtml}</div>
    </div>` : '<p class="co-char-empty">Geen spreukslots geconfigureerd.</p>'}
    ${pinnedSpells.length ? `
    <div class="co-char-section">
      <div class="co-char-section-title">📌 Gepinde spreuken</div>
      <div class="co-spell-accordions">${spellAccordionsHtml}</div>
    </div>` : ''}
  `;
};

function _buildCombatKnapzakPanel(simpleItems, currency, ownership, voorwerpen, charId) {
  const myItemMap = {};
  for (const [itemId, ownerData] of Object.entries(ownership.owners || {})) {
    if (Array.isArray(ownerData)) {
      const entry = ownerData.find(o => o.characterId === charId);
      if (entry && (entry.qty || 1) > 0) myItemMap[itemId] = entry.qty || 1;
    } else if (ownerData?.characterId === charId) {
      myItemMap[itemId] = null;
    }
  }
  const myItems   = voorwerpen.filter(item => item.id in myItemMap);
  const cNames    = window._currency || { fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' };

  const currencyHtml = `
    <div class="co-currency-row">
      <span class="co-currency-item"><span class="co-currency-label">${esc(cNames.fl)}</span><span class="co-currency-val">${currency.fl ?? 0}</span></span>
      <span class="co-currency-item"><span class="co-currency-label">${esc(cNames.kn)}</span><span class="co-currency-val">${currency.kn ?? 0}</span></span>
      <span class="co-currency-item"><span class="co-currency-label">${esc(cNames.cl)}</span><span class="co-currency-val">${currency.cl ?? 0}</span></span>
    </div>`;

  const claimedHtml = myItems.length ? myItems.map(item => {
    const qty = myItemMap[item.id];
    return `<div class="co-item-row">
      <span class="co-item-name">${esc(item.name)}</span>
      ${qty !== null ? `<span class="co-item-qty">×${qty}</span>` : ''}
    </div>`;
  }).join('') : '';

  const simpleHtml = simpleItems.length ? simpleItems.map(it => `
    <div class="co-item-row">
      <span class="co-item-name">${esc(it.name)}</span>
      ${(it.qty || 1) > 1 ? `<span class="co-item-qty">×${it.qty}</span>` : ''}
    </div>`).join('') : '';

  return `
    <div class="co-char-section">
      <div class="co-char-section-title">${icon('coins')} Munten</div>
      ${currencyHtml}
    </div>
    ${myItems.length ? `
    <div class="co-char-section">
      <div class="co-char-section-title">🎒 Geclaimde voorwerpen</div>
      <div class="co-items-list">${claimedHtml}</div>
    </div>` : ''}
    ${simpleItems.length ? `
    <div class="co-char-section">
      <div class="co-char-section-title">📦 Eenvoudige items</div>
      <div class="co-items-list">${simpleHtml}</div>
    </div>` : ''}
    ${!myItems.length && !simpleItems.length ? '<p class="co-char-empty">Geen items in knapzak.</p>' : ''}
  `;
};

// ── Spell-accordion lazy-loader voor combat overlay ──
let _coSpellList = null; // cache HP-spells

function _attachCombatSpellAccordionListeners(container) {
  container.querySelectorAll('.co-spell-accordion').forEach(details => {
    details.addEventListener('toggle', async function() {
      if (!this.open) return;
      const body = this.querySelector('.player-spell-accordion-body');
      if (!body || body.dataset.loaded === 'true') return;
      const index  = body.dataset.spellIndex;
      const source = body.dataset.spellSource;
      const stored = body.dataset.spellDesc;
      if (source === 'custom' || index?.startsWith('custom_')) {
        body.innerHTML = stored
          ? `<div class="player-spell-desc">${esc(stored).replace(/\n/g,'<br>')}</div>`
          : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>';
        body.dataset.loaded = 'true';
        return;
      }
      try {
        let s;
        if (typeof _isHpCampaign === 'function' && _isHpCampaign()) {
          if (!_coSpellList) {
            const r = await fetch('/data/hp-spells.json');
            const d = await r.json();
            _coSpellList = d.results || [];
          }
          s = _coSpellList.find(sp => sp.index === index) || {};
        } else {
          const r = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
          s = await r.json();
        }
        const _md = t => String(t)
          .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
        const desc = (s.desc || []).map(_md).join('<br><br>');
        const higher = s.higher_level?.length
          ? `<p class="player-spell-higher"><strong>Op hogere niveaus:</strong> ${s.higher_level.join(' ')}</p>` : '';
        const metaParts = [
          s.casting_time ? `Casting Time: ${s.casting_time}` : '',
          s.range        ? `Range: ${s.range}` : '',
          s.components?.length ? `Components: ${s.components.join(', ')}` : '',
          s.duration     ? `Duration: ${s.duration}` : '',
          s.concentration ? 'Concentration' : '',
        ].filter(Boolean);
        body.innerHTML = `
          ${metaParts.length ? `<div class="player-spell-meta2">${metaParts.join(' · ')}</div>` : ''}
          <div class="player-spell-desc">${desc}</div>
          ${higher}`;
        body.dataset.loaded = 'true';
      } catch {
        body.innerHTML = '<p class="player-spell-err">Beschrijving kon niet worden geladen.</p>';
      }
    });
  });
};

// ── Kenmerk-accordion lazy-loader voor combat overlay ──
function _attachCombatTraitAccordionListeners(container) {
  container.querySelectorAll('.co-trait-accordion').forEach(details => {
    details.addEventListener('toggle', async function() {
      if (!this.open) return;
      const body = this.querySelector('.player-spell-accordion-body');
      if (!body || body.dataset.loaded === 'true') return;
      const source = body.dataset.traitSource;
      const index  = body.dataset.traitIndex;
      const stored = body.dataset.traitDesc;
      if (source === 'custom') {
        body.innerHTML = stored
          ? `<div class="player-spell-desc">${esc(stored).replace(/\n/g,'<br>')}</div>`
          : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>';
        body.dataset.loaded = 'true';
        return;
      }
      try {
        if (!index) throw new Error('geen index');
        const apiType = source === 'phb-traits' ? 'traits'
                      : source === 'phb-feats'  ? 'feats'
                      : 'features';
        const r = await fetch(`https://www.dnd5eapi.co/api/${apiType}/${index}`);
        const f = await r.json();
        const _md = t => String(t)
          .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
        const desc = (f.desc || []).map(_md).join('<br><br>');
        let metaParts = [];
        if (apiType === 'features') {
          metaParts = [
            f.class?.name    ? `Klasse: ${f.class.name}` : '',
            f.subclass?.name ? `Subklasse: ${f.subclass.name}` : '',
            f.level          ? `Niveau ${f.level}` : '',
          ].filter(Boolean);
        }
        body.innerHTML = `
          ${metaParts.length ? `<div class="player-spell-meta2">${metaParts.join(' · ')}</div>` : ''}
          <div class="player-spell-desc">${desc || '<em>Geen beschrijving beschikbaar.</em>'}</div>`;
        body.dataset.loaded = 'true';
      } catch {
        body.innerHTML = '<p class="player-spell-err">Beschrijving kon niet worden geladen.</p>';
      }
    });
  });
};

window._coCombatToggleSlot = async (lvl, idx, charId) => {
  const current = await api.getPlayerSpellSlots(charId).catch(() => ({}));
  const slot    = current[lvl] || { max: 0, used: 0 };
  const newUsed = idx < slot.used ? slot.used - 1 : slot.used + 1;
  current[lvl]  = { ...slot, used: Math.max(0, Math.min(newUsed, slot.max)) };
  await api.setPlayerSpellSlots(charId, current).catch(() => {});
  // Ververs spreuken-panel in overlay
  await _loadCombatCharTab('spreuken');
  // Ververs ook het karakter-tabblad als dat open is
  window._reRenderKarakter?.();
};

async function _populateDmEmoteBar(combat) {
  const bar = document.getElementById('co-dm-emote-bar');
  if (!bar) return;

  const current = combat.combatants?.[combat.currentTurn];
  if (!current || current.type !== 'player' || !current.entityId) {
    bar.innerHTML = '';
    return;
  }

  let sounds = { emotes: {} };
  try {
    const r = await fetch('/api/sounds');
    if (r.ok) sounds = await r.json();
  } catch { return; }

  const data     = sounds.emotes?.[current.entityId];
  const library  = data?.library  || [];
  const selected = data?.selected || [];
  const active   = selected
    .map((eid, idx) => ({ index: idx, item: library.find(e => e.id === eid) }))
    .filter(e => e.item?.label && e.item?.fileId);

  if (!active.length) { bar.innerHTML = ''; return; }

  bar.innerHTML = `
    <div class="co-emote-bar-inner">
      <span class="co-emote-bar-label">🎭 ${esc(current.name)}</span>
      ${active.map(e => {
        const icon  = e.item.icon  || '';
        const label = e.item.label || '';
        return `<button class="co-emote-btn" onclick="new Audio('/api/files/${esc(e.item.fileId)}').play()" title="${esc(label)}">
          ${icon ? `<span class="co-emote-icon">${esc(icon)}</span>` : ''}
          ${label ? `<span class="co-emote-text">${esc(label)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
};

async function _populateEmoteBar(combat) {
  const bar = document.getElementById('co-emote-bar');
  if (!bar) return;

  const myCharId = window.app?.state?.characterId;
  const myName   = window.app?.state?.playerName;
  if (!myCharId && !myName) return;

  const currentC = combat.combatants?.[combat.currentTurn];
  const isMyTurn = currentC &&
    (myCharId ? currentC.entityId === myCharId : currentC.name === myName);

  if (!isMyTurn) { bar.innerHTML = ''; return; }

  let sounds = { emotes: {} };
  try {
    const r = await fetch('/api/sounds');
    if (r.ok) sounds = await r.json();
  } catch { return; }

  // Nieuw model: { library, selected }
  const emoteData    = sounds.emotes?.[myCharId];
  const emoteLibrary = emoteData?.library || [];
  const emoteSelected = emoteData?.selected || [];
  const active = emoteSelected
    .map((eid, idx) => ({ index: idx, item: emoteLibrary.find(e => e.id === eid) }))
    .filter(e => e.item?.label);

  if (!active.length) { bar.innerHTML = ''; return; }

  bar.innerHTML = `
    <div class="co-emote-bar-inner">
      <span class="co-emote-bar-label">🎭 Jouw beurt</span>
      ${active.map(e => {
        const icon  = e.item.icon  || '';
        const label = e.item.label || '';
        return `<button class="co-emote-btn" onclick="window._coEmote(${e.index})" title="${esc(label)}">
          ${icon ? `<span class="co-emote-icon">${esc(icon)}</span>` : ''}
          ${label ? `<span class="co-emote-text">${esc(label)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;

  window._coEmote = (index) => {
    if (window._socket && myCharId) {
      window._socket.emit('sound:emote', { entityId: myCharId, index });
    }
  };
};

// ── Berichten ─────────────────────────────────────────────────────────────────

let _berichtenSpelers = [];
let _berichtenNPCs    = [];
let _berichtenData    = {};   // { characterId: [{ id, tekst|brief-velden, timestamp, gelezen }] }
let _sjablonen        = [];
let _sjabloonMode     = false;

async function _renderBerichten() {
  const el = document.querySelector('.dm-tab-content[data-tab="berichten"]');
  if (!el) return;
  el.innerHTML = '<div class="dm-feature-section"><div class="dm-section-label">Laden…</div></div>';

  try {
    const [berichtenRes, sjablonenRes, allPersonages, groepen] = await Promise.all([
      api.getBerichten(),
      api.getSjablonen().catch(() => ({ sjablonen: [] })),
      api.listEntities('personages').catch(() => []),
      api.listGroups().catch(() => []),
    ]);
    // DM response: { spelers: [{ characterId, name, berichten }] }
    _sjablonen = sjablonenRes.sjablonen || [];
    _berichtenData = {};
    for (const s of (berichtenRes.spelers || [])) {
      _berichtenData[s.characterId] = s.berichten || [];
    }
    // Alle speler-personages als keuzemogelijkheid (ongeacht campagnezichtbaarheid)
    _berichtenSpelers = allPersonages.filter(p => p.subtype === 'speler');
    _berichtenNPCs    = allPersonages.filter(p => p.subtype !== 'speler');
    // listGroups geeft { groups: [...] } terug
    window._berichtenGroepen = groepen.groups || groepen || [];
  } catch (err) {
    el.innerHTML = `<div class="dm-feature-section"><div class="dm-section-label">Fout: ${esc(err.message)}</div></div>`;
    return;
  }

  const totalUnread = Object.values(_berichtenData).flat().filter(m => !m.gelezen && !m.deletedAt).length;

  el.innerHTML = `
    <div class="dm-feature-section">

      <!-- ═══ STUUR BRIEF (rijker format) ═══ -->
      <div class="dm-section-label">${icon('mail')} Stuur brief</div>
      <div class="bericht-compose post-compose">

        <!-- Ontvanger -->
        <div class="dm-form-row" style="gap:6px;flex-wrap:wrap;align-items:center">
          <label class="dm-form-label" style="min-width:60px">Aan</label>
          <select id="post-ontvanger-type" class="dm-select" style="width:110px;flex-shrink:0" onchange="window._postOntvangerTypeChange()">
            <option value="speler">Speler</option>
            <option value="groep">Hele party</option>
          </select>
          <select id="post-ontvanger-speler" class="dm-select" style="flex:1;min-width:110px">
            <option value="">— Kies speler —</option>
            ${_berichtenSpelers.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
          <select id="post-ontvanger-groep" class="dm-select hidden" style="flex:1;min-width:110px">
            <option value="">— Kies groep —</option>
            ${(window._berichtenGroepen || []).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Afzender -->
        <div class="dm-form-row" style="gap:6px;flex-wrap:wrap;align-items:center">
          <label class="dm-form-label" style="min-width:60px">Van</label>
          <input id="post-afzender" type="text" class="dm-input" placeholder="Naam afzender (of anoniem)" style="flex:1;min-width:120px">
          <div class="post-npc-wrap" style="flex:1;min-width:120px">
            <input id="post-npc-search" type="text" class="dm-input" autocomplete="off"
              placeholder="Zoek NPC…"
              oninput="window._postNpcSearch(this.value)"
              onfocus="window._postNpcSearch(this.value)"
              onblur="setTimeout(window._postNpcClose,150)">
            <input type="hidden" id="post-npc">
            <div id="post-npc-dropdown" class="post-npc-dropdown"></div>
          </div>
        </div>

        <!-- Titel -->
        <div class="dm-form-row" style="flex-direction:column;gap:4px">
          <label class="dm-form-label">Onderwerp</label>
          <input id="post-titel" type="text" class="dm-input" placeholder="Onderwerp / titel van de brief" style="width:100%">
        </div>

        <!-- In-world datum -->
        <div class="dm-form-row" style="flex-direction:column;gap:4px">
          <label class="dm-form-label">Datum (in de spelwereld)</label>
          <input id="post-datum" type="text" class="dm-input" placeholder="bijv. 4 Grasmaand MDCCLXXII" style="width:100%">
        </div>

        <!-- Briefstijl / thema -->
        <div class="dm-form-row" style="flex-direction:column;gap:4px">
          <label class="dm-form-label">Briefstijl</label>
          <select id="post-thema" class="dm-select" style="width:100%">
            <option value="">Standaard perkament</option>
            <option value="ursula">Madame Ursula — lila brief</option>
            <option value="gock">De Gock — logo &amp; typemachine</option>
            <option value="tweespalt">De Tweespalt — haastig briefje</option>
            <option value="heeren">De Heeren van de Nacht — schaduwbrief</option>
          </select>
        </div>

        <!-- Tekst -->
        <div class="dm-form-row" style="flex-direction:column;gap:4px">
          <label class="dm-form-label">Inhoud</label>
          <textarea id="post-tekst" class="dm-textarea" rows="5" placeholder="Schrijf de brief hier…" style="resize:vertical;font-family:'IM Fell English',serif;font-size:0.95rem"></textarea>
        </div>

        <div class="dm-form-row" style="justify-content:flex-end;gap:6px">
          <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.postSend()" title="Brief sturen">${icon('scroll-text')}</button>
        </div>
        <div id="post-send-status" class="bericht-status hidden"></div>
      </div>

      <!-- ═══ STUUR SNEL BERICHT (eenvoudig format) ═══ -->
      <div class="dm-section-label" style="margin-top:16px">${icon('message-circle')} Snel bericht${totalUnread ? ` <span class="bericht-badge">${totalUnread}</span>` : ''}</div>
      <div class="bericht-compose">
        <div class="dm-form-row" style="gap:6px;flex-wrap:wrap;align-items:center">
          <label class="dm-form-label" style="min-width:60px">Aan</label>
          <select id="bericht-ontvanger" class="dm-select" style="flex:1;min-width:120px">
            <option value="">— Kies speler —</option>
            ${_berichtenSpelers.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>

        <div class="dm-form-row" style="flex-direction:column;gap:4px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <label class="dm-form-label">Bericht</label>
            ${_sjablonen.length ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._berichtenToggleSjablonen()" title="Sjablonen" style="font-size:10px">${icon('clipboard-list')}</button>` : `<button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._berichtenToggleSjablonen()" title="Sjabloon opslaan" style="font-size:10px">${icon('clipboard-list')}</button>`}
          </div>
          <div id="bericht-sjablonen-lijst" class="bericht-sjablonen hidden">
            ${_sjablonen.map((s, i) => `
              <div class="bericht-sjabloon-row">
                <button class="bericht-sjabloon-btn" onclick="window._berichtenUseSjabloon(${i})">${esc(s.substring(0, 60))}${s.length > 60 ? '…' : ''}</button>
                <button class="bericht-sjabloon-del" onclick="window.dmPanel.sjabloonDelete(${i})" title="Verwijder">${icon('x')}</button>
              </div>`).join('')}
            ${_sjablonen.length < 20 ? `
              <button class="dm-btn dm-btn-sm dm-btn-ghost" style="margin-top:4px;width:100%" onclick="window._berichtenSaveCurrentAsSjabloon()" title="Huidige tekst opslaan als sjabloon">💾</button>
            ` : ''}
          </div>
          <textarea id="bericht-tekst" class="dm-textarea" rows="3" placeholder="Geheim bericht aan de speler…" style="resize:vertical"></textarea>
        </div>

        <div class="dm-form-row" style="justify-content:flex-end;gap:6px">
          <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.berichtSend()" title="Versturen">📤</button>
        </div>
        <div id="bericht-send-status" class="bericht-status hidden"></div>
      </div>

      <!-- ═══ GESCHIEDENIS ═══ -->
      <div class="dm-section-label" style="margin-top:16px">Geschiedenis</div>
      ${_berichtenSpelers.length === 0 ? '<p class="dm-empty">Geen spelers zichtbaar.</p>' : ''}
      ${_berichtenSpelers.map(p => {
        const msgs = (_berichtenData[p.id] || []).slice().reverse();
        if (!msgs.length) return '';
        return `
          <details class="bericht-history-group" open>
            <summary class="bericht-history-head">
              ${esc(p.name)}
              <span class="bericht-history-count">${msgs.length}</span>
            </summary>
            <div class="bericht-history-body">
              ${msgs.map(m => {
                if (m.type === 'brief') {
                  // Brief: rijke documentkaart
                  return `
                    <div class="bericht-history-item bericht-history-brief${m.deletedAt ? ' bericht-history-brief--deleted' : ''}${m.gelezen ? '' : ' bericht-history-unread'}">
                      <div class="bericht-history-row">
                        <div style="flex:1;min-width:0">
                          ${m.titel ? `<div class="bericht-brief-titel">${esc(m.titel)}</div>` : ''}
                          ${m.afzender ? `<div class="bericht-brief-afzender">Van: <em>${esc(m.afzender)}</em>${m.entityId ? ` <button class="herberg-bubble-card-btn" style="font-size:0.6rem;padding:1px 3px" onclick="window._openDetail('${esc(m.entityType)}','${esc(m.entityId)}')" title="Open kaartje">↗</button>` : ''}</div>` : ''}
                          <div class="bericht-brief-tekst-preview">${esc(m.tekst.substring(0, 120))}${m.tekst.length > 120 ? '…' : ''}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
                          ${m.deletedAt ? `<span class="bericht-brief-deleted-badge" title="Weggegooid op ${_fmtDate(m.deletedAt)}">🗑 weggegooid</span>` : ''}
                        </div>
                      </div>
                      <span class="bericht-history-meta">${_fmtDate(m.timestamp)}${m.gelezen ? ' · gelezen' : ' · ongelezen'}${m.deletedAt ? ' · weggegooid' : ''}</span>
                    </div>`;
                }
                // Gewoon bericht
                return `
                  <div class="bericht-history-item${m.gelezen ? '' : ' bericht-history-unread'}">
                    <div class="bericht-history-row">
                      <span class="bericht-history-tekst">${esc(m.tekst)}</span>
                      <button class="bericht-del-btn" title="Verwijder" onclick="window._berichtDmDelete('${esc(p.id)}','${esc(m.id)}')">${icon('x')}</button>
                    </div>
                    <span class="bericht-history-meta">${_fmtDate(m.timestamp)}${m.gelezen ? ' · gelezen' : ' · ongelezen'}</span>
                  </div>`;
              }).join('')}
            </div>
          </details>`;
      }).join('')}
    </div>`;
};

function _fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
};

window._berichtDmDelete = async (characterId, msgId) => {
  try {
    await api.deleteBericht(characterId, msgId);
    _renderBerichten();
  } catch { /* ok */ }
};

// Schakel speler/groep dropdown bij brief-ontvanger
window._postOntvangerTypeChange = () => {
  const type = document.getElementById('post-ontvanger-type')?.value;
  document.getElementById('post-ontvanger-speler')?.classList.toggle('hidden', type !== 'speler');
  document.getElementById('post-ontvanger-groep')?.classList.toggle('hidden', type !== 'groep');
};

// Vul afzender-naam in vanuit NPC-selectie
// ── NPC zoek-combobox ──
window._postNpcSearch = (q) => {
  const dd = document.getElementById('post-npc-dropdown');
  if (!dd) return;
  const matches = q.trim()
    ? _berichtenNPCs.filter(n => n.name.toLowerCase().includes(q.toLowerCase()))
    : _berichtenNPCs;
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = [
    `<div class="post-npc-item post-npc-item--none" onmousedown="window._postNpcSelect('','')">— Geen NPC-link —</div>`,
    ...matches.map(n =>
      `<div class="post-npc-item" onmousedown="window._postNpcSelect('${esc(n.id)}','${escJS(n.name)}')">${esc(n.name)}</div>`)
  ].join('');
  dd.classList.add('open');
};

window._postNpcClose = () => {
  document.getElementById('post-npc-dropdown')?.classList.remove('open');
};

window._postNpcSelect = (id, name) => {
  const hidden   = document.getElementById('post-npc');
  const search   = document.getElementById('post-npc-search');
  const afzender = document.getElementById('post-afzender');
  if (hidden) hidden.value  = id;
  if (search) search.value  = name;
  if (afzender && !afzender.value.trim() && name) afzender.value = name;
  window._postNpcClose();
};

async function _postSend() {
  const ontvangerType  = document.getElementById('post-ontvanger-type')?.value;
  const spelerId       = document.getElementById('post-ontvanger-speler')?.value;
  const groepId        = document.getElementById('post-ontvanger-groep')?.value;
  const titel          = document.getElementById('post-titel')?.value.trim();
  const tekst          = document.getElementById('post-tekst')?.value.trim();
  const afzender       = document.getElementById('post-afzender')?.value.trim();
  const datum          = document.getElementById('post-datum')?.value.trim();
  const npcId          = document.getElementById('post-npc')?.value;
  const thema          = document.getElementById('post-thema')?.value || '';
  const statusEl       = document.getElementById('post-send-status');

  if (!tekst) {
    if (statusEl) { statusEl.textContent = 'Vul een briefinhoud in.'; statusEl.className = 'bericht-status bericht-status--err'; statusEl.classList.remove('hidden'); }
    return;
  }
  if (ontvangerType === 'speler' && !spelerId) {
    if (statusEl) { statusEl.textContent = 'Kies een speler.'; statusEl.className = 'bericht-status bericht-status--err'; statusEl.classList.remove('hidden'); }
    return;
  }
  if (ontvangerType === 'groep' && !groepId) {
    if (statusEl) { statusEl.textContent = 'Kies een party/groep.'; statusEl.className = 'bericht-status bericht-status--err'; statusEl.classList.remove('hidden'); }
    return;
  }

  const npc = npcId ? _berichtenNPCs.find(n => n.id === npcId) : null;

  // Vul een passende afzender in als er geen is gekozen
  const THEMA_AFZENDER = { ursula: 'Madame Ursula', gock: 'De Gock', tweespalt: 'De Tweespalt', heeren: 'De Heeren van de Nacht' };
  const afzenderDef = afzender || (thema ? THEMA_AFZENDER[thema] : '');

  const payload = {
    titel,
    tekst,
    afzender: afzenderDef,
    datum,
    thema,
    entityId:   npc ? npc.id   : null,
    entityType: npc ? 'personages' : null,
    characterId: ontvangerType === 'speler' ? spelerId : null,
    groepId:     ontvangerType === 'groep'  ? groepId  : null,
  };

  try {
    const r = await api.sendPost(payload);
    if (statusEl) {
      statusEl.textContent = `✓ Brief verstuurd${r.created > 1 ? ` (${r.created} ontvangers)` : ''}`;
      statusEl.className = 'bericht-status bericht-status--ok';
      statusEl.classList.remove('hidden');
    }
    // Reset formulier
    document.getElementById('post-titel').value      = '';
    document.getElementById('post-tekst').value      = '';
    document.getElementById('post-afzender').value   = '';
    document.getElementById('post-datum').value      = '';
    document.getElementById('post-npc').value        = '';
    document.getElementById('post-npc-search').value = '';
    const themaSel = document.getElementById('post-thema'); if (themaSel) themaSel.value = '';
    setTimeout(() => _renderBerichten(), 400);
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'Fout: ' + err.message; statusEl.className = 'bericht-status bericht-status--err'; statusEl.classList.remove('hidden'); }
  }
};

window._berichtenToggleSjablonen = () => {
  const el = document.getElementById('bericht-sjablonen-lijst');
  if (el) el.classList.toggle('hidden');
};

window._berichtenUseSjabloon = (index) => {
  const s = _sjablonen[index];
  if (!s) return;
  const ta = document.getElementById('bericht-tekst');
  if (ta) ta.value = s;
  document.getElementById('bericht-sjablonen-lijst')?.classList.add('hidden');
};

window._berichtenSaveCurrentAsSjabloon = async () => {
  const tekst = document.getElementById('bericht-tekst')?.value.trim();
  if (!tekst) return;
  if (_sjablonen.includes(tekst)) return;
  _sjablonen.push(tekst);
  if (_sjablonen.length > 20) _sjablonen = _sjablonen.slice(-20);
  try {
    await api.saveSjablonen(_sjablonen);
    _renderBerichten();
  } catch { /* ok */ }
};

async function _berichtSend() {
  const ontvangerId = document.getElementById('bericht-ontvanger')?.value;
  const tekst       = document.getElementById('bericht-tekst')?.value.trim();
  const statusEl    = document.getElementById('bericht-send-status');

  if (!ontvangerId || !tekst) {
    if (statusEl) { statusEl.textContent = 'Kies een speler en voer een bericht in.'; statusEl.className = 'bericht-status bericht-status--err'; }
    return;
  }

  try {
    await api.sendBericht({ characterId: ontvangerId, tekst });
    if (statusEl) { statusEl.textContent = '✓ Bericht verstuurd'; statusEl.className = 'bericht-status bericht-status--ok'; }
    document.getElementById('bericht-tekst').value = '';
    setTimeout(() => _renderBerichten(), 400);
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'Fout: ' + err.message; statusEl.className = 'bericht-status bericht-status--err'; }
  }
  if (statusEl) statusEl.classList.remove('hidden');
};

async function _sjabloonDelete(index) {
  _sjablonen.splice(index, 1);
  try { await api.saveSjablonen(_sjablonen); } catch { /* ok */ }
  _renderBerichten();
};

// ── DM Instellingen modal ─────────────────────────────────────────────────────

window._dmInstellingenOpen = () => {
  const overlay = document.getElementById('dm-instellingen-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  _renderInstellingen();
};

window._dmInstellingenClose = () => {
  const overlay = document.getElementById('dm-instellingen-overlay');
  if (overlay) overlay.classList.add('hidden');
};

async function _renderInstellingen() {
  const body = document.getElementById('dm-instellingen-body');
  if (!body) return;

  // Haal data op
  const meta = window.app?.state?.meta || {};
  let groups = [], activeCampaign = '', campaigns = [];
  try {
    const gr = await api.listGroups();
    groups = gr.groups || [];
  } catch { /* ok */ }
  try {
    const cp = await api.getCampaigns();
    campaigns    = cp.campaigns    || [];
    activeCampaign = cp.activeCampaign || '';
  } catch { /* ok */ }

  const groupItems = groups.map(g => `
    <div class="dm-inst-group-row" id="dm-inst-group-${esc(g.id)}">
      <input class="dm-input dm-inst-group-name" value="${esc(g.name)}"
        onchange="window._instGroepRename('${esc(g.id)}', this.value)"
        placeholder="Naam party">
      <input class="dm-input dm-inst-group-pw" type="password"
        placeholder="${g.hasPassword ? '🔒 Wachtwoord wijzigen…' : 'Wachtwoord instellen…'}"
        onchange="window._instGroepSetPw('${esc(g.id)}', this.value)"
        title="${g.hasPassword ? 'Er is een wachtwoord ingesteld. Typ een nieuw wachtwoord om het te wijzigen, of laat leeg om het te verwijderen.' : 'Wachtwoord instellen voor deze party'}">
      <button class="dm-btn dm-btn-sm dm-btn-ghost dm-btn-danger"
        onclick="window._instGroepDelete('${esc(g.id)}')" title="Party verwijderen">${icon('trash')}</button>
    </div>`).join('');

  const campaignItems = campaigns.map(c => {
    const isActive = c.id === activeCampaign;
    return `
      <div class="campagne-card${isActive ? ' campagne-card--active' : ''}">
        <div class="campagne-card-info">
          <strong class="campagne-card-title">${esc(c.appTitle || c.id)}</strong>
          ${c.appSubtitle ? `<span class="campagne-card-sub">${esc(c.appSubtitle)}</span>` : ''}
          <span class="campagne-card-meta">ID: ${esc(c.id)}</span>
        </div>
        <div class="campagne-card-actions">
          ${isActive
            ? '<span class="campagne-active-badge">● Actief</span>'
            : `<button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneSwitchTo('${esc(c.id)}')" title="Activeer campagne">▶</button>`}
        </div>
      </div>`;
  }).join('');

  body.innerHTML = `
    <!-- Campagnetitel -->
    <div class="dm-feature-section">
      <div class="dm-section-label">Campagnetitel</div>
      <div class="dm-form-row">
        <label class="dm-form-label">Titel</label>
        <input id="inst-app-title" class="dm-input" value="${esc(meta.appTitle || '')}" placeholder="Campagnenaam">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Ondertitel</label>
        <input id="inst-app-subtitle" class="dm-input" value="${esc(meta.appSubtitle || '')}" placeholder="Ondertitel (optioneel)">
      </div>
      <div class="dm-form-row">
        <button class="dm-btn dm-btn-primary" onclick="window._instTitelSave()" title="Opslaan">💾</button>
        <span id="inst-titel-status" class="bericht-status hidden" style="margin-left:8px"></span>
      </div>
    </div>

    <!-- Groepen -->
    <div class="dm-feature-section">
      <div class="dm-feature-row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="dm-section-label" style="margin-bottom:0">Party's</span>
        <button class="dm-btn dm-btn-sm" onclick="window._instGroepCreate()" title="Nieuwe party aanmaken">+</button>
      </div>
      <div id="inst-groepen-list" style="display:flex;flex-direction:column;gap:6px">
        ${groupItems || '<p class="dm-hint">Nog geen party\'s.</p>'}
      </div>
    </div>

    <!-- Campagnes -->
    <div class="dm-feature-section">
      <div class="dm-feature-row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
        <span class="dm-section-label" style="margin-bottom:0">Campagnes</span>
        <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneCreate()" title="Nieuwe campagne aanmaken">+</button>
      </div>
      <div id="dm-campagnes-inst-list">
        ${campaignItems || '<p class="dm-hint">Geen campagnes gevonden.</p>'}
      </div>
      <div id="campagne-create-form" style="display:none;margin-top:10px">
        <div class="dm-feature-row" style="gap:8px;flex-wrap:wrap">
          <input id="campagne-new-id"       class="dm-input" placeholder="ID (bijv. prewett)" style="flex:1;min-width:120px">
          <input id="campagne-new-title"    class="dm-input" placeholder="Naam" style="flex:2;min-width:140px">
          <input id="campagne-new-subtitle" class="dm-input" placeholder="Ondertitel (optioneel)" style="flex:2;min-width:140px">
        </div>
        <div class="dm-feature-row" style="gap:8px;margin-top:6px;flex-wrap:wrap">
          <select id="campagne-new-theme" class="dm-input" style="flex:1;min-width:160px">
            <option value="default">Fantasy (standaard)</option>
            <option value="hp">Harry Potter</option>
          </select>
          <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.campagneSubmit()" title="Aanmaken">${icon('check')}</button>
          <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="document.getElementById('campagne-create-form').style.display='none'" title="Annuleren">${icon('x')}</button>
        </div>
        <div id="campagne-create-error" style="color:#c44;font-size:.85em;margin-top:6px"></div>
      </div>
    </div>

    <!-- Locatie / Wereld (render functie injecteert eigen dm-feature-section) -->
    <div id="dm-inst-wereld"></div>

    <!-- Gedeelde beurs (idem) -->
    <div id="dm-inst-beurs"></div>
  `;

  // Render wereld en beurs in de juiste containers
  _renderWereldTab();
  _renderBeursTab();
};

window._instTitelSave = async () => {
  const title    = document.getElementById('inst-app-title')?.value.trim();
  const subtitle = document.getElementById('inst-app-subtitle')?.value.trim();
  const status   = document.getElementById('inst-titel-status');
  try {
    await api.saveAppMeta({ appTitle: title, appSubtitle: subtitle });
    const newMeta = await api.meta();
    if (window.app?.state) window.app.state.meta = newMeta;
    window.app?.applyAppMeta?.();
    if (status) { status.textContent = '✓ Opgeslagen'; status.className = 'bericht-status bericht-status--ok'; status.classList.remove('hidden'); }
    setTimeout(() => status?.classList.add('hidden'), 2500);
  } catch (err) {
    if (status) { status.textContent = 'Fout: ' + err.message; status.className = 'bericht-status bericht-status--err'; status.classList.remove('hidden'); }
  }
};

window._instGroepCreate = async () => {
  const naam = prompt('Naam van de nieuwe party:');
  if (!naam?.trim()) return;
  try {
    await api.createGroup(naam.trim());
    _renderInstellingen();
  } catch (err) { alert('Aanmaken mislukt: ' + err.message); }
};

window._instGroepRename = async (id, naam) => {
  if (!naam?.trim()) return;
  try {
    await api.updateGroup(id, naam.trim());
  } catch (err) { alert('Hernoemen mislukt: ' + err.message); }
};

window._instGroepSetPw = async (id, pw) => {
  try {
    await api.setGroupPassword(id, pw.trim());
  } catch (err) { alert('Wachtwoord instellen mislukt: ' + err.message); }
};

window._instGroepDelete = async (id) => {
  if (!confirm('Weet je zeker dat je deze party wilt verwijderen? Alle spelerssessies in deze party worden beëindigd.')) return;
  try {
    await api.deleteGroup(id);
    _renderInstellingen();
  } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
};
