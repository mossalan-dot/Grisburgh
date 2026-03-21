# Grisburgh — D&D Campaign Manager

Een lokaal draaiende web-app voor de Grisburgh D&D-campagne. De DM beheert personages, locaties, organisaties, voorwerpen, documenten en een sessielogboek. Spelers krijgen een gefilterde view via een gedeelde URL.

## Hoe het werkt

- **DM** logt in met een wachtwoord en kan alles aanmaken, bewerken en zichtbaarheid beheren
- **Spelers** kiezen een personage en zien alleen wat de DM zichtbaar heeft gemaakt
- **Server-side filtering** zorgt ervoor dat spelers nooit bij verborgen data kunnen
- **Real-time updates** via Socket.io — als de DM iets wijzigt, updaten alle browsers automatisch

---

## Secties

| Sectie | Wat |
|---|---|
| **Personages** | NPC's, spelers, antagonisten, goden, dieren en handelaars — met afbeeldingen, stat blocks en verbindingen |
| **Locaties** | Stadswijken, gebouwen, herbergen, tempels, winkels, forten, schepen, steden, bossen, zeeën, etc. |
| **Organisaties** | Gildes, facties, religieuze, politieke, criminele en militaire groepen |
| **Voorwerpen** | Wapens, toveritems, drankjes, uitrustingen, spreukenrollen, ringen, amuletten, etc. |
| **Documenten** | Brieven, kranten, kaarten, manuscripten, dagboeken, audiofragmenten — met 3-staps onthulling |
| **Kaarten** | Interactieve stad- en wereldkaarten met zoom, pan en klikbare locatiepins |
| **Logboek** | Sessiesamenvattingen per hoofdstuk met entities, afbeeldingen en documentlinks |

---

## Entity-beheer

### Algemene mogelijkheden (alle typen)

- Aanmaken, bewerken en verwijderen van entities
- Afbeeldingen/portretten uploaden per entity
- Bidirectionele links tussen entities (personages ↔ locaties, voorwerpen, organisaties, etc.)
- Zichtbaarheid per entity: **Verborgen** (DM only) / **Vaag** (naam zichtbaar) / **Onthuld** (volledig)
- **Geheim veld** dat apart onthuld kan worden (bijv. ware naam of motivatie)
- DM-notities per entity (nooit zichtbaar voor spelers)
- Personages markeerbaar als **deceased** (visueel rood kruis op kaartje)
- Beschrijvingen in markdown (vet, cursief)
- Focuspunt instellen per afbeelding (klikken bepaalt het bijsnijdpunt)
- Autocomplete bij het linken van entities
- Zoekbalk per sectie + **globale zoekfunctie** (⌕ knop of `/`)

### Globale zoekfunctie

- Doorzoekt tegelijk: personages, locaties, organisaties, voorwerpen en documenten
- Gegroepeerde resultaten per type, direct klikbaar naar detailmodal
- Volledig zichtbaarheidsbewust (verborgen entities niet zichtbaar voor spelers)

### Kaartweergave

- Interactieve kaarten met scroll-zoom en klik-pan
- Meerdere kaarten (stad, wereld) via tabs
- Locatiepins klikbaar — openen het bijbehorende locatiekaartje
- DM kan pins toevoegen, verplaatsen en verwijderen
- Rustieke rand rondom kaarten

### Detail-modal

- Hero-portret met gradient-overlay en type-icoon
- Rolbadge in Cinzel-lettertype
- Meta-pills voor ras, klasse, locatietype, etc.
- Gekleurde accentbalk per entiteitstype
- Geheime velden apart onthuld door DM
- Spelernotities per entity (DM ziet alle notities van alle spelers)

---

## Archief (Documenten & Logboek)

### Documenten

- Documenttypen: Brief, Krant, Kaart, Manuscript, Kasboek, Notities, Folder, Gebed, Blauwdruk, Embleem, Visitekaartje, Gedicht, Dreigbrief, Catalogus, Menu, Audiofragment, Overig
- 3-staps onthulling: **Verborgen** → **Wazig** (vage outline) → **Onthuld** (volledige toegang)
- Afbeelding, PDF en audio uploaden (max 50 MB) met inline viewer/speler
- Perkament-teksteditor voor archief-documenten
- Verborgen connecties (links selectief verbergen op documenten)
- DM-only links voor geheime verwijzingen
- Filter op categorie (brieven, pers, kaarten, codex, audio)

### Sessielogboek

- Sessie-entries per hoofdstuk met datum, korte samenvatting en uitgebreide tekst
- Meerdere afbeeldingen per sessie, **individueel onthuld** door DM
- Bij onthulling: afbeelding verschijnt automatisch als lightbox bij alle spelers
- Koppelbare entities per sessie: nieuw (✨) of terugkerend (🔄)
- Gekoppelde documenten als klikbare chips (📜)
- Groepering per hoofdstuk
- Spelers zien alleen zichtbare entries

---

## Spelersdashboard (Mijn Karakter)

Toegankelijk nadat een speler een personage heeft gekozen.

- Personageportret en naam (geladen uit het personagekaartje)
- HP-balk met statuslabel (Gezond → Lichtgewond → Gewond → Zwaargewond → Kritiek → Gevallen)
- Eigen HP aanpassen direct vanuit het dashboard (tijdens gevecht)
- **Emote-knoppen**: altijd zichtbaar als de DM emotes heeft ingesteld
  - Tijdens gevecht: geluid wordt afgespeeld op de DM-laptop
  - Buiten gevecht: geluid wordt lokaal afgespeeld op het apparaat van de speler
- **Gevonden voorwerpen**: kaartjes van items die de DM aan de speler heeft toegewezen
- **Losse aantekeningen**: spelers kunnen zelf vrije tekstitems toevoegen (niet gekoppeld aan een kaartje)
- Navigatietab toont het avatar van de speler

---

## Gevecht (Combat)

### Opzet

- Voeg deelnemers toe: **monster**, **speler**, **bondgenoot** of **oproeping**
- Selecteer uit de monsterbibliotheek of voer handmatig in (naam, initiatiefwaarde, HP)
- Auto-voeg alle actieve spelers toe
- Verwijder of reset deelnemers vóór het begin
- Start gevecht → sorteert automatisch op initiatiefwaarde

### Actief gevecht

- Ronden bijhouden en beurten doorlopen (volgende/vorige)
- HP en tijdelijke HP per deelnemer aanpassen (delta of direct)
- Doodsreddingen bijhouden bij 0 HP
- **Condities** per deelnemer (20+): Blind, Betoverd, Gevreesd, Gegrepen, Onzichtbaar, Verlamd, Vergiftigd, Liggen, Bewusteloos, Concentratie, Bloedend, Brandend, etc.
- Statuslabels (Gezond → Gevallen) op HP-balk
- Automatisch geluidseffect bij schade en genezing (op DM-laptop)
- Overwinningsgeluid bij einde gevecht (spelers winnen of monsters winnen)
- Gevechtsoverlay zichtbaar voor alle deelnemers in real-time
- Speler kan eigen HP aanpassen vanuit de overlay
- Gevecht minimaliseren/uitvouwen

### Monsterbibliotheek

- Volledig CRUD voor monster-statblokken (naam, max-HP, initiatiefmodifier)
- Portret- en achtergrondafbeelding per monster
- Organiseren per hoofdstuk
- Snel toevoegen aan gevecht vanuit de bibliotheek

---

## Geluidssysteem

### Gevechtsklanken (automatisch, DM-laptop)

- 💥 Schadesound bij schade
- 💚 Geneessound bij HP-herstel
- 🏆 Overwinnissound bij einde gevecht (spelers winnen)
- 💀 Verliesgeluid bij einde gevecht (monsters winnen)

### Emotes

- DM maakt per speler een bibliotheek van emotes (emoji-icoon + label + audiobestand)
- Tot 5 emotes tegelijk actief per speler
- Spelers activeren emotes via knoppen in het dashboard of gevechtsoverlay
  - Tijdens gevecht: geluid broadcast via socket naar DM-laptop
  - Buiten gevecht: geluid speelt lokaal op apparaat van de speler
- Geluidsbestanden uploaden, testen en vervangen via het geluidenpaneel

---

## DM-paneel (Meesterkamer)

Toegankelijk via de ⚔-knop rechtsonder. Tabs:

| Tab | Functie |
|---|---|
| **Tunnel** | Start/stop een Cloudflare-tunnel en kopieer de deelbare URL |
| **Snapshot** | Download de hele campagne als statisch HTML-bestand |
| **Spreuken** | D&D 5e-spreukreferentie via live API (naam, niveau, school, beschrijving, componenten) |
| **Tafels** | Aangepaste willekeurige tabellen aanmaken en rollen (simpel en complex) |
| **Dobbel** | DM-dobbelsteenpaneel met meerdere dobbelsteentypes en rollgeschiedenis |
| **Geluiden** | Gevechtsklanken en emotes beheren per speler |
| **Monsters** | Monsterbibliotheek beheren (aanmaken, bewerken, verwijderen, per hoofdstuk) |
| **Gevecht** | Gevecht opzetten en beheren (deelnemers, beurten, condities) |

---

## Partybalk

- Spelersportretten (subtype `speler`) verschijnen automatisch in de header
- Klik op het bolletje per portret om aanwezigheid te registreren
- Aanwezige spelers links, afwezige spelers rechts (gedimd) met scheidingslijn
- Aanwezigheidsstatus wordt lokaal opgeslagen per browser

---

## Dobbelsteenpaneel 🎲

- Klein goudkleurig knopje rechtsonder in het scherm
- Klikken schuift een paneel omhoog met d4, d6, d8, d12, d20 en d%
- Ticker-animatie bij elke gooi (versneld → vertraagd → uitkomst)
- d20=20 → **Critical Hit!** (groen), d20=1 → **Critical Fail!** (rood)
- Rolgeschiedenis van de laatste 10 gooien zichtbaar als chips
- Toegankelijk voor zowel DM als spelers

---

## Visueel ontwerp

- **Perkamenttextuur** — linnenpatroon overlay over de hele achtergrond
- **Sectiebanners** — decoratieve koptekst met icon, label en omschrijving per tabblad
- **Lege toestanden** — "Het archief is nog leeg..." met DM-hint
- **Actief tabblad** — subtiele achtergrondtint op geselecteerde tab
- **Detail-modal** — hero-portret, rolbadge, meta-pills, gekleurde accentbalk
- **Logboekkaart** — sessieafbeelding, dateline, hoofdstuklabel, samenvattingsexcerpt
- **Entiteit-chips** — kleurgecodeerd per type (goud = nieuw, blauw = terugkerend)
- Toast-notificaties bij onthullingen, gevechtsgebeurtenissen en socketupdates

---

## Importscripts

| Script | Functie |
|---|---|
| `import-schaduwvin.js` | Importeert personages, locaties, organisaties en voorwerpen vanuit een Obsidian-vault |
| `import-obsidian.js` | Importeert documenten vanuit de Obsidian-vault |
| `import-verhaal.js` | Importeert Obsidian-hoofdstukken als DM-notities in het sessielogboek |

De scripts lezen Markdown-bestanden en embedded media uit de vault en schrijven direct naar `data/archief.json` en `data/dm-state.json`.

---

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

---

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

Dit geeft een publieke URL (bijv. `https://iets-random.trycloudflare.com`). Deel die met spelers. De URL verandert elke keer dat je de tunnel opnieuw start. Je kunt de tunnel ook starten vanuit het DM-paneel → Tunnel-tab.

### 3. Inloggen als DM

Klik op "DM" in de header en gebruik het wachtwoord uit `config.js`.

---

## Projectstructuur

```
server.js              # Express + Socket.io entry point
config.js              # Poort, wachtwoord, session secret
routes/
  api.js               # REST API + server-side filtering
  auth.js              # DM login + middleware
lib/
  storage.js           # JSON-bestandsopslag + afbeeldingen/PDFs/audio
public/
  index.html           # SPA-shell (Tailwind CSS + PDF.js)
  assets/              # Statische kaartafbeeldingen
  js/
    app.js             # App-shell, auth, modals, sectionrouting, dobbelsteenpaneel
    render-campagne.js # Entity CRUD, kaarten, editor, autocomplete, globale zoekfunctie
    render-archief.js  # Documenten, logboek, onthulling, PDF-viewer, audiospeler
    render-kaart.js    # Interactieve kaarten met zoom, pan en locatiepins
    api.js             # Fetch-wrapper + entity name lookup
    socket-client.js   # Real-time updates en geluidsevents
  css/
    theme.css          # Perkament-thema (scrollbar, chips, modals, kaarten, panelen)
data/                  # Persistente data (gitignored)
import-schaduwvin.js   # Obsidian entity-importscript
import-obsidian.js     # Obsidian document-importscript
import-verhaal.js      # Obsidian verhaal/logboek-importscript
tests/                 # Automatische tests
```

---

## Data

Alle data staat in `data/` als JSON-bestanden. Deze map is gitignored. Afbeeldingen, PDFs en audiobestanden staan in `data/files/`. Back-up = de `data/` map kopiëren.

---

## Scripts

| Script | Commando |
|---|---|
| `npm start` | Server starten |
| `npm run dev` | Server starten met auto-reload |
| `npm test` | Tests draaien |
| `npm run test:watch` | Tests draaien met auto-reload |
| `npm run tunnel` | Cloudflare Tunnel starten |
