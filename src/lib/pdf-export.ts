import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { touchedOn, fmt, todayKey, weekStart } from "./utils";
import { getExportDates } from "./export-data";

export type PdfConfig = {
  exportTab: string;
  exportRange: string;
  rows: any[];        // pre-built rows (used for WhatsApp/General)
  db: any;
  contacts: any[];
  weekDates: string[];
  callTarget: number;
  intTarget: number;
};

type DayStat = {
  iso: string;
  label: string;
  total: number;
  answered: number;
  notAns: number;
  interested: number;
  remarks: string[];
};

type MemberDayRow = {
  date: string;
  member: string;
  total: number;
  answered: number;
  notAns: number;
  interested: number;
  remarks: string;
};

/**
 * Generates and downloads a PDF report.
 * Throws on error — caller should catch and show a toast.
 */
export const generatePDF = async (config: PdfConfig): Promise<void> => {
  const { exportTab, exportRange, rows, db, contacts, weekDates, callTarget, intTarget } = config;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const PW = 841.89, M = 40, CW = PW - M * 2;

  const tabLabel   = exportTab   === "telesales" ? "Telesales" : exportTab === "whatsapp" ? "WhatsApp" : "General";
  const rangeLabel = exportRange === "today"     ? "Today"     : exportRange === "week"   ? "This Week" : "Last 30 Days";

  const drawPageHeader = (): number => {
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, PW, 52, "F");
    doc.setFont("helvetica", "bold");   doc.setFontSize(15); doc.setTextColor(255, 255, 255);
    doc.text(`blurB — ${tabLabel} Report`, M, 30);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);  doc.setTextColor(160, 160, 160);
    doc.text(`${rangeLabel}  ·  Generated ${fmt(todayKey())}  ·  mudah.my`, M, 44);
    return 62; // Y position after the header
  };

  // ── Telesales: rich weekly card layout ──────────────────────────────────────
  if (exportTab === "telesales") {
    const dates = getExportDates(exportRange, weekDates);

    // Aggregate stats per calendar day
    const dayStats: DayStat[] = dates.map(iso => {
      let total = 0, answered = 0, notAns = 0, interested = 0;
      const remarks: string[] = [];

      ((db.days?.[iso]?.tasks || []) as any[])
        .filter(t => t.type === "telesales")
        .forEach(task => {
          if (task.remarks?.trim()) remarks.push(task.remarks.trim());
          ((task.assignedMembers || []) as any[]).forEach(m => {
            let s: any;
            if (task.linkedCampaign) {
              const mine = contacts.filter(c =>
                c.campaign === task.linkedCampaign && c.salesAgent === m.name && touchedOn(c, iso)
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
            total += s.total || 0; answered += s.answered || 0;
            notAns += s.notAnswered || 0; interested += s.interested || 0;
          });
        });

      return { iso, label: fmt(iso), total, answered, notAns, interested, remarks };
    }).filter(d => d.total > 0 || (db.days?.[d.iso]?.tasks?.length || 0) > 0);

    if (dayStats.length === 0) {
      const y = drawPageHeader();
      doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(160, 160, 160);
      doc.text("No telesales data found for this period.", M, y + 40);
    } else {
      // Group days into ISO weeks
      const weekMap = new Map<string, DayStat[]>();
      dayStats.forEach(d => {
        const ws = weekStart(d.iso);
        const key = `${ws}__${fmt(ws)}`;
        if (!weekMap.has(key)) weekMap.set(key, []);
        weekMap.get(key)!.push(d);
      });

      let y = drawPageHeader();
      let firstSection = true;

      weekMap.forEach((days, key) => {
        const weekLabelStr = `Week of ${key.split("__")[1]}`;
        const wTotal      = days.reduce((s, d) => s + d.total,     0);
        const wAnswered   = days.reduce((s, d) => s + d.answered,  0);
        const wNotAns     = days.reduce((s, d) => s + d.notAns,    0);
        const wInterested = days.reduce((s, d) => s + d.interested, 0);
        const ansRate  = wTotal    > 0 ? Math.round(wAnswered   / wTotal    * 100) : 0;
        const convRate = wAnswered > 0 ? Math.round(wInterested / wAnswered * 100) : 0;
        const dateRange = days.length === 1 ? days[0].label : `${days[0].label} – ${days[days.length - 1].label}`;

        // Page break if needed
        const estimatedH = 46 + 78 + 30 + 30 + days.length * 22 + 24;
        if (!firstSection && y + estimatedH > 560) { doc.addPage(); y = drawPageHeader(); }
        firstSection = false;

        // Week header bar
        doc.setFillColor(22, 22, 36);
        doc.rect(M, y, CW, 46, "F");
        doc.setFont("helvetica", "bold");   doc.setFontSize(13); doc.setTextColor(255, 255, 255);
        doc.text(weekLabelStr, M + 12, y + 17);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);  doc.setTextColor(160, 160, 180);
        doc.text(`${dateRange} · ${days.length} day${days.length !== 1 ? "s" : ""}`, M + 12, y + 32);

        // Target pills (green = hit, red = missed)
        const callHit  = callTarget > 0 && wTotal      >= callTarget * days.length;
        const intHit   = intTarget  > 0 && wInterested >= intTarget  * days.length;
        const callTxt  = `${wTotal}/${callTarget > 0 ? callTarget * days.length : "—"} calls`;
        const intTxt   = `${wInterested}/${intTarget > 0 ? intTarget * days.length : "—"} interested`;
        const cTxtW    = doc.getTextWidth(callTxt);
        const iTxtW    = doc.getTextWidth(intTxt);
        const pillH    = 16, pillPad = 8;
        const pill2X   = M + CW - iTxtW - pillPad * 2 - 4;
        const pill1X   = pill2X - cTxtW - pillPad * 2 - 6;
        const pillY    = y + 15;

        doc.setFillColor(...(callHit ? [5, 150, 105] : [239, 68, 68]) as [number, number, number]);
        doc.rect(pill1X, pillY, cTxtW + pillPad * 2, pillH, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
        doc.text(callTxt, pill1X + pillPad, pillY + 11);

        doc.setFillColor(...(intHit ? [5, 150, 105] : [239, 68, 68]) as [number, number, number]);
        doc.rect(pill2X, pillY, iTxtW + pillPad * 2, pillH, "F");
        doc.text(intTxt, pill2X + pillPad, pillY + 11);
        y += 52;

        // 4 stat boxes
        const bW = CW / 4, bH = 70;
        const boxes = [
          { lbl: "TOTAL CALLS",   val: String(wTotal),              sub: `${days.length} day${days.length !== 1 ? "s" : ""}`, rgb: [26, 86, 219]  as [number, number, number] },
          { lbl: "ANSWERED",      val: `${wAnswered}/${wTotal}`,    sub: `${ansRate}% answer rate`,                             rgb: [30, 30, 30]   as [number, number, number] },
          { lbl: "INTERESTED",    val: `${wInterested}/${wTotal}`,  sub: `${convRate}% conv. rate`,                             rgb: [5, 150, 105]  as [number, number, number] },
          { lbl: "NOT ANSWERED",  val: `${wNotAns}/${wTotal}`,      sub: `${wTotal > 0 ? Math.round(wNotAns / wTotal * 100) : 0}% missed`, rgb: [220, 38, 38] as [number, number, number] },
        ];
        boxes.forEach((b, i) => {
          const bx = M + i * bW;
          doc.setFillColor(248, 249, 250); doc.rect(bx, y, bW, bH, "F");
          doc.setDrawColor(225, 225, 225); doc.rect(bx, y, bW, bH);
          doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(160, 160, 160);
          doc.text(b.lbl, bx + 10, y + 14);
          doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...b.rgb);
          doc.text(b.val, bx + 10, y + 40);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110, 110, 110);
          doc.text(b.sub, bx + 10, y + 56);
        });
        y += bH + 6;

        // Progress bars
        const barH = 7, labelW = 72, pctW = 30;
        ([["Answer rate", ansRate, [16, 185, 129]], ["Conv. rate", convRate, [217, 119, 6]]] as const).forEach(([lbl, pct, rgb]) => {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
          doc.text(lbl, M, y + barH - 1);
          const trackX = M + labelW, trackW = CW - labelW - pctW;
          doc.setFillColor(230, 230, 230); doc.rect(trackX, y, trackW, barH, "F");
          const fillW = Math.max(0, Math.min(1, pct / 100)) * trackW;
          doc.setFillColor(...rgb as [number, number, number]); doc.rect(trackX, y, fillW, barH, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30, 30, 30);
          doc.text(`${pct}%`, M + CW - pctW + 4, y + barH - 1);
          y += barH + 7;
        });
        y += 4;

        // Per-day / per-member detail table
        const memberRows: MemberDayRow[] = [];
        days.forEach(d => {
          ((db.days?.[d.iso]?.tasks || []) as any[])
            .filter(t => t.type === "telesales")
            .forEach(task => {
              ((task.assignedMembers || []) as any[]).forEach(m => {
                let s: any;
                if (task.linkedCampaign) {
                  const mine = contacts.filter(c =>
                    c.campaign === task.linkedCampaign && c.salesAgent === m.name && touchedOn(c, d.iso)
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
                memberRows.push({
                  date: d.label, member: m.name,
                  total: s.total || 0, answered: s.answered || 0,
                  notAns: s.notAnswered || 0, interested: s.interested || 0,
                  remarks: task.remarks?.trim() || "",
                });
              });
            });
        });

        const hasRemarks = memberRows.some(r => r.remarks);
        const head = ["DATE", "MEMBER", "TOTAL", "ANSWERED", "NOT ANS.", "INTERESTED", ...(hasRemarks ? ["REMARKS"] : [])];
        const body = memberRows.map(r => {
          const aR = r.total    > 0 ? Math.round(r.answered   / r.total    * 100) : 0;
          const cR = r.answered > 0 ? Math.round(r.interested / r.answered * 100) : 0;
          const row = [r.date, r.member, String(r.total), `${r.answered}/${r.total} ${aR}%`, String(r.notAns), `${r.interested}/${r.answered} ${cR}%`];
          if (hasRemarks) row.push(r.remarks || "—");
          return row;
        });

        autoTable(doc, {
          head: [head], body, startY: y,
          styles:               { fontSize: 8,  cellPadding: 5, textColor: [30, 30, 30]        },
          headStyles:           { fillColor: [40, 40, 60], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
          alternateRowStyles:   { fillColor: [249, 249, 252] },
          columnStyles:         { 0: { fontStyle: "bold" }, 1: { fontStyle: "bold" }, ...(hasRemarks ? { 6: { cellWidth: 110 } } : {}) },
          margin:               { left: M, right: M },
          tableWidth:           "auto",
        });
        y = (doc as any).lastAutoTable.finalY + 22;
      });
    }

  // ── WhatsApp / General: flat table ──────────────────────────────────────────
  } else {
    const y = drawPageHeader();
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      head:                 [headers],
      body:                 rows.map(r => headers.map(h => String(r[h] ?? ""))),
      startY:               y,
      styles:               { fontSize: 7, cellPadding: 4, textColor: [30, 30, 30] },
      headStyles:           { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles:   { fillColor: [249, 249, 249] },
      margin:               { left: M, right: M },
      tableWidth:           "auto",
    });
  }

  doc.save(`blurb_${exportTab}_${exportRange}_${todayKey()}.pdf`);
};
