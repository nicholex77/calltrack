import { useMemo } from "react";
import { todayKey, fmtNoteTime, initials } from "../lib/utils";
import { AVATAR_COLORS, CONTACT_STATUS_META, STAGE_PROBABILITY } from "../lib/constants";
import { TargetBar } from "../components/TargetBar";
import type { Contact, Member } from "../types";

interface Props {
  contacts: Contact[];
  members: Member[];
  isManager: boolean;
  loggedInMemberName: string | null;
  callTarget: number;
  intTarget: number;
  currentDate: string;
  onViewContact: (id: string) => void;
}

export function DashboardPage({ contacts, members, isManager, loggedInMemberName, callTarget, intTarget, currentDate, onViewContact }: Props) {
  const today = currentDate || todayKey();

  const visible = useMemo(() =>
    loggedInMemberName ? contacts.filter(c => c.salesAgent === loggedInMemberName) : contacts
  , [contacts, loggedInMemberName]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = visible.length;
    const pipelineValue = visible.filter(c => c.status !== "closed_lost").reduce((s, c) => s + (c.dealValue || 0), 0);
    const todayCallbacks = visible.filter(c => c.callbackDate === today).length;
    const interested = visible.filter(c => c.status === "interested" || c.status === "closed_won").length;
    const convRate = total > 0 ? Math.round(interested / total * 100) : 0;
    return { total, pipelineValue, todayCallbacks, convRate };
  }, [visible, today]);

  // ── Today's priorities ────────────────────────────────────────────────────
  const priorities = useMemo(() => {
    const overdue = visible
      .filter(c => c.nextFollowUp && c.nextFollowUp <= today && c.status !== "closed_won" && c.status !== "closed_lost")
      .sort((a, b) => (a.nextFollowUp || "").localeCompare(b.nextFollowUp || ""))
      .slice(0, 8);

    const callbacks = visible
      .filter(c => c.callbackDate === today)
      .slice(0, 8);

    const hotInactive = visible
      .filter(c => {
        if (c.leadStatus !== "hot") return false;
        if (!c.lastTouched) return true;
        const days = Math.floor((Date.now() - new Date(c.lastTouched + "T00:00:00").getTime()) / 86400000);
        return days > 2;
      })
      .slice(0, 8);

    return { overdue, callbacks, hotInactive };
  }, [visible, today]);

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    return members.map(m => {
      const calls = contacts.flatMap(c => (c.history || []).filter(h => h.by === m.name && (h.timestamp || "").startsWith(today))).length;
      const interested = contacts.flatMap(c => (c.history || []).filter(h => h.by === m.name && (h.timestamp || "").startsWith(today) && h.type === "status" && h.to === "interested")).length;
      return { ...m, calls, interested };
    }).sort((a, b) => b.calls - a.calls);
  }, [contacts, members, today]);

  // ── Activity feed ─────────────────────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const statusEvents = visible.flatMap(c =>
      (c.history || []).filter(h => h.type === "status").map(h => ({
        ...h,
        kind: "status" as const,
        contactName: c.name,
        contactId: c.id,
      }))
    );
    const noteEvents = visible.flatMap(c =>
      (c.notes || []).map((n: any) => ({
        id: n.id,
        timestamp: n.timestamp,
        by: n.author,
        kind: "note" as const,
        text: n.text,
        contactName: c.name,
        contactId: c.id,
      }))
    );
    return [...statusEvents, ...noteEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [visible]);

  // ── Revenue forecast + stale ─────────────────────────────────────────────
  const forecast = useMemo(() => {
    const weighted = Math.round(
      visible
        .filter(c => c.status !== "closed_lost" && (c.dealValue || 0) > 0)
        .reduce((s, c) => s + (c.dealValue || 0) * (STAGE_PROBABILITY[c.status] || 0) / 100, 0)
    );
    const stale = visible.filter(c => {
      if (c.status === "closed_won" || c.status === "closed_lost") return false;
      if (!c.lastTouched) return true;
      return Math.floor((Date.now() - new Date(c.lastTouched + "T00:00:00").getTime()) / 86400000) > 7;
    });
    return { weighted, stale };
  }, [visible]);

  // ── Monthly targets ───────────────────────────────────────────────────────
  const monthPrefix = today.slice(0, 7);
  const monthCalls = useMemo(() =>
    visible.flatMap(c => (c.history || []).filter(h => (h.timestamp || "").startsWith(monthPrefix))).length
  , [visible, monthPrefix]);
  const monthInterested = useMemo(() =>
    visible.filter(c => c.lastTouched?.startsWith(monthPrefix) && (c.status === "interested" || c.status === "closed_won")).length
  , [visible, monthPrefix]);
  const monthCallTarget = callTarget * 22;
  const monthIntTarget = intTarget * 22;

  const kpiCards = [
    { label: "Total Contacts", value: kpis.total.toLocaleString(), color: "#2563eb", bg: "#eff6ff" },
    { label: "Pipeline Value", value: kpis.pipelineValue > 0 ? `RM ${kpis.pipelineValue.toLocaleString()}` : "—", color: "#059669", bg: "#dcfce7" },
    { label: "Today's Callbacks", value: kpis.todayCallbacks.toString(), color: "#d97706", bg: "#fffbeb" },
    { label: "Conversion Rate", value: `${kpis.convRate}%`, color: "#7c3aed", bg: "#f5f3ff" },
  ];

  const PriorityList = ({ title, color, items, emptyMsg }: { title: string; color: string; items: Contact[]; emptyMsg: string }) => (
    <div className="card" style={{ flex: 1, minWidth: 220, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 13, color }}>{title}</div>
      {items.length === 0
        ? <div style={{ padding: "20px 16px", fontSize: 12, color: "#bbb", textAlign: "center" }}>{emptyMsg}</div>
        : items.map(c => {
          const sm = CONTACT_STATUS_META[c.status] || CONTACT_STATUS_META.contacted;
          return (
            <div key={c.id} onClick={() => onViewContact(c.id)} style={{ padding: "10px 16px", borderBottom: "1px solid #f8f8f8", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f8faff")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 6, alignItems: "center" }}>
                  {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ color: "#1a56db", textDecoration: "none", fontWeight: 600 }}>{c.phone}</a>}
                  {c.phone && c.salesAgent && <span>·</span>}
                  <span>{c.salesAgent || "Unassigned"}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: sm.color, background: sm.bg, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>{sm.label}</span>
            </div>
          );
        })
      }
    </div>
  );

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Dashboard</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {isManager ? "Team overview" : `${loggedInMemberName}'s overview`} · {new Date(today + "T00:00:00").toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {kpiCards.map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1.5px solid ${k.color}22`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: k.color, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Priorities */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Today's Priorities</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <PriorityList title="Overdue Follow-ups" color="#ef4444" items={priorities.overdue} emptyMsg="No overdue follow-ups" />
        <PriorityList title="Callbacks Today" color="#d97706" items={priorities.callbacks} emptyMsg="No callbacks scheduled today" />
        <PriorityList title="Hot Leads — Inactive 3+ Days" color="#7c3aed" items={priorities.hotInactive} emptyMsg="All hot leads are active" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {/* Team leaderboard */}
        {isManager && (
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 13 }}>Today's Leaderboard</div>
            {leaderboard.length === 0
              ? <div style={{ padding: "20px 16px", fontSize: 12, color: "#bbb", textAlign: "center" }}>No members yet</div>
              : leaderboard.map((m, i) => (
                <div key={m.id} style={{ padding: "10px 16px", borderBottom: "1px solid #f8f8f8", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, textAlign: "center", fontSize: 11, fontWeight: 800, color: i === 0 ? "#d97706" : "#aaa" }}>#{i + 1}</div>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: AVATAR_COLORS[m.colorIdx % AVATAR_COLORS.length][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials(m.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{m.calls} calls · {m.interested} interested</div>
                  </div>
                  {m.calls === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 7px", borderRadius: 20 }}>No calls</span>}
                </div>
              ))
            }
          </div>
        )}

        {/* Recent activity */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 13 }}>Recent Activity</div>
          {activityFeed.length === 0
            ? <div style={{ padding: "20px 16px", fontSize: 12, color: "#bbb", textAlign: "center" }}>No activity yet</div>
            : activityFeed.map((h: any) => {
              const fromSm = h.from ? CONTACT_STATUS_META[h.from] : null;
              const toSm = h.kind === "status" ? (CONTACT_STATUS_META[h.to] || { label: h.to, color: "#888", bg: "#f3f4f6" }) : null;
              return (
                <div key={h.id} onClick={() => onViewContact(h.contactId)} style={{ padding: "9px 16px", borderBottom: "1px solid #f8f8f8", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8faff")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{h.contactName}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{h.by || "—"}</span>
                      {h.kind === "status" && toSm && (
                        <>
                          {fromSm && <><span style={{ color: fromSm.color }}>{fromSm.label}</span><span>→</span></>}
                          <span style={{ color: toSm.color, fontWeight: 700 }}>{toSm.label}</span>
                        </>
                      )}
                      {h.kind === "note" && (
                        <span style={{ color: "#555", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>"{h.text}"</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#bbb", flexShrink: 0, marginTop: 2 }}>{fmtNoteTime(h.timestamp)}</span>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Monthly targets */}
      {(callTarget > 0 || intTarget > 0) && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Monthly Progress <span style={{ fontWeight: 500, color: "#888", fontSize: 12 }}>(~22 working days)</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {callTarget > 0 && <TargetBar label="Calls This Month" value={monthCalls} target={monthCallTarget} />}
            {intTarget > 0 && <TargetBar label="Interested This Month" value={monthInterested} target={monthIntTarget} />}
          </div>
        </div>
      )}

      {/* Revenue Forecast + Stale */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Weighted Forecast</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>
            {forecast.weighted > 0 ? `RM ${forecast.weighted.toLocaleString()}` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Expected revenue by stage probability</div>
        </div>
        <div style={{ background: forecast.stale.length > 0 ? "#fffbeb" : "#f9fafb", border: `1.5px solid ${forecast.stale.length > 0 ? "#fde68a" : "#e5e7eb"}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: forecast.stale.length > 0 ? "#d97706" : "#9ca3af", textTransform: "uppercase" as const, letterSpacing: .5, marginBottom: 6 }}>Stale Contacts</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: forecast.stale.length > 0 ? "#d97706" : "#9ca3af" }}>{forecast.stale.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Active contacts not touched in 7+ days</div>
        </div>
      </div>
    </div>
  );
}
