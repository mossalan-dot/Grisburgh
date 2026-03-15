import { api } from './api.js';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor } from './render-campagne.js';
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from './render-archief.js';
import { renderKaart } from './render-kaart.js';
import { initSocket } from './socket-client.js';

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
    refreshAll();
  } catch {
    $('#login-error').classList.remove('hidden');
  }
}

async function logout() {
  await api.logout();
  state.role = 'player';
  state.dmPreview = false;
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

  const diceFab = document.getElementById('dice-fab');
  if (diceFab) diceFab.style.right = isDmActive ? '88px' : '26px';

  updateFab();
}

function dmToggleClick() {
  if (state.role === 'dm' && !state.dmPreview) {
    // DM active → enter player preview
    state.dmPreview = true;
    applyRole();
    refreshAll();
  } else if (state.role === 'dm' && state.dmPreview) {
    // Preview → back to DM
    state.dmPreview = false;
    applyRole();
    refreshAll();
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

// ── Markdown → HTML (bold, italic, newlines) ──
function mdToHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
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

// ── Party presence state (localStorage) ──
function _getPartyPresence() {
  try { return JSON.parse(localStorage.getItem('grisburgh_party_presence') || '{}'); }
  catch { return {}; }
}
function _setPartyPresence(s) {
  localStorage.setItem('grisburgh_party_presence', JSON.stringify(s));
}

// ── Party portraits ──
async function renderParty() {
  const bar = document.getElementById('party-bar');
  if (!bar) return;
  try {
    const all = await api.listEntities('personages');
    const spelers = all.filter(e => e.subtype === 'speler');
    if (spelers.length === 0) { bar.innerHTML = ''; return; }
    const presence = _getPartyPresence();
    const present = spelers.filter(e => presence[e.id] !== false);
    const absent  = spelers.filter(e => presence[e.id] === false);
    const renderPortrait = e => {
      const imgUrl = api.fileUrl(e.id);
      const sub = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
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
  presence[id] = presence[id] === false ? true : false; // default = present
  _setPartyPresence(presence);
  renderParty();
};

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

// ── Dice Roller Panel ──
;(() => {
  const _history = [];

  window.dice = {
    toggle() {
      document.getElementById('dice-panel').classList.toggle('open');
    },

    roll(sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      const numEl   = document.getElementById('dice-result-num');
      const lblEl   = document.getElementById('dice-result-label');
      const boxEl   = document.getElementById('dice-result');
      if (!numEl) return;

      // Shake the result box on each new roll
      boxEl.classList.remove('dice-shaking');
      void boxEl.offsetWidth;
      boxEl.classList.add('dice-shaking');
      boxEl.addEventListener('animationend', () => boxEl.classList.remove('dice-shaking'), { once: true });

      // Clear previous state
      numEl.classList.remove('dice-crit', 'dice-fumble', 'dice-reveal');
      lblEl.textContent = 'Gooien\u2026';

      // Ticker animation: starts fast, slows toward result
      const delays = [45, 55, 65, 80, 100, 125, 155];
      let i = 0;
      const tick = () => {
        if (i < delays.length) {
          numEl.textContent = Math.floor(Math.random() * sides) + 1;
          setTimeout(tick, delays[i++]);
        } else {
          // Show the real result
          numEl.classList.remove('dice-crit', 'dice-fumble');
          void numEl.offsetWidth;
          numEl.textContent = result;
          numEl.classList.add('dice-reveal');
          numEl.addEventListener('animationend', () => numEl.classList.remove('dice-reveal'), { once: true });

          const dieLabel = sides === 100 ? 'd%' : `d${sides}`;
          if (sides === 20 && result === 20) {
            numEl.classList.add('dice-crit');
            lblEl.textContent = `${dieLabel} \u2014 \u2736 Critical Hit!`;
          } else if (sides === 20 && result === 1) {
            numEl.classList.add('dice-fumble');
            lblEl.textContent = `${dieLabel} \u2014 \u2715 Critical Fail!`;
          } else {
            lblEl.textContent = dieLabel;
          }

          // Update history
          _history.unshift({ sides, result });
          if (_history.length > 10) _history.pop();
          _renderHistory();
        }
      };
      tick();
    },
  };

  function _renderHistory() {
    const el = document.getElementById('dice-history');
    if (!el) return;
    el.innerHTML = _history.map(({ sides, result }) => {
      const isCrit   = sides === 20 && result === 20;
      const isFumble = sides === 20 && result === 1;
      const cls      = isCrit ? ' dice-hist-crit' : isFumble ? ' dice-hist-fumble' : '';
      const lbl      = sides === 100 ? '%' : sides;
      return `<span class="dice-hist-chip${cls}">d${lbl}\u00b7${result}</span>`;
    }).join('');
  }
})();

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeModal();
    closeLoginModal();
    document.getElementById('dice-panel')?.classList.remove('open');
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
  renderParty();
  const hashSection = location.hash.replace('#', '');
  const validSections = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten', 'logboek'];
  switchSection(validSections.includes(hashSection) ? hashSection : 'personages');
}

init();
