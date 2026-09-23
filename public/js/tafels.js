// Tafels rollen — één plek.
//
// De worp stond twee keer in de codebase: `_tabelRoll` in dm-panel.js (de
// Tafels-tab) en `_rolTabel` in akte-schrijven.js (het regieblok). Ze waren al
// uit elkaar gelopen — de een trekt `rolls` regels zonder herhaling, de ander
// altijd één en zet er een nummer voor. Nu er een derde plek bij komt (de knop
// op een voorwerp) is dat het moment om ze samen te nemen: twee lijsten die
// hetzelfde moeten zeggen lopen vroeg of laat uiteen, en bij een worptafel zie
// je dat pas als er aan tafel iets geks uitkomt.
//
// Drie soorten, zoals de Tafels-tab ze kent:
//   simple    — trek er een (of `rolls` stuks, zonder herhaling)
//   weighted  — gooi een steen en zoek het bereik: "1-5: tekst"
//   combined  — één uit `first` plus één uit `last`
//
// Nieuw is `dobbel`: een gewogen tafel rolde altijd d100. Een tabel uit een akte
// is net zo vaak d6 of d20, en die 1-op-100 uitrekenen is precies het soort
// omrekenwerk dat je aan tafel niet wil. Staat er niets, dan blijft het d100 —
// dus alle bestaande tafels rollen onveranderd.

const DOBBEL = /(\d*)d(\d+)/i;

// "1-5: tekst", "7: tekst", en de SRD-schrijfwijze "97–00" waar 00 voor 100
// staat. De oude regex kende alleen het bereik met twee getallen; een tafel met
// losse regels gaf daardoor stilzwijgend "(geen treffer)".
const REGEL = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*[:.]\s*(.+)$/;

function zijden(tabel) {
  const m = DOBBEL.exec(String(tabel?.dobbel || 'd100'));
  const z = m ? parseInt(m[2], 10) : 100;
  return Number.isFinite(z) && z > 1 ? z : 100;
}

// 00 betekent 100, maar alleen op een d100 — op een d20 is het gewoon nul.
function grens(tekst, z) {
  const n = parseInt(tekst, 10);
  return (n === 0 && z === 100) ? 100 : n;
}

function trekEen(lijst) {
  return lijst[Math.floor(Math.random() * lijst.length)];
}

// Geeft altijd dezelfde vorm terug: de regels die eruit kwamen, plus de worp
// als er een steen aan te pas kwam. Wie het toont beslist zelf hoe.
export function rol(tabel) {
  if (!tabel) return { regels: ['Geen tafel.'], worp: null };
  const keer = Math.max(1, parseInt(tabel.rolls, 10) || 1);

  if (tabel.type === 'combined') {
    const a = tabel.first || [], b = tabel.last || [];
    if (!a.length && !b.length) return { regels: ['Deze tafel is leeg.'], worp: null };
    const uit = [];
    for (let i = 0; i < keer; i++) uit.push(`${trekEen(a) || '?'} ${trekEen(b) || '?'}`);
    return { regels: uit, worp: null };
  }

  const entries = tabel.entries || [];
  if (!entries.length) return { regels: ['Deze tafel is leeg.'], worp: null };

  if (tabel.type === 'weighted') {
    const z = zijden(tabel);
    const worp = 1 + Math.floor(Math.random() * z);
    for (const e of entries) {
      const m = REGEL.exec(String(e));
      if (!m) continue;
      const van = grens(m[1], z);
      const tot = m[2] !== undefined ? grens(m[2], z) : van;
      if (worp >= van && worp <= tot) return { regels: [m[3].trim()], worp, zijden: z };
    }
    return { regels: ['(geen treffer)'], worp, zijden: z };
  }

  // Zonder herhaling trekken: twee keer dezelfde naam uit een namentafel is
  // geen uitslag maar een ongelukje.
  const pot = [...entries].sort(() => Math.random() - 0.5);
  return { regels: pot.slice(0, Math.min(keer, pot.length)), worp: null };
}

// Hoe een uitslag heet als je hem in één regel wil tonen.
export function alsTekst(r) {
  const kop = r.worp ? `d${r.zijden}: ${r.worp} → ` : '';
  return r.regels.length > 1
    ? r.regels.map((x, i) => `${i + 1}. ${x}`).join(' · ')
    : kop + (r.regels[0] || '');
}

// ── Een `|`-tabel uit een akte omzetten naar een tafel ───────────────────────
//
// Alleen een **worptabel** kan een tafel worden: de eerste kolomkop moet een
// steen noemen (`| d100 |`, `| d6 |`). Zonder die kop weten we niet dat het een
// worptabel ís — een prijslijst en een overzicht van wachtposten zijn ook
// tabellen, en die horen niet als "rol maar" in de bibliotheek te belanden.
// De overige kolommen worden één regel, met een kastlijntje ertussen, want een
// tafel kent maar één tekst per uitkomst.

export function dobbelUitKop(kop) {
  const m = DOBBEL.exec(String(kop || ''));
  return m ? ('d' + m[2]) : null;
}

export function uitMarkdown(regels, naam) {
  const cellen = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const rauw = (regels || []).filter(r => /\|/.test(r) && !/^\s*\|[\s:|-]+\|\s*$/.test(r));
  if (rauw.length < 2) return null;
  const kop = cellen(rauw[0]);
  const dobbel = dobbelUitKop(kop[0]);
  if (!dobbel) return null;

  const entries = [];
  for (const rij of rauw.slice(1)) {
    const c = cellen(rij);
    const bereik = String(c[0] || '').replace(/\s/g, '');
    if (!/^\d+([-–—]\d+)?$/.test(bereik)) continue;
    // Een streepje in een cel betekent "niets" — dat is geen tekst om mee te
    // nemen, anders leest de uitslag als "Helder — —".
    const tekst = c.slice(1).filter(x => x && !/^[-–—]+$/.test(x)).join(' — ');
    if (!tekst) continue;
    entries.push(`${bereik.replace(/[–—]/g, '-')}: ${tekst}`);
  }
  if (!entries.length) return null;

  return {
    name: naam || (kop[1] || '').trim() || 'Tabel uit een akte',
    type: 'weighted',
    dobbel,
    entries,
  };
}

window.tafels = { rol, alsTekst, uitMarkdown, dobbelUitKop };
