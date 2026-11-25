import { getGame } from '../store/game'

/**
 * UI text in English (the keys) and Sinhala. `t('PICK THE MODE')` gives the text in the
 * chosen language; `{name}`-style holes are filled from the second argument. Anything
 * without a translation shows in English, so a missing entry is never a blank.
 *
 * Changing the language remounts the UI (App.jsx keys it on the language), so `t` can
 * read the setting directly instead of every component subscribing to it.
 */

export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'si', name: 'සිංහල' },
]

/** The device's language if we have it, else English. */
export function defaultLanguage() {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return nav.toLowerCase().startsWith('si') ? 'si' : 'en'
}

const SI = {
  // Lobby menu and panels
  SHOP: 'සාප්පුව',
  CASES: 'පෙට්ටි',
  BACKPACK: 'බෑගය',
  DAILY: 'දිනපතා',
  QUESTS: 'අභියෝග',
  TOP: 'ඉහළම',
  'BOTS ONLY': 'බොට්ස් එක්ක',
  'AFK: ON': 'AFK: ඔව්',
  'AFK: OFF': 'AFK: නැහැ',
  'PLAY WITH BOTS': 'බොට්ස් එක්ක සෙල්ලම්',
  'DAILY REWARD': 'දිනපතා තෑග්ග',
  'LEVEL & QUESTS': 'ලෙවල් සහ අභියෝග',
  'TOP PLAYERS': 'ඉහළම ක්‍රීඩකයෝ',
  SETTINGS: 'සැකසුම්',
  "TODAY'S QUESTS": 'අද අභියෝග',
  'New quests every day. Rewards are paid the moment a quest is done.': 'හැමදාම අලුත් අභියෝග. අභියෝගයක් ඉවර වුණු ගමන් තෑග්ග ලැබෙනවා.',
  LEVEL: 'ලෙවල්',
  'Next level: +${cash}': 'ඊළඟ ලෙවල් එක: +${cash}',

  // Top of the screen
  'ROUND STARTS IN': 'වටය පටන් ගන්නේ',
  'CAGES OPEN IN': 'කූඩු අරින්නේ',
  'PLAYERS LEFT': 'ක්‍රීඩකයෝ ඉතිරියි',
  'TEAMS LEFT': 'කණ්ඩායම් ඉතිරියි',
  'ROUND OVER': 'වටය ඉවරයි',
  'YOU ARE AFK': 'ඔබ AFK',
  'WAITING FOR PLAYERS...': 'ක්‍රීඩකයෝ එනකම්...',
  'Turn AFK off to join the next round': 'ඊළඟ වටයට එන්න AFK නවත්වන්න',
  'ROUND IN PROGRESS ·': 'වටයක් යනවා ·',
  LEFT: 'ඉතිරියි',
  'JOIN ROUND': 'වටයට එකතු වෙන්න',
  SPECTATE: 'බලන්න',
  LOBBY: 'ලොබිය',

  // The vote
  'STEP {n}/2': 'පියවර {n}/2',
  'PICK THE MODE': 'ක්‍රමය තෝරන්න',
  'PICK THE MAP': 'සිතියම තෝරන්න',
  BOTS: 'බොට්ස්',
  MODE: 'ක්‍රමය',
  '{n} VOTES': 'ඡන්ද {n}',
  '{n} VOTE': 'ඡන්ද {n}',
  'NO BOTS': 'බොට්ස් නැතුව',
  '{name} bots': 'බොට්ස්: {name}',
  'Most votes wins - then everyone picks the map, and the round begins': 'වැඩිම ඡන්ද ලැබෙන එක දිනනවා - ඊට පස්සේ සිතියම තෝරලා වටය පටන් ගන්නවා',
  'No bots': 'බොට්ස් නැහැ',
  Easy: 'පහසු',
  Normal: 'සාමාන්‍ය',
  Hard: 'අමාරු',
  'Free for all: every player for themselves. Last one standing wins!': 'හැමෝම තනියම: අන්තිමට ඉතිරි වෙන කෙනා දිනනවා!',
  '2v2v2v2: teams of two on neighbouring islands. Last team standing wins!': '2v2v2v2: ළඟ දූපත්වල දෙදෙනාගේ කණ්ඩායම්. අන්තිමට ඉතිරි වෙන කණ්ඩායම දිනනවා!',
  '3v3v2 (the team of two gets extra hearts). Last team standing wins!': '3v3v2 (දෙදෙනාගේ කණ්ඩායමට වැඩිපුර හදවත්). අන්තිමට ඉතිරි වෙන කණ්ඩායම දිනනවා!',
  '4v4: one half of the ring each. Bridge across together and push!': '4v4: රවුමෙන් භාගයක් බැගින්. එකට පාලම් හදලා ඉස්සරහට යන්න!',
  'Every lucky block is a Mega Lucky Block, and they give double!': 'හැම ලකී බ්ලොක් එකක්ම Mega ලකී බ්ලොක් එකක්, දෙගුණයක් දෙනවා!',
  'The lava starts rising right away. Build fast!': 'ලාවා මුල ඉඳන්ම උඩට එනවා. ඉක්මනට හදන්න!',

  // In a round
  'GO!': 'යමු!',
  'THE LAVA IS RISING!': 'ලාවා උඩට එනවා!',
  ELIMINATED: 'ඉවත් වුණා',
  'VICTORY!': 'ජයග්‍රහණය!',
  '{name} WINS!': '{name} දිනුවා!',
  'Back to the lobby in a moment…': 'ටිකකින් ලොබියට යනවා…',
  'LEVEL UP!': 'ලෙවල් අප්!',
  'LEVEL {n}': 'ලෙවල් {n}',
  'CLICK TO PLAY': 'සෙල්ලම් කරන්න click කරන්න',
  'CLICK TO LOOK AROUND': 'වටේ බලන්න click කරන්න',

  // Toasts and the server line
  'GO! Break your lucky blocks!': 'යමු! ඔබේ ලකී බ්ලොක් කඩන්න!',
  '{mode} on {map}!': '{mode} - {map}!',
  'No-bots rounds need 2 players - easy bots join in!': 'බොට්ස් නැති වටයකට ක්‍රීඩකයෝ 2ක් ඕනේ - පහසු බොට්ස් එකතු වෙනවා!',
  'OFFLINE - PLAYING WITH BOTS': 'OFFLINE - බොට්ස් එක්ක සෙල්ලම්',
  'PRIVATE ROOM {code} · {n}/{max} PLAYERS': 'පෞද්ගලික කාමරය {code} · ක්‍රීඩකයෝ {n}/{max}',
  '{n}/{max} PLAYERS IN THIS SERVER': 'මේ සර්වරයේ ක්‍රීඩකයෝ {n}/{max}',
  '8 FIGHT EVERY ROUND': 'හැම වටයකම 8 දෙනෙක් සටන් කරනවා',
  'Sunny Meadow': 'හිරු තණබිම',
  'Frosty Peaks': 'හිම කඳු',
  'Candy Clouds': 'රස කැවිලි වලාකුළු',
  'Dune Isles': 'වැලි දූපත්',
  'Sky Castle': 'අහස් මාලිගාව',
  'Ember Isles': 'ගිනි දූපත්',

  // Tutorial
  '1/5 BREAK A LUCKY BLOCK': '1/5 ලකී බ්ලොක් එකක් කඩන්න',
  'Hold the pickaxe button while aiming at it': 'ඒ දිහා බලාගෙන pickaxe බොත්තම අල්ලාගෙන ඉන්න',
  'Hold left click on it': 'ඒ මත left click අල්ලාගෙන ඉන්න',
  '2/5 HOLD YOUR BLOCKS': '2/5 බ්ලොක් අතට ගන්න',
  'Tap the block slot in your hotbar': 'hotbar එකේ බ්ලොක් slot එක tap කරන්න',
  'Press the number of your block slot': 'බ්ලොක් slot එකේ අංකය ඔබන්න',
  '3/5 BUILD TO THE MIDDLE ISLAND': '3/5 මැද දූපතට පාලමක් හදන්න',
  'Look past the edge - the white box shows where - tap PLACE': 'අද්දරෙන් එහාට බලන්න - සුදු කොටුවෙන් තැන පෙන්නනවා - PLACE tap කරන්න',
  'Look past the edge - the white box shows where - right click': 'අද්දරෙන් එහාට බලන්න - සුදු කොටුවෙන් තැන පෙන්නනවා - right click කරන්න',
  '4/5 HIT SOMEONE': '4/5 කෙනෙකුට ගහන්න',
  'Pick your best sword, aim at a player and tap HIT': 'හොඳම කඩුව අරන් ක්‍රීඩකයෙක් දිහා බලලා HIT tap කරන්න',
  'Pick your best sword, aim at a player and left click': 'හොඳම කඩුව අරන් ක්‍රීඩකයෙක් දිහා බලලා left click කරන්න',
  '5/5 THE LAVA WILL RISE': '5/5 ලාවා උඩට එනවා',
  'Stay high: look down, JUMP and PLACE to build a pillar': 'උඩින් ඉන්න: පහළ බලලා JUMP සහ PLACE කරලා කණුවක් හදන්න',
  'Stay high: look down, jump and right click to build a pillar': 'උඩින් ඉන්න: පහළ බලලා පැනලා right click කරලා කණුවක් හදන්න',

  // Settings
  GRAPHICS: 'ග්‍රැෆික්ස්',
  Language: 'භාෂාව',
  Sound: 'ශබ්දය',
  'Field of view {n}': 'දර්ශන කෝණය {n}',
  'Mouse / touch sensitivity {n}': 'මවුස් / ස්පර්ශ සංවේදීතාව {n}',
  'Invert look up/down': 'උඩ/පහළ බැලීම මාරු කරන්න',
  'Camera in rounds': 'වටවලදී කැමරාව',
  MUTED: 'නිහඬයි',

  // Quests
  'Get 5 kills': 'kills 5ක් ගන්න',
  'Get 12 kills': 'kills 12ක් ගන්න',
  'Win a round': 'වටයක් දිනන්න',
  'Break 15 lucky blocks': 'ලකී බ්ලොක් 15ක් කඩන්න',
  'Break 40 lucky blocks': 'ලකී බ්ලොක් 40ක් කඩන්න',
  'Play 3 rounds': 'වට 3ක් සෙල්ලම් කරන්න',
  'Play 8 rounds': 'වට 8ක් සෙල්ලම් කරන්න',
  'Place 100 blocks': 'බ්ලොක් 100ක් තියන්න',
  'Finish top 3 twice': 'දෙපාරක් මුල් 3 දෙනා අතරට එන්න',
}

const TABLES = { si: SI }

export function t(text, vars) {
  const lang = getGame().settings.lang
  let out = (lang && TABLES[lang]?.[text]) || text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}
