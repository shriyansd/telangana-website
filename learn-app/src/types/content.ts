// Content schema for Telugu Bata. Content lives in JSON files under src/content
// and is validated at load time (src/lib/validate.ts) and by scripts/validate-content.mjs.

export type ReviewStatus = 'draft' | 'needs-review' | 'reviewed' | 'published' | 'archived';

export type LearnerPath = 'complete-beginner' | 'heritage-learner' | 'family';

export type ExerciseType =
  | 'listen_select'
  | 'multiple_choice'
  | 'image_match'
  | 'word_tiles'
  | 'fill_blank'
  | 'translate'
  | 'dictation'
  | 'script_build'
  | 'sound_compare'
  | 'dialogue'
  | 'story_checkpoint'
  | 'match_pairs'
  | 'categorize'
  | 'speaking';

export interface AudioRef {
  /** Path relative to the app base, e.g. audio/course-1/unit-1/hello-normal.mp3 */
  normal?: string;
  slow?: string;
  speakerId?: string;
  /** Regional label, e.g. "Standard", "Telangana", "Coastal Andhra" */
  region?: string;
  reviewStatus?: ReviewStatus;
}

export interface TeluguString {
  telugu: string;
  transliteration?: string;
  english?: string;
  audio?: AudioRef;
}

export interface Choice extends TeluguString {
  id: string;
  image?: string;
  /** Explanation shown if this (wrong) choice is picked */
  whyWrong?: string;
}

export interface ExerciseFeedback {
  correct?: string;
  incorrect?: string;
  grammar?: string;
}

export interface ExerciseBase {
  id: string;
  type: ExerciseType;
  conceptIds: string[];
  prompt?: string;
  feedback?: ExerciseFeedback;
  hint?: string;
  /** difficulty 1..3 — affects mastery credit */
  difficulty?: number;
  /** Regional label if not Standard Telugu */
  region?: string;
  /** Override the inferred skill dimension (see lib/srs.ts inferDimension). */
  skillDimension?: string;
  /** Override the inferred support level (recognition → production, R4). */
  supportLevel?: string;
  /** Marks a review/transfer variant: same concept, new context (R1/R2). */
  newContext?: boolean;
}

export interface ListenSelectExercise extends ExerciseBase {
  type: 'listen_select';
  audio: AudioRef;
  /** Telugu text of what is heard — used for transcript + speech-synth fallback */
  spoken: TeluguString;
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface MultipleChoiceExercise extends ExerciseBase {
  type: 'multiple_choice';
  question: TeluguString;
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface ImageMatchExercise extends ExerciseBase {
  type: 'image_match';
  /** mode: show image pick word, or show word pick image */
  mode: 'image-to-word' | 'word-to-image' | 'audio-to-image';
  target: TeluguString & { image?: string };
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface WordTilesExercise extends ExerciseBase {
  type: 'word_tiles';
  source: TeluguString;
  /** tiles in a correct order; distractors added separately */
  tiles: string[];
  distractors?: string[];
  /** alternate acceptable orders (arrays of tiles) */
  acceptedOrders?: string[][];
  direction: 'to-telugu' | 'to-english';
}

export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  /** sentence with ___ marking the blank */
  sentence: TeluguString;
  answer: string;
  acceptedAnswers?: string[];
  choices?: string[]; // if present render as multiple choice
  audio?: AudioRef;
}

export interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  source: TeluguString;
  direction: 'to-telugu' | 'to-english';
  acceptedAnswers: string[];
  /** allow romanized Telugu answers matched against these */
  acceptedRomanizations?: string[];
}

export interface DictationExercise extends ExerciseBase {
  type: 'dictation';
  audio: AudioRef;
  spoken: TeluguString;
  acceptedAnswers: string[];
  tiles?: string[]; // optional tile fallback
}

export interface ScriptBuildExercise extends ExerciseBase {
  type: 'script_build';
  mode: 'combine' | 'identify' | 'build-word';
  prompt: string;
  parts?: string[]; // e.g. ["క", "ా"]
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface SoundCompareExercise extends ExerciseBase {
  type: 'sound_compare';
  mode: 'same-different' | 'which-heard' | 'match-letter';
  audio: AudioRef;
  spoken: TeluguString;
  choices: Choice[];
  correctChoiceIds: string[];
  contrast?: string; // e.g. "త vs ట"
}

export interface DialogueTurn {
  speaker: string;
  line: TeluguString;
}

export interface DialogueExercise extends ExerciseBase {
  type: 'dialogue';
  context?: string;
  turns: DialogueTurn[]; // lines leading up to the response
  responseMode: 'select' | 'tiles' | 'type';
  choices?: Choice[];
  correctChoiceIds?: string[];
  tiles?: string[];
  acceptedAnswers?: string[];
  /** id of follow-up exercise per choice for branching (optional) */
  branches?: Record<string, string>;
}

export interface StoryCheckpointExercise extends ExerciseBase {
  type: 'story_checkpoint';
  question: TeluguString;
  choices: Choice[];
  correctChoiceIds: string[];
}

export interface MatchPairsExercise extends ExerciseBase {
  type: 'match_pairs';
  pairs: { a: TeluguString; b: TeluguString }[];
  mode: 'telugu-english' | 'telugu-transliteration' | 'audio-telugu';
}

export interface CategorizeExercise extends ExerciseBase {
  type: 'categorize';
  categories: string[];
  items: { text: TeluguString; category: string }[];
}

export interface SpeakingExercise extends ExerciseBase {
  type: 'speaking';
  model: TeluguString;
  audio?: AudioRef;
}

export type Exercise =
  | ListenSelectExercise
  | MultipleChoiceExercise
  | ImageMatchExercise
  | WordTilesExercise
  | FillBlankExercise
  | TranslateExercise
  | DictationExercise
  | ScriptBuildExercise
  | SoundCompareExercise
  | DialogueExercise
  | StoryCheckpointExercise
  | MatchPairsExercise
  | CategorizeExercise
  | SpeakingExercise;

export interface Concept {
  id: string;
  telugu: string;
  transliteration?: string;
  english: string;
  notes?: string;
  /** concepts commonly confused with this one */
  confusableWith?: string[];
}

export interface CultureCard {
  id: string;
  title: string;
  body: string;
  region?: string;
}

export interface GrammarNote {
  id: string;
  title: string;
  body: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  unitId: string;
  title: string;
  teluguTitle?: string;
  description: string;
  estimatedMinutes: number;
  status: ReviewStatus;
  difficulty: 'beginner' | 'elementary' | 'intermediate';
  learnerPaths: LearnerPath[];
  prerequisites: string[];
  conceptIds: string[];
  newConceptLimit?: number;
  kind?: 'standard' | 'story' | 'script' | 'listening' | 'checkpoint';
  exercises: Exercise[];
  grammarNotes?: GrammarNote[];
  cultureCards?: CultureCard[];
  author?: string;
  reviewer?: string;
  reviewedAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  title: string;
  teluguTitle?: string;
  description?: string;
  lessonIds: string[];
  /** Unit learning design (D1/R11): what the learner will be able to DO. */
  communicationGoal?: string;
  canDoStatement?: string;
  realWorldScenario?: string;
  /** Lesson id of the final performance task, if the unit has one. */
  finalPerformanceTaskLessonId?: string;
}

export interface Course {
  id: string;
  title: string;
  teluguTitle?: string;
  description: string;
  order: number;
  units: Unit[];
}

export interface Story {
  id: string;
  title: string;
  teluguTitle?: string;
  status: ReviewStatus;
  description: string;
  lines: DialogueTurn[];
  checkpoints: { afterLine: number; exercise: StoryCheckpointExercise }[];
  vocabPreview?: Concept[];
}
