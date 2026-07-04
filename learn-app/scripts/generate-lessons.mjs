#!/usr/bin/env node
// Generates the script-course (alphabet) and vocabulary lessons from data
// tables, so adding a lesson means adding a few data rows — not hand-writing
// JSON. Writes lesson files into src/content/lessons/ and merges any new
// concepts into src/content/concepts.json. Idempotent: re-running overwrites
// the generated lessons and never duplicates concepts.
//
//   node scripts/generate-lessons.mjs
//
// Everything generated is status "draft" (AI-seeded, awaiting native review).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lessonsDir = join(root, 'src', 'content', 'lessons');
const conceptsPath = join(root, 'src', 'content', 'concepts.json');

const TODAY = '2026-07-02';

// ─────────────────────────────────────────────────────────────────────────────
// LETTER DATA — the script course (course-6)
// word: an example word; wordMode 'starts' (default) or 'contains'
// ─────────────────────────────────────────────────────────────────────────────

const LETTER_LESSONS = [
  {
    id: 'c6-u2-l1', unitId: 'c6-u2', title: 'Vowels: అ to ఊ', teluguTitle: 'అ ఆ ఇ ఈ ఉ ఊ',
    description: 'The first six vowels — short and long pairs.',
    letters: [
      { te: 'అ', roman: 'a', slug: 'a', hint: 'like “a” in about', word: { te: 'అమ్మ', tr: 'amma', en: 'mother' } },
      { te: 'ఆ', roman: 'ā', slug: 'aa', hint: 'a long “aa”, as in father', word: { te: 'ఆవు', tr: 'āvu', en: 'cow' } },
      { te: 'ఇ', roman: 'i', slug: 'i', hint: 'like “i” in bit', word: { te: 'ఇల్లు', tr: 'illu', en: 'house' } },
      { te: 'ఈ', roman: 'ī', slug: 'ii', hint: 'a long “ee”, as in feet', word: { te: 'ఈగ', tr: 'īga', en: 'housefly' } },
      { te: 'ఉ', roman: 'u', slug: 'u', hint: 'like “u” in put', word: { te: 'ఉడుత', tr: 'uḍuta', en: 'squirrel' } },
      { te: 'ఊ', roman: 'ū', slug: 'uu', hint: 'a long “oo”, as in food', word: { te: 'ఊరు', tr: 'ūru', en: 'village / town' } },
    ],
  },
  {
    id: 'c6-u2-l2', unitId: 'c6-u2', title: 'Vowels: ఎ to ఔ', teluguTitle: 'ఎ ఏ ఐ ఒ ఓ ఔ',
    description: 'The e/o family and the glides ai and au.',
    letters: [
      { te: 'ఎ', roman: 'e', slug: 'e', hint: 'like “e” in bed', word: { te: 'ఎలుక', tr: 'eluka', en: 'mouse' } },
      { te: 'ఏ', roman: 'ē', slug: 'ee', hint: 'a long “ay”, as in make', word: { te: 'ఏనుగు', tr: 'ēnugu', en: 'elephant' } },
      { te: 'ఐ', roman: 'ai', slug: 'ai', hint: 'like “i” in bite', word: { te: 'ఐదు', tr: 'aidu', en: 'five' } },
      { te: 'ఒ', roman: 'o', slug: 'o', hint: 'like “o” in off', word: { te: 'ఒకటి', tr: 'okaṭi', en: 'one' } },
      { te: 'ఓ', roman: 'ō', slug: 'oo', hint: 'a long “o”, as in go', word: { te: 'ఓడ', tr: 'ōḍa', en: 'ship' } },
      { te: 'ఔ', roman: 'au', slug: 'au', hint: 'like “ow” in cow', word: { te: 'ఔను', tr: 'aunu', en: 'yes (casual)' } },
    ],
  },
  {
    id: 'c6-u2-l3', unitId: 'c6-u2', title: 'Rare Vowels & Review', teluguTitle: 'ఋ అం అః',
    description: 'The rare ఋ, the nasal అం, the breathy అః — then a vowel review.',
    letters: [
      { te: 'ఋ', roman: 'ru', slug: 'ru', hint: 'vocalic r — rare, as in ఋషి (sage)', word: { te: 'ఋషి', tr: 'ṛṣi', en: 'sage' } },
      { te: 'అం', roman: 'aṁ', slug: 'am', hint: 'a nasal hum at the end — the anusvāra', word: { te: 'అంగడి', tr: 'aṅgaḍi', en: 'shop' } },
      { te: 'అః', roman: 'aḥ', slug: 'ah', hint: 'a light breath at the end — the visarga' },
    ],
    reviewLetters: [
      { te: 'అ', roman: 'a' }, { te: 'ఆ', roman: 'ā' }, { te: 'ఇ', roman: 'i' }, { te: 'ఈ', roman: 'ī' },
      { te: 'ఎ', roman: 'e' }, { te: 'ఏ', roman: 'ē' }, { te: 'ఒ', roman: 'o' }, { te: 'ఓ', roman: 'ō' },
    ],
  },
  {
    id: 'c6-u3-l1', unitId: 'c6-u3', title: 'క ఖ గ ఘ — the k sounds', teluguTitle: 'క వర్గం',
    description: 'The first consonant row: plain, breathy, and voiced k sounds.',
    letters: [
      { te: 'క', roman: 'ka', slug: 'ka', word: { te: 'కలం', tr: 'kalam', en: 'pen' } },
      { te: 'ఖ', roman: 'kha', slug: 'kha', hint: 'ka with a puff of breath', word: { te: 'ఖాళీ', tr: 'khāḷī', en: 'empty' } },
      { te: 'గ', roman: 'ga', slug: 'ga', word: { te: 'గది', tr: 'gadi', en: 'room' } },
      { te: 'ఘ', roman: 'gha', slug: 'gha', hint: 'ga with a puff of breath', word: { te: 'ఘంట', tr: 'ghaṇṭa', en: 'bell' } },
      { te: 'ఙ', roman: 'ṅa', slug: 'nga', hint: 'the “ng” sound — rare on its own' },
    ],
  },
  {
    id: 'c6-u3-l2', unitId: 'c6-u3', title: 'చ ఛ జ ఝ — the ch and j sounds', teluguTitle: 'చ వర్గం',
    description: 'The second consonant row.',
    letters: [
      { te: 'చ', roman: 'cha', slug: 'cha', word: { te: 'చదువు', tr: 'chaduvu', en: 'study / education' } },
      { te: 'ఛ', roman: 'chha', slug: 'chha', hint: 'cha with a puff of breath' },
      { te: 'జ', roman: 'ja', slug: 'ja', word: { te: 'జంతువు', tr: 'jantuvu', en: 'animal' } },
      { te: 'ఝ', roman: 'jha', slug: 'jha', hint: 'ja with a puff of breath — rare' },
      { te: 'ఞ', roman: 'ña', slug: 'nya', hint: 'the “ny” sound — appears in combinations' },
    ],
  },
  {
    id: 'c6-u3-l3', unitId: 'c6-u3', title: 'ట ఠ డ ఢ ణ — the hard t sounds', teluguTitle: 'ట వర్గం',
    description: 'Retroflex sounds: the tongue curls back to the roof of the mouth.',
    letters: [
      { te: 'ట', roman: 'ṭa', slug: 'tta', hint: 'hard t — tongue curls back', word: { te: 'టమాటా', tr: 'ṭamāṭā', en: 'tomato' } },
      { te: 'ఠ', roman: 'ṭha', slug: 'ttha', hint: 'ṭa with a puff of breath — rare' },
      { te: 'డ', roman: 'ḍa', slug: 'dda', hint: 'hard d — tongue curls back', word: { te: 'డబ్బు', tr: 'ḍabbu', en: 'money' } },
      { te: 'ఢ', roman: 'ḍha', slug: 'ddha', hint: 'ḍa with a puff of breath — rare' },
      { te: 'ణ', roman: 'ṇa', slug: 'nna-retro', hint: 'hard n — shows up inside words like బాణం' },
    ],
  },
  {
    id: 'c6-u3-l4', unitId: 'c6-u3', title: 'త థ ద ధ న — the soft t sounds', teluguTitle: 'త వర్గం',
    description: 'Dental sounds: the tongue touches the teeth. Compare with the ట row!',
    letters: [
      { te: 'త', roman: 'ta', slug: 'ta', hint: 'soft t — tongue on the teeth', word: { te: 'తల', tr: 'tala', en: 'head' } },
      { te: 'థ', roman: 'tha', slug: 'tha', hint: 'ta with a puff of breath — rare' },
      { te: 'ద', roman: 'da', slug: 'da', hint: 'soft d', word: { te: 'దీపం', tr: 'dīpam', en: 'lamp' } },
      { te: 'ధ', roman: 'dha', slug: 'dha', hint: 'da with a puff of breath', word: { te: 'ధనం', tr: 'dhanam', en: 'wealth' } },
      { te: 'న', roman: 'na', slug: 'na', word: { te: 'నది', tr: 'nadi', en: 'river' } },
    ],
  },
  {
    id: 'c6-u3-l5', unitId: 'c6-u3', title: 'ప ఫ బ భ మ — the p, b, m sounds', teluguTitle: 'ప వర్గం',
    description: 'The lip sounds — the last of the five classic rows.',
    letters: [
      { te: 'ప', roman: 'pa', slug: 'pa', word: { te: 'పండు', tr: 'paṇḍu', en: 'fruit' } },
      { te: 'ఫ', roman: 'pha', slug: 'pha', hint: 'pa with a puff of breath', word: { te: 'ఫోటో', tr: 'phōṭō', en: 'photo' } },
      { te: 'బ', roman: 'ba', slug: 'ba', word: { te: 'బడి', tr: 'baḍi', en: 'school' } },
      { te: 'భ', roman: 'bha', slug: 'bha', hint: 'ba with a puff of breath', word: { te: 'భోజనం', tr: 'bhōjanam', en: 'meal' } },
      { te: 'మ', roman: 'ma', slug: 'ma', word: { te: 'మామిడి', tr: 'māmiḍi', en: 'mango' } },
    ],
  },
  {
    id: 'c6-u3-l6', unitId: 'c6-u3', title: 'య ర ల వ హ', teluguTitle: 'య ర ల వ హ',
    description: 'The smooth in-between sounds.',
    letters: [
      { te: 'య', roman: 'ya', slug: 'ya', word: { te: 'యాభై', tr: 'yābhai', en: 'fifty' } },
      { te: 'ర', roman: 'ra', slug: 'ra', word: { te: 'రాత్రి', tr: 'rātri', en: 'night' } },
      { te: 'ల', roman: 'la', slug: 'la', word: { te: 'లడ్డూ', tr: 'laḍḍū', en: 'laddu (sweet)' } },
      { te: 'వ', roman: 'va', slug: 'va', word: { te: 'వాన', tr: 'vāna', en: 'rain' } },
      { te: 'హ', roman: 'ha', slug: 'ha', word: { te: 'హంస', tr: 'haṁsa', en: 'swan' } },
    ],
  },
  {
    id: 'c6-u3-l7', unitId: 'c6-u3', title: 'శ ష స ళ ఱ క్ష', teluguTitle: 'శ ష స ళ',
    description: 'The s sounds, the special ళ, and two rare letters.',
    letters: [
      { te: 'శ', roman: 'śa', slug: 'sha', hint: 'sh as in ship', word: { te: 'శనివారం', tr: 'śanivāram', en: 'Saturday' } },
      { te: 'ష', roman: 'ṣa', slug: 'ssa', hint: 'a harder sh — tongue curled back', word: { te: 'భాష', tr: 'bhāṣa', en: 'language' }, wordMode: 'contains' },
      { te: 'స', roman: 'sa', slug: 'sa', word: { te: 'సరే', tr: 'sarē', en: 'okay' } },
      { te: 'ళ', roman: 'ḷa', slug: 'lla', hint: 'retroflex l — the special Telugu l', word: { te: 'నీళ్లు', tr: 'nīḷḷu', en: 'water' }, wordMode: 'contains' },
      { te: 'ఱ', roman: 'ṟa', slug: 'rra', hint: 'a strong trilled r — rare today' },
      { te: 'క్ష', roman: 'kṣa', slug: 'ksha', hint: 'k + ṣa fused into one sign', word: { te: 'రిక్షా', tr: 'rikṣā', en: 'rickshaw' }, wordMode: 'contains' },
    ],
  },
];

// Gunintalu (vowel signs); base consonant defaults to క, overridable per item
const GUNINTA_LESSONS = [
  {
    id: 'c6-u4-l1', unitId: 'c6-u4', title: 'Vowel Signs: కా to కూ', teluguTitle: 'కా కి కీ కు కూ',
    description: 'Every consonant carries a built-in “a”. Vowel signs swap it out.',
    items: [
      { sign: 'ా', roman: 'kā', example: 'కా', slug: 'kaa', word: { te: 'కాకి', tr: 'kāki', en: 'crow' } },
      { sign: 'ి', roman: 'ki', example: 'కి', slug: 'ki', word: { te: 'కిటికీ', tr: 'kiṭikī', en: 'window' } },
      { sign: 'ీ', roman: 'kī', example: 'కీ', slug: 'kii' },
      { sign: 'ు', roman: 'ku', example: 'కు', slug: 'ku', word: { te: 'కుక్క', tr: 'kukka', en: 'dog' } },
      { sign: 'ూ', roman: 'kū', example: 'కూ', slug: 'kuu', word: { te: 'కూర', tr: 'kūra', en: 'curry / vegetable dish' } },
    ],
  },
  {
    id: 'c6-u4-l2', unitId: 'c6-u4', title: 'Vowel Signs: కె to కం', teluguTitle: 'కె కే కై కొ కో కౌ కం',
    description: 'The e/o family of vowel signs, plus the nasal dot.',
    items: [
      { sign: 'ె', roman: 'ke', example: 'కె', slug: 'ke' },
      { sign: 'ే', roman: 'kē', example: 'కే', slug: 'kee', word: { te: 'కేక', tr: 'kēka', en: 'shout' } },
      { sign: 'ై', roman: 'kai', example: 'కై', slug: 'kai' },
      { sign: 'ొ', roman: 'ko', example: 'కొ', slug: 'ko' },
      { sign: 'ో', roman: 'kō', example: 'కో', slug: 'koo', word: { te: 'కోడి', tr: 'kōḍi', en: 'hen / chicken' } },
      { sign: 'ౌ', roman: 'kau', example: 'కౌ', slug: 'kau' },
      { sign: 'ం', roman: 'kaṁ', example: 'కం', slug: 'kam', word: { te: 'పండం?', tr: '', en: '' } },
    ],
  },
  {
    id: 'c6-u4-l3', unitId: 'c6-u4', title: 'Signs on Every Letter', teluguTitle: 'మా ని తో రు లే',
    description: 'The same vowel signs work on every consonant. Read them on మ, న, త, ర, ల.',
    items: [
      { base: 'మ', sign: 'ా', roman: 'mā', example: 'మా', slug: 'syl-maa', word: { te: 'మామిడి', tr: 'māmiḍi', en: 'mango' } },
      { base: 'న', sign: 'ి', roman: 'ni', example: 'ని', slug: 'syl-ni', word: { te: 'నిన్న', tr: 'ninna', en: 'yesterday' } },
      { base: 'త', sign: 'ో', roman: 'tō', example: 'తో', slug: 'syl-to' },
      { base: 'ర', sign: 'ు', roman: 'ru', example: 'రు', slug: 'syl-ru', word: { te: 'పేరు', tr: 'pēru', en: 'name' } },
      { base: 'ల', sign: 'ే', roman: 'lē', example: 'లే', slug: 'syl-lee', word: { te: 'లేదు', tr: 'lēdu', en: 'no / there isn’t' } },
      { base: 'ప', sign: 'ూ', roman: 'pū', example: 'పూ', slug: 'syl-puu', word: { te: 'పూవు', tr: 'pūvu', en: 'flower' } },
    ],
  },
];
// (the కం example word above is intentionally dropped below — see makeGuninta)

// Reading practice: whole words built only from letters already taught.
// Items reuse existing vocabulary concepts so reading reinforces the SRS.
const READING_LESSONS = [
  {
    id: 'c6-u6-l1', unitId: 'c6-u6', title: 'Read: Family Words', teluguTitle: 'అమ్మ నాన్న అక్క',
    description: 'Your first real reading — family words use the letters and doubles you know.',
    items: [
      { conceptId: 'fam-amma', te: 'అమ్మ', tr: 'amma', en: 'mother' },
      { conceptId: 'fam-nanna', te: 'నాన్న', tr: 'nānna', en: 'father' },
      { conceptId: 'fam-akka', te: 'అక్క', tr: 'akka', en: 'older sister' },
      { conceptId: 'fam-anna', te: 'అన్న', tr: 'anna', en: 'older brother' },
      { conceptId: 'fam-tata', te: 'తాత', tr: 'tāta', en: 'grandfather' },
    ],
  },
  {
    id: 'c6-u6-l2', unitId: 'c6-u6', title: 'Read: Food & Home', teluguTitle: 'పాలు నీళ్లు ఇల్లు',
    description: 'Read everyday words — vowel signs and doubles in the wild.',
    items: [
      { conceptId: 'word-milk', te: 'పాలు', tr: 'pālu', en: 'milk' },
      { conceptId: 'word-water', te: 'నీళ్లు', tr: 'nīḷḷu', en: 'water' },
      { conceptId: 'house-illu', te: 'ఇల్లు', tr: 'illu', en: 'house / home' },
      { conceptId: 'word-rice-food', te: 'అన్నం', tr: 'annam', en: 'rice / a meal' },
      { conceptId: 'word-fruit', te: 'పండు', tr: 'paṇḍu', en: 'fruit' },
    ],
  },
  {
    id: 'c6-u6-l3', unitId: 'c6-u6', title: 'Read: Long Words', teluguTitle: 'నమస్కారం తెలుగు',
    description: 'Longer words, one syllable at a time — including the big hello.',
    items: [
      { conceptId: 'word-telugu', te: 'తెలుగు', tr: 'telugu', en: 'Telugu (the language)' },
      { conceptId: 'greet-namaskaram', te: 'నమస్కారం', tr: 'namaskāram', en: 'hello / greetings' },
      { conceptId: 'place-badi', te: 'బడి', tr: 'baḍi', en: 'school' },
      { conceptId: 'place-gudi', te: 'గుడి', tr: 'guḍi', en: 'temple' },
      { conceptId: 'thanks', te: 'ధన్యవాదాలు', tr: 'dhanyavādālu', en: 'thank you' },
    ],
  },
];

const VATTU_LESSON = {
  id: 'c6-u5-l1', unitId: 'c6-u5', title: 'Double Letters', teluguTitle: 'వత్తులు',
  description: 'A small attached copy of a consonant doubles it: అక్క, అమ్మ, అన్నం.',
  items: [
    { te: 'క్క', roman: 'kka', slug: 'kka', parts: ['క', '్', 'క'], word: { te: 'అక్క', tr: 'akka', en: 'older sister' } },
    { te: 'మ్మ', roman: 'mma', slug: 'mma', parts: ['మ', '్', 'మ'], word: { te: 'అమ్మ', tr: 'amma', en: 'mother' } },
    { te: 'న్న', roman: 'nna', slug: 'nna', parts: ['న', '్', 'న'], word: { te: 'అన్నం', tr: 'annam', en: 'rice / a meal' } },
    { te: 'ల్ల', roman: 'lla', slug: 'lla-v', parts: ['ల', '్', 'ల'], word: { te: 'చెల్లి', tr: 'chelli', en: 'younger sister' } },
    { te: 'ట్ట', roman: 'ṭṭa', slug: 'tta-v', parts: ['ట', '్', 'ట'], word: { te: 'పట్టు', tr: 'paṭṭu', en: 'silk / hold' } },
    { te: 'ద్ద', roman: 'dda', slug: 'dda-v', parts: ['ద', '్', 'ద'], word: { te: 'పెద్ద', tr: 'pedda', en: 'big / elder' } },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VOCAB DATA — new vocabulary courses
// Each item: conceptId, te, tr, en (+ optional notes).
// sentence: { te (words joined by spaces = tiles), tr, en, blank (word to blank out) }
// ─────────────────────────────────────────────────────────────────────────────

const VOCAB_LESSONS = [
  // ── course-3: Numbers ──
  {
    id: 'c3-u1-l1', courseId: 'course-3', unitId: 'c3-u1', title: 'Numbers 1–5', teluguTitle: '౧ ౨ ౩ ౪ ౫',
    description: 'Count to five.',
    items: [
      { conceptId: 'num-1', te: 'ఒకటి', tr: 'okaṭi', en: 'one' },
      { conceptId: 'num-2', te: 'రెండు', tr: 'reṇḍu', en: 'two' },
      { conceptId: 'num-3', te: 'మూడు', tr: 'mūḍu', en: 'three' },
      { conceptId: 'num-4', te: 'నాలుగు', tr: 'nālugu', en: 'four' },
      { conceptId: 'num-5', te: 'ఐదు', tr: 'aidu', en: 'five' },
    ],
    sentence: { te: 'నాకు రెండు పండ్లు కావాలి', tr: 'nāku reṇḍu paṇḍlu kāvāli', en: 'I want two fruits', blank: 'రెండు' },
  },
  {
    id: 'c3-u1-l2', courseId: 'course-3', unitId: 'c3-u1', title: 'Numbers 6–10', teluguTitle: '౬ ౭ ౮ ౯ ౧౦',
    description: 'Count to ten.',
    items: [
      { conceptId: 'num-6', te: 'ఆరు', tr: 'āru', en: 'six' },
      { conceptId: 'num-7', te: 'ఏడు', tr: 'ēḍu', en: 'seven' },
      { conceptId: 'num-8', te: 'ఎనిమిది', tr: 'enimidi', en: 'eight' },
      { conceptId: 'num-9', te: 'తొమ్మిది', tr: 'tommidi', en: 'nine' },
      { conceptId: 'num-10', te: 'పది', tr: 'padi', en: 'ten' },
    ],
  },
  {
    id: 'c3-u1-l3', courseId: 'course-3', unitId: 'c3-u1', title: 'Numbers 11–15', teluguTitle: '౧౧–౧౫',
    description: 'The teens are built from పది (ten).',
    items: [
      { conceptId: 'num-11', te: 'పదకొండు', tr: 'padakoṇḍu', en: 'eleven' },
      { conceptId: 'num-12', te: 'పన్నెండు', tr: 'panneṇḍu', en: 'twelve' },
      { conceptId: 'num-13', te: 'పదమూడు', tr: 'padamūḍu', en: 'thirteen' },
      { conceptId: 'num-14', te: 'పద్నాలుగు', tr: 'padnālugu', en: 'fourteen' },
      { conceptId: 'num-15', te: 'పదిహేను', tr: 'padihēnu', en: 'fifteen' },
    ],
  },
  {
    id: 'c3-u1-l4', courseId: 'course-3', unitId: 'c3-u1', title: 'Tens & One Hundred', teluguTitle: 'ఇరవై నుంచి వంద వరకు',
    description: 'Twenty, thirty… up to one hundred.',
    items: [
      { conceptId: 'num-20', te: 'ఇరవై', tr: 'iravai', en: 'twenty' },
      { conceptId: 'num-30', te: 'ముప్పై', tr: 'muppai', en: 'thirty' },
      { conceptId: 'num-40', te: 'నలభై', tr: 'nalabhai', en: 'forty' },
      { conceptId: 'num-50', te: 'యాభై', tr: 'yābhai', en: 'fifty' },
      { conceptId: 'num-100', te: 'వంద', tr: 'vanda', en: 'one hundred' },
    ],
  },

  // ── course-2 expansion: Everyday Needs ──
  {
    id: 'c2-u1-l2', courseId: 'course-2', unitId: 'c2-u1', title: 'Food & Drink', teluguTitle: 'తిండి',
    description: 'The words you meet at every Telugu table.',
    items: [
      { conceptId: 'food-kura', te: 'కూర', tr: 'kūra', en: 'curry / vegetable dish' },
      { conceptId: 'food-pappu', te: 'పప్పు', tr: 'pappu', en: 'dal (lentils)' },
      { conceptId: 'food-perugu', te: 'పెరుగు', tr: 'perugu', en: 'yogurt' },
      { conceptId: 'food-rotte', te: 'రొట్టె', tr: 'roṭṭe', en: 'flatbread / roti' },
      { conceptId: 'food-karam', te: 'కారం', tr: 'kāram', en: 'spicy / chili heat' },
    ],
    sentence: { te: 'నాకు పప్పు కావాలి', tr: 'nāku pappu kāvāli', en: 'I want dal', blank: 'పప్పు' },
  },
  {
    id: 'c2-u1-l3', courseId: 'course-2', unitId: 'c2-u1', title: 'Likes & Dislikes', teluguTitle: 'ఇష్టం',
    description: 'Say what you like, what you don’t want, and when it’s enough.',
    items: [
      { conceptId: 'like-ishtam', te: 'నాకు ఇష్టం', tr: 'nāku iṣṭam', en: 'I like (it)' },
      { conceptId: 'want-vaddu', te: 'వద్దు', tr: 'vaddu', en: 'don’t want / no thanks' },
      { conceptId: 'more-inka', te: 'ఇంకా', tr: 'iṅkā', en: 'more / still' },
      { conceptId: 'enough-chalu', te: 'చాలు', tr: 'chālu', en: 'enough' },
      { conceptId: 'taste-ruchi', te: 'రుచి', tr: 'ruchi', en: 'taste' },
    ],
    sentence: { te: 'నాకు టీ ఇష్టం', tr: 'nāku ṭī iṣṭam', en: 'I like tea', blank: 'ఇష్టం' },
  },
  {
    id: 'c2-u2-l1', courseId: 'course-2', unitId: 'c2-u2', title: 'Around the House', teluguTitle: 'ఇంట్లో',
    description: 'House, room, door, window, bed.',
    items: [
      { conceptId: 'house-illu', te: 'ఇల్లు', tr: 'illu', en: 'house / home' },
      { conceptId: 'house-gadi', te: 'గది', tr: 'gadi', en: 'room' },
      { conceptId: 'house-talupu', te: 'తలుపు', tr: 'talupu', en: 'door' },
      { conceptId: 'house-kitiki', te: 'కిటికీ', tr: 'kiṭikī', en: 'window' },
      { conceptId: 'house-mancham', te: 'మంచం', tr: 'mañcham', en: 'bed' },
    ],
  },
  {
    id: 'c2-u2-l2', courseId: 'course-2', unitId: 'c2-u2', title: 'Colors', teluguTitle: 'రంగులు',
    description: 'The six colors you’ll use most.',
    items: [
      { conceptId: 'color-red', te: 'ఎరుపు', tr: 'erupu', en: 'red' },
      { conceptId: 'color-green', te: 'పచ్చ', tr: 'pachcha', en: 'green' },
      { conceptId: 'color-blue', te: 'నీలం', tr: 'nīlam', en: 'blue' },
      { conceptId: 'color-white', te: 'తెలుపు', tr: 'telupu', en: 'white', notes: 'Careful: తెలుపు (white) vs తలుపు (door)!' },
      { conceptId: 'color-black', te: 'నలుపు', tr: 'nalupu', en: 'black' },
      { conceptId: 'color-yellow', te: 'పసుపు', tr: 'pasupu', en: 'yellow / turmeric' },
    ],
  },

  // ── course-4: Days & Time ──
  {
    id: 'c4-u1-l1', courseId: 'course-4', unitId: 'c4-u1', title: 'Days: Monday–Thursday', teluguTitle: 'వారంలో రోజులు',
    description: 'The week begins. Every day ends in -వారం.',
    items: [
      { conceptId: 'day-mon', te: 'సోమవారం', tr: 'sōmavāram', en: 'Monday' },
      { conceptId: 'day-tue', te: 'మంగళవారం', tr: 'maṅgaḷavāram', en: 'Tuesday' },
      { conceptId: 'day-wed', te: 'బుధవారం', tr: 'budhavāram', en: 'Wednesday' },
      { conceptId: 'day-thu', te: 'గురువారం', tr: 'guruvāram', en: 'Thursday' },
    ],
  },
  {
    id: 'c4-u1-l2', courseId: 'course-4', unitId: 'c4-u1', title: 'Days: Friday–Sunday', teluguTitle: 'వారాంతం',
    description: 'Finish the week — plus the word for “week” itself.',
    items: [
      { conceptId: 'day-fri', te: 'శుక్రవారం', tr: 'śukravāram', en: 'Friday' },
      { conceptId: 'day-sat', te: 'శనివారం', tr: 'śanivāram', en: 'Saturday' },
      { conceptId: 'day-sun', te: 'ఆదివారం', tr: 'ādivāram', en: 'Sunday' },
      { conceptId: 'word-varam', te: 'వారం', tr: 'vāram', en: 'week' },
    ],
  },
  {
    id: 'c4-u2-l1', courseId: 'course-4', unitId: 'c4-u2', title: 'Today, Tomorrow, Yesterday', teluguTitle: 'ఈరోజు రేపు నిన్న',
    description: 'Place yourself in time.',
    items: [
      { conceptId: 'time-today', te: 'ఈరోజు', tr: 'īrōju', en: 'today' },
      { conceptId: 'time-tomorrow', te: 'రేపు', tr: 'rēpu', en: 'tomorrow' },
      { conceptId: 'time-yesterday', te: 'నిన్న', tr: 'ninna', en: 'yesterday' },
      { conceptId: 'time-now', te: 'ఇప్పుడు', tr: 'ippuḍu', en: 'now' },
      { conceptId: 'time-later', te: 'తరువాత', tr: 'taruvāta', en: 'later / afterwards' },
    ],
    sentence: { te: 'రేపు బడి లేదు', tr: 'rēpu baḍi lēdu', en: 'There is no school tomorrow', blank: 'రేపు' },
  },
  {
    id: 'c4-u2-l2', courseId: 'course-4', unitId: 'c4-u2', title: 'Morning to Night', teluguTitle: 'ఉదయం నుంచి రాత్రి వరకు',
    description: 'Times of day, hours and minutes, and asking “when?”.',
    items: [
      { conceptId: 'time-morning', te: 'ఉదయం', tr: 'udayam', en: 'morning' },
      { conceptId: 'time-night', te: 'రాత్రి', tr: 'rātri', en: 'night' },
      { conceptId: 'time-hour', te: 'గంట', tr: 'gaṇṭa', en: 'hour / o’clock' },
      { conceptId: 'time-minute', te: 'నిమిషం', tr: 'nimiṣam', en: 'minute' },
      { conceptId: 'q-when', te: 'ఎప్పుడు?', tr: 'eppuḍu?', en: 'when?' },
    ],
  },

  // ── course-5: People & Places ──
  {
    id: 'c5-u1-l1', courseId: 'course-5', unitId: 'c5-u1', title: 'Question Words', teluguTitle: 'ప్రశ్నలు',
    description: 'What, who, where, why, how — the keys to every conversation.',
    items: [
      { conceptId: 'q-what', te: 'ఏమిటి?', tr: 'ēmiṭi?', en: 'what?' },
      { conceptId: 'q-who', te: 'ఎవరు?', tr: 'evaru?', en: 'who?' },
      { conceptId: 'q-where', te: 'ఎక్కడ?', tr: 'ekkaḍa?', en: 'where?' },
      { conceptId: 'q-why', te: 'ఎందుకు?', tr: 'enduku?', en: 'why?' },
      { conceptId: 'q-how', te: 'ఎలా?', tr: 'elā?', en: 'how?' },
    ],
    sentence: { te: 'మీరు ఎక్కడ ఉన్నారు?', tr: 'mīru ekkaḍa unnāru?', en: 'Where are you?', blank: 'ఎక్కడ' },
  },
  {
    id: 'c5-u2-l1', courseId: 'course-5', unitId: 'c5-u2', title: 'Places in Town', teluguTitle: 'ఊళ్లో',
    description: 'School, temple, shop, hospital — and the town itself.',
    items: [
      { conceptId: 'place-uru', te: 'ఊరు', tr: 'ūru', en: 'village / hometown' },
      { conceptId: 'place-badi', te: 'బడి', tr: 'baḍi', en: 'school' },
      { conceptId: 'place-gudi', te: 'గుడి', tr: 'guḍi', en: 'temple' },
      { conceptId: 'place-dukanam', te: 'దుకాణం', tr: 'dukāṇam', en: 'shop / store' },
      { conceptId: 'place-asupatri', te: 'ఆసుపత్రి', tr: 'āsupatri', en: 'hospital' },
    ],
  },
  {
    id: 'c5-u2-l2', courseId: 'course-5', unitId: 'c5-u2', title: 'Here & There', teluguTitle: 'ఇక్కడ అక్కడ',
    description: 'Point at the world: here, there, near, far, left, right.',
    items: [
      { conceptId: 'dir-here', te: 'ఇక్కడ', tr: 'ikkaḍa', en: 'here' },
      { conceptId: 'dir-there', te: 'అక్కడ', tr: 'akkaḍa', en: 'there' },
      { conceptId: 'dir-near', te: 'దగ్గర', tr: 'daggara', en: 'near' },
      { conceptId: 'dir-far', te: 'దూరం', tr: 'dūram', en: 'far' },
      { conceptId: 'dir-right', te: 'కుడి', tr: 'kuḍi', en: 'right (side)' },
      { conceptId: 'dir-left', te: 'ఎడమ', tr: 'eḍama', en: 'left (side)' },
    ],
    sentence: { te: 'గుడి ఇక్కడ దగ్గర ఉంది', tr: 'guḍi ikkaḍa daggara undi', en: 'The temple is near here', blank: 'దగ్గర' },
  },

  // ── course-8: Doing Words ──
  {
    id: 'c8-u1-l1', courseId: 'course-8', unitId: 'c8-u1', title: 'Five First Verbs', teluguTitle: 'క్రియలు',
    description: 'Eat, drink, go, come, see — the verbs of daily life.',
    items: [
      { conceptId: 'verb-eat', te: 'తిను', tr: 'tinu', en: 'eat' },
      { conceptId: 'verb-drink', te: 'తాగు', tr: 'tāgu', en: 'drink' },
      { conceptId: 'verb-go', te: 'వెళ్ళు', tr: 'veḷḷu', en: 'go' },
      { conceptId: 'verb-come', te: 'రా', tr: 'rā', en: 'come' },
      { conceptId: 'verb-see', te: 'చూడు', tr: 'chūḍu', en: 'see / look' },
    ],
  },
  {
    id: 'c8-u1-l2', courseId: 'course-8', unitId: 'c8-u1', title: 'Polite Requests', teluguTitle: 'మర్యాద మాటలు',
    description: 'Add -ండి and any verb becomes a respectful request.',
    items: [
      { conceptId: 'req-randi', te: 'రండి', tr: 'raṇḍi', en: 'please come' },
      { conceptId: 'req-kurchondi', te: 'కూర్చోండి', tr: 'kūrchōṇḍi', en: 'please sit' },
      { conceptId: 'req-ivvandi', te: 'ఇవ్వండి', tr: 'ivvaṇḍi', en: 'please give' },
      { conceptId: 'req-cheppandi', te: 'చెప్పండి', tr: 'cheppaṇḍi', en: 'please tell / go ahead' },
      { conceptId: 'req-vinandi', te: 'వినండి', tr: 'vinaṇḍi', en: 'please listen' },
    ],
    sentence: { te: 'దయచేసి కూర్చోండి', tr: 'dayachēsi kūrchōṇḍi', en: 'Please sit down', blank: 'కూర్చోండి' },
  },
  // ── course-10: Building Blocks (grammar glue, right after First Conversations) ──
  {
    id: 'c10-u1-l1', courseId: 'course-10', unitId: 'c10-u1', title: 'I, You, He, She', teluguTitle: 'నేను నువ్వు మీరు',
    description: 'The little words every sentence starts with.',
    grammar: {
      title: 'Two words for “you”',
      body: 'Telugu has a casual you (నువ్వు) for friends and younger people, and a respectful you (మీరు) for elders and strangers. When in doubt, use మీరు — respect is never wrong.',
    },
    items: [
      { conceptId: 'pron-i', te: 'నేను', tr: 'nēnu', en: 'I' },
      { conceptId: 'pron-you', te: 'నువ్వు', tr: 'nuvvu', en: 'you (casual)' },
      { conceptId: 'pron-you-respectful', te: 'మీరు', tr: 'mīru', en: 'you (respectful)' },
      { conceptId: 'pron-he', te: 'అతను', tr: 'atanu', en: 'he' },
      { conceptId: 'pron-she', te: 'ఆమె', tr: 'āme', en: 'she' },
    ],
    sentences: [
      { te: 'నేను బాగున్నాను', tr: 'nēnu bāgunnānu', en: 'I am fine', blank: 'నేను' },
    ],
  },
  {
    id: 'c10-u1-l2', courseId: 'course-10', unitId: 'c10-u1', title: 'This & That', teluguTitle: 'ఇది అది',
    description: 'Point at anything and name it — no verb needed.',
    grammar: {
      title: 'No word for “is” needed',
      body: 'To say “this is a book”, Telugu just puts the two words together: ఇది పుస్తకం — literally “this, book”. Simple and everywhere.',
    },
    items: [
      { conceptId: 'pron-this', te: 'ఇది', tr: 'idi', en: 'this' },
      { conceptId: 'pron-that', te: 'అది', tr: 'adi', en: 'that' },
      { conceptId: 'q-which', te: 'ఏది?', tr: 'ēdi?', en: 'which one?' },
      { conceptId: 'word-book', te: 'పుస్తకం', tr: 'pustakam', en: 'book' },
    ],
    sentences: [
      { te: 'ఇది పుస్తకం', tr: 'idi pustakam', en: 'This is a book', blank: 'ఇది', note: 'No “is” needed: ఇది పుస్తకం is literally “this, book”.' },
      { te: 'అది ఇల్లు', tr: 'adi illu', en: 'That is a house', blank: 'అది' },
    ],
  },
  {
    id: 'c10-u1-l3', courseId: 'course-10', unitId: 'c10-u1', title: 'My & Your', teluguTitle: 'నా నీ మీ',
    description: 'You already say నా పేరు — here’s why it works.',
    grammar: {
      title: 'Ownership is one small word',
      body: 'నా = my, నీ = your (casual), మీ = your (respectful). They sit right before the thing owned: నా పేరు (my name), మీ ఇల్లు (your house).',
    },
    items: [
      { conceptId: 'poss-my', te: 'నా', tr: 'nā', en: 'my' },
      { conceptId: 'poss-your', te: 'నీ', tr: 'nī', en: 'your (casual)' },
      { conceptId: 'poss-your-resp', te: 'మీ', tr: 'mī', en: 'your (respectful)' },
      { conceptId: 'word-name', te: 'పేరు', tr: 'pēru', en: 'name' },
    ],
    sentences: [
      { te: 'మీ పేరు ఏమిటి?', tr: 'mī pēru ēmiṭi?', en: 'What is your name?', blank: 'మీ' },
      { te: 'నా పేరు రాము', tr: 'nā pēru rāmu', en: 'My name is Ramu', blank: 'నా' },
    ],
  },
  {
    id: 'c10-u1-l4', courseId: 'course-10', unitId: 'c10-u1', title: 'Is & There Is', teluguTitle: 'ఉంది ఉన్నాను',
    description: 'The being-verb ఉండు — where things and people are.',
    grammar: {
      title: 'ఉంది and its family',
      body: 'ఉంది = “it is / there is”. ఉన్నాను = “I am (somewhere)”. ఉన్నారు = “you are / they are” (respectful). And లేదు is its opposite: “there isn’t”.',
    },
    items: [
      { conceptId: 'be-undi', te: 'ఉంది', tr: 'undi', en: 'it is / there is' },
      { conceptId: 'be-unnanu', te: 'ఉన్నాను', tr: 'unnānu', en: 'I am (somewhere)' },
      { conceptId: 'be-unnaru', te: 'ఉన్నారు', tr: 'unnāru', en: 'you are / they are (respectful)' },
      { conceptId: 'loc-intlo', te: 'ఇంట్లో', tr: 'iṇṭlō', en: 'at home / in the house' },
      { conceptId: 'no-ledu', te: 'లేదు', tr: 'lēdu', en: 'no (there isn’t / didn’t)' },
    ],
    sentences: [
      { te: 'అమ్మ ఇంట్లో ఉంది', tr: 'amma iṇṭlō undi', en: 'Mom is at home', blank: 'ఉంది' },
    ],
  },
  {
    id: 'c10-u1-l5', courseId: 'course-10', unitId: 'c10-u1', title: 'To Me, To You', teluguTitle: 'నాకు నీకు మీకు',
    description: 'The pattern behind “I want” and “I like”.',
    grammar: {
      title: 'Wanting happens TO you',
      body: 'Telugu says “to me, water is wanted”: నాకు నీళ్లు కావాలి. That -కు on నాకు means “to”. You’ll see this pattern with wanting, liking, and feeling — it’s one of the most Telugu things about Telugu.',
    },
    items: [
      { conceptId: 'dat-naaku', te: 'నాకు', tr: 'nāku', en: 'to me' },
      { conceptId: 'dat-neeku', te: 'నీకు', tr: 'nīku', en: 'to you (casual)' },
      { conceptId: 'dat-meeku', te: 'మీకు', tr: 'mīku', en: 'to you (respectful)' },
      { conceptId: 'want-kavali', te: 'కావాలి', tr: 'kāvāli', en: 'want / need' },
    ],
    sentences: [
      { te: 'నాకు నీళ్లు కావాలి', tr: 'nāku nīḷḷu kāvāli', en: 'I want water', blank: 'నాకు', note: 'Literally “to me, water is wanted” — the wanter takes -కు.' },
    ],
  },

  // ── course-9: The World Around You ──
  {
    id: 'c9-u1-l1', courseId: 'course-9', unitId: 'c9-u1', title: 'Animals', teluguTitle: 'జంతువులు',
    description: 'Dog, cat, cow — the animals of every Telugu village.',
    items: [
      { conceptId: 'animal-dog', te: 'కుక్క', tr: 'kukka', en: 'dog' },
      { conceptId: 'animal-cat', te: 'పిల్లి', tr: 'pilli', en: 'cat' },
      { conceptId: 'animal-cow', te: 'ఆవు', tr: 'āvu', en: 'cow' },
      { conceptId: 'animal-bird', te: 'పక్షి', tr: 'pakṣi', en: 'bird' },
      { conceptId: 'animal-fish', te: 'చేప', tr: 'chēpa', en: 'fish' },
    ],
    sentences: [
      { te: 'కుక్క ఇంట్లో ఉంది', tr: 'kukka iṇṭlō undi', en: 'The dog is in the house', blank: 'కుక్క' },
    ],
  },
  {
    id: 'c9-u1-l2', courseId: 'course-9', unitId: 'c9-u1', title: 'Head to Toe', teluguTitle: 'తల నుంచి కాలు వరకు',
    description: 'Body words — you know తల from the script course already.',
    items: [
      { conceptId: 'body-head', te: 'తల', tr: 'tala', en: 'head' },
      { conceptId: 'body-eye', te: 'కన్ను', tr: 'kannu', en: 'eye' },
      { conceptId: 'body-hand', te: 'చెయ్యి', tr: 'cheyyi', en: 'hand' },
      { conceptId: 'body-leg', te: 'కాలు', tr: 'kālu', en: 'leg / foot' },
      { conceptId: 'body-mouth', te: 'నోరు', tr: 'nōru', en: 'mouth' },
    ],
  },
  {
    id: 'c9-u1-l3', courseId: 'course-9', unitId: 'c9-u1', title: 'Sun, Rain & Trees', teluguTitle: 'ప్రకృతి',
    description: 'Nature and weather small talk.',
    items: [
      { conceptId: 'nature-rain', te: 'వాన', tr: 'vāna', en: 'rain' },
      { conceptId: 'nature-sun', te: 'ఎండ', tr: 'eṇḍa', en: 'sunshine / heat' },
      { conceptId: 'nature-tree', te: 'చెట్టు', tr: 'cheṭṭu', en: 'tree' },
      { conceptId: 'nature-flower', te: 'పువ్వు', tr: 'puvvu', en: 'flower' },
      { conceptId: 'nature-sky', te: 'ఆకాశం', tr: 'ākāśam', en: 'sky' },
    ],
    sentences: [
      { te: 'ఈరోజు ఎండ ఉంది', tr: 'īrōju eṇḍa undi', en: 'It is sunny today', blank: 'ఎండ' },
    ],
  },

  // ── course-11: Making Sentences ──
  {
    id: 'c11-u1-l1', courseId: 'course-11', unitId: 'c11-u1', title: 'Verb Goes Last', teluguTitle: 'పద క్రమం',
    description: 'Telugu word order: who, then what, then the action.',
    grammar: {
      title: 'Subject — Object — Verb',
      body: 'English says “I drink milk”. Telugu says నేను పాలు తాగుతున్నాను — “I milk am-drinking”. The verb always comes last. Once this clicks, every sentence you build will sound right.',
    },
    items: [
      { conceptId: 'sent-milk-drink', te: 'నేను పాలు తాగుతున్నాను', tr: 'nēnu pālu tāgutunnānu', en: 'I am drinking milk' },
      { conceptId: 'sent-rice-eat', te: 'నేను అన్నం తింటున్నాను', tr: 'nēnu annam tiṇṭunnānu', en: 'I am eating rice' },
      { conceptId: 'sent-book-read', te: 'నేను పుస్తకం చదువుతున్నాను', tr: 'nēnu pustakam chaduvutunnānu', en: 'I am reading a book' },
      { conceptId: 'sent-school-go', te: 'నేను బడికి వెళ్తున్నాను', tr: 'nēnu baḍiki veḷtunnānu', en: 'I am going to school' },
    ],
    sentences: [
      { te: 'నేను పాలు తాగుతున్నాను', tr: 'nēnu pālu tāgutunnānu', en: 'I am drinking milk', blank: 'తాగుతున్నాను', note: 'The verb తాగుతున్నాను comes last — always.' },
      { te: 'నేను పుస్తకం చదువుతున్నాను', tr: 'nēnu pustakam chaduvutunnānu', en: 'I am reading a book', blank: 'పుస్తకం' },
    ],
  },
  {
    id: 'c11-u1-l2', courseId: 'course-11', unitId: 'c11-u1', title: 'One & Many', teluguTitle: 'బహువచనం',
    description: 'Make anything plural with -లు.',
    grammar: {
      title: 'The -లు ending',
      body: 'పండు (fruit) → పండ్లు (fruits). పుస్తకం (book) → పుస్తకాలు (books). గది (room) → గదులు (rooms). The ending bends a little to fit the word, but the -లు is always there.',
    },
    items: [
      { conceptId: 'plural-pandlu', te: 'పండ్లు', tr: 'paṇḍlu', en: 'fruits', notes: 'from పండు (fruit)' },
      { conceptId: 'plural-pustakalu', te: 'పుస్తకాలు', tr: 'pustakālu', en: 'books', notes: 'from పుస్తకం (book)' },
      { conceptId: 'plural-gadulu', te: 'గదులు', tr: 'gadulu', en: 'rooms', notes: 'from గది (room)' },
      { conceptId: 'plural-rojulu', te: 'రోజులు', tr: 'rōjulu', en: 'days', notes: 'from రోజు (day)' },
    ],
    sentences: [
      { te: 'నాకు రెండు పుస్తకాలు కావాలి', tr: 'nāku reṇḍu pustakālu kāvāli', en: 'I want two books', blank: 'పుస్తకాలు' },
    ],
  },
  {
    id: 'c11-u1-l3', courseId: 'course-11', unitId: 'c11-u1', title: 'And, Also, But', teluguTitle: 'మరియు కూడా కానీ',
    description: 'Join your words into bigger thoughts.',
    items: [
      { conceptId: 'conj-mariyu', te: 'మరియు', tr: 'mariyu', en: 'and', notes: 'Common in writing; in speech people often just pause instead.' },
      { conceptId: 'conj-kuda', te: 'కూడా', tr: 'kūḍā', en: 'also / too' },
      { conceptId: 'conj-kani', te: 'కానీ', tr: 'kānī', en: 'but' },
    ],
    sentences: [
      { te: 'అమ్మ మరియు నాన్న', tr: 'amma mariyu nānna', en: 'Mom and Dad', blank: 'మరియు' },
      { te: 'నాకు కూడా కావాలి', tr: 'nāku kūḍā kāvāli', en: 'I want (some) too', blank: 'కూడా' },
    ],
  },
  {
    id: 'c11-u1-l4', courseId: 'course-11', unitId: 'c11-u1', title: 'Asking Yes-or-No', teluguTitle: 'వస్తారా?',
    description: 'Turn any statement into a question with one sound.',
    grammar: {
      title: 'The magic -ā',
      body: 'Add -ా to the end of a verb and it becomes a question. వస్తారు (you will come) → వస్తారా? (will you come?). No “do” or “will” words needed — just the rising -ā.',
    },
    items: [
      { conceptId: 'gram-q-vastara', te: 'వస్తారా?', tr: 'vastārā?', en: 'will you come? (respectful)' },
      { conceptId: 'gram-q-tintara', te: 'తింటారా?', tr: 'tiṇṭārā?', en: 'will you eat? (respectful)' },
      { conceptId: 'gram-q-unnara', te: 'ఉన్నారా?', tr: 'unnārā?', en: 'are you there? (respectful)' },
      { conceptId: 'yes', te: 'అవును', tr: 'avunu', en: 'yes' },
    ],
    sentences: [
      { te: 'మీరు వస్తారా?', tr: 'mīru vastārā?', en: 'Will you come?', blank: 'వస్తారా?' },
    ],
  },
  {
    id: 'c11-u1-l5', courseId: 'course-11', unitId: 'c11-u1', title: 'Yesterday & Tomorrow', teluguTitle: 'వెళ్ళాను వెళ్తాను',
    description: 'A first taste of past and future.',
    grammar: {
      title: 'Past and future live in the verb ending',
      body: 'వెళ్తాను = I will go. వెళ్ళాను = I went. తింటాను = I will eat. తిన్నాను = I ate. Same verb, different tail — pair them with నిన్న (yesterday) and రేపు (tomorrow) and you can tell time-travel stories.',
    },
    items: [
      { conceptId: 'verb-went', te: 'వెళ్ళాను', tr: 'veḷḷānu', en: 'I went' },
      { conceptId: 'verb-will-go', te: 'వెళ్తాను', tr: 'veḷtānu', en: 'I will go' },
      { conceptId: 'verb-ate', te: 'తిన్నాను', tr: 'tinnānu', en: 'I ate' },
      { conceptId: 'verb-will-come', te: 'వస్తాను', tr: 'vastānu', en: 'I will come' },
    ],
    sentences: [
      { te: 'నిన్న బడికి వెళ్ళాను', tr: 'ninna baḍiki veḷḷānu', en: 'Yesterday I went to school', blank: 'వెళ్ళాను' },
      { te: 'రేపు వస్తాను', tr: 'rēpu vastānu', en: 'I will come tomorrow', blank: 'రేపు' },
    ],
  },

  {
    id: 'c8-u1-l3', courseId: 'course-8', unitId: 'c8-u1', title: 'I Am Doing…', teluguTitle: 'నేను చేస్తున్నాను',
    description: 'Whole sentences: what you are doing right now.',
    items: [
      { conceptId: 'sent-eating', te: 'నేను తింటున్నాను', tr: 'nēnu tiṇṭunnānu', en: 'I am eating' },
      { conceptId: 'sent-going', te: 'నేను వెళ్తున్నాను', tr: 'nēnu veḷtunnānu', en: 'I am going' },
      { conceptId: 'sent-drinking', te: 'నేను నీళ్లు తాగుతున్నాను', tr: 'nēnu nīḷḷu tāgutunnānu', en: 'I am drinking water' },
      { conceptId: 'sent-reading', te: 'నేను చదువుతున్నాను', tr: 'nēnu chaduvutunnānu', en: 'I am reading / studying' },
    ],
    sentence: { te: 'నేను అన్నం తింటున్నాను', tr: 'nēnu annam tiṇṭunnānu', en: 'I am eating rice', blank: 'తింటున్నాను' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────────────────────

const audioPath = (courseId, unitId, slug) => `audio/${courseId}/${unitId}/${slug}-normal.mp3`;

function lessonShell(id, courseId, unitId, meta, conceptIds, exercises, kind) {
  return {
    id, courseId, unitId,
    title: meta.title,
    teluguTitle: meta.teluguTitle,
    description: meta.description,
    estimatedMinutes: Math.max(4, Math.min(10, Math.round(exercises.length * 0.8))),
    status: 'draft',
    difficulty: 'beginner',
    learnerPaths: ['complete-beginner', 'heritage-learner', 'family'],
    prerequisites: [],
    conceptIds,
    newConceptLimit: Math.max(4, conceptIds.length),
    kind,
    exercises,
    author: 'seed-content',
    updatedAt: TODAY,
  };
}

/** pick k distractors from pool (objects), excluding index i */
function others(pool, i, k) {
  const out = [];
  for (let d = 1; out.length < k && d <= pool.length; d++) out.push(pool[(i + d) % pool.length]);
  return out;
}

function makeLetterLesson(def) {
  const courseId = 'course-6';
  const L = def.letters;
  const ex = [];
  let n = 0;
  const eid = () => `${def.id}-e${++n}`;

  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    const ds = others(L, i, 2);
    ex.push({
      id: eid(), type: 'script_build', mode: 'identify',
      conceptIds: [`script-${l.slug}`],
      prompt: `This is ${l.te} — it says “${l.roman}”${l.hint ? ` (${l.hint})` : ''}. Which one is ${l.te}?`,
      choices: [
        { id: 'a', telugu: l.te },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te, whyWrong: `${d.te} says “${d.roman}”.` })),
      ],
      correctChoiceIds: ['a'],
    });
    if (i % 2 === 1) {
      ex.push({
        id: eid(), type: 'listen_select',
        conceptIds: [`script-${l.slug}`],
        prompt: 'Listen. Which letter do you hear?',
        audio: { normal: audioPath(courseId, def.unitId, `letter-${l.slug}`) },
        spoken: { telugu: l.te, transliteration: l.roman },
        choices: [
          { id: 'a', telugu: l.te },
          ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te })),
        ],
        correctChoiceIds: ['a'],
      });
    }
    if (l.word) {
      const contains = l.wordMode === 'contains';
      ex.push({
        id: eid(), type: 'multiple_choice',
        conceptIds: [`script-${l.slug}`],
        prompt: `${l.word.te} (${l.word.tr}) means “${l.word.en}”. Which letter does it ${contains ? 'contain' : 'start with'}?`,
        question: { telugu: l.word.te, transliteration: l.word.tr, english: l.word.en },
        choices: [
          { id: 'a', telugu: l.te },
          ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te })),
        ],
        correctChoiceIds: ['a'],
      });
    }
  }

  // Production (R4): hear a letter, produce it from the lesson's letter set.
  for (const l of [L[0], L[Math.min(2, L.length - 1)]]) {
    ex.push({
      id: eid(), type: 'dictation',
      conceptIds: [`script-${l.slug}`],
      prompt: 'Listen, then write the letter you hear.',
      audio: { normal: audioPath(courseId, def.unitId, `letter-${l.slug}`) },
      spoken: { telugu: l.te, transliteration: l.roman },
      acceptedAnswers: [l.te],
      tiles: L.map((x) => x.te),
    });
  }

  const pairsSource = def.reviewLetters ?? L;
  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-transliteration',
    conceptIds: L.map((l) => `script-${l.slug}`),
    prompt: 'Match each letter to its sound.',
    pairs: pairsSource.slice(0, 5).map((l) => ({ a: { telugu: l.te }, b: { telugu: l.roman } })),
  });
  if (pairsSource.length > 5) {
    ex.push({
      id: eid(), type: 'match_pairs', mode: 'telugu-transliteration',
      conceptIds: L.map((l) => `script-${l.slug}`),
      prompt: 'One more round — match letter to sound.',
      pairs: pairsSource.slice(5, 10).map((l) => ({ a: { telugu: l.te }, b: { telugu: l.roman } })),
    });
  }

  return lessonShell(def.id, courseId, def.unitId, def, L.map((l) => `script-${l.slug}`), ex, 'script');
}

function makeGunintaLesson(def) {
  const courseId = 'course-6';
  const items = def.items;
  const ex = [];
  let n = 0;
  const eid = () => `${def.id}-e${++n}`;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const base = it.base ?? 'క';
    const ds = others(items, i, 2);
    ex.push({
      id: eid(), type: 'script_build', mode: 'combine',
      conceptIds: [`script-gun-${it.slug}`],
      prompt: `${base} + the sign ${it.sign === 'ం' ? 'ం' : it.sign} = ? It sounds like “${it.roman}”.`,
      parts: [base, it.sign],
      choices: [
        { id: 'a', telugu: it.example, transliteration: it.roman },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.example, whyWrong: `${d.example} is “${d.roman}” — that uses the sign ${d.sign}.` })),
      ],
      correctChoiceIds: ['a'],
    });
    if (it.word && it.word.en) {
      ex.push({
        id: eid(), type: 'multiple_choice',
        conceptIds: [`script-gun-${it.slug}`],
        prompt: `${it.word.te} (${it.word.tr}) means “${it.word.en}”. Which sound does it start with?`,
        question: { telugu: it.word.te, transliteration: it.word.tr, english: it.word.en },
        choices: [
          { id: 'a', telugu: it.example, transliteration: it.roman },
          ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.example })),
        ],
        correctChoiceIds: ['a'],
      });
    }
  }
  // Production: hear a syllable, build it from the lesson's syllables.
  for (const it of [items[0], items[Math.min(3, items.length - 1)]]) {
    ex.push({
      id: eid(), type: 'dictation',
      conceptIds: [`script-gun-${it.slug}`],
      prompt: 'Listen, then write the syllable you hear.',
      audio: { normal: audioPath(courseId, def.unitId, `syl-${it.slug}`) },
      spoken: { telugu: it.example, transliteration: it.roman },
      acceptedAnswers: [it.example],
      tiles: items.map((x) => x.example),
    });
  }

  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-transliteration',
    conceptIds: items.map((it) => `script-gun-${it.slug}`),
    prompt: 'Match each syllable to its sound.',
    pairs: items.slice(0, 5).map((it) => ({ a: { telugu: it.example }, b: { telugu: it.roman } })),
  });
  if (items.length > 5) {
    ex.push({
      id: eid(), type: 'match_pairs', mode: 'telugu-transliteration',
      conceptIds: items.map((it) => `script-gun-${it.slug}`),
      prompt: 'And the rest — match syllable to sound.',
      pairs: items.slice(5, 10).map((it) => ({ a: { telugu: it.example }, b: { telugu: it.roman } })),
    });
  }
  return lessonShell(def.id, courseId, def.unitId, def, items.map((it) => `script-gun-${it.slug}`), ex, 'script');
}

function makeReadingLesson(def) {
  const courseId = 'course-6';
  const items = def.items;
  const ex = [];
  let n = 0;
  const eid = () => `${def.id}-e${++n}`;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const ds = others(items, i, 2);
    if (i % 2 === 0) {
      // read → meaning (no transliteration shown: real reading practice)
      ex.push({
        id: eid(), type: 'multiple_choice',
        conceptIds: [it.conceptId],
        prompt: 'Read this word. What does it mean?',
        question: { telugu: it.te },
        choices: [
          { id: 'a', english: it.en },
          ...ds.map((d, j) => ({ id: 'bc'[j], english: d.en, whyWrong: `“${d.en}” is ${d.te} (${d.tr}).` })),
        ],
        correctChoiceIds: ['a'],
      });
    } else {
      // read → sound
      ex.push({
        id: eid(), type: 'multiple_choice',
        conceptIds: [it.conceptId],
        prompt: 'Read this word. How does it sound?',
        question: { telugu: it.te },
        choices: [
          { id: 'a', english: it.tr },
          ...ds.map((d, j) => ({ id: 'bc'[j], english: d.tr, whyWrong: `“${d.tr}” is ${d.te}.` })),
        ],
        correctChoiceIds: ['a'],
      });
    }
  }
  // hear it, find it in writing
  const l0 = items[0];
  ex.push({
    id: eid(), type: 'listen_select',
    conceptIds: [l0.conceptId],
    prompt: 'Listen, then find the written word.',
    audio: { normal: audioPath(courseId, def.unitId, l0.conceptId) },
    spoken: { telugu: l0.te, transliteration: l0.tr },
    choices: [
      { id: 'a', telugu: l0.te },
      ...others(items, 0, 2).map((d, j) => ({ id: 'bc'[j], telugu: d.te })),
    ],
    correctChoiceIds: ['a'],
  });
  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-english',
    conceptIds: items.map((it) => it.conceptId),
    prompt: 'Match each written word to its meaning.',
    pairs: items.slice(0, 5).map((it) => ({ a: { telugu: it.te }, b: { telugu: it.en } })),
  });
  // Production: hear a word, write it (Telugu keyboard or romanized).
  const w = items[1];
  ex.push({
    id: eid(), type: 'dictation',
    conceptIds: [w.conceptId],
    prompt: 'Listen, then type the word.',
    audio: { normal: audioPath(courseId, def.unitId, w.conceptId) },
    spoken: { telugu: w.te, transliteration: w.tr },
    acceptedAnswers: [w.te, w.tr.toLowerCase(), w.tr.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()],
  });

  return lessonShell(def.id, courseId, def.unitId, def, items.map((it) => it.conceptId), ex, 'script');
}

function makeVattuLesson(def) {
  const courseId = 'course-6';
  const items = def.items;
  const ex = [];
  let n = 0;
  const eid = () => `${def.id}-e${++n}`;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const ds = others(items, i, 2);
    ex.push({
      id: eid(), type: 'script_build', mode: 'combine',
      conceptIds: [`script-vattu-${it.slug}`],
      prompt: `${it.parts[0]} + ్ + ${it.parts[2]} makes a doubled “${it.roman}”. Which is it?`,
      parts: it.parts,
      choices: [
        { id: 'a', telugu: it.te, transliteration: it.roman },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te, whyWrong: `${d.te} is the doubled “${d.roman}”.` })),
      ],
      correctChoiceIds: ['a'],
    });
    ex.push({
      id: eid(), type: 'multiple_choice',
      conceptIds: [`script-vattu-${it.slug}`],
      prompt: `${it.word.te} (${it.word.tr}) means “${it.word.en}”. Which doubled letter is inside it?`,
      question: { telugu: it.word.te, transliteration: it.word.tr, english: it.word.en },
      choices: [
        { id: 'a', telugu: it.te, transliteration: it.roman },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te })),
      ],
      correctChoiceIds: ['a'],
    });
  }
  // Production: hear a doubled sound, build it.
  for (const it of [items[0], items[2]]) {
    ex.push({
      id: eid(), type: 'dictation',
      conceptIds: [`script-vattu-${it.slug}`],
      prompt: 'Listen, then write the double letter you hear.',
      audio: { normal: audioPath(courseId, def.unitId, `vattu-${it.slug}`) },
      spoken: { telugu: it.te, transliteration: it.roman },
      acceptedAnswers: [it.te],
      tiles: items.map((x) => x.te),
    });
  }
  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-transliteration',
    conceptIds: items.map((it) => `script-vattu-${it.slug}`),
    prompt: 'Match each double letter to its sound.',
    pairs: items.slice(0, 5).map((it) => ({ a: { telugu: it.te }, b: { telugu: it.roman } })),
  });
  return lessonShell(def.id, courseId, def.unitId, def, items.map((it) => `script-vattu-${it.slug}`), ex, 'script');
}

function makeVocabLesson(def) {
  const items = def.items;
  const ex = [];
  let n = 0;
  const eid = () => `${def.id}-e${++n}`;
  const slugOf = (it) => it.conceptId.replace(/[^a-z0-9-]/gi, '');

  const listen = (i) => {
    const it = items[i];
    const ds = others(items, i, 2);
    return {
      id: eid(), type: 'listen_select',
      conceptIds: [it.conceptId],
      prompt: 'Listen. What did you hear?',
      audio: { normal: audioPath(def.courseId, def.unitId, slugOf(it)) },
      spoken: { telugu: it.te, transliteration: it.tr, english: it.en },
      choices: [
        { id: 'a', telugu: it.te, transliteration: it.tr },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te, transliteration: d.tr })),
      ],
      correctChoiceIds: ['a'],
    };
  };
  const sayIt = (i) => {
    const it = items[i];
    const ds = others(items, i, 2);
    return {
      id: eid(), type: 'multiple_choice',
      conceptIds: [it.conceptId],
      prompt: `How do you say “${it.en}”?`,
      choices: [
        { id: 'a', telugu: it.te, transliteration: it.tr },
        ...ds.map((d, j) => ({ id: 'bc'[j], telugu: d.te, transliteration: d.tr, whyWrong: `${d.te} means “${d.en}”.` })),
      ],
      correctChoiceIds: ['a'],
    };
  };
  const meaning = (i) => {
    const it = items[i];
    const ds = others(items, i, 2);
    return {
      id: eid(), type: 'multiple_choice',
      conceptIds: [it.conceptId],
      prompt: 'What does this mean?',
      question: { telugu: it.te, transliteration: it.tr },
      choices: [
        { id: 'a', english: it.en },
        ...ds.map((d, j) => ({ id: 'bc'[j], english: d.en, whyWrong: `“${d.en}” is ${d.te}.` })),
      ],
      correctChoiceIds: ['a'],
    };
  };

  ex.push(listen(0));
  ex.push(sayIt(1));
  ex.push(listen(2 % items.length));
  ex.push({
    id: eid(), type: 'match_pairs', mode: 'telugu-english',
    conceptIds: items.slice(0, 4).map((it) => it.conceptId),
    prompt: 'Match the pairs.',
    pairs: items.slice(0, 4).map((it) => ({ a: { telugu: it.te, transliteration: it.tr }, b: { telugu: it.en } })),
  });
  ex.push(meaning(3 % items.length));
  if (items.length > 4) ex.push(sayIt(4));

  const sentences = def.sentences ?? (def.sentence ? [def.sentence] : []);
  for (const s of sentences) {
    const words = s.te.split(' ');
    const blankSentence = words.map((w) => (w === s.blank ? '___' : w)).join(' ');
    const wrongWords = [...new Set(items.map((it) => it.te.split(' ').pop()))]
      .filter((w) => w && w !== s.blank && !words.includes(w)).slice(0, 2);
    ex.push({
      id: eid(), type: 'fill_blank',
      conceptIds: items.slice(0, 2).map((it) => it.conceptId),
      prompt: 'Complete the sentence.',
      sentence: { telugu: blankSentence, transliteration: s.tr, english: s.en },
      answer: s.blank,
      choices: [s.blank, ...wrongWords],
      ...(s.note ? { feedback: { grammar: s.note } } : {}),
    });
    ex.push({
      id: eid(), type: 'word_tiles', direction: 'to-telugu',
      conceptIds: items.slice(0, 2).map((it) => it.conceptId),
      prompt: 'Build the sentence in Telugu.',
      source: { telugu: s.te, transliteration: s.tr, english: s.en },
      tiles: words,
    });
  }

  ex.push({
    id: eid(), type: 'translate', direction: 'to-english',
    conceptIds: [items[0].conceptId],
    prompt: 'Translate to English.',
    source: { telugu: items[0].te, transliteration: items[0].tr },
    acceptedAnswers: [...new Set([
      items[0].en,
      ...items[0].en.split(/\s*\/\s*/),
      items[0].en.replace(/\s*\([^)]*\)/g, '').trim(),
      ...(items[0].enAlt ?? []),
    ])].filter(Boolean),
  });

  const shell = lessonShell(def.id, def.courseId, def.unitId, def, items.map((it) => it.conceptId), ex, 'standard');
  if (def.grammar) {
    shell.grammarNotes = [{ id: `${def.id}-g1`, title: def.grammar.title, body: def.grammar.body }];
  }
  return shell;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

const lessons = [
  ...LETTER_LESSONS.map(makeLetterLesson),
  ...GUNINTA_LESSONS.map(makeGunintaLesson),
  makeVattuLesson(VATTU_LESSON),
  ...READING_LESSONS.map(makeReadingLesson),
  ...VOCAB_LESSONS.map(makeVocabLesson),
];

// New concepts implied by the lessons
const newConcepts = [];
for (const def of LETTER_LESSONS) {
  for (const l of def.letters) {
    newConcepts.push({
      id: `script-${l.slug}`, telugu: l.te, transliteration: l.roman,
      english: `the letter ${l.roman}`, ...(l.hint ? { notes: l.hint } : {}),
    });
  }
}
for (const def of GUNINTA_LESSONS) {
  for (const it of def.items) {
    newConcepts.push({
      id: `script-gun-${it.slug}`, telugu: it.example, transliteration: it.roman,
      english: `the syllable ${it.roman} (${it.base ?? 'క'} + vowel sign)`,
    });
  }
}
for (const it of VATTU_LESSON.items) {
  newConcepts.push({
    id: `script-vattu-${it.slug}`, telugu: it.te, transliteration: it.roman,
    english: `the doubled ${it.roman}`, notes: `as in ${it.word.te} (${it.word.en})`,
  });
}
for (const def of [...READING_LESSONS, ...VOCAB_LESSONS]) {
  for (const it of def.items) {
    newConcepts.push({
      id: it.conceptId, telugu: it.te, transliteration: it.tr, english: it.en,
      ...(it.notes ? { notes: it.notes } : {}),
    });
  }
}

const concepts = JSON.parse(readFileSync(conceptsPath, 'utf8'));
const have = new Set(concepts.map((c) => c.id));
let added = 0;
for (const c of newConcepts) {
  if (!have.has(c.id)) { concepts.push(c); have.add(c.id); added++; }
}
writeFileSync(conceptsPath, JSON.stringify(concepts, null, 2) + '\n');

for (const lesson of lessons) {
  writeFileSync(join(lessonsDir, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + '\n');
}

console.log(`✅ wrote ${lessons.length} lessons, added ${added} concepts (total ${concepts.length})`);
console.log('   lesson ids:', lessons.map((l) => l.id).join(', '));
