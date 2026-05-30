/**
 * render-orakel.js — Het Orakel der Sterren
 *
 * Een sfeervolle waarzeggerij: trek een omenkaart die met een 3D-flip
 * opengedraaid wordt, met een voorteken en een duiding. Trekt de DM (of een
 * speler) een kaart, dan zien alle clients de kaart in real-time verschijnen.
 * De DM kan het orakel in/uitschakelen en het dek aanpassen.
 */

import { api } from './api.js?v=221';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => window.app?.isDM?.();

let _data    = null;
let _dmOpen  = false;
let _flipped = false;
let _busy    = false;

export async function renderOrakel(containerEl) {
  const container = containerEl || document.getElementById('section-orakel');
  if (!container) return;
  window.orakel = _api;
  try {
    _data = await api.orakel();
  } catch (err) {
    container.innerHTML = `<div class="orakel-error">Kon het orakel niet raadplegen: ${esc(String(err.message))}</div>`;
    return;
  }
  if (!_data.enabled && !isDM()) {
    container.innerHTML = `<div class="orakel-error">Het orakel zwijgt voorlopig.</div>`;
    return;
  }
  _flipped = !!_data.lastDraw?.card;
  container.innerHTML = _buildHtml();
}

function _buildHtml() {
  const last = _data.lastDraw;
  const frontCard = last?.card || _data.deck[0];
  return `
    <div class="orakel-wrap">
      <div class="section-banner section-banner--entity section-banner--orakel">
        <div class="section-banner-head">
          <div class="section-banner-icon-wrap">${icon('sparkles')}</div>
          <div class="section-banner-info">
            <div class="section-banner-label">Het Orakel der Sterren</div>
            <div class="section-banner-desc-line">Bevraag het lot — trek een kaart</div>
          </div>
          ${!_data.enabled && isDM() ? `<div class="orakel-disabled-badge">Verborgen voor spelers</div>` : ''}
        </div>
        <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
      </div>

      <div class="orakel-altaar">
        <p class="orakel-intro">${esc(_data.intro || '')}</p>
        <div class="orakel-card-stage">
          <div class="orakel-card${_flipped ? ' is-flipped' : ''}" id="orakel-card">
            <div class="orakel-face orakel-face--back">${_cardBack()}</div>
            <div class="orakel-face orakel-face--front" id="orakel-front">${_cardFront(frontCard)}</div>
          </div>
        </div>
        <div class="orakel-draw-row">
          <button class="orakel-draw-btn" onclick="window.orakel.draw()">${icon('sparkles')} ${_flipped ? 'Trek opnieuw' : 'Trek een kaart'}</button>
        </div>
        <div class="orakel-last" id="orakel-last">${last?.by ? `<span class="orakel-last-by">Laatst getrokken door ${esc(last.by)}</span>` : ''}</div>
      </div>

      ${isDM() ? _dmPaneel() : ''}
    </div>`;
}

// ── Kaart-achterkant (ornament) ────────────────────────────────────
function _cardBack() {
  return `
    <svg class="orakel-back-svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="orakelBackG" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stop-color="#2b2350"/><stop offset="60%" stop-color="#1b1738"/><stop offset="100%" stop-color="#100d22"/>
        </radialGradient>
        <radialGradient id="orakelStarG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(230,210,140,0.9)"/><stop offset="100%" stop-color="rgba(230,210,140,0)"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="200" height="300" fill="url(#orakelBackG)"/>
      <rect x="9" y="9" width="182" height="282" rx="10" fill="none" stroke="#b89a4a" stroke-width="1.4" opacity="0.7"/>
      <rect x="15" y="15" width="170" height="270" rx="7" fill="none" stroke="#b89a4a" stroke-width="0.6" opacity="0.4"/>
      <g stroke="#c9a23a" stroke-width="0.8" fill="none" opacity="0.55">
        <path d="M100 30 C70 70, 70 90, 100 110 C130 90, 130 70, 100 30 Z"/>
        <path d="M100 270 C70 230, 70 210, 100 190 C130 210, 130 230, 100 270 Z"/>
        <circle cx="100" cy="150" r="46"/>
        <circle cx="100" cy="150" r="34"/>
      </g>
      <circle cx="100" cy="150" r="40" fill="url(#orakelStarG)"/>
      <g fill="#f0e2a8">
        <path d="M100 116 L106 144 L134 150 L106 156 L100 184 L94 156 L66 150 L94 144 Z"/>
      </g>
      ${_starfield(26)}
    </svg>`;
}
function _starfield(n) {
  let s = '<g fill="#f6efcf">';
  for (let i = 0; i < n; i++) {
    const x = (i * 73 % 180) + 10;
    const y = (i * 131 % 280) + 10;
    const r = (i % 3 === 0) ? 1.3 : 0.7;
    s += `<circle class="orakel-back-star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${(i % 5) * 0.6}s"/>`;
  }
  return s + '</g>';
}

// ── Kaart-voorkant (het voorteken) ─────────────────────────────────
function _cardFront(card) {
  if (!card) return '';
  const kleur = card.kleur || '#b8862b';
  return `
    <div class="orakel-front-inner" style="--ok:${esc(kleur)}">
      <div class="orakel-front-frame"></div>
      <div class="orakel-front-symbool">${esc(card.symbool || '✦')}</div>
      <div class="orakel-front-titel">${esc(card.titel || '')}</div>
      <div class="orakel-front-rule"><span>✦</span></div>
      <div class="orakel-front-omen">${esc(card.omen || '')}</div>
      ${card.duiding ? `<div class="orakel-front-duiding">${esc(card.duiding)}</div>` : ''}
    </div>`;
}

// ── DM-paneel: dek beheren ─────────────────────────────────────────
function _dmPaneel() {
  if (!_dmOpen) {
    return `<div class="orakel-dm-toggle"><button class="orakel-btn" onclick="window.orakel.toggleDM()">${icon('settings')} Orakel instellen</button></div>`;
  }
  const rows = _data.deck.map((c, i) => `
    <div class="orakel-cfg-card" data-idx="${i}">
      <div class="orakel-cfg-card-head">
        <input class="orakel-cfg-input orakel-cf-symbool" value="${esc(c.symbool)}" title="Symbool" maxlength="4">
        <input class="orakel-cfg-input orakel-cf-titel" value="${esc(c.titel)}" placeholder="Titel">
        <input type="color" class="orakel-cf-kleur" value="${esc(/^#[0-9a-fA-F]{6}$/.test(c.kleur) ? c.kleur : '#b8862b')}" title="Kleur">
        <button class="orakel-icon-btn orakel-icon-btn--danger" onclick="window.orakel.removeCard(${i})" title="Verwijderen">${icon('x')}</button>
      </div>
      <input class="orakel-cfg-input orakel-cf-omen" value="${esc(c.omen)}" placeholder="Voorteken">
      <input class="orakel-cfg-input orakel-cf-duiding" value="${esc(c.duiding)}" placeholder="Duiding">
    </div>`).join('');
  return `
    <div class="orakel-dm-panel">
      <div class="orakel-dm-panel-head">
        <h3>${icon('settings')} Orakel instellen</h3>
        <button class="orakel-icon-btn" onclick="window.orakel.toggleDM()" title="Sluiten">${icon('x')}</button>
      </div>
      <label class="orakel-cfg-check">
        <input type="checkbox" id="orakel-enabled" ${_data.enabled ? 'checked' : ''}>
        Orakel zichtbaar voor spelers
      </label>
      <label class="orakel-cfg-field">Introtekst
        <input class="orakel-cfg-input" id="orakel-intro" value="${esc(_data.intro || '')}" placeholder="Schud de kaarten…">
      </label>
      <div class="orakel-cfg-deck-head">
        <span>Kaarten (${_data.deck.length})</span>
        <button class="orakel-btn orakel-btn--small" onclick="window.orakel.addCard()">${icon('plus')} Kaart</button>
      </div>
      <div class="orakel-cfg-deck" id="orakel-cfg-deck">${rows}</div>
      <div class="orakel-dm-panel-foot">
        <button class="orakel-btn orakel-btn--save" onclick="window.orakel.saveConfig()">${icon('save')} Opslaan</button>
      </div>
    </div>`;
}

function _toast(msg) {
  const t = document.createElement('div');
  t.className = 'map-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('map-toast--show'));
  setTimeout(() => {
    t.classList.remove('map-toast--show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 3200);
}

// Animeer het tonen van een getrokken kaart (gedeeld via socket).
function _showDrawn(card, by) {
  const cardEl = document.getElementById('orakel-card');
  const frontEl = document.getElementById('orakel-front');
  const lastEl = document.getElementById('orakel-last');
  if (!cardEl || !frontEl) return;
  const apply = () => {
    frontEl.innerHTML = _cardFront(card);
    cardEl.classList.add('is-flipped');
    _flipped = true;
    if (lastEl) lastEl.innerHTML = by ? `<span class="orakel-last-by">Laatst getrokken door ${esc(by)}</span>` : '';
    const btn = document.querySelector('.orakel-draw-btn');
    if (btn) btn.innerHTML = `${icon('sparkles')} Trek opnieuw`;
  };
  if (cardEl.classList.contains('is-flipped')) {
    // Eerst terugdraaien voor een schud-gevoel, dan de nieuwe kaart tonen
    cardEl.classList.remove('is-flipped');
    setTimeout(apply, 460);
  } else {
    apply();
  }
}

const _api = {
  refresh: () => renderOrakel(),

  async draw() {
    if (_busy) return;
    _busy = true;
    const btn = document.querySelector('.orakel-draw-btn');
    if (btn) btn.classList.add('orakel-draw-btn--busy');
    try {
      // De uitkomst komt via de socket bij iedereen binnen (incl. deze client).
      await api.drawOrakel();
    } catch (err) {
      _toast(esc(err.message || 'Het orakel zwijgt.'));
    } finally {
      setTimeout(() => { _busy = false; if (btn) btn.classList.remove('orakel-draw-btn--busy'); }, 700);
    }
  },

  // Aangeroepen door de socket-client bij 'orakel:drawn'
  onDrawn(card, by) {
    if (!card) return;
    _showDrawn(card, by);
  },

  toggleDM() { _dmOpen = !_dmOpen; renderOrakel(); },

  addCard() {
    _data.deck.push({ id: 'c_' + Date.now().toString(36), titel: 'Nieuwe kaart', symbool: '✦', kleur: '#b8862b', omen: '', duiding: '' });
    renderOrakel();
  },

  removeCard(i) {
    if (_data.deck.length <= 1) { _toast('Het dek moet minstens één kaart houden.'); return; }
    _data.deck.splice(i, 1);
    renderOrakel();
  },

  async saveConfig() {
    const deck = [...document.querySelectorAll('.orakel-cfg-card')].map(el => ({
      id:      _data.deck[+el.dataset.idx]?.id,
      symbool: el.querySelector('.orakel-cf-symbool').value.trim() || '✦',
      titel:   el.querySelector('.orakel-cf-titel').value.trim() || 'Naamloze kaart',
      kleur:   el.querySelector('.orakel-cf-kleur').value,
      omen:    el.querySelector('.orakel-cf-omen').value.trim(),
      duiding: el.querySelector('.orakel-cf-duiding').value.trim(),
    }));
    const payload = {
      enabled: document.getElementById('orakel-enabled').checked,
      intro:   document.getElementById('orakel-intro').value.trim(),
      deck,
    };
    try {
      await api.saveOrakelConfig(payload);
      _toast('Orakel opgeslagen.');
      await renderOrakel();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },
};

window.orakel = _api;
