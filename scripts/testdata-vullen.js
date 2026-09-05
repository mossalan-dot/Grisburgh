#!/usr/bin/env node
/**
 * Vult een campagne met een testset: personages van elk soort, een paar
 * locaties met voorraad, voorwerpen in elke rariteit, twee speelbare PC's met
 * een ingevuld character sheet, en de volledige spreukteksten.
 *
 * Bedoeld voor een testomgeving, niet voor een echte campagne: de ids liggen
 * vast (prefix `t_`), dus opnieuw draaien werkt de set bij in plaats van hem te
 * verdubbelen. Bestaande kaartjes van de campagne blijven staan.
 *
 *   node scripts/testdata-vullen.js <campagne> [--schrijf]
 */
const fs = require('fs');
const path = require('path');

const campagne = process.argv[2];
const schrijf  = process.argv.includes('--schrijf');
if (!campagne) { console.error('Gebruik: node scripts/testdata-vullen.js <campagne> [--schrijf]'); process.exit(1); }

const dir = path.join(__dirname, '..', 'data', 'campaigns', campagne);
if (!fs.existsSync(dir)) { console.error('Campagne niet gevonden: ' + dir); process.exit(1); }

const lees  = (n, leeg) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch { return leeg; } };
const schrijfJson = (n, v) => fs.writeFileSync(path.join(dir, n), JSON.stringify(v, null, 2));

const entities = lees('entities.json', { personages: [], locaties: [], organisaties: [], voorwerpen: [] });
const dmState  = lees('dm-state.json', {});
const meta     = lees('meta.json', {});
const archief  = lees('archief.json', { documents: [], logEntries: [], sessieLog: [] });

// De groep waar de PC's in komen: de eerste die er is, anders maken we er een.
let groepId = Object.keys(dmState.groups || {})[0];
if (!groepId) {
  groepId = 'groep1';
  dmState.groups = { [groepId]: { name: 'Groep 1', visibility: {}, secretReveals: {}, deceased: {}, itemOwners: {}, itemRequests: [], tradeAllowed: true } };
}
const groep = dmState.groups[groepId];
if (!groep.password) groep.password = 'testgroep';

// ── Bouwstenen ───────────────────────────────────────────────────────────────
const LEEG_STATS = {
  ac: '', hp: '', initiative: '', speed: '', cr: '', xp: '', profBonus: '', size: '', creatureType: '',
  str: '', dex: '', con: '', int: '', wis: '', cha: '',
  savingThrows: '', skills: '', gear: '', vulnerabilities: '', resistances: '', immunities: '',
  conditionImmunities: '', senses: '', languages: '', traits: '',
  actions: '', bonusActions: '', reactions: '', legendaryActions: '', lairActions: '',
  spellSaveDC: '', spellAttackMod: '', spellIndexes: '', spells: '',
};
const kaartje = (id, name, subtype, data = {}, stats = {}) => ({
  id, name, subtype,
  data: { imgFocus: '50% 50%', tags: '[]', kant: 'neutraal', ...data },
  stats: { ...LEEG_STATS, ...stats },
  links: { personages: [], locaties: [], organisaties: [], voorwerpen: [] },
});
const rollen = (...r) => JSON.stringify(r);
const lijst  = (...r) => JSON.stringify(r);

// ── Voorwerpen ───────────────────────────────────────────────────────────────
const voorwerpen = [
  kaartje('t_vw_dolk', 'Dolk van de Stille Stap', '', {
    itemType: 'Weapon', rariteit: 'Rare', prijs: '450 fl', attunement: 'true', stapelbaar: '',
    damage: '1d4+1 piercing',
    weaponProperties: JSON.stringify(['Finesse', 'Light', 'Thrown (20/60)']),
    desc: 'Een dolk met een greep van gevlochten vlas. Wie hem trekt, maakt geen geluid — *ook niet als hij struikelt*.',
    flavours: lijst('„Die dolk heeft meer sloten gezien dan een slotenmaker."'),
  }),
  kaartje('t_vw_drank', 'Potion of Healing', '', {
    itemType: 'Potion', rariteit: 'Common', prijs: '20 fl', stapelbaar: 'true',
    desc: 'Je herstelt **2d4 + 2** Hit Points als je dit drankje drinkt. Drinken kost een Bonus Action.',
  }),
  kaartje('t_vw_mantel', 'Mantel van de Mistloper', '', {
    itemType: 'Wondrous item', rariteit: 'Very Rare', prijs: '2400 fl', attunement: 'true',
    desc: 'Eens per lange rust kun je *Misty Step* casten zonder een spell slot te gebruiken.',
  }),
  kaartje('t_vw_kroon', 'Kroon van Vlas', '', {
    itemType: 'Wondrous item', rariteit: 'Legendary', prijs: '—',
    desc: 'Zolang je de kroon draagt, spreekt iedereen die je aankijkt je aan met je titel. Ook wie dat liever niet zou doen.',
    geheimen: lijst('De kroon fluistert ’s nachts de namen van wie hem eerder droeg.'),
  }),
  kaartje('t_vw_touw', 'Touw (50 voet)', '', {
    itemType: 'Other', rariteit: 'Common', prijs: '1 fl', stapelbaar: 'true',
    desc: 'Vijftig voet hennep. Weegt 10 pond en lost meer problemen op dan menige spreuk.',
  }),
  kaartje('t_vw_ring', 'Ring van Warmte', '', {
    itemType: 'Ring', rariteit: 'Uncommon', prijs: '180 fl', attunement: 'true',
    desc: 'Je hebt Resistance tegen Cold damage en verdraagt temperaturen tot −50 graden.',
  }),
];

// ── Locaties ────────────────────────────────────────────────────────────────
const locaties = [
  kaartje('t_loc_gans', 'De Gouden Gans', '', {
    locType: 'Herberg', wijk: 'Marktkwartier', eigenaar: 'Bram Kruik',
    desc: 'Een herberg met lage balken en hoge rekeningen. De haard brandt altijd, ook in augustus.',
    flavours: lijst('„De soep is van gisteren, maar de bierprijs is van vorig jaar."', '„Boven slaapt iemand die niemand heeft zien binnenkomen."'),
    voorraad: JSON.stringify([
      { naam: 'Kroes bier', prijs: '4 cl' },
      { naam: 'Bord stoofvlees', prijs: '1 kn' },
      { naam: 'Potion of Healing', prijs: '25 fl', entityId: 't_vw_drank' },
    ]),
    winkelConfig: JSON.stringify({ sfeerTekst: 'Achter de tap staat een plank met kruiken, en daarnaast een deur die op slot zit.' }),
  }),
  kaartje('t_loc_kramerij', 'Kramerij Vlas & Vezel', '', {
    locType: 'Winkel', wijk: 'Marktkwartier', eigenaar: 'Doortje Pluis',
    desc: 'Alles voor onderweg, mits je genoeg tijd hebt om het te zoeken.',
    voorraad: JSON.stringify([
      { naam: 'Touw (50 voet)', prijs: '1 fl', entityId: 't_vw_touw' },
      { naam: 'Ring van Warmte', prijs: '180 fl', entityId: 't_vw_ring' },
      { naam: 'Dolk van de Stille Stap', prijs: '450 fl', entityId: 't_vw_dolk' },
      { naam: 'Bedroll', prijs: '1 fl' },
      { naam: 'Lantaarn', prijs: '5 fl' },
    ]),
    winkelConfig: JSON.stringify({
      roterend: true, aantalItems: 3, refreshUren: 24, deelGroep: '',
      sfeerTekst: 'De schappen liggen vol, maar wat er ligt wisselt per dag.',
    }),
  }),
  kaartje('t_loc_tempel', 'Tempel van het Stille Licht', '', {
    locType: 'Tempel', wijk: 'Hoogstad',
    desc: 'Een zaal zonder ramen, waar het licht van onderaf komt. Hier verkoopt men geen wonderen, maar wel drankjes.',
    voorraad: JSON.stringify([
      { naam: 'Potion of Healing', prijs: '20 fl', entityId: 't_vw_drank' },
      { naam: 'Wijwater', prijs: '25 fl' },
    ]),
  }),
  kaartje('t_loc_markt', 'Het Marktplein', '', {
    locType: 'Stadswijk',
    desc: 'Op marktdagen staat het vol, op andere dagen staat er alleen wind.',
    geheimen: lijst('Onder de put in de noordhoek loopt een gang naar de oude riolen.'),
  }),
];

// ── Organisaties ────────────────────────────────────────────────────────────
const organisaties = [
  kaartje('t_org_gilde', 'Het Vlasgilde', '', {
    orgType: 'Gilde', motto: 'Wat groeit, wordt geweven.',
    desc: 'Beheert de vlasvelden en de weefgetouwen, en daarmee ongeveer alles wat iemand aanheeft.',
  }),
  kaartje('t_org_schaduw', 'De Schaduwhand', '', {
    orgType: 'Crimineel', motto: 'Wij vragen niet.',
    desc: 'Bestaat volgens het stadsbestuur niet. Volgens de kooplieden bestaat er weinig anders.',
    geheimen: lijst('De Schaduwhand wordt betaald door iemand binnen het Vlasgilde.'),
  }),
];

// ── Personages ──────────────────────────────────────────────────────────────
const PC_WIZARD = 't_pc_wilmer';
const PC_ROGUE  = 't_pc_rozemarijn';

const personages = [
  kaartje(PC_WIZARD, 'Wilmer Vlasbaard', 'speler', {
    groep: groepId, rol: 'Evoker met een kort lontje', ras: 'Human', klasse: 'Wizard', alignment: 'Chaotic Good',
    desc: 'Studeerde te lang en te snel. Kan vuur maken, maar geen thee zetten.',
    flavours: lijst('„Hij heeft ooit een bibliotheek in brand gezet. Per ongeluk, zegt hij."'),
    persoonlijkheid: 'Speel hem ongeduldig: hij maakt zinnen van anderen af.',
  }, {
    ac: '13', hp: '32', initiative: '+2', speed: '30 ft', profBonus: '+3',
    str: '8', dex: '14', con: '14', int: '17', wis: '12', cha: '10',
    savingThrows: 'INT +6, WIS +4', skills: 'Arcana +6, History +6, Investigation +6',
    senses: 'Passive Perception 11', languages: 'Common, Draconic, Elvish',
    spellSaveDC: '14', spellAttackMod: '+6',
    spellIndexes: JSON.stringify(['fire-bolt', 'mage-hand', 'prestidigitation', 'magic-missile', 'shield', 'detect-magic', 'misty-step', 'fireball']),
  }),
  kaartje(PC_ROGUE, 'Rozemarijn Doorn', 'speler', {
    groep: groepId, rol: 'Thief die zichzelf gids noemt', ras: 'Halfling', klasse: 'Rogue', alignment: 'Neutral Good',
    desc: 'Kent elke steeg van de stad en de meeste sloten van binnenuit.',
    flavours: lijst('„Ze betaalt altijd contant. Nooit met haar eigen geld."'),
  }, {
    ac: '15', hp: '38', initiative: '+4', speed: '25 ft', profBonus: '+3',
    str: '10', dex: '18', con: '14', int: '12', wis: '13', cha: '14',
    savingThrows: 'DEX +7, INT +4', skills: 'Stealth +10, Sleight of Hand +7, Perception +4, Deception +5',
    senses: 'Passive Perception 14', languages: 'Common, Halfling, Thieves’ Cant',
  }),
  kaartje('t_npc_bram', 'Bram Kruik', 'NPC', {
    rol: 'Waard van De Gouden Gans', ras: 'Human', klasse: '', alignment: 'Lawful Neutral',
    tags: rollen('verkoper'), winkelLocatieId: 't_loc_gans',
    desc: 'Schenkt met één hand en telt met de andere.',
    flavours: lijst(
      '„De brug bij de Vlasmolen is al drie weken dicht. Niemand weet waarom."',
      '„Er logeert hier iemand die nooit overdag naar beneden komt."',
      '„Het gilde heeft de prijs van hennep verdubbeld. Vraag me niet waarom."'),
    geheimen: lijst('Hij verbergt een deserteur op zolder.'),
    persoonlijkheid: 'Praat graag, maar nooit over zijn gasten.',
  }),
  kaartje('t_npc_alwine', 'Zuster Alwine', 'NPC', {
    rol: 'Priesteres van het Stille Licht', ras: 'Elf', klasse: 'Cleric', alignment: 'Lawful Good',
    tags: rollen('verkoper'), winkelLocatieId: 't_loc_tempel',
    desc: 'Spreekt zacht en beslist. Verkoopt drankjes tegen kostprijs, en zegt daar niets over.',
  }),
  kaartje('t_npc_nachtvos', 'Nachtvos', 'NPC', {
    rol: 'Vriendelijke gids', ras: 'Half-Elf', klasse: 'Rogue', alignment: 'Neutral',
    desc: 'Biedt zich aan als gids voor de onderstad. Vraagt weinig en weet veel.',
    geheimen: lijst(
      'Hij houdt een deel van elke vondst achter.',
      'Hij werkt voor De Schaduwhand en levert de party uit zodra het uitkomt.'),
    geheimenAntagonist: JSON.stringify([false, true]),
    persoonlijkheid: 'Speel hem behulpzaam tot het tweede geheim onthuld wordt.',
  }, {
    ac: '15', hp: '44', initiative: '+3', speed: '30 ft', cr: '3', xp: '700', profBonus: '+2',
    size: 'Medium', creatureType: 'Humanoid',
    str: '11', dex: '16', con: '13', int: '13', wis: '12', cha: '15',
    skills: 'Stealth +7, Deception +6', gear: 'Leather Armor, two Daggers',
    senses: 'Darkvision 60 ft., Passive Perception 11', languages: 'Common, Elvish, Thieves’ Cant',
    traits: '***Sneak Attack (1/Turn).*** Doet 2d6 extra damage bij advantage of als een bondgenoot naast het doel staat.',
    actions: '***Dagger.*** Melee or Ranged Attack: +5, reach 5 ft. or range 20/60 ft. *Hit:* 5 (1d4+3) Piercing damage.',
  }),
  kaartje('t_npc_doortje', 'Doortje Pluis', 'NPC', {
    rol: 'Kramer op het marktplein', ras: 'Gnome', alignment: 'True Neutral',
    tags: rollen('verkoper'), winkelLocatieId: 't_loc_kramerij',
    desc: 'Weet van elk voorwerp in haar winkel waar het vandaan komt. Vertelt het zelden.',
  }),
  kaartje('t_dier_grommel', 'Grommel', 'dier', {
    rol: 'Wolfshond met een eigen mening', ras: 'Dier', alignment: 'Unaligned',
    adoptiePrijs: '75 fl',
    desc: 'Luistert naar iedereen die eten vasthoudt.',
  }, {
    ac: '13', hp: '11', speed: '40 ft', cr: '1/4', size: 'Medium', creatureType: 'Beast',
    str: '12', dex: '15', con: '12', int: '3', wis: '12', cha: '6',
    skills: 'Perception +3, Stealth +4', senses: 'Passive Perception 13',
    actions: '***Bite.*** Melee Attack: +4, reach 5 ft. *Hit:* 5 (1d6+2) Piercing damage.',
  }),
  kaartje('t_god_sarvana', 'Sarvana, Vrouwe van de Dageraad', 'god', {
    rol: 'Godin van licht en eerste stappen', alignment: 'Neutral Good',
    desc: 'Wordt aanbeden bij zonsopgang, en vergeten rond het middaguur.',
  }),
];

// ── Koppelingen (wikilinks in tekst blijven leidend, dit is de handmatige laag) ──
const linkPaar = (a, b, tA, tB) => {
  const eA = [...personages, ...locaties, ...organisaties, ...voorwerpen].find(x => x.id === a);
  const eB = [...personages, ...locaties, ...organisaties, ...voorwerpen].find(x => x.id === b);
  if (!eA || !eB) return;
  if (!eA.links[tB].includes(eB.name)) eA.links[tB].push(eB.name);
  if (!eB.links[tA].includes(eA.name)) eB.links[tA].push(eA.name);
};
linkPaar('t_npc_bram', 't_loc_gans', 'personages', 'locaties');
linkPaar('t_npc_doortje', 't_loc_kramerij', 'personages', 'locaties');
linkPaar('t_npc_alwine', 't_loc_tempel', 'personages', 'locaties');
linkPaar('t_npc_nachtvos', 't_org_schaduw', 'personages', 'organisaties');
linkPaar('t_pc_wilmer', 't_loc_gans', 'personages', 'locaties');

// ── Samenvoegen ─────────────────────────────────────────────────────────────
const zet = (soort, nieuwe) => {
  entities[soort] = entities[soort] || [];
  for (const k of nieuwe) {
    const i = entities[soort].findIndex(x => x.id === k.id);
    if (i >= 0) entities[soort][i] = k; else entities[soort].push(k);
  }
};
zet('personages', personages);
zet('locaties', locaties);
zet('organisaties', organisaties);
zet('voorwerpen', voorwerpen);

// ── Spelersdata ─────────────────────────────────────────────────────────────
dmState.playerProfiles = dmState.playerProfiles || {};
dmState.playerProfiles[PC_WIZARD] = {
  klasse: 'Wizard', subclass: 'Evoker', level: '5', origin: 'Human', background: 'Sage',
  ac: '13', speed: '30 ft', initiative: '+2', profBonus: '+3',
  str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10,
  saveProfs: 'int,wis', spellSaveDC: '14', spellAttackBonus: '6',
  skillProfs: JSON.stringify({ arcana: 'prof', history: 'prof', investigation: 'prof', insight: 'prof' }),
  skillAdj: '{}', bookmarks: [],
  languages: 'Common, Draconic, Elvish', senses: '',
  weapons: JSON.stringify([
    { name: 'Quarterstaff', atk: '+1', dmg: '1d6 Bludgeoning', props: ['Versatile (1d8)'] },
    { name: 'Fire Bolt', atk: '+6', dmg: '2d10 Fire' },
  ]),
  featChoices: JSON.stringify({ 'Wizard|4|Ability Score Improvement': 'INT +2' }),
};
dmState.playerProfiles[PC_ROGUE] = {
  klasse: 'Rogue', subclass: 'Thief', level: '5', origin: 'Halfling', background: 'Criminal',
  ac: '15', speed: '25 ft', initiative: '+4', profBonus: '+3',
  str: 10, dex: 18, con: 14, int: 12, wis: 13, cha: 14,
  saveProfs: 'dex,int',
  skillProfs: JSON.stringify({ stealth: 'exp', sleightOfHand: 'prof', perception: 'prof', deception: 'prof' }),
  skillAdj: '{}', bookmarks: [],
  languages: 'Common, Halfling, Thieves’ Cant',
  weapons: JSON.stringify([
    { name: 'Shortsword', atk: '+7', dmg: '1d6+4 Piercing', props: ['Finesse', 'Light'] },
    { name: 'Shortbow', atk: '+7', dmg: '1d6+4 Piercing', props: ['Ammunition', 'Two-Handed', 'Range (80/320)'] },
  ]),
};

dmState.playerHp = dmState.playerHp || {};
dmState.playerHp[PC_WIZARD] = { current: 24, max: 32 };
dmState.playerHp[PC_ROGUE]  = { current: 38, max: 38 };

dmState.playerCurrency = dmState.playerCurrency || {};
dmState.playerCurrency[PC_WIZARD] = { fl: 120, kn: 4, cl: 8 };
dmState.playerCurrency[PC_ROGUE]  = { fl: 63,  kn: 0, cl: 2 };

dmState.playerItems = dmState.playerItems || {};
dmState.playerItems[PC_WIZARD] = [
  { id: 't_pi_boek',   name: 'Spellbook', note: '' },
  { id: 't_pi_inkt',   name: 'Ink and quill', note: '' },
  { id: 't_pi_bedroll', name: 'Bedroll', note: '' },
];
dmState.playerItems[PC_ROGUE] = [
  { id: 't_pi_dieven', name: "Thieves' tools", note: '' },
  { id: 't_pi_touwtje', name: 'Grappling hook', note: '' },
];

// Voorwerp-kaartjes in bezit: één stapel en één uniek stuk.
groep.itemOwners = groep.itemOwners || {};
groep.itemOwners['t_vw_drank'] = [
  { characterId: PC_WIZARD, playerName: 'Wilmer Vlasbaard', qty: 3 },
  { characterId: PC_ROGUE,  playerName: 'Rozemarijn Doorn', qty: 1 },
];
groep.itemOwners['t_vw_ring'] = { characterId: PC_ROGUE, playerName: 'Rozemarijn Doorn' };

// Zichtbaarheid: de party kent de stad, niet de geheimen erachter.
groep.visibility = groep.visibility || {};
const zichtbaar = ['t_loc_gans', 't_loc_kramerij', 't_loc_tempel', 't_loc_markt', 't_org_gilde',
                   't_npc_bram', 't_npc_doortje', 't_npc_alwine', 't_npc_nachtvos', 't_god_sarvana',
                   't_dier_grommel', 't_pc_wilmer', 't_pc_rozemarijn',
                   't_vw_drank', 't_vw_ring', 't_vw_touw'];
for (const id of zichtbaar) groep.visibility[id] = 'visible';
groep.visibility['t_org_schaduw'] = 'vague';
groep.visibility['t_vw_kroon']    = 'hidden';
groep.visibility['t_vw_mantel']   = 'hidden';
groep.visibility['t_vw_dolk']     = 'visible';

// Eén roddel van de waard is al verteld, de rest nog niet.
const bram = personages.find(p => p.id === 't_npc_bram');
bram.data.flavoursUitgesproken = JSON.stringify([true, false, false]);

// ── Archief ─────────────────────────────────────────────────────────────────
archief.documents = archief.documents || [];
const doc = {
  id: 't_doc_vlasbrief',
  name: 'Brief van het Vlasgilde',
  type: 'Brief',
  content: 'Aan de raad,\n\nDe oogst van dit jaar is met een derde gedaald. Wij vragen om uitstel van de pacht, en om **stilte** over de reden.\n\nHoogachtend,\nde meesterwever van [[Het Vlasgilde]]',
  createdAt: new Date().toISOString(),
};
const di = archief.documents.findIndex(d => d.id === doc.id);
if (di >= 0) archief.documents[di] = doc; else archief.documents.push(doc);
groep.docVisibility = groep.docVisibility || {};
groep.docVisibility[doc.id] = 'visible';

// ── Monsterbibliotheek ──────────────────────────────────────────────────────
// Kaartjes met HP én AC horen in de monsterlijst (voor encounters), maar niet in
// het bestiarium. Normaal doet de server dat bij het opslaan van een kaartje;
// dit script schrijft de bestanden rechtstreeks, dus hier dezelfde regel.
const monstersRaw = lees('monsters.json', { monsters: [] });
const monsters = Array.isArray(monstersRaw) ? { monsters: [] } : (monstersRaw || { monsters: [] });
monsters.monsters = monsters.monsters || [];
const getal = (v) => parseInt(String(v ?? '').match(/-?\d+/)?.[0] ?? '', 10) || 0;
for (const p of personages) {
  if (p.subtype === 'speler') continue;   // je eigen party is geen monster
  if (!String(p.stats.hp).trim() || !String(p.stats.ac).trim()) continue;
  const regel = {
    id: `m_ent_${p.id}`, entityId: p.id, name: p.name,
    maxHp: getal(p.stats.hp), initiative: getal(p.stats.initiative) || 10,
    imageId: null, backdropId: null, chapter: '',
    statblock: { ...p.stats }, inBestiarium: false, description: p.data.desc || '',
  };
  const i = monsters.monsters.findIndex(m => m.entityId === p.id);
  if (i >= 0) monsters.monsters[i] = { ...monsters.monsters[i], ...regel };
  else monsters.monsters.push(regel);
}
// Twee losse monsters om een encounter mee te bouwen.
for (const m of [
  { id: 'm_test_goblin', name: 'Goblin', maxHp: 7, initiative: 12, inBestiarium: true,
    description: 'Klein, luidruchtig en zelden alleen.',
    statblock: { ac: '15', hp: '7', speed: '30 ft', cr: '1/4', size: 'Small', creatureType: 'Fey',
      str: '8', dex: '15', con: '10', int: '10', wis: '8', cha: '8',
      actions: '***Scimitar.*** Melee Attack: +4, reach 5 ft. *Hit:* 5 (1d6+2) Slashing damage.' } },
  { id: 'm_test_wolf', name: 'Wolf', maxHp: 11, initiative: 13, inBestiarium: true,
    description: 'Jaagt in roedels en kent geen haast.',
    statblock: { ac: '13', hp: '11', speed: '40 ft', cr: '1/4', size: 'Medium', creatureType: 'Beast',
      str: '12', dex: '15', con: '12', int: '3', wis: '12', cha: '6',
      actions: '***Bite.*** Melee Attack: +4, reach 5 ft. *Hit:* 5 (1d6+2) Piercing damage.' } },
]) {
  const i = monsters.monsters.findIndex(x => x.id === m.id);
  const regel = { imageId: null, backdropId: null, chapter: '', ...m };
  if (i >= 0) monsters.monsters[i] = { ...monsters.monsters[i], ...regel }; else monsters.monsters.push(regel);
}

// ── Meta: volledige spreukteksten in deze campagne ──────────────────────────
meta.bronTeksten = true;

// ── Verslag ─────────────────────────────────────────────────────────────────
console.log(`Campagne: ${campagne}`);
console.log(`Party   : ${groep.name} (id ${groepId}, wachtwoord "${groep.password}")`);
console.log(`Spelers : Wilmer Vlasbaard (Wizard 5) en Rozemarijn Doorn (Rogue 5)`);
console.log(`Kaartjes: ${personages.length} personages, ${locaties.length} locaties, ${organisaties.length} organisaties, ${voorwerpen.length} voorwerpen`);
console.log(`Monsters: ${monsters.monsters.length} in de bibliotheek (statblok-kaartjes staan er los van het bestiarium in)`);
console.log(`Spreuken: volledige teksten aan (meta.bronTeksten = true)`);

if (!schrijf) { console.log('\n(proefdraai — draai met --schrijf om het weg te schrijven)'); process.exit(0); }

for (const [naam, waarde] of [['entities.json', entities], ['dm-state.json', dmState], ['meta.json', meta], ['archief.json', archief], ['monsters.json', monsters]]) {
  const pad = path.join(dir, naam);
  if (fs.existsSync(pad)) fs.copyFileSync(pad, pad.replace(/\.json$/, `.bak.${Date.now()}.json`));
  schrijfJson(naam, waarde);
}
console.log('\nOpgeslagen (met een kopie van de oude stand ernaast).');
