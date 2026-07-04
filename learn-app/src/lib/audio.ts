// Audio playback with graceful fallbacks:
// 1. Native-speaker recording (static file) — the primary source.
// 2. If no recording exists and the learner allows it, browser speechSynthesis
//    (free, on-device/OS voice) clearly labelled as a synthetic placeholder.
// 3. Otherwise a "recording coming soon" state — never a crash.

import type { AudioRef } from '../types/content';
import { getSettings } from './storage';

export type PlayResult = 'file' | 'synth' | 'unavailable';

let currentAudio: HTMLAudioElement | null = null;

function resolveUrl(path: string): string {
  // content paths are relative to the app base (/learn/)
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  return path.startsWith('http') ? path : base + path.replace(/^\//, '');
}

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function playFile(url: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    stopAudio();
    const audio = new Audio(url);
    audio.playbackRate = rate;
    currentAudio = audio;
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().then(() => { /* playing */ }).catch(() => resolve(false));
  });
}

let teluguVoice: SpeechSynthesisVoice | null | undefined;

function findTeluguVoice(): SpeechSynthesisVoice | null {
  if (teluguVoice !== undefined) return teluguVoice;
  if (!('speechSynthesis' in window)) { teluguVoice = null; return null; }
  const voices = window.speechSynthesis.getVoices();
  teluguVoice =
    voices.find((v) => v.lang?.toLowerCase().startsWith('te')) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('hi')) ?? // closer than English if te missing
    null;
  return teluguVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { teluguVoice = undefined; };
}

function playSynth(telugu: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const voice = findTeluguVoice();
    if (!voice) { resolve(false); return; }
    stopAudio();
    const u = new SpeechSynthesisUtterance(telugu);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = rate * 0.9;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.speak(u);
  });
}

/**
 * Play the audio for a prompt. `telugu` is the text spoken, used for the
 * synthetic fallback. Returns how the audio was produced so the UI can label it.
 */
export async function playPrompt(
  audio: AudioRef | undefined,
  telugu: string,
  opts: { slow?: boolean } = {},
): Promise<PlayResult> {
  const settings = getSettings();
  const baseRate = settings.audioRate;
  const rate = opts.slow ? Math.min(baseRate, 0.7) : baseRate;

  const file = opts.slow ? audio?.slow ?? audio?.normal : audio?.normal;
  if (file) {
    const ok = await playFile(resolveUrl(file), opts.slow && !audio?.slow ? 0.7 : rate);
    if (ok) return 'file';
  }
  if (settings.synthFallback && telugu) {
    const ok = await playSynth(telugu, opts.slow ? 0.6 : 1);
    if (ok) return 'synth';
  }
  return 'unavailable';
}

/** Whether any audio (file or synthetic) is likely available for a prompt. */
export function audioAvailable(audio: AudioRef | undefined, telugu: string): boolean {
  if (audio?.normal) return true;
  const settings = getSettings();
  return settings.synthFallback && !!telugu && !!findTeluguVoice();
}
