import { initials, todayKey, weekStart, addDays, scoreContact } from "../lib/utils";
import { AVATAR_COLORS, CONTACT_STATUS_META } from "../lib/constants";
import type { Contact, Member } from "../types";

interface Props {
  contacts: Contact[];
  members: Member[];
  statsTab: "agents" | "campaigns" | "funnel" | "log" | "activity";
  setStatsTab: (t: "agents" | "campaigns" | "funnel" | "log" | "activity") => void;
  onReassignStale: (agentName: string) => void;
}

const pct = (n: number, t: number) => t > 0 ? Math.round(n / t * 100) : 0;

// Manager-only stats dashboard. 5 tabs: Agents, Campaigns, Funnel, Call Log, Activity.
export function StatsPage({ contacts, members, statsTab, setStatsTab, onReassignStale }: Props) {
  const today = todayKey();
  const agentNames = Array.from(new Set(contacts.map(c => c.salesAgent || "").filter(Boolean))).sort();
  const unassignedCount = contacts.filter(c => !c.salesAgent).length;

  const agentRows = agentNames.map(name => {
    const cs = contacts.filter(c => c.salesAgent === name);
    const total = cs.length;
    const contacted = cs.filter(c => c.status === "contacted").length;
    const callback = cs.filter(c => c.status === "callback").length;
    const interested = cs.filter(c => c.status === "interested").length;
    const hot = cs.filter(c => c.leadStatus === "hot").length;
    const stale = cs.filter(c => {
      if (!c.lastTouched) return true;
      const d = Math.floor((Date.now() - new Date(c.lastTouched + "T00:00:00").getTime()) / 86400000);
      return d > 7;
    }).length;
    const callbackDueToday = cs.filter(c => c.callbackDate === today).length;
    const avgScore = cs.length > 0 ? Math.round(cs.reduce((s, c) => s + scoreContact(c), 0) / cs.length) : 0;
    return { name, total, contacted, callback, interested, hot, stale, callbackDueToday, avgScore };
  });

  const campaignNames = Array.from(new Set(contacts.map(c => c.campaign || "").filter(Boolean))).sort();
  const campaignRows = campaignNames.map(camp => {
    const cs = contacts.filter(c => c.campaign === camp);
    const total = cs.length;
    const contacted = cs.filter(c => c.status === "contacted").length;
    const callback = cs.filter(c => c.status === "callback").length;
    const interested = cs.filter(c => c.status === "interested").length;
    const convPct = total > 0 ? Math.round(interested / total * 100) : 0;
    return { name: camp, total, contacted, callback, interested, convPct };
  }).sort((a, b) => b.interested - a.interested);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Stats</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{agentNames.length} agents · {contacts.length} total contacts{unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}</div>
      </div>

      <div className="stats-tab-bar">
        <button className={`stats-tab${statsTab === "agents" ? " active" : ""}`} onClick={() => setStatsTab("agents")}>Agents</button>
        <button className={`stats-tab${statsTab === "campaigns" ? " active" : ""}`} onClick={() => setStatsTab("campaigns")}>Campaigns</button>
        <button className={`stats-tab${statsTab === "funnel" ? " active" : ""}`} onClick={() => setStatsTab("funnel")}>Funnel</button>
        <button className={`stats-tab${statsTab === "log" ? " active" : ""}`} onClick={() => setStatsTab("log")}>Call Log</button>
        <button className={`stats-tab${statsTab === "activity" ? " active" : ""}`} onClick={() => setStatsTab("activity")}>Activity</button>
      </div>

      {statsTab === "agents" && <AgentsTab agentRows={agentRows} onReassignStale={onReassignStale} />}
      {statsTab === "campaigns" && <CampaignsTab campaignRows={campaignRows} />}
      {statsTab === "funnel" && <FunnelTab contacts={contacts} />}
      {statsTab === "log" && <LogTab contacts={contacts} />}
      {statsTab === "activity" && <ActivityTab contacts={contacts} members={members} today={today} />}
    </div>
  );
}

// ----- Tab components ---------------------------------------------------------

function AgentsTab({ agentRows, onReassignStale }: { agentRows: any[]; onReassignStale: (name: string) => void }) {
  if (agentRows.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No contacts assigned to agents yet.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {agentRows.map(r => (
        <div key={r.name} style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials(r.name)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{r.total} contact{r.total !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {r.hot > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fff1f2", padding: "2px 8px", borderRadius: 20 }}>{r.hot} hot</span>}
              {r.callbackDueToday > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 8px", borderRadius: 20 }}>{r.callbackDueToday} callback today</span>}
              {r.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>{r.stale} stale (&gt;7d)</span>}
              {r.stale > 0 && <button onClick={() => onReassignStale(r.name)} style={{ fontSize: 11, fontWeight: 700, color: "#1a56db", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Reassign stale →</button>}
              <span style={{ fontSize: 11, fontWeight: 700, color: r.avgScore >= 70 ? "#059669" : r.avgScore >= 40 ? "#d97706" : "#9ca3af", background: r.avgScore >= 70 ? "#f0fdf4" : r.avgScore >= 40 ? "#fffbeb" : "#f9f9f9", padding: "2px 8px", borderRadius: 20 }}>avg score {r.avgScore}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[
              { label: "Contacted", val: r.contacted, color: "#2563eb", bg: "#eff6ff" },
              { label: "Callback", val: r.callback, color: "#d97706", bg: "#fffbeb" },
              { label: "Interested", val: r.interested, color: "#059669", bg: "#f0fdf4" },
            ].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" as const, letterSpacing: .4, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>{val}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{pct(val, r.total)}%</div>
              </div>
            ))}
          </div>
          {r.total > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Pipeline progress</div>
              <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 1 }}>
                <div style={{ flex: r.contacted, background: "#93c5fd", minWidth: r.contacted ? 2 : 0 }} />
                <div style={{ flex: r.callback, background: "#fcd34d", minWidth: r.callback ? 2 : 0 }} />
                <div style={{ flex: r.interested, background: "#6ee7b7", minWidth: r.interested ? 2 : 0 }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "#aaa" }}>
                <span style={{ color: "#2563eb" }}>■ Contacted</span>
                <span style={{ color: "#d97706" }}>■ Callback</span>
                <span style={{ color: "#059669" }}>■ Interested</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignsTab({ campaignRows }: { campaignRows: any[] }) {
  if (campaignRows.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No campaigns found on contacts yet.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
      {campaignRows.map(r => (
        <div key={r.name} style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, flex: 1 }}>{r.name}</div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#059669", background: "#f0fdf4", padding: "3px 9px", borderRadius: 20, flexShrink: 0 }}>{r.convPct}% conv.</span>
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
          {r.total > 0 && (
            <div>
              <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", gap: 1 }}>
                <div style={{ flex: r.contacted, background: "#93c5fd", minWidth: r.contacted ? 2 : 0 }} />
                <div style={{ flex: r.callback, background: "#fcd34d", minWidth: r.callback ? 2 : 0 }} />
                <div style={{ flex: r.interested, background: "#6ee7b7", minWidth: r.interested ? 2 : 0 }} />
              </div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{r.total} total contacts</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FunnelTab({ contacts }: { contacts: Contact[] }) {
  const total = contacts.length;
  const answered = contacts.filter(c => ["contacted", "callback", "interested"].includes(c.status)).length;
  const callback = contacts.filter(c => ["callback", "interested"].includes(c.status)).length;
  const interested = contacts.filter(c => c.status === "interested").length;
  const notAnswered = contacts.filter(c => ["not_answered", "hangup"].includes(c.status)).length;
  const hangup = contacts.filter(c => c.status === "hangup").length;

  const funnelSteps = [
    { label: "Total Contacts", val: total, color: "#6366f1", bg: "#eef2ff", pct: 100 },
    { label: "Answered", val: answered, color: "#2563eb", bg: "#eff6ff", pct: pct(answered, total) },
    { label: "Callback / Follow-up", val: callback, color: "#d97706", bg: "#fffbeb", pct: pct(callback, total) },
    { label: "Interested", val: interested, color: "#059669", bg: "#f0fdf4", pct: pct(interested, total) },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {funnelSteps.map((s, i) => (
          <div key={s.label} style={{ background: "#fff", border: `1.5px solid ${s.color}22`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: s.color }}>{i + 1}</div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#111" }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{s.pct}% of total</div>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 99, transition: "width .4s" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Not Reached</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#f3f4f6", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>NOT ANSWERED</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>{notAnswered}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{pct(notAnswered, total)}% of total</div>
          </div>
          <div style={{ background: "#fff1f2", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>HUNG UP</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>{hangup}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{pct(hangup, total)}% of total</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogTab({ contacts }: { contacts: Contact[] }) {
  const today = todayKey();
  const logEntries: any[] = [];
  contacts.forEach(c => {
    (c.history || []).forEach(h => logEntries.push({ ...h, contactName: c.name, contactId: c.id, salesAgent: c.salesAgent || "" }));
  });
  logEntries.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  const todayEntries = logEntries.filter(e => (e.timestamp || "").startsWith(today));
  const olderEntries = logEntries.filter(e => !(e.timestamp || "").startsWith(today));

  if (logEntries.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No status changes recorded yet. Status changes are logged automatically.</div>;
  }

  const renderEntry = (e: any, idx: number) => {
    const stm = (CONTACT_STATUS_META as any)[e.to as string] || { label: e.to, color: "#888", bg: "#f3f4f6" };
    const fromStm = e.from ? (CONTACT_STATUS_META as any)[e.from as string] || { label: e.from, color: "#aaa", bg: "#f9f9f9" } : null;
    const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: stm.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{e.contactName || "Unknown"}</div>
          <div style={{ fontSize: 12, color: "#888", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {fromStm && <><span style={{ color: fromStm.color, fontWeight: 600, background: fromStm.bg, padding: "1px 6px", borderRadius: 6, fontSize: 11 }}>{fromStm.label}</span><span>→</span></>}
            <span style={{ color: stm.color, fontWeight: 600, background: stm.bg, padding: "1px 6px", borderRadius: 6, fontSize: 11 }}>{stm.label}</span>
            {e.by && <span style={{ color: "#aaa" }}>by {e.by}</span>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#bbb", flexShrink: 0, paddingTop: 2 }}>{time}</div>
      </div>
    );
  };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Status Change Log</div>
        <span style={{ fontSize: 12, color: "#888" }}>{logEntries.length} total · {todayEntries.length} today</span>
      </div>
      {todayEntries.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1a56db", marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>Today</div>
          {todayEntries.slice(0, 50).map(renderEntry)}
        </>
      )}
      {olderEntries.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: .5 }}>Earlier</div>
          {olderEntries.slice(0, 100).map(renderEntry)}
        </>
      )}
    </div>
  );
}

function ActivityTab({ contacts, members, today }: { contacts: Contact[]; members: Member[]; today: string }) {
  if (members.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16, color: "#bbb", fontSize: 13 }}>No members added yet.</div>;
  }

  const weekStartDate = weekStart(today);
  const activityRows = members.map(m => {
    const entries = contacts.flatMap(c => (c.history || []).filter(h => h.by === m.name));
    const todayEntries = entries.filter(h => (h.timestamp || "").startsWith(today));
    const weekEntries = entries.filter(h => (h.timestamp || "").slice(0, 10) >= weekStartDate);
    const days7 = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));
    const sparkline = days7.map(d => entries.filter(h => (h.timestamp || "").startsWith(d)).length);
    return {
      name: m.name,
      colorIdx: m.colorIdx,
      todayCalls: todayEntries.length,
      weekCalls: weekEntries.length,
      todayInterested: todayEntries.filter(h => h.type === "status" && h.to === "interested").length,
      weekInterested: weekEntries.filter(h => h.type === "status" && h.to === "interested").length,
      avgPerDay: Math.round(weekEntries.length / 7),
      sparkline,
    };
  }).sort((a, b) => b.weekCalls - a.weekCalls);

  const maxBar = Math.max(1, ...activityRows.flatMap(r => r.sparkline));

  return (
    <div>
      <div style={{ background: "#fff", border: "1.5px solid #ebebeb", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 90px 90px 70px", gap: 0, background: "#1a56db", padding: "10px 16px" }}>
          {["Agent", "Today", "This Week", "Int. Today", "Int. Week", "Avg/Day"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase" as const, letterSpacing: .4 }}>{h}</div>
          ))}
        </div>
        {activityRows.map(r => (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 90px 90px 70px", gap: 0, padding: "12px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: AVATAR_COLORS[r.colorIdx]?.[0] || "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials(r.name)}</div>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 32 }}>
                {r.sparkline.map((v, i) => (
                  <div key={i} title={`${addDays(today, -(6 - i))}: ${v}`} style={{ flex: 1, background: v > 0 ? "#1a56db" : "#e8efff", borderRadius: "3px 3px 0 0", height: `${Math.max(2, Math.round(v / maxBar * 32))}px`, transition: "height .2s" }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: r.todayCalls > 0 ? "#1a56db" : "#bbb", textAlign: "center" as const }}>{r.todayCalls}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: r.weekCalls > 0 ? "#111" : "#bbb", textAlign: "center" as const }}>{r.weekCalls}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: r.todayInterested > 0 ? "#059669" : "#bbb", textAlign: "center" as const }}>{r.todayInterested}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: r.weekInterested > 0 ? "#059669" : "#bbb", textAlign: "center" as const }}>{r.weekInterested}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#888", textAlign: "center" as const }}>{r.avgPerDay}</div>
          </div>
        ))}
      </div>
      {activityRows.every(r => r.weekCalls === 0) && (
        <div style={{ textAlign: "center", padding: "20px", fontSize: 13, color: "#bbb", marginTop: 12 }}>No status changes recorded yet — activity populates as agents update contacts.</div>
      )}
    </div>
  );
}
