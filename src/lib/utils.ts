export const initials = (n: string) => n.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

export const uid = () => Math.random().toString(36).slice(2, 9);

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const weekStart = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().split("T")[0];
};

export const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

export const normalizeDate = (raw: string): string => {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) { let yr = parseInt(slash[3]); if (yr < 100) yr += 2000; return `${yr}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`; }
  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dash) { let yr = parseInt(dash[3]); if (yr < 100) yr += 2000; return `${yr}-${dash[2].padStart(2, "0")}-${dash[1].padStart(2, "0")}`; }
  return raw;
};

export const fmt = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
};

export const dayName = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-MY", { weekday: "long" });
};

export const staleness = (lastTouched: string) => {
  if (!lastTouched) return null;
  const d = Math.floor((Date.now() - new Date(lastTouched + "T00:00:00").getTime()) / 86400000);
  if (d <= 0) return { label: "Today", cls: "stale-fresh" };
  if (d === 1) return { label: "Yesterday", cls: "stale-fresh" };
  if (d <= 3) return { label: `${d}d ago`, cls: "stale-warn" };
  return { label: `${d}d ago`, cls: "stale-old" };
};

export const scoreContact = (c: any): number => {
  const today = todayKey();
  let score = 0;
  if (c.leadStatus === "hot") score += 40;
  else if (c.leadStatus === "warm") score += 20;
  else if (c.leadStatus === "cold") score += 5;
  if (c.status === "interested") score += 30;
  else if (c.status === "callback") score += 15;
  else if (c.status === "contacted") score += 5;
  if (c.lastTouched === today) score += 15;
  if ((c.notes || []).length > 0) score += 10;
  if (c.callbackDate && c.callbackDate >= today) score += 10;
  if (c.lastTouched) {
    const d = Math.floor((Date.now() - new Date(c.lastTouched + "T00:00:00").getTime()) / 86400000);
    if (d > 7) score -= 20;
  } else {
    score -= 10;
  }
  return Math.max(0, Math.min(100, score));
};

export const fmtNoteTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};
