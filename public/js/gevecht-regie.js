// ── Gevechtsregie ────────────────────────────────────────────────────────────
// Het gevecht kreeg een begin, een middenstuk en een einde. Vijf momenten, en
// drie schermen die er elk iets anders van zien:
//
//  - het **tafelscherm** speelt ze af: de opening (Roll Initiative, de party
//    tegenover de vijand), een Lair Action op initiative 20, death saves als
//    scène met een hartslag eronder, "How do you want to do this?" na de
//    laatste klap, en de afloop;
//  - de **DM** krijgt een klein regiepaneel: wie stelt hij de vraag, welke Lair
//    Action gebeurt er. De app stelt voor, de DM drukt;
//  - de **speler** die de klap gaf krijgt een venster om te beschrijven hoe
//    — optioneel. Leeg laten is ook een antwoord.
//
// Wat er gebeurt beslist de server (routes/api.js, zoek op "Gevechtsregie");
// dit bestand tekent alleen. Side-effect import in app.js, net als rage.js.

import { api } from './api.js?v=318';

const ic = (n, o) => window.icon?.(n, o) || '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RUSTIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isDM    = () => !!window.app?.isDM?.();
const isTafel = () => !!window._isDisplayMode;
const klank   = (k) => { try { window.soundManager?.regieKlank?.(k); } catch { /* stil */ } };
const wacht   = (ms) => new Promise(r => setTimeout(r, RUSTIG() ? Math.min(ms, 400) : ms));

function _laag(id, cls) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  el.className = cls;
  return el;
}
function _weg(el, ms = 900) {
  if (!el) return;
  // Het id gaat er meteen af: anders pakt het volgende moment met `_laag` dit
  // stervende element, en haalt de timer hieronder het nieuwe moment weg.
  el.removeAttribute('id');
  el.classList.add('is-weg');
  setTimeout(() => el.remove(), RUSTIG() ? 0 : ms);
}

// Een portret in een ring. Het icoon ligt eronder: lukt het beeld niet, dan
// staat er tenminste iets.
function _portret(id, extra = '', icoon = 'user') {
  return `<span class="gr-portret ${extra}">
    <span class="gr-portret-ic">${ic(icoon)}</span>
    ${id ? `<span class="gr-portret-img" style="background-image:url('${api.thumbUrl(id)}')"></span>` : ''}
  </span>`;
}

// Een flits is elke keer een nieuw element: twee kort na elkaar mogen elkaar
// niet weghalen.
function _flits(soort) {
  const f = document.createElement('div');
  f.className = `gr-flits gr-flits--${soort}`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

function _letters(tekst) {
  return [...String(tekst)].map((ch, i) =>
    `<span class="gr-letter" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
}

// Een eigen bestand uit de Geluiden-tab (Momenten) wint van de gemaakte klank.
function _bestand(fileId) {
  if (!fileId) return false;
  try {
    const a = new Audio(api.fileUrl(fileId));
    a.volume = 0.85;
    a.play().catch(() => {});
    return true;
  } catch { return false; }
}

// Kaartjes die kort in beeld komen (lair, death saves) wachten op elkaar:
// twee tegelijk in het midden van het scherm leest niemand.
let _rij = Promise.resolve();
function _inRij(fn) { _rij = _rij.then(fn).catch(() => {}); return _rij; }

// ── 1. De opening ────────────────────────────────────────────────────────────
async function opening(d = {}) {
  if (!isTafel()) return;
  const party = (d.party || []).slice(0, 8);
  const vijanden = d.vijanden || [];
  const zicht = vijanden.slice(0, 6);
  const rest = vijanden.length - zicht.length;
  const el = _laag('gr-opening', 'gr-opening');
  el.innerHTML = `
    <div class="gr-balk gr-balk--boven"></div>
    <div class="gr-balk gr-balk--onder"></div>
    <div class="gr-op-titel">${_letters('Roll Initiative')}</div>
    <div class="gr-op-veld">
      <div class="gr-op-kant gr-op-kant--party">
        ${party.map((p, i) => `<div class="gr-op-figuur" style="--i:${i}">
          ${_portret(p.imageId, 'gr-portret--party', p.type === 'summon' ? 'sparkles' : p.type === 'ally' ? 'shield' : 'user')}
          <span class="gr-op-naam">${esc(p.naam)}</span></div>`).join('')}
      </div>
      <div class="gr-op-vs"><span class="gr-op-vs-slash"></span><span class="gr-op-vs-tekst">tegen</span></div>
      <div class="gr-op-kant gr-op-kant--vijand">
        ${zicht.map((v, i) => `<div class="gr-op-figuur" style="--i:${i}">
          ${_portret(v.imageId, 'gr-portret--vijand', 'skull')}
          ${v.aantal > 1 ? `<span class="gr-op-aantal">×${v.aantal}</span>` : ''}
          <span class="gr-op-naam">${esc(v.naam)}</span></div>`).join('')}
        ${rest > 0 ? `<div class="gr-op-figuur gr-op-meer" style="--i:${zicht.length}">+${rest}</div>` : ''}
      </div>
    </div>
    ${d.lair ? `<div class="gr-op-lair">${ic('mountain')} De plek zelf vecht mee</div>` : ''}`;
  let klaar = false;
  const sluit = () => { if (klaar) return; klaar = true; _weg(el, 1100); };
  el.addEventListener('click', sluit);
  if (!_bestand(d.geluid)) klank('opening');
  await wacht(2300);
  if (!klaar) klank('vs');
  await wacht(4600);
  sluit();
}

// ── 2. Lair Action ───────────────────────────────────────────────────────────
function lair(d = {}) {
  if (!isTafel() || !d.tekst) return;
  _inRij(async () => {
    const el = _laag('gr-lair', 'gr-lair');
    el.innerHTML = `
      <div class="gr-lair-kaart">
        <div class="gr-lair-kop">${ic('mountain')} Lair Action <span class="gr-lair-init">initiative 20</span></div>
        <div class="gr-lair-tekst">${esc(d.tekst)}</div>
      </div>`;
    document.body.classList.add('gr-beving');
    klank('lair');
    setTimeout(() => document.body.classList.remove('gr-beving'), 1300);
    el.addEventListener('click', () => _weg(el));
    await wacht(5200 + Math.min(4000, d.tekst.length * 40));
    _weg(el, 800);
    await wacht(500);
  });
}

// ── 3. Death saves ───────────────────────────────────────────────────────────
// Twee lagen. Een blijvende: zolang er iemand op sterven ligt kleurt de rand
// van het scherm rood en klopt er een hart dat trager wordt bij elke mislukte
// worp. En per worp een kaart in het midden.
const _STRIJD = {
  neer:    (d) => ({ kop: `${d.naam} valt`, sub: 'Death Saving Throws', duur: 3400 }),
  succes:  (d) => ({ kop: 'Geslaagd', sub: d.naam, duur: 3200 }),
  faal:    (d) => ({ kop: 'Mislukt', sub: d.naam, duur: 3400 }),
  stabiel: (d) => ({ kop: 'Stabiel', sub: `${d.naam} ademt nog`, duur: 3800 }),
  dood:    (d) => ({ kop: `${d.naam} is gevallen`, sub: '', duur: 6500 }),
  op:      (d) => ({ kop: d.nat20 ? 'Natural 20' : `${d.naam} staat op`, sub: d.nat20 ? `${d.naam} staat op` : '', duur: 4600 }),
};

function doodsstrijd(d = {}) {
  if (!isTafel() || !_STRIJD[d.uitkomst]) return;
  _inRij(async () => {
    const t = _STRIJD[d.uitkomst](d);
    const nieuw = d.uitkomst === 'succes' ? d.successes - 1 : d.uitkomst === 'faal' ? d.failures - 1 : -1;
    const bol = (n, soort) => [0, 1, 2].map(i =>
      `<span class="gr-ds-bol gr-ds-bol--${soort}${i < n ? ' is-vol' : ''}${(soort === 's' && d.uitkomst === 'succes' || soort === 'f' && d.uitkomst === 'faal') && i === nieuw ? ' is-nieuw' : ''}"></span>`).join('');
    const toonBollen = ['neer', 'succes', 'faal'].includes(d.uitkomst);
    const el = _laag('gr-strijd', `gr-strijd gr-strijd--${d.uitkomst}`);
    el.innerHTML = `
      <div class="gr-strijd-kaart">
        ${_portret(d.imageId, 'gr-portret--strijd')}
        <div class="gr-strijd-kop">${esc(t.kop)}</div>
        ${t.sub ? `<div class="gr-strijd-sub">${esc(t.sub)}</div>` : ''}
        ${toonBollen ? `<div class="gr-ds">
          <span class="gr-ds-rij">${bol(d.successes || 0, 's')}</span>
          <span class="gr-ds-scheid"></span>
          <span class="gr-ds-rij">${bol(d.failures || 0, 'f')}</span></div>` : ''}
      </div>`;
    if (d.uitkomst === 'op') {
      _flits('licht');
    }
    if (d.uitkomst === 'dood') document.body.classList.add('gr-grauw');
    klank({ neer: 'faal', succes: 'succes', faal: 'faal', stabiel: 'stabiel', dood: 'dood', op: 'op' }[d.uitkomst]);
    el.addEventListener('click', () => _weg(el));
    await wacht(t.duur);
    document.body.classList.remove('gr-grauw');
    _weg(el, 800);
    await wacht(400);
  });
}

let _hartTimer = null, _hartTempo = 0;
function _stervenden(combat) {
  if (!combat?.active) return [];
  return (combat.combatants || []).filter(c => {
    if (c.type !== 'player' || c.stabiel) return false;
    const neer = c.hp !== undefined ? (c.hp || 0) <= 0 : c.hpPct === 0;
    return neer && (c.deathSaves?.failures || 0) < 3;
  });
}
function _hartslag(combat) {
  const wie = _stervenden(combat);
  const vignet = document.getElementById('gr-vignet');
  if (!wie.length) {
    if (_hartTimer) { clearInterval(_hartTimer); _hartTimer = null; _hartTempo = 0; }
    if (vignet) _weg(vignet, 1200);
    return;
  }
  const slechtst = Math.max(...wie.map(c => c.deathSaves?.failures || 0));
  const tempo = [1050, 1400, 1900][Math.min(2, slechtst)];
  const v = vignet || _laag('gr-vignet', 'gr-vignet');
  v.style.setProperty('--gr-hart', `${tempo}ms`);
  v.dataset.ernst = String(slechtst);
  if (_hartTempo !== tempo) {
    if (_hartTimer) clearInterval(_hartTimer);
    _hartTempo = tempo;
    klank('hart');
    _hartTimer = setInterval(() => klank('hart'), tempo);
  }
}

// ── 4. How do you want to do this? ──────────────────────────────────────────
// Op tafel: alles vertraagt en loopt grijs weg, de vraag verschijnt tussen de
// held en zijn tegenstander, en dan wacht het scherm. Komt het antwoord, dan
// verschijnt het woord voor woord — en pas dan valt de klap.
let _genadeId = null;
async function genade(d = {}) {
  if (!isTafel()) return;
  if (d.fase === 'weg') {
    if (!d.id || d.id === _genadeId) _genadeSluit();
    return;
  }
  if (d.fase === 'vraag') {
    _genadeId = d.id;
    document.body.classList.add('gr-slowmo');
    const el = _laag('gr-genade', 'gr-genade gr-genade--vraag');
    el.innerHTML = `
      <div class="gr-balk gr-balk--boven"></div>
      <div class="gr-balk gr-balk--onder"></div>
      <div class="gr-gn-veld">
        <div class="gr-gn-held">${_portret(d.spelerBeeld, 'gr-portret--groot')}<span class="gr-gn-naam">${esc(d.spelerNaam)}</span></div>
        <div class="gr-gn-doel">${_portret(d.doelBeeld, 'gr-portret--groot gr-portret--doel', 'skull')}<span class="gr-gn-naam">${esc(d.doelNaam)}</span></div>
      </div>
      <div class="gr-gn-vraag">${_letters('How do you want to do this?')}</div>
      <div class="gr-gn-antwoord"></div>`;
    klank('vraag');
    return;
  }
  // antwoord of stil — kan ook binnenkomen zonder dat dit scherm de vraag zag
  // (een tafelscherm dat net verbonden was): dan bouwen we hem eerst op.
  if (!document.getElementById('gr-genade')) await genade({ ...d, fase: 'vraag' });
  const el = document.getElementById('gr-genade');
  const id = d.id;
  if (d.fase === 'antwoord' && d.tekst) {
    el.classList.add('gr-genade--antwoord');
    const vak = el.querySelector('.gr-gn-antwoord');
    const woorden = String(d.tekst).split(/\s+/).filter(Boolean);
    // De aanhalingstekens zitten aan het eerste en laatste woord vast: los
    // erachter breekt het sluitteken anders af naar een eigen regel.
    const n = woorden.length - 1;
    vak.innerHTML = woorden.map((w, i) => `<span class="gr-woord" style="--i:${i}">${
      i === 0 ? '<span class="gr-gn-quote">&ldquo;</span>' : ''}${esc(w)}${
      i === n ? '<span class="gr-gn-quote">&rdquo;</span>' : ''}</span>`).join(' ');
    const lezen = Math.min(9000, 900 + woorden.length * 260);
    await wacht(lezen);
    if (_genadeId !== id) return;
    _klap(d.geluid);
    el.classList.add('gr-genade--klap');
    await wacht(4200);
  } else {
    _klap(null);
    el.classList.add('gr-genade--klap');
    await wacht(1800);
  }
  if (_genadeId === id) _genadeSluit();
}
function _klap(bestand) {
  if (!_bestand(bestand)) klank('slag');
  _flits('klap');
}
function _genadeSluit() {
  _genadeId = null;
  document.body.classList.remove('gr-slowmo');
  _weg(document.getElementById('gr-genade'), 1200);
}

// ── 5. De afloop ─────────────────────────────────────────────────────────────
const _AFLOOP_KOP = { overwinning: 'Overwinning', nederlaag: 'Nederlaag', onbeslist: 'Het stof daalt neer' };
function _strijdRegel(s) {
  if (s.uitkomst === 'op')      return s.nat20 ? `${s.naam} stond op met een Natural 20` : `${s.naam} stond weer op`;
  if (s.uitkomst === 'stabiel') return `${s.naam} hield stand op de rand van de dood`;
  if (s.uitkomst === 'dood')    return `${s.naam} is gevallen`;
  return '';
}
async function afloop(d = {}) {
  if (!isTafel()) return;
  _hartslag(null);
  _genadeSluit();
  await wacht(1400);   // het overwinningsscherm van het canvas mag even staan
  const regels = (d.doodsstrijd || []).map(_strijdRegel).filter(Boolean);
  const momenten = d.momenten || [];
  const tegen = (d.tegenstanders || []).map(t => t.aantal > 1 ? `${t.aantal} × ${t.naam}` : t.naam).join(' · ');
  const feiten = [
    `${d.ronden || 1} ronde${(d.ronden || 1) === 1 ? '' : 'n'}`,
    d.duurMin ? `${d.duurMin} minu${d.duurMin === 1 ? 'ut' : 'ten'}` : '',
    d.lair ? `${d.lair} Lair Action${d.lair === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');
  let i = 0;
  const blok = (html) => `<div class="gr-af-blok" style="--i:${i++}">${html}</div>`;
  const el = _laag('gr-afloop', `gr-afloop gr-afloop--${esc(d.uitkomst || 'onbeslist')}`);
  el.innerHTML = `
    <div class="gr-balk gr-balk--boven"></div>
    <div class="gr-balk gr-balk--onder"></div>
    <div class="gr-af-inhoud">
      ${blok(`<div class="gr-af-kop">${esc(_AFLOOP_KOP[d.uitkomst] || _AFLOOP_KOP.onbeslist)}</div>`)}
      ${blok(`<div class="gr-af-feiten">${esc(feiten)}</div>`)}
      ${tegen ? blok(`<div class="gr-af-lbl">Tegenover u</div><div class="gr-af-tegen">${esc(tegen)}</div>`) : ''}
      ${momenten.map(m => blok(`<blockquote class="gr-af-quote">&ldquo;${esc(m.tekst)}&rdquo;
          <cite>${esc(m.speler)}, over ${esc(m.doel)}</cite></blockquote>`)).join('')}
      ${regels.length ? blok(regels.map(r => `<div class="gr-af-regel">${esc(r)}</div>`).join('')) : ''}
      ${(d.party || []).length ? blok(`<div class="gr-af-party">${d.party.map(p =>
          `<span class="gr-af-lid${p.uit ? ' is-uit' : ''}">${_portret(p.imageId, 'gr-portret--klein')}<span>${esc(p.naam)}</span></span>`).join('')}</div>`) : ''}
    </div>`;
  klank('afloop');
  let klaar = false;
  const sluit = () => { if (klaar) return; klaar = true; _weg(el, 1400); };
  el.addEventListener('click', sluit);
  await wacht(Math.min(26000, 9000 + i * 1300 + momenten.reduce((s, m) => s + m.tekst.length * 45, 0)));
  sluit();
}

// ── De regie van de DM ───────────────────────────────────────────────────────
// Een klein paneel bovenin dat alleen verschijnt als er iets te kiezen valt.
// Hertekend uit `combat.regie` (die alleen de DM krijgt) — maar alleen als er
// iets verandert, anders wist een gevechtsupdate wat hij aan het typen is.
let _dmSig = '';
function _dmPaneel(combat) {
  if (!isDM() || isTafel()) return;
  const r = combat?.active ? (combat.regie || {}) : {};
  const ronde = combat?.round || 1;
  const spelers = (combat?.combatants || []).filter(c => c.type === 'player' && c.entityId);
  const voorstel = !r.vraag && r.voorstel && (Date.now() - r.voorstel.ts) < 180000 ? r.voorstel : null;
  const lairNu = r.lairNu && r.lairNu.ronde === ronde && r.lairNu.gekozen == null ? r.lairNu : null;
  const sig = JSON.stringify([voorstel?.ts, r.vraag?.id, lairNu?.ts, spelers.map(s => s.entityId)]);
  if (sig === _dmSig) return;
  _dmSig = sig;
  const delen = [];
  if (r.vraag) {
    delen.push(`<div class="gr-dm-deel">
      <div class="gr-dm-kop">${ic('swords')} How do you want to do this?</div>
      <div class="gr-dm-regel">Wacht op <b>${esc(r.vraag.spelerNaam)}</b> — ${esc(r.vraag.doelNaam)}</div>
      <label class="gr-dm-lbl" for="gr-dm-tekst">Wat er aan tafel gezegd werd</label>
      <textarea id="gr-dm-tekst" class="dm-input" rows="2"></textarea>
      <div class="gr-dm-knoppen">
        <button class="dm-btn dm-btn-primary dm-btn-sm" onclick="window._gevechtRegie.dmAntwoord()">${ic('play')} Op tafel</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._gevechtRegie.dmAntwoord(true)" title="De klap valt zonder beschrijving">Zonder woorden</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._gevechtRegie.dmIntrekken()" title="De vraag intrekken; op tafel verdwijnt hij">${ic('x')}</button>
      </div></div>`);
  } else if (voorstel) {
    delen.push(`<div class="gr-dm-deel">
      <div class="gr-dm-kop">${ic('skull')} ${esc(voorstel.doelNaam)} valt${voorstel.laatste ? ' — de laatste' : ''}</div>
      <div class="gr-dm-regel">How do you want to do this?</div>
      <div class="gr-dm-knoppen">
        <select id="gr-dm-speler" class="dm-input dm-input-sm">
          ${spelers.map(s => `<option value="${esc(s.entityId)}"${s.entityId === voorstel.characterId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <button class="dm-btn dm-btn-primary dm-btn-sm" onclick="window._gevechtRegie.dmVraag('${esc(voorstel.doelId)}')">${ic('mail')} Vraag het</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._gevechtRegie.dmVoorstelWeg()" title="Niet nu">${ic('x')}</button>
      </div></div>`);
  }
  if (lairNu) {
    const regels = combat.lair?.regels || [];
    delen.push(`<div class="gr-dm-deel">
      <div class="gr-dm-kop">${ic('mountain')} Lair Action — initiative 20</div>
      <div class="gr-dm-lair">
        ${regels.map((t, i) => `<button class="gr-dm-lair-knop" onclick="window._gevechtRegie.dmLair(${i})">
          ${esc(t)}${i === r.lairVorige ? `<span class="gr-dm-tag" title="Dezelfde Lair Action mag niet twee rondes achter elkaar">vorige ronde</span>` : ''}</button>`).join('')}
      </div>
      <div class="gr-dm-knoppen">
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._gevechtRegie.dmLair(-1)">Overslaan</button>
      </div></div>`);
  }
  const el = document.getElementById('gr-dm');
  if (!delen.length) { el?.remove(); return; }
  const paneel = el || _laag('gr-dm', 'gr-dm');
  paneel.innerHTML = delen.join('');
}

const _fout = (e) => window._showToast?.(`${ic('x')} ${esc(e?.message || 'Mislukt')}`);
async function dmVraag(doelId) {
  const cid = document.getElementById('gr-dm-speler')?.value;
  try { await api.hwywtdtVraag(doelId, cid); } catch (e) { _fout(e); }
}
async function dmAntwoord(zonder) {
  const tekst = zonder ? '' : (document.getElementById('gr-dm-tekst')?.value || '').trim();
  try { await api.hwywtdtAntwoord({ tekst }); } catch (e) { _fout(e); }
}
async function dmIntrekken() {
  try { await api.hwywtdtAntwoord({ annuleer: true }); } catch (e) { _fout(e); }
}
async function dmVoorstelWeg() {
  try { await api.hwywtdtVoorstelWeg(); } catch (e) { _fout(e); }
}
async function dmLair(i) {
  try { await api.lairKies(i < 0 ? { overslaan: true } : { index: i }); } catch (e) { _fout(e); }
}

// ── De speler die de klap gaf ────────────────────────────────────────────────
function vraag(d = {}) {
  if (isTafel() || isDM() || !d.id) return;
  try { navigator.vibrate?.([60, 80, 160]); } catch { /* geen trilmotor */ }
  const el = _laag('gr-vraag', 'gr-vraag');
  el.dataset.id = d.id;
  el.innerHTML = `
    <div class="gr-vraag-kaart" role="dialog" aria-labelledby="gr-vraag-kop">
      <div class="gr-vraag-kop" id="gr-vraag-kop">How do you want to do this?</div>
      <div class="gr-vraag-sub">${esc(d.doelNaam || 'Je tegenstander')} valt door jouw hand.</div>
      <label class="gr-vraag-lbl" for="gr-vraag-tekst">Hoe gaat het?</label>
      <textarea id="gr-vraag-tekst" rows="4" maxlength="600"></textarea>
      <div class="gr-vraag-knoppen">
        <button class="dm-btn dm-btn-primary" onclick="window._gevechtRegie.antwoord()">${ic('swords')} Zo gaat het</button>
        <button class="dm-btn dm-btn-ghost" onclick="window._gevechtRegie.antwoord(true)">Laat maar</button>
      </div>
    </div>`;
  setTimeout(() => el.querySelector('textarea')?.focus(), 60);
}
async function antwoord(laatMaar) {
  const el = document.getElementById('gr-vraag');
  if (!el) return;
  const tekst = laatMaar ? '' : (el.querySelector('textarea')?.value || '').trim();
  el.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    await api.hwywtdtAntwoord({ id: el.dataset.id, tekst });
    _weg(el, 400);
  } catch (e) {
    el.querySelectorAll('button').forEach(b => { b.disabled = false; });
    _fout(e);
  }
}
function vraagKlaar(d = {}) {
  const el = document.getElementById('gr-vraag');
  if (el && (!d.id || el.dataset.id === d.id)) _weg(el, 400);
}

// ── Elke gevechtsupdate ──────────────────────────────────────────────────────
function onCombat(combat) {
  if (isTafel()) {
    _hartslag(combat);
    if (!combat?.active && _genadeId) _genadeSluit();
  }
  _dmPaneel(combat);
}

window._gevechtRegie = {
  opening, lair, doodsstrijd, genade, afloop, onCombat,
  vraag, vraagKlaar, antwoord,
  dmVraag, dmAntwoord, dmIntrekken, dmVoorstelWeg, dmLair,
};
