// The few words the game shows, in Czech or English: the one picked in the options (remembered;
// ?lang= also sets it), else the browser's (Czech for Czech and Slovak browsers, English for the
// rest). Strings are looked up by their English text, so the code still reads in English.

export type Lang = 'cs' | 'en';

const LANG_KEY = 'stuffed.lang';

/** The browser's language: Czech for Czech and Slovak (Slovak kids read Czech), else English. */
function browserLang(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  return langs.some((l) => /^(cs|sk)\b/i.test(l ?? '')) ? 'cs' : 'en';
}

function pickLang(): Lang {
  const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  try {
    if (param === 'cs' || param === 'en') localStorage.setItem(LANG_KEY, param);
    const saved = param ?? localStorage.getItem(LANG_KEY);
    return saved === 'cs' || saved === 'en' ? saved : browserLang();
  } catch {
    return param === 'cs' || param === 'en' ? param : browserLang();
  }
}

/** Switches to `lang` for good (the page reloads to show it). */
export function switchLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // not remembered: this time only, by the address
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  location.replace(url.toString());
}

export const LANG: Lang = pickLang();
if (typeof document !== 'undefined') document.documentElement.lang = LANG;

const CS: Record<string, string> = {
  // Menu
  Solo: 'Sólo',
  Multi: 'Multi',
  'Your name': 'Tvoje jméno',
  Plush: 'Plyšák',
  You: 'Ty',
  CODE: 'KÓD',
  'Room code': 'Kód místnosti',
  Join: 'Připojit',
  "Couldn't reach the game server.": 'Nepodařilo se spojit s herním serverem.',
  '4 letters, like BNFJ': '4 písmena, třeba BNFJ',
  // Lobby
  'Share invite': 'Sdílet pozvánku',
  Leave: 'Odejít',
  'Fewer bots': 'Méně botů',
  'More bots': 'Více botů',
  'Team up against the bots': 'Hrát v týmu proti botům',
  Start: 'Hrát',
  Full: 'Plno',
  'Waiting for host…': 'Čeká se na hostitele…',
  Map: 'Mapa',
  Backyard: 'Zahrada',
  Bedroom: 'Dětský pokoj',
  'Snowy Park': 'Zasněžený park',
  'Pirate Cove': 'Pirátská zátoka',
  'Treasure Island': 'Ostrov pokladů',
  'Volcano Isle': 'Sopečný ostrov',
  'Coconut Isle': 'Kokosový ostrov',
  'Waterfall Isle': 'Ostrov s vodopádem',
  'Lighthouse Isle': 'Majákový ostrůvek',
  'Skull Rock': 'Lebková skála',
  'Palm Isle': 'Palmový ostrůvek',
  'The Shipwreck': 'Vrak lodi',
  'Rocky Isle': 'Skalnatý ostrůvek',
  'The Current': 'Proud',
  'Bot difficulty': 'Obtížnost botů',
  'Easy bots': 'Snadní boti',
  'Normal bots': 'Běžní boti',
  'Hard bots': 'Těžcí boti',
  // Results
  'Winner!': 'Vítěz!',
  'You win! Grab the loot!': 'Vyhráváš! Seber kořist!',
  'Your team wins! Grab the loot!': 'Tvůj tým vyhrál! Seberte kořist!',
  '{name} wins!': '{name} vyhrává!',
  'Team wins!': 'Tým vyhrál!',
  'Unstitched!': 'Rozpárali tě!',
  Over: 'Konec',
  Again: 'Znovu',
  Watch: 'Sledovat',
  Lobby: 'Čekárna',
  'Host…': 'Hostitel…',
  Menu: 'Menu',
  // Wardrobe
  Wardrobe: 'Šatník',
  Gallery: 'Galerie',
  'Recovery code': 'Kód pro obnovení',
  'Copy code': 'Zkopírovat kód',
  'Use code': 'Použít kód',
  'Got a code from another device?': 'Máš kód z jiného zařízení?',
  'Your code for another device:': 'Tvůj kód pro jiné zařízení:',
  head: 'hlava',
  body: 'tělo',
  legs: 'nohy',
  tail: 'ocas',
  accessory: 'doplněk',
  // Options, help, spectating, the bag
  Options: 'Nastavení',
  Sound: 'Zvuky',
  Music: 'Hudba',
  Fullscreen: 'Celá obrazovka',
  Controls: 'Ovládání',
  'Leave the match?': 'Opustit hru?',
  'Leave Multi?': 'Odejít z Multi?',
  'Invite friends: send them this code': 'Pozvi kamarády: pošli jim tenhle kód',
  'Code copied!': 'Kód zkopírován!',
  Players: 'Hráči',
  Bots: 'Boti',
  Max: 'Max',
  'Hold E to open the chest': 'Podrž E a otevři truhlu',
  'Hold the hand button to open the chest': 'Podrž tlačítko s rukou a otevři truhlu',
  'E: put the part on. Q: keep it for later': 'E: obleč si to. Q: schovej si to na později',
  'Hand button: put the part on. Bag: keep it for later': 'Ruka: obleč si to. Pytlík: schovej si to na později',
  'Tap an item to use it; hold it to drop it': 'Ťuknutím věc použiješ, podržením ji zahodíš',
  'Keys 3, 4, 5 use your items; hold a slot to drop it': 'Klávesami 3, 4, 5 použiješ věci; podržením slotu věc zahodíš',
  'Parts in your bag and the ones you wear come home with you': 'Co máš na sobě i v pytlíku, si odneseš domů do sbírky',
  'The zone is shrinking: stay inside it, outside it hurts': 'Zóna se zmenšuje: drž se uvnitř, venku to bolí',
  'Set complete! Now you can find its holo parts': 'Máš celý set! Teď můžeš najít jeho holo části',
  'Collect all five parts of one animal for a set': 'Posbírej všech pět částí jednoho zvířátka',
  'See your whole collection in the Wardrobe gallery': 'Celou sbírku najdeš v galerii v šatníku',
  Holo: 'Holo',
  Parts: 'Části',
  Sets: 'Sety',
  'Holo parts': 'Holo části',
  'Holo sets': 'Holo sety',
  // Buttons (Knoflíky): the currency, and the shop.
  Buttons: 'Knoflíky',
  Match: 'Zápas',
  Found: 'Nalezené',
  Knockouts: 'Vyřazení',
  'Top 5': 'Top 5',
  'Top 3': 'Top 3',
  Win: 'Výhra',
  "Today's first win": 'První výhra dne',
  Complete: 'Doplnit',
  'Holo set': 'Holo set',
  'Buy?': 'Koupit?',
  Total: 'Celkem',
  Language: 'Jazyk',
  Online: 'Online',
  'New room for friends': 'Nová místnost pro kamarády',
  'Looking for players…': 'Hledáme hráče…',
  'Starting in {s} s': 'Začínáme za {s} s',
  'Starting…': 'Začínáme…',
  "Couldn't find a match.": 'Nepodařilo se najít hru.',
  Privacy: 'Soukromí',
  Terms: 'Podmínky',
  Contact: 'Kontakt',
  'Left thumb anywhere: walk': 'Levý palec kdekoli: chůze',
  'Right thumb: aim, drag further to shoot': 'Pravý palec: míření, táhni dál a střílíš',
  Jump: 'Skok',
  'Pick up, hold to open a chest': 'Seber, podrž a otevřeš truhlu',
  'Bag: keep a part for later': 'Pytlík: schovej si část na později',
  'Linked to': 'Propojeno s',
  Unlink: 'Odpojit',
  'Delete account': 'Smazat účet',
  'Sign in with Google to keep your collection safe and take it to any device.': 'Přihlas se přes Google a tvoje sbírka bude v bezpečí na jakémkoli zařízení.',
  "Couldn't reach Google.": 'Nepodařilo se spojit s Googlem.',
  "Couldn't sign in. Try again.": 'Přihlášení se nepovedlo. Zkus to znovu.',
  'Profiles of': 'Profily účtu',
  'Add this profile too': 'Přidat i tento profil',
  'This profile belongs to another account.': 'Tento profil patří k jinému účtu.',
  'Delete the account and all its profiles for good? Sign in to confirm.': 'Smazat účet a všechny jeho profily natrvalo? Potvrď přihlášením.',
  'Keep it': 'Nechat',
  Profile: 'Profil',
  'Without a Google account: your code for another device': 'Bez Google účtu: tvůj kód pro jiné zařízení',
  "That code doesn't match any profile.": 'Tenhle kód nepatří k žádnému profilu.',
  'The account is deleted.': 'Účet je smazaný.',
  Walk: 'Chůze',
  'Aim, click to shoot': 'Míření, klik = střelba',
  'Switch weapons (or the wheel)': 'Přepnout zbraň (nebo kolečko)',
  'Reload the weapon': 'Nabít',
  'Drop the weapon': 'Zahodit zbraň',
  'Use an item': 'Použít věc',
  'Items: tap to use, hold to drop': 'Věci: ťukni = použij, podrž = zahoď',
  "Offline practice: this match doesn't count toward your collection": 'Hraješ offline: tenhle zápas se do sbírky nepočítá',
  "Couldn't start the match.": 'Zápas se nepodařilo spustit.',
  '/privacy': '/soukromi',
  '/terms': '/podminky',
  Reload: 'Načíst',
  'A new version of the game is ready': 'Je tu nová verze hry',
  'A new version is out: reload to play online': 'Vyšla nová verze: načti ji a hraj online',
  'Found most often on: {map}': 'Nejčastěji k nalezení: {map}',
  'Not enough Buttons yet: play matches to earn them': 'Zatím máš málo knoflíků: hraj zápasy a sbírej je',
  Stay: 'Zůstat',
  Close: 'Zavřít',
  Previous: 'Předchozí',
  Next: 'Další',
  Back: 'Zpět',
  Bag: 'Batoh',
  Stash: 'Do batohu',
  Space: 'Mezerník',
  // Toasts when something big is set off
  'Water balloons!': 'Vodní bomby!',
  'Falling blocks!': 'Padají kostky!',
  'Snowball barrage!': 'Sněhová palba!',
  'Cannonballs!': 'Dělová palba!',
  'Lawnmower!': 'Sekačka!',
  'Snowplow!': 'Sněžný pluh!',
  // Areas you walk into
  'Block Castle': 'Kostkový hrad',
  Bookshelf: 'Knihovna',
  Dollhouse: 'Domeček pro panenky',
  'Frozen Pond': 'Zamrzlý rybník',
  'Gift Market': 'Dárkový trh',
  Igloo: 'Iglú',
  'Kiddie Pool': 'Dětský bazének',
  'Log Cabin': 'Srub',
  'Picnic Plateau': 'Piknikové návrší',
  'Pine Forest': 'Borový les',
  'Sandbox Desert': 'Pískovištní poušť',
  'Snow Fort': 'Sněhová pevnost',
  'Snowball Alley': 'Koulovací ulička',
  'Snowman Garden': 'Sněhulákova zahrada',
  'The Bed': 'Postel',
  'The Desk': 'Psací stůl',
  'The House': 'Dům',
  'The Rug': 'Koberec',
  'Tool Shed': 'Kůlna',
  'Toy Corner': 'Hračkový koutek',
  Treehouse: 'Domek na stromě',
  'Veggie Jungle': 'Zeleninová džungle',
  // Animals (gallery and wardrobe labels)
  bear: 'medvěd', frog: 'žába', chicken: 'slepice', bunny: 'zajíc', cat: 'kočka', pig: 'prasátko', turtle: 'želva',
  mouse: 'myš', sheep: 'ovečka', shark: 'žralok', owl: 'sova', penguin: 'tučňák', fox: 'liška', panda: 'panda',
  hedgehog: 'ježek', koala: 'koala', raccoon: 'mýval', bee: 'včela', dino: 'dinosaurus', axolotl: 'axolotl',
  lion: 'lev', elephant: 'slon', octopus: 'chobotnice', flamingo: 'plameňák', giraffe: 'žirafa', sloth: 'lenochod',
  unicorn: 'jednorožec', dragon: 'drak', phoenix: 'fénix', yeti: 'yetti', otter: 'vydra', mermaid: 'mořská panna',
};

/** `en` in the game's language (unknown strings stay as they are). */
export function tr(en: string): string {
  return LANG === 'cs' ? (CS[en] ?? en) : en;
}
