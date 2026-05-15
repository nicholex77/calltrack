import { useState, useMemo } from "react";
import { initials, todayKey, weekStart, addDays, scoreContact } from "../lib/utils";
import { AVATAR_COLORS, CONTACT_STATUS_META, REJECTION_REASONS } from "../lib/constants";
import type { Contact, Member } from "../types";

interface Props {
  contacts: Contact[];
  members: Member[];
  analyticsTab: "overview" | "agents" | "pipeline" | "campaigns" | "rejections";
  setAnalyticsTab: (t: "overview" | "agents" | "pipeline" | "campaigns" | "rejections") => void;
  onReassignStale: (agentName: string) => void;
  loggedInMemberName?: string | null;
}

const pct = (n: number, t: number) => t > 0 ? Math.round(n / t * 100) : 0;

export function AnalyticsPage({ contacts, members, analyticsTab, setAnalyticsTab, onReassignStale, loggedInMemberName }: Props) {
  const today = todayKey();
  const visible = loggedInMemberName ? contacts.filter(c => c.salesAgent === loggedInMemberName) : contacts;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Analytics</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {loggedInMemberName ? `Showing data for ${loggedInMemberName}` : `${contacts.length} total contacts`}
        </div>
      </div>

      <div className="stats-tab-bar" style={{ marginBottom: 20 }}>
        {(["overview", "agents", "pipeline", "campaigns", "rejections"] as const).map(t => (
          <button key={t} className={`stats-tab${analyticsTab === t ? " active" : ""}`} onClick={() => setAnalyticsTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {analyticsTab === "overview"    && <OverviewTab contacts={visible} today={today} />}
      {analyticsTab === "agents"      && <AgentsTab contacts={contacts} members={members} loggedInMemberName={loggedInMemberName} onReassignStale={onReassignStale} today={today} />}
      {analyticsTab === "pipeline"    && <PipelineTab contacts={visible} />}
      {analyticsTab === "campaigns"   && <CampaignsTab contacts={visible} />}
      {analyticsTab === "rejections"  && <RejectionsTab contacts={contacts} loggedInMemberName={loggedInMemberName} />}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ contacts, today }: { contacts: Contact[]; today: string }) {
  const total = contacts.length;
  const pipelineValue = contacts.filter(c => c.status !== "closed_lost").reduce((s, c) => s + (c.dealValue || 0), 0);
  const closedWon = contacts.filter(c => c.status === "closed_won").length;
  const closedLost = contacts.filter(c => c.status === "closed_lost").length;
  const convRate = pct(closedWon, closedWon + closedLost);
  const activeDeals = contacts.filter(c => (c.dealValue || 0) > 0 && c.status !== "closed_lost" && c.status !== "closed_won").length;

  const kpiCards = [
    { label: "Total Contacts", value: total.toLocaleString(), color: "#2563eb", bg: "#eff6ff" },
    { label: "Pipeline Value", value: pipelineValue > 0 ? `RM ${pipelineValue.toLocaleString()}` : "—", color: "#059669", bg: "#dcfce7" },
    { label: "Win Rate", value: `${convRate}%`, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Active Deals", value: activeDeals.toString(), color: "#d97706", bg: "#fffbeb" },
  ];

  // 7-day call trend
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));
  const dailyCounts = days7.map(d => ({
    date: d,
    calls: contacts.flatMap(c => (c.history || []).filter(h => (h.timestamp || "").startsWith(d))).length,
    interested: contacts.flatMap(c => (c.history || []).filter(h => (h.timestamp || "").startsWith(d) && h.type === "status" && h.to === "interested")).length,
  }));
  const maxCalls = Math.max(1, ...dailyCounts.map(d => d.calls));

  // 4-week rejection trend
  const weeks4 = Array.from({ length: 4 }, (_, i) => {
    const mon = addDays(weekStart(today), -(3 - i) * 7);
    const dates = Array.from({ length: 7 }, (_, j) => addDays(mon, j));
    const touched = contacts.filter(c => c.lastTouched && dates.includes(c.lastTouched)).length;
    const rejected = contacts.filter(c => c.rejectionReason && c.lastTouched && dates.includes(c.lastTouched)).length;
    return { label: `W${i + 1}`, touched, rejected, rate: pct(rejected, touched) };
  });

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10, marginBottom: 24 }}>
        {kpiCards.map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1.5px solid ${k.color}22`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: k.color, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 7-day call trend */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>7-Day Activity Trend</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
          {dailyCounts.map(d => (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{d.calls}</div>
              <div style={{ width: "100%", background: d.calls > 0 ? "#1a56db" : "#e8efff", borderRadius: "4px 4px 0 0", height: `${Math.max(4, Math.round(d.calls / maxCalls * 64))}px`, position: "relative" }}>
                {d.interested > 0 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.round(d.interested / Math.max(d.calls, 1) * 100)}%`, background: "#059669", borderRadius: "4px 4px 0 0" }} />
                )}
              </div>
              <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "#888" }}>
          <span style={{ color: "#1a56db" }}>■ Calls</span>
          <span style={{ color: "#059669" }}>■ Interested</span>
        </div>
      </div>

      {/* 4-week rejection trend */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>4-Week Rejection Rate</div>
        <div style={{ display: "flex", gap: 8 }}>
          {weeks4.map(w => (
            <div key={w.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: w.rate > 30 ? "#ef4444" : w.rate > 15 ? "#d97706" : "#059669" }}>{w.rate}%</div>
              <div style={{ fontSize: 11, color: "#888" }}>{w.label}</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>{w.rejected}/{w.touched}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Agents ────────────────────────────────────────────────────────────────────

function AgentsTab({ contacts, members, loggedInMemberName, onReassignStale, today }: {
  contacts: Contact[]; members: Member[];
  loggedInMemberName?: string | null; onReassignStale: (n: string) => void; today: string;
}) {
  const agentNames = loggedInMemberName
    ? [loggedInMemberName]
    : Array.from(new Set(contacts.map(c => c.salesAgent || "").filter(Boolean))).sort();

  const agentRows = agentNames.map(name => {
    const cs = contacts.filter(c => c.salesAgent === name);
    const total = cs.length;
    const contacted = cs.filter(c => c.status === "contacted").length;
    const callback = cs.filter(c => c.status === "callback").length;
    const interested = cs.filter(c => c.status === "interested").length;
    const closedWon = cs.filter(c => c.status === "closed_won").length;
    const closedLost = cs.filter(c => c.status === "closed_lost").length;
    const pipelineValue = cs.filter(c => c.status !== "closed_lost").reduce((s, c) => s + (c.dealValue || 0), 0);
    const hot = cs.filter(c => c.leadStatus === "hot").length;
    const stale = cs.filter(c => {
      if (!c.lastTouched) return true;
      return Math.floor((Date.now() - new Date(c.lastTouched + "T00:00:00").getTime()) / 86400000) > 7;
    }).length;
    const callbackDueToday = cs.filter(c => c.callbackDate === today).length;
    const avgScore = cs.length > 0 ? Math.round(cs.reduce((s, c) => s + scoreContact(c), 0) / cs.length) : 0;
    const todayCalls = contacts.flatMap(c => (c.history || []).filter(h => h.by === name && (h.timestamp || "").startsWith(today))).length;
    const answerRate = pct(contacted + callback + interested + closedWon, total);
    const convRate = pct(interested + closedWon, total);
    const member = members.find(m => m.name === name);
    return { name, total, contacted, callback, interested, closedWon, closedLost, pipelineValue, hot, stale, callbackDueToday, avgScore, todayCalls, answerRate, convRate, colorIdx: member?.colorIdx ?? 0 };
  });

  const teamAvgConv = agentRows.length > 0 ? Math.round(agentRows.reduce((s, r) => s + r.convRate, 0) / agentRows.length) : 0;

  if (agentRows.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No contacts assigned to agents yet.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Team avg conversion: <strong>{teamAvgConv}%</strong></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {agentRows.map(r => (
          <div key={r.name} style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: AVATAR_COLORS[r.colorIdx % AVATAR_COLORS.length][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials(r.name)}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{r.total} contact{r.total !== 1 ? "s" : ""} · answer {r.answerRate}% · conv {r.convRate}%{r.convRate > teamAvgConv ? " ↑" : r.convRate < teamAvgConv ? " ↓" : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {r.todayCalls === 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 8px", borderRadius: 20 }}>No calls today</span>}
                {r.hot > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fff1f2", padding: "2px 8px", borderRadius: 20 }}>{r.hot} hot</span>}
                {r.callbackDueToday > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 8px", borderRadius: 20 }}>{r.callbackDueToday} callback today</span>}
                {r.stale > 0 && <><span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>{r.stale} stale</span><button onClick={() => onReassignStale(r.name)} style={{ fontSize: 11, fontWeight: 700, color: "#1a56db", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Reassign →</button></>}
                <span style={{ fontSize: 11, fontWeight: 700, color: r.avgScore >= 70 ? "#059669" : r.avgScore >= 40 ? "#d97706" : "#9ca3af", background: r.avgScore >= 70 ? "#f0fdf4" : r.avgScore >= 40 ? "#fffbeb" : "#f9f9f9", padding: "2px 8px", borderRadius: 20 }}>score {r.avgScore}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 10 }}>
              {[
                { label: "Contacted", val: r.contacted, color: "#2563eb", bg: "#eff6ff" },
                { label: "Callback", val: r.callback, color: "#d97706", bg: "#fffbeb" },
                { label: "Interested", val: r.interested, color: "#059669", bg: "#f0fdf4" },
                { label: "Closed Won", val: r.closedWon, color: "#059669", bg: "#dcfce7" },
                { label: "Closed Lost", val: r.closedLost, color: "#6b7280", bg: "#f3f4f6" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: .4, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{pct(val, r.total)}%</div>
                </div>
              ))}
              {r.pipelineValue > 0 && (
                <div style={{ background: "#dcfce7", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", textTransform: "uppercase" as const, letterSpacing: .4, marginBottom: 4 }}>Pipeline</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>RM {r.pipelineValue.toLocaleString()}</div>
                </div>
              )}
            </div>
            {r.total > 0 && (
              <div>
                <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 1 }}>
                  <div style={{ flex: r.contacted, background: "#93c5fd", minWidth: r.contacted ? 2 : 0 }} />
                  <div style={{ flex: r.callback, background: "#fcd34d", minWidth: r.callback ? 2 : 0 }} />
                  <div style={{ flex: r.interested, background: "#6ee7b7", minWidth: r.interested ? 2 : 0 }} />
                  <div style={{ flex: r.closedWon, background: "#059669", minWidth: r.closedWon ? 2 : 0 }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function PipelineTab({ contacts }: { contacts: Contact[] }) {
  const total = contacts.length;
  const contacted = contacts.filter(c => ["contacted", "callback", "interested", "closed_won"].includes(c.status)).length;
  const callback = contacts.filter(c => ["callback", "interested", "closed_won"].includes(c.status)).length;
  const interested = contacts.filter(c => ["interested", "closed_won"].includes(c.status)).length;
  const closedWon = contacts.filter(c => c.status === "closed_won").length;
  const closedLost = contacts.filter(c => c.status === "closed_lost").length;
  const notAnswered = contacts.filter(c => ["not_answered", "hangup"].includes(c.status)).length;
  const winRate = pct(closedWon, closedWon + closedLost);

  const funnelSteps = [
    { label: "Total Contacts", val: total, color: "#6366f1", bg: "#eef2ff" },
    { label: "Contacted", val: contacted, color: "#2563eb", bg: "#eff6ff" },
    { label: "Callback / Follow-up", val: callback, color: "#d97706", bg: "#fffbeb" },
    { label: "Interested", val: interested, color: "#059669", bg: "#f0fdf4" },
    { label: "Closed Won", val: closedWon, color: "#059669", bg: "#dcfce7" },
  ];

  // Stage velocity: avg days in each status
  const statusKeys = ["not_answered", "hangup", "contacted", "callback", "interested", "closed_won", "closed_lost"];
  const velocityRows = statusKeys.map(s => {
    const cs = contacts.filter(c => c.status === s && c.lastTouched);
    const avg = cs.length > 0
      ? Math.round(cs.reduce((sum, c) => sum + Math.floor((Date.now() - new Date(c.lastTouched! + "T00:00:00").getTime()) / 86400000), 0) / cs.length)
      : null;
    const sm = (CONTACT_STATUS_META as any)[s] || { label: s, color: "#888", bg: "#f3f4f6" };
    return { status: s, label: sm.label, color: sm.color, bg: sm.bg, count: cs.length, avg };
  }).filter(r => r.count > 0);

  return (
    <div>
      {/* Win rate banner */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "#dcfce7", border: "1.5px solid #059669" + "33", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Win Rate</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>{winRate}%</div>
          <div style={{ fontSize: 11, color: "#888" }}>{closedWon} won · {closedLost} lost</div>
        </div>
        <div style={{ flex: 1, background: "#fff1f2", border: "1.5px solid #ef444433", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Not Reached</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>{notAnswered}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{pct(notAnswered, total)}% of total</div>
        </div>
      </div>

      {/* Funnel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {funnelSteps.map((s, i) => (
          <div key={s.label} style={{ background: "#fff", border: `1.5px solid ${s.color}22`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: s.color }}>{i + 1}</div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#111" }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{pct(s.val, total)}% of total</div>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct(s.val, total)}%`, background: s.color, borderRadius: 99, transition: "width .4s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Stage velocity */}
      {velocityRows.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Stage Velocity</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Avg days contacts have been in each status (lower is better for active stages)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {velocityRows.map(r => (
              <div key={r.status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.color, background: r.bg, padding: "2px 8px", borderRadius: 20, minWidth: 90, textAlign: "center" }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111", minWidth: 30 }}>{r.avg ?? "—"}d</span>
                <span style={{ fontSize: 11, color: "#aaa" }}>{r.count} contacts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

function CampaignsTab({ contacts }: { contacts: Contact[] }) {
  const campaignNames = Array.from(new Set(contacts.map(c => c.campaign || "").filter(Boolean))).sort();
  const rows = campaignNames.map(camp => {
    const cs = contacts.filter(c => c.campaign === camp);
    const total = cs.length;
    const contacted = cs.filter(c => c.status === "contacted").length;
    const callback = cs.filter(c => c.status === "callback").length;
    const interested = cs.filter(c => c.status === "interested").length;
    const closedWon = cs.filter(c => c.status === "closed_won").length;
    const closedLost = cs.filter(c => c.status === "closed_lost").length;
    const convPct = pct(interested + closedWon, total);
    const rejPct = pct(cs.filter(c => c.rejectionReason).length, total);
    return { name: camp, total, contacted, callback, interested, closedWon, closedLost, convPct, rejPct };
  }).sort((a, b) => b.closedWon - a.closedWon || b.interested - a.interested);

  if (rows.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No campaigns found on contacts yet.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
      {rows.map(r => (
        <div key={r.name} style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, flex: 1 }}>{r.name}</div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0, flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#059669", background: "#f0fdf4", padding: "2px 7px", borderRadius: 20 }}>{r.convPct}% conv</span>
              {r.rejPct > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", background: "#fff1f2", padding: "2px 7px", borderRadius: 20 }}>{r.rejPct}% rej</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
            {[
              { label: "Contacted", val: r.contacted, color: "#2563eb", bg: "#eff6ff" },
              { label: "Callback", val: r.callback, color: "#d97706", bg: "#fffbeb" },
              { label: "Interested", val: r.interested, color: "#059669", bg: "#f0fdf4" },
            ].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: .4, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <div style={{ flex: 1, background: "#dcfce7", borderRadius: 9, padding: "6px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#059669", textTransform: "uppercase" as const, marginBottom: 2 }}>Won</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{r.closedWon}</div>
            </div>
            <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 9, padding: "6px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, marginBottom: 2 }}>Lost</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{r.closedLost}</div>
            </div>
          </div>
          {r.total > 0 && (
            <div>
              <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", gap: 1 }}>
                <div style={{ flex: r.contacted, background: "#93c5fd", minWidth: r.contacted ? 2 : 0 }} />
                <div style={{ flex: r.callback, background: "#fcd34d", minWidth: r.callback ? 2 : 0 }} />
                <div style={{ flex: r.interested, background: "#6ee7b7", minWidth: r.interested ? 2 : 0 }} />
                <div style={{ flex: r.closedWon, background: "#059669", minWidth: r.closedWon ? 2 : 0 }} />
              </div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{r.total} total contacts</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Rejections ────────────────────────────────────────────────────────────────

const RANGES = [["today", "Today"], ["week", "This Week"], ["month", "Last 30 Days"], ["all", "All Time"]] as const;
const REJ_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

function getDates(range: string): string[] | null {
  if (range === "all") return null;
  const today = todayKey();
  if (range === "today") return [today];
  if (range === "week") {
    const day = new Date(today).getDay();
    const mon = addDays(today, -(day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }
  return Array.from({ length: 30 }, (_, i) => addDays(today, -(29 - i)));
}

function RejectionsTab({ contacts, loggedInMemberName }: { contacts: Contact[]; loggedInMemberName?: string | null }) {
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
  const topReason = counts[0];
  const topNotes = topReason && topReason.count > 0
    ? filtered.filter(c => c.rejectionReason === topReason.key && c.rejectionNote).slice(0, 5)
    : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb", fontSize: 14, border: "1.5px dashed #e5e5e5", borderRadius: 16 }}>No rejection data yet for this filter.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div className="card" style={{ flex: 1, minWidth: 120, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Total Rejections</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{total}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 120, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Top Reason</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: REJ_COLORS[0] }}>{topReason?.label}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{topReason?.count} times · {total > 0 ? Math.round(topReason.count / total * 100) : 0}%</div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {counts.map((r, i) => (
                <div key={r.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: REJ_COLORS[i % REJ_COLORS.length] }}>
                      {r.count} <span style={{ fontWeight: 500, color: "#aaa", fontSize: 11 }}>({total > 0 ? Math.round(r.count / total * 100) : 0}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 10, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${Math.round(r.count / maxCount * 100)}%`, background: REJ_COLORS[i % REJ_COLORS.length], transition: "width .4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

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
