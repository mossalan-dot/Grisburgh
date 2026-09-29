#!/usr/bin/env node
// ── Factieleden verhuizen naar het organisatiekaartje ───────────────────────
// "Wie hoort hierbij" stond op twee plekken: de **betrokkenen** op het
// organisatiekaartje (die het organogram tekenen) en de **leden** van de
// factie (die de rangladder vullen). De betrokkenenlijst is leidend; de
// ledenlijst stamt uit de tijd dat die mechaniek er nog niet was.
//
// Dit script zet elk factielid als betrokkene op zijn organisatiekaartje, en
// bewaart zijn factierang apart (`meta.facties[].ledenRang`) — want een rang
// is iets anders dan een rol: de rol zegt wat je doet, de rang hoe hoog je
// staat.
//
//   node scripts/factie-leden-naar-kaartje.js [campagne] [--droog]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'data', 'campaigns');
const args = process.argv.slice(2);
const droog = args.includes('--droog');
const alleen = args.find(a => !a.startsWith('--'));

const lees = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const schrijf = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

for (const camp of fs.readdirSync(ROOT)) {
  if (alleen && camp !== alleen) continue;
  const dir = path.join(ROOT, camp);
  if (!fs.statSync(dir).isDirectory()) continue;
  const metaPad = path.join(dir, 'meta.json');
  const entPad  = path.join(dir, 'entities.json');
  if (!fs.existsSync(metaPad) || !fs.existsSync(entPad)) continue;

  const meta = lees(metaPad);
  const ent  = lees(entPad);
  const facties = meta.facties || [];
  if (!facties.length) { console.log(`${camp}: geen facties`); continue; }

  let verhuisd = 0, zonderKaart = 0;
  for (const f of facties) {
    const leden = f.leden || [];
    if (!leden.length) continue;
    const org = (ent.organisaties || []).find(o => o.id === f.entityId);
    if (!org) { zonderKaart++; continue; }

    if (!org.data) org.data = {};
    let betr = org.data.betrokkenen;
    if (typeof betr === 'string') { try { betr = JSON.parse(betr); } catch { betr = []; } }
    if (!Array.isArray(betr)) betr = [];

    // De rang blijft bij de factie: een rol zegt wat je doet, een rang hoe
    // hoog je staat. Ze op één veld persen zou het organogram vervuilen.
    const rangen = { ...(f.ledenRang || {}) };
    for (const l of leden) {
      const p = (ent.personages || []).find(x => x.id === l.entityId);
      if (!p) continue;
      if (l.rang) rangen[l.entityId] = l.rang;
      if (betr.some(r => r && (r.id === l.entityId || (r.naam || '').toLowerCase() === (p.name || '').toLowerCase()))) continue;
      betr.push({ id: p.id, naam: p.name, rol: p.data?.rol || '', chef: '' });
      verhuisd++;
    }
    org.data.betrokkenen = betr;
    f.ledenRang = rangen;
    delete f.leden;          // het kaartje is voortaan de bron
  }

  console.log(`${camp}: ${verhuisd} naar een kaartje verhuisd${zonderKaart ? `, ${zonderKaart} factie(s) zonder organisatiekaartje overgeslagen` : ''}`);
  if (!droog && verhuisd) {
    fs.copyFileSync(metaPad, metaPad + '.voor-factieleden.bak');
    fs.copyFileSync(entPad,  entPad  + '.voor-factieleden.bak');
    schrijf(metaPad, meta);
    schrijf(entPad, ent);
  }
}
