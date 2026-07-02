"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { IconX, IconUsers, IconBuilding, IconLayers } from "@/components/Icons";

const API = "http://127.0.0.1:8000";

type School = { school_id: number; school_name: string };
type Program = {
  program_id: number;
  school_id: number;
  school_name: string;
  program_name: string;
  credit_weightage: number;
  total_eligible_students: number;
};
type Officer = { officer_id: number; name: string; phone: string; email: string; role: string };
type AssignedProgram = { program_id: number };

type Tab = "officers" | "schools" | "programs";

const TABS: { id: Tab; label: string }[] = [
  { id: "officers", label: "Officers" },
  { id: "schools", label: "Schools" },
  { id: "programs", label: "Programs" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<Tab>("officers");

  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [officerPrograms, setOfficerPrograms] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    try {
      const email = encodeURIComponent(session.user.email);
      const [sch, prog, off] = await Promise.all([
        fetch(`${API}/admin/schools?email=${email}`).then((res) => res.json()),
        fetch(`${API}/admin/programs?email=${email}`).then((res) => res.json()),
        fetch(`${API}/admin/officers?email=${email}`).then((res) => res.json()),
      ]);
      setSchools(sch);
      setPrograms(prog);
      setOfficers(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openOfficerModal = async (o: Officer) => {
    setEditingOfficer(o);
    try {
      const assigned: AssignedProgram[] = await fetch(
        `${API}/admin/officers/${o.officer_id}/programs?email=${encodeURIComponent(session!.user.email)}`
      ).then((res) => res.json());
      setOfficerPrograms(assigned.map((p) => p.program_id));
    } catch (e) {
      console.error(e);
    }
  };

  const saveOfficer = async () => {
    if (!editingOfficer || !session?.user?.email) return;
    setSaving(true);
    try {
      const email = encodeURIComponent(session.user.email);
      await fetch(`${API}/admin/officers/${editingOfficer.officer_id}?email=${email}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingOfficer.name, phone: editingOfficer.phone }),
      });

      const currentAssigned: AssignedProgram[] = await fetch(
        `${API}/admin/officers/${editingOfficer.officer_id}/programs?email=${email}`
      ).then((res) => res.json());
      const currentIds = currentAssigned.map((p) => p.program_id);

      const toAdd = officerPrograms.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !officerPrograms.includes(id));

      await Promise.all([
        ...toAdd.map((id) =>
          fetch(`${API}/admin/officers/${editingOfficer.officer_id}/programs/${id}?email=${email}`, { method: "POST" })
        ),
        ...toRemove.map((id) =>
          fetch(`${API}/admin/officers/${editingOfficer.officer_id}/programs/${id}?email=${email}`, { method: "DELETE" })
        ),
      ]);

      await fetchAll();
      setEditingOfficer(null);
    } catch (e) {
      console.error(e);
      alert("Error saving officer.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (session) {
      // @ts-ignore — role is added via better-auth additional fields
      const isAdmin = session.user.role === "admin" || session.user.email === "puneethasshankarbtech24@rvu.edu.in";
      if (!isAdmin) {
        router.push("/dashboard");
      } else {
        fetchAll();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (isPending) {
    return (
      <div className="app-page">
        <Navbar />
        <div className="state-loading">
          <div className="spinner" />
          Loading admin console
        </div>
      </div>
    );
  }

  // @ts-ignore — role is added via better-auth additional fields
  const isAdmin = session?.user?.role === "admin" || session?.user?.email === "puneethasshankarbtech24@rvu.edu.in";
  if (!isAdmin) return null;

  const count = activeTab === "officers" ? officers.length : activeTab === "schools" ? schools.length : programs.length;

  return (
    <div className="app-page">
      <Navbar />
      <div className="app-content">
        <div className="app-page-header animate-fade-in-up">
          <p className="app-page-eyebrow">Administration</p>
          <h1 className="app-page-title">Admin Console</h1>
        </div>

        {/* Tabs */}
        <div
          className="animate-fade-in-up stagger-2"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`neo-chip${activeTab === tab.id ? " active" : ""}`}
              style={{
                padding: "8px 18px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: "var(--surface-1)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="app-page-actions" style={{ marginBottom: 0 }}>
          <span className="app-count-label">
            {loading ? "Loading…" : `${count} ${activeTab}`}
          </span>
        </div>
        <div className="app-divider" />

        {/* Loading skeletons */}
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 180 }} />
            ))}
          </div>
        ) : (
          <div
            className="animate-fade-in-up stagger-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* Officers */}
            {activeTab === "officers" &&
              (officers.length === 0 ? (
                <div className="state-empty" style={{ gridColumn: "1 / -1" }}>
                  No officers found.
                </div>
              ) : (
                officers.map((o, idx) => (
                  <div
                    key={o.officer_id}
                    className={`neo-card-static animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}
                    style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          flexShrink: 0,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--accent-dim)",
                          border: "2px solid var(--accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 800,
                          fontSize: "1.1rem",
                          color: "var(--accent)",
                        }}
                      >
                        {o.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.01em" }}>{o.name}</h3>
                        <p
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "0.7rem",
                            color: "var(--muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {o.email}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span className={`badge ${o.role === "admin" ? "badge-purple" : "badge-ghost"}`}>{o.role}</span>
                      <button
                        onClick={() => openOfficerModal(o)}
                        className="neo-button btn-primary"
                        style={{ padding: "8px 16px", fontSize: "0.74rem", fontWeight: 700 }}
                      >
                        Edit &amp; Assign
                      </button>
                    </div>
                  </div>
                ))
              ))}

            {/* Schools */}
            {activeTab === "schools" &&
              (schools.length === 0 ? (
                <div className="state-empty" style={{ gridColumn: "1 / -1" }}>
                  No schools found.
                </div>
              ) : (
                schools.map((s, idx) => (
                  <div
                    key={s.school_id}
                    className={`neo-card-static animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}
                    style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, minHeight: 150 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="stat-label">ID {String(s.school_id).padStart(3, "0")}</span>
                      <IconBuilding size={18} />
                    </div>
                    <h3 style={{ fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                      {s.school_name}
                    </h3>
                  </div>
                ))
              ))}

            {/* Programs */}
            {activeTab === "programs" &&
              (programs.length === 0 ? (
                <div className="state-empty" style={{ gridColumn: "1 / -1" }}>
                  No programs found.
                </div>
              ) : (
                programs.map((p, idx) => (
                  <div
                    key={p.program_id}
                    className={`neo-card-static animate-fade-in-up stagger-${Math.min(idx + 1, 10)}`}
                    style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.01em" }}>{p.program_name}</h3>
                        <IconLayers size={17} />
                      </div>
                      <p
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "0.68rem",
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {p.school_name}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div
                        className="neo-card-static"
                        style={{ flex: 1, padding: "12px 14px", boxShadow: "none", borderRadius: "var(--radius-sm)" }}
                      >
                        <div className="stat-label">Weightage</div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: "1.1rem" }}>
                          {p.credit_weightage}x
                        </div>
                      </div>
                      <div
                        className="neo-card-static"
                        style={{ flex: 1, padding: "12px 14px", boxShadow: "none", borderRadius: "var(--radius-sm)" }}
                      >
                        <div className="stat-label">Capacity</div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: "1.1rem" }}>
                          {p.total_eligible_students}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ))}
          </div>
        )}
      </div>

      {/* Edit Officer Modal */}
      {editingOfficer && (
        <div className="modal-overlay" onClick={() => setEditingOfficer(null)}>
          <div
            className="modal-panel"
            style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Edit Officer — {editingOfficer.name}</h2>
              <button className="modal-close" aria-label="Close" onClick={() => setEditingOfficer(null)}>
                <IconX size={15} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <div className="field-group">
                <label className="field-label">Officer Name</label>
                <input
                  className="neo-input field-input"
                  value={editingOfficer.name}
                  onChange={(e) => setEditingOfficer({ ...editingOfficer, name: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Phone</label>
                <input
                  className="neo-input field-input"
                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                  value={editingOfficer.phone || ""}
                  onChange={(e) => setEditingOfficer({ ...editingOfficer, phone: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <IconUsers size={16} />
              <h3 style={{ fontSize: "0.92rem", fontWeight: 800, letterSpacing: "-0.01em" }}>Program Assignments</h3>
              <span className="app-count-label">
                {officerPrograms.length} selected
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
                maxHeight: 280,
                overflowY: "auto",
                padding: 12,
                border: "2px solid var(--card-border)",
                borderRadius: "var(--radius)",
                background: "var(--surface-1)",
                marginBottom: 24,
              }}
            >
              {programs.map((p) => {
                const isSelected = officerPrograms.includes(p.program_id);
                return (
                  <label
                    key={p.program_id}
                    className="neo-chip"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 12,
                      borderRadius: "var(--radius-sm)",
                      background: isSelected ? "var(--accent-dim)" : "var(--card)",
                      borderColor: isSelected ? "var(--accent)" : "var(--card-border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setOfficerPrograms([...officerPrograms, p.program_id]);
                        else setOfficerPrograms(officerPrograms.filter((id) => id !== p.program_id));
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.8rem", lineHeight: 1.2, color: "var(--foreground)" }}>
                        {p.program_name}
                      </span>
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "0.62rem",
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {p.school_name}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="neo-button btn-ghost"
                style={{ padding: "9px 18px", fontSize: "0.82rem", fontWeight: 600 }}
                onClick={() => setEditingOfficer(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="neo-button btn-primary"
                style={{ padding: "9px 20px", fontSize: "0.82rem", fontWeight: 700 }}
                onClick={saveOfficer}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
