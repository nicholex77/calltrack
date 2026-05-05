import { useState, useMemo } from "react";
import { REJECTION_REASONS } from "../lib/constants";
import { addDays, todayKey } from "../lib/utils";
import type { Contact, Member } from "../types";

interface Props {
  contacts: Contact[];
  members: Member[];
  loggedInMemberName?: string | null;
}

const RANGES = [["today", "Today"], ["week", "This Week"], ["month", "Last 30 Days"], ["all", "All Time"]] as const;

function getDates(range: string): string[] | null {
  if (range === "all") return null;
  const today = todayKey();
  if (range === "today") return [today];
  if (range === "week") {
    const day = new Date(today).getDay();
    const mon = addDays(today, -(day === 0 ? 6 : day - 1));
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) dates.push(addDays(mon, i));
    return dates;
  }
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(addDays(today, -i));
  return dates;
}

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

export function RejectionPage({ contacts, members: _members, loggedInMemberName }: Props) {
  const [range, setRange] = useState("month");
  const [agentFilter, setAgentFilter] = useState(loggedInMemberName || "");

  const agentNames = useMemo(() =>
    Array.from(new Set(contacts.map(c => c.salesAgent || "").filter(Boolean))).sort()
  , [contacts]);

  const filtered = useMemo(() => {
    const dates = getDates(range);
    return contacts.filter(c => {
      if (!c.rejectionReason) return false;
      if (loggedInMemberName && c.salesAgent !== loggedInMemberName) return false;
      if (!loggedInMemberName && agentFilter && c.salesAgent !== agentFilter) return false;
      if (dates && c.lastTouched && !dates.includes(c.lastTouched)) return false;
      return true;
    });
  }, [contacts, range, agentFilter, loggedInMemberName]);

  const counts = useMemo(() =>
    REJECTION_REASONS.map(r => ({
      ...r,
      count: filtered.filter(c => c.rejectionReason === r.key).length,
    })).sort((a, b) => b.count - a.count)
  , [filtered]);

  const maxCount = Math.max(...counts.map(r => r.count), 1);
  const total = counts.reduce((s, r) => s + r.count, 0);

  // Notes for the most common reason
  const topReason = counts[0];
  const topNotes = topReason && topReason.count > 0
    ? filtered.filter(c => c.rejectionReason === topReason.key && c.rejectionNote).slice(0, 5)
    : [];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Rejection Analytics</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Why contacts didn't convert</div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {RANGES.map(([k, label]) => (
            <button key={k} className={`tab-btn ${range === k ? "active" : ""}`} onClick={() => setRange(k)}>{label}</button>
          ))}
        </div>
        {!loggedInMemberName && agentNames.length > 0 && (
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff" }}>
            <option value="">All agents</option>
            {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {total === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb", fontSize: 14, border: "1.5px dashed #e5e5e5", borderRadius: 16 }}>
          No rejection data yet for this filter.
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div className="card" style={{ flex: 1, minWidth: 120, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Total Rejections</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{total}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 120, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Top Reason</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS[0] }}>{topReason?.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{topReason?.count} times · {total > 0 ? Math.round(topReason.count / total * 100) : 0}%</div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {counts.map((r, i) => (
                <div key={r.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: COLORS[i % COLORS.length] }}>
                      {r.count} <span style={{ fontWeight: 500, color: "#aaa", fontSize: 11 }}>({total > 0 ? Math.round(r.count / total * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 10, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      width: `${Math.round(r.count / maxCount * 100)}%`,
                      background: COLORS[i % COLORS.length],
                      transition: "width .4s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context notes for top reason */}
          {topNotes.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Agent Notes — {topReason.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Recent context added by agents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topNotes.map(c => (
                  <div key={c.id} style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 9, padding: "9px 13px" }}>
                    <div style={{ fontSize: 12, color: "#333" }}>{c.rejectionNote}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{c.name} · {c.salesAgent || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
