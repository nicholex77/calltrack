import { supabase } from "./supabase";

export const STORAGE_KEY = "calltrack_v5";
export const DB_ROW_ID = (import.meta.env.VITE_DB_ROW_ID as string) || "main";

const SYNC_TS_KEY    = "calltrack_synced_at";
const FRESHNESS_MS   = 24 * 60 * 60 * 1000;

export const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
};

export const saveLocal = (data: any) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SYNC_TS_KEY, Date.now().toString());
  } catch {}
};

/** True if the blob was synced from Supabase within the last 5 minutes. */
export const isLocalFresh = (): boolean => {
  try {
    const ts = localStorage.getItem(SYNC_TS_KEY);
    return !!ts && Date.now() - parseInt(ts) < FRESHNESS_MS;
  } catch { return false; }
};

export const loadRemote = async () => {
  const { data } = await supabase.from("calltrack").select("data").eq("id", DB_ROW_ID).single();
  return data?.data || {};
};

export const saveRemote = async (data: any): Promise<void> => {
  const { error } = await supabase.from("calltrack").upsert({ id: DB_ROW_ID, data, updated_at: new Date().toISOString() });
  if (error) throw error;
};
