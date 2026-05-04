import { initials } from "../lib/utils";
import { AVATAR_COLORS } from "../lib/constants";
import { buildTelesalesSummaryStats } from "../lib/export-data";

interface Props {
  exportTab: string;
  setExportTab: (t: string) => void;
  exportRange: string;
  setExportRange: (r: string) => void;
  isManager: boolean;
  previewRows: any[];
  perfSummary: any[];
  exporting: boolean;
  callTarget: number;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

// CSV/PDF export view. Shows a preview table for the selected task type and
// date range, plus a per-member performance summary for managers.
export function ExportPage({
  exportTab, setExportTab, exportRange, setExportRange,
  isManager, previewRows, perfSummary, exporting, callTarget,
  onExportCSV, onExportPDF,
}: Props) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5, marginBottom: 4 }}>
          {isManager ? "Export to Google Sheets" : "My Export"}
        </div>
        <div style={{ fontSize: 13, color: "#888" }}>
          Download a CSV {isManager ? "and import it directly into Google Sheets" : "of your personal call data"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 7, textTransform: "uppercase", letterSpacing: .5 }}>Task Type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["telesales", "Telesales"], ["whatsapp", "WhatsApp"], ["general", "General"]].map(([k, label]) => (
              <button key={k} className={`tab-btn ${exportTab === k ? "active" : ""}`} onClick={() => setExportTab(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 7, textTransform: "uppercase", letterSpacing: .5 }}>Date Range</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["today", "Today"], ["week", "This Week"], ["month", "Last 30 Days"]].map(([k, label]) => (
              <button key={k} className={`tab-btn ${exportRange === k ? "active" : ""}`} onClick={() => setExportRange(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {isManager && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
            In Google Sheets: <strong>File → Import → Upload</strong> → select the CSV → choose "Insert new sheet".
          </div>
        </div>
      )}

      {exportTab === "telesales" && (() => {
        const summ = buildTelesalesSummaryStats(previewRows);
        return (
          <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>Conversion Summary</div>
            <div style={{ overflowX: "auto" }}>
              <table className="conv-summary-table">
                <thead><tr><th>Metric</th><th>Value</th><th>Rate</th></tr></thead>
                <tbody>
                  <tr><td>Total Calls Made</td><td className="highlight">{summ.totalCalls}</td><td>—</td></tr>
                  <tr><td>Total Answered</td><td className="highlight">{summ.totalAnswered}</td><td><span style={{ fontSize: 13, fontWeight: 700, color: summ.answerRate >= 60 ? "#16a34a" : summ.answerRate >= 40 ? "#d97706" : "#ef4444" }}>{summ.answerRate}%</span></td></tr>
                  <tr><td>Total Not Answered</td><td className="highlight">{summ.totalNotAns}</td><td>—</td></tr>
                  <tr><td>Total Interested</td><td className="highlight">{summ.totalInterested}</td><td><span style={{ fontSize: 13, fontWeight: 700, color: summ.convRate >= 20 ? "#16a34a" : summ.convRate >= 10 ? "#d97706" : "#ef4444" }}>{summ.convRate}% conv. rate</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Preview + export buttons */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Preview</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{previewRows.length} row{previewRows.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost-btn" onClick={onExportPDF} disabled={previewRows.length === 0 || exporting} style={{ fontSize: 13 }}>{exporting ? "Exporting…" : "Export PDF"}</button>
            <button className="green-btn" onClick={onExportCSV} disabled={previewRows.length === 0 || exporting}>{exporting ? "Exporting…" : "Export CSV"}</button>
          </div>
        </div>
        {previewRows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: 13 }}>No data found for this filter.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="export-table">
              <thead><tr>{Object.keys(previewRows[0]).map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {previewRows.slice(0, 15).map((row, i) => (
                  <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 15 && (
              <div style={{ padding: "10px 16px", fontSize: 12, color: "#888", borderTop: "1px solid #f0f0f0" }}>
                +{previewRows.length - 15} more rows in export
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manager-only: per-member performance summary */}
      {isManager && (
        <>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -.4, marginBottom: 4 }}>Overall Performance Summary</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>All telesales members across Today, This Week, and Last 30 Days</div>
          {perfSummary.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#bbb", fontSize: 13, border: "1.5px dashed #e5e5e5", borderRadius: 16 }}>
              Add telesales members to see performance summary.
            </div>
          ) : (
            perfSummary.map(({ member, stats }: any) => (
              <div key={member.id} className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: AVATAR_COLORS[member.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials(member.name)}</div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{member.name}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: "none" }}>
                  {[["today", "Today"], ["week", "This Week"], ["month", "Last 30 Days"]].map(([range, label], ri) => {
                    const s = stats[range];
                    return (
                      <div key={range} style={{ padding: "16px", borderRight: ri < 2 ? "1px solid #f0f0f0" : "none" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>{label}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          {[
                            { label: "Calls", val: s.total, color: "#2563eb", bg: "#eff6ff" },
                            { label: "Answered", val: s.answered, color: "#16a34a", bg: "#f0fdf4" },
                            { label: "Interested", val: s.interested, color: "#d97706", bg: "#fffbeb" },
                            { label: "WA Sent", val: s.sent, color: "#059669", bg: "#ecfdf5" },
                          ].map(({ label, val, color, bg }) => (
                            <div key={label} style={{ background: bg, borderRadius: 10, padding: "8px 10px" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 3, textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span className="stat-badge" style={{ background: "#f0f0f0", color: "#555" }}>{s.aRate}% ans.</span>
                          <span className="stat-badge" style={{ background: "#f0f0f0", color: "#555" }}>{s.replyRate}% reply</span>
                          {callTarget > 0 && (
                            <span className="stat-badge" style={{ background: s.targetHit ? "#f0fdf4" : "#fff1f2", color: s.targetHit ? "#16a34a" : "#ef4444" }}>
                              {s.targetHit ? "Target Hit" : "Below Target"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
