// ════════════════════════════════════════════════════════════════════════════
//  WAT ER MISGING
// ════════════════════════════════════════════════════════════════════════════
// Zolang er één DM was, was een fout iets wat je zelf zag gebeuren. Met een
// tweede DM verdwijnt hij: die ziet een leeg scherm, haalt zijn schouders op en
// speelt verder. Het foutlogboek van de server bestond wel, maar was 862 kB
// waarvan het grootste deel scanners die `/%c0/` probeerden — daar vind je
// niets in terug.
//
// Dit is een **ringbuffer van tweehonderd**, ontdubbeld op wat de fout ís
// (soort + melding + de eerste regel van de stack) met een teller en een
// eerst/laatst-gezien. Honderd keer dezelfde fout is één regel met honderd
// erachter, niet honderd regels.
//
// **Wat er níét in gaat.** De campagne-id en de route, nooit de inhoud: een
// foutmelding uit de campagne van een andere DM mag geen namen uit zijn wereld
// in dit bestand zetten. Dat is dezelfde grens die `campagne-isolatie.test.js`
// bewaakt, en een logboek is geen reden om eromheen te lopen.
const fs   = require('fs');
const path = require('path');

const BASE_DIR = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const BESTAND  = path.join(BASE_DIR, 'fouten.json');
const MAX      = 200;
const KNIP     = (s, n) => String(s ?? '').slice(0, n);

function lees() {
  try { const d = JSON.parse(fs.readFileSync(BESTAND, 'utf8')); return Array.isArray(d.fouten) ? d.fouten : []; }
  catch { return []; }
}

function schrijf(fouten) {
  try {
    fs.mkdirSync(path.dirname(BESTAND), { recursive: true });
    fs.writeFileSync(BESTAND, JSON.stringify({ fouten }, null, 2));
  } catch { /* een logboek dat zelf omvalt mag de app niet meeslepen */ }
}

// De vingerafdruk van een fout: waaraan herken je dat het dezelfde is? De
// eerste stackregel hoort erbij, want "Cannot read properties of undefined" op
// twee plekken zijn twee verschillende fouten.
function _sleutel(f) {
  // `(^|\s)at ` en niet `\s+at `: een stack die van elders komt (of uit een
  // test) heeft niet altijd inspringing, en dan viel élke regel weg — waarmee
  // twee verschillende fouten dezelfde vingerafdruk kregen en als herhaling
  // werden geteld.
  const eerste = String(f.stack || '').split('\n').find(r => /(?:^|\s)at\s/.test(r.trim() ? r : '')) || '';
  return [f.soort, f.melding, eerste.trim()].join(' | ').slice(0, 400);
}

// Een melding van een DM is geen fout die zichzelf herhaalt: twee meldingen met
// dezelfde zin zijn twee meldingen, want er zit een mens achter die iets anders
// bedoelde. Die ontdubbelen we dus niet.
function meld(fout) {
  const nu = new Date().toISOString();
  const nieuw = {
    soort:    ['server', 'client', 'melding'].includes(fout.soort) ? fout.soort : 'client',
    melding:  KNIP(fout.melding, 300),
    stack:    KNIP(fout.stack, 2000),
    waar:     KNIP(fout.waar, 200),       // route of scherm, geen inhoud
    campagne: KNIP(fout.campagne, 64),
    rol:      ['dm', 'speler', 'tablet', 'bezoeker'].includes(fout.rol) ? fout.rol : 'bezoeker',
    versie:   KNIP(fout.versie, 40),
    toelichting: KNIP(fout.toelichting, 1000),   // alleen bij een melding
  };
  const fouten = lees();
  if (nieuw.soort !== 'melding') {
    const sleutel = _sleutel(nieuw);
    const bestaand = fouten.find(f => f.sleutel === sleutel);
    if (bestaand) {
      bestaand.aantal = (bestaand.aantal || 1) + 1;
      bestaand.laatst = nu;
      bestaand.waar   = nieuw.waar || bestaand.waar;
      schrijf(fouten);
      return bestaand;
    }
    nieuw.sleutel = sleutel;
  }
  nieuw.id     = 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  nieuw.aantal = 1;
  nieuw.eerst  = nu;
  nieuw.laatst = nu;
  fouten.unshift(nieuw);
  schrijf(fouten.slice(0, MAX));
  return nieuw;
}

function alle() {
  // Meldingen van mensen bovenaan: daar wacht iemand op een antwoord.
  return lees().sort((a, b) => (b.soort === 'melding') - (a.soort === 'melding')
    || String(b.laatst).localeCompare(String(a.laatst)));
}

function wis(id) {
  const fouten = lees();
  const over = id ? fouten.filter(f => f.id !== id) : [];
  schrijf(over);
  return over.length;
}

module.exports = { meld, alle, wis, BESTAND, MAX };
