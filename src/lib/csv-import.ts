import { normalizeDate } from "./utils";

// Parse a single CSV line, handling quoted fields with escaped inner quotes.
const parseCSVLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
};

const stripPhone = (p: string) => p.replace(/[\s\-()+.]/g, "").toLowerCase();

// Map a raw status/interest cell to our internal bucket.
const parseBucket = (statusRaw: string, interestRaw: string): string => {
  if (interestRaw === "yes")                              return "interested";
  if (/^ans/.test(statusRaw))                             return "contacted";
  if (/callback|call back|\bcb\b/.test(statusRaw))        return "callback";
  if (/^int/.test(statusRaw))                             return "interested";
  if (/not.ans|no.ans|unan/i.test(statusRaw))             return "not_answered";
  if (/hang|reject/i.test(statusRaw))                     return "hangup";
  return "contacted";
};

export type ImportResult = {
  contacts: any[];
  crossDups: number;
  skipped: number;
};

export type ImportError = { error: string };

/**
 * Parses a raw CSV string into contacts for the given campaign.
 * Returns parsed contacts plus duplicate/skip counts, or an error message.
 * Pure function — no React, no side-effects.
 */
export const parseContactsCSV = (
  text: string,
  campaignName: string,
  existingContacts: any[]
): ImportResult | ImportError => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: "CSV has no data rows." };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const col = (...names: string[]) => {
    for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; }
    return -1;
  };

  const iName      = col("customer_name", "client_name", "name", "contact_name");
  const iPhone     = col("primary_phone", "phone_number", "phone");
  const iPhone2    = col("mobile_phone", "mobile", "phone_2", "phone2", "alternate_phone", "alt_phone", "handphone", "hp");
  const iStoreType = col("store_type", "type");
  const iCompany   = col("agency", "agency_name", "company_name", "company");
  const iStoreId   = col("store_id", "storeid", "store_no", "store_number", "store");
  const iRenId     = col("ren_id", "renid", "ren_no", "ren");
  const iState     = col("most_frequent_state", "remarks", "remark", "notes", "state");
  const iStatus    = col("call_status", "status");
  const iInterest  = col("interest", "interested");
  const iAgent     = col("telesales", "telesales_member", "member", "assigned_member", "assigned", "assigned_to", "agent", "agent_name");
  const iDate      = col("date");
  const iEmail     = col("email", "email_address", "contact_email", "e_mail", "e-mail");

  const PRIORITY: Record<string, number> = { interested: 3, callback: 2, contacted: 1 };
  const seen: Record<string, any> = {};
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row  = parseCSVLine(lines[i]);
    const statusRaw   = (iStatus   >= 0 ? row[iStatus]   : "").trim().toLowerCase();
    const interestRaw = (iInterest >= 0 ? row[iInterest] : "").trim().toLowerCase();
    const bucket      = parseBucket(statusRaw, interestRaw);

    const name      = iName      >= 0 ? row[iName].trim()      : "";
    const phone     = iPhone     >= 0 ? row[iPhone].trim()     : "";
    const phone2    = iPhone2    >= 0 ? row[iPhone2].trim()    : "";
    const storeType = iStoreType >= 0 ? row[iStoreType].trim() : "";
    const company   = iCompany   >= 0 ? row[iCompany].trim()   : "";
    const storeId   = iStoreId   >= 0 ? row[iStoreId].trim()   : "";
    const renId     = iRenId     >= 0 ? row[iRenId].trim()     : "";
    const remarks   = iState     >= 0 ? row[iState].trim()     : "";
    const agent     = iAgent     >= 0 ? row[iAgent].trim()     : "";
    const date      = normalizeDate(iDate >= 0 ? row[iDate].trim() : "");
    const email     = iEmail     >= 0 ? row[iEmail].trim()     : "";
    const key       = phone ? stripPhone(phone) : name.toLowerCase().trim();
    if (!key) { skipped++; continue; }

    const existing = seen[key];
    const inP = PRIORITY[bucket] || 0;
    if (!existing || inP > (PRIORITY[existing.status] || 0)) {
      seen[key] = {
        id: existing?.id || crypto.randomUUID(),
        name: name || phone, phone, phone2, storeType, company, storeId, renId,
        email, status: bucket, agentName: agent, date, remarks,
        leadStatus: existing?.leadStatus || null,
        campaign: campaignName,
      };
    }
  }

  const imported = Object.values(seen);
  if (!imported.length) return { error: "No rows found — check that the file has a name or phone column." };

  const existingPhones = new Set(
    existingContacts
      .filter(c => c.campaign !== campaignName && c.phone)
      .map(c => stripPhone(c.phone))
  );
  const crossDups = imported.filter(c => c.phone && existingPhones.has(stripPhone(c.phone))).length;

  return { contacts: imported, crossDups, skipped };
};
