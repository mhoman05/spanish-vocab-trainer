import type { DirState, Rating, Settings, Word } from "../types";

/**
 * A single pure scheduling step. Given a word's per-direction state and a rating,
 * return the next state. This is an SM-2 variant with two short "learning" steps
 * before a card graduates into real spaced repetition.
 *
 * Rating: 0 Again · 1 Hard · 2 Good · 3 Easy
 *
 * Keeping this isolated means the algorithm (SM-2 today, FSRS later) can be
 * swapped without touching the UI or storage layers.
 */
const DAY = 86_400_000;
const LEARNING_STEPS_MIN = [1, 10]; // minutes for the two intro steps
const GRAD_INTERVAL = 1; // days, when a card leaves the learning phase on "Good"
const EASY_GRAD_INTERVAL = 4; // days, when it leaves on "Easy"
const MIN_EASE = 1.3;

export interface StepResult {
  dir: DirState;
  graduated: boolean; // moved from learning -> review this step
  lapsed: boolean; // forgot a review-phase card this step
}

export function scheduleStep(
  prev: DirState,
  rating: Rating,
  now: number,
  settings: Settings,
): StepResult {
  const inLearning = prev.reps === 0 || prev.intervalDays < GRAD_INTERVAL;
  const dir: DirState = { ...prev, lastReviewed: now };

  if (inLearning) {
    if (rating === 0) {
      dir.reps = 0;
      dir.due = now + LEARNING_STEPS_MIN[0] * 60_000;
      return { dir, graduated: false, lapsed: false };
    }
    // step through the learning steps; Easy jumps straight to graduation
    const step = Math.min(prev.reps, LEARNING_STEPS_MIN.length - 1);
    if (rating >= 3) {
      dir.reps = 1;
      dir.intervalDays = EASY_GRAD_INTERVAL;
      dir.due = now + EASY_GRAD_INTERVAL * DAY;
      return { dir, graduated: true, lapsed: false };
    }
    if (step >= LEARNING_STEPS_MIN.length - 1 && rating >= 2) {
      dir.reps = 1;
      dir.intervalDays = GRAD_INTERVAL;
      dir.due = now + GRAD_INTERVAL * DAY;
      return { dir, graduated: true, lapsed: false };
    }
    const nextStep = rating === 1 ? step : step + 1;
    dir.reps = Math.min(nextStep, LEARNING_STEPS_MIN.length - 1);
    dir.due = now + LEARNING_STEPS_MIN[Math.min(nextStep, LEARNING_STEPS_MIN.length - 1)] * 60_000;
    return { dir, graduated: false, lapsed: false };
  }

  // --- review phase (SM-2) ---
  if (rating === 0) {
    dir.lapses = prev.lapses + 1;
    dir.reps = 0;
    dir.ease = Math.max(MIN_EASE, prev.ease - 0.2);
    dir.intervalDays = 0;
    dir.due = now + LEARNING_STEPS_MIN[0] * 60_000; // relearn
    return { dir, graduated: false, lapsed: true };
  }

  const easeDelta = rating === 1 ? -0.15 : rating === 2 ? 0 : 0.15;
  dir.ease = Math.max(MIN_EASE, prev.ease + easeDelta);
  dir.reps = prev.reps + 1;

  const base = Math.max(prev.intervalDays, GRAD_INTERVAL);
  let next: number;
  if (rating === 1) next = base * 1.2;
  else if (rating === 2) next = base * dir.ease;
  else next = base * dir.ease * 1.3;

  // fuzz +/-5% so large batches don't clump on the same day
  next = next * (0.95 + Math.random() * 0.1);
  dir.intervalDays = Math.round(Math.min(next, 3650));
  dir.due = now + dir.intervalDays * DAY;
  return { dir, graduated: false, lapsed: false };
}

/** Has this word cleared the bar in BOTH directions to be archived as mastered? */
export function isMastered(word: Word, settings: Settings): boolean {
  return (["es_to_en", "en_to_es"] as const).every((d) => {
    const s = word.dirs[d];
    return (
      s.intervalDays >= settings.masteryIntervalDays &&
      s.reps >= settings.masteryMinReps &&
      s.lapses === 0
    );
  });
}

export function nextDue(word: Word): number {
  return Math.min(word.dirs.es_to_en.due, word.dirs.en_to_es.due);
}
