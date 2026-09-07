// Maakt een setje voorwerpen aan dat elke categorie en elke werking raakt,
// alleen zichtbaar voor de Testgroep. Alle namen beginnen met "Proef" zodat je
// ze in één zoekopdracht terugvindt (en desnoods in één keer weggooit).
const BASE = process.env.BASE || 'http://localhost:3100/api';
const WW   = process.env.DMPW || 'review-dm';
const GID  = 'groep_1777039899017_94g1';   // Testgroep
let c = null;
async function r(m, p, b) {
  const h = { 'Content-Type': 'application/json' }; if (c) h.Cookie = c;
  const res = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const sc = res.headers.get('set-cookie'); if (sc) c = sc.split(';')[0];
  let d; const t = await res.text(); try { d = JSON.parse(t); } catch { d = t; }
  return { s: res.status, d };
}

const ITEMS = [
  { name: 'Proefzwaard van de Stille Slag', data: { itemType: 'Weapon', rariteit: 'Rare', prijs: '250 fl',
    werking: '["attack"]', damage: '1d8+1 Slashing', weaponProperties: '["Finesse","Light","Thrown (20/60)"]',
    gebruik: 'uniek', attunement: 'true', attunementEis: 'Rogue',
    desc: 'Een proefstuk. **Attack** met wapeneigenschappen en attunement met een voorwaarde.' } },
  { name: 'Proefpijlen', data: { itemType: 'Ammunition', rariteit: 'Common', prijs: '1 fl', gebruik: 'stapelbaar',
    werking: '["attack"]', damage: '1d6 Piercing', weaponProperties: '["Ammunition (80/320)","Range (80/320)"]',
    desc: 'Stapelbaar. Test de teller in de boedel en op het tabblad Bezit.' } },
  { name: 'Proefharnas van Grauwstaal', data: { itemType: 'Armor', rariteit: 'Uncommon', prijs: '400 fl',
    werking: '["defense"]', armorType: 'medium', armorBaseAC: '14', stealthDisadvantage: 'true', strengthRequirement: '13',
    gebruik: 'uniek', desc: 'De app rekent de AC uit: 14 + Dex (max +2).' } },
  { name: 'Proefbeukelaar', data: { itemType: 'Shield', rariteit: 'Common', prijs: '60 fl',
    werking: '["defense"]', armorType: 'shield', armorBaseAC: '2', gebruik: 'uniek',
    desc: 'Telt +2 op bij de AC van de drager.' } },
  { name: 'Proefdrank van Heling', data: { itemType: 'Potion', rariteit: 'Common', prijs: '50 fl',
    werking: '["healing"]', healing: '2d4+2', gebruik: 'stapelbaar',
    desc: 'Je herstelt **2d4 + 2** Hit Points. Drinken kost een Bonus Action.' } },
  { name: 'Proefbalsem van de Beproeving', data: { itemType: 'Wondrous item', rariteit: 'Rare', prijs: '900 fl',
    werking: '["healing"]', healing: '1d8+3', gebruik: 'uniek', attunement: 'true',
    maxCharges: '3', rechargeOn: 'longRest',
    desc: 'Een Wondrous Item dat geneest — kon vóór de werking-splitsing helemaal niet.' } },
  { name: 'Proefring van Warmte', data: { itemType: 'Ring', rariteit: 'Uncommon', prijs: '180 fl',
    werking: '["defense"]', armorType: 'other', armorBaseAC: '11', armorDexCap: '2',
    gebruik: 'uniek', attunement: 'true',
    desc: 'Een Ring die AC geeft. Ook zoiets dat eerder nergens in te vullen was.' } },
  { name: 'Proefamulet van Zicht', data: { itemType: 'Amulet', rariteit: 'Uncommon', prijs: '300 fl',
    werking: '["spell"]', spellIndexes: '["detect-magic"]', gebruik: 'uniek',
    maxCharges: '2', rechargeOn: 'shortRest',
    desc: 'Spreuk gekoppeld, charges op **korte** rust.' } },
  { name: 'Proefstaf van Vuur', data: { itemType: 'Staff', rariteit: 'Very Rare', prijs: '4000 fl',
    werking: '["attack","spell"]', damage: '1d6 Bludgeoning', weaponProperties: '["Versatile (1d8)"]',
    spellIndexes: '["burning-hands","fireball"]', gebruik: 'uniek', attunement: 'true', attunementEis: 'Wizard',
    maxCharges: '10', rechargeOn: 'longRestRoll', rechargeRoll: '1d6', playerMaxAdjustable: 'true',
    desc: 'Twee werkingen tegelijk: slaat **en** cast. Charges lopen deels vol met een worp.' } },
  { name: 'Proefstok van Raketten', data: { itemType: 'Wand', rariteit: 'Uncommon', prijs: '800 fl',
    werking: '["spell"]', spellIndexes: '["magic-missile"]', gebruik: 'uniek',
    maxCharges: '7', rechargeOn: 'longRestRoll', rechargeRoll: '1d6',
    desc: 'Zoals de Wand of Magic Missiles: geen attunement, zeven charges.' } },
  { name: 'Proefrol van Genezing', data: { itemType: 'Scroll', rariteit: 'Common', prijs: '75 fl',
    werking: '["spell"]', spellIndexes: '["cure-wounds"]', gebruik: 'stapelbaar',
    desc: 'Klik de chip: het spreukvenster opent met de volledige tekst.' } },
  { name: 'Proefroede van Bevel', data: { itemType: 'Rod', rariteit: 'Rare', prijs: '1200 fl',
    werking: '["spell"]', spellIndexes: '["command"]', gebruik: 'uniek', attunement: 'true',
    maxCharges: '3', rechargeOn: 'dawn',
    desc: 'Staat nog op de oude stand "dageraad" — die hoort als lange rust te lezen.' } },
  { name: 'Proefgereedschap', data: { itemType: 'Tools', rariteit: 'Common', prijs: '25 fl', gebruik: 'uniek',
    desc: 'Geen werking aangevinkt: er verschijnen geen mechanische velden.' } },
  { name: 'Proeflier', data: { itemType: 'Musical instrument', rariteit: 'Common', prijs: '30 fl', gebruik: 'uniek',
    desc: 'Categorie zonder mechaniek.' } },
  { name: 'Proefvaatje Wijn', data: { itemType: 'Trade Good', rariteit: 'Common', prijs: '12,50', gebruik: 'stapelbaar',
    nietVerkoopbaar: 'true', desc: 'Prijs met een komma, en winkels kopen dit niet in.' } },
  { name: 'Proefsteen van Waarde', data: { itemType: 'Treasure', rariteit: 'Rare', prijs: '2 pp', gebruik: 'stapelbaar',
    desc: 'Prijs in platinum; die wordt omgerekend naar de eigen munt.' } },
];

(async () => {
  const login = await r('POST', '/auth/login', { campagne: 'grisburgh', password: WW });
  if (login.s !== 200) { console.error('login mislukt:', login.s, login.d); process.exit(1); }
  await r('PUT', '/groups/active', { groupId: GID });

  const bestaand = (await r('GET', '/entities/voorwerpen')).d;
  const opNaam = new Map(bestaand.map(v => [v.name, v.id]));
  const spelers = (await r('GET', '/entities/personages')).d
    .filter(e => e.subtype === 'speler' && e.data?.groep === GID);
  const test = spelers[0];

  let nieuw = 0, bijgewerkt = 0;
  const gemaakt = [];
  for (const it of ITEMS) {
    if (opNaam.has(it.name)) {
      await r('PUT', `/entities/voorwerpen/${opNaam.get(it.name)}`, { name: it.name, data: it.data });
      gemaakt.push(opNaam.get(it.name)); bijgewerkt++;
    } else {
      const res = await r('POST', '/entities/voorwerpen', { name: it.name, data: it.data });
      gemaakt.push(res.d.id); nieuw++;
    }
  }
  // Alleen zichtbaar voor de Testgroep
  for (const id of gemaakt) {
    const nu = (await r('GET', `/entities/voorwerpen/${id}`)).d._visibility;
    if (nu !== 'visible') await r('PUT', `/entities/voorwerpen/${id}/visibility`, { target: 'visible' });
  }
  // Een paar in de boedel van de testspeler, zodat Bezit en de knapzak gevuld zijn
  if (test) {
    const geef = (naam, qty) => {
      const id = gemaakt[ITEMS.findIndex(x => x.name === naam)];
      return r('PUT', `/items/${id}/owner`, { characterId: test.id, playerName: test.name, groupId: GID, qty });
    };
    await geef('Proefdrank van Heling', 3);
    await geef('Proefstaf van Vuur', 1);
    await geef('Proefzwaard van de Stille Slag', 1);
    await geef('Proefpijlen', 20);
  }
  console.log(`${nieuw} nieuw, ${bijgewerkt} bijgewerkt — alleen zichtbaar voor de Testgroep`);
  console.log(`vier ervan liggen in de boedel van ${test ? test.name : '(geen testspeler gevonden)'}`);
})();
