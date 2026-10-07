# Houding van personages — het bouwplan

Werkdocument, 6 oktober 2026, bijgewerkt 8 oktober. **Stap 1 tot en met 4 zijn
gebouwd**; 5 en 6 liggen er nog. Dit is de spec (`houding-npc-spec.md`) langs de
code gelegd: wat klopt, wat niet, en in welke volgorde het gebouwd wordt.

De spec is geschreven voor `grisburgh-campagne-7.html` — de oude
één-bestandsversie. Het idee staat als een huis; vijf aannames over de app
kloppen niet meer, en die staan hieronder vóór het plan, want ze veranderen het
werk.

## Wat er al is (en dus niet gebouwd hoeft)

| | stand |
|---|---|
| **De glans** | `@keyframes card-sheen` bestaat, op `::before` van `[data-rarity="very-rare"]` en `="legendary"` (`theme.css` ~20766). Een baan van 55 % breed, `skewX(-18deg)`, 6,5 s (very rare 8 s). |
| **De zeldzaamheidsvariabelen** | `--rar` en `--rar-soft` staan al per rariteit op het kaartje. Precies de vorm die de spec voorstelt. |
| **Passive Insight** | Staat op het spelerblad (`lib/character-sheet.js`, `PASSIEF`), berekend als `10 + skillbonus`, inclusief proficiency. |
| **Speler ↔ apparaat** | `playerSockets` (characterId → socket.id, `server.js` 313) weet wie waar zit. Een toast naar één telefoon kan. |
| **Typewissel bij onthulling** | Bestaat per geheim (`geheimenAntagonist`); dit najaar herschreven naar de regelvorm. Een onthulling kán dus een houding meezetten. |
| **DM-notities** | `persoonlijkheid`, "Aantekeningen voor de DM". Daar hoort het waaróm, zoals de spec zegt. |

## Vijf dingen die de spec anders aanneemt dan de app werkt

### 1. De glans loopt eindeloos door, en de spec wil hem één keer
Nu: `animation: card-sheen 6.5s ease-in-out infinite` — altijd, ook in rust.
De spec wil niets in rust en één doorloop bij hover. Dat is geen detail: het is
precies het verschil tussen "dit is een duur voorwerp" en "dit personage voelt
zo over jou". Als houding dezelfde eindeloze baan krijgt, staat het hele
personagetabblad te glimmen.

**Gevolg:** de bestaande glans wordt óók omgebouwd naar één doorloop bij hover,
of houding krijgt een eigen timing. Dat is een zichtbare wijziging aan de
voorwerpen, dus een aparte beslissing — niet iets om stilletjes mee te nemen.

### 2. `::before` en `::after` zijn op het kaartje al bezet
Op `.entity-card` zitten ze al op vijf plekken: `card-goddelijk--eed`,
`card-boon`, `card-protagonist` (beide), `card-goddelijk--vloek` en
`[data-rarity]` (de ring op `::after`, de glans op `::before`). Een personage
dat protagonist én een houding heeft, botst.

**Gevolg:** de glans krijgt een **eigen element** in het kaartje
(`<span class="kaart-glans">`), aangestuurd met variabelen. Dan werkt hij op
voorwerpen, personages én facties zonder ergens mee te vechten, en is er één
plek die het effect kent.

### 3. De vier "types" zijn geen types
De spec kent `npc / verkoper / huisdier / antagonist`. De app kent vier
**subtypes** (`NPC, speler, dier, god`) en daarnaast **rollen** in `data.tags`.
Verkoper en antagonist zijn rollen, huisdier is `subtype: 'dier'`.

**Gevolg:** de standaardtabel leest `window._heeftRol(e, 'antagonist')`,
`_heeftRol(e, 'verkoper')` en `e.subtype === 'dier'` — in die volgorde, want een
antagonist die ook koopman is, is eerst antagonist. En er komt een vijfde rij
bij: **god**. Een god heeft geen houding tegenover de groep op deze schaal; die
krijgt er geen.

### 4. Renown kan niet onder nul
`nieuwRenown = Math.max(0, oudRenown + delta)` (`api.js` 14318). De ladder heeft
zes treden (0 = Buitenstaander, dan 1 / 3 / 10 / 25 / 50). Je kunt renown dus
wel verliezen tot nul, maar een factie kan via renown nooit vijandig worden.

**Gevolg:** de vertaaltabel loopt maar over de helft van de schaal:

| rangIdx | renown | houding |
|---|---|---|
| 0 | 0 | 3 — onverschillig (buitenstaander) |
| 1 | 1 | 3 |
| 2 | 3 | 4 |
| 3 | 10 | 4 |
| 4 | 25 | 5 |
| 5 | 50 | 5 |

Een vijandige factie zet de DM zelf op 1 of 2. Dat is geen gat maar een
eerlijke grens: renown meet aanzien, niet vijandschap. Het hoort wel in de
hulpknop te staan, anders zoekt een DM naar een schuifje dat er niet is.

### 5. "Handmatig te overschrijven, net als passive perception"
Passive perception is **niet** handmatig te overschrijven. Alle drie de
passieve scores worden berekend en er is nergens een veld.

**Gevolg:** kiezen. Of we bouwen de overschrijving voor alle drie (dan hoort
het bij het spelerblad, niet bij deze feature), of de insight-DC is de enige
knop die de DM heeft. **Voorstel: het tweede.** De DC per personage doet al
wat de overschrijving zou doen — een speler die te makkelijk doorheeft wat
iemand voelt, krijgt een hogere DC, en dat is de knop die bij de tafel hoort.

## Nog twee dingen die de spec openlaat

**Waar staat "wie heeft het al gezien"?** Twee nieuwe standen: per personage of
iemand in de groep de DC haalde, en per speler welke houding hij al zag. Dat is
party-gebonden, net als de onthulstand van roddels en geheimen. Die ligt sinds
deze week bij de party (`_roddels`), en dit hoort op dezelfde plek — anders
staat één soort "wie weet wat" op twee plekken.

**Bij `prefers-reduced-motion` doet de app nu `display: none`.** De spec wil
daar juist iets: een korte vervaging naar de tint van de houding. Dat is beter
dan niets — de informatie blijft, alleen de beweging verdwijnt — maar het
betekent dat de bestaande regel wordt vervangen, niet aangevuld.

## Wat er staat (8 okt 2026)

- `lib/houding.js` — de hele schaal: vijf treden met naam, DMG-houding, uitleg,
  glansvariabelen en toasttekst, plus de regel (`gelden`), de standaard per rol
  (`standaardVoor`), de renownvertaling (`vanRenown`), wie het mag zien
  (`magZien`) en de DC (`insightDC`). 21 tests.
- `.kaart-glans` in `theme.css` — de baan als eigen element, aangestuurd met
  `--glans-kleur / -sterkte / -duur / -blend`, in twee smaken: `--altijd`
  (voorwerpen, doorlopend) en `--hover` (personages, één keer). De
  rariteitsglans loopt sindsdien over dezelfde machinerie en ziet er precies zo
  uit als eerst: wit op .45, 6,5 s, very rare 8 s en zwakker.
- `GET /api/houdingen` — de catalogus, net als `GET /display/fx`. Vereist een
  sessie (anders maakt `attachRole` van een bezoeker stilletjes een speler).
- `_houdingVan()` in `routes/api.js` — de regel gevoed met wat deze campagne
  weet. Draait **alleen op de server**; de uitkomst gaat als `_houding` mee.
- Het schuifje in de bewerkmodus, bij Rollen en Kant in gevecht, met
  "Standaard" en een knop terug. Op personages én organisaties.
- `tests/houding-api.test.js` — 9 toetsen over wat er de deur uitgaat.

**Voor een speler verandert er nog niets**, en dat is met opzet: zonder de
insight-machinerie van stap 5 is `houdingGezien` nooit waar, dus krijgt een
speler geen houding mee. Niet een 3 als dekmantel maar helemaal niets — een
veld dat er niet is. De DM ziet hem wel, overal.

## De volgorde

1. ~~**De glans losmaken.**~~ Gedaan. Eigen element, variabelen (`--glans-kleur`,
   `--glans-sterkte`, `--glans-duur`, `--glans-blend`), één doorloop bij hover,
   en de reduced-motion-variant. Daarna doet de bestaande rariteitsglans
   hetzelfde via diezelfde variabelen — dat is meteen de proef dat het
   algemeen genoeg is. **Niets nieuws zichtbaar; alles moet eruitzien als
   voorheen.**
2. ~~**De schaal als één tabel**~~ Gedaan — (`HOUDINGEN` in `lib/`): waarde, naam,
   DMG-houding, de vier glansvariabelen en de toasttekst. Vijf treden. Zeven
   blijft een wijziging op één plek, mét de omrekening die de spec geeft.
3. ~~**Het veld en de regel.**~~ Gedaan — `houding` (null of 1–5) op het personage, de
   drie-stappen-regel (eigen → factie → rol/subtype) als één functie die
   frontend en backend allebei gebruiken. Schuifje in de bewerkmodus met
   "Standaard" en een knop terug.
4. ~~**De glans op personages en facties.**~~ Gedaan — Pas nu wordt er iets zichtbaar.
5. **Insight-DC en de toast.** Eén instelling voor de standaard-DC, een veld
   per personage, de toast naar het juiste apparaat, en de twee standen die
   bijhouden wie wat zag.
6. **De typewissel.** Onthulling → antagonist zet de houding op 1 en speelt de
   schaduw één keer af, ook op het tafelscherm.

Stap 1 is het meeste werk en het minst zichtbaar. Dat is goed: zonder die stap
wordt houding een tweede effectsysteem naast dat van de voorwerpen, en dan
staan er twee manieren om hetzelfde te doen.

## Waar het misgaat als we niet opletten

- **Een kaartje dat altijd glimt zegt niets.** De spec is hier streng en heeft
  gelijk: in rust niets. Als de verleiding komt om houding ook in rust te
  tonen, is dat het moment om te stoppen.
- **Het effect verraadt wat de insight-check moest opleveren.** De spec lost
  dat op (spelers zien niets tot iemand de DC haalt), maar dat moet aan de
  **serverkant** gebeuren: stuurt de API de houding gewoon mee, dan staat hij
  in de netwerktab. Zelfde les als bij de verzegelde brief.
- **Een god, een dier en een antagonist zijn niet hetzelfde soort ding.** De
  standaardtabel moet expliciet zeggen wat er gebeurt bij een subtype dat er
  niet in staat, anders krijgt een god stilletjes houding 3.
