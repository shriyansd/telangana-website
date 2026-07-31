import { useEffect } from 'react';
import { useRoute } from './router';
import { useApp } from './AppContext';
import { Landing } from './pages/Landing';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { CourseMap } from './pages/CourseMap';
import { LessonPlayer } from './pages/LessonPlayer';
import { Review } from './pages/Review';
import { Mistakes } from './pages/Mistakes';
import { ScriptPractice } from './pages/ScriptPractice';
import { TracePractice } from './pages/TracePractice';
import { Stories } from './pages/Stories';
import { StoryPlayer } from './pages/StoryPlayer';
import { LiveSessions } from './pages/LiveSessions';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { Lightning } from './pages/Lightning';
import { Words } from './pages/Words';
import { Placement } from './pages/Placement';
import { NavBar } from './pages/NavBar';

export function App() {
  const route = useRoute();
  const { settings, loaded } = useApp();

  useEffect(() => {
    document.documentElement.dataset.textScale = settings.textScale;
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? 'on' : 'off';
  }, [settings.textScale, settings.reducedMotion]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [settings.theme]);

  useEffect(() => { window.scrollTo(0, 0); }, [route.path]);

  const [page, ...rest] = route.parts;
  const inLesson = page === 'lesson' || page === 'story';

  const body = (() => {
    if (!loaded) return <div className="page-loading" role="status">Loading…</div>;
    switch (page) {
      case undefined:
      case '': return <Landing />;
      case 'onboarding': return <Onboarding />;
      case 'dashboard': return <Dashboard />;
      case 'map': return <CourseMap />;
      case 'lesson': return rest[0] ? <LessonPlayer lessonId={rest[0]} /> : <Dashboard />;
      case 'review': return <Review mode="due" />;
      case 'practice-mistakes': return <Review mode="mistakes" />;
      case 'mistakes': return <Mistakes />;
      case 'script': return <ScriptPractice />;
      case 'trace': return <TracePractice conceptId={rest[0]} />;
      case 'stories': return <Stories />;
      case 'story': return rest[0] ? <StoryPlayer storyId={rest[0]} /> : <Stories />;
      case 'live': return <LiveSessions />;
      case 'settings': return <Settings />;
      case 'about': return <About />;
      case 'lightning': return <Lightning />;
      case 'words': return <Words />;
      case 'placement': return <Placement />;
      default: return <Landing />;
    }
  })();

  return (
    <div className="app">
      {!inLesson && <NavBar current={page ?? ''} />}
      <main className={inLesson ? 'main-lesson' : 'main-page'}>{body}</main>
    </div>
  );
}
