// Local-first learner progress. Stored in IndexedDB; small prefs in localStorage.
// Versioned so future schema changes can migrate old data (see lib/storage.ts).

export const PROGRESS_SCHEMA_VERSION = 2;
// v1 → v2: additive. ConceptMastery gained per-skill `skills` records and
// ExerciseAttempt gained skillDimension/supportLevel/errorType. Old records
// remain valid; missing fields are treated as empty.

/** Which ability an exercise gives evidence about (H1: skills tracked separately). */
export type SkillDimension =
  | 'meaning'
  | 'listening'
  | 'reading'
  | 'supported-production'
  | 'independent-production'
  | 'script'
  | 'pronunciation-perception'
  | 'communicative-use';

/** How much help the learner had (R4: recognition → production progression). */
export type SupportLevel =
  | 'full-model'
  | 'recognition'
  | 'guided-recall'
  | 'partial-production'
  | 'independent-production'
  | 'transfer';

/** Classified error categories for targeted feedback and practice (R6). */
export type ErrorType =
  | 'meaning-confusion'
  | 'listening-confusion'
  | 'sound-contrast'
  | 'script-confusion'
  | 'spelling'
  | 'word-order'
  | 'case-or-ending'
  | 'verb-form'
  | 'formality'
  | 'missing-word'
  | 'extra-word'
  | 'translation-variation'
  | 'unknown';

/** Graded answer evaluation result (never plain string equality). */
export type AnswerResult =
  | 'correct'
  | 'correct-alternative'
  | 'nearly-correct-typo'
  | 'meaning-correct-form-wrong'
  | 'wrong-formality'
  | 'wrong-word-order'
  | 'incorrect';

/** Per-skill evidence inside a concept's mastery record. */
export interface SkillMasteryEntry {
  score: number; // 0..100
  successes: number;
  failures: number;
  lastAttemptAt: string | null;
}

/** 'auto' fades transliteration to tap-to-reveal once script reading grows (H2). */
export type TransliterationMode = 'always' | 'tap' | 'never' | 'auto';

export interface LearnerSettings {
  transliteration: TransliterationMode;
  theme: 'auto' | 'light' | 'dark';
  dailyGoalMinutes: 5 | 10 | 15 | 20;
  audioAutoplay: boolean;
  audioRate: number; // 0.6..1
  soundEffects: boolean;
  reducedMotion: boolean;
  textScale: 'normal' | 'large' | 'larger';
  /** experimental browser speech recognition aid */
  speechRecognition: boolean;
  /** clearly-labelled synthetic browser voice used only where no recording exists */
  synthFallback: boolean;
  showDraftContent: boolean;
  /** 'delayed': listening choices hide meanings until answered (first-pass listening, R8);
   *  'always': meanings always visible (accessibility). */
  listeningTranscripts?: 'delayed' | 'always';
}

export interface LearnerProfile {
  createdAt: string;
  path: 'complete-beginner' | 'heritage-learner' | 'family' | null;
  focus: string[];
  selfAssessment: { understand: number; speak: number; read: number; write: number };
  ageMode?: 'child' | 'teen' | 'adult' | 'family';
  onboarded: boolean;
}

export interface ConceptMastery {
  conceptId: string;
  masteryScore: number; // 0..100
  timesSeen: number;
  correctCount: number;
  incorrectCount: number;
  correctStreak: number;
  incorrectStreak: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  intervalDays: number;
  averageResponseTimeMs?: number;
  lastExerciseTypes: string[];
  recentMistakes: string[]; // exercise ids
  /** v2: per-skill evidence — a concept is not one Boolean (H1, R4). */
  skills?: Partial<Record<SkillDimension, SkillMasteryEntry>>;
  /** v2: recent classified error categories, newest first (R6). */
  recentErrorTypes?: ErrorType[];
}

export interface ExerciseAttempt {
  id?: number; // autoincrement
  exerciseId: string;
  lessonId: string;
  conceptIds: string[];
  correct: boolean;
  /** correct on the very first try, before any retry prompt */
  firstAttemptCorrect?: boolean;
  usedHint: boolean;
  responseTimeMs: number;
  answerGiven?: string;
  skillDimension?: SkillDimension;
  supportLevel?: SupportLevel;
  errorType?: ErrorType;
  at: string;
}

export interface LessonProgress {
  lessonId: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'mastered';
  completedAt?: string;
  bestAccuracy?: number;
  timesCompleted: number;
  /** resume state for an interrupted session */
  resume?: { exerciseIndex: number; correct: number; wrong: number; startedAt: string } | null;
}

export interface MistakeRecord {
  exerciseId: string;
  lessonId: string;
  conceptIds: string[];
  lastMissedAt: string;
  missCount: number;
  cleared: boolean;
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDay: string | null; // YYYY-MM-DD local
  /** week key when the weekly rest day was spent (streak survives one missed day/week) */
  restUsedWeek?: string;
}

export interface XPState {
  total: number;
  today: number;
  todayDate: string; // YYYY-MM-DD
  minutesToday: number;
  badges: string[];
  lessonsCompleted: number;
  reviewSessions: number;
  speakingRecordings: number;
  storiesCompleted: number;
}

export interface ProgressExport {
  schemaVersion: number;
  exportedAt: string;
  profile: LearnerProfile;
  settings: LearnerSettings;
  mastery: ConceptMastery[];
  lessons: LessonProgress[];
  mistakes: MistakeRecord[];
  streak: StreakState;
  xp: XPState;
}

export const DEFAULT_SETTINGS: LearnerSettings = {
  transliteration: 'always',
  theme: 'auto',
  dailyGoalMinutes: 10,
  audioAutoplay: true,
  audioRate: 1,
  soundEffects: true,
  reducedMotion: false,
  textScale: 'normal',
  speechRecognition: false,
  synthFallback: true,
  showDraftContent: true, // sample content is draft; flipped to false once reviewed content exists
  listeningTranscripts: 'delayed',
};

export const DEFAULT_PROFILE: LearnerProfile = {
  createdAt: new Date().toISOString(),
  path: null,
  focus: [],
  selfAssessment: { understand: 0, speak: 0, read: 0, write: 0 },
  onboarded: false,
};
