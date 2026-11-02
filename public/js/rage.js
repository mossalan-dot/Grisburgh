// Rage — de Barbarian.
//
// Drie schermen, één gebeurtenis:
//  • het blad van de Barbarian zelf: het Rage-blok met de grote knop, wat er
//    nu geldt zolang hij raast, en de twee features die er later bij komen
//    (Relentless Rage op 11, Persistent Rage op 15);
//  • zijn eigen telefoon: een korte flits en een rode rand zolang het duurt;
//  • het tafelscherm: de brul — klauwsporen, het portret, RAGE — en daarna een
//    merkteken in de hoek zolang hij raast.
// De rest van de tafel krijgt een melding; wie raast is geen geheim.
//
// De server houdt de stand bij (`/characters/:id/rage`); hier wordt alleen
// getekend en geklikt. Side-effect module, net als `terugblik.js`.

import { api } from './api.js?v=319';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) || '';
const RUSTIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const mijnId = () => window.app?.state?.characterId || null;

// ── Klauwsporen: drie halen die zichzelf tekenen ─────────────────────────────
// `pathLength="1"` maakt elke haal even lang voor de CSS, zodat één
// stroke-dashoffset van 1 naar 0 hem tekent, ongeacht zijn echte lengte.
const KLAUW = `
  <svg class="rage-klauw" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="1" style="--k:0" d="M18 4 C 30 30, 42 60, 58 98"/>
    <path pathLength="1" style="--k:1" d="M34 0 C 46 28, 58 58, 74 96"/>
    <path pathLength="1" style="--k:2" d="M50 2 C 62 30, 72 58, 90 92"/>
  </svg>`;

function _vonken(n) {
  if (RUSTIG()) return '';
  return Array.from({ length: n }, () => {
    const x = Math.round(Math.random() * 100), d = (0.9 + Math.random() * 1.6).toFixed(2);
    const v = (Math.random() * 0.6).toFixed(2), s = (2 + Math.random() * 4).toFixed(1);
    const dx = Math.round((Math.random() - 0.5) * 120);
    return `<i class="rage-vonk" style="--x:${x}%;--d:${d}s;--v:${v}s;--s:${s}px;--dx:${dx}px"></i>`;
  }).join('');
}

function _klank(d, soort) {
  if (d?.geluid && soort === 'brul') {
    try { new Audio(api.fileUrl(d.geluid)).play().catch(() => {}); return; } catch { /* synthese dan */ }
  }
  window.soundManager?.rageKlank?.(soort);
}

// ── Het blok op het blad ─────────────────────────────────────────────────────

let _bezig = false;
let _eigenKlik = 0;   // de flits gaat af bij de klik; de socket-echo daarna slaat hem over

async function rageBlok() {
  const el = document.getElementById('rage-blok');
  const id = window._lastCharId;
  if (!el || !id) return;
  let stand = null, emotes = [], klank = null;
  try {
    const r = await api.get(`/characters/${id}/rage`);
    stand = r?.rage; emotes = r?.emotes || []; klank = r?.klank || null;
  } catch { /* geen blok */ }
  // Geen Barbarian: dan bestaat dit blok niet. Geen grijze regel die vertelt wat je mist.
  if (!stand) { el.innerHTML = ''; _rand(false); return; }
  const isIk = mijnId() === id;
  _rand(isIk && stand.actief);

  const tekens = Array.from({ length: stand.max }, (_, i) =>
    `<span class="rage-teken${i < stand.over ? ' is-over' : ''}" title="${i < stand.over ? 'Nog te gebruiken' : 'Verbruikt'}">${ic('angry')}</span>`).join('');

  const relentless = stand.relentless?.nodig ? `
    <div class="rage-relentless">
      <div class="rage-relentless-kop">${ic('heart-pulse')} Relentless Rage</div>
      <div class="rage-relentless-dc">DC ${stand.relentless.dc} <span>Constitution Saving Throw</span></div>
      <div class="rage-relentless-knoppen">
        <button class="rage-mini rage-mini--goud" data-rage="relentless-ja">Gelukt — sta op met ${stand.level * 2} HP</button>
        <button class="rage-mini" data-rage="relentless-nee">Mislukt</button>
      </div>
    </div>` : '';

  const persistent = (stand.persistent?.beschikbaar && stand.inGevecht && stand.verbruikt > 0) ? `
    <button class="rage-mini rage-mini--goud rage-persistent" data-rage="persistent">
      ${ic('refresh-cw')} Persistent Rage — alle Rage terug
    </button>` : '';

  el.innerHTML = `
    <div class="player-dash-section rage-blok${stand.actief ? ' is-actief' : ''}">
      <div class="player-dash-section-title">${ic('angry')} Rage
        <span class="rage-titel-hulp">${window._helpBtn?.('rage') || ''}</span>
      </div>
      <div class="rage-kern">
        <button class="rage-knop" data-rage="${stand.actief ? 'uit' : 'aan'}"
          ${!stand.actief && stand.over <= 0 ? 'disabled' : ''}
          title="${stand.actief ? 'Rage beëindigen' : stand.over > 0 ? 'Bonus Action: ga in Rage' : 'Geen Rage meer over'}">
          <span class="rage-knop-ring"></span>
          <span class="rage-knop-icoon">${ic('angry')}</span>
          <span class="rage-knop-tekst">${stand.actief ? 'Raging' : 'Rage'}</span>
        </button>
        <div class="rage-info">
          <div class="rage-tekens">${tekens}</div>
          <div class="rage-teller">${stand.over} van ${stand.max} over</div>
          <div class="rage-chips">
            <span class="rage-chip">Rage Damage +${stand.schade}</span>
            ${stand.actief ? `<button class="rage-chip rage-chip--uit" data-rage="uit">${ic('x')} Beëindigen</button>` : ''}
          </div>
        </div>
      </div>
      ${stand.actief ? `
        <ul class="rage-effecten">
          <li>${ic('shield-half')} Resistance tegen Bludgeoning, Piercing &amp; Slashing damage</li>
          <li>${ic('dices')} Advantage op Strength checks en Strength saving throws</li>
          <li>${ic('swords')} +${stand.schade} damage met Strength-aanvallen</li>
          <li class="rage-effect--niet">${ic('ban')} Geen spells casten, geen Concentration</li>
        </ul>` : ''}
      ${relentless}
      ${persistent}
      ${emotes.length ? `
        <details class="kk-klanken"><summary>${ic('volume-2')} Klank</summary>
          <label class="kk-klank"><span>${ic('angry')} Rage</span>
            <select data-rage-klank>
              <option value="">Geen</option>
              ${emotes.map(e => `<option value="${esc(e.id)}"${e.id === klank ? ' selected' : ''}>${esc(e.label)}</option>`).join('')}
            </select></label>
        </details>` : ''}
    </div>`;

  el.querySelectorAll('[data-rage]').forEach(b => b.addEventListener('click', () => _actie(b.dataset.rage, id)));
  el.querySelector('[data-rage-klank]')?.addEventListener('change', async (ev) => {
    try { await api.put(`/characters/${id}/klassekracht/klank`, { sleutel: 'barbarian.rage', emoteId: ev.target.value || null }); }
    catch (e) { window._showToast?.(e?.message || 'Dat lukte niet'); }
  });
}

async function _actie(wat, id) {
  if (_bezig) return;
  _bezig = true;
  try {
    const pad = {
      aan: '', uit: '/einde', persistent: '/persistent',
      'relentless-ja': '/relentless', 'relentless-nee': '/relentless',
    }[wat];
    const body = wat.startsWith('relentless') ? { gelukt: wat === 'relentless-ja' } : {};
    const r = await api.post(`/characters/${id}/rage${pad}`, body);
    // De knop ís het moment: niet wachten op de socket. Alleen voor de speler
    // zelf — een DM die namens hem drukt hoeft niet zelf te flitsen.
    if ((wat === 'aan' || wat === 'relentless-ja') && mijnId() === id) {
      _eigenKlik = Date.now();
      _flits({ relentless: wat === 'relentless-ja' ? 'gelukt' : null });
    }
    if (wat === 'aan' && r?.concentratieWeg) window._showToast?.(`${ic('brain')} Je Concentration is verbroken`);
  } catch (e) {
    window._showToast?.(e?.message || 'Dat lukte niet');
  } finally {
    _bezig = false;
    rageBlok();
  }
}

// Een rode rand om het hele scherm zolang je raast — alleen op je eigen scherm.
function _rand(aan) {
  let r = document.getElementById('rage-rand');
  if (aan && !r) {
    r = document.createElement('div');
    r.id = 'rage-rand';
    r.className = 'rage-rand';
    document.body.appendChild(r);
  } else if (!aan && r) {
    r.classList.add('is-weg');
    setTimeout(() => r.remove(), 900);
  }
}

// ── De flits op je eigen telefoon ────────────────────────────────────────────
function _flits(d) {
  document.getElementById('rage-flits')?.remove();
  const ov = document.createElement('div');
  ov.id = 'rage-flits';
  ov.className = 'rage-flits';
  ov.innerHTML = `<div class="rage-gloed"></div>${KLAUW}<div class="rage-woord">${d.relentless === 'gelukt' ? 'Nog niet' : 'Rage'}</div>`;
  document.body.appendChild(ov);
  void ov.offsetWidth;
  ov.classList.add('is-aan');
  try { navigator.vibrate?.([60, 40, 140]); } catch { /* niet elk apparaat */ }
  setTimeout(() => { ov.classList.add('is-weg'); setTimeout(() => ov.remove(), 700); }, 1700);
}

// ── Het tafelscherm ──────────────────────────────────────────────────────────

function _merken() {
  let m = document.getElementById('rage-merken');
  if (!m) {
    m = document.createElement('div');
    m.id = 'rage-merken';
    m.className = 'rage-merken';
    document.body.appendChild(m);
  }
  return m;
}

function _merk(d, aan) {
  const m = _merken();
  const oud = m.querySelector(`[data-char="${CSS.escape(d.characterId)}"]`);
  if (!aan) {
    if (oud) { oud.classList.add('is-weg'); setTimeout(() => oud.remove(), 1200); }
    return;
  }
  if (oud) return;
  const el = document.createElement('div');
  el.className = 'rage-merk';
  el.dataset.char = d.characterId;
  el.innerHTML = `
    <div class="rage-merk-portret">
      <span>${esc((d.naam || '?').trim().charAt(0).toUpperCase())}</span>
      <img src="${api.thumbUrl(d.thumb)}" alt="" onerror="this.remove()"${d.focus ? ` style="object-position:${esc(d.focus)}"` : ''}>
    </div>
    <div class="rage-merk-tekst"><b>${esc(d.naam)}</b><span>${ic('angry')} Raging · +${d.schade}</span></div>`;
  m.appendChild(el);
  void el.offsetWidth;
  el.classList.add('is-aan');
}

function _brul(d) {
  document.getElementById('rage-brul')?.remove();
  const opstaan = d.relentless === 'gelukt';
  const ov = document.createElement('div');
  ov.id = 'rage-brul';
  ov.className = `rage-brul${opstaan ? ' rage-brul--opstaan' : ''}`;
  ov.innerHTML = `
    <div class="rage-gloed"></div>
    <div class="rage-schok">
      ${KLAUW}
      <div class="rage-vonken">${_vonken(34)}</div>
      <div class="rage-portret">
        <div class="rage-portret-ring"></div>
        <div class="rage-portret-beeld">
          <span>${esc((d.naam || '?').trim().charAt(0).toUpperCase())}</span>
          <img src="${api.thumbUrl(d.thumb)}" alt="" onerror="this.remove()"${d.focus ? ` style="object-position:${esc(d.focus)}"` : ''}>
        </div>
      </div>
      <div class="rage-woord">${opstaan ? 'Nog niet' : 'Rage'}</div>
      <div class="rage-naam">${esc(d.naam)} ${opstaan ? 'weigert te vallen' : 'ontsteekt in razernij'}</div>
      <div class="rage-regel">${opstaan
        ? `Relentless Rage · ${(d.level || 1) * 2} HP`
        : `Rage Damage +${d.schade} · Resistance tegen Bludgeoning, Piercing &amp; Slashing`}</div>
    </div>`;
  document.body.appendChild(ov);
  void ov.offsetWidth;
  ov.classList.add('is-aan');
  setTimeout(() => {
    ov.classList.add('is-weg');
    setTimeout(() => ov.remove(), 900);
    _merk(d, true);
  }, 4400);
}

// `rage:display` — alleen het tafelscherm krijgt hem (eigen room).
function rageDisplay(d) {
  if (!d?.characterId) return;
  if (d.actief && !d.stil) {
    _brul(d); _klank(d, 'brul');
    // Zijn eigen strijdkreet, als hij er een koos — net na de brul.
    if (d.emote) setTimeout(() => { try { new Audio(api.fileUrl(d.emote)).play().catch(() => {}); } catch { /* stil */ } }, 700);
    return;
  }
  if (!d.actief) {
    _merk(d, false);
    if (!d.stil) _klank(d, 'doof');
  }
}

// `rage:updated` — iedereen in de campagne.
function rageOntvang(d) {
  if (!d?.characterId) return;
  const isIk = mijnId() === d.characterId;
  // Het blok hertekent als het van deze persoon is (ook bij de DM die meekijkt).
  if (window._lastCharId === d.characterId) rageBlok();
  if (window._isDisplayMode || d.stil) return;
  if (isIk) {
    // Zelf gedrukt? Dan flitste het al. Anders drukte de DM namens jou.
    // De klank komt altijd van hier: alleen de socket weet of de DM er een
    // eigen bestand aan hing.
    if (d.actief && Date.now() - _eigenKlik > 3000) _flits(d);
    if (d.actief) _klank(d, 'brul');
    return;
  }
  if (d.actief && d.relentless === 'gelukt') {
    window._showToast?.(`${ic('heart-pulse')} ${esc(d.naam)} weigert te vallen!`);
  } else if (d.actief) {
    window._showToast?.(`${ic('angry')} ${esc(d.naam)} ontsteekt in razernij`);
  }
}

window._rageBlok = rageBlok;
window._rageDisplay = rageDisplay;
window._rageOntvang = rageOntvang;
