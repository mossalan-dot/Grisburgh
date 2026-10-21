#!/usr/bin/env node
// Een pagina openen met Chrome, inloggen als DM, een stukje JS draaien en een
// foto maken. Praat rechtstreeks met het Chrome DevTools Protocol over een
// websocket — geen puppeteer, want die staat hier niet en hoeft ook niet voor
// de vier commando's die we nodig hebben.
//
// **Waarvoor dit bestaat.** Een uitrol zegt dat de bestanden er staan, niet dat
// het scherm klopt. Dit opent de echte pagina op productie, logt in als DM en
// leest terug wat er staat — het verschil tussen "gedeployed" en "het werkt".
//
//   DM_WW='…' node scripts/kijkfout.js <url> <foto.png> '<js>' [breedte] [hoogte]
//
// Het JS-stuk wordt als **expressie** geëvalueerd, dus een losse `return` kan
// niet; schrijf een async IIFE:
//
//   node scripts/kijkfout.js https://grisburgh.nl/grisburgh uit.png \
//     "(async()=>{ await new Promise(r=>setTimeout(r,4000)); return document.title; })()"
//
// `TYP=abc` typt daarna die tekens met het toetsenbord van de browser zelf, en
// leest `window.__naTypen()` uit als je die hebt gezet.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [url, foto, js, breedte = '1500', hoogte = '1000'] = process.argv.slice(2);
if (!url) { console.error('Geef een url op.'); process.exit(1); }

// Waar Chrome staat verschilt per machine: op de Mac in /Applications, op de
// server als chromium uit apt. `CHROME=/pad/naar/chrome` overrulet allebei.
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(p => { try { return require('fs').existsSync(p); } catch { return false; } });
if (!CHROME) {
  console.error('Geen Chrome of Chromium gevonden. Zet CHROME=/pad/naar/chrome, of: apt install chromium');
  process.exit(1);
}
const profiel = fs.mkdtempSync(path.join(os.tmpdir(), 'kijkfout-'));
const poort = 9300 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${poort}`, `--user-data-dir=${profiel}`,
  `--window-size=${breedte},${hoogte}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars',
  // Op de server draait dit als root en zonder desktop; dan weigert Chrome te
  // starten zonder deze twee.
  ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
  'about:blank',
], { stdio: 'ignore' });

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

async function versie() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${poort}/json/version`);
      if (r.ok) return r.json();
    } catch { /* nog niet op */ }
    await wacht(200);
  }
  throw new Error('Chrome kwam niet op');
}

(async () => {
  const v = await versie();
  const WebSocket = (await import('node:http')).default && globalThis.WebSocket;
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  let n = 0;
  const open = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && open.has(m.id)) { open.get(m.id)(m); open.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      if (t) console.log('console:', t.slice(0, 300));
    }
  });
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  const stuur = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++n;
    open.set(id, (m) => m.error ? rej(new Error(m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  // Eén tabblad, en daar praten we mee via een sessie.
  const { targetInfos } = await stuur('Target.getTargets');
  const doel = targetInfos.find(t => t.type === 'page');
  const { sessionId } = await stuur('Target.attachToTarget', { targetId: doel.targetId, flatten: true });
  const S = (method, params) => stuur(method, params, sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');

  const ga = async (adres) => {
    await S('Page.navigate', { url: adres });
    await wacht(2500);
  };
  const draai = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'fout in de pagina');
    return r.result?.value;
  };

  await ga(url);

  // Inloggen als DM op de landingspagina, als er een wachtwoordveld staat.
  const ww = process.env.DM_WW;
  if (ww) {
    const campagne = new URL(url).pathname.replace(/^\/|\/$/g, '') || 'grisburgh';
    await draai(`(async () => {
      const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campagne: ${JSON.stringify(campagne)}, password: ${JSON.stringify(ww)} }) });
      return r.status;
    })()`);
    await ga(url);
    await wacht(1500);
  }

  if (js) {
    try {
      const uit = await draai(js);
      console.log('JS:', typeof uit === 'string' ? uit : JSON.stringify(uit));
    } catch (e) { console.log('JS-FOUT:', e.message.split('\n')[0]); }
  }

  // Echt typen, via het toetsenbord van de browser zelf. Een `input`-event
  // nabootsen slaat precies over wat hier kapot kan zijn: de standaardactie van
  // een toetsaanslag.
  const typToets = process.env.TYP;
  if (typToets) {
    for (const teken of typToets) {
      await S('Input.dispatchKeyEvent', { type: 'keyDown', text: teken, key: teken,
        unmodifiedText: teken, windowsVirtualKeyCode: teken.toUpperCase().charCodeAt(0) });
      await S('Input.dispatchKeyEvent', { type: 'keyUp', key: teken,
        windowsVirtualKeyCode: teken.toUpperCase().charCodeAt(0) });
      await wacht(250);
    }
  }

  if (typToets) {
    try {
      const na = await draai('window.__naTypen ? JSON.stringify(window.__naTypen()) : null');
      if (na) console.log('NA TYPEN:', na);
    } catch (e) { console.log('NA TYPEN mislukt:', e.message); }
  }

  if (foto) {
    const { data } = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(foto, Buffer.from(data, 'base64'));
    console.log('foto:', path.basename(foto));
  }

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch(e => { console.error('FOUT:', e.message); chrome.kill(); process.exit(1); });
