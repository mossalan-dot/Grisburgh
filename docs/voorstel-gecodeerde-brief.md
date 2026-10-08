# Gecodeerde brief

Werkdocument, 8 oktober 2026. **Nog niets gebouwd.** De bron is het prototype
*Gecodeerde brief* (artefact, 2 okt 2026); dit is wat erin zit, wat het in deze
app raakt, en wat er beslist moet worden.

## Wat het prototype doet

Geen cijferschrift maar een **anagram door verplaatsing**. De letters in de DOM
staan al in de goede volgorde; in versleutelde staat krijgt elke letter een
`transform` die hem op de plek van een andere letter uit zijn groep zet.
Ontcijferen is die transforms wegnemen, en dan vliegt elke letter in een boogje
naar huis. De opmaak verspringt daarbij nooit — het is dezelfde regelval, voor
en na. Dat is de hele vondst, en het is mooier dan letters die veranderen: je
ziet dat het *dezelfde brief* is.

Drie bereiken, met de uitleg die het prototype er zelf bij geeft:

| bereik | wat er door elkaar gaat | wie het kan oplossen |
|---|---|---|
| `woord` | elk woord is een anagram van zichzelf | *"Spelers kunnen dit zelf oplossen."* |
| `regel` | de letters van een hele regel | *"Lastig, maar niet onmogelijk."* |
| `brief` | alle letters van de brief | *"Alleen de DM kan dit onthullen."* |

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

## Wat er beslist moet worden

1. **Wie drukt?** Bij `brief` is het de DM. Bij `woord` lossen de spelers het in
   hun hoofd op — maar wie zet het dan om op het scherm? Voorstel: ook de DM,
   als bevestiging dat ze het goed hebben. Dan is er één knop en één regel.
2. **Per party of per campagne?** Voorstel: per party, zoals geheimen. Twee
   groepen door dezelfde brief laten lopen is anders stuk.
3. **Terug kunnen.** Het prototype kan opnieuw versleutelen. Aan tafel is dat
   vooral handig om te oefenen; in de app hoort een onthulling onomkeerbaar te
   voelen. Voorstel: wel terug kunnen, maar alleen voor de DM en zonder
   vertoning.
4. **Welke tekens doen mee.** Het prototype husselt alleen `\p{L}` — leestekens
   en cijfers blijven staan. Een datum of een bedrag blijft dus leesbaar. Dat
   is een keuze, geen vergissing; bevestigen.

## De volgorde

1. Het husselen als functie op de server (`lib/`), met de seed uit het
   prototype, zodat elk scherm dezelfde letterplaatsen krijgt.
2. Het veld op het document, de keuze in de editor, en de regel in de
   documentweergave: gehusselde letters tot de party hem heeft.
3. De overhandiging: onthullen stuurt de klare tekst en de client animeert.
4. Het tafelscherm: de tweede fase in `_briefCinematic`, tempo `tafelscherm`.
5. Reduced motion, `document.fonts.ready` en `resize` — alle drie staan ze in
   het prototype en alle drie zijn ze makkelijk te vergeten.
