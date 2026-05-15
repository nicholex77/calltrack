import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  loadLocalContacts,
  saveLocalContacts,
  loadRemoteContacts,
  upsertContact,
  upsertContacts,
  deleteRemoteContact,
  deleteRemoteContacts,
  dbToContact,
} from "../lib/contacts-db";
import { uid, todayKey } from "../lib/utils";
import type { Contact, ContactNote, ContactHistoryEntry } from "../types";

// Owns the contacts list. Cache-first: reads localStorage, fetches from Supabase
// only when stale, then keeps everything in sync via realtime subscription.
// Exposes high-level mutations used by Contacts, Pipeline, and Daily pages.
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>(() => loadLocalContacts());

  // Initial load + realtime
  useEffect(() => {
    let mounted = true;

    const fetchRemote = () => {
      loadRemoteContacts().then(remote => {
        if (!mounted) return;
        saveLocalContacts(remote);
        setContacts(remote);
      }).catch(e => console.error("contacts load", e));
    };

    fetchRemote();

    // Realtime: keeps local cache in sync with other agents' writes
    // No row_key filter — subscribe to all rows so no events are silently dropped
    const channel = supabase.channel("contacts-realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            setContacts(prev => {
              const next = prev.filter((c: any) => c.id !== payload.old?.id);
              saveLocalContacts(next);
              return next;
            });
          } else if (payload.new) {
            const incoming = dbToContact(payload.new);
            setContacts(prev => {
              const idx = prev.findIndex((x: any) => x.id === incoming.id);
              const next = idx >= 0
                ? [...prev.slice(0, idx), incoming, ...prev.slice(idx + 1)]
                : [...prev, incoming];
              saveLocalContacts(next);
              return next;
            });
          }
        })
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("contacts realtime", status, "— re-fetching");
          fetchRemote();
        }
      });

    // Re-fetch when tab becomes visible to catch missed realtime events
    const onVisible = () => { if (document.visibilityState === "visible") fetchRemote(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Generic single-contact mutation: applies fn, saves locally, syncs to Supabase.
  const mutateContact = useCallback((id: string, fn: (c: Contact) => void) => {
    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const c = { ...next[idx] };
      fn(c);
      next[idx] = c;
      saveLocalContacts(next);
      upsertContact(c);
      return next;
    });
  }, []);

  const updateSalesAgent = useCallback((id: string, salesAgent: string) => {
    mutateContact(id, c => { c.salesAgent = salesAgent; });
  }, [mutateContact]);

  const updateLeadStatus = useCallback((id: string, leadStatus: string | null, currentDate: string, author?: string) => {
    mutateContact(id, c => {
      if (c.leadStatus !== leadStatus) {
        if (!c.history) c.history = [];
        c.history.unshift({
          id: uid(),
          type: "lead",
          from: c.leadStatus || "none",
          to: leadStatus || "none",
          by: author || "",
          timestamp: `${currentDate}T12:00:00.000Z`,
        });
      }
      c.leadStatus = leadStatus;
      c.lastTouched = currentDate;
    });
  }, [mutateContact]);

  const updateStatus = useCallback((id: string, status: string, currentDate: string, author?: string) => {
    const ts = `${currentDate}T12:00:00.000Z`;
    mutateContact(id, c => {
      if (!c.history) c.history = [];
      if (c.status !== status) {
        c.history.unshift({ id: uid(), type: "status", from: c.status, to: status, by: author || "", timestamp: ts });
        c.status = status;
      } else {
        c.history.unshift({ id: uid(), type: "call", status, by: author || "", timestamp: ts });
      }
      c.lastTouched = currentDate;
      if (status === "closed_won")  { c.closedStatus = "won";  c.closedAt = currentDate; }
      if (status === "closed_lost") { c.closedStatus = "lost"; c.closedAt = currentDate; }
    });
  }, [mutateContact]);

  const updateCallbackDate = useCallback((id: string, callbackDate: string) => {
    mutateContact(id, c => { c.callbackDate = callbackDate; });
  }, [mutateContact]);

  const updateField = useCallback((id: string, field: string, value: string) => {
    mutateContact(id, c => { (c as any)[field] = value; });
  }, [mutateContact]);

  const addNote = useCallback((id: string, text: string, author: string, currentDate: string) => {
    if (!text.trim()) return;
    mutateContact(id, c => {
      if (!c.notes) c.notes = [];
      c.notes.unshift({
        id: uid(),
        text: text.trim(),
        timestamp: new Date().toISOString(),
        author: author || "—",
      });
      c.lastTouched = currentDate;
    });
  }, [mutateContact]);

  const bulkUpdateStatus = useCallback((status: string, ids: Set<string>): number => {
    const ts = new Date().toISOString();
    const today = todayKey();
    let count = 0;
    setContacts(prev => {
      const next = prev.map(c => {
        if (!ids.has(c.id)) return c;
        count++;
        const h: ContactHistoryEntry = { id: uid(), type: "status", from: c.status, to: status, by: "Bulk", timestamp: ts };
        return { ...c, status, lastTouched: today, history: [h, ...(c.history || [])] };
      });
      saveLocalContacts(next);
      upsertContacts(next.filter(c => ids.has(c.id)));
      return next;
    });
    return count;
  }, []);

  const addContact = useCallback((c: Contact) => {
    setContacts(prev => {
      const next = [...prev, c];
      saveLocalContacts(next);
      upsertContact(c);
      return next;
    });
  }, []);

  const deleteContact = useCallback((id: string): Contact | undefined => {
    let removed: Contact | undefined;
    setContacts(prev => {
      removed = prev.find(c => c.id === id);
      const next = prev.filter(c => c.id !== id);
      saveLocalContacts(next);
      deleteRemoteContact(id);
      return next;
    });
    return removed;
  }, []);

  const deleteContactsBulk = useCallback((ids: string[]) => {
    setContacts(prev => {
      const next = prev.filter(c => !ids.includes(c.id));
      saveLocalContacts(next);
      deleteRemoteContacts(ids);
      return next;
    });
  }, []);

  const restoreContacts = useCallback((toRestore: Contact[]) => {
    setContacts(prev => {
      const existing = new Set(prev.map(c => c.id));
      const toAdd = toRestore.filter(c => !existing.has(c.id));
      const next = [...prev, ...toAdd];
      saveLocalContacts(next);
      upsertContacts(toAdd);
      return next;
    });
  }, []);

  const mergeContacts = useCallback((keepId: string, removeIds: string[]) => {
    const PRIORITY: Record<string, number> = { interested: 3, callback: 2, contacted: 1 };
    setContacts(prev => {
      const keep = prev.find(c => c.id === keepId);
      if (!keep) return prev;
      const merged: Contact = { ...keep, notes: [...(keep.notes || [])], history: [...(keep.history || [])] };
      prev.filter(c => removeIds.includes(c.id)).forEach(loser => {
        merged.notes = [...(merged.notes || []), ...(loser.notes || [])];
        merged.history = [...(merged.history || []), ...(loser.history || [])];
        if ((PRIORITY[loser.status] || 0) > (PRIORITY[merged.status] || 0)) merged.status = loser.status;
      });
      const next = prev.filter(c => !removeIds.includes(c.id));
      const idx = next.findIndex(c => c.id === keepId);
      if (idx >= 0) next[idx] = merged;
      saveLocalContacts(next);
      upsertContact(merged);
      deleteRemoteContacts(removeIds);
      return next;
    });
  }, []);

  return {
    contacts,
    setContacts,
    mutateContact,
    updateSalesAgent,
    updateLeadStatus,
    updateStatus,
    updateCallbackDate,
    updateField,
    addNote,
    bulkUpdateStatus,
    addContact,
    deleteContact,
    deleteContactsBulk,
    restoreContacts,
    mergeContacts,
  };
}

export type ContactNoteInput = Omit<ContactNote, "id" | "timestamp">;
