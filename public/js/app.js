import { api } from './api.js';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor } from './render-campagne.js';
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from './render-archief.js';
import { renderKaart } from './render-kaart.js';
import { initSocket } from './socket-client.js';
import { initDmPanel } from './dm-panel.js';

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
  closeLightbox,
  refreshSection,
  switchSection,
  esc,
  mdToHtml,
  switchGroup,
  renameGroup,
  newGroup,
  deleteGroup,
  editHeader,
  saveHeader,
  cancelHeader,
  applyAppMeta,
  openPlayerPicker,
  closePlayerPicker,
  playerLogin,
  playerLogout,
  toggleArchiefMenu,
  closeArchiefMenu,
};

// ── Section switching ──
$$('.section-tab[data-section]').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    if (section) switchSection(section);
  });
});

// Archief dropdown items
$$('#archief-menu .archief-menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchSection(btn.dataset.section);
  });
});

// Sluit dropdown bij klik buiten het menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('#archief-nav-group')) closeArchiefMenu();
});

function switchSection(section) {
  state.activeSection = section;
  location.hash = section;
  closeArchiefMenu();

  // Directe tabs (logboek, mijn-karakter)
  $$('.section-tab[data-section]').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  // Archief-knop: actief als een sub-sectie actief is
  const archiefBtn   = $('#archief-nav-btn');
  const archiefLabel = $('#archief-nav-label');
  const isArchief    = ARCHIEF_SECTIONS.includes(section);
  if (archiefBtn) archiefBtn.classList.toggle('active', isArchief);
  if (archiefLabel) archiefLabel.textContent = isArchief ? ARCHIEF_LABELS[section] : 'Archief';

  // Dropdown-items
  $$('#archief-menu .archief-menu-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === section));

  $$('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  refreshSection(section);
  updateFab();
}

function toggleArchiefMenu() {
  $('#archief-menu')?.classList.toggle('hidden');
}

function closeArchiefMenu() {
  $('#archief-menu')?.classList.add('hidden');
}

const ENTITY_SECTIONS  = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
const ARCHIEF_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'kaart'];
const ARCHIEF_LABELS   = {
  personages:   '👤 Personages',
  locaties:     '🏰 Locaties',
  organisaties: '🏛️ Organisaties',
  voorwerpen:   '⚔️ Voorwerpen',
  documenten:   '📜 Documenten',
  kaart:        '🗺️ Kaarten',
};

function updateFab() {
  const fab = $('#fab');
  const editableSections = [...ENTITY_SECTIONS, 'documenten', 'logboek'];
  if (state.role === 'dm' && !state.dmPreview && editableSections.includes(state.activeSection)) {
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
  const knob      = $('#dm-toggle-knob');
  const label     = $('#dm-toggle-label');
  const logoutBtn = $('#dm-logout-btn');

  if (toggle) {
    toggle.style.background  = isDmActive ? '#8a6200' : isDmPreview ? '#3a2a00' : '';
    toggle.style.borderColor = isDmActive ? '#c4930a' : isDmPreview ? '#6a4800' : '';
    toggle.title = isDmActive ? 'Spelerweergave tonen' : isDmPreview ? 'Terug naar DM-weergave' : 'Dungeon Master modus';
  }
  if (knob) {
    knob.style.transform = isDmActive ? 'translateX(1.25rem)' : 'translateX(0)';
    knob.style.background = isDmActive ? '#f0b429' : '';
  }
  if (label) {
    label.textContent = isDmActive ? 'Dungeon Master' : isDmPreview ? 'Spelerweergave' : 'DM';
    label.style.color = isDmActive ? '#c4930a' : isDmPreview ? '#6a4800' : '';
  }
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', state.role !== 'dm');
  }

  // Potloodknop header: alleen zichtbaar voor actieve DM
  const headerEditBtn = document.getElementById('header-edit-btn');
  if (headerEditBtn) headerEditBtn.classList.toggle('hidden', !isDmActive);

  // Dice FAB: alleen zichtbaar voor spelers (niet voor actieve DM)
  const diceFab = document.getElementById('dice-fab');
  if (diceFab) diceFab.classList.toggle('hidden', isDmActive);

  const dmPanelFab = document.getElementById('dm-panel-fab');
  if (dmPanelFab) dmPanelFab.classList.toggle('hidden', !isDmActive);

  // Groepswisselaar tonen/verbergen op basis van DM-status
  const groupSwitcher = document.getElementById('group-switcher');
  if (groupSwitcher) groupSwitcher.classList.toggle('hidden', !isDmActive);

  // Speler-identiteit in header
  const playerIdentity = document.getElementById('player-identity');
  const playerPickBtn  = document.getElementById('player-pick-btn');
  const playerNameEl   = document.getElementById('player-name-display');
  const isAnonymousPlayer = state.role === 'player' && !state.playerName;
  const isNamedPlayer     = state.role === 'player' && !!state.playerName;

  if (playerIdentity) {
    playerIdentity.classList.toggle('hidden', !isNamedPlayer);
    if (isNamedPlayer) playerIdentity.classList.add('flex');
    else playerIdentity.classList.remove('flex');
  }
  if (playerNameEl && state.playerName) playerNameEl.textContent = state.playerName;
  if (playerPickBtn) playerPickBtn.classList.toggle('hidden', !isAnonymousPlayer);

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

// ── Speler-karakter kiezer ──

async function openPlayerPicker() {
  const overlay = $('#player-picker-overlay');
  const list    = $('#player-char-list');
  if (!overlay || !list) return;
  list.innerHTML = '<p class="text-ink-dim text-sm col-span-2">Laden…</p>';
  overlay.classList.add('active');
  try {
    const chars = await api.listPlayerChars();
    if (chars.length === 0) {
      list.innerHTML = '<p class="text-ink-dim text-sm col-span-2 italic">Geen spelerskarakters gevonden. Voeg personages toe met subtype \'speler\'.</p>';
      return;
    }
    list.innerHTML = chars.map(c => {
      const sub = [c.ras, c.klasse].filter(Boolean).join(' · ');
      const isMe = c.id === state.characterId;
      return `
        <button class="player-char-card${isMe ? ' player-char-card--active' : ''}"
          onclick="window.app.playerLogin('${esc(c.id)}')">
          <div class="player-char-avatar-wrap">
            <img src="/api/files/${esc(c.id)}" class="player-char-avatar"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="player-char-avatar-fallback" style="display:none">👤</div>
          </div>
          <div class="player-char-name">${esc(c.name)}</div>
          ${sub ? `<div class="player-char-sub">${esc(sub)}</div>` : ''}
          ${isMe ? '<div class="player-char-badge">Actief</div>' : ''}
        </button>`;
    }).join('');
  } catch {
    list.innerHTML = '<p class="text-ink-dim text-sm col-span-2">Fout bij laden.</p>';
  }
}

function closePlayerPicker() {
  $('#player-picker-overlay')?.classList.remove('active');
}

async function playerLogin(characterId) {
  try {
    const { playerName, characterId: cid } = await api.playerLogin(characterId);
    state.playerName  = playerName;
    state.characterId = cid;
    closePlayerPicker();
    applyRole();
    // Als het eigen karakter-tabblad actief is, herlaad het
    if (state.activeSection === 'mijn-karakter') refreshSection('mijn-karakter');
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
}

// ── Lightbox ──
let lbZoom = 1;
function openLightbox(src, title) {
  const lb = $('#lightbox');
  const img = $('#lb-img');
  img.src = src;
  $('#lb-title').textContent = title || '';
  lb.classList.remove('hidden');
  lb.classList.add('flex');
  lbZoom = 1;
  img.style.transform = '';
}

function closeLightbox() {
  const lb = $('#lightbox');
  lb.classList.add('hidden');
  lb.classList.remove('flex');
  $('#lb-img').src = '';
}

$('#lightbox').addEventListener('wheel', (e) => {
  e.preventDefault();
  lbZoom += e.deltaY > 0 ? -0.15 : 0.15;
  lbZoom = Math.max(0.5, Math.min(5, lbZoom));
  $('#lb-img').style.transform = `scale(${lbZoom})`;
});

// ── HTML escape ──
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Markdown → HTML (headings, bold, italic, newlines) ──
function mdToHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Koppen moeten voor inline-markup zodat bold/italic erin werkt
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    // Geen losse <br> direct vóór of na een koptag
    .replace(/<br>(<h[1-4]>)/g, '$1')
    .replace(/(<\/h[1-4]>)<br>/g, '$1');
}

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
    const all = await api.listEntities('personages');
    // Filter op actieve groep: spelers zonder groep-toewijzing tonen in alle groepen
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
      const imgUrl   = api.fileUrl(e.id);
      const sub      = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
      const isAbsent = presence[e.id] === false;
      const dotTitle = isAbsent ? 'Afwezig — klik om aanwezig te maken' : 'Aanwezig — klik om af te melden';
      return `
        <div class="party-portrait${isAbsent ? ' party-portrait--absent' : ''}" onclick="window._openDetail('personages','${esc(e.id)}')">
          <div class="party-portrait-avatar-wrap">
            <img src="${imgUrl}" class="party-portrait-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="party-portrait-fallback" style="display:none">\u{1f464}</div>
            <button class="party-presence-dot ${isAbsent ? 'absent' : 'present'}"
              onclick="event.stopPropagation();window._togglePartyPresence('${esc(e.id)}')"
              title="${dotTitle}"></button>
          </div>
          <div class="party-portrait-name">${esc(e.name.split(' ')[0])}</div>
          ${sub ? `<div class="party-portrait-sub">${esc(sub)}</div>` : ''}
        </div>
      `;
    };
    const divider = (present.length > 0 && absent.length > 0)
      ? '<div class="party-bar-divider"></div>' : '';
    bar.innerHTML = present.map(renderPortrait).join('') + divider + absent.map(renderPortrait).join('');
  } catch { bar.innerHTML = ''; }
}
window.renderParty = renderParty;

window._togglePartyPresence = (id) => {
  const presence = _getPartyPresence();
  presence[id] = presence[id] === false ? true : false;
  _setPartyPresence(presence);
  renderParty();
};

// ── Groepswisselaar ──
window.renderGroupSwitcher = function(groups, activeGroupId) {
  _activeGroupId = activeGroupId;
  const container = document.getElementById('group-switcher');
  if (!container) return;
  // Alleen zichtbaar in DM-modus
  const isDm = state.role === 'dm' && !state.dmPreview;
  container.classList.toggle('hidden', !isDm);
  if (!isDm) return;
  container.innerHTML = groups.map(g => `
    <button class="group-tab${g.active ? ' active' : ''}"
      onclick="window.app.switchGroup('${esc(g.id)}')"
      ondblclick="window.app.renameGroup('${esc(g.id)}','${esc(g.name)}')"
      title="${g.active ? 'Actieve groep · dubbelklik om te hernoemen' : 'Wissel naar deze groep · dubbelklik om te hernoemen'}"
    >${esc(g.name)}</button>
  `).join('') + `
    <button class="group-tab-add" onclick="window.app.newGroup()" title="Nieuwe groep aanmaken">+</button>
    ${groups.length > 1 ? `<button class="group-tab-del" onclick="window.app.deleteGroup()" title="Huidige groep verwijderen">×</button>` : ''}
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

async function deleteGroup() {
  const groups = document.querySelectorAll('#group-switcher .group-tab');
  const activeBtn = document.querySelector('#group-switcher .group-tab.active');
  const name = activeBtn?.textContent?.trim() || 'deze groep';
  if (!confirm(`Groep "${name}" verwijderen? De zichtbaarheidsstatus van deze groep gaat verloren.`)) return;
  try { await api.deleteGroup(_activeGroupId); }
  catch (e) { alert('Fout: ' + e.message); }
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
  else if (section === 'kaart') await renderKaart();
  else if (section === 'mijn-karakter') await renderMijnKarakter();
}

async function renderMijnKarakter() {
  const el = document.getElementById('section-mijn-karakter');
  if (!el) return;
  if (!state.playerName || !state.characterId) {
    el.innerHTML = '<div class="p-8 text-center text-ink-dim italic font-fell">Kies eerst een karakter om dit dashboard te zien.</div>';
    return;
  }

  // Laad data parallel
  let hpData = { current: null, max: null };
  let entity  = null;
  let combat  = null;
  let ownershipData = { owners: {}, requests: [] };
  let allVoorwerpen = [];
  let soundsData    = { emotes: {} };
  let simpleItems   = [];
  let currency      = { fl: 0, kn: 0, cl: 0 };
  let spellSlots    = {};
  try {
    [hpData, entity, combat, ownershipData, allVoorwerpen, soundsData, simpleItems, currency, spellSlots] = await Promise.all([
      api.getPlayerHp(state.characterId).catch(() => ({ current: null, max: null })),
      api.getEntity('personages', state.characterId).catch(() => null),
      api.getCombat().catch(() => null),
      api.getItemOwnership().catch(() => ({ owners: {}, requests: [] })),
      api.listEntities('voorwerpen').catch(() => []),
      fetch('/api/sounds').then(r => r.json()).catch(() => ({ emotes: {} })),
      api.getPlayerItems(state.characterId).catch(() => []),
      api.getPlayerCurrency(state.characterId).catch(() => ({ fl: 0, kn: 0, cl: 0 })),
      api.getPlayerSpellSlots(state.characterId).catch(() => ({})),
    ]);
  } catch { /* ok */ }

  // Geclaimde voorwerpen van deze speler
  const myItemIds = Object.entries(ownershipData.owners || {})
    .filter(([, v]) => v.characterId === state.characterId)
    .map(([itemId]) => itemId);
  const myItems = allVoorwerpen.filter(item => myItemIds.includes(item.id));

  // Zoek eigen combatant in actief gevecht
  let myCombatant = null;
  if (combat?.active) {
    myCombatant = combat.combatants?.find(
      c => c.entityId === state.characterId || c.name === state.playerName
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
  const myEmoteData  = soundsData.emotes?.[state.characterId];
  const emoteLibrary = myEmoteData?.library || [];
  const emoteSelected = myEmoteData?.selected || [];
  // Actieve emotes = de geselecteerde items (max 5), in volgorde
  const activeEmotes = emoteSelected
    .map((eid, idx) => ({ index: idx, item: emoteLibrary.find(e => e.id === eid) }))
    .filter(e => e.item?.label);

  // Is het momenteel de beurt van deze speler?
  const isMyTurn = combat?.active && myCombatant &&
    (combat.combatants[combat.currentTurn]?.id === myCombatant.id);

  // Portret
  const imgUrl = api.fileUrl(state.characterId);
  const sub = [entity?.data?.ras, entity?.data?.klasse].filter(Boolean).join(' · ');
  const desc = entity?.data?.desc || '';

  el.innerHTML = `
    <div class="player-dashboard">
      <!-- Karakter header -->
      <div class="player-dash-hero">
        <div class="player-dash-avatar-wrap">
          <img src="${imgUrl}" class="player-dash-avatar"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="player-dash-avatar-fallback" style="display:none">👤</div>
        </div>
        <div class="player-dash-hero-info">
          <h2 class="player-dash-name">${esc(state.playerName)}</h2>
          ${sub ? `<p class="player-dash-sub">${esc(sub)}</p>` : ''}
        </div>
      </div>

      <!-- HP blok -->
      <div class="player-dash-section">
        <div class="player-dash-section-title">❤️ HP</div>
        <div class="player-dash-hp-block">
          <div class="player-dash-hp-bar-wrap">
            <div class="player-dash-hp-bar ${hpCls}" style="width:${hpPct}%"></div>
          </div>
          <div class="player-dash-hp-controls">
            <button class="player-dash-hp-btn" onclick="window._dashHpChange(-1)" title="Schade">−</button>
            <div class="player-dash-hp-display">
              <input id="dash-hp-current" type="number" class="player-dash-hp-input" value="${hpNum ?? ''}"
                placeholder="?" onchange="window._dashHpSave()"
                onclick="event.stopPropagation()">
              <span class="player-dash-hp-sep">/</span>
              <input id="dash-hp-max" type="number" class="player-dash-hp-max" value="${maxNum ?? ''}"
                placeholder="max" onchange="window._dashHpSave()"
                onclick="event.stopPropagation()">
            </div>
            <button class="player-dash-hp-btn" onclick="window._dashHpChange(1)" title="Genezing">+</button>
          </div>
          ${myCombatant ? '<p class="player-dash-hp-note">⚔️ Actief in gevecht — wijzigingen zijn direct zichtbaar</p>' : ''}
        </div>
      </div>

      <!-- Initiativevolgorde (alleen tijdens gevecht) -->
      ${combat?.active && (combat.combatants?.length || 0) > 0 ? `
      <div class="player-dash-section player-dash-initiative">
        <div class="player-dash-section-title">⚔️ Initiativevolgorde</div>
        <div class="player-dash-init-list">
          ${(combat.combatants || []).map((c, i) => {
            const isActive = i === combat.currentTurn;
            const isMe = state.characterId
              ? (c.entityId === state.characterId)
              : (state.playerName && c.name === state.playerName);
            const displayName = c.type === 'player' ? c.name.split(' ')[0] : c.name;
            return `<div class="player-dash-init-row${isActive ? ' player-dash-init-active' : ''}${isMe ? ' player-dash-init-me' : ''}">
              <span class="player-dash-init-num">${i + 1}</span>
              <span class="player-dash-init-dot ${c.type === 'player' ? 'co-type-player' : c.type === 'ally' ? 'co-type-ally' : 'co-type-monster'}"></span>
              <span class="player-dash-init-name">${esc(displayName)}${isMe ? ' <span class="player-dash-init-you">(jij)</span>' : ''}</span>
              ${isActive ? '<span class="player-dash-init-arrow">▶</span>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Actieve conditions (alleen tijdens gevecht) -->
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

      <!-- Valuta -->
      <div class="player-dash-section">
        <div class="player-dash-section-title">💰 Beurs</div>
        <div class="player-dash-currency">
          <label class="player-dash-currency-row">
            <span class="player-dash-currency-label"><span class="player-dash-currency-icon">🟡</span>Florinde</span>
            <input class="player-dash-currency-input" type="number" min="0" id="dash-cur-fl" value="${currency.fl}"
              onblur="window._dashCurrencySave()">
          </label>
          <label class="player-dash-currency-row">
            <span class="player-dash-currency-label"><span class="player-dash-currency-icon">⚪</span>Knaker</span>
            <input class="player-dash-currency-input" type="number" min="0" id="dash-cur-kn" value="${currency.kn}"
              onblur="window._dashCurrencySave()">
          </label>
          <label class="player-dash-currency-row">
            <span class="player-dash-currency-label"><span class="player-dash-currency-icon">🟤</span>Centeling</span>
            <input class="player-dash-currency-input" type="number" min="0" id="dash-cur-cl" value="${currency.cl}"
              onblur="window._dashCurrencySave()">
          </label>
        </div>
      </div>

      <!-- Spreukenslots -->
      ${(() => {
        const lvls = [1,2,3,4,5,6,7,8,9];
        const rows = lvls.map(lvl => {
          const slot = spellSlots[lvl] || { max: 0, used: 0 };
          if (slot.max === 0 && !spellSlots[lvl]) return '';
          const dots = Array.from({ length: Math.max(slot.max, 0) }, (_, i) => {
            const used = i < slot.used;
            return `<button class="spell-slot-dot ${used ? 'used' : 'free'}" title="${used ? 'Verbruikt — klik om vrij te maken' : 'Vrij — klik om te verbruiken'}"
              onclick="window._dashToggleSlot(${lvl}, ${i})"></button>`;
          }).join('');
          return `
            <div class="player-dash-slot-row">
              <span class="player-dash-slot-level">Niv. ${lvl}</span>
              <div class="player-dash-slot-dots">${dots}</div>
              <span class="player-dash-slot-count">${slot.used}/${slot.max}</span>
              <button class="player-dash-slot-adj" onclick="window._dashSlotAdj(${lvl}, -1)" title="Max verlagen">−</button>
              <button class="player-dash-slot-adj" onclick="window._dashSlotAdj(${lvl}, 1)" title="Max verhogen">+</button>
            </div>`;
        }).filter(Boolean).join('');
        return `
      <div class="player-dash-section player-dash-spellslots">
        <div class="player-dash-section-title">
          ✨ Spreukenslots
          ${rows ? `<button class="player-dash-slot-rest-btn" onclick="window._dashLongRest()" title="Lange rust — herstel alle slots">🌙 Lange rust</button>` : ''}
        </div>
        ${rows || '<p class="player-dash-empty">Nog geen spreukenslots ingesteld.</p>'}
        <button class="player-dash-slot-add-btn" onclick="window._dashSlotAddLevel()" title="Nieuw niveau toevoegen">+ Niveau</button>
      </div>`;
      })()}

      <!-- Emote-knoppen (altijd zichtbaar als DM emotes heeft ingesteld) -->
      ${activeEmotes.length > 0 ? `
      <div class="player-dash-section player-dash-emotes">
        <div class="player-dash-section-title">🎭 Emotes${isMyTurn ? ' <span class="player-dash-emote-turn-hint">— jouw beurt!</span>' : ''}</div>
        <div class="player-dash-emote-btns">
          ${activeEmotes.map(e => {
            const icon  = e.item.icon  || '';
            const label = e.item.label || '';
            return `<button class="player-dash-emote-btn" onclick="window._dashEmote(${e.index})" title="${esc(label)}">
              ${icon  ? `<span class="emote-btn-icon">${esc(icon)}</span>`  : ''}
              ${label ? `<span class="emote-btn-text">${esc(label)}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Geclaimde & losse voorwerpen -->
      <div class="player-dash-section">
        <div class="player-dash-section-title">🎒 Jouw voorwerpen</div>
        ${myItems.length > 0 ? `
        <div class="player-dash-items">
          ${myItems.map(item => {
            const imgUrl  = api.fileUrl(item.id);
            const subtype = item.data?.itemType || item.subtype || '';
            return `
              <div class="player-dash-item-card" onclick="window._openDetail('voorwerpen','${esc(item.id)}')" title="${esc(item.name)}">
                <div class="player-dash-item-img-wrap">
                  <img src="${imgUrl}" class="player-dash-item-img"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                  <div class="player-dash-item-fallback" style="display:none">⚔️</div>
                </div>
                <div class="player-dash-item-name">${esc(item.name)}</div>
                ${subtype ? `<div class="player-dash-item-sub">${esc(subtype)}</div>` : ''}
              </div>`;
          }).join('')}
        </div>` : ''}
        ${simpleItems.length > 0 ? `
        <ul class="player-dash-simple-list">
          ${simpleItems.map(si => `
            <li class="player-dash-simple-item">
              <span class="player-dash-simple-name">${esc(si.name)}</span>
              ${si.note ? `<span class="player-dash-simple-note">${esc(si.note)}</span>` : ''}
              <button class="player-dash-simple-del" onclick="window._dashRemoveItem('${esc(si.id)}')" title="Verwijder">×</button>
            </li>`).join('')}
        </ul>` : ''}
        ${myItems.length === 0 && simpleItems.length === 0 ? '<p class="player-dash-empty">Nog geen voorwerpen.</p>' : ''}
        <div class="player-dash-add-item">
          <input id="dash-item-name" class="player-dash-add-item-input" type="text" placeholder="Naam voorwerp…" maxlength="80">
          <input id="dash-item-note" class="player-dash-add-item-note" type="text" placeholder="Notitie (optioneel)" maxlength="120">
          <button class="player-dash-add-item-btn" onclick="window._dashAddItem()">+ Voeg toe</button>
        </div>
      </div>
    </div>`;

  // HP-helpers voor het dashboard
  window._dashHpSave = async function() {
    const cur = parseInt(document.getElementById('dash-hp-current')?.value);
    const max = parseInt(document.getElementById('dash-hp-max')?.value);
    if (isNaN(cur) && isNaN(max)) return;
    const payload = {};
    if (!isNaN(cur)) payload.current = cur;
    if (!isNaN(max)) payload.max = max;
    try {
      await api.setPlayerHp(state.characterId, payload);
      // Als in gevecht: ook combatant updaten
      if (myCombatant && !isNaN(cur)) {
        await api.combatPlayerHp(myCombatant.id, cur).catch(() => {});
      }
      // Herlaad de HP-balk
      renderMijnKarakter();
    } catch { /* ok */ }
  };

  window._dashHpChange = async function(delta) {
    const curEl = document.getElementById('dash-hp-current');
    const cur = parseInt(curEl?.value) || 0;
    const max = parseInt(document.getElementById('dash-hp-max')?.value) || 999;
    const newHp = Math.max(0, Math.min(max, cur + delta));
    if (curEl) curEl.value = newHp;
    try {
      await api.setPlayerHp(state.characterId, { current: newHp });
      if (myCombatant) await api.combatPlayerHp(myCombatant.id, newHp).catch(() => {});
      renderMijnKarakter();
    } catch { /* ok */ }
  };

  window._dashEmote = function(index) {
    if (!state.characterId) return;
    if (combat?.active) {
      // Tijdens gevecht: relay via socket → DM-browser speelt geluid af
      if (window._socket) {
        window._socket.emit('sound:emote', { entityId: state.characterId, index });
      }
    } else {
      // Buiten gevecht: speel geluid af op het eigen apparaat
      const fileId = activeEmotes.find(e => e.index === index)?.item?.fileId;
      if (fileId) new Audio(`/api/files/${fileId}`).play().catch(() => {});
    }
  };

  window._dashAddItem = async function() {
    const nameEl = document.getElementById('dash-item-name');
    const noteEl = document.getElementById('dash-item-note');
    const name = nameEl?.value?.trim();
    if (!name) { nameEl?.focus(); return; }
    try {
      await api.addPlayerItem(state.characterId, { name, note: noteEl?.value?.trim() || '' });
      renderMijnKarakter();
    } catch { /* ok */ }
  };

  window._dashRemoveItem = async function(itemId) {
    try {
      await api.removePlayerItem(state.characterId, itemId);
      renderMijnKarakter();
    } catch { /* ok */ }
  };

  // ── Valuta ──
  window._dashCurrencySave = async function() {
    const fl = Math.max(0, parseInt(document.getElementById('dash-cur-fl')?.value) || 0);
    const kn = Math.max(0, parseInt(document.getElementById('dash-cur-kn')?.value) || 0);
    const cl = Math.max(0, parseInt(document.getElementById('dash-cur-cl')?.value) || 0);
    try { await api.patchPlayerCurrency(state.characterId, { fl, kn, cl }); } catch { /* ok */ }
  };

  // ── Spreukenslots ──
  window._dashToggleSlot = async function(lvl, idx) {
    const slot = spellSlots[lvl] || { max: 0, used: 0 };
    const newUsed = idx < slot.used
      ? slot.used - 1   // dot al gebruikt → één minder
      : slot.used + 1;  // dot vrij → één meer
    spellSlots[lvl] = { ...slot, used: Math.min(Math.max(0, newUsed), slot.max) };
    await api.setPlayerSpellSlots(state.characterId, spellSlots).catch(() => {});
    renderMijnKarakter();
  };

  window._dashSlotAdj = async function(lvl, delta) {
    const slot = spellSlots[lvl] || { max: 0, used: 0 };
    const newMax = Math.max(0, slot.max + delta);
    spellSlots[lvl] = { max: newMax, used: Math.min(slot.used, newMax) };
    await api.setPlayerSpellSlots(state.characterId, spellSlots).catch(() => {});
    renderMijnKarakter();
  };

  window._dashLongRest = async function() {
    for (const lvl of Object.keys(spellSlots)) {
      spellSlots[lvl] = { ...spellSlots[lvl], used: 0 };
    }
    await api.setPlayerSpellSlots(state.characterId, spellSlots).catch(() => {});
    renderMijnKarakter();
  };

  window._dashSlotAddLevel = async function() {
    // Voeg het eerstvolgende ontbrekende niveau toe
    for (let lvl = 1; lvl <= 9; lvl++) {
      if (!spellSlots[lvl] || spellSlots[lvl].max === 0) {
        spellSlots[lvl] = { max: 1, used: 0 };
        await api.setPlayerSpellSlots(state.characterId, spellSlots).catch(() => {});
        renderMijnKarakter();
        return;
      }
    }
  };
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

let _archiefCache = null;

window.app.openGlobalSearch = async function() {
  const overlay = document.getElementById('global-search-overlay');
  const input   = document.getElementById('global-search-input');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  input.value = '';
  document.getElementById('global-search-results').innerHTML = '';
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
    const list   = cache[type] || [];
    const hits   = filter(type, list, q).slice(0, 5);
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
  const docHits = (_archiefCache).filter(d =>
    (d.name || d.title || '').toLowerCase().includes(ql)
  ).slice(0, 5);
  if (docHits.length) {
    html += `<div class="gs-group">
      <div class="gs-group-label">📜 Documenten</div>
      ${docHits.map(d => `
        <button class="gs-result" onclick="window.app._globalSearchGo('documenten','${esc(d.id)}')">
          <span class="gs-result-name">${esc(d.name || d.title || d.id)}</span>
        </button>`).join('')}
    </div>`;
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
  if (titleEl    && m.appTitle)    titleEl.textContent    = m.appTitle;
  if (subtitleEl && m.appSubtitle) subtitleEl.textContent = m.appSubtitle;
  // Paginatitel ook aanpassen
  if (m.appTitle) document.title = m.appTitle;
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

  // Speler heeft nog geen karakter gekozen: toon de kiezer na een kleine vertraging
  if (state.role === 'player' && !state.playerName) {
    setTimeout(openPlayerPicker, 800);
  }
}

init();
