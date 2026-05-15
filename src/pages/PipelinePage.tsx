import React, { useState, useCallback, useMemo } from "react";
import { initials, fmt, fmtNoteTime } from "../lib/utils";
import { safeCopy } from "../lib/security";
import { CONTACT_STATUS_META, CONTACT_LEAD_META, PIPELINE_COLS } from "../lib/constants";
import { PipelineCard } from "../components/PipelineCard";
import type { Contact, Member, ToastAction } from "../types";

interface Props {
  contacts: Contact[];
  members: Member[];
  isManager: boolean;
  loggedInMemberId: string | null;
  contactCampaigns: string[];
  contactAgentOpts: string[];
  showToast: (msg: string, action?: ToastAction) => void;
  currentDate: string;
  // contact mutations from useContacts hook
  updateStatus: (id: string, status: string, currentDate: string, author?: string) => void;
  updateLeadStatus: (id: string, leadStatus: string | null, currentDate: string, author?: string) => void;
  updateCallbackDate: (id: string, date: string) => void;
  updateSalesAgent: (id: string, agent: string) => void;
  addNote: (id: string, text: string, author: string, currentDate: string) => void;
}

// Kanban-style sales pipeline. Drag a card between status columns to update it.
// Click a card to open a detail modal with notes and full lead controls.
export function PipelinePage({
  contacts, members, isManager, loggedInMemberId,
  contactCampaigns, contactAgentOpts, showToast, currentDate,
  updateStatus, updateLeadStatus, updateCallbackDate, updateSalesAgent, addNote,
}: Props) {
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const author = isManager ? "Manager" : (members.find(m => m.id === loggedInMemberId)?.name || "Member");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(c => {
      if (!showClosed && (c.status === "closed_won" || c.status === "closed_lost")) return false;
      if (campaignFilter && c.campaign !== campaignFilter) return false;
      if (agentFilter && (c.salesAgent || "__none__") !== agentFilter) return false;
      if (q && !`${c.name} ${c.phone} ${c.storeType || ""} ${c.company || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contacts, search, campaignFilter, agentFilter, showClosed]);

  const handleDragStart = useCallback((e: React.DragEvent, contactId: string) => {
    setDraggingId(contactId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverColumn(col);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggingId(prev => {
      if (prev) {
        const src = contacts.find(c => c.id === prev);
        if (src && (src.status === "closed_won" || src.status === "closed_lost")) return null;
        updateStatus(prev, targetStatus, currentDate, author);
      }
      return null;
    });
    setDragOverColumn(null);
  }, [updateStatus, currentDate, author, contacts]);

  const detail = detailId ? contacts.find(c => c.id === detailId) || null : null;
  const anyFilter = !!(search || campaignFilter || agentFilter);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Pipeline</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{contacts.length} total · drag cards to move stages</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search name, phone…"
          style={{ flex: 1, minWidth: 150, border: "1.5px solid #e5e5e5", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
          onFocus={e => e.target.style.borderColor = "#1a56db"}
          onBlur={e => e.target.style.borderColor = "#e5e5e5"}
        />
        {contactCampaigns.length > 0 && (
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            style={{ border: "1.5px solid #e5e5e5", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: campaignFilter ? "#1a56db" : "#555", borderColor: campaignFilter ? "#1a56db" : "#e5e5e5" }}
          >
            <option value="">All Campaigns</option>
            {contactCampaigns.map(cp => <option key={cp} value={cp}>{cp}</option>)}
          </select>
        )}
        {contactAgentOpts.length > 0 && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            style={{ border: "1.5px solid #e5e5e5", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: agentFilter ? "#1a56db" : "#555", borderColor: agentFilter ? "#1a56db" : "#e5e5e5" }}
          >
            <option value="">All Agents</option>
            {contactAgentOpts.map(a => <option key={a} value={a}>{a}</option>)}
            <option value="__none__">Unassigned</option>
          </select>
        )}
        <button
          onClick={() => setShowClosed(v => !v)}
          style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${showClosed ? "#059669" : "#e5e5e5"}`, background: showClosed ? "#dcfce7" : "#fff", color: showClosed ? "#059669" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >{showClosed ? "Hide Closed" : "Show Closed"}</button>
        {anyFilter && (
          <button
            onClick={() => { setSearch(""); setCampaignFilter(""); setAgentFilter(""); }}
            style={{ padding: "7px 12px", borderRadius: 9, border: "1.5px solid #e5e5e5", background: "#fff", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >✕ Clear</button>
        )}
      </div>

      {/* Kanban columns */}
      <div className="pipeline-wrap" onDragEnd={handleDragEnd}>
        {PIPELINE_COLS.map(col => {
          const cards = filtered.filter(c => c.status === col.key);
          const colValue = cards.reduce((s, c) => s + ((c as any).dealValue || 0), 0);
          const isOver = dragOverColumn === col.key;
          return (
            <div
              key={col.key}
              className={`pipeline-col${isOver ? " drag-over" : ""}`}
              style={{ color: col.color }}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={e => handleDrop(e, col.key)}
            >
              <div style={{ background: col.bg, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: col.color, textTransform: "uppercase", letterSpacing: .5 }}>{col.label}</span>
                  {colValue > 0 && <div style={{ fontSize: 10, color: col.color, opacity: .8, marginTop: 1 }}>RM {colValue.toLocaleString()}</div>}
                </div>
                <span style={{ background: col.color, color: "#fff", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{cards.length}</span>
              </div>
              <div className={`pipeline-col-body${isOver ? " drag-over" : ""}`} style={{ background: isOver ? col.bg + "40" : "#fafafa" }}>
                {cards.map(c => (
                  <PipelineCard
                    key={c.id}
                    c={c}
                    isDragging={draggingId === c.id}
                    onDragStart={handleDragStart}
                    onClick={setDetailId}
                  />
                ))}
                {cards.length === 0 && (
                  <div style={{ border: "1.5px dashed #ddd", borderRadius: 9, padding: "20px 10px", textAlign: "center", color: "#ccc", fontSize: 12, marginTop: 4 }}>Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => { setDetailId(null); setNoteText(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            {(() => {
              const c = detail;
              const sm = (CONTACT_STATUS_META as any)[c.status] || CONTACT_STATUS_META.contacted;
              const fieldRow = (label: string, value: string) => !value ? null : (
                <div style={{ padding: "7px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 2 }}>{label}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "#111", flex: 1, wordBreak: "break-word" as const }}>{value}</div>
                    <button
                      onClick={() => { safeCopy(value); showToast(label + " copied"); }}
                      style={{ padding: "2px 8px", borderRadius: 6, border: "1.5px solid #e5e5e5", background: "#fff", color: "#555", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                    >Copy</button>
                  </div>
                </div>
              );
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "#e8efff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#1a56db", flexShrink: 0 }}>{initials(c.name || "?")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -.3 }}>{c.name || "Unknown"}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg, padding: "2px 8px", borderRadius: 20 }}>{sm.label}</span>
                    </div>
                    <button onClick={() => { setDetailId(null); setNoteText(""); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#aaa", padding: "2px 6px" }}>✕</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginBottom: 14 }}>
                    {fieldRow("Phone", c.phone || "")}
                    {fieldRow("Mobile / Alt. Phone", c.phone2 || "")}
                    {fieldRow("Store Type", c.storeType || "")}
                    {fieldRow("Company / Agency", c.company || "")}
                    {fieldRow("Store ID", c.storeId || "")}
                    {fieldRow("REN ID", c.renId || "")}
                    {fieldRow("Remarks", c.remarks || "")}
                    {fieldRow("Campaign", c.campaign || "")}
                    {fieldRow("Agent (sheet)", c.agentName || "")}
                    {fieldRow("Date", c.date ? fmt(c.date) : "")}
                  </div>

                  {/* Call status */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Call Status</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["contacted", "callback", "interested"] as const).map(st => {
                        const stm = CONTACT_STATUS_META[st];
                        const active = c.status === st;
                        return (
                          <button
                            key={st}
                            onClick={() => updateStatus(c.id, st, currentDate, author)}
                            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1.5px solid ${active ? stm.color : "#e5e5e5"}`, background: active ? stm.bg : "#fff", color: active ? stm.color : "#aaa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }}
                          >{stm.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lead status */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Lead Status</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["hot", "warm", "cold"] as const).map(ls => {
                        const llm = CONTACT_LEAD_META[ls];
                        const active = c.leadStatus === ls;
                        return (
                          <button
                            key={ls}
                            onClick={() => updateLeadStatus(c.id, active ? null : ls, currentDate, author)}
                            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1.5px solid ${active ? llm.color : "#e5e5e5"}`, background: active ? llm.bg : "#fff", color: active ? llm.color : "#aaa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }}
                          >{ls === "hot" ? "🔴" : ls === "warm" ? "🟡" : "🔵"} {llm.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Callback date */}
                  {c.status === "callback" && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Callback Date</div>
                      <input
                        type="date"
                        value={c.callbackDate || ""}
                        onChange={e => updateCallbackDate(c.id, e.target.value)}
                        style={{ border: "1.5px solid #fde68a", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", color: "#111", background: "#fffbeb", outline: "none", width: "100%" }}
                      />
                    </div>
                  )}

                  {/* Sales agent — manager only */}
                  {isManager && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Sales Agent</div>
                      <select
                        value={c.salesAgent || ""}
                        onChange={e => updateSalesAgent(c.id, e.target.value)}
                        style={{ width: "100%", border: "1.5px solid #e5e5e5", borderRadius: 9, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }}
                      >
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Notes feed */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 8 }}>
                      Notes {(c.notes || []).length > 0 && <span style={{ color: "#1a56db" }}>({(c.notes || []).length})</span>}
                    </div>
                    {(c.notes || []).length > 0 && (
                      <div className="notes-feed" style={{ marginBottom: 8 }}>
                        {(c.notes as any[]).map((n: any) => (
                          <div key={n.id} className="note-item">
                            <div className="note-meta"><span>{n.author || "—"}</span><span>{fmtNoteTime(n.timestamp)}</span></div>
                            <div className="note-text">{n.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && noteText.trim()) {
                            addNote(c.id, noteText, author, currentDate);
                            setNoteText("");
                          }
                        }}
                        placeholder="Add a note…"
                        style={{ flex: 1, border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                      />
                      <button
                        onClick={() => {
                          if (noteText.trim()) {
                            addNote(c.id, noteText, author, currentDate);
                            setNoteText("");
                          }
                        }}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #1a56db", background: "#1a56db", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >Add</button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const txt = [
                        `Name: ${c.name || ""}`,
                        `Phone: ${c.phone || ""}`,
                        `Status: ${sm.label}`,
                        `Lead: ${c.leadStatus || "unclassified"}`,
                        `Agent: ${c.salesAgent || ""}`,
                        `Remarks: ${c.remarks || ""}`,
                      ].filter(l => !l.endsWith(": ")).join("\n");
                      navigator.clipboard.writeText(txt);
                      showToast("Copied");
                    }}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 9, border: "1.5px solid #1a56db", background: "#fff", color: "#1a56db", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >Copy All</button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
