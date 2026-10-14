const express    = require('express');
const compression = require('compression');
const session    = require('express-session');
const FileStore  = require('session-file-store')(session);
const fs         = require('fs');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const config     = require('./config');
const storage    = require('./lib/storage');
const fouten     = require('./lib/fouten');
const apiRoutes  = require('./routes/api');
const { router: authRouter } = require('./routes/auth');

// Initialize data files
storage.init();
storage.initSandbox();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(compression()); // gzip alle responses — scheelt 75-80% op JS/CSS
app.use(express.json({ limit: '5mb' }));

// ── Sessie-opslag op schijf ──────────────────────────────────────────────────
// Zonder store houdt express-session alles in het procesgeheugen, en dan logt
// elke herstart iedereen uit — DM, spelers én de tablet. Bij een avond met
// meerdere deploys was dat elke keer opnieuw inloggen aan tafel.
// Een bestandsstore past bij de rest van de opslag (JSON op schijf) en heeft
// geen extra dienst nodig. De map ligt onder de datamap, zodat tests met hun
// eigen GRISBURGH_DATA_DIR vanzelf hun eigen sessies krijgen.
const SESSIE_DIR = path.join(process.env.GRISBURGH_DATA_DIR || path.join(__dirname, 'data'), 'sessions');
const SESSIE_TTL = 60 * 60 * 24 * 30;   // 30 dagen

// Verlopen bestanden eenmalig opruimen bij het opstarten. Bewust géén reaper met
// een interval: die timer houdt het testproces open, waardoor `npm test` niet
// afsluit.
try {
  fs.mkdirSync(SESSIE_DIR, { recursive: true });
  const grens = Date.now() - SESSIE_TTL * 1000;
  for (const naam of fs.readdirSync(SESSIE_DIR)) {
    const bestand = path.join(SESSIE_DIR, naam);
    try { if (fs.statSync(bestand).mtimeMs < grens) fs.unlinkSync(bestand); } catch { /* ok */ }
  }
} catch { /* opstarten mag hier nooit op stuklopen */ }

// Session middleware extracted so it can be shared with socket.io
const sessionMiddleware = session({
  store: new FileStore({
    path: SESSIE_DIR,
    ttl: SESSIE_TTL,
    reapInterval: -1,        // zie hierboven: geen achtergrondtimer
    retries: 0,              // onbekende sessie-id? meteen door, geen retry-ruis
    logFn: () => {},         // store logt anders bij elke onbekende cookie
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
});
app.use(sessionMiddleware);

// ── Lokale ontwikkeling: automatisch DM, geen login nodig ──
// Alleen actief met DEV_AUTO_DM=1 (gezet door `npm run dev`). Productie draait
// via PM2 zonder die env-var, dus deze bypass is daar uitgeschakeld.
// Zet de rol alleen als die nog niet bestaat, zodat speler-testlogin blijft werken.
if (config.devAutoDM) {
  console.warn('⚠️  DEV_AUTO_DM actief — iedereen is automatisch DM. Niet gebruiken in productie!');
  app.use((req, res, next) => {
    if (!req.session.role) req.session.role = 'dm';
    // Ook de campagne zetten. Zonder dit heeft zo'n sessie wél een rol maar
    // géén campagne: zijn socket belandt in de quarantaine-room 'main' terwijl
    // de server zijn events naar de echte campagne stuurt, en dan komt er
    // lokaal bij niemand iets aan. Dat kost je een halve middag zoeken naar een
    // bug die alleen in de ontwikkelopstelling bestaat.
    if (!req.session.campaignId) req.session.campaignId = storage.getActiveCampaignId();
    next();
  });
}

// ── Per-request campaign scoping ──
// When session.campaignId is set (e.g. sandbox), run all storage operations in
// that campaign's directory via AsyncLocalStorage. No changes needed in api.js.
app.use((req, res, next) => {
  // Volgorde: het verzoek mag zelf een campagne aanwijzen (`?campagne=`, wat de
  // client meestuurt op basis van het pad in de adresbalk); anders die van je
  // sessie; anders de standaardcampagne.
  //
  // Let op waaróm de querystring vóór de sessie gaat: een DM van campagne A die
  // /B opent, hoort B te zien — niet A met B's naam erboven. Dat maakt de
  // querystring niet tot een sleutel: `attachRole` en `requireDM` tellen een
  // sessie alleen mee als die bij díé campagne hoort (zie routes/auth.js), dus
  // wie hier iets anders invult wordt gewoon een bezoeker zonder rol.
  const cid = (storage.campagneBestaat(req.query?.campagne) ? String(req.query.campagne) : null)
    || req.session?.campaignId;
  // Ook los op het verzoek zetten. De AsyncLocalStorage-context hieronder gaat
  // namelijk verloren zodra een middleware de **request-stream** leest (multer
  // doet dat): die stream bestond al vóór deze context, dus zijn events draaien
  // erbuiten. `metUpload()` in routes/api.js zet de context daarna terug, en
  // daarvoor is dit veld nodig.
  if (cid) req.campagneId = cid;
  if (cid) return storage.runInCampaign(cid, next);
  next();
});

// ── Campagne in de URL ───────────────────────────────────────────────────────
// Elke campagne heeft haar eigen pad: /grisburgh, /prewett. Het kale domein
// stuurt door naar de standaardcampagne, zodat bestaande bladwijzers blijven
// werken. De querystring gaat mee (?display=1 voor het tafelscherm).
app.get('/', (req, res, next) => {
  const doel = storage.getActiveCampaignId();
  if (!doel) return next();
  const vraag = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  // Mét querystring blijft het doorsturen: het tafelscherm staat als
  // `?display=1` in een bladwijzer en hoort niet ineens op een keuzepagina te
  // belanden. Zonder querystring krijg je het overzicht van de campagnes.
  if (vraag) return res.redirect(302, `/${doel}${vraag}`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'overzicht.html'));
});

// De PWA-manifest per campagne: naam en startpad volgen de campagne, zodat een
// tweede DM de app onder zijn eigen naam op het beginscherm zet. De iconen zijn
// nog van Grisburgh — eigen beeld per campagne is werk voor later.
// ── App-icoon per campagne ──────────────────────────────────────────────────
//
// De PWA installeerde in elke campagne met het wapen van Grisburgh: naam en
// start_url waren al per campagne, de iconen niet. Die moeten **zonder sessie**
// op te halen zijn — het besturingssysteem haalt ze op tijdens het installeren,
// en dat is geen ingelogde browser — dus dit is een publieke route en geen
// /api-route. Wat eruit komt is hoogstens het plaatje dat de DM zelf als icoon
// heeft aangewezen; staat er niets, dan het meegeleverde wapen.
//
// `meta.appIcon` is een pad op deze server, net als `meta.embleem`: een
// `/api/files/<id>` uit de mediabibliotheek, of een `/img/…` uit public.
const _ICOON_MATEN = new Set([180, 192, 512]);
const _icoonCache = new Map();   // campagne|maat → { mtime, buffer }

function _icoonBron(cid, meta) {
  const pad = String(meta.appIcon || '').trim();
  if (pad.startsWith('/api/files/')) {
    const id = pad.split('/').pop().split('?')[0];
    const f = storage.runInCampaign(cid, () => storage.getFile(id));
    if (f && fs.existsSync(f.path)) return f.path;
  } else if (pad.startsWith('/img/')) {
    // Alleen uit public/img: een willekeurig pad zou een pad-traversal worden.
    const veilig = path.join(__dirname, 'public', 'img', path.basename(pad.split('?')[0]));
    if (fs.existsSync(veilig)) return veilig;
  }
  return null;
}

app.get('/app-icon-:maat.png', async (req, res) => {
  const maat = parseInt(req.params.maat, 10);
  if (!_ICOON_MATEN.has(maat)) return res.status(404).end();
  const standaard = path.join(__dirname, 'public', 'img', `app-icon-${maat}.png`);
  const cid  = _campagneVan(req);
  const bron = _icoonBron(cid, _campagneMeta(req));
  if (!bron) return res.sendFile(standaard);

  try {
    const mtime = fs.statSync(bron).mtimeMs;
    const sleutel = `${cid}|${maat}`;
    const gecachet = _icoonCache.get(sleutel);
    if (gecachet && gecachet.mtime === mtime && gecachet.bron === bron) {
      res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(gecachet.buffer);
    }
    const sharp = require('sharp');
    // `contain` met een doorzichtige rand: een icoon dat niet vierkant is mag
    // niet bijgesneden worden — daar valt juist het wapen van af.
    const buffer = await sharp(bron)
      .resize(maat, maat, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    _icoonCache.set(sleutel, { mtime, bron, buffer });
    res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch {
    res.sendFile(standaard);   // liever het oude wapen dan een gebroken icoon
  }
});

app.get('/manifest.webmanifest', (req, res) => {
  const cid  = _campagneVan(req);
  const meta = _campagneMeta(req);
  let basis = {};
  try { basis = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'manifest.webmanifest'), 'utf8')); } catch {}
  const naam = meta.appTitle || 'Campagne';
  res.type('application/manifest+json').json({
    ...basis,
    name:        naam,
    short_name:  naam,
    description: meta.appSubtitle ? `${naam} — ${meta.appSubtitle}` : `${naam} — campagnebeheer`,
    start_url:   `/${cid}`,
    scope:       `/${cid}`,
    // Per campagne. De parameter moet `campagne` heten: `_campagneVan` kent
    // alleen die naam, en met iets anders viel hij terug op de **actieve**
    // campagne — dan kreeg elke campagne hetzelfde icoon, en niet eens dat van
    // zichzelf. Hij dient meteen als cache-sleutel, zodat twee campagnes op
    // hetzelfde apparaat niet elkaars icoon uit de browsercache trekken.
    icons: [192, 512].map(n => ({
      src: `/app-icon-${n}.png?campagne=${encodeURIComponent(cid)}`,
      sizes: `${n}x${n}`, type: 'image/png', purpose: 'any',
    })),
  });
});

// Static files
// — HTML/JS/CSS nooit cachen: etag+lastModified UIT zodat server nooit 304 teruggeeft.
//   De ?v=xx querystring in index.html zorgt voor cache-busting van JS/CSS.
// — Overige bestanden (afbeeldingen e.d.) wél cachen (24 uur)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 uur voor afbeeldingen e.d.
    }
  },
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api', apiRoutes);

// ── SPA fallback ─────────────────────────────────────────────────────────────
// Nooit cachen, geen ETag. En: de <title> wordt hier al ingevuld met de naam van
// de campagne uit het pad. index.html is één bestand voor alle campagnes, dus
// stond er tot nu toe "Grisburgh" in de tab tot de JS de meta had opgehaald —
// en zo heette ook de bladwijzer die iemand ondertussen maakte.
const SHELL_PAD = path.join(__dirname, 'public', 'index.html');
let _shell = { mtime: 0, html: '' };
function _shellHtml() {
  const mtime = fs.statSync(SHELL_PAD).mtimeMs;
  if (mtime !== _shell.mtime) _shell = { mtime, html: fs.readFileSync(SHELL_PAD, 'utf8') };
  return _shell.html;
}

// Het pad wint: een bezoeker zonder sessie die /prewett opent hoort niet de
// titel van de standaardcampagne te zien.
function _campagneVan(req) {
  const uitPad = req.path.split('/')[1];
  if (storage.campagneBestaat(uitPad)) return uitPad;
  const uitQuery = req.query?.campagne;
  if (storage.campagneBestaat(uitQuery)) return String(uitQuery);
  return req.session?.campaignId || storage.getActiveCampaignId();
}

function _campagneMeta(req) {
  try { return storage.runInCampaign(_campagneVan(req), () => storage.readJSON('meta.json')) || {}; }
  catch { return {}; }
}

// Een pad dat op een bestandsextensie eindigt is nooit een SPA-route. Zonder
// deze uitzondering kreeg een verdwenen `.js` een **200 met HTML** terug — de
// browser weigert dat als module, en omdat er geen netwerkfout is faalt de hele
// module-graaf van app.js stil: `window.app` half geïnitialiseerd, geen enkele
// melding in de console. Precies zo bleef de gerevertte `glossary.js` in juni
// 2026 onopgemerkt: productie had het bestand nog, een verse checkout niet.
// Nu is het een gewone 404 en zie je meteen wélk bestand ontbreekt.
const _BESTANDSPAD = /\.[a-z0-9]{2,5}$/i;

app.get('*', (req, res) => {
  if (_BESTANDSPAD.test(req.path) && req.path !== '/') {
    return res.status(404).type('text/plain').send('Niet gevonden: ' + req.path);
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const cid   = _campagneVan(req);
  const titel = String(_campagneMeta(req).appTitle || 'Campagne')
    .replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const html = _shellHtml()
    .replace(/<title>[^<]*<\/title>/, `<title>${titel}</title>`)
    .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(">)/, `$1${titel}$2`)
    // De manifest krijgt de campagne mee, anders installeert elke campagne zich
    // als "Grisburgh" op het beginscherm.
    .replace('href="/manifest.webmanifest"', `href="/manifest.webmanifest?campagne=${encodeURIComponent(cid)}"`)
    // Dezelfde reden voor de tab- en beginschermiconen: die stonden vast op het
    // wapen van Grisburgh. De route valt terug op precies dat wapen als de
    // campagne geen eigen icoon heeft, dus er verandert niets zolang niemand er
    // een kiest.
    .replace(/href="\/img\/app-icon-(180|192)\.png\?v=\d+"/g,
             (_, n) => `href="/app-icon-${n}.png?campagne=${encodeURIComponent(cid)}"`)
    .replace(/href="\/img\/favicon-32\.png\?v=\d+"/,
             `href="/app-icon-180.png?campagne=${encodeURIComponent(cid)}"`);
  res.type('html').send(html);
});

// ── Wat er omviel ────────────────────────────────────────────────────────────
// Een fout die niemand opvangt eindigde in het pm2-logboek, tussen de scanners
// die `/%c0/` proberen — en daarmee nergens. Hier wordt hij een regel in
// `data/fouten.json`, met de route en de campagne erbij maar zonder de inhoud
// van die campagne, zodat de beheerder hem ziet staan.
//
// Vier stuks moet deze laag staan: Express herkent een middleware met vier
// argumenten als foutafhandelaar, en met drie wordt het stilletjes een gewone
// route die nooit afgaat.
app.use((err, req, res, _next) => {
  // Een pad dat niet te decoderen valt is geen fout van ons maar een scanner.
  // Die hoeven we niet te bewaren; we hebben er al achthonderd kilobyte van.
  const scanner = err instanceof URIError || /Failed to decode param/.test(err?.message || '');
  if (!scanner) {
    try {
      fouten.meld({
        soort: 'server',
        melding: String(err?.message || err).slice(0, 300),
        stack: String(err?.stack || ''),
        waar: `${req.method} ${String(req.path).slice(0, 160)}`,
        rol: req.session?.role === 'dm' ? 'dm' : (req.session?.characterId ? 'speler' : 'bezoeker'),
        campagne: req.session?.campaignId || storage.getActiveCampaignId(),
      });
    } catch { /* het logboek mag het verzoek niet meeslepen */ }
    console.error('[fout]', req.method, req.path, err?.message || err);
  }
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: 'Er ging iets mis' });
});

// Wat helemaal buiten een verzoek omvalt. Niet afsluiten: een DM die midden in
// een akte zit heeft meer aan een app die doorhobbelt dan aan een schone dood.
process.on('unhandledRejection', (reden) => {
  try { fouten.meld({ soort: 'server', melding: 'Onafgehandelde belofte: ' + String(reden?.message || reden).slice(0, 200), stack: String(reden?.stack || ''), waar: 'buiten een verzoek' }); } catch {}
  console.error('[fout] unhandledRejection', reden);
});
process.on('uncaughtException', (err) => {
  try { fouten.meld({ soort: 'server', melding: String(err?.message || err).slice(0, 200), stack: String(err?.stack || ''), waar: 'buiten een verzoek' }); } catch {}
  console.error('[fout] uncaughtException', err);
});

// Track which socket belongs to which characterId (for direct messaging)
const playerSockets = new Map(); // characterId → socketId
app.set('playerSockets', playerSockets);

// Share express session with socket.io so we can scope events per campaign
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Socket.io
io.on('connection', (socket) => {
  // Each socket joins its campaign room: 'main' for real campaign, 'sandbox' for demo
  const campaignId = socket.request.session?.campaignId || 'main';
  socket.join(campaignId);
  console.log(`Client connected: ${socket.id} (room: ${campaignId})`);

  // Player registers their characterId so DM can send direct messages
  socket.on('player:register', (characterId) => {
    if (characterId) {
      playerSockets.set(characterId, socket.id);
    }
  });

  // Het scherm op tafel meldt zich als tafelscherm.
  //
  // De display-events (brief:display, display:tekst, loot:display,
  // levelup:display) gingen naar de hele campagne-room, en alleen een `if` in
  // de client besliste of je ze te zien kreeg. Een speler met de netwerktab
  // open las de verzegelde brief dus voordat het lakzegel brak, en de
  // voorleestekst voordat de DM hem voorlas — terwijl dat scherm er juist is
  // zodat de spelers luisteren in plaats van meelezen.
  //
  // Alleen wie is ingelogd mag zich melden: een bezoeker zonder sessie zit in
  // 'main' en zou anders het tafelscherm van de standaardcampagne kunnen
  // afluisteren.
  socket.on('display:register', () => {
    const sess = socket.request.session;
    if (!sess || (sess.role !== 'dm' && !sess.characterId)) return;
    socket.join('display:' + campaignId);
  });
  socket.on('display:unregister', () => socket.leave('display:' + campaignId));

  // Relay player emote trigger — only to sockets in the same campaign room.
  // #14: entityId is session-authoritatief. Een speler kan alleen namens
  // zichzelf emoten; de DM mag namens elke entiteit; anoniem heeft geen recht.
  socket.on('sound:emote', (data) => {
    const sess = socket.request.session;
    let entityId;
    if (sess?.characterId)      entityId = sess.characterId;   // speler: alleen zichzelf
    else if (sess?.role === 'dm') entityId = data?.entityId;   // DM: elke entiteit
    else return;                                                // anoniem: negeren
    socket.to(campaignId).emit('sound:emote', { ...data, entityId });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up socket registration
    for (const [cid, sid] of playerSockets.entries()) {
      if (sid === socket.id) { playerSockets.delete(cid); break; }
    }
  });
});

// Only auto-listen when run directly (not when required by tests)
if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`\n  \u2694  Grisburgh draait op http://localhost:${config.port}\n`);
  });
}

module.exports = { app, server, io };
