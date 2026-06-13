# Speel-Akte — Uitbreidingsanalyse

**Datum:** 13 juni 2026  
**Status:** Denkdocument, geen implementatie

---

## Huidige staat (samenvatting)

De speel-akte is al een volwaardig regiesysteem: de DM bouwt per hoofdstuk een **regie-script** van items (afbeeldingen, entiteitskaartjes, encounters, dungeon-kamers) en onthult die één voor één via de **regie-balk**. Geluid kan per item worden gekoppeld. Een voortgangsteller (X/Y) toont hoever de avond is.

Wat er **niet** in zit, maar wel logisch bij hoort:

---

## 1. Long Rest / Short Rest als script-item

### Wat het is
Een rust is een harde tijdsgrens in een D&D-sessie — niet alleen een UI-gebaar maar een **mechanisch ankerpunt**: spell slots keren terug, Hit Dice worden ingezet, abilities resetten. Op dit moment bestaat er geen manier om een rust in de tijdlijn van een speel-akte te markeren of te triggeren.

### Wat het zou kunnen doen

**Short Rest (1 uur):**
- Verschijnt als speciaal script-item (type `rest`, subtype `short`)
- Bij onthullen: animatie + toast op spelerstafel ("De groep rust een uur uit")
- Optioneel: Hit Dice-invoer per speler (DM ziet wie hoeveel gooit — nu buiten scope)
- Maakt de rust zichtbaar in de terugblik (logboek-tijdlijn)

**Long Rest (8 uur):**
- Zelfde mechaniek maar zwaarder filmisch gewicht: zwart scherm, ambient geluid, ochtendscène
- Zou automatisch de **in-game dag** kunnen ophogen als `dag` bijgehouden wordt in de akte-metadata
- Koppelbaar aan de tempel (gaat de groep in een herberg slapen → selecteerbaar als locatie-backdrop)
- Stuurt een Socket-event `rest:long` → speler-tabs kunnen in de toekomst spell-slots resetten

### Hoe het in het script past
```
[script-item]  type: 'rest'
               subtype: 'short' | 'long'
               label: 'Rust in de Gouden Schaal' (vrij in te vullen)
               soundFileId: optioneel
               dagVoortgang: +1 (alleen bij long rest, optioneel)
```

De regie-balk toont het als een aparte kaart met een maan- of zon-icoon; bij onthullen gaat een filmische overlay op de spelerstablet.

---

## 2. Vage staat van een entiteitskaartje

### Wat het is
Entiteiten zijn nu binair: **verborgen** (spelers zien niets) of **zichtbaar** (volledig kaartje met naam, afbeelding, beschrijving). Maar het verhaal kent een derde modus: de groep *weet dat iets bestaat* zonder te weten wat het precies is. Een schaduwfiguur op de markt, een ruïne in de verte, een naam die fluisterend wordt genoemd.

### De drie staten
```
hidden  →  vague  →  revealed
```

| Staat | Wat de speler ziet |
|---|---|
| `hidden` | Niets — kaartje bestaat niet voor hen |
| `vague` | Kaartje zichtbaar maar gereduceerd: alleen `vagueName` (bijv. "Onbekende figuur"), eventueel een vaag silhouet, geen beschrijving |
| `revealed` | Volledig kaartje zoals nu |

### Implementatie-idee

**Datamodel (uitbreiding entities):**
```json
{
  "visibility": {
    "groep_X": {
      "state": "vague",
      "vagueName": "Een geheiligde man in het zwart",
      "vagueType": "personage"
    }
  }
}
```

**Script-item `entity` krijgt een extra veld:**
```
revealLevel: 'vague' | 'revealed'   (default: 'revealed' — gedrag zoals nu)
```

**Regie-balk:** twee aparte stappen zichtbaar per entiteit als de DM beide wil inzetten:
- Stap 1: "Onthul vaag" → zet staat op `vague`
- Stap 2: "Onthul volledig" → zet staat op `revealed`

**Spelerskant:** vage kaartjes tonen als vervaagde perkamentkleur, naam in cursief, geen details, een vraagteken-icoon. Klikken opent geen detailmodal.

### Waarde
Dit is de meest realistische uitbreiding. D&D draait voor een groot deel om *geleidelijke kennisopbouw*. Een volledig binaire zichtbaarheid dwingt de DM te kiezen: alles verbergen of alles laten zien. De vaagheid-laag geeft die tussenruimte terug.

---

## 3. Geheimen als script-item

### Wat het is
Geheimen zijn informatie die niet aan een kaartje of afbeelding gekoppeld zijn maar aan **kennis zelf**: de ware identiteit van een NPC, de reden waarom een locatie vervloekt is, de inhoud van een akte die pas later relevant wordt. Nu is er geen plek voor zulke "floating revelations" in het script.

### Soorten geheimen

**A. Gedeeld geheim** — iedereen aan tafel hoort het gelijktijdig  
- Verschijnt als filmische banner op de spelerstablet met een tekst ("Je beseft nu dat de burgemeester de moordenaar was")
- De DM schrijft het van tevoren in het script

**B. Persoonlijk geheim** — alleen voor één karakter  
- Vergelijkbaar met het bestaande briefsysteem maar lichter: geen envelop, wel een privé-toast
- Onthult iets dat alleen dat karakter ontdekt (een herkend gezicht, een herinnering)
- DM kiest bij aanmaken: voor wie?

**C. Geheim gekoppeld aan entiteit**  
- Wordt bij een kaartje opgeslagen als `entity.secrets[]` 
- Pas beschikbaar in het script nadat de entiteit `revealed` is
- Richt zich op een dieper niveau van kennis (na de eerste onthulling volgt later een tweede laag)

### Script-item
```
type: 'secret'
subtype: 'shared' | 'personal'
targetCharId: string | null   (alleen bij personal)
title: 'Werkelijke naam van de koopman'
body: 'Tekst die de speler(s) te zien krijgen'
soundFileId: optioneel
```

### Relatie tot bestaand briefsysteem
Het bestaande `_bezorgBrief` is zwaarder: envelop-animatie, lakzegel, factie-thema. Geheimen zijn lichter en sneller — meer een whisper dan een brief. Ze kunnen naast het briefsysteem bestaan zonder het te vervangen.

---

## 4. Overige kandidaten voor uitbreiding

### 4a. Voorwaardelijke onthulling (conditionals)
Een script-item wordt pas klikbaar nadat een ander item onthuld is. Visueel: grijze kaart met slotje totdat de afhankelijkheid voldaan is. Gebruik: "onthul de crypte pas nadat de burgemeester gesproken heeft."

Technisch eenvoudig: elk item krijgt optioneel `requiresId: string`. De regie-balk checkt `_rbRevealed` voor het tonen van de reveal-knop.

### 4b. Beslissingspunten (branch markers)
Een speciaal item dat de DM vraagt: "Welke kant gaat de groep op?" en twee (of meer) vertakkingen toont. Het tweede script-blok wordt dan actief. Zwaarder te implementeren maar enorm waardevol voor aftakkende verhalen.

### 4c. Tijdsmarkering / in-game klok
Naast `dag` een `tijd`-veld per akte of per script-item. Automatische voortgang bij long rest. Zichtbaar in de regie-balk als een kleine klok. Koppelbaar aan tempel-diensten die alleen overdag beschikbaar zijn.

### 4d. Recap-modus
Na afloop van een avond: de DM klikt "Recap" → alle onthuld items worden herhaald als een film (slideshow) inclusief de bijbehorende geluiden. Goed voor het begin van de volgende sessie ("In de vorige aflevering...").

De technische basis is er al: `_rbRevealed` bevat alle onthuld item-IDs; de volgorde staat in `_rbScript`.

### 4e. Spelerinput-moments
Script-items van type `player-choice` die de DM pauzeert voor vrije spelerinvoer — een naam kiezen, een keuze maken die wordt vastgelegd. Output wordt opgeslagen in de logboektijdlijn als "Beslissing van de groep." Gebruik: benaming van een schip, eden, verbonden.

### 4f. Kenniskaart per groep
Een apart "wat weet groep X"-scherm voor de DM: alle entiteiten per staat (hidden/vague/revealed) per groep, gesorteerd op categorie. Nu moet de DM dat bijhouden in zijn hoofd. Een read-only overzicht per groep zou dat direct inzichtelijk maken.

---

## Prioritering

| Prioriteit | Uitbreiding | Complexiteit | Impact |
|---|---|---|---|
| 1 | **Vage staat** (§2) | Middel | Hoog — raakt elke avond |
| 2 | **Geheimen als script-item** (§3) | Laag | Hoog — vult bestaand briefsysteem aan |
| 3 | **Long/Short rest** (§1) | Laag–Middel | Middel — mechanisch ankerpunt |
| 4 | **Voorwaardelijke onthulling** (§4a) | Laag | Middel — regisseurs-kwaliteitssprong |
| 5 | **Recap-modus** (§4d) | Laag | Middel — weinig code, groot comfort |
| 6 | **Beslissingspunten** (§4b) | Hoog | Hoog — vergt UX-design |
| 7 | **Kenniskaart per groep** (§4f) | Middel | Middel — hulpmiddel voor DM |
| 8 | **Tijdsmarkering** (§4c) | Laag | Laag voorlopig |
| 9 | **Spelerinput-moments** (§4e) | Middel | Laag voorlopig |

---

## Aandachtspunten bij implementatie

- **Vage staat vereist migratie** van de bestaande `visibility`-structuur (nu een boolean per groep, wordt een object).  
  Backwards-compatible: `true` → `{ state: 'revealed' }`, `false` → `{ state: 'hidden' }`.

- **Geheimen moeten per campagne opgeslagen worden**, niet in de meta — ze bevatten spelersgerichte tekst. Logisch thuis in `archief.json` naast de bestaande `brieven[]`.

- **Long rest en de in-game dag** zijn nu handmatig bijgehouden velden. Automatisch ophogen vraagt dat we de dag als canonical state beschouwen — dat is nu niet zo. Voorzichtig mee zijn.

- **Vage kaartjes in render-campagne.js en render-archief.js**: beide bestanden renderen entiteitskaartjes. Een nieuwe staat moet in beide worden doorgevoerd (zie CLAUDE.md over archief-tabbladen in meerdere bestanden).
