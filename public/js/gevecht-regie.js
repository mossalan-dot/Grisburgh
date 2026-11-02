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

import { api } from './api.js?v=319';

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
// ── 0. De overgang ───────────────────────────────────────────────────────────
// Voordat het gevecht er staat: drie witte flitsen en dan een patroon dat het
// beeld dichtzet — de klassieke sprong van rondlopen naar vechten. Het beeld is
// een raster van tegels; elk patroon is niets anders dan een volgorde waarin ze
// zwart worden (`--d` per tegel). Zo kost een nieuw patroon één functie.
const _PATRONEN = {
  spiraal: (K, R) => {            // van de rand naar binnen, met de klok mee
    const volg = new Array(K * R); let n = 0;
    let t = 0, b = R - 1, l = 0, r = K - 1;
    while (t <= b && l <= r) {
      for (let c = l; c <= r; c++) volg[t * K + c] = n++;
      for (let y = t + 1; y <= b; y++) volg[y * K + r] = n++;
      if (t < b) for (let c = r - 1; c >= l; c--) volg[b * K + c] = n++;
      if (l < r) for (let y = b - 1; y > t; y--) volg[y * K + l] = n++;
      t++; b--; l++; r--;
    }
    return volg.map(v => v / n);
  },
  balken: (K, R) => Array.from({ length: K * R }, (_, i) => {
    const y = Math.floor(i / K), x = i % K;            // om en om van links en rechts
    return ((y % 2 ? K - 1 - x : x) / K) * 0.85 + (y / R) * 0.15;
  }),
  cirkel: (K, R) => {
    const cx = (K - 1) / 2, cy = (R - 1) / 2, max = Math.hypot(cx, cy);
    return Array.from({ length: K * R }, (_, i) => 1 - Math.hypot(i % K - cx, Math.floor(i / K) - cy) / max);
  },
  scherven: (K, R) => Array.from({ length: K * R }, () => Math.random()),
  vegen: (K, R) => Array.from({ length: K * R }, (_, i) => ((i % K) + Math.floor(i / K)) / (K + R - 2)),
};

async function _overgang(soort) {
  if (soort === 'geen' || RUSTIG()) return null;
  const namen = Object.keys(_PATRONEN);
  const patroon = _PATRONEN[soort] ? soort : namen[Math.floor(Math.random() * namen.length)];
  const K = 16, R = 9;
  const volg = _PATRONEN[patroon](K, R);
  const el = _laag('gr-overgang', `gr-overgang gr-overgang--${patroon}`);
  el.innerHTML = `<div class="gr-ov-flits"></div>
    <div class="gr-ov-raster" style="--k:${K};--r:${R}">
      ${volg.map(v => `<i style="--d:${Math.round(v * 900)}ms"></i>`).join('')}
    </div>`;
  klank('overgang');
  await wacht(1700);
  return el;
}

async function opening(d = {}) {
  if (!isTafel()) return;
  const dicht = await _overgang(d.overgang);
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
  // De zwarte tegels blijven liggen tot de opening eroverheen ligt.
  if (dicht) setTimeout(() => _weg(dicht, 600), 700);
  if (!_bestand(d.geluid)) klank('opening');
  await wacht(2300);
  if (!klaar) klank('vs');
  await wacht(4600);
  sluit();
}

// ── 2. Lair Action en omgeving ───────────────────────────────────────────────
// Een kaart met wat er gebeurt, de Saving Throw die de tafel moet gooien, en
// het beeld erbij: een effect uit de tafelscherm-catalogus (bliksem, vuur,
// gif…) of iets eigens (stijgend water). Een gunstig effect beeft niet.
let _fxAan = false;
function lair(d = {}) {
  if (!isTafel() || !d.tekst) return;
  _inRij(async () => {
    const gunstig = d.soort === 'gunstig';
    const kop = d.bron === 'akte' ? (d.label || 'Omgeving') : 'Lair Action';
    const el = _laag('gr-lair', `gr-lair${gunstig ? ' gr-lair--gunstig' : ''}`);
    el.innerHTML = `
      ${d.beeld === 'water' ? '<div class="gr-water"><i></i><i></i></div>' : ''}
      <div class="gr-lair-kaart">
        <div class="gr-lair-kop">${ic(d.icoon || 'mountain')} ${esc(kop)}
          ${d.bron === 'lair' || !d.bron ? '<span class="gr-lair-init">initiative 20</span>' : ''}</div>
        <div class="gr-lair-tekst">${esc(d.tekst)}</div>
        ${d.samenvatting ? `<div class="gr-lair-save">${esc(d.samenvatting)}</div>` : ''}
      </div>`;
    if (d.fx && window._displayEffect) { window._displayEffect(d.fx); _fxAan = d.fx.soort === 'toestand'; }
    if (!gunstig) {
      document.body.classList.add('gr-beving');
      setTimeout(() => document.body.classList.remove('gr-beving'), 1300);
    }
    klank(gunstig ? 'stabiel' : 'lair');
    el.addEventListener('click', () => _weg(el));
    await wacht((d.samenvatting ? 7800 : 5200) + Math.min(4000, d.tekst.length * 40));
    _weg(el, 800);
    await wacht(500);
  });
}

// De uitslag van een effect: per doel wat het hem deed. Wie geraakt is schudt,
// wie ontsnapte staat er rustig bij.
function uitslag(d = {}) {
  if (!isTafel()) return;
  _inRij(async () => {
    const gunstig = d.soort === 'gunstig';
    const label = (r) => {
      const c = r.conditie ? ' · ' + r.conditie[0].toUpperCase() + r.conditie.slice(1) : '';
      if (gunstig) return [r.thp ? `+${r.thp} Temporary HP` : '', r.heal ? `+${r.heal} HP` : '', c.slice(3)].filter(Boolean).join(' · ') || 'gesterkt';
      if (r.schade) return `−${r.schade}${r.uitkomst === 'geslaagd' ? ' (half)' : ''}${c}`;
      return r.uitkomst === 'geslaagd' ? 'ontsnapt' : (c.slice(3) || 'geraakt');
    };
    const el = _laag('gr-uitslag', `gr-uitslag${gunstig ? ' gr-uitslag--gunstig' : ''}`);
    el.innerHTML = `
      <div class="gr-uitslag-kaart">
        <div class="gr-uitslag-kop">${ic(d.icoon || 'mountain')} ${esc(d.tekst || '')}</div>
        <div class="gr-uitslag-rij">
          ${(d.regels || []).map((r, i) => {
            const geraakt = !gunstig && (r.schade || r.conditie);
            return `<div class="gr-uitslag-lid${geraakt ? ' is-geraakt' : ''}${gunstig ? ' is-gesterkt' : ''}" style="--i:${i}">
              ${_portret(r.imageId, 'gr-portret--klein')}
              <span class="gr-uitslag-naam">${esc(r.naam)}</span>
              <span class="gr-uitslag-wat">${esc(label(r))}</span></div>`;
          }).join('')}
        </div>
      </div>`;
    if (_fxAan && window._displayEffect) { window._displayEffect({ effect: 'uit', soort: 'uit' }); _fxAan = false; }
    klank(gunstig ? 'succes' : 'slag');
    el.addEventListener('click', () => _weg(el));
    await wacht(5200 + (d.regels || []).length * 300);
    _weg(el, 800);
    await wacht(400);
  });
}

// Een aftelling: een penning rechtsboven die blijft staan, en bij elke nieuwe
// ronde een groot getal in het midden.
function aftellen(d = {}) {
  if (!isTafel()) return;
  const weg = () => _weg(document.getElementById('gr-aftellen'), 600);
  if (!d.over) { weg(); return; }
  const el = document.getElementById('gr-aftellen') || _laag('gr-aftellen', 'gr-aftellen');
  el.innerHTML = `
    <span class="gr-af-ring" style="--deel:${(d.over / (d.totaal || d.over)) * 100}%">
      <span class="gr-af-getal">${d.over}</span></span>
    <span class="gr-af-label">${ic(d.icoon || 'hourglass')} ${esc(d.tekst || '')}</span>`;
  _inRij(async () => {
    const groot = _laag('gr-aftel-groot', 'gr-aftel-groot');
    groot.innerHTML = `<span>${d.over}</span><small>${esc(d.start ? d.tekst || '' : d.over === 1 ? 'nog één ronde' : `nog ${d.over} rondes`)}</small>`;
    klank('tik');
    await wacht(2400);
    _weg(groot, 600);
    await wacht(300);
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
let _laatsteCombat = null;
let _effect = null;              // het omgevingseffect dat nog afgehandeld moet worden
let _effUit = {};                // per doel de keuze van de DM
function _dmPaneel(combat) {
  if (!isDM() || isTafel()) return;
  _laatsteCombat = combat;
  const r = combat?.active ? (combat.regie || {}) : {};
  const ronde = combat?.round || 1;
  const spelers = (combat?.combatants || []).filter(c => c.type === 'player' && c.entityId);
  const voorstel = !r.vraag && r.voorstel && (Date.now() - r.voorstel.ts) < 180000 ? r.voorstel : null;
  const lairNu = r.lairNu && r.lairNu.ronde === ronde && r.lairNu.gekozen == null ? r.lairNu : null;
  const sig = JSON.stringify([voorstel?.ts, r.vraag?.id, lairNu?.ts, spelers.map(s => s.entityId), _effect?.id]);
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
  if (_effect) delen.push(_effectDeel(_effect));
  if (lairNu && !_effect) {
    const regels = combat.lair?.regels || [];
    delen.push(`<div class="gr-dm-deel">
      <div class="gr-dm-kop">${ic('mountain')} Lair Action — initiative 20</div>
      <div class="gr-dm-lair">
        ${regels.map((t, i) => {
          const regel = typeof t === 'string' ? { tekst: t } : t;
          return `<button class="gr-dm-lair-knop${regel.soort === 'gunstig' ? ' is-gunstig' : ''}" onclick="window._gevechtRegie.dmLair(${i})">
            ${ic(_PRESET_ICOON[regel.preset] || 'mountain')} <span>${esc(regel.tekst || regel.preset || '')}</span>
            ${regel.rondes ? `<span class="gr-dm-tag">aftellen: ${regel.rondes}</span>` : ''}
            ${i === r.lairVorige ? `<span class="gr-dm-tag" title="Dezelfde Lair Action mag niet twee rondes achter elkaar">vorige ronde</span>` : ''}</button>`;
        }).join('')}
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

// Het icoon per preset, voor de knoppen; de catalogus zelf staat op de server.
const _PRESET_ICOON = {
  aardbeving: 'mountain', storm: 'cloud-lightning', water: 'waves', aftellen: 'hourglass', vuur: 'flame',
  gifnevel: 'biohazard', stenen: 'brick-wall', vrieskou: 'snowflake', fluistering: 'ear', duisternis: 'moon',
  'heilig-licht': 'sparkles', bron: 'droplets', altaar: 'shield-check', zegen: 'sparkle', eigen: 'hexagon',
};

// Een effect afhandelen. De tafel gooit; jij tikt per doel aan wat er gebeurde.
// De getallen zijn vooraf gerold en mag je overtypen.
function _effectDeel(e) {
  const gunstig = e.regel?.soort === 'gunstig';
  const keuzes = gunstig ? [['aan', 'Wel'], ['uit', 'Niet']]
    : e.regel?.save ? [['mislukt', 'Mislukt'], ['geslaagd', 'Geslaagd'], ['uit', 'Niet geraakt']]
    : [['mislukt', 'Geraakt'], ['uit', 'Niet geraakt']];
  const standaard = (d) => d.aan ? (gunstig ? 'aan' : 'mislukt') : 'uit';
  for (const d of e.doelen) if (!_effUit[d.id]) _effUit[d.id] = standaard(d);
  const g = e.regel?.gunst || {};
  const veld = (id, lbl, waarde) => `<label class="gr-dm-getal">${lbl}
    <input id="${id}" class="dm-input dm-input-sm" type="number" min="0" value="${waarde}"></label>`;
  return `<div class="gr-dm-deel gr-dm-deel--effect${gunstig ? ' is-gunstig' : ''}">
    <div class="gr-dm-kop">${ic(e.icoon || 'mountain')} ${esc(e.regel?.tekst || e.label)}</div>
    ${e.samenvatting ? `<div class="gr-dm-regel">${esc(e.samenvatting)}</div>` : ''}
    <div class="gr-dm-doelen">
      ${e.doelen.map(d => `<div class="gr-dm-doel${d.kant === 'vijand' ? ' is-vijand' : ''}" data-doel="${esc(d.id)}">
        <span class="gr-dm-doel-naam">${esc(d.naam)}</span>
        <span class="gr-dm-seg">${keuzes.map(([v, l]) => `<button class="${_effUit[d.id] === v ? 'is-aan' : ''}"
          onclick="window._gevechtRegie.dmEffKies('${esc(d.id)}','${v}',this)">${l}</button>`).join('')}</span>
      </div>`).join('')}
    </div>
    <div class="gr-dm-knoppen">
      ${e.regel?.schade ? veld('gr-eff-schade', `Schade (${esc(e.regel.schade.worp)})`, e.schade) : ''}
      ${g.thp ? veld('gr-eff-thp', `Temporary HP (${esc(g.thp)})`, e.thp) : ''}
      ${g.heal ? veld('gr-eff-heal', `Genezing (${esc(g.heal)})`, e.heal) : ''}
    </div>
    <div class="gr-dm-knoppen">
      <button class="dm-btn dm-btn-primary dm-btn-sm" onclick="window._gevechtRegie.dmEffToepassen()">${ic('check')} Toepassen</button>
      <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._gevechtRegie.dmEffNiets()" title="Sluiten zonder iets aan HP of condities te doen">Niets toepassen</button>
    </div></div>`;
}
function dmEffKies(id, v, knop) {
  _effUit[id] = v;
  knop?.parentElement?.querySelectorAll('button').forEach(b => b.classList.toggle('is-aan', b === knop));
}
async function dmEffToepassen() {
  if (!_effect) return;
  const getal = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
  try {
    await api.omgevingUitslag({ id: _effect.id, uitslagen: _effUit,
      schade: getal('gr-eff-schade'), thp: getal('gr-eff-thp'), heal: getal('gr-eff-heal') });
  } catch (e) { _fout(e); }
}
async function dmEffNiets() {
  if (!_effect) return;
  try { await api.omgevingUitslag({ id: _effect.id, niets: true }); } catch (e) { _fout(e); }
}
function effect(e) {
  _effect = e || null;
  _effUit = {};
  _dmSig = '';
  _dmPaneel(_laatsteCombat);
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
    if (!combat?.active) _weg(document.getElementById('gr-aftellen'), 600);
  }
  _dmPaneel(combat);
}

window._gevechtRegie = {
  opening, lair, uitslag, aftellen, doodsstrijd, genade, afloop, onCombat, effect,
  vraag, vraagKlaar, antwoord,
  dmVraag, dmAntwoord, dmIntrekken, dmVoorstelWeg, dmLair, dmEffKies, dmEffToepassen, dmEffNiets,
};

// Een effect dat nog openstond toen de DM de pagina herlaadde, staat er weer.
setTimeout(async () => {
  if (!isDM() || isTafel()) return;
  try { const r = await api.omgevingEffect(); if (r?.effect) effect(r.effect); } catch { /* niets open */ }
}, 2500);
