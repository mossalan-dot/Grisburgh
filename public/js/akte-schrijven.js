/**
 * akte-schrijven.js — een akte schrijven zonder Obsidian.
 *
 * De Meesterkamer kon een hoofdstuk alleen ínlezen (een .md kiezen) of in een
 * klein tekstvak plakken. Schrijven deed je elders, en dat is precies waarom er
 * tijdens het spelen een tweede venster openstond. Dit is een volwaardig
 * schrijfscherm: de tekst over de volle hoogte, een overzicht van de secties
 * ernaast, en een invoegbalk die de campagne kent.
 *
 * Dát laatste is het verschil met Obsidian: daar tik je een naam en hoop je dat
 * er een kaartje bij hoort. Hier kies je uit de kaartjes die er zijn, en wat je
 * invoegt is gegarandeerd gekoppeld — `[[Bram Kruik]]`, `![[<fileId>]]`, of een
 * regieblok dat naar een gevecht, een tabel of een vondst wijst.
 *
 * Het opgeslagen formaat blijft **markdown**. De regieblokken zijn
 * Obsidian-callouts (`> [!voorlezen]`), dus je kunt de tekst heen en weer
 * kopiëren zonder dat er iets sneuvelt — daar zijn ze voor gekozen. Zie
 * docs/voorstel-akteregie.md.
 */

import { api } from './api.js?v=286';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);

// ── De regieblokken ──────────────────────────────────────────────────────────
// Eén plek waar staat welke callouts we kennen, hoe ze heten en hoe ze eruit
// zien. De speel-kant (de lade) leest straks dezelfde lijst.
export const REGIE_BLOKKEN = {
  voorlezen: { label: 'Voorlezen', icon: 'quote',          hint: 'Wat je letterlijk voorleest aan tafel' },
  dm:        { label: 'Notitie',   icon: 'eye-off',        hint: 'Alleen voor jou — komt nooit op tafel' },
  gevecht:   { label: 'Gevecht',   icon: 'swords',         hint: 'Een encounter die je hier kunt starten' },
  tabel:     { label: 'Tabel',     icon: 'dice',           hint: 'Een tabel om hier te rollen' },
  buit:      { label: 'Buit',      icon: 'vault',          hint: 'Een vondst om hier te onthullen' },
  kaart:     { label: 'Kaart',     icon: 'castle',         hint: 'Een dungeonkaart om hier te openen' },
  rust:      { label: 'Rust',      icon: 'moon',           hint: 'Lange of korte rust' },
  check:     { label: 'Check',     icon: 'target',         hint: 'Een DC als aantekening — geen mechaniek' },
};

// ── Staat ────────────────────────────────────────────────────────────────────
let _ch       = null;     // aktesleutel
let _titel    = '';
let _tekst    = '';
let _bewaard  = true;
let _timer    = null;
let _voorbeeld = false;

const _ta = () => document.getElementById('akte-schrijf-ta');

// ── Secties ──────────────────────────────────────────────────────────────────
// De `##`-koppen zijn de ruggengraat: ze delen het schrijfscherm op, ze worden
// de sectiestrook tijdens het spelen, en de importer maakt er sectiekoppen van.
function _secties(tekst) {
  const uit = [];
  const regels = String(tekst || '').split('\n');
  regels.forEach((r, i) => {
    const m = r.match(/^(#{1,3})\s+(.*)$/);
    if (m) uit.push({ niveau: m[1].length, titel: m[2].replace(/[[\]]/g, '').trim(), regel: i });
  });
  return uit;
}

// ── Opslaan ──────────────────────────────────────────────────────────────────
// Tijdens het schrijven, niet op een knop: je bent aan het schrijven, niet aan
// het administreren. Wel gebundeld — anders is elke aanslag een verzoek.
function _merkVuil() {
  _bewaard = false;
  _zetStatus();
  clearTimeout(_timer);
  _timer = setTimeout(_bewaar, 1200);
}

async function _bewaar() {
  clearTimeout(_timer);
  const ta = _ta();
  if (!ta || !_ch) return;
  const waarde = ta.value;
  try {
    await api.saveAkteTekst(_ch, waarde);
    _tekst = waarde;
    _bewaard = true;
    // De client houdt zijn eigen meta bij; anders toont de Aktes-tab de oude tekst.
    const hk = window.app?.state?.meta?.hoofdstukken;
    if (hk) { hk[_ch] = hk[_ch] || {}; hk[_ch].tekst = waarde; }
    _zetStatus();
  } catch (e) {
    _bewaard = false;
    _zetStatus('Opslaan mislukt: ' + e.message);
  }
}

function _zetStatus(fout) {
  const el = document.getElementById('akte-schrijf-status');
  if (!el) return;
  el.textContent = fout || (_bewaard ? 'bewaard' : 'opslaan…');
  el.classList.toggle('is-fout', !!fout);
}

// ── Invoegen ─────────────────────────────────────────────────────────────────
// Alles gaat door één deur: tekst op de cursorpositie, of om de selectie heen.
function _voegIn(tekst, { blok = false } = {}) {
  const ta = _ta();
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  let invoeg = tekst;
  if (blok) {
    const voor = ta.value.slice(0, s);
    const nodig = voor && !voor.endsWith('\n\n') ? (voor.endsWith('\n') ? '\n' : '\n\n') : '';
    invoeg = nodig + tekst + '\n\n';
  }
  ta.setRangeText(invoeg, s, e, 'end');
  ta.focus();
  _merkVuil();
  _tekenSecties();
}

function _blokTekst(soort, kop = '', inhoud = '') {
  const regels = [`> [!${soort}]${kop ? ' ' + kop : ''}`];
  // Geen inhoud betekent geen lege `>`-regel eronder: een blok dat alleen naar
  // een gevecht of een tabel wijst is af met zijn kop.
  if (String(inhoud || '').trim()) {
    for (const r of String(inhoud).split('\n')) regels.push('> ' + r);
  }
  return regels.join('\n');
}

// ── Kiezers ──────────────────────────────────────────────────────────────────
// Een lijstje in het gedeelde venster, met een zoekveld. Bewust niet de
// datalist-aanpak van de Meesterkamer: je zoekt hier iets op om het ín een
// zin te zetten, dus je wilt zien wat er is.
function _kiezer(titel, rijen, opPick, leegTekst = 'Niets gevonden.') {
  window.app.openModal(titel, '', `
    <div class="dm-feature-section" style="margin:0">
      <div class="pb-zoek-rij">
        ${icon('search', { cls: 'pb-zoek-icoon' })}
        <input class="dm-input" id="akte-kies-zoek" autofocus placeholder="Zoeken…"
               oninput="window.akteSchrijven._filter(this.value)">
      </div>
      <div class="pb-entity-list" id="akte-kies-lijst">
        ${rijen.length ? rijen.map((r, i) => `
          <button class="pb-entity-item" data-name="${esc((r.naam || '').toLowerCase())}"
                  onclick="window.akteSchrijven._pick(${i})">
            <span class="pb-entity-icon">${icon(r.icoon || 'hexagon')}</span>
            <span class="pb-entity-name">${esc(r.naam)}${r.bij ? ` <span class="dm-hint">· ${esc(r.bij)}</span>` : ''}</span>
          </button>`).join('') : `<p class="dm-hint">${esc(leegTekst)}</p>`}
      </div>
    </div>`);
  window.akteSchrijven._rijen = rijen;
  window.akteSchrijven._opPick = opPick;
}

// ── Voorbeeld ────────────────────────────────────────────────────────────────
// Kijkstand, geen tweede editor — zelfde afspraak als bij de opmaakbalk op een
// kaartje. De callouts worden hier al kaders, zodat je ziet wat je maakt.
export function regieNaarHtml(md) {
  const regels = String(md || '').split('\n');
  const uit = [];
  let i = 0;
  while (i < regels.length) {
    const m = regels[i].match(/^>\s*\[!([a-z-]+)\]\s*(.*)$/i);
    if (m) {
      const soort = m[1].toLowerCase();
      const kop   = m[2].trim();
      const body  = [];
      i++;
      while (i < regels.length && /^>\s?/.test(regels[i])) { body.push(regels[i].replace(/^>\s?/, '')); i++; }
      const blok = REGIE_BLOKKEN[soort];
      uit.push(`<div class="regie-blok regie-blok--${esc(soort)}">
        <div class="regie-blok-kop">${icon(blok?.icon || 'hexagon')} ${esc(kop || blok?.label || soort)}</div>
        ${body.length ? `<div class="regie-blok-body">${window.app.mdToHtml(body.join('\n'))}</div>` : ''}
      </div>`);
      continue;
    }
    // Gewone regels in één blok tot de volgende callout; mdToHtml doet de rest.
    const blokRegels = [];
    while (i < regels.length && !/^>\s*\[!/.test(regels[i])) { blokRegels.push(regels[i]); i++; }
    if (blokRegels.join('').trim()) uit.push(window.app.mdToHtml(blokRegels.join('\n')));
  }
  return uit.join('\n');
}

// ── Tekenen ──────────────────────────────────────────────────────────────────
function _tekenSecties() {
  const host = document.getElementById('akte-schrijf-secties');
  if (!host) return;
  const secties = _secties(_ta()?.value ?? _tekst);
  host.innerHTML = secties.length
    ? secties.map((s, i) => `
        <button class="akte-sectie-knop akte-sectie-knop--n${s.niveau}"
          onclick="window.akteSchrijven.naarSectie(${s.regel})">${esc(s.titel || '(zonder titel)')}</button>`).join('')
    : `<p class="dm-hint">Nog geen secties. Begin een regel met <code>##</code>.</p>`;
}

function _tekenVoorbeeld() {
  const host = document.getElementById('akte-schrijf-voorbeeld');
  if (!host) return;
  host.innerHTML = regieNaarHtml(_ta()?.value ?? _tekst) || '<p class="dm-hint">Nog niets geschreven.</p>';
}

function _invoegBalk() {
  const knop = (soort) => {
    const b = REGIE_BLOKKEN[soort];
    return `<button class="akte-invoeg-btn" title="${esc(b.hint)}"
      onclick="window.akteSchrijven.blok('${soort}')">${icon(b.icon)} ${esc(b.label)}</button>`;
  };
  return `
    <div class="akte-invoeg-balk">
      <button class="akte-invoeg-btn" title="Een nieuwe sectie" onclick="window.akteSchrijven.kop()">${icon('scroll-text')} Sectie</button>
      <button class="akte-invoeg-btn" title="Verwijs naar een kaartje — [[Naam]]" onclick="window.akteSchrijven.kaartje()">${icon('user')} Kaartje</button>
      <button class="akte-invoeg-btn" title="Een afbeelding uit de mediabibliotheek" onclick="window.akteSchrijven.afbeelding()">${icon('image')} Beeld</button>
      <span class="akte-invoeg-sep"></span>
      ${knop('voorlezen')}${knop('dm')}
      <span class="akte-invoeg-sep"></span>
      ${knop('gevecht')}${knop('tabel')}${knop('buit')}${knop('kaart')}${knop('rust')}${knop('check')}
    </div>`;
}

function _teken() {
  const el = document.getElementById('akte-schrijf-overlay');
  if (!el) return;
  el.innerHTML = `
    <div class="akte-schrijf-kop">
      <span class="akte-schrijf-titel">${icon('feather')} ${esc(_titel || 'Akte schrijven')}</span>
      <span class="akte-schrijf-status" id="akte-schrijf-status">${_bewaard ? 'bewaard' : 'opslaan…'}</span>
      <div class="akte-schrijf-kop-acties">
        <label class="dm-btn dm-btn-ghost dm-btn-sm" title="Markdown-bestand inlezen — vervangt de tekst">
          ${icon('folder-open')} Inlezen
          <input type="file" accept=".md,text/markdown,text/plain" style="display:none"
            onchange="window.akteSchrijven.inlezen(this.files[0], this)">
        </label>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="De markdown naar het klembord — voor wie hem ook in Obsidian wil"
          onclick="window.akteSchrijven.kopieer(this)">${icon('clipboard-list')} Kopiëren</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm${_voorbeeld ? ' is-actief' : ''}" title="Zoals het er straks uitziet"
          onclick="window.akteSchrijven.voorbeeld()">${icon(_voorbeeld ? 'pencil' : 'eye')} ${_voorbeeld ? 'Schrijven' : 'Voorbeeld'}</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Sluiten" onclick="window.akteSchrijven.sluit()">${icon('x')}</button>
      </div>
    </div>
    <div class="akte-schrijf-body">
      <aside class="akte-schrijf-secties">
        <div class="akte-schrijf-sectie-kop">Secties</div>
        <div id="akte-schrijf-secties"></div>
      </aside>
      <div class="akte-schrijf-hoofd">
        ${_voorbeeld ? '' : _invoegBalk()}
        <textarea class="akte-schrijf-ta${_voorbeeld ? ' hidden' : ''}" id="akte-schrijf-ta"
          spellcheck="true" placeholder="Schrijf hier het hoofdstuk.&#10;&#10;## Een sectie begint met twee hekjes&#10;&#10;Verwijs naar een kaartje met [[Naam]] — gebruik de knop, dan weet je zeker dat het bestaat.">${esc(_tekst)}</textarea>
        <div class="akte-schrijf-voorbeeld${_voorbeeld ? '' : ' hidden'}" id="akte-schrijf-voorbeeld"></div>
      </div>
    </div>`;
  const ta = _ta();
  if (ta) {
    ta.addEventListener('input', () => { _merkVuil(); _tekenSecties(); });
    ta.addEventListener('keydown', (e) => window._fmtKey?.(e, 'akte-schrijf-ta'));
  }
  _tekenSecties();
  if (_voorbeeld) _tekenVoorbeeld();
}

// ── Publieke API ─────────────────────────────────────────────────────────────
window.akteSchrijven = {
  _rijen: [], _opPick: null,
  _filter(q) {
    const zoek = (q || '').toLowerCase();
    document.querySelectorAll('#akte-kies-lijst .pb-entity-item').forEach(b =>
      b.classList.toggle('hidden', !b.dataset.name.includes(zoek)));
  },
  _pick(i) {
    const rij = this._rijen[i];
    window.app.closeModal();
    if (rij) this._opPick?.(rij);
  },

  naarSectie(regel) {
    const ta = _ta();
    if (!ta) return;
    const pos = ta.value.split('\n').slice(0, regel).join('\n').length + (regel ? 1 : 0);
    ta.focus();
    ta.setSelectionRange(pos, pos);
    // De cursor staat er, maar de regel kan buiten beeld liggen: ruw meten op
    // regelhoogte is nauwkeurig genoeg om hem bovenaan te zetten.
    const rh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, regel * rh - rh * 2);
  },

  kop() { _voegIn('## ', { blok: true }); },

  async kaartje() {
    let rijen = [];
    try {
      const soorten = [
        ['personages', 'user'], ['locaties', 'map-pin'], ['organisaties', 'building'],
        ['voorwerpen', 'package'], ['documenten', 'scroll-text'],
      ];
      const lijsten = await Promise.all(soorten.map(([t]) => api.listEntities(t).catch(() => [])));
      lijsten.forEach((lijst, i) => {
        for (const e of (lijst || [])) rijen.push({ naam: e.name, icoon: soorten[i][1], bij: soorten[i][0] });
      });
      rijen.sort((a, b) => a.naam.localeCompare(b.naam));
    } catch { /* leeg */ }
    _kiezer('Kaartje invoegen', rijen, (r) => _voegIn(`[[${r.naam}]]`), 'Nog geen kaartjes.');
  },

  afbeelding() {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      onSelect: (fileId) => _voegIn(`![[${fileId}]]`, { blok: true }),
    });
  },

  async blok(soort) {
    if (soort === 'voorlezen') return _voegIn(_blokTekst('voorlezen', '', 'Wat je voorleest…'), { blok: true });
    if (soort === 'dm')        return _voegIn(_blokTekst('dm', '', 'Alleen voor jou…'), { blok: true });
    if (soort === 'check')     return _voegIn(_blokTekst('check', 'DC 14 Perception'), { blok: true });
    if (soort === 'rust')      return _voegIn(_blokTekst('rust', 'lang · herberg'), { blok: true });

    if (soort === 'gevecht') {
      const lijst = await api.listEncounters().catch(() => []);
      const rijen = (lijst?.encounters || lijst || []).map(e => ({ naam: e.name || e.naam || 'Gevecht', icoon: 'swords' }));
      return _kiezer('Gevecht invoegen', rijen, (r) => _voegIn(_blokTekst('gevecht', r.naam), { blok: true }),
        'Nog geen encounters. Maak er een in de Meesterkamer.');
    }
    if (soort === 'tabel') {
      const lijst = await api.listTables().catch(() => []);
      const rijen = (lijst?.tables || lijst || []).map(t => ({ naam: t.name || t.naam || 'Tabel', icoon: 'dice' }));
      return _kiezer('Tabel invoegen', rijen, (r) => _voegIn(_blokTekst('tabel', r.naam), { blok: true }),
        'Nog geen tabellen.');
    }
    if (soort === 'buit') {
      const lijst = await api.lootEvents().catch(() => []);
      const rijen = (lijst?.events || lijst || []).map(v => ({ naam: v.naam || v.name || 'Vondst', icoon: 'vault' }));
      return _kiezer('Vondst invoegen', rijen, (r) => _voegIn(_blokTekst('buit', r.naam), { blok: true }),
        'Nog geen vondsten in het Loot-tabblad.');
    }
    if (soort === 'kaart') {
      const lijst = await api.listDungeons().catch(() => []);
      const rijen = (lijst || []).map(d => ({ naam: d.name || 'Kaart', icoon: 'castle' }));
      return _kiezer('Dungeonkaart invoegen', rijen, (r) => _voegIn(_blokTekst('kaart', r.naam), { blok: true }),
        'Nog geen dungeonkaarten.');
    }
  },

  voorbeeld() {
    _voorbeeld = !_voorbeeld;
    if (_voorbeeld) _tekst = _ta()?.value ?? _tekst;
    _teken();
  },

  async inlezen(file, invoer) {
    if (!file) return;
    if (_ta()?.value.trim() && !confirm('De huidige tekst wordt vervangen. Doorgaan?')) {
      if (invoer) invoer.value = '';
      return;
    }
    const tekst = await file.text();
    const ta = _ta();
    if (ta) { ta.value = tekst; }
    _tekst = tekst;
    if (invoer) invoer.value = '';
    _merkVuil();
    _tekenSecties();
  },

  async kopieer(btn) {
    try {
      await navigator.clipboard.writeText(_ta()?.value ?? _tekst);
      if (btn) { const t = btn.innerHTML; btn.innerHTML = `${icon('check')} Gekopieerd`; setTimeout(() => btn.innerHTML = t, 1500); }
    } catch { alert('Kopiëren is niet gelukt — selecteer de tekst en gebruik Ctrl+C.'); }
  },

  async sluit() {
    if (!_bewaard) await _bewaar();
    document.body.classList.remove('akte-schrijf-open');
    document.getElementById('akte-schrijf-overlay')?.remove();
    _ch = null;
    window._logboekVerversen?.();
  },
};

// ── Openen ───────────────────────────────────────────────────────────────────
export async function openAkteSchrijven(chapterKey, titel) {
  if (!window.app?.isDM?.()) return;
  _ch = chapterKey;
  _titel = titel || chapterKey;
  _voorbeeld = false;
  _bewaard = true;
  // De tekst komt van de eigen route: `GET /meta` stuurt hem niet meer mee
  // (die ging naar élke ingelogde speler — zie docs/voorstel-akteregie.md).
  try {
    const regie = await api.akteRegie(chapterKey);
    _tekst = regie?.tekst || '';
  } catch {
    _tekst = window.app?.state?.meta?.hoofdstukken?.[chapterKey]?.tekst || '';
  }
  let el = document.getElementById('akte-schrijf-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'akte-schrijf-overlay';
    el.className = 'akte-schrijf-overlay';
    document.body.appendChild(el);
  }
  document.body.classList.add('akte-schrijf-open');
  _teken();
  _ta()?.focus();
}
