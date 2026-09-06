// Leent beeld uit Grisburgh voor de demoruimte. Een kaartje zonder
// data.imageId gebruikt een bestand dat naar zijn eigen id heet; daarom
// kopiëren we het bestand onder een nieuwe naam en zetten we imageId.
const fs = require('fs');
const G = '/var/www/grisburgh/data/campaigns/grisburgh';
const T = '/var/www/grisburgh/data/campaigns/Test';
const lees = (b, f) => JSON.parse(fs.readFileSync(b + '/' + f, 'utf8'));

const gEnt = lees(G, 'entities.json');
const tEnt = lees(T, 'entities.json');
const gFiles  = fs.readdirSync(G + '/files');
const gThumbs = fs.readdirSync(G + '/thumbs');

// Welk bestand hoort bij een Grisburgh-kaartje?
const bestandVan = k => {
  const id = k.data?.imageId || k.id;
  return gFiles.find(f => f.replace(/\.[^.]+$/, '') === id) || null;
};

// Pak per soort de kaartjes die écht een plaatje hebben, in vaste volgorde
// zodat een tweede run dezelfde keuze maakt.
const voorraad = {};
for (const t of ['personages', 'locaties', 'organisaties']) {
  voorraad[t] = (gEnt[t] || [])
    .map(k => ({ naam: k.name, bestand: bestandVan(k), subtype: k.subtype, type: k.data?.locType || k.data?.orgType }))
    .filter(x => x.bestand);
}
console.log('beschikbaar: ' + Object.entries(voorraad).map(([t, v]) => t + ' ' + v.length).join(', '));

let nr = 0;
const leen = (kaart, bron) => {
  if (!bron) return false;
  const ext = bron.bestand.match(/\.[^.]+$/)[0];
  const nieuwId = 'demo_beeld_' + (nr++);
  fs.copyFileSync(G + '/files/' + bron.bestand, T + '/files/' + nieuwId + ext);
  // Thumbnail meenemen als hij er is; anders maakt de server hem later zelf.
  const bronId = bron.bestand.replace(/\.[^.]+$/, '');
  const th = gThumbs.find(f => f.replace(/\.[^.]+$/, '') === bronId);
  if (th) fs.copyFileSync(G + '/thumbs/' + th, T + '/thumbs/' + nieuwId + th.match(/\.[^.]+$/)[0]);
  kaart.data = { ...(kaart.data || {}), imageId: nieuwId, imgFocus: kaart.data?.imgFocus || '50% 40%' };
  return true;
};

// Kies passend beeld: een NPC krijgt een NPC-portret, een herberg een herberg.
const pakVoor = (soort, filter, gebruikt) => {
  const kandidaten = voorraad[soort].filter(v => !gebruikt.has(v.bestand) && (!filter || filter(v)));
  return kandidaten[0] || voorraad[soort].filter(v => !gebruikt.has(v.bestand))[0] || null;
};

const gebruikt = new Set();
const rapport = [];
for (const [soort, filter] of [
  ['personages',   v => v.subtype === 'NPC'],
  ['locaties',     null],
  ['organisaties', null],
]) {
  for (const k of (tEnt[soort] || [])) {
    if (k.data?.imageId) { rapport.push('  = ' + k.name + ' (had al beeld)'); continue; }
    // Zelfde soort kaartje: een tempel krijgt een tempel, een winkel een winkel.
    const eigenType = k.data?.locType || k.data?.orgType;
    let bron = eigenType ? pakVoor(soort, v => v.type === eigenType, gebruikt) : null;
    if (!bron) bron = pakVoor(soort, filter, gebruikt);
    if (leen(k, bron)) { gebruikt.add(bron.bestand); rapport.push('  + ' + k.name + '  <-  ' + bron.naam); }
    else rapport.push('  ! ' + k.name + ' (geen beeld beschikbaar)');
  }
}
fs.writeFileSync(T + '/entities.json', JSON.stringify(tEnt, null, 2));
console.log(rapport.join('\n'));
console.log('\nbestanden in Test/files: ' + fs.readdirSync(T + '/files').length);
