# Documenten: opnieuw bouwen, of gewoon een entiteit maken?

*Opgesteld 7 sep 2026, naar aanleiding van de vraag of we deze sectie from
scratch moeten herbouwen.*

## De vraag achter de vraag

De rommel is echt. Maar hij komt niet doordat de documentensectie slecht
gebouwd is — hij komt doordat **een document precies hetzelfde ding is als een
kaartje, twee keer geïmplementeerd**. Zet de twee datamodellen naast elkaar:

| Document | Entiteit |
|---|---|
| `archief.json.documents[]` | `entities.json[type][]` |
| `tekstContent[id]` (apart bestand) | `data.desc` |
| `npcs[] / locs[] / orgs[] / items[] / docs[]` | `links.personages / locaties / …` |
| `dmState.docStates[id]` — campagnebreed | *(bestaat niet)* |
| `groups[gid].docVisibility[id]` | `groups[gid].visibility[id]` |
| `hidden / blurred / revealed` | `hidden / vague / visible` |
| `hiddenLinks` | *(links komen uit de tekst)* |
| `filterDocForPlayer()` | `filterEntityForPlayer()` |
| 9 eigen routes | de generieke entity-routes |
| eigen kaart, detailvenster en editor (~615 regels) | gedeeld |

Dat is geen twee systemen die op elkaar lijken. Dat is één systeem dat twee keer
bestaat, met andere woorden voor dezelfde standen.

## Advies: niet from scratch, maar samenvoegen

**Maak een document een vijfde entiteitstype.** Dat is een migratie, geen
herbouw: er verdwijnt code in plaats van dat er nieuwe bij komt. En documenten
krijgen in één klap alles wat de kaartjes deze week gekregen hebben:

- betrokkenen ("wie hoort hier bij" — de afzender van de brief, de redacteur van
  de krant), en de omgekeerde kant op het personagekaartje;
- geheimen per regel per party, en flavour;
- dezelfde zichtbaarheidswoorden als overal, inclusief de waarschuwing als je
  iets verbergt dat iemand al heeft;
- `[[wikilinks]]` die twee kanten op werken, inclusief het afleiden uit de tekst;
- de zoekindex met scoring, de mediabibliotheek met focuspunt en extra
  afbeeldingen, en de campagneboek-export;
- de tabbladen-editor met hulpteksten per tab.

Van scratch bouwen betekent dat je een kaart, een editor, een detailvenster,
zichtbaarheid, koppelingen en zoeken **opnieuw** ontwerpt — precies de dingen die
er al zijn en waar net een week aan gepoetst is. Je houdt er een derde
implementatie aan over, en tijdens de overgang draaien er drie.

Dat documenten niet de hoofdmoot zijn is trouwens een argument vóór
samenvoegen, niet voor herbouw: iets marginaals moet juist zo min mogelijk eigen
onderhoud kosten.

## Wat document-eigen blijft

Twee dingen, en alleen die:

1. **De perkamentweergave** (`renderParchment`, met `---titel---` en
   `--handtekening--`) — dat is de reden dat een brief een brief is. Wordt een
   weergave van `data.tekst`. Zie de laatste paragraaf: hier valt nog veel meer
   mee te doen.
2. **Onthullen schrijft een regel in het logboek** (`archief.logEntries`) en
   speelt de reveal-animatie. Blijft als haak op de zichtbaarheidswissel.

## Een kaartje weet niets van aktes

Op het documentkaartje staat een veld `hoofdstuk`. Dat is de enige plek in de
hele app waar een kaartje een akte noemt:

| kaarttype | kaartjes | met een akte-veld |
|---|---|---|
| personages | 168 | 0 |
| locaties | 99 | 0 |
| organisaties | 7 | 0 |
| voorwerpen | 249 | 0 |
| **documenten** | 31 | **31** |

De regel geldt dus al overal; het document is de uitzondering. Die gaat eraf.
Een kaartje beschrijft wát iets is, niet wanneer het in het verhaal voorkomt —
daar zijn de aktevorm, de akteregie en straks de verhaaltekst per akte voor,
waarin de DM het gewoon leest.

Dat betekent niet dat een akte geen kaartjes mag noemen. Andersom mag prima, en
gebeurt al: het regie-script kent een `entity`-stap met
`entityType: 'documenten'`, dus een document is daar al aan te wijzen. Wat er
bij komt is een lijst **`meta.hoofdstukken[key].documenten`** (id's) voor "deze
documenten horen bij deze akte", te beheren vanuit de akte-editor. Het Logboek
groepeert daarop; het script blijft het onthulmoment tijdens het spelen.

De migratie vult die lijst uit de 31 bestaande `hoofdstuk`-waarden, dus er gaat
niets verloren — en de discrepantie die er nu is (één document waarvan het veld
en het script een andere akte noemen) lossen we in die stap op.

## Wat we onderweg zouden opruimen

- **Twee plekken voor één stand.** `docStates` (campagnebreed) naast
  `docVisibility` (per party) is een van de bronnen van verwarring: als je iets
  onthult is niet te zien wélke van de twee je verzet. Alleen per party
  overhouden, zoals bij alle andere kaartjes.
- **`hiddenLinks`** vervalt: koppelingen komen uit de tekst en uit `links`.
- **De losse categorie `cat`** (brieven/pers/kaarten/codex/audio) wordt een
  chiprij op `type`, net als bij de andere tabs — die filterrij ontbreekt nu
  helemaal terwijl er zestien types in de data zitten.

## Wat we níét aanraken

Het Logboek, de sessieverslagen, de aktes en het regie-script. Dat is 2500 van de
3300 regels in `render-archief.js` en het is een wezenlijk ander ding: geen
kaartjesbak maar het journaal en de regie van de DM. Die blijven waar ze zijn.

## Omvang en risico

- **33 documenten in totaal** (31 Grisburgh, 1 prewett, 1 Test), waarvan 29 met
  perkamenttekst. De migratie is klein en met een script te doen, met een kopie
  vooraf en een terugweg.
- **50 verwijzingen in `routes/api.js`**, 14 in `render-archief.js`, 9 in
  `lib/snapshot.js`, en een handvol elders. Mechanisch werk, maar niet triviaal.
- Reken op een dag, niet op een middag. De winst is dat er daarna structureel
  minder is: negen routes en zeshonderd regels frontend eruit.

## Volgorde als we het doen

1. Migratiescript schrijven en drooglopen op een kopie: documenten →
   `entities.json` als type `documenten`, standen → `visibility`, tekst →
   `data.tekst`, naam-arrays → `links`.
2. Documenten toevoegen aan `ENTITY_TYPES` en aan `SCHEMA`, met de
   perkamentweergave als eigen veldtype.
3. De oude kaart, het oude detailvenster en de oude editor verwijderen; het
   Logboek laten lezen uit de nieuwe plek.
4. De negen `/archief/:id/…`-routes opruimen, met uitzondering van wat het
   logboek en de aktes nodig hebben.
5. Migratie draaien op de drie campagnes, met backup.

## Later: de perkamentweergave verdient meer

Nu is er één perkamentstijl. Een brief, een dreigbrief, een krant, een kasboek
en een gebed zien er hetzelfde uit, terwijl het type al bekend is. Ideeën voor
als we hieraan toekomen:

- **handschrift** voor brieven en aantekeningen, met verschillende handen zodat
  twee schrijvers herkenbaar verschillen;
- **typemachine** voor rapporten, kasboeken en officiële stukken;
- **uitgeknipte krantenletters** voor een dreigbrief — losse vlakjes met
  wisselende letterhoogte en achtergrond;
- **gezet drukwerk** voor kranten en folders, met kolommen.

Te sturen op `data.docType` (of een eigen veld *briefstijl*, zoals de
factie-uitnodiging dat al heeft), zodat de DM het per document kan overrulen.
Dit is een aparte ronde, ná de samenvoeging — het is presentatie, en die is
makkelijker als het datamodel al klopt.