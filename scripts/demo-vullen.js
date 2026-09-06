// Vult de Test-campagne met kaartjes en legt alle nieuwe koppelingen.
// Idempotent: bestaande id's worden bijgewerkt, niet gedupliceerd.
const fs = require('fs');
const base = '/var/www/grisburgh/data/campaigns/Test';
const lees  = f => JSON.parse(fs.readFileSync(base + '/' + f, 'utf8'));
const schrijf = (f, o) => fs.writeFileSync(base + '/' + f, JSON.stringify(o, null, 2));

const ent = lees('entities.json');
const zet = (soort, kaart) => {
  ent[soort] = ent[soort] || [];
  const i = ent[soort].findIndex(x => x.id === kaart.id);
  const oud = i >= 0 ? ent[soort][i] : null;
  const nieuw = { ...(oud || {}), ...kaart, data: { ...(oud?.data || {}), ...(kaart.data || {}) } };
  if (i >= 0) ent[soort][i] = nieuw; else ent[soort].push(nieuw);
  return nieuw;
};
const patch = (soort, id, data) => {
  const k = (ent[soort] || []).find(x => x.id === id);
  if (!k) { console.log('  ! niet gevonden: ' + id); return; }
  k.data = { ...(k.data || {}), ...data };
};
const betr = rijen => JSON.stringify(rijen);

// ── Locaties ────────────────────────────────────────────────────────────────
const L = (id, name, locType, extra = {}) =>
  zet('locaties', { id, name, subtype: '', icon: '', data: { locType, ...extra } });

L('t_loc_leemland', 'Het Leemland', 'Streek', {
  desc: 'Een laaggelegen streek van kleiputten, vlasvelden en trage rivieren. Wie hier iets bouwt, bouwt op drassige grond.' });
L('t_loc_wolkenrode', 'Wolkenrode', 'Stad', {
  wijk: 'Het Leemland', wijkId: 't_loc_leemland',
  desc: 'De enige stad van betekenis in het Leemland. Drie bruggen, twee markten en meer gilden dan raadsleden.' });
L('t_loc_havenkwartier', 'Havenkwartier', 'Stadswijk', {
  wijk: 'Wolkenrode', wijkId: 't_loc_wolkenrode',
  desc: 'Pakhuizen, netten en een geur die nooit helemaal wegtrekt. Na zonsondergang loopt hier niemand alleen.' });
L('t_loc_zeearend', 'De Zeearend', 'Taveerne', {
  wijk: 'Havenkwartier', wijkId: 't_loc_havenkwartier',
  desc: 'Een lage taveerne aan het water. Geen bedden, wel het sterkste bier van de stad.',
  betrokkenen: betr([
    { naam: 'Kaatje Zeegras', rol: 'Eigenaar', id: 't_npc_kaatje' },
    { naam: 'Sluwe Sien',     rol: 'Stamgast', id: 't_npc_sien' },
  ]),
  eigenaar: 'Kaatje Zeegras', eigenaarId: 't_npc_kaatje' });
L('t_loc_smidse', 'Smidse van Harmen Aambeeld', 'Werkplaats', {
  wijk: 'Havenkwartier', wijkId: 't_loc_havenkwartier',
  desc: 'Roet, vonken en een aambeeld dat al drie generaties meegaat.',
  betrokkenen: betr([
    { naam: 'Harmen Aambeeld', rol: 'Eigenaar', id: 't_npc_harmen' },
    { naam: 'Het Vlasgilde',   rol: 'Beschermheer', id: 't_org_gilde' },
  ]),
  eigenaar: 'Harmen Aambeeld', eigenaarId: 't_npc_harmen' });
L('t_loc_academie', 'Academie van Zeven Zuilen', 'Academie', {
  wijk: 'Wolkenrode', wijkId: 't_loc_wolkenrode',
  desc: 'Zeven zuilen, zes staan er nog. De zevende is een les op zichzelf, zeggen de magisters.',
  betrokkenen: betr([{ naam: 'Magister Orlin Veen', rol: 'Leider', id: 't_npc_orlin' }]),
  eigenaar: 'Magister Orlin Veen', eigenaarId: 't_npc_orlin' });
L('t_loc_ruine', 'Ruïne van Oud-Vlaskerke', 'Ruine', {
  wijk: 'Het Leemland', wijkId: 't_loc_leemland',
  desc: 'Van het dorp staat alleen de kerktoren nog. De rest zakte weg in de klei.',
  geheimen: JSON.stringify(['Onder het altaar ligt een luik dat naar de Vergeten Kelders leidt.']) });
L('t_loc_kelder', 'Vergeten Kelders', 'Grot', {
  wijk: 'Ruïne van Oud-Vlaskerke', wijkId: 't_loc_ruine',
  dungeonId: 'dng_test_kelders', roomId: '',
  desc: 'Gangen die ouder zijn dan het dorp erboven. Iemand heeft ze uitgehakt; niemand weet meer waarvoor.' });

// Bestaande locaties: gebied + betrokkenen erbij
patch('locaties', 't_loc_markt', {
  wijk: 'Wolkenrode', wijkId: 't_loc_wolkenrode',
  betrokkenen: betr([{ naam: 'De Stadswacht van Wolkenrode', rol: 'Beschermheer', id: 't_org_wacht' }]) });
patch('locaties', 't_loc_gans', {
  wijk: 'Het Marktplein', wijkId: 't_loc_markt',
  betrokkenen: betr([
    { naam: 'Bram Kruik', rol: 'Eigenaar', id: 't_npc_bram' },
    { naam: 'Grommel',    rol: 'Stamgast', id: 't_dier_grommel' },
  ]),
  eigenaar: 'Bram Kruik', eigenaarId: 't_npc_bram' });
patch('locaties', 't_loc_kramerij', {
  wijk: 'Het Marktplein', wijkId: 't_loc_markt',
  betrokkenen: betr([
    { naam: 'Doortje Pluis', rol: 'Eigenaar', id: 't_npc_doortje' },
    { naam: 'Het Vlasgilde', rol: 'Beschermheer', id: 't_org_gilde' },
  ]),
  eigenaar: 'Doortje Pluis', eigenaarId: 't_npc_doortje' });
patch('locaties', 't_loc_tempel', {
  wijk: 'Het Marktplein', wijkId: 't_loc_markt',
  betrokkenen: betr([
    { naam: 'Zuster Alwine',      rol: 'Priester', id: 't_npc_alwine' },
    { naam: 'Moeder Vlaswinde',   rol: 'Priester', id: 't_npc_vlaswinde' },
  ]),
  eigenaar: 'Zuster Alwine', eigenaarId: 't_npc_alwine' });

// ── Personages ──────────────────────────────────────────────────────────────
const P = (id, name, rol, extra = {}) =>
  zet('personages', { id, name, subtype: 'NPC', icon: '', data: { rol, alignment: 'Neutral Good', ...extra } });

P('t_npc_kaatje', 'Kaatje Zeegras', 'Waardin van De Zeearend', {
  ras: 'Human', tags: JSON.stringify(['verkoper']),
  desc: 'Schenkt met één hand en houdt met de andere de deur in de gaten. Weet meer dan ze zegt.',
  flavours: JSON.stringify(['"Dat bier is sterker dan jij, jongen. Neem twee."']) });
P('t_npc_harmen', 'Harmen Aambeeld', 'Smid', {
  ras: 'Dwarf', tags: JSON.stringify(['verkoper']),
  desc: 'Praat weinig, slaat hard. Repareert alles behalve gebroken beloftes.' });
P('t_npc_vlaswinde', 'Moeder Vlaswinde', 'Hogepriesteres van Sarvana', {
  ras: 'Human', alignment: 'Lawful Good',
  desc: 'Draagt de dageraad op haar mantel en de nacht in haar ogen.' });
P('t_npc_orlin', 'Magister Orlin Veen', 'Hoofd van de Academie', {
  ras: 'Half-Elf', klasse: 'Wizard', alignment: 'Lawful Neutral',
  desc: 'Rekent in decennia en verontschuldigt zich nergens voor.' });
P('t_npc_sien', 'Sluwe Sien', 'Zakkenroller', {
  ras: 'Halfling', alignment: 'Chaotic Neutral',
  tags: JSON.stringify([]), kant: 'neutraal',
  desc: 'Klein, vriendelijk, en je beurs is weg.',
  geheimen: JSON.stringify([
    'Werkt voor De Schaduwhand en verklikt iedereen die te veel vraagt.',
    'Is de jongere zus van Kaatje Zeegras.' ]) });

// ── Organisaties ────────────────────────────────────────────────────────────
zet('organisaties', { id: 't_org_wacht', name: 'De Stadswacht van Wolkenrode', subtype: '', icon: '', data: {
  orgType: 'Militair', motto: 'Drie bruggen, één wet',
  wijk: 'Wolkenrode', wijkId: 't_loc_wolkenrode',
  desc: 'Zestig man, veertig hellebaarden en één kapitein die liever niet gestoord wordt.' }});
patch('organisaties', 't_org_gilde', {
  wijk: 'Het Marktplein', wijkId: 't_loc_markt',
  betrokkenen: betr([
    { naam: 'Doortje Pluis',   rol: 'Leider', id: 't_npc_doortje' },
    { naam: 'Harmen Aambeeld', rol: 'Lid',    id: 't_npc_harmen' },
  ]) });
patch('organisaties', 't_org_schaduw', {
  wijk: 'Havenkwartier', wijkId: 't_loc_havenkwartier',
  betrokkenen: betr([
    { naam: 'Nachtvos',    rol: 'Leider', id: 't_npc_nachtvos' },
    { naam: 'Sluwe Sien',  rol: 'Lid',    id: 't_npc_sien' },
  ]) });

schrijf('entities.json', ent);
console.log('entities: ' + ent.locaties.length + ' locaties, ' + ent.personages.length + ' personages, ' + ent.organisaties.length + ' organisaties');

// ── Dungeonkaart ────────────────────────────────────────────────────────────
let dng = { maps: [] };
try { dng = lees('dungeon-maps.json'); } catch { /* nieuw */ }
dng.maps = dng.maps || [];
if (!dng.maps.some(m => m.id === 'dng_test_kelders')) {
  dng.maps.push({
    id: 'dng_test_kelders', name: 'Vergeten Kelders', hoofdstukId: null, fileId: null,
    description: 'Onder de ruïne van Oud-Vlaskerke.',
    rooms: [
      { id: 'r_luik',   name: 'Het luik',        dmNotes: 'Klemt. DC 12 Athletics.', shape: 'poly', points: [], entrances: [] },
      { id: 'r_gang',   name: 'Lange gang',      dmNotes: '', shape: 'poly', points: [], entrances: [] },
      { id: 'r_put',    name: 'De droge put',    dmNotes: 'Vondst: geldzak, DC 14 Investigation.', shape: 'poly', points: [], entrances: [] },
      { id: 'r_altaar', name: 'Verzonken altaar', dmNotes: 'Sarvana-symbool, half weggesleten.', shape: 'poly', points: [], entrances: [] },
    ],
    partyAccess: [], reveals: {}, partyCompleted: [],
  });
}
schrijf('dungeon-maps.json', dng);
console.log('dungeons: ' + dng.maps.map(m => m.name).join(', '));

// ── Diensten in meta ────────────────────────────────────────────────────────
const meta = lees('meta.json');
meta.herberg = {
  naam: 'De Gouden Gans', waard: 'Bram Kruik',
  locatieEntityId: 't_loc_gans',
  imageId: 't_loc_gans', maxVragen: 3, cooldownMinutenMin: 3, cooldownMinutenMax: 10,
  overnachtingPrijs: '1 fl.',
  groet: 'Bram veegt een kroes droog. "Ga zitten, het duurt nog even voor het donker is."',
  menu: meta.herberg?.menu || [],
};
meta.tempel = meta.tempel || {};
meta.tempel.goden = [{
  naam: 'Sarvana, Vrouwe van de Dageraad',
  domein: 'Dageraad en herstel', symbool: 'Een opgaande zon in een handpalm',
  locatieEntityId: 't_loc_tempel',
  priesterEntityId: 't_npc_alwine',
  imageId: 't_god_sarvana', priestImageId: 't_npc_alwine',
  priesterGreet: 'Zuster Alwine buigt licht. "De dageraad kent geen haast."',
}];
const factieBasis = {
  embleem: 'landmark', stijl: '', beschrijving: '', npcEntityIdDag: null, npcGreet: '',
  leden: [], uitnodiging: '', uitnodigingTitel: '',
  renownDrempels: [0, 1, 3, 10, 25, 50], rangen: [],
};
meta.facties = [
  { ...factieBasis, id: 'vlasgilde', naam: 'Het Vlasgilde', embleem: 'package',
    beschrijving: 'Wie in het Leemland met vlas handelt, handelt met het gilde.',
    entityId: 't_org_gilde', locatieEntityId: 't_loc_kramerij', npcEntityId: 't_npc_doortje' },
  { ...factieBasis, id: 'schaduwhand', naam: 'De Schaduwhand', embleem: 'stiletto',
    beschrijving: 'Bestaat niet, zegt de stadswacht.',
    entityId: 't_org_schaduw', locatieEntityId: 't_loc_havenkwartier', npcEntityId: 't_npc_nachtvos' },
];
schrijf('meta.json', meta);
console.log('meta: herberg -> ' + meta.herberg.locatieEntityId +
  ' | god -> ' + meta.tempel.goden[0].locatieEntityId +
  ' | facties -> ' + meta.facties.map(f => f.id + ':' + f.entityId).join(', '));
