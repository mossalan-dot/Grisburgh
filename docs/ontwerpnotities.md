# Ontwerpnotities — vier openstaande wensen

Opgesteld 4 sep 2026. **Alle vier gebouwd** — dit document blijft staan als
verantwoording van de keuzes; de werking staat in CLAUDE.md.

---

## 1. Verdiepingen in een dungeon

**Wat er ligt.** Een dungeonkaart is `{id, name, hoofdstukId, fileId, rooms,
connections, reveals, partyAccess}`. Kamers hebben een vorm en punten;
verbindingen lopen altijd tussen twee kamers op **dezelfde** kaart. Meerdere
kaarten staan los van elkaar in een keuzelijst bovenin.

**Wat het probleem is.** Een kelder is nu een losse kaart zonder verband met de
verdieping erboven. Is die kelderplattegrond klein, dan zweeft hij gecentreerd in
beeld zonder houvast — je ziet niet waar hij zit ten opzichte van de rest.

**Voorstel.** Twee kleine toevoegingen, geen verbouwing:

1. **Een verdiepingsnummer op de kaart** (`verdieping: -1 | 0 | 1 | 2 …`) plus
   een gedeelde `gebouwId`, zodat kaarten van hetzelfde gebouw bij elkaar horen.
   De keuzelijst bovenin wordt dan een **verdiepingskiezer** voor dat gebouw
   (−1 Kelder · 0 Begane grond · 1 Zolder), met de losse kaarten daaronder.
2. **Een trap is een kamer met een bestemming**: een `trapNaar: {mapId, roomId}`
   op de kamer. Op de kaart krijgt zo'n kamer een trap-icoon (`arrow-down` voor
   omlaag, een eigen icoon voor omhoog) en klikken brengt je naar die verdieping,
   met de doelkamer meteen geselecteerd. Zo staat de kelder niet meer gecentreerd
   te zweven: je komt er binnen op de plek waar de trap uitkomt.

Dat hergebruikt de bestaande fog-of-war per kamer (een trap kun je dus onthullen
of verborgen houden) en vraagt geen nieuw datamodel — alleen twee velden.

**Vragen.**
- Moet een trap **twee kanten op** werken (automatisch een terugverwijzing
  aanmaken), of leg je beide richtingen met de hand?
- Wil je de verdiepingen ook **naast elkaar** kunnen zien, of is wisselen genoeg?
- Telt een trap mee in de onthul-teller ("3 / 12 onthuld") of is het decor?

---

## 2. Filmpje bij een spelerskaartje

**Wat er ligt.** Meer dan je denkt: de landingspagina toont al een filmpje als er
een bestand `<entityId>_video` bestaat (`routes/auth.js` kijkt daar rechtstreeks
naar, omdat het veld `data.portraitVideoId` ooit onbetrouwbaar bleek). Het speelt
af tijdens het inzoomen op je portret. Er is alleen **geen upload-ingang**: die
bestanden staan er omdat ze met de hand op de server zijn gezet.

**De harde beperking.** Er is **geen ffmpeg** — niet lokaal en niet op de server.
We kunnen dus niet knippen, schalen of hercoderen. Alles wat we willen afdwingen,
moeten we dus **weigeren** in plaats van repareren.

**Voorstel.** Een uploadveld bij het personage-kaartje (DM, naast de afbeelding),
dat het bestand opslaat als `<entityId>_video` — precies wat de landingspagina al
verwacht. Met een controle in twee lagen:

- **In de browser, vóór het uploaden:** de duur is uit te lezen door het bestand
  in een `<video>` te laden. Te lang of te groot → meteen een nette melding, en
  er gaat niets over de lijn.
- **Op de server:** type (mp4/h264), grootte en de bestaande magic-byte-controle
  uit `upload.test.js`.

Mijn voorstel voor de grenzen: **maximaal 6 seconden en 8 MB**, want het speelt
als een korte lus tijdens het inzoomen. Grotere bestanden zijn zonde van de
mediaruimte (zie het budget in `docs/multi-dm-plan.md`).

**Vragen.**
- Zijn 6 seconden en 8 MB redelijk, of wil je ruimer?
- Moet het filmpje **alleen op de landingspagina** spelen, of ook op het
  personagekaartje in het archief en op het spelerstabblad?
- Wat te doen met een te lang filmpje: weigeren met uitleg ("kort 'm eerst in"),
  of toch accepteren en gewoon **na X seconden stoppen** met afspelen? Dat laatste
  kan zonder ffmpeg en is vriendelijker.

---

## 3. Spelers die elkaar voorwerpen geven

**Wat er ligt.** Bijna alles — maar de knop ontbreekt. De server kent al
`POST /items/:itemId/request` met een `type`, en bij het goedkeuren doet
`type === 'trade'` met een `targetId` precies het juiste: het voorwerp verhuist
naar de andere speler. Er is ook al een `tradeAllowed`-schakelaar per party. De
frontend stuurt echter **alleen ooit `type: 'claim'`** (`render-campagne.js`), dus
de ruilkant is nooit aangeroepen. In het DM-paneel wordt "ruilen met X" al
netjes getoond zodra zo'n verzoek bestaat.

**Voorstel.** In de Boedel van een speler bij elk eigen voorwerp een knop
**"Geven aan…"** met de aanwezige medespelers (zie aanwezigheid per sessie). Dat
stuurt `{type:'trade', targetId}`; de DM ziet het verzoek in zijn lijst en keurt
goed of af. Er is dus geen nieuw datamodel nodig — alleen de knop en de kiezer.

**De vraag die daaronder ligt:** moet de DM er eigenlijk wel tussen zitten? Twee
smaken:

- **Met goedkeuring** (wat er nu ligt): niets verandert buiten je medeweten om,
  en jij kunt "nee, dat kan niet, dat ding is vervloekt" zeggen.
- **Direct** (met `tradeAllowed` aan): spelers regelen het onderling, jij ziet
  het achteraf in het logboek. Sneller aan tafel, minder controle.

Ik zou beginnen met goedkeuring, want de machinerie ligt er al en je kunt altijd
nog versoepelen.

**Vragen.**
- Goedkeuring of direct? En mag dat per party verschillen (`tradeAllowed` bestaat
  al)?
- Mag een speler ook **munten** geven, of alleen voorwerpen?
- Alleen aan **aanwezige** medespelers, of aan iedereen in de party?
- Moet een ruil in het logboek komen te staan?

---

## 4. Het verhaal inladen en tonen

**Wat er ligt.** De akte-importer (`routes/api.js`) leest een Obsidian-hoofdstuk
vol `[[wikilinks]]`, `![[embeds]]` en monsterlinks, en maakt daar een regie-script
van. Hij herkent daarbij al welke genoemde namen **wél** en **niet** aan een
bestaand kaartje te koppelen zijn (`_status: 'unmatched'`) — dat is precies de
helft van wat je wil weten. Maar hij bewaart de **lopende tekst niet**: alleen de
stappen komen eruit.

**Voorstel.** Bewaar de hoofdstuktekst bij de akte (`meta.hoofdstukken[key].tekst`)
en toon 'm in de Meesterkamer bij die akte — met de `[[ ]]` gerenderd als
klikbare links, want dat kan `mdToHtml()` al. Daarmee krijg je in één moeite door:

- **Wie komt hier voor?** Alle `[[ ]]` uit de tekst van deze akte.
- **Nieuw of terugkerend?** Vergelijk met de `[[ ]]` uit de tekst van alle
  eerdere aktes: een naam die nu voor het eerst valt is nieuw.
- **Wat bestaat er nog niet?** Namen zonder kaartje — met een knop "maak kaartje"
  ernaast, zodat je het meteen kunt aanvullen tijdens de voorbereiding.

Dit raakt ook het punt uit de vorige ronde: **het veld `entity.links` afleiden uit
de `[[ ]]` in de teksten**. Dan kloppen de contextchips op kaartjes, het zoeken,
het dashboard en de campagneboek-export weer, zonder dat iemand ze bijhoudt.

**Vragen.**
- Komt de tekst uit een **geüpload .md-bestand** (zoals de importer nu doet), of
  wil je 'm in de app kunnen plakken en bewerken?
- Is de tekst **alleen voor jou**, of mag een deel na afloop naar het logboek voor
  de spelers?
- Bij het afleiden van `links`: handmatig gelegde verbindingen die **niet** in de
  tekst voorkomen verdwijnen dan van de kaartjes. Eerst inventariseren hoeveel dat
  er zijn — en willen we die dan als `[[ ]]` in de tekst bijschrijven, of gewoon
  laten vallen?
