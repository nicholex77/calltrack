import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { CSS } from "./styles";
import { uid, todayKey, weekStart, addDays } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { AVATAR_COLORS } from "./lib/constants";
import { getPreviewRows, buildPerformanceSummary } from "./lib/export-data";
import { generatePDF } from "./lib/pdf-export";
import { LoginScreen } from "./components/LoginScreen";
import { AgentPickerScreen } from "./components/AgentPickerScreen";
import { AppShell } from "./components/AppShell";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";
import { useSync } from "./hooks/useSync";
import { useContacts } from "./hooks/useContacts";
import { DailyPage } from "./pages/DailyPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { ContactsPage } from "./pages/ContactsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { StatsPage } from "./pages/StatsPage";
import { ExportPage } from "./pages/ExportPage";
import { MyStatsPage } from "./pages/MyStatsPage";
import { MembersPage } from "./pages/MembersPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [page, setPage]                         = useState("daily");
  const [currentDate, setCurrentDate]           = useState(todayKey());
  const [selectedTaskId, setSelectedTaskId]     = useState<string|null>(null);
  const [weekOffset, setWeekOffset]             = useState(0);
  const [weeklyTab, setWeeklyTab]               = useState("telesales");
  const [exportTab, setExportTab]               = useState("telesales");
  const [exportRange, setExportRange]           = useState("week");
  const [exporting, setExporting]               = useState(false);
  const [statsTab, setStatsTab]                 = useState<"agents"|"campaigns"|"funnel"|"log"|"activity">("agents");
  const [memberInput, setMemberInput]           = useState("");
  const [modal, setModal]                       = useState<string|null>(null);
  const [confirmModal, setConfirmModal]         = useState<{id:string;title:string}|null>(null);
  const [reassignAgent, setReassignAgent]       = useState<string|null>(null);
  const [initialOpenContactId, setInitialOpenContactId] = useState<string|null>(null);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const handleLockUI = useCallback(() => { setPage("daily"); setSelectedTaskId(null); }, []);
  const { toast, toastAction, showToast, dismissToast } = useToast();
  const { session, profile, authLoading, profileError, isManager, handleLock, selectedMemberName, setSelectedMemberName } = useAuth(handleLockUI);
  const { db, updateDb, syncing, syncError, isOnline } = useSync();
  const {
    contacts, setContacts,
    updateStatus, updateLeadStatus, updateCallbackDate, updateSalesAgent, addNote,
  } = useContacts();

  const modalRef     = useRef<HTMLInputElement>(null);
  const nextColorRef = useRef<number>(0);

  useEffect(() => {
    if (!modal) return;
    const t = setTimeout(() => modalRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [modal]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const members: any[]   = db.members || [];
  const loggedInMemberId = useMemo(() => {
    if (!profile || isManager || !selectedMemberName) return null;
    return members.find((m: any) => m.name === selectedMemberName)?.id || null;
  }, [profile, members, isManager, selectedMemberName]);

  const settings: any  = db.settings || {};
  const callTarget     = parseInt(String(settings.callTarget || 0)) || 0;
  const intTarget      = parseInt(String(settings.intTarget  || 0)) || 0;

  const contactCampaigns = useMemo(() =>
    Array.from(new Set(contacts.map((c: any) => c.campaign || "").filter(Boolean))).sort() as string[]
  , [contacts]);

  const contactAgentOpts = useMemo(() =>
    Array.from(new Set(contacts.map((c: any) => c.salesAgent || "").filter(Boolean))).sort() as string[]
  , [contacts]);

  const weekDates = useMemo(() => {
    const monday = addDays(weekStart(todayKey()), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekOffset]);

  const exportCtx = useMemo(() => ({
    db, contacts, callTarget, intTarget, weekDates, members, isManager, loggedInMemberId,
  }), [db, contacts, callTarget, intTarget, weekDates, members, isManager, loggedInMemberId]);

  // ── Member management ─────────────────────────────────────────────────────
  const addMember = () => {
    if (!memberInput.trim()) return;
    const id = uid(); const colorIdx = nextColorRef.current++ % AVATAR_COLORS.length;
    updateDb((db: any) => { if (!db.members) db.members = []; db.members.push({ id, name: memberInput.trim(), colorIdx }); });
    setModal(null); setMemberInput(""); showToast(`${memberInput.trim()} added`);
  };

  const confirmRemoveMember = (memberId: string, name: string) => setConfirmModal({ id: memberId, title: name });

  const doRemoveMember = (id: string) => {
    updateDb((db: any) => {
      db.members = (db.members || []).filter((m: any) => m.id !== id);
      Object.values(db.days || {}).forEach((day: any) => {
        (day.tasks || []).forEach((task: any) => {
          task.assignedMembers = (task.assignedMembers || []).filter((m: any) => m.id !== id);
          if (task.memberStats) delete task.memberStats[id];
          if (task.memberDone)  delete task.memberDone[id];
        });
      });
    });
    setConfirmModal(null); showToast("Member removed");
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const rows = getPreviewRows(exportTab, exportRange, exportCtx);
    if (rows.length === 0) { showToast("No data to export"); return; }
    setExporting(true);
    try {
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")),
      ];
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvLines.join("\n"));
      a.download = `blurb_${exportTab}_${exportRange}_${todayKey()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      showToast("CSV exported");
    } finally { setExporting(false); }
  };

  const exportToPDF = async () => {
    const rows = getPreviewRows(exportTab, exportRange, exportCtx);
    if (rows.length === 0) { showToast("No data to export"); return; }
    setExporting(true);
    showToast("Generating PDF…");
    try {
      await generatePDF({ exportTab, exportRange, rows, db, contacts, weekDates, callTarget, intTarget });
      showToast("PDF exported");
    } catch (e) {
      console.error(e);
      showToast("PDF export failed");
    } finally { setExporting(false); }
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", color: "#aaa", fontSize: 14 }}>Loading…</div>
  );
  if (!session || !profile) return (
    <LoginScreen profileError={profileError} onSignOut={() => supabase.auth.signOut()} />
  );
  if (!isManager && !selectedMemberName) {
    if (syncing) return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", color: "#aaa", fontSize: 14 }}>Loading…</div>
    );
    return (
      <AgentPickerScreen members={members} onPick={setSelectedMemberName} onSignOut={() => supabase.auth.signOut()} />
    );
  }

  // ── Nav + previews ────────────────────────────────────────────────────────
  const hasUnsaved = (db.days?.[currentDate]?.tasks || []).some((t: any) => !t.saved);
  const navItems = isManager
    ? [["daily","Daily"],["weekly","Weekly"],["contacts","Contacts"],["pipeline","Pipeline"],["templates","Templates"],["stats","Stats"],["export","Export"],["members","Members"],["settings","Settings"]]
    : [["daily","Daily"],["weekly","Weekly"],["contacts","Contacts"],["pipeline","Pipeline"],["templates","Templates"],["mystats","My Stats"],["export","Export"],["members","Members"]];

  const perfSummary = buildPerformanceSummary(exportCtx);
  const previewRows = getPreviewRows(exportTab, exportRange, exportCtx);

  return (
    <>
      <style>{CSS}</style>
      <AppShell page={page} setPage={setPage} navItems={navItems as [string,string][]} isManager={isManager} syncing={syncing} syncError={syncError} isOnline={isOnline} hasUnsaved={hasUnsaved} onLock={handleLock}>

        {/* DAILY */}
        {page === "daily" && (
          <DailyPage
            db={db} updateDb={updateDb}
            contacts={contacts} members={members}
            isManager={isManager} loggedInMemberId={loggedInMemberId}
            showToast={showToast}
            callTarget={callTarget} intTarget={intTarget}
            currentDate={currentDate} setCurrentDate={setCurrentDate}
            selectedTaskId={selectedTaskId} setSelectedTaskId={setSelectedTaskId}
            contactCampaigns={contactCampaigns}
            onViewContact={(id) => { setInitialOpenContactId(id); setPage("contacts"); }}
          />
        )}

        {/* WEEKLY */}
        {page === "weekly" && (
          <WeeklyPage
            db={db} members={members}
            weekDates={weekDates} weekOffset={weekOffset}
            setWeekOffset={setWeekOffset as any}
            weeklyTab={weeklyTab} setWeeklyTab={setWeeklyTab}
            callTarget={callTarget}
            onSelectDate={(date) => { setCurrentDate(date); setPage("daily"); }}
          />
        )}

        {/* CONTACTS */}
        {page === "contacts" && (
          <ContactsPage
            contacts={contacts} setContacts={setContacts}
            members={members} isManager={isManager}
            loggedInMemberId={loggedInMemberId}
            showToast={showToast} currentDate={currentDate}
            contactCampaigns={contactCampaigns} contactAgentOpts={contactAgentOpts}
            waTemplates={db.settings?.waTemplates || []}
            qaTemplates={db.qaTemplates || {}}
            reassignAgent={reassignAgent}
            onReassignAgentConsumed={() => setReassignAgent(null)}
            initialOpenContactId={initialOpenContactId}
            onInitialOpenContactIdConsumed={() => setInitialOpenContactId(null)}
          />
        )}

        {/* PIPELINE */}
        {page === "pipeline" && (
          <PipelinePage
            contacts={contacts} members={members}
            isManager={isManager} loggedInMemberId={loggedInMemberId}
            contactCampaigns={contactCampaigns} contactAgentOpts={contactAgentOpts}
            showToast={showToast} currentDate={currentDate}
            updateStatus={updateStatus}
            updateLeadStatus={updateLeadStatus}
            updateCallbackDate={updateCallbackDate}
            updateSalesAgent={updateSalesAgent}
            addNote={addNote}
          />
        )}

        {/* TEMPLATES */}
        {page === "templates" && (
          <TemplatesPage db={db} updateDb={updateDb} showToast={showToast} isManager={isManager} contactCampaigns={contactCampaigns} />
        )}

        {/* STATS (manager only) */}
        {page === "stats" && isManager && (
          <StatsPage
            contacts={contacts} members={members}
            statsTab={statsTab} setStatsTab={setStatsTab}
            onReassignStale={(agentName) => { setReassignAgent(agentName); setPage("contacts"); }}
          />
        )}

        {/* EXPORT */}
        {page === "export" && (
          <ExportPage
            exportTab={exportTab} setExportTab={setExportTab}
            exportRange={exportRange} setExportRange={setExportRange}
            isManager={isManager}
            previewRows={previewRows} perfSummary={perfSummary}
            exporting={exporting} callTarget={callTarget}
            onExportCSV={exportToCSV} onExportPDF={exportToPDF}
          />
        )}

        {/* MY STATS (agent only) */}
        {page === "mystats" && !isManager && (
          <MyStatsPage
            db={db} members={members} contacts={contacts}
            loggedInMemberId={loggedInMemberId}
            weekDates={weekDates} callTarget={callTarget} intTarget={intTarget}
          />
        )}

        {/* MEMBERS */}
        {page === "members" && (
          <MembersPage
            db={db} members={members} isManager={isManager}
            onAddMember={() => setModal("addMember")}
            onRemoveMember={confirmRemoveMember}
          />
        )}

        {/* SETTINGS (manager only) */}
        {page === "settings" && isManager && (
          <SettingsPage db={db} updateDb={updateDb} showToast={showToast} />
        )}

        {/* ── MODALS ─────────────────────────────────────────────────────────── */}

        {modal === "addMember" && (
          <div className="modal-overlay" onClick={() => { setModal(null); setMemberInput(""); }}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, letterSpacing: -.3 }}>Add Telesales Member</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Enter the member's full name</div>
              <input ref={modalRef} className="text-input" value={memberInput} onChange={e => setMemberInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="e.g. Ahmad Fariz" style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="ghost-btn" style={{ flex: 1 }} onClick={() => { setModal(null); setMemberInput(""); }}>Cancel</button>
                <button className="primary-btn" style={{ flex: 1 }} onClick={addMember} disabled={!memberInput.trim()}>Add Member</button>
              </div>
            </div>
          </div>
        )}

        {confirmModal && (
          <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="confirm-modal" onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, letterSpacing: -.3 }}>Remove Member</div>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
                Are you sure you want to remove <strong>"{confirmModal.title}"</strong>? All their data will be unlinked. This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="danger-solid-btn" style={{ flex: 1 }} onClick={() => doRemoveMember(confirmModal.id)}>Yes, Remove</button>
              </div>
            </div>
          </div>
        )}

        {/* Offline banner */}
        {!isOnline && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 12px", textAlign: "center", zIndex: 9999 }}>
            ⚠️ Offline — changes may not save until reconnected
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="toast" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>{toast}</span>
            {toastAction && (
              <button onClick={() => { toastAction.fn(); dismissToast(); }} style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,.4)", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 6, cursor: "pointer" }}>
                {toastAction.label}
              </button>
            )}
          </div>
        )}

      </AppShell>
    </>
  );
}
