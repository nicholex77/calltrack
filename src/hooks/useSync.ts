import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { loadLocal, saveLocal, loadRemote, saveRemote, isLocalFresh, DB_ROW_ID } from "../lib/storage";
import { uid } from "../lib/utils";
import type { DbBlob } from "../types";

const SAVE_DEBOUNCE_MS = 1200;
const RETRY_DELAYS_MS = [5000, 15000, 30000];

// Owns the local-first calltrack blob (db). Reads from localStorage on mount,
// fetches from Supabase only if cache is stale, subscribes to realtime updates,
// and debounces remote writes (1.2s) with exponential-backoff retry on failure.
export function useSync() {
  const [db, setDb] = useState<DbBlob>(loadLocal);
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const writerIdRef = useRef(uid());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial blob load + realtime subscription
  useEffect(() => {
    let mounted = true;

    if (!isLocalFresh() || Object.keys(loadLocal()).length === 0) {
      loadRemote().then(data => {
        if (!mounted) return;
        if (data && Object.keys(data).length > 0) {
          const { __writerId: _, ...clean } = data;
          saveLocal(clean);
          setDb(clean);
        }
        setSyncing(false);
      }).catch(() => { if (mounted) setSyncing(false); });
    } else {
      setSyncing(false);
    }

    // Realtime: ignore our own writes via __writerId so we don't echo
    const channel = supabase.channel("calltrack-realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "calltrack", filter: `id=eq.${DB_ROW_ID}` },
        (payload: any) => {
          const incoming = payload.new?.data;
          if (!incoming || incoming.__writerId === writerIdRef.current) return;
          const { __writerId: _, ...clean } = incoming;
          saveLocal(clean);
          setDb(clean);
        })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED" && navigator.onLine) setIsOnline(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setIsOnline(false);
      });

    return () => {
      mounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Browser online/offline indicator
  useEffect(() => {
    const setOn = () => setIsOnline(true);
    const setOff = () => setIsOnline(false);
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", setOn);
      window.removeEventListener("offline", setOff);
    };
  }, []);

  // Save with up to 3 retries (5s, 15s, 30s backoff)
  const attemptSave = useCallback((data: any, attempt = 0) => {
    saveRemote(data).then(() => {
      setSyncError(false);
      pendingSaveRef.current = null;
    }).catch(() => {
      setSyncError(true);
      if (attempt < 3) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (pendingSaveRef.current) attemptSave(pendingSaveRef.current, attempt + 1);
        }, RETRY_DELAYS_MS[attempt] || 30000);
      }
    });
  }, []);

  // Write locally immediately, debounce the remote save (1.2s)
  const updateDb = useCallback((fn: (db: any) => void) => {
    setDb((prev: any) => {
      const next = structuredClone(prev);
      fn(next);
      saveLocal(next);
      pendingSaveRef.current = { ...next, __writerId: writerIdRef.current };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current) attemptSave(pendingSaveRef.current);
      }, SAVE_DEBOUNCE_MS);
      return next;
    });
  }, [attemptSave]);

  return { db, setDb, updateDb, syncing, syncError, isOnline };
}
