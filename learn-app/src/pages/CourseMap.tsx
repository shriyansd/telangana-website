import { useEffect, useMemo, useState } from 'react';
import { Link } from '../router';
import { courses, loadAllLessons, statusVisible } from '../content';
import { getAllLessonProgress } from '../lib/storage';
import { useApp } from '../AppContext';
import type { Lesson } from '../types/content';
import type { LessonProgress } from '../types/progress';

type LessonState = 'available' | 'completed' | 'mastered' | 'in-progress';

const COURSE_ICONS: Record<string, string> = {
  'course-0': '🧭',
  'course-6': 'అ',
  'course-1': '💬',
  'course-3': '🔢',
  'course-2': '🍚',
  'course-4': '🗓️',
  'course-5': '🏘️',
  'course-8': '🏃',
  'course-7': '👵',
  'course-10': '🧱',
  'course-9': '🌳',
  'course-11': '🪡',
};

const ACCENTS = ['#D95F0A', '#006E6D', '#C8880A', '#5C1415', '#3D6B35', '#8A4FA3'];

export function CourseMap() {
  const { settings } = useApp();
  const [lessons, setLessons] = useState<Map<string, Lesson>>(new Map());
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [all, prog] = await Promise.all([loadAllLessons(), getAllLessonProgress()]);
      setLessons(new Map(all.map((l) => [l.id, l])));
      setProgress(new Map(prog.map((p) => [p.lessonId, p])));
      setLoaded(true);
    })();
  }, []);

  const stateOf = (id: string): LessonState => {
    const p = progress.get(id);
    if (!p) return 'available';
    if (p.status === 'mastered') return 'mastered';
    if (p.status === 'completed') return 'completed';
    if (p.status === 'in-progress') return 'in-progress';
    return 'available';
  };

  const kindIcon = (kind?: string) =>
    kind === 'story' ? '📖' : kind === 'script' ? '✍️' : kind === 'listening' ? '🎧' : kind === 'checkpoint' ? '🏁' : '📘';

  const visibleIds = (lessonIds: string[]) =>
    lessonIds.filter((lid) => {
      const l = lessons.get(lid);
      return l && statusVisible(l.status, settings.showDraftContent);
    });

  // The first course with an unfinished lesson starts expanded.
  const currentCourseId = useMemo(() => {
    if (!loaded) return null;
    for (const course of courses) {
      for (const unit of course.units) {
        for (const lid of visibleIds(unit.lessonIds)) {
          const st = stateOf(lid);
          if (st === 'available' || st === 'in-progress') return course.id;
        }
      }
    }
    return courses[0]?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lessons, progress]);

  if (!loaded) return <div className="course-map"><p className="muted">Loading…</p></div>;

  const totalDone = [...progress.values()].filter((p) => p.status === 'completed' || p.status === 'mastered').length;
  const totalLessons = courses.reduce((n, c) => n + c.units.reduce((m, u) => m + visibleIds(u.lessonIds).length, 0), 0);

  return (
    <div className="course-map">
      <header className="map-head">
        <h1>Course map</h1>
        <p className="map-note">
          {totalDone}/{totalLessons} lessons done · everything is open, nothing is locked
        </p>
      </header>

      {courses.map((course, ci) => {
        const ids = course.units.flatMap((u) => visibleIds(u.lessonIds));
        if (ids.length === 0) return null;
        const done = ids.filter((id) => ['completed', 'mastered'].includes(stateOf(id))).length;
        const pct = Math.round((done / ids.length) * 100);
        const accent = ACCENTS[ci % ACCENTS.length];
        return (
          <details
            key={course.id}
            className="mc"
            open={course.id === currentCourseId}
            style={{ ['--accent' as string]: accent }}
          >
            <summary className="mc-summary">
              <span className="mc-icon" aria-hidden="true">{COURSE_ICONS[course.id] ?? '📘'}</span>
              <span className="mc-titles">
                <strong>{course.title}</strong>
                {course.teluguTitle && <span className="mc-telugu" lang="te">{course.teluguTitle}</span>}
              </span>
              <span className="mc-right">
                <span className="mc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.title} progress`}>
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="mc-count">{done}/{ids.length}</span>
                <span className="mc-chevron" aria-hidden="true">▾</span>
              </span>
            </summary>
            <div className="mc-body">
              {course.units.map((unit) => {
                const uIds = visibleIds(unit.lessonIds);
                if (uIds.length === 0) return null;
                return (
                  <div key={unit.id} className="mc-unit">
                    {course.units.length > 1 && <h3 className="mc-unit-title">{unit.title}</h3>}
                    <div className="mc-lessons">
                      {uIds.map((lid) => {
                        const lesson = lessons.get(lid)!;
                        const st = stateOf(lid);
                        return (
                          <Link key={lid} to={`lesson/${lid}`} className={`mc-lesson ${st}`}>
                            <span className="mc-node" aria-hidden="true">
                              {st === 'mastered' ? '🌟' : st === 'completed' ? '✓' : kindIcon(lesson.kind)}
                            </span>
                            <span className="mc-lesson-title">{lesson.title}</span>
                            <span className="mc-lesson-min">
                              {lesson.estimatedMinutes} min
                              {lesson.status !== 'published' && (
                                <i className="mc-draft" title="Awaiting native-speaker review" aria-label="draft: awaiting native-speaker review" />
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      <p className="map-footnote">
        <i className="mc-draft" aria-hidden="true" /> = awaiting native-speaker review · more units land as review completes
      </p>
    </div>
  );
}
