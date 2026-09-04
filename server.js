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
    next();
  });
}

// ── Per-request campaign scoping ──
// When session.campaignId is set (e.g. sandbox), run all storage operations in
// that campaign's directory via AsyncLocalStorage. No changes needed in api.js.
app.use((req, res, next) => {
  // Volgorde: de campagne van je sessie wint; anders mag een verzoek er één
  // aanwijzen met ?campagne= (nodig vóór het inloggen, bijvoorbeeld voor de
  // personagekiezer op de landingspagina); anders de standaardcampagne.
  const cid = req.session?.campaignId
    || (storage.campagneBestaat(req.query?.campagne) ? String(req.query.campagne) : null);
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
  res.redirect(302, `/${doel}${vraag}`);
});

// De PWA-manifest per campagne: naam en startpad volgen de campagne, zodat een
// tweede DM de app onder zijn eigen naam op het beginscherm zet. De iconen zijn
// nog van Grisburgh — eigen beeld per campagne is werk voor later.
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

app.get('*', (req, res) => {
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
    .replace('href="/manifest.webmanifest"', `href="/manifest.webmanifest?campagne=${encodeURIComponent(cid)}"`);
  res.type('html').send(html);
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
