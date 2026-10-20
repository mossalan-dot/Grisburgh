# Features die meegroeien met je level

*Gevraagd op 20 oktober 2026: "Sommige class features en species traits geven
iets extra's op een ander level. De feature wordt gegeven op een bepaald level,
maar verandert op een ander. Hoe zouden we dat kunnen invoeren en weergeven?"*

## Wat het probleem is

Een feature heeft in de app precies één level: het level waarop je hem krijgt.
Dat klopt voor de helft van het verhaal. Een Bardic Inspiration krijg je op 1,
maar de dobbelsteen wordt een d8 op 5, een d10 op 10 en een d12 op 15. Een
Breath Weapon doet meer schade op 5, 11 en 17. Een Fey Step krijgt op 3 een
extra effect. In de app staat daar één kaartje met één getal, en wat er op 5
gebeurt staat ergens midden in de lopende tekst — of nergens.

**Hoe vaak dit voorkomt, in Grisburgh gemeten:** van de 1158 features noemen er
**79** in hun eigen tekst een hóger level dan dat van henzelf. Verdeeld over 27
class features, 33 subclass features, 10 species traits en 9 traits van een
variant. Het is dus geen randgeval van een paar classes.

## Hoe het er nu omheen wordt gewerkt

Er lopen op dit moment drie oplossingen door elkaar, en geen van drieën is er
een:

1. **De feature staat er meerdere keren in**, één keer per level. Dat doet
   *Ability Score Improvement* (4, 8, 12, 16), *Indomitable* (9, 13, 17) en
   *Action Surge* (2, 17) — 22 gevallen. In de tijdlijn klopt dat prachtig: op
   level 13 krijg je iets. In het Heldenboek staat hetzelfde kaartje er drie
   keer, elk met de hele tekst, en bij het bewerken moet je ze alledrie
   bijwerken.
2. **Een nieuwe naam met een volgnummer.** De Tiefling heeft *Legacy-spreuk
   (1e)* op 3 en *Legacy-spreuk (2e)* op 5. Leest goed in de tijdlijn, maar het
   is geen feature die bestaat — in het boek heet dat gewoon Fiendish Legacy.
3. **Alleen in de tekst.** "Starting at 5th level, …". Dat is wat er in 60 van
   de 79 gevallen gebeurt. Niets in de app weet het, dus de tijdlijn zwijgt
   erover en een speler van level 5 moet het zelf uit de alinea vissen.

## Voorstel: een feature krijgt een lijstje `groei`

```jsonc
{
  "name": "Bardic Inspiration",
  "desc": "Je kunt een bondgenoot inspireren …",
  "groei": [
    { "level": 5,  "tekst": "De Bardic Inspiration-steen wordt een **d8**." },
    { "level": 10, "tekst": "De steen wordt een **d10**." },
    { "level": 15, "tekst": "De steen wordt een **d12**." }
  ]
}
```

Eén kaartje, één plek om te bewerken, en het level waarop iets verandert is nu
**data** in plaats van een zin. Dat is precies het verschil dat de rest van de
app nodig heeft om er iets mee te kunnen.

**Waarom niet gewoon de feature herhalen** (oplossing 1 hierboven): dan is het
kaartje zijn eigen dubbelganger. Het Heldenboek is een naslagwerk waarin je op
naam zoekt; drie kaartjes "Indomitable" is drie keer hetzelfde antwoord. En de
beschrijving — de duurste inhoud die we hebben, want die typt de DM zelf —
staat er dan drie keer, en loopt uit elkaar zodra er één wordt bijgewerkt.

**Waarom geen tabel in de beschrijving:** kan al, en het is wat de PHB doet.
Maar een tabel is tekst: de tijdlijn kan er niets mee, het spelersblad kan niet
zeggen "dit geldt nu voor jou", en zoeken op "wat verandert er op 11" blijft
onmogelijk.

## Hoe het eruitziet

- **Op het kaartje in het Heldenboek**, onder de beschrijving: een regel
  *groeit op 5 · 10 · 15*. Meer niet — het kaartje is een vitrine.
- **In het detailvenster**: de groeiregels onder de beschrijving, elk met zijn
  level als bolletje ervoor. Dezelfde bol als in de featurelijst onder een
  houder, dus het leest meteen als "hier hoort een level bij".
- **In de tijdlijn** (`render-progressie.js`): op level 10 verschijnt een regel
  *Bardic Inspiration — wordt sterker*, met de tekst van die trede. Dat is wat
  de tijdlijn nu mist, en de reden dat Ability Score Improvement er vier keer
  in staat.
- **Op het spelersblad**: de treden tot en met jouw level staan erbij, de rest
  niet. Een Bard van 7 leest "de steen is een d8" en hoeft niet te rekenen.
- **Bij een eigen class** is het veld gewoon leeg; dan verandert er niets.

## Wat het kost

Een rij in het bewerkvenster (level + tekst, net als de tabelrijen die er al
zijn), een veld in `POST /progression/feature`, en drie renderers die het
lezen. De migratie van de 22 dubbele features kan met de hand: het zijn er 22,
en de tekst is bij alledrie dezelfde.

**Begin niet met de editor.** Zet `groei` eerst met de hand op een stuk of zes
features — Bardic Inspiration, Breath Weapon, Indomitable, Fey Step, Fiendish
Legacy, Sneak Attack — en kijk een avond aan tafel of het klopt wat je ziet.
Pas daarna het invoerscherm. Zelfde volgorde als bij
[`voorstel-feature-keuzes.md`](voorstel-feature-keuzes.md), en om dezelfde
reden: de vorm van de data is hier de hele beslissing.

## Eén nuance om niet te vergeten

"Level" betekent voor een class feature je **classlevel** en voor een species
trait je **personagelevel**. Dat verschil bestaat nu al (een multiclass Bard 3 /
Rogue 5 heeft een d6 Bardic Inspiration, geen d8), en `groei` maakt het
zichtbaar in plaats van dat het in een alinea verstopt zit. Wat de tijdlijn
daarmee doet is dezelfde vraag die ze nu ook al heeft.
