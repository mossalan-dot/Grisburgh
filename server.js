const express    = require('express');
const compression = require('compression');
const session    = require('express-session');
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

// Session middleware extracted so it can be shared with socket.io
const sessionMiddleware = session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
});
app.use(sessionMiddleware);

// ── Per-request campaign scoping ──
// When session.campaignId is set (e.g. sandbox), run all storage operations in
// that campaign's directory via AsyncLocalStorage. No changes needed in api.js.
app.use((req, res, next) => {
  const cid = req.session?.campaignId;
  if (cid) return storage.runInCampaign(cid, next);
  next();
});

// Static files
// — HTML nooit cachen (bevat versie-querystrings die cache busten)
// — JS/CSS wél cachen (1 uur): versie-querystring (?v=xx) zorgt voor automatische invalidatie
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-store');
    } else if (ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 uur voor afbeeldingen e.d.
    }
  },
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api', apiRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  // Relay player emote trigger — only to sockets in the same campaign room
  socket.on('sound:emote', (data) => {
    socket.to(campaignId).emit('sound:emote', data);
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
