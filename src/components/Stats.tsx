import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { todayKey } from "../lib/session";

const DAY = 86_400_000;

export default function Stats() {
  const data = useLiveQuery(async () => {
    const words = await db.words.toArray();
    const stats = await db.stats.toArray();
    const logs = await db.logs.toArray();

    const byStatus = (s: string) => words.filter((w) => w.status === s).length;
    const now = Date.now();

    // streak: consecutive days (ending today or yesterday) with >=1 review
    const daysWithReviews = new Set(stats.filter((s) => s.reviews > 0).map((s) => s.day));
    let streak = 0;
    for (let d = 0; d < 400; d++) {
      const key = todayKey(new Date(now - d * DAY));
      if (daysWithReviews.has(key)) streak++;
      else if (d > 0) break;
    }

    // 14-day forecast of cards coming due
    const forecast: number[] = Array(14).fill(0);
    for (const w of words) {
      if (w.status !== "review" && w.status !== "learning") continue;
      for (const dir of ["es_to_en", "en_to_es"] as const) {
        const bucket = Math.floor((w.dirs[dir].due - now) / DAY);
        if (bucket >= 0 && bucket < 14) forecast[bucket]++;
      }
    }

    const last30 = stats
      .filter((s) => s.day >= todayKey(new Date(now - 30 * DAY)))
      .sort((a, b) => a.day.localeCompare(b.day));
    const reviews30 = last30.reduce((n, s) => n + s.reviews, 0);
    const correct30 = last30.reduce((n, s) => n + s.correct, 0);

    return {
      total: words.length,
      mastered: byStatus("mastered"),
      review: byStatus("review"),
      learning: byStatus("learning"),
      leeches: words.filter((w) => w.leech && w.status !== "mastered").length,
      streak,
      forecast,
      reviews30,
      retention: reviews30 ? Math.round((correct30 / reviews30) * 100) : 0,
      totalReviews: logs.length,
      heat: last30,
    };
  });

  if (!data) return <p className="muted">Loading…</p>;
  const maxF = Math.max(1, ...data.forecast);

  return (
    <div>
      <h1>Progress</h1>
      <div className="grid2">
        <div className="card center">
          <div className="stat-big">{data.mastered}</div>
          <div className="muted small">mastered / archived</div>
        </div>
        <div className="card center">
          <div className="stat-big">{data.streak}🔥</div>
          <div className="muted small">day streak</div>
        </div>
        <div className="card center">
          <div className="stat-big">{data.retention}%</div>
          <div className="muted small">30-day retention</div>
        </div>
        <div className="card center">
          <div className="stat-big">{data.review + data.learning}</div>
          <div className="muted small">active words</div>
        </div>
      </div>

      <h2>Due in the next 14 days</h2>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
          {data.forecast.map((n, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div
                title={`${n} cards`}
                style={{
                  height: `${(n / maxF) * 70}px`,
                  background: i === 0 ? "var(--accent)" : "var(--easy)",
                  borderRadius: 3,
                  minHeight: n ? 3 : 0,
                }}
              />
              <div className="small muted">{i === 0 ? "now" : `+${i}`}</div>
            </div>
          ))}
        </div>
      </div>

      <h2>Last 30 days</h2>
      <div className="card">
        <p className="small muted">
          {data.reviews30} reviews · {data.totalReviews} all-time
          {data.leeches > 0 && ` · ${data.leeches} leeches need attention`}
        </p>
        <div className="heat">
          {Array.from({ length: 30 }).map((_, i) => {
            const key = todayKey(new Date(Date.now() - (29 - i) * DAY));
            const s = data.heat.find((h) => h.day === key);
            const n = s?.reviews ?? 0;
            const shade = n === 0 ? 0 : n < 10 ? 0.35 : n < 30 ? 0.6 : 1;
            return (
              <i
                key={key}
                title={`${key}: ${n}`}
                style={{ background: n ? `rgba(96,165,250,${shade})` : undefined }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
