// ════════════════════════════════════════════════════════════════════════════
//  EEN DM UITNODIGEN
// ════════════════════════════════════════════════════════════════════════════
// Tot nu toe ging dat zo: de beheerder maakt een campagne, verzínt een
// wachtwoord voor iemand anders, stuurt dat via WhatsApp, en het blijft eeuwig
// geldig. Drie dingen mis in één handeling.
//
// Een uitnodiging is een **link die één keer werkt**. Wie hem opent kiest zijn
// eigen wachtwoord; daarna is de link dood. Hij verloopt vanzelf na een week,
// en de beheerder kan hem intrekken.
//
// **We bewaren het token niet, alleen zijn afdruk.** Dezelfde reden als bij een
// wachtwoord: wie het bestand in handen krijgt mag er niets aan hebben. Gevolg
// is dat de link maar één keer te zien is — bij het maken. Kwijt is kwijt, en
// dan maak je een nieuwe. Dat is één klik, en veiliger dan een link die voor
// altijd ergens terug te lezen valt.
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const BASE_DIR = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const BESTAND  = path.join(BASE_DIR, 'uitnodigingen.json');
const DAGEN    = 7;

const _afdruk = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function lees() {
  try { const d = JSON.parse(fs.readFileSync(BESTAND, 'utf8')); return Array.isArray(d.uitnodigingen) ? d.uitnodigingen : []; }
  catch { return []; }
}
function schrijf(lijst) {
  fs.mkdirSync(path.dirname(BESTAND), { recursive: true });
  fs.writeFileSync(BESTAND, JSON.stringify({ uitnodigingen: lijst }, null, 2));
}

// Maken geeft het token één keer terug; daarna kent niemand het meer.
function maak({ campagne, naam = '', door = '' }) {
  const token = crypto.randomBytes(24).toString('hex');
  const nu = Date.now();
  const u = {
    id:       'u_' + nu.toString(36) + crypto.randomBytes(2).toString('hex'),
    campagne: String(campagne),
    naam:     String(naam).slice(0, 80),
    afdruk:   _afdruk(token),
    gemaakt:  new Date(nu).toISOString(),
    verloopt: new Date(nu + DAGEN * 864e5).toISOString(),
    gebruikt: null,
    door:     String(door).slice(0, 80),
  };
  // Eén open uitnodiging per campagne: een tweede maken trekt de eerste in.
  // Twee links naar dezelfde deur is twee keer de kans dat er een rondslingert.
  const lijst = lees().filter(x => !(x.campagne === u.campagne && !x.gebruikt));
  lijst.unshift(u);
  schrijf(lijst.slice(0, 100));
  return { uitnodiging: u, token };
}

// Zoekt de uitnodiging die bij dit token hoort, en zegt waaróm hij niet geldig
// is als dat zo is — de beheerder moet kunnen horen of het "verlopen" of
// "al gebruikt" was, anders blijft het raden.
function zoek(campagne, token) {
  if (!token || !campagne) return { fout: 'onbekend' };
  const afdruk = _afdruk(token);
  const u = lees().find(x => x.campagne === campagne && x.afdruk === afdruk);
  if (!u) return { fout: 'onbekend' };
  if (u.gebruikt) return { fout: 'gebruikt', uitnodiging: u };
  if (new Date(u.verloopt).getTime() < Date.now()) return { fout: 'verlopen', uitnodiging: u };
  return { uitnodiging: u };
}

function gebruik(id, door = '') {
  const lijst = lees();
  const u = lijst.find(x => x.id === id);
  if (!u) return null;
  u.gebruikt = new Date().toISOString();
  u.door = String(door).slice(0, 80) || u.door;
  schrijf(lijst);
  return u;
}

function trekIn(id) {
  const lijst = lees().filter(x => x.id !== id);
  schrijf(lijst);
  return lijst.length;
}

// Naar buiten zonder de afdruk: die is van ons.
function alle() {
  return lees().map(({ afdruk, ...rest }) => ({
    ...rest,
    open: !rest.gebruikt && new Date(rest.verloopt).getTime() > Date.now(),
  }));
}

module.exports = { maak, zoek, gebruik, trekIn, alle, BESTAND, DAGEN };
