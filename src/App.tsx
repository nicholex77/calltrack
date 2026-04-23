import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const AVATAR_COLORS = [
  ["#111","#444"],["#2563eb","#60a5fa"],["#059669","#34d399"],
  ["#dc2626","#f87171"],["#d97706","#fbbf24"],["#7c3aed","#a78bfa"],
  ["#db2777","#f472b6"],["#0891b2","#22d3ee"],
];
const initials = (n:string) => n.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const uid = () => Math.random().toString(36).slice(2,9);
const todayKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const weekStart = (dateStr:string) => { const d=new Date(dateStr); const day=d.getDay(); const diff=day===0?-6:1-day; const mon=new Date(d); mon.setDate(d.getDate()+diff); return mon.toISOString().split("T")[0]; };
const addDays = (dateStr:string,n:number) => { const d=new Date(dateStr); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const fmt = (dateStr:string) => { const d=new Date(dateStr+"T00:00:00"); return d.toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"}); };
const dayName = (dateStr:string) => { const d=new Date(dateStr+"T00:00:00"); return d.toLocaleDateString("en-MY",{weekday:"long"}); };

const STORAGE_KEY = "calltrack_v5";
// localStorage as fast local cache
const loadLocal  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); } catch { return {}; } };
const saveLocal  = (data:any) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} };
// Supabase read/write — single row with id='main'
const loadRemote = async () => { const { data } = await supabase.from("calltrack").select("data").eq("id","main").single(); return data?.data||{}; };
const saveRemote = (data:any) => supabase.from("calltrack").upsert({id:"main",data,updated_at:new Date().toISOString()}).then(({error})=>{ if(error) console.error("Supabase write error:",error); });

const TASK_TYPES = {
  telesales: { label:"Telesales Call", color:"#2563eb", bg:"#eff6ff" },
  whatsapp:  { label:"WhatsApp Follow-up", color:"#059669", bg:"#ecfdf5" },
  general:   { label:"General Task", color:"#7c3aed", bg:"#f5f3ff" },
};

const BRAND="#1a56db";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Geist',system-ui,sans-serif;background:#fff;color:#111;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
textarea,input,select{font-family:inherit;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{transform:scale(.95);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.fade-up{animation:fadeUp .22s ease both;}
.fade-in{animation:fadeIn .18s ease both;}
.pop{animation:pop .18s ease both;}
.shake{animation:shake .35s ease;}
.nav-link{padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;font-family:inherit;color:#666;transition:all .12s;}
.nav-link:hover{background:#eff6ff;color:#1a56db;}
.nav-link.active{background:#1a56db;color:#fff;}
.card{background:#fff;border:1.5px solid #ebebeb;border-radius:16px;overflow:hidden;}
.card-sm{background:#fafafa;border:1.5px solid #ebebeb;border-radius:12px;padding:14px;}
.task-chip{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:all .12s;border:1.5px solid transparent;margin-bottom:5px;}
.task-chip:hover{background:#f7f7f7;}
.task-chip.active{background:#eff6ff;border-color:#bfdbfe;}
.counter-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;color:#555;transition:all .12s;flex-shrink:0;}
.counter-btn:hover{background:#1a56db;color:#fff;border-color:#1a56db;}
.counter-btn:active{transform:scale(.95);}
.counter-btn.sm{width:24px;height:24px;border-radius:6px;font-size:13px;}
.num-input{border:1.5px solid #e5e5e5;border-radius:10px;font-size:20px;font-weight:700;text-align:center;padding:7px 2px;font-family:inherit;outline:none;transition:border-color .15s;color:#111;background:#fff;width:100%;min-width:0;}
.num-input:focus{border-color:#1a56db;}
.num-input.sm{font-size:15px;padding:5px 2px;border-radius:8px;}
.primary-btn{background:#1a56db;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.primary-btn:hover{background:#1447c0;}
.primary-btn:active{transform:scale(.97);}
.primary-btn:disabled{opacity:.35;cursor:not-allowed;}
.green-btn{background:#059669;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.green-btn:hover{background:#047857;}
.ghost-btn{background:#fff;color:#555;border:1.5px solid #e5e5e5;border-radius:10px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .12s;}
.ghost-btn:hover{border-color:#1a56db;color:#1a56db;}
.danger-btn{background:none;border:none;color:#ccc;font-size:12px;cursor:pointer;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
.danger-btn:hover{background:#fee2e2;color:#ef4444;}
.save-btn{background:#fff;color:#1a56db;border:1.5px solid #1a56db;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s;}
.save-btn:hover{background:#1a56db;color:#fff;}
.saved-btn{background:#1a56db;color:#fff;border:1.5px solid #1a56db;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;padding:20px;}
.modal{background:#fff;border-radius:20px;padding:26px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.15);animation:pop .18s ease;max-height:90vh;overflow-y:auto;}
.text-input{border:1.5px solid #444;border-radius:10px;padding:10px 13px;font-family:inherit;font-size:14px;color:#fff;background:#1a1a1a;outline:none;transition:border-color .15s;width:100%;}
.text-input:focus{border-color:#1a56db;}
.text-input::placeholder{color:#666;}
.remarks-ta{border:1.5px solid #444;border-radius:10px;padding:10px 13px;font-family:inherit;font-size:13px;color:#fff;background:#1a1a1a;resize:vertical;outline:none;transition:border-color .15s;line-height:1.6;width:100%;}
.remarks-ta:focus{border-color:#1a56db;}
.remarks-ta::placeholder{color:#bbb;}
.progress-track{height:6px;border-radius:99px;background:#f0f0f0;overflow:hidden;}
.progress-fill{height:100%;border-radius:99px;transition:width .4s ease,background .3s ease;}
.stat-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;}
.type-btn{padding:7px 13px;border-radius:9px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;transition:all .1s;color:#555;}
.type-btn.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:200;animation:fadeUp .2s ease;white-space:nowrap;pointer-events:none;}
.export-table{width:100%;border-collapse:collapse;font-size:12px;}
.export-table th{background:#1a56db;color:#fff;padding:8px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}
.export-table td{padding:8px 12px;border-bottom:1px solid #f0f0f0;white-space:nowrap;}
.export-table tr:hover td{background:#eff6ff;}
.tab-btn{padding:8px 16px;border-radius:9px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .12s;color:#555;}
.tab-btn.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.pin-box{width:38px;height:46px;border:2px solid #333;border-radius:10px;font-size:20px;font-weight:800;text-align:center;font-family:inherit;outline:none;transition:border-color .15s,background .15s;background:#111;color:#fff;caret-color:transparent;}
.pin-box:focus{border-color:#1a56db;background:#222;}
.pin-box.error{border-color:#ef4444;background:#7f1d1d;}
.role-card{border:2px solid #e5e5e5;border-radius:20px;padding:28px 20px;cursor:pointer;transition:all .12s;text-align:center;flex:1;user-select:none;}
.role-card:hover{border-color:#1a56db;background:#eff6ff;}
.role-card:active{transform:scale(.96);background:#1a56db;color:#fff;border-color:#1a56db;}
.weekly-tab{padding:9px 20px;border-radius:10px;border:1.5px solid #e5e5e5;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:all .12s;color:#555;}
.weekly-tab:hover{border-color:#1a56db;color:#1a56db;}
.weekly-tab.active{background:#1a56db;border-color:#1a56db;color:#fff;}
.summary-stat{background:#fafafa;border:1.5px solid #ebebeb;border-radius:14px;padding:16px;text-align:center;}
.conv-summary-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;}
.conv-summary-table th{background:#1a1a1a;color:#fff;padding:9px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.conv-summary-table td{padding:10px 14px;border-bottom:1px solid #f0f0f0;font-weight:600;}
.conv-summary-table tr:last-child td{border-bottom:none;}
.conv-summary-table .highlight{color:#1a56db;font-size:15px;font-weight:800;}
.confirm-modal{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.18);animation:pop .18s ease;}
.danger-solid-btn{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .12s;}
.danger-solid-btn:hover{background:#dc2626;}
.unsaved-dot{width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;margin-left:5px;vertical-align:middle;flex-shrink:0;}
.lb-row{display:grid;grid-template-columns:32px 1fr 70px 70px 70px 80px;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid #f5f5f5;}
.lb-row:last-child{border-bottom:none;}
.member-pick-card{border:1.5px solid #e5e5e5;border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .12s;display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.member-pick-card:hover{border-color:#1a56db;background:#eff6ff;}
.title-input{border:none;border-bottom:2px solid #1a56db;border-radius:0;padding:2px 4px;font-family:inherit;font-size:16px;font-weight:800;color:#111;background:transparent;outline:none;width:100%;letter-spacing:-.3px;}
.title-input::placeholder{color:#bbb;}
.sidebar-toggle{background:none;border:1.5px solid #e5e5e5;border-radius:8px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#888;transition:all .12s;flex-shrink:0;}
.sidebar-toggle:hover{border-color:#1a56db;color:#1a56db;}
.hamburger{display:none;background:none;border:none;cursor:pointer;padding:6px;color:#555;}
.mobile-nav{display:none;position:absolute;top:56px;left:0;right:0;background:#fff;border-bottom:1px solid #ebebeb;padding:8px 16px;z-index:49;animation:slideDown .18s ease;}
.mobile-nav .nav-link{display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:2px;}
@media(max-width:768px){
  .hamburger{display:flex;align-items:center;justify-content:center;}
  .desktop-nav{display:none!important;}
  .mobile-nav{display:block;}
  .daily-grid{grid-template-columns:1fr!important;}
  .sidebar-panel{display:none;}
  .sidebar-panel.open{display:block;}
  .detail-panel{min-height:0;}
  .desktop-only{display:none!important;}
  .mobile-full{width:100%!important;}
  .page-wrap{padding:16px 14px 80px!important;}
  .weekly-grid{grid-template-columns:repeat(4,1fr)!important;}
  .modal{padding:20px 16px;}
  .lb-row{grid-template-columns:28px 1fr 56px 56px;gap:4px;}
  .lb-row>div:nth-child(4),.lb-row>div:nth-child(5){display:none;}
  .mobile-task-bar{display:flex!important;flex-direction:column;}
}
@media(max-width:480px){
  .weekly-grid{grid-template-columns:repeat(2,1fr)!important;}
  .stat-grid-4{grid-template-columns:repeat(2,1fr)!important;}
  .perf-grid{grid-template-columns:1fr!important;}
}
`

function Counter({ value, onChange, size="normal" }: { value:number; onChange:(v:number)=>void; size?:string }) {
  const isSmall = size==="sm";
  return (
    <div style={{display:"flex",alignItems:"center",gap:isSmall?4:6}}> <button className={`counter-btn${isSmall?" sm":""}`} onClick={()=>onChange(value-1)}>−</button> <input type="number" min={0} className={`num-input${isSmall?" sm":""}`} value={value} onChange={e=>onChange(Math.max(0,parseInt(e.target.value)||0))}/> <button className={`counter-btn${isSmall?" sm":""}`} onClick={()=>onChange(value+1)}>+</button> </div> );
}

function TargetBar({ label, value, target }: { label:string; value:number; target:number }) {
  const pct = target>0 ? Math.min(100,Math.round(value/target*100)) : 0;
  const hit = target>0 && value>=target;
  const barColor = hit?"#16a34a":pct>=70?"#d97706":"#ef4444";
  return (
    <div style={{marginBottom:10}}> <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}> <span style={{fontSize:12,color:"#555",fontWeight:600}}>{label}</span> <div style={{display:"flex",alignItems:"center",gap:6}}> {target>0&&<span style={{fontSize:11,color:"#999"}}>{value}/{target}</span>}
          {hit&&<span style={{fontSize:11,fontWeight:700,color:"#16a34a",background:"#f0fdf4",padding:"1px 7px",borderRadius:20}}>Hit</span>}
          {!hit&&target>0&&<span style={{fontSize:11,fontWeight:700,color:barColor}}>{pct}%</span>}
        </div> </div> {target>0&&<div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`,background:barColor}}/></div>}
    </div> );
}

//  PIN Screen 
function PinScreen({ onUnlock, db }: { onUnlock:(role:string, memberId:string|null)=>void; db:any }) {
  const [selected, setSelected] = useState<string|null>(null);
  const [pin, setPin]           = useState(["","","",""]);
  const [error, setError]       = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [pickMember, setPickMember] = useState(false);
  const refs = [useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null),useRef<HTMLInputElement>(null)];
  const managerPin = db.settings?.managerPin||"1234";
  const memberPin  = db.settings?.agentPin||"0000";
  const members:any[]  = db.members||[];

  const handleDigit = (i:number, val:string) => {
    if(!/^\d?$/.test(val)) return;
    const next=[...pin]; next[i]=val; setPin(next); setError(false);
    if(val&&i<3) refs[i+1].current?.focus();
    if(val&&i===3){
      const entered=next.join("");
      if(selected==="manager"&&entered===managerPin){ onUnlock("manager",null); return; }
      if(selected==="member"&&entered===memberPin){
        if(members.length===0){ onUnlock("member",null); return; }
        setPickMember(true); return;
      }
      setError(true); setShakeKey(k=>k+1); setPin(["","","",""]);
      setTimeout(()=>refs[0].current?.focus(),50);
    }
  };
  const handleKey = (i:number, e:React.KeyboardEvent<HTMLInputElement>) => { if(e.key==="Backspace"&&!pin[i]&&i>0) refs[i-1].current?.focus(); };
  const selectRole = (role:string) => { setSelected(role); setTimeout(()=>refs[0].current?.focus(),80); };

  if(pickMember) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9f9f9",padding:24}}>
      <div style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:24,padding:"36px 32px",boxShadow:"0 8px 40px rgba(0,0,0,.08)",border:"1.5px solid #ebebeb"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:48,height:48,borderRadius:14,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5,marginBottom:4}}>Who are you?</div>
          <div style={{fontSize:13,color:"#aaa"}}>Select your name to continue</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {members.map((m:any)=>(
            <div key={m.id} onClick={()=>onUnlock("member",m.id)}
              style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:14,border:"1.5px solid #e5e5e5",cursor:"pointer",transition:"all .12s",background:"#fff"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#1a56db";e.currentTarget.style.background="#eff6ff";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e5e5";e.currentTarget.style.background="#fff";}}>
              <div style={{width:42,height:42,borderRadius:12,background:AVATAR_COLORS[m.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(m.name)}</div>
              <span style={{fontWeight:700,fontSize:15,flex:1}}>{m.name}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
        <button className="ghost-btn" style={{width:"100%"}} onClick={()=>{setPickMember(false);setPin(["","","",""]);}}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9f9f9",padding:24}}> <div style={{width:"100%",maxWidth:420,background:"#fff",borderRadius:24,padding:"40px 36px",boxShadow:"0 8px 40px rgba(0,0,0,.08)",border:"1.5px solid #ebebeb",textAlign:"center"}}> <div style={{width:56,height:56,borderRadius:18,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> </div> <div style={{fontWeight:800,fontSize:28,letterSpacing:-.6,marginBottom:6}}>blurB</div> <div style={{fontSize:13,color:"#aaa",marginBottom:36}}>mudah.my · Sign in to continue</div> {!selected ? (
          <> <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:16,textTransform:"uppercase",letterSpacing:.8}}>Select your role</div> <div style={{display:"flex",gap:14,justifyContent:"center"}}> <div className="role-card" onClick={()=>selectRole("manager")}> <div style={{fontWeight:800,fontSize:16}}>Manager</div> <div style={{fontSize:12,color:"#888",marginTop:6,lineHeight:1.5}}>Full access · Export · Settings</div> </div> <div className="role-card" onClick={()=>selectRole("member")}> <div style={{fontWeight:800,fontSize:16}}>Telesales Member</div> <div style={{fontSize:12,color:"#888",marginTop:6,lineHeight:1.5}}>Log tasks · View progress</div> </div> </div> </> ) : (
          <> <div style={{fontSize:15,fontWeight:800,color:"#111",marginBottom:6}}> {selected==="manager"?"Manager":"Telesales Member"} PIN
            </div> <div style={{fontSize:12,color:"#bbb",marginBottom:28}}> Default: <strong style={{color:"#999"}}>{selected==="manager"?"1234":"0000"}</strong> — change anytime in Settings
            </div> <div key={shakeKey} className={error?"shake":""} style={{display:"flex",justifyContent:"center",gap:12,marginBottom:20}}> {[0,1,2,3].map(i=>(
                <input key={i} ref={refs[i]} className={`pin-box${error?" error":""}`}
                  type="text" inputMode="numeric" maxLength={1}
                  value={pin[i]} onChange={e=>handleDigit(i,e.target.value)} onKeyDown={e=>handleKey(i,e)}/> ))}
            </div> {error&&<div style={{fontSize:13,color:"#ef4444",fontWeight:600,marginBottom:16}}>Incorrect PIN — try again.</div>}
            <button className="ghost-btn" style={{width:"100%"}} onClick={()=>{setSelected(null);setPin(["","","",""]);setError(false);}}>← Back</button> </> )}
      </div> </div> );
}

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
  const [memberInput, setMemberInput] = useState("");
  const [campaignInput, setCampaignInput] = useState("");
  const [campaignTargetId, setCampaignTargetId] = useState<string|null>(null);
  const [toast, setToast]             = useState<string|null>(null);
  const [settingManagerPin, setSettingManagerPin] = useState("");
  const [settingMemberPin, setSettingMemberPin]   = useState("");
  const [showManagerPin, setShowManagerPin]       = useState(false);
  const [showMemberPin, setShowMemberPin]         = useState(false);
  const [settingCallTarget, setSettingCallTarget] = useState("");
  const [settingIntTarget, setSettingIntTarget]   = useState("");
  const [confirmModal, setConfirmModal]           = useState<{type:string;id:string;title:string}|null>(null);
  const [loggedInMemberId, setLoggedInMemberId]   = useState<string|null>(null);
  const [sidebarOpen, setSidebarOpen]             = useState(true);
  const [mobileNavOpen, setMobileNavOpen]         = useState(false);
  const [scriptOpen, setScriptOpen]               = useState(false);
  const [leadsOpen, setLeadsOpen]                 = useState(false);
  const [contactSearch, setContactSearch]         = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState("all");
  const [contactLeadFilter, setContactLeadFilter] = useState("all");
  const [contactSelectMode, setContactSelectMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [emailModal, setEmailModal]               = useState<{task:any}|null>(null);
  const [emailTo, setEmailTo]                     = useState("");
  const [syncing, setSyncing]                     = useState(true);

  const modalRef     = useRef<HTMLInputElement>(null);
  const nextColorRef = useRef<number>(0);
  const writerIdRef  = useRef(uid()); // unique ID for this browser session

  // ── Supabase real-time sync ──────────────────────────────────────────────────
  useEffect(()=>{
    console.log("Supabase init starting...");

    // 1. Load latest data from Supabase on mount
    loadRemote().then(data=>{
      console.log("Supabase loadRemote result:", data);
      if(data && Object.keys(data).length>0){
        const { __writerId:_, ...clean } = data;
        saveLocal(clean);
        setDb(clean);
      }
      setSyncing(false);
    }).catch((err:any)=>{ console.error("Supabase loadRemote error:", err); setSyncing(false); });

    // 2. Subscribe to live changes from other devices
    const channel = supabase
      .channel("calltrack-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"calltrack"},(payload:any)=>{
        console.log("Supabase realtime event:", payload);
        const incoming = payload.new?.data;
        if(!incoming) return;
        // ignore echoes of our own writes by checking the session writer ID
        if(incoming.__writerId === writerIdRef.current) return;
        const { __writerId:_, ...clean } = incoming;
        saveLocal(clean);
        setDb(clean);
      })
      .subscribe((status:string)=>{
        console.log("Supabase channel status:", status);
      });

    console.log("Supabase channel created:", channel);
    return ()=>{ supabase.removeChannel(channel); };
  },[]);

  useEffect(()=>{ if(modal) setTimeout(()=>modalRef.current?.focus(),60); },[modal]);
  useEffect(()=>{ setSelectedTaskId(null); },[currentDate]);

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),2200); };

  // updateDb — writes locally immediately, then syncs to Supabase
  const updateDb = (fn:(db:any)=>void) => setDb((prev:any)=>{
    const next=JSON.parse(JSON.stringify(prev));
    fn(next);
    saveLocal(next);
    // embed writerId so realtime echo is ignored on this device
    saveRemote({...next, __writerId: writerIdRef.current});
    return next;
  });
  const ensureDay = (db:any,date:string) => { if(!db.days) db.days={}; if(!db.days[date]) db.days[date]={tasks:[],saved:false}; };

  const isManager  = role==="manager";
  const members:any[]  = db.members||[];
  const settings:any   = db.settings||{};
  const callTarget = parseInt(String(settings.callTarget||0))||0;
  const intTarget  = parseInt(String(settings.intTarget||0))||0;

  const handleUnlock = (r:string, memberId:string|null) => { setRole(r); setLoggedInMemberId(memberId||null); setPage("daily"); };
  const handleLock   = () => { setRole(null); setLoggedInMemberId(null); setPage("daily"); setSelectedTaskId(null); };

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
    if(newTaskType==="telesales") task={id:uid(),type:"telesales",title:newTaskTitle.trim(),assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),memberStats:Object.fromEntries(assigned.map((m:any)=>[m.id,{total:0,answered:0,notAnswered:0,interested:0}])),remarks:""};
    else if(newTaskType==="whatsapp") task={id:uid(),type:"whatsapp",title:newTaskTitle.trim(),assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),notes:"",campaigns:[]};
    else task={id:uid(),type:"general",title:newTaskTitle.trim(),assignedMembers:assigned.map((m:any)=>({id:m.id,name:m.name,colorIdx:m.colorIdx})),memberDone:Object.fromEntries(assigned.map((m:any)=>[m.id,false])),notes:""};
    updateDb((db:any)=>{ ensureDay(db,currentDate); db.days[currentDate].tasks.push(task); });
    setSelectedTaskId(task.id); setModal(null); setNewTaskTitle(""); setNewTaskMemberIds([]);
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

  const updateContactLeadStatus = (contactId:string, leadStatus:string|null) => {
    updateDb((db:any)=>{ const c=(db.contacts||[]).find((c:any)=>c.id===contactId); if(c) c.leadStatus=leadStatus; });
  };

  const deleteContact = (contactId:string) => {
    updateDb((db:any)=>{ db.contacts=(db.contacts||[]).filter((c:any)=>c.id!==contactId); });
    setSelectedContactIds(prev=>{ const n=new Set(prev); n.delete(contactId); return n; });
  };

  const deleteSelectedContacts = () => {
    updateDb((db:any)=>{ db.contacts=(db.contacts||[]).filter((c:any)=>!selectedContactIds.has(c.id)); });
    setSelectedContactIds(new Set());
    setContactSelectMode(false);
  };

  const deleteAllContacts = () => {
    updateDb((db:any)=>{ db.contacts=[]; });
    setSelectedContactIds(new Set());
    setContactSelectMode(false);
  };

  const importContactsFromCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string)||"";
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if (lines.length < 2) { showToast("CSV has no data rows."); return; }

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

      const iName    = col("customer_name","client_name","name","contact_name");
      const iPhone   = col("primary_phone","phone_number","phone","mobile");
      const iCompany = col("agency","company","store_id","store");
      const iState   = col("most_frequent_state","remarks","remark","notes","state");
      const iStatus  = col("call_status","status");
      const iInterest= col("interest","interested");
      const iAgent   = col("agent","agent_name");
      const iDate    = col("date");

      const PRIORITY: any = { interested:3, callback:2, contacted:1 };
      const stripPhone = (p:string) => p.replace(/[\s\-()+.]/g,"").toLowerCase();

      const seen: any = {};

      for (let i = 1; i < lines.length; i++) {
        const row = parseRow(lines[i]);
        const statusRaw   = (iStatus   >= 0 ? row[iStatus]   : "").trim().toLowerCase();
        const interestRaw = (iInterest >= 0 ? row[iInterest] : "").trim().toLowerCase();

        let bucket: string|null = null;
        if (interestRaw==="yes")                             bucket="interested";
        else if (/^ans/.test(statusRaw))                     bucket="contacted";
        else if (/callback|call back|\bcb\b/.test(statusRaw)) bucket="callback";
        if (!bucket) continue;

        const name    = iName    >= 0 ? row[iName].trim()    : "";
        const phone   = iPhone   >= 0 ? row[iPhone].trim()   : "";
        const company = iCompany >= 0 ? row[iCompany].trim() : "";
        const remarks = iState   >= 0 ? row[iState].trim()   : "";
        const agent   = iAgent   >= 0 ? row[iAgent].trim()   : "";
        const date    = iDate    >= 0 ? row[iDate].trim()    : "";
        const key     = (phone ? stripPhone(phone) : name.toLowerCase().trim());
        if (!key) continue;

        const existing = seen[key];
        const inP = PRIORITY[bucket]||0;
        if (!existing || inP > (PRIORITY[existing.status]||0)) {
          seen[key] = { id: existing?.id || crypto.randomUUID(), name: name||phone, phone, company, status: bucket, agentName: agent, date, remarks, leadStatus: existing?.leadStatus||null };
        }
      }

      const imported = Object.values(seen) as any[];
      if (!imported.length) { showToast("No qualifying rows found (need Answered/Callback/Interested)."); return; }

      updateDb((db:any) => {
        const existing: any[] = db.contacts || [];
        const existingMap: any = {};
        existing.forEach((c:any) => {
          const k = c.phone ? stripPhone(c.phone) : (c.name||"").toLowerCase().trim();
          if (k) existingMap[k] = c;
        });
        imported.forEach((c:any) => {
          const k = c.phone ? stripPhone(c.phone) : (c.name||"").toLowerCase().trim();
          const ex = existingMap[k];
          if (!ex || (PRIORITY[c.status]||0) >= (PRIORITY[ex.status]||0)) {
            existingMap[k] = { ...c, leadStatus: ex?.leadStatus||null };
          }
        });
        db.contacts = Object.values(existingMap);
      });

      showToast(`Imported ${imported.length} contact${imported.length!==1?"s":""}.`);
    };
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
      } else {
        s[field]=numVal;
      }
    });
  };
  const updateTaskField = (taskId:string, field:string, value:any) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!task) return; task[field]=value; });
  };
  const toggleMemberDone = (taskId:string, memberId:string) => {
    updateDb((db:any)=>{ const task=db.days?.[currentDate]?.tasks?.find((t:any)=>t.id===taskId); if(!task) return; task.memberDone[memberId]=!task.memberDone[memberId]; });
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

  const saveSettings = () => {
    updateDb((db:any)=>{
      if(!db.settings) db.settings={};
      if(settingManagerPin.length===4) db.settings.managerPin=settingManagerPin;
      if(settingMemberPin.length===4)  db.settings.agentPin=settingMemberPin;
      if(settingCallTarget!=="")       db.settings.callTarget=parseInt(settingCallTarget)||0;
      if(settingIntTarget!=="")        db.settings.intTarget=parseInt(settingIntTarget)||0;
    });
    showToast("Settings saved");
    setSettingManagerPin(""); setSettingMemberPin(""); setSettingCallTarget(""); setSettingIntTarget("");
  };

  const resetManagerPin = () => {
    updateDb((db:any)=>{ if(!db.settings) db.settings={}; db.settings.managerPin="1234"; });
    showToast("Manager PIN reset to 1234");
  };
  const resetMemberPin = () => {
    updateDb((db:any)=>{ if(!db.settings) db.settings={}; db.settings.agentPin="0000"; });
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
    const rows:any[] = [];
    dates.forEach((date:string)=>{
      ((db.days?.[date]?.tasks||[]) as any[]).filter((t:any)=>t.type==="telesales").forEach((task:any)=>{
        ((task.assignedMembers||[]) as any[]).forEach((m:any)=>{
          const s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0};
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
    const headers=Object.keys(rows[0]);
    const csvContent=[headers.join(","),...rows.map((r:any)=>headers.map((h:string)=>`"${String(r[h]||"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const encoded="data:text/csv;charset=utf-8,"+encodeURIComponent(csvContent);
    const a=document.createElement("a"); a.href=encoded;
    a.download=`blurb_${exportTab}_${exportRange}_${todayKey()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("CSV exported");
  };

  const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script"); s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });

  const exportToPDF = async () => {
    const rows = getPreviewRows();
    if(rows.length===0){ showToast("No data to export"); return; }
    showToast("Generating PDF…");
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      // @ts-ignore
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });

      // Title
      doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(17,17,17);
      const tabLabel = exportTab==="telesales"?"Telesales":exportTab==="whatsapp"?"WhatsApp":"General";
      const rangeLabel = exportRange==="today"?"Today":exportRange==="week"?"This Week":"Last 30 Days";
      doc.text(`blurB — ${tabLabel} Report`, 40, 44);
      doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(120,120,120);
      doc.text(`${rangeLabel}  ·  Generated ${fmt(todayKey())}  ·  mudah.my`, 40, 60);

      // Summary table (replaces pie chart)
      let summaryEndY = 75;
      if(exportTab==="telesales"){
        const summ = buildTelesalesSummaryStats(rows);
        // @ts-ignore
        doc.autoTable({
          head:[["Metric","Value","Rate"]],
          body:[
            ["Total Calls Made", String(summ.totalCalls), "—"],
            ["Total Answered",   String(summ.totalAnswered),  `${summ.answerRate}% answer rate`],
            ["Total Not Answered",String(summ.totalNotAns),  "—"],
            ["Total Interested", String(summ.totalInterested),`${summ.convRate}% conversion rate`],
          ],
          startY:75,
          tableWidth:260,
          styles:{fontSize:9,cellPadding:5},
          headStyles:{fillColor:[17,17,17],textColor:[255,255,255],fontStyle:"bold",fontSize:8},
          columnStyles:{1:{fontStyle:"bold"},2:{textColor:[26,86,219]}},
          margin:{left:40},
        });
        // @ts-ignore
        summaryEndY = (doc as any).lastAutoTable.finalY + 14;
      } else if(exportTab==="whatsapp"){
        const totals = rows.reduce((a:any,r:any)=>({sent:a.sent+(r.Sent||0),replied:a.replied+(r.Replied||0),closed:a.closed+(r.Closed||0)}),{sent:0,replied:0,closed:0});
        const replyRate=totals.sent>0?Math.round(totals.replied/totals.sent*100):0;
        const closeRate=totals.replied>0?Math.round(totals.closed/totals.replied*100):0;
        // @ts-ignore
        doc.autoTable({
          head:[["Metric","Value","Rate"]],
          body:[
            ["Total Sent",   String(totals.sent),   "—"],
            ["Total Replied",String(totals.replied), `${replyRate}% reply rate`],
            ["Total Closed", String(totals.closed),  `${closeRate}% close rate`],
          ],
          startY:75,
          tableWidth:260,
          styles:{fontSize:9,cellPadding:5},
          headStyles:{fillColor:[17,17,17],textColor:[255,255,255],fontStyle:"bold",fontSize:8},
          columnStyles:{1:{fontStyle:"bold"},2:{textColor:[26,86,219]}},
          margin:{left:40},
        });
        // @ts-ignore
        summaryEndY = (doc as any).lastAutoTable.finalY + 14;
      } else {
        const done=rows.filter((r:any)=>r.Status==="Done").length;
        // @ts-ignore
        doc.autoTable({
          head:[["Metric","Value"]],
          body:[["Tasks Done",`${done}/${rows.length}`],["Pending",String(rows.length-done)]],
          startY:75,
          tableWidth:180,
          styles:{fontSize:9,cellPadding:5},
          headStyles:{fillColor:[17,17,17],textColor:[255,255,255],fontStyle:"bold",fontSize:8},
          columnStyles:{1:{fontStyle:"bold"}},
          margin:{left:40},
        });
        // @ts-ignore
        summaryEndY = (doc as any).lastAutoTable.finalY + 14;
      }

      // Main data table
      const headers = Object.keys(rows[0]);
      // @ts-ignore
      doc.autoTable({
        head:[headers],
        body:rows.map((r:any)=>headers.map(h=>String(r[h]??""))) ,
        startY:summaryEndY,
        styles:{fontSize:7,cellPadding:4,textColor:[30,30,30]},
        headStyles:{fillColor:[17,17,17],textColor:[255,255,255],fontStyle:"bold",fontSize:7},
        alternateRowStyles:{fillColor:[249,249,249]},
        margin:{left:40,right:40},
        tableWidth:"auto",
      });

      doc.save(`blurb_${exportTab}_${exportRange}_${todayKey()}.pdf`);
      showToast("PDF exported");
    } catch(e) {
      console.error(e);
      showToast("PDF export failed");
    }
  };

  //  Overall performance summary (for export page) 
  const buildPerformanceSummary = () => {
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
              const s=task.memberStats?.[member.id]||{};
              total+=s.total||0; answered+=s.answered||0; interested+=s.interested||0;
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
    const isSheetSync=task.id.startsWith("sheet-sync-");
    const totals=(assigned as any[]).reduce((a:any,m:any)=>{ const s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0}; return {total:a.total+s.total,answered:a.answered+s.answered,notAnswered:a.notAnswered+s.notAnswered,interested:a.interested+s.interested}; },{total:0,answered:0,notAnswered:0,interested:0});
    const aRate=totals.total>0?Math.round(totals.answered/totals.total*100):0;
    const cRate=totals.answered>0?Math.round(totals.interested/totals.answered*100):0;
    return (
      <div className="card fade-up"> <div style={{padding:"18px 20px",borderBottom:"1px solid #f0f0f0"}}> <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}> <div style={{flex:1,minWidth:0}}>{isSheetSync?<div style={{fontWeight:800,fontSize:16,letterSpacing:-.3,marginBottom:6}}>{task.title}</div>:<input className="title-input" defaultValue={task.title} onBlur={e=>updateTaskTitle(task.id,e.target.value)} placeholder="Task title..."/>}<div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}><MemberAvatarRow assignedMembers={assigned}/>{isSheetSync&&<span style={{fontSize:10,fontWeight:700,color:"#059669",background:"#ecfdf5",padding:"2px 8px",borderRadius:20,border:"1px solid #a7f3d0"}}>Synced from Sheet</span>}</div></div> <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}> <div style={{display:"flex",gap:5,flexWrap:"wrap"}}> <span className="stat-badge" style={{background:"#f0fdf4",color:"#15803d"}}>Ans: {totals.answered}</span> <span className="stat-badge" style={{background:"#fff1f2",color:"#be123c"}}>N/A: {totals.notAnswered}</span> <span className="stat-badge" style={{background:"#fffbeb",color:"#b45309"}}>Int: {totals.interested}</span> </div> <div style={{display:"flex",gap:6,alignItems:"center"}}><button className="ghost-btn" style={{padding:"5px 10px",fontSize:11}} onClick={()=>copyTaskToDate(task,addDays(currentDate,1))}>Reuse Tomorrow</button>{task.saved?<button className="saved-btn" onClick={()=>unsaveTask(task.id)}>Saved</button>:<button className="save-btn" onClick={()=>saveTask(task.id)}>Save</button>}</div> </div> </div> </div> <div style={{padding:20}}> {(callTarget>0||intTarget>0)&&(
            <div style={{background:"#fafafa",border:"1.5px solid #ebebeb",borderRadius:14,padding:16,marginBottom:16}}> <div style={{fontWeight:700,fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Team Target Progress</div> {callTarget>0&&<TargetBar label="Total Calls" value={totals.total} target={callTarget*assigned.length}/>}
              {intTarget>0&&<TargetBar label="Interested" value={totals.interested} target={intTarget*assigned.length}/>}
            </div> )}
          {assigned.map((m:any)=>{
            const s=task.memberStats?.[m.id]||{total:0,answered:0,notAnswered:0,interested:0};
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
    if(task.type==="telesales"){ const tot=(assigned as any[]).reduce((a:number,m:any)=>a+(task.memberStats?.[m.id]?.total||0),0); subtitle=`${tot} calls · ${assigned.length} member${assigned.length!==1?"s":""}`; }
    else if(task.type==="whatsapp"){ subtitle=`${task.campaigns?.length||0} campaign${task.campaigns?.length!==1?"s":""}`; }
    else { const done=(assigned as any[]).filter((m:any)=>task.memberDone?.[m.id]).length; subtitle=`${done}/${assigned.length} done`; }
    return (
      <div className={`task-chip ${isActive?"active":""}`} onClick={()=>setSelectedTaskId(task.id)}> <div style={{width:8,height:8,borderRadius:"50%",background:tt.color,flexShrink:0,marginLeft:2}}></div> <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{task.title}</div><div style={{fontSize:11,color:"#999",marginTop:1}}>{subtitle}</div></div> {isManager&&<button className="danger-btn" onClick={e=>{e.stopPropagation();confirmRemoveTask(task.id,task.title);}}>×</button>}
      </div> );
  };

  if(!role) return <PinScreen onUnlock={handleUnlock} db={db}/>;

  const hasUnsaved = dayTasks.some((t:any)=>!t.saved);
  const navItems = isManager
    ? [["daily","Daily"],["weekly","Weekly"],["contacts","Contacts"],["export","Export"],["members","Members"],["settings","Settings"]]
    : [["daily","Daily"],["weekly","Weekly"],["mystats","My Stats"],["export","Export"],["members","Members"]];

  const perfSummary = buildPerformanceSummary();
  const previewRows = getPreviewRows();

  return (
    <> <style>{CSS}</style> <div style={{minHeight:"100vh",background:"#fff"}}> {/* NAV */}
        <div style={{borderBottom:"1px solid #ebebeb",background:"#fff",position:"sticky",top:0,zIndex:50}}>
          <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:9,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.13 6.13l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              </div>
              <span style={{fontWeight:800,fontSize:15,letterSpacing:-.4,color:"#1a56db"}}>blurB</span>
              <span style={{fontSize:11,color:"#888",background:"#f3f3f3",padding:"2px 8px",borderRadius:5,fontWeight:600}}>mudah.my</span>
              {syncing&&<span style={{fontSize:11,color:"#888",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#f59e0b",display:"inline-block",animation:"pulse 1s infinite"}}/>Syncing…</span>}
            </div>
            {/* Desktop nav */}
            <div className="desktop-nav" style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
              {navItems.map(([p,label])=>(
                <button key={p} className={`nav-link ${page===p?"active":""}`} onClick={()=>setPage(p)} style={{display:"flex",alignItems:"center",gap:4}}>
                  {label}{p==="daily"&&hasUnsaved&&<span className="unsaved-dot"/>}
                </button>
              ))}
              <div style={{width:1,height:20,background:"#e5e5e5",margin:"0 4px"}}/>
              <div style={{fontSize:11,fontWeight:700,color:isManager?"#1a56db":"#059669",background:isManager?"#eff6ff":"#ecfdf5",padding:"3px 10px",borderRadius:20}}>{isManager?"Manager":"Telesales"}</div>
              <button className="ghost-btn" style={{padding:"5px 12px",fontSize:12}} onClick={handleLock}>Lock</button>
            </div>
            {/* Mobile hamburger */}
            <button className="hamburger" onClick={()=>setMobileNavOpen(v=>!v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
          {/* Mobile dropdown nav */}
          {mobileNavOpen&&(
            <div className="mobile-nav" onClick={()=>setMobileNavOpen(false)}>
              {navItems.map(([p,label])=>(
                <button key={p} className={`nav-link ${page===p?"active":""}`} onClick={()=>setPage(p)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",textAlign:"left"}}>
                  {label}{p==="daily"&&hasUnsaved&&<span className="unsaved-dot"/>}
                </button>
              ))}
              <div style={{borderTop:"1px solid #f0f0f0",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:isManager?"#1a56db":"#059669"}}>{isManager?"Manager":"Telesales Member"}</div>
                <button className="ghost-btn" style={{padding:"5px 12px",fontSize:12}} onClick={handleLock}>Lock</button>
              </div>
            </div>
          )}
        </div>
        <div className="page-wrap" style={{maxWidth:1100,margin:"0 auto",padding:"24px 20px 80px"}}> {/*  DAILY  */}
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
                  {/* Mobile: show + and task list above detail */}
                  <div style={{display:"none"}} className="mobile-task-bar">
                    <div style={{display:"flex",gap:8,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
                      {dayTasks.map((task:any)=><button key={task.id} onClick={()=>setSelectedTaskId(task.id)} style={{whiteSpace:"nowrap",padding:"6px 12px",borderRadius:20,border:`1.5px solid ${task.id===selectedTaskId?"#1a56db":"#e5e5e5"}`,background:task.id===selectedTaskId?"#eff6ff":"#fff",color:task.id===selectedTaskId?"#1a56db":"#555",fontSize:12,fontWeight:600,cursor:"pointer"}}>{task.title}</button>)}
                      <button onClick={()=>{setNewTaskMemberIds([]);setModal("addTask");}} style={{whiteSpace:"nowrap",padding:"6px 12px",borderRadius:20,border:"1.5px solid #1a56db",background:"#1a56db",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add</button>
                    </div>
                  </div>
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
          {page==="contacts"&&isManager&&(()=>{
            const contacts:any[] = db.contacts||[];
            const statusPriority:any = {interested:3,callback:2,contacted:1};
            const statusMeta:any = {
              interested:{label:"Interested",color:"#059669",bg:"#f0fdf4"},
              callback:  {label:"Callback",  color:"#d97706",bg:"#fffbeb"},
              contacted: {label:"Contacted",  color:"#2563eb",bg:"#eff6ff"},
            };
            const leadMeta:any = {
              hot: {label:"Hot",  color:"#ef4444",bg:"#fff1f2"},
              warm:{label:"Warm", color:"#d97706",bg:"#fffbeb"},
              cold:{label:"Cold", color:"#2563eb",bg:"#eff6ff"},
            };
            const q = contactSearch.trim().toLowerCase();
            const filtered = contacts.filter((c:any)=>{
              if(contactStatusFilter!=="all" && c.status!==contactStatusFilter) return false;
              if(contactLeadFilter==="unclassified" && c.leadStatus) return false;
              if(contactLeadFilter!=="all" && contactLeadFilter!=="unclassified" && c.leadStatus!==contactLeadFilter) return false;
              if(q && !`${c.name} ${c.phone} ${c.company||""}`.toLowerCase().includes(q)) return false;
              return true;
            }).sort((a:any,b:any)=>(statusPriority[b.status]||0)-(statusPriority[a.status]||0));
            const counts:any = {all:contacts.length,interested:0,callback:0,contacted:0};
            contacts.forEach((c:any)=>{ if(counts[c.status]!==undefined) counts[c.status]++; });
            const leadCounts:any = {all:contacts.length,hot:0,warm:0,cold:0,unclassified:0};
            contacts.forEach((c:any)=>{ if(c.leadStatus&&leadCounts[c.leadStatus]!==undefined) leadCounts[c.leadStatus]++; else leadCounts.unclassified++; });
            return (
              <div className="fade-up">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
                  <div><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5}}>Contacts</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{contacts.length} total · {counts.interested} interested · {counts.callback} callbacks</div></div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {contactSelectMode&&selectedContactIds.size>0&&(
                      <button onClick={deleteSelectedContacts} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #ef4444",background:"#ef4444",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Delete ({selectedContactIds.size})
                      </button>
                    )}
                    {contacts.length>0&&!contactSelectMode&&(
                      <button onClick={()=>{ if(window.confirm(`Delete all ${contacts.length} contacts? This cannot be undone.`)) deleteAllContacts(); }} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid #ef4444",background:"#fff",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Delete All
                      </button>
                    )}
                    <button onClick={()=>{ setContactSelectMode(m=>!m); setSelectedContactIds(new Set()); }} style={{padding:"8px 16px",borderRadius:10,border:`1.5px solid ${contactSelectMode?"#111":"#e5e5e5"}`,background:contactSelectMode?"#111":"#fff",color:contactSelectMode?"#fff":"#555",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      {contactSelectMode?"Cancel":"Select"}
                    </button>
                    <label style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:10,border:"1.5px solid #1a56db",background:"#fff",color:"#1a56db",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      ↑ Import CSV
                      <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0]; if(f) importContactsFromCSV(f); e.target.value="";}}/>
                    </label>
                  </div>
                </div>
                {/* Search */}
                <input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search by name, phone or company…" style={{border:"1.5px solid #e5e5e5",borderRadius:10,padding:"9px 14px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",marginBottom:14,transition:"border-color .15s"}} onFocus={e=>e.target.style.borderColor="#1a56db"} onBlur={e=>e.target.style.borderColor="#e5e5e5"}/>
                {/* Call status filter */}
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                  {(["all","interested","callback","contacted"] as const).map(s=>(
                    <button key={s} onClick={()=>setContactStatusFilter(s)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${contactStatusFilter===s?"#1a56db":"#e5e5e5"}`,background:contactStatusFilter===s?"#1a56db":"#fff",color:contactStatusFilter===s?"#fff":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {s==="all"?"All calls":s.charAt(0).toUpperCase()+s.slice(1)} <span style={{opacity:.7}}>({counts[s]??contacts.length})</span>
                    </button>
                  ))}
                </div>
                {/* Lead status filter */}
                <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
                  {([["all","All leads"],["hot","🔴 Hot"],["warm","🟡 Warm"],["cold","🔵 Cold"],["unclassified","Unclassified"]] as const).map(([k,label])=>(
                    <button key={k} onClick={()=>setContactLeadFilter(k)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${contactLeadFilter===k?"#111":"#e5e5e5"}`,background:contactLeadFilter===k?"#111":"#fff",color:contactLeadFilter===k?"#fff":"#555",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {label} <span style={{opacity:.7}}>({leadCounts[k]??0})</span>
                    </button>
                  ))}
                </div>
                {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 20px",border:"1.5px dashed #e5e5e5",borderRadius:16,color:"#bbb",fontSize:13}}>No contacts match your filters.</div>}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
                  {filtered.map((c:any)=>{
                    const sm=statusMeta[c.status]||statusMeta.contacted;
                    return (
                      <div key={c.id} onClick={()=>{ if(contactSelectMode){ setSelectedContactIds(prev=>{ const n=new Set(prev); n.has(c.id)?n.delete(c.id):n.add(c.id); return n; }); } }} style={{background:"#fff",border:`1.5px solid ${contactSelectMode&&selectedContactIds.has(c.id)?"#1a56db":"#ebebeb"}`,borderRadius:16,padding:18,display:"flex",flexDirection:"column",gap:12,transition:"box-shadow .15s",cursor:contactSelectMode?"pointer":"default"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.08)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                        {/* Header */}
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          {contactSelectMode&&(
                            <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${selectedContactIds.has(c.id)?"#1a56db":"#ccc"}`,background:selectedContactIds.has(c.id)?"#1a56db":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {selectedContactIds.has(c.id)&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          )}
                          <div style={{width:42,height:42,borderRadius:13,background:"#1a56db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>{initials(c.name||"?")}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name||"Unknown"}</div>
                            <div style={{fontSize:12,color:"#888",marginTop:2}}>{c.phone||"—"}{c.company?` · ${c.company}`:""}</div>
                          </div>
                          <span style={{fontSize:11,fontWeight:700,color:sm.color,background:sm.bg,padding:"3px 9px",borderRadius:20,flexShrink:0}}>{sm.label}</span>
                          {!contactSelectMode&&(
                            <button onClick={e=>{ e.stopPropagation(); if(window.confirm(`Delete ${c.name||"this contact"}?`)) deleteContact(c.id); }} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",padding:4,display:"flex",alignItems:"center",flexShrink:0}} title="Delete contact">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </div>
                        {/* Agent + date */}
                        <div style={{fontSize:12,color:"#999",display:"flex",gap:8,alignItems:"center"}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {c.agentName||"—"} · {c.date?fmt(c.date):"—"}
                        </div>
                        {/* Remarks */}
                        {c.remarks&&<div style={{fontSize:12,color:"#555",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{c.remarks}</div>}
                        {/* Lead status toggles */}
                        <div style={{display:"flex",gap:6,paddingTop:4,borderTop:"1px solid #f5f5f5"}}>
                          {(["hot","warm","cold"] as const).map(ls=>{
                            const lm=leadMeta[ls];
                            const active=c.leadStatus===ls;
                            return <button key={ls} onClick={()=>updateContactLeadStatus(c.id,active?null:ls)} style={{flex:1,padding:"6px 0",borderRadius:9,border:`1.5px solid ${active?lm.color:"#e5e5e5"}`,background:active?lm.bg:"#fff",color:active?lm.color:"#aaa",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
                              {ls==="hot"?"🔴":ls==="warm"?"🟡":"🔵"} {lm.label}
                            </button>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              <div className="card" style={{overflow:"hidden",marginBottom:24}}> <div style={{padding:"14px 18px",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}> <div><div style={{fontWeight:700,fontSize:14}}>Preview</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{previewRows.length} row{previewRows.length!==1?"s":""}</div></div> <div style={{display:"flex",gap:8}}> <button className="ghost-btn" onClick={exportToPDF} disabled={previewRows.length===0} style={{fontSize:13}}>Export PDF</button> <button className="green-btn" onClick={exportToCSV} disabled={previewRows.length===0}>Export CSV</button> </div> </div> {previewRows.length===0?(
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
            const rangeStats:any = Object.fromEntries(Object.entries(ranges).map(([range,dates])=>{
              let total=0,answered=0,notAnswered=0,interested=0,sent=0,replied=0,closed=0,generalDone=0,generalTotal=0;
              dates.forEach((date:string)=>{
                ((db.days?.[date]?.tasks||[]) as any[]).forEach((task:any)=>{
                  const assigned=((task.assignedMembers||[]) as any[]).some((m:any)=>m.id===me!.id);
                  if(!assigned) return;
                  if(task.type==="telesales"){const s=task.memberStats?.[me!.id]||{};total+=s.total||0;answered+=s.answered||0;notAnswered+=s.notAnswered||0;interested+=s.interested||0;}
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
            <div className="fade-up"> <div style={{marginBottom:24}}><div style={{fontWeight:800,fontSize:22,letterSpacing:-.5,marginBottom:4}}>Settings</div><div style={{fontSize:13,color:"#888"}}>Configure PINs and daily targets</div></div> <div className="card" style={{marginBottom:16}}> <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Change PINs</div> <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Manager PIN <span style={{color:"#bbb",fontWeight:400}}>(currently: {settings.managerPin||"1234"})</span></div> <div style={{position:"relative"}}><input className="text-input" type={showManagerPin?"text":"password"} inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={settingManagerPin} onChange={e=>{ if(/^\d*$/.test(e.target.value)&&e.target.value.length<=4) setSettingManagerPin(e.target.value); }} style={{paddingRight:40}}/><button onClick={()=>setShowManagerPin(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{showManagerPin?"Hide":"Show"}</button></div> <button onClick={resetManagerPin} style={{marginTop:8,background:"none",border:"none",color:"#ef4444",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>Reset to default (1234)</button> </div> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Telesales Member PIN <span style={{color:"#bbb",fontWeight:400}}>(currently: {settings.agentPin||"0000"})</span></div> <div style={{position:"relative"}}><input className="text-input" type={showMemberPin?"text":"password"} inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={settingMemberPin} onChange={e=>{ if(/^\d*$/.test(e.target.value)&&e.target.value.length<=4) setSettingMemberPin(e.target.value); }} style={{paddingRight:40}}/><button onClick={()=>setShowMemberPin(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{showMemberPin?"Hide":"Show"}</button></div> <button onClick={resetMemberPin} style={{marginTop:8,background:"none",border:"none",color:"#ef4444",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>Reset to default (0000)</button> </div> </div> </div> <div className="card" style={{marginBottom:20}}> <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",fontWeight:700,fontSize:14}}>Daily Targets (per telesales member)</div> <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Call Target <span style={{color:"#bbb",fontWeight:400}}>(currently: {callTarget||"not set"})</span></div> <input className="text-input" type="number" min={0} placeholder="e.g. 80" value={settingCallTarget} onChange={e=>setSettingCallTarget(e.target.value)}/> <div style={{fontSize:11,color:"#999",marginTop:5}}>Calls each member should make per day</div> </div> <div> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Interested Target <span style={{color:"#bbb",fontWeight:400}}>(currently: {intTarget||"not set"})</span></div> <input className="text-input" type="number" min={0} placeholder="e.g. 10" value={settingIntTarget} onChange={e=>setSettingIntTarget(e.target.value)}/> <div style={{fontSize:11,color:"#999",marginTop:5}}>Interested leads each member should get</div> </div> </div> </div> <button className="primary-btn" style={{width:"100%",padding:14,fontSize:14}} onClick={saveSettings}>Save Settings</button> <div style={{marginTop:16,padding:"14px 18px",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,fontSize:13,color:"#92400e"}}>Changing PINs takes effect on next login. Remember the new PINs before locking the app.</div> </div> )}
        </div> {/*  MODALS  */}
        {modal==="addTask"&&(
          <div className="modal-overlay" onClick={()=>setModal(null)}> <div className="modal" onClick={e=>e.stopPropagation()}> <div style={{fontWeight:800,fontSize:18,marginBottom:4,letterSpacing:-.3}}>New Task</div> <div style={{fontSize:13,color:"#888",marginBottom:18}}>Choose a type, assign members, and set a title</div> <div style={{marginBottom:14}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Task Type</div> <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(TASK_TYPES).map(([k,v])=><button key={k} className={`type-btn ${newTaskType===k?"active":""}`} onClick={()=>setNewTaskType(k)}>{v.label}</button>)}</div> </div> <div style={{marginBottom:14}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Assign Telesales Members <span style={{color:"#999",fontWeight:400}}>(select one or more)</span></div> {members.length===0?(
                  <div style={{padding:"10px 14px",background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,fontSize:13,color:"#92400e"}}>No members. <span style={{fontWeight:700,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setModal(null);setPage("members");}}>Add one →</span></div> ):(
                  <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}> {members.map((m:any)=>{ const sel=newTaskMemberIds.includes(m.id); return (
                      <div key={m.id} onClick={()=>toggleMemberSelection(m.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1.5px solid ${sel?"#1a56db":"#e5e5e5"}`,background:sel?"#eff6ff":"#fff",cursor:"pointer",transition:"all .12s"}}> <div style={{width:28,height:28,borderRadius:8,background:AVATAR_COLORS[m.colorIdx][0],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>{initials(m.name)}</div> <span style={{flex:1,fontWeight:600,fontSize:13}}>{m.name}</span> <div style={{width:16,height:16,borderRadius:4,background:sel?"#1a56db":"transparent",border:`1.5px solid ${sel?"#1a56db":"#ccc"}`,display:"flex",alignItems:"center",justifyContent:"center"}}> {sel&&<svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div> </div> );})}
                  </div> )}
              </div> <div style={{marginBottom:20}}> <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>Task Title</div> <input ref={modalRef} className="text-input" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder={newTaskType==="telesales"?"e.g. Morning Call Session":newTaskType==="whatsapp"?"e.g. April Follow-up":"e.g. Prepare weekly report"}/> </div> <div style={{display:"flex",gap:10}}> <button className="ghost-btn" style={{flex:1}} onClick={()=>{setModal(null);setNewTaskTitle("");}}>Cancel</button> <button className="primary-btn" style={{flex:1}} onClick={addTask} disabled={!newTaskTitle.trim()||newTaskMemberIds.length===0||members.length===0}>Create Task</button> </div> </div> </div> )}
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
        {toast&&<div className="toast">{toast}</div>}
      </div> </> );
}