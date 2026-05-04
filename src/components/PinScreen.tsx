import React, { useState, useEffect, useRef } from "react";
import { hashPin, isPinHash } from "../lib/security";
import { initials } from "../lib/utils";
import { AVATAR_COLORS, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MS } from "../lib/constants";

export function PinScreen({ onUnlock, db }: { onUnlock: (role: string, memberId: string | null) => void; db: any }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [pickMember, setPickMember] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [, forceRender] = useState(0);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const managerPin = db.settings?.managerPin || "1234";
  const memberPin = db.settings?.agentPin || "0000";
  const members: any[] = db.members || [];

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const lockSecsLeft = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

  useEffect(() => {
    if (!isLocked) return;
    const t = setInterval(() => { if (Date.now() >= lockedUntil!) { setLockedUntil(null); setAttempts(0); clearInterval(t); } else forceRender(n => n + 1); }, 1000);
    return () => clearInterval(t);
  }, [isLocked, lockedUntil]);

  const handleDigit = (i: number, val: string) => {
    if (isLocked || !/^\d?$/.test(val)) return;
    const next = [...pin]; next[i] = val; setPin(next); setError(false);
    if (val && i < 3) refs[i + 1].current?.focus();
    if (val && i === 3) {
      const entered = next.join("");
      const verify = async (input: string, stored: string) =>
        isPinHash(stored) ? (await hashPin(input)) === stored : input === stored;
      Promise.all([verify(entered, managerPin), verify(entered, memberPin)]).then(([okMgr, okMbr]) => {
        if (selected === "manager" && okMgr) { setAttempts(0); onUnlock("manager", null); return; }
        if (selected === "member" && okMbr) {
          setAttempts(0);
          if (members.length === 0) { onUnlock("member", null); return; }
          setPickMember(true); return;
        }
        const na = attempts + 1; setAttempts(na);
        if (na >= MAX_PIN_ATTEMPTS) { setLockedUntil(Date.now() + PIN_LOCKOUT_MS); setPin(["", "", "", ""]); return; }
        setError(true); setShakeKey(k => k + 1); setPin(["", "", "", ""]);
        setTimeout(() => refs[0].current?.focus(), 50);
      }).catch(() => {
        setError(true); setShakeKey(k => k + 1); setPin(["", "", "", ""]);
      });
    }
  };
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Backspace" && !pin[i] && i > 0) refs[i - 1].current?.focus(); };
  const selectRole = (role: string) => { setSelected(role); setTimeout(() => refs[0].current?.focus(), 80); };

  if (pickMember) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 24, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1.5px solid #ebebeb" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5, marginBottom: 4 }}>Who are you?</div>
          <div style={{ fontSize: 13, color: "#aaa" }}>Select your name to continue</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {members.map((m: any) => (
            <div key={m.id} onClick={() => onUnlock("member", m.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14, border: "1.5px solid #e5e5e5", cursor: "pointer", transition: "all .12s", background: "#fff" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#1a56db"; e.currentTarget.style.background = "#eff6ff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.background = "#fff"; }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: AVATAR_COLORS[m.colorIdx][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials(m.name)}</div>
              <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{m.name}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          ))}
        </div>
        <button className="ghost-btn" style={{ width: "100%" }} onClick={() => { setPickMember(false); setPin(["", "", "", ""]); }}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", padding: 24 }}> <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "40px 36px", boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1.5px solid #ebebeb", textAlign: "center" }}> <div style={{ width: 56, height: 56, borderRadius: 18, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg> </div> <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: -.6, marginBottom: 6 }}>blurB</div> <div style={{ fontSize: 13, color: "#aaa", marginBottom: 36 }}>mudah.my · Sign in to continue</div> {!selected ? (
      <> <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 16, textTransform: "uppercase", letterSpacing: .8 }}>Select your role</div> <div style={{ display: "flex", gap: 14, justifyContent: "center" }}> <div className="role-card" onClick={() => selectRole("manager")}> <div style={{ fontWeight: 800, fontSize: 16 }}>Manager</div> <div style={{ fontSize: 12, color: "#888", marginTop: 6, lineHeight: 1.5 }}>Full access · Export · Settings</div> </div> <div className="role-card" onClick={() => selectRole("member")}> <div style={{ fontWeight: 800, fontSize: 16 }}>Telesales Member</div> <div style={{ fontSize: 12, color: "#888", marginTop: 6, lineHeight: 1.5 }}>Log tasks · View progress</div> </div> </div> </>) : (
      <> <div style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 6 }}> {selected === "manager" ? "Manager" : "Telesales Member"} PIN
      </div> <div style={{ fontSize: 12, color: "#bbb", marginBottom: 28 }}> Default: <strong style={{ color: "#999" }}>{selected === "manager" ? "1234" : "0000"}</strong> — change anytime in Settings
        </div> <div key={shakeKey} className={error ? "shake" : ""} style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}> {[0, 1, 2, 3].map(i => (
          <input key={i} ref={refs[i]} className={`pin-box${error ? " error" : ""}`}
            type="text" inputMode="numeric" maxLength={1}
            value={pin[i]} onChange={e => handleDigit(i, e.target.value)} onKeyDown={e => handleKey(i, e)} />))}
        </div>
        {isLocked && <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginBottom: 16, background: "#fff1f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 14px" }}>Too many attempts — try again in {lockSecsLeft}s</div>}
        {!isLocked && error && <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginBottom: 16 }}>Incorrect PIN — {MAX_PIN_ATTEMPTS - attempts} attempt{MAX_PIN_ATTEMPTS - attempts !== 1 ? "s" : ""} left</div>}
        <button className="ghost-btn" style={{ width: "100%" }} onClick={() => { setSelected(null); setPin(["", "", "", ""]); setError(false); setAttempts(0); setLockedUntil(null); }}>← Back</button> </>)}
    </div> </div>);
}
