// Live sessions: book a 30-minute weekend slot with a real teacher. The
// calendar itself is Cal.com's, embedded below; everything around it exists so
// a learner in any timezone can see when the sessions actually are on their own
// clock — the times are fixed in Pacific wall-clock time, which drifts against
// the rest of the world twice a year.

import { useEffect, useMemo, useState } from 'react';
import { Link } from '../router';
import { useApp } from '../AppContext';
import { nextOccurrence, formatDate, formatTime, zoneAbbrev, localZone } from '../lib/timezone';

const CAL_URL = 'https://cal.com/bookaglove/learn-telugu';
const PACIFIC = 'America/Los_Angeles';
const SESSION_DAYS = [6, 0]; // Saturday & Sunday
const START_HOUR = 7; // first slot starts 7:00 AM Pacific
const END_HOUR = 9; // last slot ends 9:00 AM Pacific
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const UPCOMING_SHOWN = 3;

interface SessionDay {
  start: Date;
  end: Date;
  slots: Date[];
}

/** The next few session mornings, each expanded into its bookable 30-min slots. */
function upcomingSessions(from = new Date()): SessionDay[] {
  const days: SessionDay[] = [];
  let cursor = from;
  for (let i = 0; i < UPCOMING_SHOWN; i++) {
    const start = nextOccurrence(SESSION_DAYS, START_HOUR, 0, PACIFIC, cursor);
    if (!start) break;
    const slots = Array.from({ length: SLOTS_PER_DAY }, (_, s) => new Date(start.getTime() + s * SLOT_MINUTES * 60000));
    days.push({ start, end: new Date(start.getTime() + (END_HOUR - START_HOUR) * 3600000), slots });
    cursor = new Date(start.getTime() + 60000); // step past this morning
  }
  return days;
}

export function LiveSessions() {
  const { settings } = useApp();
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  // Mirror App's theme resolution rather than reading the DOM: child effects run
  // before the parent's, so document.dataset.theme lags by one change here.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(mq?.matches ?? false);
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && prefersDark);

  // Intl is everywhere now, but a broken/absent timezone database shouldn't take
  // the booking page down with it — fall back to the Pacific times in prose.
  const { days, myZone, sameZone } = useMemo(() => {
    try {
      const zone = localZone();
      return { days: upcomingSessions(), myZone: zone, sameZone: zone === PACIFIC };
    } catch {
      return { days: [] as SessionDay[], myZone: '', sameZone: true };
    }
  }, []);

  const calSrc = `${CAL_URL}?theme=${dark ? 'dark' : 'light'}&overlayCalendar=true`;

  return (
    <div className="live-page">
      <section className="live-hero">
        <h1>🎥 Book a live session</h1>
        <p className="live-sub">
          Thirty minutes with a real person: ask the questions the app can't answer,
          practise speaking out loud, and get your pronunciation corrected kindly.
          Free, like everything else here.
        </p>
        <a className="btn-primary big" href={CAL_URL} target="_blank" rel="noopener noreferrer">
          Pick a time →
        </a>
      </section>

      <section className="live-when" aria-label="Session times">
        <div className="live-when-facts">
          <div className="live-fact">
            <span className="live-fact-icon" aria-hidden="true">📅</span>
            <strong>Saturdays & Sundays</strong>
            <span>Every weekend</span>
          </div>
          <div className="live-fact">
            <span className="live-fact-icon" aria-hidden="true">🕖</span>
            <strong>7:00 – 9:00 AM</strong>
            <span>Pacific time (California)</span>
          </div>
          <div className="live-fact">
            <span className="live-fact-icon" aria-hidden="true">⏱️</span>
            <strong>30 minutes</strong>
            <span>Four slots each morning</span>
          </div>
        </div>

        {days.length > 0 && (
          <div className="live-local">
            <h2>
              {sameZone ? 'Next sessions' : 'Next sessions, in your time'}
              {!sameZone && myZone && <span className="live-zone-chip">{myZone.replace(/_/g, ' ')} · {zoneAbbrev(days[0].start)}</span>}
            </h2>
            <ul className="live-days">
              {days.map((d) => (
                <li key={d.start.toISOString()} className="live-day">
                  <div className="live-day-head">
                    <strong>{formatDate(d.start)}</strong>
                    <span className="live-day-range">{formatTime(d.start)} – {formatTime(d.end)}</span>
                  </div>
                  {!sameZone && (
                    <p className="live-day-note">
                      {formatDate(d.start, PACIFIC)} morning in California
                    </p>
                  )}
                  <div className="live-slots">
                    {d.slots.map((t) => (
                      <span className="live-slot" key={t.toISOString()}>{formatTime(t)}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <p className="live-local-note">
              Times are worked out from your device's clock and timezone
              {myZone && !sameZone ? ` (${myZone.replace(/_/g, ' ')})` : ''}. The calendar below
              always shows and books in your own timezone too, and these slots are the
              possible times, not a guarantee every one is still free.
            </p>
          </div>
        )}
      </section>

      <section className="live-booking" aria-label="Booking calendar">
        <h2>Choose your slot</h2>
        {!online ? (
          <div className="live-offline" role="status">
            <p>📴 You're offline. The booking calendar needs a connection.</p>
            <p>Reconnect and reload, or go to <a href={CAL_URL} target="_blank" rel="noopener noreferrer">cal.com/bookaglove/learn-telugu</a> when you're back online.</p>
          </div>
        ) : (
          <>
            <div className="live-embed">
              {/* Plain booking URL rather than Cal's embed script: no third-party
                  JS in the app, and the service worker ignores cross-origin
                  requests, so this passes straight through. */}
              <iframe key={calSrc} src={calSrc} title="Book a live Telugu session" loading="lazy" />
            </div>
            <p className="live-embed-fallback">
              Calendar not loading? <a href={CAL_URL} target="_blank" rel="noopener noreferrer">Open it in a new tab →</a>
            </p>
          </>
        )}
      </section>

      <section className="live-expect">
        <h2>What happens in a session</h2>
        <ul className="live-expect-list">
          <li>🗣️ <strong>You talk, mostly.</strong> Short warm-up, then real conversation at whatever level you're at, even if that's five words.</li>
          <li>🩹 <strong>Bring your stuck points.</strong> A sound you can't make, a sentence that never comes out right, a letter that won't stick.</li>
          <li>👵 <strong>Family Telugu welcome.</strong> Want to understand what అమ్మమ్మ says on the phone? Bring that. Regional forms are not mistakes here.</li>
          <li>📧 <strong>After you book</strong>, you'll get a confirmation email with the joining details. Can't make it? Cancel or reschedule from that same email.</li>
        </ul>
      </section>

      <section className="live-prep">
        <h2>Worth doing before you come</h2>
        <ul className="live-prep-list">
          <li><Link to="placement">Take the 3-minute placement check</Link> so we can pitch the session at the right level.</li>
          <li><Link to="mistakes">Glance at your tricky words</Link>: those are the best things to spend a live half-hour on.</li>
          <li>New to the script? Even ten minutes in <Link to="trace">writing practice</Link> makes the session go further.</li>
        </ul>
        <p className="live-privacy">
          🔒 Booking is handled by Cal.com, so they'll ask for your name and email and their
          privacy terms apply to that. Nothing from your learning progress is sent. That
          still never leaves this device. <Link to="about">More about privacy</Link>.
        </p>
      </section>
    </div>
  );
}
