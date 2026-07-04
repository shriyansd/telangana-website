import { describe, it, expect } from 'vitest';
import { normalizeAnswer, matchesAnswer, matchesTokens, graphemes, graphemeLength, firstDifference } from '../src/lib/answers';

describe('answer normalization', () => {
  it('ignores case, punctuation, and extra spaces for English', () => {
    expect(matchesAnswer('  How are YOU? ', ['how are you'])).toBe(true);
    expect(matchesAnswer('hello!', ['Hello'])).toBe(true);
  });

  it('does not accept wrong words', () => {
    expect(matchesAnswer('how are they', ['how are you'])).toBe(false);
    expect(matchesAnswer('', ['hello'])).toBe(false);
  });

  it('accepts any of several accepted answers', () => {
    expect(matchesAnswer('grandpa', ['grandfather', 'grandpa'])).toBe(true);
  });

  it('normalizes Telugu with NFC and ignores Telugu punctuation', () => {
    expect(matchesAnswer('నమస్కారం.', ['నమస్కారం'])).toBe(true);
    expect(matchesAnswer('మీ పేరు ఏమిటి?', ['మీ పేరు ఏమిటి'])).toBe(true);
  });

  it('token comparison is whitespace-insensitive', () => {
    expect(matchesTokens('నాకు  నీళ్లు   కావాలి', ['నాకు నీళ్లు కావాలి'])).toBe(true);
    expect(matchesTokens('నీళ్లు నాకు కావాలి', ['నాకు నీళ్లు కావాలి'])).toBe(false);
  });

  it('normalizeAnswer trims and lowercases', () => {
    expect(normalizeAnswer(' Hello,  World! ')).toBe('hello world');
  });
});

describe('Telugu grapheme handling', () => {
  it('keeps matras attached to their consonant', () => {
    const g = graphemes('కా');
    expect(g).toHaveLength(1);
    expect(g[0]).toBe('కా');
  });

  it('keeps conjuncts (vattu) together', () => {
    // అమ్మ = అ + మ్మ (మ + virama + మ)
    expect(graphemeLength('అమ్మ')).toBe(2);
  });

  it('counts full words sensibly', () => {
    expect(graphemeLength('నమస్కారం')).toBeLessThan('నమస్కారం'.length);
  });

  it('finds the first differing grapheme', () => {
    expect(firstDifference('కా', 'కి')).toBe(0);
    expect(firstDifference('అమ్మ', 'అమ్మ')).toBe(-1);
    expect(firstDifference('అమ్మ', 'అమ్మా')).toBeGreaterThanOrEqual(1);
  });
});

import { classifyAnswer, resultIsCorrect, errorTypeFor, graphemeEditDistance } from '../src/lib/answers';

describe('graded answer classification (v2)', () => {
  it('exact and alternative answers', () => {
    expect(classifyAnswer('నమస్కారం', ['నమస్కారం'])).toBe('correct');
    expect(classifyAnswer('bye', ['goodbye', 'bye'])).toBe('correct-alternative');
  });

  it('narrow typo window: one grapheme off on long answers only', () => {
    expect(classifyAnswer('namaskarm', ['namaskaram'])).toBe('nearly-correct-typo');
    // short answers get no typo tolerance
    expect(classifyAnswer('పలు', ['పాలు'])).toBe('incorrect');
  });

  it('detects word order errors without accepting them as correct', () => {
    const r = classifyAnswer('కావాలి నాకు నీళ్లు', ['నాకు నీళ్లు కావాలి']);
    expect(r).toBe('wrong-word-order');
    expect(resultIsCorrect(r)).toBe(false);
  });

  it('does not fuzzy-match genuinely wrong answers', () => {
    expect(classifyAnswer('వెళ్ళొస్తాను', ['నమస్కారం'])).toBe('incorrect');
    expect(classifyAnswer('', ['నమస్కారం'])).toBe('incorrect');
  });

  it('grapheme edit distance is cluster-aware', () => {
    expect(graphemeEditDistance('కా', 'కి')).toBe(1);
    expect(graphemeEditDistance('అమ్మ', 'అమ్మ')).toBe(0);
  });

  it('maps errors to practice categories', () => {
    expect(errorTypeFor('wrong-word-order', 'translate')).toBe('word-order');
    expect(errorTypeFor('incorrect', 'listen_select')).toBe('listening-confusion');
    expect(errorTypeFor('incorrect', 'dictation')).toBe('spelling');
  });
});
