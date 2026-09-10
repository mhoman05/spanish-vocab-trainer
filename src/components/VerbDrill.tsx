import { useCallback, useEffect, useMemo, useState } from "react";
import { getSettings } from "../db";
import type { DrillCard, Rating, Settings } from "../types";
import { PERSONS, TENSE_LABEL } from "../lib/conjugation";
import {
  applyDrillRating,
  buildDrillQueue,
  checkDrillAnswer,
  drillCounts,
} from "../lib/drills";

type Phase = "prompt" | "reveal";

export default function VerbDrill() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<DrillCard[] | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [commit, setCommit] = useState<"none" | "shaky" | "know" | null>(null);
  const [typed, setTyped] = useState("");
  const [typedMode, setTypedMode] = useState(false);
  const [typedCorrect, setTypedCorrect] = useState<boolean | null>(null);
  const [done, setDone] = useState({ reviewed: 0, correct: 0, mastered: 0 });
  const [counts, setCounts] = useState({ remaining: 0, mastered: 0, total: 0 });
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    setTypedMode(s.defaultTyped);
    setQueue(await buildDrillQueue());
    const c = await drillCounts();
    setCounts({ remaining: c.remaining, mastered: c.mastered, total: c.total });
    setI(0);
    setPhase("prompt");
    setCommit(null);
    setTyped("");
    setTypedCorrect(null);
    setDone({ reviewed: 0, correct: 0, mastered: 0 });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const card = queue && i < queue.length ? queue[i] : null;
  const person = card ? PERSONS[card.person] : null;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  function submitTyped() {
    if (!card || !settings) return;
    const ok = checkDrillAnswer(typed, card.answer, settings.accentSensitive);
    setTypedCorrect(ok);
    setCommit(ok ? "know" : "none");
    setPhase("reveal");
  }

  async function rate(rating: Rating) {
    if (!card) return;
    const res = await applyDrillRating(card, rating, typedMode);
    setDone((d) => ({
      reviewed: d.reviewed + 1,
      correct: d.correct + (rating >= 2 ? 1 : 0),
      mastered: d.mastered + (res.mastered ? 1 : 0),
    }));
    if (res.mastered) flash(`🏆 ${card.verb} · ${card.tense} · ${person?.es} nailed down`);

    if (rating === 0 && queue) {
      const q = [...queue];
      q.splice(Math.min(i + 6, q.length), 0, card);
      setQueue(q);
    }
    setI((n) => n + 1);
    setPhase("prompt");
    setCommit(null);
    setTyped("");
    setTypedCorrect(null);
  }

  const suggested: Rating = useMemo(() => {
    if (typedMode) return typedCorrect ? 2 : 0;
    if (commit === "know") return 2;
    if (commit === "shaky") return 1;
    return 0;
  }, [typedMode, typedCorrect, commit]);

  if (!queue || !settings) return <p className="muted">Building session…</p>;

  if (!card || !person) {
    return (
      <div>
        <h1>Verbs done</h1>
        <div className="card center">
          <p className="stat-big">{done.reviewed}</p>
          <p className="muted">forms drilled · {done.correct} correct · {done.mastered} mastered</p>
        </div>
        <div className="card small muted">
          {counts.mastered} / {counts.total} forms mastered · {counts.remaining} not yet introduced.
          More unlock tomorrow, or raise the daily limit in Settings.
        </div>
        <button className="primary" style={{ width: "100%" }} onClick={load}>
          Reload / drill more
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>{i + 1} / {queue.length}</span>
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
          <span className="pill dir">{card.verb}</span>
          <span className="pill">{card.gloss}</span>
          {card.leech && <span className="pill leech">leech</span>}
        </div>

        <div className="prompt-word" style={{ fontSize: "1.5rem" }}>{card.cue}</div>
        <div className="prompt-sub small">
          conjugate <b>{card.verb}</b> for <b>{person.es}</b>
        </div>
        <div className="center small muted">{TENSE_LABEL[card.tense]}</div>

        {phase === "prompt" && typedMode && (
          <>
            <input
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Spanish form…"
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
            <p className="center small muted" style={{ marginTop: 20 }}>commit first, then reveal:</p>
            <div className="grid2">
              <button className="rate-again" onClick={() => { setCommit("none"); setPhase("reveal"); }}>
                No idea
              </button>
              <button className="rate-hard" onClick={() => { setCommit("shaky"); setPhase("reveal"); }}>
                Shaky
              </button>
            </div>
            <button
              className="rate-good"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => { setCommit("know"); setPhase("reveal"); }}
            >
              I know it
            </button>
          </>
        )}

        {phase === "reveal" && (
          <>
            <div className="answer">{person.es.split(" / ")[0]} {card.answer}</div>
            {typedMode && typedCorrect !== null && (
              <p className="center small" style={{ color: typedCorrect ? "var(--good)" : "var(--bad)" }}>
                {typedCorrect ? "✓ matched" : `✗ you wrote “${typed || "—"}”`}
              </p>
            )}
            <p className="center small muted" style={{ marginTop: 16 }}>how well did you recall it?</p>
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
