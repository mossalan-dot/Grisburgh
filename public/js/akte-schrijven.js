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
  kamer:     { label: 'Kamer',     icon: 'door-open',      hint: 'Een kamer van een dungeonkaart onthullen' },
  muziek:    { label: 'Muziek',    icon: 'music',          hint: 'Een nummer of afspeellijst via Spotify' },
  brief:     { label: 'Brief',     icon: 'mail',           hint: 'Een brief die je hier verstuurt' },
  check:     { label: 'Check',     icon: 'target',         hint: 'Een DC als aantekening — geen mechaniek' },
};

// ── Staat ────────────────────────────────────────────────────────────────────
let _ch       = null;     // aktesleutel
let _titel    = '';
let _tekst    = '';
let _bewaard  = true;
let _timer    = null;
let _voorbeeld = false;   // kijken/spelen in plaats van schrijven
let _acties    = false;   // staan de knoppen aan? (speelstand én de lade)
let _encounters = null;   // lazy: naam → encounter
let _tabellen  = null;
let _vondsten  = null;

const _ta = () => document.getElementById('akte-schrijf-ta');

// ── Secties ──────────────────────────────────────────────────────────────────
// De `##`-koppen zijn de ruggengraat: ze delen het schrijfscherm op, ze worden
// de sectiestrook tijdens het spelen, en de importer maakt er sectiekoppen van.
function _secties(tekst) {
  const uit = [];
  const regels = String(tekst || '').split('\n');
  regels.forEach((r, i) => {
    const m = r.match(/^(#{1,6})\s+(.*)$/);
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
// Een `|`-tabel. Markdown kent er één vorm: koprij, streepjesrij, dan de rest.
// `mdToHtml` doet ze niet (dat is de renderer van een kaartje-tekst), maar een
// akte staat er vol mee — dobbeltabellen vooral.
function _tabelHtml(regels) {
  const cellen = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const kop = cellen(regels[0]);
  const rijen = regels.slice(2).map(cellen);
  // Staat er een dobbelsteen in de eerste kolomkop ("1d4", "d100"), dan is dit
  // een worptabel. We zetten het erbij zodat de speel-kant er straks een
  // worpknop aan kan hangen; in de editor verandert er niets aan.
  const dobbel = (kop[0] || '').match(/\b(\d*d\d+)\b/i);
  return `<table class="akte-tabel"${dobbel ? ` data-dobbel="${esc(dobbel[1].toLowerCase())}"` : ''}>
    <thead><tr>${kop.map(c => `<th>${window.app.mdToHtml(c).replace(/<\/?p>/g, '')}</th>`).join('')}</tr></thead>
    <tbody>${rijen.map(r => `<tr>${r.map(c => `<td>${window.app.mdToHtml(c).replace(/<\/?p>/g, '')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// `![[iets]]` — in Obsidian een ingesloten bestand. Is het een id dat wij
// kennen, dan tonen we het beeld; is het een bestandsnaam uit een vault, dan
// hebben wij dat bestand niet en wordt het een **slot**: de naam blijft staan,
// met een knop om er een bestand uit de bibliotheek aan te hangen. Zo kun je
// een hoofdstuk uit Obsidian plakken en de beelden er daarna bij zoeken,
// zonder eerst een import te draaien.
const _AUDIO = /\.(mp3|wav|m4a|ogg)$/i;
function _embedHtml(ruw) {
  const naam = ruw.trim();
  const isAudio = _AUDIO.test(naam);
  const isId = /^[A-Za-z0-9_-]{8,}$/.test(naam) && !/\.[a-z0-9]{2,4}$/i.test(naam);
  if (isId) {
    if (isAudio) {
      return `<div class="akte-embed akte-embed--audio"><audio controls src="/api/files/${esc(naam)}"></audio></div>`;
    }
    // In de speelstand is een beeld iets dat je **toont**: dezelfde weg als de
    // regie-balk (de verborgen sessielog-entry van deze akte), zodat het ook in
    // het logboek en de carrousel van de speler terechtkomt.
    const knop = _acties
      ? `<button class="dm-btn dm-btn-primary dm-btn-sm akte-beeld-knop"
           onclick="window.akteSchrijven.toonBeeld('${esc(naam)}', this)">${icon('eye')} Toon aan spelers</button>`
      : '';
    return `<div class="akte-embed"><img src="/api/files/${esc(naam)}" alt="" loading="lazy"
         onerror="this.closest('.akte-embed').classList.add('akte-embed--stuk')">${knop}</div>`;
  }
  return `<div class="akte-embed akte-embed--slot">
    <span class="akte-embed-naam">${icon(isAudio ? 'volume-2' : 'image')} ${esc(naam)}</span>
    <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.akteSchrijven.koppelBeeld('${esc(naam).replace(/'/g, "\\'")}')">
      ${icon('folder-open')} Bestand kiezen</button>
  </div>`;
}

// Een DC in de lopende tekst. Een hoofdstuk schrijft die zoals je hem uitspreekt
// — "een *DC12 Religion check*" — en niet als los blok. Die maken we zichtbaar
// als chip, want tijdens het spelen is dat het getal waar je naar zoekt. Het
// blijft een **aantekening**: er wordt niets gerold en niets bijgehouden,
// zelfde regel als bij de loot-DC.
const _DC = /\bDC\s?(\d{1,2})\s*([A-Z][a-zA-Z' ]{2,24}?)?\s*(check|save|saving throw)?\b/g;
function _dcChips(html) {
  return html.replace(_DC, (heel, getal, vaardigheid, soort) => {
    const rest = [vaardigheid && vaardigheid.trim(), soort].filter(Boolean).join(' ');
    return `<span class="akte-dc" title="Een aantekening — er wordt hier niets gerold">DC ${getal}${rest ? ' ' + rest : ''}</span>`;
  });
}

// Een kaartje-verwijzing wordt in de speelstand een **knop**. `mdToHtml` maakt
// er al een link van en zet er `wikilink--dicht` op zodra de party het kaartje
// nog niet kent — precies de toestand die wij nodig hebben. We hangen de
// onthulknoppen erachter in plaats van de link zelf over te doen: dan blijft er
// één plek die weet hoe een wikilink eruitziet.
const _LINK = /<a class="wikilink([^"]*)"[^>]*?_openDetail\('([a-z]+)','([^']+)'\)[^>]*>([^<]*)<\/a>/g;
function _linkKnoppen(html) {
  return html.replace(_LINK, (heel, klassen, type, id, naam) => {
    // Alleen een knop als er iets te doen valt. Een kaartje dat de party al
    // kent heeft er geen nodig — anders staan er in dit hoofdstuk eenenveertig
    // vinkjes door de tekst heen, en dan zie je de twee die er wél toe doen
    // niet meer.
    if (!/wikilink--dicht/.test(klassen)) return heel;
    return `<span class="akte-link" data-id="${id}">${heel}<button class="akte-act akte-act--onthul" title="Onthullen voor de party"
        onclick="window.akteSchrijven.onthul('${type}','${id}','visible',this)">${icon('eye')}</button>
      <button class="akte-act akte-act--vaag" title="Vaag onthullen — de party ziet dat er iets is"
        onclick="window.akteSchrijven.onthul('${type}','${id}','vague',this)">${icon('eye-off')}</button></span>`;
  });
}

// Een gewone markdown-link `[Stirge](https://roll20.net/…)`. `mdToHtml` doet er
// niets mee (die kent alleen `[[wikilinks]]`), dus stond de hele URL in de
// lopende tekst. In een akte zijn dit bijna altijd **monsters en spreuken** uit
// een compendium — precies waar de importer ooit de encounters uit haalde.
// Hier worden het chips: klikken opent de bron, en kennen we het wezen in de
// monsterbibliotheek, dan opent de knop ernaast het statblok. Aan tafel wil je
// dat blad, niet een tabblad in je browser.
// Alleen deze twee adressen gáán over een wezen. Een roll20-compendiumlink kan
// net zo goed een spreuk of een bijl zijn ([Battleaxe+1] staat er ook zo in),
// dus die krijgt geen statblok-knop — alleen de link.
const _MONSTERBRON = /(dndbeyond\.com\/monsters|5e\.tools\/bestiary)/i;
const _MDLINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
function _externeLinks(md) {
  return md.replace(_MDLINK, (heel, label, url) => {
    // Het label komt uit al gerenderde HTML: `*Pass without Trace*` is daar al
    // `<em>…</em>`. De tags eruit, anders staan ze als tekst in de chip.
    const naam = label.replace(/<[^>]+>/g, '').replace(/[*_]/g, '').trim();
    const monster = _MONSTERBRON.test(url);
    const knop = (monster && _acties)
      ? `<button class="akte-act akte-act--statblok" title="Statblok openen"
           onclick="window.akteSchrijven.statblok('${esc(naam).replace(/'/g, "\\'")}', this)">${icon('skull')}</button>`
      : '';
    return `<span class="akte-bron${monster ? ' akte-bron--monster' : ''}"><a href="${esc(url)}" target="_blank" rel="noopener"
      title="${esc(url)}">${esc(naam)}</a>${knop}</span>`;
  });
}

function _prozaHtml(md) {
  // Ná `mdToHtml`, niet ervoor: die escapet `<` en `>` in zijn invoer, dus een
  // span die je er vooraf in zet komt er als zichtbare tekst weer uit. De
  // markdown-link zelf laat hij ongemoeid, dus het patroon staat er dan nog.
  const html = _externeLinks(_dcChips(window.app.mdToHtml(md)));
  return _acties ? _linkKnoppen(html) : html;
}

// Alles wat geen callout is: eerst de blokvormen (tabel, lijst, embed), de rest
// naar `mdToHtml`.// Alles wat geen callout is: eerst de blokvormen (tabel, lijst, embed), de rest
// naar `mdToHtml`. Die kent de wikilinks en de opmaak van de rest van de app.
function _gewoonHtml(regels) {
  const uit = [];
  let buffer = [];
  const leeg = () => { if (buffer.join('').trim()) uit.push(_prozaHtml(buffer.join('\n'))); buffer = []; };
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i];
    // Koppen zelf tekenen: `mdToHtml` gaat tot drie hekjes, en juist de
    // diepere niveaus dragen hier de scènes (`###### Madame Ursula`).
    const kop = r.match(/^(#{1,6})\s+(.*)$/);
    if (kop) {
      leeg();
      const n = kop[1].length;
      uit.push(`<h${n} class="akte-kop akte-kop--n${n}">${window.app.mdToHtml(kop[2]).replace(/<\/?p>/g, '')}</h${n}>`);
      continue;
    }
    const embed = r.match(/^\s*!\[\[([^\]]+?)\]\]\s*$/);
    if (embed) { leeg(); uit.push(_embedHtml(embed[1])); continue; }
    if (/^\s*\|.*\|\s*$/.test(r) && /^\s*\|[\s:|-]+\|\s*$/.test(regels[i + 1] || '')) {
      leeg();
      const tabel = [];
      while (i < regels.length && /^\s*\|.*\|\s*$/.test(regels[i])) tabel.push(regels[i++]);
      i--;
      uit.push(_tabelHtml(tabel));
      continue;
    }
    if (/^\s*[-*]\s+/.test(r)) {
      leeg();
      const items = [];
      while (i < regels.length && /^\s*[-*]\s+/.test(regels[i])) items.push(regels[i++].replace(/^\s*[-*]\s+/, ''));
      i--;
      uit.push(`<ul class="akte-lijst">${items.map(it => `<li>${window.app.mdToHtml(it).replace(/<\/?p>/g, '')}</li>`).join('')}</ul>`);
      continue;
    }
    buffer.push(r);
  }
  leeg();
  return uit.join('\n');
}

// De knop die bij een regieblok hoort. Elk blok doet precies wat het gelijk-
// namige staptype in de regie-balk doet — dezelfde aanroep, andere plek.
function _blokActie(soort, kop, body) {
  const arg = esc(String(kop || '').replace(/'/g, "\\'"));
  const knop = (fn, label, ico) =>
    `<button class="dm-btn dm-btn-primary dm-btn-sm regie-blok-knop"
       onclick="window.akteSchrijven.${fn}('${arg}', this)">${icon(ico)} ${label}</button>`;
  if (soort === 'gevecht')   return knop('startGevecht', 'Start gevecht', 'swords');
  if (soort === 'tabel')     return knop('rolTabel', 'Rollen', 'dice');
  if (soort === 'buit')      return knop('onthulBuit', 'Onthullen', 'vault');
  if (soort === 'kaart')     return knop('openKaart', 'Openen', 'castle');
  if (soort === 'rust')      return knop('startRust', 'Rust starten', 'moon');
  if (soort === 'kamer')     return knop('onthulKamer', 'Onthullen', 'eye');
  if (soort === 'muziek')    return knop('startMuziek', 'Afspelen', 'play');
  if (soort === 'brief') {
    const tekst = esc(body.join('\n').replace(/'/g, "\\'").replace(/\n/g, '\\n'));
    return `<button class="dm-btn dm-btn-primary dm-btn-sm regie-blok-knop"
      onclick="window.akteSchrijven.stuurBrief('${arg}','${tekst}', this)">${icon('mail')} Versturen</button>`;
  }
  if (soort === 'voorlezen') {
    // De tekst van het blok zelf gaat mee; die staat niet in de kop.
    const tekst = esc(body.join('\n').replace(/'/g, "\\'").replace(/\n/g, '\\n'));
    return `<button class="dm-btn dm-btn-primary dm-btn-sm regie-blok-knop"
      onclick="window.akteSchrijven.naarTafel('${tekst}', this)">${icon('monitor')} Op tafel</button>`;
  }
  return '';
}

export function regieNaarHtml(md, { acties } = {}) {
  // De lade tijdens het spelen gebruikt dezelfde renderer als het
  // schrijfscherm; alleen zegt hij zélf of de knoppen aan moeten.
  _acties = acties === undefined ? _voorbeeld : !!acties;
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
        <div class="regie-blok-kop">
          ${icon(blok?.icon || 'hexagon')} ${esc(kop || blok?.label || soort)}
          ${_acties ? _blokActie(soort, kop, body) : ''}
        </div>
        ${body.length ? `<div class="regie-blok-body">${_gewoonHtml(body)}</div>` : ''}
        <div class="regie-blok-uitslag" hidden></div>
      </div>`);
      continue;
    }
    // Gewone regels tot de volgende callout.
    const blokRegels = [];
    while (i < regels.length && !/^>\s*\[!/.test(regels[i])) { blokRegels.push(regels[i]); i++; }
    const html = _gewoonHtml(blokRegels);
    if (html.trim()) uit.push(html);
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
      ${knop('gevecht')}${knop('tabel')}${knop('buit')}${knop('kaart')}${knop('kamer')}
      ${knop('rust')}${knop('muziek')}${knop('brief')}${knop('check')}
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
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Welke [[namen]] hebben nog geen kaartje?"
          onclick="window.akteSchrijven.namen()">${icon('users')} Namen</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="De markdown naar het klembord — voor wie hem ook in Obsidian wil"
          onclick="window.akteSchrijven.kopieer(this)">${icon('clipboard-list')} Kopiëren</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm${_voorbeeld ? ' is-actief' : ''}"
          title="${_voorbeeld ? 'Terug naar schrijven' : 'De akte zoals je hem speelt — met knoppen die echt onthullen'}"
          onclick="window.akteSchrijven.voorbeeld()">${icon(_voorbeeld ? 'pencil' : 'play')} ${_voorbeeld ? 'Schrijven' : 'Spelen'}</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Sluiten" onclick="window.akteSchrijven.sluit()">${icon('x')}</button>
      </div>
    </div>
    <div class="akte-schrijf-body">
      <aside class="akte-schrijf-secties">
        <div class="akte-schrijf-sectie-kop">Secties</div>
        <div id="akte-schrijf-secties"></div>
        <!-- Rust hoort niet bij één plek in de tekst: een party gaat slapen
             wanneer het uitkomt, soms tussen twee aktes in. Daarom hier, bij de
             navigatie, en niet als blok halverwege een sectie. -->
        <div class="akte-schrijf-altijd">
          <div class="akte-schrijf-sectie-kop">Altijd bij de hand</div>
          <button class="akte-zijknop" onclick="window.dmPanel.rustMenu(event)"
            title="Long of Short Rest voor de hele party">${icon('moon')} Rust</button>
          <button class="akte-zijknop" onclick="window.dmPanel.sheetsPrint()"
            title="Character sheets van de party — printbaar blad per speler">${icon('scroll-text')} Sheets</button>
        </div>
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

// Een blok verwijst met een **naam**, want dat is wat je schrijft. Namen zijn
// niet uniek en niet exact; vandaar dezelfde losse vergelijking als elders:
// gelijk, anders "begint met", anders "bevat".
function _vindOpNaam(lijst, naam) {
  const n = String(naam || '').trim().toLowerCase();
  if (!n) return null;
  const naamVan = (x) => String(x.name || x.naam || '').toLowerCase();
  // Je schrijft "vier twig blights", de bibliotheek kent "Twig Blight". Dus
  // ook zonder meervoud-s en zonder -en proberen; een zin buigt nu eenmaal.
  const vormen = [n, n.replace(/s$/, ''), n.replace(/en$/, '')].filter((v, i, a) => v && a.indexOf(v) === i);
  for (const v of vormen) {
    const treffer = (lijst || []).find(x => naamVan(x) === v)
                 || (lijst || []).find(x => naamVan(x).startsWith(v))
                 || (lijst || []).find(x => naamVan(x).includes(v));
    if (treffer) return treffer;
  }
  return null;
}

// Iets te melden onder het blok. Twee smaken: een naam die niet klopt (daar
// hóórt de tip bij) en een gewone fout (daar is die tip misleidend — Spotify is
// niet gekoppeld, dat los je niet op door de naam te veranderen).
function _melding(btn, tekst) {
  const vak = btn.closest('.regie-blok')?.querySelector('.regie-blok-uitslag');
  if (vak) { vak.hidden = false; vak.innerHTML = `${icon('x')} ${esc(tekst)}`; }
}

function _geenTreffer(btn, tekst) {
  _melding(btn, `${tekst} — controleer de naam in het blok.`);
}

// Zelfde drie soorten als de Tafels-tab: samengesteld, gewogen (d100) en gewoon.
function _rolTabel(tabel) {
  if (tabel.type === 'combined') {
    const a = (tabel.first || []); const b = (tabel.last || []);
    return `${a[Math.floor(Math.random() * a.length)] || '?'} ${b[Math.floor(Math.random() * b.length)] || '?'}`;
  }
  const entries = tabel.entries || [];
  if (!entries.length) return 'Deze tabel is leeg.';
  if (tabel.type === 'weighted') {
    const d100 = Math.floor(Math.random() * 100) + 1;
    for (const e of entries) {
      const m = String(e).match(/^(\d+)[-–](\d+):\s*(.+)$/);
      if (m && d100 >= +m[1] && d100 <= +m[2]) return `d100: ${d100} → ${m[3].trim()}`;
    }
    return `d100: ${d100} → (geen treffer)`;
  }
  const i = Math.floor(Math.random() * entries.length);
  return `${i + 1}: ${entries[i]}`;
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
    if (soort === 'muziek')    return _voegIn(_blokTekst('muziek', 'spotify:playlist:… of de naam van een nummer'), { blok: true });
    if (soort === 'brief')     return _voegIn(_blokTekst('brief', 'Onderwerp van de brief', 'Beste avonturiers,\n\n…'), { blok: true });
    if (soort === 'kamer') {
      const kaarten = await api.listDungeons().catch(() => []);
      const rijen = [];
      for (const k of (kaarten || [])) {
        rijen.push({ naam: k.name || 'Kaart', icoon: 'castle', kaart: k.name, kamer: '' });
        for (const r of (k.rooms || [])) if (r.name) rijen.push({ naam: `${k.name} · ${r.name}`, icoon: 'door-open', kaart: k.name, kamer: r.name });
      }
      return _kiezer('Kamer invoegen', rijen,
        (r) => _voegIn(_blokTekst('kamer', r.kamer ? `${r.kaart} · ${r.kamer}` : r.kaart), { blok: true }),
        'Nog geen dungeonkaarten.');
    }

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

  // Een beeld-slot vullen: kies een bestand en elke verwijzing met die naam
  // wordt vervangen. Zo is één keer kiezen genoeg, ook als hetzelfde plaatje
  // twee keer in het hoofdstuk staat.
  koppelBeeld(naam) {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      // Een .mp3 uit een Obsidian-vault hoort bij de geluiden, niet bij de
      // afbeeldingen; de kiezer filtert op soort.
      type: _AUDIO.test(naam) ? 'audio' : 'afbeelding',
      suggestedName: naam.replace(/\.[a-z0-9]+$/i, '').slice(0, 60),
      onSelect: (fileId) => {
        const huidig = _ta()?.value ?? _tekst;
        const zoek = `![[${naam}]]`;
        const nieuw = huidig.split(zoek).join(`![[${fileId}]]`);
        const ta = _ta();
        if (ta) ta.value = nieuw;
        _tekst = nieuw;
        _merkVuil();
        if (_voorbeeld) _tekenVoorbeeld();
      },
    });
  },

  // Welke [[namen]] hebben nog geen kaartje? Dezelfde vraag als in de
  // Aktes-tab, maar hier terwijl je schrijft — dan maak je het kaartje
  // meteen aan in plaats van het later terug te zoeken.
  async namen() {
    if (!_bewaard) await _bewaar();
    let namen = [];
    try { namen = (await api.akteNamen(_ch)).namen || []; } catch {}
    const zonder = namen.filter(n => !n.kaartje);
    window.app.openModal('Namen in deze akte', '', `
      <div class="dm-feature-section" style="margin:0">
        <p class="dm-hint">${namen.length} ${namen.length === 1 ? 'naam' : 'namen'} in de tekst, waarvan ${zonder.length} zonder kaartje.</p>
        <div class="pb-entity-list">
          ${namen.length ? namen.map(n => `
            <div class="pb-entity-item" style="cursor:default">
              <span class="pb-entity-icon">${icon(n.kaartje ? 'check-circle' : 'plus')}</span>
              <span class="pb-entity-name">${esc(n.naam)}
                <span class="dm-hint">· ${n.nieuw ? 'nieuw in deze akte' : 'komt terug'}</span></span>
              ${n.kaartje
                ? `<button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window._openDetail('${esc(n.entityType)}','${esc(n.entityId)}')">Openen</button>`
                : `<select class="dm-input dm-input-sm" onchange="window.akteSchrijven.maakKaartje('${esc(n.naam).replace(/'/g, "\\'")}', this.value)">
                     <option value="">Kaartje maken…</option>
                     <option value="personages">Personage</option>
                     <option value="locaties">Locatie</option>
                     <option value="organisaties">Organisatie</option>
                     <option value="voorwerpen">Voorwerp</option>
                     <option value="documenten">Document</option>
                   </select>`}
            </div>`).join('') : '<p class="dm-hint">Nog geen [[namen]] in de tekst.</p>'}
        </div>
      </div>`);
  },

  async maakKaartje(naam, type) {
    if (!type) return;
    try { await api.createEntity(type, { name: naam }); this.namen(); }
    catch (e) { alert('Aanmaken mislukt: ' + e.message); }
  },

  voorbeeld() {
    _voorbeeld = !_voorbeeld;
    if (_voorbeeld) _tekst = _ta()?.value ?? _tekst;
    _teken();
  },

  // ── Spelen: wat de knoppen doen ──────────────────────────────────────────
  // Allemaal dezelfde aanroepen als de regie-balk; alleen de plek verschilt.
  async onthul(type, id, mode, btn) {
    try {
      await api.toggleVisibility(type, id, mode);
      // De index bijwerken, anders staat het kaartje bij het hertekenen weer
      // als "dicht" in beeld.
      const naam = Object.keys(window._entityNameIndex || {}).find(n => window._entityNameIndex[n]?.id === id);
      if (naam) window._entityNameIndex[naam].vis = mode;
      const span = btn.closest('.akte-link');
      if (span) {
        // Even laten zien dát het gebeurd is, dan verdwijnen de knoppen — er
        // valt niets meer te doen aan dit kaartje.
        span.querySelectorAll('.akte-act').forEach(b => b.remove());
        span.insertAdjacentHTML('beforeend', `<span class="akte-act akte-act--klaar">${icon('check')}</span>`);
        span.querySelector('a')?.classList.remove('wikilink--dicht');
        setTimeout(() => span.querySelector('.akte-act--klaar')?.remove(), 2500);
      }
    } catch (e) { alert('Onthullen mislukt: ' + e.message); }
  },

  // Een beeld tonen loopt via de verborgen sessielog-entry van deze akte —
  // hetzelfde datamodel als de regie-balk en de akte-importer, zodat het beeld
  // ook in het logboek en de carrousel van de speler verschijnt.
  async toonBeeld(fileId, btn) {
    btn.disabled = true;
    try {
      const archief = await api.listArchief();
      let entry = (archief.sessieLog || []).find(e =>
        e.hoofdstuk === _ch && /sc[eè]ne-afbeeldingen/i.test(e.korteSamenvatting || ''));
      if (!entry) entry = await api.createSessieLog({ hoofdstuk: _ch, korteSamenvatting: 'Scène-afbeeldingen', datum: '' });
      const bestaand = (entry.images || []).map(img => typeof img === 'string' ? { id: img, caption: '', visible: false } : img);
      if (!bestaand.some(i => i.id === fileId)) {
        await api.updateSessieLog(entry.id, { images: [...bestaand, { id: fileId, caption: '', visible: false }] });
      }
      await api.onthulAfbeelding(entry.id, fileId, '', window._activeGroupId || null);
      btn.innerHTML = `${icon('check')} Getoond`;
      btn.classList.add('is-klaar');
    } catch (e) { btn.disabled = false; alert('Tonen mislukt: ' + e.message); }
  },

  async startGevecht(naam, btn) {
    if (!_encounters) { try { _encounters = await api.listEncounters(); } catch { _encounters = []; } }
    const enc = _vindOpNaam(_encounters, naam);
    if (!enc) return _geenTreffer(btn, `Geen gevecht "${naam}" gevonden`);
    try { await window.dmPanel.encStart(enc.id); btn.innerHTML = `${icon('check')} Gestart`; btn.classList.add('is-klaar'); }
    catch (e) { alert('Starten mislukt: ' + e.message); }
  },

  async rolTabel(naam, btn) {
    if (!_tabellen) { try { _tabellen = await api.listTables(); } catch { _tabellen = []; } }
    const tabel = _vindOpNaam(_tabellen, naam);
    if (!tabel) return _geenTreffer(btn, `Geen tabel "${naam}" gevonden`);
    const uitslag = _rolTabel(tabel);
    const vak = btn.closest('.regie-blok')?.querySelector('.regie-blok-uitslag');
    if (vak) { vak.hidden = false; vak.innerHTML = `${icon('dice')} ${esc(uitslag)}`; }
  },

  async onthulBuit(naam, btn) {
    if (!_vondsten) { try { _vondsten = (await api.lootEvents())?.events || []; } catch { _vondsten = []; } }
    const v = _vindOpNaam(_vondsten, naam);
    if (!v) return _geenTreffer(btn, `Geen vondst "${naam}" gevonden`);
    try { await window.dmPanel.lootVerdelingOpenen([v.id]); }
    catch (e) { alert('Onthullen mislukt: ' + e.message); }
  },

  async openKaart(naam, btn) {
    let kaarten = [];
    try { kaarten = await api.listDungeons(); } catch {}
    const k = _vindOpNaam(kaarten, naam);
    if (!k) return _geenTreffer(btn, `Geen kaart "${naam}" gevonden`);
    window._openKaartFullscreen?.('dungeon', k.id);
  },

  startRust(kop, btn) {
    // De rust-knop van de regie-balk kent de keuzes al (lang/kort, veld/herberg);
    // hier openen we datzelfde menu in plaats van er een tweede van te maken.
    window.dmPanel.rustMenu?.({ currentTarget: btn, preventDefault() {}, stopPropagation() {} });
  },

  // Het statblok van een genoemd wezen. We zoeken in de monsterbibliotheek van
  // de campagne; staat hij er niet, dan zegt de knop dat — de link naar de bron
  // blijft dan over.
  async statblok(naam, btn) {
    let monsters = [];
    try { monsters = await api.listMonsters(); } catch {}
    const lijst = Array.isArray(monsters) ? monsters : (monsters.monsters || []);
    const m = _vindOpNaam(lijst, naam);
    if (!m) { btn.title = `"${naam}" staat niet in de monsterbibliotheek`; btn.classList.add('is-leeg'); return; }
    const { renderStatblock } = await import('./render-statblock.js?v=9');
    window.app.openModal(m.name || naam, '', `<div class="sb-modal-body">${renderStatblock(m, { kop: false })}</div>`);
    window.glossary?.applyDom?.(document.querySelector('#modal-overlay .sb-modal-body'));
    window.spreuken?.linkInDom?.(document.querySelector('#modal-overlay .sb-modal-body'));
  },

  // Een kamer van een dungeon onthullen. Schrijfwijze: `[!kamer] Crypte · Grafkelder`
  // — kaart en kamer gescheiden door een punt, een streepje of een dubbele punt,
  // want zo schrijf je het ook op. Zonder kamer geeft hij de party alleen
  // toegang tot de kaart.
  async onthulKamer(kop, btn) {
    const [kaartNaam, kamerNaam] = String(kop || '').split(/\s*[·:>|–-]\s*/);
    let kaarten = [];
    try { kaarten = await api.listDungeons(); } catch {}
    const kaart = _vindOpNaam(kaarten, kaartNaam);
    if (!kaart) return _geenTreffer(btn, `Geen dungeonkaart "${kaartNaam || kop}" gevonden`);
    const gid = window._activeGroupId;
    if (!gid) return _melding(btn, 'Geen actieve groep — kies er eerst een.');
    try {
      await api.grantDungeonAccess(kaart.id, gid);
      if (kamerNaam) {
        const kamer = (kaart.rooms || []).find(r => (r.name || '').toLowerCase().includes(kamerNaam.trim().toLowerCase()));
        if (!kamer) return _geenTreffer(btn, `"${kamerNaam.trim()}" staat niet op deze kaart`);
        await api.revealDungeonRoom(kaart.id, { roomId: kamer.id, groupId: gid });
      }
      btn.innerHTML = `${icon('check')} Onthuld`;
      btn.classList.add('is-klaar');
    } catch (e) { _melding(btn, 'Onthullen mislukt: ' + e.message); }
  },

  // Muziek. In de kop staat de Spotify-uri (die plak je uit Spotify) of de naam
  // van een nummer; in dat laatste geval zoeken we hem op.
  async startMuziek(kop, btn) {
    const tekst = String(kop || '').trim();
    let uri = tekst.startsWith('spotify:') ? tekst : '';
    try {
      if (!uri) {
        const treffers = await api.spotifyZoek(tekst);
        uri = (treffers || [])[0]?.uri || '';
        if (!uri) return _geenTreffer(btn, `Niets gevonden voor "${tekst}"`);
      }
      await api.spotifySpeel({ uri, herhaal: /herhaal|loop/i.test(tekst) });
      btn.innerHTML = `${icon('check')} Speelt`;
      btn.classList.add('is-klaar');
    } catch (e) {
      _melding(btn, e.message + (/gekoppeld/i.test(e.message) ? ' Koppel Spotify bij Instellingen → Muziek.' : ''));
    }
  },

  // Een brief versturen: de kop is het onderwerp, de inhoud van het blok is de
  // brief. Cinematisch, zoals vanuit de regie-balk — de speler krijgt de
  // verzegelde envelop.
  async stuurBrief(onderwerp, tekst, btn) {
    if (!String(tekst || '').trim()) return _melding(btn, 'Dit blok heeft geen brieftekst — schrijf hem onder de kop.');
    const gid = window._activeGroupId;
    try {
      await api.sendPost({
        titel: onderwerp || 'Een brief', tekst, afzender: '', datum: '', thema: '',
        groepId: gid || null, cinematic: true,
      });
      btn.innerHTML = `${icon('check')} Verstuurd`;
      btn.classList.add('is-klaar');
    } catch (e) { _melding(btn, 'Versturen mislukt: ' + e.message); }
  },

  // De voorleestekst naar het tafelscherm. Alleen daarheen: de spelers horen
  // hem, ze hoeven hem niet op hun telefoon mee te lezen.
  async naarTafel(tekst, btn) {
    try {
      // De kop van de sectie waar dit blok in staat gaat mee: op het
      // tafelscherm weten de spelers dan waar ze zijn, en het vel ziet er niet
      // uit als een losse alinea in het donker.
      let kop = '';
      let el = btn.closest('.regie-blok')?.previousElementSibling;
      while (el && !kop) { if (/^H[1-6]$/.test(el.tagName)) kop = el.textContent.trim(); el = el.previousElementSibling; }
      await api.post('/display/tekst', { tekst, kop });
      btn.innerHTML = `${icon('check')} Op tafel`;
      btn.classList.add('is-klaar');
    } catch (e) { _melding(btn, 'Sturen mislukt: ' + e.message); }
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

// De lade tijdens het spelen werkt met dezelfde module: die moet weten welke
// akte er loopt, anders belandt een getoond beeld in de sessielog van niemand.
export function zetAkte(chapterKey, tekst) {
  _ch = chapterKey;
  _tekst = String(tekst || '');
}

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
