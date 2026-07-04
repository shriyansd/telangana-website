// Local Roman→Telugu transliteration (no network, no API). Greedy longest-match
// over an RTS-style mapping, producing candidate Telugu strings. Ambiguous roman
// spellings yield multiple candidates for the user to pick from.

const VOWELS: Record<string, { independent: string; sign: string }> = {
  a: { independent: 'అ', sign: '' },
  aa: { independent: 'ఆ', sign: 'ా' },
  A: { independent: 'ఆ', sign: 'ా' },
  i: { independent: 'ఇ', sign: 'ి' },
  ii: { independent: 'ఈ', sign: 'ీ' },
  ee: { independent: 'ఈ', sign: 'ీ' },
  I: { independent: 'ఈ', sign: 'ీ' },
  u: { independent: 'ఉ', sign: 'ు' },
  uu: { independent: 'ఊ', sign: 'ూ' },
  oo: { independent: 'ఊ', sign: 'ూ' },
  U: { independent: 'ఊ', sign: 'ూ' },
  e: { independent: 'ఎ', sign: 'ె' },
  E: { independent: 'ఏ', sign: 'ే' },
  ae: { independent: 'ఏ', sign: 'ే' },
  ai: { independent: 'ఐ', sign: 'ై' },
  o: { independent: 'ఒ', sign: 'ొ' },
  O: { independent: 'ఓ', sign: 'ో' },
  au: { independent: 'ఔ', sign: 'ౌ' },
  ou: { independent: 'ఔ', sign: 'ౌ' },
};

// Consonants ordered so longest keys are matched first.
const CONSONANTS: Record<string, string> = {
  ksh: 'క్ష', gn: 'జ్ఞ',
  kh: 'ఖ', gh: 'ఘ', ch: 'చ', Ch: 'ఛ', jh: 'ఝ',
  Th: 'ఠ', Dh: 'ఢ', th: 'త', dh: 'ద',
  ph: 'ఫ', bh: 'భ', sh: 'శ', Sh: 'ష',
  k: 'క', g: 'గ', c: 'చ', j: 'జ',
  T: 'ట', D: 'డ', N: 'ణ',
  t: 'త', d: 'ద', n: 'న',
  p: 'ప', f: 'ఫ', b: 'బ', m: 'మ',
  y: 'య', r: 'ర', l: 'ల', v: 'వ', w: 'వ',
  s: 'స', S: 'ష', h: 'హ', L: 'ళ', R: 'ఱ',
};

// Case-insensitive alternates tried for ambiguity (e.g. "t" could be త or ట).
const AMBIGUOUS: Record<string, string[]> = {
  t: ['త', 'ట'], th: ['త', 'ఠ'], d: ['ద', 'డ'], dh: ['ధ', 'ఢ'],
  n: ['న', 'ణ'], l: ['ల', 'ళ'], s: ['స', 'శ', 'ష'], sh: ['శ', 'ష'],
  e: ['ఎ', 'ఏ'], o: ['ఒ', 'ఓ'],
};

const VIRAMA = '్';
const ANUSVARA = 'ం';

interface Piece { consonant?: string; vowelSign?: string; literal?: string }

function parseWord(word: string, pick: (key: string, options: string[]) => string): string {
  let i = 0;
  let out = '';
  let pendingConsonant: string | null = null;

  const consonantKeys = Object.keys(CONSONANTS).sort((a, b) => b.length - a.length);
  const vowelKeys = Object.keys(VOWELS).sort((a, b) => b.length - a.length);

  const flushConsonant = (final: boolean) => {
    if (pendingConsonant) {
      out += pendingConsonant + (final ? VIRAMA : '');
      pendingConsonant = null;
    }
  };

  while (i < word.length) {
    // anusvara: m/n before another consonant at syllable end → ం (common in nenu? no—handle explicit M)
    if (word[i] === 'M') { flushConsonant(true); out += ANUSVARA; i++; continue; }

    let matched = false;
    for (const vk of vowelKeys) {
      if (word.startsWith(vk, i) && (vk !== vk.toLowerCase() ? true : word.slice(i, i + vk.length) === vk)) {
        const v = VOWELS[vk];
        const alt = AMBIGUOUS[vk.toLowerCase()];
        const teluguVowel = alt && vk === vk.toLowerCase() ? pick(vk, alt) : v.independent;
        if (pendingConsonant) {
          const sign = teluguVowel === v.independent ? v.sign : vowelToSign(teluguVowel);
          out += pendingConsonant + sign;
          pendingConsonant = null;
        } else {
          out += teluguVowel;
        }
        i += vk.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const ck of consonantKeys) {
      if (word.startsWith(ck, i)) {
        // double consonant like "ll" → geminate with virama
        if (pendingConsonant) out += pendingConsonant + VIRAMA;
        const alt = AMBIGUOUS[ck.toLowerCase()];
        pendingConsonant = alt && ck === ck.toLowerCase() ? pick(ck, alt) : CONSONANTS[ck];
        i += ck.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    flushConsonant(true);
    out += word[i];
    i++;
  }
  flushConsonant(true);
  return out.normalize('NFC');
}

function vowelToSign(independent: string): string {
  for (const v of Object.values(VOWELS)) {
    if (v.independent === independent) return v.sign;
  }
  return '';
}

/**
 * Transliterate romanized Telugu into candidate Telugu strings.
 * Returns the primary candidate first, then alternates for ambiguous letters.
 */
export function transliterate(roman: string, maxCandidates = 4): string[] {
  const words = roman.trim().split(/\s+/);
  if (!words[0]) return [];

  // Primary: first option for every ambiguity.
  const primary = words.map((w) => parseWord(w, (_k, opts) => opts[0])).join(' ');
  const results = [primary];

  // Alternates: flip one ambiguity class at a time (keeps candidate count sane).
  const classes = Object.keys(AMBIGUOUS);
  for (const cls of classes) {
    if (results.length >= maxCandidates) break;
    const variant = words
      .map((w) => parseWord(w, (k, opts) => (k === cls && opts.length > 1 ? opts[1] : opts[0])))
      .join(' ');
    if (!results.includes(variant)) results.push(variant);
  }
  return results.slice(0, maxCandidates);
}
