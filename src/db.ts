import Dexie, { type Table } from "dexie";
import type { DailyStat, Direction, ReviewLog, Settings, Word } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  newPerDay: 12,
  sessionSize: 30,
  directionBias: 0.65,
  defaultTyped: false,
  masteryIntervalDays: 200,
  masteryMinReps: 6,
  leechThreshold: 8,
  accentSensitive: false,
  refresherEnabled: true,
  lastNewGrantDay: "",
};

export function freshDir(due = Date.now()) {
  return { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, due, lastReviewed: null };
}

export class VocabDB extends Dexie {
  words!: Table<Word, string>;
  logs!: Table<ReviewLog, number>;
  settings!: Table<Settings, string>;
  stats!: Table<DailyStat, string>;

  constructor() {
    super("vocab-trainer");
    // Note: IndexedDB can't index booleans, so `leech` is filtered in JS, not indexed.
    this.version(1).stores({
      words: "id, status, frequencyRank, *tags",
      logs: "++id, wordId, ts, direction",
      settings: "id",
      stats: "day",
    });
  }
}

export const db = new VocabDB();

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("settings");
  if (s) return { ...DEFAULT_SETTINGS, ...s };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>) {
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch, id: "settings" });
}

export const DIRECTIONS: Direction[] = ["es_to_en", "en_to_es"];
