// Speech recognition adapter. The interface is provider-agnostic so a future
// open-source Telugu ASR service can be slotted in behind the same contract.
// Today the only provider is the browser's built-in Web Speech API, feature-
// detected, optional, and labelled experimental — never required to pass.

export interface SpeechRecognizer {
  readonly name: string;
  readonly experimental: boolean;
  /** Resolve with the best transcript, or null if nothing recognized. */
  listen(langHint: string, timeoutMs?: number): Promise<string | null>;
  abort(): void;
}

class BrowserSpeechRecognizer implements SpeechRecognizer {
  readonly name = 'browser';
  readonly experimental = true;
  private active: any = null;

  listen(langHint: string, timeoutMs = 8000): Promise<string | null> {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return Promise.resolve(null);
    return new Promise((resolve) => {
      const rec = new Ctor();
      this.active = rec;
      rec.lang = langHint;
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      let done = false;
      const finish = (v: string | null) => { if (!done) { done = true; this.active = null; resolve(v); } };
      const timer = setTimeout(() => { try { rec.abort(); } catch { /* ignore */ } finish(null); }, timeoutMs);
      rec.onresult = (e: any) => {
        clearTimeout(timer);
        finish(e.results?.[0]?.[0]?.transcript ?? null);
      };
      rec.onerror = () => { clearTimeout(timer); finish(null); };
      rec.onend = () => { clearTimeout(timer); finish(null); };
      try { rec.start(); } catch { clearTimeout(timer); finish(null); }
    });
  }

  abort(): void {
    try { this.active?.abort(); } catch { /* ignore */ }
    this.active = null;
  }
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function getSpeechRecognizer(): SpeechRecognizer | null {
  return speechRecognitionSupported() ? new BrowserSpeechRecognizer() : null;
}
