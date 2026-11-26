// **De SRD-kiezer bij een voorwerp-kaartje.**
//
// `_SRD_ITEM_VELD` in `render-campagne.js` is de enige plek waar de sleutels
// van `bronnen/srd-items.json` en die van ons eigen formulier elkaar raken.
// Drift daar is **stil**: de knop *Invullen* meldt vrolijk "ingevuld — SRD
// 5.2" en laat het veld leeg. Dat is op 26 nov 2026 echt gebeurd — de code
// zocht `[name="<sleutel>"]` terwijl een kaartjesveld `data_<sleutel>` heet,
// en dan vult hij alléén de naam in. Vandaar deze drie: de namen moeten aan
// beide kanten bestaan, en de kiezer moet naar de goede kant zoeken.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs   = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const RC     = path.join(WORTEL, 'public', 'js', 'render-campagne.js');

const bron = (f) => {
  const d = JSON.parse(fs.readFileSync(path.join(WORTEL, 'bronnen', f), 'utf8'));
  return Array.isArray(d) ? d : (d.items || Object.values(d)[0]);
};

describe('Standaard-uitrusting uit de SRD', () => {
  const src    = fs.readFileSync(RC, 'utf8');
  const gewoon = bron('srd-items.json');
  const magie  = bron('srd-magic-items.json');
  const alle   = [...gewoon, ...magie];

  const velden = [...(/const _SRD_ITEM_VELD = \[([\s\S]*?)\];/.exec(src)?.[1] || '')
    .matchAll(/'([^']+)'/g)].map(m => m[1]);

  it('kent alleen sleutels die de bron ook echt draagt', () => {
    assert.ok(velden.length >= 10, `maar ${velden.length} velden — leest de toets de lijst nog wel?`);
    const inBron = new Set();
    for (const i of alle) for (const k of Object.keys(i)) inBron.add(k);
    const spoken = velden.filter(v => !inBron.has(v));
    assert.deepStrictEqual(spoken, [],
      'deze velden staan in de koppeling maar in geen enkel bronvoorwerp: ' + spoken.join(', '));
  });

  it('laat niets van de bron onopgehaald liggen', () => {
    // De omgekeerde kant, want die rot net zo stil: komt er een veld bij in de
    // bron, dan vult de kiezer het niet in en merkt niemand het.
    // `name` gaat apart (dat is de aanleiding), en deze vijf hebben hun eigen
    // weg: `key` is de sleutel van de bron zelf, `magisch` stuurt het label in
    // de keuzelijst, `metgezel` wordt verderop apart ingevuld (zie daar),
    // `werking` wordt afgeleid uit wat er ingevuld wordt, en `gewicht` heeft
    // geen veld op het kaartje.
    const apart = new Set(['key', 'name', 'magisch', 'metgezel', 'werking', 'gewicht']);
    const inBron = new Set();
    for (const i of alle) for (const k of Object.keys(i)) if (!apart.has(k)) inBron.add(k);
    const gemist = [...inBron].filter(k => !velden.includes(k));
    assert.deepStrictEqual(gemist, [],
      'de bron draagt dit, de kiezer haalt het niet op: ' + gemist.join(', '));
  });

  it('zoekt het veld onder zijn echte naam, en overschrijft niets', () => {
    const van = src.indexOf('window._srdItemVullen');
    assert.ok(van > 0, '_srdItemVullen staat niet meer waar hij stond');
    const blok = src.slice(van, van + 2600);
    // De fout van 26 nov 2026 in één regel: een kaartjesveld heet `data_<k>`.
    assert.match(blok, /\[name="data_\$\{k\}"\]/,
      'een veld op een kaartje heet data_<sleutel>; zonder dat vult hij alleen de naam');
    // En de belofte uit de testronde: wat je zelf al invulde blijft staan.
    assert.match(blok, /if \(String\(el\.value \|\| ''\)\.trim\(\)\) continue;/,
      'de kiezer hoort alleen lege velden te vullen');
    assert.match(blok, /if \(naamEl && !naamEl\.value\.trim\(\)\) naamEl\.value = p\.name;/,
      'ook de naam alleen als die nog leeg is');
  });

  it('levert de drie voorbeelden uit de testronde zoals beloofd', () => {
    // Deze drie staan bij naam in `docs/testronde.md`; als de bron verandert
    // hoort die tekst mee te veranderen, niet stilzwijgend te gaan liegen.
    const zoek = (n) => alle.find(i => i.name === n);
    const bijl = zoek('Battleaxe');
    assert.ok(bijl, 'Battleaxe hoort in de bron te staan');
    assert.strictEqual(bijl.itemType, 'Weapon');
    assert.strictEqual(bijl.damage, '1d8 slashing');
    assert.ok(bijl.prijs && bijl.gewicht && bijl.weaponProperties, 'prijs, gewicht en eigenschappen');

    const plaat = zoek('Plate Armor');
    assert.strictEqual(plaat.armorBaseAC, 18);
    assert.strictEqual(plaat.stealthDisadvantage, true);
    assert.strictEqual(plaat.strengthRequirement, 15);

    // Open5e zet een schild weg als zwaar harnas met AC 2; het script zet dat
    // recht. Precies dát is hier de bewering.
    const schild = zoek('Shield');
    assert.strictEqual(schild.itemType, 'Shield', 'geen Armor — zie scripts/srd-2024/');
    assert.strictEqual(schild.armorType, 'shield');
    assert.strictEqual(schild.armorBaseAC, 2);

    assert.strictEqual(zoek('Bag of Holding').rariteit, 'Uncommon');
    assert.strictEqual(zoek('Cloak of Elvenkind').attunement, true);
    assert.strictEqual(zoek('Flame Tongue Longsword').damage, '1d8 slashing');
  });

  it('is een bron om uit te putten, geen inventaris', () => {
    // 757 magische voorwerpen horen niet als kaartje in het archief te staan;
    // ze komen pas binnen als de DM er een ophaalt. De kiezer leest ze dus uit
    // `bronnen/`, en nergens zet iets ze in `entities.voorwerpen`.
    assert.ok(magie.length > 700, `${magie.length} magische voorwerpen in de bron`);
    assert.match(src, /haal\('srd-magic-items'\)/, 'de kiezer leest de bron');
    const routes = fs.readFileSync(path.join(WORTEL, 'routes', 'api.js'), 'utf8')
      .split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
    assert.ok(!/srd-magic-items[\s\S]{0,400}?entities\.voorwerpen\.push/.test(routes),
      'niets hoort de bron als kaartjes in het archief te zetten');
  });
});
