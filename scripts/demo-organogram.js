// Geeft de demo-organisaties een echte structuur, zodat het organogram iets
// laat zien. `chef` verwijst naar een naam uit dezelfde lijst.
const fs = require('fs');
const T = '/var/www/grisburgh/data/campaigns/Test';
const ent = JSON.parse(fs.readFileSync(T + '/entities.json', 'utf8'));
const org = naam => (ent.organisaties || []).find(o => o.name === naam);
const pers = naam => (ent.personages || []).find(p => p.name === naam);

const zet = (orgNaam, rijen, extra = {}) => {
  const o = org(orgNaam);
  if (!o) return console.log('  ! geen ' + orgNaam);
  const uit = rijen.map(r => {
    const p = pers(r.naam);
    return { naam: r.naam, rol: r.rol, id: p ? p.id : (org(r.naam)?.id || ''), ...(r.chef ? { chef: r.chef } : {}) };
  });
  o.data = { ...(o.data || {}), ...extra, betrokkenen: JSON.stringify(uit) };
  console.log('  ' + orgNaam + ': ' + uit.map(r => r.rol + ' ' + r.naam + (r.chef ? ' < ' + r.chef : '')).join(' | '));
};

zet('Het Vlasgilde', [
  { naam: 'Doortje Pluis',   rol: 'Leider' },
  { naam: 'Harmen Aambeeld', rol: 'Meesterambacht', chef: 'Doortje Pluis' },
  { naam: 'Kaatje Zeegras',  rol: 'Penningmeester', chef: 'Doortje Pluis' },
  { naam: 'Sluwe Sien',      rol: 'Leerling',       chef: 'Harmen Aambeeld' },
], { orgType: 'Gilde', motto: 'Uit vlas gesponnen, in goud geteld',
     flavours: JSON.stringify([
       '"Wie in het Leemland met vlas handelt, handelt met ons. Zo is het altijd geweest."',
       '"Doortje weegt tweemaal en glimlacht eenmaal. Let op wanneer."']),
     geheimen: JSON.stringify([
       'Het gilde koopt al twee jaar vlas op van een leverancier die niet bestaat; het geld gaat ergens anders heen.',
       'Doortje heeft een schuld bij De Schaduwhand die ze met gildegeld afbetaalt.']) });

zet('De Schaduwhand', [
  { naam: 'Nachtvos',   rol: 'Leider' },
  { naam: 'Sluwe Sien', rol: 'Lid', chef: 'Nachtvos' },
], { orgType: 'Crimineel', motto: 'Wij bestaan niet',
     flavours: JSON.stringify([
       '"De Schaduwhand? Nooit van gehoord. Vraag het niet nog eens."']),
     geheimen: JSON.stringify([
       'Het pakhuis aan de haven is van hen; de helft van de kratten staat op geen enkele lijst.']) });

zet('De Stadswacht van Wolkenrode', [
  { naam: 'Magister Orlin Veen', rol: 'Beschermheer' },
  { naam: 'Bram Kruik',          rol: 'Informant', chef: 'Magister Orlin Veen' },
], { orgType: 'Wacht', motto: 'Drie bruggen, één wet',
     flavours: JSON.stringify(['"Zestig man, veertig hellebaarden. Reken zelf maar uit."']) });

fs.writeFileSync(T + '/entities.json', JSON.stringify(ent, null, 2));
console.log('klaar');
