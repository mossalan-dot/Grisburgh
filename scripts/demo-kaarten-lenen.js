// Leent Grisburghs kaartbeeld voor de demoruimte: de stadskaart en de
// wereldkaart zijn statische assets (/assets/...), dus die hoeven niet
// gekopieerd; de dungeonkaarten zijn geuploade bestanden en gaan wel mee.
const fs = require('fs');
const G = '/var/www/grisburgh/data/campaigns/grisburgh';
const T = '/var/www/grisburgh/data/campaigns/Test';
const lees  = (b, f) => JSON.parse(fs.readFileSync(b + '/' + f, 'utf8'));
const schrijf = (b, f, o) => fs.writeFileSync(b + '/' + f, JSON.stringify(o, null, 2));

const ent = lees(T, 'entities.json');
const loc = naam => (ent.locaties || []).find(l => l.name === naam);

// ── 1. Kaarten ──────────────────────────────────────────────────────────────
const gMap = lees(G, 'map.json');
const tMap = (() => { try { return lees(T, 'map.json'); } catch { return { maps: [], pins: [] }; } })();
tMap.maps = tMap.maps || []; tMap.pins = tMap.pins || [];
const zetKaart = k => {
  const i = tMap.maps.findIndex(m => m.id === k.id);
  if (i >= 0) tMap.maps[i] = { ...tMap.maps[i], ...k }; else tMap.maps.push(k);
};
zetKaart({ id: 'demo_stad',   label: 'Wolkenrode',   src: '/assets/map-grisburgh.jpg',
           description: 'De stadskaart. (Beeld geleend uit Grisburgh — de opschriften horen bij die campagne.)' });
zetKaart({ id: 'demo_wereld', label: 'Het Leemland', src: '/assets/map-isfar.jpg',
           description: 'De streek rond Wolkenrode. (Beeld geleend uit Grisburgh.)' });

// Spelden: coördinaten lenen we van Grisburghs eigen spelden, dan staan ze
// verspreid over de kaart in plaats van op een hoop.
const bron = (gMap.pins || []).filter(p => (p.mapId || 'grisburgh') === 'grisburgh');
const opStad = ['De Gouden Gans', 'Kramerij Vlas & Vezel', 'Tempel van het Stille Licht',
  'Het Marktplein', 'Havenkwartier', 'De Zeearend', 'Smidse van Harmen Aambeeld',
  'Academie van Zeven Zuilen'];
const opWereld = ['Wolkenrode', 'Ruïne van Oud-Vlaskerke', 'Vergeten Kelders'];
tMap.pins = tMap.pins.filter(p => !['demo_stad', 'demo_wereld'].includes(p.mapId || ''));
let n = 0;
const speld = (naam, mapId, x, y) => {
  const l = loc(naam);
  if (!l) { console.log('  ! geen locatie ' + naam); return; }
  tMap.pins.push({ id: 'pin_demo_' + (n++), locId: l.id, mapId, x, y });
};
opStad.forEach((naam, i) => {
  const b = bron[i % bron.length];
  speld(naam, 'demo_stad', b.x, b.y);
});
// De wereldkaart heeft eigen coördinaten nodig; drie plekken op de kaart.
[['Wolkenrode', 46, 38], ['Ruïne van Oud-Vlaskerke', 38, 52], ['Vergeten Kelders', 39.5, 55]]
  .forEach(([naam, x, y]) => speld(naam, 'demo_wereld', x, y));
schrijf(T, 'map.json', tMap);
console.log('kaarten: ' + tMap.maps.map(m => m.label).join(', ') + ' | spelden: ' + tMap.pins.length);

// ── 2. Dungeonkaarten ───────────────────────────────────────────────────────
const gD = lees(G, 'dungeon-maps.json');
const tD = (() => { try { return lees(T, 'dungeon-maps.json'); } catch { return { maps: [] }; } })();
tD.maps = tD.maps || [];
const kopieer = (bestand, vanDir, naarDir) => {
  const treffers = fs.readdirSync(vanDir).filter(f => f.startsWith(bestand));
  for (const f of treffers) {
    if (!fs.existsSync(naarDir + '/' + f)) fs.copyFileSync(vanDir + '/' + f, naarDir + '/' + f);
  }
  return treffers.length;
};
const importDungeon = (bronNaam, nieuwId, nieuwNaam, omschrijving) => {
  const b = gD.maps.find(m => m.name === bronNaam);
  if (!b) { console.log('  ! geen dungeon ' + bronNaam); return null; }
  if (b.fileId)  kopieer(b.fileId,  G + '/files',  T + '/files');
  if (b.thumbId) kopieer(b.thumbId, G + '/thumbs', T + '/thumbs');
  const kaart = {
    id: nieuwId, name: nieuwNaam, hoofdstukId: null,
    fileId: b.fileId, thumbId: b.thumbId, description: omschrijving,
    rooms: JSON.parse(JSON.stringify(b.rooms || [])),
    partyAccess: [], reveals: {}, partyCompleted: [],
  };
  const i = tD.maps.findIndex(m => m.id === nieuwId);
  if (i >= 0) tD.maps[i] = kaart; else tD.maps.push(kaart);
  return kaart;
};
const kelders = importDungeon('Pastorie van Velurut', 'dng_demo_kelders', 'Vergeten Kelders',
  'De gangen onder de ruïne van Oud-Vlaskerke.');
const pakhuis = importDungeon('Oostermagazijn', 'dng_demo_pakhuis', 'Pakhuis aan de Haven',
  'Een opslagpand in het Havenkwartier.');
// De verzonnen lege kaart mag weg nu er een echte is.
tD.maps = tD.maps.filter(m => m.id !== 'dng_test_kelders');
schrijf(T, 'dungeon-maps.json', tD);
console.log('dungeons: ' + tD.maps.map(m => m.name + ' (' + (m.rooms || []).length + ' kamers)').join(', '));

// ── 3. Locaties aan de dungeons hangen ──────────────────────────────────────
const hang = (naam, dungeonId, roomId = '') => {
  const l = loc(naam);
  if (!l) { console.log('  ! geen locatie ' + naam); return; }
  l.data = { ...(l.data || {}), dungeonId, roomId };
};
hang('Vergeten Kelders', 'dng_demo_kelders', (kelders?.rooms || []).find(r => /Kapel|Ontvangst/.test(r.name))?.id || '');
// Een pand in het Havenkwartier dat aan de tweede kaart hangt.
if (!loc('Pakhuis aan de Haven')) {
  const hav = loc('Havenkwartier');
  ent.locaties.push({
    id: 't_loc_pakhuis', name: 'Pakhuis aan de Haven', subtype: '', icon: '',
    data: {
      locType: 'Gebouw', wijk: 'Havenkwartier', wijkId: hav?.id || '',
      dungeonId: 'dng_demo_pakhuis', roomId: '',
      desc: 'Drie verdiepingen vol kratten waarvan de helft niet op de lijst staat.',
      betrokkenen: JSON.stringify([{ naam: 'De Schaduwhand', rol: 'Eigenaar', id: 't_org_schaduw' }]),
      eigenaar: 'De Schaduwhand', eigenaarId: 't_org_schaduw',
    },
  });
}
schrijf(T, 'entities.json', ent);
console.log('locaties: ' + ent.locaties.length + ', gekoppeld aan een dungeon: ' +
  ent.locaties.filter(l => l.data?.dungeonId).map(l => l.name).join(', '));
