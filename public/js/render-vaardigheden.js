/**
 * render-vaardigheden.js — Archief-tab "Vaardigheden": alles wat een personage kán.
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

import { api } from './api.js?v=301';
import { naslagBron } from './render-progressie.js?v=57';

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

const SOORT_VOLGORDE = ['class', 'subclass', 'species', 'feat', 'boon', 'background'];

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
      for (const f of (fs || [])) zet({ soort: 'class', bron: klasse, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '' });
    }
    for (const [sub, sdata] of Object.entries(data.subclasses || {})) {
      for (const [lvl, fs] of Object.entries(sdata.levels || {})) {
        for (const f of (fs || [])) zet({ soort: 'subclass', bron: klasse, sub, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '' });
      }
    }
  }
  for (const [soort, data] of Object.entries(prog.species || {})) {
    for (const [lvl, fs] of Object.entries(data.levels || {})) {
      for (const f of (fs || [])) zet({ soort: 'species', bron: soort, level: Number(lvl), naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '' });
    }
  }
  for (const f of (_bron.feats?.general || [])) zet({ soort: 'feat', bron: 'Feats',      level: 0, naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', sluitAan: f.sluitAan || [], vereist: f.vereist || '', geeftSpreuk: f.geeftSpreuk || [] });
  for (const f of (_bron.feats?.epic    || [])) zet({ soort: 'boon', bron: 'Epic Boons', level: 0, naam: f.name, desc: f.desc || '', img: f.img || '', imgFocus: f.imgFocus || '', herkomst: f.herkomst || '', sluitAan: f.sluitAan || [], vereist: f.vereist || '', geeftSpreuk: f.geeftSpreuk || [] });
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
    if (_filters.soort && it.soort !== _filters.soort) return false;
    if (_filters.bron  && it.bron  !== _filters.bron)  return false;
    // Op een subklasse ingezoomd: haar eigen features én die van de klasse
    // eromheen. Een Battle Master is een Fighter die iets extra's heeft, niet
    // iets anders — alleen de subklassefeatures tonen liegt over wat je kunt.
    if (_filters.sub && !(it.sub === _filters.sub || (it.soort === 'class' && it.bron === _filters.bron))) return false;
    if (_filters.level !== null && Number(it.level) !== Number(_filters.level)) return false;
    return true;
  });
  // Zolang je zoekt is relevantie de volgorde; daarna soort → bron → level → naam.
  if (tokens.length) return lijst.sort((a, b) => (scores.get(b.key) || 0) - (scores.get(a.key) || 0));
  return lijst.sort((a, b) =>
    SOORT_VOLGORDE.indexOf(a.soort) - SOORT_VOLGORDE.indexOf(b.soort) ||
    a.bron.localeCompare(b.bron) || a.level - b.level || a.naam.localeCompare(b.naam));
}

// Waar iets bij hoort. Bij een feat, een Epic Boon of een background zegt de
// bron hetzelfde als de soort ("Feat · Feats") — dan laten we hem weg.
const _EIGEN_BRON = new Set(['Feats', 'Epic Boons', 'Backgrounds']);
function _bronRegel(it) {
  if (it.soort === 'subclass') return `${it.sub} · ${it.bron}`;
  return _EIGEN_BRON.has(it.bron) ? '' : it.bron;
}

// ── Kaartje ───────────────────────────────────────────────────────
function _card(it) {
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const tekst = _tekst(it);
  const bronRegel = _bronRegel(it);
  // Staat de tekst er niet, dan hoeft de kijker het kaartje daar niet eerst
  // voor te openen — zelfde regel als bij de spreuken.
  const link = tekst ? '' : (window.app?.bronLink?.(it.naam, 'features') || '');
  return `
    <div class="entity-card vaardig-card" onclick="window.vaardigheden.open('${esc(it.key)}')" title="${esc(it.naam)}"
      style="--soort-c1:${s.c1};--soort-c2:${s.c2}">
      <div class="card-accent vaardig-accent"></div>
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
  return ['Spreuken', delen.join(' · ')];
}

function _klasseKaartHtml(klasse) {
  const data = _bron?.prog?.classes?.[klasse];
  if (!data) return '';
  const basis = _klasseBasis?.[klasse] || {};
  const subs  = Object.keys(data.subclasses || {});
  const gevuld = subs.filter(sk =>
    Object.values(data.subclasses[sk].levels || {}).some(a => (a || []).length)).length;

  const feiten = [
    basis.hitDie ? [`d${basis.hitDie}`, 'Hit die'] : null,
    basis.saves?.length ? [basis.saves.map(a => (_AB_NAAM[a] || a).slice(0, 3).toUpperCase()).join(' · '), 'Saving throws'] : null,
    data.subclassLevel ? [`Level ${data.subclassLevel}`, data.subclassLabel || 'Subklasse'] : null,
    subs.length ? [`${subs.length}`, `Subklassen${gevuld < subs.length ? ` · ${gevuld} met tekst` : ''}`] : null,
    basis.castAbility ? [_AB_NAAM[basis.castAbility] || basis.castAbility, 'Castend ability'] : null,
    basis.featLevels?.length ? [basis.featLevels.join(' · '), 'Feat of verhoging op'] : null,
  ].filter(Boolean);

  // Training en skills staan apart van de cijfers: het zijn zinnen, geen
  // getallen, en naast een rij met "d10" en "STR · CON" lezen ze niet mee.
  const training = [
    basis.armor   ? ['Armor', basis.armor] : null,
    basis.weapons ? ['Wapens', basis.weapons] : null,
    basis.tools   ? ['Gereedschap', basis.tools] : null,
    basis.skillAantal
      ? ['Skills', basis.skills?.length
          ? `kies ${basis.skillAantal} uit ${basis.skills.join(', ')}`
          : `kies ${basis.skillAantal}, vrij`]
      : null,
    _spreukRegel(klasse, basis),
  ].filter(Boolean);

  const sig = window._signatureVoor?.(klasse);

  return `
    <div class="vk-kaart" style="--vk-kleur:${sig?.kleur || '#8a6d3f'}">
      <div class="vk-kop">
        <span class="vk-icoon">${icon(KLASSE_ICOON[klasse] || 'sword')}</span>
        <div>
          <div class="vk-naam">${esc(klasse)}</div>
          ${sig ? `<div class="vk-sig">${icon(sig.icon)} ${esc(sig.feature)}</div>` : ''}
        </div>
      </div>
      <div class="vk-feiten">
        ${feiten.map(([w, l]) => `<div class="vk-feit"><span class="vk-feit-waarde">${esc(w)}</span><span class="vk-feit-label">${esc(l)}</span></div>`).join('')}
      </div>
      ${training.length ? `<dl class="vk-training">
        ${training.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
      </dl>` : ''}
      ${basis.castAbility && (_spreukAantal?.get(klasse) || 0) ? `
        <button class="vk-naar-spreuken" onclick="window.vaardigheden.naarSpreuken('${esc(klasse).replace(/'/g, "\\'")}')">
          ${icon('book-open')} Bekijk de spreukenlijst van de ${esc(klasse)}</button>` : ''}
      ${gevuld < subs.length ? `<p class="vk-noot">Van ${subs.length - gevuld} van de ${subs.length} subklassen staat er geen tekst in de app: die komt uit het Player's Handbook. ${isDM() ? 'Je kunt ze zelf intikken bij een feature hieronder.' : ''}</p>` : ''}
      ${_featBlokHtml(klasse)}
    </div>`;
}

function _subklasseKaartHtml(klasse, sub) {
  const data = _bron?.prog?.classes?.[klasse]?.subclasses?.[sub];
  if (!data) return '';
  const n = Object.values(data.levels || {}).reduce((t, a) => t + (a || []).length, 0);
  const levels = Object.keys(data.levels || {}).map(Number).filter(l => (data.levels[l] || []).length).sort((a, b) => a - b);
  const veld = window._subSignatureVoor?.(sub);
  return `
    <div class="vk-kaart vk-kaart--sub" style="--vk-kleur:${veld?.kleur || '#5a2e8a'}">
      <div class="vk-kop">
        <span class="vk-icoon">${icon(veld?.icon || 'star')}</span>
        <div>
          <div class="vk-naam">${esc(sub)}</div>
          <div class="vk-sig">${esc(_bron?.prog?.classes?.[klasse]?.subclassLabel || 'Subklasse')} · ${esc(klasse)}</div>
        </div>
      </div>
      <div class="vk-feiten">
        ${n ? `<div class="vk-feit"><span class="vk-feit-waarde">${n}</span><span class="vk-feit-label">Features</span></div>` : ''}
        ${levels.length ? `<div class="vk-feit"><span class="vk-feit-waarde">${levels.join(' · ')}</span><span class="vk-feit-label">Op level</span></div>` : ''}
        ${veld ? `<div class="vk-feit"><span class="vk-feit-waarde">${esc(veld.feature)}</span><span class="vk-feit-label">Eigen veld op je blad</span></div>` : ''}
      </div>
      ${n ? '' : `<p class="vk-noot">Van deze subklasse staat er geen tekst in de app — die komt uit het Player's Handbook en mag daar niet uit overgenomen worden. ${isDM() ? 'Je kunt de features zelf intikken met de plusknop rechtsboven.' : 'Vraag je DM of hij ze invult.'}</p>`}
    </div>`;
}

// Een volk en een achtergrond kregen geen kaartje terwijl ze wel in de band
// stonden — dan klik je iets aan en er gebeurt alleen iets met de lijst
// eronder. Ze hebben minder harde getallen dan een klasse, dus het kaartje
// vertelt wat ze wél hebben: op welke levels je iets krijgt (een volk geeft
// niet alleen op 1 iets) en wat de onderdelen zijn.
function _volkKaartHtml(volk) {
  const data = _bron?.prog?.species?.[volk];
  if (!data) return '';
  const levels = Object.keys(data.levels || {}).map(Number)
    .filter(l => (data.levels[l] || []).length).sort((a, b) => a - b);
  const n = levels.reduce((t, l) => t + data.levels[l].length, 0);
  const vroeg = (data.levels?.[1] || []).map(f => f.name);
  return `
    <div class="vk-kaart" style="--vk-kleur:#1a6a50">
      <div class="vk-kop">
        <span class="vk-icoon">${icon(SPECIES_ICOON[volk] || 'user')}</span>
        <div>
          <div class="vk-naam">${esc(volk)}</div>
          <div class="vk-sig">Origin</div>
        </div>
      </div>
      <div class="vk-feiten">
        ${n ? `<div class="vk-feit"><span class="vk-feit-waarde">${n}</span><span class="vk-feit-label">Traits</span></div>` : ''}
        ${levels.length ? `<div class="vk-feit"><span class="vk-feit-waarde">${levels.join(' · ')}</span><span class="vk-feit-label">Op level</span></div>` : ''}
      </div>
      ${vroeg.length ? `<dl class="vk-training"><dt>Vanaf 1</dt><dd>${vroeg.map(esc).join(', ')}</dd></dl>` : ''}
      ${n ? '' : '<p class="vk-noot">Van dit volk staat er niets in de app.</p>'}
    </div>`;
}

function _achtergrondKaartHtml(naam) {
  const data = _bron?.backgrounds?.[naam];
  if (!data) return '';
  const delen = Object.values(data.levels || {}).flat().filter(Boolean);
  // Een achtergrond is één ding met vaste onderdelen; die lezen als rijen,
  // niet als getallen.
  const rij = (kop) => delen.find(d => String(d.name || '').toLowerCase() === kop.toLowerCase())?.desc || '';
  const vaste = [
    ['Ability Scores', rij('Ability Scores')],
    ['Feat', rij('Feat')],
    ['Skills', rij('Skill Proficiencies')],
    ['Gereedschap', rij('Tool Proficiency')],
  ].filter(([, v]) => v);
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
      </dl>` : '<p class="vk-noot">Van deze achtergrond staat er niets in de app.</p>'}
    </div>`;
}

// ── De band: wát je kunt zijn ───────────────────────────────────────────────
// Dit tabblad was een platte lijst van features: je kon "Superiority Dice"
// vinden, maar niet "Battle Master". Een klasse, een subklasse, een volk en een
// achtergrond zijn in het spel dingen op zichzelf, en hier bestonden ze alleen
// als een waarde in een keuzelijst.
//
// De band maakt ze aanklikbaar. Klik een klasse en de lijst eronder waaiert
// uit naar alles wat erbij hoort; de subklassen verschijnen als tweede rij,
// zodat je verder kunt inzoomen zonder de klasse kwijt te raken. Hetzelfde
// voor een volk en een achtergrond — die hebben geen tweede laag.
const _BAND_GROEPEN = [
  { id: 'class',      label: 'Klassen',       soorten: ['class', 'subclass'], icoon: KLASSE_ICOON },
  { id: 'species',    label: 'Volken',        soorten: ['species'],           icoon: SPECIES_ICOON },
  { id: 'background', label: 'Achtergronden', soorten: ['background'],        icoon: {} },
];

function _bandBronnen(groep) {
  const uit = new Map();
  for (const it of (_all || [])) {
    if (!groep.soorten.includes(it.soort)) continue;
    const naam = groep.id === 'background' ? it.naam : it.bron;
    if (!naam) continue;
    uit.set(naam, (uit.get(naam) || 0) + 1);
  }
  return [...uit.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// De subklassen van de gekozen klasse, met hoeveel er van bekend is. Een
// subklasse zonder features blijft staan — juist dán wil je zien dat ze bestaat
// en dat er niets van in de app staat.
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

function _bandHtml() {
  const groepen = _BAND_GROEPEN.map(g => {
    const rijen = _bandBronnen(g);
    if (!rijen.length) return '';
    const knoppen = rijen.map(([naam, n]) => {
      const aan = _filters.bron === naam || (g.id === 'background' && _filters.q === naam);
      const ic = g.icoon[naam] || (g.id === 'class' ? 'sword' : g.id === 'species' ? 'user' : 'scroll-text');
      return `<button class="vb-knop${aan ? ' is-aan' : ''}" onclick="window.vaardigheden.bandKies('${g.id}','${esc(naam).replace(/'/g, "\\'")}')">
        ${icon(ic)} <span>${esc(naam)}</span><span class="vb-telling">${n}</span></button>`;
    }).join('');
    return `<div class="vb-groep"><div class="vb-groep-kop">${esc(g.label)}</div><div class="vb-rij">${knoppen}</div></div>`;
  }).join('');

  // Tweede laag: de subklassen van de klasse waar je op staat.
  let subRij = '';
  if (_filters.bron && _bron?.prog?.classes?.[_filters.bron]) {
    const subs = _bandSubklassen(_filters.bron);
    if (subs.length) {
      subRij = `<div class="vb-groep vb-groep--sub">
        <div class="vb-groep-kop">Subklassen van ${esc(_filters.bron)}</div>
        <div class="vb-rij">
          <button class="vb-knop vb-knop--sub${_filters.sub ? '' : ' is-aan'}"
            onclick="window.vaardigheden.bandSub(null)">Alle</button>
          ${subs.map(([naam, n]) => `
            <button class="vb-knop vb-knop--sub${_filters.sub === naam ? ' is-aan' : ''}${n ? '' : ' vb-knop--leeg'}"
              onclick="window.vaardigheden.bandSub('${esc(naam).replace(/'/g, "\\'")}')"
              title="${n ? '' : 'Van deze subklasse staat er geen tekst in de app'}">
              <span>${esc(naam)}</span>${n ? `<span class="vb-telling">${n}</span>` : `<span class="vb-leeg">—</span>`}</button>`).join('')}
        </div></div>`;
    }
  }

  const keten = (_filters.bron || (_filters.soort === 'background' && _filters.q))
    ? `<div class="vb-keten">${icon('chevron-right')} ${esc(_filters.bron || _filters.q)}${_filters.sub ? ' · ' + esc(_filters.sub) : ''}
         <button class="vb-wis" onclick="window.vaardigheden.bandKies(null,null)" title="Terug naar alles">${icon('x')}</button></div>`
    : '';

  // Het kaartje van waar je op staat: eerst de subklasse als je er een koos,
  // anders de klasse. Een volk of achtergrond heeft (nog) geen kaartje.
  const kaart = _filters.sub
    ? _subklasseKaartHtml(_filters.bron, _filters.sub)
    : _filters.bron
      ? (_bron?.prog?.classes?.[_filters.bron] ? _klasseKaartHtml(_filters.bron)
         : _bron?.prog?.species?.[_filters.bron] ? _volkKaartHtml(_filters.bron) : '')
      : (_filters.soort === 'background' && _filters.q && _bron?.backgrounds?.[_filters.q]
         ? _achtergrondKaartHtml(_filters.q) : '');

  return `<div class="vaardig-band">${groepen}${subRij}${keten}</div>${kaart}`;
}

function _filterBar() {
  const soorten = SOORT_VOLGORDE.filter(k => (_all || []).some(x => x.soort === k));
  const soortRij = [`<button class="spreuk-school-btn${_filters.soort ? '' : ' active'}"
      onclick="window.vaardigheden.setSoort(null)">Alles</button>`]
    .concat(soorten.map(k => {
      const s = SOORTEN[k];
      const n = (_all || []).filter(x => x.soort === k).length;
      return `<button class="spreuk-school-btn${_filters.soort === k ? ' active' : ''}"
        style="--school-c2:${s.c2}" onclick="window.vaardigheden.setSoort('${k}')">${icon(s.icon)} ${esc(s.label)} <span class="vaardig-telling">${n}</span></button>`;
    })).join('');

  // De bronnenlijst volgt de gekozen soort: bij Feats heeft een klassenkeuze
  // geen betekenis, en andersom.
  const zichtbaar = (_all || []).filter(x => !_filters.soort || x.soort === _filters.soort);
  const bronnen = [...new Set(zichtbaar.map(x => x.bron).filter(b => !_EIGEN_BRON.has(b)))].sort();
  const bronOpts = ['<option value="">Alle bronnen</option>']
    .concat(bronnen.map(b => `<option value="${esc(b)}"${_filters.bron === b ? ' selected' : ''}>${esc(b)}</option>`));
  const bronSelect = bronnen.length
    ? `<select class="spreuk-class-select" onchange="window.vaardigheden.setBron(this.value)">${bronOpts.join('')}</select>`
    : '';

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

function _paint() {
  const grid = document.getElementById('vaardig-grid');
  if (!grid) return;
  const lijst = _filtered();
  grid.innerHTML = lijst.length
    ? lijst.map(_card).join('')
    : `<p class="spreuk-empty">Niets gevonden.</p>`;
  const tel = document.getElementById('vaardig-telling');
  if (tel) tel.textContent = `${lijst.length} van ${(_all || []).length}`;
}

function _bandHerteken() {
  const el = document.getElementById('vaardig-band');
  if (el) el.innerHTML = _bandHtml();
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
function _verwijzingen(html) {
  return String(html).replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (heel, naam, alias) => {
    const doel = (_all || []).find(x => x.naam.toLowerCase() === naam.trim().toLowerCase());
    const tekst = esc((alias || naam).trim());
    return doel
      ? `<a class="spreuk-verwijzing" onclick="window.vaardigheden.open('${esc(doel.key)}')" title="Open ${tekst}">${tekst}</a>`
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

function _open(key) {
  const it = (_all || []).find(x => x.key === key);
  if (!it) return;
  const s = SOORTEN[it.soort] || SOORTEN.class;
  const tekst = _tekst(it);
  const body = tekst
    ? `<div class="prog-detail-desc">${_verwijzingen(_bron?.md?.(tekst) ?? esc(tekst))}</div>`
    : (_bron?.geenTekstBlok?.(it.naam) ?? '');
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
        <button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.kiesDetailAfbeelding('${esc(it.key)}')">
          ${icon('image')} Afbeelding kiezen of uploaden</button>
        ${it.img ? `<button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.wisDetailAfbeelding('${esc(it.key)}')">
          ${icon('x')} Afbeelding weghalen</button>` : ''}
        <button class="spreuk-detail-imgbtn" onclick="window.vaardigheden.bewerk('${esc(it.key)}')">
          ${icon('pencil')} Bewerken</button>
      </div>` : '';

  window.app.openModal(it.naam, '', `
    <div class="prog-detail">
      <div class="prog-detail-body">
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
  await api.post('/progression/feature', {
    oud: { soort: it.soort, bron: it.bron, sub: it.sub, level: it.level, naam: it.naam },
    soort: it.soort, bron: it.bron, sub: it.sub || '', level: it.level || 1,
    naam: it.naam, desc: it.desc || '', herkomst: it.herkomst || '',
    img: it.img || null, imgFocus: it.imgFocus || '',
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

function _editorHtml() {
  const e = _edit;
  const bronnen = _bronnenVanSoort(e.soort);
  const toonBron   = bronnen.length > 0;
  const toonSub    = e.soort === 'subclass';
  const toonLevel  = e.soort === 'class' || e.soort === 'subclass' || e.soort === 'species';
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
        <select class="dm-input" id="vd-soort" onchange="window.vaardigheden.veld('soort',this.value)">
          ${SOORT_VOLGORDE.map(k => `<option value="${k}"${e.soort === k ? ' selected' : ''}>${esc(SOORTEN[k].label)}</option>`).join('')}
        </select>
      </div>
      ${toonBron ? `
      <div class="dm-form-row">
        <label class="dm-form-label">${e.soort === 'species' ? 'Species' : e.soort === 'background' ? 'Background' : 'Class'}</label>
        <select class="dm-input" id="vd-bron" onchange="window.vaardigheden.veld('bron',this.value)">
          ${bronnen.map(b => `<option value="${esc(b)}"${e.bron === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}
        </select>
      </div>` : ''}
      ${toonSub ? `
      <div class="dm-form-row">
        <label class="dm-form-label">Subclass</label>
        <select class="dm-input" id="vd-sub" onchange="window.vaardigheden.veld('sub',this.value)">
          ${subs.length ? subs.map(b => `<option value="${esc(b)}"${e.sub === b ? ' selected' : ''}>${esc(b)}</option>`).join('')
                        : '<option value="">(deze class heeft nog geen subclasses)</option>'}
        </select>
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
        <input class="dm-input" id="vd-naam" value="${esc(e.naam || '')}" placeholder="Vlasbaards Greep">
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Herkomst</label>
        <select class="dm-input" id="vd-herkomst" title="Wat je later met een andere campagne mag delen: zelf verzonnen mag mee, overgenomen materiaal niet.">
          ${HERKOMST.map(h => `<option value="${esc(h.value)}"${(e.herkomst || '') === h.value ? ' selected' : ''}>${esc(h.label)}</option>`).join('')}
        </select>
      </div>
      <div class="dm-form-row">
        <label class="dm-form-label">Beschrijving</label>
        ${window._fmtToolbarHtml?.('vd-desc') ?? ''}
        <textarea class="dm-input" id="vd-desc" rows="9" placeholder="Wat doet het? Een lege regel begint een nieuwe alinea.">${esc(e.desc || '')}</textarea>
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
      <div class="dm-form-row">
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
        naam: it.naam, desc: _schoonVoorEditor(it.desc || ''), herkomst: it.herkomst || '', img: it.img || '', imgFocus: it.imgFocus || '',
        sluitAan: Array.isArray(it.sluitAan) ? [...it.sluitAan] : [], vereist: it.vereist || '',
        geeftSpreuk: Array.isArray(it.geeftSpreuk) ? [...it.geeftSpreuk] : [] }
    : { oud: null, soort: 'feat', bron: 'Feats', sub: '', level: 1, naam: '', desc: '', herkomst: 'zelfbedacht', img: '', imgFocus: '',
        sluitAan: [], vereist: '', geeftSpreuk: [] };
  // De kiezer bewaart hier niet meteen (dat doet het spreukdetail); de waarde
  // gaat mee met het formulier. Haak dus leegmaken, anders schrijft een eerder
  // geopend venster mee.
  window._fpOnChange = null;
  window.app.openModal(it ? 'Vaardigheid bewerken' : 'Nieuwe vaardigheid', '', _editorHtml());
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
  nieuw() { _editorOpen(null); },
  bewerk(key) { _editorOpen((_all || []).find(x => x.key === key)); },
  // Kiezen gaat via dezelfde mediabibliotheek als in de bewerkmodal; het
  // detailvenster tekent zichzelf daarna opnieuw, zodat het beeld er staat.
  kiesDetailAfbeelding(key) {
    const it = (_all || []).find(x => x.key === key);
    if (!it) return;
    if (!window.mediaPicker?.open) { alert('Mediabibliotheek niet beschikbaar'); return; }
    window.mediaPicker.open({
      type: 'afbeelding',
      suggestedName: (it.naam || 'vaardigheid').toLowerCase().replace(/\s+/g, '-'),
      onSelect: async (srcId) => {
        const id = it.img || `feat-img-${Math.random().toString(36).slice(2, 10)}`;
        try {
          await fetch(`/api/files/${id}/copy-from/${srcId}`, { method: 'POST', credentials: 'include' });
          await _bewaarBeeld(it, { img: id });
          _open(key);
        } catch (e) { alert('Afbeelding instellen mislukt: ' + e.message); }
      },
    });
  },
  async wisDetailAfbeelding(key) {
    const it = (_all || []).find(x => x.key === key);
    if (!it) return;
    try { await _bewaarBeeld(it, { img: null, imgFocus: '' }); _open(key); }
    catch (e) { alert('Afbeelding weghalen mislukt: ' + e.message); }
  },
  veld(naam, waarde) {
    _editorLees();
    _edit[naam] = waarde;
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
          await fetch(`/api/files/${id}/copy-from/${srcId}`, { method: 'POST', credentials: 'include' });
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
    try {
      await api.post('/progression/feature', {
        oud: _edit.oud, soort: _edit.soort, bron: _edit.bron, sub: _edit.sub,
        level: _edit.level, naam: _edit.naam.trim(), desc: _edit.desc,
        herkomst: _edit.herkomst, img: _edit.img || null, imgFocus: _edit.imgFocus || '',
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
  search(q) { _filters.q = q || ''; _paint(); },
  setSoort(k) { _filters.soort = k || null; _filters.bron = null; _filters.level = null; _refreshFilterBar(); _paint(); },
  setBron(b)  { _filters.bron = b || null; _filters.sub = null; _bandHerteken(); _paint(); },
  // Een klasse, volk of achtergrond uit de band. Een achtergrond heeft geen
  // eigen bron (ze staan allemaal onder "Backgrounds"), dus die zoeken we op
  // naam — dat is hetzelfde kaartje.
  bandKies(groep, naam) {
    if (!groep || !naam) { _filters.bron = null; _filters.sub = null; _filters.soort = null; _filters.q = ''; }
    else if (groep === 'background') { _filters.soort = 'background'; _filters.bron = null; _filters.sub = null; _filters.q = naam; }
    else {
      _filters.q = '';
      _filters.soort = null;
      _filters.bron = (_filters.bron === naam) ? null : naam;
      _filters.sub = null;
    }
    _filters.level = null;
    _bandHerteken(); _refreshFilterBar(); _paint();
    const zoek = document.querySelector('#section-vaardigheden .sbs-input');
    if (zoek) zoek.value = _filters.q;
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
  deelVenster() {
    window.app.openModal('Je eigen invoer', '', `
      <div class="dm-feature-section" style="margin:0">
        <div class="dm-section-label">Uitpakken</div>
        <p class="dm-hint">Alles wat jij hier zelf hebt ingetikt gaat in één bestand: de teksten, wat je bij een feat invulde, en de afbeeldingen die je koos.</p>
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
    window.spreuken?.zetFilter?.({ klasse });
    window.app.switchSection('spreuken');
    setTimeout(() => window.spreuken?.zetFilter?.({ klasse }), 400);
  },
  bandSub(naam) {
    _filters.sub = (naam && _filters.sub !== naam) ? naam : null;
    _bandHerteken(); _paint();
  },
  setLevel(l) { _filters.level = (l === null ? null : Number(l)); _refreshFilterBar(); _paint(); },
  toggleLevels() { _levelsOpen = !_levelsOpen; _refreshFilterBar(); },
};

export async function renderVaardigheden(container) {
  _container = container || document.getElementById('section-vaardigheden');
  if (!_container) return;
  _container.innerHTML = `<div class="spreuk-wrap"><p class="spreuk-loading">Naslag laden…</p></div>`;
  await _load();
  await _klasseExtra();
  if (window.app?.state?.activeSection !== 'vaardigheden') return;   // tijdens het laden gewisseld

  _container.innerHTML = `
    <div class="section-banner section-banner--entity section-banner--vaardigheden">
      <div class="section-banner-head">
        <div class="section-banner-icon-wrap">${icon('graduation-cap')}</div>
        <div class="section-banner-info">
          <div class="section-banner-label">Vaardigheden</div>
          <div class="section-banner-desc-line">Alles wat een personage kan leren.</div>
        </div>
        <div class="section-banner-search">
          <div class="sbs-input-wrap">
            <span class="sbs-icon">⌕</span>
            <input type="text" class="sbs-input search-input" placeholder="Zoek feature, feat…"
              value="${esc(_filters.q)}" oninput="window.vaardigheden.search(this.value)">
          </div>
          ${window._helpBtn?.('vaardigheden') ?? ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.vaardigheden.deelVenster()" title="Je eigen invoer in- of uitpakken">${icon('arrow-up-right')}</button>` : ''}
          ${isDM() ? `<button class="sbs-add-btn" onclick="window.vaardigheden.nieuw()" title="Eigen vaardigheid toevoegen">${icon('plus')}</button>` : ''}
        </div>
      </div>
      <div class="section-banner-rule"><span class="section-banner-ornament">◆</span></div>
    </div>
    <div class="spreuk-wrap">
      <div id="vaardig-band">${_bandHtml()}</div>
      ${_filterBar()}
      <div class="cards-grid grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4" id="vaardig-grid"></div>
    </div>`;
  _paint();
}
