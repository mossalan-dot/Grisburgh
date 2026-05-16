const express = require('express');
const config  = require('../config');
const storage = require('../lib/storage');

const router = express.Router();

// Helper: emit to the correct campaign room
const _emit = (req, ...args) => req.app.get('io').to(req.session?.campaignId || 'main').emit(...args);

// ── DM login / logout ──

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === config.dmPassword) {
    req.session.role = 'dm';
    delete req.session.campaignId; // real campaign = no override
    return res.json({ role: 'dm', isSandbox: false });
  }
  res.status(401).json({ error: 'Verkeerd wachtwoord' });
});

// ── Tablet login ──
// Alleen wachtwoordcontrole — geen sessierol-wijziging.
router.post('/tablet-login', (req, res) => {
  const { password } = req.body;
  if (password === config.tabletPassword) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Verkeerd wachtwoord' });
});

// ── Sandbox login ──
// Logs in as DM but scopes all data to the sandbox campaign directory.
// Sandbox password is empty by default (no password required).

router.post('/sandbox-login', (req, res) => {
  const { password } = req.body;
  const required = config.sandboxPassword;
  if (required && password !== required) {
    return res.status(401).json({ error: 'Verkeerd wachtwoord' });
  }
  req.session.role       = 'dm';
  req.session.campaignId = 'sandbox';
  res.json({ role: 'dm', isSandbox: true });
});

router.post('/logout', (req, res) => {
  req.session.role = 'player';
  delete req.session.playerName;
  delete req.session.characterId;
  delete req.session.campaignId;
  res.json({ role: 'player' });
});

// ── Rol ophalen (DM én speler) ──

router.get('/role', (req, res) => {
  res.json({
    role:        req.session.role        || 'player',
    playerName:  req.session.playerName  || null,
    characterId: req.session.characterId || null,
    isSandbox:   req.session.campaignId  === 'sandbox',
  });
});

// ── Spelerkarakters ophalen (voor de kiezer) ──

router.get('/players', (req, res) => {
  try {
    const entities = storage.readJSON('entities.json');
    const dmState  = storage.readJSON('dm-state.json');
    const groups   = dmState.groups || {};
    const spelers = (entities.personages || [])
      .filter(e => {
        if ((e.subtype || '').toLowerCase() !== 'speler') return false;
        if (e.data?.testOnly && req.session.role !== 'dm') return false;  // verberg testpersonages voor spelers
        const groep = groups[e.data?.groep];
        if (groep?.hidden && req.session.role !== 'dm') return false;  // verberg verborgen groepen voor spelers, niet voor DM
        return true;
      })
      .map(e => {
        const groepId = e.data?.groep || null;
        const groep   = groepId ? groups[groepId] : null;
        return {
          id:               e.id,
          name:             e.name,
          ras:              e.data?.ras             || '',
          klasse:           e.data?.klasse          || '',
          groep:            groepId,
          groepNaam:        groep?.name             || null,
          groepHasPassword: !!groep?.password,
          portraitVideoId:  e.data?.portraitVideoId || null,
        };
      });
    res.json(spelers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Speler-login: kies karakter op basis van ID ──

router.post('/player-login', (req, res) => {
  try {
    const { characterId, password } = req.body;
    if (!characterId) return res.status(400).json({ error: 'Geen karakter opgegeven' });
    const entities = storage.readJSON('entities.json');
    const dmState  = storage.readJSON('dm-state.json');
    const groups   = dmState.groups || {};
    const character = (entities.personages || []).find(
      e => e.id === characterId && e.subtype === 'speler'
    );
    if (!character) return res.status(404).json({ error: 'Karakter niet gevonden' });
    // Controleer groepswachtwoord (alleen als er een is ingesteld)
    const groepId    = character.data?.groep;
    const groepPw    = groepId ? groups[groepId]?.password : null;
    if (groepPw && password !== groepPw) {
      return res.status(401).json({ error: 'Verkeerd wachtwoord' });
    }
    req.session.playerName  = character.name;
    req.session.characterId = character.id;
    _emit(req, 'player:joined', {
      playerName:  character.name,
      characterId: character.id,
    });
    res.json({ playerName: character.name, characterId: character.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Speler-logout: terug naar anoniem ──

router.post('/player-logout', (req, res) => {
  const name = req.session.playerName;
  delete req.session.playerName;
  delete req.session.characterId;
  if (name) {
    _emit(req, 'player:left', { playerName: name });
  }
  res.json({ ok: true });
});

// ── Middleware ──

function requireDM(req, res, next) {
  if (req.session.role === 'dm') return next();
  res.status(403).json({ error: 'DM-only' });
}

function attachRole(req, res, next) {
  req.role        = req.session.role        || 'player';
  req.playerName  = req.session.playerName  || null;
  req.characterId = req.session.characterId || null;
  next();
}

module.exports = { router, requireDM, attachRole };
