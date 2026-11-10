// Wat voorafging — de filmische terugblik op het tafelscherm.
//
// Aan het begin van een avond weet de helft van de tafel niet meer waar ze
// gebleven waren. De DM vat het samen, en dat is het moment waarop iedereen
// zijn telefoon pakt. Dit maakt er een opening van: het vorige sessieverslag
// als trailer — titelkaart, de akte, de tekst woord voor woord over trage
// beelden, het citaat, wie je ontmoette, en dan "gaat het verder".
//
// Alles wat hier staat komt van `POST /display/terugblik`, en de server stelt
// het samen uit alleen wat de actieve party al kent. Deze module rekent niets
// uit en vraagt niets op; hij regisseert.
//
// Opbouw: eerst een lijst **shots** (wat, hoe lang), daarna één lus die ze
// afspeelt. Tikken springt naar het volgende shot, Escape sluit. Elke wacht
// hangt aan een run-nummer, dus sluiten midden in een shot laat geen
// achtergebleven timers iets tekenen op een scherm dat al weg is.
//
// Side-effect module, net als `tafels.js`: zet `window._terugblikCinematic`
// en `window._terugblikSluit`.

import { api } from './api.js?v=320';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, o) => window.icon?.(n, o) || '';

// Twee onzichtbare tekens om namen in de tekst te markeren vóór het escapen.
const NB = '\u0001', NE = '\u0002';

const RUSTIG = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Tekst: van markdown naar ondertitels ─────────────────────────────────────

// Een verslag is markdown met wikilinks. Op het scherm wil je zinnen, geen
// opmaak: koppen, tabellen en ingesloten beelden vallen weg, een [[naam]]
// wordt een gemarkeerde naam.
function _platteTekst(md) {
  return String(md || '')
    .replace(/!\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, __, alias) => NB + alias.trim() + NE)
    .replace(/\[\[([^\]]+)\]\]/g, (_, n) => NB + n.trim() + NE)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\{[a-z]+:([^}]*)\}/gi, '$1')
    .split('\n')
    .filter(r => !/^\s*\|/.test(r) && !/^\s*(-{3,}|>\s*\[!)/.test(r))
    .map(r => r.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*>\s?/, '').replace(/^\s*([-*+]|\d+[.)])\s+/, ''))
    .join('\n')
    .replace(/(\*\*|__|\*|_|==|~~|\^)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Namen die de server als gekend meestuurde krijgen ook goud als ze zonder
// [[ ]] in de tekst staan. Alleen buiten wat al gemarkeerd is, en de langste
// eerst — anders wordt "Bram" gemarkeerd binnen "Bram Kruik".
function _markeerNamen(tekst, namen) {
  const lijst = [...new Set(namen.filter(n => n && n.length > 2))].sort((a, b) => b.length - a.length);
  if (!lijst.length) return tekst;
  const re = new RegExp(lijst.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return tekst.split(new RegExp(`(${NB}[^${NE}]*${NE})`)).map(stuk =>
    stuk.startsWith(NB) ? stuk : stuk.replace(re, m => NB + m + NE)).join('');
}

// Zinnen, gebundeld tot brokken die een mens in één adem leest. Een te lange
// zin wordt op een komma gebroken; anders staat er een muur tekst op het scherm.
function _brokken(tekst, max = 175) {
  const zinnen = tekst.match(/[^.!?…]+(?:[.!?…]+["”’)]*|$)/g)?.map(z => z.trim()).filter(Boolean) || [];
  const uit = [];
  let huidig = '';
  const zichtbaar = (s) => s.replace(new RegExp(`[${NB}${NE}]`, 'g'), '').length;
  for (let z of zinnen) {
    while (zichtbaar(z) > max * 1.4) {
      // breek op de komma het dichtst bij het midden van de toegestane lengte
      const komma = z.slice(0, max).lastIndexOf(', ');
      const knip = komma > 40 ? komma + 1 : z.lastIndexOf(' ', max);
      if (knip < 20) break;
      const kop = z.slice(0, knip).trim();
      if (huidig) { uit.push(huidig); huidig = ''; }
      uit.push(kop + (kop.endsWith(',') ? '' : ' …'));
      z = z.slice(knip).trim();
    }
    if (huidig && zichtbaar(huidig + ' ' + z) > max) { uit.push(huidig); huidig = z; }
    else huidig = huidig ? huidig + ' ' + z : z;
  }
  if (huidig) uit.push(huidig);
  return uit;
}

// Woord voor woord: elk woord een eigen span met een volgnummer, zodat de CSS
// ze één voor één laat opkomen. Een naam blijft één woord, ook als hij uit
// drie woorden bestaat.
function _woordenHtml(brok) {
  // Spaties binnen een naam tijdelijk vervangen, zodat "Bram Kruik," één
  // woord blijft mét zijn komma — anders komt er een spatie vóór de komma.
  const BINNEN = '\u0003';
  const plat = brok.replace(new RegExp(`${NB}[^${NE}]*${NE}`, 'g'), m => m.replace(/ /g, BINNEN));
  return plat.split(/\s+/).filter(Boolean).map((w, i) => {
    const html = esc(w).replace(new RegExp(BINNEN, 'g'), ' ')
      .replace(new RegExp(NB, 'g'), '<span class="tb-naam">').replace(new RegExp(NE, 'g'), '</span>');
    return `<span class="tb-w" style="--w:${i}">${html}</span>`;
  }).join(' ');
}
const _woordenTal = (brok) => (brok.match(/\S+/g) || []).length;

function _romeins(n) {
  n = parseInt(n, 10);
  if (!n || n < 1 || n > 3999) return '';
  const T = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = '';
  for (const [w, l] of T) while (n >= w) { s += l; n -= w; }
  return s;
}

const _letters = (tekst) => [...tekst].map((c, i) =>
  c === ' ' ? '<span class="tb-l tb-l--spatie"> </span>'
            : `<span class="tb-l" style="--i:${i}">${esc(c)}</span>`).join('');

// ── Stof in het licht ────────────────────────────────────────────────────────
// Een handvol zwevende stofjes in de projectorbundel. Canvas, want honderd
// DOM-elementen die elk hun eigen animatie hebben trekken een tablet stuk.
function _stof(canvas) {
  if (RUSTIG()) return () => {};
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, actief = true;
  const maat = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  maat();
  window.addEventListener('resize', maat);
  const deeltjes = Array.from({ length: Math.round(Math.min(90, (w * h) / 16000)) }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: 0.4 + Math.random() * 1.8,
    vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.22,
    fase: Math.random() * Math.PI * 2, snel: 0.004 + Math.random() * 0.01,
    vonk: Math.random() < 0.12,
  }));
  const stap = () => {
    if (!actief) return;
    ctx.clearRect(0, 0, w, h);
    for (const d of deeltjes) {
      d.x += d.vx + Math.sin(d.fase) * 0.08; d.y += d.vy; d.fase += d.snel;
      if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
      if (d.x < -10) d.x = w + 10; else if (d.x > w + 10) d.x = -10;
      const a = (0.25 + 0.35 * Math.sin(d.fase * 1.7) ** 2) * (d.vonk ? 1.6 : 1);
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * (d.vonk ? 5 : 3));
      g.addColorStop(0, d.vonk ? `rgba(255,190,110,${Math.min(1, a)})` : `rgba(242,224,186,${a})`);
      g.addColorStop(1, 'rgba(242,224,186,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (d.vonk ? 5 : 3), 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(stap);
  };
  requestAnimationFrame(stap);
  return () => { actief = false; window.removeEventListener('resize', maat); };
}

// ── De regie ─────────────────────────────────────────────────────────────────

let _run = 0;            // elke start of sluiting verhoogt hem; oude lussen stoppen dan
let _volgende = null;    // resolve van de lopende wacht — tikken roept hem aan
let _opruimen = [];      // functies die bij het sluiten moeten lopen

function _wacht(ms, run) {
  return new Promise(res => {
    const t = setTimeout(() => { _volgende = null; res(); }, ms);
    _volgende = () => { clearTimeout(t); _volgende = null; res(); };
    _opruimen.push(() => { clearTimeout(t); res(); });
    if (run !== _run) { clearTimeout(t); res(); }
  });
}

// Muziek: een eigen bestand uit de Geluiden-tab (Momenten → Terugblik) wint;
// anders zingt de browser zelf een lage drone met een dreun bij de titel.
function _geluid(d) {
  const sm = window.soundManager;
  if (d.geluid) {
    try {
      const a = new Audio(api.fileUrl(d.geluid));
      a.volume = 0; a.play().catch(() => {});
      let v = 0;
      const op = setInterval(() => { v = Math.min(0.85, v + 0.05); a.volume = v; if (v >= 0.85) clearInterval(op); }, 120);
      return {
        dreun: () => {}, tik: () => {},
        stop: () => {
          clearInterval(op);
          const af = setInterval(() => { v = Math.max(0, v - 0.04); a.volume = v; if (v <= 0) { clearInterval(af); a.pause(); } }, 90);
        },
      };
    } catch { /* stilte is ook goed */ }
  }
  const stopDrone = sm?.terugblikKlank?.('drone') || (() => {});
  return {
    dreun: (zacht) => sm?.terugblikKlank?.(zacht ? 'dreunZacht' : 'dreun'),
    tik:   () => sm?.terugblikKlank?.('tik'),
    stop:  stopDrone,
  };
}

function _bouwShots(d) {
  const shots = [];
  shots.push({ fase: 'opening', duur: 5600 });
  if (d.akte?.titel || d.titel) shots.push({ fase: 'akte', duur: 6000 });

  const namen = [...(d.gezichten || []).map(g => g.naam), ...(d.plekken || [])];
  const brokken = _brokken(_markeerNamen(_platteTekst(d.tekst), namen)).slice(0, 18);
  // Een verslag van vier pagina's wordt geen trailer van vier minuten: na
  // achttien brokken houdt het op, en het laatste krijgt een beletselteken.
  if (_brokken(_markeerNamen(_platteTekst(d.tekst), namen)).length > 18 && brokken.length) {
    brokken[brokken.length - 1] = brokken[brokken.length - 1].replace(/[.!?…]*$/, ' …');
  }
  brokken.forEach((b, i) => {
    const n = _woordenTal(b);
    // Woorden komen op met 110 ms ertussen; daarna leestijd die meegroeit.
    shots.push({ fase: 'verhaal', brok: b, nr: i, duur: Math.min(13000, 1400 + n * 110 + n * 260) });
  });
  // Geen tekst maar wel beelden: dan is het een diavoorstelling.
  if (!brokken.length) (d.beelden || []).slice(0, 6).forEach((_, i) =>
    shots.push({ fase: 'verhaal', brok: '', nr: i, beeld: i, duur: 5200 }));

  if (d.citaat) shots.push({ fase: 'citaat', duur: Math.min(11000, 4200 + d.citaat.length * 40) });
  if ((d.gezichten || []).length) shots.push({ fase: 'personae', duur: 3200 + d.gezichten.length * 700 });
  shots.push({ fase: 'slot', duur: 6400 });
  return shots;
}

function _sluit(direct) {
  _run++;
  const ov = document.getElementById('terugblik');
  const ruim = _opruimen; _opruimen = [];
  ruim.forEach(f => { try { f(); } catch { /* gaat toch weg */ } });
  _volgende = null;
  document.removeEventListener('keydown', _toets, true);
  if (!ov) return;
  if (direct) { ov.remove(); return; }
  ov.classList.add('tb--weg');
  setTimeout(() => ov.remove(), 1400);
}

function _toets(e) {
  if (!document.getElementById('terugblik')) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _sluit(); }
  else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _volgende?.(); }
}

async function _speel(d, opties = {}) {
  _sluit(true);
  const run = ++_run;

  const ov = document.createElement('div');
  ov.id = 'terugblik';
  ov.className = 'tb';
  ov.innerHTML = `
    <div class="tb-podium">
      <div class="tb-laag"><img alt=""></div>
      <div class="tb-laag"><img alt=""></div>
    </div>
    <div class="tb-sluier"></div>
    <div class="tb-lek"></div>
    <canvas class="tb-stof"></canvas>
    <div class="tb-korrel"></div>
    <div class="tb-balk tb-balk--boven"></div>
    <div class="tb-balk tb-balk--onder"></div>
    <div class="tb-bijschrift"></div>
    <div class="tb-tekst"></div>
    <div class="tb-voortgang"><span></span></div>
    ${opties.voorbeeld ? `<div class="tb-voorbeeld">${ic('eye')} Voorbeeld — alleen op jouw scherm</div>` : ''}
    <button class="tb-sluit" type="button" title="Sluiten (Esc)">${ic('x')}</button>
    <div class="tb-hint">Tik om door te gaan</div>`;
  document.body.appendChild(ov);
  void ov.offsetWidth;                     // geen rAF: die staat stil in een achtergrondtab
  ov.classList.add('tb--open');

  ov.querySelector('.tb-sluit').addEventListener('click', (e) => { e.stopPropagation(); _sluit(); });
  ov.addEventListener('click', () => _volgende?.());
  document.addEventListener('keydown', _toets, true);
  _opruimen.push(_stof(ov.querySelector('.tb-stof')));

  const klank = _geluid(d);
  _opruimen.push(() => klank.stop());

  // ── Beelden ──
  const lagen = [...ov.querySelectorAll('.tb-laag')];
  let laag = 0, huidigBeeld = null;
  const bronnen = (d.beelden || []).map(b => ({ src: api.thumbUrlBreed(b.id), caption: b.caption }));
  const banner = d.akte?.banner ? { src: api.thumbUrlBreed(d.akte.banner), caption: '', focus: d.akte.bannerFocus } : null;
  // Alles vooraf laden: een beeld dat halverwege een zin binnendruppelt breekt
  // de illusie meer dan een zwart scherm.
  [...bronnen, banner].filter(Boolean).forEach(b => { const i = new Image(); i.src = b.src; });

  const toon = (b) => {
    if (!b || b === huidigBeeld) return;
    huidigBeeld = b;
    laag = 1 - laag;
    const el = lagen[laag], oud = lagen[1 - laag];
    const img = el.querySelector('img');
    // Elke keer een andere beweging: inzoomen of uitzoomen, en een andere kant op.
    const r = () => (Math.random() * 2 - 1);
    const inZoom = Math.random() < 0.6;
    el.style.setProperty('--kb-s0', inZoom ? '1.04' : '1.18');
    el.style.setProperty('--kb-s1', inZoom ? '1.18' : '1.04');
    el.style.setProperty('--kb-x0', `${(r() * 3).toFixed(1)}%`);
    el.style.setProperty('--kb-y0', `${(r() * 3).toFixed(1)}%`);
    el.style.setProperty('--kb-x1', `${(r() * 4).toFixed(1)}%`);
    el.style.setProperty('--kb-y1', `${(r() * 4).toFixed(1)}%`);
    img.style.objectPosition = b.focus || '';
    el.classList.remove('is-aan', 'tb-kb');
    img.onload = () => {
      if (run !== _run) return;
      void el.offsetWidth;
      el.classList.add('is-aan', 'tb-kb');
      oud.classList.remove('is-aan');
    };
    img.onerror = () => { huidigBeeld = null; };
    img.src = b.src;
    if (img.complete && img.naturalWidth) img.onload();
    const bs = ov.querySelector('.tb-bijschrift');
    bs.classList.remove('is-aan');
    if (b.caption) setTimeout(() => { if (run === _run) { bs.textContent = b.caption; bs.classList.add('is-aan'); } }, 900);
  };
  const beeldenWeg = () => {
    lagen.forEach(l => l.classList.remove('is-aan'));
    ov.querySelector('.tb-bijschrift').classList.remove('is-aan');
    huidigBeeld = null;
  };

  // ── Shots ──
  const shots = _bouwShots(d);
  const tekst = ov.querySelector('.tb-tekst');
  const balk = ov.querySelector('.tb-voortgang span');
  const totaal = shots.reduce((s, x) => s + x.duur, 0);
  let verstreken = 0, verhaalTijd = 0, laatsteBeeldWissel = -1;

  const zet = (fase, html) => {
    ov.dataset.fase = fase;
    tekst.className = `tb-tekst tb-tekst--${fase}`;
    tekst.innerHTML = html;
    void tekst.offsetWidth;
    tekst.classList.add('is-aan');
  };

  for (const shot of shots) {
    if (run !== _run) return;
    // De voortgangsbalk loopt over de duur van dít shot naar zijn eindpunt;
    // springt de tafel vooruit, dan springt de balk mee.
    balk.style.transition = 'none';
    balk.style.width = `${(verstreken / totaal) * 100}%`;
    void balk.offsetWidth;
    balk.style.transition = `width ${shot.duur}ms linear`;
    balk.style.width = `${((verstreken + shot.duur) / totaal) * 100}%`;
    ov.classList.toggle('tb--donker', shot.fase === 'citaat');
    ov.classList.toggle('tb--wazig', shot.fase === 'personae' || shot.fase === 'slot');

    if (shot.fase === 'opening') {
      beeldenWeg();
      zet('opening', `
        ${d.campagne ? `<div class="tb-campagne">${esc(d.campagne)}</div>` : ''}
        <div class="tb-lijn"></div>
        <h1 class="tb-titel">${_letters('Wat voorafging')}</h1>
        <div class="tb-lijn tb-lijn--onder"></div>`);
      setTimeout(() => { if (run === _run) klank.dreun(); }, 900);
    }

    else if (shot.fase === 'akte') {
      toon(banner || bronnen[0]);
      const rom = _romeins(d.akte?.num);
      zet('akte', `
        ${rom ? `<div class="tb-aktenr">Akte ${rom}</div>` : ''}
        <h2 class="tb-aktetitel">${esc(d.akte?.titel || d.titel)}</h2>
        <div class="tb-sier">${ic('sparkle')}</div>
        ${d.akte?.titel && d.titel && d.titel !== d.akte.titel ? `<div class="tb-sessie">${esc(d.titel)}</div>` : ''}
        ${d.datum ? `<div class="tb-datum">${esc(d.datum)}</div>` : ''}`);
    }

    else if (shot.fase === 'verhaal') {
      // Een nieuw beeld om de zeven seconden, nooit midden in het eerste woord.
      const want = shot.beeld != null ? shot.beeld
        : bronnen.length ? Math.floor(verhaalTijd / 7500) % bronnen.length : -1;
      if (want >= 0 && want !== laatsteBeeldWissel) { toon(bronnen[want]); laatsteBeeldWissel = want; }
      else if (want < 0 && banner) toon(banner);
      zet('verhaal', shot.brok
        ? `<p class="tb-zin">${_woordenHtml(shot.brok)}</p>`
        : '');
      verhaalTijd += shot.duur;
    }

    else if (shot.fase === 'citaat') {
      zet('citaat', `
        <div class="tb-aanhaling">${ic('quote')}</div>
        <blockquote class="tb-citaat">${esc(_platteTekst(d.citaat).replace(new RegExp(`[${NB}${NE}]`, 'g'), ''))}</blockquote>`);
      klank.dreun(true);
    }

    else if (shot.fase === 'personae') {
      if (!huidigBeeld) toon(banner || bronnen[0]);
      zet('personae', `
        <div class="tb-kop">Wie u ontmoette</div>
        <div class="tb-gezichten">
          ${d.gezichten.map((g, i) => `
            <figure class="tb-gezicht${g.nieuw ? ' tb-gezicht--nieuw' : ''}" style="--g:${i}">
              <div class="tb-portret">
                <span class="tb-initiaal">${esc((g.naam || '?').trim().charAt(0).toUpperCase())}</span>
                <img src="${api.thumbUrl(g.thumb)}" alt="" onerror="this.remove()"${g.focus ? ` style="object-position:${esc(g.focus)}"` : ''}>
              </div>
              <figcaption>
                <span class="tb-gezicht-naam">${esc(g.naam)}</span>
                ${g.nieuw ? `<span class="tb-gezicht-nieuw">${ic('sparkles')} Nieuw</span>` : ''}
              </figcaption>
            </figure>`).join('')}
        </div>
        ${(d.plekken || []).length ? `<div class="tb-plekken">${ic('map-pin')} ${d.plekken.map(esc).join('<span class="tb-punt">·</span>')}</div>` : ''}`);
      d.gezichten.forEach((_, i) => setTimeout(() => { if (run === _run) klank.tik(); }, 500 + i * 260));
    }

    else if (shot.fase === 'slot') {
      zet('slot', `
        ${(d.helden || []).length ? `
          <div class="tb-helden">
            ${d.helden.map((h, i) => `
              <div class="tb-held" style="--g:${i}" title="${esc(h.naam)}">
                <img src="${api.thumbUrl(h.thumb)}" alt="" onerror="this.remove()"${h.focus ? ` style="object-position:${esc(h.focus)}"` : ''}>
                <span>${esc((h.naam || '?').split(/\s+/)[0])}</span>
              </div>`).join('')}
          </div>` : ''}
        <div class="tb-slot-1">En nu…</div>
        <div class="tb-slot-2">gaat het verder.</div>`);
      setTimeout(() => { if (run === _run) { beeldenWeg(); klank.dreun(true); } }, 2600);
    }

    await _wacht(shot.duur, run);
    verstreken += shot.duur;
    tekst.classList.remove('is-aan');
    tekst.classList.add('is-uit');
    await _wacht(shot.fase === 'opening' ? 700 : 450, run);
  }
  if (run === _run) _sluit();
}

window._terugblikCinematic = (d, opties) => { if (d) _speel(d, opties); };
window._terugblikSluit = () => _sluit();

// Voor de tests: de tekstbewerking zonder DOM.
export const _intern = { _platteTekst, _markeerNamen, _brokken, _romeins };
