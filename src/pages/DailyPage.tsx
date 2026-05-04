import React, { useState, useMemo, useRef, useEffect } from "react";
import { initials, uid, fmt, dayName, addDays, touchedOn } from "../lib/utils";
import { AVATAR_COLORS, BRAND, TASK_TYPES } from "../lib/constants";
import { Counter } from "../components/Counter";
import { TargetBar } from "../components/TargetBar";
import type { Contact, Member, ToastAction } from "../types";

interface Props {
  db: any;
  updateDb: (fn: (db: any) => void) => void;
  contacts: Contact[];
  members: Member[];
  isManager: boolean;
  loggedInMemberId: string | null;
  showToast: (msg: string, action?: ToastAction) => void;
  callTarget: number;
  intTarget: number;
  currentDate: string;
  setCurrentDate: (d: string) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  contactCampaigns: string[];
  onViewContact: (contactId: string) => void;
}

export function DailyPage({
  db, updateDb, contacts, members, isManager,
  showToast, callTarget, intTarget,
  currentDate, setCurrentDate, selectedTaskId, setSelectedTaskId,
  contactCampaigns, onViewContact,
}: Props) {
  const [modal, setModal]                             = useState<string|null>(null);
  const [newTaskType, setNewTaskType]                 = useState("telesales");
  const [newTaskTitle, setNewTaskTitle]               = useState("");
  const [newTaskMemberIds, setNewTaskMemberIds]       = useState<string[]>([]);
  const [newTaskLinkedCampaign, setNewTaskLinkedCampaign] = useState("");
  const [campaignInput, setCampaignInput]             = useState("");
  const [campaignTargetId, setCampaignTargetId]       = useState<string|null>(null);
  const [taskConfirmModal, setTaskConfirmModal]       = useState<{id:string;title:string}|null>(null);
  const [sidebarOpen, setSidebarOpen]                 = useState(true);
  const [scriptOpen, setScriptOpen]                   = useState(false);
  const [leadsOpen, setLeadsOpen]                     = useState(false);
  const [emailModal, setEmailModal]                   = useState<{task:any}|null>(null);
  const [emailTo, setEmailTo]                         = useState("");

  const modalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modal) return;
    const t = setTimeout(() => modalRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [modal]);

  // Reset script/leads panel when selected task changes
  useEffect(() => { setScriptOpen(false); setLeadsOpen(false); }, [selectedTaskId]);

  const ensureDay = (db: any, date: string) => {
    if (!db.days) db.days = {};
    if (!db.days[date]) db.days[date] = { tasks: [], saved: false };
  };

  const dayTasks: any[]  = db.days?.[currentDate]?.tasks || [];
  const selectedTask: any = dayTasks.find((t: any) => t.id === selectedTaskId) || null;

  // Auto-computed stats for telesales tasks linked to a campaign
  const linkedTaskStats = useMemo(() => {
    const result: Record<string, Record<string, {total:number;answered:number;notAnswered:number;interested:number}>> = {};
    (db.days?.[currentDate]?.tasks || []).filter((t: any) => t.linkedCampaign).forEach((t: any) => {
      result[t.id] = {};
      (t.assignedMembers || []).forEach((m: any) => {
        const mine = contacts.filter((c: any) => c.campaign === t.linkedCampaign && c.salesAgent === m.name && touchedOn(c, currentDate));
        result[t.id][m.id] = {
          total: mine.length,
          answered: mine.filter((c: any) => ["contacted","callback","interested"].includes(c.status)).length,
          notAnswered: mine.filter((c: any) => ["not_answered","hangup"].includes(c.status)).length,
          interested: mine.filter((c: any) => c.status === "interested").length,
        };
      });
    });
    return result;
  }, [contacts, db.days, currentDate]);

  const toggleMemberSelection = (id: string) =>
    setNewTaskMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    if (newTaskMemberIds.length === 0) { showToast("Assign at least one member"); return; }
    const assigned: any[] = members.filter((m: any) => newTaskMemberIds.includes(m.id));
    let task: any;
    if (newTaskType === "telesales") {
      task = { id: uid(), type: "telesales", title: newTaskTitle.trim(), linkedCampaign: newTaskLinkedCampaign || null, assignedMembers: assigned.map((m: any) => ({ id: m.id, name: m.name, colorIdx: m.colorIdx })), memberStats: Object.fromEntries(assigned.map((m: any) => [m.id, { total: 0, answered: 0, notAnswered: 0, interested: 0 }])), remarks: "" };
    } else if (newTaskType === "whatsapp") {
      task = { id: uid(), type: "whatsapp", title: newTaskTitle.trim(), assignedMembers: assigned.map((m: any) => ({ id: m.id, name: m.name, colorIdx: m.colorIdx })), notes: "", campaigns: [] };
    } else {
      task = { id: uid(), type: "general", title: newTaskTitle.trim(), assignedMembers: assigned.map((m: any) => ({ id: m.id, name: m.name, colorIdx: m.colorIdx })), memberDone: Object.fromEntries(assigned.map((m: any) => [m.id, false])), notes: "" };
    }
    updateDb((db: any) => { ensureDay(db, currentDate); db.days[currentDate].tasks.push(task); });
    setSelectedTaskId(task.id); setModal(null); setNewTaskTitle(""); setNewTaskMemberIds([]); setNewTaskLinkedCampaign("");
    showToast("Task created");
  };

  const confirmRemoveTask = (taskId: string, title: string) => setTaskConfirmModal({ id: taskId, title });

  const doRemoveTask = (taskId: string) => {
    updateDb((db: any) => { if (db.days?.[currentDate]?.tasks) db.days[currentDate].tasks = db.days[currentDate].tasks.filter((t: any) => t.id !== taskId); });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    setTaskConfirmModal(null); showToast("Task removed");
  };

  const copyTaskToDate = (task: any, targetDate: string) => {
    const existing = (db.days?.[targetDate]?.tasks || []).some((t: any) => t.title === task.title && t.type === task.type);
    if (existing) { showToast("Task already exists for that day"); return; }
    const newId = uid();
    let copy: any;
    if (task.type === "telesales") {
      copy = { ...task, id: newId, saved: false, remarks: "", memberStats: Object.fromEntries((task.assignedMembers || []).map((m: any) => [m.id, { total: 0, answered: 0, notAnswered: 0, interested: 0 }])) };
    } else if (task.type === "whatsapp") {
      copy = { ...task, id: newId, saved: false, notes: "", campaigns: [] };
    } else {
      copy = { ...task, id: newId, saved: false, notes: "", memberDone: Object.fromEntries((task.assignedMembers || []).map((m: any) => [m.id, false])) };
    }
    updateDb((db: any) => { ensureDay(db, targetDate); db.days[targetDate].tasks.push(copy); });
    setCurrentDate(targetDate); setSelectedTaskId(newId);
    showToast("Task copied to " + fmt(targetDate));
  };

  const updateMemberStat = (taskId: string, memberId: string, field: string, value: number) => {
    const numVal = Math.max(0, parseInt(String(value)) || 0);
    updateDb((db: any) => {
      const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId);
      if (!task || !task.memberStats) return;
      const s = task.memberStats[memberId];
      if (field === "total") {
        s.total = numVal;
        if (s.answered > numVal) s.answered = numVal;
        if (s.interested > s.answered) s.interested = s.answered;
      } else if (field === "answered") {
        s.answered = Math.min(numVal, s.total);
        if (s.interested > s.answered) s.interested = s.answered;
      } else if (field === "interested") {
        s.interested = Math.min(numVal, s.answered);
      } else if (field === "notAnswered") {
        s.notAnswered = numVal;
      }
    });
  };

  const updateTaskField = (taskId: string, field: string, value: any) => {
    updateDb((db: any) => { const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (!task) return; task[field] = value; });
  };

  const toggleMemberDone = (taskId: string, memberId: string) => {
    updateDb((db: any) => { const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (!task || !task.memberDone) return; task.memberDone[memberId] = !task.memberDone[memberId]; });
  };

  const addCampaign = () => {
    if (!campaignInput.trim() || !campaignTargetId) return;
    updateDb((db: any) => { const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === campaignTargetId); if (task) task.campaigns.push({ id: uid(), name: campaignInput.trim(), sent: 0, replied: 0, closed: 0, unresponsive: 0, remarks: "" }); });
    setModal(null); setCampaignInput(""); showToast("Campaign added");
  };

  const removeCampaign = (taskId: string, cId: string) => {
    updateDb((db: any) => { const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (task) task.campaigns = task.campaigns.filter((c: any) => c.id !== cId); });
    showToast("Campaign removed");
  };

  const updateCampaignField = (taskId: string, cId: string, field: string, value: any) => {
    updateDb((db: any) => { const task = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (!task) return; const c = task.campaigns.find((c: any) => c.id === cId); if (!c) return; c[field] = (field === "remarks" || field === "name") ? value : Math.max(0, parseInt(String(value)) || 0); });
  };

  const addLead = (taskId: string) => {
    updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (t) { if (!t.leads) t.leads = []; t.leads.push({ id: uid(), agentName: "", phone: "", remark: "" }); } });
  };

  const updateLead = (taskId: string, leadId: string, field: string, value: string) => {
    updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (!t || !t.leads) return; const l = t.leads.find((l: any) => l.id === leadId); if (l) l[field] = value; });
  };

  const removeLead = (taskId: string, leadId: string) => {
    updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (t) t.leads = (t.leads || []).filter((l: any) => l.id !== leadId); });
  };

  const saveTask   = (taskId: string) => { updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (t) t.saved = true; }); showToast("Task saved"); };
  const unsaveTask = (taskId: string) => { updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (t) t.saved = false; }); };
  const updateTaskTitle = (taskId: string, newTitle: string) => { if (!newTitle.trim()) return; updateDb((db: any) => { const t = db.days?.[currentDate]?.tasks?.find((t: any) => t.id === taskId); if (t) t.title = newTitle.trim(); }); };

  const buildEmailBody = (task: any) => {
    const assigned: any[] = task.assignedMembers || [];
    const lines: string[] = [];
    lines.push(`blurB — ${task.title}`);
    lines.push(`Date: ${fmt(currentDate)}`);
    lines.push("═".repeat(36));
    lines.push("");
    lines.push("MEMBER STATS");
    lines.push("─".repeat(36));
    assigned.forEach((m: any, i: number) => {
      const s = task.memberStats?.[m.id] || { total: 0, answered: 0, notAnswered: 0, interested: 0 };
      const aRate = s.total > 0 ? Math.round(s.answered / s.total * 100) : 0;
      const cRate = s.answered > 0 ? Math.round(s.interested / s.answered * 100) : 0;
      lines.push(`${i + 1}. ${m.name.padEnd(14)} Total: ${s.total} | Answered: ${s.answered} | Not Ans: ${s.notAnswered} | Interested: ${s.interested} | Answer Rate: ${aRate}% | Conv Rate: ${cRate}%`);
    });
    const leads: any[] = task.leads || [];
    if (leads.length > 0) {
      lines.push("");
      lines.push("POTENTIAL LEADS");
      lines.push("─".repeat(36));
      leads.forEach((l: any, i: number) => {
        lines.push(`${i + 1}. ${l.agentName || "—"}  |  ${l.phone || "—"}  |  ${l.remark || "—"}`);
      });
    }
    return lines.join("\n");
  };

  const sendEmail = (task: any) => {
    const subject = encodeURIComponent(`blurB Report — ${task.title} (${fmt(currentDate)})`);
    const body    = encodeURIComponent(buildEmailBody(task));
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailTo.trim())}&su=${subject}&body=${body}`, "_blank");
    setEmailModal(null); setEmailTo("");
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const MemberAvatarRow = ({ assignedMembers }: { assignedMembers: any[] }) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {(assignedMembers || []).map((m: any) => (
        <div key={m.id} title={m.name} style={{ width: 26, height: 26, borderRadius: 8, background: AVATAR_COLORS[m.colorIdx || 0][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(m.name)}</div>
      ))}
    </div>
  );

  const renderTelesales = (task: any) => {
    const assigned = task.assignedMembers || [];
    const isLinked = !!task.linkedCampaign;
    const isSheetSync = task.id.startsWith("sheet-sync-") || isLinked;
    const getStats = (memberId: string) => isLinked ? (linkedTaskStats[task.id]?.[memberId] || { total: 0, answered: 0, notAnswered: 0, interested: 0 }) : (task.memberStats?.[memberId] || { total: 0, answered: 0, notAnswered: 0, interested: 0 });
    const totals = (assigned as any[]).reduce((a: any, m: any) => { const s = getStats(m.id); return { total: a.total + s.total, answered: a.answered + s.answered, notAnswered: a.notAnswered + s.notAnswered, interested: a.interested + s.interested }; }, { total: 0, answered: 0, notAnswered: 0, interested: 0 });
    const aRate = totals.total > 0 ? Math.round(totals.answered / totals.total * 100) : 0;
    const cRate = totals.answered > 0 ? Math.round(totals.interested / totals.answered * 100) : 0;
    return (
      <div className="card fade-up">
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isSheetSync ? <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -.3, marginBottom: 6 }}>{task.title}</div> : <input className="title-input" defaultValue={task.title} onBlur={e => updateTaskTitle(task.id, e.target.value)} placeholder="Task title..." />}
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <MemberAvatarRow assignedMembers={assigned} />
                {isLinked && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", padding: "2px 8px", borderRadius: 20, border: "1px solid #ddd6fe" }}>📊 {task.linkedCampaign}</span>}
                {!isLinked && task.id.startsWith("sheet-sync-") && <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: 20, border: "1px solid #a7f3d0" }}>Synced from Sheet</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span className="stat-badge" style={{ background: "#f0fdf4", color: "#15803d" }}>Ans: {totals.answered}</span>
                <span className="stat-badge" style={{ background: "#fff1f2", color: "#be123c" }}>N/A: {totals.notAnswered}</span>
                <span className="stat-badge" style={{ background: "#fffbeb", color: "#b45309" }}>Int: {totals.interested}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="ghost-btn" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => copyTaskToDate(task, addDays(currentDate, 1))}>Reuse Tomorrow</button>
                {task.saved ? <button className="saved-btn" onClick={() => unsaveTask(task.id)}>Saved</button> : <button className="save-btn" onClick={() => saveTask(task.id)}>Save</button>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {(callTarget > 0 || intTarget > 0) && (
            <div style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .8, marginBottom: 12 }}>Team Target Progress</div>
              {callTarget > 0 && <TargetBar label="Total Calls" value={totals.total} target={callTarget * assigned.length} />}
              {intTarget > 0 && <TargetBar label="Interested" value={totals.interested} target={intTarget * assigned.length} />}
            </div>
          )}
          {assigned.map((m: any) => {
            const s = getStats(m.id);
            const mARate = s.total > 0 ? Math.round(s.answered / s.total * 100) : 0;
            const mCRate = s.answered > 0 ? Math.round(s.interested / s.answered * 100) : 0;
            return (
              <div key={m.id} style={{ border: "1.5px solid #ebebeb", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: AVATAR_COLORS[m.colorIdx || 0][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials(m.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 8 }}><span>{mARate}% answer rate</span><span>·</span><span>{mCRate}% conv. rate</span></div>
                  </div>
                </div>
                {(callTarget > 0 || intTarget > 0) && <div style={{ marginBottom: 12 }}>{callTarget > 0 && <TargetBar label="Calls" value={s.total} target={callTarget} />}{intTarget > 0 && <TargetBar label="Interested" value={s.interested} target={intTarget} />}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[{ field: "total", label: "Total" }, { field: "answered", label: "Answered" }, { field: "notAnswered", label: "Not Ans." }, { field: "interested", label: "Interested" }].map(({ field, label }) => (
                    <div key={field} className="card-sm" style={{ padding: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
                      {isSheetSync ? <div style={{ fontSize: 20, fontWeight: 800, color: "#111", textAlign: "center", padding: "7px 0" }}>{s[field]}</div> : <Counter value={s[field]} onChange={v => updateMemberStat(task.id, m.id, field, v)} size="sm" />}
                    </div>
                  ))}
                </div>
                {isSheetSync && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><div style={{ flex: 1, background: "#eff6ff", borderRadius: 10, padding: "8px 12px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 }}>Answer Rate</div><div style={{ fontSize: 18, fontWeight: 800, color: "#1a56db" }}>{mARate}%</div></div><div style={{ flex: 1, background: "#f0fdf4", borderRadius: 10, padding: "8px 12px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 }}>Conv. Rate</div><div style={{ fontSize: 18, fontWeight: 800, color: "#059669" }}>{mCRate}%</div></div></div>}
              </div>
            );
          })}
          {isSheetSync && <div style={{ background: "#1a1a1a", borderRadius: 14, padding: 16, marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .8, marginBottom: 12 }}>Team Summary</div><div style={{ display: "flex", gap: 10 }}><div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "10px 14px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Team Answer Rate</div><div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{aRate}%</div><div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{totals.answered} of {totals.total} answered</div></div><div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "10px 14px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Team Conv. Rate</div><div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{cRate}%</div><div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{totals.interested} of {totals.answered} interested</div></div></div></div>}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#555" }}>Answer Rate</span><span style={{ fontSize: 11, fontWeight: 700 }}>{aRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${aRate}%`, background: "#1a56db" }} /></div></div>
            <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#555" }}>Conv. Rate</span><span style={{ fontSize: 11, fontWeight: 700 }}>{cRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${cRate}%`, background: "#1a56db" }} /></div></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 7 }}>Remarks</div>
          <textarea className="remarks-ta" rows={2} value={task.remarks} onChange={e => updateTaskField(task.id, "remarks", e.target.value)} placeholder="Notes for this session..." />
          {/* Collapsible Call Script */}
          <div style={{ marginTop: 14, border: "1.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setScriptOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>Call Script</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: scriptOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {scriptOpen && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #f0f0f0" }}>
                <textarea className="remarks-ta" rows={6} value={task.script || ""} onChange={e => updateTaskField(task.id, "script", e.target.value)} placeholder="Write your call script here..." />
              </div>
            )}
          </div>
          {/* Potential Leads */}
          <div style={{ marginTop: 10, border: "1.5px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setLeadsOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>Potential Leads <span style={{ color: "#aaa", fontWeight: 500 }}>({(task.leads || []).length})</span></span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: leadsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {leadsOpen && (
              <div style={{ padding: "12px 14px", borderTop: "1px solid #f0f0f0" }}>
                {(task.leads || []).length > 0 && (
                  <div style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10, display: "table" }}>
                    <div style={{ display: "table-header-group" }}>
                      <div style={{ display: "table-row" }}>
                        {["Agent Name", "Phone / Store ID", "Remark", ""].map((h, i) => (
                          <div key={i} style={{ display: "table-cell", padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, borderBottom: "1.5px solid #ebebeb", whiteSpace: "nowrap" }}>{h}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "table-row-group" }}>
                      {(task.leads || []).map((lead: any) => (
                        <div key={lead.id} style={{ display: "table-row" }}>
                          <div style={{ display: "table-cell", padding: "5px 6px", verticalAlign: "middle" }}>
                            <input value={lead.agentName} onChange={e => updateLead(task.id, lead.id, "agentName", e.target.value)} placeholder="Agent name" style={{ border: "1.5px solid #e5e5e5", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", minWidth: 90 }} />
                          </div>
                          <div style={{ display: "table-cell", padding: "5px 6px", verticalAlign: "middle" }}>
                            <input value={lead.phone} onChange={e => updateLead(task.id, lead.id, "phone", e.target.value)} placeholder="Phone / Store ID" style={{ border: "1.5px solid #e5e5e5", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", minWidth: 110 }} />
                          </div>
                          <div style={{ display: "table-cell", padding: "5px 6px", verticalAlign: "middle" }}>
                            <input value={lead.remark} onChange={e => updateLead(task.id, lead.id, "remark", e.target.value)} placeholder="Remark" style={{ border: "1.5px solid #e5e5e5", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", minWidth: 120 }} />
                          </div>
                          <div style={{ display: "table-cell", padding: "5px 4px", verticalAlign: "middle", textAlign: "right" }}>
                            <button className="danger-btn" onClick={() => removeLead(task.id, lead.id)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="ghost-btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => addLead(task.id)}>+ Add Lead</button>
                  <button className="ghost-btn" style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }} onClick={() => { setEmailTo(""); setEmailModal({ task }); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    Email Broadcaster
                  </button>
                  {(task.leads || []).length > 0 && (
                    <button className="ghost-btn" style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }} onClick={() => {
                      const lines = (task.leads || []).map((l: any, i: number) => `${i + 1}. ${l.agentName || "—"}  |  ${l.phone || "—"}  |  ${l.remark || "—"}`);
                      const text = `Potential Leads — ${task.title}\n${"─".repeat(40)}\n${lines.join("\n")}`;
                      navigator.clipboard.writeText(text).then(() => showToast("Leads copied to clipboard"));
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      Copy List
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWhatsapp = (task: any) => {
    const assigned = task.assignedMembers || [];
    const totals = ((task.campaigns || []) as any[]).reduce((a: any, c: any) => ({ sent: a.sent + c.sent, replied: a.replied + c.replied, closed: a.closed + c.closed, unresponsive: a.unresponsive + c.unresponsive }), { sent: 0, replied: 0, closed: 0, unresponsive: 0 });
    const replyRate = totals.sent > 0 ? Math.round(totals.replied / totals.sent * 100) : 0;
    const closeRate = totals.replied > 0 ? Math.round(totals.closed / totals.replied * 100) : 0;
    return (
      <div className="fade-up">
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="title-input" defaultValue={task.title} onBlur={e => updateTaskTitle(task.id, e.target.value)} placeholder="Task title..." />
                <div style={{ marginTop: 6 }}><MemberAvatarRow assignedMembers={assigned} /></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span className="stat-badge" style={{ background: "#eff6ff", color: "#2563eb" }}>Sent: {totals.sent}</span>
                  <span className="stat-badge" style={{ background: "#f0fdf4", color: "#15803d" }}>Replied: {totals.replied}</span>
                  <span className="stat-badge" style={{ background: "#ecfdf5", color: "#059669" }}>Closed: {totals.closed}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className="ghost-btn" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => copyTaskToDate(task, addDays(currentDate, 1))}>Reuse Tomorrow</button>
                  {task.saved ? <button className="saved-btn" onClick={() => unsaveTask(task.id)}>Saved</button> : <button className="save-btn" onClick={() => saveTask(task.id)}>Save</button>}
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#555" }}>Reply Rate</span><span style={{ fontSize: 11, fontWeight: 700 }}>{replyRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${replyRate}%`, background: "#1a56db" }} /></div></div>
              <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#555" }}>Close Rate</span><span style={{ fontSize: 11, fontWeight: 700 }}>{closeRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${closeRate}%`, background: "#1a56db" }} /></div></div>
            </div>
            <textarea className="remarks-ta" rows={2} value={task.notes} onChange={e => updateTaskField(task.id, "notes", e.target.value)} placeholder="Overall notes..." />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Campaigns <span style={{ color: "#999", fontWeight: 500, fontSize: 13 }}>({task.campaigns?.length || 0})</span></div>
          <button className="primary-btn" style={{ padding: "7px 13px", fontSize: 12 }} onClick={() => { setCampaignTargetId(task.id); setModal("addCampaign"); }}>+ Add Campaign</button>
        </div>
        {(!task.campaigns || task.campaigns.length === 0) && <div style={{ textAlign: "center", padding: "30px", border: "1.5px dashed #e5e5e5", borderRadius: 14, color: "#bbb", fontSize: 13 }}>No campaigns yet.</div>}
        {task.campaigns?.map((c: any) => {
          const cReply = c.sent > 0 ? Math.round(c.replied / c.sent * 100) : 0;
          return (
            <div key={c.id} style={{ border: "1.5px solid #ebebeb", borderRadius: 14, padding: 16, marginBottom: 10, background: "#fafafa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="stat-badge" style={{ background: "#f0fdf4", color: "#15803d" }}>{cReply}% reply</span>
                  <button className="danger-btn" onClick={() => removeCampaign(task.id, c.id)}>×</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                {[{ field: "sent", label: "Sent" }, { field: "replied", label: "Replied" }, { field: "closed", label: "Closed" }, { field: "unresponsive", label: "No Reply" }].map(({ field, label }) => (
                  <div key={field} style={{ background: "#fff", border: "1.5px solid #e5e5e5", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
                    <Counter value={c[field]} onChange={v => updateCampaignField(task.id, c.id, field, v)} size="sm" />
                  </div>
                ))}
              </div>
              <textarea className="remarks-ta" rows={2} value={c.remarks} onChange={e => updateCampaignField(task.id, c.id, "remarks", e.target.value)} placeholder="Campaign notes..." />
            </div>
          );
        })}
      </div>
    );
  };

  const renderGeneral = (task: any) => {
    const assigned = task.assignedMembers || [];
    const doneCount = (assigned as any[]).filter((m: any) => task.memberDone?.[m.id]).length;
    return (
      <div className="card fade-up">
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input className="title-input" defaultValue={task.title} onBlur={e => updateTaskTitle(task.id, e.target.value)} placeholder="Task title..." />
              <div style={{ marginTop: 6 }}><MemberAvatarRow assignedMembers={assigned} /></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              <span className="stat-badge" style={{ background: "#f0fdf4", color: "#15803d" }}>{doneCount}/{assigned.length} done</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="ghost-btn" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => copyTaskToDate(task, addDays(currentDate, 1))}>Reuse Tomorrow</button>
                {task.saved ? <button className="saved-btn" onClick={() => unsaveTask(task.id)}>Saved</button> : <button className="save-btn" onClick={() => saveTask(task.id)}>Save</button>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {assigned.map((m: any) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: AVATAR_COLORS[m.colorIdx || 0][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>{initials(m.name)}</div>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14, textDecoration: task.memberDone?.[m.id] ? "line-through" : "none", color: task.memberDone?.[m.id] ? "#bbb" : "#111" }}>{m.name}</div>
              <div onClick={() => toggleMemberDone(task.id, m.id)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 12px", borderRadius: 9, background: task.memberDone?.[m.id] ? "#f0fdf4" : "#f5f5f5", border: `1.5px solid ${task.memberDone?.[m.id] ? "#86efac" : "#e5e5e5"}`, transition: "all .15s" }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: task.memberDone?.[m.id] ? "#16a34a" : "transparent", border: `1.5px solid ${task.memberDone?.[m.id] ? "#16a34a" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {task.memberDone?.[m.id] && <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: task.memberDone?.[m.id] ? "#16a34a" : "#555" }}>{task.memberDone?.[m.id] ? "Done" : "Mark Done"}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 7 }}>Notes</div>
            <textarea className="remarks-ta" rows={4} value={task.notes} onChange={e => updateTaskField(task.id, "notes", e.target.value)} placeholder="Task details and notes..." />
          </div>
        </div>
      </div>
    );
  };

  const TaskChip = ({ task }: { task: any }) => {
    const tt = TASK_TYPES[task.type as keyof typeof TASK_TYPES]; const isActive = task.id === selectedTaskId;
    const assigned = task.assignedMembers || [];
    let subtitle = "";
    if (task.type === "telesales") { const tot = (assigned as any[]).reduce((a: number, m: any) => a + ((task.linkedCampaign && linkedTaskStats[task.id]) ? linkedTaskStats[task.id]?.[m.id]?.total || 0 : task.memberStats?.[m.id]?.total || 0), 0); subtitle = `${tot} calls · ${assigned.length} member${assigned.length !== 1 ? "s" : ""}`; }
    else if (task.type === "whatsapp") { subtitle = `${task.campaigns?.length || 0} campaign${task.campaigns?.length !== 1 ? "s" : ""}`; }
    else { const done = (assigned as any[]).filter((m: any) => task.memberDone?.[m.id]).length; subtitle = `${done}/${assigned.length} done`; }
    return (
      <div className={`task-chip ${isActive ? "active" : ""}`} onClick={() => setSelectedTaskId(task.id)}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: tt.color, flexShrink: 0, marginLeft: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{subtitle}</div>
        </div>
        {isManager && <button className="danger-btn" onClick={e => { e.stopPropagation(); confirmRemoveTask(task.id, task.title); }}>×</button>}
      </div>
    );
  };

  return (
    <>
      <div className="fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div><div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>{dayName(currentDate)}</div><div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{fmt(currentDate)}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="ghost-btn" style={{ padding: "7px 11px", fontSize: 13 }} onClick={() => setCurrentDate(addDays(currentDate, -1))}>←</button>
            <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} style={{ border: "1.5px solid #444", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", color: "#fff", background: "#1a1a1a", outline: "none", fontWeight: 500 } as any} />
            <button className="ghost-btn" style={{ padding: "7px 11px", fontSize: 13 }} onClick={() => setCurrentDate(addDays(currentDate, 1))}>→</button>
          </div>
        </div>
        {/* Callbacks due today */}
        {(() => {
          const due = contacts.filter((c: any) => c.callbackDate === currentDate);
          if (!due.length) return null;
          return (
            <div style={{ marginBottom: 14, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "12px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 8 }}>📞 Callbacks Due Today ({due.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {due.map((c: any) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#fff", borderRadius: 9, border: "1px solid #fde68a" }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#e8efff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#1a56db", flexShrink: 0 }}>{initials(c.name || "?")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{c.phone || "—"}{c.salesAgent ? ` · ${c.salesAgent}` : ""}</div>
                    </div>
                    <button onClick={() => onViewContact(c.id)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #d97706", background: "#fff", color: "#d97706", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>View</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* Today's team call progress */}
        {callTarget > 0 && dayTasks.some((t: any) => t.type === "telesales") && (() => {
          const entries: Record<string, { name: string; total: number; interested: number }> = {};
          dayTasks.filter((t: any) => t.type === "telesales").forEach((t: any) => {
            (t.assignedMembers || []).forEach((m: any) => {
              if (!entries[m.id]) entries[m.id] = { name: m.name, total: 0, interested: 0 };
              const s = (t.linkedCampaign && linkedTaskStats[t.id]?.[m.id]) ? linkedTaskStats[t.id][m.id] : (t.memberStats?.[m.id] || {});
              entries[m.id].total += (s.total || 0);
              entries[m.id].interested += (s.interested || 0);
            });
          });
          const rows = Object.values(entries);
          if (!rows.length) return null;
          return (
            <div style={{ marginBottom: 14, background: "#f0f6ff", border: "1.5px solid #bfdbfe", borderRadius: 14, padding: "12px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1a56db", marginBottom: 10 }}>📊 Today's Call Progress</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map(({ name, total, interested }) => (
                  <div key={name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                      <span>{name}</span>
                      <span style={{ color: total >= callTarget ? "#059669" : "#888" }}>{total}/{callTarget} calls{intTarget > 0 ? ` · ${interested}/${intTarget} int.` : ""}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, callTarget > 0 ? total / callTarget * 100 : 0)}%`, background: total >= callTarget ? "#059669" : "#1a56db" }} /></div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* Team leaderboard */}
        {members.length > 1 && dayTasks.some((t: any) => t.type === "telesales") && (() => {
          const lb: Record<string, { name: string; total: number; interested: number }> = {};
          dayTasks.filter((t: any) => t.type === "telesales").forEach((t: any) => {
            (t.assignedMembers || []).forEach((m: any) => {
              if (!lb[m.id]) lb[m.id] = { name: m.name, total: 0, interested: 0 };
              const s = t.memberStats?.[m.id] || {};
              lb[m.id].total += (s.total || 0); lb[m.id].interested += (s.interested || 0);
            });
          });
          const ranked = Object.values(lb).sort((a, b) => b.total - a.total || b.interested - a.interested);
          if (!ranked.length || ranked.every(r => r.total === 0)) return null;
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div style={{ marginBottom: 14, background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "12px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🏆 Today's Leaderboard</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ranked.map((r, i) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: i === 0 ? "#fffbeb" : "#fafafa", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? "#d97706" : i === 1 ? "#9ca3af" : "#a07850", width: 22, textAlign: "center" }}>{medals[i] || `${i + 1}`}</span>
                    <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    <span style={{ fontSize: 12, color: "#888" }}>{r.total} calls</span>
                    {r.interested > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#f0fdf4", padding: "2px 7px", borderRadius: 20 }}>{r.interested} int.</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <div className="daily-grid" style={{ display: "grid", gridTemplateColumns: `${sidebarOpen ? "240px" : "40px"} 1fr`, gap: 16, alignItems: "start", transition: "grid-template-columns .2s ease" }}>
          {/* Sidebar */}
          <div className="sidebar-panel open">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              {sidebarOpen && <div style={{ fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .8 }}>Tasks ({dayTasks.length})</div>}
              <div style={{ display: "flex", gap: 4, marginLeft: sidebarOpen ? 0 : "auto" }}>
                {sidebarOpen && <button onClick={() => { setNewTaskMemberIds([]); setModal("addTask"); }} style={{ background: "#1a56db", color: "#fff", border: "none", borderRadius: 7, width: 24, height: 24, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>}
                <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? "Collapse" : "Expand"}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={sidebarOpen ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} /></svg>
                </button>
              </div>
            </div>
            {sidebarOpen && (
              <div className="card" style={{ padding: 8 }}>
                {dayTasks.length === 0 && (
                  <div style={{ padding: "24px 12px", textAlign: "center", color: "#bbb", fontSize: 13 }}>No tasks yet
                    <div style={{ marginTop: 12 }}><button className="primary-btn" style={{ fontSize: 12, padding: "7px 14px" }} onClick={() => { setNewTaskMemberIds([]); setModal("addTask"); }}>+ Add Task</button></div>
                  </div>
                )}
                {dayTasks.map((task: any) => <TaskChip key={task.id} task={task} />)}
              </div>
            )}
            {!sidebarOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {dayTasks.map((task: any) => {
                  const tt = TASK_TYPES[task.type as keyof typeof TASK_TYPES];
                  return <div key={task.id} onClick={() => { setSidebarOpen(true); setSelectedTaskId(task.id); }} style={{ width: 8, height: 8, borderRadius: "50%", background: task.id === selectedTaskId ? BRAND : tt.color, cursor: "pointer", margin: "0 auto" }} title={task.title} />;
                })}
                <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1a56db", fontSize: 16, lineHeight: 1 }}>+</button>
              </div>
            )}
          </div>
          {/* Detail panel */}
          <div className="detail-panel">
            {!selectedTask ? (
              <div style={{ textAlign: "center", padding: "80px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Select a task to view</div>
                <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Click a task on the left to view details</div>
                <button className="primary-btn" onClick={() => { setNewTaskMemberIds([]); setModal("addTask"); }}>+ New Task</button>
              </div>
            ) : (
              <React.Fragment key={selectedTask.id}>
                {selectedTask.type === "telesales" ? renderTelesales(selectedTask) : selectedTask.type === "whatsapp" ? renderWhatsapp(selectedTask) : renderGeneral(selectedTask)}
              </React.Fragment>
            )}
          </div>
        </div>
      </div>

      {/* Add Task modal */}
      {modal === "addTask" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, letterSpacing: -.3 }}>New Task</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Choose a type, assign members, and set a title</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Task Type</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.entries(TASK_TYPES).map(([k, v]) => <button key={k} className={`type-btn ${newTaskType === k ? "active" : ""}`} onClick={() => setNewTaskType(k)}>{(v as any).label}</button>)}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Assign Members <span style={{ color: "#999", fontWeight: 400 }}>(select one or more)</span></div>
              {members.length === 0 ? (
                <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, fontSize: 13, color: "#92400e" }}>No members yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {members.map((m: any) => {
                    const sel = newTaskMemberIds.includes(m.id);
                    return (
                      <div key={m.id} onClick={() => toggleMemberSelection(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${sel ? "#1a56db" : "#e5e5e5"}`, background: sel ? "#eff6ff" : "#fff", cursor: "pointer", transition: "all .12s" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: AVATAR_COLORS[m.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>{initials(m.name)}</div>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                        <div style={{ width: 16, height: 16, borderRadius: 4, background: sel ? "#1a56db" : "transparent", border: `1.5px solid ${sel ? "#1a56db" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {sel && <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Task Title</div>
              <input ref={modalRef} className="text-input" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder={newTaskType === "telesales" ? "e.g. Morning Call Session" : newTaskType === "whatsapp" ? "e.g. April Follow-up" : "e.g. Prepare weekly report"} />
            </div>
            {newTaskType === "telesales" && contactCampaigns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 4 }}>Link to Campaign <span style={{ color: "#999", fontWeight: 400 }}>(optional — auto-computes stats from contacts)</span></div>
                <select value={newTaskLinkedCampaign} onChange={e => setNewTaskLinkedCampaign(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #444", background: "#1a1a1a", color: "#fff", fontFamily: "inherit", fontSize: 13, outline: "none" }}>
                  <option value="">No link — manual entry</option>
                  {contactCampaigns.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => { setModal(null); setNewTaskTitle(""); }}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={addTask} disabled={!newTaskTitle.trim() || newTaskMemberIds.length === 0 || members.length === 0}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Campaign modal */}
      {modal === "addCampaign" && (
        <div className="modal-overlay" onClick={() => { setModal(null); setCampaignInput(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, letterSpacing: -.3 }}>New Campaign</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Name this WhatsApp outreach campaign</div>
            <input ref={modalRef} className="text-input" value={campaignInput} onChange={e => setCampaignInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addCampaign()} placeholder="e.g. Petaling Jaya Prospects" style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => { setModal(null); setCampaignInput(""); }}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={addCampaign} disabled={!campaignInput.trim()}>Add Campaign</button>
            </div>
          </div>
        </div>
      )}

      {/* Task remove confirm modal */}
      {taskConfirmModal && (
        <div className="modal-overlay" onClick={() => setTaskConfirmModal(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, letterSpacing: -.3 }}>Remove Task</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.6 }}>
              Are you sure you want to remove <strong>"{taskConfirmModal.title}"</strong>? This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setTaskConfirmModal(null)}>Cancel</button>
              <button className="danger-solid-btn" style={{ flex: 1 }} onClick={() => doRemoveTask(taskConfirmModal.id)}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Email broadcaster modal */}
      {emailModal && (
        <div className="modal-overlay" onClick={() => setEmailModal(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6, letterSpacing: -.3 }}>Email Broadcaster</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 16, lineHeight: 1.6 }}>Enter the broadcaster's email address. Your email client will open with the stats and leads pre-filled.</div>
            <input autoFocus type="email" className="text-input" placeholder="broadcaster@example.com" value={emailTo} onChange={e => setEmailTo(e.target.value)} onKeyDown={e => e.key === "Enter" && emailTo.trim() && sendEmail(emailModal.task)} style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setEmailModal(null)}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1, opacity: emailTo.trim() ? 1 : .4, cursor: emailTo.trim() ? "pointer" : "not-allowed" }} onClick={() => emailTo.trim() && sendEmail(emailModal.task)}>Open Email</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
