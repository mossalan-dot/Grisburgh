#!/usr/bin/env node
// Idempotente seed: voegt het Leeuwenvelders-assortiment toe als adopteerbare dier-entities.
// Gebruik: node scripts/seed-pets-leeuwenvelders.js <pad-naar-entities.json>
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Geef het pad naar entities.json op.'); process.exit(1); }

const KEEN = '***Keen Hearing and Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on hearing or smell.';

const pets = [
  {
    id: 'e_pet_jip', subtype: 'dier', name: 'Jip',
    description: 'Een vrolijke terriër met een neus voor verborgen schatten. Groeit met zijn baasje uit tot een trouwe waakhond.',
    data: { ras: 'Hond', soortLabel: 'Terriër', adopteerbaar: true, adoptiePrijsFl: 15, naamSuggestie: 'Jip' },
    statblockTiers: [
      { minLevel: 1, label: 'Terriërpup', maxHp: 4, statblock: { size: 'Small', type: 'Beast', alignment: 'Unaligned', ac: '12', hp: '1d6+1', speed: '40 ft.', str: 11, dex: 15, con: 12, int: 4, wis: 12, cha: 7, skills: 'Perception +3', senses: 'Passive Perception 13', cr: '0',
        traits: '***Keen Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on smell.',
        actions: '***Bite.*** Melee Attack Roll: +2, reach 5 ft. Hit: 2 (1d4) Piercing damage.\n***Snuffelvondst (1×/rust).*** Bij aankomst op een nieuwe plek rolt Jip 1d4; bij een 4 vindt hij een klein voorwerp (de DM rolt 1d6 op de vondsttabel).' } },
      { minLevel: 6, label: 'Speurhond', maxHp: 13, statblock: { size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: '13', hp: '2d8+4', speed: '40 ft.', str: 13, dex: 15, con: 14, int: 4, wis: 13, cha: 7, skills: 'Perception +4', senses: 'Passive Perception 14', cr: '1/2',
        traits: '***Keen Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on smell.',
        actions: '***Bite.*** Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6+1) Piercing damage.\n***Snuffelvondst (1×/rust).*** Jip vindt een voorwerp bij een 3–4 op 1d4.' } },
      { minLevel: 12, label: 'Trouwe Waakhond', maxHp: 26, statblock: { size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: '14', hp: '4d8+8', speed: '40 ft.', str: 15, dex: 15, con: 15, int: 5, wis: 14, cha: 8, skills: 'Perception +5', senses: 'Passive Perception 15', cr: '1',
        traits: KEEN,
        actions: '***Bite.*** Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d8+2) Piercing damage, and the target has the Prone condition if it is Large or smaller.\n***Snuffelvondst (1×/rust).*** Jip vindt een voorwerp bij een 2–4 op 1d4.',
        reactions: '***Trouwe Wacht.*** Wanneer het baasje binnen 5 ft wordt geraakt, dwingt Jip de aanvaller tot een DC 12 Strength saving throw of die krijgt de Prone condition.' } },
    ],
  },
  {
    id: 'e_pet_mystique', subtype: 'dier', name: 'Mystique',
    description: 'Een alerte zwarte kat met ogen die niets ontgaat. Hoe ervarener haar baasje, hoe minder vaak de party verrast wordt.',
    data: { ras: 'Kat', soortLabel: 'Zwarte kat', adopteerbaar: true, adoptiePrijsFl: 18, naamSuggestie: 'Mystique' },
    statblockTiers: [
      { minLevel: 1, label: 'Schaduwkatje', maxHp: 2, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '13', hp: '1d4', speed: '40 ft., climb 30 ft.', str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7, skills: 'Stealth +4, Perception +3', senses: 'Darkvision 60 ft., Passive Perception 13', cr: '0',
        traits: '***Sluipend.*** Mystique heeft Advantage op Dexterity (Stealth) checks.',
        actions: '***Claws.*** Melee Attack Roll: +4, reach 5 ft. Hit: 1 Slashing damage.\n***Waakzaam.*** Wanneer een vijand de party probeert te overvallen, rolt Mystique 1d6; bij 5–6 alarmeert ze iedereen en is er geen Surprise.' } },
      { minLevel: 6, label: 'Schaduwsluiper', maxHp: 10, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '14', hp: '3d4+3', speed: '40 ft., climb 30 ft.', str: 4, dex: 16, con: 13, int: 3, wis: 13, cha: 7, skills: 'Stealth +6, Perception +3', senses: 'Darkvision 60 ft., Passive Perception 13', cr: '1/4',
        traits: '***Sluipend.*** Mystique heeft Advantage op Dexterity (Stealth) checks.',
        actions: '***Claws.*** Melee Attack Roll: +5, reach 5 ft. Hit: 4 (1d4+2) Slashing damage.\n***Waakzaam.*** Mystique alarmeert de party bij 4–6 op 1d6.' } },
      { minLevel: 12, label: 'Nachtwachter', maxHp: 27, statblock: { size: 'Small', type: 'Beast', alignment: 'Unaligned', ac: '15', hp: '5d6+10', speed: '40 ft., climb 30 ft.', str: 6, dex: 17, con: 14, int: 4, wis: 14, cha: 8, skills: 'Stealth +7, Perception +5', senses: 'Darkvision 60 ft., Passive Perception 15', cr: '1',
        traits: '***Sluipend.*** Mystique heeft Advantage op Dexterity (Stealth) checks.',
        actions: '***Claws.*** Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d6+3) Slashing damage.\n***Waakzaam.*** Mystique alarmeert de party bij 3–6 op 1d6.',
        bonusActions: '***Schaduwsprong.*** Mystique teleporteert tot 15 ft naar een ongelichte plek die ze kan zien.' } },
    ],
  },
  {
    id: 'e_pet_barry', subtype: 'dier', name: 'Barry',
    description: 'Een dwergpapegaai met een grote bek en geen filter. Soms een gênante last, soms een geducht spotter.',
    data: { ras: 'Papegaai', soortLabel: 'Dwergpapegaai', adopteerbaar: true, adoptiePrijsFl: 12, naamSuggestie: 'Barry' },
    statblockTiers: [
      { minLevel: 1, label: 'Kwebbelaar', maxHp: 3, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '12', hp: '1d4+1', speed: '10 ft., fly 50 ft.', str: 2, dex: 16, con: 8, int: 3, wis: 12, cha: 6, skills: 'Perception +3', senses: 'Passive Perception 13', cr: '0',
        traits: '***Mimicry.*** Barry kan eenvoudige geluiden en woorden nabootsen die hij heeft gehoord.',
        actions: '***Beak.*** Melee Attack Roll: +5, reach 5 ft. Hit: 1 Piercing damage.\n***Schuttingtaal.*** Bij een Stealth- of Persuasion-check van de party rolt Barry 1d6; bij een 1 floept hij er een vloek uit (de DM bepaalt het ongemak).' } },
      { minLevel: 7, label: 'Scholdervogel', maxHp: 7, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '13', hp: '2d4+2', speed: '10 ft., fly 50 ft.', str: 3, dex: 17, con: 13, int: 5, wis: 12, cha: 9, skills: 'Perception +3', senses: 'Passive Perception 13', cr: '1/4',
        traits: '***Mimicry.*** Barry kan stemmen en zinnen overtuigend nabootsen.',
        actions: '***Beak.*** Melee Attack Roll: +6, reach 5 ft. Hit: 3 (1d4+1) Piercing damage.\n***Krijsende Spot.*** Eén wezen dat Barry kan horen en verstaan maakt een DC 11 Wisdom saving throw of heeft Disadvantage op zijn volgende attack roll. Terwijl Barry meekrijst heeft het baasje Advantage op Intimidation checks.\n***Schuttingtaal.*** De flater gebeurt nu alleen bij een 1 op 1d8.' } },
    ],
  },
  {
    id: 'e_pet_freddy', subtype: 'dier', name: 'Freddy',
    description: 'Een snoekbaars die rondzweeft in een glinsterende waterbel en nooit ver van zijn baasje raakt.',
    data: { ras: 'Vis', soortLabel: 'Zwevende snoekbaars', adopteerbaar: true, adoptiePrijsFl: 14, naamSuggestie: 'Freddy' },
    statblockTiers: [
      { minLevel: 1, label: 'Bubbelvis', maxHp: 2, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '11', hp: '1d4', speed: '0 ft., fly 20 ft. (hover), swim 40 ft.', str: 7, dex: 13, con: 10, int: 2, wis: 11, cha: 4, senses: 'Darkvision 60 ft., Passive Perception 10', cr: '0',
        traits: '***Watersfeer.*** Freddy zweeft in een waterbel en blijft binnen 30 ft van zijn baasje. ***Water Breathing.***',
        actions: '***Staartvin-klap.*** Melee Attack Roll: +3, reach 5 ft. Hit: 1 Bludgeoning damage, en het doel heeft tot Freddy\'s volgende beurt Disadvantage op zijn volgende attack roll (afleiding).' } },
      { minLevel: 7, label: 'Stroomwachter', maxHp: 10, statblock: { size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: '13', hp: '3d4+3', speed: '0 ft., fly 20 ft. (hover), swim 40 ft.', str: 9, dex: 15, con: 13, int: 2, wis: 11, cha: 4, senses: 'Darkvision 60 ft., Passive Perception 10', cr: '1/4',
        traits: '***Watersfeer.*** Freddy zweeft in een waterbel en blijft binnen 30 ft van zijn baasje. ***Water Breathing.***',
        actions: '***Staartvin-klap.*** Melee Attack Roll: +5, reach 5 ft. Hit: 4 (1d4+2) Bludgeoning damage, en het doel heeft Disadvantage op zijn volgende attack roll.\n***Flankafleiding.*** Een bondgenoot binnen 5 ft van een vijand die ook naast Freddy staat, heeft Advantage op zijn volgende attack roll tegen die vijand (1×/beurt).' } },
      { minLevel: 13, label: 'Maalstroom', maxHp: 27, statblock: { size: 'Small', type: 'Beast', alignment: 'Unaligned', ac: '14', hp: '5d6+10', speed: '0 ft., fly 20 ft. (hover), swim 50 ft.', str: 12, dex: 16, con: 14, int: 3, wis: 12, cha: 5, senses: 'Darkvision 60 ft., Passive Perception 11', cr: '1',
        traits: '***Watersfeer.*** Freddy zweeft in een waterbel en blijft binnen 30 ft van zijn baasje. ***Water Breathing.***',
        actions: '***Staartvin-klap.*** Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d6+3) Bludgeoning damage.\n***Spuitstoot (Recharge 5–6).*** Een 15-ft lijn water: elk wezen in de lijn maakt een DC 12 Dexterity saving throw of neemt 7 (2d6) Bludgeoning damage en wordt 5 ft weggeduwd.' } },
    ],
  },
  {
    id: 'e_pet_raven', subtype: 'dier', name: 'R4V3N',
    description: 'Een raafautomaton van messing en veren. Zijn penveren openen sloten en zijn ogen verkennen wat het oog niet ziet.',
    data: { ras: 'Construct', soortLabel: 'Raafautomaton', adopteerbaar: true, adoptiePrijsFl: 20, naamSuggestie: 'R4V3N' },
    statblockTiers: [
      { minLevel: 1, label: 'Klepelraaf', maxHp: 3, statblock: { size: 'Tiny', type: 'Construct', alignment: 'Unaligned', ac: '13', hp: '1d4+1', speed: '10 ft., fly 50 ft.', str: 4, dex: 16, con: 12, int: 6, wis: 12, cha: 5, skills: 'Perception +5, Stealth +4', senses: 'Darkvision 60 ft., Passive Perception 15', cr: '0',
        traits: '***Constructed Nature.*** R4V3N heeft geen lucht, eten, drinken of slaap nodig.\n***Lopikslot-veer.*** Een afneembare penveer dient als improvised thieves\' tools; de drager heeft Advantage op één slot- of valstrikpoging per rust.',
        actions: '***Beak.*** Melee Attack Roll: +5, reach 5 ft. Hit: 2 (1d4) Piercing damage.' } },
      { minLevel: 6, label: 'Verkennerraaf', maxHp: 13, statblock: { size: 'Tiny', type: 'Construct', alignment: 'Unaligned', ac: '14', hp: '3d4+6', speed: '10 ft., fly 50 ft.', str: 6, dex: 17, con: 14, int: 8, wis: 13, cha: 5, skills: 'Perception +5, Stealth +5', senses: 'Darkvision 60 ft., Passive Perception 15', cr: '1/4',
        traits: '***Constructed Nature.*** R4V3N heeft geen lucht, eten, drinken of slaap nodig.\n***Lopikslot-veer.*** Een penveer dient als improvised thieves\' tools (Advantage op één poging per rust).',
        actions: '***Beak.*** Melee Attack Roll: +6, reach 5 ft. Hit: 5 (1d4+3) Piercing damage.\n***Verkenning.*** R4V3N vliegt tot 500 ft van het baasje; het baasje kan gedurende 1 minuut zien wat R4V3N ziet.' } },
      { minLevel: 12, label: 'Tactiekraaf', maxHp: 32, statblock: { size: 'Small', type: 'Construct', alignment: 'Unaligned', ac: '15', hp: '5d6+15', speed: '10 ft., fly 50 ft.', str: 8, dex: 18, con: 16, int: 10, wis: 14, cha: 6, skills: 'Perception +6, Stealth +6', senses: 'Darkvision 60 ft., Passive Perception 16', cr: '1',
        traits: '***Constructed Nature.*** R4V3N heeft geen lucht, eten, drinken of slaap nodig.\n***Lopikslot-veer.*** Een penveer dient als improvised thieves\' tools (Advantage op één poging per rust).',
        actions: '***Beak.*** Melee Attack Roll: +7, reach 5 ft. Hit: 7 (1d6+4) Piercing damage.\n***Hulp op afstand.*** R4V3N neemt de Help-actie voor een bondgenoot binnen 30 ft (afleidend gekras of een lichtflits).\n***Verkenning.*** R4V3N vliegt tot 500 ft; het baasje ziet 1 minuut wat R4V3N ziet.' } },
    ],
  },
];

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(data.personages)) data.personages = [];
let added = 0, updated = 0;
for (const pet of pets) {
  const idx = data.personages.findIndex(e => e.id === pet.id);
  const full = { type: 'personages', links: { personages: [], locaties: [], organisaties: [], voorwerpen: [], archief: [] }, ...pet };
  if (idx >= 0) { data.personages[idx] = { ...data.personages[idx], ...full }; updated++; }
  else { data.personages.push(full); added++; }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log(`Klaar — toegevoegd: ${added}, bijgewerkt: ${updated}. Totaal personages: ${data.personages.length}`);
