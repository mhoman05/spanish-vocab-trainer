import type { Tense } from "./lib/conjugation";

export type Direction = "es_to_en" | "en_to_es";

export type WordStatus =
  | "new" // never studied
  | "learning" // in the intro phase (short intervals)
  | "review" // graduated to spaced review
  | "mastered" // archived
  | "suspended"; // manually removed from rotation

/** Per-direction spaced-repetition state (SM-2 style). */
export interface DirState {
  ease: number; // ease factor, starts 2.5
  intervalDays: number; // current interval
  reps: number; // consecutive successful reviews
  lapses: number; // times forgotten
  due: number; // epoch ms when next due
  lastReviewed: number | null;
}

export interface Word {
  id: string;
  spanish: string;
  english: string;
  pos: string;
  exampleEs?: string;
  exampleEn?: string;
  frequencyRank: number | null;
  register?: string;
  inTop5000: boolean;
  tags: string[];
  source: "seed" | "seed-family" | "user";
  notes?: string; // user mnemonic / hint
  status: WordStatus;
  addedAt: number;
  masteredAt?: number | null;
  leech: boolean;
  dirs: Record<Direction, DirState>;
}

export interface ReviewLog {
  id?: number;
  wordId: string;
  ts: number;
  direction: Direction;
  rating: Rating; // 0..3
  typed: boolean;
  prevInterval: number;
  newInterval: number;
  kind?: "vocab" | "conjugation";
}

/** One conjugation-drill card: a single verb form (verb x tense x person). */
export interface DrillCard {
  id: string; // `${verb}:${tense}:${person}`
  verb: string;
  gloss: string;
  tense: Tense;
  person: number; // 0..5 index into PERSONS
  answer: string; // the Spanish form
  cue: string; // plain-English prompt
  order: number; // introduction order
  status: WordStatus;
  addedAt: number;
  masteredAt?: number | null;
  leech: boolean;
  dir: DirState; // single direction: cue -> Spanish form
}

/** 0 Again · 1 Hard · 2 Good · 3 Easy */
export type Rating = 0 | 1 | 2 | 3;

export interface Settings {
  id: "settings";
  newPerDay: number;
  sessionSize: number; // max cards per session (0 = unlimited)
  directionBias: number; // 0..1 share of prompts that are en_to_es (production)
  defaultTyped: boolean;
  masteryIntervalDays: number; // interval at which a word graduates to mastered
  masteryMinReps: number;
  leechThreshold: number; // lapses before a word is flagged as a leech
  accentSensitive: boolean;
  refresherEnabled: boolean;
  lastNewGrantDay: string; // YYYY-MM-DD of last daily new-word grant
  // --- conjugation drills ---
  drillNewPerDay: number;
  drillTenses: Tense[];
  drillIncludeVosotros: boolean;
  lastDrillGrantDay: string;
}

export interface DailyStat {
  day: string; // YYYY-MM-DD
  reviews: number;
  correct: number;
  newIntroduced: number;
  mastered: number;
}
