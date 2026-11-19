// The few words the game shows, in Czech (the default) or English (?lang=en, remembered).
// Strings are looked up by their English text, so the code still reads in English.

type Lang = 'cs' | 'en';

function pickLang(): Lang {
  const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
  try {
    if (param === 'cs' || param === 'en') localStorage.setItem('stuffed.lang', param);
    const saved = param ?? localStorage.getItem('stuffed.lang');
    return saved === 'en' ? 'en' : 'cs';
  } catch {
    return param === 'en' ? 'en' : 'cs';
  }
}

export const LANG: Lang = pickLang();
if (typeof document !== 'undefined') document.documentElement.lang = LANG;

const CS: Record<string, string> = {
  // Menu
  Solo: 'Sólo',
  Room: 'Místnost',
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
  'Leave the room?': 'Opustit místnost?',
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
  unicorn: 'jednorožec', dragon: 'drak', phoenix: 'fénix', yeti: 'yetti',
};

/** `en` in the game's language (unknown strings stay as they are). */
export function tr(en: string): string {
  return LANG === 'cs' ? (CS[en] ?? en) : en;
}
