#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  DE APP OP EEN TELEFOON BEKIJKEN
// ════════════════════════════════════════════════════════════════════════════
// Een iPhone in headless Chrome: de echte schermmaat, de echte pixeldichtheid,
// aanraakbediening en de user-agent van Safari. Geen simulator nodig; wat hier
// uitkomt is wat je op het toestel ziet, op de Safari-balken na.
//
// Het doet twee dingen per scherm:
//   • een foto, zodat je het kunt zien
//   • een meting van alles wat **buiten het scherm valt** — want de pagina
//     scrolt niet horizontaal, dus wat eruit loopt is simpelweg weg. Precies
//     zo verdween Charisma van de ability scores.
//
//   npm run telefoon                      # alle schermen, als DM
//   node scripts/telefoon.js --volledig    # de hele pagina i.p.v. alleen het scherm
//   node scripts/telefoon.js --liggend     # gedraaid (breedte en hoogte verwisseld)
//   node scripts/telefoon.js --speler      # als speler (SPELER + SPELER_WW)
//   node scripts/telefoon.js --toestel "iPhone SE" --tab spreukenboek
//
// Omgeving: DM_WW (DM-wachtwoord), of SPELER (characterId) + SPELER_WW.
// URL via --url, standaard http://localhost:3000.

const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Breedte × hoogte in CSS-punten, en de pixeldichtheid. De kleinste en de
// grootste die er nog toe doen, plus de twee waar de meeste mensen op zitten.
const TOESTELLEN = [
  { naam: 'iPhone SE',        b: 375, h: 667, dpr: 2 },
  { naam: 'iPhone 13 mini',   b: 375, h: 812, dpr: 3 },
  { naam: 'iPhone 15',        b: 393, h: 852, dpr: 3 },
  { naam: 'iPhone 15 Pro Max', b: 430, h: 932, dpr: 3 },
  { naam: 'iPad mini',        b: 744, h: 1133, dpr: 2 },
];
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
                + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const arg = (naam, val) => {
  const i = process.argv.indexOf('--' + naam);
  return i >= 0 ? (val === false ? true : process.argv[i + 1]) : null;
};
const url      = arg('url') || 'http://localhost:3000/?campagne=' + (process.env.CAMPAGNE || 'grisburgh');
const alsSpeler = !!arg('speler', false) || !!process.env.SPELER;
const tab      = arg('tab') || 'personage';
const alleen   = arg('toestel');
const uitMap   = arg('uit') || path.join(os.tmpdir(), 'grisburgh-telefoon');
const heelPagina = !!arg('volledig', false);
// Gedraaid kijken: dezelfde toestellen, breedte en hoogte verwisseld. Sommige
// schermen hebben een eigen opmaak rechtop (het spreukenboek zet zijn twee
// bladzijden dan onder elkaar), dus allebei nalopen is de enige manier om te
// weten of ze het allebei doen.
const liggend  = !!arg('liggend', false);
const poort    = 9345;

fs.mkdirSync(uitMap, { recursive: true });
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${poort}`,
   '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-')), 'about:blank'],
  { stdio: 'ignore' });

(async () => {
  let doel = null;
  for (let i = 0; i < 40 && !doel; i++) {
    await wacht(250);
    try { doel = (await (await fetch(`http://127.0.0.1:${poort}/json/list`)).json()).find(t => t.type === 'page'); } catch { /* nog niet op */ }
  }
  if (!doel) { console.error('Chrome komt niet op.'); process.exit(1); }

  const ws = new WebSocket(doel.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  let id = 0; const open = new Map();
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && open.has(m.id)) { open.get(m.id)(m.result); open.delete(m.id); } });
  const stuur = (method, params = {}) => new Promise(res => { const mid = ++id; open.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  await new Promise(r => ws.on('open', r));
  await stuur('Page.enable'); await stuur('Runtime.enable');
  await stuur('Network.setUserAgentOverride', { userAgent: UA_IPHONE, platform: 'iPhone' });
  await stuur('Emulation.setTouchEmulation', { enabled: true, maxTouchPoints: 5 });

  // Inloggen, één keer; de sessiecookie blijft staan tussen de schermen door.
  await stuur('Page.navigate', { url }); await wacht(2500);
  if (alsSpeler && process.env.SPELER) {
    const sp = JSON.stringify(process.env.SPELER), ww = JSON.stringify(process.env.SPELER_WW || '');
    await stuur('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression:
      `fetch('/api/auth/player-login',{method:'POST',headers:{'Content-Type':'application/json'},`
      + `body:JSON.stringify({campagne:(new URLSearchParams(location.search)).get('campagne')||'grisburgh',characterId:${sp},password:${ww}})}).then(r=>r.text())` });
  } else if (process.env.DM_WW) {
    const ww = JSON.stringify(process.env.DM_WW);
    await stuur('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression:
      `fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},`
      + `body:JSON.stringify({campagne:(new URLSearchParams(location.search)).get('campagne')||'grisburgh',password:${ww}})})` });
  }

  // Twee soorten ellende, en ze zien er anders uit.
  //
  // **Afgesneden**: een element begint binnen het scherm en loopt eroverheen.
  // Dat is wat je kwijtraakt, want de pagina scrolt niet horizontaal. Een
  // paneel dat helemaal buiten beeld geparkeerd staat (het dobbelpaneel schuift
  // van rechts in) telt dus niet mee — dat hoort daar.
  //
  // **Bedekt**: een vastgezette knop ligt boven iets waar je op moet kunnen
  // tikken. Daar kom je pas achter als je het probeert.
  const METING = `(() => {
    const vw = document.documentElement.clientWidth;
    const naam = (el) => ((el.className && el.className.toString && el.className.toString()) || el.tagName).slice(0, 48);
    const zichtbaar = (el) => !el.checkVisibility || el.checkVisibility({ visibilityProperty: true, opacityProperty: true });

    // **Wat je er werkelijk van ziet.** Een element kan ver buiten zijn ouder
    // steken en toch onzichtbaar zijn: het spreukenboek heeft overflow:hidden,
    // dus het dichtgeschoven zijpaneel staat geometrisch naast het boek maar
    // visueel nergens. Zonder deze stap meldt de controle dat als "afgesneden"
    // en kijk je een halve avond naar iets dat niet stuk is.
    const zichtRect = (el) => {
      let r = el.getBoundingClientRect();
      let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
        const q = p.getBoundingClientRect();
        box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top),
                r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) };
        if (box.r <= box.l || box.b <= box.t) return null;
      }
      return box;
    };

    // **Afgesneden**: een element begint binnen het scherm en loopt eroverheen.
    // De pagina scrolt niet horizontaal, dus wat eruit steekt is weg. Een
    // paneel dat helemaal buiten beeld geparkeerd staat telt niet mee.
    const afgesneden = [];
    document.querySelectorAll('body *').forEach(el => {
      if (!zichtbaar(el)) return;
      const b = zichtRect(el);
      if (!b || b.r - b.l < 1 || b.b - b.t < 1) return;
      const steekt = (b.r > vw + 1 && b.l < vw - 1) || (b.l < -1 && b.r > 1);
      if (!steekt) return;
      if ([...el.children].some(k => { const q = zichtRect(k);
        return q && ((q.r > vw + 1 && q.l < vw - 1) || (q.l < -1 && q.r > 1)); })) return;
      afgesneden.push(naam(el) + ' (' + Math.round(b.l) + '→' + Math.round(b.r) + ')');
    });

    // **Bedekt**: een vastgezette knop ligt boven iets waar je op moet tikken.
    const bedekt = [];
    document.querySelectorAll('body *').forEach(el => {
      if (getComputedStyle(el).position !== 'fixed' || !zichtbaar(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.width > 120) return;
      const punten = [[r.left + 3, r.top + r.height / 2], [r.left + r.width / 2, r.top + 3]];
      for (const [x, y] of punten) {
        const onder = document.elementsFromPoint(x, y).find(k => !el.contains(k)
          && k.matches('button, a, input, select, textarea, [onclick]'));
        if (onder) { bedekt.push(naam(el) + ' ligt op ' + naam(onder)); break; }
      }
    });

    return { vw, scroll: document.documentElement.scrollWidth,
             buiten: [...new Set(afgesneden)], bedekt: [...new Set(bedekt)] };
  })()`;

  let problemen = 0;
  for (const t of TOESTELLEN) {
    if (alleen && !t.naam.toLowerCase().includes(String(alleen).toLowerCase())) continue;
    const [bw, bh] = liggend ? [t.h, t.b] : [t.b, t.h];
    await stuur('Emulation.setDeviceMetricsOverride',
      { width: bw, height: bh, deviceScaleFactor: t.dpr, mobile: true });
    await stuur('Page.navigate', { url }); await wacht(3200);
    await stuur('Runtime.evaluate', { awaitPromise: true, returnByValue: true,
      expression: `(async()=>{window._setPlayerSubTab&&window._setPlayerSubTab(${JSON.stringify(tab)});`
                + `await new Promise(r=>setTimeout(r,1800));})()` });

    const m = (await stuur('Runtime.evaluate', { expression: METING, returnByValue: true }))?.result?.value || {};
    // **Alleen het scherm, niet de hele pagina.** Met `captureBeyondViewport`
    // tekent Chrome vastgezette elementen op hun plek in het document in plaats
    // van in beeld — dan staat het dobbeltabje op de foto ergens onderaan
    // terwijl het in werkelijkheid middenin je scherm hangt, en klopt de foto
    // niet meer met de meting. Wil je de hele pagina: --volledig.
    const bestand = path.join(uitMap, t.naam.replace(/\s+/g, '-').toLowerCase() + (liggend ? '-liggend' : '') + '.png');
    const foto = await stuur('Page.captureScreenshot', { format: 'png', captureBeyondViewport: heelPagina });
    fs.writeFileSync(bestand, Buffer.from(foto.data, 'base64'));

    const buiten = m.buiten || [], bedekt = m.bedekt || [];
    problemen += buiten.length + bedekt.length;
    console.log(`\n${t.naam}  ${bw}×${bh} @${t.dpr}x${liggend ? ' (liggend)' : ''}`);
    console.log(`  foto: ${bestand}`);
    if (m.scroll > m.vw) console.log(`  ⚠ de pagina is ${m.scroll - m.vw}px breder dan het scherm`);
    if (!buiten.length && !bedekt.length) console.log('  ✓ alles past en niets ligt in de weg');
    buiten.slice(0, 10).forEach(x => console.log('  ⚠ afgesneden: ' + x));
    if (buiten.length > 10) console.log(`  … en nog ${buiten.length - 10}`);
    bedekt.forEach(x => console.log('  ⚠ bedekt: ' + x));
  }

  console.log(problemen ? `\n${problemen} dingen vallen buiten beeld.` : '\nAlles past op elk scherm.');
  ws.close(); chrome.kill();
  process.exit(problemen ? 1 : 0);
})();
