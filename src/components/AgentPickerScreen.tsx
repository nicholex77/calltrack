import type { Member } from "../types";

interface Props {
  members: Member[];
  onPick: (name: string) => void;
  onSignOut: () => void;
}

export function AgentPickerScreen({ members, onPick, onSignOut }: Props) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 24, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1.5px solid #ebebeb" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: -.5 }}>blurB</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Who are you?</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => onPick(m.name)}
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 12,
                border: "1.5px solid #e5e5e5", background: "#fff",
                fontSize: 15, fontWeight: 600, fontFamily: "inherit",
                cursor: "pointer", textAlign: "left", transition: "background .12s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "#f5f7ff")}
              onMouseOut={e => (e.currentTarget.style.background = "#fff")}
            >
              {m.name}
            </button>
          ))}
        </div>

        <button
          onClick={onSignOut}
          style={{ marginTop: 20, width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: "none", fontSize: 13, color: "#aaa", cursor: "pointer", fontFamily: "inherit" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
