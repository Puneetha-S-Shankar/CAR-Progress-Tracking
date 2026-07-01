"use client";
import { useEffect, useCallback, useState } from "react";
import Navbar from "@/components/Navbar";
import Toast, { type ToastType } from "@/components/Toast";
import { IconPlus, IconWarning, IconX } from "@/components/Icons";
import { authClient } from "@/lib/auth-client";

const API = "http://127.0.0.1:8000";

interface Company { company_id: number; company_name: string; }
interface Drive {
  drive_id: number; company_id: number; company_name?: string;
  drive_date: string | null; drive_type: string;
  min_package_lpa: string | null; max_package_lpa: string | null;
  is_rvce_drive: boolean;
}

const DRIVE_TYPE_LABELS: Record<string, string> = { full_time: "Full Time", internship: "Internship", capstone: "Capstone" };
const DRIVE_TYPE_BADGE: Record<string, string> = { full_time: "badge-green", internship: "badge-yellow", capstone: "badge-ghost" };

export default function DrivesPage() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [fCompany, setFCompany] = useState("");
  const [fDate, setFDate] = useState("");
  const [fType, setFType] = useState("full_time");
  const [fMinLpa, setFMinLpa] = useState("");
  const [fMaxLpa, setFMaxLpa] = useState("");
  const [fRvce, setFRvce] = useState(false);

  const resetForm = () => { setFCompany(""); setFDate(""); setFType("full_time"); setFMinLpa(""); setFMaxLpa(""); setFRvce(false); };

  const fetchDrives = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/drives`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setDrives(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to fetch drives."); }
    finally { setLoading(false); }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch(`${API}/companies`); if (res.ok) setCompanies(await res.json()); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);

  const openModal = () => { fetchCompanies(); setModalOpen(true); };

  const { data: session } = authClient.useSession();
  const email = session?.user?.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fCompany || !email) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/drives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: Number(fCompany), email: email,
          drive_date: fDate || null, drive_type: fType,
          min_package_lpa: fMinLpa ? Number(fMinLpa) : null,
          max_package_lpa: fMaxLpa ? Number(fMaxLpa) : null,
          is_rvce_drive: fRvce,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setModalOpen(false); resetForm();
      setToast({ message: "Drive added successfully.", type: "success" });
      await fetchDrives();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "Failed to add drive.", type: "error" });
    } finally { setSubmitting(false); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const formatLpa  = (v: string | null) => v ? `₹${v} LPA` : "—";

  return (
    <div className="app-page">
      <Navbar />
      <div className="app-content">
        <div className="app-page-header animate-fade-in-up">
          <p className="app-page-eyebrow">Drive Registry</p>
          <h1 className="app-page-title">Drives</h1>
        </div>

        <div className="app-page-actions animate-fade-in-up stagger-2">
          <span className="app-count-label">{loading ? "Loading…" : `${drives.length} drives logged`}</span>
          <button className="neo-button btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }} onClick={openModal}>
            <IconPlus size={15} /> Add Drive
          </button>
        </div>
        <div className="app-divider" />

        {error && (
          <div className="state-error animate-fade-in-up" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconWarning size={15} /> {error}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        )}

        {!loading && !error && (
          <div className="animate-fade-in-up stagger-3">
            {drives.length === 0 ? (
              <div className="state-empty">No drives logged yet. Add one above.</div>
            ) : (
              <div className="app-table-wrap" style={{ overflowX: "auto" }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>#</th>
                      <th>Company</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Min LPA</th>
                      <th>Max LPA</th>
                      <th>RVCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drives.map((d, idx) => (
                      <tr key={d.drive_id} className={`animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}>
                        <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>{String(d.drive_id).padStart(3, "0")}</span></td>
                        <td style={{ fontWeight: 600 }}>{d.company_name ?? `Company #${d.company_id}`}</td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem" }}>{formatDate(d.drive_date)}</td>
                        <td><span className={`badge ${DRIVE_TYPE_BADGE[d.drive_type] ?? "badge-ghost"}`}>{DRIVE_TYPE_LABELS[d.drive_type] ?? d.drive_type}</span></td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem", fontWeight: 600 }}>{formatLpa(d.min_package_lpa)}</td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem", fontWeight: 600 }}>{formatLpa(d.max_package_lpa)}</td>
                        <td><span className={`badge ${d.is_rvce_drive ? "badge-purple" : "badge-ghost"}`}>{d.is_rvce_drive ? "YES" : "NO"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); resetForm(); } }}>
          <div className="modal-panel" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Drive</h2>
              <button className="modal-close" aria-label="Close" onClick={() => { setModalOpen(false); resetForm(); }}><IconX size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="d_company">Company</label>
                <select id="d_company" className="neo-input field-input field-select" value={fCompany} onChange={(e) => setFCompany(e.target.value)} required>
                  <option value="">— Select Company —</option>
                  {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="d_date">Drive Date</label>
                  <input id="d_date" className="neo-input field-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="d_type">Drive Type</label>
                  <select id="d_type" className="neo-input field-input field-select" value={fType} onChange={(e) => setFType(e.target.value)}>
                    <option value="full_time">Full Time</option>
                    <option value="internship">Internship</option>
                    <option value="capstone">Capstone</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="d_min">Min Package LPA</label>
                  <input id="d_min" className="neo-input field-input" type="number" step="0.1" min="0" placeholder="e.g. 4.5" value={fMinLpa} onChange={(e) => setFMinLpa(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="d_max">Max Package LPA</label>
                  <input id="d_max" className="neo-input field-input" type="number" step="0.1" min="0" placeholder="e.g. 12.0" value={fMaxLpa} onChange={(e) => setFMaxLpa(e.target.value)} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">RVCE Drive?</label>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn${fRvce ? " active" : ""}`} onClick={() => setFRvce(true)}>Yes</button>
                  <button type="button" className={`toggle-btn${!fRvce ? " active" : ""}`} onClick={() => setFRvce(false)}>No</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="neo-button btn-ghost" style={{ padding: "9px 18px", fontSize: "0.82rem", fontWeight: 600 }}
                  onClick={() => { setModalOpen(false); resetForm(); }} disabled={submitting}>Cancel</button>
                <button type="submit" className="neo-button btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }} disabled={submitting}>
                  {submitting ? "Saving…" : "Add Drive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="toast-container">{toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}</div>
    </div>
  );
}
