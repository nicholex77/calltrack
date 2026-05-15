import React, { useState, useMemo, useCallback, useDeferredValue, useEffect } from "react";
import { initials, uid, todayKey, addDays, scoreContact } from "../lib/utils";
import { saveLocalContacts, upsertContact, upsertContacts, deleteRemoteContact, deleteRemoteContacts } from "../lib/contacts-db";
import { CONTACT_STATUS_META, LEAD_SOURCES } from "../lib/constants";
import { parseContactsCSV } from "../lib/csv-import";
import { ContactRow } from "../components/ContactRow";
import type { Contact, Member, ToastAction } from "../types";

interface Props {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  members: Member[];
  isManager: boolean;
  loggedInMemberId: string | null;
  showToast: (msg: string, action?: ToastAction) => void;
  currentDate: string;
  contactCampaigns: string[];
  contactAgentOpts: string[];
  waTemplates: any[];
  qaTemplates: any;
  reassignAgent: string | null;
  onReassignAgentConsumed: () => void;
  initialOpenContactId: string | null;
  onInitialOpenContactIdConsumed: () => void;
}

export function ContactsPage({
  contacts, setContacts, members, isManager, loggedInMemberId, showToast,
  currentDate, contactCampaigns, contactAgentOpts,
  waTemplates, qaTemplates,
  reassignAgent, onReassignAgentConsumed,
  initialOpenContactId, onInitialOpenContactIdConsumed,
}: Props) {
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilters, setContactFilters] = useState<Record<string,string[]>>({status:[],lead:[],campaign:[],agent:[],tag:[],source:[]});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string|null>(null);
  const [contactSelectMode, setContactSelectMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSort, setContactSort] = useState("status");
  const [contactLimit, setContactLimit] = useState(100);
  const [contactDateFrom, setContactDateFrom] = useState("");
  const [contactDateTo, setContactDateTo] = useState("");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [addContactForm, setAddContactForm] = useState({name:"",phone:"",email:"",status:"contacted",campaign:"",salesAgent:"",remarks:""});
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [dedupGroups, setDedupGroups] = useState<any[][]>([]);
  const [dedupIdx, setDedupIdx] = useState(0);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCounts, setAssignCounts] = useState<Record<string,string>>({});
  const [assignFromUnassigned, setAssignFromUnassigned] = useState(true);
  const [assignMode, setAssignMode] = useState<"even"|"custom">("even");
  const [assignCampaignFilter, setAssignCampaignFilter] = useState("");
  const [assignSelectedMembers, setAssignSelectedMembers] = useState<Set<string>>(new Set());
  const [lastDistributionSnapshot, setLastDistributionSnapshot] = useState<{id:string,prevAgent:string|null}[]|null>(null);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignIds, setBulkReassignIds] = useState<Set<string>>(new Set());
  const [bulkReassignTarget, setBulkReassignTarget] = useState("");
  const [pendingImport, setPendingImport] = useState<{file:File}|null>(null);
  const [pendingCampaignName, setPendingCampaignName] = useState("");
  const [deletionHistory, setDeletionHistory] = useState<Array<{hid:string,label:string,contacts:any[],timestamp:number}>>([]);
  const [openContactId, setOpenContactId] = useState<string|null>(null);
  const [importing, setImporting] = useState(false);

  // Cross-page triggers (from StatsPage stale reassign / DailyPage callback "View")
  useEffect(() => {
    if (!reassignAgent) return;
    setContactFilters({status:[],lead:[],campaign:[],agent:[reassignAgent]});
    setContactSort("stale"); setContactSelectMode(true);
    onReassignAgentConsumed();
  }, [reassignAgent, onReassignAgentConsumed]);

  useEffect(() => {
    if (!initialOpenContactId) return;
    setOpenContactId(initialOpenContactId);
    onInitialOpenContactIdConsumed();
  }, [initialOpenContactId, onInitialOpenContactIdConsumed]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const contactTagOpts = useMemo(() =>
    Array.from(new Set(contacts.flatMap((c:any) => c.tags||[]).filter(Boolean))).sort() as string[]
  , [contacts]);

  const deferredSearch = useDeferredValue(contactSearch);

  const filteredContacts = useMemo(() => {
    const cf = contactFilters; const q = deferredSearch.trim().toLowerCase();
    const list = contacts.filter((c:any) => {
      if(cf.status?.length   && !cf.status.includes(c.status)) return false;
      if(cf.campaign?.length && !cf.campaign.includes(c.campaign||"")) return false;
      if(cf.agent?.length)   { const a = c.salesAgent||"__none__"; if(!cf.agent.includes(a)) return false; }
      if(cf.lead?.length)    { const l = c.leadStatus||"unclassified"; if(!cf.lead.includes(l)) return false; }
      if(cf.tag?.length)    { const ts = c.tags||[]; if(!cf.tag.some((t:string)=>ts.includes(t))) return false; }
      if(cf.source?.length && !cf.source.includes(c.source||"")) return false;
      if(contactDateFrom && (c.lastTouched||"") < contactDateFrom) return false;
      if(contactDateTo   && (c.lastTouched||"") > contactDateTo)   return false;
      if(q && !`${c.name} ${c.phone} ${c.phone2||""} ${c.storeType||""} ${c.company||""} ${c.storeId||""} ${c.renId||""} ${c.email||""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const today = todayKey();
    const staleD = (c:any) => c.lastTouched ? Math.floor((Date.now()-new Date(c.lastTouched+"T00:00:00").getTime())/86400000) : 999;
    const queueScore = (c:any) => {
      if(c.callbackDate && c.callbackDate < today) return 100;
      if(c.callbackDate === today) return 90;
      const d = staleD(c);
      if(c.leadStatus==="hot") return 80-Math.min(d,20);
      if(c.leadStatus==="warm" && d>3) return 60-Math.min(d,20);
      if(d>7) return 40-Math.min(d,20);
      return d>3 ? 10 : 0;
    };
    const leadP:any = {hot:3,warm:2,cold:1};
    return list.sort((a:any,b:any) => {
      if(contactSort==="name")   return (a.name||"").localeCompare(b.name||"");
      if(contactSort==="newest") return (b.date||"").localeCompare(a.date||"");
      if(contactSort==="stale")  return staleD(b)-staleD(a);
      if(contactSort==="hot")    return (leadP[b.leadStatus]||0)-(leadP[a.leadStatus]||0);
      if(contactSort==="queue")  return queueScore(b)-queueScore(a);
      if(contactSort==="score")     return scoreContact(b)-scoreContact(a);
      if(contactSort==="dealValue") return ((b as any).dealValue||0)-((a as any).dealValue||0);
      return ({interested:3,callback:2,contacted:1}[b.status as string]||0)-({interested:3,callback:2,contacted:1}[a.status as string]||0);
    });
  }, [contacts, contactFilters, deferredSearch, contactSort, contactDateFrom, contactDateTo]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleContactFilter = useCallback((dim:string, val:string) => {
    setContactFilters(prev => { const a = prev[dim]||[]; return {...prev,[dim]:a.includes(val)?a.filter((v:string)=>v!==val):[...a,val]}; });
    setContactLimit(100);
  }, []);

  const clearContactFilters = useCallback(() => {
    setContactFilters({status:[],lead:[],campaign:[],agent:[],tag:[],source:[]});
    setContactDateFrom(""); setContactDateTo(""); setContactLimit(100);
  }, []);

  const openDedupModal = useCallback(() => {
    const strip = (p:string) => p.replace(/[\s\-()+.]/g,"").toLowerCase();
    const map: Record<string,any[]> = {};
    contacts.forEach((c:any) => { const k = c.phone ? strip(c.phone) : null; if(!k) return; if(!map[k]) map[k]=[]; map[k].push(c); });
    const groups = Object.values(map).filter(g => g.length > 1);
    if(!groups.length) { showToast("No duplicate phone numbers found."); return; }
    setDedupGroups(groups); setDedupIdx(0); setShowDedupModal(true);
  }, [contacts, showToast]);

  const mergeDedupContacts = useCallback((keepId:string, removeIds:string[]) => {
    const PRIORITY:any = {interested:3,callback:2,contacted:1};
    setContacts(prev => {
      const keep = prev.find((c:any) => c.id===keepId); if(!keep) return prev;
      const merged:any = {...keep, notes:[...(keep.notes||[])], history:[...(keep.history||[])]};
      prev.filter((c:any) => removeIds.includes(c.id)).forEach((loser:any) => {
        merged.notes = [...merged.notes, ...(loser.notes||[])];
        merged.history = [...merged.history, ...(loser.history||[])];
        if((PRIORITY[loser.status]||0) > (PRIORITY[merged.status]||0)) merged.status = loser.status;
      });
      const n = prev.filter((c:any) => !removeIds.includes(c.id));
      const idx = n.findIndex((c:any) => c.id===keepId); if(idx>=0) n[idx] = merged;
      saveLocalContacts(n); upsertContact(merged); deleteRemoteContacts(removeIds); return n;
    });
    showToast("Contacts merged.");
    setDedupGroups(prev => { const next = [...prev]; next.splice(dedupIdx,1); return next; });
    setDedupIdx(i => Math.min(i, dedupGroups.length-2));
  }, [showToast, dedupIdx, dedupGroups.length, setContacts]);

  const pushDeletionHistory = (label:string, deleted:any[]) => {
    setDeletionHistory(h => [{hid:crypto.randomUUID(),label,contacts:[...deleted],timestamp:Date.now()},...h.slice(0,19)]);
  };

  const deleteSelectedContacts = () => {
    const ids = selectedContactIds;
    const toDelete = contacts.filter((c:any) => ids.has(c.id));
    if(toDelete.length) pushDeletionHistory(`${toDelete.length} contacts`, toDelete);
    setContacts(prev => { const n = prev.filter((c:any) => !ids.has(c.id)); saveLocalContacts(n); deleteRemoteContacts([...ids]); return n; });
    setSelectedContactIds(new Set()); setContactSelectMode(false);
  };

  const deleteAllContacts = () => {
    if(contacts.length) pushDeletionHistory(`All ${contacts.length} contacts`, contacts);
    const ids = contacts.map((c:any) => c.id);
    setContacts([]); saveLocalContacts([]); deleteRemoteContacts(ids);
    setSelectedContactIds(new Set()); setContactSelectMode(false);
  };

  const undoDelete = (hid:string) => {
    const entry = deletionHistory.find(h => h.hid===hid); if(!entry) return;
    setContacts(prev => {
      const existing = new Set(prev.map((c:any) => c.id));
      const toAdd = entry.contacts.filter((c:any) => !existing.has(c.id));
      const n = [...prev, ...toAdd]; saveLocalContacts(n); upsertContacts(toAdd); return n;
    });
    setDeletionHistory(h => h.filter(e => e.hid!==hid));
    showToast("Restored " + entry.label);
  };

  const updateContactSalesAgent = useCallback((contactId:string, salesAgent:string) => {
    setContacts(prev => {
      const next = prev.map((c:any) => c.id===contactId ? {...c,salesAgent} : c);
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts]);

  const updateContactLeadStatus = useCallback((contactId:string, leadStatus:string|null, author?:string) => {
    setContacts(prev => {
      const next = prev.map((c:any) => {
        if(c.id!==contactId) return c;
        const h = [...(c.history||[])];
        if(c.leadStatus!==leadStatus) h.unshift({id:uid(),type:"lead",from:c.leadStatus||"none",to:leadStatus||"none",by:author||"",timestamp:`${currentDate}T12:00:00.000Z`});
        return {...c, leadStatus, lastTouched:currentDate, history:h};
      });
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts, currentDate]);

  const updateContactStatus = useCallback((contactId:string, status:string, author?:string) => {
    const ts = `${currentDate}T12:00:00.000Z`;
    setContacts(prev => {
      const next = prev.map((c:any) => {
        if(c.id!==contactId) return c;
        const h = [...(c.history||[])];
        if(c.status!==status) h.unshift({id:uid(),type:"status",from:c.status,to:status,by:author||"",timestamp:ts});
        else h.unshift({id:uid(),type:"call",status,by:author||"",timestamp:ts});
        const closed = status==="closed_won" ? {closedStatus:"won",closedAt:currentDate} : status==="closed_lost" ? {closedStatus:"lost",closedAt:currentDate} : {};
        return {...c, status, lastTouched:currentDate, history:h, ...closed};
      });
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts, currentDate]);

  const updateContactCallbackDate = useCallback((contactId:string, callbackDate:string) => {
    setContacts(prev => {
      const next = prev.map((c:any) => c.id===contactId ? {...c,callbackDate} : c);
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts]);

  const updateContactField = useCallback((contactId:string, field:string, value:any) => {
    const parsed = field === "dealValue" ? (parseFloat(value) || undefined) : value;
    setContacts(prev => {
      const next = prev.map((c:any) => c.id===contactId ? {...c,[field]:parsed} : c);
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts]);

  const addContactNote = useCallback((contactId:string, text:string, author:string, noteType?:string) => {
    if(!text.trim()) return;
    setContacts(prev => {
      const next = prev.map((c:any) => {
        if(c.id!==contactId) return c;
        const notes = [{id:uid(),text:text.trim(),timestamp:new Date().toISOString(),author:author||"—",noteType:noteType||"note"}, ...(c.notes||[])];
        return {...c, notes, lastTouched:currentDate};
      });
      const u = next.find((c:any) => c.id===contactId); if(u) { saveLocalContacts(next); upsertContact(u as any); }
      return next;
    });
  }, [setContacts, currentDate]);

  const bulkUpdateContactStatus = useCallback((status:string, ids:Set<string>) => {
    const size = ids.size; const ts = new Date().toISOString(); const today = todayKey();
    setContacts(prev => {
      const next = prev.map((c:any) => { if(!ids.has(c.id)) return c; const h={id:uid(),type:"status",from:c.status,to:status,by:"Bulk",timestamp:ts}; return {...c,status,lastTouched:today,history:[h,...(c.history||[])]}; });
      saveLocalContacts(next); upsertContacts(next.filter((c:any) => ids.has(c.id))); return next;
    });
    setContactSelectMode(false); setSelectedContactIds(new Set());
    showToast(`Updated ${size} contact${size!==1?"s":""} to ${CONTACT_STATUS_META[status as keyof typeof CONTACT_STATUS_META]?.label||status}.`);
  }, [showToast, setContacts]);

  const addContactManually = useCallback(() => {
    const f = addContactForm;
    if(!f.name.trim()&&!f.phone.trim()) { showToast("Name or phone is required."); return; }
    const email = f.email.trim();
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Invalid email format."); return; }
    const c:any = {id:uid(),name:f.name.trim(),phone:f.phone.trim(),email,phone2:"",storeType:"",company:"",storeId:"",renId:"",agentName:"",date:todayKey(),campaign:f.campaign.trim(),remarks:f.remarks.trim(),status:f.status||"contacted",leadStatus:null,salesAgent:f.salesAgent||"",lastTouched:todayKey(),callbackDate:"",notes:[],history:[]};
    setContacts(prev => { const n = [...prev,c]; saveLocalContacts(n); upsertContact(c); return n; });
    showToast(`Contact "${f.name||f.phone}" added.`);
    setShowAddContactModal(false);
    setAddContactForm({name:"",phone:"",email:"",status:"contacted",campaign:"",salesAgent:"",remarks:""});
  }, [addContactForm, showToast, setContacts]);

  const deleteContactCb = useCallback((contactId:string) => {
    setContacts(prev => {
      const c = prev.find((x:any) => x.id===contactId);
      if(c) {
        const hid = crypto.randomUUID();
        setDeletionHistory(h => [{hid,label:c.name||c.phone||"Contact",contacts:[c],timestamp:Date.now()},...h.slice(0,19)]);
        const restore = () => {
          setContacts(p => { if(p.find((x:any)=>x.id===c.id)) return p; const n=[...p,c]; saveLocalContacts(n); upsertContact(c as any); return n; });
          setDeletionHistory(h => h.filter(e => e.hid!==hid));
          showToast(`Restored "${c.name||c.phone||"contact"}"`);
        };
        showToast(`Deleted "${c.name||c.phone||"contact"}"`, {label:"Undo", fn:restore});
      }
      const n = prev.filter((x:any) => x.id!==contactId); saveLocalContacts(n); deleteRemoteContact(contactId); return n;
    });
    setSelectedContactIds(prev => { const n = new Set(prev); n.delete(contactId); return n; });
  }, [showToast, setContacts]);

  const handleContactToggle = useCallback((id:string|null) => setOpenContactId(prev => prev===id ? null : id), []);
  const handleContactSelect = useCallback((id:string) => setSelectedContactIds(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }), []);

  const assignContactsRandomly = () => {
    const pool = [...contacts].filter((c:any) => !(assignFromUnassigned&&c.salesAgent) && (!assignCampaignFilter||c.campaign===assignCampaignFilter));
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const assignments: Record<string,string> = {};
    if(assignMode==="even") {
      const sel = members.filter((m:any) => assignSelectedMembers.has(m.id));
      if(!sel.length) { showToast("Select at least one member to distribute to."); return; }
      sel.forEach((m:any,i:number) => { const per=Math.ceil(pool.length/sel.length); const start=i*per,end=Math.min(start+per,pool.length); for(let k=start;k<end;k++) assignments[pool[k].id]=m.name; });
    } else {
      let idx=0; for(const m of members) { if(!assignSelectedMembers.has(m.id)) continue; const n=Math.max(0,parseInt(assignCounts[m.id]||"0")||0); for(let i=0;i<n&&idx<pool.length;i++,idx++) assignments[pool[idx].id]=m.name; }
    }
    const total = Object.keys(assignments).length;
    if(!total) { showToast("No contacts to assign — check pool size or counts."); return; }
    const snapshot = contacts.filter((c:any) => assignments[c.id]!==undefined).map((c:any) => ({id:c.id,prevAgent:c.salesAgent??null}));
    setLastDistributionSnapshot(snapshot);
    setContacts(prev => { const next=prev.map((c:any)=>assignments[c.id]?{...c,salesAgent:assignments[c.id]}:c); saveLocalContacts(next); upsertContacts(next.filter((c:any)=>assignments[c.id]!==undefined)); return next; });
    const agentCount = new Set(Object.values(assignments)).size;
    showToast(`Assigned ${total} contact${total!==1?"s":""} across ${agentCount} agent${agentCount!==1?"s":""}.`);
    setShowAssignModal(false); setAssignCounts({}); setAssignSelectedMembers(new Set());
  };

  const undoDistribution = () => {
    if(!lastDistributionSnapshot) return;
    const map: Record<string,string|null> = {};
    lastDistributionSnapshot.forEach(s => map[s.id]=s.prevAgent);
    setContacts(prev => { const next=prev.map((c:any)=>c.id in map?{...c,salesAgent:map[c.id]}:c); saveLocalContacts(next); upsertContacts(next.filter((c:any)=>c.id in map)); return next; });
    setLastDistributionSnapshot(null); showToast("Distribution undone.");
  };

  const importContactsFromCSV = (file: File, campaignName: string) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const result = parseContactsCSV(text, campaignName, contacts);
      if("error" in result) { showToast(result.error); setImporting(false); return; }
      const { contacts: imported, crossDups, skipped } = result;
      const PRIORITY: Record<string,number> = {interested:3,callback:2,contacted:1};
      const stripPhone = (p:string) => p.replace(/[\s\-()+.]/g,"").toLowerCase();
      setContacts(prev => {
        const otherCampaign = prev.filter((c:any) => c.campaign !== campaignName);
        const sameCampaign  = prev.filter((c:any) => c.campaign === campaignName);
        const existingMap:any = {};
        sameCampaign.forEach((c:any) => { const k=c.phone?stripPhone(c.phone):(c.name||"").toLowerCase().trim(); if(k) existingMap[k]=c; });
        imported.forEach((c:any) => { const k=c.phone?stripPhone(c.phone):(c.name||"").toLowerCase().trim(); const ex=existingMap[k]; if(!ex||(PRIORITY[c.status]||0)>=(PRIORITY[ex.status]||0)) existingMap[k]={...c,leadStatus:ex?.leadStatus||null}; });
        const next = [...otherCampaign, ...Object.values(existingMap)] as Contact[];
        saveLocalContacts(next); upsertContacts(Object.values(existingMap)); return next;
      });
      setContactLimit(100);
      showToast(`Imported ${imported.length} contact${imported.length!==1?"s":""} into "${campaignName}"${crossDups>0?` · ${crossDups} duplicate phone${crossDups!==1?"s":""} found in other campaigns`:""}${skipped>0?` · ${skipped} row${skipped!==1?"s":""} skipped (no name or phone)`:""}.`);
      setImporting(false);
    };
    reader.onerror = () => { showToast("Failed to read file — try again."); setImporting(false); };
    reader.readAsText(file);
  };

  const bulkReassignContacts = () => {
    if(!bulkReassignTarget) return;
    const ids = bulkReassignIds;
    setContacts(prev => {
      const next = prev.map(c => ids.has(c.id) ? {...c,salesAgent:bulkReassignTarget} : c);
      saveLocalContacts(next); upsertContacts(next.filter(c => ids.has(c.id))); return next;
    });
    setShowBulkReassignModal(false); setBulkReassignIds(new Set()); setBulkReassignTarget("");
    setContactSelectMode(false); setSelectedContactIds(new Set());
    showToast(`Reassigned ${ids.size} contact${ids.size!==1?"s":""} to ${bulkReassignTarget}`);
  };

  const exportFilteredContacts = (rows: any[]) => {
    if(!rows.length) { showToast("No contacts to export"); return; }
    const headers = ["name","phone","phone2","email","storeType","company","storeId","renId","campaign","status","salesAgent","lastTouched","callbackDate","remarks"];
    const csv = [headers.join(","), ...rows.map(c=>headers.map(h=>`"${String((c as any)[h]||"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download=`blurb_contacts_${todayKey()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast(`Exported ${rows.length} contacts`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const anyActive = Object.values(contactFilters).some((a:any) => a.length>0) || contactSearch.trim().length>0 || !!contactDateFrom || !!contactDateTo;
  const filtered  = filteredContacts;
  const filteredPipelineValue = filtered.reduce((s:number,c:any) => s+(c.dealValue||0), 0);
  const filterDefs = [
    {key:"status",  label:"Status",   options:[{val:"interested",label:"Interested"},{val:"callback",label:"Callback"},{val:"contacted",label:"Contacted"},{val:"not_answered",label:"Not Answered"},{val:"hangup",label:"Hung Up"},{val:"closed_won",label:"Closed Won"},{val:"closed_lost",label:"Closed Lost"}]},
    {key:"lead",    label:"Lead",     options:[{val:"hot",label:"🔴 Hot"},{val:"warm",label:"🟡 Warm"},{val:"cold",label:"🔵 Cold"},{val:"unclassified",label:"Unclassified"}]},
    {key:"source",  label:"Source",   options:LEAD_SOURCES.map(s=>({val:s,label:s}))},
    {key:"campaign",label:"Campaign", options:contactCampaigns.map(cp=>({val:cp,label:cp}))},
    {key:"agent",   label:"Agent",    options:[...contactAgentOpts.map(a=>({val:a,label:a})),{val:"__none__",label:"Unassigned"}]},
    {key:"tag",     label:"Tag",      options:contactTagOpts.map(t=>({val:t,label:t}))},
  ];
  const authorName = isManager ? "Manager" : (members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member");

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Contacts</div>
          <div style={{fontSize:13,color:"#888",marginTop:2}}>{contacts.length} total · {filtered.length} shown{anyActive?" (filtered)":""}</div>
          {filteredPipelineValue > 0 && <div style={{fontSize:12,color:"#059669",fontWeight:700,marginTop:2}}>Pipeline: RM {filteredPipelineValue.toLocaleString()}</div>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {contactSelectMode&&selectedContactIds.size>0&&(
            <>
              {isManager&&<button onClick={deleteSelectedContacts} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #ef4444",background:"#ef4444",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Delete ({selectedContactIds.size})</button>}
              {isManager&&members.length>0&&<button onClick={()=>{setBulkReassignIds(new Set(selectedContactIds));setShowBulkReassignModal(true);}} style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid #7c3aed",background:"#f5f3ff",color:"#7c3aed",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Reassign ({selectedContactIds.size})</button>}
              {(["contacted","callback","interested","not_answered","hangup"] as const).map(st=>{const stm=CONTACT_STATUS_META[st];return <button key={st} onClick={()=>bulkUpdateContactStatus(st,selectedContactIds)} style={{padding:"8px 12px",borderRadius:10,border:`1.5px solid ${stm.color}`,background:stm.bg,color:stm.color,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{stm.label}</button>;})}
            </>
          )}
          {isManager&&contacts.length>0&&!contactSelectMode&&(
            <button onClick={()=>{if(window.confirm(`Delete all ${contacts.length} contacts?`)) deleteAllContacts();}} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #ef4444",background:"#fff",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Delete All</button>
          )}
          {isManager&&members.length>0&&contacts.length>0&&(
            <button onClick={()=>{setAssignMode("even");setAssignSelectedMembers(new Set());setAssignCounts({});setShowAssignModal(true);}} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #7c3aed",background:"#fff",color:"#7c3aed",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⚡ Distribute</button>
          )}
          {isManager&&lastDistributionSnapshot&&(
            <button onClick={undoDistribution} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #e5740a",background:"#fff7ed",color:"#c2410c",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↩ Undo Distribution</button>
          )}
          {filtered.length>0&&filtered.length<contacts.length&&(
            <button onClick={()=>exportFilteredContacts(filtered)} style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid #059669",background:"#f0fdf4",color:"#059669",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↓ Export Filtered ({filtered.length})</button>
          )}
          {contacts.length>0&&!(filtered.length>0&&filtered.length<contacts.length)&&(
            <button onClick={()=>exportFilteredContacts(contacts)} style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid #059669",background:"#f0fdf4",color:"#059669",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>↓ Export All ({contacts.length})</button>
          )}
          <button onClick={()=>{setContactSelectMode(m=>!m);setSelectedContactIds(new Set());}} style={{padding:"8px 16px",borderRadius:10,border:`1.5px solid ${contactSelectMode?"#111":"#e5e5e5"}`,background:contactSelectMode?"#111":"#fff",color:contactSelectMode?"#fff":"#555",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{contactSelectMode?"Cancel":"Select"}</button>
          <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,border:`1.5px solid ${importing?"#aaa":"#1a56db"}`,background:"#fff",color:importing?"#aaa":"#1a56db",fontSize:13,fontWeight:700,cursor:importing?"not-allowed":"pointer",fontFamily:"inherit",opacity:importing?.6:1}}>
            {importing?<><span style={{width:10,height:10,border:"2px solid #1a56db",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"pulse .8s linear infinite"}}/>Importing…</>:"↑ Import CSV"}
            <input type="file" accept=".csv" disabled={importing} style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){setPendingCampaignName(f.name.replace(/\.csv$/i,"").trim());setPendingImport({file:f});}e.target.value="";}}/>
          </label>
        </div>
      </div>

      {/* Agent assignment panel */}
      {isManager&&members.length>0&&(()=>{
        const assignedNames=new Set(contacts.map((c:any)=>c.salesAgent||"").filter(Boolean));
        const done=members.filter((m:any)=>assignedNames.has(m.name));
        const notDone=members.filter((m:any)=>!assignedNames.has(m.name));
        return (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            <div style={{border:"1.5px solid #d1fae5",borderRadius:14,overflow:"hidden"}}>
              <div style={{background:"#f0fdf4",padding:"10px 14px",fontWeight:700,fontSize:12,color:"#059669",display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Assigned <span style={{opacity:.6,fontWeight:500}}>({done.length})</span>
              </div>
              {done.length===0?<div style={{padding:"12px 14px",fontSize:12,color:"#bbb"}}>No agents assigned yet</div>:done.map((m:any)=>{
                const cnt=contacts.filter((c:any)=>c.salesAgent===m.name).length;
                return <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderTop:"1px solid #f0fdf4",fontSize:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:7,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div><span style={{fontWeight:600}}>{m.name}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"#888"}}>{cnt} contact{cnt!==1?"s":""}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>;
              })}
            </div>
            <div style={{border:"1.5px solid #fee2e2",borderRadius:14,overflow:"hidden"}}>
              <div style={{background:"#fff1f2",padding:"10px 14px",fontWeight:700,fontSize:12,color:"#ef4444",display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                Not Assigned <span style={{opacity:.6,fontWeight:500}}>({notDone.length})</span>
              </div>
              {notDone.length===0?<div style={{padding:"12px 14px",fontSize:12,color:"#bbb"}}>All agents assigned</div>:notDone.map((m:any)=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderTop:"1px solid #fff1f2",fontSize:13}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:7,background:"#e5e5e5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#888"}}>{initials(m.name)}</div><span style={{fontWeight:600,color:"#888"}}>{m.name}</span></div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Search + filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input value={contactSearch} onChange={e=>{setContactSearch(e.target.value);setContactLimit(100);}} placeholder="🔍 Search name, phone, store…" style={{flex:1,minWidth:160,border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 12px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
        {filterDefs.map(fd=>{
          const active=contactFilters[fd.key]||[]; const isOpen=activeFilterDropdown===fd.key;
          if(!fd.options.length) return null;
          return (
            <div key={fd.key} style={{position:"relative"}}>
              <button onClick={()=>setActiveFilterDropdown(isOpen?null:fd.key)} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${active.length?"#1a56db":"#e5e5e5"}`,background:active.length?"#eff6ff":"#fff",color:active.length?"#1a56db":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                {fd.label}{active.length?<span style={{background:"#1a56db",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:800}}>{active.length}</span>:null} ▾
              </button>
              {isOpen&&(
                <><div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setActiveFilterDropdown(null)}/>
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"#fff",border:"1.5px solid #e5e5e5",borderRadius:12,padding:"6px 0",boxShadow:"0 8px 24px rgba(0,0,0,.12)",minWidth:180}}>
                  <div style={{padding:"4px 12px 8px",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:.5}}>{fd.label}</span>
                    {active.length>0&&<button onClick={()=>setContactFilters(prev=>({...prev,[fd.key]:[]}))} style={{fontSize:11,color:"#1a56db",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Clear</button>}
                  </div>
                  {fd.options.map(opt=>{
                    const checked=active.includes(opt.val);
                    return (
                      <label key={opt.val} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",cursor:"pointer",fontSize:13,color:"#333"}} onMouseEnter={e=>(e.currentTarget.style.background="#f9f9f9")} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                        <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${checked?"#1a56db":"#ccc"}`,background:checked?"#1a56db":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {checked&&<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{flex:1}}>{opt.label}</span>
                        <span style={{fontSize:11,color:"#aaa"}}>{contacts.filter((c:any)=>{if(fd.key==="status")return c.status===opt.val;if(fd.key==="lead")return(c.leadStatus||"unclassified")===opt.val;if(fd.key==="campaign")return(c.campaign||"")===opt.val;if(fd.key==="agent")return(c.salesAgent||"__none__")===opt.val;if(fd.key==="tag")return(c.tags||[]).includes(opt.val);return false;}).length}</span>
                        <input type="checkbox" checked={checked} onChange={()=>toggleContactFilter(fd.key,opt.val)} style={{display:"none"}}/>
                      </label>
                    );
                  })}
                </div></>
              )}
            </div>
          );
        })}
        {/* Date filter */}
        {(()=>{
          const isOpen=activeFilterDropdown==="date"; const hasDate=!!contactDateFrom||!!contactDateTo;
          const setPreset=(from:string,to:string)=>{setContactDateFrom(from);setContactDateTo(to);setContactLimit(100);setActiveFilterDropdown(null);};
          return (
            <div style={{position:"relative"}}>
              <button onClick={()=>setActiveFilterDropdown(isOpen?null:"date")} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${hasDate?"#1a56db":"#e5e5e5"}`,background:hasDate?"#eff6ff":"#fff",color:hasDate?"#1a56db":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                Date{hasDate?<span style={{background:"#1a56db",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:800}}>✓</span>:null} ▾
              </button>
              {isOpen&&(
                <><div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setActiveFilterDropdown(null)}/>
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"#fff",border:"1.5px solid #e5e5e5",borderRadius:12,padding:"10px 14px",boxShadow:"0 8px 24px rgba(0,0,0,.12)",minWidth:220,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:.5}}>Last Touched</span>
                    {hasDate&&<button onClick={()=>{setContactDateFrom("");setContactDateTo("");setContactLimit(100);}} style={{fontSize:11,color:"#1a56db",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Clear</button>}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[["Today",todayKey(),todayKey()],["Yesterday",addDays(todayKey(),-1),addDays(todayKey(),-1)],["This Week",addDays(todayKey(),-6),todayKey()],["This Month",addDays(todayKey(),-29),todayKey()]].map(([label,from,to])=>(
                      <button key={label} onClick={()=>setPreset(from,to)} style={{padding:"5px 10px",borderRadius:7,border:`1.5px solid ${contactDateFrom===from&&contactDateTo===to?"#1a56db":"#e5e5e5"}`,background:contactDateFrom===from&&contactDateTo===to?"#eff6ff":"#fff",color:contactDateFrom===from&&contactDateTo===to?"#1a56db":"#555",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:6,borderTop:"1px solid #f0f0f0"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"#888",width:28}}>From</span><input type="date" value={contactDateFrom} onChange={e=>{setContactDateFrom(e.target.value);setContactLimit(100);}} style={{flex:1,border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/></div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"#888",width:28}}>To</span><input type="date" value={contactDateTo} onChange={e=>{setContactDateTo(e.target.value);setContactLimit(100);}} style={{flex:1,border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/></div>
                  </div>
                </div></>
              )}
            </div>
          );
        })()}
        <select value={contactSort} onChange={e=>setContactSort(e.target.value)} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 11px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff",color:"#555",cursor:"pointer"}}>
          <option value="status">Sort: Status</option><option value="queue">🔥 Priority Queue</option><option value="name">A → Z</option><option value="newest">Newest First</option><option value="stale">Most Stale</option><option value="hot">Hot Leads First</option><option value="score">⭐ Score</option><option value="dealValue">💰 Deal Value</option>
        </select>
        {anyActive&&<button onClick={clearContactFilters} style={{padding:"7px 12px",borderRadius:9,border:"1.5px solid #e5e5e5",background:"#fff",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Clear all</button>}
        {isManager&&<button onClick={openDedupModal} style={{padding:"7px 14px",borderRadius:9,border:"1.5px solid #7c3aed",background:"#f5f3ff",color:"#7c3aed",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Find Duplicates</button>}
        <button onClick={()=>setShowAddContactModal(true)} style={{padding:"7px 14px",borderRadius:9,border:"1.5px solid #059669",background:"#f0fdf4",color:"#059669",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Contact</button>
      </div>

      {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No contacts match your filters.</div>}

      {/* Contact rows */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {filtered.slice(0,contactLimit).map((c:any)=>(
          <ContactRow key={c.id} c={c} isOpen={openContactId===c.id} isSelected={selectedContactIds.has(c.id)} selectMode={contactSelectMode} isManager={isManager} members={members}
            onToggle={handleContactToggle} onSelect={handleContactSelect} onSalesAgent={updateContactSalesAgent} onLeadStatus={updateContactLeadStatus}
            onStatus={updateContactStatus} onCallbackDate={updateContactCallbackDate} onUpdate={updateContactField} onAddNote={addContactNote}
            authorName={authorName} onDelete={deleteContactCb} onToast={showToast} waTemplates={waTemplates} qaTemplates={Array.isArray(qaTemplates) ? qaTemplates : []}/>
        ))}
      </div>
      {filtered.length>contactLimit&&(
        <button onClick={()=>setContactLimit(l=>l+100)} style={{width:"100%",padding:"11px",borderRadius:10,border:"1.5px solid #e5e5e5",background:"#fafafa",color:"#555",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
          Show {Math.min(100,filtered.length-contactLimit)} more <span style={{color:"#aaa",fontWeight:400}}>({filtered.length-contactLimit} remaining)</span>
        </button>
      )}

      {/* Deletion history */}
      {deletionHistory.length>0&&(
        <div style={{marginTop:32}}>
          <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Recently Deleted</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {deletionHistory.map(h=>{
              const ago=Math.round((Date.now()-h.timestamp)/60000);
              const agoStr=ago<1?"just now":ago===1?"1 min ago":`${ago} min ago`;
              return (
                <div key={h.hid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",border:"1.5px solid #f0f0f0",borderRadius:12,fontSize:13}}>
                  <div><span style={{fontWeight:600}}>{h.label}</span><span style={{color:"#aaa",marginLeft:8,fontSize:12}}>{agoStr}</span></div>
                  <button onClick={()=>undoDelete(h.hid)} style={{padding:"5px 14px",borderRadius:8,border:"1.5px solid #1a56db",background:"#fff",color:"#1a56db",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Undo</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedup modal */}
      {showDedupModal&&dedupGroups.length>0&&(()=>{
        const group=dedupGroups[dedupIdx]||[];
        const PRIORITY:any={interested:3,callback:2,contacted:1};
        return (
          <div className="modal-overlay" onClick={()=>setShowDedupModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:500}}>
              <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>Duplicate Phone Found</div>
              <div style={{fontSize:13,color:"#888",marginBottom:4}}>Group {dedupIdx+1} of {dedupGroups.length} · {group.length} contacts share the same phone number</div>
              <div style={{fontSize:12,color:"#1a56db",marginBottom:18,fontWeight:600}}>{group[0]?.phone}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {group.map((contact:any)=>{
                  const sm=CONTACT_STATUS_META[contact.status]||CONTACT_STATUS_META.contacted;
                  const isWinner=(PRIORITY[contact.status]||0)===Math.max(...group.map((x:any)=>PRIORITY[x.status]||0));
                  return (
                    <div key={contact.id} style={{border:`2px solid ${isWinner?"#059669":"#ebebeb"}`,borderRadius:12,padding:"12px 14px",background:isWinner?"#f0fdf4":"#fafafa"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{fontWeight:700,fontSize:14}}>{contact.name||"Unknown"}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          {isWinner&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"#dcfce7",padding:"2px 7px",borderRadius:20}}>Suggested keep</span>}
                          <span style={{fontSize:11,fontWeight:700,color:sm.color,background:sm.bg,padding:"2px 8px",borderRadius:20}}>{sm.label}</span>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#888",marginBottom:8}}>{contact.phone} · {contact.campaign||"No campaign"} · {contact.salesAgent||"Unassigned"}</div>
                      <button onClick={()=>mergeDedupContacts(contact.id,group.filter((x:any)=>x.id!==contact.id).map((x:any)=>x.id))} className="primary-btn" style={{padding:"6px 14px",fontSize:12}}>Keep this one</button>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setDedupIdx(i=>Math.min(i+1,dedupGroups.length-1))} className="ghost-btn" style={{flex:1}}>Skip this group</button>
                <button onClick={()=>setShowDedupModal(false)} className="ghost-btn" style={{flex:1}}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add contact modal */}
      {showAddContactModal&&(
        <div className="modal-overlay" onClick={()=>setShowAddContactModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>Add Contact</div>
            <div style={{fontSize:13,color:"#888",marginBottom:18}}>Manually add a single contact to your list</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input autoFocus placeholder="Name *" value={addContactForm.name} onChange={e=>setAddContactForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addContactManually()} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
              <input placeholder="Phone *" value={addContactForm.phone} onChange={e=>setAddContactForm(f=>({...f,phone:e.target.value}))} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
              <input placeholder="Email (optional)" type="email" value={addContactForm.email} onChange={e=>setAddContactForm(f=>({...f,email:e.target.value}))} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:5}}>Call Status</div>
                  <select value={addContactForm.status} onChange={e=>setAddContactForm(f=>({...f,status:e.target.value}))} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                    <option value="contacted">Contacted</option><option value="callback">Callback</option><option value="interested">Interested</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:5}}>Campaign</div>
                  <input placeholder="Campaign name" value={addContactForm.campaign} onChange={e=>setAddContactForm(f=>({...f,campaign:e.target.value}))} list="campaign-list" style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                  <datalist id="campaign-list">{contactCampaigns.map(cp=><option key={cp} value={cp}/>)}</datalist>
                </div>
              </div>
              {isManager&&members.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:5}}>Assign to Agent</div>
                  <select value={addContactForm.salesAgent} onChange={e=>setAddContactForm(f=>({...f,salesAgent:e.target.value}))} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                    <option value="">Unassigned</option>{members.map((m:any)=><option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:5}}>Remarks</div>
                <input placeholder="Optional notes…" value={addContactForm.remarks} onChange={e=>setAddContactForm(f=>({...f,remarks:e.target.value}))} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"8px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button className="ghost-btn" style={{flex:1}} onClick={()=>setShowAddContactModal(false)}>Cancel</button>
              <button className="primary-btn" style={{flex:1}} onClick={addContactManually} disabled={!addContactForm.name.trim()&&!addContactForm.phone.trim()}>Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk reassign modal */}
      {showBulkReassignModal&&(
        <div className="modal-overlay" onClick={()=>setShowBulkReassignModal(false)}>
          <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:6,letterSpacing:-.3}}>Reassign Contacts</div>
            <div style={{fontSize:13,color:"#555",marginBottom:16,lineHeight:1.6}}>Reassign <strong>{bulkReassignIds.size}</strong> selected contact{bulkReassignIds.size!==1?"s":""} to:</div>
            <select value={bulkReassignTarget} onChange={e=>setBulkReassignTarget(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e5e5e5",fontSize:14,fontFamily:"inherit",marginBottom:16,outline:"none",background:"#fff"}}>
              <option value="">— Select agent —</option>{members.map((m:any)=><option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <div style={{display:"flex",gap:10}}>
              <button className="ghost-btn" style={{flex:1}} onClick={()=>setShowBulkReassignModal(false)}>Cancel</button>
              <button className="primary-btn" style={{flex:1,opacity:bulkReassignTarget?1:.4,cursor:bulkReassignTarget?"pointer":"not-allowed"}} disabled={!bulkReassignTarget} onClick={bulkReassignContacts}>Reassign</button>
            </div>
          </div>
        </div>
      )}

      {/* Distribute modal */}
      {showAssignModal&&(()=>{
        const pool=contacts.filter((c:any)=>!(assignFromUnassigned&&c.salesAgent)&&(!assignCampaignFilter||c.campaign===assignCampaignFilter));
        const selectedList=members.filter((m:any)=>assignSelectedMembers.has(m.id));
        const customTotal=Object.entries(assignCounts).filter(([id])=>assignSelectedMembers.has(id)).reduce((s,[,v])=>s+(parseInt(v)||0),0);
        const perMember=selectedList.length>0?Math.ceil(pool.length/selectedList.length):0;
        return (
          <div className="modal-overlay" onClick={()=>setShowAssignModal(false)}>
            <div className="confirm-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440,width:"100%"}}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:12,letterSpacing:-.3}}>⚡ Distribute Contacts</div>
              <div style={{display:"flex",gap:6,marginBottom:16,background:"#f5f5f5",borderRadius:10,padding:4}}>
                {([["even","🎲 Even Split"],["custom","🔢 Custom Count"]] as const).map(([mode,label])=>(
                  <button key={mode} onClick={()=>setAssignMode(mode)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:assignMode===mode?"#fff":"transparent",color:assignMode===mode?"#111":"#888",boxShadow:assignMode===mode?"0 1px 4px rgba(0,0,0,.08)":"none",transition:"all .12s"}}>{label}</button>
                ))}
              </div>
              <div style={{fontSize:13,color:"#555",marginBottom:14,lineHeight:1.5}}>
                {assignMode==="even"?"Select members — contacts will be split as evenly as possible among them.":"Select members and set exactly how many contacts each one receives."}
              </div>
              {contactCampaigns.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:6}}>Campaign</div>
                  <select value={assignCampaignFilter} onChange={e=>setAssignCampaignFilter(e.target.value)} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                    <option value="">All campaigns</option>{contactCampaigns.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}>
                <input type="checkbox" checked={assignFromUnassigned} onChange={e=>setAssignFromUnassigned(e.target.checked)} style={{width:15,height:15,cursor:"pointer"}}/>
                Only distribute contacts with no agent yet
              </label>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {members.map((m:any)=>{
                  const selected=assignSelectedMembers.has(m.id); const evenPreview=selected&&assignMode==="even"?perMember:null;
                  return (
                    <div key={m.id} onClick={()=>setAssignSelectedMembers(prev=>{const n=new Set(prev);n.has(m.id)?n.delete(m.id):n.add(m.id);return n;})} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1.5px solid ${selected?"#1a56db":"#e5e5e5"}`,background:selected?"#f0f6ff":"#fafafa",cursor:"pointer",transition:"all .12s"}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${selected?"#1a56db":"#ccc"}`,background:selected?"#1a56db":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{selected&&<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                      <div style={{width:26,height:26,borderRadius:7,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(m.name)}</div>
                      <span style={{flex:1,fontSize:13,fontWeight:600}}>{m.name}</span>
                      {assignMode==="even"&&evenPreview!==null&&<span style={{fontSize:12,color:"#1a56db",fontWeight:700,background:"#e8efff",padding:"2px 8px",borderRadius:20}}>~{evenPreview}</span>}
                      {assignMode==="custom"&&selected&&<input type="number" min="0" placeholder="0" value={assignCounts[m.id]||""} onClick={e=>e.stopPropagation()} onChange={e=>setAssignCounts(prev=>({...prev,[m.id]:e.target.value}))} style={{width:65,border:"1.5px solid #1a56db",borderRadius:8,padding:"4px 8px",fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center",background:"#fff"}}/>}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12,color:"#888",background:"#f9f9f9",borderRadius:9,padding:"9px 12px",marginBottom:assignMode==="custom"&&customTotal>pool.length?8:16}}>
                <span>Pool: <strong>{pool.length}</strong> contacts</span><span style={{margin:"0 10px"}}>·</span>
                <span>Selected: <strong>{selectedList.length}</strong> member{selectedList.length!==1?"s":""}</span>
                {assignMode==="custom"&&<><span style={{margin:"0 10px"}}>·</span><span>To assign: <strong>{customTotal}</strong></span></>}
              </div>
              {assignMode==="custom"&&customTotal>pool.length&&<div style={{fontSize:12,color:"#b45309",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:9,padding:"8px 12px",marginBottom:16}}>⚠ Total exceeds available contacts by <strong>{customTotal-pool.length}</strong>. Only the first <strong>{pool.length}</strong> will be assigned.</div>}
              <div style={{display:"flex",gap:10}}>
                <button className="ghost-btn" style={{flex:1}} onClick={()=>setShowAssignModal(false)}>Cancel</button>
                <button className="primary-btn" style={{flex:1,opacity:selectedList.length?1:.4,cursor:selectedList.length?"pointer":"not-allowed"}} disabled={!selectedList.length} onClick={assignContactsRandomly}>{assignMode==="even"?"Distribute Evenly":"Distribute"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending import modal */}
      {pendingImport&&(
        <div className="modal-overlay" onClick={()=>setPendingImport(null)}>
          <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:6,letterSpacing:-.3}}>Name this Campaign</div>
            <div style={{fontSize:13,color:"#555",marginBottom:16,lineHeight:1.6}}>Give this import a campaign name so you can filter contacts by it later.</div>
            <input autoFocus className="text-input" placeholder="e.g. April 2026 Outreach" value={pendingCampaignName} onChange={e=>setPendingCampaignName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&pendingCampaignName.trim()){importContactsFromCSV(pendingImport.file,pendingCampaignName.trim());setPendingImport(null);}}} style={{marginBottom:16}}/>
            <div style={{display:"flex",gap:10}}>
              <button className="ghost-btn" style={{flex:1}} onClick={()=>setPendingImport(null)}>Cancel</button>
              <button className="primary-btn" style={{flex:1,opacity:pendingCampaignName.trim()?1:.4,cursor:pendingCampaignName.trim()?"pointer":"not-allowed"}} onClick={()=>{if(pendingCampaignName.trim()){importContactsFromCSV(pendingImport.file,pendingCampaignName.trim());setPendingImport(null);}}}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
