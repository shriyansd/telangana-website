// Tiny synthesized sound effects via WebAudio — no audio files, no network.
// Callers gate on settings.soundEffects; these functions fail silently where
// AudioContext is unavailable.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, startSec: number, durSec: number, type: OscillatorType = 'sine', peak = 0.12) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + startSec;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + durSec + 0.05);
}

/** gentle rising two-note chime */
export function sfxCorrect(): void {
  tone(523.25, 0, 0.16);
  tone(783.99, 0.09, 0.24);
}

/** soft low thud — kind, not punishing */
export function sfxWrong(): void {
  tone(196, 0, 0.22, 'triangle', 0.09);
}

/** little ascending arpeggio for finishing a session */
export function sfxComplete(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.3));
}

/** faint tick for timers */
export function sfxTick(): void {
  tone(880, 0, 0.05, 'square', 0.04);
}
