import { useEffect, useState } from 'react';
import { Link } from '../router';
import { useApp } from '../AppContext';
import { getAllLessonProgress } from '../lib/storage';

export function Landing() {
  const { profile } = useApp();
  const [hasProgress, setHasProgress] = useState(false);
  useEffect(() => {
    getAllLessonProgress().then((l) => setHasProgress(l.length > 0)).catch(() => {});
  }, []);

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="hero-telugu" lang="te" aria-hidden="true">తెలుగు నేర్చుకుందాం</div>
        <h1>Learn Telugu, <em>for real.</em></h1>
        <p className="hero-sub">
          Free interactive lessons — listen, speak, read the script, build sentences,
          and talk with your family. No account. No ads. No paywall. Ever.
        </p>
        <div className="hero-actions">
          {hasProgress || profile.onboarded ? (
            <>
              <Link to="dashboard" className="btn-primary big">Continue learning →</Link>
              <Link to="onboarding" className="btn-ghost">Restart setup</Link>
            </>
          ) : (
            <>
              <Link to="onboarding" className="btn-primary big">Start learning — it's free</Link>
              <Link to="map" className="btn-ghost">Browse the course first</Link>
            </>
          )}
        </div>
        <p className="hero-note">Works offline once loaded · Progress stays on your device</p>
      </section>

      <section className="landing-paths">
        <div className="path-card">
          <h2>🌱 Completely new to Telugu?</h2>
          <p>Start speaking from lesson one — useful phrases first, script step by step, native-speaker audio throughout. Short lessons that fit in a chai break.</p>
        </div>
        <div className="path-card">
          <h2>🏡 Grew up hearing Telugu?</h2>
          <p>The heritage path is built for you: understand fast family speech, finally read the script, and answer అమ్మమ్మ in full sentences — without re-learning words you already know.</p>
        </div>
      </section>

      <section className="landing-features">
        <h2>How Telugu Bata teaches</h2>
        <ul className="feature-grid">
          <li>🎧 <strong>Listen & choose</strong> — train your ear with real recordings</li>
          <li>🧩 <strong>Build sentences</strong> — arrange word tiles, not memorize lists</li>
          <li>🎙️ <strong>Speak & compare</strong> — record yourself beside the model</li>
          <li>✍️ <strong>Read the script</strong> — అ to క్ష, one letter family at a time</li>
          <li>🔁 <strong>Smart review</strong> — mistakes come back exactly when you'd forget them</li>
          <li>🏮 <strong>Culture built in</strong> — Telangana & Andhra context, festivals, and family life</li>
        </ul>
      </section>

      <section className="landing-privacy">
        <h2>Free means free</h2>
        <p>
          Telugu Bata is a community project by the Telangana Initiative. There are no ads, no lives to lose,
          no subscription — and your learning data never leaves your device unless you export it yourself.
        </p>
        <p>
          <Link to="about">About the course & method</Link> · <Link to="settings">Privacy & settings</Link>
        </p>
      </section>
    </div>
  );
}
