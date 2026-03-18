import { api } from './api.js';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor } from './render-campagne.js';
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from './render-archief.js';
import { renderKaart } from './render-kaart.js';
import { initSocket } from './socket-client.js';
import { initDmPanel } from './dm-panel.js';

// ── App State ──
const state = {
  role: 'player',
  dmPreview: false,   // true = DM authenticated but viewing as player
  activeSection: 'personages',
  meta: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Expose globals ──
window.app = {
  state,
  $, $$,
  isDM: () => state.role === 'dm' && !state.dmPreview,
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
};

// ── Section switching ──
$$('.section-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    switchSection(section);
  });
});

function switchSection(section) {
  state.activeSection = section;
  location.hash = section;
  $$('.section-tab').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  $$('.section').forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  refreshSection(section);
  updateFab();
}

const ENTITY_SECTIONS = ['personages', 'locaties', 'organisaties', 'voorwerpen'];

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
    knob.style.transform = isDmActive ? 'translateX(1.25rem)' : isDmPreview ? 'translateX(0.625rem)' : 'translateX(0)';
    knob.style.background = isDmActive ? '#f0b429' : isDmPreview ? '#8a6200' : '';
  }
  if (label) {
    label.textContent = isDmActive ? 'Dungeon Master' : isDmPreview ? 'Spelerweergave' : 'DM';
    label.style.color = isDmActive ? '#c4930a' : isDmPreview ? '#6a4800' : '';
  }
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', state.role !== 'dm');
  }

  // Dice FAB: alleen zichtbaar voor spelers (niet voor actieve DM)
  const diceFab = document.getElementById('dice-fab');
  if (diceFab) diceFab.classList.toggle('hidden', isDmActive);

  const dmPanelFab = document.getElementById('dm-panel-fab');
  if (dmPanelFab) dmPanelFab.classList.toggle('hidden', !isDmActive);

  // Groepswisselaar tonen/verbergen op basis van DM-status
  const groupSwitcher = document.getElementById('group-switcher');
  if (groupSwitcher) groupSwitcher.classList.toggle('hidden', !isDmActive);

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
}

async function refreshAll() {
  await refreshSection(state.activeSection);
}

// ── Dice Roller ──
;(() => {
  const _history = [];

  // Geeft alle actieve result-elementen terug (spelers-paneel én DM-paneel)
  function _els(suffix) {
    return ['dice-' + suffix, 'dm-dice-' + suffix]
      .map(id => document.getElementById(id))
      .filter(Boolean);
  }

  window.dice = {
    toggle() {
      document.getElementById('dice-panel')?.classList.toggle('open');
    },

    roll(sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      const numEls = _els('result-num');
      const lblEls = _els('result-label');
      const boxEls = _els('result');
      if (!numEls.length) return;

      // Schud alle resultaat-boxes
      boxEls.forEach(box => {
        box.classList.remove('dice-shaking');
        void box.offsetWidth;
        box.classList.add('dice-shaking');
        box.addEventListener('animationend', () => box.classList.remove('dice-shaking'), { once: true });
      });

      // Wis vorige staat
      numEls.forEach(n => n.classList.remove('dice-crit', 'dice-fumble', 'dice-reveal'));
      lblEls.forEach(l => l.textContent = 'Gooien\u2026');

      // Ticker-animatie: begint snel, vertraagt naar het resultaat
      const delays = [45, 55, 65, 80, 100, 125, 155];
      let i = 0;
      const tick = () => {
        if (i < delays.length) {
          const rnd = Math.floor(Math.random() * sides) + 1;
          numEls.forEach(n => n.textContent = rnd);
          setTimeout(tick, delays[i++]);
        } else {
          const dieLabel = sides === 100 ? 'd%' : `d${sides}`;
          numEls.forEach(n => {
            n.classList.remove('dice-crit', 'dice-fumble');
            void n.offsetWidth;
            n.textContent = result;
            n.classList.add('dice-reveal');
            n.addEventListener('animationend', () => n.classList.remove('dice-reveal'), { once: true });
            if (sides === 20 && result === 20) n.classList.add('dice-crit');
            if (sides === 20 && result === 1)  n.classList.add('dice-fumble');
          });
          lblEls.forEach(l => {
            if (sides === 20 && result === 20)      l.textContent = `${dieLabel} \u2014 \u2736 Critical Hit!`;
            else if (sides === 20 && result === 1)  l.textContent = `${dieLabel} \u2014 \u2715 Critical Fail!`;
            else                                    l.textContent = dieLabel;
          });

          _history.unshift({ sides, result });
          if (_history.length > 10) _history.pop();
          _renderHistory();
        }
      };
      tick();
    },
  };

  function _renderHistory() {
    const html = _history.map(({ sides, result }) => {
      const isCrit   = sides === 20 && result === 20;
      const isFumble = sides === 20 && result === 1;
      const cls      = isCrit ? ' dice-hist-crit' : isFumble ? ' dice-hist-fumble' : '';
      const lbl      = sides === 100 ? '%' : sides;
      return `<span class="dice-hist-chip${cls}">d${lbl}\u00b7${result}</span>`;
    }).join('');
    _els('history').forEach(el => { el.innerHTML = html; });
  }
})();

// ── Spell lookup ──
let _spellTab = null;
window.openSpellLookup = function() {
  if (_spellTab && !_spellTab.closed) {
    // Tab bestaat al — niet opnieuw openen, focus bij app houden
    return;
  }
  _spellTab = window.open('https://5e.tools/spells.html', 'spellLookup');
  // Focus terug naar deze pagina zodat het nieuwe tabblad op de achtergrond blijft
  window.focus();
};
window.closeSpellLookup = function() {
  document.getElementById('spell-overlay')?.classList.remove('active');
};

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeModal();
    closeLoginModal();
    document.getElementById('dice-panel')?.classList.remove('open');
    document.getElementById('dm-panel')?.classList.remove('open');
    document.getElementById('spell-overlay')?.classList.remove('active');
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    const searchInput = $(`#section-${state.activeSection} .search-input`);
    if (searchInput) searchInput.focus();
  }
});

// ── Init ──
async function init() {
  try {
    const { role } = await api.role();
    state.role = role;
  } catch { /* default player */ }

  try {
    state.meta = await api.meta();
  } catch { /* ok */ }

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
  const hashSection = location.hash.replace('#', '');
  const validSections = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'logboek'];
  switchSection(validSections.includes(hashSection) ? hashSection : 'personages');
}

init();
