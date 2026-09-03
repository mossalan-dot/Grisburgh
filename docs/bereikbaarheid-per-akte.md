# Bereikbaarheid per akte — ontwerp

Status: **gebouwd** (4 sep 2026). Dit document blijft staan als verantwoording
van de keuzes; de werking staat in CLAUDE.md.
Vervangt de globale schakelaar "Grisburgh verlaten" door iets dat de akte volgt.

---

## Wat er nu is

`meta.buitenGrisburgh` — één schakelaar voor de hele campagne. Staat hij aan,
dan zijn voor spelers **alle** diensten dicht (herberg, tempel, magizoöloog,
Ursula, de Heeren) én verdwijnt de voorraad bij winkel-entiteiten; de kaart toont
"is momenteel niet bereikbaar". Daarnaast `meta.buitenGrisburgEntiteiten`: een
lijst uitzonderingen die wél bereikbaar blijven.

Het is dus handwerk: de DM zet de knop om als de party de stad verlaat, en weer
terug als ze thuiskomen.

## Waarom het aan de akte hoort

Bereikbaarheid is geen eigenschap van de campagne maar van **waar de party is**,
en dat volgt uit de akte die ze spelen. Wat in Grisburgh staat is bereikbaar
tijdens een Grisburgh-akte; wat in het Amberwoud staat tijdens een Amberwoud-akte.

Dat hoeft niets nieuws te leren: **`groups[gid].activeAkte` bestaat al**. De
server weet per party welke akte loopt (`_activeAkteVoor()`).

## Het model

Per akte een lijst van wat er **niet** bereikbaar is — dus uitvinken, niet
aanvinken. Zelfde redenering als bij de aanwezigheid: voeg je later een dienst
toe, dan is die overal automatisch bereikbaar en hoef je geen twintig aktes na te
lopen.

```
meta.hoofdstukken[key].onbereikbaar = {
  diensten:   ['tempel', 'magizoo', …],   // sleutels uit _DIENST_SVC_KEYS
  entiteiten: ['e_…', …],                 // winkels en verkopers
}
```

Beide soorten doen mee: **diensten én winkel-entiteiten**, want de huidige
schakelaar doet dat ook.

Er ontstaan twee lagen die allebei waar moeten zijn:

| Laag | Vraag | Waar |
|---|---|---|
| Groep | Kent deze party deze dienst? | `groups[gid].dienstenToegang` (bestaat) |
| Akte | Zijn we er in de buurt? | `meta.hoofdstukken[key].onbereikbaar` (nieuw) |

## Beslissingen

- **De handmatige knop blijft** als overschrijving. Een akte kan halverwege
  verhuizen (begint in de stad, eindigt in het bos); dan wil je niet je akte
  gaan bewerken. Per akte instellen + handmatig bijsturen is het compromis;
  per akte-**stap** is preciezer maar levert veel klikwerk bij het voorbereiden
  voor een randgeval.
- **Geen akte actief?** Dan blijft de instelling van de laatst gespeelde akte
  gelden. Er verandert pas iets bij de volgende akte. `activeAkte` wordt dus niet
  leeggemaakt — precies zoals het nu al werkt.
- **Waar stelt de DM het in:** bij het aanmaken van een akte (`_akteNieuw`) en
  later te wijzigen bij het bewerken ervan.

## Migratie

`buitenGrisburgEntiteiten` is de huidige uitzonderingenlijst en gaat op in de
per-akte-lijsten. `meta.buitenGrisburgh` blijft bestaan als de handmatige
overschrijving.
