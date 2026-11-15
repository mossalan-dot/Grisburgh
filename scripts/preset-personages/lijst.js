/**
 * De 62 preset-personages: één per subclass die de app meelevert.
 * Velden: naam, klasse, sub, species, lineage, bg, g (v/m/x), fase, lvl, al, rol.
 * fase: jong | volwassen | middelbaar | oud | hoogbejaard — gemeten aan de
 * levensduur van het species, niet in jaren.
 * Nakijken en de tabel maken: node scripts/preset-personages/tabel.js
 */
module.exports = [
  // Barbarian
  { naam: 'Grosk IJzerhand',       klasse: 'Barbarian', sub: 'Path of the Berserker',   species: 'Half-Orc',   bg: 'Mercenary Veteran',        g: 'm', fase: 'oud',   lvl: 5,  al: 'CE', rol: 'Verhuurt zijn woede per dag' },
  { naam: 'Oma Trui Hazelaar',     klasse: 'Barbarian', sub: 'Path of the Wild Heart',  species: 'Halfling', lineage: 'Stout', bg: 'Farmer',      g: 'v', fase: 'oud',         lvl: 9,  al: 'NG', rol: 'Voert de wolven die haar kudde kwamen halen' },
  { naam: 'Eikmoeder Wend',        klasse: 'Barbarian', sub: 'Path of the World Tree',  species: 'Firbolg',    bg: 'Moonwell Pilgrim',         g: 'v', fase: 'hoogbejaard', lvl: 14, al: 'N',  rol: 'Wortelt waar ze staat, en wijkt niet' },
  { naam: 'Broeder Aurik',         klasse: 'Barbarian', sub: 'Path of the Zealot',      species: 'Aasimar',    bg: 'Knight of the Gauntlet',    g: 'm', fase: 'jong',        lvl: 3,  al: 'LG', rol: 'Te jong voor zoveel heilig vuur' },
  // Bard
  { naam: 'Meester Tavrin Oolt',   klasse: 'Bard', sub: 'College of Lore',             species: 'Vedalken',   bg: 'Cloistered Scholar',        g: 'm', fase: 'middelbaar',  lvl: 10, al: 'LN', rol: 'Verbetert je, ook midden in een gevecht' },
  { naam: 'Lina Hoefslag',         klasse: 'Bard', sub: 'College of Dance',            species: 'Satyr',      bg: 'Entertainer',               g: 'v', fase: 'jong',        lvl: 4,  al: 'CG', rol: 'Staat nooit stil, ook niet als het moet' },
  { naam: 'Seliene Winterdraad',   klasse: 'Bard', sub: 'College of Glamour',          species: 'Eladrin', lineage: 'Winter', bg: 'Witchlight Hand', g: 'v', fase: 'volwassen',   lvl: 12, al: 'CN', rol: 'Ex-ster van een feeënkermis' },
  { naam: 'Brom Keistem',          klasse: 'Bard', sub: 'College of Valor',            species: 'Dwarf',      bg: 'Soldier',                   g: 'm', fase: 'oud',         lvl: 8,  al: 'LG', rol: 'Zong drie oorlogen bij elkaar' },
  // Cleric
  { naam: 'Zuster Ida Lindeboom',  klasse: 'Cleric', sub: 'Life Domain',               species: 'Human',      bg: 'Acolyte',                   g: 'v', fase: 'middelbaar',  lvl: 7,  al: 'NG', rol: 'Heeft meer bevallingen dan veldslagen gezien' },
  { naam: 'Vesper Schemerlicht',   klasse: 'Cleric', sub: 'Twilight Domain',           species: 'Duskling',   bg: 'Ward of the Sheltering Hands', g: 'v', fase: 'jong',     lvl: 5,  al: 'NG', rol: 'Houdt de wacht zodat jij kunt slapen' },
  { naam: 'Tharros Gloedschub',    klasse: 'Cleric', sub: 'Light Domain',              species: 'Dragonborn', lineage: 'Gold', bg: 'Flaming Fist Mercenary', g: 'm', fase: 'volwassen', lvl: 19, al: 'LG', rol: 'Brandt het donker weg, en soms meer' },
  { naam: 'Kapitein Vaskra',       klasse: 'Cleric', sub: 'War Domain',                species: 'Hobgoblin',  bg: 'Boros Legionnaire',         g: 'v', fase: 'middelbaar',  lvl: 17, al: 'LE', rol: 'Bidt om discipline, niet om genade' },
  { naam: 'Merel',                 klasse: 'Cleric', sub: 'Trickery Domain',           species: 'Changeling', bg: 'Faceless',                  g: 'x', fase: 'volwassen',   lvl: 6,  al: 'CN', rol: 'Heeft geen eigen gezicht, wel een eigen god' },
  { naam: 'Moeder Ulla Pennevaart',klasse: 'Cleric', sub: 'Knowledge Domain',          species: 'Owlin',      bg: 'Scribe',                    g: 'v', fase: 'hoogbejaard', lvl: 20, al: 'LN', rol: 'Weet het, en schreef het al op' },
  { naam: 'Halvard Grasdrift',     klasse: 'Cleric', sub: 'Nature Domain',             species: 'Centaur',    bg: 'Emerald Enclave Caretaker', g: 'm', fase: 'oud',         lvl: 15,  al: 'N',  rol: 'Priester van een god zonder tempel' },
  { naam: 'Nerion Golfslag',       klasse: 'Cleric', sub: 'Tempest Domain',            species: 'Triton',     bg: 'Sailor',                    g: 'm', fase: 'oud',        lvl: 4,  al: 'CG', rol: 'Vaart de storm in, niet eromheen' },
  // Druid
  { naam: 'Oude Koppie',           klasse: 'Druid', sub: 'Circle of the Land',         species: 'Tortle',     bg: 'Hermit',                    g: 'm', fase: 'hoogbejaard', lvl: 20, al: 'N',  rol: 'Heeft dit moeras zien ontstaan' },
  { naam: 'Rauw Maanvacht',        klasse: 'Druid', sub: 'Circle of the Moon',         species: 'Shifter', lineage: 'Beasthide', bg: 'Uthgardt Tribe Member', g: 'v', fase: 'volwassen', lvl: 7, al: 'CN', rol: 'Is liever beest dan mens' },
  { naam: 'Maretje Wiervloed',     klasse: 'Druid', sub: 'Circle of the Sea',          species: 'Sea Elf',    bg: 'Fisher',                    g: 'v', fase: 'middelbaar',  lvl: 16, al: 'NG', rol: 'Kent elk getij bij naam' },
  { naam: 'Ilvaren Sterrenwacht',  klasse: 'Druid', sub: 'Circle of the Stars',        species: 'Astral Elf', bg: 'Astral Drifter',            g: 'm', fase: 'hoogbejaard', lvl: 18, al: 'NG', rol: 'Leest de toekomst, maar zegt het niet' },
  // Fighter
  { naam: 'Fenna Strijkhout',      klasse: 'Fighter', sub: 'Champion',                 species: 'Goliath', lineage: 'Storm', bg: 'Giant Foundling', g: 'v', fase: 'jong',        lvl: 3,  al: 'NG', rol: 'Opgevoed door reuzen, vindt iedereen klein' },
  { naam: 'Generaal Snik',         klasse: 'Fighter', sub: 'Battle Master',            species: 'Goblin',     bg: 'Guard',                     g: 'v', fase: 'hoogbejaard', lvl: 12, al: 'LE', rol: 'Klom op van poortwachter tot veldheer' },
  { naam: "Zerath'vai",            klasse: 'Fighter', sub: 'Eldritch Knight',          species: 'Githyanki',  bg: 'Knight of the Order',       g: 'm', fase: 'volwassen',   lvl: 11, al: 'LE', rol: 'Draagt een zilveren zwaard en een oude wrok' },
  { naam: 'Tahvar',                klasse: 'Fighter', sub: 'Psi Warrior',              species: 'Kalashtar',  bg: 'Inquisitive',               g: 'x', fase: 'volwassen',   lvl: 6,  al: 'LG', rol: 'Hoort de dromen van de schuldige' },
  // Monk
  { naam: 'Shâli',                 klasse: 'Monk', sub: 'Warrior of the Open Hand',    species: 'Githzerai',  bg: 'Planar Philosopher',        g: 'v', fase: 'middelbaar',  lvl: 17,  al: 'N', rol: 'Verslaat je zonder haar adem te verliezen' },
  { naam: 'Klik',                  klasse: 'Monk', sub: 'Warrior of Shadow',           species: 'Kenku',      bg: 'Wayfarer',                  g: 'm', fase: 'hoogbejaard',        lvl: 5,  al: 'NE', rol: 'Praat met jouw stem, achter je rug' },
  { naam: 'Zefira',                klasse: 'Monk', sub: 'Warrior of the Elements',     species: 'Genasi', lineage: 'Air', bg: 'Genie Touched',     g: 'v', fase: 'jong',        lvl: 8,  al: 'CG', rol: 'Een windvlaag met een mening' },
  { naam: 'Meester Grijsvlek',     klasse: 'Monk', sub: 'Warrior of Mercy',            species: 'Tabaxi',     bg: 'Vampire Survivor',          g: 'm', fase: 'oud',         lvl: 13, al: 'LG', rol: 'Geneest met de ene hand, doodt met de andere' },
  // Paladin
  { naam: 'Ser Trumbald',          klasse: 'Paladin', sub: 'Oath of Devotion',         species: 'Loxodon',    bg: 'Noble',                     g: 'm', fase: 'oud',         lvl: 18, al: 'LG', rol: 'Vergeet geen belofte, ook niet die van een ander' },
  { naam: 'Pimpernel',             klasse: 'Paladin', sub: 'Oath of the Ancients',     species: 'Fairy',      bg: 'Feylost',                   g: 'v', fase: 'jong',        lvl: 4,  al: 'CG', rol: 'Klein, fel, en zweert bij het voorjaar' },
  { naam: 'Kaelo Manenzon',        klasse: 'Paladin', sub: 'Oath of Glory',            species: 'Leonin',     bg: 'Athlete',                   g: 'm', fase: 'jong',        lvl: 6,  al: 'CG', rol: 'Wil bezongen worden, en verdient het soms' },
  { naam: 'Asvrouw Nerys',         klasse: 'Paladin', sub: 'Oath of Vengeance',        species: 'Tiefling', lineage: 'Infernal', bg: 'Ruined',     g: 'v', fase: 'middelbaar',  lvl: 14, al: 'LN', rol: 'Verloor alles, en houdt een lijst bij' },
  // Ranger
  { naam: 'Sskar',                 klasse: 'Ranger', sub: 'Hunter',                    species: 'Lizardfolk', bg: 'Guide',                     g: 'm', fase: 'volwassen',   lvl: 8,  al: 'N',  rol: 'Ziet je als prooi, als gids of als maaltijd' },
  { naam: 'Wipje',                 klasse: 'Ranger', sub: 'Beast Master',              species: 'Harengon',   bg: 'Familiar Trainer',          g: 'v', fase: 'jong',        lvl: 3,  al: 'CG', rol: 'Haar das is de baas, zij doet alsof' },
  { naam: 'Aelor Mosdauw',         klasse: 'Ranger', sub: 'Fey Wanderer',              species: 'Elf', lineage: 'Wood Elf', bg: 'Mythalkeeper',    g: 'm', fase: 'hoogbejaard', lvl: 19, al: 'CG', rol: 'Wandelt al zevenhonderd jaar langs dezelfde grens' },
  { naam: 'Krinne Diepsteen',      klasse: 'Ranger', sub: 'Gloom Stalker',             species: 'Deep Gnome', bg: 'Shadowmasters Exile',       g: 'v', fase: 'middelbaar',  lvl: 11, al: 'N',  rol: 'Ontvluchtte de schaduw, jaagt er nu in' },
  // Rogue
  { naam: 'Spriek',                klasse: 'Rogue', sub: 'Thief',                      species: 'Kobold',     bg: 'Criminal',                  g: 'm', fase: 'jong',        lvl: 5,  al: 'CE', rol: 'Pakt wat glimt, en geeft soms iets terug' },
  { naam: 'Kapitein Roos Zeewind', klasse: 'Rogue', sub: 'Swashbuckler',               species: 'Half-Elf',   bg: 'Chondathan Freebooter',     g: 'v', fase: 'volwassen',   lvl: 9,  al: 'CG', rol: 'Verliest liever haar schip dan haar stijl' },
  { naam: 'Dorus Knipoog',         klasse: 'Rogue', sub: 'Arcane Trickster',           species: 'Gnome', lineage: 'Forest', bg: 'Charlatan',      g: 'm', fase: 'hoogbejaard', lvl: 13, al: 'CN', rol: 'Verkoopt al tweehonderd jaar wondermiddelen' },
  { naam: 'Ssylith',               klasse: 'Rogue', sub: 'Assassin',                   species: 'Yuan-ti',    bg: 'Dimir Operative',           g: 'v', fase: 'volwassen',   lvl: 16, al: 'LE', rol: 'Het gif is nooit persoonlijk' },
  { naam: 'Weder',                 klasse: 'Rogue', sub: 'Soulknife',                  species: 'Reborn',     bg: 'Haunted One',               g: 'x', fase: 'middelbaar',  lvl: 7,  al: 'NE', rol: 'Weet niet meer wie het was, wel hoe het stierf' },
  // Sorcerer
  { naam: 'Liria Schubbenhart',    klasse: 'Sorcerer', sub: 'Draconic Sorcery',        species: 'Elf', lineage: 'High Elf', bg: 'Dragon Cultist',  g: 'v', fase: 'jong',        lvl: 5,  al: 'NG', rol: 'Liep weg uit de sekte, de draak liep mee' },
  { naam: 'Gloep',                 klasse: 'Sorcerer', sub: 'Wild Magic Sorcery',      species: 'Plasmoid',   bg: 'Crucible Storm Chaser',     g: 'x', fase: 'jong',        lvl: 3,  al: 'CN', rol: 'Elke spreuk een verrassing, ook voor Gloep' },
  { naam: 'Tik-Zeven',             klasse: 'Sorcerer', sub: 'Clockwork Sorcery',       species: 'Autognome',  bg: 'Quandrix Student',          g: 'x', fase: 'volwassen',   lvl: 10, al: 'LN', rol: 'Rekent uit hoe het universum hoort te lopen' },
  { naam: "Kk'trak",               klasse: 'Sorcerer', sub: 'Aberrant Sorcery',        species: 'Thri-kreen', bg: 'Far Traveler',              g: 'x', fase: 'middelbaar',  lvl: 12, al: 'N',  rol: 'Hoort gedachten die van ver weg komen' },
  // Warlock
  { naam: 'Lucan Duivelsdobbel',   klasse: 'Warlock', sub: 'Fiend Patron',             species: 'Tiefling', lineage: 'Abyssal', bg: 'Gambler',     g: 'm', fase: 'jong',        lvl: 4,  al: 'CE', rol: 'Zette zijn ziel in, en won — denkt hij' },
  { naam: 'Grietje Doornappel',    klasse: 'Warlock', sub: 'Archfey Patron',           species: 'Hexblood',   bg: 'Mist Wanderer',             g: 'v', fase: 'oud',         lvl: 16,  al: 'CN', rol: 'Haar tante is een heks, haar patroon erger' },
  { naam: 'Grumak Zonnehart',      klasse: 'Warlock', sub: 'Celestial Patron',         species: 'Orc',        bg: 'Rewarded',                  g: 'm', fase: 'middelbaar',  lvl: 7,  al: 'NG', rol: 'Een engel koos hem, niemand snapt waarom' },
  { naam: 'Spoor',                 klasse: 'Warlock', sub: 'Great Old One Patron',     species: 'Warforged',  bg: 'Cosmic Dawn Experiment',    g: 'x', fase: 'oud',         lvl: 17, al: 'NE', rol: 'Gebouwd om te vechten, wakker gemaakt door iets anders' },
  // Wizard
  { naam: 'Majoor Hobbel',         klasse: 'Wizard', sub: 'Evoker',                    species: 'Giff',       bg: 'Wildspacer',                g: 'm', fase: 'middelbaar',  lvl: 11, al: 'LG', rol: 'Een Fireball is ook maar artillerie' },
  { naam: 'Vrouwe Grimhilde Grauw',klasse: 'Wizard', sub: 'Abjurer',                   species: 'Duergar',    bg: 'Gate Warden',               g: 'v', fase: 'hoogbejaard', lvl: 14, al: 'LN', rol: 'Niets komt erdoor, ook geen bezoek' },
  { naam: 'Zilvrae',               klasse: 'Wizard', sub: 'Diviner',                   species: 'Elf', lineage: 'Drow', bg: 'Sage',                g: 'v', fase: 'hoogbejaard', lvl: 20, al: 'NE', rol: 'Zag het einde, en wacht er geduldig op' },
  { naam: 'Mirvon',                klasse: 'Wizard', sub: 'Illusionist',               species: 'Shadar-kai', bg: 'Phantasmic Circus Trouper', g: 'm', fase: 'oud',   lvl: 8,  al: 'NE', rol: 'Was ooit kleurrijk; nu zijn alleen zijn trucs dat' },
  // Artificer
  { naam: 'Dokter Lize Kieuw',     klasse: 'Artificer', sub: 'Alchemist',              species: 'Simic Hybrid', bg: 'Simic Scientist',         g: 'v', fase: 'volwassen',   lvl: 6,  al: 'N', rol: 'Haar eerste proefpersoon was zijzelf' },
  { naam: 'Toren Hoornsmid',       klasse: 'Artificer', sub: 'Armorer',                species: 'Minotaur',   bg: 'Artisan',                   g: 'm', fase: 'middelbaar',  lvl: 15,  al: 'LN', rol: 'Smeedde zijn harnas om zijn hoorns heen' },
  { naam: 'Pruuk',                 klasse: 'Artificer', sub: 'Artillerist',            species: 'Verdan',     bg: 'Rival Intern',              g: 'm', fase: 'jong',        lvl: 4,  al: 'CG', rol: 'Wil promotie, krijgt ontploffingen' },
  { naam: 'Kiri Veerwind',         klasse: 'Artificer', sub: 'Battle Smith',           species: 'Aarakocra',  bg: 'Merchant',                  g: 'v', fase: 'oud',         lvl: 12, al: 'LG', rol: 'Haar Steel Defender beschermt de handelsroute' },
  { naam: 'Mungo Takkenzeil',      klasse: 'Artificer', sub: 'Cartographer',           species: 'Hadozee',    bg: 'Archaeologist',             g: 'm', fase: 'volwassen',   lvl: 7,  al: 'NG', rol: 'Tekent kaarten van plekken die nog niet bestaan' },
  // Blood Hunter
  { naam: 'Selwyn Bleekdoorn',     klasse: 'Blood Hunter', sub: 'Order of the Ghostslayer', species: 'Dhampir', bg: 'Vampire Devotee',         g: 'v', fase: 'middelbaar',  lvl: 10, al: 'LN', rol: 'Diende ooit een vampier, jaagt nu op zijn soort' },
  { naam: 'Raf Grijsmuil',         klasse: 'Blood Hunter', sub: 'Order of the Lycan',  species: 'Lupin',      bg: 'Gruul Anarch',              g: 'm', fase: 'oud',        lvl: 5,  al: 'CE', rol: 'Vecht tegen de wolf in zichzelf, en verliest graag' },
  { naam: 'Gharruk',               klasse: 'Blood Hunter', sub: 'Order of the Mutant', species: 'Bugbear',    bg: 'Volstrucker Agent',         g: 'm', fase: 'oud',         lvl: 13, al: 'LE', rol: 'Zijn bloed is een recept dat te vaak is aangepast' },
  { naam: 'Ysolde Tweespiegel',    klasse: 'Blood Hunter', sub: 'Order of the Profane Soul', species: 'Khoravar', bg: 'House Medani Heir',    g: 'v', fase: 'volwassen',   lvl: 18, al: 'NE', rol: 'Ruilde een stuk ziel voor een stuk macht' },
];
