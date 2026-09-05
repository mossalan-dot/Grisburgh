import { api, campagneUitUrl, zetCampagne } from './api.js?v=263';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor, WEAPON_PROPERTIES, PARAMETERIZABLE_PROPS } from "./render-campagne.js?v=134";
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from "./render-archief.js?v=75";
import { renderKaart, queueFlyTo } from './render-kaart.js?v=19';
import { renderDungeon } from './render-dungeon.js?v=33';
import { renderRelatiemap } from './render-relatiemap.js?v=22';
import { renderProgressie } from './render-progressie.js?v=44';
import { renderBestiarium } from './render-bestiarium.js?v=20';
import { renderSpreuken } from './render-spreuken.js?v=15';
import { renderStatblock } from './render-statblock.js?v=3';
import { initSocket } from "./socket-client.js?v=59";
import { initDmPanel } from "./dm-panel.js?v=197";
import './media-picker.js?v=7';

// ── Icon helper ──
// Renders an inline SVG <use> reference from /img/icons.svg.
// Usage: icon('eye')  or  icon('crossed-swords', { cls: 'icon-gi', title: 'Combat' })
window.icon = function icon(name, { cls = '', title = '' } = {}) {
  const t   = title ? `<title>${title.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</title>` : '';
  const aria = title ? ' role="img"' : ' aria-hidden="true"';
  return `<svg class="icon${cls ? ' '+cls : ''}"${aria} focusable="false"><use href="/img/icons.svg?v=8#icon-${name}"/>${t}</svg>`;
};
const icon = (...a) => window.icon(...a);

// ── Muntnamen ──
// De campagne bepaalt hoe haar munten heten; valt die keuze weg, dan is de
// D&D-standaard het vangnet — niet Grisburgh's Florinde/Knaker/Centeling, want
// die zag een andere campagne dan ineens in haar eigen beurs staan.
const MUNT_STANDAARD = { fl: 'Gold', kn: 'Silver', cl: 'Copper' };
window._muntNamen = () => window._currency || window.app?.state?.meta?.currency || MUNT_STANDAARD;

// Waar de tekst een plaatsnaam noemt, is dat de naam van de campagne — Grisburgh
// stond er tot nu toe letterlijk in.
window._campagneNaam = () => window.app?.state?.meta?.appTitle || 'de campagne';

// ── Namen van diensten ──
// Elke dienst heeft zijn naam al in meta staan (meta.herberg.naam en zo); alleen
// de zijbalk toonde nog de namen van Grisburgh, hardcoded in de HTML. Zonder
// eigen naam valt hij terug op wát het is, niet op hoe het hier heet.
const _DIENST_STANDAARD = {
  herberg: 'Herberg', tweespalt: 'Arena', gock: 'Detective', ursula: 'Waarzegger',
  tempel: 'Tempel', magizoo: 'Magizoöloog', facties: 'Facties', heeren: 'Dievengilde',
};
window._dienstNaam = (key) => {
  const eigen = window.app?.state?.meta?.[key]?.naam;
  return (typeof eigen === 'string' && eigen.trim()) || _DIENST_STANDAARD[key] || key;
};

function _zetDienstLabels() {
  for (const key of Object.keys(_DIENST_STANDAARD)) {
    const el = document.getElementById(`diensten-${key}-label`);
    if (el) el.textContent = window._dienstNaam(key);
  }
}

// ── Display mode detectie (iPad kiosk) ──
// `?display=1` zette elk bezoekend scherm meteen in tabletmodus, ook zonder
// inloggen — en omdat het in localStorage belandt, blijft dat scherm er daarna
// in hangen. Sinds tabletmodus geen eigen wachtwoord meer heeft, hoort de vraag
// bij een sessie: de DM zet dít scherm om. De vlag wordt daarom pas ingelost in
// init(), zodra bekend is wie er kijkt. Een scherm dat al is omgezet blijft
// gewoon tabletmodus houden.
const _displayGevraagd = new URLSearchParams(location.search).get('display');
if (_displayGevraagd === '0') localStorage.removeItem('displayMode');
window._isDisplayMode = localStorage.getItem('displayMode') === '1';
if (window._isDisplayMode) document.body.classList.add('display-mode');

// Zet dit scherm alsnog om, nu de rol bekend is.
function _displayModeInlossen() {
  if (window._isDisplayMode || _displayGevraagd !== '1') return;
  if (state.role !== 'dm' && !state.characterId) return;   // niemand ingelogd: geen kiosk
  try { localStorage.setItem('displayMode', '1'); } catch { /* privémodus */ }
  window._isDisplayMode = true;
  document.body.classList.add('display-mode');
}

// ── App State ──
const state = {
  role:        'player',
  dmPreview:   false,   // true = DM authenticated but viewing as player
  isSandbox:   false,   // true = ingelogd als sandbox-DM (demo omgeving)
  playerName:  null,    // naam van ingelogde speler (of null als anoniem)
  characterId: null,    // ID van bijbehorend personage-kaartje
  activeSection: 'personages',
  meta: null,
  dienstenToegang: {},  // { herberg:'beschikbaar', ... } per groep
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Gevecht: monster stat block panel voor spelers ──────────────────────────
const _combatMonsterCache = new Map();  // combatant id → combatant object

function openCombatMonsterPanel(c) {
  const existing = document.getElementById('combat-monster-panel');
  if (existing) existing.remove();

  const niveau = c._niveau || 'naam';
  const NIV_LABEL = { naam: 'Naam bekend', deels: 'Deels onderzocht', volledig: 'Volledig onderzocht' };

  // Bouw een tijdelijk monster-object voor renderStatblock
  const m = c._statblock ? {
    ...c._statblock,
    name: c._statblock.name || c.name,
    _niveau: niveau,
  } : { name: c.name, _niveau: niveau, statblock: {} };

  const html = renderStatblock(m, { niveau });

  const panel = document.createElement('div');
  panel.id = 'combat-monster-panel';
  panel.className = 'combat-monster-panel';
  panel.innerHTML = `
    <div class="cmp-backdrop" onclick="document.getElementById('combat-monster-panel')?.remove()"></div>
    <div class="cmp-sheet">
      <div class="cmp-header">
        <span class="cmp-tier-badge cmp-tier-${niveau}">${NIV_LABEL[niveau] || niveau}</span>
        <button class="cmp-close" onclick="document.getElementById('combat-monster-panel')?.remove()">${window.icon?.('x') || '✕'}</button>
      </div>
      <div class="cmp-body">${html}</div>
    </div>`;
  document.body.appendChild(panel);
}

// ── Expose globals ──
window.app = {
  state,
  $, $$,
  isDM:        () => state.role === 'dm' && !state.dmPreview,
  isPlayer:    () => state.role === 'player' && !!state.playerName,
  toggleLoginModal,
  closeLoginModal,
  login,
  logout,
  dmLogout,
  toggleSandboxModal,
  closeSandboxModal,
  sandboxLoginSubmit,
  toggleTabletModal,
  closeTabletModal,
  tabletLoginSubmit,
  testLogin,
  closeTestLoginModal,
  testLoginSubmit,
  _landingShowFooterPrompt,
  _landingDmLogin,
  _landingSandboxLogin,
  _landingTabletLogin,
  _landingTestLogin,
  dmToggleClick,
  onFabClick,
  openModal,
  closeModal,
  openLightbox,
  openLightboxAt,
  lbNavigate,
  lbZoomIn,
  lbZoomOut,
  lbZoomReset,
  closeLightbox,
  refreshSection,
  switchSection,
  esc,
  escJS,
  mdToHtml,
  renderSpellDesc: _renderSpellDesc,
  sbDiceColor: _sbDiceColor,
  spellClassEN: _spellClassEN,
  spellMatchesClass: _spellMatchesClass,
  switchGroup,
  toggleGroupDropdown,
  renameGroup,
  newGroup,
  deleteGroup,
  setGroupPassword,
  editHeader,
  saveHeader,
  cancelHeader,
  applyAppMeta,
  showLanding,
  landingToegang,
  landingDmVeld,
  hideLanding,
  _landingPortraitClick,
  openPlayerPicker,
  closePlayerPicker,
  playerLogin,
  playerLogout,
  playerLogoutVraag,
  toggleArchiefMenu,
  closeArchiefMenu,
  toggleDienstenMenu,
  closeDienstenMenu,
  toggleLogboekMenu,
  closeLogboekMenu,
  setActiveAkte,
  stopAkte,
  activateDisplayMode() {
    localStorage.setItem('displayMode', '1');
    window._isDisplayMode = true;
    document.body.classList.add('display-mode');
    hideLanding();
    _initDisplayMode();
  },
  openCombatMonsterPanel,
  showMissieAanvraagToast,
  _tsToast,
};
window._combatMonsterCache = _combatMonsterCache;

// ── Actieve akte (reveal-modus vanuit logboek) ──
function setActiveAkte(ch, num, title) {
  const chip  = document.getElementById('active-akte-chip');
  const label = document.getElementById('active-akte-label');
  if (!chip || !label) return;
  label.textContent = `Akte ${num} — ${title}`;
  chip.classList.remove('hidden');
  _scheduleFitHeader();
}

function stopAkte() {
  const chip = document.getElementById('active-akte-chip');
  if (chip) chip.classList.add('hidden');
  window.dmPanel?.closeRevealStrip?.();
  _scheduleFitHeader();
}

// ── Section switching ──
$$('.section-tab[data-section]').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    if (section) switchSection(section);
  });
});

// Archief dropdown items
$$('#archief-menu .archief-menu-item').forEach(btn => {
  btn.addEventListener('click', () => { switchSection(btn.dataset.section); });
});

// Diensten dropdown items
$$('#diensten-menu .archief-menu-item').forEach(btn => {
  btn.addEventListener('click', () => { switchSection(btn.dataset.section); });
});

// Logboek dropdown items (logtabs + de Kaarten-sectie)
$$('#logboek-menu .archief-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.section) {
      switchSection(btn.dataset.section);   // bv. Kaarten
    } else {
      window._logboekActiveTab = btn.dataset.logtab;
      switchSection('logboek');
    }
    closeLogboekMenu();
  });
});

// Sluit dropdowns bij klik buiten het menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('#archief-nav-group')) closeArchiefMenu();
  if (!e.target.closest('#diensten-nav-group')) closeDienstenMenu();
  if (!e.target.closest('#logboek-nav-group')) closeLogboekMenu();
});

// ── Header-fit: laat de nav naar alleen-iconen schakelen zodra de volledige
// tab-labels niet meer naast de titel + acties passen. Omdat het tab-aantal
// verschilt (de DM ziet Spelers/Meesterkamer, een speler niet), meten we de
// werkelijke contentbreedte i.p.v. een vaste breakpoint te kiezen. Onder 768px
// laten we de bestaande mobiele CSS (scroll/iconen) het werk doen.
let _fitHeaderRaf = null;
function _fitHeader() {
  const header = document.getElementById('app-header');
  const nav    = document.getElementById('section-tabs');
  if (!header || !nav) return;
  // Altijd eerst terug naar de volledige staat meten, anders meet je de al
  // ingeklapte breedte en krijg je geflikker.
  header.classList.remove('app-header--compact');
  // Onder 480px doet de kleine-telefoon-CSS al icon-only; daarboven bepaalt _fitHeader
  // zelf of de labels passen (dus ook in de 481–768-band, bv. een laptop-halfvenster).
  if (window.innerWidth <= 480) return;
  let content = 0;
  for (const child of nav.children) {
    if (child.offsetParent === null) continue; // verborgen tab overslaan
    content += child.offsetWidth;
  }
  // +2px marge tegen sub-pixel afronding.
  if (content > nav.clientWidth + 2) header.classList.add('app-header--compact');
}
function _scheduleFitHeader() {
  if (_fitHeaderRaf) return;
  _fitHeaderRaf = requestAnimationFrame(() => { _fitHeaderRaf = null; _fitHeader(); });
}
window.addEventListener('resize', _scheduleFitHeader);
// Meten kan te vroeg gebeuren: zolang Cinzel nog niet geladen is, is de kop
// smaller dan hij wordt, past alles "net" en klapt hij niet in — waarna de
// echte letters over elkaar heen vallen. Dus opnieuw meten zodra de fonts er
// zijn, nog een keer kort daarna, en bij terugkeer uit de bfcache.
if (document.fonts?.ready) document.fonts.ready.then(() => _scheduleFitHeader()).catch(() => {});
for (const ms of [400, 1200]) setTimeout(_scheduleFitHeader, ms);
window.addEventListener('pageshow', _scheduleFitHeader);
// De kop groeit ook ná het meten: de aktechip, de partybalk en de groepspil
// komen los binnen. Eén waarnemer op de balk vangt dat allemaal op — hij kijkt
// alleen naar de breedte van de balk zelf, dus het toevoegen van de compacte
// klasse zet geen lus in gang.
if (window.ResizeObserver) {
  let _laatsteBreedte = -1;
  const _ro = new ResizeObserver(([entry]) => {
    const breedte = Math.round(entry.contentRect.width);
    if (breedte === _laatsteBreedte) return;
    _laatsteBreedte = breedte;
    _scheduleFitHeader();
  });
  const _kop = document.getElementById('app-header');
  if (_kop) _ro.observe(_kop);
}

function switchSection(section) {
  // Sluit overlays als ze open zijn — position:fixed volgt de sectie niet
  const _sbOv = document.getElementById('sb-overlay');
  if (_sbOv?.classList.contains('sb-open') && typeof window._closeSpellbook === 'function') {
    window._closeSpellbook();
  }
  const _invOv = document.getElementById('inv-overlay');
  if (_invOv?.classList.contains('inv-open') && typeof window._closeInventaris === 'function') {
    window._closeInventaris();
  }
  state.activeSection = section;
  location.hash = section;
  closeArchiefMenu();
  closeDienstenMenu();
  closeLogboekMenu();

  // Directe tabs (mijn-karakter, herberg, etc. — niet logboek, dat heeft eigen dropdown)
  $$('.section-tab[data-section]').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  // Archief-knop: actief als een sub-sectie actief is
  const archiefBtn   = $('#archief-nav-btn');
  const archiefLabel = $('#archief-nav-label');
  const isArchief    = ARCHIEF_SECTIONS.includes(section);
  if (archiefBtn) archiefBtn.classList.toggle('active', isArchief);
  if (archiefLabel) archiefLabel.innerHTML = isArchief ? ARCHIEF_LABELS[section] : `${icon('folder-open')} Archief`;

  // Archief dropdown-items
  $$('#archief-menu .archief-menu-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  // Logboek-knop: actief als logboek óf de Kaarten-sectie actief is
  const logboekBtn   = $('#logboek-nav-btn');
  const logboekLabel = $('#logboek-nav-label');
  const isLogboek    = section === 'logboek';
  const isKaart      = section === 'kaart';
  if (logboekBtn) logboekBtn.classList.toggle('active', isLogboek || isKaart);
  if (logboekLabel) {
    const activeTab = window._logboekActiveTab || 'verslagen';
    logboekLabel.innerHTML = isKaart
      ? `${icon('map')} Kaarten`
      : (isLogboek ? (LOGBOEK_LABELS[activeTab] || `${icon('book-open')} Logboek`) : `${icon('book-open')} Logboek`);
  }
  // Logboek dropdown-items
  $$('#logboek-menu .archief-menu-item').forEach(b =>
    b.classList.toggle('active',
      (isKaart && b.dataset.section === 'kaart') ||
      (isLogboek && b.dataset.logtab === (window._logboekActiveTab || 'verslagen'))));

  // Diensten-knop: actief als een diensten-sectie actief is
  const dienstenNavBtn = $('#diensten-nav-btn');
  if (dienstenNavBtn) dienstenNavBtn.classList.toggle('active', ['herberg','tweespalt','gock','ursula','tempel','facties','magizoo'].includes(section));

  $$('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  // Eenmalige kaart-entree-animatie bij het openen van een sectie (niet bij zoeken/
  // filteren — die renderen zonder deze klasse). CSS: .section-cards-enter .entity-card.
  const _secEl = document.getElementById(`section-${section}`);
  if (_secEl) {
    _secEl.classList.add('section-cards-enter');
    clearTimeout(window._secEnterT);
    window._secEnterT = setTimeout(() => _secEl.classList.remove('section-cards-enter'), 1300);
  }
  // Verberg de floating reveal-strip in de Meesterkamer (die heeft eigen ruimte)
  const revealStrip = document.getElementById('dm-reveal-strip');
  if (revealStrip && revealStrip.classList.contains('dm-reveal-strip--visible')) {
    revealStrip.classList.toggle('dm-reveal-strip--in-mk', section === 'meesterkamer');
  }
  // Herberg-achtergrond op body togglen zodat hij altijd het volledige scherm bedekt
  document.body.classList.toggle('herberg-actief', section === 'herberg');

  // Contextueel accent per sectie
  const SECTION_COLORS = {
    personages:    'rgba(42,106,58,0.55)',
    locaties:      'rgba(42,90,138,0.55)',
    organisaties:  'rgba(139,42,42,0.55)',
    voorwerpen:    'rgba(154,106,42,0.55)',
    documenten:    'rgba(90,58,122,0.55)',
    bestiarium:    'rgba(120,42,42,0.55)',
    spreuken:      'rgba(90,58,140,0.55)',
    kaart:         'rgba(42,90,70,0.55)',
    relatiemap:    'rgba(80,42,122,0.55)',
    logboek:       'rgba(184,134,11,0.55)',
    herberg:       'rgba(160,90,20,0.65)',
    tweespalt:     'rgba(90,20,20,0.65)',
    gock:          'rgba(20,50,80,0.65)',
 ursula:        'rgba(80,40,110,0.65)',
    tempel:        'rgba(120,90,150,0.6)',
    heeren:        'rgba(30,30,45,0.7)',
    magizoo:       'rgba(42,106,58,0.55)',
    'mijn-karakter': 'rgba(42,90,138,0.55)',
    meesterkamer:  'rgba(139,42,42,0.55)',
  };
  const accentBar = document.getElementById('section-accent-bar');
  if (accentBar) {
    const _accentCol = SECTION_COLORS[section] || 'rgba(196,168,122,0.35)';
    accentBar.style.background = _accentCol;
    // Voedt ook de zachte sectie-lichtgloed (.section-accent-bar::after).
    accentBar.style.setProperty('--section-color', _accentCol);
  }

  refreshSection(section);
  updateFab();
  _updateDiscoveryChip();
  _scheduleFitHeader(); // actieve-tab-label kan van breedte wisselen (bv. "Archief" → "Personages")
  // #2: dienst-ambiance — start de lokale sfeerloop van deze dienst, of stop 'm.
  if (_DIENST_AMB_LABELS[section]) {
    window.soundManager?.setServiceAmbiance?.(section, state.meta?.[section]?.naam || _DIENST_AMB_LABELS[section]);
  } else {
    window.soundManager?.setServiceAmbiance?.(null);
  }
}
const _DIENST_AMB_LABELS = {
  herberg: 'De Herberg', tweespalt: 'De Tweespalt', gock: 'De Gock',
  ursula: 'Madame Ursula', tempel: 'De Tempel', magizoo: 'De Magizoöloog',
  // 'facties' heeft géén sectie-loop: de loop schakelt per geopende factie (zie _factieOpen).
};

// ── Ontdekkings-meter in de header (feature #5) ──
// Toont voor de huidige archiefcategorie hoeveel de (actieve) groep ontdekt heeft.
// Zichtbaar voor speler én DM; alleen op de archief-categorieën.
const _DISCOVERY_META = {
  personages:   { ic: 'user',        accent: '#2a6a3a' },
  locaties:     { ic: 'castle',      accent: '#2a5a8a' },
  organisaties: { ic: 'landmark',    accent: '#8b2a2a' },
  voorwerpen:   { ic: 'package',     accent: '#9a6a2a' },
  documenten:   { ic: 'scroll-text', accent: '#5a3a7a' },
  bestiarium:   { ic: 'skull',       accent: '#782a2a' },
};
let _discoveryCache = null;
let _discoveryFetching = false;
async function _ensureDiscoveryData(force) {
  if (_discoveryCache && !force) return _discoveryCache;
  if (_discoveryFetching) return _discoveryCache;
  _discoveryFetching = true;
  try { _discoveryCache = await api.ontdekkingen(); } catch { /* oude cache behouden */ }
  finally { _discoveryFetching = false; }
  return _discoveryCache;
}
window._updateDiscoveryChip = async function(force) {
  const chip = document.getElementById('discovery-chip');
  if (!chip) return;
  // De chip verbreedt/versmalt de acties-zone → header opnieuw laten fitten (async, dus
  // ná de initiële meting; zonder deze re-fit blijft de nav in een niet-compacte overlap).
  const hide = () => { chip.classList.add('hidden'); _scheduleFitHeader(); };
  const section = state.activeSection;
  const meta = _DISCOVERY_META[section];
  if (!meta) return hide();
  const data = await _ensureDiscoveryData(force);
  if (state.activeSection !== section) return; // tijdens fetch van sectie gewisseld
  const d = data?.[section];
  if (!d || !d.totaal) return hide();
  const pct = Math.round((d.ontdekt / d.totaal) * 100);
  document.getElementById('discovery-chip-icon').innerHTML = icon(meta.ic);
  document.getElementById('discovery-chip-count').textContent = `${d.ontdekt}/${d.totaal}`;
  const fill = document.getElementById('discovery-chip-fill');
  fill.style.width = pct + '%';
  fill.style.background = meta.accent;
  chip.classList.remove('hidden');
  _scheduleFitHeader();
};

// ── Ambiance-dempknop in de header (feature #2) ──
// Aangeroepen door sound-manager.js wanneer een scène start/stopt of de
// dempstatus wisselt. Toont de knop alleen als er een scène actief is.
window._onAmbianceChange = function({ active, label, enabled } = {}) {
  const btn = document.getElementById('ambiance-toggle');
  if (!btn) return;
  if (!active) { btn.classList.add('hidden'); _scheduleFitHeader(); return; }
  btn.classList.remove('hidden');
  btn.classList.toggle('ambiance-toggle--muted', !enabled);
  _scheduleFitHeader();
  const iconEl  = document.getElementById('ambiance-toggle-icon');
  const labelEl = document.getElementById('ambiance-toggle-label');
  if (iconEl)  iconEl.innerHTML = icon('volume-2');
  if (labelEl) labelEl.textContent = label || '';
  btn.title = enabled
    ? `Ambiance: ${label || ''} — tik om te dempen`
    : 'Ambiance gedempt — tik om aan te zetten';
};

// ── Toon locatie op de kaart (aanroepbaar vanuit entity-cards en detail) ──
window._toonOpKaart = (locId) => {
  queueFlyTo(locId);
  switchSection('kaart');
};

function toggleArchiefMenu() {
  const menu = $('#archief-menu');
  if (!menu) return;
  const willShow = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  // Op mobiel: bereken top-positie voor position:fixed dropdown
  if (willShow && window.innerWidth <= 768) {
    const btn = $('#archief-nav-btn');
    if (btn) menu.style.top = (btn.getBoundingClientRect().bottom + 4) + 'px';
  } else {
    menu.style.top = '';
  }
}

function closeArchiefMenu() {
  $('#archief-menu')?.classList.add('hidden');
}

function toggleDienstenMenu() {
  const menu = $('#diensten-menu');
  if (!menu) return;
  const willShow = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  if (willShow && window.innerWidth <= 768) {
    const btn = $('#diensten-nav-btn');
    if (btn) menu.style.top = (btn.getBoundingClientRect().bottom + 4) + 'px';
  } else {
    menu.style.top = '';
  }
}

function toggleLogboekMenu() {
  const menu = $('#logboek-menu');
  if (!menu) return;
  const willShow = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  if (willShow && window.innerWidth <= 768) {
    const btn = $('#logboek-nav-btn');
    if (btn) menu.style.top = (btn.getBoundingClientRect().bottom + 4) + 'px';
  } else {
    menu.style.top = '';
  }
}

function closeDienstenMenu() {
  $('#diensten-menu')?.classList.add('hidden');
}

function closeLogboekMenu() {
  $('#logboek-menu')?.classList.add('hidden');
}

const LOGBOEK_LABELS = {
  verslagen: `${icon('book-open')} Logboek`,
  quests:    `${icon('map-pin')} Missies`,
  prikbord:  `${icon('map')} Prikbord`,
};

const ENTITY_SECTIONS  = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const ARCHIEF_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'bestiarium', 'spreuken', 'relatiemap'];
const ARCHIEF_LABELS = {
  personages:   `${icon('user')} Personages`,
  locaties:     `${icon('castle', {cls:'icon-gi'})} Locaties`,
  organisaties: `${icon('landmark')} Organisaties`,
  voorwerpen:   `${icon('package')} Voorwerpen`,
  documenten:   `${icon('scroll-text')} Documenten`,
  bestiarium:   `${icon('skull')} Bestiarium`,
  spreuken:     `${icon('sparkles')} Spreuken`,
  kaart:        `${icon('map')} Kaarten`,
  relatiemap:   `${icon('users')} Relatiemap`,
};

function updateFab() {
  // De zwevende +-FAB rechtsonder is vervangen door een icoon-toevoegknop in de
  // subheader van elke sectie (zie .sbs-add-btn in render-campagne/-archief). Die
  // botste voor de DM met de d20-knop rechtsonder. FAB blijft in de DOM als dode
  // fallback, maar wordt altijd verborgen.
  const fab = $('#fab');
  if (fab) fab.classList.add('hidden');
}

function onFabClick() {
  const section = state.activeSection;
  if (ENTITY_SECTIONS.includes(section)) {
    openEditor(section);
  } else if (section === 'documenten') {
    openArchiefEditor();
  } else if (section === 'logboek') {
    openLogboekEditor();
  }
}

// ── Auth ──
function toggleLoginModal() {
  $('#login-overlay').classList.toggle('active');
  $('#dm-password').value = '';
  $('#login-error').classList.add('hidden');
  setTimeout(() => $('#dm-password').focus(), 100);
}

function closeLoginModal() {
  $('#login-overlay').classList.remove('active');
}

async function login() {
  try {
    await api.login($('#dm-password').value);
    state.role = 'dm';
    applyRole();
    closeLoginModal();
    // Laad groepen nu DM is ingelogd
    try {
      const { groups, activeGroup } = await api.listGroups();
      _activeGroupId = activeGroup;
      window.renderGroupSwitcher(groups, activeGroup);
    } catch { /* ok */ }
    // Herbouw de wikilink-naamindex voor de DM (alle entiteiten zichtbaar)
    _rebuildEntityIndex();
    refreshAll();
    window.dmPanel?.refreshCombatOverlay();
  } catch {
    $('#login-error').classList.remove('hidden');
  }
}

async function logout() {
  await api.logout();
  // #23: hard-reload om DM-state-caches (monsters, combat, berichten, enz.)
  // volledig te wissen — voorkomt data-lek naar speler-weergave in dezelfde tab.
  location.reload();
}

async function dmLogout() {
  await logout();
}

// ── Sandbox / demo login ──

function toggleSandboxModal() {
  const modal = document.getElementById('sandbox-login-overlay');
  if (!modal) return;
  modal.classList.toggle('active');
  document.getElementById('sandbox-error')?.classList.add('hidden');
  document.getElementById('sandbox-password')?.focus();
}

function closeSandboxModal() {
  document.getElementById('sandbox-login-overlay')?.classList.remove('active');
}

// ── Tablet login ──

function toggleTabletModal() {
  const modal = document.getElementById('tablet-login-overlay');
  if (!modal) return;
  modal.classList.toggle('active');
  document.getElementById('tablet-error')?.classList.add('hidden');
  document.getElementById('tablet-password').value = '';
  setTimeout(() => document.getElementById('tablet-password')?.focus(), 100);
}

function closeTabletModal() {
  document.getElementById('tablet-login-overlay')?.classList.remove('active');
}

async function tabletLoginSubmit() {
  const pw    = document.getElementById('tablet-password')?.value || '';
  const errEl = document.getElementById('tablet-error');
  try {
    await api.tabletLogin(pw);
    closeTabletModal();
    window.app.activateDisplayMode();
  } catch {
    errEl?.classList.remove('hidden');
  }
}

function testLogin() {
  const overlay = document.getElementById('test-login-overlay');
  const pw      = document.getElementById('test-login-password');
  const errEl   = document.getElementById('test-login-error');
  if (!overlay) return;
  errEl?.classList.add('hidden');
  if (pw) pw.value = '';
  overlay.classList.add('active');
  setTimeout(() => pw?.focus(), 100);
}

function closeTestLoginModal() {
  document.getElementById('test-login-overlay')?.classList.remove('active');
}

async function testLoginSubmit() {
  const pw     = document.getElementById('test-login-password')?.value || '';
  const errEl  = document.getElementById('test-login-error');
  const btn    = document.querySelector('#test-login-overlay button[onclick*="testLoginSubmit"]');
  errEl?.classList.add('hidden');
  if (btn) btn.disabled = true;
  try {
    const result = await api.playerLogin('e_1778689148089_pypw', pw);
    closeTestLoginModal();
    state.playerName  = result.playerName;
    state.characterId = result.characterId;
    state.role        = 'player';
    applyRole();
    try { localStorage.setItem('_lastLogin', JSON.stringify({ charId: result.characterId, ts: Date.now() })); } catch { /* ok */ }
    if (result.characterId && window._socket) window._socket.emit('player:register', result.characterId);
    _rebuildEntityIndex();
    window._pendingPlayerSubTab = 'personage';
    switchSection('mijn-karakter');
  } catch {
    errEl?.classList.remove('hidden');
    if (btn) btn.disabled = false;
    document.getElementById('test-login-password')?.select();
  }
}

// ── Toegang: één veld, de rol volgt ─────────────────────────────────────────
// Je hoeft niet eerst te bedenken of je DM bent of speler: het wachtwoord zegt
// het. Bij een groepswachtwoord blijven alleen de personages van díé party
// staan, en onthouden we het wachtwoord even zodat de speler het niet twee keer
// hoeft in te tikken bij het kiezen van zijn personage.
let _groepsWachtwoord = null;

window.app = window.app || {};
// De DM-ingang staat dicht: alleen het woord "Dungeon Master", en pas als je
// erop klikt komt het wachtwoordveld tevoorschijn. Een zichtbaar invoerveld
// trekt spelers aan, terwijl zij via hun portret binnenkomen.
function landingDmVeld() {
  const knop = document.getElementById('landing-toegang-knop');
  const form = document.getElementById('landing-toegang-form');
  if (!form) return;
  knop?.classList.add('hidden');
  form.classList.remove('hidden');
  const veld = document.getElementById('landing-toegang-pw');
  veld?.focus();
  veld?.addEventListener('keydown', (e) => { if (e.key === 'Escape') _landingDmVeldDicht(); }, { once: true });
}

function _landingDmVeldDicht() {
  const veld = document.getElementById('landing-toegang-pw');
  if (veld) veld.value = '';
  document.getElementById('landing-toegang-error')?.classList.add('hidden');
  document.getElementById('landing-toegang-form')?.classList.add('hidden');
  document.getElementById('landing-toegang-knop')?.classList.remove('hidden');
}

async function landingToegang() {
  const veld = document.getElementById('landing-toegang-pw');
  const fout = document.getElementById('landing-toegang-error');
  const knop = document.getElementById('landing-toegang-btn');
  if (!veld) return;
  fout?.classList.add('hidden');
  if (knop) knop.disabled = true;
  try {
    const r = await api.toegang(veld.value);
    if (r.rol === 'dm') {
      state.role = 'dm';
      applyRole();
      try {
        const { groups, activeGroup } = await api.listGroups();
        _activeGroupId = activeGroup;
        window.renderGroupSwitcher(groups, activeGroup);
      } catch { /* ok */ }
      _rebuildEntityIndex();
      refreshAll();
      window.dmPanel?.refreshCombatOverlay();
      return;
    }
    // Een party: laat alleen haar personages staan en onthoud het wachtwoord.
    _groepsWachtwoord = veld.value;
    veld.value = '';
    await _landingToonGroep(r);
  } catch {
    fout?.classList.remove('hidden');
    veld.select();
  } finally {
    if (knop) knop.disabled = false;
  }
}

async function _landingToonGroep(r) {
  // Opnieuw tekenen met alleen deze party: de kiezer is een carrousel met een
  // slide per party, en losse portretten verstoppen breekt die indeling.
  await showLanding({ alleenGroep: r.groep?.id || null });
  const sub = document.getElementById('landing-subtitle');
  if (sub && r.groep?.naam) sub.textContent = `Kies je personage — ${r.groep.naam}`;
  document.querySelector('.landing-toegang')?.classList.add('hidden');
}

// ── Landing footer: inline login-prompts (vervangt modal-overlays op de landingspagina) ──

function _landingShowFooterPrompt({ title, iconName, placeholder, submitLabel, onSubmit }) {
  document.getElementById('landing-footer-prompt')?.remove();
  // Sluit een eventueel openstaande speler-wachtwoordprompt + reset gekozen portret,
  // anders staan er twee inlogvelden tegelijk op de landingspagina.
  document.getElementById('landing-pw-prompt')?.remove();
  document.querySelectorAll('.landing-portrait').forEach(p =>
    p.classList.remove('landing-portrait--chosen', 'landing-portrait--dimmed'));
  const prompt = document.createElement('div');
  prompt.id        = 'landing-footer-prompt';
  prompt.className = 'landing-pw-prompt landing-footer-prompt';
  prompt.innerHTML = `
    <div class="landing-footer-prompt-title">${icon(iconName)} ${esc(title)}</div>
    <input id="landing-footer-pw" type="password" class="landing-pw-input"
      placeholder="${esc(placeholder)}" autocomplete="current-password">
    <div id="landing-footer-error" class="landing-pw-error hidden">Verkeerd wachtwoord</div>
    <div class="landing-pw-actions">
      <button class="landing-pw-cancel" id="landing-footer-cancel">Annuleren</button>
      <button class="landing-pw-submit" id="landing-footer-submit">${submitLabel}</button>
    </div>`;
  document.querySelector('.landing-footer')?.after(prompt);
  requestAnimationFrame(() => prompt.classList.add('landing-pw-prompt--in'));
  const input     = document.getElementById('landing-footer-pw');
  const errorEl   = document.getElementById('landing-footer-error');
  const submitBtn = document.getElementById('landing-footer-submit');
  const cancelFn  = () => {
    prompt.classList.remove('landing-pw-prompt--in');
    setTimeout(() => prompt.remove(), 220);
  };
  const submitFn  = async () => {
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    try { await onSubmit(input.value); }
    catch { errorEl.classList.remove('hidden'); submitBtn.disabled = false; input.select(); input.focus(); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submitFn(); if (e.key === 'Escape') cancelFn(); });
  submitBtn.addEventListener('click', submitFn);
  document.getElementById('landing-footer-cancel')?.addEventListener('click', cancelFn);
  setTimeout(() => input.focus(), 50);
}

function _landingDmLogin() {
  _landingShowFooterPrompt({
    title: 'Dungeon Master', iconName: 'crossed-swords',
    placeholder: 'Wachtwoord…', submitLabel: 'Inloggen ↵',
    onSubmit: async pw => {
      await api.login(pw);
      document.getElementById('landing-footer-prompt')?.remove();
      state.role = 'dm';
      applyRole();
      try {
        const { groups, activeGroup } = await api.listGroups();
        _activeGroupId = activeGroup;
        window.renderGroupSwitcher(groups, activeGroup);
      } catch { /* ok */ }
      _rebuildEntityIndex();
      refreshAll();
      window.dmPanel?.refreshCombatOverlay();
    }
  });
}

function _landingSandboxLogin() {
  _landingShowFooterPrompt({
    title: 'Showcase', iconName: 'flask-conical',
    placeholder: 'Wachtwoord (indien vereist)…', submitLabel: 'Showcase starten ↵',
    onSubmit: async pw => {
      const result = await api.sandboxLogin(pw);
      document.getElementById('landing-footer-prompt')?.remove();
      state.role      = result.role || 'dm';
      state.isSandbox = true;
      applyRole();
      try {
        const { groups, activeGroup } = await api.listGroups();
        _activeGroupId = activeGroup;
        window.renderGroupSwitcher(groups, activeGroup);
      } catch { /* ok */ }
      _rebuildEntityIndex();
      refreshAll();
      window.dmPanel?.refreshCombatOverlay();
    }
  });
}

function _landingTabletLogin() {
  _landingShowFooterPrompt({
    title: 'Tablet', iconName: 'monitor',
    placeholder: 'Wachtwoord…', submitLabel: 'Activeren ↵',
    onSubmit: async pw => {
      await api.tabletLogin(pw);
      document.getElementById('landing-footer-prompt')?.remove();
      window.app.activateDisplayMode();
    }
  });
}

function _landingTestLogin() {
  _landingShowFooterPrompt({
    title: 'Testomgeving', iconName: 'flask-conical',
    placeholder: 'Groepswachtwoord groep 3…', submitLabel: 'Inloggen ↵',
    onSubmit: async pw => {
      const result = await api.playerLogin('e_1778689148089_pypw', pw);
      document.getElementById('landing-footer-prompt')?.remove();
      state.playerName  = result.playerName;
      state.characterId = result.characterId;
      state.role        = 'player';
      applyRole();
      try { localStorage.setItem('_lastLogin', JSON.stringify({ charId: result.characterId, ts: Date.now() })); } catch { /* ok */ }
      if (result.characterId && window._socket) window._socket.emit('player:register', result.characterId);
      _rebuildEntityIndex();
      window._pendingPlayerSubTab = 'personage';
      switchSection('mijn-karakter');
    }
  });
}

async function sandboxLoginSubmit() {
  const pw = document.getElementById('sandbox-password')?.value || '';
  const errEl = document.getElementById('sandbox-error');
  try {
    const result = await api.sandboxLogin(pw);
    state.role      = result.role || 'dm';
    state.isSandbox = true;
    closeSandboxModal();
    applyRole();
    try {
      const { groups, activeGroup } = await api.listGroups();
      _activeGroupId = activeGroup;
      window.renderGroupSwitcher(groups, activeGroup);
    } catch { /* ok */ }
    _rebuildEntityIndex();
    refreshAll();
    window.dmPanel?.refreshCombatOverlay();
  } catch {
    if (errEl) errEl.classList.remove('hidden');
  }
}

function applyRole() {
  const appEl   = $('#app');
  const isDmActive  = state.role === 'dm' && !state.dmPreview;
  const isDmPreview = state.role === 'dm' && state.dmPreview;

  appEl.classList.toggle('dm-mode',     isDmActive);
  appEl.classList.toggle('player-mode', !isDmActive);

  const toggle    = $('#dm-toggle');
  const label     = $('#dm-toggle-label');
  const logoutBtn = $('#dm-logout-btn');

  if (toggle) {
    toggle.classList.toggle('hidden',           state.role !== 'dm');
    toggle.classList.toggle('dm-seal--active',  isDmActive);
    toggle.classList.toggle('dm-seal--preview', isDmPreview);
    toggle.title = isDmActive ? 'Spelerweergave tonen' : isDmPreview ? 'Terug naar DM-weergave' : 'Dungeon Master modus';
  }
  if (label) {
    label.textContent = isDmActive ? 'DM actief' : isDmPreview ? 'Preview' : 'DM';
  }
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', state.role !== 'dm');
  }
  // Tafelscherm-knop hoort bij de DM en niet op het tafelscherm zelf.
  document.getElementById('dm-tafelscherm-btn')
    ?.classList.toggle('hidden', state.role !== 'dm' || window._isDisplayMode);

  // Sandbox badge: only visible when logged in as sandbox DM
  const sandboxBadge = document.getElementById('sandbox-badge');
  if (sandboxBadge) sandboxBadge.classList.toggle('hidden', !state.isSandbox);

  // Dice FAB: spelers zien het reguliere, DM ziet de DM-variant. Op het
  // tafelscherm geen van beide: dat scherm ligt op tafel en gooit niet — en
  // sinds de tablet als DM inlogt kwam de DM-variant er anders bij.
  const diceFab   = document.getElementById('dice-fab');
  const dmDiceFab = document.getElementById('dm-dice-fab');
  const opTafel   = !!window._isDisplayMode;
  if (diceFab)   diceFab.classList.toggle('hidden', opTafel || isDmActive);
  if (dmDiceFab) dmDiceFab.classList.toggle('hidden', opTafel || !isDmActive);
  if (opTafel) document.getElementById('dice-panel')?.classList.add('hidden');

  // Meesterkamer-tab: alleen zichtbaar voor actieve DM
  const dmTab = document.getElementById('dm-tab');
  if (dmTab) dmTab.classList.toggle('hidden', !isDmActive);

  // Spelers-tab: alleen zichtbaar voor actieve DM
  const spelersTab = document.getElementById('spelers-tab');
  if (spelersTab) spelersTab.classList.toggle('hidden', !isDmActive);

  // Groep-pill in de header: groepswisselaar, alleen zichtbaar voor actieve DM
  const groupPillWrap = document.getElementById('group-pill-wrap');
  if (groupPillWrap) groupPillWrap.classList.toggle('hidden', !isDmActive);

  // Spelerwisselknop rechts in header (zichtbaar voor alle spelers)
  const isPlayer = state.role === 'player';
  const playerSwitchBtn = document.getElementById('player-switch-btn');
  if (playerSwitchBtn) playerSwitchBtn.classList.toggle('hidden', !isPlayer);

  const isNamedPlayer = state.role === 'player' && !!state.playerName;

  // Backdrop CSS-variabele voor herbergachtergrond
  const backdropId = state.meta?.herberg?.backdropId;
  if (backdropId) {
    document.documentElement.style.setProperty('--herberg-backdrop-url', `url('${api.fileUrl(backdropId)}')`);
  } else {
    document.documentElement.style.removeProperty('--herberg-backdrop-url');
  }

  // Diensten dropdown: zichtbaar voor benoemde spelers én voor de DM
  // (DM kan zo elke dienst openen en inspecteren zoals spelers die zien).
  const dienstenGroup = document.getElementById('diensten-nav-group');
  // Staan alle diensten uit als module, dan heeft het menu niets te tonen.
  const geenDiensten = [...document.querySelectorAll('#diensten-menu > *')]
    .every(el => el.classList.contains('module-uit'));
  if (dienstenGroup) dienstenGroup.classList.toggle('hidden', geenDiensten || (!isNamedPlayer && !window.app.isDM()));

  // Elke dienst draagt zijn eigen naam uit meta; de herberg verdwijnt bovendien
  // als hij niet is ingericht.
  _zetDienstLabels();
  document.getElementById('diensten-herberg-item')?.classList.toggle('hidden', !state.meta?.herberg);

  // Diensten-knop active-state als een diensten-sectie actief is
  const DIENSTEN_SECTIONS = ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'heeren', 'facties', 'magizoo'];
  const dienstenBtn = document.getElementById('diensten-nav-btn');
  if (dienstenBtn) dienstenBtn.classList.toggle('active', DIENSTEN_SECTIONS.includes(state.activeSection));

  // Toegangsstaten diensten updaten
  if (!window.app.isDM()) _updateDienstenMenu();
  else _updateDienstenMenuDM();

  // Eigen-karakter-tabblad
  const myCharTab = document.querySelector('.section-tab[data-section="mijn-karakter"]');
  if (myCharTab) {
    myCharTab.classList.toggle('hidden', !isNamedPlayer);
    if (isNamedPlayer && state.playerName) {
      const firstName = state.playerName.split(' ')[0];
      const avatarUrl = api.fileUrl(state.characterId);
      myCharTab.innerHTML = `<img src="${avatarUrl}" class="nav-tab-avatar" alt="" onerror="this.style.display='none'">${esc(firstName)}`;
    } else {
      myCharTab.innerHTML = icon('user') + ' Mijn karakter';
    }
  }

  // Verberg landing zodra iemand ingelogd is
  if (state.role === 'dm' || state.playerName) hideLanding();

  updateFab();
  _scheduleFitHeader(); // rolwissel toont/verbergt tabs → herbereken de fit
  // Nog een keer nadat de browser alles heeft neergezet: de chip en de partybalk
  // komen soms een tel later binnen en maken de kop dan alsnog te breed.
  setTimeout(_scheduleFitHeader, 250);
}

function dmToggleClick() {
  if (state.role === 'dm' && !state.dmPreview) {
    // DM active → enter player preview
    state.dmPreview = true;
    applyRole();
    refreshAll();
    window.dmPanel?.refreshCombatOverlay();
  } else if (state.role === 'dm' && state.dmPreview) {
    // Preview → back to DM
    state.dmPreview = false;
    applyRole();
    refreshAll();
    window.dmPanel?.refreshCombatOverlay();
  } else {
    // Not logged in → open login
    toggleLoginModal();
  }
}

// ── Landing page ──

function hideLanding() {
  document.getElementById('landing-overlay')?.classList.add('hidden');
  document.body.classList.remove('landing-open');
}

// Met meer dan een handvol portretten past de kiezer op een telefoon niet meer
// op één scherm, en niets verraadt dat er onder de vouw nog iemand staat. Dit
// pijltje wel — en het verdwijnt zodra je onderaan bent.
function _landingScrollHint() {
  const overlay = document.getElementById('landing-overlay');
  const hint    = document.getElementById('landing-scrollhint');
  if (!overlay || !hint) return;
  const bijwerken = () => {
    const restant = overlay.scrollHeight - overlay.clientHeight - overlay.scrollTop;
    hint.classList.toggle('hidden', restant < 24);
  };
  if (!overlay._scrollHintGebonden) {
    overlay.addEventListener('scroll', bijwerken, { passive: true });
    window.addEventListener('resize', bijwerken);
    overlay._scrollHintGebonden = true;
  }
  // Na het tekenen meten: de portretten bepalen de hoogte, en die zijn er pas
  // als de browser ze heeft neergezet.
  requestAnimationFrame(bijwerken);
  setTimeout(bijwerken, 400);
}

async function showLanding({ alleenGroep = null } = {}) {
  const overlay = document.getElementById('landing-overlay');
  if (!overlay) return;

  // Reset animatieklassen + eventuele overgebleven zoom-cirkel van vorige sessie
  overlay.classList.remove('hidden', 'landing-overlay--dimming', 'landing-overlay--out');
  // Zet de pagina eronder vast. Op een telefoon rekt de scroll door tot in het
  // document, en dan schoof de app onder de landingspagina vandaan in beeld.
  document.body.classList.add('landing-open');
  document.getElementById('landing-zoom')?.remove();

  // Titels uit meta
  const titleEl    = document.getElementById('landing-title');
  const subtitleEl = document.getElementById('landing-subtitle');
  if (titleEl)    titleEl.textContent    = state.meta?.appTitle    || 'Campagne';
  if (subtitleEl) subtitleEl.textContent = state.meta?.appSubtitle || '';
  _zetEmbleem(document.getElementById('landing-crest'), state.meta?.embleem);

  _landingScrollHint();
  // De DM-ingang wordt verborgen zodra iemand een portret kiest of een
  // groepswachtwoord intikt. Bij een verse landing hoort hij er weer te staan,
  // dichtgeklapt — anders is hij na uitloggen als speler nergens meer te vinden.
  if (!alleenGroep) {
    document.querySelector('.landing-toegang')?.classList.remove('hidden');
    _landingDmVeldDicht();
  }


  const list = document.getElementById('landing-portraits');
  if (!list) return;
  list.innerHTML = '<p class="landing-loading">Laden…</p>';

  try {
    let chars = await api.listPlayerChars();
    // Is er een groepswachtwoord ingetikt, dan hoort de kiezer alleen die party
    // te tonen — je kiest niet uit een andere party.
    if (alleenGroep) chars = chars.filter(c => c.groep === alleenGroep);
    if (chars.length === 0) {
      list.innerHTML = '<p class="landing-loading">Geen spelerskarakters gevonden.</p>';
      return;
    }

    const renderPortrait = c => {
      const sub = [c.ras, c.klasse].filter(Boolean).join(' · ');
      return `
        <div class="landing-portrait"
          data-char-id="${esc(c.id)}"
          data-has-password="${c.groepHasPassword ? '1' : ''}"
          data-groep-naam="${esc(c.groepNaam || '')}"
          data-portrait-video="${c.portraitVideoId ? '1' : ''}"
          onclick="window.app._landingPortraitClick('${esc(c.id)}', this)">
          <div class="landing-portrait-ring">
            <img src="${api.fileUrl(esc(c.id))}" class="landing-portrait-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="landing-portrait-fallback" style="display:none">${icon('user')}</div>
          </div>
          <div class="landing-portrait-name">${esc(c.name)}</div>
          ${sub ? `<div class="landing-portrait-sub">${esc(sub)}</div>` : ''}
        </div>`;
    };

    // Groepeer per party
    const parties = new Map();
    for (const c of chars) {
      const gid = c.groep || '__none__';
      if (!parties.has(gid)) parties.set(gid, { naam: c.groepNaam || null, chars: [] });
      parties.get(gid).chars.push(c);
    }

    if (parties.size <= 1) {
      // Één party: portretten direct, geen scheiders
      list.className = 'landing-portraits';
      list.innerHTML = chars.map(renderPortrait).join('');
    } else {
      // Meerdere parties: carousel, één groep per pagina
      list.className = 'landing-portraits landing-portraits--carousel';
      const sortedParties = [...parties.values()].sort((a, b) =>
        (a.naam || '').localeCompare(b.naam || '', 'nl'));
      _landingCarouselIdx   = 0;
      _landingCarouselTotal = sortedParties.length;
      const slides = sortedParties.map(party =>
        `<div class="landing-carousel-slide">${party.chars.map(renderPortrait).join('')}</div>`
      ).join('');
      list.innerHTML = `
        <button class="landing-carousel-btn landing-carousel-btn--hidden" onclick="window._landingCarouselNav(-1)">&#8249;</button>
        <div class="landing-carousel-track">
          <div class="landing-carousel-inner" id="landing-carousel-inner">${slides}</div>
        </div>
        <button class="landing-carousel-btn${sortedParties.length <= 1 ? ' landing-carousel-btn--hidden' : ''}" onclick="window._landingCarouselNav(1)">&#8250;</button>`;
    }

    window._landingCarouselNav = (dir) => {
      _landingCarouselIdx = Math.max(0, Math.min(_landingCarouselTotal - 1, _landingCarouselIdx + dir));
      const inner = document.getElementById('landing-carousel-inner');
      if (inner) inner.style.transform = `translateX(-${_landingCarouselIdx * 100}%)`;
      const btns = list.querySelectorAll('.landing-carousel-btn');
      if (btns[0]) btns[0].classList.toggle('landing-carousel-btn--hidden', _landingCarouselIdx === 0);
      if (btns[1]) btns[1].classList.toggle('landing-carousel-btn--hidden', _landingCarouselIdx >= _landingCarouselTotal - 1);
    };
  } catch {
    list.innerHTML = '<p class="landing-loading">Fout bij laden.</p>';
  }
}

// ── Landing portret-klik: stap 1 = wachtwoord (indien vereist) ──

async function _landingPortraitClick(charId, portraitEl) {
  if (document.getElementById('landing-zoom')) return;
  if (portraitEl.classList.contains('landing-portrait--chosen')) return;

  // Sluit een eventueel openstaande footer-login (DM/sandbox/tablet/test),
  // anders verschijnt er een tweede inlogveld naast de speler-prompt.
  document.getElementById('landing-footer-prompt')?.remove();

  // Highlight gekozen portret, dim de rest licht
  document.querySelectorAll('.landing-portrait').forEach(p => {
    p.classList.remove('landing-portrait--chosen');
    if (p !== portraitEl) p.classList.add('landing-portrait--dimmed');
    else                   p.classList.remove('landing-portrait--dimmed');
  });
  portraitEl.classList.add('landing-portrait--chosen');

  const hasPassword  = portraitEl.dataset.hasPassword === '1';
  const hasVideo     = portraitEl.dataset.portraitVideo === '1';
  // Al een groepswachtwoord ingetikt op de landingspagina? Dan niet nóg eens
  // vragen: inloggen met dat wachtwoord en meteen de animatie starten.
  if (_groepsWachtwoord) {
    try {
      const result = await api.playerLogin(charId, _groepsWachtwoord);
      await _landingStartZoom(charId, portraitEl, hasVideo);
      _landingFinishLogin(result);
    } catch {
      _groepsWachtwoord = null;
      _landingCancelPassword();
    }
    return;
  }
  if (hasPassword) {
    _landingShowPasswordPrompt(charId, portraitEl, hasVideo);
  } else {
    // Geen wachtwoord → meteen inloggen en animatie starten
    try {
      const result = await api.playerLogin(charId, '');
      await _landingStartZoom(charId, portraitEl, hasVideo);
      _landingFinishLogin(result);
    } catch {
      _landingCancelPassword();
    }
  }
}

// Zorgen dat je ziet wat je tikt. Scrollen alleen is niet genoeg: de overlay
// centreert zijn inhoud, dus wat erboven of eronder valt is soms niet eens te
// bereiken. Op een telefoon met open toetsenbord plakken we de prompt daarom
// vast net boven dat toetsenbord; zodra het weg is, valt hij terug in de flow.
function _landingPromptInBeeld() {
  const prompt  = document.getElementById('landing-pw-prompt');
  const overlay = document.getElementById('landing-overlay');
  if (!prompt || !overlay) { window.visualViewport?.removeEventListener('resize', _landingPromptInBeeld); return; }

  const vv = window.visualViewport;
  const toetsenbord = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  const smal = window.innerWidth <= 640;

  if (smal && toetsenbord > 80) {
    prompt.classList.add('landing-pw-prompt--boven-toetsenbord');
    prompt.style.bottom = `${toetsenbord + 12}px`;
    return;
  }
  prompt.classList.remove('landing-pw-prompt--boven-toetsenbord');
  prompt.style.bottom = '';

  const zichtbaar = vv ? vv.height : window.innerHeight;
  const boven     = vv ? vv.offsetTop : 0;
  const vak       = prompt.getBoundingClientRect();
  const verschil  = (vak.top + vak.height / 2) - (boven + zichtbaar / 2);
  if (Math.abs(verschil) > 8) overlay.scrollBy({ top: verschil, behavior: 'smooth' });
}

function _landingShowPasswordPrompt(charId, portraitEl, hasVideo = false) {
  document.getElementById('landing-pw-prompt')?.remove();
  // Gewoon "Wachtwoord…": je hebt net een portret gekozen, dus welk wachtwoord
  // het is spreekt voor zich. De partynaam erbij zetten maakte het alleen langer
  // (en liep bij een lange naam uit het veld). Intussen verdwijnt de DM-ingang —
  // twee wachtwoordvelden onder elkaar is er één te veel.
  const prompt = document.createElement('div');
  prompt.id = 'landing-pw-prompt';
  prompt.className = 'landing-pw-prompt';
  prompt.innerHTML = `
    <input id="landing-pw-input" type="password" class="landing-pw-input"
      placeholder="Wachtwoord…" autocomplete="current-password">
    <div id="landing-pw-error" class="landing-pw-error hidden">Verkeerd wachtwoord</div>
    <div class="landing-pw-actions">
      <button class="landing-pw-cancel" id="landing-pw-cancel">Annuleren</button>
      <button class="landing-pw-submit" id="landing-pw-submit">Inloggen ↵</button>
    </div>`;
  document.getElementById('landing-portraits')?.after(prompt);
  document.querySelector('.landing-toegang')?.classList.add('hidden');
  requestAnimationFrame(() => prompt.classList.add('landing-pw-prompt--in'));
  const input = document.getElementById('landing-pw-input');
  input?.focus();
  // Op een telefoon schuift het toetsenbord over het veld heen: je tikt blind.
  // Daarom het veld actief in het zichtbare deel trekken — dat is niet de
  // gewone viewport maar `visualViewport`, want die krimpt mét het toetsenbord.
  _landingPromptInBeeld();
  setTimeout(_landingPromptInBeeld, 300);
  window.visualViewport?.addEventListener('resize', _landingPromptInBeeld);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  _landingSubmitPassword(charId, portraitEl, hasVideo);
    if (e.key === 'Escape') _landingCancelPassword();
  });
  document.getElementById('landing-pw-submit')?.addEventListener('click',
    () => _landingSubmitPassword(charId, portraitEl, hasVideo));
  document.getElementById('landing-pw-cancel')?.addEventListener('click', _landingCancelPassword);
}

async function _landingSubmitPassword(charId, portraitEl, hasVideo = false) {
  const input     = document.getElementById('landing-pw-input');
  const errorEl   = document.getElementById('landing-pw-error');
  const submitBtn = document.getElementById('landing-pw-submit');
  errorEl?.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const result = await api.playerLogin(charId, input?.value || '');
    window.visualViewport?.removeEventListener('resize', _landingPromptInBeeld);
    document.getElementById('landing-pw-prompt')?.remove();
    await _landingStartZoom(charId, portraitEl, hasVideo);
    _landingFinishLogin(result);
  } catch {
    errorEl?.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = false;
    input?.select();
    input?.focus();
  }
}

function _landingCancelPassword() {
  window.visualViewport?.removeEventListener('resize', _landingPromptInBeeld);
  document.getElementById('landing-pw-prompt')?.remove();
  // Alleen terughalen als er geen groepswachtwoord is ingetikt: dan is de kiezer
  // al gefilterd op één party en heeft de DM-ingang daar niets meer te zoeken.
  if (!_groepsWachtwoord) document.querySelector('.landing-toegang')?.classList.remove('hidden');
  document.querySelectorAll('.landing-portrait').forEach(p => {
    p.classList.remove('landing-portrait--chosen', 'landing-portrait--dimmed');
  });
}

async function _landingStartZoom(charId, portraitEl, hasVideo = false) {
  const landingOverlay = document.getElementById('landing-overlay');
  landingOverlay?.classList.add('landing-overlay--dimming');
  document.querySelectorAll('.landing-portrait').forEach(p => {
    if (p !== portraitEl) p.classList.add('landing-portrait--dismissed');
  });
  portraitEl.style.pointerEvents = 'none';

  // 2. Start-coördinaten van de ring vastleggen
  const ring = portraitEl.querySelector('.landing-portrait-ring');
  const r    = ring.getBoundingClientRect();

  // 3. Zoom-cirkel aanmaken op dezelfde plek als het portret
  const zoom = document.createElement('div');
  zoom.id        = 'landing-zoom';
  zoom.className = 'landing-zoom';
  Object.assign(zoom.style, {
    left: r.left + 'px', top: r.top + 'px',
    width: r.width + 'px', height: r.height + 'px',
  });

  // Naamring: herhaal naam met ✦ als scheiding rondom de cirkel
  const nameEl   = portraitEl.querySelector('.landing-portrait-name');
  const charName = nameEl ? nameEl.textContent.toUpperCase() : '';
  // Gebruik non-breaking spaces ( ) rondom ✦: SVG strips gewone leading/
  // trailing whitespace uit textContent, waardoor bij de naad van de ring de
  // spatie tussen NAAM en ✦ ontbreekt.   wordt nooit weggegooid.
  const ringLabel = charName ? `${charName} ✦ ` : ' ✦ ';

  zoom.innerHTML = `
    <div class="landing-zoom-portrait">
      <img class="landing-zoom-img" src="${api.fileUrl(esc(charId))}"
        onerror="this.style.display='none'">
      ${hasVideo ? `<video id="landing-zoom-video" class="landing-zoom-video" autoplay muted playsinline>
        <source src="${api.fileUrl(esc(charId) + '_video')}" type="video/mp4">
      </video>` : ''}
    </div>
    <svg class="landing-zoom-ring" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <path id="lzr-path"
          d="M 50,50 m 0,-44 a 44,44 0 1,1 0,88 a 44,44 0 1,1 0,-88"/>
      </defs>
      <circle cx="50" cy="50" r="41.5"
        fill="none" stroke="rgba(196,168,100,0.30)" stroke-width="0.5"/>
      <text class="landing-zoom-ring-text">
        <textPath href="#lzr-path" startOffset="0%">${ringLabel.repeat(6)}</textPath>
      </text>
    </svg>`;
  document.body.appendChild(zoom);

  // Pas het aantal herhalingen aan zodat de tekst naadloos de cirkelomtrek vult.
  // We meten de werkelijke breedte van één herhaling in SVG-eenheden en berekenen
  // hoeveel reps precies de omtrek (getTotalLength) vullen. textLength + lengthAdjust
  // strekt de tekst daarna uit tot exact de omtrek → geen afkap, geen zichtbare naad.
  requestAnimationFrame(() => {
    const tp    = zoom.querySelector('textPath');
    const lzrPath = zoom.querySelector('#lzr-path');
    if (!tp || !lzrPath) return;
    const pathLen = lzrPath.getTotalLength();   // ≈ 276 SVG-eenheden voor r=44
    tp.textContent = ringLabel;                 // één herhaling meten
    const oneLen  = tp.getComputedTextLength();
    if (!oneLen) return;
    const reps = Math.ceil(pathLen / oneLen);   // kleinste N dat de omtrek vult
    tp.textContent = ringLabel.repeat(reps);
    tp.setAttribute('textLength',    pathLen.toFixed(3));
    tp.setAttribute('lengthAdjust', 'spacingAndGlyphs');
  });

  // 4. Doelgrootte + positie (gecentreerd in het scherm)
  const size = Math.round(Math.min(window.innerWidth * 0.82, window.innerHeight * 0.74, 560));
  const tx   = Math.round((window.innerWidth  - size) / 2);
  const ty   = Math.round((window.innerHeight - size) / 2);

  // Animatie starten na twee frames (zodat de browser de start-positie heeft gezien)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    zoom.classList.add('landing-zoom--growing');
    Object.assign(zoom.style, {
      left: tx + 'px', top: ty + 'px',
      width: size + 'px', height: size + 'px',
    });
  }));

  // 5. Wachten tot de video klaar is, of fallback als er geen video is
  // Een langer filmpje mag, maar we tonen er hooguit een paar seconden van:
  // het speelt tijdens het inzoomen en dat duurt niet langer.
  const LANDING_VIDEO_MAX_SEC = 6;
  const vid = document.getElementById('landing-zoom-video');
  await new Promise(resolve => {
    const cap = setTimeout(resolve, 12_000); // 12s harde grens

    if (!vid) { clearTimeout(cap); setTimeout(resolve, 1000); return; }

    vid.addEventListener('ended', () => { clearTimeout(cap); resolve(); });

    // Duurt het filmpje langer dan we willen tonen, stop het dan zelf. Zonder
    // ffmpeg kunnen we het bestand niet inkorten, dus begrenzen we het afspelen.
    vid.addEventListener('timeupdate', () => {
      if (vid.currentTime >= LANDING_VIDEO_MAX_SEC) {
        vid.pause();
        clearTimeout(cap);
        resolve();
      }
    });

    // Geen video-bestand: 'error' vuurt snel → korte pauze dan verder
    vid.addEventListener('error', () => {
      clearTimeout(cap);
      setTimeout(resolve, 800);
    });
  });

  // 6. Zoom + overlay gelijktijdig uitfaden, daarna direct naar de app
  zoom.classList.add('landing-zoom--out');
  landingOverlay?.classList.add('landing-overlay--out');
  await new Promise(r => setTimeout(r, 400));

  landingOverlay?.classList.add('hidden');
  document.body.classList.remove('landing-open');
  zoom.remove();
}

function _landingFinishLogin({ playerName, characterId: cid }) {
  state.playerName  = playerName;
  state.characterId = cid;
  document.body.classList.remove('display-kiosk'); // speler ingelogd → geen pure kiosk
  closePlayerPicker();
  applyRole();
  _loadDienstenToegang().catch(() => {});
  try { localStorage.setItem('_lastLogin', JSON.stringify({ charId: cid, ts: Date.now() })); } catch { /* ok */ }
  if (cid && window._socket) window._socket.emit('player:register', cid);
  window._pendingPlayerSubTab = 'personage';
  switchSection('mijn-karakter');
}

// ── Speler-karakter kiezer ──

// openPlayerPicker is vervangen door showLanding() — de 👤-knop brengt
// de speler terug naar de landingspagina om een personage te kiezen.
// closePlayerPicker blijft als no-op zodat bestaande aanroepen vanuit playerLogin werken.
function openPlayerPicker() { showLanding(); }
function closePlayerPicker() { /* panel niet meer in gebruik */ }

// ── Auto-inlog animatie bij geldige sessie ──
// Toont de landing-pagina en speelt de zoom-animatie af zonder wachtwoord te vragen.
async function _landingAutoLogin(charId, playerName) {
  await showLanding();
  // Wacht één extra frame zodat de DOM zeker gereed is
  await new Promise(r => requestAnimationFrame(r));
  const portraitEl = document.querySelector(`.landing-portrait[data-char-id="${CSS.escape(charId)}"]`);
  if (!portraitEl) { switchSection('mijn-karakter'); return; }
  portraitEl.classList.add('landing-portrait--chosen');
  const hasVideo = portraitEl.dataset.portraitVideo === '1';
  try {
    await _landingStartZoom(charId, portraitEl, hasVideo);
    _landingFinishLogin({ playerName, characterId: charId });
  } catch {
    switchSection('mijn-karakter');
  }
}

async function playerLogin(characterId) {
  try {
    const { playerName, characterId: cid } = await api.playerLogin(characterId);
    state.playerName  = playerName;
    state.characterId = cid;
    closePlayerPicker();
    applyRole();
    _loadDienstenToegang().catch(() => {});
    // Sla login op voor animatie-skip bij herlogin binnen 15 minuten
    try { localStorage.setItem('_lastLogin', JSON.stringify({ charId: cid, ts: Date.now() })); } catch { /* ok */ }
    // Registreer socket zodat DM directe berichten kan sturen
    if (cid && window._socket) window._socket.emit('player:register', cid);
    // Herbouw de wikilink-naamindex voor de ingelogde speler
    _rebuildEntityIndex();
    // Navigeer direct naar mijn-karakter → personage-subtab
    window._pendingPlayerSubTab = 'personage';
    switchSection('mijn-karakter');
  } catch (err) {
    alert('Inloggen mislukt: ' + err.message);
  }
}

// Vanaf de knop rechts in de kop: eerst vragen, dan pas weg. Zonder die vraag
// stond je met één misklik op de landingspagina — en dat vóélt als uitloggen,
// ook toen de sessie technisch nog leefde.
async function playerLogoutVraag() {
  const naam = state.playerName || 'dit personage';
  if (!confirm(`Uitloggen als ${naam}?\n\nJe komt terug op de landingspagina en moet opnieuw een personage kiezen.`)) return;
  await playerLogout();
  await showLanding();
}

async function playerLogout() {
  try {
    await api.playerLogout();
    state.playerName  = null;
    state.characterId = null;
    // Het onthouden groepswachtwoord hoort bij die sessie, niet bij de browser.
    _groepsWachtwoord = null;
    // Als we op het eigen tabblad waren, ga naar personages
    if (state.activeSection === 'mijn-karakter') switchSection('personages');
    applyRole();
    // Herbouw de naamindex na uitloggen (terug naar anonieme weergave)
    _rebuildEntityIndex();
    // Herlaad alles zodat anonieme weergave (leeg) geldt
    await refreshAll();
  } catch { /* ok */ }
}

// ── Modal ──
function openModal(title, subtitle, bodyHtml) {
  const modal = document.querySelector('#modal-overlay .modal');
  if (modal) { modal.style.minHeight = ''; modal.classList.remove('modal--wide'); }   // reset bij heropenen
  // Annuleer eventueel lopende portret-load van vorige modal
  const _mPortraitWrap = document.getElementById('m-portrait-wrap');
  const _mPortraitImg  = document.getElementById('m-portrait');
  if (_mPortraitWrap && _mPortraitImg) {
    _mPortraitWrap.classList.add('hidden');
    _mPortraitImg.onload  = null;
    _mPortraitImg.onerror = null;
    _mPortraitImg.src = '';
  }
  $('#m-title').innerHTML = title;
  $('#m-sub').textContent = subtitle;
  $('#m-body').innerHTML = bodyHtml;
  $('#modal-overlay').classList.add('active');
  // Vergrendel de minimale hoogte zodat tabwisseling de modal niet laat krimpen.
  // 300ms: genoeg voor layout + afbeelding eerste frame.
  setTimeout(() => {
    if (!modal) return;
    const h = modal.offsetHeight;
    if (h > 0) modal.style.minHeight = h + 'px';
    // Hersluit na afbeelding-load (hero img kan de hoogte nog vergroten)
    const img = modal.querySelector('.detail-hero-img');
    if (img && !img.complete) {
      img.addEventListener('load', () => {
        const h2 = modal.offsetHeight;
        if (h2 > (parseFloat(modal.style.minHeight) || 0)) modal.style.minHeight = h2 + 'px';
      }, { once: true });
    }
  }, 300);
}

function closeModal() {
  const modal = document.querySelector('#modal-overlay .modal');
  if (modal) modal.style.minHeight = '';   // vrijgeven na sluiten
  $('#modal-overlay').classList.remove('active');
  // Reset navigatiehistory en tracking
  window._currentDetailTab = null;
  window._currentDetailId  = null;
  if (window._clearHistory) window._clearHistory();
  // Verberg shop-tooltip als die nog zichtbaar was
  document.getElementById('shop-item-tooltip')?.classList.add('hidden');
}

// ── Lightbox ──
const LB_ZOOM_MIN = 1;     // niet onder werkelijke grootte; bij 1 toont object-contain
const LB_ZOOM_MAX = 6;
let lbZoom    = 1;
let lbPanX    = 0;
let lbPanY    = 0;
let _lbImages = null;   // [{src, title}] of huidige reeks
let _lbIdx    = 0;

// Sleep- en pinch-status
let _lbDragging = false;
let _lbStartX = 0, _lbStartY = 0, _lbPanStartX = 0, _lbPanStartY = 0;
let _lbMoved = false;
const _lbPointers = new Map();      // pointerId -> {x, y}
let _lbPinchDist = 0;
let _lbPinchZoom = 1;

// Schrijf zoom + pan naar de transform van het beeld
function _lbApply() {
  const img = $('#lb-img');
  if (!img) return;
  if (lbZoom <= LB_ZOOM_MIN + 0.001) { lbPanX = 0; lbPanY = 0; }
  _lbClampPan();
  const live = _lbDragging || _lbPointers.size >= 2;
  img.style.transition = live ? 'none' : 'transform 0.12s ease-out';
  img.style.transform = `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`;
  img.style.cursor = lbZoom > LB_ZOOM_MIN ? (_lbDragging ? 'grabbing' : 'grab') : '';
  const zoomed = lbZoom > LB_ZOOM_MIN + 0.001;
  $('#lb-zoom-reset')?.classList.toggle('opacity-40', !zoomed);
  // Bij ingezoomd beeld de navigatiepijlen verbergen zodat slepen niet botst
  if (zoomed) {
    $('#lb-nav-left')?.classList.add('hidden');
    $('#lb-nav-right')?.classList.add('hidden');
  } else {
    _lbUpdateNav();
  }
}

// Begrens het pannen zodat de afbeelding binnen beeld blijft
function _lbClampPan() {
  const img = $('#lb-img');
  if (!img) return;
  const extraX = img.clientWidth  * (lbZoom - 1) / 2;
  const extraY = img.clientHeight * (lbZoom - 1) / 2;
  lbPanX = Math.max(-extraX, Math.min(extraX, lbPanX));
  lbPanY = Math.max(-extraY, Math.min(extraY, lbPanY));
}

// Zoom rond een punt (px relatief t.o.v. midden van het beeld)
function _lbZoomTo(newZoom, cx, cy) {
  newZoom = Math.max(LB_ZOOM_MIN, Math.min(LB_ZOOM_MAX, newZoom));
  if (cx != null && cy != null) {
    const ratio = newZoom / lbZoom;
    lbPanX = cx - (cx - lbPanX) * ratio;
    lbPanY = cy - (cy - lbPanY) * ratio;
  }
  lbZoom = newZoom;
  _lbApply();
}

function _lbUpdateNav() {
  const multi = (_lbImages?.length || 0) > 1;
  const left  = $('#lb-nav-left');
  const right = $('#lb-nav-right');
  if (left)  left.classList.toggle('hidden',  !multi || _lbIdx <= 0);
  if (right) right.classList.toggle('hidden', !multi || _lbIdx >= _lbImages.length - 1);
}

function _lbShowCurrent() {
  const entry = _lbImages?.[_lbIdx];
  if (!entry) return;
  lbZoom = 1; lbPanX = 0; lbPanY = 0;
  const img = $('#lb-img');
  img.src = entry.src;
  img.style.transform = '';
  img.style.cursor = '';
  $('#lb-title').textContent = entry.title || '';

  const multi = (_lbImages?.length || 0) > 1;
  const cnt   = $('#lb-counter');
  _lbUpdateNav();
  if (cnt) {
    cnt.textContent = multi ? `${_lbIdx + 1} / ${_lbImages.length}` : '';
    cnt.classList.toggle('hidden', !multi);
  }
  $('#lb-zoom-reset')?.classList.add('opacity-40');
}

// Enkelvoudige afbeelding (achterwaarts compatibel)
function openLightbox(src, title) {
  _lbImages = [{ src, title: title || '' }];
  _lbIdx    = 0;
  _lbShowCurrent();
  const lb = $('#lightbox');
  lb.classList.remove('hidden');
  lb.classList.add('flex');
}

// Reeks met navigatie: images = [{src, title}], startIdx = index
function openLightboxAt(images, startIdx = 0) {
  _lbImages = images;
  _lbIdx    = Math.max(0, Math.min((images?.length || 1) - 1, startIdx));
  _lbShowCurrent();
  const lb = $('#lightbox');
  lb.classList.remove('hidden');
  lb.classList.add('flex');
}

function lbNavigate(dir) {
  if (!_lbImages?.length) return;
  _lbIdx = Math.max(0, Math.min(_lbImages.length - 1, _lbIdx + dir));
  _lbShowCurrent();
}

// Zoomknoppen (touch-vriendelijk)
function lbZoomIn()  { _lbZoomTo(lbZoom + 0.5, 0, 0); }
function lbZoomOut() { _lbZoomTo(lbZoom - 0.5, 0, 0); }
function lbZoomReset() { lbZoom = 1; lbPanX = 0; lbPanY = 0; _lbApply(); }

function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.add('hidden');
  lb.classList.remove('flex');
  const img = $('#lb-img');
  img.src = '';
  img.style.transform = '';
  _lbImages = null;
  lbZoom = 1; lbPanX = 0; lbPanY = 0;
  _lbPointers.clear();
  _lbDragging = false;
}

// Wiel-zoom rond de cursor
$('#lightbox')?.addEventListener('wheel', (e) => {
  e.preventDefault();
  const img = $('#lb-img');
  const r = img.getBoundingClientRect();
  const cx = e.clientX - (r.left + r.width / 2);
  const cy = e.clientY - (r.top + r.height / 2);
  _lbZoomTo(lbZoom + (e.deltaY > 0 ? -0.3 : 0.3), cx, cy);
}, { passive: false });

// Dubbelklik / dubbeltik: in- of uitzoomen op het aangewezen punt
$('#lb-img').addEventListener('dblclick', (e) => {
  e.stopPropagation();
  const img = $('#lb-img');
  const r = img.getBoundingClientRect();
  if (lbZoom > LB_ZOOM_MIN + 0.001) {
    lbZoomReset();
  } else {
    const cx = e.clientX - (r.left + r.width / 2);
    const cy = e.clientY - (r.top + r.height / 2);
    _lbZoomTo(2.5, cx, cy);
  }
});

// Pointer-gebaren: slepen (pan) en pinch-zoom
(function () {
  const img = $('#lb-img');

  img.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    _lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    img.setPointerCapture?.(e.pointerId);
    _lbMoved = false;
    if (_lbPointers.size === 2) {
      const pts = [..._lbPointers.values()];
      _lbPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      _lbPinchZoom = lbZoom;
      _lbDragging = false;
    } else if (lbZoom > LB_ZOOM_MIN) {
      _lbDragging = true;
      _lbStartX = e.clientX; _lbStartY = e.clientY;
      _lbPanStartX = lbPanX; _lbPanStartY = lbPanY;
      _lbApply();
    }
  });

  img.addEventListener('pointermove', (e) => {
    if (!_lbPointers.has(e.pointerId)) return;
    _lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (_lbPointers.size === 2) {
      // Pinch-zoom rond het midden tussen de twee vingers
      const pts = [..._lbPointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (_lbPinchDist > 0) {
        const r = img.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - (r.left + r.width / 2);
        const midY = (pts[0].y + pts[1].y) / 2 - (r.top + r.height / 2);
        _lbZoomTo(_lbPinchZoom * (dist / _lbPinchDist), midX, midY);
      }
      _lbMoved = true;
    } else if (_lbDragging) {
      lbPanX = _lbPanStartX + (e.clientX - _lbStartX);
      lbPanY = _lbPanStartY + (e.clientY - _lbStartY);
      if (Math.abs(e.clientX - _lbStartX) > 4 || Math.abs(e.clientY - _lbStartY) > 4) _lbMoved = true;
      _lbApply();
    }
  });

  function endPointer(e) {
    _lbPointers.delete(e.pointerId);
    if (_lbPointers.size < 2) _lbPinchDist = 0;
    if (_lbPointers.size === 0) { _lbDragging = false; _lbApply(); }
  }
  img.addEventListener('pointerup', endPointer);
  img.addEventListener('pointercancel', endPointer);
})();

document.addEventListener('keydown', (e) => {
  if ($('#lightbox').classList.contains('hidden')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   lbNavigate(-1);
  if (e.key === 'ArrowRight')  lbNavigate(1);
  if (e.key === '+' || e.key === '=') lbZoomIn();
  if (e.key === '-' || e.key === '_') lbZoomOut();
  if (e.key === '0')           lbZoomReset();
});

// ── HTML escape ──
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── JS string escape (voor names in single-quoted onclick handlers) ──
function escJS(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Wapeneigenschappen-picker voor een wapenrij op het spelerblad ──
// Hergebruikt WEAPON_PROPERTIES/PARAMETERIZABLE_PROPS + de .weapon-tags-picker-styling
// van de voorwerpen-editor. State leeft per wapen in w.props (array van strings,
// parameteriseerbare props als "Range (20/60)"). Opgeslagen via _saveWeapon(i,'props',…).
// Standaard tonen we alleen de gekozen eigenschappen + een "+ Eigenschap"-knop; de volledige
// lijst klapt pas open als de speler 'm nodig heeft (welke rijen open zijn → _openWeaponProps).
const _openWeaponProps = new Set();
function _weaponPropsPickerHtml(w, i) {
  const sel  = Array.isArray(w.props) ? w.props : [];
  const open = _openWeaponProps.has(i);

  // Samenvatting: gekozen eigenschappen als compacte, verwijderbare chips
  const selChips = sel.map(s => {
    const base = s.replace(/\s*\(.*\)$/, '').trim();
    const tip  = WEAPON_PROPERTIES[s] || WEAPON_PROPERTIES[base] || '';
    return `<button type="button" class="weapon-prop-chip" data-wptip="${esc(tip)}"
      onclick="window._toggleWeaponProp(${i},'${escJS(base)}')" title="Verwijder eigenschap">${esc(s)}<span class="weapon-prop-chip-x">×</span></button>`;
  }).join('');

  const addBtn = `<button type="button" class="weapon-prop-add${open ? ' is-open' : ''}"
    onclick="window._toggleWeaponPropsPicker(${i})">${open ? 'Klaar' : '+ Eigenschap'}</button>`;

  // Volledige keuzelijst — alleen renderen wanneer uitgeklapt
  let grid = '';
  if (open) {
    const chips = Object.keys(WEAPON_PROPERTIES).map(prop => {
      const isParam  = PARAMETERIZABLE_PROPS.has(prop);
      const cur      = sel.find(s => s === prop || s.startsWith(prop + ' (')) || null;
      const isOn     = !!cur;
      const paramVal = (cur && cur !== prop) ? cur.slice(prop.length + 2, -1) : '';
      const tip      = WEAPON_PROPERTIES[prop] || '';
      const safeId   = 'wpp-' + i + '-' + prop.replace(/[^a-zA-Z0-9]/g, '_');
      const btn = `<button type="button"
          class="weapon-tag-pick${isOn ? ' weapon-tag-pick--on' : ''}" data-wptip="${esc(tip)}"
          onclick="window._toggleWeaponProp(${i},'${escJS(prop)}')">${esc(prop)}</button>`;
      if (isParam) {
        const ph = prop === 'Versatile' ? '1d10' : prop === 'Ammunition' ? '80/320' : '20/60';
        return `<span class="weapon-tag-pick-group">${btn}<input type="text" id="${safeId}"
          class="weapon-tag-param-inp${isOn ? '' : ' hidden'}" placeholder="${ph}" value="${esc(paramVal)}"
          onchange="window._updateWeaponPropParam(${i},'${escJS(prop)}',this.value)"
          onclick="event.stopPropagation()"></span>`;
      }
      return btn;
    }).join('');
    grid = `<div class="weapon-tags-picker">${chips}</div>`;
  }

  return `<div class="player-weapon-props" id="wprops-${i}">
      <div class="weapon-props-summary">
        <span class="player-weapon-props-label">Eigenschappen</span>
        ${selChips}
        ${addBtn}
      </div>
      ${grid}
    </div>`;
}

// ── Weapon property tooltip text (English) ──
function _calcArmorAC(d, dexMod) {
  const type = (d?.armorType || '').toLowerCase();
  const base = parseInt(d?.armorBaseAC);
  if (!type || isNaN(base)) return null;
  if (type === 'shield') {
    return { pill: '+' + base + ' AC', tooltip: 'Shield: adds +' + base + ' to your Armor Class. You must wield it in one hand to gain this benefit.' };
  }
  let cap;
  if      (type === 'light')  cap = null;
  else if (type === 'medium') cap = 2;
  else if (type === 'heavy')  cap = 0;
  else { const c = parseInt(d?.armorDexCap); cap = isNaN(c) ? null : c; }
  if (dexMod !== null && dexMod !== undefined) {
    const contrib = (cap === null) ? dexMod : Math.min(dexMod, cap);
    const total   = base + contrib;
    const parts   = [base + ' base'];
    if (cap !== 0) { const s = contrib >= 0 ? '+' + contrib : '' + contrib; parts.push(s + ' Dex' + (cap !== null && dexMod > cap ? ' (max +' + cap + ')' : '')); }
    return { pill: 'AC ' + total, tooltip: 'Armor Class: ' + total + ' (' + parts.join(' ') + ').' };
  } else {
    if (cap === 0)    return { pill: 'AC ' + base,          tooltip: 'Armor Class: ' + base + '. Heavy armor — no Dexterity modifier applied.' };
    if (cap === null) return { pill: 'AC ' + base + '+Dex', tooltip: 'Armor Class: ' + base + ' + your full Dexterity modifier.' };
    return { pill: 'AC ' + base + '+Dex', tooltip: 'Armor Class: ' + base + ' + your Dexterity modifier (maximum +' + cap + ').' };
  }
}

const _WEAPON_PROP_TITLES = {
  'Ammunition':  'You can make a ranged attack with this weapon only if you have ammunition to fire from it. Each attack expends one piece of ammunition. You can recover half your expended ammunition by taking a minute to search the battlefield.',
  'Cleave':      'If you hit a creature with a melee attack using this weapon, you can make one extra melee attack against a second creature within 5 feet of the first that is also within your reach. On this extra attack, use the same ability modifier as the primary attack but don\'t add your ability modifier to the damage roll unless that modifier is negative.',
  'Finesse':     'When making an attack with a Finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.',
  'Graze':       'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used for the attack roll. This damage is the same type dealt by the weapon and can\'t be increased in any way.',
  'Heavy':       'You have Disadvantage on attack rolls with a Heavy weapon if it\'s a Small or Tiny creature.',
  'Light':       'When you take the Attack action and attack with a Light weapon, you can make one extra attack as a Bonus Action later on the same turn with a different Light weapon. You don\'t add your ability modifier to the extra attack\'s damage roll unless that modifier is negative.',
  'Loading':     'You can fire only one piece of ammunition from a Loading weapon when you use an action, a Bonus Action, or a Reaction to fire it, regardless of the number of attacks you can normally make.',
  'Nick':        'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
  'Push':        'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
  'Range':       'A Range weapon can be used to make a ranged attack only if the target is within the weapon\'s normal range, or at Disadvantage if it is within the weapon\'s long range. Targets beyond long range can\'t be attacked.',
  'Reach':       'This weapon adds 5 feet to your reach when you attack with it, as well as when determining your reach for Opportunity Attacks.',
  'Sap':         'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  'Slow':        'If you hit a creature with this weapon and deal damage to it, you can reduce that creature\'s Speed by 10 feet until the start of your next turn.',
  'Special':     'A Special weapon has an unusual rule that is described in its entry in the weapons table.',
  'Thrown':      'If a weapon has the Thrown property, you can throw the weapon to make a ranged attack, and you can draw that weapon as part of the attack. If the weapon is a melee weapon, use the same ability modifier for the attack and damage rolls that you\'d use for a melee attack with it.',
  'Topple':      'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
  'Two-Handed':  'This weapon requires two hands when you attack with it. This property is relevant only when you attack with the weapon, not when you simply hold it.',
  'Two-handed':  'This weapon requires two hands when you attack with it. This property is relevant only when you attack with the weapon, not when you simply hold it.',
  'Versatile':   'A Versatile weapon can be used with one or two hands. A damage value in parentheses appears with the property — the damage when the weapon is used with two hands to make a melee attack.',
  'Vex':         'If you hit a creature with this weapon and deal damage to it, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};
function _weaponPropTitle(prop) {
  return _WEAPON_PROP_TITLES[prop] || _WEAPON_PROP_TITLES[prop.split(' ')[0]] || prop;
}

// ── Markdown → HTML (headings, bold, italic, kleur, newlines) ──
const _MD_KLEUREN = {
  rood:     '#e05555',
  groen:    '#5aaa6a',
  blauw:    '#5b8fd4',
  goud:     '#c4a840',
  paars:    '#a070cc',
  oranje:   '#e08840',
  grijs:    '#888888',
  wit:      '#ece8df',
};
function mdToHtml(s) {
  if (!s) return '';

  // ── Stap 1: Extraheer [[wikilinks]] vóór HTML-escaping ──
  // \x02 is een controle-teken dat nooit in gewone tekst voorkomt.
  const _WL_SEP = '\x02';
  const _wlNames = [];
  const _wlSeen  = new Set();   // track eerste voorkomen per naam
  // Diepte-gebaseerde extractie: buitenste [[...]] wint altijd.
  // Geneste [[X]] binnen [[Y [[X]]]] worden genegeerd (X valt weg, Y [[X]] wordt Y).
  let text = String(s);
  {
    let out = '', i = 0;
    while (i < text.length) {
      if (text[i] === '[' && text[i + 1] === '[') {
        let depth = 1, j = i + 2;
        while (j < text.length && depth > 0) {
          if (text[j] === '[' && text[j + 1] === '[')      { depth++; j += 2; }
          else if (text[j] === ']' && text[j + 1] === ']') { depth--; if (depth > 0) j += 2; else break; }
          else j++;
        }
        // Binnenste tekst: strip eventuele geneste [[ ]]
        const name = text.substring(i + 2, j).replace(/\[\[|\]\]/g, '').trim();
        if (name) {
          const idx = _wlNames.length;
          _wlNames.push(name);
          out += `${_WL_SEP}${idx}${_WL_SEP}`;
        }
        i = j + 2;
      } else {
        out += text[i++];
      }
    }
    text = out;
  }

  // ── Stap 2: Normale markdown-verwerking ──
  text = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Koppen moeten voor inline-markup zodat bold/italic erin werkt
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    .replace(/^#([A-Za-z].+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/_([^_\n]+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>')
    .replace(/\^(.+?)\^/g, '<span class="md-smallcaps">$1</span>')
    // Horizontale lijn: --- op eigen regel
    .replace(/^---$/gm, '<hr class="md-hr">')
    // Gekleurde tekst: {kleur:tekst}
    .replace(/\{(\w+):([^}]+)\}/g, (_, kleur, tekst) => {
      const hex = _MD_KLEUREN[kleur.toLowerCase()];
      return hex ? `<span style="color:${hex}">${tekst}</span>` : tekst;
    })
    .replace(/\n/g, '<br>')
    // Geen losse <br> direct vóór of na een koptag of hr
    .replace(/<br>(<h[1-4]>|<hr)/g, '$1')
    .replace(/(<\/h[1-4]>|<\/hr>)<br>/g, '$1')
    .replace(/(<hr class="md-hr">)<br>/g, '$1');

  // ── Stap 3: Vervang wikilink-placeholders (eerste voorkomen = link, rest = plain) ──
  if (_wlNames.length) {
    const re = new RegExp(`${_WL_SEP}(\\d+)${_WL_SEP}`, 'g');
    text = text.replace(re, (_, idx) => {
      const name    = _wlNames[parseInt(idx)];
      const isFirst = !_wlSeen.has(name);
      if (isFirst) _wlSeen.add(name);
      return _resolveWikilink(name, isFirst);
    });
  }

  return text;
}

// ── Wikilink naam-index ─────────────────────────────────────────────
// Platte map: name → { id, type, vis }
// Wordt gevuld bij opstart én bijgewerkt als render-campagne.js entities laadt.
window._entityNameIndex = window._entityNameIndex || {};

window._buildEntityIndex = function(type, entityList) {
  (entityList || []).forEach(e => {
    window._entityNameIndex[e.name] = {
      id:   e.id,
      type,
      vis:  e._visibility,   // undefined = DM (altijd zichtbaar)
    };
  });
};

// ── Wikilink-resolver ───────────────────────────────────────────────
// isFirst: alleen de eerste keer een klikbare link; dubbelen → plain tekst.
function _resolveWikilink(name, isFirst) {
  const idx   = window._entityNameIndex || {};
  const entry = idx[name];
  const safeName = name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  if (!entry) {
    // Onbekende naam: subtiele grijs-markering
    return `<span class="wikilink-unknown">[[${safeName}]]</span>`;
  }

  const { id, type, vis } = entry;

  // Zichtbaarheidscheck voor spelers
  if (!window.app?.isDM() && (vis === 'hidden' || vis === 'vague')) {
    return `<span class="wikilink-hidden" title="Nog niet onthuld">${safeName}</span>`;
  }

  // Tweede of latere vermelding: plain tekst (geen link)
  if (!isFirst) return safeName;

  // Klikbare link met typespecifieke kleur via data-attribuut
  // Documenten hebben een eigen viewer (render-archief), geen detailvenster
  const open = type === 'documenten'
    ? `window._openDoc('${id}')`
    : `window._openDetail('${type}','${id}')`;
  return `<a class="wikilink wikilink--${type}" data-wl-type="${type}" onclick="event.stopPropagation();${open}" title="${safeName}">${safeName}</a>`;
}

// ── Wikilink autocomplete ───────────────────────────────────────────
let _wlAcTriggerEl = null;

// Herbouw de wikilink-naamindex op basis van de huidige sessie (speler of DM).
// Aanroepen na elke login/logout zodat de index altijd de juiste zichtbare entiteiten bevat.
function _rebuildEntityIndex() {
  const WL_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  window._entityNameIndex = {};           // leeg voordat we herbouwen
  window._entityIndexReady = Promise.all([
    ...WL_TYPES.map(t =>
      api.listEntities(t)
        .then(list => window._buildEntityIndex(t, list))
        .catch(() => {})
    ),
    // Documenten leven onder /api/archief (niet /api/entities); de server
    // filtert daar al op zichtbaarheid per speler/groep.
    api.listArchief()
      .then(a => window._buildEntityIndex('documenten', a.documents))
      .catch(() => {}),
  ]);
  return window._entityIndexReady;
}

function _wlAcInit() {
  // Pre-laad alle entity-types in de naam-index zodat wikilinks direct werken,
  // ook als de bijbehorende sectie nog niet bezocht is.
  _rebuildEntityIndex();

  // Input: detecteer [[ en toon autocomplete
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.tagName !== 'TEXTAREA') return;
    const before = el.value.substring(0, el.selectionStart);
    const m = before.match(/\[\[([^\]]{0,60})$/);
    if (!m) { _wlAcClose(); return; }
    _wlAcShow(el, m[1]);
  });

  // Pijltoetsen, Enter, Escape afhandelen
  document.addEventListener('keydown', ev => {
    const ac = document.getElementById('wikilink-ac');
    if (!ac) return;
    if (!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(ev.key)) return;
    ev.preventDefault();
    const items = [...ac.querySelectorAll('.wikilink-ac-item')];
    const idx = items.findIndex(i => i.classList.contains('wikilink-ac-item--active'));
    if (ev.key === 'Escape') { _wlAcClose(); return; }
    if (ev.key === 'ArrowDown') {
      const next = (idx + 1) % items.length;
      items.forEach((i, n) => i.classList.toggle('wikilink-ac-item--active', n === next));
      return;
    }
    if (ev.key === 'ArrowUp') {
      const prev = (idx - 1 + items.length) % items.length;
      items.forEach((i, n) => i.classList.toggle('wikilink-ac-item--active', n === prev));
      return;
    }
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      items[idx]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return;
    }
  });

  // Klik buiten → sluit
  document.addEventListener('mousedown', ev => {
    if (!ev.target.closest('#wikilink-ac')) _wlAcClose();
  });
}

function _wlAcShow(textarea, query) {
  const idx   = window._entityNameIndex || {};
  const lower = query.toLowerCase();
  const matches = Object.entries(idx)
    .filter(([name]) => name.toLowerCase().includes(lower))
    .map(([name, entry]) => ({ name, type: entry.type }))
    .slice(0, 9);

  if (!matches.length) { _wlAcClose(); return; }

  let ac = document.getElementById('wikilink-ac');
  if (!ac) {
    ac = document.createElement('div');
    ac.id = 'wikilink-ac';
    ac.className = 'wikilink-ac';
    document.body.appendChild(ac);
  }

  const rect = textarea.getBoundingClientRect();
  ac.style.left  = rect.left  + 'px';
  ac.style.top   = (rect.bottom + 4) + 'px';
  ac.style.width = Math.max(rect.width, 280) + 'px';
  ac.style.display = '';

  const ICONS = { personages: icon('user'), locaties: icon('castle', {cls:'icon-gi'}), organisaties: icon('landmark'), voorwerpen: icon('package') };
  ac.innerHTML = matches.map((e, i) =>
    `<div class="wikilink-ac-item${i === 0 ? ' wikilink-ac-item--active' : ''}"
      data-wl-name="${e.name.replace(/"/g,'&quot;')}">
      <span class="wikilink-ac-icon">${ICONS[e.type] || icon('scroll-text')}</span>
      <span class="wikilink-ac-name">${esc(e.name)}</span>
    </div>`
  ).join('');

  // Klik-handler op de container: stopPropagation voorkomt dat het document-listener sluit
  ac.onmousedown = ev => {
    ev.preventDefault();   // voorkomt blur op de textarea
    ev.stopPropagation();  // voorkomt dat de document-mousedown de AC sluit
    const item = ev.target.closest('[data-wl-name]');
    if (item) window._wlAcSelect(item.dataset.wlName);
  };

  _wlAcTriggerEl = textarea;
}

function _wlAcClose() {
  document.getElementById('wikilink-ac')?.remove();
  _wlAcTriggerEl = null;
}

window._wlAcSelect = name => {
  const el = _wlAcTriggerEl;
  if (!el) return;
  const val = el.value;
  const pos = el.selectionStart;
  const before = val.substring(0, pos);
  const m = before.match(/\[\[([^\]]*)$/);
  if (m) {
    const start = pos - m[0].length;
    el.value = val.substring(0, start) + `[[${name}]]` + val.substring(pos);
    el.selectionStart = el.selectionEnd = start + name.length + 4;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  _wlAcClose();
  el.focus();
};

// ── Inline format toolbar (B / I) ──
// Wraps selected text in a textarea with a markdown marker.
// Called via onclick on the toolbar buttons and via keyboard shortcut.
window._fmt = (id, marker) => {
  const ta = document.getElementById(id);
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  const inner = sel || 'tekst';
  ta.value = ta.value.slice(0, start) + marker + inner + marker + ta.value.slice(end);
  ta.setSelectionRange(start + marker.length, start + marker.length + inner.length);
  ta.focus();
};

// Wraps selected text in {kleur:...} — via selectievenstertje
const _FMT_KLEUR_HEX = { rood:'#e05555', groen:'#5aaa6a', blauw:'#5b8fd4', goud:'#c4a840', paars:'#a070cc', oranje:'#e08840', grijs:'#888888' };
// Ook buiten app.js te gebruiken: de opmaakbalk van de entiteit-editor tekent
// dezelfde kleurenlijst, en twee lijstjes die uiteenlopen is vragen om gedoe.
window._FMT_KLEUR_HEX = _FMT_KLEUR_HEX;
window._fmtKleur = (id, kleur) => {
  const ta = document.getElementById(id);
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end) || 'tekst';
  const wrapped = `{${kleur}:${sel}}`;
  ta.value = ta.value.slice(0, start) + wrapped + ta.value.slice(end);
  const cursor = start + wrapped.length;
  ta.setSelectionRange(cursor, cursor);
  ta.focus();
};
window._fmtKleurSelect = (id, sel) => {
  const kleur = sel.value;
  if (!kleur) return;
  // Update dot preview
  const dot = document.getElementById(`fmt-kleur-dot-${id}`);
  if (dot) dot.style.background = _FMT_KLEUR_HEX[kleur] || 'transparent';
  window._fmtKleur(id, kleur);
  sel.value = '';
  if (dot) setTimeout(() => { dot.style.background = 'transparent'; }, 800);
};
window._fmtHr = (id) => {
  const ta = document.getElementById(id);
  if (!ta) return;
  const pos = ta.selectionStart;
  // Voeg --- in op eigen regel
  const before = ta.value.slice(0, pos);
  const after  = ta.value.slice(pos);
  const nl = before.length && !before.endsWith('\n') ? '\n' : '';
  const insert = `${nl}---\n`;
  ta.value = before + insert + after;
  const cursor = pos + insert.length;
  ta.setSelectionRange(cursor, cursor);
  ta.focus();
};

window._fmtKey = (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'b') { e.preventDefault(); window._fmt(e.target.id, '**'); }
  if (e.key === 'i') { e.preventDefault(); window._fmt(e.target.id, '*');  }
};

// ── Actieve groep ──
let _activeGroupId = null;
let _landingCarouselIdx   = 0;
let _landingCarouselTotal = 1;

// ── Party presence state (per groep in localStorage) ──
function _presenceKey() {
  return 'grisburgh_party_presence' + (_activeGroupId ? '_' + _activeGroupId : '');
}
function _getPartyPresence() {
  try { return JSON.parse(localStorage.getItem(_presenceKey()) || '{}'); }
  catch { return {}; }
}
function _setPartyPresence(s) {
  localStorage.setItem(_presenceKey(), JSON.stringify(s));
}

// ── Party portraits ──
async function renderParty() {
  const bar = document.getElementById('party-bar');
  if (!bar) return;
  try {
    const [all, inspirationMap] = await Promise.all([
      api.listEntities('personages'),
      api.getAllInspiration().catch(() => ({})),
    ]);
    const spelers = all.filter(e => {
      if (e.subtype !== 'speler') return false;
      if (!_activeGroupId || !e.data?.groep) return true;
      return e.data.groep === _activeGroupId;
    });
    if (spelers.length === 0) { bar.innerHTML = ''; return; }
    const presence = _getPartyPresence();
    const present  = spelers.filter(e => presence[e.id] !== false);
    const absent   = spelers.filter(e => presence[e.id] === false);
    const renderPortrait = e => {
      const isAbsent = presence[e.id] === false;
      const hasInsp  = !!inspirationMap[e.id];
      const dotTitle = isAbsent ? 'Afwezig — klik om aanwezig te maken' : 'Aanwezig — klik om af te melden';
      return `
        <div class="party-chip${isAbsent ? ' party-chip--absent' : ''}${hasInsp ? ' party-chip--insp' : ''}"
          onclick="window._openDetail('personages','${esc(e.id)}')"
          oncontextmenu="event.preventDefault();event.stopPropagation();window._toggleInspiration('${esc(e.id)}')"
          title="${esc(e.name)}${hasInsp ? ' · Heeft inspiratie' : ''}">
          <button class="party-presence-dot ${isAbsent ? 'absent' : 'present'}"
            onclick="event.stopPropagation();window._togglePartyPresence('${esc(e.id)}')"
            title="${dotTitle}"></button>
          <span class="party-chip-name">${esc(e.name.split(' ')[0])}</span>
          ${hasInsp ? '<span class="party-chip-insp">✨</span>' : ''}
        </div>
      `;
    };
    const divider = (present.length > 0 && absent.length > 0)
      ? '<div class="party-bar-divider"></div>' : '';
    bar.innerHTML = present.map(renderPortrait).join('') + divider + absent.map(renderPortrait).join('');
  } catch { bar.innerHTML = ''; }
}

window._toggleInspiration = async function(charId) {
  try {
    const current = await api.getInspiration(charId);
    if (current.inspired) await api.removeInspiration(charId);
    else await api.giveInspiration(charId);
    renderParty();
  } catch { /* ok */ }
};
window.renderParty   = renderParty;
window.renderLogboek = renderLogboek;

window._togglePartyPresence = (id) => {
  const presence = _getPartyPresence();
  presence[id] = presence[id] === false ? true : false;
  _setPartyPresence(presence);
  const absent = presence[id] === false;
  // Stip in de groep-dropdown ter plekke bijwerken (geen re-render → geen flikker)
  const dot = document.querySelector(`.group-dd-dot[onclick*="${id}"]`);
  if (dot) {
    dot.classList.toggle('absent', absent);
    dot.classList.toggle('present', !absent);
    dot.closest('.group-dd-player')?.classList.toggle('is-absent', absent);
    dot.title = absent ? 'Afwezig — klik om aanwezig te maken' : 'Aanwezig — klik om af te melden';
  }
};

// ── Groepswisselaar: compacte header-pill + dropdown ──
// Automatische kleur per groep, op volgorde uit een vast palet (themakleuren).
const _GROUP_COLORS = ['#b8860b','#2a6a3a','#8b2a2a','#2a5a8a','#5a3a7a','#9a6a2a','#2a7a6a','#a8327a'];
function _groupColor(idx) {
  const n = _GROUP_COLORS.length;
  return _GROUP_COLORS[(((idx % n) + n) % n)] || _GROUP_COLORS[0];
}
window._groupColor = _groupColor;

window.renderGroupSwitcher = async function(groups, activeGroupId) {
  _activeGroupId = activeGroupId;
  window._activeGroupId = activeGroupId; // toegankelijk voor andere modules (render-archief)
  window._groups = groups;               // groepslijst voor naam-opzoeken + DM-paneel
  // Wie er vanavond niet is (per sessie, door de DM ingesteld). Eén plek voor
  // alle modules: deze functie draait bij het laden én bij elk groups:updated.
  window._groepAfwezig = (groups || []).find(g => g.id === activeGroupId)?.afwezig || [];
  const wrap = document.getElementById('group-pill-wrap');
  const pill = document.getElementById('group-pill');
  const dd   = document.getElementById('group-dropdown');
  if (!wrap || !pill || !dd) return;
  // Alleen zichtbaar in DM-modus
  const isDm = state.role === 'dm' && !state.dmPreview;
  wrap.classList.toggle('hidden', !isDm);
  if (!isDm) return;
  if (!groups || !groups.length) { pill.innerHTML = ''; dd.innerHTML = ''; return; }

  const idxOf  = gid => groups.findIndex(g => g.id === gid);
  const active = groups.find(g => g.id === activeGroupId) || groups.find(g => g.active) || groups[0];
  pill.style.setProperty('--grp-c', _groupColor(idxOf(active.id)));
  pill.innerHTML = `<span class="group-pill-dot"></span><span class="group-pill-name">${esc(active.name)}</span><span class="group-pill-caret">▾</span>`;
  pill.title = `Groep: ${active.name} — klik om te wisselen`;

  // Spelers per groep (uit personages, gefilterd op data.groep)
  const byGroup = {};
  try {
    const personages = await api.listEntities('personages');
    for (const e of personages) {
      if (e.subtype !== 'speler') continue;
      (byGroup[e.data?.groep || '__none__'] ||= []).push(e);
    }
  } catch { /* dropdown toont dan geen spelers */ }

  const presence  = _getPartyPresence();
  const playerRow = e => {
    const absent = presence[e.id] === false;
    return `<div class="group-dd-player${absent ? ' is-absent' : ''}">
      <button class="group-dd-dot ${absent ? 'absent' : 'present'}"
        onclick="event.stopPropagation();window._togglePartyPresence('${esc(e.id)}')"
        title="${absent ? 'Afwezig — klik om aanwezig te maken' : 'Aanwezig — klik om af te melden'}"></button>
      <span class="group-dd-player-name"
        onclick="event.stopPropagation();window._openDetail('personages','${esc(e.id)}')">${esc(e.name)}</span>
    </div>`;
  };

  dd.innerHTML = groups.map(g => {
    const players = byGroup[g.id] || [];
    return `<div class="group-dd-group${g.id === active.id ? ' is-active' : ''}" style="--grp-c:${_groupColor(idxOf(g.id))}">
      <button class="group-dd-row" onclick="window.app.switchGroup('${esc(g.id)}')" title="Wissel naar deze groep">
        <span class="group-dd-rowdot"></span>
        <span class="group-dd-rowname">${esc(g.name)}</span>
        ${g.id === active.id ? `<span class="group-dd-check">${icon('check')}</span>` : ''}
      </button>
      ${players.length
        ? `<div class="group-dd-players">${players.map(playerRow).join('')}</div>`
        : `<div class="group-dd-empty">Geen spelers in deze groep</div>`}
    </div>`;
  }).join('');
};

function toggleGroupDropdown() {
  const dd   = document.getElementById('group-dropdown');
  const wrap = document.getElementById('group-pill-wrap');
  if (!dd) return;
  const show = dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !show);
  wrap?.classList.toggle('open', show);
}
// Sluit de dropdown bij een klik buiten de pill
document.addEventListener('click', e => {
  const wrap = document.getElementById('group-pill-wrap');
  if (wrap && !wrap.classList.contains('hidden') && !wrap.contains(e.target)) {
    document.getElementById('group-dropdown')?.classList.add('hidden');
    wrap.classList.remove('open');
  }
});

async function switchGroup(groupId) {
  document.getElementById('group-dropdown')?.classList.add('hidden');
  document.getElementById('group-pill-wrap')?.classList.remove('open');
  try {
    await api.switchGroup(groupId);
    // groups:updated socket-event verwerkt de rest
  } catch (e) {
    alert('Fout bij wisselen van groep: ' + e.message);
  }
}

async function renameGroup(id, currentName) {
  const newName = prompt('Nieuwe naam voor de groep:', currentName);
  if (!newName || newName.trim() === currentName) return;
  try { await api.updateGroup(id, newName.trim()); }
  catch (e) { alert('Fout: ' + e.message); }
}

async function setGroupPassword(id, groupName) {
  const newPw = prompt(`Wachtwoord voor "${groupName}":\n(leeg laten = geen wachtwoord vereist)`,'');
  if (newPw === null) return; // geannuleerd
  try { await api.setGroupPassword(id, newPw.trim()); }
  catch (e) { alert('Fout: ' + e.message); }
}

async function newGroup() {
  const name = prompt('Naam voor de nieuwe groep:');
  if (!name || !name.trim()) return;
  try { await api.createGroup(name.trim()); }
  catch (e) { alert('Fout: ' + e.message); }
}

async function deleteGroup(groupId) {
  const id = groupId || _activeGroupId;
  if (!id) return;
  const btn = document.querySelector(`#group-switcher .group-tab-wrap button.group-tab[onclick*="${id}"]`);
  const name = btn?.textContent?.trim() || 'deze groep';
  if (!confirm(`Groep "${name}" verwijderen? De zichtbaarheidsstatus van deze groep gaat verloren.`)) return;
  try {
    // Als de te verwijderen groep actief is, wissel eerst naar een andere
    if (id === _activeGroupId) {
      const allWraps = [...document.querySelectorAll('#group-switcher .group-tab-wrap')];
      const other = allWraps.find(w => !w.classList.contains('active'));
      const otherId = other?.querySelector('.group-tab')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (otherId) await api.switchGroup(otherId);
    }
    await api.deleteGroup(id);
  } catch (e) { alert('Fout: ' + e.message); }
}

// ── Refresh ──
async function refreshSection(section) {
  section = section || state.activeSection;
  if (section === 'personages') { await renderPersonages(); await renderParty(); }
  else if (section === 'locaties') await renderLocaties();
  else if (section === 'organisaties') await renderOrganisaties();
  else if (section === 'voorwerpen') await renderVoorwerpen();
  else if (section === 'documenten') await renderDocumenten();
  else if (section === 'bestiarium') await renderBestiarium();
  else if (section === 'spreuken') await renderSpreuken();
  else if (section === 'logboek') await renderLogboek();
  else if (section === 'kaart') await _renderKaartSection();
  else if (section === 'relatiemap') await renderRelatiemap();
  else if (section === 'herberg') {
    if (!window.app.isDM() && _getDienstToegang('herberg') === 'zichtbaar') {
      const _el = document.getElementById('section-herberg'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.herberg?.naam || 'De Herberg');
    } else if (!window.app.isDM() && _getDienstToegang('herberg') === 'verborgen') {
      const _el = document.getElementById('section-herberg'); if (_el) _el.innerHTML = '';
    } else await renderHerberg();
  }
  else if (section === 'tweespalt') {
    if (!window.app.isDM() && _getDienstToegang('tweespalt') === 'zichtbaar') {
      const _el = document.getElementById('section-tweespalt'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.tweespalt?.naam || 'De Tweespalt');
    } else if (!window.app.isDM() && _getDienstToegang('tweespalt') === 'verborgen') {
      const _el = document.getElementById('section-tweespalt'); if (_el) _el.innerHTML = '';
    } else await renderTweespalt();
  }
  else if (section === 'gock') {
    if (!window.app.isDM() && _getDienstToegang('gock') === 'zichtbaar') {
      const _el = document.getElementById('section-gock'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.gock?.naam || 'De Gock');
    } else if (!window.app.isDM() && _getDienstToegang('gock') === 'verborgen') {
      const _el = document.getElementById('section-gock'); if (_el) _el.innerHTML = '';
    } else await renderGock();
  }
  else if (section === 'magizoo') {
    if (!window.app.isDM() && _getDienstToegang('magizoo') === 'zichtbaar') {
      const _el = document.getElementById('section-magizoo'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.magizoo?.naam || 'De Magizoöloog');
    } else if (!window.app.isDM() && _getDienstToegang('magizoo') === 'verborgen') {
      const _el = document.getElementById('section-magizoo'); if (_el) _el.innerHTML = '';
    } else await renderMagizoo();
  }
  else if (section === 'ursula') {
    if (!window.app.isDM() && _getDienstToegang('ursula') === 'zichtbaar') {
      const _el = document.getElementById('section-ursula'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.ursula?.naam || 'Madame Ursula');
    } else if (!window.app.isDM() && _getDienstToegang('ursula') === 'verborgen') {
      const _el = document.getElementById('section-ursula'); if (_el) _el.innerHTML = '';
    } else await renderUrsula();
  }
  else if (section === 'tempel') {
    if (!window.app.isDM() && _getDienstToegang('tempel') === 'zichtbaar') {
      const _el = document.getElementById('section-tempel'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.tempel?.naam || 'De Tempel');
    } else if (!window.app.isDM() && _getDienstToegang('tempel') === 'verborgen') {
      const _el = document.getElementById('section-tempel'); if (_el) _el.innerHTML = '';
    } else await renderTempel();
  }
  else if (section === 'heeren') {
    if (!window.app.isDM() && _getDienstToegang('heeren') === 'zichtbaar') {
      const _el = document.getElementById('section-heeren'); if (_el) _dienstNietBeschikbaar(_el, state.meta?.heeren?.naam || 'Heeren van de Nacht');
    } else if (!window.app.isDM() && _getDienstToegang('heeren') === 'verborgen') {
      const _el = document.getElementById('section-heeren'); if (_el) _el.innerHTML = '';
    } else await renderHeeren();
  } else if (section === 'facties') {
    await renderFacties();
  } else if (section === 'mijn-karakter') {
    await renderMijnKarakter();
    window._pendingKarakterRefresh = false; // verwerk eventuele pending refresh
  }
  else if (section === 'spelers') await renderSpelersTab();
  else if (section === 'meesterkamer') { if (state.role === 'dm') window.dmPanel?.renderMeesterkamer?.(); }
}

// ── Kaart-sectie: toggle tussen Wereldkaarten en Dungeons ──
// ── Kaarten-galerij (onder Logboek) — hoofdkaarten + dungeons als kaartjes ──
let _kaartFsType = null; // 'wereld' | 'dungeon' wanneer fullscreen open is

async function _renderKaartSection() {
  const container = document.getElementById('section-kaart');
  if (!container) return;
  container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--kaart">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('map')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Kaarten</div>
          <div class="section-banner-desc-line">Hoofdkaarten en dungeons van de wereld</div>
        </div>
        <div style="margin-left:auto">${window._helpBtn?.('kaart') ?? ''}</div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="kaart-galerij" id="kaart-galerij">
      <div class="kg-grid">${window._skelCards?.(4) || ''}</div>
    </div>`;
  await _renderKaartGalerij();
}

async function _renderKaartGalerij() {
  const host = document.getElementById('kaart-galerij');
  if (!host) return;
  const dm = window.app?.isDM?.();
  let maps = [], dungeons = [];
  try { [maps, dungeons] = await Promise.all([api.listMaps(), api.listDungeons()]); } catch { /* leeg */ }

  const worldCards = maps.map(m => _kaartCard('wereld', m, dm)).join('');
  const dngCards   = dungeons.map(d => _kaartCard('dungeon', d, dm)).join('');

  host.innerHTML = `
    <div class="kg-group">
      <div class="kg-group-head">${icon('map')} <span>Hoofdkaarten</span>
        ${dm ? `<button class="kg-add-btn" onclick="window._openKaartFullscreen('wereld',null)" title="Kaart toevoegen / beheren">${icon('plus')}</button>` : ''}</div>
      <div class="kg-grid">${worldCards || '<p class="kg-empty">Nog geen hoofdkaarten.</p>'}</div>
    </div>
    <div class="kg-group">
      <div class="kg-group-head">${icon('swords')} <span>Dungeons</span>
        ${dm ? `<button class="kg-add-btn" onclick="window._openKaartFullscreen('dungeon',null)" title="Dungeon toevoegen / beheren">${icon('plus')}</button>` : ''}</div>
      <div class="kg-grid">${dngCards || `<p class="kg-empty">${dm ? 'Nog geen dungeons — gebruik + om er een te maken.' : 'Nog geen dungeons ontdekt.'}</p>`}</div>
    </div>`;
}

function _kaartCard(type, m, dm) {
  const id   = m.id;
  const name = type === 'wereld' ? (m.label || 'Kaart') : (m.name || 'Dungeon');
  const desc = m.description || '';
  const thumbSrc = type === 'wereld'
    ? (m.src || api.fileUrl(m.id))
    : (m.thumbId ? api.fileUrl(m.thumbId) : '');
  const thumb = thumbSrc
    ? `<img class="kg-card-thumb" loading="lazy" src="${thumbSrc}" onerror="this.style.display='none';this.closest('.kg-card').classList.add('kg-card--noimg')">`
    : '';
  return `
    <div class="kg-card kg-card--${type}${!thumbSrc ? ' kg-card--noimg' : ''}" onclick="window._openKaartFullscreen('${type}','${esc(id)}')">
      <div class="kg-card-thumbwrap">
        ${thumb}
        <div class="kg-card-fallback">${icon(type === 'wereld' ? 'map' : 'swords')}</div>
        <span class="kg-card-badge kg-badge--${type}">${type === 'wereld' ? 'Hoofdkaart' : 'Dungeon'}</span>
        ${dm ? `<button class="kg-card-edit" onclick="event.stopPropagation();window._kaartEdit('${type}','${esc(id)}')" title="Naam/beschrijving${type === 'dungeon' ? '/thumbnail' : ''} bewerken">${icon('pencil')}</button>` : ''}
      </div>
      <div class="kg-card-body">
        <div class="kg-card-name">${esc(name)}</div>
        ${desc
          ? `<p class="kg-card-desc">${esc(desc)}</p>`
          : (dm ? `<p class="kg-card-desc kg-card-desc--empty">Geen beschrijving — klik op ${'✎'} om er een toe te voegen.</p>` : '')}
      </div>
    </div>`;
}

// ── Fullscreen-overlay: hergebruikt de bestaande kaart-/dungeon-weergave ──
window._openKaartFullscreen = async function(type, id) {
  let ov = document.getElementById('kaart-fs-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'kaart-fs-overlay';
    ov.className = 'kaart-fs-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <button class="kaart-fs-close" onclick="window._closeKaartFullscreen()" title="Sluiten (Esc)">${icon('x')}</button>
    <div class="kaart-fs-content" id="kaart-fs-content"></div>`;
  ov.classList.add('open');
  document.body.classList.add('kaart-fs-active');
  _kaartFsType = type;
  const fsHost = document.getElementById('kaart-fs-content');
  try {
    if (type === 'wereld') await renderKaart(fsHost, id || undefined);
    else                   await renderDungeon(fsHost, id || undefined);
  } catch (e) { fsHost.innerHTML = `<p style="padding:24px">Kon de kaart niet laden: ${esc(e.message)}</p>`; }
};

window._closeKaartFullscreen = function() {
  const ov = document.getElementById('kaart-fs-overlay');
  if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
  document.body.classList.remove('kaart-fs-active');
  _kaartFsType = null;
  if (state.activeSection === 'kaart') _renderKaartGalerij(); // naam/desc/thumb kunnen gewijzigd zijn
};

// Esc sluit de fullscreen-kaart
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('kaart-fs-overlay')?.classList.contains('open')) {
    window._closeKaartFullscreen();
  }
});

// ── DM: naam/beschrijving/thumbnail bewerken ──
window._kaartEdit = async function(type, id) {
  let item;
  try {
    if (type === 'wereld') item = (await api.listMaps()).find(m => m.id === id);
    else                   item = (await api.listDungeons()).find(m => m.id === id);
  } catch {}
  if (!item) return;
  const naam = type === 'wereld' ? (item.label || '') : (item.name || '');
  window._kaartEditThumbPending = null;
  const body = `
    <div class="dm-feature-section" style="margin:0">
      <div class="dm-form-row"><label class="dm-form-label">Naam</label>
        <input id="kaart-edit-naam" class="dm-input" value="${esc(naam)}"></div>
      <div class="dm-form-row"><label class="dm-form-label">Beschrijving</label>
        <textarea id="kaart-edit-desc" class="dm-input" rows="3" placeholder="Korte omschrijving voor op het kaartje…">${esc(item.description || '')}</textarea></div>
      ${type === 'dungeon' ? `
      <div class="dm-form-row">
        <label class="dm-form-label">Verdieping</label>
        <input id="kaart-edit-verdieping" class="dm-input dm-input-sm" type="number" style="width:80px"
          value="${item.verdieping ?? ''}" placeholder="—">
        <span class="dm-hint">0 = begane grond, −1 = kelder. Leeg laten als deze kaart geen verdieping is.</span>
      </div>
      <div class="dm-form-row" style="flex-direction:column;gap:6px">
        <label class="dm-form-label">Thumbnail</label>
        ${item.thumbId ? `<img id="kaart-edit-thumb-prev" src="${api.fileUrl(item.thumbId)}" class="kaart-edit-thumb">` : '<span id="kaart-edit-thumb-prev"></span>'}
        <button type="button" class="dm-btn dm-btn-sm" style="align-self:flex-start" onclick="window._kaartEditPickThumb()" title="Thumbnail kiezen of uploaden">${icon('image')} Afbeelding</button>
      </div>` : ''}
      <div class="dm-feature-row" style="margin-top:6px">
        <button class="dm-btn dm-btn-primary" onclick="window._kaartEditSave('${type}','${esc(id)}')">${icon('save')} Opslaan</button>
        <button class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">${icon('x')} Annuleren</button>
      </div>
    </div>`;
  window.app.openModal('Kaart bewerken', naam, body);
};

window._kaartEditPickThumb = function() {
  const naamHint = (document.getElementById('kaart-edit-naam')?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
  window.mediaPicker.open({
    type: 'afbeelding',
    suggestedName: naamHint ? `${naamHint}-kaart` : '',
    onSelect: (fileId) => {
      window._kaartEditThumbPending = fileId;
      const prev = document.getElementById('kaart-edit-thumb-prev');
      const img = document.createElement('img');
      img.id = 'kaart-edit-thumb-prev'; img.className = 'kaart-edit-thumb'; img.src = api.fileUrl(fileId);
      prev?.replaceWith(img);
    },
  });
};

window._kaartEditSave = async function(type, id) {
  const naam = document.getElementById('kaart-edit-naam')?.value.trim();
  const desc = document.getElementById('kaart-edit-desc')?.value.trim() || '';
  try {
    if (type === 'wereld') {
      await api.updateMap(id, { label: naam || undefined, description: desc });
    } else {
      const patch = { name: naam || undefined, description: desc };
      const vRaw = document.getElementById('kaart-edit-verdieping')?.value.trim();
      if (vRaw !== undefined) patch.verdieping = vRaw === '' ? null : vRaw;
      if (window._kaartEditThumbPending) patch.thumbId = window._kaartEditThumbPending;
      await api.updateDungeon(id, patch);
    }
    window.app.closeModal();
    _renderKaartGalerij();
  } catch (e) { alert('Opslaan mislukt: ' + e.message); }
};

const _SKILLS = [
  { key: 'acrobatics',    label: 'Acrobatics',     ab: 'dex' },
  { key: 'animalHandling',label: 'Animal Handling', ab: 'wis' },
  { key: 'arcana',        label: 'Arcana',          ab: 'int' },
  { key: 'athletics',     label: 'Athletics',       ab: 'str' },
  { key: 'deception',     label: 'Deception',       ab: 'cha' },
  { key: 'history',       label: 'History',         ab: 'int' },
  { key: 'insight',       label: 'Insight',         ab: 'wis' },
  { key: 'intimidation',  label: 'Intimidation',    ab: 'cha' },
  { key: 'investigation', label: 'Investigation',   ab: 'int' },
  { key: 'medicine',      label: 'Medicine',        ab: 'wis' },
  { key: 'nature',        label: 'Nature',          ab: 'int' },
  { key: 'perception',    label: 'Perception',      ab: 'wis' },
  { key: 'performance',   label: 'Performance',     ab: 'cha' },
  { key: 'persuasion',    label: 'Persuasion',      ab: 'cha' },
  { key: 'religion',      label: 'Religion',        ab: 'int' },
  { key: 'sleightOfHand', label: 'Sleight of Hand', ab: 'dex' },
  { key: 'stealth',       label: 'Stealth',         ab: 'dex' },
  { key: 'survival',      label: 'Survival',        ab: 'wis' },
];
const _SKILLS_HP = [
  { key: 'acrobatics',      label: 'Acrobatics',        ab: 'dex' },
  { key: 'athletics',       label: 'Athletics',         ab: 'str' },
  { key: 'deception',       label: 'Deception',         ab: 'cha' },
  { key: 'historyOfMagic',  label: 'History of Magic',  ab: 'int' },
  { key: 'herbology',       label: 'Herbology',         ab: 'int' },
  { key: 'insight',         label: 'Insight',           ab: 'wis' },
  { key: 'intimidation',    label: 'Intimidation',      ab: 'cha' },
  { key: 'investigation',   label: 'Investigation',     ab: 'int' },
  { key: 'medicine',        label: 'Medicine',          ab: 'wis' },
  { key: 'magicalCreatures',label: 'Magical Creatures', ab: 'wis' },
  { key: 'muggleStudies',   label: 'Muggle Studies',    ab: 'int' },
  { key: 'perception',      label: 'Perception',        ab: 'wis' },
  { key: 'performance',     label: 'Performance',       ab: 'cha' },
  { key: 'persuasion',      label: 'Persuasion',        ab: 'cha' },
  { key: 'potionMaking',    label: 'Potion-making',     ab: 'wis' },
  { key: 'sleightOfHand',   label: 'Sleight of Hand',   ab: 'dex' },
  { key: 'stealth',         label: 'Stealth',           ab: 'dex' },
  { key: 'survival',        label: 'Survival',          ab: 'wis' },
];
const _KLASSEN_DEFAULT = ['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
function _getSkills() {
  return state.meta?.skillSet === 'hp' ? _SKILLS_HP : _SKILLS;
}
function _getKlassen() {
  return state.meta?.klassen?.length ? state.meta.klassen : _KLASSEN_DEFAULT;
}

// Zoek de canonieke klasse-key in de progressie-data (hoofdletter-ongevoelig + aliassen).
function _progClassKey(prog, klasse) {
  if (!prog?.classes || !klasse) return null;
  const n = String(klasse).trim().toLowerCase();
  for (const [key, data] of Object.entries(prog.classes)) {
    if (key.toLowerCase() === n) return key;
    if ((data.aliassen || []).some(a => String(a).toLowerCase() === n)) return key;
  }
  for (const key of Object.keys(prog.classes)) if (n.startsWith(key.toLowerCase())) return key;
  return null;
}

// Bouw een profiel-dropdown. Bestaande (mogelijk niet-canonieke) waarde blijft selecteerbaar
// zodat er geen data verloren gaat; de speler kan zo overstappen op een canonieke optie.
function _ppfSelectField(field, current, options, placeholder, extraOnchange = '') {
  const cur = current ?? '';
  const opts = [...options];
  if (cur && !opts.includes(cur)) opts.unshift(cur);
  return `<select class="ppf-input ppf-select"
    onchange="window._saveProfileField('${field}', this.value)${extraOnchange ? '; ' + extraOnchange : ''}">
    <option value="">${placeholder}</option>
    ${opts.map(o => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}
  </select>`;
}
const _AB_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

let _playerSubTab    = localStorage.getItem('_playerSubTab') || 'party';
let _klasseThemeOn   = localStorage.getItem('_klasseThemeOn') === 'true'; // standaard uit (klasse-afhankelijke CSS uitgezet)
let _playerSpellList = null;

// Markdown → HTML voor spreukomschrijvingen (bold, italic, {color:text}, auto-highlights)
// opts.diceColor: CSS color string to use for dice notation spans (damage-type tinted)
function _spellMd(t, { diceColor } = {}) {
  const diceStyle = diceColor
    ? ` style="color:${diceColor};text-decoration-color:${diceColor}66"`
    : '';
  let s = esc(String(t ?? ''))
    // 5etools-tagrestje: '#' direct na nadruk-markers weghalen (bv. **_#Cantrip Upgrade._**)
    .replace(/([*_]+)#(?=\w)/g, '$1');
  return s
    // ── Auto-highlights (applied to plain text before markdown) ──
    // Dice notation: 2d6, 1d20+5, 4d8, d4 – tinted by damage type, clickable
    .replace(/\b(\d*d\d+(?:\s*[+\-]\s*\d+)?)\b/gi,
      (_, f) => `<span class="sb-hl-dice"${diceStyle} title="Klik om te gooien">${f}</span>`)
    // Damage-type-woord vóór "damage" krijgt de kleur van zijn type (uniform met de dice)
    .replace(/\b(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)(?=\s+damage\b)/gi,
      (m) => { const c = _sbDiceColor(m); return `<span class="sb-hl-dmg" style="color:${c};text-decoration-color:${c}66">${m}</span>`; })
    // DC values and saving throws / ability checks
    .replace(/\bDC\s+\d+\b/g,
      (m) => `<span class="sb-hl-save">${m}</span>`)
    .replace(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(saving throw|check)\b/gi,
      (m) => `<span class="sb-hl-save">${m}</span>`)
    // Range mentions: "30 feet", "60-foot cone", "120 feet", etc.
    .replace(/\b\d+[‐\-]foot\b|\b\d+\s+feet?\b/gi,
      (m) => `<span class="sb-hl-range">${m}</span>`)
    // ── Markdown (*, _ varianten) ──
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/___(.+?)___/g,       '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/__(.+?)__/g,         '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/_(.+?)_/g,           '<em>$1</em>')
    // ── User color syntax: {red:text} or {#8060ff:text} ──
    .replace(/\{([a-zA-Z#][a-zA-Z0-9#]*):([^}]+)\}/g, (_, color, text) =>
      /^(#[0-9a-fA-F]{3,6}|[a-zA-Z]{2,30})$/.test(color)
        ? `<span style="color:${color}">${text}</span>` : text);
}

// ── Block-level markdown renderer for spell descriptions ──
// Handles headings (###), tables (|col|col|), bullet lists (- item),
// and skips #Tag import artefacts.
function _sbMdTable(lines, opts) {
  const sepRe = /^\|[\s\-:|]+\|?$/;
  const rows = lines.filter(l => !sepRe.test(l));
  if (!rows.length) return '';
  const parseRow = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const [hRow, ...bRows] = rows;
  const hCells = parseRow(hRow).map(c => `<th>${_spellMd(c, opts)}</th>`).join('');
  const bHtml  = bRows.map(r => {
    const cells = parseRow(r);
    // Tag rows whose first cell is a number or range (e.g. "3" or "01–05") for dice highlighting
    const first = cells[0]?.replace(/\s|\*/g, '') || '';
    const numAttr = /^\d+$/.test(first) || /^\d+[-–]\d+$/.test(first)
      ? ` data-num="${first}"` : '';
    return `<tr${numAttr}>${cells.map(c => `<td>${_spellMd(c, opts)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="sb-desc-table-wrap"><table class="sb-desc-table">` +
    `<thead><tr>${hCells}</tr></thead><tbody>${bHtml}</tbody></table></div>`;
}

// Does a roll result fall within the range described by a first-column value?
function _sbMatchesRoll(numStr, result) {
  const s = numStr.replace(/\s/g, '');
  if (/^\d+$/.test(s)) return parseInt(s) === result;
  const m = s.match(/^(\d+)[-–](\d+)$/);
  if (!m) return false;
  const lo = parseInt(m[1]), hi = parseInt(m[2]) === 0 ? 100 : parseInt(m[2]);
  return result >= lo && result <= hi;
}

function _renderSpellDesc(rawDesc, opts = {}) {
  if (!rawDesc) return '';
  const lines = rawDesc.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // Heading: "### Title" (hash + space + content)
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = Math.min(hMatch[1].length, 4);
      html += `<p class="sb-desc-h sb-desc-h${level}">${_spellMd(hMatch[2], opts)}</p>`;
      i++; continue;
    }

    // "#Word" without space: section sub-header (e.g. "#Cantrip Upgrade.") or tag artefact.
    // Render as h3 if it contains a space or ends with '.'/':'  — skip pure single-word tags.
    if (/^#[A-Za-z]/.test(line)) {
      if (/\s/.test(line) || /[.:]$/.test(line)) {
        html += `<p class="sb-desc-h sb-desc-h3">${_spellMd(line.slice(1).trim(), opts)}</p>`;
      }
      i++; continue;
    }

    // Table: collect consecutive | lines
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      html += _sbMdTable(tableLines, opts);
      continue;
    }

    // Bullet list: collect consecutive - / * lines
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      html += `<ul class="sb-desc-list">${
        items.map(it => `<li>${_spellMd(it, opts)}</li>`).join('')
      }</ul>`;
      continue;
    }

    // Regular paragraph
    html += `<p>${_spellMd(line, opts)}</p>`;
    i++;
  }
  // Begrippen voorzien van hover-uitleg (D&D-terminologie)
  return window.glossary?.annotate?.(html) ?? html;
}

// Returns a CSS color for dice spans based on damage type in spell.damage
function _sbDiceColor(dmg) {
  if (!dmg) return null;
  const d = dmg.toLowerCase();
  if (/heal/.test(d))                   return '#1a7a3a';
  if (/fire/.test(d))                   return '#c43010';
  if (/cold|ice|frost/.test(d))         return '#1464a0';
  if (/lightning/.test(d))             return '#a89000';
  if (/thunder/.test(d))               return '#5a6a7a';
  if (/acid/.test(d))                   return '#3a7a10';
  if (/force/.test(d))                  return '#6020a0';
  if (/radiant/.test(d))               return '#b07800';
  if (/necrotic/.test(d))              return '#2a4a28';
  if (/psychic/.test(d))               return '#8020a0';
  if (/poison/.test(d))                return '#4a7a10';
  if (/slash|pierc|bludgeon/.test(d))  return '#5a3a28';
  return '#b01010';
}

// Generates a randomised torn-paper clip-path for the right page
function _sbGenTornEdge(seed) {
  const pts = ['0% 0%', '100% 0%'];
  const steps = 28;
  for (let i = 1; i <= steps; i++) {
    const y   = ((i / steps) * 100).toFixed(1);
    const v1  = (Math.sin(seed * 0.031 + i * 1.7) * 0.5 + 0.5);  // 0..1
    const v2  = (Math.sin(seed * 0.017 + i * 3.3) * 0.5 + 0.5);  // 0..1
    const x   = (97.5 + v1 * 1.6 + v2 * 0.9).toFixed(1);         // 97.5–100%
    pts.push(`${x}% ${y}%`);
  }
  pts.push('100% 100%', '0% 100%');
  return `polygon(${pts.join(', ')})`;
}

// ── Spreukenboek overlay ──────────────────────────────────────────────────────
const _SB_SCHOOLS = {
  abjuration:    { c1: '#0c2248', c2: '#1e4a8a', icon: 'shield'     },
  conjuration:   { c1: '#0a3020', c2: '#1a6a50', icon: 'sparkles'   },
  divination:    { c1: '#200c4e', c2: '#5a2e8a', icon: 'eye'        },
  enchantment:   { c1: '#4a082e', c2: '#962058', icon: 'heart'      },
  evocation:     { c1: '#4a1000', c2: '#a03810', icon: 'zap'        },
  illusion:      { c1: '#150848', c2: '#441892', icon: 'moon'       },
  necromancy:    { c1: '#040c06', c2: '#142e14', icon: 'skull'      },
  transmutation: { c1: '#301800', c2: '#7a4a08', icon: 'refresh-cw' },
};
const _SB_DEFAULT = { c1: '#1a1220', c2: '#2e2040', icon: 'book-open' };

const _sbState = {
  spells: [],
  idx: 0,
  favs: new Set(),
  charId: null,
  tocOpen: false,
  tocPreparedOnly: false,
  manageOpen: false,
  slots: {},           // { 1: { max: 3, used: 1 }, ... }
  spellSaveDC: null,
  spellAttackBonus: null,
  castSlotLevel: null, // ephemeral: chosen cast level for current spell
};
const _sbDescCache = new Map(); // spell.index → fetched desc string

// ── Spell preparation (2024) ──────────────────────────────────────
// Spellcasting-ability per klasse → modifier voor het voorbereid-limiet.
function _spellAbility(klasse) {
  const k = String(klasse || '').toLowerCase();
  if (/wizard|artificer|magi[eë]r|tovenaar/.test(k)) return 'int';
  if (/cleric|druid|ranger|priester|klerk|verkenner/.test(k)) return 'wis';
  return 'cha'; // bard, paladin, sorcerer, warlock + onbekend
}
// Auto-suggestie voor het aantal voorbereide spreuken (cantrips tellen niet mee).
function _preparedLimit(klasse, level, mod) {
  const k = String(klasse || '').toLowerCase();
  const lvl = parseInt(level) || 0;
  if (!lvl) return 0;
  if (/warlock/.test(k))                      return Math.max(1, Math.min(lvl + 1, 15));
  if (/paladin|ranger|artificer/.test(k))     return Math.max(1, Math.floor(lvl / 2) + mod); // half-caster
  return Math.max(1, lvl + mod);              // vol-caster (bard/cleric/druid/sorcerer/wizard)
}
let _sbOpenRafId = null;        // rAF token for the open animation — cancelled on close

// ── Subtle sound effects (Web Audio — no files needed) ──
const _sbAudio = (() => {
  let ctx = null;
  const gc = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  return {
    page() {
      try {
        const c = gc(), buf = c.createBuffer(1, c.sampleRate * 0.20, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length,2.2) * 0.10;
        const src = c.createBufferSource(), f = c.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
        src.buffer = buf; src.connect(f); f.connect(c.destination); src.start();
      } catch(e) {}
    },
    dice() {
      try {
        const c = gc();
        [0, 65, 130].forEach(delay => setTimeout(() => {
          const buf = c.createBuffer(1, c.sampleRate*0.035, c.sampleRate), d = buf.getChannelData(0);
          for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8)*0.18;
          const src = c.createBufferSource(); src.buffer=buf; src.connect(c.destination); src.start();
        }, delay));
      } catch(e) {}
    },
    write() {
      try {
        const c = gc(), osc = c.createOscillator(), g = c.createGain();
        osc.frequency.value = 1800+Math.random()*600; g.gain.setValueAtTime(0.012,c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.025);
        osc.connect(g); g.connect(c.destination); osc.start(); osc.stop(c.currentTime+0.025);
      } catch(e) {}
    },
  };
})();

// ── Marginalia icon definitions (20×20 viewBox, stroke-based) ──
const _SB_ICONS = {
  damage:    `<line x1="5" y1="15" x2="15" y2="5" stroke-width="2"/><line x1="5" y1="9" x2="5" y2="5"/><line x1="5" y1="5" x2="9" y2="5"/>`,
  aoe:       `<circle cx="10" cy="10" r="2.5"/><circle cx="10" cy="10" r="6.5" stroke-dasharray="2 1.8" stroke-width="1.2"/>`,
  buff:      `<line x1="10" y1="14" x2="10" y2="5"/><polyline points="6,9 10,5 14,9"/><line x1="5" y1="16" x2="15" y2="16" stroke-width="1.2"/>`,
  control:   `<path d="M7 10 a3 3 0 0 1 6 0 v4 H7 Z"/><circle cx="10" cy="8" r="1.5" stroke-width="1.2"/>`,
  healing:   `<line x1="10" y1="4" x2="10" y2="16" stroke-width="2"/><line x1="4" y1="10" x2="16" y2="10" stroke-width="2"/>`,
  mobility:  `<path d="M4 10 H16"/><polyline points="12,6 16,10 12,14"/><path d="M8 7 C5 8 5 12 8 13" stroke-width="1.2"/>`,
  utility:   `<circle cx="10" cy="10" r="2"/><line x1="10" y1="4" x2="10" y2="6.5"/><line x1="10" y1="13.5" x2="10" y2="16"/><line x1="4" y1="10" x2="6.5" y2="10"/><line x1="13.5" y1="10" x2="16" y2="10"/>`,
  divination:`<path d="M3 10 C5 5.5 15 5.5 17 10 C15 14.5 5 14.5 3 10 Z"/><circle cx="10" cy="10" r="2.5"/>`,
  stealth:   `<path d="M14 5 A6 6 0 1 0 14 15 A4 4 0 0 1 14 5"/><circle cx="9.5" cy="10" r="1.5" fill="currentColor" stroke="none"/>`,
  reaction:  `<polyline points="11,3 7,11 11,11 9,17 15,9 11,9 13,3" stroke-linejoin="round"/>`,
  ritual:    `<circle cx="10" cy="10" r="7" stroke-width="1.2"/><path d="M10 4 L11.2 7.5 L15 7.5 L12 9.7 L13 13 L10 11 L7 13 L8 9.7 L5 7.5 L8.8 7.5 Z" stroke-width="1"/>`,
  social:    `<path d="M5 6 H15 a1 1 0 0 1 1 1 V12 a1 1 0 0 1-1 1 H8 L5 16 V13 H5 a1 1 0 0 1-1-1 V7 a1 1 0 0 1 1-1 Z"/>`,
};
const _SB_ICON_LABELS = {
  damage:'Damage', aoe:'Area of Effect', buff:'Buff', control:'Crowd Control',
  healing:'Healing', mobility:'Movement', utility:'Utility', divination:'Divination',
  stealth:'Stealth / Illusion', reaction:'Reaction', ritual:'Ritual', social:'Social',
};
let   _sbFlipping  = false;    // prevent overlapping flip animations

// Glossary: D&D terms → Dutch explanation (shown as hover tooltip)
const _SB_GLOSSARY = [
  // Casting time / actions — longest phrases first to avoid partial matches
  { t: /\bBonus Action\b/gi,    tip: 'Bonus Action: a special action you can take on your turn if a feature allows it. Only one per turn.' },
  { t: /\bAttack Roll\b/gi,     tip: 'Attack Roll: roll a d20 + ability modifier + proficiency bonus and compare to the target\'s AC.' },
  { t: /\bSpell Attack\b/gi,    tip: 'Spell Attack: an attack roll made as part of a spell; uses your Spellcasting Ability modifier + Proficiency Bonus.' },
  { t: /\bSaving Throw\b/gi,    tip: 'Saving Throw: roll a d20 + ability modifier to resist an effect. Meet or beat the DC to succeed.' },
  { t: /\bSpell Slot\b/gi,      tip: 'Spell Slot: a resource expended to cast a spell of 1st level or higher. Recovered on a Long Rest.' },
  { t: /\bProficiency Bonus\b/gi, tip: 'Proficiency Bonus: a bonus added to attack rolls, saving throws, and skill checks you\'re proficient in. Increases with character level.' },
  { t: /\bTemporary Hit Points\b/gi, tip: 'Temporary Hit Points: a buffer of HP that absorbs damage first. They don\'t stack; take the higher pool.' },
  { t: /\bHit Points\b/gi,      tip: 'Hit Points (HP): measure of a creature\'s durability. At 0 HP you fall unconscious and begin making Death Saving Throws.' },
  { t: /\bDifficult Terrain\b/gi, tip: 'Difficult Terrain: every foot of movement costs 1 extra foot of speed (2 ft of speed spent per foot moved).' },
  { t: /\bArmor Class\b/gi,     tip: 'Armor Class (AC): the number an attack roll must meet or beat to hit a creature.' },
  { t: /\bReaction\b/gi,        tip: 'Reaction: an instant response to a trigger. You get one per round and regain it at the start of your next turn.' },
  { t: /\bAction\b/gi,          tip: 'Action: the primary thing you do on your turn — attack, cast a spell, Dash, Disengage, Dodge, Help, Hide, etc.' },
  // Components
  { t: /\bVerbal\b/gi,          tip: 'Verbal (V): the spell requires speaking a specific mystic incantation. Silence prevents casting.' },
  { t: /\bSomatic\b/gi,         tip: 'Somatic (S): the spell requires a specific hand gesture. You need at least one free hand.' },
  { t: /\bMaterial\b/gi,        tip: 'Material (M): the spell requires a physical component. A spellcasting focus can replace components without a listed cost.' },
  // Duration / concentration
  { t: /\bConcentration\b/gi,   tip: 'Concentration: you maintain the spell\'s effect. Taking damage requires a Constitution saving throw (DC 10 or half the damage taken) or the spell ends.' },
  { t: /(?<![\w-])Instantaneous\b/gi,   tip: 'Instantaneous: the spell\'s effects happen at the moment of casting and cannot be dispelled.' },
  // Spell types
  { t: /\bCantrip\b/gi,         tip: 'Cantrip: a 0-level spell that can be cast at will without expending a Spell Slot. Damage scales with character level.' },
  { t: /\bRitual\b/gi,          tip: 'Ritual: can be cast without expending a Spell Slot if you add 10 minutes to the casting time. You must have it prepared or in your spellbook.' },
  { t: /\bSave\b/gi,            tip: 'Save: short for Saving Throw. Roll a d20 + ability modifier and meet or beat the caster\'s Spell Save DC.' },
  // Damage types
  { t: /\bNecrotic\b/gi,        tip: 'Necrotic damage: withering energy that rots flesh and bone. Undead and constructs are often immune.' },
  { t: /\bRadiant\b/gi,         tip: 'Radiant damage: searing holy light. Particularly effective against undead and fiends.' },
  { t: /\bPsychic\b/gi,         tip: 'Psychic damage: a mental assault that assails the mind. Few creatures have resistance to it.' },
  { t: /\bForce\b/gi,           tip: 'Force damage: pure magical energy. Almost nothing is immune or resistant to it.' },
  { t: /\bThunder\b/gi,         tip: 'Thunder damage: concussive sonic energy — a burst of sound or a shockwave.' },
  // Conditions
  { t: /\bFrightened\b/gi,      tip: 'Frightened: Disadvantage on Ability Checks and Attack Rolls while the source of fear is in line of sight. Can\'t willingly move closer to it.' },
  { t: /\bCharmed\b/gi,         tip: 'Charmed: can\'t attack the charmer or target it with harmful effects. The charmer has Advantage on social checks against the creature.' },
  { t: /\bParalyzed\b/gi,       tip: 'Paralyzed: Incapacitated and can\'t move or speak. Auto-fails Str and Dex saves. Attacks against it have Advantage and hits from within 5 ft. are critical hits.' },
  { t: /\bIncapacitated\b/gi,   tip: 'Incapacitated: can\'t take Actions or Reactions.' },
  { t: /\bRestrained\b/gi,      tip: 'Restrained: speed becomes 0. Attack rolls against it have Advantage; its own attack rolls have Disadvantage. Disadvantage on Dexterity saving throws.' },
  { t: /\bProne\b/gi,           tip: 'Prone: the creature is on the ground. Ranged attacks against it have Disadvantage; melee attacks have Advantage. Must spend half movement to stand up.' },
  { t: /\bBlinded\b/gi,         tip: 'Blinded: can\'t see, auto-fails checks that require sight. Attack rolls against it have Advantage; its attack rolls have Disadvantage.' },
  { t: /\bDeafened\b/gi,        tip: 'Deafened: can\'t hear, auto-fails checks that require hearing.' },
  { t: /\bPoisoned\b/gi,        tip: 'Poisoned: Disadvantage on Attack Rolls and Ability Checks.' },
  { t: /\bStunned\b/gi,         tip: 'Stunned: Incapacitated, can\'t move, and can only speak falteringly. Auto-fails Str and Dex saves. Attacks against it have Advantage.' },
  { t: /\bPetrified\b/gi,       tip: 'Petrified: transformed into solid stone; Incapacitated. Resistant to all damage, immune to poison and disease.' },
  { t: /\bGrappled\b/gi,        tip: 'Grappled: speed becomes 0. Ends if the grappler is Incapacitated or the creature is moved out of reach.' },
  // Advantage / Disadvantage
  { t: /\bAdvantage\b/gi,       tip: 'Advantage: roll two d20s and use the higher result.' },
  { t: /\bDisadvantage\b/gi,    tip: 'Disadvantage: roll two d20s and use the lower result.' },
  // ── Rust & herstel ──
  { t: /\bLong Rest\b/gi,       tip: 'Long Rest: at least 8 hours of rest. Regain all Hit Points, half your total Hit Dice, and reset most expended features and Spell Slots.' },
  { t: /\bShort Rest\b/gi,      tip: 'Short Rest: at least 1 hour of light activity. Spend Hit Dice to heal and recover features that recharge on a Short Rest.' },
  { t: /\bHeroic Inspiration\b/gi, tip: 'Heroic Inspiration: when you have it, you can reroll any one d20 and use either roll. You can hold only one at a time.' },
  { t: /\bHit Dice\b/gi,        tip: 'Hit Dice: dice (one per character level) spent during a Short Rest to regain Hit Points. You regain half your total on a Long Rest.' },
  { t: /\bHit Die\b/gi,         tip: 'Hit Die: the die used by your class for Hit Points (e.g. d8). Spend one during a Short Rest to heal.' },
  // ── Kernbegrippen die in features voorkomen ──
  { t: /\bAbility Score Improvement\b/gi, tip: 'Ability Score Improvement (ASI): increase one ability score by 2 or two scores by 1 (max 20), or take a feat instead.' },
  { t: /\bAbility Check\b/gi,   tip: 'Ability Check: a d20 + ability modifier (+ Proficiency Bonus if proficient) to overcome a challenge, set against a DC.' },
  { t: /\bAbility Score\b/gi,   tip: 'Ability Score: one of the six core stats (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma). Determines its modifier.' },
  { t: /\bSpellcasting Ability\b/gi, tip: 'Spellcasting Ability: the ability your class casts with (Int, Wis, or Cha). Sets your Spell Save DC and spell attack bonus.' },
  { t: /\bSpellcasting Focus\b/gi,   tip: 'Spellcasting Focus: an object (e.g. an arcane focus or holy symbol) used in place of material components that have no listed cost.' },
  { t: /\bSpell Save DC\b/gi,   tip: 'Spell Save DC: the number a target must meet or beat on a saving throw against your spell. 8 + Spellcasting modifier + Proficiency Bonus.' },
  { t: /\bDeath Saving Throw\b/gi, tip: 'Death Saving Throw: at 0 HP, roll a d20 at the start of your turns. Three successes stabilize; three failures mean death. 10+ succeeds.' },
  { t: /\bOpportunity Attack\b/gi, tip: 'Opportunity Attack: a Reaction to make one melee attack against a creature that leaves your reach without Disengaging.' },
  { t: /\bUnarmed Strike\b/gi,  tip: 'Unarmed Strike: use your body to Damage (1 + Str mod bludgeoning), Grapple, or Shove a creature within reach.' },
  { t: /\bInitiative\b/gi,      tip: 'Initiative: a Dexterity check at the start of combat that sets turn order, highest first.' },
  { t: /\bDarkvision\b/gi,      tip: 'Darkvision: within a set range you see in dim light as if bright, and in darkness as if dim (in shades of grey).' },
  { t: /\bExpertise\b/gi,       tip: 'Expertise: double your Proficiency Bonus on ability checks with the chosen skill (or tool).' },
  { t: /\bExhaustion\b/gi,      tip: 'Exhaustion: a condition with 6 levels. Each level gives −2 to d20 Tests and −5 ft speed (per level). Level 6 is death. A Long Rest removes one level.' },
  { t: /\bInvisible\b/gi,       tip: 'Invisible: can\'t be seen without special senses. Attacks against you have Disadvantage; your attacks have Advantage. You\'re Surprise-friendly but still make noise.' },
  { t: /\bUnconscious\b/gi,     tip: 'Unconscious: Incapacitated, can\'t move or speak, unaware of surroundings, drop what you hold and fall Prone. Attacks against you have Advantage; hits within 5 ft are critical.' },
  // ── Algemene martial-features ──
  { t: /\bExtra Attack\b/gi,    tip: 'Extra Attack: when you take the Attack action, you can attack twice (more at higher levels) instead of once.' },
  { t: /\bFighting Style\b/gi,  tip: 'Fighting Style: a feat that grants an ongoing combat benefit (e.g. Archery, Defense, Dueling, Great Weapon Fighting).' },
  { t: /\bWeapon Mastery\b/gi,  tip: 'Weapon Mastery (2024): use the special mastery property of weapons you know (Cleave, Push, Sap, Slow, Topple, Vex, etc.).' },
  { t: /\bUnarmored Defense\b/gi, tip: 'Unarmored Defense: while wearing no armor, your AC is 10 + Dexterity modifier + another ability modifier (Constitution for Barbarian, Wisdom for Monk).' },
  // ── Barbarian ──
  { t: /\bReckless Attack\b/gi, tip: 'Reckless Attack: gain Advantage on Strength-based melee attack rolls this turn, but attacks against you have Advantage until your next turn.' },
  { t: /\bRage\b/gi,            tip: 'Rage: a Bonus Action that grants Resistance to Bludgeoning/Piercing/Slashing damage, bonus melee damage, and Advantage on Strength checks & saves. Limited uses per Long Rest.' },
  // ── Bard ──
  { t: /\bBardic Inspiration\b/gi, tip: 'Bardic Inspiration: a Bonus Action giving an ally a die they can add to one d20 Test or damage roll. Uses equal your Charisma modifier, regained on a Long Rest (Short Rest at higher levels).' },
  // ── Cleric / Paladin ──
  { t: /\bChannel Divinity\b/gi, tip: 'Channel Divinity: channel divine energy to fuel magical effects (e.g. Turn Undead). Regained on a Short or Long Rest.' },
  { t: /\bTurn Undead\b/gi,     tip: 'Turn Undead: a Channel Divinity that forces nearby Undead to make a Wisdom save or flee from you for 1 minute.' },
  { t: /\bLay on Hands\b/gi,    tip: 'Lay on Hands: a pool of healing (5 × Paladin level) you can spend as a Bonus Action to restore HP or end one disease/poison. Refills on a Long Rest.' },
  { t: /\bDivine Smite\b/gi,    tip: 'Divine Smite: expend a Spell Slot when you hit with a melee weapon to deal extra Radiant damage (2d8, +1d8 per slot level above 1st; +1d8 vs Undead/Fiends).' },
  { t: /\bAura of Protection\b/gi, tip: 'Aura of Protection: you and allies within 10 ft add your Charisma modifier (min +1) to saving throws.' },
  // ── Druid ──
  { t: /\bWild Shape\b/gi,      tip: 'Wild Shape: a Bonus Action to transform into a Beast you know. Limited uses per Short/Long Rest; lasts a number of hours equal to half your Druid level.' },
  // ── Fighter ──
  { t: /\bSecond Wind\b/gi,     tip: 'Second Wind: a Bonus Action to regain 1d10 + Fighter level HP. Limited uses, regained on a Short or Long Rest.' },
  { t: /\bAction Surge\b/gi,    tip: 'Action Surge: take one additional action on your turn. Once (twice at high level) per Short or Long Rest.' },
  { t: /\bIndomitable\b/gi,     tip: 'Indomitable: reroll a failed saving throw, taking the new result. Limited uses per Long Rest.' },
  // ── Monk ──
  { t: /\bMartial Arts\b/gi,    tip: 'Martial Arts: use Dexterity for unarmed strikes and Monk weapons, roll the Martial Arts die for their damage, and make an unarmed strike as a Bonus Action.' },
  { t: /\bFocus Points\b/gi,    tip: 'Focus Points (2024, formerly Ki): a pool fueling Flurry of Blows, Patient Defense, Step of the Wind, etc. Regained on a Short or Long Rest.' },
  { t: /\bFlurry of Blows\b/gi, tip: 'Flurry of Blows: spend 1 Focus Point to make two unarmed strikes as a Bonus Action.' },
  { t: /\bPatient Defense\b/gi, tip: 'Patient Defense: take the Disengage action as a Bonus Action (free), or spend 1 Focus Point to also Dodge.' },
  { t: /\bStep of the Wind\b/gi, tip: 'Step of the Wind: take Disengage or Dash as a Bonus Action (free), or spend 1 Focus Point to do both and jump farther.' },
  { t: /\bStunning Strike\b/gi, tip: 'Stunning Strike: spend 1 Focus Point on a hit to force a Constitution save or Stun the target until the end of your next turn.' },
  { t: /\bUnarmored Movement\b/gi, tip: 'Unarmored Movement: bonus speed while unarmored and not using a shield; later lets you move along walls and across liquids.' },
  // ── Rogue ──
  { t: /\bSneak Attack\b/gi,    tip: 'Sneak Attack: once per turn, deal extra damage when you have Advantage (or an ally is adjacent to the target) and use a Finesse or ranged weapon.' },
  { t: /\bCunning Action\b/gi,  tip: 'Cunning Action: a Bonus Action each turn to Dash, Disengage, or Hide.' },
  { t: /\bUncanny Dodge\b/gi,   tip: 'Uncanny Dodge: use your Reaction to halve the damage of one attack that hits you.' },
  { t: /\bEvasion\b/gi,         tip: 'Evasion: on a Dexterity save for half damage, take no damage on a success and half on a failure.' },
  // ── Sorcerer ──
  { t: /\bSorcery Points\b/gi,  tip: 'Sorcery Points: a resource fueling Metamagic; convert to/from Spell Slots via Font of Magic. Regained on a Long Rest.' },
  { t: /\bMetamagic\b/gi,       tip: 'Metamagic: spend Sorcery Points to bend your spells (e.g. Twinned, Quickened, Subtle, Distant).' },
  { t: /\bFont of Magic\b/gi,   tip: 'Font of Magic: convert Sorcery Points into Spell Slots, or Spell Slots into Sorcery Points.' },
  // ── Warlock ──
  { t: /\bEldritch Invocations\b/gi, tip: 'Eldritch Invocations: special abilities (passive or active) you learn and can swap on level-up; some have prerequisites.' },
  { t: /\bPact Magic\b/gi,      tip: 'Pact Magic: the Warlock\'s casting — few but high-level Spell Slots that all recharge on a Short or Long Rest.' },
  { t: /\bMystic Arcanum\b/gi,  tip: 'Mystic Arcanum: a high-level spell (6th–9th) you can cast once without a Spell Slot, regained on a Long Rest.' },
  // ── Wizard ──
  { t: /\bArcane Recovery\b/gi, tip: 'Arcane Recovery: once per day on a Short Rest, recover expended Spell Slots with a combined level up to half your Wizard level.' },
  { t: /\bHunter's Mark\b/gi,   tip: 'Hunter\'s Mark: a spell marking a target for bonus damage on your weapon hits; moves to a new target when the original drops.' },
];

// Maak alle termen meervoud-tolerant: een afsluitende \b wordt s?\b zodat
// "Spell Slots", "Cantrips", "Saving Throws" enz. ook matchen.
for (const _e of _SB_GLOSSARY) {
  const src = _e.t.source;
  if (src.endsWith('\\b')) _e.t = new RegExp(src.slice(0, -2) + 's?\\b', _e.t.flags);
}

// Walk a live DOM node and wrap glossary terms in tooltip spans.
// `seen` ontdubbelt: elke term krijgt per beschrijving maar één uitleg.
function _sbApplyGlossary_DOM(rootEl) {
  if (!rootEl) return;
  _sbGlossWalk(rootEl, new Set());
}

// Highlight-spans (dice, damage-type, save, range) zijn al visueel gemarkeerd —
// daarbinnen geen lexicon-uitleg toevoegen (voorkomt dubbele onderstreping en
// een verkeerde/overbodige tooltip, bv. "saving throw" in "Wisdom saving throw").
const _GLOSS_SKIP = ['sb-gloss', 'sb-hl-dice', 'sb-hl-dmg', 'sb-hl-save', 'sb-hl-range'];

function _sbGlossWalk(node, seen) {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent;
    // Find the earliest matching term; bij gelijke startpositie wint de langste
    // match (zodat bijv. "Action Surge" niet als "Action" wordt gewrapt).
    let best = null, bestIdx = Infinity, bestLen = 0;
    for (const entry of _SB_GLOSSARY) {
      if (seen.has(entry)) continue;          // deze term is al uitgelegd
      entry.t.lastIndex = 0;
      const m = entry.t.exec(text);
      if (m && (m.index < bestIdx || (m.index === bestIdx && m[0].length > bestLen))) {
        best = { entry, match: m }; bestIdx = m.index; bestLen = m[0].length;
      }
    }
    if (!best) return;
    const { entry, match } = best;
    seen.add(entry);                          // ontdubbelen: niet nog eens uitleggen
    const before = text.slice(0, match.index);
    const after  = text.slice(match.index + match[0].length);
    const span = document.createElement('span');
    span.className = 'sb-gloss';
    span.setAttribute('data-tip', entry.tip);
    span.textContent = match[0];
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    node.parentNode.replaceChild(frag, node);
    // Recurse on the after-text node (new text node is last child of frag in parent)
    const afterNode = span.nextSibling;
    if (afterNode) _sbGlossWalk(afterNode, seen);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip elements that are themselves glossary spans, dice links, highlights of headings
    if (_GLOSS_SKIP.some(c => node.classList.contains(c))) return;
    // Iterate over a static copy since we'll be mutating childNodes
    for (const child of Array.from(node.childNodes)) _sbGlossWalk(child, seen);
  }
}

// ── Globale glossary-tooltip ──────────────────────────────────────
// Werkt voor elke .sb-gloss-span overal in het document (spreukenboek,
// feature-detailmodal, voorwerp-detail, …). Eén gedeeld zwevend tip-element.
let _glossTipEl = null;
function _glossTipGet() {
  _glossTipEl = document.getElementById('sb-gloss-tip');
  if (!_glossTipEl) {
    _glossTipEl = document.createElement('div');
    _glossTipEl.id = 'sb-gloss-tip';
    document.body.appendChild(_glossTipEl);
  }
  return _glossTipEl;
}
function _glossTipShow(g) {
  const tip = _glossTipGet();
  tip.textContent = g.getAttribute('data-tip');
  tip.classList.add('visible');
  const margin = 8, vw = window.innerWidth;
  tip.style.maxWidth = Math.min(240, vw - margin * 2) + 'px';
  tip.style.left = '0'; tip.style.top = '0';
  const r = g.getBoundingClientRect();
  const tipH = tip.offsetHeight;
  let x = r.left + r.width / 2 - tip.offsetWidth / 2;
  let y = r.top - tipH - 8;
  x = Math.max(margin, Math.min(x, vw - tip.offsetWidth - margin));
  if (y < margin) y = r.bottom + 8;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
function _glossTipHide() { document.getElementById('sb-gloss-tip')?.classList.remove('visible'); }

let _glossGlobalInit = false;
function _initGlobalGlossary() {
  if (_glossGlobalInit) return;
  _glossGlobalInit = true;
  document.addEventListener('mouseenter', e => {
    const t = e.target;
    const g = t?.nodeType === 1 ? t.closest('.sb-gloss') : null;
    if (g) _glossTipShow(g);
  }, true);
  document.addEventListener('mouseleave', e => {
    const t = e.target;
    if (t?.nodeType === 1 && t.closest('.sb-gloss')) _glossTipHide();
  }, true);
  document.addEventListener('click', e => {
    const g = e.target?.nodeType === 1 ? e.target.closest('.sb-gloss') : null;
    if (g) {
      e.stopPropagation();
      const tip = _glossTipGet();
      const same = tip.classList.contains('visible') && tip.textContent === g.getAttribute('data-tip');
      if (same) _glossTipHide(); else _glossTipShow(g);
    } else {
      _glossTipHide();
    }
  }, true);
  document.addEventListener('scroll', _glossTipHide, true);
}

// Publieke glossary-API — gebruikt door render-progressie.js e.a.
window.glossary = {
  ready: true,
  applyDom: (rootEl) => { _initGlobalGlossary(); _sbApplyGlossary_DOM(rootEl); },
  // String → string: wrap glossary-termen in al-gerenderde HTML. Gebruikt door
  // voorwerp-beschrijvingen en het speler-spreukpaneel (mdToHtml-output).
  annotate: (html) => {
    if (!html) return html;
    _initGlobalGlossary();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    _sbApplyGlossary_DOM(tmp);
    return tmp.innerHTML;
  },
};

// Dutch translations for common D&D metadata values
function _sbNl(s) {
  if (!s) return s;
  return String(s)
    .replace(/\bInstantaneous\b/gi, 'Onmiddellijk')
    .replace(/\bConcentration,\s*/gi, 'Concentratie, ')
    .replace(/\bConcentration\b/gi, 'Concentratie')
    .replace(/\bup to\b/gi, 'tot')
    .replace(/\b1 action\b/gi, '1 actie')
    .replace(/\b1 bonus action\b/gi, '1 bonusactie')
    .replace(/\b1 reaction\b/gi, '1 reactie')
    .replace(/\bTouch\b/gi, 'Aanraking')
    .replace(/\bSelf\b/gi, 'Zichzelf')
    .replace(/\bSpecial\b/gi, 'Speciaal')
    .replace(/\bUntil dispelled\b/gi, 'Tot verwijdering')
    .replace(/\b1 minute\b/gi, '1 minuut')
    .replace(/\b(\d+) minutes\b/gi, (_, n) => `${n} minuten`)
    .replace(/\b1 hour\b/gi, '1 uur')
    .replace(/\b(\d+) hours\b/gi, (_, n) => `${n} uur`)
    .replace(/\b1 round\b/gi, '1 ronde')
    .replace(/\b(\d+) rounds\b/gi, (_, n) => `${n} rondes`)
    .replace(/\b1 day\b/gi, '1 dag')
    .replace(/\bVSM\b/g, 'V, S, M')
    .trim();
}

function _sbSchoolKey(school) {
  if (!school) return null;
  const s = typeof school === 'object' ? (school.name || '') : school;
  return s.toLowerCase().replace(/[\s-]/g, '');
}

function _sbSchoolLabel(school) {
  if (!school) return '';
  return school.charAt(0).toUpperCase() + school.slice(1).toLowerCase();
}

function _sbRibbonMiniSvg() {
  return `<svg width="9" height="14" viewBox="0 0 9 14"><path d="M0 0 H9 V11 L4.5 14 L0 11 Z" fill="#c82020"/></svg>`;
}

function _ensureSpellbookOverlay() {
  if (document.getElementById('sb-overlay')) return;
  const el = document.createElement('div');
  el.id = 'sb-overlay';
  el.className = 'sb-overlay';
  el.innerHTML = `
    <!-- Overlay controls row (above book) -->
    <div class="sb-overlay-controls">
      <button class="sb-ctrl-btn" id="sb-toc-btn" onclick="window._sbToggleToc()">
        ${icon('clipboard-list')} Inhoud
      </button>
      <button class="sb-ctrl-btn" id="sb-manage-btn" onclick="window._sbToggleManage()" title="Beheer">
        ${icon('pencil')} Beheer
      </button>
      <button class="sb-ctrl-btn sb-ctrl-conc" id="sb-conc-ctrl-btn" onclick="window._sbToggleConcentration()" title="Concentratie" style="display:none">
        🕯 Concentratie
      </button>
      <div class="sb-prepared-zone" id="sb-prepared-zone"></div>
      <button class="sb-ctrl-btn sb-ctrl-help" id="sb-help-btn" onclick="window._sbToggleHelp()" title="Help">
        ${icon('book-open')} Help
      </button>
      <button class="sb-ctrl-btn sb-ctrl-close" onclick="window._sbCloseAndReturn()" title="Sluit spreukenboek">
        ✕ Sluit spreukenboek
      </button>
    </div>
    <div class="sb-book" id="sb-book">
      <!-- Left page: school gradient + incantation + icon/image + slots -->
      <div class="sb-page-left" id="sb-page-left">
        <!-- Incantation verse at top -->
        <div class="sb-left-incantation" id="sb-left-incantation"></div>
        <!-- Uploaded image (hidden until one exists) -->
        <img class="sb-left-img" id="sb-left-img" style="display:none" alt="">
        <!-- School icon, center -->
        <div class="sb-left-icon" id="sb-left-icon"></div>
        <!-- Spell slot pips (level ≥ 1) -->
        <div class="sb-slot-zone" id="sb-slot-zone"></div>
        <!-- School + Level labels -->
        <div class="sb-left-school" id="sb-left-school"></div>
        <div class="sb-left-level"  id="sb-left-level"></div>
        <!-- Wax seal (bottom-left, school-themed) -->
        <div class="sb-wax-seal" id="sb-wax-seal"></div>
        <!-- Spell stats: Save DC + Attack Bonus (bottom-right) -->
        <div class="sb-spell-stats" id="sb-spell-stats"></div>
        <!-- Afbeelding kiezen uit bibliotheek of uploaden — DM only -->
        ${app.isDM() ? `
        <button class="sb-img-btn" onclick="window._sbPickImage()" title="Afbeelding kiezen of uploaden">
          ${icon('camera')}
        </button>` : ''}
      </div>
      <!-- Right page: parchment -->
      <div class="sb-page-right" id="sb-page-right">
        <!-- Red ribbon bookmark -->
        <div class="sb-ribbon" id="sb-ribbon" onclick="window._sbTogglePin()" title="Vastpinnen">
          <svg width="32" height="62" viewBox="0 0 32 62" fill="none">
            <path id="sb-ribbon-shape" d="M0 0 H32 V52 L16 62 L0 52 Z" fill="rgba(0,0,0,0.18)"/>
            <path d="M0 0 H32 V52 L16 62 L0 52 Z" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
          </svg>
        </div>
        <!-- Marginalia icons — right spine edge -->
        <div class="sb-marginalia" id="sb-marginalia"></div>
        <!-- Concentration fold corner -->
        <div class="sb-conc-fold sb-conc-fold--hidden" id="sb-conc-fold"></div>
        <!-- No-slots-available fade overlay -->
        <div class="sb-spell-fade" id="sb-spell-fade" style="display:none"></div>
        <!-- Niet-voorbereid stempel -->
        <div class="sb-spell-unprep" id="sb-spell-unprep" style="display:none">Niet voorbereid</div>
        <div class="sb-right-content" id="sb-right-content"></div>
      </div>
      <!-- Book spine — raised leather binding at the centre -->
      <div class="sb-spine" aria-hidden="true">
        <div class="sb-spine-band"></div>
        <div class="sb-spine-band"></div>
      </div>
      <!-- Floating navigation arrows -->
      <button class="sb-arrow-btn sb-arrow-btn--prev" onclick="window._sbPrev()" title="Previous spell">
        ${icon('chevron-left')}
      </button>
      <button class="sb-arrow-btn sb-arrow-btn--next" onclick="window._sbNext()" title="Next spell">
        ${icon('chevron-right')}
      </button>
      <!-- Mobile portrait rotation hint -->
      <div class="sb-portrait-hint">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sb-portrait-hint-icon"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        <span>Draai je scherm voor het spreukenboek</span>
      </div>
      <!-- TOC panel: slides from left -->
      <div class="sb-toc-panel" id="sb-toc-panel">
        <div class="sb-toc-header">
          <div class="sb-toc-title-row">
            <div class="sb-toc-title">Inhoudsopgave</div>
            <button class="sb-toc-prep-filter" id="sb-toc-prep-filter" onclick="window._sbTocTogglePreparedOnly()"
              title="Toon alleen voorbereide spreuken">${icon('check')} Alleen paraat</button>
          </div>
          <input type="text" class="sb-toc-search" id="sb-toc-search"
            placeholder="Zoek spreuk…" oninput="window._sbTocSearch(this.value)">
        </div>
        <div class="sb-toc-list" id="sb-toc-list"></div>
      </div>
      <!-- Beheer panel: slides from right -->
      <div class="sb-manage-panel" id="sb-manage-panel">
        <div class="sb-manage-header">
          <div class="sb-manage-title">Beheer</div>
          <button class="sb-manage-close-btn" onclick="window._sbToggleManage()" title="Sluit beheer">✕</button>
        </div>
        <div class="sb-manage-body">
          <div class="sb-manage-section">
            <div class="sb-manage-label">Incantatie</div>
            <textarea class="sb-manage-input sb-manage-input--quill sb-manage-textarea" id="sb-manage-incant"
              rows="2" placeholder="Eigen incantatie…" maxlength="200"
              onblur="window._sbSaveIncantation(this.value)"></textarea>
          </div>
          <div class="sb-manage-section">
            <div class="sb-manage-label">Op welk level verkregen</div>
            <div class="sb-manage-row">
              <input type="number" class="sb-manage-input sb-manage-input--sm" id="sb-manage-acqlevel"
                min="1" max="20" placeholder="1–20"
                onblur="window._sbSaveAcqLevel(+this.value)">
              <span class="sb-manage-hint">Lager = geler papier</span>
            </div>
          </div>
          <div class="sb-manage-section" id="sb-manage-conc-section" style="display:none">
            <div class="sb-manage-label">Concentratie</div>
            <button class="sb-manage-conc-btn" id="sb-manage-conc-btn"
              onclick="window._sbToggleConcentration()">🕯 Inactief</button>
          </div>
          <div class="sb-manage-section">
            <div class="sb-manage-label">Marginalia</div>
            <div id="sb-manage-marginalia-list"></div>
            <div class="sb-manage-icon-picker" id="sb-manage-icon-picker"></div>
            <textarea class="sb-manage-input sb-manage-input--quill sb-manage-textarea" id="sb-manage-icon-label"
              rows="2" placeholder="Eigen toelichting…" maxlength="200" style="margin-top:6px"></textarea>
            <button class="sb-manage-add-btn" onclick="window._sbAddMarginalia()">＋ Toevoegen</button>
          </div>
        </div>
      </div>
      <!-- Help panel: slides from right -->
      <div class="sb-help-panel" id="sb-help-panel">
        <div class="sb-manage-header">
          <div class="sb-manage-title">${icon('book-open')} Help</div>
          <button class="sb-manage-close-btn" onclick="window._sbToggleHelp()" title="Sluit help">✕</button>
        </div>
        <div class="sb-help-body">
          <div class="sb-help-section">
            <div class="sb-help-section-title">${icon('clipboard-list')} Inhoud</div>
            <p>Hier vind je een overzicht van al je spreuken per level. Je kunt ook zoeken: typ een naam of school en klik <strong>+</strong> om een spreuk toe te voegen aan je boek.</p>
            <p>Spreuken die je al hebt staan bovenaan onder <em>Jouw spreuken</em> — klik op de naam om er direct naartoe te gaan.</p>
          </div>
          <div class="sb-help-section">
            <div class="sb-help-section-title">${icon('pencil')} Beheer</div>
            <p><strong>Incantatie</strong> — schrijf de spreukformule die jij uitspreekt. Verschijnt als een briefje op de linkerpagina.</p>
            <p><strong>Level verkregen</strong> — op welk level heb je deze spreuk geleerd? Puur ter herinnering.</p>
            <p><strong>Concentratie</strong> — activeer/deactiveer de concentratie-tracker voor een actieve spreuk.</p>
            <p><strong>Marginalia</strong> — kleine symbolen in de kantlijn die het type spreuk aangeven (schade, healing, utility…). Kies een icoon, typ optioneel een toelichting en klik +.</p>
          </div>
          <div class="sb-help-section">
            <div class="sb-help-section-title">${icon('chevron-left')} Navigatie</div>
            <p>Gebruik de pijlen links en rechts om door je spreuken te bladeren. Je kunt ook klikken op een spreuk in de Inhoud.</p>
            <p>Het gouden lint in het boek geeft aan of een spreuk als favoriet is gemarkeerd (klik op het lint).</p>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  // Prevent scroll-through to the page behind while the overlay is open
  el.addEventListener('wheel',     e => { if (!e.target.closest('.sb-right-content, .sb-toc-list, .sb-manage-panel')) e.preventDefault(); }, { passive: false });
  el.addEventListener('touchmove', e => { if (!e.target.closest('.sb-right-content, .sb-toc-list, .sb-manage-panel')) e.preventDefault(); }, { passive: false });
  el.addEventListener('click', e => { if (e.target === el) window._closeSpellbook(); });
  // Click on inline dice notation → flash-roll it
  el.addEventListener('click', e => {
    const dice = e.target.closest('.sb-hl-dice');
    if (dice) {
      e.stopPropagation();
      const spell = _sbState.spells[_sbState.idx];
      window._sbFlashRoll(dice.textContent.trim(), spell?.name || '');
    }
  });
  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!document.getElementById('sb-overlay')?.classList.contains('sb-open')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); window._sbNext(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); window._sbPrev(); }
    if (e.key === 'Escape') window._closeSpellbook();
  });
}

window._openSpellbook = function(startIdx) {
  _ensureSpellbookOverlay();
  // Restore last open spell from localStorage if no explicit index given
  if (startIdx === undefined && _sbState.charId) {
    const saved = localStorage.getItem(`_sbLastSpell_${_sbState.charId}`);
    if (saved) {
      const found = _sbState.spells.findIndex(s => s.index === saved);
      if (found >= 0) startIdx = found;
    }
  }
  if (startIdx === undefined) startIdx = 0;
  _sbState.idx    = Math.max(0, Math.min(startIdx, _sbState.spells.length - 1));
  _sbState.tocOpen = false;
  _sbRender();
  const ov = document.getElementById('sb-overlay');
  ov.style.display = '';          // undo any post-close display:none
  ov.classList.remove('sb-open');
  // Cancel any previous open-animation rAF, then schedule a fresh one
  if (_sbOpenRafId) { cancelAnimationFrame(_sbOpenRafId); _sbOpenRafId = null; }
  _sbOpenRafId = requestAnimationFrame(() => { ov.classList.add('sb-open'); _sbOpenRafId = null; });
  // Close TOC if it was open
  const toc = document.getElementById('sb-toc-panel');
  if (toc) toc.classList.remove('sb-toc-open');
};

window._closeSpellbook = function() {
  // Cancel any pending open-animation rAF so it can't re-open after we close
  if (_sbOpenRafId) { cancelAnimationFrame(_sbOpenRafId); _sbOpenRafId = null; }
  const ov = document.getElementById('sb-overlay');
  if (ov) {
    ov.classList.remove('sb-open');
    // After the CSS fade-out transition (0.3s), hide completely so it can't
    // interfere with scroll or pointer events on the page behind it.
    const _ref = ov;
    setTimeout(() => { if (!_ref.classList.contains('sb-open')) _ref.style.display = 'none'; }, 350);
  }
  _sbState.tocOpen = false;
  _sbState.manageOpen = false;
  const mp = document.getElementById('sb-manage-panel');
  if (mp) mp.classList.remove('sb-manage-open');
  window._sbUserClosed = true;  // don't auto-reopen until user explicitly navigates back
};

window._sbGoTo = function(idx, closeToc) {
  const n = _sbState.spells.length;
  const newIdx = ((idx % n) + n) % n;
  if (closeToc) {
    _sbState.tocOpen = false;
    const toc = document.getElementById('sb-toc-panel');
    if (toc) toc.classList.remove('sb-toc-open');
  }
  if (newIdx === _sbState.idx) return;
  if (_sbFlipping) return;

  const book  = document.getElementById('sb-book');
  const leftP = document.getElementById('sb-page-left');
  const rightP = document.getElementById('sb-page-right');
  if (!book || !leftP || !rightP) { _sbState.idx = newIdx; _sbRender(); return; }

  _sbFlipping = true;

  // Phase 1 — dissolve out: blur + fade (190ms); no transform to avoid directional slide
  const tOut = 'opacity 0.19s ease-in, filter 0.19s ease-in';
  leftP.style.transition = rightP.style.transition = tOut;
  leftP.style.opacity  = rightP.style.opacity  = '0';
  leftP.style.filter   = 'blur(6px) brightness(1.6)';
  rightP.style.filter  = 'blur(5px) brightness(1.3)';

  setTimeout(() => {
    // Swap content while invisible
    _sbState.idx = newIdx;
    _sbRender();

    // Magical shimmer flash from the spine outward
    book.classList.add('sb-magic-flash');

    // Phase 2 — materialise: fade in with a brief glow that settles (340ms)
    const tIn = 'opacity 0.34s ease-out, filter 0.34s ease-out';
    leftP.style.transition = rightP.style.transition = tIn;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      leftP.style.opacity   = rightP.style.opacity   = '1';
      leftP.style.filter    = 'brightness(1.28)';
      rightP.style.filter   = 'brightness(1.12) sepia(0.08)';

      // Let glow settle, then clear everything
      setTimeout(() => {
        leftP.style.filter = rightP.style.filter = '';
        leftP.style.transition = rightP.style.transition = '';
        book.classList.remove('sb-magic-flash');
        _sbFlipping = false;
      }, 340);
    }));
  }, 190);
};

window._sbPrev = function() {
  const n = _sbState.spells.length;
  if (!n) return;
  _sbState.castSlotLevel = null;
  window._sbGoTo((_sbState.idx - 1 + n) % n);
};
window._sbNext = function() {
  const n = _sbState.spells.length;
  if (!n) return;
  _sbState.castSlotLevel = null;
  window._sbGoTo((_sbState.idx + 1) % n);
};

// Flashy dice roll overlay
window._sbFlashRoll = function(formula, spellName) {
  const m = formula.match(/(\d*)d(\d+)([+-]\d+)?/i);
  if (!m) return;
  const num = parseInt(m[1]) || 1, die = parseInt(m[2]), mod = m[3] ? parseInt(m[3]) : 0;
  let total = mod;
  for (let i = 0; i < num; i++) total += Math.floor(Math.random() * die) + 1;

  let el = document.getElementById('sb-dice-flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-dice-flash';
    el.className = 'sb-dice-flash';
    el.innerHTML = `<div class="sb-dice-card" id="sb-dice-card">
      <div class="sb-dice-spell" id="sb-dice-spell"></div>
      <div class="sb-dice-formula" id="sb-dice-formula2"></div>
      <div class="sb-dice-result" id="sb-dice-result">—</div>
      <div class="sb-dice-hint">tik om te sluiten</div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', () => el.classList.remove('active'));
  }
  document.getElementById('sb-dice-spell').textContent = spellName;
  document.getElementById('sb-dice-formula2').textContent = formula;
  const resEl = document.getElementById('sb-dice-result');
  resEl.textContent = '—';

  el.classList.add('active');
  _sbAudio.dice();

  // Rolling animation — random numbers cycling then settle
  let ticks = 0;
  const interval = setInterval(() => {
    let fake = mod;
    for (let i = 0; i < num; i++) fake += Math.floor(Math.random() * die) + 1;
    resEl.textContent = fake;
    resEl.classList.toggle('rolling', ticks % 2 === 0);
    if (++ticks >= 14) {
      clearInterval(interval);
      resEl.textContent = total;
      resEl.classList.remove('rolling');
      resEl.classList.add('settled');
      setTimeout(() => resEl.classList.remove('settled'), 400);
      // Highlight matching table row (if any table has numeric first column)
      const content = document.getElementById('sb-right-content');
      if (content) {
        content.querySelectorAll('tr.sb-table-row-lit').forEach(r => r.classList.remove('sb-table-row-lit'));
        for (const row of content.querySelectorAll('tr[data-num]')) {
          if (_sbMatchesRoll(row.dataset.num, total)) {
            row.classList.add('sb-table-row-lit');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            setTimeout(() => row.classList.remove('sb-table-row-lit'), 9000);
            break;
          }
        }
      }
    }
  }, 45);

  // Auto-dismiss
  clearTimeout(el._dismissTimer);
  el._dismissTimer = setTimeout(() => el.classList.remove('active'), 3800);
};

window._sbTogglePin = async function() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId) return;
  const index = spell.index;
  let favArr = [..._sbState.favs];
  if (_sbState.favs.has(index)) favArr = favArr.filter(f => f !== index);
  else favArr.push(index);
  _sbState.favs = new Set(favArr);
  _sbRenderRibbon();
  _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');
  try { await window._saveProfileField('spellFavorites', JSON.stringify(favArr)); }
  catch (e) { console.error('Fout bij opslaan favorieten:', e); }
};

window._sbToggleToc = function() {
  _sbState.tocOpen = !_sbState.tocOpen;
  // Sluit manage paneel als TOC opent
  if (_sbState.tocOpen) {
    _sbState.manageOpen = false;
    const mp = document.getElementById('sb-manage-panel');
    if (mp) mp.classList.remove('sb-manage-open');
  }
  const toc = document.getElementById('sb-toc-panel');
  if (toc) toc.classList.toggle('sb-toc-open', _sbState.tocOpen);
  if (_sbState.tocOpen) {
    const inp = document.getElementById('sb-toc-search');
    if (inp) inp.value = '';
    _sbRenderTocList('');
    setTimeout(() => document.getElementById('sb-toc-search')?.focus(), 50);
  }
};

window._sbToggleManage = function() {
  _sbState.manageOpen = !_sbState.manageOpen;
  if (_sbState.manageOpen) {
    _sbState.tocOpen = false;
    _sbState.helpOpen = false;
    document.getElementById('sb-toc-panel')?.classList.remove('sb-toc-open');
    document.getElementById('sb-help-panel')?.classList.remove('sb-manage-open');
  }
  const mp = document.getElementById('sb-manage-panel');
  if (mp) mp.classList.toggle('sb-manage-open', _sbState.manageOpen);
  if (_sbState.manageOpen) _sbManageRefresh();
};

window._sbToggleHelp = function() {
  _sbState.helpOpen = !_sbState.helpOpen;
  if (_sbState.helpOpen) {
    _sbState.tocOpen = false;
    _sbState.manageOpen = false;
    document.getElementById('sb-toc-panel')?.classList.remove('sb-toc-open');
    document.getElementById('sb-manage-panel')?.classList.remove('sb-manage-open');
  }
  document.getElementById('sb-help-panel')?.classList.toggle('sb-manage-open', _sbState.helpOpen);
  document.getElementById('sb-help-btn')?.classList.toggle('active', _sbState.helpOpen);
};

window._sbCloseAndReturn = function() {
  window._closeSpellbook();
  if (typeof window._setPlayerSubTab === 'function') {
    window._setPlayerSubTab('personage');
  }
};

window._sbSaveIncantation = async function(text) {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId) return;
  const trimmed = text.trim();
  if (trimmed === (spell.incantation || '')) return;
  spell.incantation = trimmed;
  _sbAudio.write();
  try {
    await api.updatePlayerSpell(_sbState.charId, spell.index, { incantation: trimmed });
    _sbRender();
  } catch(e) { console.warn('Incantatie opslaan mislukt:', e); }
};

// ── Beheer panel refresh: populate all fields from current spell ──
function _sbManageRefresh() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell) return;
  const active = el => document.activeElement !== el;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && active(el)) el.value = v; };
  setVal('sb-manage-incant', spell.incantation || '');
  setVal('sb-manage-acqlevel', spell.acquisitionLevel || '');
  // Concentration section
  const concSec = document.getElementById('sb-manage-conc-section');
  const concBtn = document.getElementById('sb-manage-conc-btn');
  if (concSec) concSec.style.display = spell.concentration ? '' : 'none';
  if (concBtn) {
    const on = !!spell.concentrationActive;
    concBtn.textContent = on ? '🕯 Actief — klik om te stoppen' : '🕯 Inactief — klik om te activeren';
    concBtn.classList.toggle('sb-manage-conc-btn--active', on);
  }
  // Marginalia list
  _sbRenderManageMarginalia();
  // Icon picker (only build once)
  const picker = document.getElementById('sb-manage-icon-picker');
  if (picker && !picker.dataset.built) {
    picker.dataset.built = '1';
    picker.innerHTML = Object.keys(_SB_ICONS).map(key =>
      `<button class="sb-icon-pick-btn" data-icon="${key}" onclick="window._sbSelectManageIcon('${key}')"
        title="${_SB_ICON_LABELS[key]}">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          ${_SB_ICONS[key]}
        </svg>
      </button>`
    ).join('');
  }
}

function _sbRenderManageMarginalia() {
  const spell = _sbState.spells[_sbState.idx];
  const el = document.getElementById('sb-manage-marginalia-list');
  if (!el) return;
  const items = spell?.marginalia || [];
  el.innerHTML = items.length ? items.map((m, i) => `
    <div class="sb-manage-marginal-row">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" class="sb-manage-marginal-icon">
        ${_SB_ICONS[m.icon] || ''}
      </svg>
      <span class="sb-manage-marginal-label">${esc(m.label || _SB_ICON_LABELS[m.icon] || m.icon)}</span>
      <button class="sb-manage-marginal-del" onclick="window._sbRemoveMarginalia(${i})">×</button>
    </div>`).join('') : '<p class="sb-manage-hint">Nog geen marginalia toegevoegd.</p>';
}

window._sbSelectManageIcon = function(key) {
  document.querySelectorAll('.sb-icon-pick-btn').forEach(b => b.classList.toggle('selected', b.dataset.icon === key));
  document.getElementById('sb-manage-icon-label').dataset.icon = key;
  const labelEl = document.getElementById('sb-manage-icon-label');
  if (labelEl && !labelEl.value) labelEl.placeholder = _SB_ICON_LABELS[key] || key;
};

window._sbAddMarginalia = async function() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId) return;
  const labelEl = document.getElementById('sb-manage-icon-label');
  const icon = labelEl?.dataset.icon;
  if (!icon) { labelEl?.focus(); return; }
  const label = (labelEl?.value || _SB_ICON_LABELS[icon] || icon).trim();
  spell.marginalia = [...(spell.marginalia || []), { icon, label }];
  _sbAudio.write();
  try {
    await api.updatePlayerSpell(_sbState.charId, spell.index, { marginalia: spell.marginalia });
    if (labelEl) { labelEl.value = ''; delete labelEl.dataset.icon; }
    document.querySelectorAll('.sb-icon-pick-btn').forEach(b => b.classList.remove('selected'));
    _sbRender();
  } catch(e) { console.warn('Marginalia opslaan mislukt:', e); }
};

window._sbRemoveMarginalia = async function(idx) {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId) return;
  spell.marginalia = (spell.marginalia || []).filter((_, i) => i !== idx);
  try {
    await api.updatePlayerSpell(_sbState.charId, spell.index, { marginalia: spell.marginalia });
    _sbRender();
  } catch(e) { console.warn('Marginalia verwijderen mislukt:', e); }
};

window._sbSaveAcqLevel = async function(val) {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId || !val || val < 1 || val > 20) return;
  if (val === (spell.acquisitionLevel || 0)) return;
  spell.acquisitionLevel = val;
  try {
    await api.updatePlayerSpell(_sbState.charId, spell.index, { acquisitionLevel: val });
    _sbRender();
  } catch(e) { console.warn('Level opslaan mislukt:', e); }
};

window._sbToggleConcentration = async function() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || !_sbState.charId || !spell.concentration) return;
  spell.concentrationActive = !spell.concentrationActive;
  try {
    await api.updatePlayerSpell(_sbState.charId, spell.index, { concentrationActive: spell.concentrationActive });
    _sbRender();
  } catch(e) { console.warn('Concentratie opslaan mislukt:', e); }
};

window._sbSlotChange = function(delta) {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || spell.level === 0) return;
  const cur  = _sbState.castSlotLevel ?? spell.level;
  const next = Math.max(spell.level, Math.min(9, cur + delta));
  if (next === cur) return;
  _sbState.castSlotLevel = next;
  // Refresh left-page slot zone with new level
  _sbRenderSlots();
  // If the right-page higher-level checkbox is checked, update that text too
  const checkEl = document.getElementById('sb-higher-check');
  if (checkEl?.checked) window._sbToggleHigher(true);
};

// Toggle visibility of the "at higher level" text block on the right page.
// Called by the checkbox; also called when the cast level changes while visible.
window._sbToggleHigher = function(checked) {
  const el = document.getElementById('sb-slot-higher');
  if (!el) return;
  if (checked) {
    const spell = _sbState.spells[_sbState.idx];
    if (!spell?.higher_level) { el.style.display = 'none'; return; }
    const lvl = _sbState.castSlotLevel;
    el.innerHTML = (lvl && lvl > spell.level)
      ? `<strong>Op slotniveau ${lvl}:</strong> ${_spellMd(spell.higher_level)}`
      : _spellMd(spell.higher_level);
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
};

// ── Marginalia: render handwritten draggable notes on the right page ──
function _sbRenderMarginalia() {
  const margEl = document.getElementById('sb-marginalia');
  if (!margEl) return;
  const spell = _sbState.spells[_sbState.idx];
  const items = spell?.marginalia || [];

  // Default positions spread down the page (% of page height, right-side strip)
  margEl.innerHTML = items.map((m, i) => {
    const x   = m.x != null ? m.x : 85;                  // % from left of page
    const y   = m.y != null ? m.y : 12 + i * 12;         // % from top of page
    const rot = ((i * 37 + 7) % 13) - 6;                 // deterministic slight rotation
    const paths = _SB_ICONS[m.icon] || '';
    const lbl = esc(m.label || _SB_ICON_LABELS[m.icon] || m.icon);
    return `<div class="sb-marginal-note" data-idx="${i}"
        style="left:${x}%;top:${y}%;transform:rotate(${rot}deg)"
        title="${lbl}">
      <svg class="sb-marginal-note-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>
      <span class="sb-marginal-note-text">${lbl}</span>
    </div>`;
  }).join('');

  // Attach drag handlers to each note
  margEl.querySelectorAll('.sb-marginal-note').forEach(note => {
    note.addEventListener('pointerdown', _sbMarginalDragStart, { passive: false });
  });
}

// Drag state for marginalia
const _sbDrag = { active: false, el: null, idx: -1, ox: 0, oy: 0 };

function _sbMarginalDragStart(e) {
  if (e.button !== 0 && e.pointerType !== 'touch') return;
  e.preventDefault();
  const note = e.currentTarget;
  const page = document.getElementById('sb-page-right');
  if (!page) return;
  const idx = parseInt(note.dataset.idx);
  const pageRect = page.getBoundingClientRect();
  const noteRect = note.getBoundingClientRect();

  // Offset of pointer within note (normalised to page width/height)
  _sbDrag.active = true;
  _sbDrag.el     = note;
  _sbDrag.idx    = idx;
  _sbDrag.pageRect = pageRect;
  _sbDrag.ox = (e.clientX - noteRect.left) / pageRect.width * 100;
  _sbDrag.oy = (e.clientY - noteRect.top)  / pageRect.height * 100;

  note.classList.add('dragging');
  note.setPointerCapture(e.pointerId);

  note.addEventListener('pointermove', _sbMarginalDragMove, { passive: false });
  note.addEventListener('pointerup',   _sbMarginalDragEnd,  { once: true });
  note.addEventListener('pointercancel', _sbMarginalDragEnd, { once: true });
}

function _sbMarginalDragMove(e) {
  if (!_sbDrag.active) return;
  e.preventDefault();
  const { el, pageRect, ox, oy } = _sbDrag;
  // New position as % of page
  let nx = (e.clientX - pageRect.left) / pageRect.width  * 100 - ox;
  let ny = (e.clientY - pageRect.top)  / pageRect.height * 100 - oy;
  // Constrain: keep within page, avoid ribbon (top-right 28px area) and spine
  nx = Math.max(2, Math.min(88, nx));
  ny = Math.max(5, Math.min(88, ny));
  el.style.left      = nx + '%';
  el.style.top       = ny + '%';
  el.style.transform = 'rotate(0deg) scale(1.05)';
}

async function _sbMarginalDragEnd(e) {
  if (!_sbDrag.active) return;
  const { el, idx } = _sbDrag;
  _sbDrag.active = false;
  el.classList.remove('dragging');
  el.removeEventListener('pointermove', _sbMarginalDragMove);

  // Read final position
  const page = document.getElementById('sb-page-right');
  if (!page) return;
  const pageRect  = page.getBoundingClientRect();
  const noteRect  = el.getBoundingClientRect();
  const nx = (noteRect.left - pageRect.left) / pageRect.width  * 100;
  const ny = (noteRect.top  - pageRect.top)  / pageRect.height * 100;

  // Restore rotation
  const spell = _sbState.spells[_sbState.idx];
  const rot   = ((idx * 37 + 7) % 13) - 6;
  el.style.transform = `rotate(${rot}deg)`;

  // Save new position
  if (spell?.marginalia?.[idx]) {
    spell.marginalia[idx].x = Math.round(nx * 10) / 10;
    spell.marginalia[idx].y = Math.round(ny * 10) / 10;
    if (_sbState.charId) {
      try { await api.updatePlayerSpell(_sbState.charId, spell.index, { marginalia: spell.marginalia }); }
      catch (e) { console.warn('Positie opslaan mislukt:', e); }
    }
  }
}

// Returns true when a spell's level is >0 and no slots remain at any valid level
function _sbHasNoSlots(spell) {
  if (!spell.level) return false;           // cantrips always available
  for (let l = spell.level; l <= 9; l++) {
    const s = _sbState.slots[l];
    if (s && s.max > 0 && (s.used || 0) < s.max) return false;
  }
  return Object.keys(_sbState.slots).length > 0; // only fade if slot data is loaded
}

// ════════════════════════════════════════════════════════════
// SPREUKEN TOEVOEGEN — gerichte kies-pagina (klasse + level + type)
// ════════════════════════════════════════════════════════════
const _KLASSE_ALIAS = {
  'magiër': 'Wizard', 'magier': 'Wizard', 'tovenaar': 'Sorcerer', 'hekserij': 'Warlock',
  'barde': 'Bard', 'klerk': 'Cleric', 'priester': 'Cleric', 'verkenner': 'Ranger',
  'paladijn': 'Paladin', 'wachter': 'Ranger',
};
function _spellClassEN(klasse) {
  const k = String(klasse || '').trim();
  return _KLASSE_ALIAS[k.toLowerCase()] || (k.charAt(0).toUpperCase() + k.slice(1));
}
function _spellMatchesClass(spell, klasseEN) {
  if (!klasseEN) return true;
  return (spell.classes || []).some(c => (c.name || '').toLowerCase() === klasseEN.toLowerCase());
}
// Afgeleide roltypes uit de spreukdata (een spreuk kan meerdere tags hebben).
const _SP_TYPE_DEFS = [
  { key: 'schade',   label: 'Schade',   test: s => !!s.damage },
  { key: 'gebied',   label: 'Gebied',   test: s => /\b(cone|cube|sphere|line|cylinder|emanation|radius|each creature)\b/i.test((s.desc||[]).join(' ') + ' ' + (s.range||'')) },
  { key: 'genezing', label: 'Genezing', test: s => /regain|hit points|heal/i.test((s.desc||[]).join(' ')) },
  { key: 'controle', label: 'Controle', test: s => /\b(restrained|stunned|paralyzed|frightened|charmed|prone|grappled|incapacitated|blinded|deafened|poisoned|can.t move|can.t take|speed becomes 0)\b/i.test((s.desc||[]).join(' ')) },
];
function _spellTypes(s) {
  const t = new Set();
  for (const d of _SP_TYPE_DEFS) if (d.test(s)) t.add(d.key);
  if (!t.has('schade') && !t.has('genezing') && !t.has('controle')) t.add('hulp'); // utility/buff
  return t;
}
const _SP_TYPE_LABELS = { schade:'Schade', gebied:'Gebied', genezing:'Genezing', controle:'Controle', hulp:'Hulp' };

// Cantrips known per klasse (2024) — drempel-levels, waarde geldt vanaf dat level.
const _CANTRIPS_KNOWN = {
  wizard:    { 1: 3, 4: 4, 10: 5 },
  sorcerer:  { 1: 4, 4: 5, 10: 6 },
  bard:      { 1: 2, 4: 3, 10: 4 },
  cleric:    { 1: 3, 4: 4, 10: 5 },
  druid:     { 1: 2, 4: 3, 10: 4 },
  warlock:   { 1: 2, 4: 3, 10: 4 },
  artificer: { 1: 2, 10: 3, 14: 4 },
  // paladin & ranger: geen cantrips
};
function _cantripsKnown(klasseEN, level) {
  const tbl = _CANTRIPS_KNOWN[String(klasseEN || '').toLowerCase()];
  if (!tbl) return 0;
  let v = 0;
  for (const lv of Object.keys(tbl).map(Number).sort((a, b) => a - b)) if (level >= lv) v = tbl[lv];
  return v;
}
function _sbAddSpHint() {
  const klasseEN = _spellClassEN(_sbState.klasse);
  const lvl = parseInt(_sbState.klasseLevel) || parseInt(window._lastPlayerProfile?.klasseLevel) || parseInt(window._lastPlayerProfile?.level) || 0;
  if (!klasseEN || !lvl) return '';
  const curC = _sbState.spells.filter(s => (s.level || 0) === 0).length;
  const curS = _sbState.spells.filter(s => (s.level || 0) >= 1).length;
  const knownC = _cantripsKnown(klasseEN, lvl);
  const isBook = /wizard|artificer/i.test(klasseEN);
  const spreukDeel = isBook
    ? `je <strong>spreukenboek</strong> groeit met <strong>2 spreuken</strong> per level`
    : (_sbState.preparedMax ? `je kunt tot <strong>${_sbState.preparedMax} spreuken</strong> voorbereiden` : 'je bereidt spreuken voor uit je lijst');
  const cantripDeel = knownC ? `doorgaans <strong>${knownC} cantrip${knownC === 1 ? '' : 's'}</strong> (je hebt er nu ${curC})` : 'geen cantrips';
  return `<div class="sb-addspells-hint">${icon('sparkles')} Als <strong>${esc(klasseEN)}</strong> op level ${lvl}: ${cantripDeel}, en ${spreukDeel}. Je boek telt nu ${curC} cantrip${curC === 1 ? '' : 's'} en ${curS} spreuk${curS === 1 ? '' : 'en'}.</div>`;
}

const _addSp = { klasseOnly: true, levels: new Set(), types: new Set(), ritueel: false, concentratie: false, query: '', selected: new Set() };

window._sbOpenAddSpells = async function() {
  // Spreukenlijst laden indien nodig
  if (!_playerSpellList) {
    // Alleen echte spreuken: niet-spell-entries (magische voorwerpen) hebben een lege school.
    try { _playerSpellList = ((await fetch('/api/bron/spells-2024').then(r => r.json())).results || []).filter(s => s.school?.name); }
    catch { _playerSpellList = []; }
  }
  _addSp.selected = new Set();
  _addSp.query = '';
  document.getElementById('sb-addspells')?.remove();
  const ov = document.createElement('div');
  ov.id = 'sb-addspells';
  ov.className = 'sb-addspells-overlay';
  const klasseEN = _spellClassEN(_sbState.klasse);
  ov.innerHTML = `
    <div class="sb-addspells-panel" onclick="event.stopPropagation()">
      <div class="sb-addspells-head">
        <div class="sb-addspells-title">${icon('open-book',{cls:'icon-gi'})} Spreuken toevoegen</div>
        <button class="sb-addspells-class" id="sb-addspells-class" onclick="window._sbAddSpToggleClass()"></button>
        <button class="sb-addspells-close" onclick="window._sbCloseAddSpells()" title="Sluiten">${icon('x')}</button>
      </div>
      ${_sbAddSpHint()}
      <input type="text" class="sb-addspells-search" id="sb-addspells-search" placeholder="Zoek op naam…"
        oninput="window._sbAddSpSearch(this.value)">
      <div class="sb-addspells-filters" id="sb-addspells-filters"></div>
      <div class="sb-addspells-list" id="sb-addspells-list"></div>
      <div class="sb-addspells-foot">
        <span class="sb-addspells-count" id="sb-addspells-count"></span>
        <button class="sb-addspells-confirm" id="sb-addspells-confirm" onclick="window._sbAddSpCommit()" disabled>${icon('plus')} Toevoegen</button>
      </div>
    </div>`;
  ov.addEventListener('click', () => window._sbCloseAddSpells());
  document.body.appendChild(ov);
  _sbAddSpRenderFilters();
  _sbAddSpRenderList();
};
window._sbCloseAddSpells = function() { document.getElementById('sb-addspells')?.remove(); };
window._sbAddSpToggleClass = function() { _addSp.klasseOnly = !_addSp.klasseOnly; _sbAddSpRenderFilters(); _sbAddSpRenderList(); };
window._sbAddSpSearch = function(q) { _addSp.query = q || ''; _sbAddSpRenderList(); };
window._sbAddSpToggleLevel = function(l) { l = +l; _addSp.levels.has(l) ? _addSp.levels.delete(l) : _addSp.levels.add(l); _sbAddSpRenderFilters(); _sbAddSpRenderList(); };
window._sbAddSpToggleType = function(t) { _addSp.types.has(t) ? _addSp.types.delete(t) : _addSp.types.add(t); _sbAddSpRenderFilters(); _sbAddSpRenderList(); };
window._sbAddSpToggleFlag = function(f) { _addSp[f] = !_addSp[f]; _sbAddSpRenderFilters(); _sbAddSpRenderList(); };

function _sbAddSpPool() {
  const klasseEN = _spellClassEN(_sbState.klasse);
  return (_playerSpellList || []).filter(s => !_addSp.klasseOnly || _spellMatchesClass(s, klasseEN));
}
function _sbAddSpRenderFilters() {
  const klasseEN = _spellClassEN(_sbState.klasse);
  const classBtn = document.getElementById('sb-addspells-class');
  if (classBtn) classBtn.innerHTML = _addSp.klasseOnly
    ? `${icon('user')} ${esc(klasseEN || 'Klasse')} · <span class="sb-addspells-class-switch">toon alle</span>`
    : `${icon('users')} Alle klassen · <span class="sb-addspells-class-switch">alleen ${esc(klasseEN || 'klasse')}</span>`;
  const el = document.getElementById('sb-addspells-filters');
  if (!el) return;
  const pool = _sbAddSpPool();
  const levelsPresent = [...new Set(pool.map(s => s.level || 0))].sort((a, b) => a - b);
  const levelChips = levelsPresent.map(l => `<button class="sb-addsp-chip${_addSp.levels.has(l) ? ' on' : ''}" onclick="window._sbAddSpToggleLevel(${l})">${l === 0 ? 'Cantrips' : 'Lvl ' + l}</button>`).join('');
  const typeChips = Object.entries(_SP_TYPE_LABELS).map(([k, lbl]) => `<button class="sb-addsp-chip sb-addsp-chip--type${_addSp.types.has(k) ? ' on' : ''}" onclick="window._sbAddSpToggleType('${k}')">${esc(lbl)}</button>`).join('');
  el.innerHTML = `
    <div class="sb-addsp-chiprow">${levelChips}</div>
    <div class="sb-addsp-chiprow">${typeChips}
      <button class="sb-addsp-chip sb-addsp-chip--flag${_addSp.ritueel ? ' on' : ''}" onclick="window._sbAddSpToggleFlag('ritueel')">Ritueel</button>
      <button class="sb-addsp-chip sb-addsp-chip--flag${_addSp.concentratie ? ' on' : ''}" onclick="window._sbAddSpToggleFlag('concentratie')">Concentratie</button>
    </div>`;
}
function _sbAddSpFiltered() {
  const q = _addSp.query.toLowerCase().trim();
  return _sbAddSpPool().filter(s => {
    if (_addSp.levels.size && !_addSp.levels.has(s.level || 0)) return false;
    if (_addSp.types.size) { const t = _spellTypes(s); if (![..._addSp.types].some(x => t.has(x))) return false; }
    if (_addSp.ritueel && !s.ritual) return false;
    if (_addSp.concentratie && !s.concentration) return false;
    if (q && !s.name.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
}
function _sbAddSpRenderList() {
  const el = document.getElementById('sb-addspells-list');
  if (!el) return;
  const inBook = new Set(_sbState.spells.map(s => s.index));
  const list = _sbAddSpFiltered();
  if (!list.length) { el.innerHTML = '<div class="sb-addsp-empty">Geen spreuken gevonden met deze filters.</div>'; }
  else {
    el.innerHTML = list.map(s => {
      const has = inBook.has(s.index);
      const sel = _addSp.selected.has(s.index);
      const types = [..._spellTypes(s)].map(t => `<span class="sb-addsp-badge sb-addsp-badge--${t}">${esc(_SP_TYPE_LABELS[t])}</span>`).join('');
      const school = s.school?.name || '';
      const lvl = (s.level || 0) === 0 ? 'Cantrip' : 'Lvl ' + s.level;
      const preview = (s.desc || []).join(' ').replace(/\s+/g, ' ').slice(0, 130);
      return `<div class="sb-addsp-card${has ? ' sb-addsp-card--has' : ''}${sel ? ' sb-addsp-card--sel' : ''}"
          ${has ? '' : `onclick="window._sbAddSpToggleSelect('${esc(s.index)}')"`}>
        <div class="sb-addsp-check">${has ? icon('check') : (sel ? icon('check') : '')}</div>
        <div class="sb-addsp-main">
          <div class="sb-addsp-cardtop"><span class="sb-addsp-name">${esc(s.name)}</span>
            <span class="sb-addsp-meta">${lvl}${school ? ' · ' + esc(school) : ''}${s.concentration ? ' · C' : ''}${s.ritual ? ' · R' : ''}</span></div>
          <div class="sb-addsp-badges">${types}${has ? '<span class="sb-addsp-inbook">in je boek</span>' : ''}</div>
          <div class="sb-addsp-preview">${esc(preview)}${preview.length >= 130 ? '…' : ''}</div>
        </div>
      </div>`;
    }).join('');
  }
  const n = _addSp.selected.size;
  const cnt = document.getElementById('sb-addspells-count');
  if (cnt) cnt.textContent = n ? `${n} geselecteerd` : `${list.length} spreuk${list.length === 1 ? '' : 'en'}`;
  const btn = document.getElementById('sb-addspells-confirm');
  if (btn) { btn.disabled = n === 0; btn.innerHTML = `${icon('plus')} Toevoegen${n ? ` (${n})` : ''}`; }
}
window._sbAddSpToggleSelect = function(index) {
  _addSp.selected.has(index) ? _addSp.selected.delete(index) : _addSp.selected.add(index);
  _sbAddSpRenderList();
};
window._sbAddSpCommit = async function() {
  if (!_sbState.charId || !_addSp.selected.size) return;
  const btn = document.getElementById('sb-addspells-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Toevoegen…'; }
  const indices = [..._addSp.selected];
  for (const index of indices) {
    if (_sbState.spells.find(s => s.index === index)) continue;
    const full = (_playerSpellList || []).find(s => s.index === index);
    if (!full) continue;
    const desc   = (full.desc || []).join('\n\n');
    const school = full.school?.name || '';
    const concentration = !!full.concentration;
    const ritual = !!full.ritual;
    try {
      await api.addPlayerSpell(_sbState.charId, {
        index, name: full.name, level: full.level || 0, school, concentration, ritual,
        source: full.source || 'phb2024', desc,
        casting_time: full.casting_time || '', range: full.range || '', duration: full.duration || '',
        components: Array.isArray(full.components) ? full.components.join(', ') + (full.material ? ` (${full.material})` : '') : (full.components || ''),
      });
      _sbState.spells.push({ ...full, index, name: full.name, school, source: full.source || 'phb2024', concentration, ritual, level: full.level || 0, desc });
    } catch (e) { console.warn('Spreuk toevoegen mislukt:', e); }
  }
  _sbState.spells.sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
  window._sbCloseAddSpells();
  _sbRender();
  if (typeof window._reRenderKarakter === 'function') window._reRenderKarakter();
};

window._sbTocPin = async function(index, name, btnEl) {
  if (btnEl) { btnEl.innerHTML = icon('check'); btnEl.disabled = true; btnEl.classList.add('sb-toc-item-add--done'); }
  if (_sbState.spells.find(s => s.index === index)) return;
  if (!_sbState.charId) return;
  const fullSpell =
    (_playerSpellList || []).find(s => s.index === index) ||
    { level: 0, school: {}, components: [] };
  const desc          = (fullSpell.desc || []).join('\n\n');
  const concentration = !!fullSpell.concentration || String(fullSpell.duration||'').toLowerCase().includes('concentration');
  const ritual        = !!fullSpell.ritual;
  const school        = fullSpell.school?.name || (typeof fullSpell.school === 'string' ? fullSpell.school : '');
  const source        = fullSpell.source || 'phb2024';
  try {
    await api.addPlayerSpell(_sbState.charId, {
      index, name, level: fullSpell.level || 0,
      school, concentration, ritual, source, desc,
      casting_time: fullSpell.casting_time || '',
      range:        fullSpell.range        || '',
      duration:     fullSpell.duration     || '',
      components: Array.isArray(fullSpell.components)
        ? fullSpell.components.join(', ') + (fullSpell.material ? ` (${fullSpell.material})` : '')
        : (fullSpell.components || ''),
    });
    // Lokaal toevoegen en naar de nieuwe spreuk navigeren
    // Let op: school als string (niet object) en desc als string (niet array),
    // zodat _sbSchoolKey en _renderSpellDesc direct werken zonder hard refresh.
    const newEntry = { ...fullSpell, index, name, school,
      source, concentration, ritual, level: fullSpell.level || 0,
      desc };
    _sbState.spells.push(newEntry);
    _sbState.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    _sbState.idx = _sbState.spells.findIndex(s => s.index === index);
    // Paneel open laten zodat je meteen nóg een spreuk kunt toevoegen;
    // boek navigeert naar de nieuwe spreuk en de inhoudsopgave werkt direct bij.
    _sbRender();
    if (_sbState.tocOpen) {
      _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');
    }
    if (typeof window._reRenderKarakter === 'function') window._reRenderKarakter();
  } catch(e) { console.warn('Spreuk toevoegen mislukt:', e); }
};

window._sbTocUnpin = async function(index) {
  if (!_sbState.charId) return;
  try {
    await api.removePlayerSpell(_sbState.charId, index);
    const wasIdx = _sbState.idx;
    _sbState.spells = _sbState.spells.filter(s => s.index !== index);
    _sbState.idx = Math.min(wasIdx, Math.max(0, _sbState.spells.length - 1));
    if (_sbState.spells.length === 0) {
      window._closeSpellbook();
      if (typeof window._reRenderKarakter === 'function') window._reRenderKarakter();
      return;
    }
    _sbRender();
    _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');
    if (typeof window._reRenderKarakter === 'function') window._reRenderKarakter();
  } catch(e) { console.warn('Spreuk verwijderen mislukt:', e); }
};

window._sbCustomSpellOpen = function() {
  const list = document.getElementById('sb-toc-list');
  if (!list) return;
  list.innerHTML = `
    <div class="sb-custom-form">
      <input class="sb-custom-inp" id="sbc-name" placeholder="Naam spreuk" maxlength="80">
      <div style="display:flex;gap:6px">
        <select class="sb-custom-inp" id="sbc-level" style="flex:0 0 auto">
          ${[0,1,2,3,4,5,6,7,8,9].map(l=>`<option value="${l}">${l===0?'Cantrip':'Niv. '+l}</option>`).join('')}
        </select>
        <input class="sb-custom-inp" id="sbc-school" placeholder="School" maxlength="40" style="flex:1">
      </div>
      <input class="sb-custom-inp" id="sbc-damage" placeholder="Damage (bijv. 2d6 Fire, optioneel)" maxlength="40">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
        <input class="sb-custom-inp" id="sbc-cast" placeholder="Casting Time" maxlength="60">
        <input class="sb-custom-inp" id="sbc-range" placeholder="Range" maxlength="60">
        <input class="sb-custom-inp" id="sbc-comp" placeholder="Components" maxlength="80">
        <input class="sb-custom-inp" id="sbc-dur" placeholder="Duration" maxlength="60">
      </div>
      <textarea class="sb-custom-inp" id="sbc-desc" placeholder="Beschrijving…" rows="3" style="resize:none;width:100%;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:4px">
        <button class="sb-custom-save" onclick="window._sbCustomSpellSave()">Opslaan</button>
        <button class="sb-custom-cancel" onclick="window._sbTocSearch('')">Annuleer</button>
      </div>
    </div>`;
};

window._sbCustomSpellSave = async function() {
  const name = document.getElementById('sbc-name')?.value?.trim();
  if (!name || !_sbState.charId) return;
  const level        = parseInt(document.getElementById('sbc-level')?.value) || 0;
  const school       = document.getElementById('sbc-school')?.value?.trim() || '';
  const damage       = document.getElementById('sbc-damage')?.value?.trim() || '';
  const casting_time = document.getElementById('sbc-cast')?.value?.trim()   || '';
  const range        = document.getElementById('sbc-range')?.value?.trim()  || '';
  const components   = document.getElementById('sbc-comp')?.value?.trim()   || '';
  const duration     = document.getElementById('sbc-dur')?.value?.trim()    || '';
  const desc         = document.getElementById('sbc-desc')?.value?.trim()   || '';
  const index = 'custom_' + Date.now();
  try {
    await api.addPlayerSpell(_sbState.charId, {
      index, name, level, school, source: 'custom',
      desc, damage, casting_time, range, components, duration,
    });
    const newEntry = { index, name, level, school: { name: school }, source: 'custom',
      desc: desc ? [desc] : [], damage, casting_time, range, components, duration,
      concentration: false, ritual: false };
    _sbState.spells.push(newEntry);
    _sbState.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    _sbState.idx = _sbState.spells.findIndex(s => s.index === index);
    _sbRender();
    _sbRenderTocList('');
    if (typeof window._reRenderKarakter === 'function') window._reRenderKarakter();
  } catch(e) { console.warn('Eigen spreuk opslaan mislukt:', e); }
};

window._sbTocSearch = function(q) { _sbRenderTocList(q); };
window._sbTocTogglePreparedOnly = function() {
  _sbState.tocPreparedOnly = !_sbState.tocPreparedOnly;
  _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');
};

function _sbRenderTocList(q) {
  const list = document.getElementById('sb-toc-list');
  if (!list) return;
  const query = (q || '').toLowerCase().trim();
  const pinnedIndices = new Set(_sbState.spells.map(s => s.index));
  let html = '';

  // Reflecteer de filter-knop-staat
  const prepFilterBtn = document.getElementById('sb-toc-prep-filter');
  if (prepFilterBtn) prepFilterBtn.classList.toggle('sb-toc-prep-filter--on', !!_sbState.tocPreparedOnly);

  // Is een spreuk 'paraat'? (cantrip = altijd, of voorbereid, of altijd-paraat)
  const _ready = s => (s.level || 0) === 0 || s.prepared || s.alwaysPrepared;
  // Markertje per spreuk in de lijst
  const _mark = s => (s.level || 0) === 0 || s.alwaysPrepared
    ? '<span class="sb-toc-prep-mark sb-toc-prep-mark--always" title="Altijd paraat">★</span>'
    : (s.prepared ? `<span class="sb-toc-prep-mark sb-toc-prep-mark--on" title="Voorbereid">${icon('check')}</span>` : '');

  if (!query) {
    // Lege zoekterm: toon toegevoegde spreuken per level met verwijderknop
    const bron = _sbState.tocPreparedOnly ? _sbState.spells.filter(_ready) : _sbState.spells;
    if (_sbState.spells.length === 0) {
      html = '<div class="sb-toc-empty">Nog geen spreuken toegevoegd.<br>Zoek er een op om te beginnen.</div>';
    } else if (bron.length === 0) {
      html = '<div class="sb-toc-empty">Geen voorbereide spreuken.<br>Bereid er een voor met de knop bovenaan.</div>';
    } else {
      const groups = {};
      _sbState.spells.forEach((s, i) => {
        if (_sbState.tocPreparedOnly && !_ready(s)) return;
        const k = s.level || 0;
        if (!groups[k]) groups[k] = [];
        groups[k].push({ s, i });
      });
      const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
      for (const k of keys) {
        const label = k === 0 ? 'Cantrips' : `Level ${k}`;
        html += `<div class="sb-toc-level-header">${label}</div>`;
        for (const { s, i } of groups[k]) {
          const active = i === _sbState.idx;
          const school = s.school?.name || (typeof s.school === 'string' ? s.school : '');
          html += `<div class="sb-toc-item${active ? ' sb-toc-active' : ''}">
            ${_mark(s)}
            <span class="sb-toc-item-name" onclick="window._sbGoTo(${i}, true)">${esc(s.name)}</span>
            ${school ? `<span class="sb-toc-item-school">${esc(school)}</span>` : ''}
            <button class="sb-toc-item-del" onclick="window._sbTocUnpin('${esc(s.index)}')" title="Verwijderen">×</button>
          </div>`;
        }
      }
    }
  } else {
    // Zoekterm: zoek in volledige spellenlijst
    if (!_playerSpellList) {
      fetch('/api/bron/spells-2024').then(r => r.json()).then(d => {
        _playerSpellList = d.results || [];
        _sbRenderTocList(q);
      }).catch(() => {});
      list.innerHTML = '<div class="sb-toc-empty">Laden…</div>';
      return;
    }
    const allMatches = _playerSpellList.filter(s => s.name.toLowerCase().includes(query));
    const pinnedMatches   = allMatches.filter(s =>  pinnedIndices.has(s.index)).slice(0, 6);
    const unpinnedMatches = allMatches.filter(s => !pinnedIndices.has(s.index)).slice(0, 6);

    if (pinnedMatches.length) {
      html += '<div class="sb-toc-level-header">Jouw spreuken</div>';
      for (const s of pinnedMatches) {
        const navIdx = _sbState.spells.findIndex(x => x.index === s.index);
        const active = navIdx === _sbState.idx;
        const school = s.school?.name || '';
        html += `<div class="sb-toc-item${active ? ' sb-toc-active' : ''}">
          <span class="sb-toc-item-name" onclick="window._sbGoTo(${navIdx}, true)">${esc(s.name)}</span>
          ${school ? `<span class="sb-toc-item-school">${esc(school)}</span>` : ''}
          <button class="sb-toc-item-del" onclick="window._sbTocUnpin('${esc(s.index)}')" title="Verwijderen">×</button>
        </div>`;
      }
    }
    if (unpinnedMatches.length) {
      html += '<div class="sb-toc-level-header">Toevoegen</div>';
      for (const s of unpinnedMatches) {
        const school = s.school?.name || '';
        html += `<div class="sb-toc-item">
          <span class="sb-toc-item-name">${esc(s.name)}</span>
          ${school ? `<span class="sb-toc-item-school">${esc(school)}</span>` : ''}
          <button class="sb-toc-item-add" onclick="window._sbTocPin('${esc(s.index)}','${esc(s.name)}',this)" title="Toevoegen aan boek">+</button>
        </div>`;
      }
    }
    if (!pinnedMatches.length && !unpinnedMatches.length) {
      html = '<div class="sb-toc-empty">Niet gevonden.</div>';
    }
  }

  // Toevoeg-knoppen altijd onderaan
  html += `<div class="sb-toc-custom-btn-row">
    <button class="sb-toc-custom-btn sb-toc-custom-btn--primary" onclick="window._sbOpenAddSpells()">${icon('open-book',{cls:'icon-gi'})} Spreuken toevoegen</button>
    <button class="sb-toc-custom-btn" onclick="window._sbCustomSpellOpen()">＋ Eigen spreuk</button>
  </div>`;

  list.innerHTML = html;
}

function _sbRenderRibbon() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell) return;
  const pinned = _sbState.favs.has(spell.index);
  const shape = document.getElementById('sb-ribbon-shape');
  if (shape) shape.setAttribute('fill', pinned ? '#c82020' : 'rgba(0,0,0,0.18)');
  const ribbon = document.getElementById('sb-ribbon');
  if (ribbon) ribbon.title = pinned ? 'Losmaken' : 'Vastpinnen';
}

async function _sbFetchDesc(spell) {
  const idx = spell.index;
  if (_sbDescCache.has(idx)) return;
  _sbDescCache.set(idx, ''); // mark as fetching
  try {
    // Laad de lokale lijst als die er nog niet is
    if (!_playerSpellList) {
      try {
        const d = await fetch('/api/bron/spells-2024').then(r => r.json());
        _playerSpellList = d.results || [];
      } catch { _playerSpellList = []; }
    }
    // Try local 2024 list first (fast, no network needed)
    const local = (_playerSpellList || []).find(s => s.index === idx);
    if (local?.desc?.length) {
      const desc = local.desc.join('\n\n');
      _sbDescCache.set(idx, desc);
      const sp = _sbState.spells.find(x => x.index === idx);
      if (sp) {
        if (!sp.desc)         sp.desc         = desc;
        if (!sp.casting_time) sp.casting_time = local.casting_time || '';
        if (!sp.range)        sp.range        = local.range        || '';
        if (!sp.duration)     sp.duration     = local.duration     || '';
        if (!sp.components)   sp.components   = Array.isArray(local.components)
          ? local.components.join(', ') + (local.material ? ` (${local.material})` : '')
          : (local.components || '');
        if (!sp.school)       sp.school       = local.school?.name || '';
        if (!sp.higher_level && local.higher_level?.length)
          sp.higher_level = local.higher_level;   // ← needed for the "at higher levels" toggle
        if (sp.concentration == null && local.concentration != null)
          sp.concentration = !!local.concentration;
      }
      return;
    }
    // Fallback: dnd5eapi.co (for older/custom spells not in local list)
    const r = await fetch(`https://www.dnd5eapi.co/api/spells/${idx}`);
    const s = await r.json();
    const desc = (s.desc || []).join('\n\n');
    _sbDescCache.set(idx, desc);
    const sp = _sbState.spells.find(x => x.index === idx);
    if (sp) {
      if (!sp.desc)         sp.desc         = desc;
      if (!sp.casting_time && s.casting_time) sp.casting_time = s.casting_time;
      if (!sp.range        && s.range)        sp.range        = s.range;
      if (!sp.duration     && s.duration)     sp.duration     = s.duration;
      if (!sp.components   && s.components?.length) sp.components =
        s.components.join(', ') + (s.material ? ` (${s.material})` : '');
      if (!sp.school       && s.school?.name) sp.school       = s.school.name;
      if (!sp.higher_level && s.higher_level?.length)
        sp.higher_level = s.higher_level;           // ← needed for the "at higher levels" toggle
      if (sp.concentration == null && s.concentration != null)
        sp.concentration = !!s.concentration;
    }
  } catch { /* leave cache entry empty */ }
}

function _sbRenderSlots() {
  const zone = document.getElementById('sb-slot-zone');
  if (!zone) return;
  const spell = _sbState.spells[_sbState.idx];
  const baseLvl = spell?.level;
  if (!baseLvl || baseLvl < 1) { zone.innerHTML = ''; return; }

  // Niet-voorbereide leveled spreuk: geen slot afvinken — eerst voorbereiden.
  if (!spell.prepared && !spell.alwaysPrepared) {
    zone.innerHTML = `<button class="sb-slot-unprepared" onclick="window._sbCyclePrepared()"
      title="Je kunt deze spreuk pas casten als hij voorbereid is — klik om voor te bereiden">
      ${icon('book-open')} Bereid voor om te casten</button>`;
    return;
  }

  // Determine shown cast level; keep within valid slot range
  let castLvl = _sbState.castSlotLevel ?? baseLvl;
  // Clamp to a level that actually has slots, preferring the requested level
  const hasSlot = l => (_sbState.slots[l]?.max || 0) > 0;
  if (!hasSlot(castLvl)) {
    // scan up/down for a valid level
    for (let d = 1; d <= 9; d++) {
      if (castLvl + d <= 9 && hasSlot(castLvl + d)) { castLvl = castLvl + d; break; }
      if (castLvl - d >= baseLvl && hasSlot(castLvl - d)) { castLvl = castLvl - d; break; }
    }
  }

  const slot = _sbState.slots[castLvl] || { max: 0, used: 0 };
  if (!slot.max) { zone.innerHTML = ''; return; }

  // Can we go up/down?
  const canUp = (() => { for (let l = castLvl + 1; l <= 9; l++) if (hasSlot(l)) return true; return false; })();
  const canDn = castLvl > baseLvl && (() => { for (let l = castLvl - 1; l >= baseLvl; l--) if (hasSlot(l)) return true; return false; })();

  const dots = Array.from({ length: slot.max }, (_, i) => {
    const used = i < slot.used;
    return `<button class="sb-slot-dot${used ? ' used' : ''}"
      onclick="window._sbToggleSlot(${castLvl},${i})"
      title="${used ? 'Verbruikt – klik om vrij te geven' : 'Vrij – klik om te verbruiken'}"></button>`;
  }).join('');

  zone.innerHTML = `
    <div class="sb-slot-level-row">
      <button class="sb-slot-arrow" onclick="window._sbSlotChange(-1)" ${canDn ? '' : 'disabled'}>−</button>
      <span class="sb-slot-level-label">Level&thinsp;${castLvl}${castLvl !== baseLvl ? ' ✓' : ''}</span>
      <button class="sb-slot-arrow" onclick="window._sbSlotChange(+1)" ${canUp ? '' : 'disabled'}>+</button>
    </div>
    <div class="sb-slot-dots">${dots}</div>`;
}

window._sbToggleSlot = async function(lvl, i) {
  const slot = _sbState.slots[lvl] || { max: 0, used: 0 };
  const newUsed = i < slot.used ? i : i + 1;
  _sbState.slots[lvl] = { ...slot, used: Math.min(Math.max(0, newUsed), slot.max) };
  _sbRenderSlots();
  if (_sbState.charId) {
    try { await api.setPlayerSpellSlots(_sbState.charId, _sbState.slots); } catch {}
  }
};

// Spreukafbeelding: kies uit de mediabibliotheek óf upload nieuw via de picker.
// De gekozen file wordt server-side gekopieerd naar de vaste id spell-img-<index>,
// zodat het render-pad (en de fallback) ongewijzigd blijft.
window._sbPickImage = function() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell) return;
  const fileId = 'spell-img-' + spell.index;
  window.mediaPicker.open({
    type: 'afbeelding',
    suggestedName: (spell.name || 'spreuk').toLowerCase().replace(/\s+/g, '-'),
    onSelect: async (srcId) => {
      try {
        await fetch(`/api/files/${fileId}/copy-from/${srcId}`, { method: 'POST', credentials: 'include' });
        const imgEl = document.getElementById('sb-left-img');
        if (imgEl) { imgEl.src = `/api/files/${fileId}?t=${Date.now()}`; imgEl.style.display = 'block'; }
        const iconEl = document.getElementById('sb-left-icon');
        if (iconEl) iconEl.style.opacity = '0.08'; // dim icon behind image
      } catch (e) { console.error('Afbeelding instellen mislukt:', e); }
    },
  });
};

// Werk het 'Niet voorbereid'-stempel + pagina-ontkleuring bij voor de huidige spreuk.
function _sbUpdateUnprepStamp() {
  const spell = _sbState.spells[_sbState.idx];
  const isUnprep = !!spell && (spell.level || 0) >= 1 && !spell.prepared && !spell.alwaysPrepared;
  const unprepEl = document.getElementById('sb-spell-unprep');
  if (unprepEl) unprepEl.style.display = isUnprep ? '' : 'none';
  const bookEl = document.getElementById('sb-book');
  if (bookEl) bookEl.classList.toggle('sb-book--unprepared', isUnprep);
}

// Telt alleen "echt" voorbereide spreuken (niet de gratis 'altijd paraat' of cantrips).
function _sbPreparedCount() {
  return _sbState.spells.filter(s => s.prepared && !s.alwaysPrepared && (s.level || 0) >= 1).length;
}
// Prepared-teller + 3-standen-toggle: Bereid voor → Paraat → Altijd paraat (gratis).
function _sbRenderPrepared() {
  const zone = document.getElementById('sb-prepared-zone');
  if (!zone) return;
  const spell = _sbState.spells[_sbState.idx];
  const count = _sbPreparedCount();
  const max   = _sbState.preparedMax ?? 0;
  const over  = count > max;
  const isCantrip = (spell?.level || 0) === 0;
  let toggle = '';
  if (spell && isCantrip) {
    toggle = `<span class="sb-prep-btn sb-prep-btn--cantrip" title="Cantrips zijn altijd paraat">${icon('check')} Altijd paraat</span>`;
  } else if (spell && spell.alwaysPrepared) {
    toggle = `<button class="sb-prep-btn sb-prep-btn--always" onclick="window._sbCyclePrepared()" title="Altijd paraat (telt niet mee) — klik om op te heffen">★ Altijd paraat</button>`;
  } else if (spell && spell.prepared) {
    toggle = `<button class="sb-prep-btn sb-prep-btn--on" onclick="window._sbCyclePrepared()" title="Paraat — klik voor 'altijd paraat'">${icon('check')} Paraat</button>`;
  } else if (spell) {
    toggle = `<button class="sb-prep-btn" onclick="window._sbCyclePrepared()" title="Klik om voor te bereiden">${icon('book-open')} Bereid voor</button>`;
  }
  zone.innerHTML = `${toggle}<button class="sb-prep-counter${over ? ' sb-prep-counter--over' : ''}"
    onclick="window._sbEditPreparedMax()" title="Voorbereide spreuken (klik om het maximum aan te passen)">${count} / ${max}</button>`;
}

// Cycle: niet voorbereid → paraat (telt mee) → altijd paraat (gratis) → niet voorbereid.
window._sbCyclePrepared = async () => {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell || (spell.level || 0) === 0 || !_sbState.charId) return;
  let prepared, alwaysPrepared;
  if (!spell.prepared && !spell.alwaysPrepared)      { prepared = true;  alwaysPrepared = false; }
  else if (spell.prepared && !spell.alwaysPrepared)  { prepared = false; alwaysPrepared = true;  }
  else                                               { prepared = false; alwaysPrepared = false; }
  const prev = { prepared: spell.prepared, alwaysPrepared: spell.alwaysPrepared };
  spell.prepared = prepared; spell.alwaysPrepared = alwaysPrepared;
  _sbRenderPrepared();
  _sbRenderSlots();          // slot-pips ↔ 'bereid voor om te casten'
  _sbUpdateUnprepStamp();    // 'Niet voorbereid'-stempel
  if (_sbState.tocOpen) _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');
  try { await api.updatePlayerSpell(_sbState.charId, spell.index, { prepared, alwaysPrepared }); }
  catch { Object.assign(spell, prev); _sbRenderPrepared(); _sbRenderSlots(); _sbUpdateUnprepStamp(); }
};

window._sbEditPreparedMax = async () => {
  const auto = _sbState.preparedAuto ?? 0;
  const cur  = _sbState.preparedMax ?? '';
  const val  = prompt(`Maximaal aantal voorbereide spreuken?\n(laat leeg voor automatisch op basis van klasse + level: ${auto})`, String(cur));
  if (val === null) return;
  const t = val.trim();
  _sbState.preparedMax = t === '' ? auto : (Math.max(0, parseInt(t) || 0));
  _sbRenderPrepared();
  if (_sbState.charId) {
    try { await api.patchPlayerProfile(_sbState.charId, { preparedMax: t === '' ? '' : String(_sbState.preparedMax) }); } catch {}
  }
};

function _sbRender() {
  const spell = _sbState.spells[_sbState.idx];
  if (!spell) return;
  // Persist last viewed spell so it reopens on next session
  if (_sbState.charId && spell.index) {
    try { localStorage.setItem(`_sbLastSpell_${_sbState.charId}`, spell.index); } catch {}
  }
  const sKey = _sbSchoolKey(spell.school);
  const sCfg = _SB_SCHOOLS[sKey] || _SB_DEFAULT;
  const curIdx = _sbState.idx;

  // Deterministic seed for all random-but-consistent visuals per spell
  const seed = spell.index.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // ── Left page: gradient ──
  const leftPage = document.getElementById('sb-page-left');
  if (leftPage) leftPage.style.background = `linear-gradient(155deg, ${sCfg.c1} 0%, ${sCfg.c2} 100%)`;

  // ── Right page: unique torn-edge profile per spell ──
  const rightPage = document.getElementById('sb-page-right');
  if (rightPage) rightPage.style.clipPath = _sbGenTornEdge(seed);

  // ── Left: damage-type visueel effect ──
  {
    let dmgFxEl = document.getElementById('sb-damage-fx');
    if (!dmgFxEl) {
      dmgFxEl = document.createElement('div');
      dmgFxEl.id = 'sb-damage-fx';
      const lp = document.getElementById('sb-page-left');
      if (lp) lp.prepend(dmgFxEl);
    }
    const dmgType = (spell.damage || '').toLowerCase();
    const fx =
      /fire/.test(dmgType)             ? 'fire'      :
      /cold|ice|frost/.test(dmgType)   ? 'cold'      :
      /lightning/.test(dmgType)        ? 'lightning' :
      /acid/.test(dmgType)             ? 'acid'      :
      /necrotic/.test(dmgType)         ? 'necrotic'  :
      /radiant/.test(dmgType)          ? 'radiant'   :
      /thunder/.test(dmgType)          ? 'thunder'   :
      /psychic/.test(dmgType)          ? 'psychic'   :
      /poison/.test(dmgType)           ? 'poison'    :
      /heal/.test(dmgType)             ? 'heal'      : '';
    dmgFxEl.className = `sb-damage-fx${fx ? ' sb-damage-fx--' + fx : ''}`;
  }

  // ── Left: incantation as taped note (or V-placeholder) ──
  const incEl = document.getElementById('sb-left-incantation');
  if (incEl) {
    const rot = ((seed % 9) - 4) * 0.85;
    const noteTints = [
      ['#fef9e6','#f3e9c2'], ['#f8f5ee','#ece6d8'],
      ['#fffaf0','#f2e8d4'], ['#fdf6e4','#eee0c0'],
    ];
    const [t1, t2] = noteTints[seed % noteTints.length];
    const tapeCorners = [
      'top:-6px;left:-5px;transform:rotate(-34deg)',
      'top:-6px;right:-5px;transform:rotate(33deg)',
      'bottom:-6px;left:-5px;transform:rotate(35deg)',
      'bottom:-6px;right:-5px;transform:rotate(-33deg)',
    ];
    const tapeConfigs = [
      [0, 3], [1, 2], [0, 1], [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3], [0, 1, 2, 3],
    ];
    const tape = tapeConfigs[seed % tapeConfigs.length].map(i =>
      `<div class="sb-tape" style="position:absolute;${tapeCorners[i]}"></div>`
    ).join('');

    const hasVerbal = spell.components && /\bV\b/.test(spell.components);

    if (spell.incantation) {
      incEl.innerHTML = `
        <div class="sb-note" style="transform:rotate(${rot}deg);background:linear-gradient(145deg,${t1},${t2})">
          ${tape}
          <div class="sb-note-text">${esc(spell.incantation)}</div>
        </div>`;
    } else if (hasVerbal) {
      // Placeholder: verbale spreuk zonder incantatie
      incEl.innerHTML = `
        <div class="sb-note sb-note--placeholder" style="transform:rotate(${rot}deg)"
             onclick="window._sbToggleManage()" title="Klik om een incantatie in te stellen">
          <div class="sb-tape" style="position:absolute;top:-6px;left:-5px;transform:rotate(-34deg)"></div>
          <div class="sb-tape" style="position:absolute;top:-6px;right:-5px;transform:rotate(33deg)"></div>
          <div class="sb-note-text sb-note-text--hint">✦ Stel een incantatie in</div>
        </div>`;
    } else {
      incEl.innerHTML = '';
    }
  }

  // ── Left: uploaded image ──
  const imgEl = document.getElementById('sb-left-img');
  if (imgEl) {
    const imgSrc = `/api/files/spell-img-${spell.index}`;
    imgEl.src = imgSrc;
    // Focuspunt (object-position) overnemen uit meta — gedeeld met het Spreuken-tabblad.
    const _spFocus = state.meta?.spellImageFocus?.[spell.index];
    imgEl.style.objectPosition = _spFocus || '';
    imgEl.style.display = 'none'; // onerror keeps it hidden if missing
    imgEl.onerror = () => { imgEl.style.display = 'none'; iconEl_?.style && (iconEl_.style.opacity = ''); };
    imgEl.onload  = () => { imgEl.style.display = 'block'; };
  }
  const iconEl_ = document.getElementById('sb-left-icon');
  if (iconEl_) { iconEl_.innerHTML = icon(sCfg.icon); iconEl_.style.opacity = ''; }

  // ── Left: spell slots ──
  _sbRenderSlots();

  // ── Prepared-teller + toggle ──
  _sbRenderPrepared();

  // ── Left: school + level ──
  const schoolEl = document.getElementById('sb-left-school');
  if (schoolEl) schoolEl.textContent = spell.school ? _sbSchoolLabel(spell.school) : '';
  const levelEl = document.getElementById('sb-left-level');
  if (levelEl) levelEl.textContent = spell.level === 0 ? 'Cantrip' : `Level ${spell.level} spell`;

  // ── Left: spell save DC + attack bonus ──
  const statsEl = document.getElementById('sb-spell-stats');
  if (statsEl) {
    const dc  = _sbState.spellSaveDC;
    const atk = _sbState.spellAttackBonus;
    if (dc || atk) {
      const atkNum = parseInt(atk);
      const atkStr = !isNaN(atkNum) ? (atkNum >= 0 ? `+${atkNum}` : `${atkNum}`) : String(atk);
      statsEl.innerHTML = [
        dc  ? `<div class="sb-stat"><span class="sb-stat-label">Save DC</span><span class="sb-stat-value">${esc(String(dc))}</span></div>` : '',
        atk ? `<div class="sb-stat"><span class="sb-stat-label">Atk</span><span class="sb-stat-value">${esc(atkStr)}</span></div>` : '',
      ].join('');
    } else {
      statsEl.innerHTML = '';
    }
  }

  // ── Left: wax seal (bottom-left, school-themed blob) ──
  const sealEl = document.getElementById('sb-wax-seal');
  if (sealEl && spell.school) {
    const letter = spell.school.charAt(0).toUpperCase();
    // Blob shape varies per spell
    const r = [46,54,49,51,44,56,52,48].map((v,i) => v + ((seed >> i) & 3) - 1);
    sealEl.style.borderRadius = `${r[0]}% ${r[1]}% ${r[2]}% ${r[3]}% / ${r[4]}% ${r[5]}% ${r[6]}% ${r[7]}%`;
    // Glossy wax gradient using school colours
    sealEl.style.background =
      `radial-gradient(circle at 36% 30%, rgba(255,255,255,0.22) 0%, transparent 52%),
       radial-gradient(circle at 60% 65%, rgba(0,0,0,0.18) 0%, transparent 42%),
       linear-gradient(145deg, ${sCfg.c2}dd, ${sCfg.c1}ff)`;
    const tilt = ((seed % 11) - 5) * 1.4;
    sealEl.style.transform = `rotate(${tilt}deg)`;
    sealEl.textContent = letter;
    sealEl.style.display = 'flex';
  } else if (sealEl) {
    sealEl.style.display = 'none';
  }

  // ── Ribbon ──
  _sbRenderRibbon();

  // ── Right page ──
  const contentEl = document.getElementById('sb-right-content');
  if (contentEl) {
    const rawDesc = spell.desc || _sbDescCache.get(spell.index) || '';

    // Lazy-load SRD description if missing
    // Guard: only fetch if we haven't already tried (cache would be set to '' on failure)
    const alreadyTried = _sbDescCache.has(spell.index);
    if (!rawDesc && !alreadyTried && spell.source !== 'custom' && !spell.index.startsWith('custom_')) {
      contentEl.innerHTML = `<h2 class="sb-spell-name">${esc(spell.name)}</h2>
        <p style="color:#8a6030;font-style:italic;margin-top:20px">Beschrijving laden…</p>`;
      contentEl.scrollTop = 0;
      _sbFetchDesc(spell).then(() => {
        // Alleen re-renderen als er daadwerkelijk iets gevonden is
        const found = _sbDescCache.get(spell.index) || spell.desc;
        if (_sbState.idx === curIdx && found) _sbRender();
        else if (_sbState.idx === curIdx && !found) {
          // Niets gevonden — toon spell-naam zonder beschrijving
          contentEl.innerHTML = `<h2 class="sb-spell-name">${esc(spell.name)}</h2>
            <p style="color:#8a6030;font-style:italic;margin-top:20px;opacity:.6">Geen beschrijving beschikbaar.</p>`;
        }
      });
    } else {
      const diceColor = _sbDiceColor(spell.damage);
      const desc = _renderSpellDesc(rawDesc, { diceColor });

      const metaRows = [
        spell.casting_time ? ['Casting Time', spell.casting_time] : null,
        spell.range        ? ['Range',        spell.range]        : null,
        spell.components   ? ['Components',   spell.components]   : null,
        spell.duration     ? ['Duration',     spell.duration]     : null,
      ].filter(Boolean);

      const badges = [
        spell.concentration ? `<span class="sb-badge sb-badge--conc">Concentration</span>` : '',
        spell.ritual        ? `<span class="sb-badge sb-badge--ritual">Ritual</span>`       : '',
      ].filter(Boolean).join('');

      const hasHigher = spell.level > 0 && spell.higher_level && spell.higher_level.length > 0;
      const higherText = hasHigher ? _spellMd(spell.higher_level) : '';

      contentEl.innerHTML = `
        <h2 class="sb-spell-name">${esc(spell.name)}</h2>
        ${badges ? `<div class="sb-spell-meta-row">${badges}</div>` : ''}
        ${metaRows.length ? `<div class="sb-meta-table">${
          metaRows.map(([k,v]) => `<span class="sb-meta-key">${k}</span><span class="sb-meta-val">${esc(v)}</span>`).join('')
        }</div>` : ''}
        ${hasHigher ? `<label class="sb-higher-toggle">
          <input type="checkbox" id="sb-higher-check" onchange="window._sbToggleHigher(this.checked)">
          <span>Op hoger slotniveau</span>
        </label>
        <div class="sb-slot-higher" id="sb-slot-higher" style="display:none">${higherText}</div>` : ''}
        ${(badges || metaRows.length) ? '<div class="sb-divider"></div>' : ''}
        <div class="sb-desc">${desc || '<em>Geen beschrijving beschikbaar.</em>'}</div>`;
      contentEl.scrollTop = 0;
      // Apply glossary tooltips to the rendered content (text nodes only)
      _sbApplyGlossary_DOM(contentEl);
    }
  }

  // ── Marginalia — handwritten notes on right page ──
  _sbRenderMarginalia();

  // ── Concentration fold corner — always hidden (replaced by overlay button) ──
  const foldEl = document.getElementById('sb-conc-fold');
  if (foldEl) { foldEl.className = 'sb-conc-fold sb-conc-fold--hidden'; foldEl.onclick = null; }

  // ── Concentration overlay button (pulsing, in controls bar) ──
  const concCtrlBtn = document.getElementById('sb-conc-ctrl-btn');
  if (concCtrlBtn) {
    const hasConc = !!spell.concentration;
    const active  = !!spell.concentrationActive;
    concCtrlBtn.style.display = hasConc ? '' : 'none';
    concCtrlBtn.innerHTML = active ? '🕯 Actief' : '🕯 Concentratie';
    concCtrlBtn.classList.toggle('sb-ctrl-conc--active', active);
    concCtrlBtn.title = active ? 'Concentratie actief — klik om te stoppen' : 'Klik om concentratie te activeren';
  }

  // ── Spell fade when no slots available ──
  const fadeEl = document.getElementById('sb-spell-fade');
  if (fadeEl) fadeEl.style.display = _sbHasNoSlots(spell) ? '' : 'none';

  // ── Niet-voorbereid stempel (leveled spreuk die niet paraat is) ──
  _sbUpdateUnprepStamp();

  // ── Page yellowing based on acquisition level ──
  if (rightPage) {
    const acq = spell.acquisitionLevel || 20;
    rightPage.dataset.aged = acq <= 3 ? '3' : acq <= 7 ? '2' : acq <= 11 ? '1' : '0';
  }

  // ── TOC ──
  _sbRenderTocList(document.getElementById('sb-toc-search')?.value || '');

  // ── Beheer-paneel bijwerken als het open is ──
  if (_sbState.manageOpen) _sbManageRefresh();
}

// ════════════════════════════════════════════════════════════
// BOEDELINVENTARIS — officiële eigendomsopgave voor spelers
// ════════════════════════════════════════════════════════════

const _invState = { items: [], selectedIdx: -1, charName: '', currency: { fl:0, kn:0, cl:0 }, partyCurrency: null, currencyNames: { ...MUNT_STANDAARD }, page: 0, partyMembers: [] };
const INV_PAGE_SIZE = 8;

function _invTallyMarks(n) {
  if (n <= 0) return '';
  if (n > 10) return `<span class="inv-qty-num">${n}×</span>`;
  const GW = 20, GAP = 4, MW = 5;
  const g = Math.floor(n / 5), r = n % 5;
  const w = g * GW + Math.max(0, g - 1) * GAP + (g > 0 && r > 0 ? GAP : 0) + r * MW;
  const H = 18;
  let m = '', x = 0;
  for (let i = 0; i < g; i++) {
    for (let j = 0; j < 4; j++) m += `<line x1="${x+1+j*5}" y1="2" x2="${x+1+j*5}" y2="${H-2}"/>`;
    m += `<line x1="${x}" y1="${H-2}" x2="${x+GW}" y2="2"/>`;
    x += GW + GAP;
  }
  for (let i = 0; i < r; i++) { m += `<line x1="${x+1}" y1="2" x2="${x+1}" y2="${H-2}"/>`; x += MW; }
  return `<svg class="inv-tally" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">${m}</svg>`;
}

const _INV_TYPE_EMOJI = {
  Weapon:icon('swords'), Wapen:icon('swords'), Armor:icon('shield'), Uitrusting:icon('shield'), Shield:icon('shield'),
  'Magic Item':icon('sparkles'), Toveritem:icon('sparkles'), 'Wondrous Item':icon('sparkles'),
  Potion:icon('flask-conical'), Drank:icon('flask-conical'), Scroll:icon('scroll-text'), Ring:icon('star'), Amulet:icon('sparkles'),
  Consumable:icon('flask-conical'), Feature:icon('star'), 'Musical Instrument':icon('sparkles'),
};
function _invTypeEmoji(it) {
  return _INV_TYPE_EMOJI[it.data?.itemType || it.subtype || ''] || icon('package');
}

function _invTornEdgePath(seed) {
  const STEPS = 20;
  const rng = (i) => (((seed * 1664525 + i * 1013904223) >>> 0) % 1000) / 1000;
  let pts = ['0% 0%', '99% 0%'];
  for (let i = 0; i <= STEPS; i++) {
    const y = ((i / STEPS) * 100).toFixed(1);
    const x = (97.5 + rng(i + 2) * 2.5).toFixed(1);
    pts.push(`${x}% ${y}%`);
  }
  pts.push('99% 100%', '0% 100%');
  return `polygon(${pts.join(', ')})`;
}

function _invChargeMarks(charges, maxCharges) {
  if (maxCharges <= 0) return '';
  if (maxCharges > 8) return `<span class="inv-charges-row"><span class="inv-charge-frac">${charges}/${maxCharges}</span></span>`;
  let s = '';
  for (let i = 0; i < maxCharges; i++) {
    s += i < charges ? '<span class="inv-charge-tick">|</span>' : '<span class="inv-charge-cross">✕</span>';
  }
  return `<span class="inv-charges-row">${s}</span>`;
}

function _ensureInventarisOverlay() {
  if (document.getElementById('inv-overlay')) return;
  const el = document.createElement('div');
  el.id = 'inv-overlay';
  el.className = 'inv-overlay';
  el.innerHTML = `
    <div class="inv-controls">
      <button class="sb-ctrl-btn sb-ctrl-close" onclick="window._closeInventaris()">✕ Sluit inventaris</button>
    </div>
    <div class="inv-wrap" id="inv-wrap">
      <div class="inv-clipboard-col">
        <div class="inv-clip-head">
          <div class="inv-clip-mount">
            <div class="inv-clip-screw"></div>
            <div class="inv-clip-bar"></div>
            <div class="inv-clip-screw"></div>
          </div>
        </div>
        <div class="inv-document" id="inv-document">
          <div class="inv-notary-pre" id="inv-notary-pre"></div>
          <div class="inv-doc-ornament">✦</div>
          <div class="inv-doc-rule"></div>
          <div class="inv-list-head">
            <span class="inv-lh-name">Voorwerp</span>
            <span class="inv-lh-qty">Aantal</span>
            <span class="inv-lh-charges">Charges</span>
          </div>
          <div class="inv-list" id="inv-list"></div>
          <div class="inv-add-note-area" id="inv-add-note-area">
            <div id="inv-add-note-form" class="inv-add-note-form">
              <input id="inv-add-note-input" class="inv-add-note-input" placeholder="Naam van notitie…" maxlength="80"
                onkeydown="if(event.key==='Enter')window._invSaveNote()">
              <textarea id="inv-add-note-body" class="inv-add-note-body" placeholder="Inhoud (optioneel)" maxlength="400"></textarea>
              <div class="inv-add-note-btns">
                <button class="inv-add-note-save" onclick="window._invSaveNote()">Voeg toe</button>
                <button class="inv-add-note-cancel" onclick="window._invToggleAddNote(false)">Annuleer</button>
              </div>
            </div>
            <button class="inv-add-note-trigger" id="inv-add-note-trigger" onclick="window._invToggleAddNote()">+ notitie</button>
          </div>
          <div id="inv-page-nav" class="inv-page-nav"></div>
          <div class="inv-beurs" id="inv-beurs"></div>
          <div class="inv-doc-footer">
            <svg class="inv-footer-seal" viewBox="0 0 60 60" width="52" height="52">
              <circle cx="30" cy="30" r="27" fill="none" stroke="#8a6030" stroke-width="1.2" stroke-dasharray="3 2"/>
              <circle cx="30" cy="30" r="19" fill="rgba(180,130,60,0.10)" stroke="#8a6030" stroke-width="0.8"/>
              <text x="30" y="27" font-family="Cinzel,serif" font-size="8" fill="#8a6030" text-anchor="middle">C·C·C</text>
              <text x="30" y="37" font-family="Cinzel,serif" font-size="6" fill="#8a6030" text-anchor="middle">NOTARIS</text>
            </svg>
          </div>
        </div>
      </div>
      <div class="inv-detail-panel" id="inv-detail-panel">
        <div class="inv-detail-hint"><span>← Kies een voorwerp</span></div>
      </div>
      <div class="inv-portrait-hint">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sb-portrait-hint-icon"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        <span>Draai je scherm voor de boedelinventaris</span>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) window._closeInventaris(); });
  el.addEventListener('click', e => {
    const dice = e.target.closest('.sb-hl-dice');
    if (dice) { e.stopPropagation(); window._sbFlashRoll?.(dice.textContent.trim(), ''); }
  });
  el.addEventListener('wheel',     e => { if (!e.target.closest('.inv-list, .inv-det-page, .inv-document')) e.preventDefault(); }, { passive: false });
  el.addEventListener('touchmove', e => { if (!e.target.closest('.inv-list, .inv-det-page, .inv-document')) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('inv-overlay')?.classList.contains('inv-open')) return;
    if (e.key === 'Escape') window._closeInventaris();
    if (e.key === 'ArrowDown') { e.preventDefault(); window._invMove(1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); window._invMove(-1); }
  });
}

window._openInventaris = function(items, simpleItems, charName, currency, partyCurrency, currencyNames, partyMembers) {
  try {
    _invState.items = [
      ...(items || []).map(it => ({ _kind: 'entity', ...it })),
      ...(simpleItems || []).map(si => ({ _kind: 'note', id: si.id, name: si.name, note: si.note || '' })),
    ];
    _invState.charName = charName || '—';
    _invState.selectedIdx = _invState.items.length > 0 ? 0 : -1;
    _invState.page = 0;
    _invState.currency = currency || { fl:0, kn:0, cl:0 };
    _invState.partyCurrency = partyCurrency || null;
    _invState.currencyNames = currencyNames || window._muntNamen();
    _invState.partyMembers = partyMembers || [];
    _ensureInventarisOverlay();
    _invRender();
    const ov = document.getElementById('inv-overlay');
    if (!ov) return;
    ov.style.display = '';
    ov.classList.remove('inv-open');
    requestAnimationFrame(() => ov.classList.add('inv-open'));
  } catch(e) { console.error('Inventaris open fout:', e); }
};

window._closeInventaris = function() {
  const ov = document.getElementById('inv-overlay');
  if (ov) {
    ov.classList.remove('inv-open');
    const _ref = ov;
    setTimeout(() => { if (!_ref.classList.contains('inv-open')) _ref.style.display = 'none'; }, 350);
  }
};

window._invSelectItem = function(idx) {
  const targetPage = Math.floor(idx / INV_PAGE_SIZE);
  _invState.selectedIdx = idx;
  if (targetPage !== _invState.page) {
    _invState.page = targetPage;
    _invRender();
  } else {
    const offset = _invState.page * INV_PAGE_SIZE;
    document.querySelectorAll('.inv-list-row').forEach((r, i) => r.classList.toggle('active', i + offset === idx));
    _invRenderDetail();
  }
};

window._invMove = function(delta) {
  const n = _invState.items.length;
  if (!n) return;
  const ni = ((_invState.selectedIdx + delta) % n + n) % n;
  window._invSelectItem(ni);
  const rowIdx = ni - _invState.page * INV_PAGE_SIZE;
  document.querySelectorAll('.inv-list-row')[rowIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
window._invPagePrev = function() {
  if (_invState.page > 0) {
    _invState.page--;
    _invState.selectedIdx = _invState.page * INV_PAGE_SIZE;
    _invRender();
  }
};
window._invPageNext = function() {
  const totalPages = Math.ceil(_invState.items.length / INV_PAGE_SIZE);
  if (_invState.page < totalPages - 1) {
    _invState.page++;
    _invState.selectedIdx = _invState.page * INV_PAGE_SIZE;
    _invRender();
  }
};
window._invToggleAddNote = function(forceOpen) {
  const form = document.getElementById('inv-add-note-form');
  if (!form) return;
  const open = forceOpen !== undefined ? forceOpen : !form.classList.contains('open');
  form.classList.toggle('open', open);
  if (open) document.getElementById('inv-add-note-input')?.focus();
};
window._invSaveNote = async function() {
  const nameEl = document.getElementById('inv-add-note-input');
  const bodyEl = document.getElementById('inv-add-note-body');
  const name = nameEl?.value?.trim();
  if (!name) { nameEl?.focus(); return; }
  const note = bodyEl?.value?.trim() || '';
  const charId = state.characterId;
  if (!charId) return;
  try {
    const result = await api.addPlayerItem(charId, { name, note });
    if (!result?.id) { console.warn('Notitie toevoegen: server gaf geen id terug'); return; }
    _invState.items.push({ _kind: 'note', id: result.id, name: result.name, note: result.note || '' });
    _invState.selectedIdx = _invState.items.length - 1;
    _invState.page = Math.floor((_invState.items.length - 1) / INV_PAGE_SIZE);
    if (nameEl) nameEl.value = '';
    if (bodyEl) bodyEl.value = '';
    window._invToggleAddNote(false);
    _invRender();
  } catch(e) { console.error('Notitie toevoegen mislukt:', e); }
};

function _invRender() {
  const pre = document.getElementById('inv-notary-pre');
  if (pre) {
    pre.innerHTML = `Huijden den XIV Bloemmaand MDCCLXXII compareerden<br>
      voor mij, notaris <em>Cornelis Carolus Cnipcent</em>, de<br>
      persoon van <strong>${esc(_invState.charName)}</strong>, eigenaardig<br>
      van aangezicht en avonturier van beroep, dewelke<br>
      verklaarde dat navolgende voorwerpen zijn wettige<br>
      en persoonlijke eigendomme zijn.`;
  }
  const total = _invState.items.length;
  const totalPages = Math.max(1, Math.ceil(total / INV_PAGE_SIZE));
  _invState.page = Math.max(0, Math.min(_invState.page, totalPages - 1));
  const offset = _invState.page * INV_PAGE_SIZE;
  const pageItems = _invState.items.slice(offset, offset + INV_PAGE_SIZE);

  // Attunement slots (uit localStorage)
  const _attCharId = state.characterId;
  const _attSlots = _attCharId ? (() => { try { return JSON.parse(localStorage.getItem('attSlots_' + _attCharId) || '[]'); } catch { return []; } })() : [];

  const list = document.getElementById('inv-list');
  if (list) {
    if (!total) {
      list.innerHTML = '<div class="inv-list-empty">Geen voorwerpen in de boedel.</div>';
    } else {
      list.innerHTML = pageItems.map((it, pi) => {
        const i = offset + pi;
        const isNote = it._kind === 'note';
        const typeLabel = isNote ? 'Notitie' : (it.data?.itemType || it.subtype || 'Overig');
        const typeIcon = isNote ? icon('message-circle') : _invTypeEmoji(it);
        const qty = it._qty || 1;
        const showTally = !isNote && it._stapelbaar && qty > 1;
        const charges = !isNote && it._maxCharges > 0 ? _invChargeMarks(it._charges, it._maxCharges) : '';
        const requiresAtt = !isNote && (it.data?.attunement === 'true' || it.data?.attunement === true);
        const isAttuned = requiresAtt && _attSlots.includes(it.id);
        const attBadge = requiresAtt ? `<span class="inv-att-badge${isAttuned ? ' inv-att-badge--active' : ''}" title="${isAttuned ? 'Attuned' : 'Vereist attunement'}">${icon('link')}</span>` : '';
        return `<div class="inv-list-row${i === _invState.selectedIdx ? ' active' : ''}" onclick="window._invSelectItem(${i})">
          <span class="inv-row-name"><span class="inv-row-icon" aria-hidden="true">${typeIcon}</span>${esc(it.name)}${attBadge}</span>
          <span class="inv-row-qty">${showTally ? _invTallyMarks(qty) : (qty > 1 ? `<span class="inv-qty-num">${qty}×</span>` : '')}</span>
          <span class="inv-row-charges">${charges}</span>
        </div>`;
      }).join('');
    }
  }

  // Pagination nav
  const nav = document.getElementById('inv-page-nav');
  if (nav) {
    nav.innerHTML = totalPages <= 1 ? '' : `
      <button class="inv-page-btn" onclick="window._invPagePrev()" ${_invState.page <= 0 ? 'disabled' : ''}>←</button>
      <span class="inv-page-label">Folio ${_invState.page + 1} van ${totalPages}</span>
      <button class="inv-page-btn" onclick="window._invPageNext()" ${_invState.page >= totalPages - 1 ? 'disabled' : ''}>→</button>`;
  }

  // Add-note trigger visibility — alleen zichtbaar voor spelers met een karakter (niet voor DM)
  const addTrigger = document.getElementById('inv-add-note-trigger');
  if (addTrigger) addTrigger.style.display = state.characterId ? '' : 'none';

  // Beurs
  const beurs = document.getElementById('inv-beurs');
  if (beurs) {
    const cn = _invState.currencyNames;
    const cur = _invState.currency;
    const pc = _invState.partyCurrency;
    const others = (_invState.partyMembers || []).filter(n => n && n !== _invState.charName);
    const deeltMsg = pc?.enabled && others.length > 0
      ? `${esc(_invState.charName)} deelt zijn aardse vermogen met ${others.map(n => esc(n)).join(', ')}`
      : pc?.enabled ? `${esc(_invState.charName)} deelt zijn aardse vermogen met de groep` : '';
    beurs.innerHTML = `
      <div class="inv-beurs-row">
        <span class="inv-beurs-amount">${cur.fl ?? 0}</span>
        <span class="inv-beurs-name">${esc(cn.fl || MUNT_STANDAARD.fl)}</span>
        <span class="inv-beurs-sep">·</span>
        <span class="inv-beurs-amount">${cur.kn ?? 0}</span>
        <span class="inv-beurs-name">${esc(cn.kn || MUNT_STANDAARD.kn)}</span>
        <span class="inv-beurs-sep">·</span>
        <span class="inv-beurs-amount">${cur.cl ?? 0}</span>
        <span class="inv-beurs-name">${esc(cn.cl || MUNT_STANDAARD.cl)}</span>
      </div>
      ${deeltMsg ? `<div class="inv-beurs-shared">${deeltMsg}</div>` : ''}`;
  }

  _invRenderDetail();
}

function _invRenderDetail() {
  const panel = document.getElementById('inv-detail-panel');
  if (!panel) return;
  const idx = _invState.selectedIdx;
  if (idx < 0 || idx >= _invState.items.length) {
    panel.innerHTML = `<div class="inv-detail-hint"><span>← Kies een voorwerp uit de lijst</span></div>`;
    return;
  }
  const it = _invState.items[idx];
  if (it._kind === 'note') _invRenderNoteDetail(panel, it);
  else _invRenderEntityDetail(panel, it);
}

// Normaliseer een rariteit (NL/EN) naar een sleutel voor de knapzak-styling.
function _invRarityKey(r) {
  if (!r) return '';
  const map = {
    'common':'common','gewoon':'common',
    'uncommon':'uncommon','ongewoon':'uncommon',
    'rare':'rare','zeldzaam':'rare',
    'very rare':'very-rare','zeer zeldzaam':'very-rare',
    'legendary':'legendary','legendarisch':'legendary',
    'artifact':'legendary','artefact':'legendary',
  };
  return map[String(r).trim().toLowerCase()] || '';
}

function _invRenderEntityDetail(panel, it) {
  const seed = it.id ? it.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 42;
  // Grotere rotatie-range — kaartjes zien eruit alsof ze willekeurig neergelegd zijn
  const rotSteps = [3.2, -2.1, 4.8, -3.7, 1.9, -4.4, 2.6, -1.5, 3.9, -2.8, 1.2, -4.1, 4.3, -0.9, 2.4];
  const rot = rotSteps[seed % rotSteps.length];
  const typeLabel = it.data?.itemType || it.subtype || 'Overig';
  const typeIcon = _invTypeEmoji(it);
  const desc = it.data?.desc || '';
  const flavour = it.data?.flavour || '';
  const rarity = it.data?.rariteit || it.data?.rarity || '';
  const rarityKey = _invRarityKey(rarity);
  const rarityLabel = { Common:'Gewoon', Uncommon:'Ongewoon', Rare:'Zeldzaam', 'Very Rare':'Zeer zeldzaam', Legendary:'Legendarisch', Artifact:'Artefact' }[rarity] || rarity;
  const paperBgs = ['#f8f3e5', '#f5eed6', '#f2ecd4', '#faf6eb'];
  const bg = paperBgs[seed % paperBgs.length];
  const clipPath = _invTornEdgePath(seed);
  panel.innerHTML = `
    <div class="inv-det-page" style="transform:rotate(${rot}deg);clip-path:${clipPath};background:${bg}"${rarityKey ? ` data-rarity="${rarityKey}"` : ''}>
      <div class="inv-img-zone inv-img-zone--sheet">
        <img class="inv-det-img" src="${api.fileForEntity(it)}" alt="${esc(it.name)}"
          onload="this.closest('.inv-img-zone').classList.add('inv-has-img')"
          onerror="this.closest('.inv-img-zone').classList.add('inv-no-img')">
        <div class="inv-img-fallback">
          <span class="inv-fallback-emoji">${typeIcon}</span>
          <div class="inv-fallback-name">${esc(it.name)}</div>
          <div class="inv-fallback-type">${esc(typeLabel)}</div>
        </div>
      </div>
      <div class="inv-det-text">
        <div class="inv-det-name">${esc(it.name)}</div>
        <div class="inv-det-meta-row">
          ${typeLabel ? `<span class="inv-det-type-badge">${esc(typeLabel)}</span>` : ''}
          ${rarityLabel ? `<span class="inv-det-rarity"${rarityKey ? ` data-rarity="${rarityKey}"` : ''}>${rarityKey ? '<span class="inv-rarity-gem" aria-hidden="true">◆</span>' : ''}${esc(rarityLabel)}</span>` : ''}
        </div>
        ${desc ? `<div class="inv-det-desc">${window.glossary?.annotate?.(_spellMd(desc)) ?? _spellMd(desc)}</div>` : ''}
        ${flavour ? `<blockquote class="inv-det-flavour">${esc(flavour)}</blockquote>` : ''}
      </div>
    </div>`;
}

function _invRenderNoteDetail(panel, it) {
  const seed = it.id ? it.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 7;
  const rot = ((seed % 9) - 4) * 0.8;
  panel.innerHTML = `
    <div class="inv-det-page inv-det-page--note">
      <div class="inv-note-wrap" style="transform:rotate(${rot}deg)">
        <div class="inv-tape inv-tape--tc"></div>
        <div class="inv-note-paper">
          <div class="inv-note-label">— notitie —</div>
          <div class="inv-note-name">${esc(it.name)}</div>
          ${it.note ? `<div class="inv-note-body">${esc(it.note)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

// Geeft de juiste CSS-modifier voor de damage-pill op basis van het schadetype.
// Detecteert trefwoorden in de damage-string (bijv. "2d6 fire", "3d8 cold damage").
function _damagePillMod(dmg) {
  if (!dmg) return '';
  const d = dmg.toLowerCase();
  if (/heal/.test(d))                        return ' spell-damage-pill--heal';
  if (/fire/.test(d))                        return ' spell-damage-pill--fire';
  if (/cold|ice|frost/.test(d))             return ' spell-damage-pill--cold';
  if (/lightning/.test(d))                   return ' spell-damage-pill--lightning';
  if (/thunder/.test(d))                     return ' spell-damage-pill--thunder';
  if (/acid/.test(d))                        return ' spell-damage-pill--acid';
  if (/force/.test(d))                       return ' spell-damage-pill--force';
  if (/slash|pierc|bludgeon/.test(d))       return ' spell-damage-pill--physical';
  if (/radiant/.test(d))                     return ' spell-damage-pill--radiant';
  if (/necrotic/.test(d))                    return ' spell-damage-pill--necrotic';
  if (/psychic/.test(d))                     return ' spell-damage-pill--psychic';
  if (/poison/.test(d))                      return ' spell-damage-pill--acid';
  return ''; // onbekend type → standaard rood
}

function _fmtBerichtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

// Briefhoofd per dienst-thema (boven aan een gethematiseerde brief)
// Factiekleur (stijl hout/metaal/staal) → hex voor lakzegel & letterhead.
function _factieKleurHex(kleur) {
  return { hout: '#8a5a2a', metaal: '#9a9aa8', staal: '#5b7a9a' }[kleur] || '#b8860b';
}

function _briefLetterhead(m) {
  const thema = typeof m === 'string' ? m : m?.thema;
  switch (thema) {
    case 'ursula':    return `<span class="lh-zegel">✦</span> ${esc(window._dienstNaam('ursula'))}`;
    case 'gock':      return `<span class="lh-zegel">⌖</span> ${esc(window._dienstNaam('gock'))}`;
    case 'tweespalt': return `<span class="lh-zegel">${icon('dice')}</span> ${esc(window._dienstNaam('tweespalt'))}`;
    case 'heeren':    return `<span class="lh-zegel">${icon('moon')}</span> ${esc(window._dienstNaam('heeren'))}`;
    case 'factie': {
      const emb  = (typeof m === 'object' && m.embleem) ? m.embleem : 'landmark';
      const naam = (typeof m === 'object' && (m.kop || m.afzender)) || 'Een factie';
      return `<span class="lh-zegel">${icon(emb)}</span> ${esc(naam)}`;
    }
    default:          return '';
  }
}

// Subtiel "brief valt + zegel" geluid via Web Audio (geen asset nodig).
function _briefCinematicSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const now = ac.currentTime;
    // zachte papier-/plof-ruis
    const dur = 0.5;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ac.createGain(); g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(now);
    // korte "zegel-druk" toon
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, now + 0.42); o.frequency.exponentialRampToValueAtTime(70, now + 0.62);
    const og = ac.createGain(); og.gain.setValueAtTime(0.0001, now + 0.42); og.gain.exponentialRampToValueAtTime(0.12, now + 0.46); og.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    o.connect(og); og.connect(ac.destination); o.start(now + 0.42); o.stop(now + 0.7);
    setTimeout(() => ac.close().catch(() => {}), 1200);
  } catch { /* stilte is ook goed */ }
}

// Cinematische aankomst van een verzegelde factie-uitnodiging.
// ── Een voorwerp aan een medespeler geven ───────────────────────────────────
// Direct, zonder tussenkomst van de DM: aan tafel schuif je een ding over de
// tafel en dan is het van de ander. De DM kan het per party uitzetten.
window._geefItemMenu = async (itemId, knop) => {
  document.getElementById('geef-menu')?.remove();
  let leden = [];
  try {
    const party = await api.getPartyMembers();
    leden = (Array.isArray(party) ? party : [])
      .filter(p => p.id !== window.app?.state?.characterId);
  } catch { /* ok */ }
  const menu = document.createElement('div');
  menu.id = 'geef-menu';
  menu.className = 'geef-menu';
  menu.innerHTML = leden.length
    ? `<div class="geef-menu-kop">Geven aan…</div>${leden.map(p => `
        <button class="geef-menu-rij" onclick="window._geefItem('${esc(itemId)}','${esc(p.id)}')">
          <img class="geef-menu-portret" src="/api/thumb/${esc(p.id)}" alt="" onerror="this.remove()">
          <span>${esc(p.name)}</span>
        </button>`).join('')}`
    : `<div class="geef-menu-kop">Geen medespelers in je party.</div>`;
  document.body.appendChild(menu);
  const r = knop.getBoundingClientRect();
  menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 12)}px`;
  menu.style.top  = `${Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 12)}px`;
  // Eén klik ergens anders sluit hem weer.
  setTimeout(() => document.addEventListener('click', function sluit(ev) {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', sluit); }
  }), 0);
};

window._geefItem = async (itemId, targetId) => {
  document.getElementById('geef-menu')?.remove();
  try {
    const r = await api.geefItem(itemId, targetId);
    _showToast?.(`${window.icon?.('package') || ''} <strong>${esc(r.itemNaam)}</strong> is nu van ${esc(r.naar)}`);
    window._knapzakCarouselItems = (window._knapzakCarouselItems || []).filter(i => i.id !== itemId);
    window._knapzakCarouselIdx = 0;
    window._knapzakCarouselRender?.();
  } catch (e) {
    alert('Geven mislukt: ' + (e.message || e));
  }
};

// ── Loot op het tafelscherm ─────────────────────────────────────────────────
// Twee traps, net als de verzegelde brief: er staat een gesloten kist, iemand
// tikt erop, de animatie speelt, en pas daarna verschijnt de buit met wie wat
// claimt. Komt er daarna nog een update binnen (een nieuwe claim, de uitslag),
// dan hertekenen we alleen het lijstje — niet de hele cinematic, want dan zou
// de kist telkens opnieuw dichtgaan.
let _lootCinOpen = false;

function _lootCinBedrag(goud) {
  const c = window._muntNamen();
  const d = [[goud?.fl, c.fl], [goud?.kn, c.kn], [goud?.cl, c.cl]]
    .filter(([n]) => n > 0).map(([n, naam]) => `${n} ${esc(naam)}`);
  return d.join(' · ');
}

function _lootCinPortret(p) {
  return `<img class="loot-cin-portret" src="/api/thumb/${esc(p.thumb)}" alt=""
    title="${esc(p.naam)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),
    {className:'loot-cin-portret loot-cin-portret--leeg', textContent:'${esc((p.naam || '?')[0])}'}))">`;
}

function _lootCinClaimRegel(it) {
  if (it.winnaar) return `<span class="loot-cin-claim loot-cin-claim--winnaar">
    ${_lootCinPortret(it.winnaar)} gaat naar <strong>${esc(it.winnaar.naam)}</strong></span>`;
  const c = it.claimers || [];
  if (!c.length) return `<span class="loot-cin-claim loot-cin-claim--stil">nog niemand</span>`;
  if (c.length === 1) return `<span class="loot-cin-claim">
    ${_lootCinPortret(c[0])} geclaimd door <strong>${esc(c[0].naam)}</strong></span>`;
  const namen = c.map(x => esc(x.naam));
  const laatste = namen.pop();
  return `<span class="loot-cin-claim loot-cin-claim--ruzie">
    ${c.map(_lootCinPortret).join('')} <strong>${namen.join(', ')} en ${laatste}</strong> maken ruzie om de buit</span>`;
}

function _lootCinBuit(data) {
  const el = document.getElementById('loot-cin-buit');
  if (!el) return;
  if (data.mimic) {
    el.innerHTML = `
      <div class="loot-cin-mimic">
        <div class="loot-cin-mimic-kop">Het is geen kist.</div>
        <p class="loot-cin-mimic-tekst">${esc(data.naam || 'De kist')} heeft tanden${data.encounterNaam ? ` — <strong>${esc(data.encounterNaam)}</strong>` : ''}.</p>
      </div>`;
    return;
  }
  const bedrag = _lootCinBedrag(data.goud);
  const items  = (data.items || []).filter(it => it.status !== 'overgeslagen');
  el.innerHTML = `
    ${bedrag ? `<div class="loot-cin-goud">${icon('coins')} ${bedrag}</div>` : ''}
    <ul class="loot-cin-items">
      ${items.map(it => `
        <li class="loot-cin-item">
          <div class="loot-cin-item-kop">
            <span class="loot-cin-item-naam">${esc(it.naam)}</span>
            ${it.rariteit ? `<span class="loot-cin-rar" data-rarity="${esc(String(it.rariteit).toLowerCase().replace(/\s+/g, '-'))}">${esc(it.rariteit)}</span>` : ''}
          </div>
          ${it.bron ? `<div class="loot-cin-bron">${esc(it.bron)}</div>` : ''}
          ${_lootCinClaimRegel(it)}
        </li>`).join('') || '<li class="loot-cin-item loot-cin-item--leeg">Alleen munten.</li>'}
    </ul>`;
}

window._lootCinematic = (data = {}) => {
  let ov = document.getElementById('loot-cinematic');
  if (!ov) {
    _lootCinOpen = false;
    ov = document.createElement('div');
    ov.id = 'loot-cinematic';
    ov.className = 'loot-cin';
    ov.innerHTML = `
      <div class="loot-cin-scene">
        <div class="loot-cin-kistwrap">
          <button class="loot-cin-kist" id="loot-cin-open" type="button">
            <img src="/assets/loot-kist-dicht.jpg" alt="Een gesloten schatkist">
            <span class="loot-cin-hint">${icon('mouse-pointer-2')} Tik om te openen</span>
          </button>
          <video class="loot-cin-video" id="loot-cin-video" playsinline muted preload="auto"
            src="/assets/loot-kist.mp4"></video>
        </div>
        <div class="loot-cin-buit" id="loot-cin-buit"></div>
      </div>`;
    document.body.appendChild(ov);

    const kist  = ov.querySelector('#loot-cin-open');
    const video = ov.querySelector('#loot-cin-video');
    kist.addEventListener('click', () => {
      kist.classList.add('loot-cin-kist--weg');
      video.classList.add('loot-cin-video--aan');
      // Stil afspelen: het onthullingsgeluid komt uit de geluidenbibliotheek,
      // niet uit de videotrack — anders lopen ze door elkaar.
      video.play().catch(() => { /* geen autoplay: dan blijft het laatste beeld staan */ });
      video.addEventListener('ended', () => {
        ov.classList.add('loot-cin--open');
        _lootCinOpen = true;
        _lootCinBuit(ov._data || {});
      }, { once: true });
    });
  }
  ov._data = data;
  if (_lootCinOpen) _lootCinBuit(data);
  // Na de uitslag mag het scherm weer terug naar de sfeer; de tafel heeft dan
  // gezien wie wat kreeg.
  if (data.afgerond) setTimeout(() => window._lootCinematicSluit?.(), 14000);
};

window._lootCinematicSluit = () => {
  document.getElementById('loot-cinematic')?.remove();
  _lootCinOpen = false;
};

window._briefCinematic = (msg) => {
  document.getElementById('brief-cinematic')?.remove();
  const kleur = _factieKleurHex(msg.kleur);
  const emb   = msg.embleem || (msg.thema ? 'mail' : 'landmark');
  const naam  = msg.kop || msg.afzender || 'onbekend';
  const isDisplay = !!window._isDisplayMode;
  const ov = document.createElement('div');
  ov.id = 'brief-cinematic';
  ov.className = `brief-cinematic-overlay${msg.thema ? ` brief-cinematic-overlay--${esc(msg.thema)}` : ''}`;
  ov.style.setProperty('--brief-kleur', kleur);
  ov.innerHTML = `
    <div class="brief-cinematic-scene">
      <!-- Fase 1: verzegelde envelop -->
      <div class="brief-cinematic-sealed">
        <div class="brief-cinematic-brief">
          <button class="brief-cinematic-zegel" title="Klik om te openen">${icon(emb)}</button>
        </div>
        <div class="brief-cinematic-tekst">
          <div class="brief-cinematic-kop">Een verzegelde brief is bezorgd</div>
          <div class="brief-cinematic-sub">van <strong>${esc(naam)}</strong></div>
          <div class="brief-cinematic-hint">klik op het zegel om te openen</div>
        </div>
      </div>
      <!-- Fase 2: volledige brief -->
      <div class="brief-cinematic-open hidden">
        <div class="brief-cinematic-letter">
          ${msg.titel ? `<div class="brief-cinematic-letter-titel">${esc(msg.titel)}</div>` : ''}
          ${msg.afzender ? `<div class="brief-cinematic-letter-van">van <em>${esc(msg.afzender)}</em>${msg.datum ? ` · ${esc(msg.datum)}` : ''}</div>` : ''}
          <div class="brief-cinematic-letter-tekst">${esc(msg.tekst || '')}</div>
        </div>
        ${!isDisplay ? `<button class="brief-cinematic-knop">${icon('mail')} Bewaar in Berichten</button>` : ''}
        <div class="brief-cinematic-hint">klik buiten de brief om te sluiten</div>
      </div>
    </div>`;
  const openLetter = () => {
    clearTimeout(autoT);
    ov.querySelector('.brief-cinematic-sealed')?.classList.add('hidden');
    ov.querySelector('.brief-cinematic-open')?.classList.remove('hidden');
    ov.classList.add('brief-cinematic-overlay--geopend');
  };
  const dismiss = (goBerichten) => {
    if (ov.dataset.dicht) return; ov.dataset.dicht = '1';
    clearTimeout(autoT);
    ov.classList.add('brief-cinematic-overlay--uit');
    setTimeout(() => ov.remove(), 420);
    if (goBerichten) { window.app.switchSection('mijn-karakter'); window._setPlayerSubTab?.('berichten'); }
  };
  // Op de tablet blijft de verzegelde brief staan tot iemand het zegel opent; op een
  // eigen spelerscherm sluit hij na 12s vanzelf als er niets mee gebeurt.
  const autoT = isDisplay ? null : setTimeout(() => dismiss(false), 12000);
  ov.addEventListener('click', (e) => {
    if (e.target.closest('.brief-cinematic-zegel')) { openLetter(); return; }
    if (e.target.closest('.brief-cinematic-knop'))  { dismiss(true); return; }
    if (e.target.closest('.brief-cinematic-letter')) return; // klik in de brief zelf sluit niet
    // Verzegelde fase: alleen het zegel opent — een mis-klik naast het zegel sluit
    // NIET (voorkomt per ongeluk wegtikken, vooral op de tablet). Pas ná openen sluit
    // een klik buiten de brief de cinematic.
    if (!ov.classList.contains('brief-cinematic-overlay--geopend')) return;
    dismiss(false);
  });
  document.body.appendChild(ov);
  setTimeout(_briefCinematicSound, 650);
};

// ── Hit Dice (afgeleid uit klasse + level, incl. multiklasse) ────────────────
const CLASS_HIT_DIE = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10, sorcerer: 6, wizard: 6,
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
};
function _clientHitDicePool(profile) {
  const p = profile || {};
  const pool = {};
  const add = (klasse, lvl) => {
    const n = parseInt(lvl);
    const sides = CLASS_HIT_DIE[String(klasse || '').trim().toLowerCase()];
    if (sides && n > 0) pool[sides] = (pool[sides] || 0) + n;
  };
  add(p.klasse, p.klasseLevel ?? p.level);
  if ((p.multiclass === true || p.multiclass === 'true') && p.multiKlasse) add(p.multiKlasse, p.multiKlasseLevel);
  if (Object.keys(pool).length === 0) {
    const m = String(p.hitDie || '').match(/d(\d+)/i);
    pool[m ? parseInt(m[1]) : 8] = parseInt(p.level ?? p.klasseLevel) || 1;
  }
  return pool;
}
// Korte samenvatting voor het stats-grid, bijv. "d10×3 · d6×2"
function _hitDiceKort(profile) {
  const pool = _clientHitDicePool(profile);
  const sides = Object.keys(pool).map(Number).sort((a, b) => b - a);
  if (!sides.length) return '—';
  return sides.map(s => `d${s}×${pool[s]}`).join(' · ');
}
// Hit Dice-dots-rij op de character sheet (totaal/verbruikt). spent async geladen.
function _hitDiceDotsHtml(pool, spent) {
  const sides = Object.keys(pool).map(Number).sort((a, b) => b - a);
  if (!sides.length) return '';
  return sides.map(s => {
    const totaal = pool[s], vrij = totaal - ((spent || {})[s] || 0);
    const dots = Array.from({ length: totaal }, (_, i) => `<span class="hd-dot ${i < vrij ? 'vrij' : 'gebruikt'}"></span>`).join('');
    return `<span class="player-hd-groep"><span class="player-hd-type">d${s}</span>${dots}</span>`;
  }).join('');
}
window._loadSheetHitDice = async function(charId, profile) {
  const wrap = document.getElementById('player-dash-hd-' + charId);
  if (!wrap) return;
  const pool = _clientHitDicePool(profile);
  let spent = {};
  try { const r = await api.getHitDice(charId); spent = r.spent || {}; } catch { /* dots tonen als vrij */ }
  wrap.innerHTML = _hitDiceDotsHtml(pool, spent);
};

// ── Rust-cinematic (party-breed, DM-getriggerd) ──────────────────────────────
function _rustHitDicePaneel(charId, hd) {
  const pool = hd.pool || {}, spent = hd.spent || {};
  const sides = Object.keys(pool).map(Number).sort((a, b) => b - a);
  if (!sides.length) return '';
  const conMod = hd.conMod || 0;
  const conStr = conMod ? ` <span class="rust-hd-con">(${conMod >= 0 ? '+' : ''}${conMod} CON per worp)</span>` : '';
  const rows = sides.map(s => {
    const totaal = pool[s], vrij = totaal - (spent[s] || 0);
    const dots = Array.from({ length: totaal }, (_, i) => `<span class="hd-dot ${i < vrij ? 'vrij' : 'gebruikt'}"></span>`).join('');
    return `<div class="rust-hd-rij" data-sides="${s}">
      <span class="rust-hd-type">d${s}</span>
      <span class="rust-hd-dots">${dots}</span>
      <button class="rust-hd-besteed" ${vrij <= 0 ? 'disabled' : ''} onclick="window._rustSpendHitDie('${esc(charId)}',${s})">${icon('dice')} Besteed</button>
    </div>`;
  }).join('');
  return `<div class="rust-hd-paneel">
    <div class="rust-hd-kop">${icon('heart')} Hit Dice besteden${conStr}</div>
    ${rows}
    <div class="rust-hd-feedback" id="rust-hd-feedback"></div>
  </div>`;
}
window._rustSpendHitDie = async function(charId, sides) {
  const fb = document.getElementById('rust-hd-feedback');
  try {
    const r = await api.spendHitDie(charId, 'd' + sides);
    const modStr = r.conMod ? ` ${r.conMod >= 0 ? '+' : ''}${r.conMod}` : '';
    if (fb) fb.innerHTML = `${icon('dice')} ${r.rolled}${modStr} = +${r.heal} HP → <strong>${r.hp.current}${r.hp.max != null ? '/' + r.hp.max : ''}</strong>`;
    document.querySelectorAll('.rust-hd-rij').forEach(row => {
      const s = Number(row.dataset.sides);
      const totaal = (r.hitDice.pool || {})[s] || 0, vrij = totaal - ((r.hitDice.spent || {})[s] || 0);
      const dotsEl = row.querySelector('.rust-hd-dots');
      if (dotsEl) dotsEl.innerHTML = Array.from({ length: totaal }, (_, i) => `<span class="hd-dot ${i < vrij ? 'vrij' : 'gebruikt'}"></span>`).join('');
      const btn = row.querySelector('.rust-hd-besteed');
      if (btn) btn.disabled = vrij <= 0;
    });
  } catch (err) {
    if (fb) fb.textContent = err.message || 'Geen Hit Dice meer';
  }
};
// Actuele maanfase uit de datum (synodische maand). illum 0=nieuw → 1=vol.
function _moonPhase(date = new Date()) {
  const synodic = 29.53058867;
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0) / 86400000; // bekende nieuwe maan, in dagen
  let frac = (((date.getTime() / 86400000) - ref) / synodic) % 1;
  if (frac < 0) frac += 1;
  return { frac, illum: (1 - Math.cos(2 * Math.PI * frac)) / 2, waxing: frac < 0.5 };
}
const _MOON_NAAM = ['Nieuwe maan', 'Wassende sikkel', 'Eerste kwartier', 'Wassende maan', 'Volle maan', 'Afnemende maan', 'Laatste kwartier', 'Afnemende sikkel'];
function _moonFaseNaam(frac) { return _MOON_NAAM[Math.round(frac * 8) % 8]; }
// SVG-maan met correcte terminator voor de actuele fase.
function _moonSvg(size = 70) {
  const { frac, waxing } = _moonPhase();
  const R = size / 2, cx = R, cy = R, r = R - 2;
  const cosA = Math.cos(2 * Math.PI * frac);
  const rx = Math.max(0.5, r * Math.abs(cosA));
  const gibbous = cosA < 0;
  // Lit-pad: halve cirkel (lit-limb) + halve ellips (terminator). Bij een sikkel volgt de terminator
  // dezelfde bocht als de limb (dunne sikkel); bij gibbous de tegengestelde (groot lit-vlak).
  const limbSweep = waxing ? 1 : 0;
  const termSweep = gibbous ? limbSweep : (1 - limbSweep);
  const top = `${cx} ${cy - r}`, bot = `${cx} ${cy + r}`;
  const litPath = `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bot} A ${rx} ${r} 0 0 ${termSweep} ${top} Z`;
  return `<svg class="rust-maan-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a2a38"/>
    <path d="${litPath}" fill="url(#moonGrad)"/>
    <defs><radialGradient id="moonGrad" cx="40%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#fff7e0"/><stop offset="60%" stop-color="#e8d9a8"/><stop offset="100%" stop-color="#b8a06a"/>
    </radialGradient></defs>
  </svg>`;
}

window._rustCinematic = (payload) => {
  if (!payload) return;
  document.getElementById('rust-cinematic')?.remove();
  const { type, locatie, backdropId, loopFileId, roddels = [], perPlayer = {}, herbergNaam, gebeurtenissen = [] } = payload;
  const isLong = type === 'long';
  const isDisplay = !!window._isDisplayMode;
  const isDM = !!window.app?.isDM?.();
  const myCharId = window.app?.state?.characterId;
  // Op het gedeelde tafelscherm (geen eigen karakter) tonen we een party-brede variant.
  const mine = (!isDisplay && myCharId) ? perPlayer[myCharId] : null;

  const ov = document.createElement('div');
  ov.id = 'rust-cinematic';
  ov.className = `rust-cinematic-overlay rust-cinematic--${isLong ? 'lang' : 'kort'} rust-cinematic--${esc(locatie || 'veld')}${backdropId ? ' rust-cinematic--has-bg' : ''}`;
  if (backdropId) ov.style.setProperty('--rust-bg', `url('${api.fileUrl(backdropId)}')`);

  const maanNaam = isLong ? _moonFaseNaam(_moonPhase().frac) : '';
  const sceneEl = isLong
    ? `<div class="rust-maan" title="${esc(maanNaam)}">${_moonSvg(70)}</div>${maanNaam ? `<div class="rust-maan-naam">${esc(maanNaam)}</div>` : ''}`
    : `<div class="rust-vuur">${icon('zap')}</div>`;
  const titel = isLong
    ? (locatie === 'herberg' ? `Een nacht in ${esc(herbergNaam || 'de herberg')}` : 'Een lange rust onder de sterren')
    : (locatie === 'herberg' ? `Even op adem in ${esc(herbergNaam || 'de herberg')}` : 'Even op adem komen');

  let samenvatting = '';
  if (mine && isLong) {
    const parts = [];
    if (mine.hpNaar != null) parts.push(`${icon('heart')} HP volledig hersteld`);
    if (mine.slotsHersteld) parts.push(`${icon('sparkles')} ${mine.slotsHersteld} spell slot(s) terug`);
    if (mine.hitDiceTerug) parts.push(`${icon('dice')} ${mine.hitDiceTerug} Hit Dice terug`);
    if (mine.chargesHersteld) parts.push(`${icon('zap')} ${mine.chargesHersteld} voorwerp(en) herladen`);
    if (parts.length) samenvatting = `<ul class="rust-samenvatting">${parts.map(p => `<li>${p}</li>`).join('')}</ul>`;
  } else if (mine && !isLong) {
    const parts = [];
    if (mine.chargesHersteld) parts.push(`${icon('zap')} ${mine.chargesHersteld} voorwerp(en) herladen`);
    if (mine.pactReset) parts.push(`${icon('sparkles')} Pact-slots terug`);
    if (parts.length) samenvatting = `<ul class="rust-samenvatting">${parts.map(p => `<li>${p}</li>`).join('')}</ul>`;
  } else if (isDisplay) {
    const langRegel = locatie === 'herberg'
      ? 'De groep trekt zich terug op de kamers en rust de nacht door.'
      : 'De groep slaat de tent op en rust de nacht door.';
    samenvatting = `<p class="rust-party-regel">${isLong ? langRegel : 'De groep komt even op adem.'}</p>`;
  }

  let roddelHtml = '';
  if (isLong && roddels.length) {
    roddelHtml = `<div class="rust-roddels">
      <div class="rust-roddels-kop">${icon('message-circle')} Wat je opving deze nacht</div>
      ${roddels.map(r => `<div class="rust-roddel-kaart"><p class="rust-roddel-tekst">„${esc(r.flavour)}”</p><p class="rust-roddel-bron">— over ${esc(r.name)}</p></div>`).join('')}
    </div>`;
  }

  // d100-rustgebeurtenis (lange rust) — per speler een eigen voorval
  const _muntStr = c => c ? ` <span class="rust-event-munt-inline">(${c.bedrag >= 0 ? '+' : ''}${c.bedrag} ${esc(c.unit)})</span>` : '';
  let eventHtml = '';
  if (isLong && !isDisplay && mine?.gebeurtenis?.tekst) {
    const g = mine.gebeurtenis;
    const muntStr = g.currency ? `<p class="rust-event-munt">${g.currency.bedrag >= 0 ? '+' : ''}${g.currency.bedrag} ${esc(g.currency.unit)} voor jou</p>` : '';
    eventHtml = `<div class="rust-event">
      <div class="rust-event-kop">${icon('dice')} Deze nacht</div>
      <p class="rust-event-tekst">${esc(g.tekst)}</p>${muntStr}
    </div>`;
  } else if (isLong && isDisplay && gebeurtenissen.length) {
    eventHtml = `<div class="rust-event">
      <div class="rust-event-kop">${icon('dice')} Deze nacht</div>
      ${gebeurtenissen.map(g => `<p class="rust-event-tekst"><strong>${esc(g.naam)}:</strong> ${esc(g.tekst)}${_muntStr(g.currency)}</p>`).join('')}
    </div>`;
  }

  const hitDiceHtml = (!isLong && mine?.hitDice) ? _rustHitDicePaneel(myCharId, mine.hitDice) : '';

  ov.innerHTML = `
    <div class="rust-cinematic-scene">
      ${sceneEl}
      <div class="rust-cinematic-kop">${titel}</div>
      ${samenvatting}
      ${hitDiceHtml}
      ${eventHtml}
      ${roddelHtml}
      <button class="rust-cinematic-sluit">${(!isLong && hitDiceHtml) ? 'Klaar met rusten' : (isDM ? 'Sluiten voor iedereen' : 'Sluiten')}</button>
      <div class="rust-cinematic-hint">${isDM
        ? 'sluit het rustscherm bij iedereen — ook op de tablet'
        : 'sluit alleen jouw scherm'}</div>
    </div>`;

  // Lokaal sluiten: overlay weg én de rustloop stoppen. Er is bewust géén timer
  // meer — met een reeks onthulde roddels las niemand het op tijd. De DM bepaalt
  // wanneer het weg mag; een speler kan zijn eigen scherm wegklikken.
  const dismiss = () => {
    if (ov.dataset.dicht) return; ov.dataset.dicht = '1';
    window.soundManager?.stopRestLoop?.();
    ov.classList.add('rust-cinematic-overlay--uit');
    setTimeout(() => ov.remove(), 420);
    if (window._rustSluitLokaal === dismiss) window._rustSluitLokaal = null;
  };
  // Sluit de overlay op álle schermen. Alleen de DM doet dit; de tablet heeft
  // niemand die erop klikt, dus die moet van buitenaf dicht kunnen.
  const dismissAlles = () => { api.closeRest().catch(() => {}); dismiss(); };

  // Haak voor de socket: een 'party:rest-close' van de DM sluit dit scherm.
  window._rustSluitLokaal = dismiss;

  if (loopFileId) window.soundManager?.playRestLoop?.(loopFileId);
  const sluitActie = isDM ? dismissAlles : dismiss;
  ov.querySelector('.rust-cinematic-sluit')?.addEventListener('click', sluitActie);
  // Klik buiten de scene sluit ook; alleen de interactieve korte rust met het
  // Hit Dice-paneel blijft staan, zodat je daar niet per ongeluk uit klikt.
  ov.addEventListener('click', (e) => {
    if (!e.target.closest('.rust-cinematic-scene') && (isLong || !hitDiceHtml)) sluitActie();
  });
  document.body.appendChild(ov);
};

// Van buitenaf (socket) het rustscherm sluiten.
window._rustSluit = () => { window._rustSluitLokaal?.(); };

window._updateBerichtenBadge = function() {
  const count = window._berichtenUnread || 0;
  const btn = document.querySelector('.player-subtab[data-tab="berichten"]');
  if (!btn) return;
  const existing = btn.querySelector('.bericht-badge');
  if (count > 0) {
    if (existing) existing.textContent = count;
    else btn.insertAdjacentHTML('beforeend', ` <span class="bericht-badge">${count}</span>`);
  } else {
    existing?.remove();
  }
};

// Spelervriendelijke uitleg + icoon per status (NL). Gedeeld door renderMijnKarakter
// en de tap-popover window._condInfo.
const PLAYER_COND_INFO = {
  blinded:       { label: 'Verblind',       desc: 'Kan niet zien. Aanvallen tegen jou hebben voordeel; jouw aanvallen hebben nadeel.' },
  charmed:       { label: 'Betoverd',       desc: 'Je kunt de betoveraar niet aanvallen. Die heeft voordeel op sociale checks tegen jou.' },
  deafened:      { label: 'Doof',           desc: 'Kan niet horen. Faalt automatisch checks die gehoor vereisen.' },
  exhaustion:    { label: 'Uitputting',     desc: 'Stapelt in 6 niveaus: 1 nadeel op checks · 2 snelheid gehalveerd · 3 nadeel op saves · 4 snelheid 0 · 5 nadeel op aanvallen · 6 dood.' },
  frightened:    { label: 'Bevreesd',       desc: 'Nadeel op checks en aanvallen zolang de bron in zicht is. Je kunt niet vrijwillig dichterbij komen.' },
  grappled:      { label: 'Vastgegrepen',   desc: 'Snelheid wordt 0. Eindigt als de grijper buiten gevecht raakt of je buiten bereik komt.' },
  incapacitated: { label: 'Buiten gevecht', desc: 'Kan geen acties of reacties nemen.' },
  invisible:     { label: 'Onzichtbaar',    desc: 'Kan niet gezien worden. Aanvallen tegen jou hebben nadeel; jouw aanvallen hebben voordeel.' },
  paralyzed:     { label: 'Verlamd',        desc: 'Buiten gevecht, kan niet bewegen of spreken. Faalt STR/DEX-saves. Aanvallen hebben voordeel; treffers binnen 1,5 m zijn kritiek.' },
  petrified:     { label: 'Versteend',      desc: 'Veranderd in steen. Buiten gevecht. Resistent tegen alle schade. Immuun voor gif en ziekte.' },
  poisoned:      { label: 'Vergiftigd',     desc: 'Nadeel op aanvallen en ability checks.' },
  prone:         { label: 'Neergevallen',   desc: 'Nadeel op aanvallen. Aanvallen binnen 1,5 m hebben voordeel, van verder weg nadeel. Opstaan kost de helft van je snelheid.' },
  restrained:    { label: 'Vastgehouden',   desc: 'Snelheid wordt 0. Nadeel op aanvallen en DEX-saves. Aanvallen tegen jou hebben voordeel.' },
  stunned:       { label: 'Verdoofd',       desc: 'Buiten gevecht, kan niet bewegen, spreekt hooguit haperend. Faalt STR/DEX-saves. Aanvallen tegen jou hebben voordeel.' },
  unconscious:   { label: 'Bewusteloos',    desc: 'Buiten gevecht, neergevallen en niet bij bewustzijn. Faalt STR/DEX-saves. Aanvallen hebben voordeel; treffers binnen 1,5 m zijn kritiek.' },
  concentration: { label: 'Concentratie',   desc: 'Je concentreert op een spreuk. Eindigt bij schade (CON-save, DC 10 of de helft van de schade) of buiten gevecht raken.' },
  bleeding:      { label: 'Bloedend',       desc: 'Verliest bloed: 1d4 schade aan het begin van elke beurt. Eindigt bij genezing of een geslaagde Medicijnen-check (DC 10).' },
  burning:       { label: 'In brand',       desc: 'In brand: 1d6 vuurschade aan het begin van elke beurt. Een actie kan de vlammen doven.' },
};
// Welke statussen een icoon hebben in /img/conditions/
const PLAYER_COND_ICONS = new Set(Object.keys(PLAYER_COND_INFO));

// Tap op een status-chip toont/verbergt de uitleg eronder
window._condInfo = function(cid) {
  const box = document.getElementById('player-cond-detail');
  if (!box) return;
  document.querySelectorAll('.player-dash-cond-chip').forEach(c =>
    c.classList.toggle('player-dash-cond-chip--active', c.dataset.cid === cid && box.dataset.cid !== cid));
  if (box.dataset.cid === cid) { box.classList.add('hidden'); box.dataset.cid = ''; return; }
  const info = PLAYER_COND_INFO[cid] || { label: cid, desc: 'Geen beschrijving beschikbaar.' };
  const hasIcon = PLAYER_COND_ICONS.has(cid);
  box.dataset.cid = cid;
  box.innerHTML = `
    ${hasIcon ? `<img src="/img/conditions/${cid}.png" class="player-cond-detail-icon" alt="">` : ''}
    <div class="player-cond-detail-text">
      <div class="player-cond-detail-title">${esc(info.label)}</div>
      <div class="player-cond-detail-desc">${esc(info.desc)}</div>
    </div>`;
  box.classList.remove('hidden');
};

// ════════════════════════════════════════════════════════════
// SIGNATUUR-KAART — klasse-eigen kernfeature bovenaan Personage
// Uitbreidbaar per klasse; start met Barbarian/Rage. Beschrijving
// komt uit de progressie-data (single source of truth).
// ════════════════════════════════════════════════════════════
const _SIGNATURE = {
  barbarian: {
    feature: 'Rage', icon: 'crossed-swords', iconGi: true, key: 'rage', kleur: '#b3402a',
    activeOff: 'Activeer Rage', activeOn: 'Razend',
    naslag: 'Resistance tegen Bludgeoning, Piercing & Slashing damage; Advantage op Strength checks & saves.',
    uses: { 1: 2, 3: 3, 6: 4, 10: 5, 17: 6 },
    extra: lvl => `Rage Damage +${_sigThresh({ 1: 2, 9: 3, 16: 4 }, lvl)}`,
  },
};
function _sigThresh(table, level) {
  let v = 0;
  for (const t of Object.keys(table).map(Number).sort((a, b) => a - b)) if ((level || 0) >= t) v = table[t];
  return v;
}
function _findClassFeatureDesc(progData, classKey, featureName) {
  const cls = progData?.classes?.[classKey];
  if (!cls) return '';
  const nn = String(featureName).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const arr of Object.values(cls.levels || {}))
    for (const f of (arr || [])) if (String(f.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === nn) return f.desc || '';
  return '';
}
function _sigReadState(pp) { try { return JSON.parse(pp?.signatureState || '{}'); } catch { return {}; } }
function _sigCfgFor(klasse) { return _SIGNATURE[String(klasse || '').toLowerCase()]; }
function _sigCurMax(cfg, pp, level) {
  const st = _sigReadState(pp)[cfg.key] || {};
  const auto = _sigThresh(cfg.uses, level) || 0;
  return (st.maxOverride != null && String(st.maxOverride) !== '') ? (parseInt(st.maxOverride) || 0) : auto;
}

function _renderSignatureCard(klasse, level, progData, pp) {
  const cfg = _sigCfgFor(klasse);
  if (!cfg) return '';
  const lvl = parseInt(level) || 0;
  const st = _sigReadState(pp)[cfg.key] || {};
  const max = _sigCurMax(cfg, pp, lvl);
  const used = Math.min(st.used || 0, max);
  const remaining = max - used;
  const active = !!st.active;
  const desc = _findClassFeatureDesc(progData, _progClassKey(progData, klasse), cfg.feature);
  const dots = max > 0
    ? Array.from({ length: max }, (_, i) => `<button class="sig-dot${i < used ? ' used' : ''}" onclick="window._sigToggleUse(${i})" title="${i < used ? 'Verbruikt — klik om vrij te geven' : 'Vrij — klik om te verbruiken'}"></button>`).join('')
    : '<span class="sig-none">—</span>';
  return `
  <div class="sig-card${active ? ' sig-card--active' : ''}" style="--sig-kleur:${cfg.kleur}">
    <div class="sig-card-head">
      <span class="sig-card-icon">${icon(cfg.icon, cfg.iconGi ? { cls: 'icon-gi' } : {})}</span>
      <span class="sig-card-name">${esc(cfg.feature)}</span>
      <span class="sig-card-tag">Signatuur · ${esc(klasse)}</span>
      ${desc ? `<button class="sig-card-info" onclick="window._sigToggleInfo()" title="Volledige uitleg">${icon('book-open')}</button>` : ''}
      <button class="sig-card-reset" onclick="window._sigReset()" title="Herstel na Long Rest">${icon('refresh-cw')}</button>
    </div>
    <div class="sig-card-body">
      <button class="sig-toggle${active ? ' on' : ''}" onclick="window._sigToggleActive()">
        ${active ? icon('check') + ' ' + esc(cfg.activeOn) : esc(cfg.activeOff)}
      </button>
      <div class="sig-uses">
        <div class="sig-dots">${dots}</div>
        <button class="sig-uses-count" onclick="window._sigEditMax()" title="Maximum aanpassen (leeg = automatisch)">${remaining} / ${max}</button>
      </div>
    </div>
    <div class="sig-card-extra">${cfg.extra ? esc(cfg.extra(lvl)) + ' · ' : ''}${esc(cfg.naslag)}</div>
    ${desc ? `<div class="sig-card-desc hidden" id="sig-card-desc">${mdToHtml(desc)}</div>` : ''}
  </div>`;
}

function _sigRefreshDynamic() {
  const pp = window._lastPlayerProfile || {};
  const cfg = _sigCfgFor(pp.klasse) || _sigCfgFor(pp.multiKlasse);
  const card = document.querySelector('.sig-card');
  if (!cfg || !card) return;
  const lvl = parseInt(pp.klasseLevel) || parseInt(pp.level) || 0;
  const st = _sigReadState(pp)[cfg.key] || {};
  const max = _sigCurMax(cfg, pp, lvl);
  const used = Math.min(st.used || 0, max);
  card.classList.toggle('sig-card--active', !!st.active);
  const dotsEl = card.querySelector('.sig-dots');
  if (dotsEl) dotsEl.innerHTML = max > 0
    ? Array.from({ length: max }, (_, i) => `<button class="sig-dot${i < used ? ' used' : ''}" onclick="window._sigToggleUse(${i})"></button>`).join('')
    : '<span class="sig-none">—</span>';
  const cnt = card.querySelector('.sig-uses-count');
  if (cnt) cnt.textContent = `${max - used} / ${max}`;
  const tog = card.querySelector('.sig-toggle');
  if (tog) { tog.classList.toggle('on', !!st.active); tog.innerHTML = st.active ? icon('check') + ' ' + esc(cfg.activeOn) : esc(cfg.activeOff); }
}
async function _sigMutate(fn) {
  const pp = window._lastPlayerProfile;
  const cfg = _sigCfgFor(pp?.klasse) || _sigCfgFor(pp?.multiKlasse);
  if (!pp || !cfg) return;
  const lvl = parseInt(pp.klasseLevel) || parseInt(pp.level) || 0;
  const all = _sigReadState(pp);
  const st = all[cfg.key] || {};
  fn(st, _sigCurMax(cfg, pp, lvl));
  all[cfg.key] = st;
  pp.signatureState = JSON.stringify(all);
  _sigRefreshDynamic();
  if (window._lastCharId) { try { await api.patchPlayerProfile(window._lastCharId, { signatureState: pp.signatureState }); } catch {} }
}
window._sigToggleActive = () => _sigMutate((st, max) => {
  if (!st.active) { st.active = true; if (max > 0) st.used = Math.min((st.used || 0) + 1, max); }
  else st.active = false;
});
window._sigToggleUse = (i) => _sigMutate((st, max) => { const used = Math.min(st.used || 0, max); st.used = i < used ? i : i + 1; });
window._sigReset = () => _sigMutate(st => { st.used = 0; st.active = false; });
window._sigToggleInfo = () => document.getElementById('sig-card-desc')?.classList.toggle('hidden');
window._sigEditMax = () => {
  const pp = window._lastPlayerProfile;
  const cfg = _sigCfgFor(pp?.klasse) || _sigCfgFor(pp?.multiKlasse);
  if (!pp || !cfg) return;
  const lvl = parseInt(pp.klasseLevel) || parseInt(pp.level) || 0;
  const auto = _sigThresh(cfg.uses, lvl) || 0;
  const cur = (_sigReadState(pp)[cfg.key] || {}).maxOverride ?? '';
  const v = prompt(`Maximaal aantal ${cfg.feature}-uses?\n(laat leeg voor automatisch op basis van level: ${auto})`, String(cur));
  if (v === null) return;
  const t = v.trim();
  _sigMutate(st => { if (t === '') delete st.maxOverride; else st.maxOverride = Math.max(0, parseInt(t) || 0); });
};

async function renderMijnKarakter(opts = {}) {
  // Flush pending currency save only if user has typed a change (dirty)
  if (typeof window._dashCurrencyFlush === 'function') await window._dashCurrencyFlush();
  const charId     = opts.charId     || state.characterId;
  const playerName = opts.playerName || state.playerName;
  const el         = opts.el         || document.getElementById('section-mijn-karakter');
  if (!el) return;
  // #33: pauzeer en verwijder een nog-spelende portret-video vóór re-render
  el.querySelector('.portrait-inline-video')?.pause();
  if (!playerName || !charId) {
    el.innerHTML = '<div class="p-8 text-center text-ink-dim italic font-fell">Kies eerst een karakter om dit dashboard te zien.</div>';
    return;
  }
  // Allow inline HTML event handlers to re-render with same opts
  window._reRenderKarakter = () => renderMijnKarakter(opts);


  // Laad data parallel
  let hpData = { current: null, max: null };
  let entity  = null;
  let combat  = null;
  let ownershipData = { owners: {}, requests: [] };
  let allVoorwerpen = [];
  let soundsData    = { emotes: {} };
  let simpleItems   = [];
  let currency      = { fl: 0, kn: 0, cl: 0 };
  let partyCurrency = { enabled: false, fl: 0, kn: 0, cl: 0 };
  let spellSlots    = {};
  let playerProfile = {};
  let partyMembers  = [];
  let companions    = [];
  let trackers      = [];
  let pinnedSpells  = [];
  let pinnedTraits  = [];
  let inspired      = false;
  let berichtenLijst = [];
  let heerenData = null;
  let factiesData = [];
  let progData = null;
  let ontdekkingenData = null;
  let lootData = null;
  try {
    [hpData, entity, combat, ownershipData, allVoorwerpen, soundsData, simpleItems, currency, partyCurrency, spellSlots, playerProfile, partyMembers, companions, trackers, pinnedSpells, pinnedTraits, { inspired }, berichtenLijst, heerenData, factiesData, progData, ontdekkingenData, lootData] = await Promise.all([
      api.getPlayerHp(charId).catch(() => ({ current: null, max: null })),
      api.getEntity('personages', charId).catch(() => null),
      api.getCombat().catch(() => null),
      api.getItemOwnership().catch(() => ({ owners: {}, requests: [] })),
      api.listEntities('voorwerpen').catch(() => []),
      fetch('/api/sounds').then(r => r.json()).catch(() => ({ emotes: {} })),
      api.getPlayerItems(charId).catch(() => []),
      api.getPlayerCurrency(charId).catch(() => ({ fl: 0, kn: 0, cl: 0 })),
      api.getPartyCurrency().catch(() => ({ enabled: false, fl: 0, kn: 0, cl: 0 })),
      api.getPlayerSpellSlots(charId).catch(() => ({})),
      api.getPlayerProfile(charId).catch(() => ({})),
      api.getPartyMembers().catch(() => []),
      api.getCompanions().catch(() => []),
      api.getPlayerTrackers(charId).catch(() => []),
      api.getPlayerSpells(charId).catch(() => []),
      api.getPlayerTraits(charId).catch(() => []),
      api.getInspiration(charId).catch(() => ({ inspired: false })),
      api.getBerichten().then(d => d.berichten || []).catch(() => []),
      (window.app?.state?.meta?.heeren ? api.getHeeren().catch(() => null) : Promise.resolve(null)),
      api.getFacties().then(d => d.facties || []).catch(() => []),
      api.progression().catch(() => null),
      (window.app?.isDM?.() ? Promise.resolve(null) : api.ontdekkingen().catch(() => null)),
      api.getLoot().catch(() => null),
    ]);
  } catch { /* ok */ }

  // Wacht op wikilink-naamindex zodat beschrijvingen in knapzak correct renderen
  await (window._entityIndexReady || Promise.resolve()).catch(() => {});

  // Preload spellbook state (used by _openSpellbook and auto-open)
  _sbState.spells           = [...pinnedSpells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  _sbState.favs             = new Set((() => { try { return JSON.parse(playerProfile.spellFavorites || '[]'); } catch { return []; } })());
  _sbState.charId           = charId;
  _sbState.slots            = { ...spellSlots }; // copy so mutations don't affect the closure
  _sbState.spellSaveDC      = playerProfile.spellSaveDC      ?? null;
  _sbState.spellAttackBonus = playerProfile.spellAttackBonus ?? null;
  _sbState.klasse           = playerProfile.klasse || playerProfile.multiKlasse || '';
  _sbState.klasseLevel      = playerProfile.klasseLevel || playerProfile.level || '';

  // Sla unread bericht-teller op (niet resetten als berichten-tab open is)
  const unreadCount = berichtenLijst.filter(m => !m.gelezen).length;
  if (_playerSubTab !== 'berichten') window._berichtenUnread = unreadCount;

  // Sla eigen groep-id op zodat socket-events kunnen filteren
  window._myGroupId = entity?.data?.groep || null;

  // Bookmarks in state cachen zodat renderCard ze kan lezen
  state.bookmarks = Array.isArray(playerProfile.bookmarks) ? playerProfile.bookmarks : [];

  // Sla context op voor lazy-render van het progressie-subtabblad
  window._lastPlayerProfile = playerProfile;
  window._lastPlayerEntity  = entity;
  window._lastCharId        = charId;

  // Geclaimde & stapelbare voorwerpen van deze speler
  const myItemMap = {}; // itemId → { qty }
  for (const [itemId, ownerData] of Object.entries(ownershipData.owners || {})) {
    if (Array.isArray(ownerData)) {
      const entry = ownerData.find(o => o.characterId === charId);
      if (entry && (entry.qty || 1) > 0)
        myItemMap[itemId] = { qty: entry.qty || 1 };
    } else if (ownerData?.characterId === charId) {
      myItemMap[itemId] = { qty: null };
    }
  }
  // Apply itemCharges / itemMaxCharges from ownership data
  const _itemChargesMap    = ownershipData.itemCharges    || {};
  const _itemMaxChargesMap = ownershipData.itemMaxCharges || {};
  const myItems = allVoorwerpen
    .filter(item => item.id in myItemMap)
    .map(item => {
      const d = myItemMap[item.id];
      const baseMax     = parseInt(item.data?.maxCharges) || 0;
      const effectiveMax = (_itemMaxChargesMap[item.id] != null) ? _itemMaxChargesMap[item.id] : baseMax;
      const curCh = effectiveMax > 0 ? (_itemChargesMap[item.id] ?? effectiveMax) : 0;
      return { ...item, _qty: d.qty, _stapelbaar: d.qty !== null, _baseMaxCharges: baseMax, _maxCharges: effectiveMax, _charges: curCh, _rechargeOn: item.data?.rechargeOn || '', _playerMaxAdjustable: item.data?.playerMaxAdjustable === 'true' };
    });

  // Zoek eigen combatant in actief gevecht
  let myCombatant = null;
  if (combat?.active) {
    myCombatant = combat.combatants?.find(
      c => c.entityId === charId || c.name === playerName
    ) || null;
  }

  const hp    = hpData.current ?? myCombatant?.hp ?? '—';
  const maxHp = hpData.max     ?? myCombatant?.maxHp ?? '—';
  const hpNum = typeof hp === 'number' ? hp : null;
  const maxNum = typeof maxHp === 'number' ? maxHp : null;
  const hpPct = (hpNum !== null && maxNum) ? Math.max(0, Math.min(100, (hpNum / maxNum) * 100)) : 0;
  const hpCls = hpPct > 75 ? 'hp-healthy' : hpPct > 50 ? 'hp-lightly' : hpPct > 25 ? 'hp-wounded' : hpPct > 0 ? 'hp-critical' : 'hp-down';
  const tempNum = (typeof hpData.temp === 'number' && hpData.temp > 0) ? hpData.temp : 0;
  const playerBuffs = Array.isArray(hpData.buffs) ? hpData.buffs : [];

  // Actieve conditions (uit gevecht)
  const conditions = myCombatant?.conditions || [];

  // Emote-slots voor deze speler (geconfigureerd door DM) — nieuw model: {library, selected}
  const myEmoteData  = soundsData.emotes?.[charId];
  const emoteLibrary = myEmoteData?.library || [];
  const emoteSelected = myEmoteData?.selected || [];
  // Actieve emotes = de geselecteerde items (max 5) voor gevechtsoverlay
  const activeEmotes = emoteSelected
    .map((eid, idx) => ({ index: idx, item: emoteLibrary.find(e => e.id === eid) }))
    .filter(e => e.item?.label);
  // Alle bibliotheekemotes met label tonen in het personagetabblad
  const displayEmotes = emoteLibrary.filter(e => e.label);

  // Is het momenteel de beurt van deze speler?
  const isMyTurn = combat?.active && myCombatant &&
    (combat.combatants[combat.currentTurn]?.id === myCombatant.id);

  // Ability scores & derived values
  const _ab  = (ab) => parseInt(playerProfile[ab]) || 10;
  const _mod = (ab) => Math.floor((_ab(ab) - 10) / 2);
  const _modStr = (ab) => { const m = _mod(ab); return (m >= 0 ? '+' : '') + m; };
  window._playerDexMod = _mod('dex'); // used by detail view in render-campagne.js
  let _skillProfs = {};
  try { _skillProfs = JSON.parse(playerProfile.skillProfs || '{}'); } catch { _skillProfs = {}; }
  let _skillAdj = {};
  let _extraSpeeds = [];
  try { _skillAdj = JSON.parse(playerProfile.skillAdj || '{}'); } catch { _skillAdj = {}; }
  const _saveProfs  = new Set(Array.isArray(playerProfile.saveProfs) ? playerProfile.saveProfs : (playerProfile.saveProfs || '').split(',').filter(Boolean));
  const _profBonusNum = parseInt(playerProfile.profBonus) || 0;

  // Spell preparation: voorbereid-limiet (auto uit klasse+level+ability, overschrijfbaar)
  {
    const _spLvl   = parseInt(playerProfile.klasseLevel) || parseInt(playerProfile.level) || 0;
    const _spMod   = _mod(_spellAbility(playerProfile.klasse));
    const _autoMax = _preparedLimit(playerProfile.klasse, _spLvl, _spMod);
    const _ovRaw   = playerProfile.preparedMax;
    const _override = (_ovRaw != null && String(_ovRaw).trim() !== '') ? parseInt(_ovRaw) : null;
    _sbState.preparedAuto = _autoMax;
    _sbState.preparedMax  = (_override != null && !isNaN(_override)) ? _override : _autoMax;
  }

  const _percProf     = _skillProfs['perception'] || null;
  const _passivePerc  = 10 + _mod('wis') + (_percProf === 'expert' ? _profBonusNum * 2 : _percProf === 'prof' ? _profBonusNum : 0);
  const _dsSucc = Math.min(3, Math.max(0, parseInt(playerProfile.deathSaveSuccesses) || 0));
  const _dsFail = Math.min(3, Math.max(0, parseInt(playerProfile.deathSaveFailures) || 0));
  const _skillBonus = (skill) => {
    const prof = _skillProfs[skill.key] || null;
    const adj  = _skillAdj[skill.key] || 0;
    return _mod(skill.ab) + (prof === 'expert' ? _profBonusNum * 2 : prof === 'prof' ? _profBonusNum : 0) + adj;
  };
  const _cNames = window._muntNamen();
  const isHp = state.meta?.skillSet === 'hp';

  // Origin- en subclass-opties uit de progressie-data (voorkomt alias-mismatch).
  // Niet voor de HP-variant (House / School of Magic zijn campagne-eigen, niet in de progressie-data).
  const _originOpts   = (!isHp && progData?.species) ? Object.keys(progData.species) : null;
  const _backgroundOpts = (!isHp && progData?.backgrounds && Object.keys(progData.backgrounds).length)
    ? Object.keys(progData.backgrounds).sort() : null;
  const _progClsKey   = _progClassKey(progData, playerProfile.klasse);
  const _subclassOpts = (!isHp && _progClsKey && progData.classes[_progClsKey]?.subclasses)
    ? Object.keys(progData.classes[_progClsKey].subclasses) : null;

  // Wapens & damage cantrips
  let weapons = [];
  try { weapons = JSON.parse(playerProfile.weapons || '[]'); } catch {}

  // Portret
  const imgUrl = api.fileUrl(charId);

  // Multiclass
  const _isMulticlass = playerProfile.multiclass === 'true' || playerProfile.multiclass === true;
  const _kLvl  = parseInt(playerProfile.klasseLevel) || 0;
  const _mkLvl = parseInt(playerProfile.multiKlasseLevel) || 0;
  const _dominantKlasse = (_isMulticlass && playerProfile.multiKlasse && _mkLvl > _kLvl)
    ? playerProfile.multiKlasse : (playerProfile.klasse || '');
  const _klasseStr = _isMulticlass && playerProfile.multiKlasse
    ? `${playerProfile.klasse || '?'} (${playerProfile.klasseLevel || '?'}) / ${playerProfile.multiKlasse} (${playerProfile.multiKlasseLevel || '?'})`
    : entity?.data?.klasse || playerProfile.klasse || '';
  const sub = [entity?.data?.ras, _klasseStr].filter(Boolean).join(' · ');
  const desc = entity?.data?.desc || '';

  // ── Spreukslots HTML helper ──
  const _spellSlotsHTML = (() => {
    const lvls = [1,2,3,4,5,6,7,8,9];
    const rows = lvls.map(lvl => {
      const slot = spellSlots[lvl] || { max: 0, used: 0 };
      if (slot.max === 0 && !spellSlots[lvl]) return '';
      const dots = Array.from({ length: Math.max(slot.max, 0) }, (_, i) => {
        const used = i < slot.used;
        return `<button class="spell-slot-dot ${used ? 'used' : 'free'}"
          title="${used ? 'Verbruikt — klik om vrij te maken' : 'Vrij — klik om te verbruiken'}"
          onclick="window._dashToggleSlot(${lvl}, ${i})"></button>`;
      }).join('');
      return `<div class="player-dash-slot-row">
        <span class="player-dash-slot-level">Niv. ${lvl}</span>
        <div class="player-dash-slot-dots">${dots}</div>
        <span class="player-dash-slot-count">${slot.used}/${slot.max}</span>
        <button class="player-dash-slot-adj" onclick="window._dashSlotAdj(${lvl}, -1)">−</button>
        <button class="player-dash-slot-adj" onclick="window._dashSlotAdj(${lvl}, 1)">+</button>
        <button class="player-dash-slot-del" onclick="window._dashSlotRemove(${lvl})" title="Niveau verwijderen">×</button>
      </div>`;
    }).filter(Boolean).join('');
    return { rows };
  })();

  const _klasseKey = _dominantKlasse.toLowerCase().replace(/\s+/g, '-');
  // Klasse-thema (klasse-afhankelijke CSS) is volledig uitgezet — zowel voor
  // spelers als voor de DM die een spelerstabblad bekijkt. Iedereen ziet de
  // standaard CSS. (Toggle via window._toggleKlasseTheme blijft beschikbaar
  // voor wie het expliciet wil aanzetten.)
  const _themeAttr  = (_klasseThemeOn && _klasseKey) ? ` data-klasse="${esc(_klasseKey)}"` : '';

  el.innerHTML = `
    <div class="player-dashboard"${_themeAttr}>
      <!-- Karakter header (altijd zichtbaar) -->
      <div class="player-dash-hero" id="player-dash-hero" style="align-items:center">
        <div class="player-dash-avatar-outer">
          ${(() => {
            const _hR = 45, _hC = +(2 * Math.PI * 45).toFixed(1);
            const _hFill = hpPct > 0 ? +(_hC * hpPct / 100).toFixed(1) : 0;
            const _hTmpR = 48, _hTmpC = +(2 * Math.PI * 48).toFixed(1);
            const _hTmpFill = (maxNum && tempNum > 0) ? +(_hTmpC * Math.min(tempNum, maxNum) / maxNum).toFixed(1) : 0;
            return `<svg class="player-dash-avatar-ring" viewBox="0 0 100 100" style="pointer-events:none;overflow:visible">
              <circle cx="50" cy="50" r="${_hR}" class="party-hp-ring-bg"/>
              <circle cx="50" cy="50" r="${_hR}" class="party-hp-ring-fill party-hp-ring-${hpCls}"
                stroke-dasharray="${_hFill} ${_hC}" transform="rotate(-90 50 50)"/>
              <circle cx="50" cy="50" r="${_hTmpR}" class="party-hp-ring-temp-bg"/>
              ${_hTmpFill > 0 ? `<circle cx="50" cy="50" r="${_hTmpR}" class="party-hp-ring-temp"
                stroke-dasharray="${_hTmpFill} ${_hTmpC}" transform="rotate(-90 50 50)"/>` : ''}
            </svg>`;
          })()}
          <div class="player-dash-avatar-wrap avatar-${hpCls}" onclick="window._dashOpenPortraitVideo()" style="cursor:pointer">
            <img src="${imgUrl}" class="player-dash-avatar"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="player-dash-avatar-fallback" style="display:none">${icon('user')}</div>
          </div>
        </div>
        <div class="player-dash-hero-info">
          <h2 class="player-dash-name">${esc(playerName)}</h2>
          <button class="player-hero-collapse-btn${localStorage.getItem('_heroCollapsed') === '1' ? ' collapsed' : ''}"
            onclick="window._toggleHeroCollapse()" title="Verberg/toon karakterinfo">▲</button>
          ${sub ? `<p class="player-dash-sub">${esc(sub)}</p>` : ''}
          <div class="player-profile-fields">
            <div class="ppf-row"><label class="ppf-label">Level</label>
              <input class="ppf-input ppf-level" type="number" min="1" max="20"
                value="${esc(playerProfile.level ?? '')}" placeholder="—"
                onchange="window._saveProfileField('level', this.value)"></div>
            <div class="ppf-row"><label class="ppf-label">Class</label>
              <select class="ppf-input ppf-select" id="ppf-klasse-select"
                onchange="window._saveProfileField('klasse', this.value); window._updateMulticlassTheme()">
                <option value="">—</option>
                ${_getKlassen().map(k =>
                  `<option value="${k}"${playerProfile.klasse === k ? ' selected' : ''}>${k}</option>`
                ).join('')}
              </select>
              ${_isMulticlass ? `<input class="ppf-input ppf-level" id="ppf-klasse-level" type="number" min="1" max="20"
                value="${esc(playerProfile.klasseLevel ?? '')}" placeholder="Niv"
                onchange="window._saveProfileField('klasseLevel', this.value); window._updateMulticlassTheme()">` : ''}
              <button class="ppf-multiclass-toggle${_isMulticlass ? ' ppf-multiclass-toggle--active' : ''}"
                onclick="window._toggleMulticlass()"
                title="${_isMulticlass ? 'Multiclass uitschakelen' : 'Multiclass inschakelen'}">⊕</button>
            </div>
            ${_isMulticlass ? `<div class="ppf-row"><label class="ppf-label">Multiclass</label>
              <select class="ppf-input ppf-select" id="ppf-multi-select"
                onchange="window._saveProfileField('multiKlasse', this.value); window._updateMulticlassTheme()">
                <option value="">—</option>
                ${_getKlassen().map(k =>
                  `<option value="${k}"${playerProfile.multiKlasse === k ? ' selected' : ''}>${k}</option>`
                ).join('')}
              </select>
              <input class="ppf-input ppf-level" id="ppf-multi-level" type="number" min="1" max="20"
                value="${esc(playerProfile.multiKlasseLevel ?? '')}" placeholder="Niv"
                onchange="window._saveProfileField('multiKlasseLevel', this.value); window._updateMulticlassTheme()">
            </div>` : ''}
            <div class="ppf-row"><label class="ppf-label">${isHp ? 'School of Magic' : 'Subclass'}</label>
              ${_subclassOpts
                ? _ppfSelectField('subclass', playerProfile.subclass, _subclassOpts, '—')
                : `<input class="ppf-input" type="text" value="${esc(playerProfile.subclass ?? '')}" placeholder="—"
                onblur="window._saveProfileField('subclass', this.value)">`}</div>
            <div class="ppf-row"><label class="ppf-label">Background</label>
              ${_backgroundOpts
                ? _ppfSelectField('background', playerProfile.background, _backgroundOpts, '—')
                : `<input class="ppf-input" type="text" value="${esc(playerProfile.background ?? '')}" placeholder="—"
                onblur="window._saveProfileField('background', this.value)">`}</div>
            ${(() => {
              const ontgrendeld = [...new Set((factiesData || []).flatMap(f => (f.ladder || []).filter(r => r.bereikt && r.index > 0 && r.titel).map(r => r.titel)))];
              const cur = playerProfile.factieTitel || '';
              if (cur && !ontgrendeld.includes(cur)) ontgrendeld.unshift(cur);
              if (!ontgrendeld.length) return '';
              return `<div class="ppf-row"><label class="ppf-label">Titel</label>
                <select class="ppf-input" onchange="window._saveProfileField('factieTitel', this.value)">
                  <option value="" ${cur ? '' : 'selected'}>— geen —</option>
                  ${ontgrendeld.map(t => `<option value="${esc(t)}" ${t === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}
                </select></div>`;
            })()}
            <div class="ppf-row"><label class="ppf-label">${isHp ? 'House' : 'Origin'}</label>
              ${_originOpts
                ? _ppfSelectField('origin', playerProfile.origin, _originOpts, '—')
                : `<input class="ppf-input" type="text" value="${esc(playerProfile.origin ?? '')}" placeholder="—"
                onblur="window._saveProfileField('origin', this.value)">`}</div>
            ${isHp ? `<div class="ppf-row"><label class="ppf-label">Blood Status</label>
              <input class="ppf-input" type="text" value="${esc(playerProfile.bloodStatus ?? '')}" placeholder="—"
                onblur="window._saveProfileField('bloodStatus', this.value)"></div>` : ''}
          </div>
        </div>
      </div>

      <!-- Subtab nav -->
      <div class="player-subtabs">
        <button class="player-subtab${_playerSubTab === 'party' ? ' active' : ''}"
          data-tab="party" onclick="window._setPlayerSubTab('party')">${icon('users')} Party</button>
        <button class="player-subtab${_playerSubTab === 'personage' ? ' active' : ''}"
          data-tab="personage" onclick="window._setPlayerSubTab('personage')">${icon('swords')} Personage</button>
        ${window._spelerTabAan('facties') ? `<button class="player-subtab${_playerSubTab === 'facties' ? ' active' : ''}"
          data-tab="facties" onclick="window._setPlayerSubTab('facties')">${icon('landmark')} Facties</button>` : ''}
        <button class="player-subtab${_playerSubTab === 'knapzak' ? ' active' : ''}"
          data-tab="knapzak" onclick="window._setPlayerSubTab('knapzak')">${icon('scroll-text')} Boedel${(lootData?.actief && lootData.deelnemers?.includes(charId)) ? '<span class="player-loot-badge" id="loot-tab-badge"></span>' : ''}</button>
        ${window._spelerTabAan('progressie') ? `<button class="player-subtab${_playerSubTab === 'progressie' ? ' active' : ''}"
          data-tab="progressie" onclick="window._setPlayerSubTab('progressie')">${icon('clipboard-list')} Progressie</button>` : ''}
        ${window._spelerTabAan('spreukenboek') ? `<button class="player-subtab${_playerSubTab === 'spreukenboek' ? ' active' : ''}"
          data-tab="spreukenboek" onclick="window._setPlayerSubTab('spreukenboek')">${icon('sparkles')} Spreukenboek</button>` : ''}
        ${window._spelerTabAan('berichten') ? `<button class="player-subtab${_playerSubTab === 'berichten' ? ' active' : ''}"
          data-tab="berichten" onclick="window._setPlayerSubTab('berichten')">${icon('message-circle')} Berichten${window._berichtenUnread ? ` <span class="bericht-badge">${window._berichtenUnread}</span>` : ''}</button>` : ''}
      </div>

      <!-- ═══ TAB: Party ═══ -->
      <div id="pst-party" class="player-subtab-panel${_playerSubTab !== 'party' ? ' hidden' : ''}">
        <div style="display:flex;justify-content:flex-end;padding:4px 0 0">${_helpBtn('party')}</div>

        ${(() => {
          // Feature #5: ontdekkings-teller (alleen voor spelers; data is null voor DM)
          if (!ontdekkingenData) return '';
          const _OD = [
            { key: 'personages',   label: 'Personages',   ic: 'user' },
            { key: 'locaties',     label: 'Locaties',     ic: 'castle' },
            { key: 'organisaties', label: 'Organisaties', ic: 'landmark' },
            { key: 'voorwerpen',   label: 'Voorwerpen',   ic: 'package' },
            { key: 'documenten',   label: 'Documenten',   ic: 'scroll-text' },
          ];
          const rows = _OD.map(c => {
            const d = ontdekkingenData[c.key];
            if (!d || !d.totaal) return ''; // categorie zonder entiteiten verbergen
            const pct = Math.round((d.ontdekt / d.totaal) * 100);
            return `<div class="ontdek-meter">
              <span class="ontdek-meter-icon">${icon(c.ic)}</span>
              <span class="ontdek-meter-label">${c.label}</span>
              <div class="ontdek-bar"><div class="ontdek-bar-fill" style="width:${pct}%"></div></div>
              <span class="ontdek-meter-count">${d.ontdekt} / ${d.totaal}</span>
            </div>`;
          }).join('');
          if (!rows.trim()) return '';
          return `<div class="player-dash-section ontdek-section">
            <div class="player-dash-section-title">${icon('eye')} Ontdekt in ${esc(window._campagneNaam())}</div>
            <div class="ontdek-meters">${rows}</div>
          </div>`;
        })()}

        ${inspired ? `
        <div class="player-dash-section player-inspiration-section">
          <div class="player-dash-section-title">${icon('sparkles')} Inspiratie</div>
          <div class="player-inspiration-block">
            <span class="player-inspiration-badge">✨ Je hebt inspiratie!</span>
            <button class="player-inspiration-use-btn" onclick="window._dashUseInspiration()">Gebruik</button>
          </div>
        </div>` : ''}

        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('users')} Mijn party</div>
          <div class="player-dash-party-row">
            <!-- Zichzelf (altijd zichtbaar) -->
            ${(() => {
              const _ringR = 44, _ringC = +(2 * Math.PI * 44).toFixed(1);
              const _ringFill = hpPct > 0 ? +(_ringC * hpPct / 100).toFixed(1) : 0;
              const _tmpR = 47, _tmpC = +(2 * Math.PI * 47).toFixed(1);
              const _tmpFill = (maxNum && tempNum > 0) ? +(_tmpC * Math.min(tempNum, maxNum) / maxNum).toFixed(1) : 0;
              return `<div class="party-portrait party-portrait--self">
              <div class="party-portrait-ring-wrap">
                <svg class="party-hp-ring" viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2">
                  <circle cx="50" cy="50" r="${_ringR}" class="party-hp-ring-bg"/>
                  <circle cx="50" cy="50" r="${_ringR}" class="party-hp-ring-fill party-hp-ring-${hpCls}"
                    stroke-dasharray="${_ringFill} ${_ringC}" transform="rotate(-90 50 50)"/>
                  <circle cx="50" cy="50" r="${_tmpR}" class="party-hp-ring-temp-bg"/>
                  ${_tmpFill > 0 ? `<circle cx="50" cy="50" r="${_tmpR}" class="party-hp-ring-temp"
                    stroke-dasharray="${_tmpFill} ${_tmpC}" transform="rotate(-90 50 50)"/>` : ''}
                </svg>
                <div class="party-portrait-avatar-wrap avatar-${hpCls}">
                  <img src="${imgUrl}" class="party-portrait-img"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div class="party-portrait-fallback" style="display:none">${icon('user')}</div>
                </div>
              </div>
              <div class="party-portrait-name">${esc(playerName.split(' ')[0])}</div>
              <div class="party-portrait-sub">${hp !== '—' ? `${hp} / ${maxHp} HP${tempNum > 0 ? ` <span class="party-portrait-temp">+${tempNum}</span>` : ''}` : '—'}</div>
              ${inspired ? '<div class="party-portrait-badge">✨</div>' : ''}
            </div>`;
            })()}
            ${partyMembers.length > 0 ? '<div class="party-bar-divider"></div>' : ''}
            ${partyMembers.map(e => {
              const pImgUrl   = api.fileForEntity(e);
              const firstName = esc(e.name.split(' ')[0]);
              const psub      = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
              const pHp       = typeof e.hp === 'number' ? e.hp : null;
              const pMaxHp    = typeof e.maxHp === 'number' ? e.maxHp : null;
              const pHpPct    = (pHp !== null && pMaxHp) ? Math.max(0, Math.min(100, (pHp / pMaxHp) * 100)) : 0;
              const pHpCls    = pHpPct > 75 ? 'hp-healthy' : pHpPct > 50 ? 'hp-lightly' : pHpPct > 25 ? 'hp-wounded' : pHpPct > 0 ? 'hp-critical' : 'hp-down';
              const pRingR = 38, pRingC = +(2 * Math.PI * 38).toFixed(1);
              const pRingFill = pHpPct > 0 ? +(pRingC * pHpPct / 100).toFixed(1) : 0;
              return `<div class="party-portrait" onclick="window._openDetail('personages','${esc(e.id)}')">
                <div class="party-portrait-ring-wrap">
                  <svg class="party-hp-ring" viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2">
                    <circle cx="50" cy="50" r="${pRingR}" class="party-hp-ring-bg"/>
                    <circle cx="50" cy="50" r="${pRingR}" class="party-hp-ring-fill party-hp-ring-${pHpCls}"
                      stroke-dasharray="${pRingFill} ${pRingC}" transform="rotate(-90 50 50)"/>
                  </svg>
                  <div class="party-portrait-avatar-wrap">
                    <img src="${pImgUrl}" class="party-portrait-img"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    <div class="party-portrait-fallback" style="display:none">${icon('user')}</div>
                  </div>
                </div>
                <div class="party-portrait-name">${firstName}</div>
                ${psub ? `<div class="party-portrait-sub">${esc(psub)}</div>` : ''}
              </div>`;
            }).join('')}
            ${companions.length > 0 ? '<div class="party-bar-divider"></div>' : ''}
            ${companions.map(e => {
              const pImgUrl   = api.fileForEntity(e);
              const firstName = esc(e.name.split(' ')[0]);
              const psub      = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
              return `<div class="party-portrait party-portrait--companion" onclick="window._openDetail('personages','${esc(e.id)}')">
                <div class="party-portrait-avatar-wrap">
                  <img src="${pImgUrl}" class="party-portrait-img"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div class="party-portrait-fallback" style="display:none">${icon('sword')}</div>
                </div>
                <div class="party-portrait-name">${firstName}</div>
                ${psub ? `<div class="party-portrait-sub">${esc(psub)}</div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Initiativevolgorde (alleen tijdens gevecht) -->
        ${combat?.active && (combat.combatants?.length || 0) > 0 ? `
        <div class="player-dash-section player-dash-initiative">
          <div class="player-dash-section-title">${icon('swords')} Initiativevolgorde</div>
          <div class="player-dash-init-list">
            ${(combat.combatants || []).map((c, i) => {
              const isActive = i === combat.currentTurn;
              const isMe = c.entityId === charId || c.name === playerName;
              const displayName = c.type === 'player' ? c.name.split(' ')[0] : c.name;
              const COND_ICONS_MAP = {
                poisoned:'flask-conical', grappled:'lock', restrained:'lock', paralyzed:'lock',
                stunned:'zap', blinded:'eye-off', frightened:'skull', prone:'minus',
                incapacitated:'skull', unconscious:'skull', exhaustion:'minus',
                charmed:'sparkles', deafened:'volume-2', invisible:'eye-off',
                petrified:'mountain', concentration:'target'
              };
              const COND_LBL_MAP = {
                blinded:'Verblind', charmed:'Betoverd', deafened:'Doof', exhaustion:'Uitputting',
                frightened:'Bevreesd', grappled:'Vastgegrepen', incapacitated:'Buiten gevecht',
                invisible:'Onzichtbaar', paralyzed:'Verlamd', petrified:'Versteend',
                poisoned:'Vergiftigd', prone:'Neergevallen', restrained:'Vastgehouden',
                stunned:'Verdoofd', unconscious:'Bewusteloos', concentration:'Concentratie'
              };
              const conds = (c.conditions || []).slice(0, 3);
              const condHtml = conds.map(cid => {
                const icn = COND_ICONS_MAP[cid] || 'zap';
                const lbl = COND_LBL_MAP[cid] || cid;
                return `<span class="player-dash-init-cond" title="${esc(lbl)}">${icon(icn)}</span>`;
              }).join('');
              const isStudied = c.type === 'monster' && c._niveau && c._niveau !== 'naam';
              if (isStudied) _combatMonsterCache.set(c.id, c);
              const clickAttr = isStudied ? `onclick="window.app.openCombatMonsterPanel(window._combatMonsterCache?.get('${esc(c.id)}'))" style="cursor:pointer"` : '';
              return `<div class="player-dash-init-row${isActive ? ' player-dash-init-active' : ''}${isMe ? ' player-dash-init-me' : ''}${isStudied ? ' player-dash-init-studied' : ''}" ${clickAttr}>
                <span class="player-dash-init-num">${i + 1}</span>
                <span class="player-dash-init-name">${esc(displayName)}</span>
                ${isStudied ? `<span class="player-dash-init-kennis" title="Bestudeerd — klik voor stat block">${icon('book-open')}</span>` : ''}
                ${condHtml ? `<span class="player-dash-init-conds">${condHtml}</span>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- ═══ TAB: Mijn personage ═══ -->
      <div id="pst-personage" class="player-subtab-panel${_playerSubTab !== 'personage' ? ' hidden' : ''}">
        <div style="display:flex;justify-content:flex-end;padding:4px 0 0">${_helpBtn('personage')}</div>

        ${_renderSignatureCard(
          _dominantKlasse,
          (_isMulticlass && playerProfile.multiKlasse && _mkLvl > _kLvl) ? _mkLvl : (_kLvl || parseInt(playerProfile.level) || 0),
          progData, playerProfile)}

        ${_dominantKlasse.toLowerCase().includes('sorcerer') ? `
        <div class="player-dash-section wild-magic-section">
          <div class="player-dash-section-title">${icon('sparkles')} Wild Magic Surge</div>
          <div class="wild-magic-roller">
            <button class="wild-magic-btn" onclick="window._rollWildMagic()">Roll d100</button>
            <div class="wild-magic-result hidden" id="wild-magic-result">
              <span class="wild-magic-roll" id="wild-magic-roll"></span>
              <span class="wild-magic-text" id="wild-magic-text"></span>
            </div>
          </div>
        </div>` : ''}

        <!-- Combat stats strip -->
        <div class="player-combat-strip">
          <div class="pcs-item">
            <span class="pcs-label">AC</span>
            <input class="pcs-input" type="number" min="1" max="30"
              value="${esc(playerProfile.ac ?? '')}" placeholder="—"
              onblur="window._saveProfileField('ac', this.value)">
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Speed</span>
            <input class="pcs-input" type="text"
              value="${esc(playerProfile.speed ?? '')}" placeholder="—"
              onblur="window._saveProfileField('speed', this.value)">
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Initiative</span>
            <input class="pcs-input" type="text"
              value="${esc(playerProfile.initiative ?? '')}" placeholder="—"
              onblur="window._saveProfileField('initiative', this.value)">
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Prof. Bonus</span>
            <input class="pcs-input" type="text"
              value="${esc(playerProfile.profBonus ?? '')}" placeholder="—"
              onblur="window._saveProfileField('profBonus', this.value); window._reRenderKarakter()">
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Hit Dice</span>
            <div class="pcs-value" title="Afgeleid uit klasse + level">${_hitDiceKort(playerProfile)}</div>
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Pass. Perc</span>
            <div class="pcs-value">${_passivePerc}</div>
          </div>
        </div>

        <!-- HP blok (redesigned) -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('heart')} HP</div>
          <div class="player-hp-hero">
            <div class="player-hp-hero-row">
              <button class="player-hp-btn-big" onclick="window._dashHpChange(-1)" title="Schade">−</button>
              <div class="player-hp-nums">
                <input id="dash-hp-current" type="number" class="player-hp-current" value="${hpNum ?? ''}"
                  placeholder="?" onchange="window._dashHpSave()" onclick="event.stopPropagation()">
                <span class="player-hp-sep">/</span>
                <input id="dash-hp-max" type="number" class="player-hp-max" value="${maxNum ?? ''}"
                  placeholder="max" onchange="window._dashHpSave()" onclick="event.stopPropagation()">
              </div>
              <button class="player-hp-btn-big" onclick="window._dashHpChange(1)" title="Genezing">+</button>
            </div>
            <div class="player-dash-hp-bar-wrap">
              <div class="player-dash-hp-bar ${hpCls}" style="width:${hpPct}%"></div>
            </div>
            <div class="player-hp-temp-wrap">
              <div class="player-hp-temp-label">Temporary HP</div>
              <div class="player-hp-temp-row">
                <button class="player-hp-temp-btn" onclick="window._dashTempHpChange(-1)" title="Verminder">−</button>
                <input id="dash-hp-temp" type="number" class="player-hp-temp-inp" min="0"
                  value="${tempNum}" onchange="window._dashTempHpSave()" onclick="event.stopPropagation()">
                <button class="player-hp-temp-btn" onclick="window._dashTempHpChange(1)" title="Verhoog">+</button>
              </div>
            </div>
            ${myCombatant ? `<p class="player-dash-hp-note">${icon('swords')} Actief in gevecht</p>` : ''}
          </div>
          <div class="player-hd-row">
            <span class="player-hd-label">${icon('dice')} Hit Dice</span>
            <span class="player-hd-dots-wrap" id="player-dash-hd-${esc(charId)}">${_hitDiceDotsHtml(_clientHitDicePool(playerProfile), {})}</span>
          </div>
        </div>

        ${playerBuffs.length ? `
        <div class="player-dash-section player-buffs-section">
          <div class="player-dash-section-title">${icon('beer')} Aan de tap — actief tot je volgende lange rust</div>
          <div class="player-buffs-lijst">
            ${playerBuffs.map(b => `
              <div class="player-buff-badge">
                <span class="player-buff-label">${esc(b.label)}</span>
                ${b.desc ? `<span class="player-buff-desc">${esc(b.desc)}</span>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Weapons & Damage Cantrips -->
        <div class="player-dash-section">
          <div class="player-dash-section-title player-dash-section-title--with-btn">
            ${icon('swords')} Weapons &amp; Damage Cantrips
            <button class="player-weapon-add-btn" onclick="window._addWeapon()" title="Voeg wapen toe">+</button>
          </div>
          ${weapons.length > 0 ? `
          <div class="player-weapons-table">
            <div class="player-weapons-header">
              <span class="pwh-name">Naam</span>
              <span class="pwh-atk">Aanval / DC</span>
              <span class="pwh-dmg">Schade &amp; Type</span>
              <span class="pwh-del"></span>
            </div>
            ${weapons.map((w, i) => `
            <div class="player-weapon-entry">
              <div class="player-weapon-row">
                <input class="pw-input pw-name" type="text" value="${esc(w.name || '')}" placeholder="Rapier, Fire Bolt…"
                  onblur="window._saveWeapon(${i},'name',this.value)">
                <input class="pw-input pw-atk" type="text" value="${esc(w.atk || '')}" placeholder="+5 / DC 14"
                  onblur="window._saveWeapon(${i},'atk',this.value)">
                <input class="pw-input pw-dmg" type="text" value="${esc(w.dmg || '')}" placeholder="1d8+3 Piercing"
                  onblur="window._saveWeapon(${i},'dmg',this.value)">
                <button class="pw-del-btn" onclick="window._deleteWeapon(${i})" title="Verwijder">×</button>
              </div>
              ${_weaponPropsPickerHtml(w, i)}
            </div>`).join('')}
          </div>` : `
          <p class="player-weapons-empty">Nog geen wapens toegevoegd. Klik + om te beginnen.</p>`}
        </div>

        <!-- Ability Scores + Saving Throws -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('dice', {cls:'icon-gi'})} Ability Scores</div>
          <div class="player-ability-grid">
            ${['str','dex','con','int','wis','cha'].map(ab => {
              const isProf = _saveProfs.has(ab);
              const saveBonus = _mod(ab) + (isProf ? _profBonusNum : 0);
              const saveBonusStr = (saveBonus >= 0 ? '+' : '') + saveBonus;
              return `
                <div class="player-ability-card">
                  <div class="player-ability-label">${_AB_LABELS[ab]}</div>
                  <input class="player-ability-score" type="number" min="1" max="30"
                    value="${_ab(ab)}"
                    onblur="window._saveAbilityScore('${ab}', this.value)">
                  <div class="player-ability-mod-wrap">
                    <span class="player-ability-mod player-roll" title="Rol ${_AB_LABELS[ab]}-check"
                      onclick="window.dice?.rollFormula('1d20${_mod(ab) >= 0 ? '+' + _mod(ab) : _mod(ab)} ${_AB_LABELS[ab]} check')">${_modStr(ab)}</span>
                  </div>
                  <button class="player-save-dot${isProf ? ' active' : ''}"
                    onclick="window._toggleSaveProf('${ab}', ${!isProf})"
                    title="Proficiency wisselen">
                  </button>
                  <span class="player-save-val player-roll" title="Rol ${_AB_LABELS[ab]} save"
                    onclick="window.dice?.rollFormula('1d20${saveBonus >= 0 ? '+' + saveBonus : saveBonus} ${_AB_LABELS[ab]} save')">${saveBonusStr}</span>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Skills -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('target')} Skills</div>
          <div class="player-skills-list">
            ${_getSkills().map(skill => {
              const prof  = _skillProfs[skill.key] || null;
              const bonus = _skillBonus(skill);
              const bonusStr = (bonus >= 0 ? '+' : '') + bonus;
              const adjVal = _skillAdj[skill.key] || 0;
              const bonusCls = adjVal > 0 ? ' skill-bonus--buff' : adjVal < 0 ? ' skill-bonus--nerf' : '';
              return `<div class="player-skill-row">
                <button class="player-skill-prof-btn${prof ? ' ' + prof : ''}"
                  onclick="window._cycleSkillProf('${skill.key}')"
                  title="${prof === 'expert' ? 'Expertise' : prof === 'prof' ? 'Proficient' : 'Geen proficiency'}"></button>
                <span class="player-skill-bonus${bonusCls}">${bonusStr}</span>
                <span class="player-skill-name player-roll" title="Rol ${skill.label}"
                  onclick="window.dice?.rollFormula('1d20${bonus >= 0 ? '+' + bonus : bonus} ${skill.label}')">${skill.label}</span>
                <span class="player-skill-ab">${skill.ab.toUpperCase()}</span>
                <span class="skill-adj-ctrl">
                  <button class="skill-adj-arrow" onclick="window._adjSkill('${skill.key}', 1)" title="Bonus +1">▲</button>
                  ${adjVal !== 0 ? `<span class="skill-adj-val${adjVal > 0 ? ' buff' : ' nerf'}">${adjVal > 0 ? '+' + adjVal : adjVal}</span>` : '<span class="skill-adj-val"></span>'}
                  <button class="skill-adj-arrow" onclick="window._adjSkill('${skill.key}', -1)" title="Bonus −1">▼</button>
                </span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Proficiencies -->
        <details class="player-dash-section player-dash-collapsible" ${localStorage.getItem('_profOpen') !== '0' ? 'open' : ''} ontoggle="localStorage.setItem('_profOpen', this.open?'1':'0')">
          <summary class="player-dash-section-title">${icon('shield')} Proficiencies</summary>
          <div class="player-profs-grid">
            <div class="player-prof-row">
              <label class="player-prof-label">Armor</label>
              <input class="player-prof-input" type="text" placeholder="bv. Light armor, shields…"
                value="${esc(playerProfile.armorProfs || '')}"
                onblur="window._saveProfileField('armorProfs', this.value)">
            </div>
            <div class="player-prof-row">
              <label class="player-prof-label">Weapons</label>
              <input class="player-prof-input" type="text" placeholder="bv. Simple weapons, hand crossbows…"
                value="${esc(playerProfile.weaponProfs || '')}"
                onblur="window._saveProfileField('weaponProfs', this.value)">
            </div>
            <div class="player-prof-row">
              <label class="player-prof-label">Tools</label>
              <input class="player-prof-input" type="text" placeholder="bv. Thieves' tools, musical instruments…"
                value="${esc(playerProfile.toolProfs || '')}"
                onblur="window._saveProfileField('toolProfs', this.value)">
            </div>
          </div>
        </details>

        <!-- Talen & Zintuigen -->
        <details class="player-dash-section player-dash-collapsible" ${localStorage.getItem('_talenOpen') !== '0' ? 'open' : ''} ontoggle="localStorage.setItem('_talenOpen', this.open?'1':'0')">
          <summary class="player-dash-section-title">${icon('globe')} Talen &amp; Zintuigen</summary>
          <div class="player-profs-grid">
            <div class="player-prof-row">
              <label class="player-prof-label">Talen</label>
              <input class="player-prof-input" type="text" placeholder="bv. Common, Elvish, Dwarvish…"
                value="${esc(playerProfile.languages || '')}"
                onblur="window._saveProfileField('languages', this.value)">
            </div>
            <div class="player-prof-row">
              <label class="player-prof-label">Zintuigen</label>
              <input class="player-prof-input" type="text" placeholder="bv. Darkvision 60 ft, Keen Smell…"
                value="${esc(playerProfile.senses || '')}"
                onblur="window._saveProfileField('senses', this.value)">
            </div>
          </div>
        </details>

        <!-- Actieve conditions -->
        ${conditions.length > 0 ? `
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('zap')} Actieve statussen</div>
          <div class="player-dash-conditions">
            ${conditions.map(cid => {
              const info    = PLAYER_COND_INFO[cid] || { label: cid };
              const hasIcon = PLAYER_COND_ICONS.has(cid);
              return `<button class="player-dash-cond-chip" data-cid="${esc(cid)}"
                onclick="window._condInfo('${escJS(cid)}')" title="${esc(info.desc || 'Tik voor uitleg')}">
                ${hasIcon ? `<img src="/img/conditions/${esc(cid)}.png" class="player-dash-cond-icon" alt="">` : ''}
                <span>${esc(info.label)}</span>
              </button>`;
            }).join('')}
          </div>
          <div id="player-cond-detail" class="player-cond-detail hidden" data-cid=""></div>
        </div>` : ''}

        <!-- Kenmerken & Eigenschappen -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">
            ${icon('scroll-text')} Kenmerken &amp; Eigenschappen
            <button class="player-trait-add-btn" onclick="window._traitCustomOpen()" title="Nieuw kenmerk toevoegen">+</button>
          </div>

          <!-- PHB-zoeker -->
          <div class="player-trait-search-wrap">
            <input id="player-trait-input" class="player-spell-search-input" type="text"
              placeholder="Zoek PHB-kenmerk (bv. Rage, Sneak Attack…)" autocomplete="off"
              oninput="window._playerTraitSearch(this.value)">
            <div id="player-trait-results" class="player-spell-results"></div>
          </div>

          <!-- Vastgezette kenmerken (gesorteerd op niveau dan naam) -->
          ${pinnedTraits.length > 0 ? (() => {
            const _traitLevel = t => {
              const m = (t.meta || '').match(/(?:Niv\.|Lv\.)\s*(\d+)/i);
              return m ? parseInt(m[1]) : (t.source === 'phb-feats' ? 99 : 0);
            };
            const sorted = [...pinnedTraits].sort((a, b) =>
              _traitLevel(a) - _traitLevel(b) || a.name.localeCompare(b.name));
            return `
          <div class="player-pinned-traits">
            ${sorted.map(t => {
              const maxUses = t.maxUses || 0;
              const curUses = t.currentUses || 0;
              const dotsHtml = maxUses > 0 ? `
                <span class="trait-uses-dots" onclick="event.preventDefault();event.stopPropagation()">
                  ${Array.from({length: maxUses}, (_, i) => `<button class="spell-slot-dot ${i < curUses ? 'used' : 'free'}"
                    onclick="event.preventDefault();event.stopPropagation();window._traitToggleUse('${esc(t.id)}',${i},${maxUses},${curUses})"
                    title="${i < curUses ? 'Verbruikt' : 'Vrij'}"></button>`).join('')}
                  <span class="trait-uses-count">${curUses}/${maxUses}</span>
                </span>` : '';
              return `
              <details class="player-trait-accordion" data-trait-id="${esc(t.id)}">
                <summary class="player-pinned-spell-summary">
                  <span class="player-pinned-spell-chevron">▾</span>
                  <span class="player-pinned-spell-name">${esc(t.name)}</span>
                  ${t.meta ? `<span class="player-pinned-spell-meta">${esc(t.meta)}</span>` : ''}
                  ${dotsHtml}
                  <button class="player-pinned-spell-del"
                    onclick="event.preventDefault();event.stopPropagation();window._playerTraitDelete('${esc(t.id)}')"
                    title="Verwijder">×</button>
                </summary>
                <div class="player-spell-accordion-body"
                  data-trait-index="${esc(t.index || '')}"
                  data-trait-source="${esc(t.source)}"
                  data-trait-desc="${esc(t.desc || '')}"
                  data-trait-id="${esc(t.id)}"
                  data-max-uses="${maxUses}"
                  data-note="${esc(t.note || '')}"
                  data-loaded="false">
                  <p class="player-spell-loading-text">Laden…</p>
                </div>
              </details>`;
            }).join('')}
          </div>`;
          })() : '<p class="player-dash-empty" style="margin-top:8px">Nog geen kenmerken vastgezet.</p>'}

          <!-- Inline formulier: nieuw kenmerk -->
          <div id="player-trait-custom-form" class="player-trait-custom-form hidden">
            <input id="ptf-name"  class="player-trait-form-input" type="text" placeholder="Naam kenmerk" maxlength="80">
            <input id="ptf-meta"  class="player-trait-form-input" type="text" placeholder="Klasse · Niveau (optioneel)" maxlength="60">
            <textarea id="ptf-desc" class="player-trait-form-ta" placeholder="Beschrijving (optioneel)" rows="3"></textarea>
            <div class="player-trait-form-btns">
              <button class="player-trait-form-save" onclick="window._traitCustomSave()">Opslaan</button>
              <button class="player-trait-form-cancel" onclick="window._traitCustomClose()">Annuleer</button>
            </div>
          </div>
        </div>

        <!-- Emotes -->
        ${displayEmotes.length > 0 ? `
        <div class="player-dash-section player-dash-emotes">
          <div class="player-dash-section-title">${icon('sparkles')} Emotes${isMyTurn ? ' <span class="player-dash-emote-turn-hint">— jouw beurt!</span>' : ''}</div>
          <div class="player-dash-emote-btns">
            ${displayEmotes.map(e => `
              <button class="player-dash-emote-btn" onclick="window._dashEmote('${esc(e.id)}')" title="${esc(e.label || '')}">
                ${e.icon  ? `<span class="emote-btn-icon">${esc(e.icon)}</span>`  : ''}
                ${e.label ? `<span class="emote-btn-text">${esc(e.label)}</span>` : ''}
              </button>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- ═══ TAB: Facties & Aanzien ═══ -->
      <div id="pst-facties" class="player-subtab-panel${_playerSubTab !== 'facties' ? ' hidden' : ''}">
        <div style="display:flex;justify-content:flex-end;padding:4px 0 0">${_helpBtn('facties')}</div>
        ${(!heerenData && !(factiesData || []).some(f => (f.rang?.index ?? 0) > 0))
          ? `<div class="player-dash-section"><p class="dm-hint" style="opacity:.7;text-align:center;padding:24px 0">Je hebt nog geen aanzien bij facties.</p></div>`
          : ''}
        ${heerenData ? `
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('moon')} Aanzien bij de Heeren</div>
          <div class="renown-card">
            <div class="renown-rang">${esc(heerenData.rang?.naam || '')}<span class="renown-trap">${(heerenData.rang?.index ?? 0) + 1}/${heerenData.rang?.aantal || 1}</span></div>
            ${heerenData.rang?.voordelen ? `<div class="renown-voordelen">${esc(heerenData.rang.voordelen)}</div>` : ''}
            ${heerenData.rang?.volgende ? `<div class="renown-volgende">Volgende — <strong>${esc(heerenData.rang.volgende.naam)}</strong>${heerenData.rang.volgende.voordelen ? `: ${esc(heerenData.rang.volgende.voordelen)}` : ''}</div>` : ''}
            ${(heerenData.boetes && heerenData.boetes.length) ? `<div class="renown-boete">${icon('landmark')} ${heerenData.boetes.length} openstaande boete${heerenData.boetes.length > 1 ? 's' : ''} bij de Luimpoort</div>` : ''}
          </div>
        </div>` : ''}

        ${(factiesData || []).filter(f => (f.rang?.index ?? 0) > 0).map(f => {
          const stijl = (f.stijl || '').replace(/[^a-z]/gi, '').toLowerCase();
          const ladder = f.ladder || [];
          const verworven = ladder.filter(r => r.bereikt).flatMap(r => r.boons || []);
          const next = ladder.find(r => !r.bereikt && (r.boons || []).length);
          return `
        <div class="player-dash-section">
          <div class="player-dash-section-title">${_FACTIE_ICON_SET_APP.has(f.embleem) ? icon(f.embleem) : icon('landmark')} Aanzien bij ${esc(f.naam)}</div>
          <div class="renown-card factie-card--${stijl}">
            <div class="renown-rang">${esc(f.rang?.naam || '')}<span class="renown-trap">${(f.rang?.index ?? 0) + 1}/${f.rang?.aantal || 1}</span></div>
            ${f.rang?.voordelen ? `<div class="renown-voordelen">${esc(f.rang.voordelen)}</div>` : ''}
            ${verworven.length ? `<div class="factie-boons">${verworven.map(b => `<span class="factie-boon" title="${esc(b.tekst || b.naam || '')}">${esc(b.naam || '')}</span>`).join('')}</div>` : ''}
            ${next ? `<div class="renown-volgende">${icon('lock')} Volgende — <strong>${esc(next.naam)}</strong>${next.boons[0] ? `: ${esc(next.boons[0].naam || '')}` : ''}</div>`
                   : (f.rang?.volgende ? `<div class="renown-volgende">Volgende — <strong>${esc(f.rang.volgende.naam)}</strong></div>` : '')}
          </div>
        </div>`; }).join('')}
      </div>

      <!-- ═══ TAB: Mijn knapzak ═══ -->
      <div id="pst-knapzak" class="player-subtab-panel${_playerSubTab !== 'knapzak' ? ' hidden' : ''}">
        <div style="display:flex;justify-content:flex-end;padding:4px 0 0">${_helpBtn('knapzak')}</div>
        <div id="player-loot-slot">${_playerLootPanelHtml(lootData, charId)}</div>

        <!-- Valuta -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">
            ${icon('coins')} Beurs
            ${partyCurrency.enabled ? `<span class="currency-shared-badge">${icon('users')} Gedeeld</span>` : ''}
          </div>
          <div class="player-dash-currency-new">
            <div class="player-currency-item player-currency-gold">
              <span class="player-currency-coin" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-block;width:.9em;height:.9em;border-radius:50%;background:#c9a227;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span></span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.fl || MUNT_STANDAARD.fl)}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-fl"
                  value="${partyCurrency.enabled ? partyCurrency.fl : currency.fl}"
                  oninput="window._dashCurrencySave()">
              </div>
            </div>
            <div class="player-currency-item player-currency-silver">
              <span class="player-currency-coin" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-block;width:.9em;height:.9em;border-radius:50%;background:#9090a8;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span></span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.kn || MUNT_STANDAARD.kn)}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-kn"
                  value="${partyCurrency.enabled ? partyCurrency.kn : currency.kn}"
                  oninput="window._dashCurrencySave()">
              </div>
            </div>
            <div class="player-currency-item player-currency-copper">
              <span class="player-currency-coin" style="display:inline-flex;align-items:center;justify-content:center"><span style="display:inline-block;width:.9em;height:.9em;border-radius:50%;background:#9a5530;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span></span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.cl || MUNT_STANDAARD.cl)}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-cl"
                  value="${partyCurrency.enabled ? partyCurrency.cl : currency.cl}"
                  oninput="window._dashCurrencySave()">
              </div>
            </div>
          </div>
        </div>

        <!-- Attunement -->
        ${(() => {
          const attItems = myItems.filter(it => it.data?.attunement === 'true' || it.data?.attunement === true);
          if (attItems.length === 0) return '';
          // Laad/initialiseer volgorde uit localStorage
          const _attKey = 'attSlots_' + charId;
          let slotIds = (() => { try { return JSON.parse(localStorage.getItem(_attKey) || 'null'); } catch { return null; } })();
          // Verwijder ids die de speler niet meer bezit; vul aan met overige
          const allIds = attItems.map(i => i.id);
          if (!Array.isArray(slotIds)) slotIds = [];
          slotIds = slotIds.filter(id => allIds.includes(id));
          for (const id of allIds) { if (slotIds.length < 3 && !slotIds.includes(id)) slotIds.push(id); }
          localStorage.setItem(_attKey, JSON.stringify(slotIds));
          window._attSlotIds   = slotIds;
          window._attAllItems  = attItems;
          window._attCharId    = charId;

          const over = attItems.length > 3;
          const _ATT_TYPE_ICON = { Weapon:icon('sword'), Armor:icon('shield'), Shield:icon('shield'), Ring:icon('swords'), Amulet:icon('swords'), 'Magic Item':icon('sparkles'), Wondrous:icon('sparkles'), Scroll:icon('scroll-text'), Other:icon('package') };

          function _attSectionHtml(slotIds) {
            const overflowIds = allIds.filter(id => !slotIds.includes(id));
            return `
            <div class="player-dash-section player-dash-section--attunement" id="att-section">
              <div class="player-dash-section-title">
                ${icon('flask-conical')} Attunement
                <span class="att-count ${over ? 'att-count--over' : ''}">${attItems.length}/3${over ? ` <span class="att-warn" title="Je hebt meer dan drie voorwerpen die attunement vereisen.">⚠️</span>` : ''}</span>
              </div>
              <div class="att-slots">
                ${slotIds.map((id, idx) => {
                  const it = attItems.find(i => i.id === id);
                  if (!it) return '';
                  const typeIcon = _ATT_TYPE_ICON[it.data?.itemType] || icon('sparkles');
                  const canSwap = overflowIds.length > 0;
                  return `<div class="att-slot-wrap" id="att-wrap-${idx}">
                    <button class="att-slot${canSwap ? ' att-slot--swappable' : ''}"
                      onclick="window._openDetail('voorwerpen','${esc(it.id)}')" title="${esc(it.name)}">
                      <span class="att-slot-icon">${typeIcon}</span>
                      <span class="att-slot-name">${esc(it.name)}</span>
                    </button>
                    ${canSwap ? `<button class="att-swap-btn" onclick="event.stopPropagation();window._attOpenSwap(${idx})" title="Vervang door ander voorwerp">↔</button>` : ''}
                  </div>`;
                }).join('')}
                ${Array.from({length: Math.max(0, 3 - slotIds.length)}, () =>
                  `<div class="att-slot att-slot--empty"><span class="att-slot-empty-label">vrij</span></div>`
                ).join('')}
              </div>
            </div>`;
          }

          // Globale swap-functies (hergebruikt na re-render)
          window._attRender = () => {
            const sec = document.getElementById('att-section');
            if (sec) sec.outerHTML = _attSectionHtml(window._attSlotIds);
          };
          window._attOpenSwap = (slotIdx) => {
            const overflowIds = window._attAllItems.map(i => i.id).filter(id => !window._attSlotIds.includes(id));
            // Verwijder eventuele open popup
            document.querySelectorAll('.att-swap-popup').forEach(p => p.remove());
            const wrap = document.getElementById('att-wrap-' + slotIdx);
            if (!wrap) return;
            const popup = document.createElement('div');
            popup.className = 'att-swap-popup';
            popup.innerHTML = overflowIds.map(id => {
              const it = window._attAllItems.find(i => i.id === id);
              if (!it) return '';
              const _attIcon = _ATT_TYPE_ICON[it.data?.itemType] || icon('sparkles');
              return `<button class="att-swap-option" onclick="window._attDoSwap(${slotIdx},'${esc(id)}')">
                <span>${_attIcon}</span> ${esc(it.name)}
              </button>`;
            }).join('');
            wrap.appendChild(popup);
            // Klik buiten sluit popup
            setTimeout(() => document.addEventListener('click', function _close() {
              popup.remove(); document.removeEventListener('click', _close);
            }), 0);
          };
          window._attDoSwap = (slotIdx, newId) => {
            document.querySelectorAll('.att-swap-popup').forEach(p => p.remove());
            window._attSlotIds[slotIdx] = newId;
            localStorage.setItem('attSlots_' + window._attCharId, JSON.stringify(window._attSlotIds));
            const sec = document.getElementById('att-section');
            if (sec) {
              const tmp = document.createElement('div');
              tmp.innerHTML = _attSectionHtml(window._attSlotIds);
              sec.replaceWith(tmp.firstElementChild);
            }
          };

          return _attSectionHtml(slotIds);
        })()}

        <!-- Geclaimde & losse voorwerpen -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('package')} Jouw voorwerpen</div>
          ${myItems.length > 0 ? (() => {
            const _ITEM_CATS = [
              { key: 'Wapen',                 label: 'Wapens',      icon: icon('sword') },
              { key: 'Weapon',                label: 'Wapens',      icon: icon('sword') },
              { key: 'Uitrusting',            label: 'Uitrusting',  icon: icon('shield') },
              { key: 'Armor',                 label: 'Uitrusting',  icon: icon('shield') },
              { key: 'Shield',                label: 'Uitrusting',  icon: icon('shield') },
              { key: 'Toveritem',             label: 'Toveritems',  icon: icon('sparkles') },
              { key: 'Magic Item',            label: 'Toveritems',  icon: icon('sparkles') },
              { key: 'Wondrous item',         label: 'Toveritems',  icon: icon('sparkles') },
              { key: 'Drank',                 label: 'Drankjes',    icon: icon('flask-conical') },
              { key: 'Potion',                label: 'Drankjes',    icon: icon('flask-conical') },
              { key: 'Scroll',                label: 'Scrolls',     icon: icon('scroll-text') },
              { key: 'Ring',                  label: 'Ringen',      icon: icon('star') },
              { key: 'Amulet',                label: 'Amuletten',   icon: icon('sparkles') },
              { key: 'Musical instrument',    label: 'Instrument',  icon: icon('volume-2') },
              { key: 'Consumable',            label: 'Verbruiksitem', icon: icon('flask-conical') },
            ];
            // Sort items by category order, then overig
            const _catOrder = _ITEM_CATS.map(c => c.key);
            const sortedItems = [...myItems].sort((a, b) => {
              const tA = a.data?.itemType || a.subtype || '';
              const tB = b.data?.itemType || b.subtype || '';
              const iA = _catOrder.indexOf(tA);
              const iB = _catOrder.indexOf(tB);
              const rA = iA === -1 ? 999 : iA;
              const rB = iB === -1 ? 999 : iB;
              return rA - rB || a.name.localeCompare(b.name);
            });
            window._knapzakCarouselIdx = 0;
            window._knapzakCarouselItems = sortedItems;
            const _charIdEsc = esc(charId);
            const _mdInline = s => mdToHtml(s);
            const _renderCarouselSlide = (item) => {
              if (!item) return '<div class="item-carousel-slide"><p style="color:#8a7050;font-style:italic">Geen voorwerpen</p></div>';
              const iImgUrl = api.fileForEntity(item);
              const typeIcon = _ITEM_CATS.find(c => c.key === (item.data?.itemType || item.subtype || ''))?.icon || icon('package');
              const typeLabel = item.data?.itemType || item.subtype || 'Overig';
              const desc = item.data?.desc || '';
              const qty = item._qty;
              const qtyHtml = item._stapelbaar ? `
                <div class="item-carousel-qty-controls" onclick="event.stopPropagation()">
                  <button class="item-carousel-qty-btn"
                    onclick="window._dashQtyAdj('${esc(item.id)}','${_charIdEsc}',-1,${qty})"
                    title="Verbruikt">−</button>
                  <span class="item-carousel-qty-label">×${qty}</span>
                  <button class="item-carousel-qty-btn"
                    onclick="window._dashQtyAdj('${esc(item.id)}','${_charIdEsc}',1,${qty})"
                    title="Nog een gevonden">+</button>
                </div>` : '';
              const chargesHtml = item._maxCharges > 0 ? `
                <div class="item-carousel-charges" onclick="event.stopPropagation()">
                  <div class="item-charge-label">${icon('zap')} Charges: ${item._charges}/${item._maxCharges}</div>
                  <div class="item-charge-dots-row">
                    ${item._playerMaxAdjustable ? `<button class="item-carousel-qty-btn" onclick="window._dashMaxChargeAdj('${esc(item.id)}','${_charIdEsc}',-1,${item._maxCharges})" title="Max. charges verlagen">−</button>` : ''}
                    <div class="item-charge-dots">
                      ${Array.from({length: item._maxCharges}, (_, i) => `
                        <button class="spell-slot-dot ${i < item._charges ? 'free' : 'used'}"
                          title="${i < item._charges ? 'Vrij — klik om te verbruiken' : 'Verbruikt — klik om te herstellen'}"
                          onclick="window._dashChargeToggle('${esc(item.id)}','${_charIdEsc}',${i},${item._charges},${item._maxCharges})"></button>`).join('')}
                    </div>
                    ${item._playerMaxAdjustable ? `<button class="item-carousel-qty-btn" onclick="window._dashMaxChargeAdj('${esc(item.id)}','${_charIdEsc}',1,${item._maxCharges})" title="Max. charges verhogen">+</button>` : ''}
                  </div>
                </div>` : '';
              const _itemDmg = item.data?.damage;
              const _itemProps = (() => { try { return JSON.parse(item.data?.weaponProperties || '[]'); } catch { return []; } })();
              const _acPill = _calcArmorAC(item.data, _mod('dex'));
              return `<div class="item-carousel-slide">
                <div class="item-carousel-img-wrap" onclick="window._openDetail('voorwerpen','${esc(item.id)}')" title="Bekijk kaartje" style="cursor:pointer">
                  <img src="${iImgUrl}" class="item-carousel-img"
                    onerror="this.closest('.item-carousel-img-wrap').style.display='none'">
                  ${_acPill ? `<span class="item-carousel-ac-pill" title="${esc(_acPill.tooltip)}">${esc(_acPill.pill)}</span>` : ''}
                </div>
                <div class="item-carousel-namerow">
                  <span class="item-carousel-type-icon">${typeIcon}</span>
                  <span class="item-carousel-name">${esc(item.name)}</span>
                </div>
                ${desc ? `<div class="item-carousel-desc">${_mdInline(desc)}</div>` : ''}
                ${_itemDmg ? (() => {
                  const _h = /heal/i.test(_itemDmg);
                  return `<div class="item-carousel-damage" onclick="event.stopPropagation()">
                    <button class="item-damage-pill item-damage-pill--sm${_h ? ' item-damage-pill--heal' : ''}"
                      onclick="window.dice?.rollFormula('${escJS(_itemDmg)}')"
                      title="Gooi ${escJS(_itemDmg)}">${icon('dice',{cls:'icon-gi'})} ${esc(_itemDmg)}</button>
                  </div>`;
                })() : ''}
                ${_itemProps.length ? `<div class="item-carousel-props">${_itemProps.map(p => `<span class="card-weapon-tag" title="${esc(_weaponPropTitle(p))}">${esc(p)}</span>`).join('')}</div>` : ''}
                ${(() => {
                  const _stlth = item.data?.stealthDisadvantage === true || item.data?.stealthDisadvantage === 'true';
                  const _srq   = parseInt(item.data?.strengthRequirement) || 0;
                  if (!_stlth && !_srq) return '';
                  return `<div class="item-carousel-props">
                    ${_stlth ? `<span class="card-armor-tag card-armor-tag--stealth" title="You have disadvantage on Dexterity (Stealth) checks while wearing this armor.">Stealth ↓</span>` : ''}
                    ${_srq   ? `<span class="card-armor-tag card-armor-tag--str" title="Your speed is reduced by 10 feet unless you have a Strength score of ${_srq} or higher.">Str ${_srq}</span>` : ''}
                  </div>`;
                })()}
                ${qtyHtml}
                ${chargesHtml}
                <div class="item-carousel-geef" onclick="event.stopPropagation()">
                  <button class="item-geef-btn" onclick="window._geefItemMenu('${esc(item.id)}', this)"
                    title="Dit voorwerp aan een medespeler geven">${icon('users')} Geven aan…</button>
                </div>
              </div>`;
            };
            const _dotsHtml = sortedItems.length > 1 ? `
              <div class="item-carousel-dots">
                ${sortedItems.map((_, i) => `<button class="item-carousel-dot${i === 0 ? ' active' : ''}" onclick="window._knapzakCarouselGoTo(${i})"></button>`).join('')}
              </div>` : '';
            return `
              <div class="item-carousel">
                <button class="item-carousel-nav" id="knapzak-nav-prev" onclick="window._knapzakCarouselNav(-1)" ${sortedItems.length <= 1 ? 'style="visibility:hidden"' : ''}>&#8249;</button>
                <div class="item-carousel-track" id="knapzak-carousel-track">
                  ${_renderCarouselSlide(sortedItems[0])}
                </div>
                <button class="item-carousel-nav" id="knapzak-nav-next" onclick="window._knapzakCarouselNav(1)" ${sortedItems.length <= 1 ? 'style="visibility:hidden"' : ''}>&#8250;</button>
              </div>
              ${_dotsHtml}`;
          })() : ''}
          ${(() => {
            const _isGoddelijk = (si) => si.eed || si.zegen || si.subtype === 'eed' || si.subtype === 'zegen' || si.subtype === 'vloek';
            const gewone = simpleItems.filter(si => !_isGoddelijk(si));
            return gewone.length ? `<ul class="player-dash-simple-list">${gewone.map(si => `
              <li class="player-dash-simple-item">
                <span class="player-dash-simple-name">${esc(si.name)}</span>
                ${si.note ? `<span class="player-dash-simple-note">${esc(si.note)}</span>` : ''}
                ${si.entityId ? `<button class="herberg-bubble-card-btn" style="margin-left:4px;font-size:0.65rem;padding:1px 4px;line-height:1.3;" onclick="window._openDetail('${esc(si.entityType)}','${esc(si.entityId)}')" title="Open kaartje">↗</button>` : ''}
                <button class="player-dash-simple-del" onclick="window._dashRemoveItem('${esc(si.id)}')" title="Verwijder">×</button>
              </li>`).join('')}</ul>` : '';
          })()}
          ${myItems.length === 0 && simpleItems.filter(si => !si.eed && !si.zegen).length === 0 ? '<p class="player-dash-empty">Nog geen voorwerpen.</p>' : ''}
          <div class="player-dash-add-item">
            <input id="dash-item-name" class="player-dash-add-item-input" type="text"
              placeholder="Naam voorwerp…" maxlength="80"
              onkeydown="if(event.key==='Enter')window._dashAddItem()">
            <input id="dash-item-note" class="player-dash-add-item-note" type="text"
              placeholder="Notitie (optioneel)" maxlength="500"
              onkeydown="if(event.key==='Enter')window._dashAddItem()">
            <button class="player-dash-add-item-btn" onclick="window._dashAddItem()">+</button>
          </div>
        </div>

        <!-- Zegeningen & Vloeken — aparte sectie onder Jouw voorwerpen -->
        ${(() => {
          const goddelijk = simpleItems.filter(si => si.eed || si.zegen);
          if (!goddelijk.length) return '';
          const _renderGoddelijkSlide = (si) => {
            const isVloek = si.status === 'vloek';
            const isEed   = si.eed && !isVloek;
            const typeIcon  = isVloek ? icon('skull') : isEed ? icon('scroll-text') : icon('sparkles');
            const typeColor = isVloek ? '#c04040' : isEed ? '#c4a87a' : '#5a9060';
            const chargesHtml = si.zegen && si.usesMax ? `
              <div class="item-carousel-charges" onclick="event.stopPropagation()">
                <div class="item-charge-dots-row">
                  <div class="item-charge-dots">
                    ${Array.from({length: si.usesMax}, (_, i) =>
                      `<button class="spell-slot-dot ${i < (si.uses||0) ? 'free' : 'used'}"
                        onclick="window._dashZegenVerbruik()"></button>`).join('')}
                  </div>
                </div>
              </div>` : '';
            const linkHtml = si.entityId
              ? `<button class="herberg-bubble-card-btn" style="margin-top:8px;font-size:0.72rem;padding:3px 8px" onclick="window._openDetail('${esc(si.entityType||'voorwerpen')}','${esc(si.entityId)}')" title="Open kaartje">${icon('open-book')} Bekijk kaartje</button>`
              : '';
            const boeteHtml = isVloek ? `
              <div style="margin-top:8px">
                <button class="ts-wedden-btn" onclick="window._tempelBoete()">${icon('sparkles')} Doe boete in de tempel</button>
              </div>` : '';
            const entityNaam = si.entityId ? (allVoorwerpen.find(v => v.id === si.entityId)?.name || si.name) : si.name;
            const slideClick = si.entityId ? `onclick="window._openDetail('${esc(si.entityType||'voorwerpen')}','${esc(si.entityId)}')" style="cursor:pointer"` : '';
            const imgId = si.entityId || null;
            const godLabel = isVloek ? `Vloek van ${si.godNaam || ''}` : isEed ? `Eed aan ${si.godNaam || ''}` : `Zegen van ${si.godNaam || ''}`;
            const descTekst = allVoorwerpen.find(v => v.id === si.entityId)?.data?.desc || '';
            return `<div class="item-carousel-slide" ${slideClick}>
              ${imgId ? `<div class="item-carousel-img-wrap">
                <img src="${api.fileUrl(imgId)}" class="item-carousel-img"
                  onerror="this.closest('.item-carousel-img-wrap').style.display='none'">
              </div>` : ''}
              <div class="item-carousel-namerow">
                <span class="item-carousel-type-icon" style="color:${typeColor}">${typeIcon}</span>
                <span class="item-carousel-name">${esc(entityNaam)}</span>
                ${si.entityId ? `<span style="font-size:0.7rem;opacity:0.5;margin-left:4px" title="Bekijk kaartje">${icon('open-book')}</span>` : ''}
              </div>
              <div style="font-size:0.65rem;font-family:'Cinzel',serif;letter-spacing:.07em;text-transform:uppercase;color:rgba(100,75,30,0.6);margin-bottom:6px">${esc(godLabel)}</div>
              ${descTekst ? `<div class="item-carousel-desc" onclick="event.stopPropagation()">${mdToHtml(descTekst)}</div>` : ''}
              ${chargesHtml}
              ${boeteHtml}
            </div>`;
          };
          window._knapzakGoddelijkItems = goddelijk;
          window._knapzakGoddelijkIdx   = 0;
          window._knapzakGoddelijkGoTo  = (n) => {
            window._knapzakGoddelijkIdx = Math.max(0, Math.min(goddelijk.length - 1, n));
            const t = document.getElementById('goddelijk-carousel-track');
            if (t) t.innerHTML = _renderGoddelijkSlide(window._knapzakGoddelijkItems[window._knapzakGoddelijkIdx]);
            document.querySelectorAll('#goddelijk-carousel .item-carousel-dot').forEach((d,i) => d.classList.toggle('active', i === window._knapzakGoddelijkIdx));
            document.getElementById('goddelijk-nav-prev')?.style.setProperty('visibility', window._knapzakGoddelijkIdx <= 0 ? 'hidden' : 'visible');
            document.getElementById('goddelijk-nav-next')?.style.setProperty('visibility', window._knapzakGoddelijkIdx >= window._knapzakGoddelijkItems.length - 1 ? 'hidden' : 'visible');
          };
          window._knapzakGoddelijkNav = (d) => window._knapzakGoddelijkGoTo(window._knapzakGoddelijkIdx + d);
          const _dotsG = goddelijk.length > 1 ? `<div class="item-carousel-dots">${goddelijk.map((_,i) => `<button class="item-carousel-dot${i===0?' active':''}" onclick="window._knapzakGoddelijkGoTo(${i})"></button>`).join('')}</div>` : '';
          return `
            <div class="player-dash-section">
              <div class="player-dash-section-title">${icon('sparkles')} Zegeningen &amp; Vloeken</div>
              <div class="item-carousel" id="goddelijk-carousel">
                <button class="item-carousel-nav" id="goddelijk-nav-prev" onclick="window._knapzakGoddelijkNav(-1)" ${goddelijk.length <= 1 ? 'style="visibility:hidden"' : ''}>&#8249;</button>
                <div class="item-carousel-track" id="goddelijk-carousel-track">${_renderGoddelijkSlide(goddelijk[0])}</div>
                <button class="item-carousel-nav" id="goddelijk-nav-next" onclick="window._knapzakGoddelijkNav(1)" ${goddelijk.length <= 1 ? 'style="visibility:hidden"' : ''}>&#8250;</button>
              </div>
              ${_dotsG}
            </div>`;
        })()}
      </div>

      <!-- ═══ TAB: Progressie ═══ -->
      <div id="pst-progressie" class="player-subtab-panel${_playerSubTab !== 'progressie' ? ' hidden' : ''}"></div>

      <!-- ═══ TAB: Mijn spreukenboek ═══ -->
      <div id="pst-spreukenboek" class="player-subtab-panel${_playerSubTab !== 'spreukenboek' ? ' hidden' : ''}">
        <div style="display:flex;justify-content:flex-end;padding:4px 0 0">${_helpBtn('spreukenboek')}</div>

        <!-- Spreuk-statistieken -->
        <div class="player-spell-stats">
          <div class="player-spell-stat">
            <label class="player-spell-stat-label">Spell Save DC</label>
            <input class="player-spell-stat-input" type="number" min="1" max="30"
              value="${esc(playerProfile.spellSaveDC ?? '')}" placeholder="—"
              onblur="window._saveProfileField('spellSaveDC', this.value)">
          </div>
          <div class="player-spell-stat">
            <label class="player-spell-stat-label">Attack Bonus</label>
            <div class="player-spell-stat-atk-wrap">
              <span class="atk-bonus-prefix">+</span>
              <input class="player-spell-stat-input" type="number" min="-5" max="20"
                value="${esc(playerProfile.spellAttackBonus ?? '')}" placeholder="0"
                onblur="window._saveProfileField('spellAttackBonus', this.value)">
            </div>
          </div>
        </div>

        <!-- Spreukenslots -->
        <div class="player-dash-section player-dash-spellslots">
          <div class="player-dash-section-title">${icon('flask-conical')} Spreukenslots</div>
          ${_spellSlotsHTML.rows || '<p class="player-dash-empty">Nog geen spreukenslots ingesteld.</p>'}
          <button class="player-dash-slot-add-btn" onclick="window._dashSlotAddLevel()">+</button>
        </div>

        <!-- Spreukenboek openen -->
        <div class="player-dash-section" id="sb-open-section">
          <div class="player-dash-section-title">${icon('book-open')} Spreukenboek</div>
          <p class="player-dash-empty" style="margin:8px 0 10px">
            ${pinnedSpells.length > 0
              ? `${pinnedSpells.length} ${pinnedSpells.length === 1 ? 'spreuk' : 'spreuken'} in je boek. Open het boek om spreuken te bekijken, toe te voegen of te verwijderen.`
              : 'Je spreukenboek is nog leeg. Open het boek en gebruik "Inhoud" om spreuken toe te voegen.'}
          </p>
          <button class="sb-open-btn" onclick="window._sbUserClosed=false; window._openSpellbook()">
            ${icon('book-open')} Open spreukenboek
          </button>
        </div>
      </div>

      <!-- ═══ TAB: Berichten ═══ -->
      <div id="pst-berichten" class="player-subtab-panel${_playerSubTab !== 'berichten' ? ' hidden' : ''}">

        <!-- Bladwijzers -->
        ${(state.bookmarks || []).length > 0 ? `
        <div class="player-dash-section">
          <div class="player-dash-section-title">${icon('star')} Bladwijzers</div>
          <div class="player-bookmarks-list">
            ${(state.bookmarks || []).map(b => `
              <div class="player-bookmark-item" data-bid="${esc(b.id)}" onclick="window._navigateTo('${esc(b.type)}','${esc(b.name)}')">
                <span class="player-bookmark-icon">${b.type === 'personages' ? icon('user') : b.type === 'locaties' ? icon('map-pin') : b.type === 'organisaties' ? icon('building') : icon('package')}</span>
                <span class="player-bookmark-name">${esc(b.name)}</span>
                <button class="player-bookmark-remove" onclick="event.stopPropagation();window._toggleBookmark('${esc(b.type)}','${esc(b.id)}','${esc(b.name)}')" title="Verwijderen">${icon('x')}</button>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        ${(() => {
          const brieven   = berichtenLijst.filter(m => m.type === 'brief');
          const berichten = berichtenLijst.filter(m => m.type !== 'brief');
          let out = '';

          // Brieven (document-kaarten)
          if (brieven.length > 0) {
            out += `<div class="player-dash-section">
              <div class="player-dash-section-title">${icon('mail')} Brieven &amp; berichten</div>
              ${brieven.map(m => `
                <div class="speler-brief-card${m.gelezen ? '' : ' speler-brief-card--nieuw'}${m.thema ? ` speler-brief-card--${esc(m.thema)}` : ''}${m.thema === 'factie' && !m.gelezen ? ' speler-brief-card--verzegeld' : ''}" data-mid="${esc(m.id)}"${m.thema === 'factie' ? ` style="--brief-kleur:${_factieKleurHex(m.kleur)}"` : ''} onclick="window._briefToggle('${esc(m.id)}')">
                  ${m.thema ? `<div class="speler-brief-letterhead speler-brief-letterhead--${esc(m.thema)}">${_briefLetterhead(m)}</div>` : ''}
                  <div class="speler-brief-header">
                    <div class="speler-brief-header-main">
                      ${m.titel ? `<div class="speler-brief-titel">${esc(m.titel)}</div>` : ''}
                      ${m.afzender ? `<div class="speler-brief-afzender-inline">van <em>${esc(m.afzender)}</em></div>` : ''}
                      <div class="speler-brief-meta-inline">${m.datum ? m.datum : _fmtBerichtDate(m.timestamp)}${m.gelezen ? '' : ' · <strong>nieuw</strong>'}</div>
                    </div>
                    <span class="speler-brief-chevron">▾</span>
                    <button class="bericht-del-btn speler-brief-trash" title="Weggooien" onclick="event.stopPropagation();window._briefPlayerDelete('${esc(m.id)}')">${icon('trash')}</button>
                  </div>
                  <div class="speler-brief-body">
                    ${m.afzender ? `<div class="speler-brief-afzender">
                      Van: <em>${esc(m.afzender)}</em>${m.entityId ? ` <button class="herberg-bubble-card-btn" style="font-size:0.65rem;padding:1px 4px;line-height:1.3;margin-left:3px" onclick="event.stopPropagation();window._openDetail('${esc(m.entityType)}','${esc(m.entityId)}')" title="Open kaartje">↗</button>` : ''}
                    </div>` : ''}
                    <div class="speler-brief-tekst">${mdToHtml(m.tekst).replace(/👁/g,icon('eye')).replace(/👂/g,icon('zap')).replace(/👃/g,icon('flask-conical')).replace(/👅/g,icon('potion')).replace(/✋/g,icon('heart'))}</div>
                  </div>
                </div>`).join('')}
            </div>`;
          }

          // Gewone geheime berichten (tekstbubbles)
          if (berichten.length > 0) {
            out += `<div class="player-dash-section">
              <div class="player-dash-section-title">${icon('message-circle')} Geheime berichten</div>
              ${berichten.slice().reverse().map(m => `
                <div class="speler-bericht-item${m.gelezen ? '' : ' speler-bericht-item--nieuw'}"
                  data-mid="${esc(m.id)}" onclick="window._berichtMarkGelezen('${esc(m.id)}')">
                  <div class="speler-bericht-row">
                    <div class="speler-bericht-tekst">${esc(m.tekst)}</div>
                    <button class="bericht-del-btn" title="Verwijder" onclick="event.stopPropagation();window._berichtPlayerDelete('${esc(m.id)}')">${icon('x')}</button>
                  </div>
                  <div class="speler-bericht-meta">${_fmtBerichtDate(m.timestamp)}${m.gelezen ? '' : ' · <strong>nieuw</strong>'}</div>
                </div>`).join('')}
            </div>`;
          }

          if (brieven.length === 0 && berichten.length === 0) {
            out += `<div class="player-dash-section">
              <div class="player-dash-section-title">${icon('message-circle')} Berichten</div>
              <p class="player-dash-empty">Nog geen berichten ontvangen.</p>
            </div>`;
          }

          return out;
        })()}
      </div>

    </div>`;

  // ── Progressie: sla context op; render via requestAnimationFrame zodat
  //    de DOM zeker stable is en geen re-render de content overschrijft ──
  const _isMulti = playerProfile.multiclass === 'true' || playerProfile.multiclass === true;
  window._lastProgCtx = {
    klasse:           playerProfile.klasse || entity?.data?.klasse || '',
    klasseLevel:      _isMulti ? (parseInt(playerProfile.klasseLevel) || parseInt(playerProfile.level) || 1) : (parseInt(playerProfile.level) || 1),
    level:            parseInt(playerProfile.level) || 1,
    subclass:         playerProfile.subclass || '',
    multiclass:       _isMulti,
    multiKlasse:      playerProfile.multiKlasse || '',
    multiKlasseLevel: parseInt(playerProfile.multiKlasseLevel) || 0,
    species:          playerProfile.origin || entity?.data?.ras || playerProfile.ras || '',
    background:        playerProfile.background || '',
    charId:           charId || null,
    favorites:        (() => { try { return JSON.parse(playerProfile.featFavorites || '[]'); } catch { return []; } })(),
    choices:          (() => { try { return JSON.parse(playerProfile.featChoices   || '{}'); } catch { return {}; } })(),
  };
  // Render progressie alleen als de tab actief is (anders is het verspilling)
  if (_playerSubTab === 'progressie') {
    const _pmEl = document.getElementById('pst-progressie');
    if (_pmEl) renderProgressie(_pmEl, window._lastProgCtx);
  }

  // #1: zodra de speler klaar is met het bewerken van de profielvelden (focus
  // verlaat de sectie) een eventuele pending Kenmerk-refresh verwerken.
  const _profFields = document.querySelector('.player-profile-fields');
  if (_profFields) {
    _profFields.addEventListener('focusout', (e) => {
      if (_profFields.contains(e.relatedTarget)) return; // focus blijft binnen de velden
      if (window._pendingKarakterRefresh && state.activeSection === 'mijn-karakter') {
        setTimeout(() => {
          if (window._pendingKarakterRefresh && !document.querySelector('.player-profile-fields')?.contains(document.activeElement)) {
            window.app.refreshSection('mijn-karakter');
          }
        }, 200);
      }
    });
  }

  // ── Spreuk-accordion: beschrijving lazy laden ──
  document.querySelectorAll('.player-spell-accordion').forEach(details => {
    details.addEventListener('toggle', async function() {
      if (!this.open) return;
      const body = this.querySelector('.player-spell-accordion-body');
      if (!body || body.dataset.loaded === 'true') return;
      const index  = body.dataset.spellIndex;
      const source = body.dataset.spellSource;
      const stored = body.dataset.spellDesc;
      // Eigen spreuk: gebruik opgeslagen beschrijving
      if (source === 'custom' || index?.startsWith('custom_')) {
        const sp = pinnedSpells.find(s => s.index === index) || {};
        const compsStr = typeof sp.components === 'string' ? sp.components
                       : Array.isArray(sp.components) ? sp.components.join(', ') : '';
        const customMeta = [
          sp.casting_time ? `Casting Time: ${sp.casting_time}` : '',
          sp.range        ? `Range: ${sp.range}`               : '',
          compsStr        ? `Components: ${compsStr}`          : '',
          sp.duration     ? `Duration: ${sp.duration}`         : '',
        ].filter(Boolean);
        const metaHtml = customMeta.length
          ? `<div class="player-spell-meta2">${customMeta.join(' · ')}</div>` : '';
        const _incantHtmlC = sp.incantation
          ? `<div class="spell-incantation"><span class="spell-incantation-icon">✦</span> "${esc(sp.incantation)}"</div>` : '';
        body.innerHTML = metaHtml
          + _incantHtmlC
          + (stored
            ? (() => { const h = _renderSpellDesc(stored, {}); return `<div class="player-spell-desc">${window.glossary?.annotate?.(h) ?? h}</div>`; })()
            : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>')
          + _buildSpellEditForm(index, body);
        body.dataset.loaded = 'true';
        _attachSpellEditListeners(body, index, charId);
        return;
      }
      try {
        let s;
        if (_isHpCampaign()) {
          if (!_playerSpellList) {
            const r = await fetch('/api/bron/hp-spells');
            const d = await r.json();
            _playerSpellList = d.results || [];
          }
          s = _playerSpellList.find(sp => sp.index === index) || {};
        } else {
          const r = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
          s = await r.json();
        }
        // #22: tijdens de await kan de accordion gesloten of de tab her-rendered
        // zijn — dan is `body` losgekoppeld. Niet schrijven naar een dode node.
        if (!body.isConnected) return;
        const rawDescArr = s.desc || [];
        const descHtml = _renderSpellDesc(rawDescArr.join('\n\n'), {});
        const desc = window.glossary?.annotate?.(descHtml) ?? descHtml;
        const higher = s.higher_level?.length
          ? `<p class="player-spell-higher"><strong>At Higher Levels:</strong> ${_spellMd(s.higher_level.join(' '))}</p>` : '';
        const componentsStr = s.components?.length
          ? s.components.join(', ') + (s.material ? ` (${s.material})` : '') : '';
        const metaParts = [
          s.casting_time  ? `Casting Time: ${s.casting_time}` : '',
          s.range         ? `Range: ${s.range}` : '',
          componentsStr   ? `Components: ${componentsStr}` : '',
          s.duration      ? `Duration: ${s.duration}` : '',
          s.concentration ? 'Concentration' : '',
        ].filter(Boolean);
        const _pinnedSp    = pinnedSpells.find(ps => ps.index === index) || {};
        const _incantHtmlS = _pinnedSp.incantation
          ? `<div class="spell-incantation"><span class="spell-incantation-icon">✦</span> "${esc(_pinnedSp.incantation)}"</div>` : '';
        body.innerHTML = `
          ${metaParts.length ? `<div class="player-spell-meta2">${metaParts.join(' · ')}</div>` : ''}
          ${_incantHtmlS}
          <div class="player-spell-desc">${desc || ''}</div>
          ${higher}
          ${_buildSpellEditForm(index, body)}`;
        body.dataset.loaded = 'true';
        _attachSpellEditListeners(body, index, charId);
      } catch {
        if (body.isConnected) body.innerHTML = '<p class="player-spell-err">Beschrijving kon niet worden geladen.</p>';
      }
    });
  });

  // ── Kenmerk-accordion: lazy laden ──
  let _playerTraitList = null; // cache

  // Voeg onderaan de accordeon-body een uses-configuratierij toe
  function _appendTraitUsesRow(body) {
    const traitId = body.dataset.traitId;
    if (!traitId) return;
    const maxUses = parseInt(body.dataset.maxUses) || 0;
    const row = document.createElement('div');
    row.className = 'trait-uses-config';
    row.innerHTML = `<span class="trait-uses-label">Aantal:</span>
      <button class="skill-adj-btn" onclick="window._traitAdjUses('${esc(traitId)}', -1)" title="Minder">−</button>
      <span class="trait-uses-count-cfg">${maxUses}</span>
      <button class="skill-adj-btn" onclick="window._traitAdjUses('${esc(traitId)}', 1)" title="Meer">+</button>`;
    body.appendChild(row);
  }

  function _appendTraitNoteSection(body) {
    const traitId = body.dataset.traitId;
    if (!traitId) return;
    const note = body.dataset.note || '';
    const wrap = document.createElement('div');
    wrap.className = 'trait-note-section';
    wrap.dataset.traitId = traitId;
    wrap.innerHTML = _traitNoteSectionHtml(traitId, note);
    body.appendChild(wrap);
  }

  function _traitNoteSectionHtml(traitId, note) {
    return `
      ${note ? `<div class="trait-note-display">
        <p class="trait-note-text">${esc(note).replace(/\n/g, '<br>')}</p>
        <div class="trait-note-actions">
          <button class="trait-note-icon-btn" onclick="window._traitNoteEdit('${esc(traitId)}')" title="Bewerken">${icon('pencil')}</button>
          <button class="trait-note-icon-btn trait-note-icon-del" onclick="window._traitNoteDelete('${esc(traitId)}')" title="Verwijderen">${icon('trash')}</button>
        </div>
      </div>` : `
        <button class="trait-note-icon-btn" onclick="window._traitNoteEdit('${esc(traitId)}')" title="Opmerking toevoegen">${icon('pencil')}</button>
      `}
      <div class="trait-note-form hidden">
        <textarea class="trait-note-ta" placeholder="Jouw persoonlijke aantekening bij dit kenmerk…" rows="3">${esc(note)}</textarea>
        <div class="trait-note-form-btns">
          <button class="trait-note-save" onclick="window._traitNoteSave('${esc(traitId)}')">Opslaan</button>
          <button class="trait-note-cancel" onclick="window._traitNoteCancel('${esc(traitId)}')">Annuleer</button>
        </div>
      </div>`;
  }

  document.querySelectorAll('.player-trait-accordion').forEach(details => {
    details.addEventListener('toggle', async function() {
      if (!this.open) return;
      const body = this.querySelector('.player-spell-accordion-body');
      if (!body || body.dataset.loaded === 'true') return;
      const source = body.dataset.traitSource;
      const index  = body.dataset.traitIndex;
      const stored = body.dataset.traitDesc;

      // Opgeslagen beschrijving heeft voorrang (custom én progressie-gesyncte
      // features dragen hun eigen tekst; alleen 'kale' PHB-traits hebben er geen).
      if (stored || source === 'custom' || source === 'progression') {
        body.innerHTML = stored
          ? `<div class="player-spell-desc">${mdToHtml(stored)}</div>`
          : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>';
        body.dataset.loaded = 'true';
        _appendTraitUsesRow(body);
        _appendTraitNoteSection(body);
        return;
      }
      // PHB zonder opgeslagen tekst: ophalen via dnd5eapi — source bepaalt endpoint
      try {
        if (!index) throw new Error('geen index');
        // Backward compat: 'phb' → features, 'phb-features' → features, 'phb-traits' → traits, 'phb-feats' → feats
        const apiType = source === 'phb-traits' ? 'traits'
                      : source === 'phb-feats'  ? 'feats'
                      : 'features';
        const r = await fetch(`https://www.dnd5eapi.co/api/${apiType}/${index}`);
        const f = await r.json();
        if (!body.isConnected) return;   // #22: accordion gesloten/her-rendered tijdens fetch
        const _md = t => String(t)
          .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
        const desc = (f.desc || []).map(_md).join('<br><br>');
        let metaParts = [];
        if (apiType === 'features') {
          metaParts = [
            f.class?.name ? `Class: ${f.class.name}` : '',
            f.subclass?.name ? `Subclass: ${f.subclass.name}` : '',
            f.level ? `Level ${f.level}` : '',
          ].filter(Boolean);
        } else if (apiType === 'traits') {
          const races = (f.races || []).map(x => x.name).join(', ');
          if (races) metaParts = [`Race: ${races}`];
        } else if (apiType === 'feats') {
          const prereq = (f.prerequisites || []).map(p => p.ability_score?.name || '').filter(Boolean);
          if (prereq.length) metaParts = [`Prerequisite: ${prereq.join(', ')}`];
        }
        body.innerHTML = `
          ${metaParts.length ? `<div class="player-spell-meta2">${metaParts.join(' · ')}</div>` : ''}
          <div class="player-spell-desc">${desc || '<em>Geen beschrijving beschikbaar.</em>'}</div>`;
        body.dataset.loaded = 'true';
        _appendTraitUsesRow(body);
        _appendTraitNoteSection(body);
      } catch {
        if (!body.isConnected) return;
        body.innerHTML = '<p class="player-spell-err">Beschrijving kon niet worden geladen.</p>';
        _appendTraitUsesRow(body);
        _appendTraitNoteSection(body);
      }
    });
  });

  // ── Kenmerk-zoeker (PHB via dnd5eapi.co — features + traits + feats) ──
  window._playerTraitSearch = async function(q) {
    const resultsEl = document.getElementById('player-trait-results');
    if (!resultsEl) return;
    const query = q.toLowerCase().trim();
    if (!query) { resultsEl.innerHTML = ''; return; }
    if (!_playerTraitList) {
      resultsEl.innerHTML = '<div class="player-spell-loading">Laden…</div>';
      try {
        const [rf, rt, rft] = await Promise.all([
          fetch('https://www.dnd5eapi.co/api/features').then(r => r.json()),
          fetch('https://www.dnd5eapi.co/api/traits').then(r => r.json()),
          fetch('https://www.dnd5eapi.co/api/feats').then(r => r.json()),
        ]);
        _playerTraitList = [
          ...(rf.results  || []).map(x => ({ ...x, _apiType: 'features' })),
          ...(rt.results  || []).map(x => ({ ...x, _apiType: 'traits'   })),
          ...(rft.results || []).map(x => ({ ...x, _apiType: 'feats'    })),
        ];
      } catch { _playerTraitList = []; }
    }
    const filtered = _playerTraitList.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
    const pinned = pinnedTraits.map(t => t.index);
    const typeLabel = { features: 'Klasse', traits: 'Ras', feats: 'Feat' };
    resultsEl.innerHTML = filtered.length
      ? filtered.map(f => `
          <div class="player-spell-result${pinned.includes(f.index) ? ' pinned' : ''}"
            data-trait-idx="${esc(f.index)}" data-trait-nm="${esc(f.name)}" data-trait-type="${f._apiType || 'features'}"
            onclick="window._playerTraitPinByEl(this)">
            ${esc(f.name)}
            <span class="player-trait-type-badge">${typeLabel[f._apiType] || ''}</span>
            <span class="player-spell-pin-icon">${pinned.includes(f.index) ? '✓' : '📌'}</span>
          </div>`).join('')
      : '<div class="player-spell-noresult">Geen kenmerken gevonden</div>';
  };

  window._playerTraitPinByEl = function(el) {
    window._playerTraitPin(el.dataset.traitIdx, el.dataset.traitNm, el.dataset.traitType);
  };

  window._playerTraitPin = async function(index, name, apiType) {
    if (!charId) return;
    if (pinnedTraits.find(t => t.index === index)) return;
    const type = apiType || 'features';
    const source = 'phb-' + type;
    let meta = '';
    try {
      const r = await fetch(`https://www.dnd5eapi.co/api/${type}/${index}`);
      const f = await r.json();
      if (type === 'features') {
        const parts = [f.class?.name, f.level ? `Niv. ${f.level}` : ''].filter(Boolean);
        meta = parts.join(' · ');
      } else if (type === 'traits') {
        meta = (f.races || []).map(x => x.name).join(', ');
      } else if (type === 'feats') {
        const prereq = (f.prerequisites || []).map(p => p.ability_score?.name || '').filter(Boolean);
        meta = prereq.length ? `Vereiste: ${prereq.join(', ')}` : 'Feat';
      }
    } catch { /* ok, zonder meta */ }
    await api.addPlayerTrait(charId, { index, name, source, meta });
    const inp = document.getElementById('player-trait-input');
    if (inp) inp.value = '';
    const res = document.getElementById('player-trait-results');
    if (res) res.innerHTML = '';
    renderMijnKarakter(opts);
  };

  window._dashOpenPortraitVideo = function() {
    const wrap = document.querySelector('.player-dash-avatar-wrap');
    if (!wrap) return;
    let vid = wrap.querySelector('.portrait-inline-video');
    if (!vid) {
      vid = document.createElement('video');
      vid.className = 'portrait-inline-video';
      vid.autoplay = true;
      vid.playsInline = true;
      vid.muted = false;
      vid.innerHTML = `<source src="/api/files/${charId}_video" type="video/mp4">`;
      vid.addEventListener('click', e => { e.stopPropagation(); wrap.classList.remove('portrait-showing-video'); vid.pause(); });
      wrap.appendChild(vid);
    }
    const showing = wrap.classList.toggle('portrait-showing-video');
    if (showing) { vid.load(); vid.play().catch(() => {}); }
    else { vid.pause(); }
  };

  window._toggleSpellFav = async function(index, level, btnEl) {
    let favs = (() => { try { return JSON.parse(playerProfile.spellFavorites || '[]'); } catch { return []; } })();
    const idx = favs.indexOf(index);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(index);
    const isOn = idx < 0; // true = now on
    // Optimistic UI update: toggle star immediately without full re-render
    if (btnEl) {
      btnEl.classList.toggle('spell-fav-btn--on', isOn);
      btnEl.title = isOn ? 'Verwijder uit favorieten' : 'Markeer als favoriet';
    }
    // Update level chip color
    const chip = document.querySelector(`.spell-lvl-chip[data-lvl="${level}"]`);
    if (chip) {
      const stillHasFav = favs.some(f => {
        const s = (window._knapzakCarouselItems || []).find ? null : null;
        return true; // we'll fix on full re-render
      });
      chip.classList.toggle('spell-lvl-chip--fav', isOn || chip.classList.contains('spell-lvl-chip--fav'));
    }
    playerProfile.spellFavorites = JSON.stringify(favs);
    await window._saveProfileField('spellFavorites', JSON.stringify(favs));
    renderMijnKarakter(opts);
  };

  window._playerTraitDelete = async function(traitId) {
    if (!charId) return;
    const t = pinnedTraits.find(x => x.id === traitId);
    const name = t?.name || 'dit kenmerk';
    if (!confirm(`Wil je "${name}" verwijderen?`)) return;
    await api.deletePlayerTrait(charId, traitId);
    renderMijnKarakter(opts);
  };

  // ── Trait uses: bolletje aan/uit klikken ──
  // Helper: dots + teller in-place updaten zonder de hele pagina te her-renderen
  function _updateTraitDotsDOM(traitId, newMax, newCur) {
    const details = document.querySelector(`.player-trait-accordion[data-trait-id="${traitId}"]`);
    if (!details) return;
    // Update data-max-uses op body
    const body = details.querySelector('.player-spell-accordion-body');
    if (body) body.dataset.maxUses = newMax;
    // Update het getal in de config-rij
    const countCfg = details.querySelector('.trait-uses-count-cfg');
    if (countCfg) countCfg.textContent = newMax;
    // Update de bolletjes in de summary
    const summary = details.querySelector('summary');
    if (!summary) return;
    const dotsWrap = summary.querySelector('.trait-uses-dots');
    if (newMax === 0) {
      dotsWrap?.remove();
    } else {
      const safeId = traitId.replace(/'/g, "\\'");
      const newHtml = Array.from({length: newMax}, (_, i) =>
        `<button class="spell-slot-dot ${i < newCur ? 'used' : 'free'}"
          onclick="event.preventDefault();event.stopPropagation();window._traitToggleUse('${safeId}',${i},${newMax},${newCur})"
          title="${i < newCur ? 'Verbruikt' : 'Vrij'}"></button>`
      ).join('') + `<span class="trait-uses-count">${newCur}/${newMax}</span>`;
      if (dotsWrap) {
        dotsWrap.innerHTML = newHtml;
      } else {
        const span = document.createElement('span');
        span.className = 'trait-uses-dots';
        span.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
        span.innerHTML = newHtml;
        const delBtn = summary.querySelector('.player-pinned-spell-del');
        delBtn ? summary.insertBefore(span, delBtn) : summary.appendChild(span);
      }
    }
  }

  // Hit Dice-stand (verbruikt) na-laden op de sheet
  window._loadSheetHitDice?.(charId, playerProfile);

  window._traitToggleUse = async function(traitId, idx, maxUses, currentUses) {
    const newCur = Math.min(Math.max(0, idx < currentUses ? currentUses - 1 : currentUses + 1), maxUses);
    const t = pinnedTraits.find(x => x.id === traitId);
    try {
      await api.patchPlayerTrait(charId, traitId, { currentUses: newCur });
      if (t) t.currentUses = newCur;
      _updateTraitDotsDOM(traitId, maxUses, newCur);
    } catch { /* ok */ }
  };

  // ── Trait uses: aantal aanpassen ──
  window._traitAdjUses = async function(traitId, delta) {
    const t = pinnedTraits.find(x => x.id === traitId);
    if (!t) return;
    const newMax = Math.max(0, Math.min(20, (t.maxUses || 0) + delta));
    const newCur = Math.min(t.currentUses || 0, newMax);
    try {
      await api.patchPlayerTrait(charId, traitId, { maxUses: newMax, currentUses: newCur });
      t.maxUses = newMax;
      t.currentUses = newCur;
      _updateTraitDotsDOM(traitId, newMax, newCur);
    } catch { /* ok */ }
  };

  // ── Kenmerk: persoonlijke opmerking ──
  window._traitNoteEdit = function(traitId) {
    const wrap = document.querySelector(`.trait-note-section[data-trait-id="${traitId}"]`);
    if (!wrap) return;
    wrap.querySelector('.trait-note-form')?.classList.toggle('hidden');
    wrap.querySelector('.trait-note-ta')?.focus();
  };

  window._traitNoteCancel = function(traitId) {
    document.querySelector(`.trait-note-section[data-trait-id="${traitId}"]`)
      ?.querySelector('.trait-note-form')?.classList.add('hidden');
  };

  window._traitNoteDelete = async function(traitId) {
    try {
      await api.patchPlayerTrait(charId, traitId, { note: '' });
      const t = pinnedTraits.find(x => x.id === traitId);
      if (t) t.note = '';
      const body = document.querySelector(`.player-spell-accordion-body[data-trait-id="${traitId}"]`);
      if (body) body.dataset.note = '';
      const wrap = document.querySelector(`.trait-note-section[data-trait-id="${traitId}"]`);
      if (wrap) wrap.innerHTML = _traitNoteSectionHtml(traitId, '');
    } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
  };

  window._traitNoteSave = async function(traitId) {
    const wrap = document.querySelector(`.trait-note-section[data-trait-id="${traitId}"]`);
    if (!wrap) return;
    const note = (wrap.querySelector('.trait-note-ta')?.value || '').trim();
    try {
      await api.patchPlayerTrait(charId, traitId, { note });
      const t = pinnedTraits.find(x => x.id === traitId);
      if (t) t.note = note;
      const body = wrap.closest('.player-spell-accordion-body');
      if (body) body.dataset.note = note;
      // Herteken de notitiesectie in-place
      wrap.innerHTML = _traitNoteSectionHtml(traitId, note);
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  };

  // ── Kenmerk: eigen aanmaken ──
  window._traitCustomOpen = function() {
    document.getElementById('player-trait-custom-form')?.classList.remove('hidden');
    document.getElementById('ptf-name')?.focus();
  };
  window._traitCustomClose = function() {
    const form = document.getElementById('player-trait-custom-form');
    if (!form) return;
    form.classList.add('hidden');
    form.querySelectorAll('input,textarea').forEach(el => { el.value = ''; });
  };
  window._traitCustomSave = async function() {
    const name = document.getElementById('ptf-name')?.value.trim();
    const meta = document.getElementById('ptf-meta')?.value.trim();
    const desc = document.getElementById('ptf-desc')?.value.trim();
    if (!name || !charId) return;
    await api.addPlayerTrait(charId, { name, meta, desc, source: 'custom' });
    window._traitCustomClose();
    renderMijnKarakter(opts);
  };

  // Profiel-velden opslaan
  window._saveProfileField = async function(field, value) {
    if (!charId) return;
    try {
      await api.patchPlayerProfile(charId, { [field]: value });
      playerProfile[field] = value;
    } catch (e) { console.warn('Profiel opslaan mislukt', e); return; }
    // Na level- of klassewijziging: sync nieuwe features naar Kenmerken & Eigenschappen
    const syncFields = new Set(['level', 'klasseLevel', 'klasse', 'subclass', 'multiKlasseLevel', 'multiKlasse']);
    if (syncFields.has(field) && window.progressie?.triggerSync) {
      const _ctxMulti = playerProfile.multiclass === 'true' || playerProfile.multiclass === true;
      const ctx = {
        klasse:           playerProfile.klasse           || '',
        subclass:         playerProfile.subclass         || '',
        klasseLevel:      _ctxMulti ? (parseInt(playerProfile.klasseLevel) || parseInt(playerProfile.level) || 1) : (parseInt(playerProfile.level) || 1),
        level:            parseInt(playerProfile.level)  || 1,
        multiKlasse:      playerProfile.multiKlasse      || '',
        multiKlasseLevel: parseInt(playerProfile.multiKlasseLevel) || 0,
      };
      // Sync features naar Kenmerken; de re-render volgt via de (gerguarde)
      // player:profile-updated socket-echo — niet hier forceren, anders wordt
      // de speler tijdens het invullen uit het veld gegooid.
      window.progressie.triggerSync(charId, ctx).then(() => {
        window._pendingKarakterRefresh = true;
      });
    }
  };

  // Multiclass toggle
  window._toggleMulticlass = async function() {
    const cur = playerProfile.multiclass === 'true' || playerProfile.multiclass === true;
    await window._saveProfileField('multiclass', cur ? '' : 'true');
    window.app.refreshSection('mijn-karakter');
  };

  // Reactief icon + theme updaten na level-/klassewijziging
  window._updateMulticlassTheme = function() {
    const klass  = document.getElementById('ppf-klasse-select')?.value || '';
    const mklass = document.getElementById('ppf-multi-select')?.value || '';
    const kLvl   = parseInt(document.getElementById('ppf-klasse-level')?.value) || 0;
    const mkLvl  = parseInt(document.getElementById('ppf-multi-level')?.value) || 0;
    const dominant = (mklass && mkLvl > kLvl) ? mklass : klass;
    // Theme
    const dash = document.querySelector('.player-dashboard');
    if (dash) {
      const key = dominant.toLowerCase().replace(/\s+/g, '-');
      if (_klasseThemeOn && key) dash.setAttribute('data-klasse', key);
      else dash.removeAttribute('data-klasse');
    }
  };

  // ── Wapens & Damage Cantrips ──
  window._addWeapon = async function() {
    weapons.push({ name: '', atk: '', dmg: '', props: [] });
    await api.patchPlayerProfile(charId, { weapons: JSON.stringify(weapons) }).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._deleteWeapon = async function(idx) {
    weapons.splice(idx, 1);
    await api.patchPlayerProfile(charId, { weapons: JSON.stringify(weapons) }).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._saveWeapon = async function(idx, field, value) {
    if (!weapons[idx]) return;
    weapons[idx][field] = value;
    await api.patchPlayerProfile(charId, { weapons: JSON.stringify(weapons) }).catch(() => {});
    // Geen re-render: de speler kan nog andere velden op dezelfde rij bewerken
  };

  // Wapeneigenschap aan/uit togglen (chip). Parameteriseerbare props tonen een invulveld.
  // Herrender alleen de eigenschappen-blok van één wapenrij (behoudt open/dicht-state).
  const _rerenderWeaponProps = (idx) => {
    const el = document.getElementById('wprops-' + idx);
    if (el) el.outerHTML = _weaponPropsPickerHtml(weapons[idx], idx);
  };

  // Klap de volledige keuzelijst open/dicht voor één wapen.
  window._toggleWeaponPropsPicker = function(idx) {
    if (_openWeaponProps.has(idx)) _openWeaponProps.delete(idx);
    else _openWeaponProps.add(idx);
    _rerenderWeaponProps(idx);
  };

  window._toggleWeaponProp = function(idx, prop) {
    const w = weapons[idx];
    if (!w) return;
    if (!Array.isArray(w.props)) w.props = [];
    const pIdx = w.props.findIndex(s => s === prop || s.startsWith(prop + ' ('));
    let focusParam = false;
    if (pIdx >= 0) {
      w.props.splice(pIdx, 1);
    } else {
      w.props.push(prop);
      focusParam = PARAMETERIZABLE_PROPS.has(prop) && _openWeaponProps.has(idx);
    }
    window._saveWeapon(idx, 'props', w.props);
    _rerenderWeaponProps(idx);
    if (focusParam) {
      const inp = document.getElementById('wpp-' + idx + '-' + prop.replace(/[^a-zA-Z0-9]/g, '_'));
      inp?.focus();
    }
  };

  // Parameterwaarde (bv. "20/60") opslaan bij een ingeschakelde parameteriseerbare prop.
  window._updateWeaponPropParam = function(idx, baseProp, paramVal) {
    const w = weapons[idx];
    if (!w || !Array.isArray(w.props)) return;
    const pIdx = w.props.findIndex(s => s === baseProp || s.startsWith(baseProp + ' ('));
    if (pIdx < 0) return;
    w.props[pIdx] = paramVal.trim() ? `${baseProp} (${paramVal.trim()})` : baseProp;
    window._saveWeapon(idx, 'props', w.props);
    _rerenderWeaponProps(idx);
  };

  // HP-helpers voor het dashboard
  window._dashHpSave = async function() {
    const cur = parseInt(document.getElementById('dash-hp-current')?.value);
    const max = parseInt(document.getElementById('dash-hp-max')?.value);
    if (isNaN(cur) && isNaN(max)) return;
    const payload = {};
    if (!isNaN(cur)) payload.current = cur;
    if (!isNaN(max)) payload.max = max;
    try {
      await api.setPlayerHp(charId, payload);
      // Als in gevecht: ook combatant updaten
      if (myCombatant && !isNaN(cur)) {
        await api.combatPlayerHp(myCombatant.id, cur).catch(() => {});
      }
      // Herlaad de HP-balk
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashHpChange = async function(delta) {
    const curEl = document.getElementById('dash-hp-current');
    const cur = parseInt(curEl?.value) || 0;
    const max = parseInt(document.getElementById('dash-hp-max')?.value) || 999;
    const newHp = Math.max(0, Math.min(max, cur + delta));
    if (curEl) curEl.value = newHp;
    try {
      await api.setPlayerHp(charId, { current: newHp });
      if (myCombatant) await api.combatPlayerHp(myCombatant.id, newHp).catch(() => {});
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashTempHpSave = async function() {
    const val = parseInt(document.getElementById('dash-hp-temp')?.value);
    if (isNaN(val)) return;
    try {
      await api.setPlayerHp(charId, { temp: Math.max(0, val) });
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashTempHpChange = async function(delta) {
    const el = document.getElementById('dash-hp-temp');
    const cur = parseInt(el?.value) || 0;
    const newTemp = Math.max(0, cur + delta);
    if (el) el.value = newTemp;
    try {
      await api.setPlayerHp(charId, { temp: newTemp });
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashEmote = function(emoteId) {
    if (!charId) return;
    if (combat?.active) {
      // Tijdens gevecht: relay via socket → DM-browser speelt geluid af (op ID)
      if (window._socket) {
        window._socket.emit('sound:emote', { entityId: charId, emoteId });
      }
    } else {
      // Buiten gevecht: speel geluid af op het eigen apparaat
      const item = emoteLibrary.find(e => e.id === emoteId);
      if (item?.fileId) new Audio(`/api/files/${item.fileId}`).play().catch(() => {});
    }
  };

  window._dashAddItem = async function() {
    const nameEl = document.getElementById('dash-item-name');
    const noteEl = document.getElementById('dash-item-note');
    const name = nameEl?.value?.trim();
    if (!name) { nameEl?.focus(); return; }
    try {
      await api.addPlayerItem(charId, { name, note: noteEl?.value?.trim() || '' });
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashRemoveItem = async function(itemId) {
    try {
      await api.removePlayerItem(charId, itemId);
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashZegenVerbruik = async function() {
    try {
      await api.tempelVerbruik();
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  // ── Stapelbaar voorwerp: qty aanpassen ──
  window._dashQtyAdj = async function(itemId, characterId, delta, currentQty) {
    const newQty = (currentQty || 1) + delta;
    if (delta < 0 && newQty <= 0) {
      if (!confirm('Dit verbruikt het laatste exemplaar. Verwijder uit knapzak?')) return;
    }
    try {
      await api.patchItemOwnerQty(itemId, characterId, delta);
      if (newQty > 0) {
        // Update in-place — carousel stays on current slide
        const found = (window._knapzakCarouselItems || []).find(it => it.id === itemId);
        if (found) { found._qty = newQty; }
        if (window._knapzakCarouselRender) window._knapzakCarouselRender();
        else renderMijnKarakter(opts);
      } else {
        // Item verwijderd — volledige herrender
        renderMijnKarakter(opts);
      }
    } catch (err) { alert('Fout: ' + (err.message || 'onbekend')); }
  };

  // ── Valuta ──
  window._dashCurrencyFlush = async function() { /* no-op: saves happen immediately on input */ };

  window._dashCurrencySave = async function() {
    const fl = Math.max(0, parseInt(document.getElementById('dash-cur-fl')?.value) || 0);
    const kn = Math.max(0, parseInt(document.getElementById('dash-cur-kn')?.value) || 0);
    const cl = Math.max(0, parseInt(document.getElementById('dash-cur-cl')?.value) || 0);
    try {
      if (partyCurrency.enabled) {
        await api.patchPartyCurrency({ fl, kn, cl });
      } else {
        await api.patchPlayerCurrency(charId, { fl, kn, cl });
      }
    } catch { /* ok */ }
  };

  // ── Spreukenslots ──
  window._dashToggleSlot = async function(lvl, idx) {
    const slot = spellSlots[lvl] || { max: 0, used: 0 };
    const newUsed = idx < slot.used
      ? slot.used - 1   // dot al gebruikt → één minder
      : slot.used + 1;  // dot vrij → één meer
    spellSlots[lvl] = { ...slot, used: Math.min(Math.max(0, newUsed), slot.max) };
    await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._dashSlotAdj = async function(lvl, delta) {
    const slot = spellSlots[lvl] || { max: 0, used: 0 };
    const newMax = Math.max(0, slot.max + delta);
    spellSlots[lvl] = { max: newMax, used: Math.min(slot.used, newMax) };
    await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._dashLongRest = async function() {
    for (const lvl of Object.keys(spellSlots)) {
      spellSlots[lvl] = { ...spellSlots[lvl], used: 0 };
    }
    await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._dashSlotAddLevel = async function() {
    for (let lvl = 1; lvl <= 9; lvl++) {
      if (!spellSlots[lvl] || spellSlots[lvl].max === 0) {
        spellSlots[lvl] = { max: 1, used: 0 };
        await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
        renderMijnKarakter(opts);
        return;
      }
    }
  };

  window._dashSlotRemove = async function(lvl) {
    delete spellSlots[lvl];
    await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
    renderMijnKarakter(opts);
  };

  window._toggleHeroCollapse = function() {
    const hero  = document.getElementById('player-dash-hero');
    const btn   = document.querySelector('.player-hero-collapse-btn');
    const fields = hero?.querySelector('.player-profile-fields');
    const collapsed = localStorage.getItem('_heroCollapsed') === '1';
    if (collapsed) {
      localStorage.setItem('_heroCollapsed', '0');
      if (fields) fields.style.display = '';
      if (btn)  { btn.textContent = '▲'; btn.classList.remove('collapsed'); }
    } else {
      localStorage.setItem('_heroCollapsed', '1');
      if (fields) fields.style.display = 'none';
      if (btn)  { btn.textContent = '▼'; btn.classList.add('collapsed'); }
    }
  };

  // Herstel collapse-staat na render
  if (localStorage.getItem('_heroCollapsed') === '1') {
    setTimeout(() => {
      const hero  = document.getElementById('player-dash-hero');
      const fields = hero?.querySelector('.player-profile-fields');
      if (fields) fields.style.display = 'none';
    }, 0);
  }

  // ── Subtab switcher ──
  window._setPlayerSubTab = function(tab) {
    // Beurs opslaan vóórdat de DOM vervangen wordt (alleen als dirty)
    if (typeof window._dashCurrencyFlush === 'function') window._dashCurrencyFlush();
    _playerSubTab = tab;
    localStorage.setItem('_playerSubTab', tab);
    ['party', 'personage', 'facties', 'knapzak', 'progressie', 'spreukenboek', 'berichten'].forEach(t => {
      const panel = document.getElementById('pst-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tab);
      const btn = document.querySelector(`.player-subtab[data-tab="${t}"]`);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    // Berichten gelezen markeren als tab geopend wordt
    if (tab === 'berichten') {
      window._berichtenUnread = 0;
      window._updateBerichtenBadge?.();
    }
    // Loot-paneel verversen bij openen van de Boedel
    if (tab === 'knapzak') window._renderPlayerLoot?.();
    // Progressie lazy renderen bij tab-wissel
    if (tab === 'progressie') {
      const _pm  = document.getElementById('pst-progressie');
      const _pp  = window._lastPlayerProfile || {};
      const _pe  = window._lastPlayerEntity  || {};
      const _ctxM2 = _pp.multiclass === 'true' || _pp.multiclass === true;
      const _ctx = window._lastProgCtx || {
        klasse:           _pp.klasse || _pe?.data?.klasse || '',
        klasseLevel:      _ctxM2 ? (parseInt(_pp.klasseLevel) || parseInt(_pp.level) || 1) : (parseInt(_pp.level) || 1),
        level:            parseInt(_pp.level) || 1,
        subclass:         _pp.subclass || '',
        multiclass:       _ctxM2,
        multiKlasse:      _pp.multiKlasse || '',
        multiKlasseLevel: parseInt(_pp.multiKlasseLevel) || 0,
        species:          _pp.origin || _pe?.data?.ras || _pp.ras || '',
        background:        _pp.background || '',
        charId:           window._lastCharId || null,
        favorites:        (() => { try { return JSON.parse(_pp.featFavorites || '[]'); } catch { return []; } })(),
        choices:          (() => { try { return JSON.parse(_pp.featChoices   || '{}'); } catch { return {}; } })(),
      };
      if (_pm) renderProgressie(_pm, _ctx);
    }
    // Auto-open spellbook when navigating to spreukenboek tab
    if (tab === 'spreukenboek' && _sbState.spells.length > 0) {
      window._sbUserClosed = false;  // explicit tab nav resets the closed flag
      const ov = document.getElementById('sb-overlay');
      if (!ov?.classList.contains('sb-open')) window._openSpellbook();
    }
  };

  // ── Pending subtab na login (wordt gezet door playerLogin) ──
  if (window._pendingPlayerSubTab) {
    window._setPlayerSubTab(window._pendingPlayerSubTab);
    window._pendingPlayerSubTab = null;
  }

  // Auto-open spellbook when page loads/re-renders with spreukenboek tab active
  // Only if the user hasn't manually closed the book this session
  if (_playerSubTab === 'spreukenboek' && _sbState.spells.length > 0 && !window._sbUserClosed) {
    requestAnimationFrame(() => {
      const ov = document.getElementById('sb-overlay');
      if (!ov?.classList.contains('sb-open')) window._openSpellbook();
    });
  }

  // ── Knapzak carousel navigatie ──
  (function() {
    const _ITEM_CATS_ORDER = ['Wapen','Uitrusting','Toveritem','Drank','Scroll','Ring','Amulet'];
    const _catIconMap = { Wapen:icon('sword'), Uitrusting:icon('shield'), Toveritem:icon('sparkles'), Drank:icon('flask-conical'), Scroll:icon('scroll-text'), Ring:icon('swords'), Amulet:icon('swords') };

    function _renderCarouselInDom() {
      const items = window._knapzakCarouselItems || [];
      const idx   = window._knapzakCarouselIdx || 0;
      const item  = items[idx];
      const track = document.getElementById('knapzak-carousel-track');
      if (!track) return;

      if (!item) {
        track.innerHTML = '<div class="item-carousel-slide"><p style="color:#8a7050;font-style:italic">Geen voorwerpen</p></div>';
        return;
      }

      const iImgUrl   = api.fileForEntity(item);
      const typeIcon  = _catIconMap[item.data?.itemType || item.subtype || ''] || icon('package');
      const typeLabel = item.data?.itemType || item.subtype || 'Overig';
      const desc      = item.data?.desc || '';
      const qty       = item._qty;
      const charIdEsc = esc(charId);

      const qtyHtml = item._stapelbaar ? `
        <div class="item-carousel-qty-controls" onclick="event.stopPropagation()">
          <button class="item-carousel-qty-btn"
            onclick="window._dashQtyAdj('${esc(item.id)}','${charIdEsc}',-1,${qty})"
            title="Verbruikt">−</button>
          <span class="item-carousel-qty-label">×${qty}</span>
          <button class="item-carousel-qty-btn"
            onclick="window._dashQtyAdj('${esc(item.id)}','${charIdEsc}',1,${qty})"
            title="Nog een gevonden">+</button>
        </div>` : '';

      const chargesHtml = item._maxCharges > 0 ? `
        <div class="item-carousel-charges" onclick="event.stopPropagation()">
          <div class="item-charge-label">${icon('zap')} Charges: ${item._charges}/${item._maxCharges}</div>
          <div class="item-charge-dots-row">
            ${item._playerMaxAdjustable ? `<button class="item-carousel-qty-btn" onclick="window._dashMaxChargeAdj('${esc(item.id)}','${charIdEsc}',-1,${item._maxCharges})" title="Max. charges verlagen">−</button>` : ''}
            <div class="item-charge-dots">
              ${Array.from({length: item._maxCharges}, (_, i) => `
                <button class="spell-slot-dot ${i < item._charges ? 'free' : 'used'}"
                  title="${i < item._charges ? 'Vrij — klik om te verbruiken' : 'Verbruikt — klik om te herstellen'}"
                  onclick="window._dashChargeToggle('${esc(item.id)}','${charIdEsc}',${i},${item._charges},${item._maxCharges})"></button>`).join('')}
            </div>
            ${item._playerMaxAdjustable ? `<button class="item-carousel-qty-btn" onclick="window._dashMaxChargeAdj('${esc(item.id)}','${charIdEsc}',1,${item._maxCharges})" title="Max. charges verhogen">+</button>` : ''}
          </div>
        </div>` : '';

      const _mdI = s => s
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
        .replace(/\n/g,'<br>');

      const _itemDmg   = item.data?.damage;
      const _itemProps = (() => { try { return JSON.parse(item.data?.weaponProperties || '[]'); } catch { return []; } })();
      const _acPill    = _calcArmorAC(item.data, _mod('dex'));
      const _stlth     = item.data?.stealthDisadvantage === true || item.data?.stealthDisadvantage === 'true';
      const _srq       = parseInt(item.data?.strengthRequirement) || 0;

      track.innerHTML = `<div class="item-carousel-slide">
        <div class="item-carousel-img-wrap" onclick="window._openDetail('voorwerpen','${esc(item.id)}')" title="Bekijk kaartje" style="cursor:pointer">
          <img src="${iImgUrl}" class="item-carousel-img"
            onerror="this.closest('.item-carousel-img-wrap').style.display='none'">
          ${_acPill ? `<span class="item-carousel-ac-pill" title="${esc(_acPill.tooltip)}">${esc(_acPill.pill)}</span>` : ''}
        </div>
        <div class="item-carousel-namerow">
          <span class="item-carousel-type-icon">${typeIcon}</span>
          <span class="item-carousel-name">${esc(item.name)}</span>
        </div>
        ${desc ? `<div class="item-carousel-desc">${_mdI(desc)}</div>` : ''}
        ${_itemDmg ? (() => {
          const _h = /heal/i.test(_itemDmg);
          return `<div class="item-carousel-damage" onclick="event.stopPropagation()">
            <button class="item-damage-pill item-damage-pill--sm${_h ? ' item-damage-pill--heal' : ''}"
              onclick="window.dice?.rollFormula('${escJS(_itemDmg)}')"
              title="Gooi ${escJS(_itemDmg)}">${icon('dice',{cls:'icon-gi'})} ${esc(_itemDmg)}</button>
          </div>`;
        })() : ''}
        ${_itemProps.length ? `<div class="item-carousel-props">${_itemProps.map(p => `<span class="card-weapon-tag" title="${esc(_weaponPropTitle(p))}">${esc(p)}</span>`).join('')}</div>` : ''}
        ${(_stlth || _srq) ? `<div class="item-carousel-props">
          ${_stlth ? `<span class="card-armor-tag card-armor-tag--stealth" title="You have disadvantage on Dexterity (Stealth) checks while wearing this armor.">Stealth ↓</span>` : ''}
          ${_srq   ? `<span class="card-armor-tag card-armor-tag--str" title="Your speed is reduced by 10 feet unless you have a Strength score of ${_srq} or higher.">Str ${_srq}</span>` : ''}
        </div>` : ''}
        ${qtyHtml}
        ${chargesHtml}
        <div class="item-carousel-geef" onclick="event.stopPropagation()">
          <button class="item-geef-btn" onclick="window._geefItemMenu('${esc(item.id)}', this)"
            title="Dit voorwerp aan een medespeler geven">${icon('users')} Geven aan…</button>
        </div>
      </div>`;

      // Update dots
      document.querySelectorAll('.item-carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === idx);
      });
    }

    window._knapzakCarouselNav = function(delta) {
      const items = window._knapzakCarouselItems || [];
      if (!items.length) return;
      const n = items.length;
      window._knapzakCarouselIdx = (((window._knapzakCarouselIdx || 0) + delta) % n + n) % n;
      _renderCarouselInDom();
    };

    window._knapzakCarouselGoTo = function(idx) {
      window._knapzakCarouselIdx = idx;
      _renderCarouselInDom();
    };

    window._knapzakCarouselRender = _renderCarouselInDom;
  })();

  // ── Item charges ──
  window._dashChargeToggle = async function(itemId, charId, dotIdx, current, maxCharges) {
    const newCharges = dotIdx < current ? dotIdx : dotIdx + 1;
    const clampedCharges = Math.max(0, Math.min(maxCharges, newCharges));
    try { await api.patchItemCharges(itemId, charId, clampedCharges); } catch { /* ok */ }
    // Update in-place — no full re-render so carousel stays on current slide
    const found = (window._knapzakCarouselItems || []).find(it => it.id === itemId);
    if (found) { found._charges = clampedCharges; }
    if (window._knapzakCarouselRender) window._knapzakCarouselRender();
    else renderMijnKarakter(opts);
  };

  window._dashMaxChargeAdj = async function(itemId, charId, delta, currentMax) {
    const newMax = Math.max(0, currentMax + delta);
    try { await api.patchItemMaxCharges(itemId, charId, newMax); } catch { /* ok */ }
    const found = (window._knapzakCarouselItems || []).find(it => it.id === itemId);
    if (found) {
      found._maxCharges = newMax;
      found._charges = Math.min(found._charges, newMax);
    }
    if (window._knapzakCarouselRender) window._knapzakCarouselRender();
    else renderMijnKarakter(opts);
  };

  window._dashLongRest = async function() {
    try { await api.longRest(charId); } catch { /* ok */ }
    renderMijnKarakter(opts);
  };

  // ── Bericht mark-gelezen (werkt voor zowel berichten als brieven) ──
  window._berichtMarkGelezen = async function(msgId) {
    if (!charId || !msgId) return;
    // Markeer visueel als gelezen — bericht-item of brief-card
    const item = document.querySelector(`.speler-bericht-item[data-mid="${msgId}"]`);
    if (item) item.classList.remove('speler-bericht-item--nieuw');
    const brief = document.querySelector(`.speler-brief-card[data-mid="${msgId}"]`);
    if (brief) brief.classList.remove('speler-brief-card--nieuw');
    try { await api.markBerichtGelezen(charId, msgId); } catch { /* ok */ }
  };

  window._briefToggle = function(msgId) {
    const card = document.querySelector(`.speler-brief-card[data-mid="${msgId}"]`);
    if (!card) return;
    card.classList.toggle('speler-brief-card--open');
    // Mark as read when opening
    if (card.classList.contains('speler-brief-card--open')) {
      window._berichtMarkGelezen(msgId);
    }
  };

  window._berichtPlayerDelete = async function(msgId) {
    if (!charId || !msgId) return;
    const item = document.querySelector(`.speler-bericht-item[data-mid="${msgId}"]`);
    if (item) item.remove();
    try { await api.deleteBericht(charId, msgId); } catch { /* ok */ }
  };

  // Zachte verwijdering van een brief (DM ziet 'weggegooid', speler ziet het niet meer)
  window._briefPlayerDelete = async function(postId) {
    if (!charId || !postId) return;
    const item = document.querySelector(`.speler-brief-card[data-mid="${postId}"]`);
    if (item) item.remove();
    try { await api.deletePost(charId, postId); } catch { /* ok */ }
  };

  // ── Klasse-thema toggle ──
  window._toggleKlasseTheme = function() {
    _klasseThemeOn = !_klasseThemeOn;
    localStorage.setItem('_klasseThemeOn', _klasseThemeOn);
    const dash = document.querySelector('.player-dashboard');
    if (dash) {
      if (_klasseThemeOn && _klasseKey) dash.setAttribute('data-klasse', _klasseKey);
      else dash.removeAttribute('data-klasse');
    }
  };

  // ── Inspiratie gebruiken ──
  window._dashUseInspiration = async function() {
    try {
      await api.removeInspiration(charId);
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  // ── Wild Magic Surge roller ──
  const WILD_MAGIC_TABLE = [
    "Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.",
    "For the next minute, you can see any invisible creature if you have line of sight to it.",
    "A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.",
    "You cast fireball as a 3rd-level spell centered on yourself.",
    "You cast magic missile as a 5th-level spell.",
    "Roll a d10. Your height changes by a number of inches equal to the roll. If the roll is odd, you shrink. If the roll is even, you grow.",
    "You cast confusion centered on yourself.",
    "For the next minute, you regain 5 hit points at the start of each of your turns.",
    "You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.",
    "You cast grease centered on yourself.",
    "Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.",
    "Your skin turns a vibrant shade of blue. A remove curse spell can end this effect.",
    "An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.",
    "For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.",
    "You teleport up to 60 feet to an unoccupied space of your choice that you can see.",
    "You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space if that space is occupied.",
    "Maximize the damage of the next damaging spell you cast within the next minute.",
    "Roll a d10. Your age changes by a number of years equal to the roll. If the roll is odd, you get younger (minimum 1 year old). If the roll is even, you get older.",
    "1d6 flumphs controlled by the DM appear in unoccupied spaces within 60 feet of you and are frightened of you. They vanish after 1 minute.",
    "You regain 2d10 hit points.",
    "You turn into a potted plant until the start of your next turn. While a plant, you are incapacitated and have vulnerability to all damage. If you drop to 0 hit points, your pot breaks, and your form reverts.",
    "For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.",
    "You cast levitate on yourself.",
    "A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.",
    "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth.",
    "A spectral shield hovers near you for the next minute, granting you a +2 bonus to AC and immunity to magic missile.",
    "You are immune to being intoxicated by alcohol for the next 5d6 days.",
    "Your hair falls out but grows back within 24 hours.",
    "For the next minute, any flammable object you touch that isn't being worn or carried by anyone else ignites.",
    "You regain your lowest-level expended spell slot.",
    "For the next minute, you must shout when you speak.",
    "You cast fog cloud centered on yourself.",
    "Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.",
    "You are frightened by the nearest creature until the end of your next turn.",
    "Each creature within 30 feet of you becomes invisible until the end of your next turn. The invisibility ends on a creature when it attacks or casts a spell.",
    "You gain resistance to all damage for the next minute.",
    "A random creature within 60 feet of you becomes poisoned for 1d4 hours.",
    "You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.",
    "You cast polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration.",
    "Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.",
    "You can take one additional action immediately.",
    "Each creature within 30 feet of you takes 1d10 necrotic damage. You regain hit points equal to the sum of the necrotic damage dealt.",
    "You cast mirror image.",
    "You cast fly on a random creature within 60 feet of you.",
    "You become invisible until the start of your next turn or until you attack or cast a spell.",
    "If you die within the next minute, you immediately come back to life as if by the reincarnate spell.",
    "Your size increases by one size category for the next minute.",
    "You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.",
    "You are surrounded by faint, ethereal music for the next minute.",
    "You regain all expended sorcery points.",
  ];

  window._rollWildMagic = function() {
    const roll    = Math.floor(Math.random() * 100) + 1;
    const idx     = Math.floor((roll - 1) / 2);
    const low     = idx * 2 + 1;
    const high    = low + 1;
    const text    = WILD_MAGIC_TABLE[idx];
    const rollEl  = document.getElementById('wild-magic-roll');
    const textEl  = document.getElementById('wild-magic-text');
    const result  = document.getElementById('wild-magic-result');
    if (!rollEl || !textEl || !result) return;
    rollEl.textContent = `${String(low).padStart(2,'0')}–${String(high).padStart(2,'0')} (jij rolde ${roll})`;
    textEl.textContent = text;
    result.classList.remove('hidden');
    result.classList.add('wild-magic-result--flash');
    setTimeout(() => result.classList.remove('wild-magic-result--flash'), 600);
  };

  // ── Trackers ──
  // Herstelt de dots en teller van één tracker in-place (zonder volledige re-render)
  function _redrawTrackerRow(t) {
    const row = document.querySelector(`.player-tracker-row[data-tid="${t.id}"]`);
    if (!row) return;
    const dotsWrap = row.querySelector('.player-dash-slot-dots');
    if (dotsWrap) {
      dotsWrap.innerHTML = Array.from({ length: t.max }, (_, i) => `
        <button class="spell-slot-dot ${i < t.current ? 'used' : 'free'}"
          title="${i < t.current ? 'Verbruikt — klik om vrij te maken' : 'Vrij — klik om te verbruiken'}"
          onclick="window._dashToggleTracker('${t.id}', ${i})"></button>`).join('');
    }
    const count = row.querySelector('.player-dash-slot-count');
    if (count) count.textContent = `${t.current}/${t.max}`;
  }

  window._dashToggleTracker = async function(trackerId, dotIdx) {
    const t = trackers.find(tr => tr.id === trackerId);
    if (!t) return;
    const newCurrent = dotIdx < t.current ? t.current - 1 : t.current + 1;
    t.current = Math.min(Math.max(0, newCurrent), t.max);
    _redrawTrackerRow(t);
    await api.patchPlayerTracker(charId, trackerId, { current: t.current }).catch(() => {});
  };

  window._dashAddTracker = async function() {
    const nameEl = document.getElementById('tracker-name');
    const maxEl  = document.getElementById('tracker-max');
    const name = nameEl?.value?.trim();
    if (!name) { nameEl?.focus(); return; }
    const max = parseInt(maxEl?.value) || 3;
    try {
      await api.addPlayerTracker(charId, { name, max });
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashDeleteTracker = async function(trackerId) {
    try {
      await api.deletePlayerTracker(charId, trackerId);
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  window._dashRenameTracker = async function(trackerId, name) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    await api.patchPlayerTracker(charId, trackerId, { name: trimmed }).catch(() => {});
  };

  window._dashTrackerAdj = async function(trackerId, delta) {
    const t = trackers.find(tr => tr.id === trackerId);
    if (!t) return;
    const newMax = Math.max(1, Math.min(20, t.max + delta));
    t.max = newMax;
    t.current = Math.min(t.current, newMax);
    _redrawTrackerRow(t);
    await api.patchPlayerTracker(charId, trackerId, { max: newMax }).catch(() => {});
  };

  // ── Spreukzoeker ──
  const _isHpCampaign = () => state.meta?.spellSource === 'wands-wizards';

  let _extraSpellList = null;

  window._playerSpellSearch = async function(q) {
    const resultsEl = document.getElementById('player-spell-results');
    if (!resultsEl) return;
    const query = q.toLowerCase().trim();
    if (!query) { resultsEl.innerHTML = ''; return; }
    // Laad spreuklijst (2024 PHB lokaal, of HP-campagne)
    if (!_playerSpellList) {
      resultsEl.innerHTML = '<div class="player-spell-loading">Laden…</div>';
      try {
        const url = _isHpCampaign() ? '/api/bron/hp-spells' : '/api/bron/spells-2024';
        const r = await fetch(url);
        const d = await r.json();
        _playerSpellList = d.results || [];
      } catch { _playerSpellList = []; }
    }
    // Laad aanvullende spreuklijst (custom/homebrew)
    if (!_extraSpellList) {
      try {
        const r = await fetch('/api/bron/extra-spells');
        const d = await r.json();
        _extraSpellList = d.results || [];
      } catch { _extraSpellList = []; }
    }
    const combined = [..._playerSpellList, ..._extraSpellList];
    const filtered = combined.filter(s => s.name.toLowerCase().includes(query)).slice(0, 8);
    const pinned = pinnedSpells.map(s => s.index);
    resultsEl.innerHTML = filtered.length
      ? filtered.map(s => `
          <div class="player-spell-result${pinned.includes(s.index) ? ' pinned' : ''}"
            data-spell-idx="${esc(s.index)}" data-spell-nm="${esc(s.name)}"
            onclick="window._playerSpellPinByEl(this)">
            ${esc(s.name)}
            <span class="player-spell-pin-icon">${pinned.includes(s.index) ? '✓' : '📌'}</span>
          </div>`).join('')
      : `<div class="player-spell-noresult">Niet gevonden.
          <button class="player-spell-custom-btn" onclick="window._playerSpellCustomOpen()">＋ Zelf invoeren</button>
        </div>`;
  };

  window._playerSpellPin = async function(index, name) {
    if (pinnedSpells.find(s => s.index === index)) return;
    try {
      // Zoek in alle beschikbare lijsten (extra/homebrew eerst, dan 2024-lijst)
      const fullSpell =
        (_extraSpellList   || []).find(s => s.index === index) ||
        (_playerSpellList  || []).find(s => s.index === index) ||
        { level: 0, school: {} };

      const desc          = (fullSpell.desc || []).join('\n\n');
      const concentration = !!fullSpell.concentration ||
        String(fullSpell.duration || '').toLowerCase().includes('concentration');
      const ritual        = !!fullSpell.ritual;
      const school        = fullSpell.school?.name || '';
      const source        = fullSpell.source || 'phb2024';

      await api.addPlayerSpell(charId, {
        index, name,
        level:  fullSpell.level || 0,
        school, concentration, ritual, source,
        desc,
        casting_time: fullSpell.casting_time || '',
        range:        fullSpell.range        || '',
        duration:     fullSpell.duration     || '',
        components:   Array.isArray(fullSpell.components)
          ? fullSpell.components.join(', ') + (fullSpell.material ? ` (${fullSpell.material})` : '')
          : (fullSpell.components || ''),
      });
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  // Data-attribuut bridge — omzeilt apostrofe-problemen in onclick strings
  window._playerSpellPinByEl = function(el) {
    window._playerSpellPin(el.dataset.spellIdx, el.dataset.spellNm);
  };

  window._filterSpellLevel = function(level, btn) {
    // Update chips
    document.querySelectorAll('.spell-lvl-chip').forEach(c => c.classList.remove('spell-lvl-chip--active'));
    if (btn) btn.classList.add('spell-lvl-chip--active');
    // Show/hide groups
    document.querySelectorAll('.spell-level-group').forEach(g => {
      g.style.display = (level === null || +g.dataset.levelGroup === level) ? '' : 'none';
    });
  };

  window._playerSpellUnpin = async function(spellIndex) {
    try {
      await api.removePlayerSpell(charId, spellIndex);
      renderMijnKarakter(opts);
    } catch { /* ok */ }
  };

  // ── Eigen spreuk ──
  window._playerSpellCustomOpen = function() {
    document.getElementById('player-spell-custom-form')?.classList.remove('hidden');
    document.getElementById('pscf-name')?.focus();
  };

  window._playerSpellCustomClose = function() {
    document.getElementById('player-spell-custom-form')?.classList.add('hidden');
    ['pscf-name','pscf-school','pscf-damage','pscf-casting-time','pscf-range','pscf-components','pscf-duration','pscf-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const lvl = document.getElementById('pscf-level');
    if (lvl) lvl.value = '0';
  };

  window._playerSpellCustomSave = async function() {
    if (!charId) return;
    const name         = document.getElementById('pscf-name')?.value?.trim();
    const level        = parseInt(document.getElementById('pscf-level')?.value) || 0;
    const school       = document.getElementById('pscf-school')?.value?.trim()       || '';
    const damage       = document.getElementById('pscf-damage')?.value?.trim()       || '';
    const casting_time = document.getElementById('pscf-casting-time')?.value?.trim() || '';
    const range        = document.getElementById('pscf-range')?.value?.trim()        || '';
    const components   = document.getElementById('pscf-components')?.value?.trim()   || '';
    const duration     = document.getElementById('pscf-duration')?.value?.trim()     || '';
    const desc         = document.getElementById('pscf-desc')?.value?.trim()         || '';
    if (!name) return;
    const index = 'custom_' + Date.now();
    await api.addPlayerSpell(charId, {
      index, name, level, school, source: 'custom',
      desc, damage, casting_time, range, components, duration,
    });
    window._playerSpellCustomClose();
    renderMijnKarakter(opts);
  };

  // ── Inline spell edit (school, damage, desc) ──
  function _buildSpellEditForm(index, body) {
    const sp           = pinnedSpells.find(s => s.index === index) || {};
    const school       = sp.school       || '';
    const damage       = sp.damage       || '';
    const casting_time = sp.casting_time || '';
    const range        = sp.range        || '';
    const components   = typeof sp.components === 'string' ? sp.components
                       : Array.isArray(sp.components) ? sp.components.join(', ')
                       : '';
    const duration     = sp.duration     || '';
    const desc         = sp.desc         || '';
    const incantation  = sp.incantation  || '';
    const eidx = escJS(index);
    return `
      <div class="spell-edit-section" id="spell-edit-${eidx}" style="display:none">
        <div class="spell-edit-row spell-edit-row--incant">
          <label class="spell-edit-lbl">Spreukwoord</label>
          <input class="spell-edit-inp spell-edit-inp--incant" id="sei-incantation-${eidx}" type="text"
            placeholder='bijv. "Ignis, percute!"' maxlength="120" value="${esc(incantation)}">
        </div>
        <div class="spell-edit-grid2">
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">School</label>
            <input class="spell-edit-inp" id="sei-school-${eidx}" type="text" placeholder="bijv. Evocation" maxlength="40" value="${esc(school)}">
          </div>
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">Damage / Healing</label>
            <input class="spell-edit-inp" id="sei-damage-${eidx}" type="text" placeholder="bijv. 2d10 Fire" maxlength="40" value="${esc(damage)}">
          </div>
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">Casting Time</label>
            <input class="spell-edit-inp" id="sei-casting-time-${eidx}" type="text" placeholder="bijv. 1 action" maxlength="60" value="${esc(casting_time)}">
          </div>
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">Range</label>
            <input class="spell-edit-inp" id="sei-range-${eidx}" type="text" placeholder="bijv. 60 feet" maxlength="60" value="${esc(range)}">
          </div>
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">Components</label>
            <input class="spell-edit-inp" id="sei-components-${eidx}" type="text" placeholder="bijv. V, S, M (…)" maxlength="120" value="${esc(components)}">
          </div>
          <div class="spell-edit-row">
            <label class="spell-edit-lbl">Duration</label>
            <input class="spell-edit-inp" id="sei-duration-${eidx}" type="text" placeholder="bijv. 1 minute" maxlength="60" value="${esc(duration)}">
          </div>
        </div>
        <div class="spell-edit-row">
          <label class="spell-edit-lbl">Beschrijving (override)</label>
          <textarea class="spell-edit-ta" id="sei-desc-${eidx}" rows="4" placeholder="Leeglaten = gebruik originele beschrijving">${esc(desc)}</textarea>
        </div>
        <div class="spell-edit-btns">
          <button class="spell-edit-save" data-idx="${eidx}">Opslaan</button>
          <button class="spell-edit-cancel" data-idx="${eidx}">Annuleer</button>
        </div>
      </div>
      <button class="spell-edit-toggle-btn" data-idx="${eidx}" title="Spreuk aanpassen">✎</button>`;
  }

  function _attachSpellEditListeners(body, index, charId) {
    const eidx = escJS(index);
    const toggleBtn = body.querySelector('.spell-edit-toggle-btn');
    const section   = body.querySelector(`#spell-edit-${eidx}`);
    if (toggleBtn && section) {
      toggleBtn.addEventListener('click', () => {
        const open = section.style.display !== 'none';
        section.style.display = open ? 'none' : 'block';
        toggleBtn.classList.toggle('spell-edit-toggle-btn--active', !open);
      });
    }
    const saveBtn = body.querySelector('.spell-edit-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const school       = body.querySelector(`#sei-school-${eidx}`)?.value?.trim()       || '';
        const damage       = body.querySelector(`#sei-damage-${eidx}`)?.value?.trim()       || '';
        const casting_time = body.querySelector(`#sei-casting-time-${eidx}`)?.value?.trim() || '';
        const range        = body.querySelector(`#sei-range-${eidx}`)?.value?.trim()        || '';
        const components   = body.querySelector(`#sei-components-${eidx}`)?.value?.trim()   || '';
        const duration     = body.querySelector(`#sei-duration-${eidx}`)?.value?.trim()     || '';
        const desc         = body.querySelector(`#sei-desc-${eidx}`)?.value?.trim()         || '';
        const incantation  = body.querySelector(`#sei-incantation-${eidx}`)?.value?.trim()  || '';
        await api.updatePlayerSpell(charId, index, { school, damage, casting_time, range, components, duration, desc, incantation });
        renderMijnKarakter(opts);
      });
    }
    const cancelBtn = body.querySelector('.spell-edit-cancel');
    if (cancelBtn && section) {
      cancelBtn.addEventListener('click', () => {
        section.style.display = 'none';
        if (toggleBtn) toggleBtn.classList.remove('spell-edit-toggle-btn--active');
      });
    }
  }

  // ── Ability scores ──
  window._saveAbilityScore = async function(ab, value) {
    const val = parseInt(value);
    if (!isNaN(val) && val >= 1 && val <= 30)
      await window._saveProfileField(ab, val);
    renderMijnKarakter(opts);
  };

  // ── Skill proficiency: cycle none → prof → expert → none ──
  window._cycleSkillProf = async function(skillKey) {
    const current = _skillProfs[skillKey] || null;
    const next = current === null ? 'prof' : current === 'prof' ? 'expert' : null;
    if (next === null) delete _skillProfs[skillKey];
    else _skillProfs[skillKey] = next;
    await window._saveProfileField('skillProfs', JSON.stringify(_skillProfs));
    renderMijnKarakter(opts);
  };

  // ── Handmatige skill-aanpassing (pijltje omhoog/omlaag) ──
  window._adjSkill = async function(skillKey, delta) {
    const current = _skillAdj[skillKey] || 0;
    const next = current + delta;
    if (next === 0) delete _skillAdj[skillKey];
    else _skillAdj[skillKey] = next;
    await window._saveProfileField('skillAdj', JSON.stringify(_skillAdj));
    renderMijnKarakter(opts);
  };

  // ── Saving throw proficiency toggle ──
  window._toggleSaveProf = async function(ab, add) {
    const profs = new Set((playerProfile.saveProfs || '').split(',').filter(Boolean));
    if (add) profs.add(ab); else profs.delete(ab);
    await window._saveProfileField('saveProfs', [...profs].join(','));
    renderMijnKarakter(opts);
  };

  // ── Death save dot ──
  window._dashDeathSaveDot = async function(type, idx) {
    const field   = type === 'success' ? 'deathSaveSuccesses' : 'deathSaveFailures';
    const current = type === 'success' ? _dsSucc : _dsFail;
    const newVal  = idx < current ? idx : idx + 1;
    await window._saveProfileField(field, Math.max(0, Math.min(3, newVal)));
    renderMijnKarakter(opts);
  };

  // ── Features & traits ──
  window._saveFeaturesTraits = async function() {
    const ta = document.getElementById('player-ft-area');
    if (ta) await window._saveProfileField('featuresTraits', ta.value);
  };

  window._ftFormat = function(type) {
    const ta = document.getElementById('player-ft-area');
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    const wrap = type === 'bold' ? '**' : '*';
    ta.value = ta.value.slice(0, start) + wrap + sel + wrap + ta.value.slice(end);
    ta.selectionStart = start + wrap.length;
    ta.selectionEnd   = end   + wrap.length;
    ta.focus();
  };

  // ── Korte rust ──
  window._dashShortRest = async function() {
    if (playerProfile.klasse === 'Warlock') {
      for (const lvl of Object.keys(spellSlots)) {
        spellSlots[lvl] = { ...spellSlots[lvl], used: 0 };
      }
      await api.setPlayerSpellSlots(charId, spellSlots).catch(() => {});
    }
    renderMijnKarakter(opts);
  };

  window._playerSpellOpen = async function(index) {
    if (window.dmPanel?.spellOpen) { window.dmPanel.spellOpen(index); return; }
    try {
      let s;
      if (_isHpCampaign()) {
        s = (_playerSpellList || []).find(sp => sp.index === index);
        if (!s) {
          const r = await fetch('/api/bron/hp-spells');
          const d = await r.json();
          _playerSpellList = d.results || [];
          s = _playerSpellList.find(sp => sp.index === index) || {};
        }
      } else {
        const r = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
        s = await r.json();
      }
      const schoolMap = { Charm: 'Bezwering', Curse: 'Vloek', Transfiguration: 'Gedaanteverandering', Healing: 'Genezing' };
      const schoolNl  = schoolMap[s.school?.name] || s.school?.name || '';
      const levelStr  = s.level === 0 ? 'Tovervorm' : `Niveau ${s.level}`;
      const _md2 = t => t
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
      const desc   = (s.desc || []).map(_md2).join('<br><br>');
      const higher = s.higher_level?.length ? `<p class="mt-2"><strong>Op hogere niveaus:</strong> ${s.higher_level.join(' ')}</p>` : '';
      window.app.openModal(
        s.name,
        `${levelStr} · ${schoolNl} · ${s.casting_time || ''} · Range: ${s.range || ''}`,
        `<div style="font-family:var(--font-fell);color:var(--ink-bright);line-height:1.6">${desc}${higher}</div>`
      );
    } catch { /* ok */ }
  };

}

async function renderSpelersTab(selectedCharId) {
  const el = document.getElementById('section-spelers');
  if (!el) return;

  let players = [];
  try { players = await api.listPlayerChars(); } catch { /* ok */ }

  if (!players.length) {
    el.innerHTML = '<div class="p-8 text-center text-ink-dim italic font-fell">Geen spelers geconfigureerd.</div>';
    return;
  }

  // Default: eerste speler als geen geselecteerd
  const activeId = selectedCharId || players[0]?.id;
  const activePl = players.find(p => p.id === activeId) || players[0];

  el.innerHTML = `
    <div class="spelers-tab-wrap">
      <div class="spelers-tab-header">
        <span class="spelers-tab-label">Speler:</span>
        <div class="spelers-tab-selector">
          ${players.map(p => `
            <button class="spelers-tab-btn${p.id === activePl?.id ? ' spelers-tab-btn--active' : ''}"
              onclick="window._switchSpelersTab('${esc(p.id)}')">
              ${esc(p.name)}
            </button>`).join('')}
        </div>
      </div>
      <div id="spelers-dashboard-wrap" class="spelers-dashboard-wrap"></div>
    </div>`;

  window._switchSpelersTab = async (charId) => {
    const pl = players.find(p => p.id === charId);
    if (!pl) return;
    // Update active button
    el.querySelectorAll('.spelers-tab-btn').forEach(b => {
      b.classList.toggle('spelers-tab-btn--active', b.textContent.trim() === pl.name);
    });
    const wrap = document.getElementById('spelers-dashboard-wrap');
    if (!wrap) return;
    await renderMijnKarakter({ charId: pl.id, playerName: pl.name, el: wrap });
  };

  // Render initial player
  const wrap = document.getElementById('spelers-dashboard-wrap');
  if (wrap && activePl) {
    await renderMijnKarakter({ charId: activePl.id, playerName: activePl.name, el: wrap });
  }
}

async function refreshAll() {
  await refreshSection(state.activeSection);
}

// ── Dice Roller ──
;(() => {
  const _history = [];
  let _dmCount = 1;
  let _adv = 0;   // -1 = nadeel, 0 = normaal, 1 = voordeel
  let _mod = 0;   // vaste bonus bij de worp

  const _rnd = (sides) => Math.floor(Math.random() * sides) + 1;
  const _modStr = (m) => m > 0 ? ` + ${m}` : m < 0 ? ` − ${Math.abs(m)}` : '';

  // Geeft alle actieve result-elementen terug (spelers-paneel én DM-paneel)
  function _els(suffix) {
    return ['dice-' + suffix, 'dm-dice-' + suffix]
      .map(id => document.getElementById(id))
      .filter(Boolean);
  }

  function _animate(numEls, lblEls, boxEls, tickVal, finalNum, finalLbl, histEntry) {
    boxEls.forEach(box => {
      box.classList.remove('dice-shaking');
      void box.offsetWidth;
      box.classList.add('dice-shaking');
      box.addEventListener('animationend', () => box.classList.remove('dice-shaking'), { once: true });
    });
    numEls.forEach(n => n.classList.remove('dice-crit', 'dice-fumble', 'dice-reveal'));
    lblEls.forEach(l => l.textContent = 'Gooien\u2026');

    const delays = [45, 55, 65, 80, 100, 125, 155];
    let i = 0;
    const tick = () => {
      if (i < delays.length) {
        numEls.forEach(n => n.textContent = tickVal());
        setTimeout(tick, delays[i++]);
      } else {
        numEls.forEach(n => {
          n.classList.remove('dice-crit', 'dice-fumble');
          void n.offsetWidth;
          n.textContent = finalNum;
          n.classList.add('dice-reveal');
          n.addEventListener('animationend', () => n.classList.remove('dice-reveal'), { once: true });
          if (histEntry.crit)   n.classList.add('dice-crit');
          if (histEntry.fumble) n.classList.add('dice-fumble');
        });
        // Viering op de box bij een natural 20 (gouden uitbarsting) of 1 (rode huiver).
        if (histEntry.crit || histEntry.fumble) {
          const cls = histEntry.crit ? 'dice-crit-burst' : 'dice-fumble-shudder';
          boxEls.forEach(box => {
            box.classList.remove('dice-crit-burst', 'dice-fumble-shudder');
            void box.offsetWidth;
            box.classList.add(cls);
            box.addEventListener('animationend', () => box.classList.remove(cls), { once: true });
          });
        }
        lblEls.forEach(l => l.textContent = finalLbl);
        _history.unshift(histEntry);
        if (_history.length > 10) _history.pop();
        _renderHistory();
      }
    };
    tick();
  }

  // ── Pure formule-roller ──
  // Ondersteunt meerdere termen (1d8+1d6+3), losse getallen, keep-highest/
  // lowest (4d6kh3 / 2d20kl1), voordeel/nadeel (adv/dis/voordeel/nadeel) op
  // een enkele d20, en een vrij label erachter (bv. schadetype). Geeft een
  // resultaatobject terug; rng is injecteerbaar voor tests.
  function _rollFormula(str, rng) {
    rng = rng || Math.random;
    const rollDie = s => Math.floor(rng() * s) + 1;
    let work = String(str == null ? '' : str).trim();
    if (!work) return { ok: false };
    let adv = 0;
    if (/\b(adv|advantage|voordeel)\b/i.test(work)) { adv = 1; work = work.replace(/\b(adv|advantage|voordeel)\b/i, ' '); }
    else if (/\b(dis|disadv|disadvantage|nadeel)\b/i.test(work)) { adv = -1; work = work.replace(/\b(dis|disadv|disadvantage|nadeel)\b/i, ' '); }

    const re = /\s*([+-])?\s*(?:(\d*)d(\d+)((?:kh|kl|k)\d+)?|(\d+))/iy;
    const terms = [];
    let m, end = 0;
    while ((m = re.exec(work)) !== null) {
      const sign = m[1] === '-' ? -1 : 1;
      if (m[3] !== undefined) {
        terms.push({ kind: 'dice', sign, n: m[2] ? parseInt(m[2]) : 1, sides: parseInt(m[3]), keep: m[4] || null });
      } else {
        terms.push({ kind: 'flat', sign, value: parseInt(m[5]) });
      }
      end = re.lastIndex;
    }
    if (!terms.length) return { ok: false };
    const label = work.slice(end).trim().replace(/\s+/g, ' ');

    let total = 0, totalDice = 0, critDie = null, minP = 0, maxP = 0;
    const parts = [];
    for (let ti = 0; ti < terms.length; ti++) {
      const t = terms[ti];
      const op = t.sign < 0 ? '−' : (ti ? '+' : '');
      if (t.kind === 'flat') {
        total += t.sign * t.value; minP += t.sign * t.value; maxP += t.sign * t.value;
        parts.push(op + ' ' + t.value);
        continue;
      }
      let n = Math.max(1, Math.min(t.n, 100)), keepKind = null, keepN = null;
      if (t.keep) { const k = t.keep.match(/(kh|kl|k)(\d+)/i); keepKind = k[1].toLowerCase() === 'kl' ? 'kl' : 'kh'; keepN = parseInt(k[2]); }
      if (adv && t.sides === 20 && t.n === 1 && !t.keep) { n = 2; keepKind = adv > 0 ? 'kh' : 'kl'; keepN = 1; }
      const rolls = Array.from({ length: n }, () => rollDie(t.sides));
      let kept = rolls, dropped = [];
      if (keepN != null && keepN < rolls.length) {
        const idx = rolls.map((v, i) => [v, i]).sort((a, b) => keepKind === 'kh' ? b[0] - a[0] : a[0] - b[0]);
        const keepSet = new Set(idx.slice(0, keepN).map(x => x[1]));
        kept = rolls.filter((_, i) => keepSet.has(i));
        dropped = rolls.filter((_, i) => !keepSet.has(i));
      }
      const sub = kept.reduce((a, b) => a + b, 0);
      total += t.sign * sub; totalDice += kept.length;
      minP += t.sign * kept.length; maxP += t.sign * kept.length * t.sides;
      if (t.sides === 20) critDie = kept.length === 1 ? kept[0] : null;
      const dropStr = dropped.length ? ` (➖ ${dropped.join(', ')})` : '';
      parts.push(`${op} ${kept.join(' + ')}${dropStr}`.trim());
    }
    const crit = critDie === 20 && totalDice === 1;
    const fumble = critDie === 1 && totalDice === 1;
    const formula = terms.map((t, i) => {
      const sg = t.sign < 0 ? '−' : (i ? '+' : '');
      return t.kind === 'flat' ? `${sg}${t.value}` : `${sg}${(t.n > 1 || t.keep) ? t.n : ''}d${t.sides}${t.keep || ''}`;
    }).join(' ').trim() + (adv > 0 ? ' (advantage)' : adv < 0 ? ' (disadvantage)' : '');

    return {
      ok: true, total, label, crit, fumble,
      breakdown: parts.join(' ').replace(/^\+\s*/, '').trim(),
      formula,
      tickMin: Math.max(1, Math.min(minP, maxP)),
      tickMax: Math.max(2, Math.max(minP, maxP)),
    };
  }

  window.dice = {
    toggle() {
      document.getElementById('dice-panel')?.classList.toggle('open');
    },
    toggleDm() {
      document.getElementById('dm-dice-panel')?.classList.toggle('open');
    },

    adjustCount(delta) {
      _dmCount = Math.max(1, Math.min(20, _dmCount + delta));
      const el = document.getElementById('dm-dice-count-display');
      if (el) el.textContent = _dmCount;
    },

    // Voordeel/nadeel instellen (toggelt terug naar normaal bij nogmaals klikken)
    setAdv(mode) {
      _adv = (_adv === mode) ? 0 : mode;
      _renderControls();
    },
    // Vaste bonus bijstellen
    adjustMod(delta) {
      _mod = Math.max(-20, Math.min(30, _mod + delta));
      _renderControls();
    },
    resetMod() { _mod = 0; _renderControls(); },

    roll(sides)   { _doRoll(sides, 1); },
    rollDm(sides) { _doRoll(sides, _dmCount); },

    // Rolt een vrije formule, bv. "4d4+4 Healing", "1d20+5 adv", "1d8+1d6 fire".
    // inlineResultId: optioneel element-ID voor inline resultaat in een modal.
    rollFormula(formulaStr, inlineResultId = null) {
      const r = _rollFormula(formulaStr);
      if (!r.ok) return;

      const critTag   = r.crit ? '  \u2736 Critical!' : r.fumble ? '  \u2715 Fumble!' : '';
      const fullLabel = (r.label ? `${r.formula} ${r.label}` : r.formula) + critTag;

      // Inline resultaat tonen in modal (meteen, zonder animatie)
      if (inlineResultId) {
        const inlineEl = document.getElementById(inlineResultId);
        if (inlineEl) {
          inlineEl.textContent = `\u2192 ${r.total}`;
          inlineEl.classList.remove('dmg-result--flash');
          void inlineEl.offsetWidth; // reflow voor herstart animatie
          inlineEl.classList.add('dmg-result--flash');
          return;   // bij inline-resultaat geen paneel-animatie
        }
      }

      document.getElementById('dice-panel')?.classList.add('open');

      const numEls = _els('result-num');
      const lblEls = _els('result-label');
      const boxEls = _els('result');
      const span   = Math.max(1, r.tickMax - r.tickMin);
      _animate(numEls, lblEls, boxEls,
        () => Math.floor(Math.random() * (span + 1)) + r.tickMin,
        r.total, `${fullLabel} \u2014 ${r.breakdown}`,
        { result: r.total, label: r.formula, crit: r.crit, fumble: r.fumble });
    },

    // Rolt de formule uit een invoerveld (paneel).
    rollText(inputId) {
      const el = document.getElementById(inputId);
      const v = el && el.value;
      if (v && v.trim()) this.rollFormula(v.trim());
    },
    // One-shot d20 roll with advantage or disadvantage (mode: 1=adv, -1=dis)
    rollAdv(mode) {
      const prev = _adv;
      _adv = mode;
      _doRoll(20, 1);
      _adv = prev;
    },

    toggleFormula(btn) {
      const wrap = btn.nextElementSibling;
      if (!wrap || !wrap.classList.contains('dice-formula')) return;
      const isOpen = wrap.classList.toggle('dice-formula--open');
      btn.textContent = isOpen ? '▼ Formula' : '▶ Formula';
    },
  };

  // Gedeelde worp-afhandeling voor speler- en DM-paneel.
  // Voordeel/nadeel geldt alleen voor een enkele d20; de bonus telt altijd mee.
  function _doRoll(sides, count) {
    const numEls = _els('result-num');
    const lblEls = _els('result-label');
    const boxEls = _els('result');
    if (!numEls.length) return;

    const dieLabel = sides === 100 ? 'd%' : `d${sides}`;
    const useAdv   = sides === 20 && count === 1 && _adv !== 0;

    let rolls, kept, natural;
    if (useAdv) {
      const a = _rnd(sides), b = _rnd(sides);
      kept    = _adv > 0 ? Math.max(a, b) : Math.min(a, b);
      natural = kept;
      rolls   = [a, b];
    } else {
      rolls   = Array.from({ length: count }, () => _rnd(sides));
      kept    = rolls.reduce((x, y) => x + y, 0);
      natural = count === 1 ? rolls[0] : null;
    }

    const total    = kept + _mod;
    const isCrit    = sides === 20 && natural === 20;
    const isFumble  = sides === 20 && natural === 1;

    // Label opbouwen
    const prefix    = count > 1 ? `${count}${dieLabel}` : dieLabel;
    const advWord   = useAdv ? (_adv > 0 ? ' advantage' : ' disadvantage') : '';
    let breakdown   = '';
    if (useAdv)            breakdown = `${rolls[0]}, ${rolls[1]} → ${kept}${_modStr(_mod)}`;
    else if (count > 1)   breakdown = `${rolls.join(' + ')}${_modStr(_mod)}`;
    else if (_mod !== 0)  breakdown = `${rolls[0]}${_modStr(_mod)}`;

    let lbl = prefix + advWord;
    if (breakdown) lbl += ` — ${breakdown}`;
    if (isCrit)        lbl += ' — ✶ Critical Hit!';
    else if (isFumble) lbl += ' — ✕ Critical Fail!';

    const minRoll = (useAdv ? 1 : count) + _mod;
    const maxRoll = (useAdv ? sides : count * sides) + _mod;
    _animate(numEls, lblEls, boxEls,
      () => Math.floor(Math.random() * (maxRoll - minRoll + 1)) + minRoll,
      total, lbl,
      { sides, result: total, count, crit: isCrit, fumble: isFumble });
  }

  // Houdt de voordeel/nadeel-knoppen en bonusweergave in beide panelen in sync
  function _renderControls() {
    document.querySelectorAll('.dice-adv-btn').forEach(btn => {
      btn.classList.toggle('dice-adv-btn--on', Number(btn.dataset.adv) === _adv && _adv !== 0);
    });
    document.querySelectorAll('.dice-mod-val').forEach(el => {
      el.textContent = _mod > 0 ? `+${_mod}` : `${_mod}`;
      el.classList.toggle('dice-mod-val--active', _mod !== 0);
    });
  }

  function _renderHistory() {
    const html = _history.map(({ sides, result, count = 1, crit, fumble, label }) => {
      const cls = crit ? ' dice-hist-crit' : fumble ? ' dice-hist-fumble' : '';
      // Formule-entries (vrije roller) tonen hun formule; losse dobbelstenen d{n}.
      const pfx = label != null
        ? esc(label.length > 14 ? label.slice(0, 13) + '\u2026' : label)
        : `${count > 1 ? count + 'd' : 'd'}${sides === 100 ? '%' : sides}`;
      return `<span class="dice-hist-chip${cls}">${pfx}\u00b7${result}</span>`;
    }).join('');
    _els('history').forEach(el => { el.innerHTML = html; });
  }

  _renderControls();
})();

// ── Globaal zoeken ──

let _archiefCache  = null;
let _gsTypeFilter  = null;

window.app._gsSetTypeFilter = function(type) {
  _gsTypeFilter = type || null;
  document.querySelectorAll('.gs-type-chip').forEach(btn => {
    btn.classList.toggle('gs-type-chip--active', btn.dataset.gsType === (_gsTypeFilter || ''));
  });
  const q = document.getElementById('global-search-input')?.value || '';
  window.app._globalSearchRun(q);
};

window.app.openGlobalSearch = async function() {
  const overlay = document.getElementById('global-search-overlay');
  const input   = document.getElementById('global-search-input');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  input.value = '';
  document.getElementById('global-search-results').innerHTML = '';
  // Reset type filter
  _gsTypeFilter = null;
  document.querySelectorAll('.gs-type-chip').forEach(btn => {
    btn.classList.toggle('gs-type-chip--active', btn.dataset.gsType === '');
  });
  setTimeout(() => input.focus(), 50);

  // Prefetch entity types die nog niet in de cache zitten
  const TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const cache = window._entityCache || {};
  await Promise.all(TYPES.filter(t => !cache[t]).map(async t => {
    try {
      cache[t] = await api.listEntities(t);
      window._entityCache = cache;
    } catch { cache[t] = []; }
  }));
};

window.app.closeGlobalSearch = function(e) {
  if (e && e.target !== document.getElementById('global-search-overlay')) return;
  document.getElementById('global-search-overlay')?.classList.add('hidden');
};

let _gsResults = [];   // platte lijst {type,id} in weergavevolgorde (toetsenbordnav)
let _gsActive  = -1;

// Markeer gevonden woorden in een naam (na HTML-escaping).
function _gsHighlight(name, tokens) {
  let safe = esc(name);
  for (const t of tokens) {
    if (!t) continue;
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    safe = safe.replace(re, '\x01$1\x02');
  }
  return safe.replace(/\x01/g, '<mark class="gs-hl">').replace(/\x02/g, '</mark>');
}

window.app._globalSearchRun = async function(q) {
  const resultsEl = document.getElementById('global-search-results');
  if (!q.trim()) { resultsEl.innerHTML = ''; _gsResults = []; _gsActive = -1; return; }

  const TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const meta  = window._entityTypeMeta || {};
  const cache = window._entityCache    || {};
  const filter = window._entityFilter  || (() => []);
  const tokens = window._searchTokens ? window._searchTokens(q) : [q.toLowerCase()];

  // Fetch documenten eenmalig
  if (!_archiefCache) {
    try { const r = await api.listArchief(); _archiefCache = r.documents || r || []; }
    catch { _archiefCache = []; }
  }

  let html = '';
  _gsResults = [];

  // Entiteiten per type (score-gerangschikt door _entityFilter)
  for (const type of TYPES) {
    if (_gsTypeFilter && _gsTypeFilter !== type) continue;
    const list = cache[type] || [];
    const hits = filter(type, list, q).slice(0, 8);
    if (!hits.length) continue;
    const m = meta[type] || { icon: '📄', label: type };
    html += `<div class="gs-group"><div class="gs-group-label">${m.icon} ${m.label}</div>`;
    for (const e of hits) {
      const idx = _gsResults.push({ type, id: e.id }) - 1;
      html += `<button class="gs-result" data-gs-idx="${idx}" onclick="window.app._globalSearchGo('${type}','${esc(e.id)}')">
          <span class="gs-result-name">${_gsHighlight(e.name, tokens)}</span>
          ${e.subtype ? `<span class="gs-result-sub">${esc(e.subtype)}</span>` : ''}
        </button>`;
    }
    html += `</div>`;
  }

  // Documenten (archief) — genormaliseerd matchen
  if (!_gsTypeFilter || _gsTypeFilter === 'documenten') {
    const norm = window._normSearch || (s => String(s || '').toLowerCase());
    const docHits = (_archiefCache).filter(d => {
      const hay = norm((d.name || d.title || '') + ' ' + (d.type || ''));
      return tokens.every(t => hay.includes(t));
    }).slice(0, 8);
    if (docHits.length) {
      html += `<div class="gs-group"><div class="gs-group-label">${icon('scroll-text')} Documenten</div>`;
      for (const d of docHits) {
        const idx = _gsResults.push({ type: 'documenten', id: d.id }) - 1;
        html += `<button class="gs-result" data-gs-idx="${idx}" onclick="window.app._globalSearchGo('documenten','${esc(d.id)}')">
            <span class="gs-result-name">${_gsHighlight(d.name || d.title || d.id, tokens)}</span>
          </button>`;
      }
      html += `</div>`;
    }
  }

  resultsEl.innerHTML = html || `<p class="gs-empty">Geen resultaten gevonden voor "<em>${esc(q)}</em>".</p>`;
  _gsSetActive(_gsResults.length ? 0 : -1);
};

function _gsSetActive(idx) {
  _gsActive = idx;
  const btns = document.querySelectorAll('#global-search-results .gs-result');
  btns.forEach(b => b.classList.toggle('gs-result--active', +b.dataset.gsIdx === idx));
  const cur = [...btns].find(b => +b.dataset.gsIdx === idx);
  cur?.scrollIntoView({ block: 'nearest' });
}

// Toetsenbordnavigatie in de zoekoverlay (pijltjes + Enter).
window.app._gsKey = function(e) {
  if (e.key === 'Escape') { window.app.closeGlobalSearch(); return; }
  if (!_gsResults.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _gsSetActive((_gsActive + 1) % _gsResults.length); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _gsSetActive((_gsActive - 1 + _gsResults.length) % _gsResults.length); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const r = _gsResults[_gsActive] || _gsResults[0];
    if (r) window.app._globalSearchGo(r.type, r.id);
  }
};

window.app._globalSearchGo = function(type, id) {
  document.getElementById('global-search-overlay')?.classList.add('hidden');
  if (type === 'documenten') {
    switchSection('documenten');
  } else {
    switchSection(type);
    setTimeout(() => window._openDetail?.(type, id), 120);
  }
};

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('global-search-overlay')?.classList.add('hidden');
    closeLightbox();
    closeModal();
    closeLoginModal();
    document.getElementById('dice-panel')?.classList.remove('open');
    document.getElementById('dm-panel')?.classList.remove('open');
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    window.app.openGlobalSearch();
  }
});

// ── Init ──
// ── App header (titel + ondertitel) ──

function applyAppMeta(meta) {
  const m = meta || state.meta;
  if (!m) return;
  const titleEl    = document.getElementById('app-title');
  const subtitleEl = document.getElementById('app-subtitle');
  if (titleEl    && m.appTitle !== undefined) titleEl.textContent    = m.appTitle;
  if (subtitleEl)                             subtitleEl.textContent = m.appSubtitle || '';
  // Paginatitel ook aanpassen
  if (m.appTitle) document.title = m.appTitle;
  // Thema toepassen
  const theme = m.theme || 'default';
  document.documentElement.setAttribute('data-theme', theme);
  // Valutanamen opslaan zodat andere onderdelen ze kunnen ophalen
  if (m.currency) window._currency = m.currency;
  // Embleem: het beeld hoort bij de campagne, niet bij de code. Geen embleem =
  // geen plaatje, in plaats van dat van Grisburgh.
  _zetEmbleem(document.getElementById('app-crest'),     m.embleemKop || m.embleem);
  _zetEmbleem(document.getElementById('landing-crest'), m.embleem);
  _zetDienstLabels();
  _scheduleFitHeader();   // titel en dienstnamen bepalen de breedte van de kop
  // Modules: wat uit staat verdwijnt uit beeld.
  if (m.modules) window._modules = m.modules;
  if (m.verborgen) { window._verborgen = m.verborgen; _pasModulesToe(); }
}

function _zetEmbleem(el, bron) {
  if (!el) return;
  if (bron) { el.src = bron; el.classList.remove('hidden'); }
  else { el.removeAttribute('src'); el.classList.add('hidden'); }
}

// ── Modules ──
// Welke knoppen weg moeten rekent de server uit (lib/modules.js), zodat de
// koppeling module → knop op één plek staat. Hier alleen nog het verbergen.
window._moduleAan = (id) => window._modules?.[id] !== false;
const _verborgenLijst = (soort) => window._verborgen?.[soort] || [];
window._spelerTabAan = (tab) => !_verborgenLijst('spelerTabs').includes(tab);
window._dmTabAan     = (tab) => !_verborgenLijst('dmTabs').includes(tab);

function _pasModulesToe() {
  // Eerst schoonvegen: zet de beheerder een module weer aan, dan moet de knop
  // terugkomen zonder dat er een herlaadbeurt aan te pas komt.
  document.querySelectorAll('.module-uit').forEach(el => el.classList.remove('module-uit'));
  for (const sectie of _verborgenLijst('secties')) {
    document.querySelectorAll(`[data-section="${sectie}"]`).forEach(el => el.classList.add('module-uit'));
  }
  for (const tab of _verborgenLijst('logtabs')) {
    document.querySelectorAll(`[data-logtab="${tab}"]`).forEach(el => el.classList.add('module-uit'));
  }
  if (!window._moduleAan('dobbelstenen')) {
    document.getElementById('dice-fab')?.classList.add('module-uit');
    document.getElementById('dm-dice-fab')?.classList.add('module-uit');
  }
  // Een menuknop met alleen nog uitgezette items heeft niets meer te openen.
  for (const [knop, menu] of [['archief-nav-group', 'archief-menu'], ['logboek-nav-group', 'logboek-menu'], ['diensten-nav-group', 'diensten-menu']]) {
    const items = document.querySelectorAll(`#${menu} > *`);
    const over  = [...items].filter(el => !el.classList.contains('module-uit'));
    document.getElementById(knop)?.classList.toggle('module-uit', items.length > 0 && over.length === 0);
  }
}

function editHeader() {
  const titleEl    = document.getElementById('app-title');
  const subtitleEl = document.getElementById('app-subtitle');
  const display    = document.getElementById('header-display');
  const editor     = document.getElementById('header-editor');
  const tInput     = document.getElementById('header-title-input');
  const sInput     = document.getElementById('header-subtitle-input');
  if (!display || !editor) return;
  tInput.value = titleEl?.textContent || '';
  sInput.value = subtitleEl?.textContent || '';
  display.classList.add('hidden');
  editor.classList.remove('hidden');
  tInput.focus();
  tInput.select();
}

async function saveHeader() {
  const tInput = document.getElementById('header-title-input');
  const sInput = document.getElementById('header-subtitle-input');
  const t = tInput?.value.trim();
  const s = sInput?.value.trim();
  if (!t && !s) { cancelHeader(); return; }
  try {
    const updated = await api.saveAppMeta({ appTitle: t, appSubtitle: s });
    state.meta = { ...state.meta, ...updated };
    applyAppMeta(state.meta);
  } catch (err) {
    alert('Opslaan mislukt: ' + err.message);
  }
  cancelHeader();
}

function cancelHeader() {
  document.getElementById('header-display')?.classList.remove('hidden');
  document.getElementById('header-editor')?.classList.add('hidden');
}

async function init() {
  // Welke campagne kijken we? Normaal staat die in het pad (/grisburgh); komt
  // iemand via een oude bladwijzer binnen, dan vertelt de server het.
  if (!campagneUitUrl()) {
    try { zetCampagne((await api.campagneInfo()).campagne); } catch { /* ok */ }
  }

  try {
    const me = await api.role();
    state.role        = me.role        || 'player';
    state.playerName  = me.playerName  || null;
    state.characterId = me.characterId || null;
    state.isSandbox   = me.isSandbox   || false;
  } catch { /* default player */ }

  try {
    state.meta = await api.meta();
    applyAppMeta(state.meta);
  } catch { /* ok */ }

  // Diensten-toegangsstaten laden voor spelers
  await _loadDienstenToegang().catch(() => {});

  // Help-overschrijvingen laden
  api.getHelpContent().then(d => { _helpOverrides = d || {}; }).catch(() => {});

  // Globale glossary-tooltip (hover-uitleg van D&D-termen) activeren
  _initGlobalGlossary();

  // Enter in header-editor slaat op
  document.getElementById('header-title-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') window.app.saveHeader(); if (e.key === 'Escape') window.app.cancelHeader(); });
  document.getElementById('header-subtitle-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') window.app.saveHeader(); if (e.key === 'Escape') window.app.cancelHeader(); });

  applyRole();
  _wlAcInit();
  initCampagne();
  initArchief();
  initSocket();
  initDmPanel();

  // Laad groepen en render wisselaar (alleen relevant voor DM, maar state ook voor spelers)
  try {
    const { groups, activeGroup } = await api.listGroups();
    _activeGroupId = activeGroup;
    window.renderGroupSwitcher(groups, activeGroup);
  } catch { /* niet ingelogd als DM */ }

  renderParty();
  const hashSection   = location.hash.replace('#', '');
  const validSections = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'logboek', 'kaart', 'mijn-karakter'];
  const startSection  = validSections.includes(hashSection) ? hashSection : 'personages';
  // Wacht op de entity-index zodat wikilinks al bij de eerste render werken
  await (window._entityIndexReady || Promise.resolve());
  // Voorkom dat anonieme speler direct op mijn-karakter-tab belandt
  switchSection(startSection === 'mijn-karakter' && !state.playerName ? 'personages' : startSection);

  // iPad kiosk-modus: sla landingspagina over, toon display canvas
  _displayModeInlossen();
  if (window._isDisplayMode) {
    _initDisplayMode();
  } else if (state.role === 'player' && state.playerName && state.characterId) {
    // Geldige sessie: toon welkomst-animatie, dan direct door naar karakter
    _landingAutoLogin(state.characterId, state.playerName);
  } else if (state.role === 'player' && !state.playerName) {
    showLanding();
  }

  // Nu pas in beeld: hierboven is besloten of iemand de app of de
  // landingspagina hoort te zien.
  document.body.classList.remove('boot');
  _scheduleFitHeader(); // eerste meting nadat de header gerenderd is
}

// ── iPad Display Mode ──

// Na een tijd zonder nieuwe presentatie keert de tablet terug naar het sfeerscherm,
// zodat er nooit een verouderd beeld eindeloos blijft staan.
const _DISPLAY_IDLE_MS = 8 * 60 * 1000;
let _displayIdleTimer = null;
function _scheduleDisplayIdle() {
  clearTimeout(_displayIdleTimer);
  _displayIdleTimer = setTimeout(() => window._displayIdle?.(), _DISPLAY_IDLE_MS);
}

// Genereer drijvende sintels voor het idle-sfeerscherm (puur visueel, één keer).
// ── Sferen voor het tafelscherm ──────────────────────────────────────────────
// De eerste negen zijn toegesneden op de aktes van deze campagne, daarna volgen
// algemene sferen. Kleur en achtergrond zitten in CSS (.sfeer--*); hier staat
// alleen hoe de deeltjes zich gedragen. richting: 'op' | 'val' | 'zweef'.
const _SFEREN = [
  { id: 'haard',        label: 'Haard',         richting: 'op',    n: 18, sz: [2, 5],   dur: [9, 19], drift: 40 },
  { id: 'havenstad',    label: 'Havenstad',     richting: 'zweef', n: 22, sz: [1, 3],   dur: [12, 22], drift: 70 },
  { id: 'zee',          label: 'Op zee',        richting: 'zweef', n: 26, sz: [1, 3.5], dur: [9, 16],  drift: 120 },
  { id: 'amberwoud',    label: 'Amberwoud',     richting: 'val',   n: 20, sz: [2, 5],   dur: [11, 20], drift: 90 },
  { id: 'bedorven',     label: 'Bedorven woud', richting: 'zweef', n: 24, sz: [1.5, 4], dur: [10, 18], drift: 60 },
  { id: 'storm',        label: 'Storm',         richting: 'val',   n: 40, sz: [1, 2],   dur: [1.6, 3], drift: 40 },
  { id: 'toren',        label: 'Arcane toren',  richting: 'op',    n: 20, sz: [1.5, 4], dur: [10, 20], drift: 50 },
  { id: 'lichtmis',     label: 'Lichtmis',      richting: 'op',    n: 26, sz: [2, 4.5], dur: [12, 22], drift: 30 },
  { id: 'schaduwrijk',  label: 'Schaduwrijk',   richting: 'val',   n: 26, sz: [1, 3],   dur: [12, 24], drift: 70 },
  { id: 'sneeuw',       label: 'Sneeuw',        richting: 'val',   n: 34, sz: [2, 4.5], dur: [10, 20], drift: 110 },
  { id: 'grot',         label: 'Grot',          richting: 'val',   n: 12, sz: [1, 2.5], dur: [14, 26], drift: 30 },
  { id: 'sterrennacht', label: 'Sterrennacht',  richting: 'zweef', n: 30, sz: [1, 2.5], dur: [6, 12],  drift: 6  },
  { id: 'dauw',         label: 'Ochtenddauw',   richting: 'op',    n: 16, sz: [1.5, 4], dur: [14, 26], drift: 50 },
  { id: 'kerker',       label: 'Kerker',        richting: 'op',    n: 10, sz: [1.5, 3], dur: [12, 22], drift: 25 },
];
window._SFEREN = _SFEREN;
let _huidigeSfeer = 'haard';

function _buildIdleEmbers(sfeerId) {
  const host = document.getElementById('display-idle-embers');
  if (!host) return;
  const s = _SFEREN.find(x => x.id === sfeerId) || _SFEREN[0];
  const klasse = s.richting === 'val' ? ' display-ember--val'
               : s.richting === 'zweef' ? ' display-ember--zweef' : '';
  const tussen = (a, b) => a + Math.random() * (b - a);
  let html = '';
  for (let i = 0; i < s.n; i++) {
    const left  = (Math.random() * 100).toFixed(1);
    const dur   = tussen(s.dur[0], s.dur[1]).toFixed(1);
    const delay = (-Math.random() * dur).toFixed(1);      // gespreid starten
    const size  = tussen(s.sz[0], s.sz[1]).toFixed(1);
    const drift = (Math.random() * s.drift - s.drift / 2).toFixed(0);
    // Zwevende deeltjes staan verspreid over de hoogte i.p.v. aan één rand.
    const top   = s.richting === 'zweef' ? `top:${(Math.random() * 92).toFixed(1)}%;` : '';
    html += `<span class="display-ember${klasse}" style="left:${left}%;${top}width:${size}px;height:${size}px;`
          + `animation-duration:${dur}s;animation-delay:${delay}s;--ember-drift:${drift}px"></span>`;
  }
  host.innerHTML = html;
}

// Zet de sfeer van het tafelscherm. Alleen de klasse wisselen zou de deeltjes
// laten staan; die moeten opnieuw, want aantal en richting verschillen per sfeer.
window._setDisplaySfeer = function(sfeerId) {
  const scherm = document.getElementById('display-idle');
  if (!scherm) return;
  const s = _SFEREN.find(x => x.id === sfeerId) || _SFEREN[0];
  _huidigeSfeer = s.id;
  _SFEREN.forEach(x => scherm.classList.remove(`sfeer--${x.id}`));
  scherm.classList.add(`sfeer--${s.id}`);
  _buildIdleEmbers(s.id);
};

// Eenmalig effect over het sfeerscherm. Verdwijnt vanzelf; bliksem en duister
// zijn een overlay, een windvlaag duwt de bestaande deeltjes opzij.
window._displayEffect = function(effect) {
  const scherm = document.getElementById('display-idle');
  if (!scherm) return;
  if (effect === 'windvlaag') {
    const host = document.getElementById('display-idle-embers');
    if (!host) return;
    host.classList.remove('is-windvlaag');
    void host.offsetWidth;              // herstart de animatie
    host.classList.add('is-windvlaag');
    setTimeout(() => host.classList.remove('is-windvlaag'), 2300);
    return;
  }
  const laag = document.createElement('div');
  laag.className = `display-fx display-fx--${effect === 'duister' ? 'duister' : 'bliksem'}`;
  scherm.appendChild(laag);
  setTimeout(() => laag.remove(), effect === 'duister' ? 2800 : 1300);
};

function _initDisplayMode() {
  const canvas = document.getElementById('display-canvas');
  if (canvas) canvas.classList.remove('hidden');
  // Kiosk-modus: geen speler ingelogd → verberg speler-specifieke UI
  if (!state.characterId) document.body.classList.add('display-kiosk');
  // Zet campagnetitel + ondertitel op het sfeerscherm
  api.getMeta?.().then(meta => {
    const titleEl = document.getElementById('display-campaign-title');
    const subEl   = document.querySelector('.display-campaign-sub');
    if (titleEl) titleEl.textContent = meta?.appTitle || meta?.title || 'Campagne';
    if (subEl) subEl.textContent = meta?.appSubtitle || '';
  }).catch(() => {});
  _buildIdleEmbers(_huidigeSfeer);
  // Het tafelscherm heeft een eigen, volledige gevechtsweergave (.co-display in
  // dm-panel.js) — nooit geminimaliseerd. Voorheen werd hier 'minimized' gezet
  // terwijl socket-client.js het er bij elke combat:updated weer afhaalde; die
  // tegenstrijdigheid liet de tablet in de spelerslayout landen, die de kiosk-CSS
  // volledig verbergt (leeg wit scherm). initDmPanel() rendert de overlay al met
  // de juiste staat, dus hier is niets meer nodig.
}

window._displayExit = function() {
  localStorage.removeItem('displayMode');
  window._isDisplayMode = false;
  document.body.classList.remove('display-mode');
  document.getElementById('display-canvas')?.classList.add('hidden');
  // Terug naar waar je vandaan kwam. Wie nog een sessie heeft — meestal de DM
  // die dit scherm zelf omzette — hoort niet opnieuw te moeten inloggen; die
  // landde eerst op de landingspagina. `?display=1` moet wél uit de URL, anders
  // zet init() het scherm meteen weer om.
  if (state.role === 'dm' || state.characterId) {
    const url = new URL(location.href);
    url.searchParams.delete('display');
    location.replace(url.toString());
    return;
  }
  showLanding();
};

window._displayShowImage = function(url, caption) {
  document.getElementById('display-idle').style.display = 'none';
  document.getElementById('display-dungeon-screen').style.display = 'none';
  const screen = document.getElementById('display-image-screen');
  screen.style.display = 'flex';
  // Fade: vervang src zodat de animatie opnieuw afspeelt
  const img = document.getElementById('display-img');
  img.classList.remove('display-img--in');
  img.src = url;
  img.onload = () => img.classList.add('display-img--in');
  const cap = document.getElementById('display-img-caption');
  if (cap) cap.textContent = caption || '';
  _scheduleDisplayIdle();
};

window._displayShowDungeon = function() {
  document.getElementById('display-idle').style.display = 'none';
  document.getElementById('display-image-screen').style.display = 'none';
  const screen = document.getElementById('display-dungeon-screen');
  screen.style.display = 'flex';
  const content = document.getElementById('display-dungeon-content');
  if (content) renderDungeon(content);
  _scheduleDisplayIdle();
};

window._displayIdle = function() {
  clearTimeout(_displayIdleTimer);
  document.getElementById('display-image-screen').style.display = 'none';
  document.getElementById('display-dungeon-screen').style.display = 'none';
  document.getElementById('display-idle').style.display = 'flex';
  _buildIdleEmbers(_huidigeSfeer);
};

// ── Herberg ──

// ── Diensten toegang ──
async function _loadDienstenToegang() {
  if (state.role !== 'player' || !state.playerName) { state.dienstenToegang = {}; _updateDienstenMenu(); return; }
  try { state.dienstenToegang = await api.getDienstenToegang(); }
  catch { state.dienstenToegang = {}; }
  _updateDienstenMenu();
  const DIENST_SECTIES = ['herberg','tweespalt','gock','ursula','tempel','facties','magizoo'];
  if (DIENST_SECTIES.includes(state.activeSection)) refreshSection(state.activeSection);
}
window.app._loadDienstenToegang = _loadDienstenToegang;

function _getDienstToegang(dienst) {
  return state.dienstenToegang?.[dienst] || 'beschikbaar';
}

function _dienstNietBeschikbaar(el, naam) {
  el.innerHTML = `
    <div class="herberg-scene" style="justify-content:center;align-items:center;min-height:220px">
      <div class="herberg-content" style="text-align:center;padding:2rem 1.5rem">
        <div style="font-size:2.2rem;margin-bottom:.6rem">${icon('lock')}</div>
        <p class="herberg-groet" style="margin:0">${esc(naam)} is momenteel niet beschikbaar.</p>
        <p style="opacity:.5;font-size:.85rem;margin-top:.5rem">De DM heeft deze dienst tijdelijk gesloten.</p>
      </div>
    </div>`;
}

function _updateDienstenMenu() {
  const KNOPPEN = {
    herberg:   document.getElementById('diensten-herberg-item'),
    tweespalt: document.getElementById('diensten-tweespalt-item'),
    gock:      document.getElementById('diensten-gock-item'),
    ursula:    document.getElementById('diensten-ursula-item'),
    tempel:    document.getElementById('diensten-tempel-item'),
    facties:   document.getElementById('diensten-facties-item'),
    magizoo:   document.getElementById('diensten-magizoo-item'),
  };
  for (const [dienst, btn] of Object.entries(KNOPPEN)) {
    if (!btn) continue;
    const staat = _getDienstToegang(dienst);
    if (dienst !== 'herberg') btn.classList.toggle('hidden', staat === 'verborgen');
    else if (staat === 'verborgen') btn.classList.add('hidden');
    btn.classList.toggle('dienst-vergrendeld', staat === 'zichtbaar');
  }
  // Facties: zichtbaar zodra er minstens één revealed factie is
  api.getFacties().then(d => {
    const heeftRevealed = (d?.facties || []).some(f => f.zichtbaar);
    const factiesBtn = document.getElementById('diensten-facties-item');
    if (factiesBtn) factiesBtn.classList.toggle('hidden', !heeftRevealed);
  }).catch(() => {});
}

// DM-inspectie: toon alle diensten-items ongeacht groep-toegang, zodat de DM
// elke dienst kan openen en bekijken zoals spelers die zien. De toegang-sloten
// in de routing zijn al met !isDM-guards uitgezet, dus de DM krijgt de echte render.
function _updateDienstenMenuDM() {
  // DM ziet alle diensten — ook Herberg en Facties — ongeacht config/toegang,
  // zodat hij elke dienst kan openen en inspecteren.
  for (const d of ['herberg', 'tweespalt', 'gock', 'ursula', 'tempel', 'magizoo', 'facties']) {
    document.getElementById(`diensten-${d}-item`)?.classList.remove('hidden', 'dienst-vergrendeld');
  }
}

window._updateDienstenMenuFromSocket = () => {
  api.getFacties().then(d => {
    const heeftRevealed = (d?.facties || []).some(f => f.zichtbaar);
    const factiesBtn = document.getElementById('diensten-facties-item');
    if (factiesBtn) factiesBtn.classList.toggle('hidden', !heeftRevealed);
  }).catch(() => {});
};

function _dienstNietBereikbaar(el, naam) {
  el.innerHTML = `
    <div class="herberg-scene" style="justify-content:center;align-items:center;min-height:220px">
      <div class="herberg-content" style="text-align:center;padding:2rem 1.5rem">
        <div style="font-size:2.2rem;margin-bottom:.6rem">${icon('lock')}</div>
        <p class="herberg-groet" style="margin:0">${esc(naam)} is momenteel niet bereikbaar.</p>
        <p style="opacity:.5;font-size:.85rem;margin-top:.5rem">De groep bevindt zich buiten ${esc(window._campagneNaam())}.</p>
      </div>
    </div>`;
}

let _herbergActiveTab = 'roddels';   // 'roddels' | 'tap' — onthouden over re-renders

// ── Bereikbaarheid ──────────────────────────────────────────────────────────
// De server rekent uit wat er dichtzit (akte + de handmatige "buiten
// Grisburgh"-knop); hier alleen nog opzoeken. De DM ziet altijd alles, anders
// kan hij een dienst niet voorbereiden terwijl de party elders is.
window._dienstDicht = (key) => {
  if (window.app?.isDM?.()) return false;
  const b = window.app?.state?.meta?.bereikbaarheid || {};
  return b.allesDicht ? true : (b.dienstenDicht || []).includes(key);
};
window._entiteitDicht = (id) => {
  if (window.app?.isDM?.()) return false;
  const b = window.app?.state?.meta?.bereikbaarheid || {};
  return b.allesDicht ? !(b.vrijgesteld || []).includes(id) : (b.entiteitenDicht || []).includes(id);
};

async function renderHerberg() {
  const el = document.getElementById('section-herberg');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('herberg')) {
    _dienstNietBereikbaar(el, meta.herberg?.naam || 'De herberg');
    return;
  }

  let data;
  try { data = await api.get('/herberg'); }
  catch { el.innerHTML = '<p class="p-8 text-ink-dim">Herberg niet beschikbaar.</p>'; return; }

  const { config, state: hState, entities, playerFirstName, currency } = data;
  const remaining = config.maxVragen - hState.vragen;
  const cooldownActief = hState.cooldownTot && new Date(hState.cooldownTot) > new Date();
  const menu = Array.isArray(config.menu) ? config.menu : [];
  const heeftMenu = menu.length > 0;

  // Begroetingstekst — {naam} vervangen door voornaam speler
  const _groetTekst = config.groet
    ? config.groet.replace(/\{naam\}/gi, esc(playerFirstName || 'avonturier'))
    : `${playerFirstName ? esc(playerFirstName) + '!' : 'Avonturiers!'} Wat kan ik voor je betekenen?`;

  // Alleen entiteiten tonen waarvan de roddel nog niet uitgesproken is
  const beschikbaar = entities.filter(e => !e.uitgesproken);

  // 3 gerandomiseerde voorbeelden
  const _sample = (arr, n) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  let _gesamplede = _sample(beschikbaar, 3);

  const tellerTekst = !cooldownActief && hState.vragen > 0
    ? remaining === 1
      ? `Het is druk in de herberg. ${esc(config.waard)} heeft nog tijd voor een vraag.`
      : remaining === 2
        ? `Het is druk in de herberg. ${esc(config.waard)} heeft nog tijd voor twee vragen.`
        : ''
    : '';

  // Paneel 1 — Roddels (de bestaande vraag-de-waard-functie)
  const roddelPaneel = `
        ${cooldownActief
          ? `<p class="herberg-cooldown-tekst">${esc(config.waard)} helpt even een andere klant. Ze is zo bij je terug.</p>`
          : remaining <= 0
            ? `<p class="herberg-cooldown-tekst">${esc(config.waard)} heeft genoeg gesproken voor vandaag.</p>`
            : `<div class="herberg-zoek-wrap">
                ${tellerTekst ? `<p class="herberg-teller">${tellerTekst}</p>` : ''}
                <div id="herberg-lijst" class="herberg-lijst">
                  ${beschikbaar.length === 0
                    ? `<p class="herberg-leeg">${esc(config.waard)} weet niets meer te vertellen.</p>`
                    : _gesamplede.map(e => `
                        <div class="herberg-item-row">
                          <button class="herberg-item"
                            onclick="window._herbergVraag('${esc(e.id)}')"
                            data-name="${esc(e.name.toLowerCase())}">
                            <span class="herberg-item-naam">${esc(e.name)}</span>
                            <span class="herberg-item-type">${e.type === 'personages' ? 'persoon' : 'locatie'}</span>
                          </button>
                          <button class="herberg-item-card-btn"
                            onclick="event.stopPropagation();window._openDetail('${esc(e.type)}','${esc(e.id)}')"
                            title="Bekijk kaartje">↗</button>
                        </div>`).join('')}
                  ${beschikbaar.length > 3 ? `
                    <button class="herberg-item herberg-item--shuffle"
                      onclick="window._herbergShuffle()"
                      title="Andere suggesties">
                      <span class="herberg-item-naam">${icon('dice',{cls:'icon-gi'})} Andere suggesties…</span>
                    </button>` : ''}
                </div>
              </div>`
        }
        <div id="herberg-antwoord" class="herberg-antwoord hidden"></div>`;

  // Paneel 2 — Aan de tap (drankjes/maaltijden: temp HP + status)
  const tapPaneel = `
        <p class="herberg-teller">${icon('beer')} ${esc(config.waard)} schuift wat voor je aan de tap</p>
        ${currency ? `<p class="herberg-tap-beurs">Op zak: <strong>${_magizooBeurs(currency)}</strong></p>` : ''}
        <div class="herberg-menu-lijst">
          ${menu.map(m => _herbergMenuKaart(m)).join('')}
        </div>
        <div id="herberg-bestel-resultaat" class="herberg-antwoord hidden"></div>`;

  el.innerHTML = `
    <div class="herberg-scene">
      <div class="herberg-content">
        <div class="dienst-beurs-topbar" style="justify-content:flex-end">${_helpBtn('herberg')}</div>
        <div class="herberg-portrait-wrap">
          ${config.imageId
            ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round${cooldownActief ? ' herberg-portrait--weg' : ''}" alt="${esc(config.waard)}">`
            : `<div class="herberg-portrait-round herberg-portrait-fallback${cooldownActief ? ' herberg-portrait--weg' : ''}">${icon('beer')}</div>`}
        </div>
        <p class="herberg-groet">${_groetTekst}</p>

        ${heeftMenu ? `
          <div class="dienst-subtab-nav">
            <button class="dienst-subtab-btn${_herbergActiveTab === 'roddels' ? ' active' : ''}" data-tab="roddels" onclick="window._herbergTab('roddels')">${icon('message-circle')} Roddels</button>
            <button class="dienst-subtab-btn${_herbergActiveTab === 'tap' ? ' active' : ''}" data-tab="tap" onclick="window._herbergTab('tap')">${icon('beer')} Aan de tap</button>
          </div>
          <div class="dienst-subtab-panel${_herbergActiveTab === 'roddels' ? '' : ' hidden'}" id="herberg-panel-roddels">${roddelPaneel}</div>
          <div class="dienst-subtab-panel${_herbergActiveTab === 'tap' ? '' : ' hidden'}" id="herberg-panel-tap">${tapPaneel}</div>
        ` : roddelPaneel}
      </div>
    </div>
  `;
}

// Eén menukaartje in "Aan de tap"
function _herbergMenuKaart(m) {
  const effecten = [];
  const tempSpec = String(m.tempHp ?? '').trim();
  if (/^\d+d\d+$/i.test(tempSpec)) effecten.push(`${tempSpec} temp HP`);
  else { const tHp = parseInt(tempSpec, 10) || 0; if (tHp > 0) effecten.push(`+${tHp} temp HP`); }
  if (m.buffLabel) effecten.push(esc(m.buffLabel));
  return `
    <div class="herberg-menu-kaart">
      <div class="herberg-menu-kaart-body">
        <div class="herberg-menu-kaart-naam">${esc(m.naam)}</div>
        ${m.beschrijving ? `<div class="herberg-menu-kaart-desc">${esc(m.beschrijving)}</div>` : ''}
        ${effecten.length ? `<div class="herberg-menu-effecten">${effecten.map(e => `<span class="herberg-menu-tag">${e}</span>`).join('')}</div>` : ''}
      </div>
      <div class="herberg-menu-kaart-actie">
        <span class="herberg-menu-prijs">${m.prijs ? esc(m.prijs) : 'gratis'}</span>
        <button class="ts-wedden-btn" onclick="window._herbergBestel('${esc(m.id)}')">Bestel</button>
      </div>
    </div>`;
}

// Wissel tussen Roddels en Aan de tap (client-side, onthouden over re-renders).
window._herbergTab = (name) => {
  _herbergActiveTab = name;
  document.querySelectorAll('#section-herberg .dienst-subtab-panel')
    .forEach(p => p.classList.toggle('hidden', p.id !== 'herberg-panel-' + name));
  document.querySelectorAll('#section-herberg .dienst-subtab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === name));
};

window._herbergBestel = async (itemId) => {
  const resEl = document.getElementById('herberg-bestel-resultaat');
  try {
    const res = await api.post('/herberg/bestel', { itemId });
    const effecten = [];
    if (res.tempRoll) effecten.push(`${icon('dice')} ${esc(res.tempRoll.formule)} → ${res.tempRoll.resultaat} temp HP`);
    else if (res.tempHp) effecten.push(`+${res.tempHp} temp HP`);
    if (res.buff) effecten.push(esc(res.buff.label));
    if (resEl) {
      resEl.classList.remove('hidden');
      resEl.innerHTML = `
        <div class="herberg-bubble">
          <p class="herberg-bubble-text">„${esc(res.item.beschrijving || 'Proost!')}“</p>
          ${effecten.length ? `<div class="herberg-menu-effecten" style="margin-top:8px;justify-content:center">${effecten.map(e => `<span class="herberg-menu-tag">${e}</span>`).join('')}</div>` : ''}
        </div>`;
    }
    _tsToast(`${res.item.naam} besteld — proost!`);
    // Beurs in het tap-paneel live bijwerken
    const beursEl = document.querySelector('#herberg-panel-tap .herberg-tap-beurs strong');
    if (beursEl && res.currency) beursEl.textContent = _magizooBeurs(res.currency);
  } catch (err) {
    _tsToast(err.message || 'Bestellen mislukt');
  }
};

window._getExtraSpeedsFromDOM = function() {
  return Array.from(document.querySelectorAll('.pcs-extra-speed-item')).map(item => ({
    label: item.querySelector('.pcs-speed-label-select')?.value || item.querySelector('.pcs-speed-label-input')?.value || '',
    value: item.querySelector('.pcs-input')?.value || ''
  }));
};

window._saveExtraSpeedFull = async function() {
  const charId = state.characterId;
  if (!charId) return;
  const extras = window._getExtraSpeedsFromDOM();
  await api.patchPlayerProfile(charId, { extraSpeeds: JSON.stringify(extras) }).catch(e => console.warn('extraSpeeds opslaan mislukt', e));
};

window._addExtraSpeed = async function() {
  const charId = state.characterId;
  if (!charId) return;
  const extras = window._getExtraSpeedsFromDOM();
  const used = new Set(extras.map(e => e.label));
  const next = ['Swim','Fly','Climb','Burrow','Hover'].find(t => !used.has(t)) || 'Swim';
  extras.push({ label: next, value: '' });
  await api.patchPlayerProfile(charId, { extraSpeeds: JSON.stringify(extras) }).catch(e => console.warn('extraSpeeds opslaan mislukt', e));
  window.app.refreshSection('mijn-karakter');
};

window._removeExtraSpeed = async function(idx) {
  const charId = state.characterId;
  if (!charId) return;
  const extras = window._getExtraSpeedsFromDOM();
  extras.splice(idx, 1);
  await api.patchPlayerProfile(charId, { extraSpeeds: JSON.stringify(extras) }).catch(e => console.warn('extraSpeeds opslaan mislukt', e));
  window.app.refreshSection('mijn-karakter');
};

window._herbergFilter = (q) => {
  document.querySelectorAll('.herberg-item').forEach(btn => {
    btn.classList.toggle('hidden', !btn.dataset.name.includes(q.toLowerCase()));
  });
};

window._herbergShuffle = () => {
  // Herlaad herberg zodat een nieuwe sample getoond wordt
  window.app?.refreshSection('herberg');
};

window._herbergVraag = async (entityId) => {
  const antwoord = document.getElementById('herberg-antwoord');
  if (!antwoord) return;
  antwoord.classList.remove('hidden');
  antwoord.innerHTML = '<p class="herberg-loading">…</p>';
  try {
    const res = await api.post('/herberg/vraag', { entityId });
    const bubbleHtml = `
      <div class="herberg-bubble">
        <p class="herberg-bubble-text">\u201e${esc(res.flavour)}\u201c</p>
        ${res.audioId ? `<button class="flavour-audio-btn" onclick="window._audioToggle('${esc(res.audioId)}')">▶</button>` : ''}
        <div class="herberg-bubble-footer">
          <p class="herberg-bubble-naam">— over ${esc(res.entityName)}</p>
          <button class="herberg-bubble-card-btn"
            onclick="window._openDetail('${esc(res.entityType)}','${esc(res.entityId)}')"
            title="Bekijk kaartje van ${esc(res.entityName)}">↗</button>
        </div>
      </div>`;
    antwoord.innerHTML = bubbleHtml;
    if (res.audioId) window._audioToggle(res.audioId);
    // Re-render herberg (toont bijgewerkte lijst zonder zojuist verteld item), bewaar antwoord
    renderHerberg().then(() => {
      const a = document.getElementById('herberg-antwoord');
      if (a) { a.classList.remove('hidden'); a.innerHTML = bubbleHtml; }
    });
  } catch (err) {
    antwoord.innerHTML = `<p class="herberg-err">${err.message || 'Fout'}</p>`;
  }
};

// ── De Gock / Privédetective ────────────────────────────────────────────────

async function renderGock() {
  const el = document.getElementById('section-gock');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('gock')) {
    _dienstNietBereikbaar(el, meta.gock?.naam || 'De Gock');
    return;
  }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';

  let data;
  try { data = await api.getGock(); }
  catch (e) {
    el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)} (${esc(e.constructor?.name || 'Error')})</p></div></div>`;
    return;
  }

  const { config, geval, beschikbaar = [], currency } = data;
  const heeftLopendeZaak = geval && !geval.gereed;
  const heeftKlaarZaak = geval && geval.gereed && !geval.opgehaald;

  function beursTekst(cur) {
    return [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
  }
  function prijsTekst(p) {
    return [p.fl && `${p.fl} fl`, p.kn && `${p.kn} kn`, p.cl && `${p.cl} cl`].filter(Boolean).join(' ') || '0';
  }

  let restTijdTekst = '';
  if (heeftLopendeZaak && geval.klaarOp) {
    const ms = new Date(geval.klaarOp) - Date.now();
    if (ms > 0) {
      const uren = Math.floor(ms / 3600000);
      const min  = Math.ceil((ms % 3600000) / 60000);
      restTijdTekst = uren > 0 ? `${uren} uur en ${min} min` : `${min} min`;
    }
  }

  const backdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const portret  = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round" alt="${esc(config.naam)}">`
    : `<div class="gock-portret-fallback">${icon('search')}</div>`;

  el.innerHTML = `
    <div class="herberg-scene gock-scene" ${backdrop}>
      <div class="herberg-content">
        <div class="dienst-beurs-topbar">
          ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
          ${_helpBtn('gock')}
        </div>
        <div class="herberg-portrait-wrap">${portret}</div>
        <p class="herberg-groet">${esc(config.naam)} kijkt op van zijn bureau en trekt een wenkbrauw op.</p>
        <p class="ts-beurs">Vooruitbetaling: <strong>${prijsTekst(config.prijs)}</strong> · Resultaat binnen 24 uur</p>

        ${heeftKlaarZaak ? `
          <div class="gock-dossier">
            <div class="gock-dossier-head">${icon('folder-open')} Dossier: ${esc(geval.entityName)}</div>
            <p class="gock-dossier-tekst">${esc(geval.tekst)}</p>
            ${geval.isGeheim && geval.entityId
              ? `<button class="herberg-bubble-card-btn gock-kaartje-btn"
                  onclick="window._openDetail('${esc(geval.entityType)}','${esc(geval.entityId)}')"
                  title="Open kaartje">↗ Bekijk kaartje</button>`
              : ''}
            <button class="ts-wedden-btn" style="margin-top:10px" onclick="window._gockOpgehaald()">Dossier ontvangen</button>
          </div>` : ''}

        ${heeftLopendeZaak ? `
          <div class="gock-lopend">
            <p>${icon('search')} <strong>${esc(config.naam)}</strong> doet onderzoek naar <strong>${esc(geval.entityName)}</strong>.</p>
            ${restTijdTekst ? `<p class="ts-beurs">Geschatte doorlooptijd: nog ${restTijdTekst}</p>` : '<p class="ts-beurs">Het rapport is bijna klaar…</p>'}
          </div>` : ''}

        ${!heeftLopendeZaak && !heeftKlaarZaak ? (beschikbaar.length === 0
          ? `<p class="herberg-cooldown-tekst">Er zijn nog geen personen bekend.</p>`
          : `<div class="herberg-zoek-wrap">
              <p class="herberg-teller">Naar wie wil je onderzoek laten doen?</p>
              <input type="text" class="herberg-zoek-input" placeholder="Typ een naam…"
                oninput="window._gockFilter(this.value)"
                id="gock-zoek" autocomplete="off">
              <p class="herberg-zoek-hint" id="gock-hint">Begin met typen om te zoeken.</p>
              <div class="herberg-lijst" id="gock-lijst">
                ${beschikbaar.map(e => `
                  <button class="herberg-item" data-naam="${esc(e.name.toLowerCase())}"
                    style="display:none"
                    onclick="window._gockKies('${esc(e.id)}','${esc(e.type)}','${esc(e.name)}')">
                    <span class="herberg-item-naam">${esc(e.name)}</span>
                  </button>`).join('')}
              </div>
            </div>`) : ''}
      </div>
    </div>`;
}

window._gockFilter = (q) => {
  const lijst = document.getElementById('gock-lijst');
  const hint  = document.getElementById('gock-hint');
  if (!lijst) return;
  const s = q.trim().toLowerCase();
  if (!s) {
    lijst.querySelectorAll('.herberg-item').forEach(btn => { btn.style.display = 'none'; });
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';
  lijst.querySelectorAll('.herberg-item').forEach(btn => {
    btn.style.display = btn.dataset.naam.includes(s) ? '' : 'none';
  });
};

window._gockKies = async (entityId, entityType, entityName) => {
  if (!confirm(`Opdracht geven aan De Gock voor onderzoek naar "${entityName}"? Betaling vindt direct plaats.`)) return;
  try {
    await api.gockOpdracht({ entityId, entityType });
    await renderGock();
    _tsToast('Opdracht ingediend. Rapport volgt binnen 24 uur.');
  } catch (err) {
    _tsToast(err.message || 'Fout bij indienen opdracht.');
  }
};

window._gockOpgehaald = async () => {
  try { await api.gockOpgehaald(); } catch { /* ok */ }
  await renderGock();
};

window._magizooFilter = (q) => {
  const lijst = document.getElementById('magizoo-lijst');
  const hint  = document.getElementById('magizoo-hint');
  if (!lijst) return;
  const s = q.trim().toLowerCase();
  if (!s) {
    lijst.querySelectorAll('.magizoo-item').forEach(el => { el.style.display = 'none'; });
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';
  lijst.querySelectorAll('.magizoo-item').forEach(el => {
    el.style.display = el.dataset.naam.includes(s) ? '' : 'none';
  });
};

// ── De Magizoöloog ───────────────────────────────────────────────────────────
// Onderzoekt monsters die de party al kent (≥ naam). Per onderzoek één trede
// omhoog (naam→deels + roddel → volledig) of premium direct naar volledig.
let _magizooData = null;
let _magizooActiveTab = 'onderzoek';   // 'onderzoek' | 'adoptie' — onthouden over re-renders

// Wissel tussen de twee magizoo-diensten (monster-onderzoek vs. adoptie).
window._magizooTab = (name) => {
  _magizooActiveTab = name;
  document.querySelectorAll('#section-magizoo .dienst-subtab-panel')
    .forEach(p => p.classList.toggle('hidden', p.id !== 'magizoo-panel-' + name));
  document.querySelectorAll('#section-magizoo .dienst-subtab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === name));
};

function _magizooBeurs(cur) {
  return [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
}
function _magizooPrijs(p) {
  return [p?.fl && `${p.fl} fl`, p?.kn && `${p.kn} kn`, p?.cl && `${p.cl} cl`].filter(Boolean).join(' ') || 'gratis';
}
const _MAGIZOO_NIV_LABEL = { naam: 'Naam', deels: 'Deels', volledig: 'Volledig' };

async function renderMagizoo() {
  const el = document.getElementById('section-magizoo');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('magizoo')) { _dienstNietBereikbaar(el, meta.magizoo?.naam || 'De Magizoöloog'); return; }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';

  let data;
  try { data = await api.getMagizoo(); }
  catch (e) {
    el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)}</p></div></div>`;
    return;
  }
  _magizooData = data;
  const { config, monsters = [], adoptabel = [], metgezel = null, currency, cooldownTot } = data;

  const cooldownActief = cooldownTot && new Date(cooldownTot) > new Date();
  let cooldownTekst = '';
  if (cooldownActief) {
    const min = Math.ceil((new Date(cooldownTot) - Date.now()) / 60000);
    cooldownTekst = `De Magizoöloog werkt zijn aantekeningen nog bij — nog ± ${min} min.`;
  }

  const backdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const portret  = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round" alt="${esc(config.naam)}">`
    : `<div class="gock-portret-fallback">${icon('paw-print')}</div>`;

  const onderzoekbaar = monsters.filter(m => m.volgende || m.niveau !== 'volledig');

  el.innerHTML = `
    <div class="herberg-scene magizoo-scene" ${backdrop}>
      <div class="herberg-content">
        <div class="dienst-beurs-topbar">
          ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${_magizooBeurs(currency)}</strong></span>` : ''}
          ${_helpBtn('magizoo')}
        </div>
        <div class="herberg-portrait-wrap">${portret}</div>
        <p class="herberg-groet">${config.groet ? esc(config.groet) : `${esc(config.naam)} kijkt op van een kooi en veegt een inktvlek van zijn notitieboek.`}</p>
        <div class="dienst-subtab-nav">
          <button class="dienst-subtab-btn${_magizooActiveTab === 'onderzoek' ? ' active' : ''}" data-tab="onderzoek" onclick="window._magizooTab('onderzoek')">${icon('search')} Onderzoek</button>
          <button class="dienst-subtab-btn${_magizooActiveTab === 'adoptie' ? ' active' : ''}" data-tab="adoptie" onclick="window._magizooTab('adoptie')">${icon('paw-print')} Adoptie</button>
        </div>

        <div class="dienst-subtab-panel${_magizooActiveTab === 'onderzoek' ? '' : ' hidden'}" id="magizoo-panel-onderzoek">
          <p class="ts-beurs">Onderzoek: <strong>${_magizooPrijs(config.prijs)}</strong> per trede · Volledig ineens: <strong>${_magizooPrijs(config.prijsVolledig)}</strong></p>

          ${cooldownActief ? `<div class="gock-lopend"><p class="herberg-cooldown-tekst">${icon('paw-print')} ${cooldownTekst}</p></div>` : ''}

          <div id="magizoo-resultaat"></div>

          ${monsters.length === 0
            ? `<p class="herberg-cooldown-tekst">De party kent nog geen wezens om te laten onderzoeken. Kom terug nadat je iets bent tegengekomen.</p>`
            : `<div class="herberg-zoek-wrap">
                <p class="herberg-teller">Welk wezen wil je laten onderzoeken?</p>
                <input type="text" class="herberg-zoek-input" placeholder="Typ een naam…"
                  oninput="window._magizooFilter(this.value)"
                  id="magizoo-zoek" autocomplete="off">
                <p class="herberg-zoek-hint" id="magizoo-hint">Begin met typen om te zoeken.</p>
                <div class="herberg-lijst magizoo-lijst" id="magizoo-lijst">
                  ${monsters.map(m => `<div class="magizoo-item" data-naam="${esc(m.name.toLowerCase())}" style="display:none">${_magizooItemBody(m, cooldownActief)}</div>`).join('')}
                </div>
              </div>`}
        </div>

        <div class="dienst-subtab-panel${_magizooActiveTab === 'adoptie' ? '' : ' hidden'}" id="magizoo-panel-adoptie">
          <div class="magizoo-adopt-wrap">
            <p class="herberg-teller">${icon('paw-print')} Adopteer een metgezel</p>
            ${metgezel
              ? `<p class="herberg-zoek-hint">Jullie party heeft al een metgezel: <strong>${esc(metgezel.name)}</strong>. Eén huisdier per party.</p>`
              : adoptabel.length === 0
                ? `<p class="herberg-zoek-hint">De Magizoöloog heeft vandaag geen dieren ter adoptie.</p>`
                : `<div class="magizoo-adopt-lijst">${adoptabel.map(p => _magizooAdoptKaart(p)).join('')}</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

function _magizooItemBody(m, cooldownActief) {
  const klaar = m.niveau === 'volledig';
  const nivLabel = _MAGIZOO_NIV_LABEL[m.niveau] || '—';
  const volgendeLabel = m.volgende ? _MAGIZOO_NIV_LABEL[m.volgende] : null;
  const disabled = cooldownActief || klaar;
  return `
      <div class="magizoo-item-head">
        <span class="herberg-item-naam">${esc(m.name)}</span>
        <span class="magizoo-item-tier magizoo-tier--${m.niveau}">${nivLabel}</span>
        ${m.bron === 'magizoo' ? `<span class="magizoo-item-bron" title="Onderzocht door de Magizoöloog">${icon('paw-print')}</span>` : ''}
      </div>
      ${klaar
        ? `<p class="magizoo-item-klaar">Volledig onderzocht.</p>`
        : `<div class="magizoo-item-acties">
            <button class="ts-wedden-btn magizoo-btn" ${disabled ? 'disabled' : ''}
              onclick="window._magizooOnderzoek('${esc(m.id)}','stap')">
              Onderzoek → ${esc(volgendeLabel || '')}</button>
            ${m.niveau === 'naam'
              ? `<button class="ts-wedden-btn magizoo-btn magizoo-btn--premium" ${disabled ? 'disabled' : ''}
                  onclick="window._magizooOnderzoek('${esc(m.id)}','volledig')">
                  Volledig ineens</button>`
              : ''}
          </div>`}`;
}

function _magizooAdoptKaart(p) {
  const portret = p.imageId
    ? `<img src="${api.fileUrl(p.imageId)}" class="magizoo-adopt-portret" alt="${esc(p.name)}" onerror="this.style.display='none'">`
    : `<div class="magizoo-adopt-portret magizoo-adopt-portret--fallback">${icon('paw-print')}</div>`;
  return `<div class="magizoo-adopt-kaart">
      ${portret}
      <div class="magizoo-adopt-body">
        <div class="magizoo-adopt-naam">${esc(p.name)}</div>
        ${p.soortLabel ? `<div class="magizoo-adopt-soort">${esc(p.soortLabel)}</div>` : ''}
        ${p.samenvatting ? `<div class="magizoo-adopt-sam">${esc(p.samenvatting)}</div>` : ''}
        <label class="magizoo-adopt-naamveld">Naam je metgezel
          <input type="text" id="magizoo-naam-${esc(p.id)}" value="${esc(p.naamSuggestie || '')}" maxlength="40" placeholder="${esc(p.naamSuggestie || 'Naam…')}">
        </label>
        <div class="magizoo-adopt-foot">
          <span class="ts-beurs">${_magizooPrijs(p.prijs)}</span>
          <button class="ts-wedden-btn magizoo-btn" onclick="window._magizooAdopteer('${esc(p.id)}')">Adopteer</button>
        </div>
      </div>
    </div>`;
}

// ── Lootverdeler — spelerpaneel in de Boedel-subtab ──
function _playerLootPanelHtml(loot, charId) {
  if (!loot || !loot.actief || !charId || !(loot.deelnemers || []).includes(charId)) return '';
  const items = (loot.items || []).filter(it => it.status === 'open');
  const goudTotaal = (loot.goud?.fl || 0) + (loot.goud?.kn || 0) + (loot.goud?.cl || 0);
  return `<div class="player-loot-panel">
    <div class="player-loot-head">${icon('coins')} Loot beschikbaar!</div>
    ${items.length ? items.map(it => {
      const rk = _invRarityKey(it.rariteit);
      const others = it.claimCount - (it.ikClaim ? 1 : 0);
      const naamHtml = it.entityId
        ? `<span class="player-loot-link" onclick="window._openDetail('voorwerpen','${esc(it.entityId)}')" title="Bekijk kaartje">${esc(it.naam)} <span class="player-loot-link-ico">${icon('open-book')}</span></span>`
        : esc(it.naam);
      return `<div class="player-loot-item${rk ? ' loot-rar-' + rk : ''}">
        ${it.bron ? `<div class="player-loot-bron">${esc(it.bron)}</div>` : ''}
        <div class="player-loot-item-main">
          <span class="player-loot-diamond"${rk ? ` data-rarity="${rk}"` : ''}>◆</span>
          <div class="player-loot-item-body">
            <div class="player-loot-item-naam">${naamHtml}${it.rariteit ? ` <span class="player-loot-rar">(${esc(it.rariteit)})</span>` : ''}</div>
            ${it.beschrijving ? `<div class="player-loot-item-desc">${esc(it.beschrijving)}</div>` : ''}
            ${others > 0 ? `<div class="player-loot-claimcount">${others} ander${others > 1 ? 'e spelers claimen' : ' speler claimt'} dit ook</div>` : ''}
          </div>
        </div>
        <button class="player-loot-claim-btn${it.ikClaim ? ' is-claimed' : ''}" onclick="window._lootClaim('${esc(it.id)}')">${it.ikClaim ? icon('check') + ' Geclaimd' : 'Claim'}</button>
      </div>`;
    }).join('') : `<p class="player-loot-empty">Alle items zijn verdeeld.</p>`}
    ${goudTotaal ? `<div class="player-loot-goud">${icon('coins')} Goud: <strong>${_magizooPrijs(loot.goud)}</strong> <span class="player-loot-goud-note">(wordt bij afsluiting verdeeld)</span></div>` : ''}
  </div>`;
}

window._lootClaim = async (itemId) => {
  try { await api.lootClaim(itemId); } catch (e) { _tsToast(e.message || 'Claim mislukt.'); }
  window._renderPlayerLoot();
};

window._renderPlayerLoot = async () => {
  const slot = document.getElementById('player-loot-slot');
  if (!slot) return;
  let loot = null;
  try { loot = await api.getLoot(); } catch { /* ok */ }
  const charId = window._lastCharId || window.app?.state?.characterId;
  slot.innerHTML = _playerLootPanelHtml(loot, charId);
  const btn = document.querySelector('.player-subtab[data-tab="knapzak"]');
  if (btn) {
    const has = !!(loot?.actief && (loot.deelnemers || []).includes(charId) && (loot.items || []).some(i => i.status === 'open'));
    let badge = btn.querySelector('.player-loot-badge');
    if (has && !badge) { badge = document.createElement('span'); badge.className = 'player-loot-badge'; btn.appendChild(badge); }
    else if (!has && badge) badge.remove();
  }
};

window._magizooAdopteer = async (petId) => {
  const p = _magizooData?.adoptabel?.find(x => x.id === petId);
  const naam = (document.getElementById('magizoo-naam-' + petId)?.value || '').trim() || p?.naamSuggestie || p?.name || '';
  if (!confirm(`${naam || 'Dit dier'} adopteren voor ${_magizooPrijs(p?.prijs)}? De kosten worden direct van je beurs afgeschreven.`)) return;
  try {
    const res = await api.adopteerPet(petId, naam);
    _tsToast(`${res.naam} is nu jullie metgezel!`);
    await renderMagizoo();
  } catch (err) {
    _tsToast(err.message || 'Adoptie mislukt.');
  }
};

window._magizooOnderzoek = async (monsterId, modus) => {
  const m = _magizooData?.monsters?.find(x => x.id === monsterId);
  const premie = modus === 'volledig';
  const prijs = premie ? _magizooData?.config?.prijsVolledig : _magizooData?.config?.prijs;
  if (!confirm(`${premie ? 'Volledig onderzoek' : 'Onderzoek'} naar "${m?.name || 'dit wezen'}" voor ${_magizooPrijs(prijs)}? Betaling vindt direct plaats.`)) return;
  try {
    const res = await api.magizooOnderzoek({ monsterId, modus });
    // Resultaat-blok tonen
    const rb = document.getElementById('magizoo-resultaat');
    if (rb) {
      rb.innerHTML = `
        <div class="gock-dossier magizoo-dossier">
          <div class="gock-dossier-head">${icon('paw-print')} Veldnotitie — ${esc(res.naam)}</div>
          <p class="magizoo-dossier-tier">Kennisniveau nu: <strong>${_MAGIZOO_NIV_LABEL[res.niveau] || res.niveau}</strong>. Bekijk het volledige statblock in het Bestiarium.</p>
          ${res.roddel ? `<div class="magizoo-roddel">${icon('message-circle')} <em>${esc(res.roddel)}</em></div>` : ''}
        </div>`;
      rb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    _tsToast('Onderzoek voltooid.');
    // Lijst + beurs verversen (na korte tel zodat de toast zichtbaar is)
    await renderMagizoo();
    if (window.bestiarium?.refresh) window.bestiarium.refresh();
  } catch (err) {
    _tsToast(err.message || 'Onderzoek mislukt.');
  }
};

// ── Madame Ursula / Waarzegger ───────────────────────────────────────────────

// Zintuig-label → Lucide-icoon (emoji uit de API worden genegeerd)
const _URSULA_ICONS = { Zien: 'eye', Horen: 'zap', Ruiken: 'flask-conical', Proeven: 'potion', Voelen: 'heart' };

function _ursulaOnthuldHtml(onthuld, roll, doorNaam) {
  const rollLabel  = roll === 6 ? 'Volledig visioen!' : `Worp: ${roll}`;
  const doorLabel  = doorNaam ? ` — gevraagd door ${esc(doorNaam)}` : '';
  const zinHtml    = (onthuld?.zintuigen || []).map(z => `
    <div class="ursula-zintuig">
      <span class="ursula-zintuig-icon">${icon(_URSULA_ICONS[z.label] || 'sparkles')}</span>
      <span class="ursula-zintuig-label">${esc(z.label)}</span>
      <span class="ursula-zintuig-tekst">${esc(z.tekst)}</span>
    </div>`).join('');
  const conHtml    = onthuld?.concreet
    ? `<div class="ursula-concreet">${icon('star')} <em>${esc(onthuld.concreet)}</em></div>`
    : '';
  return `
    <div class="ursula-onthuld">
      <p class="ursula-roll-label">${rollLabel}${doorLabel}</p>
      ${zinHtml}${conHtml}
    </div>`;
}

async function renderUrsula() {
  const el = document.getElementById('section-ursula');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('ursula')) { _dienstNietBereikbaar(el, meta.ursula?.naam || 'Madame Ursula'); return; }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';

  let data;
  try { data = await api.getUrsula(); }
  catch (e) { el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)}</p></div></div>`; return; }

  const { config, beschikbaar, geenSessie, geenAkte, alGeworpen, roll, doorNaam, onthuld, currency } = data;
  const beursTekst = (cur) => [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
  const prijsTekst = (p) => [p?.fl && `${p.fl} fl`, p?.kn && `${p.kn} kn`, p?.cl && `${p.cl} cl`].filter(Boolean).join(' ') || 'gratis';

  const weg = geenSessie; // Ursula is er niet wanneer er geen sessie/akte loopt
  const backdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const portret = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round${weg ? ' herberg-portrait--weg' : ''}" alt="${esc(config.naam)}">`
    : `<div class="herberg-portrait-round herberg-portrait-fallback${weg ? ' herberg-portrait--weg' : ''}">${icon('sparkles')}</div>`;

  const groet = geenSessie
    ? `Op de deur hangt een briefje: <em>“${esc(config.naam)} is even een fles jenever halen.”</em>`
    : `${esc(config.naam)} legt haar handen op de kristallen bol.`;

  let body;
  if (geenSessie) {
    body = `<p class="herberg-cooldown-tekst">Er is nu niemand die de toekomst leest. Kom terug wanneer er een sessie loopt.</p>`;
  } else if (geenAkte) {
    body = `<p class="herberg-cooldown-tekst">${esc(config.naam)} schudt haar hoofd: voorbij dit punt is de toekomst nog ongeschreven.</p>`;
  } else if (!beschikbaar) {
    body = `<p class="herberg-cooldown-tekst">${esc(config.naam)} tuurt in haar bol… maar de nevelen tonen nu niets.</p>`;
  } else if (alGeworpen && onthuld) {
    body = _ursulaOnthuldHtml(onthuld, roll, doorNaam);
  } else {
    body = `
      <p class="ts-beurs">Een blik op wat komen gaat — één worp per akte, voor de hele groep.</p>
      <p class="ts-beurs">Offer: <strong>${prijsTekst(config.prijs)}</strong></p>
      <button class="ts-wedden-btn" style="margin-top:8px" onclick="window._ursulaVoorspel()">${icon('sparkles')} Werp de d6 — vraag de voorspelling</button>`;
  }

  el.innerHTML = `
    <div class="herberg-scene gock-scene" ${backdrop}>
      <div class="herberg-content">
        <div class="dienst-beurs-topbar">
          ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
          ${_helpBtn('ursula')}
        </div>
        <div class="herberg-portrait-wrap">${portret}</div>
        <p class="herberg-groet">${groet}</p>
        ${body}
      </div>
    </div>`;
}

// ── De Tempel ──────────────────────────────────────────────────────────────

let _tempelActiveGodId = null; // null = godlijst, string = temple interior

async function renderTempel() {
  const el = document.getElementById('section-tempel');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('tempel')) { _dienstNietBereikbaar(el, meta.tempel?.naam || 'De Tempel'); return; }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';

  let data, personages = [];
  try { data = await api.getTempel(); }
  catch (e) { el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)}</p></div></div>`; return; }
  try { personages = await api.listEntities('personages'); } catch {}

  // Bouw een naam → portret-URL mapping voor auto-matching van god-avatars
  const _godPortraitMap = {};
  for (const p of personages) {
    if (p.name) _godPortraitMap[p.name.trim().toLowerCase()] = api.fileUrl(p.id);
  }

  const { config, huidigeZegen, huidigeEed, currency } = data;
  const goden = config.goden || [];
  const beursTekst = (cur) =>
    [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
  const prijsTekst = (p) =>
    [p?.fl && `${p.fl} fl`, p?.kn && `${p.kn} kn`, p?.cl && `${p.cl} cl`].filter(Boolean).join(' ') || 'gratis';

  const activeGod = _tempelActiveGodId ? goden.find(g => g.id === _tempelActiveGodId) : null;

  if (activeGod) {
    // ── VIEW 2: Temple interior ────────────────────────────────────────────
    _renderTempelInterior(el, activeGod, config, huidigeEed, huidigeZegen, currency, beursTekst, prijsTekst, personages);
  } else {
    // ── VIEW 1: God list ──────────────────────────────────────────────────
    _renderTempelLijst(el, goden, config, huidigeEed, huidigeZegen, currency, beursTekst, prijsTekst, _godPortraitMap);
  }
}

function _renderTempelLijst(el, goden, config, huidigeEed, huidigeZegen, currency, beursTekst, prijsTekst, godPortraitMap = {}) {
  const statusBlokken = [];
  if (huidigeEed) {
    const isVloek = huidigeEed.status === 'vloek';
    statusBlokken.push(`<div class="tempel-status-chip${isVloek ? ' tempel-status-chip--vloek' : ' tempel-status-chip--eed'}">
      ${isVloek ? icon('skull') : icon('scroll-text')}
      ${isVloek ? 'Vloek' : 'Eed'}: <em>${esc(huidigeEed.godNaam || '')}</em>
    </div>`);
  }
  if (huidigeZegen) {
    statusBlokken.push(`<div class="tempel-status-chip tempel-status-chip--zegen">
      ${icon('sparkles')} Zegening: <em>${esc(huidigeZegen.godNaam || '')}</em>
      ${huidigeZegen.usesMax ? `· ${huidigeZegen.uses || 0}/${huidigeZegen.usesMax}` : ''}
    </div>`);
  }

  const backdrop = config.backdropId
    ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"`
    : '';

  el.innerHTML = `
    <div class="herberg-scene tempel-scene-list" ${backdrop}>
      <div class="herberg-content">
        <div class="tempel-list-topbar">
          ${statusBlokken.length ? `<div class="tempel-status-chips">${statusBlokken.join('')}</div>` : '<div></div>'}
          <div style="display:flex;align-items:center;gap:8px">
            ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
            ${_helpBtn('tempel')}
          </div>
        </div>
        ${goden.length === 0
          ? `<p class="herberg-cooldown-tekst">Er zijn nog geen goden bekend in deze tempel.</p>`
          : `<div class="tempel-goden-grid">
              ${goden.map(g => {
                const actiefEed = huidigeEed && huidigeEed.godId === g.id;
                // Portret: DM-geconfigureerde imageId → anders automatisch entity-match op naam
                const portraitUrl = g.imageId
                  ? api.fileUrl(g.imageId)
                  : godPortraitMap[(g.naam || '').trim().toLowerCase()];
                const avatar = portraitUrl
                  ? `<img src="${portraitUrl}" class="tempel-god-avatar" alt="${esc(g.naam)}" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\\'tempel-god-avatar-fallback\\'></div>')">`
                  : `<div class="tempel-god-avatar-fallback"></div>`;
                return `
                  <div class="tempel-god-kaart${actiefEed ? ' tempel-god--actief' : ''}"
                       onclick="window._tempelBinnenTreden('${esc(g.id)}')">
                    <div class="tempel-god-avatar-wrap">${avatar}</div>
                    <div class="tempel-god-naam">${esc(g.naam)}</div>
                    ${g.domein ? `<div class="tempel-god-domein">${esc(g.domein)}</div>` : ''}
                    ${actiefEed ? `<div class="tempel-god-eed-badge">${icon('scroll-text')} eed</div>` : ''}
                  </div>`;
              }).join('')}
            </div>`}
      </div>
    </div>`;
}

function _renderTempelInterior(el, g, config, huidigeEed, huidigeZegen, currency, beursTekst, prijsTekst, personages = []) {
  // Sla god + config op voor de cinema (voorkomt lange inline onclick-strings)
  window._tempelCinemaGod    = g;
  window._tempelCinemaConfig = config;
  const eedGebonden = !!huidigeEed;
  const isVloek     = huidigeEed?.status === 'vloek';
  const actiefEed   = huidigeEed && huidigeEed.godId === g.id;
  const eenmalig    = (g.eenmaligeZegens || []).filter(Boolean);

  const backdropFileId  = g.backdropId   || g.locatieEntityId  || null;
  const priestFileId    = g.priestImageId || g.priesterEntityId || null;
  const backdrop    = backdropFileId ? `style="background-image:url('${api.fileUrl(backdropFileId)}')"` : '';
  const priesterEntityId = g.priesterEntityId || null;
  const priesterNaam = priesterEntityId
    ? (personages.find(p => p.id === priesterEntityId)?.name || '')
    : '';
  const portretClick = priesterEntityId
    ? `onclick="window._openDetail('personages','${esc(priesterEntityId)}')" style="cursor:pointer" title="Bekijk kaartje"`
    : '';
  const portret     = priestFileId
    ? `<img src="${api.fileUrl(priestFileId)}" class="herberg-portrait-round" alt="Priester" onerror="this.style.display='none'" ${portretClick}>`
    : `<div class="herberg-portrait-round herberg-portrait-fallback" ${portretClick}>${icon('church')}</div>`;

  el.innerHTML = `
    <div class="herberg-scene gock-scene" ${backdrop}>
      <div class="herberg-content">
        <div class="tempel-interior-topbar">
          <button class="tempel-terug-btn" onclick="window._tempelTerugNaarLijst()">${icon('chevron-left')} Terug</button>
          <div style="display:flex;align-items:center;gap:8px">
            ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
            ${_helpBtn('tempel')}
          </div>
        </div>
        <div class="herberg-portrait-wrap">${portret}</div>
        ${priesterNaam ? `<p class="tempel-priester-naam">${esc(priesterNaam)}</p>` : ''}
        <p class="herberg-groet">${esc(g.priesterGreet || 'Welkom, pelgrim. Waarvoor bent u hier?')}</p>

        ${huidigeEed && isVloek ? `
          <div class="tempel-zegen-actief tempel-vloek-actief">
            ${icon('skull')} Vloek van <em>${esc(huidigeEed.godNaam || '')}</em>
            ${huidigeEed.entityId
              ? ` · <button class="tempel-zegen-link" onclick="window._openDetail('${esc(huidigeEed.entityType||'voorwerpen')}','${esc(huidigeEed.entityId)}')">${icon('scroll-text')} bekijk vloek</button>`
              : ''}
          </div>
          <button class="ts-wedden-btn" style="margin-bottom:8px" onclick="window._tempelBoete()">${icon('sparkles')} Doe boete (${esc(prijsTekst(config.boetePrijs))}) — hef de vloek op</button>
        ` : huidigeEed ? `
          <div class="tempel-zegen-actief">
            ${icon('scroll-text')} Eed aan <em>${esc(huidigeEed.godNaam || '')}</em> actief
            ${huidigeEed.entityId
              ? ` · <button class="tempel-zegen-link" onclick="window._openDetail('${esc(huidigeEed.entityType||'voorwerpen')}','${esc(huidigeEed.entityId)}')">${icon('scroll-text')} bekijk eed</button>`
              : ''}
          </div>` : ''}
        ${huidigeZegen ? `
          <div class="tempel-zegen-actief">
            ${icon('sparkles')} Zegening van <em>${esc(huidigeZegen.godNaam || '')}</em> actief
            ${huidigeZegen.entityId
              ? ` · <button class="tempel-zegen-link" onclick="window._openDetail('voorwerpen','${esc(huidigeZegen.entityId)}')">${icon('sparkles')} bekijk zegening</button>`
              : ''}
          </div>` : ''}

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${!eedGebonden ? `
          <button class="ts-wedden-btn" onclick="window._tempelEedCinema()">
            ${icon('scroll-text')} Eed afleggen · ${esc(prijsTekst(config.eedPrijs))}
          </button>` : ''}
          ${eenmalig.length ? `
          <button class="ts-wedden-btn" onclick="window._tempelKies('${esc(g.id)}','${esc(g.naam)}')">
            ${icon('dice')} Zegening (d${eenmalig.length}) · ${esc(prijsTekst((g.prijs && g.prijs.fl) ? g.prijs : config.prijs))}
          </button>` : ''}
        </div>
      </div>
    </div>`;
}

window._tempelBinnenTreden = (godId) => {
  _tempelActiveGodId = godId;
  renderTempel();
};

window._tempelTerugNaarLijst = () => {
  _tempelActiveGodId = null;
  renderTempel();
};

window._tempelKies = async (godId, godNaam) => {
  if (!confirm(`${godNaam}: een zegening (met dobbelworp) ontvangen? De betaling vindt direct plaats; het voorwerp komt in je knapzak.`)) return;
  try {
    const r = await api.tempelZegen({ godId });
    await renderTempel();
    _tsToast(`${icon('sparkles')} Zegening ${esc(r.item?.naam || r.item?.name || '')} ontvangen.`);
  } catch (err) {
    _tsToast(err.message || 'Het offer werd niet aanvaard.');
  }
};

window._tempelEedCinema = () => {
  const g      = window._tempelCinemaGod;
  const config = window._tempelCinemaConfig;
  if (!g) return;

  document.getElementById('tempel-eed-cinema')?.remove();

  const playerName = window.app?.state?.playerName || 'Pelgrim';
  const prijsTekst = (p) => [p?.fl && `${p.fl} fl`, p?.kn && `${p.kn} kn`, p?.cl && `${p.cl} cl`].filter(Boolean).join(' ') || 'gratis';

  const titel    = g.eedTitel || '';
  const eedTekst = g.eedTekst || `Ik, ${playerName}, zweer een eed aan ${g.naam}.\n\nZolang ik deze eed nakome, verleen ${g.naam} mij:\n${g.zegen || '—'}.\n\nVerzaak ik mijn eed, dan treft mij de toorn van ${g.naam}:\n${g.vloek || '—'}.\n\nDit is mijn belofte, nu en altijd.`;
  const fullText = (titel ? titel + '\n\n' : '') + eedTekst + `\n\nPrijs: ${prijsTekst(config.eedPrijs)}.`;

  const overlay = document.createElement('div');
  overlay.id = 'tempel-eed-cinema';
  overlay.innerHTML = `
    <div id="tempel-eed-text" class="tempel-eed-body"></div>
    <div id="tempel-eed-btns" class="tempel-eed-btns" style="display:none">
      <button id="tempel-eed-confirm" class="tempel-eed-btn tempel-eed-btn--bevestig">${icon('scroll-text')} Eed afleggen</button>
      <button id="tempel-eed-cancel" class="tempel-eed-btn tempel-eed-btn--annuleer">${icon('x')} Bedenk je</button>
    </div>`;
  document.body.appendChild(overlay);

  const textEl = document.getElementById('tempel-eed-text');
  const btnsEl = document.getElementById('tempel-eed-btns');
  let i = 0;
  const interval = setInterval(() => {
    if (i < fullText.length) {
      textEl.textContent = fullText.slice(0, ++i);
    } else {
      clearInterval(interval);
      btnsEl.style.display = 'flex';
    }
  }, 22);

  const close = () => { clearInterval(interval); overlay.remove(); };

  document.getElementById('tempel-eed-confirm').onclick = async () => {
    clearInterval(interval);
    btnsEl.style.display = 'none';
    // Fase 1: goudkleurige lichtflits
    overlay.classList.add('tempel-eed-flits');
    await new Promise(r => setTimeout(r, 600));
    // Fase 2: bezegelingstekst
    textEl.className = 'tempel-eed-bezegeld';
    textEl.innerHTML = `${icon('scroll-text')}<br><span>De eed is bezegeld.</span><br><em>${esc(g.naam)} heeft jouw belofte aanvaard.</em>`;
    overlay.classList.remove('tempel-eed-flits');
    // Fase 3: api-aanroep terwijl tekst zichtbaar is
    try { await api.tempelEed({ godId: g.id }); } catch (err) {
      textEl.innerHTML = `<span style="color:#e06060">${esc(err.message || 'De eed werd niet aanvaard.')}</span>`;
      await new Promise(r => setTimeout(r, 2500));
      overlay.remove();
      return;
    }
    // Fase 4: fade-out en sluit
    await new Promise(r => setTimeout(r, 2200));
    overlay.classList.add('tempel-eed-fadeout');
    await new Promise(r => setTimeout(r, 900));
    overlay.remove();
    await renderTempel();
  };
  document.getElementById('tempel-eed-cancel').onclick = close;

  const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
};

window._tempelVloekCinema = async (godNaam, vloekEffect) => {
  const overlay = document.createElement('div');
  overlay.id = 'tempel-vloek-cinema';
  overlay.innerHTML = `
    <div class="tempel-vloek-body">
      ${icon('skull')}
      <span>${esc(godNaam)} heeft je verlaten.</span>
      <em>${esc(vloekEffect)}</em>
      <small>Doe boete in de tempel om je van de vloek te bevrijden.</small>
    </div>`;
  document.body.appendChild(overlay);
  // Laat verschijnen
  requestAnimationFrame(() => overlay.classList.add('tempel-vloek--zichtbaar'));
  // Sluit na klik of 6 seconden
  const sluit = async () => {
    overlay.classList.add('tempel-vloek--weg');
    await new Promise(r => setTimeout(r, 700));
    overlay.remove();
  };
  overlay.addEventListener('click', sluit, { once: true });
  setTimeout(sluit, 6000);
};

window._tempelBoete = async () => {
  if (!confirm('Boete doen om je van de vloek te bevrijden? De betaling vindt direct plaats.')) return;
  try {
    await api.tempelBoete();
    await renderTempel();
    _tsToast(`${icon('sparkles')} Je hebt boete gedaan; de vloek is opgeheven.`);
  } catch (err) {
    _tsToast(err.message || 'Boete mislukt.');
  }
};

window._tempelVerbruik = async () => {
  try {
    await api.tempelVerbruik();
    await renderTempel();
    _tsToast('Gebruik afgevinkt.');
  } catch (err) {
    _tsToast(err.message || 'Afvinken mislukt.');
  }
};

// ── Madame Ursula / Waarzegger ───────────────────────────────────────────────

async function renderHeeren() {
  const el = document.getElementById('section-heeren');
  if (!el) return;
  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('heeren')) { _dienstNietBereikbaar(el, meta.heeren?.naam || 'De Heeren van de Nacht'); return; }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';
  let data;
  try { data = await api.getHeeren(); }
  catch (e) { el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)}</p></div></div>`; return; }

  const { config, rang, luimpoort, advocaat, jobs = [], boetes = [], currency } = data;
  const beursTekst = (cur) => [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
  const clTekst = (cl) => { const f = Math.floor(cl / 100), k = Math.floor((cl % 100) / 10), c = cl % 10; return [f && `${f} fl`, k && `${k} kn`, c && `${c} cl`].filter(Boolean).join(' ') || '0 cl'; };
  const honorariumTekst = beursTekst(config.honorarium);
  const typeIcon = { zakkenrollen: icon('stiletto'), inbraak: icon('lock-open'), oplichting: icon('eye') };

  const backdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const portret = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round" alt="${esc(config.naam)}">`
    : `<div class="gock-portret-fallback">${icon('moon')}</div>`;
  const kaartLink = (e) => (e && e.zichtbaar) ? `<button class="herberg-bubble-card-btn" style="margin-left:4px;font-size:.65rem;padding:1px 4px" onclick="window._openDetail('${esc(e.type)}','${esc(e.id)}')" title="Bekijk kaartje">↗</button>` : '';

  const boetesHtml = boetes.length ? `
    <div class="gock-dossier" style="border-color:rgba(150,40,40,0.6)">
      <div class="gock-dossier-head">${icon('landmark')} Openstaande boetes${luimpoort ? ' — ' + esc(luimpoort.naam) + kaartLink(luimpoort) : ''}</div>
      ${boetes.map(b => `
        <div style="border-top:1px solid rgba(196,168,122,0.2);padding:6px 0">
          <p class="gock-dossier-tekst">${esc(b.reden)} — <strong>${clTekst(b.bedragCl)}</strong></p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
            <button class="ts-wedden-btn" onclick="window._heerenBetaal('${esc(b.id)}','${esc(clTekst(b.bedragCl))}')">Betaal ${esc(clTekst(b.bedragCl))}</button>
            <button class="ts-wedden-btn" onclick="window._heerenAdvocaat('${esc(b.id)}')">${icon('landmark')} Huur ${advocaat ? esc(advocaat.naam) : 'Zilvertong en Zemelaar'} (${esc(honorariumTekst)})</button>
            ${advocaat ? kaartLink(advocaat) : ''}
          </div>
        </div>`).join('')}
    </div>` : '';

  const jobsHtml = jobs.length ? jobs.map(j => `
    <div class="tempel-god-kaart" style="border:1px solid rgba(196,168,122,0.3);border-radius:10px;padding:10px;margin-bottom:8px;text-align:left">
      <div style="margin-bottom:4px">
        <span class="herberg-item-naam">${typeIcon[j.type] || icon('moon')} ${esc(j.typeNaam)}</span>
        <span class="herberg-item-type" style="display:block;opacity:.8">${esc(j.omschrijving)} ${j.doelZichtbaar ? kaartLink({ type: j.doelType, id: j.doelId, zichtbaar: true }) : ''}</span>
      </div>
      <p class="ts-beurs" style="margin:2px 0">Buit: <strong>${j.payout} fl</strong></p>
      ${j.status === 'open'
        ? `<button class="ts-wedden-btn" onclick="window._heerenAanneem('${esc(j.id)}')">Neem aan</button>`
        : `<p class="ts-beurs" style="opacity:.8">Aangenomen door ${esc(j.doorNaam || 'iemand')} — de DM beslist de uitkomst.</p>`}
    </div>`).join('') : `<p class="herberg-cooldown-tekst">Er hangen nu geen klussen op het bord. Kom later terug.</p>`;

  el.innerHTML = `
    <div class="herberg-scene gock-scene" ${backdrop}>
      <div class="herberg-content">
        ${currency ? `<div class="dienst-beurs-topbar"><span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span></div>` : ''}
        <div class="herberg-portrait-wrap">${portret}</div>
        <p class="herberg-groet">${esc(config.naam)} — "Werk zat, als je vingers los zitten."</p>
        <p class="ts-beurs">Aanzien: <strong>${esc(rang.naam)}</strong> (${rang.index + 1}/${rang.aantal})</p>
        ${rang.voordelen ? `<p class="herberg-item-type" style="opacity:.85">Voordelen: ${esc(rang.voordelen)}</p>` : ''}
        ${rang.volgende ? `<p class="herberg-item-type" style="opacity:.5;font-size:.8em">Volgende — ${esc(rang.volgende.naam)}${rang.volgende.voordelen ? ': ' + esc(rang.volgende.voordelen) : ''}</p>` : ''}
        ${boetesHtml}
        <div class="herberg-lijst">${jobsHtml}</div>
      </div>
    </div>`;
}

window._heerenAanneem = async (id) => {
  if (!confirm("Deze klus aannemen? Speel 'm uit aan tafel; de DM bepaalt de uitkomst.")) return;
  try { await api.heerenAanneem(id); await renderHeeren(); _tsToast('🌑 Klus aangenomen.'); }
  catch (err) { _tsToast(err.message || 'Kon de klus niet aannemen.'); }
};

window._heerenBetaal = async (boeteId, label) => {
  if (!confirm(`Boete betalen (${label})?`)) return;
  try { await api.heerenBetaalBoete(boeteId); await renderHeeren(); _tsToast('⚖️ Boete voldaan.'); }
  catch (err) { _tsToast(err.message || 'Betalen mislukt.'); }
};

window._heerenAdvocaat = async (boeteId) => {
  if (!confirm('Zilvertong en Zemelaar inhuren? Het honorarium wordt direct betaald, ongeacht de uitkomst.')) return;
  try {
    const r = await api.heerenAdvocaat(boeteId);
    await renderHeeren();
    const uit = r.uitkomst === 'kwijtgescholden' ? 'de boete is kwijtgescholden!' : r.uitkomst === 'gehalveerd' ? 'de boete is gehalveerd.' : 'het mocht niet baten.';
    _tsToast(`⚖️ Pleidooi: ${r.totaal} (d20 ${r.worp}${r.bonus >= 0 ? '+' : ''}${r.bonus}) — ${uit}`);
  } catch (err) { _tsToast(err.message || 'Inhuren mislukt.'); }
};

// ── Tweespalt / Gokkantoor ──────────────────────────────────────────────────

let _tsActiveTab = 'wedden';   // 'wedden' | 'arena' — onthouden over re-renders

async function renderTweespalt() {
  const el = document.getElementById('section-tweespalt');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (window._dienstDicht('tweespalt')) {
    _dienstNietBereikbaar(el, 'De Tweespalt');
    return;
  }

  el.innerHTML = '<div class="herberg-scene"><div class="herberg-content"><p style="opacity:.5">Laden…</p></div></div>';

  let data;
  try { data = await api.getTweespalt(); }
  catch (e) {
    el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-err">${esc(e.message)} (${esc(e.constructor?.name || 'Error')})</p></div></div>`;
    return;
  }

  const { events = [], currency, lening, nameFirst = [], nameLast = [], config = {}, arena = [], arenaSignups = [], arenaVerslagen = [] } = data;
  const openEvents = events.filter(e => e.status === 'open');
  const afgerondEvents = events.filter(e => e.status === 'afgerond');

  function formatCl(cl) {
    const fl = Math.floor(cl / 100), kn = Math.floor((cl % 100) / 10), ce = cl % 10;
    return [fl && `${fl} fl`, kn && `${kn} kn`, ce && `${ce} cl`].filter(Boolean).join(' · ') || '0 cl';
  }
  function beursTekst(cur) {
    if (!cur) return '';
    const parts = [cur.fl && `${cur.fl} fl`, cur.kn && `${cur.kn} kn`, cur.cl && `${cur.cl} cl`].filter(Boolean);
    return parts.join(' · ') || '0 cl';
  }

  function npcBets(event) {
    if (!event.opties.length) return '';
    if (!nameFirst.length && !nameLast.length) return '';
    // Stable pseudo-random per event
    const seed = event.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    function prng(s) { const x = Math.sin(s + 1) * 10000; return x - Math.floor(x); }
    const count = 3 + Math.floor(prng(seed) * 3); // 3–5 gokkers
    const rows = [];
    for (let i = 0; i < count; i++) {
      const first = nameFirst.length ? nameFirst[Math.floor(prng(seed + i * 7)  * nameFirst.length)] : '';
      const last  = nameLast.length  ? nameLast[Math.floor(prng(seed + i * 13) * nameLast.length)]  : '';
      const naam  = [first, last].filter(Boolean).join(' ');
      const optie = event.opties[Math.floor(prng(seed + i * 3) * event.opties.length)];
      const bedrag = 1 + Math.floor(prng(seed + i * 17) * 200); // 1–200 fl
      rows.push(`<div class="ts-npc-row"><span class="ts-npc-naam">${esc(naam)}</span><span class="ts-npc-optie">→ ${esc(optie.naam)}</span><span class="ts-npc-bedrag">${bedrag} fl</span></div>`);
    }
    return `<div class="ts-npc-lijst"><div class="ts-npc-header">Laatste gokkers</div>${rows.join('')}</div>`;
  }

  function renderOptieKnop(event, opt) {
    const mijnInzet = event.mijnInzet;
    const heeftIngezet = !!mijnInzet;
    const isGekozen = mijnInzet?.optieId === opt.id;
    return `
      <div class="ts-optie${isGekozen ? ' ts-optie--gekozen' : ''}" data-optie-id="${esc(opt.id)}" data-event-id="${esc(event.id)}">
        <div class="ts-optie-top">
          <span class="ts-optie-naam">${esc(opt.naam)}</span>
          <span class="ts-optie-kans">${opt.kans}% kans</span>
          <span class="ts-optie-payout">× ${opt.payout + 1} bij winst</span>
        </div>
        ${isGekozen
          ? `<div class="ts-optie-ingezet">✓ Jouw inzet: ${formatCl(mijnInzet.bedragCl)}</div>`
          : heeftIngezet ? '' : `
          <div class="ts-inzet-form" id="ts-form-${esc(event.id)}-${esc(opt.id)}">
            <div class="ts-inzet-velden">
              <input type="text" inputmode="decimal" placeholder="bijv. 1,28" class="ts-inzet-input" id="ts-fl-input-${esc(event.id)}-${esc(opt.id)}" style="width:100px">
              <span class="ts-inzet-label">fl</span>
            </div>
            <button class="ts-wedden-btn" onclick="window._tsWedden('${esc(event.id)}','${esc(opt.id)}')">Inzetten</button>
          </div>`}
      </div>`;
  }

  function renderEvent(event) {
    const isAfgerond = event.status === 'afgerond';
    const winnaarOptie = isAfgerond ? event.opties.find(o => o.id === event.uitkomst) : null;
    const gewonnen = isAfgerond && event.mijnInzet?.optieId === event.uitkomst;
    const verloren = isAfgerond && event.mijnInzet && !gewonnen;
    const restTijd = event.sluitTijd ? Math.max(0, new Date(event.sluitTijd) - Date.now()) : null;
    const minRest = restTijd !== null ? Math.ceil(restTijd / 60000) : null;

    return `
      <div class="ts-event${isAfgerond ? ' ts-event--afgerond' : ''}">
        <div class="ts-event-head">
          <span class="ts-event-type">${event.type === 'godenwedden' ? `${icon('zap')} Godenwedden` : `${icon('crossed-swords',{cls:'icon-gi'})} Gevecht`}</span>
          <span class="ts-event-naam">${esc(event.naam)}</span>
          ${event.uitkomstModus === 'auto' && minRest !== null && !isAfgerond
            ? `<span class="ts-event-timer">${minRest < 60 ? `${minRest} min` : `${Math.ceil(minRest/60)} uur`}</span>`
            : ''}
        </div>
        ${isAfgerond
          ? `<div class="ts-uitslag${gewonnen ? ' ts-uitslag--gewonnen' : verloren ? ' ts-uitslag--verloren' : ''}">
              <span class="ts-uitslag-label">Uitslag:</span>
              <strong>${esc(winnaarOptie?.naam || '—')}</strong>
              ${gewonnen ? `<span class="ts-uitslag-winst">${icon('coins')} Gewonnen! +${formatCl(event.mijnInzet.bedragCl * winnaarOptie.payout)}</span>` : ''}
              ${verloren ? `<span class="ts-uitslag-verlies">Niet gewonnen</span>` : ''}
            </div>`
          : `<div class="ts-opties">${event.opties.map(o => renderOptieKnop(event, o)).join('')}</div>
             ${npcBets(event)}`}
      </div>`;
  }

  const leningBanner = lening
    ? `<div class="ts-lening-banner">
        ${icon('scroll-text')} Openstaande lening bij Taevin Woekeling — oorspronkelijk ${formatCl(lening.bedragCl)},
        huidig verschuldigd: <strong>${formatCl(lening.huidigVerschuldigdCl)}</strong>
        <span class="ts-lening-sub">(30% rente per dag)</span>
       </div>` : '';

  const tsBackdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const tsPortret  = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round" alt="${esc(config.naam || 'De Tweespalt')}">`
    : `<div class="ts-portrait-fallback">${icon('dice',{cls:'icon-gi'})}</div>`;

  el.innerHTML = `
    <div class="herberg-scene tweespalt-scene" ${tsBackdrop}>
      <div class="herberg-content ts-content">
        <div class="dienst-beurs-topbar">
          ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
          ${_helpBtn('tweespalt')}
        </div>
        <div class="herberg-portrait-wrap">${tsPortret}</div>
        <div>
          <p class="herberg-groet">Welkom bij ${esc(config.naam || 'De Tweespalt')}. Korporaal Standhall knikt je toe.</p>
        </div>

        ${leningBanner}

        ${(() => {
          const weddenPaneel = `
            ${openEvents.length
              ? `<div class="ts-sectie-label">Openstaande weddenschappen</div>${openEvents.map(renderEvent).join('')}`
              : `<p class="herberg-leeg">Er zijn momenteel geen openstaande weddenschappen.</p>`}
            ${afgerondEvents.length
              ? `<div class="ts-sectie-label ts-sectie-label--afgerond">Afgeronde events</div>${afgerondEvents.map(renderEvent).join('')}`
              : ''}`;

          const arenaPaneel = `
            ${arenaSignups.length ? `
              <div class="ts-arena-status">
                ${arenaSignups.map(s => `<div class="ts-arena-ingeschreven">${icon('swords',{cls:'icon-gi'})} Je staat ingeschreven voor <strong>${esc(s.boutNaam)}</strong>${s.tegenstander ? ` tegen ${esc(s.tegenstander)}` : ''}. De kamprechter roept je zo.${s.prijs ? ` Prijzengeld: ${esc(s.prijs)}.` : ''}</div>`).join('')}
              </div>` : ''}
            ${arena.length === 0
              ? `<p class="herberg-leeg">Er staan nu geen partijen op het programma.</p>`
              : arena.map(b => _arenaBoutKaart(b, arenaSignups, arenaVerslagen)).join('')}`;

          const heeftArena = arena.length > 0 || arenaSignups.length > 0;
          if (!heeftArena) return weddenPaneel;
          return `
            <div class="dienst-subtab-nav">
              <button class="dienst-subtab-btn${_tsActiveTab === 'wedden' ? ' active' : ''}" data-tab="wedden" onclick="window._tsTab('wedden')">${icon('coins')} Weddenschappen</button>
              <button class="dienst-subtab-btn${_tsActiveTab === 'arena' ? ' active' : ''}" data-tab="arena" onclick="window._tsTab('arena')">${icon('crossed-swords',{cls:'icon-gi'})} Strijdperk</button>
            </div>
            <div class="dienst-subtab-panel${_tsActiveTab === 'wedden' ? '' : ' hidden'}" id="tweespalt-panel-wedden">${weddenPaneel}</div>
            <div class="dienst-subtab-panel${_tsActiveTab === 'arena' ? '' : ' hidden'}" id="tweespalt-panel-arena">${arenaPaneel}</div>`;
        })()}
      </div>
    </div>`;
}

// Eén arenapartij-kaartje
function _arenaBoutKaart(b, signups, verslagenIds) {
  const ingeschreven = (signups || []).some(s => s.boutId === b.id);
  const verslagen = (verslagenIds || []).includes(b.id);
  const legend = !!b.verborgen && !verslagen;
  return `
    <div class="ts-arena-kaart${verslagen ? ' is-verslagen' : ''}${legend ? ' is-legendarisch' : ''}">
      <div class="ts-arena-kaart-head">
        <span class="ts-arena-kaart-naam">${esc(b.naam || 'Arenapartij')}</span>
        ${b.tegenstander ? `<span class="ts-arena-kaart-tegen">tegen ${esc(b.tegenstander)}</span>` : ''}
        ${verslagen ? `<span class="ts-arena-verslagen-badge">${icon('skull')} Verslagen</span>`
          : legend ? `<span class="ts-arena-legend-badge">${icon('star')} Ontgrendeld</span>` : ''}
      </div>
      ${b.beschrijving ? `<p class="ts-arena-kaart-desc">${esc(b.beschrijving)}</p>` : ''}
      <div class="ts-arena-kaart-foot">
        <span class="ts-arena-kaart-prijs">${b.inzet ? `Inleg ${esc(b.inzet)} · ` : ''}Prijs: <strong>${esc(b.prijs || '—')}</strong></span>
        ${verslagen
          ? `<button class="ts-wedden-btn" disabled style="opacity:.5">Al verslagen</button>`
          : ingeschreven
            ? `<button class="ts-wedden-btn" disabled style="opacity:.55">Ingeschreven</button>`
            : `<button class="ts-wedden-btn" onclick="window._arenaAanmeld('${esc(b.id)}')">Betreed het strijdperk</button>`}
      </div>
    </div>`;
}

window._tsTab = (name) => {
  _tsActiveTab = name;
  document.querySelectorAll('#section-tweespalt .dienst-subtab-panel')
    .forEach(p => p.classList.toggle('hidden', p.id !== 'tweespalt-panel-' + name));
  document.querySelectorAll('#section-tweespalt .dienst-subtab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === name));
};

window._arenaAanmeld = async (boutId) => {
  if (!confirm('Je meldt je aan voor deze arenapartij. De kamprechter roept je wanneer het zover is — een eventuele inleg wordt nu van je beurs afgeschreven. Doorgaan?')) return;
  try {
    await api.post(`/tweespalt/arena/${boutId}/aanmeld`, {});
    _tsToast('Je bent ingeschreven voor het strijdperk!');
    window.app?.refreshSection?.('tweespalt');
  } catch (err) { _tsToast(err.message || 'Aanmelden mislukt'); }
};

// Parseert een bedrag met komma: "1,28" of "1.28" → { fl:1, kn:2, cl:8, bedragCl:128 }
function _tsParseInzet(raw) {
  const s = (raw || '').trim().replace(',', '.');
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const fl = parseInt(m[1]) || 0;
  const decs = (m[2] || '').padEnd(2, '0');
  const kn = parseInt(decs[0]) || 0;
  const cl = parseInt(decs[1]) || 0;
  return { fl, kn, cl, bedragCl: fl * 100 + kn * 10 + cl };
}

window._tsWedden = async (eventId, optieId) => {
  const inputEl = document.getElementById(`ts-fl-input-${eventId}-${optieId}`);
  const parsed = _tsParseInzet(inputEl?.value);

  if (!parsed) { _tsToast('Vul een geldig bedrag in (bijv. 1,28).'); return; }
  if (parsed.bedragCl === 0) { _tsToast('Vul een inzet in.'); return; }

  const { fl, kn, cl, bedragCl } = parsed;

  let currency;
  try {
    const res = await api.getTweespalt();
    currency = res.currency;
  } catch { currency = null; }

  const heeftCl = currency ? (currency.fl * 100 + currency.kn * 10 + currency.cl) : Infinity;

  if (bedragCl > heeftCl) {
    const tekortCl = bedragCl - heeftCl;
    if (tekortCl > 10000) { // meer dan 100 fl tekort — Taevin leent niet zoveel
      _tsToast('Onvoldoende saldo. Taevin leent maximaal 100 fl.');
      return;
    }
    _tsTaevinPrompt(eventId, optieId, tekortCl);
    return;
  }

  try {
    await api.weddenTweespalt(eventId, { optieId, bedrag: { fl, kn, cl } });
    await renderTweespalt();
    _tsToast('✓ Inzet geplaatst.');
  } catch (err) {
    _tsToast(err.message || 'Fout bij inzetten.');
  }
};

function _tsTaevinPrompt(eventId, optieId, tekortCl) {
  const fl = Math.floor(tekortCl / 100), kn = Math.ceil((tekortCl % 100) / 10);
  const leenBedrag = { fl, kn: kn + 1, cl: 0 };
  const leenCl = leenBedrag.fl * 100 + leenBedrag.kn * 10;
  const leenTekst = [leenBedrag.fl && `${leenBedrag.fl} fl`, leenBedrag.kn && `${leenBedrag.kn} kn`].filter(Boolean).join(' en ');

  const taevinPortret = api.fileUrl('e_1773523435098_p3vxjp');

  const bubble = document.createElement('div');
  bubble.className = 'ts-taevin-bubble';
  bubble.innerHTML = `
    <div class="ts-taevin-hoofd">
      <img src="${taevinPortret}" class="ts-taevin-portret" alt="Taevin Woekeling">
      <div class="ts-taevin-bericht">
        <p class="ts-taevin-tekst">
          <em>Psst… beetje krap bij kas, vriend? Lenen kan altijd, uiteraard tegen een heel vriendschappelijk prijsje.</em>
        </p>
        <p class="ts-taevin-sub">Taevin kan je <strong>${leenTekst}</strong> lenen — 30% rente per dag.</p>
      </div>
    </div>
    <div class="ts-taevin-knoppen">
      <button class="ts-btn ts-btn--gevaar" id="ts-leen-ja">Akkoord, leen me het geld</button>
      <button class="ts-btn ts-btn--ghost" id="ts-leen-nee">Laat maar zitten</button>
    </div>`;

  const form = document.getElementById(`ts-form-${eventId}-${optieId}`);
  if (form) form.after(bubble);

  document.getElementById('ts-leen-nee')?.addEventListener('click', () => bubble.remove());
  document.getElementById('ts-leen-ja')?.addEventListener('click', async () => {
    try {
      await api.leenTweespalt(leenBedrag);
      bubble.remove();
      const inputEl2 = document.getElementById(`ts-fl-input-${eventId}-${optieId}`);
      const parsed2 = _tsParseInzet(inputEl2?.value) || { fl: 0, kn: 0, cl: 0 };
      await api.weddenTweespalt(eventId, { optieId, bedrag: { fl: parsed2.fl, kn: parsed2.kn, cl: parsed2.cl } });
      await renderTweespalt();
      _tsToast('📜 Geleend van Taevin. Schuldbewijs in je knapzak.');
    } catch (err) {
      _tsToast(err.message || 'Fout.');
    }
  });
}

// ── Facties & Aanzien (speler-sectie) ──────────────────────────────────────

const _FACTIE_ICON_SET_APP = new Set(['landmark','tree-pine','hexagon','crossed-swords','shield','moon','star','castle','heart','users','globe','mountain','scroll-text','coins','sword','swords','zap']);

let _factieActiveId   = null;
let _factieData       = null;  // gecachete API-response
let _factieMissieData = null;
let _grisburghLocId   = undefined;  // id van het 'Grisburgh'-locatiekaartje (backdrop facties-lijst); undefined = nog niet opgezocht

async function renderFacties() {
  const el = document.getElementById('section-facties');
  if (!el) return;

  let data;
  try { data = await api.getFacties(); }
  catch {
    el.innerHTML = `<div class="herberg-scene"><div class="herberg-content"><p class="herberg-groet">Facties konden niet geladen worden.</p></div></div>`;
    return;
  }
  // Haal quests op; factie-missies zijn quests met een factieId
  let allQuests = [];
  try { allQuests = await api.listQuests(); } catch {}
  const missies = allQuests.filter(q => q.factieId);
  _factieData       = data;
  _factieMissieData = { missies };

  if (_factieActiveId) {
    const actief = data.facties?.find(f => f.id === _factieActiveId);
    if (actief) { _renderFactieInterieur(el, actief, missies); return; }
    _factieActiveId = null;
  }

  const { facties } = data;
  const zichtbaar = window.app.isDM() ? facties : facties.filter(f => f.zichtbaar);

  // Backdrop: afbeelding van het Grisburgh-locatiekaartje (uniform met de andere
  // diensten die een sfeer-backdrop hebben). Eénmalig opzoeken op naam + cachen.
  if (_grisburghLocId === undefined) {
    try {
      const locs = await api.listEntities('locaties');
      _grisburghLocId = locs.find(l => (l.name || '').trim().toLowerCase() === 'grisburgh')?.id || null;
    } catch { _grisburghLocId = null; }
  }
  const _factieBackdrop = _grisburghLocId ? `style="background-image:url('${api.fileUrl(_grisburghLocId)}')"` : '';

  if (!zichtbaar.length) {
    el.innerHTML = `<div class="herberg-scene gock-scene facties-lijst-scene facties-lijst-scene--leeg" ${_factieBackdrop}><div class="herberg-content" style="text-align:center"><p class="herberg-groet" style="margin:0">${icon('landmark')} Nog geen facties onthuld.</p></div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="herberg-scene gock-scene facties-lijst-scene" ${_factieBackdrop}>
      <div class="factie-sectie">
        <div style="display:flex;justify-content:flex-end;margin-bottom:4px">${_helpBtn('facties')}</div>
        <div class="factie-grid">
          ${zichtbaar.map(f => _renderFactieKaart(f)).join('')}
        </div>
      </div>
    </div>`;
}

function _renderFactieInterieur(el, f, missies) {
  const backdrop = f.locatieEntityId ? `style="background-image:url('${api.fileUrl(f.locatieEntityId)}')"` : '';
  const stijl    = (f.stijl || '').replace(/[^a-z]/gi,'').toLowerCase();

  // Dag/nacht NPC: npcEntityIdDag = 06:00–18:00, npcEntityId = 18:00–06:00
  const _uur    = new Date().getHours();
  const _isNacht = _uur < 6 || _uur >= 18;
  const actieveNpcId = (f.npcEntityIdDag && !_isNacht) ? f.npcEntityIdDag : (f.npcEntityId || null);
  const portretUrl   = actieveNpcId ? api.fileUrl(actieveNpcId) : null;
  const npcNaam      = f._npcNaam || '';

  const portret = portretUrl
    ? `<img src="${portretUrl}" class="herberg-portrait-round factie-portret-klikbaar" alt="${esc(f.naam)}"
         onclick="window._openDetail('personages','${esc(actieveNpcId)}')"
         title="Bekijk kaartje" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="herberg-portrait-round herberg-portrait-fallback" style="display:none">${icon('users')}</div>`
    : `<div class="herberg-portrait-round herberg-portrait-fallback">${icon('users')}</div>`;

  const ladder = f.ladder || [];
  const verworven = ladder.filter(r => r.bereikt && r.index > 0).flatMap(r => r.boons || []);
  const isMax = !f.drempelVolgende;
  const pct = isMax ? 100 : Math.min(100, Math.round(((f.renown || 0) / f.drempelVolgende) * 100));
  const nextRang = ladder.find(r => !r.bereikt);

  const beursTekst = (cur) => [cur?.fl && `${cur.fl} fl`, cur?.kn && `${cur.kn} kn`, cur?.cl && `${cur.cl} cl`].filter(Boolean).join(' · ') || '0 cl';
  const currency = window._lastCurrency;   // gevuld bij renderen spelerstabblad

  // Quest-statussen: 'actief' = beschikbaar voor spelers, 'aangevraagd' = wacht op DM, 'in-uitvoering' = actief
  const beschikbaar = missies.filter(m => m.factieId === f.id && m.status === 'actief');
  const aangevraagd = missies.filter(m => m.factieId === f.id && m.status === 'aangevraagd');
  const actief      = missies.filter(m => m.factieId === f.id && m.status === 'in-uitvoering');
  // Party kan max. 1 actieve missie per factie hebben
  const heeftActief = aangevraagd.length > 0 || actief.length > 0;

  const _missieHtml = (m, type) => {
    const renownPill = m.renownBeloning ? `<span class="factie-missie-renown">+${m.renownBeloning} renown</span>` : '';
    const _valutaCl  = (v) => ((v?.fl||0)*100) + ((v?.kn||0)*10) + (v?.cl||0);
    const valutaPill = m.valuta && _valutaCl(m.valuta) > 0 ? `<span class="factie-missie-valuta">${beursTekst(m.valuta)}</span>` : '';
    const actieHtml  = type === 'beschikbaar'
      ? heeftActief
        ? `<span class="factie-missie-status-chip" title="Rond eerst de actieve missie af">${icon('lock')} Al een missie actief</span>`
        : `<button class="ts-wedden-btn factie-missie-btn" onclick="window._factieAccepteer('${esc(m.id)}','${esc(m.title||m.titel||'')}')">${icon('check')} Accepteer</button>`
      : type === 'aangevraagd'
        ? `<span class="factie-missie-status-chip">${icon('clock')} Wacht op DM-goedkeuring</span>`
        : `<span class="factie-missie-status-chip factie-missie-status-chip--actief">${icon('swords')} Actief</span>`;
    return `<div class="factie-missie${stijl ? ' factie-missie--' + stijl : ''}">
      <div class="factie-missie-header">
        <span class="factie-missie-titel">${esc(m.title || m.titel || '')}</span>
        <div class="factie-missie-pills">${renownPill}${valutaPill}</div>
      </div>
      ${(m.description||m.tekst) ? `<p class="factie-missie-tekst">${esc(m.description||m.tekst)}</p>` : ''}
      ${actieHtml}
    </div>`;
  };

  // ── Leden: portret + naam + rol, gegroepeerd per rang (volgorde van toevoegen) ──
  const _ledenHtml = (() => {
    const leden = f.leden || [];
    if (!leden.length) return '';
    const groepen = [];
    const idxVan = {};
    for (const l of leden) {
      const key = (l.rang || '').trim() || '__leden__';
      if (idxVan[key] === undefined) { idxVan[key] = groepen.length; groepen.push({ rang: key, leden: [] }); }
      groepen[idxVan[key]].leden.push(l);
    }
    // Groep zonder rang-label altijd onderaan.
    groepen.sort((a, b) => (a.rang === '__leden__' ? 1 : 0) - (b.rang === '__leden__' ? 1 : 0));
    const _lid = (l, isHoofd) => `
      <button class="factie-lid${isHoofd ? ' factie-lid--hoofd' : ''}" onclick="window._openDetail('personages','${esc(l.entityId)}')" title="Bekijk ${esc(l.naam)}">
        <span class="factie-lid-portret-wrap">
          <img class="factie-lid-portret" src="${api.fileUrl(l.entityId)}" alt=""
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="factie-lid-portret factie-lid-portret--fallback" style="display:none">${icon('user')}</span>
          ${isHoofd ? `<span class="factie-lid-kroon" title="Leiding">${icon('star')}</span>` : ''}
        </span>
        <span class="factie-lid-naam">${esc(l.naam)}</span>
        ${l.rol ? `<span class="factie-lid-rol">${esc(l.rol)}</span>` : ''}
      </button>`;
    const meerdereGroepen = groepen.length > 1 || groepen[0].rang !== '__leden__';
    // De bovenste, benoemde rang-groep krijgt een leider-accent (alleen bij een echte hiërarchie).
    return `
      <details class="factie-leden-sectie factie-leden-details">
        <summary class="factie-missies-label factie-leden-summary">${icon('users')} Leden <span class="factie-leden-aantal">${leden.length}</span>${icon('chevron-right', { cls: 'factie-leden-chev' })}</summary>
        ${groepen.map((g, gi) => {
          const isHoofdGroep = meerdereGroepen && gi === 0 && g.rang !== '__leden__';
          return `
          <div class="factie-leden-groep${isHoofdGroep ? ' factie-leden-groep--hoofd' : ''}">
            ${meerdereGroepen ? `<div class="factie-leden-rang-kop">${g.rang === '__leden__' ? 'Leden' : esc(g.rang)}</div>` : ''}
            <div class="factie-leden-grid">${g.leden.map(l => _lid(l, isHoofdGroep)).join('')}</div>
          </div>`;
        }).join('')}
      </details>`;
  })();

  el.innerHTML = `
    <div class="herberg-scene gock-scene factie-interieur-scene${stijl ? ' factie-scene--' + stijl : ''}" ${backdrop}>
      <div class="herberg-content">
        <div class="tempel-interior-topbar">
          <button class="tempel-terug-btn" onclick="window._factieTerugNaarLijst()">${icon('chevron-left')} Terug</button>
          <div style="display:flex;align-items:center;gap:8px">
            ${currency ? `<span class="ts-beurs tempel-beurs-top">Beurs: <strong>${beursTekst(currency)}</strong></span>` : ''}
            ${_helpBtn('facties')}
          </div>
        </div>
        <div class="herberg-portrait-wrap">${portret}</div>
        ${npcNaam ? `<p class="tempel-priester-naam">${esc(npcNaam)}</p>` : ''}
        <p class="herberg-groet">${esc(f.npcGreet || `Welkom bij ${f.naam}.`)}</p>

        <div class="factie-interieur-rang">
          <span class="factie-rang-chip${stijl ? ' factie-rang-chip--' + stijl : ''}">${icon(f.embleem || 'landmark')} ${esc(f.rang?.naam || 'Buitenstaander')}</span>
          <div class="factie-progress-wrap factie-progress-wrap--interieur">
            <div class="factie-progress-bar" style="width:${pct}%"></div>
          </div>
          <span class="factie-progress-label">${isMax ? 'Max aanzien bereikt' : `${f.renown || 0} / ${f.drempelVolgende} renown`}${nextRang ? ` — volgende: <strong>${esc(nextRang.naam)}</strong>` : ''}</span>
        </div>

        ${verworven.length ? `
        <div class="factie-boons factie-boons--interieur">
          ${verworven.map(b => b.entityId
            ? `<button class="factie-boon-chip factie-boon-chip--link" onclick="window._openDetail('${esc(b.entityType||'voorwerpen')}','${esc(b.entityId)}')">${esc(b.naam)} ${icon('open-book')}</button>`
            : `<span class="factie-boon-chip">${esc(b.naam)}</span>`
          ).join('')}
        </div>` : ''}

        ${beschikbaar.length || actief.length || aangevraagd.length ? `
        <div class="factie-missies-sectie">
          <div class="factie-missies-label">${icon('scroll-text')} Missies</div>
          ${[...beschikbaar.map(m => _missieHtml(m,'beschikbaar')),
             ...aangevraagd.map(m => _missieHtml(m,'aangevraagd')),
             ...actief.map(m => _missieHtml(m,'actief'))].join('')}
        </div>` : ''}

        ${_ledenHtml}
      </div>
    </div>`;

  // NPC-naam asynchroon ophalen als nog niet bekend
  if (actieveNpcId && !npcNaam) {
    api.listEntities('personages').then(list => {
      const npc = list.find(p => p.id === actieveNpcId);
      if (npc) {
        const nameEl = el.querySelector('.tempel-priester-naam');
        if (nameEl) nameEl.textContent = npc.name;
        else {
          const groet = el.querySelector('.herberg-groet');
          if (groet) groet.insertAdjacentHTML('beforebegin', `<p class="tempel-priester-naam">${esc(npc.name)}</p>`);
        }
      }
    }).catch(() => {});
  }
}

window._factieOpen = (id) => {
  _factieActiveId = id; renderFacties();
  // Per-factie sfeerloop: schakel naar de loop van deze factie.
  const naam = (window.app?.state?.meta?.facties || []).find(f => f.id === id)?.naam || 'Factie';
  window.soundManager?.setServiceAmbiance?.('factie:' + id, naam);
};
window._factieTerugNaarLijst = () => {
  _factieActiveId = null; renderFacties();
  window.soundManager?.setServiceAmbiance?.(null); // terug naar lijst = geen factie-loop
};

window._factieAccepteer = async (id, titel) => {
  if (!confirm(`Missie "${titel}" aanvragen? De DM moet dit goedkeuren.`)) return;
  try {
    await api.missieAccepteer(id);
    _tsToast(`${icon('scroll-text')} Aanvraag ingediend — wacht op DM-goedkeuring.`);
    await renderFacties();
  } catch (err) {
    _tsToast(err.message || 'Aanvraag mislukt.');
  }
};

function _renderFactieKaart(f) {
  const embIcon = _FACTIE_ICON_SET_APP.has(f.embleem) ? icon(f.embleem) : icon('landmark');
  const stijl = (f.stijl || '').replace(/[^a-z]/gi, '').toLowerCase();
  const isMax = !f.drempelVolgende;
  const pct = isMax ? 100 : Math.min(100, Math.round(((f.renown || 0) / f.drempelVolgende) * 100));
  const ladder = f.ladder || [];
  const verworven = ladder.filter(r => r.bereikt && r.index > 0).flatMap(r => r.boons || []);
  const nextRang = ladder.find(r => !r.bereikt);
  const rangIdx = f.rang?.index ?? 0;

  return `
  <div class="factie-kaart${stijl ? ' factie-kaart--' + stijl : ''}" onclick="window._factieOpen('${esc(f.id)}')" style="cursor:pointer">
    <div class="factie-kaart-header">
      <span class="factie-kaart-embleem">${embIcon}</span>
      <div class="factie-kaart-titels">
        <span class="factie-kaart-naam">${esc(f.naam)}</span>
        <span class="factie-kaart-rang">${esc(f.rang?.naam || 'Buitenstaander')}</span>
      </div>
      ${f.entityId ? `<button class="factie-kaart-link" onclick="event.stopPropagation();window._openDetail('organisaties','${esc(f.entityId)}')" title="Bekijk organisatiekaartje">${icon('open-book')}</button>` : ''}
    </div>
    ${rangIdx > 0 ? `
    <div class="factie-kaart-body">
      ${f.rang?.voordelen ? `<p class="factie-voordelen">${esc(f.rang.voordelen)}</p>` : ''}
      <div class="factie-progress-wrap">
        <div class="factie-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="factie-progress-label">
        ${isMax ? 'Max aanzien bereikt' : `${f.renown || 0} / ${f.drempelVolgende} renown`}${nextRang ? ` — volgende: <strong>${esc(nextRang.naam)}</strong>` : ''}
      </div>
      ${verworven.length ? `
      <div class="factie-boons">
        ${verworven.map(b => b.entityId
          ? `<button class="factie-boon-chip factie-boon-chip--link" onclick="window._openDetail('${esc(b.entityType||'voorwerpen')}','${esc(b.entityId)}')" title="${esc(b.tekst || 'Bekijk kaartje')}">${esc(b.naam)} ${icon('open-book')}</button>`
          : `<span class="factie-boon-chip" title="${esc(b.tekst || '')}">${esc(b.naam)}</span>`
        ).join('')}
      </div>` : ''}
    </div>` : `
    <div class="factie-kaart-body">
      <p class="factie-kaart-onbekend">Je kent deze factie, maar hebt nog geen aanzien opgebouwd.</p>
      ${nextRang ? `<p class="factie-progress-label">Eerste rang: <strong>${esc(nextRang.naam)}</strong> (${f.drempelVolgende ?? 1} renown)</p>` : ''}
    </div>`}
  </div>`;
}

function showMissieAanvraagToast({ missieId, titel, door, factieId }) {
  // DM-specifieke toast met goedkeur/weiger-knoppen
  const existing = document.getElementById('missie-aanvraag-toast-' + missieId);
  if (existing) return;
  const t = document.createElement('div');
  t.id = 'missie-aanvraag-toast-' + missieId;
  t.className = 'map-toast missie-aanvraag-toast';
  t.innerHTML = `
    <div style="margin-bottom:6px">${icon('scroll-text')} <strong>${esc(door)}</strong> vraagt missie aan:<br><em>${esc(titel)}</em></div>
    <div style="display:flex;gap:8px">
      <button class="ts-wedden-btn" style="padding:3px 10px;font-size:0.8rem" onclick="window._dmMissieGoedkeuren('${esc(missieId)}','${esc(titel)}',this.closest('.missie-aanvraag-toast'))">${icon('check')} Goedkeuren</button>
      <button class="ts-wedden-btn" style="padding:3px 10px;font-size:0.8rem;opacity:0.7" onclick="this.closest('.missie-aanvraag-toast').remove()">${icon('x')} Negeer</button>
    </div>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  // Geen auto-verwijder — DM moet actie ondernemen
}

window._dmMissieGoedkeuren = async (id, titel, toastEl) => {
  try {
    await api.missieGoedkeuren(id);
    _tsToast(`${icon('check-circle')} Missie <strong>${esc(titel)}</strong> goedgekeurd.`);
    toastEl?.remove();
  } catch (err) {
    _tsToast(err.message || 'Goedkeuren mislukt.');
  }
};

// ── Help-systeem ─────────────────────────────────────────────────────────────

const HELP_CONFIG = {
  personages: () => ({ titel: 'Personages', stappen: [{ titel: 'Personages', tekst: 'Hier vind je de **personages** die je hebt ontmoet — NPC’s én de avonturiers van het gezelschap. Klik een kaart voor details, geheimen en relaties. De DM bepaalt wie zichtbaar is.', afbeelding: null }] }),
  locaties:   () => ({ titel: 'Locaties', stappen: [{ titel: 'Locaties', tekst: `De **plekken** van ${window._campagneNaam()} en daarbuiten. Een locatie met het type *Winkel* heeft een voorraad waar je kunt kopen en verkopen. Filter via de trechter op o.a. *Winkel*. Klik een kaart voor meer.`, afbeelding: null }] }),
  organisaties: () => ({ titel: 'Organisaties', stappen: [{ titel: 'Organisaties', tekst: 'Gilden, ordes en groeperingen in de wereld. Klik een kaart voor hun doel, leden en banden met andere partijen.', afbeelding: null }] }),
  voorwerpen: () => ({ titel: 'Voorwerpen', stappen: [{ titel: 'Voorwerpen', tekst: 'Wapens, uitrusting en magische items. Je kunt voorwerpen claimen, ruilen en in winkels kopen/verkopen. **Zegeningen & Gunsten** (tempel- en factie-beloningen) staan onder een eigen filter, los van de gewone spullen.', afbeelding: null }] }),
  documenten: () => ({ titel: 'Documenten', stappen: [{ titel: 'Documenten', tekst: 'Het **archief**: brieven, aktes, kaarten en aantekeningen die je onderweg verzamelt. De DM onthult documenten wanneer ze relevant worden.', afbeelding: null }] }),
  kaart:      () => ({ titel: 'De kaart', stappen: [{ titel: 'Wereld- en stadskaart', tekst: 'Wissel tussen de **wereldkaart** en de **stadskaart**. Pins markeren ontdekte locaties — klik een pin om het bijbehorende kaartje te openen. Zoom met de knoppen of scroll.', afbeelding: null }] }),
  dungeon:    () => ({ titel: 'Dungeon-kaarten', stappen: [{ titel: 'Dungeon verkennen', tekst: 'Verken kerkers en gebouwen kamer voor kamer. De DM onthult ruimtes naarmate je vordert; verbindingen tonen hoe alles samenhangt.', afbeelding: null }] }),

  tempel: () => {
    const naam = window.app?.state?.meta?.tempel?.naam || 'De Tempel';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `${naam} is de plek waar je de goden van Grisburgh kunt bezoeken. Elke god heeft een eigen priester, een eigen domein en eigen gunsten. Bezoeken kost goud — maar de zegeningen en eden die je ontvangt, kunnen je lot in gevecht bepalen.`,
          afbeelding: null,
        },
        {
          titel: 'Zegeningen',
          tekst: 'Een zegening is een tijdelijk voordeel van een god. Je rolt een dobbelworp en ontvangt één van de eenmalige zegens van die god — elk met een ander effect. Je kunt maar één zegening tegelijk dragen. Ontvang je een nieuwe, dan verdwijnt de oude. Gebruik je hem op, dan is hij weg tot je een nieuwe koopt.',
          afbeelding: null,
        },
        {
          titel: 'Eden & Vloeken',
          tekst: 'Een eed is een permanente verbintenis met een god. Je ontvangt een blijvende bonus (bijv. STR +1), maar als je de eed verzaakt krijg je een vloek. Een vloek kun je afkopen door boete te doen in de tempel. Je kunt maar één eed tegelijk dragen.',
          afbeelding: null,
        },
      ],
    };
  },

  facties: () => ({
    titel: 'Facties & Aanzien',
    stappen: [
      {
        titel: 'Facties & Aanzien',
        tekst: 'Facties zijn organisaties in Grisburgh waarmee de party een band kan opbouwen. Door missies te voltooien bouw je renown op bij een factie. Hoe meer renown, hoe hoger je rang — en hoe meer voordelen je krijgt.',
        afbeelding: null,
      },
      {
        titel: 'Rangen & Boons',
        tekst: 'Elke factie heeft een rangstructuur. Als je genoeg renown hebt bereikt voor de volgende rang, ontvang je automatisch een boon — een permanent voordeel dat in je knapzak terechtkomt. Bekijk het kaartje voor de exacte werking.',
        afbeelding: null,
      },
      {
        titel: 'Missies accepteren',
        tekst: 'In het interieur van een factie staan beschikbare missies. Klik op "Accepteer" om een missie aan te vragen — de DM keurt dit goed of af. De party kan per factie maar één actieve missie tegelijk hebben.',
        afbeelding: null,
      },
      {
        titel: 'Renown & beloning',
        tekst: 'Als de DM een missie markeert als voltooid, ontvang je automatisch de renown-beloning. Bereik je daarmee een nieuwe rang, dan worden bijbehorende boons direct uitgedeeld. Een eventuele valuta-beloning gaat naar de groepskas of wordt eerlijk verdeeld.',
        afbeelding: null,
      },
    ],
  }),

  magizoo: () => {
    const naam = window.app?.state?.meta?.magizoo?.naam || 'De Magizoöloog';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `${naam} onderzoekt wezens die de party heeft ontmoet. Per onderzoek onthult hij een niveau meer over het wezen in je bestiarium — van naam naar deels naar volledig. Elk onderzoek kost goud en heeft een afkoeltijd.`,
          afbeelding: null,
        },
        {
          titel: 'Kennisniveaus & gevecht',
          tekst: 'Naam — alleen de identiteit van het wezen. Deels — verdediging, ability scores, resistances en talen. Volledig — traits, actions en Challenge Rating. Hoe meer je weet, hoe beter je de HP-balk in gevecht kunt aflezen: bij deels/volledig zie je exacte HP.',
          afbeelding: null,
        },
      ],
    };
  },

  ursula: () => {
    const naam = window.app?.state?.meta?.ursula?.naam || 'Madame Ursula';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `${naam} leest de toekomst via de zintuigen van het lot. Eén keer per akte kan de groep een voorspelling vragen — de uitslag is voor iedereen tegelijk zichtbaar. De voorspelling is vaag en poëtisch, nooit een garantie.`,
          afbeelding: null,
        },
        {
          titel: 'De zintuigen',
          tekst: 'Je kiest vijf zintuigen die je wilt bevragen: Zien, Horen, Ruiken, Proeven, Voelen. Ursula rolt een d6: op een 1–5 onthult ze één zintuig, op een 6 alle vijf. Welk zintuig ze kiest is aan het lot.',
          afbeelding: null,
        },
      ],
    };
  },

  progressie: () => ({
    titel: 'Progressie',
    stappen: [
      {
        titel: 'Jouw progressie',
        tekst: 'Dit tabblad toont alle class features en abilities van je karakter, geordend per level. Vergrendelde levels (hoger dan je huidige level) zijn grijs weergegeven. Je kunt wisselen tussen tijdlijn- en kaartweergave.',
        afbeelding: null,
      },
      {
        titel: 'Favorieten & keuzes',
        tekst: 'Markeer een feature als favoriet door op ☆ te klikken — zo vind je hem snel terug. Bij keuze-features (zoals Ability Score Improvement) kun je je keuze noteren. Dit wordt opgeslagen en is zichtbaar op het kaartje.',
        afbeelding: null,
      },
    ],
  }),

  bestiarium: () => ({
    titel: 'Bestiarium',
    stappen: [
      {
        titel: 'Bestiarium',
        tekst: 'Het bestiarium toont alle wezens die de party heeft ontmoet. Hoe meer je van een wezen weet, hoe meer info je ziet. De DM onthult wezens automatisch bij eerste contact — verdere kennis moet je verdienen.',
        afbeelding: null,
      },
      {
        titel: 'Kennisniveaus',
        tekst: 'Naam — je herkent het wezen maar weet verder niets. Deels — je kent de basisstats, wapenresistenties en zintuigen. Volledig — je kent alles: traits, actions en Challenge Rating. De Magizoöloog kan het niveau verhogen.',
        afbeelding: null,
      },
    ],
  }),

  gevecht: () => ({
    titel: 'Gevecht',
    stappen: [
      {
        titel: 'Gevechtsweergave',
        tekst: 'Tijdens een gevecht zie je bovenaan de initiatiefvolgorde met wie er aan de beurt is. De actieve deelnemer is goudgekleurd gemarkeerd. Condities (vergiftigd, verblind, etc.) zijn zichtbaar als iconen naast de naam.',
        afbeelding: null,
      },
      {
        titel: 'HP-balken van vijanden',
        tekst: 'Vijanden zonder bestiarium-kennis tonen een ruwe balk in drie segmenten: gezond, gewond, kritiek. Als je het wezen deels of volledig kent (via de Magizoöloog), zie je een nauwkeurige balk met exacte HP.',
        afbeelding: null,
      },
    ],
  }),

  // Een speler dacht dat de hele bibliotheek haar eigen spreuken waren. Vandaar
  // dat deze uitleg met dat misverstand begint in plaats van met de functies.
  spreuken: () => ({
    titel: 'Spreuken — het naslagwerk',
    stappen: [
      {
        titel: 'Dit zijn niet jouw spreuken',
        tekst: 'Deze bibliotheek bevat álle spreuken die in deze wereld bestaan — honderden, van elke klasse en elk niveau. Het is een naslagwerk, zoals een woordenboek: je kunt er alles in opzoeken, maar je kent het niet uit je hoofd. Wat jouw personage daadwerkelijk kan, staat in je eigen Spreukenboek onder je personage.',
        afbeelding: null,
      },
      {
        titel: 'Waar staan mijn eigen spreuken dan?',
        tekst: 'Ga naar je personage en kies het tabblad Spreukenboek. Daar staat alleen wat jij kent, met je Spell Save DC, je spell attack bonus en je spell slots. Wat je daar niet ziet, kun je ook niet casten — hoe verleidelijk het hier ook staat.',
        afbeelding: null,
      },
      {
        titel: 'Waar is het dan goed voor?',
        tekst: 'Om op te zoeken wat een spreuk van een tegenstander doet, om te kijken wat je bij een volgend level zou kunnen leren, of om een scroll of staf op te zoeken die je gevonden hebt. Filter op klasse, niveau of school, of zoek op naam.',
        afbeelding: null,
      },
      {
        titel: 'Nieuwe spreuken leren',
        tekst: 'Spreuken komen in je eigen boek terecht via je klasse (bij een levelup), via een scroll of via de DM. Rondkijken in de bibliotheek voegt niets toe aan je boek — vraag het je DM als je denkt dat er iets ontbreekt.',
        afbeelding: null,
      },
    ],
  }),

  spreukenboek: () => ({
    titel: 'Spreukenboek',
    stappen: [
      {
        titel: 'Spreukenboek',
        tekst: 'Hier staan JOUW spreuken, geordend op level — niet te verwarren met het tabblad Spreuken in de zijbalk, dat een naslagwerk is met alle spreuken die bestaan. Bovenaan zie je je Spell Save DC, spell attack bonus en beschikbare spell slots. Klik op een spreuk voor de volledige beschrijving.',
        afbeelding: null,
      },
      {
        titel: 'Spell slots',
        tekst: 'Je spell slots worden weergegeven als bolletjes per level. Een gevuld bolletje is beschikbaar, een leeg bolletje is verbruikt. Klik op een bolletje om het te markeren als verbruikt, of klik opnieuw om het terug te zetten. Slots herstellen na een lange rust.',
        afbeelding: null,
      },
      {
        titel: 'Vastgepinde spreuken',
        tekst: 'Veelgebruikte spreuken kun je vastpinnen via de ster (★) op het kaartje. Ze verschijnen dan ook als snelknoppen op het Party-tabblad, zodat je ze snel kunt raadplegen tijdens gevecht.',
        afbeelding: null,
      },
    ],
  }),

  knapzak: () => ({
    titel: 'Boedel',
    stappen: [
      {
        titel: 'Boedel & Knapzak',
        tekst: 'Hier staan al je bezittingen: je beurs, jouw voorwerpen en de Zegeningen & Vloeken die je draagt. Scroll door de carrousel om al je voorwerpen te zien. Klik op een kaartje om het volledig te bekijken.',
        afbeelding: null,
      },
      {
        titel: 'Charges & gebruik',
        tekst: 'Sommige voorwerpen hebben charges (oplaadpunten). Klik op een bolletje om een charge te verbruiken. Wapens met schade tonen een klikbare pill — klik erop om het dobbelsteenpaneel te openen.',
        afbeelding: null,
      },
      {
        titel: 'Zegeningen & Vloeken',
        tekst: 'Je actieve zegening en eventuele vloek van een factie of tempel staan apart vermeld. Klik op "bekijk zegening" of "bekijk eed" om het bijbehorende voorwerpkaartje te openen.',
        afbeelding: null,
      },
    ],
  }),

  party: () => ({
    titel: 'Party',
    stappen: [
      {
        titel: 'Party-overzicht',
        tekst: 'Dit tabblad toont de andere leden van jouw groep. Je kunt zien wie aanwezig is voor de sessie. Bovenaan staan eventuele ontdekkingen, inspiratie en de initiatiefvolgorde als er een gevecht actief is.',
        afbeelding: null,
      },
      {
        titel: 'Vastgepinde spreuken & boons',
        tekst: 'Als je spreuken of factie-boons hebt vastgepind, verschijnen ze hier als snelknoppen. Handig om snel een spreukbeschrijving te raadplegen tijdens een gevecht zonder door je spreukenboek te bladeren.',
        afbeelding: null,
      },
    ],
  }),

  personage: () => ({
    titel: 'Mijn personage',
    stappen: [
      {
        titel: 'Combat stats',
        tekst: 'Hier stel je je gevechtswaarden in: AC, snelheid, initiative, proficiency bonus en hit die. Deze worden niet automatisch berekend — vul ze in vanuit je character sheet. Passive Perception wordt automatisch berekend vanuit je Wisdom modifier en proficiency.',
        afbeelding: null,
      },
      {
        titel: 'HP bijhouden',
        tekst: 'Gebruik de + en − knoppen om HP bij te houden tijdens gevecht. Je kunt ook Temporary HP instellen. De waarden worden live gesynchroniseerd met de DM.',
        afbeelding: null,
      },
      {
        titel: 'Ability Scores & Skills',
        tekst: 'Je ability scores en skill proficiencies stel je in op dit tabblad. Modifiers worden automatisch berekend. Skill totalen combineren de modifier met je proficiency bonus als je het skill aangevinkt hebt.',
        afbeelding: null,
      },
    ],
  }),

  herberg: () => {
    const naam = window.app?.state?.meta?.herberg?.naam || 'De Herberg';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `Bij ${naam} kun je overnachten en rusten. Een lange rust herstelt je HP en spell slots volledig. Je kunt ook inkopen doen als er een voorraad beschikbaar is.`,
          afbeelding: null,
        },
        {
          titel: 'Lange rust',
          tekst: 'Na een lange rust worden je HP en spell slots volledig hersteld. Ook je Hit Dice worden deels aangevuld (helft van je level, afgerond naar boven). De kosten voor een overnachting worden automatisch van je beurs afgeschreven.',
          afbeelding: null,
        },
      ],
    };
  },

  tweespalt: () => {
    const naam = window.app?.state?.meta?.tweespalt?.naam || 'De Tweespalt';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `Bij ${naam} kun je wedden op uitkomsten van events in de campagne. Kies een weddenschapsoptie, bepaal je inzet en bevestig. Als de uitkomst in jouw voordeel uitvalt, keert de DM de winst uit.`,
          afbeelding: null,
        },
        {
          titel: 'Leningen',
          tekst: 'Als je goud tekortkomt kun je een lening afsluiten bij de bank. Let op: leningen hebben rente en moeten terugbetaald worden. Kom je niet na, dan volgen er consequenties.',
          afbeelding: null,
        },
      ],
    };
  },

  gock: () => {
    const naam = window.app?.state?.meta?.gock?.naam || 'De Gock';
    return {
      titel: naam,
      stappen: [
        {
          titel: naam,
          tekst: `${naam} is een particulier onderzoeksbureau. Je kunt hem inhuren om een persoon, locatie of organisatie te onderzoeken. Na een sessie (24 uur) levert hij een rapport op dat in het archief verschijnt.`,
          afbeelding: null,
        },
      ],
    };
  },

  dungeon: () => ({
    titel: 'Dungeonkaarten',
    stappen: [
      {
        titel: 'Fog of war',
        tekst: 'Een dungeon is een plattegrond waarvan de kamers per party onthuld worden. Wat nog niet onthuld is, blijft voor spelers in het duister. Klik een kamer aan en gebruik "Onthul" — of het oogje in de kamerlijst — om hem zichtbaar te maken. Verbergen kan net zo goed weer.',
        afbeelding: null,
      },
      {
        titel: 'Kamers tekenen',
        tekst: 'Met de gereedschappen bovenin teken je een rechthoek of een veelhoek over de plattegrond. Met het schakelicoon verbind je twee kamers met een lijn, zodat spelers zien welke doorgangen er zijn.',
        afbeelding: null,
      },
      {
        titel: 'Symbolen',
        tekst: 'Per kamer kun je symbolen zetten: vijanden, buit, vergrendeld of uitgewist. Elk symbool kun je zichtbaar of verborgen maken voor de party — zo geef je een hint zonder alles te verklappen.',
        afbeelding: null,
      },
      {
        titel: 'Vondsten in een kamer',
        tekst: 'Onder "Vondsten" hangt de buit die in deze kamer te halen valt. Typ wat er te vinden is en druk op plus, of koppel een vondst die je al in het Loot-tabblad gemaakt hebt. De DC ernaast is een aantekening voor jou — de spelers gooien aan tafel en jij beslist. Met het muntje maak je er een verdeling van; het kruisje koppelt de vondst weer los zonder hem weg te gooien.',
        afbeelding: null,
      },
      {
        titel: 'Party-toegang',
        tekst: 'Per party stel je in of een dungeon nog niet, nu of al uitgespeeld is. Zo kun je dezelfde kaart voor meerdere groepen gebruiken zonder dat hun voortgang door elkaar loopt.',
        afbeelding: null,
      },
    ],
  }),

  logboek: () => ({
    titel: 'Logboek',
    stappen: [
      {
        titel: 'Verslagen',
        tekst: 'Hier staan de sessieverslagen van de campagne, aangevuld met notities van de DM. Je kunt door aktes bladeren via de navigatie bovenaan.',
        afbeelding: null,
      },
      {
        titel: 'Missies (prikbord)',
        tekst: 'Op het prikbord staan alle missies van de campagne, ingedeeld op status: Beschikbaar, In uitvoering, Voltooid en Mislukt. Klik op een missiekaartje voor de details.',
        afbeelding: null,
      },
    ],
  }),
};

// ── DM-panel HELP_CONFIG entries ──
Object.assign(HELP_CONFIG, {
  dm_gevecht: () => ({
    titel: 'Gevecht & Monsters',
    stappen: [
      { titel: 'Initiative tracker', tekst: 'Voeg spelers en monsters toe aan het gevecht. Klik op "Start gevecht" om de initiative-ronde te beginnen. Het combat-scherm is zichtbaar voor alle spelers.', afbeelding: null },
      { titel: 'HP beheren', tekst: 'Klik op het HP-getal van een combatant om schade of genezing toe te passen. Gebruik het schildicoon voor tijdelijke HP.', afbeelding: null },
      { titel: 'Monsters toevoegen', tekst: 'Ga naar het subtabblad "Monsters" om monsters uit het bestiarium toe te voegen. Kies een encounter of voeg individuele monsters toe.', afbeelding: null },
    ],
  }),
  dm_loot: () => ({
    titel: 'Loot',
    stappen: [
      { titel: 'Wat is een vondst?', tekst: 'Een vondst is één ding dat de party kan vinden: de geldzak in de haard, het zwaard onder de plavuizen. Eén kamer kan er meerdere hebben. Een vondst kan munten bevatten, voorwerpen, of allebei.', afbeelding: null },
      { titel: 'De DC is een aantekening', tekst: 'Het getal naast een vondst is voor jou, niet voor de app. De spelers gooien aan tafel en jij beslist of ze het vinden — onthullen is altijd een klik. Er hoeft dus nergens een worp ingevoerd te worden, en je kunt de DC net zo goed negeren.', afbeelding: null },
      { titel: 'Onthullen', tekst: 'Vink één of meer vondsten aan en klik op Onthul. Dat bouwt één verdeling waarin elk voorwerp onthouden heeft waar het vandaan komt ("uit de haard", "onder de plavuizen"). In het venster dat opent kun je nog bijstellen; pas met "Stuur naar spelers" zien zij iets — en gaat op de tablet de kist open.', afbeelding: null },
      { titel: 'Munten', tekst: `Vul één bedrag in met een komma: 1,34 is 1 ${window._muntNamen().fl}, 3 ${window._muntNamen().kn} en 4 ${window._muntNamen().cl}. Wil je het aan het toeval overlaten, vul dan een bereik in bij "Of gerold"; dat wordt pas bij het onthullen gerold, zodat je ziet wat het geworden is voordat het scherm opengaat.`, afbeelding: null },
      { titel: 'Willekeurige voorwerpen', tekst: 'Zet een regel op "willekeurig" met een rarity, dan kiest de app bij het onthullen een bestaand voorwerpkaartje van die zeldzaamheid. Handig voor een kist waarvan de inhoud er niet toe doet.', afbeelding: null },
      { titel: 'Sjablonen', tekst: 'Een sjabloon is een mal, geen vondst: hij ligt nergens en wordt niet onthuld. Hij staat apart onderaan met de knop "Gebruiken", die er een kopie van maakt in de lijst erboven. Die kopie pas je aan zonder dat het sjabloon verandert — en andersom.', afbeelding: null },
      { titel: 'Waar een vondst ligt', tekst: 'Bij "Plek" hang je een vondst aan een dungeonkamer; dat kan ook vanuit de kamer zelf. Je kunt een vondst ook als stap in een akte zetten, zodat je hem tijdens het spelen vanuit de regie-balk onthult.', afbeelding: null },
      { titel: 'Mimic', tekst: 'Koppel je een gevecht aan een vondst, dan is het geen buit maar een mimic. Op het tafelscherm gaat dezelfde kist open, met een heel andere ontknoping — en jij krijgt de vraag of het gevecht meteen moet beginnen.', afbeelding: null },
      { titel: 'Geluid', tekst: 'Het geluid bij een onthulling stel je één keer in, in de Geluiden-tab onder "Momenten". Het klinkt op het moment dat de spelers de buit zien.', afbeelding: null },
    ],
  }),
  dm_rust: () => ({
    titel: 'Rust (DM)',
    stappen: [
      { titel: 'Rust starten', tekst: 'Kies een locatie (in het veld of de herberg) en start een lange of korte rust. De rust is party-breed en toont elke speler een cinematische overlay. Een lange rust in de herberg schrijft de overnachtingsprijs per speler af en onthult 2 roddels per speler.', afbeelding: null },
      { titel: 'Sfeer & gebeurtenissen', tekst: 'Stel per scenario een achtergrondafbeelding in (veld / korte rust; de herberg gebruikt zijn eigen achtergrond). Koppel een weighted d100-tabel als gebeurtenissen-tabel — elke speler rolt bij een lange rust een eigen voorval, met optioneel een valuta-effect per regel.', afbeelding: null },
    ],
  }),
  dm_aktes: () => ({
    titel: 'Aktes & Regie',
    stappen: [
      { titel: 'Aktes', tekst: 'Aktes zijn de verhaalscènes van je sessie. Maak een nieuwe akte aan via "+ Nieuwe akte" of importeer een Obsidian-hoofdstuk.', afbeelding: null },
      { titel: 'Regie-balk', tekst: 'Speel een akte om de regie-balk te activeren. De regie-balk geeft je per stap inzicht in welke entiteiten, locaties en tekst relevant zijn.', afbeelding: null },
      { titel: 'Onthullen', tekst: 'Klik op een entiteit of locatie in de regie-balk om deze te onthullen voor de spelers. Onthulde items worden zichtbaar in het archief.', afbeelding: null },
    ],
  }),
  dm_geluiden: () => ({
    titel: 'Geluiden & Sfeer',
    stappen: [
      { titel: 'Geluidsbibliotheek', tekst: 'Beheer hier de geluiden en sfeerloops voor je campagne. Klik op een geluid om het af te spelen voor alle spelers.', afbeelding: null },
      { titel: 'Geluidsdecors', tekst: 'Geluidsdecors zijn achtergrondloops (wind, regen, herbergruis). Ze spelen automatisch door totdat je ze stopt.', afbeelding: null },
    ],
  }),
  dm_spreuken: () => ({
    titel: 'Spreukenbibliotheek',
    stappen: [
      { titel: 'Spreuken beheren', tekst: 'Zoek en bekijk spreukbeschrijvingen. Gebruik de filters om op niveau, school of klasse te filteren.', afbeelding: null },
      { titel: 'Spellbron', tekst: 'De spellbron (2014 of 2024 PHB) stel je in via de campagne-instellingen. Dit bepaalt welke spreuklijst getoond wordt.', afbeelding: null },
    ],
  }),
  dm_tafels: () => ({
    titel: 'Willekeurstafels & Namen',
    stappen: [
      { titel: 'Willekeurstafels', tekst: 'Rol op een willekeurstafel om een resultaat te genereren. Gebruik dit voor random encounters, weersinvloeden, beloningen of namen.', afbeelding: null },
      { titel: 'Namenlijsten', tekst: 'Genereer NPC-namen op basis van cultuur of origine. Klik op een naam om hem te kopiëren.', afbeelding: null },
    ],
  }),
  dm_berichten: () => ({
    titel: 'Berichten',
    stappen: [
      { titel: 'Berichten sturen', tekst: 'Stuur persoonlijke berichten naar individuele spelers. De speler ontvangt een notificatie en kan de brief lezen in zijn berichtentabblad.', afbeelding: null },
      { titel: 'Geheime informatie', tekst: 'Gebruik berichten voor geheime informatie die alleen die speler mag weten — visioenen, dromen, geheime contacten.', afbeelding: null },
    ],
  }),
  dm_herberg: () => ({
    titel: 'Herberg (DM)',
    stappen: [
      { titel: 'Herberg beheren', tekst: 'Stel hier de beschikbare kamers en maaltijden in. Spelers kunnen vanuit hun scherm een kamer of maaltijd bestellen.', afbeelding: null },
      { titel: 'Prijs en beschikbaarheid', tekst: 'Pas de prijs en beschikbaarheid per kamer aan. Uitgeschakelde items zijn niet zichtbaar voor spelers.', afbeelding: null },
    ],
  }),
  dm_toegang: () => ({
    titel: 'Toegang per groep',
    stappen: [
      { titel: 'Diensten per groep', tekst: 'Schakel hier per groep de zichtbaarheid van diensten in of uit. Verborgen diensten zijn onzichtbaar voor die groep.', afbeelding: null },
    ],
  }),
  dm_media: () => ({
    titel: 'Mediabibliotheek',
    stappen: [
      { titel: 'Eén overzicht', tekst: 'Alle geüploade afbeeldingen en audio op één plek. Zoek op naam, filter op type en sorteer op datum of naam. Klik een afbeelding aan om hem groot te bekijken; speel audio af met de afspeelknop.', afbeelding: null },
      { titel: 'Hernoemen is veilig', tekst: 'Klik op de naam (potlood) om een bestand een duidelijke weergavenaam te geven, bijvoorbeeld "gareth-personages". De naam staat los van het bestand zelf — verwijzingen blijven altijd intact.', afbeelding: null },
      { titel: 'Ongebruikte bestanden', tekst: 'Het Wezen-filter toont bestanden die nergens meer gebruikt worden. Die kun je veilig (en in bulk) opruimen. Een bestand dat nog in gebruik is, vraagt eerst een extra bevestiging voordat het weg mag.', afbeelding: null },
    ],
  }),
});

// Overschrijvingen vanuit de server (laden in init)
let _helpOverrides = {};

window._helpBtn = function _helpBtn(key, opts = {}) {
  const cls = opts.cls || '';
  const editBtn = window.app?.isDM?.()
    ? `<button class="help-edit-btn" onclick="event.stopPropagation();window._openHelpEditor('${key}')" title="Help-tekst bewerken">${icon('pencil')}</button>`
    : '';
  return `<span class="help-btn-wrap">${editBtn}<button class="help-btn ${cls}" onclick="event.stopPropagation();window._openHelp('${key}')" title="Uitleg">${icon('book-open')}</button></span>`;
}

function _resolveHelp(key) {
  const override = _helpOverrides[key];
  if (override?.stappen?.length) return override;
  const fn = HELP_CONFIG[key];
  return fn ? fn() : null;
}

window._openHelp = (key) => {
  document.getElementById('help-modal')?.remove();
  const config = _resolveHelp(key);
  if (!config) return;
  _renderHelpModal(config, 0);
};

function _renderHelpModal(config, idx) {
  document.getElementById('help-modal')?.remove();
  const stap    = config.stappen[idx];
  const totaal  = config.stappen.length;
  const isFirst = idx === 0;
  const isLast  = idx === totaal - 1;

  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'help-modal-overlay';
  modal.innerHTML = `
    <div class="help-modal" onclick="event.stopPropagation()">
      <div class="help-modal-header">
        <span class="help-modal-titel">${icon('book-open')} ${esc(config.titel)}</span>
        <div class="help-modal-nav-info">
          ${totaal > 1 ? `<span class="help-modal-stap">${idx + 1} / ${totaal}</span>` : ''}
          <button class="help-modal-close" onclick="document.getElementById('help-modal').remove()">${icon('x')}</button>
        </div>
      </div>
      ${stap.afbeelding ? `<img src="${esc(stap.afbeelding)}" class="help-modal-afbeelding" alt="">` : ''}
      <div class="help-modal-body">
        <div class="help-modal-stap-titel">${esc(stap.titel)}</div>
        <div class="help-modal-tekst">${mdToHtml(stap.tekst)}</div>
      </div>
      ${totaal > 1 ? `
      <div class="help-modal-footer">
        <button class="help-modal-prev" onclick="window._helpStap(${idx - 1})" ${isFirst ? 'disabled' : ''}>${icon('chevron-left')} Vorige</button>
        <div class="help-modal-dots">
          ${config.stappen.map((_, i) => `<span class="help-modal-dot${i === idx ? ' help-modal-dot--actief' : ''}"></span>`).join('')}
        </div>
        <button class="help-modal-next" onclick="window._helpStap(${idx + 1})" ${isLast ? 'disabled' : ''}>Volgende ${icon('chevron-right')}</button>
      </div>` : ''}
    </div>`;
  modal.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);
  window._helpModalConfig = config;
}

window._helpStap = (idx) => {
  if (!window._helpModalConfig) return;
  _renderHelpModal(window._helpModalConfig, idx);
};

// ── Help-editor (DM only) ──
// Compacte opmaak-werkbalk voor een help-textarea (hergebruikt de globale
// _fmt/_fmtKleurSelect-helpers en dezelfde markdown als mdToHtml).
function _helpFmtBar(id) {
  const hex = _FMT_KLEUR_HEX;
  return `<div class="fmt-toolbar">
    <button type="button" class="fmt-btn fmt-btn-b" title="Vet (Ctrl+B)" onclick="window._fmt('${id}','**')">B</button>
    <button type="button" class="fmt-btn fmt-btn-i" title="Cursief (Ctrl+I)" onclick="window._fmt('${id}','*')">I</button>
    <button type="button" class="fmt-btn fmt-btn-u" title="Onderstreept" onclick="window._fmt('${id}','__')">U</button>
    <button type="button" class="fmt-btn fmt-btn-s" title="Doorhalen" onclick="window._fmt('${id}','~~')">S</button>
    <button type="button" class="fmt-btn fmt-btn-mark" title="Markeren" onclick="window._fmt('${id}','==')">A</button>
    <div class="fmt-toolbar-sep"></div>
    <div class="fmt-kleuren">
      ${Object.entries(hex).map(([naam, kleur]) =>
        `<button type="button" class="fmt-kleur-knop" style="--k:${kleur}" title="${naam}"
          onclick="window._fmtKleur('${id}','${naam}')"></button>`).join('')}
    </div>
  </div>`;
}

window._openHelpEditor = (key) => {
  document.getElementById('help-editor-modal')?.remove();
  const defaults = HELP_CONFIG[key]?.() || { titel: key, stappen: [{ titel: '', tekst: '' }] };
  const current  = _helpOverrides[key] || defaults;

  const modal = document.createElement('div');
  modal.id = 'help-editor-modal';
  modal.className = 'help-modal-overlay';

  const renderEditor = (config) => {
    modal.innerHTML = `
      <div class="help-modal help-editor" onclick="event.stopPropagation()" style="max-width:520px">
        <div class="help-modal-header">
          <span class="help-modal-titel">${icon('pencil')} Help-tekst bewerken</span>
          <button class="help-modal-close" onclick="document.getElementById('help-editor-modal').remove()">${icon('x')}</button>
        </div>
        <div class="help-editor-body">
          <label class="help-editor-label">Titel</label>
          <input id="he-titel" class="dm-input help-editor-input" value="${esc(config.titel)}">
          <div id="he-stappen">
            ${config.stappen.map((s, i) => `
              <div class="he-stap" data-i="${i}">
                <div class="he-stap-head">
                  <span class="he-stap-nr">Stap ${i + 1}</span>
                  ${config.stappen.length > 1 ? `<button class="help-editor-del-stap dm-btn dm-btn-ghost dm-btn-sm" data-i="${i}" title="Stap verwijderen">${icon('trash')}</button>` : ''}
                </div>
                <label class="help-editor-label">Titel stap</label>
                <input class="dm-input help-editor-input he-stap-titel" data-i="${i}" value="${esc(s.titel)}">
                <label class="help-editor-label">Tekst</label>
                ${_helpFmtBar(`he-stap-tekst-${i}`)}
                <textarea id="he-stap-tekst-${i}" class="dm-input he-stap-tekst" data-i="${i}" rows="4" style="resize:vertical"
                  onkeydown="window._fmtKey(event)">${esc(s.tekst)}</textarea>
              </div>`).join('')}
          </div>
          <button class="dm-btn dm-btn-ghost dm-btn-sm" id="he-add-stap" style="margin-top:6px">${icon('plus')} Stap toevoegen</button>
        </div>
        <div class="help-editor-footer">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" id="he-reset" title="Terug naar standaardtekst">${icon('refresh-cw')} Standaard herstellen</button>
          <div style="display:flex;gap:6px">
            <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="document.getElementById('help-editor-modal').remove()">${icon('x')} Annuleren</button>
            <button class="dm-btn dm-btn-primary dm-btn-sm" id="he-save">${icon('save')} Opslaan</button>
          </div>
        </div>
      </div>`;

    modal.querySelector('#he-add-stap').onclick = () => {
      const cfg = _readEditorForm(modal);
      cfg.stappen.push({ titel: '', tekst: '' });
      renderEditor(cfg);
    };

    modal.querySelectorAll('.help-editor-del-stap').forEach(btn => {
      btn.onclick = () => {
        const cfg = _readEditorForm(modal);
        cfg.stappen.splice(+btn.dataset.i, 1);
        renderEditor(cfg);
      };
    });

    modal.querySelector('#he-reset').onclick = async () => {
      if (!confirm('Standaardtekst herstellen? Jouw aanpassingen gaan verloren.')) return;
      await api.deleteHelpContent(key);
      delete _helpOverrides[key];
      document.getElementById('help-editor-modal').remove();
    };

    modal.querySelector('#he-save').onclick = async () => {
      const cfg = _readEditorForm(modal);
      try {
        await api.saveHelpContent(key, cfg);
        _helpOverrides[key] = cfg;
        document.getElementById('help-editor-modal').remove();
      } catch(e) {
        alert('Opslaan mislukt: ' + e.message);
      }
    };
  };

  renderEditor(current);
  // Bewust GÉÉN klik-buiten-sluit op de editor: dat sloot 'm soms af zonder opslaan
  // (o.a. via de kleur-dropdown). Sluiten kan alleen via × of Annuleren.
  document.body.appendChild(modal);
};

function _readEditorForm(modal) {
  const titel   = modal.querySelector('#he-titel')?.value || '';
  const stappen = Array.from(modal.querySelectorAll('.he-stap')).map(el => ({
    titel: el.querySelector('.he-stap-titel')?.value || '',
    tekst: el.querySelector('.he-stap-tekst')?.value || '',
    afbeelding: null,
  }));
  return { titel, stappen };
}

function _tsToast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => {
    t.classList.remove('map-toast--show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 4000);
}

init();
