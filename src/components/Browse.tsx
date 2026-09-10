import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, freshDir, getSettings } from "../db";
import type { Word, WordStatus } from "../types";
import { syncNewSeedWords } from "../lib/seed";

const FILTERS: (WordStatus | "all")[] = [
  "all",
  "new",
  "learning",
  "review",
  "mastered",
  "suspended",
];

export default function Browse() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<WordStatus | "all">("all");
  const [bulk, setBulk] = useState(25);
  const [msg, setMsg] = useState<string | null>(null);

  const words = useLiveQuery(async () => {
    let arr = await db.words.toArray();
    arr.sort((a, b) => (a.frequencyRank ?? 1e9) - (b.frequencyRank ?? 1e9));
    if (filter !== "all") arr = arr.filter((w) => w.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle)
      arr = arr.filter(
        (w) =>
          w.spanish.toLowerCase().includes(needle) ||
          w.english.toLowerCase().includes(needle),
      );
    return arr.slice(0, 300);
  }, [q, filter]);

  const stats = useLiveQuery(async () => {
    const all = await db.words.toArray();
    const by = (s: WordStatus) => all.filter((w) => w.status === s).length;
    return {
      total: all.length,
      new: by("new"),
      learning: by("learning"),
      review: by("review"),
      mastered: by("mastered"),
      suspended: by("suspended"),
    };
  });

  async function setStatus(w: Word, status: WordStatus) {
    const patch: Partial<Word> = { status };
    if (status === "mastered") patch.masteredAt = Date.now();
    if (status === "new") {
      patch.masteredAt = null;
      patch.dirs = { es_to_en: freshDir(), en_to_es: freshDir() };
      patch.leech = false;
    }
    await db.words.update(w.id, patch);
  }

  async function knowAlready(w: Word) {
    // jump straight to archived with a long interval in both directions
    const now = Date.now();
    const far = now + 400 * 86_400_000;
    await db.words.update(w.id, {
      status: "mastered",
      masteredAt: now,
      dirs: {
        es_to_en: { ease: 2.6, intervalDays: 400, reps: 6, lapses: 0, due: far, lastReviewed: now },
        en_to_es: { ease: 2.6, intervalDays: 400, reps: 6, lapses: 0, due: far, lastReviewed: now },
      },
    });
  }

  async function addMoreWords() {
    const s = await getSettings();
    const candidates = await db.words.where("status").equals("new").toArray();
    if (s.newOrder === "frequency") {
      candidates.sort((a, b) => (a.frequencyRank ?? 1e9) - (b.frequencyRank ?? 1e9));
    } else {
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
    }
    const pick = candidates.slice(0, bulk);
    await db.words.bulkPut(pick.map((w) => ({ ...w, status: "learning" as const })));
    setMsg(`Queued ${pick.length} words into learning`);
  }

  async function resync() {
    const n = await syncNewSeedWords();
    setMsg(n ? `Imported ${n} new words from words.json` : "Already up to date");
  }

  return (
    <div>
      <h1>Words</h1>
      {stats && (
        <p className="small muted">
          {stats.total} total · {stats.new} new · {stats.learning} learning · {stats.review} review
          · {stats.mastered} mastered · {stats.suspended} suspended
        </p>
      )}

      <input
        placeholder="Search Spanish or English…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoCapitalize="none"
      />
      <div className="row small" style={{ flexWrap: "wrap", marginTop: 8 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={filter === f ? "primary" : "ghost"}
            style={{ flex: "0 0 auto", minHeight: 36, padding: "6px 10px" }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label>Add {bulk} more unseen words to the learning queue now</label>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={bulk}
          onChange={(e) => setBulk(+e.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="primary" onClick={addMoreWords}>
            Add {bulk}
          </button>
          <button className="ghost" onClick={resync}>
            Re-import words.json
          </button>
        </div>
      </div>

      {msg && <p className="small" style={{ color: "var(--good)" }}>{msg}</p>}

      <div style={{ marginTop: 12 }}>
        {words?.map((w) => (
          <div key={w.id} className="list-item">
            <div style={{ minWidth: 0 }}>
              <div className="es">
                {w.spanish} <span className="muted small">· {w.pos}</span>
                {w.leech && <span className="pill leech" style={{ marginLeft: 6 }}>🐛</span>}
              </div>
              <div className="en">{w.english}</div>
              <div className="small muted">
                #{w.frequencyRank ?? "—"} · {w.status}
                {w.tags.length ? ` · ${w.tags.join(", ")}` : ""}
              </div>
            </div>
            <div className="spacer" />
            <select
              value={w.status}
              onChange={(e) => setStatus(w, e.target.value as WordStatus)}
              style={{ width: 120 }}
            >
              <option value="new">new</option>
              <option value="learning">learning</option>
              <option value="review">review</option>
              <option value="mastered">mastered</option>
              <option value="suspended">suspended</option>
            </select>
            {w.status !== "mastered" && (
              <button
                className="ghost small"
                title="I already know this"
                onClick={() => knowAlready(w)}
              >
                ✓know
              </button>
            )}
            {w.source === "user" && (
              <button
                className="ghost small"
                onClick={() => confirm(`Delete “${w.spanish}”?`) && db.words.delete(w.id)}
              >
                🗑
              </button>
            )}
          </div>
        ))}
        {words && words.length === 0 && <p className="muted">No matches.</p>}
        {words && words.length === 300 && (
          <p className="small muted">Showing first 300 — narrow with search.</p>
        )}
      </div>
    </div>
  );
}
