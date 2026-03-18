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
let _monsters = [];
let _editingMonsterId        = null;
let _editingMonsterIsNew     = false;
let _editingMonsterImageId   = null;
let _editingMonsterBackdropId = null;
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

    // Tunnel
    tunnelToggle:  _tunnelToggle,
    tunnelCopy:    _tunnelCopy,

    // Tafels
    tabelRoll:     _tabelRoll,
    tabelEdit:     _tabelEdit,
    tabelDelete:   _tabelDelete,
    tabelSave:     _tabelSave,
    tabelNew:      _tabelNew,
    naamGenereer:  _naamGenereer,
    tabelCancel:   () => { _editingTableId = null; _renderTafels(); },
    tabelTypeChange(val) { _editingTableType = val; _renderTafels(); },
    tabelSelect:   (id) => {
      document.getElementById('dm-tabel-select').value = id;
      _renderTafelResult(null);
    },

    // Monster library
    monsterNew:         _monsterNew,
    monsterEdit:        _monsterEdit,
    monsterCancel:      _monsterCancel,
    monsterSave:        _monsterSave,
    monsterDelete:      _monsterDelete,
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
    combatThpChange:  _combatThpChange,
    combatThpInput:   _combatThpInput,
    combatInitChange: _combatInitChange,
    combatCondToggle:  _combatCondToggle,
    combatRemove:      _combatRemove,
    combatSetWinner:   _combatSetWinner,
    combatDeathSave:   _combatDeathSave,

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
  if (tab === 'tunnel')   _renderTunnel();
  if (tab === 'tafels')   _loadAndRenderTafels();
  if (tab === 'monsters') _loadAndRenderMonsters();
  if (tab === 'gevecht') {
    // Always reload monsters + entities so pickers are fresh
    Promise.all([
      api.listMonsters().then(d => { _monsters = d.monsters || []; }).catch(() => {}),
      api.listEntities('personages').then(list => { _setupPersonages = list || []; }).catch(() => {}),
    ]).then(() => { if (_activeTab === 'gevecht') _renderGevecht(); });
    _renderGevecht();
  }
  // spreuken has no dynamic content
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

  const hasTables = _tables.length > 0;
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
      <div class="dm-section-label">Tables</div>
      ${hasTables ? `
        <div class="dm-feature-row">
          <select id="dm-tabel-select" class="dm-select" onchange="window.dmPanel.tabelSelect(this.value)">
            ${_tables.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}
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
        <p class="dm-hint">No tables created yet.</p>
        <button class="dm-btn dm-btn-primary" onclick="window.dmPanel.tabelNew()" title="New table">+</button>
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
  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-form-row">
        <label class="dm-form-label">Name</label>
        <input id="dm-tbl-name" class="dm-input" value="${esc(table.name)}" placeholder="Table name…">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Type</label>
        <select id="dm-tbl-type" class="dm-select" onchange="window.dmPanel.tabelTypeChange(this.value)">
          <option value="simple"   ${!isCombined ? 'selected' : ''}>Simple table</option>
          <option value="combined" ${isCombined  ? 'selected' : ''}>Name generator (2×d100)</option>
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
  } else {
    const entries = table.entries || [];
    if (entries.length === 0) { _renderTafelResult('Table is empty'); return; }
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
  if (!confirm(`Delete table "${table.name}"?`)) return;
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

function _renderMonsters() {
  const el = document.getElementById('dm-monsters-content');
  if (!el) return;
  if (_editingMonsterId !== null) { _renderMonsterEditor(el); return; }

  el.innerHTML = `
    <div class="dm-feature-section">
      <div class="dm-feature-row">
        <div class="dm-section-label" style="flex:1">Monsterbibliotheek</div>
        <button class="dm-btn dm-btn-sm dm-btn-ghost" onclick="window.dmPanel.monsterNew()" title="Nieuw monster">+</button>
      </div>
      ${_monsters.length === 0
        ? `<p class="dm-hint">Nog geen monsters. Voeg er een toe met +.</p>`
        : `<div class="dm-monster-list">
            ${_monsters.map(m => `
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
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;
}

function _renderMonsterEditor(el) {
  const isNew  = _editingMonsterIsNew;
  const stored = _monsters.find(m => m.id === _editingMonsterId) || {};
  const m = {
    id:         _editingMonsterId,
    name:       stored.name        || '',
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

function _monsterCancel() {
  _editingMonsterId = null;
  _editingMonsterIsNew = false;
  _renderMonsters();
}

async function _monsterSave() {
  const name  = document.getElementById('dm-mon-name')?.value.trim();
  const maxHp = parseInt(document.getElementById('dm-mon-hp')?.value)   || 10;
  const init  = parseInt(document.getElementById('dm-mon-init')?.value) || 10;
  if (!name) { alert('Voer een naam in.'); return; }
  const payload = { name, maxHp, initiative: init, imageId: _editingMonsterImageId, backdropId: _editingMonsterBackdropId };
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

  if (_setupSelectedType === 'player' && _setupSelectedEntityId) {
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
    _renderGevecht();
    _renderCombatOverlay(_combat);
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
// Monsters met dezelfde initiative delen een beurt; spelers altijd individueel.
function _getTurnGroup(combatants, currentTurn) {
  const current = combatants[currentTurn];
  if (!current) return [currentTurn];
  if (current.type === 'player') return [currentTurn];
  const init = current.initiative;
  return combatants
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.type === 'monster' && c.initiative === init)
    .map(({ i }) => i);
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
              <span class="dm-combatant-type-dot ${c.type === 'player' ? 'dm-type-player' : 'dm-type-monster'}"></span>
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
            <option value="monster" ${_setupSelectedType === 'monster' ? 'selected' : ''}>Monster</option>
            <option value="player"  ${_setupSelectedType === 'player'  ? 'selected' : ''}>Speler</option>
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
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : 'co-type-monster'}"></span>
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
      return `
        <div class="co-row${isActive ? ' co-row-active' : ''}">
          <div class="co-row-head">
            <span class="co-type-dot ${c.type === 'player' ? 'co-type-player' : 'co-type-monster'}"></span>
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
            <option value="player">Speler</option>
          </select>
          <input id="co-add-init" class="co-input co-input-sm" type="number" placeholder="Init" value="10">
          <input id="co-add-maxhp" class="co-input co-input-sm" type="number" placeholder="Max HP" value="10">
          <button class="co-ctrl-btn co-ctrl-primary" onclick="window.dmPanel.combatAddSubmit()">+</button>
          <button class="co-ctrl-btn co-ctrl-ghost" onclick="window.dmPanel.combatAddCancel()">✕</button>
        </div>
      </div>
      <div class="co-body">${rows}</div>
    ` : ''}
  `;

  // Start canvas animation loop
  const canvasEl = document.getElementById('combat-canvas');
  if (canvasEl) canvasInit(canvasEl, combat);
}
