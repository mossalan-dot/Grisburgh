# Grisburgh — D&D Campaign Manager

Een lokaal draaiende web-app voor het beheren van een D&D-campagne. De DM beheert personages, locaties, organisaties, voorwerpen, documenten, een sessielogboek, gevecht en meer. Spelers krijgen een gefilterde weergave via een gedeelde URL (Cloudflare-tunnel).

## Hoe het werkt

- **DM** logt in met een wachtwoord en kan alles aanmaken, bewerken en zichtbaarheid beheren
- **Spelers** kiezen een personage en zien alleen wat de DM zichtbaar heeft gemaakt
- **Server-side filtering** zorgt ervoor dat spelers nooit bij verborgen data kunnen komen
- **Real-time updates** via Socket.io — als de DM iets wijzigt, updaten alle browsers direct

---

## Installatie

### Vereisten

- **Node.js 24+** (zie `.node-version`)
- **cloudflared** voor extern delen (optioneel)

### Setup

```bash
nvm use           # activeert Node 24 via .nvmrc
npm install
```

### Cloudflared installeren (eenmalig, optioneel)

```bash
brew install cloudflared
```

---

## Opstarten

### 1. Server starten

```bash
npm run dev       # start met auto-reload bij codewijzigingen
# of
npm start         # zonder auto-reload
```

Server draait op `http://localhost:3000`.

### 2. Extern delen via Cloudflare Tunnel

```bash
npm run tunnel
```

Geeft een publieke URL (bijv. `https://iets.trycloudflare.com`). Deel die met spelers. De URL verandert elke keer dat je de tunnel herstart. Je kunt de tunnel ook starten en stoppen vanuit het DM-paneel → **Tunnel**-tab.

### 3. Inloggen

- **DM**: klik op "DM" in de header en gebruik het wachtwoord uit `config.js`
- **Spelers**: klik op "Speler" en kies een personage

> **Lokaal ontwikkelen?** `npm run dev` zet `DEV_AUTO_DM=1` en logt je automatisch als DM in — geen wachtwoord nodig. Deze bypass is **alleen lokaal** actief; productie (`npm start`) vereist gewoon de DM-login. Als speler testen kan via "Speler" → personage kiezen.

---

## Secties

| Sectie | Inhoud |
|---|---|
| **Personages** | NPC's, spelers, antagonisten, goden, dieren en verkopers |
| **Locaties** | Stadswijken, gebouwen, herbergen, tempels, winkels, forten, schepen, steden, bossen en zeeën |
| **Organisaties** | Gildes, facties, religieuze, politieke, criminele en militaire groepen |
| **Voorwerpen** | Wapens, magische items, drankjes, uitrustingen, spreukenrollen, ringen, amuletten en meer |
| **Documenten** | Brieven, kranten, kaarten, manuscripten, dagboeken en audiofragmenten |
| **Bestiarium** | Wezens met statblok en gefaseerde onthulling (naam → deels → volledig) via De Magizoöloog |
| **Kaarten** | Interactieve stad- en wereldkaarten + dungeon-kaarten met zoom, pan en klikbare pins |
| **Logboek** | Sessieverslagen per akte (hoofdstuk) met afbeeldingen, entiteitskoppelingen en documenten |
| **Diensten** | Stadsdiensten: Herberg, Tempel, Madame Ursula, De Magizoöloog, Facties, Tweespalt, De Gock |
| **Mijn Karakter** | Persoonlijk spelerdashboard: HP, valuta, spreukenslots, progressie, spreukenboek, voorwerpen, bladwijzers en meer |

---

## Entity-beheer

### Mogelijkheden per entiteitstype

**Personages**
- Velden: Rol, Ras, Klasse, Beschrijving, Persoonlijkheid (DM-only), Roddel/flavour, Geheim
- Subtypes: NPC, Speler, Antagonist, God, Dier, Verkoper (elk met eigen kleur en icoon)
- Markeerbaar als **deceased** — kaartje krijgt grijstint en †-symbool

**Locaties**
- Velden: Type (Stadswijk, Gebouw, Herberg, Taveerne, Tempel, Winkel, Fort, Schip, Dorp, Stad, Woud, Berg, Zee, Overig), Wijk, Eigenaar, Beschrijving, Flavour, Geheim
- Koppelbaar aan een pin op de interactieve kaart

**Organisaties**
- Velden: Type (Gilde, Factie, Religieus, Politiek, Crimineel, Militair, Overig), Motto, Beschrijving, Flavour
- Te koppelen aan personages en locaties

**Voorwerpen**
- Velden: Type (Weapon, Magic Item, Potion, Armor, Shield, Scroll, Ring, Amulet, Consumable, Wondrous Item, Musical Instrument, Feature, Other), Rariteit (Common → Legendary), Prijs, Attunement, Stapelbaar, Beschrijving, Flavour
- Eigendomsbeheer — de DM kan items toewijzen aan spelers

### Gemeenschappelijke mogelijkheden

- **Aanmaken, bewerken en verwijderen** van alle entiteiten
- **Afbeeldingen** uploaden per entiteit (PNG, JPG; max 50 MB)
- **Focuspunt** instellen per afbeelding — klikken op de foto bepaalt het bijsnijdpunt
- **Bidirectionele links** tussen entiteiten (personages ↔ locaties ↔ voorwerpen ↔ organisaties)
- **Zichtbaarheid per entiteit**: Verborgen (DM only) / Vaag (alleen naam zichtbaar) / Onthuld
- **Geheimen** per entiteit — DM kan een verborgen veld apart onthullen voor spelers
- **DM-notities** per entiteit — nooit zichtbaar voor spelers
- **Spelersnotities** per entiteit — persoonlijke aantekeningen per speler
- **Prullenbak** — verwijderde entiteiten worden zacht verwijderd; DM kan ze herstellen
- **Autocomplete** bij het linken van entiteiten
- **Subtypefilter** — chip-balk boven het grid om op subtype te filteren
- **Zoekbalk** per sectie + **globale zoekfunctie** (knop of `/`-toets)

### Kaartweergave

- Visuele kaartjes in een responsive grid; kaartje toont portretafbeelding, naam, metavelden, badges en chips
- **Subtiele type-tint** per sectie (groen/blauw/rood/goud) zodat je altijd weet in welke sectie je zit
- **3D tilt-effect** bij hover (CSS perspective)
- **Pan-animatie** op de portretafbeelding bij hover (langzame verticale scan)
- **Type-kleurgloed** bij hover per sectie

### Globale zoekfunctie

- Doorzoekt tegelijk: personages, locaties, organisaties, voorwerpen en documenten
- Gegroepeerde resultaten per type, direct klikbaar naar detailmodal
- Volledig zichtbaarheidsbewust — verborgen entiteiten niet zichtbaar voor spelers

### Detail-modal

- Hero-portret met gradient-overlay en type-icoon
- Rolbadge, ras, klasse en andere metavelden
- Gekleurde accentbalk per entiteitstype
- Geheimen apart onthuld door de DM
- Bidirectionele links als klikbare chips
- Spelernotities bewerkbaar direct in de modal
- Afbeelding full-screen te openen als lightbox

---

## Winkelsysteem

Locaties en personages van het type **Verkoper** kunnen een winkelconfiguratie hebben.

### Voorraadbeheer (DM)

- Items toevoegen met naam, prijs en een koppeling aan een voorwerpkaartje (inclusief beschrijving en afbeelding)
- **Roulerend assortiment** — configureerbaar als wisselende voorraad per sessie, met instelbare rotatiegrootte
- **Deelgroep** — meerdere winkels kunnen dezelfde rotatiepool delen (bijv. twee winkels van dezelfde handelaar tonen altijd identieke voorraad)
- **Sfeer** — optionele sfeerafbeelding en -tekst die bovenaan de winkel verschijnt
- **Onderhandel-instellingen** — DC, kortingspercentage bij succes en malus bij mislukken
- **Aankooplogboek** (DM-only tab) — overzicht van alle aankopen per winkel met tijdstip, koper en bedrag

### Kopen (speler)

- Spelers kopen items met hun persoonlijke valuta — saldo wordt automatisch afgetrokken
- **Hoeveelheid** — bij stapelbare items kan de speler een aantal invoeren
- **Uitverkocht** — na aankoop wordt een item gemarkeerd als uitverkocht voor die groep
- **Kortingsbanner** — als de DM een korting heeft ingesteld na onderhandelen, wordt die prominent getoond

### Onderhandelen

- Speler klikt op "Onderhandelen", voert Charisma-modifier in en rolt een d20
- Resultaat wordt vergeleken met de instelbare DC; succes geeft een tijdelijke korting, mislukken een tijdelijke malus
- De DM ziet de uitslag; de korting/malus is eenmalig geldig tot de volgende aankoop

### Hover-tooltip

- Bij hover op een winkelitem verschijnt een tooltip met de volledige beschrijving uit het gekoppelde voorwerpkaartje, inclusief opgemaakte markdown (vet, cursief)

---

## Eigendomsbeheer (Voorwerpen)

- **Toewijzen** — DM kan elk voorwerp aan een speler toewijzen
- **Badge op kaartje** — eigenaar zichtbaar als kleurgecodeerde badge
- **Stapelbare items** — meerdere eigenaren mogelijk, met hoeveelheid per eigenaar
- **Claim-verzoeken** — spelers kunnen een item aanvragen; DM ziet verzoeken boven het grid en kan goedkeuren of afwijzen
- **Ruil-toggle** — DM kan het ruilen van items tussen spelers aan- of uitzetten

---

## Spelersdashboard (Mijn Karakter)

### Profiel

- Naam, niveau, klasse, subklasse, achtergrond en afkomst
- **Multiclassing** — toggle via ⊕-knop; toont aparte klasse + level per klasse; icoon en themakleur passen zich aan
- **Klassethema** — klik op het klasseicoon om een themakleur (bijv. paars voor Warlock, groen voor Druid) in of uit te schakelen

### HP & Status

- Huidige HP, max HP en tijdelijk HP aanpasbaar direct door de speler
- Statuslabel automatisch op basis van percentage (Gezond → Lichtgewond → Gewond → Zwaargewond → Kritiek → Gevallen)

### Valuta

- Individueel: Florinde, Knaker en Centeling (namen aanpasbaar door DM)
- **Gedeelde beurs** — optionele partybeurs, zichtbaar en bewerkbaar als de DM dit instelt

### Spreukenslots

- Tracking per spellevel (0–9): beschikbaar en gebruikt
- Klik om een slot te gebruiken of te herstellen

### Trackers

- Configureerbare trackers voor klasse- en rascapaciteiten (bijv. Bardic Inspiration, Ki Points, Sorcery Points)
- Naam, huidige waarde en maximum per tracker

### Spreukenboek

- Een doorbladerbaar **spreukenboek** met de spreuken van het personage (D&D 5e-referentie)
- Volledige spreukbeschrijvingen met **hover-uitleg van D&D-termen** (Concentration, Saving Throw, condities, schadetypes…) en **klikbare dobbelnotatie** (rol direct vanuit de tekst)
- Toetsenbordnavigatie (pijltjes) en een inhoudsopgave

### Vastgezette spreuken

- Spelers kunnen spreuken (uit de spellenreferentie) vastpinnen op hun dashboard

### Voorwerpen

- Kaartjes van items die de DM heeft toegewezen
- Losse aantekeningen — spelers kunnen zelf vrije tekstregels toevoegen

### Bladwijzers

- Spelers kunnen entiteiten als bladwijzer markeren (☆/★) — bladwijzers staan in een aparte sectie op het dashboard
- **Inspiratie** — DM kan per speler een inspiratietoken geven of verwijderen

### Emote-knoppen

- Tot 5 emotes tegelijk, ingesteld door de DM per speler
- Buiten gevecht: geluid speelt lokaal op het apparaat van de speler
- Tijdens gevecht: geluid wordt gebroadcast naar de DM-laptop

### Progressie (skill trees)

Onderaan het dashboard verschijnt automatisch een **progressie-tijdlijn (1–20)** op basis van de ingevulde **klasse**, **subklasse**, **soort**, **background** en **level** — geen handmatige invoer meer nodig.

- Per level zie je wat je personage ontgrendelt: **class- en subclass-features** (naam + volledige beschrijving), Ability Score Improvements, de subklasse-keuze en de Epic Boon
- Reeds bereikte levels zijn gemarkeerd, het huidige level uitgelicht en toekomstige levels als preview
- **Detailvenster** per feature: klik op een titel voor een modal met categorie-chip, level, type en de volledige regeltekst. **Soort-** en **background-onderdelen** delen dezelfde compacte titel-+-modal-opzet als de klasse-features
- **Hover-uitleg van D&D-termen** — in het detailvenster (en het spreukenboek) worden begrippen als *Saving Throw*, *Concentration*, *Frightened*, *Advantage* onderstreept; hover/tik geeft een korte uitleg
- **Categorie per feature** — automatisch ingeschat (Magic/Combat/Defense/Healing/Movement/Social/Knowledge/Senses/Talent) en door de DM te overschrijven; bepaalt icoon en kleur
- **Favorieten** — spelers markeren features met een ster en kunnen met één knop op **alleen favorieten** filteren (per speler opgeslagen)
- **Background** (2024) — de gekozen background toont een eigen sectie met Ability Scores, Origin-feat, Skill Proficiencies, Tool Proficiency en Equipment (16 PHB-backgrounds als startdata; alleen tonen, skills worden niet automatisch gezet)
- **Soort/ras-traits** en **background-onderdelen** verschijnen in aparte blokken; level-unlocks van soort-traits volgen het **totale** character-level (ook bij multiclass)
- **Multiclass** — elke klasse krijgt een eigen progressie (features gaan per klasse-level); de subklasse wordt automatisch aan de juiste klasse gekoppeld
- **Tolerante naam-matching** (hoofdletter-ongevoelig, met aliassen, bijv. "Magiër" → Wizard, "Chaos Sorcerer" → Sorcerer)
- **Officiële Engelse 2024-tekst** — alle feature- en trait-beschrijvingen komen uit de SRD 5.2 (CC BY 4.0, [`5e-bits/5e-database`](https://github.com/5e-bits/5e-database)), aangevuld met de niet-SRD subklassen/species/backgrounds uit het 2024-PHB. De data staat in `public/data/class-progression.json` + `public/data/backgrounds-2024.json`; de regeneratie-scripts in `scripts/srd-2024/`

#### De DM-editor

De **DM kan de volledige progressie bewerken** via de editor (potlood-knop):

- **Klassen, subklassen en soorten** — features per level toevoegen/bewerken/verwijderen, met categorie en eigen afbeelding/loop-video per feature
- **Feat-bibliotheek** — General Feats + Epic Boons met naam en beschrijving; deze voeden de keuzelijst die spelers op ASI- en Epic Boon-levels zien (leeg = SRD-standaard)
- **Backgrounds** — alle 16 PHB-backgrounds als startdata, vrij aan te passen of zelf aan te maken
- **Gedeelde markers** — ASI-, subklasse-keuze- en Epic Boon-levels worden automatisch in de tijdlijn getoond
- Aanpassingen worden **per campagne** opgeslagen; een (dubbel-bevestigde) reset zet alles terug naar de 2024-startdata

---

## Partybalk

- Spelersportretten (subtype `speler`) verschijnen automatisch in de header
- Klik op het bolletje per portret om aanwezigheid te registreren
- Aanwezige spelers links, afwezige spelers rechts (gedimd) met scheidingslijn

---

## Gevecht

### Opzet

- Voeg deelnemers toe: **monster**, **speler**, **bondgenoot** of **oproeping**
- Selecteer een monster uit de bibliotheek of voer handmatig in (naam, initiatiefwaarde, max HP, HP-modifier, initiatiefmodifier)
- Auto-voeg alle actieve spelers toe met een klik
- Sorteren op initiatiefwaarde; handmatig aanpassen vóór de start

### Actief gevecht

- Ronden bijhouden, beurten doorlopen (volgende/vorige beurt)
- HP en tijdelijk HP aanpassen per deelnemer (delta of directe waarde)
- Doodsreddingen bijhouden bij 0 HP
- **Condities** (20+): Blind, Bewusteloos, Betoverd, Boze oog, Brandend, Concentratie, Dood, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Exhaustion + klassespecifieke condities (Bardic Inspiration, Ki, Tides of Chaos, etc.)
- Automatische geluidseffecten bij schade, genezing, beurtwissel en rondewisseling
- Overwinningsgeluid bij einde gevecht

### Speleroverlay

- Gevechtsoverlay zichtbaar voor alle spelers in real-time
- Speler kan eigen HP aanpassen vanuit de overlay
- Minimaliseerbaar/uitvouwbaar

### Monsterbibliotheek

- Volledig CRUD voor monsters met naam, max HP, initiatiefmodifier, portret- en achtergrondafbeelding
- D&D 5e-statblok: ability scores (STR/DEX/CON/INT/WIS/CHA), skills, saves, weerstanden, immuniteiten, speciale acties, acties en legendarische acties
- 18 skills instelbaar per monster
- Organiseren per hoofdstuk
- Direct toevoegen aan een actief gevecht

---

## Documenten & Archief

### Documenten

- **Types**: Brief, Krant, Kaart, Manuscript, Kasboek, Notities, Folder, Gebed, Blauwdruk, Embleem, Visitekaartje, Gedicht, Dreigbrief, Catalogus, Menu, Audiofragment, Overig
- **Categoriefilter**: Brieven & Documenten, Gedrukte Pers, Kaarten, Codex & Emblemen, Audiofragmenten
- Afbeelding, PDF (max 50 MB) en audio uploaden, met inline viewer/speler
- Perkament-teksteditor met markdown-opmaakwerkbalk (vet, cursief, doorhalen, kleuren, kleine kapiteeltjes)
- **3-staps onthulling**: Verborgen → Wazig (vage outline) → Onthuld
- **Verborgen links** — DM kan koppelingen aan personen/locaties selectief verbergen
- DM-only links voor geheime verwijzingen die spelers nooit zien

### Sessielogboek

- Sessie-entries met datum, korte samenvatting, uitgebreide tekst, citaat en sfeergeluid
- Groepering per **akte** (hoofdstuk) met individuele inklapbaarheid
- Bannerafbeelding + focuspunt per akte
- Spelerssamenvatting per akte (voor spelers; DM schrijft aparte versie)
- Meerdere afbeeldingen per sessie, individueel onthuld door de DM
- Bij onthulling: afbeelding verschijnt automatisch als lightbox bij alle spelers
- Koppelbare entiteiten per sessie: nieuw (✨) of terugkerend (🔄)
- Gekoppelde documenten als klikbare chips (📜)
- Zoekfunctie over alle logboek-entries

---

## Kaarten

- Meerdere kaarten (stad, wereld) via tabs — DM kan kaarten aanmaken, hernoemen en verwijderen
- Ingebouwde kaarten: Grisburgh en Isfār
- Scroll-zoom (0,2× tot 5,0×), klik-en-sleep om te pannen, fit-to-viewport-knop
- **Locatiepins** koppelbaar aan een Locatie-entiteit; klikken opent het bijbehorende kaartje
- **Vage pins** tonen een `?`-overlay — spelers weten dat er iets is, maar zien geen details
- **Spelers kunnen locaties voorstellen** — de DM keurt goed of wijst af (pending-pin met pulsanimatie)
- DM kan pins plaatsen, verslepen en verwijderen
- Rustieke kaderrand rondom kaarten

---

## Herberg (Roddelwaard)

- DM configureert de herberg met naam, een NPC-portret, een achtergrondafbeelding en een begroetingstekst (met `{naam}`-placeholder)
- Spelers kunnen de waard bevragen voor **roddels** over zichtbare personages en locaties (gebaseerd op de flavour-tekst van die entiteit)
- Maximaal aantal vragen per sessie en een cooldown instellen
- De waard suggereert drie willekeurige entiteiten als gespreksonderwerp
- Het herbergtabblad is alleen zichtbaar als de herberg geconfigureerd is

---

## Grisburgh-diensten

Onder het **Diensten**-menu staan stadsdiensten waarmee spelers tussen avonturen door kunnen interacteren. Elke dienst is per groep aan/uit te zetten (DM-paneel → Diensten → **Toegang per groep**) en verschijnt alleen als hij geconfigureerd is.

| Dienst | Wat het doet |
|---|---|
| **De Tempel** | Bezoek de goden van Grisburgh. Per god een eigen priester, domein en gunsten. **Zegeningen** (tijdelijke voordelen via een dobbelworp), **Eden** (permanente bonus met een vloek-risico) en **Vloeken** (afkoopbaar met boete). Eed-cinema met typewriter-tekst; één eed en één zegening tegelijk |
| **Madame Ursula** | Voorspellingen via een zintuigenformulier (zien/horen/ruiken/proeven/voelen). De speler ontvangt een brief in de Berichten-tab. Alleen beschikbaar tijdens een actieve akte |
| **De Magizoöloog** | Onderzoekt wezens die de party heeft ontmoet; onthult per onderzoek een niveau meer in het bestiarium (naam → deels → volledig). Kost goud, met afkoeltijd |
| **Facties & Aanzien** | Organisaties waarmee de party een band opbouwt. Missies voltooien geeft **renown**; hogere rangen leveren automatisch **boons** (permanente voordelen in de knapzak) en **titels** op |
| **De Tweespalt** | Een kans-/gokdienst met instelbare regels |
| **De Gock** | Informatiedienst — naslag/zoeken binnen de campagne |

---

## DM-paneel (Meesterkamer ⚔)

Toegankelijk via de ⚔-knop rechtsonder.

| Tab | Functie |
|---|---|
| **Tunnel** | Start/stop een Cloudflare-tunnel en kopieer de deelbare URL |
| **Export** | Download de campagne als statisch HTML-snapshot of campagneboek |
| **Spreuken** | D&D 5e-spreukreferentie (naam, niveau, school, componenten, beschrijving) via live API; of Harry Potter-spreuken voor HP-campagnes |
| **Tafels** | Aangepaste willekeurige tabellen aanmaken en rollen; ingebouwde naam- en weergenerator |
| **Dobbel** | DM-dobbelsteenpaneel (d4, d6, d8, d12, d20, d%) met rollgeschiedenis |
| **Geluiden** | Gevechtsklanken (schade, genezing, winst, verlies) en speleremotes beheren |
| **Monsters** | Monsterbibliotheek CRUD, statblokken, per-hoofdstuk organisatie |
| **Gevecht** | Gevecht opzetten en beheren (deelnemers, beurten, condities, HP) |
| **Aktes** | Voorbereiding & regie per hoofdstuk; **akte-importer** zet een Obsidian-hoofdstuk (.md) om in een speelbaar regie-script, inclusief monster-/kaart-/entiteitkoppeling en stapsgewijze onthulling van kamers en dungeons |
| **Diensten** | Configuratie van alle stadsdiensten (Herberg, Tempel, Madame Ursula, De Magizoöloog, Facties & Aanzien, De Tweespalt, De Gock) en **toegang per groep** |
| **Herberg** | Naam, NPC-portret, achtergrond, begroetingstekst, max vragen en cooldown instellen |
| **Berichten** | Privéberichten naar individuele spelers sturen |
| **Campagnes** | Wisselen tussen meerdere campagnes of een nieuwe aanmaken |
| **Groepen** | Meerdere spelersgroepen beheren (elk met eigen zichtbaarheid, eigendom en winkelstatus) |
| **Instellingen** | Campagnenaam, ondertitel, thema en valutanamen aanpassen |

---

## Dobbelsteenpaneel

- Goudkleurig knopje rechtsonder in het scherm — schuift een paneel omhoog
- d4, d6, d8, d12, d20 en d% (percentagedés)
- Ticker-animatie bij elke gooi (versneld → vertraagd → uitkomst)
- d20 = 20 → **Critical Hit!** (groen), d20 = 1 → **Critical Fail!** (rood)
- Rolgeschiedenis van de laatste 10 gooien
- Toegankelijk voor zowel DM als spelers

---

## Geluidssysteem

### Gevechtsklanken (automatisch, DM-laptop)

- 💥 Schadesound bij schade
- 💚 Geneessound bij HP-herstel
- 🏆 Overwinnissound bij einde gevecht (spelers winnen)
- 💀 Verliesgeluid bij einde gevecht (monsters winnen)
- 🔔 Beurtsound bij nieuwe beurt
- 🥁 Rondebeginsound bij nieuw ronde

### Emotes

- DM maakt per speler een bibliotheek van emotes (emoji + label + audiobestand)
- Tot 5 emotes tegelijk actief per speler
- Spelers activeren emotes via het dashboard of de gevechtsoverlay
- Geluidsbestanden uploaden, testen en vervangen via het geluidenpaneel

---

## Groepenbeheer

- Meerdere spelersgroepen per campagne, elk met een eigen naam
- **Groep-specifieke data**: zichtbaarheidsstatus per entiteit, onthuld geheimen, deceased-flags, itemeigendom, claim-verzoeken, winkelstatus (uitverkocht, rotatie, kortingen)
- DM wisselt actieve groep via een balk bovenaan het DM-paneel
- Campagnewissel logt alle spelers automatisch uit

---

## Meerdere campagnes

- De server ondersteunt meerdere campagnes; elke campagne heeft eigen data in `data/campaigns/<id>/`
- DM kan wisselen via het DM-paneel → **Campagnes**
- Bij het aanmaken van een campagne worden alle JSON-bestanden en mappen automatisch aangemaakt

---

## Visueel ontwerp

- **Perkamentthema** — linnenpatroon over de volledige achtergrond
- **Lettertypes** — Cinzel (koppen), Crimson Text (broodtekst), IM Fell English (decoratief), JetBrains Mono (code)
- **Sectiebanners** — sfeervolle koptekst per sectie met een type-specifiek gekleurd icoonblokje, Cinzel-label en cursieve ondertitel; ornamentlijn met ◆
- **Type-tint op kaartjes** — subtiele achtergrondkleur per entiteitstype (groen/blauw/rood/goud/paars)
- **Zeldzaamheid-behandeling** — voorwerp-kaartjes krijgen een gekleurde rand en gloed per rariteit (Common → Legendary), met een glans-sweep over Very Rare & Legendary en de rariteit in kleur in de detailweergave
- **Actieve tab-indicator** — goudkleurige onderlijnmarkering op het actieve tabblad
- **3D tilt** op kaartjes bij hover (CSS `perspective`)
- **Kleurgloed** op hover per entiteitstype (groen/blauw/rood/goud)
- **Klassethema's** — spelers kunnen een themakleur per klasse activeren (bijv. paars voor Warlock, blauw voor Wizard)
- **Toast-notificaties** bij onthullingen, bladwijzers en socket-events
- **Responsive** — werkt op mobiel (phone) en tablet

---

## Performance

| Optimalisatie | Effect |
|---|---|
| **Gzip-compressie** (`compression` package) | JS + CSS: ~950 KB → ~210 KB (4,5× kleiner) |
| **Lazy loading** op afbeeldingen | Alleen zichtbare afbeeldingen worden geladen |
| **WebP-thumbnails** via `sharp` (600 px breed, quality 82) | Gemiddeld ~94% kleiner per afbeelding |
| **Thumbnail-cache** in `data/.../thumbs/` | Eenmalig gegenereerd, daarna direct geserveerd |
| **Browser-caching** (JS/CSS: 1 uur, afbeeldingen: 1 week) | Tweede bezoek vrijwel zonder downloads |
| **Versienummers** op JS/CSS-imports (`?v=xx`) | Automatische cache-invalidatie bij deployments |

---

## Importeren vanuit Obsidian

Entiteiten (personages, locaties, organisaties, voorwerpen) en documenten importeer je
**in de app**: DM-paneel → Exporteren/Importeren → "Markdown-bestanden importeren". Deze route
is campagne-bewust (loopt via `lib/storage.js`) en herkent het `type`-veld in de frontmatter.

> De oude losse CLI-scripts (`import-schaduwvin.js`, `import-obsidian.js`, `import-verhaal.js`)
> zijn verwijderd: ze schreven naar een legacy data-pad dat de server niet meer leest.
> De in-app import vervangt de entity- en documentimport.

---

## Projectstructuur

```
server.js                  # Express + Socket.io entry point; gzip-compressie, caching
config.js                  # Poort, DM-wachtwoord, session secret
routes/
  api.js                   # REST API (100+ endpoints) + server-side filtering + thumbnail-route
  auth.js                  # DM-login + requireDM/attachRole middlewares
lib/
  storage.js               # JSON-bestandsopslag + afbeeldingen/PDFs/audio per campagne
  snapshot.js              # HTML-snapshot en campagneboek-export
public/
  index.html               # SPA-shell (Tailwind CSS + PDF.js + Socket.io)
  assets/                  # Statische kaartafbeeldingen
  js/
    app.js                 # App-shell, auth, modals, sectionrouting, dobbelsteenpaneel,
                           #   spelersdashboard, spreukenboek + D&D-term-glossary, diensten (tempel etc.)
    render-campagne.js     # Entity CRUD, kaarten, winkels, eigendom, filters, zoeken
    render-archief.js      # Documenten, logboek, akte-editor, PDF-viewer, audiospeler
    render-progressie.js   # Progressie-tijdlijn + DM-editor (klassen, soorten, feats, backgrounds)
    render-bestiarium.js   # Bestiarium-kaarten + onthullingsniveaus
    render-statblock.js    # Monster-statblok-modal
    render-kaart.js        # Interactieve wereld-/stadkaarten met zoom, pan en locatiepins
    render-dungeon.js      # Dungeon-kaarten met kamer-onthulling
    render-relatiemap.js   # Cytoscape-relatienetwerk tussen entiteiten
    dm-panel.js            # DM-paneel: alle tabs (gevecht, aktes, diensten, spreuken, geluiden, etc.)
    api.js                 # Fetch-wrapper, fileUrl, thumbUrl, entity name lookup
    socket-client.js       # Real-time updates en geluidsevents via Socket.io
    combat-canvas.js       # Canvas-gebaseerde gevechtsvisualisatie
    sound-manager.js       # Geluidsbeheer (laden, afspelen, emotes)
  data/                    # Meegeleverde startdata (SRD 5.2 2024)
    class-progression.json # Klassen, subklassen, soorten + features per level
    backgrounds-2024.json  # 16 PHB-backgrounds
    feature-descriptions.json # Engelse SRD-feature/feat-beschrijvingen
scripts/
  srd-2024/                # Regeneratie van de Engelse 2024-progressiedata (5e-bits + 5etools)
  css/
    theme.css              # Volledig perkamentthema (kaartjes, modals, panelen, animaties, thema's)
data/                      # Persistente data (gitignored)
  campaigns/
    <campaign-id>/
      entities.json        # Alle entiteiten
      archief.json         # Documenten + sessielogboek
      dm-state.json        # Zichtbaarheid, eigendom, groepen, winkelstatus
      meta.json            # Campagnemeta, hoofdstukken, herberg, valutanamen
      combat.json          # Actieve gevechtsstatus
      map.json             # Kaartpins
      monsters.json        # Monsterbibliotheek
      sounds.json          # Geluidsconfiguratie
      shop-log.json        # Aankooplogboek per winkel
      files/               # Geüploade afbeeldingen, PDFs en audio
      thumbs/              # Gegenereerde WebP-thumbnails (automatisch)
tests/                     # Automatische tests
```

---

## Scripts

| Commando | Functie |
|---|---|
| `npm start` | Server starten |
| `npm run dev` | Server starten met auto-reload |
| `npm test` | Tests draaien |
| `npm run test:watch` | Tests met auto-reload |
| `npm run tunnel` | Cloudflare Tunnel starten |

---

## Data & Back-up

Alle data staat in `data/` als JSON-bestanden. Deze map is gitignored. Afbeeldingen, PDFs en audiobestanden staan in `data/campaigns/<id>/files/`. Automatisch gegenereerde thumbnails staan in `data/campaigns/<id>/thumbs/` — deze map kan veilig verwijderd worden; thumbnails worden opnieuw aangemaakt bij het eerste verzoek.

**Back-up** = de volledige `data/`-map kopiëren.
