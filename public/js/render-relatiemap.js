import { api } from './api.js';

const esc = s => window.app?.esc?.(s) ?? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Afmetingen ──
const NODE_W = 108;
const NODE_H = 120;

// ── Draadkleurenpalet ──
const THREAD_COLORS = [
  '#cc2222', '#2244cc', '#228833', '#cc8800',
  '#882299', '#cc4488', '#336688', '#aa6633',
];

// ── Post-it kleuren ──
const POSTIT_COLORS = ['#d4c8a0','#b8a882','#9aaa88','#a4a8b0','#b0a09a','#c2b48a','#8a9898'];

// ── Hash voor deterministische stijl ──
function _hash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h;
}
const _rot        = id => (_hash(id) % 14) - 7;
const _isPostit   = id => (_hash(id) % 2) === 1;
const _postitColor = id => POSTIT_COLORS[_hash(id) % POSTIT_COLORS.length];

// ── Naam wrapping ──
function _nameLines(name, maxW = 13) {
  if (!name) return ['?'];
  if (name.length <= maxW) return [name];
  const words = name.split(' ');
  let l1 = '', l2 = '';
  for (const w of words) {
    if ((l1 ? l1 + ' ' + w : w).length <= maxW) l1 = l1 ? l1 + ' ' + w : w;
    else l2 = l2 ? l2 + ' ' + w : w;
  }
  if (l2.length > maxW + 2) l2 = l2.slice(0, maxW + 1) + '…';
  return l2 ? [l1, l2] : [l1];
}

// ── State ──
let _board        = { nodes: [], edges: [] };
let _svg          = null;
let _svgG         = null;
let _viewBox      = { x: 0, y: 0, w: 1200, h: 800 };
let _dragging     = null;
let _panning      = null;
let _saveTimer    = null;
let _suppressNext = false;
let _selectedNode = null;

const _nodeById = id => _board.nodes.find(n => n.id === id);
const _edgeById = id => _board.edges.find(e => e.id === id);

// ── Debounce ──
function _debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Hoofd export ──
export async function renderRelatiemap(containerEl) {
  const container = containerEl || document.getElementById('section-relatiemap');
  if (!container) return;

  // Bewaar selectie zodat het paneel intact blijft bij socket-refresh
  const prevSelected = _selectedNode;

  try {
    _board = await api.get('/party-board');
  } catch (err) {
    container.innerHTML = `<div class="rel-error">Kon prikbord niet laden: ${esc(String(err.message))}</div>`;
    return;
  }

  // Hergebruik bestaande DOM als die er al is (bij socket-refresh)
  const alreadyBuilt = !!document.getElementById('rel-svg');
  if (!alreadyBuilt) {
    container.innerHTML = `
    <div class="rel-toolbar">
      <div class="rel-toolbar-left">
        <span class="rel-toolbar-label">Jonkers prikbord</span>
      </div>
      <div class="rel-toolbar-right">
        <button class="rel-btn" onclick="window._pbAddCard()">＋ kaartje</button>
        <button class="rel-btn" onclick="window._pbAddEdge()">＋ draad</button>
        <button class="rel-btn" onclick="window._pbZoomFit()">⊡ fit</button>
      </div>
    </div>
    <div class="pb-layout">
      <div class="rel-canvas-wrap" id="rel-canvas-wrap">
        <svg id="rel-svg" class="rel-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="rel-shadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
            </filter>
          </defs>
          <g id="rel-main-group">
            <g id="rel-edges-group"></g>
            <g id="rel-nodes-group"></g>
          </g>
        </svg>
      </div>
      <div class="pb-panel hidden" id="pb-panel"></div>
    </div>
    <div id="rel-tooltip" class="rel-tooltip"></div>
  `;
    _svg  = document.getElementById('rel-svg');
    _svgG = document.getElementById('rel-main-group');
    _attachSvgEvents();

    window._pbAddCard   = _openAddCardDialog;
    window._pbAddEdge   = () => _openAddEdgeDialog(null);
    window._pbZoomFit   = _zoomFit;
    window._pbNodeClick = _onNodeClick;
    window._pbEdgeClick = _onEdgeClick;
  } // einde if (!alreadyBuilt)

  // Herstel selectie: als de node nog op het bord staat, behoud de keuze
  _selectedNode = prevSelected && _board.nodes.some(n => n.id === prevSelected)
    ? prevSelected : null;

  _renderGraph();

  // Herstel paneel — maar niet als de gebruiker actief aan het typen is
  const active = document.activeElement;
  const userTyping = active && (
    active.id === 'pb-notes-ta' || active.id === 'pb-text-inp'
  );
  if (!userTyping) _renderPanel();
}

// ── SVG renderen ──
function _renderGraph() {
  if (!_svgG) return;
  const edgesG = document.getElementById('rel-edges-group');
  const nodesG = document.getElementById('rel-nodes-group');
  if (!edgesG || !nodesG) return;

  // ── Draden ──
  edgesG.innerHTML = _board.edges.map(ed => {
    const nA = _nodeById(ed.from);
    const nB = _nodeById(ed.to);
    if (!nA || !nB) return '';
    const ax   = nA.x + NODE_W / 2, ay = nA.y + 10;
    const bx   = nB.x + NODE_W / 2, by = nB.y + 10;
    const dist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    const sag  = Math.min(60, dist * 0.18);
    const d    = `M ${ax} ${ay} Q ${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}`;
    const col  = ed.color || '#cc2222';
    return `
      <g class="rel-edge" data-id="${esc(ed.id)}"
         onclick="window._pbEdgeClick('${esc(ed.id)}',event)">
        <path d="${d}" stroke="${col}" stroke-width="2" fill="none" class="rel-edge-line"/>
        <path d="${d}" stroke="transparent" stroke-width="16" fill="none" class="rel-edge-hit"/>
      </g>`;
  }).join('');

  // ── Nodes ──
  nodesG.innerHTML = _board.nodes.map(node => {
    const sel      = _selectedNode === node.id;
    const hasNotes = !!node.notes;
    const rot      = _rot(node.id);
    const isEntity = !!node.entityId;
    const tf       = `translate(${node.x},${node.y}) rotate(${rot},${NODE_W / 2},${NODE_H / 2})`;
    const name     = node.entityName || node.text || '?';
    const lines    = _nameLines(name);

    if (isEntity) {
      // ── Polaroid ──
      const IMG_H    = 72;
      const thumbUrl = api.thumbUrl(node.entityId);
      const border   = sel ? '#c4a840' : '#c8b88a';
      const bw       = sel ? 2.5 : 0.8;
      return `
        <g class="rel-node${sel ? ' rel-node--selected' : ''}" data-id="${esc(node.id)}"
           transform="${tf}" style="cursor:pointer"
           onclick="window._pbNodeClick('${esc(node.id)}',event)">
          <rect x="4" y="6" width="${NODE_W}" height="${NODE_H}" rx="2" fill="rgba(0,0,0,0.38)"/>
          <rect x="0" y="0" width="${NODE_W}" height="${NODE_H}" rx="2"
                fill="#f4eed6" stroke="${border}" stroke-width="${bw}"/>
          <svg x="6" y="8" width="${NODE_W - 12}" height="${IMG_H}" overflow="hidden">
            <image href="${thumbUrl}" width="${NODE_W - 12}" height="${IMG_H}"
                   preserveAspectRatio="xMidYMid slice"/>
          </svg>
          ${hasNotes ? `<text x="${NODE_W - 7}" y="11" text-anchor="middle" fill="#7a6040"
            style="font-size:11px;pointer-events:none">📎</text>` : ''}
          ${lines.length === 1
            ? `<text x="${NODE_W / 2}" y="${8 + IMG_H + 19}" text-anchor="middle" fill="#2a1a08"
                     style="font-family:'Courier New',monospace;font-size:9.5px;font-weight:bold;pointer-events:none">${esc(lines[0])}</text>`
            : `<text x="${NODE_W / 2}" y="${8 + IMG_H + 12}" text-anchor="middle" fill="#2a1a08"
                     style="font-family:'Courier New',monospace;font-size:9.5px;font-weight:bold;pointer-events:none">${esc(lines[0])}</text>
               <text x="${NODE_W / 2}" y="${8 + IMG_H + 25}" text-anchor="middle" fill="#2a1a08"
                     style="font-family:'Courier New',monospace;font-size:9.5px;font-weight:bold;pointer-events:none">${esc(lines[1])}</text>`
          }
          <circle cx="${NODE_W / 2}" cy="6" r="7" fill="#c82020" opacity="0.9"/>
          <circle cx="${NODE_W / 2 - 2.5}" cy="4" r="3" fill="rgba(255,255,255,0.45)"/>
        </g>`;
    } else {
      // ── Post-it (blanco) ──
      const bg   = _postitColor(node.id);
      const PH   = 88;
      const ofY  = (NODE_H - PH) / 2;
      const fold = 14;
      const sel_stroke = sel ? `style="stroke:#c4a840;stroke-width:2"` : '';
      return `
        <g class="rel-node${sel ? ' rel-node--selected' : ''}" data-id="${esc(node.id)}"
           transform="${tf}" style="cursor:pointer"
           onclick="window._pbNodeClick('${esc(node.id)}',event)">
          <rect x="3" y="${ofY + 5}" width="${NODE_W}" height="${PH}" fill="rgba(0,0,0,0.25)"/>
          <polygon points="0,${ofY} ${NODE_W - fold},${ofY} ${NODE_W},${ofY + fold} ${NODE_W},${ofY + PH} 0,${ofY + PH}"
                   fill="${bg}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" ${sel_stroke}/>
          <polygon points="${NODE_W - fold},${ofY} ${NODE_W},${ofY + fold} ${NODE_W - fold},${ofY + fold}"
                   fill="rgba(0,0,0,0.18)"/>
          <rect x="${(NODE_W - 24) / 2}" y="${ofY - 5}" width="24" height="9" rx="2"
                fill="rgba(225,215,185,0.82)" stroke="rgba(180,155,110,0.5)" stroke-width="0.5"/>
          ${hasNotes ? `<text x="${NODE_W - 7}" y="${ofY + 14}" text-anchor="middle" fill="#7a6040"
            style="font-size:11px;pointer-events:none">📎</text>` : ''}
          ${lines.length === 1
            ? `<text x="${NODE_W / 2}" y="${ofY + PH / 2}" text-anchor="middle" dominant-baseline="middle"
                     fill="#1a1008" style="font-family:'Courier New',monospace;font-size:10px;font-weight:bold;pointer-events:none">${esc(lines[0])}</text>`
            : `<text x="${NODE_W / 2}" y="${ofY + PH / 2 - 7}" text-anchor="middle" dominant-baseline="middle"
                     fill="#1a1008" style="font-family:'Courier New',monospace;font-size:10px;font-weight:bold;pointer-events:none">${esc(lines[0])}</text>
               <text x="${NODE_W / 2}" y="${ofY + PH / 2 + 8}" text-anchor="middle" dominant-baseline="middle"
                     fill="#1a1008" style="font-family:'Courier New',monospace;font-size:10px;font-weight:bold;pointer-events:none">${esc(lines[1])}</text>`
          }
        </g>`;
    }
  }).join('');

  // Drag handlers
  document.querySelectorAll('.rel-node').forEach(n => n.addEventListener('mousedown', _onNodeMouseDown));

  // Tooltip bij draden
  const tooltip = document.getElementById('rel-tooltip');
  if (tooltip) {
    document.querySelectorAll('.rel-edge').forEach(el => {
      const ed = _edgeById(el.dataset.id);
      if (!ed?.label) return;
      el.addEventListener('mouseenter', e => {
        tooltip.textContent = ed.label;
        tooltip.classList.add('rel-tooltip--visible');
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 34) + 'px';
      });
      el.addEventListener('mousemove', e => {
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 34) + 'px';
      });
      el.addEventListener('mouseleave', () => tooltip.classList.remove('rel-tooltip--visible'));
    });
  }
}

// ── Node klik → zijpaneel ──
function _onNodeClick(id, e) {
  if (_suppressNext) { _suppressNext = false; return; }
  e?.stopPropagation();
  _selectedNode = _selectedNode === id ? null : id;
  _renderGraph();
  _renderPanel();
}

function _renderPanel() {
  const panel = document.getElementById('pb-panel');
  if (!panel) return;
  if (!_selectedNode) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }
  const node = _nodeById(_selectedNode);
  if (!node) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const name = node.entityName || node.text || '';

  panel.innerHTML = `
    <div class="pb-panel-inner">
      ${node.entityId
        ? `<div class="pb-panel-img-wrap">
             <img src="${api.thumbUrl(node.entityId)}" class="pb-panel-img" alt="${esc(name)}"
                  onerror="this.style.display='none'">
           </div>`
        : `<div class="pb-panel-blank-icon">📝</div>`
      }
      <div class="pb-panel-name">${esc(name)}</div>
      ${node.entityId && node.entityType
        ? `<button class="pb-panel-meer-info"
             onclick="window._openDetail('${esc(node.entityType)}','${esc(node.entityId)}')">
             📋 Meer info
           </button>`
        : ''
      }
      ${!node.entityId
        ? `<div class="pb-panel-field">
             <label class="pb-panel-label">Omschrijving</label>
             <input class="pb-panel-input" id="pb-text-inp" value="${esc(node.text || '')}"
                    placeholder="Naam of beschrijving…">
           </div>`
        : ''
      }
      <div class="pb-panel-field">
        <label class="pb-panel-label">📎 Aantekeningen</label>
        <textarea class="pb-panel-notes" id="pb-notes-ta"
          placeholder="Schrijf hier jullie notities…">${esc(node.notes || '')}</textarea>
      </div>
      <button class="pb-panel-remove" onclick="window._pbRemoveNode('${esc(_selectedNode)}')">
        🗑 Verwijder van bord
      </button>
    </div>
  `;

  const notesDebounced = _debounce(async val => {
    const n = _nodeById(_selectedNode);
    if (!n) return;
    n.notes = val;
    try { await api.put(`/party-board/node/${_selectedNode}`, { notes: val }); } catch {}
    _renderGraph();
  }, 800);

  const textDebounced = _debounce(async val => {
    const n = _nodeById(_selectedNode);
    if (!n) return;
    n.text = val;
    n.entityName = val;
    try { await api.put(`/party-board/node/${_selectedNode}`, { text: val }); } catch {}
    _renderGraph();
  }, 800);

  document.getElementById('pb-notes-ta')?.addEventListener('input', e => notesDebounced(e.target.value));
  document.getElementById('pb-text-inp')?.addEventListener('input', e => textDebounced(e.target.value));
}

window._pbRemoveNode = async id => {
  if (!confirm('Kaartje van het prikbord verwijderen?')) return;
  try {
    await api.delete(`/party-board/node/${id}`);
    _board.nodes = _board.nodes.filter(n => n.id !== id);
    _board.edges = _board.edges.filter(e => e.from !== id && e.to !== id);
    _selectedNode = null;
    _renderGraph();
    _renderPanel();
  } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
};

// ── Kaartje toevoegen ──
async function _openAddCardDialog() {
  document.getElementById('pb-add-card-modal')?.remove();

  let entities = [];
  try { entities = await api.get('/party-board/entities'); } catch {}

  const onBoard  = new Set(_board.nodes.filter(n => n.entityId).map(n => n.entityId));
  const available = entities.filter(e => !onBoard.has(e.id));

  const overlay = document.createElement('div');
  overlay.id        = 'pb-add-card-modal';
  overlay.className = 'rel-modal-overlay';
  overlay.innerHTML = `
    <div class="rel-modal" onclick="event.stopPropagation()">
      <div class="rel-modal-title">Kaartje toevoegen</div>
      <div class="rel-modal-row">
        <input class="rel-input" id="pb-card-search" placeholder="🔍 Zoek persoon, locatie…"
               autofocus oninput="window._pbCardFilter(this.value)">
      </div>
      <div class="pb-entity-list" id="pb-entity-list">
        ${available.length
          ? available.map(e => `
            <button class="pb-entity-item"
                    data-name="${esc(e.name.toLowerCase())}"
                    onclick="window._pbSelectEntity('${esc(e.id)}','${esc(e.type)}')">
              <span class="pb-entity-icon">${e.type === 'personages' ? '👤' : e.type === 'locaties' ? '🏰' : '🏛️'}</span>
              <span class="pb-entity-name">${esc(e.name)}</span>
            </button>`).join('')
          : `<p class="pb-entity-empty">Alle zichtbare kaartjes staan al op het bord.</p>`
        }
      </div>
      <div class="pb-blank-row">
        <label class="rel-modal-label">Of: blanco post-it</label>
        <div class="pb-blank-inp-row">
          <input class="rel-input" id="pb-blank-text" placeholder="Omschrijving…">
          <button class="rel-btn rel-btn-primary" onclick="window._pbAddBlank()">＋ Toevoegen</button>
        </div>
      </div>
      <div class="rel-modal-actions">
        <button class="rel-btn" onclick="document.getElementById('pb-add-card-modal').remove()">Sluiten</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  window._pbCardFilter = q => {
    document.querySelectorAll('.pb-entity-item').forEach(btn =>
      btn.classList.toggle('hidden', !btn.dataset.name.includes(q.toLowerCase()))
    );
  };

  window._pbSelectEntity = async (entityId, entityType) => {
    try {
      const node = await api.post('/party-board/node', { entityId, entityType });
      _board.nodes.push(node);
      _renderGraph();
      document.getElementById('pb-add-card-modal')?.remove();
    } catch (err) {
      if (err.message?.includes('Al op het bord')) { alert('Dit kaartje staat al op het bord.'); return; }
      alert('Toevoegen mislukt: ' + err.message);
    }
  };

  window._pbAddBlank = async () => {
    const text = document.getElementById('pb-blank-text')?.value.trim();
    if (!text) { document.getElementById('pb-blank-text')?.focus(); return; }
    try {
      const node = await api.post('/party-board/node', { text });
      _board.nodes.push(node);
      _renderGraph();
      document.getElementById('pb-add-card-modal')?.remove();
    } catch (err) { alert('Toevoegen mislukt: ' + err.message); }
  };
}

// ── Draad toevoegen / bewerken ──
function _openAddEdgeDialog(existing) {
  document.getElementById('pb-add-edge-modal')?.remove();
  if (_board.nodes.length < 2) {
    alert('Voeg eerst minstens twee kaartjes toe aan het bord.');
    return;
  }

  const nodeOpts = side => _board.nodes.map(n => {
    const name = n.entityName || n.text || n.id;
    const sel  = existing?.[side] === n.id ? 'selected' : '';
    return `<option value="${esc(n.id)}" ${sel}>${esc(name)}</option>`;
  }).join('');

  const curColor = existing?.color || THREAD_COLORS[0];

  const swatches = THREAD_COLORS.map(c => `
    <button class="pb-color-swatch${c === curColor ? ' pb-color-swatch--active' : ''}"
      style="background:${c}" data-color="${c}"
      onclick="window._pbPickColor('${c}')"></button>`).join('');

  const overlay = document.createElement('div');
  overlay.id        = 'pb-add-edge-modal';
  overlay.className = 'rel-modal-overlay';
  overlay.innerHTML = `
    <div class="rel-modal" onclick="event.stopPropagation()">
      <div class="rel-modal-title">${existing ? 'Draad bewerken' : 'Draad leggen'}</div>
      <div class="rel-modal-row">
        <label class="rel-modal-label">Van</label>
        <select id="pb-edge-from" class="rel-select">${nodeOpts('from')}</select>
      </div>
      <div class="rel-modal-row">
        <label class="rel-modal-label">Naar</label>
        <select id="pb-edge-to" class="rel-select">${nodeOpts('to')}</select>
      </div>
      <div class="rel-modal-row">
        <label class="rel-modal-label">Label <span class="rel-label-opt">(optioneel)</span></label>
        <input id="pb-edge-label" class="rel-input" value="${esc(existing?.label || '')}"
               placeholder="bijv. zijn vrienden">
      </div>
      <div class="rel-modal-row">
        <label class="rel-modal-label">Kleur touw</label>
        <div class="pb-color-swatches">${swatches}</div>
        <input type="hidden" id="pb-edge-color" value="${esc(curColor)}">
      </div>
      <div class="rel-modal-actions">
        ${existing ? `<button class="rel-btn rel-btn-danger"
          onclick="window._pbDeleteEdge('${esc(existing.id)}')">Verwijderen</button>` : ''}
        <button class="rel-btn"
          onclick="document.getElementById('pb-add-edge-modal').remove()">Annuleren</button>
        <button class="rel-btn rel-btn-primary"
          onclick="window._pbSaveEdge('${esc(existing?.id || '')}')">
          ${existing ? 'Opslaan' : 'Leggen'}</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  window._pbPickColor = color => {
    document.getElementById('pb-edge-color').value = color;
    document.querySelectorAll('.pb-color-swatch').forEach(s =>
      s.classList.toggle('pb-color-swatch--active', s.dataset.color === color)
    );
  };

  window._pbSaveEdge = async existingId => {
    const from  = document.getElementById('pb-edge-from')?.value;
    const to    = document.getElementById('pb-edge-to')?.value;
    const label = document.getElementById('pb-edge-label')?.value.trim();
    const color = document.getElementById('pb-edge-color')?.value;
    if (!from || !to || from === to) { alert('Kies twee verschillende kaartjes.'); return; }
    try {
      if (existingId) {
        await api.put(`/party-board/edge/${existingId}`, { label, color });
        const ed = _edgeById(existingId);
        if (ed) { ed.label = label; ed.color = color; }
      } else {
        const edge = await api.post('/party-board/edge', { from, to, label, color });
        _board.edges.push(edge);
      }
      document.getElementById('pb-add-edge-modal')?.remove();
      _renderGraph();
    } catch (err) { alert('Opslaan mislukt: ' + err.message); }
  };

  window._pbDeleteEdge = async id => {
    if (!confirm('Draad verwijderen?')) return;
    try {
      await api.delete(`/party-board/edge/${id}`);
      _board.edges = _board.edges.filter(e => e.id !== id);
      document.getElementById('pb-add-edge-modal')?.remove();
      _renderGraph();
    } catch (err) { alert('Verwijderen mislukt: ' + err.message); }
  };
}

// ── Edge klik → bewerken ──
function _onEdgeClick(id, e) {
  if (_suppressNext) { _suppressNext = false; return; }
  e?.stopPropagation();
  const ed = _edgeById(id);
  if (ed) _openAddEdgeDialog(ed);
}

// ── Drag & Drop ──
function _onNodeMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const id   = e.currentTarget.dataset.id;
  const node = _nodeById(id);
  if (!node) return;
  const svgRect = _svg.getBoundingClientRect();
  _dragging = {
    nodeId: id,
    startMX: e.clientX, startMY: e.clientY,
    origX: node.x,      origY: node.y,
    moved: false,
    scale: _viewBox.w / svgRect.width,
  };
}

function _onSvgMouseMove(e) {
  if (_dragging) {
    const dx = (e.clientX - _dragging.startMX) * _dragging.scale;
    const dy = (e.clientY - _dragging.startMY) * _dragging.scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _dragging.moved = true;
    const nx = _dragging.origX + dx, ny = _dragging.origY + dy;
    const node = _nodeById(_dragging.nodeId);
    if (node) { node.x = nx; node.y = ny; }
    const el = _svgG.querySelector(`.rel-node[data-id="${CSS.escape(_dragging.nodeId)}"]`);
    if (el) el.setAttribute('transform',
      `translate(${nx},${ny}) rotate(${_rot(_dragging.nodeId)},${NODE_W / 2},${NODE_H / 2})`);
    _updateEdgesForNode(_dragging.nodeId);
    return;
  }
  if (_panning) {
    const dx = e.clientX - _panning.startX, dy = e.clientY - _panning.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _panning.moved = true;
    const scale = _viewBox.w / _svg.getBoundingClientRect().width;
    _viewBox.x = _panning.origVBx - dx * scale;
    _viewBox.y = _panning.origVBy - dy * scale;
    _svg.setAttribute('viewBox', `${_viewBox.x} ${_viewBox.y} ${_viewBox.w} ${_viewBox.h}`);
  }
}

function _onSvgMouseUp() {
  if (_dragging) {
    if (_dragging.moved) {
      _suppressNext = true;
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(() => {
        const positions = {};
        _board.nodes.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
        api.put('/party-board/positions', { positions }).catch(() => {});
      }, 1500);
    }
    _dragging = null;
  }
  if (_panning?.moved) _suppressNext = true;
  _panning = null;
}

function _onSvgMouseDown(e) {
  if (e.button !== 0 || e.target.closest('.rel-node')) return;
  _panning = { startX: e.clientX, startY: e.clientY, origVBx: _viewBox.x, origVBy: _viewBox.y };
}

function _updateEdgesForNode(nodeId) {
  const edgesG = document.getElementById('rel-edges-group');
  if (!edgesG) return;
  edgesG.querySelectorAll('.rel-edge').forEach(el => {
    const ed = _edgeById(el.dataset.id);
    if (!ed || (ed.from !== nodeId && ed.to !== nodeId)) return;
    const nA   = _nodeById(ed.from);
    const nB   = _nodeById(ed.to);
    if (!nA || !nB) return;
    const ax   = nA.x + NODE_W / 2, ay = nA.y + 10;
    const bx   = nB.x + NODE_W / 2, by = nB.y + 10;
    const dist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    const sag  = Math.min(60, dist * 0.18);
    const d    = `M ${ax} ${ay} Q ${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}`;
    el.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
  });
}

function _attachSvgEvents() {
  if (!_svg) return;
  _svg.addEventListener('mousedown',  _onSvgMouseDown);
  _svg.addEventListener('mousemove',  _onSvgMouseMove);
  _svg.addEventListener('mouseup',    _onSvgMouseUp);
  _svg.addEventListener('mouseleave', _onSvgMouseUp);
  _svg.addEventListener('wheel',      _onSvgWheel, { passive: false });
  const wrap = document.getElementById('rel-canvas-wrap');
  if (wrap) { _viewBox.w = wrap.clientWidth || 1200; _viewBox.h = wrap.clientHeight || 700; }
  _svg.setAttribute('viewBox', `${_viewBox.x} ${_viewBox.y} ${_viewBox.w} ${_viewBox.h}`);
}

function _onSvgWheel(e) {
  e.preventDefault();
  const r   = _svg.getBoundingClientRect();
  const mx  = (e.clientX - r.left) / r.width  * _viewBox.w + _viewBox.x;
  const my  = (e.clientY - r.top)  / r.height * _viewBox.h + _viewBox.y;
  const fac = e.deltaY > 0 ? 1.12 : 0.89;
  _viewBox.w *= fac; _viewBox.h *= fac;
  _viewBox.x  = mx - (e.clientX - r.left) / r.width  * _viewBox.w;
  _viewBox.y  = my - (e.clientY - r.top)  / r.height * _viewBox.h;
  _svg.setAttribute('viewBox', `${_viewBox.x} ${_viewBox.y} ${_viewBox.w} ${_viewBox.h}`);
}

function _zoomFit() {
  if (!_svg || !_board.nodes.length) return;
  const pad  = 80;
  const minX = Math.min(..._board.nodes.map(n => n.x)) - pad;
  const minY = Math.min(..._board.nodes.map(n => n.y)) - pad;
  const maxX = Math.max(..._board.nodes.map(n => n.x)) + NODE_W + pad;
  const maxY = Math.max(..._board.nodes.map(n => n.y)) + NODE_H + pad;
  _viewBox   = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  _svg.setAttribute('viewBox', `${_viewBox.x} ${_viewBox.y} ${_viewBox.w} ${_viewBox.h}`);
}
