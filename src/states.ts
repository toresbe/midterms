/*
 * State fact sheets. Population: 2020 census. Area: total area (land and
 * water) in km², US Census Bureau. Birds and flowers: official state symbols
 * (official English names; a Norwegian name where one is in common use).
 */
export interface StateFacts {
  capital: string;
  largest: string;
  /** 2020 census, people. */
  pop: number;
  /** Total area, km². */
  area: number;
  /** Year it joined the Union, and its order. */
  joined: number;
  order: number;
  nick: string;
  bird: string;
  flower: string;
  trivia: string[];
}

const f = (capital: string, largest: string, pop: number, area: number, joined: number, order: number, nick: string, bird: string, flower: string, ...trivia: string[]): StateFacts =>
  ({ capital, largest, pop, area, joined, order, nick, bird, flower, trivia });

export const FACTS: Record<string, StateFacts> = {
  AL: f('Montgomery', 'Huntsville', 5024279, 135767, 1819, 22, 'Yellowhammer State', 'Yellowhammer (gullspett)', 'Kamelia',
    'Huntsville kalles «Rocket City»: Saturn V-raketten som sendte Apollo-astronautene til månen, ble utviklet her.'),
  AK: f('Juneau', 'Anchorage', 733391, 1723337, 1959, 49, 'The Last Frontier', 'Lirype', 'Forglemmegei',
    'USA kjøpte Alaska fra Russland i 1867 for 7,2 millioner dollar.',
    'Hovedstaden Juneau har ingen veiforbindelse til resten av landet; man kommer dit med fly eller båt.'),
  AZ: f('Phoenix', 'Phoenix', 7151502, 295234, 1912, 48, 'Grand Canyon State', 'Cactus wren', 'Saguaro-blomst',
    'Arizona bruker ikke sommertid, med unntak av Navajo Nation.'),
  AR: f('Little Rock', 'Little Rock', 3011524, 137732, 1836, 25, 'The Natural State', 'Northern mockingbird', 'Epleblomst',
    'I Crater of Diamonds State Park kan hvem som helst lete etter diamanter og beholde det de finner.'),
  CA: f('Sacramento', 'Los Angeles', 39538223, 423967, 1850, 31, 'Golden State', 'California quail', 'Kaliforniavalmue',
    'Hadde California vært et eget land, ville økonomien vært blant verdens fem største.',
    'Verdens høyeste kjente tre, kystsequoiaen «Hyperion», står i Redwood National Park.'),
  CO: f('Denver', 'Denver', 5773714, 269601, 1876, 38, 'Centennial State', 'Lark bunting', 'Akeleie (Rocky Mountain columbine)',
    'Denver ligger én mile over havet. Ett av trinnene på kapitoltrappen er merket nøyaktig 5280 fot.'),
  CT: f('Hartford', 'Bridgeport', 3605944, 14357, 1788, 5, 'Constitution State', 'Vandretrost (American robin)', 'Mountain laurel',
    'Verdens første telefonkatalog ble utgitt i New Haven i 1878. Den hadde 50 navn.'),
  DE: f('Dover', 'Wilmington', 989948, 6446, 1787, 1, 'First State', 'Blue Hen (høne)', 'Ferskenblomst',
    'Delaware var den første delstaten som ratifiserte grunnloven, 7. desember 1787.'),
  FL: f('Tallahassee', 'Jacksonville', 21538187, 170312, 1845, 27, 'Sunshine State', 'Northern mockingbird', 'Appelsinblomst',
    'Florida har lengst kystlinje av delstatene på fastlandet.'),
  GA: f('Atlanta', 'Atlanta', 10711908, 153910, 1788, 4, 'Peach State', 'Brown thrasher', 'Cherokee rose',
    'Georgia er kjent som ferskenstaten, men dyrker mer peanøtter enn noen annen delstat.'),
  HI: f('Honolulu', 'Honolulu', 1455271, 28313, 1959, 50, 'Aloha State', 'Nēnē (havaiigås)', 'Gul hibiskus',
    'Hawaii er den eneste delstaten med to offisielle språk: engelsk og hawaiisk.',
    'Vulkanen Kīlauea lager stadig nytt land, så delstaten vokser fortsatt.'),
  ID: f('Boise', 'Boise', 1839106, 216443, 1890, 43, 'Gem State', 'Mountain bluebird', 'Syringa (skjærsmin)',
    'Idaho dyrker omtrent en tredel av alle poteter i USA.'),
  IL: f('Springfield', 'Chicago', 12812508, 149995, 1818, 21, 'Prairie State', 'Kardinal (northern cardinal)', 'Fiol',
    'Verdens første skyskraper, Home Insurance Building, ble reist i Chicago i 1885.'),
  IN: f('Indianapolis', 'Indianapolis', 6785528, 94326, 1816, 19, 'Hoosier State', 'Kardinal (northern cardinal)', 'Peon',
    'Indianapolis 500 har plass til over 250 000 tilskuere, det største endagsarrangementet i sporten.'),
  IA: f('Des Moines', 'Des Moines', 3190369, 145746, 1846, 29, 'Hawkeye State', 'Eastern goldfinch', 'Wild prairie rose',
    'Iowa holder tradisjonelt det første nominasjonsmøtet (caucus) i presidentvalgår.'),
  KS: f('Topeka', 'Wichita', 2937880, 213100, 1861, 34, 'Sunflower State', 'Western meadowlark', 'Solsikke',
    'Midtpunktet for de 48 sammenhengende delstatene ligger nær Lebanon i Kansas.'),
  KY: f('Frankfort', 'Louisville', 4505836, 104656, 1792, 15, 'Bluegrass State', 'Kardinal (northern cardinal)', 'Gullris',
    'Rundt 95 prosent av verdens bourbon lages i Kentucky.'),
  LA: f('Baton Rouge', 'New Orleans', 4657757, 135659, 1812, 18, 'Pelican State', 'Brunpelikan', 'Magnolia',
    'Louisiana er delt inn i «parishes» (sogn), ikke «counties» (fylker) som resten av landet.'),
  ME: f('Augusta', 'Portland', 1362359, 91633, 1820, 23, 'Pine Tree State', 'Black-capped chickadee', 'Furukongle og -dusk',
    'Maine er den eneste delstaten med et navn på én stavelse.',
    'Det meste av hummeren som fiskes i USA, kommer fra Maine.'),
  MD: f('Annapolis', 'Baltimore', 6177224, 32131, 1788, 7, 'Old Line State', 'Baltimore oriole', 'Black-eyed Susan',
    'Nasjonalsangen «The Star-Spangled Banner» ble skrevet under slaget om Fort McHenry i Baltimore i 1814.'),
  MA: f('Boston', 'Boston', 7029917, 27336, 1788, 6, 'Bay State', 'Black-capped chickadee', 'Mayflower',
    'Harvard, USAs eldste universitet, ble grunnlagt i 1636.'),
  MI: f('Lansing', 'Detroit', 10077331, 250487, 1837, 26, 'Great Lakes State', 'Vandretrost (American robin)', 'Epleblomst',
    'Michigan grenser mot fire av de fem store sjøene. Ingen steder i delstaten er mer enn rundt 140 km fra en av dem.'),
  MN: f('Saint Paul', 'Minneapolis', 5706494, 225163, 1858, 32, 'North Star State', 'Islom', 'Marisko',
    'Ingen delstat har flere innbyggere med norske aner enn Minnesota.',
    'Delstaten har over 11 000 innsjøer, selv om bilskiltene sier «10,000 Lakes».'),
  MS: f('Jackson', 'Jackson', 2961279, 125438, 1817, 20, 'Magnolia State', 'Northern mockingbird', 'Magnolia',
    'Elvis Presley ble født i Tupelo, Mississippi, i 1935.'),
  MO: f('Jefferson City', 'Kansas City', 6154913, 180540, 1821, 24, 'Show-Me State', 'Eastern bluebird', 'Hagtorn',
    'Gateway Arch i St. Louis er 192 meter høy, verdens høyeste bue.'),
  MT: f('Helena', 'Billings', 1084225, 380831, 1889, 41, 'Treasure State', 'Western meadowlark', 'Bitterroot',
    'Det er omtrent dobbelt så mange storfe som mennesker i Montana.'),
  NE: f('Lincoln', 'Omaha', 1961504, 200330, 1867, 37, 'Cornhusker State', 'Western meadowlark', 'Gullris',
    'Nebraska er den eneste delstaten med ett kammer i delstatsforsamlingen, og representantene stiller uten partitilhørighet.',
    'Nebraska og Maine er de eneste delstatene som kan dele valgmennene sine i presidentvalg.'),
  NV: f('Carson City', 'Las Vegas', 3104614, 286380, 1864, 36, 'Silver State', 'Mountain bluebird', 'Sagebrush',
    'Over 80 prosent av Nevada eies av den føderale staten.'),
  NH: f('Concord', 'Manchester', 1377529, 24214, 1788, 9, 'Granite State', 'Purple finch', 'Syrin',
    'New Hampshire holder tradisjonelt det første primærvalget i presidentvalgår. Mottoet er «Live Free or Die».'),
  NJ: f('Trenton', 'Newark', 9288994, 22591, 1787, 3, 'Garden State', 'Eastern goldfinch', 'Fiol',
    'New Jersey er den tettest befolkede delstaten i USA.'),
  NM: f('Santa Fe', 'Albuquerque', 2117522, 314917, 1912, 47, 'Land of Enchantment', 'Greater roadrunner', 'Yuccablomst',
    'Verdens første atombombe ble prøvesprengt i ørkenen i New Mexico i juli 1945.',
    'Santa Fe er den eldste delstatshovedstaden i USA, grunnlagt rundt 1610.'),
  NY: f('Albany', 'New York', 20201249, 141297, 1788, 11, 'Empire State', 'Eastern bluebird', 'Rose',
    'Frihetsgudinnen var en gave fra Frankrike og ble innviet i 1886.'),
  NC: f('Raleigh', 'Charlotte', 10439388, 139391, 1789, 12, 'Tar Heel State', 'Kardinal (northern cardinal)', 'Flowering dogwood',
    'Brødrene Wright gjorde verdens første motoriserte flytur ved Kitty Hawk i 1903.'),
  ND: f('Bismarck', 'Fargo', 779094, 183108, 1889, 39, 'Peace Garden State', 'Western meadowlark', 'Wild prairie rose',
    'North Dakota har den høyeste andelen innbyggere med norske aner, omtrent hver tredje.',
    'Norsk Høstfest i Minot er Nord-Amerikas største skandinaviske festival.'),
  OH: f('Columbus', 'Columbus', 11799448, 116098, 1803, 17, 'Buckeye State', 'Kardinal (northern cardinal)', 'Rød nellik',
    'Sju presidenter er født i Ohio. Delstaten kalles «Mother of Presidents».'),
  OK: f('Oklahoma City', 'Oklahoma City', 3959353, 181037, 1907, 46, 'Sooner State', 'Scissor-tailed flycatcher', 'Oklahoma rose',
    '39 føderalt anerkjente urfolksnasjoner har hovedsete i Oklahoma.'),
  OR: f('Salem', 'Portland', 4237256, 254799, 1859, 33, 'Beaver State', 'Western meadowlark', 'Oregon grape',
    'Crater Lake er 594 meter dyp, USAs dypeste innsjø.',
    'Oregon har bare stemmegivning per post.'),
  PA: f('Harrisburg', 'Philadelphia', 13002700, 119280, 1787, 2, 'Keystone State', 'Ruffed grouse', 'Mountain laurel',
    'Både uavhengighetserklæringen og grunnloven ble undertegnet i Philadelphia.'),
  RI: f('Providence', 'Providence', 1097379, 4001, 1790, 13, 'Ocean State', 'Rhode Island Red (høne)', 'Fiol',
    'Rhode Island er den minste delstaten. Den får plass over 400 ganger i Alaska.'),
  SC: f('Columbia', 'Charleston', 5118425, 82933, 1788, 8, 'Palmetto State', 'Carolina wren', 'Yellow jessamine',
    'Borgerkrigen begynte med skuddene mot Fort Sumter i havna i Charleston i april 1861.'),
  SD: f('Pierre', 'Sioux Falls', 886667, 199729, 1889, 40, 'Mount Rushmore State', 'Fasan', 'Kubjelle (pasque flower)',
    'Presidentansiktene på Mount Rushmore er 18 meter høye.'),
  TN: f('Nashville', 'Nashville', 6910840, 109153, 1796, 16, 'Volunteer State', 'Northern mockingbird', 'Iris',
    'Radioprogrammet Grand Ole Opry har sendt countrymusikk fra Nashville hver uke siden 1925.'),
  TX: f('Austin', 'Houston', 29145505, 695662, 1845, 28, 'Lone Star State', 'Northern mockingbird', 'Bluebonnet (lupin)',
    'Texas var en selvstendig republikk fra 1836 til 1845.'),
  UT: f('Salt Lake City', 'Salt Lake City', 3271616, 219882, 1896, 45, 'Beehive State', 'California gull', 'Sego lily',
    'Great Salt Lake er den største saltsjøen på den vestlige halvkule.'),
  VT: f('Montpelier', 'Burlington', 643077, 24906, 1791, 14, 'Green Mountain State', 'Hermit thrush', 'Rødkløver',
    'Vermont lager omtrent halvparten av all lønnesirup i USA.',
    'Montpelier er den minste delstatshovedstaden, og den eneste uten en McDonald’s.'),
  VA: f('Richmond', 'Virginia Beach', 8631393, 110787, 1788, 10, 'Old Dominion', 'Kardinal (northern cardinal)', 'Flowering dogwood',
    'Åtte presidenter er født i Virginia, flere enn i noen annen delstat.'),
  WA: f('Olympia', 'Seattle', 7705281, 184661, 1889, 42, 'Evergreen State', 'Willow goldfinch', 'Rododendron',
    'Washington er den eneste delstaten som er oppkalt etter en president.',
    'Ballard i Seattle ble bygd av skandinaviske innvandrere og har Nordic Museum.'),
  WV: f('Charleston', 'Charleston', 1793716, 62756, 1863, 35, 'Mountain State', 'Kardinal (northern cardinal)', 'Rododendron',
    'West Virginia ble egen delstat da den brøt ut av Virginia under borgerkrigen.'),
  WI: f('Madison', 'Milwaukee', 5893718, 169635, 1848, 30, 'Badger State', 'Vandretrost (American robin)', 'Fiol',
    'Wisconsin lager mer ost enn noen annen delstat.'),
  WY: f('Cheyenne', 'Cheyenne', 576851, 253335, 1890, 44, 'Equality State', 'Western meadowlark', 'Indian paintbrush',
    'Wyoming ga kvinner stemmerett allerede i 1869, som det første territoriet i USA.',
    'Yellowstone, verdens første nasjonalpark, ble opprettet i 1872 og ligger for det meste i Wyoming.'),
};

/** Mainland Norway, km², for "x ganger Norge". */
export const NORWAY_KM2 = 323_800;
