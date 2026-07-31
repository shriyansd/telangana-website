import { Link } from '../router';
import { useApp } from '../AppContext';

const TABS: { key: string; to: string; label: string; icon: string }[] = [
  { key: 'dashboard', to: 'dashboard', label: 'Learn', icon: '🏠' },
  { key: 'map', to: 'map', label: 'Course', icon: '🗺️' },
  { key: 'review', to: 'review', label: 'Review', icon: '🔁' },
  { key: 'script', to: 'script', label: 'Script', icon: 'అ' },
  { key: 'stories', to: 'stories', label: 'Stories', icon: '📖' },
  { key: 'live', to: 'live', label: 'Live', icon: '🎥' },
  { key: 'settings', to: 'settings', label: 'You', icon: '⚙️' },
];

export function NavBar({ current }: { current: string }) {
  const { xp, streak } = useApp();
  return (
    <>
      <header className="topbar">
        <Link to="" className="brand">
          <span className="brand-mark" lang="te">బాట</span>
          <span className="brand-name">Telugu Bata</span>
        </Link>
        <div className="topbar-stats" aria-label="Your stats">
          {streak && streak.current > 0 && <span className="stat-chip" title={`${streak.current}-day streak`}>🔥 {streak.current}</span>}
          {xp && <span className="stat-chip" title="Total XP">⭐ {xp.total}</span>}
          <a href="../" className="back-to-site" title="Back to Telangana Initiative">↩ Main site</a>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main navigation">
        {TABS.map((t) => (
          <Link key={t.key} to={t.to} className={`tab-link ${current === t.key ? 'on' : ''}`} aria-current={current === t.key ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
