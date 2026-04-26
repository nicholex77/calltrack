export function TargetBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0;
  const hit = target > 0 && value >= target;
  const barColor = hit ? "#16a34a" : pct >= 70 ? "#d97706" : "#ef4444";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {target > 0 && <span style={{ fontSize: 11, color: "#999" }}>{value}/{target}</span>}
          {hit && <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "1px 7px", borderRadius: 20 }}>Hit</span>}
          {!hit && target > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{pct}%</span>}
        </div>
      </div>
      {target > 0 && <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} /></div>}
    </div>
  );
}
