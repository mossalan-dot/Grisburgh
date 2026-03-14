import { api } from './api.js';
import { initCampagne, renderPersonages, renderLocaties, renderOrganisaties, renderVoorwerpen, openEditor } from './render-campagne.js';
import { initArchief, renderDocumenten, renderLogboek, openArchiefEditor, openLogboekEditor } from './render-archief.js';
import { initSocket } from './socket-client.js';

// ── App State ──
const state = {
  role: 'player',
  activeSection: 'personages',
  meta: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Expose globals ──
window.app = {
  state,
  $, $$,
  isDM: () => state.role === 'dm',
  toggleLoginModal,
  closeLoginModal,
  login,
  logout,
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
  if (state.role === 'dm' && editableSections.includes(state.activeSection)) {
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
  applyRole();
  refreshAll();
}

function applyRole() {
  const appEl = $('#app');
  appEl.classList.toggle('dm-mode', state.role === 'dm');
  appEl.classList.toggle('player-mode', state.role !== 'dm');
  $('#dm-login').classList.toggle('hidden', state.role === 'dm');
  $('#dm-badge').classList.toggle('hidden', state.role !== 'dm');
  updateFab();
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

// ── Party portraits ──
async function renderParty() {
  const bar = document.getElementById('party-bar');
  if (!bar) return;
  try {
    const all = await api.listEntities('personages');
    const spelers = all.filter(e => e.subtype === 'speler');
    if (spelers.length === 0) { bar.innerHTML = ''; return; }
    bar.innerHTML = spelers.map(e => {
      const imgUrl = api.fileUrl(e.id);
      const sub = [e.data?.ras, e.data?.klasse].filter(Boolean).join(' · ');
      return `
        <div class="party-portrait" onclick="window._openDetail('personages','${esc(e.id)}')">
          <img src="${imgUrl}" class="party-portrait-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="party-portrait-fallback" style="display:none">\u{1f464}</div>
          <div class="party-portrait-name">${esc(e.name.split(' ')[0])}</div>
          ${sub ? `<div class="party-portrait-sub">${esc(sub)}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch { bar.innerHTML = ''; }
}
window.renderParty = renderParty;

// ── Refresh ──
async function refreshSection(section) {
  section = section || state.activeSection;
  if (section === 'personages') { await renderPersonages(); await renderParty(); }
  else if (section === 'locaties') await renderLocaties();
  else if (section === 'organisaties') await renderOrganisaties();
  else if (section === 'voorwerpen') await renderVoorwerpen();
  else if (section === 'documenten') await renderDocumenten();
  else if (section === 'logboek') await renderLogboek();
}

async function refreshAll() {
  await refreshSection(state.activeSection);
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeModal();
    closeLoginModal();
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
