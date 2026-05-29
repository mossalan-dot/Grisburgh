/**
 * render-weer.js — De Hemel boven Grisburgh
 *
 * Een levende, real-time luchtscène die de DM instelt en alle spelers zien:
 *   • Sky-gradient per dagdeel (ochtend/middag/avond/nacht)
 *   • Zon of maan, sterren 's nachts
 *   • Drijvende wolken, regenstrepen, dwarrelende sneeuw, mistbanken
 *   • Bliksemflits bij storm
 *   • Silhouet van Grisburgh aan de horizon (met lichtjes 's nachts)
 *   • Inline DM-bediening + real-time broadcast via socket
 */

import { api } from './api.js?v=221';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => window.app?.isDM?.();

let _data   = null;
let _dmOpen = false;

// ── Paletten per dagdeel ───────────────────────────────────────────
const SKIES = {
  ochtend: { stops: [[0,'#bcd4ec'],[40,'#e9d3ad'],[100,'#f6e9d2']], grond: '#b89a66', body: 'zon' },
  middag:  { stops: [[0,'#4f93d4'],[55,'#9cc6ef'],[100,'#dcefff']], grond: '#b6a87e', body: 'zon' },
  avond:   { stops: [[0,'#33356a'],[42,'#9c4f7e'],[74,'#e8854c'],[100,'#ffd49a']], grond: '#6f5446', body: 'zon' },
  nacht:   { stops: [[0,'#060a1c'],[55,'#121a3a'],[100,'#26305a']], grond: '#2a3050', body: 'maan' },
};
// Positie van zon/maan per dagdeel (cx,cy in viewBox 0..800 / 0..400)
const BODY_POS = {
  ochtend: { x: 150, y: 250 },
  middag:  { x: 400, y: 90  },
  avond:   { x: 650, y: 250 },
  nacht:   { x: 600, y: 120 },
};
// Sluier (overlay) per conditie: [kleur, opacity]
const SLUIER = {
  helder:  null,
  bewolkt: ['#8a93a0', 0.28],
  regen:   ['#5c6470', 0.42],
  storm:   ['#2f3340', 0.58],
  mist:    ['#d7dde2', 0.52],
  sneeuw:  ['#cfd8e0', 0.34],
};
// Hoeveel wolken per conditie
const WOLKEN = { helder: 1, bewolkt: 5, regen: 6, storm: 7, mist: 2, sneeuw: 5 };

// Sfeerregels per conditie.
const REGELS = {
  helder:  'Een heldere hemel spant zich over de stad.',
  bewolkt: 'Een grijs wolkendek schuift traag voorbij.',
  regen:   'De regen tikt op de daken en kasseien.',
  storm:   'Donder rommelt; de wind giert door de straten.',
  mist:    'Een dichte mist verzwelgt de torens.',
  sneeuw:  'Stille sneeuw daalt neer over Grisburgh.',
};

// ── Public entry point ─────────────────────────────────────────────
export async function renderWeer(containerEl) {
  const container = containerEl || document.getElementById('section-weer');
  if (!container) return;
  window.weer = _api;

  try {
    _data = await api.weer();
  } catch (err) {
    container.innerHTML = `<div class="weer-error">Kon de hemel niet laden: ${esc(String(err.message))}</div>`;
    return;
  }
  if (!_data.enabled && !isDM()) {
    container.innerHTML = `<div class="weer-error">De hemel is nog niet beschikbaar.</div>`;
    return;
  }
  container.innerHTML = _buildHtml();
}

// ── Tabletmodus: de Hemel als sfeervol rustscherm ──────────────────
// Tekent de huidige luchtscène als achtergrond van het idle-scherm, met de
// campagnetitel eroverheen. Valt terug op een avondlucht als het weer voor
// spelers is uitgezet (de tablet-sessie heeft geen DM-rol).
export async function renderDisplaySky() {
  const idle = document.getElementById('display-idle');
  if (!idle) return;
  let w = null;
  try { w = await api.weer(); } catch { /* netwerk/uit — gebruik fallback */ }
  const state = (w && w.conditie)
    ? w
    : { dagdeel: 'avond', conditie: 'helder', notitie: '' };
  const title = window.app?.state?.meta?.appTitle || 'Grisburgh';
  const sub = state.notitie || REGELS[state.conditie] || '';
  idle.innerHTML = `
    <div class="display-sky-wrap">${_sky(state)}</div>
    <div class="display-idle-inner display-idle-inner--sky">
      <div id="display-campaign-title" class="display-campaign-title">${esc(title)}</div>
      <div class="display-campaign-sub">${esc(sub)}</div>
    </div>`;
}

function _cat() { return _data.catalogus || { condities: [], dagdelen: [], windLabels: [], tempLabels: [] }; }
function _condLabel(id) { return (_cat().condities.find(c => c.id === id) || {}).label || id; }
function _condEmoji(id) { return (_cat().condities.find(c => c.id === id) || {}).emoji || ''; }

function _buildHtml() {
  return `
    <div class="weer-wrap" data-dagdeel="${esc(_data.dagdeel)}" data-conditie="${esc(_data.conditie)}">
      ${_banner()}
      ${_scene()}
      ${isDM() ? _dmPaneel() : ''}
    </div>`;
}

function _banner() {
  return `
    <div class="section-banner section-banner--entity section-banner--weer">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('globe')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">De Hemel</div>
          <div class="section-banner-desc-line">Het weer boven Grisburgh</div>
        </div>
        ${!_data.enabled && isDM() ? `<div class="weer-disabled-badge">Verborgen voor spelers</div>` : ''}
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>`;
}

// ── De luchtscène ──────────────────────────────────────────────────
function _scene() {
  const windLabel = _cat().windLabels[_data.wind] || '';
  const tempLabel = _cat().tempLabels[_data.temp] || '';
  return `
    <div class="weer-scene weer-scene--${esc(_data.conditie)}">
      ${_sky()}
      <div class="weer-info">
        <div class="weer-info-hoofd">
          <span class="weer-info-emoji">${_condEmoji(_data.conditie)}</span>
          <span class="weer-info-conditie">${esc(_condLabel(_data.conditie))}</span>
        </div>
        <div class="weer-info-meta">
          <span class="weer-chip">${icon('zap')} ${esc(windLabel)}</span>
          <span class="weer-chip">${esc(tempLabel)}</span>
          <span class="weer-chip weer-chip--ghost">${esc((_cat().dagdelen.find(d => d.id === _data.dagdeel) || {}).label || '')}</span>
        </div>
        <p class="weer-sfeer">${esc(_data.notitie || REGELS[_data.conditie] || '')}</p>
      </div>
    </div>`;
}

function _sky(w = _data) {
  const sky = SKIES[w.dagdeel] || SKIES.middag;
  const cond = w.conditie;
  const stops = sky.stops.map(([o, c]) => `<stop offset="${o}%" stop-color="${c}"/>`).join('');
  const sluier = SLUIER[cond];
  const showBody = !['regen', 'storm', 'mist'].includes(cond);
  const dimBody = cond === 'bewolkt' || cond === 'sneeuw';

  return `
    <svg class="weer-sky" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="weerSky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
        <radialGradient id="weerSun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff7e0"/><stop offset="55%" stop-color="#ffe49a"/><stop offset="100%" stop-color="#ffcf6b"/>
        </radialGradient>
        <radialGradient id="weerMoon" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stop-color="#fdf8ea"/><stop offset="70%" stop-color="#e6e2cf"/><stop offset="100%" stop-color="#c7c4ad"/>
        </radialGradient>
        <radialGradient id="weerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(255,240,200,0.55)"/><stop offset="100%" stop-color="rgba(255,240,200,0)"/>
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="800" height="400" fill="url(#weerSky)"/>
      ${w.dagdeel === 'nacht' || w.dagdeel === 'avond' ? _stars(w.dagdeel === 'nacht' ? 1 : 0.4) : ''}
      ${showBody ? _body(sky.body, dimBody, w.dagdeel) : ''}
      ${_clouds(cond)}
      ${cond === 'mist' ? _fog() : ''}
      ${_city(sky.grond, w.dagdeel)}
      ${cond === 'regen' || cond === 'storm' ? _rain(cond === 'storm') : ''}
      ${cond === 'sneeuw' ? _snow() : ''}
      ${sluier ? `<rect class="weer-sluier" x="0" y="0" width="800" height="400" fill="${sluier[0]}" opacity="${sluier[1]}"/>` : ''}
      ${cond === 'storm' ? `<rect class="weer-flits" x="0" y="0" width="800" height="400" fill="#fff"/>` : ''}
    </svg>`;
}

function _body(type, dim, dagdeel) {
  const p = BODY_POS[dagdeel] || BODY_POS.middag;
  if (type === 'maan') {
    return `
      <g class="weer-body" opacity="${dim ? 0.5 : 1}">
        <circle cx="${p.x}" cy="${p.y}" r="60" fill="url(#weerGlow)"/>
        <circle cx="${p.x}" cy="${p.y}" r="30" fill="url(#weerMoon)"/>
        <circle cx="${p.x - 9}" cy="${p.y - 7}" r="5" fill="rgba(150,145,120,0.25)"/>
        <circle cx="${p.x + 8}" cy="${p.y + 6}" r="6" fill="rgba(150,145,120,0.22)"/>
      </g>`;
  }
  return `
    <g class="weer-body" opacity="${dim ? 0.55 : 1}">
      <circle class="weer-sun-glow" cx="${p.x}" cy="${p.y}" r="85" fill="url(#weerGlow)"/>
      <circle cx="${p.x}" cy="${p.y}" r="34" fill="url(#weerSun)"/>
    </g>`;
}

function _stars(intensity) {
  const n = Math.round(50 * intensity);
  let s = '<g class="weer-stars">';
  for (let i = 0; i < n; i++) {
    const x = Math.round(Math.random() * 800);
    const y = Math.round(Math.random() * 230);
    const r = (Math.random() * 1.1 + 0.4).toFixed(1);
    const d = (Math.random() * 4).toFixed(1);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" style="animation-delay:${d}s"/>`;
  }
  return s + '</g>';
}

// Drijvende wolken — een vaste set vormen, geanimeerd via CSS.
function _cloudShape(scale, fill) {
  return `<g transform="scale(${scale})">
    <ellipse cx="40" cy="20" rx="40" ry="20" fill="${fill}"/>
    <ellipse cx="80" cy="24" rx="34" ry="18" fill="${fill}"/>
    <ellipse cx="20" cy="28" rx="26" ry="15" fill="${fill}"/>
    <ellipse cx="60" cy="32" rx="44" ry="16" fill="${fill}"/>
  </g>`;
}
function _clouds(cond) {
  const n = WOLKEN[cond] || 2;
  const donker = cond === 'storm' || cond === 'regen';
  const fill = donker ? 'rgba(70,76,90,0.92)' : 'rgba(255,255,255,0.92)';
  let s = '<g class="weer-clouds">';
  for (let i = 0; i < n; i++) {
    const y = 20 + (i * 37) % 150;
    const scale = (0.6 + (i % 3) * 0.35).toFixed(2);
    const dur = (32 + (i * 7) % 26).toFixed(0);
    const delay = (-(i * 6)).toFixed(0);
    const startX = (i * 180) % 900 - 100;
    s += `<g class="weer-cloud" style="animation-duration:${dur}s;animation-delay:${delay}s">
      <g transform="translate(${startX},${y})">${_cloudShape(scale, fill)}</g>
    </g>`;
  }
  return s + '</g>';
}

function _rain(heavy) {
  const n = heavy ? 70 : 45;
  let s = '<g class="weer-rain">';
  for (let i = 0; i < n; i++) {
    const x = Math.round(Math.random() * 820) - 10;
    const len = heavy ? 16 + Math.random() * 10 : 11 + Math.random() * 8;
    const dur = (heavy ? 0.45 : 0.7) + Math.random() * 0.4;
    const delay = (Math.random() * 1.2).toFixed(2);
    s += `<line x1="${x}" y1="-20" x2="${x - 6}" y2="${-20 + len}" stroke="rgba(200,215,235,0.65)" stroke-width="1.4"
            style="animation-duration:${dur}s;animation-delay:${delay}s"/>`;
  }
  return s + '</g>';
}

function _snow() {
  let s = '<g class="weer-snow">';
  for (let i = 0; i < 50; i++) {
    const x = Math.round(Math.random() * 800);
    const r = (Math.random() * 2 + 1).toFixed(1);
    const dur = (5 + Math.random() * 5).toFixed(1);
    const delay = (Math.random() * 6).toFixed(1);
    const sway = (Math.random() * 30 + 10).toFixed(0);
    s += `<circle cx="${x}" cy="-10" r="${r}" fill="rgba(255,255,255,0.9)"
            style="animation-duration:${dur}s;animation-delay:-${delay}s;--sway:${sway}px"/>`;
  }
  return s + '</g>';
}

function _fog() {
  let s = '<g class="weer-fog">';
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 55;
    const dur = (26 + i * 9).toFixed(0);
    const op = (0.16 + i * 0.05).toFixed(2);
    s += `<rect class="weer-fogband" x="-200" y="${y}" width="1200" height="60" rx="30"
            fill="rgba(225,230,235,${op})" style="animation-duration:${dur}s"/>`;
  }
  return s + '</g>';
}

// Silhouet van Grisburgh aan de horizon.
function _city(grond, dagdeel) {
  const donker = dagdeel === 'nacht';
  const fill = donker ? '#0c1024' : 'rgba(40,40,58,0.85)';
  // Skyline: torens, daken en tinnen langs de onderrand.
  const path = `M0,400 L0,330 L40,330 L40,300 L70,300 L70,330 L120,330 L120,290
    L135,275 L150,290 L150,330 L210,330 L210,310 L240,310 L240,260 L255,245 L270,260 L270,310
    L320,310 L320,330 L360,330 L360,285 L375,285 L375,255 L390,255 L405,255 L405,285 L420,285 L420,330
    L470,330 L470,300 L500,300 L500,330 L540,330 L540,270 L555,255 L570,270 L570,330 L620,330
    L620,305 L650,305 L650,330 L700,330 L700,295 L715,280 L730,295 L730,330 L770,330 L770,315 L800,315 L800,400 Z`;
  let lights = '';
  if (donker) {
    // Verlichte raampjes.
    const wins = [[130,300],[247,275],[250,295],[383,270],[398,275],[552,278],[710,300],[45,315]];
    lights = wins.map(([x, y]) =>
      `<rect x="${x}" y="${y}" width="4" height="5" fill="rgba(255,210,120,0.9)" class="weer-window"/>`).join('');
  }
  return `
    <g class="weer-city">
      <rect x="0" y="330" width="800" height="70" fill="${grond}"/>
      <path d="${path}" fill="${fill}"/>
      ${lights}
    </g>`;
}

// ── DM-paneel ──────────────────────────────────────────────────────
function _dmPaneel() {
  if (!_dmOpen) {
    return `<div class="weer-dm-toggle"><button class="weer-btn" onclick="window.weer.toggleDM()">${icon('settings')} Hemel instellen</button></div>`;
  }
  const c = _cat();
  const dagdeelBtns = c.dagdelen.map(d =>
    `<button class="weer-pick${_data.dagdeel === d.id ? ' weer-pick--active' : ''}" onclick="window.weer.set('dagdeel','${esc(d.id)}')">${esc(d.label)}</button>`).join('');
  const condBtns = c.condities.map(co =>
    `<button class="weer-pick${_data.conditie === co.id ? ' weer-pick--active' : ''}" onclick="window.weer.set('conditie','${esc(co.id)}')"><span class="weer-pick-emoji">${co.emoji}</span> ${esc(co.label)}</button>`).join('');
  const tempOpts = c.tempLabels.map((t, i) =>
    `<option value="${i}"${_data.temp === i ? ' selected' : ''}>${esc(t)}</option>`).join('');

  return `
    <div class="weer-dm-panel">
      <div class="weer-dm-panel-head">
        <h3>${icon('settings')} Hemel instellen</h3>
        <button class="weer-icon-btn" onclick="window.weer.toggleDM()" title="Sluiten">${icon('x')}</button>
      </div>

      <label class="weer-cfg-check">
        <input type="checkbox" id="weer-enabled" ${_data.enabled ? 'checked' : ''} onchange="window.weer.set('enabled', this.checked)">
        Hemel zichtbaar voor spelers
      </label>

      <div class="weer-cfg-block">
        <div class="weer-cfg-label">Dagdeel</div>
        <div class="weer-pick-row">${dagdeelBtns}</div>
      </div>

      <div class="weer-cfg-block">
        <div class="weer-cfg-label">Weer
          <button class="weer-btn weer-btn--small" onclick="window.weer.roll()" title="Rol een willekeurig weertype">${icon('refresh-cw')} Rol het weer</button>
        </div>
        <div class="weer-pick-row weer-pick-row--wrap">${condBtns}</div>
      </div>

      <div class="weer-cfg-row">
        <label class="weer-cfg-field">Windkracht: <strong id="weer-wind-val">${esc(c.windLabels[_data.wind] || '')}</strong>
          <input type="range" id="weer-wind" min="0" max="${c.windLabels.length - 1}" value="${_data.wind}"
            oninput="document.getElementById('weer-wind-val').textContent=this.parentElement.dataset.labels.split('|')[this.value]"
            onchange="window.weer.set('wind', +this.value)" data-labels="${esc(c.windLabels.join('|'))}">
        </label>
        <label class="weer-cfg-field">Temperatuur
          <select id="weer-temp" onchange="window.weer.set('temp', +this.value)">${tempOpts}</select>
        </label>
      </div>

      <label class="weer-cfg-field weer-cfg-full">Sfeernotitie (optioneel)
        <input id="weer-notitie" class="weer-cfg-input" value="${esc(_data.notitie || '')}"
          placeholder="bijv. Een grauwe ochtend boven de haven"
          onkeydown="if(event.key==='Enter')window.weer.saveNotitie()">
      </label>
      <div class="weer-dm-panel-foot">
        <button class="weer-btn weer-btn--save" onclick="window.weer.saveNotitie()">${icon('save')} Notitie opslaan</button>
      </div>
    </div>`;
}

// ── Toast ──────────────────────────────────────────────────────────
function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => {
    t.classList.remove('map-toast--show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 3000);
}

// ── Publieke acties (window.weer.*) ────────────────────────────────
const _api = {
  refresh: () => renderWeer(),

  async set(veld, waarde) {
    try {
      _data = { ..._data, ...(await api.saveWeer({ [veld]: waarde })) };
      // Behoud catalogus (saveWeer geeft die niet terug).
      await renderWeer();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async roll() {
    try {
      await api.saveWeer({ roll: true });
      await renderWeer();
      _toast('🎲 Het weer is geworpen.');
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async saveNotitie() {
    const v = document.getElementById('weer-notitie')?.value || '';
    try {
      await api.saveWeer({ notitie: v });
      await renderWeer();
      _toast('Sfeernotitie opgeslagen.');
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  toggleDM() { _dmOpen = !_dmOpen; renderWeer(); },
};

window.weer = _api;
