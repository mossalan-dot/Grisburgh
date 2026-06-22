#!/usr/bin/env node
// Idempotente seed: voegt het Dog-ladder testdier (subtype 'dier', adopteerbaar) toe
// aan entities.json als het nog niet bestaat. Gebruik: node scripts/seed-pet-hond.js <pad-naar-entities.json>
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Geef het pad naar entities.json op.'); process.exit(1); }

const PET_ID = 'e_pet_hond_test';
const pet = {
  id: PET_ID,
  type: 'personages',
  subtype: 'dier',
  name: 'Rakker',
  description: 'Een trouwe viervoeter van De Magizoöloog die met zijn baasje meegroeit — van pup tot geduchte strijdhond.',
  data: {
    ras: 'Hond',
    soortLabel: 'Hond',
    adopteerbaar: true,
    adoptiePrijs: { fl: 15 },
  },
  statblockTiers: [
    {
      minLevel: 1, label: 'Dog', maxHp: 4,
      statblock: {
        size: 'Small', type: 'Beast', alignment: 'Unaligned',
        ac: '12', hp: '1d6+1', speed: '40 ft.',
        str: 13, dex: 14, con: 12, int: 7, wis: 12, cha: 7,
        skills: 'Perception +3, Stealth +4',
        senses: 'Passive Perception 13', languages: '—', cr: '0',
        traits: '***Keen Hearing and Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
        actions: '***Bite.*** Melee Attack Roll: +0, reach 5 ft. Hit: 1 Piercing damage.',
      },
    },
    {
      minLevel: 5, label: 'Guard Dog', maxHp: 11,
      statblock: {
        size: 'Small', type: 'Beast', alignment: 'Unaligned',
        ac: '13', hp: '2d6+4', speed: '40 ft.',
        str: 14, dex: 14, con: 14, int: 7, wis: 14, cha: 7,
        skills: 'Perception +4, Stealth +4',
        senses: 'Passive Perception 14', languages: '—', cr: '1/2',
        traits: '***Keen Hearing and Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
        actions: '***Bite.*** Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8+2) Piercing damage.',
      },
    },
    {
      minLevel: 9, label: 'War Dog', maxHp: 19,
      statblock: {
        size: 'Medium', type: 'Beast', alignment: 'Unaligned',
        ac: '14', hp: '3d8+6', speed: '40 ft.',
        str: 16, dex: 15, con: 14, int: 7, wis: 14, cha: 8,
        skills: 'Perception +4, Stealth +4',
        senses: 'Passive Perception 14', languages: '—', cr: '1',
        traits: '***Keen Hearing and Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
        actions: '***Bite.*** Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8+3) Piercing damage, and the target has the Prone condition if it is Large or smaller.',
      },
    },
    {
      minLevel: 14, label: 'Battle Hound', maxHp: 37,
      statblock: {
        size: 'Medium', type: 'Beast', alignment: 'Unaligned',
        ac: '15', hp: '5d8+15', speed: '50 ft.',
        str: 18, dex: 15, con: 16, int: 8, wis: 14, cha: 9,
        skills: 'Perception +5, Stealth +5',
        senses: 'Passive Perception 15', languages: '—', cr: '2',
        traits: '***Keen Hearing and Smell.*** The dog has Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
        actions: '***Multiattack.*** The hound makes two Bite attacks.\n***Bite.*** Melee Attack Roll: +6, reach 5 ft. Hit: 8 (1d8+4) Piercing damage, and the target has the Prone condition if it is Large or smaller.',
      },
    },
  ],
};

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(data.personages)) data.personages = [];
const idx = data.personages.findIndex(e => e.id === PET_ID);
if (idx >= 0) { data.personages[idx] = { ...data.personages[idx], ...pet }; console.log('Bestaand testdier bijgewerkt:', PET_ID); }
else { data.personages.push(pet); console.log('Testdier toegevoegd:', PET_ID); }
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Klaar. Aantal personages:', data.personages.length);
