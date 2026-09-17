# Level omhoog — een voorstel

*17 september 2026*

Nu staat een level-up in de app gelijk aan **een getal overtypen** in het veld
*Level* op het Personage-tabblad. Alles wat eraan vastzit gebeurt daarna
onzichtbaar: `_syncNewFeaturesToTraits` duwt de nieuwe features in Kenmerken,
de spell slots worden sinds vandaag afgeleid, de Hit Dice-pool groeit mee. Wat
níét gebeurt: HP. Dat rekent de speler zelf uit en typt hij erbij — de enige
plek in de app waar een speler zijn eigen HP mag bepalen, terwijl we dat bij
Hit Dice en genezende voorwerpen juist bewust server-side houden.

En het moment zelf is er niet. Een level-up is aan tafel een klein feest; in de
app is het een invoerveld.

## Het model: de DM gunt, de speler verzilvert

Twee stappen, en ze horen bij verschillende mensen.

**De DM gunt.** Eén knop per party — *Iedereen een level omhoog* — die
`groups[gid].levelUpTegoed[charId]` op 1 zet (of ophoogt). Dat is alles wat de
DM hoeft te doen; hij hoeft niet voor vijf spelers HP te rollen en feats te
kiezen. Zit er iemand tussen die niet mee mag, dan is er een vinkje per speler.
Waar die knop hoort: in het **rustpaneel**, naast lange en korte rust, en in de
herinnering na `_regieBalkPauze()` waar nu al de sheets langskomen. Dat is het
moment waarop het aan tafel ook gebeurt — einde sessie, of bij de lange rust
erna.

**De speler verzilvert.** Op zijn Personage-tab verschijnt een balk: *Je mag een
level omhoog.* Klikken opent het level-upvenster, en dat doet drie dingen in
deze volgorde.

### 1. Welke klasse (alleen bij multiclass)

Een Cleric 5 / Wizard 3 die naar 9 gaat, wordt Cleric 6 óf Wizard 4 — en dat
bepaalt welke hit die er gerold wordt en welke features erbij komen. Bij één
klasse slaan we deze stap over. Multiclass-eisen (13 in de ability) toetsen we
**niet**: zelfde afweging als bij een spreukverzoek — te veel uitzonderingen, en
een weigering die soms fout zit ga je wantrouwen. Wel voorrekenen: *"Wizard
vraagt INT 13 — die heb je (16)."*

### 2. HP — drie wegen, de server rekent

De PHB 2024 geeft twee keuzes en aan tafel bestaat er een derde:

| Keuze | Wat er gebeurt |
|---|---|
| **Gemiddelde** | `(die/2)+1` + CON-mod. Vast getal, geen worp. De standaard. |
| **Rollen in de app** | De server rolt `1d<die>`, telt CON erbij, en toont de worp. |
| **Zelf gegooid** | De speler tikt in wat zijn echte dobbelsteen gaf; de server toetst 1..die en telt CON erbij. |

Die derde is geen omweg: aan tafel rolt iemand met zijn eigen d10 en dan hoort
dát getal in de app te komen, niet een tweede worp die er niet was. Het blijft
een *invoer*, geen berekening — dezelfde scheiding als overal: de speler levert
de worp, de server rekent.

De DM kiest de partystandaard (`meta.levelup.hpMethode`) en of afwijken mag.
Minimaal 1 HP per level, want een CON van 8 met een d6 kan negatief uitvallen.

### 3. Wat je erbij krijgt, uitgelegd

Dit is waar de progressiedata zich terugverdient. `_featuresForLevel()` weet
precies wat dit level ontsluit, mét tekst (`desc`, anders `_srdDesc`). Het
venster toont ze als kaarten die je kunt openlezen — niet als een regel in een
lijst die je wegklikt. Drie soorten, in deze volgorde:

- **Wat je krijgt.** Channel Divinity, Extra Attack, een Epic Boon. Naam,
  tekst, en waar de tekst er niet mag staan de verwijzing naar buiten
  (`window.app.bronLink`, zoals in de vaardighedenbibliotheek).
- **Wat je moet kiezen.** Een ASI of feat, je subklasse op 3, Expertise. Dit
  schrijft `featChoices` — nu een vrij tekstveld dat niemand invult omdat
  niemand weet wannéér. Op dit moment weet je het wel.
- **Wat er vanzelf meegroeit.** Een 4e-niveau slot erbij, je proficiency bonus
  naar +4, een Hit Die extra. Alleen melden; er valt niets te kiezen.

Spreuken krijgen een eigen regel met een knop naar de bibliotheek: *"Je mag nu
twee spreuken van niveau 2 kiezen."* Zelf toevoegen doet het venster niet — dat
loopt al langs de DM (`spellRequests`), en die weg moet er één blijven.

## Terugdraaien moet kunnen

Een DM die de verkeerde party aanklikt, een speler die de verkeerde klasse
kiest. Daarom is een level-up een **regel in de administratie** en niet alleen
een gewijzigd getal:

```
dmState.levelUps[charId] = [
  { van: 7, naar: 8, klasse: 'Cleric', hp: 6, worp: 5, methode: 'app',
    datum: '2026-09-17T20:14:00Z', features: ['progression-Cleric-8-...'] }
]
```

Terugdraaien haalt de HP eraf, zet het level terug en verwijdert precies die
gesynchroniseerde features — niet "alle features van level 8", want de speler
kan er zelf iets bij hebben gezet. Bijvangst: het personage krijgt een
**geschiedenis**. Wanneer werd Wilmer 5? Dat is leuk om te weten, en het staat
er dan toch.

## Het moment

Een kleine cinematic, in de taal die de app al spreekt (`_rustCinematic`,
`_lootCinematic`, de verzegelde brief): het levelgetal dat omslaat, de
klassenaam eronder, en daarachter de kaarten met wat je erbij kreeg. Geen
filmpje van drie seconden — één omslag en dan de inhoud, want je wilt lezen wat
je gekregen hebt. Op het **tafelscherm** (`_isDisplayMode`) een party-brede
variant: vier portretten die tegelijk omslaan naar hun nieuwe level. Zelfde
patroon als `loot:display` en `brief:display`, want de tablet is geen speler en
kan het niet uit een sessie afleiden.

## Wat we níét bouwen

- **Geen automatische toetsing** van multiclass-eisen, feat-voorwaarden of het
  aantal bekende spreuken. Voorrekenen wel, blokkeren niet.
- **Geen XP.** Grisburgh speelt op milestone; een XP-teller zou een mechaniek
  introduceren die aan deze tafel niet bestaat.
- **Geen automatische spreuken in het boek.** Er is één plek waar een spreuk in
  een boek belandt (`_spreukInBoek`), en die gaat langs de DM.

## Volgorde van bouwen

1. ~~`POST /characters/:id/level-up` + terugdraaien.~~ **Gebouwd 17 sep 2026.**
2. ~~Het tegoed: DM-knop in het rustpaneel, balk op de Personage-tab.~~ **Gebouwd.**
3. ~~Het venster met de drie stappen.~~ **Gebouwd.**
4. ~~De cinematic + de tabletvariant.~~ **Gebouwd.**

## Wat er tijdens het bouwen boven kwam

**`_findSubclass` koos de verkeerde subklasse.** Hij deed één kale `includes` in
beide richtingen, en "light domain" staat letterlijk in "twilight domain" — dus
een Cleric met **Light Domain** kreeg de features van de **Twilight** Domain
voorgeschoteld. Dat raakte niet alleen dit venster maar de hele Progressie-tab.
Nu drie stappen, van streng naar los: precies dezelfde naam, dan de een die de
ander als héle woorden bevat ("Wild Magic" in "Wild Magic Sorcery"), en pas dan
los — en alleen als er precies één kandidaat is. Bij twijfel liever niets dan
de verkeerde subklasse. Nagemeten op alle tien Grisburgh-profielen: geen enkele
verandert van subklasse.

**Wat er vanzelf meegroeit rekent de server uit**, niet de client: de slot- en
proficiency-tabellen staan al in `routes/api.js`, en `_slotsAfgeleid()` wordt
gewoon een tweede keer aangeroepen met dit level er alvast bij. Zo kan er geen
tweede tabel ontstaan die van de eerste gaat afwijken.

## Nog open

- De keuze bij een ASI of feat wordt nog niet hier genoteerd; het venster zegt
  dat je dat op het Progressie-tabblad doet (`featChoices`). Het zou mooier zijn
  als je 'm meteen in dit venster invult.
- Een level-up onthult geen nieuwe spreukniveaus in de bibliotheek; de speler
  ziet alleen dat hij een slot erbij kreeg.
