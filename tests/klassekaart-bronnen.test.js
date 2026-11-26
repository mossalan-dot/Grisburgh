// **De harde getallen op een klassekaartje komen uit drie bronbestanden.**
//
// `bronnen/klasse-basis.json` (hit die, castend ability, featlevels, saves,
// training), `bronnen/srd-spreukentellers.json` (cantrips en voorbereide
// spreuken per level) en `bronnen/feat-koppelingen.json` (wat een feat vraagt
// en geeft). Ze worden door de **server én de client** gelezen, en dat is
// precies het punt: hit die, castend ability en de featlevels stonden eerder
// op drie plekken en liepen uit elkaar.
//
// Deze toets bewaakt wat de testronde aan de DM belooft — de getallen zelf, en
// de afleiding die de app ermee doet. Een eis die stilletjes verschuift zet een
// feat bij een klasse die hem niet kan nemen, en dat merk je pas aan tafel.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const WORTEL  = path.join(__dirname, '..');
const lees    = (f) => JSON.parse(fs.readFileSync(path.join(WORTEL, 'bronnen', f), 'utf8'));

describe('De bronnen achter een klassekaartje', () => {
  const basis   = lees('klasse-basis.json').klassen;
  const tellers = lees('srd-spreukentellers.json');
  const koppel  = lees('feat-koppelingen.json');
  const spreuken = (() => {
    const d = lees('spells-2024.json');
    return d.results || d.spells || (Array.isArray(d) ? d : []);
  })();

  it('geeft elke klasse zijn hit die, saves en featlevels', () => {
    assert.ok(Object.keys(basis).length >= 12, `${Object.keys(basis).length} klassen`);
    const mist = [];
    for (const [naam, k] of Object.entries(basis)) {
      if (!(k.hitDie >= 6 && k.hitDie <= 12)) mist.push(`${naam}: hitDie ${k.hitDie}`);
      if (!Array.isArray(k.saves) || k.saves.length !== 2) mist.push(`${naam}: saves`);
      if (!Array.isArray(k.featLevels) || !k.featLevels.includes(4)) mist.push(`${naam}: featLevels`);
    }
    assert.deepStrictEqual(mist, [], mist.join(' · '));
    // De Fighter krijgt er twee extra (6 en 14) en de Rogue één (10) — dat is
    // de regel die de testronde noemt, en de enige uitzondering erop.
    assert.deepStrictEqual(basis.Fighter.featLevels, [4, 6, 8, 12, 14, 16, 19]);
    assert.ok(basis.Rogue.featLevels.includes(10), 'de Rogue krijgt er een op 10');
    assert.deepStrictEqual(basis.Wizard.featLevels, [4, 8, 12, 16, 19]);
  });

  it('laat een martial geen castend ability dragen, en een caster wel', () => {
    assert.strictEqual(basis.Fighter.castAbility, null);
    assert.strictEqual(basis.Barbarian.castAbility, null);
    assert.strictEqual(basis.Wizard.castAbility, 'int');
    assert.strictEqual(basis.Paladin.castAbility, 'cha');
  });

  it('telt de spreuken per klasse zoals het kaartje ze toont', () => {
    // Deze twee staan met hun getallen in docs/testronde.md. Verschuiven ze,
    // dan hoort die tekst mee te verschuiven in plaats van stil te gaan liegen.
    const opLijst = (k) => spreuken.filter(s => (s.classes || [])
      .some(c => (c?.name || c) === k)).length;
    assert.strictEqual(opLijst('Wizard'), 355);
    assert.strictEqual(opLijst('Paladin'), 56);

    assert.deepStrictEqual(
      [tellers.Wizard['1'].cantrips, tellers.Wizard['20'].cantrips], [3, 5]);
    assert.deepStrictEqual(
      [tellers.Wizard['1'].voorbereid, tellers.Wizard['20'].voorbereid], [4, 22]);
    // Een Paladin krijgt geen cantrips — dat is waarom die regel op het kaartje
    // wegvalt in plaats van "0" te tonen.
    assert.deepStrictEqual(
      [tellers.Paladin['1'].voorbereid, tellers.Paladin['20'].voorbereid], [2, 15]);
    for (let lv = 1; lv <= 20; lv++) {
      assert.strictEqual(tellers.Paladin[String(lv)].cantrips, 0, `Paladin level ${lv}`);
    }
  });

  it('laat de tellers alleen omhoog lopen, van 1 tot 20', () => {
    // Een teller die ergens terugloopt is altijd een fout in de bron, en hij
    // valt in de app niet op: je ziet één level tegelijk.
    const scheef = [];
    for (const [klasse, rij] of Object.entries(tellers)) {
      for (let lv = 2; lv <= 20; lv++) {
        const a = rij[String(lv - 1)], b = rij[String(lv)];
        if (!a || !b) { scheef.push(`${klasse}: level ${lv} ontbreekt`); continue; }
        if (b.cantrips < a.cantrips) scheef.push(`${klasse}: cantrips lopen terug op ${lv}`);
        if (b.voorbereid < a.voorbereid) scheef.push(`${klasse}: voorbereid loopt terug op ${lv}`);
      }
    }
    assert.deepStrictEqual(scheef, [], scheef.join(' · '));
  });

  it('rekent uit bij welke klassen een armor-feat hoort', () => {
    // De proef uit de testronde: *Heavily Armored* vraagt Medium armor
    // training, en wie die geeft staat in klasse-basis.json. Niemand wijst hier
    // een klasse aan — dat is de hele winst van deze afleiding.
    assert.strictEqual(koppel.feats['Heavily Armored'].vereist, 'Medium armor training');
    const geeft = Object.entries(basis)
      .filter(([, k]) => /medium/i.test(k.armor || '')).map(([n]) => n).sort();
    for (const k of ['Barbarian', 'Cleric', 'Fighter', 'Paladin', 'Ranger']) {
      assert.ok(geeft.includes(k), `${k} hoort Medium armor training te geven`);
    }
    for (const k of ['Wizard', 'Sorcerer', 'Monk']) {
      assert.ok(!geeft.includes(k), `${k} hoort hem níét te geven`);
    }
  });

  it('wijst met een spreuk naar de klassen die hem op hun lijst hebben', () => {
    // De derde koppeling. Telekinetic geeft Mage Hand; wie die spreuk heeft,
    // krijgt de feat — zonder dat iemand een klasse aanwijst.
    assert.deepStrictEqual(koppel.feats['Telekinetic'].geeftSpreuk, ['Mage Hand']);
    const mageHand = spreuken.find(s => s.name === 'Mage Hand');
    assert.ok(mageHand, 'Mage Hand hoort in de spreukenbron te staan');
    const erbij = (mageHand.classes || []).map(c => c?.name || c).sort();
    assert.deepStrictEqual(erbij, ['Bard', 'Sorcerer', 'Warlock', 'Wizard']);
  });

  it('noemt bij naam wat er niet in staat', () => {
    // Een lijst die zwijgt over wat hij niet weet, lees je als compleet. Deze
    // bron zegt het dus hardop — en die drie namen horen er dan ook echt niet
    // in te staan, anders is de aantekening zelf de leugen geworden.
    assert.match(koppel._nb, /Mounted Combatant/);
    for (const n of ['Mounted Combatant', 'Skulker', 'Weapon Master']) {
      assert.ok(!koppel.feats[n], `${n} staat er wél in; dan klopt de aantekening niet meer`);
    }
  });

  it('draagt nergens een beschrijving — alleen feiten', () => {
    // Zelfde grens als bij subclasses-elders.json: een naam en een getal mogen,
    // een zin uit het boek niet.
    const lang = [];
    for (const [naam, f] of Object.entries(koppel.feats)) {
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'string' && v.length > 60) lang.push(`${naam}.${k}`);
      }
    }
    assert.deepStrictEqual(lang, [], 'dit leest als tekst in plaats van als gegeven: ' + lang.join(', '));
  });
});
