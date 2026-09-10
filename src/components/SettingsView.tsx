import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, db, getSettings, saveSettings } from "../db";
import type { Settings } from "../types";

export default function SettingsView() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    if (!s) return;
    const next = { ...s, [k]: v };
    setS(next);
    saveSettings({ [k]: v } as Partial<Settings>);
  }

  async function exportData() {
    const dump = {
      version: 1,
      exportedAt: new Date().toISOString(),
      words: await db.words.toArray(),
      logs: await db.logs.toArray(),
      stats: await db.stats.toArray(),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(dump)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File) {
    const data = JSON.parse(await file.text());
    if (!data.words) return setMsg("Not a valid backup file");
    await db.transaction("rw", db.words, db.logs, db.stats, db.settings, async () => {
      await Promise.all([db.words.clear(), db.logs.clear(), db.stats.clear(), db.settings.clear()]);
      await db.words.bulkPut(data.words);
      if (data.logs) await db.logs.bulkPut(data.logs);
      if (data.stats) await db.stats.bulkPut(data.stats);
      if (data.settings) await db.settings.bulkPut(data.settings);
    });
    setMsg(`Restored ${data.words.length} words. Reloading…`);
    setTimeout(() => location.reload(), 800);
  }

  async function resetProgress() {
    if (!confirm("Reset ALL progress and rebuild from words.json? This cannot be undone.")) return;
    await db.delete();
    location.reload();
  }

  if (!s) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>Settings</h1>

      <div className="card">
        <label>New words per day: {s.newPerDay}</label>
        <input type="range" min={0} max={50} value={s.newPerDay}
          onChange={(e) => update("newPerDay", +e.target.value)} />

        <label>Session size (cards, 0 = unlimited): {s.sessionSize}</label>
        <input type="range" min={0} max={120} step={5} value={s.sessionSize}
          onChange={(e) => update("sessionSize", +e.target.value)} />

        <label>Production bias (EN→ES share): {Math.round(s.directionBias * 100)}%</label>
        <input type="range" min={0.3} max={1} step={0.05} value={s.directionBias}
          onChange={(e) => update("directionBias", +e.target.value)} />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={s.defaultTyped}
            onChange={(e) => update("defaultTyped", e.target.checked)} />
          Default to typed answers
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={s.accentSensitive}
            onChange={(e) => update("accentSensitive", e.target.checked)} />
          Require correct accents when typing
        </label>
      </div>

      <h2>Mastery threshold</h2>
      <div className="card">
        <label>Interval before a word is archived: {s.masteryIntervalDays} days</label>
        <input type="range" min={30} max={365} step={10} value={s.masteryIntervalDays}
          onChange={(e) => update("masteryIntervalDays", +e.target.value)} />
        <label>Minimum successful reviews: {s.masteryMinReps}</label>
        <input type="range" min={3} max={12} value={s.masteryMinReps}
          onChange={(e) => update("masteryMinReps", +e.target.value)} />
        <label>Leech flag after N lapses: {s.leechThreshold}</label>
        <input type="range" min={4} max={15} value={s.leechThreshold}
          onChange={(e) => update("leechThreshold", +e.target.value)} />
      </div>

      <h2>Backup</h2>
      <div className="card">
        <div className="row">
          <button className="primary" onClick={exportData}>Export JSON</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden
          onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <p className="small muted" style={{ marginTop: 8 }}>
          Everything lives in this browser only. Export regularly, or before switching phones.
        </p>
      </div>

      <h2 style={{ color: "var(--bad)" }}>Danger</h2>
      <div className="card">
        <button className="ghost" style={{ width: "100%", borderColor: "var(--bad)", color: "var(--bad)" }}
          onClick={resetProgress}>
          Wipe & rebuild from word list
        </button>
        <button className="ghost small" style={{ width: "100%", marginTop: 8 }}
          onClick={() => { saveSettings(DEFAULT_SETTINGS); setS(DEFAULT_SETTINGS); }}>
          Restore default settings
        </button>
      </div>

      {msg && <p className="small" style={{ color: "var(--good)" }}>{msg}</p>}
      <p className="small muted center" style={{ marginTop: 24 }}>
        Word data: Davies, <i>A Frequency Dictionary of Spanish</i> (Routledge, 2006)
      </p>
    </div>
  );
}
