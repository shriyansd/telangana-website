import { Link } from '../router';

export function About() {
  return (
    <div className="about-page">
      <h1>About Telugu Bata</h1>
      <p>
        <strong>Telugu Bata</strong> (బాట — “path”) is a free, open, interactive Telugu course built by the{' '}
        <a href="../">Telangana Initiative</a>, a youth-led nonprofit. It exists so that anyone — especially
        heritage kids who understand their grandparents but can't answer back — has a serious, joyful way to learn.
      </p>

      <h2>How the method works</h2>
      <ul>
        <li><strong>Active recall</strong> — you retrieve words and patterns instead of re-reading them.</li>
        <li><strong>Spaced review</strong> — each concept has a mastery score; it returns just before you'd forget it (1 → 3 → 7 → 14 → 30 → 60 days, sooner after mistakes).</li>
        <li><strong>Context first</strong> — words are taught inside useful sentences (నాకు ___ కావాలి), then you swap pieces.</li>
        <li><strong>Input and output</strong> — every unit mixes listening and reading with speaking, typing, and sentence-building.</li>
        <li><strong>Kind feedback</strong> — wrong answers get an explanation, not a buzzer. No lives, no shame.</li>
      </ul>

      <h2>Standard Telugu, real regions</h2>
      <p>
        Core lessons teach Standard Telugu. Telangana and Andhra Pradesh regional forms appear as clearly
        labelled culture notes and alternatives — never as “mistakes”.
      </p>

      <h2>Why native-speaker review matters</h2>
      <p>
        Every lesson carries a review status. Content marked <em>draft</em> or <em>needs-review</em> was written by
        contributors and hasn't yet been verified by fluent speakers — it's shown during this early period so you can
        learn and help us improve, but treat it accordingly. Audio will be recorded by native speakers; where a
        recording is missing you'll hear a clearly labelled synthetic placeholder (or none).
      </p>

      <h2>Help us make it better</h2>
      <ul>
        <li>🗣️ <strong>Record audio</strong> — native speakers can contribute word and sentence recordings.</li>
        <li>🔎 <strong>Review lessons</strong> — fluent readers can verify draft content.</li>
        <li>🐛 <strong>Report an issue</strong> — every lesson has a “Report a language issue” link.</li>
      </ul>
      <p>
        Write to us: <a href="mailto:sanjudmail@gmail.com?subject=Telugu%20Bata%20contribution">sanjudmail@gmail.com</a>
      </p>

      <h2>Privacy</h2>
      <ul>
        <li>No account, no name, no email, no age collected.</li>
        <li>Progress is stored only in your browser (IndexedDB). Export/import it yourself in <Link to="settings">Settings</Link>.</li>
        <li>No ads, no analytics trackers, no sale of data — there is no data to sell.</li>
        <li>Microphone recordings stay in memory on your device and are discarded after each exercise.</li>
        <li>The optional “experimental transcription” uses your browser's built-in speech service; your browser vendor may process that audio. It is off by default.</li>
      </ul>

      <h2>Accessibility</h2>
      <p>
        Exercises work with keyboard alone, tiles work without drag-and-drop, audio always has replay and post-answer
        transcripts, correctness is never shown by color alone, and text size and reduced motion are adjustable in Settings.
        Found a barrier? Please tell us.
      </p>

      <h2>Inspiration & credits</h2>
      <p>
        Telugu Bata is an original, independent project, but its learning design stands on public
        research and ideas whose originators deserve credit:
      </p>
      <ul className="about-credits">
        <li><strong>Second-language research</strong> — spaced practice (Kim &amp; Webb 2022), retrieval practice (Nakata 2016, 2017; Terai et al. 2021), explicit instruction (Norris &amp; Ortega 2000), corrective feedback (Li 2010; Lyster &amp; Saito 2010), interaction (Loewen &amp; Sato 2018), meaning-focused input (Webb et al. 2023), phonetic training (Uchihara et al. 2025), desirable difficulties (Bjork &amp; Bjork 2011), keyword mnemonics (Atkinson &amp; Raugh 1975), heritage-learner curriculum (Kondo-Brown 2010; Chevalier).</li>
        <li><strong>Duolingo</strong> — publicly described method principles (communication-goal units, recognition-before-production, mistake resurfacing). No branding, content, artwork, or algorithms were copied.</li>
        <li><strong>Anki / SuperMemo</strong> — the idea of flagging repeatedly-missed items ("leeches") for a different strategy, behind our Tricky Words.</li>
        <li><strong>Memrise</strong> — learner-written mnemonics, behind our Memory Hooks.</li>
        <li><strong>Pimsleur</strong> — graduated-interval recall and audio-first anticipation, ancestors of our review ladder and speaking flow.</li>
        <li><strong>CEFR</strong> (Council of Europe) — the action-oriented, can-do framing of unit goals. This course is CEFR-informed, not CEFR-certified.</li>
      </ul>
      <p>
        The full annotated source list, including what each source actually claims and where we
        diverge, lives in the project's <code>docs/learning-science.md</code>.
      </p>

      <p className="about-footer">
        <Link to="dashboard" className="btn-primary">Back to learning →</Link>
      </p>
    </div>
  );
}
