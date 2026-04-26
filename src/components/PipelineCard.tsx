import React from "react";
import { CONTACT_LEAD_META } from "../lib/constants";
import { initials, staleness } from "../lib/utils";

export const PipelineCard = React.memo(function PipelineCard({ c, isDragging, onDragStart, onClick }: any) {
  const lm = c.leadStatus ? CONTACT_LEAD_META[c.leadStatus] : null;
  const st = staleness(c.lastTouched || "");
  const sub = [c.storeType, c.salesAgent].filter(Boolean).join(" · ");
  return (
    <div
      className="pipeline-card"
      draggable
      onDragStart={e => onDragStart(e, c.id)}
      onClick={() => onClick(c.id)}
      style={{ opacity: isDragging ? .4 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#e8efff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#1a56db", flexShrink: 0 }}>{initials(c.name || "?")}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Unknown"}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{c.phone || "—"}</div>
        </div>
        {lm && <span style={{ fontSize: 10, fontWeight: 700, color: lm.color, background: lm.bg, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>{lm.label}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
        {sub ? <span style={{ fontSize: 11, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{sub}</span> : <span />}
        {st && <span className={st.cls} style={{ flexShrink: 0, marginLeft: 4 }}>{st.label}</span>}
      </div>
    </div>
  );
});
