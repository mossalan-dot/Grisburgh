# Een personage maken

Werkdocument, 16 oktober 2026. Besproken met de DM; de vier keuzes hieronder
zijn zíjn antwoorden, niet mijn aannames.

## Wat er nu niet kan

Een speler kan zijn eigen blad **al volledig bijwerken** — `PATCH
/player-profile/:id` staat open voor de eigenaar en dekt level, class,
subclass, abilities, skills, saves, AC, wapens en talen. Wat hij niet kan is
het **kaartje zelf aanmaken**: `POST /entities/:type` is `requireDM`.

En dat is precies waar een nieuwe speler strandt. Inloggen gaat per party: je
kiest een portret uit de lijst en typt het partywachtwoord. Wie nog geen
personage heeft staat niet in die lijst, dus komt hij nergens binnen. De DM
moet eerst een leeg kaartje maken — meestal midden in een sessie, op zijn
laptop, terwijl de rest wacht.

## De vier keuzes

| | |
|---|---|
| **Wie mag het** | Iedereen met het partywachtwoord, maar de DM gunt hem |
| **Hoe ver gaat het** | De hele 2024-creatie — aan het eind is het blad af |
| **Ability scores** | Alle vier de manieren, en de DM kiest welke hij toestaat |
| **Uitrusting** | Uit de SRD-lijst die er al staat, plus een optionele trinkettafel; en de speler mag een **beginlevel** vragen |

## Wat de app al kan voeden

Dit is geen nieuw regelsysteem — het staat er bijna allemaal al.

- `bronnen/klasse-basis.json` — per class: hit die, saving throws, hoeveel
  skills en waaruit, armor/weapons/tools, primary ability, Class Type.
- `bronnen/backgrounds-2024.json` — per background precies de vier dingen die
  2024 vraagt: **Ability Scores** (welke drie), **Feat**, **Skill
  Proficiencies**, **Tool Proficiency**, plus een **Equipment**-regel ("A of
  B" met goud).
- De progressie — species met hun traits, classes met hun features per level,
  subclasses met hun kleur.
- `bronnen/srd-items.json` — 333 voorwerpen met prijs en gewicht, inclusief
  alle wapens en harnassen.
- `bronnen/srd-spreukentellers.json` — hoeveel cantrips en spreuken per level.
- `bronnen/srd-multiclass-eisen.json` — de ability-eisen, voor later.

Wat er **niet** is: point buy, de standaardreeks, 4d6-rollen, een
startuitrustingspakket per class, en een trinkettafel. De eerste drie zijn
rekenwerk van een halve pagina. Het vierde bestaat in de boeken wél maar niet
in de SRD; daarom kiest de speler zijn startspullen uit de SRD-lijst, gefilterd
op wat zijn class mág dragen. De trinkettafel wordt een **verwijzing naar een
tafel van de campagne zelf**: dan hoeft de app niets te verzinnen en kan elke
DM zijn eigen rommel in de zakken van zijn spelers stoppen.

## Het concept bestaat eerst buiten de wereld

De belangrijkste ontwerpkeuze. Een half personage dat als kaartje in de wereld
staat moet je op twintig plekken wegfilteren: uit de partylijst, uit het
gevecht, uit de loot-verdeling, uit het tafelscherm, uit de sheets. Elke plek
die je vergeet is een bug die pas aan tafel opvalt.

Dus: **een concept is geen kaartje.** Het staat in `dm-state.json` onder
`conceptPersonages`, met zijn eigen id, de party waar het bij hoort en alles
wat de wizard tot nu toe weet. Pas als de DM het gunt ontstaan het
personagekaartje, het profiel, de boedel en de beurs — in één keer, compleet.
Tot dat moment ziet niemand aan tafel er iets van behalve de DM, en die ziet
het op één plek: de **Vragen**-tab, waar de andere vier soorten verzoeken ook
binnenkomen.

De maker houdt zijn concept vast via zijn sessie (`req.session.conceptId`).
Komt hij terug op de landingspagina, dan staat er niet "+ Nieuw personage"
maar "Verder met *Brigitta*".

## De stappen van de wizard

1. **Naam en party.** De party volgt uit het wachtwoord dat je typte.
2. **Species.** Uit de progressie, met de traits erbij. Dit is meteen de
   aansluiting op het Heldenboek: hetzelfde kaartje, dezelfde tekst.
3. **Class** — en als je beginlevel hoog genoeg is ook meteen de **subclass**.
4. **Background.** Zijn vier regels worden vier voorstellen: de ability-bonus,
   de feat, twee skills en een gereedschap. Je ziet wat je krijgt voordat je
   kiest.
5. **Ability scores**, met de manieren die de DM aanzette.
6. **Skills.** De class geeft er *n* uit zijn lijst; de background er twee
   vast. Wat de background al gaf is uitgevinkt en niet nog eens te kiezen.
7. **Spreuken**, alleen voor wie ze krijgt. Aantallen uit de tellers.
8. **Uitrusting.** De A-of-B van je background, een wapen en een harnas uit
   wat je class mag dragen, en — als de DM er een aanwees — één worp op de
   trinkettafel.
9. **Nakijken en versturen.** Eén scherm met het hele blad erop, en de knop
   *Ter goedkeuring sturen*.

De DM ziet datzelfde overzichtsscherm in zijn Vragen-tab, met **Gunnen** en
**Terugsturen** (met reden) eronder.

## Wat de DM instelt

Onder Instellingen, bij de andere spelersinstellingen:

- **Mogen spelers zelf een personage maken?** (standaard aan)
- **Welke manieren voor ability scores?** (vier vinkjes)
- **Hoogste beginlevel dat je mag vragen** (standaard 1)
- **Trinkettafel** — een van de tafels van de campagne, of geen

## De fasering

| fase | wat | stand |
|---|---|---|
| **1** | Het concept, de goedkeuring, de instellingen, en de wizard tot en met skills | **af** (16 okt) |
| **2** | Spreuken, uitrusting, trinkettafel, beginlevel boven 1 | **af** (16 okt) |
| **3** | Portret, het blad kunnen printen, en multiclassen bij het maken | **af** (16 okt) |

Elke fase ging apart naar productie, zoals altijd.

## Wat er bewust niet in zit

- **Ability score improvements en feats vanaf level 4.** Die horen bij de
  level-up die er al is, en het zijn keuzes die je aan tafel maakt. De
  nakijker zegt het erbij in plaats van ze stilzwijgend over te slaan.
- **Wapens filteren op simple/martial.** Dat veld staat niet in
  `srd-items.json`; er staat wél bij wat zijn class mag dragen, en de DM ziet
  de keuze voordat hij gunt.
- **Een eigen rechtensysteem.** Het partywachtwoord is de drempel, net als bij
  het inloggen.

## Wat het níét wordt

- **Geen regelrechter.** De wizard rekent voor en vult in, maar blokkeert
  niets wat de DM wil toestaan — dezelfde afweging als bij de multiclass-eisen
  ("voorrekenen, niet blokkeren"). Een score van 18 bij het vrij intikken mag;
  de DM ziet hem staan voordat hij gunt.
- **Geen tweede spelersblad.** Wat de wizard invult is het bestaande profiel,
  in dezelfde velden. Na het gunnen bewerk je verder op het spelerstabblad dat
  er al is.
- **Geen eigen rechtensysteem.** Het partywachtwoord is de drempel, net als bij
  het inloggen. Wie dat heeft, zit aan tafel.
