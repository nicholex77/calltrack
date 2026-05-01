import { supabase } from "./supabase";
import { DB_ROW_ID } from "./storage";

export const CONTACTS_KEY = "calltrack_contacts_v1";

export const loadLocalContacts = () => {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]"); } catch { return []; }
};

export const saveLocalContacts = (cs: any[]) => {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(cs)); } catch {}
};

export const contactToDb = (c: any) => ({
  id: c.id, row_key: DB_ROW_ID, name: c.name || null, phone: c.phone || null, phone2: c.phone2 || null,
  store_type: c.storeType || null, company: c.company || null, store_id: c.storeId || null, ren_id: c.renId || null,
  agent_name: c.agentName || null, date: c.date || null, campaign: c.campaign || null, remarks: c.remarks || null,
  status: c.status || "contacted", lead_status: c.leadStatus || null, sales_agent: c.salesAgent || null,
  last_touched: c.lastTouched || null, callback_date: c.callbackDate || null, notes: c.notes || [], history: c.history || [],
  email: c.email || null, recall_date: c.reContactDate || null,
  tags: c.tags || [], answers: c.answers || {},
});

export const dbToContact = (r: any) => ({
  id: r.id, name: r.name || "", phone: r.phone || "", phone2: r.phone2 || "",
  storeType: r.store_type || "", company: r.company || "", storeId: r.store_id || "", renId: r.ren_id || "",
  agentName: r.agent_name || "", date: r.date || "", campaign: r.campaign || "", remarks: r.remarks || "",
  status: r.status || "contacted", leadStatus: r.lead_status || null, salesAgent: r.sales_agent || "",
  lastTouched: r.last_touched || "", callbackDate: r.callback_date || "", notes: r.notes || [], history: r.history || [],
  email: r.email || "", reContactDate: r.recall_date || "",
  tags: r.tags || [], answers: r.answers || {},
});

export const loadRemoteContacts = async (): Promise<any[]> => {
  const { data, error } = await supabase.from("contacts").select("*").eq("row_key", DB_ROW_ID);
  if (error) { console.error("loadRemoteContacts", error); return []; }
  return (data || []).map(dbToContact);
};

export const upsertContact = async (c: any): Promise<void> => {
  const { error } = await supabase.from("contacts").upsert(contactToDb(c));
  if (error) console.error("upsertContact", error);
};

export const upsertContacts = async (cs: any[]): Promise<void> => {
  if (!cs.length) return;
  const rows = cs.map(contactToDb);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("contacts").upsert(rows.slice(i, i + 500));
    if (error) console.error("upsertContacts batch", i, error);
  }
};

export const deleteRemoteContact = async (id: string): Promise<void> => {
  await supabase.from("contacts").delete().eq("id", id).eq("row_key", DB_ROW_ID);
};

export const deleteRemoteContacts = async (ids: string[]): Promise<void> => {
  if (!ids.length) return;
  await supabase.from("contacts").delete().in("id", ids).eq("row_key", DB_ROW_ID);
};
