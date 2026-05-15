import React from "react";
import { CONTACT_STATUS_META, CONTACT_LEAD_META, REJECTION_REASONS, LEAD_SOURCES } from "../lib/constants";
import { staleness, initials, fmt, fmtNoteTime, scoreContact } from "../lib/utils";
import { safeCopy } from "../lib/security";

const getRejCounts = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem("rej_counts") || "{}"); } catch { return {}; }
};
const bumpRejCount = (key: string) => {
  const c = getRejCounts(); c[key] = (c[key] || 0) + 1;
  localStorage.setItem("rej_counts", JSON.stringify(c));
};

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid #e5e5e5", borderRadius: 7,
  padding: "5px 8px", fontSize: 13, fontFamily: "inherit",
  outline: "none", color: "#111", background: "#fff", boxSizing: "border-box",
};

export const ContactRow = React.memo(function ContactRow({ c, isOpen, isSelected, selectMode, isManager, members, onToggle, onSelect, onSalesAgent, onLeadStatus, onStatus, onCallbackDate, onUpdate, onAddNote, authorName, onDelete, onToast, waTemplates, qaTemplates }: any) {
  const sm = CONTACT_STATUS_META[c.status] || CONTACT_STATUS_META.contacted;
  const lm = c.leadStatus ? CONTACT_LEAD_META[c.leadStatus] : null;
  const st = staleness(c.lastTouched || "");
  const score = scoreContact(c);
  const scoreBg = score >= 70 ? "#f0fdf4" : score >= 40 ? "#fffbeb" : "#f9f9f9";
  const scoreColor = score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#9ca3af";
  const [noteText, setNoteText] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [swipeOpen, setSwipeOpen] = React.useState(false);
  const [showTpl, setShowTpl] = React.useState(false);
  const [showQa, setShowQa] = React.useState(false);
  const [activeTplId, setActiveTplId] = React.useState<string>("");
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const [selectedReason, setSelectedReason] = React.useState("");
  const [rejNote, setRejNote] = React.useState("");
  const rejPickerRef = React.useRef<HTMLDivElement>(null);

  // Sort rejection reasons by most-used (localStorage counts)
  const sortedReasons = React.useMemo(() => {
    const counts = getRejCounts();
    return [...REJECTION_REASONS].sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0));
  }, [pendingStatus]); // recompute each time picker opens

  React.useEffect(() => {
    if (pendingStatus) {
      setSelectedReason(""); setRejNote("");
      setTimeout(() => rejPickerRef.current?.focus(), 50);
    }
  }, [pendingStatus]);

  const confirmRejection = React.useCallback(() => {
    if (!selectedReason || !pendingStatus) return;
    onStatus(c.id, pendingStatus, authorName);
    onUpdate(c.id, "rejectionReason", selectedReason);
    onUpdate(c.id, "rejectionNote", rejNote.trim());
    bumpRejCount(selectedReason);
    setPendingStatus(null);
  }, [selectedReason, pendingStatus, rejNote, c.id, authorName, onStatus, onUpdate]);

  const handlePickerKey = React.useCallback((e: React.KeyboardEvent) => {
    const n = parseInt(e.key);
    if (n >= 1 && n <= sortedReasons.length) { e.preventDefault(); setSelectedReason(sortedReasons[n - 1].key); return; }
    if (e.key === "Enter") { e.preventDefault(); confirmRejection(); }
    if (e.key === "Escape") setPendingStatus(null);
  }, [sortedReasons, confirmRejection]);

  const handleStatusClick = React.useCallback((st: string) => {
    if (st === "contacted" || st === "hangup") { setPendingStatus(st); }
    else { onStatus(c.id, st, authorName); setPendingStatus(null); }
  }, [c.id, authorName, onStatus]);
  const tags: string[] = c.tags || [];
  const answers: Record<string, any> = c.answers || {};
  const qaTpls: any[] = qaTemplates || [];
  const effectiveTplId = activeTplId || qaTpls[0]?.id || "";
  const activeTpl = qaTpls.find((t: any) => t.id === effectiveTplId);
  const tplAnswers: Record<string, string> = (answers[effectiveTplId] as any) || {};
  const swipeTouchStart = React.useRef<{ x: number, y: number } | null>(null);
  const didSwipe = React.useRef(false);

  const editRow = (label: string, field: string, value: string, type = "text") => (
    <div style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 4 }}>{label}</div>
      <input
        key={value}
        type={type}
        defaultValue={value}
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = "#1a56db")}
        onBlur={e => { e.target.style.borderColor = "#e5e5e5"; if (e.target.value !== value) onUpdate(c.id, field, e.target.value); }}
      />
    </div>
  );

  const editTextarea = (label: string, field: string, value: string) => (
    <div style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0", gridColumn: "1 / -1" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 4 }}>{label}</div>
      <textarea
        key={value}
        defaultValue={value}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
        onFocus={e => (e.target.style.borderColor = "#1a56db")}
        onBlur={e => { e.target.style.borderColor = "#e5e5e5"; if (e.target.value !== value) onUpdate(c.id, field, e.target.value); }}
      />
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${isOpen ? "#1a56db" : selectMode && isSelected ? "#1a56db" : "#ebebeb"}`, borderRadius: 12, overflow: "hidden", transition: "border-color .15s" }}>
      <div
        style={{ position: "relative", overflow: "hidden" }}
        onTouchStart={e => { const t = e.touches[0]; swipeTouchStart.current = { x: t.clientX, y: t.clientY }; didSwipe.current = false; }}
        onTouchMove={e => { if (!swipeTouchStart.current) return; const dx = e.touches[0].clientX - swipeTouchStart.current.x; const dy = e.touches[0].clientY - swipeTouchStart.current.y; if (Math.abs(dx) > Math.abs(dy)) { if (dx < -20) { didSwipe.current = true; setSwipeOpen(true); } else if (dx > 20) { setSwipeOpen(false); } } }}
        onTouchEnd={() => { swipeTouchStart.current = null; }}
      >
        <div onClick={() => { if (didSwipe.current) { didSwipe.current = false; return; } if (swipeOpen) { setSwipeOpen(false); return; } selectMode ? onSelect(c.id) : onToggle(c.id); }} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: isOpen ? "#f8faff" : "#fff", transition: "transform .15s,background .12s", transform: swipeOpen ? "translateX(-76px)" : "none" }}>
          {selectMode && (
            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? "#1a56db" : "#ccc"}`, background: isSelected ? "#1a56db" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          )}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isOpen ? "#1a56db" : "#e8efff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: isOpen ? "#fff" : "#1a56db", flexShrink: 0, transition: "all .15s" }}>{initials(c.name || "?")}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || "Unknown"}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{c.phone || "—"}{c.storeType ? ` · ${c.storeType}` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {st && <span className={st.cls}>{st.label}</span>}
            {lm && <span style={{ fontSize: 10, fontWeight: 700, color: lm.color, background: lm.bg, padding: "2px 7px", borderRadius: 20 }}>{lm.label}</span>}
            <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg, padding: "2px 8px", borderRadius: 20 }}>{sm.label}</span>
            {c.source && <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", padding: "2px 7px", borderRadius: 20 }}>{c.source}</span>}
            {c.dealValue != null && <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "#dcfce7", padding: "2px 7px", borderRadius: 20 }}>RM {Number(c.dealValue).toLocaleString()}</span>}
            {c.campaign && <span style={{ fontSize: 10, fontWeight: 600, color: "#7c3aed", background: "#f5f3ff", padding: "2px 7px", borderRadius: 20, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.campaign}</span>}
            {c.salesAgent && <span style={{ fontSize: 11, color: "#555", background: "#f5f5f5", padding: "2px 8px", borderRadius: 20 }}>{c.salesAgent}</span>}
            {tags.slice(0, 2).map((t: string) => <span key={t} style={{ fontSize: 10, fontWeight: 600, color: "#0e7490", background: "#ecfeff", padding: "2px 7px", borderRadius: 20, border: "1px solid #a5f3fc" }}>#{t}</span>)}
            {tags.length > 2 && <span style={{ fontSize: 10, fontWeight: 600, color: "#0e7490", background: "#ecfeff", padding: "2px 7px", borderRadius: 20, border: "1px solid #a5f3fc" }}>+{tags.length - 2}</span>}
            <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor, background: scoreBg, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>{score}</span>
            {!selectMode && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isOpen ? "#1a56db" : "#bbb"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>}
          </div>
        </div>
        {swipeOpen && (
          <div className="swipe-strip" style={{ background: "#1a56db" }}>
            {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "rgba(255,255,255,.18)", color: "#fff", fontSize: 18, textDecoration: "none" }}>📞</a>}
            <button onClick={e => { e.stopPropagation(); onStatus(c.id, "interested", authorName); setSwipeOpen(false); }} style={{ flex: 1, border: "none", borderRadius: 7, background: "#059669", color: "#fff", fontFamily: "inherit", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>INT</button>
            <button onClick={e => { e.stopPropagation(); onStatus(c.id, "callback", authorName); setSwipeOpen(false); }} style={{ flex: 1, border: "none", borderRadius: 7, background: "#d97706", color: "#fff", fontFamily: "inherit", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>CB</button>
            <button onClick={e => { e.stopPropagation(); setSwipeOpen(false); }} style={{ flex: 1, border: "none", borderRadius: 7, background: "rgba(255,255,255,.15)", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>
      {isOpen && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: "1.5px solid #e8efff", padding: "16px 16px 14px", background: "#f8faff", animation: "fadeUp .15s ease both" }}>
          {/* Editable fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
            {editRow("Name", "name", c.name || "")}
            {editRow("Phone", "phone", c.phone || "")}
            {editRow("Mobile / Alt. Phone", "phone2", c.phone2 || "")}
            {editRow("Email", "email", c.email || "", "email")}
            {editRow("Store ID", "storeId", c.storeId || "")}
            {editRow("REN ID", "renId", c.renId || "")}
            {editRow("Store Type", "storeType", c.storeType || "")}
            {editRow("Company / Agency", "company", c.company || "")}
            {editRow("Agent (from sheet)", "agentName", c.agentName || "")}
            {editRow("Call Date", "date", c.date || "", "date")}
            {editRow("Re-contact Date", "reContactDate", c.reContactDate || "", "date")}
            {editRow("Campaign", "campaign", c.campaign || "")}
            {editTextarea("Remarks / State", "remarks", c.remarks || "")}
            {/* Source dropdown */}
            <div style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 4 }}>Lead Source</div>
              <select value={c.source || ""} onChange={e => onUpdate(c.id, "source", e.target.value)} style={inputStyle}>
                <option value="">— Select source —</option>
                {LEAD_SOURCES.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Deal Value */}
            <div style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 4 }}>Deal Value (RM)</div>
              <input
                type="number" key={c.dealValue ?? ""} defaultValue={c.dealValue ?? ""}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#1a56db")}
                onBlur={e => { e.target.style.borderColor = "#e5e5e5"; const v = parseFloat(e.target.value); if ((v || 0) !== (c.dealValue || 0)) onUpdate(c.id, "dealValue", e.target.value); }}
              />
            </div>
            {/* Next Follow-Up */}
            <div style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 4 }}>Next Follow-Up</div>
              <input type="date" key={c.nextFollowUp || ""} defaultValue={c.nextFollowUp || ""} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#1a56db")}
                onBlur={e => { e.target.style.borderColor = "#e5e5e5"; if (e.target.value !== (c.nextFollowUp || "")) onUpdate(c.id, "nextFollowUp", e.target.value); }}
              />
            </div>
          </div>

          {/* Call + Lead status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1.5px solid #e8efff" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Call Status</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                {(["contacted", "callback", "interested"] as const).map(st => {
                  const stm = CONTACT_STATUS_META[st];
                  const active = c.status === st;
                  return <button key={st} onClick={() => handleStatusClick(st)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1.5px solid ${active ? stm.color : "#e5e5e5"}`, background: active ? stm.bg : "#fff", color: active ? stm.color : "#aaa", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }}>{stm.label}</button>;
                })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["not_answered", "hangup"] as const).map(st => {
                  const stm = CONTACT_STATUS_META[st];
                  const active = c.status === st;
                  return <button key={st} onClick={() => handleStatusClick(st)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1.5px solid ${active ? stm.color : "#e5e5e5"}`, background: active ? stm.bg : "#fff", color: active ? stm.color : "#aaa", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }}>{stm.label}</button>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Lead Status</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["hot", "warm", "cold"] as const).map(ls => {
                  const llm = CONTACT_LEAD_META[ls];
                  const active = c.leadStatus === ls;
                  return <button key={ls} onClick={() => onLeadStatus(c.id, active ? null : ls, authorName)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1.5px solid ${active ? llm.color : "#e5e5e5"}`, background: active ? llm.bg : "#fff", color: active ? llm.color : "#aaa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .12s" }}>{ls === "hot" ? "🔴" : ls === "warm" ? "🟡" : "🔵"} {llm.label}</button>;
                })}
              </div>
            </div>
          </div>

          {/* Close Deal — only visible when not already closed */}
          {c.status !== "closed_won" && c.status !== "closed_lost" && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid #e8efff", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5 }}>Close Deal</span>
              <button onClick={() => handleStatusClick("closed_won")} style={{ padding: "5px 14px", borderRadius: 8, border: "1.5px solid #a7f3d0", background: "#dcfce7", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Closed Won</button>
              <button onClick={() => handleStatusClick("closed_lost")} style={{ padding: "5px 14px", borderRadius: 8, border: "1.5px solid #e5e5e5", background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Closed Lost</button>
            </div>
          )}

          {/* Rejection reason picker — required for contacted/hangup */}
          {pendingStatus && (
            <div ref={rejPickerRef} tabIndex={0} onKeyDown={handlePickerKey} style={{ marginTop: 10, padding: 14, background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 10, outline: "none" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>
                Why didn't they convert? <span style={{ fontWeight: 500, color: "#b45309" }}>· Press 1–{sortedReasons.length}, Enter to confirm, Esc to cancel</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                {sortedReasons.map((r, i) => {
                  const counts = getRejCounts();
                  const isTop = i === 0 && (counts[r.key] || 0) > 0;
                  const active = selectedReason === r.key;
                  return (
                    <button key={r.key} onClick={() => setSelectedReason(r.key)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${active ? "#f59e0b" : "#e5e5e5"}`, background: active ? "#fef3c7" : isTop ? "#fafaf0" : "#fff", color: active ? "#92400e" : "#333", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all .1s" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: active ? "#f59e0b" : "#aaa", background: active ? "#fef3c7" : "#f5f5f5", padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{i + 1}</span>
                      {r.label}
                      {isTop && <span style={{ marginLeft: "auto", fontSize: 10, color: "#d97706", fontWeight: 600 }}>frequent</span>}
                    </button>
                  );
                })}
              </div>
              <input
                value={rejNote} onChange={e => setRejNote(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); confirmRejection(); } if (e.key === "Escape") { e.stopPropagation(); setPendingStatus(null); } }}
                placeholder="Add more context (optional)"
                style={{ width: "100%", border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPendingStatus(null)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1.5px solid #e5e5e5", background: "#fff", color: "#888", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={confirmRejection} disabled={!selectedReason} style={{ flex: 2, padding: "7px 0", borderRadius: 8, border: "none", background: selectedReason ? "#f59e0b" : "#e5e5e5", color: selectedReason ? "#fff" : "#aaa", fontSize: 12, fontWeight: 700, cursor: selectedReason ? "pointer" : "default", fontFamily: "inherit" }}>
                  Confirm {selectedReason ? `· ${sortedReasons.find(r => r.key === selectedReason)?.label}` : ""}
                </button>
              </div>
            </div>
          )}

          {/* Callback date */}
          {c.status === "callback" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Callback Date</div>
              <input type="date" value={c.callbackDate || ""} onChange={e => onCallbackDate(c.id, e.target.value)} style={{ border: "1.5px solid #fde68a", borderRadius: 9, padding: "7px 11px", fontSize: 13, fontFamily: "inherit", color: "#111", background: "#fffbeb", outline: "none", width: "100%" }} />
            </div>
          )}

          {/* Sales Agent — available to all roles */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Sales Agent</div>
            <select value={c.salesAgent || ""} onChange={e => onSalesAgent(c.id, e.target.value)} style={{ width: "100%", border: "1.5px solid #e5e5e5", borderRadius: 9, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }}>
              <option value="">Unassigned</option>
              {(members || []).map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 8 }}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {tags.map((t: string) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#0e7490", background: "#ecfeff", padding: "3px 4px 3px 9px", borderRadius: 20, border: "1px solid #a5f3fc" }}>
                  #{t}
                  <button onClick={() => onUpdate(c.id, "tags", tags.filter(x => x !== t))} style={{ background: "none", border: "none", color: "#0891b2", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 4px", fontFamily: "inherit" }}>×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    const v = tagInput.trim().toLowerCase();
                    if (!tags.includes(v)) onUpdate(c.id, "tags", [...tags, v]);
                    setTagInput("");
                  }
                }}
                placeholder="+ add tag (Enter)"
                style={{ border: "1.5px dashed #cbd5e1", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontFamily: "inherit", outline: "none", minWidth: 120, background: "#fafafa" }}
                onFocus={e => (e.target.style.borderColor = "#0891b2")}
                onBlur={e => (e.target.style.borderColor = "#cbd5e1")}
              />
            </div>
          </div>

          {/* Q&A */}
          {qaTpls.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showQa ? 10 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5 }}>Q&amp;A</div>
                <button onClick={() => setShowQa(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: "#1a56db", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 7, padding: "2px 10px", cursor: "pointer", fontFamily: "inherit" }}>{showQa ? "Hide" : "Fill Q&A"}</button>
              </div>
              {showQa && (
                <>
                  {qaTpls.length > 1 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                      {qaTpls.map((t: any) => (
                        <button key={t.id} onClick={() => setActiveTplId(t.id)} style={{ padding: "4px 10px", borderRadius: 7, border: `1.5px solid ${t.id === effectiveTplId ? "#1a56db" : "#e5e5e5"}`, background: t.id === effectiveTplId ? "#eff6ff" : "#fff", color: t.id === effectiveTplId ? "#1a56db" : "#555", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.name}</button>
                      ))}
                    </div>
                  )}
                  {activeTpl && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activeTpl.questions.map((q: any, idx: number) => (
                        <div key={q.id}>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "#1a56db", background: "#eff6ff", padding: "3px 8px", borderRadius: 6, flexShrink: 0, marginTop: 1 }}>Q{idx + 1}</div>
                            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.5, fontWeight: 600 }}>{q.text}</div>
                          </div>
                          <textarea
                            key={tplAnswers[q.id] || ""}
                            defaultValue={tplAnswers[q.id] || ""}
                            rows={2}
                            placeholder="Type answer…"
                            style={{ ...inputStyle, resize: "vertical" }}
                            onFocus={e => (e.target.style.borderColor = "#1a56db")}
                            onBlur={e => {
                              e.target.style.borderColor = "#e5e5e5";
                              const v = e.target.value;
                              if (v !== (tplAnswers[q.id] || "")) {
                                onUpdate(c.id, "answers", { ...answers, [effectiveTplId]: { ...tplAnswers, [q.id]: v } });
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* WA Templates */}
          {(waTemplates || []).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showTpl ? 8 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5 }}>WA Templates</div>
                <button onClick={() => setShowTpl(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ecfdf5", border: "1.5px solid #a7f3d0", borderRadius: 7, padding: "2px 10px", cursor: "pointer", fontFamily: "inherit" }}>{showTpl ? "Hide" : "Use Template"}</button>
              </div>
              {showTpl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                  {(waTemplates as any[]).map((t: any) => (
                    <button key={t.id} onClick={() => {
                      const msg = t.body.replace(/\{name\}/gi, c.name || "").replace(/\{phone\}/gi, c.phone || "").replace(/\{company\}/gi, c.company || "");
                      safeCopy(msg); onToast(`"${t.name}" copied`); setShowTpl(false);
                    }} style={{ textAlign: "left", padding: "8px 12px", borderRadius: 9, border: "1.5px solid #e5e5e5", background: "#fff", fontFamily: "inherit", cursor: "pointer", fontSize: 12, color: "#333", transition: "background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0fdf4")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                      <div style={{ fontWeight: 700, color: "#059669", marginBottom: 2 }}>{t.name}</div>
                      <div style={{ color: "#888", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.body.slice(0, 80)}{t.body.length > 80 ? "…" : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity timeline */}
          {(c.history || []).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 8 }}>Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {([...(c.history || [])].reverse() as any[]).map((h: any) => {
                  const toSm = (CONTACT_STATUS_META as any)[h.to] || { label: h.to, color: "#888", bg: "#f3f4f6" };
                  const fromSm = h.from ? (CONTACT_STATUS_META as any)[h.from] : null;
                  return (
                    <div key={h.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, padding: "5px 8px", background: "#fafafa", borderRadius: 7 }}>
                      <span style={{ flexShrink: 0, color: "#bbb", minWidth: 60 }}>{h.timestamp ? new Date(h.timestamp).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}</span>
                      <span style={{ color: "#888", flexShrink: 0 }}>{h.by || "—"}</span>
                      <span style={{ flex: 1, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        {fromSm && <><span style={{ color: fromSm.color, fontWeight: 600 }}>{fromSm.label}</span><span style={{ color: "#ccc" }}>→</span></>}
                        <span style={{ color: toSm.color, fontWeight: 700 }}>{toSm.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid #e8efff" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 8 }}>Notes {(c.notes || []).length > 0 && <span style={{ color: "#1a56db" }}>({(c.notes || []).length})</span>}</div>
            {(c.notes || []).length > 0 && (
              <div className="notes-feed">
                {(c.notes as any[]).map((n: any) => (
                  <div key={n.id} className="note-item">
                    <div className="note-meta"><span>{n.author || "—"}</span><span>{fmtNoteTime(n.timestamp)}</span></div>
                    <div className="note-text">{n.text}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) { onAddNote(c.id, noteText, authorName); setNoteText(""); } }} placeholder="Add a note…" style={{ flex: 1, border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none" }} onFocus={e => e.target.style.borderColor = "#1a56db"} onBlur={e => e.target.style.borderColor = "#e5e5e5"} />
              <button onClick={() => { if (noteText.trim()) { onAddNote(c.id, noteText, authorName); setNoteText(""); } }} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #1a56db", background: "#1a56db", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => {
              const txt = [`Name: ${c.name || ""}`, `Phone: ${c.phone || ""}`, `Mobile / Alt. Phone: ${c.phone2 || ""}`, `Email: ${c.email || ""}`, `Store ID: ${c.storeId || ""}`, `REN ID: ${c.renId || ""}`, `Store Type: ${c.storeType || ""}`, `Company / Agency: ${c.company || ""}`, `Status: ${sm.label}`, `Agent (sheet): ${c.agentName || ""}`, `Date: ${c.date ? fmt(c.date) : ""}`, `Campaign: ${c.campaign || ""}`, `Remarks: ${c.remarks || ""}`, `Sales Agent: ${c.salesAgent || ""}`].filter(l => !l.endsWith(": ")).join("\n");
              safeCopy(txt); onToast("All details copied");
            }} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "1.5px solid #1a56db", background: "#fff", color: "#1a56db", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Copy All</button>
            {isManager && <button onClick={() => { if (window.confirm(`Delete ${c.name || "this contact"}?`)) { onDelete(c.id); onToggle(null); } }} style={{ padding: "8px 16px", borderRadius: 9, border: "1.5px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
});
