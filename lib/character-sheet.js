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

// D&D rondt naar BENEDEN, ook bij negatieve waarden: score 7 geeft -2, niet -1.
const mod   = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const teken = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const metTeken = (v) => {
  const t = String(v ?? '').trim();
  return /^\d/.test(t) ? '+' + t : (t || '—');
};
const getal = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

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
// Spreukteksten uit de bron bevatten soms [[wikilinks]]; die haken horen niet op papier.
const schoon = (v) => String(v ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1').trim();
// Oudere boedel-items dragen nog een emoji in hun naam. Op papier is dat een leeg
// blokje (de printfonts hebben die glyphs niet), dus die halen we eruit.
// \p{Extended_Pictographic} vangt de hele emoji-range in één Unicode-property.
const zonderEmoji = (v) => String(v ?? '').replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').trim();
// Knip lange beschrijvingen af op een woordgrens i.p.v. midden in een woord.
const kort = (v, max) => {
  const t = String(v ?? '').trim();
  if (t.length <= max) return t;
  const snee = t.slice(0, max);
  return snee.slice(0, snee.lastIndexOf(' ')) + '…';
};

// ── Bouwstenen ───────────────────────────────────────────────────────────────

// ○ geen proficiency · ● proficient · ◉ expertise
const pip = (niveau) => `<span class="pip pip--${niveau}"></span>`;

function abilityBlok(profiel) {
  return ABILITIES.map(([sleutel, label]) => `
    <div class="abil">
      <div class="abil__label">${label}</div>
      <div class="abil__mod">${teken(mod(profiel[sleutel]))}</div>
      <div class="abil__score">${esc(profiel[sleutel] ?? '—')}</div>
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

function skillsBlok(profiel, prof) {
  const profs = alsObject(profiel.skillProfs);
  const adj   = alsObject(profiel.skillAdj);
  let regels = '';
  for (const [ability, lijst] of SKILLS) {
    for (const [sleutel, label] of lijst) {
      const niveau = String(profs[sleutel] || '').toLowerCase();
      const extra  = niveau === 'expert' ? prof * 2 : niveau === 'prof' ? prof : 0;
      const bonus  = mod(profiel[ability]) + extra + getal(adj[sleutel]);
      regels += `<li>${pip(niveau === 'expert' ? 'expert' : extra ? 'prof' : 'geen')}
        <span class="rij__naam">${label} <em>${ability}</em></span>
        <span class="rij__waarde">${teken(bonus)}</span></li>`;
    }
  }
  return regels;
}

function passievePerceptie(profiel, prof) {
  const profs  = alsObject(profiel.skillProfs);
  const adj    = alsObject(profiel.skillAdj);
  const niveau = String(profs['perception'] || '').toLowerCase();
  const extra  = niveau === 'expert' ? prof * 2 : niveau === 'prof' ? prof : 0;
  return 10 + mod(profiel.wis) + extra + getal(adj['perception']);
}

// Lege vakjes om met pen in te vullen: HP tijdens het spel, death saves, exhaustion.
const vakjes = (n, cls = '') => Array.from({ length: n }, () => `<span class="vak ${cls}"></span>`).join('');
// Lege tabelregels/boedelregels: ruimte om tijdens het spel bij te schrijven.
// &nbsp; houdt de cel op hoogte; een echt lege <td> klapt dicht.
const legeRijen = (n, kolommen) =>
  Array.from({ length: n }, () => `<tr class="leegrij">${'<td>&nbsp;</td>'.repeat(kolommen)}</tr>`).join('');
const legeItems = (n) => Array.from({ length: n }, () => '<li class="leegrij">&nbsp;</li>').join('');

function hitDiceTekst(hitDice) {
  const pool  = hitDice?.pool || {};
  const spent = hitDice?.spent || {};
  const delen = Object.keys(pool).sort((a, b) => b - a).map(zijden => {
    const totaal = pool[zijden];
    const op     = getal(spent[zijden]);
    return `${totaal - op}/${totaal}d${zijden}`;
  });
  return delen.join(' · ') || '—';
}

function wapensBlok(profiel) {
  const wapens = alsLijst(profiel.weapons);
  if (!wapens.length) return '<p class="leeg">Geen wapens genoteerd.</p>';
  return `<table class="tbl">
    <thead><tr><th>Naam</th><th class="smal">Attack</th><th>Damage</th><th>Properties</th></tr></thead>
    <tbody>${wapens.map(w => `<tr>
      <td>${esc(w.name)}</td>
      <td class="mid">${esc(w.atk)}</td>
      <td>${esc(w.dmg)}</td>
      <td class="klein">${esc(alsLijst(w.props).join(', '))}</td>
    </tr>`).join('')}${legeRijen(4, 4)}</tbody></table>`;
}

function boedelBlok(items, currency, muntNamen) {
  const munt = Object.entries(muntNamen || {})
    .map(([sleutel, naam]) => `<span class="munt"><b>${getal((currency || {})[sleutel])}</b> ${esc(naam)}</span>`)
    .join('');
  const lijst = (items || []).length
    ? `<ul class="boedel">${items.map(i => `<li><span class="rij__naam">${esc(zonderEmoji(i.name))}</span>
        ${i.note ? `<em class="klein">${esc(i.note)}</em>` : ''}</li>`).join('')}${legeItems(5)}</ul>`
    : `<ul class="boedel">${legeItems(8)}</ul>`;
  return `${munt ? `<div class="beurs">${munt}</div>` : ''}${lijst}`;
}

// ── Spreuken ─────────────────────────────────────────────────────────────────

function slotsBlok(slots) {
  const niveaus = Object.keys(slots || {}).filter(l => getal(slots[l]?.max) > 0)
    .sort((a, b) => a - b);
  if (!niveaus.length) return '';
  return `<div class="slots">${niveaus.map(l => `
    <div class="slot">
      <span class="slot__lvl">${l}</span>
      <span class="slot__pips">${vakjes(getal(slots[l].max), 'vak--rond')}</span>
    </div>`).join('')}</div>`;
}

function spreukenBlok(spreuken) {
  if (!spreuken?.length) return '';
  const perNiveau = new Map();
  for (const s of [...spreuken].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))) {
    const l = getal(s.level);
    if (!perNiveau.has(l)) perNiveau.set(l, []);
    perNiveau.get(l).push(s);
  }
  // Eén tabel voor álle niveaus: met een <colgroup> en table-layout:fixed staan
  // de kolommen over de hele lijst op dezelfde plek. Losse tabellen per niveau
  // schoven per blok op, want dan berekent de browser de breedtes opnieuw.
  const rijen = [...perNiveau.keys()].sort((a, b) => a - b).map(l => `
    <tr class="niv"><th colspan="5">${l === 0 ? 'Cantrips' : `Level ${l}`}</th></tr>
    ${perNiveau.get(l).map(s => `<tr>
      <td class="naam">${esc(s.name)}${s.school ? ` <em class="klein">${esc(s.school)}</em>` : ''}</td>
      <td class="klein">${esc(schoon(s.casting_time))}</td>
      <td class="klein">${esc(s.range)}</td>
      <td class="klein">${esc(s.duration)}</td>
      <td class="mid klein">${s.concentration ? 'C' : ''}${s.concentration && s.ritual ? '/' : ''}${s.ritual ? 'R' : ''}</td>
    </tr>`).join('')}`).join('');
  return `<table class="tbl tbl--spreuk">
    <colgroup><col style="width:27%"><col style="width:26%"><col style="width:13%"><col style="width:26%"><col style="width:8%"></colgroup>
    <thead><tr><th>Naam</th><th>Casting Time</th><th>Range</th><th>Duration</th><th class="mid">C/R</th></tr></thead>
    <tbody>${rijen}${legeRijen(8, 5)}</tbody>
  </table>`;
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

function featuresBlok(groepen) {
  const secties = (groepen || []).filter(g => g.items?.length);
  if (!secties.length) return '';
  return secties.map(g => `
    <h3 class="sub">${esc(g.titel)}</h3>
    <dl class="feats">${g.items.map(f => `
      <dt>${esc(f.name)}${f.level ? `<span class="lvl">lvl ${esc(f.level)}</span>` : ''}</dt>
      <dd>${esc(kort(f.desc, 900))}</dd>`).join('')}</dl>`).join('');
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

  const magie = spellcastingBron(profiel, prof);
  const heeftMagie   = !!(p.spreuken?.length || profiel.spellSaveDC);
  const extraSnelheden = alsLijst(profiel.extraSpeeds).filter(s => s.value)
    .map(s => `${esc(s.label)} ${esc(s.value)}`).join(' · ');
  const keuzes = Object.entries(alsObject(profiel.featChoices))
    .filter(([, v]) => v)
    .map(([sleutel, v]) => `<li><span class="rij__naam">${esc(sleutel.split('|').pop())}</span>
      <span class="klein">${esc(v)}</span></li>`).join('');

  const spreukenHtml = spreukenBlok(p.spreuken);
  const featuresHtml = featuresBlok(p.features);

  return `
  <article class="blad">
    <header class="kop">
      <div>
        <h1>${esc(p.naam)}</h1>
        <p class="kop__sub">${esc(klasseRegel)}</p>
      </div>
      <div class="kop__rechts">
        ${profiel.factieTitel ? `<div class="titel">${esc(profiel.factieTitel)}</div>` : ''}
        <div class="klein">${esc(p.campagne || '')}</div>
      </div>
    </header>

    <div class="kolommen">
      <section class="kol kol--smal">
        <div class="abils">${abilityBlok(profiel)}</div>

        <h2>Saving Throws</h2>
        <ul class="rijen">${savesBlok(profiel, prof)}</ul>

        <h2>Skills</h2>
        <ul class="rijen rijen--skills">${skillsBlok(profiel, prof)}</ul>

        <div class="passief">
          <span>Passive Perception</span><b>${passievePerceptie(profiel, prof)}</b>
        </div>
      </section>

      <section class="kol">
        <div class="stats">
          <div class="stat"><span>Armor Class</span><b>${esc(profiel.ac || '—')}</b></div>
          <div class="stat"><span>Initiative</span><b>${esc(profiel.initiative || teken(mod(profiel.dex)))}</b></div>
          <div class="stat"><span>Speed</span><b>${esc(profiel.speed || '—')}</b></div>
          <div class="stat"><span>Proficiency</span><b>${teken(prof)}</b></div>
        </div>
        ${extraSnelheden ? `<p class="klein onder">${extraSnelheden}</p>` : ''}

        <div class="hp">
          <div class="hp__max"><span class="lab">Hit Point Maximum</span><b>${esc(hp.max ?? '—')}</b></div>
          <div class="hp__nu"><span class="lab">Current</span><i class="lijn"></i></div>
          <div class="hp__nu"><span class="lab">Temporary</span><i class="lijn"></i></div>
        </div>
        <div class="hd">
          <div><span class="lab">Hit Dice</span><b>${hitDiceTekst(p.hitDice)}</b></div>
          <div><span class="lab">Death Saves</span>
            <span class="ds">Successes ${vakjes(3, 'vak--rond')}</span>
            <span class="ds">Failures ${vakjes(3, 'vak--rond')}</span>
          </div>
          <div><span class="lab">Exhaustion</span>${vakjes(6)}</div>
        </div>

        <h2>Attacks</h2>
        ${wapensBlok(profiel)}

        <h2>Proficiencies &amp; Languages</h2>
        <dl class="paren">
          ${profiel.armorProfs  ? `<dt>Armor</dt><dd>${esc(profiel.armorProfs)}</dd>` : ''}
          ${profiel.weaponProfs ? `<dt>Weapons</dt><dd>${esc(profiel.weaponProfs)}</dd>` : ''}
          ${profiel.toolProfs   ? `<dt>Tools</dt><dd>${esc(profiel.toolProfs)}</dd>` : ''}
          ${profiel.languages   ? `<dt>Languages</dt><dd>${esc(profiel.languages)}</dd>` : ''}
          ${profiel.senses      ? `<dt>Senses</dt><dd>${esc(profiel.senses)}</dd>` : ''}
        </dl>

        ${keuzes ? `<h2>Gemaakte keuzes</h2><ul class="rijen">${keuzes}</ul>` : ''}

        <h2>Boedel</h2>
        ${boedelBlok(p.items, p.currency, p.muntNamen)}
      </section>
    </div>
  </article>

  ${heeftMagie ? `
  <article class="blad">
    <header class="kop kop--vervolg">
      <h1>${esc(p.naam)}</h1>
      <p class="kop__sub">Spellcasting</p>
    </header>
    <div class="stats stats--magie">
      <div class="stat"><span>Ability</span><b>${esc(magie.ability || '—')}</b></div>
      <div class="stat"><span>Modifier</span><b>${magie.mod == null ? '—' : teken(magie.mod)}</b></div>
      <div class="stat"><span>Save DC</span><b>${esc(profiel.spellSaveDC || '—')}</b></div>
      <div class="stat"><span>Attack Bonus</span><b>${esc(metTeken(profiel.spellAttackBonus))}</b></div>
    </div>
    ${slotsBlok(p.slots) ? `<h2>Spell Slots</h2>${slotsBlok(p.slots)}` : ''}
    <h2>Cantrips &amp; Prepared Spells</h2>
    ${spreukenHtml || '<p class="leeg">Nog geen spreuken genoteerd.</p>'}
  </article>` : ''}

  ${featuresHtml ? `
  <article class="blad">
    <header class="kop kop--vervolg">
      <h1>${esc(p.naam)}</h1>
      <p class="kop__sub">Features &amp; Traits</p>
    </header>
    ${featuresHtml}
  </article>` : ''}`;
}

// ── Pagina ───────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4 portrait; margin: 12mm 11mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 9.6pt; line-height: 1.32; color: #2a1a08; background: #e9dfc8;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.blad {
  background: #fdfaf2; padding: 9mm 9mm 7mm;
  border: 1.6pt solid #8a6d3f; border-radius: 3pt;
  width: 188mm; min-height: 271mm; margin: 6mm auto;
  page-break-after: always; break-after: page;
}
.blad:last-child { page-break-after: auto; break-after: auto; }

h1 { font-family: 'Cinzel', serif; font-size: 19pt; font-weight: 700; margin: 0; letter-spacing: .4pt; }
h2 { font-family: 'Cinzel', serif; font-size: 9.5pt; font-weight: 700; letter-spacing: .8pt;
     text-transform: uppercase; color: #7a5c2e; margin: 9pt 0 3pt;
     border-bottom: .8pt solid #c4a87a; padding-bottom: 1.5pt; }
h3.sub { font-family: 'Cinzel', serif; font-size: 8.6pt; font-weight: 600; letter-spacing: .6pt;
     text-transform: uppercase; color: #8a6d3f; margin: 7pt 0 2pt; }
.klein { font-size: 8.2pt; color: #6b5432; }
.leeg  { font-size: 8.4pt; color: #94805d; font-style: italic; margin: 2pt 0; }
.onder { margin: 1pt 0 0; }

.kop { display: flex; justify-content: space-between; align-items: flex-end; gap: 8pt;
       border-bottom: 2pt solid #8a6d3f; padding-bottom: 4pt; margin-bottom: 7pt; }
.kop--vervolg { display: block; }
.kop__sub { font-family: 'Cinzel', serif; font-size: 9pt; color: #7a5c2e; margin: 1pt 0 0; letter-spacing: .3pt; }
.kop__rechts { text-align: right; }
.titel { font-family: 'IM Fell English', serif; font-style: italic; font-size: 10pt; color: #7a5c2e; }

.kolommen { display: flex; gap: 8pt; align-items: flex-start; }
.kol { flex: 1 1 0; min-width: 0; }
.kol--smal { flex: 0 0 58mm; }

.abils { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3pt; }
.abil { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; text-align: center; padding: 2.5pt 1pt; }
.abil__label { font-family: 'Cinzel', serif; font-size: 5.6pt; letter-spacing: .3pt; text-transform: uppercase; color: #7a5c2e; }
.abil__mod   { font-size: 14pt; font-weight: 700; line-height: 1.05; }
.abil__score { font-size: 7.6pt; color: #6b5432; }

ul.rijen { list-style: none; margin: 0; padding: 0; }
ul.rijen li { display: flex; align-items: baseline; gap: 3pt; padding: .6pt 0;
              border-bottom: .4pt dotted #d8c69f; }
.rijen--skills li em { font-size: 6.6pt; color: #94805d; text-transform: uppercase; letter-spacing: .2pt; }
.rij__naam   { flex: 1 1 auto; }
.rij__waarde { font-weight: 700; font-variant-numeric: tabular-nums; }

.pip { flex: 0 0 auto; width: 6pt; height: 6pt; border-radius: 50%; border: .8pt solid #8a6d3f; display: inline-block; }
.pip--prof   { background: #8a6d3f; }
.pip--expert { background: #8a6d3f; box-shadow: inset 0 0 0 1.2pt #fdfaf2; }

.passief { display: flex; justify-content: space-between; align-items: center; margin-top: 5pt;
           border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; padding: 3pt 5pt;
           font-family: 'Cinzel', serif; font-size: 7.6pt; letter-spacing: .3pt; text-transform: uppercase; }
.passief b { font-size: 11pt; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3pt; }
.stats--magie { margin-bottom: 6pt; }
.stat { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; text-align: center; padding: 3pt 2pt; }
.stat span { display: block; font-family: 'Cinzel', serif; font-size: 5.8pt; letter-spacing: .3pt;
             text-transform: uppercase; color: #7a5c2e; }
.stat b { font-size: 12pt; }

.hp { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3pt; margin-top: 4pt; }
.hp > div { border: 1pt solid #c4a87a; border-radius: 2pt; padding: 3pt 5pt; }
.hp .lab { display: block; font-family: 'Cinzel', serif; font-size: 5.8pt; letter-spacing: .3pt;
           text-transform: uppercase; color: #7a5c2e; }
.hp__max b { font-size: 12pt; }
.lijn { display: block; border-bottom: .8pt solid #b9a173; height: 12pt; }

.hd { display: flex; gap: 6pt; margin-top: 4pt; align-items: flex-start; flex-wrap: wrap; }
.hd > div { border: 1pt solid #c4a87a; border-radius: 2pt; padding: 3pt 5pt; }
.hd .lab { font-family: 'Cinzel', serif; font-size: 5.8pt; letter-spacing: .3pt;
           text-transform: uppercase; color: #7a5c2e; display: block; }
.hd b { font-size: 9.4pt; }
.ds { display: inline-block !important; margin-right: 6pt; font-size: 5.8pt; white-space: nowrap;
      font-family: 'Cinzel', serif; letter-spacing: .3pt; text-transform: uppercase; color: #7a5c2e; }
.hd > div { white-space: nowrap; }
.vak { display: inline-block; width: 7pt; height: 7pt; border: .8pt solid #8a6d3f; margin-right: 2pt; vertical-align: middle; }
.vak--rond { border-radius: 50%; }

table.tbl { width: 100%; border-collapse: collapse; margin: 2pt 0 4pt; }
table.tbl th { font-family: 'Cinzel', serif; font-size: 6.4pt; letter-spacing: .3pt; text-transform: uppercase;
               color: #7a5c2e; text-align: left; border-bottom: .8pt solid #c4a87a; padding: 1.5pt 3pt; }
table.tbl td { padding: 1.5pt 3pt; border-bottom: .4pt dotted #d8c69f; vertical-align: top; }
table.tbl .smal { width: 9%; } table.tbl .mid { text-align: center; }
table.tbl--spreuk { table-layout: fixed; }
table.tbl--spreuk td { overflow-wrap: anywhere; }
table.tbl--spreuk td.naam { font-weight: 600; }
tr.niv th { font-family: 'Cinzel', serif; font-size: 7.4pt; letter-spacing: .5pt; text-transform: uppercase;
            color: #7a5c2e; text-align: left; padding: 5pt 3pt 1.5pt; border-bottom: .8pt solid #c4a87a; }

dl.paren { margin: 2pt 0; display: grid; grid-template-columns: 15mm 1fr; gap: 1pt 4pt; }
dl.paren dt { font-family: 'Cinzel', serif; font-size: 6.4pt; letter-spacing: .3pt; text-transform: uppercase;
              color: #7a5c2e; padding-top: 1.4pt; }
dl.paren dd { margin: 0; }

.beurs { display: flex; gap: 8pt; margin: 2pt 0 3pt; flex-wrap: wrap; }
.munt { border: 1pt solid #c4a87a; border-radius: 2pt; background: #f7efdd; padding: 1.5pt 5pt; font-size: 8.4pt; }
.munt b { font-size: 10pt; }
ul.boedel { list-style: none; margin: 0; padding: 0; }
ul.boedel li { display: flex; gap: 5pt; align-items: baseline; padding: .8pt 0; border-bottom: .4pt dotted #d8c69f; }
ul.boedel li .rij__naam { flex: 1 1 45%; }
ul.boedel li em { flex: 0 1 auto; min-width: 0; text-align: right; overflow-wrap: anywhere; }

.slots { display: flex; flex-wrap: wrap; gap: 4pt 10pt; margin: 2pt 0 5pt; }
.slot { display: flex; align-items: center; gap: 3pt; }
.slot__lvl { font-family: 'Cinzel', serif; font-size: 7.4pt; font-weight: 700; color: #7a5c2e;
             border: 1pt solid #c4a87a; border-radius: 2pt; padding: 0 3pt; }

dl.feats { margin: 0; }
dl.feats dt { font-family: 'Cinzel', serif; font-size: 8.4pt; font-weight: 600; margin-top: 4pt; }
dl.feats dt .lvl { font-family: 'Crimson Text', serif; font-size: 6.8pt; font-weight: 400;
                   color: #94805d; margin-left: 4pt; text-transform: none; letter-spacing: 0; }
dl.feats dd { margin: 0 0 2pt; font-size: 8.6pt; color: #3d2a12; }
.leegrij td, li.leegrij { color: transparent; }

.balk { position: sticky; top: 0; z-index: 5; background: #2a1a08; color: #f2e8d2;
        display: flex; gap: 10pt; align-items: center; justify-content: center;
        padding: 8pt; font-family: 'Cinzel', serif; font-size: 10pt; }
.balk button { font-family: 'Cinzel', serif; font-size: 10pt; cursor: pointer;
        background: #c4a87a; color: #2a1a08; border: 1pt solid #8a6d3f; border-radius: 3pt; padding: 4pt 14pt; }

/* Printregels staan bewust ONDERAAN: bij gelijke specificiteit wint de laatste
   regel, en .balk zou anders de verberg-regel hieronder overrulen. */
@media print {
  body { background: #fff; }
  .geenprint { display: none !important; }
  .blad { margin: 0; border-width: 1.2pt; width: auto; min-height: 254mm; padding: 5mm; }
  h2, h3.sub { break-after: avoid; page-break-after: avoid; }
  tr, dl.feats dt, dl.feats dd { break-inside: avoid; page-break-inside: avoid; }
  dl.feats dt { break-after: avoid; page-break-after: avoid; }
}
`;

/**
 * Bouw de printbare pagina.
 * @param {Array} personages  [{ naam, profiel, hp, hitDice, slots, currency, muntNamen, items, spreuken, features, campagne }]
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
