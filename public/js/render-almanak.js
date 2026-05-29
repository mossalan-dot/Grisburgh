/**
 * render-almanak.js — De Almanak van Isfār
 *
 * Een sfeervolle, in-wereld kalender met:
 *   • "Vandaag"-kaart met een berekende, geanimeerde maanfase
 *   • Maandkalender met weekdagen, vandaag-markering, maanstanden en
 *     gebeurtenis-stippen
 *   • Gebeurtenissen (feestdagen + campagnemomenten), zichtbaarheidsbewust
 *   • Seizoensthema dat de hele sectie subtiel kleurt
 *   • Inline DM-bediening: tijd laten verstrijken, datum zetten, de kalender
 *     instellen en gebeurtenissen beheren
 */

import { api } from './api.js?v=221';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => window.app?.isDM?.();

// ── Module-state ───────────────────────────────────────────────────
let _data       = null;   // laatste serverrespons
let _viewJaar   = null;   // jaar dat de kalender toont
let _viewMaand  = 0;      // maand-index die de kalender toont
let _dmOpen     = false;  // DM-instelpaneel open?

// ── Sfeerteksten ───────────────────────────────────────────────────
const SEIZOEN_REGELS = {
  winter: 'De wereld ligt onder een laken van rijp; haarden branden laat.',
  lente:  'Het land ontwaakt; knoppen breken open langs de wegen.',
  zomer:  'Lange, gouden dagen; de velden staan zwaar en stil.',
  herfst: 'Bladeren dwarrelen; de oogst is binnen en de avonden lengen.',
};
const MAAN_REGELS = {
  'Nieuwe maan':      'In het zwart van de nieuwe maan bewegen zich wie niet gezien willen worden.',
  'Wassende sikkel':  'Een dunne sikkel klimt — een tijd van beginnen.',
  'Eerste kwartier':  'De halve maan staat hoog; het tij keert.',
  'Wassende maan':    'Het licht zwelt aan; verwachting hangt in de lucht.',
  'Volle maan':       'De volle maan giet zilver over de daken; oude krachten roeren zich.',
  'Afnemende maan':   'Het maanlicht trekt zich terug; tijd om af te ronden.',
  'Laatste kwartier': 'De late halve maan waakt over de stille uren.',
  'Afnemende sikkel': 'Een laatste sliver dooft — de cyclus nadert haar einde.',
};

// ── Public entry point ─────────────────────────────────────────────
export async function renderAlmanak(containerEl) {
  const container = containerEl || document.getElementById('section-almanak');
  if (!container) return;
  window.almanak = _api;

  try {
    _data = await api.almanak(_viewJaar === null ? undefined : _viewJaar);
  } catch (err) {
    container.innerHTML = `<div class="alm-error">Kon de almanak niet laden: ${esc(String(err.message))}</div>`;
    return;
  }

  // Almanak uit en geen DM → niets te zien.
  if (!_data.enabled && !isDM()) {
    container.innerHTML = `<div class="alm-error">De almanak is nog niet beschikbaar.</div>`;
    return;
  }

  // Eerste render: stem het kalenderzicht af op "vandaag".
  if (_viewJaar === null) {
    _viewJaar  = _data.vandaag.jaar;
    _viewMaand = _data.vandaag.maandIdx;
  }
  // Als het gevraagde jaar afweek, opnieuw ophalen voor de juiste view.
  if (_data.view.jaar !== _viewJaar) {
    _data = await api.almanak(_viewJaar);
  }

  const seizoen = _data.today?.seizoen;
  container.style.setProperty('--alm-seizoen', seizoen?.kleur || '#6f93c4');
  container.innerHTML = _buildHtml();
}

// ── HTML-opbouw ────────────────────────────────────────────────────
function _buildHtml() {
  return `
    <div class="alm-wrap" data-seizoen="${esc(_data.today?.seizoen?.id || '')}">
      ${_banner()}
      <div class="alm-grid">
        ${_vandaagKaart()}
        ${_kalenderKaart()}
      </div>
      ${_gebeurtenissenLijst()}
      ${isDM() ? _dmPaneel() : ''}
    </div>
  `;
}

function _banner() {
  return `
    <div class="section-banner section-banner--entity section-banner--almanak">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('moon')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">De Almanak</div>
          <div class="section-banner-desc-line">Tijd, getij en de gang der manen</div>
        </div>
        ${!_data.enabled && isDM() ? `<div class="alm-disabled-badge">Verborgen voor spelers</div>` : ''}
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>`;
}

// ── "Vandaag"-kaart met maanfase ───────────────────────────────────
function _vandaagKaart() {
  const t = _data.today;
  const fase = t.maanFase;
  const pct = Math.round(t.maanVerlicht * 100);
  const sfeerSeizoen = SEIZOEN_REGELS[t.seizoen?.id] || '';
  const sfeerMaan = MAAN_REGELS[fase?.naam] || '';

  return `
    <div class="alm-vandaag">
      <div class="alm-moon-stage">
        ${_moonSVG(t.maanFractie, 188)}
        <div class="alm-moon-caption">
          <span class="alm-moon-fase">${esc(fase?.naam || '')}</span>
          <span class="alm-moon-pct">${pct}% verlicht${_data.maanNaam ? ' · ' + esc(_data.maanNaam) : ''}</span>
        </div>
      </div>
      <div class="alm-vandaag-info">
        <div class="alm-weekdag">${esc(t.weekdag)}</div>
        <div class="alm-datum">
          <span class="alm-datum-dag">${t.dag}</span>
          <span class="alm-datum-maand">${esc(t.maandNaam)}</span>
        </div>
        <div class="alm-jaar">${t.jaar}${_data.eraNaam ? ' ' + esc(_data.eraNaam) : ''}</div>
        ${t.seizoen ? `<div class="alm-seizoen-badge" style="--badge:${esc(t.seizoen.kleur)}">${_seizoenIcon(t.seizoen.id)} ${esc(t.seizoen.naam)}</div>` : ''}
        <p class="alm-sfeer">${esc(sfeerMaan || sfeerSeizoen)}</p>
        ${isDM() ? _tijdControls() : ''}
      </div>
    </div>`;
}

function _tijdControls() {
  return `
    <div class="alm-tijd-controls">
      <span class="alm-tijd-label">De tijd verstrijkt</span>
      <div class="alm-tijd-knoppen">
        <button class="alm-tijd-btn" onclick="window.almanak.delta(-7)" title="Een week terug">−7</button>
        <button class="alm-tijd-btn" onclick="window.almanak.delta(-1)" title="Een dag terug">−1</button>
        <button class="alm-tijd-btn alm-tijd-btn--plus" onclick="window.almanak.delta(1)" title="Een dag verder">+1 dag</button>
        <button class="alm-tijd-btn alm-tijd-btn--plus" onclick="window.almanak.delta(7)" title="Een week verder">+7</button>
        <button class="alm-tijd-btn alm-tijd-btn--set" onclick="window.almanak.openSetDatum()" title="Datum instellen">${icon('pencil')}</button>
      </div>
    </div>`;
}

// ── Maanfase als SVG (berekend uit de fractie) ─────────────────────
function _moonSVG(frac, size = 180) {
  const r = 50;
  const waxing = frac < 0.5;
  const illum  = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const cosv   = Math.cos(2 * Math.PI * frac);
  const ellRx  = Math.max(0.0001, Math.abs(cosv) * r);
  const lit    = 'url(#almMoonGrad)';
  const dark   = '#262d4a';
  const halfX  = waxing ? 0 : -r;            // verlichte helft: rechts (wassend) of links (afnemend)
  const termFill = illum < 0.5 ? dark : lit; // sikkel: terminator donker — gibbeus: terminator licht
  return `
    <svg class="alm-moon-svg" viewBox="-60 -60 120 120" width="${size}" height="${size}" aria-hidden="true">
      <defs>
        <radialGradient id="almMoonGrad" cx="42%" cy="36%" r="78%">
          <stop offset="0%"  stop-color="#fdf8ea"/>
          <stop offset="65%" stop-color="#ece0c0"/>
          <stop offset="100%" stop-color="#c6b489"/>
        </radialGradient>
        <radialGradient id="almMoonHalo" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stop-color="rgba(220,228,255,0.35)"/>
          <stop offset="100%" stop-color="rgba(220,228,255,0)"/>
        </radialGradient>
        <clipPath id="almMoonClip"><circle r="${r}"/></clipPath>
      </defs>
      <circle r="58" fill="url(#almMoonHalo)"/>
      <g clip-path="url(#almMoonClip)">
        <circle r="${r}" fill="${dark}"/>
        <rect x="${halfX}" y="${-r}" width="${r}" height="${2 * r}" fill="${lit}"/>
        <ellipse cx="0" cy="0" rx="${ellRx.toFixed(2)}" ry="${r}" fill="${termFill}"/>
        <circle cx="-16" cy="-13" r="7"  class="alm-crater"/>
        <circle cx="13"  cy="9"   r="9"  class="alm-crater"/>
        <circle cx="19"  cy="-19" r="4"  class="alm-crater"/>
        <circle cx="-7"  cy="21"  r="5"  class="alm-crater"/>
        <circle cx="2"   cy="-3"  r="3"  class="alm-crater"/>
      </g>
      <circle r="${r}" fill="none" class="alm-moon-rim"/>
    </svg>`;
}

function _seizoenIcon(id) {
  if (id === 'winter') return icon('sparkles');
  if (id === 'lente')  return icon('tree-pine');
  if (id === 'zomer')  return icon('sparkles');
  if (id === 'herfst') return icon('tree-pine');
  return icon('star');
}

// ── Maandkalender ──────────────────────────────────────────────────
function _kalenderKaart() {
  const view = _data.view;
  const maand = view.maanden[_viewMaand];
  if (!maand) return '';
  const weekLen = _data.weekdagen.length;
  const cyclus = _data.maanCyclus;
  const offset = _data.maanOffset || 0;
  const half = Math.round(cyclus / 2);

  // Gebeurtenissen van deze maand (jaarlijks of dit jaar).
  const evPerDag = {};
  for (const g of _data.gebeurtenissen) {
    if (g.maandIdx !== _viewMaand) continue;
    if (g.jaar !== null && g.jaar !== view.jaar) continue;
    (evPerDag[g.dag] = evPerDag[g.dag] || []).push(g);
  }

  // Weekdag-koprij.
  const heads = _data.weekdagen.map(w =>
    `<div class="alm-cal-head">${esc(w.slice(0, 2))}</div>`).join('');

  // Lege cellen vóór dag 1.
  let cells = '';
  for (let i = 0; i < maand.startWeekdag; i++) cells += `<div class="alm-cal-cell alm-cal-cell--empty"></div>`;

  const today = _data.today;
  const isHuidigeMaand = view.jaar === today.jaar && _viewMaand === today.maandIdx;

  for (let d = 1; d <= maand.dagen; d++) {
    const absDay = maand.startAbsDag + (d - 1);
    const pos = ((absDay + offset) % cyclus + cyclus) % cyclus;
    const isNew = pos === 0;
    const isFull = pos === half;
    const isQuarter = pos === Math.round(cyclus / 4) || pos === Math.round(3 * cyclus / 4);
    const evs = evPerDag[d] || [];
    const isToday = isHuidigeMaand && d === today.dag;

    let moonGlyph = '';
    if (isNew) moonGlyph = `<span class="alm-cal-moon" title="Nieuwe maan">🌑</span>`;
    else if (isFull) moonGlyph = `<span class="alm-cal-moon alm-cal-moon--full" title="Volle maan">🌕</span>`;
    else if (isQuarter) moonGlyph = `<span class="alm-cal-moon" title="Kwartier">${pos < half ? '🌓' : '🌗'}</span>`;

    const dots = evs.slice(0, 4).map(g =>
      `<span class="alm-cal-dot" style="background:${esc(g.kleur || 'var(--alm-seizoen)')}"></span>`).join('');

    cells += `
      <button class="alm-cal-cell${isToday ? ' alm-cal-cell--today' : ''}${evs.length ? ' alm-cal-cell--ev' : ''}"
        onclick="window.almanak.dayClick(${d})" title="${esc(evs.map(e => e.naam).join(', '))}">
        <span class="alm-cal-num">${d}</span>
        ${moonGlyph}
        ${dots ? `<span class="alm-cal-dots">${dots}</span>` : ''}
      </button>`;
  }

  const seizoen = maand.seizoen;
  return `
    <div class="alm-kalender" style="--alm-maand-seizoen:${esc(seizoen?.kleur || 'var(--alm-seizoen)')}">
      <div class="alm-cal-nav">
        <button class="alm-cal-navbtn" onclick="window.almanak.stepMonth(-1)" title="Vorige maand">${icon('chevron-left')}</button>
        <div class="alm-cal-title">
          <span class="alm-cal-maandnaam">${esc(maand.naam)}</span>
          <span class="alm-cal-jaar">
            <button class="alm-cal-yearbtn" onclick="window.almanak.stepYear(-1)" title="Vorig jaar">‹</button>
            ${view.jaar}${_data.eraNaam ? ' ' + esc(_data.eraNaam) : ''}
            <button class="alm-cal-yearbtn" onclick="window.almanak.stepYear(1)" title="Volgend jaar">›</button>
          </span>
        </div>
        <button class="alm-cal-navbtn" onclick="window.almanak.stepMonth(1)" title="Volgende maand">${icon('chevron-right')}</button>
      </div>
      ${seizoen ? `<div class="alm-cal-seizoen">${_seizoenIcon(seizoen.id)} ${esc(seizoen.naam)}</div>` : ''}
      <div class="alm-cal-grid" style="grid-template-columns:repeat(${weekLen},1fr)">
        ${heads}
        ${cells}
      </div>
    </div>`;
}

// ── Gebeurtenissenlijst ────────────────────────────────────────────
function _gebeurtenissenLijst() {
  const view = _data.view;
  const lijst = _data.gebeurtenissen
    .filter(g => g.jaar === null || g.jaar === view.jaar)
    .map(g => ({ ...g, _doy: _doy(g.maandIdx, g.dag) }))
    .sort((a, b) => a._doy - b._doy);

  const rows = lijst.map(g => {
    const maandNaam = _data.maanden[g.maandIdx]?.naam || '';
    const kleur = g.kleur || 'var(--alm-seizoen)';
    return `
      <div class="alm-ev-row" style="--ev:${esc(kleur)}">
        <div class="alm-ev-datum">
          <span class="alm-ev-dag">${g.dag}</span>
          <span class="alm-ev-maand">${esc(maandNaam.slice(0, 3))}</span>
        </div>
        <div class="alm-ev-body">
          <div class="alm-ev-naam">
            ${esc(g.naam)}
            ${g.jaar === null ? `<span class="alm-ev-tag" title="Elk jaar">jaarlijks</span>` : ''}
            ${isDM() && g.zichtbaar === false ? `<span class="alm-ev-tag alm-ev-tag--hidden">verborgen</span>` : ''}
          </div>
          ${g.beschrijving ? `<div class="alm-ev-desc">${esc(g.beschrijving)}</div>` : ''}
        </div>
        ${isDM() ? `
          <div class="alm-ev-acties">
            <button class="alm-icon-btn" onclick="window.almanak.openEvent('${esc(g.id)}')" title="Bewerken">${icon('pencil')}</button>
            <button class="alm-icon-btn alm-icon-btn--danger" onclick="window.almanak.deleteEvent('${esc(g.id)}')" title="Verwijderen">${icon('trash')}</button>
          </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="alm-events">
      <div class="alm-events-head">
        <h3 class="alm-events-title">${icon('star')} Gebeurtenissen in ${view.jaar}${_data.eraNaam ? ' ' + esc(_data.eraNaam) : ''}</h3>
        ${isDM() ? `<button class="alm-btn alm-btn--add" onclick="window.almanak.openEvent()">${icon('plus')} Gebeurtenis</button>` : ''}
      </div>
      ${rows || `<p class="alm-empty">Nog geen gebeurtenissen voor dit jaar.</p>`}
    </div>`;
}

function _doy(maandIdx, dag) {
  let t = 0;
  for (let i = 0; i < maandIdx; i++) t += (_data.maanden[i]?.dagen || 0);
  return t + dag;
}

// ── DM-instelpaneel ────────────────────────────────────────────────
function _dmPaneel() {
  if (!_dmOpen) {
    return `<div class="alm-dm-toggle"><button class="alm-btn" onclick="window.almanak.toggleDM()">${icon('settings')} Almanak instellen</button></div>`;
  }
  const a = _data;
  const maandRijen = a.maanden.map((m, i) => `
    <div class="alm-cfg-maandrij" data-idx="${i}">
      <input class="alm-cfg-input alm-cfg-mnaam" value="${esc(m.naam)}" placeholder="Maandnaam">
      <input class="alm-cfg-input alm-cfg-mdagen" type="number" min="1" max="60" value="${m.dagen}" title="Dagen">
      <select class="alm-cfg-input alm-cfg-mseizoen" title="Seizoen">
        ${a.seizoenen.map(s => `<option value="${esc(s.id)}"${s.maanden?.includes(i) ? ' selected' : ''}>${esc(s.naam)}</option>`).join('')}
      </select>
      <button class="alm-icon-btn alm-icon-btn--danger" onclick="window.almanak.removeMonth(${i})" title="Verwijderen">${icon('x')}</button>
    </div>`).join('');

  const seizoenRijen = a.seizoenen.map(s => `
    <div class="alm-cfg-seizoenrij" data-id="${esc(s.id)}">
      <input type="color" class="alm-cfg-skleur" value="${esc(s.kleur || '#6f93c4')}">
      <input class="alm-cfg-input alm-cfg-snaam" value="${esc(s.naam)}" placeholder="Seizoen">
    </div>`).join('');

  return `
    <div class="alm-dm-panel">
      <div class="alm-dm-panel-head">
        <h3>${icon('settings')} Almanak instellen</h3>
        <button class="alm-icon-btn" onclick="window.almanak.toggleDM()" title="Sluiten">${icon('x')}</button>
      </div>

      <label class="alm-cfg-check">
        <input type="checkbox" id="alm-cfg-enabled" ${a.enabled ? 'checked' : ''}>
        Almanak zichtbaar voor spelers
      </label>

      <div class="alm-cfg-row">
        <label>Tijdperk (achter jaartal)
          <input class="alm-cfg-input" id="alm-cfg-era" value="${esc(a.eraNaam || '')}" placeholder="bijv. n.S.">
        </label>
        <label>Naam van de maan
          <input class="alm-cfg-input" id="alm-cfg-maannaam" value="${esc(a.maanNaam || '')}" placeholder="bijv. de Manen">
        </label>
      </div>

      <div class="alm-cfg-row">
        <label>Maancyclus (dagen)
          <input class="alm-cfg-input" id="alm-cfg-cyclus" type="number" min="2" max="200" value="${a.maanCyclus}">
        </label>
        <label>Maan-uitlijning
          <button class="alm-btn alm-btn--small" type="button" onclick="window.almanak.alignMoon()" title="Maak van vandaag een nieuwe maan">${icon('moon')} Vandaag = nieuwe maan</button>
        </label>
      </div>

      <label class="alm-cfg-full">Weekdagen (komma-gescheiden)
        <input class="alm-cfg-input" id="alm-cfg-weekdagen" value="${esc(a.weekdagen.join(', '))}">
      </label>

      <div class="alm-cfg-block">
        <div class="alm-cfg-block-head"><span>Seizoenen</span></div>
        <div class="alm-cfg-seizoenen">${seizoenRijen}</div>
      </div>

      <div class="alm-cfg-block">
        <div class="alm-cfg-block-head">
          <span>Maanden</span>
          <button class="alm-btn alm-btn--small" type="button" onclick="window.almanak.addMonth()">${icon('plus')} Maand</button>
        </div>
        <div class="alm-cfg-maanden" id="alm-cfg-maanden">${maandRijen}</div>
      </div>

      <div class="alm-dm-panel-foot">
        <button class="alm-btn alm-btn--save" onclick="window.almanak.saveConfig()">${icon('save')} Opslaan</button>
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
  }, 3500);
}

// ── Publieke acties (window.almanak.*) ─────────────────────────────
const _api = {
  refresh: () => renderAlmanak(),

  stepMonth(dir) {
    _viewMaand += dir;
    if (_viewMaand < 0) { _viewMaand = _data.maanden.length - 1; _viewJaar--; }
    else if (_viewMaand >= _data.maanden.length) { _viewMaand = 0; _viewJaar++; }
    renderAlmanak();
  },

  stepYear(dir) {
    _viewJaar += dir;
    renderAlmanak();
  },

  async delta(n) {
    try {
      const r = await api.setAlmanakDatum({ deltaDagen: n });
      _viewJaar  = r.vandaag.jaar;
      _viewMaand = r.vandaag.maandIdx;
      // Het socket-event ververst alle clients; lokaal alvast bijwerken.
      await renderAlmanak();
      if (r.today?.volleMaan) _toast('🌕 Volle maan.');
      else if (r.today?.nieuweMaan) _toast('🌑 Nieuwe maan.');
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  dayClick(dag) {
    const evs = _data.gebeurtenissen.filter(g =>
      g.maandIdx === _viewMaand && g.dag === dag &&
      (g.jaar === null || g.jaar === _data.view.jaar));
    if (isDM()) {
      _api.openEvent(null, { maandIdx: _viewMaand, dag });
      return;
    }
    if (!evs.length) return;
    const maandNaam = _data.maanden[_viewMaand]?.naam || '';
    const body = evs.map(g => `
      <div class="alm-pop-ev">
        <div class="alm-pop-naam">${esc(g.naam)}</div>
        ${g.beschrijving ? `<div class="alm-pop-desc">${esc(g.beschrijving)}</div>` : ''}
      </div>`).join('');
    window.app.openModal(`${dag} ${esc(maandNaam)}`, '', `<div class="alm-pop">${body}</div>`);
  },

  openSetDatum() {
    const a = _data;
    const v = a.vandaag;
    const maandOpts = a.maanden.map((m, i) =>
      `<option value="${i}"${i === v.maandIdx ? ' selected' : ''}>${esc(m.naam)}</option>`).join('');
    const body = `
      <form id="alm-datum-form" class="alm-form" onsubmit="return false">
        <div class="alm-form-row">
          <label>Dag<input class="alm-cfg-input" id="alm-d-dag" type="number" min="1" value="${v.dag}"></label>
          <label>Maand<select class="alm-cfg-input" id="alm-d-maand">${maandOpts}</select></label>
          <label>Jaar<input class="alm-cfg-input" id="alm-d-jaar" type="number" value="${v.jaar}"></label>
        </div>
        <button class="alm-btn alm-btn--save" type="button" onclick="window.almanak.saveDatum()">${icon('save')} Datum zetten</button>
      </form>`;
    window.app.openModal('Datum instellen', 'Zet de in-wereld datum', body);
  },

  async saveDatum() {
    const dag   = +document.getElementById('alm-d-dag').value;
    const maand = +document.getElementById('alm-d-maand').value;
    const jaar  = +document.getElementById('alm-d-jaar').value;
    try {
      const r = await api.setAlmanakDatum({ dag, maandIdx: maand, jaar });
      _viewJaar  = r.vandaag.jaar;
      _viewMaand = r.vandaag.maandIdx;
      window.app.closeModal();
      await renderAlmanak();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  toggleDM() { _dmOpen = !_dmOpen; renderAlmanak(); },

  addMonth() {
    _data.maanden.push({ naam: 'Nieuwe maand', dagen: 30 });
    renderAlmanak();
  },

  removeMonth(i) {
    if (_data.maanden.length <= 1) { _toast('Minimaal één maand vereist.'); return; }
    _data.maanden.splice(i, 1);
    if (_viewMaand >= _data.maanden.length) _viewMaand = _data.maanden.length - 1;
    renderAlmanak();
  },

  alignMoon() {
    // Stel maanOffset zo in dat de huidige dag een nieuwe maan is.
    const abs = _data.today.absDag;
    const cyc = +(document.getElementById('alm-cfg-cyclus')?.value) || _data.maanCyclus;
    _data.maanOffset = ((-abs) % cyc + cyc) % cyc;
    _toast('🌑 Vandaag uitgelijnd als nieuwe maan — vergeet niet op te slaan.');
  },

  async saveConfig() {
    // Lees de maanden + per-maand seizoentoewijzing uit het formulier.
    const maandRijen = [...document.querySelectorAll('.alm-cfg-maandrij')];
    const maanden = maandRijen.map(r => ({
      naam: r.querySelector('.alm-cfg-mnaam').value.trim() || 'Maand',
      dagen: Math.max(1, +r.querySelector('.alm-cfg-mdagen').value || 30),
    }));
    // Seizoenen (naam + kleur) en welke maanden erbij horen.
    const seizoenRijen = [...document.querySelectorAll('.alm-cfg-seizoenrij')];
    const seizoenen = seizoenRijen.map(r => ({
      id: r.dataset.id,
      naam: r.querySelector('.alm-cfg-snaam').value.trim() || r.dataset.id,
      kleur: r.querySelector('.alm-cfg-skleur').value,
      maanden: [],
    }));
    maandRijen.forEach((r, i) => {
      const sid = r.querySelector('.alm-cfg-mseizoen').value;
      const s = seizoenen.find(x => x.id === sid);
      if (s) s.maanden.push(i);
    });

    const weekdagen = document.getElementById('alm-cfg-weekdagen').value
      .split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      enabled:    document.getElementById('alm-cfg-enabled').checked,
      eraNaam:    document.getElementById('alm-cfg-era').value.trim(),
      maanNaam:   document.getElementById('alm-cfg-maannaam').value.trim(),
      maanCyclus: +document.getElementById('alm-cfg-cyclus').value || 28,
      maanOffset: _data.maanOffset || 0,
      weekdagen:  weekdagen.length ? weekdagen : _data.weekdagen,
      maanden,
      seizoenen,
    };
    try {
      await api.saveAlmanakConfig(payload);
      _toast('Almanak opgeslagen.');
      // Server-broadcast ververst; lokaal ook.
      await renderAlmanak();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  openEvent(id, preset) {
    const a = _data;
    const g = id ? a.gebeurtenissen.find(x => x.id === id) : null;
    const cur = g || { naam: '', beschrijving: '', maandIdx: preset?.maandIdx ?? _viewMaand, dag: preset?.dag ?? 1, jaar: null, kleur: '', zichtbaar: true };
    const maandOpts = a.maanden.map((m, i) =>
      `<option value="${i}"${i === cur.maandIdx ? ' selected' : ''}>${esc(m.naam)}</option>`).join('');
    const body = `
      <form id="alm-ev-form" class="alm-form" onsubmit="return false">
        <input type="hidden" id="alm-ev-id" value="${esc(id || '')}">
        <label>Naam<input class="alm-cfg-input" id="alm-ev-naam" value="${esc(cur.naam)}" placeholder="bijv. Oogstfeest"></label>
        <label>Beschrijving<textarea class="alm-cfg-input" id="alm-ev-desc" rows="3" placeholder="Wat gebeurt er?">${esc(cur.beschrijving)}</textarea></label>
        <div class="alm-form-row">
          <label>Dag<input class="alm-cfg-input" id="alm-ev-dag" type="number" min="1" value="${cur.dag}"></label>
          <label>Maand<select class="alm-cfg-input" id="alm-ev-maand">${maandOpts}</select></label>
          <label>Kleur<input type="color" class="alm-cfg-input" id="alm-ev-kleur" value="${esc(cur.kleur || '#b8862b')}"></label>
        </div>
        <div class="alm-form-row">
          <label class="alm-cfg-check"><input type="checkbox" id="alm-ev-jaarlijks" ${cur.jaar === null ? 'checked' : ''}> Elk jaar (jaarlijks)</label>
          <label>Jaar<input class="alm-cfg-input" id="alm-ev-jaar" type="number" value="${cur.jaar ?? a.view.jaar}" ${cur.jaar === null ? 'disabled' : ''}></label>
        </div>
        <label class="alm-cfg-check"><input type="checkbox" id="alm-ev-zichtbaar" ${cur.zichtbaar !== false ? 'checked' : ''}> Zichtbaar voor spelers</label>
        <button class="alm-btn alm-btn--save" type="button" onclick="window.almanak.saveEvent()">${icon('save')} Opslaan</button>
      </form>`;
    window.app.openModal(id ? 'Gebeurtenis bewerken' : 'Nieuwe gebeurtenis', '', body);
    const cb = document.getElementById('alm-ev-jaarlijks');
    cb.addEventListener('change', () => {
      document.getElementById('alm-ev-jaar').disabled = cb.checked;
    });
  },

  async saveEvent() {
    const id = document.getElementById('alm-ev-id').value;
    const jaarlijks = document.getElementById('alm-ev-jaarlijks').checked;
    const data = {
      naam:        document.getElementById('alm-ev-naam').value.trim() || 'Gebeurtenis',
      beschrijving: document.getElementById('alm-ev-desc').value.trim(),
      dag:         +document.getElementById('alm-ev-dag').value || 1,
      maandIdx:    +document.getElementById('alm-ev-maand').value || 0,
      kleur:       document.getElementById('alm-ev-kleur').value,
      jaar:        jaarlijks ? null : (+document.getElementById('alm-ev-jaar').value || _data.view.jaar),
      zichtbaar:   document.getElementById('alm-ev-zichtbaar').checked,
    };
    try {
      if (id) await api.updateAlmanakEvent(id, data);
      else    await api.addAlmanakEvent(data);
      window.app.closeModal();
      await renderAlmanak();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },

  async deleteEvent(id) {
    if (!confirm('Deze gebeurtenis verwijderen?')) return;
    try {
      await api.deleteAlmanakEvent(id);
      await renderAlmanak();
    } catch (err) { _toast(esc(err.message || 'Fout')); }
  },
};

window.almanak = _api;
