import { initials, todayKey, fmt } from "../lib/utils";
import { AVATAR_COLORS, DAYS } from "../lib/constants";
import type { DbBlob, Member } from "../types";

interface Props {
  db: DbBlob;
  members: Member[];
  weekDates: string[];
  weekOffset: number;
  setWeekOffset: (fn: (o: number) => number | number) => void;
  weeklyTab: string;
  setWeeklyTab: (t: string) => void;
  callTarget: number;
  onSelectDate: (date: string) => void;
}

// Compute per-member weekly WhatsApp campaign stats from db.days
function buildMemberCampaignWeek(db: DbBlob, weekDates: string[], memberId: string) {
  return weekDates.map(date => {
    let sent = 0, replied = 0, closed = 0, unresponsive = 0;
    ((db.days?.[date]?.tasks || []) as any[])
      .filter((t: any) => t.type === "whatsapp" && ((t.assignedMembers || []) as any[]).some((m: any) => m.id === memberId))
      .forEach((task: any) => {
        ((task.campaigns || []) as any[]).forEach((c: any) => {
          sent += c.sent || 0;
          replied += c.replied || 0;
          closed += c.closed || 0;
          unresponsive += c.unresponsive || 0;
        });
      });
    return { sent, replied, closed, unresponsive };
  });
}

// Weekly summary: 7-day strip + per-member breakdown for telesales calls and WhatsApp campaigns.
export function WeeklyPage({ db, members, weekDates, setWeekOffset, weeklyTab, setWeeklyTab, callTarget, onSelectDate }: Props) {
  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Weekly Summary</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{fmt(weekDates[0])} — {fmt(weekDates[6])}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ghost-btn" onClick={() => setWeekOffset((o: number) => o - 1)}>← Prev</button>
          <button className="ghost-btn" onClick={() => setWeekOffset(() => 0)}>This Week</button>
          <button className="ghost-btn" onClick={() => setWeekOffset((o: number) => o + 1)}>Next →</button>
        </div>
      </div>

      {/* Day strip — click to jump to that day */}
      <div className="weekly-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 24 }}>
        {weekDates.map((date, di) => {
          const tasks: any[] = db.days?.[date]?.tasks || [];
          const totalCalls = tasks.filter((t: any) => t.type === "telesales").reduce((s: number, t: any) => s + Object.values(t.memberStats || {}).reduce((a: number, m: any) => a + (m as any).total, 0), 0);
          const totalSent = (tasks as any[]).filter((t: any) => t.type === "whatsapp").reduce((s: number, t: any) => s + ((t.campaigns || []) as any[]).reduce((a: number, c: any) => a + c.sent, 0), 0);
          const isToday = date === todayKey();
          const saved = db.days?.[date]?.saved;
          return (
            <div
              key={date}
              onClick={() => onSelectDate(date)}
              style={{ border: `1.5px solid ${isToday ? "#1a56db" : "#ebebeb"}`, borderRadius: 14, padding: "12px 10px", cursor: "pointer", background: isToday ? "#1a56db" : "#fff", color: isToday ? "#fff" : "#111", transition: "all .12s" }}
              onMouseEnter={e => { if (!isToday) { e.currentTarget.style.borderColor = "#1a56db"; e.currentTarget.style.background = "#eff6ff"; } }}
              onMouseLeave={e => { if (!isToday) { e.currentTarget.style.borderColor = "#ebebeb"; e.currentTarget.style.background = "#fff"; } }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? "rgba(255,255,255,.7)" : "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 }}>{DAYS[di].slice(0, 3)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{fmt(date).split(" ")[0]}</div>
              {tasks.length > 0 ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{totalCalls}</div>
                  <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,.7)" : "#888", marginBottom: 3 }}>calls</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{totalSent}</div>
                  <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,.7)" : "#888", marginBottom: 4 }}>sent</div>
                  {saved && <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? "#dbeafe" : "#65a30d" }}>Saved</div>}
                </>
              ) : <div style={{ fontSize: 11, color: isToday ? "rgba(255,255,255,.5)" : "#ccc" }}>No data</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`weekly-tab ${weeklyTab === "telesales" ? "active" : ""}`} onClick={() => setWeeklyTab("telesales")}>Telesales Calling</button>
        <button className={`weekly-tab ${weeklyTab === "campaign" ? "active" : ""}`} onClick={() => setWeeklyTab("campaign")}>Campaign Follow Up</button>
      </div>

      {/* Telesales weekly breakdown */}
      {weeklyTab === "telesales" && members.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>Telesales Calling — Member Breakdown</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ebebeb" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>Member</th>
                  {weekDates.map((date, di) => (
                    <th key={date} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontSize: 11, color: date === todayKey() ? "#111" : "#888", textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>{DAYS[di].slice(0, 3)}</th>
                  ))}
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5 }}>Total</th>
                  {callTarget > 0 && <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5 }}>vs Target</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member: any) => {
                  let weekTotal = 0;
                  const dayCounts = weekDates.map(date => {
                    const t = ((db.days?.[date]?.tasks || []) as any[])
                      .filter((t: any) => t.type === "telesales" && ((t.assignedMembers || []) as any[]).some((m: any) => m.id === member.id))
                      .reduce((s: number, t: any) => s + (t.memberStats?.[member.id]?.total || 0), 0);
                    weekTotal += t;
                    return t;
                  });
                  const weekTarget = callTarget * 7;
                  const hitPct = weekTarget > 0 ? Math.round(weekTotal / weekTarget * 100) : null;
                  return (
                    <tr key={member.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: AVATAR_COLORS[member.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(member.name)}</div>
                          {member.name}
                        </div>
                      </td>
                      {dayCounts.map((cnt, di) => (
                        <td key={di} style={{ padding: "10px 8px", textAlign: "center", background: weekDates[di] === todayKey() ? "#fafafa" : "transparent" }}>
                          {cnt > 0
                            ? <div style={{ fontWeight: 700, fontSize: 14, color: callTarget > 0 && cnt >= callTarget ? "#16a34a" : callTarget > 0 ? "#ef4444" : "#111" }}>{cnt}</div>
                            : <span style={{ color: "#ddd" }}>—</span>}
                        </td>
                      ))}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: 15 }}>{weekTotal || "—"}</td>
                      {callTarget > 0 && (
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {hitPct !== null
                            ? <span style={{ fontSize: 12, fontWeight: 700, color: hitPct >= 100 ? "#16a34a" : hitPct >= 70 ? "#d97706" : "#ef4444", background: hitPct >= 100 ? "#f0fdf4" : hitPct >= 70 ? "#fffbeb" : "#fff1f2", padding: "2px 8px", borderRadius: 20 }}>{hitPct}%</span>
                            : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WhatsApp campaign weekly breakdown */}
      {weeklyTab === "campaign" && members.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>Campaign Follow Up — Member Breakdown</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ebebeb" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>Member</th>
                  {weekDates.map((date, di) => (
                    <th key={date} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontSize: 11, color: date === todayKey() ? "#111" : "#888", textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>{DAYS[di].slice(0, 3)}</th>
                  ))}
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5 }}>Total Sent</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: .5 }}>Reply Rate</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: any) => {
                  const dayData = buildMemberCampaignWeek(db, weekDates, member.id);
                  const weekSent = dayData.reduce((s: number, d: any) => s + d.sent, 0);
                  const weekReplied = dayData.reduce((s: number, d: any) => s + d.replied, 0);
                  const weekReplyRate = weekSent > 0 ? Math.round(weekReplied / weekSent * 100) : 0;
                  return (
                    <tr key={member.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: AVATAR_COLORS[member.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>{initials(member.name)}</div>
                          {member.name}
                        </div>
                      </td>
                      {dayData.map((d, di) => (
                        <td key={di} style={{ padding: "8px", textAlign: "center", background: weekDates[di] === todayKey() ? "#fafafa" : "transparent" }}>
                          {d.sent > 0 ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{d.sent}</div>
                              <div style={{ fontSize: 10, color: "#16a34a" }}>{d.replied}</div>
                              <div style={{ fontSize: 10, color: "#059669" }}>{d.closed}</div>
                            </div>
                          ) : <span style={{ color: "#ddd" }}>—</span>}
                        </td>
                      ))}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: 15 }}>{weekSent || "—"}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {weekSent > 0
                          ? <span style={{ fontSize: 12, fontWeight: 700, color: weekReplyRate >= 50 ? "#16a34a" : weekReplyRate >= 30 ? "#d97706" : "#ef4444", background: weekReplyRate >= 50 ? "#f0fdf4" : weekReplyRate >= 30 ? "#fffbeb" : "#fff1f2", padding: "2px 8px", borderRadius: 20 }}>{weekReplyRate}%</span>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {members.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontSize: 14 }}>Add telesales members first to see the breakdown</div>}
    </div>
  );
}
