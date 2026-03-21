import { api } from './api.js';
import { init as canvasInit, update as canvasUpdate, stop as canvasStop } from './combat-canvas.js';

// ── DM Panel ──

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
];

const HP_LABELS = [
  { min: 1.00, label: 'Healthy',          cls: 'hp-full' },
  { min: 0.75, label: 'Lightly Wounded',  cls: 'hp-light' },
  { min: 0.50, label: 'Wounded',          cls: 'hp-wounded' },
  { min: 0.25, label: 'Heavily Wounded',  cls: 'hp-heavy' },
  { min: 0.01, label: 'Critical',         cls: 'hp-critical' },
  { min: -Infinity, label: 'Down',        cls: 'hp-dead' },
];

function hpStatus(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  return HP_LABELS.find(l => pct >= l.min) || HP_LABELS[HP_LABELS.length - 1];
}

let _activeTab = 'tunnel';
let _tables = [];
let _editingTableId = null;
let _editingTableType = 'simple';
let _combat = null;
let _combatLoaded = false;
let _selectedCombatantId = null;
let _monsters = [];
let _monsterChapterFilter    = '';
let _monsterPage             = 0;
let _editingMonsterId        = null;
let _editingMonsterIsNew     = false;
let _editingMonsterImageId   = null;
let _editingMonsterBackdropId = null;

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
}

export function initDmPanel() {
  window.dmPanel = {
    toggle() {
      const panel = document.getElementById('dm-panel');
      const fab   = document.getElementById('dm-panel-fab');
      const isOpen = panel.classList.toggle('open');
      if (fab) fab.classList.toggle('hidden', isOpen);
      if (isOpen) {
        _switchTab(_activeTab);
      }
    },
    close() {
      document.getElementById('dm-panel')?.classList.remove('open');
      const fab = document.getElementById('dm-panel-fab');
      if (fab) fab.classList.remove('hidden');
    },
    switchTab(tab) { _switchTab(tab); },

    // Spreuken
    spellSearch: _spellSearch,
    spellOpen:   _spellOpen,
    spellBack:   _spellBack,

    // Tunnel
    tunnelToggle:  _tunnelToggle,
    tunnelCopy:    _tunnelCopy,
    exportSnapshot: _exportSnapshot,

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
    monsterFilterChapter: _monsterFilterChapter,
    monsterPage:          _monsterPage_set,
    monsterUpload:      _monsterUpload,
    monsterRemoveImage: _monsterRemoveImage,
    monsterAddToCombat: _monsterAddToCombat,

    // Gevecht — setup (voor start)
    setupTypeChange:   _setupTypeChange,
    setupPresetChange: _setupPresetChange,
    setupEntityChange: _setupEntityChange,
    setupAddSubmit:    _setupAddSubmit,
    setupReset:        _setupReset,

    // Gevecht — tijdens combat (overlay)
    combatStart:      _combatStart,
    combatEnd:        _combatEnd,
    combatNextTurn:   _combatNextTurn,
    combatPrevTurn:   _combatPrevTurn,
    combatMinimize:   () => {
      document.getElementById('combat-overlay')?.classList.add('minimized');
      canvasStop();
    },
    combatExpand:     () => {
      document.getElementById('combat-overlay')?.classList.remove('minimized');
      const canvasEl = document.getElementById('combat-canvas');
      if (canvasEl && _combat) canvasInit(canvasEl, _combat);
    },
    combatAddForm:    () => { document.getElementById('co-add-form')?.classList.remove('hidden'); },
    combatAddSubmit:  _combatAddSubmit,
    combatAddCancel:  () => { document.getElementById('co-add-form')?.classList.add('hidden'); },
    combatHpChange:   _combatHpChange,
    combatHpInput:    _combatHpInput,
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
    _renderCombatOverlay(c, /* startMinimized */ !window.app?.isDM?.());
  }).catch(() => {});
}

// ── Tab switching ──

function _switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('.dm-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.dm-tab-content').forEach(c => {
    c.classList.toggle('active', c.dataset.tab === tab);
  });
  if (tab === 'tunnel')    _renderTunnel();
  if (tab === 'spreuken')  _renderSpreuken();
  if (tab === 'tafels')    _loadAndRenderTafels();
  if (tab === 'monsters')  _loadAndRenderMonsters();
  if (tab === 'geluiden')  _renderGeluiden();
  if (tab === 'gevecht') {
    // Always reload monsters + entities so pickers are fresh
    Promise.all([
      api.listMonsters().then(d => { _monsters = d.monsters || []; }).catch(() => {}),
      api.listEntities('personages').then(list => { _setupPersonages = list || []; }).catch(() => {}),
    ]).then(() => {
      if (_activeTab !== 'gevecht') return;
      const isEmpty = !_combat?.active && (_combat?.combatants?.length || 0) === 0;
      if (isEmpty) _autoAddSpelers().then(() => _renderGevecht());
      else _renderGevecht();
    });
    _renderGevecht();
  }
}

// ── Spreuken ──

async function _loadSpells() {
  try {
    const r = await fetch('https://www.dnd5eapi.co/api/spells');
    const d = await r.json();
    _spellList = d.results || [];
  } catch {
    _spellList = [];
  }
  if (_activeTab === 'spreuken') _renderSpreuken();
}

function _renderSpreuken() {
  const el = document.querySelector('.dm-tab-content[data-tab="spreuken"]');
  if (!el) return;
  if (_spellDetail) { el.innerHTML = _spellDetailHtml(_spellDetail); return; }
  if (_spellList === null) _loadSpells();

  // Only rebuild the DOM when the search input doesn't exist yet
  if (!document.getElementById('dm-spell-search')) {
    el.innerHTML = `
      <div class="dm-feature-section" style="padding-bottom:8px">
        <input class="dm-input" id="dm-spell-search" placeholder="Zoek spreuk..."
          oninput="window.dmPanel.spellSearch(this.value)">
        <p id="dm-spell-loading" class="dm-hint" style="margin-top:6px"></p>
      </div>
      <p id="dm-spell-noresults" class="dm-hint" style="padding:0 12px;display:none">Geen resultaten gevonden.</p>
      <div id="dm-spell-results"></div>`;
    setTimeout(() => {
      const inp = document.getElementById('dm-spell-search');
      if (inp) { inp.value = _spellQuery; inp.focus(); }
    }, 0);
  }
  _updateSpellResults();
}

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
}

function _spellDetailHtml(s) {
  const schoolMap = {
    Abjuration: 'Afwering', Conjuration: 'Bezwering', Divination: 'Waarzeggerij',
    Enchantment: 'Betovering', Evocation: 'Oproeping', Illusion: 'Illusie',
    Necromancy: 'Necromantie', Transmutation: 'Transmutatie',
  };
  const levelStr = s.level === 0 ? 'Cantrip' : `Level ${s.level}`;
  const school   = schoolMap[s.school?.name] || s.school?.name || '';
  const comps    = [
    s.components?.includes('V') ? 'V' : '',
    s.components?.includes('S') ? 'G' : '',
    s.components?.includes('M') ? `M (${s.material || '…'})` : '',
  ].filter(Boolean).join(', ');
  const desc      = (s.desc || []).map(p => `<p class="dm-spell-p">${esc(p)}</p>`).join('');
  const higher    = s.higher_level?.length
    ? `<p class="dm-spell-p dm-spell-higher"><strong>Op hogere levels:</strong> ${esc(s.higher_level.join(' '))}</p>`
    : '';
  const wikidotSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return `
    <div class="dm-feature-section dm-spell-detail">
      <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.dmPanel.spellBack()" style="margin-bottom:10px">← Terug</button>
      <div class="dm-spell-name">${esc(s.name)}</div>
      <div class="dm-spell-meta">${levelStr} · ${school}${s.ritual ? ' · Ritueel' : ''}</div>
      <div class="dm-spell-props">
        <div><span>Uitvoertijd</span><span>${esc(s.casting_time)}</span></div>
        <div><span>Bereik</span><span>${esc(s.range)}</span></div>
        <div><span>Componenten</span><span>${esc(comps)}</span></div>
        <div><span>Duur</span><span>${esc(s.duration)}${s.concentration ? ' (concentratie)' : ''}</span></div>
      </div>
      <div class="dm-spell-desc">${desc}${higher}</div>
      <a class="dm-spell-link" href="https://dnd5e.wikidot.com/spell:${wikidotSlug}" target="_blank" rel="noopener">Wikidot →</a>
    </div>`;
}

async function _spellOpen(index) {
  const el = document.querySelector('.dm-tab-content[data-tab="spreuken"]');
  if (el) el.innerHTML = '<p class="dm-hint" style="padding:12px">Laden…</p>';
  try {
    const r  = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
    _spellDetail = await r.json();
    _renderSpreuken();
  } catch {
    if (el) el.innerHTML = '<p class="dm-hint" style="padding:12px">Laden mislukt.</p>';
  }
}

function _spellBack() {
  _spellDetail = null;
  _renderSpreuken();
}

function _spellSearch(q) {
  _spellQuery = q;
  _updateSpellResults();
}

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
}

function _showTunnelError(msg) {
  const el = document.getElementById('dm-tunnel-content');
  if (!el) return;
  const err = document.createElement('p');
  err.className = 'dm-hint dm-hint-error';
  err.textContent = '⚠️ ' + msg;
  el.appendChild(err);
  setTimeout(() => err.remove(), 6000);
}

function _tunnelCopy() {
  const url = window._dmPanelTunnelUrl;
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('dm-tunnel-copy');
    if (btn) { const orig = btn.textContent; btn.textContent = '✓'; setTimeout(() => { btn.textContent = orig; }, 1500); }
  });
}

async function _exportSnapshot() {
  const btn = document.getElementById('dm-export-btn');
  const icon = btn?.querySelector('.dm-tab-icon');
  if (icon) icon.textContent = '⏳';
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/export', { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'snapshot.html';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    if (icon) { icon.textContent = '✓'; setTimeout(() => { icon.textContent = '📥'; }, 2000); }
  } catch (err) {
    if (icon) { icon.textContent = '✕'; setTimeout(() => { icon.textContent = '📥'; }, 3000); }
  } finally {
    if (btn) btn.disabled = false;
  }
}

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
}

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
}

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
}

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
}

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
}

// ── Tafels ──

async function _loadAndRenderTafels() {
  try {
    _tables = await api.listTables();
  } catch { _tables = []; }
  _renderTafels();
}

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
               onclick="window.dmPanel.weerSeason(this)">${s}</button>`).join('')}
        </div>
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.weerGenereer()" title="Genereer weer">🎲</button>
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
          <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelRoll()" title="Gooien">🎲</button>
        </div>
        <div id="dm-tabel-result" class="dm-tabel-result hidden"></div>
        <div class="dm-feature-row dm-feature-row-sm">
          <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.tabelEdit(document.getElementById('dm-tabel-select').value)" title="Bewerken">✏️</button>
          <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.tabelDelete(document.getElementById('dm-tabel-select').value)" title="Verwijderen">✕</button>
          <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.tabelNew()" style="margin-left:auto" title="Nieuwe tafel">+</button>
        </div>
      ` : `
        <p class="dm-hint">Nog geen tabellen aangemaakt.</p>
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelNew()" title="Nieuwe tafel">+</button>
      `}
    </div>
  `;

}

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
        <button class="dm-btn dm-btn-ghost" onclick="window.dmPanel.tabelCancel()" title="Annuleren">✕</button>
      </div>
    </div>
  `;
}

function _renderTafelResult(results) {
  const el = document.getElementById('dm-tabel-result');
  if (!el) return;
  if (results === null) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  const items = Array.isArray(results) ? results : [results];
  el.innerHTML = items.map((r, i) =>
    `<span class="dm-tabel-result-text">${items.length > 1 ? `<span class="dm-tabel-num">${i + 1}.</span> ` : ''}${esc(r)}</span>`
  ).join('');
}

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
}

function _tabelEdit(id) {
  _editingTableId = id;
  const table = _tables.find(t => t.id === id);
  _editingTableType = table?.type || 'simple';
  _renderTafels();
}

async function _tabelDelete(id) {
  const table = _tables.find(t => t.id === id);
  if (!table) return;
  if (!confirm(`Tafel "${table.name}" verwijderen?`)) return;
  try {
    await api.deleteTable(id);
    _tables = _tables.filter(t => t.id !== id);
    _renderTafels();
  } catch (e) { alert('Fout: ' + e.message); }
}

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
}

function _tabelNew() {
  _editingTableId = '__new__';
  _editingTableType = 'simple';
  _renderTafels();
}

// ── Monsters ──

async function _loadAndRenderMonsters() {
  try {
    const data = await api.listMonsters();
    _monsters = data.monsters || [];
  } catch (e) {
    _monsters = [];
  }
  _renderMonsters();
}

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
        <button class="dm-btn dm-btn-sm dm-btn-primary" onclick="window.dmPanel.monsterAddToCombat('${esc(m.id)}')" title="Toevoegen aan gevecht">⚔️</button>
        <button class="dm-btn dm-btn-sm" onclick="window.dmPanel.monsterEdit('${esc(m.id)}')" title="Bewerken">✏️</button>
        <button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterDelete('${esc(m.id)}')" title="Verwijderen">✕</button>
      </div>
    </div>`;
}

function _metaHk() {
  return window.app?.state?.meta?.hoofdstukken || {};
}

function _hkLabel(key) {
  const hk = _metaHk();
  return hk[key] ? hk[key].short : key;
}

function _hkOptions(selectedKey) {
  const hk = _metaHk();
  return Object.entries(hk)
    .sort(([, a], [, b]) => a.num - b.num)
    .map(([k, v]) => `<option value="${esc(k)}"${selectedKey === k ? ' selected' : ''}>${esc(v.short)}</option>`)
    .join('');
}

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
}

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
    backdropId: _editingMonsterBackdropId,
  };

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input id="dm-mon-name" class="dm-input" value="${esc(m.name)}" placeholder="Monsternaam…">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Hoofdstuk</label>
        <select id="dm-mon-chapter" class="dm-select dm-select-sm">
          <option value="">— geen hoofdstuk —</option>
          ${_hkOptions(m.chapter)}
        </select>
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
          <label class="dm-btn dm-btn-sm dm-upload-label">
            Uploaden
            <input type="file" accept="image/*" style="display:none"
              onchange="window.dmPanel.monsterUpload('${m.id}', 'image', this)">
          </label>
          ${m.imageId ? `<button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterRemoveImage('image')" title="Verwijderen">✕</button>` : ''}
        </div>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Backdrop</label>
        <div class="dm-upload-row">
          ${m.backdropId
            ? `<img class="dm-mon-preview dm-mon-preview-wide" src="${api.fileUrl(m.backdropId)}" alt="">`
            : `<div class="dm-mon-preview dm-mon-preview-wide dm-mon-preview-empty">🌄</div>`}
          <label class="dm-btn dm-btn-sm dm-upload-label">
            Uploaden
            <input type="file" accept="image/*" style="display:none"
              onchange="window.dmPanel.monsterUpload('${m.id}', 'backdrop', this)">
          </label>
          ${m.backdropId ? `<button class="dm-btn dm-btn-sm dm-btn-danger-sm" onclick="window.dmPanel.monsterRemoveImage('backdrop')" title="Verwijderen">✕</button>` : ''}
        </div>
      </div>
      <div class="dm-feature-row" style="margin-top:4px">
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.monsterSave()" title="Opslaan">✓</button>
        <button class="dm-btn dm-btn-ghost"   onclick="window.dmPanel.monsterCancel()" title="Annuleren">✕</button>
      </div>
    </div>
  `;
}

function _monsterNew() {
  _editingMonsterId        = 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  _editingMonsterIsNew     = true;
  _editingMonsterImageId   = null;
  _editingMonsterBackdropId = null;
  _renderMonsters();
}

function _monsterEdit(id) {
  const m = _monsters.find(x => x.id === id);
  if (!m) return;
  _editingMonsterId        = id;
  _editingMonsterIsNew     = false;
  _editingMonsterImageId   = m.imageId   || null;
  _editingMonsterBackdropId = m.backdropId || null;
  _renderMonsters();
}

function _monsterFilterChapter(chapter) {
  _monsterChapterFilter = chapter;
  _monsterPage = 0;
  _renderMonsters();
}

function _monsterPage_set(page) {
  _monsterPage = page;
  _renderMonsters();
}

function _monsterCancel() {
  _editingMonsterId = null;
  _editingMonsterIsNew = false;
  _renderMonsters();
}

async function _monsterSave() {
  const name    = document.getElementById('dm-mon-name')?.value.trim();
  const chapter = document.getElementById('dm-mon-chapter')?.value.trim() || '';
  const maxHp   = parseInt(document.getElementById('dm-mon-hp')?.value)   || 10;
  const init    = parseInt(document.getElementById('dm-mon-init')?.value) || 10;
  if (!name) { alert('Voer een naam in.'); return; }
  const payload = { name, chapter, maxHp, initiative: init, imageId: _editingMonsterImageId, backdropId: _editingMonsterBackdropId };
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
}

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
}

async function _monsterUpload(monsterId, type, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const fileId = type === 'image' ? `${monsterId}_img` : `${monsterId}_bg`;
  try {
    await api.uploadFile(fileId, file);
    if (type === 'image') _editingMonsterImageId   = fileId;
    else                  _editingMonsterBackdropId = fileId;
    // For existing monsters, persist immediately
    if (!_editingMonsterIsNew) {
      const patch = type === 'image' ? { imageId: fileId } : { backdropId: fileId };
      const updated = await api.updateMonster(monsterId, patch);
      const idx = _monsters.findIndex(m => m.id === monsterId);
      if (idx !== -1) _monsters[idx] = updated;
    }
    _renderMonsters();
  } catch (e) { alert('Upload mislukt: ' + e.message); }
}

async function _monsterRemoveImage(type) {
  const fileId = type === 'image' ? _editingMonsterImageId : _editingMonsterBackdropId;
  if (fileId) api.deleteFile(fileId).catch(() => {});
  if (type === 'image') _editingMonsterImageId   = null;
  else                  _editingMonsterBackdropId = null;
  if (!_editingMonsterIsNew) {
    const patch = type === 'image' ? { imageId: null } : { backdropId: null };
    try {
      const updated = await api.updateMonster(_editingMonsterId, patch);
      const idx = _monsters.findIndex(m => m.id === _editingMonsterId);
      if (idx !== -1) _monsters[idx] = updated;
    } catch (_) {}
  }
  _renderMonsters();
}

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
      backdropId: m.backdropId || null,
      presetId:   m.id,
    });
    _switchTab('gevecht');
  } catch (e) { alert('Toevoegen aan gevecht mislukt: ' + e.message); }
}

// ── Gevecht ──

function _setupTypeChange(type) {
  _setupSelectedType     = type;
  _setupSelectedPresetId  = null;
  _setupSelectedEntityId  = null;
  _renderGevecht();
}

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
}

function _setupEntityChange(entityId) {
  _setupSelectedEntityId = entityId || null;
  const e = _setupPersonages.find(x => x.id === entityId);
  const nameEl  = document.getElementById('dm-setup-name');
  const maxhpEl = document.getElementById('dm-setup-maxhp');
  if (e) {
    if (nameEl)  nameEl.value  = e.name;
    if (maxhpEl) maxhpEl.value = parseInt(e.stats?.hp) || 10;
  } else {
    if (nameEl) nameEl.value = '';
  }
}

async function _autoAddSpelers() {
  const spelers = _setupPersonages.filter(e => e.subtype === 'speler');
  for (const e of spelers) {
    const hp = parseInt(e.stats?.hp) || 10;
    await api.addCombatant({
      name:       e.name,
      type:       'player',
      initiative: 10,
      hp,
      maxHp:      hp,
      entityId:   e.id,
    }).catch(() => {});
  }
  _combat = await api.getCombat().catch(() => _combat);
}

async function _setupAddSubmit() {
  const name  = document.getElementById('dm-setup-name')?.value.trim();
  const init  = parseInt(document.getElementById('dm-setup-init')?.value)  || 0;
  const maxHp = parseInt(document.getElementById('dm-setup-maxhp')?.value) || 10;
  if (!name) return;

  const payload = { name, type: _setupSelectedType, initiative: init, hp: maxHp, maxHp };

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
}

async function _setupReset() {
  if (!confirm('Remove all combatants?')) return;
  try {
    await api.endCombat();
    _combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
    _renderCombatOverlay(_combat);
    await _autoAddSpelers();
    _renderGevecht();
  } catch (e) { alert('Fout: ' + e.message); }
}

async function _combatStart() {
  if ((_combat?.combatants?.length || 0) === 0) {
    alert('Add combatants first.'); return;
  }
  try {
    _combat = await api.startCombat();
    _renderGevecht();
    _renderCombatOverlay(_combat);
  } catch (e) { alert('Fout: ' + e.message); }
}

async function _combatEnd() {
  if (!confirm('End combat?')) return;
  try {
    await api.endCombat();
    _combat = { active: false, round: 1, currentTurn: 0, combatants: [] };
    _renderGevecht();
    _renderCombatOverlay(_combat);
  } catch (e) { alert('Fout: ' + e.message); }
}

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
}

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
}

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
}

async function _combatAddSubmit() {
  const name  = document.getElementById('co-add-name')?.value.trim();
  const type  = document.getElementById('co-add-type')?.value || 'monster';
  const init  = parseInt(document.getElementById('co-add-init')?.value) || 0;
  const maxHp = parseInt(document.getElementById('co-add-maxhp')?.value) || 10;
  if (!name) return;
  try {
    await api.addCombatant({ name, type, initiative: init, hp: maxHp, maxHp });
    document.getElementById('co-add-form')?.classList.add('hidden');
  } catch (e) { alert('Fout: ' + e.message); }
}

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
}

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
}

// ── Speler past eigen HP aan in gevecht ──

async function _playerHpChange(id, delta) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  const newHp = Math.max(0, Math.min(c.maxHp || 999, (c.hp || 0) + delta));
  try { await api.combatPlayerHp(id, newHp); }
  catch (e) { console.error(e); }
}

async function _playerHpInput(id, val) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  const newHp = Math.max(0, Math.min(c.maxHp || 999, parseInt(val) || 0));
  try { await api.combatPlayerHp(id, newHp); }
  catch (e) { console.error(e); }
}

async function _combatThpChange(id, delta) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  try { await api.updateCombatant(id, { tempHp: Math.max(0, (c.tempHp || 0) + delta) }); }
  catch (e) { console.error(e); }
}

async function _combatThpInput(id, val) {
  const newThp = parseInt(val);
  if (isNaN(newThp)) return;
  try { await api.updateCombatant(id, { tempHp: Math.max(0, newThp) }); }
  catch (e) { console.error(e); }
}

async function _combatInitChange(id, val) {
  const init = parseInt(val);
  if (isNaN(init)) return;
  try { await api.updateCombatant(id, { initiative: init }); }
  catch (e) { console.error(e); }
}

async function _combatCondToggle(id, condId) {
  const c = _combat?.combatants?.find(x => x.id === id);
  if (!c) return;
  let conditions = [...(c.conditions || [])];
  conditions = conditions.includes(condId)
    ? conditions.filter(x => x !== condId)
    : [...conditions, condId];
  try { await api.updateCombatant(id, { conditions }); }
  catch (e) { console.error(e); }
}

async function _combatRemove(id) {
  try { await api.removeCombatant(id); }
  catch (e) { alert('Fout: ' + e.message); }
}

async function _combatSetWinner(winner) {
  try { await api.setCombatWinner(winner); }
  catch (e) { alert('Fout: ' + e.message); }
}

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
}

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
}

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
}

async function _sndUploadFile(file) {
  const id = `snd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fd = new FormData();
  fd.append('file', file);
  await fetch(`/api/files/${id}`, { method: 'POST', body: fd });
  return id;
}

async function _sndGetData() {
  const r = await fetch('/api/sounds');
  return r.ok ? r.json() : { standard: { damage: null, healing: null, win: null, loss: null }, emotes: {} };
}

function _sndPlayerData(sounds, pid) {
  const raw = sounds.emotes?.[pid];
  // Support both old flat-array format and new {library, selected} format
  if (!raw || Array.isArray(raw)) return { library: [], selected: [] };
  return { library: raw.library || [], selected: raw.selected || [] };
}

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
               <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndRemoveStd('${key}')">✕</button>`
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
               <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndRemovePlayerTurn('${esc(p.id)}')">✕</button>`
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
                 <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window._sndClearFile('${esc(p.id)}','${esc(item.id)}')">✕</button>`
              : `<span class="dm-sound-empty">Geen audio</span>`}
            <label class="dm-btn dm-btn-sm dm-btn-primary dm-sound-upload-btn" title="Uploaden">
              ↑
              <input type="file" accept="audio/*" style="display:none"
                onchange="window._sndUploadEmote('${esc(p.id)}','${esc(item.id)}',this)">
            </label>
            <button class="dm-btn dm-btn-sm dm-btn-danger" onclick="window._sndDeleteEmote('${esc(p.id)}','${esc(item.id)}')" title="Emote verwijderen">🗑</button>
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
            onclick="window._sndAddEmote('${esc(p.id)}')">+ Emote toevoegen</button>
        </div>
      </div>`;
  }).join('');

  const stdOpen = _sndOpenPid === '__std__';
  el.innerHTML = `
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
}

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
        <p class="dm-hint">⚔️ Combat active — Round ${_combat.round}. The combat screen is visible to everyone.</p>
        <button class="dm-btn dm-btn-danger" onclick="window.dmPanel.combatEnd()" title="End combat">✕</button>
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
              <span class="dm-setup-meta">Init ${c.initiative} · ${c.maxHp} HP</span>
              <button class="dm-combatant-remove" onclick="window.dmPanel.combatRemove('${esc(c.id)}')">✕</button>
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
        ${_setupSelectedType === 'player' && _setupPersonages.some(e => e.subtype === 'speler') ? `
          <select id="dm-setup-entity" class="dm-select"
              onchange="window.dmPanel.setupEntityChange(this.value)">
            <option value="">— Handmatig invoeren —</option>
            ${_setupPersonages.filter(e => e.subtype === 'speler').map(e => `<option value="${esc(e.id)}" ${_setupSelectedEntityId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
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
          <input id="dm-setup-init" class="dm-input dm-input-sm" type="number" placeholder="Init" value="10" style="width:64px">
          <input id="dm-setup-maxhp" class="dm-input dm-input-sm" type="number" placeholder="Max HP" value="10" style="width:72px">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.dmPanel.setupAddSubmit()" title="Toevoegen">+</button>
        </div>
      </div>
      <div class="dm-feature-row" style="margin-top:8px">
        ${cs.length > 0 ? `<button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.setupReset()" title="Reset">↺</button>` : ''}
        <button class="dm-btn dm-btn-primary" style="margin-left:auto"
          onclick="window.dmPanel.combatStart()" ${cs.length === 0 ? 'disabled' : ''} title="Start gevecht">⚔️</button>
      </div>
    </div>
  `;
}

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

  const condPicker = CONDITIONS.map(cond => {
    const active = (c.conditions || []).includes(cond.id);
    return `<button class="co-cond-pick${active ? ' active' : ''}"
      onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cond.id}')"
      title="${esc(cond.desc)}">${esc(cond.label)}</button>`;
  }).join('');

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
      <button class="co-ds-btn co-ds-yes" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','success')">✓</button>
      <button class="co-ds-btn co-ds-no"  onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','failure')">✗</button>
      <button class="co-ds-btn co-ds-rst" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','reset')">↺</button>
    </div>` : '';

  panel.innerHTML = `
    <div class="co-detail-name">
      <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}" style="width:10px;height:10px;flex-shrink:0"></span>
      ${esc(c.name)}
      ${isDM ? `
        <label class="co-init-wrap" style="margin-left:8px;font-size:11px">Init
          <input class="co-init-input" type="number" value="${c.initiative}"
            onchange="window.dmPanel.combatInitChange('${esc(c.id)}',this.value)" style="width:44px">
        </label>
        <button class="co-remove-btn" onclick="window.dmPanel.combatRemove('${esc(c.id)}');window.dmPanel.combatSelectCombatant(null)" title="Verwijder">✕</button>
      ` : ''}
      <button class="co-detail-close" onclick="window.dmPanel.combatSelectCombatant(null)">✕</button>
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
    <div class="co-thp-row">
      <span class="co-thp-label" title="Temporary HP">🛡️</span>
      <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',-1)">−</button>
      <input class="co-thp-input" type="number" min="0" value="${c.tempHp || 0}"
        onchange="window.dmPanel.combatThpInput('${esc(c.id)}',this.value)">
      <button class="co-hp-btn" onclick="window.dmPanel.combatThpChange('${esc(c.id)}',1)">+</button>
    </div>
    <div class="co-cond-picker">${condPicker}</div>
    ` : `
    ${(c.conditions || []).length ? `<div class="co-active-conds">${(c.conditions || []).map(cid => {
      const cond = CONDITIONS.find(x => x.id === cid);
      return cond ? `<span class="co-cond-chip" title="${esc(cond.desc)}">${esc(cond.label)}</span>` : '';
    }).join('')}</div>` : ''}
    `}
    ${deathSaves}
  `;
  panel.classList.remove('hidden');
}

// Combat overlay — zichtbaar voor iedereen tijdens gevecht
function _renderCombatOverlay(combat, startMinimized = false) {
  const overlay = document.getElementById('combat-overlay');
  if (!overlay) return;

  if (!combat?.active) {
    overlay.classList.add('hidden');
    overlay.classList.remove('minimized');
    return;
  }
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

  const rows = cs.map((c, i) => {
    const isActive = turnGroup.includes(i);
    const hp    = hpStatus(c.hp, c.maxHp);
    const hpPct = c.maxHp > 0 ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
    const conds = (c.conditions || []).map(cid => {
      const cond = CONDITIONS.find(x => x.id === cid);
      return cond
        ? `<span class="co-cond-chip${isDM ? ' co-cond-dm' : ''}" title="${esc(cond.desc)}"
            ${isDM ? `onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cid}')"` : ''}
           >${esc(cond.label)}${isDM ? ' ✕' : ''}</span>`
        : '';
    }).join('');

    if (isDM) {
      const condPicker = CONDITIONS.map(cond => {
        const active = (c.conditions || []).includes(cond.id);
        return `<button class="co-cond-pick${active ? ' active' : ''}"
          onclick="window.dmPanel.combatCondToggle('${esc(c.id)}','${cond.id}')"
          title="${esc(cond.desc)}">${esc(cond.label)}</button>`;
      }).join('');

      return `
        <div class="co-row${isActive ? ' co-row-active' : ''}">
          <div class="co-row-head">
            <span class="co-turn-num">${i + 1}</span>
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}"></span>
            <span class="co-name">${isActive ? '▶ ' : ''}${esc(c.name)}</span>
            <label class="co-init-wrap">Init
              <input class="co-init-input" type="number" value="${c.initiative}"
                onchange="window.dmPanel.combatInitChange('${esc(c.id)}',this.value)"
                onclick="event.stopPropagation()">
            </label>
            <button class="co-remove-btn" onclick="window.dmPanel.combatRemove('${esc(c.id)}')">✕</button>
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
            <span class="co-thp-label" title="Temporary Hit Points">🛡️</span>
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
                <button class="co-ds-btn co-ds-yes" onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','success')" title="Success">✓</button>
                <button class="co-ds-btn co-ds-no"  onclick="window.dmPanel.combatDeathSave('${esc(c.id)}','failure')" title="Failure">✗</button>
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
          <div class="co-row${isActive ? ' co-row-active' : ''} co-row-own">
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
            ${(c.tempHp || 0) > 0 ? `<div class="co-hp-player-row"><span class="co-thp-badge" title="Temporary Hit Points">🛡️ +${c.tempHp}</span></div>` : ''}
            ${conds ? `<div class="co-active-conds">${conds}</div>` : ''}
          </div>
        `;
      }

      // Andere combatants: alleen balk + status + conditions
      return `
        <div class="co-row${isActive ? ' co-row-active' : ''}">
          <div class="co-row-head">
            <span class="co-turn-num">${i + 1}</span>
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : c.type === 'summon' ? 'co-type-summon' : 'co-type-monster'}"></span>
            <span class="co-name">${isActive ? '▶ ' : ''}${esc(c.name)}</span>
            <span class="co-init-display">Init ${c.initiative}</span>
          </div>
          <div class="co-hp-player-row">
            <div class="co-hp-bar-wrap"><div class="co-hp-bar ${hp.cls}" style="width:${hpPct}%"></div></div>
            <span class="co-hp-label ${hp.cls}">${hp.label}</span>
            ${(c.tempHp || 0) > 0 ? `<span class="co-thp-badge" title="Temporary Hit Points">🛡️ +${c.tempHp}</span>` : ''}
            ${conds ? `<span class="co-conds">${conds}</span>` : ''}
          </div>
        </div>
      `;
    }
  }).join('');

  inner.innerHTML = `
    <div class="co-header">
      <span class="co-title">⚔️ Gevecht</span>
      <span class="co-round">Ronde ${combat.round}</span>
      <span class="co-current-name">▶ ${esc(currentLabel)}</span>
      <button class="co-minimize-btn" onclick="document.getElementById('combat-overlay').classList.contains('minimized')?window.dmPanel.combatExpand():window.dmPanel.combatMinimize()" title="Minimaliseren/maximaliseren">▼</button>
      ${isDM ? `<button class="co-end-btn" onclick="event.stopPropagation();window.dmPanel.combatEnd()" title="Gevecht beëindigen">✕</button>` : ''}
    </div>
    <canvas id="combat-canvas" class="co-canvas"></canvas>
    ${isDM ? `
      <div class="co-turn-controls">
        ${!combat.winner ? `
          <button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatPrevTurn()" title="Vorige beurt">◀</button>
          <button class="co-ctrl-btn co-ctrl-primary" onclick="window.dmPanel.combatNextTurn()" title="Volgende beurt">▶</button>
        ` : ''}
        <button class="co-ctrl-btn co-win-btn"  onclick="window.dmPanel.combatSetWinner('players')"  title="Spelers winnen" style="${combat.winner === 'players'  ? 'opacity:1' : 'opacity:0.55'}">🏆</button>
        <button class="co-ctrl-btn co-lose-btn" onclick="window.dmPanel.combatSetWinner('monsters')" title="Monsters winnen" style="${combat.winner === 'monsters' ? 'opacity:1' : 'opacity:0.55'}">💀</button>
        ${combat.winner ? `<button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatSetWinner(null)" title="Reset winnaar" style="margin-left:4px">↺</button>` : ''}
        <button class="co-ctrl-btn co-ctrl-ghost co-add-btn" onclick="window.dmPanel.combatAddForm()" style="margin-left:auto" title="Deelnemer toevoegen">+</button>
      </div>
      <div id="co-add-form" class="co-add-form hidden">
        <div class="co-add-row">
          <input id="co-add-name" class="co-input" placeholder="Naam…"
            onkeydown="if(event.key==='Enter')window.dmPanel.combatAddSubmit()">
          <select id="co-add-type" class="co-select">
            <option value="monster">Monster</option>
            <option value="summon">Summon</option>
            <option value="ally">Medestander</option>
            <option value="player">Speler</option>
          </select>
          <input id="co-add-init" class="co-input co-input-sm" type="number" placeholder="Init" value="10">
          <input id="co-add-maxhp" class="co-input co-input-sm" type="number" placeholder="Max HP" value="10">
          <button class="co-ctrl-btn co-ctrl-primary" onclick="window.dmPanel.combatAddSubmit()">+</button>
          <button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatAddCancel()">✕</button>
        </div>
      </div>
      <div id="co-detail-panel" class="co-detail-panel hidden"></div>
      <div id="co-dm-emote-bar" class="co-emote-bar"></div>
    ` : `
      <div id="co-detail-panel" class="co-detail-panel hidden"></div>
      <div id="co-emote-bar" class="co-emote-bar"></div>
    `}
    ${(combat.log?.length > 0) ? `
    <details class="co-log">
      <summary class="co-log-summary">📜 Gevechtslog (${combat.log.length})</summary>
      <div class="co-log-entries" id="co-log-entries">
        ${[...combat.log].slice(-30).map(e =>
          `<div class="co-log-entry"><span class="co-log-round">R${e.round}</span> ${esc(e.text)}</div>`
        ).join('')}
      </div>
    </details>` : ''}
  `;

  // Start canvas animation loop
  const canvasEl = document.getElementById('combat-canvas');
  if (canvasEl) canvasInit(canvasEl, combat);

  // Herstel detail-panel als een combatant geselecteerd was
  if (_selectedCombatantId) _combatSelectCombatant(_selectedCombatantId);

  // Emote-balken asynchroon vullen
  if (isDM) {
    _populateDmEmoteBar(combat).catch(() => {});
  } else {
    _populateEmoteBar(combat).catch(() => {});
  }
}

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
}

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
}
