export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const AVATAR_COLORS = [
  ["#111", "#444"], ["#2563eb", "#60a5fa"], ["#059669", "#34d399"],
  ["#dc2626", "#f87171"], ["#d97706", "#fbbf24"], ["#7c3aed", "#a78bfa"],
  ["#db2777", "#f472b6"], ["#0891b2", "#22d3ee"],
];

export const BRAND = "#1a56db";

export const TASK_TYPES = {
  telesales: { label: "Telesales Call", color: "#2563eb", bg: "#eff6ff" },
  whatsapp:  { label: "WhatsApp Follow-up", color: "#059669", bg: "#ecfdf5" },
  general:   { label: "General Task", color: "#7c3aed", bg: "#f5f3ff" },
};

export const CONTACT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  interested:   { label: "Interested",   color: "#059669", bg: "#f0fdf4" },
  callback:     { label: "Callback",     color: "#d97706", bg: "#fffbeb" },
  contacted:    { label: "Contacted",    color: "#2563eb", bg: "#eff6ff" },
  not_answered: { label: "Not Answered", color: "#6b7280", bg: "#f3f4f6" },
  hangup:       { label: "Hung Up",      color: "#ef4444", bg: "#fff1f2" },
  closed_won:   { label: "Closed Won",   color: "#059669", bg: "#dcfce7" },
  closed_lost:  { label: "Closed Lost",  color: "#6b7280", bg: "#f3f4f6" },
};

export const CONTACT_LEAD_META: Record<string, { label: string; color: string; bg: string }> = {
  hot:  { label: "Hot",  color: "#ef4444", bg: "#fff1f2" },
  warm: { label: "Warm", color: "#d97706", bg: "#fffbeb" },
  cold: { label: "Cold", color: "#2563eb", bg: "#eff6ff" },
};

export const PIPELINE_COLS = [
  { key: "contacted",   label: "Contacted",   color: "#2563eb", bg: "#eff6ff" },
  { key: "callback",    label: "Callback",    color: "#d97706", bg: "#fffbeb" },
  { key: "interested",  label: "Interested",  color: "#059669", bg: "#f0fdf4" },
  { key: "closed_won",  label: "Closed Won",  color: "#059669", bg: "#dcfce7" },
  { key: "closed_lost", label: "Closed Lost", color: "#6b7280", bg: "#f3f4f6" },
];

export const LEAD_SOURCES = [
  "Cold Call", "Referral", "Walk-in", "Social Media", "Campaign", "Other",
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

export const REJECTION_REASONS = [
  { key: "too_expensive",  label: "Too expensive" },
  { key: "wrong_time",     label: "Not the right time" },
  { key: "competitor",     label: "Already using competitor" },
  { key: "not_relevant",   label: "Not relevant" },
  { key: "wrong_number",   label: "Wrong number" },
] as const;

export type RejectionReasonKey = typeof REJECTION_REASONS[number]["key"];

export const STAGE_PROBABILITY: Record<string, number> = {
  not_answered: 2,
  hangup:       2,
  contacted:    5,
  callback:     20,
  interested:   50,
  closed_won:   100,
  closed_lost:  0,
};

export const NOTE_TYPES = [
  { key: "call",     label: "Call",     icon: "📞", color: "#2563eb" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬", color: "#059669" },
  { key: "email",    label: "Email",    icon: "📧", color: "#7c3aed" },
  { key: "meeting",  label: "Meeting",  icon: "🤝", color: "#d97706" },
  { key: "note",     label: "Note",     icon: "📝", color: "#6b7280" },
] as const;

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 30_000;
