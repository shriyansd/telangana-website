// Answer normalization and matching. Telugu text uses combining marks, so all
// comparison is done on NFC-normalized strings, and any per-character work uses
// grapheme clusters (Intl.Segmenter with a fallback), never raw code units.

const PUNCT = /[.,!?;:"'’‘“”()\-–—?।|]/g;

export function normalizeAnswer(s: string, opts: { caseSensitive?: boolean } = {}): string {
  let out = s.normalize('NFC').replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

/** True if the given answer matches any accepted answer after normalization. */
export function matchesAnswer(given: string, accepted: string[], opts: { caseSensitive?: boolean } = {}): boolean {
  const g = normalizeAnswer(given, opts);
  if (!g) return false;
  return accepted.some((a) => normalizeAnswer(a, opts) === g);
}

/** Token-level comparison: same tokens in the same order (whitespace-insensitive). */
export function matchesTokens(given: string, accepted: string[]): boolean {
  const tok = (s: string) => normalizeAnswer(s).split(' ').filter(Boolean).join(' ');
  const g = tok(given);
  return accepted.some((a) => tok(a) === g);
}

/** Split a string into grapheme clusters (safe for Telugu conjuncts and matras). */
export function graphemes(s: string): string[] {
  const norm = s.normalize('NFC');
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const seg = new (Intl as any).Segmenter('te', { granularity: 'grapheme' });
    return Array.from(seg.segment(norm), (x: any) => x.segment);
  }
  // Fallback: keep combining marks (U+0C00–U+0C7F dependent signs, ZWJ, virama chains) attached
  const out: string[] = [];
  for (const ch of norm) {
    const code = ch.codePointAt(0)!;
    const isCombining =
      (code >= 0x0c3e && code <= 0x0c56) || code === 0x0c00 || code === 0x0c01 ||
      code === 0x0c02 || code === 0x0c03 || code === 0x0c4d || code === 0x200d;
    const prev = out[out.length - 1];
    if (isCombining && prev) out[out.length - 1] = prev + ch;
    else if (prev && prev.endsWith('్') && code >= 0x0c15 && code <= 0x0c39) out[out.length - 1] = prev + ch;
    else out.push(ch);
  }
  return out;
}

/** Length in graphemes — for UI sizing decisions, never for slicing raw strings. */
export function graphemeLength(s: string): number {
  return graphemes(s).length;
}

/** Small diff hint: first grapheme index where two Telugu strings differ. */
export function firstDifference(a: string, b: string): number {
  const ga = graphemes(a);
  const gb = graphemes(b);
  const n = Math.min(ga.length, gb.length);
  for (let i = 0; i < n; i++) if (ga[i] !== gb[i]) return i;
  return ga.length === gb.length ? -1 : n;
}

/** Grapheme-level Levenshtein distance (bounded use only — see classifyAnswer). */
export function graphemeEditDistance(a: string, b: string): number {
  const ga = graphemes(a);
  const gb = graphemes(b);
  const dp: number[] = Array.from({ length: gb.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ga.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= gb.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (ga[i - 1] === gb[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[gb.length];
}

import type { AnswerResult, ErrorType } from '../types/progress';

/**
 * Graded answer evaluation (R6/R13): exact/alternative match, then a *narrow*
 * typo window (edit distance 1, answers of 4+ graphemes only — no unrestricted
 * fuzzy matching), then word-order detection. Deterministic; no LLM.
 */
export function classifyAnswer(given: string, accepted: string[]): AnswerResult {
  if (!normalizeAnswer(given)) return 'incorrect';
  if (accepted.length === 0) return 'incorrect';
  const g = normalizeAnswer(given);
  const norms = accepted.map((a) => normalizeAnswer(a));
  if (g === norms[0]) return 'correct';
  if (norms.includes(g)) return 'correct-alternative';

  // Narrow typo tolerance: one grapheme off on reasonably long answers.
  for (const a of norms) {
    if (graphemeLength(a) >= 4 && graphemeEditDistance(g, a) === 1) return 'nearly-correct-typo';
  }

  // Same words, different order (multi-word answers only).
  const bag = (s: string) => s.split(' ').filter(Boolean).sort().join(' ');
  for (const a of norms) {
    if (a.includes(' ') && bag(a) === bag(g)) return 'wrong-word-order';
  }

  return 'incorrect';
}

/** Whether a graded result should count as a correct retrieval. */
export function resultIsCorrect(result: AnswerResult): boolean {
  return result === 'correct' || result === 'correct-alternative' || result === 'nearly-correct-typo';
}

/** Map a wrong result + exercise type to an error category for practice targeting. */
export function errorTypeFor(result: AnswerResult, exerciseType: string): ErrorType {
  if (result === 'wrong-word-order') return 'word-order';
  if (result === 'wrong-formality') return 'formality';
  switch (exerciseType) {
    case 'listen_select': return 'listening-confusion';
    case 'sound_compare': return 'sound-contrast';
    case 'script_build': return 'script-confusion';
    case 'dictation': return 'spelling';
    case 'word_tiles': return 'word-order';
    case 'fill_blank':
    case 'translate': return 'meaning-confusion';
    case 'multiple_choice':
    case 'image_match':
    case 'match_pairs':
    case 'categorize':
    case 'story_checkpoint': return 'meaning-confusion';
    default: return 'unknown';
  }
}
