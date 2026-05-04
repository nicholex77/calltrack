import { touchedOn, fmt, dayName, addDays, todayKey } from "./utils";

// Context object passed to all export builders.
export type ExportContext = {
  db: any;
  contacts: any[];
  callTarget: number;
  intTarget: number;
  weekDates: string[];
  members: any[];
  isManager: boolean;
  loggedInMemberId: string | null;
};

// ── Date range helpers ───────────────────────────────────────────────────────

export const getExportDates = (range: string, weekDates: string[]): string[] => {
  if (range === "today") return [todayKey()];
  if (range === "week")  return weekDates;
  // "month" = last 30 days
  const dates: string[] = [];
  const today = todayKey();
  for (let i = 29; i >= 0; i--) dates.push(addDays(today, -i));
  return dates;
};

// ── Row builders — one function per task type ────────────────────────────────

export const buildTelesalesRows = (
  dates: string[],
  ctx: Pick<ExportContext, "db" | "contacts" | "callTarget" | "intTarget">
): any[] => {
  const { db, contacts, callTarget, intTarget } = ctx;
  const rows: any[] = [];

  dates.forEach(date => {
    ((db.days?.[date]?.tasks || []) as any[])
      .filter(t => t.type === "telesales")
      .forEach(task => {
        ((task.assignedMembers || []) as any[]).forEach(m => {
          let s: { total: number; answered: number; notAnswered: number; interested: number };

          if (task.linkedCampaign) {
            const mine = contacts.filter(c =>
              c.campaign === task.linkedCampaign && c.salesAgent === m.name && touchedOn(c, date)
            );
            s = {
              total:       mine.length,
              answered:    mine.filter(c => ["contacted", "callback", "interested"].includes(c.status)).length,
              notAnswered: mine.filter(c => ["not_answered", "hangup"].includes(c.status)).length,
              interested:  mine.filter(c => c.status === "interested").length,
            };
          } else {
            s = task.memberStats?.[m.id] || { total: 0, answered: 0, notAnswered: 0, interested: 0 };
          }

          const aRate = s.total > 0    ? Math.round(s.answered   / s.total    * 100) : 0;
          const cRate = s.answered > 0 ? Math.round(s.interested / s.answered * 100) : 0;

          rows.push({
            Date: fmt(date), Day: dayName(date),
            Member: m.name, Task: task.title,
            "Call Target": callTarget || "—",
            Total: s.total, Answered: s.answered,
            "Not Answered": s.notAnswered, Interested: s.interested,
            "Int. Target": intTarget || "—",
            "Answer Rate (%)": aRate, "Conv. Rate (%)": cRate,
            "Target Hit?": callTarget > 0 ? (s.total >= callTarget ? "Yes" : "No") : "—",
            Remarks: task.remarks || "",
          });
        });
      });
  });

  return rows;
};

export const buildWhatsappRows = (dates: string[], db: any): any[] => {
  const rows: any[] = [];

  dates.forEach(date => {
    ((db.days?.[date]?.tasks || []) as any[])
      .filter(t => t.type === "whatsapp")
      .forEach(task => {
        const memberNames = ((task.assignedMembers || []) as any[]).map(m => m.name).join(", ");
        const campaigns: any[] = task.campaigns || [];

        if (campaigns.length === 0) {
          rows.push({ Date: fmt(date), Day: dayName(date), Members: memberNames, Task: task.title, Campaign: "—", Sent: 0, Replied: 0, Closed: 0, "No Reply": 0, "Reply Rate (%)": 0, "Close Rate (%)": 0, Remarks: task.notes || "" });
        } else {
          campaigns.forEach(c => {
            const replyRate = c.sent > 0    ? Math.round(c.replied / c.sent    * 100) : 0;
            const closeRate = c.replied > 0 ? Math.round(c.closed  / c.replied * 100) : 0;
            rows.push({ Date: fmt(date), Day: dayName(date), Members: memberNames, Task: task.title, Campaign: c.name, Sent: c.sent, Replied: c.replied, Closed: c.closed, "No Reply": c.unresponsive, "Reply Rate (%)": replyRate, "Close Rate (%)": closeRate, Remarks: c.remarks || "" });
          });
        }
      });
  });

  return rows;
};

export const buildGeneralRows = (dates: string[], db: any): any[] => {
  const rows: any[] = [];

  dates.forEach(date => {
    ((db.days?.[date]?.tasks || []) as any[])
      .filter(t => t.type === "general")
      .forEach(task => {
        ((task.assignedMembers || []) as any[]).forEach(m => {
          rows.push({
            Date: fmt(date), Day: dayName(date),
            Member: m.name, Task: task.title,
            Status: task.memberDone?.[m.id] ? "Done" : "Pending",
            Notes: task.notes || "",
          });
        });
      });
  });

  return rows;
};

export const buildTelesalesSummaryStats = (rows: any[]) => {
  const totalCalls      = rows.reduce((s, r) => s + (r.Total          || 0), 0);
  const totalAnswered   = rows.reduce((s, r) => s + (r.Answered       || 0), 0);
  const totalNotAns     = rows.reduce((s, r) => s + (r["Not Answered"] || 0), 0);
  const totalInterested = rows.reduce((s, r) => s + (r.Interested     || 0), 0);
  const answerRate      = totalCalls    > 0 ? Math.round(totalAnswered   / totalCalls    * 100) : 0;
  const convRate        = totalAnswered > 0 ? Math.round(totalInterested / totalAnswered * 100) : 0;
  return { totalCalls, totalAnswered, totalNotAns, totalInterested, answerRate, convRate };
};

// ── Preview rows (used by CSV export and the export page table preview) ──────

export const getPreviewRows = (exportTab: string, exportRange: string, ctx: ExportContext): any[] => {
  const dates = getExportDates(exportRange, ctx.weekDates);
  let rows: any[];

  if (exportTab === "telesales")     rows = buildTelesalesRows(dates, ctx);
  else if (exportTab === "whatsapp") rows = buildWhatsappRows(dates, ctx.db);
  else                               rows = buildGeneralRows(dates, ctx.db);

  // Members only see their own rows
  if (!ctx.isManager && ctx.loggedInMemberId) {
    const me = ctx.members.find(m => m.id === ctx.loggedInMemberId);
    if (me) rows = rows.filter(r => r.Member === me.name || (r.Members as string | undefined)?.includes(me.name));
  }

  return rows;
};

// ── Performance summary (used on the export page per-member breakdown) ───────

export const buildPerformanceSummary = (ctx: ExportContext) => {
  const { db, contacts, members, callTarget, weekDates } = ctx;
  const ranges: Record<string, string[]> = {
    today: getExportDates("today", weekDates),
    week:  weekDates,
    month: getExportDates("month", weekDates),
  };

  return members.map(member => {
    const stats: any = {};

    Object.entries(ranges).forEach(([range, dates]) => {
      let total = 0, answered = 0, interested = 0, sent = 0, replied = 0, closed = 0;

      dates.forEach(date => {
        ((db.days?.[date]?.tasks || []) as any[]).forEach(task => {
          const isAssigned = ((task.assignedMembers || []) as any[]).some(m => m.id === member.id);
          if (!isAssigned) return;

          if (task.type === "telesales") {
            if (task.linkedCampaign) {
              const mine = contacts.filter(c =>
                c.campaign === task.linkedCampaign && c.salesAgent === member.name && touchedOn(c, date)
              );
              total     += mine.length;
              answered  += mine.filter(c => ["contacted", "callback", "interested"].includes(c.status)).length;
              interested += mine.filter(c => c.status === "interested").length;
            } else {
              const s = task.memberStats?.[member.id] || {};
              total += s.total || 0; answered += s.answered || 0; interested += s.interested || 0;
            }
          }

          if (task.type === "whatsapp") {
            ((task.campaigns || []) as any[]).forEach(c => {
              sent += c.sent || 0; replied += c.replied || 0; closed += c.closed || 0;
            });
          }
        });
      });

      stats[range] = {
        total, answered, interested, sent, replied, closed,
        aRate:     total    > 0 ? Math.round(answered  / total    * 100) : 0,
        replyRate: sent     > 0 ? Math.round(replied   / sent     * 100) : 0,
        closeRate: replied  > 0 ? Math.round(closed    / replied  * 100) : 0,
        targetHit: callTarget > 0 && total >= callTarget * dates.length,
      };
    });

    return { member, stats };
  });
};
