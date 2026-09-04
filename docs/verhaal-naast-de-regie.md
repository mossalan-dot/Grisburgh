# Verhaal naast de regie, en ordening per hoofdstuk

Opgesteld 4 sep 2026. Twee vragen die op één antwoord uitkomen. Nog niets
gebouwd.

---

## Wat er nu is

- **De regie-balk** is één platte strook stappen onderaan het scherm, met een
  filter (alles / beeld / kaartje / gevecht). Voor akte 3 zijn dat er **116**, voor
  akte 12 **79**. Dat scrollt eindeloos en je raakt je plek kwijt.
- **De verhaaltekst** staat sinds vandaag bij de akte in de Meesterkamer — maar
  tijdens het spelen kijk je naar de regie-balk, en dan is die tekst een tab weg.
- **In de data is een akte hetzelfde als een hoofdstuk**: `meta.hoofdstukken`
  bevat h1…h15, elk met één `script`. Het tussenniveau waar jij aan denkt
  (een akte die uit hoofdstukken bestaat) bestaat nog niet.

## Het idee: één ruggengraat voor allebei

Beide vragen zijn dezelfde vraag: **hoe hak je een akte in stukken?** Zodra dat
er is, is "het verhaal ernaast" bijna gratis, want tekst en script kunnen dan
dezelfde indeling volgen.

Mijn voorstel: **een sectiekop als staptype in het script** (`{type:'kop',
titel}`). Geen tweede niveau in de data, geen migratie, geen aanpassing aan
alles wat `script` leest — een kop is gewoon een stap die niets onthult maar
de lijst opdeelt. De regie-balk groepeert op de laatste kop erboven.

Waarom dat het antwoord op allebei is: de verhaaltekst heeft **al** koppen —
`##` in de markdown. Bij het inlezen maakt de importer daar sectiekoppen van in
het script. Daarmee zijn de secties van je tekst en de secties van je regie
**dezelfde secties**, met dezelfde namen. Dat maakt het schuifje simpel:

- De regie-balk krijgt een **verhaalpaneel** dat vanaf de zijkant openschuift,
  met de tekst van de sectie waar je nu in zit.
- Vooruit/terug per sectie, en de regie-balk springt mee (of andersom — zie de
  vragen).
- Ben je bij "Aankomst in de haven", dan zie je die alinea's én precies de
  stappen die daarbij horen. Niet 116 stappen op een rij.

## Wat het kost

- Een staptype erbij (icoon + rendering in twee bestanden, zoals bij `loot`).
- Groeperen in de regie-balk: koppen als scheiding, met inklappen per sectie.
- Een schuifpaneel met de tekst, gesplitst op `##`.
- De importer laat `##` een kop worden in plaats van hem weg te gooien.
- Voor bestaande aktes: koppen kun je met de hand toevoegen en verslepen (het
  script kent al sleepvolgorde). Niets breekt als je ze niet toevoegt — dan is
  het één sectie, precies zoals nu.

## Vragen

1. **Wie leidt?** Klik je een sectie in het verhaal aan en springt de regie-balk
   mee, of andersom: schuif je door de stappen en volgt de tekst? Ik zou beide
   kanten koppelen, met de tekst als leidend bij het voorbereiden en de stappen
   als leidend tijdens het spelen.
2. **Waar komt het paneel?** Een lade die over het speelvlak schuift (veel
   ruimte, maar bedekt de kaart), of een smalle kolom naast de regie-balk (altijd
   zichtbaar, minder tekst tegelijk)? Op wat voor scherm zit je tijdens een
   sessie — laptop, of een tweede scherm ernaast?
3. **Automatisch of met de hand?** Moeten `##`-koppen bij het inlezen altijd
   sectiekoppen worden, of wil je dat zelf bepalen?
4. **Zien spelers hier ooit iets van?** Ik ga uit van nee: dit is jouw script.
   Het tafelscherm blijft de beelden en de cinematics tonen.
5. **Onthouden waar je was?** Nu weet de app welke akte een groep speelt
   (`activeAkte`). Moet daar de sectie bij, zodat je na een onderbreking terugkomt
   waar je gebleven was?
6. **De koppen in het logboek?** Sessieverslagen hebben nu een eigen indeling per
   entry. Wil je dat de secties dáár ook terugkomen, of blijft dat gescheiden?
