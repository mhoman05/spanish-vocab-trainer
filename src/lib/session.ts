import { db, getSettings, saveSettings } from "../db";
import type { Direction, Rating, Settings, Word } from "../types";
import { isMastered, scheduleStep } from "./scheduler";

export interface Card {
  word: Word;
  direction: Direction;
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Grant the daily allowance of brand-new words by flipping them to "learning". */
export async function grantDailyNew(): Promise<number> {
  const s = await getSettings();
  const today = todayKey();
  if (s.lastNewGrantDay === today) return 0;

  const introducedToday = await db.words
    .where("status")
    .anyOf("learning", "review")
    .filter((w) => todayKey(new Date(w.addedAt)) === today && w.dirs.es_to_en.reps === 0)
    .count();

  const slots = Math.max(0, s.newPerDay - introducedToday);
  if (slots > 0) {
    const fresh = await db.words.where("status").equals("new").toArray();
    if (s.newOrder === "frequency") {
      fresh.sort((a, b) => (a.frequencyRank ?? 1e9) - (b.frequencyRank ?? 1e9));
    } else {
      shuffle(fresh);
    }
    const pick = fresh.slice(0, slots);
    await db.words.bulkPut(pick.map((w) => ({ ...w, status: "learning" as const })));
  }
  await saveSettings({ lastNewGrantDay: today });
  return slots;
}

function dueCards(words: Word[], now: number): Card[] {
  const cards: Card[] = [];
  for (const w of words) {
    if (w.status === "mastered" || w.status === "suspended" || w.status === "new") continue;
    (["es_to_en", "en_to_es"] as Direction[]).forEach((direction) => {
      if (w.dirs[direction].due <= now) cards.push({ word: w, direction });
    });
  }
  return cards;
}

/** Build the ordered queue for a study session. */
export async function buildQueue(now = Date.now()): Promise<Card[]> {
  const s = await getSettings();
  await grantDailyNew();
  const words = await db.words
    .where("status")
    .anyOf("learning", "review")
    .toArray();

  let cards = dueCards(words, now);

  // Direction bias: keep all production (en_to_es) cards, subsample recognition
  // cards so the session leans toward the harder, more valuable direction.
  const prod = cards.filter((c) => c.direction === "en_to_es");
  const recog = cards.filter((c) => c.direction === "es_to_en");
  const targetRecog = Math.round((prod.length / Math.max(s.directionBias, 0.01)) * (1 - s.directionBias));
  shuffle(recog);
  cards = [...prod, ...recog.slice(0, Math.max(targetRecog, Math.ceil(recog.length * 0.3)))];

  // learning-phase cards first (short intervals, time-sensitive), then the rest —
  // but shuffled within each tier so the introduction order isn't predictable.
  const isLearning = (c: Card) => c.word.dirs[c.direction].intervalDays < 1;
  const learn = shuffle(cards.filter(isLearning));
  const rest = shuffle(cards.filter((c) => !isLearning(c)));
  cards = [...learn, ...rest];
  if (s.sessionSize > 0) cards = cards.slice(0, s.sessionSize);
  return cards;
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ApplyResult {
  word: Word;
  graduated: boolean;
  lapsed: boolean;
  mastered: boolean;
  leech: boolean;
}

/** Apply a rating to one card, persist word + log + daily stat. */
export async function applyRating(
  card: Card,
  rating: Rating,
  typed: boolean,
  now = Date.now(),
): Promise<ApplyResult> {
  const s = await getSettings();
  const word = (await db.words.get(card.word.id))!;
  const prev = word.dirs[card.direction];
  const step = scheduleStep(prev, rating, now, s);

  const dirs = { ...word.dirs, [card.direction]: step.dir };
  let next: Word = { ...word, dirs };

  if (step.graduated && next.status === "learning") {
    const other = card.direction === "es_to_en" ? "en_to_es" : "es_to_en";
    if (dirs[other].reps > 0 || dirs[other].intervalDays >= 1) next.status = "review";
  }

  const leech =
    step.dir.lapses >= s.leechThreshold ? true : next.leech;
  next.leech = leech;

  const mastered = isMastered(next, s);
  if (mastered) {
    next.status = "mastered";
    next.masteredAt = now;
  }

  await db.words.put(next);
  await db.logs.add({
    wordId: word.id,
    ts: now,
    direction: card.direction,
    rating,
    typed,
    prevInterval: prev.intervalDays,
    newInterval: step.dir.intervalDays,
  });

  const day = todayKey(new Date(now));
  const stat = (await db.stats.get(day)) ?? {
    day,
    reviews: 0,
    correct: 0,
    newIntroduced: 0,
    mastered: 0,
  };
  stat.reviews += 1;
  if (rating >= 2) stat.correct += 1;
  if (mastered) stat.mastered += 1;
  await db.stats.put(stat);

  return { word: next, graduated: step.graduated, lapsed: step.lapsed, mastered, leech };
}

/** How many cards are due right now + how many new words are queued for today. */
export async function queueCounts(now = Date.now()) {
  const s = await getSettings();
  const words = await db.words.where("status").anyOf("learning", "review").toArray();
  const due = dueCards(words, now).length;
  const newQueued = await db.words.where("status").equals("new").count();
  const grantedToday = s.lastNewGrantDay === todayKey() ? s.newPerDay : 0;
  return { due, newQueued, grantedToday };
}

export function normalize(str: string, accentSensitive: boolean): string {
  let out = str.trim().toLowerCase().replace(/[.!?¿¡"']/g, "").replace(/\s+/g, " ");
  if (!accentSensitive) out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return out;
}

/** Lenient check of a typed answer against the target (handles "to " verbs, "the", slashes, commas). */
export function checkTyped(input: string, target: string, settings: Settings): boolean {
  const variants = target
    .split(/[,;/]| or /i)
    .map((t) => t.replace(/^\s*(to |the |a |an |el |la |los |las |un |una )\s*/i, ""))
    .map((t) => normalize(t, settings.accentSensitive))
    .filter(Boolean);
  const got = normalize(input, settings.accentSensitive).replace(
    /^(to |the |a |an |el |la |los |las |un |una )/i,
    "",
  );
  return variants.some((v) => v === got);
}
