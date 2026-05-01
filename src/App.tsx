import React, { useState, useRef, useEffect, useMemo, useCallback, useDeferredValue } from "react";
import { supabase } from "./lib/supabase";
import { CSS } from "./styles";
import { initials, uid, todayKey, weekStart, addDays, normalizeDate, fmt, dayName, fmtNoteTime, scoreContact } from "./lib/utils";
import { hashPin, safeCopy } from "./lib/security";
import { loadLocal, saveLocal, loadRemote, saveRemote } from "./lib/storage";
import { loadLocalContacts, saveLocalContacts, dbToContact, loadRemoteContacts, upsertContact, upsertContacts, deleteRemoteContact, deleteRemoteContacts } from "./lib/contacts-db";
import { DAYS, AVATAR_COLORS, BRAND, TASK_TYPES, CONTACT_STATUS_META, CONTACT_LEAD_META, PIPELINE_COLS } from "./lib/constants";
import { Counter } from "./components/Counter";
import { TargetBar } from "./components/TargetBar";
import { ContactRow } from "./components/ContactRow";
import { PipelineCard } from "./components/PipelineCard";
import { PinScreen } from "./components/PinScreen";
import { AppShell } from "./components/AppShell";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

//  Main App 
export default function App() {
  const [db, setDb]                   = useState(loadLocal);
  const [role, setRole]               = useState<string|null>(null);
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
  const [toast, setToast]             = useState<string|null>(null);
  const [toastAction, setToastAction] = useState<{label:string,fn:()=>void}|null>(null);
  const [isOnline, setIsOnline]       = useState(true);
  const [settingManagerPin, setSettingManagerPin] = useState("");
  const [settingMemberPin, setSettingMemberPin]   = useState("");
  const [showManagerPin, setShowManagerPin]       = useState(false);
  const [showMemberPin, setShowMemberPin]         = useState(false);
  const [settingCallTarget, setSettingCallTarget] = useState("");
  const [settingIntTarget, setSettingIntTarget]   = useState("");
  const [confirmModal, setConfirmModal]           = useState<{type:string;id:string;title:string}|null>(null);
  const [loggedInMemberId, setLoggedInMemberId]   = useState<string|null>(null);
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
  const [newTplName, setNewTplName]               = useState("");
  const [newTplBody, setNewTplBody]               = useState("");
  const [newQuestionText, setNewQuestionText]     = useState("");
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
  const [syncing, setSyncing]                     = useState(true);
  const [syncError, setSyncError]                 = useState(false);
  const [importing, setImporting]                 = useState(false);
  const [pipelineSearch,         setPipelineSearch]        = useState("");
  const [pipelineCampaignFilter, setPipelineCampaignFilter] = useState("");
  const [pipelineAgentFilter,    setPipelineAgentFilter]   = useState("");
  const [draggingContactId,      setDraggingContactId]     = useState<string|null>(null);
  const [dragOverColumn,         setDragOverColumn]        = useState<string|null>(null);
  const [pipelineDetailId,       setPipelineDetailId]      = useState<string|null>(null);
  const [pipelineNoteText,       setPipelineNoteText]      = useState("");
  const [exporting, setExporting]                 = useState(false);

  const [contacts, setContacts] = useState<any[]>(()=>loadLocalContacts());

  const modalRef      = useRef<HTMLInputElement>(null);
  const nextColorRef  = useRef<number>(0);
  const writerIdRef   = useRef(uid());
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const pendingSaveRef= useRef<any>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── Supabase real-time sync ──────────────────────────────────────────────────
  useEffect(()=>{
    let mounted = true;

    // Load blob (settings, members, days — no contacts)
    loadRemote().then(data=>{
      if(!mounted) return;
      if(data && Object.keys(data).length>0){
        const { __writerId:_, ...clean } = data;
        saveLocal(clean); setDb(clean);
      }
      setSyncing(false);
    }).catch(()=>{ if(mounted) setSyncing(false); });

    // Load contacts table; migrate from Supabase blob if empty
    loadRemoteContacts().then(async remote=>{
      if(!mounted) return;
      if(remote.length===0){
        const blobRemote = await loadRemote();
        const all:any[] = blobRemote?.contacts||[];
        if(all.length){ await upsertContacts(all); saveLocalContacts(all); if(mounted) setContacts(all); }
      } else {
        saveLocalContacts(remote); if(mounted) setContacts(remote);
      }
    }).catch(e=>console.error("contacts load",e));

    const blobChannel = supabase.channel("calltrack-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"calltrack"},(payload:any)=>{
        const incoming = payload.new?.data;
        if(!incoming||incoming.__writerId===writerIdRef.current) return;
        const { __writerId:_, ...clean } = incoming;
        saveLocal(clean); setDb(clean);
      }).subscribe((status:string)=>{
        if(status==="SUBSCRIBED" && navigator.onLine) setIsOnline(true);
        else if(status==="CHANNEL_ERROR" || status==="TIMED_OUT" || status==="CLOSED") setIsOnline(false);
      });

    const contactsChannel = supabase.channel("contacts-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"contacts"},(payload:any)=>{
        if(payload.eventType==="DELETE"){
          setContacts(prev=>{ const n=prev.filter((c:any)=>c.id!==payload.old?.id); saveLocalContacts(n); return n; });
        } else if(payload.new){
          const c=dbToContact(payload.new);
          setContacts(prev=>{ const idx=prev.findIndex((x:any)=>x.id===c.id); const n=idx>=0?[...prev.slice(0,idx),c,...prev.slice(idx+1)]:[...prev,c]; saveLocalContacts(n); return n; });
        }
      }).subscribe();

    return ()=>{ mounted=false; blobChannel.unsubscribe(); contactsChannel.unsubscribe(); supabase.removeChannel(blobChannel); supabase.removeChannel(contactsChannel); };
  },[]);

  useEffect(()=>{ if(!modal) return; const t=setTimeout(()=>modalRef.current?.focus(),60); return ()=>clearTimeout(t); },[modal]);
  useEffect(()=>{ setSelectedTaskId(null); },[currentDate]);

  const showToast = useCallback((msg:string, action?:{label:string,fn:()=>void}) => { if(toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(msg); setToastAction(action||null); toastTimerRef.current=setTimeout(()=>{setToast(null);setToastAction(null);},action?6000:2200); },[]);

  const attemptSave = useCallback((data:any, attempt=0) => {
    const DELAYS = [5000, 15000, 30000];
    saveRemote(data).then(()=>{
      retryCountRef.current = 0;
      setSyncError(false);
      pendingSaveRef.current = null;
    }).catch(()=>{
      setSyncError(true);
      if(attempt < 3){
        if(retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(()=>{ if(pendingSaveRef.current) attemptSave(pendingSaveRef.current, attempt+1); }, DELAYS[attempt]||30000);
      }
    });
  }, []);

  // updateDb — writes locally immediately, debounces Supabase writes to 1.2s
  const updateDb = useCallback((fn:(db:any)=>void) => setDb((prev:any)=>{
    const next = structuredClone(prev);
    fn(next);
    saveLocal(next);
    pendingSaveRef.current = {...next, __writerId: writerIdRef.current};
    retryCountRef.current = 0;
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(()=>{ if(pendingSaveRef.current) attemptSave(pendingSaveRef.current); }, 1200);
    return next;
  }), [attemptSave]);
  const ensureDay = (db:any,date:string) => { if(!db.days) db.days={}; if(!db.days[date]) db.days[date]={tasks:[],saved:false}; };

  const mutateContact = useCallback((id:string, fn:(c:any)=>void) => {
    setContacts(prev=>{
      const idx=prev.findIndex((c:any)=>c.id===id); if(idx<0) return prev;
      const next=[...prev]; const c={...next[idx]}; fn(c); next[idx]=c;
      saveLocalContacts(next); upsertContact(c);
      return next;
    });
  },[]);


  const isManager  = role==="manager";
  const members:any[]  = db.members||[];
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
    const touchedOn=(c:any,date:string)=>c.date===date||c.reContactDate===date;
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

  const handleUnlock = (r:string, memberId:string|null) => {
    setRole(r); setLoggedInMemberId(memberId||null); setPage("daily");
    if("Notification" in window){
      const notify=()=>{ const due=contacts.filter((c:any)=>c.callbackDate===todayKey()).length; if(due>0) new Notification("blurB — Callbacks Due Today",{body:`${due} callback${due!==1?"s":""} scheduled for today`,icon:"/vite.svg"}); };
      if(Notification.permission==="granted") notify();
      else if(Notification.permission!=="denied") Notification.requestPermission().then(p=>{if(p==="granted")notify();});
    }
  };
  const handleLock   = useCallback(() => { setRole(null); setLoggedInMemberId(null); setPage("daily"); setSelectedTaskId(null); },[]);

  // Session timeout: auto-lock after 30 min of inactivity
  useEffect(() => {
    if (!role) return;
    let lastActivity = Date.now();
    const reset = () => { lastActivity = Date.now(); };
    const events: string[] = ["mousedown","keydown","touchstart","scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 30 * 60 * 1000) { handleLock(); }
    }, 60 * 1000);
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, [role, handleLock]);

  // Online/offline detection
  useEffect(() => {
    const setOn = () => setIsOnline(true);
    const setOff = () => setIsOnline(false);
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener("online", setOn); window.removeEventListener("offline", setOff); };
  }, []);

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
      const text = (e.target?.result as string)||"";
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if (lines.length < 2) { showToast("CSV has no data rows."); setImporting(false); return; }

      // Parse CSV respecting quoted fields
      const parseRow = (line: string): string[] => {
        const out: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
          else if (ch === ',' && !inQ) { out.push(cur.trim()); cur=""; }
          else cur += ch;
        }
        out.push(cur.trim());
        return out;
      };

      const headers = parseRow(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9_]/g,"_"));
      const col = (...names: string[]) => { for (const n of names) { const i=headers.indexOf(n); if(i>=0) return i; } return -1; };

      const iName      = col("customer_name","client_name","name","contact_name");
      const iPhone     = col("primary_phone","phone_number","phone");
      const iPhone2    = col("mobile_phone","mobile","phone_2","phone2","alternate_phone","alt_phone","handphone","hp");
      const iStoreType = col("store_type","type");
      const iCompany   = col("agency","agency_name","company_name","company");
      const iStoreId   = col("store_id","storeid","store_no","store_number","store");
      const iRenId     = col("ren_id","renid","ren_no","ren");
      const iState     = col("most_frequent_state","remarks","remark","notes","state");
      const iStatus    = col("call_status","status");
      const iInterest  = col("interest","interested");
      const iAgent     = col("telesales","telesales_member","member","assigned_member","assigned","assigned_to","agent","agent_name");
      const iDate      = col("date");
      const iEmail     = col("email","email_address","contact_email","e_mail","e-mail");

      const PRIORITY: any = { interested:3, callback:2, contacted:1 };
      const stripPhone = (p:string) => p.replace(/[\s\-()+.]/g,"").toLowerCase();

      const seen: any = {};
      let skippedNoKey = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        const statusRaw   = (iStatus   >= 0 ? row[iStatus]   : "").trim().toLowerCase();
        const interestRaw = (iInterest >= 0 ? row[iInterest] : "").trim().toLowerCase();

        let bucket: string = "contacted";
        if (interestRaw==="yes")                              bucket="interested";
        else if (/^ans/.test(statusRaw))                      bucket="contacted";
        else if (/callback|call back|\bcb\b/.test(statusRaw)) bucket="callback";
        else if (/^int/.test(statusRaw))                      bucket="interested";
        else if (/not.ans|no.ans|unan/i.test(statusRaw))      bucket="not_answered";
        else if (/hang|reject/i.test(statusRaw))              bucket="hangup";

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
        const key       = (phone ? stripPhone(phone) : name.toLowerCase().trim());
        if (!key) { skippedNoKey++; continue; }

        const existing = seen[key];
        const inP = PRIORITY[bucket]||0;
        if (!existing || inP > (PRIORITY[existing.status]||0)) {
          seen[key] = { id: existing?.id || crypto.randomUUID(), name: name||phone, phone, phone2, storeType, company, storeId, renId, email, status: bucket, agentName: agent, date, remarks, leadStatus: existing?.leadStatus||null, campaign: campaignName };
        }
      }

      const imported = Object.values(seen) as any[];
      if (!imported.length) { showToast("No rows found — check that the file has a name or phone column."); setImporting(false); return; }

      // Compute cross-campaign duplicates from current snapshot before mutating
      const existingPhones=new Set(contacts.filter((c:any)=>c.campaign!==campaignName&&c.phone).map((c:any)=>stripPhone(c.phone)));
      const crossDups=imported.filter((c:any)=>c.phone&&existingPhones.has(stripPhone(c.phone))).length;

      setContacts(prev=>{
        const otherCampaign=prev.filter((c:any)=>c.campaign!==campaignName);
        const sameCampaign=prev.filter((c:any)=>c.campaign===campaignName);
        const existingMap:any={};
        sameCampaign.forEach((c:any)=>{ const k=c.phone?stripPhone(c.phone):(c.name||"").toLowerCase().trim(); if(k) existingMap[k]=c; });
        imported.forEach((c:any)=>{ const k=c.phone?stripPhone(c.phone):(c.name||"").toLowerCase().trim(); const ex=existingMap[k]; if(!ex||(PRIORITY[c.status]||0)>=(PRIORITY[ex.status]||0)) existingMap[k]={...c,leadStatus:ex?.leadStatus||null}; });
        const next=[...otherCampaign,...Object.values(existingMap)];
        saveLocalContacts(next); upsertContacts(Object.values(existingMap)); return next;
      });

      setContactLimit(100);
      showToast(`Imported ${imported.length} contact${imported.length!==1?"s":""} into "${campaignName}"${crossDups>0?` · ${crossDups} duplicate phone${crossDups!==1?"s":""} found in other campaigns`:""}${skippedNoKey>0?` · ${skippedNoKey} row${skippedNoKey!==1?"s":""} skipped (no name or phone)`:""}.`);
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

  const saveSettings = async () => {
    const mgr = settingManagerPin.length===4 ? await hashPin(settingManagerPin) : null;
    const mbr = settingMemberPin.length===4  ? await hashPin(settingMemberPin)  : null;
    updateDb((db:any)=>{
      if(!db.settings) db.settings={};
      if(mgr) db.settings.managerPin=mgr;
      if(mbr) db.settings.agentPin=mbr;
      if(settingCallTarget!=="") db.settings.callTarget=parseInt(settingCallTarget)||0;
      if(settingIntTarget!=="")  db.settings.intTarget=parseInt(settingIntTarget)||0;
    });
    showToast("Settings saved");
    setSettingManagerPin(""); setSettingMemberPin(""); setSettingCallTarget(""); setSettingIntTarget("");
  };

  const resetManagerPin = async () => {
    const h=await hashPin("1234");
    updateDb((db:any)=>{ if(!db.settings) db.settings={}; db.settings.managerPin=h; });
    showToast("Manager PIN reset to 1234");
  };
  const resetMemberPin = async () => {
    const h=await hashPin("0000");
    updateDb((db:any)=>{ if(!db.settings) db.settings={}; db.settings.agentPin=h; });
    showToast("Member PIN reset to 0000");
  };
  const baseMonday = weekStart(todayKey());
  const monday     = addDays(baseMonday, weekOffset*7);
  const weekDates  = Array.from({length:7},(_,i)=>addDays(monday,i));

  //  Export helpers 
  const getExportDates = (range:string) => {
    if(range==="today") return [todayKey()];
    if(range==="week")  return weekDates;
    const dates:string[] = []; const today=todayKey(); for(let i=29;i>=0;i--) dates.push(addDays(today,-i)); return dates;
  };

  const buildTelesalesRows = (dates:string[]) => {
    const touchedOn=(c:any,date:string)=>c.date===date||c.reContactDate===date;
    const rows:any[] = [];
    dates.forEach((date:string)=>{
      ((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
        ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
          let s:{total:number,answered:number,notAnswered:number,interested:number};
          if(task.linkedCampaign){
            const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,date));
            s={
              total:mine.length,
              answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,
              notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,
              interested:mine.filter((c:any)=>c.status==="interested").length,
            };
          } else {
            s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0};
          }
          const aRate=s.total>0?Math.round(s.answered/s.total*100):0;
          const cRate=s.answered>0?Math.round(s.interested/s.answered*100):0;
          rows.push({Date:fmt(date),Day:dayName(date),Member:m.name,Task:task.title,"Call Target":callTarget||"—",Total:s.total,Answered:s.answered,"Not Answered":s.notAnswered,Interested:s.interested,"Int. Target":intTarget||"—","Answer Rate (%)":aRate,"Conv. Rate (%)":cRate,"Target Hit?":callTarget>0?(s.total>=callTarget?"Yes":"No"):"—",Remarks:task.remarks||""});
        });
      });
    });
    return rows;
  };

  const buildWhatsappRows = (dates:string[]) => {
    const rows:any[] = [];
    dates.forEach((date:string)=>{
      ((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="whatsapp").forEach((task:any)=>{
        const memberNames=((task.assignedMembers||[]) as any[]).map((m:any)=>m.name).join(", ");
        ((task.campaigns||[]) as any[]).forEach((c:any)=>{
          const replyRate=c.sent>0?Math.round(c.replied/c.sent*100):0;
          const closeRate=c.replied>0?Math.round(c.closed/c.replied*100):0;
          rows.push({Date:fmt(date),Day:dayName(date),Members:memberNames,Task:task.title,Campaign:c.name,Sent:c.sent,Replied:c.replied,Closed:c.closed,"No Reply":c.unresponsive,"Reply Rate (%)":replyRate,"Close Rate (%)":closeRate,Remarks:c.remarks||""});
        });
        if(!task.campaigns||task.campaigns.length===0) rows.push({Date:fmt(date),Day:dayName(date),Members:memberNames,Task:task.title,Campaign:"—",Sent:0,Replied:0,Closed:0,"No Reply":0,"Reply Rate (%)":0,"Close Rate (%)":0,Remarks:task.notes||""});
      });
    });
    return rows;
  };

  const buildGeneralRows = (dates:string[]) => {
    const rows:any[] = [];
    dates.forEach((date:string)=>{
      ((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="general").forEach((task:any)=>{
        ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
          rows.push({Date:fmt(date),Day:dayName(date),Member:m.name,Task:task.title,Status:task.memberDone?.[m.id]?"Done":"Pending",Notes:task.notes||""});
        });
      });
    });
    return rows;
  };

  const buildTelesalesSummaryStats = (rows: any[]) => {
    const totalCalls     = rows.reduce((s:number,r:any)=>s+(r.Total||0),0);
    const totalAnswered  = rows.reduce((s:number,r:any)=>s+(r.Answered||0),0);
    const totalNotAns    = rows.reduce((s:number,r:any)=>s+(r["Not Answered"]||0),0);
    const totalInterested= rows.reduce((s:number,r:any)=>s+(r.Interested||0),0);
    const answerRate     = totalCalls>0?Math.round(totalAnswered/totalCalls*100):0;
    const convRate       = totalAnswered>0?Math.round(totalInterested/totalAnswered*100):0;
    return {totalCalls,totalAnswered,totalNotAns,totalInterested,answerRate,convRate};
  };

  const getPreviewRows = () => {
    const dates = getExportDates(exportRange);
    let rows: any[] = [];
    if(exportTab==="telesales") rows=buildTelesalesRows(dates);
    else if(exportTab==="whatsapp") rows=buildWhatsappRows(dates);
    else rows=buildGeneralRows(dates);
    // members only see their own rows
    if(!isManager && loggedInMemberId){
      const me=members.find((m:any)=>m.id===loggedInMemberId);
      if(me) rows=rows.filter((r:any)=>r.Member===me.name||r.Members?.includes(me.name));
    }
    return rows;
  };

  const exportToCSV = () => {
    const rows = getPreviewRows();
    if(rows.length===0){ showToast("No data to export"); return; }
    setExporting(true);
    try {
      const headers=Object.keys(rows[0]);
      const csvContent=[headers.join(","),...rows.map((r:any)=>headers.map((h:string)=>`"${String(r[h]||"").replace(/"/g,'""')}"`).join(","))].join("\n");
      const encoded="data:text/csv;charset=utf-8,"+encodeURIComponent(csvContent);
      const a=document.createElement("a"); a.href=encoded;
      a.download=`blurb_${exportTab}_${exportRange}_${todayKey()}.csv`;
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
        type MemberStat={name:string,total:number,answered:number,notAns:number,interested:number};
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

        // Per-member stats across all dates (for member breakdown table)
        const memberStatMap:Map<string,MemberStat>=new Map();
        dates.forEach(iso=>{
          ((db.days?.[iso]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
            ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
              let s:any;
              if(task.linkedCampaign){
                const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,iso));
                s={total:mine.length,answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,interested:mine.filter((c:any)=>c.status==="interested").length};
              } else { s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0}; }
              const prev=memberStatMap.get(m.name)||{name:m.name,total:0,answered:0,notAns:0,interested:0};
              memberStatMap.set(m.name,{name:m.name,total:prev.total+(s.total||0),answered:prev.answered+(s.answered||0),notAns:prev.notAns+(s.notAnswered||0),interested:prev.interested+(s.interested||0)});
            });
          });
        });

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

          // Per-day breakdown table
          const head=["DATE","TOTAL","ANSWERED","NOT ANS.","INTERESTED",...(hasRemarks?["REMARKS"]:[])];
          const body=days.map(d=>{
            const aR=d.total>0?Math.round(d.answered/d.total*100):0;
            const cR=d.answered>0?Math.round(d.interested/d.answered*100):0;
            const row=[d.label,String(d.total),`${d.answered}/${d.total} ${aR}%`,String(d.notAns),`${d.interested}/${d.answered} ${cR}%`];
            if(hasRemarks) row.push(d.remarks.join("; ")||"—");
            return row;
          });
          autoTable(doc,{
            head:[head],body,startY:y,
            styles:{fontSize:8,cellPadding:5,textColor:[30,30,30]},
            headStyles:{fillColor:[40,40,60],textColor:[255,255,255],fontStyle:"bold",fontSize:7},
            alternateRowStyles:{fillColor:[249,249,252]},
            columnStyles:{0:{fontStyle:"bold"},...(hasRemarks?{5:{cellWidth:120}}:{})},
            margin:{left:M,right:M},tableWidth:"auto",
          });
          y=(doc as any).lastAutoTable.finalY+10;

          // Per-member breakdown for this week
          const weekMemberMap:Map<string,MemberStat>=new Map();
          days.forEach(d=>{
            ((db.days?.[d.iso]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
              ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
                let s:any;
                if(task.linkedCampaign){
                  const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===m.name&&touchedOn(c,d.iso));
                  s={total:mine.length,answered:mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length,notAnswered:mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length,interested:mine.filter((c:any)=>c.status==="interested").length};
                } else { s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0}; }
                const prev=weekMemberMap.get(m.name)||{name:m.name,total:0,answered:0,notAns:0,interested:0};
                weekMemberMap.set(m.name,{name:m.name,total:prev.total+(s.total||0),answered:prev.answered+(s.answered||0),notAns:prev.notAns+(s.notAnswered||0),interested:prev.interested+(s.interested||0)});
              });
            });
          });
          if(weekMemberMap.size>0){
            const mBody=Array.from(weekMemberMap.values()).sort((a,b)=>b.total-a.total).map(ms=>{
              const aR=ms.total>0?Math.round(ms.answered/ms.total*100):0;
              const cR=ms.answered>0?Math.round(ms.interested/ms.answered*100):0;
              const hit=callTarget>0&&ms.total>=(callTarget*days.length);
              return [ms.name,String(ms.total),`${ms.answered} (${aR}%)`,String(ms.notAns),`${ms.interested} (${cR}%)`,hit?"✓ Hit":"—"];
            });
            autoTable(doc,{
              head:[["MEMBER","TOTAL","ANSWERED","NOT ANS.","INTERESTED","TARGET"]],
              body:mBody,startY:y,
              styles:{fontSize:8,cellPadding:4,textColor:[30,30,30]},
              headStyles:{fillColor:[88,28,135],textColor:[255,255,255],fontStyle:"bold",fontSize:7},
              alternateRowStyles:{fillColor:[250,245,255]},
              columnStyles:{0:{fontStyle:"bold"},5:{halign:"center" as const}},
              margin:{left:M,right:M},tableWidth:"auto",
            });
            y=(doc as any).lastAutoTable.finalY+22;
          } else { y+=12; }
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

  if(!role) return <PinScreen onUnlock={handleUnlock} db={db}/>;

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
          {page==="weekly"&&(
            <div className="fade-up"> <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}> <div><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Weekly Summary</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{fmt(weekDates[0])} — {fmt(weekDates[6])}</div></div> <div style={{display:"flex",gap:8}}> <button className="ghost-btn" onClick={()=>setWeekOffset(o=>o-1)}>← Prev</button> <button className="ghost-btn" onClick={()=>setWeekOffset(0)}>This Week</button> <button className="ghost-btn" onClick={()=>setWeekOffset(o=>o+1)}>Next →</button> </div> </div> {/* Day strip */}
              <div className="weekly-grid" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:24}}> {weekDates.map((date,di)=>{
                  const tasks:any[]=db.days?.[date]?.tasks||[];
                  const totalCalls=tasks.filter((t:any)=>t.type==="telesales").reduce((s:number,t:any)=>s+Object.values(t.memberStats||{}).reduce((a:number,m:any)=>a+(m as any).total,0),0);
                  const totalSent=(tasks as any[]).filter((t:any)=>t.type==="whatsapp").reduce((s:number,t:any)=>s+((t.campaigns||[]) as any[]).reduce((a:number,c:any)=>a+c.sent,0),0);
                  const isToday=date===todayKey(); const saved=db.days?.[date]?.saved;
                  return (
                    <div key={date} onClick={()=>{setCurrentDate(date);setPage("daily");}} style={{border:`1.5px solid ${isToday?"#1a56db":"#ebebeb"}`,borderRadius:14,padding:"12px 10px",cursor:"pointer",background:isToday?"#1a56db":"#fff",color:isToday?"#fff":"#111",transition:"all .12s"}} onMouseEnter={e=>{if(!isToday){e.currentTarget.style.borderColor="#1a56db";e.currentTarget.style.background="#eff6ff";}}} onMouseLeave={e=>{if(!isToday){e.currentTarget.style.borderColor="#ebebeb";e.currentTarget.style.background="#fff";}}}> <div style={{fontSize:10,fontWeight:700,color:isToday?"rgba(255,255,255,.7)":"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>{DAYS[di].slice(0,3)}</div> <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{fmt(date).split(" ")[0]}</div> {tasks.length>0?(<> <div style={{fontSize:16,fontWeight:800}}>{totalCalls}</div><div style={{fontSize:10,color:isToday?"rgba(255,255,255,.7)":"#888",marginBottom:3}}>calls</div> <div style={{fontSize:16,fontWeight:800}}>{totalSent}</div><div style={{fontSize:10,color:isToday?"rgba(255,255,255,.7)":"#888",marginBottom:4}}>sent</div> {saved&&<div style={{fontSize:10,fontWeight:700,color:isToday?"#dbeafe":"#65a30d"}}>Saved</div>}
                      </>):<div style={{fontSize:11,color:isToday?"rgba(255,255,255,.5)":"#ccc"}}>No data</div>}
                    </div> );
                })}
              </div> {/* Weekly tab switcher */}
              <div style={{display:"flex",gap:8,marginBottom:20}}> <button className={`weekly-tab ${weeklyTab==="telesales"?"active":""}`} onClick={()=>setWeeklyTab("telesales")}>Telesales Calling</button> <button className={`weekly-tab ${weeklyTab==="campaign"?"active":""}`} onClick={()=>setWeeklyTab("campaign")}>Campaign Follow Up</button> </div> {/*  Telesales weekly table  */}
              {weeklyTab==="telesales"&&members.length>0&&(
                <div className="card" style={{overflow:"hidden"}}> <div style={{padding:"14px 18px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Telesales Calling — Member Breakdown</div> <div style={{overflowX:"auto"}}> <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}> <thead> <tr style={{borderBottom:"1px solid #ebebeb"}}> <th style={{padding:"10px 16px",textAlign:"left",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>Member</th> {weekDates.map((date,di)=><th key={date} style={{padding:"10px 8px",textAlign:"center",fontWeight:700,fontSize:11,color:date===todayKey()?"#111":"#888",textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{DAYS[di].slice(0,3)}</th>)}
                          <th style={{padding:"10px 12px",textAlign:"center",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Total</th> {callTarget>0&&<th style={{padding:"10px 12px",textAlign:"center",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>vs Target</th>}
                        </tr> </thead> <tbody> {members.map((member:any)=>{
                          let weekTotal=0;
                          const dayCounts=weekDates.map(date=>{
                            const t=((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales"&&((t.assignedMembers||[]) as any[]).some((m:any)=>m.id===member.id)).reduce((s:number,t:any)=>s+(t.memberStats?.[member.id]?.total||0),0);
                            weekTotal+=t; return t;
                          });
                          const weekTarget=callTarget*7;
                          const hitPct=weekTarget>0?Math.round(weekTotal/weekTarget*100):null;
                          return (
                            <tr key={member.id} style={{borderBottom:"1px solid #f5f5f5"}}> <td style={{padding:"10px 16px",fontWeight:600,whiteSpace:"nowrap"}}> <div style={{display:"flex",alignItems:"center",gap:8}}> <div style={{width:26,height:26,borderRadius:7,background:AVATAR_COLORS[member.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{initials(member.name)}</div> {member.name}
                                </div> </td> {dayCounts.map((cnt,di)=>(
                                <td key={di} style={{padding:"10px 8px",textAlign:"center",background:weekDates[di]===todayKey()?"#fafafa":"transparent"}}> {cnt>0?<div style={{fontWeight:700,fontSize:14,color:callTarget>0&&cnt>=callTarget?"#16a34a":callTarget>0?"#ef4444":"#111"}}>{cnt}</div>:<span style={{color:"#ddd"}}>—</span>}
                                </td> ))}
                              <td style={{padding:"10px 12px",textAlign:"center",fontWeight:800,fontSize:15}}>{weekTotal||"—"}</td> {callTarget>0&&<td style={{padding:"10px 12px",textAlign:"center"}}>{hitPct!==null?<span style={{fontSize:12,fontWeight:700,color:hitPct>=100?"#16a34a":hitPct>=70?"#d97706":"#ef4444",background:hitPct>=100?"#f0fdf4":hitPct>=70?"#fffbeb":"#fff1f2",padding:"2px 8px",borderRadius:20}}>{hitPct}%</span>:"—"}</td>}
                            </tr> );
                        })}
                      </tbody> </table> </div> </div> )}

              {/*  Campaign follow-up weekly table  */}
              {weeklyTab==="campaign"&&members.length>0&&(
                <div className="card" style={{overflow:"hidden"}}> <div style={{padding:"14px 18px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Campaign Follow Up — Member Breakdown</div> <div style={{overflowX:"auto"}}> <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}> <thead> <tr style={{borderBottom:"1px solid #ebebeb"}}> <th style={{padding:"10px 16px",textAlign:"left",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>Member</th> {weekDates.map((date,di)=>(
                            <th key={date} style={{padding:"10px 8px",textAlign:"center",fontWeight:700,fontSize:11,color:date===todayKey()?"#111":"#888",textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{DAYS[di].slice(0,3)}</th> ))}
                          <th style={{padding:"10px 12px",textAlign:"center",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Total Sent</th> <th style={{padding:"10px 12px",textAlign:"center",fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Reply Rate</th> </tr> </thead> <tbody> {members.map((member:any)=>{
                          const dayData=getMemberCampaignWeek(member.id);
                          const weekSent=dayData.reduce((s:number,d:any)=>s+d.sent,0);
                          const weekReplied=dayData.reduce((s:number,d:any)=>s+d.replied,0);
                          const weekReplyRate=weekSent>0?Math.round(weekReplied/weekSent*100):0;
                          return (
                            <tr key={member.id} style={{borderBottom:"1px solid #f5f5f5"}}> <td style={{padding:"10px 16px",fontWeight:600,whiteSpace:"nowrap"}}> <div style={{display:"flex",alignItems:"center",gap:8}}> <div style={{width:26,height:26,borderRadius:7,background:AVATAR_COLORS[member.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{initials(member.name)}</div> {member.name}
                                </div> </td> {dayData.map((d,di)=>(
                                <td key={di} style={{padding:"8px",textAlign:"center",background:weekDates[di]===todayKey()?"#fafafa":"transparent"}}> {d.sent>0?(
                                    <div> <div style={{fontSize:12,fontWeight:700}}>{d.sent}</div> <div style={{fontSize:10,color:"#16a34a"}}>{d.replied}</div> <div style={{fontSize:10,color:"#059669"}}>{d.closed}</div> </div> ):<span style={{color:"#ddd"}}>—</span>}
                                </td> ))}
                              <td style={{padding:"10px 12px",textAlign:"center",fontWeight:800,fontSize:15}}>{weekSent||"—"}</td> <td style={{padding:"10px 12px",textAlign:"center"}}> {weekSent>0?<span style={{fontSize:12,fontWeight:700,color:weekReplyRate>=50?"#16a34a":weekReplyRate>=30?"#d97706":"#ef4444",background:weekReplyRate>=50?"#f0fdf4":weekReplyRate>=30?"#fffbeb":"#fff1f2",padding:"2px 8px",borderRadius:20}}>{weekReplyRate}%</span>:"—"}
                              </td> </tr> );
                        })}
                      </tbody> </table> </div> </div> )}

              {members.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#bbb",fontSize:14}}>Add telesales members first to see the breakdown</div>}
            </div> )}

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

          {/*  TEMPLATES  */}
          {page==="templates"&&(()=>{
            const tplTab = (db.settings?.tplTab as string) || "whatsapp";
            const setTplTab = (t:string) => updateDb((d:any)=>{ if(!d.settings) d.settings={}; d.settings.tplTab=t; });
            const waTpls = (db.settings?.waTemplates as any[])||[];
            const qaTpls: Record<string,any[]> = (db.qaTemplates as any) || {};
            const allCampaigns = Array.from(new Set([...contactCampaigns, ...Object.keys(qaTpls)])).sort();
            const selectedCampaign = (db.settings?.qaSelectedCampaign as string) || allCampaigns[0] || "";
            const setSelectedCampaign = (cp:string) => updateDb((d:any)=>{ if(!d.settings) d.settings={}; d.settings.qaSelectedCampaign=cp; });
            const questions = qaTpls[selectedCampaign] || [];
            return (
              <div className="fade-up">
                <div style={{marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Templates</div>
                  <div style={{fontSize:13,color:"#888",marginTop:2}}>Reusable WhatsApp messages and campaign Q&amp;A scripts</div>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:18,borderBottom:"1.5px solid #ebebeb"}}>
                  {[["whatsapp","WhatsApp"],["qa","Q&A"]].map(([k,label])=>(
                    <button key={k} onClick={()=>setTplTab(k)} style={{padding:"10px 18px",border:"none",background:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:tplTab===k?"#1a56db":"#888",borderBottom:`2.5px solid ${tplTab===k?"#1a56db":"transparent"}`,marginBottom:-1.5}}>{label}</button>
                  ))}
                </div>
                {tplTab==="whatsapp"&&(
                  <div className="card">
                    <div style={{padding:"14px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>WhatsApp Templates <span style={{fontSize:12,color:"#888",fontWeight:500}}>— click to copy. Use {"{name}"}, {"{phone}"}, {"{company}"} as placeholders</span></div>
                    <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
                      {waTpls.length===0&&<div style={{textAlign:"center",padding:"30px 14px",color:"#bbb",fontSize:13}}>No templates yet — add one below</div>}
                      {waTpls.map((t:any)=>(
                        <div key={t.id} style={{background:"#fafafa",border:"1.5px solid #ebebeb",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,color:"#059669",marginBottom:3}}>{t.name}</div>
                            <div style={{fontSize:12,color:"#555",lineHeight:1.5,wordBreak:"break-word" as const,whiteSpace:"pre-wrap"}}>{t.body}</div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            <button onClick={()=>{safeCopy(t.body); showToast(`"${t.name}" copied`);}} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #a7f3d0",background:"#ecfdf5",color:"#059669",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Copy</button>
                            {isManager&&<button onClick={()=>updateDb((d:any)=>{if(d.settings?.waTemplates)d.settings.waTemplates=d.settings.waTemplates.filter((x:any)=>x.id!==t.id);})} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #fecaca",background:"#fff",color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>}
                          </div>
                        </div>
                      ))}
                      <div style={{background:"#f0fdf4",border:"1.5px solid #a7f3d0",borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:8}}>
                        <input value={newTplName} onChange={e=>setNewTplName(e.target.value)} placeholder="Template name (e.g. First Follow-up)" style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                        <textarea value={newTplBody} onChange={e=>setNewTplBody(e.target.value)} placeholder={`Hi {name}, just following up on our call…`} rows={3} style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical" as const}}/>
                        <button onClick={()=>{if(!newTplName.trim()||!newTplBody.trim()){showToast("Name and body required.");return;} updateDb((d:any)=>{if(!d.settings)d.settings={};if(!d.settings.waTemplates)d.settings.waTemplates=[];d.settings.waTemplates.push({id:uid(),name:newTplName.trim(),body:newTplBody.trim()});}); setNewTplName("");setNewTplBody("");showToast("Template saved.");}} className="green-btn" style={{alignSelf:"flex-end",padding:"7px 18px",fontSize:13}}>Add Template</button>
                      </div>
                    </div>
                  </div>
                )}
                {tplTab==="qa"&&(
                  <div className="card">
                    <div style={{padding:"14px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                      <div>Campaign Q&amp;A <span style={{fontSize:12,color:"#888",fontWeight:500}}>— questions agents fill in per contact</span></div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#888",fontWeight:600}}>Campaign:</span>
                        <select value={selectedCampaign} onChange={e=>setSelectedCampaign(e.target.value)} style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                          {allCampaigns.length===0&&<option value="">No campaigns yet</option>}
                          {allCampaigns.map(cp=><option key={cp} value={cp}>{cp}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
                      {!selectedCampaign&&<div style={{textAlign:"center",padding:"30px 14px",color:"#bbb",fontSize:13}}>Import contacts to create a campaign first</div>}
                      {selectedCampaign&&questions.length===0&&<div style={{textAlign:"center",padding:"20px 14px",color:"#bbb",fontSize:13}}>No questions yet for "{selectedCampaign}" — add one below</div>}
                      {questions.map((q:any,idx:number)=>(
                        <div key={q.id} style={{background:"#fafafa",border:"1.5px solid #ebebeb",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                          <div style={{fontSize:11,fontWeight:800,color:"#1a56db",background:"#eff6ff",padding:"4px 9px",borderRadius:7,flexShrink:0,marginTop:2}}>Q{idx+1}</div>
                          <div style={{flex:1,fontSize:13,color:"#333",lineHeight:1.5,wordBreak:"break-word" as const}}>{q.text}</div>
                          <button onClick={()=>updateDb((d:any)=>{ if(!d.qaTemplates) return; d.qaTemplates[selectedCampaign]=(d.qaTemplates[selectedCampaign]||[]).filter((x:any)=>x.id!==q.id); })} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #fecaca",background:"#fff",color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Delete</button>
                        </div>
                      ))}
                      {selectedCampaign&&(
                        <div style={{background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:8}}>
                          <textarea value={newQuestionText} onChange={e=>setNewQuestionText(e.target.value)} placeholder="Question text (e.g. What's their current monthly spend?)" rows={2} style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical" as const}}/>
                          <button onClick={()=>{ if(!newQuestionText.trim()){showToast("Question required.");return;} updateDb((d:any)=>{ if(!d.qaTemplates)d.qaTemplates={}; if(!d.qaTemplates[selectedCampaign])d.qaTemplates[selectedCampaign]=[]; d.qaTemplates[selectedCampaign].push({id:uid(),text:newQuestionText.trim()}); }); setNewQuestionText(""); showToast("Question added."); }} className="primary-btn" style={{alignSelf:"flex-end",padding:"7px 18px",fontSize:13}}>Add Question</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/*  PIPELINE  */}
          {page==="pipeline"&&(()=>{
            const pipelineDetail = pipelineDetailId ? allContacts.find((c:any)=>c.id===pipelineDetailId)||null : null;
            const anyPipelineFilter = !!(pipelineSearch||pipelineCampaignFilter||pipelineAgentFilter);
            return (
              <div className="fade-up">
                {/* Header + filters */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Pipeline</div>
                    <div style={{fontSize:13,color:"#888",marginTop:2}}>{allContacts.length} total · drag cards to move stages</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
                  <input value={pipelineSearch} onChange={e=>setPipelineSearch(e.target.value)} placeholder="🔍 Search name, phone…" style={{flex:1,minWidth:150,border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 12px",fontSize:13,fontFamily:"inherit",outline:"none"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                  {contactCampaigns.length>0&&(
                    <select value={pipelineCampaignFilter} onChange={e=>setPipelineCampaignFilter(e.target.value)} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 11px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff",color:pipelineCampaignFilter?"#1a56db":"#555",borderColor:pipelineCampaignFilter?"#1a56db":"#e5e5e5"}}>
                      <option value="">All Campaigns</option>
                      {contactCampaigns.map(cp=><option key={cp} value={cp}>{cp}</option>)}
                    </select>
                  )}
                  {contactAgentOpts.length>0&&(
                    <select value={pipelineAgentFilter} onChange={e=>setPipelineAgentFilter(e.target.value)} style={{border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 11px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff",color:pipelineAgentFilter?"#1a56db":"#555",borderColor:pipelineAgentFilter?"#1a56db":"#e5e5e5"}}>
                      <option value="">All Agents</option>
                      {contactAgentOpts.map(a=><option key={a} value={a}>{a}</option>)}
                      <option value="__none__">Unassigned</option>
                    </select>
                  )}
                  {anyPipelineFilter&&<button onClick={()=>{setPipelineSearch("");setPipelineCampaignFilter("");setPipelineAgentFilter("");}} style={{padding:"7px 12px",borderRadius:9,border:"1.5px solid #e5e5e5",background:"#fff",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Clear</button>}
                </div>
                {/* Kanban columns */}
                <div className="pipeline-wrap" onDragEnd={handlePipelineDragEnd}>
                  {PIPELINE_COLS.map(col=>{
                    const cards=pipelineBase.filter((c:any)=>c.status===col.key);
                    const isOver=dragOverColumn===col.key;
                    return (
                      <div key={col.key} className={`pipeline-col${isOver?" drag-over":""}`} style={{color:col.color}}
                        onDragOver={e=>handlePipelineDragOver(e,col.key)}
                        onDragLeave={()=>setDragOverColumn(null)}
                        onDrop={e=>handlePipelineDrop(e,col.key)}
                      >
                        {/* Column header */}
                        <div style={{background:col.bg,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontWeight:800,fontSize:13,color:col.color,textTransform:"uppercase",letterSpacing:.5}}>{col.label}</span>
                          <span style={{background:col.color,color:"#fff",borderRadius:99,padding:"1px 8px",fontSize:11,fontWeight:800}}>{cards.length}</span>
                        </div>
                        {/* Cards */}
                        <div className={`pipeline-col-body${isOver?" drag-over":""}`} style={{background:isOver?col.bg+"40":"#fafafa"}}>
                          {cards.map((c:any)=>(
                            <PipelineCard
                              key={c.id}
                              c={c}
                              isDragging={draggingContactId===c.id}
                              onDragStart={handlePipelineDragStart}
                              onClick={handlePipelineCardClick}
                            />
                          ))}
                          {cards.length===0&&(
                            <div style={{border:"1.5px dashed #ddd",borderRadius:9,padding:"20px 10px",textAlign:"center",color:"#ccc",fontSize:12,marginTop:4}}>Drop here</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Detail modal */}
                {pipelineDetail&&(
                  <div className="modal-overlay" onClick={()=>{setPipelineDetailId(null);setPipelineNoteText("");}}>
                    <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:500}}>
                      {(()=>{
                        const c=pipelineDetail;
                        const sm=CONTACT_STATUS_META[c.status]||CONTACT_STATUS_META.contacted;
                        const fieldRow=(label:string,value:string)=>!value?null:(
                          <div style={{padding:"7px 0",borderBottom:"1px solid #f0f0f0"}}>
                            <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:2}}>{label}</div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                              <div style={{fontSize:13,color:"#111",flex:1,wordBreak:"break-word" as const}}>{value}</div>
                              <button onClick={()=>{safeCopy(value);showToast(label+" copied");}} style={{padding:"2px 8px",borderRadius:6,border:"1.5px solid #e5e5e5",background:"#fff",color:"#555",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Copy</button>
                            </div>
                          </div>
                        );
                        return (
                          <>
                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                              <div style={{width:38,height:38,borderRadius:11,background:"#e8efff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#1a56db",flexShrink:0}}>{initials(c.name||"?")}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:800,fontSize:16,letterSpacing:-.3}}>{c.name||"Unknown"}</div>
                                <span style={{fontSize:11,fontWeight:700,color:sm.color,background:sm.bg,padding:"2px 8px",borderRadius:20}}>{sm.label}</span>
                              </div>
                              <button onClick={()=>{setPipelineDetailId(null);setPipelineNoteText("");}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa",padding:"2px 6px"}}>✕</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px",marginBottom:14}}>
                              {fieldRow("Phone",c.phone||"")}
                              {fieldRow("Mobile / Alt. Phone",c.phone2||"")}
                              {fieldRow("Store Type",c.storeType||"")}
                              {fieldRow("Company / Agency",c.company||"")}
                              {fieldRow("Store ID",c.storeId||"")}
                              {fieldRow("REN ID",c.renId||"")}
                              {fieldRow("Remarks",c.remarks||"")}
                              {fieldRow("Campaign",c.campaign||"")}
                              {fieldRow("Agent (sheet)",c.agentName||"")}
                              {fieldRow("Date",c.date?fmt(c.date):"")}
                            </div>
                            {/* Call status */}
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:6}}>Call Status</div>
                              <div style={{display:"flex",gap:6}}>
                                {(["contacted","callback","interested"] as const).map(st=>{const stm=CONTACT_STATUS_META[st];const active=c.status===st;const pipelineAuthor=isManager?"Manager":(members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member");return <button key={st} onClick={()=>updateContactStatus(c.id,st,pipelineAuthor)} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1.5px solid ${active?stm.color:"#e5e5e5"}`,background:active?stm.bg:"#fff",color:active?stm.color:"#aaa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>{stm.label}</button>;})}
                              </div>
                            </div>
                            {/* Lead status */}
                            <div style={{marginBottom:12}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:6}}>Lead Status</div>
                              <div style={{display:"flex",gap:6}}>
                                {(["hot","warm","cold"] as const).map(ls=>{const llm=CONTACT_LEAD_META[ls];const active=c.leadStatus===ls;const pipelineAuthor=isManager?"Manager":(members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member");return <button key={ls} onClick={()=>updateContactLeadStatusCb(c.id,active?null:ls,pipelineAuthor)} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1.5px solid ${active?llm.color:"#e5e5e5"}`,background:active?llm.bg:"#fff",color:active?llm.color:"#aaa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>{ls==="hot"?"🔴":ls==="warm"?"🟡":"🔵"} {llm.label}</button>;})}
                              </div>
                            </div>
                            {/* Callback date */}
                            {c.status==="callback"&&(
                              <div style={{marginBottom:12}}>
                                <div style={{fontSize:10,fontWeight:700,color:"#d97706",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:6}}>Callback Date</div>
                                <input type="date" value={c.callbackDate||""} onChange={e=>updateContactCallbackDate(c.id,e.target.value)} style={{border:"1.5px solid #fde68a",borderRadius:9,padding:"7px 11px",fontSize:13,fontFamily:"inherit",color:"#111",background:"#fffbeb",outline:"none",width:"100%"}}/>
                              </div>
                            )}
                            {/* Sales agent — manager only */}
                            {isManager&&(
                              <div style={{marginBottom:14}}>
                                <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:6}}>Sales Agent</div>
                                <select value={c.salesAgent||""} onChange={e=>updateContactSalesAgent(c.id,e.target.value)} style={{width:"100%",border:"1.5px solid #e5e5e5",borderRadius:9,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                                  <option value="">Unassigned</option>
                                  {members.map((m:any)=><option key={m.id} value={m.name}>{m.name}</option>)}
                                </select>
                              </div>
                            )}
                            {/* Notes feed */}
                            <div style={{marginBottom:14}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:.5,marginBottom:8}}>Notes {(c.notes||[]).length>0&&<span style={{color:"#1a56db"}}>({(c.notes||[]).length})</span>}</div>
                              {(c.notes||[]).length>0&&(
                                <div className="notes-feed" style={{marginBottom:8}}>
                                  {(c.notes as any[]).map((n:any)=>(
                                    <div key={n.id} className="note-item">
                                      <div className="note-meta"><span>{n.author||"—"}</span><span>{fmtNoteTime(n.timestamp)}</span></div>
                                      <div className="note-text">{n.text}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{display:"flex",gap:6}}>
                                <input value={pipelineNoteText} onChange={e=>setPipelineNoteText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&pipelineNoteText.trim()){addContactNote(c.id,pipelineNoteText,isManager?"Manager":(members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member"));setPipelineNoteText("");}}} placeholder="Add a note…" style={{flex:1,border:"1.5px solid #e5e5e5",borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                                <button onClick={()=>{if(pipelineNoteText.trim()){addContactNote(c.id,pipelineNoteText,isManager?"Manager":(members.find((m:any)=>m.id===loggedInMemberId)?.name||"Member"));setPipelineNoteText("");}}} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #1a56db",background:"#1a56db",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Add</button>
                              </div>
                            </div>
                            <button onClick={()=>{const txt=[`Name: ${c.name||""}`,`Phone: ${c.phone||""}`,`Status: ${sm.label}`,`Lead: ${c.leadStatus||"unclassified"}`,`Agent: ${c.salesAgent||""}`,`Remarks: ${c.remarks||""}`].filter(l=>!l.endsWith(": ")).join("\n");navigator.clipboard.writeText(txt);showToast("Copied");}} style={{width:"100%",padding:"9px 0",borderRadius:9,border:"1.5px solid #1a56db",background:"#fff",color:"#1a56db",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Copy All</button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/*  STATS (manager only)  */}
          {page==="stats"&&isManager&&(()=>{
            const agentNames=Array.from(new Set(allContacts.map((c:any)=>c.salesAgent||"").filter(Boolean))).sort();
            const unassignedCount=allContacts.filter((c:any)=>!c.salesAgent).length;
            const today=todayKey();
            const agentRows=agentNames.map(name=>{
              const cs=allContacts.filter((c:any)=>c.salesAgent===name);
              const total=cs.length;
              const contacted=cs.filter((c:any)=>c.status==="contacted").length;
              const callback=cs.filter((c:any)=>c.status==="callback").length;
              const interested=cs.filter((c:any)=>c.status==="interested").length;
              const hot=cs.filter((c:any)=>c.leadStatus==="hot").length;
              const stale=cs.filter((c:any)=>{if(!c.lastTouched)return true;const d=Math.floor((Date.now()-new Date(c.lastTouched+"T00:00:00").getTime())/86400000);return d>7;}).length;
              const callbackDueToday=cs.filter((c:any)=>c.callbackDate===today).length;
              const avgScore=cs.length>0?Math.round(cs.reduce((s:number,c:any)=>s+scoreContact(c),0)/cs.length):0;
              return {name,total,contacted,callback,interested,hot,stale,callbackDueToday,avgScore};
            });
            const campaignNames=Array.from(new Set(allContacts.map((c:any)=>c.campaign||"").filter(Boolean))).sort();
            const campaignRows=campaignNames.map(camp=>{
              const cs=allContacts.filter((c:any)=>c.campaign===camp);
              const total=cs.length;
              const contacted=cs.filter((c:any)=>c.status==="contacted").length;
              const callback=cs.filter((c:any)=>c.status==="callback").length;
              const interested=cs.filter((c:any)=>c.status==="interested").length;
              const convPct=total>0?Math.round(interested/total*100):0;
              return {name:camp,total,contacted,callback,interested,convPct};
            }).sort((a,b)=>b.interested-a.interested);
            const pct=(n:number,t:number)=>t>0?Math.round(n/t*100):0;
            return (
              <div className="fade-up">
                <div style={{marginBottom:20}}>
                  <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Stats</div>
                  <div style={{fontSize:13,color:"#888",marginTop:2}}>{agentNames.length} agents · {allContacts.length} total contacts{unassignedCount>0?` · ${unassignedCount} unassigned`:""}</div>
                </div>
                <div className="stats-tab-bar">
                  <button className={`stats-tab${statsTab==="agents"?" active":""}`} onClick={()=>setStatsTab("agents")}>Agents</button>
                  <button className={`stats-tab${statsTab==="campaigns"?" active":""}`} onClick={()=>setStatsTab("campaigns")}>Campaigns</button>
                  <button className={`stats-tab${statsTab==="funnel"?" active":""}`} onClick={()=>setStatsTab("funnel")}>Funnel</button>
                  <button className={`stats-tab${statsTab==="log"?" active":""}`} onClick={()=>setStatsTab("log")}>Call Log</button>
                  <button className={`stats-tab${statsTab==="activity"?" active":""}`} onClick={()=>setStatsTab("activity")}>Activity</button>
                </div>
                {statsTab==="agents"&&(agentRows.length===0?(
                  <div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No contacts assigned to agents yet.</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {agentRows.map(r=>(
                      <div key={r.name} style={{background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,padding:"16px 20px"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:36,height:36,borderRadius:10,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{initials(r.name)}</div>
                            <div>
                              <div style={{fontWeight:700,fontSize:15}}>{r.name}</div>
                              <div style={{fontSize:12,color:"#888"}}>{r.total} contact{r.total!==1?"s":""}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                            {r.hot>0&&<span style={{fontSize:11,fontWeight:700,color:"#dc2626",background:"#fff1f2",padding:"2px 8px",borderRadius:20}}>{r.hot} hot</span>}
                            {r.callbackDueToday>0&&<span style={{fontSize:11,fontWeight:700,color:"#d97706",background:"#fffbeb",padding:"2px 8px",borderRadius:20}}>{r.callbackDueToday} callback today</span>}
                            {r.stale>0&&<span style={{fontSize:11,fontWeight:700,color:"#6b7280",background:"#f3f4f6",padding:"2px 8px",borderRadius:20}}>{r.stale} stale (&gt;7d)</span>}
                            {r.stale>0&&<button onClick={()=>handleReassignStale(r.name)} style={{fontSize:11,fontWeight:700,color:"#1a56db",background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:8,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}>Reassign stale →</button>}
                            <span style={{fontSize:11,fontWeight:700,color:r.avgScore>=70?"#059669":r.avgScore>=40?"#d97706":"#9ca3af",background:r.avgScore>=70?"#f0fdf4":r.avgScore>=40?"#fffbeb":"#f9f9f9",padding:"2px 8px",borderRadius:20}}>avg score {r.avgScore}</span>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                          {[
                            {label:"Contacted",val:r.contacted,color:"#2563eb",bg:"#eff6ff"},
                            {label:"Callback",val:r.callback,color:"#d97706",bg:"#fffbeb"},
                            {label:"Interested",val:r.interested,color:"#059669",bg:"#f0fdf4"},
                          ].map(({label,val,color,bg})=>(
                            <div key={label} style={{background:bg,borderRadius:10,padding:"10px 12px"}}>
                              <div style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>{label}</div>
                              <div style={{fontSize:20,fontWeight:800,color:"#111"}}>{val}</div>
                              <div style={{fontSize:11,color:"#888"}}>{pct(val,r.total)}%</div>
                            </div>
                          ))}
                        </div>
                        {r.total>0&&(
                          <div style={{marginTop:10}}>
                            <div style={{fontSize:11,color:"#888",marginBottom:4}}>Pipeline progress</div>
                            <div style={{display:"flex",height:8,borderRadius:99,overflow:"hidden",gap:1}}>
                              <div style={{flex:r.contacted,background:"#93c5fd",minWidth:r.contacted?2:0}}/>
                              <div style={{flex:r.callback,background:"#fcd34d",minWidth:r.callback?2:0}}/>
                              <div style={{flex:r.interested,background:"#6ee7b7",minWidth:r.interested?2:0}}/>
                            </div>
                            <div style={{display:"flex",gap:12,marginTop:4,fontSize:10,color:"#aaa"}}>
                              <span style={{color:"#2563eb"}}>■ Contacted</span>
                              <span style={{color:"#d97706"}}>■ Callback</span>
                              <span style={{color:"#059669"}}>■ Interested</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {statsTab==="campaigns"&&(campaignRows.length===0?(
                  <div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No campaigns found on contacts yet.</div>
                ):(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                    {campaignRows.map(r=>(
                      <div key={r.name} style={{background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,padding:"16px 18px"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:12}}>
                          <div style={{fontWeight:700,fontSize:14,lineHeight:1.3,flex:1}}>{r.name}</div>
                          <span style={{fontSize:12,fontWeight:800,color:"#059669",background:"#f0fdf4",padding:"3px 9px",borderRadius:20,flexShrink:0}}>{r.convPct}% conv.</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
                          {[
                            {label:"Contacted",val:r.contacted,color:"#2563eb",bg:"#eff6ff"},
                            {label:"Callback",val:r.callback,color:"#d97706",bg:"#fffbeb"},
                            {label:"Interested",val:r.interested,color:"#059669",bg:"#f0fdf4"},
                          ].map(({label,val,color,bg})=>(
                            <div key={label} style={{background:bg,borderRadius:9,padding:"8px 10px",textAlign:"center"}}>
                              <div style={{fontSize:9,fontWeight:700,color,textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:3}}>{label}</div>
                              <div style={{fontSize:18,fontWeight:800,color:"#111"}}>{val}</div>
                            </div>
                          ))}
                        </div>
                        {r.total>0&&(
                          <div>
                            <div style={{display:"flex",height:6,borderRadius:99,overflow:"hidden",gap:1}}>
                              <div style={{flex:r.contacted,background:"#93c5fd",minWidth:r.contacted?2:0}}/>
                              <div style={{flex:r.callback,background:"#fcd34d",minWidth:r.callback?2:0}}/>
                              <div style={{flex:r.interested,background:"#6ee7b7",minWidth:r.interested?2:0}}/>
                            </div>
                            <div style={{fontSize:10,color:"#aaa",marginTop:4}}>{r.total} total contacts</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {statsTab==="funnel"&&(()=>{
                  const total=allContacts.length;
                  const answered=allContacts.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length;
                  const callback=allContacts.filter((c:any)=>["callback","interested"].includes(c.status)).length;
                  const interested=allContacts.filter((c:any)=>c.status==="interested").length;
                  const notAnswered=allContacts.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length;
                  const funnelSteps=[
                    {label:"Total Contacts",val:total,color:"#6366f1",bg:"#eef2ff",pct:100},
                    {label:"Answered",val:answered,color:"#2563eb",bg:"#eff6ff",pct:total>0?Math.round(answered/total*100):0},
                    {label:"Callback / Follow-up",val:callback,color:"#d97706",bg:"#fffbeb",pct:total>0?Math.round(callback/total*100):0},
                    {label:"Interested",val:interested,color:"#059669",bg:"#f0fdf4",pct:total>0?Math.round(interested/total*100):0},
                  ];
                  return (
                    <div>
                      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                        {funnelSteps.map((s,i)=>(
                          <div key={s.label} style={{background:"#fff",border:`1.5px solid ${s.color}22`,borderRadius:14,padding:"14px 18px"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{width:28,height:28,borderRadius:8,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:s.color}}>{i+1}</div>
                                <span style={{fontWeight:700,fontSize:14}}>{s.label}</span>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontWeight:800,fontSize:20,color:"#111"}}>{s.val}</div>
                                <div style={{fontSize:11,color:"#888"}}>{s.pct}% of total</div>
                              </div>
                            </div>
                            <div style={{height:8,borderRadius:99,background:"#f3f4f6",overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${s.pct}%`,background:s.color,borderRadius:99,transition:"width .4s"}}/>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,padding:"16px 18px"}}>
                        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Not Reached</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <div style={{background:"#f3f4f6",borderRadius:10,padding:"12px 14px"}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:4}}>NOT ANSWERED</div>
                            <div style={{fontSize:22,fontWeight:800,color:"#111"}}>{notAnswered}</div>
                            <div style={{fontSize:11,color:"#aaa"}}>{total>0?Math.round(notAnswered/total*100):0}% of total</div>
                          </div>
                          <div style={{background:"#fff1f2",borderRadius:10,padding:"12px 14px"}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#ef4444",marginBottom:4}}>HUNG UP</div>
                            <div style={{fontSize:22,fontWeight:800,color:"#111"}}>{allContacts.filter((c:any)=>c.status==="hangup").length}</div>
                            <div style={{fontSize:11,color:"#aaa"}}>{total>0?Math.round(allContacts.filter((c:any)=>c.status==="hangup").length/total*100):0}% of total</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {statsTab==="log"&&(()=>{
                  const logEntries:any[]=[];
                  allContacts.forEach((c:any)=>{
                    (c.history||[]).forEach((h:any)=>{ logEntries.push({...h,contactName:c.name,contactId:c.id,salesAgent:c.salesAgent||""}); });
                  });
                  logEntries.sort((a,b)=>new Date(b.timestamp||0).getTime()-new Date(a.timestamp||0).getTime());
                  const today=todayKey();
                  const todayEntries=logEntries.filter(e=>(e.timestamp||"").startsWith(today));
                  const olderEntries=logEntries.filter(e=>!(e.timestamp||"").startsWith(today));
                  const renderEntry=(e:any,idx:number)=>{
                    const stm=CONTACT_STATUS_META[e.to as string]||{label:e.to,color:"#888",bg:"#f3f4f6"};
                    const fromStm=e.from?CONTACT_STATUS_META[e.from as string]||{label:e.from,color:"#aaa",bg:"#f9f9f9"}:null;
                    const time=e.timestamp?new Date(e.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";
                    return (
                      <div key={idx} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
                        <div style={{width:32,height:32,borderRadius:9,background:stm.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stm.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#111"}}>{e.contactName||"Unknown"}</div>
                          <div style={{fontSize:12,color:"#888",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:2}}>
                            {fromStm&&<><span style={{color:fromStm.color,fontWeight:600,background:fromStm.bg,padding:"1px 6px",borderRadius:6,fontSize:11}}>{fromStm.label}</span><span>→</span></>}
                            <span style={{color:stm.color,fontWeight:600,background:stm.bg,padding:"1px 6px",borderRadius:6,fontSize:11}}>{stm.label}</span>
                            {e.by&&<span style={{color:"#aaa"}}>by {e.by}</span>}
                          </div>
                        </div>
                        <div style={{fontSize:11,color:"#bbb",flexShrink:0,paddingTop:2}}>{time}</div>
                      </div>
                    );
                  };
                  if(logEntries.length===0) return <div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No status changes recorded yet. Status changes are logged automatically.</div>;
                  return (
                    <div style={{background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,padding:"16px 20px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{fontWeight:700,fontSize:14}}>Status Change Log</div>
                        <span style={{fontSize:12,color:"#888"}}>{logEntries.length} total · {todayEntries.length} today</span>
                      </div>
                      {todayEntries.length>0&&(
                        <>
                          <div style={{fontSize:11,fontWeight:700,color:"#1a56db",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Today</div>
                          {todayEntries.slice(0,50).map(renderEntry)}
                        </>
                      )}
                      {olderEntries.length>0&&(
                        <>
                          <div style={{fontSize:11,fontWeight:700,color:"#888",margin:"14px 0 6px",textTransform:"uppercase",letterSpacing:.5}}>Earlier</div>
                          {olderEntries.slice(0,100).map(renderEntry)}
                        </>
                      )}
                    </div>
                  );
                })()}
                {statsTab==="activity"&&(()=>{
                  const weekStartDate=weekStart(today);
                  const activityRows=members.map((m:any)=>{
                    const entries=allContacts.flatMap((c:any)=>(c.history||[]).filter((h:any)=>h.by===m.name));
                    const todayEntries=entries.filter((h:any)=>(h.timestamp||"").startsWith(today));
                    const weekEntries=entries.filter((h:any)=>(h.timestamp||"").slice(0,10)>=weekStartDate);
                    const days7=Array.from({length:7},(_,i)=>addDays(today,-(6-i)));
                    const sparkline=days7.map(d=>entries.filter((h:any)=>(h.timestamp||"").startsWith(d)).length);
                    return {
                      name:m.name, colorIdx:m.colorIdx,
                      todayCalls:todayEntries.length,
                      weekCalls:weekEntries.length,
                      todayInterested:todayEntries.filter((h:any)=>h.type==="status"&&h.to==="interested").length,
                      weekInterested:weekEntries.filter((h:any)=>h.type==="status"&&h.to==="interested").length,
                      avgPerDay:Math.round(weekEntries.length/7),
                      sparkline,
                    };
                  }).sort((a:any,b:any)=>b.weekCalls-a.weekCalls);
                  const maxBar=Math.max(1,...activityRows.flatMap((r:any)=>r.sparkline));
                  if(members.length===0) return <div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No members added yet.</div>;
                  return (
                    <div>
                      <div style={{background:"#fff",border:"1.5px solid #ebebeb",borderRadius:14,overflow:"hidden"}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 90px 90px 90px 70px",gap:0,background:"#1a56db",padding:"10px 16px"}}>
                          {["Agent","Today","This Week","Int. Today","Int. Week","Avg/Day"].map(h=>(
                            <div key={h} style={{fontSize:11,fontWeight:700,color:"#fff",textTransform:"uppercase" as const,letterSpacing:.4}}>{h}</div>
                          ))}
                        </div>
                        {activityRows.map((r:any)=>(
                          <div key={r.name} style={{display:"grid",gridTemplateColumns:"1fr 80px 90px 90px 90px 70px",gap:0,padding:"12px 16px",borderBottom:"1px solid #f3f4f6",alignItems:"center"}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <div style={{width:28,height:28,borderRadius:8,background:AVATAR_COLORS[r.colorIdx]?.[0]||"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(r.name)}</div>
                                <span style={{fontWeight:700,fontSize:13}}>{r.name}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"flex-end",gap:2,height:32}}>
                                {r.sparkline.map((v:number,i:number)=>(
                                  <div key={i} title={`${addDays(today,-(6-i))}: ${v}`} style={{flex:1,background:v>0?"#1a56db":"#e8efff",borderRadius:"3px 3px 0 0",height:`${Math.max(2,Math.round(v/maxBar*32))}px`,transition:"height .2s"}}/>
                                ))}
                              </div>
                            </div>
                            <div style={{fontSize:16,fontWeight:800,color:r.todayCalls>0?"#1a56db":"#bbb",textAlign:"center" as const}}>{r.todayCalls}</div>
                            <div style={{fontSize:16,fontWeight:800,color:r.weekCalls>0?"#111":"#bbb",textAlign:"center" as const}}>{r.weekCalls}</div>
                            <div style={{fontSize:16,fontWeight:800,color:r.todayInterested>0?"#059669":"#bbb",textAlign:"center" as const}}>{r.todayInterested}</div>
                            <div style={{fontSize:16,fontWeight:800,color:r.weekInterested>0?"#059669":"#bbb",textAlign:"center" as const}}>{r.weekInterested}</div>
                            <div style={{fontSize:13,fontWeight:600,color:"#888",textAlign:"center" as const}}>{r.avgPerDay}</div>
                          </div>
                        ))}
                      </div>
                      {activityRows.every((r:any)=>r.weekCalls===0)&&(
                        <div style={{textAlign:"center",padding:"20px",fontSize:13,color:"#bbb",marginTop:12}}>No status changes recorded yet — activity populates as agents update contacts.</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

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

          {/*  MY STATS (member only)  */}
          {page==="mystats"&&!isManager&&(()=>{
            const me = members.find((m:any)=>m.id===loggedInMemberId);
            if(!me) return <div style={{textAlign:"center",padding:"60px 20px",color:"#bbb",fontSize:14}}>No member profile linked. Please log in again and select your name.</div>;
            const ranges:{[k:string]:string[]} = { today:[todayKey()], week:weekDates, month:(()=>{const d:string[]=[];const t=todayKey();for(let i=29;i>=0;i--)d.push(addDays(t,-i));return d;})() };
            const touchedOn=(c:any,date:string)=>c.date===date||c.reContactDate===date;
            const rangeStats:any = Object.fromEntries(Object.entries(ranges).map(([range,dates])=>{
              let total=0,answered=0,notAnswered=0,interested=0,sent=0,replied=0,closed=0,generalDone=0,generalTotal=0;
              dates.forEach((date:string)=>{
                ((db.days?.[date]?.tasks||[]) as any[]).forEach((task:any)=>{
                  const assigned=((task.assignedMembers||[]) as any[]).some((m:any)=>m.id===me!.id);
                  if(!assigned) return;
                  if(task.type==="telesales"){
                    if(task.linkedCampaign){
                      const mine=contacts.filter((c:any)=>c.campaign===task.linkedCampaign&&c.salesAgent===me!.name&&touchedOn(c,date));
                      total+=mine.length;
                      answered+=mine.filter((c:any)=>["contacted","callback","interested"].includes(c.status)).length;
                      notAnswered+=mine.filter((c:any)=>["not_answered","hangup"].includes(c.status)).length;
                      interested+=mine.filter((c:any)=>c.status==="interested").length;
                    } else {
                      const s=task.memberStats?.[me!.id]||{};
                      total+=s.total||0;answered+=s.answered||0;notAnswered+=s.notAnswered||0;interested+=s.interested||0;
                    }
                  }
                  if(task.type==="whatsapp"){((task.campaigns||[]) as any[]).forEach((c:any)=>{sent+=c.sent||0;replied+=c.replied||0;closed+=c.closed||0;});}
                  if(task.type==="general"){generalTotal++;if(task.memberDone?.[me!.id])generalDone++;}
                });
              });
              return [range,{total,answered,notAnswered,interested,sent,replied,closed,generalDone,generalTotal,
                aRate:total>0?Math.round(answered/total*100):0,
                replyRate:sent>0?Math.round(replied/sent*100):0,
              }];
            }));
            const todayTasks=((db.days?.[todayKey()]?.tasks||[]) as any[]).filter((t:any)=>((t.assignedMembers||[]) as any[]).some((m:any)=>m.id===me!.id));
            return (
              <div className="fade-up">
                <div style={{marginBottom:24,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:52,height:52,borderRadius:16,background:AVATAR_COLORS[me.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>{initials(me.name)}</div>
                  <div><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>{me.name}</div><div style={{fontSize:13,color:"#888",marginTop:2}}>Your personal performance dashboard</div></div>
                </div>
                {/* Range cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
                  {[["today","Today"],["week","This Week"],["month","Last 30 Days"]].map(([range,label])=>{
                    const s:any=rangeStats[range];
                    return (
                      <div key={range} className="card" style={{padding:18}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:.6,marginBottom:14}}>{label}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                          {[{label:"Total Calls",val:s.total,color:"#2563eb",bg:"#eff6ff"},{label:"Answered",val:s.answered,color:"#16a34a",bg:"#f0fdf4"},{label:"Interested",val:s.interested,color:"#d97706",bg:"#fffbeb"},{label:"WA Sent",val:s.sent,color:"#059669",bg:"#ecfdf5"}].map(({label:l,val,color,bg})=>(
                            <div key={l} style={{background:bg,borderRadius:10,padding:"10px 12px"}}>
                              <div style={{fontSize:10,fontWeight:700,color,marginBottom:4,textTransform:"uppercase",letterSpacing:.4}}>{l}</div>
                              <div style={{fontSize:22,fontWeight:800,color:"#111"}}>{val}</div>
                            </div>
                          ))}
                        </div>
                        {callTarget>0&&<TargetBar label="Calls vs Target" value={s.total} target={callTarget*(range==="today"?1:range==="week"?7:30)}/>}
                        {intTarget>0&&<TargetBar label="Interested vs Target" value={s.interested} target={intTarget*(range==="today"?1:range==="week"?7:30)}/>}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                          <span className="stat-badge" style={{background:"#f0f0f0",color:"#555"}}>{s.aRate}% ans. rate</span>
                          {s.sent>0&&<span className="stat-badge" style={{background:"#f0f0f0",color:"#555"}}>{s.replyRate}% reply rate</span>}
                          {s.generalTotal>0&&<span className="stat-badge" style={{background:"#f0f0f0",color:"#555"}}>{s.generalDone}/{s.generalTotal} tasks done</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Today's tasks */}
                <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>Today's Tasks</div>
                {todayTasks.length===0?(
                  <div style={{textAlign:"center",padding:"30px",border:"1.5px dashed #e5e5e5",borderRadius:14,color:"#bbb",fontSize:13}}>No tasks assigned today</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {todayTasks.map((task:any)=>{
                      const tt=TASK_TYPES[task.type as keyof typeof TASK_TYPES];
                      let detail="";
                      if(task.type==="telesales"){const s=task.memberStats?.[me.id]||{total:0,answered:0,interested:0};detail=`${s.total} calls · ${s.answered} answered · ${s.interested} interested`;}
                      else if(task.type==="whatsapp"){const sent=(task.campaigns||[]).reduce((a:number,c:any)=>a+c.sent,0);detail=`${task.campaigns?.length||0} campaigns · ${sent} sent`;}
                      else{detail=task.memberDone?.[me.id]?"Completed":"Pending";}
                      return (
                        <div key={task.id} style={{border:"1.5px solid #ebebeb",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:tt.color,flexShrink:0}}/>
                          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{task.title}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{detail}</div></div>
                          <span style={{fontSize:11,fontWeight:700,color:tt.color,background:tt.bg,padding:"2px 8px",borderRadius:20}}>{tt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/*  MEMBERS (all roles — members can add only, managers can also delete)  */}
          {page==="members"&&(
            <div className="fade-up"> <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}> <div><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Telesales Members</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{members.length} member{members.length!==1?"s":""}</div></div> <button className="primary-btn" onClick={()=>setModal("addMember")}>+ Add Member</button> </div> {members.length===0?(
                <div style={{textAlign:"center",padding:"80px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16}}> <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>No members yet</div> <div style={{color:"#888",fontSize:13,marginBottom:20}}>Add your telesales members to get started</div> <button className="primary-btn" onClick={()=>setModal("addMember")}>+ Add First Member</button> </div> ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}> {members.map((m,i)=>{
                    const [c1,c2]=AVATAR_COLORS[m.colorIdx];
                    const allDays:any[]=Object.values(db.days||{});
                    const totalCalls=allDays.reduce((sum:number,d:any)=>sum+((d.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales"&&((t.assignedMembers||[]) as any[]).some((am:any)=>am.id===m.id)).reduce((s:number,t:any)=>s+(t.memberStats?.[m.id]?.total||0),0),0);
                    const taskCount=allDays.reduce((sum:number,d:any)=>sum+((d.tasks||[]) as any[]).filter((t:any)=>((t.assignedMembers||[]) as any[]).some((am:any)=>am.id===m.id)).length,0);
                    return (
                      <div key={m.id} className="card fade-up" style={{padding:18,animationDelay:`${i*.05}s`}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}> <div style={{width:46,height:46,borderRadius:14,background:`linear-gradient(135deg,${c1},${c2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> <button className="danger-btn" onClick={()=>confirmRemoveMember(m.id,m.name)} style={{visibility:isManager?"visible":"hidden"}}>×</button> </div> <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>{m.name}</div> <div style={{fontSize:12,color:"#888"}}>{totalCalls} calls · {taskCount} tasks assigned</div> </div> );
                  })}
                </div> )}
            </div> )}

          {/*  SETTINGS (manager only)  */}
          {page==="settings"&&isManager&&(
            <div className="fade-up"> <div style={{marginBottom:24}}><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5,marginBottom:4}}>Settings</div><div style={{fontSize:13,color:"#888"}}>Configure PINs and daily targets</div></div> <div className="card" style={{marginBottom:16}}> <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Change PINs</div> <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Manager PIN <span style={{color:"#bbb",fontWeight:400}}>(currently: {settings.managerPin||"1234"})</span></div> <div style={{position:"relative"}}><input className="text-input" type={showManagerPin?"text":"password"} inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={settingManagerPin} onChange={e=>{ if(/^\d*$/.test(e.target.value)&&e.target.value.length<=4) setSettingManagerPin(e.target.value); }} style={{paddingRight:40}}/><button onClick={()=>setShowManagerPin(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{showManagerPin?"Hide":"Show"}</button></div> <button onClick={resetManagerPin} style={{marginTop:8,background:"none",border:"none",color:"#ef4444",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>Reset to default (1234)</button> </div> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Telesales Member PIN <span style={{color:"#bbb",fontWeight:400}}>(currently: {settings.agentPin||"0000"})</span></div> <div style={{position:"relative"}}><input className="text-input" type={showMemberPin?"text":"password"} inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={settingMemberPin} onChange={e=>{ if(/^\d*$/.test(e.target.value)&&e.target.value.length<=4) setSettingMemberPin(e.target.value); }} style={{paddingRight:40}}/><button onClick={()=>setShowMemberPin(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{showMemberPin?"Hide":"Show"}</button></div> <button onClick={resetMemberPin} style={{marginTop:8,background:"none",border:"none",color:"#ef4444",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>Reset to default (0000)</button> </div> </div> </div> <div className="card" style={{marginBottom:20}}> <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Daily Targets (per telesales member)</div> <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Call Target <span style={{color:"#bbb",fontWeight:400}}>(currently: {callTarget||"not set"})</span></div> <input className="text-input" type="number" min={0} placeholder="e.g. 80" value={settingCallTarget} onChange={e=>setSettingCallTarget(e.target.value)}/> <div style={{fontSize:11,color:"#999",marginTop:5}}>Calls each member should make per day</div> </div> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Interested Target <span style={{color:"#bbb",fontWeight:400}}>(currently: {intTarget||"not set"})</span></div> <input className="text-input" type="number" min={0} placeholder="e.g. 10" value={settingIntTarget} onChange={e=>setSettingIntTarget(e.target.value)}/> <div style={{fontSize:11,color:"#999",marginTop:5}}>Interested leads each member should get</div> </div> </div> </div> <button className="primary-btn" style={{width:"100%",padding:14,fontSize:14}} onClick={saveSettings}>Save Settings</button> <div style={{marginTop:16,padding:"14px 18px",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,fontSize:13,color:"#92400e"}}>Changing PINs takes effect on next login. Remember the new PINs before locking the app.</div>
            <div className="card" style={{marginTop:20}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>WhatsApp Templates <span style={{fontSize:12,color:"#888",fontWeight:500}}>— use {"{name}"}, {"{phone}"}, {"{company}"} as placeholders</span></div>
              <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
                {(db.settings?.waTemplates||[]).map((t:any)=>(
                  <div key={t.id} style={{background:"#fafafa",border:"1.5px solid #ebebeb",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#059669",marginBottom:3}}>{t.name}</div>
                      <div style={{fontSize:12,color:"#555",lineHeight:1.5,wordBreak:"break-word" as const}}>{t.body}</div>
                    </div>
                    <button onClick={()=>updateDb((db:any)=>{if(db.settings?.waTemplates)db.settings.waTemplates=db.settings.waTemplates.filter((x:any)=>x.id!==t.id);})} style={{padding:"4px 10px",borderRadius:7,border:"1.5px solid #fecaca",background:"#fff",color:"#ef4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Delete</button>
                  </div>
                ))}
                <div style={{background:"#f0fdf4",border:"1.5px solid #a7f3d0",borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:8}}>
                  <input value={newTplName} onChange={e=>setNewTplName(e.target.value)} placeholder="Template name (e.g. First Follow-up)" style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
                  <textarea value={newTplBody} onChange={e=>setNewTplBody(e.target.value)} placeholder={`Hi {name}, just following up on our call…`} rows={3} style={{border:"1.5px solid #e5e5e5",borderRadius:8,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical" as const}}/>
                  <button onClick={()=>{if(!newTplName.trim()||!newTplBody.trim()){showToast("Name and body required.");return;} updateDb((db:any)=>{if(!db.settings)db.settings={};if(!db.settings.waTemplates)db.settings.waTemplates=[];db.settings.waTemplates.push({id:uid(),name:newTplName.trim(),body:newTplBody.trim()});}); setNewTplName("");setNewTplBody("");showToast("Template saved.");}} className="green-btn" style={{alignSelf:"flex-end",padding:"7px 18px",fontSize:13}}>Add Template</button>
                </div>
              </div>
            </div>
            </div> )}
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