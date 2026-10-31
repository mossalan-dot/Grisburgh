// Klassekrachten — het blok op het blad en het moment op tafel, voor elke
// klasse behalve de Barbarian (die heeft `rage.js`).
//
// Alles komt van de server (`GET /characters/:id/klassekracht`): welke
// bronnen, wat er over is, welke knoppen er zijn en waarom een knop grijs
// staat. Deze module tekent dat en vraagt alleen wat een kracht nodig heeft —
// een doelwit, een bedrag, een slot — in een klein paneel onder de knoppen.
//
// Het tafelscherm krijgt per klasse een eigen beweging (`THEMA`): stralen voor
// wie bidt, een tovercirkel voor wie studeert, snelheidslijnen voor een Fighter
// die een tweede actie pakt, inkt voor een Monk, stralen eldritch-licht voor
// een Warlock. Zelfde opbouw als de brul van de Barbarian, andere kleur.

import { api } from './api.js?v=317';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) || '';
const RUSTIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const mijnId = () => window.app?.state?.characterId || null;

// Per thema: twee kleuren, een deeltje uit de sprite en een figuur (CSS).
const THEMA = {
  bard:      { a: '#e9b8ff', b: '#5a2a7a', deeltje: 'music',          figuur: 'golven' },
  cleric:    { a: '#fff2b8', b: '#8a6a10', deeltje: 'sparkle',        figuur: 'stralen' },
  druid:     { a: '#c8f0a0', b: '#1f4a1a', deeltje: 'leaf',           figuur: 'golven' },
  fighter:   { a: '#ffe0a8', b: '#5a3a14', deeltje: 'zap',            figuur: 'snelheid' },
  monk:      { a: '#f2ead8', b: '#14211f', deeltje: 'wind',           figuur: 'penseel' },
  paladin:   { a: '#fff6d0', b: '#7a5a10', deeltje: 'sparkle',        figuur: 'stralen' },
  ranger:    { a: '#e2f0b8', b: '#2a3a14', deeltje: 'leaf',           figuur: 'vizier' },
  rogue:     { a: '#d8dce8', b: '#0e0f16', deeltje: 'stiletto',       figuur: 'haal' },
  sorcerer:  { a: '#ffc89a', b: '#6a140a', deeltje: 'flame',          figuur: 'cirkel' },
  warlock:   { a: '#c8ffb0', b: '#1a0a2a', deeltje: 'eye',            figuur: 'bundels' },
  wizard:    { a: '#c8dcff', b: '#14205a', deeltje: 'sparkle',        figuur: 'cirkel' },
  artificer: { a: '#ffd8a0', b: '#3a2a14', deeltje: 'cog',            figuur: 'cirkel' },
};

// ── Het blok ─────────────────────────────────────────────────────────────────

let _stand = null;
let _open = null;          // welke actie heeft haar paneel open: 'klasse.actie'
let _bezig = false;
let _eigenKlik = 0;

function _tekens(b) {
  // Tot tien zie je ze als tekens; een voorraad als Lay on Hands (50 HP) of
  // Focus Points op level 20 is een balk met een getal.
  if (b.max <= 10) {
    return `<div class="kk-tekens">${Array.from({ length: b.max }, (_, i) =>
      `<span class="kk-teken${i < b.over ? ' is-over' : ''}"></span>`).join('')}</div>`;
  }
  return `<div class="kk-balk"><span style="width:${Math.round((b.over / b.max) * 100)}%"></span></div>`;
}

const _herstelTekst = (k) => ({ alles: 'Short Rest: alles terug', een: 'Short Rest: één terug' }[k] || 'Long Rest');

function _klasseHtml(k) {
  return `
    <div class="kk-klasse" data-thema="${esc(k.thema)}">
      ${k.bronnen.map(b => `
        <div class="kk-bron">
          <div class="kk-bron-kop"><span>${esc(b.label)}</span>
            <span class="kk-bron-getal">${b.over}${b.eenheid ? ' ' + esc(b.eenheid) : ''} <i>/ ${b.max}</i></span></div>
          ${_tekens(b)}
          <div class="kk-bron-herstel">${_herstelTekst(b.kort)}</div>
        </div>`).join('')}
      ${k.info.length ? `<div class="kk-info">${k.info.map(t => `<span class="kk-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${k.actief.map(a => `
        <div class="kk-actief">
          <div class="kk-actief-kop">${ic(a.icoon)} <b>${esc(a.label)}</b>${a.tekst ? ` — ${esc(a.tekst)}` : ''}${a.doelNaam && a.doelNaam !== a.tekst ? ` <span>op ${esc(a.doelNaam)}</span>` : ''}
            <button class="kk-mini" data-kk-einde="${esc(k.id)}.${esc(a.actie)}">${ic('x')} Beëindigen</button></div>
          ${a.effecten.length ? `<ul>${a.effecten.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}
      <div class="kk-acties">
        ${k.acties.map(a => `
          <button class="kk-actie${_open === `${k.id}.${a.id}` ? ' is-open' : ''}" data-kk="${esc(k.id)}.${esc(a.id)}"
            ${a.beschikbaar ? '' : 'disabled'} title="${esc(a.beschikbaar ? (a.regel || a.label) : a.waarom)}">
            <span class="kk-actie-icoon">${ic(a.icoon)}</span>
            <span class="kk-actie-label">${esc(a.label)}</span>
            ${a.kost ? `<span class="kk-actie-kost">${a.kost}</span>` : ''}
            ${a.formule ? `<span class="kk-actie-formule">${esc(a.formule)}</span>` : ''}
          </button>`).join('')}
      </div>
      <div class="kk-paneel-plek" data-kk-paneel="${esc(k.id)}"></div>
    </div>`;
}

function _paneelHtml(k, a) {
  const s = _stand;
  const velden = [];
  if (a.doel === 'bondgenoot') {
    const lijst = s.party.filter(p => a.soort !== 'inspiratie' || p.id !== window._lastCharId);
    velden.push(`<label>Op wie<select data-v="doel">${lijst.map(p =>
      `<option value="${esc(p.id)}"${p.id === window._lastCharId ? ' selected' : ''}>${esc(p.naam)}</option>`).join('')}</select></label>`);
  }
  if (a.doel === 'vijand') {
    velden.push(s.vijanden.length
      ? `<label>Doelwit<select data-v="doel">${s.vijanden.map(v => `<option value="${esc(v.id)}">${esc(v.naam)}</option>`).join('')}</select></label>`
      : `<label>Doelwit<input data-v="tekst" maxlength="60" placeholder="Naam"></label>`);
  }
  if (a.tekst) velden.push(`<label>${esc(a.tekst)}<input data-v="tekst" maxlength="60"></label>`);
  if (a.bedrag) {
    const b = k.bronnen.find(x => x.key === a.bron);
    velden.push(`<label>Hoeveel ${esc(b?.eenheid || '')}<input type="number" data-v="bedrag" min="1" max="${b?.over || 1}" value="${Math.min(5, b?.over || 1)}"></label>`);
  }
  if (a.keuze) {
    const over = k.bronnen.find(x => x.key === a.bron)?.over || 0;
    velden.push(`<label>Welke<select data-v="keuze">${Object.entries(a.keuze).map(([n, c]) =>
      `<option value="${esc(n)}"${c > over ? ' disabled' : ''}>${esc(n)} (${c})</option>`).join('')}</select></label>`);
  }
  const slotOpties = (filter) => Object.entries(s.slots).filter(filter).map(([n]) => `<option value="${n}">Niveau ${n}</option>`).join('');
  if (a.slot || a.soort === 'slot-smelten') {
    const o = slotOpties(([, v]) => v.max - v.used > 0);
    velden.push(o ? `<label>Spell slot<select data-v="slot">${o}</select></label>` : '<p class="kk-leeg">Geen slot over.</p>');
  }
  if (a.soort === 'slot-maken') {
    const over = k.bronnen.find(x => x.key === a.bron)?.over || 0;
    const o = Object.entries(s.slots).filter(([n, v]) => v.used > 0 && a.kosten[n] && a.kosten[n] <= over)
      .map(([n]) => `<option value="${n}">Niveau ${n} — ${a.kosten[n]} punten</option>`).join('');
    velden.push(o ? `<label>Welk slot<select data-v="slot">${o}</select></label>` : '<p class="kk-leeg">Geen verbruikte slot die je kunt betalen.</p>');
  }
  if (a.soort === 'slots' && a.budget) {
    const rijen = Object.entries(s.slots).filter(([n, v]) => v.used > 0 && +n <= a.maxNiveau);
    velden.push(rijen.length ? `
      <div class="kk-slotkeus" data-budget="${a.budget}">
        <div class="kk-slotkeus-kop">Kies samen hooguit ${a.budget} niveaus <span data-som>0 / ${a.budget}</span></div>
        ${rijen.map(([n, v]) => `
          <div class="kk-slotrij" data-niveau="${n}" data-max="${v.used}">
            <span>Niveau ${n}</span>
            <button type="button" data-stap="-1">−</button><b data-aantal>0</b><button type="button" data-stap="1">+</button>
            <i>${v.used} verbruikt</i>
          </div>`).join('')}
      </div>` : '<p class="kk-leeg">Je hebt geen verbruikte slots die je terug kunt halen.</p>');
  }
  return `
    <div class="kk-paneel">
      <div class="kk-paneel-kop">${ic(a.icoon)} ${esc(a.label)}${a.regel ? `<span>${esc(a.regel)}</span>` : ''}</div>
      <div class="kk-velden">${velden.join('')}</div>
      <div class="kk-paneel-knoppen">
        <button class="kk-mini kk-mini--goud" data-kk-doe="${esc(k.id)}.${esc(a.id)}">${ic('check')} Doen</button>
        <button class="kk-mini" data-kk-dicht>Annuleren</button>
      </div>
    </div>`;
}

const _heeftPaneel = (a) => a.doel === 'bondgenoot' || a.doel === 'vijand' || a.tekst || a.bedrag || a.keuze
  || a.slot || a.soort === 'slot-maken' || a.soort === 'slot-smelten' || (a.soort === 'slots' && a.budget);

async function krachtBlok() {
  const el = document.getElementById('kracht-blok');
  const id = window._lastCharId;
  if (!el || !id) return;
  try { _stand = (await api.get(`/characters/${id}/klassekracht`))?.kracht; } catch { _stand = null; }
  // Geen klassekracht en geen inspiratie gekregen: dan bestaat dit blok niet.
  if (!_stand) { el.innerHTML = ''; return; }
  const titel = _stand.klassen.map(k => k.naam).join(' · ');
  el.innerHTML = `
    ${_stand.ontvangen ? `
      <div class="kk-ontvangen" data-thema="bard">
        <span class="kk-ontvangen-die">${esc(_stand.ontvangen.die)}</span>
        <span class="kk-ontvangen-tekst"><b>Bardic Inspiration</b> van ${esc(_stand.ontvangen.vanNaam)}</span>
        <button class="kk-mini kk-mini--goud" data-kk-inspiratie>${ic('dices')} Gebruiken</button>
      </div>` : ''}
    ${_stand.klassen.length ? `
      <div class="player-dash-section kk-blok" data-thema="${esc(_stand.klassen[0].thema)}">
        <div class="player-dash-section-title">${ic(_stand.klassen[0].icoon)} ${esc(titel)}
          <span class="kk-hulp">${window._helpBtn?.('klassekracht') || ''}</span></div>
        ${_stand.klassen.map(_klasseHtml).join('')}
      </div>` : ''}`;

  if (_open) {
    const [kid, aid] = _open.split('.');
    const k = _stand.klassen.find(x => x.id === kid);
    const a = k?.acties.find(x => x.id === aid);
    const plek = el.querySelector(`[data-kk-paneel="${kid}"]`);
    if (k && a && a.beschikbaar && plek) { plek.innerHTML = _paneelHtml(k, a); _slotkeusBinden(plek); }
    else _open = null;
  }
  _binden(el, id);
}

function _slotkeusBinden(plek) {
  const keus = plek.querySelector('.kk-slotkeus');
  if (!keus) return;
  const budget = +keus.dataset.budget;
  const som = () => [...keus.querySelectorAll('.kk-slotrij')].reduce((s, r) => s + (+r.dataset.niveau) * (+r.querySelector('[data-aantal]').textContent), 0);
  keus.querySelectorAll('[data-stap]').forEach(b => b.addEventListener('click', () => {
    const rij = b.closest('.kk-slotrij');
    const n = rij.querySelector('[data-aantal]');
    const nieuw = Math.max(0, Math.min(+rij.dataset.max, +n.textContent + (+b.dataset.stap)));
    const oud = +n.textContent;
    n.textContent = nieuw;
    if (som() > budget) n.textContent = oud;      // past niet in het budget
    keus.querySelector('[data-som]').textContent = `${som()} / ${budget}`;
  }));
}

function _binden(el, id) {
  el.querySelectorAll('[data-kk]').forEach(b => b.addEventListener('click', () => {
    const [kid, aid] = b.dataset.kk.split('.');
    const k = _stand.klassen.find(x => x.id === kid);
    const a = k?.acties.find(x => x.id === aid);
    if (!a) return;
    if (_heeftPaneel(a)) { _open = _open === b.dataset.kk ? null : b.dataset.kk; krachtBlok(); return; }
    _doe(id, kid, aid, {});
  }));
  el.querySelectorAll('[data-kk-dicht]').forEach(b => b.addEventListener('click', () => { _open = null; krachtBlok(); }));
  el.querySelectorAll('[data-kk-doe]').forEach(b => b.addEventListener('click', () => {
    const [kid, aid] = b.dataset.kkDoe.split('.');
    const paneel = b.closest('.kk-paneel');
    const body = {};
    paneel.querySelectorAll('[data-v]').forEach(v => { body[v.dataset.v] = v.value; });
    const rijen = [...paneel.querySelectorAll('.kk-slotrij')];
    if (rijen.length) body.slots = rijen.flatMap(r => Array(+r.querySelector('[data-aantal]').textContent).fill(+r.dataset.niveau));
    _doe(id, kid, aid, body);
  }));
  el.querySelectorAll('[data-kk-einde]').forEach(b => b.addEventListener('click', async () => {
    const [klasse, actie] = b.dataset.kkEinde.split('.');
    try { await api.post(`/characters/${id}/klassekracht/einde`, { klasse, actie }); } catch (e) { window._showToast?.(e?.message || 'Dat lukte niet'); }
    krachtBlok();
  }));
  el.querySelector('[data-kk-inspiratie]')?.addEventListener('click', async () => {
    try {
      const r = await api.post(`/characters/${id}/inspiratie/gebruik`, {});
      window._showToast?.(`${ic('music')} Bardic Inspiration: +${r.worp.totaal}`);
    } catch (e) { window._showToast?.(e?.message || 'Dat lukte niet'); }
    krachtBlok();
  });
}

async function _doe(id, klasse, actie, body) {
  if (_bezig) return;
  _bezig = true;
  try {
    const r = await api.post(`/characters/${id}/klassekracht`, { klasse, actie, ...body });
    _open = null;
    const k = _stand?.klassen.find(x => x.id === klasse);
    const u = r.uitkomst || {};
    if (mijnId() === id) { _eigenKlik = Date.now(); _flits(k?.thema, u.woord || k?.acties.find(x => x.id === actie)?.label, u.getal); }
    window._showToast?.(`${ic(k?.acties.find(x => x.id === actie)?.icoon || 'sparkles')} ${esc(u.tekst || 'Gedaan')}`);
  } catch (e) {
    window._showToast?.(e?.message || 'Dat lukte niet');
  } finally {
    _bezig = false;
    krachtBlok();
  }
}

// ── De flits op je eigen scherm ──────────────────────────────────────────────
function _flits(thema, woord, getal) {
  const t = THEMA[thema] || THEMA.wizard;
  document.getElementById('kk-flits')?.remove();
  const ov = document.createElement('div');
  ov.id = 'kk-flits';
  ov.className = 'kk-flits';
  ov.style.setProperty('--kk-a', t.a);
  ov.style.setProperty('--kk-b', t.b);
  ov.innerHTML = `<div class="kk-gloed"></div><div class="kk-woord">${esc(woord || '')}</div>${getal != null ? `<div class="kk-getal">${getal}</div>` : ''}`;
  document.body.appendChild(ov);
  void ov.offsetWidth;
  ov.classList.add('is-aan');
  setTimeout(() => { ov.classList.add('is-weg'); setTimeout(() => ov.remove(), 600); }, 1500);
}

// ── Het tafelscherm ──────────────────────────────────────────────────────────

function _figuur(soort, d) {
  if (RUSTIG()) return '';
  switch (soort) {
    case 'stralen': return '<div class="kk-fig kk-fig--stralen"></div>';
    case 'golven':  return `<div class="kk-fig kk-fig--golven">${'<i></i>'.repeat(4)}</div>`;
    case 'snelheid': return '<div class="kk-fig kk-fig--snelheid"></div>';
    case 'cirkel': return `
      <svg class="kk-fig kk-fig--cirkel" viewBox="0 0 200 200" aria-hidden="true">
        <circle pathLength="1" cx="100" cy="100" r="92"/><circle pathLength="1" cx="100" cy="100" r="76" class="kk-c2"/>
        <polygon pathLength="1" points="100,14 174,143 26,143"/><polygon pathLength="1" points="100,186 26,57 174,57"/>
        <circle pathLength="1" cx="100" cy="100" r="40" class="kk-c3"/>
      </svg>`;
    case 'haal': return `<svg class="kk-fig kk-fig--haal" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M8 92 C 34 64, 60 38, 94 6"/></svg>`;
    case 'penseel': return `<svg class="kk-fig kk-fig--penseel" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength="1" d="M4 70 C 22 30, 46 26, 58 48 S 86 72, 97 22"/><path pathLength="1" class="kk-p2" d="M10 88 C 40 80, 62 86, 92 78"/></svg>`;
    case 'vizier': return `<div class="kk-fig kk-fig--vizier"><i></i><i></i><i></i><i></i><b></b></div>`;
    case 'bundels': {
      const n = Math.max(1, d?.stralen?.length || 1);
      return `<div class="kk-fig kk-fig--bundels">${Array.from({ length: n }, (_, i) =>
        `<i style="--i:${i};--y:${Math.round(((i + 1) / (n + 1)) * 100)}%"></i>`).join('')}</div>`;
    }
    default: return '';
  }
}

function _deeltjes(naam, n) {
  if (RUSTIG()) return '';
  return Array.from({ length: n }, () => {
    const x = Math.round(Math.random() * 100), d = (2.4 + Math.random() * 2.4).toFixed(2);
    const v = (Math.random() * 1.2).toFixed(2), s = (14 + Math.random() * 22).toFixed(0);
    const dx = Math.round((Math.random() - 0.5) * 160), r = Math.round((Math.random() - 0.5) * 120);
    return `<span class="kk-deeltje" style="--x:${x}%;--d:${d}s;--v:${v}s;--s:${s}px;--dx:${dx}px;--r:${r}deg">${ic(naam)}</span>`;
  }).join('');
}

const _portret = (p, cls = '') => p ? `
  <div class="kk-portret ${cls}">
    <span>${esc((p.naam || '?').trim().charAt(0).toUpperCase())}</span>
    <img src="${api.thumbUrl(p.thumb)}" alt="" onerror="this.remove()"${p.focus ? ` style="object-position:${esc(p.focus)}"` : ''}>
  </div>` : '';

function _telOp(el, doel) {
  if (!el || doel == null) return;
  const start = performance.now(), duur = 900;
  const stap = () => {
    const t = Math.min(1, (performance.now() - start) / duur);
    el.textContent = Math.round(doel * (1 - Math.pow(1 - t, 3)));
    if (t < 1) setTimeout(stap, 30);         // geen rAF: een achtergrondtab staat dan stil
  };
  stap();
}

function _merken() {
  let m = document.getElementById('rage-merken');      // dezelfde hoek als de Barbarian
  if (!m) { m = document.createElement('div'); m.id = 'rage-merken'; m.className = 'rage-merken'; document.body.appendChild(m); }
  return m;
}

function _merk(d, aan) {
  const m = _merken();
  const sleutel = `${d.characterId}|${d.klasse}|${d.actie}`;
  const oud = [...m.querySelectorAll('.kk-merk')].find(x => x.dataset.sleutel === sleutel);
  if (!aan) { if (oud) { oud.classList.add('is-weg'); setTimeout(() => oud.remove(), 1200); } return; }
  if (oud) return;
  const t = THEMA[d.thema] || THEMA.wizard;
  const el = document.createElement('div');
  el.className = 'rage-merk kk-merk';
  el.dataset.sleutel = sleutel;
  el.dataset.char = d.characterId;
  el.style.setProperty('--kk-a', t.a);
  el.style.setProperty('--kk-b', t.b);
  el.innerHTML = `
    <div class="rage-merk-portret">
      <span>${esc((d.naam || '?').trim().charAt(0).toUpperCase())}</span>
      <img src="${api.thumbUrl(d.bron?.thumb || d.characterId)}" alt="" onerror="this.remove()">
    </div>
    <div class="rage-merk-tekst"><b>${esc(d.naam)}</b><span>${ic(t.deeltje)} ${esc(d.label || d.woord)}${d.tekst ? ' · ' + esc(d.tekst) : ''}</span></div>`;
  m.appendChild(el);
  void el.offsetWidth;
  el.classList.add('is-aan');
}

function _moment(d) {
  const t = THEMA[d.thema] || THEMA.wizard;
  document.getElementById('kk-moment')?.remove();
  const ov = document.createElement('div');
  ov.id = 'kk-moment';
  ov.className = `kk-moment kk-moment--${t.figuur}`;
  ov.dataset.thema = d.thema;
  ov.style.setProperty('--kk-a', t.a);
  ov.style.setProperty('--kk-b', t.b);
  const metDoel = d.doel && d.doel.id !== d.bron?.id;
  ov.innerHTML = `
    <div class="kk-gloed"></div>
    ${_figuur(t.figuur, d)}
    <div class="kk-deeltjes">${_deeltjes(t.deeltje, 22)}</div>
    <div class="kk-midden">
      <div class="kk-portretten${metDoel ? ' kk-portretten--twee' : ''}">
        ${_portret(d.bron)}
        ${metDoel ? `<div class="kk-straal"></div>${_portret(d.doel, 'kk-portret--doel')}` : ''}
      </div>
      <div class="kk-woord">${esc(d.woord || d.label || '')}</div>
      ${d.getal != null ? `<div class="kk-getal" data-getal="${d.getal}">0</div>` : ''}
      ${d.stralen ? `<div class="kk-stralen">${d.stralen.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
      <div class="kk-regel">${esc(d.naam)}${metDoel ? ` → ${esc(d.doel.naam)}` : ''}${d.tekst ? ` · ${esc(d.tekst)}` : ''}</div>
      ${d.formule && d.worpen?.length ? `<div class="kk-worpen">${esc(d.formule)} · ${d.worpen.join(' + ')}</div>` : ''}
    </div>`;
  document.body.appendChild(ov);
  void ov.offsetWidth;
  ov.classList.add('is-aan');
  setTimeout(() => _telOp(ov.querySelector('.kk-getal'), d.getal), 900);
  window.soundManager?.klasseKlank?.(d.thema);
  setTimeout(() => {
    ov.classList.add('is-weg');
    setTimeout(() => ov.remove(), 900);
    if (d.actief) _merk(d, true);
  }, d.getal != null ? 5000 : 4200);
}

// `klasse:display` — alleen het tafelscherm.
function krachtDisplay(d) {
  if (!d) return;
  if (Array.isArray(d.opruimen)) {
    const m = document.getElementById('rage-merken');
    m?.querySelectorAll('.kk-merk').forEach(x => {
      if (d.opruimen.includes(x.dataset.char)) { x.classList.add('is-weg'); setTimeout(() => x.remove(), 1200); }
    });
    return;
  }
  if (d.einde) { _merk(d, false); return; }
  _moment(d);
}

// `klasse:updated` — iedereen in de campagne.
function krachtOntvang(d) {
  if (!d?.characterId) return;
  if (window._lastCharId === d.characterId || window._lastCharId === d.doelId) krachtBlok();
  if (window._isDisplayMode || d.stil || d.einde) return;
  const ik = mijnId();
  if (ik === d.characterId) {
    // Zelf gedrukt? Dan flitste het al. Anders deed de DM het namens jou.
    if (Date.now() - _eigenKlik > 3000) _flits(d.thema, d.woord, d.getal);
    return;
  }
  if (ik && ik === d.doelId) {
    _flits(d.thema, d.woord, d.getal);
    window._showToast?.(`${ic('sparkles')} ${esc(d.naam)}: ${esc(d.woord)} — ${esc(d.tekst || '')}`);
    return;
  }
  window._showToast?.(`${ic('sparkles')} ${esc(d.naam)}: ${esc(d.woord || d.label || '')}`);
}

window._krachtBlok = krachtBlok;
window._krachtDisplay = krachtDisplay;
window._krachtOntvang = krachtOntvang;
