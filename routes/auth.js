const crypto  = require('crypto');
const express = require('express');
const config  = require('../config');
const storage = require('../lib/storage');

const router = express.Router();

// Helper: emit to the correct campaign room
const _emit = (req, ...args) => req.app.get('io').to(req.session?.campaignId || 'main').emit(...args);

// ── Campagne bij een inlogpoging ────────────────────────────────────────────
// Elke login noemt de campagne waar hij bij hoort. Zonder die naam weten we
// niet wiens wachtwoord we controleren — en dan zou het wachtwoord van de ene
// DM toegang geven tot de campagne van de andere.
function _campagneUitBody(req) {
  const naam = String(req.body?.campagne || req.query?.campagne || '').trim();
  if (!naam) return { fout: 'Geen campagne opgegeven' };
  if (!storage.campagneBestaat(naam)) return { fout: 'Onbekende campagne' };
  return { naam };
}

// Wachtwoorden vergelijken zonder dat de reactietijd verklapt hoe ver je kwam.
function _zelfdeGeheim(a, b) {
  const A = Buffer.from(String(a ?? ''), 'utf8');
  const B = Buffer.from(String(b ?? ''), 'utf8');
  if (A.length !== B.length) {
    // Toch één vergelijking doen, zodat een verkeerde lengte niet sneller is.
    crypto.timingSafeEqual(A, A);
    return false;
  }
  return crypto.timingSafeEqual(A, B);
}

// Het DM-wachtwoord van een campagne staat in haar eigen dm-state.json. Alleen
// de standaardcampagne valt terug op DM_PASSWORD uit de omgeving, zodat de
// bestaande login blijft werken tot daar een eigen wachtwoord is gezet.
function _dmWachtwoordVan(campagne) {
  let eigen = null;
  storage.runInCampaign(campagne, () => {
    try { eigen = storage.readJSON('dm-state.json').dmPassword || null; } catch { /* ok */ }
  });
  if (eigen) return eigen;
  return campagne === storage.getActiveCampaignId() ? config.dmPassword : null;
}

// ── DM login / logout ──

router.post('/login', (req, res) => {
  const { naam, fout } = _campagneUitBody(req);
  if (fout) return res.status(400).json({ error: fout });
  const verwacht = _dmWachtwoordVan(naam);
  if (!verwacht || !_zelfdeGeheim(req.body?.password, verwacht)) {
    return res.status(401).json({ error: 'Verkeerd wachtwoord' });
  }
  req.session.role       = 'dm';
  req.session.campaignId = naam;
  delete req.session.playerName;
  delete req.session.characterId;
  res.json({ role: 'dm', campagne: naam, isSandbox: naam === 'sandbox' });
});

// ── Tablet login ──
// Alleen wachtwoordcontrole — geen sessierol-wijziging.
// Zonder TABLET_PASSWORD in de omgeving is tablet-login uitgeschakeld.
router.post('/tablet-login', (req, res) => {
  const { password } = req.body;
  if (!config.tabletPassword) {
    return res.status(403).json({ error: 'Tablet-login is niet geconfigureerd' });
  }
  if (!_zelfdeGeheim(password, config.tabletPassword)) {
    return res.status(401).json({ error: 'Verkeerd wachtwoord' });
  }
  // Ook het tafelscherm hoort bij een campagne: zonder campagne-id belandt zijn
  // socket in de algemene kamer en mist hij alles wat de DM uitzendt.
  const { naam } = _campagneUitBody(req);
  if (naam) req.session.campaignId = naam;
  res.json({ ok: true, campagne: req.session.campaignId || null });
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
          // hasVideo afgeleid van het werkelijke bestand op schijf — het
          // portraitVideoId-dataveld bleek na een update onbetrouwbaar (gewist
          // voor de meeste karakters), terwijl het _video-bestand wél bestaat.
          portraitVideoId:  e.data?.portraitVideoId || (storage.getFile(`${e.id}_video`) ? `${e.id}_video` : null),
        };
      });
    res.json(spelers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Speler-login: kies karakter op basis van ID ──

router.post('/player-login', (req, res) => {
  const { naam: campagne, fout } = _campagneUitBody(req);
  if (fout) return res.status(400).json({ error: fout });
  const doLogin = () => {
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
      const groepId = character.data?.groep;
      const groepPw = groepId ? groups[groepId]?.password : null;
      if (groepPw && !_zelfdeGeheim(password, groepPw)) {
        return res.status(401).json({ error: 'Verkeerd wachtwoord' });
      }
      req.session.campaignId  = campagne;
      req.session.role        = 'player'; // expliciet, zodat lokale DEV_AUTO_DM-bypass wordt overschreven
      req.session.playerName  = character.name;
      req.session.characterId = character.id;
      _emit(req, 'player:joined', { playerName: character.name, characterId: character.id });
      res.json({ playerName: character.name, characterId: character.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  // Altijd in de genoemde campagne kijken, niet in die van een vorige sessie.
  storage.runInCampaign(campagne, doLogin);
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
