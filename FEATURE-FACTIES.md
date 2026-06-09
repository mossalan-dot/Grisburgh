# Feature-plan: Facties & Missies

_Concept op basis van gesprek juni 2026. Nog niet geïmplementeerd._

---

## Visie

Facties worden een volwaardige dienst, visueel en qua logica identiek aan De Tempel.
Elke factie heeft een **locatie-backdrop**, een **NPC-portretje** (hoofd/guildmaster) en
een eigen sfeer. Spelers nemen missies aan, stijgen in rang en ontvangen boons.
**De Heeren van de Nacht worden volledig opgenomen als factie** — de aparte dienst-tab verdwijnt.

---

## 1. Factie-pagina (spelersweergave)

### Lijst-view (huidige tab)
- Toont alle voor de groep **onthulde** facties als kaartjes (embleem + naam + rang)
- Chip rechtsboven: huidig renown / rang
- Klik → interieur-view van die factie

### Interieur-view (nieuw, zoals tempel)
```
[ ← Terug ]                           [ Beurs: xxx fl ]
        [ Backdrop = locatie van de factie ]
           [ Portretje = NPC-hoofd ]
              Naam van het hoofd
         "Welkom, avonturier. Wat brengt je hier?"
  ──────────────────────────────────────────────────
  📜 Rang: Loper (renown 7 / 10 voor volgende)
  🎁 Boon: Schaduwmantel — bekijk boon
  ──────────────────────────────────────────────────
  [ Beschikbare missies ]
  [ Actieve missies ]
```

- **Terug-knop** subtiel linksboven (zoals tempel)
- **Beurs** rechtsboven
- **Rang + renown-balk** compact, zoals tempel-zegen-chip
- **Boons**: compacte regel per ontvangen boon, met link naar voorwerpkaartje
- **Missies**: zie §3

---

## 2. Factie-configuratie (DM-paneel)

Huidige velden + nieuw:

| Veld | Type | Beschrijving |
|---|---|---|
| Naam | tekst | Weergavenaam factie |
| Embleem | icon-picker | Factie-icoon |
| Beschrijving | textarea | Sfeer/achtergrond |
| Kleur berichten | select | Stijl van chatberichten (hout/metaal/staal/standaard) |
| **Locatie-entity** | select | Entiteit waarvan backdrop + naam gebruikt wordt |
| **NPC-hoofd-entity** | select | Entiteit waarvan portret + naam gebruikt wordt |
| **Priester-groet** | tekst | Openingszin van het hoofd |
| Renown-drempels | kommalijst | bijv. 0,1,3,10,25,50 |
| Rangen | lijst | naam + omschrijving + boons per rang |

_Locatie- en NPC-entity werken identiek aan de tempel (bestaand patroon)._

---

## 3. Missies

### Aanmaken (DM)
Missies worden aangemaakt in het **Logboek** (bestaand, uitbreiden):
- Nieuw veld: **Factie** (koppeling aan een factie-id)
- Nieuw veld: **Vereist renown** (minimaal niveau om de missie te zien)
- Nieuw veld: **Renown-beloning** (hoeveel renown bij voltooiing)
- Nieuw veld: **Kleurtje** (overgenomen van factie-kleur, of eigen override)
- Status: `beschikbaar` → `aangevraagd` → `actief` → `voltooid` / `gefaald`

### Zichtbaarheid (spelersview)
- Missie zichtbaar in factie-interieur als:
  - factie is onthuld voor groep
  - speler heeft ≥ vereist renown
  - status = `beschikbaar`

### Accepteren
1. Speler klikt "Accepteer" → missie gaat naar status `aangevraagd`
2. **DM krijgt een melding** (toast + badge in DM-paneel): "[naam] wil missie X accepteren"
3. DM keurt goed → missie wordt `actief` voor de hele groep, socket-event naar alle spelers
4. DM weigert → missie blijft `beschikbaar`, speler krijgt een melding
5. Actieve missies verschijnen in het **Missies-tabblad** (nieuw subtab in Archief of eigen sectie)

### Voltooien / falen (DM)
- DM markeert missie als **voltooid** in logboek/DM-paneel
  - Renown automatisch opgehoogd voor de hele groep
  - Boons van het nieuwe rangniveau automatisch in de knapzak
  - Valuta → groepskas (gedeelde beurs) of gelijkmatig verdeeld per speler
  - Socket-events: `factie:renown-updated`, `missie:voltooid` → toast bij spelers
- DM markeert missie als **gefaald** (bijv. tijdsverloop, gemiste kans)
  - Geen beloning; missie verdwijnt uit actief-lijst
  - Optioneel: renown-verlies instellen per missie
  - Socket-event: `missie:gefaald` → melding bij spelers
- Beide acties via DM-paneel (logboek of factie-sectie)

---

## 4. Eed/vloek-systeem (toekomst)

Analoog aan de tempel, maar facie-specifiek:
- Factie-eed: speler zweert trouw → +bonus, bij verzaking → factie-vloek
- Eed-cinema identiek aan tempel
- Vloek: DM onthult, speler kan "boete doen" (een taak uitvoeren i.p.v. betalen)
- Per factie configureerbaar of eden mogelijk zijn

_Nog niet uitgewerkt — later aanpakken als missies stabiel zijn._

---

## 5. De Heeren van de Nacht — migratie

De aparte "Heeren van de Nacht" dienst-tab wordt **verwijderd**. In de plaats:
- Heeren wordt een gewone factie in de factie-lijst
- Jobboard (klussen) worden missies in het missie-systeem
- Renown/rang-logica (Hagenhoeder, etc.) blijft behouden via de factie-rang-config
- **Uitbetaling**: missies kunnen een `fl`-beloning hebben naast renown
  (dit is nieuw t.o.v. de tempel — facties kunnen betaald werk aanbieden)
- Leningen: apart uitzoeken of dit in de factie past of een eigen mechanic blijft

### Data-migratie
- Bestaande `dmState.groups[gid].heeren` → `dmState.groups[gid].facties['heeren_id']`
- Bestaande jobs → missies met `factieId = heeren_id`, status = huidige status
- Script schrijven om dit te converteren bij deploy

---

## 6. Technische architectuur

### Data-model (nieuw)

```
meta.json:
  facties: [
    {
      id, naam, embleem, beschrijving, stijl,
      locatieEntityId, npcEntityId, npcGreet,
      renownDrempels: "0,1,3,10,25,50",
      rangen: [{ naam, voordelen, boons: [{ entityId, naam }] }]
    }
  ]

dm-state.json (per groep):
  facties: {
    [factieId]: { renown: 12, zichtbaar: true }
  }

archief.json (uitbreiden logEntries met missie-type):
  logEntries: [
    {
      id, title, tekst, factieId, vereistRenown,
      renownBeloning, valutaBeloning: { fl, kn, cl },
      status: 'beschikbaar'|'actief'|'voltooid'|'gefaald',
      geaccepteerdDoor: [characterId, ...],
      akkoordVan: [characterId, ...]   // voor unaniem-check
    }
  ]
```

### Nieuwe API-endpoints
- `GET /facties` — lijst + groep-state (renown, zichtbaar, boons)
- `PUT /facties/:id/reveal` — onthul factie voor groep
- `POST /facties/:id/missie/:missieId/accepteer` — stem uitbrengen
- `PUT /facties/:id/missie/:missieId/voltooid` — DM markeert voltooid → renown flush + valuta-uitkering
- `GET /missies` — actieve/beschikbare missies voor speler

### Socket-events
- `factie:updated` — renown/rang/boon gewijzigd
- `missie:accepteer-verzoek` — alle groepsleden krijgen de notificatie
- `missie:geactiveerd` — missie is unaniem geaccepteerd
- `missie:voltooid` — renown-update + toast

---

## 7. Implementatievolgorde (aanbevolen)

1. **Factie-interieur pagina** (backdrop + portret + rang, zonder missies)
2. **DM-config uitbreiden** (locatie/NPC-entity, groet)
3. **Missies aanmaken in logboek** (nieuwe velden)
4. **Missies tonen in factie-interieur** (beschikbaar voor spelers)
5. **Accepteer-flow** (unaniem + socket)
6. **Voltooien + renown-flush**
7. **Heeren-migratie**
8. **Eed/vloek** (later)

---

## Openstaande vragen

- [x] Kunnen missies ook door individuele spelers (niet de hele groep) worden geaccepteerd als noodoplossing?
  → Speler vraagt aan, DM keurt goed. Geen unaniem-mechanisme nodig.
- [x] Moeten boons bij rang-up automatisch worden uitgedeeld, of kiest de speler (zoals tempel-dobbelworp)?
  → **Automatisch** bij rang-up. Alle boons van de nieuwe rang worden direct in de knapzak gezet.
- [x] Valuta-beloning bij missies: gaat dat naar de groepskas of per speler verdeeld?
  → **Groepskas** als gedeelde beurs ingesteld is. Anders eerlijk verdeeld over alle groepsleden
    (afronden naar beneden per speler, rest verdwijnt — of naar de groepskas als die later
    alsnog ingesteld wordt).
- [x] Hoe gaat het met missies die "verlopen" — time-out door de DM, of altijd beschikbaar?
  → DM markeert handmatig als gefaald. Geen automatische time-out.
- [x] Factie-specificieke chat/berichten: behouden we de stijl-kleur voor factie-gerelateerde log-entries?
  → Ja, elk factie behoudt zijn eigen kleur in het logboek.
