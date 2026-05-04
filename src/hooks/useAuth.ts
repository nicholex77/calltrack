import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

// Owns Supabase session + linked profile row. Auto-locks after 30 min of inactivity.
export function useAuth(onLock?: () => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);

  // Initial session check + auth state listener
  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", userId)
        .single();
      if (!mounted) return;
      if (data) {
        setProfile(data);
        setProfileError(null);
      } else {
        setProfile(null);
        const msg = error?.message || "";
        if (msg.includes("relation") || msg.includes("does not exist")) {
          setProfileError("The profiles table hasn't been created yet. Run supabase-setup.sql in your Supabase SQL Editor.");
        } else {
          setProfileError("Account not found in profiles table. Ask your manager to set up your account.");
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => {
          if (mounted) setAuthLoading(false);
        });
      } else {
        setAuthLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) loadProfile(newSession.user.id);
      else { setProfile(null); setProfileError(null); }
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleLock = useCallback(async () => {
    setSelectedMemberName(null);
    await supabase.auth.signOut();
    onLock?.();
  }, [onLock]);

  // Idle auto-logout
  useEffect(() => {
    if (!session) return;
    let lastActivity = Date.now();
    const reset = () => { lastActivity = Date.now(); };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) handleLock();
    }, 60 * 1000);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, [session, handleLock]);

  const isManager = profile?.role === "manager";

  return { session, profile, authLoading, profileError, isManager, handleLock, signOut, selectedMemberName, setSelectedMemberName };
}
