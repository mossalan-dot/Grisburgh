// ── Het mooiste moment van de avond ──────────────────────────────────────────
// Aan het eind van een sessie stemt iedere speler — niet op zichzelf — op wiens
// moment het mooiste was. De winnaar krijgt Heroic Inspiration, het tafelscherm
// laat het zien.
//
// Drie schermen:
//  - de **DM** opent en sluit de ronde (knop in de regie-balk) en ziet alleen
//    hoeveel er gestemd hebben, nooit wie op wie;
//  - de **speler** krijgt een kaart met de anderen, en mag in één zin zeggen
//    waaróm — die zinnen komen bij de uitslag naam­loos op tafel;
//  - het **tafelscherm** toont de winnaar en de redenen.
//
// De server houdt de stemmen bij en geeft ze nooit terug (routes/api.js, zoek
// op "Het mooiste moment"). Side-effect import in app.js, net als rage.js.

import { api } from './api.js?v=320';

const ic  = (n, o) => window.icon?.(n, o) || '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// In een inline handler eerst JS-escapen, dan HTML (zie scripts/onclick-escapen.js).
const escArg = s => esc(typeof s === 'string' ? s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') : s);
const isDM    = () => !!window.app?.isDM?.();
const isTafel = () => !!window._isDisplayMode;
const RUSTIG  = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const portret = (k) => api.thumbUrl(k.imageId || k.id);
const roepnaam = (n) => String(n || '').split(' ')[0];

let _stand = null;           // laatste GET /stemronde
let _kaartDicht = null;      // id van de ronde die de speler wegklikte

async function _laad() {
  try { _stand = await api.get('/stemronde'); } catch { _stand = null; }
  return _stand;
}

// ── Speler ──────────────────────────────────────────────────────────────────

function _spelerKaartHtml(st) {
  const myId = window.app?.state?.characterId;
  const anderen = (st.kandidaten || []).filter(k => k.id !== myId);
  const mijn = st.mijnStem;
  return `<div class="stem-kaart" data-ronde="${esc(st.id)}">
    <div class="stem-kop">
      ${ic('vote')}
      <div>
        <div class="stem-titel">Het mooiste moment van de avond</div>
        <div class="stem-sub">${mijn ? 'Je hebt gestemd — wijzigen mag tot de DM sluit.' : 'Wiens moment was het? Je stem is geheim.'}</div>
      </div>
      <button class="stem-sluit" onclick="window.stemronde.kaartDicht(this)" title="Later">${ic('x')}</button>
    </div>
    <div class="stem-kandidaten">
      ${anderen.map(k => `<button class="stem-kandidaat${mijn?.op === k.id ? ' stem-kandidaat--gekozen' : ''}"
          data-id="${esc(k.id)}" onclick="window.stemronde.kies(this)">
          <img src="${portret(k)}" alt="" onerror="this.style.visibility='hidden'"${k.imgFocus ? ` style="object-position:${esc(k.imgFocus)}"` : ''}>
          <span>${esc(roepnaam(k.naam))}</span>
        </button>`).join('')}
    </div>
    ${(st.suggesties || []).length ? `<div class="stem-suggesties">
      <div class="stem-suggesties-kop">${ic('swords')} Vanavond aan tafel</div>
      ${st.suggesties.map(s => `<div class="stem-suggestie"><strong>${esc(roepnaam(s.naam))}</strong>${s.doel ? ` tegen ${esc(s.doel)}` : ''}: <em>${esc(s.tekst)}</em></div>`).join('')}
    </div>` : ''}
    <label class="stem-reden-label">Waarom? (mag leeg blijven)
      <textarea class="stem-reden" maxlength="160" rows="2">${esc(mijn?.reden || '')}</textarea></label>
    <div class="stem-voet">
      <span class="stem-teller">${st.gestemd} van ${st.totaal} gestemd</span>
      <button class="dm-btn dm-btn-primary stem-verstuur" onclick="window.stemronde.stem(this)"${mijn ? '' : ' disabled'}>
        ${ic('check')} ${mijn ? 'Bijwerken' : 'Stem'}</button>
    </div>
  </div>`;
}

// De kaart staat bovenaan het partytabblad zolang er een ronde loopt, en
// verschijnt als venster zodra de DM hem opent — dan kijkt iedereen toch naar
// zijn telefoon.
async function partyKaart() {
  const el = document.getElementById('party-stemronde');
  if (!el || isDM() || isTafel()) return;
  const st = await _laad();
  // Staat het venster open, dan niet twee keer dezelfde kaart.
  if (!st?.open || !st.magStemmen || _kaartDicht === st.id || document.getElementById('stem-venster')) { el.innerHTML = ''; return; }
  el.innerHTML = _spelerKaartHtml(st);
}

function _venster(st) {
  if (!st?.open || !st.magStemmen) return;
  let laag = document.getElementById('stem-venster');
  if (!laag) {
    laag = document.createElement('div');
    laag.id = 'stem-venster';
    laag.className = 'stem-venster';
    laag.addEventListener('click', ev => { if (ev.target === laag) _vensterDicht(); });
    document.body.appendChild(laag);
  }
  laag.innerHTML = _spelerKaartHtml(st);
  const el = document.getElementById('party-stemronde');
  if (el) el.innerHTML = '';
}

// Het venster wegklikken is "later": de kaart blijft op het partytabblad staan.
function _vensterDicht() {
  document.getElementById('stem-venster')?.remove();
  partyKaart();
}

function kies(btn) {
  const kaart = btn.closest('.stem-kaart');
  kaart.querySelectorAll('.stem-kandidaat').forEach(b => b.classList.toggle('stem-kandidaat--gekozen', b === btn));
  const knop = kaart.querySelector('.stem-verstuur');
  if (knop) knop.disabled = false;
}

async function stem(btn) {
  const kaart = btn?.closest('.stem-kaart');
  const op = kaart?.querySelector('.stem-kandidaat--gekozen')?.dataset.id;
  if (!op) return;
  const reden = kaart.querySelector('.stem-reden')?.value || '';
  try { await api.post('/stemronde/stem', { op, reden }); }
  catch (e) { window._showToast?.(`${ic('x')} ${esc(e.message)}`); return; }
  document.getElementById('stem-venster')?.remove();
  window._showToast?.(`${ic('vote')} Je stem is binnen — niemand ziet op wie`, null, 3500);
  partyKaart();
}

function kaartDicht(btn) {
  if (btn?.closest('#stem-venster')) { _vensterDicht(); return; }
  _kaartDicht = _stand?.id || null;
  const el = document.getElementById('party-stemronde');
  if (el) el.innerHTML = '';
}

// ── DM ──────────────────────────────────────────────────────────────────────

async function dm() {
  const st = await _laad();
  const body = !st?.open ? `<div class="stem-dm">
      <div class="stem-dm-uitleg">Iedereen die vanavond meedoet krijgt een stemkaart op zijn telefoon. Op jezelf stemmen kan niet, en wie op wie stemde ziet niemand — jij ook niet.</div>
      <div class="stem-dm-knoppen"><button class="dm-btn dm-btn-primary" onclick="window.stemronde.open()">${ic('vote')} Open de stemronde</button></div>
    </div>`
    : `<div class="stem-dm">
      <div class="stem-dm-stand"><span id="stem-dm-teller">${st.gestemd}</span> van ${st.totaal} gestemd</div>
      <div class="stem-dm-portretten">${(st.kandidaten || []).map(k => `<img src="${portret(k)}" alt="" title="${esc(k.naam)}" onerror="this.style.visibility='hidden'">`).join('')}</div>
      <div id="stem-dm-gelijk"></div>
      <div class="stem-dm-knoppen">
        <button class="dm-btn dm-btn-primary" onclick="window.stemronde.sluit()">${ic('trophy')} Sluiten en uitslag tonen</button>
        <button class="dm-btn dm-btn-ghost" onclick="window.stemronde.afbreken()">Afbreken</button>
      </div>
    </div>`;
  window.app.openModal(`${ic('vote')} Het mooiste moment`, st?.open ? 'De ronde loopt' : 'Stemronde aan het eind van de avond',
    body + (window._helpBtn?.('stemronde') ? `<div class="stem-dm-hulp">${window._helpBtn('stemronde')}</div>` : ''));
}

async function open() {
  try { await api.post('/stemronde', {}); }
  catch (e) { alert(e.message); return; }
  dm();
}

async function sluit(winnaar) {
  try {
    const r = await api.post('/stemronde/sluit', winnaar ? { winnaar } : {});
    window.app.closeModal?.();
    window._showToast?.(`${ic('trophy')} ${esc(r.winnaar?.naam || '')} krijgt Heroic Inspiration${r.hadAl ? ' — had hem al, mag hem doorgeven' : ''}`, null, 6000);
  } catch (e) {
    const d = e.data || e.body || {};
    if (d.gelijk) {
      const el = document.getElementById('stem-dm-gelijk');
      if (el) el.innerHTML = `<div class="stem-dm-gelijk">Gelijke stand (${d.stemmen} stemmen elk). Wie krijgt hem?
        <div class="stem-dm-portretten">${d.gelijk.map(k => `<button class="stem-kandidaat" onclick="window.stemronde.sluit('${escArg(k.id)}')">
          <img src="${portret(k)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(roepnaam(k.naam))}</span></button>`).join('')}</div></div>`;
      return;
    }
    alert(e.message);
  }
}

async function afbreken() {
  if (!confirm('De stemronde afbreken? De stemmen tot nu toe vervallen.')) return;
  try { await api.post('/stemronde/sluit', { annuleer: true }); } catch (e) { alert(e.message); return; }
  window.app.closeModal?.();
}

// ── Tafelscherm ─────────────────────────────────────────────────────────────

function uitslag(u) {
  if (!u?.winnaar) return;
  document.getElementById('stem-uitslag')?.remove();
  const laag = document.createElement('div');
  laag.id = 'stem-uitslag';
  laag.className = 'stem-uitslag' + (RUSTIG() ? ' stem-uitslag--rustig' : '');
  const redenen = (u.redenen || []).slice(0, 4);
  laag.innerHTML = `
    <div class="stem-uitslag-glans"></div>
    <div class="stem-uitslag-inhoud">
      <div class="stem-uitslag-kop">Het mooiste moment van de avond</div>
      <div class="stem-uitslag-ring"><img src="${portret(u.winnaar)}" alt=""${u.winnaar.imgFocus ? ` style="object-position:${esc(u.winnaar.imgFocus)}"` : ''}></div>
      <div class="stem-uitslag-naam">${esc(u.winnaar.naam)}</div>
      <div class="stem-uitslag-insp">${ic('sparkles')} Heroic Inspiration</div>
      <div class="stem-uitslag-redenen">${redenen.map((r, i) => `<div class="stem-uitslag-reden" style="--i:${i}">“${esc(r)}”</div>`).join('')}</div>
      <div class="stem-uitslag-telling">${u.stemmen} van de ${u.gestemd} stemmen</div>
    </div>`;
  const weg = () => { laag.classList.add('stem-uitslag--weg'); setTimeout(() => laag.remove(), 900); document.removeEventListener('keydown', esc_); };
  const esc_ = ev => { if (ev.key === 'Escape') weg(); };
  laag.addEventListener('click', weg);
  document.addEventListener('keydown', esc_);
  document.body.appendChild(laag);
  try { window.soundManager?.regieKlank?.('opening'); } catch { /* stil */ }
  setTimeout(weg, 9000 + redenen.length * 2500);
}

// ── Sockets (aangeroepen vanuit socket-client.js) ───────────────────────────

async function opSocket(soort, data = {}) {
  if (soort === 'open') {
    if (isDM() || isTafel()) return;
    _kaartDicht = null;
    const st = await _laad();
    if (st?.open && st.id === data.id) _venster(st);
    partyKaart();
  } else if (soort === 'stand') {
    const t = document.getElementById('stem-dm-teller');
    if (t) t.textContent = data.gestemd;
    document.querySelectorAll('.stem-teller').forEach(el => { el.textContent = `${data.gestemd} van ${data.totaal} gestemd`; });
  } else if (soort === 'dicht' || soort === 'uitslag') {
    document.getElementById('stem-venster')?.remove();
    const el = document.getElementById('party-stemronde');
    if (el) el.innerHTML = '';
    if (soort === 'uitslag' && !isDM() && !isTafel() && data.winnaar
        && data.winnaar.id !== window.app?.state?.characterId) {
      window._showToast?.(`${ic('trophy')} Het mooiste moment: <strong>${esc(data.winnaar.naam)}</strong>`, null, 6000);
    }
  } else if (soort === 'display' && isTafel()) {
    uitslag(data);
  }
}

window.stemronde = { partyKaart, kies, stem, kaartDicht, dm, open, sluit, afbreken, uitslag, opSocket };
