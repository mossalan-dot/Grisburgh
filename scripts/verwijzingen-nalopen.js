#!/usr/bin/env node
// **Wijst alles nog ergens heen?** Een id dat nergens meer bestaat doet niets
// en zegt niets: de knop verschijnt niet, de rij valt weg, de koppeling is
// stil verdwenen. Deze scan loopt de verwijzingen tussen kaartjes, gevechten,
// vondsten en missies langs en meldt wat in het niets wijst.
//
// Twee soorten verwijzing, en ze werken niet hetzelfde:
//  - een **id** (`betrokkenen[].id`, `winkelLocatieId`, `entityId` in een
//    voorraadregel of een vondst) wijst hard naar één kaartje;
//  - een **naam** (`links`, het veld *Gebied*) wordt op naam opgelost, en een
//    naam zonder kaartje is in deze app geen fout: hij krijgt een plus om hem
//    ter plekke aan te maken.
// De scan meldt ze allebei, maar apart — anders verzuipt het ene in het andere.
//
//   node scripts/verwijzingen-nalopen.js <pad naar de campagnemap>
//   node scripts/verwijzingen-nalopen.js /var/www/grisburgh/data/campaigns/grisburgh
const fs = require('fs');
const D = process.argv[2] || '.';
const lees = (n) => { try { return JSON.parse(fs.readFileSync(`${D}/${n}`, 'utf8')); } catch { return null; } };

const e = lees('entities.json') || {};
const ids = new Set();
const naam = new Map();
const bestaandeNamen = new Set();
for (const t of Object.keys(e)) for (const x of (e[t] || [])) { ids.add(x.id); naam.set(x.id, `${t}: ${x.name}`); bestaandeNamen.add(String(x.name||'').trim().toLowerCase()); }

const mis = [];
let gecheckt = 0;
const kijk = (waar, id, soort = 'kaartje') => {
  const s = String(id || '').trim();
  if (!s) return;
  gecheckt++;
  if (soort === 'kaartje' && !ids.has(s)) mis.push([waar, s]);
};

// ── betrokkenen, chefs en winkels ──
for (const t of Object.keys(e)) for (const x of (e[t] || [])) {
  let b = x.data?.betrokkenen;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = []; } }
  for (const r of (Array.isArray(b) ? b : [])) {
    kijk(`${t}: ${x.name} · betrokkene "${r.naam || ''}"`, r.id);
    if (r.geheim?.id) kijk(`${t}: ${x.name} · geheime verbinding`, r.geheim.id);
  }
  kijk(`${t}: ${x.name} · winkelLocatieId`, x.data?.winkelLocatieId);
  // `wijk` (het veld *Gebied*) wijst net als `links` met een **naam** naar een
  // andere locatie — de keten wordt op naam gelopen (`_gebiedKeten`).
  const w = String(x.data?.wijk || '').trim();
  if (w) { gecheckt++; if (!bestaandeNamen.has(w.toLowerCase())) mis.push([`${t}: ${x.name} · Gebied (naam)`, w]); }
  kijk(`${t}: ${x.name} · groep`, x.data?.groep, 'groep');
  let vr = x.data?.voorraad;
  if (typeof vr === 'string') { try { vr = JSON.parse(vr); } catch { vr = []; } }
  for (const rij of (Array.isArray(vr) ? vr : [])) kijk(`${t}: ${x.name} · voorraad "${rij.naam || rij.name || ''}"`, rij.entityId);
  // `links` bewaart **namen**, geen ids (ze worden op naam opgelost, zie
  // `_linksMetTekst`), dus die horen niet in deze scan.
  for (const [k, v] of Object.entries(x.links || {})) {
    for (const n of (Array.isArray(v) ? v : [])) {
      const s = String(n || '').trim();
      if (!s) continue;
      gecheckt++;
      if (!bestaandeNamen.has(s.toLowerCase())) mis.push([`${t}: ${x.name} · links.${k} (naam)`, s]);
    }
  }
}

// ── encounters, vondsten, missies ──
const enc = lees('encounters.json');
for (const c of (enc?.encounters || [])) {
  for (const r of (c.monsters || c.rows || [])) kijk(`encounter "${c.name}" · regel`, r.entityId);
  kijk(`encounter "${c.name}" · lootId`, c.lootId, 'loot');
}
const loot = lees('loot.json');
for (const v of (loot?.events || [])) {
  for (const it of (v.items || [])) kijk(`vondst "${v.naam || v.name}" · voorwerp "${it.naam || ''}"`, it.entityId);
  kijk(`vondst "${v.naam || v.name}" · mimicEncounterId`, v.mimicEncounterId, 'encounter');
}
const q = lees('quests.json');
for (const m of (q?.quests || q || [])) kijk(`missie "${m.title || m.naam}" · gever`, m.geverId);

console.log(`${gecheckt} verwijzingen nagelopen · ${mis.length} wijzen nergens heen`);
for (const [waar, id] of mis) console.log(`  ${waar} → ${id}`);
