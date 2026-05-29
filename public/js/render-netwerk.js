import { api } from './api.js?v=2';

// ════════════════════════════════════════════════════════════════════
//  Relatie-netwerk — automatische graaf afgeleid uit de bestaande links
//  tussen personages, locaties, organisaties, voorwerpen én documenten.
//  Alternatief voor de statische kaartjes: clustert verbonden onderdelen
//  en laat het verhaal als geheel zien. Globaal (dwars door alle secties).
// ════════════════════════════════════════════════════════════════════

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const icon = (...a) => window.icon?.(...a) ?? '';

// ── Type-metadata (kleuren sluiten aan op het sectie-accent) ──
const NW_TYPES = {
  personages:   { color: '#3f8a55', ring: '#235e33', label: 'Personages',   ico: 'user' },
  locaties:     { color: '#3a78aa', ring: '#214c6e', label: 'Locaties',     ico: 'castle' },
  organisaties: { color: '#b04242', ring: '#742828', label: 'Organisaties', ico: 'landmark' },
  voorwerpen:   { color: '#bd862f', ring: '#7d551a', label: 'Voorwerpen',   ico: 'package' },
  documenten:   { color: '#7250a0', ring: '#4a3168', label: 'Documenten',   ico: 'scroll-text' },
};
const TYPE_ORDER = ['personages', 'locaties', 'organisaties', 'voorwerpen', 'documenten'];

// Document-velden → entiteittype waarnaar ze verwijzen
const DOC_LINK_FIELDS = {
  npcs:  'personages',
  locs:  'locaties',
  orgs:  'organisaties',
  items: 'voorwerpen',
  docs:  'documenten',
};
// Entity link-sleutel → knooptype
const LINK_KEY_TO_TYPE = {
  personages: 'personages', locaties: 'locaties', organisaties: 'organisaties',
  voorwerpen: 'voorwerpen', archief: 'documenten',
};

const NODE_R = 26;             // straal van een knoop
const POS_KEY = 'grisburgh-netwerk-pos';

// ── State ──
let _nodes = [];
let _edges = [];
let _byId  = {};
let _svg = null, _nodesG = null, _edgesG = null;
let _viewBox = { x: -600, y: -400, w: 1200, h: 800 };
let _hidden  = new Set();      // verborgen types (legenda-toggle)
let _selected = null;
let _query = '';
let _adj = {};                 // adjacency: nodeId → [buur-ids] (voor gelaagde focus)
let _dragging = null, _panning = null, _suppressClick = false;
let _pinchDist = 0, _pinchVB = null;
let _savedPos = {};

function _loadSavedPos() {
  try { _savedPos = JSON.parse(localStorage.getItem(POS_KEY) || '{}') || {}; }
  catch { _savedPos = {}; }
}
function _persistPos() {
  try { localStorage.setItem(POS_KEY, JSON.stringify(_savedPos)); } catch {}
}

// ════════════════════════════════════════════════════════════════════
//  Databron → knopen + randen
// ════════════════════════════════════════════════════════════════════
async function _buildGraph() {
  const types = ['personages', 'locaties', 'organisaties', 'voorwerpen'];
  const lists = await Promise.all(types.map(t => api.listEntities(t).catch(() => [])));
  let docs = [];
  try { docs = (await api.listArchief()).documents || []; } catch {}

  const nodes = [];
  const byName = {};                       // "type|naam(lower)" → node
  const key = (type, name) => type + '|' + String(name || '').trim().toLowerCase();

  const addNode = (type, e, opts = {}) => {
    const node = {
      id:        type + ':' + e.id,
      eid:       e.id,
      type,
      name:      e.name || '?',
      subtype:   e.subtype || '',
      vis:       opts.vis || 'visible',
      deceased:  !!opts.deceased,
      hasImg:    !!opts.hasImg,
      raw:       e,
      deg:       0,
      x: 0, y: 0, dx: 0, dy: 0,
    };
    nodes.push(node);
    byName[key(type, e.name)] = node;
    return node;
  };

  types.forEach((t, i) => (lists[i] || []).forEach(e => addNode(t, e, {
    vis:      e._visibility || 'visible',
    deceased: e._deceased,
    hasImg:   e._visibility === 'visible',
  })));
  docs.forEach(d => addNode('documenten', d, { hasImg: false }));

  // ── Randen ──
  const seen = new Set();
  const edges = [];
  const connect = (a, targetType, targetName) => {
    const b = byName[key(targetType, targetName)];
    if (!b || b === a) return;
    const ek = [a.id, b.id].sort().join('~~');
    if (seen.has(ek)) return;
    seen.add(ek);
    a.deg++; b.deg++;
    edges.push({ id: ek, a: a.id, b: b.id });
  };

  for (const n of nodes) {
    if (n.type === 'documenten') {
      for (const [field, tt] of Object.entries(DOC_LINK_FIELDS)) {
        (n.raw[field] || []).forEach(name => connect(n, tt, name));
      }
    } else {
      const L = n.raw.links || {};
      for (const lk of Object.keys(L)) {
        const tt = LINK_KEY_TO_TYPE[lk];
        if (!tt) continue;
        (L[lk] || []).forEach(name => connect(n, tt, name));
      }
    }
  }

  return { nodes, edges };
}

// ════════════════════════════════════════════════════════════════════
//  Force-directed layout (Fruchterman–Reingold-achtig)
// ════════════════════════════════════════════════════════════════════
function _layout(nodes, edges) {
  const n = nodes.length;
  if (!n) return;
  const byId = {};
  nodes.forEach(nd => (byId[nd.id] = nd));

  const k = Math.max(120, 60 + Math.sqrt(n) * 14); // ideale randlengte, groeit met aantal
  const GOLDEN = 2.399963229728653;

  nodes.forEach((nd, i) => {
    const saved = _savedPos[nd.id];
    if (saved) { nd.x = saved.x; nd.y = saved.y; nd.pinned = true; }
    else {
      const rad = k * Math.sqrt(i + 1) * 0.55;
      nd.x = Math.cos(i * GOLDEN) * rad;
      nd.y = Math.sin(i * GOLDEN) * rad;
      nd.pinned = false;
    }
  });

  const ITERS = n > 350 ? 220 : 320;
  for (let it = 0; it < ITERS; it++) {
    const cool = 1 - it / ITERS;
    for (let i = 0; i < n; i++) { nodes[i].dx = 0; nodes[i].dy = 0; }

    // Afstoting (alle paren)
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let ddx = a.x - b.x, ddy = a.y - b.y;
        let dist = Math.hypot(ddx, ddy) || 0.01;
        const rep = (k * k) / dist;
        const ux = ddx / dist, uy = ddy / dist;
        a.dx += ux * rep; a.dy += uy * rep;
        b.dx -= ux * rep; b.dy -= uy * rep;
      }
      // Lichte zwaartekracht naar het midden
      a.dx -= a.x * 0.018; a.dy -= a.y * 0.018;
    }

    // Aantrekking langs randen
    for (const e of edges) {
      const a = byId[e.a], b = byId[e.b];
      if (!a || !b) continue;
      let ddx = a.x - b.x, ddy = a.y - b.y;
      let dist = Math.hypot(ddx, ddy) || 0.01;
      const att = (dist * dist) / k;
      const fx = (ddx / dist) * att, fy = (ddy / dist) * att;
      a.dx -= fx; a.dy -= fy;
      b.dx += fx; b.dy += fy;
    }

    const maxStep = k * 0.42 * cool + 1.5;
    for (const nd of nodes) {
      if (nd.pinned) continue;
      const dl = Math.hypot(nd.dx, nd.dy) || 0.01;
      const step = Math.min(dl, maxStep);
      nd.x += (nd.dx / dl) * step;
      nd.y += (nd.dy / dl) * step;
    }
  }
}

// ════════════════════════════════════════════════════════════════════
//  Hoofd-render
// ════════════════════════════════════════════════════════════════════
export async function renderNetwerk(containerEl) {
  const container = containerEl || document.getElementById('section-relatiemap');
  if (!container) return;

  _loadSavedPos();
  let graph;
  try {
    graph = await _buildGraph();
  } catch (err) {
    container.innerHTML = `<div class="nw-empty">Kon het netwerk niet laden: ${esc(err.message)}</div>`;
    return;
  }

  _nodes = graph.nodes;
  _edges = graph.edges;
  _byId  = {};
  _nodes.forEach(n => (_byId[n.id] = n));
  _adj = {};
  _edges.forEach(e => { (_adj[e.a] ||= []).push(e.b); (_adj[e.b] ||= []).push(e.a); });

  if (!_nodes.length) {
    container.innerHTML = `
      <div class="nw-empty">
        <div class="nw-empty-icon">${icon('users')}</div>
        <p>Nog geen onderdelen om te tonen.</p>
        <p class="nw-empty-sub">Maak personages, locaties of documenten aan en leg verbanden via hun "Relaties"-veld — die verschijnen hier automatisch als draden.</p>
      </div>`;
    return;
  }

  _layout(_nodes, _edges);

  container.innerHTML = `
    <div class="nw-toolbar">
      <div class="nw-search-wrap">
        ${icon('search', { cls: 'nw-search-icon' })}
        <input class="nw-search" id="nw-search" placeholder="Zoek in het netwerk…" autocomplete="off">
      </div>
      <div class="nw-legend" id="nw-legend">
        ${TYPE_ORDER.map(t => `
          <button class="nw-legend-item" data-type="${t}" title="Toon/verberg ${esc(NW_TYPES[t].label)}">
            <span class="nw-legend-dot" style="background:${NW_TYPES[t].color};border-color:${NW_TYPES[t].ring}"></span>
            <span class="nw-legend-label">${esc(NW_TYPES[t].label)}</span>
          </button>`).join('')}
      </div>
      <div class="nw-toolbar-right">
        <span class="nw-count" id="nw-count"></span>
        <button class="nw-btn" id="nw-fit" title="Pas in beeld">${icon('maximize-2')} Passend</button>
        <button class="nw-btn" id="nw-relayout" title="Herschik automatisch">${icon('refresh-cw')} Herschik</button>
      </div>
    </div>
    <div class="nw-stage" id="nw-stage">
      <svg id="nw-svg" class="nw-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="nw-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5"/>
          </clipPath>
          <filter id="nw-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="rgba(40,25,5,0.45)"/>
          </filter>
        </defs>
        <g id="nw-edges"></g>
        <g id="nw-nodes"></g>
      </svg>
      <aside class="nw-panel hidden" id="nw-panel"></aside>
    </div>`;

  _svg    = container.querySelector('#nw-svg');
  _nodesG = container.querySelector('#nw-nodes');
  _edgesG = container.querySelector('#nw-edges');

  _attachSvgEvents();
  _attachToolbar(container);
  _restoreLegend();

  _renderEdges();
  _renderNodes();
  _updateCount();
  _zoomFit();
}

// ── Knopen tekenen ──
function _renderNodes() {
  if (!_nodesG) return;
  const q = _query.trim().toLowerCase();
  _nodesG.innerHTML = _nodes.map(n => {
    if (_hidden.has(n.type)) return '';
    const meta = NW_TYPES[n.type];
    const sel  = _selected === n.id;
    const dimmed = q && !n.name.toLowerCase().includes(q);
    const vague  = n.vis === 'vague' || n.vis === 'hidden';
    const initial = (n.name || '?').trim().charAt(0).toUpperCase();

    const fill = vague ? '#b9ab86' : meta.color;
    const inner = (n.hasImg && !vague)
      ? `<circle r="${NODE_R - 2}" fill="#e9e1c8"/>
         <image href="${api.thumbUrl(n.eid)}" x="${-(NODE_R - 2)}" y="${-(NODE_R - 2)}"
                width="${(NODE_R - 2) * 2}" height="${(NODE_R - 2) * 2}"
                clip-path="url(#nw-clip)" preserveAspectRatio="xMidYMid slice"/>`
      : `<text class="nw-node-initial" text-anchor="middle" dominant-baseline="central" y="1">${vague ? '?' : esc(initial)}</text>`;

    const cross = n.deceased
      ? `<line x1="${-NODE_R + 6}" y1="${-NODE_R + 6}" x2="${NODE_R - 6}" y2="${NODE_R - 6}" stroke="rgba(190,30,30,0.92)" stroke-width="3" stroke-linecap="round"/>
         <line x1="${NODE_R - 6}" y1="${-NODE_R + 6}" x2="${-NODE_R + 6}" y2="${NODE_R - 6}" stroke="rgba(190,30,30,0.92)" stroke-width="3" stroke-linecap="round"/>`
      : '';

    const lines = _wrapName(n.name);
    const labelY = NODE_R + 13;
    const label = lines.map((ln, i) =>
      `<text class="nw-node-label" text-anchor="middle" y="${labelY + i * 12}">${esc(ln)}</text>`).join('');

    return `
      <g class="nw-node${sel ? ' nw-node--sel' : ''}${dimmed ? ' nw-node--dim' : ''}${n.deceased ? ' nw-node--dead' : ''}"
         data-id="${esc(n.id)}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">
        <circle class="nw-node-ring" r="${NODE_R}" fill="${fill}" stroke="${meta.ring}" stroke-width="2.5" filter="url(#nw-shadow)"/>
        ${inner}
        ${cross}
        ${label}
      </g>`;
  }).join('');

  _nodesG.querySelectorAll('.nw-node').forEach(el => {
    el.addEventListener('mousedown', _onNodeDown);
    el.addEventListener('click', _onNodeClick);
    el.addEventListener('mouseenter', () => _focus(el.dataset.id));
    el.addEventListener('mouseleave', _restoreFocus);
  });

  // DOM is herbouwd (zoek/legenda/render): herstel de focus van de selectie
  if (_selected && _byId[_selected]) _focus(_selected);
}

// ── Randen tekenen ──
function _renderEdges() {
  if (!_edgesG) return;
  _edgesG.innerHTML = _edges.map(e => {
    const a = _byId[e.a], b = _byId[e.b];
    if (!a || !b) return '';
    if (_hidden.has(a.type) || _hidden.has(b.type)) return '';
    return `<line class="nw-edge" data-id="${esc(e.id)}" data-a="${esc(e.a)}" data-b="${esc(e.b)}"
              x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
  }).join('');
}

function _wrapName(name, max = 16) {
  if (!name) return ['?'];
  if (name.length <= max) return [name];
  const words = name.split(' ');
  let l1 = '', l2 = '';
  for (const w of words) {
    if (!l2 && (l1 ? l1 + ' ' + w : w).length <= max) l1 = l1 ? l1 + ' ' + w : w;
    else l2 = l2 ? l2 + ' ' + w : w;
  }
  if (!l1) { l1 = name.slice(0, max); l2 = name.slice(max); }
  if (l2.length > max) l2 = l2.slice(0, max - 1) + '…';
  return l2 ? [l1, l2] : [l1];
}

// ── Afstanden vanaf een knoop (BFS, voor gelaagde focus) ──
function _distances(rootId, maxD = 2) {
  const dist = { [rootId]: 0 };
  let frontier = [rootId];
  for (let d = 1; d <= maxD && frontier.length; d++) {
    const next = [];
    for (const id of frontier) {
      for (const nb of (_adj[id] || [])) {
        if (!(nb in dist)) { dist[nb] = d; next.push(nb); }
      }
    }
    frontier = next;
  }
  return dist;
}

// Gelaagde focus: directe relaties vol, 2e-graads lichter, de rest vervaagt.
const _NODE_LVL = ['nw-f0', 'nw-f1', 'nw-f2', 'nw-faded'];
function _focus(id) {
  if (!_svg) return;
  const dist = _distances(id, 2);
  _svg.classList.add('nw-focusing');
  _nodesG.querySelectorAll('.nw-node').forEach(el => {
    el.classList.remove(..._NODE_LVL);
    const d = dist[el.dataset.id];
    el.classList.add(d === 0 ? 'nw-f0' : d === 1 ? 'nw-f1' : d === 2 ? 'nw-f2' : 'nw-faded');
  });
  _edgesG.querySelectorAll('.nw-edge').forEach(el => {
    el.classList.remove('nw-edge--hi', 'nw-edge--mid', 'nw-edge--faded');
    const da = dist[el.dataset.a], db = dist[el.dataset.b];
    if (da === undefined || db === undefined) { el.classList.add('nw-edge--faded'); return; }
    const mx = Math.max(da, db);
    el.classList.add(mx <= 1 ? 'nw-edge--hi' : mx === 2 ? 'nw-edge--mid' : 'nw-edge--faded');
  });
}

function _clearFocus() {
  if (!_svg) return;
  _svg.classList.remove('nw-focusing');
  _nodesG.querySelectorAll('.nw-node').forEach(el => el.classList.remove(..._NODE_LVL));
  _edgesG.querySelectorAll('.nw-edge').forEach(el =>
    el.classList.remove('nw-edge--hi', 'nw-edge--mid', 'nw-edge--faded'));
}

// Hover toont tijdelijk de focus van de zwevende knoop; bij verlaten keren we
// terug naar de geselecteerde knoop (of helder beeld als er niets geselecteerd is).
function _restoreFocus() {
  if (_selected && _byId[_selected]) _focus(_selected);
  else _clearFocus();
}

// ════════════════════════════════════════════════════════════════════
//  Selectie + zijpaneel
// ════════════════════════════════════════════════════════════════════
function _onNodeClick(e) {
  e.stopPropagation();
  if (_suppressClick) { _suppressClick = false; return; }
  const id = e.currentTarget.dataset.id;
  _selected = _selected === id ? null : id;
  _renderNodes();
  if (_selected) { _focus(_selected); _renderPanel(); }
  else { _clearFocus(); _closePanel(); }
}

function _closePanel() {
  const p = document.getElementById('nw-panel');
  if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

function _renderPanel() {
  const panel = document.getElementById('nw-panel');
  const node = _byId[_selected];
  if (!panel || !node) return;

  const meta  = NW_TYPES[node.type];
  const vague = node.vis === 'vague' || node.vis === 'hidden';

  // Verbindingen groeperen op type
  const conns = [];
  for (const e of _edges) {
    const otherId = e.a === node.id ? e.b : (e.b === node.id ? e.a : null);
    if (otherId) conns.push(_byId[otherId]);
  }
  const grouped = {};
  conns.forEach(c => { if (c) (grouped[c.type] ||= []).push(c); });

  const connHtml = TYPE_ORDER
    .filter(t => grouped[t]?.length)
    .map(t => `
      <div class="nw-conn-group">
        <div class="nw-conn-head"><span class="nw-legend-dot" style="background:${NW_TYPES[t].color};border-color:${NW_TYPES[t].ring}"></span>${esc(NW_TYPES[t].label)} <span class="nw-conn-n">${grouped[t].length}</span></div>
        ${grouped[t].sort((a, b) => a.name.localeCompare(b.name)).map(c => `
          <button class="nw-conn-item" data-goto="${esc(c.id)}">
            <span class="nw-conn-name">${esc(c.name)}</span>
            ${c.deceased ? '<span class="nw-conn-dead">†</span>' : ''}
          </button>`).join('')}
      </div>`).join('');

  const headImg = (node.hasImg && !vague)
    ? `<img class="nw-panel-img" src="${api.thumbUrl(node.eid)}" alt="" onerror="this.style.display='none'">`
    : `<div class="nw-panel-img nw-panel-img--ph" style="background:${vague ? '#b9ab86' : meta.color}">${vague ? '?' : esc((node.name || '?').charAt(0).toUpperCase())}</div>`;

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <button class="nw-panel-close" title="Sluiten" aria-label="Sluiten">×</button>
    <div class="nw-panel-head">
      ${headImg}
      <div class="nw-panel-title">
        <div class="nw-panel-name">${esc(node.name)}</div>
        <div class="nw-panel-type"><span class="nw-legend-dot" style="background:${meta.color};border-color:${meta.ring}"></span>${esc(meta.label.replace(/s$/, ''))}${node.subtype ? ' · ' + esc(node.subtype) : ''}${node.deceased ? ' · †' : ''}</div>
      </div>
    </div>
    ${vague
      ? `<p class="nw-panel-vague">Dit onderdeel is nog vaag voor de partij — alleen de naam is bekend.</p>`
      : `<button class="nw-panel-meer" data-open="${esc(node.type)}|${esc(node.eid)}">${icon('book-open')} Meer info</button>`}
    <div class="nw-panel-conns">
      <div class="nw-panel-sub">${conns.length} verbinding${conns.length === 1 ? '' : 'en'}</div>
      ${connHtml || '<p class="nw-panel-none">Nog geen verbindingen.</p>'}
    </div>`;

  panel.querySelector('.nw-panel-close')?.addEventListener('click', () => {
    _selected = null; _renderNodes(); _clearFocus(); _closePanel();
  });
  panel.querySelector('[data-open]')?.addEventListener('click', (ev) => {
    const [type, id] = ev.currentTarget.dataset.open.split('|');
    if (type === 'documenten') window._openDoc?.(id);
    else window._openDetail?.(type, id);
  });
  panel.querySelectorAll('[data-goto]').forEach(btn =>
    btn.addEventListener('click', () => {
      _selected = btn.dataset.goto;
      _renderNodes(); _focus(_selected); _renderPanel();
      _centerOn(_byId[_selected]);
    }));
}

// ════════════════════════════════════════════════════════════════════
//  Toolbar / legenda
// ════════════════════════════════════════════════════════════════════
function _attachToolbar(container) {
  const search = container.querySelector('#nw-search');
  if (search) {
    search.value = _query;
    search.addEventListener('input', () => { _query = search.value; _renderNodes(); });
  }
  container.querySelector('#nw-fit')?.addEventListener('click', _zoomFit);
  container.querySelector('#nw-relayout')?.addEventListener('click', () => {
    _savedPos = {}; _persistPos();
    _layout(_nodes, _edges);
    _renderEdges(); _renderNodes(); _zoomFit();
  });
  container.querySelectorAll('.nw-legend-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type;
      if (_hidden.has(t)) _hidden.delete(t); else _hidden.add(t);
      btn.classList.toggle('nw-legend-item--off', _hidden.has(t));
      if (_selected && _byId[_selected] && _hidden.has(_byId[_selected].type)) {
        _selected = null; _closePanel(); _clearFocus();
      }
      _renderEdges(); _renderNodes(); _updateCount();
    });
  });
}

function _restoreLegend() {
  _hidden.forEach(t => {
    const btn = document.querySelector(`.nw-legend-item[data-type="${t}"]`);
    btn?.classList.add('nw-legend-item--off');
  });
}

function _updateCount() {
  const el = document.getElementById('nw-count');
  if (!el) return;
  const visN = _nodes.filter(n => !_hidden.has(n.type)).length;
  const visE = _edges.filter(e => !_hidden.has(_byId[e.a]?.type) && !_hidden.has(_byId[e.b]?.type)).length;
  el.textContent = `${visN} onderdelen · ${visE} verbindingen`;
}

// ════════════════════════════════════════════════════════════════════
//  Pan / zoom / drag (muis + touch)
// ════════════════════════════════════════════════════════════════════
function _attachSvgEvents() {
  if (!_svg) return;
  _svg.addEventListener('mousedown', _onSvgDown);
  // Globale listeners: eerst verwijderen zodat ze niet stapelen bij her-render
  window.removeEventListener('mousemove', _onMove);
  window.removeEventListener('mouseup', _onUp);
  window.addEventListener('mousemove', _onMove);
  window.addEventListener('mouseup', _onUp);
  _svg.addEventListener('wheel', _onWheel, { passive: false });
  _svg.addEventListener('touchstart', _onTouchStart, { passive: false });
  _svg.addEventListener('touchmove', _onTouchMove, { passive: false });
  _svg.addEventListener('touchend', _onTouchEnd);
  const stage = document.getElementById('nw-stage');
  if (stage) { _viewBox.w = stage.clientWidth || 1200; _viewBox.h = stage.clientHeight || 800; }
  _applyViewBox();
}

function _applyViewBox() {
  _svg?.setAttribute('viewBox', `${_viewBox.x} ${_viewBox.y} ${_viewBox.w} ${_viewBox.h}`);
}

function _scale() {
  return _viewBox.w / (_svg.getBoundingClientRect().width || _viewBox.w);
}

function _onNodeDown(e) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const node = _byId[e.currentTarget.dataset.id];
  if (!node) return;
  _dragging = { id: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y, moved: false, scale: _scale() };
}

function _onSvgDown(e) {
  if (e.button !== 0 || e.target.closest('.nw-node')) return;
  _panning = { sx: e.clientX, sy: e.clientY, ox: _viewBox.x, oy: _viewBox.y, moved: false };
  // Klik op de achtergrond: deselecteer
  if (_selected) { _selected = null; _renderNodes(); _clearFocus(); _closePanel(); }
}

function _onMove(e) {
  if (_dragging) {
    const dx = (e.clientX - _dragging.sx) * _dragging.scale;
    const dy = (e.clientY - _dragging.sy) * _dragging.scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _dragging.moved = true;
    const node = _byId[_dragging.id];
    if (!node) return;
    node.x = _dragging.ox + dx; node.y = _dragging.oy + dy;
    const el = _nodesG.querySelector(`.nw-node[data-id="${CSS.escape(node.id)}"]`);
    if (el) el.setAttribute('transform', `translate(${node.x.toFixed(1)},${node.y.toFixed(1)})`);
    _updateEdgesFor(node.id);
  } else if (_panning) {
    const dx = (e.clientX - _panning.sx) * _scale();
    const dy = (e.clientY - _panning.sy) * _scale();
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _panning.moved = true;
    _viewBox.x = _panning.ox - dx; _viewBox.y = _panning.oy - dy;
    _applyViewBox();
  }
}

function _onUp() {
  if (_dragging) {
    if (_dragging.moved) {
      _suppressClick = true;
      const node = _byId[_dragging.id];
      if (node) { _savedPos[node.id] = { x: node.x, y: node.y }; _persistPos(); }
    }
    _dragging = null;
  }
  _panning = null;
}

function _updateEdgesFor(id) {
  _edgesG.querySelectorAll('.nw-edge').forEach(el => {
    if (el.dataset.a !== id && el.dataset.b !== id) return;
    const a = _byId[el.dataset.a], b = _byId[el.dataset.b];
    if (!a || !b) return;
    el.setAttribute('x1', a.x.toFixed(1)); el.setAttribute('y1', a.y.toFixed(1));
    el.setAttribute('x2', b.x.toFixed(1)); el.setAttribute('y2', b.y.toFixed(1));
  });
}

function _onWheel(e) {
  e.preventDefault();
  const r = _svg.getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width * _viewBox.w + _viewBox.x;
  const my = (e.clientY - r.top) / r.height * _viewBox.h + _viewBox.y;
  const fac = e.deltaY > 0 ? 1.12 : 0.89;
  _viewBox.w = Math.max(120, Math.min(12000, _viewBox.w * fac));
  _viewBox.h = Math.max(80, Math.min(8000, _viewBox.h * fac));
  _viewBox.x = mx - (e.clientX - r.left) / r.width * _viewBox.w;
  _viewBox.y = my - (e.clientY - r.top) / r.height * _viewBox.h;
  _applyViewBox();
}

function _onTouchStart(e) {
  // Onderdruk de synthetische muis-click die de browser ná touchend afvuurt;
  // wij dispatchen zelf een click bij een tik (zie _onTouchEnd). Zonder dit
  // zou een tik tweemaal selecteren (en dus meteen weer deselecteren).
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const nodeEl = e.target.closest('.nw-node');
    if (nodeEl) { _onNodeDown({ button: 0, clientX: t.clientX, clientY: t.clientY, stopPropagation() {}, currentTarget: nodeEl }); }
    else { _panning = { sx: t.clientX, sy: t.clientY, ox: _viewBox.x, oy: _viewBox.y, moved: false }; }
  } else if (e.touches.length === 2) {
    _dragging = null; _panning = null;
    const [t1, t2] = e.touches;
    _pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    _pinchVB = { ..._viewBox };
  }
}

function _onTouchMove(e) {
  if (e.touches.length === 1 && (_dragging || _panning)) {
    e.preventDefault();
    _onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  } else if (e.touches.length === 2 && _pinchDist) {
    e.preventDefault();
    const [t1, t2] = e.touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
    const r = _svg.getBoundingClientRect();
    const midX = (t1.clientX + t2.clientX) / 2, midY = (t1.clientY + t2.clientY) / 2;
    const mx = (midX - r.left) / r.width * _pinchVB.w + _pinchVB.x;
    const my = (midY - r.top) / r.height * _pinchVB.h + _pinchVB.y;
    const fac = _pinchDist / dist;
    _viewBox.w = _pinchVB.w * fac; _viewBox.h = _pinchVB.h * fac;
    _viewBox.x = mx - (midX - r.left) / r.width * _viewBox.w;
    _viewBox.y = my - (midY - r.top) / r.height * _viewBox.h;
    _applyViewBox();
  }
}

function _onTouchEnd(e) {
  const wasTap = (_dragging && !_dragging.moved) || (_panning && !_panning.moved);
  _onUp();
  _pinchDist = 0; _pinchVB = null;
  if (wasTap && e.changedTouches.length) {
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('.nw-node');
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else if (_selected) {
      // Tik op de lege achtergrond → deselecteer (geen mousedown op touch)
      _selected = null; _renderNodes(); _clearFocus(); _closePanel();
    }
  }
}

// ── Zoom helpers ──
function _zoomFit() {
  const vis = _nodes.filter(n => !_hidden.has(n.type));
  if (!_svg || !vis.length) return;
  const pad = NODE_R + 70;
  const minX = Math.min(...vis.map(n => n.x)) - pad;
  const minY = Math.min(...vis.map(n => n.y)) - pad;
  const maxX = Math.max(...vis.map(n => n.x)) + pad;
  const maxY = Math.max(...vis.map(n => n.y)) + pad;
  const stage = document.getElementById('nw-stage');
  const aspect = stage ? (stage.clientWidth / stage.clientHeight) : 1.5;
  let w = maxX - minX, h = maxY - minY;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  _viewBox = { x: cx - w / 2, y: cy - h / 2, w, h };
  _applyViewBox();
}

function _centerOn(node) {
  if (!node || !_svg) return;
  _viewBox.x = node.x - _viewBox.w / 2;
  _viewBox.y = node.y - _viewBox.h / 2;
  _applyViewBox();
}
