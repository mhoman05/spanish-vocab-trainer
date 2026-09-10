import { db, freshDir, getSettings } from "../db";
import type { Word } from "../types";

interface SeedRow {
  id: string;
  spanish: string;
  english: string;
  pos: string;
  example_es?: string;
  frequency_rank: number | null;
  register?: string;
  in_top_5000: boolean;
  tags: string[];
  source: string;
}

const BASE = import.meta.env.BASE_URL || "/";

/** Load words.json and populate the DB the first time the app runs. */
export async function ensureSeeded(): Promise<{ seeded: boolean; count: number }> {
  const existing = await db.words.count();
  if (existing > 0) return { seeded: false, count: existing };

  const res = await fetch(`${BASE}words.json`);
  if (!res.ok) throw new Error(`Could not load words.json (${res.status})`);
  const rows: SeedRow[] = await res.json();
  const now = Date.now();

  const words: Word[] = rows.map((r) => ({
    id: r.id,
    spanish: r.spanish,
    english: r.english,
    pos: r.pos,
    exampleEs: r.example_es || undefined,
    frequencyRank: r.frequency_rank,
    register: r.register || undefined,
    inTop5000: r.in_top_5000,
    tags: r.tags ?? [],
    source: r.source === "user" ? "user" : (r.source as Word["source"]),
    status: "new",
    addedAt: now,
    masteredAt: null,
    leech: false,
    dirs: { es_to_en: freshDir(now), en_to_es: freshDir(now) },
  }));

  await db.words.bulkPut(words);
  await getSettings(); // materialize defaults
  return { seeded: true, count: words.length };
}

/** Re-import words.json, adding only rows whose id is not already present. */
export async function syncNewSeedWords(): Promise<number> {
  const res = await fetch(`${BASE}words.json`);
  const rows: SeedRow[] = await res.json();
  const now = Date.now();
  const have = new Set(await db.words.toCollection().primaryKeys());
  const toAdd: Word[] = rows
    .filter((r) => !have.has(r.id))
    .map((r) => ({
      id: r.id,
      spanish: r.spanish,
      english: r.english,
      pos: r.pos,
      exampleEs: r.example_es || undefined,
      frequencyRank: r.frequency_rank,
      register: r.register || undefined,
      inTop5000: r.in_top_5000,
      tags: r.tags ?? [],
      source: (r.source as Word["source"]) ?? "seed",
      status: "new",
      addedAt: now,
      masteredAt: null,
      leech: false,
      dirs: { es_to_en: freshDir(now), en_to_es: freshDir(now) },
    }));
  if (toAdd.length) await db.words.bulkPut(toAdd);
  return toAdd.length;
}
