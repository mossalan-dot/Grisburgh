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

// ── DM-wachtwoord van een campagne ──────────────────────────────────────────
// Het staat in haar eigen dm-state.json, **gehasht**. Dat is geen overdaad: de
// dagelijkse backups nemen die bestanden mee naar een laptop, en daar hoort het
// wachtwoord van een andere DM niet leesbaar in te staan. Groepswachtwoorden
// blijven wél leesbaar — die deel je per appje en moet je kunnen opzoeken.
//
// Een wachtwoord dat er nog leesbaar staat werkt gewoon, en wordt bij de eerste
// geslaagde login omgezet naar een hash. Zo hoeft niemand iets te doen.
const _HASH_PREFIX = 'scrypt$';

function hashWachtwoord(wachtwoord) {
  const zout = crypto.randomBytes(16);
  const sleutel = crypto.scryptSync(String(wachtwoord), zout, 32);
  return `${_HASH_PREFIX}${zout.toString('hex')}$${sleutel.toString('hex')}`;
}

function _klopWachtwoord(opgeslagen, ingetikt) {
  if (!opgeslagen) return { ok: false };
  if (!String(opgeslagen).startsWith(_HASH_PREFIX)) {
    // Nog leesbaar opgeslagen: vergelijken en daarna omzetten.
    return { ok: _zelfdeGeheim(ingetikt, opgeslagen), omzetten: true };
  }
  const [, zoutHex, sleutelHex] = String(opgeslagen).split('$');
  try {
    const sleutel = crypto.scryptSync(String(ingetikt ?? ''), Buffer.from(zoutHex, 'hex'), 32);
    return { ok: crypto.timingSafeEqual(sleutel, Buffer.from(sleutelHex, 'hex')) };
  } catch { return { ok: false }; }
}

function _dmWachtwoordVan(campagne) {
  let eigen = null;
  storage.runInCampaign(campagne, () => {
    try { eigen = storage.readJSON('dm-state.json').dmPassword || null; } catch { /* ok */ }
  });
  if (eigen) return eigen;
  // Alleen de standaardcampagne valt terug op DM_PASSWORD uit de omgeving,
  // zodat de bestaande login blijft werken tot daar een eigen wachtwoord staat.
  return campagne === storage.getActiveCampaignId() ? config.dmPassword : null;
}

// Controleer én werk zo nodig bij: een leesbaar wachtwoord wordt na een
// geslaagde login een hash.
function _dmLoginKlopt(campagne, ingetikt) {
  const opgeslagen = _dmWachtwoordVan(campagne);
  if (!opgeslagen) return false;
  const uitslag = _klopWachtwoord(opgeslagen, ingetikt);
  if (uitslag.ok && uitslag.omzetten) {
    storage.runInCampaign(campagne, () => {
      try {
        const dm = storage.readJSON('dm-state.json');
        // Alleen omzetten wat écht in dit bestand staat; de env-terugval laten
        // we met rust (die staat niet in een backup).
        if (dm.dmPassword && !String(dm.dmPassword).startsWith(_HASH_PREFIX)) {
          dm.dmPassword = hashWachtwoord(ingetikt);
          storage.writeJSON('dm-state.json', dm);
        }
      } catch { /* ok */ }
    });
  }
  return uitslag.ok;
}

// ── DM login / logout ──

router.post('/login', (req, res) => {
  const { naam, fout } = _campagneUitBody(req);
  if (fout) return res.status(400).json({ error: fout });
  if (!_dmLoginKlopt(naam, req.body?.password)) {
    return res.status(401).json({ error: 'Verkeerd wachtwoord' });
  }
  req.session.role       = 'dm';
  req.session.campaignId = naam;
  delete req.session.playerName;
  delete req.session.characterId;
  res.json({ role: 'dm', campagne: naam, isSandbox: naam === 'sandbox' });
});

// ── Toegang: één wachtwoordveld, de rol volgt ────────────────────────────────
// Op de campagnepagina staat één veld. Wat je intikt bepaalt waar je uitkomt:
// het DM-wachtwoord logt je in als DM, een groepswachtwoord laat de personages
// van díé party zien om uit te kiezen. Zo hoeft niemand eerst te bedenken wat
// hij is.
router.post('/toegang', (req, res) => {
  const { naam, fout } = _campagneUitBody(req);
  if (fout) return res.status(400).json({ error: fout });
  const wachtwoord = String(req.body?.wachtwoord ?? req.body?.password ?? '');

  if (_dmLoginKlopt(naam, wachtwoord)) {
    req.session.role       = 'dm';
    req.session.campaignId = naam;
    delete req.session.playerName;
    delete req.session.characterId;
    return res.json({ rol: 'dm', campagne: naam });
  }

  let antwoord = null;
  storage.runInCampaign(naam, () => {
    const dmState  = storage.readJSON('dm-state.json');
    const entities = storage.readJSON('entities.json');
    const groepen  = dmState.groups || {};
    const treffer  = Object.entries(groepen)
      .find(([, g]) => g.password && _zelfdeGeheim(wachtwoord, g.password));
    if (!treffer) return;
    const [groepId, groep] = treffer;
    // Nog niet inloggen: eerst kiest de speler zijn personage, en dan pas gaat
    // dezelfde login-route in met hetzelfde wachtwoord.
    const personages = (entities.personages || [])
      .filter(e => (e.subtype || '').toLowerCase() === 'speler' && e.data?.groep === groepId && !e.data?.testOnly)
      .map(e => ({
        id: e.id, name: e.name, ras: e.data?.ras || '', klasse: e.data?.klasse || '',
        portraitVideoId: e.data?.portraitVideoId || (storage.getFile(`${e.id}_video`) ? `${e.id}_video` : null),
      }));
    antwoord = { rol: 'groep', campagne: naam, groep: { id: groepId, naam: groep.name || '' }, personages };
  });
  if (antwoord) return res.json(antwoord);
  res.status(401).json({ error: 'Verkeerd wachtwoord' });
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

module.exports = { router, requireDM, attachRole, hashWachtwoord };
