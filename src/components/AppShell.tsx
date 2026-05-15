import React, { useState, useEffect } from "react";

type NavItem = [string, string];

type Props = {
  page: string;
  setPage: (p: string) => void;
  navItems: NavItem[];
  isManager: boolean;
  syncing: boolean;
  syncError: boolean;
  isOnline: boolean;
  hasUnsaved: boolean;
  onLock: () => void;
  children: React.ReactNode;
};

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  analytics: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>,
  daily: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  weekly: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>,
  contacts: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  pipeline: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18"/><path d="M12 3v18"/><path d="M19 3v18"/><rect x="3" y="5" width="4" height="6" rx="1"/><rect x="10" y="5" width="4" height="10" rx="1"/><rect x="17" y="5" width="4" height="4" rx="1"/></svg>,
  templates: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
  stats: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>,
  mystats: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  export: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  members: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

export function AppShell({ page, setPage, navItems, isManager, syncing, syncError, isOnline, hasUnsaved, onLock, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [page]);

  let pillClass = "sync-pill synced";
  let pillText = "Synced";
  let pillDot = "#059669";
  if (!isOnline) { pillClass = "sync-pill offline"; pillText = "Offline"; pillDot = "#991b1b"; }
  else if (syncing) { pillClass = "sync-pill syncing"; pillText = "Syncing…"; pillDot = "#d97706"; }
  else if (syncError) { pillClass = "sync-pill error"; pillText = "Unsaved"; pillDot = "#dc2626"; }

  const handleNavClick = (p: string) => { setPage(p); setDrawerOpen(false); };

  return (
    <div className="app-shell">
      <div className="shell-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="shell-hamburger" onClick={() => setDrawerOpen(v => !v)} aria-label="Open navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.4, color: "#1a56db" }}>blurB</span>
          <span className="desktop-only" style={{ fontSize: 11, color: "#888", background: "#f3f3f3", padding: "2px 8px", borderRadius: 5, fontWeight: 600 }}>mudah.my</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={pillClass}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pillDot, display: "inline-block", animation: syncing ? "pulse 1s infinite" : "none" }} />
            {pillText}
          </span>
          <div className="desktop-only" style={{ fontSize: 11, fontWeight: 700, color: isManager ? "#1a56db" : "#059669", background: isManager ? "#eff6ff" : "#ecfdf5", padding: "3px 10px", borderRadius: 20 }}>{isManager ? "Manager" : "Telesales"}</div>
            <button className="ghost-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={onLock}>Lock</button>
        </div>
      </div>
      <div className="shell-body">
        <aside className={`sidebar ${drawerOpen ? "open" : ""}`}>
          {navItems.map(([p, label]) => {
            const isActive = page === p;
            const showDot = p === "daily" && hasUnsaved;
            return (
              <button key={p} className={`sidebar-link ${isActive ? "active" : ""}`} onClick={() => handleNavClick(p)}>
                {ICONS[p] || <span style={{ width: 14 }} />}
                <span style={{ flex: 1 }}>{label}</span>
                {showDot && <span className="unsaved-dot" />}
              </button>
            );
          })}
        </aside>
        <div className={`sidebar-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
