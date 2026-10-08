# Werken als beheerder

Bijgewerkt 2 oktober 2026. Gemeten aan de code, niet aan het plan.

Er zijn in Grisburgh twee soorten gezag, en ze lijken meer op elkaar dan ze
zijn. **DM** ben je van één campagne: alles erin is van jou. **Beheerder** ben
je van de server: je maakt campagnes aan en bepaalt welke onderdelen ze hebben.
Dat zijn vijf knoppen, en verder niets — beheerder zijn geeft je geen inzage in
andermans spel.

Wie het is staat vast in de omgeving: `BEHEER_CAMPAGNE` (standaard `grisburgh`).
De DM van díé campagne is de beheerder. Bewust geen vlag op een account en
bewust niet "de actieve campagne": die laatste kan wisselen, en dan zou iemand
zichzelf het beheer in kunnen schuiven.

## Wat je exclusief mag

| Wat | Waar |
|---|---|
| De campagnes zien die er zijn | Instellingen › Campagnes |
| Een campagne aanmaken, met DM-wachtwoord | dezelfde plek, de **+** |
| Per campagne de modules aan- en uitzetten | de uitklap op een campagnekaartje |
| Het DM-wachtwoord van een campagne opnieuw zetten | dezelfde uitklap |
| Bepalen welke campagne de **standaard** is | de knop *Als standaard* |

Die laatste betekent minder dan hij lijkt. Elke campagne heeft haar eigen pad
(`/grisburgh`, `/bleke-kust`); "standaard" bepaalt alleen waar het kále domein
en een verzoek **zonder sessie** landen. Je verhuist er zelf niet door, en de
spelers van een andere campagne merken er niets van.

## Wat je níét mag, en dat is met opzet

**Beheerder zijn maakt je nergens anders DM.** Je sessie hoort bij één campagne
(`sessieHoortHier`), en in een vreemde campagne ben je een bezoeker: je krijgt
de landingspagina en moet inloggen met háár wachtwoord. Lezen, schrijven,
bestanden, socket-updates — allemaal dicht. Dat is geen beleefdheid maar
getoetst gedrag; `tests/campagne-isolatie.test.js` valt om zodra het wegvalt.

De uitzondering die je moet kennen: je **kunt** het DM-wachtwoord van een
campagne opnieuw zetten, en daarmee kun je er altijd in. Dat is zichtbaar — het
oude wachtwoord werkt dan niet meer, dus de DM merkt het. Het is een
noodingang, geen achterdeur.

## Een nieuwe DM op gang helpen

De werkverdeling is bewust gesplitst: **jij levert de doos, hij richt hem in.**

1. **Maak de campagne aan.** Instellingen › Campagnes › **+**. Een id (alleen
   letters, cijfers, `_` en `-`; dit wordt zijn URL), een naam, en een
   DM-wachtwoord van minstens acht tekens. Zonder dat wachtwoord komt niemand
   erin — alleen de standaardcampagne valt terug op het serverwachtwoord.
2. **Zet zijn modules — als je iets wilt tegenhouden.** Sinds 8 okt 2026 is
   dit geen verplichte stap meer. Wat jij niet uitdrukkelijk dichtzet, mag de
   DM zelf aan- en uitzetten bij Instellingen of in de wizard; de startset
   bepaalt alleen nog wat er áán staat als hij niets doet.

   De oude regel was dat alles buiten de startset onbereikbaar bleef, "niet
   omdat ze stuk zijn, maar omdat ze uitleg vragen die je er dan bij geeft."
   Die uitleg staat inmiddels in de hulpknoppen, en acht van de dertig
   onderdelen achter een telefoontje zetten is dan alleen nog wrijving.

   Wat je wél dichtzet blijft dicht: zet je een module op **uit** in de
   uitklap, dan ziet hij hem niet staan en kan hij hem niet terughalen. Dat is
   een beslissing, geen standaard.
3. **Geef hem het pad en het wachtwoord.** `grisburgh.nl/<zijn-id>`. Meer niet.
4. **De rest doet hij zelf.** De eerste keer dat hij als DM binnenkomt in een
   campagne zonder personages start de **opstartwizard**: naam en ondertitel,
   hoe zijn munten heten, hoe zijn plekken heten, zijn eerste party met
   wachtwoord, zijn eerste personage. Hij kan alles overslaan, en alles staat
   daarna bij Instellingen.

Wat je **niet** voor hem doet: zijn namen verzinnen, zijn party's indelen, zijn
personages aanmaken. Dat is zijn campagne.

## Wat je blijft doen nadat hij draait

- **Modules vrijgeven**, stapsgewijs, met uitleg erbij. Een module aanzetten is
  één vinkje; weten wát er dan verschijnt is het werk.
- **Deployen afstemmen.** Eerst JS en CSS, dán `index.html` — andersom haalt een
  browser een halve versie op en dat raakt iedereen tegelijk. Speelt er iemand,
  stem het even af.
- **De backups in de gaten houden.** Ze draaien vanzelf (05:15 op de server,
  19:00 op de laptop) voor álle campagnes. Zie `CLAUDE.md` voor terugzetten.
- **Beeld in de gaten houden.** Elke campagne kost vooral schijf aan
  afbeeldingen. Sinds alles bij binnenkomst WebP wordt is dat een factor tien
  minder dan eerst, maar het blijft de enige post die groeit.

## Waar het over gaat als het misgaat

- *"Ik kan niet in mijn campagne."* Zijn wachtwoord, niet dat van jou. Opnieuw
  zetten kan via de uitklap op zijn kaartje.
- *"Ik zie een onderdeel niet."* Module staat uit. Een module die uit staat is
  volledig weg — geen grijze knop, geen melding. Dat is bedoeld.
- *"Mijn spelers zien niets."* Twee lagen, en allebei moeten ze kloppen: de
  **party** bepaalt wat ze kennen (Diensten › Toegang per groep), de **akte**
  bepaalt waar ze zijn (Bereikbaar tijdens deze akte).
- *"Er staat een naam uit jouw campagne in mijn app."* Dat is een fout van ons,
  geen instelling. Meld hem; er staat een scan voor in
  `tests/campagne-generiek.test.js`.
