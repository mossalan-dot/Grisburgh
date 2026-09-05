// ── Media-picker ────────────────────────────────────────────────────────────
// Herbruikbare modal: "kies uit bibliotheek óf upload nieuw". Geeft een fileId
// terug (bestaand of vers geüpload) via onSelect. Eigen overlay zodat hij bovenop
// een editor kan openen die zelf het hoofd-modal gebruikt.
//
//   window.mediaPicker.open({
//     type: 'afbeelding',          // 'afbeelding' | 'audio' | 'video' — filtert de bibliotheek
//     suggestedName: 'gareth-personages',  // vooraf ingevulde naam bij upload (optioneel)
//     onSelect: (fileId) => { … }  // bestaand id óf vers geüpload id
//   });

import { api } from './api.js?v=268';

const icon = (...a) => window.icon(...a);
const esc  = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escJS = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');

let _state = null;   // { type, onSelect, suggestedName, tab, files, query, pendingFile }

// Per mediasoort: hoe de picker heet, welk icoon hij toont en wat hij accepteert.
const _SOORT = {
  afbeelding: { titel: 'Kies afbeelding', icoon: 'image',     accept: 'image/*',                  voorbeeld: 'gareth-personages' },
  audio:      { titel: 'Kies geluid',     icoon: 'volume-2',  accept: 'audio/*',  icoonCel: 'volume-2', voorbeeld: 'kampvuur-ambiance' },
  video:      { titel: 'Kies filmpje',    icoon: 'camera',    accept: 'video/mp4,video/webm', icoonCel: 'camera', voorbeeld: 'wilmer-intro' },
};

function _fmtGrootte(b) {
  if (!b && b !== 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function _overlay() { return document.getElementById('media-picker-overlay'); }

function _ensureOverlay() {
  let ov = _overlay();
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'media-picker-overlay';
  ov.className = 'media-picker-overlay';
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  return ov;
}

async function open({ type = 'afbeelding', onSelect, suggestedName = '' } = {}) {
  if (typeof onSelect !== 'function') return;
  _state = { type, onSelect, suggestedName, tab: 'upload', files: [], query: '', pendingFile: null };
  const ov = _ensureOverlay();
  ov.classList.add('active');
  _paint();          // toont meteen het skelet + laad-state
  try {
    const res = await api.listMedia();
    _state.files = (res.files || []).filter(f => f.type === type);
  } catch { _state.files = []; }
  _paint();
}

function close() {
  const ov = _overlay();
  if (ov) ov.classList.remove('active');
  _state = null;
}

function _setTab(tab) { if (_state) { _state.tab = tab; _paint(); } }
function _search(v)   { if (_state) { _state.query = v; _paintGrid(); } }

function _filtered() {
  const q = (_state.query || '').trim().toLowerCase();
  let lijst = _state.files.slice();
  if (q) lijst = lijst.filter(f => (f.naam || '').toLowerCase().includes(q) || (f.origineleNaam || '').toLowerCase().includes(q));
  lijst.sort((a, b) => (b.geupload || '').localeCompare(a.geupload || ''));
  return lijst;
}

function _paint() {
  const ov = _overlay();
  if (!ov || !_state) return;
  const soort = _SOORT[_state.type] || _SOORT.afbeelding;
  ov.innerHTML = `
    <div class="media-picker" role="dialog" aria-label="Mediabibliotheek">
      <div class="media-picker-head">
        <span class="media-picker-title">${icon(soort.icoon)} ${soort.titel}</span>
        <button class="media-picker-close" onclick="window.mediaPicker.close()" title="Sluiten">${icon('x')}</button>
      </div>
      <div class="media-picker-tabs">
        <button class="media-picker-tab${_state.tab==='bibliotheek'?' active':''}" onclick="window.mediaPicker.setTab('bibliotheek')">${icon('folder-open')} Bibliotheek</button>
        <button class="media-picker-tab${_state.tab==='upload'?' active':''}" onclick="window.mediaPicker.setTab('upload')">${icon('image')} Upload</button>
      </div>
      <div class="media-picker-body" id="media-picker-body"></div>
    </div>`;
  _paintBody();
}

function _paintBody() {
  const body = document.getElementById('media-picker-body');
  if (!body || !_state) return;
  if (_state.tab === 'upload') { body.innerHTML = _uploadHtml(); return; }
  body.innerHTML = `
    <div class="media-picker-search">
      ${icon('search')}
      <input type="text" placeholder="Zoek op naam…" value="${esc(_state.query)}"
        oninput="window.mediaPicker.search(this.value)">
    </div>
    <div class="media-picker-grid" id="media-picker-grid"></div>`;
  _paintGrid();
}

function _paintGrid() {
  const grid = document.getElementById('media-picker-grid');
  if (!grid || !_state) return;
  const lijst = _filtered();
  if (!lijst.length) {
    grid.innerHTML = `<div class="media-picker-empty">${_state.files.length ? 'Niets gevonden voor dit filter.' : 'Nog niets in de bibliotheek — upload een nieuw bestand.'}</div>`;
    return;
  }
  const soort = _SOORT[_state.type] || _SOORT.afbeelding;
  grid.innerHTML = lijst.map(f => {
    const meta = [_fmtGrootte(f.grootte), (f.breedte && f.hoogte) ? `${f.breedte}×${f.hoogte}` : ''].filter(Boolean).join(' · ');
    // Van een filmpje bestaat geen thumbnail: een icoon zegt genoeg.
    const preview = soort.icoonCel
      ? `<div class="media-picker-cell-audio">${icon(soort.icoonCel, { cls: 'icon-lg' })}</div>`
      : `<div class="media-picker-cell-img"><img src="${api.thumbUrl(f.id)}" loading="lazy" alt="${esc(f.naam)}"
           onerror="this.parentElement.classList.add('broken')"></div>`;
    return `
      <button class="media-picker-cell" onclick="window.mediaPicker.pick('${escJS(f.id)}')" title="${esc(f.naam)}">
        ${preview}
        <div class="media-picker-cell-naam">${esc(f.naam)}</div>
        ${meta ? `<div class="media-picker-cell-meta">${esc(meta)}</div>` : ''}
      </button>`;
  }).join('');
}

function _uploadHtml() {
  const soort  = _SOORT[_state.type] || _SOORT.afbeelding;
  const accept = soort.accept;
  const f = _state.pendingFile;
  return `
    <div class="media-picker-upload">
      <div class="media-picker-drop" id="media-picker-drop"
        onclick="document.getElementById('media-picker-file').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="event.preventDefault();this.classList.remove('drag');window.mediaPicker._fileChosen(event.dataTransfer.files[0])">
        ${f
          ? `<div class="media-picker-drop-chosen">${icon('check-circle')} ${esc(f.name)} <span class="media-picker-drop-size">(${_fmtGrootte(f.size)})</span></div>`
          : `<div class="media-picker-drop-hint">${icon(soort.icoon)} Sleep een bestand hierheen of klik om te kiezen</div>`}
      </div>
      <input type="file" id="media-picker-file" accept="${accept}" style="display:none"
        onchange="window.mediaPicker._fileChosen(this.files[0])">
      <label class="media-picker-naam-label">Weergavenaam
        <input type="text" id="media-picker-naam" class="dm-input dm-input-sm"
          placeholder="bijv. ${soort.voorbeeld}"
          value="${esc(_state.suggestedName)}">
      </label>
      <div class="media-picker-upload-actions">
        <button class="dm-btn dm-btn-primary dm-btn-icon${f ? '' : ' dm-btn-disabled'}" ${f ? '' : 'disabled'}
          title="Gebruik dit bestand" onclick="window.mediaPicker._doUpload()">${icon('save')}</button>
      </div>
      <div id="media-picker-upload-status" class="media-picker-upload-status"></div>
    </div>`;
}

function _fileChosen(file) {
  if (!file || !_state) return;
  _state.pendingFile = file;
  // Naam alvast invullen op basis van de bestandsnaam als er nog niets staat
  const naamEl = document.getElementById('media-picker-naam');
  if (naamEl && !naamEl.value.trim()) {
    naamEl.value = file.name.replace(/\.[^.]+$/, '');
  }
  // Herrender alleen de drop-zone-status (naamveld behouden)
  const keepNaam = naamEl?.value || '';
  _paintBody();
  const naam2 = document.getElementById('media-picker-naam');
  if (naam2) naam2.value = keepNaam || naam2.value;
}

async function _doUpload() {
  if (!_state?.pendingFile) return;
  const naam = (document.getElementById('media-picker-naam')?.value || '').trim();
  const status = document.getElementById('media-picker-upload-status');
  if (status) status.textContent = 'Uploaden…';
  const fileId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await api.uploadFile(fileId, _state.pendingFile, naam);
    const onSelect = _state.onSelect;
    close();
    onSelect(fileId);
  } catch (err) {
    if (status) status.textContent = 'Upload mislukt: ' + err.message;
  }
}

function pick(fileId) {
  if (!_state) return;
  const onSelect = _state.onSelect;
  close();
  onSelect(fileId);
}

window.mediaPicker = {
  open, close, pick,
  setTab: _setTab,
  search: _search,
  _fileChosen,
  _doUpload,
};

export { open as openMediaPicker };
