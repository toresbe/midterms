/** Norwegian broadcast copy. Each state has its own adoption history, even
 * when the species is shared. Sources are kept with the text for review.
 * A school or club poll is distinguished from the subsequent official act.
 */
export interface SymbolHistory {
  text: string;
  source: string;
  url: string;
}
const h = (text: string, source: string, url: string): SymbolHistory => ({ text, source, url });

/** Bird first, flower second, matching nature.json. */
export const SYMBOL_HISTORY: Record<string, [SymbolHistory, SymbolHistory]> = {
  AL: [
    h('Gullspetten ble offisiell delstatsfugl ved lov i 1927. Navnet «yellowhammer» var allerede knyttet til Alabama: Under borgerkrigen fikk soldater fra delstaten dette tilnavnet på grunn av gule detaljer i uniformene. Vedtaket videreførte dermed et eldre symbol.', 'Alabama Archives', 'https://alabamamosaic.org/vufind/Record/ADAHphoto24341/Details'),
    h('Delstatsforsamlingen valgte kamelia i 1959 og erstattet gullriset fra 1927. Dyrkere i Butler County hadde arbeidet for byttet og mente gullriset var et ugress. I 1999 ble loven presisert til japansk kamelia, Camellia japonica.', 'Smithsonian', 'https://www.si.edu/object/metal-sculpture-alabama-state-flower-camillia%3Ahac_1980.038.033'),
  ],
  AK: [
    h('Skolebarn valgte lirypa som Alaskas fuglesymbol i 1955, mens territoriet forberedte seg på å bli delstat. Den er en velkjent fugl i det nordlige landskapet. Valget kom fire år før Alaska ble USAs 49. delstat.', 'Alaska Fish & Game', 'https://www.adfg.alaska.gov/index.cfm?adfg=birdviewing.iconicbirds&species=willowptarmigan'),
    h('Territorieforsamlingen vedtok forglemmegei som blomsteremblem i 1917, etter ønske fra organisasjonen Pioneers of Alaska. Lovteksten fremhevet blomsten som et bilde på trofasthet og pionerenes utholdenhet. Navnet skulle også minne om at Alaska var kommet for å bli.', 'Alaskas lov fra 1917', 'https://www.akleg.gov/pdf/billfiles/SLAs/SLA%201917/CH%209%20SLA%201917.pdf'),
  ],
  AZ: [
    h('Delstatsforsamlingen gjorde cactus wren til offisiell fugl i 1931. Den lever blant kaktusene i sørvest og knytter fuglesymbolet til Arizonas ørkenlandskap. Den er USAs største gjerdesmett, med et kraftig nebb og et karakteristisk flekkete bryst.', 'Arizona State Library', 'https://azmemory.azlibrary.gov/nodes/view/129233'),
    h('Saguaroens hvite blomst ble Arizonas offisielle delstatsblomst i 1931, etter å ha vært territoriets blomstersymbol fra 1901. Den vokser på den store kaktusen som preger Sonoraørkenen. Slik fikk delstaten et blomsteremblem nært knyttet til sitt særegne landskap.', 'Arizona Governor', 'https://azgovernor.gov/governor/arizona-facts'),
  ],
  AR: [
    h('Kvinneforeningene drev kampanjen som førte til at delstatsforsamlingen valgte sangspottefuglen i 1929. Forslaget ble først møtt med latter. Taler om fuglens nytte for bøndene bidro til gjennomslaget: Den spiser insekter som ellers kan skade avlingene.', 'Encyclopedia of Arkansas', 'https://encyclopediaofarkansas.net/entries/Official-State-Bird-3137/'),
    h('Epleblomsten ble vedtatt av delstatsforsamlingen i 1901, etter en kampanje der Love Barton fra Searcy var en pådriver. Arkansas var da en stor epleprodusent, kjent som «The Land of the Big Red Apple». Blomsten representerte en viktig næring.', 'Encyclopedia of Arkansas', 'https://encyclopediaofarkansas.net/entries/Official-State-Flower-3145/'),
  ],
  CA: [
    h('California-vaktelen ble offisiell delstatsfugl gjennom et lovvedtak i 1931. Den er kjent for fjærtoppen og for å leve i flokker i kratt og eikeskog. Delstatens museum fremhever artens hardførhet og evne til å tilpasse seg ulike leveområder.', 'California Capitol Museum', 'https://capitolmuseum.ca.gov/state-symbols/bird-california-valley-quail/'),
    h('Kaliforniavalmuen ble valgt av delstatsforsamlingen i 1903. Den vokser vilt over store deler av California og farger åser og daler oransje om våren. Blomsten er dermed et lett gjenkjennelig bilde på delstatens natur; 6. april er egen valmuedag.', 'California Capitol Museum', 'https://capitolmuseum.ca.gov/state-symbols/flower-california-golden-poppy/'),
  ],
  CO: [
    h('Læreren Roy Langdon kjempet for lark bunting fordi prærien og jordbruket også burde få et delstatssymbol. Han fikk støtte fra skolebarn, og forsamlingen vedtok fuglen i 1931. En fordel var at ingen annen delstat allerede hadde valgt den.', 'Denver Public Library', 'https://history.denverlibrary.org/news/western-history/how-lark-bunting-became-colorados-state-bird'),
    h('Skolebarn var med på å velge den blå og hvite akeleien, som fikk offisiell status i 1899. Den knytter blomstersymbolet til Rocky Mountains. Senere fikk planten særskilt vern, slik at delstatsblomsten også ble et symbol på å ta vare på fjellnaturen.', 'Colorado State Library', 'https://spl.cde.state.co.us/artemis/govserials/gov2512internet/gov25121949internet.pdf'),
  ],
  CT: [
    h('Delstatsforsamlingen vedtok vandretrosten som offisiell fugl i 1943. Den var allerede en velkjent hagefugl med rødbrunt bryst og en livlig sang. Nybyggerne kalte den «robin» etter den europeiske rødstrupen, selv om den amerikanske fuglen er en trost.', 'Connecticut Secretary of State', 'https://portal.ct.gov/about/state-symbols/the-state-bird'),
    h('Mountain laurel ble vedtatt som delstatsblomst i 1907. Den stedegne buskens store mengder rosa og hvite blomster hadde lenge gjort inntrykk på besøkende i skogene. Det latinske navnet Kalmia hedrer naturforskeren Pehr Kalm, som sendte prøver til Linné.', 'Connecticut Blue Book', 'https://portal.ct.gov/-/media/sots/2023-bluebook.pdf?hash=DC6D183794180DC6F617F9FDA5989016&rev=218c8707c4eb4ba8bca201c8aec637e9'),
  ],
  DE: [
    h('Blue Hen ble vedtatt som delstatsfugl i 1939. Symbolet viser tilbake til revolusjonskrigen, da soldater fra Delaware tok med kamphaner fra en berømt høne. Soldatenes tapperhet ble sammenlignet med hanenes, og navnet levde videre i delstatens identitet.', 'Delaware State Government', 'https://delaware.gov/guides/facts/'),
    h('Delstatsforsamlingen vedtok ferskenblomsten i 1895 fordi Delaware var kjent som «Peach State». Frukthagene rommet over 800 000 ferskentrær. Da blomstersymbolet senere ble utelatt fra lovsamlingen, bekreftet en ny lov i 1955 det opprinnelige valget.', 'Delaware General Assembly', 'https://legis.delaware.gov/SessionLaws/Chapter?id=31756'),
  ],
  FL: [
    h('Sangspottefuglen ble valgt gjennom en felles resolusjon i delstatsforsamlingen i 1927. Den er en helårsbeboer i Florida, kjent for sangen og evnen til å etterligne andre fugler. Delstatens omtale fremhever også nytten av at den spiser insekter og ugressfrø.', 'Florida Department of State', 'https://dos.fl.gov/florida-facts/florida-state-symbols/state-bird'),
    h('Appelsinblomsten vant frem i delstatsforsamlingen i 1909, selv om både kamelia og gardenia hadde tilhengere. Duften og den brede populariteten talte for valget. Blomsten viste også til den lange historien med appelsindyrking, en viktig del av Floridas identitet.', 'Florida Historical Society', 'https://myfloridahistory.org/date-in-history/april-27-1909/orange-blossom-approved-state-flower'),
  ],
  GA: [
    h('Guvernøren utropte brown thrasher til delstatsfugl i 1935. Senere slo delstatens juridiske rådgiver fast at slike symboler måtte vedtas av forsamlingen. Etter påtrykk fra hageforeningene fikk den velkjente sangfuglen derfor et eget lovgivende vedtak i 1970.', 'University System of Georgia', 'https://about.galileo.usg.edu/news/article/this_day_in_georgia_history_april_6_1935'),
    h('Cherokee-rosen ble vedtatt som blomsteremblem i 1916 etter støtte fra Georgias kvinneforeninger. Navnet ble knyttet til cherokee-folket, som spredte planten. Den hardføre rosen med hvite kronblader og gyllent sentrum var allerede godt etablert i delstatens hager.', 'Georgia Secretary of State', 'https://dlg.usg.edu/record/dlg_ggpd_s-ga-bs700-b-pm1-b2003-bs9'),
  ],
  HI: [
    h('Nēnē fikk status som delstatsfugl i 1959, da Hawaii ble delstat. Gåsa finnes naturlig bare på Hawaii og var nær utryddelse. Naturvernfolk ønsket betegnelsen for å skaffe oppmerksomhet og føderale midler til arbeidet med å redde arten.', 'Hawaii Forestry & Wildlife', 'https://dlnr.hawaii.gov/dofaw/files/2020/05/A-Teachers-Guide-to-Nene.pdf'),
    h('Territorieforsamlingen valgte hibiskus i 1923 uten å angi art eller farge. I 1988 anbefalte naturforvaltningen den stedegne gule Hibiscus brackenridgei, og forsamlingen fulgte rådet. Presiseringen skulle gi Hawaii et tydelig blomstersymbol fra øyenes egen flora.', 'Office of Hawaiian Affairs', 'https://kwo.oha.org/wp-content/uploads/2017/10/KA_WAI_OLA_198902.pdf'),
  ],
  ID: [
    h('Delstatsforsamlingen valgte mountain bluebird i 1931. Den blå trosten lever i åpne gressland og hekker i hulrom, blant annet i trær og fuglekasser. Valget ga Idaho en fugl knyttet til de åpne landskapene mellom skogene og fjellene.', 'Idaho Secretary of State', 'https://sos.idaho.gov/state-symbols/'),
    h('Syringa fikk offisiell status ved lov i 1931, men var valgt som symbol allerede under arbeidet med delstatsseglet rundt 1890. Den hvite, duftende skjærsminen er stedegen. Artsnavnet lewisii hedrer Meriwether Lewis, som omtalte planten under Lewis og Clark-ekspedisjonen.', 'Idaho Historical Society', 'https://history.idaho.gov/wp-content/uploads/2018/08/0060.pdf'),
  ],
  IL: [
    h('Skolebarna valgte kardinalen foran blåfugl, meadowlark, vaktel og oriole. Kardinalen fikk 39 226 stemmer, og valget ble offisielt i 1929. Den røde fjærdrakten og den tydelige sangen gjør denne helårsfuglen lett å kjenne igjen.', 'Illinois State Museum', 'https://museum.state.il.us/exhibits/symbols/bird.html'),
    h('Etter forslag fra en innbygger i Rochelle fikk skolebarna stemme på delstatsblomst i 1907. Fiolen vant med 16 583 stemmer foran villrose og gullris. Senator Andrew Jackson fremmet loven som gjorde den velkjente, stedegne vårblomsten offisiell i 1908.', 'Illinois State Museum', 'https://www.museum.state.il.us/exhibits/symbols/flower.html'),
  ],
  IN: [
    h('Kardinalen ble vedtatt som delstatsfugl av Indianas delstatsforsamling i 1933. Den røde sangfuglen er også valgt av flere nabodelstater. Vedtaket ga Indiana et felles fuglesymbol, men den historiske oversikten oppgir ingen egen folkeavstemning eller detaljert begrunnelse.', 'Indiana Historical Bureau', 'https://www.in.gov/history/files/introindiana.pdf'),
    h('Delstatsforsamlingen byttet fra zinnia til peon i 1957. Indiana hadde tidligere også hatt nellik og tulipantreets blomst som symboler. Peonen dyrkes mye i delstaten og brukes særlig til å pynte graver ved Memorial Day; loven angir ingen bestemt farge.', 'Indiana Historical Bureau', 'https://www.in.gov/history/about-indiana-history-and-trivia/emblems-and-symbols/indiana-state-tree-and-flower/'),
  ],
  IA: [
    h('Delstatsforsamlingen valgte amerikansk stillits i 1933. Den offisielle begrunnelsen fremhever at fuglen er vanlig i Iowa og ofte blir gjennom vinteren. Dermed representerer den delstaten gjennom mer enn bare sommeren, selv om vinterdrakten er langt mindre gul.', 'Iowa Official Register', 'https://www.legis.iowa.gov/docs/publications/REDBK/1039565.pdf'),
    h('Villrosen ble vedtatt i 1897 fordi den prydet sølvserviset Iowa ga til slagskipet USS Iowa samme år. Rosen vokser over hele delstaten. Forsamlingen valgte ingen bestemt art, selv om prærie-rosen vanligvis brukes som bilde på delstatsblomsten.', 'Iowa Official Register', 'https://www.legis.iowa.gov/docs/publications/REDBK/1039565.pdf'),
  ],
  KS: [
    h('Skolebarn valgte western meadowlark i en avstemning arrangert av Audubon-foreningen i 1925. Over 120 000 stemmer ble avgitt. Delstatsforsamlingen fulgte opp i 1937: Den vanlige præriefuglen, kjent for sangen og for å spise skadeinsekter, passet til jordbruksstaten.', 'Kansas Secretary of State', 'https://sos.ks.gov/publications/register/1984/Vol_3_No_33_August_16_1984_p_1005-1028.pdf'),
    h('Delstatsforsamlingen vedtok den ville solsikken i 1903. Begrunnelsen fremhevet en hardfør, iøynefallende blomst som var lett å tegne, brodere eller hugge i stein. Den viste dessuten til prærien og pionertiden og videreførte det allerede kjente navnet «Sunflower State».', 'Kansas Secretary of State', 'https://sos.ks.gov/publications/register/1984/Vol_3_No_33_August_16_1984_p_1005-1028.pdf'),
  ],
  KY: [
    h('Kardinalen ble Kentuckys offisielle delstatsfugl gjennom en resolusjon godkjent 17. februar 1926. Det var før de fleste andre delstater valgte fuglesymboler. Den historiske resolusjonsomtalen dokumenterer vedtaket, men gir ingen nærmere begrunnelse eller resultat fra en offentlig avstemning.', 'Kentucky Historical Society', 'https://apps.legislature.ky.gov/LegislativeMoments/moments05RS/22_web_leg_moments.htm'),
    h('Kentucky vedtok gullriset som delstatsblomst i 1926. Valget løftet frem en stedegen plante, og betegnelsen er fortsatt skrevet inn i delstatens lover. Loven sier bare «goldenrod» og binder dermed ikke blomstersymbolet til én bestemt gullrisart.', 'Kentucky Native Plant Society', 'https://www.knps.org/wp-content/uploads/2019/01/V22N3-2007-Fall.pdf'),
  ],
  LA: [
    h('Loven fra 1966 presiserte at delstatsfuglen skulle være brunpelikanen, slik den var fremstilt på delstatsseglet. Pelikanen var altså allerede et etablert symbol. Vedtaket knyttet den offisielle fuglen til både Louisianas kystnatur og delstatens offentlige kjennetegn.', 'Louisiana Legislature', 'https://www.legis.la.gov/legis/Law.aspx?d=103552'),
    h('Magnoliaens store, kremhvite blomst ble vedtatt som delstatsblomst i 1900. Delstatens egen omtale forklarer valget med at magnoliatrær var så utbredt i Louisiana. Den duftende blomsten ga dermed delstaten et symbol hentet fra den velkjente naturen rundt innbyggerne.', 'Louisiana Secretary of State', 'https://www.sos.la.gov/HistoricalResources/Archive/LouisianaColoringBook.pdf'),
  ],
  ME: [
    h('Maines delstatsforsamling vedtok chickadee som delstatsfugl i 1927. Den offisielle presentasjonen viser den svartkappede arten, men selve lovteksten sier bare «chickadee». Vedtaket angir ingen nærmere begrunnelse eller folkeavstemning; artsnavnet i loven er derfor mindre presist enn bildet.', 'Maine Legislature', 'https://www.maine.gov/legis/general/state/tree.htm'),
    h('Innbyggerne valgte kongle og nåledusk fra østamerikansk furu foran gullris og epleblomst til verdensutstillingen i 1893. Forsamlingen gjorde valget offisielt i 1895. Furua hadde stor økonomisk og kulturell betydning for Maine. Symbolet er botanisk sett ingen blomst.', 'Maine Secretary of State', 'https://www.maine.gov/sos/maineatlas/explore-the-atlas/pine-cone-pine-tassel'),
  ],
  MD: [
    h('Baltimore-oriolen ble offisiell delstatsfugl ved lov i 1947. Hannens svarte og gylne fjærdrakt minner om fargene i Calvert-familiens våpen, som også inngår i flagget. Fuglen hadde lenge vært knyttet til Maryland og hadde fått særskilt vern allerede i 1882.', 'Maryland State Archives', 'https://www.msa.maryland.gov/msa/mdmanual/01glance/html/symbols/bird.html'),
    h('Delstatsforsamlingen vedtok black-eyed Susan som Marylands blomsteremblem i 1918. Loven ba guvernøren kunngjøre valget ved proklamasjon. Den gule blomsten med mørkt sentrum er vanlig i enger og langs veier og gir symbolet en tydelig forbindelse til delstatens sommerlandskap.', 'Maryland State Archives', 'https://msa.maryland.gov/msa/mdmanual/01glance/html/symbols/flower.html'),
  ],
  MA: [
    h('Massachusetts vedtok den svartkappede chickadee som delstatsfugl 21. mars 1941. Delstatens omtale fremhever den som en av Nord-Amerikas mest kjente småfugler, med en livlig fremtoning og det lett gjenkjennelige «chick-a-dee»-ropet. Vedtaket ble gjort av delstatsforsamlingen.', 'Massachusetts Secretary', 'https://www.sec.state.ma.us/divisions/cis/ciskid/kid-facts/concise-facts2.htm'),
    h('I 1918 fikk skolebarna stemme på delstatsblomst. Mayflower slo vannliljen med omtrent dobbelt så mange stemmer og ble offisiell samme år. Den lave skogplanten med duftende vårblomster fikk dermed betegnelsen gjennom en avstemning blant barna.', 'Smithsonian', 'https://gardens.si.edu/collections/explore/object/hac_1980.038.012'),
  ],
  MI: [
    h('Vandretrosten ble valgt som delstatsfugl i 1931 etter støtte fra Michigan Audubon Society. Forslagsstillerne omtalte den som delstatens best kjente og best likte fugl. Populariteten hos innbyggerne var altså en uttrykkelig del av begrunnelsen for valget.', 'Michigan State Government', 'https://www.michigan.gov/en/About-Michigan/State-Facts-and-Symbols'),
    h('Michigan vedtok epleblomsten i 1897. Den offisielle omtalen fremhever den stedegne arten sweet crabapple, Malus coronaria. Symbolet knytter sammen vårblomstringen og epletrærne som lenge har preget delstatens landskap og fruktdyrking.', 'Michigan State Government', 'https://www.michigan.gov/en/About-Michigan/State-Facts-and-Symbols'),
  ],
  MN: [
    h('Etter flere mislykkede forslag om andre fugler vedtok forsamlingen islommen i 1961. Senator Norman Walz og representant Loren Rutter fremmet loven. Lommen er tett knyttet til innsjøene i nord, og ropet har blitt en velkjent lyd fra Minnesotas villmark.', 'Minnesota Legislative Library', 'https://www.lrl.mn.gov/leg/Symbols'),
    h('Et tidlig vedtak i 1893 navnga ved en feil en marisko som ikke vokste i Minnesota. Kvinner i St. Anthony Study Circle påpekte feilen, og i 1902 valgte begge kamre den stedegne rosa og hvite praktskoen. Valget ble lovfestet i 1967.', 'Minnesota Legislative Library', 'https://www.lrl.mn.gov/leg/Symbols'),
  ],
  MS: [
    h('Mississippis kvinneforeninger drev kampanjen for sangspottefuglen, og delstatsforsamlingen gjorde valget offisielt i 1944. Den finnes i alle deler av Mississippi. Den velkjente sangeren ble dermed et felles symbol for innbyggere både på landsbygda og i byene.', 'Mississippi State University', 'https://www.newsarchive.msstate.edu/state-spotlight/2008/03/drill-field-mockingbird'),
    h('I november 1900 stemte skolebarn på delstatsblomst. Magnolia vant med 12 745 av 23 278 stemmer, foran blant annet bomullsblomst og gardenia. Først i 1952 gjorde forsamlingen valget offisielt. Blomsten hadde da vært folkets foretrukne emblem i over femti år.', 'Mississippi Blue Book', 'https://www.sos.ms.gov/content/documents/ed_pubs/pubs/BlueBook20-24/1%20General%20Info%20Section.pdf'),
  ],
  MO: [
    h('Delstatsforsamlingen vedtok blåfuglen i 1927 fordi den var vanlig i Missouri og ble regnet som et symbol på lykke. Fuglen passer til det bølgende kulturlandskapet. Den røde, hvite og blå fjærdrakten ga dessuten en forbindelse til USAs nasjonalfarger.', 'Missouri Conservation', 'https://mdc.mo.gov/wildlife/wildlife-facts/bird-facts/bluebird-facts'),
    h('Guvernør Arthur Hyde signerte loven om hagtornblomsten i 1923. Loven fremhever skjønnheten i blomster, frukt og løvverk og oppfordrer til dyrking. Vedtaket angir hele slekten Crataegus, slik at flere av Missouris stedegne hagtornarter omfattes av blomstersymbolet.', 'Missouri Secretary of State', 'https://www.sos.mo.gov/symbol/floral'),
  ],
  MT: [
    h('I 1930 fikk skolebarn svare på hvilken fugl som best representerte Montana. Western meadowlark vant klart, og delstatsforsamlingen fulgte opp i 1931. Barnas valg ga delstaten et fuglesymbol fra de åpne gresslandskapene, kjent for sin tydelige sang.', 'Montana Historical Society', 'https://prod-mhs.mt.gov/Research/Compass/Facts'),
    h('Bitterroot ble offisielt blomstersymbol ved et vedtak i 1895. Mary Long Alderson var den viktigste pådriveren for valget. Den stedegne planten ga Montana et emblem fra egen flora, og navnet lever også videre i Bitterroot-dalen og fjellkjeden med samme navn.', 'Montana Historical Society', 'https://prod-mhs.mt.gov/Research/Compass/Facts'),
  ],
  NE: [
    h('Delstatsforsamlingen vedtok western meadowlark i 1929. Nebraskas offisielle omtale fremhever at den er vanlig over hele delstaten og kjent for sin glade sang. Den hekker på bakken i gressland og knytter fuglesymbolet til prærien og det åpne jordbrukslandskapet.', 'Nebraska Secretary of State', 'https://sos.nebraska.gov/state-symbols'),
    h('Representanten L. P. Judd fremmet gullriset, og valget ble lov i 1895. Botaniker Charles Bessey støttet forslaget. Tilhengerne fremhevet at planten var stedegen, utbredt og hardfør, som pionerene selv. I debatten vant gullriset over et forslag om fiol.', 'Nebraska Historical Society', 'https://history.nebraska.gov/nebraskas-gold-the-goldenrod/'),
  ],
  NV: [
    h('Mountain bluebird fikk offisiell status gjennom delstatsforsamlingens vedtak i 1967. Den blå fuglen er et velkjent innslag i Nevadas åpne høylandsområder. Det formelle vedtaket fastsetter fuglesymbolet, men oppgir ingen egen folkeavstemning eller detaljert begrunnelse for valget.', 'Nevada Political History', 'https://www.epubs.nsla.nv.gov/statepubs/epubs/613636-2018.pdf'),
    h('Sagebrush hadde vært brukt som emblem siden 1917 og fikk lovfestet status i 1959. Busken preger store deler av Great Basin og finnes også på flagget. Den viderefører derfor en eldre identitet: Nevada var lenge kjent som «Sagebrush State».', 'Nevada Political History', 'https://www.epubs.nsla.nv.gov/statepubs/epubs/613636-2018.pdf'),
  ],
  NH: [
    h('Purpurfinken ble vedtatt som New Hampshires offisielle delstatsfugl i 1957. Valget ble gjort av delstatsforsamlingen og skrevet inn i loven om delstatssymboler. Den korte lovteksten fastsetter arten, men gir ingen nærmere begrunnelse eller resultat fra en folkeavstemning.', 'New Hampshire Legislature', 'https://www.gc.nh.gov/rsa/html/I/3/3-10.htm'),
    h('Etter diskusjoner om flere kandidater valgte delstatsforsamlingen lilla syrin i 1919. Begrunnelsen var at den symboliserte den hardføre karakteren til menn og kvinner i «Granite State». En populær hagebusk fikk dermed representere både naturen og innbyggernes selvbilde.', 'University of New Hampshire', 'https://extension.unh.edu/blog/2018/05/purple-wonders'),
  ],
  NJ: [
    h('Senator Dryden Kuser foreslo stillitsen for dens glade utseende og vakre sang. Forslaget falt først, men ble enstemmig vedtatt ved ny behandling i 1935. Guvernøren signerte i juni, og den gule fuglen fikk offisiell status etter en uvanlig omkamp.', 'New Jersey State Library', 'https://libguides.njstatelib.org/nj-symbols/bird'),
    h('Fiolen ble valgt ved en resolusjon i 1913, men statusen ble juridisk uklar da sesjonen var over. Hageforeningene presset på for en varig lov. Loven fra sesjonen 1971 ble signert i februar 1972 og presiserte arten til vanlig engfiol.', 'New Jersey State Library', 'https://libguides.njstatelib.org/nj-symbols/flower'),
  ],
  NM: [
    h('Delstatsforsamlingen vedtok roadrunner som offisiell fugl i 1949. Den er tett knyttet til innbyggernes fortellinger: Nybyggere fortalte at den kunne vise bortkomne tilbake til stien, og flere urfolkstradisjoner tillegger den særlige krefter. Fuglen var allerede et velkjent lokalt symbol.', 'New Mexico Secretary of State', 'https://www.sos.nm.gov/about-new-mexico/state-bird/'),
    h('Skoleelever valgte yucca i en undersøkelse, og kvinneforeningene støttet resultatet. Delstatsforsamlingen vedtok blomsten i 1927. Den hardføre ørkenplanten ble et symbol på styrke og skjønnhet. Vedtaket omfatter yuccablomster generelt, selv om bildet viser én bestemt art.', 'New Mexico Secretary of State', 'https://www.sos.nm.gov/about-new-mexico/state-flower/'),
  ],
  NY: [
    h('Blåfuglen ble offisiell ved lov signert av guvernør Nelson Rockefeller i 1970. Den forbindes med enger, frukthager og åpent skogland. Etter lave bestandstall på 1950-tallet har fuglekasser bidratt til tilbakekomsten til denne tradisjonelle fuglen i New Yorks kulturlandskap.', 'New York State Library', 'https://nysl.nysed.gov/reference/emblems'),
    h('Rosen toppet en avstemning blant skolebarn i 1891, men ble først offisiell delstatsblomst ved lov i 1955. Forsamlingen valgte alle vanlige farger og fargekombinasjoner. Både ville og dyrkede roser omfattes, slik at symbolet rommer mer enn én hagerose.', 'New York State Library', 'https://nysl.nysed.gov/reference/emblems'),
  ],
  NC: [
    h('North Carolina Bird Club arrangerte en kampanje med skoler, foreninger og aviser. Over 23 000 stemmer ble avgitt på 26 fuglearter. Kardinalen vant, og forsamlingen gjorde valget offisielt i 1943. Lovens begrunnelse viste uttrykkelig til at den hadde fått flest stemmer.', 'NCpedia / State Library', 'https://www.ncpedia.org/symbols/bird'),
    h('Delstatsforsamlingen vedtok blomsten fra flowering dogwood som symbol i 1941. Treet vokser i skogene over store deler av North Carolina og setter et tydelig preg på våren. De fire hvite «kronbladene» er egentlig høyblad rundt en liten blomstersamling.', 'North Carolina State Controller', 'https://www.ncosc.gov/sites/default/files/2024-10/2019_Comprehensive_Annual_Financial_Report_bookmarks.pdf'),
  ],
  ND: [
    h('Western meadowlark ble vedtatt som North Dakotas delstatsfugl i 1947. Den samme arten representerer flere andre præriestater. Den kjente sangfuglen knytter delstatssymbolet til det åpne gresslandet; loven fastsetter arten, uten å gi en nærmere begrunnelse for valget.', 'North Dakota Studies', 'https://www.ndstudies.gov/curriculum/teacher-resources/state-symbols'),
    h('Delstatsforsamlingen vedtok vill prærie-rose i 1907. Blomsten vokser langs veier og i beitemarker over hele North Dakota. Fargene hadde allerede symbolverdi: Universitetets første avgangskull valgte rosa og grønt i 1889 som bilder på grønne prærier og lyse fremtidsutsikter.', 'North Dakota Studies', 'https://www.ndstudies.gov/gr4/citizenship/part-5-symbols/section-10-wild-prairie-rose'),
  ],
  OH: [
    h('Ohio vedtok kardinalen som delstatsfugl i 1933. Delstatens egen undervisningsbok forklarer valget med den vakre sangen og den sterke fargen. Fuglen blir i Ohio hele året, og særlig hannens røde fjærdrakt gjør den lett å kjenne igjen.', 'Ohio Department of Transportation', 'https://dam.assets.ohio.gov/image/upload/transportation.ohio.gov/events/fair/Activity-Book.pdf'),
    h('Delstatsforsamlingen valgte den røde nelliken i 1904 til minne om president William McKinley, som kom fra Ohio. Han bar gjerne blomsten i knapphullet og regnet den som en lykkebringer. Valget kom få år etter at han ble drept i 1901.', 'Ohio History Connection', 'https://ohiomemory.ohiohistory.org/archives/3941'),
  ],
  OK: [
    h('Audubon-foreningen, hageklubber og naturvenner fikk gjennomslag for saksehalefluesnapperen i 1951. Begrunnelsen var at den spiser skadeinsekter, har Oklahoma sentralt i hekkeområdet og ikke var valgt av noen annen delstat. Den slo blant annet vaktelen som tidligere hadde vunnet en konkurranse.', 'Oklahoma Historical Society', 'https://www.okhistory.org/publications/enc/entry.php?entry=SC007'),
    h('Dottie Weissenberger arbeidet i over tretti år for å gjøre rosen «Oklahoma» til delstatsblomst. Forsamlingen vedtok den i 2004. Den mørkerøde, duftende hagerosen var utviklet i 1964. Misteltein og Indian blanket beholdt sine egne titler som blomsteremblem og villblomst.', 'Oklahoma Historical Society', 'https://www.okhistory.org/learn/symbols'),
  ],
  OR: [
    h('Skolebarn valgte western meadowlark i en konkurranse arrangert av Oregon Audubon Society i 1927. Guvernøren kunngjorde valget i juli. Den fløytende sangen gjorde den til et velkjent symbol; i 2017 presiserte forsamlingen tittelen til delstatens sangfugl.', 'Oregon Secretary of State', 'https://sos.oregon.gov/blue-book/explore/pages/almanac-a-c.aspx'),
    h('Oregon Horticultural Society nominerte mahonia som delstatsblomst i 1892, foran flere andre stedegne planter. Forsamlingen gjorde valget offisielt i 1899. Den eviggrønne busken med gule blomster er kjent som «Oregon grape» og knytter symbolet til regionens egen flora.', 'Oregon Historical Society', 'https://www.oregonencyclopedia.org/articles/oregon_state_symbols/'),
  ],
  PA: [
    h('Kragejerpa ble vedtatt som Pennsylvanias delstatsfugl i 1931. Den er knyttet til skog og tett ungskog, og har lenge vært verdsatt av både jegere og andre naturinteresserte. Symbolet viser dermed til en velkjent del av delstatens skoglandskap.', 'Pennsylvania Game Commission', 'https://www.pa.gov/agencies/pgc/wildlife/discover-pa-wildlife/ruffed-grouse'),
    h('Mountain laurel ble offisiell delstatsblomst i 1933, da guvernør Gifford Pinchot godkjente valget. Den hadde støtte i begge kamre i delstatsforsamlingen. Busken er et vanlig syn i Pennsylvania, der de rosa og hvite blomstene setter farge på skogene om sommeren.', 'Pennsylvania Governor', 'https://www.pa.gov/governor/kids-corner'),
  ],
  RI: [
    h('I 1954 arrangerte Audubon-foreningen, hageklubbene og Providence Journal et fuglevalg. Rhode Island Red slo fiskeørn og rubinstrupekolibri. Guvernøren signerte loven samme år og fremhevet hønserasen som et symbol på Rhode Island som allerede var kjent over hele verden.', 'Rhode Island State Government', 'https://www.ri.gov/facts/factsfigures.php'),
    h('Skolebarn valgte fiolen i 1897, og resultatet ble kunngjort på Arbor Day. Det tok likevel til 1968 før forsamlingen gjorde valget formelt. Rhode Island ble dermed den siste delstaten som fikk en offisiell delstatsblomst, lenge etter at barna hadde bestemt seg.', 'Rhode Island State Government', 'https://www.ri.gov/facts/factsfigures.php'),
  ],
  SC: [
    h('Carolina wren ble offisiell delstatsfugl gjennom lovvedtak i 1948. Den finnes i alle deler av South Carolina, fra fjellene til kysten. Fuglen ga dermed delstaten et felles naturkjennetegn på tvers av landskapene, med en kraftig sang til tross for liten størrelse.', 'South Carolina Legislature', 'https://www.scstatehouse.gov/studentpage/coolstuff/animals.shtml'),
    h('En komité anbefalte gul sjasmin, og forsamlingen vedtok den i 1924. Begrunnelsen var at planten vokste over hele delstaten, duftet og varslet våren. At den kom tilbake etter vinteren, ble dessuten tolket som et bilde på trofasthet og tjeneste for delstaten.', 'South Carolina Senate Journal', 'https://www.scstatehouse.gov/studentpage/coolstuff/EarlySymbolsActs/H%26SAdoptFlower1924.pdf'),
  ],
  SD: [
    h('Representant Paul Kretschmar foreslo fasanen fordi den var hardfør, god mat og viktig for jaktinntektene. Forsamlingen vedtok den i 1943. Arten var innført fra Asia, men hadde blitt så tallrik at den allerede ga South Dakota oppmerksomhet over hele landet.', 'South Dakota Game, Fish & Parks', 'https://gfp.sd.gov/userdocs/docs/Pheasant_Data_Book.pdf'),
    h('Delstatsforsamlingen vedtok præriekubjellen i 1903, sammen med mottoet «I lead» – «Jeg går foran». Den blomstrer tidlig og er et av vårens første tegn på prærien. South Dakota fikk dermed både et blomsteremblem og et motto som viser til vårens frembrudd.', 'South Dakota Blue Book', 'https://sdsos.gov/general-information/assets/bluebook-docs/2021BlueBook.pdf'),
  ],
  TN: [
    h('Tennessee Ornithological Society valgte sangspottefuglen i april 1933. Delstatsforsamlingen bekreftet valget gjennom en resolusjon samme år. Den kjente sangeren har både en egen melodisk sang og evnen til å etterligne andre fugler, egenskaper som gjør den særlig lett å legge merke til.', 'Tennessee Legislative Manual', 'https://www.capitol.tn.gov/Archives/House/104GA/Publications/104th%20Legislative%20Manual.pdf'),
    h('Irisen fikk en egen lovfestet tittel som delstatens dyrkede blomst i 1973. Dermed kunne den eksistere ved siden av Tennessees villblomstersymboler. Loven angir ingen farge, selv om lilla iris vanligvis brukes som bilde på den offisielle hageblomsten.', 'Tennessee Legislative Manual', 'https://www.capitol.tn.gov/Archives/House/104GA/Publications/104th%20Legislative%20Manual.pdf'),
  ],
  TX: [
    h('Delstatsforsamlingen vedtok sangspottefuglen gjennom en felles resolusjon i 1927. Den er kjent for å etterligne andre fuglers sang og er et velkjent innslag i Texas. Resolusjonen ga dermed en vanlig sangfugl status som offisielt symbol for hele delstaten.', 'Texas State Library', 'https://www.tsl.texas.gov/ref/abouttx/symbols'),
    h('Bluebonnet vant frem i delstatsforsamlingen i 1901, etter debatt om blant annet bomull som alternativ. Det første vedtaket gjaldt én lupinart. I 1971 ble det utvidet til Texas-bluebonnet og alle andre bluebonnet-varianter, slik at flere av vårens blå blomsterenger ble omfattet.', 'Texas Legislative Library', 'https://lrl.texas.gov/whatsNew/client/index.cfm/2024/6/12/Bluebonnets-and-the-Texas-Legislature-Exhibit'),
  ],
  UT: [
    h('Utahs delstatsforsamling valgte måka i 1955. Den forbindes med fortellingen om måkene som spiste insekter i nybyggernes åkrer i 1848. Minnet om hjelpen lå bak valget. Loven sier bare «sea gull», selv om symbolet vanligvis fremstilles som kaliforniamåke.', 'Utah State Library', 'https://onlinelibrary.utah.gov/state-symbol/bird/'),
    h('Segoliljen ble vedtatt som blomsteremblem i 1911. Pionerene hadde lært av lokale urfolk at løken kunne spises, og brukte den under matmangelen i 1848–49. Minnet om denne hjelpen, sammen med blomstens skjønnhet, lå bak valget.', 'Utah State Library', 'https://onlinelibrary.utah.gov/state-symbol/flower/'),
  ],
  VT: [
    h('Delstatsforsamlingen vedtok eremitttrosten som Vermonts offisielle fugl i 1941. Den hekker i delstatens skoger og trekker sørover om vinteren. Den offisielle symboloversikten dokumenterer vedtaksåret, men oppgir ingen egen folkeavstemning eller nærmere begrunnelse for valget.', 'Vermont State Manual', 'https://outside.vermont.gov/dept/sos/VSARA/Publications/2023_Vermont_LegislativeDirectory_StateManual.pdf'),
    h('Rødkløver ble vedtatt som Vermonts delstatsblomst i 1894. Fôrplanten viser til jordbruket og særlig melkeproduksjonen, som har vært viktig for delstatens økonomi og identitet. Blomsten representerer dermed det dyrkede landskapet og forbindelsen mellom innbyggerne og jorda.', 'University of Vermont', 'https://www.uvm.edu/extension/news/red-clover-state-flower-vermont'),
  ],
  VA: [
    h('Virginia valgte kardinalen gjennom en felles resolusjon i 1950. Da betegnelsen senere ble utelatt ved samlingen av delstatssymbolene i lovverket, ble den tatt inn igjen i 2016. Den nyere lovendringen bekreftet dermed det eldre valget av den røde sangfuglen.', 'Virginia Legislature', 'https://legacylis.virginia.gov/cgi-bin/legp604.exe?ses=161&typ=bil&val=sb352'),
    h('Blomsten fra amerikansk kornell ble vedtatt som Virginias blomsteremblem i 1918. I 1956 fikk samme plante også status som delstatstre. Det tidligblomstrende treet representerer derfor Virginia i to kategorier; de hvite «kronbladene» er egentlig høyblad rundt små blomster.', 'Virginia Senate', 'https://apps.senate.virginia.gov/Portal/Resources/SenateActivityBook.pdf'),
  ],
  WA: [
    h('Skolebarna valgte først meadowlark i 1928, mens kvinneforeningene foretrakk stillitsen i 1931. For å avgjøre saken fikk barna stemme igjen i 1951. Da vant stillitsen, og forsamlingen sluttet seg enstemmig til valget av den lille gule og svarte fuglen.', 'Washington Legislature', 'https://leg.wa.gov/learn-and-participate/educational-resources/state-symbols/bird/'),
    h('Kvinner i Washington valgte rhododendron i 1892 til verdensutstillingen i Chicago, på en tid da de manglet politisk stemmerett. Den slo kløver i finalen. Forsamlingen presiserte i 1959 at den stedegne kystarten skulle være delstatsblomst, og videreførte dermed kvinnenes valg.', 'Washington Legislature', 'https://legtest.leg.wa.gov/learn-and-participate/educational-resources/state-symbols/flower/'),
  ],
  WV: [
    h('Skoler, hageklubber og andre foreninger deltok i valget av fuglesymbol. Kardinalen slo blant annet vandretrost og blåfugl og vant med over 11 000 stemmers margin. Delstatsforsamlingen gjorde resultatet offisielt i 1949, etter økende interesse for delstatens dyreliv.', 'West Virginia Legislature', 'https://blog.wvlegislature.gov/wrap-up/2007/02/14/symbols-of-the-mountain-state-resolved-by-public-opinion/'),
    h('Skolebarn valgte rhododendron foran kaprifol og villrose, med over 15 000 stemmers margin. Begge kamre i forsamlingen bekreftet valget i 1903. Den store, eviggrønne busken med lyse blomster ble dermed West Virginias eldste offisielle blomstersymbol.', 'West Virginia Legislature', 'https://blog.wvlegislature.gov/wrap-up/2007/02/14/symbols-of-the-mountain-state-resolved-by-public-opinion/'),
  ],
  WI: [
    h('Kvinneforeningene arrangerte fuglestudier i skolene i 1926–27. Barna valgte vandretrosten med dobbelt så mange stemmer som nærmeste konkurrent. Forsamlingen gjorde den offisiell i 1949. Den var allerede en av de fem vanligste fuglene som tilbringer sommeren i Wisconsin.', 'Wisconsin State Government', 'https://www.wisconsin.gov/Pages/WisconsinforKids.aspx'),
    h('På Arbor Day i 1909 valgte skolebarn skogfiolen foran villrose, trailing arbutus og hvit vannlilje. Først i 1949 fikk valget offisiell status sammen med delstatstreet og delstatsfuglen. Den vanlige vårblomsten hadde da vært barnas foretrukne emblem i førti år.', 'Wisconsin State Government', 'https://www.wisconsin.gov/Pages/WisconsinforKids.aspx'),
  ],
  WY: [
    h('En skoleoppgave i 1926 satte fart i kampanjen for western meadowlark. Eleven Lewis Freudenthal skrev om sangen han hørte på vei til skolen. Professor Grace Hebard støttet saken, og i 1927 vedtok begge kamre fuglen uten en eneste motstemme.', 'Wyoming Game & Fish', 'https://wgfd.wyo.gov/News/Western-meadowlark-emergence-marks-the-beginning-o'),
    h('Indian paintbrush ble vedtatt som Wyomings delstatsblomst 31. januar 1917. Den stedegne planten har sterkt fargede høyblad som er langt mer iøynefallende enn selve blomstene. Vedtaket ga delstaten et blomsteremblem fra de åpne landskapene i Rocky Mountain-regionen.', 'Wyoming Secretary of State', 'https://sos.wyo.gov/Services/StateInfo_Symbols.aspx'),
  ],
};
