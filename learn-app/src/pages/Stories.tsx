import { useEffect, useState } from 'react';
import { Link } from '../router';
import { loadStories, statusVisible } from '../content';
import { useApp } from '../AppContext';
import { getKV } from '../lib/storage';
import type { Story } from '../types/content';

export function Stories() {
  const { settings } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await loadStories();
      setStories(all.filter((s) => statusVisible(s.status, settings.showDraftContent)));
      const completed = await getKV<string[]>('stories-completed', []);
      setDone(new Set(completed));
      setLoaded(true);
    })();
  }, [settings.showDraftContent]);

  if (!loaded) return <div className="page-loading" role="status">Loading stories…</div>;

  return (
    <div className="stories-page">
      <h1>Stories & dialogues</h1>
      <p>Short, replayable stories with comprehension checks along the way.</p>
      <div className="story-list">
        {stories.map((s) => (
          <Link key={s.id} to={`story/${s.id}`} className="story-card">
            <span className="story-icon">{done.has(s.id) ? '✅' : '📖'}</span>
            <div>
              <strong>{s.title}</strong>
              {s.teluguTitle && <span lang="te" className="story-telugu">{s.teluguTitle}</span>}
              <p>{s.description}</p>
              {s.status !== 'published' && <em className="draft-tag">{s.status}</em>}
            </div>
          </Link>
        ))}
        {stories.length === 0 && <p>No stories available yet — check back soon!</p>}
      </div>
    </div>
  );
}
