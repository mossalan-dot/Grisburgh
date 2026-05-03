import { api } from './api.js';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor } from './render-campagne.js?v=47'; // app v115
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from './render-archief.js?v=17';
import { renderKaart, queueFlyTo } from './render-kaart.js?v=2';
import { renderDungeon } from './render-dungeon.js?v=15';
import { renderRelatiemap } from './render-relatiemap.js?v=9';
import { initSocket } from './socket-client.js?v=9';
import { initDmPanel } from './dm-panel.js?v=19';

// ── App State ──
const state = {
  role:        'player',
  dmPreview:   false,   // true = DM authenticated but viewing as player
  playerName:  null,    // naam van ingelogde speler (of null als anoniem)
  characterId: null,    // ID van bijbehorend personage-kaartje
  activeSection: 'personages',
  meta: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
  dmToggleClick,
  onFabClick,
  openModal,
  closeModal,
  openLightbox,
  openLightboxAt,
  lbNavigate,
  closeLightbox,
  refreshSection,
  switchSection,
  esc,
  escJS,
  mdToHtml,
  switchGroup,
  renameGroup,
  newGroup,
  deleteGroup,
  editHeader,
  saveHeader,
  cancelHeader,
  applyAppMeta,
  showLanding,
  hideLanding,
  _landingPortraitClick,
  openPlayerPicker,
  closePlayerPicker,
  playerLogin,
  playerLogout,
  toggleArchiefMenu,
  closeArchiefMenu,
  toggleDienstenMenu,
  closeDienstenMenu,
  toggleLogboekMenu,
  closeLogboekMenu,
  setActiveAkte,
  stopAkte,
};

// ── Actieve akte (reveal-modus vanuit logboek) ──
function setActiveAkte(ch, num, title) {
  const chip  = document.getElementById('active-akte-chip');
  const label = document.getElementById('active-akte-label');
  if (!chip || !label) return;
  label.textContent = `Akte ${num} — ${title}`;
  chip.classList.remove('hidden');
}

function stopAkte() {
  const chip = document.getElementById('active-akte-chip');
  if (chip) chip.classList.add('hidden');
  window.dmPanel?.closeRevealStrip?.();
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

// Logboek dropdown items
$$('#logboek-menu .archief-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    window._logboekActiveTab = btn.dataset.logtab;
    switchSection('logboek');
    closeLogboekMenu();
  });
});

// Sluit dropdowns bij klik buiten het menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('#archief-nav-group')) closeArchiefMenu();
  if (!e.target.closest('#diensten-nav-group')) closeDienstenMenu();
  if (!e.target.closest('#logboek-nav-group')) closeLogboekMenu();
});

function switchSection(section) {
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
  if (archiefLabel) archiefLabel.textContent = isArchief ? ARCHIEF_LABELS[section] : 'Archief';

  // Archief dropdown-items
  $$('#archief-menu .archief-menu-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  // Logboek-knop: actief als logboek actief is
  const logboekBtn   = $('#logboek-nav-btn');
  const logboekLabel = $('#logboek-nav-label');
  const isLogboek    = section === 'logboek';
  if (logboekBtn) logboekBtn.classList.toggle('active', isLogboek);
  if (logboekLabel) {
    const activeTab = window._logboekActiveTab || 'verslagen';
    logboekLabel.textContent = isLogboek ? (LOGBOEK_LABELS[activeTab] || 'Logboek') : 'Logboek';
  }
  // Logboek dropdown-items
  $$('#logboek-menu .archief-menu-item').forEach(b =>
    b.classList.toggle('active', isLogboek && b.dataset.logtab === (window._logboekActiveTab || 'verslagen')));

  $$('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
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
    kaart:         'rgba(42,90,70,0.55)',
    relatiemap:    'rgba(80,42,122,0.55)',
    logboek:       'rgba(184,134,11,0.55)',
    herberg:       'rgba(160,90,20,0.65)',
    tweespalt:     'rgba(90,20,20,0.65)',
    gock:          'rgba(20,50,80,0.65)',
    'mijn-karakter': 'rgba(42,90,138,0.55)',
    meesterkamer:  'rgba(139,42,42,0.55)',
  };
  const accentBar = document.getElementById('section-accent-bar');
  if (accentBar) {
    accentBar.style.background = SECTION_COLORS[section] || 'rgba(196,168,122,0.35)';
  }

  refreshSection(section);
  updateFab();
}

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
  verslagen: 'Verslagen',
  quests:    'Missies',
  prikbord:  'Prikbord',
};

const ENTITY_SECTIONS  = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const ARCHIEF_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'kaart', 'relatiemap'];
const ARCHIEF_LABELS   = {
  personages:   '👤 Personages',
  locaties:     '🏰 Locaties',
  organisaties: '🏛️ Organisaties',
  voorwerpen:   '🎺 Voorwerpen',
  documenten:   '📜 Documenten',
  kaart:        '🗺️ Kaarten',
  relatiemap:   '🕸️ Relatiemap',
};

function updateFab() {
  const fab = $('#fab');
  const editableSections = [...ENTITY_SECTIONS, 'documenten', 'logboek'];
  // Voor logboek: FAB alleen tonen in de verslagen-subtab, niet in missies of prikbord
  const logboekSubTabOk = state.activeSection !== 'logboek'
    || (window._logboekActiveTab || 'verslagen') === 'verslagen';
  if (state.role === 'dm' && !state.dmPreview && editableSections.includes(state.activeSection) && logboekSubTabOk) {
    fab.classList.remove('hidden');
  } else {
    fab.classList.add('hidden');
  }
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
    refreshAll();
    window.dmPanel?.refreshCombatOverlay();
  } catch {
    $('#login-error').classList.remove('hidden');
  }
}

async function logout() {
  await api.logout();
  state.role = 'player';
  state.dmPreview = false;
  _activeGroupId = null;
  window._activeGroupId = null;
  applyRole();
  refreshAll();
}

async function dmLogout() {
  await logout();
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

  // Dice FAB: spelers zien het reguliere, DM ziet de DM-variant
  const diceFab   = document.getElementById('dice-fab');
  const dmDiceFab = document.getElementById('dm-dice-fab');
  if (diceFab)   diceFab.classList.toggle('hidden', isDmActive);
  if (dmDiceFab) dmDiceFab.classList.toggle('hidden', !isDmActive);

  // Meesterkamer-tab: alleen zichtbaar voor actieve DM
  const dmTab = document.getElementById('dm-tab');
  if (dmTab) dmTab.classList.toggle('hidden', !isDmActive);

  // Spelers-tab: alleen zichtbaar voor actieve DM
  const spelersTab = document.getElementById('spelers-tab');
  if (spelersTab) spelersTab.classList.toggle('hidden', !isDmActive);

  // DM-party-bar: groepswisselaar + party-bar, alleen zichtbaar voor actieve DM
  const dmPartyBar = document.getElementById('dm-party-bar');
  if (dmPartyBar) dmPartyBar.classList.toggle('hidden', !isDmActive);

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

  // Diensten dropdown: alleen zichtbaar voor benoemde spelers
  const dienstenGroup = document.getElementById('diensten-nav-group');
  if (dienstenGroup) dienstenGroup.classList.toggle('hidden', !isNamedPlayer);

  // Herberg-item in dropdown: label aanpassen + verbergen als niet geconfigureerd
  const herbergItem = document.getElementById('diensten-herberg-item');
  if (herbergItem) {
    herbergItem.classList.toggle('hidden', !state.meta?.herberg);
    const herbergNaam = state.meta?.herberg?.naam;
    const herbergLabel = document.getElementById('diensten-herberg-label');
    if (herbergLabel) herbergLabel.textContent = '🍺 ' + (herbergNaam || 'Herberg');
  }

  // Diensten-knop active-state als een diensten-sectie actief is
  const DIENSTEN_SECTIONS = ['herberg', 'tweespalt', 'gock'];
  const dienstenBtn = document.getElementById('diensten-nav-btn');
  if (dienstenBtn) dienstenBtn.classList.toggle('active', DIENSTEN_SECTIONS.includes(state.activeSection));

  // Eigen-karakter-tabblad
  const myCharTab = document.querySelector('.section-tab[data-section="mijn-karakter"]');
  if (myCharTab) {
    myCharTab.classList.toggle('hidden', !isNamedPlayer);
    if (isNamedPlayer && state.playerName) {
      const firstName = state.playerName.split(' ')[0];
      const avatarUrl = api.fileUrl(state.characterId);
      myCharTab.innerHTML = `<img src="${avatarUrl}" class="nav-tab-avatar" alt="" onerror="this.style.display='none'">${esc(firstName)}`;
    } else {
      myCharTab.innerHTML = '🧑 Mijn karakter';
    }
  }

  // Verberg landing zodra iemand ingelogd is
  if (state.role === 'dm' || state.playerName) hideLanding();

  updateFab();
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
}

async function showLanding() {
  const overlay = document.getElementById('landing-overlay');
  if (!overlay) return;

  // Reset animatieklassen + eventuele overgebleven zoom-cirkel van vorige sessie
  overlay.classList.remove('hidden', 'landing-overlay--dimming', 'landing-overlay--out');
  document.getElementById('landing-zoom')?.remove();

  // Titels uit meta
  const titleEl    = document.getElementById('landing-title');
  const subtitleEl = document.getElementById('landing-subtitle');
  if (titleEl)    titleEl.textContent    = state.meta?.appTitle    || 'Grisburgh';
  if (subtitleEl) subtitleEl.textContent = state.meta?.appSubtitle || '';


  const list = document.getElementById('landing-portraits');
  if (!list) return;
  list.innerHTML = '<p class="landing-loading">Laden…</p>';

  try {
    const chars = await api.listPlayerChars();
    if (chars.length === 0) {
      list.innerHTML = '<p class="landing-loading">Geen spelerskarakters gevonden.</p>';
      return;
    }
    list.innerHTML = chars.map(c => {
      const sub = [c.ras, c.klasse].filter(Boolean).join(' · ');
      return `
        <div class="landing-portrait" onclick="window.app._landingPortraitClick('${esc(c.id)}', this)">
          <div class="landing-portrait-ring">
            <img src="/api/files/${esc(c.id)}" class="landing-portrait-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="landing-portrait-fallback" style="display:none">👤</div>
          </div>
          <div class="landing-portrait-name">${esc(c.name)}</div>
          ${sub ? `<div class="landing-portrait-sub">${esc(sub)}</div>` : ''}
        </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<p class="landing-loading">Fout bij laden.</p>';
  }
}

// ── Landing portret-klik animatie ──

async function _landingPortraitClick(charId, portraitEl) {
  // Voorkom dubbele klik
  if (document.getElementById('landing-zoom')) return;

  // Zelfde karakter binnen 15 minuten → animatie overslaan
  try {
    const lastLogin = JSON.parse(localStorage.getItem('_lastLogin') || 'null');
    if (lastLogin && lastLogin.charId === charId && Date.now() - lastLogin.ts < 15 * 60 * 1000) {
      document.getElementById('landing-overlay')?.classList.add('hidden');
      await playerLogin(charId);
      return;
    }
  } catch { /* ok */ }

  // 1. Andere portretten wegvallen + overlay-inhoud meteen verduisteren
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
      <img class="landing-zoom-img" src="/api/files/${esc(charId)}"
        onerror="this.style.display='none'">
      <video id="landing-zoom-video" class="landing-zoom-video" autoplay muted playsinline>
        <source src="/api/files/${esc(charId)}_video" type="video/mp4">
      </video>
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
  const vid = document.getElementById('landing-zoom-video');
  await new Promise(resolve => {
    const cap = setTimeout(resolve, 12_000); // 12s harde grens

    if (!vid) { clearTimeout(cap); setTimeout(resolve, 1000); return; }

    vid.addEventListener('ended', () => { clearTimeout(cap); resolve(); });

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

  // Landing nu volledig verbergen (vóór login-API, zodat er geen flits is)
  landingOverlay?.classList.add('hidden');
  zoom.remove();

  try { await playerLogin(charId); } catch { /* fout al getoond door playerLogin */ }
}

// ── Speler-karakter kiezer ──

// openPlayerPicker is vervangen door showLanding() — de 👤-knop brengt
// de speler terug naar de landingspagina om een personage te kiezen.
// closePlayerPicker blijft als no-op zodat bestaande aanroepen vanuit playerLogin werken.
function openPlayerPicker() { showLanding(); }
function closePlayerPicker() { /* panel niet meer in gebruik */ }

async function playerLogin(characterId) {
  try {
    const { playerName, characterId: cid } = await api.playerLogin(characterId);
    state.playerName  = playerName;
    state.characterId = cid;
    closePlayerPicker();
    applyRole();
    // Sla login op voor animatie-skip bij herlogin binnen 15 minuten
    try { localStorage.setItem('_lastLogin', JSON.stringify({ charId: cid, ts: Date.now() })); } catch { /* ok */ }
    // Registreer socket zodat DM directe berichten kan sturen
    if (cid && window._socket) window._socket.emit('player:register', cid);
    // Navigeer direct naar mijn-karakter → personage-subtab
    window._pendingPlayerSubTab = 'personage';
    switchSection('mijn-karakter');
  } catch (err) {
    alert('Inloggen mislukt: ' + err.message);
  }
}

async function playerLogout() {
  try {
    await api.playerLogout();
    state.playerName  = null;
    state.characterId = null;
    // Als we op het eigen tabblad waren, ga naar personages
    if (state.activeSection === 'mijn-karakter') switchSection('personages');
    applyRole();
    // Herlaad alles zodat anonieme weergave (leeg) geldt
    await refreshAll();
  } catch { /* ok */ }
}

// ── Modal ──
function openModal(title, subtitle, bodyHtml) {
  $('#m-title').textContent = title;
  $('#m-sub').textContent = subtitle;
  $('#m-body').innerHTML = bodyHtml;
  $('#modal-overlay').classList.add('active');
}

function closeModal() {
  $('#modal-overlay').classList.remove('active');
  // Reset navigatiehistory en tracking
  window._currentDetailTab = null;
  window._currentDetailId  = null;
  if (window._clearHistory) window._clearHistory();
  // Verberg shop-tooltip als die nog zichtbaar was
  document.getElementById('shop-item-tooltip')?.classList.add('hidden');
}

// ── Lightbox ──
let lbZoom    = 1;
let _lbImages = null;   // [{src, title}] of huidige reeks
let _lbIdx    = 0;

function _lbShowCurrent() {
  const entry = _lbImages?.[_lbIdx];
  if (!entry) return;
  lbZoom = 1;
  const img = $('#lb-img');
  img.src = entry.src;
  img.style.transform = '';
  $('#lb-title').textContent = entry.title || '';

  const multi = (_lbImages?.length || 0) > 1;
  const left  = $('#lb-nav-left');
  const right = $('#lb-nav-right');
  const cnt   = $('#lb-counter');
  if (left)  left.classList.toggle('hidden',  !multi || _lbIdx <= 0);
  if (right) right.classList.toggle('hidden', !multi || _lbIdx >= _lbImages.length - 1);
  if (cnt) {
    cnt.textContent = multi ? `${_lbIdx + 1} / ${_lbImages.length}` : '';
    cnt.classList.toggle('hidden', !multi);
  }
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

function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.add('hidden');
  lb.classList.remove('flex');
  $('#lb-img').src = '';
  _lbImages = null;
}

$('#lightbox').addEventListener('wheel', (e) => {
  e.preventDefault();
  lbZoom += e.deltaY > 0 ? -0.15 : 0.15;
  lbZoom = Math.max(0.5, Math.min(5, lbZoom));
  $('#lb-img').style.transform = `scale(${lbZoom})`;
});

document.addEventListener('keydown', (e) => {
  if ($('#lightbox').classList.contains('hidden')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   lbNavigate(-1);
  if (e.key === 'ArrowRight')  lbNavigate(1);
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
  let text = String(s).replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    const idx = _wlNames.length;
    _wlNames.push(name);
    return `${_WL_SEP}${idx}${_WL_SEP}`;
  });

  // ── Stap 2: Normale markdown-verwerking ──
  text = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Koppen moeten voor inline-markup zodat bold/italic erin werkt
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
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
  return `<a class="wikilink wikilink--${type}" data-wl-type="${type}" onclick="event.stopPropagation();window._openDetail('${type}','${id}')" title="${safeName}">${safeName}</a>`;
}

// ── Wikilink autocomplete ───────────────────────────────────────────
let _wlAcTriggerEl = null;

function _wlAcInit() {
  // Pre-laad alle entity-types in de naam-index zodat wikilinks direct werken,
  // ook als de bijbehorende sectie nog niet bezocht is.
  const WL_TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  Promise.all(WL_TYPES.map(t =>
    api.listEntities(t)
      .then(list => window._buildEntityIndex(t, list))
      .catch(() => {})
  ));

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
  ac.style.top   = (rect.bottom + window.scrollY + 4) + 'px';
  ac.style.width = Math.max(rect.width, 280) + 'px';
  ac.style.display = '';

  const ICONS = { personages:'👤', locaties:'🏰', organisaties:'🏛️', voorwerpen:'⚔️' };
  ac.innerHTML = matches.map((e, i) =>
    `<div class="wikilink-ac-item${i === 0 ? ' wikilink-ac-item--active' : ''}"
      onmousedown="event.preventDefault();window._wlAcSelect(${JSON.stringify(e.name)})">
      <span class="wikilink-ac-icon">${ICONS[e.type] || '📜'}</span>
      <span class="wikilink-ac-name">${esc(e.name)}</span>
    </div>`
  ).join('');

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
  renderParty();
};

// ── Groepswisselaar ──
window.renderGroupSwitcher = function(groups, activeGroupId) {
  _activeGroupId = activeGroupId;
  window._activeGroupId = activeGroupId; // toegankelijk voor andere modules (render-archief)
  window._groups = groups; // groepslijst voor naam-opzoeken
  const container = document.getElementById('group-switcher');
  if (!container) return;
  // Alleen zichtbaar in DM-modus
  const isDm = state.role === 'dm' && !state.dmPreview;
  container.classList.toggle('hidden', !isDm);
  if (!isDm) return;
  container.innerHTML = groups.map(g => `
    <span class="group-tab-wrap${g.active ? ' active' : ''}">
      <button class="group-tab${g.active ? ' active' : ''}"
        onclick="window.app.switchGroup('${esc(g.id)}')"
        title="${g.active ? 'Actieve groep' : 'Wissel naar deze groep'}"
      >${esc(g.name)}</button>
      <button class="group-tab-rename" onclick="window.app.renameGroup('${esc(g.id)}','${escJS(g.name)}')" title="Hernoemen">✎</button>
      ${groups.length > 1 ? `<button class="group-tab-del" onclick="window.app.deleteGroup('${esc(g.id)}')" title="Groep verwijderen">×</button>` : ''}
    </span>
  `).join('') + `
    <button class="group-tab-add" onclick="window.app.newGroup()" title="Nieuwe groep aanmaken">+</button>
  `;
};

async function switchGroup(groupId) {
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
  else if (section === 'logboek') await renderLogboek();
  else if (section === 'kaart') await _renderKaartSection();
  else if (section === 'relatiemap') await renderRelatiemap();
  else if (section === 'herberg') await renderHerberg();
  else if (section === 'tweespalt') await renderTweespalt();
  else if (section === 'gock') await renderGock();
  else if (section === 'mijn-karakter') await renderMijnKarakter();
  else if (section === 'spelers') await renderSpelersTab();
  else if (section === 'meesterkamer') { if (state.role === 'dm') window.dmPanel?.renderMeesterkamer?.(); }
}

// ── Kaart-sectie: toggle tussen Wereldkaarten en Dungeons ──
let _kaartMode = 'wereld'; // 'wereld' | 'dungeon'

async function _renderKaartSection() {
  const container = document.getElementById('section-kaart');
  if (!container) return;

  // Toggle-bar bovenaan; de inhoud eronder wordt gevuld door de sub-renderer
  container.innerHTML = `
    <div class="kaart-mode-bar">
      <button class="kaart-mode-btn ${_kaartMode==='wereld'?'active':''}" data-mode="wereld">
        🗺️ Kaarten
      </button>
      <button class="kaart-mode-btn ${_kaartMode==='dungeon'?'active':''}" data-mode="dungeon">
        ⛓️ Dungeons
      </button>
    </div>
    <div class="kaart-mode-content" id="kaart-mode-content" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;"></div>`;

  container.querySelectorAll('.kaart-mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      _kaartMode = btn.dataset.mode;
      container.querySelectorAll('.kaart-mode-btn').forEach(b => b.classList.toggle('active', b===btn));
      await _renderKaartContent();
    });
  });

  await _renderKaartContent();
}

async function _renderKaartContent() {
  const content = document.getElementById('kaart-mode-content');
  if (!content) return;
  if (_kaartMode === 'wereld') {
    // renderKaart werkt op #section-kaart; geef het de content-div
    content.innerHTML = '';
    // renderKaart verwacht section-kaart als container — we wrappen het tijdelijk
    const tmp = document.createElement('div');
    tmp.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;height:100%;';
    tmp.id = 'section-kaart-inner';
    content.appendChild(tmp);
    await renderKaart(tmp);
  } else {
    await renderDungeon(content);
  }
}

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
const _AB_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

let _playerSubTab    = localStorage.getItem('_playerSubTab') || 'party';
let _klasseThemeOn   = localStorage.getItem('_klasseThemeOn') !== 'false'; // standaard aan
let _playerSpellList = null;

function _fmtBerichtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

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

async function renderMijnKarakter(opts = {}) {
  const charId     = opts.charId     || state.characterId;
  const playerName = opts.playerName || state.playerName;
  const el         = opts.el         || document.getElementById('section-mijn-karakter');
  if (!el) return;
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
  try {
    [hpData, entity, combat, ownershipData, allVoorwerpen, soundsData, simpleItems, currency, partyCurrency, spellSlots, playerProfile, partyMembers, companions, trackers, pinnedSpells, pinnedTraits, { inspired }, berichtenLijst] = await Promise.all([
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
    ]);
  } catch { /* ok */ }

  // Sla unread bericht-teller op (niet resetten als berichten-tab open is)
  const unreadCount = berichtenLijst.filter(m => !m.gelezen).length;
  if (_playerSubTab !== 'berichten') window._berichtenUnread = unreadCount;

  // Sla eigen groep-id op zodat socket-events kunnen filteren
  window._myGroupId = entity?.data?.groep || null;

  // Bookmarks in state cachen zodat renderCard ze kan lezen
  state.bookmarks = Array.isArray(playerProfile.bookmarks) ? playerProfile.bookmarks : [];

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
  let _skillProfs = {};
  try { _skillProfs = JSON.parse(playerProfile.skillProfs || '{}'); } catch { _skillProfs = {}; }
  let _skillAdj = {};
  try { _skillAdj = JSON.parse(playerProfile.skillAdj || '{}'); } catch { _skillAdj = {}; }
  const _saveProfs  = new Set((playerProfile.saveProfs || '').split(',').filter(Boolean));
  const _profBonusNum = parseInt(playerProfile.profBonus) || 0;
  const _percProf     = _skillProfs['perception'] || null;
  const _passivePerc  = 10 + _mod('wis') + (_percProf === 'expert' ? _profBonusNum * 2 : _percProf === 'prof' ? _profBonusNum : 0);
  const _dsSucc = Math.min(3, Math.max(0, parseInt(playerProfile.deathSaveSuccesses) || 0));
  const _dsFail = Math.min(3, Math.max(0, parseInt(playerProfile.deathSaveFailures) || 0));
  const _skillBonus = (skill) => {
    const prof = _skillProfs[skill.key] || null;
    const adj  = _skillAdj[skill.key] || 0;
    return _mod(skill.ab) + (prof === 'expert' ? _profBonusNum * 2 : prof === 'prof' ? _profBonusNum : 0) + adj;
  };
  const _cNames = window._currency || state.meta?.currency || { fl: 'Florinde', kn: 'Knaker', cl: 'Centeling' };
  const isHp = state.meta?.skillSet === 'hp';

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
  const _themeAttr  = (_klasseThemeOn && _klasseKey) ? ` data-klasse="${esc(_klasseKey)}"` : '';

  el.innerHTML = `
    <div class="player-dashboard"${_themeAttr}>
      <!-- Karakter header (altijd zichtbaar) -->
      <div class="player-dash-hero" id="player-dash-hero" style="align-items:center">
        <div class="player-dash-avatar-outer">
          ${(() => {
            const _hR = 45, _hC = +(2 * Math.PI * 45).toFixed(1);
            const _hFill = hpPct > 0 ? +(_hC * hpPct / 100).toFixed(1) : 0;
            return `<svg class="player-dash-avatar-ring" viewBox="0 0 100 100" style="pointer-events:none">
              <circle cx="50" cy="50" r="${_hR}" class="party-hp-ring-bg"/>
              <circle cx="50" cy="50" r="${_hR}" class="party-hp-ring-fill party-hp-ring-${hpCls}"
                stroke-dasharray="${_hFill} ${_hC}" transform="rotate(-90 50 50)"/>
            </svg>`;
          })()}
          <div class="player-dash-avatar-wrap avatar-${hpCls}">
            <img src="${imgUrl}" class="player-dash-avatar"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="player-dash-avatar-fallback" style="display:none">👤</div>
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
                onblur="window._saveProfileField('level', this.value)"></div>
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
                onblur="window._saveProfileField('klasseLevel', this.value); window._updateMulticlassTheme()">` : ''}
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
                onblur="window._saveProfileField('multiKlasseLevel', this.value); window._updateMulticlassTheme()">
            </div>` : ''}
            <div class="ppf-row"><label class="ppf-label">${isHp ? 'School of Magic' : 'Subclass'}</label>
              <input class="ppf-input" type="text" value="${esc(playerProfile.subclass ?? '')}" placeholder="—"
                onblur="window._saveProfileField('subclass', this.value)"></div>
            <div class="ppf-row"><label class="ppf-label">Background</label>
              <input class="ppf-input" type="text" value="${esc(playerProfile.background ?? '')}" placeholder="—"
                onblur="window._saveProfileField('background', this.value)"></div>
            <div class="ppf-row"><label class="ppf-label">${isHp ? 'House' : 'Origin'}</label>
              <input class="ppf-input" type="text" value="${esc(playerProfile.origin ?? '')}" placeholder="—"
                onblur="window._saveProfileField('origin', this.value)"></div>
            ${isHp ? `<div class="ppf-row"><label class="ppf-label">Blood Status</label>
              <input class="ppf-input" type="text" value="${esc(playerProfile.bloodStatus ?? '')}" placeholder="—"
                onblur="window._saveProfileField('bloodStatus', this.value)"></div>` : ''}
          </div>
        </div>
        <div class="player-class-icon-outer">
          <div class="player-class-icon-wrap" id="player-class-icon-wrap"${_klasseKey ? ` onclick="window._toggleKlasseTheme()" title="${_klasseThemeOn ? 'Schakel naar standaard look' : 'Schakel naar klasse-look'}" style="cursor:pointer"` : ''}>
            ${_dominantKlasse && _KLASSEN_MET_ICON.has(_dominantKlasse) ? `<img src="/img/classes/${esc(_dominantKlasse)}.png" class="player-class-icon" alt="${esc(_dominantKlasse)}">` : ''}
          </div>
        </div>
      </div>

      <!-- Subtab nav -->
      <div class="player-subtabs">
        <button class="player-subtab${_playerSubTab === 'party' ? ' active' : ''}"
          data-tab="party" onclick="window._setPlayerSubTab('party')">🧙 Party</button>
        <button class="player-subtab${_playerSubTab === 'personage' ? ' active' : ''}"
          data-tab="personage" onclick="window._setPlayerSubTab('personage')">⚔️ Personage</button>
        <button class="player-subtab${_playerSubTab === 'knapzak' ? ' active' : ''}"
          data-tab="knapzak" onclick="window._setPlayerSubTab('knapzak')">🎒 Knapzak</button>
        <button class="player-subtab${_playerSubTab === 'spreukenboek' ? ' active' : ''}"
          data-tab="spreukenboek" onclick="window._setPlayerSubTab('spreukenboek')">📖 Spreukenboek</button>
        <button class="player-subtab${_playerSubTab === 'berichten' ? ' active' : ''}"
          data-tab="berichten" onclick="window._setPlayerSubTab('berichten')">💬 Berichten${window._berichtenUnread ? ` <span class="bericht-badge">${window._berichtenUnread}</span>` : ''}</button>
      </div>

      <!-- ═══ TAB: Party ═══ -->
      <div id="pst-party" class="player-subtab-panel${_playerSubTab !== 'party' ? ' hidden' : ''}">

        ${inspired ? `
        <div class="player-dash-section player-inspiration-section">
          <div class="player-dash-section-title">✨ Inspiratie</div>
          <div class="player-inspiration-block">
            <span class="player-inspiration-badge">✨ Je hebt inspiratie!</span>
            <button class="player-inspiration-use-btn" onclick="window._dashUseInspiration()">Gebruik</button>
          </div>
        </div>` : ''}

        <div class="player-dash-section">
          <div class="player-dash-section-title">🧙 Mijn party</div>
          <div class="player-dash-party-row">
            <!-- Zichzelf (altijd zichtbaar) -->
            ${(() => {
              const _ringR = 44, _ringC = +(2 * Math.PI * 44).toFixed(1);
              const _ringFill = hpPct > 0 ? +(_ringC * hpPct / 100).toFixed(1) : 0;
              return `<div class="party-portrait party-portrait--self">
              <div class="party-portrait-ring-wrap">
                <svg class="party-hp-ring" viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2">
                  <circle cx="50" cy="50" r="${_ringR}" class="party-hp-ring-bg"/>
                  <circle cx="50" cy="50" r="${_ringR}" class="party-hp-ring-fill party-hp-ring-${hpCls}"
                    stroke-dasharray="${_ringFill} ${_ringC}" transform="rotate(-90 50 50)"/>
                </svg>
                <div class="party-portrait-avatar-wrap avatar-${hpCls}">
                  <img src="${imgUrl}" class="party-portrait-img"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div class="party-portrait-fallback" style="display:none">👤</div>
                </div>
              </div>
              <div class="party-portrait-name">${esc(playerName.split(' ')[0])}</div>
              <div class="party-portrait-sub">${hp !== '—' ? `${hp} / ${maxHp} HP` : '—'}</div>
              ${inspired ? '<div class="party-portrait-badge">✨</div>' : ''}
            </div>`;
            })()}
            ${partyMembers.length > 0 ? '<div class="party-bar-divider"></div>' : ''}
            ${partyMembers.map(e => {
              const pImgUrl   = api.fileUrl(e.id);
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
                    <div class="party-portrait-fallback" style="display:none">👤</div>
                  </div>
                </div>
                <div class="party-portrait-name">${firstName}</div>
                ${psub ? `<div class="party-portrait-sub">${esc(psub)}</div>` : ''}
              </div>`;
            }).join('')}
            ${companions.length > 0 ? '<div class="party-bar-divider"></div>' : ''}
            ${companions.map(e => {
              const pImgUrl   = api.fileUrl(e.id);
              const firstName = esc(e.name.split(' ')[0]);
              const psub      = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
              return `<div class="party-portrait party-portrait--companion" onclick="window._openDetail('personages','${esc(e.id)}')">
                <div class="party-portrait-avatar-wrap">
                  <img src="${pImgUrl}" class="party-portrait-img"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div class="party-portrait-fallback" style="display:none">🗡️</div>
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
          <div class="player-dash-section-title">⚔️ Initiativevolgorde</div>
          <div class="player-dash-init-list">
            ${(combat.combatants || []).map((c, i) => {
              const isActive = i === combat.currentTurn;
              const isMe = c.entityId === charId || c.name === playerName;
              const displayName = c.type === 'player' ? c.name.split(' ')[0] : c.name;
              return `<div class="player-dash-init-row${isActive ? ' player-dash-init-active' : ''}${isMe ? ' player-dash-init-me' : ''}">
                <span class="player-dash-init-num">${i + 1}</span>
                <span class="player-dash-init-name">${esc(displayName)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- ═══ TAB: Mijn personage ═══ -->
      <div id="pst-personage" class="player-subtab-panel${_playerSubTab !== 'personage' ? ' hidden' : ''}">

        ${_dominantKlasse.toLowerCase().includes('sorcerer') ? `
        <div class="player-dash-section wild-magic-section">
          <div class="player-dash-section-title">🌀 Wild Magic Surge</div>
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
            <span class="pcs-label">Hit Die</span>
            <input class="pcs-input" type="text"
              value="${esc(playerProfile.hitDie ?? '')}" placeholder="—"
              onblur="window._saveProfileField('hitDie', this.value)">
          </div>
          <div class="pcs-item">
            <span class="pcs-label">Pass. Perc</span>
            <div class="pcs-value">${_passivePerc}</div>
          </div>
        </div>

        <!-- HP blok (redesigned) -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">❤️ HP</div>
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
            ${myCombatant ? '<p class="player-dash-hp-note">⚔️ Actief in gevecht</p>' : ''}
          </div>
        </div>

        <!-- Weapons & Damage Cantrips -->
        <div class="player-dash-section">
          <div class="player-dash-section-title player-dash-section-title--with-btn">
            ⚔️ Weapons &amp; Damage Cantrips
            <button class="player-weapon-add-btn" onclick="window._addWeapon()" title="Voeg wapen toe">+</button>
          </div>
          ${weapons.length > 0 ? `
          <div class="player-weapons-table">
            <div class="player-weapons-header">
              <span class="pwh-name">Naam</span>
              <span class="pwh-atk">Aanval / DC</span>
              <span class="pwh-dmg">Schade &amp; Type</span>
              <span class="pwh-notes">Notities</span>
              <span class="pwh-del"></span>
            </div>
            ${weapons.map((w, i) => `
            <div class="player-weapon-row">
              <input class="pw-input pw-name" type="text" value="${esc(w.name || '')}" placeholder="Rapier, Fire Bolt…"
                onblur="window._saveWeapon(${i},'name',this.value)">
              <input class="pw-input pw-atk" type="text" value="${esc(w.atk || '')}" placeholder="+5 / DC 14"
                onblur="window._saveWeapon(${i},'atk',this.value)">
              <input class="pw-input pw-dmg" type="text" value="${esc(w.dmg || '')}" placeholder="1d8+3 Piercing"
                onblur="window._saveWeapon(${i},'dmg',this.value)">
              <input class="pw-input pw-notes" type="text" value="${esc(w.notes || '')}" placeholder="Finesse, magic…"
                onblur="window._saveWeapon(${i},'notes',this.value)">
              <button class="pw-del-btn" onclick="window._deleteWeapon(${i})" title="Verwijder">×</button>
            </div>`).join('')}
          </div>` : `
          <p class="player-weapons-empty">Nog geen wapens toegevoegd. Klik + om te beginnen.</p>`}
        </div>

        <!-- Ability Scores + Saving Throws -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">🎲 Ability Scores</div>
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
                    <span class="player-ability-mod">${_modStr(ab)}</span>
                  </div>
                  <button class="player-save-dot${isProf ? ' active' : ''}"
                    onclick="window._toggleSaveProf('${ab}', ${!isProf})"
                    title="Saving throw: ${saveBonusStr}">
                  </button>
                  <span class="player-save-val">${saveBonusStr}</span>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Skills -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">🎯 Skills</div>
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
                <span class="player-skill-name">${skill.label}</span>
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
          <summary class="player-dash-section-title">🛡️ Proficiencies</summary>
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
          <summary class="player-dash-section-title">🌐 Talen & Zintuigen</summary>
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
          <div class="player-dash-section-title">⚡ Actieve statussen</div>
          <div class="player-dash-conditions">
            ${conditions.map(cid => {
              const COND_LABELS = {
                blinded:'Verblind', charmed:'Betoverd', deafened:'Doof', exhaustion:'Uitputting',
                frightened:'Bevreesd', grappled:'Vastgegrepen', incapacitated:'Buiten gevecht',
                invisible:'Onzichtbaar', paralyzed:'Verlamd', petrified:'Versteend',
                poisoned:'Vergiftigd', prone:'Neergevallen', restrained:'Vastgehouden',
                stunned:'Verdoofd', unconscious:'Bewusteloos', concentration:'Concentratie'
              };
              return `<span class="player-dash-cond-chip">${esc(COND_LABELS[cid] || cid)}</span>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Kenmerken & Eigenschappen -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">
            📜 Kenmerken & Eigenschappen
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
              const m = (t.meta || '').match(/Niv\.\s*(\d+)/i);
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
          <div class="player-dash-section-title">🎭 Emotes${isMyTurn ? ' <span class="player-dash-emote-turn-hint">— jouw beurt!</span>' : ''}</div>
          <div class="player-dash-emote-btns">
            ${displayEmotes.map(e => `
              <button class="player-dash-emote-btn" onclick="window._dashEmote('${esc(e.id)}')" title="${esc(e.label || '')}">
                ${e.icon  ? `<span class="emote-btn-icon">${esc(e.icon)}</span>`  : ''}
                ${e.label ? `<span class="emote-btn-text">${esc(e.label)}</span>` : ''}
              </button>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- ═══ TAB: Mijn knapzak ═══ -->
      <div id="pst-knapzak" class="player-subtab-panel${_playerSubTab !== 'knapzak' ? ' hidden' : ''}">

        <!-- Valuta -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">
            💰 Beurs
            ${partyCurrency.enabled ? '<span class="currency-shared-badge">🤝 Gedeeld</span>' : ''}
          </div>
          <div class="player-dash-currency-new">
            <div class="player-currency-item player-currency-gold">
              <span class="player-currency-coin">🟡</span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.fl || 'Florinde')}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-fl"
                  value="${partyCurrency.enabled ? partyCurrency.fl : currency.fl}"
                  onblur="window._dashCurrencySave()">
              </div>
            </div>
            <div class="player-currency-item player-currency-silver">
              <span class="player-currency-coin">⚪</span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.kn || 'Knaker')}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-kn"
                  value="${partyCurrency.enabled ? partyCurrency.kn : currency.kn}"
                  onblur="window._dashCurrencySave()">
              </div>
            </div>
            <div class="player-currency-item player-currency-copper">
              <span class="player-currency-coin">🟤</span>
              <div class="player-currency-body">
                <span class="player-currency-name">${esc(_cNames.cl || 'Centeling')}</span>
                <input class="player-currency-input" type="number" min="0" id="dash-cur-cl"
                  value="${partyCurrency.enabled ? partyCurrency.cl : currency.cl}"
                  onblur="window._dashCurrencySave()">
              </div>
            </div>
          </div>
        </div>

        <!-- Geclaimde & losse voorwerpen -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">🎒 Jouw voorwerpen</div>
          ${myItems.length > 0 ? (() => {
            const _ITEM_CATS = [
              { key: 'Wapen',     label: 'Wapens',     icon: '⚔️' },
              { key: 'Uitrusting',label: 'Uitrusting',  icon: '🛡️' },
              { key: 'Toveritem', label: 'Toveritems',  icon: '✨' },
              { key: 'Drank',     label: 'Drankjes',    icon: '🧪' },
              { key: 'Scroll',    label: 'Scrolls',     icon: '📜' },
              { key: 'Ring',      label: 'Ringen',      icon: '💍' },
              { key: 'Amulet',    label: 'Amuletten',   icon: '📿' },
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
            const _mdInline = s => s
              .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>')
              .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
              .replace(/\n/g,'<br>');
            const _renderCarouselSlide = (item) => {
              if (!item) return '<div class="item-carousel-slide"><p style="color:#8a7050;font-style:italic">Geen voorwerpen</p></div>';
              const iImgUrl = api.fileUrl(item.id);
              const typeIcon = _ITEM_CATS.find(c => c.key === (item.data?.itemType || item.subtype || ''))?.icon || '📦';
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
                  <div class="item-charge-label">⚡ Charges: ${item._charges}/${item._maxCharges}</div>
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
              return `<div class="item-carousel-slide">
                <div class="item-carousel-img-wrap" onclick="window._openDetail('voorwerpen','${esc(item.id)}')" title="Bekijk kaartje" style="cursor:pointer">
                  <img src="${iImgUrl}" class="item-carousel-img"
                    onerror="this.closest('.item-carousel-img-wrap').style.display='none'">
                </div>
                <div class="item-carousel-namerow">
                  <span class="item-carousel-type-icon">${typeIcon}</span>
                  <span class="item-carousel-name">${esc(item.name)}</span>
                </div>
                ${desc ? `<div class="item-carousel-desc">${_mdInline(desc)}</div>` : ''}
                ${qtyHtml}
                ${chargesHtml}
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
          ${simpleItems.length > 0 ? `
          <ul class="player-dash-simple-list">
            ${simpleItems.map(si => `
              <li class="player-dash-simple-item">
                <span class="player-dash-simple-name">${esc(si.name)}</span>
                ${si.note ? `<span class="player-dash-simple-note">${esc(si.note)}</span>` : ''}
                ${si.entityId ? `<button class="herberg-bubble-card-btn" style="margin-left:4px;font-size:0.65rem;padding:1px 4px;line-height:1.3;" onclick="window._openDetail('${esc(si.entityType)}','${esc(si.entityId)}')" title="Open kaartje">↗</button>` : ''}
                <button class="player-dash-simple-del" onclick="window._dashRemoveItem('${esc(si.id)}')" title="Verwijder">×</button>
              </li>`).join('')}
          </ul>` : ''}
          ${myItems.length === 0 && simpleItems.length === 0 ? '<p class="player-dash-empty">Nog geen voorwerpen.</p>' : ''}
          <div class="player-dash-add-item">
            <input id="dash-item-name" class="player-dash-add-item-input" type="text"
              placeholder="Naam voorwerp…" maxlength="80">
            <input id="dash-item-note" class="player-dash-add-item-note" type="text"
              placeholder="Notitie (optioneel)" maxlength="500">
            <button class="player-dash-add-item-btn" onclick="window._dashAddItem()">+</button>
          </div>
        </div>
      </div>

      <!-- ═══ TAB: Mijn spreukenboek ═══ -->
      <div id="pst-spreukenboek" class="player-subtab-panel${_playerSubTab !== 'spreukenboek' ? ' hidden' : ''}">

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
            <input class="player-spell-stat-input" type="number" min="-5" max="20"
              value="${esc(playerProfile.spellAttackBonus ?? '')}" placeholder="—"
              onblur="window._saveProfileField('spellAttackBonus', this.value)">
          </div>
        </div>

        <!-- Spreukenslots -->
        <div class="player-dash-section player-dash-spellslots">
          <div class="player-dash-section-title">🔮 Spreukenslots</div>
          ${_spellSlotsHTML.rows || '<p class="player-dash-empty">Nog geen spreukenslots ingesteld.</p>'}
          <button class="player-dash-slot-add-btn" onclick="window._dashSlotAddLevel()">+</button>
        </div>

        <!-- Spreuk zoeken & vastzetten -->
        <div class="player-dash-section">
          <div class="player-dash-section-title">
            📖 Spreukzoeker
            <button class="player-trait-add-btn" onclick="window._playerSpellCustomOpen()" title="Eigen spreuk invoeren">+</button>
          </div>
          <div class="player-spell-search-wrap">
            <input id="player-spell-input" class="player-spell-search-input" type="text"
              placeholder="Zoek spreuk…" autocomplete="off"
              oninput="window._playerSpellSearch(this.value)">
            <div id="player-spell-results" class="player-spell-results"></div>
          </div>
          <!-- Eigen spreuk formulier -->
          <div id="player-spell-custom-form" class="player-trait-custom-form hidden">
            <input id="pscf-name"   class="player-trait-form-input" type="text" placeholder="Naam spreuk" maxlength="80">
            <div style="display:flex;gap:8px">
              <select id="pscf-level" class="player-trait-form-input" style="flex:0 0 auto">
                ${[0,1,2,3,4,5,6,7,8,9].map(l => `<option value="${l}">${l === 0 ? 'Cantrip' : 'Niv. ' + l}</option>`).join('')}
              </select>
              <input id="pscf-school"  class="player-trait-form-input" type="text" placeholder="School (optioneel)" maxlength="40" style="flex:1">
            </div>
            <textarea id="pscf-desc"  class="player-trait-form-ta" placeholder="Beschrijving (optioneel)" rows="3"></textarea>
            <div class="player-trait-form-btns">
              <button class="player-trait-form-save" onclick="window._playerSpellCustomSave()">Opslaan</button>
              <button class="player-trait-form-cancel" onclick="window._playerSpellCustomClose()">Annuleer</button>
            </div>
          </div>
          ${pinnedSpells.length > 0 ? (() => {
            // Groepeer op niveau
            const _sorted = [...pinnedSpells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
            const _groups = {};
            _sorted.forEach(s => {
              const k = s.level === 0 ? 0 : s.level;
              if (!_groups[k]) _groups[k] = [];
              _groups[k].push(s);
            });
            const _levelKeys = Object.keys(_groups).map(Number).sort((a,b) => a - b);

            // Level-filter chips
            const _lvlChips = `<div class="spell-level-filter" id="spell-level-filter">
              <button class="spell-lvl-chip spell-lvl-chip--active" data-lvl="" onclick="window._filterSpellLevel(null, this)">Alle</button>
              ${_levelKeys.map(k => `<button class="spell-lvl-chip" data-lvl="${k}" onclick="window._filterSpellLevel(${k}, this)">${k === 0 ? 'Cantrip' : k}</button>`).join('')}
            </div>`;

            const _spellHtml = _levelKeys.map(k => {
              const _levelLabel = k === 0 ? 'Cantrips' : `Niveau ${k}`;
              return `<div class="spell-level-group" data-level-group="${k}">
                <div class="spell-level-group-header">${_levelLabel}</div>
                ${_groups[k].map(s => `
                  <details class="player-spell-accordion">
                    <summary class="player-pinned-spell-summary">
                      <span class="player-pinned-spell-chevron">▾</span>
                      <span class="player-pinned-spell-name">${esc(s.name)}</span>
                      <span class="player-pinned-spell-meta">${s.school ? esc(s.school) : ''}</span>
                      ${s.concentration ? '<span class="spell-badge spell-badge--conc" title="Vereist concentratie">C</span>' : ''}
                      ${s.ritual ? '<span class="spell-badge spell-badge--ritual" title="Ritueel">R</span>' : ''}
                      <button class="player-pinned-spell-del"
                        onclick="event.preventDefault();event.stopPropagation();window._playerSpellUnpin('${esc(s.index)}')"
                        title="Verwijder">×</button>
                    </summary>
                    <div class="player-spell-accordion-body" data-spell-index="${esc(s.index)}" data-spell-source="${esc(s.source||'')}" data-spell-desc="${esc(s.desc||'')}" data-loaded="false">
                      <p class="player-spell-loading-text">Laden…</p>
                    </div>
                  </details>`).join('')}
              </div>`;
            }).join('');

            return _lvlChips + `<div class="player-pinned-spells">${_spellHtml}</div>`;
          })() : '<p class="player-dash-empty" style="margin-top:8px">Nog geen spreuken vastgezet.</p>'}
        </div>
      </div>

      <!-- ═══ TAB: Berichten ═══ -->
      <div id="pst-berichten" class="player-subtab-panel${_playerSubTab !== 'berichten' ? ' hidden' : ''}">

        <!-- Bladwijzers -->
        ${(state.bookmarks || []).length > 0 ? `
        <div class="player-dash-section">
          <div class="player-dash-section-title">⭐ Bladwijzers</div>
          <div class="player-bookmarks-list">
            ${(state.bookmarks || []).map(b => `
              <div class="player-bookmark-item" data-bid="${esc(b.id)}" onclick="window._navigateTo('${esc(b.type)}','${esc(b.name)}')">
                <span class="player-bookmark-icon">${b.type === 'personages' ? '👤' : b.type === 'locaties' ? '🏰' : b.type === 'organisaties' ? '🏛️' : '🎺'}</span>
                <span class="player-bookmark-name">${esc(b.name)}</span>
                <button class="player-bookmark-remove" onclick="event.stopPropagation();window._toggleBookmark('${esc(b.type)}','${esc(b.id)}','${esc(b.name)}')" title="Verwijderen">✕</button>
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
              <div class="player-dash-section-title">✉️ Brieven & berichten</div>
              ${brieven.map(m => `
                <div class="speler-brief-card${m.gelezen ? '' : ' speler-brief-card--nieuw'}" data-mid="${esc(m.id)}" onclick="window._briefToggle('${esc(m.id)}')">
                  <div class="speler-brief-header">
                    <div class="speler-brief-header-main">
                      ${m.titel ? `<div class="speler-brief-titel">${esc(m.titel)}</div>` : ''}
                      ${m.afzender ? `<div class="speler-brief-afzender-inline">van <em>${esc(m.afzender)}</em></div>` : ''}
                      <div class="speler-brief-meta-inline">${m.datum ? m.datum : _fmtBerichtDate(m.timestamp)}${m.gelezen ? '' : ' · <strong>nieuw</strong>'}</div>
                    </div>
                    <span class="speler-brief-chevron">▾</span>
                    <button class="bericht-del-btn speler-brief-trash" title="Weggooien" onclick="event.stopPropagation();window._briefPlayerDelete('${esc(m.id)}')">🗑</button>
                  </div>
                  <div class="speler-brief-body">
                    ${m.afzender ? `<div class="speler-brief-afzender">
                      Van: <em>${esc(m.afzender)}</em>${m.entityId ? ` <button class="herberg-bubble-card-btn" style="font-size:0.65rem;padding:1px 4px;line-height:1.3;margin-left:3px" onclick="event.stopPropagation();window._openDetail('${esc(m.entityType)}','${esc(m.entityId)}')" title="Open kaartje">↗</button>` : ''}
                    </div>` : ''}
                    <div class="speler-brief-tekst">${esc(m.tekst).replace(/\n/g, '<br>')}</div>
                  </div>
                </div>`).join('')}
            </div>`;
          }

          // Gewone geheime berichten (tekstbubbles)
          if (berichten.length > 0) {
            out += `<div class="player-dash-section">
              <div class="player-dash-section-title">💬 Geheime berichten</div>
              ${berichten.slice().reverse().map(m => `
                <div class="speler-bericht-item${m.gelezen ? '' : ' speler-bericht-item--nieuw'}"
                  data-mid="${esc(m.id)}" onclick="window._berichtMarkGelezen('${esc(m.id)}')">
                  <div class="speler-bericht-row">
                    <div class="speler-bericht-tekst">${esc(m.tekst)}</div>
                    <button class="bericht-del-btn" title="Verwijder" onclick="event.stopPropagation();window._berichtPlayerDelete('${esc(m.id)}')">✕</button>
                  </div>
                  <div class="speler-bericht-meta">${_fmtBerichtDate(m.timestamp)}${m.gelezen ? '' : ' · <strong>nieuw</strong>'}</div>
                </div>`).join('')}
            </div>`;
          }

          if (brieven.length === 0 && berichten.length === 0) {
            out += `<div class="player-dash-section">
              <div class="player-dash-section-title">💬 Berichten</div>
              <p class="player-dash-empty">Nog geen berichten ontvangen.</p>
            </div>`;
          }

          return out;
        })()}
      </div>

    </div>`;

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
        body.innerHTML = stored
          ? `<div class="player-spell-desc">${esc(stored).replace(/\n/g,'<br>')}</div>`
          : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>';
        body.dataset.loaded = 'true';
        return;
      }
      try {
        let s;
        if (_isHpCampaign()) {
          if (!_playerSpellList) {
            const r = await fetch('/data/hp-spells.json');
            const d = await r.json();
            _playerSpellList = d.results || [];
          }
          s = _playerSpellList.find(sp => sp.index === index) || {};
        } else {
          const r = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`);
          s = await r.json();
        }
        const _md = t => t
          .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>');
        const desc = (s.desc || []).map(_md).join('<br><br>');
        const higher = s.higher_level?.length
          ? `<p class="player-spell-higher"><strong>Op hogere niveaus:</strong> ${s.higher_level.join(' ')}</p>` : '';
        const metaParts = [
          s.casting_time ? `Spreektijd: ${s.casting_time}` : '',
          s.range        ? `Bereik: ${s.range}` : '',
          s.components?.length ? `Comp.: ${s.components.join(', ')}` : '',
          s.duration     ? `Duur: ${s.duration}` : '',
          s.concentration ? 'Concentratie' : '',
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
          <button class="trait-note-icon-btn" onclick="window._traitNoteEdit('${esc(traitId)}')" title="Bewerken">✏️</button>
          <button class="trait-note-icon-btn trait-note-icon-del" onclick="window._traitNoteDelete('${esc(traitId)}')" title="Verwijderen">🗑️</button>
        </div>
      </div>` : `
        <button class="trait-note-icon-btn" onclick="window._traitNoteEdit('${esc(traitId)}')" title="Opmerking toevoegen">📝</button>
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

      if (source === 'custom') {
        body.innerHTML = stored
          ? `<div class="player-spell-desc">${esc(stored).replace(/\n/g,'<br>')}</div>`
          : '<p class="player-spell-err" style="opacity:.5">Geen beschrijving.</p>';
        body.dataset.loaded = 'true';
        _appendTraitUsesRow(body);
        _appendTraitNoteSection(body);
        return;
      }
      // PHB: ophalen via dnd5eapi — source bepaalt endpoint
      try {
        if (!index) throw new Error('geen index');
        // Backward compat: 'phb' → features, 'phb-features' → features, 'phb-traits' → traits, 'phb-feats' → feats
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
            f.class?.name ? `Klasse: ${f.class.name}` : '',
            f.subclass?.name ? `Subklasse: ${f.subclass.name}` : '',
            f.level ? `Niveau ${f.level}` : '',
          ].filter(Boolean);
        } else if (apiType === 'traits') {
          const races = (f.races || []).map(x => x.name).join(', ');
          if (races) metaParts = [`Ras: ${races}`];
        } else if (apiType === 'feats') {
          const prereq = (f.prerequisites || []).map(p => p.ability_score?.name || '').filter(Boolean);
          if (prereq.length) metaParts = [`Vereiste: ${prereq.join(', ')}`];
        }
        body.innerHTML = `
          ${metaParts.length ? `<div class="player-spell-meta2">${metaParts.join(' · ')}</div>` : ''}
          <div class="player-spell-desc">${desc || '<em>Geen beschrijving beschikbaar.</em>'}</div>`;
        body.dataset.loaded = 'true';
        _appendTraitUsesRow(body);
        _appendTraitNoteSection(body);
      } catch {
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

  window._playerTraitDelete = async function(traitId) {
    if (!charId) return;
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
    } catch (e) { console.warn('Profiel opslaan mislukt', e); }
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
    // Icon
    const wrap = document.getElementById('player-class-icon-wrap');
    if (wrap) {
      if (dominant && _KLASSEN_MET_ICON.has(dominant)) {
        wrap.innerHTML = `<img src="/img/classes/${dominant}.png" class="player-class-icon" alt="${dominant}">`;
      } else {
        wrap.innerHTML = '';
      }
    }
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
    weapons.push({ name: '', atk: '', dmg: '', notes: '' });
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
    const icon   = hero?.querySelector('.player-class-icon-wrap');
    const collapsed = localStorage.getItem('_heroCollapsed') === '1';
    if (collapsed) {
      localStorage.setItem('_heroCollapsed', '0');
      if (fields) fields.style.display = '';
      if (icon)   icon.style.display   = '';
      if (btn)  { btn.textContent = '▲'; btn.classList.remove('collapsed'); }
    } else {
      localStorage.setItem('_heroCollapsed', '1');
      if (fields) fields.style.display = 'none';
      if (icon)   icon.style.display   = 'none';
      if (btn)  { btn.textContent = '▼'; btn.classList.add('collapsed'); }
    }
  };

  // Herstel collapse-staat na render
  if (localStorage.getItem('_heroCollapsed') === '1') {
    setTimeout(() => {
      const hero  = document.getElementById('player-dash-hero');
      const fields = hero?.querySelector('.player-profile-fields');
      const icon   = hero?.querySelector('.player-class-icon-wrap');
      if (fields) fields.style.display = 'none';
      if (icon)   icon.style.display   = 'none';
    }, 0);
  }

  // ── Subtab switcher ──
  window._setPlayerSubTab = function(tab) {
    _playerSubTab = tab;
    localStorage.setItem('_playerSubTab', tab);
    ['party', 'personage', 'knapzak', 'spreukenboek', 'berichten'].forEach(t => {
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
  };

  // ── Pending subtab na login (wordt gezet door playerLogin) ──
  if (window._pendingPlayerSubTab) {
    window._setPlayerSubTab(window._pendingPlayerSubTab);
    window._pendingPlayerSubTab = null;
  }

  // ── Knapzak carousel navigatie ──
  (function() {
    const _ITEM_CATS_ORDER = ['Wapen','Uitrusting','Toveritem','Drank','Scroll','Ring','Amulet'];
    const _catIconMap = { Wapen:'⚔️', Uitrusting:'🛡️', Toveritem:'✨', Drank:'🧪', Scroll:'📜', Ring:'💍', Amulet:'📿' };

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

      const iImgUrl   = api.fileUrl(item.id);
      const typeIcon  = _catIconMap[item.data?.itemType || item.subtype || ''] || '📦';
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
          <div class="item-charge-label">⚡ Charges: ${item._charges}/${item._maxCharges}</div>
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

      track.innerHTML = `<div class="item-carousel-slide">
        <div class="item-carousel-img-wrap" onclick="window._openDetail('voorwerpen','${esc(item.id)}')" title="Bekijk kaartje" style="cursor:pointer">
          <img src="${iImgUrl}" class="item-carousel-img"
            onerror="this.closest('.item-carousel-img-wrap').style.display='none'">
        </div>
        <div class="item-carousel-namerow">
          <span class="item-carousel-type-icon">${typeIcon}</span>
          <span class="item-carousel-name">${esc(item.name)}</span>
        </div>
        ${desc ? `<div class="item-carousel-desc">${_mdI(desc)}</div>` : ''}
        ${qtyHtml}
        ${chargesHtml}
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
    const wrap = document.getElementById('player-class-icon-wrap');
    if (dash) {
      if (_klasseThemeOn && _klasseKey) dash.setAttribute('data-klasse', _klasseKey);
      else dash.removeAttribute('data-klasse');
    }
    if (wrap) wrap.title = _klasseThemeOn ? 'Schakel naar standaard look' : 'Schakel naar klasse-look';
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
    // Laad SRD/HP-lijst
    if (!_playerSpellList) {
      resultsEl.innerHTML = '<div class="player-spell-loading">Laden…</div>';
      try {
        const url = _isHpCampaign() ? '/data/hp-spells.json' : 'https://www.dnd5eapi.co/api/spells';
        const r = await fetch(url);
        const d = await r.json();
        _playerSpellList = d.results || [];
      } catch { _playerSpellList = []; }
    }
    // Laad aanvullende spreuklijst (non-SRD)
    if (!_extraSpellList) {
      try {
        const r = await fetch('/data/extra-spells.json');
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
      // Kijk eerst in de extra-lijst (non-SRD, volledig opgeslagen)
      const extraSpell = (_extraSpellList || []).find(s => s.index === index);
      if (extraSpell) {
        const desc = (extraSpell.desc || []).join('\n\n');
        const concentration = String(extraSpell.duration || '').toLowerCase().includes('concentratie');
        await api.addPlayerSpell(charId, {
          index, name, level: extraSpell.level || 0,
          school: extraSpell.school?.name || '',
          source: 'extra', desc, concentration, ritual: false,
        });
        renderMijnKarakter(opts);
        return;
      }
      // SRD-spreuk: haal volledige data op voor concentratie/ritueel
      const spell = (_playerSpellList || []).find(s => s.index === index) || { level: 0, school: {} };
      let concentration = false, ritual = false;
      try {
        const full = await fetch(`https://www.dnd5eapi.co/api/spells/${index}`).then(r => r.json());
        concentration = String(full.duration || '').toLowerCase().includes('concentration');
        ritual = !!full.ritual;
      } catch { /* ok, geen badges */ }
      await api.addPlayerSpell(charId, {
        index, name, level: spell.level || 0, school: spell.school?.name || '',
        concentration, ritual,
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
    ['pscf-name','pscf-school','pscf-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const lvl = document.getElementById('pscf-level');
    if (lvl) lvl.value = '0';
  };

  window._playerSpellCustomSave = async function() {
    if (!charId) return;
    const name  = document.getElementById('pscf-name')?.value?.trim();
    const level = parseInt(document.getElementById('pscf-level')?.value) || 0;
    const school = document.getElementById('pscf-school')?.value?.trim() || '';
    const desc  = document.getElementById('pscf-desc')?.value?.trim() || '';
    if (!name) return;
    const index = 'custom_' + Date.now();
    await api.addPlayerSpell(charId, { index, name, level, school, source: 'custom', desc });
    window._playerSpellCustomClose();
    renderMijnKarakter(opts);
  };

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
          const r = await fetch('/data/hp-spells.json');
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
        `${levelStr} · ${schoolNl} · ${s.casting_time || ''} · Bereik: ${s.range || ''}`,
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
        lblEls.forEach(l => l.textContent = finalLbl);
        _history.unshift(histEntry);
        if (_history.length > 10) _history.pop();
        _renderHistory();
      }
    };
    tick();
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

    roll(sides) {
      const result   = Math.floor(Math.random() * sides) + 1;
      const numEls   = _els('result-num');
      const lblEls   = _els('result-label');
      const boxEls   = _els('result');
      if (!numEls.length) return;
      const dieLabel = sides === 100 ? 'd%' : `d${sides}`;
      const isCrit   = sides === 20 && result === 20;
      const isFumble = sides === 20 && result === 1;
      const lbl      = isCrit   ? `${dieLabel} \u2014 \u2736 Critical Hit!`
                     : isFumble ? `${dieLabel} \u2014 \u2715 Critical Fail!`
                     :             dieLabel;
      _animate(numEls, lblEls, boxEls,
        () => Math.floor(Math.random() * sides) + 1,
        result, lbl,
        { sides, result, count: 1, crit: isCrit, fumble: isFumble });
    },

    rollDm(sides) {
      if (_dmCount === 1) { this.roll(sides); return; }
      const count  = _dmCount;
      const rolls  = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const total  = rolls.reduce((a, b) => a + b, 0);
      const numEls = _els('result-num');
      const lblEls = _els('result-label');
      const boxEls = _els('result');
      if (!numEls.length) return;
      const dieLabel = sides === 100 ? 'd%' : `d${sides}`;
      const min = count, max = count * sides;
      _animate(numEls, lblEls, boxEls,
        () => Math.floor(Math.random() * (max - min + 1)) + min,
        total, `${count}${dieLabel} \u2014 ${rolls.join(' + ')}`,
        { sides, result: total, count, rolls, crit: false, fumble: false });
    },
  };

  function _renderHistory() {
    const html = _history.map(({ sides, result, count = 1, crit, fumble }) => {
      const cls = crit ? ' dice-hist-crit' : fumble ? ' dice-hist-fumble' : '';
      const lbl = sides === 100 ? '%' : sides;
      const pfx = count > 1 ? `${count}d` : 'd';
      return `<span class="dice-hist-chip${cls}">${pfx}${lbl}\u00b7${result}</span>`;
    }).join('');
    _els('history').forEach(el => { el.innerHTML = html; });
  }
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

window.app._globalSearchRun = async function(q) {
  const resultsEl = document.getElementById('global-search-results');
  if (!q.trim()) { resultsEl.innerHTML = ''; return; }

  const TYPES = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const meta  = window._entityTypeMeta || {};
  const cache = window._entityCache    || {};
  const filter = window._entityFilter  || (() => []);

  // Fetch documenten eenmalig
  if (!_archiefCache) {
    try { const r = await api.listArchief(); _archiefCache = r.documents || r || []; }
    catch { _archiefCache = []; }
  }

  let html = '';
  const ql = q.toLowerCase();

  // Entiteiten per type
  for (const type of TYPES) {
    if (_gsTypeFilter && _gsTypeFilter !== type) continue;
    const list   = cache[type] || [];
    const hits   = filter(type, list, q).slice(0, 8);
    if (!hits.length) continue;
    const m = meta[type] || { icon: '📄', label: type };
    html += `<div class="gs-group">
      <div class="gs-group-label">${m.icon} ${m.label}</div>
      ${hits.map(e => `
        <button class="gs-result" onclick="window.app._globalSearchGo('${type}','${esc(e.id)}')">
          <span class="gs-result-name">${esc(e.name)}</span>
          ${e.subtype ? `<span class="gs-result-sub">${esc(e.subtype)}</span>` : ''}
        </button>`).join('')}
    </div>`;
  }

  // Documenten (archief)
  if (!_gsTypeFilter || _gsTypeFilter === 'documenten') {
    const docHits = (_archiefCache).filter(d =>
      (d.name || d.title || '').toLowerCase().includes(ql)
    ).slice(0, 8);
    if (docHits.length) {
      html += `<div class="gs-group">
        <div class="gs-group-label">📜 Documenten</div>
        ${docHits.map(d => `
          <button class="gs-result" onclick="window.app._globalSearchGo('documenten','${esc(d.id)}')">
            <span class="gs-result-name">${esc(d.name || d.title || d.id)}</span>
          </button>`).join('')}
      </div>`;
    }
  }

  resultsEl.innerHTML = html || `<p class="gs-empty">Geen resultaten gevonden voor "<em>${esc(q)}</em>".</p>`;
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
  try {
    const me = await api.role();
    state.role        = me.role        || 'player';
    state.playerName  = me.playerName  || null;
    state.characterId = me.characterId || null;
  } catch { /* default player */ }

  try {
    state.meta = await api.meta();
    applyAppMeta(state.meta);
  } catch { /* ok */ }

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
  // Voorkom dat anonieme speler direct op mijn-karakter-tab belandt
  switchSection(startSection === 'mijn-karakter' && !state.playerName ? 'personages' : startSection);

  // Speler heeft nog geen karakter gekozen: toon de landingspagina
  if (state.role === 'player' && !state.playerName) {
    showLanding();
  }
}

// ── Herberg ──

function _dienstNietBereikbaar(el, naam) {
  el.innerHTML = `
    <div class="herberg-scene" style="justify-content:center;align-items:center;min-height:220px">
      <div class="herberg-content" style="text-align:center;padding:2rem 1.5rem">
        <div style="font-size:2.2rem;margin-bottom:.6rem">🔒</div>
        <p class="herberg-groet" style="margin:0">${esc(naam)} is momenteel niet bereikbaar.</p>
        <p style="opacity:.5;font-size:.85rem;margin-top:.5rem">De groep bevindt zich buiten Grisburgh.</p>
      </div>
    </div>`;
}

async function renderHerberg() {
  const el = document.getElementById('section-herberg');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (meta.buitenGrisburgh) {
    _dienstNietBereikbaar(el, meta.herberg?.naam || 'De herberg');
    return;
  }

  let data;
  try { data = await api.get('/herberg'); }
  catch { el.innerHTML = '<p class="p-8 text-ink-dim">Herberg niet beschikbaar.</p>'; return; }

  const { config, state: hState, entities, playerFirstName } = data;
  const remaining = config.maxVragen - hState.vragen;
  const cooldownActief = hState.cooldownTot && new Date(hState.cooldownTot) > new Date();

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

  el.innerHTML = `
    <div class="herberg-scene">
      <div class="herberg-content">
        <div class="herberg-portrait-wrap">
          ${config.imageId
            ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round${cooldownActief ? ' herberg-portrait--weg' : ''}" alt="${esc(config.waard)}">`
            : `<div class="herberg-portrait-round herberg-portrait-fallback${cooldownActief ? ' herberg-portrait--weg' : ''}">🍺</div>`}
        </div>
        <p class="herberg-groet">${_groetTekst}</p>

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
                      <span class="herberg-item-naam">🎲 Andere suggesties…</span>
                    </button>` : ''}
                </div>
              </div>`
        }
        <div id="herberg-antwoord" class="herberg-antwoord hidden"></div>
      </div>
    </div>
  `;
}

const _KLASSEN_MET_ICON = new Set(['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
window._updateKlasseIcon = (klasse) => {
  const wrap = document.getElementById('player-class-icon-wrap');
  if (!wrap) return;
  if (klasse && _KLASSEN_MET_ICON.has(klasse)) {
    wrap.innerHTML = `<img src="/img/classes/${klasse}.png" class="player-class-icon" alt="${klasse}">`;
  } else {
    wrap.innerHTML = '';
  }
};

window._herbergFilter = (q) => {
  document.querySelectorAll('.herberg-item').forEach(btn => {
    btn.classList.toggle('hidden', !btn.dataset.name.includes(q.toLowerCase()));
  });
};

window._herbergShuffle = () => {
  // Herlaad herberg zodat een nieuwe sample getoond wordt
  import('./app.js').catch(() => {});
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
  if (meta.buitenGrisburgh) {
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
    : `<div class="gock-portret-fallback">🔍</div>`;

  el.innerHTML = `
    <div class="herberg-scene gock-scene" ${backdrop}>
      <div class="herberg-content">
        <div class="herberg-portrait-wrap">${portret}</div>
        <p class="herberg-groet">${esc(config.naam)} kijkt op van zijn bureau en trekt een wenkbrauw op.</p>
        ${currency ? `<p class="ts-beurs">Jouw beurs: <strong>${beursTekst(currency)}</strong></p>` : ''}
        <p class="ts-beurs">Vooruitbetaling: <strong>${prijsTekst(config.prijs)}</strong> · Resultaat binnen 24 uur</p>

        ${heeftKlaarZaak ? `
          <div class="gock-dossier">
            <div class="gock-dossier-head">📁 Dossier: ${esc(geval.entityName)}</div>
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
            <p>🔎 <strong>${esc(config.naam)}</strong> doet onderzoek naar <strong>${esc(geval.entityName)}</strong>.</p>
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
    _tsToast('🔍 Opdracht ingediend. Rapport volgt binnen 24 uur.');
  } catch (err) {
    _tsToast(err.message || 'Fout bij indienen opdracht.');
  }
};

window._gockOpgehaald = async () => {
  try { await api.gockOpgehaald(); } catch { /* ok */ }
  await renderGock();
};

// ── Tweespalt / Gokkantoor ──────────────────────────────────────────────────

async function renderTweespalt() {
  const el = document.getElementById('section-tweespalt');
  if (!el) return;

  const meta = window.app?.state?.meta || {};
  if (meta.buitenGrisburgh) {
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

  const { events = [], currency, lening, nameFirst = [], nameLast = [], config = {} } = data;
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
          <span class="ts-event-type">${event.type === 'godenwedden' ? '⚡ Godenwedden' : '⚔️ Gevecht'}</span>
          <span class="ts-event-naam">${esc(event.naam)}</span>
          ${event.uitkomstModus === 'auto' && minRest !== null && !isAfgerond
            ? `<span class="ts-event-timer">${minRest < 60 ? `${minRest} min` : `${Math.ceil(minRest/60)} uur`}</span>`
            : ''}
        </div>
        ${isAfgerond
          ? `<div class="ts-uitslag${gewonnen ? ' ts-uitslag--gewonnen' : verloren ? ' ts-uitslag--verloren' : ''}">
              <span class="ts-uitslag-label">Uitslag:</span>
              <strong>${esc(winnaarOptie?.naam || '—')}</strong>
              ${gewonnen ? `<span class="ts-uitslag-winst">🏆 Gewonnen! +${formatCl(event.mijnInzet.bedragCl * winnaarOptie.payout)}</span>` : ''}
              ${verloren ? `<span class="ts-uitslag-verlies">Niet gewonnen</span>` : ''}
            </div>`
          : `<div class="ts-opties">${event.opties.map(o => renderOptieKnop(event, o)).join('')}</div>
             ${npcBets(event)}`}
      </div>`;
  }

  const leningBanner = lening
    ? `<div class="ts-lening-banner">
        📜 Openstaande lening bij Taevin Woekeling — oorspronkelijk ${formatCl(lening.bedragCl)},
        huidig verschuldigd: <strong>${formatCl(lening.huidigVerschuldigdCl)}</strong>
        <span class="ts-lening-sub">(30% rente per dag)</span>
       </div>` : '';

  const tsBackdrop = config.backdropId ? `style="background-image:url('${api.fileUrl(config.backdropId)}')"` : '';
  const tsPortret  = config.imageId
    ? `<img src="${api.fileUrl(config.imageId)}" class="herberg-portrait-round" alt="${esc(config.naam || 'De Tweespalt')}">`
    : `<div class="ts-portrait-fallback">🎲</div>`;

  el.innerHTML = `
    <div class="herberg-scene tweespalt-scene" ${tsBackdrop}>
      <div class="herberg-content ts-content">
        <div class="herberg-portrait-wrap">${tsPortret}</div>
        <div>
          <p class="herberg-groet">Welkom bij ${esc(config.naam || 'De Tweespalt')}. Korporaal Standhall knikt je toe.</p>
          ${currency ? `<p class="ts-beurs">Jouw beurs: <strong>${beursTekst(currency)}</strong></p>` : ''}
        </div>

        ${leningBanner}

        ${openEvents.length
          ? `<div class="ts-sectie-label">Openstaande weddenschappen</div>${openEvents.map(renderEvent).join('')}`
          : `<p class="herberg-leeg">Er zijn momenteel geen openstaande weddenschappen.</p>`}

        ${afgerondEvents.length
          ? `<div class="ts-sectie-label ts-sectie-label--afgerond">Afgeronde events</div>${afgerondEvents.map(renderEvent).join('')}`
          : ''}
      </div>
    </div>`;
}

// Parseert decimale florinde-invoer: "1,28" of "1.28" → { fl:1, kn:2, cl:8, bedragCl:128 }
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

function _tsToast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => {
    t.classList.remove('map-toast--show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 4000);
}

init();
