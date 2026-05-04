import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { profileError?: string | null; onSignOut?: () => void };

export function LoginScreen({ profileError, onSignOut }: Props = {}) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const signIn = async () => {
    if (!email || !password) return;
    setLoading(true); setError(null);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authErr) {
      setError(authErr.message.includes("Invalid") ? "Wrong email or password." : authErr.message);
      setPassword("");
    }
    // On success, useAuth listener picks up session and switches screens.
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 24, padding: "36px 32px", boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1.5px solid #ebebeb" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "#1a56db", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: -.5 }}>blurB</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>mudah.my · Sign in to continue</div>
        </div>

        {profileError && (
          <div style={{ background: "#fff1f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#dc2626", fontWeight: 600, lineHeight: 1.5 }}>
            <div style={{ marginBottom: 4 }}>⚠ Could not load your account:</div>
            <div style={{ fontWeight: 400, color: "#991b1b" }}>{profileError}</div>
            {onSignOut && (
              <button onClick={onSignOut} style={{ marginTop: 10, padding: "5px 14px", borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Sign Out
              </button>
            )}
          </div>
        )}

        <input
          autoFocus type="email" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e5e5", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />
        <input
          type="password" placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") signIn(); }}
          style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e5e5", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 14, boxSizing: "border-box" }}
        />
        {error && (
          <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginBottom: 14, textAlign: "center" }}>{error}</div>
        )}
        <button
          className="primary-btn"
          style={{ width: "100%", padding: "11px 0", fontSize: 14, opacity: loading || !email || !password ? .5 : 1 }}
          disabled={loading || !email || !password}
          onClick={signIn}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}
