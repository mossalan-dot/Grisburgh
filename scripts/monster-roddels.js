#!/usr/bin/env node
// Een roddel per wezen in het bestiarium.
//
// De Magizoöloog onthult bij *deels* een gerucht over het wezen (`roddel` op
// het monster). In Grisburgh had **geen enkel** van de 57 monsters er een, dus
// was het verschil tussen *naam* en *deels* alleen het statblok — en vier
// codepaden (het onthullen, de kaart in het bestiarium, de ongehoord-variant
// voor de DM en het statblok) hadden in deze campagne nog nooit gedraaid.
//
// Wat hieronder staat is **uit het statblok afgeleid**, niet verzonnen: elke
// regel wijst naar een trait of een action, maar dan zoals een veldbioloog het
// aan een tafel vertelt. Geen regeltermen, geen getallen — iets waar de spelers
// iets mee kunnen doen. De DM kan elke regel gewoon overschrijven in de
// Monsterbibliotheek; dit is een eerste vulling, geen canon.
//
//   node scripts/monster-roddels.js <campagne>            # alleen tonen
//   node scripts/monster-roddels.js <campagne> --schrijf  # doen
//
// Raakt alleen monsters met een **lege** roddel aan; wat de DM zelf schreef
// blijft staan. Bij --schrijf komt er een kopie naast.

const fs   = require('fs');
const path = require('path');

// Op naam, want dezelfde soort staat soms twee keer in de bibliotheek
// (2× Wolf, 2× Goblin) en dat zijn twee facties, geen fout.
const RODDELS = {
  'Wolf':            'Eén wolf valt je zelden aan. Het is de tweede, die je van achteren pakt terwijl je naar de eerste kijkt — en zodra je ligt, ben je van hen.',
  'Dire Wolf':       'Groot genoeg om op te rijden, en dat hebben mensen geprobeerd. Ze jagen als hun kleine broers: met zijn tweeën, en ze werken je tegen de grond.',
  'Goblin':          'Sla er niet naar als hij wegduikt — dat is precies waar hij op rekent. Hij is weg voor je arm terug is, en staat drie tellen later achter je.',
  'Hobgoblin':       'Ze vechten in paren en dat is geen toeval: de ene houdt je bezig, de andere slaat de klap die telt. Laat ze je nooit insluiten.',
  'Bandit':          'Niets bijzonders aan, en dat is het gevaar: het zijn er altijd meer dan je er ziet.',
  'Bandit Captain':  'Hij slaat drie keer in de tijd dat jij één keer uithaalt, en hij kiest wie. Valt hij, dan valt de rest uiteen.',
  'Merrow':          'Zoetwater of zout, boven of onder — het maakt hem niet uit; hij ademt overal. In het water heb jij de haast, hij niet.',
  'Wight':           'Breng hem in de zon en hij knijpt zijn ogen dicht en mist. In het donker mist hij nooit. En wat hij uit je trekt, groeit niet vanzelf terug.',
  'Ghoul':           'Zijn nagels doen minder pijn dan wat erna komt: je verstijft, en dan heeft hij alle tijd. Elfen schijnen er niets van te merken.',
  'Banshee':         'Ze weet dat je er bent voordat je haar ziet — kilometers ver, zolang je nog leeft. Van haar gezicht wend je je af; van haar stem is niet iedereen teruggekomen.',
  'Harpy':           'Het gevaar zijn niet haar klauwen. Het is dat je uit jezelf naar haar toe loopt en niet meer weet waarom.',
  'Stirge':          'Zo groot als een vuist en dat is het probleem niet. Als hij zich eenmaal vastgezet heeft, drinkt hij door tot iemand hem eraf trekt.',
  'Giant Spider':    'Kijk omhoog. Ze lopen over plafonds alsof het vloeren zijn, en hun web houdt jou wel tegen maar haar niet.',
  'Boar':            'Hij neemt een aanloop en dan lig je. En als je denkt dat hij dood is, staat hij nog één keer op — dat is waar de meeste jagers op stuk lopen.',
  'Centaur':         'Op een open vlakte maakt hij zich klaar en dan is het te laat; die eerste stoot na een aanloop draagt de hele galop in zich. Zorg dat hij geen ruimte heeft.',
  'Minotaur':        'In een gang is hij op zijn gevaarlijkst: hij neemt een aanloop en zet je met zijn horens tegen de muur. Hij vecht roekeloos — wie durft, raakt hem makkelijk.',
  'Gargoyle':        'Tel de beelden op het dak. Tel ze morgen nog eens. Zolang hij niet beweegt is hij steen, en dat is hij ook als je hem aanraakt.',
  'Gray Ooze':       'Sla er niet met je goede zwaard op. Wat hij raakt vreet weg — harnas, kling, alles wat niet betoverd is — en op de steen lijkt hij gewoon een natte plek.',
  'Grey Ooze':       'Sla er niet met je goede zwaard op. Wat hij raakt vreet weg — harnas, kling, alles wat niet betoverd is — en op de steen lijkt hij gewoon een natte plek.',
  'Gelatinous Cube': 'Je ziet hem niet; je loopt erin. In een gang die net te schoon geveegd is, gooi je eerst iets vooruit.',
  'Mimic':           'Wat je aanraakt, laat je niet meer los — dat is het hele idee. In een kelder vol rommel is de kist die er het best uitziet de verkeerde.',
  'Flying Sword':    'Een zwaard dat te mooi alleen ligt. Het beweegt uit zichzelf, maar in gedoofde magie valt het als een tak op de grond.',
  'Animated Armor':  'Een leeg harnas aan de muur dat je nooit ziet vallen. Haal de magie eruit en het is weer wat het lijkt: ijzer.',
  'Vine Blight':     'De klimop die je passeert is de klimop die je grijpt. En hij roept de planten om je heen mee.',
  'Twig Blight':     'Een dood struikje in een dood bosje. Ze zijn nauwelijks iets waard, tot je merkt dat er dertig van staan.',
  'Swarm of Rats':   'Ze ruiken je eerder dan je hen. Ze gaan dwars door je heen, en hoe minder er zijn, hoe minder ze bijten.',
  'Pseudodragon':    'Hij hoort en ruikt alles, en magie glijdt van hem af. Zijn steek doodt niet — je wordt er alleen slaperig van, uren lang.',
  'Druid':           'Hij spreekt met wat er groeit en met wat er loopt, dus je nadert nooit ongezien. Zijn staf is het probleem niet.',
  'Mage Apprentice': 'Nog aan het leren, maar de spreuken die hij kent zijn de gemene: hij ziet je vuur aankomen en zet er iets tegenover.',
  'Mechanical Bird': 'Eet niet, slaapt niet, kijkt alleen. Wie hem gebouwd heeft, kijkt mee.',
  'Prototype':       'Als hij begint te sputteren is het niet voorbij maar juist gevaarlijk: dat noodprotocol is niet bedoeld om hem te redden.',
  'Schildwachtbol':  'Raak hem niet aan als je stil wilt blijven — één klap en het hele gebouw weet waar je staat. Zijn schok slaat je soms even uit de tijd.',
  'Chronomental':    'Haast hem of vertraag hem en je maakt hem juist heler. En hij kan een minuut van je afnemen die je nergens terugvindt.',
  'Kaart-construct': 'Papier dat snijdt als glas. Erger is wat het met je richtingsgevoel doet: naast dat ding weet niemand nog waar voren is.',
  'Ambtenaar':       'Hij stempelt je alsof je een formulier bent, en waar hij stempelt trekt het weg. Sta niet in een kring om hem heen als het papier begint op te waaien.',
};

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) {
  console.error('Gebruik: node scripts/monster-roddels.js <campagne> [--schrijf]');
  process.exit(1);
}

const dir = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const pad = path.join(dir, 'campaigns', campagne, 'monsters.json');
if (!fs.existsSync(pad)) { console.error('Niet gevonden: ' + pad); process.exit(1); }

const data = JSON.parse(fs.readFileSync(pad, 'utf8'));
const monsters = data.monsters || [];

let gevuld = 0, alGevuld = 0;
const zonder = [];
for (const m of monsters) {
  if (m.inBestiarium === false) continue;
  if ((m.roddel || '').trim()) { alGevuld++; continue; }
  const r = RODDELS[(m.name || '').trim()];
  if (!r) { zonder.push(m.name); continue; }
  m.roddel = r;
  gevuld++;
  console.log(`  ${m.name}: ${r.slice(0, 70)}…`);
}

console.log(`\nin het bestiarium: ${monsters.filter(m => m.inBestiarium !== false).length} · gevuld: ${gevuld} · had er al een: ${alGevuld}`);
if (zonder.length) console.log(`geen regel voor (blijven leeg): ${zonder.join(', ')}`);

if (!schrijf) { console.log('\n(proefdraai — voeg --schrijf toe om het echt te doen)'); process.exit(0); }
if (!gevuld)  { console.log('\nNiets te doen.'); process.exit(0); }

const datum = new Date().toISOString().slice(0, 10);
const kopie = pad.replace(/\.json$/, `.voor-roddels.${datum}.json`);
fs.copyFileSync(pad, kopie);
fs.writeFileSync(pad, JSON.stringify(data, null, 2));
console.log(`\nGeschreven. Kopie: ${path.basename(kopie)}`);
