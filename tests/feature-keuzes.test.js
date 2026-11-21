const { describe, it } = require('node:test');
const assert = require('node:assert');

const pc = require('../lib/personage-concept');

// **Wat een feature je laat kiezen.** Eén blok was genoeg zolang elke feature
// één ding gaf, maar dat is in de boeken eerder uitzondering dan regel: Giant's
// Power geeft een taal én een cantrip, Student of War een gereedschap én een
// skill, en Half-Elf laat je eerst een vórm kiezen waarvan alleen één variant
// skills geeft. Die drie vormen zijn hier vastgelegd, want ze gaan allemaal
// over hetzelfde risico: een speler die iets krijgt wat hij niet hoort te
// krijgen, zonder dat iemand het ziet.
const PROG = {
  classes: {
    Barbarian: {
      subclassLevel: 3,
      levels: {
        3: [{
          name: 'Primal Knowledge',
          // "een skill uit de lijst die deze class op level 1 aanbiedt" — die
          // lijst staat in bronnen/klasse-basis.json en wordt hier niet
          // overgetypt.
          keuze: { soort: 'skill', aantal: 1, uit: 'class', geeft: 'proficiency' },
        }],
      },
      subclasses: {
        'Path of the Giant': {
          levels: {
            3: [{
              name: "Giant's Power",
              keuze: [
                { soort: 'language', aantal: 1, label: 'Taal' },
                { soort: 'spell', aantal: 1, uit: ['Druidcraft', 'Thaumaturgy'], label: 'Cantrip' },
              ],
            }],
          },
        },
      },
    },
  },
  species: {
    'Half-Elf': {
      levels: {
        1: [{
          name: 'Variant Feature',
          keuze: {
            soort: 'variant', aantal: 1,
            varianten: [
              { naam: 'Skill Versatility', keuze: [{ soort: 'skill', aantal: 2, geeft: 'proficiency' }] },
              { naam: 'Fleet of Foot' },
            ],
          },
        }],
      },
    },
  },
};

const basis = (extra = {}) => ({ klasse: 'Barbarian', species: 'Half-Elf', level: 3, keuzes: {}, ...extra });

describe('Keuzes op een feature', () => {
  it('maakt van twee blokken twee slots, en de eerste houdt zijn oude sleutel', () => {
    const slots = pc.keuzeSlots(basis({ subclass: 'Path of the Giant' }), PROG);
    const giant = slots.filter(s => s.naam === "Giant's Power");
    assert.equal(giant.length, 2, 'een taal én een cantrip');
    assert.equal(giant[0].sleutel, "Barbarian|3|Giant's Power",
      'het eerste blok houdt de sleutel van vóór deze wijziging, dus wat al gekozen was blijft staan');
    assert.equal(giant[1].sleutel, "Barbarian|3|Giant's Power|2");
    assert.deepEqual(giant.map(s => s.keuze.label), ['Taal', 'Cantrip']);
  });

  it('geeft een taalkeuze de lijst met talen in plaats van een leeg veld', () => {
    const slots = pc.keuzeSlots(basis({ subclass: 'Path of the Giant' }), PROG);
    const taal = slots.find(s => s.keuze.soort === 'language');
    const opties = pc.keuzeOpties(taal, basis(), PROG, { alleSkills: [] });
    assert.ok(opties.includes('Giant'), 'Giant staat erin');
    assert.ok(opties.includes('Draconic') && opties.includes('Undercommon'));
    assert.ok(opties.length > 15, `een echte lijst, niet een handvol (${opties.length})`);
  });

  it('pakt bij `uit: class` de skill-lijst van die class uit de bron', () => {
    const slot = pc.keuzeSlots(basis(), PROG).find(s => s.naam === 'Primal Knowledge');
    const opties = pc.keuzeOpties(slot, basis(), PROG, { alleSkills: ['Arcana'] });
    assert.deepEqual(opties, ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival']);
    assert.ok(!opties.includes('Arcana'), 'niet zomaar alle skills — dat geeft er te veel');
  });

  it('opent de vervolgkeuze van een vorm pas als die vorm gekozen is', () => {
    const c = basis();
    let slots = pc.keuzeSlots(c, PROG);
    const vorm = slots.find(s => s.keuze.soort === 'variant');
    assert.ok(vorm, 'de vorm zelf is een keuze');
    assert.equal(slots.filter(s => s.onder === vorm.sleutel).length, 0,
      'zolang er niets gekozen is, bestaat er geen vervolgkeuze');

    c.keuzes[vorm.sleutel] = ['Skill Versatility'];
    slots = pc.keuzeSlots(c, PROG);
    const sub = slots.find(s => s.onder === vorm.sleutel);
    assert.ok(sub, 'nu wel');
    assert.equal(sub.keuze.aantal, 2);
    assert.equal(sub.variant, 'Skill Versatility');

    c.keuzes[vorm.sleutel] = ['Fleet of Foot'];
    assert.equal(pc.keuzeSlots(c, PROG).filter(s => s.onder === vorm.sleutel).length, 0,
      'de andere vorm geeft niets te kiezen — en deelt dus ook geen skills uit');
  });

  it('zet alleen de skills van de gekozen vorm op het blad', () => {
    const c = basis();
    const vorm = pc.keuzeSlots(c, PROG).find(s => s.keuze.soort === 'variant');
    c.keuzes[vorm.sleutel] = ['Skill Versatility'];
    const sub = pc.keuzeSlots(c, PROG).find(s => s.onder === vorm.sleutel);
    c.keuzes[sub.sleutel] = ['Arcana', 'Stealth'];

    const profs = JSON.parse(pc.profielVan(c, { prog: PROG }).skillProfs);
    assert.equal(profs.arcana, 'prof');
    assert.equal(profs.stealth, 'prof');

    // Dezelfde keuzes, maar met de andere vorm: dan horen ze er niet te staan.
    const d = basis({ keuzes: { [vorm.sleutel]: ['Fleet of Foot'], [sub.sleutel]: ['Arcana', 'Stealth'] } });
    const p2 = JSON.parse(pc.profielVan(d, { prog: PROG }).skillProfs);
    assert.ok(!p2.arcana, 'een vervolgkeuze van een vorm die je niet koos telt niet mee');
  });

  // Dit stond er wél, maar twee regels verderop overschreef een harde
  // `languages: 'Common'` het weer — dus elke gekozen taal verdween
  // stilzwijgend van het blad. Vandaar deze toets.
  it('vraagt alleen om een tweede laag waar die verplicht is', () => {
    // **Een leeg veld is niet altijd hetzelfde.** Een Dragonborn zonder
    // Draconic Ancestry is niet af; een Half-Elf hoeft niets te kiezen, want
    // zijn descents zijn 2014-materiaal dat je erbij kúnt nemen. De app zei bij
    // allebei "kiest nog een variant".
    //
    // Afleiden kan niet — nagemeten in Grisburgh: vier van de acht species met
    // varianten hebben een trait die net zo heet als hun label, maar Tiefling
    // (vijftien varianten, onmiskenbaar verplicht) heeft die niet. Dus een
    // eigen veld, waarbij **ontbreken verplicht betekent**: dat is wat de app
    // hiervoor deed, en het klopt bij vijf van de acht.
    const prog = {
      classes: {},
      species: {
        Dragonborn: { variantLabel: 'Draconic Ancestry', levels: {}, varianten: { Red: { levels: {} }, Blue: { levels: {} } } },
        'Half-Elf': { variantVerplicht: false, levels: {}, varianten: { Drow: { levels: {} }, Wood: { levels: {} } } },
        Mens:       { levels: {} },
      },
      backgrounds: {},
      feats: { general: [], epic: [] },
    };
    const zegt = (species, variant) => (pc.nakijken({ species, speciesVariant: variant, level: 1 }, { prog })
      .opmerkingen || []).join(' | ');

    assert.match(zegt('Dragonborn', ''), /Draconic Ancestry/,
      'zonder keuze is hij niet af, en de app noemt het bij de naam uit het boek');
    assert.ok(!/variant|Ancestry/i.test(zegt('Dragonborn', 'Red')), 'gekozen is gekozen');
    assert.ok(!/variant|Drow/i.test(zegt('Half-Elf', '')),
      'een optionele tweede laag leeg laten is een geldig antwoord, geen gat');
    assert.ok(!/variant/i.test(zegt('Mens', '')), 'en een species zonder tweede laag wordt niets gevraagd');
  });

  it('zet de gekozen taal op het blad, en niet alleen Common', () => {
    const c = basis({ subclass: 'Path of the Giant' });
    const taal = pc.keuzeSlots(c, PROG).find(s => s.keuze.soort === 'language');
    c.keuzes[taal.sleutel] = ['Giant'];
    const talen = String(pc.profielVan(c, { prog: PROG }).languages || '');
    assert.ok(talen.includes('Giant'), `Giant hoort op het blad te staan (stond: "${talen}")`);
    assert.ok(talen.includes('Common'), 'en Common blijft staan');
  });
});
