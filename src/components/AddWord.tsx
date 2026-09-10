import { useState } from "react";
import { db, freshDir } from "../db";
import type { Word } from "../types";

function makeWord(spanish: string, english: string, extra: Partial<Word> = {}): Word {
  const now = Date.now();
  return {
    id: `user-${now}-${Math.random().toString(36).slice(2, 7)}`,
    spanish: spanish.trim(),
    english: english.trim(),
    pos: extra.pos ?? "",
    exampleEs: extra.exampleEs,
    frequencyRank: null,
    inTop5000: false,
    tags: extra.tags ?? ["custom"],
    source: "user",
    notes: extra.notes,
    status: "learning",
    addedAt: now,
    masteredAt: null,
    leech: false,
    dirs: { es_to_en: freshDir(now), en_to_es: freshDir(now) },
  };
}

export default function AddWord() {
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const [pos, setPos] = useState("");
  const [example, setExample] = useState("");
  const [notes, setNotes] = useState("");
  const [bulk, setBulk] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (!es.trim() || !en.trim()) return;
    await db.words.add(makeWord(es, en, { pos, exampleEs: example || undefined, notes: notes || undefined }));
    setMsg(`Added “${es.trim()}”`);
    setEs("");
    setEn("");
    setExample("");
    setNotes("");
  }

  async function addBulk() {
    const rows = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\s*[=|\t]\s*|\s+[–—]\s+/, 2))
      .filter((p) => p.length === 2 && p[0] && p[1]);
    if (!rows.length) {
      setMsg("Nothing parsed — use “spanish = english”, one per line");
      return;
    }
    await db.words.bulkAdd(rows.map(([s, e]) => makeWord(s, e)));
    setMsg(`Added ${rows.length} words`);
    setBulk("");
  }

  return (
    <div>
      <h1>Add a word</h1>
      <form onSubmit={addOne} className="card">
        <label>Spanish *</label>
        <input value={es} onChange={(e) => setEs(e.target.value)} autoCapitalize="none" />
        <label>English *</label>
        <input value={en} onChange={(e) => setEn(e.target.value)} autoCapitalize="none" />
        <div className="row">
          <div>
            <label>Part of speech</label>
            <input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="nm, v, adj…" />
          </div>
        </div>
        <label>Example sentence (Spanish)</label>
        <input value={example} onChange={(e) => setExample(e.target.value)} />
        <label>Note / mnemonic</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="primary" style={{ width: "100%", marginTop: 12 }} type="submit">
          Add to learning queue
        </button>
      </form>

      <h2>Quick bulk add</h2>
      <div className="card">
        <p className="small muted">One per line: <code>hola = hello</code></p>
        <textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="primary" style={{ width: "100%", marginTop: 10 }} onClick={addBulk}>
          Add all
        </button>
      </div>

      {msg && <p className="small" style={{ color: "var(--good)" }}>{msg}</p>}
    </div>
  );
}
