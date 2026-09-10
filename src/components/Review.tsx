import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, getSettings } from "../db";
import type { Rating, Settings } from "../types";
import {
  applyRating,
  buildQueue,
  checkTyped,
  type Card,
  queueCounts,
} from "../lib/session";

type Phase = "prompt" | "reveal";
type Commit = "none" | "shaky" | "know" | null;

export default function Review() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [commit, setCommit] = useState<Commit>(null);
  const [typed, setTyped] = useState("");
  const [typedMode, setTypedMode] = useState(false);
  const [typedCorrect, setTypedCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState({ reviewed: 0, correct: 0, mastered: 0 });
  const [counts, setCounts] = useState({ due: 0, newQueued: 0, grantedToday: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const lastApplied = useRef<Card | null>(null);
  const prevSnapshot = useRef<any>(null);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    setTypedMode(s.defaultTyped);
    setQueue(await buildQueue());
    setCounts(await queueCounts());
    setI(0);
    setPhase("prompt");
    setCommit(null);
    setTyped("");
    setTypedCorrect(null);
    setDone({ reviewed: 0, correct: 0, mastered: 0 });
    setCanUndo(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const card = queue && i < queue.length ? queue[i] : null;
  const isEs2En = card?.direction === "es_to_en";

  const prompt = card ? (isEs2En ? card.word.spanish : card.word.english) : "";
  const answer = card ? (isEs2En ? card.word.english : card.word.spanish) : "";

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  async function reveal(c: Commit) {
    setCommit(c);
    setPhase("reveal");
  }

  async function submitTyped() {
    if (!card || !settings) return;
    const ok = checkTyped(typed, isEs2En ? card.word.english : card.word.spanish, settings);
    setTypedCorrect(ok);
    setCommit(ok ? "know" : "none");
    setPhase("reveal");
  }

  async function rate(rating: Rating) {
    if (!card || !settings) return;
    prevSnapshot.current = await db.words.get(card.word.id);
    lastApplied.current = card;
    setCanUndo(true);
    const res = await applyRating(card, rating, typedMode);
    setDone((d) => ({
      reviewed: d.reviewed + 1,
      correct: d.correct + (rating >= 2 ? 1 : 0),
      mastered: d.mastered + (res.mastered ? 1 : 0),
    }));
    if (res.mastered) flashToast(`🏆 “${card.word.spanish}” mastered — archived`);
    else if (res.leech && rating === 0) flashToast(`🐛 “${card.word.spanish}” flagged as a leech`);

    // requeue "Again" cards near the end of this session
    if (rating === 0 && queue) {
      const q = [...queue];
      q.splice(Math.min(i + 6, q.length), 0, card);
      setQueue(q);
    }
    next();
  }

  function next() {
    setI((n) => n + 1);
    setPhase("prompt");
    setCommit(null);
    setTyped("");
    setTypedCorrect(null);
  }

  async function undo() {
    if (!lastApplied.current || !prevSnapshot.current || i === 0) return;
    await db.words.put(prevSnapshot.current);
    const last = await db.logs.orderBy("id").last();
    if (last?.id) await db.logs.delete(last.id);
    // the previous card is still sitting at queue[i-1]; just step back to it
    if (queue) {
      const q = [...queue];
      q[i - 1] = { word: prevSnapshot.current, direction: lastApplied.current.direction };
      setQueue(q);
    }
    lastApplied.current = null;
    prevSnapshot.current = null;
    setCanUndo(false);
    setI((n) => Math.max(0, n - 1));
    setDone((d) => ({ ...d, reviewed: Math.max(0, d.reviewed - 1) }));
    setPhase("prompt");
    setCommit(null);
    setTyped("");
    setTypedCorrect(null);
    flashToast("Undid last answer");
  }

  const suggested: Rating = useMemo(() => {
    if (typedMode) return typedCorrect ? 2 : 0;
    if (commit === "know") return 2;
    if (commit === "shaky") return 1;
    return 0;
  }, [typedMode, typedCorrect, commit]);

  if (!queue || !settings) return <p className="muted">Building session…</p>;

  if (!card) {
    return (
      <div>
        <h1>Session complete</h1>
        <div className="card center">
          <p className="stat-big">{done.reviewed}</p>
          <p className="muted">cards reviewed</p>
          <p>
            {done.correct} correct ·{" "}
            {done.reviewed ? Math.round((done.correct / done.reviewed) * 100) : 0}% ·{" "}
            {done.mastered} mastered
          </p>
        </div>
        <div className="card small muted">
          {counts.newQueued} new words still in the pipeline · comes back tomorrow, or lift
          the daily limit in Settings.
        </div>
        <button className="primary" style={{ width: "100%" }} onClick={load}>
          Reload / study more
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>
          {i + 1} / {queue.length}
        </span>
        <span className="center">{done.correct}✓</span>
        <span style={{ textAlign: "right" }}>
          <label className="small" style={{ display: "inline", margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto", marginRight: 6 }}
              checked={typedMode}
              onChange={(e) => setTypedMode(e.target.checked)}
            />
            type answer
          </label>
        </span>
      </div>

      <div className="card">
        <div className="center">
          <span className="pill dir">{isEs2En ? "ES → EN" : "EN → ES"}</span>
          <span className="pill">{card.word.pos}</span>
          {card.word.leech && <span className="pill leech">leech</span>}
        </div>
        <div className="prompt-word">{prompt}</div>
        <div className="prompt-sub small">
          {isEs2En ? "what does this mean?" : "say it in Spanish"}
        </div>

        {phase === "prompt" && typedMode && (
          <>
            <input
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={isEs2En ? "English…" : "Español…"}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTyped()}
            />
            <button className="primary" style={{ width: "100%", marginTop: 10 }} onClick={submitTyped}>
              Check
            </button>
          </>
        )}

        {phase === "prompt" && !typedMode && (
          <>
            <p className="center small muted" style={{ marginTop: 20 }}>
              commit first, then reveal:
            </p>
            <div className="grid2">
              <button className="rate-again" onClick={() => reveal("none")}>
                No idea
              </button>
              <button className="rate-hard" onClick={() => reveal("shaky")}>
                Shaky
              </button>
            </div>
            <button
              className="rate-good"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => reveal("know")}
            >
              I know it
            </button>
          </>
        )}

        {phase === "reveal" && (
          <>
            <div className="answer">{answer}</div>
            {typedMode && typedCorrect !== null && (
              <p className="center small" style={{ color: typedCorrect ? "var(--good)" : "var(--bad)" }}>
                {typedCorrect ? "✓ matched" : `✗ you wrote “${typed || "—"}”`}
              </p>
            )}
            {card.word.exampleEs && <p className="example">“{card.word.exampleEs}”</p>}
            {card.word.notes && <p className="center small muted">📝 {card.word.notes}</p>}

            <p className="center small muted" style={{ marginTop: 16 }}>
              how well did you recall it?
            </p>
            <div className="grid2">
              {(
                [
                  ["Again", 0, "rate-again"],
                  ["Hard", 1, "rate-hard"],
                  ["Good", 2, "rate-good"],
                  ["Easy", 3, "rate-easy"],
                ] as [string, Rating, string][]
              ).map(([label, r, cls]) => (
                <button
                  key={r}
                  className={cls}
                  style={r === suggested ? { outline: "2px solid currentColor" } : undefined}
                  onClick={() => rate(r)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {canUndo && (
        <button className="ghost small" style={{ width: "100%" }} onClick={undo}>
          ↩ Undo last
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
