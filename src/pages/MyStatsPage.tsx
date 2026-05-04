import { initials, todayKey, addDays } from "../lib/utils";
import { AVATAR_COLORS, TASK_TYPES } from "../lib/constants";
import { TargetBar } from "../components/TargetBar";
import type { Contact, DbBlob, Member } from "../types";

interface Props {
  db: DbBlob;
  members: Member[];
  contacts: Contact[];
  loggedInMemberId: string | null;
  weekDates: string[];
  callTarget: number;
  intTarget: number;
}

const touchedOn = (c: any, date: string) => c.date === date || c.reContactDate === date;

// Personal performance dashboard for a logged-in agent.
// Shows today / this-week / last-30-days breakdowns + assigned tasks for today.
export function MyStatsPage({ db, members, contacts, loggedInMemberId, weekDates, callTarget, intTarget }: Props) {
  const me = members.find(m => m.id === loggedInMemberId);
  if (!me) {
    return <div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb", fontSize: 14 }}>No member profile linked. Please log in again and select your name.</div>;
  }

  const last30Days = (() => {
    const d: string[] = [];
    const t = todayKey();
    for (let i = 29; i >= 0; i--) d.push(addDays(t, -i));
    return d;
  })();

  const ranges: { [k: string]: string[] } = {
    today: [todayKey()],
    week: weekDates,
    month: last30Days,
  };

  // Aggregate stats per range
  const rangeStats: any = Object.fromEntries(Object.entries(ranges).map(([range, dates]) => {
    let total = 0, answered = 0, notAnswered = 0, interested = 0;
    let sent = 0, replied = 0, closed = 0;
    let generalDone = 0, generalTotal = 0;
    dates.forEach((date: string) => {
      ((db.days?.[date]?.tasks || []) as any[]).forEach((task: any) => {
        const assigned = ((task.assignedMembers || []) as any[]).some((m: any) => m.id === me.id);
        if (!assigned) return;
        if (task.type === "telesales") {
          if (task.linkedCampaign) {
            const mine = contacts.filter((c: any) => c.campaign === task.linkedCampaign && c.salesAgent === me.name && touchedOn(c, date));
            total       += mine.length;
            answered    += mine.filter((c: any) => ["contacted", "callback", "interested"].includes(c.status)).length;
            notAnswered += mine.filter((c: any) => ["not_answered", "hangup"].includes(c.status)).length;
            interested  += mine.filter((c: any) => c.status === "interested").length;
          } else {
            const s = task.memberStats?.[me.id] || {};
            total       += s.total       || 0;
            answered    += s.answered    || 0;
            notAnswered += s.notAnswered || 0;
            interested  += s.interested  || 0;
          }
        }
        if (task.type === "whatsapp") {
          ((task.campaigns || []) as any[]).forEach((c: any) => {
            sent    += c.sent    || 0;
            replied += c.replied || 0;
            closed  += c.closed  || 0;
          });
        }
        if (task.type === "general") {
          generalTotal++;
          if (task.memberDone?.[me.id]) generalDone++;
        }
      });
    });
    return [range, {
      total, answered, notAnswered, interested,
      sent, replied, closed,
      generalDone, generalTotal,
      aRate: total > 0 ? Math.round(answered / total * 100) : 0,
      replyRate: sent > 0 ? Math.round(replied / sent * 100) : 0,
    }];
  }));

  const todayTasks = ((db.days?.[todayKey()]?.tasks || []) as any[])
    .filter((t: any) => ((t.assignedMembers || []) as any[]).some((m: any) => m.id === me.id));

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: AVATAR_COLORS[me.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>{initials(me.name)}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>{me.name}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Your personal performance dashboard</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {[["today", "Today"], ["week", "This Week"], ["month", "Last 30 Days"]].map(([range, label]) => {
          const s: any = rangeStats[range];
          const dayMultiplier = range === "today" ? 1 : range === "week" ? 7 : 30;
          return (
            <div key={range} className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .6, marginBottom: 14 }}>{label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Total Calls", val: s.total,      color: "#2563eb", bg: "#eff6ff" },
                  { label: "Answered",    val: s.answered,   color: "#16a34a", bg: "#f0fdf4" },
                  { label: "Interested",  val: s.interested, color: "#d97706", bg: "#fffbeb" },
                  { label: "WA Sent",     val: s.sent,       color: "#059669", bg: "#ecfdf5" },
                ].map(({ label: l, val, color, bg }) => (
                  <div key={l} style={{ background: bg, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4, textTransform: "uppercase", letterSpacing: .4 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>{val}</div>
                  </div>
                ))}
              </div>
              {callTarget > 0 && <TargetBar label="Calls vs Target" value={s.total} target={callTarget * dayMultiplier} />}
              {intTarget > 0  && <TargetBar label="Interested vs Target" value={s.interested} target={intTarget * dayMultiplier} />}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span className="stat-badge" style={{ background: "#f0f0f0", color: "#555" }}>{s.aRate}% ans. rate</span>
                {s.sent > 0 && <span className="stat-badge" style={{ background: "#f0f0f0", color: "#555" }}>{s.replyRate}% reply rate</span>}
                {s.generalTotal > 0 && <span className="stat-badge" style={{ background: "#f0f0f0", color: "#555" }}>{s.generalDone}/{s.generalTotal} tasks done</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Today's Tasks</div>
      {todayTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", border: "1.5px dashed #e5e5e5", borderRadius: 14, color: "#bbb", fontSize: 13 }}>No tasks assigned today</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {todayTasks.map((task: any) => {
            const tt = TASK_TYPES[task.type as keyof typeof TASK_TYPES];
            let detail = "";
            if (task.type === "telesales") {
              const s = task.memberStats?.[me.id] || { total: 0, answered: 0, interested: 0 };
              detail = `${s.total} calls · ${s.answered} answered · ${s.interested} interested`;
            } else if (task.type === "whatsapp") {
              const sent = (task.campaigns || []).reduce((a: number, c: any) => a + c.sent, 0);
              detail = `${task.campaigns?.length || 0} campaigns · ${sent} sent`;
            } else {
              detail = task.memberDone?.[me.id] ? "Completed" : "Pending";
            }
            return (
              <div key={task.id} style={{ border: "1.5px solid #ebebeb", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: tt.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{detail}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: tt.color, background: tt.bg, padding: "2px 8px", borderRadius: 20 }}>{tt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
