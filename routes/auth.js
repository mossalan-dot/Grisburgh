const express = require('express');
const config  = require('../config');
const storage = require('../lib/storage');

const router = express.Router();

// ── DM login / logout ──

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === config.dmPassword) {
    req.session.role = 'dm';
    return res.json({ role: 'dm' });
  }
  res.status(401).json({ error: 'Verkeerd wachtwoord' });
});

router.post('/logout', (req, res) => {
  req.session.role = 'player';
  delete req.session.playerName;
  delete req.session.characterId;
  res.json({ role: 'player' });
});

// ── Rol ophalen (DM én speler) ──

router.get('/role', (req, res) => {
  res.json({
    role:        req.session.role        || 'player',
    playerName:  req.session.playerName  || null,
    characterId: req.session.characterId || null,
  });
});

// ── Spelerkarakters ophalen (voor de kiezer) ──

router.get('/players', (req, res) => {
  try {
    const entities = storage.readJSON('entities.json');
    const spelers = (entities.personages || [])
      .filter(e => e.subtype === 'speler')
      .map(e => ({
        id:     e.id,
        name:   e.name,
        ras:    e.data?.ras    || '',
        klasse: e.data?.klasse || '',
      }));
    res.json(spelers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Speler-login: kies karakter op basis van ID ──

router.post('/player-login', (req, res) => {
  try {
    const { characterId } = req.body;
    if (!characterId) return res.status(400).json({ error: 'Geen karakter opgegeven' });
    const entities  = storage.readJSON('entities.json');
    const character = (entities.personages || []).find(
      e => e.id === characterId && e.subtype === 'speler'
    );
    if (!character) return res.status(404).json({ error: 'Karakter niet gevonden' });
    req.session.playerName  = character.name;
    req.session.characterId = character.id;
    // Stuur socket-event zodat DM een melding krijgt
    req.app.get('io').emit('player:joined', {
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
    req.app.get('io').emit('player:left', { playerName: name });
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
