export function Counter({ value, onChange, size = "normal" }: { value: number; onChange: (v: number) => void; size?: string }) {
  const isSmall = size === "sm";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: isSmall ? 4 : 6 }}>
      <button className={`counter-btn${isSmall ? " sm" : ""}`} onClick={() => onChange(value - 1)}>−</button>
      <input type="number" min={0} className={`num-input${isSmall ? " sm" : ""}`} value={value} onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))} />
      <button className={`counter-btn${isSmall ? " sm" : ""}`} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
