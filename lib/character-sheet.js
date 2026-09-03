// ── Character sheet: printbaar blad per personage ────────────────────────────
// Levert één HTML-pagina met een compleet blad per personage. De DM opent 'm
// vanuit het DM-paneel en drukt op print: iedereen gaat met vers papier naar huis.
//
// Waarom HTML en geen fillable pdf? Het officiële WotC-formulier heeft geen
// vakjes voor wat deze campagne bijhoudt (boedel, beurs in Florinde/Knaker/
// Centeling, factie-titel, eden) en knijpt de spreukenlijst dicht op 28 regels.
// De browser is bovendien al een prima pdf-generator (Cmd+P → bewaar als pdf),
// dus dit kost geen enkele extra dependency.
//
// Print-techniek: `@page` zet het papierformaat en de marges, `page-break-after`
// duwt elk personage op een eigen vel, en `print-color-adjust: exact` zorgt dat
// de okerlijnen niet wegvallen — browsers gooien achtergrondkleuren bij het
// printen standaard weg om inkt te sparen.

const SKILLS = [
  ['str', [['athletics', 'Athletics']]],
  ['dex', [['acrobatics', 'Acrobatics'], ['sleight of hand', 'Sleight of Hand'], ['stealth', 'Stealth']]],
  ['int', [['arcana', 'Arcana'], ['history', 'History'], ['investigation', 'Investigation'], ['nature', 'Nature'], ['religion', 'Religion']]],
  ['wis', [['animal handling', 'Animal Handling'], ['insight', 'Insight'], ['medicine', 'Medicine'], ['perception', 'Perception'], ['survival', 'Survival']]],
  ['cha', [['deception', 'Deception'], ['intimidation', 'Intimidation'], ['performance', 'Performance'], ['persuasion', 'Persuasion']]],
];
const ABILITIES = [['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'],
  ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma']];
const SPELL_ABILITY = {
  wizard: 'int', artificer: 'int',
  cleric: 'wis', druid: 'wis', ranger: 'wis',
  bard: 'cha', paladin: 'cha', sorcerer: 'cha', warlock: 'cha',
};
// Skills waarvoor de PHB een passieve score kent; die hangen als subregel onder
// de skill zelf, zodat de passieve waarde naast zijn eigen bonus staat.
const PASSIEF = {
  perception: 'Passive Perception', insight: 'Passive Insight', investigation: 'Passive Investigation',
};

// D&D rondt naar BENEDEN, ook bij negatieve waarden: score 7 geeft -2, niet -1.
const mod   = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const getal = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const metTeken = (v) => {
  const t = String(v ?? '').trim();
  return /^\d/.test(t) ? '+' + t : (t || '—');
};

// Sommige profielvelden zijn als JSON-string opgeslagen (o.a. weapons, skillProfs).
const alsLijst = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('[')) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};
const alsObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) { try { return JSON.parse(v); } catch { return {}; } }
  return {};
};

// Alles wat uit de campagnedata komt is gebruikersinvoer: altijd escapen voordat
// het in de HTML belandt.
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
// Spreukteksten uit de bron bevatten soms [[wikilinks]]; die haken horen niet op
// papier. De SRD-teksten dragen bovendien afbreekstreepjes mee uit de pdf waar ze
// uit geëxtraheerd zijn ("repre- sented", "Inspira- tion"): een letter, streepje,
// spatie, kleine letter is een betrouwbaar signaal dat we die weer aan elkaar
// mogen plakken. Een echte samenstelling ("5-foot") heeft daar geen spatie.
const schoon = (v) => String(v ?? '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  // …maar in het Nederlands is "alcohol- of drugsgebruik" een weglatingsstreepje:
  // staat er een voegwoord achter, dan hoort het streepje er juist wél.
  .replace(/([a-z])- (?!(?:en|of|tot|noch|dan)\b)([a-z])/g, '$1$2')
  .trim();
// Oudere boedel-items dragen nog een emoji in hun naam. Op papier is dat een leeg
// blokje (de printfonts hebben die glyphs niet), dus die halen we eruit.
// \p{Extended_Pictographic} vangt de hele emoji-range in één Unicode-property.
const zonderEmoji = (v) => String(v ?? '').replace(/\p{Extended_Pictographic}️?/gu, '').trim();
// Twee losse snelheden staan in de data als "40/40". Op papier leest "40 | 40"
// beter, want het is geen breuk maar twee aparte waarden.
const snelheid = (v) => String(v ?? '').replace(/\s*\/\s*/g, ' | ');
// De spreukenbron levert casting times soms als "1 action" en soms als "Action";
// op de sheet is dat hetzelfde. "1 minute" en "1 hour" blijven wél staan, want
// daar is het getal betekenisvol.
const castTime = (v) => schoon(v)
  .replace(/^1\s+(action|bonus action|reaction)\b/i, '$1')
  .replace(/^[a-z]/, (c) => c.toUpperCase());
// Knip lange beschrijvingen af op een woordgrens i.p.v. midden in een woord.
const kort = (v, max) => {
  const t = schoon(v);
  if (t.length <= max) return t;
  const snee = t.slice(0, max);
  return snee.slice(0, snee.lastIndexOf(' ')) + '…';
};

// De SRD-teksten bevatten markdown: **vet**, _cursief_ en een enkele #-kop.
// Op papier zetten we dat om in echte opmaak. De sub-koppen binnen een spreuk
// ("**_Sound._**") krijgen een regelovergang, want dat zijn losse alinea's.
const mdInline = (t) => t
  .replace(/\*\*_([^*_]+?)_\*\*/g, '<br><b>$1</b>')
  .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
  // Eén asterisk = cursief. Staat na de **-regel, zodat vet al weg is en er geen
  // losse sterretjes meer overblijven om per ongeluk te paren.
  .replace(/\*([^*\n]+?)\*/g, '<i>$1</i>')
  .replace(/(?<![A-Za-z0-9])_([^_]+?)_(?![A-Za-z0-9])/g, '<i>$1</i>')
  .replace(/(<b>|<i>)#+\s*/g, '$1')
  .replace(/^<br>/, '');
// Volledige tekstbehandeling voor een beschrijving: opschonen → inkorten →
// escapen → markdown terugzetten.
const tekst = (v, max) => mdInline(esc(kort(v, max)));

// Onder een portret past maar één woord; "Orphéan Vanverres" wordt "Orphéan".
// Begint de naam met een aanspreektitel, dan is het woord daarna de eigennaam
// ("Prinses Madelief" → Madelief) — anders staat er op elk blad "Prinses".
const TITELS = /^(prinses|prins|koning|koningin|meester|meesteres|heer|vrouwe|zuster|broeder|vader|moeder|kapitein|sir|lady|lord|dokter|professor)$/i;
const voornaam = (v) => {
  const delen = String(v || '').trim().split(/\s+/).filter(Boolean);
  if (delen.length > 1 && TITELS.test(delen[0])) return delen[1];
  return delen[0] || '';
};
// Initialen als vangnet zolang een personage nog geen portret heeft.
const initialen = (v) => String(v || '').trim().split(/\s+/).slice(0, 2)
  .map(w => w[0] || '').join('').toUpperCase();

// Zeldzaamheid krijgt dezelfde kleurtaal als in de app (zie CLAUDE.md).
const RARITY = {
  common: 'common', gewoon: 'common',
  uncommon: 'uncommon', ongewoon: 'uncommon',
  rare: 'rare', zeldzaam: 'rare',
  'very rare': 'very-rare', 'zeer zeldzaam': 'very-rare',
  legendary: 'legendary', legendarisch: 'legendary',
};
const rarityKey = (v) => RARITY[String(v || '').trim().toLowerCase()] || '';

// ── Pagineren ────────────────────────────────────────────────────────────────
// "Blad 3 van 5" mag niet liegen, dus verdelen we de lange secties zélf over
// bladen in plaats van de browser te laten breken. Dat vraagt een hoogte-
// schatting: de regelbreedte volgt uit de bladbreedte (194mm − 2×4mm padding
// − 7pt inspringing ≈ 517pt) gedeeld door de gemiddelde tekenbreedte van
// Crimson Text op 8,6pt. Die is smaller dan je zou denken (±3,7pt), dus er
// passen ruim 140 tekens op een regel — met een lagere schatting bleven de
// bladen een derde leeg. Gekalibreerd op een geprinte pdf; het budget houdt
// marge voor afrondingsfouten.
const REGEL_TEKENS = 140;
const REGEL_HOOGTE = 11.6;
const BLAD_BUDGET  = 680;   // pt aan inhoud onder de kop van een blad

const regels = (t, breedte = REGEL_TEKENS) => Math.max(1, Math.ceil(String(t || '').length / breedte));
// Elke **_sub-kop._** in een SRD-tekst wordt een eigen regel (zie mdInline).
const extraRegels = (t) => (String(t || '').match(/\*\*_/g) || []).length;

function blokHoogte({ body, meta, extra }) {
  let h = 12 + 7;                                   // kop + marge onder het blok
  if (meta)  h += 10;
  h += body?.h || 0;
  if (extra) h += regels(extra) * REGEL_HOOGTE + 3;
  return h;
}

// ── Markdown op blokniveau ───────────────────────────────────────────────────
// Sommige SRD-teksten dragen een hele tabel mee (Nathair's Mischief, Chaos
// Bolt, Confusion). Als één <p> met de pijpjes erin ziet dat eruit als kapotte
// opmaak, dus splitsen we de tekst in blokken: alinea's, ###-kopjes en echte
// <table>'s. mdBlok levert meteen de hoogteschatting mee — de pijpjes en de
// uitvulspaties uit de bron zeggen niets over hoe hoog de tabel op papier wordt,
// dus die moeten per rij geschat worden en niet uit de ruwe tekenlengte.
const isTabelRij  = (r) => /^\s*\|.*\|\s*$/.test(r);
const isScheiding = (r) => /^\s*\|[\s:|-]+\|\s*$/.test(r);
const cellen      = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

// Afkappen op een regelgrens i.p.v. een woordgrens: knip je midden in een
// tabelrij, dan blijft er een half rijtje met pijpjes staan.
const kortRegels = (t, max) => {
  if (t.length <= max) return t;
  const snee = t.slice(0, max);
  const eind = snee.lastIndexOf('\n');
  return eind > max * 0.5 ? `${snee.slice(0, eind)}\n…` : kort(t, max);
};

function mdTabel(rijen) {
  const [kop, ...rest] = rijen;
  const cel = (c) => mdInline(esc(c));
  return `<table class="tbl tbl--md">
    <thead><tr>${kop.map(c => `<th>${cel(c)}</th>`).join('')}</tr></thead>
    <tbody>${rest.map(r => `<tr>${r.map(c => `<td>${cel(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function mdBlok(v, max) {
  const bron = kortRegels(schoon(v), max).split('\n');
  const uit = [];
  let h = 0, alinea = [];
  const spoel = () => {
    if (!alinea.length) return;
    const t = alinea.join('\n');
    h += (regels(t) + extraRegels(t)) * REGEL_HOOGTE + 3;
    uit.push(`<p class="blok__tekst">${mdInline(esc(t))}</p>`);
    alinea = [];
  };
  for (let i = 0; i < bron.length; i++) {
    if (isTabelRij(bron[i])) {
      const rijen = [];
      while (i < bron.length && isTabelRij(bron[i])) {
        if (!isScheiding(bron[i])) rijen.push(cellen(bron[i]));
        i++;
      }
      i--;
      spoel();
      if (!rijen.length) continue;
      // Kopregel + per rij de gewikkelde hoogte; de tabel is smaller dan een
      // alinea, dus reken met een krappere regelbreedte.
      h += 14 + rijen.slice(1).reduce((som, r) => som + regels(r.join(' '), 118) * REGEL_HOOGTE + 4, 0);
      uit.push(mdTabel(rijen));
      continue;
    }
    const kop = bron[i].match(/^\s*#{1,6}\s*(.+)$/);
    if (kop) {
      spoel();
      h += 14;
      uit.push(`<h4 class="blok__kop2">${esc(kop[1].replace(/[*_]/g, ''))}</h4>`);
      continue;
    }
    if (bron[i].trim()) alinea.push(bron[i]); else spoel();
  }
  spoel();
  return { html: uit.join(''), h };
}

// Verdeel een reeks {h, html}-items over bladvullingen. Een blad eindigt nooit
// op een groepskop — die schuift dan mee naar het volgende blad.
function pakInBladen(items, budget = BLAD_BUDGET) {
  const paginas = [];
  let huidig = [], hoogte = 0;
  for (const item of items) {
    if (huidig.length && hoogte + item.h > budget) { paginas.push(huidig); huidig = []; hoogte = 0; }
    huidig.push(item); hoogte += item.h;
  }
  if (huidig.length) paginas.push(huidig);
  for (let i = 0; i < paginas.length - 1; i++) {
    while (paginas[i].length && paginas[i][paginas[i].length - 1].kop) {
      paginas[i + 1].unshift(paginas[i].pop());
    }
  }
  return paginas.filter(pg => pg.length);
}

// Maak bladen van een reeks items; vervolgbladen krijgen "(vervolg)" in de kop.
function blokBladen(sub, items, wikkel = (h) => h) {
  return pakInBladen(items).map((blokken, i) => ({
    sub: i === 0 ? sub : `${sub} — vervolg`,
    inhoud: wikkel(blokken.map(b => b.html).join('')),
  }));
}

// ── Bouwstenen ───────────────────────────────────────────────────────────────

// ○ geen proficiency · ● proficient · ◉ expertise
const pip = (niveau) => `<span class="pip pip--${niveau}"></span>`;

// Lege vakjes om met pen in te vullen: death saves, exhaustion, spell slots.
const vakjes = (n, cls = '') => Array.from({ length: n }, () => `<span class="vak ${cls}"></span>`).join('');
// Lege tabelregels/inventoryregels: ruimte om tijdens het spel bij te schrijven.
// &nbsp; houdt de cel op hoogte; een echt lege <td> klapt dicht.
const legeRijen = (n, kolommen) =>
  Array.from({ length: n }, () => `<tr class="leegrij">${'<td>&nbsp;</td>'.repeat(kolommen)}</tr>`).join('');
const legeItems = (n) => Array.from({ length: n }, () => '<li class="leegrij">&nbsp;</li>').join('');

// De score is de vaste waarde en staat groot; de modifier is de afgeleide en
// hangt er klein onder in een eigen pil.
function abilityBlok(profiel) {
  return ABILITIES.map(([sleutel, label]) => `
    <div class="abil">
      <div class="abil__label">${label}</div>
      <div class="abil__score">${esc(profiel[sleutel] ?? '—')}</div>
      <div class="abil__mod">${teken(mod(profiel[sleutel]))}</div>
    </div>`).join('');
}

function savesBlok(profiel, prof) {
  const saves = String(profiel.saveProfs || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return ABILITIES.map(([sleutel, label]) => {
    const heeft = saves.includes(sleutel);
    return `<li>${pip(heeft ? 'prof' : 'geen')}<span class="rij__naam">${label}</span>
      <span class="rij__waarde">${teken(mod(profiel[sleutel]) + (heeft ? prof : 0))}</span></li>`;
  }).join('');
}

// Bonus van één skill, inclusief expertise en een handmatige correctie.
function skillBonus(profiel, prof, sleutel, ability) {
  const niveau = String(alsObject(profiel.skillProfs)[sleutel] || '').toLowerCase();
  const extra  = niveau === 'expert' ? prof * 2 : niveau === 'prof' ? prof : 0;
  return { niveau, extra, bonus: mod(profiel[ability]) + extra + getal(alsObject(profiel.skillAdj)[sleutel]) };
}

function skillsBlok(profiel, prof) {
  let regels = '';
  for (const [ability, lijst] of SKILLS) {
    for (const [sleutel, label] of lijst) {
      const { niveau, extra, bonus } = skillBonus(profiel, prof, sleutel, ability);
      regels += `<li>${pip(niveau === 'expert' ? 'expert' : extra ? 'prof' : 'geen')}
        <span class="rij__naam">${label} <em>${ability}</em></span>
        <span class="rij__waarde">${teken(bonus)}</span></li>`;
    }
  }
  return regels;
}

// Passieve scores staan als eigen reeks bij de andere kerngetallen; tussen de
// skills verwarden ze met de modifiers die daar in dezelfde kolom staan.
function passiefBlok(profiel, prof) {
  return `<div class="stats stats--passief">${Object.entries(PASSIEF).map(([sleutel, label]) => {
    const ability = SKILLS.find(([, l]) => l.some(([k]) => k === sleutel))[0];
    return `<div class="stat">
      <span class="lab">${label.replace('Passive ', 'Passive&nbsp;')}</span>
      <b>${10 + skillBonus(profiel, prof, sleutel, ability).bonus}</b>
    </div>`;
  }).join('')}</div>`;
}

// ── 5+6. Klasse-pools en vastgezette kenmerken ───────────────────────────────
// De speler vinkt in de app bolletjes af (Bardic Inspiration, Rage, eigen
// tellers). Op papier drukken we de actuele stand af: een gevuld bolletje is
// verbruikt, precies zoals in de app.
// Een gevuld bolletje = verbruikt, net als in de app.
const pips = (max, op) => Array.from({ length: max }, (_, i) =>
  `<span class="vak vak--rond${i < op ? ' vak--op' : ''}"></span>`).join('');

function resourcesBlok(traits, trackers, bladVoor) {
  const rijen = [
    ...(traits || []).map(t => ({
      naam: t.name, meta: t.meta || '',
      max: getal(t.maxUses), op: getal(t.currentUses),
      blad: bladVoor?.get(kaleNaam(t.name)),
    })),
    ...(trackers || []).map(t => ({
      naam: t.name, meta: 'eigen teller',
      max: getal(t.max), op: getal(t.current),
    })),
  // Alleen wat je tijdens het spel afvinkt. Kenmerken zónder bolletjes staan al
  // in Features & Traits; die hier herhalen levert een muur met streepjes op.
  ].filter(r => r.naam && r.max > 0)
   .sort((a, b) => String(a.naam).localeCompare(String(b.naam)));
  if (!rijen.length) return '';
  return `<ul class="res">${rijen.map(r => `
    <li>
      <span class="rij__naam">${esc(r.naam)}${r.meta ? ` <em class="klein">${esc(r.meta)}</em>` : ''}</span>
      ${r.blad ? `<span class="res__blad">blad ${r.blad}</span>` : ''}
      <span class="res__pips">${pips(r.max, r.op)}</span>
    </li>`).join('')}</ul>`;
}

// Toont de pool ("6d8"). Pas als er dice op zijn is het restant relevant; dan
// zetten we dat er als hint bij, anders zou die informatie verloren gaan.
function hitDiceTekst(hitDice) {
  const pool  = hitDice?.pool || {};
  const spent = hitDice?.spent || {};
  const zijden = Object.keys(pool).sort((a, b) => b - a);
  if (!zijden.length) return '—';
  const totaal = zijden.map(z => `${pool[z]}d${z}`).join(' · ');
  const op = zijden.reduce((n, z) => n + getal(spent[z]), 0);
  if (!op) return totaal;
  const over = zijden.map(z => `${pool[z] - getal(spent[z])}d${z}`).join(' · ');
  return `${totaal} <span class="hint">— ${over} over</span>`;
}

function wapensBlok(profiel) {
  const wapens = alsLijst(profiel.weapons);
  return `<table class="tbl">
    <colgroup><col style="width:34%"><col style="width:13%"><col style="width:25%"><col style="width:28%"></colgroup>
    <thead><tr><th>Naam</th><th class="mid">Attack</th><th>Damage</th><th>Properties</th></tr></thead>
    <tbody>${wapens.map(w => `<tr>
      <td class="naam">${esc(w.name)}</td>
      <td class="mid">${esc(metTeken(w.atk))}</td>
      <td>${esc(w.dmg)}</td>
      <td class="klein">${esc(alsLijst(w.props).join(', '))}</td>
    </tr>`).join('')}${legeRijen(Math.max(1, 5 - wapens.length), 4)}</tbody></table>`;
}

// ── Inventory ────────────────────────────────────────────────────────────────

// Staat de gedeelde beurs aan, dan is dát de beurs van de party en heeft de
// speler geen eigen geld meer (zie _effectiveCurrency in routes/api.js). De
// route levert daarom precies één van de twee aan.
function beursBlok(beurs, muntNamen) {
  const rij = (waarden, label) => `
    <div class="beurs__rij">
      <span class="beurs__label">${label}</span>
      ${Object.entries(muntNamen || {}).map(([sleutel, naam]) =>
        `<span class="munt"><b>${getal((waarden || {})[sleutel])}</b> ${esc(naam)}</span>`).join('')}
    </div>`;
  if (beurs?.gedeeld) return `<div class="beurs">${rij(beurs.gedeeld, 'Partybeurs — gedeeld')}</div>`;
  if (beurs?.persoonlijk) return `<div class="beurs">${rij(beurs.persoonlijk, 'Beurs')}</div>`;
  return '';
}

// Losse regels die dezelfde naam dragen als een voorwerp-kaartje zijn dubbel
// ingevoerd; het kaartje is uitgebreider, dus dat wint.
function losseItems(voorwerpen, items) {
  const kaartNamen = new Set((voorwerpen || []).map(v => String(v.name || '').trim().toLowerCase()));
  return (items || []).filter(i => !kaartNamen.has(String(i.name || '').trim().toLowerCase()));
}

function inventoryBlok(voorwerpen, items) {
  const los = losseItems(voorwerpen, items);

  const kaartjes = (voorwerpen || []).map(v => {
    const tags = [
      v.itemType && `<span class="tag">${esc(v.itemType)}</span>`,
      v.rariteit && `<span class="tag tag--rar" data-rarity="${rarityKey(v.rariteit)}">${esc(v.rariteit)}</span>`,
      v.attunement && '<span class="tag">Attunement</span>',
      v.charges && `<span class="tag">${v.charges.nu}/${v.charges.max} charges</span>`,
    ].filter(Boolean).join('');
    return `<li>
      <span class="rij__naam">${esc(zonderEmoji(v.name))}${v.qty > 1 ? ` <b>×${v.qty}</b>` : ''}</span>
      <span class="tags">${tags}</span>
    </li>`;
  }).join('');

  const losHtml = los.map(i => `<li>
      <span class="rij__naam">${esc(zonderEmoji(i.name))}</span>
      ${i.note ? `<em class="klein">${esc(i.note)}</em>` : ''}
    </li>`).join('');

  // Twee vaste kolommen naast elkaar: links wat een eigen kaartje heeft, rechts
  // de losse uitrusting. Geen CSS-columns meer — die verdeelden één lijst over
  // twee kolommen, waardoor het leek alsof de kopjes niet klopten.
  return `<div class="inv">
    <div class="inv__kolom">
      <h3 class="sub">Voorwerpen</h3>
      <ul class="boedel">${kaartjes || '<li class="leegrij">&nbsp;</li>'}${legeItems(kaartjes ? 2 : 5)}</ul>
    </div>
    <div class="inv__kolom">
      <h3 class="sub">Uitrusting &amp; overig</h3>
      <ul class="boedel">${losHtml}${legeItems(losHtml ? 3 : 6)}</ul>
    </div>
  </div>`;
}

// De uitleg van de voorwerpkaartjes; op het eigen inventory-blad vult die de
// ruimte die anders naar een leeg notitieveld ging.
function voorwerpItems(voorwerpen) {
  return (voorwerpen || []).filter(v => schoon(v.desc)).map(v => {
    const body = mdBlok(v.desc, 900);
    return {
      h: blokHoogte({ body }),
      html: `<div class="blok">
        <div class="blok__kop">${esc(zonderEmoji(v.name))}${v.rariteit
          ? `<span class="blok__tag">${esc(v.itemType ? `${v.itemType}, ` : '')}${esc(v.rariteit)}</span>` : ''}</div>
        ${body.html}
      </div>`,
    };
  });
}

// ── Spreuken ─────────────────────────────────────────────────────────────────

function slotsBlok(slots) {
  const niveaus = Object.keys(slots || {}).filter(l => getal(slots[l]?.max) > 0).sort((a, b) => a - b);
  if (!niveaus.length) return '';
  return `<div class="slots">${niveaus.map(l => `
    <div class="slot">
      <span class="slot__lvl">${l}</span>
      <span class="slot__pips">${vakjes(getal(slots[l].max), 'vak--rond')}</span>
    </div>`).join('')}</div>`;
}

// Groepeer op level, binnen een level op naam.
function perNiveau(spreuken) {
  const map = new Map();
  for (const s of [...(spreuken || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))) {
    const l = getal(s.level);
    if (!map.has(l)) map.set(l, []);
    map.get(l).push(s);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}
const niveauLabel = (l) => (l === 0 ? 'Cantrips' : `Level ${l}`);

// Snelle naslag tijdens het spel: alle spreuken in één tabel. Eén tabel voor
// álle niveaus met een <colgroup> en table-layout:fixed, zodat de kolommen over
// de hele lijst op dezelfde plek staan — losse tabellen per niveau schoven op,
// want dan berekent de browser de breedtes per blok opnieuw.
const SPREUK_COLS = `<colgroup><col style="width:27%"><col style="width:23%"><col style="width:12%">
    <col style="width:24%"><col style="width:14%"></colgroup>`;
const SPREUK_HEAD = `<thead><tr><th>Naam</th><th>Casting Time</th><th>Range</th><th>Duration</th>
      <th class="mid">Concentration / Ritual</th></tr></thead>`;
const spreukTabelWikkel = (rijen) =>
  `<table class="tbl tbl--spreuk">${SPREUK_COLS}${SPREUK_HEAD}<tbody>${rijen}</tbody></table>`;

// Snelle naslag tijdens het spel: alle spreuken in één tabel. Met een <colgroup>
// en table-layout:fixed staan de kolommen over de hele lijst op dezelfde plek —
// losse tabellen per niveau schoven op, want dan berekent de browser de
// breedtes per blok opnieuw.
function spreukTabelItems(spreuken) {
  const items = [];
  for (const [l, lijst] of perNiveau(spreuken)) {
    items.push({ h: 22, kop: true, html: `<tr class="niv"><th colspan="5">${niveauLabel(l)}</th></tr>` });
    for (const s of lijst) {
      // Twee regels als de casting time of duration afbreekt.
      const breed = Math.max(regels(s.name, 26), regels(castTime(s.casting_time), 24), regels(s.duration, 25));
      items.push({ h: 4 + breed * 11.6, html: `<tr>
        <td class="naam">${esc(s.name)}${s.school ? ` <em class="klein">${esc(s.school)}</em>` : ''}</td>
        <td class="klein">${esc(castTime(s.casting_time))}</td>
        <td class="klein">${esc(s.range)}</td>
        <td class="klein">${esc(s.duration)}</td>
        <td class="mid klein">${s.concentration ? 'C' : ''}${s.concentration && s.ritual ? '/' : ''}${s.ritual ? 'R' : ''}</td>
      </tr>` });
    }
  }
  return items;
}

function spreukBeschrijvingItems(spreuken) {
  if (!(spreuken || []).some(s => s.desc)) return [];
  const items = [];
  for (const [l, lijst] of perNiveau(spreuken)) {
    items.push({ h: 26, kop: true, html: `<h3 class="sub">${niveauLabel(l)}</h3>` });
    for (const s of lijst) {
      const hoger = schoon(s.higher_level);
      const meta = [
        castTime(s.casting_time), s.range, s.duration, s.components,
        // "Concentration, up to 1 minute" staat al in de duration; niet herhalen.
        s.concentration && !/concentration/i.test(s.duration || '') ? 'Concentration' : '',
        s.ritual && !/ritual/i.test(s.casting_time || '') ? 'Ritual' : '',
      ].filter(Boolean).map(esc).join(' · ');
      // Ruimer dan de oude 1200: een spreuk met een tabel (Nathair's Mischief)
      // werd daar middenin afgekapt, en de eigen paginering vangt de lengte op.
      const body = mdBlok(s.desc, 2000);
      items.push({
        h: blokHoogte({ body, meta, extra: hoger }),
        html: `<div class="blok">
          <div class="blok__kop">${esc(s.name)}${s.school ? `<span class="blok__tag">${esc(s.school)}</span>` : ''}</div>
          ${meta ? `<div class="blok__meta">${meta}</div>` : ''}
          ${body.html}
          ${hoger ? `<p class="blok__extra"><b>At Higher Levels.</b> ${tekst(hoger, 400)}</p>` : ''}
        </div>`,
      });
    }
  }
  return items;
}

// Waar komt de magie vandaan? Eerst de klassetabel; anders de modifier terugrekenen
// uit DC (8 + prof + mod) of attack (prof + mod), en die alleen een naam geven als
// er precies één ability op uitkomt.
function spellcastingBron(profiel, prof) {
  const uitKlasse = SPELL_ABILITY[String(profiel.klasse || '').trim().toLowerCase()];
  if (uitKlasse) {
    return { ability: ABILITIES.find(a => a[0] === uitKlasse)[1], mod: mod(profiel[uitKlasse]) };
  }
  const dc  = getal(profiel.spellSaveDC);
  const atk = getal(profiel.spellAttackBonus);
  const afgeleid = dc ? dc - 8 - prof : (profiel.spellAttackBonus ? atk - prof : null);
  if (afgeleid == null) return { ability: null, mod: null };
  const kandidaten = ABILITIES.filter(([sleutel]) => mod(profiel[sleutel]) === afgeleid);
  return { ability: kandidaten.length === 1 ? kandidaten[0][1] : null, mod: afgeleid };
}

// ── Features ─────────────────────────────────────────────────────────────────

// Vergelijk kenmerknamen los van een toevoeging tussen haakjes: de speler pint
// "Bardic Inspiration (d8)", de progressie kent "Bardic Inspiration".
const kaleNaam = (v) => String(v || '').replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase();

function featureItems(groepen, traits) {
  // Kenmerken met bolletjes: die tonen we naast de feature zelf, zodat je ziet
  // hoeveel Bardic Inspiration je nog hebt op de plek waar hij uitgelegd wordt.
  const metPips = new Map();
  for (const t of (traits || [])) {
    if (getal(t.maxUses) > 0) metPips.set(kaleNaam(t.name), { max: getal(t.maxUses), op: getal(t.currentUses) });
  }
  const items = [];
  const gezien = new Set();
  const blok = (naam, tag, desc, pipData) => {
    const body = mdBlok(desc, 1400);
    return {
      naam,
      h: blokHoogte({ body }),
      html: `<div class="blok">
        <div class="blok__kop">${esc(naam)}${tag ? `<span class="blok__tag">${esc(tag)}</span>` : ''}
          ${pipData ? `<span class="blok__pips">${pips(pipData.max, pipData.op)}</span>` : ''}</div>
        ${body.html}
      </div>`,
    };
  };

  for (const g of (groepen || []).filter(x => x.items?.length)) {
    items.push({ h: 26, kop: true, html: `<h3 class="sub">${esc(g.titel)}</h3>` });
    for (const f of g.items) {
      gezien.add(kaleNaam(f.name));
      items.push(blok(f.name, f.level ? `Level ${f.level}` : '', f.desc, metPips.get(kaleNaam(f.name))));
    }
  }

  // Zelf toegevoegde kenmerken (custom Rage, huisregels) staan in geen enkele
  // progressietabel; die zouden anders van het blad vallen.
  const eigen = (traits || []).filter(t => !gezien.has(kaleNaam(t.name)));
  if (eigen.length) {
    items.push({ h: 26, kop: true, html: '<h3 class="sub">Vastgezette kenmerken</h3>' });
    for (const t of eigen) {
      items.push(blok(t.name, t.meta || '', t.desc, getal(t.maxUses) > 0
        ? { max: getal(t.maxUses), op: getal(t.currentUses) } : null));
    }
  }
  return items;
}

// ── Eén blad ─────────────────────────────────────────────────────────────────

function blad(p) {
  const profiel = p.profiel || {};
  const prof    = getal(profiel.profBonus) || 2;
  const hp      = p.hp || {};
  const klasseRegel = [
    [profiel.klasse, profiel.subclass && `(${profiel.subclass})`].filter(Boolean).join(' '),
    profiel.level && `Level ${profiel.level}`,
    profiel.origin,
    profiel.background,
  ].filter(Boolean).join(' · ');

  const magie      = spellcastingBron(profiel, prof);
  const heeftMagie = !!(p.spreuken?.length || profiel.spellSaveDC);
  const extraSnelheden = alsLijst(profiel.extraSpeeds).filter(s => s.value)
    .map(s => `${esc(s.label)} ${esc(snelheid(s.value))}`).join(' · ');
  const keuzes = Object.entries(alsObject(profiel.featChoices))
    .filter(([, v]) => v)
    .map(([sleutel, v]) => `<li><span class="rij__naam">${esc(sleutel.split('|').pop())}</span>
      <span class="klein">${esc(v)}</span></li>`).join('');

  const spreukTekstItems = spreukBeschrijvingItems(p.spreuken);
  const featItems        = featureItems(p.features, p.traits);
  // De inventaris krijgt altijd een eigen vel. Hij paste in de praktijk toch
  // nooit onder aan blad 1 — dat blad is al vol met abilities, attacks,
  // proficiencies en het notitieveld — en een schatting die er soms naast zat
  // liet de browser er alsnog een pagina bij breken. Op een eigen vel staat
  // bovendien de uitleg van de voorwerpen erbij.
  const invHtml = `${beursBlok(p.beurs, p.muntNamen)}
    ${inventoryBlok(p.voorwerpen, p.items)}`;

  // Eerst de vervolgbladen bouwen, dán blad 1: de voettekst moet weten hoeveel
  // bladen er in totaal zijn ("blad 2 van 4"), en de Class Resources-lijst op
  // blad 1 verwijst naar het blad waar het kenmerk wordt uitgelegd.
  const vervolg = [];

  {
    // De twee kolommen zijn vast (kaartjes links, losse uitrusting rechts), dus
    // de langste bepaalt de hoogte — inclusief de lege schrijfregels eronder.
    // Wat er daaronder overblijft vullen we met de uitleg van de voorwerpen.
    const kaartRijen = (p.voorwerpen?.length || 0) + (p.voorwerpen?.length ? 2 : 5);
    const losRijen   = losseItems(p.voorwerpen, p.items).length;
    const invHoogte  = 52 + Math.max(kaartRijen, losRijen + (losRijen ? 3 : 6)) * 17;
    const uitleg = voorwerpItems(p.voorwerpen);
    const [bij, ...verder] = uitleg.length
      ? pakInBladen(uitleg, Math.max(120, BLAD_BUDGET - invHoogte))
      : [[]];
    vervolg.push({
      sub: 'Inventory',
      vul: !bij.length,
      inhoud: invHtml + (bij.length ? `<h2>Voorwerpen — uitleg</h2>${bij.map(x => x.html).join('')}` : ''),
    });
    for (const pg of pakInBladen(verder.flat())) {
      vervolg.push({ sub: 'Voorwerpen — uitleg', inhoud: pg.map(x => x.html).join('') });
    }
  }

  if (heeftMagie) {
    const kop = `
      <div class="stats stats--magie">
        <div class="stat"><span class="lab">Ability</span><b>${esc(magie.ability || '—')}</b></div>
        <div class="stat"><span class="lab">Modifier</span><b>${magie.mod == null ? '—' : teken(magie.mod)}</b></div>
        <div class="stat"><span class="lab">Save DC</span><b>${esc(profiel.spellSaveDC || '—')}</b></div>
        <div class="stat"><span class="lab">Attack Bonus</span><b>${esc(metTeken(profiel.spellAttackBonus))}</b></div>
      </div>
      ${slotsBlok(p.slots) ? `<h2>Spell Slots</h2>${slotsBlok(p.slots)}` : ''}
      <h2>Cantrips &amp; Prepared Spells</h2>`;
    // De kop kost ruimte op het eerste blad; die trekken we van het budget af.
    const tabelItems = spreukTabelItems(p.spreuken);
    const [eerste, ...rest] = pakInBladen(tabelItems, BLAD_BUDGET - 110);
    vervolg.push({ sub: 'Spellcasting', inhoud: kop + spreukTabelWikkel((eerste || []).map(x => x.html).join('') + legeRijen(4, 5)) });
    for (const pg of pakInBladen(rest.flat())) {
      vervolg.push({ sub: 'Spellcasting — vervolg', inhoud: spreukTabelWikkel(pg.map(x => x.html).join('')) });
    }
    vervolg.push(...blokBladen('Spell Descriptions', spreukTekstItems));
  }
  // Features zelf pagineren i.p.v. via blokBladen: alleen zo weten we op welk
  // blad een kenmerk landt, en dat nummer zetten we achter de Class Resources-
  // regel op blad 1. +2 = blad 1 zelf plus de vervolgbladen die er al liggen.
  const featPaginas = pakInBladen(featItems);
  const featStart   = vervolg.length + 2;
  const bladVoor    = new Map();
  featPaginas.forEach((pg, i) => {
    for (const item of pg) if (item.naam) bladVoor.set(kaleNaam(item.naam), featStart + i);
  });
  vervolg.push(...featPaginas.map((pg, i) => ({
    sub: i === 0 ? 'Features &amp; Traits' : 'Features &amp; Traits — vervolg',
    inhoud: pg.map(x => x.html).join(''),
  })));

  // Campagne + groep staan sinds de party-portretten in de voettekst.
  const rechts = [p.campagne, p.groepNaam && `groep ${p.groepNaam}`].filter(Boolean).map(esc).join(' · ');
  const resHtml = resourcesBlok(p.traits, p.trackers, bladVoor);
  // Rechtsboven op blad 1 kijkt de hele party mee. De thumbnail-route levert
  // het portret; mislukt dat (nog geen afbeelding), dan blijven de initialen
  // staan die eronder liggen — vandaar `onerror` dat de <img> weghaalt.
  const partyBlok = (p.party || []).map(lid => `
    <span class="party__lid${lid.zelf ? ' party__lid--zelf' : ''}">
      <span class="party__foto">
        <span class="party__init">${esc(initialen(lid.naam))}</span>
        <img src="/api/thumb/${encodeURIComponent(lid.thumb)}" alt=""
          ${lid.focus ? `style="object-position:${esc(lid.focus)}"` : ''}
          onerror="this.remove()">
      </span>
      <span class="party__naam">${esc(voornaam(lid.naam))}</span>
    </span>`).join('');
  const bladen = [{ sub: klasseRegel, eerste: true, inhoud: `
    <div class="kolommen">
      <section class="kol kol--smal">
        <div class="abils">${abilityBlok(profiel)}</div>

        <h2>Saving Throws</h2>
        <ul class="rijen">${savesBlok(profiel, prof)}</ul>

        <h2>Skills</h2>
        <ul class="rijen rijen--skills">${skillsBlok(profiel, prof)}</ul>
      </section>

      <section class="kol">
        <div class="stats">
          <div class="stat"><span class="lab">Armor Class</span><b>${esc(profiel.ac || '—')}</b></div>
          <div class="stat"><span class="lab">Initiative</span><b>${esc(profiel.initiative || teken(mod(profiel.dex)))}</b></div>
          <div class="stat"><span class="lab">Speed</span><b>${esc(snelheid(profiel.speed) || '—')}</b></div>
          <div class="stat"><span class="lab">Proficiency Bonus</span><b>${teken(prof)}</b></div>
        </div>
        ${extraSnelheden ? `<p class="klein onder">${extraSnelheden}</p>` : ''}
        ${passiefBlok(profiel, prof)}

        <div class="hp">
          <div><span class="lab">Hit Point Maximum</span><b>${esc(hp.max ?? '—')}</b></div>
          <div><span class="lab">Current</span><b>${esc(hp.current ?? '—')}</b></div>
          <div><span class="lab">Temporary</span><b>${hp.temp ? esc(hp.temp) : '<i class="lijn"></i>'}</b></div>
        </div>
        <div class="hd">
          <div><span class="lab">Hit Dice</span><b>${hitDiceTekst(p.hitDice)}</b></div>
          <div><span class="lab">Death Saves</span>
            <span class="ds">Successes ${vakjes(3, 'vak--rond')}</span>
            <span class="ds">Failures ${vakjes(3, 'vak--rond')}</span>
          </div>
          <div><span class="lab">Exhaustion</span>${vakjes(6)}</div>
        </div>

        <h2>Attacks and Cantrips</h2>
        ${wapensBlok(profiel)}

        <h2>Proficiencies &amp; Languages</h2>
        <dl class="paren">
          ${profiel.armorProfs  ? `<dt>Armor</dt><dd>${esc(profiel.armorProfs)}</dd>` : ''}
          ${profiel.weaponProfs ? `<dt>Weapons</dt><dd>${esc(profiel.weaponProfs)}</dd>` : ''}
          ${profiel.toolProfs   ? `<dt>Tools</dt><dd>${esc(profiel.toolProfs)}</dd>` : ''}
          ${profiel.languages   ? `<dt>Languages</dt><dd>${esc(profiel.languages)}</dd>` : ''}
          ${profiel.senses      ? `<dt>Senses</dt><dd>${esc(profiel.senses)}</dd>` : ''}
        </dl>

        ${resHtml ? `<h2>Class Resources &amp; Traits</h2>${resHtml}` : ''}

        ${keuzes ? `<h2>Gemaakte keuzes</h2><ul class="rijen">${keuzes}</ul>` : ''}

        <h2>Notes</h2>
        <div class="notities"></div>
      </section>
    </div>` }, ...vervolg];

  return bladen.map((b, i) => `
  <article class="blad">
    <header class="kop${b.eerste ? '' : ' kop--vervolg'}">
      <div>
        <h1>${esc(p.naam)}</h1>
        <p class="kop__sub">${b.eerste ? esc(b.sub) : b.sub}</p>
      </div>
      ${b.eerste ? `<div class="kop__rechts">
        ${profiel.factieTitel ? `<div class="titel">${esc(profiel.factieTitel)}</div>` : ''}
        ${partyBlok ? `<div class="party">${partyBlok}</div>` : `<div class="klein">${rechts}</div>`}
      </div>` : ''}
    </header>
    <div class="blad__inhoud${b.vul ? ' blad__inhoud--vul' : ''}${b.eerste ? ' blad__inhoud--kolommen' : ''}">${b.inhoud}
      ${b.vul ? '<h2>Notes</h2><div class="notities"></div>' : ''}</div>
    <footer class="blad__voet">
      <span>${esc(p.naam)}</span>
      <span>${rechts}</span>
      <span>blad ${i + 1} van ${bladen.length}</span>
    </footer>
  </article>`).join('\n');
}

// ── Pagina ───────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4 portrait; margin: 9mm 8mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 9.6pt; line-height: 1.34; color: #2a1a08; background: #e9dfc8;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.blad {
  background: #fdfaf2; padding: 9mm; border: 1.6pt solid #8a6d3f; border-radius: 3pt;
  width: 194mm; min-height: 277mm; margin: 6mm auto;
  page-break-after: always; break-after: page;
  display: flex; flex-direction: column;
}
/* De inhoud groeit, de voettekst wordt door margin-top:auto naar de onderrand
   geduwd — zo staat het bladnummer altijd onderaan het vel. */
.blad__inhoud { flex: 1 1 auto; }
.blad__inhoud--vul { display: flex; flex-direction: column; }
/* Blad 1 is één flexkolom, zodat .kolommen doorgroeit tot de voettekst en het
   notitieveld (flex:1 in .kol) de restruimte pakt in plaats van er een gat
   te laten vallen. */
.blad__inhoud--kolommen { display: flex; flex-direction: column; }
.blad__inhoud--kolommen .kolommen { flex: 1 1 auto; }
.blad__voet { margin-top: auto; padding-top: 5pt; border-top: .8pt solid #c4a87a;
  display: flex; justify-content: space-between;
  font-family: 'Cinzel', serif; font-size: 6.6pt; letter-spacing: .4pt;
  text-transform: uppercase; color: #94805d; }
.blad:last-child { page-break-after: auto; break-after: auto; }

h1 { font-family: 'Cinzel', serif; font-size: 19pt; font-weight: 700; margin: 0; letter-spacing: .4pt; }
h2 { font-family: 'Cinzel', serif; font-size: 9.5pt; font-weight: 700; letter-spacing: .8pt;
     text-transform: uppercase; color: #7a5c2e; margin: 11pt 0 4pt;
     border-bottom: .8pt solid #c4a87a; padding-bottom: 2pt; }
/* Groepstitels (Bard, College of Lore, Cantrips, Level 1…) staan gecentreerd
   met een lijn aan weerszijden: dat breekt de tekstmuur op en maakt in één
   oogopslag zichtbaar waar een nieuwe groep begint. De lijnen zijn ::before/
   ::after met flex:1, dus ze vullen automatisch de resterende breedte. */
h3.sub { font-family: 'Cinzel', serif; font-size: 8.4pt; font-weight: 600; letter-spacing: .8pt;
     text-transform: uppercase; color: #8a6d3f; margin: 10pt 0 5pt;
     display: flex; align-items: center; gap: 6pt; text-align: center; }
h3.sub::before, h3.sub::after { content: ''; flex: 1 1 auto; border-top: .5pt solid #cdb88f; }
.klein { font-size: 8.2pt; color: #6b5432; }
.hint  { font-size: 7pt; color: #94805d; font-weight: 400; }
.onder { margin: 1pt 0 0; }

.kop { display: flex; justify-content: space-between; align-items: flex-end; gap: 8pt;
       border-bottom: 2pt solid #8a6d3f; padding-bottom: 5pt; margin-bottom: 8pt; }
.kop--vervolg { display: block; }
.kop__sub { font-family: 'Cinzel', serif; font-size: 9pt; color: #7a5c2e; margin: 2pt 0 0; letter-spacing: .3pt; }
.kop__rechts { text-align: right; }
/* De party rechtsboven op blad 1: ronde portretten met de voornaam eronder.
   Het eigen personage krijgt een dikkere ring, zodat je in een uitgedeelde
   stapel meteen ziet welk blad van wie is. object-fit:cover + het focuspunt
   uit imgFocus houden het gezicht in beeld, net als op de kaartjes in de app. */
.party { display: flex; gap: 6pt; justify-content: flex-end; margin-top: 3pt; }
.party__lid { width: 34pt; text-align: center; }
.party__foto { position: relative; display: block; width: 30pt; height: 30pt; margin: 0 auto;
  border-radius: 50%; overflow: hidden; border: 1pt solid #c4a87a; background: #f7efdd; }
.party__lid--zelf .party__foto { border: 2pt solid #8a6d3f; }
.party__foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.party__init { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif; font-size: 9pt; color: #94805d; }
.party__naam { display: block; font-family: 'Cinzel', serif; font-size: 5.6pt; letter-spacing: .2pt;
  text-transform: uppercase; color: #7a5c2e; margin-top: 1.5pt;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.party__lid--zelf .party__naam { color: #2a1a08; font-weight: 700; }
.titel { font-family: 'IM Fell English', serif; font-style: italic; font-size: 10pt; color: #7a5c2e; }

/* align-items:stretch laat de rechterkolom meegroeien met de (langere) skills-
   kolom links; het notitieveld pakt met flex:1 exact de ruimte die overblijft,
   zodat het blad geen gat houdt hoe lang de lijsten ook uitvallen. */
.kolommen { display: flex; gap: 9pt; align-items: stretch; }
.kol { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; }
.kol--smal { flex: 0 0 58mm; }
.notities { flex: 1 1 auto; min-height: 46pt; border: 1pt solid #c4a87a; border-radius: 2pt;
  background: repeating-linear-gradient(to bottom,
    #fdfaf2 0, #fdfaf2 14.2pt, #d8c69f 14.2pt, #d8c69f 15pt); }

.abils { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4pt; }
.abil { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; text-align: center;
        padding: 3pt 1pt 4pt; }
.abil__label { font-family: 'Cinzel', serif; font-size: 5.6pt; letter-spacing: .3pt;
               text-transform: uppercase; color: #7a5c2e; }
.abil__score { font-size: 16pt; font-weight: 700; line-height: 1.08; }
.abil__mod   { font-size: 8pt; font-weight: 700; color: #6b5432; margin: 1.5pt auto 0; width: 16pt;
               border: .8pt solid #c4a87a; border-radius: 7pt; background: #fdfaf2; }

ul.res { list-style: none; margin: 2pt 0 0; padding: 0; }
ul.res li { display: flex; align-items: baseline; gap: 5pt; padding: 1.4pt 0;
            border-bottom: .4pt dotted #d8c69f; }
ul.res li em { font-style: italic; }
.res__pips { flex: 0 0 auto; white-space: nowrap; }
.res__blad { flex: 0 0 auto; font-family: 'Cinzel', serif; font-size: 5.8pt; letter-spacing: .3pt;
             text-transform: uppercase; color: #94805d; }
.vak--op { background: #8a6d3f; }

ul.rijen { list-style: none; margin: 0; padding: 0; }
ul.rijen li { display: flex; align-items: baseline; gap: 3.5pt; padding: 1pt 0;
              border-bottom: .4pt dotted #d8c69f; }
.rijen--skills li em { font-size: 6.6pt; color: #94805d; text-transform: uppercase; letter-spacing: .2pt; }
.rij__naam   { flex: 1 1 auto; }
.rij__waarde { font-weight: 700; font-variant-numeric: tabular-nums; }

.pip { flex: 0 0 auto; width: 6pt; height: 6pt; border-radius: 50%; border: .8pt solid #8a6d3f; display: inline-block; }
.pip--prof   { background: #8a6d3f; }
.pip--expert { background: #8a6d3f; box-shadow: inset 0 0 0 1.2pt #fdfaf2; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4pt; }
.stats--magie { margin-bottom: 6pt; }
.stats--passief { grid-template-columns: repeat(3, 1fr); margin-top: 4pt; }
.stats--passief b { font-size: 11pt; }
.stat { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; text-align: center; padding: 3pt 2pt; }
.stat b { font-size: 12pt; }
.lab { display: block; font-family: 'Cinzel', serif; font-size: 5.8pt; letter-spacing: .3pt;
       text-transform: uppercase; color: #7a5c2e; }

.hp { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4pt; margin-top: 4pt; }
.hp > div { border: 1pt solid #c4a87a; border-radius: 2pt; padding: 3pt 5pt; }
.hp b { font-size: 12pt; }
.lijn { display: block; border-bottom: .8pt solid #b9a173; height: 11pt; }

.hd { display: flex; gap: 5pt; margin-top: 4pt; align-items: stretch; flex-wrap: wrap; }
.hd > div { border: 1pt solid #c4a87a; border-radius: 2pt; padding: 3pt 5pt; white-space: nowrap; }
.hd b { font-size: 9.6pt; }
.ds { display: inline-block !important; margin-right: 6pt; font-size: 5.8pt; white-space: nowrap;
      font-family: 'Cinzel', serif; letter-spacing: .3pt; text-transform: uppercase; color: #7a5c2e; }
.vak { display: inline-block; width: 7pt; height: 7pt; border: .8pt solid #8a6d3f; margin-right: 2pt;
       vertical-align: middle; }
.vak--rond { border-radius: 50%; }

table.tbl { width: 100%; border-collapse: collapse; margin: 3pt 0 4pt; table-layout: fixed; }
table.tbl th { font-family: 'Cinzel', serif; font-size: 6.2pt; letter-spacing: .3pt; text-transform: uppercase;
               color: #7a5c2e; text-align: left; border-bottom: .8pt solid #c4a87a; padding: 2pt 3pt;
               vertical-align: bottom; }
table.tbl td { padding: 2pt 3pt; border-bottom: .4pt dotted #d8c69f; vertical-align: top;
               overflow-wrap: anywhere; }
table.tbl .mid { text-align: center; }
table.tbl td.naam { font-weight: 600; }
tr.niv th { font-family: 'Cinzel', serif; font-size: 7.4pt; letter-spacing: .5pt; text-transform: uppercase;
            color: #7a5c2e; text-align: left; padding: 7pt 3pt 2pt; border-bottom: .8pt solid #c4a87a; }
.leegrij td, li.leegrij { color: transparent; }

dl.paren { margin: 2pt 0; display: grid; grid-template-columns: 16mm 1fr; gap: 1.5pt 4pt; }
dl.paren dt { font-family: 'Cinzel', serif; font-size: 6.2pt; letter-spacing: .3pt; text-transform: uppercase;
              color: #7a5c2e; padding-top: 1.6pt; }
dl.paren dd { margin: 0; }

/* Twee vaste kolommen: links de voorwerpkaartjes, rechts de losse uitrusting.
   Geen CSS-columns — die knipten één lijst doormidden. */
.inv { display: flex; flex-direction: row; gap: 10pt; align-items: flex-start; }
.inv__kolom { flex: 1 1 0; min-width: 0; }
.inv__kolom h3.sub { margin-top: 0; }
.inv h3.sub { break-after: avoid; }

.beurs { margin: 3pt 0 6pt; }
.beurs__rij { display: flex; align-items: center; gap: 5pt; flex-wrap: wrap; }
.beurs__label { font-family: 'Cinzel', serif; font-size: 6.2pt; letter-spacing: .3pt; text-transform: uppercase;
                color: #7a5c2e; }
.munt { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; padding: 1.5pt 6pt; font-size: 8.4pt; }
.munt b { font-size: 10pt; }
ul.boedel { list-style: none; margin: 0 0 4pt; padding: 0; }
ul.boedel li { display: flex; gap: 5pt; align-items: baseline; padding: 1pt 0;
               border-bottom: .4pt dotted #d8c69f; break-inside: avoid; }
ul.boedel li .rij__naam { flex: 1 1 45%; }
ul.boedel li em { flex: 0 1 auto; min-width: 0; text-align: right; overflow-wrap: anywhere; }
.tags { flex: 0 1 auto; display: flex; gap: 2.5pt; flex-wrap: wrap; justify-content: flex-end; }
.tag { font-size: 6.2pt; letter-spacing: .2pt; text-transform: uppercase; color: #7a5c2e;
       border: .5pt solid #cdb88f; border-radius: 5pt; padding: 0 3pt; white-space: nowrap; }
.tag--rar[data-rarity="uncommon"]  { color: #2f6b3a; border-color: #8fbf96; }
.tag--rar[data-rarity="rare"]      { color: #2a4f8a; border-color: #93a9d4; }
.tag--rar[data-rarity="very-rare"] { color: #5f3585; border-color: #b193cd; }
.tag--rar[data-rarity="legendary"] { color: #8a6100; border-color: #d8b45a; }

.slots { display: flex; flex-wrap: wrap; gap: 5pt 12pt; margin: 3pt 0 5pt; }
.slot { display: flex; align-items: center; gap: 3pt; }
.slot__lvl { font-family: 'Cinzel', serif; font-size: 7.4pt; font-weight: 700; color: #7a5c2e;
             border: 1pt solid #c4a87a; border-radius: 2pt; padding: 0 3pt; }

/* Tekstblokken: features en spreukbeschrijvingen delen dezelfde vorm — okerlijn
   links, kop, meta-regel, tekst. Dat leest als een reeks kaartjes in plaats van
   als één lange lap, en elk blok blijft bij het printen heel. */
.groep { margin-bottom: 8pt; }
.blok { border-left: 1.6pt solid #c4a87a; padding: 0 0 1pt 7pt; margin: 0 0 7pt;
        break-inside: avoid; page-break-inside: avoid; }
.blok__kop { font-family: 'Cinzel', serif; font-size: 9pt; font-weight: 600; letter-spacing: .2pt; }
.blok__tag { font-family: 'Crimson Text', serif; font-size: 7.2pt; font-weight: 400; font-style: italic;
             color: #94805d; margin-left: 5pt; letter-spacing: 0; }
.blok__pips { margin-left: 6pt; white-space: nowrap; }
.blok__meta { font-size: 7.4pt; color: #7a5c2e; letter-spacing: .2pt; margin-top: 1pt; }
.blok__tekst { margin: 2pt 0 0; font-size: 8.6pt; color: #3d2a12; }
.blok__extra { margin: 2.5pt 0 0; font-size: 8.2pt; color: #6b5432; }

.balk { position: sticky; top: 0; z-index: 5; background: #2a1a08; color: #f2e8d2;
        display: flex; gap: 10pt; align-items: center; justify-content: center;
        padding: 8pt; font-family: 'Cinzel', serif; font-size: 10pt; }
.balk button { font-family: 'Cinzel', serif; font-size: 10pt; cursor: pointer;
        background: #c4a87a; color: #2a1a08; border: 1pt solid #8a6d3f; border-radius: 3pt; padding: 4pt 14pt; }

/* Een markdown-tabel uit een SRD-tekst (d4 → effect). De eerste kolom is de
   worp en blijft smal; table-layout:fixed van .tbl doet de rest. */
h4.blok__kop2 { font-family: 'Cinzel', serif; font-size: 7.6pt; font-weight: 600; letter-spacing: .4pt;
       text-transform: uppercase; color: #7a5c2e; margin: 5pt 0 1pt; }
table.tbl--md { font-size: 8.2pt; }
table.tbl--md th:first-child, table.tbl--md td:first-child { width: 9%; text-align: center; }
table.tbl--md th { font-size: 6.4pt; }

/* Printregels staan bewust ONDERAAN: bij gelijke specificiteit wint de laatste
   regel, en .balk zou anders de verberg-regel hieronder overrulen. */
@media print {
  body { background: #fff; }
  .geenprint { display: none !important; }
  /* 274mm i.p.v. de volle 279mm papierruimte: de browser rekent bij het opdelen
     in pagina's met afrondingen, en één punt te veel duwt de voettekst naar een
     lege vervolgpagina — dan klopt "blad X van Y" niet meer. */
  .blad { margin: 0; border-width: 1.2pt; width: auto; min-height: 274mm; padding: 4mm; }
  h2, h3.sub { break-after: avoid; page-break-after: avoid; }
  tr { break-inside: avoid; page-break-inside: avoid; }
}
`;

/**
 * Bouw de printbare pagina.
 * @param {Array} personages  [{ naam, profiel, hp, hitDice, slots, beurs, muntNamen,
 *                               items, voorwerpen, spreuken, features, campagne, groepNaam }]
 * @param {Object} opts       { titel }
 */
function sheetHtml(personages, opts = {}) {
  const titel = opts.titel || 'Character sheets';
  return `<!doctype html>
<html lang="nl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head><body>
<div class="balk geenprint">
  <span>${esc(titel)} — ${personages.length} personage${personages.length === 1 ? '' : 's'}</span>
  <button type="button" onclick="window.print()">Printen</button>
</div>
${personages.map(blad).join('\n')}
</body></html>`;
}

module.exports = { sheetHtml };
