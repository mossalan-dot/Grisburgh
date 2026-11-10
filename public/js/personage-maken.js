// ════════════════════════════════════════════════════════════════════════════
//  EEN PERSONAGE SCHEPPEN
// ════════════════════════════════════════════════════════════════════════════
// Zie docs/voorstel-personage-maken.md (waarom een concept nog geen kaartje is)
// en docs/voorstel-personage-scheppen.md (waarom het zo aanvoelt). Een speler
// kon zijn blad al bijwerken maar het kaartje niet aanmaken, dus stond een
// nieuwe speler niet in de inloglijst en kwam hij nergens binnen.
//
// Wat hier gebeurt is **niet** een tweede spelersblad. De maker vult de
// velden die het bestaande profiel al heeft; na het gunnen bewerk je verder op
// het spelerstabblad dat er al is. En hij rekent voor, maar blokkeert niets:
// wat niet klopt staat als opmerking bij de onthulling, en de DM leest het
// voordat hij gunt. Elke regel daarvoor staat op de server
// (lib/personage-concept.js): deze kant toont, de server rekent.
//
// Opbouw: een drempel, dan een werkbank — links het blad dat zich vormt,
// rechts één keuze per scherm — en tot slot de onthulling met het lakzegel.
// Eén klikhandler op de hele overlay (`data-actie`), zodat een naam met een
// apostrof ("Thieves' Tools") nergens in een onclick-string hoeft te passen.
import { api, huidigeCampagne } from './api.js?v=320';

const esc = s => window.app?.esc?.(s) ?? String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ico = (n, o) => window.icon?.(n, o) ?? '';
const toast = (t) => window._showToast?.(t);

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const AB_NAAM = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const STANDAARDREEKS = [15, 14, 13, 12, 10, 8];
const PUNTEN = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PUNTEN_BUDGET = 27;
// De achttien skills en bij welke ability ze horen. Dezelfde lijst staat op de
// server (`SKILLS` in lib/personage-concept.js).
const SKILLS = {
  Acrobatics: 'dex', 'Animal Handling': 'wis', Arcana: 'int', Athletics: 'str',
  Deception: 'cha', History: 'int', Insight: 'wis', Intimidation: 'cha',
  Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis',
  Performance: 'cha', Persuasion: 'cha', Religion: 'int', 'Sleight of Hand': 'dex',
  Stealth: 'dex', Survival: 'wis',
};
const SCHOOL_KLEUR = {
  Abjuration: '#3b6ea5', Conjuration: '#8a6d3b', Divination: '#6a6a6a', Enchantment: '#a4508b',
  Evocation: '#b5452f', Illusion: '#6a4fa0', Necromancy: '#3f6b3f', Transmutation: '#9a7008',
};
const METHODE = {
  rollen:   { label: 'Rollen',         lead: 'Zes keer 4d6, de laagste valt af. Daarna koppel je elke worp aan de ability die jij wilt.' },
  pointbuy: { label: 'Point buy',      lead: 'Alles begint op 8. Je hebt 27 punten; boven de 13 kost elke stap er meer.' },
  array:    { label: 'Standaardreeks', lead: 'Verdeel 15, 14, 13, 12, 10 en 8 over je abilities.' },
  vrij:     { label: 'Vrij intikken',  lead: 'Zes vakjes, zelf invullen. Voor een personage dat elders is gemaakt.' },
};
const EMOTE_MAX = 4;
const OPNAME_MAX_SEC = 6;
const VIDEO_MAX_BYTES = 8 * 1024 * 1024;

const P = {
  c: null, bronnen: null, inst: null, profiel: null, nakijk: null,
  slotsPer: {}, groeiSlots: [], spreukFeats: [], rerollsOver: 0,
  scherm: 'drempel', stapId: 'naam', bezig: false,
  zoek: {}, opname: null, rolt: false, zegel: false,
};

const abMod = (s) => Math.floor(((parseInt(s) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? `+${n}` : `${n}`);
const klasseVan = (naam) => (P.bronnen?.klassen || []).find(k => k.naam === naam) || null;
const volkVan = (naam) => (P.bronnen?.species || []).find(s => s.naam === naam) || null;
const bgVan = (naam) => (P.bronnen?.backgrounds || []).find(b => b.naam === naam) || null;
const fileUrl = (id) => api.fileUrl ? api.fileUrl(id) : `/api/files/${id}?campagne=${encodeURIComponent(huidigeCampagne() || '')}`;
const norm = (s) => (window._normSearch ? window._normSearch(s) : String(s || '').toLowerCase());

// Zijn twee classes met elk hun level — dezelfde verdeling als op de server.
function _delen() {
  const c = P.c || {};
  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  const n = c.multiKlasse ? Math.max(0, Math.min(level - 1, parseInt(c.multiKlasseLevel) || 0)) : 0;
  return [[c.klasse, level - n], [c.multiKlasse, n]].filter(([k, l]) => k && l > 0);
}

// De scores zoals ze op het blad komen, terwijl je nog schuift. Zelfde
// plafonds als `_scoresMetGroei` op de server: tot 20, een Epic Boon tot 30.
function _totaal(a) {
  let v = parseInt(P.c.scores?.[a]) || 10;
  const tel = (n, max) => { v = Math.max(v, Math.min(max, v + n)); };
  tel(parseInt(P.c.bgBonus?.[a]) || 0, 20);
  for (const slot of (P.groeiSlots || [])) {
    const g = (P.c.groei || {})[slot.sleutel];
    if (g?.keuze === 'asi' && slot.soort === 'asi') tel(parseInt(g.asi?.[a]) || 0, 20);
    if (g?.keuze === 'feat' && g.plus === a) tel(1, slot.soort === 'boon' ? 30 : 20);
  }
  return v;
}

// ── Kaarten ──────────────────────────────────────────────────────────────────
// Een keuze die bepaalt wie je bent verdient meer dan een uitklaplijst. Hing
// de DM een portret in het Heldenboek, dan staat dat op de kaart (met zijn
// focuspunt); anders een medaillon met het icoon. Laadt de plaat niet, dan
// valt de kaart zelf terug op het medaillon.
function _kaart({ naam, onder = '', beeld = null, icoon = 'user', aan = false, actie, extra = '' }) {
  const dat = `data-actie="${esc(actie)}" data-naam="${esc(naam)}"${extra}`;
  const binnen = `
    <span class="ps-kaart-zegel">${ico('check')}</span>
    <span class="ps-kaart-medaillon">${ico(icoon)}</span>
    <span class="ps-kaart-tekst">
      <span class="ps-kaart-naam">${esc(naam)}</span>
      ${onder ? `<span class="ps-kaart-onder">${esc(onder)}</span>` : ''}
    </span>
    <span class="ps-kaart-rand"></span>`;
  if (beeld?.id) {
    return `<button type="button" class="ps-kaart ps-kaart--beeld${aan ? ' is-aan' : ''}" ${dat}>
      <img class="ps-kaart-plaat" src="${esc(api.thumbUrl(beeld.id))}" alt="" loading="lazy"
        ${beeld.focus ? `style="object-position:${esc(beeld.focus)}"` : ''}
        onerror="this.closest('.ps-kaart').classList.remove('ps-kaart--beeld');this.remove()">
      <span class="ps-kaart-waas"></span>${binnen}</button>`;
  }
  return `<button type="button" class="ps-kaart${aan ? ' is-aan' : ''}" ${dat}>${binnen}</button>`;
}

// Bij 59 species of 124 backgrounds is een zoekveld geen luxe. Zoeken gaat
// diakriet-ongevoelig, zoals overal in de app; het gekozen kaartje blijft
// altijd staan, anders verdwijnt je keuze onder je handen.
function _zoekVeld(sleutel, aantal) {
  if (aantal < 13) return '';
  return `<div class="ps-zoek">${ico('search')}
    <input type="search" class="ps-zoek-veld" data-zoek="${esc(sleutel)}" value="${esc(P.zoek[sleutel] || '')}"
      placeholder="Zoeken" aria-label="Zoeken"></div>`;
}
function _gefilterd(sleutel, lijst, tekst, gekozen) {
  const q = norm(P.zoek[sleutel] || '').trim();
  if (!q) return lijst;
  const woorden = q.split(/\s+/);
  return lijst.filter(x => x.naam === gekozen || woorden.every(w => norm(tekst(x)).includes(w)));
}

const _icoonKlasse = (naam) => window.vaardigheden?.iconen?.klasse?.[naam] || 'sword';
const _icoonSpecies = (naam) => window.vaardigheden?.iconen?.species?.[naam] || 'user';
const _aardLabel = (a) => ({ martial: 'Martial', half: 'Half-caster', caster: 'Full caster' }[a] || '');

// ── De stappen ───────────────────────────────────────────────────────────────
// Elke stap zegt zelf wat hij toont, welke velden hij bewaart, wanneer je door
// mag en of hij er wel toe doet. Een spreukstap voor een Fighter of een
// groeistap op level 1 zou een leeg scherm met "jij niet" zijn.
const STAPPEN = [
  {
    id: 'naam', boven: 'Het eerste woord', kop: 'Hoe heet je?',
    velden: ['naam', 'level'],
    kan: () => !!String(P.c.naam || '').trim(),
    html() {
      const max = P.inst?.maxLevel || 1;
      return `
        <p class="ps-lead">Eén naam is genoeg om te beginnen. Een gezicht erbij maakt het al iemand.</p>
        <input id="ps-naam" class="ps-naam-invoer" maxlength="60" value="${esc(P.c.naam || '')}"
          placeholder="Zoals hij aan tafel heet" data-veld="naam" autocomplete="off">
        <div class="ps-portret-rij">
          <div class="ps-portret-vak" id="ps-portret-vak">${_portretBinnen()}</div>
          <div class="ps-portret-knoppen">
            <label class="ps-knop ps-knop--spook">${ico('image')} ${P.c.portret ? 'Andere afbeelding' : 'Kies een afbeelding'}
              <input type="file" accept="image/*" hidden data-upload="portret"></label>
            <label class="ps-knop ps-knop--spook">${ico('film')} ${P.c.video ? 'Ander filmpje' : 'Of een kort filmpje'}
              <input type="file" accept="video/mp4,video/webm" hidden data-upload="video"></label>
            ${P.c.video ? `<button type="button" class="ps-link" data-actie="videoWeg">${ico('x')} Filmpje weghalen</button>` : ''}
          </div>
        </div>
        ${max > 1 ? `
          <div class="ps-level-rij">
            <label for="ps-level">Beginlevel</label>
            <input id="ps-level" class="ps-level-invoer" type="number" min="1" max="${max}"
              value="${esc(String(P.c.level || 1))}" data-veld="level">
            <span class="ps-hint">Tot level ${max}.</span>
          </div>` : ''}`;
    },
  },

  {
    id: 'afkomst', boven: 'Wat je bent', kop: 'Wat ben je?',
    velden: ['species', 'speciesVariant'],
    kan: () => !!P.c.species,
    html() {
      const lijst = P.bronnen.species || [];
      const zicht = _gefilterd('species', lijst, s => `${s.naam} ${s.traits.join(' ')}`, P.c.species);
      const volk = volkVan(P.c.species);
      return `
        <p class="ps-lead">Je species bepaalt waar je vandaan komt en wat je van huis uit meekrijgt.</p>
        ${_zoekVeld('species', lijst.length)}
        <div class="ps-kaarten">${zicht.map(s => _kaart({
          naam: s.naam, beeld: s.beeld, icoon: _icoonSpecies(s.naam), aan: s.naam === P.c.species, actie: 'species',
          onder: [s.basis?.size, s.basis?.speed].filter(Boolean).join(' · ') || s.traits.slice(0, 3).join(' · '),
        })).join('') || '<p class="ps-hint">Niets gevonden.</p>'}</div>
        ${volk?.varianten?.length ? `
          <div class="ps-subkeuze">
            <div class="ps-subkop">${esc(volk.variantLabel || 'Variant')}</div>
            <div class="ps-kaarten ps-kaarten--klein">${volk.varianten.map(v => _kaart({
              naam: v, beeld: volk.variantBeelden?.[v], icoon: _icoonSpecies(volk.naam),
              aan: v === P.c.speciesVariant, actie: 'variant',
            })).join('')}</div>
          </div>` : ''}`;
    },
  },

  {
    id: 'roeping', boven: 'Wat je doet', kop: 'Wat doe je?',
    velden: ['klasse', 'subclass', 'multiKlasse', 'multiKlasseLevel', 'multiSubclass'],
    kan: () => !!P.c.klasse,
    html() {
      const level = parseInt(P.c.level) || 1;
      const k = klasseVan(P.c.klasse);
      const kaarten = (P.bronnen.klassen || []).map(x => _kaart({
        naam: x.naam, beeld: x.beeld, icoon: _icoonKlasse(x.naam), aan: x.naam === P.c.klasse, actie: 'klasse',
        onder: [_aardLabel(x.basis?.aard), x.basis?.hitDie && `d${x.basis.hitDie}`, x.basis?.primary].filter(Boolean).join(' · '),
      })).join('');
      const eerste = _delen()[0]?.[1] || level;
      return `
        <p class="ps-lead">Je class bepaalt je hit die, je saving throws en waar je in uitblinkt.</p>
        <div class="ps-kaarten">${kaarten}</div>
        ${_subHtml(k, eerste, 'subclass', P.c.subclass)}
        ${level > 1 ? _multiHtml(level) : ''}`;
    },
  },

  {
    id: 'herkomst', boven: 'Waar je vandaan komt', kop: 'Waar kom je vandaan?',
    velden: ['background'],
    html() {
      const lijst = P.bronnen.backgrounds || [];
      const zicht = _gefilterd('background', lijst, b => `${b.naam} ${b.skills.join(' ')} ${b.feat} ${b.feature}`, P.c.background);
      return `
        <p class="ps-lead">Je background geeft skills, gereedschap, een feat en een verhoging op je abilities.
          <em>Niets kiezen mag; dan mis je wat hij meegeeft.</em></p>
        ${_zoekVeld('background', lijst.length)}
        <div class="ps-kaarten">${zicht.map(b => _kaart({
          naam: b.naam, beeld: b.beeld, icoon: 'scroll-text', aan: b.naam === P.c.background, actie: 'background',
          onder: [[...b.skills, ...(b.skillKeuze ? ['+ keuze'] : [])].join(', '), b.feat || b.feature].filter(Boolean).join(' · '),
        })).join('') || '<p class="ps-hint">Niets gevonden.</p>'}</div>`;
    },
  },

  {
    id: 'dezes', boven: 'De zes getallen', kop: 'Je ability scores',
    velden: ['methode', 'scores', 'bgBonus'],
    kan: () => P.c.methode !== 'rollen' || (P.c.worpen || []).length === 6,
    html() { return _dezesHtml(); },
  },

  {
    id: 'skills', boven: 'Waar je in uitblinkt', kop: 'Waar ben je goed in?',
    velden: ['skills', 'bgKeuze'],
    html() { return _skillsHtml(); },
  },

  {
    id: 'spreuken', boven: 'Je grimoire', kop: 'Wat kun je oproepen?',
    velden: ['spreukenPer'],
    beschikbaar: () => _spreukSecties().length > 0,
    html() { return _spreukenHtml(); },
  },

  {
    id: 'groei', boven: 'Wat je werd', kop: 'Wat heb je onderweg geleerd?',
    velden: ['groei'],
    beschikbaar: () => (P.groeiSlots || []).length > 0,
    html() { return _groeiHtml(); },
  },

  {
    id: 'uitrusting', boven: 'Je knapzak', kop: 'Waar ga je mee op pad?',
    velden: ['bgOptie', 'wapen', 'harnas', 'schild'],
    html() { return _uitrustingHtml(); },
  },

  {
    id: 'verhaal', boven: 'Je verhaal', kop: 'Vertel je verhaal', optioneel: true,
    velden: ['verhaal', 'geheimen'],
    html() {
      return `
        <p class="ps-lead">Wie was je voordat dit begon? <em>Mag leeg blijven</em> — maar hier wordt een stapel
          getallen iemand.</p>
        <textarea class="ps-verhaal" data-veld="verhaal" maxlength="6000"
          placeholder="Waar kom je vandaan, wat jaagt je op, wie mis je…">${esc(P.c.verhaal || '')}</textarea>
        <div class="ps-geheim-blok">
          <div class="ps-subkop">${ico('lock')} Geheimen — alleen voor je DM</div>
          <p class="ps-hint">Iets wat niemand aan tafel weet. Je DM ziet het meteen en kiest zelf wanneer het uitkomt.</p>
          <div class="ps-geheimen">${(P.c.geheimen || []).map((g, i) => `
            <div class="ps-geheim"><span class="ps-zegeltje">${ico('lock')}</span>
              <p>${esc(g.tekst)}</p>
              <button type="button" class="ps-mini" data-actie="geheimWeg" data-i="${i}" title="Weghalen">${ico('x')}</button>
            </div>`).join('')}</div>
          ${(P.c.geheimen || []).length < 10 ? `
            <div class="ps-geheim-invoer">
              <input id="ps-geheim-in" maxlength="600" placeholder="Een geheim dat je meedraagt…">
              <button type="button" class="ps-knop ps-knop--spook" data-actie="geheim">${ico('plus')} Toevoegen</button>
            </div>` : ''}
        </div>`;
    },
  },

  {
    id: 'stem', boven: 'Je stem', kop: 'Hoe klink je?', optioneel: true,
    velden: ['emotes'],
    html() { return _stemHtml(); },
  },
];

function _actief() { return STAPPEN.filter(s => !s.beschikbaar || s.beschikbaar()); }
function _huidig() {
  const lijst = _actief();
  return lijst.find(s => s.id === P.stapId) || lijst[0];
}

// ── Roeping: subclass en multiclass ─────────────────────────────────────────
function _subHtml(k, lv, veld, gekozen) {
  if (!k) return '';
  if (!k.subclasses?.length) return '';
  if (lv < (k.subclassLevel || 3)) {
    return `<p class="ps-hint ps-hint--ruim">Je kiest je ${esc(String(k.subclassLabel || 'subclass').toLowerCase())} vanaf ${esc(k.naam)} level ${k.subclassLevel || 3}.</p>`;
  }
  return `
    <div class="ps-subkeuze">
      <div class="ps-subkop">${esc(k.subclassLabel || 'Subclass')}${veld === 'multiSubclass' ? ` · ${esc(k.naam)}` : ''}</div>
      <div class="ps-kaarten ps-kaarten--klein">${k.subclasses.map(s => _kaart({
        naam: s, beeld: k.subBeelden?.[s], icoon: _icoonKlasse(k.naam), aan: s === gekozen,
        actie: veld,
      })).join('')}</div>
    </div>`;
}

function _multiHtml(level) {
  const tweede = klasseVan(P.c.multiKlasse);
  const n = parseInt(P.c.multiKlasseLevel) || 0;
  return `
    <details class="ps-multi"${P.c.multiKlasse ? ' open' : ''}>
      <summary>${ico('users')} Twee classes (multiclass)</summary>
      <div class="ps-multi-body">
        <div class="ps-multi-rij">
          <label class="ps-veld"><span>Tweede class</span>
            <select data-veld="multiKlasse">
              <option value="">— geen —</option>
              ${(P.bronnen.klassen || []).filter(x => x.naam !== P.c.klasse).map(x => `
                <option value="${esc(x.naam)}"${x.naam === P.c.multiKlasse ? ' selected' : ''}>${esc(x.naam)}</option>`).join('')}
            </select></label>
          <label class="ps-veld"><span>Levels daarin</span>
            <input type="number" min="0" max="${level - 1}" value="${n}" data-veld="multiKlasseLevel"></label>
        </div>
        <p class="ps-hint">${esc(_multiTekst(level))}</p>
        ${tweede && n > 0 ? _subHtml(tweede, n, 'multiSubclass', P.c.multiSubclass) : ''}
      </div>
    </details>`;
}

// Wat de verdeling betekent, in woorden. Een getal in een vakje zegt niet dat
// je er drie levels Fighter aan overhoudt.
function _multiTekst(level) {
  const tweede = P.c.multiKlasse;
  const n = Math.max(0, Math.min(level - 1, parseInt(P.c.multiKlasseLevel) || 0));
  if (!tweede || !n) return 'Laat dit leeg als je één class speelt.';
  return `${level - n} level${level - n === 1 ? '' : 's'} ${P.c.klasse || '…'} en ${n} ${tweede}. `
    + 'Je DM ziet of je aan de eisen voldoet voordat hij je personage gunt.';
}

// ── De zes getallen ──────────────────────────────────────────────────────────
function _dezesHtml() {
  const methodes = P.inst.methodes || [];
  if (!methodes.includes(P.c.methode)) P.c.methode = methodes[0] || 'array';
  const m = P.c.methode;
  _scoresIjken(m);
  const kiezer = methodes.length > 1 ? `
    <div class="ps-pillen">${methodes.map(x => `
      <button type="button" class="ps-pil${x === m ? ' is-aan' : ''}" data-actie="methode" data-m="${x}">
        ${x === 'rollen' ? ico('dices') : ''} ${esc(METHODE[x]?.label || x)}</button>`).join('')}</div>` : '';
  return `
    <p class="ps-lead">${esc(METHODE[m]?.lead || '')}</p>
    ${kiezer}
    ${m === 'rollen' ? _rolBlok() : ''}
    ${m === 'pointbuy' ? `<p class="ps-teller${_puntKosten() > PUNTEN_BUDGET ? ' is-op' : ''}" id="ps-punten">Nog
      <strong>${PUNTEN_BUDGET - _puntKosten()}</strong> van de ${PUNTEN_BUDGET} punten.</p>` : ''}
    <div class="ps-stenen" id="ps-stenen">${ABILITIES.map(_steenHtml).join('')}</div>
    ${_bgBonusHtml()}`;
}

// Hoort wat er staat bij de gekozen manier? Zo niet: leg een beginstand neer,
// anders begin je met een scherm dat je eerst zelf moet rechtzetten.
function _scoresIjken(m) {
  const nu = ABILITIES.map(a => parseInt(P.c.scores?.[a]) || 0);
  if (m === 'array' && [...nu].sort((x, y) => y - x).join() !== STANDAARDREEKS.join()) {
    ABILITIES.forEach((a, i) => { P.c.scores[a] = STANDAARDREEKS[i]; });
  }
  if (m === 'pointbuy' && (!nu.every(v => PUNTEN[v] !== undefined) || _puntKosten() > PUNTEN_BUDGET)) {
    ABILITIES.forEach(a => { P.c.scores[a] = 8; });
  }
}
const _puntKosten = () => ABILITIES.reduce((t, a) => t + (PUNTEN[parseInt(P.c.scores?.[a])] ?? 0), 0);
const _worpen = () => (P.c.worpen || []).map(w => (typeof w === 'object' ? w : { totaal: parseInt(w) || 0, stenen: [] }));

function _rolBlok() {
  const worpen = _worpen();
  const gerold = worpen.length === 6;
  const toew = _toewijzing();
  const gebruikt = new Set(Object.values(toew));
  return `
    <div class="ps-worpen" id="ps-worpen">${gerold ? worpen.map((w, i) => `
      <span class="ps-worp${gebruikt.has(i) ? ' is-gebruikt' : ''}" title="${esc(_stenenTitel(w))}">${w.totaal}
        ${w.stenen?.length ? `<span class="ps-stenen-mini">${_stenenMini(w.stenen)}</span>` : ''}</span>`).join('') : ''}</div>
    <div class="ps-rij">
      ${!gerold
        ? `<button type="button" class="ps-knop ps-knop--goud" data-actie="rol">${ico('dices')} Werp de dobbelstenen</button>`
        : P.rerollsOver > 0
          ? `<button type="button" class="ps-knop ps-knop--spook" data-actie="rol">${ico('dices')} Opnieuw werpen (nog ${P.rerollsOver})</button>`
          : `<span class="ps-hint">Wat je rolt, dat is het.</span>`}
    </div>
    ${gerold ? '<p class="ps-hint">Koppel elke worp aan een ability: kies hem in het vakje eronder, dan ruilen ze.</p>' : ''}`;
}
// Welke steen viel af? Die staat gedimd: de laagste van de vier.
function _stenenMini(stenen) {
  const laagste = stenen.indexOf(Math.min(...stenen));
  return stenen.map((s, i) => `<i${i === laagste ? ' class="is-weg"' : ''}>${s}</i>`).join('');
}
const _stenenTitel = (w) => w.stenen?.length ? `4d6: ${w.stenen.join(', ')} — de laagste valt af` : '';

// Welke worp hoort bij welke ability? Dat staat niet apart in het concept: de
// scores zíjn de worpen in een volgorde. Hier wordt het weer een koppeling,
// zodat je kunt ruilen.
function _toewijzing() {
  const worpen = _worpen().map(w => w.totaal);
  const vrij = worpen.map((_, i) => i);
  const uit = {};
  for (const a of ABILITIES) {
    const i = vrij.find(j => worpen[j] === parseInt(P.c.scores?.[a]));
    if (i !== undefined) { uit[a] = i; vrij.splice(vrij.indexOf(i), 1); }
  }
  for (const a of ABILITIES) if (uit[a] === undefined && vrij.length) uit[a] = vrij.shift();
  return uit;
}

function _steenHtml(a) {
  const m = P.c.methode;
  const eigen = parseInt(P.c.scores?.[a]) || 10;
  const tot = _totaal(a);
  const leeg = m === 'rollen' && _worpen().length !== 6;
  let onder = '';
  if (m === 'rollen' && !leeg) {
    const toew = _toewijzing();
    onder = `<select data-steen="${a}" aria-label="Worp voor ${esc(AB_NAAM[a])}">${_worpen().map((w, i) => `
      <option value="${i}"${toew[a] === i ? ' selected' : ''}>${w.totaal}</option>`).join('')}</select>`;
  } else if (m === 'pointbuy') {
    const omhoog = eigen < 15 && _puntKosten() - (PUNTEN[eigen] || 0) + (PUNTEN[eigen + 1] || 0) <= PUNTEN_BUDGET;
    onder = `<div class="ps-stap-rij">
      <button type="button" class="ps-stapknop" data-actie="punt" data-a="${a}" data-d="-1"${eigen <= 8 ? ' disabled' : ''}>−</button>
      <button type="button" class="ps-stapknop" data-actie="punt" data-a="${a}" data-d="1"${omhoog ? '' : ' disabled'}>+</button></div>`;
  } else if (m === 'array') {
    onder = `<select data-steen="${a}" aria-label="${esc(AB_NAAM[a])}">${STANDAARDREEKS.map(o => `
      <option value="${o}"${o === eigen ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
  } else if (m === 'vrij') {
    onder = `<input type="number" min="1" max="30" value="${eigen}" data-steen="${a}" aria-label="${esc(AB_NAAM[a])}">`;
  }
  return `
    <div class="ps-steen${leeg ? ' is-leeg' : ''}" data-ab="${a}">
      <div class="ps-steen-ab">${esc(AB_NAAM[a])}</div>
      <div class="ps-steen-getal">${leeg ? '—' : eigen}</div>
      <div class="ps-steen-totaal">${!leeg && tot !== eigen ? `→ ${tot}` : '&nbsp;'}</div>
      <div class="ps-steen-mod">${teken(abMod(leeg ? 10 : tot))}</div>
      ${onder}
    </div>`;
}

// De verhoging van de background: één +2 en één +1, of drie keer +1. Een
// oudere background noemt geen abilities; dan mag het op elke.
function _bgBonusHtml() {
  const bg = bgVan(P.c.background);
  if (!bg) return '<p class="ps-hint ps-hint--ruim">Kies eerst een background als je zijn verhoging wilt verdelen.</p>';
  const mag = bg.abilities?.length ? bg.abilities : ABILITIES;
  return `
    <div class="ps-bonus">
      <div class="ps-subkop">Verhoging van ${esc(bg.naam)}</div>
      <p class="ps-hint">Geef er één +2 en één +1, of drie keer +1${bg.abilities?.length ? '' : ' — op welke ability je wilt, want deze background noemt er geen'}.</p>
      <div class="ps-bonus-rij">${mag.map(a => `
        <label class="ps-bonus-keuze">${esc(AB_NAAM[a])}
          <select data-bonus="${a}">${[0, 1, 2].map(n => `
            <option value="${n}"${(parseInt(P.c.bgBonus?.[a]) || 0) === n ? ' selected' : ''}>+${n}</option>`).join('')}</select>
        </label>`).join('')}</div>
    </div>`;
}

// ── Skills ───────────────────────────────────────────────────────────────────
function _skillsHtml() {
  const k = klasseVan(P.c.klasse);
  if (!k) return '<p class="ps-lead">Kies eerst een class: die bepaalt uit welke skills je kiest.</p>';
  const bg = bgVan(P.c.background);
  const vast = new Set(bg?.skills || []);
  const bgGekozen = new Set(P.c.bgKeuze?.skills || []);
  const aantal = parseInt(k.basis?.skillAantal) || 0;
  // Een background die je een skill geeft die je class óók aanbiedt, laat er
  // minder over om uit te kiezen. Blijft er te weinig over, dan mag je — zoals
  // het boek zegt — een andere kiezen: dan staan ze er allemaal.
  let uit = k.basis?.skills?.length ? k.basis.skills : Object.keys(SKILLS);
  if (uit.filter(s => !vast.has(s) && !bgGekozen.has(s)).length < aantal) uit = Object.keys(SKILLS);
  const gekozen = new Set((P.c.skills || []).filter(s => !vast.has(s)));
  const over = aantal - gekozen.size;
  const knop = (s, { isVast = false, aan = false, actie = 'skill' } = {}) => `
    <button type="button" class="ps-skill${aan ? ' is-aan' : ''}${isVast ? ' is-vast' : ''}" ${isVast ? 'disabled' : ''}
      data-actie="${actie}" data-naam="${esc(s)}">${ico('check')} ${esc(s)}
      <span class="ps-skill-ab">${esc((AB_NAAM[SKILLS[s]] || '').slice(0, 3))}</span></button>`;
  return `
    ${vast.size ? `<p class="ps-lead">Van <strong>${esc(bg.naam)}</strong> krijg je ${[...vast].map(esc).join(' en ')}.</p>` : ''}
    ${bg?.skillKeuze ? `
      <div class="ps-subkeuze ps-subkeuze--eerst">
        <div class="ps-subkop">${esc(bg.naam)}: kies er ${bg.skillKeuze.aantal === 1 ? 'één' : bg.skillKeuze.aantal}</div>
        <div class="ps-skills">${bg.skillKeuze.uit.map(s => knop(s, { aan: bgGekozen.has(s), actie: 'bgSkill' })).join('')}</div>
      </div>` : ''}
    ${bg?.toolKeuze ? `
      <label class="ps-veld ps-veld--breed"><span>${esc(bg.tool)}</span>
        <input data-veld="bgTool" maxlength="60" value="${esc(P.c.bgKeuze?.tool || '')}" placeholder="Welke wordt het?"></label>` : ''}
    <p class="ps-teller">Nog <strong>${Math.max(0, over)}</strong> te kiezen uit de lijst van je class.</p>
    <div class="ps-skills">${uit.map(s => knop(s, { isVast: vast.has(s) || bgGekozen.has(s), aan: vast.has(s) || bgGekozen.has(s) || gekozen.has(s) })).join('')}</div>`;
}

// ── Spreuken ─────────────────────────────────────────────────────────────────
// Eén blok per bron van spreuken: elke class op zijn eigen level (een Wizard 3
// / Cleric 2 kiest als Wizard 3 en als Cleric 2), plus een feat die ze geeft —
// Magic Initiate uit je background of van onderweg.
function _spreukSecties() {
  const uit = [];
  const meer = _delen().length > 1;
  for (const [k, lv] of _delen()) {
    const t = P.bronnen.tellers?.[k]?.[String(lv)];
    if (!t || (!t.cantrips && !t.voorbereid)) continue;
    const niveaus = Object.entries(P.slotsPer?.[k] || {}).filter(([, s]) => (s?.max || 0) > 0).map(([n]) => Number(n));
    uit.push({ sleutel: k, titel: meer ? `${k} ${lv}` : k, klasse: k, cantrips: t.cantrips || 0, spreuken: t.voorbereid || 0, niveaus });
  }
  for (const f of (P.spreukFeats || [])) {
    uit.push({ sleutel: f.sleutel, titel: f.naam, klasse: f.klasse, cantrips: f.cantrips, spreuken: f.spreuken, niveaus: [1] });
  }
  return uit;
}

function _spreukenVan(sectie) {
  return (P.bronnen.spreuken || []).filter(sp =>
    sp.klassen.some(k => String(k).toLowerCase() === sectie.klasse.toLowerCase())
    && (sp.niveau === 0 ? sectie.cantrips > 0 : sectie.niveaus.includes(sp.niveau)));
}

function _spreukenHtml() {
  // Een concept van vóór deze versie had één platte lijst; die hoort bij zijn
  // eerste class.
  if (!P.c.spreukenPer && (P.c.spreuken || []).length && P.c.klasse) P.c.spreukenPer = { [P.c.klasse]: [...P.c.spreuken] };
  P.c.spreukenPer = P.c.spreukenPer || {};
  return `
    <p class="ps-lead">Je kiest hier wát je kent; wanneer je ze voorbereidt doe je aan tafel.</p>
    ${_zoekVeld('spreuken', 99)}
    ${_spreukSecties().map(sec => {
      const mijn = new Set(P.c.spreukenPer[sec.sleutel] || []);
      const lijst = _gefilterd('spreuken', _spreukenVan(sec), sp => `${sp.naam} ${sp.school}`, null);
      const nC = [...mijn].filter(i => (P.bronnen.spreuken.find(sp => sp.index === i)?.niveau ?? 1) === 0).length;
      const nS = mijn.size - nC;
      const groepen = [0, ...sec.niveaus].filter((n, i, a) => a.indexOf(n) === i && (n > 0 || sec.cantrips > 0));
      return `
        <div class="ps-grimoire">
          <div class="ps-grim-kop">${esc(sec.titel)}
            <span>Nog <b>${Math.max(0, sec.cantrips - nC)}</b> cantrip${sec.cantrips - nC === 1 ? '' : 's'}
              en <b>${Math.max(0, sec.spreuken - nS)}</b> spreuk${sec.spreuken - nS === 1 ? '' : 'en'}</span></div>
          ${groepen.map(n => {
            const hier = lijst.filter(sp => sp.niveau === n).sort((a, b) => a.naam.localeCompare(b.naam));
            if (!hier.length) return '';
            return `
              <div class="ps-grim-groep">${n === 0 ? 'Cantrips' : `Level ${n}`}</div>
              <div class="ps-spreuken">${hier.map(sp => `
                <button type="button" class="ps-spreuk${mijn.has(sp.index) ? ' is-aan' : ''}"
                  style="--school:${SCHOOL_KLEUR[sp.school] || '#8a7050'}"
                  data-actie="spreuk" data-sectie="${esc(sec.sleutel)}" data-index="${esc(sp.index)}" data-niveau="${sp.niveau}">
                  <span class="ps-spreuk-naam">${esc(sp.naam)}</span>
                  <span class="ps-spreuk-school">${esc(sp.school)}</span>
                  <span class="ps-spreuk-vink">${ico('check')}</span>
                </button>`).join('')}</div>`;
          }).join('')}
        </div>`;
    }).join('')}`;
}

// ── Groei ────────────────────────────────────────────────────────────────────
// Op elk ASI-level een Ability Score Improvement (+2 op één, of +1 op twee) óf
// een feat; op level 19 een Epic Boon. De sleutels zijn die van de tijdlijn, dus
// wat je hier kiest staat daar straks gewoon als gekozen.
function _groeiHtml() {
  const feats = P.bronnen.feats || [];
  const lijstAsi = feats.filter(f => f.soort !== 'boon');
  const lijstBoon = feats.filter(f => f.soort === 'boon');
  return `
    <p class="ps-lead">Je begint boven level 1, dus je maakt nu de keuzes die je onderweg had gemaakt.</p>
    <datalist id="ps-feats-asi">${lijstAsi.map(f => `<option value="${esc(f.naam)}">`).join('')}</datalist>
    <datalist id="ps-feats-boon">${lijstBoon.map(f => `<option value="${esc(f.naam)}">`).join('')}</datalist>
    ${(P.groeiSlots || []).map(slot => {
      const g = (P.c.groei || {})[slot.sleutel] || {};
      const isBoon = slot.soort === 'boon';
      const keuze = isBoon ? 'feat' : g.keuze;
      const asi = Object.entries(g.asi || {}).flatMap(([a, n]) => Array(n).fill(a));
      const feat = (isBoon ? lijstBoon : lijstAsi).find(f => f.naam === g.feat);
      const abSelect = (i, waarde) => `<select data-groei="${esc(slot.sleutel)}" data-asi="${i}">
        <option value="">—</option>${ABILITIES.map(a => `<option value="${a}"${waarde === a ? ' selected' : ''}>${esc(AB_NAAM[a])}</option>`).join('')}</select>`;
      return `
        <div class="ps-groei">
          <div class="ps-groei-kop">${ico(isBoon ? 'star' : 'zap')} ${esc(slot.klasse)} level ${slot.level}
            <span>${isBoon ? 'Epic Boon' : 'Ability Score Improvement'}</span></div>
          ${isBoon ? '' : `
            <div class="ps-pillen">
              <button type="button" class="ps-pil${keuze === 'asi' ? ' is-aan' : ''}" data-actie="groeiKeuze" data-sleutel="${esc(slot.sleutel)}" data-k="asi">+2 op je abilities</button>
              <button type="button" class="ps-pil${keuze === 'feat' ? ' is-aan' : ''}" data-actie="groeiKeuze" data-sleutel="${esc(slot.sleutel)}" data-k="feat">Een feat</button>
            </div>`}
          ${keuze === 'asi' ? `
            <div class="ps-groei-rij"><span>+1</span>${abSelect(0, asi[0])}<span>+1</span>${abSelect(1, asi[1])}</div>
            <p class="ps-hint">Twee keer dezelfde is +2. Niet boven de 20.</p>` : ''}
          ${keuze === 'feat' ? `
            <div class="ps-groei-rij">
              <input class="ps-feat-invoer" list="${isBoon ? 'ps-feats-boon' : 'ps-feats-asi'}" data-feat="${esc(slot.sleutel)}"
                value="${esc(g.feat || '')}" placeholder="${isBoon ? 'Zoek een Epic Boon' : 'Zoek een feat'}" autocomplete="off">
              <span>+1</span>
              <select data-groei="${esc(slot.sleutel)}" data-plus="1">
                <option value="">—</option>${ABILITIES.map(a => `<option value="${a}"${g.plus === a ? ' selected' : ''}>${esc(AB_NAAM[a])}</option>`).join('')}</select>
            </div>
            ${feat?.vereist ? `<p class="ps-hint">Vereist: ${esc(feat.vereist)}. Je DM kijkt of dat klopt.</p>` : ''}` : ''}
        </div>`;
    }).join('')}`;
}

// ── Uitrusting ───────────────────────────────────────────────────────────────
function _uitrustingHtml() {
  const bg = bgVan(P.c.background);
  const k = klasseVan(P.c.klasse);
  const mag = String(k?.basis?.armor || '').toLowerCase();
  const harnassen = (P.bronnen.harnassen || []).filter(h =>
    h.soort === 'Armor' && mag.includes(String(h.harnasSoort || '').toLowerCase()));
  const opties = bg?.opties || [];
  const gekozen = P.c.bgOptie || 'A';
  return `
    <p class="ps-lead">Wat je background meegeeft, en wat je zelf uitzoekt uit de uitrusting die de app kent.</p>
    ${opties.length ? `<div class="ps-paar">${opties.map(o => `
      <button type="button" class="ps-paar-knop${o.sleutel === gekozen ? ' is-aan' : ''}" data-actie="bgOptie" data-o="${o.sleutel}">
        <span class="ps-paar-titel">${opties.length === 1 ? 'Wat je meekrijgt' : o.spullen.length ? 'De spullen' : 'Alleen het geld'}</span>
        <span class="ps-paar-onder">${esc([o.spullen.join(', '), o.goud ? `${o.goud} goud` : ''].filter(Boolean).join(' · '))}</span>
      </button>`).join('')}</div>` : '<p class="ps-hint">Zonder background krijg je hier niets mee.</p>'}
    <div class="ps-uit-rij">
      <label class="ps-veld"><span>Een wapen</span>
        <select data-veld="wapen"><option value="">— geen —</option>
          ${(P.bronnen.wapens || []).map(w => `
            <option value="${esc(w.key)}"${w.key === P.c.wapen ? ' selected' : ''}>${esc(w.naam)}${w.schade ? ` (${esc(w.schade)})` : ''}</option>`).join('')}
        </select>
        <span class="ps-hint">Je class mag ${esc(k?.basis?.weapons || 'wat je DM goedvindt')}.</span></label>
      <label class="ps-veld"><span>Een harnas</span>
        <select data-veld="harnas"><option value="">— geen —</option>
          ${harnassen.map(h => `
            <option value="${esc(h.key)}"${h.key === P.c.harnas ? ' selected' : ''}>${esc(h.naam)} (AC ${esc(String(h.ac || ''))})</option>`).join('')}
        </select>
        ${mag.includes('shield') ? `
          <span class="ps-vink"><input type="checkbox" id="ps-schild" data-veld="schild"${P.c.schild ? ' checked' : ''}>
            <label for="ps-schild">En een schild (+2)</label></span>` : ''}</label>
    </div>
    ${P.bronnen.trinketTafel ? `
      <div class="ps-trinket">${P.c.trinket
        ? `<p class="ps-hint">${ico('backpack')} In je zak vond je: <strong>${esc(P.c.trinket)}</strong>.</p>`
        : `<button type="button" class="ps-knop ps-knop--spook" data-actie="trinket">${ico('dices')} Rol op ${esc(P.bronnen.trinketTafel)}</button>
           <span class="ps-hint">Eén worp. Wat eruit komt, hou je.</span>`}</div>` : ''}
    <div class="ps-knapzak">
      <div class="ps-subkop">${ico('backpack')} In je knapzak</div>
      <div class="ps-chips">${_knapzak().map(x => `<span class="ps-chip">${esc(x)}</span>`).join('') || '<span class="ps-hint">nog leeg</span>'}</div>
    </div>`;
}

function _knapzak() {
  const bg = bgVan(P.c.background);
  const o = (bg?.opties || []).find(x => x.sleutel === (P.c.bgOptie || 'A'));
  const item = (key) => [...(P.bronnen.wapens || []), ...(P.bronnen.harnassen || [])].find(i => i.key === key)?.naam;
  return [
    ...(o?.spullen || []), ...(o?.goud ? [`${o.goud} goud`] : []),
    item(P.c.wapen), item(P.c.harnas), P.c.schild ? 'Shield' : '', P.c.trinket,
  ].filter(Boolean);
}

// ── Stem ─────────────────────────────────────────────────────────────────────
// Opnemen met de microfoon of een bestand kiezen. Een opname duurt hooguit
// zes seconden: het is een strijdkreet, geen hoorspel.
function _stemHtml() {
  const opname = (soort) => P.opname?.soort === soort
    ? `<button type="button" class="ps-opname" data-actie="opnameStop">
         <span class="ps-opname-punt"></span><span class="ps-golf">${'<i></i>'.repeat(10)}</span> ${ico('circle-stop')} Stoppen</button>`
    : `<button type="button" class="ps-knop ps-knop--spook" data-actie="neemOp" data-soort="${soort}"${P.opname ? ' disabled' : ''}>${ico('mic')} Neem op</button>
       <label class="ps-knop ps-knop--spook">${ico('upload')} Bestand
         <input type="file" accept="audio/*" hidden data-upload="${soort}"></label>`;
  const clip = ({ label, fileId, wegId }) => `
    <span class="ps-clip">${ico('volume-2')}<span>${esc(label)}</span>
      <button type="button" class="ps-mini" data-actie="speel" data-file="${esc(fileId)}" title="Luisteren">${ico('play')}</button>
      <button type="button" class="ps-mini" data-actie="klankWeg" data-id="${esc(wegId)}" title="Weghalen">${ico('x')}</button></span>`;
  const emotes = P.c.emotes || [];
  return `
    <p class="ps-lead">De tafel hoort deze klanken tijdens het spel. <em>Mag leeg blijven</em> — je DM kan ze ook later toevoegen.</p>
    <div class="ps-stem-blok">
      <div class="ps-subkop">Als jij aan zet bent</div>
      <p class="ps-hint">Eén klank die klinkt zodra het in een gevecht jouw beurt is.</p>
      ${P.c.beurt ? `<div class="ps-chips">${clip({ label: P.c.beurt.label || 'Mijn beurt', fileId: `${P.c.id}_beurt`, wegId: 'beurt' })}</div>` : ''}
      <div class="ps-rij">${opname('beurt')}</div>
    </div>
    <div class="ps-stem-blok">
      <div class="ps-subkop">Emotes <span class="ps-hint">(hooguit ${EMOTE_MAX})</span></div>
      <p class="ps-hint">Korte kreten die je zelf afvuurt: een strijdkreet, een lach, een vloek.</p>
      <div class="ps-chips">${emotes.map(e => clip({ label: e.label, fileId: e.fileId, wegId: e.id })).join('') || '<span class="ps-hint">nog geen</span>'}</div>
      ${emotes.length < EMOTE_MAX ? `
        <div class="ps-rij">
          <input id="ps-emote-naam" class="ps-emote-naam" maxlength="30" placeholder="Naam, bijv. Strijdkreet">
          ${opname('emote')}
        </div>` : ''}
    </div>`;
}

// ── Het blad ─────────────────────────────────────────────────────────────────
// Met een stempel erachter, anders toont de browser na een nieuwe upload het
// oude portret uit zijn cache.
function _vers(url) {
  return P.c.bijgewerkt ? `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(P.c.bijgewerkt)}` : url;
}
function _portretBinnen() {
  if (P.c.video) {
    return `<video src="${esc(_vers(fileUrl(`${P.c.id}_video`)))}" muted autoplay loop playsinline></video>
      <span class="ps-film-badge">${ico('film')}</span>`;
  }
  if (P.c.portret) return `<img src="${esc(_vers(fileUrl(P.c.id)))}" alt="">`;
  return ico('user');
}

function _bladHtml() {
  const c = P.c;
  const p = P.profiel || {};
  const volk = c.species ? (c.speciesVariant ? `${c.speciesVariant} ${c.species}` : c.species) : '';
  const delen = _delen();
  const klasse = delen.length > 1 ? delen.map(([k, l]) => `${k} ${l}`).join(' / ') : c.klasse || '';
  const regel = (dt, v) => `<div class="ps-blad-regel${v ? ' is-in' : ''}"><dt>${esc(dt)}</dt><dd${v ? '' : ' class="is-wacht"'}>${v ? esc(v) : '…'}</dd></div>`;
  const bg = bgVan(c.background);
  const skills = [...(bg?.skills || []), ...(c.bgKeuze?.skills || []), ...(c.skills || [])];
  const nu = _huidig()?.id;
  const zes = !['naam', 'afkomst', 'roeping', 'herkomst'].includes(nu) || P.scherm === 'onthul';
  const stem = [c.beurt ? 'beurt' : '', (c.emotes || []).length ? `${c.emotes.length} emote${c.emotes.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  const verhaal = [String(c.verhaal || '').trim() ? 'verhaal' : '', (c.geheimen || []).length ? `${c.geheimen.length} geheim${c.geheimen.length > 1 ? 'en' : ''}` : ''].filter(Boolean).join(' · ');
  return `
    <div class="ps-blad">
      <div class="ps-blad-portret${c.portret || c.video ? ' is-vol' : ''}">${_portretBinnen()}</div>
      <div class="ps-blad-naam${c.naam ? '' : ' is-leeg'}">${c.naam ? esc(c.naam) : 'nog naamloos'}</div>
      <div class="ps-blad-onder">${esc([volk, klasse, c.klasse ? `level ${c.level || 1}` : ''].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
      <dl class="ps-blad-regels">
        ${regel('Species', volk)}
        ${regel('Class', klasse)}
        ${c.subclass || c.multiSubclass ? regel('Subclass', [c.subclass, c.multiSubclass].filter(Boolean).join(' / ')) : ''}
        ${regel('Background', c.background)}
        ${/* HP en AC rekent de server; zolang hij een andere class kent dan
             die je net aanklikte, is zijn getal van een ander personage. */ ''}
        ${c.klasse && p.klasse === c.klasse && p._hp ? regel('Hit Points', String(p._hp)) : ''}
        ${c.klasse && p.klasse === c.klasse && p.ac ? regel('Armor Class', String(p.ac)) : ''}
        ${skills.length ? regel('Skills', skills.join(', ')) : ''}
        ${verhaal ? regel('Verhaal', verhaal) : ''}
        ${stem ? regel('Stem', stem) : ''}
      </dl>
      ${zes ? `<div class="ps-blad-zes">${ABILITIES.map(a => `
        <div class="ps-pip"><span class="ps-pip-ab">${a}</span><span class="ps-pip-nr">${_totaal(a)}</span>
          <span class="ps-pip-md">${teken(abMod(_totaal(a)))}</span></div>`).join('')}</div>` : ''}
    </div>`;
}

// ── Tekenen ──────────────────────────────────────────────────────────────────
function _voortgang(lijst, i) {
  const pct = lijst.length > 1 ? (i / (lijst.length - 1)) * 100 : 0;
  return `
    <div class="ps-voortgang">
      <div class="ps-vg-rij"><span class="ps-vg-label">Stap ${i + 1} van ${lijst.length}</span>
        <span class="ps-vg-stap">${esc(lijst[i].boven)}</span></div>
      <div class="ps-vg-balk"><div class="ps-vg-vul" style="width:${pct}%"></div>
        ${lijst.map((s, k) => `<button type="button" class="ps-vg-knoop${k < i ? ' is-gehad' : ''}${k === i ? ' is-nu' : ''}"
          style="left:${lijst.length > 1 ? (k / (lijst.length - 1)) * 100 : 0}%" title="${esc(s.boven)}"
          ${k < i ? `data-actie="naarStap" data-id="${s.id}"` : 'tabindex="-1"'}></button>`).join('')}</div>
    </div>`;
}

function _paneelHtml() {
  const lijst = _actief();
  const stap = _huidig();
  const i = lijst.indexOf(stap);
  const laatste = i === lijst.length - 1;
  const kan = stap.kan ? stap.kan() : true;
  return `
    ${_voortgang(lijst, i)}
    <div class="ps-boven">${esc(stap.boven)}</div>
    <h2 class="ps-kop">${esc(stap.kop)}</h2>
    ${P.c.status === 'terug' && P.c.reden ? `
      <div class="ps-let-op ps-let-op--fout"><strong>${ico('mail')} Je DM stuurde hem terug</strong><p>${esc(P.c.reden)}</p></div>` : ''}
    <div class="ps-inhoud" id="ps-inhoud">${stap.html()}</div>
    <div class="ps-voet">
      <button type="button" class="ps-knop ps-knop--spook" data-actie="terug">${ico('chevron-left')} ${i === 0 ? 'Later verder' : 'Terug'}</button>
      <div class="ps-voet-rechts">
        ${stap.optioneel && !laatste ? '<button type="button" class="ps-knop ps-knop--spook" data-actie="verder">Overslaan</button>' : ''}
        <button type="button" class="ps-knop ps-knop--goud" data-actie="verder"${kan ? '' : ' disabled'}>
          ${laatste ? `${ico('check')} Mijn personage is af` : `Verder ${ico('chevron-right')}`}</button>
      </div>
    </div>`;
}

function _drempelHtml() {
  const b = P.bronnen || {};
  const verder = P.c?.naam && (P.c.klasse || P.c.species);
  return `
    <div class="ps-drempel">
      <div class="ps-embleem${b.embleem ? ' ps-embleem--beeld' : ''}">${b.embleem ? `<img src="${esc(b.embleem)}" alt="">` : ico('swords')}</div>
      <div class="ps-fluister">${esc(b.campagneNaam || 'De tafel')} verwacht je</div>
      <h1>${verder ? esc(P.c.naam) : 'Schep een personage'}</h1>
      <div class="ps-sierlijn"><span></span>${ico('sparkles')}<span></span></div>
      <p class="ps-drempel-lead">${verder
        ? 'Hij ligt nog op de werkbank, precies waar je hem liet.'
        : 'Een paar keuzes scheiden je van een naam tussen de portretten. Neem er de tijd voor — dit wordt iemand.'}</p>
      <div class="ps-rij ps-rij--midden">
        <button type="button" class="ps-knop ps-knop--goud ps-knop--groot" data-actie="begin">${ico('feather')} ${verder ? 'Verder' : 'Begin'}</button>
        <button type="button" class="ps-knop ps-knop--donker" data-actie="sluit">Later</button>
      </div>
    </div>`;
}

function _onthulHtml() {
  const c = P.c;
  const p = P.profiel || {};
  const volk = c.species ? (c.speciesVariant ? `${c.speciesVariant} ${c.species}` : c.species) : '';
  const delen = _delen();
  const regel = (dt, v) => v ? `<div class="ps-blad-regel is-in"><dt>${esc(dt)}</dt><dd>${esc(v)}</dd></div>` : '';
  const bg = bgVan(c.background);
  const skills = [...(bg?.skills || []), ...(c.bgKeuze?.skills || []), ...(c.skills || [])];
  const feats = [bg?.feat, ...Object.values(c.groei || {}).filter(g => g.keuze === 'feat' && g.feat).map(g => g.feat)].filter(Boolean);
  const spreuken = (c.spreuken || []).map(i => (P.bronnen.spreuken || []).find(sp => sp.index === i)?.naam).filter(Boolean);
  const fouten = P.nakijk?.fouten || [];
  const opm = P.nakijk?.opmerkingen || [];
  return `
    <div class="ps-onthul">
      <div class="ps-fluister">zo komt hij ter wereld</div>
      <div class="ps-onthul-blad${P.zegel ? ' is-flits' : ''}">
        <div class="ps-onthul-portret">${_portretBinnen()}</div>
        <div class="ps-onthul-naam">${esc(c.naam || 'Naamloos')}</div>
        <div class="ps-onthul-sub">${esc([volk, delen.map(([k, l]) => delen.length > 1 ? `${k} ${l}` : k).join(' / '),
          [c.subclass, c.multiSubclass].filter(Boolean).join(' / ')].filter(Boolean).join(' · '))} · level ${esc(String(c.level || 1))}</div>
        <div class="ps-blad-zes">${ABILITIES.map(a => `
          <div class="ps-pip"><span class="ps-pip-ab">${a}</span><span class="ps-pip-nr">${esc(String(p[a] ?? _totaal(a)))}</span>
            <span class="ps-pip-md">${teken(abMod(p[a] ?? _totaal(a)))}</span></div>`).join('')}</div>
        <dl class="ps-blad-regels">
          ${regel('Hit Points', p._hp != null ? String(p._hp) : '')}${regel('Armor Class', p.ac)}${regel('Hit Dice', p.hitDie)}
          ${regel('Speed', [p.speed, p.flySpeed && `fly ${p.flySpeed}`, p.swimSpeed && `swim ${p.swimSpeed}`].filter(Boolean).join(', '))}
          ${regel('Background', c.background)}${regel('Skills', skills.join(', '))}
          ${regel('Feats', feats.join(', '))}${regel('Spreuken', spreuken.join(', '))}
          ${regel('Knapzak', _knapzak().join(', '))}
          ${(c.geheimen || []).length ? regel('Geheimen', `${c.geheimen.length} — alleen je DM ziet ze`) : ''}
        </dl>
      </div>
      ${fouten.length ? `<div class="ps-let-op ps-let-op--fout"><strong>${ico('x')} Dit moet nog</strong>
        <ul>${fouten.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
      ${opm.length ? `<div class="ps-let-op"><strong>${ico('alert-triangle')} Je DM ziet dit erbij staan</strong>
        <ul>${opm.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
      <div class="ps-lak-kop">${P.zegel ? 'Verzegeld' : fouten.length ? 'Eerst het bovenstaande' : 'Druk het zegel om hem naar je DM te sturen'}</div>
      <button type="button" class="ps-lakzegel${P.zegel ? ' is-gezet' : ''}" data-actie="zegel"${fouten.length || P.zegel ? ' disabled' : ''}
        aria-label="Verzegelen en naar je DM sturen">${ico(P.zegel ? 'check' : 'crown')}</button>
      <div class="ps-rij ps-rij--midden">
        <button type="button" class="ps-knop ps-knop--donker" data-actie="naarStap" data-id="${esc(_actief().slice(-1)[0].id)}">${ico('chevron-left')} Nog iets wijzigen</button>
      </div>
    </div>`;
}

function _klaarHtml() {
  return `
    <div class="ps-klaar">
      <div class="ps-embleem ps-embleem--klein">${ico('check')}</div>
      <h2>${esc(P.c.naam)} ligt bij je DM</h2>
      <p>Zodra hij hem gunt, staat je personage tussen de portretten en kun je met het partywachtwoord inloggen.
        Tot die tijd ziet niemand aan tafel hem — behalve je DM, die ook je geheimen al kent.</p>
      <div class="ps-rij ps-rij--midden">
        <button type="button" class="ps-knop ps-knop--goud" data-actie="sluit">${ico('check')} Sluiten</button>
        <button type="button" class="ps-knop ps-knop--donker" data-actie="intrekken">${ico('pencil')} Toch nog iets wijzigen</button>
      </div>
    </div>`;
}

function _teken() {
  const host = document.getElementById('ps-podium');
  if (!host) return;
  if (P.scherm === 'drempel') host.innerHTML = _drempelHtml();
  else if (P.scherm === 'onthul') host.innerHTML = _onthulHtml();
  else if (P.scherm === 'klaar') host.innerHTML = _klaarHtml();
  else {
    host.innerHTML = `
      <div class="ps-werkbank">
        <div class="ps-blad-wrap" id="ps-blad">${_bladHtml()}</div>
        <div class="ps-paneel" id="ps-paneel">${_paneelHtml()}</div>
      </div>`;
    if (_huidig()?.id === 'naam') document.getElementById('ps-naam')?.focus();
  }
  host.closest('.ps-overlay')?.scrollTo?.({ top: 0 });
}
// Alleen het paneel en het blad, zonder naar boven te springen: voor een klik
// binnen een stap.
function _herteken() {
  const p = document.getElementById('ps-paneel');
  const b = document.getElementById('ps-blad');
  if (!p || !b) return _teken();
  const inhoud = document.getElementById('ps-inhoud');
  const scroll = inhoud?.scrollTop || 0;
  p.innerHTML = _paneelHtml();
  b.innerHTML = _bladHtml();
  const nieuw = document.getElementById('ps-inhoud');
  if (nieuw) nieuw.scrollTop = scroll;
}
// Alleen het blad: bij typen in een veld wil je je cursor houden.
function _bladBij() {
  const b = document.getElementById('ps-blad');
  if (b) b.innerHTML = _bladHtml();
  const verder = document.querySelector('.ps-voet .ps-knop--goud');
  const stap = _huidig();
  if (verder && stap?.kan) verder.disabled = !stap.kan();
}

// ── Bewaren ──────────────────────────────────────────────────────────────────
// Altijd de velden van deze stap, nooit een halve wijziging: de server is de
// waarheid en stuurt het nagerekende blad terug — met wat er door een keuze
// opgeruimd moest worden.
function _neem(r) {
  P.c = r.concept; P.profiel = r.profiel; P.nakijk = r.nakijk;
  P.slotsPer = r.slotsPer || {}; P.groeiSlots = r.groeiSlots || []; P.spreukFeats = r.spreukFeats || [];
  P.rerollsOver = r.rerollsOver ?? 0;
}
async function _bewaar(velden) {
  const data = {};
  for (const v of (velden || [])) if (P.c[v] !== undefined) data[v] = P.c[v];
  _neem(await api.conceptBewaar(P.c.id, data));
}

async function _upload(pad, file, velden = {}) {
  const fd = new FormData();
  // Eerst de tekstvelden, dan het bestand: multer leest ze in die volgorde, en
  // de route kijkt naar `soort` voordat hij weet wat hij met het bestand doet.
  for (const [k, v] of Object.entries(velden)) fd.append(k, v);
  fd.append('file', file);
  const r = await fetch(`/api/personage-concept/${P.c.id}/${pad}?campagne=${encodeURIComponent(huidigeCampagne() || '')}`,
    { method: 'POST', body: fd, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Uploaden mislukt');
  return j;
}

// Een filmpje te lang? Dan speelt hij op de landingspagina maar zes seconden
// (`LANDING_VIDEO_MAX_SEC`); te groot weigeren we vóór het uploaden. De duur
// meet de browser zelf, want op de server staat geen ffmpeg.
function _videoDuur(file) {
  return new Promise((ok) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); ok(v.duration || 0); };
    v.onerror = () => ok(0);
    v.src = URL.createObjectURL(file);
  });
}

// ── Opnemen ──────────────────────────────────────────────────────────────────
async function _neemOp(soort) {
  if (P.opname) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    toast('Opnemen kan in deze browser niet. Kies een geluidsbestand.');
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast('Geen toegang tot de microfoon.'); return; }
  const rec = new MediaRecorder(stream);
  const stukken = [];
  const label = soort === 'emote' ? (document.getElementById('ps-emote-naam')?.value || '').trim() : 'Mijn beurt';
  rec.ondataavailable = (e) => { if (e.data?.size) stukken.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    clearTimeout(P.opname?.tot);
    P.opname = null;
    // `audio/webm;codecs=opus` staat niet letterlijk in de lijst van de
    // server, en dan weigert de upload stil. Het kale type wel.
    const type = String(rec.mimeType || stukken[0]?.type || 'audio/webm').split(';')[0];
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File(stukken, `opname.${ext}`, { type });
    if (!file.size) { _herteken(); return; }
    await _klankUpload(soort, file, label || `Opname ${(P.c.emotes || []).length + 1}`);
  };
  rec.start();
  P.opname = { soort, rec, tot: setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, OPNAME_MAX_SEC * 1000) };
  _herteken();
}

async function _klankUpload(soort, file, label) {
  try {
    const j = await _upload('emote', file, { soort: soort === 'beurt' ? 'beurt' : '', label });
    P.c.emotes = j.emotes || P.c.emotes || [];
    if (soort === 'beurt') P.c.beurt = j.beurt;
  } catch (e) { toast(e.message); }
  _herteken();
}

// ── Wat een klik doet ────────────────────────────────────────────────────────
const ACTIES = {
  begin() { P.scherm = 'maken'; _teken(); },
  sluit() { window.personageMaken.sluit(); },

  async terug() {
    if (P.bezig) return;
    const lijst = _actief();
    const i = lijst.indexOf(_huidig());
    P.bezig = true;
    try { await _bewaar(_huidig().velden); } catch { /* terug mag altijd */ }
    P.bezig = false;
    if (i <= 0) { window.personageMaken.sluit(); return; }
    // Bestaat de vorige stap na het bewaren niet meer (een grimoire die
    // verdween omdat je toch geen caster werd), dan de stap daarvóór.
    const nu = _actief();
    P.stapId = lijst.slice(0, i).reverse().find(s => nu.includes(s))?.id || nu[0].id;
    _teken();
  },

  async verder() {
    if (P.bezig) return;
    P.bezig = true;
    try {
      const nu = _huidig();
      await _bewaar(nu.velden);
      // Na het bewaren kan de lijst veranderd zijn: een caster krijgt een
      // grimoire, een hoger level een groeistap. Dus opnieuw kijken.
      const lijst = _actief();
      const i = lijst.findIndex(s => s.id === nu.id);
      if (i === lijst.length - 1) { P.scherm = 'onthul'; P.zegel = false; }
      else P.stapId = lijst[i + 1].id;
      _teken();
    } catch (e) { toast('Opslaan lukte niet: ' + (e.message || e)); }
    finally { P.bezig = false; }
  },

  async naarStap(d) {
    if (P.bezig) return;
    if (P.scherm === 'maken') { try { await _bewaar(_huidig().velden); } catch { /* ok */ } }
    P.scherm = 'maken'; P.stapId = d.id; _teken();
  },

  species(d) { if (P.c.species !== d.naam) P.c.speciesVariant = ''; P.c.species = d.naam; _herteken(); },
  variant(d) { P.c.speciesVariant = P.c.speciesVariant === d.naam ? '' : d.naam; _herteken(); },
  klasse(d) {
    if (P.c.klasse !== d.naam) {
      P.c.subclass = ''; P.c.skills = [];
      if (P.c.multiKlasse === d.naam) { P.c.multiKlasse = ''; P.c.multiKlasseLevel = 0; P.c.multiSubclass = ''; }
    }
    P.c.klasse = d.naam; _herteken();
  },
  subclass(d) { P.c.subclass = P.c.subclass === d.naam ? '' : d.naam; _herteken(); },
  multiSubclass(d) { P.c.multiSubclass = P.c.multiSubclass === d.naam ? '' : d.naam; _herteken(); },
  background(d) {
    if (P.c.background !== d.naam) {
      P.c.bgBonus = {}; P.c.bgKeuze = {}; P.c.bgOptie = 'A';
      const vast = new Set(bgVan(d.naam)?.skills || []);
      P.c.skills = (P.c.skills || []).filter(s => !vast.has(s));
    }
    P.c.background = P.c.background === d.naam ? '' : d.naam; _herteken();
  },

  methode(d) {
    P.c.methode = d.m;
    if (d.m === 'array') ABILITIES.forEach((a, i) => { P.c.scores[a] = STANDAARDREEKS[i]; });
    if (d.m === 'pointbuy') ABILITIES.forEach(a => { P.c.scores[a] = 8; });
    if (d.m === 'rollen' && _worpen().length === 6) {
      const w = _worpen(); ABILITIES.forEach((a, i) => { P.c.scores[a] = w[i].totaal; });
    }
    _herteken();
  },

  // Zes keer 4d6 op de server, met een korte tuimeling zodat je ziet dát er
  // gegooid wordt — aan tafel kijkt iedereen mee.
  async rol() {
    if (P.rolt) return;
    P.rolt = true;
    const doos = document.getElementById('ps-worpen');
    let tik = null;
    if (doos && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doos.innerHTML = Array.from({ length: 6 }, () => '<span class="ps-worp is-rollend">?</span>').join('');
      tik = setInterval(() => doos.querySelectorAll('.ps-worp').forEach(s => { s.textContent = 3 + Math.floor(Math.random() * 16); }), 70);
    }
    try {
      await _bewaar(['methode', 'bgBonus']);
      const r = await api.post(`/personage-concept/${P.c.id}/rol`, {});
      await new Promise(ok => setTimeout(ok, tik ? 650 : 0));
      _neem(r);
    } catch (e) { toast(e.message || 'Rollen lukte niet'); }
    finally { clearInterval(tik); P.rolt = false; _herteken(); }
  },

  punt(d) {
    const v = (parseInt(P.c.scores[d.a]) || 8) + parseInt(d.d);
    if (v < 8 || v > 15) return;
    const na = ABILITIES.reduce((t, x) => t + (PUNTEN[x === d.a ? v : P.c.scores[x]] ?? 0), 0);
    if (na > PUNTEN_BUDGET) return;
    P.c.scores[d.a] = v; _herteken();
  },

  skill(d) {
    const k = klasseVan(P.c.klasse);
    const aantal = parseInt(k?.basis?.skillAantal) || 0;
    const vast = new Set(bgVan(P.c.background)?.skills || []);
    const nu = new Set((P.c.skills || []).filter(s => !vast.has(s)));
    if (nu.has(d.naam)) nu.delete(d.naam);
    else if (nu.size < aantal) nu.add(d.naam);
    else { toast(`Je class kiest er ${aantal}.`); return; }
    P.c.skills = [...nu]; _herteken();
  },
  bgSkill(d) {
    const bg = bgVan(P.c.background);
    const max = bg?.skillKeuze?.aantal || 1;
    let nu = [...(P.c.bgKeuze?.skills || [])];
    if (nu.includes(d.naam)) nu = nu.filter(s => s !== d.naam);
    else nu = [...nu, d.naam].slice(-max);
    P.c.bgKeuze = { ...(P.c.bgKeuze || {}), skills: nu };
    // Wat je background nu geeft, hoef je niet ook nog bij je class te kiezen.
    P.c.skills = (P.c.skills || []).filter(s => !nu.includes(s));
    _herteken();
  },

  spreuk(d) {
    const sec = _spreukSecties().find(s => s.sleutel === d.sectie);
    if (!sec) return;
    P.c.spreukenPer = P.c.spreukenPer || {};
    const nu = new Set(P.c.spreukenPer[sec.sleutel] || []);
    const isC = (i) => (P.bronnen.spreuken.find(sp => sp.index === i)?.niveau ?? 1) === 0;
    if (nu.has(d.index)) nu.delete(d.index);
    else {
      const cantrip = parseInt(d.niveau) === 0;
      const max = cantrip ? sec.cantrips : sec.spreuken;
      if ([...nu].filter(i => isC(i) === cantrip).length >= max) {
        toast(`${cantrip ? 'Cantrips' : 'Spreuken'}: je kiest er ${max}.`); return;
      }
      nu.add(d.index);
    }
    P.c.spreukenPer[sec.sleutel] = [...nu]; _herteken();
  },

  groeiKeuze(d) {
    P.c.groei = P.c.groei || {};
    P.c.groei[d.sleutel] = d.k === 'asi' ? { keuze: 'asi', asi: {} } : { keuze: 'feat', feat: '' };
    _herteken();
  },

  bgOptie(d) { P.c.bgOptie = d.o; _herteken(); },
  async trinket() {
    try {
      const r = await api.conceptTrinket(P.c.id);
      P.c.trinket = r.trinket; _herteken();
    } catch (e) { toast(e.message || 'Rollen lukte niet'); }
  },

  geheim() {
    const inp = document.getElementById('ps-geheim-in');
    const t = (inp?.value || '').trim();
    if (!t) return;
    P.c.geheimen = [...(P.c.geheimen || []), { tekst: t }];
    _herteken();
    document.getElementById('ps-geheim-in')?.focus();
  },
  geheimWeg(d) { P.c.geheimen = (P.c.geheimen || []).filter((_, i) => i !== parseInt(d.i)); _herteken(); },

  async videoWeg() {
    try { await api.delete(`/personage-concept/${P.c.id}/video`); P.c.video = false; } catch (e) { toast(e.message); }
    _herteken();
  },

  neemOp(d) { _neemOp(d.soort); },
  opnameStop() { if (P.opname?.rec?.state === 'recording') P.opname.rec.stop(); },
  speel(d) { try { new Audio(fileUrl(d.file)).play().catch(() => {}); } catch { /* stil */ } },
  async klankWeg(d) {
    try {
      const r = await api.delete(`/personage-concept/${P.c.id}/emote/${encodeURIComponent(d.id)}`);
      P.c.emotes = r.emotes || [];
      if (d.id === 'beurt') P.c.beurt = null;
    } catch (e) { toast(e.message || 'Lukt niet'); }
    _herteken();
  },

  async zegel() {
    if (P.zegel || P.bezig) return;
    P.bezig = true;
    try {
      _neem(await api.conceptIndienen(P.c.id));
      P.zegel = true; _teken();
      setTimeout(() => { P.scherm = 'klaar'; _teken(); }, 1200);
    } catch (e) {
      toast(e.message || 'Versturen lukte niet');
      try { _neem(await api.conceptMijn()); } catch { /* ok */ }
      _teken();
    } finally { P.bezig = false; }
  },

  // Ligt hij al bij de DM en wil je toch iets veranderen, dan trekt dat hem
  // terug: anders gunt de DM iets anders dan wat hij las.
  async intrekken() {
    if (!confirm('Dan haal je hem terug bij je DM tot je hem opnieuw verzegelt. Doorgaan?')) return;
    try { _neem(await api.conceptBewaar(P.c.id, {})); } catch (e) { toast(e.message); return; }
    P.scherm = 'maken'; P.stapId = _actief()[0].id; _teken();
  },
};

// Velden die je typt of kiest. Typen werkt het blad bij zonder het paneel te
// hertekenen, anders verlies je je cursor.
function _invoer(e) {
  const el = e.target;
  if (el.dataset.zoek !== undefined) {
    P.zoek[el.dataset.zoek] = el.value;
    const pos = el.selectionStart;
    _herteken();
    const nieuw = document.querySelector(`[data-zoek="${el.dataset.zoek}"]`);
    if (nieuw) { nieuw.focus(); try { nieuw.setSelectionRange(pos, pos); } catch { /* ok */ } }
    return;
  }
  const veld = el.dataset.veld;
  if (!veld) return;
  if (veld === 'naam') { P.c.naam = el.value; _bladBij(); return; }
  if (veld === 'verhaal') { P.c.verhaal = el.value; _bladBij(); return; }
  if (veld === 'bgTool') { P.c.bgKeuze = { ...(P.c.bgKeuze || {}), tool: el.value }; return; }
}

function _wijziging(e) {
  const el = e.target;
  const d = el.dataset;
  if (d.upload) { _bestand(d.upload, el.files?.[0], el); return; }
  if (d.steen) {
    const a = d.steen;
    if (P.c.methode === 'rollen') {
      // Ruilen: de worp die je kiest stond ergens anders; die krijgt de jouwe.
      const toew = _toewijzing();
      const idx = parseInt(el.value);
      const ander = ABILITIES.find(x => x !== a && toew[x] === idx);
      const w = _worpen();
      if (ander) P.c.scores[ander] = w[toew[a]].totaal;
      P.c.scores[a] = w[idx].totaal;
    } else if (P.c.methode === 'array') {
      const nieuw = parseInt(el.value) || 10;
      const ander = ABILITIES.find(x => x !== a && parseInt(P.c.scores[x]) === nieuw);
      if (ander) P.c.scores[ander] = parseInt(P.c.scores[a]) || 10;
      P.c.scores[a] = nieuw;
    } else {
      P.c.scores[a] = Math.max(1, Math.min(30, parseInt(el.value) || 10));
    }
    _herteken(); return;
  }
  if (d.bonus) {
    const v = parseInt(el.value) || 0;
    P.c.bgBonus = { ...(P.c.bgBonus || {}) };
    if (v) P.c.bgBonus[d.bonus] = v; else delete P.c.bgBonus[d.bonus];
    _herteken(); return;
  }
  if (d.groei) {
    P.c.groei = P.c.groei || {};
    const g = P.c.groei[d.groei] || {};
    if (d.asi !== undefined) {
      const lijst = Object.entries(g.asi || {}).flatMap(([x, n]) => Array(n).fill(x));
      lijst[parseInt(d.asi)] = el.value;
      const asi = {};
      for (const x of lijst.filter(Boolean)) asi[x] = (asi[x] || 0) + 1;
      P.c.groei[d.groei] = { keuze: 'asi', asi };
    } else if (d.plus) {
      P.c.groei[d.groei] = { ...g, keuze: 'feat', plus: el.value || '' };
    }
    _herteken(); return;
  }
  if (d.feat) {
    // Een feat moet bestaan: met een zoekveld kun je alles intikken, en een
    // typefout hoort niet als feat op je blad te belanden.
    const naam = el.value.trim();
    const f = (P.bronnen.feats || []).find(x => x.naam.toLowerCase() === naam.toLowerCase());
    P.c.groei = P.c.groei || {};
    const g = P.c.groei[d.feat] || { keuze: 'feat' };
    if (naam && !f) { el.classList.add('is-fout'); setTimeout(() => el.classList.remove('is-fout'), 1200); return; }
    P.c.groei[d.feat] = { ...g, keuze: 'feat', feat: f?.naam || '' };
    _herteken(); return;
  }
  const veld = d.veld;
  if (!veld) return;
  if (veld === 'level') {
    const max = P.inst?.maxLevel || 1;
    P.c.level = Math.max(1, Math.min(max, parseInt(el.value) || 1));
    el.value = P.c.level;
    if ((parseInt(P.c.multiKlasseLevel) || 0) > P.c.level - 1) P.c.multiKlasseLevel = Math.max(0, P.c.level - 1);
    _bladBij(); return;
  }
  if (veld === 'multiKlasse') {
    P.c.multiKlasse = el.value; P.c.multiSubclass = '';
    if (!el.value) P.c.multiKlasseLevel = 0;
    else if (!(parseInt(P.c.multiKlasseLevel) > 0)) P.c.multiKlasseLevel = 1;
    _herteken(); return;
  }
  if (veld === 'multiKlasseLevel') {
    const level = parseInt(P.c.level) || 1;
    P.c.multiKlasseLevel = Math.max(0, Math.min(level - 1, parseInt(el.value) || 0));
    if (!P.c.multiKlasseLevel) P.c.multiSubclass = '';
    _herteken(); return;
  }
  if (veld === 'schild') { P.c.schild = el.checked; _herteken(); return; }
  if (['wapen', 'harnas'].includes(veld)) { P.c[veld] = el.value; _herteken(); return; }
}

async function _bestand(soort, file, invoer) {
  if (!file) return;
  try {
    if (soort === 'portret') {
      await _upload('portret', file);
      P.c.portret = true; P.c.bijgewerkt = new Date().toISOString();
    } else if (soort === 'video') {
      if (file.size > VIDEO_MAX_BYTES) { toast('Dat filmpje is groter dan 8 MB.'); return; }
      const duur = await _videoDuur(file);
      await _upload('video', file);
      P.c.video = true; P.c.bijgewerkt = new Date().toISOString();
      if (duur > 6.5) toast(`Je filmpje duurt ${Math.round(duur)} seconden; op de landingspagina speelt hij er zes.`);
    } else if (soort === 'beurt' || soort === 'emote') {
      const label = soort === 'emote' ? (document.getElementById('ps-emote-naam')?.value || '').trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 30) : 'Mijn beurt';
      await _klankUpload(soort, file, label);
      return;
    }
  } catch (e) { toast(e.message || 'Uploaden mislukt'); }
  finally { if (invoer) invoer.value = ''; }
  _herteken();
}

function _open(scherm) {
  let el = document.getElementById('pm-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pm-overlay';
    el.className = 'ps-overlay';
    el.innerHTML = '<div class="ps-podium" id="ps-podium"></div>';
    el.addEventListener('click', (e) => {
      const knop = e.target.closest('[data-actie]');
      if (!knop || knop.disabled || !el.contains(knop)) return;
      ACTIES[knop.dataset.actie]?.({ ...knop.dataset }, knop);
    });
    el.addEventListener('input', _invoer);
    el.addEventListener('change', _wijziging);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'ps-geheim-in') { e.preventDefault(); ACTIES.geheim(); }
    });
    document.body.appendChild(el);
  }
  document.body.classList.add('wizard-open');
  P.scherm = scherm;
  _teken();
}

function _laad(r) {
  _neem(r);
  P.bronnen = r.bronnen; P.inst = r.instellingen;
  P.stapId = STAPPEN[0].id; P.zoek = {}; P.zegel = false;
}

// ── Naar buiten ──────────────────────────────────────────────────────────────
window.personageMaken = {
  // Beginnen vanaf de landingspagina. Het partywachtwoord is de drempel — wie
  // dat heeft zit aan tafel.
  async start(wachtwoord, naam = '') {
    try {
      _laad(await api.conceptStart(wachtwoord, naam));
      _open('drempel');
    } catch (e) {
      toast(e.message || 'Dat lukte niet');
      throw e;
    }
  },

  // Verder met wat er al lag. De sessie weet welk concept van jou is. Ligt hij
  // al bij de DM, dan zie je dat — en kun je hem nog terughalen.
  async hervat() {
    const r = await api.conceptMijn();
    if (!r.concept) return false;
    _laad(r);
    _open(r.concept.status === 'wacht' ? 'klaar' : 'drempel');
    return true;
  },

  // Staat er iets klaar, en zo ja hoe heet het? De landingspagina vraagt dit
  // om "+ Nieuw personage" of "Verder met Brigitta" te kunnen zetten.
  async stand() {
    try { return await api.conceptMijn(); } catch { return { concept: null }; }
  },

  sluit() {
    if (P.opname?.rec?.state === 'recording') P.opname.rec.stop();
    document.getElementById('pm-overlay')?.remove();
    document.body.classList.remove('wizard-open');
  },
};

export { STAPPEN };
