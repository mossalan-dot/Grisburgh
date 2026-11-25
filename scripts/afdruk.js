#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  PRINTEN EN DE PAGINA'S TELLEN
// ════════════════════════════════════════════════════════════════════════════
// Het printbare character sheet pagineert **zichzelf**: `mdBlok()` schat per
// tekstblok de hoogte en `pakInBladen()` verdeelt de blokken, zodat de voettekst
// "blad X van Y" klopt. Die schatting kan ernaast zitten — en dan liegt de
// voettekst, of breekt de browser er een pagina bij die niemand verwacht.
//
// De controle die `docs/testronde.md` daarvoor noemt is: print naar pdf en
// vergelijk het aantal fysieke pagina's met het laatste "blad X van Y". Dat
// deed je met de hand; dit script doet het.
//
//   DM_WW='…' node scripts/afdruk.js <url> <uit.pdf>
//
// Het meldt per personage wat de voettekst belooft, wat de pdf telt, en of dat
// klopt. Een verschil is geen ramp maar wél een bug: de stapel die je uitdeelt
// is dan niet te sorteren.
const { spawn } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const [url, uit = 'afdruk.pdf'] = process.argv.slice(2);
if (!url) { console.error('Geef een url op (bv. https://grisburgh.nl/api/party/sheets?groep=...).'); process.exit(1); }

const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(p => { try { return fs.existsSync(p); } catch { return false; } });
if (!CHROME) { console.error('Geen Chrome gevonden. Zet CHROME=/pad/naar/chrome.'); process.exit(1); }

const profiel = fs.mkdtempSync(path.join(os.tmpdir(), 'afdruk-'));
const poort = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${poort}`, `--user-data-dir=${profiel}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
  'about:blank',
], { stdio: 'ignore' });

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

async function versie() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${poort}/json/version`); if (r.ok) return r.json(); }
    catch { /* nog niet op */ }
    await wacht(200);
  }
  throw new Error('Chrome kwam niet op');
}

(async () => {
  const v = await versie();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let n = 0; const open = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && open.has(m.id)) { open.get(m.id)(m); open.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const stuur = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++n;
    open.set(id, (m) => m.error ? rej(new Error(m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { targetInfos } = await stuur('Target.getTargets');
  const doel = targetInfos.find(t => t.type === 'page');
  const { sessionId } = await stuur('Target.attachToTarget', { targetId: doel.targetId, flatten: true });
  const S = (m, p) => stuur(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable');

  // **De campagne staat in de querystring, niet in het pad.** Een sheet-url
  // begint met `/api/…`, dus het eerste padstuk is "api" — daarmee logde de
  // eerste versie in op een campagne die niet bestaat, en kreeg je een lege
  // pagina zonder dat iets klaagde.
  const u = new URL(url);
  const campagne = u.searchParams.get('campagne') || u.pathname.split('/')[1] || 'grisburgh';
  await S('Page.navigate', { url: `${u.origin}/${campagne}` });
  await wacht(2500);

  // Inloggen als DM: het sheet is DM-only.
  const ww = process.env.DM_WW;
  if (ww) {
    await S('Runtime.evaluate', { expression: `(async () => {
      const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campagne: ${JSON.stringify(campagne)}, password: ${JSON.stringify(ww)} }) });
      return r.status; })()`, awaitPromise: true, returnByValue: true });
  }

  await S('Page.navigate', { url });
  await wacht(3500);

  // Wat de voettekst zelf belooft, per personage.
  const beloofd = (await S('Runtime.evaluate', {
    expression: `(() => {
      const t = document.body.innerText;
      const alle = [...t.matchAll(/blad\\s+(\\d+)\\s+van\\s+(\\d+)/gi)].map(m => [Number(m[1]), Number(m[2])]);
      const namen = [...document.querySelectorAll('.sheet-foot, .blad-voet, footer')].map(e => e.textContent.trim()).slice(0, 3);
      return JSON.stringify({ aantal: alle.length, som: alle.filter(([x, y]) => x === y).reduce((t2, [, y]) => t2 + y, 0),
        laatsten: alle.filter(([x, y]) => x === y), voorbeeld: namen });
    })()`, returnByValue: true,
  })).result.value;
  const b = JSON.parse(beloofd);

  const pdf = await S('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });
  fs.writeFileSync(uit, Buffer.from(pdf.data, 'base64'));
  const rauw = fs.readFileSync(uit, 'latin1');
  const fysiek = (rauw.match(/\/Type\s*\/Page[^s]/g) || []).length;

  console.log(`\nafdruk: ${uit}`);
  console.log(`  voetteksten gevonden : ${b.aantal}`);
  console.log(`  bladen volgens de app: ${b.som}   (${b.laatsten.map(([, y]) => y).join(' + ') || '—'})`);
  console.log(`  pagina's in de pdf   : ${fysiek}`);
  console.log(b.som === fysiek
    ? '  → de voettekst klopt met de afdruk ✓'
    : `  → VERSCHIL van ${Math.abs(b.som - fysiek)}: "blad X van Y" liegt, of de browser breekt er een pagina bij`);

  ws.close(); chrome.kill();
  // Chrome ruimt zijn profiel niet meteen op; dat hoeft ook niet, het staat in
  // de tijdelijke map. Een mislukte opruiming mag de uitslag niet overstemmen.
  try { fs.rmSync(profiel, { recursive: true, force: true, maxRetries: 3 }); } catch { /* laat staan */ }
  process.exit(0);
})().catch(e => { console.error('fout:', e.message); chrome.kill(); process.exit(1); });
