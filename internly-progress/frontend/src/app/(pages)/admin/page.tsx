"use client";

import { useEffect, useState, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const API = "http://127.0.0.1:8000";

type School = { school_id: number; school_name: string };
type Program = { program_id: number; school_id: number; school_name: string; program_name: string; credit_weightage: number; total_eligible_students: number };
type Officer = { officer_id: number; name: string; phone: string; email: string; role: string };

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [activeTab, setActiveTab] = useState("officers");

  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);

  // Modal State
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [officerPrograms, setOfficerPrograms] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const fetchAll = async () => {
    if (!session?.user?.email) return;
    try {
      const [sch, prog, off] = await Promise.all([
        fetch(`${API}/admin/schools?email=${encodeURIComponent(session.user.email)}`).then(res => res.json()),
        fetch(`${API}/admin/programs?email=${encodeURIComponent(session.user.email)}`).then(res => res.json()),
        fetch(`${API}/admin/officers?email=${encodeURIComponent(session.user.email)}`).then(res => res.json()),
      ]);
      setSchools(sch);
      setPrograms(prog);
      setOfficers(off);
    } catch (e) {
      console.error(e);
    }
  };

  const openOfficerModal = async (o: Officer) => {
    setEditingOfficer(o);
    try {
      const assigned = await fetch(`${API}/admin/officers/${o.officer_id}/programs?email=${encodeURIComponent(session!.user.email)}`).then(res => res.json());
      setOfficerPrograms(assigned.map((p: any) => p.program_id));
    } catch (e) {
      console.error(e);
    }
  };

  const saveOfficer = async () => {
    if (!editingOfficer || !session?.user?.email) return;
    setSaving(true);
    try {
      await fetch(`${API}/admin/officers/${editingOfficer.officer_id}?email=${encodeURIComponent(session.user.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingOfficer.name,
          phone: editingOfficer.phone
        })
      });

      const currentAssigned = await fetch(`${API}/admin/officers/${editingOfficer.officer_id}/programs?email=${encodeURIComponent(session.user.email)}`).then(res => res.json());
      const currentIds = currentAssigned.map((p: any) => p.program_id);
      
      const toAdd = officerPrograms.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter((id: number) => !officerPrograms.includes(id));

      await Promise.all([
        ...toAdd.map(id => fetch(`${API}/admin/officers/${editingOfficer.officer_id}/programs/${id}?email=${encodeURIComponent(session.user.email)}`, { method: "POST" })),
        ...toRemove.map((id: number) => fetch(`${API}/admin/officers/${editingOfficer.officer_id}/programs/${id}?email=${encodeURIComponent(session.user.email)}`, { method: "DELETE" }))
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
      // @ts-ignore
      const isAdmin = session.user.role === "admin" || session.user.email === "puneethasshankarbtech24@rvu.edu.in";
      if (!isAdmin) {
        router.push("/dashboard");
      } else {
        fetchAll();
      }
    }
  }, [session]);

  useGSAP(() => {
    if (!isPending) {
      gsap.from(".bento-card", {
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.05,
        ease: "power4.out",
      });
    }
  }, [activeTab, officers, schools, programs, isPending]);

  if (isPending) return <div className="state-loading">Loading Admin...</div>;
  // @ts-ignore
  const isAdmin = session?.user?.role === "admin" || session?.user?.email === "puneethasshankarbtech24@rvu.edu.in";
  if (!isAdmin) return null;

  return (
    <main className="overflow-x-hidden w-full max-w-full min-h-screen bg-[var(--background)]" ref={containerRef}>
      <div className="container mx-auto px-6 py-24 md:py-32 max-w-7xl">
        
        {/* HERO SECTION */}
        <header className="mb-24">
          <h1 className="text-[clamp(3rem,6vw,6rem)] font-extrabold leading-[1.05] tracking-tight max-w-5xl mb-8">
            System Control <br/> Architecture
          </h1>
          <p className="text-xl text-[var(--muted)] max-w-2xl font-medium leading-relaxed">
            Manage your elite roster of placement officers, coordinate university schools, and structure advanced academic programs.
          </p>
        </header>

        {/* BENTO TABS */}
        <div className="flex flex-wrap gap-4 mb-16">
          {["officers", "schools", "programs"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 rounded-full font-bold text-lg uppercase tracking-wider transition-all duration-300 ${
                activeTab === tab 
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-[0_0_30px_rgba(139,92,246,0.3)] scale-105" 
                  : "bg-transparent border-2 border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 grid-flow-dense">
          
          {activeTab === "officers" && officers.map(o => (
            <div key={o.officer_id} className="bento-card neo-card p-8 flex flex-col justify-between group overflow-hidden relative min-h-[300px]">
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-full bg-[var(--accent-dim)] border-2 border-[var(--accent)] flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-[var(--accent)]">{o.name.charAt(0)}</span>
                </div>
                <h3 className="text-2xl font-bold mb-2">{o.name}</h3>
                <p className="text-[var(--muted)] font-mono text-sm mb-4">{o.email}</p>
              </div>
              
              <div className="mt-8 relative z-10">
                <button 
                  onClick={() => openOfficerModal(o)}
                  className="w-full neo-button btn-primary py-3 text-sm tracking-widest font-bold uppercase"
                >
                  Configure Routing
                </button>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)] opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000 ease-out"></div>
            </div>
          ))}

          {activeTab === "schools" && schools.map((s, idx) => (
            <div key={s.school_id} className={`bento-card neo-card p-8 flex flex-col justify-between ${idx % 3 === 0 ? 'md:col-span-2' : ''} min-h-[250px]`}>
              <div>
                <span className="text-[var(--accent)] font-mono font-bold tracking-widest text-sm mb-4 block">NODE // {s.school_id.toString().padStart(3, '0')}</span>
                <h3 className="text-3xl font-extrabold leading-tight">{s.school_name}</h3>
              </div>
              <div className="mt-8 flex justify-end">
                <div className="w-12 h-12 rounded-full border-2 border-[var(--card-border)] flex items-center justify-center">
                  <span className="block w-4 h-4 bg-[var(--foreground)] rounded-full"></span>
                </div>
              </div>
            </div>
          ))}

          {activeTab === "programs" && programs.map(p => (
            <div key={p.program_id} className="bento-card neo-card p-8 flex flex-col justify-between min-h-[300px]">
              <div>
                <h3 className="text-xl font-bold mb-4">{p.program_name}</h3>
                <p className="text-[var(--muted)] font-mono text-sm mb-6 uppercase tracking-widest border-b border-[var(--card-border)] pb-4">
                  {p.school_name}
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[var(--muted)]">Weightage</span>
                    <span className="font-mono font-bold">{p.credit_weightage}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[var(--muted)]">Capacity</span>
                    <span className="font-mono font-bold">{p.total_eligible_students}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
        </div>
      </div>

      {/* MODAL */}
      {editingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.8)] backdrop-blur-md animate-fade-in px-4" onClick={() => setEditingOfficer(null)}>
          <div className="neo-card bg-[var(--card)] p-8 md:p-12 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-extrabold mb-8 tracking-tight">Configure Officer: {editingOfficer.name}</h2>
            
            <div className="space-y-6 mb-10">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[var(--muted)]">Officer Name</label>
                <input 
                  className="neo-input w-full p-4 font-medium" 
                  value={editingOfficer.name} 
                  onChange={e => setEditingOfficer({...editingOfficer, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[var(--muted)]">Contact Metric</label>
                <input 
                  className="neo-input w-full p-4 font-mono" 
                  value={editingOfficer.phone || ""} 
                  onChange={e => setEditingOfficer({...editingOfficer, phone: e.target.value})}
                />
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4 tracking-tight">Program Assignments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto p-4 border-2 border-[var(--card-border)] rounded-[var(--radius)] mb-10 bg-[var(--surface-1)]">
              {programs.map(p => {
                const isSelected = officerPrograms.includes(p.program_id);
                return (
                  <label 
                    key={p.program_id} 
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${isSelected ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--muted)]'}`}
                  >
                    <input 
                      type="checkbox" 
                      className="mt-1 w-5 h-5 accent-[var(--accent)] cursor-pointer"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setOfficerPrograms([...officerPrograms, p.program_id]);
                        else setOfficerPrograms(officerPrograms.filter(id => id !== p.program_id));
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-sm leading-tight mb-1">{p.program_name}</span>
                      <span className="text-xs font-mono text-[var(--muted)] uppercase">{p.school_name}</span>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-4 justify-end">
              <button className="neo-button btn-ghost px-8 py-4 uppercase tracking-widest text-sm font-bold" onClick={() => setEditingOfficer(null)}>Cancel</button>
              <button className="neo-button btn-primary px-8 py-4 uppercase tracking-widest text-sm font-bold" onClick={saveOfficer} disabled={saving}>
                {saving ? "Deploying..." : "Commit Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
