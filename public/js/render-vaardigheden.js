/**
 * render-vaardigheden.js — Archief-tab "Heldenboek": waar een personage uit bestaat.
 *
 * Class features, subclass features, species traits, feats, epic boons en
 * backgrounds, doorzoekbaar als bibliotheek. De progressie-tab toont dezelfde
 * dingen, maar alleen langs de tijdlijn van één personage: je ziet er pas iets
 * als jouw level het ontsluit. Juist bij het kíézen (welke feat neem ik op 4?)
 * wil je ze alle zestig naast elkaar — vandaar deze tab.
 *
 * Zelfde machinerie als de spreukenbibliotheek: dezelfde drie zoekbakken
 * (naam / korte velden / tekst), een permanent open filterbalk en `.entity-card`
 * als kaartje. De teksten komen uit `naslagBron()` in render-progressie.js, dus
 * er is één plek die weet waar een beschrijving vandaan komt: eerst wat de DM
 * zelf schreef, dan de SRD, en anders een verwijzing naar buiten.
 */

import { api } from './api.js?v=310';
import { naslagBron } from './render-progressie.js?v=62';

const esc  = s => window.app?.esc?.(s) ?? String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon = (...a) => window.icon(...a);
const isDM = () => !!window.app?.isDM?.();

// De zes soorten, elk met een eigen kleur en icoon — dezelfde rol als de
// scholen bij de spreuken: de indeling waarin je zoekt.
const SOORTEN = {
  class:      { label: 'Class',     icon: 'sword',          c1: '#4a1000', c2: '#a03810' },
  subclass:   { label: 'Subclass',  icon: 'star',           c1: '#200c4e', c2: '#5a2e8a' },
  species:    { label: 'Species',   icon: 'user',           c1: '#0a3020', c2: '#1a6a50' },
  feat:       { label: 'Feat',      icon: 'zap',            c1: '#0c2248', c2: '#1e4a8a' },
  boon:       { label: 'Epic Boon', icon: 'sparkles',       c1: '#301800', c2: '#7a4a08' },
  background: { label: 'Background',icon: 'scroll-text',    c1: '#4a082e', c2: '#962058' },
  // Een zegening is een soort boon: iets wat je van de wereld krijgt in plaats
  // van iets wat je bij een level-up kiest. Ze stonden tussen de voorwerpen,
  // en daar waren ze met 98 van de 249 kaartjes de grootste groep terwijl je
  // ze er nooit zocht.
  //
  // **Het zijn en blijven voorwerp-kaartjes.** Alleen de plek waar je ze vindt
  // verhuist; de tempel leidt zijn pantheon er nog steeds uit af, een factie
  // geeft ze nog steeds als rangbeloning, ze staan nog steeds in de boedel en
  // ze blijven onverkoopbaar. Zou de soort zelf veranderen, dan moest dat
  // allemaal opnieuw gelegd worden — en dat merk je pas aan tafel.
  zegen:      { label: 'Zegening',  icon: 'sparkles',       c1: '#3a2a00', c2: '#9a7008' },
  gunst:      { label: 'Gunst',     icon: 'star',           c1: '#2a1030', c2: '#7a2a80' },
};
// Een icoon per class en per species. De soort bepaalt de kleur van het
// kaartje (dat is waar het filter op staat), het icoon zegt wáárvan het is —
// een Barbarian-feature hoort er anders uit te zien dan een Wizard-feature.
// Alles komt uit de bestaande sprite; er is niets bij getekend.
const KLASSE_ICOON = {
  Barbarian: 'hand-fist',  Bard: 'music',        Cleric: 'church',
  Druid: 'tree-pine',      Fighter: 'swords',    Monk: 'hand',
  Paladin: 'shield-plus',  Ranger: 'bow-arrow',  Rogue: 'stiletto',
  Sorcerer: 'flame',       Warlock: 'eye',       Wizard: 'book-open',
  Artificer: 'hammer',
};
const SPECIES_ICOON = {
  Human: 'user',        Elf: 'sparkle',       Dwarf: 'pickaxe',
  Halfling: 'house',    Dragonborn: 'flame',  Gnome: 'flask-conical',
  Orc: 'shield-half',   Tiefling: 'ghost',    Goliath: 'mountain',
  Aasimar: 'sparkles',  Aarakocra: 'wind',    Tabaxi: 'paw-print',
  'Half-Elf': 'users',
};
// Het icoon van één regel: klasse of species als we die kennen, anders het
// icoon van de soort.
function _itemIcoon(it) {
  if (it.soort === 'class' || it.soort === 'subclass') return KLASSE_ICOON[it.bron] || SOORTEN[it.soort].icon;
  if (it.soort === 'species') return SPECIES_ICOON[it.bron] || SOORTEN.species.icon;
  return SOORTEN[it.soort]?.icon || 'hexagon';
}

// Zelfde drie woorden als bij de spreuken: het is een aantekening van de DM,
// geen mechaniek — maar wel de enige plek waar staat wat overgeschreven is uit
// andermans boek en dus niet mee de deur uit mag.
const HERKOMST = [
  { value: '',             label: '— niet ingevuld —' },
  { value: 'zelfbedacht',  label: 'Zelf verzonnen' },
  { value: 'aangepast',    label: 'Aangepast uit ander materiaal' },
  { value: 'overgenomen',  label: 'Overgenomen uit ander materiaal' },
];
const HERKOMST_LABEL = { zelfbedacht: 'Zelf verzonnen', aangepast: 'Aangepast', overgenomen: 'Overgenomen' };

const SOORT_VOLGORDE = ['class', 'subclass', 'species', 'feat', 'boon', 'zegen', 'gunst', 'background'];

let _all        = null;   // null = nog niet geladen
let _bron       = null;   // wat naslagBron() teruggaf (srdDesc, md, …)
let _container  = null;
// `sub` is de subklasse waarop je bent ingezoomd; `bron` de klasse, het volk of
// de achtergrond erboven. Samen vormen ze de keten die de band bovenaan toont.
let _filters    = { q: '', soort: null, bron: null, sub: null, level: null };
let _bronnen    = [];     // klassen, soorten en backgrounds die er zijn
let _levelsOpen = false;  // staat de levelrij uitgeklapt?

// ── Laden ─────────────────────────────────────────────────────────
// Eén platte lijst: elk item weet zijn soort, waar het bij hoort en op welk
// level het komt. Dat is alles wat het kaartje, het filter en het zoeken nodig
// hebben; de detailweergave haalt de tekst pas op als je erop klikt.
// Zoeken in de vaardighedenbibliotheek, voor wie er alleen iets uit wil halen.
// Gebouwd voor de kenmerk-zoeker op het spelerstabblad: die haalde zijn lijst
// **live op bij dnd5eapi.co** — een externe host in het pad van een speler
// midden in een sessie, en de editie van 2014. Precies wat we bij de monsters al
// hadden weggehaald. Nu komt hij uit dezelfde bron als de tijdlijn en deze
// bibliotheek, dus: offline, 2024, en met dezelfde namen en teksten.
//
// `eigen` (klasse, subklasse, volk, background) zet wat bij jóu hoort bovenaan —
// een Wizard die "ac" typt hoort niet eerst Action Surge te zien.
// ════════════════════════════════════════════════════════════════════════════
//  DE TEKST VAN ÉÉN FEATURE, UIT HET HELDENBOEK
// ════════════════════════════════════════════════════════════════════════════
// Wat bij een speler onder Features staat is de **neerslag** van het
// heldenboek, niet een tweede bron. Tot nu toe werd de tekst bij een level-up
// één keer overgeschreven naar het spelersblad; paste de DM hem daarna aan in
// het heldenboek, dan bleef de speler de oude lezen. Twee keer dezelfde tekst,
// en ze liepen uit elkaar.
//
// Deze functie zoekt hem op het moment van lezen op. `meta` is de regel die al
// bij het kenmerk staat ("Barbarian · Lv. 3", "Path of the Berserker · Lv. 3"):
// daarmee kiezen we de juiste als twee klassen een feature met dezelfde naam
// hebben — Extra Attack staat bij vijf klassen.
//
// Geen treffer? Dan geeft hij null terug en valt de aanroeper terug op wat er
// bij de speler was opgeslagen. Niemand verliest tekst doordat een feature
// hernoemd of weggehaald is.
export async function heldenboekTekst(naam, meta = '') {
  const n = String(naam || '').trim();
  if (!n) return null;
  let treffers = [];
  try { treffers = await zoekVaardigheden(n, {}, 12); } catch { return null; }
  const gelijk = treffers.filter(t => String(t.naam || '').toLowerCase() === n.toLowerCase());
  if (!gelijk.length) return null;

  // "Barbarian · Lv. 3" → de brokken waarop we mogen matchen.
  const delen = String(meta || '').split('·').map(d => d.trim()).filter(Boolean);
  const lvl   = (delen.map(d => /^Lv\.\s*(\d+)$/.exec(d)).find(Boolean) || [])[1];
  const herkomst = delen.filter(d => !/^Lv\.\s*\d+$/.test(d)).map(d => d.toLowerCase());

  const past = (t) => {
    if (lvl && String(t.level || '') !== String(lvl)) return false;
    if (!herkomst.length) return true;
    return herkomst.some(h => String(t.bron || '').toLowerCase() === h
                           || String(t.sub || '').toLowerCase() === h);
  };
  const raak = gelijk.find(past) || gelijk.find(t => !lvl || String(t.level || '') === String(lvl)) || gelijk[0];
  return raak?.desc ? raak.desc : null;
}

export async function zoekVaardigheden(query, eigen = {}, limiet = 12) {
  const alles = await _load();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const norm = t => String(t || '').trim().toLowerCase();
  const mijn = new Set([eigen.klasse, eigen.multiKlasse, eigen.species, eigen.background].filter(Boolean).map(norm));
  const mijnSub = new Set([eigen.subclass, eigen.multiSubclass].filter(Boolean).map(norm));

  return alles
    .filter(it => norm(it.naam).includes(q))
    .map(it => {
      // Van jou als de klasse/het volk klopt; een subklasse alleen als jij die
      // subklasse hebt — anders is "Channel Divinity: Sacred Weapon" van jou
      // zodra je Cleric bent, terwijl dat een Paladin-feature is.
      const vanMij = it.soort === 'subclass'
        ? mijnSub.has(norm(it.sub))
        : (it.soort === 'feat' || it.soort === 'boon') ? false : mijn.has(norm(it.bron));
      return { ...it, vanMij };
    })
    .sort((a, b) => (b.vanMij - a.vanMij) || a.naam.localeCompare(b.naam))
    .slice(0, limiet);
}

async function _load() {
  if (_all) return _all;
  _bron = await naslagBron();
  const prog = _bron.prog || {};
  const uit  = [];
  const zet = (o) => { uit.push({ ...o, key: `${o.soort}|${o.bron}|${o.level}|${o.naam}` }); };

  for (const [klasse, data] of Object.entries(prog.classes || {})) {
    for (const [lvl, fs] of Object.entries(data.levels || {})) {
      for (const f of (fs || [])) zet({ soort: 'class', bron: klasse, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', bronTekst: f.bron || '' });
    }
    for (const [sub, sdata] of Object.entries(data.subclasses || {})) {
      for (const [lvl, fs] of Object.entries(sdata.levels || {})) {
        for (const f of (fs || [])) zet({ soort: 'subclass', bron: klasse, sub, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', bronTekst: f.bron || '' });
      }
    }
  }
  for (const [soort, data] of Object.entries(prog.species || {})) {
    for (const [lvl, fs] of Object.entries(data.levels || {})) {
      for (const f of (fs || [])) zet({ soort: 'species', bron: soort, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', bronTekst: f.bron || '' });
    }
  }
  for (const f of (_bron.feats?.general || [])) zet({ soort: 'feat', bron: 'Feats',      level: 0, naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', bronTekst: f.bron || '', sluitAan: f.sluitAan || [], vereist: f.vereist || '', geeftSpreuk: f.geeftSpreuk || [] });
  for (const f of (_bron.feats?.epic    || [])) zet({ soort: 'boon', bron: 'Epic Boons', level: 0, naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', bronTekst: f.bron || '', sluitAan: f.sluitAan || [], vereist: f.vereist || '', geeftSpreuk: f.geeftSpreuk || [] });
  // Een background is één ding met vijf onderdelen (Ability Scores, Feat,
  // Skill Proficiencies, Tool Proficiency, Equipment). Als losse kaartjes krijg
  // je zestien keer "Ability Scores" in de lijst; als één kaartje per background
  // zoek je waar je op zoekt — de naam van de achtergrond.
  for (const [bg, data] of Object.entries(_bron.backgrounds || {})) {
    const delen = Object.values(data.levels || {}).flat().filter(Boolean);
    if (!delen.length) continue;
    zet({
      soort: 'background', bron: 'Backgrounds', level: 0, naam: bg,
      desc: delen.map(f => `**${f.name}.** ${f.desc || ''}`.trim()).join('\n\n'),
    });
  }

  // ── Zegeningen en gunsten ──
  // Die liggen niet in de progressie maar als kaartjes in de campagne, dus die
  // komen van het andere eind. `listEntities` zeeft al op rol en party: een
  // speler krijgt alleen wat hij mag zien, en dat hoeft hier dus niet nog eens.
  try {
    const voorwerpen = await api.listEntities('voorwerpen');
    for (const e of (Array.isArray(voorwerpen) ? voorwerpen : [])) {
      const t = e?.data?.itemType;
      if (t !== 'Blessing' && t !== 'Boon') continue;
      const gt = e.data?.goddelijkType || '';
      zet({
        soort: t === 'Blessing' ? 'zegen' : 'gunst',
        // Waar het vandaan komt: de god bij een zegening, "Gunst" bij een
        // factiebeloning. Dat is wat je als kop boven het kaartje wil lezen.
        bron: t === 'Blessing' ? (e.data?.godNaam || 'Zegeningen') : 'Gunsten',
        level: 0, naam: e.name || '',
        desc: e.data?.desc || '',
        img: e.data?.imageId || '', imgFocus: e.data?.imgFocus || '',
        // De doorklik gaat naar het kaartje zelf: daar staat de eedtekst, de
        // permanente zegen en de rest al goed. Eén plek om een zegening te
        // bekijken, niet twee.
        entityId: e.id,
        // De stand van dit kaartje voor de party die nu speelt, zodat het
        // knopje op het kaartje weet of hij verborgen, vaag of zichtbaar is.
        zichtbaar: e._visibility || 'hidden',
        subsoort: gt,
      });
    }
  } catch { /* geen kaartjes is geen fout */ }

  // Een background noemt een feat ("Feat. Magic Initiate (Cleric)"), en die
  // staat hier gewoon als kaartje. Dus schrijven we hem als [[verwijzing]],
  // net als een wikilink in een kaartje-tekst — het detailvenster maakt er een
  // knop van. De haakjes erachter ("(Cleric)") horen bij de background, niet
  // bij de naam van de feat.
  const featNamen = new Set(uit.filter(x => x.soort === 'feat' || x.soort === 'boon').map(x => x.naam));
  for (const it of uit) {
    if (it.soort !== 'background') continue;
    it.desc = it.desc.replace(/(\*\*Feat\.\*\*\s*)([^(\n]+?)(\s*\([^)]*\))?$/gm, (heel, kop, naam, rest) => {
      const schoon = naam.trim();
      return featNamen.has(schoon) ? `${kop}[[${schoon}]]${rest || ''}` : heel;
    });
  }

  // Dezelfde feature staat bij een multiklasse-campagne soms twee keer; de
  // eerste wint, maar een gelijknamige feature van een ándere klasse blijft
  // staan (Wizards Spellcasting is niet die van de Cleric).
  const gezien = new Set();
  _all = uit.filter(x => { if (gezien.has(x.key)) return false; gezien.add(x.key); return true; });
  _bronnen = [...new Set(_all.map(x => x.bron))].sort();
  return _all;
}

// De tekst zoals hij getoond wordt: eerst wat de campagne zelf schreef, dan de
// SRD. Blijft het leeg, dan mág de tekst hier niet staan — dan verwijzen we.
const _schoonTekst = t => String(t ?? '').replace(/([a-z])-\s+([a-z])/g, '$1$2');
function _tekst(it) {
  return _schoonTekst(it.desc || _bron?.srdDesc?.(it.naam, it.soort === 'subclass' ? it.sub : it.bron) || _bron?.srdDesc?.(it.naam) || '');
}

// ── Zoeken ────────────────────────────────────────────────────────
// Zelfde drie bakken en dezelfde scores als bij de spreuken en de kaartjes:
// een treffer in de naam telt zwaarder dan een in de beschrijving.
function _hooibergen(it) {
  if (!it._h) {
    it._h = {
      name: (it.naam || '').toLowerCase(),
      meta: [it.bron, it.sub, SOORTEN[it.soort]?.label, it.level ? `level ${it.level}` : ''].filter(Boolean).join(' ').toLowerCase(),
      rest: _tekst(it).toLowerCase(),
    };
  }
  return it._h;
}

function _score(it, tokens) {
  const h = _hooibergen(it);
  let totaal = 0;
  for (const t of tokens) {
    let best = 0;
    if (h.name === t) best = 1000;
    else if (h.name.startsWith(t)) best = 600;
    else if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h.name)) best = 400;
    else if (t.length >= 2 && h.name.includes(t)) best = 250;
    else if (t.length >= 2 && h.meta.includes(t)) best = 120;
    else if (t.length >= 3 && h.rest.includes(t)) best = 60;
    if (best === 0) return -1;
    totaal += best;
  }
  return totaal;
}

function _filtered() {
  const tokens = window._searchTokens?.(_filters.q) || [];
  const scores = new Map();
  const lijst = (_all || []).filter(it => {
    if (tokens.length) {
      const sc = _score(it, tokens);
      if (sc < 0) return false;
      scores.set(it.key, sc);
    }
    // De open deur knipt het raster af; zoeken zet dat opzij (zie _bandHtml).
    if (!tokens.length && _deur) {
      const d = _DEUR(_deur);
      if (d && !d.soorten.includes(it.soort)) return false;
    }
    if (_filters.soort && it.soort !== _filters.soort) return false;
    // Alle backgrounds staan onder dezelfde bron ("Backgrounds"); wat ze van
    // elkaar onderscheidt is hun naam. Op `bron` filteren gaf daar dus nul
    // regels terwijl het kaartje er wél stond.
    if (_filters.bron) {
      const sleutel = it.soort === 'background' ? it.naam : it.bron;
      if (sleutel !== _filters.bron) return false;
    }
    // Op een subklasse ingezoomd: haar eigen features én die van de klasse
    // eromheen. Een Battle Master is een Fighter die iets extra's heeft, niet
    // iets anders — alleen de subklassefeatures tonen liegt over wat je kunt.
    // Aangevinkte subclasses tellen erbij op: de features van de class zelf
    // blijven staan, en elke aangevinkte subclass legt de zijne erbovenop. Niets
    // aangevinkt betekent alleen de class — niet "alle subclasses door elkaar",
    // want dat is precies de brij waar dit tabblad vanaf moest.
    if (it.soort === 'subclass' && !_subAan.has(it.sub)) return false;
    if (_filters.level !== null && Number(it.level) !== Number(_filters.level)) return false;
    return true;
  });
  // Zolang je zoekt is relevantie de volgorde; daarna soort → bron → level → naam.
  if (tokens.length) return lijst.sort((a, b) => (scores.get(b.key) || 0) - (scores.get(a.key) || 0));
  // **Level eerst.** Dit sorteerde op soort, en dus stonden alle features van
  // de class op een rij en die van de aangevinkte subclass er onderaan achter.
  // Dat is de verkeerde vraag: aan tafel wil je weten wat je op level 6 krijgt,
  // niet of iets uit de class of de subclass komt. Nu lopen ze door elkaar in
  // de volgorde waarin je ze krijgt, en zegt het kaartje zelf waar het vandaan
  // komt.
  //
  // Level 0 (een feat, een Epic Boon) heeft geen plek in die ladder en gaat
  // daarom vooraan; binnen hetzelfde level houden we de oude volgorde aan.
  return lijst.sort((a, b) =>
    (a.level || 0) - (b.level || 0) ||
    SOORT_VOLGORDE.indexOf(a.soort) - SOORT_VOLGORDE.indexOf(b.soort) ||
    a.bron.localeCompare(b.bron) || a.naam.localeCompare(b.naam));
}

// Waar iets bij hoort. Bij een feat, een Epic Boon of een background zegt de
// bron hetzelfde als de soort ("Feat · Feats") — dan laten we hem weg.
const _EIGEN_BRON = new Set(['Feats', 'Epic Boons', 'Backgrounds', 'Gunsten', 'Zegeningen']);
function _bronRegel(it) {
  if (it.soort === 'subclass') return `${it.sub} · ${it.bron}`;
  return _EIGEN_BRON.has(it.bron) ? '' : it.bron;
}

// ── Kaartje ───────────────────────────────────────────────────────
// De eigen kleur van een subclass, als de DM er een koos. Hij kleurt zowel het
// kaartje van de subclass als zijn features — anders zie je aan tafel niet
// welke regel bij welke hoort zodra je er twee naast elkaar legt.
function _subKleur(it) {
  if (it.soort !== 'subclass' || !it.sub) return null;
  return _bron?.prog?.classes?.[it.bron]?.subclasses?.[it.sub]?.kleur || null;
}

function _card(it) {
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const eigenKleur = _subKleur(it);
  const tekst = _tekst(it);
  const bronRegel = _bronRegel(it);
  // Staat de tekst er niet, dan hoeft de kijker het kaartje daar niet eerst
  // voor te openen — zelfde regel als bij de spreuken.
  const link = tekst ? '' : (window.app?.bronLink?.(it.naam, 'features') || '');
  // Een zegening of een gunst is een kaartje in de campagne: hij is verborgen
  // tot de party hem krijgt, en dat onthullen hoort hier te kunnen. Dezelfde
  // knoppenrij als op een kaartje in het archief, met dezelfde handlers — een
  // tweede manier om hetzelfde te doen loopt vroeg of laat uit de pas.
  const dmRij = (isDM() && it.entityId) ? (() => {
    const vis = it.zichtbaar || 'hidden';
    const vIcon = vis === 'visible' ? icon('eye') : vis === 'vague' ? icon('eye-off') : icon('lock');
    const vTitel = vis === 'visible' ? 'Verbergen' : vis === 'vague' ? 'Volledig tonen' : 'Zichtbaar maken';
    const id = esc(it.entityId);
    return `<div class="vaardig-dmrij" onclick="event.stopPropagation()">
      <button class="vaardig-dmknop vaardig-dmknop--${esc(vis)}" title="${vTitel}"
        onclick="window.vaardigheden.zichtbaarheid('${id}', event)">${vIcon}</button>
      <button class="vaardig-dmknop" title="Bewerken"
        onclick="window._openEditor('voorwerpen','${id}')">${icon('pencil')}</button>
    </div>`;
  })() : '';

  // Een zegening of een gunst is een kaartje in de campagne, en dat heeft zijn
  // eigen venster — met de god, de eedtekst en de permanente zegen erin. Daar
  // klikken we dus heen: één plek om een zegening te bekijken, niet twee.
  const klik = it.entityId
    ? `window._openDetail('voorwerpen','${esc(it.entityId)}')`
    : `window.vaardigheden.open('${esc(it.key)}')`;
  return `
    <div class="entity-card vaardig-card" data-soort="${esc(it.soort)}"
      onclick="${klik}" title="${esc(it.naam)}"
      style="--soort-c1:${eigenKleur ? esc(eigenKleur) : s.c1};--soort-c2:${eigenKleur ? esc(eigenKleur) : s.c2}">
      <div class="card-accent vaardig-accent"></div>
      ${dmRij}
      ${it.level ? `<span class="vaardig-card-niv">${it.level}</span>` : ''}
      <div class="card-img-wrap vaardig-card-img-wrap">
        <div class="vaardig-card-silhouet">${icon(_itemIcoon(it))}</div>
        ${it.img ? `<img class="vaardig-card-img" src="/api/files/${esc(it.img)}" alt="" loading="lazy"
          style="${it.imgFocus ? `object-position:${esc(it.imgFocus)}` : ''}"
          onload="this.classList.add('is-on')" onerror="this.remove()">` : ''}
      </div>
      <div class="entity-card-body vaardig-card-body">
        <div class="vaardig-card-name">${esc(it.naam)}</div>
        ${(() => {
          // De soort staat al als chip op het kaartje; deze regel zegt waar het
          // bij hoort. Is er niets te zeggen (een feat hoort nergens bij), dan
          // ook geen lege regel.
          const meta = [esc(bronRegel), it.level ? `level ${it.level}` : ''].filter(Boolean).join(' · ');
          return meta ? `<div class="vaardig-card-meta">${meta}</div>` : '';
        })()}
        <div class="vaardig-card-tags">
          <span class="spreuk-tag vaardig-tag--soort">${icon(_itemIcoon(it))} ${esc(s.label)}</span>
          ${it.herkomst ? `<span class="spreuk-tag spreuk-tag--eigen${it.herkomst === 'overgenomen' ? ' spreuk-tag--overgenomen' : ''}"
            title="Van deze campagne">${icon('sparkles')} ${esc(HERKOMST_LABEL[it.herkomst] || 'Eigen')}</span>` : ''}
          ${link ? `<a class="spreuk-tag spreuk-tag--naslag" href="${esc(link)}" target="_blank" rel="noopener"
            onclick="event.stopPropagation()" title="De beschrijving staat hier niet — zoek hem elders op">${icon('book-open')} Naslag</a>` : ''}
        </div>
        ${tekst
          ? `<div class="vaardig-card-desc">${esc(tekst.replace(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g, '$1').replace(/[*_#]/g, '').slice(0, 130))}…</div>`
          : `<div class="vaardig-card-desc vaardig-card-desc--leeg">De beschrijving staat hier niet — hij valt buiten de vrij te gebruiken SRD.</div>`}
      </div>
    </div>`;
}

// ── Filterbalk ────────────────────────────────────────────────────
// Permanent open, net als bij de spreuken: in een lijst van honderden regels is
// filteren de normale handeling, niet de uitzondering.
// ── Het kaartje van een klasse of subklasse ─────────────────────────────────
// Een klik in de band filterde alleen de lijst. Maar "wat ís een Fighter" is
// een vraag op zich, en het antwoord stond nergens: de hit die zat in een
// tabel op de server, wanneer je je subklasse kiest in de progressiedata, de
// spreukentellers in een derde bestand. Hier staan ze bij elkaar, boven de
// features waar ze bij horen.
//
// Alles komt uit `bronnen/klasse-basis.json`, en dat komt op zijn beurt uit de
// SRD 5.2 (CC BY 4.0) — dezelfde licentie waar de spreuken en de statblokken
// uit komen. De Artificer staat niet in de SRD; daarvan tonen we alleen wat we
// weten, in plaats van de rest te raden.
let _klasseBasis = null, _spreukKlassen = null, _spreukAantal = null, _tellers = null, _featKoppel = null;
// De subclasses die niet in de app staan: alleen hun naam en in welk boek ze
// staan. Eén keer ophalen; valt het om, dan tonen we ze simpelweg niet.
let _elders = null;
// En van wat elders staat: de námen van hun features. Zonder die lijst is een
// subclass die je uit de elders-lijst overneemt een leeg kaartje — je ziet dát
// de Hexblade bestaat maar niet wát hij geeft.
let _eldersFeatures = null;
async function _eldersLaden() {
  if (_elders !== null) return;
  try { _elders = await api.get('/bron/subclasses-elders'); }
  catch { _elders = { klassen: {}, boeken: {} }; }
  try { _eldersFeatures = await api.get('/bron/features-elders'); }
  catch { _eldersFeatures = { classes: {}, subclasses: {}, species: {} }; }
}

async function _klasseExtra() {
  if (_klasseBasis) return;
  const haal = async (naam) => {
    try { const r = await fetch(`/api/bron/${naam}`, { credentials: 'same-origin' });
          return r.ok ? await r.json() : null; } catch { return null; }
  };
  const [basis, spreuken, koppel] = await Promise.all([
    haal('klasse-basis'), haal('spells-2024'), haal('feat-koppelingen')]);
  _klasseBasis = (basis?.klassen) || {};
  _featKoppel = koppel?.feats || {};
  // Hoeveel spreuken staan er op de lijst van elke klasse? Dat telt zichzelf
  // uit de spreukenbron; nergens anders staat het, en het is precies wat je
  // wilt weten als je kiest wát je gaat spelen.
  _spreukAantal = new Map();
  // Welke klassen hebben deze spreuk op hun lijst? Dat staat al in de
  // spreukenbron; zo weet een feat die Misty Step geeft vanzelf bij wie hij
  // hoort, zonder dat iemand dat ergens invult.
  _spreukKlassen = new Map();
  for (const sp of (spreuken?.results || [])) {
    const klassen = (sp.classes || []).map(c => c.name).filter(Boolean);
    _spreukKlassen.set(String(sp.name || '').toLowerCase(), klassen);
    for (const k of klassen) _spreukAantal.set(k, (_spreukAantal.get(k) || 0) + 1);
  }
  // De tellers (hoeveel cantrips en voorbereide spreuken per level) staan in
  // hun eigen bron; de server leest ze al voor de level-up.
  _tellers = await haal('srd-spreukentellers') || {};
}

const _AB_NAAM = { str: 'Strength', dex: 'Dexterity', con: 'Constitution',
                   int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// Wat deze feat vraagt en geeft. Eerst wat de DM zelf invulde — dat is zijn
// tafel en zijn beslissing. Staat er niets, dan het meegeleverde antwoord uit
// `bronnen/feat-koppelingen.json`, zodat een verse campagne niet leeg begint en
// niemand dit opnieuw hoeft in te tikken.
function _koppelingVan(it) {
  const eigen = {
    vereist: it.vereist || '',
    geeftSpreuk: it.geeftSpreuk || [],
    sluitAan: it.sluitAan || [],
  };
  if (eigen.vereist || eigen.geeftSpreuk.length || eigen.sluitAan.length) return eigen;
  const mee = _featKoppel?.[it.naam];
  if (!mee) {
    // Elke Epic Boon vraagt level 19; dat staat niet twaalf keer in het bestand.
    return it.soort === 'boon' ? { vereist: 'Level 19', geeftSpreuk: [], sluitAan: [] } : eigen;
  }
  return {
    vereist: mee.vereist || '',
    geeftSpreuk: mee.geeftSpreuk || [],
    // `casters: true` betekent "iedereen die cast"; wie dat zijn staat in
    // klasse-basis.json, dus die lijst hoeft niet in het koppelbestand.
    sluitAan: mee.casters
      ? Object.entries(_klasseBasis || {}).filter(([, v]) => v.castAbility).map(([k]) => k)
      : [],
  };
}

// ── Welke feats sluiten aan op deze klasse? ─────────────────────────────────
// Drie soorten koppeling, en ze lijken alleen op elkaar:
//
//   1. **Aangewezen** — de DM heeft de feat aan deze klasse gehangen in de
//      bewerkmodus. Dat is de enige die klopt zonder te raden, want van 58 van
//      de 67 feats hebben we geen tekst om het uit af te leiden.
//   2. **Via de eis** — de feat vraagt een armor training, en we weten welke
//      klassen die geven. Die rekent zichzelf uit: `bronnen/klasse-basis.json`
//      kent de training per klasse, dus "vereist: Medium armor" levert vanzelf
//      de lijst op. Geen invoer, geen gok.
//   3. **Genoemd in de tekst** — een scan over de feats die wél een tekst
//      hebben. Dat zijn er negen, dus deze regel is bijna altijd leeg. Hij
//      staat er omdat hij vanzelf vult zodra de DM teksten intikt.
//
// En eronder staat hoeveel feats er niet bekeken konden worden. Een lijst die
// zwijgt over wat hij niet weet, lees je als compleet.
const _ARMOR_WOORDEN = [
  { re: /\blight\b/i,   training: 'Light' },
  { re: /\bmedium\b/i,  training: 'Medium' },
  { re: /\bheavy\b/i,   training: 'Heavy' },
  { re: /\bshield/i,     training: 'Shields' },
];
function _featsVoorKlasse(klasse) {
  const basis = _klasseBasis?.[klasse] || {};
  const mijnArmor = String(basis.armor || '').toLowerCase();
  const feats = (_all || []).filter(x => x.soort === 'feat' || x.soort === 'boon');

  const aangewezen = [], viaEis = [], genoemd = [], viaSpreuk = [];
  let zonderTekst = 0;
  const re = new RegExp(`\\b${klasse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

  for (const f of feats) {
    const k = _koppelingVan(f);
    if (k.sluitAan.includes(klasse)) { aangewezen.push(f); continue; }
    // De eis: noemt hij een armor training die deze klasse geeft?
    const eis = String(k.vereist || '');
    if (eis) {
      const nodig = _ARMOR_WOORDEN.filter(a => a.re.test(eis)).map(a => a.training);
      if (nodig.length && nodig.every(t => mijnArmor.includes(t.toLowerCase()))) { viaEis.push(f); continue; }
    }
    // Geeft hij een spreuk die op de lijst van deze klasse staat?
    const spreuken = k.geeftSpreuk;
    if (spreuken.length) {
      const raakt = spreuken.some(n => (_spreukKlassen?.get(String(n).toLowerCase()) || []).includes(klasse));
      if (raakt) { viaSpreuk.push(f); continue; }
    }
    const tekst = _tekst(f);
    if (!tekst) { zonderTekst++; continue; }
    if (re.test(tekst)) genoemd.push(f);
  }
  return { aangewezen, viaEis, viaSpreuk, genoemd, zonderTekst, totaal: feats.length };
}

function _featBlokHtml(klasse) {
  const { aangewezen, viaEis, viaSpreuk, genoemd, zonderTekst, totaal } = _featsVoorKlasse(klasse);
  if (!aangewezen.length && !viaEis.length && !viaSpreuk.length && !genoemd.length && !zonderTekst) return '';
  const chips = (lijst) => lijst
    .sort((a, b) => a.naam.localeCompare(b.naam))
    .map(f => `<button class="vk-feat" onclick="window.vaardigheden.open('${esc(f.key).replace(/'/g, "\\'")}')">${esc(f.naam)}</button>`)
    .join('');
  const rij = (label, uitleg, lijst) => lijst.length ? `
    <div class="vk-featrij">
      <div class="vk-featrij-kop">${esc(label)} <span>${esc(uitleg)}</span></div>
      <div class="vk-featchips">${chips(lijst)}</div>
    </div>` : '';

  return `
    <div class="vk-feats">
      <div class="vk-feats-kop">${icon('zap')} Feats die hierop aansluiten</div>
      ${rij('Aangewezen', 'door de DM aan deze klasse gehangen', aangewezen)}
      ${rij('Via de eis', 'vraagt training die deze klasse geeft', viaEis)}
      ${rij('Geeft een spreuk', 'een spreuk die op jouw lijst staat', viaSpreuk)}
      ${rij('Genoemd', 'noemt deze klasse in zijn tekst', genoemd)}
      ${zonderTekst ? `<p class="vk-feats-noot">Van ${zonderTekst} van de ${totaal} feats staat er geen tekst in de app, dus die konden niet bekeken worden. ${isDM() ? 'Open er een en vink bij <em>Sluit aan op</em> aan waar hij bij hoort — dan staat hij hier.' : ''}</p>` : ''}
    </div>`;
}

// Wat een caster aan spreuken heeft: hoe groot zijn lijst is, en hoe de
// tellers meegroeien van level 1 naar 20. Dat stond in de Spreuken-tab en in
// `srd-spreukentellers.json`, maar nergens bij elkaar — terwijl het juist de
// vraag is als je kiest wát je gaat spelen.
function _spreukRegel(klasse, basis) {
  if (!basis?.castAbility) return null;
  const n = _spreukAantal?.get(klasse) || 0;
  const t = _tellers?.[klasse] || null;
  const delen = [];
  if (n) delen.push(`${n} op de lijst`);
  if (t?.['1'] && t?.['20']) {
    const c1 = t['1'].cantrips, c20 = t['20'].cantrips;
    const v1 = t['1'].voorbereid, v20 = t['20'].voorbereid;
    if (c20) delen.push(`cantrips ${c1}${c20 !== c1 ? ` → ${c20}` : ''}`);
    if (v20) delen.push(`voorbereid ${v1}${v20 !== v1 ? ` → ${v20}` : ''}`);
  }
  if (!delen.length) return null;
  return ['Spells', delen.join(' · ')];
}

// ── Het kaartje van een class ───────────────────────────────────────────────
// **De kerntrekken, en verder niets.** Hier stond een wand met de signature
// feature, het aantal subclasses, op welke levels je een feat of ASI krijgt, de
// feats die erop aansluiten en een voetnoot over hoeveel feats geen tekst
// hebben. Allemaal waar, en allemaal dingen die je ergens anders ook ziet — het
// aantal subclasses staat ernaast, de feats hebben hun eigen deur. Wat
// overblijft is wat de PHB onder *Core Traits* zet, in die volgorde.
//
// Het kaartje heeft twee kanten: een plaat met alleen de naam erop, en de
// gegevens. Hij draait om bij hover en blijft om als je klikt — zo kun je er
// ook met een vinger bij.
// Het beeld bij een class, een species of een subclass. Drie eigen bakken in
// `meta.heldenboek`, want ze mogen dezelfde naam hebben.
const _HB_BAK = { class: 'klassen', species: 'species', subclass: 'subclassen' };
// Een beeld bij een kaart was alleen een bestand-id. Nu mag het ook een id mét
// een focuspunt zijn — dezelfde kiezer als bij een spreuk of een kaartje, want
// een portret dat op de borst is uitgesneden mist het gezicht. Een oude waarde
// (een kale string) blijft gewoon werken.
function _hbBeeldRuw(soort, naam) {
  const f = window.app?.state?.meta?.heldenboek?.[_HB_BAK[soort]]?.[naam];
  if (!f) return null;
  return typeof f === 'string' ? { id: f, focus: '' } : { id: f.id || '', focus: f.focus || '' };
}
function _hbBeeld(soort, naam) {
  const f = _hbBeeldRuw(soort, naam);
  return f?.id ? `/api/files/${esc(f.id)}` : '';
}

// ── De flipkaart ────────────────────────────────────────────────────────────
// Eén vorm voor een class, een species en een subclass: een plaat met de naam
// erop die bij hover omdraait naar de gegevens. Dat was eerst alleen de class;
// een species kreeg een plat kaartje en een subclass een nóg platter. Terwijl
// het dezelfde vraag is — wat ís dit — en dus dezelfde vorm verdient.
//
// `rijen` is wat er op de achterkant onder elkaar staat, `extra` wat daar nog
// achteraan komt (een knop naar de spreukenlijst, een noot).
function _flipKaartHtml({ soort, naam, kleur, icoon, bijschrift = '', onder = '', rijen = [], kop = '', extra = '', bron = '' }) {
  const beeld = _hbBeeld(soort, naam);
  const focus = _hbBeeldRuw(soort, naam)?.focus || '';
  const veilig = esc(naam).replace(/'/g, "\\'");
  const veiligB = esc(bron || '').replace(/'/g, "\\'");
  // Klikken opent het venster met het hele verhaal, net als bij de features
  // eronder. Omdraaien gebeurt vanzelf als je eroverheen gaat; wat je op de
  // achterkant ziet is een voorproefje dat mag afkappen.
  return `
    <div class="vk-flip${beeld ? '' : ' vk-flip--geenbeeld'}" style="--vk-kleur:${kleur}"
      title="Lees meer over ${esc(naam)}"
      onclick="window.vaardigheden.kaartOpen('${esc(soort)}','${veilig}','${veiligB}')">
      <!-- **De beeldknop staat buiten de draaiende kanten.** Hij hing op de
           voorkant, en een kaartje zonder afbeelding staat permanent
           omgedraaid (zie de regel vk-flip--geenbeeld) zodat je de gegevens
           ziet in plaats van een leeg vlak. Daarmee was de knop juist
           onbereikbaar bij precies de kaartjes die er nog een nodig hadden:
           wie er al een had kon hem wisselen, wie er geen had kon er nooit
           een kiezen. Buiten vk-flip-binnen draait hij niet mee en ligt hij
           altijd boven.
           (Geen backticks in commentaar hierbinnen: template literal.) -->
      <!-- Eén knop. Er stonden er drie op dit kaartje — een beeldknop, een
           focusknop en "Uitleg bewerken" onderaan — voor drie stukjes van
           hetzelfde ding. Nu staat alles in één venster: de tekst, de
           ondertitel, het boek, de afbeelding en zijn focuspunt.
           (Geen backticks in commentaar hierbinnen: template literal.) -->
      ${isDM() ? `<button class="vk-beeldknop" title="Dit kaartje bewerken"
        onclick="event.stopPropagation();window.vaardigheden.kaartBewerken('${esc(soort)}','${veilig}','${veiligB}')">${icon('pencil')}</button>` : ''}
      <div class="vk-flip-binnen">
        <div class="vk-voor">
          ${beeld ? `<span class="vk-voor-beeld" style="background-image:url('${beeld}')${focus ? `;background-position:${esc(focus)}` : ''}"></span>` : ''}
          <span class="vk-voor-naam">${esc(naam)}</span>
        </div>
        <div class="vk-achter">
          <div class="vk-kop">
            <span class="vk-icoon">${icon(icoon)}</span>
            <div>
              <div class="vk-naam">${esc(naam)}</div>
              ${bijschrift ? `<div class="vk-sig">${esc(bijschrift)}</div>` : ''}
              ${onder ? `<div class="vk-onder">${esc(onder)}</div>` : ''}
            </div>
          </div>
          ${kop ? `<div class="vk-kerntrekken">${esc(kop)}</div>` : ''}
          ${rijen.length ? `<dl class="vk-training">
            ${rijen.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
          </dl>` : ''}
          ${extra}
        </div>
      </div>
    </div>`;
}

// De kerngegevens van een class. Apart, want het kaartje én het venster
// erachter tonen ze allebei — en ze horen hetzelfde te zeggen.
// De volgorde van de PHB: Primary Ability, Hit Point Die, Saving Throws,
// Skills, Weapons, Armor.
function _klasseRijen(klasse) {
  const basis = _klasseBasis?.[klasse] || {};
  return [
    basis.primary ? ['Primary Ability', basis.primary] : null,
    basis.hitDie ? ['Hit Point Die', `d${basis.hitDie} per ${klasse} level`] : null,
    basis.saves?.length
      ? ['Saving Throws', basis.saves.map(a => _AB_NAAM[a] || a).join(', ')] : null,
    basis.skillAantal
      ? ['Skills', basis.skills?.length
          ? `kies ${basis.skillAantal} uit ${basis.skills.join(', ')}`
          : `kies ${basis.skillAantal}, vrij`]
      : null,
    basis.weapons ? ['Weapons', basis.weapons] : null,
    basis.armor   ? ['Armor Training', basis.armor] : null,
    basis.tools   ? ['Tools', basis.tools] : null,
    basis.castAbility
      ? ['Spellcasting', _AB_NAAM[basis.castAbility] || basis.castAbility] : null,
  ].filter(Boolean);
}

function _klasseKaartHtml(klasse) {
  const basis = _klasseBasis?.[klasse] || {};
  const sig   = window._signatureVoor?.(klasse);
  const rijen = _klasseRijen(klasse);
  const heeftSpreuken = basis.castAbility && (_spreukAantal?.get(klasse) || 0);
  return _flipKaartHtml({
    soort: 'class', naam: klasse, kleur: sig?.kleur || '#8a6d3f',
    icoon: KLASSE_ICOON[klasse] || 'sword', kop: 'Core Traits', rijen,
    extra: heeftSpreuken ? `
      <button class="vk-naar-spreuken" onclick="event.stopPropagation();window.vaardigheden.naarSpreuken('${esc(klasse).replace(/'/g, "\\'")}')">
        ${icon('book-open')} Spreukenlijst</button>` : '',
  });
}

function _subklasseKaartHtml(klasse, sub) {
  const data = _bron?.prog?.classes?.[klasse]?.subclasses?.[sub];
  if (!data) return '';
  const uitleg = String(data.desc || '').trim();
  const n = Object.values(data.levels || {}).reduce((t, a) => t + (a || []).length, 0);
  const levels = Object.keys(data.levels || {}).map(Number)
    .filter(l => (data.levels[l] || []).length).sort((a, b) => a - b);
  const veld = window._subSignatureVoor?.(sub);
  const label = _bron?.prog?.classes?.[klasse]?.subclassLabel || 'Subclass';

  // "4 features" en "op level 3 · 6 · 10 · 14" stonden allebei op het kaartje
  // én in de lijst ernaast én in de kaartjes eronder. Drie keer hetzelfde
  // getal is twee keer te veel; wat hier overblijft is wat je nergens anders
  // ziet.
  const rijen = [
    veld ? ['Eigen veld', veld.feature] : null,
    data.boek ? ['Uit', data.boek] : null,
  ].filter(Boolean);

  return _flipKaartHtml({
    soort: 'subclass', naam: sub, bron: klasse, kleur: data.kleur || veld?.kleur || '#5a2e8a',
    icoon: veld?.icon || 'star', bijschrift: `${label} · ${klasse}`,
    // De eigen ondertitel van de DM, direct onder "Primal Path · Barbarian".
    onder: String(data.ondertitel || '').trim(),
    rijen,
    extra: `
      ${uitleg ? `<div class="vk-uitleg">${_bron?.md?.(uitleg) ?? esc(uitleg)}</div>` : ''}
      ${n || uitleg ? '' : `<p class="vk-noot">Van deze subklasse staat er geen tekst in de app — die komt uit het boek en mag daar niet uit overgenomen worden.</p>`}
`,
  });
}

// Een volk en een achtergrond kregen geen kaartje terwijl ze wel in de band
// stonden — dan klik je iets aan en er gebeurt alleen iets met de lijst
// eronder. Ze hebben minder harde getallen dan een klasse, dus het kaartje
// vertelt wat ze wél hebben: op welke levels je iets krijgt (een volk geeft
// niet alleen op 1 iets) en wat de onderdelen zijn.
function _volkRijen(volk) {
  const data = _bron?.prog?.species?.[volk];
  if (!data) return [];
  const levels = Object.keys(data.levels || {}).map(Number)
    .filter(l => (data.levels[l] || []).length).sort((a, b) => a - b);
  const n = levels.reduce((t, l) => t + data.levels[l].length, 0);
  const vroeg = (data.levels?.[1] || []).map(f => f.name);
  return [
    n ? ['Traits', String(n)] : null,
    levels.length ? ['Op level', levels.join(' · ')] : null,
    vroeg.length ? ['Vanaf 1', vroeg.join(', ')] : null,
  ].filter(Boolean);
}

function _volkKaartHtml(volk) {
  const data = _bron?.prog?.species?.[volk];
  if (!data) return '';
  const n = Object.values(data.levels || {}).reduce((t, a) => t + (a || []).length, 0);
  const uitleg = String(data.desc || '').trim();
  const rijen = _volkRijen(volk);
  return _flipKaartHtml({
    soort: 'species', naam: volk, kleur: '#1a6a50',
    icoon: SPECIES_ICOON[volk] || 'user', bijschrift: 'Origin', rijen,
    extra: `
      ${uitleg ? `<div class="vk-uitleg">${_bron?.md?.(uitleg) ?? esc(uitleg)}</div>` : ''}
      ${n ? '' : '<p class="vk-noot">Van dit volk staat er niets in de app.</p>'}
`,
  });
}

// Een achtergrond is één ding met vaste onderdelen; die lezen als rijen,
// niet als getallen.
function _achtergrondRijen(naam) {
  const data = _bron?.backgrounds?.[naam];
  if (!data) return [];
  const delen = Object.values(data.levels || {}).flat().filter(Boolean);
  const rij = (kop) => delen.find(d => String(d.name || '').toLowerCase() === kop.toLowerCase())?.desc || '';
  return [
    ['Ability Scores', rij('Ability Scores')],
    ['Feat', rij('Feat')],
    ['Skills', rij('Skill Proficiencies')],
    ['Tools', rij('Tool Proficiency')],
  ].filter(([, v]) => v);
}

function _achtergrondKaartHtml(naam) {
  const data = _bron?.backgrounds?.[naam];
  if (!data) return '';
  const vaste = _achtergrondRijen(naam);
  return `
    <div class="vk-kaart" style="--vk-kleur:#962058">
      <div class="vk-kop">
        <span class="vk-icoon">${icon('scroll-text')}</span>
        <div>
          <div class="vk-naam">${esc(naam)}</div>
          <div class="vk-sig">Background</div>
        </div>
      </div>
      ${vaste.length ? `<dl class="vk-training">
        ${vaste.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
      </dl>` : '<p class="vk-noot">Van deze background staat er niets in de app.</p>'}
    </div>`;
}

// ── Vier deuren ─────────────────────────────────────────────────────────────
// Dit tabblad begon als een platte lijst van features: je kon "Superiority
// Dice" vinden, maar niet "Battle Master". Daar kwam een band overheen met élke
// class, elk species en elke background als knop — veertig stuks naast elkaar,
// plus een filterbalk, plus vijfhonderd kaartjes eronder. Alles stond er, en
// juist daarom zag je niets.
//
// Nu zijn het **vier deuren**, en achter elke deur ligt precies één laag:
//
//   Classes   → de twaalf classes → die class + haar subclasses + features
//   Species   → de species        → dat species + zijn traits
//   Backgrounds → de backgrounds  → die background + wat ze geeft
//   Feats & Epic Boons            → meteen de lijst; die hebben geen tweede laag
//
// Wat je zoekt loopt er dwars doorheen: typ iets en je krijgt resultaten uit
// alles, ongeacht welke deur openstond. Zo hoeft de indeling nooit in de weg te
// staan van "waar stond dat ook alweer".
const _DEUREN = [
  { id: 'class',      label: 'Classes',            soorten: ['class', 'subclass'], icoon: 'swords',      kleur: '#a03810' },
  { id: 'species',    label: 'Species',            soorten: ['species'],           icoon: 'user',        kleur: '#1a6a50' },
  { id: 'background', label: 'Backgrounds',        soorten: ['background'],        icoon: 'scroll-text', kleur: '#962058' },
  { id: 'feats',      label: 'Feats & Boons',      soorten: ['feat', 'boon', 'zegen', 'gunst'], icoon: 'zap', kleur: '#1e4a8a' },
];
const _DEUR = id => _DEUREN.find(d => d.id === id);
// Hoe heet het ding dat je achter deze deur toevoegt?
// Welke soort de editor moet openen voor een nieuwe achter die deur.
const _NIEUW_SOORT  = { class: 'class', species: 'species', background: 'background', feats: 'feat' };

// Welke deur staat open, en waar sta je daarbinnen.
let _deur = null;
// Welke subclasses er aangevinkt staan. **Een Set, geen enkele waarde**: aan
// tafel vergelijk je ze (wat krijgt een Berserker dat een Zealot niet krijgt?),
// en dat kan alleen als je er meer dan één tegelijk kunt aanzetten.
let _subAan = new Set();

function _deurBeeld(id) {
  const f = window.app?.state?.meta?.heldenboek?.beelden?.[id];
  return f ? `/api/files/${esc(f)}` : '';
}

// Hoeveel zit er achter een deur? Bij Classes tellen we de classes zelf, niet
// hun features — "12" zegt meer dan "419".
function _deurTelling(d) {
  if (d.id === 'class') return Object.keys(_bron?.prog?.classes || {}).length;
  if (d.id === 'species' || d.id === 'background') return _bandBronnen(d).length;
  return (_all || []).filter(x => d.soorten.includes(x.soort)).length;
}

function _bandBronnen(groep) {
  const uit = new Map();
  // Eerst wat er in de progressie staat, ook als er nog geen enkele feature in
  // hangt: een class die je net begon hoort meteen zichtbaar te zijn. Hij werd
  // hiervoor uit de **features** afgeleid, dus een lege class bestond niet tot
  // je er iets in zette — en dan zoek je naar iets wat je net hebt aangemaakt.
  const houders = groep.id === 'class' ? Object.keys(_bron?.prog?.classes || {})
    : groep.id === 'species' ? Object.keys(_bron?.prog?.species || {})
    : groep.id === 'background' ? Object.keys(_bron?.backgrounds || {})
    : [];
  for (const naam of houders) uit.set(naam, 0);
  for (const it of (_all || [])) {
    if (!groep.soorten.includes(it.soort)) continue;
    const naam = groep.id === 'background' ? it.naam : it.bron;
    if (!naam) continue;
    uit.set(naam, (uit.get(naam) || 0) + 1);
  }
  return [...uit.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// De subclasses van een class, met hoeveel er van bekend is. Eén zonder
// features blijft staan — juist dán wil je zien dát ze bestaat en dat er niets
// van in de app staat.
function _bandSubklassen(klasse) {
  const uit = new Map();
  for (const [kl, data] of Object.entries(_bron?.prog?.classes || {})) {
    if (kl !== klasse) continue;
    for (const [sub, sdata] of Object.entries(data.subclasses || {})) {
      uit.set(sub, Object.values(sdata.levels || {}).reduce((n, a) => n + (a || []).length, 0));
    }
  }
  return [...uit.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// ── Laag 0: vier staande kaarten ────────────────────────────────────────────
// Hoog in plaats van breed, met het icoon, het aantal en de naam gecentreerd en
// verder niets. Een ondertitel las als uitleg bij een knop; wat erachter ligt
// zie je zodra je klikt, en dat is sneller dan het te lezen.
function _deurenHtml() {
  return `<div class="vd-deuren">${_DEUREN.map(d => {
    const beeld = _deurBeeld(d.id);
    return `<div class="vd-deur-wrap">
      <button class="vd-deur" style="--vd-kleur:${d.kleur}" onclick="window.vaardigheden.deur('${d.id}')">
        ${beeld ? `<span class="vd-deur-beeld" style="background-image:url('${beeld}')"></span>` : ''}
        <span class="vd-deur-icoon">${icon(d.icoon)}</span>
        <span class="vd-deur-telling">${_deurTelling(d)}</span>
        <span class="vd-deur-naam">${esc(d.label)}</span>
      </button>
      ${isDM() ? `<button class="vd-deur-beeldknop" title="Een afbeelding bij deze kaart kiezen"
        onclick="event.stopPropagation();window.vaardigheden.deurBeeld('${d.id}')">${icon('image')}</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

// ── De geopende deur als banner ─────────────────────────────────────────────
// Dezelfde kaart, nu over de volle breedte. Dat is het hele gebaar: je klikt en
// de kaart gaat open in plaats van dat er een ander scherm komt.
function _bannerHtml(d, { klein = false } = {}) {
  const beeld = _deurBeeld(d.id);
  return `<button class="vd-banner${klein ? ' vd-banner--klein' : ''}" style="--vd-kleur:${d.kleur}"
    onclick="window.vaardigheden.${klein ? `deur('${d.id}')` : 'deur(null)'}"
    title="${klein ? 'Terug naar ' + esc(d.label) : 'Terug naar het overzicht'}">
    ${beeld ? `<span class="vd-deur-beeld" style="background-image:url('${beeld}')"></span>` : ''}
    <span class="vd-banner-terug">${icon('chevron-left')}</span>
    <span class="vd-banner-icoon">${icon(d.icoon)}</span>
    <span class="vd-banner-naam">${esc(d.label)}</span>
    <span class="vd-banner-telling">${_deurTelling(d)}</span>
  </button>`;
}

// ── Laag 1: de keuzes achter een deur ───────────────────────────────────────
function _tegelsHtml(d) {
  const rijen = _bandBronnen(d);
  if (!rijen.length) return `<p class="spreuk-empty">Hier staat nog niets in.</p>`;
  const icoonVan = (naam) => d.id === 'class' ? (KLASSE_ICOON[naam] || 'sword')
    : d.id === 'species' ? (SPECIES_ICOON[naam] || 'user') : 'scroll-text';
  // Geen plustegel meer tussen de keuzes, en geen plusknop onder de
  // subclasses: er staat er één in de kopbalk naast de hulpknop, en die weet
  // zelf waar je staat. Een knop per onderdeel was hetzelfde gebaar op vier
  // plekken.
  return `<div class="vd-tegels">${rijen.map(([naam, n], i) => {
    const beeld = _tegelBeeld(x => d.soorten.includes(x.soort)
      && (d.id === 'background' ? x.naam === naam : x.bron === naam));
    const subs = d.id === 'class' ? _bandSubklassen(naam).length : 0;
    return `<button class="vd-tegel" style="--vd-kleur:${d.kleur};--vd-i:${i}"
      onclick="window.vaardigheden.kies('${esc(naam).replace(/'/g, "\\'")}')">
      ${beeld ? `<span class="vd-tegel-beeld" style="background-image:url('${beeld}')"></span>` : ''}
      <span class="vd-tegel-icoon">${icon(icoonVan(naam))}</span>
      <span class="vd-tegel-naam">${esc(naam)}</span>
      <span class="vd-tegel-meta">${subs ? `${subs} subclasses · ` : ''}${n ? `${n} ${n === 1 ? 'feature' : 'features'}` : 'nog leeg'}</span>
    </button>`;
  }).join('')}</div>`;
}

// Een portret achter een tegel: de eerste afbeelding die de DM aan iets uit die
// groep hing. Er is geen apart "beeld per class"-veld; hoe meer hij er plaatst,
// hoe rijker dit scherm vanzelf wordt.
function _tegelBeeld(filter) {
  const met = (_all || []).find(x => x.img && filter(x));
  return met ? `/api/files/${esc(met.img)}` : '';
}

// ── Laag 2: de subclasses als kolom, aanvinkbaar ────────────────────────────
// Bekijken én aanvinken, en meer dan één tegelijk: zo zie je wat een Berserker
// krijgt bovenop wat elke Barbarian al heeft, en kun je twee subclasses naast
// elkaar leggen. Het oogje opent het kaartje, het vinkje voegt zijn features
// toe aan het raster hiernaast.
function _subKolomHtml(klasse) {
  const eigen = _bandSubklassen(klasse);
  const elders = (_elders?.klassen?.[klasse] || [])
    .filter(x => !eigen.some(([n]) => n.toLowerCase() === String(x.naam).toLowerCase()));
  const boeken = _elders?.boeken || {};
  // **Eén lijst.** Er stonden twee koppen boven ("Subclasses" en "Nog 6
  // elders") die allebei zeiden wat je al zag, en samen een halve kolom
  // innamen. De lijst is zichzelf genoeg: wat in de campagne staat is stevig,
  // wat elders bestaat is gestippeld.
  const rijen = [
    ...eigen.map(([naam, n]) => ({ naam, n, elders: false })),
    // De korte code erbij (`scag`, `xge`). De volle boektitel is soms langer
    // dan de naam van de subklasse zelf, en dan loopt de regel om en wordt de
    // rij anderhalf keer zo hoog als die ernaast. De code staat er dus, de
    // titel hangt eronder als tooltip.
    ...elders.map(x => ({ naam: x.naam, boek: boeken[x.boek] || x.boek, code: x.boek, elders: true })),
  ];
  if (!rijen.length) return '';

  // Vier tegelijk, zodat de lijst even hoog blijft als het kaartje ernaast.
  const PER = 4;
  const paginas = Math.ceil(rijen.length / PER);
  if (_subPagina >= paginas) _subPagina = 0;
  const zicht = rijen.slice(_subPagina * PER, _subPagina * PER + PER);
  const veiligK = esc(klasse).replace(/'/g, "\\'");

  return `<div class="vd-subkolom">
    ${zicht.map(r => {
      const veilig = esc(r.naam).replace(/'/g, "\\'");
      if (r.elders) {
        const veiligB = esc(r.boek || '').replace(/'/g, "\\'");
        return `<div class="vd-subkaart vd-subkaart--elders">
          ${isDM() ? `<label class="vd-subkaart-vink" title="Zet ${esc(r.naam)} in deze campagne">
            <input type="checkbox" onchange="window.vaardigheden.eldersAan('${veilig}','${veiligB}')"></label>` : ''}
          <button class="vd-subkaart-open"
            onclick="window.open(window.app.bronLink('${veilig}','subclass'),'_blank')"
            title="${esc(r.boek || '')} — opzoeken; de tekst staat in het boek, niet in de app">
            <span class="vd-subkaart-naam">${esc(r.naam)}</span>
            <span class="vd-subkaart-meta">${esc((r.code || 'elders').toUpperCase())}</span>
          </button>
        </div>`;
      }
      const aan = _subAan.has(r.naam);
      // "geen tekst" klopte niet meer zodra we zijn featurenamen kennen: er
      // staat dan wél iets, alleen niet de tekst erbij.
      const eldersN = r.n ? 0 : (_eldersFeatures?.subclasses?.[r.naam] || []).length;
      return `<div class="vd-subkaart${aan ? ' is-aan' : ''}${r.n ? '' : ' is-leeg'}">
        <label class="vd-subkaart-vink" title="${aan ? 'Haal zijn features uit de lijst' : 'Zet zijn features erbij'}">
          <input type="checkbox" ${aan ? 'checked' : ''} onchange="window.vaardigheden.subToggle('${veilig}')">
        </label>
        <button class="vd-subkaart-open" onclick="window.vaardigheden.subToggle('${veilig}')"
          title="Bekijk deze subclass">
          <span class="vd-subkaart-naam">${esc(r.naam)}</span>
          <span class="vd-subkaart-meta">${r.n ? `${r.n} features` : eldersN ? `${eldersN} features · elders` : 'geen tekst'}</span>
        </button>
      </div>`;
    }).join('')}
    ${paginas > 1 ? `<div class="vd-subblader">
      <button class="vd-subblader-knop" onclick="window.vaardigheden.subBlader(-1)"
        title="Vorige">${icon('chevron-left')}</button>
      <span class="vd-subblader-stand">${_subPagina + 1} / ${paginas}</span>
      <button class="vd-subblader-knop" onclick="window.vaardigheden.subBlader(1)"
        title="Volgende">${icon('chevron-right')}</button>
    </div>` : ''}
  </div>`;
}
// Welke bladzijde van de subclasslijst in beeld staat, en welke subclass het
// kaartje naast de class laat zien. Dat is de laatste die je aanvinkte: vink
// je er twee aan om ze te vergelijken, dan staan hun features allebei in de
// lijst eronder en toont het kaartje degene waar je het laatst op klikte.
let _subPagina = 0;
let _subKaart  = null;

function _bandHtml() {
  // Zoeken gaat dwars door de indeling heen: wie typt wil resultaten, geen
  // navigatie. De weg terug blijft staan.
  if ((_filters.q || '').trim()) {
    return `<div class="vaardig-band">
      <div class="vd-kruimel"><button class="vd-kruimel-stap" onclick="window.vaardigheden.wisZoek()">${icon('chevron-left')} Terug</button>
        <span class="vd-kruimel-nu">Resultaten voor “${esc(_filters.q)}”</span></div></div>`;
  }

  const d = _DEUR(_deur);
  if (!d) return `<div class="vaardig-band">${_deurenHtml()}</div>`;

  // Feats, Epic Boons én backgrounds hebben geen tweede laag: daar is de lijst
  // het antwoord. Een background heeft precies één feature, dus een tegel per
  // background bracht je met een extra klik naar één kaartje — en een
  // samenvattingskaartje erboven herhaalde wat daarin stond. Er valt niets
  // onder een background, dus is de lijst meteen goed.
  if (d.id === 'feats' || d.id === 'background') return `<div class="vaardig-band vd-open">${_bannerHtml(d)}</div>`;

  if (!_filters.bron) return `<div class="vaardig-band vd-open">${_bannerHtml(d)}${_tegelsHtml(d)}</div>`;

  return `<div class="vaardig-band vd-open" data-stand="${esc(_bandStand())}">
    ${_bannerHtml(d, { klein: true })}
    ${_vlakHtml()}
  </div>`;
}

// Waar de band op staat: welke deur open is en welke bron daarin gekozen is.
// Zolang dat gelijk blijft hoeft de banner niet opnieuw neergezet te worden —
// zie `_bandHerteken`.
function _bandStand() { return `${_deur || ''}|${_filters.bron || ''}`; }

// Het vlak onder de banner: het kaartje van waar je op staat, het kaartje van
// de subclass die je aanwees, en de kolom om uit te kiezen.
function _vlakHtml() {
  // Het kaartje van waar je op staat. Bij een class blijft het staan als je een
  // subclass aanvinkt: een Battle Master is een Fighter die iets extra's heeft,
  // dus zijn hit die verdwijnt niet omdat je zijn subclass aanwijst.
  const isClass = !!_bron?.prog?.classes?.[_filters.bron];
  const kaart = isClass ? _klasseKaartHtml(_filters.bron)
    : _bron?.prog?.species?.[_filters.bron] ? _volkKaartHtml(_filters.bron)
    : _bron?.backgrounds?.[_filters.bron] ? _achtergrondKaartHtml(_filters.bron) : '';
  // De aparte terugrij met de naam erin is weg: de banner brengt je al terug en
  // het kaartje eronder zegt zelf hoe hij heet. Twee keer "Barbarian" onder
  // elkaar, met een knop ertussen, was een halve schermhoogte aan herhaling.
  //
  // Bij een class staan de subclasses **naast** het kaartje in plaats van naast
  // het raster: ze horen bij de class, niet bij de lijst eronder.
  // Het scherm in drieën: de class, de subclass die je koos, en de lijst om
  // uit te kiezen. Bij een species is er geen tweede en derde deel, dus staat
  // dat kaartje alleen — in dezelfde maat, want het is dezelfde soort kaart.
  const subKolom = isClass ? _subKolomHtml(_filters.bron) : '';
  // Meer dan één aangevinkt? Dan hoort er onder het kaartje een pijltje te
  // staan — anders zie je er één en weet je niet dat de andere er ook zijn.
  const aangevinkt = [..._subAan].filter(x => _bron?.prog?.classes?.[_filters.bron]?.subclasses?.[x]);
  if (aangevinkt.length && !aangevinkt.includes(_subKaart)) _subKaart = aangevinkt[0];
  const subKaart = (isClass && _subKaart && _bron?.prog?.classes?.[_filters.bron]?.subclasses?.[_subKaart])
    ? `${_subklasseKaartHtml(_filters.bron, _subKaart)}
       ${aangevinkt.length > 1 ? `<div class="vd-subblader vd-subblader--kaart">
         <button class="vd-subblader-knop" onclick="window.vaardigheden.subKaartBlader(-1)" title="Vorige">${icon('chevron-left')}</button>
         <span class="vd-subblader-stand">${aangevinkt.indexOf(_subKaart) + 1} / ${aangevinkt.length}</span>
         <button class="vd-subblader-knop" onclick="window.vaardigheden.subKaartBlader(1)" title="Volgende">${icon('chevron-right')}</button>
       </div>` : ''}` : '';
  const delen = 1 + (subKaart ? 1 : 0) + (subKolom ? 1 : 0);
  return `<div class="vd-klasvlak vd-klasvlak--${delen}">
    <div class="vd-klaskaart">${kaart}</div>
    ${subKaart ? `<div class="vd-klaskaart vd-klaskaart--sub">${subKaart}</div>` : ''}
    ${subKolom}
  </div>`;
}

function _filterBar() {
  // De chips tellen wat er in dít gezichtsveld ligt, niet wat de hele
  // bibliotheek heeft. Binnen Wizard staan "Species 53" en "Background 16"
  // alleen maar in de weg: je kunt er niet heen en ze zeggen niets over waar je
  // staat. Alles buiten de open deur valt dus weg.
  const inBeeld = (_all || []).filter(it => {
    if (_deur) { const d = _DEUR(_deur); if (d && !d.soorten.includes(it.soort)) return false; }
    if (_filters.bron && (it.soort === 'background' ? it.naam : it.bron) !== _filters.bron) return false;
    return true;
  });
  const soorten = SOORT_VOLGORDE.filter(k => inBeeld.some(x => x.soort === k));
  // Eén soort over? Dan is de rij een mededeling, geen keuze.
  const soortRij = soorten.length < 2 ? '' : [`<button class="spreuk-school-btn${_filters.soort ? '' : ' active'}"
      onclick="window.vaardigheden.setSoort(null)">Alles</button>`]
    .concat(soorten.map(k => {
      const s = SOORTEN[k];
      const n = inBeeld.filter(x => x.soort === k).length;
      return `<button class="spreuk-school-btn${_filters.soort === k ? ' active' : ''}"
        style="--school-c2:${s.c2}" onclick="window.vaardigheden.setSoort('${k}')">${icon(s.icon)} ${esc(s.label)} <span class="vaardig-telling">${n}</span></button>`;
    })).join('');

  const zichtbaar = inBeeld.filter(x => !_filters.soort || x.soort === _filters.soort);
  // De bronnenkeuzelijst is weg: waar je bent staat in het kruimelpad, en twee
  // bedieningen voor dezelfde stap lopen uit elkaar.
  const bronSelect = '';

  // Zelfde regel als bij de spreuken: wat je het vaakst gebruikt staat altijd in
  // beeld (soort en bron), de brede rij zit achter de trechter. Hier zijn dat de
  // twintig levels — je zoekt meestal op naam of op soort, niet op "wat krijg ik
  // op 14?". De rij klapt vanzelf open zodra er een level gekozen is, zodat een
  // actief filter nooit onzichtbaar is.
  const levels = ['<button class="spreuk-lvl-btn' + (_filters.level === null ? ' active' : '') +
    '" onclick="window.vaardigheden.setLevel(null)">Alle levels</button>'];
  for (let i = 1; i <= 20; i++) {
    if (!zichtbaar.some(x => x.level === i)) continue;
    levels.push(`<button class="spreuk-lvl-btn${_filters.level === i ? ' active' : ''}" onclick="window.vaardigheden.setLevel(${i})">${i}</button>`);
  }
  const heeftLevels = levels.length > 1;
  const dicht = !_levelsOpen && _filters.level === null;
  const trechter = heeftLevels ? `
    <button class="sf-toggle-btn${_filters.level !== null ? ' sf-toggle-btn--active' : ''}"
      onclick="window.vaardigheden.toggleLevels()" title="Filter op het level waarop iets komt"><svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><polygon points="0,0 13,0 8,5.5 8,11 5,11 5,5.5"/></svg></button>` : '';

  // Zelfde volgorde als bij de spreuken: wat altijd in beeld staat op de eerste
  // regel (daar niveau en klasse, hier soort en bron), de trechter erachter, en
  // de brede uitklaprij eronder. De soortenrij droeg `.spreuk-scholen`, en die
  // claimt een hele regel — daardoor zakte de trechter naar de tweede regel en
  // stond hij bij de twee tabbladen op een andere plek.
  return `
    <div class="spreuk-filters vaardig-filters">
      <div class="vaardig-soorten">${soortRij}</div>
      ${bronSelect}
      ${trechter}
      ${heeftLevels ? `<div class="spreuk-levels vaardig-levels${dicht ? ' vaardig-levels--dicht' : ''}">${levels.join('')}</div>` : ''}
    </div>`;
}

// Op de deurenlaag en de keuzelaag hoort er géén raster te staan: dat is
// precies de waslijst die we kwijt wilden. Pas als je iets gekozen hebt (of
// zoekt) is een lijst een antwoord in plaats van een muur.
// De rij met "Alles · Class 16 · Subclass 18" en de trechter eronder stelden
// binnen één class dezelfde vraag als de kolom ernaast: welke features wil je
// zien. Twee bedieningen voor één keuze lopen uit elkaar, dus de rij verdwijnt
// zodra je in een class, species of background staat. Bij de feats en bij een
// zoekopdracht is er geen kolom en blijft hij staan.
function _toontFilters() {
  if (!_toontRaster()) return false;
  if ((_filters.q || '').trim()) return true;
  return !_filters.bron;
}

function _toontRaster() {
  if ((_filters.q || '').trim()) return true;
  if (!_deur) return false;
  if (_deur === 'feats' || _deur === 'background') return true;
  return !!_filters.bron;
}

function _paint() {
  const grid = document.getElementById('vaardig-grid');
  const fb   = _container?.querySelector('.vaardig-filters');
  const kol  = document.getElementById('vaardig-subkolom');
  if (fb) fb.hidden = !_toontFilters();
  // De kolom met subclasses staat links van het raster en hoort alleen bij een
  // class. Buiten Classes bestaat hij niet.
  // De subclasses stonden hier als kolom naast het raster; ze staan nu naast het
  // classkaartje erboven, waar ze thuishoren.
  if (kol) { kol.innerHTML = ''; kol.hidden = true; }
  if (!grid) return;
  grid.hidden = !_toontRaster();
  if (!_toontRaster()) { grid.innerHTML = ''; return; }
  const lijst = _filtered();
  // Het kaartje met de algemene uitleg van een aangevinkte subclass hoort
  // bovenaan de waslijst: eerst wát een Berserker is, dan pas wat hij krijgt.
  // Vink je er meer aan, dan staan ze alle twee boven hun features.
  // Het kaartje van de aangevinkte subclass stond hier bovenaan het raster.
  // Dat staat nu naast de class in de band, waar het hoort — twee keer
  // hetzelfde kaartje op één scherm leest als een fout.
  grid.innerHTML = (lijst.length
      ? lijst.map(_card).join('')
      : `<p class="spreuk-empty">Niets gevonden.</p>`);
  const tel = document.getElementById('vaardig-telling');
  if (tel) tel.textContent = `${lijst.length} van ${(_all || []).length}`;
}

// Het uitwaaieren. De kaartjes krijgen één voor één een korte opkomst; de
// vertraging staat als `--vd-i` op de tegel zelf, zodat de CSS het werk doet en
// er geen timer per kaartje nodig is. Bewust kort (30 ms per stap, 12 stappen
// max): langer voelt als wachten in plaats van als openvouwen.
function _cinematisch() {
  const wrap = _container?.querySelector('.vaardig-band');
  if (!wrap) return;
  wrap.classList.remove('vd-waaier');
  // Een reflow afdwingen, anders ziet de browser geen klasseverandering en
  // speelt de animatie niet opnieuw af.
  void wrap.offsetWidth;
  wrap.classList.add('vd-waaier');
}

function _bandHerteken() {
  const el = document.getElementById('vaardig-band');
  if (!el) return;
  // Alleen het vlak eronder hertekenen zolang je binnen dezelfde deur en
  // dezelfde class blijft. De banner opnieuw neerzetten gaf hem elke klik zijn
  // openklap-animatie terug (`vd-open`, .34s) en liet zijn plaat opnieuw
  // inladen — dat zag je als een flikkering van de balk boven de kaartjes
  // zodra je door aangevinkte subklassen klikte.
  const band = el.querySelector('.vaardig-band');
  const vlak = el.querySelector('.vd-klasvlak');
  if (band && vlak && !(_filters.q || '').trim() && band.dataset.stand === _bandStand()) {
    vlak.outerHTML = _vlakHtml();
    return;
  }
  el.innerHTML = _bandHtml();
}

function _refreshFilterBar() {
  const fb = _container?.querySelector('.vaardig-filters');
  if (fb) fb.outerHTML = _filterBar();
}

// ── Detailvenster ─────────────────────────────────────────────────
// Zelfde opmaak als het progressie-detailvenster (`prog-detail*`), inclusief de
// verwijzing naar buiten wanneer de tekst hier niet mag staan.
// [[Naam]] → een knop die dat kaartje opent, als het bestaat. Zelfde truc als
// bij de spreuken: de gewone wikilink-resolver kent alleen kaartjes uit het
// archief, en een feat is er daar geen van.
// Welke sleutel er nú getekend wordt; die gaat mee als "waar kwam je vandaan"
// in elke verwijzing in zijn tekst.
let _vanWaarNu = '';

function _verwijzingen(html) {
  return String(html).replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (heel, naam, alias) => {
    const doel = (_all || []).find(x => x.naam.toLowerCase() === naam.trim().toLowerCase());
    const tekst = esc((alias || naam).trim());
    return doel
      ? `<a class="spreuk-verwijzing" onclick="window.vaardigheden.open('${esc(doel.key)}','${esc(_vanWaarNu || '')}')" title="Open ${tekst}">${tekst}</a>`
      : tekst;
  });
}

// ── De koppeling andersom ───────────────────────────────────────────────────
// Op het klassekaartje staat welke feats erbij passen. Sta je op de feat zelf,
// dan wil je het omgekeerde zien: bij wie hoor ík? Dezelfde drie wegen, alleen
// van de andere kant bekeken — en zonder nieuwe gegevens, want ze liggen er al.
function _klassenVoorFeat(it) {
  if (it.soort !== 'feat' && it.soort !== 'boon') return null;
  const klassen = Object.keys(_bron?.prog?.classes || {});
  const kop = _koppelingVan(it);
  const aangewezen = kop.sluitAan.filter(k => klassen.includes(k));

  const eis = String(kop.vereist || '');
  const nodig = eis ? _ARMOR_WOORDEN.filter(a => a.re.test(eis)).map(a => a.training) : [];
  const viaEis = nodig.length
    ? klassen.filter(k => {
        const armor = String(_klasseBasis?.[k]?.armor || '').toLowerCase();
        return nodig.every(t => armor.includes(t.toLowerCase()));
      })
    : [];

  const viaSpreuk = [];
  for (const n of kop.geeftSpreuk) {
    for (const k of (_spreukKlassen?.get(String(n).toLowerCase()) || [])) {
      if (klassen.includes(k) && !viaSpreuk.includes(k)) viaSpreuk.push(k);
    }
  }
  if (!aangewezen.length && !viaEis.length && !viaSpreuk.length && !eis) return null;
  // `geeftSpreuk` gaat mee: de weergave noemt eronder wélke spreuk het is, en
  // die staat niet per se op het item zelf — hij kan uit de meegeleverde
  // koppelingen komen.
  return { aangewezen, viaEis, viaSpreuk, eis, geeftSpreuk: kop.geeftSpreuk };
}

function _featKoppelingHtml(it) {
  const k = _klassenVoorFeat(it);
  if (!k) return '';
  const chips = (lijst) => lijst.sort().map(n =>
    `<button class="vk-feat" onclick="window.vaardigheden.naarKlasse('${esc(n).replace(/'/g, "\\'")}')">${icon(KLASSE_ICOON[n] || 'sword')} ${esc(n)}</button>`).join('');
  const rij = (label, uitleg, lijst) => lijst.length ? `
    <div class="vk-featrij">
      <div class="vk-featrij-kop">${esc(label)} <span>${esc(uitleg)}</span></div>
      <div class="vk-featchips">${chips(lijst)}</div>
    </div>` : '';
  return `
    <div class="vk-feats vk-feats--omgekeerd">
      ${k.eis ? `<div class="vk-eis">${icon('lock')} <strong>Vereist</strong> ${esc(k.eis)}</div>` : ''}
      ${rij('Aangewezen', 'hier aan gehangen', k.aangewezen)}
      ${rij('Via de eis', 'deze klassen geven die training', k.viaEis)}
      ${rij('Geeft een spreuk', 'staat op hun lijst', k.viaSpreuk)}
      ${k.geeftSpreuk.length ? `<p class="vk-feats-noot">Geeft: ${k.geeftSpreuk.map(esc).join(', ')}.</p>` : ''}
    </div>`;
}

// ── Het venster achter een kaartje ──────────────────────────────────────────
// Een class, een subclass, een species en een background hebben allemaal
// hetzelfde venster. Op het kaartje zelf past maar een stukje: dat heeft een
// vaste hoogte, want de voorkant en de achterkant liggen over elkaar heen om
// te kunnen draaien. Daarom kapt de tekst dáár af en staat hier het hele
// verhaal — precies zoals je op een feature klikt om die uit te lezen.
//
// Waar een houder staat, staat op één plek. Dat was drie keer apart
// uitgeschreven, en op één van die plekken stond `prog.backgrounds` in plaats
// van `backgrounds`: een background bewerken zei dan dat hij niet bestond.
function _houderVan(soort, naam, bron = '') {
  if (soort === 'subclass') return _bron?.prog?.classes?.[bron]?.subclasses?.[naam];
  if (soort === 'class')    return _bron?.prog?.classes?.[naam];
  if (soort === 'species')  return _bron?.prog?.species?.[naam];
  return _bron?.backgrounds?.[naam];
}

// De features die onder een houder hangen, met het level ervoor. Je klikt er
// doorheen naar het kaartje van die feature zelf.
function _houderFeaturesHtml(soort, naam, bron) {
  const data = _houderVan(soort, naam, bron);
  const levels = Object.keys(data?.levels || {}).map(Number)
    .filter(l => (data.levels[l] || []).length).sort((a, b) => a - b);
  const aantal = levels.reduce((t, l) => t + data.levels[l].length, 0);
  // Staat er niets in de app, dan zijn de námen er misschien wel. Die komen uit
  // `bronnen/features-elders.json` en dragen geen tekst: je ziet waar het over
  // gaat en klikt door naar de naslag. Zodra de DM er zelf features bij zet
  // wint wat in de campagne staat — dit is alleen de wegwijzer bij een leegte.
  if (!aantal) return _eldersFeaturesHtml(soort, naam);
  const zoek = (f) => (_all || []).find(x => x.naam === f.name && x.soort === soort
    && (soort === 'subclass' ? x.bron === bron && x.sub === naam : x.bron === naam));
  const rijen = levels.map(l => (data.levels[l] || []).map(f => {
    const it = zoek(f);
    const klik = it ? ` onclick="window.vaardigheden.uitKaartVenster('${esc(it.key)}')"` : '';
    return `<button class="vd-subfeature"${klik}${it ? '' : ' disabled'}>
      <span class="vd-subfeature-lvl">${l}</span>
      <span class="vd-subfeature-naam">${esc(f.name)}</span>
    </button>`;
  }).join('')).join('');
  return { aantal, rijen };
}

// De namen van de features van iets dat niet in de app staat, elk met de weg
// naar buiten. Geen level ervoor: dat staat in het boek, en de ene druk zet het
// anders dan de andere.
function _eldersFeaturesHtml(soort, naam) {
  const groep = soort === 'class' ? 'classes' : soort === 'species' ? 'species' : 'subclasses';
  const lijst = _eldersFeatures?.[groep]?.[naam] || [];
  if (!lijst.length) return { aantal: 0, rijen: '', elders: false };
  const rijen = lijst.map(f => {
    const zoek = window.app?.bronLink?.(`${f} ${naam}`, 'feature') || '';
    return `<a class="vd-subfeature vd-subfeature--elders" href="${esc(zoek)}" target="_blank" rel="noopener"
      title="${esc(f)} opzoeken — de tekst staat in het boek, niet in de app">
      <span class="vd-subfeature-lvl">${icon('book-open')}</span>
      <span class="vd-subfeature-naam">${esc(f)}</span>
      <span class="vd-subfeature-naslag">${icon('arrow-up-right')}</span>
    </a>`;
  }).join('');
  return { aantal: lijst.length, rijen, elders: true };
}

// Wat er op het kaartje in de kolom "Core Traits" staat, hier als dezelfde
// rijen. Eén bron voor allebei, zodat het kaartje en het venster niet uit
// elkaar kunnen lopen.
function _houderRijen(soort, naam, bron, { metBoek = true } = {}) {
  if (soort === 'class')   return _klasseRijen(naam);
  if (soort === 'species') return _volkRijen(naam);
  if (soort === 'background') return _achtergrondRijen(naam);
  const data = _houderVan(soort, naam, bron);
  const veld = window._subSignatureVoor?.(naam);
  return [
    veld ? ['Eigen veld', veld.feature] : null,
    // In het venster staat het boek al in de regel bovenaan; twee keer
    // hetzelfde boek onder elkaar is er een te veel.
    metBoek && data?.boek ? ['Uit', data.boek] : null,
  ].filter(Boolean);
}

function _kaartVenster(soort, naam, bron = '') {
  const data = _houderVan(soort, naam, bron);
  if (!data) { window._showToast?.(`${naam} staat niet in deze campagne.`); return; }
  const uitleg = String(data.desc || '').trim();
  const beeld  = _hbBeeld(soort, naam);
  const focus  = _hbBeeldRuw(soort, naam)?.focus || '';
  const veilig = esc(naam).replace(/'/g, "\\'");
  const veiligB = esc(bron || '').replace(/'/g, "\\'");
  const soortLabel = soort === 'subclass'
    ? (_bron?.prog?.classes?.[bron]?.subclassLabel || 'Subclass')
    : { class: 'Class', species: 'Origin', background: 'Background' }[soort] || soort;
  const meta = [soortLabel, soort === 'subclass' ? bron : '', data.boek || '']
    .filter(Boolean).map(esc).join(' · ');
  const rijen = _houderRijen(soort, naam, bron, { metBoek: false });
  // De knop naar de spreukenlijst stond op het kaartje zelf en viel daar weg
  // zodra de kerngegevens de hoogte opmaakten. Hier is er plaats voor.
  const naarSpreuken = soort === 'class' && (_spreukAantal?.get(naam) || 0);
  const { aantal, rijen: features, elders } = _houderFeaturesHtml(soort, naam, bron);

  window.app.openModal(naam, '', `
    <div class="vd-subvenster">
      ${beeld ? `<div class="vd-kv-beeld" style="background-image:url('${beeld}')${focus ? `;background-position:${esc(focus)}` : ''}"></div>` : ''}
      <p class="vd-subvenster-meta">${meta}</p>
      ${data.ondertitel ? `<p class="vd-kv-onder">${esc(String(data.ondertitel).trim())}</p>` : ''}
      ${uitleg
        ? `<div class="prog-detail-desc">${_bron?.md?.(uitleg) ?? esc(uitleg)}</div>`
        : `<p class="dm-hint">Er staat nog geen uitleg bij deze ${esc(soortLabel.toLowerCase())}. ${isDM() ? 'Schrijf hem erbij — dan leest iedereen aan tafel hetzelfde.' : 'Vraag je DM of hij hem invult.'}</p>`}
      ${rijen.length ? `<dl class="vk-training vd-kv-training">
        ${rijen.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
      </dl>` : ''}
      ${naarSpreuken || isDM() ? `<div class="spreuk-dm-knoppen">
        ${naarSpreuken ? `<button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.naarSpreuken('${veilig}')">${icon('book-open')} Spreukenlijst</button>` : ''}
        ${isDM() ? `<button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.kaartBewerken('${esc(soort)}','${veilig}','${veiligB}')">${icon('pencil')} ${uitleg ? 'Kaartje bewerken' : 'Uitleg toevoegen'}</button>` : ''}
      </div>` : ''}
      ${soort === 'background' ? '' : `
        <div class="vd-subvenster-kop">${aantal ? `${aantal} ${aantal === 1 ? 'feature' : 'features'}${elders ? ' — elders' : ''}` : 'Nog geen features'}</div>
        ${elders ? `<p class="vd-elders-noot">Deze staan niet in de app: hun tekst komt uit een boek en mag hier niet staan. Dit zijn hun namen, zodat je weet wat je krijgt — klik er een aan om hem op te zoeken.</p>` : ''}
        ${features || `<p class="dm-hint">De features komen uit het boek en mogen daar niet uit overgenomen worden. ${isDM() ? 'Tik ze zelf in met de plusknop rechtsboven, of lees ze in van een andere DM.' : ''}</p>`}`}
    </div>`);
}

// ── De uitleg van een houder schrijven ──────────────────────────────────────
// Een houder (een class, subclass, species of background) heeft geen level en
// geen features van zichzelf, maar wel een verhaal. Dat is wat hier in gaat.
// Het beeld van een kaart vastleggen: één plek, want het venster en de
// bewaarknop doen het allebei.
async function _kaartBeeldZet(soort, naam, waarde) {
  const veld = soort === 'subclass' ? 'subclassen' : soort === 'species' ? 'species' : 'klassen';
  await api.saveHeldenboek({ [veld]: { [naam]: waarde } });
  const m = window.app?.state?.meta;
  if (m) {
    m.heldenboek = m.heldenboek || {};
    const bak = { ...(m.heldenboek[veld] || {}) };
    if (waarde) bak[naam] = waarde; else delete bak[naam];
    m.heldenboek[veld] = bak;
  }
  _bandHerteken();
}

// De knoppen en de focuskiezer van de afbeelding. Apart, omdat alleen dít
// stuk ververst als je een andere plaat kiest — hertekende het venster zich
// helemaal, dan was alles wat je er net in had getypt weg, en schreef
// *Bewaren* daarna de oude tekst terug.
function _beeldBlokHtml(soort, veiligeNaam, beeld) {
  return `
    <div class="vaardig-img-rij">
      <button class="dm-btn dm-btn-ghost dm-btn-sm"
        onclick="window.vaardigheden.kaartBeeld('${esc(soort)}','${veiligeNaam}')">${icon('image')} ${beeld?.id ? 'Andere kiezen' : 'Kiezen of uploaden'}</button>
      ${beeld?.id ? `<button class="dm-btn dm-btn-ghost dm-btn-sm"
        onclick="window.vaardigheden.kaartBeeldWeg('${esc(soort)}','${veiligeNaam}')">${icon('x')} Weghalen</button>` : ''}
    </div>
    <div id="vd-kaart-fp">${beeld?.id ? (window._fpBlokHtml?.({
      src: `/api/files/${esc(beeld.id)}`,
      value: beeld.focus || '50% 50%',
      previews: [{ cls: 'fp-prev--hoog', label: 'De kaart' }],
    }) || '') : ''}</div>`;
}

// Alleen het beeldblok opnieuw tekenen, met de velden eromheen onaangeroerd.
function _beeldBlokVernieuwen(soort, naam, beeld) {
  const host = document.getElementById('vd-beeldblok');
  if (!host) return;
  host.innerHTML = _beeldBlokHtml(soort, String(naam).replace(/'/g, "\\'"), beeld);
  const kaart = document.getElementById('vd-kaart-bewerk');
  if (kaart) { if (beeld?.id) kaart.dataset.beeld = beeld.id; else delete kaart.dataset.beeld; }
  window._fpTeken?.();
}

function _uitlegVenster(soort, naam, bron) {
  const h = _houderVan(soort, naam, bron);
  if (!h) { alert(`${naam} staat niet in deze campagne.`); return; }
  const veilig = esc(naam).replace(/'/g, "\\'");
  const veiligB = esc(bron || '').replace(/'/g, "\\'");
  const beeld = _hbBeeldRuw(soort, naam);
  const soortLabel = { class: 'class', subclass: 'subclass', species: 'species', background: 'background' }[soort] || soort;

  window.app.openModal(`${naam} bewerken`, '', `
    <div class="dm-feature-section" style="margin:0" id="vd-kaart-bewerk"
      data-soort="${esc(soort)}" data-naam="${esc(naam)}" data-bron="${esc(bron || '')}"
      data-beeld="${esc(beeld?.id || '')}">
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-houder-onder">Ondertitel</label>
        <input class="dm-input" id="vd-houder-onder" maxlength="120" value="${esc(h.ondertitel || '')}"
          placeholder="Eén regel onder de soort — bijv. &quot;Woede als wapen&quot;">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Beschrijving</label>
        ${window._fmtToolbarHtml?.('vd-houder-desc') ?? ''}
        <textarea class="dm-input" id="vd-houder-desc" rows="8"
          placeholder="Wat is dit? Dit staat bovenaan het kaartje, vóór de features.">${esc(_schoonVoorEditor(h.desc || ''))}</textarea>
      </div>
      <!-- Een eigen kleur voor een subclass. Die kleurt zijn kaartje én de
           features eronder, zodat je aan tafel in één oogopslag ziet wat van
           de Berserker is en wat van de Zealot — juist als je er twee hebt
           aangevinkt om te vergelijken.
           (Geen backticks in commentaar hierbinnen: template literal.) -->
      ${soort === 'subclass' ? `
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-houder-kleur">Kleur</label>
        <div class="vd-kleurrij">
          <input type="color" class="vd-kleurveld" id="vd-houder-kleur"
            value="${esc(h.kleur || window._subSignatureVoor?.(naam)?.kleur || '#5a2e8a')}">
          <span class="dm-hint" style="margin:0">Kleurt dit kaartje en zijn features.</span>
        </div>
      </div>` : ''}
      <div class="dm-form-row">
        <label class="dm-form-label">Uit welk boek?</label>
        <input class="dm-input" id="vd-houder-boek" maxlength="120" value="${esc(h.boek || '')}"
          placeholder="Bijv. Xanathar's Guide to Everything — of leeg als je het zelf verzon">
      </div>
      <!-- De afbeelding hoort hier, niet achter een eigen knopje op de kaart:
           dan staat de focuskiezer er meteen bij en is er één plek waar je dit
           kaartje bijwerkt. -->
      <div class="dm-form-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <label class="dm-form-label">Afbeelding</label>
        <div id="vd-beeldblok">${_beeldBlokHtml(soort, veilig, beeld)}</div>
      </div>
      <div class="dm-feature-row" style="margin-top:8px">
        <button class="dm-btn dm-btn-primary" onclick="window.vaardigheden.bewaarUitleg('${esc(soort)}','${veilig}','${veiligB}')">${icon('save')} Bewaren</button>
      </div>
      <p class="dm-hint">Je bewerkt de ${esc(soortLabel)} zelf. De features eronder hebben hun eigen kaartje.</p>
    </div>`, 'hulp_heldenboek_kaart');
}

function _open(key, vanWaar = null) {
  const it = (_all || []).find(x => x.key === key);
  if (!it) return;
  // `vanWaar` wordt hieronder gelezen voor de terugknop; het stond hier ook in
  // een `_vanWaar` die nergens bestond, en dáár brak elk featurevenster op:
  // toewijzen aan een naam die niet verklaard is gooit in een module.
  _vanWaarNu = key;                 // verwijzingen in deze tekst wijzen hierheen terug
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const tekst = _tekst(it);
  const body = tekst
    ? `<div class="prog-detail-desc">${_verwijzingen(_bron?.md?.(tekst) ?? esc(tekst))}</div>`
    : (_bron?.geenTekstBlok?.(it.naam) ?? '');
  // Kwam je ergens vandaan, dan hoort er een weg terug te zijn. Zonder dit
  // opende een background zijn feat en stond je vast: het featkaartje weet
  // niets van de background die ernaar wees.
  const terug = (() => {
    const vorige = vanWaar ? (_all || []).find(x => x.key === vanWaar) : null;
    return vorige
      ? `<button class="vaardig-terug" onclick="window.vaardigheden.open('${esc(vorige.key)}')">
           ${icon('chevron-left')} Terug naar ${esc(vorige.naam)}</button>`
      : '';
  })();
  // De DM stelt de afbeelding hier in, niet in de bewerkmodal: bij de spreuken
  // gaat het ook zo, en dan hoef je voor een plaatje niet eerst het potlood.
  const dmBeeld = isDM() ? `
      ${it.img ? `<div class="vaardig-detail-imgwrap">
        <img class="vaardig-detail-img" id="vaardig-detail-img" src="/api/files/${esc(it.img)}" alt=""
          style="${it.imgFocus ? `object-position:${esc(it.imgFocus)}` : ''}">
      </div>
      <details class="spreuk-focus-blok">
        <summary>${icon('image')} Focuspunt bijstellen</summary>
        <div class="spreuk-focus-body">${window._fpBlokHtml?.({
          src: `/api/files/${esc(it.img)}`, value: it.imgFocus || '50% 50%',
          previews: [{ cls: 'fp-prev--breed', label: 'Kaartje' }],
        }) || ''}</div>
      </details>` : ''}
      <div class="spreuk-dm-knoppen">
        <!-- "Afbeelding kiezen of uploaden" en "Afbeelding weghalen" stonden
             hier naast "Bewerken", terwijl de bewerkmodus allebei al doet —
             en daar staat ook de focuskiezer bij. Twee wegen naar hetzelfde,
             waarvan er één minder kan. -->
        <button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.bewerk('${esc(it.key)}')">
          ${icon('pencil')} Bewerken</button>
      </div>` : '';

  window.app.openModal(it.naam, '', `
    <div class="prog-detail">
      <div class="prog-detail-body">
        ${terug}
        <div class="prog-detail-chips">
          <span class="prog-detail-chip">${icon(_itemIcoon(it))} ${esc(s.label)}</span>
          ${_bronRegel(it) ? `<span class="prog-detail-chip">${esc(_bronRegel(it))}</span>` : ''}
          ${it.level ? `<span class="prog-detail-chip">Level ${it.level}</span>` : ''}
        </div>
        ${dmBeeld}
        ${body}
        ${_featKoppelingHtml(it)}
      </div>
    </div>`);
  // De gedeelde focuskiezer schrijft naar déze vaardigheid tot een ander blok
  // hem claimt (zelfde afspraak als in het spreukdetail).
  window._fpOnChange = isDM() && it.img ? (v => _zetBeeldFocus(it, v)) : null;
  // Het lexicon leest mee, net als in het spreukdetail en het statblok.
  const el = document.querySelector('#modal-overlay .prog-detail');
  if (el) window.glossary?.applyDom?.(el);
}

// ── Afbeelding vanuit het detailvenster ───────────────────────────
// Eén regel opnieuw wegschrijven. De route vervangt de hele regel, dus gaat
// alles mee wat we al weten — anders verdwijnt de beschrijving bij het zetten
// van een plaatje.
async function _bewaarBeeld(it, velden) {
  // `seedFeats` hoort hier net zo goed bij als in de editor. De featbibliotheek
  // (51 general + 12 Epic Boons) zit niet in de progressie-seed maar in de
  // frontend; schrijft deze campagne haar eerste featregel via dit pad, dan
  // bestaat `prog.feats.general` daarna uit dat ene ding en zijn de rest weg.
  // De editor stuurde hem al mee, dit pad niet — en een afbeelding opplakken is
  // precies zo'n eerste schrijfactie.
  await api.post('/progression/feature', {
    oud: { soort: it.soort, bron: it.bron, sub: it.sub, level: it.level, naam: it.naam },
    soort: it.soort, bron: it.bron, sub: it.sub || '', level: it.level || 1,
    naam: it.naam, desc: it.desc || '', herkomst: it.herkomst || '',
    img: it.img || null, imgFocus: it.imgFocus || '',
    seedFeats: (it.soort === 'feat' || it.soort === 'boon') ? _bron?.feats : undefined,
    ...velden,
  });
  Object.assign(it, { img: velden.img || '', imgFocus: velden.imgFocus ?? (velden.img ? it.imgFocus : '') });
  _paint();
}

let _focusTimer = null;
function _zetBeeldFocus(it, focus) {
  const img = document.getElementById('vaardig-detail-img');
  if (img) img.style.objectPosition = focus;
  clearTimeout(_focusTimer);
  // Niet bij elke sleepstap schrijven.
  _focusTimer = setTimeout(() => { _bewaarBeeld(it, { img: it.img, imgFocus: focus }).catch(() => {}); }, 350);
}

// ── Bewerken en toevoegen (DM) ────────────────────────────────────
// Eén venster voor allebei. Wat de DM hier schrijft is campagnedata: de eerste
// bewerking legt de meegeleverde seed vast in progression.json (zie de route),
// daarna is het van deze campagne.
function _bronnenVanSoort(soort) {
  const prog = _bron?.prog || {};
  if (soort === 'class' || soort === 'subclass') return Object.keys(prog.classes || {}).sort();
  if (soort === 'species')    return Object.keys(prog.species || {}).sort();
  if (soort === 'background') return Object.keys(_bron?.backgrounds || {}).sort();
  return [];
}
function _subklassenVan(klasse) {
  return Object.keys(_bron?.prog?.classes?.[klasse]?.subclasses || {}).sort();
}

let _edit = null;    // { oud, soort, bron, sub, level, naam, desc, herkomst, img }

// Wat kun je hier maken? Twee heel verschillende dingen, en die zaten door
// elkaar: een **houder** (een class, een species) is een ding op zichzelf, een
// **feature** is een regel binnen zo'n houder. Het formulier vroeg altijd om
// een level en een beschrijving, ook als je een class wilde beginnen — en dat
// kon pas als je er meteen een feature bij verzon.
const _MAAKSELS = [
  { id: 'f-class',      label: 'Feature van een class',    houder: false, soort: 'class' },
  { id: 'f-subclass',   label: 'Feature van een subclass', houder: false, soort: 'subclass' },
  { id: 'f-species',    label: 'Trait van een species',    houder: false, soort: 'species' },
  { id: 'feat',         label: 'Feat',                     houder: false, soort: 'feat' },
  { id: 'boon',         label: 'Epic Boon',                houder: false, soort: 'boon' },
  { id: 'f-background', label: 'Onderdeel van een background', houder: false, soort: 'background' },
  { id: 'h-class',      label: 'Een nieuwe class',         houder: true,  soort: 'class' },
  { id: 'h-subclass',   label: 'Een nieuwe subclass',      houder: true,  soort: 'subclass' },
  { id: 'h-species',    label: 'Een nieuw species',        houder: true,  soort: 'species' },
  { id: 'h-background', label: 'Een nieuwe background',    houder: true,  soort: 'background' },
];
const _MAAKSEL = id => _MAAKSELS.find(m => m.id === id) || _MAAKSELS[0];

// Wat vraag je als naam? "Vlasbaards Greep" is een prima feature, maar een
// rare class.
const _NAAM_HINT = {
  'h-class': 'Bijv. Artificer', 'h-subclass': 'Bijv. Path of the Ashen Road',
  'h-species': 'Bijv. Leemlander', 'h-background': 'Bijv. Veerman',
  feat: 'Bijv. Sentinel', boon: 'Bijv. Epic Boon of Fortitude',
};

function _editorHtml() {
  const e = _edit;
  const maaksel = _MAAKSEL(e.maaksel);
  const houder  = maaksel.houder;
  const bronnen = _bronnenVanSoort(e.soort);
  const toonBron   = houder ? maaksel.soort === 'subclass' : bronnen.length > 0;
  const toonSub    = !houder && e.soort === 'subclass';
  // Een houder zit niet op een level: die heeft er juist een hele reeks.
  const toonLevel  = !houder && (e.soort === 'class' || e.soort === 'subclass' || e.soort === 'species');
  // Een feat hangt aan niemand: iedereen mag hem nemen. Juist daarom is "waar
  // sluit hij op aan" een eigen vraag — en het antwoord is er niet, want van 58
  // van de 67 feats hebben we geen tekst om het uit af te leiden. Dus vraagt de
  // app het: één keer invullen, en het geldt voor de hele campagne.
  const toonKoppeling = e.soort === 'feat' || e.soort === 'boon';
  const klassen = Object.keys(_bron?.prog?.classes || {});
  const aan = new Set(e.sluitAan || []);
  const subs = toonSub ? _subklassenVan(e.bron) : [];
  return `
    <div class="dm-feature-section" style="margin:0">
      <div class="dm-form-row">
        <label class="dm-form-label">Soort</label>
        <select class="dm-input" id="vd-soort" onchange="window.vaardigheden.veld('maaksel',this.value)">
          <optgroup label="Een regel binnen iets">
            ${_MAAKSELS.filter(m => !m.houder).map(m => `<option value="${m.id}"${e.maaksel === m.id ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}
          </optgroup>
          <optgroup label="Iets nieuws beginnen">
            ${_MAAKSELS.filter(m => m.houder).map(m => `<option value="${m.id}"${e.maaksel === m.id ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      ${toonBron ? `
      <!-- Zoekbaar invoerveld en geen keuzelijst: uit een lijst kun je alleen
           kiezen wat er al is, en dan kun je dus nooit een **eigen class**
           beginnen. Typ je een naam die er nog niet is, dan legt de server hem
           aan. Zelfde patroon als de entiteit-kiezers in de Meesterkamer. -->
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-bron">${e.soort === 'species' ? 'Species' : e.soort === 'background' ? 'Background' : 'Class'}</label>
        <input class="dm-input" id="vd-bron" list="vd-bron-dl" autocomplete="off"
          value="${esc(e.bron || '')}" placeholder="Kies er een, of typ een nieuwe naam"
          onchange="window.vaardigheden.veld('bron',this.value)">
        <datalist id="vd-bron-dl">${bronnen.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist>
      </div>` : ''}
      ${toonSub ? `
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-sub">Subclass</label>
        <input class="dm-input" id="vd-sub" list="vd-sub-dl" autocomplete="off"
          value="${esc(e.sub || '')}" placeholder="Kies er een, of typ een nieuwe naam"
          onchange="window.vaardigheden.veld('sub',this.value)">
        <datalist id="vd-sub-dl">${subs.map(b => `<option value="${esc(b)}"></option>`).join('')}</datalist>
      </div>` : ''}
      ${toonLevel ? `
      <div class="dm-form-row">
        <label class="dm-form-label">Level</label>
        <select class="dm-input" id="vd-level">
          ${Array.from({ length: 20 }, (_, i) => i + 1).map(i => `<option value="${i}"${Number(e.level) === i ? ' selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="dm-form-row">
        <label class="dm-form-label">Naam</label>
        <input class="dm-input" id="vd-naam" value="${esc(e.naam || '')}"
          placeholder="${esc(_NAAM_HINT[maaksel.id] || 'Bijv. Vlasbaards Greep')}">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-herkomst">Herkomst</label>
        <select class="dm-input" id="vd-herkomst" onchange="window.vaardigheden.veld('herkomst',this.value)"
          title="Wat je later met een andere campagne mag delen: zelf verzonnen mag mee, overgenomen materiaal niet.">
          ${HERKOMST.map(h => `<option value="${esc(h.value)}"${(e.herkomst || '') === h.value ? ' selected' : ''}>${esc(h.label)}</option>`).join('')}
        </select>
      </div>
      <!-- Wáár het vandaan komt, in woorden. De keuzelijst hierboven zegt
           alleen óf het overgenomen is; bij "ja" wil je weten waaruit, anders
           is over een jaar niet meer na te gaan wat er gedeeld mag worden. -->
      ${e.herkomst && e.herkomst !== 'zelfbedacht' ? `
      <div class="dm-form-row">
        <label class="dm-form-label" for="vd-bronnaam">Waaruit?</label>
        <input class="dm-input" id="vd-bronnaam" maxlength="120" value="${esc(e.bron || '')}"
          placeholder="Bijv. Xanathar's Guide to Everything, of: van een tafelgenoot">
      </div>` : ''}
      <div class="dm-form-row">
        <label class="dm-form-label">Beschrijving</label>
        ${window._fmtToolbarHtml?.('vd-desc') ?? ''}
        <textarea class="dm-input" id="vd-desc" rows="${houder ? 6 : 9}"
          placeholder="${houder ? 'Wat is dit? Dit staat bovenaan het kaartje, vóór de features.' : 'Wat doet het? Een lege regel begint een nieuwe alinea.'}">${esc(e.desc || '')}</textarea>
      </div>

      ${toonKoppeling ? `
      <div class="dm-form-row" style="flex-direction:column;align-items:stretch;gap:5px">
        <label class="dm-form-label">Sluit aan op</label>
        <p class="dm-hint" style="margin:0 0 3px">Welke klassen hebben hier iets aan? Dat kan zijn omdat de feat ze noemt (Magic Initiate geeft clericspreuken) of omdat hij bij hun manier van spelen hoort. Hij blijft voor iedereen te kiezen — dit is een wegwijzer, geen eis.</p>
        <div class="vd-klassen">
          ${klassen.map(k => `
            <label class="vd-klasse${aan.has(k) ? ' is-aan' : ''}">
              <input type="checkbox" class="vd-klasse-vink" value="${esc(k)}"${aan.has(k) ? ' checked' : ''}>
              ${icon(KLASSE_ICOON[k] || 'sword')} ${esc(k)}
            </label>`).join('')}
        </div>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Vereist</label>
        <input class="dm-input" id="vd-vereist" value="${esc(e.vereist || '')}"
          placeholder="bv. Medium armor training, of Strength 13">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Geeft spreuk</label>
        <input class="dm-input" id="vd-geeft" value="${esc((e.geeftSpreuk || []).join(', '))}"
          placeholder="bv. Misty Step, Detect Thoughts">
      </div>
      <p class="dm-hint" style="margin:-6px 0 10px">Namen met een komma ertussen. De app zoekt op welke klassenlijsten die spreuken staan, en zet de feat daar bij <em>Geeft een spreuk</em>.</p>
      <p class="dm-hint" style="margin:-6px 0 10px">Staat hier een armor training in, dan rekent de app zelf uit welke klassen die geven — die hoef je niet aan te vinken.</p>` : ''}
      <div class="dm-form-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <label class="dm-form-label">Afbeelding</label>
        <div class="vaardig-img-rij">
          <button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.vaardigheden.kiesAfbeelding()">${icon('image')} ${e.img ? 'Andere kiezen' : 'Kiezen of uploaden'}</button>
          ${e.img ? `<button class="dm-btn dm-btn-ghost dm-btn-sm" onclick="window.vaardigheden.wisAfbeelding()">${icon('x')} Weghalen</button>` : ''}
        </div>
        ${e.img ? `<!-- Dezelfde kiezer als op een kaartje, in het spreukdetail en
             bij de aktebanner: één plek waar het focuspunt gekozen wordt
             (window._fpBlokHtml). De preview toont de echte uitsnede. -->
          ${window._fpBlokHtml?.({
            src: `/api/files/${esc(e.img)}`,
            value: e.imgFocus || '50% 50%',
            previews: [{ cls: 'fp-prev--breed', label: 'Kaartje' }],
          }) ?? ''}` : ''}
      </div>
    </div>
    <div class="dm-feature-row" style="justify-content:flex-end">
      ${e.oud ? `<button class="dm-btn dm-btn-danger" onclick="window.vaardigheden.verwijder()">${icon('trash')} Verwijderen</button>` : ''}
      <button class="dm-btn dm-btn-ghost" onclick="window.app.closeModal()">Annuleren</button>
      <button class="dm-btn dm-btn-primary" onclick="window.vaardigheden.bewaar()">${icon('save')} Opslaan</button>
    </div>`;
}

// Wat er in het tekstvak komt te staan. De SRD-teksten dragen de opmaak van de
// bron-pdf mee: afbreekstreepjes ("Blud- geoning") en een inspringing aan het
// begin van elke alinea. In de weergave worden die weggepoetst, maar in de
// bewerkstand kijk je naar de rauwe tekst — en wat je daar ziet, sla je ook zo
// weer op. Dus poetsen we hier, bij het inladen.
function _schoonVoorEditor(tekst) {
  return _schoonTekst(tekst)
    .split('\n')
    .map(r => r.replace(/^[ \t]+/, ''))
    .join('\n')
    .trim();
}

function _editorOpen(it) {
  // Een background is in deze lijst één kaartje met zijn onderdelen eronder;
  // dat bewerk je niet als één tekst. (De onderdelen zelf staan in de
  // progressie-editor.)
  if (it?.bg) { alert('Een background bewerk je in de progressie-editor — dit kaartje is de samenvatting van zijn onderdelen.'); return; }
  const eersteKlasse = Object.keys(_bron?.prog?.classes || {})[0] || '';
  _edit = it
    ? { oud: { soort: it.soort, bron: it.bron, sub: it.sub, level: it.level, naam: it.naam },
        soort: it.soort, bron: it.bron, sub: it.sub || '', level: it.level || 1,
        naam: it.naam, desc: _schoonVoorEditor(it.desc || ''), herkomst: it.herkomst || '',
        bronTekst: it.bronTekst || '', img: it.img || '', imgFocus: it.imgFocus || '',
        sluitAan: Array.isArray(it.sluitAan) ? [...it.sluitAan] : [], vereist: it.vereist || '',
        geeftSpreuk: Array.isArray(it.geeftSpreuk) ? [...it.geeftSpreuk] : [] }
    : { oud: null, maaksel: 'feat', soort: 'feat', bron: 'Feats', sub: '', level: 1, naam: '', desc: '', herkomst: 'zelfbedacht', bron_: '', img: '', imgFocus: '',
        sluitAan: [], vereist: '', geeftSpreuk: [] };
  // Bij bewerken weten we welk soort het is; dat is altijd een regel binnen
  // iets, nooit een houder.
  if (it) _edit.maaksel = { class: 'f-class', subclass: 'f-subclass', species: 'f-species',
    feat: 'feat', boon: 'boon', background: 'f-background' }[it.soort] || 'f-class';
  // De kiezer bewaart hier niet meteen (dat doet het spreukdetail); de waarde
  // gaat mee met het formulier. Haak dus leegmaken, anders schrijft een eerder
  // geopend venster mee.
  window._fpOnChange = null;
  window.app.openModal(it ? `${it.naam} bewerken` : 'Iets toevoegen aan het Heldenboek', '', _editorHtml(),
    'hulp_heldenboek_editor');
}

// Wat er in de velden staat, terug in _edit — nodig zodra het venster
// zichzelf opnieuw tekent (van soort wisselen wisselt de velden).
function _editorLees() {
  const v = id => document.getElementById(id)?.value;
  if (v('vd-naam') !== undefined) _edit.naam = v('vd-naam');
  if (v('vd-desc') !== undefined) _edit.desc = v('vd-desc');
  if (v('vd-herkomst') !== undefined) _edit.herkomst = v('vd-herkomst');
  if (v('vd-level') !== undefined) _edit.level = Number(v('vd-level')) || 1;
  if (v('vd-sub') !== undefined) _edit.sub = v('vd-sub');
  if (v('vd-bron') !== undefined) _edit.bron = v('vd-bron');
  if (v('vd-vereist') !== undefined) _edit.vereist = v('vd-vereist');
  if (v('vd-bronnaam') !== undefined) _edit.bronTekst = v('vd-bronnaam');
  if (v('vd-geeft') !== undefined) {
    _edit.geeftSpreuk = v('vd-geeft').split(',').map(x => x.trim()).filter(Boolean);
  }
  const vinkjes = document.querySelectorAll('.vd-klasse-vink');
  if (vinkjes.length) _edit.sluitAan = [...vinkjes].filter(c => c.checked).map(c => c.value);
  // De focuskiezer staat buiten de gewone velden; zijn waarde leest hij zelf uit.
  const fp = window._fpWaarde?.();
  if (fp && document.querySelector('#m-body .fp-blok')) _edit.imgFocus = fp;
}

function _editorHerteken() {
  // Het gedeelde venster vult `#m-body`; de minimale hoogte die openModal
  // vastzet blijft staan, dus het venster springt niet bij het wisselen.
  const body = document.getElementById('m-body');
  if (body) body.innerHTML = _editorHtml();
}

// ── Publieke API ──────────────────────────────────────────────────
window.vaardigheden = {
  open: _open,
  // Eén plusknop voor het hele Heldenboek, in de kopbalk naast de hulpknop.
  // Hij hoeft niet dom te zijn: sta je in Barbarian, dan is een feature van
  // deze class het waarschijnlijkste, en staat de class al ingevuld. Sta je op
  // de keuzelaag van Classes, dan is het een nieuwe class.
  nieuw() {
    _editorOpen(null);
    const maaksel = (_filters.bron && _deur === 'class') ? 'f-class'
      : (_filters.bron && _deur === 'species') ? 'f-species'
      : (_filters.bron && _deur === 'background') ? 'f-background'
      : _deur === 'class' ? 'h-class'
      : _deur === 'species' ? 'h-species'
      : _deur === 'background' ? 'h-background'
      : 'feat';
    setTimeout(() => {
      this.veld('maaksel', maaksel);
      if (_filters.bron && !maaksel.startsWith('h-')) { _edit.bron = _filters.bron; _editorHerteken(); }
    }, 60);
  },
  bewerk(key) { _editorOpen((_all || []).find(x => x.key === key)); },
  // Kiezen gaat via dezelfde mediabibliotheek als in de bewerkmodal; het
  // detailvenster tekent zichzelf daarna opnieuw, zodat het beeld er staat.
  veld(naam, waarde) {
    _editorLees();
    _edit[naam] = waarde;
    // "Wat maak je?" bepaalt de soort én of het een houder is; de rest van het
    // formulier hangt daaraan.
    if (naam === 'maaksel') {
      const m = _MAAKSEL(waarde);
      _edit.soort = m.soort;
      if (m.houder) { _edit.bron = m.soort === 'subclass' ? (_edit.bron || '') : ''; _edit.sub = ''; }
      else if (m.soort === 'feat') _edit.bron = 'Feats';
      else if (m.soort === 'boon') _edit.bron = 'Epic Boons';
      else _edit.bron = _bronnenVanSoort(m.soort)[0] || '';
      if (m.soort === 'subclass' && !m.houder) _edit.sub = _subklassenVan(_edit.bron)[0] || '';
      _editorHerteken();
      return;
    }
    if (naam === 'herkomst') { _editorHerteken(); return; }
    if (naam === 'soort') {
      // Van soort wisselen betekent een andere bron: pak de eerste die past.
      const b = _bronnenVanSoort(waarde);
      _edit.bron = waarde === 'feat' ? 'Feats' : waarde === 'boon' ? 'Epic Boons' : (b[0] || '');
      _edit.sub  = waarde === 'subclass' ? (_subklassenVan(_edit.bron)[0] || '') : '';
    }
    if (naam === 'bron' && _edit.soort === 'subclass') _edit.sub = _subklassenVan(waarde)[0] || '';
    _editorHerteken();
  },
  kiesAfbeelding() {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    _editorLees();
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: (_edit.naam || 'vaardigheid').toLowerCase().replace(/\s+/g, '-'),
      onSelect: async (srcId) => {
        // Een eigen id, zodat de afbeelding blijft staan als de naam verandert.
        const id = _edit.img || `feat-img-${Math.random().toString(36).slice(2, 10)}`;
        try {
          await api.copyFile(id, srcId);
          _edit.img = id;
          _editorHerteken();
        } catch (e) { alert('Afbeelding instellen mislukt: ' + e.message); }
      },
    });
  },
  wisAfbeelding() { _editorLees(); _edit.img = ''; _edit.imgFocus = ''; _editorHerteken(); },
  async bewaar() {
    _editorLees();
    if (!_edit.naam.trim()) { document.getElementById('vd-naam')?.focus(); return; }
    const maaksel = _MAAKSEL(_edit.maaksel);
    try {
      // Een houder is geen regel: andere route, andere velden. Hij heeft geen
      // level — wél een beschrijving, want "wat is een Berserker" is iets
      // anders dan wat zijn features doen.
      if (maaksel.houder) {
        await api.nieuweHouder({ soort: maaksel.soort, naam: _edit.naam.trim(), bron: _edit.bron || '',
          desc: _edit.desc || '', boek: _edit.bronTekst || '', herkomst: _edit.herkomst || '' });
        window.app.closeModal();
        _all = null;
        await _load(); await _klasseExtra();
        _bandHerteken(); _refreshFilterBar(); _paint();
        window._showToast?.(`${_edit.naam.trim()} staat erin.`);
        return;
      }
      await api.post('/progression/feature', {
        oud: _edit.oud, soort: _edit.soort, bron: _edit.bron, sub: _edit.sub,
        level: _edit.level, naam: _edit.naam.trim(), desc: _edit.desc,
        // `bron` is hierboven al de class/het species; de **vindplaats** is een
        // eigen veld, anders botsen twee betekenissen op één naam.
        herkomst: _edit.herkomst, bronTekst: _edit.bronTekst || '',
        sluitAan: _edit.sluitAan || [], vereist: _edit.vereist || '', geeftSpreuk: _edit.geeftSpreuk || [],
        // Bij een feat of Epic Boon: de bibliotheek mee, zodat de server hem
        // vastlegt als deze campagne er nog geen eigen had (zie de route).
        seedFeats: (_edit.soort === 'feat' || _edit.soort === 'boon') ? _bron?.feats : undefined,
      });
      window.app.closeModal();
      _all = null;
      await _load();
      _refreshFilterBar();
      _paint();
    } catch (e) { alert('Opslaan mislukt: ' + e.message); }
  },
  async verwijder() {
    if (!_edit?.oud) return;
    if (!confirm(`"${_edit.oud.naam}" verwijderen uit deze campagne?`)) return;
    try {
      await api.post('/progression/feature/verwijderen', _edit.oud);
      window.app.closeModal();
      _all = null;
      await _load();
      _refreshFilterBar();
      _paint();
    } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
  },
  // De band verandert mee: zodra je typt wordt hij een kruimelpad met de weg
  // terug, en als je het veld leegmaakt staat je deur er weer. Zonder deze
  // hertekening bleef de oude laag staan onder de resultaten.
  search(q) {
    const had = !!(_filters.q || '').trim();
    _filters.q = q || '';
    const heeft = !!(_filters.q || '').trim();
    if (had !== heeft) { _bandHerteken(); _refreshFilterBar(); }
    _paint();
  },
  setSoort(k) { _filters.soort = k || null; _filters.bron = null; _filters.level = null; _refreshFilterBar(); _paint(); },
  setBron(b)  { _filters.bron = b || null; _filters.sub = null; _bandHerteken(); _paint(); },
  // Een klasse, volk of achtergrond uit de band. Een achtergrond heeft geen
  // eigen bron (ze staan allemaal onder "Backgrounds"), dus die zoeken we op
  // naam — dat is hetzelfde kaartje.
  // Een deur openen of sluiten. Alles wat eronder hing gaat mee terug, anders
  // sta je achter een andere deur nog op de class die je daarvoor koos.
  deur(id) {
    _deur = id || null;
    _filters.bron = null; _filters.sub = null; _filters.soort = null;
    _filters.level = null; _filters.q = '';
    _subAan = new Set(); _subKaart = null; _subPagina = 0;
    const zoek = document.querySelector('#section-vaardigheden .sbs-input');
    if (zoek) zoek.value = '';
    _bandHerteken(); _refreshFilterBar(); _paint();
    _cinematisch();
    _container?.querySelector('.spreuk-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  // Eén class, species of background achter de open deur.
  kies(naam) {
    _filters.bron = naam || null;
    _filters.sub = null; _filters.level = null;
    _subAan = new Set(); _subKaart = null; _subPagina = 0;
    _bandHerteken(); _refreshFilterBar(); _paint();
    _cinematisch();
  },
  // Aanvinken: zijn features komen erbij in het raster hiernaast.
  subToggle(naam) {
    if (_subAan.has(naam)) {
      _subAan.delete(naam);
      if (_subKaart === naam) _subKaart = [..._subAan].pop() || null;
    } else {
      _subAan.add(naam);
      _subKaart = naam;      // het kaartje naast de class volgt wat je net koos
    }
    _bandHerteken(); _refreshFilterBar(); _paint();
  },
  // Bekijken: de subclass **zelf**. Dit opende zijn eerste feature — je klikte
  // op Path of the Berserker en kreeg Frenzy, wat leest als een fout in de
  // gegevens. Nu komt zijn eigen uitleg bovenaan en staan de features eronder
  // als lijst; daar klik je door naar de feature die je wil.
  subBekijk(naam) { _kaartVenster('subclass', naam, _filters.bron); },
  // Hetzelfde venster voor elk kaartje in de band.
  kaartOpen(soort, naam, bron) { _kaartVenster(soort, naam, bron || _filters.bron || ''); },
  kiesSub(naam) { this.subToggle(naam); },
  // De lijst bladert per vier; de elders staan er gewoon in, dus er valt
  // niets meer open of dicht te klappen.
  subBlader(richting) { _subPagina = Math.max(0, _subPagina + richting); _bandHerteken(); },
  // Tussen de kaartjes van de aangevinkte subklassen.
  subKaartBlader(richting) {
    const lijst = [..._subAan].filter(x => _bron?.prog?.classes?.[_filters.bron]?.subclasses?.[x]);
    if (lijst.length < 2) return;
    const nu = Math.max(0, lijst.indexOf(_subKaart));
    _subKaart = lijst[(nu + richting + lijst.length) % lijst.length];
    _bandHerteken();
  },
  // Een afbeelding bij een class, een species of een subclass. Eén picker voor
  // alle drie: het is dezelfde handeling.
  // De knop op het kaartje: één venster voor alles.
  kaartBewerken(soort, naam, bron) { _uitlegVenster(soort, naam, bron || _filters.bron || ''); },

  // Een afbeelding kiezen vanuit dat venster. Hij wordt meteen vastgelegd —
  // anders zou de focuskiezer naar een bestand wijzen dat nog nergens staat —
  // en daarna tekent het venster zichzelf opnieuw met de kiezer erin.
  kaartBeeld(soort, naam) {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: soort + '-' + String(naam).toLowerCase(),
      onSelect: async (srcId) => {
        try {
          await _kaartBeeldZet(soort, naam, { id: srcId, focus: '' });
          // **Niet het hele venster hertekenen.** Dat deed het eerst, en dan
          // was de beschrijving die je net had getypt weg — en schreef
          // *Bewaren* daarna de oude tekst terug over de nieuwe heen.
          _beeldBlokVernieuwen(soort, naam, { id: srcId, focus: '' });
          window._showToast?.('Afbeelding geplaatst.');
        } catch (e) { window._showToast?.('Instellen mislukt: ' + (e.message || e)); }
      },
    });
  },
  async kaartBeeldWeg(soort, naam) {
    try {
      await _kaartBeeldZet(soort, naam, null);
      _beeldBlokVernieuwen(soort, naam, null);
    } catch (e) { alert('Weghalen mislukt: ' + e.message); }
  },

  // De uitleg bij een species, net als bij een subclass.
  volkUitleg(volk) { _uitlegVenster('species', volk, ''); },
  // Een zegening of gunst onthullen. Langs dezelfde weg als in het archief,
  // inclusief de waarschuwing als iemand hem draagt; alleen het verversen is
  // hier anders, want we staan in het Heldenboek.
  async zichtbaarheid(id, ev) {
    try {
      await window._toggleVis?.('voorwerpen', id, ev);
      _all = null;
      await _load(); await _klasseExtra();
      _paint();
    } catch (e) { alert('Niet gelukt: ' + e.message); }
  },
  // Een zegening of gunst onthullen. Langs dezelfde weg als in het archief,
  // inclusief de waarschuwing als iemand hem draagt; alleen het verversen is
  // hier anders, want we staan in het Heldenboek.
  async zichtbaarheid(id, ev) {
    try {
      await window._toggleVis?.('voorwerpen', id, ev);
      _all = null;
      await _load(); await _klasseExtra();
      _paint();
    } catch (e) { alert('Niet gelukt: ' + e.message); }
  },
  // Het focuspunt van de afbeelding op een kaart. Dezelfde kiezer als bij een
  // spreuk, een kaartje en de aktebanner — één plek waar dit gekozen wordt.
  // Een zegening of gunst onthullen. Langs dezelfde weg als in het archief,
  // inclusief de waarschuwing als iemand hem draagt; alleen het verversen is
  // hier anders, want we staan in het Heldenboek.
  async zichtbaarheid(id, ev) {
    try {
      await window._toggleVis?.('voorwerpen', id, ev);
      _all = null;
      await _load(); await _klasseExtra();
      _paint();
    } catch (e) { alert('Niet gelukt: ' + e.message); }
  },
  // Een zegening of gunst onthullen. Langs dezelfde weg als in het archief,
  // inclusief de waarschuwing als iemand hem draagt; alleen het verversen is
  // hier anders, want we staan in het Heldenboek.
  async zichtbaarheid(id, ev) {
    try {
      await window._toggleVis?.('voorwerpen', id, ev);
      _all = null;
      await _load(); await _klasseExtra();
      _paint();
    } catch (e) { alert('Niet gelukt: ' + e.message); }
  },
  // Het focuspunt van de afbeelding op een kaart. Dezelfde kiezer als bij een
  // spreuk, een kaartje en de aktebanner — één plek waar dit gekozen wordt.
  kaartFocus(soort, naam) {
    const huidig = _hbBeeldRuw(soort, naam);
    if (!huidig?.id) return;
    window.app.openModal(`Focuspunt — ${naam}`, '', `
      <div class="dm-feature-section" style="margin:0">
        <p class="dm-hint">Welk deel van de afbeelding op de kaart te zien is. Sleep het kruis naar wat er niet af mag vallen.</p>
        ${window._fpBlokHtml?.({
          src: `/api/files/${esc(huidig.id)}`,
          value: huidig.focus || '50% 50%',
          previews: [{ cls: 'fp-prev--hoog', label: 'De kaart' }],
        }) || ''}
        <div class="dm-feature-row" style="margin-top:10px">
          <button class="dm-btn dm-btn-primary" onclick="window.vaardigheden.bewaarKaartFocus('${esc(soort)}','${esc(naam).replace(/'/g, "\\'")}')">${icon('save')} Bewaren</button>
        </div>
      </div>`);
  },
  async bewaarKaartFocus(soort, naam) {
    const focus = window._fpWaarde?.() || document.getElementById('fp-value')?.value || '50% 50%';
    const huidig = _hbBeeldRuw(soort, naam);
    if (!huidig?.id) return;
    const bak = _HB_BAK[soort];
    const veld = soort === 'subclass' ? 'subclassen' : soort === 'species' ? 'species' : 'klassen';
    try {
      await api.saveHeldenboek({ [veld]: { [naam]: { id: huidig.id, focus } } });
      const m = window.app?.state?.meta;
      if (m) { m.heldenboek = m.heldenboek || {}; m.heldenboek[bak] = { ...(m.heldenboek[bak] || {}), [naam]: { id: huidig.id, focus } }; }
      window.app.closeModal();
      _bandHerteken();
      window._showToast?.('Focuspunt bewaard.');
    } catch (e) { alert('Bewaren mislukt: ' + e.message); }
  },
  // Een subclass uit de elders-lijst in deze campagne zetten. Alleen de naam en
  // het boek: de tekst hoort in dat boek te blijven.
  async eldersAan(naam, boek) {
    try {
      await api.nieuweHouder({ soort: 'subclass', naam, bron: _filters.bron || '', boek, herkomst: 'overgenomen' });
    } catch (e) {
      // Bestaat hij al, dan is dat precies wat we wilden en gaan we door.
      if (!/bestaat al/i.test(e.message || '')) { alert('Toevoegen mislukt: ' + e.message); return; }
    }
    _all = null;
    await _load(); await _klasseExtra();
    _subAan.add(naam);
    _bandHerteken(); _refreshFilterBar(); _paint();
    // Zijn features staan er bij naam al in, dus beloof niet dat je ze zelf
    // moet verzinnen; wat ontbreekt is hun tekst.
    const bekend = (_eldersFeatures?.subclasses?.[naam] || []).length;
    window._showToast?.(bekend
      ? `${naam} staat in je campagne. Zijn ${bekend} features staan er bij naam in; hun tekst typ je er zelf bij.`
      : `${naam} staat in je campagne. De features typ je er zelf bij.`);
  },
  // De uitleg van een subclass: wát het is, los van wat het geeft.
  subUitleg(sub) { _uitlegVenster('subclass', sub, _filters.bron); },
  // Een feature openen vanuit het subclassvenster: het ene venster sluit, het
  // andere komt ervoor in de plaats. Twee modals over elkaar is geen stapel
  // die je nog terug kunt lopen.
  uitKaartVenster(key) { window.app.closeModal?.(); setTimeout(() => _open(key), 40); },
  async bewaarUitleg(soort, naam, bron) {
    const desc = document.getElementById('vd-houder-desc')?.value || '';
    const boek = document.getElementById('vd-houder-boek')?.value || '';
    const ondertitel = document.getElementById('vd-houder-onder')?.value || '';
    const kleur = document.getElementById('vd-houder-kleur')?.value || '';
    // Het focuspunt staat in hetzelfde venster, dus het gaat in dezelfde klik
    // mee. Twee keer opslaan voor één bewerking voelt als een fout van de app.
    const beeldId = document.getElementById('vd-kaart-bewerk')?.dataset.beeld || '';
    if (beeldId) {
      const focus = window._fpWaarde?.() || '50% 50%';
      try { await _kaartBeeldZet(soort, naam, { id: beeldId, focus }); } catch { /* het beeld is bijzaak */ }
    }
    try {
      await api.put('/progression/houder', { soort, naam, bron, desc, boek, ondertitel, kleur });
      window.app.closeModal();
      _all = null; await _load(); await _klasseExtra();
      _bandHerteken(); _refreshFilterBar(); _paint();
      window._showToast?.(`De uitleg bij ${naam} staat erin.`);
    } catch (e) { alert('Bewaren mislukt: ' + e.message); }
  },
  // Een beeld bij één class. Staat los van de vier deurkaarten: dit is het
  // portret van de Barbarian, niet van "Classes".
  // Een beeld bij een van de vier kaarten.
  deurBeeld(id) {
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: 'heldenboek-' + id,
      onSelect: async (srcId) => {
        try {
          await api.saveHeldenboek({ beelden: { [id]: srcId } });
          const m = window.app?.state?.meta;
          if (m) { m.heldenboek = m.heldenboek || {}; m.heldenboek.beelden = { ...(m.heldenboek.beelden || {}), [id]: srcId }; }
          _bandHerteken();
          window._showToast?.('Afbeelding geplaatst.');
        } catch (e) { window._showToast?.('Instellen mislukt: ' + (e.message || e)); }
      },
    });
  },
  wisZoek() {
    _filters.q = '';
    const zoek = document.querySelector('#section-vaardigheden .sbs-input');
    if (zoek) zoek.value = '';
    _bandHerteken(); _refreshFilterBar(); _paint();
  },
  // Blijft bestaan voor wie er van buiten naartoe springt (een feat die naar
  // zijn class wijst, de level-up-omslag).
  bandKies(groep, naam) {
    if (!groep || !naam) { this.deur(null); return; }
    _deur = groep === 'background' ? 'background' : groep === 'species' ? 'species' : 'class';
    _filters.q = ''; _filters.soort = null; _filters.level = null;
    _filters.bron = naam; _filters.sub = null;
    const zoek = document.querySelector('#section-vaardigheden .sbs-input');
    if (zoek) zoek.value = '';
    _bandHerteken(); _refreshFilterBar(); _paint();
  },
  // Naar de spreukenbibliotheek met de zeef al op deze klasse — zelfde gebaar
  // als de knop in de level-up-omslag.
  // Vanaf een feat naar de klasse waar hij bij hoort: het venster dicht en de
  // band eronder springt erheen.
  naarKlasse(klasse) {
    window.app.closeModal?.();
    this.bandKies('class', klasse);
    document.querySelector('.vaardig-band')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  // ── Je eigen invoer meenemen ──
  // Wat een DM intikt — subklasseteksten, eigen features, afbeeldingen — blijft
  // nu in zijn campagne. Dit pakt het in één bestand, zodat hij het mee kan
  // nemen naar zijn volgende campagne of kan geven aan wie hetzelfde boek heeft.
  //
  // **Geen knop meer in het Heldenboek** (6 okt 2026). Niemand begreep waarom
  // een downloadpijl juist daar stond, en het hoort ook niet alleen daar:
  // spreuken, tafels en kaartjes hebben hetzelfde probleem. Het wordt één
  // plek voor de hele app — zie docs/todo.md, "Meenemen & overnemen". Tot die
  // tijd blijft dit staan met zijn endpoints en tests: aan te roepen vanuit de
  // console, niet vanaf het scherm. Dit is dus geen dode code die weg mag.
  deelVenster() {
    window.app.openModal('Meenemen of overnemen', '', `
      <div class="dm-feature-section" style="margin:0">
        <div class="dm-section-label">Uitpakken</div>
        <p class="dm-hint">Alles wat jij hier zelf hebt ingetikt gaat in één bestand: eigen classes en subclasses, de teksten, wat je bij een feat invulde en de afbeeldingen die je koos. Daarmee neem je het mee naar een andere campagne, of geef je het aan een andere DM.</p>
        <label class="dm-form-checkbox"><input type="checkbox" id="vd-exp-alles">
          <span>Ook overgenomen materiaal meenemen</span></label>
        <p class="dm-hint">Standaard gaat alleen mee wat je bij <em>Herkomst</em> op <strong>Zelf verzonnen</strong> zette. Overgenomen tekst — uit het Player's Handbook bijvoorbeeld — hoort niet gepubliceerd te worden; neem die alleen mee naar je eigen campagnes, of naar iemand die het boek ook heeft.</p>
        <label class="dm-form-checkbox"><input type="checkbox" id="vd-exp-beeld" checked>
          <span>Afbeeldingen meenemen</span></label>
        <p class="dm-hint">Ze gaan mee in het bestand zelf, want een verwijzing betekent in een andere campagne niets. Dat maakt het bestand wel groot; zet het uit als je alleen de teksten wilt.</p>
        <div class="dm-feature-row" style="margin-top:8px">
          <button class="dm-btn dm-btn-primary" onclick="window.vaardigheden.exporteer()">${icon('save')} Uitpakken</button>
        </div>

        <div class="dm-section-label" style="margin-top:16px">Inpakken</div>
        <p class="dm-hint">Een bestand van een andere DM inlezen. Wat hier al staat blijft staan, tenzij je het laat overschrijven.</p>
        <label class="dm-form-checkbox"><input type="checkbox" id="vd-imp-over">
          <span>Bestaande teksten overschrijven</span></label>
        <div class="dm-feature-row" style="margin-top:8px">
          <input type="file" id="vd-imp-bestand" accept="application/json,.json" style="font-size:12px">
          <button class="dm-btn dm-btn-ghost" onclick="window.vaardigheden.importeer()">${icon('arrow-up-right')} Inlezen</button>
        </div>
      </div>`);
  },
  async exporteer() {
    const alles = document.getElementById('vd-exp-alles')?.checked ? '1' : '0';
    const beelden = document.getElementById('vd-exp-beeld')?.checked ? '1' : '0';
    try {
      const d = await api.get(`/progression/export?alles=${alles}&beelden=${beelden}`);
      if (!d.regels?.length) { alert('Er is niets om mee te nemen. Vink eventueel "ook overgenomen materiaal" aan.'); return; }
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `progressie-${(d._uit || 'campagne').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      window._showToast?.(`${icon('check')} ${d.regels.length} stuks ingepakt${d._teGroot ? ` · ${d._teGroot} afbeelding(en) te groot en overgeslagen` : ''}.`);
    } catch (e) { alert('Uitpakken mislukt: ' + e.message); }
  },
  async importeer() {
    const inp = document.getElementById('vd-imp-bestand');
    const bestand = inp?.files?.[0];
    if (!bestand) { alert('Kies eerst een bestand.'); return; }
    let data;
    try { data = JSON.parse(await bestand.text()); }
    catch { alert('Dat is geen leesbaar JSON-bestand.'); return; }
    data.overschrijf = !!document.getElementById('vd-imp-over')?.checked;
    try {
      const r = await api.post('/progression/import', data);
      window.app.closeModal();
      _all = null; await _load(); _refreshFilterBar(); _bandHerteken(); _paint();
      alert(`Ingelezen: ${r.nieuw} nieuw, ${r.bijgewerkt} bijgewerkt, ${r.overgeslagen} overgeslagen` +
            (r.beelden ? `, ${r.beelden} afbeelding(en)` : '') + '.');
    } catch (e) { alert('Inlezen mislukt: ' + e.message); }
  },
  naarSpreuken(klasse) {
    // Hij staat nu ook in het venster achter een kaartje; dat moet dicht, want
    // anders sta je op het spreukentabblad met de kaart er nog overheen.
    window.app.closeModal?.();
    window.spreuken?.zetFilter?.({ klasse });
    window.app.switchSection('spreuken');
    setTimeout(() => window.spreuken?.zetFilter?.({ klasse }), 400);
  },
  // Oude naam, voor aanroepen van buiten dit bestand.
  bandSub(naam) { this.kiesSub(naam); },
  setLevel(l) { _filters.level = (l === null ? null : Number(l)); _refreshFilterBar(); _paint(); },
  toggleLevels() { _levelsOpen = !_levelsOpen; _refreshFilterBar(); },
};

export async function renderVaardigheden(container) {
  _container = container || document.getElementById('section-vaardigheden');
  if (!_container) return;
  _container.innerHTML = `<div class="spreuk-wrap"><p class="spreuk-loading">Naslag laden…</p></div>`;
  await _load();
  await _klasseExtra();
  await _eldersLaden();
  if (window.app?.state?.activeSection !== 'vaardigheden') return;   // tijdens het laden gewisseld

  _container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--vaardigheden">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('award')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Heldenboek</div>
          <div class="section-banner-desc-line">Classes, species, backgrounds en feats.</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek een class, feat, trait…"
              value="${esc(_filters.q)}" oninput="window.vaardigheden.search(this.value)">
          </div>
          ${window._helpBtn?.('vaardigheden') ?? ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.vaardigheden.nieuw()" title="Eigen vaardigheid toevoegen">${icon('plus')}</button>` : ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="spreuk-wrap">
      <div id="vaardig-band">${_bandHtml()}</div>
      ${_filterBar()}
      <div class="vaardig-onder">
        <aside id="vaardig-subkolom" hidden></aside>
        <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4" id="vaardig-grid"></div>
      </div>
    </div>`;
  _paint();
}
