// ── Spotify: muziek starten vanuit de akteregie ──────────────────────────────
//
// Grisburgh speelt de muziek niet zelf af; het drukt op play bij Spotify. Dat
// kan op twee plekken, in te stellen per campagne (`meta.spotify.doel`):
//
//   'dm'    — het apparaat waarop de DM al Spotify heeft draaien (zijn laptop).
//             De server stuurt gewoon een play-opdracht; er is geen speler in
//             de browser nodig.
//   'tafel' — het tafelscherm wordt zélf een Spotify-apparaat (Web Playback
//             SDK) en meldt zijn device-id bij de server. Daarna is het
//             dezelfde play-opdracht, maar met dat id erbij.
//
// **Premium is verplicht.** De player-endpoints geven een 403 op een gratis
// account; daar is geen omweg voor.
//
// **Waarom de tokens buiten `data/campaigns/` staan.** De nachtelijke backup
// kopieert álle JSON uit die map (zie scripts/backup-campagnes.sh). Een
// refresh-token is een sleutel tot iemands Spotify-account en hoort niet in
// dertig dagen aan snapshots te staan. Ze liggen dus in `data/spotify/`, naast
// de campagnes, met bestandsrechten 0600.
//
// **Geen client secret.** We gebruiken de PKCE-variant van OAuth: de client-id
// is openbaar (die staat in `meta.spotify.clientId`, door de DM zelf ingevuld)
// en het geheim bestaat niet. Scheelt een tweede ding dat niet in een backup
// mag staan.

const fs   = require('fs');
const path = require('path');

const BASE_DIR  = process.env.GRISBURGH_DATA_DIR || path.join(__dirname, '..', 'data');
const TOKEN_DIR = path.join(BASE_DIR, 'spotify');

const AUTH_URL  = 'https://accounts.spotify.com/api/token';
const API       = 'https://api.spotify.com/v1';

// Wat we mogen: afspelen bedienen en zien wat er speelt. Bewust niet meer —
// geen leesrechten op bibliotheek, afspeellijsten of luistergeschiedenis.
// `streaming` (plus de twee account-scopes die Spotify daarbij eist) is alleen
// nodig als het tafelscherm zelf de speler wordt. Die vragen we meteen mee: de
// DM kan later van doel wisselen zonder opnieuw te hoeven koppelen.
const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'streaming',
  'user-read-email',
  'user-read-private',
];

function _bestand(campagne) {
  return path.join(TOKEN_DIR, `${String(campagne || 'grisburgh').replace(/[^a-z0-9_-]/gi, '')}.json`);
}

function lees(campagne) {
  try { return JSON.parse(fs.readFileSync(_bestand(campagne), 'utf8')); }
  catch { return null; }
}

function schrijf(campagne, data) {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(_bestand(campagne), JSON.stringify(data, null, 2), { mode: 0o600 });
}

function wis(campagne) {
  try { fs.unlinkSync(_bestand(campagne)); } catch { /* was er al niet */ }
}

// ── Tokens ───────────────────────────────────────────────────────────────────

async function _tokenVerzoek(body) {
  const r = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(body).toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.error || `Spotify gaf ${r.status}`);
  return data;
}

// Eenmalig, na de toestemmingspagina: code + verifier inwisselen voor tokens.
async function koppel({ campagne, clientId, code, verifier, redirectUri }) {
  const data = await _tokenVerzoek({
    grant_type: 'authorization_code',
    code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier,
  });
  const opslag = {
    clientId,
    refreshToken: data.refresh_token,
    accessToken:  data.access_token,
    verlooptOp:   Date.now() + (data.expires_in || 3600) * 1000,
    gekoppeldOp:  new Date().toISOString(),
  };
  // Wie is dit? Alleen om in de instellingen te tonen met welk account je
  // gekoppeld bent — handig als je twee accounts hebt.
  try {
    const me = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${opslag.accessToken}` } });
    if (me.ok) {
      const p = await me.json();
      opslag.naam    = p.display_name || p.id || '';
      opslag.premium = p.product === 'premium';
    }
  } catch { /* niet erg */ }
  schrijf(campagne, opslag);
  return opslag;
}

// Een geldig access-token, zo nodig ververst. Spotify geeft soms een nieuw
// refresh-token mee; dat moet je bewaren, anders verloopt de koppeling stil.
async function accessToken(campagne) {
  const t = lees(campagne);
  if (!t?.refreshToken) return null;
  if (t.accessToken && t.verlooptOp > Date.now() + 30_000) return t.accessToken;
  const data = await _tokenVerzoek({
    grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: t.clientId,
  });
  t.accessToken = data.access_token;
  t.verlooptOp  = Date.now() + (data.expires_in || 3600) * 1000;
  if (data.refresh_token) t.refreshToken = data.refresh_token;
  schrijf(campagne, t);
  return t.accessToken;
}

// ── Web API ──────────────────────────────────────────────────────────────────

async function _api(campagne, pad, { methode = 'GET', body } = {}) {
  const token = await accessToken(campagne);
  if (!token) { const e = new Error('Niet gekoppeld aan Spotify'); e.code = 'geen-koppeling'; throw e; }
  const r = await fetch(`${API}${pad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // 204 = gelukt, geen inhoud. Dat is bij de player-endpoints het normale antwoord.
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.error?.message || `Spotify gaf ${r.status}`);
    e.status = r.status;
    // De twee fouten die een DM aan tafel echt kan tegenkomen, in gewone taal.
    if (r.status === 404) { e.code = 'geen-apparaat'; e.message = 'Geen actief Spotify-apparaat gevonden — open Spotify en speel even iets af.'; }
    if (r.status === 403) { e.code = 'geen-premium';  e.message = 'Spotify staat dit niet toe. Afspelen op afstand werkt alleen met Premium.'; }
    throw e;
  }
  return data;
}

const apparaten = (campagne) => _api(campagne, '/me/player/devices');

async function zoek(campagne, q, soorten = 'track,playlist,album') {
  const data = await _api(campagne, `/search?q=${encodeURIComponent(q)}&type=${soorten}&limit=8`);
  const uit = [];
  for (const t of (data?.tracks?.items || [])) {
    uit.push({ uri: t.uri, naam: t.name, soort: 'Track',
               bij: (t.artists || []).map(a => a.name).join(', '),
               beeld: t.album?.images?.slice(-1)[0]?.url || '' });
  }
  for (const p of (data?.playlists?.items || []).filter(Boolean)) {
    uit.push({ uri: p.uri, naam: p.name, soort: 'Afspeellijst',
               bij: p.owner?.display_name || '', beeld: p.images?.slice(-1)[0]?.url || '' });
  }
  for (const a of (data?.albums?.items || []).filter(Boolean)) {
    uit.push({ uri: a.uri, naam: a.name, soort: 'Album',
               bij: (a.artists || []).map(x => x.name).join(', '),
               beeld: a.images?.slice(-1)[0]?.url || '' });
  }
  return uit;
}

// Een track speel je als `uris`, een afspeellijst of album als `context_uri` —
// Spotify weigert het omgekeerde met een 400.
async function speel(campagne, { uri, apparaatId, volume, shuffle, herhaal } = {}) {
  if (!uri) throw new Error('Geen muziek gekozen');
  const qs   = apparaatId ? `?device_id=${encodeURIComponent(apparaatId)}` : '';
  const body = uri.includes(':track:') ? { uris: [uri] } : { context_uri: uri };
  if (shuffle !== undefined && !uri.includes(':track:')) {
    try { await _api(campagne, `/me/player/shuffle?state=${!!shuffle}${apparaatId ? `&device_id=${apparaatId}` : ''}`, { methode: 'PUT' }); }
    catch { /* niet elk apparaat kan shuffle; de muziek is belangrijker */ }
  }
  await _api(campagne, `/me/player/play${qs}`, { methode: 'PUT', body });
  // Eén keer of blijven doorspelen. Bij een los nummer is dat `track`, bij een
  // afspeellijst of album `context` — anders herhaalt Spotify alleen het eerste
  // nummer. Na de play-opdracht, want een apparaat dat net wakker wordt neemt
  // een repeat-stand daarvóór niet altijd aan.
  if (herhaal !== undefined) {
    const stand = !herhaal ? 'off' : (uri.includes(':track:') ? 'track' : 'context');
    try { await _api(campagne, `/me/player/repeat?state=${stand}${apparaatId ? `&device_id=${apparaatId}` : ''}`, { methode: 'PUT' }); }
    catch { /* niet elk apparaat kan herhalen; de muziek is belangrijker */ }
  }
  if (Number.isFinite(volume)) {
    const v = Math.max(0, Math.min(100, Math.round(volume)));
    try { await _api(campagne, `/me/player/volume?volume_percent=${v}${apparaatId ? `&device_id=${apparaatId}` : ''}`, { methode: 'PUT' }); }
    catch { /* sommige apparaten laten het volume niet zetten */ }
  }
}

const pauze = (campagne, apparaatId) =>
  _api(campagne, `/me/player/pause${apparaatId ? `?device_id=${apparaatId}` : ''}`, { methode: 'PUT' });

const status = (campagne) => _api(campagne, '/me/player');

module.exports = { SCOPES, lees, wis, koppel, accessToken, apparaten, zoek, speel, pauze, status };
