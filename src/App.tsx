import React, { useState, useRef, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import { CSS } from "./styles";
import { initials, uid, todayKey, weekStart, addDays, fmt, dayName, fmtNoteTime, scoreContact, touchedOn } from "./lib/utils";
import { hashPin, safeCopy } from "./lib/security";
import { saveLocalContacts, upsertContact, upsertContacts, deleteRemoteContacts } from "./lib/contacts-db";
import { AVATAR_COLORS, BRAND, TASK_TYPES, CONTACT_STATUS_META, CONTACT_LEAD_META, PIPELINE_COLS } from "./lib/constants";
import { parseContactsCSV } from "./lib/csv-import";
import { getExportDates, buildTelesalesRows, buildWhatsappRows, buildGeneralRows, getPreviewRows, buildPerformanceSummary } from "./lib/export-data";
import { generatePDF } from "./lib/pdf-export";
import { Counter } from "./components/Counter";
import { TargetBar } from "./components/TargetBar";
import { ContactRow } from "./components/ContactRow";
import { PipelineCard } from "./components/PipelineCard";
import { LoginScreen } from "./components/LoginScreen";
import { AppShell } from "./components/AppShell";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";
import { useSync } from "./hooks/useSync";
import { useContacts } from "./hooks/useContacts";
import { MembersPage } from "./pages/MembersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { MyStatsPage } from "./pages/MyStatsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { StatsPage } from "./pages/StatsPage";

//  Main App
export default function App() {
  const [page, setPage]               = useState("daily");
  const [currentDate, setCurrentDate] = useState(todayKey);
  const [selectedTaskId, setSelectedTaskId] = useState<string|null>(null);
  const [weekOffset, setWeekOffset]   = useState(0);
  const [weeklyTab, setWeeklyTab]     = useState("telesales");
  const [exportTab, setExportTab]     = useState("telesales");
  const [exportRange, setExportRange] = useState("week");
  const [modal, setModal]             = useState<string|null>(null);
  const [newTaskType, setNewTaskType] = useState("telesales");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMemberIds, setNewTaskMemberIds] = useState<string[]>([]);
  const [newTaskLinkedCampaign, setNewTaskLinkedCampaign] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [campaignInput, setCampaignInput] = useState("");
  const [campaignTargetId, setCampaignTargetId] = useState<string|null>(null);
  const [confirmModal, setConfirmModal]           = useState<{type:string;id:string;title:string}|null>(null);
  const [sidebarOpen, setSidebarOpen]             = useState(true);
  const [scriptOpen, setScriptOpen]               = useState(false);
  const [leadsOpen, setLeadsOpen]                 = useState(false);
  const [contactSearch, setContactSearch]         = useState("");
  const [contactFilters, setContactFilters]       = useState<Record<string,string[]>>({status:[],lead:[],campaign:[],agent:[],tag:[]});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string|null>(null);
  const [contactSelectMode, setContactSelectMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSort, setContactSort]             = useState("status");
  const [contactLimit, setContactLimit]           = useState(100);
  const [contactDateFrom, setContactDateFrom]     = useState("");
  const [contactDateTo, setContactDateTo]         = useState("");
  const [statsTab, setStatsTab]                   = useState<"agents"|"campaigns"|"funnel"|"log"|"activity">("agents");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [addContactForm, setAddContactForm]       = useState({name:"",phone:"",email:"",status:"contacted",campaign:"",salesAgent:"",remarks:""});
  const [showDedupModal, setShowDedupModal]       = useState(false);
  const [dedupGroups, setDedupGroups]             = useState<any[][]>([]);
  const [dedupIdx, setDedupIdx]                   = useState(0);
  const [showAssignModal, setShowAssignModal]     = useState(false);
  const [assignCounts, setAssignCounts]           = useState<Record<string,string>>({});
  const [assignFromUnassigned, setAssignFromUnassigned] = useState(true);
  const [assignMode, setAssignMode]               = useState<"even"|"custom">("even");
  const [assignCampaignFilter, setAssignCampaignFilter] = useState<string>("");
  const [assignSelectedMembers, setAssignSelectedMembers] = useState<Set<string>>(new Set());
  const [lastDistributionSnapshot, setLastDistributionSnapshot] = useState<{id:string,prevAgent:string|null}[]|null>(null);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignIds, setBulkReassignIds] = useState<Set<string>>(new Set());
  const [bulkReassignTarget, setBulkReassignTarget] = useState("");
  const [pendingImport, setPendingImport] = useState<{file:File}|null>(null);
  const [pendingCampaignName, setPendingCampaignName] = useState("");
  const [deletionHistory, setDeletionHistory] = useState<Array<{hid:string,label:string,contacts:any[],timestamp:number}>>([]);
  const [openContactId, setOpenContactId] = useState<string|null>(null);
  const [emailModal, setEmailModal]               = useState<{task:any}|null>(null);
  const [emailTo, setEmailTo]                     = useState("");
  const [importing, setImporting]                 = useState(false);
  const [pipelineSearch,         setPipelineSearch]        = useState("");
  const [pipelineCampaignFilter, setPipelineCampaignFilter] = useState("");
  const [pipelineAgentFilter,    setPipelineAgentFilter]   = useState("");
  const [draggingContactId,      setDraggingContactId]     = useState<string|null>(null);
  const [dragOverColumn,         setDragOverColumn]        = useState<string|null>(null);
  const [pipelineDetailId,       setPipelineDetailId]      = useState<string|null>(null);
  const [pipelineNoteText,       setPipelineNoteText]      = useState("");
  const [exporting, setExporting]                 = useState(false);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const handleLockUI = useCallback(() => { setPage("daily"); setSelectedTaskId(null); }, []);
  const { toast, toastAction, showToast } = useToast();
  const { session, profile, authLoading, profileError, isManager, handleLock } = useAuth(handleLockUI);
  const { db, setDb, updateDb, syncing, syncError, isOnline } = useSync();
  const contactsApi = useContacts();
  const { contacts, setContacts, mutateContact } = contactsApi;

  const modalRef      = useRef<HTMLInputElement>(null);
  const nextColorRef  = useRef<number>(0);

  useEffect(()=>{ if(!modal) return; const t=setTimeout(()=>modalRef.current?.focus(),60); return ()=>clearTimeout(t); },[modal]);
  useEffect(()=>{ setSelectedTaskId(null); },[currentDate]);

  const ensureDay = (db:any,date:string) => { if(!db.days) db.days={}; if(!db.days[date]) db.days[date]={tasks:[],saved:false}; };


  const isManager  = profile?.role === "manager";
  const members:any[]  = db.members||[];
  // Agents are linked to db.members[] by display name. The session's profile.name
  // resolves to a member id used by tasks/notes/stats throughout the app.
  const loggedInMemberId = useMemo(() => {
    if (!profile || isManager) return null;
    return members.find((m:any) => m.name === profile.name)?.id || null;
  }, [profile, members, isManager]);
  const settings:any   = db.settings||{};
  const callTarget = parseInt(String(settings.callTarget||0))||0;
  const intTarget  = parseInt(String(settings.intTarget||0))||0;

  // ── Contact filters — must live at top level (Rules of Hooks) ────────────
  const allContacts:any[] = contacts;
  const contactCampaigns  = useMemo(()=>Array.from(new Set(allContacts.map((c:any)=>c.campaign||"").filter(Boolean))).sort() as string[],[allContacts]);
  const contactAgentOpts  = useMemo(()=>Array.from(new Set(allContacts.map((c:any)=>c.salesAgent||"").filter(Boolean))).sort() as string[],[allContacts]);
  const contactTagOpts    = useMemo(()=>Array.from(new Set(allContacts.flatMap((c:any)=>c.tags||[]).filter(Boolean))).sort() as string[],[allContacts]);
  const toggleContactFilter = useCallback((dim:string, val:string) => { setContactFilters(prev=>{ const a=prev[dim]||[]; return {...prev,[dim]:a.includes(val)?a.filter((v:string)=>v!==val):[...a,val]}; }); setContactLimit(100); },[]);
  const clearContactFilters = useCallback(() => { setContactFilters({status:[],lead:[],campaign:[],agent:[],tag:[]}); setContactDateFrom(""); setContactDateTo(""); setContactLimit(100); },[]);
  const deferredContactSearch = useDeferredValue(contactSearch);
  const filteredContacts  = useMemo(()=>{
    const cf=contactFilters; const q=deferredContactSearch.trim().toLowerCase();
    const filtered=allContacts.filter((c:any)=>{
      if(cf.status?.length   && !cf.status.includes(c.status)) return false;
      if(cf.campaign?.length && !cf.campaign.includes(c.campaign||"")) return false;
      if(cf.agent?.length)   { const a=c.salesAgent||"__none__"; if(!cf.agent.includes(a)) return false; }
      if(cf.lead?.length)    { const l=c.leadStatus||"unclassified"; if(!cf.lead.includes(l)) return false; }
      if(cf.tag?.length)     { const ts=c.tags||[]; if(!cf.tag.some((t:string)=>ts.includes(t))) return false; }
      if(contactDateFrom && (c.lastTouched||"") < contactDateFrom) return false;
      if(contactDateTo   && (c.lastTouched||"") > contactDateTo)   return false;
      if(q && !`${c.name} ${c.phone} ${c.phone2||""} ${c.storeType||""} ${c.company||""} ${c.storeId||""} ${c.renId||""} ${c.email||""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const today=todayKey();
    const staleD=(c:any)=>c.lastTouched?Math.floor((Date.now()-new Date(c.lastTouched+"T00:00:00").getTime())/86400000):999;
    const queueScore=(c:any)=>{
      if(c.callbackDate&&c.callbackDate<today) return 100;
      if(c.callbackDate===today) return 90;
      const d=staleD(c);
      if(c.leadStatus==="hot") return 80-Math.min(d,20);
      if(c.leadStatus==="warm"&&d>3) return 60-Math.min(d,20);
      if(d>7) return 40-Math.min(d,20);
      return d>3?10:0;
    };
    const leadP:any={hot:3,warm:2,cold:1};
    return filtered.sort((a:any,b:any)=>{
      if(contactSort==="name")   return (a.name||"").localeCompare(b.name||"");
      if(contactSort==="newest") return (b.date||"").localeCompare(a.date||"");
      if(contactSort==="stale")  return staleD(b)-staleD(a);
      if(contactSort==="hot")    return (leadP[b.leadStatus]||0)-(leadP[a.leadStatus]||0);
      if(contactSort==="queue")  return queueScore(b)-queueScore(a);
      if(contactSort==="score")  return scoreContact(b)-scoreContact(a);
      return ({interested:3,callback:2,contacted:1}[b.status as string]||0)-({interested:3,callback:2,contacted:1}[a.status as string]||0);
    });
  },[allContacts,contactFilters,deferredContactSearch,contactSort]);

  // ── Pipeline hooks — top-level (Rules of Hooks) ──────────────────────────
  // Auto-computed stats for telesales tasks linked to a campaign
  const linkedTaskStats = useMemo(()=>{
    const result:Record<string,Record<string,{total:number,answered:number,notAnswered:number,interested:number}>>={};
    (db.days?.[currentDate]?.tasks||[]).filter((t:any)=>t.linkedCampaign).forEach((t:any)=>{
      result[t.id]={};
      (t.assignedMembers||[]).forEach((m:any)=>{
        const mine=contacts.filter((c:any)=>c.campaign===t.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,currentDate));
        result[t.id][m.id]={
          total:mine.length,
          answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,
          notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,
          interested:mine.filter((c:any)=>c.status==="interested").length,
        };
      });
    });
    return result;
  },[contacts,db.days,currentDate]);

  const pipelineBase = useMemo(()=>{
    const q = pipelineSearch.trim().toLowerCase();
    return allContacts.filter((c:any)=>{
      if(pipelineCampaignFilter && c.campaign !== pipelineCampaignFilter) return false;
      if(pipelineAgentFilter && (c.salesAgent||"__none__") !== pipelineAgentFilter) return false;
      if(q && !`${c.name} ${c.phone} ${c.storeType||""} ${c.company||""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  },[allContacts,pipelineSearch,pipelineCampaignFilter,pipelineAgentFilter]);

  const handlePipelineDragStart = useCallback((e:React.DragEvent,contactId:string)=>{
    setDraggingContactId(contactId);
    e.dataTransfer.effectAllowed="move";
  },[]);
  const handlePipelineDragOver = useCallback((e:React.DragEvent,col:string)=>{
    e.preventDefault();
    setDragOverColumn(col);
  },[]);
  const handlePipelineDragEnd = useCallback(()=>{ setDraggingContactId(null); setDragOverColumn(null); },[]);
  const handlePipelineCardClick = useCallback((id:string)=>setPipelineDetailId(id),[]);

  // Browser notification on sign-in: warn manager about callbacks due today
  const sessionId = session?.user.id;
  useEffect(() => {
    if (!sessionId || !("Notification" in window)) return;
    const notify = () => {
      const due = contacts.filter((c:any) => c.callbackDate === todayKey()).length;
      if (due > 0) new Notification("blurB — Callbacks Due Today", { body: `${due} callback${due!==1?"s":""} scheduled for today`, icon: "/vite.svg" });
    };
    if (Notification.permission === "granted") notify();
    else if (Notification.permission !== "denied") Notification.requestPermission().then(p => { if (p === "granted") notify(); });
  }, [sessionId, contacts]);

  const openDedupModal = useCallback(()=>{
    const strip=(p:string)=>p.replace(/[\s\-()+.]/g,"").toLowerCase();
    const map:Record<string,any[]>={};
    (allContacts as any[]).forEach((c:any)=>{ const k=c.phone?strip(c.phone):null; if(!k)return; if(!map[k])map[k]=[]; map[k].push(c); });
    const groups=Object.values(map).filter(g=>g.length>1);
    if(!groups.length){showToast("No duplicate phone numbers found.");return;}
    setDedupGroups(groups); setDedupIdx(0); setShowDedupModal(true);
  },[allContacts,showToast]);

  const mergeDedupContacts = useCallback((keepId:string, removeIds:string[])=>{
    const PRIORITY:any={interested:3,callback:2,contacted:1};
    setContacts(prev=>{
      const keep=prev.find((c:any)=>c.id===keepId); if(!keep) return prev;
      const merged={...keep,notes:[...(keep.notes||[])],history:[...(keep.history||[])]};
      prev.filter((c:any)=>removeIds.includes(c.id)).forEach((loser:any)=>{
        merged.notes=[...merged.notes,...(loser.notes||[])];
        merged.history=[...merged.history,...(loser.history||[])];
        if((PRIORITY[loser.status]||0)>(PRIORITY[merged.status]||0)) merged.status=loser.status;
      });
      const n=prev.filter((c:any)=>!removeIds.includes(c.id));
      const idx=n.findIndex((c:any)=>c.id===keepId); if(idx>=0) n[idx]=merged;
      saveLocalContacts(n); upsertContact(merged); deleteRemoteContacts(removeIds); return n;
    });
    showToast("Contacts merged.");
    setDedupGroups(prev=>{ const next=[...prev]; next.splice(dedupIdx,1); return next; });
    setDedupIdx(i=>Math.min(i,dedupGroups.length-2));
  },[showToast,dedupIdx,dedupGroups.length]);


  const addMember = () => {
    if(!memberInput.trim()) return;
    const id=uid(); const colorIdx=nextColorRef.current++%AVATAR_COLORS.length;
    updateDb((db:any)=>{ if(!db.members) db.members=[]; db.members.push({id,name:memberInput.trim(),colorIdx}); });
    setModal(null); setMemberInput(""); showToast(`${memberInput.trim()} added`);
  };
  const dayTasks:any[]   = db.days?.[currentDate]?.tasks||[];
  const selectedTask:any = dayTasks.find((t:any)=>t.id===selectedTaskId)||null;

  const toggleMemberSelection = (id:string) => setNewTaskMemberIds((prev:string[])=>prev.includes(id)?prev.filter((x:string)=>x!==id):[...prev,id]);

  const addTask = () => {
    if(!newTaskTitle.trim()) return;
    if(newTaskMemberIds.length===0){ showToast("Assign at least one member"); return; }
    const assigned:any[]=members.filter((m:any)=>newTaskMemberIds.includes(m.id));
    let task:any;
    if(newTaskType==="telesales") task={id:uid(),type:"telesales",title:newTaskTitle.trim(),linkedCampaign:newTaskLinkedCampaign||null,assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),memberStats:Object.fromEntries(assigned.map((m:any)=>[m.id,{total:0,answered:0,notAnswered:0,interested:0}])),remarks:""};
    else if(newTaskType==="whatsapp") task={id:uid(),type:"whatsapp",title:newTaskTitle.trim(),assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),notes:"",campaigns:[]};
    else task={id:uid(),type:"general",title:newTaskTitle.trim(),assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),memberDone:Object.fromEntries(assigned.map((m:any)=>[m.id,false])),notes:""};
    updateDb((db:any)=>{ ensureDay(db,currentDate); db.days[currentDate].tasks.push(task); });
    setSelectedTaskId(task.id); setModal(null); setNewTaskTitle(""); setNewTaskMemberIds([]); setNewTaskLinkedCampaign("");
    showToast("Task created");
  };

  const confirmRemoveTask = (taskId:string, title:string) => setConfirmModal({type:"task",id:taskId,title});
  const confirmRemoveMember = (memberId:string, name:string) => setConfirmModal({type:"member",id:memberId,title:name});

  const doRemoveTask = (taskId:string) => {
    updateDb((db:any)=>{ if(db.days?.[currentDate]?.tasks) db.days[currentDate].tasks=db.days[currentDate].tasks.filter((t:any)=>t.id!==taskId); });
    if(selectedTaskId===taskId) setSelectedTaskId(null); setConfirmModal(null); showToast("Task removed");
  };
  const doRemoveMember = (id:string) => {
    updateDb((db:any)=>{
      db.members=(db.members||[]).filter((m:any)=>m.id!==id);
      // clean up references in all days/tasks
      Object.values(db.days||{}).forEach((day:any)=>{
        (day.tasks||[]).forEach((task:any)=>{
          task.assignedMembers=(task.assignedMembers||[]).filter((m:any)=>m.id!==id);
          if(task.memberStats) delete task.memberStats[id];
          if(task.memberDone)  delete task.memberDone[id];
        });
      });
    });
    setConfirmModal(null); showToast("Member removed");
  };

  const copyTaskToDate = (task:any, targetDate:string) => {
    const existing=(db.days?.[targetDate]?.tasks||[]).some((t:any)=>t.title===task.title&&t.type===task.type);
    if(existing){ showToast("Task already exists for that day"); return; }
    const newId=uid();
    let copy:any;
    if(task.type==="telesales"){
      copy={...task,id:newId,saved:false,remarks:"",memberStats:Object.fromEntries((task.assignedMembers||[]).map((m:any)=>[m.id,{total:0,answered:0,notAnswered:0,interested:0}]))};
    } else if(task.type==="whatsapp"){
      copy={...task,id:newId,saved:false,notes:"",campaigns:[]};
    } else {
      copy={...task,id:newId,saved:false,notes:"",memberDone:Object.fromEntries((task.assignedMembers||[]).map((m:any)=>[m.id,false]))};
    }
    updateDb((db:any)=>{ ensureDay(db,targetDate); db.days[targetDate].tasks.push(copy); });
    setCurrentDate(targetDate); setSelectedTaskId(newId);
    showToast("Task copied to "+fmt(targetDate));
  };

  const pushDeletionHistory = (label:string, contacts:any[]) => {
    setDeletionHistory(h=>[{hid:crypto.randomUUID(),label,contacts:[...contacts],timestamp:Date.now()},...h.slice(0,19)]);
  };

  const deleteSelectedContacts = () => {
    const ids=selectedContactIds;
    const toDelete=contacts.filter((c:any)=>ids.has(c.id));
    if(toDelete.length) pushDeletionHistory(`${toDelete.length} contacts`,toDelete);
    setContacts(prev=>{ const n=prev.filter((c:any)=>!ids.has(c.id)); saveLocalContacts(n); deleteRemoteContacts([...ids]); return n; });
    setSelectedContactIds(new Set()); setContactSelectMode(false);
  };

  const deleteAllContacts = () => {
    const all=contacts;
    if(all.length) pushDeletionHistory(`All ${all.length} contacts`,all);
    const ids=all.map((c:any)=>c.id);
    setContacts([]); saveLocalContacts([]); deleteRemoteContacts(ids);
    setSelectedContactIds(new Set()); setContactSelectMode(false);
  };

  const undoDelete = (hid:string) => {
    const entry=deletionHistory.find(h=>h.hid===hid);
    if(!entry) return;
    setContacts(prev=>{
      const existing=new Set(prev.map((c:any)=>c.id));
      const toAdd=entry.contacts.filter((c:any)=>!existing.has(c.id));
      const n=[...prev,...toAdd]; saveLocalContacts(n); upsertContacts(toAdd); return n;
    });
    setDeletionHistory(h=>h.filter(e=>e.hid!==hid));
    showToast("Restored "+entry.label);
  };

  const updateContactSalesAgent = useCallback((contactId:string, salesAgent:string) => {
    mutateContact(contactId, c=>{ c.salesAgent=salesAgent; });
  },[mutateContact]);

  const updateContactLeadStatusCb = useCallback((contactId:string, leadStatus:string|null, author?:string) => {
    mutateContact(contactId, c=>{
      if(c.leadStatus!==leadStatus){ if(!c.history)c.history=[]; c.history.unshift({id:uid(),type:"lead",from:c.leadStatus||"none",to:leadStatus||"none",by:author||"",timestamp:`${currentDate}T12:00:00.000Z`}); }
      c.leadStatus=leadStatus; c.lastTouched=currentDate;
    });
  },[mutateContact,currentDate]);

  const updateContactStatus = useCallback((contactId:string, status:string, author?:string) => {
    // Stamp with currentDate noon UTC so history timestamps survive lastTouched overwrites
    const ts = `${currentDate}T12:00:00.000Z`;
    mutateContact(contactId, c=>{
      if(!c.history) c.history=[];
      if(c.status!==status){
        c.history.unshift({id:uid(),type:"status",from:c.status,to:status,by:author||"",timestamp:ts});
        c.status=status;
      } else {
        c.history.unshift({id:uid(),type:"call",status,by:author||"",timestamp:ts});
      }
      c.lastTouched=currentDate;
    });
  },[mutateContact,currentDate]);

  const updateContactCallbackDate = useCallback((contactId:string, callbackDate:string) => {
    mutateContact(contactId, c=>{ c.callbackDate=callbackDate; });
  },[mutateContact]);

  const updateContactField = useCallback((contactId:string, field:string, value:string) => {
    mutateContact(contactId, c=>{ c[field]=value; });
  },[mutateContact]);

  const addContactNote = useCallback((contactId:string, text:string, author:string) => {
    if(!text.trim()) return;
    mutateContact(contactId, c=>{ if(!c.notes)c.notes=[]; c.notes.unshift({id:uid(),text:text.trim(),timestamp:new Date().toISOString(),author:author||"—"}); c.lastTouched=currentDate; });
  },[mutateContact,currentDate]);

  const bulkUpdateContactStatus = useCallback((status:string, ids:Set<string>) => {
    const size=ids.size; const ts=new Date().toISOString(); const today=todayKey();
    setContacts(prev=>{
      const next=prev.map((c:any)=>{ if(!ids.has(c.id)) return c; const h={id:uid(),type:"status",from:c.status,to:status,by:"Bulk",timestamp:ts}; return {...c,status,lastTouched:today,history:[h,...(c.history||[])]}; });
      saveLocalContacts(next); upsertContacts(next.filter((c:any)=>ids.has(c.id))); return next;
    });
    setContactSelectMode(false); setSelectedContactIds(new Set());
    showToast(`Updated ${size} contact${size!==1?"s":""} to ${CONTACT_STATUS_META[status as keyof typeof CONTACT_STATUS_META]?.label||status}.`);
  },[showToast]);

  const addContactManually = useCallback(() => {
    const f=addContactForm;
    if(!f.name.trim()&&!f.phone.trim()){showToast("Name or phone is required.");return;}
    const email=f.email.trim();
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showToast("Invalid email format.");return;}
    const c={id:uid(),name:f.name.trim(),phone:f.phone.trim(),email,phone2:"",storeType:"",company:"",storeId:"",renId:"",agentName:"",date:todayKey(),campaign:f.campaign.trim(),remarks:f.remarks.trim(),status:f.status||"contacted",leadStatus:null,salesAgent:f.salesAgent||"",lastTouched:todayKey(),callbackDate:"",notes:[],history:[]};
    setContacts(prev=>{ const n=[...prev,c]; saveLocalContacts(n); upsertContact(c); return n; });
    showToast(`Contact "${f.name||f.phone}" added.`);
    setShowAddContactModal(false);
    setAddContactForm({name:"",phone:"",email:"",status:"contacted",campaign:"",salesAgent:"",remarks:""});
  },[addContactForm,showToast]);

  const handlePipelineDrop = useCallback((e:React.DragEvent,targetStatus:string)=>{
    e.preventDefault();
    setDraggingContactId(prev=>{ if(prev) updateContactStatus(prev,targetStatus); return null; });
    setDragOverColumn(null);
  },[updateContactStatus]);

  const deleteContactCb = useCallback((contactId:string) => {
    setContacts(prev=>{
      const c=prev.find((x:any)=>x.id===contactId);
      if(c) {
        const hid=crypto.randomUUID();
        setDeletionHistory(h=>[{hid,label:c.name||c.phone||"Contact",contacts:[c],timestamp:Date.now()},...h.slice(0,19)]);
        const restore = () => {
          setContacts(p => { if(p.find((x:any)=>x.id===c.id)) return p; const n=[...p,c]; saveLocalContacts(n); upsertContact(c); return n; });
          setDeletionHistory(h => h.filter(e=>e.hid!==hid));
          showToast(`Restored "${c.name||c.phone||"contact"}"`);
        };
        showToast(`Deleted "${c.name||c.phone||"contact"}"`, {label:"Undo", fn:restore});
      }
      const n=prev.filter((x:any)=>x.id!==contactId); saveLocalContacts(n); deleteRemoteContact(contactId); return n;
    });
    setSelectedContactIds(prev=>{ const n=new Set(prev); n.delete(contactId); return n; });
  },[showToast]);

  const handleContactToggle = useCallback((id:string|null)=>setOpenContactId(prev=>prev===id?null:id),[]);
  const handleContactSelect = useCallback((id:string)=>setSelectedContactIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }),[]);

  const handleReassignStale = useCallback((agentName:string) => {
    setContactFilters({status:[],lead:[],campaign:[],agent:[agentName]});
    setContactSort("stale");
    setContactSelectMode(true);
    setPage("contacts");
  },[]);

  const assignContactsRandomly = () => {
    const pool = [...contacts].filter((c:any)=>
      !(assignFromUnassigned&&c.salesAgent) &&
      (!assignCampaignFilter || c.campaign===assignCampaignFilter)
    );
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const assignments: Record<string,string> = {};
    if(assignMode==="even"){
      const selected=(db.members||[]).filter((m:any)=>assignSelectedMembers.has(m.id));
      if(!selected.length){showToast("Select at least one member to distribute to.");return;}
      selected.forEach((m:any,i:number)=>{
        const perMember=Math.ceil(pool.length/selected.length);
        const start=i*perMember; const end=Math.min(start+perMember,pool.length);
        for(let k=start;k<end;k++) assignments[pool[k].id]=m.name;
      });
    } else {
      let idx=0;
      for(const m of (db.members||[])){
        if(!assignSelectedMembers.has(m.id)) continue;
        const n=Math.max(0,parseInt(assignCounts[m.id]||"0")||0);
        for(let i=0;i<n&&idx<pool.length;i++,idx++) assignments[pool[idx].id]=m.name;
      }
    }
    const total=Object.keys(assignments).length;
    if(!total){showToast("No contacts to assign — check pool size or counts.");return;}
    const snapshot=contacts.filter((c:any)=>assignments[c.id]!==undefined).map((c:any)=>({id:c.id,prevAgent:c.salesAgent??null}));
    setLastDistributionSnapshot(snapshot);
    setContacts(prev=>{ const next=prev.map((c:any)=>assignments[c.id]?{...c,salesAgent:assignments[c.id]}:c); saveLocalContacts(next); upsertContacts(next.filter((c:any)=>assignments[c.id]!==undefined)); return next; });
    const agentCount=new Set(Object.values(assignments)).size;
    showToast(`Assigned ${total} contact${total!==1?"s":""} across ${agentCount} agent${agentCount!==1?"s":""}.`);
    setShowAssignModal(false); setAssignCounts({}); setAssignSelectedMembers(new Set());
  };

  const undoDistribution = () => {
    if(!lastDistributionSnapshot) return;
    const snap=lastDistributionSnapshot;
    const map:Record<string,string|null>={};
    snap.forEach(s=>map[s.id]=s.prevAgent);
    setContacts(prev=>{ const next=prev.map((c:any)=>c.id in map?{...c,salesAgent:map[c.id]}:c); saveLocalContacts(next); upsertContacts(next.filter((c:any)=>c.id in map)); return next; });
    setLastDistributionSnapshot(null); showToast("Distribution undone.");
  };

  const importContactsFromCSV = (file: File, campaignName: string) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const result = parseContactsCSV(text, campaignName, contacts);
      if ("error" in result) { showToast(result.error); setImporting(false); return; }

      const { contacts: imported, crossDups, skipped } = result;
      const PRIORITY: Record<string, number> = { interested: 3, callback: 2, contacted: 1 };
      const stripPhone = (p: string) => p.replace(/[\s\-()+.]/g, "").toLowerCase();

      setContacts(prev => {
        const otherCampaign = prev.filter((c: any) => c.campaign !== campaignName);
        const sameCampaign  = prev.filter((c: any) => c.campaign === campaignName);
        const existingMap: any = {};
        sameCampaign.forEach((c: any) => { const k = c.phone ? stripPhone(c.phone) : (c.name || "").toLowerCase().trim(); if (k) existingMap[k] = c; });
        imported.forEach((c: any) => { const k = c.phone ? stripPhone(c.phone) : (c.name || "").toLowerCase().trim(); const ex = existingMap[k]; if (!ex || (PRIORITY[c.status] || 0) >= (PRIORITY[ex.status] || 0)) existingMap[k] = { ...c, leadStatus: ex?.leadStatus || null }; });
        const next = [...otherCampaign, ...Object.values(existingMap)];
        saveLocalContacts(next); upsertContacts(Object.values(existingMap)); return next;
      });

      setContactLimit(100);
      showToast(`Imported ${imported.length} contact${imported.length !== 1 ? "s" : ""} into "${campaignName}"${crossDups > 0 ? ` · ${crossDups} duplicate phone${crossDups !== 1 ? "s" : ""} found in other campaigns` : ""}${skipped > 0 ? ` · ${skipped} row${skipped !== 1 ? "s" : ""} skipped (no name or phone)` : ""}.`);
      setImporting(false);
    };
    reader.onerror = () => { showToast("Failed to read file — try again."); setImporting(false); };
    reader.readAsText(file);
  };

  const updateMemberStat = (taskId:string, memberId:string, field:string, value:number) => {
    const numVal = Math.max(0,parseInt(String(value))||0);
    updateDb((db:any)=>{
      const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId);
      if(!task||!task.memberStats) return;
      const s=task.memberStats[memberId];
      if(field==="total"){
        s.total=numVal;
        if(s.answered>numVal) s.answered=numVal;
        if(s.interested>s.answered) s.interested=s.answered;
      } else if(field==="answered"){
        s.answered=Math.min(numVal,s.total);
        if(s.interested>s.answered) s.interested=s.answered;
      } else if(field==="interested"){
        s.interested=Math.min(numVal,s.answered);
      } else if(field==="notAnswered"){
        s.notAnswered=numVal;
      }
    });
  };
  const updateTaskField = (taskId:string, field:string, value:any) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!task) return; task[field]=value; });
  };
  const toggleMemberDone = (taskId:string, memberId:string) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!task||!task.memberDone) return; task.memberDone[memberId]=!task.memberDone[memberId]; });
  };

  const addCampaign = () => {
    if(!campaignInput.trim()||!campaignTargetId) return;
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===campaignTargetId); if(task) task.campaigns.push({id:uid(),name:campaignInput.trim(),sent:0,replied:0,closed:0,unresponsive:0,remarks:""}); });
    setModal(null); setCampaignInput(""); showToast("Campaign added");
  };
  const removeCampaign = (taskId:string, cId:string) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(task) task.campaigns=task.campaigns.filter((c:any)=>c.id!==cId); });
    showToast("Campaign removed");
  };
  const updateCampaignField = (taskId:string, cId:string, field:string, value:any) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!task) return; const c=task.campaigns.find((c:any)=>c.id===cId); if(!c) return; c[field]=(field==="remarks"||field==="name")?value:Math.max(0,parseInt(String(value))||0); });
  };

  const addLead = (taskId:string) => {
    updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(t){ if(!t.leads) t.leads=[]; t.leads.push({id:uid(),agentName:"",phone:"",remark:""}); } });
  };
  const updateLead = (taskId:string, leadId:string, field:string, value:string) => {
    updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!t||!t.leads) return; const l=t.leads.find((l:any)=>l.id===leadId); if(l) l[field]=value; });
  };
  const removeLead = (taskId:string, leadId:string) => {
    updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(t) t.leads=(t.leads||[]).filter((l:any)=>l.id!==leadId); });
  };

  const saveTask   = (taskId:string) => { updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(t) t.saved=true; }); showToast("Task saved"); };
  const unsaveTask = (taskId:string) => { updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(t) t.saved=false; }); };
  const updateTaskTitle = (taskId:string, newTitle:string) => { if(!newTitle.trim()) return; updateDb((db:any)=>{ const t=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(t) t.title=newTitle.trim(); }); };

  const baseMonday = weekStart(todayKey());
  const monday     = addDays(baseMonday, weekOffset*7);
  const weekDates  = Array.from({length:7},(_,i)=>addDays(monday,i));

  // ── Export helpers ────────────────────────────────────────────────────────────
  // Shared context object passed to the stateless export-data functions
  const exportCtx = { db, contacts, callTarget, intTarget, weekDates, members, isManager, loggedInMemberId };

  const exportToCSV = () => {
    const rows = getPreviewRows(exportTab, exportRange, exportCtx);
    if (rows.length === 0) { showToast("No data to export"); return; }
    setExporting(true);
    try {
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map(r => headers.map(h => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")),
      ];
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvLines.join("\n"));
      a.download = `blurb_${exportTab}_${exportRange}_${todayKey()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      showToast("CSV exported");
    } finally { setExporting(false); }
  };

  const exportFilteredContacts = (rows: any[]) => {
    if(!rows.length){ showToast("No contacts to export"); return; }
    const headers = ["name","phone","phone2","email","storeType","company","storeId","renId","campaign","status","salesAgent","lastTouched","callbackDate","remarks"];
    const csv = [headers.join(","), ...rows.map(c=>headers.map(h=>`"${String((c as any)[h]||"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download = `blurb_contacts_${todayKey()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast(`Exported ${rows.length} contacts`);
  };

  const bulkReassignContacts = () => {
    if(!bulkReassignTarget) return;
    const ids = bulkReassignIds;
    setContacts(prev=>{
      const next = prev.map(c=>ids.has(c.id)?{...c,salesAgent:bulkReassignTarget}:c);
      saveLocalContacts(next);
      upsertContacts(next.filter(c=>ids.has(c.id)));
      return next;
    });
    setShowBulkReassignModal(false); setBulkReassignIds(new Set()); setBulkReassignTarget("");
    setContactSelectMode(false); setSelectedContactIds(new Set());
    showToast(`Reassigned ${ids.size} contact${ids.size!==1?"s":""} to ${bulkReassignTarget}`);
  };

  const exportToPDF = async () => {
    const rows = getPreviewRows();
    if(rows.length===0){ showToast("No data to export"); return; }
    setExporting(true);
    showToast("Generating PDF…");
    try {
      const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
      const PW=841.89, M=40, CW=PW-M*2;
      const tabLabel = exportTab==="telesales"?"Telesales":exportTab==="whatsapp"?"WhatsApp":"General";
      const rangeLabel = exportRange==="today"?"Today":exportRange==="week"?"This Week":"Last 30 Days";

      const drawPageHeader = ():number => {
        doc.setFillColor(17,17,17); doc.rect(0,0,PW,52,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(255,255,255);
        doc.text(`blurB — ${tabLabel} Report`, M, 30);
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(160,160,160);
        doc.text(`${rangeLabel}  ·  Generated ${fmt(todayKey())}  ·  mudah.my`, M, 44);
        return 62;
      };

      if(exportTab==="telesales"){
        // Build per-date aggregated stats from contacts + tasks directly
        const touchedOn=(c:any,date:string)=>c.date===date||c.reContactDate===date;
        const dates=getExportDates(exportRange);
        type DayStat={iso:string,label:string,total:number,answered:number,notAns:number,interested:number,remarks:string[]};
        const dayStats:DayStat[]=dates.map(iso=>{
          let total=0,answered=0,notAns=0,interested=0; const remarks:string[]=[];
          ((db.days?.[iso]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
            if(task.remarks?.trim()) remarks.push(task.remarks.trim());
            ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
              let s:any;
              if(task.linkedCampaign){
                const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,iso));
                s={total:mine.length,answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,interested:mine.filter((c:any)=>c.status==="interested").length};
              } else { s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0}; }
              total+=s.total||0; answered+=s.answered||0; notAns+=s.notAnswered||0; interested+=s.interested||0;
            });
          });
          return {iso,label:fmt(iso),total,answered,notAns,interested,remarks};
        }).filter(d=>d.total>0||(db.days?.[d.iso]?.tasks?.length||0)>0);


        // Group by ISO week
        const weekMap:Map<string,DayStat[]>=new Map();
        dayStats.forEach(d=>{ const ws=weekStart(d.iso); const k=`${ws}__${fmt(ws)}`; if(!weekMap.has(k))weekMap.set(k,[]); weekMap.get(k)!.push(d); });

        let y=drawPageHeader(); let firstSection=true;
        weekMap.forEach((days,key)=>{
          const weekLabelStr=`Week of ${key.split("__")[1]}`;
          const wTotal=days.reduce((s,d)=>s+d.total,0);
          const wAnswered=days.reduce((s,d)=>s+d.answered,0);
          const wNotAns=days.reduce((s,d)=>s+d.notAns,0);
          const wInterested=days.reduce((s,d)=>s+d.interested,0);
          const ansRate=wTotal>0?Math.round(wAnswered/wTotal*100):0;
          const convRate=wAnswered>0?Math.round(wInterested/wAnswered*100):0;
          const dateRange=days.length===1?days[0].label:`${days[0].label} – ${days[days.length-1].label}`;
          const hasRemarks=days.some(d=>d.remarks.length>0);

          const estimatedH=46+78+30+30+days.length*22+(hasRemarks?18:0)+24;
          if(!firstSection&&y+estimatedH>560){ doc.addPage(); y=drawPageHeader(); }
          firstSection=false;

          // Week header bar
          doc.setFillColor(22,22,36); doc.rect(M,y,CW,46,"F");
          doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
          doc.text(weekLabelStr, M+12, y+17);
          doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(160,160,180);
          doc.text(`${dateRange} · ${days.length} day${days.length!==1?"s":""}`, M+12, y+32);

          // Calls pill
          const callHit=callTarget>0&&wTotal>=(callTarget*days.length);
          const intHit=intTarget>0&&wInterested>=(intTarget*days.length);
          const callTxt=`${wTotal}/${callTarget>0?callTarget*days.length:"—"} calls`;
          const intTxt=`${wInterested}/${intTarget>0?intTarget*days.length:"—"} interested`;
          const cTxtW=doc.getTextWidth(callTxt); const iTxtW=doc.getTextWidth(intTxt);
          const pillH=16,pillPad=8;
          const pill2X=M+CW-iTxtW-pillPad*2-4; const pill1X=pill2X-cTxtW-pillPad*2-6;
          const pillY=y+15;
          doc.setFillColor(...(callHit?[5,150,105]:[239,68,68]) as [number,number,number]); doc.rect(pill1X,pillY,cTxtW+pillPad*2,pillH,"F");
          doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,255,255);
          doc.text(callTxt,pill1X+pillPad,pillY+11);
          doc.setFillColor(...(intHit?[5,150,105]:[239,68,68]) as [number,number,number]); doc.rect(pill2X,pillY,iTxtW+pillPad*2,pillH,"F");
          doc.text(intTxt,pill2X+pillPad,pillY+11);
          y+=52;

          // 4 stat boxes
          const bW=CW/4, bH=70;
          const boxes=[
            {lbl:"TOTAL CALLS",val:String(wTotal),sub:`${days.length} day${days.length!==1?"s":""}`,rgb:[26,86,219] as [number,number,number]},
            {lbl:"ANSWERED",val:`${wAnswered}/${wTotal}`,sub:`${ansRate}% answer rate`,rgb:[30,30,30] as [number,number,number]},
            {lbl:"INTERESTED",val:`${wInterested}/${wTotal}`,sub:`${convRate}% conv. rate`,rgb:[5,150,105] as [number,number,number]},
            {lbl:"NOT ANSWERED",val:`${wNotAns}/${wTotal}`,sub:`${wTotal>0?Math.round(wNotAns/wTotal*100):0}% missed`,rgb:[220,38,38] as [number,number,number]},
          ];
          boxes.forEach((b,i)=>{
            const bx=M+i*bW;
            doc.setFillColor(248,249,250); doc.rect(bx,y,bW,bH,"F");
            doc.setDrawColor(225,225,225); doc.rect(bx,y,bW,bH);
            doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(160,160,160);
            doc.text(b.lbl,bx+10,y+14);
            doc.setFont("helvetica","bold"); doc.setFontSize(17); doc.setTextColor(...b.rgb);
            doc.text(b.val,bx+10,y+40);
            doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(110,110,110);
            doc.text(b.sub,bx+10,y+56);
          });
          y+=bH+6;

          // Progress bars
          const barH=7, labelW=72, pctW=30;
          [[`Answer rate`,ansRate,[16,185,129]] as const,[`Conv. rate`,convRate,[217,119,6]] as const].forEach(([lbl,pct,rgb])=>{
            doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(90,90,90);
            doc.text(lbl,M,y+barH-1);
            const trackX=M+labelW, trackW=CW-labelW-pctW;
            doc.setFillColor(230,230,230); doc.rect(trackX,y,trackW,barH,"F");
            const fillW=Math.max(0,Math.min(1,pct/100))*trackW;
            doc.setFillColor(...rgb as [number,number,number]); doc.rect(trackX,y,fillW,barH,"F");
            doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(30,30,30);
            doc.text(`${pct}%`,M+CW-pctW+4,y+barH-1);
            y+=barH+7;
          });
          y+=4;

          // Per-day + per-member rows
          type MemberDayRow={date:string,member:string,total:number,answered:number,notAns:number,interested:number,remarks:string};
          const memberRows:MemberDayRow[]=[];
          days.forEach(d=>{
            ((db.days?.[d.iso]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
              ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
                let s:any;
                if(task.linkedCampaign){
                  const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,d.iso));
                  s={total:mine.length,answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,interested:mine.filter((c:any)=>c.status==="interested").length};
                } else { s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0}; }
                memberRows.push({date:d.label,member:m.name,total:s.total||0,answered:s.answered||0,notAns:s.notAnswered||0,interested:s.interested||0,remarks:task.remarks?.trim()||""});
              });
            });
          });
          const hasRemarks2=memberRows.some(r=>r.remarks);
          const head=["DATE","MEMBER","TOTAL","ANSWERED","NOT ANS.","INTERESTED",...(hasRemarks2?["REMARKS"]:[])];
          const body=memberRows.map(r=>{
            const aR=r.total>0?Math.round(r.answered/r.total*100):0;
            const cR=r.answered>0?Math.round(r.interested/r.answered*100):0;
            const row=[r.date,r.member,String(r.total),`${r.answered}/${r.total} ${aR}%`,String(r.notAns),`${r.interested}/${r.answered} ${cR}%`];
            if(hasRemarks2) row.push(r.remarks||"—");
            return row;
          });
          autoTable(doc,{
            head:[head],body,startY:y,
            styles:{fontSize:8,cellPadding:5,textColor:[30,30,30]},
            headStyles:{fillColor:[40,40,60],textColor:[255,255,255],fontStyle:"bold",fontSize:7},
            alternateRowStyles:{fillColor:[249,249,252]},
            columnStyles:{0:{fontStyle:"bold"},1:{fontStyle:"bold"},...(hasRemarks2?{6:{cellWidth:110}}:{})},
            margin:{left:M,right:M},tableWidth:"auto",
          });
          y=(doc as any).lastAutoTable.finalY+22;
        });

        if(dayStats.length===0){
          let y2=drawPageHeader();
          doc.setFont("helvetica","normal"); doc.setFontSize(12); doc.setTextColor(160,160,160);
          doc.text("No telesales data found for this period.", M, y2+40);
        }

      } else {
        // WhatsApp / General: flat table
        let y=drawPageHeader();
        const headers=Object.keys(rows[0]);
        autoTable(doc,{
          head:[headers],
          body:rows.map((r:any)=>headers.map(h=>String(r[h]??""))),
          startY:y,
          styles:{fontSize:7,cellPadding:4,textColor:[30,30,30]},
          headStyles:{fillColor:[17,17,17],textColor:[255,255,255],fontStyle:"bold",fontSize:7},
          alternateRowStyles:{fillColor:[249,249,249]},
          margin:{left:M,right:M},tableWidth:"auto",
        });
      }

      doc.save(`blurb_${exportTab}_${exportRange}_${todayKey()}.pdf`);
      showToast("PDF exported");
    } catch(e) {
      console.error(e);
      showToast("PDF export failed");
    } finally { setExporting(false); }
  };

  //  Overall performance summary (for export page)
  const buildPerformanceSummary = () => {
    const touchedOn=(c:any,date:string)=>c.date===date||c.reContactDate===date;
    const ranges:{[k:string]:string[]} = { today: getExportDates("today"), week: weekDates, month: getExportDates("month") };
    return members.map((member:any) => {
      const stats:any = {};
      Object.entries(ranges).forEach(([range, dates]) => {
        let total=0,answered=0,interested=0,sent=0,replied=0,closed=0;
        dates.forEach((date:string)=>{
          ((db.days?.[date]?.tasks||[]) as any[]).forEach((task:any)=>{
            const assigned=((task.assignedMembers||[]) as any[]).some((m:any)=>m.id===member.id);
            if(!assigned) return;
            if(task.type==="telesales"){
              if(task.linkedCampaign){
                const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===member.name&&touchedOn(c,date));
                total+=mine.length;
                answered+=mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length;
                interested+=mine.filter((c:any)=>c.status==="interested").length;
              } else {
                const s=task.memberStats?.[member.id]||{};
                total+=s.total||0; answered+=s.answered||0; interested+=s.interested||0;
              }
            }
            if(task.type==="whatsapp"){
              ((task.campaigns||[]) as any[]).forEach((c:any)=>{ sent+=c.sent||0; replied+=c.replied||0; closed+=c.closed||0; });
            }
          });
        });
        stats[range]={total,answered,interested,sent,replied,closed,
          aRate:total>0?Math.round(answered/total*100):0,
          replyRate:sent>0?Math.round(replied/sent*100):0,
          closeRate:replied>0?Math.round(closed/replied*100):0,
          targetHit:callTarget>0&&total>=(callTarget*dates.length)};
      });
      return { member, stats };
    });
  };

  const buildEmailBody = (task:any) => {
    const assigned:any[] = task.assignedMembers||[];
    const lines:string[] = [];
    lines.push(`blurB — ${task.title}`);
    lines.push(`Date: ${fmt(currentDate)}`);
    lines.push("═".repeat(36));
    lines.push("");
    lines.push("MEMBER STATS");
    lines.push("─".repeat(36));
    assigned.forEach((m:any,i:number)=>{
      const s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0};
      const aRate=s.total>0?Math.round(s.answered/s.total*100):0;
      const cRate=s.answered>0?Math.round(s.interested/s.answered*100):0;
      lines.push(`${i+1}. ${m.name.padEnd(14)} Total: ${s.total} | Answered: ${s.answered} | Not Ans: ${s.notAnswered} | Interested: ${s.interested} | Answer Rate: ${aRate}% | Conv Rate: ${cRate}%`);
    });
    const leads:any[] = task.leads||[];
    if(leads.length>0){
      lines.push("");
      lines.push("POTENTIAL LEADS");
      lines.push("─".repeat(36));
      leads.forEach((l:any,i:number)=>{
        lines.push(`${i+1}. ${l.agentName||"—"}  |  ${l.phone||"—"}  |  ${l.remark||"—"}`);
      });
    }
    return lines.join("\n");
  };

  const sendEmail = (task:any) => {
    const subject = encodeURIComponent(`blurB Report — ${task.title} (${fmt(currentDate)})`);
    const body    = encodeURIComponent(buildEmailBody(task));
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailTo.trim())}&su=${subject}&body=${body}`,"_blank");
    setEmailModal(null); setEmailTo("");
  };

  //  Weekly campaign summary per member
  const getMemberCampaignWeek = (memberId:string) => {
    return weekDates.map((date:string) => {
      let sent=0,replied=0,closed=0,unresponsive=0;
      ((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="whatsapp"&&((t.assignedMembers||[]) as any[]).some((m:any)=>m.id===memberId)).forEach((task:any)=>{
        ((task.campaigns||[]) as any[]).forEach((c:any)=>{ sent+=c.sent||0; replied+=c.replied||0; closed+=c.closed||0; unresponsive+=c.unresponsive||0; });
      });
      return {sent,replied,closed,unresponsive};
    });
  };

  //  Render helpers 
  const MemberAvatarRow = ({ assignedMembers }:{assignedMembers:any[]}) => (
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}> {(assignedMembers||[]).map((m:any)=>(
        <div key={m.id} title={m.name} style={{width:26,height:26,borderRadius:8,background:AVATAR_COLORS[m.colorIdx||0][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> ))}
    </div> );

  const renderTelesales = (task:any) => {
    const assigned=task.assignedMembers||[];
    const isLinked=!!task.linkedCampaign;
    const isSheetSync=task.id.startsWith("sheet-sync-")||isLinked;
    const getStats=(memberId:string)=>isLinked?(linkedTaskStats[task.id]?.[memberId]||{total:0,answered:0,notAnswered:0,interested:0}):(task.memberStats?.[memberId]||{total:0,answered:0,notAnswered:0,interested:0});
    const totals=(assigned as any[]).reduce((a:any,m:any)=>{ const s=getStats(m.id); return {total:a.total+s.total,answered:a.answered+s.answered,notAnswered:a.notAnswered+s.notAnswered,interested:a.interested+s.interested}; },{total:0,answered:0,notAnswered:0,interested:0});
    const aRate=totals.total>0?Math.round(totals.answered/totals.total*100):0;
    const cRate=totals.answered>0?Math.round(totals.interested/totals.answered*100):0;
    return (
      <div className="card fade-up"> <div style={{padding:"18px 20px",borderBottom:"1px solid #f0f0f0"}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}> <div style={{flex:1,minWidth:0}}>{isSheetSync?<div style={{fontWeight:800,fontSize:16,letterSpacing:-.3,marginBottom:6}}>{task.title}</div>:<input className="title-input" defaultValue={task.title} onBlur={e=>updateTaskTitle(task.id,e.target.value)} placeholder="Task title..."/>}<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}><MemberAvatarRow assignedMembers={assigned}/>{isLinked&&<span style={{fontSize:10,fontWeight:700,color:"#7c3aed",background:"#f5f3ff",padding:"2px 8px",borderRadius:20,border:"1px solid #ddd6fe"}}>📊 {task.linkedCampaign}</span>}{!isLinked&&task.id.startsWith("sheet-sync-")&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"#ecfdf5",padding:"2px 8px",borderRadius:20,border:"1px solid #a7f3d0"}}>Synced from Sheet</span>}</div></div> <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}> <div style={{display:"flex",gap:5,flexWrap:"wrap"}}> <span className="stat-badge" style={{background:"#f0fdf4",color:"#15803d"}}>Ans: {totals.answered}</span> <span className="stat-badge" style={{background:"#fff1f2",color:"#be123c"}}>N/A: {totals.notAnswered}</span> <span className="stat-badge" style={{background:"#fffbeb",color:"#b45309"}}>Int: {totals.interested}</span> </div> <div style={{display:"flex",gap:6,alignItems:"center"}}><button className="ghost-btn" style={{padding:"5px 10px",fontSize:11}} onClick={()=>copyTaskToDate(task,addDays(currentDate,1))}>Reuse Tomorrow</button>{task.saved?<button className="saved-btn" onClick={()=>unsaveTask(task.id)}>Saved</button>:<button className="save-btn" onClick={()=>saveTask(task.id)}>Save</button>}</div> </div> </div> </div> <div style={{padding:20}}> {(callTarget>0||intTarget>0)&&(
            <div style={{background:"#fafafa",border:"1.5px solid #ebebeb",borderRadius:14,padding:16,marginBottom:16}}> <div style={{fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Team Target Progress</div> {callTarget>0&&<TargetBar label="Total Calls" value={totals.total} target={callTarget*assigned.length}/>}
              {intTarget>0&&<TargetBar label="Interested" value={totals.interested} target={intTarget*assigned.length}/>}
            </div> )}
          {assigned.map((m:any)=>{
            const s=getStats(m.id);
            const mARate=s.total>0?Math.round(s.answered/s.total*100):0;
            const mCRate=s.answered>0?Math.round(s.interested/s.answered*100):0;
            return (
              <div key={m.id} style={{border:"1.5px solid #ebebeb",borderRadius:14,padding:16,marginBottom:12}}> <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}> <div style={{width:34,height:34,borderRadius:10,background:AVATAR_COLORS[m.colorIdx||0][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{m.name}</div><div style={{fontSize:11,color:"#888",display:"flex",gap:8}}><span>{mARate}% answer rate</span><span>·</span><span>{mCRate}% conv. rate</span></div></div> </div> {(callTarget>0||intTarget>0)&&<div style={{marginBottom:12}}>{callTarget>0&&<TargetBar label="Calls" value={s.total} target={callTarget}/>}{intTarget>0&&<TargetBar label="Interested" value={s.interested} target={intTarget}/>}</div>}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}> {[{field:"total",label:"Total"},{field:"answered",label:"Answered"},{field:"notAnswered",label:"Not Ans."},{field:"interested",label:"Interested"}].map(({field,label})=>(
                    <div key={field} className="card-sm" style={{padding:10}}> <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>{label}</div> {isSheetSync?<div style={{fontSize:20,fontWeight:800,color:"#111",textAlign:"center",padding:"7px 0"}}>{s[field]}</div>:<Counter value={s[field]} onChange={v=>updateMemberStat(task.id,m.id,field,v)} size="sm"/>} </div> ))}
                </div>
                {isSheetSync&&<div style={{display:"flex",gap:8,marginTop:10}}><div style={{flex:1,background:"#eff6ff",borderRadius:10,padding:"8px 12px"}}><div style={{fontSize:10,fontWeight:700,color:"#2563eb",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Answer Rate</div><div style={{fontSize:18,fontWeight:800,color:"#1a56db"}}>{mARate}%</div></div><div style={{flex:1,background:"#f0fdf4",borderRadius:10,padding:"8px 12px"}}><div style={{fontSize:10,fontWeight:700,color:"#059669",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>Conv. Rate</div><div style={{fontSize:18,fontWeight:800,color:"#059669"}}>{mCRate}%</div></div></div>}
                </div> );
          })}
          {isSheetSync&&<div style={{background:"#1a1a1a",borderRadius:14,padding:16,marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Team Summary</div><div style={{display:"flex",gap:10}}><div style={{flex:1,background:"#111",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:10,fontWeight:700,color:"#60a5fa",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Team Answer Rate</div><div style={{fontSize:24,fontWeight:800,color:"#fff"}}>{aRate}%</div><div style={{fontSize:11,color:"#666",marginTop:2}}>{totals.answered} of {totals.total} answered</div></div><div style={{flex:1,background:"#111",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:10,fontWeight:700,color:"#34d399",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Team Conv. Rate</div><div style={{fontSize:24,fontWeight:800,color:"#fff"}}>{cRate}%</div><div style={{fontSize:11,color:"#666",marginTop:2}}>{totals.interested} of {totals.answered} interested</div></div></div></div>}
          <div style={{display:"flex",gap:12,marginBottom:12}}> <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#555"}}>Answer Rate</span><span style={{fontSize:11,fontWeight:700}}>{aRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${aRate}%`,background:"#1a56db"}}/></div></div> <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#555"}}>Conv. Rate</span><span style={{fontSize:11,fontWeight:700}}>{cRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${cRate}%`,background:"#1a56db"}}/></div></div> </div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:7}}>Remarks</div> <textarea className="remarks-ta" rows={2} value={task.remarks} onChange={e=>updateTaskField(task.id,"remarks",e.target.value)} placeholder="Notes for this session..."/>
          {/* Collapsible Call Script */}
          <div style={{marginTop:14,border:"1.5px solid #e5e5e5",borderRadius:12,overflow:"hidden"}}>
            <button onClick={()=>setScriptOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#555"}}>Call Script</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:scriptOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {scriptOpen&&(
              <div style={{padding:"12px 14px",borderTop:"1px solid #f0f0f0"}}>
                <textarea className="remarks-ta" rows={6} value={task.script||""} onChange={e=>updateTaskField(task.id,"script",e.target.value)} placeholder="Write your call script here..."/>
              </div>
            )}
          </div>
          {/* Potential Leads */}
          <div style={{marginTop:10,border:"1.5px solid #e5e5e5",borderRadius:12,overflow:"hidden"}}>
            <button onClick={()=>setLeadsOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#fafafa",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#555"}}>Potential Leads <span style={{color:"#aaa",fontWeight:500}}>({(task.leads||[]).length})</span></span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:leadsOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {leadsOpen&&(
              <div style={{padding:"12px 14px",borderTop:"1px solid #f0f0f0"}}>
                {(task.leads||[]).length>0&&(
                  <div style={{width:"100%",borderCollapse:"collapse",marginBottom:10,display:"table"}}>
                    <div style={{display:"table-header-group"}}>
                      <div style={{display:"table-row"}}>
                        {["Agent Name","Phone / Store ID","Remark",""].map((h,i)=>(
                          <div key={i} style={{display:"table-cell",padding:"6px 8px",fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1.5px solid #ebebeb",whiteSpace:"nowrap"}}>{h}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"table-row-group"}}>
                      {(task.leads||[]).map((lead:any)=>(
                        <div key={lead.id} style={{display:"table-row"}}>
                          <div style={{display:"table-cell",padding:"5px 6px",verticalAlign:"middle"}}>
                            <input value={lead.agentName} onChange={e=>updateLead(task.id,lead.id,"agentName",e.target.value)} placeholder="Agent name" style={{border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",minWidth:90}}/>
                          </div>
                          <div style={{display:"table-cell",padding:"5px 6px",verticalAlign:"middle"}}>
                            <input value={lead.phone} onChange={e=>updateLead(task.id,lead.id,"phone",e.target.value)} placeholder="Phone / Store ID" style={{border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",minWidth:110}}/>
                          </div>
                          <div style={{display:"table-cell",padding:"5px 6px",verticalAlign:"middle"}}>
                            <input value={lead.remark} onChange={e=>updateLead(task.id,lead.id,"remark",e.target.value)} placeholder="Remark" style={{border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",minWidth:120}}/>
                          </div>
                          <div style={{display:"table-cell",padding:"5px 4px",verticalAlign:"middle",textAlign:"right"}}>
                            <button className="danger-btn" onClick={()=>removeLead(task.id,lead.id)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <button className="ghost-btn" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>addLead(task.id)}>+ Add Lead</button>
                  <button className="ghost-btn" style={{fontSize:12,padding:"6px 12px",display:"flex",alignItems:"center",gap:5}} onClick={()=>{setEmailTo("");setEmailModal({task});}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Email Broadcaster
                  </button>
                  {(task.leads||[]).length>0&&(
                    <button className="ghost-btn" style={{fontSize:12,padding:"6px 12px",display:"flex",alignItems:"center",gap:5}} onClick={()=>{
                      const lines=(task.leads||[]).map((l:any,i:number)=>`${i+1}. ${l.agentName||"—"}  |  ${l.phone||"—"}  |  ${l.remark||"—"}`);
                      const text=`Potential Leads — ${task.title}\n${"─".repeat(40)}\n${lines.join("\n")}`;
                      navigator.clipboard.writeText(text).then(()=>showToast("Leads copied to clipboard"));
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      Copy List
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          </div> </div> );
  };

  const renderWhatsapp = (task:any) => {
    const assigned=task.assignedMembers||[];
    const totals=((task.campaigns||[]) as any[]).reduce((a:any,c:any)=>({sent:a.sent+c.sent,replied:a.replied+c.replied,closed:a.closed+c.closed,unresponsive:a.unresponsive+c.unresponsive}),{sent:0,replied:0,closed:0,unresponsive:0});
    const replyRate=totals.sent>0?Math.round(totals.replied/totals.sent*100):0;
    const closeRate=totals.replied>0?Math.round(totals.closed/totals.replied*100):0;
    return (
      <div className="fade-up"> <div className="card" style={{marginBottom:16}}> <div style={{padding:"18px 20px",borderBottom:"1px solid #f0f0f0"}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}> <div style={{flex:1,minWidth:0}}><input className="title-input" defaultValue={task.title} onBlur={e=>updateTaskTitle(task.id,e.target.value)} placeholder="Task title..."/><div style={{marginTop:6}}><MemberAvatarRow assignedMembers={assigned}/></div></div> <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}> <div style={{display:"flex",gap:5,flexWrap:"wrap"}}> <span className="stat-badge" style={{background:"#eff6ff",color:"#2563eb"}}>Sent: {totals.sent}</span> <span className="stat-badge" style={{background:"#f0fdf4",color:"#15803d"}}>Replied: {totals.replied}</span> <span className="stat-badge" style={{background:"#ecfdf5",color:"#059669"}}>Closed: {totals.closed}</span> </div> <div style={{display:"flex",gap:6,alignItems:"center"}}><button className="ghost-btn" style={{padding:"5px 10px",fontSize:11}} onClick={()=>copyTaskToDate(task,addDays(currentDate,1))}>Reuse Tomorrow</button>{task.saved?<button className="saved-btn" onClick={()=>unsaveTask(task.id)}>Saved</button>:<button className="save-btn" onClick={()=>saveTask(task.id)}>Save</button>}</div> </div> </div> </div> <div style={{padding:"14px 20px"}}> <div style={{display:"flex",gap:12,marginBottom:12}}> <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#555"}}>Reply Rate</span><span style={{fontSize:11,fontWeight:700}}>{replyRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${replyRate}%`,background:"#1a56db"}}/></div></div> <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#555"}}>Close Rate</span><span style={{fontSize:11,fontWeight:700}}>{closeRate}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${closeRate}%`,background:"#1a56db"}}/></div></div> </div> <textarea className="remarks-ta" rows={2} value={task.notes} onChange={e=>updateTaskField(task.id,"notes",e.target.value)} placeholder="Overall notes..."/> </div> </div> <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}> <div style={{fontWeight:700,fontSize:14}}>Campaigns <span style={{color:"#999",fontWeight:500,fontSize:13}}>({task.campaigns?.length||0})</span></div> <button className="primary-btn" style={{padding:"7px 13px",fontSize:12}} onClick={()=>{setCampaignTargetId(task.id);setModal("addCampaign");}}>+ Add Campaign</button> </div> {(!task.campaigns||task.campaigns.length===0)&&<div style={{textAlign:"center",padding:"30px",border:"1.5px dashed #e5e5e5",borderRadius:14,color:"#bbb",fontSize:13}}>No campaigns yet.</div>}
        {task.campaigns?.map((c:any)=>{
          const cReply=c.sent>0?Math.round(c.replied/c.sent*100):0;
          return (
            <div key={c.id} style={{border:"1.5px solid #ebebeb",borderRadius:14,padding:16,marginBottom:10,background:"#fafafa"}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}> <div style={{fontWeight:700,fontSize:14}}>{c.name}</div> <div style={{display:"flex",gap:6,alignItems:"center"}}><span className="stat-badge" style={{background:"#f0fdf4",color:"#15803d"}}>{cReply}% reply</span><button className="danger-btn" onClick={()=>removeCampaign(task.id,c.id)}>×</button></div> </div> <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}> {[{field:"sent",label:"Sent"},{field:"replied",label:"Replied"},{field:"closed",label:"Closed"},{field:"unresponsive",label:"No Reply"}].map(({field,label})=>(
                  <div key={field} style={{background:"#fff",border:"1.5px solid #e5e5e5",borderRadius:10,padding:10}}> <div style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>{label}</div> <Counter value={c[field]} onChange={v=>updateCampaignField(task.id,c.id,field,v)} size="sm"/> </div> ))}
              </div> <textarea className="remarks-ta" rows={2} value={c.remarks} onChange={e=>updateCampaignField(task.id,c.id,"remarks",e.target.value)} placeholder="Campaign notes..."/> </div> );
        })}
      </div> );
  };

  const renderGeneral = (task:any) => {
    const assigned=task.assignedMembers||[];
    const doneCount=(assigned as any[]).filter((m:any)=>task.memberDone?.[m.id]).length;
    return (
      <div className="card fade-up"> <div style={{padding:"18px 20px",borderBottom:"1px solid #f0f0f0"}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}> <div style={{flex:1,minWidth:0}}><input className="title-input" defaultValue={task.title} onBlur={e=>updateTaskTitle(task.id,e.target.value)} placeholder="Task title..."/><div style={{marginTop:6}}><MemberAvatarRow assignedMembers={assigned}/></div></div> <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}> <span className="stat-badge" style={{background:"#f0fdf4",color:"#15803d"}}>{doneCount}/{assigned.length} done</span> <div style={{display:"flex",gap:6,alignItems:"center"}}><button className="ghost-btn" style={{padding:"5px 10px",fontSize:11}} onClick={()=>copyTaskToDate(task,addDays(currentDate,1))}>Reuse Tomorrow</button>{task.saved?<button className="saved-btn" onClick={()=>unsaveTask(task.id)}>Saved</button>:<button className="save-btn" onClick={()=>saveTask(task.id)}>Save</button>}</div> </div> </div> </div> <div style={{padding:20}}> {assigned.map((m:any)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f5f5f5"}}> <div style={{width:30,height:30,borderRadius:8,background:AVATAR_COLORS[m.colorIdx||0][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> <div style={{flex:1,fontWeight:600,fontSize:14,textDecoration:task.memberDone?.[m.id]?"line-through":"none",color:task.memberDone?.[m.id]?"#bbb":"#111"}}>{m.name}</div> <div onClick={()=>toggleMemberDone(task.id,m.id)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 12px",borderRadius:9,background:task.memberDone?.[m.id]?"#f0fdf4":"#f5f5f5",border:`1.5px solid ${task.memberDone?.[m.id]?"#86efac":"#e5e5e5"}`,transition:"all .15s"}}> <div style={{width:14,height:14,borderRadius:4,background:task.memberDone?.[m.id]?"#16a34a":"transparent",border:`1.5px solid ${task.memberDone?.[m.id]?"#16a34a":"#ccc"}`,display:"flex",alignItems:"center",justifyContent:"center"}}> {task.memberDone?.[m.id]&&<svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div> <span style={{fontSize:11,fontWeight:700,color:task.memberDone?.[m.id]?"#16a34a":"#555"}}>{task.memberDone?.[m.id]?"Done":"Mark Done"}</span> </div> </div> ))}
          <div style={{marginTop:16}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:7}}>Notes</div> <textarea className="remarks-ta" rows={4} value={task.notes} onChange={e=>updateTaskField(task.id,"notes",e.target.value)} placeholder="Task details and notes..."/> </div> </div> </div> );
  };

  const TaskChip = ({ task }:{task:any}) => {
    const tt=TASK_TYPES[task.type as keyof typeof TASK_TYPES]; const isActive=task.id===selectedTaskId;
    const assigned=task.assignedMembers||[];
    let subtitle="";
    if(task.type==="telesales"){ const tot=(assigned as any[]).reduce((a:number,m:any)=>a+((task.linkedCampaign&&linkedTaskStats[task.id])?linkedTaskStats[task.id]?.[m.id]?.total||0:task.memberStats?.[m.id]?.total||0),0); subtitle=`${tot} calls · ${assigned.length} member${assigned.length!==1?"s":""}`; }
    else if(task.type==="whatsapp"){ subtitle=`${task.campaigns?.length||0} campaign${task.campaigns?.length!==1?"s":""}`; }
    else { const done=(assigned as any[]).filter((m:any)=>task.memberDone?.[m.id]).length; subtitle=`${done}/${assigned.length} done`; }
    return (
      <div className={`task-chip ${isActive?"active":""}`} onClick={()=>setSelectedTaskId(task.id)}> <div style={{width:8,height:8,borderRadius:"50%",background:tt.color,flexShrink:0,marginLeft:2}}></div> <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{task.title}</div><div style={{fontSize:11,color:"#999",marginTop:1}}>{subtitle}</div></div> {isManager&&<button className="danger-btn" onClick={e=>{e.stopPropagation();confirmRemoveTask(task.id,task.title);}}>×</button>}
      </div> );
  };

  if (authLoading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (!session || !profile) return <LoginScreen profileError={profileError} onSignOut={() => supabase.auth.signOut()} />;

  const hasUnsaved = dayTasks.some((t:any)=>!t.saved);
  const navItems = isManager
    ? [["daily","Daily"],["weekly","Weekly"],["contacts","Contacts"],["pipeline","Pipeline"],["templates","Templates"],["stats","Stats"],["export","Export"],["members","Members"],["settings","Settings"]]
    : [["daily","Daily"],["weekly","Weekly"],["contacts","Contacts"],["pipeline","Pipeline"],["templates","Templates"],["mystats","My Stats"],["export","Export"],["members","Members"]];

  const perfSummary = buildPerformanceSummary();
  const previewRows = getPreviewRows();

  return (
    <> <style>{CSS}</style> <AppShell page={page} setPage={setPage} navItems={navItems as [string,string][]} isManager={isManager} syncing={syncing} syncError={syncError} isOnline={isOnline} hasUnsaved={hasUnsaved} onLock={handleLock}> {/*  DAILY  */}
          {page==="daily"&&(
            <div className="fade-up">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}>
                <div><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>{dayName(currentDate)}</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{fmt(currentDate)}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className="ghost-btn" style={{padding:"7px 11px",fontSize:13}} onClick={()=>setCurrentDate(addDays(currentDate,-1))}>←</button>
                  <input type="date" value={currentDate} onChange={e=>setCurrentDate(e.target.value)} style={{border:"1.5px solid #444",borderRadius:9,padding:"7px 11px",fontSize:13,fontFamily:"inherit",color:"#fff",background:"#1a1a1a",outline:"none",fontWeight:500} as any}/>
                  <button className="ghost-btn" style={{padding:"7px 11px",fontSize:13}} onClick={()=>setCurrentDate(addDays(currentDate,1))}>→</button>
                </div>
              </div>
              {/* Callbacks due today */}
              {(()=>{
                const due=allContacts.filter((c:any)=>c.callbackDate===currentDate);
                if(!due.length) return null;
                return (
                  <div style={{marginBottom:14,background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:14,padding:"12px 16px"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#92400e",marginBottom:8}}>📞 Callbacks Due Today ({due.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {due.map((c:any)=>(
                        <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"#fff",borderRadius:9,border:"1px solid #fde68a"}}>
                          <div style={{width:26,height:26,borderRadius:7,background:"#e8efff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#1a56db",flexShrink:0}}>{initials(c.name||"?")}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name||"Unknown"}</div>
                            <div style={{fontSize:11,color:"#888"}}>{c.phone||"—"}{c.salesAgent?` · ${c.salesAgent}`:""}</div>
                          </div>
                          <button onClick={()=>{setPage("contacts");setOpenContactId(c.id);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #d97706",background:"#fff",color:"#d97706",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>View</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Today's team call progress */}
              {callTarget>0&&dayTasks.some((t:any)=>t.type==="telesales")&&(()=>{
                const entries:Record<string,{name:string,total:number,interested:number}>={};
                dayTasks.filter((t:any)=>t.type==="telesales").forEach((t:any)=>{
                  (t.assignedMembers||[]).forEach((m:any)=>{
                    if(!entries[m.id]) entries[m.id]={name:m.name,total:0,interested:0};
                    const s=(t.linkedCampaign&&linkedTaskStats[t.id]?.[m.id])?linkedTaskStats[t.id][m.id]:(t.memberStats?.[m.id]||{});
                    entries[m.id].total+=(s.total||0);
                    entries[m.id].interested+=(s.interested||0);
                  });
                });
                const rows=Object.values(entries);
                if(!rows.length) return null;
                return (
                  <div style={{marginBottom:14,background:"#f0f6ff",border:"1.5px solid #bfdbfe",borderRadius:14,padding:"12px 16px"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a56db",marginBottom:10}}>📊 Today's Call Progress</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {rows.map(({name,total,interested})=>(
                        <div key={name}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:3}}>
                            <span>{name}</span>
                            <span style={{color:total>=callTarget?"#059669":"#888"}}>{total}/{callTarget} calls{intTarget>0?` · ${interested}/${intTarget} int.`:""}</span>
                          </div>
                          <div className="progress-track"><div className="progress-fill" style={{width:`${Math.min(100,callTarget>0?total/callTarget*100:0)}%`,background:total>=callTarget?"#059669":"#1a56db"}}/></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Team leaderboard */}
              {members.length>1&&dayTasks.some((t:any)=>t.type==="telesales")&&(()=>{
                const lb:Record<string,{name:string,total:number,interested:number}>={};
                dayTasks.filter((t:any)=>t.type==="telesales").forEach((t:any)=>{
                  (t.assignedMembers||[]).forEach((m:any)=>{
                    if(!lb[m.id]) lb[m.id]={name:m.name,total:0,interested:0};
                    const s=t.memberStats?.[m.id]||{};
                    lb[m.id].total+=(s.total||0); lb[m.id].interested+=(s.interested||0);
                  });
                });
                const ranked=Object.values(lb).sort((a,b)=>b.total-a.total||b.interested-a.interested);
                if(!ranked.length||ranked.every(r=>r.total===0)) return null;
                const medals=["🥇","🥈","🥉"];
                return (
                  <div style={{marginBottom:14,background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,padding:"12px 16px"}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>🏆 Today's Leaderboard</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {ranked.map((r,i)=>(
                        <div key={r.name} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 8px",background:i===0?"#fffbeb":"#fafafa",borderRadius:8}}>
                          <span style={{fontSize:13,fontWeight:800,color:i===0?"#d97706":i===1?"#9ca3af":"#a07850",width:22,textAlign:"center"}}>{medals[i]||`${i+1}`}</span>
                          <div style={{flex:1,fontWeight:600,fontSize:13}}>{r.name}</div>
                          <span style={{fontSize:12,color:"#888"}}>{r.total} calls</span>
                          {r.interested>0&&<span style={{fontSize:11,fontWeight:700,color:"#059669",background:"#f0fdf4",padding:"2px 7px",borderRadius:20}}>{r.interested} int.</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div className="daily-grid" style={{display:"grid",gridTemplateColumns:`${sidebarOpen?"240px":"40px"} 1fr`,gap:16,alignItems:"start",transition:"grid-template-columns .2s ease"}}>
                {/* Sidebar */}
                <div className="sidebar-panel open">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    {sidebarOpen&&<div style={{fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.8}}>Tasks ({dayTasks.length})</div>}
                    <div style={{display:"flex",gap:4,marginLeft:sidebarOpen?0:"auto"}}>
                      {sidebarOpen&&<button onClick={()=>{setNewTaskMemberIds([]);setModal("addTask");}} style={{background:"#1a56db",color:"#fff",border:"none",borderRadius:7,width:24,height:24,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>}
                      <button className="sidebar-toggle" onClick={()=>setSidebarOpen(v=>!v)} title={sidebarOpen?"Collapse":"Expand"}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={sidebarOpen?"M15 18l-6-6 6-6":"M9 18l6-6-6-6"}/></svg>
                      </button>
                    </div>
                  </div>
                  {sidebarOpen&&(
                    <div className="card" style={{padding:8}}>
                      {dayTasks.length===0&&(
                        <div style={{padding:"24px 12px",textAlign:"center",color:"#bbb",fontSize:13}}>No tasks yet
                          <div style={{marginTop:12}}><button className="primary-btn" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>{setNewTaskMemberIds([]);setModal("addTask");}}>+ Add Task</button></div>
                        </div>
                      )}
                      {dayTasks.map((task:any)=><TaskChip key={task.id} task={task}/>)}
                    </div>
                  )}
                  {!sidebarOpen&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                      {dayTasks.map((task:any)=>{
                        const tt=TASK_TYPES[task.type as keyof typeof TASK_TYPES];
                        return <div key={task.id} onClick={()=>{setSidebarOpen(true);setSelectedTaskId(task.id);}} style={{width:8,height:8,borderRadius:"50%",background:task.id===selectedTaskId?BRAND:tt.color,cursor:"pointer",margin:"0 auto"}} title={task.title}/>;
                      })}
                      <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"#1a56db",fontSize:16,lineHeight:1}}>+</button>
                    </div>
                  )}
                </div>
                {/* Detail panel */}
                <div className="detail-panel">
                  {!selectedTask?(
                    <div style={{textAlign:"center",padding:"80px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16}}>
                      <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Select a task to view</div>
                      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Click a task on the left to view details</div>
                      <button className="primary-btn" onClick={()=>{setNewTaskMemberIds([]);setModal("addTask");}}>+ New Task</button>
                    </div>
                  ):<React.Fragment key={selectedTask.id}>{selectedTask.type==="telesales"?renderTelesales(selectedTask):selectedTask.type==="whatsapp"?renderWhatsapp(selectedTask):renderGeneral(selectedTask)}</React.Fragment>}
                </div>
              </div>
            </div>
          )}

          {/*  WEEKLY  */}
          {page === "weekly" && (
            <WeeklyPage
              db={db}
              members={members}
              weekDates={weekDates}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset as any}
              weeklyTab={weeklyTab}
              setWeeklyTab={setWeeklyTab}
              callTarget={callTarget}
              onSelectDate={(date) => { setCurrentDate(date); setPage("daily"); }}
            />
          )}

          {/*  CONTACTS  */}
          {page==="contacts"&&(()=>{
            const contacts  = allContacts;
            const filtered  = filteredContacts;
            const anyActive = Object.values(contactFilters).some((a:any)=>a.length>0)||contactSearch.trim().length>0||!!contactDateFrom||!!contactDateTo;
            const filterDefs = [
              {key:"status",  label:"Status",   options:[{val:"interested",label:"Interested"},{val:"callback",label:"Callback"},{val:"contacted",label:"Contacted"},{val:"not_answered",label:"Not Answered"},{val:"hangup",label:"Hung Up"}]},
              {key:"lead",    label:"Lead",     options:[{val:"hot",label:"🔴 Hot"},{val:"warm",label:"🟡 Warm"},{val:"cold",label:"🔵 Cold"},{val:"unclassified",label:"Unclassified"}]},
              {key:"campaign",label:"Campaign", options:contactCampaigns.map(cp=>({val:cp,label:cp}))},
              {key:"agent",label:"Agent",options:[...contactAgentOpts.map(a=>({val:a,label:a})),{val:"__none__",label:"Unassigned"}]},
              {key:"tag",label:"Tag",options:contactTagOpts.map(t=>({val:t,label:t}))},
            ];
            return (
              <div className="fade-up">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Contacts</div>
                    <div style={{fontSize:13,color:"#888",marginTop:2}}>{contacts.length} total · {filtered.length} shown{anyActive?" (filtered)":""}</div>
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
                      <button onClick={()=>{ if(window.confirm(`Delete all ${contacts.length} contacts?`)) deleteAllContacts(); }} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #ef4444",background:"#fff",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Delete All</button>
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
                    <button onClick={()=>{ setContactSelectMode(m=>!m); setSelectedContactIds(new Set()); }} style={{padding:"8px 16px",borderRadius:10,border:`1.5px solid ${contactSelectMode?"#111":"#e5e5e5"}`,background:contactSelectMode?"#111":"#fff",color:contactSelectMode?"#fff":"#555",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{contactSelectMode?"Cancel":"Select"}</button>
                    <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,border:`1.5px solid ${importing?"#aaa":"#1a56db"}`,background:"#fff",color:importing?"#aaa":"#1a56db",fontSize:13,fontWeight:700,cursor:importing?"not-allowed":"pointer",fontFamily:"inherit",opacity:importing?.6:1}}>
                      {importing?<><span style={{width:10,height:10,border:"2px solid #1a56db",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"pulse .8s linear infinite"}}/>Importing…</>:"↑ Import CSV"}
                      <input type="file" accept=".csv" disabled={importing} style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0]; if(f){ setPendingCampaignName(f.name.replace(/\.csv$/i,"").trim()); setPendingImport({file:f}); } e.target.value="";}}/>
                    </label>
                  </div>
                </div>
                {/* Agent panel — managers only */}
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
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:24,height:24,borderRadius:7,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div>
                              <span style={{fontWeight:600}}>{m.name}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:11,color:"#888"}}>{cnt} contact{cnt!==1?"s":""}</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
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
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:24,height:24,borderRadius:7,background:"#e5e5e5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#888"}}>{initials(m.name)}</div>
                              <span style={{fontWeight:600,color:"#888"}}>{m.name}</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Search + Google-Sheets-style filter bar */}
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                  <input value={contactSearch} onChange={e=>{setContactSearch(e.target.value);setContactLimit(100);}} placeholder="🔍 Search name, phone, store…" style={{flex:1,minWidth:160,border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 12px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                  {filterDefs.map(fd=>{
                    const active=contactFilters[fd.key]||[];
                    const isOpen=activeFilterDropdown===fd.key;
                    if(!fd.options.length) return null;
                    return (
                      <div key={fd.key} style={{position:"relative"}}>
                        <button onClick={()=>setActiveFilterDropdown(isOpen?null:fd.key)} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${active.length?"#1a56db":"#e5e5e5"}`,background:active.length?"#eff6ff":"#fff",color:active.length?"#1a56db":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                          {fd.label}{active.length?<span style={{background:"#1a56db",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:800}}>{active.length}</span>:null} ▾
                        </button>
                        {isOpen&&(
                          <>
                            <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setActiveFilterDropdown(null)}/>
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
                                    <span style={{fontSize:11,color:"#aaa"}}>{contacts.filter((c:any)=>{
                                      if(fd.key==="status") return c.status===opt.val;
                                      if(fd.key==="lead") return (c.leadStatus||"unclassified")===opt.val;
                                      if(fd.key==="campaign") return (c.campaign||"")===opt.val;
                                      if(fd.key==="agent") return (c.salesAgent||"__none__")===opt.val;
                                      if(fd.key==="tag") return (c.tags||[]).includes(opt.val);
                                      return false;
                                    }).length}</span>
                                    <input type="checkbox" checked={checked} onChange={()=>toggleContactFilter(fd.key,opt.val)} style={{display:"none"}}/>
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {/* Date filter */}
                  {(()=>{
                    const isOpen=activeFilterDropdown==="date";
                    const hasDate=!!contactDateFrom||!!contactDateTo;
                    const setPreset=(from:string,to:string)=>{ setContactDateFrom(from); setContactDateTo(to); setContactLimit(100); setActiveFilterDropdown(null); };
                    return (
                      <div style={{position:"relative"}}>
                        <button onClick={()=>setActiveFilterDropdown(isOpen?null:"date")} style={{padding:"7px 12px",borderRadius:9,border:`1.5px solid ${hasDate?"#1a56db":"#e5e5e5"}`,background:hasDate?"#eff6ff":"#fff",color:hasDate?"#1a56db":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                          Date{hasDate?<span style={{background:"#1a56db",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:800}}>✓</span>:null} ▾
                        </button>
                        {isOpen&&(
                          <>
                            <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setActiveFilterDropdown(null)}/>
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
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:11,color:"#888",width:28}}>From</span>
                                  <input type="date" value={contactDateFrom} onChange={e=>{setContactDateFrom(e.target.value);setContactLimit(100);}} style={{flex:1,border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:11,color:"#888",width:28}}>To</span>
                                  <input type="date" value={contactDateTo} onChange={e=>{setContactDateTo(e.target.value);setContactLimit(100);}} style={{flex:1,border:"1.5px solid #e5e5e5",borderRadius:7,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <select value={contactSort} onChange={e=>setContactSort(e.target.value)} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 11px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff",color:"#555",cursor:"pointer"}}>
                    <option value="status">Sort: Status</option>
                    <option value="queue">🔥 Priority Queue</option>
                    <option value="name">A → Z</option>
                    <option value="newest">Newest First</option>
                    <option value="stale">Most Stale</option>
                    <option value="hot">Hot Leads First</option>
                    <option value="score">⭐ Score</option>
                  </select>
                  {anyActive&&<button onClick={clearContactFilters} style={{padding:"7px 12px",borderRadius:9,border:"1.5px solid #e5e5e5",background:"#fff",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Clear all</button>}
                  {isManager&&<button onClick={openDedupModal} style={{padding:"7px 14px",borderRadius:9,border:"1.5px solid #7c3aed",background:"#f5f3ff",color:"#7c3aed",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Find Duplicates</button>}
                  <button onClick={()=>setShowAddContactModal(true)} style={{padding:"7px 14px",borderRadius:9,border:"1.5px solid #059669",background:"#f0fdf4",color:"#059669",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add Contact</button>
                </div>
                {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No contacts match your filters.</div>}
                {/* List rows — accordion */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {filtered.slice(0,contactLimit).map((c:any)=>(
                    <ContactRow
                      key={c.id}
                      c={c}
                      isOpen={openContactId===c.id}
                      isSelected={selectedContactIds.has(c.id)}
                      selectMode={contactSelectMode}
                      isManager={isManager}
                      members={members}
                      onToggle={handleContactToggle}
                      onSelect={handleContactSelect}
                      onSalesAgent={updateContactSalesAgent}
                      onLeadStatus={updateContactLeadStatusCb}
                      onStatus={updateContactStatus}
                      onCallbackDate={updateContactCallbackDate}
                      onUpdate={updateContactField}
                      onAddNote={addContactNote}
                      authorName={isManager?"Manager":(members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member")}
                      onDelete={deleteContactCb}
                      onToast={showToast}
                      waTemplates={db.settings?.waTemplates||[]}
                      qaQuestions={(db.qaTemplates as any)?.[c.campaign||""]||[]}
                    />
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
                            <div>
                              <span style={{fontWeight:600}}>{h.label}</span>
                              <span style={{color:"#aaa",marginLeft:8,fontSize:12}}>{agoStr}</span>
                            </div>
                            <button onClick={()=>undoDelete(h.hid)} style={{padding:"5px 14px",borderRadius:8,border:"1.5px solid #1a56db",background:"#fff",color:"#1a56db",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Undo</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {page === "templates" && (
            <TemplatesPage
              db={db}
              updateDb={updateDb}
              showToast={showToast}
              isManager={isManager}
              contactCampaigns={contactCampaigns}
            />
          )}

          {/*  PIPELINE  */}
          {page === "pipeline" && (
            <PipelinePage
              contacts={contacts}
              members={members}
              isManager={isManager}
              loggedInMemberId={loggedInMemberId}
              contactCampaigns={contactCampaigns}
              contactAgentOpts={contactAgentOpts}
              showToast={showToast}
              currentDate={currentDate}
              updateStatus={contactsApi.updateStatus}
              updateLeadStatus={contactsApi.updateLeadStatus}
              updateCallbackDate={contactsApi.updateCallbackDate}
              updateSalesAgent={contactsApi.updateSalesAgent}
              addNote={contactsApi.addNote}
            />
          )}

          {/*  STATS (manager only)  */}
          {page === "stats" && isManager && (
            <StatsPage
              contacts={contacts}
              members={members}
              statsTab={statsTab}
              setStatsTab={setStatsTab}
              onReassignStale={handleReassignStale}
            />
          )}

          {/*  EXPORT (all roles, members see own data only)  */}
          {page==="export"&&(
            <div className="fade-up"> <div style={{marginBottom:24}}> <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5,marginBottom:4}}>{isManager?"Export to Google Sheets":"My Export"}</div> <div style={{fontSize:13,color:"#888"}}>Download a CSV {isManager?"and import it directly into Google Sheets":"of your personal call data"}</div> </div> <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20,alignItems:"flex-end"}}> <div> <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:7,textTransform:"uppercase",letterSpacing:.5}}>Task Type</div> <div style={{display:"flex",gap:6}}>{[["telesales","Telesales"],["whatsapp","WhatsApp"],["general","General"]].map(([k,label])=><button key={k} className={`tab-btn ${exportTab===k?"active":""}`} onClick={()=>setExportTab(k)}>{label}</button>)}</div> </div> <div style={{marginLeft:"auto"}}> <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:7,textTransform:"uppercase",letterSpacing:.5}}>Date Range</div> <div style={{display:"flex",gap:6}}>{[["today","Today"],["week","This Week"],["month","Last 30 Days"]].map(([k,label])=><button key={k} className={`tab-btn ${exportRange===k?"active":""}`} onClick={()=>setExportRange(k)}>{label}</button>)}</div> </div> </div> {isManager&&<div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:14,padding:"14px 18px",marginBottom:20,display:"flex",gap:12,alignItems:"flex-start"}}> <div style={{fontSize:13,color:"#92400e",lineHeight:1.6}}>In Google Sheets: <strong>File → Import → Upload</strong> → select the CSV → choose "Insert new sheet".</div> </div>}
              {/* Telesales Conversion Summary Table */}
              {exportTab==="telesales"&&(()=>{
                const summ=buildTelesalesSummaryStats(previewRows);
                return (
                  <div className="card" style={{overflow:"hidden",marginBottom:20}}>
                    <div style={{padding:"14px 18px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Conversion Summary</div>
                    <div style={{overflowX:"auto"}}>
                      <table className="conv-summary-table">
                        <thead><tr><th>Metric</th><th>Value</th><th>Rate</th></tr></thead>
                        <tbody>
                          <tr><td>Total Calls Made</td><td className="highlight">{summ.totalCalls}</td><td>—</td></tr>
                          <tr><td>Total Answered</td><td className="highlight">{summ.totalAnswered}</td><td><span style={{fontSize:13,fontWeight:700,color:summ.answerRate>=60?"#16a34a":summ.answerRate>=40?"#d97706":"#ef4444"}}>{summ.answerRate}%</span></td></tr>
                          <tr><td>Total Not Answered</td><td className="highlight">{summ.totalNotAns}</td><td>—</td></tr>
                          <tr><td>Total Interested</td><td className="highlight">{summ.totalInterested}</td><td><span style={{fontSize:13,fontWeight:700,color:summ.convRate>=20?"#16a34a":summ.convRate>=10?"#d97706":"#ef4444"}}>{summ.convRate}% conv. rate</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
              {/* Preview table */}
              <div className="card" style={{overflow:"hidden",marginBottom:24}}> <div style={{padding:"14px 18px",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}> <div><div style={{fontWeight:700,fontSize:14}}>Preview</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{previewRows.length} row{previewRows.length!==1?"s":""}</div></div> <div style={{display:"flex",gap:8}}> <button className="ghost-btn" onClick={exportToPDF} disabled={previewRows.length===0||exporting} style={{fontSize:13}}>{exporting?"Exporting…":"Export PDF"}</button> <button className="green-btn" onClick={exportToCSV} disabled={previewRows.length===0||exporting}>{exporting?"Exporting…":"Export CSV"}</button></div> </div> {previewRows.length===0?(
                  <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:13}}>No data found for this filter.</div> ):(
                  <div style={{overflowX:"auto"}}> <table className="export-table"> <thead><tr>{Object.keys(previewRows[0]).map(h=><th key={h}>{h}</th>)}</tr></thead> <tbody>{previewRows.slice(0,15).map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody> </table> {previewRows.length>15&&<div style={{padding:"10px 16px",fontSize:12,color:"#888",borderTop:"1px solid #f0f0f0"}}>+{previewRows.length-15} more rows in export</div>}
                  </div> )}
              </div> {isManager&&<>{/*  Overall Performance Summary  */}
              <div style={{fontWeight:800,fontSize:18,letterSpacing:-.4,marginBottom:4}}>Overall Performance Summary</div> <div style={{fontSize:13,color:"#888",marginBottom:16}}>All telesales members across Today, This Week, and Last 30 Days</div> {perfSummary.length===0?(
                <div style={{textAlign:"center",padding:"40px",color:"#bbb",fontSize:13,border:"1.5px dashed #e5e5e5",borderRadius:16}}>Add telesales members to see performance summary.</div> ):(
                perfSummary.map(({member,stats}:any)=>(
                  <div key={member.id} className="card" style={{marginBottom:16,overflow:"hidden"}}> <div style={{padding:"14px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12}}> <div style={{width:36,height:36,borderRadius:10,background:AVATAR_COLORS[member.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{initials(member.name)}</div> <div style={{fontWeight:800,fontSize:15}}>{member.name}</div> </div> <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderTop:"none"}}> {[["today","Today"],["week","This Week"],["month","Last 30 Days"]].map(([range,label],ri)=>{
                        const s=stats[range];
                        return (
                          <div key={range} style={{padding:"16px",borderRight:ri<2?"1px solid #f0f0f0":"none"}}> <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>{label}</div> <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}> {[
                                {label:"Calls",val:s.total,color:"#2563eb",bg:"#eff6ff"},
                                {label:"Answered",val:s.answered,color:"#16a34a",bg:"#f0fdf4"},
                                {label:"Interested",val:s.interested,color:"#d97706",bg:"#fffbeb"},
                                {label:"WA Sent",val:s.sent,color:"#059669",bg:"#ecfdf5"},
                              ].map(({label,val,color,bg})=>(
                                <div key={label} style={{background:bg,borderRadius:10,padding:"8px 10px"}}> <div style={{fontSize:10,fontWeight:700,color,marginBottom:3,textTransform:"uppercase",letterSpacing:.4}}>{label}</div> <div style={{fontSize:18,fontWeight:800}}>{val}</div> </div> ))}
                            </div> <div style={{display:"flex",gap:6,flexWrap:"wrap"}}> <span className="stat-badge" style={{background:"#f0f0f0",color:"#555"}}>{s.aRate}% ans.</span> <span className="stat-badge" style={{background:"#f0f0f0",color:"#555"}}>{s.replyRate}% reply</span> {callTarget>0&&<span className="stat-badge" style={{background:s.targetHit?"#f0fdf4":"#fff1f2",color:s.targetHit?"#16a34a":"#ef4444"}}>{s.targetHit?"Target Hit":"Below Target"}</span>}
                            </div> </div> );
                      })}
                    </div> </div> ))
              )}</>}
            </div> )}

          {page === "mystats" && !isManager && (
            <MyStatsPage
              db={db}
              members={members}
              contacts={contacts}
              loggedInMemberId={loggedInMemberId}
              weekDates={weekDates}
              callTarget={callTarget}
              intTarget={intTarget}
            />
          )}

          {page === "members" && (
            <MembersPage
              db={db}
              members={members}
              isManager={isManager}
              onAddMember={() => setModal("addMember")}
              onRemoveMember={confirmRemoveMember}
            />
          )}

          {page === "settings" && isManager && (
            <SettingsPage db={db} updateDb={updateDb} showToast={showToast} />
          )}
        {/*  MODALS  */}
        {modal==="addTask"&&(
          <div className="modal-overlay" onClick={()=>setModal(null)}> <div className="modal" onClick={e=>e.stopPropagation()}> <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>New Task</div> <div style={{fontSize:13,color:"#888",marginBottom:18}}>Choose a type, assign members, and set a title</div> <div style={{marginBottom:14}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Task Type</div> <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(TASK_TYPES).map(([k,v])=><button key={k} className={`type-btn ${newTaskType===k?"active":""}`} onClick={()=>setNewTaskType(k)}>{v.label}</button>)}</div> </div> <div style={{marginBottom:14}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Assign Telesales Members <span style={{color:"#999",fontWeight:400}}>(select one or more)</span></div> {members.length===0?(
                  <div style={{padding:"10px 14px",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,fontSize:13,color:"#92400e"}}>No members. <span style={{fontWeight:700,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setModal(null);setPage("members");}}>Add one →</span></div> ):(
                  <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}> {members.map((m:any)=>{ const sel=newTaskMemberIds.includes(m.id); return (
                      <div key={m.id} onClick={()=>toggleMemberSelection(m.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1.5px solid ${sel?"#1a56db":"#e5e5e5"}`,background:sel?"#eff6ff":"#fff",cursor:"pointer",transition:"all .12s"}}> <div style={{width:28,height:28,borderRadius:8,background:AVATAR_COLORS[m.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> <span style={{flex:1,fontWeight:600,fontSize:13}}>{m.name}</span> <div style={{width:16,height:16,borderRadius:4,background:sel?"#1a56db":"transparent",border:`1.5px solid ${sel?"#1a56db":"#ccc"}`,display:"flex",alignItems:"center",justifyContent:"center"}}> {sel&&<svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div> </div> );})}
                  </div> )}
              </div> <div style={{marginBottom:20}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Task Title</div> <input ref={modalRef} className="text-input" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder={newTaskType==="telesales"?"e.g. Morning Call Session":newTaskType==="whatsapp"?"e.g. April Follow-up":"e.g. Prepare weekly report"}/> </div>
              {newTaskType==="telesales"&&contactCampaigns.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:4}}>Link to Campaign <span style={{color:"#999",fontWeight:400}}>(optional — auto-computes stats from contacts)</span></div>
                  <select value={newTaskLinkedCampaign} onChange={e=>setNewTaskLinkedCampaign(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #444",background:"#1a1a1a",color:"#fff",fontFamily:"inherit",fontSize:13,outline:"none"}}>
                    <option value="">No link — manual entry</option>
                    {contactCampaigns.map((c:string)=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div style={{display:"flex",gap:10}}> <button className="ghost-btn" style={{flex:1}} onClick={()=>{setModal(null);setNewTaskTitle("");}}>Cancel</button> <button className="primary-btn" style={{flex:1}} onClick={addTask} disabled={!newTaskTitle.trim()||newTaskMemberIds.length===0||members.length===0}>Create Task</button> </div> </div> </div> )}
        {showDedupModal&&dedupGroups.length>0&&(()=>{
          const group=dedupGroups[dedupIdx]||[];
          const PRIORITY:any={interested:3,callback:2,contacted:1};
          const remaining=dedupGroups.length-dedupIdx;
          return (
            <div className="modal-overlay" onClick={()=>setShowDedupModal(false)}>
              <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div><div style={{fontWeight:800,fontSize:18,letterSpacing:-.4}}>Duplicate Contacts</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{remaining} group{remaining!==1?"s":""} remaining</div></div>
                  <button onClick={()=>setShowDedupModal(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#aaa"}}>✕</button>
                </div>
                <div style={{fontSize:12,color:"#888",marginBottom:12}}>Same phone number found across multiple contacts. Choose which to keep — the others will be merged into it.</div>
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
                      <option value="contacted">Contacted</option>
                      <option value="callback">Callback</option>
                      <option value="interested">Interested</option>
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
                      <option value="">Unassigned</option>
                      {members.map((m:any)=><option key={m.id} value={m.name}>{m.name}</option>)}
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
        {modal==="addMember"&&(
          <div className="modal-overlay" onClick={()=>{setModal(null);setMemberInput("");}}> <div className="modal" onClick={e=>e.stopPropagation()}> <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>Add Telesales Member</div> <div style={{fontSize:13,color:"#888",marginBottom:20}}>Enter the member's full name</div> <input ref={modalRef} className="text-input" value={memberInput} onChange={e=>setMemberInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="e.g. Ahmad Fariz" style={{marginBottom:16}}/> <div style={{display:"flex",gap:10}}> <button className="ghost-btn" style={{flex:1}} onClick={()=>{setModal(null);setMemberInput("");}}>Cancel</button> <button className="primary-btn" style={{flex:1}} onClick={addMember} disabled={!memberInput.trim()}>Add Member</button> </div> </div> </div> )}
        {modal==="addCampaign"&&(
          <div className="modal-overlay" onClick={()=>{setModal(null);setCampaignInput("");}}> <div className="modal" onClick={e=>e.stopPropagation()}> <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>New Campaign</div> <div style={{fontSize:13,color:"#888",marginBottom:20}}>Name this WhatsApp outreach campaign</div> <input ref={modalRef} className="text-input" value={campaignInput} onChange={e=>setCampaignInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCampaign()} placeholder="e.g. Petaling Jaya Prospects" style={{marginBottom:16}}/> <div style={{display:"flex",gap:10}}> <button className="ghost-btn" style={{flex:1}} onClick={()=>{setModal(null);setCampaignInput("");}}>Cancel</button> <button className="primary-btn" style={{flex:1}} onClick={addCampaign} disabled={!campaignInput.trim()}>Add Campaign</button> </div> </div> </div> )}
        {confirmModal&&(
          <div className="modal-overlay" onClick={()=>setConfirmModal(null)}>
            <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:8,letterSpacing:-.3}}>
                {confirmModal.type==="task"?"Remove Task":"Remove Member"}
              </div>
              <div style={{fontSize:13,color:"#555",marginBottom:24,lineHeight:1.6}}>
                Are you sure you want to remove <strong>"{confirmModal.title}"</strong>?{confirmModal.type==="member"?" All their data will be unlinked.":""} This cannot be undone.
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="ghost-btn" style={{flex:1}} onClick={()=>setConfirmModal(null)}>Cancel</button>
                <button className="danger-solid-btn" style={{flex:1}} onClick={()=>confirmModal.type==="task"?doRemoveTask(confirmModal.id):doRemoveMember(confirmModal.id)}>
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}
        {showAssignModal&&(()=>{
          const campaigns=[...new Set(allContacts.map((c:any)=>c.campaign).filter(Boolean))].sort();
          const pool=allContacts.filter((c:any)=>
            !(assignFromUnassigned&&c.salesAgent) &&
            (!assignCampaignFilter || c.campaign===assignCampaignFilter)
          );
          const selectedList=(db.members||[]).filter((m:any)=>assignSelectedMembers.has(m.id));
          const customTotal=Object.entries(assignCounts).filter(([id])=>assignSelectedMembers.has(id)).reduce((s,[,v])=>s+(parseInt(v)||0),0);
          const perMember=selectedList.length>0?Math.ceil(pool.length/selectedList.length):0;
          return (
            <div className="modal-overlay" onClick={()=>setShowAssignModal(false)}>
              <div className="confirm-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440,width:"100%"}}>
                <div style={{fontWeight:800,fontSize:17,marginBottom:12,letterSpacing:-.3}}>⚡ Distribute Contacts</div>
                {/* Mode tabs */}
                <div style={{display:"flex",gap:6,marginBottom:16,background:"#f5f5f5",borderRadius:10,padding:4}}>
                  {([["even","🎲 Even Split"],["custom","🔢 Custom Count"]] as const).map(([mode,label])=>(
                    <button key={mode} onClick={()=>setAssignMode(mode)} style={{flex:1,padding:"7px 0",borderRadius:8,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:assignMode===mode?"#fff":"transparent",color:assignMode===mode?"#111":"#888",boxShadow:assignMode===mode?"0 1px 4px rgba(0,0,0,.08)":"none",transition:"all .12s"}}>{label}</button>
                  ))}
                </div>
                <div style={{fontSize:13,color:"#555",marginBottom:14,lineHeight:1.5}}>
                  {assignMode==="even"
                    ? "Select members — contacts will be split as evenly as possible among them."
                    : "Select members and set exactly how many contacts each one receives."}
                </div>
                {/* Campaign filter */}
                {campaigns.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:6}}>Campaign</div>
                    <select value={assignCampaignFilter} onChange={e=>setAssignCampaignFilter(e.target.value)} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                      <option value="">All campaigns</option>
                      {campaigns.map((c:string)=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {/* Pool toggle */}
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}>
                  <input type="checkbox" checked={assignFromUnassigned} onChange={e=>setAssignFromUnassigned(e.target.checked)} style={{width:15,height:15,cursor:"pointer"}}/>
                  Only distribute contacts with no agent yet
                </label>
                {/* Member rows */}
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {(db.members||[]).map((m:any)=>{
                    const selected=assignSelectedMembers.has(m.id);
                    const evenPreview=selected&&assignMode==="even"?perMember:null;
                    return (
                      <div key={m.id} onClick={()=>setAssignSelectedMembers(prev=>{const n=new Set(prev);n.has(m.id)?n.delete(m.id):n.add(m.id);return n;})} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1.5px solid ${selected?"#1a56db":"#e5e5e5"}`,background:selected?"#f0f6ff":"#fafafa",cursor:"pointer",transition:"all .12s"}}>
                        <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${selected?"#1a56db":"#ccc"}`,background:selected?"#1a56db":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {selected&&<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div style={{width:26,height:26,borderRadius:7,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(m.name)}</div>
                        <span style={{flex:1,fontSize:13,fontWeight:600}}>{m.name}</span>
                        {assignMode==="even"&&evenPreview!==null&&(
                          <span style={{fontSize:12,color:"#1a56db",fontWeight:700,background:"#e8efff",padding:"2px 8px",borderRadius:20}}>~{evenPreview}</span>
                        )}
                        {assignMode==="custom"&&selected&&(
                          <input type="number" min="0" placeholder="0" value={assignCounts[m.id]||""} onClick={e=>e.stopPropagation()} onChange={e=>setAssignCounts(prev=>({...prev,[m.id]:e.target.value}))} style={{width:65,border:"1.5px solid #1a56db",borderRadius:8,padding:"4px 8px",fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center",background:"#fff"}}/>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Summary */}
                <div style={{fontSize:12,color:"#888",background:"#f9f9f9",borderRadius:9,padding:"9px 12px",marginBottom:assignMode==="custom"&&customTotal>pool.length?8:16}}>
                  <span>Pool: <strong>{pool.length}</strong> contacts</span>
                  <span style={{margin:"0 10px"}}>·</span>
                  <span>Selected: <strong>{selectedList.length}</strong> member{selectedList.length!==1?"s":""}</span>
                  {assignMode==="custom"&&<><span style={{margin:"0 10px"}}>·</span><span>To assign: <strong>{customTotal}</strong></span></>}
                </div>
                {assignMode==="custom"&&customTotal>pool.length&&(
                  <div style={{fontSize:12,color:"#b45309",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:9,padding:"8px 12px",marginBottom:16}}>
                    ⚠ Total exceeds available contacts by <strong>{customTotal-pool.length}</strong>. Only the first <strong>{pool.length}</strong> will be assigned.
                  </div>
                )}
                <div style={{display:"flex",gap:10}}>
                  <button className="ghost-btn" style={{flex:1}} onClick={()=>setShowAssignModal(false)}>Cancel</button>
                  <button className="primary-btn" style={{flex:1,opacity:selectedList.length?1:.4,cursor:selectedList.length?"pointer":"not-allowed"}} disabled={!selectedList.length} onClick={assignContactsRandomly}>
                    {assignMode==="even"?"Distribute Evenly":"Distribute"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {showBulkReassignModal&&(
          <div className="modal-overlay" onClick={()=>setShowBulkReassignModal(false)}>
            <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:6,letterSpacing:-.3}}>Reassign Contacts</div>
              <div style={{fontSize:13,color:"#555",marginBottom:16,lineHeight:1.6}}>Reassign <strong>{bulkReassignIds.size}</strong> selected contact{bulkReassignIds.size!==1?"s":""} to:</div>
              <select value={bulkReassignTarget} onChange={e=>setBulkReassignTarget(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e5e5e5",fontSize:14,fontFamily:"inherit",marginBottom:16,outline:"none",background:"#fff"}}>
                <option value="">— Select agent —</option>
                {members.map((m:any)=><option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <div style={{display:"flex",gap:10}}>
                <button className="ghost-btn" style={{flex:1}} onClick={()=>setShowBulkReassignModal(false)}>Cancel</button>
                <button className="primary-btn" style={{flex:1,opacity:bulkReassignTarget?1:.4,cursor:bulkReassignTarget?"pointer":"not-allowed"}} disabled={!bulkReassignTarget} onClick={bulkReassignContacts}>Reassign</button>
              </div>
            </div>
          </div>
        )}
        {pendingImport&&(
          <div className="modal-overlay" onClick={()=>setPendingImport(null)}>
            <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:6,letterSpacing:-.3}}>Name this Campaign</div>
              <div style={{fontSize:13,color:"#555",marginBottom:16,lineHeight:1.6}}>Give this import a campaign name so you can filter contacts by it later.</div>
              <input autoFocus className="text-input" placeholder="e.g. April 2026 Outreach" value={pendingCampaignName} onChange={e=>setPendingCampaignName(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&pendingCampaignName.trim()){ importContactsFromCSV(pendingImport.file,pendingCampaignName.trim()); setPendingImport(null); }}} style={{marginBottom:16}}/>
              <div style={{display:"flex",gap:10}}>
                <button className="ghost-btn" style={{flex:1}} onClick={()=>setPendingImport(null)}>Cancel</button>
                <button className="primary-btn" style={{flex:1,opacity:pendingCampaignName.trim()?1:.4,cursor:pendingCampaignName.trim()?"pointer":"not-allowed"}} onClick={()=>{ if(pendingCampaignName.trim()){ importContactsFromCSV(pendingImport.file,pendingCampaignName.trim()); setPendingImport(null); }}}>Import</button>
              </div>
            </div>
          </div>
        )}
        {emailModal&&(
          <div className="modal-overlay" onClick={()=>setEmailModal(null)}>
            <div className="confirm-modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontWeight:800,fontSize:17,marginBottom:6,letterSpacing:-.3}}>Email Broadcaster</div>
              <div style={{fontSize:13,color:"#555",marginBottom:16,lineHeight:1.6}}>Enter the broadcaster's email address. Your email client will open with the stats and leads pre-filled.</div>
              <input autoFocus type="email" className="text-input" placeholder="broadcaster@example.com" value={emailTo} onChange={e=>setEmailTo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&emailTo.trim()&&sendEmail(emailModal.task)} style={{marginBottom:16}}/>
              <div style={{display:"flex",gap:10}}>
                <button className="ghost-btn" style={{flex:1}} onClick={()=>setEmailModal(null)}>Cancel</button>
                <button className="primary-btn" style={{flex:1,opacity:emailTo.trim()?1:.4,cursor:emailTo.trim()?"pointer":"not-allowed"}} onClick={()=>emailTo.trim()&&sendEmail(emailModal.task)}>Open Email</button>
              </div>
            </div>
          </div>
        )}
        {!isOnline&&<div style={{position:"fixed",top:0,left:0,right:0,background:"#ef4444",color:"#fff",fontSize:12,fontWeight:700,padding:"6px 12px",textAlign:"center",zIndex:9999}}>⚠️ Offline — changes may not save until reconnected</div>}
        {toast&&<div className="toast" style={{display:"flex",alignItems:"center",gap:12}}><span>{toast}</span>{toastAction&&<button onClick={()=>{toastAction.fn();if(toastTimerRef.current)clearTimeout(toastTimerRef.current);setToast(null);setToastAction(null);}} style={{background:"transparent",border:"1.5px solid rgba(255,255,255,.4)",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:6,cursor:"pointer"}}>{toastAction.label}</button>}</div>}
      </AppShell> </> );
}