#!/usr/bin/env node
// Midjourney-prompts voor alles in het Heldenboek en de spreukenbibliotheek
// dat nog geen afbeelding heeft.
//
// Eén document, per soort gegroepeerd (classes, subclasses, species,
// backgrounds, feats, Epic Boons, spreuken per level), met per kaartje een
// prompt in een codeblok zodat je hem in één tik kopieert. Alle prompts delen
// dezelfde stijlstaart (`STIJL`), zodat de platen er samen als één reeks
// uitzien — en je die stijl op één plek bijstelt.
//
// Waar het onderwerp vandaan komt:
//  - classes, subclasses, species, feats, Epic Boons en de zestien
//    PHB-backgrounds: met de hand geschreven, in scripts/midjourney/onderwerpen.js;
//  - spreuken: uit hun eigen tekst — de eerste zin die iets laat zien en niet
//    over regels gaat ("make a Dexterity saving throw" is geen beeld), plus een
//    beeldtaal per school en een kleur per schadesoort;
//  - de rest: uit de naam, met de soort erbij.
//
// Welke kaartjes er al een afbeelding hebben weet alleen de campagne zelf:
//  - een spreuk heeft er een als `files/spell-img-<index>.*` bestaat;
//  - een feat of Epic Boon als zijn regel in progression.json een `img` draagt;
//  - een class, subclass, species of background als `meta.heldenboek` er een
//    beeld bij heeft (`klassen`, `subclassen`, `species`, `backgrounds`).
// Verborgen classes en subclasses (`meta.heldenboek.verborgen`) slaat hij over.
//
//   node scripts/midjourney-prompts.js <campagne>          alleen wat nog geen beeld heeft
//   node scripts/midjourney-prompts.js --alles             alles uit de meegeleverde bronnen
//   ... --uit <pad.md>                                     anders dan docs/midjourney-prompts.md
//
// Op de server, tegen de live data:
//   GRISBURGH_DATA_DIR=/var/www/grisburgh/data node scripts/midjourney-prompts.js grisburgh
const fs   = require('fs');
const path = require('path');
const ON   = require('./midjourney/onderwerpen');

const WORTEL = path.join(__dirname, '..');
const BRON   = (n) => path.join(WORTEL, 'bronnen', n);
const lees   = (p, standaard = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return standaard; } };

// ── De stijl ────────────────────────────────────────────────────────────────
// Het perkamentthema van de app: warm oker, diepe schaduw, geschilderd. Geen
// tekst in beeld (Midjourney zet er anders letters in die nergens op slaan).
// 2:3 is staand, zoals de kaartjes en het spreukenboek.
const STIJL = 'painterly dark fantasy illustration, warm ochre and umber palette, deep shadows, ' +
  'dramatic rim light, aged parchment texture, rich detail, no text, no lettering --ar 2:3 --style raw';

// Een beeldtaal per school. Bewust geen kleur die met de schadesoort botst:
// die komt er los bij.
const SCHOOL = {
  Abjuration:    'shimmering protective wards and glowing runic circles',
  Conjuration:   'a swirling portal with forms coalescing from mist',
  Divination:    'an all-seeing eye, star charts and silver moonlight',
  Enchantment:   'glimmering motes of charm and entranced, dreamy faces',
  Evocation:     'a burst of raw elemental energy',
  Illusion:      'shifting mirages and translucent iridescent doubles',
  Necromancy:    'creeping shadows, bones and sickly green light',
  Transmutation: 'matter reshaping itself in flowing golden alchemical light',
};
const SCHADE = {
  acid: 'hissing green acid', cold: 'frost crystals and pale blue mist', fire: 'roaring orange flames',
  force: 'translucent blue force', lightning: 'forked white-blue lightning', necrotic: 'withering black tendrils',
  poison: 'toxic green vapour', psychic: 'fractured violet mindscape', radiant: 'golden holy radiance',
  thunder: 'a rippling shockwave of sound', bludgeoning: '', piercing: '', slashing: '',
};

// ── Een spreuk in beeld ─────────────────────────────────────────────────────
// Regeltaal is geen beeld. Elke zin krijgt een score: woorden die iets laten
// zien tellen op, regelwoorden ("saving throw", "if the target fails") tellen
// af. De beste zin met een positieve score wordt het onderwerp; is er geen,
// dan blijft het bij de naam met de beeldtaal van zijn school — die naam zegt
// Midjourney vaak al genoeg ("Fireball", "Misty Step").
const REGELS = /saving throw|attack roll|\b\d+d\d+\b|ability check|hit points?|bonus action|\breaction\b|spell slot|\blevel\b|\bDC\b|advantage|disadvantage|concentration|must succeed|\bturn\b|initiative|proficien|modifier|\bround\b|\bcondition\b|\breroll\b|\bd20\b|spell list|\bsave\b|\bduration\b|\bfailed\b|\bsucceeds?\b/i;
const BEGIN_REGEL = /^(if|choose|when|on a|each|until|whenever|at higher|using a|this spell|the spell|a creature|any creature|while|alternatively|instead|the target)\b/i;
const BEELD = /\b(light|glow\w*|flame\w*|fire|mist|fog|smoke|shadow\w*|darkness|wave|beam|bolt|ray|hand|cloud|wall|sphere|orb|storm|wind|ice|frost|lightning|thunder|vines?|roots?|thorns?|spectral|ghostly|shimmer\w*|sparks?|blossom\w*|explo\w+|burst\w*|crackl\w*|radian\w*|shining|swirl\w*|whirl\w*|blade\w*|sword|shield|chain\w*|tentacles?|bones?|skulls?|spirit\w*|illusion\w*|image|duplicate\w*|portal|door|eyes?|stars?|moon\w*|sun\w*|water|earth|stone|acid|insects?|swarm|wolf|beast|feather\w*|wings?|serpent\w*|dragon\w*|tree|plants?|petals?|sound|music|whisper\w*|screams?|aura|ward|barrier|dome|cube|cylinder|cone|line)\b/gi;

function _score(z) {
  let sc = (z.match(BEELD) || []).length * 2;
  if (REGELS.test(z)) sc -= 4;
  if (BEGIN_REGEL.test(z)) sc -= 3;
  if (/\byou\b/i.test(z)) sc += 1;   // de beschrijving van wat de caster doet
  return sc;
}

// "You hurl a bubble" → "a spellcaster hurling a bubble". Een werkwoord na
// "you" krijgt -ing aan het begin en -s midden in de zin, zodat het als een
// beschrijving van een plaat leest en niet als een instructie.
function _ing(w) {
  if (/(ie)$/.test(w)) return w.replace(/ie$/, 'ying');
  if (/[^aeiou]e$/.test(w) && !/(ee|ye)$/.test(w)) return w.replace(/e$/, 'ing');
  if (/^(stop|grip|drop|tap|slip|step|hug|nod|bat|cut|hit|let|set|put|run|swim|spin|stab|grab)$/.test(w)) return w + w.slice(-1) + 'ing';
  return w + 'ing';
}
function _s(w) {
  if (/(s|sh|ch|x|z|o)$/.test(w)) return w + 'es';
  if (/[^aeiou]y$/.test(w)) return w.replace(/y$/, 'ies');
  return w + 's';
}
const _NIET_WERKWOORD = /^(can|must|may|might|will|would|should|have|are|were|and|or|the|a|an|also)$/i;
function _zin(t) {
  return String(t || '')
    .replace(/\*+|_+/g, '')
    .replace(/\s*\([^)]*\)/g, '')                       // "(see appendix B)", "(their choice)"
    .replace(/^(for the duration|until the spell ends|as a bonus action|as an action),\s*/i, '')
    .replace(/\b\d+-(foot|feet|mile)s?(-radius|-long|-wide|-tall|-high)?\b/gi, '')
    .replace(/\b(up to )?\d+ (feet|foot|miles?)\b/gi, '')
    .replace(/\b(to |at )?a point (that )?you (can see |choose )?(within range)?/gi, '')
    .replace(/\b(within|out to) range\b/gi, '')
    .replace(/\b(of your choice|that you can see|you choose|that you choose)\b/gi, '')
    .replace(/^You (\w+)/, (m, w) => _NIET_WERKWOORD.test(w) ? `A spellcaster ${w}` : `A spellcaster ${_ing(w.toLowerCase())}`)
    .replace(/\byou (\w+)/g, (m, w) => _NIET_WERKWOORD.test(w) ? `the spellcaster ${w}` : `the spellcaster ${_s(w)}`)
    .replace(/\byou\b/gi, 'the spellcaster')
    .replace(/\bYour\b/g, 'Their').replace(/\byour\b/g, 'their')
    .replace(/\bthe spellcaster can see\b/g, 'nearby')
    .replace(/\s+([,.])/g, '$1').replace(/\s{2,}/g, ' ').replace(/\s+$/, '').trim();
}
function _kort(t, woorden = 30) {
  const w = t.split(/\s+/);
  return w.length <= woorden ? t.replace(/[.;:,]$/, '') : w.slice(0, woorden).join(' ').replace(/[,;:]$/, '');
}
function spreukOnderwerp(s) {
  const tekst = (Array.isArray(s.desc) ? s.desc : [s.desc]).filter(Boolean).join(' ');
  const zinnen = tekst.split(/(?<=[.!?])\s+/).map(z => z.trim()).filter(z => z.length > 20).slice(0, 6);
  const beste = zinnen.map(z => ({ z, sc: _score(z) })).sort((a, b) => b.sc - a.sc)[0];
  const beeld = beste && beste.sc > 0 ? beste.z : null;
  const school = SCHOOL[s.school?.name || s.school] || '';
  const type = (s.damage?.damage_type?.name || (tekst.match(/\b(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder)\b damage/i) || [])[1] || '').toLowerCase();
  const kleur = SCHADE[type] || '';
  const delen = [`the spell ${s.name}`];
  if (beeld) delen.push(_kort(_zin(beeld)).replace(/^./, c => c.toLowerCase()));
  if (school) delen.push(school);
  if (kleur) delen.push(kleur);
  return delen.join(', ');
}

// ── De rest: uit de naam als er geen eigen onderwerp is ─────────────────────
const UIT_NAAM = {
  class:      (n) => `a ${n} adventurer, full figure, iconic equipment of the class`,
  subclass:   (n, k) => `a ${k || 'adventurer'} of the ${n}, full figure, the defining power of the ${n} made visible`,
  species:    (n) => `a ${n} adventurer, character portrait showing the distinctive features of the ${n}`,
  background: (n) => `an adventurer with the ${n} background, shown at work in their former life`,
  feat:       (n) => `an adventurer demonstrating the ${n} feat in action`,
  boon:       (n) => `a legendary hero granted the ${n}, mythic and awe-inspiring`,
};
function onderwerp(soort, naam, extra) {
  const tabel = { class: ON.KLASSEN, subclass: ON.SUBKLASSEN, species: ON.SPECIES,
    background: ON.BACKGROUNDS, feat: ON.FEATS, boon: ON.BOONS }[soort];
  return tabel?.[naam] || UIT_NAAM[soort](naam, extra);
}
const prompt = (o) => `${o}, ${STIJL}`;

// ── Wat er is ───────────────────────────────────────────────────────────────
function verzamel(campagne) {
  const dir = campagne
    ? path.join(process.env.GRISBURGH_DATA_DIR || path.join(WORTEL, 'data'), 'campaigns', campagne)
    : null;
  if (dir && !fs.existsSync(dir)) {
    console.error(`Geen campagne gevonden in ${dir}`);
    process.exit(1);
  }
  const meta = dir ? lees(path.join(dir, 'meta.json'), {}) : {};
  const hb = meta.heldenboek || {};
  const verborgen = hb.verborgen || { classes: [], subclasses: [] };
  const prog = (dir && lees(path.join(dir, 'progression.json'))) || lees(BRON('class-progression.json'), {});
  const bestanden = new Set();
  if (dir) {
    try { for (const f of fs.readdirSync(path.join(dir, 'files'))) bestanden.add(f.replace(/\.[^.]+$/, '')); } catch { /* geen map */ }
  }
  const heeftBestand = (id) => !!id && (!dir || bestanden.has(String(id)));
  const hbHeeft = (bak, naam) => {
    const b = hb[bak]?.[naam];
    const id = typeof b === 'string' ? b : b?.id;
    return heeftBestand(id);
  };
  const filter = !!dir;
  const items = [];
  const erbij = (soort, groep, naam, heeft, extra) => {
    if (filter && heeft) return;
    items.push({ soort, groep, naam, prompt: prompt(onderwerp(soort, naam, extra)) });
  };

  // Classes en subclasses
  for (const [klasse, k] of Object.entries(prog.classes || {})) {
    if ((verborgen.classes || []).includes(klasse)) continue;
    erbij('class', 'Classes', klasse, hbHeeft('klassen', klasse));
    for (const sub of Object.keys(k.subclasses || {})) {
      if ((verborgen.subclasses || []).includes(sub)) continue;
      erbij('subclass', `Subclasses — ${klasse}`, sub, hbHeeft('subclassen', sub), klasse);
    }
  }
  // Species
  for (const soort of Object.keys(prog.species || {})) erbij('species', 'Species', soort, hbHeeft('species', soort));
  if (!dir) for (const soort of Object.keys(lees(BRON('features-elders.json'), {}).species || {})) {
    if (!(prog.species || {})[soort]) erbij('species', 'Species (elders)', soort, false);
  }
  // Backgrounds
  const bgs = Object.keys(prog.backgrounds || {}).length ? prog.backgrounds : lees(BRON('backgrounds-2024.json'), {});
  for (const bg of Object.keys(bgs)) erbij('background', 'Backgrounds', bg, hbHeeft('backgrounds', bg));
  // Feats en Epic Boons: eigen regels (met img) of de meegeleverde namen.
  const seedFeats = lees(BRON('feats-2024.json'), { general: [], epic: [] });
  const regels = (lijst, seed) => (lijst && lijst.length ? lijst : seed).map(f => typeof f === 'string' ? { name: f } : f);
  for (const f of regels(prog.feats?.general, seedFeats.general)) erbij('feat', 'Feats', f.name, heeftBestand(f.img));
  for (const f of regels(prog.feats?.epic, seedFeats.epic)) erbij('boon', 'Epic Boons', f.name, heeftBestand(f.img));

  // Spreuken: de bron, de aanvullingen en wat de campagne zelf verzon.
  const bron = meta.spellSource === 'hp' ? 'hp-spells.json' : 'spells-2024.json';
  const lijst = [
    ...((lees(BRON(bron), {}).results) || []),
    ...((lees(BRON('extra-spells.json'), {}).results) || []),
    ...(dir ? (lees(path.join(dir, 'spells.json'), {}).eigenSpreuken || []) : []),
  ];
  const gezien = new Set();
  for (const s of lijst) {
    if (!s?.index || gezien.has(s.index)) continue;
    gezien.add(s.index);
    if (!s.school && !String(s.index).startsWith('eigen-')) continue;   // magische voorwerpen in de bron
    const heeft = heeftBestand(`spell-img-${s.index}`);
    if (filter && heeft) continue;
    const lvl = s.level ? `Level ${s.level}` : 'Cantrips';
    items.push({ soort: 'spell', groep: `Spreuken — ${lvl}`, naam: s.name, level: s.level || 0, prompt: prompt(spreukOnderwerp(s)) });
  }
  return { items, filter, campagne };
}

// ── Het document ────────────────────────────────────────────────────────────
function document({ items, filter, campagne }) {
  const groepen = new Map();
  for (const it of items) {
    if (!groepen.has(it.groep)) groepen.set(it.groep, []);
    groepen.get(it.groep).push(it);
  }
  // Spreuken op level; de rest in de volgorde waarin ze binnenkwamen.
  const volgorde = [...groepen.keys()].sort((a, b) => {
    const sa = a.startsWith('Spreuken'), sb = b.startsWith('Spreuken');
    if (sa !== sb) return sa ? 1 : -1;
    if (sa) return (parseInt(a.match(/\d+/)?.[0]) || 0) - (parseInt(b.match(/\d+/)?.[0]) || 0);
    return 0;
  });
  const uit = [];
  uit.push('# Midjourney-prompts');
  uit.push('');
  uit.push(filter
    ? `Alles in **${campagne}** dat nog geen afbeelding heeft — ${items.length} kaartjes. Gemaakt met \`node scripts/midjourney-prompts.js ${campagne}\`; draai hem opnieuw nadat je platen hebt toegevoegd, dan valt wat klaar is eruit.`
    : `Alles uit de meegeleverde bronnen — ${items.length} kaartjes, **ongefilterd**: dit is gemaakt zonder de campagnedata, dus er staan ook kaartjes in die al een plaat hebben. Op de server maakt \`GRISBURGH_DATA_DIR=/var/www/grisburgh/data node scripts/midjourney-prompts.js grisburgh\` de lijst met alleen wat nog ontbreekt.`);
  uit.push('');
  uit.push('Elke prompt eindigt op dezelfde stijl, zodat de platen samen één reeks vormen:');
  uit.push('');
  uit.push('```');
  uit.push(STIJL);
  uit.push('```');
  uit.push('');
  uit.push('Staand formaat (2:3), net als de kaartjes en het spreukenboek. Wil je een andere stijl, pas dan `STIJL` aan in `scripts/midjourney-prompts.js` en maak het document opnieuw. Upload de plaat daarna op het kaartje zelf: bij een spreuk in het spreukdetail, bij een feat of boon in het Heldenboek-venster, bij een class, subclass, species of background op zijn kaart.');
  uit.push('');
  uit.push('## Inhoud');
  uit.push('');
  for (const g of volgorde) uit.push(`- [${g}](#${g.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ +/g, '-')}) — ${groepen.get(g).length}`);
  uit.push('');
  for (const g of volgorde) {
    uit.push(`## ${g}`);
    uit.push('');
    for (const it of groepen.get(g)) {
      uit.push(`### ${it.naam}`);
      uit.push('');
      uit.push('```');
      uit.push(it.prompt);
      uit.push('```');
      uit.push('');
    }
  }
  return uit.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const alles = args.includes('--alles');
  const uitI = args.indexOf('--uit');
  const uitPad = uitI >= 0 ? args[uitI + 1] : path.join(WORTEL, 'docs', 'midjourney-prompts.md');
  const campagne = alles ? null : args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--uit');
  if (!alles && !campagne) {
    console.error('Gebruik: node scripts/midjourney-prompts.js <campagne> | --alles  [--uit <pad.md>]');
    process.exit(1);
  }
  const res = verzamel(campagne);
  fs.writeFileSync(uitPad, document(res));
  const per = {};
  for (const it of res.items) per[it.soort] = (per[it.soort] || 0) + 1;
  console.log(`${res.items.length} prompts naar ${path.relative(WORTEL, uitPad)}`, per);
}

module.exports = { spreukOnderwerp, onderwerp, STIJL, verzamel };
