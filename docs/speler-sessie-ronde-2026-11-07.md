# Als speler, en tijdens een lopende sessie — 7 november 2026

Twee rondes na die van de nieuwe DM. Eerst **Zuster Marelle** (Cleric 11) op een
telefoon: winkelen, brieven lezen, de diensten langs, een drankje drinken. Daarna
een **lopende sessie** met drie schermen tegelijk in één browser — de DM op een
laptop, Marelle op haar telefoon en het tafelscherm op een tablet — zodat elke
socketmelding echt bij de anderen aankomt. Op een wegwerpkopie van de data, in
party *De Lantaarns*.

---

## Wat goed liep

- **De lade tijdens het spelen.** *Op tafel* zet een voorleesblok groot op het
  tafelscherm, het oogje achter een naam onthult hem bij de speler, en de
  speler krijgt het als venster. Precies zoals bedoeld.
- **Een gevecht starten** vanuit de encounter vult de party aan, de speler
  krijgt een klein balkje ("Jij bent aan zet") in plaats van een overgenomen
  scherm, en schade door de DM staat meteen op de HP-ring van de speler.
- **De kist op tafel**: tikken, filmpje, de buit. Lange rust: HP vol, overlay op
  beide schermen met de maanfase.
- **Level omhoog**: een helder venster (class, HP-methode, wat je krijgt), een
  omslag op de telefoon en een kaartje op het tafelscherm.
- **Een drankje drinken** vraagt eerst ("Je hebt er 3; daarna nog 2") en telt
  de HP er server-side bij.

---

## Gevonden en opgelost

### Als speler

| # | Wat |
|---|---|
| 58 | Op de Markt stond `"/>` waar het portret van de winkelier hoort: `icon()` kreeg een kant-en-klare svg in plaats van een naam. |
| 59 | Na een aankoop stond je weer op het marktoverzicht — de beursmelding die op elke aankoop volgt tekende de Markt vanaf het begin. Nu blijf je in de winkel, met een melding "… gekocht." |
| 60 | De voorraadtabel (gemaakt voor een licht kaartje) stond in de Markt op het donkere paneel: de *Kopen*-knoppen waren donkerbruin op bijna zwart. |
| 61 | De beurs bovenin elke dienst zei "23 fl · 4 kn" in een campagne met Gold/Silver. Nu gp/sp/cp, en met eigen munten de eerste letters (`window._muntAfk`). |
| 62 | Een herberg zonder ingevulde waard: "weet niets meer te vertellen." — een zin zonder onderwerp. |
| 63 | Een brief toonde `--De Havenmeester--` letterlijk. Brieven gebruiken nu dezelfde perkamentweergave als documenten, en `--Naam--` op één regel telt als ondertekening. |

### Tijdens de sessie

| # | Wat |
|---|---|
| 64 | **Het tafelscherm toonde de exacte HP en AC van elk monster.** Het is als DM ingelogd, maar ligt midden op tafel — de telefoons kregen die getallen juist níét. Nu krijgt het de spelersversie, met wat de party in het bestiarium kent. Twee wegen dicht: de socket (herkend aan de tafelroom) en het laden (`?tafel=1`, opnieuw opgehaald bij het aanzetten, want bij `?display=1` lag het gevecht er al vóór het scherm wist dat het een tafelscherm was). |
| 65 | Een tafelscherm dat herlaadde tijdens het claimen raakte de kist kwijt. |
| 66 | Onthulde de DM een kaartje en stuurde hij daarna een verzegelde brief, dan lag de onthulling bóven de brief en was het zegel niet aan te tikken. |
| 67 | Een gegund level kwam pas bij de speler aan als hij zijn scherm ververste: de server riep het om, niemand luisterde. |
| 68 | "0 fl 4 kn bijgeschreven" (de speler kreeg er 42 koper, las er 40); "Loot beschikbaar! Alle items zijn verdeeld." bij een kist met alleen geld. |
| 69 | *Jij bent aan zet* brak op de telefoon over drie regels. |
| 70 | Level-up en spreukdetail: "klasse", "verhoging", "Spreuken van niveau 3", "Tovervorm" en Nederlandse PHB-scholen ("Oproeping"). Nu Class, Ability Score Improvement, level, Cantrip, Evocation. Knoppen stonden in het systeemlettertype. |
| 71 | Emoji in de meldingen (👤 ✅ ✉️ 🎲 …) en "De Gock" hardgecodeerd in een melding — de naam van de dienst in Grisburgh, niet in elke campagne. |

Bewaakt door `tests/spelersronde.test.js` (munten, ondertekening) en
`tests/tafelscherm-sessie.test.js` (gevecht via HTTP én socket, de kist). Op
de oude code vallen er twee van de drie tafelschermtests om.

---

## Gezien — en wat je erover besloot

- ~~Een speler kan zijn eigen level, class en subclass omzetten~~ — hoort bij
  de DM; opgelost als #72 (een subclass kiest de speler één keer zelf).
- **De "+" bij een stapel in de boedel** ("Nog een gevonden") laat een speler
  zelf een exemplaar bijtellen. Handig aan tafel, maar het is een weg om een
  drankje erbij te zetten zonder dat de DM het weet.
- **De ontdekkingsteller** zegt "Personages 25 / 30": de speler weet dus hoeveel
  kaartjes er bestaan die hij nog niet kent. Als spelelement leuk, maar het
  verklapt dat er nog iets is.
- **Een dienst die aanstaat maar leeg is** (de tempel zonder goden: "Er zijn nog
  geen goden bekend in deze tempel.") staat gewoon in het menu van de speler.

De stapel-"+", de ontdekkingsteller en de lege dienst zijn zo bedoeld en blijven
staan.

## Kleine dingen

- Het "Onthuld"-venster en de verzegelde brief tonen allebei een sluitkruisje
  als `✕`-teken; de rest van de app gebruikt `icon('x')`.
- De melding bij een gegund level blijft staan als je het venster via de balk
  opent in plaats van via de melding.
- In de gegenereerde testdata staat "op de De Oude Schans" — een fout in het
  vulscript, niet in de app.
