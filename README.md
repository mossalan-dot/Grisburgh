# Grisburgh — D&D Campaign Manager

Een lokaal draaiende web-app voor de Grisburgh D&D-campagne. De DM beheert personages, locaties, organisaties, voorwerpen, documenten en een sessielogboek. Spelers krijgen een gefilterde read-only view via een gedeelde URL.

## Hoe het werkt

- **DM** logt in met een wachtwoord en kan alles aanmaken, bewerken en verbergen/onthullen
- **Spelers** openen dezelfde URL zonder login en zien alleen wat de DM zichtbaar heeft gemaakt
- **Server-side filtering** zorgt ervoor dat spelers nooit bij verborgen data kunnen
- **Real-time updates** via Socket.io — als de DM iets wijzigt, updaten speler-browsers automatisch

### Secties

| Sectie | Wat |
|---|---|
| **Personages** | NPC's, spelers, antagonisten, goden en dieren — met afbeeldingen, stat blocks en verbindingen |
| **Locaties** | Stadswijken, gebouwen, herbergen, etc. |
| **Organisaties** | Gildes, facties, criminelen, etc. |
| **Voorwerpen** | Wapens, toveritems, drankjes, etc. |
| **Documenten** | Brieven, kaarten, codex, etc. met 3-state onthulling: verborgen → wazig → onthuld |
| **Logboek** | Sessiesamenvattingen per hoofdstuk met nieuwe, terugkerende entities én documentlinks |

### DM-features

- Zichtbaarheid togglen per entity/document (👁 / 🔒) via knoppen op elke kaart
- Bewerken en verwijderen direct via kaart-knoppen (✏ / ✕)
- Geheime velden die apart onthuld kunnen worden
- Character stats (AC, HP, Speed, ability scores) — ingelezen uit Obsidian stat blocks, alleen zichtbaar voor DM
- DM-notities per entity (alleen voor DM)
- Afbeelding en PDF upload (max 10MB) met inline PDF viewer
- Focuspunt instellen per afbeelding (klikken in de afbeelding bepaalt het bijsnijdpunt)
- Perkament-tekst editor voor archief-documenten
- Verborgen connecties (selectief links verbergen op documenten)
- Autocomplete bij het linken van entities
- Sessielogboek met nieuwe (✨), terugkerende (🔄) entities en gekoppelde documenten (📜) per sessie
- Documentchips in het logboek zijn klikbaar en openen het document direct

### Kaartweergave

- Rol van een personage wordt direct onder de naam getoond
- Beschrijvingen renderen markdown (vet, cursief)
- Partybalk toont alleen de voornaam van spelersfiguren
- Kaartafbeeldingen tonen met focuspunt, portraits in detailmodal groter weergegeven

## Importscripts

| Script | Functie |
|---|---|
| `import-schaduwvin.js` | Importeert personages, locaties, organisaties en voorwerpen vanuit een Obsidian-vault |
| `import-obsidian.js` | Importeert documenten (brieven, kaarten, krantenartikelen, etc.) vanuit de Obsidian-vault |

De scripts lezen Markdown-bestanden en embedded media uit de vault en schrijven direct naar `data/archief.json` en `data/dm-state.json`.

## Installatie

### Vereisten

- **Node.js 24** (zie `.node-version`)
- **cloudflared** voor extern delen (optioneel)

### Setup

```bash
nvm use           # activeert Node 24 via .nvmrc
npm install
```

### Cloudflared installeren (eenmalig)

```bash
brew install cloudflared
```

## Opstarten

### 1. Server starten

```bash
npm run dev       # start met auto-reload bij code changes
# of
npm start         # zonder auto-reload
```

Server draait op http://localhost:3000

### 2. Extern delen via Cloudflare Tunnel

Open een tweede terminal:

```bash
npm run tunnel
```

Dit geeft een publieke URL (bijv. `https://iets-random.trycloudflare.com`). Deel die met je spelers. De URL verandert elke keer dat je de tunnel opnieuw start.

### 3. Inloggen als DM

Klik op "DM" in de header en gebruik het wachtwoord uit `config.js`.

## Project structuur

```
server.js              # Express + Socket.io entry point
config.js              # Poort, wachtwoord, session secret
routes/
  api.js               # REST API + server-side filtering
  auth.js              # DM login + middleware
lib/
  storage.js           # JSON file opslag + afbeeldingen/PDFs
public/
  index.html           # SPA shell (Tailwind CSS + PDF.js)
  js/
    app.js             # App shell, auth, modals, section routing
    render-campagne.js # Entity CRUD, cards, editor, autocomplete links
    render-archief.js  # Documenten, logboek, onthulling, PDF viewer
    api.js             # Fetch wrapper + entity name lookup
    socket-client.js   # Real-time updates
  css/
    theme.css          # Perkament-thema (scrollbar, chips, modals, etc.)
data/                  # Persistent data (gitignored)
import-schaduwvin.js   # Obsidian entity-import script
import-obsidian.js     # Obsidian document-import script
tests/                 # Automatische tests
```

## Data

Alle data staat in `data/` als JSON-bestanden. Deze map is gitignored. Afbeeldingen en PDFs staan in `data/files/`. Back-up = de `data/` map kopiëren.

## Scripts

| Script | Commando |
|---|---|
| `npm start` | Server starten |
| `npm run dev` | Server starten met auto-reload |
| `npm test` | Tests draaien |
| `npm run test:watch` | Tests draaien met auto-reload |
| `npm run tunnel` | Cloudflare Tunnel starten |
