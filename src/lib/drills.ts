import { db, freshDir, getSettings, saveSettings } from "../db";
import type { DrillCard, Rating } from "../types";
import { generateAllCards } from "./conjugation";
import { scheduleStep } from "./scheduler";
import { normalize, todayKey } from "./session";

/** Create the drill cards on first run (idempotent). */
export async function ensureDrillsSeeded(): Promise<number> {
  const existing = await db.drills.count();
  if (existing > 0) return existing;
  const now = Date.now();
  const cards: DrillCard[] = generateAllCards().map((c) => ({
    ...c,
    status: "new",
    addedAt: now,
    masteredAt: null,
    leech: false,
    dir: freshDir(now),
  }));
  await db.drills.bulkPut(cards);
  return cards.length;
}

function active(card: DrillCard, tenses: string[], vosotros: boolean): boolean {
  if (!tenses.includes(card.tense)) return false;
  if (!vosotros && card.person === 4) return false;
  return true;
}

/** Promote the daily allowance of new drill cards to "learning". */
export async function grantDailyDrills(): Promise<number> {
  const s = await getSettings();
  const today = todayKey();
  if (s.lastDrillGrantDay === today) return 0;

  const fresh = (await db.drills.where("status").equals("new").toArray()).filter((c) =>
    active(c, s.drillTenses, s.drillIncludeVosotros),
  );
  fresh.sort((a, b) => a.order - b.order);
  const pick = fresh.slice(0, Math.max(0, s.drillNewPerDay));
  if (pick.length) {
    await db.drills.bulkPut(pick.map((c) => ({ ...c, status: "learning" as const })));
  }
  await saveSettings({ lastDrillGrantDay: today });
  return pick.length;
}

export async function buildDrillQueue(now = Date.now()): Promise<DrillCard[]> {
  const s = await getSettings();
  await grantDailyDrills();
  let cards = (await db.drills.where("status").anyOf("learning", "review").toArray()).filter(
    (c) => active(c, s.drillTenses, s.drillIncludeVosotros) && c.dir.due <= now,
  );
  cards.sort((a, b) => {
    const la = a.dir.intervalDays < 1 ? 0 : 1;
    const lb = b.dir.intervalDays < 1 ? 0 : 1;
    if (la !== lb) return la - lb;
    return a.dir.due - b.dir.due;
  });
  if (s.sessionSize > 0) cards = cards.slice(0, s.sessionSize);
  return cards;
}

export interface DrillApplyResult {
  mastered: boolean;
  leech: boolean;
}

export async function applyDrillRating(
  card: DrillCard,
  rating: Rating,
  typed: boolean,
  now = Date.now(),
): Promise<DrillApplyResult> {
  const s = await getSettings();
  const fresh = (await db.drills.get(card.id))!;
  const step = scheduleStep(fresh.dir, rating, now, s);

  const next: DrillCard = { ...fresh, dir: step.dir };
  if (step.graduated && next.status === "learning") next.status = "review";
  if (step.dir.lapses >= s.leechThreshold) next.leech = true;

  const mastered =
    step.dir.intervalDays >= s.masteryIntervalDays &&
    step.dir.reps >= s.masteryMinReps &&
    step.dir.lapses === 0;
  if (mastered) {
    next.status = "mastered";
    next.masteredAt = now;
  }

  await db.drills.put(next);
  await db.logs.add({
    wordId: card.id,
    ts: now,
    direction: "en_to_es",
    rating,
    typed,
    prevInterval: fresh.dir.intervalDays,
    newInterval: step.dir.intervalDays,
    kind: "conjugation",
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

  return { mastered, leech: next.leech };
}

export async function drillCounts() {
  const s = await getSettings();
  const all = await db.drills.toArray();
  const inScope = all.filter((c) => active(c, s.drillTenses, s.drillIncludeVosotros));
  const now = Date.now();
  return {
    total: inScope.length,
    due: inScope.filter(
      (c) => (c.status === "learning" || c.status === "review") && c.dir.due <= now,
    ).length,
    learning: inScope.filter((c) => c.status === "learning").length,
    review: inScope.filter((c) => c.status === "review").length,
    mastered: inScope.filter((c) => c.status === "mastered").length,
    remaining: inScope.filter((c) => c.status === "new").length,
  };
}

const PRONOUNS =
  /^(yo|t[uú]|[eé]l|ella|usted|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes)\s+/i;

/** Accept the bare form or the form with its subject pronoun. */
export function checkDrillAnswer(input: string, answer: string, accentSensitive: boolean): boolean {
  const got = normalize(input.replace(PRONOUNS, ""), accentSensitive);
  return got === normalize(answer, accentSensitive);
}

export async function resetDrillProgress() {
  const now = Date.now();
  const all = await db.drills.toArray();
  await db.drills.bulkPut(
    all.map((c) => ({
      ...c,
      status: "new" as const,
      masteredAt: null,
      leech: false,
      dir: freshDir(now),
    })),
  );
  await saveSettings({ lastDrillGrantDay: "" });
}
