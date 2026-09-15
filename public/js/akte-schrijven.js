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

import { api } from './api.js?v=288';

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
let _split     = false;   // schrijven én zien, naast elkaar
let _splitTimer = null;
let _namenZonder = null;  // hoeveel [[namen]] nog geen kaartje hebben (null = nog niet geteld)
let _acties    = false;   // echte knoppen (alleen in de lade tijdens het spelen)
let _potloden  = false;   // blokken bijstellen (schrijfscherm én lade)
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
    _telNamen();
  } catch (e) {
    _bewaard = false;
    _zetStatus('Opslaan mislukt: ' + e.message);
  }
}

// Hoeveel genoemde namen hebben nog geen kaartje? Dat getal staat op de knop,
// zodat je zonder klikken ziet of er werk ligt. Alleen na een opslagbeurt: de
// server leest de bewaarde tekst.
async function _telNamen() {
  if (!_ch) return;
  try {
    const namen = (await api.akteNamen(_ch)).namen || [];
    _namenZonder = namen.filter(n => !n.kaartje).length;
  } catch { _namenZonder = null; }
  const knop = document.querySelector('.akte-schrijf-kop-acties .dm-btn');
  if (!knop) return;
  const badge = knop.querySelector('.akte-badge');
  if (_namenZonder) {
    if (badge) badge.textContent = _namenZonder;
    else knop.insertAdjacentHTML('beforeend', ` <span class="akte-badge">${_namenZonder}</span>`);
  } else badge?.remove();
}

function _zetStatus(fout) {
  const el = document.getElementById('akte-schrijf-status');
  if (!el) return;
  el.textContent = fout || (_bewaard ? 'bewaard' : 'opslaan…');
  el.classList.toggle('is-fout', !!fout);
}

// ── Invoegen ─────────────────────────────────────────────────────────────────
// Alles gaat door één deur: tekst op de cursorpositie, of om de selectie heen.
// `blok` zet er lege regels omheen (een kader staat los); `marker` is voor de
// tekens waar je zélf achter doorschrijft — `## ` en `- `. Die krijgen wel lucht
// ervóór maar geen lege regel erná, anders staat je cursor twee regels verderop
// en typ je naast je eigen kop.
function _voegIn(tekst, { blok = false, marker = false } = {}) {
  const ta = _ta();
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  let invoeg = tekst;
  if (blok || marker) {
    const voor = ta.value.slice(0, s);
    const nodig = voor && !voor.endsWith('\n\n') ? (voor.endsWith('\n') ? '\n' : '\n\n') : '';
    invoeg = nodig + tekst + (marker ? '' : '\n\n');
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
function _kiezer(titel, rijen, opPick, leegTekst = 'Niets gevonden.', metNieuw = false) {
  window.app.openModal(titel, '', `
    <div class="dm-feature-section" style="margin:0">
      <div class="pb-zoek-rij">
        ${icon('search', { cls: 'pb-zoek-icoon' })}
        <input class="dm-input" id="akte-kies-zoek" autofocus placeholder="Zoeken…"
               oninput="window.akteSchrijven._filter(this.value)">
      </div>
      ${metNieuw ? `<div class="dm-feature-row" style="margin:-2px 0 6px">
        <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.akteSchrijven.nieuwUitZoek()">
          ${icon('plus')} Nieuw kaartje met de getypte naam</button>
      </div>` : ''}
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
// Een naam die nog geen kaartje heeft. `mdToHtml` laat die voor de DM als
// `[[haakjes]]` staan — dat is het signaal "hier hoort nog iets bij". Tijdens
// het schrijven wil je hem dan ook meteen kunnen aanmaken, al is het maar als
// leeg kaartje dat je later invult.
const _LINK_ONBEKEND = /<span class="wikilink-unknown">\[\[([^<\]]+)\]\]<\/span>/g;
function _linkKnoppen(html) {
  html = html.replace(_LINK_ONBEKEND, (heel, naam) => _potloden
    ? `<span class="akte-link akte-link--nieuw">${heel}<button class="akte-act akte-act--nieuw"
         title="Kaartje aanmaken voor “${esc(naam)}”"
         onclick="window.akteSchrijven.maakPlaceholder('${esc(naam).replace(/'/g, "\\'")}')">${icon('plus')}</button></span>`
    : heel);
  if (!_acties) return html;   // verder alleen knoppen tijdens het spelen
  return html.replace(_LINK, (heel, klassen, type, id, naam) => {
    // Een kaartje dat de party al kent kan nog wél geheimen hebben; dan blijft
    // het slotje staan. Verder geen knop als er niets te doen valt — anders
    // staan er in dit hoofdstuk eenenveertig vinkjes door de tekst heen.
    const idx = Object.values(window._entityNameIndex || {}).find(x => x.id === id) || {};
    const dichtGeheim = (idx.geheimTotaal || 0) > (idx.geheimOnthuld || 0);
    const slot = dichtGeheim
      ? `<button class="akte-act akte-act--geheim" title="Geheimen van dit kaartje"
           onclick="window.akteSchrijven.geheimen('${type}','${id}')">${icon('lock')}</button>`
      : '';
    if (!/wikilink--dicht/.test(klassen)) {
      return slot ? `<span class="akte-link" data-id="${id}">${heel}${slot}</span>` : heel;
    }
    return `<span class="akte-link" data-id="${id}">${heel}<button class="akte-act akte-act--onthul" title="Onthullen voor de party"
        onclick="window.akteSchrijven.onthul('${type}','${id}','visible',this)">${icon('eye')}</button>
      <button class="akte-act akte-act--vaag" title="Vaag onthullen — de party ziet dat er iets is"
        onclick="window.akteSchrijven.onthul('${type}','${id}','vague',this)">${icon('eye-off')}</button>${slot}</span>`;
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
  // De plus bij een onbekende naam hoort bij het voorbereiden, de oogjes bij
  // het spelen — dus de bewerking draait zodra een van beide aanstaat.
  return (_acties || _potloden) ? _linkKnoppen(html) : html;
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
      uit.push(`<ul class="akte-lijst">${items.map(it => `<li>${_prozaHtml(it).replace(/<\/?p>/g, '')}</li>`).join('')}</ul>`);
      continue;
    }
    // Genummerd: een reeks die op volgorde gebeurt ("1. De wacht draait zich om").
    if (/^\s*\d+[.)]\s+/.test(r)) {
      leeg();
      const items = [];
      while (i < regels.length && /^\s*\d+[.)]\s+/.test(regels[i])) items.push(regels[i++].replace(/^\s*\d+[.)]\s+/, ''));
      i--;
      uit.push(`<ol class="akte-lijst akte-lijst--nr">${items.map(it => `<li>${_prozaHtml(it).replace(/<\/?p>/g, '')}</li>`).join('')}</ol>`);
      continue;
    }
    // Een citaat zonder `[!soort]`: gewoon aangehaalde tekst — een spreuk in
    // een boek, een regel uit een lied. Geen knop, wel een streep ernaast.
    if (/^\s*>\s?/.test(r) && !/^\s*>\s*\[!/.test(r)) {
      leeg();
      const items = [];
      while (i < regels.length && /^\s*>\s?/.test(regels[i]) && !/^\s*>\s*\[!/.test(regels[i])) {
        items.push(regels[i++].replace(/^\s*>\s?/, ''));
      }
      i--;
      uit.push(`<blockquote class="akte-citaat">${_prozaHtml(items.join('\n'))}</blockquote>`);
      continue;
    }
    // `---` op een eigen regel: een sprong in tijd of plaats binnen een scène.
    if (/^\s*-{3,}\s*$/.test(r)) { leeg(); uit.push('<hr class="akte-breuk">'); continue; }
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
  // `acties` staat alleen aan in de lade — daar speel je. In het schrijfscherm
  // kijk je (met de potloden om een blok bij te stellen): een oogje is klein en
  // je bent aan het voorbereiden, niet aan het onthullen.
  _acties = !!acties;
  _potloden = acties === undefined ? _voorbeeld || _split : !!acties;
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
          ${_potloden ? `<button class="akte-act akte-act--blokpen" title="Dit blok bijstellen"
            onclick="window.akteSchrijven.blokBewerk('${soort}','${esc(kop).replace(/'/g, "\\'")}')">${icon('pencil')}</button>` : ''}
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
        <button class="akte-sectie-knop akte-sectie-knop--n${s.niveau}" draggable="true" data-sectie="${i}"
          title="Slepen om te verplaatsen"
          onclick="window.akteSchrijven.naarSectie(${s.regel})">${esc(s.titel || '(zonder titel)')}</button>`).join('')
      + `<div class="akte-sectie-eind" data-sectie="${secties.length}"></div>`
    : `<p class="dm-hint">Nog geen secties. Begin een regel met <code>##</code>.</p>`;
  _sectiesSlepen(host, secties);
}

// ── Secties verslepen ────────────────────────────────────────────────────────
// Een scène verplaatsen was knippen en plakken door 27 kB tekst. Hier sleep je
// hem in de zijbalk, en verhuizen doet precies wat je zelf zou doen: de regels
// van die kop tot de volgende kop van hetzelfde niveau, mét wat eronder hangt.
// Er wordt niets geparseerd en niets herschreven — alleen verschoven. Daarom
// kan deze ingreep je tekst ook niet stilletjes veranderen.
function _sectieBereik(regels, secties, i) {
  const s = secties[i];
  const start = s.regel;
  let eind = regels.length;
  for (let j = i + 1; j < secties.length; j++) {
    if (secties[j].niveau <= s.niveau) { eind = secties[j].regel; break; }
  }
  return [start, eind];
}

function _sectiesSlepen(host, secties) {
  let bron = null;
  host.querySelectorAll('[data-sectie]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      if (!el.classList.contains('akte-sectie-knop')) return;
      bron = Number(el.dataset.sectie);
      el.classList.add('akte-sectie-knop--sleept');
      try { e.dataTransfer.setData('text/plain', String(bron)); e.dataTransfer.effectAllowed = 'move'; } catch {}
    });
    el.addEventListener('dragend', () => {
      host.querySelectorAll('.akte-sectie-knop--sleept, .akte-sectie-doel')
        .forEach(x => x.classList.remove('akte-sectie-knop--sleept', 'akte-sectie-doel'));
      bron = null;
    });
    el.addEventListener('dragover', (e) => {
      if (bron === null) return;
      e.preventDefault();
      host.querySelectorAll('.akte-sectie-doel').forEach(x => x.classList.remove('akte-sectie-doel'));
      el.classList.add('akte-sectie-doel');
    });
    el.addEventListener('drop', (e) => {
      if (bron === null) return;
      e.preventDefault();
      _sectieVerplaats(bron, Number(el.dataset.sectie), secties);
      bron = null;
    });
  });
}

function _sectieVerplaats(van, naar, secties) {
  if (van === naar || van + 1 === naar) return;   // zelfde plek
  const ta = _ta();
  const regels = (ta?.value ?? _tekst).split('\n');
  const [start, eind] = _sectieBereik(regels, secties, van);
  const stuk = regels.slice(start, eind);
  // De doelregel ná het weghalen: alles onder het weggehaalde stuk schuift op.
  const doelRegel = naar >= secties.length ? regels.length : secties[naar].regel;
  const rest = [...regels.slice(0, start), ...regels.slice(eind)];
  const offset = doelRegel > start ? doelRegel - (eind - start) : doelRegel;
  rest.splice(offset, 0, ...stuk);
  const nieuw = rest.join('\n');
  if (ta) { ta.value = nieuw; ta.focus(); }
  _tekst = nieuw;
  _merkVuil();
  _tekenSecties();
  if (_voorbeeld || _split) _tekenVoorbeeld();
}

function _tekenVoorbeeld() {
  const host = document.getElementById('akte-schrijf-voorbeeld');
  if (!host) return;
  host.innerHTML = regieNaarHtml(_ta()?.value ?? _tekst) || '<p class="dm-hint">Nog niets geschreven.</p>';
}

// ── Invoegen ─────────────────────────────────────────────────────────────────
// Twaalf pillen naast elkaar leest als een gereedschapskist waar je doorheen
// moet zoeken. Wat je in élke alinea gebruikt staat los (sectie, kaartje,
// beeld); de rest zit onder één knop, gegroepeerd, met de sneltoets erbij —
// want wie een hoofdstuk schrijft houdt zijn handen op het toetsenbord.
const INVOEG_MENU = [
  { groep: 'Tekst', items: [
    { id: 'kop',       label: 'Sectie',        icon: 'scroll-text', toets: 'S', hint: 'Een nieuwe sectie (##)' },
    { id: 'lijst',     label: 'Lijst',         icon: 'clipboard-list', toets: 'L', hint: 'Opsomming; Enter maakt de volgende regel' },
    { id: 'lijst-nr',  label: 'Genummerd',     icon: 'clipboard-list', toets: 'N', hint: 'Een reeks die op volgorde gebeurt' },
    { id: 'citaat',    label: 'Citaat',        icon: 'quote',       toets: 'Q', hint: 'Aangehaalde tekst — een lied, een inscriptie' },
    { id: 'breuk',     label: 'Scènebreuk',    icon: 'minus',       toets: 'H', hint: 'Een sprong in tijd of plaats' },
    { id: 'tabel-md',  label: 'Tabel',         icon: 'square',      toets: 'T', hint: 'Een tabel met koppen' },
    { id: 'voorlezen', label: 'Voorlezen',     icon: 'quote',       toets: 'V', hint: 'Wat je letterlijk voorleest — met knop naar het tafelscherm' },
    { id: 'dm',        label: 'Notitie',       icon: 'eye-off',     toets: 'D', hint: 'Alleen voor jou' },
    { id: 'check',     label: 'Check',         icon: 'target',      toets: 'C', hint: 'Een DC als aantekening' },
  ]},
  { groep: 'Verwijzen', items: [
    { id: 'kaartje',   label: 'Kaartje',       icon: 'user',        toets: 'K', hint: 'Verwijs naar een kaartje — [[Naam]]' },
    { id: 'beeld',     label: 'Beeld',         icon: 'image',       toets: 'B', hint: 'Een afbeelding of geluid uit de bibliotheek' },
    { id: 'kaart',     label: 'Plattegrond',   icon: 'castle',      toets: 'P', hint: 'Een dungeonkaart om te openen' },
    { id: 'kamer',     label: 'Kamer',         icon: 'door-open',   toets: 'A', hint: 'Eén kamer onthullen' },
  ]},
  { groep: 'Gebeurt er iets', items: [
    { id: 'gevecht',   label: 'Gevecht',       icon: 'swords',      toets: 'G', hint: 'Een encounter die je hier start' },
    { id: 'tabel',     label: 'Worptabel',     icon: 'dice',        toets: 'W', hint: 'Een tabel uit de campagne om te rollen' },
    { id: 'buit',      label: 'Buit',          icon: 'vault',       toets: 'U', hint: 'Een vondst om te onthullen' },
    { id: 'brief',     label: 'Brief',         icon: 'mail',        toets: 'R', hint: 'Een brief die je hier verstuurt' },
    { id: 'muziek',    label: 'Muziek',        icon: 'music',       toets: 'M', hint: 'Een nummer of afspeellijst' },
    { id: 'rust',      label: 'Rust',          icon: 'moon',        toets: 'E', hint: 'Lange of korte rust' },
  ]},
];
const _INVOEG_OP_TOETS = {};
for (const g of INVOEG_MENU) for (const it of g.items) _INVOEG_OP_TOETS[it.toets.toLowerCase()] = it.id;

function _invoegBalk() {
  const menu = INVOEG_MENU.map(g => `
    <div class="akte-invoeg-groep">${esc(g.groep)}</div>
    ${g.items.map(it => `
      <button class="akte-invoeg-item" title="${esc(it.hint)}"
        onclick="window.akteSchrijven.invoegen('${it.id}')">
        ${icon(it.icon)} <span>${esc(it.label)}</span>
        <kbd>Alt+${esc(it.toets)}</kbd>
      </button>`).join('')}`).join('');
  return `
    <div class="akte-invoeg-balk">
      <div class="akte-invoeg-wrap">
        <button class="akte-invoeg-btn akte-invoeg-hoofd" onclick="window.akteSchrijven.menu(event)"
          title="Iets invoegen (Alt + letter)">${icon('plus')} Invoegen <span class="akte-invoeg-pijl">▾</span></button>
        <div class="akte-invoeg-menu hidden" id="akte-invoeg-menu">${menu}</div>
      </div>
      <span class="akte-invoeg-sep"></span>
      <button class="akte-invoeg-btn" title="Een nieuwe sectie (Alt+S)" onclick="window.akteSchrijven.invoegen('kop')">${icon('scroll-text')} Sectie</button>
      <button class="akte-invoeg-btn" title="Verwijs naar een kaartje (Alt+K)" onclick="window.akteSchrijven.invoegen('kaartje')">${icon('user')} Kaartje</button>
      <button class="akte-invoeg-btn" title="Een afbeelding of geluid (Alt+B)" onclick="window.akteSchrijven.invoegen('beeld')">${icon('image')} Beeld</button>
      <span class="akte-invoeg-sep"></span>
      <button class="akte-invoeg-btn" title="Vet (Ctrl+B)" onclick="window._fmt('akte-schrijf-ta','**')"><b>B</b></button>
      <button class="akte-invoeg-btn" title="Cursief (Ctrl+I)" onclick="window._fmt('akte-schrijf-ta','*')"><i>I</i></button>
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
        <!-- De knoppen zeggen nu wát ze doen. "Namen" draagt bovendien zijn
             eigen reden: het getal is het aantal genoemde namen zonder kaartje,
             dus je ziet zonder klikken of er werk ligt. -->
        <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Welke genoemde namen hebben nog geen kaartje?"
          onclick="window.akteSchrijven.namen()">${icon('users')} Namen${
            _namenZonder ? ` <span class="akte-badge">${_namenZonder}</span>` : ''}</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm${_split ? ' is-actief' : ''}"
          title="Tekst links, het perkament rechts — schrijven en zien tegelijk"
          onclick="window.akteSchrijven.split()">${icon('columns-2')} Tekst en beeld</button>
        <button class="dm-btn dm-btn-ghost dm-btn-sm${_voorbeeld ? ' is-actief' : ''}"
          title="${_voorbeeld ? 'Terug naar schrijven' : 'De akte zoals je hem speelt — met knoppen die echt onthullen'}"
          onclick="window.akteSchrijven.voorbeeld()">${icon(_voorbeeld ? 'pencil' : 'play')} ${_voorbeeld ? 'Schrijven' : 'Spelen'}</button>
        <div class="akte-bestand-wrap">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" title="Bestand: inlezen of meenemen"
            onclick="window.akteSchrijven.bestandMenu(event)">⋯</button>
          <div class="akte-bestand-menu hidden" id="akte-bestand-menu">
            <label class="akte-invoeg-item">
              ${icon('folder-open')} <span>Importeren…</span>
              <input type="file" accept=".md,text/markdown,text/plain" style="display:none"
                onchange="window.akteSchrijven.inlezen(this.files[0], this)">
            </label>
            <button class="akte-invoeg-item" onclick="window.akteSchrijven.exporteer()">
              ${icon('download')} <span>Exporteren</span></button>
          </div>
        </div>
        ${window._helpBtn?.('akte_schrijven') ?? ''}
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
      <div class="akte-schrijf-hoofd${_split && !_voorbeeld ? ' akte-schrijf-hoofd--split' : ''}">
        ${_voorbeeld ? '' : _invoegBalk()}
        <div class="akte-schrijf-panelen">
        <textarea class="akte-schrijf-ta${_voorbeeld ? ' hidden' : ''}" id="akte-schrijf-ta"
          spellcheck="true" placeholder="Schrijf hier het hoofdstuk.&#10;&#10;## Een sectie begint met twee hekjes&#10;&#10;Verwijs naar een kaartje met [[Naam]] — gebruik de knop, dan weet je zeker dat het bestaat.">${esc(_tekst)}</textarea>
        <div class="akte-schrijf-voorbeeld${_voorbeeld || _split ? '' : ' hidden'}" id="akte-schrijf-voorbeeld"></div>
        </div>
      </div>
    </div>`;
  const ta = _ta();
  if (ta) {
    ta.addEventListener('input', () => {
      _merkVuil();
      _tekenSecties();
      // Naast elkaar: het voorbeeld loopt mee, maar niet bij elke aanslag —
      // die kant rendert een heel hoofdstuk.
      if (_split) { clearTimeout(_splitTimer); _splitTimer = setTimeout(_tekenVoorbeeld, 400); }
    });
    ta.addEventListener('keydown', (e) => {
      window._fmtKey?.(e, 'akte-schrijf-ta');
      // Alt + letter: invoegen zonder je handen van het toetsenbord te halen.
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[a-z]$/i.test(e.key)) {
        const id = _INVOEG_OP_TOETS[e.key.toLowerCase()];
        if (id) { e.preventDefault(); window.akteSchrijven.invoegen(id); return; }
      }
      // Enter in een opsomming zet vanzelf het volgende streepje; op een lege
      // regel sluit hij de lijst af. Zo hoef je het teken maar één keer te typen.
      if (e.key === 'Enter' && !e.shiftKey) {
        const voor = ta.value.slice(0, ta.selectionStart);
        const regel = voor.slice(voor.lastIndexOf('\n') + 1);
        const m = regel.match(/^(\s*)([-*]|\d+[.)])\s+(.*)$/);
        if (m) {
          e.preventDefault();
          // Een genummerde lijst telt door; een opsomming herhaalt zijn teken.
          const nr = /^\d/.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2];
          if (!m[3].trim()) {
            // Lege bullet: haal hem weg en eindig de lijst.
            const begin = voor.lastIndexOf('\n') + 1;
            ta.setRangeText('', begin, ta.selectionStart, 'end');
            ta.setRangeText('\n', ta.selectionStart, ta.selectionEnd, 'end');
          } else {
            ta.setRangeText(`\n${m[1]}${nr} `, ta.selectionStart, ta.selectionEnd, 'end');
          }
          _merkVuil();
        }
      }
    });
  }
  _tekenSecties();
  if (_voorbeeld || _split) _tekenVoorbeeld();
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

// Eén regel in de tekst vervangen (of het hele blok weghalen). Wat er niet
// gevonden wordt, blijft onaangeroerd — nooit gokken in andermans hoofdstuk.
function _blokRegelVervang(soort, kop, nieuweRegel) {
  const ta = _ta();
  const tekst = ta?.value ?? _tekst;
  const regels = tekst.split('\n');
  const zoek = `> [!${soort}]${kop ? ' ' + kop : ''}`;
  const i = regels.findIndex(r => r.trim() === zoek.trim());
  if (i < 0) { alert('Dit blok staat niet meer zo in de tekst — hij is intussen aangepast.'); return; }
  if (nieuweRegel === null) {
    // Het blok is de kopregel plus alles wat er met `>` onder hangt.
    let eind = i + 1;
    while (eind < regels.length && /^\s*>/.test(regels[eind]) && !/^\s*>\s*\[!/.test(regels[eind])) eind++;
    regels.splice(i, eind - i);
  } else {
    regels[i] = nieuweRegel;
  }
  const nieuw = regels.join('\n');
  if (ta) { ta.value = nieuw; }
  _tekst = nieuw;
  if (ta) { _merkVuil(); _tekenSecties(); if (_voorbeeld || _split) _tekenVoorbeeld(); }
  else {
    // In de lade is er geen tekstvak: meteen bewaren en de lade opnieuw laten
    // laden, zodat je ziet wat je veranderd hebt.
    api.saveAkteTekst(_ch, nieuw).then(() => window._ladeHerlaad?.()).catch(e => alert('Opslaan mislukt: ' + e.message));
  }
}

// ── Publieke API ─────────────────────────────────────────────────────────────
window.akteSchrijven = {
  _rijen: [], _opPick: null,
  _filter(q) {
    const zoek = (q || '').toLowerCase();
    document.querySelectorAll('#akte-kies-lijst .pb-entity-item').forEach(b =>
      b.classList.toggle('hidden', !b.dataset.name.includes(zoek)));
  },
  // De naam uit het zoekveld als nieuw kaartje. Hij komt daarna ook in de
  // tekst te staan, zodat je meteen verder kunt schrijven.
  nieuwUitZoek() {
    const naam = document.getElementById('akte-kies-zoek')?.value.trim();
    if (!naam) { document.getElementById('akte-kies-zoek')?.focus(); return; }
    window.app.closeModal();
    _voegIn(`[[${naam}]]`);
    this.maakPlaceholder(naam);
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

  // Eén ingang: de menu-items, de losse knoppen en de sneltoetsen komen hier
  // allemaal uit, zodat er maar één plek is die weet wat een soort invoegt.
  invoegen(id) {
    document.getElementById('akte-invoeg-menu')?.classList.add('hidden');
    if (id === 'kop')      return _voegIn('## ', { marker: true });
    if (id === 'kaartje')  return this.kaartje();
    if (id === 'beeld')    return this.afbeelding();
    if (id === 'lijst')    return _voegIn('- ', { marker: true });
    if (id === 'lijst-nr') return _voegIn('1. ', { marker: true });
    if (id === 'citaat')   return _voegIn('> ', { marker: true });
    if (id === 'breuk')    return _voegIn('---', { blok: true });
    if (id === 'tabel-md') return this.tabelMd();
    return this.blok(id);
  },

  bestandMenu(ev) {
    const m = document.getElementById('akte-bestand-menu');
    if (!m) return;
    m.classList.toggle('hidden');
    if (m.classList.contains('hidden')) return;
    ev?.stopPropagation();
    setTimeout(() => {
      const sluit = (e) => {
        if (!m.contains(e.target)) { m.classList.add('hidden'); document.removeEventListener('click', sluit); }
      };
      document.addEventListener('click', sluit);
    }, 0);
  },

  menu(ev) {
    const m = document.getElementById('akte-invoeg-menu');
    if (!m) return;
    m.classList.toggle('hidden');
    if (m.classList.contains('hidden')) return;
    ev?.stopPropagation();
    setTimeout(() => {
      const sluit = (e) => {
        if (!m.contains(e.target)) { m.classList.add('hidden'); document.removeEventListener('click', sluit); }
      };
      document.addEventListener('click', sluit);
    }, 0);
  },

  // Een markdown-tabel: kopregel, streepjesregel, één lege rij. De streepjes
  // zijn het enige wat je nooit uit je hoofd doet — vandaar een knop.
  tabelMd() {
    _voegIn('| Kop | Kop |\n| --- | --- |\n|  |  |', { blok: true });
  },

  kop() { this.invoegen('kop'); },

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
    // Bestaat de naam nog niet? Typ hem in het zoekveld en maak hem hier aan;
    // dat scheelt een omweg langs de kaartjes-tab.
    _kiezer('Kaartje invoegen', rijen, (r) => _voegIn(`[[${r.naam}]]`), 'Nog geen kaartjes.', true);
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
    try { await api.createEntity(type, { name: naam, data: { concept: 'true' } }); this.namen(); }
    catch (e) { alert('Aanmaken mislukt: ' + e.message); }
  },

  // Naast elkaar schrijven: links de tekst, rechts hetzelfde perkament dat je
  // straks speelt. Zo kijk je tijdens het schrijven naar de opmaak in plaats
  // van naar de tekens — zonder dat het tekstvak zijn ongedaan-maken verliest.
  split() {
    _split = !_split;
    if (_split) _voorbeeld = false;
    _tekst = _ta()?.value ?? _tekst;
    _teken();
  },

  voorbeeld() {
    _split = false;
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
        // Een oogje is klein en een misklik onthult iets dat de party nog niet
        // hoorde te weten. Dus: even een weg terug, daarna verdwijnt de knop.
        span.querySelectorAll('.akte-act').forEach(b => b.remove());
        span.insertAdjacentHTML('beforeend',
          `<button class="akte-act akte-act--terug" title="Onthullen ongedaan maken"
             onclick="window.akteSchrijven.onthulTerug('${type}','${id}',this)">${icon('refresh-cw')}</button>`);
        span.querySelector('a')?.classList.remove('wikilink--dicht');
        setTimeout(() => span.querySelector('.akte-act--terug')?.remove(), 12000);
      }
    } catch (e) { alert('Onthullen mislukt: ' + e.message); }
  },

  // Terug naar verborgen. Alleen voor wat je met één klik onthulde: een
  // gevecht dat je startte of een tabel die je rolde draai je hier niet terug.
  async onthulTerug(type, id, btn) {
    try {
      await api.toggleVisibility(type, id, 'hidden');
      const naam = Object.keys(window._entityNameIndex || {}).find(n => window._entityNameIndex[n]?.id === id);
      if (naam) window._entityNameIndex[naam].vis = 'hidden';
      const span = btn.closest('.akte-link');
      if (span) {
        span.querySelector('a')?.classList.add('wikilink--dicht');
        span.querySelectorAll('.akte-act').forEach(b => b.remove());
        span.insertAdjacentHTML('beforeend', `<button class="akte-act akte-act--onthul" title="Onthullen voor de party"
            onclick="window.akteSchrijven.onthul('${type}','${id}','visible',this)">${icon('eye')}</button>
          <button class="akte-act akte-act--vaag" title="Vaag onthullen"
            onclick="window.akteSchrijven.onthul('${type}','${id}','vague',this)">${icon('eye-off')}</button>`);
      }
    } catch (e) { alert('Terugdraaien mislukt: ' + e.message); }
  },

  // Een leeg kaartje aanmaken vanuit de tekst. Je bent aan het schrijven en
  // noemt een naam die nog niet bestaat; dan wil je hem vastleggen, niet eerst
  // naar een ander tabblad. Wat voor kaartje het is, is de enige vraag — de
  // rest vul je later in.
  maakPlaceholder(naam) {
    const soorten = [
      ['personages', 'Personage', 'user'],
      ['locaties', 'Locatie', 'map-pin'],
      ['organisaties', 'Organisatie', 'building'],
      ['voorwerpen', 'Voorwerp', 'package'],
      ['documenten', 'Document', 'scroll-text'],
    ];
    window.app.openModal(`Kaartje maken — ${naam}`, '', `
      <div class="dm-feature-section" style="margin:0">
        <div class="pb-entity-list">
          ${soorten.map(([type, label, ico]) => `
            <button class="pb-entity-item" onclick="window.akteSchrijven.placeholderMaak('${type}','${esc(naam).replace(/'/g, "\\'")}')">
              <span class="pb-entity-icon">${icon(ico)}</span>
              <span class="pb-entity-name">${esc(label)}</span>
            </button>`).join('')}
        </div>
      </div>`);
  },

  async placeholderMaak(type, naam) {
    try {
      // `concept` markeert een plaatshouder: hij bestaat, maar er staat nog
      // niets in. De archieftabs tonen daar een teller op, en zodra je het
      // kaartje bewaart is de vlag weg.
      const ent = await api.createEntity(type, { name: naam, data: { concept: 'true' } });
      // Meteen in de naamindex, anders blijft hij in de tekst "onbekend" tot je
      // de app herlaadt.
      window._entityNameIndex = window._entityNameIndex || {};
      window._entityNameIndex[naam] = { id: ent.id, type, vis: 'hidden', geheimTotaal: 0, geheimOnthuld: 0 };
      window.app.closeModal();
      if (_voorbeeld || _split) _tekenVoorbeeld();
      window._ladeHerlaad?.();
      _telNamen();
    } catch (e) { alert('Aanmaken mislukt: ' + e.message); }
  },

  // De geheimen van een kaartje, hier in de tekst. Een kaartje heeft er zelden
  // één — vandaar een lijstje in plaats van blind de eerste onthullen. Zelfde
  // route als het oogje op het kaartje zelf: per regel, per party.
  async geheimen(type, id) {
    let ent = null;
    try { ent = await api.getEntity(type, id); } catch { return alert('Kon het kaartje niet ophalen.'); }
    const regels = window._geheimRegelsUit ? window._geheimRegelsUit(ent.data) : [];
    // De server rekent zelf uit welke regel open staat (`_onthuld`, per regel);
    // de client telt geen posities meer — dat ging mis zodra je regels
    // versleepte of ertussenuit haalde.
    const onthuld = Array.isArray(ent._onthuld) ? ent._onthuld : [];
    window.app.openModal(`Geheimen — ${ent.name || ''}`, '', `
      <div class="dm-feature-section" style="margin:0">
        ${regels.length ? `<div class="pb-entity-list">
          ${regels.map((r, i) => {
            const aan = !!onthuld[i];
            return `<div class="pb-entity-item" style="cursor:default;align-items:flex-start">
              <span class="pb-entity-icon">${icon(aan ? 'lock-open' : 'lock')}</span>
              <span class="pb-entity-name" style="white-space:normal">${esc(r.tekst || '')}</span>
              <button class="dm-btn dm-btn-sm ${aan ? 'dm-btn-ghost' : 'dm-btn-primary'}"
                onclick="window.akteSchrijven.geheimToggle('${type}','${id}',${i},'${esc(r.id || '')}')">
                ${aan ? 'Weer sluiten' : 'Onthullen'}</button>
            </div>`;
          }).join('')}</div>`
          : '<p class="dm-hint">Dit kaartje heeft geen geheimen.</p>'}
      </div>`);
  },

  async geheimToggle(type, id, index, gid) {
    try {
      await api.toggleSecret(type, id, index, gid);
      // De teller in de index bijwerken, zodat het slotje klopt zonder herladen.
      const naam = Object.keys(window._entityNameIndex || {}).find(n => window._entityNameIndex[n]?.id === id);
      const ent = await api.getEntity(type, id).catch(() => null);
      if (naam && ent) {
        const idx = window._entityNameIndex[naam];
        idx.geheimTotaal  = ent._geheimTotaal ?? idx.geheimTotaal;
        idx.geheimOnthuld = ent._geheimOnthuld ?? idx.geheimOnthuld;
      }
      this.geheimen(type, id);
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
      btn.disabled = false;
      btn.setAttribute('onclick', `window.akteSchrijven.beeldTerug('${entry.id}','${fileId}', this)`);
      btn.title = 'Klik om het weer te verbergen';
    } catch (e) { btn.disabled = false; alert('Tonen mislukt: ' + e.message); }
  },

  async beeldTerug(sessieId, fileId, btn) {
    try {
      await api.verbergAfbeelding(sessieId, fileId, window._activeGroupId || null);
      btn.innerHTML = `${icon('eye')} Toon aan spelers`;
      btn.classList.remove('is-klaar');
      btn.setAttribute('onclick', `window.akteSchrijven.toonBeeld('${fileId}', this)`);
      btn.title = '';
    } catch (e) { alert('Verbergen mislukt: ' + e.message); }
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

  // ── Een blok bijstellen ─────────────────────────────────────────────────
  // Het potlood op een regieblok. Je verandert de kop (en daarmee waar het
  // blok naar wijst) zonder in de tekst te hoeven zoeken. Wat er in de tekst
  // gebeurt is één regel vervangen — de rest blijft letterlijk staan.
  blokBewerk(soort, kop) {
    const blok = REGIE_BLOKKEN[soort] || {};
    const metKiezer = ['gevecht', 'tabel', 'buit', 'kaart', 'kamer'].includes(soort);
    window.app.openModal(`${blok.label || soort} bijstellen`, '', `
      <div class="dm-feature-section" style="margin:0">
        <div class="dm-form-row">
          <label class="dm-form-label">${esc(soort === 'check' ? 'De check' : soort === 'rust' ? 'Soort rust' : 'Waar wijst dit blok naar?')}</label>
          <input class="dm-input" id="blok-kop" value="${esc(kop || '')}"
                 placeholder="${esc(blok.hint || '')}">
        </div>
        ${metKiezer ? `<div class="dm-feature-row">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.akteSchrijven.blokKies('${soort}')">
            ${icon('search')} Kies uit de campagne</button>
        </div>` : ''}
        <p class="dm-hint">${esc(blok.hint || '')}</p>
      </div>
      <div class="dm-feature-row" style="justify-content:flex-end">
        <button class="dm-btn dm-btn-danger" onclick="window.akteSchrijven.blokWeg('${soort}','${esc(kop).replace(/'/g, "\\'")}')">
          ${icon('trash')} Blok verwijderen</button>
        <button class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">Annuleren</button>
        <button class="dm-btn dm-btn-primary" onclick="window.akteSchrijven.blokBewaar('${soort}','${esc(kop).replace(/'/g, "\\'")}')">
          ${icon('save')} Opslaan</button>
      </div>`);
  },

  // De kiezer van het invoegmenu, maar dan om een bestaand blok bij te stellen:
  // hij vult het veld in plaats van een nieuw blok neer te zetten.
  async blokKies(soort) {
    const vul = (naam) => { const el = document.getElementById('blok-kop'); if (el) el.value = naam; };
    const bewaarModal = document.getElementById('m-body')?.innerHTML;
    if (soort === 'gevecht') {
      const lijst = await api.listEncounters().catch(() => []);
      return _kiezer('Gevecht kiezen', (lijst || []).map(e => ({ naam: e.name || 'Gevecht', icoon: 'swords' })),
        (r) => { window.app.openModal('Gevecht bijstellen', '', bewaarModal); vul(r.naam); });
    }
    if (soort === 'tabel') {
      const lijst = await api.listTables().catch(() => []);
      return _kiezer('Tabel kiezen', (lijst || []).map(t => ({ naam: t.name || 'Tabel', icoon: 'dice' })),
        (r) => { window.app.openModal('Tabel bijstellen', '', bewaarModal); vul(r.naam); });
    }
    if (soort === 'buit') {
      const lijst = (await api.lootEvents().catch(() => ({})))?.events || [];
      return _kiezer('Vondst kiezen', lijst.map(v => ({ naam: v.naam || 'Vondst', icoon: 'vault' })),
        (r) => { window.app.openModal('Buit bijstellen', '', bewaarModal); vul(r.naam); });
    }
    const kaarten = await api.listDungeons().catch(() => []);
    if (soort === 'kaart') {
      return _kiezer('Kaart kiezen', (kaarten || []).map(k => ({ naam: k.name || 'Kaart', icoon: 'castle' })),
        (r) => { window.app.openModal('Kaart bijstellen', '', bewaarModal); vul(r.naam); });
    }
    const rijen = [];
    for (const k of (kaarten || [])) for (const r of (k.rooms || [])) if (r.name) rijen.push({ naam: `${k.name} · ${r.name}`, icoon: 'door-open' });
    return _kiezer('Kamer kiezen', rijen, (r) => { window.app.openModal('Kamer bijstellen', '', bewaarModal); vul(r.naam); });
  },

  blokBewaar(soort, oudeKop) {
    const nieuw = document.getElementById('blok-kop')?.value.trim() ?? '';
    _blokRegelVervang(soort, oudeKop, `> [!${soort}]${nieuw ? ' ' + nieuw : ''}`);
    window.app.closeModal();
  },

  blokWeg(soort, kop) {
    if (!confirm('Dit blok uit de tekst halen?')) return;
    _blokRegelVervang(soort, kop, null);
    window.app.closeModal();
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
      if (kamerNaam) {
        btn.setAttribute('onclick', `window.akteSchrijven.kamerTerug('${esc(kaart.id)}','${esc(kop).replace(/'/g, "\\'")}', this)`);
        btn.title = 'Klik om de kamer weer dicht te doen';
      }
    } catch (e) { _melding(btn, 'Onthullen mislukt: ' + e.message); }
  },

  // De kamer weer dichtdoen. De toegang tot de kaart laten we staan: die geef
  // je bewust, en hem intrekken is zelden wat je bedoelt.
  async kamerTerug(kaartId, kop, btn) {
    const kamerNaam = String(kop || '').split(/\s*[·:>|–-]\s*/)[1];
    const gid = window._activeGroupId;
    try {
      const kaarten = await api.listDungeons();
      const kaart = (kaarten || []).find(k => k.id === kaartId);
      const kamer = (kaart?.rooms || []).find(r => (r.name || '').toLowerCase().includes((kamerNaam || '').trim().toLowerCase()));
      if (kamer) await api.hideDungeonRoom(kaartId, { roomId: kamer.id, groupId: gid });
      btn.innerHTML = `${icon('eye')} Onthullen`;
      btn.classList.remove('is-klaar');
      btn.setAttribute('onclick', `window.akteSchrijven.onthulKamer('${esc(kop).replace(/'/g, "\\'")}', this)`);
      btn.title = '';
    } catch (e) { _melding(btn, 'Terugdraaien mislukt: ' + e.message); }
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

  // Exporteren in plaats van kopiëren: je krijgt het hoofdstuk als `.md`-bestand,
  // dat je in je vault kunt zetten. Het klembord deed maar de helft — tekst
  // selecteren en Ctrl+C kan een tekstvak zelf ook.
  exporteer() {
    document.getElementById('akte-bestand-menu')?.classList.add('hidden');
    const tekst = _ta()?.value ?? _tekst;
    const naam = (_titel || _ch || 'akte').replace(/[^\w\u00c0-\u024f -]+/g, '').trim() || 'akte';
    const url = URL.createObjectURL(new Blob([tekst], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${naam}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
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
  _namenZonder = null;
  _teken();
  _ta()?.focus();
  _telNamen();
}
