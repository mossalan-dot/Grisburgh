// ── Een personage in wording ─────────────────────────────────────────────────
// Een speler kon zijn blad al bijwerken, maar het kaartje zelf aanmaken was
// `requireDM`. Een nieuwe speler stond dus niet in de inloglijst en kwam
// nergens binnen; de DM moest eerst, midden in een sessie, een leeg kaartje
// maken terwijl de rest wachtte.
//
// **Een concept is geen kaartje.** Dat is de kern van dit bestand. Een half
// personage dat als entity in de wereld staat moet je op twintig plekken
// wegfilteren — uit de partylijst, het gevecht, de lootverdeling, het
// tafelscherm, de sheets — en elke plek die je vergeet is een fout die pas aan
// tafel opvalt. Een concept staat daarom los in `dm-state.conceptPersonages`.
// Pas als de DM het gunt ontstaan het kaartje, het profiel, de beurs en de
// boedel, in één keer en compleet.
//
// Hier staat alleen wat er van het concept te berekenen valt. De routes en het
// schrijven staan in `routes/api.js`, bij de andere verzoeken.
const fs   = require('fs');
const path = require('path');

const BRONNEN = path.join(__dirname, '..', 'bronnen');
const _lees = (naam) => {
  try { return JSON.parse(fs.readFileSync(path.join(BRONNEN, `${naam}.json`), 'utf8')); }
  catch { return {}; }
};

// ── De vier manieren om abilities te bepalen ─────────────────────────────────
// De DM zet aan welke er aan zijn tafel mogen. Niet omdat de app een mening
// heeft, maar omdat "hoe doen we de scores" een afspraak is die je één keer
// maakt en niet elke keer opnieuw wilt uitleggen.
const METHODES = {
  array:    { label: 'Standaardreeks', hint: 'De zes vaste getallen 15, 14, 13, 12, 10, 8 over je abilities verdelen.' },
  pointbuy: { label: 'Point buy',      hint: '27 punten te besteden; alles begint op 8 en hoger kopen kost meer.' },
  rollen:   { label: 'Rollen',         hint: 'Zes keer 4d6, de laagste valt af. Wat je rolt, dat is het.' },
  vrij:     { label: 'Vrij intikken',  hint: 'Zes vakjes. Voor een personage dat elders is gemaakt.' },
};
const STANDAARDREEKS = [15, 14, 13, 12, 10, 8];
// De kosttabel van de PHB. 8 is gratis; boven de 13 wordt elke stap duurder.
const PUNTEN = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const PUNTEN_BUDGET = 27;
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const AB_NAAM = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// De achttien skills en bij welke ability ze horen. De client had deze lijst
// al; de server heeft hem nu ook nodig, om uit een background-zin ("History
// and Intimidation") de skills te vissen die echt bestaan.
const SKILLS = {
  Acrobatics: 'dex', 'Animal Handling': 'wis', Arcana: 'int', Athletics: 'str',
  Deception: 'cha', History: 'int', Insight: 'wis', Intimidation: 'cha',
  Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis',
  Performance: 'cha', Persuasion: 'cha', Religion: 'int', 'Sleight of Hand': 'dex',
  Stealth: 'dex', Survival: 'wis',
};

// De instellingen van deze campagne, met de standaarden erin. Ontbreekt het
// blok, dan staat alles aan behalve een beginlevel boven 1: dat is een
// beslissing van de DM en niet iets waar je stilzwijgend in rolt.
//
// `rerolls` is hoe vaak een speler de héle set opnieuw mag werpen. Standaard
// nul: "wat je rolt, dat is het" stond al in de uitleg van de methode, en een
// ontbrekende sleutel hoort het gedrag te beschrijven dat er al was.
function instellingen(meta) {
  const i = meta?.personageMaken || {};
  const methodes = Array.isArray(i.methodes) && i.methodes.length
    ? i.methodes.filter(m => METHODES[m]) : Object.keys(METHODES);
  return {
    aan:          i.aan !== false,
    methodes,
    maxLevel:     Math.max(1, Math.min(20, parseInt(i.maxLevel) || 1)),
    trinketTafel: String(i.trinketTafel || ''),
    rerolls:      Math.max(0, Math.min(10, parseInt(i.rerolls) || 0)),
  };
}

// ── Rollen ───────────────────────────────────────────────────────────────────
// Op de server, want een maximum aantal herkansingen betekent niets als de
// browser zelf gooit: herladen is dan een gratis reroll. Elke worp onthoudt
// zijn vier stenen, zodat het scherm kan laten zien welke er afviel.
function rolSet() {
  return Array.from({ length: 6 }, () => {
    const stenen = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6));
    const gesorteerd = [...stenen].sort((a, b) => b - a);
    return { totaal: gesorteerd[0] + gesorteerd[1] + gesorteerd[2], stenen };
  }).sort((a, b) => b.totaal - a.totaal);
}

const abMod = (score) => Math.floor(((parseInt(score) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? `+${n}` : `${n}`);
const profBonusVoor = (level) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);

// ── Wat de background geeft ──────────────────────────────────────────────────
// `backgrounds-2024.json` zet het als vier regels tekst op level 1: welke drie
// abilities, welke feat, welke twee skills, welk gereedschap. Dat is precies
// wat 2024 vraagt, dus we lezen het uit in plaats van het ergens anders nog
// eens op te schrijven.
//
// **De campagne gaat voor.** Een campagne met een eigen `progression.json`
// heeft daar haar eigen backgrounds in staan (Grisburgh: 124, waarvan een
// handvol door de DM bijgeschaafd), en die horen hier te verschijnen — niet de
// meegeleverde lijst eronder.
//
// **De bron schrijft dit niet overal hetzelfde.** Gemeten over alle 124:
//  - skills als "Insight, Religion", als "History and Intimidation" én als
//    "History, choose one: Arcana, Nature, Religion";
//  - het gereedschap onder "Tool Proficiency" óf "Tool Proficiencies", soms een
//    keuze ("Choose one kind of Artisan's Tools");
//  - 56 oudere backgrounds zonder Ability Scores en 45 zonder Feat — die hebben
//    in plaats daarvan één eigen **Feature** met een naam.
// Splitsen op komma's alleen maakte van "History and Intimidation" één skill
// die niet bestaat.
const _BG_VAST = new Set(['ability scores', 'feat', 'skill proficiencies', 'skill proficiency',
  'tool proficiencies', 'tool proficiency', 'languages', 'language', 'equipment']);

// Wat de campagne zelf heeft wint — maar een lege houder (de DM nam hem over
// en vulde hem nog niet) is geen "eigen versie", en dan valt de meegeleverde
// eronder in. Anders stond Agent of the Ninth Quill in Grisburgh zonder skills
// en zonder uitrusting in de maker.
function _bgRegels(naam, prog) {
  const regels = (bg) => (Array.isArray(bg?.levels?.['1']) ? bg.levels['1'] : []);
  const eigen = regels(prog?.backgrounds?.[naam]);
  return eigen.length ? eigen : regels(_lees('backgrounds-2024')[naam]);
}

// Komma's binnen haakjes horen bij het ding zelf: "Book (prayers, hymns)".
function _splitsBuitenHaakjes(s, scheider = /,/) {
  const uit = [];
  let diepte = 0, nu = '';
  for (const t of String(s || '')) {
    if (t === '(') diepte++;
    if (t === ')') diepte = Math.max(0, diepte - 1);
    if (diepte === 0 && scheider.test(t)) { uit.push(nu); nu = ''; continue; }
    nu += t;
  }
  uit.push(nu);
  return uit.map(x => x.trim()).filter(Boolean);
}

// Een zin met namen → de namen die echt een skill zijn. "and" telt als komma.
function _skillsUit(zin) {
  return _splitsBuitenHaakjes(String(zin || '').replace(/\s+and\s+/gi, ', '))
    .map(x => Object.keys(SKILLS).find(s => s.toLowerCase() === x.toLowerCase()))
    .filter(Boolean);
}

function backgroundDelen(naam, prog) {
  const regels = _bgRegels(naam, prog);
  const vind = (...namen) => regels.find(r => namen.includes(String(r.name || '').toLowerCase()))?.desc || '';
  const abilities = _splitsBuitenHaakjes(vind('ability scores').replace(/\s+and\s+/gi, ', '))
    .map(n => ABILITIES.find(a => AB_NAAM[a].toLowerCase() === n.toLowerCase()))
    .filter(Boolean);
  // "History, choose one: Arcana, Nature, Religion": vóór de dubbele punt staat
  // wat je krijgt, erna waaruit je er één kiest.
  const skillZin = vind('skill proficiencies', 'skill proficiency');
  const keuze = skillZin.match(/choose\s+(one|two|\d+)\s*(?:from)?\s*:?\s*(.*)$/i);
  const skills = _skillsUit(keuze ? skillZin.slice(0, keuze.index).replace(/,\s*$/, '') : skillZin);
  const skillKeuze = keuze ? {
    aantal: { one: 1, two: 2 }[keuze[1].toLowerCase()] || parseInt(keuze[1]) || 1,
    uit: _skillsUit(keuze[2]).filter(s => !skills.includes(s)),
  } : null;
  const tool = vind('tool proficiencies', 'tool proficiency');
  const feature = regels.find(r => !_BG_VAST.has(String(r.name || '').toLowerCase()) && r.name);
  return {
    abilities,
    feat:  vind('feat'),
    skills,
    skillKeuze: skillKeuze?.uit?.length ? skillKeuze : null,
    tool,
    // "Choose one kind of Gaming Set", "any 1 artisan's tools": dan schrijft de
    // speler zelf op welke het wordt.
    toolKeuze: /\b(choose|any)\b/i.test(tool),
    talen: vind('languages', 'language'),
    feature: feature ? feature.name : '',
    uitrusting: vind('equipment'),
  };
}

// ── Wat je meekrijgt ─────────────────────────────────────────────────────────
// De Equipment-regel van een background is er een van twee: een stapel spullen
// met wat geld, of alleen geld. Hij staat als zin in de bron ("Choose A or B:
// (A) …, 8 GP; or (B) 50 GP"), want zo staat hij in het boek. Hier wordt het
// twee keuzes met een lijst en een bedrag, zodat de wizard er knoppen van kan
// maken en het gunnen er spullen van kan maken.
//
// De oudere backgrounds hebben geen keuze maar één lijst, en hun geld zit in
// een buideltje: "…, Pouch containing 10 GP". Dat wordt één optie A.
function uitrustingOpties(backgroundNaam, prog) {
  const zin = backgroundDelen(backgroundNaam, prog).uitrusting;
  if (!zin) return [];
  const leesDeel = (sleutel, deel) => {
    let goud = 0;
    const spullen = [];
    for (const stuk of _splitsBuitenHaakjes(deel)) {
      const geld = stuk.match(/^(?:or\s+)?(?:(?:a\s+)?pouch containing\s+)?(\d+)\s*GP$/i);
      if (geld) { goud += parseInt(geld[1]); continue; }
      spullen.push(stuk.replace(/^or\s+/i, '').trim());
    }
    return { sleutel, spullen, goud };
  };
  const a = zin.match(/\(A\)([^;]*)/);
  if (!a) return [leesDeel('A', zin.replace(/^choose[^:]*:\s*/i, ''))];
  const uit = [leesDeel('A', a[1])];
  const b = zin.match(/\(B\)(.*)$/);
  if (b) uit.push(leesDeel('B', b[1]));
  return uit;
}

// ── Feats ────────────────────────────────────────────────────────────────────
// Welke feats kent deze campagne, en wat voor soort zijn het? De soort staat
// niet als veld in de data maar als kop boven de tekst ("_General Feat
// (Prerequisite: Level 4+)_"), en bij een campagne zonder eigen lijst zijn het
// kale namen. Een feat zonder kop telt als General: dat is de soort die je op
// een ASI-level mag kiezen, en een onbekende feat die je niet kúnt kiezen is
// erger dan één waar de DM een vraag bij stelt.
function featLijst(prog) {
  const seed = _lees('feats-2024');
  const lees = (lijst, standaard) => (Array.isArray(lijst) && lijst.length ? lijst : [])
    .map(f => (typeof f === 'string' ? { name: f, desc: '' } : f))
    .filter(f => f?.name && f.name !== 'Ability Score Improvement')
    .map(f => {
      const kop = String(f.desc || '').match(/^_([^_]+)_/)?.[1] || '';
      const soort = /^origin/i.test(kop) ? 'origin'
        : /^fighting style/i.test(kop) ? 'fighting'
        : /^epic boon/i.test(kop) ? 'boon' : standaard;
      const pre = kop.match(/Prerequisite:\s*([^)]*)\)?/i)?.[1] || '';
      return { naam: f.name, soort, vereist: [pre, f.vereist].filter(Boolean).join(' · ') };
    });
  const general = lees(prog?.feats?.general, 'general');
  const epic    = lees(prog?.feats?.epic, 'boon');
  return [
    ...(general.length ? general : lees(seed.general, 'general')),
    ...(epic.length ? epic : lees(seed.epic, 'boon')),
  ];
}

// ── Groei: de keuzes die je onderweg had gemaakt ────────────────────────────
// Wie op level 6 begint heeft al een Ability Score Improvement achter de rug.
// Die keuze hoort in de maker, niet doorgeschoven naar een level-up die nooit
// komt. **Dezelfde regel als de tijdlijn** (`_featuresForLevel` in
// render-progressie.js): een ASI waar de class er zelf een heeft óf waar
// `gedeeld.asiLevels` er een zet, een Epic Boon op `epicBoonLevel`. En dezelfde
// sleutel (`Klasse|level|Ability Score Improvement`), anders kies je hier iets
// dat de tijdlijn straks nergens kan neerleggen.
function groeiSlots(concept, prog) {
  const c = concept || {};
  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  const tweede = String(c.multiKlasse || '').trim();
  const tweedeLevel = tweede ? Math.max(0, Math.min(level - 1, parseInt(c.multiKlasseLevel) || 0)) : 0;
  const g = prog?.gedeeld || {};
  const asiLv = Array.isArray(g.asiLevels) ? g.asiLevels.map(Number) : [4, 8, 12, 16];
  const epicLv = parseInt(g.epicBoonLevel) || 19;
  const uit = [];
  for (const [klasse, lv] of [[c.klasse, level - tweedeLevel], [tweede, tweedeLevel]]) {
    if (!klasse || lv < 1) continue;
    const data = prog?.classes?.[klasse] || {};
    for (let l = 1; l <= lv; l++) {
      const namen = (data.levels?.[l] || []).map(f => String(f?.name || '').toLowerCase());
      if (namen.includes('ability score improvement') || asiLv.includes(l)) {
        uit.push({ klasse, level: l, soort: 'asi', sleutel: `${klasse}|${l}|Ability Score Improvement` });
      }
      if (namen.includes('epic boon') || l === epicLv) {
        uit.push({ klasse, level: l, soort: 'boon', sleutel: `${klasse}|${l}|Epic Boon` });
      }
    }
  }
  return uit;
}

// De meegeleverde voorwerpen, voor de wapen- en harnaskeuze. Bewust uit
// dezelfde bron als de winkels: wat je hier kiest moet je later kunnen
// verkopen.
let _items = null;
function srdItems() {
  if (!_items) _items = _lees('srd-items').items || [];
  return _items;
}
function itemOp(sleutel) {
  return srdItems().find(i => i.key === sleutel) || null;
}

// Welke harnassen mag deze class dragen? `armor` is een zin ("Light, Medium,
// Shields"), want zo leest het op het kaartje; hier wordt het een filter.
// Wapens hebben in de bron geen simple/martial-veld, dus die filteren we niet
// — de class zegt wat hij mag en de DM ziet wat er gekozen is.
function harnassenVoor(klasse, prog) {
  const mag = String(klasseBasis(klasse, prog).armor || '').toLowerCase();
  return srdItems().filter(i => {
    if (i.itemType === 'Shield') return mag.includes('shield');
    if (i.itemType !== 'Armor') return false;
    return mag.includes(String(i.armorType || '').toLowerCase());
  });
}
function wapensVoor() {
  // Een wapen is iets waarmee je aanvalt; `werking: attack` scheidt de
  // zwaarden van de zuurflesjes die ook onder Weapon staan.
  return srdItems().filter(i => i.itemType === 'Weapon' && (i.werking || []).includes('attack'));
}

// ── Nakijken ─────────────────────────────────────────────────────────────────
// Voorrekenen, niet blokkeren — dezelfde afweging als bij de multiclass-eisen.
// Wat hier uitkomt is een lijst opmerkingen: de wizard toont ze, de DM ziet ze
// voordat hij gunt, en niemand wordt tegengehouden. De enige échte eis is een
// naam, want zonder naam is er geen kaartje.
function nakijken(concept, { meta, prog, spreuken } = {}) {
  const c = concept || {};
  const inst = instellingen(meta);
  const fouten = [], opmerkingen = [];
  if (!String(c.naam || '').trim()) fouten.push('Hij heeft nog geen naam.');
  if (!c.klasse)     fouten.push('Er is nog geen class gekozen.');
  if (!c.species)    fouten.push('Er is nog geen species gekozen.');
  // Wat de DM in het Heldenboek uitzette bestaat aan deze tafel niet. De maker
  // biedt het niet aan, maar een concept van vóór het uitzetten kan het nog
  // dragen — en dan is het geen opmerking maar iets dat eerst anders moet.
  const verborgen = meta?.heldenboek?.verborgen || {};
  const uit = (lijst, naam) => (Array.isArray(lijst) ? lijst : []).some(n => String(n).toLowerCase() === String(naam || '').toLowerCase());
  for (const k of [c.klasse, c.multiKlasse].filter(Boolean)) {
    if (uit(verborgen.classes, k)) fouten.push(`${k} staat aan deze tafel niet open.`);
    else if (prog?.classes && !prog.classes[k]) fouten.push(`De class ${k} bestaat hier niet meer.`);
  }
  for (const s of [c.subclass, c.multiSubclass].filter(Boolean)) {
    if (uit(verborgen.subclasses, s)) fouten.push(`${s} staat aan deze tafel niet open.`);
  }
  if (c.species && prog?.species && !prog.species[c.species]) fouten.push(`Het species ${c.species} bestaat hier niet meer.`);
  if (c.background && !_bgRegels(c.background, prog).length) {
    opmerkingen.push(`De background ${c.background} staat niet meer in deze campagne.`);
  }
  // Heeft zijn species een keuze en is die niet gemaakt, dan mist hij wat die
  // keuze geeft. Een opmerking, geen blokkade: misschien beslist hij aan tafel.
  const volk = prog?.species?.[c.species];
  if (volk?.varianten && Object.keys(volk.varianten).length && !c.speciesVariant) {
    opmerkingen.push(`${c.species} kiest nog een ${volk.variantLabel || 'variant'}.`);
  }
  if (!c.background) opmerkingen.push('Er is geen background gekozen — dan mis je zijn skills, zijn feat en zijn startgoud.');

  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  if (level > inst.maxLevel) {
    opmerkingen.push(`Hij vraagt om level ${level}; de tafel staat ${inst.maxLevel} toe.`);
  }
  if (c.methode && !inst.methodes.includes(c.methode)) {
    opmerkingen.push(`De scores zijn met "${METHODES[c.methode]?.label || c.methode}" bepaald, en dat staat hier niet aan.`);
  }

  const scores = c.scores || {};
  for (const a of ABILITIES) {
    const v = parseInt(scores[a]);
    if (!v) { fouten.push('Niet alle ability scores zijn ingevuld.'); break; }
  }
  if (c.methode === 'array') {
    const gekozen = ABILITIES.map(a => parseInt(scores[a]) || 0).sort((x, y) => y - x);
    if (gekozen.join() !== [...STANDAARDREEKS].sort((x, y) => y - x).join()) {
      opmerkingen.push('De scores zijn niet precies de standaardreeks.');
    }
  }
  if (c.methode === 'pointbuy') {
    const kosten = ABILITIES.reduce((t, a) => t + (PUNTEN[parseInt(scores[a])] ?? 99), 0);
    if (kosten > PUNTEN_BUDGET) opmerkingen.push(`De scores kosten ${kosten} punten; er zijn er ${PUNTEN_BUDGET}.`);
  }
  // Gerold is gerold: de getallen moeten precies de worpen zijn die de server
  // gooide, in welke volgorde ook. Anders is het "vrij intikken" met een
  // ander label.
  if (c.methode === 'rollen') {
    const worpen = (Array.isArray(c.worpen) ? c.worpen : []).map(w => parseInt(w?.totaal ?? w) || 0);
    if (worpen.length !== 6) fouten.push('Er is nog niet gerold.');
    else {
      const gekozen = ABILITIES.map(a => parseInt(scores[a]) || 0).sort((x, y) => y - x).join();
      if (gekozen !== [...worpen].sort((x, y) => y - x).join()) {
        opmerkingen.push(`De scores zijn niet de zes worpen (${worpen.join(', ')}).`);
      }
    }
  }

  // De verhoging van de background: +2 en +1, of drie keer +1, op de drie die
  // hij noemt. Een oudere background noemt er geen; dan mag het op elke ability
  // — en dat zegt de nakijker erbij, want dat is een afspraak en geen regel.
  const bgDelen = c.background ? backgroundDelen(c.background, prog) : null;
  if (bgDelen) {
    const bonus = Object.entries(c.bgBonus || {}).filter(([, v]) => parseInt(v) > 0);
    const waarden = bonus.map(([, v]) => parseInt(v)).sort((x, y) => y - x).join();
    const toegestaan = bgDelen.abilities.length ? bgDelen.abilities : ABILITIES;
    if (!bonus.length) opmerkingen.push(`De verhoging van ${c.background} is nog niet verdeeld.`);
    else if (!['2,1', '1,1,1'].includes(waarden)) opmerkingen.push(`De verhoging van ${c.background} hoort +2 en +1 te zijn, of drie keer +1.`);
    else if (bonus.some(([a]) => !toegestaan.includes(a))) opmerkingen.push(`${c.background} verhoogt alleen ${toegestaan.map(a => AB_NAAM[a]).join(', ')}.`);
    if (!bgDelen.abilities.length && bonus.length) {
      opmerkingen.push(`${c.background} is een oudere background zonder vaste abilities; de verhoging is vrij verdeeld.`);
    }
    if (bgDelen.skillKeuze && !(c.bgKeuze?.skills || []).length) {
      opmerkingen.push(`${c.background} laat nog een skill kiezen uit ${bgDelen.skillKeuze.uit.join(', ')}.`);
    }
  }

  // Zoveel skills als de class geeft. Wat de background al gaf telt niet mee:
  // die skill heb je toch al, en dubbel tellen liet hem een plek tekortkomen.
  const basis = klasseBasis(c.klasse, prog);
  const nodig = parseInt(basis.skillAantal) || 0;
  const vanBg = new Set([...(bgDelen?.skills || []), ...(c.bgKeuze?.skills || [])]);
  const gekozenSkills = (Array.isArray(c.skills) ? c.skills : []).filter(s => !vanBg.has(s));
  if (nodig && gekozenSkills.length !== nodig) {
    opmerkingen.push(`Zijn class kiest ${nodig} skills; er ${gekozenSkills.length === 1 ? 'is er 1' : `zijn er ${gekozenSkills.length}`} gekozen.`);
  }

  // Een subclass hoort er te zijn vanaf het level waarop de class hem geeft —
  // per class, want een multiclass heeft er twee.
  const level0 = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  const tweedeLv = c.multiKlasse ? Math.max(0, Math.min(level0 - 1, parseInt(c.multiKlasseLevel) || 0)) : 0;
  for (const [k, lv, sub] of [[c.klasse, level0 - tweedeLv, c.subclass], [c.multiKlasse, tweedeLv, c.multiSubclass]]) {
    const data = prog?.classes?.[k];
    if (!k || !data || !Object.keys(data.subclasses || {}).length) continue;
    const vanaf = parseInt(data.subclassLevel) || 3;
    if (lv >= vanaf && !sub) opmerkingen.push(`Een ${k} van level ${lv} heeft een ${data.subclassLabel || 'subclass'}; die is nog niet gekozen.`);
  }
  // Multiclassen vraagt om een minimum in allebei de classes. Zelfde regel als
  // bij het multiclassverzoek tijdens het spelen: voorrekenen, niet blokkeren.
  if (c.multiKlasse && parseInt(c.multiKlasseLevel) > 0) {
    const eisen = _lees('srd-multiclass-eisen');
    const vind = (k) => Object.entries(eisen).find(([n]) => n.toLowerCase() === String(k || '').toLowerCase())?.[1];
    for (const klasse of [c.klasse, c.multiKlasse]) {
      const eis = vind(klasse);
      if (!eis) continue;
      const tekort = [];
      for (const e of (eis.eisen || [])) {
        const heeft = (parseInt(c.scores?.[e.ability]) || 0) + (parseInt(c.bgBonus?.[e.ability]) || 0);
        if (heeft < e.minimum) tekort.push(`${AB_NAAM[e.ability]} ${e.minimum} (heeft ${heeft})`);
      }
      if ((eis.keuze || []).length) {
        const gehaald = eis.keuze.some(e =>
          ((parseInt(c.scores?.[e.ability]) || 0) + (parseInt(c.bgBonus?.[e.ability]) || 0)) >= e.minimum);
        if (!gehaald) tekort.push(eis.keuze.map(e => `${AB_NAAM[e.ability]} ${e.minimum}`).join(' of '));
      }
      if (tekort.length) opmerkingen.push(`Om ${klasse} te multiclassen is ${tekort.join(' en ')} nodig.`);
    }
  }

  // De keuzes van onderweg. Een lege staat erbij in plaats van stilzwijgend
  // overgeslagen; een feat die hij niet kán nemen ook — voorrekenen, niet
  // blokkeren.
  const groei = c.groei || {};
  for (const slot of groeiSlots(c, prog)) {
    const g = groei[slot.sleutel];
    const waar = `${slot.klasse} ${slot.level}`;
    if (!g || (g.keuze === 'feat' ? !g.feat : !Object.keys(g.asi || {}).length)) {
      opmerkingen.push(`Op ${waar} hoort nog een ${slot.soort === 'boon' ? 'Epic Boon' : 'Ability Score Improvement of feat'}.`);
    }
  }
  // Zoveel cantrips en spreuken als zijn class op zijn level kent — per class,
  // want een multiclass kiest ze per class. Alleen als de route de spreuken
  // meegaf: zonder die lijst valt een cantrip niet van een spreuk te
  // onderscheiden.
  if (spreuken) {
    const tellers = _lees('srd-spreukentellers');
    const niv = new Map(spreuken.map(sp => [sp.index, sp.niveau]));
    for (const [k, lv] of [[c.klasse, level0 - tweedeLv], [c.multiKlasse, tweedeLv]]) {
      const t = k && lv > 0 ? tellers?.[k]?.[String(lv)] : null;
      if (!t) continue;
      const mijn = c.spreukenPer?.[k] ?? (k === c.klasse && !c.spreukenPer ? (c.spreuken || []) : []);
      const nC = mijn.filter(i => niv.get(i) === 0).length;
      const nS = mijn.filter(i => (niv.get(i) || 0) > 0).length;
      if (nC !== (t.cantrips || 0) || nS !== (t.voorbereid || 0)) {
        opmerkingen.push(`Een ${k} van level ${lv} kent ${t.cantrips || 0} cantrips en ${t.voorbereid || 0} spreuken; er zijn er ${nC} en ${nS} gekozen.`);
      }
    }
  }
  const scoresNa = _scoresMetGroei(c, prog);
  if (scoresNa.afgetopt.length) {
    opmerkingen.push(`${scoresNa.afgetopt.map(a => AB_NAAM[a]).join(', ')} komt boven de 20 uit; dat is afgetopt.`);
  }
  return { fouten, opmerkingen, kanWeg: fouten.length === 0 };
}

// De scores zoals ze op het blad komen: wat je koos, plus je background, plus
// wat je onderweg verhoogde. Elke bron met zijn eigen plafond — een background
// en een ASI tillen je niet boven de 20, een Epic Boon wel tot 30. Wat
// afgetopt werd komt mee, zodat de nakijker het kan zeggen.
function _scoresMetGroei(c, prog) {
  const scores = {}, afgetopt = new Set();
  const tel = (a, n, max) => {
    const voor = scores[a] + n;
    if (voor > max) afgetopt.add(a);
    scores[a] = Math.max(scores[a], Math.min(max, voor));
  };
  for (const a of ABILITIES) scores[a] = parseInt(c.scores?.[a]) || 10;
  for (const a of ABILITIES) tel(a, parseInt(c.bgBonus?.[a]) || 0, 20);
  const slots = groeiSlots(c, prog);
  for (const slot of slots) {
    const g = (c.groei || {})[slot.sleutel];
    if (!g) continue;
    if (g.keuze === 'asi' && slot.soort === 'asi') {
      for (const [a, n] of Object.entries(g.asi || {})) if (ABILITIES.includes(a)) tel(a, parseInt(n) || 0, 20);
    }
    // Elke feat van 2024 (en elke Epic Boon) geeft er +1 bij op een ability
    // die je zelf kiest; zonder keuze rekenen we niets.
    if (g.keuze === 'feat' && ABILITIES.includes(g.plus)) tel(g.plus, 1, slot.soort === 'boon' ? 30 : 20);
  }
  return { scores, afgetopt: [...afgetopt] };
}

// De kerngegevens van een class: wat de app meebrengt, met de afwijking van
// deze campagne eroverheen. Zelfde volgorde als in het Heldenboek, zodat een
// eigen class hier hetzelfde doet als daar.
function klasseBasis(klasse, prog) {
  const uitBron = _lees('klasse-basis').klassen?.[klasse] || {};
  const eigen   = prog?.classes?.[klasse]?.basis || null;
  return eigen ? { ...uitBron, ...eigen } : uitBron;
}

// ── Van concept naar blad ────────────────────────────────────────────────────
// Eén functie die zegt wat er in het profiel komt te staan. De wizard toont
// hem als voorbeeld, de DM ziet hetzelfde bij het gunnen, en bij het gunnen
// wordt hij letterlijk weggeschreven. Drie plekken, één berekening.
function profielVan(concept, { prog } = {}) {
  const c = concept || {};
  const level = Math.max(1, Math.min(20, parseInt(c.level) || 1));
  const basis = klasseBasis(c.klasse, prog);
  const bg    = c.background ? backgroundDelen(c.background, prog) : null;

  // De bonus van de background en de keuzes van onderweg komen bovenop de
  // ruwe scores. Ze staan apart in het concept, zodat je in de wizard kunt
  // zien wat je zelf koos en wat je ervan kreeg.
  const { scores } = _scoresMetGroei(c, prog);

  const skills = {};
  for (const s of (Array.isArray(c.skills) ? c.skills : [])) skills[_skillSleutel(s)] = 'prof';
  for (const s of (bg?.skills || [])) skills[_skillSleutel(s)] = 'prof';
  for (const s of (c.bgKeuze?.skills || [])) skills[_skillSleutel(s)] = 'prof';

  // Wat hij onderweg koos, in de vorm die de Progressie-tijdlijn al leest:
  // `featChoices` met dezelfde sleutel als daar. Een ASI heet daar zo; de
  // verdeling zelf zit al in de scores hierboven.
  const featChoices = {};
  for (const slot of groeiSlots(c, prog)) {
    const g = (c.groei || {})[slot.sleutel];
    if (!g) continue;
    if (g.keuze === 'feat' && g.feat) featChoices[slot.sleutel] = g.feat;
    else if (g.keuze === 'asi' && slot.soort === 'asi' && Object.keys(g.asi || {}).length) {
      featChoices[slot.sleutel] = 'Ability Score Improvement';
    }
  }
  const snelheid = _snelheden(c.species, prog);

  // Begint hij als multiclass, dan is zijn level de som van twee classes. Het
  // profiel kent die velden al — dit is dezelfde vorm als na een goedgekeurd
  // multiclassverzoek, zodat de rest van de app er niets bijzonders aan ziet.
  const tweede = String(c.multiKlasse || '').trim();
  const tweedeLevel = tweede ? Math.max(0, Math.min(level - 1, parseInt(c.multiKlasseLevel) || 0)) : 0;
  const eersteLevel = level - tweedeLevel;

  const hitDie = parseInt(basis.hitDie) || 8;
  const conMod = abMod(scores.con);
  const dexMod = abMod(scores.dex);
  // Level 1 is het maximum van je hit die; elk level daarna het gemiddelde,
  // naar boven afgerond — de vaste regel, want laten rollen bij het maken van
  // een personage hoort aan tafel en niet in een formulier. Bij een multiclass
  // telt elk level met de hit die van zijn eigen class.
  const tweedeDie = tweedeLevel ? (parseInt(klasseBasis(tweede, prog).hitDie) || 8) : 0;
  const gem = (d) => Math.floor(d / 2) + 1 + conMod;
  const hp = Math.max(1, hitDie + conMod
    + (eersteLevel - 1) * gem(hitDie)
    + tweedeLevel * gem(tweedeDie));

  return {
    level: String(level),
    klasse: c.klasse || '',
    subclass: c.subclass || '',
    ...(tweedeLevel > 0 ? {
      multiclass: 'true', multiKlasse: tweede,
      multiKlasseLevel: String(tweedeLevel), klasseLevel: String(eersteLevel),
    } : {}),
    background: c.background || '',
    origin: c.species || '',
    // De keuze binnen zijn species, als hij er een heeft. Het blad kent dit
    // veld al; het staat daar onder Origin met zijn eigen naam ernaast.
    ...(c.speciesVariant ? { originVariant: c.speciesVariant } : {}),
    ...Object.fromEntries(ABILITIES.map(a => [a, scores[a]])),
    hitDie: tweedeLevel > 0 ? `${eersteLevel}d${hitDie} + ${tweedeLevel}d${tweedeDie}` : `${level}d${hitDie}`,
    profBonus: teken(profBonusVoor(level)),
    initiative: teken(dexMod),
    ac: String(_acVan(c, dexMod)),
    ...snelheid,
    saveProfs: (basis.saves || []).join(','),
    skillProfs: JSON.stringify(skills),
    skillAdj: '{}',
    armorProfs: basis.armor || '',
    weaponProfs: basis.weapons || '',
    // Een gereedschap dat een keuze is ("Choose one kind of Gaming Set")
    // vervangen we door wat de speler opschreef; de zin zelf hoort niet op een
    // blad.
    toolProfs: [basis.tools, (bg?.toolKeuze ? c.bgKeuze?.tool : bg?.tool)].filter(Boolean).join(', '),
    languages: 'Common',
    featuresTraits: '',
    ...(Object.keys(featChoices).length ? { featChoices: JSON.stringify(featChoices) } : {}),
    _hp: hp,
  };
}

// "30 feet, fly 30 feet, swim 30 feet" → de velden die het blad kent. Uit wat
// de campagne bij het species zette, anders uit wat de app meebrengt. Een
// species zonder bekende snelheid krijgt de 30 voet die bijna elk volk heeft.
function _snelheden(species, prog) {
  const zin = String(prog?.species?.[species]?.basis?.speed
    || _lees('species-basis').species?.[species]?.speed || '');
  const voet = (re) => zin.match(re)?.[1];
  const loop = voet(/^\s*(\d+)\s*(?:feet|ft)/i) || '30';
  const uit = { speed: `${loop} ft` };
  const fly = voet(/fly\s+(?:speed\s+)?(?:of\s+)?(\d+)/i);
  const swim = voet(/swim\s+(?:speed\s+)?(?:of\s+)?(\d+)/i);
  if (fly) uit.flySpeed = `${fly} ft`;
  if (swim) uit.swimSpeed = `${swim} ft`;
  return uit;
}

// Zonder harnas 10 + Dex; met een harnas zijn basis plus zoveel Dex als hij
// doorlaat. Een schild komt er bij op. Dat staat allemaal in de bron, dus het
// hoeft nergens overgetikt.
function _acVan(c, dexMod) {
  const harnas = c.harnas ? itemOp(c.harnas) : null;
  let ac = 10 + dexMod;
  if (harnas && harnas.itemType === 'Armor') {
    // Zwaar harnas laat geen Dex door; licht harnas juist alles. Alleen
    // middelzwaar heeft een plafond, en dat staat in de bron.
    const cap = String(harnas.armorType || '').toLowerCase() === 'heavy' ? 0
      : harnas.armorDexCap === undefined ? 99 : (parseInt(harnas.armorDexCap) || 0);
    ac = (parseInt(harnas.armorBaseAC) || 10) + Math.min(dexMod, cap);
  }
  if (c.schild) ac += 2;
  return ac;
}

// De sleutels waarmee het spelersblad zijn skills opslaat: kleine letters,
// zonder spaties. "Sleight of Hand" wordt `sleightofhand`.
function _skillSleutel(naam) {
  return String(naam || '').toLowerCase().replace(/[^a-z]/g, '');
}

module.exports = {
  METHODES, STANDAARDREEKS, PUNTEN, PUNTEN_BUDGET, ABILITIES, AB_NAAM, SKILLS,
  instellingen, backgroundDelen, klasseBasis, nakijken, profielVan,
  uitrustingOpties, srdItems, itemOp, harnassenVoor, wapensVoor,
  featLijst, groeiSlots, rolSet,
  abMod, teken, profBonusVoor, skillSleutel: _skillSleutel,
};
