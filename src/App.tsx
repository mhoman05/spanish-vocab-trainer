import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { ensureSeeded } from "./lib/seed";
import Review from "./components/Review";
import Browse from "./components/Browse";
import AddWord from "./components/AddWord";
import Stats from "./components/Stats";
import SettingsView from "./components/SettingsView";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="app">
      <div className="content">
        {error && <div className="card" style={{ borderColor: "var(--bad)" }}>{error}</div>}
        {!ready && !error && <p className="muted">Loading vocabulary…</p>}
        {ready && (
          <Routes>
            <Route path="/" element={<Review />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/add" element={<AddWord />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        )}
      </div>
      <nav className="nav">
        <NavLink to="/" end><span>🎯</span>Study</NavLink>
        <NavLink to="/browse"><span>📚</span>Words</NavLink>
        <NavLink to="/add"><span>➕</span>Add</NavLink>
        <NavLink to="/stats"><span>📊</span>Stats</NavLink>
        <NavLink to="/settings"><span>⚙️</span>Settings</NavLink>
      </nav>
    </div>
  );
}
