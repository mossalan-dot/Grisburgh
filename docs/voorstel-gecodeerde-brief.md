# Gecodeerde brief

Werkdocument, 8 oktober 2026. **Gebouwd en uitgerold.** De bron is het
prototype *Gecodeerde brief* (artefact, 2 okt 2026); dit is wat erin zat, wat
ervan over is, en waar het anders liep.

## Wat het prototype doet

Geen cijferschrift maar een **anagram door verplaatsing**. De letters in de DOM
staan al in de goede volgorde; in versleutelde staat krijgt elke letter een
`transform` die hem op de plek van een andere letter uit zijn groep zet.
Ontcijferen is die transforms wegnemen, en dan vliegt elke letter in een boogje
naar huis. De opmaak verspringt daarbij nooit — het is dezelfde regelval, voor
en na. Dat is de hele vondst, en het is mooier dan letters die veranderen: je
ziet dat het *dezelfde brief* is.

### Drie bereiken werden er één

Het prototype kende drie: per woord (een anagram dat spelers zelf kunnen
oplossen), per regel, en de hele brief. Die keuze hoorde bij een ander idee —
dat je de puzzel op het scherm oplost.

Zo gaat het niet. **Spelers ontcijferen aan tafel**, met een check of met een
puzzel in hun handen, en de DM drukt op de knop als het gelukt is. Dan hoeft
het husselen alleen nog onleesbaar te zijn, en is een keuzelijst met drie
bereiken een vraag zonder reden. Het is dus altijd de hele tekst.

**En alles doet mee behalve witruimte.** Het prototype husselde alleen letters
(`\p{L}`); daardoor bleven cijfers en leestekens staan, en was "Betaal
Wimmerdinck 42 kronen" voor de helft te lezen in een brief die geheim heette.
Witruimte blijft wél staan — die draagt de vorm van de brief.

Verder, en dit zijn geen details:

- **De husseling ligt vast.** Hij komt uit een seed (`hash(tekst + '|' + bereik)`)
  met een eigen generator, dus dezelfde brief ziet er bij elke keer laden
  hetzelfde uit. Zonder dat kun je er niet aan tafel over praten.
- **Een woord mag niet toevallig leesbaar blijven.** Tot zes keer opnieuw
  husselen zolang elke letter op zijn eigen plek valt.
- **Twee tempo's.** `normaal` voor in de hand (≈ 1,5 s per letter), en
  `tafelscherm` — trager, veel meer spreiding, samen zo'n zes seconden.
- **Reduced motion**: geen beweging maar één knippering van een halve seconde.
- **Doelposities pas ná `document.fonts.ready`**, en opnieuw bij `resize`.
  Vergeet je dat, dan rekent hij met de maten van het vervangende lettertype
  en landen de letters naast hun plek.
- **`aria-label`**: "Gecodeerde brief, nog niet leesbaar", en na het ontcijferen
  de echte tekst.

## Het ene probleem

**De echte tekst staat in de DOM.** Dat moet ook, want de animatie verplaatst
de echte letters. In een prototype is dat niets; in deze app is het precies de
fout die we al een keer gemaakt hebben — de verzegelde brief op het tafelscherm
ging naar de hele campagne-room, en een speler met de netwerktab open las hem
voordat het lakzegel brak. Bij `bereik: 'brief'` staat er letterlijk bij dat
alleen de DM het mag onthullen; dan mag de tekst er niet staan.

**De uitweg, en hij is netjes:** overhandigen op het moment van onthullen.

1. **Vóór de onthulling** stuurt de server alleen de **gehusselde letterreeks**,
   in die volgorde in de DOM. De client tekent hem gewoon — geen transforms,
   niets om terug te draaien. Wie in de inspector kijkt ziet exact wat er op het
   scherm staat. Bij `woord` is dat precies de bedoeling: dát is de puzzel.
2. **Bij de onthulling** stuurt de server de klare tekst. De client zet de echte
   letters in de DOM, geeft ze de transforms die ze op de plek van de
   gehusselde letters zetten — dus precies waar ze stónden — en animeert ze
   naar huis.

Het beeld is identiek aan het prototype, en er is niets uitgelekt. De
husselvolgorde hoort dan wel **op de server** gerekend te worden: telefoon en
tafelscherm moeten dezelfde letters op dezelfde plek hebben, anders klopt de
onthulling aan tafel niet met wat iemand op zijn eigen scherm zag.

## Waar het op aansluit

| in de app | hoe |
|---|---|
| `documenten` met `docType` en `briefstijl` | De code is een **eigen veld**, geen tiende handschrift: een gecodeerde brief kan in elk handschrift staan |
| `knipsel` (`_knipselLetters`) | Wikkelt nu al elk teken in een `<span>`, op de gerenderde HTML, alleen tussen tags door. Precies de techniek die de code nodig heeft — maar ze kunnen niet allebei de buitenste wikkel zijn. Eén wikkel die beide draagt, of netjes nesten |
| zichtbaarheid per party (verborgen / vaag / zichtbaar) | Een onontcijferde brief is **zichtbaar**, niet vaag: je mag hem zien, je kunt hem niet lezen |
| onthulstand per party (`secretReveals`, `_roddels`) | Dezelfde vorm voor "deze party heeft hem ontcijferd". Die opslag is deze week rechtgezet; niet een tweede soort maken |
| `brief:display` → `_briefCinematic()` | Het zegel breekt al in een eigen fase. De ontcijfering is de **tweede** fase, op tempo `tafelscherm` |
| `display:tekst` | Raakt dit niet |

## Waar het anders liep dan het prototype

**De opmaak verspringt wél, en dat mag.** Het prototype kon de eerste meting
overslaan: daar stond de échte tekst al in de DOM en bewogen alleen de glyphs,
dus de regelval veranderde nooit. Hier staat er eerst een andere tekst, en die
breekt zijn regels op zijn eigen plekken. Gemeten over vijf teksten en vier
lettertypes: **in zes van de twintig gevallen anders**.

Dat is geen probleem maar precies waar FLIP voor is. Meten waar alles stáát,
de tekst omwisselen, meten waar alles hóórt, en het verschil weganimeren. Elke
letter vliegt van zijn oude plek naar zijn eigen plek, en de alinea vouwt
zichzelf onderweg in de goede vorm. Het ziet er eerder beter uit dan slechter.

## Beslist (8 okt 2026)

1. **De DM drukt.** Spelers ontcijferen aan tafel; de knop bevestigt dat het
   gelukt is. Eén knop, één regel.
2. **Per party**, zoals geheimen.
3. **Geen weg terug.** Een onthulling hoort onomkeerbaar te voelen, en wat aan
   tafel gezien is kun je toch niet meer afpakken.
4. **Alles doet mee** behalve witruimte.

## De volgorde

1. Het husselen als functie op de server (`lib/`), met de seed uit het
   prototype, zodat elk scherm dezelfde letterplaatsen krijgt.
2. Het veld op het document, de keuze in de editor, en de regel in de
   documentweergave: gehusselde letters tot de party hem heeft.
3. De overhandiging: onthullen stuurt de klare tekst en de client animeert.
4. Het tafelscherm: de tweede fase in `_briefCinematic`, tempo `tafelscherm`.
5. Reduced motion, `document.fonts.ready` en `resize` — alle drie staan ze in
   het prototype en alle drie zijn ze makkelijk te vergeten.
