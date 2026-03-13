const express = require('express');
const config = require('../config');

const router = express.Router();

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
  res.json({ role: 'player' });
});

router.get('/role', (req, res) => {
  res.json({ role: req.session.role || 'player' });
});

// Middleware: require DM role
function requireDM(req, res, next) {
  if (req.session.role === 'dm') return next();
  res.status(403).json({ error: 'DM-only' });
}

// Middleware: attach role to request
function attachRole(req, res, next) {
  req.role = req.session.role || 'player';
  next();
}

module.exports = { router, requireDM, attachRole };
