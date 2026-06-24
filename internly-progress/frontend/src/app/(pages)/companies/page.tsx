"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import Navbar from "@/components/Navbar";

const API = "http://127.0.0.1:8000";

interface Company { company_id: number; company_name: string; }

function Toast({ message, type = "accent", onDone }: { message: string; type?: "accent" | "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "◆";
  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{icon}</div>
      <span>{message}</span>
    </div>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "accent" | "success" | "error" } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/companies`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setCompanies(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch companies.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const openModal = () => { setModalOpen(true); setTimeout(() => inputRef.current?.focus(), 80); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName.trim() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setModalOpen(false); setCompanyName("");
      setToast({ message: "Company added successfully.", type: "success" });
      await fetchCompanies();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "Failed to add company.", type: "error" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="app-page">
      <Navbar />
      <div className="app-content">
        {/* Header */}
        <div className="app-page-header animate-fade-in-up">
          <p className="app-page-eyebrow">Registry</p>
          <h1 className="app-page-title">Companies</h1>
        </div>

        {/* Actions */}
        <div className="app-page-actions animate-fade-in-up stagger-2">
          <span className="app-count-label">
            {loading ? "Loading…" : `${companies.length} companies`}
          </span>
          <button
            className="neo-button btn-primary"
            style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }}
            onClick={openModal}
          >
            + Add Company
          </button>
        </div>

        <div className="app-divider" />

        {error && <div className="state-error animate-fade-in-up">⚠ {error}</div>}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="animate-fade-in-up stagger-3">
            {companies.length === 0 ? (
              <div className="state-empty">No companies found. Add one above.</div>
            ) : (
              <div className="app-table-wrap">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>#</th>
                      <th>Company Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c, idx) => (
                      <tr key={c.company_id}>
                        <td>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>
                            {String(c.company_id).padStart(3, "0")}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }} className={`animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}>
                          {c.company_name}
                        </td>
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
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setCompanyName(""); } }}>
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Company</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setCompanyName(""); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="company_name">Company Name</label>
                <input
                  id="company_name"
                  ref={inputRef}
                  className="neo-input field-input"
                  type="text"
                  placeholder="e.g. Infosys Technologies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="neo-button btn-ghost" style={{ padding: "9px 18px", fontSize: "0.82rem", fontWeight: 600 }}
                  onClick={() => { setModalOpen(false); setCompanyName(""); }} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="neo-button btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }} disabled={submitting}>
                  {submitting ? "Saving…" : "Add Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    </div>
  );
}
