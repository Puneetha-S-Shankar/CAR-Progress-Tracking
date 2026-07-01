"use client";
import { useEffect, useCallback, useState } from "react";
import Navbar from "@/components/Navbar";
import Toast, { type ToastType } from "@/components/Toast";
import { IconPlus, IconWarning, IconX } from "@/components/Icons";
import { authClient } from "@/lib/auth-client";

const API = "http://127.0.0.1:8000";

interface Company { company_id: number; company_name: string; }
interface Drive { drive_id: number; company_id: number; drive_type: string; }
interface Placement {
  placement_id: number; student_name: string; usn: string;
  program_name: string; company_name: string; drive_type: string;
  package_lpa: string | null; offer_status: "offered" | "accepted" | "rejected";
}
interface StudentInfo { student_id: number; name: string; school_name: string; program_name: string; }

const STATUS_BADGE: Record<string, string> = { offered: "badge-yellow", accepted: "badge-green", rejected: "badge-red" };

export default function PlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [fUsn, setFUsn] = useState("");
  const [fStudent, setFStudent] = useState<StudentInfo | null>(null);
  const [fUsnError, setFUsnError] = useState<string | null>(null);
  const [fUsnLoading, setFUsnLoading] = useState(false);
  const [fCompany, setFCompany] = useState("");
  const [fDrive, setFDrive] = useState("");
  const [fType, setFType] = useState("full_time");
  const [fPackage, setFPackage] = useState("");
  const [fStatus, setFStatus] = useState("offered");

  const resetForm = () => {
    setFUsn(""); setFStudent(null); setFUsnError(null);
    setFCompany(""); setFDrive(""); setFType("full_time"); setFPackage(""); setFStatus("offered");
  };

  const { data: session } = authClient.useSession();
  const email = session?.user?.email;

  const fetchPlacements = useCallback(async () => {
    if (!email) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/placements?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setPlacements(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to fetch placements."); }
    finally { setLoading(false); }
  }, [email]);

  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch(`${API}/companies`); if (res.ok) setCompanies(await res.json()); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  const openModal = () => { fetchCompanies(); setModalOpen(true); };

  const handleCompanyChange = async (id: string) => {
    setFCompany(id); setFDrive("");
    if (!id) { setDrives([]); return; }
    try { const res = await fetch(`${API}/drives?company_id=${id}`); if (res.ok) setDrives(await res.json()); } catch { /* non-critical */ }
  };

  const handleUsnBlur = async () => {
    if (!fUsn.trim()) return;
    setFUsnLoading(true); setFUsnError(null); setFStudent(null);
    try {
      const res = await fetch(`${API}/students/usn/${encodeURIComponent(fUsn.trim())}`);
      if (res.status === 404) { setFUsnError("Student not found for this USN."); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setFStudent(await res.json());
    } catch (e: unknown) { setFUsnError(e instanceof Error ? e.message : "Lookup failed."); }
    finally { setFUsnLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fStudent || !fDrive || !email) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/placements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: fStudent.student_id, email: email,
          drive_id: Number(fDrive), placement_type: fType,
          package_lpa: fPackage ? Number(fPackage) : null, offer_status: fStatus,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setModalOpen(false); resetForm();
      const prism = data?.prism_score;
      setToast({ message: prism != null ? `Placement added. Your PRISM score is now ${prism}.` : "Placement added successfully.", type: "success" });
      await fetchPlacements();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "Failed to add placement.", type: "error" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="app-page">
      <Navbar />
      <div className="app-content">
        <div className="app-page-header animate-fade-in-up">
          <p className="app-page-eyebrow">Placement Ledger</p>
          <h1 className="app-page-title">Placements</h1>
        </div>

        <div className="app-page-actions animate-fade-in-up stagger-2">
          <span className="app-count-label">{loading ? "Loading…" : `${placements.length} placements recorded`}</span>
          <button className="neo-button btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }} onClick={openModal}>
            <IconPlus size={15} /> Add Placement
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
          <div className="animate-fade-in-up stagger-3" style={{ overflowX: "auto" }}>
            {placements.length === 0 ? (
              <div className="state-empty">No placements recorded yet. Add one above.</div>
            ) : (
              <div className="app-table-wrap">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>#</th>
                      <th>Student</th>
                      <th>USN</th>
                      <th>Program</th>
                      <th>Company</th>
                      <th>Type</th>
                      <th>Package</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((p, idx) => (
                      <tr key={p.placement_id} className={`animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}>
                        <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600 }}>{String(p.placement_id).padStart(3, "0")}</span></td>
                        <td style={{ fontWeight: 700 }}>{p.student_name}</td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem", color: "var(--muted)" }}>{p.usn}</td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem" }}>{p.program_name}</td>
                        <td>{p.company_name}</td>
                        <td><span className="badge badge-ghost">{p.drive_type}</span></td>
                        <td style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{p.package_lpa ? `₹${p.package_lpa} LPA` : "—"}</td>
                        <td><span className={`badge ${STATUS_BADGE[p.offer_status] ?? "badge-ghost"}`}>{p.offer_status.toUpperCase()}</span></td>
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
          <div className="modal-panel" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Placement</h2>
              <button className="modal-close" aria-label="Close" onClick={() => { setModalOpen(false); resetForm(); }}><IconX size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* USN Lookup */}
              <div className="field-group">
                <label className="field-label" htmlFor="p_usn">USN</label>
                <input id="p_usn" className="neo-input field-input" type="text" placeholder="e.g. 1RV21CS001"
                  value={fUsn} onChange={(e) => setFUsn(e.target.value)} onBlur={handleUsnBlur} required
                  style={fUsnError ? { borderColor: "var(--error)" } : {}} />
                {fUsnLoading && <p className="field-error">Looking up student…</p>}
                {fUsnError && (
                  <p className="field-error" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <IconWarning size={13} /> {fUsnError}
                  </p>
                )}
              </div>

              {/* Auto-fill */}
              {fStudent && (
                <div className="info-box" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                  {[{ label: "Name", value: fStudent.name }, { label: "School", value: fStudent.school_name }, { label: "Program", value: fStudent.program_name }].map(f => (
                    <div key={f.label}>
                      <div className="field-label" style={{ marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="field-group">
                <label className="field-label" htmlFor="p_company">Company</label>
                <select id="p_company" className="neo-input field-input field-select" value={fCompany} onChange={(e) => handleCompanyChange(e.target.value)} required>
                  <option value="">— Select Company —</option>
                  {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="p_drive">Drive</label>
                <select id="p_drive" className="neo-input field-input field-select" value={fDrive} onChange={(e) => setFDrive(e.target.value)} required disabled={!fCompany}>
                  <option value="">{fCompany ? "— Select Drive —" : "Select a company first"}</option>
                  {drives.map((d) => <option key={d.drive_id} value={d.drive_id}>Drive #{d.drive_id} — {d.drive_type}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="field-group">
                  <label className="field-label" htmlFor="p_type">Placement Type</label>
                  <select id="p_type" className="neo-input field-input field-select" value={fType} onChange={(e) => setFType(e.target.value)}>
                    <option value="full_time">Full Time</option>
                    <option value="internship">Internship</option>
                    <option value="capstone">Capstone</option>
                    <option value="higher_studies">Higher Studies</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="p_status">Offer Status</label>
                  <select id="p_status" className="neo-input field-input field-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                    <option value="offered">Offered</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="p_pkg">Package LPA</label>
                <input id="p_pkg" className="neo-input field-input" type="number" step="0.1" min="0" placeholder="e.g. 8.5" value={fPackage} onChange={(e) => setFPackage(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="neo-button btn-ghost" style={{ padding: "9px 18px", fontSize: "0.82rem", fontWeight: 600 }}
                  onClick={() => { setModalOpen(false); resetForm(); }} disabled={submitting}>Cancel</button>
                <button type="submit" className="neo-button btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }}
                  disabled={submitting || !fStudent}>{submitting ? "Saving…" : "Add Placement"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="toast-container">{toast && <Toast message={toast.message} type={toast.type} duration={4000} onDone={() => setToast(null)} />}</div>
    </div>
  );
}
