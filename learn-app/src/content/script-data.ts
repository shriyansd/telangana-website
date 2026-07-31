// Telugu script reference data for the Script Practice page.

export interface Letter {
  telugu: string;
  roman: string;
  name?: string;
  hint?: string;
}

export const VOWELS: Letter[] = [
  { telugu: 'అ', roman: 'a', hint: 'like “a” in about' },
  { telugu: 'ఆ', roman: 'ā', hint: 'like “a” in father, held longer' },
  { telugu: 'ఇ', roman: 'i', hint: 'like “i” in bit' },
  { telugu: 'ఈ', roman: 'ī', hint: 'like “ee” in feet' },
  { telugu: 'ఉ', roman: 'u', hint: 'like “u” in put' },
  { telugu: 'ఊ', roman: 'ū', hint: 'like “oo” in food' },
  { telugu: 'ఋ', roman: 'ru', hint: 'vocalic r, rare, as in ఋషి' },
  { telugu: 'ఎ', roman: 'e', hint: 'like “e” in bed' },
  { telugu: 'ఏ', roman: 'ē', hint: 'like “a” in make' },
  { telugu: 'ఐ', roman: 'ai', hint: 'like “i” in bite' },
  { telugu: 'ఒ', roman: 'o', hint: 'like “o” in off' },
  { telugu: 'ఓ', roman: 'ō', hint: 'like “o” in go' },
  { telugu: 'ఔ', roman: 'au', hint: 'like “ow” in cow' },
  { telugu: 'అం', roman: 'aṁ', name: 'anusvāra', hint: 'nasal hum at the end' },
  { telugu: 'అః', roman: 'aḥ', name: 'visarga', hint: 'light breath at the end' },
];

export const CONSONANTS: Letter[] = [
  { telugu: 'క', roman: 'ka' }, { telugu: 'ఖ', roman: 'kha' }, { telugu: 'గ', roman: 'ga' }, { telugu: 'ఘ', roman: 'gha' }, { telugu: 'ఙ', roman: 'ṅa' },
  { telugu: 'చ', roman: 'cha' }, { telugu: 'ఛ', roman: 'chha' }, { telugu: 'జ', roman: 'ja' }, { telugu: 'ఝ', roman: 'jha' }, { telugu: 'ఞ', roman: 'ña' },
  { telugu: 'ట', roman: 'ṭa', hint: 'hard, tongue curls back' }, { telugu: 'ఠ', roman: 'ṭha' }, { telugu: 'డ', roman: 'ḍa' }, { telugu: 'ఢ', roman: 'ḍha' }, { telugu: 'ణ', roman: 'ṇa' },
  { telugu: 'త', roman: 'ta', hint: 'soft, tongue on teeth' }, { telugu: 'థ', roman: 'tha' }, { telugu: 'ద', roman: 'da' }, { telugu: 'ధ', roman: 'dha' }, { telugu: 'న', roman: 'na' },
  { telugu: 'ప', roman: 'pa' }, { telugu: 'ఫ', roman: 'pha' }, { telugu: 'బ', roman: 'ba' }, { telugu: 'భ', roman: 'bha' }, { telugu: 'మ', roman: 'ma' },
  { telugu: 'య', roman: 'ya' }, { telugu: 'ర', roman: 'ra' }, { telugu: 'ల', roman: 'la' }, { telugu: 'వ', roman: 'va' },
  { telugu: 'శ', roman: 'śa' }, { telugu: 'ష', roman: 'ṣa' }, { telugu: 'స', roman: 'sa' }, { telugu: 'హ', roman: 'ha' },
  { telugu: 'ళ', roman: 'ḷa', hint: 'retroflex l as in నీళ్లు' }, { telugu: 'క్ష', roman: 'kṣa' }, { telugu: 'ఱ', roman: 'ṟa', hint: 'strong trilled r' },
];

/** Vowel signs (guṇintālu) shown on క as the customary example. */
export const GUNINTALU: { sign: string; roman: string; example: string }[] = [
  { sign: '(none)', roman: 'ka', example: 'క' },
  { sign: 'ా', roman: 'kā', example: 'కా' },
  { sign: 'ి', roman: 'ki', example: 'కి' },
  { sign: 'ీ', roman: 'kī', example: 'కీ' },
  { sign: 'ు', roman: 'ku', example: 'కు' },
  { sign: 'ూ', roman: 'kū', example: 'కూ' },
  { sign: 'ె', roman: 'ke', example: 'కె' },
  { sign: 'ే', roman: 'kē', example: 'కే' },
  { sign: 'ై', roman: 'kai', example: 'కై' },
  { sign: 'ొ', roman: 'ko', example: 'కొ' },
  { sign: 'ో', roman: 'kō', example: 'కో' },
  { sign: 'ౌ', roman: 'kau', example: 'కౌ' },
  { sign: 'ం', roman: 'kaṁ', example: 'కం' },
  { sign: 'ః', roman: 'kaḥ', example: 'కః' },
];

/** Common conjuncts / vattulu examples. */
export const VATTULU: { telugu: string; roman: string; from: string }[] = [
  { telugu: 'క్క', roman: 'kka', from: 'క + ్ + క, as in అక్క' },
  { telugu: 'మ్మ', roman: 'mma', from: 'మ + ్ + మ, as in అమ్మ' },
  { telugu: 'న్న', roman: 'nna', from: 'న + ్ + న, as in అన్నం' },
  { telugu: 'ల్ల', roman: 'lla', from: 'ల + ్ + ల, as in చెల్లి' },
  { telugu: 'ళ్ల', roman: 'ḷla', from: 'ళ + ్ + ల, as in నీళ్లు' },
  { telugu: 'స్త', roman: 'sta', from: 'స + ్ + త, as in నమస్తే' },
  { telugu: 'ట్ట', roman: 'ṭṭa', from: 'ట + ్ + ట, as in పట్టు' },
  { telugu: 'ద్ద', roman: 'dda', from: 'ద + ్ + ద, as in పెద్ద' },
];

/** Layout for the on-screen Telugu keyboard. */
export const KEYBOARD_BASIC: string[][] = [
  ['అ', 'ఆ', 'ఇ', 'ఈ', 'ఉ', 'ఊ', 'ఎ', 'ఏ', 'ఐ', 'ఒ', 'ఓ', 'ఔ'],
  ['క', 'ఖ', 'గ', 'ఘ', 'చ', 'ఛ', 'జ', 'ఝ', 'ట', 'ఠ', 'డ', 'ఢ'],
  ['ణ', 'త', 'థ', 'ద', 'ధ', 'న', 'ప', 'ఫ', 'బ', 'భ', 'మ'],
  ['య', 'ర', 'ల', 'వ', 'శ', 'ష', 'స', 'హ', 'ళ', 'ఱ'],
];

export const KEYBOARD_SIGNS: string[] = ['ా', 'ి', 'ీ', 'ు', 'ూ', 'ె', 'ే', 'ై', 'ొ', 'ో', 'ౌ', 'ం', 'ః', '్'];
