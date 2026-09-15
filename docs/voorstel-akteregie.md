# De tekst ís het script

Opgesteld 15 sep 2026. Een kritische blik op de akteregie, en een voorstel om
de regie-balk en het verhaalpaneel tot één ding te maken. Vervolg op
[verhaal-naast-de-regie.md](verhaal-naast-de-regie.md), dat het verhaalpaneel
introduceerde — dit document zegt dat die twee niet naast elkaar moeten staan.

---

## Wat er staat (gemeten, 15 sep 2026, productie)

| | |
|---|---|
| Aktes | 15 |
| Script-stappen samen | **619** (A3: 116, A12: 79, A9: 68) |
| Waarvan `entity` + `image` | **613** — 99% |
| `encounter` / `dungeon` / `brief` | 19 / 6 / 1 |
| Sectiekoppen (`kop`) in gebruik | **0** |
| Aktes met verhaaltekst | **0 van de 15** |
| Tabellen in de campagne | 8, waarvan 3 met een akte in hun naam |

Drie dingen springen eruit.

**1. Het script is een weggegooide tekst.** De akte-importer
(`POST /import/akte/apply`) las de `.md`, haalde er de `![[afbeelding]]`,
`[[Naam]]` en monsterlinks uit, maakte daar stappen van — en bewaarde de tekst
niet. Alles wat je aan tafel voorleest is dus verdwenen; wat overbleef is een
rij iconen in de volgorde van een document dat je niet meer kunt zien. Vandaar
dat Obsidian tijdens het spelen nog steeds open staat.

**2. Er is nog niets dubbel — maar dat gebeurt zodra je begint.** Geen enkele
akte heeft tekst, dus het verhaalpaneel is nooit gevuld. Plak je de vijftien
hoofdstukken erin, dan bestaat elke scène vanaf dat moment twee keer: als
alinea's én als stappen, gekoppeld met een string-vergelijking op de kopnaam
(`_kopNorm`). Twee lijsten die hetzelfde moeten zeggen lopen uit elkaar — dat
is dezelfde reden waarom documenten hun `hoofdstuk`-veld verloren en waarom
`betrokkenen` op één plek staat.

**3. De balk schaalt niet.** 116 chips zijwaarts doorscrollen om "de waard" te
vinden is trager dan Ctrl-F in Obsidian. Het filter (beeld/kaartje/gevecht)
verzacht dat, maar de volgorde van het verhaal is juist de enige ordening die
telt.

> **Blokkerend lek, los van dit voorstel.** `GET /meta` stuurt het hele
> meta-object naar iedereen met een sessie — inclusief
> `hoofdstukken[*].tekst` en `[*].script`. Nu valt er niets te lekken omdat
> `tekst` overal leeg is, maar de eerste akte die je erin plakt staat
> integraal in de browser van elke speler: geheimen, wendingen, statblokken.
> Zelfde soort lek als destijds de kamernamen in de dungeon en de vage
> documenten. **Dit moet af vóór er tekst in gaat.**

---

## Het voorstel

**De tekst wordt de enige bron, en de knoppen komen ín de tekst te staan.**
Geen script naast een tekst, maar één document dat je tijdens het spelen leest
en bedient.

### Waar het leeft

Een **lade onderin** die uit de regie-balk omhoog schuift, drie standen:

- **dicht** — één regel: aktenaam, voortgang, en de knoppen die altijd moeten
  kunnen (rust, sfeer, brief, sheets, pauze). Dat is de balk van nu.
- **halfhoog** (± 55%) — de tekst van de huidige sectie, met de sectiestrook
  erboven. De app blijft bruikbaar boven de lade.
- **hoog** — voorlezen, bijna schermvullend.

Bewust onderin en niet ernaast: een zijpaneel duwt de app in zijn smalle
indeling (daarom herhaalt `body.verhaal-open` nu een handvol
smal-scherm-regels), terwijl een lade de breedte ongemoeid laat. En je kijkt
tijdens het spelen afwisselend naar de tekst en naar de kaartjes erboven — niet
naar allebei tegelijk.

### Hoe een knop in de tekst komt

**Afgeleid, voor het meeste.** De tekst bevat al `![[haven.png]]`,
`[[Bram Kruik]]` en monsterlinks, en de parser die dat herkent bestaat
(`_parseAkteMarkdown`). Die tokens worden bij het renderen **ter plekke** een
knop: een oogje naast de naam (onthullen voor de party — vol, vaag of een
geheimregel), een duimnagel met een oogje bij een afbeelding. Dat dekt de 613
van 619 stappen, zonder dat je één teken extra hoeft te typen.

**Geschreven, voor de rest.** Alles wat geen naam in de prozatekst is, gaat met
een **Obsidian-callout** — die blijft leesbaar in Obsidian zelf en is één
herkenbaar blok:

```markdown
> [!voorlezen]
> De poort staat open. Uit de mist komt de geur van natte steen.

> [!gevecht] Wachters bij de poort
> Twee Guards, één Veteran.

> [!tabel] Nachtelijke gebeurtenissen — Wildernis

> [!buit] Onder de plavuizen
> [!rust] lang · herberg
> [!muziek] spotify:playlist:37i9dQZF1DX...
> [!kaart] Crypte onder de Luimpoort
> [!brief] Uitnodiging van de Heeren

> [!check] DC 14 Perception
> [!dm] Bram liegt over de kelder. Hij weet het wel.
```

Elk blok wordt in de lade een kader met één knop die precies doet wat het
staptype nu doet — het zijn dezelfde acties, alleen op een andere plek. De DM
typt ze in Obsidian of plakt ze met een knopje in de akte-editor.

Waarom callouts en niet `{{iets}}`: je schrijft in Obsidian, en daar ziet een
callout eruit als een kader in plaats van als kapotte tekst. Het overleeft
kopiëren en plakken beide kanten op.

### Wat er dan bij kan — en er nu niet is

1. **Voorleesblok naar het tafelscherm.** `[!voorlezen]` krijgt naast het kader
   een knop die de tekst naar de tablet stuurt (`text:display`, zelfde patroon
   als `brief:display` en `loot:display`). Dat is de klassieke *boxed text* uit
   elk avontuur, en we hebben het scherm er al voor staan.
2. **Een tabel rollen waar hij hoort.** Acht tabellen liggen klaar, drie ervan
   heten al "1. Dauwdag — …". Nu moet je daarvoor naar de Tafels-tab; straks
   staat de worp in de alinea die erom vraagt, met de uitslag eronder en
   dezelfde knop om hem op tafel te tonen.
3. **Een DC als aantekening.** Zelfde regel als bij de loot-DC en het
   spreuk-voorrekenen: geen mechaniek, maar het getal staat er op het moment
   dat je het nodig hebt. Later eventueel met "vraag de party om deze check"
   als bericht.
4. **Een logregel schrijven vanuit de sectie.** Nu schrijf je het sessielog
   achteraf. Eén knop per sectie ("dit is gebeurd") die de sectietitel als
   regel in het logboek zet, scheelt de reconstructie.
5. **Zoeken in de tekst.** Zodra de tekst de werkplek is, is Ctrl-F het meest
   gebruikte gereedschap dat we níét hebben. Zoekveld in de lade, springt naar
   de treffer.
6. **"Je bent hier".** De voortgang die nu per stap-id per party wordt bewaard
   (`akteVoortgang`) wordt een positie in de tekst: open je de akte volgende
   week opnieuw, dan sta je waar je gebleven was.

### Wat er met de 619 stappen gebeurt

Niets kapot. Drie regels:

- Een akte **zonder** tekst blijft de balk van nu tonen. Eén renderer, twee
  standen — zoals het bestiarium en de kaartjes dezelfde `.entity-card` delen.
- Een akte **met** tekst toont de lade; de afgeleide tokens vervangen de
  `entity`- en `image`-stappen.
- De onthulstand verhuist mee: de stappen zijn ooit uit deze tokens ontstaan,
  dus matchen op naam haalt vrijwel alles. Wat niet matcht blijft als los
  kaartje onderaan de sectie staan in plaats van stil te verdwijnen.

Dat vraagt wel dat de teksten er één keer in gaan: vijftien keer plakken in de
akte-editor. Dat is het echte werk aan jouw kant.

---

## Schrijven, niet alleen spelen

Een akte moet je in de app kunnen **schrijven**, anders blijft Obsidian de
werkplek en dit scherm een kijkdoos. Sinds 15 sep is er daarom een
**schrijfscherm** (`public/js/akte-schrijven.js`, het ganzenveer-knopje bij
*Verhaal* in de Aktes-tab):

- De tekst over de **volle hoogte**, met de secties (`##`) als klikbaar
  overzicht ernaast. Niet een tekstvak van acht regels in een uitklapper.
- Een **invoegbalk die de campagne kent**. Dát is het verschil met Obsidian:
  daar tik je een naam en hóóp je dat er een kaartje bij hoort. Hier kies je
  uit wat er is — `[[Naam]]` uit alle 554 kaartjes, `![[fileId]]` uit de
  mediabibliotheek, en een regieblok dat naar een bestáánd gevecht, een tabel,
  een vondst of een dungeonkaart wijst.
- **Opslaan tijdens het typen** (gebundeld, 1,2 s), met "bewaard" in de kop.
  Je bent aan het schrijven, niet aan het administreren.
- Een **voorbeeld** dat de callouts al als kader toont, zodat je ziet wat je
  maakt. Kijkstand, geen tweede editor — zelfde afspraak als bij de opmaakbalk
  op een kaartje.
- **Inlezen** (een `.md` vervangt de tekst) en **kopiëren** (de markdown naar
  het klembord) blijven allebei: wie in Obsidian wil blijven schrijven, kan
  dat, en wie hier begint kan het daar afmaken.

Wat er nog niet is en er wel bij hoort: schrijven **tijdens** het spelen — een
potlood in de lade dat de huidige sectie openzet, zodat een inval aan tafel
meteen op de goede plek belandt.

---

## Risico's, eerlijk

- **Het meta-lek hierboven.** Tekst en script horen niet in `GET /meta`. Ze
  moeten naar een DM-route (`GET /meta/akte/:key/regie`), en uit het
  meta-antwoord geknipt voor wie geen DM is. Zonder dat geen tekst in de app.
- **Grootte.** 15 hoofdstukken van 20–40 kB is 300–600 kB in één JSON die bij
  elke schrijfactie in zijn geheel wordt weggeschreven (en waarvan
  `lib/storage.js` een backup maakt). Dat is te doen, maar het pleit ervoor de
  tekst **per akte** op te halen in plaats van alles ineens — wat toch al moet
  vanwege het lek.
- **Eén bron betekent één plek waar je het stuk maakt.** Een verkeerd getypte
  callout is straks een knop die er niet is. Daarom: onbekende callouts blijven
  gewoon als kader staan (leesbaar), en de akte-editor toont bij het opslaan
  wat hij herkend heeft — dezelfde review-stap als de importer nu al heeft.
- **Obsidian blijft de schrijfplek.** Dit voorstel maakt de app níét de editor;
  het maakt hem de speelplek. Heen en weer kopiëren moet daarom lossless zijn,
  en dat is precies waarom het opgeslagen formaat markdown blijft (zie de
  afspraak over WYSIWYG in CLAUDE.md).

---

## Voorgestelde volgorde

1. **Het lek dichten** — `tekst` en `script` uit `GET /meta` voor niet-DM's, en
   een DM-route per akte. Los bruikbaar, blokkeert al het andere.
2. **De lade** — regie-balk met drie standen, tekst van de huidige sectie,
   sectiestrook, zoeken, "je bent hier".
3. **Afgeleide knoppen** — `[[naam]]` en `![[beeld]]` worden onthulknoppen in
   de tekst; de balk blijft voor aktes zonder tekst.
4. **Callouts** — eerst `[!voorlezen]` (mét tafelscherm) en `[!dm]`, daarna
   `[!gevecht]`, `[!tabel]`, `[!buit]`, `[!rust]`, `[!muziek]`, `[!kaart]`,
   `[!brief]`, `[!check]`.
5. **Kleinigheden** — logregel per sectie, en de importer die de `.md` vanaf nu
   gewoon bewaart in plaats van hem weg te gooien.

Stap 1 en 2 zijn samen een avond werk en leveren meteen wat je wil: de tekst
op het grote scherm, met de regie eronder.
