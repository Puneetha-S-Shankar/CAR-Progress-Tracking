"use client";
import { useEffect, useCallback, useState } from "react";
import Navbar from "@/components/Navbar";
import { IconWarning, IconStar } from "@/components/Icons";

import { authClient } from "@/lib/auth-client";

const API = "http://127.0.0.1:8000";

interface DashboardData {
  current_pool: number; target: number; placed_this_month: number;
  minimum_hit: boolean; prism_credits: number; prism_score: number; promotion_flag: boolean;
}
interface HistoryRow {
  month: number; starting_pool: number; target: number;
  placed: number; prism_credits: number; score: number;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function StatCard({ label, value, accent, children }: {
  label: string; value?: React.ReactNode; accent?: boolean; children?: React.ReactNode;
}) {
  return (
    <div
      className="neo-card-static stat-card"
      style={accent ? { background: "var(--foreground)", color: "var(--background)" } : {}}
    >
      <div className="stat-label" style={accent ? { color: "rgba(255,255,255,0.5)" } : {}}>{label}</div>
      {value !== undefined && (
        <div className="stat-value" style={accent ? { color: "var(--accent-light)", fontSize: "clamp(2.2rem,5vw,4rem)" } : {}}>
          {value}
        </div>
      )}
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [histError, setHistError] = useState<string | null>(null);

  const { data: session, isPending } = authClient.useSession();
  const email = session?.user?.email;

  const fetchDashboard = useCallback(async () => {
    if (!email) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/dashboard/me?email=${encodeURIComponent(email)}&month=${month}&year=${year}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to fetch dashboard."); }
    finally { setLoading(false); }
  }, [month, year, email]);

  const fetchHistory = useCallback(async () => {
    if (!email) return;
    setHistLoading(true); setHistError(null);
    try {
      const res = await fetch(`${API}/dashboard/me/history?email=${encodeURIComponent(email)}&year=${year}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setHistory(await res.json());
    } catch (e: unknown) { setHistError(e instanceof Error ? e.message : "Failed to fetch history."); }
    finally { setHistLoading(false); }
  }, [year, email]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="app-page">
      <Navbar />
      <div className="app-content">
        {/* Header */}
        <div className="app-page-header animate-fade-in-up">
          <p className="app-page-eyebrow">PRISM Intelligence</p>
          <h1 className="app-page-title">Dashboard</h1>
        </div>

        {/* Period Selector */}
        <div className="animate-fade-in-up stagger-2" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <span className="field-label" style={{ marginBottom: 0 }}>Period</span>
          <select className="neo-input field-input field-select" style={{ width: "auto", minWidth: 120, padding: "8px 36px 8px 12px" }}
            value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="neo-input field-input field-select" style={{ width: "auto", minWidth: 96, padding: "8px 36px 8px 12px" }}
            value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {MONTHS[month - 1]} {year}
          </span>
        </div>

        {/* Promotion Banner */}
        {!loading && data?.promotion_flag && (
          <div className="promotion-banner animate-fade-in-up stagger-2">
            <IconStar size={20} />
            <span style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.01em" }}>
              Promotion Recommended — Outstanding placement performance this period.
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="state-error animate-fade-in-up" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconWarning size={15} /> {error}
          </div>
        )}

        {/* Bento Stat Grid */}
        {loading || isPending ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
          </div>
        ) : data ? (
          <div
            className="animate-fade-in-up stagger-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, gridAutoFlow: "dense", marginBottom: 48 }}
          >

            <StatCard label="Current Pool" value={data.current_pool} />
            <StatCard label="Monthly Target (10%)" value={data.target} />
            <StatCard label="Placed This Month" value={data.placed_this_month} />
            <StatCard label="Minimum Hit">
              <span className={`badge ${data.minimum_hit ? "badge-green" : "badge-red"}`}
                style={{ fontSize: "0.78rem", padding: "5px 14px", marginTop: 4 }}>
                {data.minimum_hit ? "YES" : "NO"}
              </span>
            </StatCard>
            <StatCard label="PRISM Credits Earned" value={data.prism_credits} />
          </div>
        ) : null}

        <div className="app-divider" />

        {/* History Table */}
        <div className="animate-fade-in-up stagger-4" style={{ marginTop: 36 }}>
          <div style={{ marginBottom: 18 }}>
            <p className="app-page-eyebrow">Year in Review — {year}</p>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.01em" }}>Monthly Breakdown</h2>
          </div>

          {histError && <div className="state-error">⚠ {histError}</div>}

          {histLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
            </div>
          ) : history.length === 0 ? (
            <div className="state-empty">No history for {year}.</div>
          ) : (
            <div className="app-table-wrap" style={{ overflowX: "auto" }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Starting Pool</th>
                    <th>Target</th>
                    <th>Placed</th>
                    <th>PRISM Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, idx) => (
                    <tr key={row.month} className={`animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}
                      style={row.month === month ? { outline: "2px solid var(--accent)", outlineOffset: "-1px" } : {}}>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: "0.82rem" }}>{MONTHS[row.month - 1]}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{row.starting_pool}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{row.target}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: row.placed >= row.target ? "var(--success)" : "inherit" }}>
                        {row.placed}
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{row.prism_credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
